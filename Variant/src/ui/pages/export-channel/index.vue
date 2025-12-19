<template>
  <div :class="$style.container">
    <!-- 批量命名区域 -->
    <div :class="$style.batchRenameSection">
      <!-- 首行：左侧文本输入框，右侧下拉选择框 -->
      <div :class="$style.renameRow">
        <van-field
          v-model="renameText"
          :class="$style.renameInput"
          placeholder="请输入要插入的文本"
        />
        <select
          v-model="renamePosition"
          :class="$style.positionSelect"
        >
          <option value="before">在名称前</option>
          <option value="after">在名称后</option>
        </select>
      </div>
      <!-- 第二行：批量命名按钮 -->
      <van-button
        type="primary"
        block
        :class="$style.renameButton"
        @click="handleBatchRename"
        :disabled="!canRename"
      >
        批量命名
      </van-button>
    </div>

    <!-- 导出页面内容 -->
    <div :class="$style.exportContent">
      <Export />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import Export from '../export/index.vue';

// 批量命名相关
const renameText = ref('');
const renamePosition = ref<'before' | 'after'>('before');

// 是否可以重命名
const canRename = computed(() => {
  return renameText.value.trim().length > 0;
});

// 处理批量命名
function handleBatchRename() {
  if (!canRename.value) {
    sendMsgToPlugin(MessageType.SHOW_NOTIFY, {
      message: '请输入要插入的文本',
      timeout: 2000,
    });
    return;
  }

  // 调用批量命名功能，与工具箱中的固定文本功能一致
  const config = {
    mode: 'fixed',
    position: renamePosition.value,
    text: renameText.value.trim(),
  };

  sendMsgToPlugin(MessageType.BATCH_RENAME, config);
}
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.batchRenameSection {
  padding: 12px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.renameRow {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.renameInput {
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  transition: border-color 0.2s;
  
  :global(.van-field__body) {
    padding: 0;
    display: flex;
    align-items: center;
  }
  
  :global(.van-field__control) {
    font-size: 16px;
    height: auto;
    line-height: 1.2;
    padding: 0 8px;
    color: var(--text-secondary);
    
    &::placeholder {
      font-size: 10px;
      color: var(--input-placeholder);
    }
  }
}

.positionSelect {
  width: 120px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: var(--button-primary-bg);
  }
}

.renameButton {
  height: 36px;
  font-size: 14px;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.exportContent {
  flex: 1;
  overflow: hidden;
}
</style>
