<template>
  <div>
    <div :class="$style.container">
      <van-checkbox
        v-if="!disabled && !editMode"
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
        v-model="config.options"
        item-key="id"
        handle=".drag-handle"
      >
        <template #item="{ element: option, index }">
          <van-row :class="$style['van-row']">
            <van-col v-if="!disabled && !editMode" span="1">
              <van-checkbox
                icon-size="16px"
                v-model="option.checked"
                shape="square"
              />
            </van-col>
            <van-col span="2">{{ index + 1 }}</van-col>

            <van-col span="6" :class="$style['name']">
              <van-field
                :class="$style['van-field']"
                v-model="option.name"
                v-input-dblclick-select
              />
            </van-col>
            <van-col span="9" :class="$style['size-col']">
              <van-field
                :class="$style['van-field']"
                v-model="option.width"
                type="digit"
              />
              x
              <van-field
                :class="$style['van-field']"
                v-model="option.height"
                type="digit"
              />
            </van-col>
            <!-- 调整操作列 -->
            <van-col span="6" :class="$style['action-col']">
              <van-icon
                name="add-o"
                title="复制"
                @click="oncopy(option, index)"
              />
              <van-icon
                name="close"
                title="删除"
                @click="onDelete(option, index)"
              />
              <van-icon name="wap-nav" title="拖动" class="drag-handle" />
            </van-col>
          </van-row>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script lang="ts" setup>
import draggable from 'vuedraggable';
import { computed } from 'vue';
import { deepCopy } from '../js/utils';

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

const allChecked = computed(() => {
  return (config.value.options || []).every((item: any) => item.checked);
});

function onAllChecked() {
  if (allChecked.value) {
    config.value.options.forEach((item: any) => {
      item.checked = false;
    });
  } else {
    config.value.options.forEach((item: any) => {
      item.checked = true;
    });
  }
}

function oncopy(option: any, index: number) {
  config.value.options.splice(index, 0, deepCopy(option));
}

function onDelete(option: any, index: number) {
  config.value.options.splice(index, 1);
}
</script>

<style lang="less" module>
.container {
  padding: 2px 2px 2px 12px;
  margin: 12px;
  border: 2px solid #f7f8fa;
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
  border-bottom: 0.5px solid #f7f7f7;
  &:last-child {
    border-bottom: none;
  }
}

.van-field {
  background: #f5f5f5;
  margin: 0 4px;
  padding: 6px 2px;
  border-radius: 4px;
  line-height: 1;

  :global(input) {
    padding: 0 6px;
    user-select: text;
  }
}
.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.size-col {
  display: flex;
  align-items: center;
  :global(.van-field) {
    // padding: 0;
    // width: 40%;

    :global(.van-field__control) {
      text-align: center;
    }
  }
}

.action-col {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px; /* 按钮间距 */
  white-space: nowrap;

  :global(.van-icon) {
    cursor: pointer;
    font-size: 16px; /* 图标大小 */
  }
}
</style>
