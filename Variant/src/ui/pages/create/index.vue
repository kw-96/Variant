<template>
  <div :class="$style.container">
    <!-- 上传区域（编辑态） -->
    <div :class="$style.uploadSection" v-show="!isPreview">
      <div :class="$style.uploadHint">点击 | 拖拽 | 输入</div>
      <div 
        :class="[$style.uploadArea, { [$style.dragover]: isDragging }]"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div :class="$style.uploadBtn" @click="imgInputRef?.click()">
          <input
            ref="imgInputRef"
            type="file"
            multiple
            accept="image/*"
            style="display: none;"
            @change="handleImgUpload"
          />
          <van-icon name="photo" size="40" />
        </div>
        <div :class="$style.uploadBtn" @click="excelInputRef?.click()">
          <input
            ref="excelInputRef"
            type="file"
            accept=".xlsx,.csv"
            style="display: none;"
            @change="handleExcelUpload"
          />
          <van-icon name="description" size="40" />
        </div>
        <div :class="$style.uploadBtn" @click="fileInputRef?.click()">
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,.xml"
            style="display: none;"
            @change="handleFileUpload"
          />
          <van-icon name="records" size="40" />
        </div>
      </div>
    </div>

    <!-- 文本输入区域（编辑态） -->
    <div :class="$style.textInputArea" v-show="!isPreview">
      <TabTextarea
        v-model="dataText"
        type="native"
        :class="$style.textarea"
        placeholder="*name *w *h *s *type *safeArea&#10;&#10;&#10;&#10;&#10;&#10;&#10;&#10;
📋复制表格(含表头)
👆双击空白处可查看示例
⌨️手动输入请用[tab]隔开行内数据，[回车]换行
🔲多个安全区请使用[;]隔开
  name:资源位名称  w/h:宽/高  s:大小
  type:格式       safeArea:安全区范围"
        @dblclick="loadExample"
      />
      
      <!-- 确认按钮或创建对象按钮 -->
      <van-button
        :type="hasInput ? 'primary' : 'default'"
        block
        @click="handleConfirm"
        :class="[$style.createBtn, { [$style.disabled]: !hasInput }]"
        :disabled="!hasInput"
      >
        {{ hasInput ? '确认' : '创建对象' }}
      </van-button>
    </div>

    <!-- 预览区域（预览态） -->
    <div :class="$style.previewArea" v-if="isPreview">
      <!-- 顶部操作栏：返回和清空按钮 -->
      <div :class="$style.previewToolbar">
        <van-button size="small" type="default" plain @click="backToEdit">返回</van-button>
        <van-button size="small" type="default" plain @click="clearData">清空</van-button>
      </div>
      <!-- 分割线 -->
      <div :class="$style.divider"></div>
      <!-- 标签列表 -->
      <div :class="$style.tagsContainer">
        <div
          v-for="(tag, index) in tagsList"
          :key="index"
          :class="$style.tag"
        >
          <span :class="$style.tagContent">
            {{ index + 1 }}. {{ tag.name }} {{ tag.w }}×{{ tag.h }} {{ tag.type || '' }}
          </span>
          <div :class="$style.tagClose" @click="removeTag(index)">
            ×
          </div>
        </div>
      </div>
      <!-- 创建对象按钮（保持在原位置） -->
      <van-button
        type="primary"
        block
        @click="createObjects"
        :class="$style.createBtn"
      >
        创建对象
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { sendMsgToPlugin, addMessageListener } from '../../../messages';
import { MessageType } from '../../../messages';
import { getExampleData } from './exampleData';
import { handleExcelUpload as handleExcelFileUpload, handleJsonFileUpload, handleImageUpload } from '../../utils/fileUploadHandler';
import TabTextarea from '../../components/TabTextarea.vue';

// 数据定义
const dataText = ref('');
const isPreview = ref(false); // 是否处于预览态
const tagsList = ref<Array<{ name: string; w: number; h: number; type?: string }>>([]);
const isDragging = ref(false);
const frameData = ref<any[]>([]);

// 计算是否已输入数据
const hasInput = computed(() => dataText.value.trim().length > 0);

// 引用
const imgInputRef = ref<HTMLInputElement>();
const excelInputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();

// 监听器清理函数
let getFrameListener: (() => void) | null = null;

// 生命周期
onMounted(() => {
  // 监听 getFrame 消息
  getFrameListener = addMessageListener(MessageType.GET_FRAME, (data: string[]) => {
    handleGetFrame(data);
  });
});

/**
 * 处理确认按钮点击
 */
function handleConfirm() {
  if (!hasInput.value) {
    return; // 已被 disabled，这里只是防御性检查
  }
  confirmToPreview();
}

/**
 * 进入预览
 */
function confirmToPreview() {
  if (!dataText.value.trim()) {
    alert('请输入数据');
    return;
  }
  // 对齐原始版本：去除两侧空白并收敛制表/换行周围空白
  const normalized = dataText.value.trim().replace(/\s*([\t\n])\s*/g, '$1');
  dataText.value = normalized;
  const data = textToList(normalized);
  if (data.length === 0) {
    alert('无法解析数据，请检查格式');
    return;
  }
  updateTags(data);
  isPreview.value = true;
}

/**
 * 返回编辑
 */
function backToEdit() {
  isPreview.value = false;
}

/**
 * 清空数据并返回编辑
 */
function clearData() {
  dataText.value = '';
  tagsList.value = [];
  frameData.value = [];
  isPreview.value = false;
}

/**
 * 移除单个标签
 */
function removeTag(index: number) {
  tagsList.value.splice(index, 1);
}

onUnmounted(() => {
  // 清理监听器
  if (getFrameListener) {
    getFrameListener();
    getFrameListener = null;
  }
});

