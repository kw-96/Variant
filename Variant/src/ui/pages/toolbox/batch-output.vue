<template>
  <div :class="$style.container">
    <!-- 标题栏 -->
    <div :class="$style.header">
      <button :class="$style.backButton" @click="handleBack" title="返回">
        <van-icon name="arrow-left" :class="$style.backIcon" />
      </button>
      <div :class="$style.title">批量产出</div>
    </div>

    <!-- 模式切换 -->
    <div :class="$style.modeBar">
      <button
        v-for="m in modes"
        :key="m.key"
        :class="[$style.modeItem, { [$style.active]: mode === m.key }]"
        type="button"
        @click="mode = m.key"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- 模式内容（内嵌原组件，KeepAlive 缓存，切模式不丢状态） -->
    <div :class="$style.body">
      <KeepAlive>
        <component :is="currentComponent" embedded />
      </KeepAlive>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import DataFlow from './data-flow.vue';
import BatchButton from './batch-button.vue';
import BatchExtend from './batch-extend.vue';

const emit = defineEmits<{
  back: [];
}>();

type Mode = 'data-flow' | 'batch-button' | 'batch-extend';

const modes: Array<{ key: Mode; label: string }> = [
  { key: 'data-flow', label: '数据流' },
  { key: 'batch-button', label: '批量按钮' },
  { key: 'batch-extend', label: '批量延展' },
];

const mode = ref<Mode>('data-flow');

const componentMap: Record<Mode, any> = {
  'data-flow': DataFlow,
  'batch-button': BatchButton,
  'batch-extend': BatchExtend,
};
/** 当前模式对应的页面组件（KeepAlive 缓存，切模式不丢上传/预览状态） */
const currentComponent = computed(() => componentMap[mode.value]);

function handleBack() {
  emit('back');
}
</script>

<style lang="less" module>
.container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  z-index: 10;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  flex-shrink: 0;
  z-index: 11;
}

.backButton {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--input-bg);
    border-color: var(--button-primary-bg);
  }

  &:active {
    background-color: var(--bg-primary);
  }
}

.backIcon {
  font-size: 16px;
}

.title {
  flex: 1;
  text-align: right;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.modeBar {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
  flex-shrink: 0;
}

.modeItem {
  flex: 1;
  width: auto !important;
  padding: 8px 4px !important;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border-color) !important;
  border-radius: 6px;
  background-color: var(--bg-secondary) !important;
  color: var(--text-secondary) !important;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: var(--text-primary) !important;
    background-color: var(--input-bg) !important;
  }

  &.active {
    background-color: var(--button-primary-bg) !important;
    border-color: var(--button-primary-bg) !important;
    color: #fff !important;
  }
}

.body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
