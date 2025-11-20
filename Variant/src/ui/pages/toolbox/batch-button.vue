<template>
  <div :class="$style.container">
    <!-- 返回按钮 -->
    <button :class="$style.backButton" @click="handleBack" title="返回">
      <van-icon name="arrow-left" :class="$style.backIcon" />
    </button>
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

      <van-field
        v-model="inputValue"
        :class="$style.inputField"
        rows="6"
        type="textarea"
        placeholder="请输入文本内容，使用换行分隔"
        show-word-limit
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
  align-items: center;
  justify-content: center;
  padding: 32px;
  box-sizing: border-box;
  background-color: var(--bg-primary);
  z-index: 10;
}

.backButton {
  position: absolute;
  top: 12px;
  left: 12px;
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
  z-index: 11;
  
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

.content {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  margin-top: 64px;
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
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  margin-top: 8px;
  transition: border-color 0.2s;
  
  &:focus-within {
    border-color: var(--button-primary-bg);
  }
  
  :global(.van-field__body) {
    align-items: flex-start;
    padding: 0;
  }
  
  :global(.van-field__control) {
    width: 100%;
    min-height: 260px;
    padding: 12px;
    text-align: left;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    background: transparent;
  }
  
  :global(textarea) {
    resize: none;
  }
  
  :global(.van-field__control::placeholder) {
    color: var(--text-secondary);
    opacity: 0.5;
  }
  
  :global(.van-field__word-limit) {
    width: 100%;
    text-align: right;
    padding: 0 12px 8px;
    color: var(--text-secondary);
    font-size: 12px;
  }
}

</style>

