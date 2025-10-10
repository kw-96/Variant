<template>
  <div class="button-expansion p-4">
    <SizeConfig
      ref="sizeConfigRef"
      @update:activeConfig="onUpdate"
      :storageKey="STORAGE_KEY.BUTTON_SIZE"
    />
    <div :class="$style.blocks" v-if="activeConfig">
      <div :class="$style.operations">
        <van-button
          :class="$style.setting"
          round
          @click="showConfig"
          size="small"
        >
          <van-icon name="setting-o" /> 扩展规则设置
        </van-button>
        <van-button
          :class="$style.setting"
          round
          @click="onPreview"
          type="primary"
        >
          预览
        </van-button>
        <van-button
          :class="$style.setting"
          round
          @click="confirm"
          type="primary"
        >
          扩展尺寸生成
        </van-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '@/messages';
import SizeConfig from '@/ui/components/size-config.vue';
import Setting from './setting.vue';
import { usePopup } from '@/ui/js/hooks/usePopup';
import { STORAGE_KEY } from '@/ui/js/config/constant';
import { getDefaultExpandData } from '@/ui/js/setting/button-size-expansion';
import useSetting from '@/ui/js/hooks/useSetting';

const { settingData, saveSettingData } = useSetting(
  STORAGE_KEY.BUTTON_SIZE_EXPANSION_SETTING,
  getDefaultExpandData
);
const { showPopup } = usePopup();
const activeConfig = ref(null);

const showConfig = () => {
  showPopup(
    Setting,
    {
      title: '拓展规则',
      settingData,
    },
    {
      onSave: () => {
        saveSettingData(settingData.value);
      },
    }
  );
};

const sizeConfigRef = ref(null);

const confirm = () => {
  const sizes = sizeConfigRef.value.getValues().map(item => {
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
  sendMsgToPlugin(MessageType.GEN_BUTTON_PREVIEW, {
    config: settingData.value,
    sizes: sizeConfigRef.value.getValues(),
  });
}

const onUpdate = val => {
  activeConfig.value = val;
};
</script>

<style lang="less" module>
.blocks {
  position: fixed;
  width: 100%;
  .operations {
    display: flex;
    align-items: center;
    margin: 0 12px;
    justify-content: space-between;
  }
}

.setting {
}
</style>
