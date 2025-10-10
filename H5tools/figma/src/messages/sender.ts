import { MessageType } from './messageType';

/**
 * 向UI发送消息
 */
export const sendMsgToUI = (type: MessageType, data: any = {}) => {
  figma.ui.postMessage({
    type,
    data,
  });
};

/**
 * 向插件发送消息
 */
export const sendMsgToPlugin = (type: MessageType, data: any = {}) => {
  parent.postMessage(
    { pluginMessage: { type, data: JSON.parse(JSON.stringify(data)) } },
    '*'
  );
};
