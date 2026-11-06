<template>
  <div :class="[$style.appContainer, { [$style.collapsed]: isCollapsed }]">
    <template v-if="!hasEnteredWorkspace">
      <PluginAccessDenied
        :current-user-name="authSettings.currentUserName"
        :current-user-id="authSettings.currentUserId"
        :remote-unavailable="remoteAdminSettingsUnavailable"
      />
    </template>
    <template v-else>
    <!-- 小窗口状态：只显示导航 -->
    <template v-if="isCollapsed">
      <div :class="$style.collapsedNav">
        <div
          v-for="(navItem, navIdx) in navList"
          :key="navIdx"
          :class="$style.collapsedNavItem"
          @click="handleNavClickInCollapsed(navIdx)"
        >
          {{ navItem.name }}
        </div>
      </div>
    </template>
    
    <!-- 常规状态：完整布局 -->
    <template v-else>
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
        <!-- 明暗模式切换 -->
        <div
          :class="[$style.safeAreaBtn, { [$style.active]: isDark }]"
          @click="toggleTheme"
          :title="isDark ? '切换浅色模式' : '切换深色模式'"
        >
          <span :class="$style.btnText">
            <span :class="$style.btnLine">{{ isDark ? '浅色' : '深色' }}</span>
            <span :class="$style.btnLine">模式</span>
          </span>
        </div>
        <!-- 收起按钮 -->
        <div
          :class="$style.collapseBtn"
          @click="handleCollapse"
          title="收起窗口"
        >
          <span :class="$style.btnText">收起</span>
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
      <!-- 无子 Tab：离开页面时卸载，避免隐藏态仍占用 DOM / 遮罩拦截点击 -->
      <template v-else>
        <div :class="$style.singleContent">
          <div
            v-if="componentLibraryMounted"
            v-show="activeNav === SINGLE_PAGE_NAV.componentLibrary"
            :class="$style.singlePageLayer"
          >
            <ComponentLibrary />
          </div>
          <div
            v-if="activeNav === SINGLE_PAGE_NAV.toolbox"
            :class="$style.singlePageLayer"
          >
            <Toolbox />
          </div>
          <div
            v-if="activeNav === SINGLE_PAGE_NAV.h5Replace"
            :class="$style.singlePageLayer"
          >
            <H5Replace />
          </div>
        </div>
      </template>
      </div>
      <!-- 右下角拖拽手柄：自由拉伸窗口宽高 -->
      <div :class="$style.resizeHandle" @pointerdown="onResizeStart" title="拖拽调整窗口大小"></div>
    </template>
    </template>
    
    <!-- 全局弹窗 -->
    <van-popup
      v-if="hasEnteredWorkspace"
      v-model:show="isVisible"
      position="bottom"
      :style="{
        height: '90%',
        background: 'var(--bg-secondary)',
        ...(popupProps.popupStyle || {}),
      }"
    >
      <div :class="$style.popupContainer">
        <div :class="$style.titleBar">
          <h3>{{ popupProps.title }}</h3>
          <van-icon class="pointer" size="16" @click="hidePopup" name="revoke" />
        </div>
        <div :class="$style.popupContent">
          <component
            v-if="isVisible"
            :is="component"
            @close="hidePopup"
            v-bind="props"
            v-on="listeners"
          />
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, provide } from 'vue';
import { providePopup } from './hooks/usePopup';
import H5Replace from './pages/art/h5-replace.vue';
import ArtChannelExport from './pages/art/channel-export.vue';
import Create from './pages/create/index.vue';
import Design from './pages/design/index.vue';
import ExportChannel from './pages/export-channel/index.vue';
import Support from './pages/support/index.vue';
import Toolbox from './pages/toolbox/index.vue';
import ComponentLibrary from './pages/component-library/index.vue';
import useComponentCatalogStore from './store/useComponentCatalogStore';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../messages';
import PluginAccessDenied from './auth/PluginAccessDenied.vue';
import { usePluginAuth } from './auth/usePluginAuth';
import storage from './utils/storage';
import { THEME_STORAGE_KEY, getSystemTheme, applyTheme as applyThemeToDocument } from './utils/theme';

// 提供全局弹窗实例
const { isVisible, component, props, listeners, hidePopup } =
  providePopup();

// 局部类型断言，解决 TypeScript 类型检查问题
type PopupProps = { title?: string; popupStyle?: Record<string, any> } & Record<string, any>;
const popupProps = props as unknown as PopupProps;

const { settings: authSettings, remoteAdminSettingsUnavailable, loadSyncSettings } = usePluginAuth();
const hasEnteredWorkspace = ref(false);

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
        component: ArtChannelExport,
      },
    ], 
  },
  {
    name: '商店图',
    pages: [
      {
        name: '设计',
        component: Design,
      },
      {
        name: '导出',
        component: ExportChannel,
      },
      {
        name: '配套',
        component: Support,
      },
    ],
  },
  {
    name: '组件库',
    pages: [],
  },
  {
    name: 'H5',
    pages: [],
  },
  {
    name: '工具箱',
    pages: [], 
  },
];

