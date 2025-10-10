import { MessageType, sendMsgToPlugin, addMessageListener } from '../../messages';
import { generateRandomId } from './utils';

export default {
  getAsync(key: string): Promise<any | undefined> {
    return new Promise(resolve => {
      const _id = generateRandomId();
      sendMsgToPlugin(MessageType.STORAGE, {
        _id,
        key,
        method: 'getAsync',
      });

      const removeListener = addMessageListener(MessageType.STORAGE, data => {
        if (data._id === _id) {
          resolve(data.data);
          removeListener();
        }
      });
    });
  },
  setAsync(key: string, value: any): Promise<void> {
    return new Promise(resolve => {
      sendMsgToPlugin(MessageType.STORAGE, {
        key,
        method: 'setAsync',
        data: value,
      });
      resolve();
    });
  },
  deleteAsync(key: string): Promise<void> {
    return new Promise(resolve => {
      sendMsgToPlugin(MessageType.STORAGE, {
        key,
        method: 'deleteAsync',
      });
      resolve();
    });
  },
  keysAsync(): Promise<string[]> {
    return new Promise(resolve => {
      const _id = generateRandomId();
      sendMsgToPlugin(MessageType.STORAGE, {
        _id,
        method: 'keysAsync',
      });

      const removeListener = addMessageListener(MessageType.STORAGE, data => {
        if (data._id === _id) {
          resolve(data.data);
          removeListener();
        }
      });
    });
  },
};
