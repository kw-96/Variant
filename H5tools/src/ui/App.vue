<template>
  <div>
    <van-tabs v-model:active="active">
      <van-tab v-for="(item, idx) in pageList" :key="idx" :title="item.name">
        <div :class="$style.container">
          <component v-if="active === idx" :is="item.component" />
        </div>
      </van-tab>
    </van-tabs>
    <!-- 全局弹窗 -->
    <van-popup
      v-model:show="isVisible"
      position="bottom"
      :style="{
        height: '90%',
        background: '#f7f8fa',
        ...(props.popupStyle || {}),
      }"
    >
      <div :class="$style.titleBar">
        <h3>{{ props.title }}</h3>
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
import { providePopup } from '@/ui/js/hooks/usePopup';
import Cut from '@/ui/pages/cut/index.vue';
import ButtonSizeExpansion from '@/ui/pages/button-size-expansion/index.vue';
import { MessageType, addMessageListener } from '@/messages';
import useGlobalStore from '@/ui/store/useGlobalStore';

// 提供全局弹窗实例
const { isVisible, component, props, listeners, hidePopup } =
  providePopup();
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
.container {
  padding-top: 12px;
}

.titleBar {
  display: flex;
  padding: 12px;
  justify-content: space-between;
  border-bottom: 1px solid #ececec;
}
</style>
