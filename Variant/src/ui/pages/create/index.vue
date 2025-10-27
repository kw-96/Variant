<template>
  <div :class="$style.container">
    <!-- 上传区域 -->
    <div :class="$style.uploadSection">
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

    <!-- 文本输入区域 -->
    <div :class="$style.textInputArea">
      <textarea
        v-model="dataText"
        :class="$style.textarea"
        placeholder="*name *w *h *s *type *safeArea&#10;&#10;&#10;&#10;&#10;&#10;&#10;&#10;&#10;
📋复制表格(含表头)
👆双击空白处可查看示例
⌨️手动输入请用[tab]隔开行内数据
🔲多个安全区请使用[;]隔开
  name:资源位名称  w/h:宽/高  s:大小
  type:格式       safeArea:安全区范围"
        @dblclick="loadExample"
      />
      
      <!-- 创建对象按钮 -->
      <van-button
        type="primary"
        block
        @click="createObjects"
        :class="$style.createBtn"
      >
        创建对象
      </van-button>
    </div>

    <!-- 预览区域 -->
    <div :class="$style.previewArea" v-if="tagsList.length > 0">
      <div :class="$style.tagsContainer">
        <div
          v-for="(tag, index) in tagsList"
          :key="index"
          :class="$style.tag"
        >
          {{ tag.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const dataText = ref('');
const tagsList = ref<Array<{ name: string }>>([]);
const isDragging = ref(false);

const imgInputRef = ref<HTMLInputElement>();
const excelInputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();

// 图片上传处理
function handleImgUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    console.log('Images received:', Array.from(files));
    // TODO: 处理图片上传逻辑
  }
}

// Excel上传处理
function handleExcelUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    console.log('Excel received:', file);
    // TODO: 处理Excel上传逻辑
  }
}

// 文件上传处理
function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    console.log('File received:', file);
    // TODO: 处理文件上传逻辑
  }
}

// 拖拽处理
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
  Array.from(files).forEach(file => {
    const fileName = file.name.toLowerCase();
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      // 图片文件
      handleImgUpload({ target: { files: [file] } } as any);
    } else if (fileName.match(/\.(xlsx|csv)$/i)) {
      // Excel文件
      handleExcelUpload({ target: { files: [file] } } as any);
    } else if (fileName.match(/\.(json|xml)$/i)) {
      // 其他文件
      handleFileUpload({ target: { files: [file] } } as any);
    }
  });
}

// 加载示例数据
function loadExample() {
  dataText.value = `name\tw\th\ts\ttype\tsafeArea
游戏中心-闪屏（常规样式）\t1080\t2400\t500k\tjpg\tleft:96, right: 96, top: 336, bottom: 858;left:96, right: 624, top: 336, bottom: 1980;left:123, right: 126, top: 1590, bottom: 648
游戏中心-节点推广\t984\t554\t1000k\tjpg\tleft:48, right: 48, top: 48, bottom: 50`;
}

// 创建对象
function createObjects() {
  if (!dataText.value.trim()) {
    console.warn('请输入数据');
    return;
  }
  
  console.log('创建对象，数据:', dataText.value);
  // TODO: 实现创建对象的逻辑
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
  width: 100%;
  height: 500px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  resize: none;
  overflow-y: auto;
  
  &:focus {
    outline: none;
    border-color: var(--button-primary-bg);
  }
  
  &::placeholder {
    color: var(--text-secondary);
    opacity: 0.5;
  }
}

.createBtn {
  flex-shrink: 0;
}

.previewArea {
  margin-top: 16px;
  border-top: 1px solid var(--divider-color);
  padding-top: 16px;
}

.tagsContainer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 6px 12px;
  background-color: var(--tag-bg);
  border: 1px solid var(--tag-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--tag-text);
}
</style>
