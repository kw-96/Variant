<template>
  <div :class="$style['cut-container']">
    <SizeConfig
      ref="sizeConfigRef"
      @update:activeConfig="onUpdate"
      :storageKey="STORAGE_KEY.CUT_SIZE"
    />

    <div :class="$style.btns" v-if="activeConfig">
      <template v-if="selectionLength === 1">
        <van-button
          type="primary"
          size="small"
          @click="onCut"
        >
          一键分割
        </van-button>
        <van-button
          type="primary"
          size="small"
          @click="onPreview"
        >
          预览
        </van-button>
      </template>
      <template v-else-if="selectionLength > 1">
        <van-button
          type="default"
          size="small"
          icon="setting"
          :class="$style['setting-btn']"
          @click="onExpandSetting"
        >
          设置
        </van-button>
        <van-button type="primary" size="small" @click="onExpand">
          一键扩展
        </van-button>
      </template>
      <template v-else>
        <van-button
          type="primary"
          size="small"
          disabled
        >
          请先选择元素
        </van-button>
      </template>
    </div>
  </div>

  <Setting
    ref="settingRef"
    :settingData="settingData"
    @onSave="onSaveExpandData"
  />
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import Setting from './module/setting.vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import { getDefaultExpandData } from '../../js/setting/one-click-expand';
import useGlobalStore from '../../store/useGlobalStore';
import SizeConfig from '../../components/size-config.vue';
import { STORAGE_KEY } from '../../js/config/constant';
import useSetting from '../../js/hooks/useSetting';

const { settingData, saveSettingData } = useSetting(
  STORAGE_KEY.CUT_SIZE_EXPANSION_SETTING,
  getDefaultExpandData
);
const globalStore = useGlobalStore();

const settingRef = ref();
const sizeConfigRef = ref();

const selectionLength = ref(0);
const activeConfig = ref();

async function init() {
  watch(
    () => globalStore.selection,
    () => {
      selectionLength.value = globalStore.selection.length;
    },
    { immediate: true }
  );
}

function onCut() {
  sendMsgToPlugin(MessageType.ONE_CLICK_CUT, {
    platform: activeConfig.value.platform,
    options: activeConfig.value.options.filter(item => item.checked),
  });
}

function onExpand() {
  sendMsgToPlugin(MessageType.ONE_CLICK_EXPAND, {
    platform: activeConfig.value.platform,
    options: activeConfig.value.options.filter(item => item.checked),
    expandData: settingData.value,
  });
}

function onPreview () {
  sendMsgToPlugin(MessageType.GEN_EXPAND_PREVIEW, {
    sizes: activeConfig.value.options.filter(item => item.checked),
  });
}

function onExpandSetting() {
  settingRef.value.show = true;
}

function onSaveExpandData() {
  settingRef.value.show = false;
  saveSettingData(settingData.value);
}

const onUpdate = val => {
  activeConfig.value = val;
};

init();
</script>

<style lang="less" module>
.cut-container {
  padding-bottom: 40px;
}

.btns {
  position: fixed;
  left: 20px;
  right: 20px;
  bottom: 10px;

  :global(.van-button):not(:first-child) {
    margin-left: 8px;
  }

  .setting-btn {
    position: absolute;
    left: 0;
  }
}
</style>
