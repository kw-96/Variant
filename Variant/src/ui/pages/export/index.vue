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
          :class="[$style.tagItem, item.checked ? $style.selected : '']"
          @click="handleToggleItem(index)"
        >
          <!-- 左上角清除按钮 -->
          <button :class="$style.closeBtn" title="移除" @click="removeItem(index)">－</button>

          <!-- 顶部行：左侧名称（紧邻清除按钮右侧），右侧尺寸 -->
          <div :class="$style.header">
            <div :class="$style.tagName">{{ (index + 1) + '. ' }}{{ (item.name || '').split(' ')[0] }}</div>
            <div :class="$style.dimRight">{{ item.width }} × {{ item.height }}</div>
          </div>

          <!-- 左下：大小与压缩状态 -->
          <div :class="$style.statusBox">
            <template v-if="item.imgSize !== undefined">
              <span
                v-if="!item.compressDone"
                :class="item.needCompress ? $style.need : $style.noNeed"
              >
                {{ item.imgSize }}k / {{ item.needCompress ? '待压缩' : '无需压缩' }}
              </span>
              <span
                v-else
                :class="item.compressFailed ? $style.need : $style.noNeed"
              >
                {{ item.compressedSize ?? item.imgSize }}k / {{ item.compressFailed ? '压缩失败' : '已压缩' }}
              </span>
            </template>
          </div>

          <!-- 右下：大小输入与格式选择 -->
          <div :class="$style.controls">
            <input
              :class="$style.sizeInput"
              type="text"
              min="0"
              v-model="item.s"
              inputmode="numeric"
              :placeholder="extractTargetSizeFromName(item.name) || ''"
              @click.stop
              @mousedown.stop
              @input="onEditSize(index, String(item.s || ''))"
            />
            <span :class="$style.suffix">k</span>
            <select
              :class="$style.typeSelect"
              :value="item.type || 'jpg'"
              @click.stop
              @mousedown.stop
              @change="onEditType(index, ($event.target as HTMLSelectElement).value)"
            >
              <option value="jpg">jpg</option>
              <option value="jpeg">jpeg</option>
              <option value="png">png</option>
              <option value="webp">webp</option>
            </select>
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
import { sendMsgToPlugin, addMessageListener } from '../../../messages';
import { exportHandler, type ExportItem } from './exportHandler';

const exportList = ref<ExportItem[]>([]);
const allSelected = ref(false);
let exportNum = 0; // 导出序号（用于追加模式）
let currentPageName = ''; // 当前页面名称

// 预留：如需客户端压缩可使用转换函数

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
function handleFrameExport(data: { frameData: any[]; action: string; pageName?: string }) {
  const { frameData, action, pageName } = data;
  
  // 保存页面名称
  if (pageName) {
    currentPageName = pageName;
  }
  
  if (action === 'new') {
    // 新上传：清空列表
    exportList.value = [];
    exportNum = 0;
  }
  
  // 添加帧数据到列表（先添加占位数据，稍后补充图片数据）
  frameData.forEach((item) => {
    const targetFromName = extractTargetSizeFromName(item.name);
    const normalizedS = item.s ? String(item.s).replace(/\D+/g, '') : targetFromName;
    const exportItem: ExportItem = {
      name: item.name,
      width: item.width,
      height: item.height,
      type: item.type || 'jpg',
      s: normalizedS,
      id: item.id || '',
      checked: true,
      compressDone: false,
    };
    exportList.value.push(exportItem);
    exportNum++;
  });
  
  // 自动选中新添加的项目
  updateAllSelectedState();
}

// 从名称中提取目标大小（形如 "1000k" 或 "1000 K" 或在名称末尾的数字）
function extractTargetSizeFromName(name: string): string {
  if (!name) return '';
  // 支持半角/全角 K，前后可有空格或标点
  const kMatch = name.match(/(?:^|\s)(\d{2,6})\s*[kKｋＫ](?=\b|\D)/);
  if (kMatch) return String(kMatch[1]);
  // 兜底：提取形如 "... 300k 720×1252" 中的第一个连续数字块
  const digit = name.match(/(?:^|\s)(\d{2,6})(?=\s|$)/);
  return digit ? String(digit[1]) : '';
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

// 移除单条
function removeItem(index: number) {
  if (index >= 0 && index < exportList.value.length) {
    exportList.value.splice(index, 1);
    updateAllSelectedState();
  }
}

// 内部：根据目标大小更新是否需要压缩
function recomputeCompressFlag(item: ExportItem) {
  if (item.imgSize === undefined) {
    item.needCompress = false;
    return;
  }
  const target = item.s && item.s !== '' ? parseInt(item.s) : 0;
  item.needCompress = target > 0 && item.imgSize > target;
}

// 编辑目标大小
function onEditSize(index: number, value: string) {
  const item = exportList.value[index];
  if (!item) return;
  // 仅保留数字，屏蔽用户输入中的 k/K 及非数字字符
  const digits = (value || '').replace(/\D+/g, '');
  item.s = digits;
  recomputeCompressFlag(item);
}

// 编辑导出格式
function onEditType(index: number, value: string) {
  const item = exportList.value[index];
  if (!item) return;
  item.type = value as any;
}

// 导出
function handleExport() {
  const selectedItems = exportList.value.filter(item => item.checked && item.imgData);
  
  (async () => {
    try {
      // 创建 id 到 item 的映射，用于回调更新
      const idToItemMap = new Map<string, ExportItem>();
      selectedItems.forEach(item => {
        idToItemMap.set(item.id, item);
      });

      await exportHandler(
        selectedItems,
        currentPageName,
        (itemId, updates) => {
          const item = idToItemMap.get(itemId);
          if (item) {
            Object.assign(item, updates);
          }
        }
      );
    } catch (err: any) {
      console.error('导出失败详情：', err);
      alert(`导出失败：${err?.message || err}`);
    }
  })();
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

// 暴露给父组件使用
defineExpose({
  exportList,
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
  background-color: var(--input-bg);
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
  position: relative;
  padding: 12px 12px 36px 12px; // 预留底部空间放控件
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.closeBtn {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 16px;
  height: 16px;
  line-height: 18px;
  text-align: center;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
}

.selected {
  border-color: var(--primary-color, #1989fa);
  box-shadow: 0 0 0 2px rgba(25,137,250,0.15) inset;
}

.header {
  position: absolute;
  left: 20px; // 清除按钮右侧留白
  right: 12px;
  top: 0px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dimRight { font-size: 11px; color: var(--text-secondary); }

.tagName {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.tagInfo {
  font-size: 11px;
  color: var(--text-secondary);
}

.sizeInfo {
  color: var(--text-secondary);
  opacity: 0.7;
}

.imgSizeInfo {
  font-size: 10px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.statusBox {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 11px;
}

.need { color: #d9534f; }
.noNeed { color: #3c763d; }

.controls {
  position: absolute;
  right: 12px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sizeInput {
  width: 42px;
  height: 16px;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
}

.suffix {
  font-size: 11px;
  color: var(--text-secondary);
}

.typeSelect {
  height: 16px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.typeSelect:focus,
.typeSelect:active,
.typeSelect:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: var(--border-color);
}

.exportBtn {
  flex-shrink: 0;
  margin-top: 12px;
}
</style>
