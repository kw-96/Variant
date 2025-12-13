<template>
  <div :class="$style.container">
    <!-- 返回按钮 -->
    <button :class="$style.backButton" @click="handleBack" title="返回">
      <van-icon name="arrow-left" :class="$style.backIcon" />
    </button>
    <!-- 页面内容 -->
    <div :class="$style.content">
      <div :class="$style.tip">
        请先将模板转为组件（快捷键：Ctrl+Alt+K）
      </div>

      <van-button
        type="primary"
        :class="$style.actionButton"
        @click="handleConvert"
      >
        转为数据流
      </van-button>

      <div :class="$style.arrow">
        <van-icon name="arrow-down" />
      </div>

      <!-- 切换按钮 -->
      <div :class="$style.switchContainer">
        <van-button
          :type="inputMode === 'table' ? 'primary' : 'default'"
          :class="$style.switchButton"
          @click="inputMode = 'table'"
        >
          表格上传
        </van-button>
        <van-button
          :type="inputMode === 'text' ? 'primary' : 'default'"
          :class="$style.switchButton"
          @click="inputMode = 'text'"
        >
          文本输入
        </van-button>
      </div>

      <!-- 输入区域容器（固定高度，保持布局稳定） -->
      <div :class="$style.inputContainer">
        <!-- 表格上传区域 -->
        <div v-if="inputMode === 'table'" :class="$style.uploadSection">
          <input
            ref="fileInputRef"
            type="file"
            accept=".xlsx,.xls,.csv"
            :class="$style.fileInput"
            @change="handleFileChange"
          />
          <div 
            :class="[$style.uploadArea, { [$style.dragover]: isDragging }]" 
            @click="triggerFileInput"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop"
          >
            <van-icon name="plus" :class="$style.uploadIcon" />
            <div :class="$style.uploadText">
              {{ fileList.length > 0 ? fileList[0].fileName : '上传表格文件' }}
            </div>
            <div :class="$style.uploadHint">支持点击或拖拽上传 .xlsx / .xls / .csv</div>
          </div>
        </div>

        <!-- 文本输入框 -->
        <div v-else :class="$style.textInputSection">
          <van-field
            v-model="inputValue"
            :class="$style.inputField"
            rows="6"
            type="textarea"
            placeholder="手动输入请用[tab]隔开行内数据，[回车]换行"
            show-word-limit
          />
        </div>
      </div>

      <van-button
        block
        type="primary"
        :class="$style.fillButton"
        @click="handleFill"
      >
        开始数据流
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import { handleExcelUpload } from '../../utils/fileUploadHandler';

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

// 输入模式：'table' 表格上传，'text' 文本输入
const inputMode = ref<'table' | 'text'>('table');

// 表格上传相关
interface FileItem {
  file?: File;
  fileName?: string;
}

const fileList = ref<FileItem[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const tableData = ref<any[]>([]);

// 文本输入相关
const inputValue = ref('');

// 处理返回按钮点击
function handleBack() {
  emit('back');
}

// 处理转为数据流按钮点击
function handleConvert() {
  sendMsgToPlugin(MessageType.BATCH_BUTTON_CONVERT);
}

// 触发文件选择
function triggerFileInput() {
  fileInputRef.value?.click();
}

// 拖拽事件处理
function handleDragOver() {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

async function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  
  if (!files || files.length === 0) {
    return;
  }
  
  const file = files[0];
  await processTableFile(file);
}

// 处理表格文件
async function processTableFile(file: File) {
  const fileName = file.name.toLowerCase();
  
  // 验证文件类型
  if (!fileName.match(/\.(xlsx|xls|csv)$/i)) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '不支持的文件格式，请上传 .xlsx / .xls / .csv 文件',
      timeout: 3000,
    });
    return;
  }
  
  // 在前端解析表格文件
  const result = await handleExcelUpload(file);
  
  if (!result.success) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: result.error || '表格解析失败',
      timeout: 3000,
    });
    return;
  }
  
  // 保存到fileList（用于UI显示）
  fileList.value = [{
    file: file,
    fileName: file.name
  }];
  
  // 暂存表格数据（包含表头行）
  tableData.value = result.data;
  
  // 计算数据行数（不包括表头）
  const dataRowCount = result.data.length > 0 ? result.data.length - 1 : 0;
  
  sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
    message: `表格解析成功，共 ${dataRowCount} 行数据`,
    timeout: 2000,
  });
}

// 处理文件选择
async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) {
    return;
  }
  
  await processTableFile(files[0]);
}

/**
 * 解析表格数据，提取表头和数据行
 * @param data 原始表格数据（第一行为表头）
 * @returns 包含表头和数据行的对象
 */
function parseTableData(data: any[]): { headers: string[]; rows: Record<string, any>[] } | null {
  if (!data || data.length === 0) {
    return null;
  }

  // 第一行作为表头
  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return null;
  }

  // 提取表头（对象的key）
  const headers = Object.keys(firstRow);

  if (headers.length === 0) {
    return null;
  }

  // 从第二行开始是数据行
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && typeof row === 'object') {
      rows.push(row);
    }
  }

  return { headers, rows };
}

