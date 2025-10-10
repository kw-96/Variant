import { ref } from 'vue';
import storage from '../storage';

export default function useSetting<T>(storageKey: string, getDefaultSetting) {
  const settingData = ref();

  const saveSettingData = data => {
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
