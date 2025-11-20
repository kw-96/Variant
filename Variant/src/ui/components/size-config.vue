<template>
  <ConfigSelector
    :configs="configs"
    :activeConfig="activeConfig"
    :editMode="editMode"
    :disabled="disabled"
    @switch-platform="onSwitchPlatform"
    @remove-config="removeStandard"
    @add-config="onAddStandard"
  >
    <template #default="{ config, editMode: slotEditMode, disabled: slotDisabled }">
      <StandardSize
        :class="$style.container"
        :config="config"
        :disabled="slotDisabled"
        :editMode="slotEditMode"
      />
    </template>
  </ConfigSelector>
</template>

<script lang="ts" setup>
import ConfigSelector from './ConfigSelector.vue';
import useStandardConfigs from '../hooks/useStandardConfigs';
import { usePopup } from '../hooks/usePopup';
import AddSizeConfig from './add-size-config.vue';
import StandardSize from './standard-size.vue';
import { watch } from 'vue';

// Props
const props = defineProps({
  configs: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  editMode: {
    type: Boolean,
    default: false,
  },
  storageKey: {
    type: String,
    default: '__common_size_config__',
  },
});

const emit = defineEmits(['update:activeConfig']);

// Popup
const { showPopup } = usePopup() as any;

// Hooks: 优先使用传入的 configs，否则从 storage 获取
const {
  configs,
  activeConfig,
  switchPlatform,
  addStandard,
  removeStandard,
} = useStandardConfigs(props.storageKey, props.configs, props.editMode);

watch(
  () => activeConfig.value,
  now => {
    emit('update:activeConfig', now);
  },
  {
    deep: true,
    immediate: true,
  }
);

// Handlers
const onSwitchPlatform = (config: any) => {
  switchPlatform(config);
};

const onAddStandard = () => {
  showPopup(
    AddSizeConfig,
    {
      title: '添加规范',
      storageKey: props.storageKey,
    },
    {
      onSave: newConfig => {
        addStandard(newConfig);
      },
    }
  );
};

defineExpose({
  getValues: () => {
    return activeConfig.value.options.filter(item => item.checked);
  },
});
</script>

<style lang="less" module>
.container {
  background: var(--bg-primary);
}
</style>