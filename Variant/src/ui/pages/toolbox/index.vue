<template>
  <div :class="$style.container">
    <div :class="$style.content">
      <van-icon name="tool" :class="$style.icon" />
      <h3>工具箱</h3>
      <p>更多工具功能敬请期待...</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {} from 'vue';
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
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

