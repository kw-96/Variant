<template>
  <div :class="$style.container">
    <!-- 返回按钮 -->
    <button :class="$style.backButton" @click="handleBack" title="返回">
      <van-icon name="arrow-left" :class="$style.backIcon" />
    </button>
    <!-- 页面内容 -->
    <div :class="$style.content">
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

      <van-button
        block
        type="primary"
        :class="$style.fillButton"
        @click="handleFill"
      >
        开始填充
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
  
  // 暂存表格数据
  tableData.value = result.data;
  
  sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
    message: `表格解析成功，共 ${result.data.length} 行数据`,
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

// 处理填充按钮点击
function handleFill() {
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
    
    // TODO: 实现表格填充功能
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '功能开发中',
      timeout: 2000,
    });
  } else {
    // 文本模式
    const lines = inputValue.value
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
        message: '请输入至少一行文本',
        timeout: 2000,
      });
      return;
    }

    // TODO: 实现文本填充功能
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '功能开发中',
      timeout: 2000,
    });
  }
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
  align-items: center;
  justify-content: center;
  padding: 32px;
  box-sizing: border-box;
  background-color: var(--bg-primary);
  z-index: 10;
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
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  margin-top: 64px;
}

.switchContainer {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.switchButton {
  flex: 1;
  border-radius: 6px;
  height: 36px;
  font-size: 14px;
}

.uploadSection {
  margin-bottom: 24px;
}

.fileInput {
  display: none;
}

.uploadArea {
  width: 100%;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-secondary);
  transition: all 0.3s;
  cursor: pointer;
  
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
  margin-bottom: 24px;
}

.fillButton {
  margin-top: 14px;
  margin-bottom: 32px;
  border-radius: 6px;
  height: 44px;
  font-size: 15px;
  line-height: 42px;
}

.inputField {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  margin-top: 8px;
  transition: border-color 0.2s;
  
  &:focus-within {
    border-color: var(--button-primary-bg);
  }
  
  :global(.van-field__body) {
    align-items: flex-start;
    padding: 0;
  }
  
  :global(.van-field__control) {
    width: 100%;
    min-height: 260px;
    padding: 12px;
    text-align: left;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.4;
    background: transparent;
  }
  
  :global(textarea) {
    resize: none;
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

