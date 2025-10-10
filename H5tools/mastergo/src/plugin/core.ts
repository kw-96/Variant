import {
  color16ToRgb,
  cloneNode,
  createObject,
  createImageFrame,
} from './utils';

// 定义FILL_RULE常量
const FILL_RULE = {
  STRETCH: 'stretch',
  FILL_COLOR: 'fill_color'
};

// ==================== H5一键切图相关函数 ====================

// 图层拓展核心函数，用于"一键扩展"功能
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
    node.resize(width, Math.floor((width / node.width) * node.height));
  } else {
    node.resize(Math.floor((height / node.height) * node.width), height);
  }

  // 计算中间部分宽度
  const middleWidth = Math.max(width - paddingLeft - paddingRight, 0);
  const middleHeight = Math.max(height - paddingTop - paddingBottom, 0);

  // 创建主框架（整体）
  const mainFrame = createObject('createFrame', {
    x: position.x,
    y: position.y,
    width,
    height,
    name: `${name || node.name}`,
    fills: [], // 确保背景透明
  });

  // 左边或顶部框架
  if ((isVertical && paddingTop > 0) || (!isVertical && paddingLeft > 0)) {
    const ltFrame = createObject('createFrame', {
      x: 0,
      y: 0,
      width: isVertical ? width : paddingLeft,
      height: isVertical ? paddingTop : height,
      fills: [],
    });
    ltFrame.appendChild(cloneNode(node, { x: 0, y: 0 }));
    mainFrame.appendChild(ltFrame);
  }

  // 右边或底部框架
  if ((isVertical && paddingBottom > 0) || (!isVertical && paddingRight > 0)) {
    const rbFrame = createObject('createFrame', {
      x: isVertical ? 0 : paddingLeft + middleWidth,
      y: isVertical ? paddingTop + middleHeight : 0,
      width: isVertical ? width : paddingRight,
      height: isVertical ? paddingBottom : height,
      fills: [],
    });
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
    const middleFrame = createObject('createFrame', {
      x: isVertical ? 0 : paddingLeft,
      y: isVertical ? paddingTop : 0,
      width: isVertical ? width : Math.round(middleWidth),
      height: isVertical ? Math.round(middleHeight) : height,
      fills: [], // 确保背景透明
    });

    switch (fillConfig.fillRule) {
      case FILL_RULE.STRETCH: {
        // 创建用于导出图片的临时框架
        const blockFrame = createObject('createFrame', {
          x: 0,
          y: 0,
          width: isVertical
            ? width
            : Math.round(node.width - paddingLeft - paddingRight),
          height: isVertical
            ? Math.round(node.height - paddingTop - paddingBottom)
            : height,
          fills: [], // 确保导出透明背景
        });

        blockFrame.appendChild(
          cloneNode(node, {
            x: isVertical ? 0 : -paddingLeft,
            y: isVertical ? -paddingTop : 0,
          })
        );

        const imageFrame = await createImageFrame(blockFrame);
        imageFrame.resize(middleFrame.width, middleFrame.height);
        middleFrame.appendChild(imageFrame);
        blockFrame.remove();
        break;
      }
      case FILL_RULE.FILL_COLOR: {
        const rect = createObject('createRectangle', {
          x: 0,
          y: 0,
          width: isVertical ? width : middleWidth,
          height: isVertical ? middleHeight : height,
          fills: [
            {
              type: 'SOLID',
              color: color16ToRgb(fillConfig.fillColor),
            },
          ],
        });

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

// 图层拓展预览，用于"H5一键切图"页面的"预览"按钮
// 根据表格数据创建不同尺寸的彩色矩形预览
export const genPreviewFrame = ({
  node: selection,
  sizes,
  direction = 'vertical',
  fill = {
    opacity: 0.6,
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
  
  let cumulativeY = 0; // 垂直方向累积高度
  const rects: any[] = []; // 存储所有创建的矩形

  sizes.forEach((size: any, index: number) => {
    // 直接使用表格中的尺寸数据
    const width = Number(size.width);
    const height = Number(size.height);
    
    console.log(`Creating rect ${index}:`, { width, height, name: size.name });

    const rect = createObject('createRectangle', {
      x: node.x,
      y: node.y + cumulativeY,
      width,
      height,
      name: size.name || `尺寸${index + 1}`,
      fills: [
        {
          type: 'SOLID',
          color: color16ToRgb(
            size.color || (index % 2 === 0 ? '#00ff00' : '#ff0000')
          ),
          opacity: fill.opacity,
        },
      ],
    });
    
    console.log('Created rect:', rect);

    // 将矩形添加到当前页面
    console.log('Appending to currentPage:', currentPage);
    currentPage.appendChild(rect);
    rects.push(rect);
    
    cumulativeY += height;
  });
  
  node.remove();

  // 将所有矩形打组
  const group = mg.group(rects, currentPage);
  group.name = `${selection.name}-预览`;

  return group;
};
