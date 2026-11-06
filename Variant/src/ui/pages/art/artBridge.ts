import { ref, onMounted, onUnmounted } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';

/** 监听主线程 PLUGIN_RESULT，按 target 过滤，返回提示文本与级别。 */
export function useResult(target: string | string[]) {
  const tipText = ref('');
  const tipType = ref<'success' | 'error' | 'warning'>('success');
  const targets = Array.isArray(target) ? target : [target];
  let off: (() => void) | null = null;
  function onResult(d: any) {
    if (!d || targets.indexOf(d.target) === -1) return;
    tipType.value = d.level || 'success';
    tipText.value = d.text || '';
  }
  onMounted(() => {
    off = addMessageListener(MessageType.PLUGIN_RESULT, onResult);
  });
  onUnmounted(() => {
    off && off();
  });
  return { tipText, tipType };
}

/** 监听选区信息（组件实例数 / 名称 / 全部图层）。挂载时主动请求一次。 */
export function useSelectionInfo() {
  const count = ref(0);
  const names = ref<string[]>([]);
  const layers = ref<Array<{ name: string; type: string }>>([]);
  let off: (() => void) | null = null;
  function onInfo(d: any) {
    if (!d) return;
    count.value = d.count || 0;
    names.value = d.names || [];
    layers.value = d.layers || [];
  }
  onMounted(() => {
    off = addMessageListener(MessageType.SELECTION_INFO, onInfo);
    sendMsgToPlugin(MessageType.SELECTION_INFO_REQ, {});
  });
  onUnmounted(() => {
    off && off();
  });
  return { count, names, layers };
}
