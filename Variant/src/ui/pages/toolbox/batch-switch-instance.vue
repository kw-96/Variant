<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <button :class="$style.backButton" @click="emit('back')" title="返回">
        <van-icon name="arrow-left" />
      </button>
      <div :class="$style.title">批量切换实例</div>
      <button :class="$style.refreshButton" @click="requestData">刷新</button>
    </div>

    <div :class="$style.content">
      <van-loading v-if="loading" type="spinner" vertical>读取中...</van-loading>
      <div v-else-if="message" :class="$style.empty">{{ message }}</div>
      <div v-else-if="instances.length === 0" :class="$style.empty">
        所选容器下没有可切换的实例
      </div>
      <div v-else :class="$style.list">
        <div v-for="item in instances" :key="item.name" :class="$style.row">
          <div :class="$style.instanceName" :title="item.name">{{ item.name }}</div>
          <select v-model="selectedMap[item.name]" :class="$style.select">
            <option value="">不切换</option>
            <option v-for="comp in components" :key="comp.id" :value="comp.id">
              {{ comp.name }}
            </option>
          </select>
          <button
            type="button"
            :class="$style.deleteBtn"
            :disabled="!!deletingName || switching"
            :title="`删除 ${item.name}`"
            @click="handleDelete(item.name)"
          >
            <van-loading v-if="deletingName === item.name" size="16" />
            <span v-else>删除</span>
          </button>
        </div>
      </div>
    </div>

    <div :class="$style.footer">
      <van-button
        type="primary"
        block
        :loading="switching"
        :disabled="!canSwitch"
        @click="handleSwitch"
      >
        立即切换
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useBatchSwitchInstance } from './useBatchSwitchInstance';

const emit = defineEmits<{ (e: 'back'): void }>();

const {
  loading,
  switching,
  deletingName,
  message,
  instances,
  components,
  selectedMap,
  canSwitch,
  requestData,
  handleSwitch,
  handleDelete
} = useBatchSwitchInstance();
</script>

<style lang="less" module>
.page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  z-index: 10;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--divider-color);
}

.backButton,
.refreshButton {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--theme-color);
  padding: 4px 8px;
}

.title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.instanceName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.select {
  width: 38%;
  min-width: 96px;
  height: 32px;
}

.deleteBtn {
  flex-shrink: 0;
  min-width: 44px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #ee0a24;
  border-radius: 6px;
  background: transparent;
  color: #ee0a24;
  font-size: 12px;
  cursor: pointer;
}

.deleteBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-secondary);
}

.footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--divider-color);
  background: var(--bg-primary);
}
</style>
