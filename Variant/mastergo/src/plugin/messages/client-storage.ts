import { MessageType, sendMsgToUI } from '../../../../src/messages';

/**
 * 客户端存储消息处理器
 * 用于处理 UI 端发送的存储相关请求（getAsync、setAsync、deleteAsync等）
 * 
 * @param param0 请求参数对象
 * @param param0._id 请求唯一标识符，用于在回调中匹配请求
 * @param param0.key 存储键名
 * @param param0.method 存储方法（getAsync、setAsync、deleteAsync等）
 * @param param0.data 存储数据（用于setAsync等方法）
 */
async function handler({ _id, key, method, data }: any) {
  // 调用 MasterGo 客户端存储 API
  const res = await (mg.clientStorage as any)[method](
    key,
    data
  );
  
  // 将结果发送回 UI 端
  sendMsgToUI(MessageType.STORAGE, { _id, data: res });
}

export default {
  type: MessageType.STORAGE,
  handler,
};
