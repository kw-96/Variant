// 数据流页面转为数据流（不限制文本节点数量）
import { MessageType } from '../../../../../../../src/messages';
import { convertToDataFlow } from './utils';

function handler() {
  // 数据流页面不检查文本节点数量
  convertToDataFlow(false);
}

export default {
  type: MessageType.DATA_FLOW_CONVERT,
  handler,
};

