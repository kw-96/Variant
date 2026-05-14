<template>
  <div :class="$style.container">
    <ToolHome v-if="currentView === 'home'" @tool="handleToolClick" />
    <BatchExtend v-else-if="currentView === 'batch-extend'" @back="handleBack" />
    <BatchButton v-else-if="currentView === 'batch-button'" @back="handleBack" />
    <DataFlow v-else-if="currentView === 'data-flow'" @back="handleBack" />
    <BatchRename v-else-if="currentView === 'batch-rename'" @back="handleBack" />
    <BatchSwitchInstance v-else-if="currentView === 'batch-switch-instance'" @back="handleBack" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import ToolHome from './ToolHome.vue';
import BatchExtend from './batch-extend.vue';
import BatchButton from './batch-button.vue';
import DataFlow from './data-flow.vue';
import BatchRename from './batch-rename.vue';
import BatchSwitchInstance from './batch-switch-instance.vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';

type ViewKey = 'home' | 'batch-extend' | 'batch-button' | 'data-flow' | 'batch-rename' | 'batch-switch-instance';
const currentView = ref<ViewKey>('home');

// 处理返回按钮点击
function handleBack() {
  currentView.value = 'home';
}

/**
 * 统一处理工具点击
 * @param key 工具标识
 */
function handleToolClick(key: string) {
  const quickMap: Partial<Record<string, MessageType>> = {
    'auto-add-component': MessageType.AUTO_ADD_COMPONENT,
    'auto-layout': MessageType.AUTO_LAYOUT,
    'round-to-integer': MessageType.ROUND_TO_INTEGER,
    'simple-constraint': MessageType.SIMPLE_CONSTRAINT,
    'batch-convert-to-component': MessageType.BATCH_CONVERT_TO_COMPONENT,
  };
  if (quickMap[key]) {
    sendMsgToPlugin(quickMap[key]);
    return;
  }
  if (key === 'batch-extend' || key === 'batch-button' || key === 'data-flow' || key === 'batch-rename' || key === 'batch-switch-instance') {
    currentView.value = key;
  }
}
</script>

<style lang="less" module>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
  position: relative;
}
</style>

