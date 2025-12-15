// 批量按钮转为数据流（需要仅存在一个文本节点）
import { MessageType } from '../../../../../../../src/messages';
import { convertToDataFlow } from './utils';

function handler() {
  // 批量按钮需要检查文本节点数量
  convertToDataFlow(true);
}

export default {
  type: MessageType.BATCH_BUTTON_CONVERT,
  handler,
};

