import { computed, ref, watch, type Ref } from 'vue';

/**
 * 对大列表做分批渲染，滚动接近底部时追加一批。
 */
export function useWindowedList<T>(source: Ref<T[]>, pageSize = 48) {
  const visibleCount = ref(pageSize);

  watch(
    source,
    () => {
      visibleCount.value = pageSize;
    },
    { flush: 'sync' }
  );

  const visibleItems = computed(() => source.value.slice(0, visibleCount.value));
  const hasMore = computed(() => visibleCount.value < source.value.length);

  function loadMore() {
    if (!hasMore.value) return;
    visibleCount.value = Math.min(visibleCount.value + pageSize, source.value.length);
  }

  function onScroll(event: Event) {
    const target = event.target as HTMLElement | null;
    if (!target || !hasMore.value) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 96) {
      loadMore();
    }
  }

  return { visibleItems, hasMore, loadMore, onScroll };
}
