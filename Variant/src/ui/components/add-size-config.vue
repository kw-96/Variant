<template>
  <div>
    <DataFileDropZone
      :class="$style['excel-parser']"
      @files="onFileDrop"
      @confirm="onConfirmImport"
      :accept="['.xlsx']"
      placeholder="请拖拽xlsx文件（支持多个）到此处"
    />
    <SizeConfig
      :class="$style.container"
      :editMode="true"
      :disabled="false"
      :configs="parsedConfigs"
      :storageKey="storageKey"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { showToast } from 'vant';
import SizeConfig from './size-config.vue';
import DataFileDropZone from './DataFileDropZone.vue';
import { generateRandomId } from '../utils/common';
import { handleExcelUpload } from '../utils/fileUploadHandler';

const parsedConfigs = ref<any[]>([]); // 保存所有导入的配置
const validFiles = ref<string[]>([]); // 保存符合条件的 .xlsx 文件名
const emit = defineEmits(['onSave', 'close']);

defineProps({
  storageKey: {
    type: String,
  },
});

const onConfirmImport = () => {
  // 确认导入，保存配置并关闭弹窗
  emit('onSave', parsedConfigs.value);
  emit('close');
};

const onFileDrop = async (files: File[]) => {
  validFiles.value = []; // 清空之前的文件名
  parsedConfigs.value = []; // 清空之前的配置

  console.log('开始处理文件:', files.length);

  // 筛选 Excel 文件
  const excelFiles = files.filter(file => file.name.endsWith('.xlsx'));

  if (excelFiles.length === 0) {
    showToast('只支持.xlsx文件');
    return;
  }

  // 使用 Promise.all 确保所有文件处理完成后再更新
  const filePromises = excelFiles.map(async (file) => {
    const result = await handleExcelUpload(file);
    
    if (result.success) {
      validFiles.value.push(file.name);
      
      console.log('Excel解析结果:', result.data);

      const newConfig = {
        id: generateRandomId(),
        platform: file.name.replace('.xlsx', ''),
        options: result.data.map((item: any) => ({
          id: generateRandomId(),
          name: item['name'] || item['名称'],
          width: item['w'] || item['宽度'],
          height: item['h'] || item['高度'],
          checked: false,
        })),
      };
      
      console.log('创建的新配置:', newConfig);
      
      // 将新配置添加到数组中
      parsedConfigs.value.push(newConfig);
      console.log('更新后的parsedConfigs:', parsedConfigs.value);
    } else {
      showToast(result.error || '文件解析失败');
    }
  });

  // 等待所有文件处理完成
  await Promise.all(filePromises);
  console.log('所有文件处理完成，最终 parsedConfigs:', parsedConfigs.value);
};
</script>

<style lang="less" module>
.excel-parser {
  padding: 12px;
  padding-bottom: 24px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 12px;
    background: var(--bg-primary);
  }
}

.container {
  background: var(--bg-primary);
}
</style>