/** 无子 Tab 的单页主导航索引 */
const SINGLE_PAGE_NAV = {
  componentLibrary: 2,
  h5Replace: 3,
  toolbox: 4,
} as const;

/** 首次进入组件库后保活实例，避免二次挂载全量 DOM */
const componentLibraryMounted = ref(false);

watch(
  activeNav,
  (idx) => {
    if (idx === SINGLE_PAGE_NAV.componentLibrary) {
      componentLibraryMounted.value = true;
    }
  },
  { immediate: true }
);

provide('activeMainNav', activeNav);
provide('componentLibraryNavIndex', SINGLE_PAGE_NAV.componentLibrary);

// 根据当前导航获取对应的页面列表
const currentPageList = computed(() => {
  return navList[activeNav.value].pages || [];
});

// 监听页面内标签切换事件
const handleTabChange = (tabIndex: number) => {
  activeSubTab.value = tabIndex;
};

// 切换导航和子标签的函数
const setActiveNavAndTab = (navIndex: number, subTabIndex: number = 0) => {
  activeNav.value = navIndex;
  activeSubTab.value = subTabIndex;
};

// 将切换函数暴露给子组件
(window as any).__appTabSwitch = handleTabChange;
(window as any).__appSetNav = setActiveNavAndTab;

// 当导航切换时重置子标签
watch(activeNav, () => {
  if (activeSubTab.value > 0 && currentPageList.value.length > 0) {
    activeSubTab.value = 0;
  }
});

// 窗口收起状态
const isCollapsed = ref(false);

// 明暗模式：识别系统主题自动切换；用户手动切换后记住，下次打开还原
// themeMode：'system' 跟随系统；'dark'/'light' 为用户手动固定
const isDark = ref(true);
const themeMode = ref<'system' | 'dark' | 'light'>('system');
let systemThemeMql: MediaQueryList | null = null;

// 主题写入统一走 utils/theme，避免与插件消息形成双来源
function applyTheme(theme: 'dark' | 'light') {
  applyThemeToDocument(theme);
  isDark.value = theme === 'dark';
}

// 用户手动切换：固定并记住主题
function toggleTheme() {
  const next: 'dark' | 'light' = isDark.value ? 'light' : 'dark';
  themeMode.value = next;
  applyTheme(next);
  void storage.setAsync(THEME_STORAGE_KEY, next);
}

// 系统主题变化：仅在「跟随系统」模式下自动切换
function onSystemThemeChange() {
  if (themeMode.value === 'system') {
    applyTheme(getSystemTheme());
  }
}

async function initTheme() {
  // 监听系统主题变化
  try {
    systemThemeMql = window.matchMedia('(prefers-color-scheme: dark)');
    if (systemThemeMql.addEventListener) {
      systemThemeMql.addEventListener('change', onSystemThemeChange);
    } else if ((systemThemeMql as any).addListener) {
      (systemThemeMql as any).addListener(onSystemThemeChange);
    }
  } catch {}

  // 读取已记住的主题：有手动记录则还原，否则跟随系统
  try {
    const saved = await storage.getAsync(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      themeMode.value = saved;
      applyTheme(saved);
      return;
    }
  } catch {}
  themeMode.value = 'system';
  applyTheme(getSystemTheme());
}

// 右下角拖拽自由拉伸窗口（复刻原插件）
// 用 rAF 合并高频 pointermove，避免每次移动都发一条 IPC
let resizing = false;
let resizeRaf: number | null = null;
let pendingResize: { width: number; height: number } | null = null;
function flushResize() {
  resizeRaf = null;
  if (!pendingResize) return;
  sendMsgToPlugin(MessageType.RESIZE_WINDOW, pendingResize);
  pendingResize = null;
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return;
  pendingResize = {
    width: Math.max(300, Math.floor(e.clientX + 6)),
    height: Math.max(320, Math.floor(e.clientY + 6)),
  };
  if (resizeRaf === null) resizeRaf = requestAnimationFrame(flushResize);
}
function onResizeEnd() {
  resizing = false;
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }
  if (pendingResize) flushResize();
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
}
function onResizeStart(e: PointerEvent) {
  resizing = true;
  e.preventDefault();
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd);
}

// 标签栏高度动态测量：避免硬编码 44px 在缩放 / 边框变化时裁切
const TABS_NAV_FALLBACK = 44;
let tabsNavObserver: ResizeObserver | null = null;
function bindTabsNavHeight() {
  const nav = document.querySelector('.van-tabs__wrap') as HTMLElement | null;
  if (!nav) {
    document.documentElement.style.setProperty('--tabs-nav-height', TABS_NAV_FALLBACK + 'px');
    return;
  }
  const sync = () => {
    const height = Math.ceil(nav.getBoundingClientRect().height) || TABS_NAV_FALLBACK;
    document.documentElement.style.setProperty('--tabs-nav-height', height + 'px');
  };
  sync();
  tabsNavObserver?.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    tabsNavObserver = new ResizeObserver(sync);
    tabsNavObserver.observe(nav);
  }
}

