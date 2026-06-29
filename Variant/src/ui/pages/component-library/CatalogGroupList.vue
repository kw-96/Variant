<template>
  <div ref="listRef" :class="$style.listWrapper" @scroll="onScroll">
    <van-loading v-if="loading" type="spinner" vertical color="#1989fa">
      {{ loadingText }}
    </van-loading>

    <template v-else>
      <van-checkbox-group :model-value="selectedKeys" @update:model-value="emit('update:selectedKeys', $event)">
        <div
          v-for="group in visibleItems"
          :key="group.key"
          :class="$style.card"
        >
          <div :class="$style.cardHeader" @click="toggleKey(group.key)">
            <van-checkbox :name="group.key" shape="square" @click.stop />
            <span :class="$style.cardTitle">{{ group.description || '无描述' }}</span>
          </div>
          <div :class="$style.cardFooter">
            <span :class="$style.libraryName">{{ group.libraryName }}</span>
          </div>
        </div>
      </van-checkbox-group>
      <div v-if="!groups.length" :class="$style.empty">{{ emptyText }}</div>
      <div v-else-if="hasMore" :class="$style.loadMoreHint">继续下滑加载更多...</div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { toRef, ref, watch } from 'vue';
import { useWindowedList } from '../../hooks/useWindowedList';
import type { ComponentCatalogGroup } from './catalogGroup';

const props = defineProps<{
  groups: ComponentCatalogGroup[];
  selectedKeys: string[];
  loading: boolean;
  loadingText: string;
  emptyText: string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedKeys', value: string[]): void;
}>();

const groupsRef = toRef(props, 'groups');
const listRef = ref<HTMLElement | null>(null);
const { visibleItems, hasMore, onScroll } = useWindowedList(groupsRef, 48);

watch(
  () => props.groups,
  () => {
    listRef.value?.scrollTo({ top: 0 });
  }
);

/** 切换卡片选中状态 */
function toggleKey(key: string) {
  const next = props.selectedKeys.includes(key)
    ? props.selectedKeys.filter((item) => item !== key)
    : [...props.selectedKeys, key];
  emit('update:selectedKeys', next);
}
</script>

<style lang="less" module>
.listWrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.card {
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  :global(.van-checkbox) {
    flex-shrink: 0;
  }
}

.cardTitle {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  font-size: 13px;
}

.cardFooter {
  display: flex;
  justify-content: flex-start;
  padding-left: 28px;
}

.libraryName {
  font-size: 10px;
  color: var(--text-disabled);
}

.empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px 0;
  font-size: 14px;
}

.loadMoreHint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 8px 0 4px;
}
</style>
