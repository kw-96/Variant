import { genExpandFrame } from '../core';

const autoGenerateButtons = {
  type: 'autoGenerateButtons',
  async handler(data) {
    try {
      const selectNode = figma.currentPage.selection[0];
      if (!selectNode) {
        figma.notify('请先选中一个图层！');
        return;
      }

      const loadingNotification = figma.notify('正在处理中，请稍候...', { timeout: 10 * 1000 });

      // 固定间距
      const spacing = 20;
      // 获取选中节点的初始位置
      const baseX = selectNode.x + selectNode.width + spacing;
      const baseY = selectNode.y;
      const { config, sizes } = data;

      // 遍历 sizes，动态调整按钮的位置
      let cumulativeY = baseY; // 累计的 X 坐标

      for (const size of sizes) {
        const { width, height, name } = size;
        const paddingLeft = Math.floor(height * config.paddingLeft / selectNode.height);
        const paddingRight = Math.floor(height * config.paddingRight / selectNode.height);

        try {
          // 生成按钮
          await genExpandFrame({
            node: selectNode,
            resize: {
              name: name,
              width: Number(width),
              height: Number(height),
              paddingLeft,
              paddingRight,
            },
            position: {
              x: baseX,
              y: cumulativeY,
            },
            direction: 'horizontal',
          });
        } catch (e) {
          console.error(e);
        }

        cumulativeY += Number(height) + spacing;
      }

      loadingNotification.cancel();
      figma.notify('处理完成', { timeout: 800 })
    } catch (error) {
      console.error('Error:', error);
      figma.notify('生成按钮时发生错误');
    }
  },
};

export default autoGenerateButtons;
