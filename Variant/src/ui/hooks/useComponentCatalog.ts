import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import useComponentCatalogStore from '../store/useComponentCatalogStore';

/**
 * 组件库目录：读取 Pinia 全局缓存，切换 Tab 不再重复 loading。
 */
export function useComponentCatalog() {
  const store = useComponentCatalogStore();
  const { components, isLoading, loadError } = storeToRefs(store);

  onMounted(() => {
    store.ensureLoaded();
  });

  return {
    componentList: components,
    isLoading,
    loadingText: computed(() => '加载组件库中...'),
    loadError,
    requestCatalog: () => store.ensureLoaded()
  };
}
