<template>
  <div :class="$style.container">
    <div v-if="showSelectAll" :class="$style.headerRow">
      <div 
        :class="$style.selectAll"
        @click="onAllChecked"
      >
        全选
      </div>
      <div 
        :class="$style.copyButton"
        @click="onCopy"
      >
        复制
      </div>
      <div 
        :class="$style.addButton"
        @click="onAdd"
      >
        添加
      </div>
    </div>
    
    <draggable
      :class="$style.list"
      v-model="items"
      item-key="id"
      handle=".drag-handle"
      :disabled="!draggable"
    >
      <template #item="{ element: item, index }">
        <div :class="$style['van-row']">
          <div v-if="showCheckbox" :class="$style['checkbox-col']">
            <van-checkbox
              icon-size="16px"
              :model-value="item.checked"
              @update:model-value="(val) => updateItemChecked(index, val)"
              shape="square"
            />
          </div>
          <div :class="$style['index-col']">{{ index + 1 }}</div>

          <div :class="[$style['name'], $style.col]">
            <van-field
              :class="$style['van-field']"
              v-model="item.name"
              v-input-dblclick-select
              :disabled="disabled"
            />
          </div>
          
          <div :class="[$style['size-col'], $style.col]">
            <van-field
              :class="$style['van-field']"
              v-model="item.width"
              type="digit"
              :disabled="disabled"
            />
            x
            <van-field
              :class="$style['van-field']"
              v-model="item.height"
              type="digit"
              :disabled="disabled"
            />
          </div>

          <div :class="[$style['action-col'], $style.col]">
            <van-icon
              v-if="showDelete"
              name="close"
              title="删除"
              @click="deleteItem(index)"
            />
            <van-icon 
              v-if="draggable"
              name="wap-nav" 
              title="拖动" 
              class="drag-handle" 
            />
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';
import { MessageType, sendMsgToPlugin } from '../../messages';

interface ListItem {
  id: string;
  name: string;
  width: number;
  height: number;
  checked?: boolean;
}

interface Props {
  items: ListItem[];
  disabled?: boolean;
  showSelectAll?: boolean;
  showCheckbox?: boolean;
  showAdd?: boolean;
  showDelete?: boolean;
  draggable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showSelectAll: true,
  showCheckbox: true,
  showAdd: true,
  showDelete: true,
  draggable: true,
});

const emit = defineEmits<{
  'update:items': [items: ListItem[]];
  'delete-item': [index: number];
}>();

const items = computed({
  get: () => props.items,
  set: (value) => emit('update:items', value),
});

const allChecked = computed(() => {
  return items.value.length > 0 && items.value.every(item => item.checked === true);
});

const onAllChecked = () => {
  const checked = !allChecked.value;
  const newItems = items.value.map(item => ({
    ...item,
    checked: checked
  }));
  emit('update:items', newItems);
};

const deleteItem = (index: number) => {
  emit('delete-item', index);
};

/**
 * 更新项目的选中状态
 */
const updateItemChecked = (index: number, checked: boolean) => {
  const newItems = [...items.value];
  newItems[index] = { ...newItems[index], checked };
  emit('update:items', newItems);
};

/**
 * 复制选中的数据
 * 只允许复制一条数据，复制后插入到被复制数据的下一行
 */
const onCopy = () => {
  const checkedItems = items.value.filter(item => item.checked);
  
  if (checkedItems.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, { message: '请先选择要复制的数据', timeout: 2000 });
    return;
  }
  
  if (checkedItems.length > 1) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, { message: '只能复制一条数据', timeout: 2000 });
    return;
  }
  
  // 找到被复制的数据在原数组中的索引
  const sourceItem = checkedItems[0];
  const sourceIndex = items.value.findIndex(item => item.id === sourceItem.id);
  
  if (sourceIndex === -1) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, { message: '未找到要复制的数据', timeout: 2000 });
    return;
  }
  
  // 创建新数据（深拷贝）
  const newItem: ListItem = {
    id: `${Date.now()}-${Math.random()}`,
    name: sourceItem.name,
    width: sourceItem.width,
    height: sourceItem.height,
    checked: false,
  };
  
  // 插入到被复制数据的下一行
  const newItems = [...items.value];
  newItems.splice(sourceIndex + 1, 0, newItem);
  
  // 更新数据
  items.value = newItems;
};

/**
 * 添加空数据
 * 在数据最后添加一条空数据
 */
const onAdd = () => {
  const newItem: ListItem = {
    id: `${Date.now()}-${Math.random()}`,
    name: '',
    width: 0,
    height: 0,
    checked: false,
  };
  
  const newItems = [...items.value, newItem];
  emit('update:items', newItems);
};
</script>

<style lang="less" module>
.container {
  padding: 2px 2px 2px 4px;
  margin: 12px;
  // border: 2px solid var(--bg-secondary);
  border-radius: 12px;
  overflow: visible;

  .list {
    padding-right: 6px;
  }

}

.headerRow {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.selectAll {
  width: fit-content;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  
  &:hover {
    color: var(--text-primary);
  }
}

.copyButton {
  width: fit-content;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  margin-left: auto;
  
  &:hover {
    color: var(--text-primary);
  }
}

.addButton {
  width: fit-content;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  margin-left: 12px;
  
  &:hover {
    color: var(--text-primary);
  }
}

.van-row {
  display: flex;
  align-items: center;
  line-height: 1;
  padding: 6px 0;
  white-space: nowrap;
  border-bottom: 0.5px solid var(--divider-color);
  overflow: visible;
  &:last-child {
    border-bottom: none;
  }
  
  :global(.van-checkbox) {
    overflow: visible !important;
  }
}

.checkbox-col {
  flex-shrink: 0;
  margin-right: 6px;
}

.index-col {
  flex-shrink: 0;
  width: 20px;
  margin-right: 2px;
}

.col {
  display: flex;
  align-items: center;
}

.name {
  flex: 1;
  min-width: 60px;
  
  .van-field {
    width: 100%;
  }
}

.size-col {
  flex: 0 0 110px;
  justify-content: center;
  
  .van-field {
    width: 48px;
    min-width: 48px;
  }
}

.action-col {
  flex-shrink: 0;
  flex-basis: 50px;
  justify-content: flex-end;
  gap: 6px;
  margin-left: -10px;
}

.van-field {
  background: var(--input-bg);
  margin: 0 4px;
  padding: 6px 2px;
  border-radius: 4px;
  line-height: 1;

  :global(input) {
    padding: 0 6px;
    border: none;
    background: transparent;
    font-size: 12px;
    text-align: center;
  }
}
</style>
