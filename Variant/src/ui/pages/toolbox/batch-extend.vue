<template>
  <div :class="$style.container">
    <!-- 标题栏 -->
    <div :class="$style.header">
      <button :class="$style.backButton" @click="handleBack" title="返回">
        <van-icon name="arrow-left" :class="$style.backIcon" />
      </button>
      <div :class="$style.title">批量延展</div>
    </div>
    <!-- 页面内容 -->
    <div :class="$style.content">
      <!-- 表格上传区域 -->
      <div :class="$style.uploadSection">
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

      <!-- 隐藏的图片文件夹选择器 -->
      <input
        ref="imageFolderInputRef"
        type="file"
        multiple
        accept="image/*"
        webkitdirectory
        directory
        :class="$style.fileInput"
        @change="handleImageFolderChange"
      />

      <!-- 图片文件夹选择提示（仅在检测到图片列但未选择时显示） -->
      <div 
        v-if="hasImageColumns && imageFiles.length === 0"
        :class="$style.imageSelectHint"
        @click="triggerImageFolderInput"
      >
        <van-icon name="photo-o" :class="$style.imageIcon" />
        <div :class="$style.imageText">点击选择图片文件夹</div>
        <div :class="$style.imageSubtext">表格中包含图片列，需要选择对应的图片文件夹</div>
      </div>

      <!-- 中间提示文字 -->
      <div :class="$style.tip">
        请选中一个组件，再进行批量操作
      </div>

      <!-- 底部按钮 -->
      <van-button
        block
        type="primary"
        :class="$style.batchButton"
        @click="handleBatch"
        :loading="isBatching"
        :disabled="!fileList.length || !hasValidSelection || (hasImageColumns && imageFiles.length === 0) || isBatching"
      >
        开始批量
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { MessageType, sendMsgToPlugin, addMessageListener } from '../../../messages';
import { handleExcelUpload } from '../../utils/fileUploadHandler';

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

interface FileItem {
  file?: File;
  fileName?: string;
}

