import { MessageType } from '../../../../../src/messages';
import { collectSafeAreaNodes } from './safe-area';

// ==================== 切换安全区显示/隐藏 ====================
// 用于「导出」页与插件菜单中的「显隐安全区」入口（共用同一处理器）。
// 循环切换：全部可见 → 隐藏；否则 → 显示（隐藏 → 显示 → 隐藏）。
function handler() {
  const selection = (mg as any).document?.currentPage?.selection;
  if (!selection || selection.length === 0) return;

  const safeAreaNodes = collectSafeAreaNodes(selection);
  if (safeAreaNodes.length === 0) return;

  // 循环切换目标状态：全部可见则隐藏，否则统一显示
  const targetVisible = !safeAreaNodes.every((node: any) => node.isVisible !== false);
  safeAreaNodes.forEach((node: any) => {
    try {
      node.isVisible = targetVisible;
    } catch (error) {
      console.error('切换节点显示状态失败:', error);
    }
  });
  try {
    (mg as any).commitUndo && (mg as any).commitUndo();
  } catch (e) {
    // 撤销记录失败不影响画布状态
  }
}

export default {
  type: MessageType.TOGGLE_SAFE_AREA,
  handler,
};
