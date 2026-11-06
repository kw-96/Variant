<template>
  <div :class="$style.container">
    <ToolHome v-if="currentView === 'home'" @tool="handleToolClick" />
    <BatchOutput v-else-if="currentView === 'batch-output'" @back="handleBack" />
    <BatchRename v-else-if="currentView === 'batch-rename'" @back="handleBack" />
    <BatchSwitchInstance v-else-if="currentView === 'batch-switch-instance'" @back="handleBack" />
    <BatchWatermark v-else-if="currentView === 'batch-watermark'" @back="handleBack" />
    <InstanceFit v-else-if="currentView === 'instance-fit'" @back="handleBack" />

    <div
      v-else-if="currentView === 'common-replace'"
      :class="$style.wrapView"
    >
      <div :class="$style.wrapHeader">
        <button :class="$style.backButton" @click="handleBack" title="返回">
          <van-icon name="arrow-left" :class="$style.backIcon" />
        </button>
        <div :class="$style.wrapTitle">通用替换</div>
      </div>
      <div :class="[$style.wrapBody, 'tb-fill']">
        <CommonReplace />
      </div>
    </div>

    <div
      v-else-if="currentView === 'cutout'"
      :class="$style.wrapView"
    >
      <div :class="$style.wrapHeader">
        <button :class="$style.backButton" @click="handleBack" title="返回">
          <van-icon name="arrow-left" :class="$style.backIcon" />
        </button>
        <div :class="$style.wrapTitle">一键抠图</div>
      </div>
      <div :class="[$style.wrapBody, 'tb-fill']">
        <Cutout />
      </div>
    </div>

    <!-- PSD 转换：首次进入后保活，切到其它工具再回来不丢导入/导出状态 -->
    <div
      v-if="psdMounted"
      v-show="currentView === 'psd'"
      :class="$style.wrapView"
    >
      <div :class="$style.wrapHeader">
        <button :class="$style.backButton" @click="handleBack" title="返回">
          <van-icon name="arrow-left" :class="$style.backIcon" />
        </button>
        <div :class="$style.wrapTitle">PSD转换</div>
      </div>
      <div :class="[$style.wrapBody, 'tb-fill']">
        <PsdConvert />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import ToolHome from './ToolHome.vue';
import BatchOutput from './batch-output.vue';
import BatchRename from './batch-rename.vue';
import BatchSwitchInstance from './batch-switch-instance.vue';
import BatchWatermark from './batch-watermark.vue';
import InstanceFit from './instance-fit.vue';
import CommonReplace from '../art/common-replace.vue';
import Cutout from '../cut/cutout.vue';
import PsdConvert from '../psd/index.vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';

type ViewKey =
  | 'home'
  | 'batch-output'
  | 'batch-rename'
  | 'batch-switch-instance'
  | 'batch-watermark'
  | 'instance-fit'
  | 'common-replace'
  | 'cutout'
  | 'psd';
const currentView = ref<ViewKey>('home');
/** PSD 转换首次进入后保活，避免重复加载 745KB 的 iframe 页面 */
const psdMounted = ref(false);

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
  if (
    key === 'batch-output' ||
    key === 'batch-rename' ||
    key === 'batch-switch-instance' ||
    key === 'batch-watermark' ||
    key === 'instance-fit' ||
    key === 'common-replace' ||
    key === 'cutout' ||
    key === 'psd'
  ) {
    if (key === 'psd') psdMounted.value = true;
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

.wrapView {
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

.wrapHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  flex-shrink: 0;
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
}

.backIcon {
  font-size: 16px;
}

.wrapTitle {
  flex: 1;
  text-align: right;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.wrapBody {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 作为内嵌页面（PSD / 一键抠图）绝对定位的包含块 */
  position: relative;
}
</style>