const fileList = ref<FileItem[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const imageFolderInputRef = ref<HTMLInputElement | null>(null);
const imageFiles = ref<File[]>([]); // 保存图片文件引用（延迟加载）
const hasImageColumns = ref(false);
const tableData = ref<any[]>([]);
const isDragging = ref(false);
const hasValidSelection = ref(false); // 是否有有效的选中（组件或实例）
const processingHeaders = ref<string[]>([]);
const processingImageFileNames = ref<string[]>([]);
const totalRows = ref(0);
const isBatching = ref(false);

const ACTION_STAGE = {
  PREPARE: 'prepare',
  FILL_TEXT: 'fillText',
  FILL_IMAGES: 'fillImages',
  FINALIZE: 'finalize',
} as const;

type StageType = typeof ACTION_STAGE[keyof typeof ACTION_STAGE];

const IMAGE_CHUNK_SIZE = 2;

const currentStage = ref<StageType | 'idle'>('idle');
const prepareQueue = ref<Array<{ index: number; rowData: Record<string, any> }>>([]);
const textQueue = ref<Array<{ index: number; rowData: Record<string, any>; columns: string[] }>>([]);
const imageQueue = ref<Array<{ index: number; rowData: Record<string, any>; columns: string[] }>>([]);
const completedPrepare = ref(0);
const completedText = ref(0);
const completedImageTasks = ref(0);
const totalTextTasks = ref(0);
const totalImageTasks = ref(0);
let finalizeDispatched = false;

// 处理返回按钮点击
function handleBack() {
  emit('back');
}

// 处理选中状态变化
function handleSelectionChange(data: any) {
  // data 直接就是 selection 数组
  
  // 验证选中状态：必须是单个组件或实例
  if (!data || !Array.isArray(data) || data.length !== 1) {
    hasValidSelection.value = false;
    return;
  }
  
  const node = data[0];
  const isValid = node.type === 'COMPONENT' || node.type === 'INSTANCE';
  hasValidSelection.value = isValid;
}

function resetBatchState() {
  processingHeaders.value = [];
  processingImageFileNames.value = [];
  totalRows.value = 0;
  isBatching.value = false;
  currentStage.value = 'idle';
  prepareQueue.value = [];
  textQueue.value = [];
  imageQueue.value = [];
  completedPrepare.value = 0;
  completedText.value = 0;
  completedImageTasks.value = 0;
  totalTextTasks.value = 0;
  totalImageTasks.value = 0;
  finalizeDispatched = false;
}

function dispatchNextTask() {
  if (!isBatching.value || !fileList.value.length) {
    resetBatchState();
    return;
  }

  if (currentStage.value === ACTION_STAGE.PREPARE) {
    const task = prepareQueue.value.shift();
    if (!task) {
      return;
    }
    sendMsgToPlugin(MessageType.BATCH_EXTEND_PROCESS, {
      action: ACTION_STAGE.PREPARE,
      headers: processingHeaders.value,
      rowData: task.rowData,
      rowIndex: task.index,
      totalRows: totalRows.value,
      imageFileNames: processingImageFileNames.value,
    });
    return;
  }

  if (currentStage.value === ACTION_STAGE.FILL_TEXT) {
    const task = textQueue.value.shift();
    if (!task) {
      return;
    }
    sendMsgToPlugin(MessageType.BATCH_EXTEND_PROCESS, {
      action: ACTION_STAGE.FILL_TEXT,
      rowData: task.rowData,
      columns: task.columns,
      rowIndex: task.index,
      totalRows: totalRows.value,
    });
    return;
  }

  if (currentStage.value === ACTION_STAGE.FILL_IMAGES) {
    const task = imageQueue.value.shift();
    if (!task) {
      return;
    }
    sendMsgToPlugin(MessageType.BATCH_EXTEND_PROCESS, {
      action: ACTION_STAGE.FILL_IMAGES,
      rowData: task.rowData,
      columns: task.columns,
      rowIndex: task.index,
      totalRows: totalRows.value,
    });
    return;
  }

  if (currentStage.value === ACTION_STAGE.FINALIZE) {
    if (finalizeDispatched) {
      return;
    }
    finalizeDispatched = true;
    sendMsgToPlugin(MessageType.BATCH_EXTEND_PROCESS, {
      action: ACTION_STAGE.FINALIZE,
      totalRows: totalRows.value,
    });
  }
}

function startPrepareStage() {
  currentStage.value = ACTION_STAGE.PREPARE;
  completedPrepare.value = 0;
  if (!prepareQueue.value.length) {
    startTextStage();
    return;
  }
  setTimeout(() => dispatchNextTask(), 30);
}

function startTextStage() {
  currentStage.value = ACTION_STAGE.FILL_TEXT;
  completedText.value = 0;
  if (!textQueue.value.length) {
    startImageStage();
    return;
  }
  setTimeout(() => dispatchNextTask(), 30);
}

function startImageStage() {
  currentStage.value = ACTION_STAGE.FILL_IMAGES;
  completedImageTasks.value = 0;
  if (!imageQueue.value.length) {
    startFinalizeStage();
    return;
  }
  setTimeout(() => dispatchNextTask(), 30);
}

function startFinalizeStage() {
  currentStage.value = ACTION_STAGE.FINALIZE;
  finalizeDispatched = false;
  setTimeout(() => dispatchNextTask(), 30);
}

function handleBatchResultEvent(data: {
  stage: StageType;
  rowIndex?: number;
  totalRows?: number;
  success: boolean;
  error?: string;
}) {
  if (!isBatching.value) {
    return;
  }

  if (!data.success) {
    console.error('批量执行失败:', data.error);
    resetBatchState();
    return;
  }

  if (data.stage === ACTION_STAGE.PREPARE) {
    completedPrepare.value += 1;
    if (completedPrepare.value >= totalRows.value) {
      startTextStage();
    } else {
      setTimeout(() => dispatchNextTask(), 30);
    }
    return;
  }

  if (data.stage === ACTION_STAGE.FILL_TEXT) {
    completedText.value += 1;
    if (completedText.value >= totalTextTasks.value || !textQueue.value.length) {
      startImageStage();
    } else {
      setTimeout(() => dispatchNextTask(), 30);
    }
    return;
  }

  if (data.stage === ACTION_STAGE.FILL_IMAGES) {
    completedImageTasks.value += 1;
    if (completedImageTasks.value >= totalImageTasks.value || !imageQueue.value.length) {
      startFinalizeStage();
    } else {
      setTimeout(() => dispatchNextTask(), 30);
    }
    return;
  }

  if (data.stage === ACTION_STAGE.FINALIZE) {
    resetBatchState();
  }
}

// 处理插件请求加载图片
async function handleImageRequest(data: { fileName: string }) {
  
  // 在imageFiles中查找对应的文件
  const file = imageFiles.value.find(f => f.name === data.fileName);
  
  if (!file) {
    console.error(`未找到图片文件: ${data.fileName}`);
    sendMsgToPlugin(MessageType.BATCH_EXTEND_IMAGE_RESPONSE, {
      fileName: data.fileName,
      success: false,
      error: '图片文件未找到',
    });
    return;
  }
  
  try {
    // 读取图片数据
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    
    // 返回图片数据
    sendMsgToPlugin(MessageType.BATCH_EXTEND_IMAGE_RESPONSE, {
      fileName: data.fileName,
      success: true,
      data: Array.from(uint8Array),
    });
  } catch (error) {
    console.error(`读取图片失败: ${data.fileName}`, error);
    sendMsgToPlugin(MessageType.BATCH_EXTEND_IMAGE_RESPONSE, {
      fileName: data.fileName,
      success: false,
      error: '图片读取失败',
    });
  }
}

// 监听选中状态变化和图片请求
onMounted(() => {
  addMessageListener(MessageType.SELECTION_CHANGE, handleSelectionChange);
  addMessageListener(MessageType.BATCH_EXTEND_REQUEST_IMAGE, handleImageRequest);
  addMessageListener(MessageType.BATCH_EXTEND_BATCH_RESULT, handleBatchResultEvent);
});

onBeforeUnmount(() => {
  resetBatchState();
});

// 触发文件选择
function triggerFileInput() {
  fileInputRef.value?.click();
}

// 触发图片文件夹选择
function triggerImageFolderInput() {
  imageFolderInputRef.value?.click();
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
  
  // 检测是否有图片列（列名包含 image、img、图片）
  if (result.data.length > 0) {
    const headers = Object.keys(result.data[0]);
    const imageColumns = headers.filter(isImageColumnName);
    
    hasImageColumns.value = imageColumns.length > 0;
    
    if (hasImageColumns.value) {  
      // 自动打开文件夹选择器
      sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
        message: '检测到图片列，请选择图片文件夹',
        timeout: 2000,
      });
      
      // 使用 nextTick 确保 DOM 已更新，延迟时间增加以确保通知显示后再触发
      setTimeout(() => {
        const input = imageFolderInputRef.value;
        if (input) {
          try {
            input.click();
          } catch (error) {
            console.error('打开文件夹选择器失败:', error);
            // 如果自动触发失败，提示用户手动点击
            sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
              message: '请手动点击上传区域选择图片文件夹',
              timeout: 3000,
            });
          }
        } else {
          console.warn('文件夹选择器元素未找到');
        }
      }, 500); // 增加延迟到500ms
      return;
    }
  }
  
  // 如果没有图片列，直接发送数据
  sendMsgToPlugin(MessageType.BATCH_EXTEND_UPLOAD, {
    fileName: file.name,
    data: result.data,
    rowCount: result.data.length
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

// 处理图片文件夹选择
async function handleImageFolderChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) {
    return;
  }
  
  
  // 过滤出图片文件
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const validImages: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && imageExtensions.indexOf(ext) !== -1) {
      validImages.push(file);
    }
  }
  
  if (validImages.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '未找到有效的图片文件',
      timeout: 2000,
    });
    return;
  }
  
  
  // 只保存文件引用，不立即读取（避免卡顿）
  imageFiles.value = validImages;
  
  // 提示用户已选择图片，但未加载
  sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
    message: `已选择 ${validImages.length} 张图片，将在执行批量时加载`,
    timeout: 2000,
  });
  
}

