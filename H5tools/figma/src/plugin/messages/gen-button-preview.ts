import { MessageType } from '@messages';
import { genPreviewFrame } from '../core';
import { clearPreview } from '../utils';

function handler(data) {
  if (figma.currentPage.selection.length === 0) {
    figma.notify('请先选中一个图层！');
    return;
  }

  const { config } = data;
  const node = figma.currentPage.selection[0];
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
