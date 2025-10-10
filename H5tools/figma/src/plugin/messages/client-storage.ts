import { MessageType, sendMsgToUI } from '@messages';

async function handler({ _id, key, method, data }) {
  const res = await figma.clientStorage[method](
    key,
    data
  );
  sendMsgToUI(MessageType.STORAGE, { _id, data: res });
}

export default {
  type: MessageType.STORAGE,
  handler,
};
