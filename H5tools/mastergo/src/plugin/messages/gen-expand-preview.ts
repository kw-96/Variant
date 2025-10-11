import { MessageType } from '../../../../src/messages';
import { genPreviewFrame } from '../core';

// ==================== H5一键切图 - 预览功能 ====================
// 用于"H5一键切图"页面的"预览"按钮
// 根据表格数据创建不同尺寸的彩色矩形预览
function handler(data: any) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage || !currentPage.selection || currentPage.selection.length === 0) {
    mg.notify('请先选中一个图层！');
    return;
  }

  const { sizes } = data;
  
  if (!sizes || sizes.length === 0) {
    mg.notify('没有可预览的尺寸数据！');
    return;
  }

  const node = currentPage.selection[0];
  
  // 清理之前的预览
  let hasClear = false;
  const children = currentPage.children;
  // 使用 for 循环替代 forEach，避免 MasterGo API 兼容性问题
  for (let i = children.length - 1; i >= 0; i--) {
    const itemNode = children[i];
    if (itemNode.getPluginData && itemNode.getPluginData('preview_from_id') === node.id) {
      itemNode.remove();
      hasClear = true;
    }
  }
  if (hasClear) return;

  const frame = genPreviewFrame({ node, sizes, direction: 'vertical' });
  frame.setPluginData('preview_from_id', node.id);
}

export default {
  type: MessageType.GEN_EXPAND_PREVIEW,
  handler,
};
