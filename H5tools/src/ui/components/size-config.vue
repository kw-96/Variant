<template>
  <div v-if="configs && configs.length">
    <div :class="[$style['platforms'], { [$style.edit]: editMode }]">
      <!-- 渲染配置按钮 -->
      <van-button
        :class="$style.vanButton"
        v-for="(config, idx) in configs"
        :key="config.id"
        :type="activeConfig.id === config.id ? 'primary' : 'default'"
        size="small"
        style="margin-right: 8px"
        @click="onSwitchPlatform(config)"
      >
        {{ config.platform }}
        <van-icon
          v-if="editMode && !disabled"
          @click.stop="removeStandard(config)"
          style="margin-left: 4px"
          size="14"
          name="close"
        />
      </van-button>
      <div :class="$style.operation" v-if="!editMode">
        <van-button v-if="!editMode" round @click="onAddStandard" size="small">
          <van-icon name="setting-o" /> 规范设置
        </van-button>
      </div>
    </div>
    <!-- 显示当前选中的规范 -->
    <StandardSize
      :editMode="editMode"
      :disabled="disabled"
      v-if="activeConfig"
      :config="activeConfig"
    />
  </div>
  <van-empty
    @click="onAddStandard"
    v-else-if="!editMode"
    image="network"
    description="点击添加新规范"
  />
</template>

<script lang="ts" setup>
import { useStandardConfigs } from '@/ui/js/hooks/useStandardConfigs';
import AddSizeConfig from '@/ui/components/add-size-config.vue';
import StandardSize from '@/ui/components/standard-size.vue';
import { usePopup } from '@/ui/js/hooks/usePopup';
import { onMounted, watch } from 'vue';

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
const { showPopup } = usePopup();

// Hooks: 优先使用传入的 configs，否则从 storage 获取
const {
  configs,
  activeConfig,
  isExternalConfig,
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
      title: '规范设置',
      popupStyle: {
        background: '#ffff',
      },
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
.platforms {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  overflow-y: auto;
  white-space: nowrap;
  padding: 0 12px;
  margin-right: 100px;
  margin-top: 12px;
  &.edit {
    margin-right: 12px;
  }
  .vanButton {
    position: relative;
    .remove {
      position: absolute;
      right: 0;
      top: 0;
    }
  }
  .operation {
    position: absolute;
    right: 12px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    white-space: nowrap;
  }
}
</style>