async function autoCheckAccess() {
  try {
    const settings = await loadSyncSettings();
    hasEnteredWorkspace.value = !!settings.canAccessPlugin;
  } catch (error: unknown) {
    hasEnteredWorkspace.value = false;
    const message = error instanceof Error ? error.message : '鉴权失败，请稍后重试。';
    console.warn(message);
  }
}

watch(hasEnteredWorkspace, (ok) => {
  if (ok) {
    useComponentCatalogStore().initListener();
    nextTick(bindTabsNavHeight);
  }
});

onMounted(() => {
  autoCheckAccess();
  initTheme();
  nextTick(bindTabsNavHeight);
});

onUnmounted(() => {
  if (systemThemeMql) {
    if (systemThemeMql.removeEventListener) {
      systemThemeMql.removeEventListener('change', onSystemThemeChange);
    } else if ((systemThemeMql as any).removeListener) {
      (systemThemeMql as any).removeListener(onSystemThemeChange);
    }
  }
  tabsNavObserver?.disconnect();
  tabsNavObserver = null;
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }
});

// 处理小窗口状态下的导航点击
function handleNavClickInCollapsed(navIdx: number) {
  activeNav.value = navIdx;
  // 展开窗口
  isCollapsed.value = false;
  sendMsgToPlugin(MessageType.EXPAND_WINDOW);
}

// 处理收起按钮点击
function handleCollapse() {  isCollapsed.value = true;
  // 等待渲染后测量小窗口高度，并请求主线程调整窗口尺寸
  nextTick(() => {
    try {
      const collapsedNavEl = document.querySelector('[class*="collapsedNav"]') as HTMLElement | null;
      const desiredHeight = Math.ceil((collapsedNavEl?.getBoundingClientRect().height || 0) + 24); // 额外留白
      const desiredWidth = 88; // 与左侧导航宽度一致
      sendMsgToPlugin(MessageType.COLLAPSE_WINDOW, { width: desiredWidth, height: desiredHeight });
    } catch {
      sendMsgToPlugin(MessageType.COLLAPSE_WINDOW, { width: 88 });
    }
  });
}

// 监听窗口状态变化
addMessageListener(MessageType.WINDOW_STATE_CHANGED, (data: { collapsed: boolean }) => {
  isCollapsed.value = data.collapsed;
});
</script>

<style lang="less" module>
.appContainer {
  height: 100vh;
  display: flex;
  overflow: hidden;
  border-top: 1px solid var(--border-color);
}

// 收起状态样式：不强制宽度，由主线程 resize 控制 iframe 尺寸
.collapsed { display: block; }

.navSidebar {
  width: 88px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--divider-color);
  display: flex;
  flex-direction: column;
  padding: 0 0 12px 0;
  position: relative;
}

.navItem {
  padding: 12px 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  white-space: nowrap;
  border-left: 3px solid transparent;
  
  &:hover {
    background-color: var(--input-bg);
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
  bottom: 50px;
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
  background-color: var(--input-bg);
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

.collapseBtn {
  position: absolute;
  bottom: 12px;
  left: 8px;
  right: 8px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  border-radius: 4px;
  background-color: var(--input-bg);
  border: 1px solid var(--divider-color);
  
  &:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    border-color: var(--button-primary-bg);
  }
  
  .btnText {
    display: block;
    white-space: nowrap;
  }
}

// 小窗口状态样式
.collapsedNav {
  width: 100%;
  padding: 0 0 12px 0; // 与 .navSidebar 一致
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
}

.collapsedNavItem {
  padding: 12px 8px; // 与 .navItem 一致
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 13px; // 与 .navItem 一致
  text-align: center;
  border-left: 3px solid transparent; // 与 .navItem 一致
  
  &:hover {
    background-color: var(--input-bg);
    color: var(--text-primary);
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
    /* 硬锁高度：不依赖 vant .van-tabs 根的 flex 高度传递（此环境不可靠）。
     * 标签栏高度由 App.vue 的 bindTabsNavHeight 动态测量写入 --tabs-nav-height，
     * 兜底 44px。内部页面据此获得确定高度以实现独立滚动。
     * 注意：此处不做滚动容器，避免与内部 .list 形成两层滚动导致滚轮归属不稳。 */
    height: calc(100vh - var(--tabs-nav-height, 44px));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* 不依赖 :has()：显式撑满当前标签面板，使内部 flex:1 滚动区（如资源位导出列表）获得确定高度 */
  :global(.van-tabs__content > .van-tab__panel) {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.tabContent {
  padding: 12px;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.singleContent {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.singlePageLayer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.titleBar {
  display: flex;
  align-items: center;
  padding: 12px;
  justify-content: space-between;
  border-bottom: 1px solid var(--divider-color);
  background-color: var(--input-bg);
  color: var(--text-primary);
  
  h3 {
    margin: 0;
    padding: 0;
    line-height: 1;
    display: flex;
    align-items: center;
  }
}

.resizeHandle {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 1000;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 7px;
    height: 7px;
    border-right: 2px solid var(--text-secondary);
    border-bottom: 2px solid var(--text-secondary);
  }
}
</style>
