<template>
  <div :class="$style.home">
    <section :class="$style.section">
      <div :class="$style.sectionTitle">快捷操作</div>
      <div :class="$style.list">
        <van-button
          v-for="tool in quickActions"
          :key="tool.key"
          size="small"
          type="primary"
          :class="$style.toolButton"
          @click="emit('tool', tool.key)"
        >
          {{ tool.label }}
        </van-button>
      </div>
    </section>

    <section :class="$style.section">
      <div :class="$style.sectionTitle">实用工具</div>
      <div :class="$style.list">
        <van-button
          v-for="tool in utilityTools"
          :key="tool.key"
          size="small"
          type="primary"
          :class="$style.toolButton"
          @click="emit('tool', tool.key)"
        >
          {{ tool.label }}
        </van-button>
      </div>
    </section>

    <div :class="$style.placeholder">
      <p>更多工具功能陆续上线，欢迎持续关注。</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'tool', key: string): void;
}>();

const quickActions = [
  { key: 'auto-add-component', label: '填充组件' },
  { key: 'auto-layout', label: '自动排列' },
  { key: 'round-to-integer', label: '整数像素' },
  { key: 'simple-constraint', label: '简单约束' },
  { key: 'batch-convert-to-component', label: '批量组件' },
];

const utilityTools = [
  { key: 'batch-extend', label: '批量延展' },
  { key: 'batch-button', label: '批量按钮' },
  { key: 'data-flow', label: '数据流' },
  { key: 'batch-rename', label: '批量命名' },
  { key: 'batch-switch-instance', label: '批量切换实例' },
];
</script>

<style lang="less" module>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  padding: 12px 0;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1d2129);
  padding-bottom: 10px;
}

.list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toolButton {
  flex: 1;
  min-width: calc(50% - 4px);
  border-radius: 6px;
  font-size: 14px;
  justify-content: center;
  padding: 0 12px;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary, #8c8c8c);
  padding: 24px;
}

p {
  margin: 0;
  font-size: 13px;
}
</style>
