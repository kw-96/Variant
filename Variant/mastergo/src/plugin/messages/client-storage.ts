import { MessageType, sendMsgToUI } from '../../../../src/messages';

async function handler({ _id, key, method, data }: any) {
  const res = await (mg.clientStorage as any)[method](
    key,
    data
  );
  sendMsgToUI(MessageType.STORAGE, { _id, data: res });
}

export default {
  type: MessageType.STORAGE,
  handler,
};
