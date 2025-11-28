/**
 * 整数像素功能
 * 将选中节点的宽高尺寸和位置对齐到整数像素
 */
import { MessageType } from '../../../../../../src/messages';

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    mg.notify('请先选择要处理的节点', { timeout: 2000 });
    return;
  }

  let processedCount = 0;

  // 遍历所有选中节点
  for (let i = 0; i < selection.length; i++) {
    const node = selection[i];
    
    if (!node) {
      continue;
    }

    // 将位置对齐到整数（四舍五入）
    if (typeof node.x === 'number') {
      node.x = Math.round(node.x);
    }
    if (typeof node.y === 'number') {
      node.y = Math.round(node.y);
    }

    // 将宽高尺寸变为整数（四舍五入）
    if (typeof node.width === 'number') {
      node.width = Math.round(node.width);
    }
    if (typeof node.height === 'number') {
      node.height = Math.round(node.height);
    }

    processedCount++;
  }

  if (processedCount > 0) {
    mg.notify(`已处理 ${processedCount} 个节点`, { timeout: 2000 });
  }
}

export default {
  type: MessageType.ROUND_TO_INTEGER,
  handler,
};

