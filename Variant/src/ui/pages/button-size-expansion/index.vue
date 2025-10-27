<template>
  <div :class="$style['button-expansion']">
    <SizeConfig
      ref="sizeConfigRef"
      @update:activeConfig="onUpdate"
      :storageKey="STORAGE_KEY.BUTTON_SIZE"
    />
    
    <div :class="$style.btns" v-if="activeConfig">
      <van-button
        type="default"
        size="small"
        icon="setting"
        :class="$style['setting-btn']"
        @click="showConfig"
      >
        设置
      </van-button>
      <van-button
        type="primary"
        size="small"
        @click="onPreview"
      >
        预览
      </van-button>
      <van-button
        type="primary"
        size="small"
        @click="confirm"
      >
        生成
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import SizeConfig from '../../components/size-config.vue';
import Setting from './setting.vue';
import { usePopup } from '../../../../../shared-ui/hooks/usePopup';
import useSetting from '../../../../../shared-ui/hooks/useSetting';

import { STORAGE_KEY } from '../../js/config/constant';
import { getDefaultExpandData } from '../../js/setting/button-size-expansion';

const { settingData, saveSettingData } = useSetting(
  STORAGE_KEY.BUTTON_SIZE_EXPANSION_SETTING,
  getDefaultExpandData
);
const { showPopup } = usePopup() as any;
const activeConfig = ref<any>(null);

const showConfig = () => {
  showPopup(
    Setting,
    {
      title: '拓展规则',
      settingData,
    },
    {
      onSave: () => {
        if (settingData.value) {
          saveSettingData(settingData.value);
        }
      },
    }
  );
};

const sizeConfigRef = ref<any>(null);

const confirm = () => {
  if (!sizeConfigRef.value) return;
  const sizes = sizeConfigRef.value.getValues().map((item: any) => {
    return {
      width: item.width,
      height: item.height,
      name: item.name,
    };
  });
  sendMsgToPlugin(MessageType.AUTO_GENERATE_BUTTONS, {
    config: settingData.value,
    sizes,
  });
};

const onPreview = () => {
  if (!sizeConfigRef.value) return;
  sendMsgToPlugin(MessageType.GEN_BUTTON_PREVIEW, {
    config: settingData.value,
    sizes: sizeConfigRef.value.getValues(),
  });
}

const onUpdate = (val: any) => {
  activeConfig.value = val;
};
</script>

<style lang="less" module>
.button-expansion {
  padding-bottom: 40px;
}

.btns {
  position: fixed;
  left: 90px;
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
