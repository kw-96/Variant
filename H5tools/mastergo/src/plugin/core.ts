import {
  color16ToRgb,
  cloneNode,
} from '../../../src/plugin/utils';

// 定义FILL_RULE常量
const FILL_RULE = {
  STRETCH: 'stretch',
  FILL_COLOR: 'fill_color'
};

// ==================== 辅助函数 ====================

/**
 * 创建图片帧 - 直接克隆原节点而不是创建新的图片帧
 */
async function createImageFrame(node: any) {
  // MasterGo API 不支持 IMAGE 类型的 fills
  // 直接克隆原节点，保持原有的图片内容
  const imageFrame = node.clone();
  
  await new Promise(resolve => setTimeout(resolve, 150));
  return imageFrame;
}

// ==================== 图层扩展相关函数 ====================

// 图层扩展核心函数
// 用于"H5一键切图 - 一键扩展"和"按钮尺寸拓展 - 生成"功能
// 根据配置将图层扩展到指定尺寸，支持不同的填充规则
// - direction: 'vertical' (垂直扩展，用于H5一键切图)
// - direction: 'horizontal' (水平扩展，用于按钮尺寸拓展)
// 非必要不修改
export const genExpandFrame = async ({
  node: selection,
  resize,
  position,
  direction = 'vertical',
  fillConfig = {
    fillRule: FILL_RULE.STRETCH,
    fillColor: '#fff',
  },
}: {
  node: any;
  resize: any;
  position: any;
  direction?: string;
  fillConfig?: any;
}) => {
  // 先生成图片，图片拉伸不会导致图层错乱
  const node = await createImageFrame(selection); //节点

  const isVertical = direction === 'vertical'; //是否垂直
  const name = resize.name; //节点名称
  let width = Number(resize.width); //节点宽度
  let height = Number(resize.height); //节点高度
  let paddingLeft = Number(resize.paddingLeft); //左容器宽度
  let paddingRight = Number(resize.paddingRight); //右容器宽度
  let paddingTop = Number(resize.paddingTop); //上容器高度
  let paddingBottom = Number(resize.paddingBottom); //下容器高度

  if (isVertical) {
    const newHeight = Math.floor((width / node.width) * node.height); //节点高度
    node.width = width; //节点宽度
    node.height = newHeight; //节点高度
  } else {
    const newWidth = Math.floor((height / node.height) * node.width); //节点宽度
    node.width = newWidth; //节点宽度
    node.height = height; //节点高度
  }

  // 计算中间部分宽度
  const middleWidth = Math.max(width - paddingLeft - paddingRight, 0); //中间部分宽度
  const middleHeight = Math.max(height - paddingTop - paddingBottom, 0); //中间部分高度

  // 生成三个水平排列的容器（框架）：左/中/右
  // 命名规则由外层组控制，这里只生成容器
  const frames: any[] = [];

  // 左容器（自动布局：水平左对齐，垂直上对齐）
  if (!isVertical && paddingLeft > 0) {
    const leftFrame = mg.createFrame(); //左容器
    leftFrame.x = position.x;
    leftFrame.y = position.y;
    leftFrame.width = paddingLeft; //左容器宽度
    leftFrame.height = height; //左容器高度
    leftFrame.clipsContent = true; //左容器裁剪内容
    leftFrame.flexMode = 'HORIZONTAL';
    leftFrame.mainAxisAlignItems = 'FLEX_START'; // 水平左对齐
    leftFrame.crossAxisAlignItems = 'CENTER'; // 垂直居中
    leftFrame.mainAxisSizingMode = 'FIXED';
    leftFrame.crossAxisSizingMode = 'FIXED';
    leftFrame.paddingLeft = 0;
    leftFrame.paddingRight = 0;
    leftFrame.paddingTop = 0;
    leftFrame.paddingBottom = 0;
    leftFrame.itemSpacing = 0;
    // 透明填充
    leftFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }];
    // 放入克隆并通过裁剪显示左侧区域
    const leftClone = cloneNode(node); //左容器克隆
    // 让子节点保持固有尺寸，避免被拉伸
    if (leftClone.layoutAlign) leftClone.layoutAlign = 'INHERIT';
    if (leftClone.layoutGrow !== undefined) leftClone.layoutGrow = 0;
    leftFrame.appendChild(leftClone); //左容器添加克隆
    frames.push(leftFrame); //左容器添加到frames
  }

  // 中容器（自动布局：水平居中，垂直居中）
  if (!isVertical && middleWidth > 0) {
    const middleFrame = mg.createFrame(); //中容器
    middleFrame.x = position.x + paddingLeft;
    middleFrame.y = position.y;
    middleFrame.width = Math.round(middleWidth); //中容器宽度
    middleFrame.height = height; //中容器高度
    middleFrame.clipsContent = true; //中容器裁剪内容
    middleFrame.flexMode = 'HORIZONTAL';
    middleFrame.mainAxisAlignItems = 'CENTER'; // 水平居中
    middleFrame.crossAxisAlignItems = 'CENTER'; // 垂直居中
    middleFrame.mainAxisSizingMode = 'FIXED';
    middleFrame.crossAxisSizingMode = 'FIXED';
    middleFrame.paddingLeft = 0;
    middleFrame.paddingRight = 0;
    middleFrame.paddingTop = 0;
    middleFrame.paddingBottom = 0;
    middleFrame.itemSpacing = 0;
    middleFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }];
    // 直接克隆节点，交给自动布局做居中
    const middleClone = cloneNode(node);
    if (middleClone.layoutAlign) middleClone.layoutAlign = 'INHERIT';
    if (middleClone.layoutGrow !== undefined) middleClone.layoutGrow = 0;
    middleFrame.appendChild(middleClone);
    frames.push(middleFrame); //中容器添加到frames
  }

  // 右容器（自动布局：水平右对齐，垂直下对齐）
  if (!isVertical && paddingRight > 0) {
    const rightFrame = mg.createFrame(); //右容器
    rightFrame.x = position.x + paddingLeft + middleWidth;
    rightFrame.y = position.y;
    rightFrame.width = paddingRight; //右容器宽度
    rightFrame.height = height; //右容器高度
    rightFrame.clipsContent = true; //右容器裁剪内容
    rightFrame.flexMode = 'HORIZONTAL';
    rightFrame.mainAxisAlignItems = 'FLEX_END'; // 水平右对齐
    rightFrame.crossAxisAlignItems = 'CENTER'; // 垂直居中
    rightFrame.mainAxisSizingMode = 'FIXED';
    rightFrame.crossAxisSizingMode = 'FIXED';
    rightFrame.paddingLeft = 0;
    rightFrame.paddingRight = 0;
    rightFrame.paddingTop = 0;
    rightFrame.paddingBottom = 0;
    rightFrame.itemSpacing = 0;
    rightFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }]; //右容器填充
    const rightClone = cloneNode(node); //右容器克隆
    if (rightClone.layoutAlign) rightClone.layoutAlign = 'INHERIT';
    if (rightClone.layoutGrow !== undefined) rightClone.layoutGrow = 0;
    rightFrame.appendChild(rightClone); //右容器添加克隆
    frames.push(rightFrame); //右容器添加到frames
  }

  // ==================== 垂直方向：上 / 中 / 下 ====================
  // 上容器（自动布局：垂直上对齐，水平左对齐）
  // if (isVertical && paddingTop > 0) {
  //   const topFrame = mg.createFrame();
  //   topFrame.width = width;
  //   topFrame.height = paddingTop;
  //   topFrame.clipsContent = true;
  //   topFrame.layoutMode = 'VERTICAL';
  //   topFrame.primaryAxisAlignItems = 'MIN'; // 上对齐
  //   topFrame.counterAxisAlignItems = 'MIN'; // 左对齐
  //   topFrame.itemSpacing = 0;
  //   topFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }];
  //   const topClone = cloneNode(node);
  //   if (topClone.layoutAlign) topClone.layoutAlign = 'INHERIT';
  //   if (topClone.layoutGrow !== undefined) topClone.layoutGrow = 0;
  //   topFrame.appendChild(topClone);
  //   frames.push(topFrame);
  // }

  // // 中容器（自动布局：垂直居中，水平居中）
  // if (isVertical && middleHeight > 0) {
  //   const midVFrame = mg.createFrame();
  //   midVFrame.width = width;
  //   midVFrame.height = Math.round(middleHeight);
  //   midVFrame.clipsContent = true;
  //   midVFrame.layoutMode = 'VERTICAL';
  //   midVFrame.primaryAxisAlignItems = 'CENTER'; // 垂直居中
  //   midVFrame.counterAxisAlignItems = 'CENTER'; // 水平居中
  //   midVFrame.itemSpacing = 0;
  //   midVFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }];
  //   const midVClone = cloneNode(node);
  //   if (midVClone.layoutAlign) midVClone.layoutAlign = 'INHERIT';
  //   if (midVClone.layoutGrow !== undefined) midVClone.layoutGrow = 0;
  //   midVFrame.appendChild(midVClone);
  //   frames.push(midVFrame);
  // }

  // // 下容器（自动布局：垂直下对齐，水平右对齐）
  // if (isVertical && paddingBottom > 0) {
  //   const bottomFrame = mg.createFrame();
  //   bottomFrame.width = width;
  //   bottomFrame.height = paddingBottom;
  //   bottomFrame.clipsContent = true;
  //   bottomFrame.layoutMode = 'VERTICAL';
  //   bottomFrame.primaryAxisAlignItems = 'MAX'; // 下对齐
  //   bottomFrame.counterAxisAlignItems = 'MAX'; // 右对齐
  //   bottomFrame.itemSpacing = 0;
  //   bottomFrame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0 } }];
  //   const bottomClone = cloneNode(node);
  //   if (bottomClone.layoutAlign) bottomClone.layoutAlign = 'INHERIT';
  //   if (bottomClone.layoutGrow !== undefined) bottomClone.layoutGrow = 0;
  //   bottomFrame.appendChild(bottomClone);
  //   frames.push(bottomFrame);
  // }

  // 组：包含左/中/右三个框架，名称为 宽度x高度（外层容器负责水平排列）
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    console.error('Current page is not available');
    return frames[0] || node;
  }

  // 使用组承载三个子容器（名称为 宽度x高度）
  frames.forEach(f => currentPage.appendChild(f));
  const group = mg.group(frames, currentPage);
  group.name = `${width}x${height}`;
  group.x = position.x;
  group.y = position.y;

  // 清理：移除用于生成的中间节点
  node.remove();

  // 将组移动到指定位置
  group.x = position.x;
  group.y = position.y;

  return group;
};

