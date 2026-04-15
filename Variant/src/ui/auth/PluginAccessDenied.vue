<template>
  <div :class="$style.container">
    <div :class="$style.card">
      <h3 :class="$style.title">插件访问鉴权</h3>
      <p :class="$style.description">您未开通插件权限，请联系管理员处理。</p>
      <p :class="$style.identity">当前账号：{{ displayName }} ｜ 用户 ID：{{ displayId }}</p>
      <p v-if="remoteUnavailable" :class="$style.warn">服务器准入配置暂不可用，已自动回退本地白名单。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    currentUserName?: string;
    currentUserId?: string;
    remoteUnavailable?: boolean;
  }>(),
  {
    currentUserName: '',
    currentUserId: '',
    remoteUnavailable: false
  }
);

const displayName = computed(() => String(props.currentUserName || '').trim() || '未知');
const displayId = computed(() => String(props.currentUserId || '').trim() || '未知');
</script>

<style module lang="less">
.container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg-primary);
}

.card {
  width: 100%;
  max-width: 320px;
  background: var(--bg-secondary);
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.description,
.identity,
.warn {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.warn {
  color: #d97706;
}
</style>