/**
 * 解析文本输入，提取表头和数据行
 * @param text 文本内容（第一行为表头，用tab分隔；后续行为数据，用tab分隔）
 * @returns 包含表头和数据行的对象
 */
function parseTextData(text: string): { headers: string[]; rows: Record<string, any>[] } | null {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  // 第一行作为表头
  const headerLine = lines[0];
  const headers = headerLine.split(/\t/).map(h => h.trim()).filter(h => h.length > 0);

  if (headers.length === 0) {
    return null;
  }

  // 从第二行开始是数据行
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(/\t/).map(v => v.trim());
    
    // 构建行对象
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return { headers, rows };
}

// 处理填充按钮点击
function handleFill() {
  let parsedData: { headers: string[]; rows: Record<string, any>[] } | null = null;

  if (inputMode.value === 'table') {
    // 表格模式
    if (fileList.value.length === 0) {
      sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
        message: '请先上传表格文件',
        timeout: 2000,
      });
      return;
    }
    
    if (!tableData.value.length) {
      sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
        message: '表格数据为空，请重新上传',
        timeout: 2000,
      });
      return;
    }
    
    // 解析表格数据
    parsedData = parseTableData(tableData.value);
  } else {
    // 文本模式
    if (!inputValue.value.trim()) {
      sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
        message: '请输入文本内容',
        timeout: 2000,
      });
      return;
    }

    // 解析文本数据
    parsedData = parseTextData(inputValue.value);
  }

  // 验证解析结果
  if (!parsedData) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '数据解析失败，请检查数据格式',
      timeout: 2000,
    });
    return;
  }

  if (parsedData.headers.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '表头为空，请检查数据格式',
      timeout: 2000,
    });
    return;
  }

  if (parsedData.rows.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '数据行为空，请至少输入一行数据',
      timeout: 2000,
    });
    return;
  }

  // 发送数据到插件端处理
  sendMsgToPlugin(MessageType.DATA_FLOW_PROCESS, {
    headers: parsedData.headers,
    rows: parsedData.rows,
  });
}
</script>

<style lang="less" module>
.container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px;
  box-sizing: border-box;
  background-color: var(--bg-primary);
  z-index: 10;
  overflow: hidden;
}

.backButton {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 11;
  
  &:hover {
    background-color: var(--input-bg);
    border-color: var(--button-primary-bg);
  }
  
  &:active {
    background-color: var(--bg-primary);
  }
}

.backIcon {
  font-size: 16px;
}

.content {
  width: 100%;
  max-width: 360px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  margin-top: 40px;
  padding-bottom: 20px;
}

.tip {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  margin-top: 0;
}

.actionButton {
  align-self: center;
  width: 160px;
  margin-bottom: 6px;
  border-radius: 6px;
  height: 38px;
  font-size: 14px;
  line-height: 36px;
}

.arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-secondary);
  font-size: 18px;
  margin-bottom: 16px;
}

.switchContainer {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.switchButton {
  flex: 1;
  border-radius: 6px;
  height: 36px;
  font-size: 14px;
}

.inputContainer {
  min-height: 220px;
  height: 220px;
  margin-bottom: 16px;
  position: relative;
}

.uploadSection {
  width: 100%;
  height: 100%;
}

.fileInput {
  display: none;
}

.uploadArea {
  width: 100%;
  height: 220px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-secondary);
  transition: all 0.3s;
  cursor: pointer;
  box-sizing: border-box;
  
  &:hover {
    border-color: var(--button-primary-bg);
    background-color: var(--input-bg);
  }
  
  &.dragover {
    border-color: var(--button-primary-bg);
    background-color: var(--input-bg);
    transform: scale(1.02);
  }
}

.uploadIcon {
  font-size: 32px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.uploadText {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-weight: 500;
}

.uploadHint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.textInputSection {
  width: 100%;
  height: 220px;
  min-height: 220px;
}

.fillButton {
  margin-top: auto;
  margin-bottom: 16px;
  border-radius: 6px;
  height: 42px;
  font-size: 15px;
  line-height: 40px;
}

.inputField {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  transition: border-color 0.2s;
  
  &:focus-within {
    border-color: var(--button-primary-bg);
  }
  
  :global(.van-field__body) {
    align-items: flex-start;
    padding: 0;
    height: 100%;
  }
  
  :global(.van-field__control) {
    width: 100%;
    height: 220px;
    min-height: 220px;
    max-height: 220px;
    padding: 12px;
    text-align: left;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    background: transparent;
    box-sizing: border-box;
  }
  
  :global(textarea) {
    resize: none;
    height: 100%;
  }
  
  :global(.van-field__control::placeholder) {
    color: var(--text-secondary);
    opacity: 0.5;
  }
  
  :global(.van-field__word-limit) {
    width: 100%;
    text-align: right;
    padding: 0 12px 8px;
    color: var(--text-secondary);
    font-size: 12px;
  }
}

</style>

