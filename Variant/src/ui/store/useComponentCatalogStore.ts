import { defineStore } from 'pinia';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../messages';
import {
  buildComponentCatalogGroups,
  type ComponentCatalogGroup,
  type ComponentCatalogRow
} from '../pages/component-library/catalogGroup';
import { buildCatalogLibraryTags } from '../pages/component-library/catalogTags';

let loadTimeout: ReturnType<typeof setTimeout> | null = null;
let listenerRegistered = false;

function clearLoadTimeout() {
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }
}

/**
 * 组件库目录全局状态：跨 Tab 复用数据，避免重复 loading 与重复拉取。
 */
export default defineStore('componentCatalog', {
  state: () => ({
    components: [] as ComponentCatalogRow[],
    groups: [] as ComponentCatalogGroup[],
    libraryTags: [] as string[],
    isLoading: false,
    loadError: false,
    hydrated: false
  }),
  actions: {
    /** 注册一次目录消息监听 */
    initListener() {
      if (listenerRegistered) return;
      listenerRegistered = true;
      addMessageListener(MessageType.GET_COMPONENT_LIBRARY, (data: unknown) => {
        this.applyPayload(data);
      });
    },

    applyPayload(data: unknown) {
      const payload = data as { components?: ComponentCatalogRow[]; fromCache?: boolean };
      if (payload && Array.isArray(payload.components)) {
        this.components = payload.components;
      } else if (Array.isArray(data)) {
        this.components = data as ComponentCatalogRow[];
      } else {
        this.components = [];
      }
      this.groups = buildComponentCatalogGroups(this.components);
      this.libraryTags = buildCatalogLibraryTags(this.groups);
      this.hydrated = true;
      this.isLoading = false;
      this.loadError = false;
      clearLoadTimeout();
    },

    /**
     * 确保目录已加载：已有数据则直接复用；否则向插件请求（插件侧会先返缓存再后台刷新）。
     */
    ensureLoaded() {
      this.initListener();
      if (this.hydrated) {
        this.isLoading = false;
        return;
      }
      this.isLoading = true;
      this.loadError = false;
      clearLoadTimeout();
      loadTimeout = setTimeout(() => {
        if (!this.hydrated && this.isLoading) {
          this.isLoading = false;
          this.loadError = true;
        }
      }, 8000);
      sendMsgToPlugin(MessageType.GET_COMPONENT_LIBRARY, { backgroundRefresh: true });
    }
  }
});
