import { MessageType } from '../../../../src/messages';
import { genPreviewFrame } from '../core';
import { clearPreview } from '../utils';

// ==================== 按钮尺寸拓展 - 预览功能 ====================
// 用于"按钮尺寸拓展"页面的预览功能
// 根据按钮配置创建水平排列的预览矩形
function handler(data: any) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage || !currentPage.selection || currentPage.selection.length === 0) {
    mg.notify('请先选中一个图层！');
    return;
  }

  const { config } = data;
  const node = currentPage.selection[0];
  if (clearPreview(node, 'preview_from_id')) return;

  const frame = genPreviewFrame({
    node,
    sizes: [
      config.paddingLeft,
      node.width - config.paddingLeft - config.paddingRight,
      config.paddingRight,
    ].map(width => {
      return {
        width,
        height: node.height,
      };
    }),
    direction: 'horizontal',
  });
  frame.setPluginData('preview_from_id', node.id);
}

export default {
  type: MessageType.GEN_BUTTON_PREVIEW,
  handler,
};
