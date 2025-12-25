<template>
  <van-field
    :model-value="modelValue"
    :class="[$style.inputField, $style[`inputField-${size}`]]"
    :placeholder="placeholder"
    @update:model-value="handleUpdate"
    @blur="handleBlur"
  />
</template>

<script lang="ts" setup>
interface Props {
  modelValue: string;
  placeholder?: string;
  size?: 'default' | 'small' | 'large';
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  size: 'default',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  input: [value: string];
  blur: [];
}>();

// 处理 Vant field 的 update:model-value 事件
function handleUpdate(value: string) {
  emit('update:modelValue', value);
  // 同时触发 input 事件以保持兼容性
  emit('input', value);
}

// 处理 blur 事件
function handleBlur() {
  emit('blur');
}
</script>

<style lang="less" module>
/* 基础样式 */
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
    padding: 0;
    display: flex;
    align-items: center;
  }
  
  :global(.van-field__control) {
    color: var(--text-primary);
    background: transparent;
    
    &::placeholder {
      color: var(--text-secondary);
      opacity: 0.5;
    }
  }
}

/* 默认尺寸 */
.inputField-default {
  height: 36px;
  
  :global(.van-field__control) {
    font-size: 14px;
    height: auto;
    line-height: 1.2;
    padding: 0 12px;
  }
}

/* 小尺寸（用于 export-channel 的批量命名） */
.inputField-small {
  height: 36px;
  
  :global(.van-field__body) {
    align-items: center;
  }
  
  :global(.van-field__control) {
    font-size: 16px;
    height: auto;
    line-height: 1.2;
    padding: 0 8px;
    color: var(--text-secondary);
    
    &::placeholder {
      font-size: 10px;
      color: var(--input-placeholder);
    }
  }
}

/* 大尺寸 */
.inputField-large {
  height: 44px;
  
  :global(.van-field__control) {
    font-size: 16px;
    height: auto;
    line-height: 1.2;
    padding: 0 16px;
  }
}
</style>

