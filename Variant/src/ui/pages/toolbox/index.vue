<template>
  <div :class="$style.container">
    <div v-if="currentView === 'home'" :class="$style.home">
      <section :class="$style.section">
        <header :class="$style.sectionHeader">
          <div :class="$style.sectionTitle">快捷操作</div>
        </header>
        <div :class="$style.list">
          <van-button
            v-for="tool in quickActions"
            :key="tool.key"
            block
            size="small"
            :class="[$style.toolButton, tool.disabled && $style.disabled]"
            :type="tool.disabled ? 'default' : 'primary'"
            :plain="tool.disabled"
            :disabled="tool.disabled"
            @click="handleToolClick(tool)"
          >
            {{ tool.label }}
          </van-button>
        </div>
      </section>

      <section :class="$style.section">
        <header :class="$style.sectionHeader">
          <div :class="$style.sectionTitle">实用工具</div>
        </header>
        <div :class="$style.list">
          <van-button
            v-for="tool in utilityTools"
            :key="tool.key"
            block
            size="small"
            :class="[$style.toolButton, tool.disabled && $style.disabled]"
            :type="tool.disabled ? 'default' : 'primary'"
            :plain="tool.disabled"
            :disabled="tool.disabled"
            @click="handleToolClick(tool)"
          >
            {{ tool.label }}
          </van-button>
        </div>
      </section>

      <div :class="$style.placeholder">
        <p>更多工具功能陆续上线，欢迎持续关注。</p>
      </div>
    </div>

    <BatchExtend v-else @back="handleBack" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import BatchExtend from './batch-extend.vue';

interface ToolCard {
  key: string;
  label: string;
  handler?: () => void;
  disabled?: boolean;
}

// 当前视图状态：'home' 表示工具箱主页，'batch-extend' 表示批量延展页面
const currentView = ref<'home' | 'batch-extend'>('home');

const quickActions: ToolCard[] = [
  {
    key: 'quick-placeholder',
    label: '快速投放',
    disabled: true,
  },
];

const utilityTools: ToolCard[] = [
  {
    key: 'batch-extend',
    label: '批量延展',
    handler: handleBatchExtend,
  },
  {
    key: 'utility-placeholder',
    label: '更多工具',
    disabled: true,
  },
];

// 处理批量延展按钮点击
function handleBatchExtend() {
  currentView.value = 'batch-extend';
}

// 处理返回按钮点击
function handleBack() {
  currentView.value = 'home';
}

/**
 * 统一处理工具点击
 * @param tool 工具配置
 */
function handleToolClick(tool: ToolCard) {
  if (tool.disabled || !tool.handler) return;
  tool.handler();
}
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
  position: relative;
}

.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  padding: 12px 0;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1d2129);
}

.divider {
  height: 1px;
  background: var(--border-color, rgba(0, 0, 0, 0.08));
  margin: 12px 0;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolButton {
  border-radius: 6px;
  font-size: 14px;
  justify-content: flex-start;
  padding: 0 12px;
}

.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary, #8c8c8c);
  border: 1px dashed var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  padding: 24px;
}

h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>

