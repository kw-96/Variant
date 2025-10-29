<template>
  <div :class="$style.container">
    <!-- 操作栏 -->
    <div :class="$style.toolbar">
      <div :class="$style.leftActions">
        <van-button
          type="default"
          size="small"
          @click="handleUploadSelection"
        >
          上传所选
        </van-button>
        <van-button
          type="default"
          size="small"
          @click="handleAddSelection"
        >
          添加所选
        </van-button>
      </div>
      <div :class="$style.rightActions">
        <van-button
          type="default"
          size="small"
          plain
          @click="handleClearAll"
        >
          清空
        </van-button>
        <van-button
          type="default"
          size="small"
          plain
          @click="handleToggleAll"
        >
          {{ allSelected ? '取消全选' : '全选' }}
        </van-button>
      </div>
    </div>

    <!-- 标签容器 -->
    <div :class="$style.tagsWrapper">
      <div :class="$style.tagsContainer">
        <div v-if="exportList.length === 0" :class="$style.emptyState">
          <span>暂无导出项</span>
        </div>
        <div
          v-for="(item, index) in exportList"
          :key="index"
          :class="$style.tagItem"
        >
          <input
            type="checkbox"
            :id="'chk-export-' + index"
            :checked="item.checked"
            @change="handleToggleItem(index)"
          />
          <div :class="$style.tagContent">
            <div :class="$style.tagName">{{ item.name }}.{{ item.type }}</div>
            <div :class="$style.tagInfo">
              {{ item.width }} × {{ item.height }}
              <span v-if="item.s" :class="$style.sizeInfo"> / {{ item.s }}</span>
            </div>
            <div v-if="item.imgSize" :class="$style.imgSizeInfo">
              {{ item.imgSize }}k{{ item.needCompress ? ' / 待压缩' : ' / 无需压缩' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出按钮 -->
    <van-button
      type="primary"
      block
      @click="handleExport"
      :class="$style.exportBtn"
      :disabled="exportList.filter(item => item.checked).length === 0"
    >
      导出 ({{ exportList.filter(item => item.checked).length }})
    </van-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MessageType } from '../../../messages';
import { sendMsgToPlugin, addMessageListener, removeMessageListener } from '../../../messages';

interface ExportItem {
  name: string;
  width: number;
  height: number;
  type: string; // 图片格式：jpg/png/webp
  s: string; // 压缩目标大小（单位：k）
  id: string; // 节点ID
  checked: boolean;
  imgData?: Uint8Array; // 图片数据
  imgSize?: number; // 图片大小（单位：k）
  needCompress?: boolean; // 是否需要压缩
}

const exportList = ref<ExportItem[]>([]);
const allSelected = ref(false);
let exportNum = 0; // 导出序号（用于追加模式）

// 将 Uint8Array 转换为 Base64（用于后续压缩）
function U8AToB64(u8a: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(u8a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// 上传所选
function handleUploadSelection() {
  exportNum = 0;
  exportList.value = [];
  allSelected.value = false;
  
  sendMsgToPlugin(MessageType.EXPORT_IMAGES, { action: 'new' });
}

// 添加所选
function handleAddSelection() {
  sendMsgToPlugin(MessageType.EXPORT_IMAGES, { action: 'add' });
}

// 清空
function handleClearAll() {
  exportList.value = [];
  allSelected.value = false;
  exportNum = 0;
}

// 全选切换
function handleToggleAll() {
  allSelected.value = !allSelected.value;
  exportList.value.forEach(item => {
    item.checked = allSelected.value;
  });
}

// 单个项目切换
function handleToggleItem(index: number) {
  exportList.value[index].checked = !exportList.value[index].checked;
  // 更新全选状态
  allSelected.value = exportList.value.every(item => item.checked);
}

// 处理帧数据（frameExport 消息）
function handleFrameExport(data: { frameData: any[]; action: string }) {
  const { frameData, action } = data;
  
  if (action === 'new') {
    // 新上传：清空列表
    exportList.value = [];
    exportNum = 0;
  }
  
  // 添加帧数据到列表（先添加占位数据，稍后补充图片数据）
  const startIndex = exportNum;
  frameData.forEach((item, i) => {
    const exportItem: ExportItem = {
      name: item.name,
      width: item.width,
      height: item.height,
      type: item.type || 'jpg',
      s: item.s || '',
      id: item.id || '',
      checked: true,
    };
    exportList.value.push(exportItem);
    exportNum++;
  });
  
  // 自动选中新添加的项目
  updateAllSelectedState();
}

// 处理图片数据（imgExport 消息）
function handleImgExport(data: { imgData: Uint8Array[]; action: string }) {
  const { imgData, action } = data;
  
  if (action === 'new') {
    // 新上传：从索引 0 开始
    imgData.forEach((img, i) => {
      if (i < exportList.value.length) {
        const item = exportList.value[i];
        item.imgData = img;
        item.imgSize = Math.floor(img.length / 1000);
        item.needCompress = item.s !== '' && parseInt(item.s) > 0 && item.imgSize > parseInt(item.s);
      }
    });
  } else {
    // 追加模式：从 exportNum - imgData.length 开始
    const startIndex = exportNum - imgData.length;
    imgData.forEach((img, i) => {
      const index = startIndex + i;
      if (index >= 0 && index < exportList.value.length) {
        const item = exportList.value[index];
        item.imgData = img;
        item.imgSize = Math.floor(img.length / 1000);
        item.needCompress = item.s !== '' && parseInt(item.s) > 0 && item.imgSize > parseInt(item.s);
      }
    });
  }
}

// 更新全选状态
function updateAllSelectedState() {
  if (exportList.value.length === 0) {
    allSelected.value = false;
    return;
  }
  allSelected.value = exportList.value.every(item => item.checked);
}

// 导出
function handleExport() {
  const selectedItems = exportList.value.filter(item => item.checked && item.imgData);
  
  if (selectedItems.length === 0) {
    alert('请至少选择一个可导出的项目');
    return;
  }
  
  // TODO: 实现实际导出逻辑（下载图片）
  console.log('导出项目:', selectedItems);
  alert(`准备导出 ${selectedItems.length} 个项目（功能待实现）`);
}

// 监听插件消息
let frameExportListener: (() => void) | null = null;
let imgExportListener: (() => void) | null = null;

onMounted(() => {
  // 监听 frameExport 消息
  frameExportListener = addMessageListener('frameExport', (data: any) => {
    handleFrameExport(data);
  });
  
  // 监听 imgExport 消息
  imgExportListener = addMessageListener('imgExport', (data: any) => {
    handleImgExport(data);
  });
});

onUnmounted(() => {
  // 清理监听器
  if (frameExportListener) {
    frameExportListener();
  }
  if (imgExportListener) {
    imgExportListener();
  }
});
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 12px 0;
  background-color: var(--bg-secondary);
  flex-shrink: 0;
  box-sizing: border-box;
}

.leftActions {
  display: flex;
  gap: 8px;
}

.rightActions {
  display: flex;
  gap: 8px;
}

.tagsWrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.tagsContainer {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emptyState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.tagItem {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
}

.tagContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tagName {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.tagInfo {
  font-size: 12px;
  color: var(--text-secondary);
}

.sizeInfo {
  color: var(--text-secondary);
  opacity: 0.7;
}

.imgSizeInfo {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.exportBtn {
  flex-shrink: 0;
  margin-top: 12px;
}
</style>
