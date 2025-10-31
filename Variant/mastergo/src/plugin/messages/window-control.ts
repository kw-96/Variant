import { MessageType, sendMsgToUI } from '../../../../src/messages';

// ==================== 窗口控制 ====================
// 用于控制插件窗口的收起/展开状态

let previousWidth: number | null = null;
let previousHeight: number | null = null;

function collapseHandler(data?: { width?: number; height?: number }) {
  try {
    // 记录当前 UI 视窗与尺寸
    const vp = (mg as any).ui?.viewport;
    const oldWidth = vp?.width || null;
    const oldHeight = vp?.height || 600;
    const oldX = vp?.x || 0;
    const oldY = vp?.y || 0;
    if (oldWidth && oldWidth > 0) {
      previousWidth = oldWidth;
    }
    if (oldHeight && oldHeight > 0) {
      previousHeight = oldHeight;
    }
    // 收起宽度与 UI 保持一致（小于内容宽度即可）
    const targetWidth = data?.width ?? 120;
    const targetHeight = data?.height ?? oldHeight;
    if ((mg as any).ui?.resize) {
      (mg as any).ui.resize(targetWidth, targetHeight);
    }
    // 以右上角为基点：保持右边和上边不动
    if ((mg as any).ui?.moveTo && oldWidth) {
      const newX = Math.max(oldX + (oldWidth - targetWidth), 0);
      (mg as any).ui.moveTo(newX, oldY);
    }
    sendMsgToUI(MessageType.WINDOW_STATE_CHANGED, { collapsed: true });
  } catch (error) {
    console.error('收起窗口失败:', error);
  }
}

function expandHandler() {
  try {
    // 展开并恢复到之前的宽度（缺省 400），保持右上角为基点
    const vp = (mg as any).ui?.viewport;
    const oldWidth = vp?.width || 400;
    const oldX = vp?.x || 0;
    const oldY = vp?.y || 0;
    const targetHeight = previousHeight && previousHeight > 0 ? previousHeight : (vp?.height || 667);
    const targetWidth = previousWidth && previousWidth > 0 ? previousWidth : 400;
    if ((mg as any).ui?.resize) {
      (mg as any).ui.resize(targetWidth, targetHeight);
    }
    if ((mg as any).ui?.moveTo && oldWidth) {
      const newX = Math.max(oldX + (oldWidth - targetWidth), 0);
      (mg as any).ui.moveTo(newX, oldY);
    }
    sendMsgToUI(MessageType.WINDOW_STATE_CHANGED, { collapsed: false });
  } catch (error) {
    console.error('展开窗口失败:', error);
  }
}

export const collapseWindow = {
  type: MessageType.COLLAPSE_WINDOW,
  handler: collapseHandler,
};

export const expandWindow = {
  type: MessageType.EXPAND_WINDOW,
  handler: expandHandler,
};

