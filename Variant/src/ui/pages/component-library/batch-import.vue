<template>
  <div :class="$style.wrapper">
    <div :class="$style.panelHeader">
      <span :class="$style.panelTitle">批量导入</span>
      <button type="button" :class="$style.closeBtn" @click="emit('close')">
        关闭
      </button>
    </div>
    <div :class="$style.container">
      <div :class="$style.fieldBlock">
        <van-dropdown-menu v-if="libraryDropdownOptions.length" :class="$style.dropdown">
          <van-dropdown-item v-model="selectedLibrary" :options="libraryDropdownOptions" />
        </van-dropdown-menu>
        <div
          v-else-if="!catalogLoading && !libraryDropdownOptions.length"
          :class="$style.hintWarn"
        >
          暂无可用团队库条目，请先确认浏览器列表能加载分组
        </div>
        <div v-if="catalogLoadError && !rows.length" :class="$style.hintWarn">
          目录加载超时或失败，请稍后重试
        </div>
      </div>

      <div :class="$style.fieldBlock">
        <div :class="$style.label">
          批量列表（回车换行；支持序号或完整组件描述）
        </div>
        <van-field
          v-model="linesText"
          type="textarea"
          rows="12"
          autosize
          placeholder="每行一条序号或完整描述，回车分隔"
          :border="false"
          :class="$style.textArea"
        />
      </div>

      <van-button
        type="primary"
        block
        :disabled="!canImport"
        :loading="isImporting"
        loading-text="导入中..."
        @click="handleBatchImport"
      >
        立即导入
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';
import { compareAlphanumeric } from '../../utils/common';
import { matchCatalogLineToGroups } from './batchResolve';
import { containsCatalogHiddenKeyword, shouldExcludeBrowseGroup } from './catalogFilters';
import type { ComponentCatalogRow } from './catalogGroup';
import { buildComponentCatalogGroups } from './catalogGroup';

const props = defineProps<{
  /** 与列表页同源的团队库扁平数据 */
  rows: ComponentCatalogRow[];
  /** 列表是否在拉取组件库目录 */
  catalogLoading: boolean;
  /** 列表页是否出现加载超时等情况 */
  catalogLoadError?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const linesText = ref('');
const selectedLibrary = ref('');
const isImporting = ref(false);

const groupedAll = computed(() => buildComponentCatalogGroups(props.rows));

const visibleGroups = computed(() =>
  groupedAll.value.filter((g) => !shouldExcludeBrowseGroup(g, props.rows))
);

const libraryDropdownOptions = computed(() => {
  const names = new Set<string>();
  visibleGroups.value.forEach((g) => {
    const n = g.category?.trim();
    if (n && !containsCatalogHiddenKeyword(n)) names.add(n);
  });
  return Array.from(names)
    .sort(compareAlphanumeric)
    .map((lib) => ({ text: lib, value: lib }));
});

watch(
  libraryDropdownOptions,
  (opts) => {
    if (!opts.length) {
      selectedLibrary.value = '';
      return;
    }
    const ok = opts.some((o) => o.value === selectedLibrary.value);
    if (!ok) selectedLibrary.value = opts[0].value;
  },
  { immediate: true }
);

const trimmedLines = computed(() =>
  linesText.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
);

const canImport = computed(
  () =>
    !!selectedLibrary.value &&
    trimmedLines.value.length > 0 &&
    !props.catalogLoading &&
    !isImporting.value
);

let importDoneListener: (() => void) | null = null;

onMounted(() => {
  importDoneListener = addMessageListener(MessageType.IMPORT_COMPONENT_COMPLETE, () => {
    isImporting.value = false;
  });
});

onUnmounted(() => {
  importDoneListener?.();
});

/**
 * 将多行名称解析为导入分组并发送主线程。
 */
function handleBatchImport() {
  if (!canImport.value) return;
  const pool = visibleGroups.value;
  const unresolved: string[] = [];
  const ukeyMap = new Map<string, Set<string>>();

  for (const line of trimmedLines.value) {
    const matched = matchCatalogLineToGroups(line, selectedLibrary.value, pool);
    if (!matched.length) {
      unresolved.push(line);
      continue;
    }
    matched.forEach((g) => {
      const label = g.description || '未命名';
      let set = ukeyMap.get(label);
      if (!set) {
        set = new Set<string>();
        ukeyMap.set(label, set);
      }
      g.components.forEach((c) => {
        if (c.ukey) set!.add(String(c.ukey));
      });
    });
  }

  if (unresolved.length) {
    const preview =
      unresolved.length > 8
        ? `${unresolved.slice(0, 8).join('、')} 等`
        : unresolved.join('、');
    alert(`以下行在所选团队库下未匹配到分组：${preview}`);
    if (!ukeyMap.size) return;
  }

  const groups = [...ukeyMap.entries()].map(([description, set]) => ({
    description,
    ukeys: [...set]
  }));

  if (!groups.length) return;

  isImporting.value = true;
  sendMsgToPlugin(MessageType.IMPORT_COMPONENT_BY_UKEY, { groups });
}
</script>

<style lang="less" module>
.wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
}

.panelHeader {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--divider-color);
}

.panelTitle {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.closeBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--theme-color);
  font-size: 14px;
  padding: 4px 8px;
}

.container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  box-sizing: border-box;
  background-color: var(--bg-secondary);
}

.fieldBlock {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
}

.dropdown :global(.van-dropdown-menu__bar) {
  height: 42px;
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--divider-color);
}

.textArea {
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--divider-color);
}

.hintWarn {
  font-size: 12px;
  color: #ed6a0c;
}
</style>
