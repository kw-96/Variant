<template>
  <div :class="$style.appContainer">
    <!-- 左侧导航栏 -->
    <div :class="$style.navSidebar">
      <div
        v-for="(navItem, navIdx) in navList"
        :key="navIdx"
        :class="[$style.navItem, { [$style.active]: activeNav === navIdx }]"
        @click="activeNav = navIdx"
      >
        {{ navItem.name }}
      </div>
      <!-- 显隐安全区按钮 -->
      <div
        :class="[$style.safeAreaBtn, { [$style.active]: safeAreaVisible && hasSafeArea }]"
        @click="handleToggleSafeArea"
        :title="hasSafeArea ? (safeAreaVisible ? '隐藏安全区' : '显示安全区') : '请选中包含安全区的容器'"
      >
        <span :class="$style.btnText">
          <span :class="$style.btnLine">显/隐</span>
          <span :class="$style.btnLine">安全区</span>
        </span>
      </div>
    </div>
    <!-- 右侧内容区 -->
    <div :class="$style.contentArea">
      <!-- 有子标签时显示标签栏 -->
      <template v-if="currentPageList.length > 0">
        <van-tabs :key="activeNav" v-model:active="activeSubTab" :class="$style.tabs">
          <van-tab v-for="(item, idx) in currentPageList" :key="idx" :title="item.name">
            <div :class="$style.tabContent">
              <component :is="item.component" />
            </div>
          </van-tab>
        </van-tabs>
      </template>
      <!-- 无子标签时直接显示内容 -->
      <template v-else>
        <div :class="$style.singleContent">
          <component :is="currentSinglePage" />
        </div>
      </template>
    </div>
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
import { ref, computed, watch } from 'vue';
import { providePopup } from './hooks/usePopup';
import Cut from './pages/cut/index.vue';
import ButtonSizeExpansion from './pages/button-size-expansion/index.vue';
import Create from './pages/create/index.vue';
import Export from './pages/export/index.vue';
import CreatePrototype from './pages/create-prototype/index.vue';
import ExtendChannel from './pages/extend-channel/index.vue';
import Toolbox from './pages/toolbox/index.vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../messages';
import useGlobalStore from './store/useGlobalStore';

// 提供全局弹窗实例
const { isVisible, component, props, listeners, hidePopup } =
  providePopup();

// 局部类型断言，解决 TypeScript 类型检查问题
type PopupProps = { title?: string; popupStyle?: Record<string, any> } & Record<string, any>;
const popupProps = props as unknown as PopupProps;

const globalStore = useGlobalStore();

// 主导航索引
const activeNav = ref(0); // 默认选中资源位
// 子标签索引
const activeSubTab = ref(0);

// 导航列表配置
const navList = [
  {
    name: '资源位',
    pages: [
      {
        name: '创建',
        component: Create,
      },
      {
        name: '导出',
        component: Export,
      },
    ], 
  },
  {
    name: 'H5切图',
    pages: [
      {
        name: 'H5一键切图',
        component: Cut,
      },
      {
        name: '按钮尺寸拓展',
        component: ButtonSizeExpansion,
      },
    ],
  },
  {
    name: 'H5延展',
    pages: [
      {
        name: '创建原型',
        component: CreatePrototype,
      },
      {
        name: '延展渠道',
        component: ExtendChannel,
      },
    ],
  },
  {
    name: '工具箱',
    pages: [], 
  },
];

// 根据当前导航获取对应的页面列表
const currentPageList = computed(() => {
  return navList[activeNav.value].pages || [];
});

// 当没有子标签时显示的单页组件
const currentSinglePage = computed(() => {
  const currentNav = navList[activeNav.value];
  // 如果是工具箱，显示 Toolbox 组件
  if (currentNav.name === '工具箱') {
    return Toolbox;
  }
  return null;
});

// 监听页面内标签切换事件
const handleTabChange = (tabIndex: number) => {
  activeSubTab.value = tabIndex;
};

// 将切换函数暴露给子组件
(window as any).__appTabSwitch = handleTabChange;

// 当导航切换时重置子标签
watch(activeNav, () => {
  if (activeSubTab.value > 0 && currentPageList.value.length > 0) {
    activeSubTab.value = 0;
  }
});

addMessageListener(MessageType.SELECTION_CHANGE, data => {
  globalStore.selection = data;
  // 选择变化时，查询安全区状态
  checkSafeAreaStatus();
});

// 安全区状态
const safeAreaVisible = ref(false);
const hasSafeArea = ref(false);

// 查询安全区状态
function checkSafeAreaStatus() {
  sendMsgToPlugin(MessageType.GET_SAFE_AREA_STATUS);
}

// 切换安全区显示/隐藏
function handleToggleSafeArea() {
  if (!hasSafeArea.value) {
    return;
  }
  sendMsgToPlugin(MessageType.TOGGLE_SAFE_AREA);
}

// 监听安全区状态变化
addMessageListener(MessageType.SAFE_AREA_STATUS, (data: { visible: boolean; hasSafeArea: boolean }) => {
  safeAreaVisible.value = data.visible;
  hasSafeArea.value = data.hasSafeArea;
});

// 初始化时检查安全区状态
checkSafeAreaStatus();
</script>

<style lang="less" module>
.appContainer {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.navSidebar {
  width: 70px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--divider-color);
  display: flex;
  flex-direction: column;
  padding: 0 0 12px 0;
  position: relative;
}

.navItem {
  padding: 12px 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  border-left: 3px solid transparent;
  
  &:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }
  
  &.active {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border-left-color: var(--button-primary-bg);
    font-weight: 500;
  }
}

.safeAreaBtn {
  position: absolute;
  bottom: 12px;
  left: 8px;
  right: 8px;
  padding: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-primary);
  border: 1px solid var(--divider-color);
  
  &:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border-color: var(--button-primary-bg);
  }
  
  &.active {
    background-color: var(--button-primary-bg);
    color: #fff;
    border-color: var(--button-primary-bg);
  }
  
  .btnText {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.2;
    gap: 2px;
  }
  
  .btnLine {
    display: block;
    font-size: 11px;
    white-space: nowrap;
  }
}

.contentArea {
  flex: 1;
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

.singleContent {
  flex: 1;
  overflow-y: auto;
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
