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
import * as XLSX from 'xlsx';
import { ref, computed } from 'vue';
import { showToast } from 'vant';
import SizeConfig from './size-config.vue';
import { DataFileDropZone } from '../../../../shared-ui';
import { generateRandomId } from '../../../../shared-ui/utils/common';

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

const onFileDrop = (files: File[]) => {
  validFiles.value = []; // 清空之前的文件名
  parsedConfigs.value = []; // 清空之前的配置

  console.log('开始处理文件:', files.length);

  // 使用 Promise.all 确保所有文件处理完成后再更新
  const filePromises = files.map(file => {
    return new Promise<void>((resolve) => {
      if (file.name.endsWith('.xlsx')) {
        validFiles.value.push(file.name);
        const reader = new FileReader();
        reader.onload = e => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          console.log('Excel解析结果:', json);

          const newConfig = {
            id: generateRandomId(),
            platform: file.name.replace('.xlsx', ''),
            options: json.map((item: any) => ({
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
          resolve();
        };
        reader.readAsArrayBuffer(file);
      } else {
        showToast('只支持.xlsx文件');
        resolve();
      }
    });
  });

  // 等待所有文件处理完成
  Promise.all(filePromises).then(() => {
    console.log('所有文件处理完成，最终 parsedConfigs:', parsedConfigs.value);
  });
};
</script>

<style lang="less" module>
.excel-parser {
  padding: 12px;
}

.container {
  background: var(--bg-primary);
}
</style>