// 图层预览功能
// 用于"H5一键切图"和"按钮尺寸拓展"页面的预览按钮
// 根据配置数据创建不同尺寸的彩色矩形预览
// - direction: 'vertical' (垂直排列，用于H5一键切图)
// - direction: 'horizontal' (水平排列，用于按钮尺寸拓展)
export const genPreviewFrame = ({
  node: selection,
  sizes,
  direction = 'vertical',
  fill = {
    opacity: 0.8,
  },
}: {
  node: any;
  sizes: any[];
  direction?: string;
  fill?: any;
}) => {
  const node = cloneNode(selection);
  
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    console.error('Current page is not available');
    return null;
  }
  
  const isVertical = direction === 'vertical';
  let cumulativeX = 0; // 水平方向累积宽度
  let cumulativeY = 0; // 垂直方向累积高度
  const rects: any[] = []; // 存储所有创建的矩形

  sizes.forEach((size: any, index: number) => {
    // 直接使用表格中的尺寸数据
    const width = Number(size.width);
    const height = Number(size.height);

    const rect = mg.createRectangle();
    rect.x = node.x + (isVertical ? 0 : cumulativeX);
    rect.y = node.y + (isVertical ? cumulativeY : 0);
    rect.width = width;
    rect.height = height;
    rect.name = size.name || `尺寸${index + 1}`;
    rect.fills = [
      {
        type: 'SOLID',
        color: color16ToRgb(
          size.color || (index % 2 === 0 ? '#00ff00' : '#ff0000')
        ),
      },
    ];
    rect.opacity = fill.opacity; // 直接在节点上设置透明度

    // 将矩形添加到当前页面
    currentPage.appendChild(rect);
    rects.push(rect);
    
    if (isVertical) {
      cumulativeY += height;
    } else {
      cumulativeX += width;
    }
  });
  
  node.remove();

  // 将所有矩形打组
  const group = mg.group(rects, currentPage);
  group.name = `${selection.name}-预览`;

  return group;
};
