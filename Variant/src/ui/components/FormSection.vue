<template>
  <div :class="$style.formSection">
    <!-- 可选的标题栏 -->
    <div v-if="title || $slots.header" :class="$style.sectionHeader">
      <slot name="header">
        <span v-if="title" :class="$style.sectionTitle">{{ title }}</span>
      </slot>
      <button 
        v-if="collapsible"
        :class="$style.controlBtn" 
        @click="toggleCollapse"
        :title="collapsed ? '展开' : '折叠'"
      >
        <van-icon 
          :name="collapsed ? 'arrow-down' : 'arrow-up'" 
          :class="$style.chevronIcon"
        />
      </button>
    </div>
    
    <!-- 内容区域 -->
    <div 
      v-show="!collapsed"
      :class="$style.content"
    >
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';

interface Props {
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  modelValue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: false,
  defaultCollapsed: false,
  modelValue: undefined,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const internalCollapsed = ref(props.defaultCollapsed);

const collapsed = props.modelValue !== undefined 
  ? computed({
      get: () => props.modelValue ?? false,
      set: (value) => emit('update:modelValue', value),
    })
  : internalCollapsed;

function toggleCollapse() {
  if (props.modelValue !== undefined) {
    emit('update:modelValue', !props.modelValue);
  } else {
    internalCollapsed.value = !internalCollapsed.value;
  }
}
</script>

<style lang="less" module>
.formSection {
  background-color: var(--bg-primary);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.controlBtn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--input-bg);
    color: var(--text-primary);
  }
}

.chevronIcon {
  font-size: 12px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

