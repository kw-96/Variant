<template>
  <div :class="$style.container">
    <!-- 标题栏 -->
    <div :class="$style.header">
    <button :class="$style.backButton" @click="handleBack" title="返回">
      <van-icon name="arrow-left" :class="$style.backIcon" />
    </button>
      <div :class="$style.title">批量按钮</div>
    </div>
    <!-- 页面内容 -->
    <div :class="$style.content">
      <div :class="$style.tip">
        请先将按钮转为组件（快捷键：Ctrl+Alt+K）
      </div>

      <van-button
        type="primary"
        :class="$style.actionButton"
        @click="handleConvert"
      >
        转为数据流
      </van-button>

      <div :class="$style.arrow">
        <van-icon name="arrow-down" />
      </div>

      <TabTextarea
        v-model="inputValue"
        type="vant"
        :class="$style.inputField"
        :rows="6"
        placeholder="请输入文本内容，使用[回车]换行分隔"
        :show-word-limit="true"
      />

      <van-button
        block
        type="primary"
        :class="$style.generateButton"
        @click="handleGenerate"
      >
        开始生成
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import TabTextarea from '../../components/TabTextarea.vue';

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

const inputValue = ref('');

// 处理返回按钮点击
function handleBack() {
  emit('back');
}

function handleConvert() {
  sendMsgToPlugin(MessageType.BATCH_BUTTON_CONVERT);
}

function handleGenerate() {
  const lines = inputValue.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请输入至少一行文本',
      timeout: 2000,
    });
    return;
  }

  sendMsgToPlugin(MessageType.BATCH_BUTTON_GENERATE, { lines });
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

.content {
  flex: 1;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  overflow-y: auto;
  box-sizing: border-box;
}

.actionButton {
  align-self: center;
  width: 160px;
  margin-bottom: 8px;
  border-radius: 6px;
  height: 40px;
  font-size: 14px;
  line-height: 38px;
}

.tip {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  margin-top: 24px;
}

.arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-secondary);
  font-size: 20px;
}

.generateButton {
  margin-top: 14px;
  margin-bottom: 32px;
  border-radius: 6px;
  height: 44px;
  font-size: 15px;
  line-height: 42px;
}

.inputField {
  margin-top: 8px;
}

</style>