// 处理批量操作
async function handleBatch() {
  if (isBatching.value) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '正在批量处理中，请稍候',
      timeout: 2000,
    });
    return;
  }

  if (fileList.value.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请先上传表格文件',
      timeout: 2000,
    });
    return;
  }
  
  // 检查是否需要图片但未选择
  if (hasImageColumns.value && imageFiles.value.length === 0) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请选择图片文件夹',
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

  const headers = Object.keys(tableData.value[0]);
  if (!headers.length) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '没有可处理的数据',
      timeout: 2000,
    });
    return;
  }

  const numberColumn = headers[0];
  const columnList = headers.slice(1);
  const imageColumns = columnList.filter(isImageColumnName);
  const textColumns = columnList.filter(col => imageColumns.indexOf(col) === -1);

  const prepareTasks: Array<{ index: number; rowData: Record<string, any> }> = [];
  const textTasks: Array<{ index: number; rowData: Record<string, any>; columns: string[] }> = [];
  const imageTasks: Array<{ index: number; rowData: Record<string, any>; columns: string[] }> = [];

  tableData.value.forEach((row, index) => {
    const prepareData: Record<string, any> = {};
    if (numberColumn) {
      prepareData[numberColumn] = row[numberColumn];
    }
    prepareTasks.push({ index, rowData: prepareData });

    const textPayload: Record<string, any> = {};
    textColumns.forEach(col => {
      const value = row[col];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        textPayload[col] = value;
      }
    });
    const textKeys = Object.keys(textPayload);
    if (textKeys.length) {
      textTasks.push({
        index,
        rowData: textPayload,
        columns: textKeys,
      });
    }

    const imageEntries = imageColumns
      .map(col => ({ col, value: row[col] }))
      .filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

    if (imageEntries.length) {
      for (let i = 0; i < imageEntries.length; i += IMAGE_CHUNK_SIZE) {
        const chunk = imageEntries.slice(i, i + IMAGE_CHUNK_SIZE);
        const chunkData: Record<string, any> = {};
        const chunkColumns: string[] = [];
        chunk.forEach(item => {
          chunkData[item.col] = item.value;
          chunkColumns.push(item.col);
        });
        imageTasks.push({
          index,
          rowData: chunkData,
          columns: chunkColumns,
        });
      }
    }
  });

  prepareQueue.value = prepareTasks;
  textQueue.value = textTasks;
  imageQueue.value = imageTasks;
  totalTextTasks.value = textTasks.length;
  totalImageTasks.value = imageTasks.length;

  processingHeaders.value = headers;
  processingImageFileNames.value = imageFiles.value.map(f => f.name);
  totalRows.value = prepareTasks.length;
  isBatching.value = true;

  // 释放原始表格数据引用
  tableData.value = [];

  startPrepareStage();
}

function isImageColumnName(header: string) {
  const lower = header.toLowerCase();
  return lower.includes('image') || lower.includes('img') || header.includes('图片');
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
  flex-direction: column;
  background-color: var(--bg-primary);
  z-index: 10;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  flex-shrink: 0;
  z-index: 11;
}

.backButton {
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

.title {
  flex: 1;
  text-align: right;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.content {
  flex: 1;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  overflow-y: auto;
  box-sizing: border-box;
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

.imageSelectHint {
  width: 100%;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--warning-color, #ff9800);
  border-radius: 8px;
  background-color: var(--warning-bg, rgba(255, 152, 0, 0.05));
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: var(--warning-color, #ff9800);
    background-color: var(--warning-bg-hover, rgba(255, 152, 0, 0.1));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
  }
}

.imageIcon {
  font-size: 28px;
  color: var(--warning-color, #ff9800);
  margin-bottom: 8px;
}

.imageText {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.imageSubtext {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

.tip {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  margin-top: 24px;
}

.batchButton {
  margin-bottom: 32px;
  border-radius: 6px;
  height: 44px;
  font-size: 15px;
  line-height: 42px;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>