/**
 * 将文本转换为对象数组
 */
function textToList(text: string) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split('\t');
  const data = lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      // 如果是数字，转换为数字类型
      if (/^\d+\.?\d*$/.test(value)) {
        obj[header] = parseFloat(value);
      } else {
        obj[header] = value || '';
      }
    });
    return obj;
  });
  
  return data;
}

/**
 * 处理图片上传
 * 裁剪大图并导入
 */
async function handleImgUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;

  const result = await handleImageUpload(files);

  if (!result.success) {
    alert(result.error || '图片处理失败');
    return;
  }

  // 发送导入数量
  sendMsgToPlugin(MessageType.IMPORT_IMAGES, result.files.length);

  // 发送每个图片的切片
  result.files.forEach((fileData) => {
    sendMsgToPlugin(MessageType.IMPORT_IMAGES, fileData.slices.map((slice) => ({
      img: slice.img,
      w: slice.w,
      h: slice.h,
      name: slice.name,
      x: slice.x,
      y: slice.y,
    })));
  });
}

/**
 * 处理Excel上传
 */
async function handleExcelUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  const result = await handleExcelFileUpload(file);
  
  if (result.success) {
    // 处理数据
    frameData.value = result.data;
    
    // 生成标签并进入预览
    updateTags(result.data);
    fillTextArea(result.data);
    isPreview.value = true;
  } else {
    alert(result.error || 'Excel文件解析失败');
  }
}

/**
 * 处理JSON/XML文件上传
 */
async function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  const result = await handleJsonFileUpload(file);
  
  if (result.success) {
    // 处理数据
    frameData.value = result.data;
    
    // 生成标签并进入预览
    updateTags(result.data);
    fillTextArea(result.data);
    isPreview.value = true;
  } else {
    alert(result.error || '文件解析失败');
  }
}

/**
 * 更新标签列表
 */
function updateTags(data: any[]) {
  tagsList.value = data.map(item => ({
    name: item.name || '',
    w: item.w || 0,
    h: item.h || 0,
    type: item.type || ''
  }));
}

/**
 * 填充文本区域
 */
function fillTextArea(data: any[]) {
  if (data.length === 0) return;
  
  // 获取所有列名
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  const rows = data.map(item => {
    return headers.map(header => item[header] ?? '').join('\t');
  });
  
  dataText.value = headers.join('\t') + '\n' + rows.join('\n');
}

/**
 * 拖拽事件处理
 */
function handleDragOver() {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  
  // 根据文件类型分发处理
  const file = files[0];
  const fileName = file.name.toLowerCase();
  
  if (fileName.match(/\.(jpg|jpeg|png|gif|webp|jfif)$/i)) {
    // 图片文件
    handleImgUpload({ target: { files } } as any);
  } else if (fileName.match(/\.(xlsx|csv)$/i)) {
    // Excel文件
    handleExcelUpload({ target: { files } } as any);
  } else if (fileName.match(/\.(json|xml)$/i)) {
    // JSON/XML文件
    handleFileUpload({ target: { files } } as any);
  }
}

/**
 * 加载示例数据
 */
function loadExample() {
  dataText.value = getExampleData();
}

/**
 * 处理 getFrame 消息
 * 将选中画板的尺寸信息填入文本框
 */
function handleGetFrame(data: string[]) {
  if (!data || data.length === 0) return;
  
  // 构建表头和数据行
  const header = 'name\tw\th';
  const rows = data.join('');
  
  // 填充到文本框
  dataText.value = header + '\n' + rows;
  
  // 更新标签
  const textData = textToList(dataText.value);
  updateTags(textData);
  isPreview.value = true;
}

/**
 * 创建对象
 */
function createObjects() {
  if (!dataText.value.trim()) {
    alert('请输入数据');
    return;
  }
  
  // 解析文本数据
  const normalized = dataText.value.trim().replace(/\s*([\t\n])\s*/g, '$1');
  dataText.value = normalized;
  const data = textToList(normalized);
  
  if (data.length === 0) {
    alert('无法解析数据，请检查格式');
    return;
  }
  
  // 验证必需字段
  const requiredFields = ['name', 'w', 'h'];
  const hasAllFields = data.every(item => 
    requiredFields.every(field => item[field] !== undefined && item[field] !== '')
  );
  
  if (!hasAllFields) {
    alert('数据格式错误，必须包含name、w、h字段');
    return;
  }
  
  // 发送创建画板消息到插件
  sendMsgToPlugin(MessageType.CREATE_FRAMES, data);
  
  // 创建后保持在预览态，用户可继续清空/返回/再次创建
}
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.uploadSection {
  margin-bottom: 24px;
  flex-shrink: 0;
}

.uploadHint {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.uploadArea {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s;
  
  &.dragover {
    border-color: var(--button-primary-bg);
    background-color: var(--bg-secondary);
  }
}

.uploadBtn {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  
  &:hover {
    color: var(--button-primary-bg);
  }
  
  :global(.van-icon) {
    opacity: 0.6;
  }
}

.textInputArea {
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.textarea {
  height: 500px;
}

.createBtn {
  flex-shrink: 0;
  
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.previewArea {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
}

.previewToolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 2px 0;
}

.divider {
  width: 100%;
  height: 1px;
  background-color: var(--divider-color);
  flex-shrink: 0;
}

.tagsContainer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  align-content: flex-start;
}

.tag {
  padding: 4px 10px;
  background-color: var(--tag-bg);
  border: 1px solid var(--tag-border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--tag-text);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  width: fit-content;
}

.tagContent {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tagClose {
  cursor: pointer;
  margin-left: 8px;
  width: 10px;
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
  
  &:hover {
    opacity: 1;
  }
}
</style>
