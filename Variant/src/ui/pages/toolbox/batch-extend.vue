<template>
  <div :class="$style.container">
    <!-- 返回按钮 -->
    <button :class="$style.backButton" @click="handleBack" title="返回">
      <van-icon name="arrow-left" :class="$style.backIcon" />
    </button>
    <!-- 页面内容 -->
    <div :class="$style.content">
      <van-icon name="setting" :class="$style.icon" />
      <h3>批量延展</h3>
      <p>功能开发中，敬请期待...</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {} from 'vue';

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

// 处理返回按钮点击
function handleBack() {
  emit('back');
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
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  background-color: var(--bg-primary);
  z-index: 10;
}

.backButton {
  position: absolute;
  top: 12px;
  left: 12px;
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
  z-index: 11;
  
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

.content {
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

