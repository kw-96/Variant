import { MessageType } from '../../../../src/messages';
import { genPreviewFrame } from '../core';
import { clearPreview } from '../utils';

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
  
  // 调试: 查看传递的数据
  console.log('Preview data:', data);
  console.log('Sizes:', sizes);
  
  if (!sizes || sizes.length === 0) {
    mg.notify('没有可预览的尺寸数据！');
    return;
  }

  const node = currentPage.selection[0];
  if (clearPreview(node, 'preview_from_id')) return;

  const frame = genPreviewFrame({ node, sizes, direction: 'vertical' });
  frame.setPluginData('preview_from_id', node.id);
}

export default {
  type: MessageType.GEN_EXPAND_PREVIEW,
  handler,
};
