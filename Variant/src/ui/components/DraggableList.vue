<template>
  <div :class="$style.container">
    <van-checkbox
      v-if="showSelectAll"
      icon-size="16px"
      style="margin-top: 12px; width: fit-content"
      :modelValue="allChecked"
      shape="square"
      @click="onAllChecked"
    >
      全选
    </van-checkbox>
    
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
              v-model="item.checked"
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
              v-if="showAdd"
              name="add-o"
              title="复制"
              @click="copyItem(index)"
            />
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
import { ref, computed } from 'vue';
import draggable from 'vuedraggable';

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
  'copy-item': [index: number];
  'delete-item': [index: number];
}>();

const items = computed({
  get: () => props.items,
  set: (value) => emit('update:items', value),
});

const allChecked = computed(() => {
  return items.value.every(item => item.checked);
});

const onAllChecked = () => {
  const checked = !allChecked.value;
  items.value.forEach(item => {
    item.checked = checked;
  });
};

const copyItem = (index: number) => {
  emit('copy-item', index);
};

const deleteItem = (index: number) => {
  emit('delete-item', index);
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

  /* 调整“全选”文本颜色为次要文字色（提高优先级避免被默认色覆盖） */
  :global(.van-checkbox__label) {
    color: var(--text-secondary) !important;
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
