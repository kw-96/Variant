<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <button :class="$style.backButton" @click="emit('back')" title="返回">
        <van-icon name="arrow-left" :class="$style.backIcon" />
      </button>
      <div :class="$style.title">实例适配</div>
    </div>
    <div :class="$style.content">
      <div :class="$style.tip">
        直接选中一个或多个实例 → 点击「适配」<br />
        适配：实例宽高设为所属最外层画板 / 组件容器的宽高，约束设为水平、垂直跟随缩放，并贴齐其左上角<br />
        范围：只处理当前选中的实例，不检查名称<br />
        校验：逐个校验尺寸、约束、位置；失败的实例恢复原状并计入跳过，其余照常完成<br />
        名称输入仅用于「按名称选中」，不影响「适配」
      </div>
      <TabInput v-model="instanceName" placeholder="可选：按名称查找实例（完全匹配）" />
      <div :class="$style.actions">
        <van-button
          type="primary"
          :class="$style.actionButton"
          :disabled="!instanceName.trim()"
          @click="handleSelect"
        >
          按名称选中
        </van-button>
        <van-button type="primary" :class="$style.actionButton" @click="handleApply">
          适配
        </van-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import TabInput from '../../components/TabInput.vue';

const emit = defineEmits<{
  back: [];
}>();

const instanceName = ref('');

function handleSelect() {
  const name = instanceName.value.trim();
  if (!name) return;
  sendMsgToPlugin(MessageType.INSTANCE_FIT_SELECT, { name });
}

function handleApply() {
  sendMsgToPlugin(MessageType.INSTANCE_FIT_APPLY);
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
  flex-direction: column;
  background-color: var(--bg-primary);
  z-index: 10;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.backButton {
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

  &:hover {
    background-color: var(--input-bg);
    border-color: var(--button-primary-bg);
  }
}

.backIcon {
  font-size: 16px;
}

.title {
  flex: 1;
  text-align: right;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.content {
  flex: 1;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}

.tip {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 8px;
}

.actionButton {
  flex: 1;
  border-radius: 6px;
  height: 40px;
  font-size: 14px;
}
</style>
