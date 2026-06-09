import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';

interface OptionItem {
  id: string;
  name: string;
}

/**
 * 批量切换实例页的数据读取、切换与删除逻辑
 */
export function useBatchSwitchInstance() {
  const loading = ref(false);
  const switching = ref(false);
  const deletingName = ref('');
  const message = ref('');
  const instances = ref<{ name: string }[]>([]);
  const components = ref<OptionItem[]>([]);
  const selectedMap = reactive<Record<string, string>>({});
  let removeDataListener: (() => void) | null = null;
  let removeResultListener: (() => void) | null = null;

  const canSwitch = computed(
    () => !loading.value && !switching.value && !deletingName.value && Object.values(selectedMap).some(Boolean)
  );

  function resetSelectedMap() {
    Object.keys(selectedMap).forEach((key) => delete selectedMap[key]);
    instances.value.forEach((item) => {
      selectedMap[item.name] = '';
    });
  }

  function requestData() {
    loading.value = true;
    sendMsgToPlugin(MessageType.BATCH_SWITCH_INSTANCES_GET);
  }

  function handleSwitch() {
    const pairs = Object.entries(selectedMap)
      .filter(([, componentId]) => !!componentId)
      .map(([instanceName, componentId]) => ({ instanceName, componentId }));
    if (pairs.length === 0) return;
    switching.value = true;
    sendMsgToPlugin(MessageType.BATCH_SWITCH_INSTANCES_APPLY, { pairs });
  }

  /** 批量删除当前选择范围内同名实例 */
  function handleDelete(instanceName: string) {
    if (switching.value || deletingName.value) return;
    deletingName.value = instanceName;
    sendMsgToPlugin(MessageType.BATCH_SWITCH_INSTANCES_DELETE, { instanceName });
  }

  onMounted(() => {
    removeDataListener = addMessageListener(MessageType.BATCH_SWITCH_INSTANCES_DATA, (data: any) => {
      loading.value = false;
      message.value = data?.message || '';
      instances.value = Array.isArray(data?.instances) ? data.instances : [];
      components.value = Array.isArray(data?.components) ? data.components : [];
      resetSelectedMap();
    });
    removeResultListener = addMessageListener(MessageType.BATCH_SWITCH_INSTANCES_RESULT, () => {
      switching.value = false;
      deletingName.value = '';
      requestData();
    });
    requestData();
  });

  onUnmounted(() => {
    removeDataListener?.();
    removeResultListener?.();
  });

  return {
    loading,
    switching,
    deletingName,
    message,
    instances,
    components,
    selectedMap,
    canSwitch,
    requestData,
    handleSwitch,
    handleDelete
  };
}
