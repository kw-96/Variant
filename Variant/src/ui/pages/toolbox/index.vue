<template>
  <div :class="$style.container">
    <!-- 顶部按钮区域 -->
    <div :class="$style.buttonBar">
      <van-button
        type="default"
        size="small"
        :class="$style.button"
        @click="handleBatchExtend"
      >
        批量延展
      </van-button>
      <van-button
        type="default"
        size="small"
        :class="$style.button"
      >
      </van-button>
    </div>
    <!-- 工具箱主页内容 -->
    <div v-if="currentView === 'home'" :class="$style.content">
      <van-icon name="tool" :class="$style.icon" />
      <p>更多工具功能敬请期待...</p>
    </div>
    <!-- 批量延展页面（覆盖显示） -->
    <BatchExtend v-if="currentView === 'batch-extend'" @back="handleBack" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import BatchExtend from './batch-extend.vue';

// 当前视图状态：'home' 表示工具箱主页，'batch-extend' 表示批量延展页面
const currentView = ref<'home' | 'batch-extend'>('home');

// 处理批量延展按钮点击
function handleBatchExtend() {
  currentView.value = 'batch-extend';
}

// 处理返回按钮点击
function handleBack() {
  currentView.value = 'home';
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

.buttonBar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.button {
  flex: 1;
  width: 0; // 确保均分宽度
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary);
}

.icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: var(--text-tertiary);
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

