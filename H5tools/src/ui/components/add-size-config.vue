<template>
  <div>
    <div :class="$style['excel-parser']">
      <!-- 拖拽区域 -->
      <div
        :class="$style['drop-area']"
        @dragover.prevent
        @drop.prevent="onFileDrop"
      >
        <p v-if="!validFiles.length">请拖拽xlsx文件（支持多个）到此处</p>
        <ul v-else>
          <li v-for="(file, index) in validFiles" :key="index">
            {{ file }}
          </li>

          <van-button
            :class="$style.add"
            @click="addConfigs"
            size="small"
            type="primary"
          >
            确认添加
          </van-button>
        </ul>
      </div>
    </div>
    <SizeConfig
      :class="$style.container"
      :editMode="true"
      :disabled="!!validFiles.length"
      :configs="configs"
      :storageKey="storageKey"
    />
  </div>
</template>

<script lang="ts" setup>
import * as XLSX from 'xlsx';
import { ref } from 'vue';
import { showToast } from 'vant';
import SizeConfig from './size-config.vue';
import { generateRandomId } from '../js/utils/index';

const configs = ref<any[]>([]); // 保存所有导入的配置
const validFiles = ref<string[]>([]); // 保存符合条件的 .xlsx 文件名
const emit = defineEmits(['onSave', 'close']);

defineProps({
  storageKey: {
    type: String,
  },
});

const addConfigs = () => {
  emit('onSave', configs.value);
  emit('close');
};

const onFileDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    showToast('请上传xlsx格式文件');
    return;
  }

  const validFileNames: string[] = []; // 临时存储有效文件名

  // 遍历所有文件
  Array.from(files).forEach((file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      showToast(`${file.name}不是xlsx格式文件，已跳过`);
      return;
    }

    validFileNames.push(file.name); // 保存有效文件名

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) return;
      const data = new Uint8Array(e.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // 解析数据
      const result = rows.slice(1).map((row: any) => ({
        id: generateRandomId(),
        name: row[0],
        width: row[1],
        height: row[2],
      }));

      if (result.length > 0) {
        // 将解析结果存入configs
        configs.value.push({
          options: result,
          id: generateRandomId(),
          platform: file.name.replace('.xlsx', '').trim(),
        });
      } else {
        showToast(`${file.name}没有可解析的数据`);
      }
    };

    reader.readAsArrayBuffer(file);
  });

  // 更新 validFiles 并显示提示
  validFiles.value = validFileNames;
  if (validFileNames.length > 0) {
    showToast(`成功导入文件：${validFileNames.join(', ')}`);
  }
};
</script>

<style lang="less" module>
.excel-parser {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px;
}
.container {
  background: #fff;
}

.add {
  margin-top: 12px;
}

.drop-area {
  width: 100%;
  height: 200px;
  border: 2px dashed #ccc;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #999;
}

.drop-area ul {
  padding: 0;
  list-style: none;
}

.drop-area li {
  color: #333;
}
</style>
