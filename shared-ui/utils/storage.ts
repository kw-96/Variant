import { generateRandomId } from './common';

// 存储接口定义
interface StorageAdapter {
  getAsync(key: string): Promise<any | undefined>;
  setAsync(key: string, value: any): Promise<void>;
  deleteAsync(key: string): Promise<void>;
  keysAsync(): Promise<string[]>;
}

// 默认的localStorage适配器
const localStorageAdapter: StorageAdapter = {
  getAsync(key: string): Promise<any | undefined> {
    return new Promise(resolve => {
      try {
        const data = localStorage.getItem(key);
        resolve(data ? JSON.parse(data) : undefined);
      } catch (error) {
        console.error('Failed to get storage data:', error);
        resolve(undefined);
      }
    });
  },
  
  setAsync(key: string, value: any): Promise<void> {
    return new Promise(resolve => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      } catch (error) {
        console.error('Failed to set storage data:', error);
        resolve();
      }
    });
  },
  
  deleteAsync(key: string): Promise<void> {
    return new Promise(resolve => {
      try {
        localStorage.removeItem(key);
        resolve();
      } catch (error) {
        console.error('Failed to delete storage data:', error);
        resolve();
      }
    });
  },
  
  keysAsync(): Promise<string[]> {
    return new Promise(resolve => {
      try {
        const keys = Object.keys(localStorage);
        resolve(keys);
      } catch (error) {
        console.error('Failed to get storage keys:', error);
        resolve([]);
      }
    });
  },
};

// 插件存储适配器（用于Figma/MasterGo插件）
const pluginStorageAdapter: StorageAdapter = {
  getAsync(key: string): Promise<any | undefined> {
    return new Promise(resolve => {
      const _id = generateRandomId();
      // 这里需要根据实际的插件环境来实现
      // 暂时使用localStorage作为fallback
      localStorageAdapter.getAsync(key).then(resolve);
    });
  },
  
  setAsync(key: string, value: any): Promise<void> {
    return new Promise(resolve => {
      // 这里需要根据实际的插件环境来实现
      // 暂时使用localStorage作为fallback
      localStorageAdapter.setAsync(key, value).then(() => resolve());
    });
  },
  
  deleteAsync(key: string): Promise<void> {
    return new Promise(resolve => {
      // 这里需要根据实际的插件环境来实现
      // 暂时使用localStorage作为fallback
      localStorageAdapter.deleteAsync(key).then(() => resolve());
    });
  },
  
  keysAsync(): Promise<string[]> {
    return new Promise(resolve => {
      // 这里需要根据实际的插件环境来实现
      // 暂时使用localStorage作为fallback
      localStorageAdapter.keysAsync().then(resolve);
    });
  },
};

// 当前使用的存储适配器
let currentAdapter: StorageAdapter = localStorageAdapter;

// 设置存储适配器
export const setStorageAdapter = (adapter: StorageAdapter) => {
  currentAdapter = adapter;
};

// 存储模块
const storage = {
  getAsync(key: string): Promise<any | undefined> {
    return currentAdapter.getAsync(key);
  },
  
  setAsync(key: string, value: any): Promise<void> {
    return currentAdapter.setAsync(key, value);
  },
  
  deleteAsync(key: string): Promise<void> {
    return currentAdapter.deleteAsync(key);
  },
  
  keysAsync(): Promise<string[]> {
    return currentAdapter.keysAsync();
  },
};

export default storage;
export { localStorageAdapter, pluginStorageAdapter };
