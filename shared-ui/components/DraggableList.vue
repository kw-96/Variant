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
        <van-row :class="$style['van-row']">
          <van-col v-if="showCheckbox" span="1">
            <van-checkbox
              icon-size="16px"
              v-model="item.checked"
              shape="square"
            />
          </van-col>
          <van-col span="2">{{ index + 1 }}</van-col>

          <van-col span="6" :class="$style['name']">
            <van-field
              :class="$style['van-field']"
              v-model="item.name"
              v-input-dblclick-select
              :disabled="disabled"
            />
          </van-col>
          
          <van-col span="9" :class="$style['size-col']">
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
          </van-col>

          <van-col span="6" :class="$style['action-col']">
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
          </van-col>
        </van-row>
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
  padding: 2px 2px 2px 12px;
  margin: 12px;
  border: 2px solid var(--bg-secondary);
  border-radius: 12px;

  .list {
    padding-right: 6px;
  }
}

.van-row {
  display: flex;
  align-content: center;
  align-items: center;
  line-height: 1;
  padding: 6px 0;
  white-space: nowrap;
  border-bottom: 0.5px solid var(--divider-color);
  &:last-child {
    border-bottom: none;
  }
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

.name {
  .van-field {
    width: 100%;
  }
}

.size-col {
  display: flex;
  align-items: center;
  justify-content: center;
  
  .van-field {
    width: 60px;
  }
}

.action-col {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
}
</style>
