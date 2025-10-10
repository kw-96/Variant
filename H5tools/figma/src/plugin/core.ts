import {
  color16ToRgb,
  cloneNode,
  createObject,
  createImageFrame,
} from './utils';
// 定义FILL_RULE常量
const FILL_RULE = {
  STRETCH: 'stretch',
  FILL_COLOR: 'fillColor'
};

// 图层拓展核心函数，非必要不修改
export const genExpandFrame = async ({
  node: selection,
  resize,
  position,
  direction = 'vertical',
  fillConfig = {
    fillRule: FILL_RULE.STRETCH,
    fillColor: '#fff',
  },
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
  figma.currentPage.appendChild(mainFrame);

  // 创建一个组来包含主框架
  const group = figma.group([mainFrame], figma.currentPage);
  group.name = mainFrame.name;

  return group;
};

// 图层拓展预览
export const genPreviewFrame = ({
  node: selection,
  sizes,
  direction = 'vertical',
  fill = {
    opacity: 0.6,
  },
}) => {
  const isVertical = direction === 'vertical';
  const node = cloneNode(selection);
  const frame = createObject('createFrame', {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fills: [],
    name: `${node.name}-预览`,
  });
  let cumulativeX = 0;
  let cumulativeY = 0;

  sizes.forEach((size, index) => {
    const width = isVertical
      ? node.width
      : (size.width * node.height) / size.height;
    const height = isVertical
      ? (size.height * node.width) / size.width
      : node.height;

    const rect = createObject('createRectangle', {
      x: isVertical ? 0 : cumulativeX,
      y: isVertical ? cumulativeY : 0,
      width,
      height,
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

    frame.appendChild(rect);

    if (isVertical) {
      cumulativeY += height;
    } else {
      cumulativeX += width;
    }
  });
  node.remove();

  // 创建一个组来包含主框架
  const group = figma.group([frame], figma.currentPage);
  group.name = frame.name;

  return group;
};
