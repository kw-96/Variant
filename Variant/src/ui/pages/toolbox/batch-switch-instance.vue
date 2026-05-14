<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <button :class="$style.backButton" @click="emit('back')" title="返回">
        <van-icon name="arrow-left" />
      </button>
      <div :class="$style.title">批量切换实例</div>
      <button :class="$style.refreshButton" @click="requestData">刷新</button>
    </div>

    <div :class="$style.content">
      <van-loading v-if="loading" type="spinner" vertical>读取中...</van-loading>
      <div v-else-if="message" :class="$style.empty">{{ message }}</div>
      <div v-else-if="instances.length === 0" :class="$style.empty">
        当前选择内没有可切换的直接子实例
      </div>
      <div v-else :class="$style.list">
        <div v-for="item in instances" :key="item.name" :class="$style.row">
          <div :class="$style.instanceName" :title="item.name">{{ item.name }}</div>
          <select v-model="selectedMap[item.name]" :class="$style.select">
            <option value="">不切换</option>
            <option v-for="comp in components" :key="comp.id" :value="comp.id">
              {{ comp.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div :class="$style.footer">
      <van-button
        type="primary"
        block
        :loading="switching"
        :disabled="!canSwitch"
        @click="handleSwitch"
      >
        立即切换
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';

interface OptionItem {
  id: string;
  name: string;
}

const emit = defineEmits<{ (e: 'back'): void }>();

const loading = ref(false);
const switching = ref(false);
const message = ref('');
const instances = ref<{ name: string }[]>([]);
const components = ref<OptionItem[]>([]);
const selectedMap = reactive<Record<string, string>>({});
let removeDataListener: (() => void) | null = null;
let removeResultListener: (() => void) | null = null;

const canSwitch = computed(() => {
  return !loading.value && !switching.value && Object.values(selectedMap).some(Boolean);
});

onMounted(() => {
  removeDataListener = addMessageListener(MessageType.BATCH_SWITCH_INSTANCES_DATA, (data: any) => {
    loading.value = false;
    message.value = data?.message || '';
    instances.value = Array.isArray(data?.instances) ? data.instances : [];
    components.value = Array.isArray(data?.components) ? data.components : [];
    Object.keys(selectedMap).forEach((key) => delete selectedMap[key]);
    instances.value.forEach((item) => { selectedMap[item.name] = ''; });
  });
  removeResultListener = addMessageListener(MessageType.BATCH_SWITCH_INSTANCES_RESULT, () => {
    switching.value = false;
    requestData();
  });
  requestData();
});

onUnmounted(() => {
  removeDataListener?.();
  removeResultListener?.();
});

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
</script>

<style lang="less" module>
.page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  z-index: 10;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--divider-color);
}

.backButton,
.refreshButton {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--theme-color);
  padding: 4px 8px;
}

.title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.instanceName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.select {
  width: 48%;
  height: 32px;
}

.empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-secondary);
}

.footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--divider-color);
  background: var(--bg-primary);
}
</style>
