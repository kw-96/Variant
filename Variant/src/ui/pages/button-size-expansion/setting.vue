<template>
  <div :class="$style['setting-container']">
    <!-- 左右切割间距 -->
    <div :class="$style.section">
      <h3 :class="$style['section-title']">左右切割间距（单位px）</h3>

      <div :class="$style.inset">
        <div :class="$style.row">
          <div :class="$style.label">左</div>
          <van-stepper input-width="80" v-model="props.settingData.paddingLeft" />
        </div>
        <div :class="$style.row">
          <div :class="$style.label">右</div>
          <van-stepper input-width="80" v-model="props.settingData.paddingRight" />
        </div>
      </div>
    </div>

    <!-- 中部规则 -->
    <!-- <div :class="$style.section">
      <h3 :class="$style['section-title']">中部规则</h3>
      <van-dropdown-menu>
        <van-dropdown-item v-model="localState.middleRule" :options="options" />
      </van-dropdown-menu>
    </div> -->

    <!-- 保存按钮 -->
    <div :class="$style['button-container']">
      <van-button type="primary" block @click="onSave"> 保存此设置 </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps({
  settingData: {
    type: Object,
    required: true,
    default: () => ({})
  },
});

const emit = defineEmits(['onSave', 'close']);

function onSave() {
  emit('onSave');
  emit('close');
}
</script>

<style lang="less" module>
.setting-container {
  padding: 16px;
  .inset {
    border-radius: 12px;
    background: var(--input-bg);
    padding: 12px;
  }
  .title-style {
    flex: 0;
  }
}

.section {
  margin-bottom: 20px;

  .section-title {
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 12px;
    text-align: left;
  }
}

.input-label {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

:deep(.van-field) {
  background-color: var(--input-bg);
  border-radius: 4px;
  padding: 4px 8px;

  .van-field__control {
    height: 24px;
    min-height: 24px;
  }
}

:global(.van-cell__title) {
  text-align: left;
}

.button-container {
  margin-top: 32px;

  :deep(.van-button) {
    height: 40px;
    border-radius: 4px;
  }
}

.van-row {
  margin: 0 -8px;
  .van-col {
    padding: 0 8px;
  }
}

.row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 80px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--divider-color);
  &:last-child { border-bottom: none; }
}

.label {
  width: 28px;
  flex-shrink: 0;
  text-align: left;
  color: var(--text-secondary);
}
</style>
