import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';
import { isBackgroundInstanceName } from '../../../component-library/instance-role';

interface OptionItem {
  id: string;
  name: string;
}

/**
 * 批量切换实例页的数据读取、切换与删除逻辑
 * 默认使用新版规则；勾选「旧版模式」的行走旧逻辑（原地换引用并保留旧图层名）。
 */
export function useBatchSwitchInstance() {
  const loading = ref(false);
  const switching = ref(false);
  const deletingName = ref('');
  const message = ref('');
  const resultTip = ref('');
  const resultTipType = ref<'success' | 'error' | 'warning'>('success');
  const instances = ref<{ name: string }[]>([]);
  const components = ref<OptionItem[]>([]);
  const selectedMap = reactive<Record<string, string>>({});
  /** 每行「旧版模式」勾选状态：true=旧版逻辑，缺省=新版逻辑；仅本次面板会话有效，不跨文件持久化 */
  const legacyMap = reactive<Record<string, boolean>>({});
  let removeDataListener: (() => void) | null = null;
  let removeResultListener: (() => void) | null = null;

  /** 当前列表是否每一行都已勾选「旧版模式」 */
  const allLegacy = computed(
    () => instances.value.length > 0 && instances.value.every((item) => legacyMap[item.name] === true)
  );

  /** 点击「旧版模式」标题：全部已勾选则全部取消，否则全部勾选 */
  function toggleAllLegacy() {
    const next = !allLegacy.value;
    instances.value.forEach((item) => {
      legacyMap[item.name] = next;
    });
  }

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
      .map(([instanceName, componentId]) => ({
        instanceName,
        componentId,
        backgroundFill: isBackgroundInstanceName(instanceName),
        legacy: legacyMap[instanceName] === true
      }));
    if (pairs.length === 0) return;
    switching.value = true;
    resultTip.value = '';
    sendMsgToPlugin(MessageType.BATCH_SWITCH_INSTANCES_APPLY, { pairs });
  }

  /** 批量删除当前选择范围内同名实例 */
  function handleDelete(instanceName: string) {
    if (switching.value || deletingName.value) return;
    deletingName.value = instanceName;
    resultTip.value = '';
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
    removeResultListener = addMessageListener(MessageType.BATCH_SWITCH_INSTANCES_RESULT, (data: any) => {
      const deletedName = deletingName.value;
      switching.value = false;
      deletingName.value = '';
      const changed = Number(data?.changed) || 0;
      const failures: Array<{ name: string; reason: string }> =
        Array.isArray(data?.failures) ? data.failures : [];

      if (deletedName) {
        // 删除成功：仅本地移除该行，保留其余已选择项；删除失败：提示并刷新列表，避免列表与画布不一致
        if (Number(data?.deleted) > 0) {
          instances.value = instances.value.filter((item) => item.name !== deletedName);
          delete selectedMap[deletedName];
          delete legacyMap[deletedName];
        } else {
          resultTipType.value = 'error';
          resultTip.value = `删除「${deletedName}」失败，列表已刷新`;
          requestData();
        }
        return;
      }

      if (failures.length) {
        resultTipType.value = 'error';
        const detail = failures
          .slice(0, 3)
          .map((f) => `${f.name}（${f.reason}）`)
          .join('；');
        const more = failures.length > 3 ? ` 等 ${failures.length} 项` : '';
        resultTip.value = `${changed} 项已切换，${failures.length} 项失败：${detail}${more}`;
      } else if (changed > 0) {
        resultTipType.value = 'success';
        resultTip.value = `已切换 ${changed} 个实例`;
      } else {
        resultTip.value = '';
      }
      // 切换完成：刷新数据
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
    resultTip,
    resultTipType,
    instances,
    components,
    selectedMap,
    legacyMap,
    allLegacy,
    toggleAllLegacy,
    canSwitch,
    requestData,
    handleSwitch,
    handleDelete
  };
}
