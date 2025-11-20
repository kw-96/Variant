<template>
  <div>
    <DraggableList
      :items="config.options"
      :disabled="disabled"
      :showSelectAll="!editMode"
      :showCheckbox="!editMode"
      :showAdd="editMode"
      @update:items="onUpdateItems"
      @copy-item="oncopy"
      @delete-item="onDelete"
      @add-item="addStandard"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import DraggableList from './DraggableList.vue';
import { deepCopy, generateRandomId } from '../utils/common';

const props = defineProps({
  config: {
    type: Object,
    default: () => ({ options: [] }),
  },
  disabled: Boolean,
  editMode: {
    type: Boolean,
    default: false,
  },
});

// 带默认值的可用配置对象（模板中可直接使用 config.options）
const config = computed<any>(() => (props as any).config || { options: [] });

// onAllChecked 函数已由 DraggableList 组件内部处理

function onUpdateItems(newItems: any[]) {
  // 直接更新 props.config.options，确保响应式更新
  if (props.config) {
    props.config.options = newItems;
  }
}

function oncopy(index: number) {
  const option = config.value.options[index];
  config.value.options.splice(index, 0, deepCopy(option));
}

function onDelete(index: number) {
  config.value.options.splice(index, 1);
}

function addStandard() {
  // 添加新项目的逻辑
  const newItem = {
    id: generateRandomId(),
    name: '新项目',
    width: 100,
    height: 100,
    checked: false,
  };
  config.value.options.push(newItem);
}
</script>

<style lang="less" module>
/* 样式由DraggableList组件内部处理 */
</style>
