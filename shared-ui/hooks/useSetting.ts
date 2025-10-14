import { ref } from 'vue';
import storage from '../utils/storage';

/**
 * 设置管理Hook - 从H5tools提取
 * @param storageKey 存储键名
 * @param getDefaultSetting 获取默认设置的函数
 * @returns 设置数据和保存函数
 */
export default function useSetting<T>(storageKey: string, getDefaultSetting: () => T) {
  const settingData = ref<T>();

  const saveSettingData = (data: T) => {
    return storage.setAsync(storageKey, data);
  };

  storage.getAsync(storageKey).then(data => {
    if (data) {
      settingData.value = data;
    } else {
      settingData.value = getDefaultSetting();
    }
  });

  return {
    settingData,
    saveSettingData,
  };
}
