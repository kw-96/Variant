import { MessageType } from '@messages';
import { genPreviewFrame } from '../core';

function handler(data) {
  if (figma.currentPage.selection.length === 0) {
    figma.notify('请先选中一个图层！');
    return;
  }

  const { config } = data;
  const node = figma.currentPage.selection[0];
  
  // 清理之前的预览（直接使用 Figma API）
  let hasClear = false;
  figma.currentPage.children.forEach((itemNode: any) => {
    if (itemNode.getPluginData('preview_from_id') === node.id) {
      itemNode.remove();
      hasClear = true;
    }
  });
  if (hasClear) return;

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
