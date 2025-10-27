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
            <div :class="$style.tagName">{{ item.name }}</div>
            <div :class="$style.tagInfo">
              {{ item.width }} × {{ item.height }}
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
    >
      导出
    </van-button>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

interface ExportItem {
  name: string;
  width: number;
  height: number;
  checked: boolean;
}

const exportList = ref<ExportItem[]>([]);
const allSelected = ref(false);

// 上传所选
function handleUploadSelection() {
  console.log('上传所选');
  // TODO: 实现上传所选逻辑
}

// 添加所选
function handleAddSelection() {
  console.log('添加所选');
  // TODO: 实现添加所选逻辑
}

// 清空
function handleClearAll() {
  exportList.value = [];
  allSelected.value = false;
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

// 导出
function handleExport() {
  console.log('导出');
  // TODO: 实现导出逻辑
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
}

.tagInfo {
  font-size: 12px;
  color: var(--text-secondary);
}

.exportBtn {
  flex-shrink: 0;
  margin-top: 12px;
}
</style>

