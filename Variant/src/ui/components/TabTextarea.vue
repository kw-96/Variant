<template>
  <!-- 原生 textarea -->
  <textarea
    v-if="type === 'native'"
    :value="modelValue"
    :class="[$style.textarea, $style[`textarea-${size}`]]"
    :style="{ minHeight }"
    :placeholder="placeholder"
    @input="handleInput"
    @dblclick="handleDblclick"
    @keydown="handleKeydown"
  />

  <!-- Vant field textarea -->
  <van-field
    v-else
    :model-value="modelValue"
    :class="[$style.inputField, $style[`inputField-${size}`]]"
    :rows="rows"
    type="textarea"
    :placeholder="placeholder"
    :show-word-limit="showWordLimit"
    @update:model-value="handleUpdate"
    @keydown="handleKeydown"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useTabKeyHandler } from '../hooks/useTabKeyHandler';

interface Props {
  modelValue: string;
  type?: 'native' | 'vant';
  placeholder?: string;
  rows?: number;
  showWordLimit?: boolean;
  minHeight?: string;
  size?: 'default' | 'small' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  type: 'native',
  placeholder: '',
  rows: 6,
  showWordLimit: false,
  minHeight: undefined,
  size: 'default',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  dblclick: [];
}>();

// 使用 Tab 键处理 composable
const textValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});

const { handleKeydown: tabKeyHandler } = useTabKeyHandler(textValue);

// 处理原生 textarea 的 input 事件
function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}

// 处理 Vant field 的 update:model-value 事件
function handleUpdate(value: string) {
  emit('update:modelValue', value);
}

// 处理双击事件
function handleDblclick() {
  emit('dblclick');
}

// 处理键盘事件（Tab 键）
function handleKeydown(event: KeyboardEvent) {
  tabKeyHandler(event);
}
</script>

<style lang="less" module>
/* 原生 textarea 样式 */
.textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: var(--button-primary-bg);
  }
  
  &::placeholder {
    color: var(--text-secondary);
    opacity: 0.5;
  }
}

.textarea-default {
  // 默认样式已在 .textarea 中定义
}

.textarea-small {
  padding: 6px;
  font-size: 11px;
}

.textarea-large {
  padding: 12px;
  font-size: 13px;
}

/* Vant field textarea 样式 */
.inputField {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
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

.inputField-default {
  :global(.van-field__control) {
    min-height: 260px;
  }
}

.inputField-small {
  :global(.van-field__control) {
    min-height: 180px;
    padding: 8px;
    font-size: 11px;
  }
  
  :global(.van-field__word-limit) {
    padding: 0 8px 6px;
    font-size: 11px;
  }
}

.inputField-large {
  :global(.van-field__control) {
    min-height: 320px;
    padding: 16px;
    font-size: 13px;
  }
  
  :global(.van-field__word-limit) {
    padding: 0 16px 10px;
    font-size: 13px;
  }
}
</style>

