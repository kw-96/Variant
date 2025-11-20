<template>
  <div :class="$style.container">
    <div :class="[$style['platforms'], { [$style.edit]: editMode }]">
      <!-- 渲染配置按钮 -->
      <van-button
        :class="$style.vanButton"
        v-for="config in configs"
        :key="config.id"
        :type="activeConfig?.id === config.id ? 'primary' : 'default'"
        size="small"
        style="margin-right: 8px"
        @click="onSwitchPlatform(config)"
      >
        {{ config.platform }}
        <van-icon
          v-if="editMode && !disabled"
          @click.stop="removeConfig(config)"
          style="margin-left: 4px"
          size="14"
          name="close"
        />
      </van-button>
      
      <van-button 
        v-if="!editMode" 
        :class="$style.addButton"
        round 
        @click="onAddConfig" 
        size="small"
      >
        <van-icon name="setting-o" /> 添加配置
      </van-button>
    </div>
    
    <!-- 显示当前选中的配置内容 -->
    <slot 
      v-if="activeConfig" 
      :config="activeConfig"
      :editMode="editMode"
      :disabled="disabled"
    />
    
    <van-empty
      @click="onAddConfig"
      v-else-if="!editMode"
      image="network"
      description="点击添加新规范"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';

interface ConfigItem {
  id: string;
  platform: string;
  [key: string]: any;
}

interface Props {
  configs: ConfigItem[];
  editMode?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  editMode: false,
  disabled: false,
});

const emit = defineEmits<{
  'switch-platform': [config: ConfigItem];
  'add-config': [];
  'remove-config': [config: ConfigItem];
}>();

const activeConfig = computed(() => {
  return props.configs.find(config => config.id === activeConfigId.value) || props.configs[0];
});

const activeConfigId = ref<string>('');

// 监听configs变化，设置默认选中
watch(() => props.configs, (newConfigs) => {
  if (newConfigs.length > 0 && !activeConfigId.value) {
    activeConfigId.value = newConfigs[0].id;
  }
}, { immediate: true });

const onSwitchPlatform = (config: ConfigItem) => {
  activeConfigId.value = config.id;
  emit('switch-platform', config);
};

const onAddConfig = () => {
  emit('add-config');
};

const removeConfig = (config: ConfigItem) => {
  emit('remove-config', config);
};
</script>

<style lang="less" module>
.container {
  margin-bottom: 20px;
}

.platforms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  
  &.edit {
    .vanButton {
      position: relative;
    }
  }
}

.addButton {
  margin-left: auto;
}
</style>
