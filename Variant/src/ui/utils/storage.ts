import { generateRandomId } from './common';

// 存储模块 - 使用插件存储系统（与重构前保持一致）
const storage = {
  getAsync(key: string): Promise<any | undefined> {
    return new Promise(resolve => {
      const _id = generateRandomId();
      
      // 发送消息到插件主线程（使用重构前的消息格式）
      if (typeof parent !== 'undefined' && parent.postMessage) {
        parent.postMessage({
          type: 'storage', // 使用小写的 'storage' 匹配 MessageType.STORAGE
          data: {
            _id,
            key,
            method: 'getAsync',
          },
        }, '*');
      }

      // 监听来自插件主线程的响应（使用重构前的监听机制）
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'storage' && 
            event.data.data._id === _id) {
          resolve(event.data.data.data);
          window.removeEventListener('message', messageHandler);
        }
      };
      
      window.addEventListener('message', messageHandler);
    });
  },
  
  setAsync(key: string, value: any): Promise<void> {
    return new Promise(resolve => {
      // 发送消息到插件主线程（使用重构前的消息格式）
      if (typeof parent !== 'undefined' && parent.postMessage) {
        parent.postMessage({
          type: 'storage', // 使用小写的 'storage' 匹配 MessageType.STORAGE
          data: {
            key,
            method: 'setAsync',
            data: JSON.parse(JSON.stringify(value)), // 使用 JSON 序列化避免克隆错误
          },
        }, '*');
      }
      resolve();
    });
  },
  
  deleteAsync(key: string): Promise<void> {
    return new Promise(resolve => {
      // 发送消息到插件主线程
      if (typeof parent !== 'undefined' && parent.postMessage) {
        parent.postMessage({
          type: 'storage', // 使用小写的 'storage' 匹配 MessageType.STORAGE
          data: {
            key,
            method: 'deleteAsync',
          },
        }, '*');
      }
      resolve();
    });
  },
  
  keysAsync(): Promise<string[]> {
    return new Promise(resolve => {
      const _id = generateRandomId();
      
      // 发送消息到插件主线程
      if (typeof parent !== 'undefined' && parent.postMessage) {
        parent.postMessage({
          type: 'storage', // 使用小写的 'storage' 匹配 MessageType.STORAGE
          data: {
            _id,
            method: 'keysAsync',
          },
        }, '*');
      }

      // 监听来自插件主线程的响应
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'storage' && 
            event.data.data._id === _id) {
          resolve(event.data.data.data);
          window.removeEventListener('message', messageHandler);
        }
      };
      
      window.addEventListener('message', messageHandler);
    });
  },
};

export default storage;