<template>
  <div :class="$style['drop-area']" @dragover.prevent @drop.prevent="onFileDrop">
    <p v-if="!validFiles.length">{{ placeholder }}</p>
    <ul v-else>
      <li v-for="(file, index) in validFiles" :key="index">
        {{ file }}
      </li>
      <slot name="actions" :files="validFiles">
        <van-button
          :class="$style.add"
          @click="handleConfirm"
          size="small"
          type="primary"
        >
          确认导入
        </van-button>
      </slot>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

interface Props {
  placeholder?: string;
  accept?: string[];
  multiple?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请拖拽数据文件（支持多个）到此处',
  accept: () => ['.xlsx', '.xls'],
  multiple: true,
});

const emit = defineEmits<{
  files: [files: File[]];
  confirm: [files: File[]];
}>();

const validFiles = ref<string[]>([]);
const droppedFiles = ref<File[]>([]);

const onFileDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || []);
  
  // 过滤文件类型
  const validFileObjects = files.filter(file => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return props.accept.indexOf(extension) !== -1;
  });

  // 保存文件名（与H5tools保持一致）
  validFiles.value = validFileObjects.map(file => file.name);
  droppedFiles.value = validFileObjects;
  
  emit('files', validFileObjects);
};

const handleConfirm = () => {
  emit('confirm', droppedFiles.value);
};
</script>

<style lang="less" module>
.drop-area {
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--text-secondary);
}

.drop-area ul {
  padding: 0;
  list-style: none;
}

.drop-area li {
  color: var(--text-primary);
}

.add {
  margin-top: 12px;
}
</style>
