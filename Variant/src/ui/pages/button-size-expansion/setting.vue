<template>
  <div :class="$style['setting-container']">
    <!-- 左右切割间距 -->
    <div :class="$style.section">
      <h3 :class="$style['section-title']">左右切割间距（单位px）</h3>

      <van-cell-group :class="$style.inset">
        <van-cell title="左">
          <van-stepper input-width="80" v-model="props.settingData.paddingLeft" />
        </van-cell>
        <van-cell title="右">
          <van-stepper input-width="80" v-model="props.settingData.paddingRight" />
        </van-cell>
      </van-cell-group>
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
</style>
