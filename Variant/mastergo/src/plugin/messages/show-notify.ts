/**
 * 显示通知消息处理器
 * 从UI端接收通知消息并在MasterGo中显示
 */
import { MessageType } from '../../../../src/messages';

interface NotifyData {
  message: string;
  timeout?: number;
}

function handler(data: NotifyData) {
  if (!data || !data.message) {
    return;
  }
  
  const timeout = data.timeout || 2000;
  mg.notify(data.message, { timeout });
}

export default {
  type: MessageType.SHOW_NOTIFY,
  handler,
};

