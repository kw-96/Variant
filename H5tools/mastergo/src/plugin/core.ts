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
 * 创建图片帧
 */
async function createImageFrame(node: any) {
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 1 },
  });
  const image = mg.createImage(bytes);
  
  const imageFrame = mg.createFrame();
  imageFrame.x = node.x;
  imageFrame.y = node.y;
  imageFrame.width = node.width;
  imageFrame.height = node.height;
  imageFrame.fills = [
    {
      imageHash: (image as any).hash,
      scaleMode: 'CROP',
      type: 'IMAGE',
    },
  ];

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
  const node = await createImageFrame(selection);

  const isVertical = direction === 'vertical';
  const name = resize.name;
  let width = Number(resize.width);
  let height = Number(resize.height);
  let paddingLeft = Number(resize.paddingLeft);
  let paddingRight = Number(resize.paddingRight);
  let paddingTop = Number(resize.paddingTop);
  let paddingBottom = Number(resize.paddingBottom);

  if (isVertical) {
    const newHeight = Math.floor((width / node.width) * node.height);
    node.width = width;
    node.height = newHeight;
  } else {
    const newWidth = Math.floor((height / node.height) * node.width);
    node.width = newWidth;
    node.height = height;
  }

  // 计算中间部分宽度
  const middleWidth = Math.max(width - paddingLeft - paddingRight, 0);
  const middleHeight = Math.max(height - paddingTop - paddingBottom, 0);

  // 创建主框架（整体）
  const mainFrame = mg.createFrame();
  mainFrame.x = position.x;
  mainFrame.y = position.y;
  mainFrame.width = width;
  mainFrame.height = height;
  mainFrame.name = `${name || node.name}`;
  mainFrame.fills = [];

  // 左边或顶部框架
  if ((isVertical && paddingTop > 0) || (!isVertical && paddingLeft > 0)) {
    const ltFrame = mg.createFrame();
    ltFrame.x = 0;
    ltFrame.y = 0;
    ltFrame.width = isVertical ? width : paddingLeft;
    ltFrame.height = isVertical ? paddingTop : height;
    ltFrame.fills = [];
    ltFrame.appendChild(cloneNode(node, { x: 0, y: 0 }));
    mainFrame.appendChild(ltFrame);
  }

  // 右边或底部框架
  if ((isVertical && paddingBottom > 0) || (!isVertical && paddingRight > 0)) {
    const rbFrame = mg.createFrame();
    rbFrame.x = isVertical ? 0 : paddingLeft + middleWidth;
    rbFrame.y = isVertical ? paddingTop + middleHeight : 0;
    rbFrame.width = isVertical ? width : paddingRight;
    rbFrame.height = isVertical ? paddingBottom : height;
    rbFrame.fills = [];
    rbFrame.appendChild(
      cloneNode(node, {
        x: isVertical ? 0 : -(node.width - paddingRight),
        y: isVertical ? -(node.height - paddingBottom) : 0,
      })
    );
    mainFrame.appendChild(rbFrame);
  }

  // 创建中间部分
  if ((isVertical && middleHeight > 0) || (!isVertical && middleWidth > 0)) {
    const middleFrame = mg.createFrame();
    middleFrame.x = isVertical ? 0 : paddingLeft;
    middleFrame.y = isVertical ? paddingTop : 0;
    middleFrame.width = isVertical ? width : Math.round(middleWidth);
    middleFrame.height = isVertical ? Math.round(middleHeight) : height;
    middleFrame.fills = [];

    switch (fillConfig.fillRule) {
      case FILL_RULE.STRETCH: {
        // 创建用于导出图片的临时框架
        const blockFrame = mg.createFrame();
        blockFrame.x = 0;
        blockFrame.y = 0;
        blockFrame.width = isVertical ? width : Math.round(node.width - paddingLeft - paddingRight);
        blockFrame.height = isVertical ? Math.round(node.height - paddingTop - paddingBottom) : height;
        blockFrame.fills = [];

        blockFrame.appendChild(
          cloneNode(node, {
            x: isVertical ? 0 : -paddingLeft,
            y: isVertical ? -paddingTop : 0,
          })
        );

        const imageFrame = await createImageFrame(blockFrame);
        imageFrame.width = middleFrame.width;
        imageFrame.height = middleFrame.height;
        middleFrame.appendChild(imageFrame);
        blockFrame.remove();
        break;
      }
      case FILL_RULE.FILL_COLOR: {
        const rect = mg.createRectangle();
        rect.x = 0;
        rect.y = 0;
        rect.width = isVertical ? width : middleWidth;
        rect.height = isVertical ? middleHeight : height;
        rect.fills = [
          {
            type: 'SOLID',
            color: color16ToRgb(fillConfig.fillColor),
          },
        ];

        middleFrame.appendChild(rect);
        break;
      }
    }

    mainFrame.appendChild(middleFrame);
  }

  // 移除原始节点
  node.remove();

  // 将主框架添加到画布（当前页面）
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    console.error('Current page is not available');
    return mainFrame;
  }
  
  currentPage.appendChild(mainFrame);

  // 创建一个组来包含主框架（MasterGo 的 group 需要传入 parent 参数）
  const group = mg.group([mainFrame], currentPage);
  group.name = mainFrame.name;

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
