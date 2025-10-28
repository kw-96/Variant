import { genExpandFrame } from '../../core';

// ==================== 按钮尺寸拓展 - 自动生成按钮功能 ====================
// 用于"按钮尺寸拓展"页面的自动生成按钮功能
// 根据按钮配置自动生成多个尺寸的按钮
const autoGenerateButtons = {
  type: 'autoGenerateButtons',
  async handler(data: any) {
    try {
      const currentPage = (mg as any).document?.currentPage;
      if (!currentPage || !currentPage.selection || currentPage.selection.length === 0) {
        mg.notify('请先选中一个图层！');
        return;
      }
      
      const selectNode = currentPage.selection[0];

      const loadingNotification = mg.notify('正在处理中，请稍候...', { timeout: 10 * 1000 });

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
      mg.notify('处理完成', { timeout: 800 })
    } catch (error) {
      console.error('Error:', error);
      mg.notify('生成按钮时发生错误');
    }
  },
};

export default autoGenerateButtons;
