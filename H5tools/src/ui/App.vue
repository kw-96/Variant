<template>
  <div :class="$style.appContainer">
    <van-tabs v-model:active="active" :class="$style.tabs">
      <van-tab v-for="(item, idx) in pageList" :key="idx" :title="item.name">
        <div :class="$style.tabContent">
          <keep-alive>
            <component v-if="active === idx" :is="item.component" />
          </keep-alive>
        </div>
      </van-tab>
    </van-tabs>
    <!-- 全局弹窗 -->
    <van-popup
      v-model:show="isVisible"
      position="bottom"
      :style="{
        height: '90%',
        background: 'var(--bg-secondary)',
        ...(popupProps.popupStyle || {}),
      }"
    >
      <div :class="$style.titleBar">
        <h3>{{ popupProps.title }}</h3>
        <van-icon class="pointer" size="16" @click="hidePopup" name="revoke" />
      </div>
      <component
        v-if="isVisible"
        :is="component"
        @close="hidePopup"
        v-bind="props"
        v-on="listeners"
      />
    </van-popup>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { providePopup } from './js/hooks/usePopup';
import Cut from './pages/cut/index.vue';
import ButtonSizeExpansion from './pages/button-size-expansion/index.vue';
import { MessageType, addMessageListener } from '../messages';
import useGlobalStore from './store/useGlobalStore';

// 提供全局弹窗实例
const { isVisible, component, props, listeners, hidePopup } =
  providePopup();

// 局部类型断言，解决 TypeScript 类型检查问题
type PopupProps = { title?: string; popupStyle?: Record<string, any> } & Record<string, any>;
const popupProps = props as unknown as PopupProps;

const globalStore = useGlobalStore();

const active = ref(0);
const pageList = [
  {
    name: 'H5一键切图',
    component: Cut,
  },
  {
    name: '按钮尺寸拓展',
    component: ButtonSizeExpansion,
  },
];

addMessageListener(MessageType.SELECTION_CHANGE, data => {
  globalStore.selection = data;
});
</script>

<style lang="less" module>
.appContainer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  :global(.van-tabs__wrap) {
    flex-shrink: 0;
  }
  
  :global(.van-tabs__content) {
    flex: 1;
    overflow-y: auto;
  }
}

.tabContent {
  padding: 12px;
  min-height: 100%;
}

.titleBar {
  display: flex;
  padding: 12px;
  justify-content: space-between;
  border-bottom: 1px solid var(--divider-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
</style>
