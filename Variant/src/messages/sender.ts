import { MessageType } from './messageType';

/**
 * 向UI发送消息（兼容 Figma / MasterGo）
 */
export const sendMsgToUI = (type: MessageType, data: any = {}) => {
  try {
    if (typeof figma !== 'undefined' && figma?.ui?.postMessage) {
      figma.ui.postMessage({ type, data });
      return;
    }
  } catch {}
  try {
    if (typeof mg !== 'undefined' && mg?.ui?.postMessage) {
      mg.ui.postMessage({ type, data });
      return;
    }
  } catch {}
  try {
    window.parent?.postMessage({ pluginMessage: { type, data } }, '*');
  } catch {}
};

/**
 * 向插件发送消息
 */
export const sendMsgToPlugin = (type: MessageType, data: any = {}) => {
  try {
    const message = { type, data: JSON.parse(JSON.stringify(data)) };
    parent.postMessage(message, '*');
  } catch (error) {
    console.error('Error sending message to plugin:', error);
  }
};
