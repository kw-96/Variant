import { ref, watch, onMounted } from 'vue';
import { watchDebounced } from '@vueuse/core';
import { showConfirmDialog } from 'vant';
import storage from '../utils/storage';

const updateFlag = ref(false);

export function useStandardConfigs(
  storageKey: string,
  initConfigs: any[] = [],
  editMode: Boolean
) {
  const configs = ref([...initConfigs]); // 初始化为传入的初始值
  const activeConfig = ref(configs.value[0] || null);
  const isExternalConfig = ref(initConfigs.length > 0); // 是否存在外部传入配置

  // 保存数据到插件
  const saveData = (data: any) => {
    storage.setAsync(storageKey, data);
  };

  watch(
    () => updateFlag.value,
    flag => {
      if (flag) {
        initData();
      }
    }
  );

  const setUpdate = () => {
    updateFlag.value = true;
    setTimeout(() => {
      updateFlag.value = false;
    }, 0);
  };

  // 初始化数据
  const initData = () => {
    if (isExternalConfig.value) return; // 外部配置不从 storage 读取
    storage.getAsync(storageKey).then(data => {
      if (data && !isExternalConfig.value) {
        configs.value = [...data];
        activeConfig.value = configs.value[0];
      }
    });
  };

  // 监听外部动态传入的 initConfigs
  watch(
    () => initConfigs,
    newConfigs => {
      if (newConfigs && newConfigs.length > 0) {
        configs.value = [...newConfigs]; // 更新 configs

        activeConfig.value = configs.value[0]; // 设置 activeConfig
        isExternalConfig.value = true; // 标记为外部配置
      }
    },
    { deep: true, immediate: true }
  );

  // 切换规范
  const switchPlatform = (config: any) => {
    activeConfig.value = config;
  };

  // 添加规范
  const addStandard = (newConfig: any) => {
    configs.value.push(...newConfig);
    activeConfig.value = newConfig[0];
    saveData(configs.value);
    setUpdate();
  };

  // 删除规范
  const removeStandard = async (item: any) => {
    const confirmed = await showConfirmDialog({
      title: '提示',
      message: '确认要删除当前选中的规范吗？',
    });

    if (confirmed) {
      const index = configs.value.findIndex(config => config.id === item.id);
      configs.value.splice(index, 1);
      activeConfig.value = configs.value[0] || null;
      saveData(configs.value);
      setUpdate();
    }
  };

  // 自动保存
  watchDebounced(
    () => activeConfig.value,
    newValue => {
      if (isExternalConfig.value) {
        return;
      }
      if (newValue && configs.value.length > 0) {
        const index = configs.value.findIndex(
          config => config.id === newValue.id
        );
        if (index !== -1) {
          configs.value[index] = { ...newValue };
          saveData(configs.value);
        }
      }
    },
    {
      deep: true,
      debounce: 1000,
      maxWait: 1000,
    }
  );

  onMounted(() => {
    initData();
  });

  return {
    configs,
    isExternalConfig,
    activeConfig,
    switchPlatform,
    addStandard,
    removeStandard,
  };
}
