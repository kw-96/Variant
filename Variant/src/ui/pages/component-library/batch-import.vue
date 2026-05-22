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
        <div v-if="libraryOptions.length" :class="$style.libraryList">
          <label
            v-for="lib in libraryOptions"
            :key="lib"
            :class="[$style.libraryItem, selectedLibraries.includes(lib) && $style.active]"
          >
            <input
              v-model="selectedLibraries"
              type="checkbox"
              :value="lib"
              :class="$style.libraryCheckbox"
            />
            <span>{{ lib }}</span>
          </label>
        </div>
        <div
          v-else-if="!catalogLoading && !libraryOptions.length"
          :class="$style.hintWarn"
        >
          暂无可用团队库条目，请先确认浏览器列表能加载分组
        </div>
        <div v-if="catalogLoadError && !rows.length" :class="$style.hintWarn">
          目录加载超时或失败，请稍后重试
        </div>
      </div>

      <div :class="[$style.fieldBlock, $style.batchListField]">
        <div :class="$style.label">
          批量列表
        </div>
        <van-field
          v-model="linesText"
          type="textarea"
          rows="5"
          :autosize="{ minHeight: 72, maxHeight: 120 }"
          :placeholder="'每行一个资源位，回车分隔\n仅输入序号时，不可选择多渠道导入'"
          :border="false"
          :class="$style.textArea"
        />
      </div>

      <van-button
        :class="$style.importBtn"
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
import { matchCatalogLineToMultiLibraryGroups } from './batchResolve';
import { containsCatalogHiddenKeyword, shouldExcludeBrowseGroup } from './catalogFilters';
import type { ComponentCatalogGroup, ComponentCatalogRow } from './catalogGroup';
import { buildComponentCatalogGroups, descriptionFirstSegment } from './catalogGroup';

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
const selectedLibraries = ref<string[]>([]);
const isImporting = ref(false);

const groupedAll = computed(() => buildComponentCatalogGroups(props.rows));

const visibleGroups = computed(() =>
  groupedAll.value.filter((g) => !shouldExcludeBrowseGroup(g))
);

const libraryOptions = computed(() => {
  const names = new Set<string>();
  visibleGroups.value.forEach((g) => {
    const n = g.category?.trim();
    if (n && !containsCatalogHiddenKeyword(n)) names.add(n);
  });
  return Array.from(names).sort(compareAlphanumeric);
});

watch(
  libraryOptions,
  (opts) => {
    if (!opts.length) {
      selectedLibraries.value = [];
      return;
    }
    const valid = selectedLibraries.value.filter((lib) => opts.includes(lib));
    selectedLibraries.value = valid.length > 0 ? valid : [opts[0]];
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
    selectedLibraries.value.length > 0 &&
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
  if (selectedLibraries.value.length > 1 && hasSequenceOnlyInput(pool)) {
    alert('检测到仅输入序号的行。由于多个渠道可能存在重复序号，请仅选中一个渠道后再导入。');
    return;
  }
  const unresolved: string[] = [];
  const ukeyMap = new Map<string, Set<string>>();

  for (const line of trimmedLines.value) {
    const matched = matchCatalogLineToMultiLibraryGroups(
      line,
      selectedLibraries.value,
      pool
    );
    if (!matched.length) {
      unresolved.push(line);
      continue;
    }
    matched.forEach((g) => {
      const label = g.description || '未命名';
      const libraryLabel = g.category || g.libraryName || '未命名团队库';
      const groupKey = `${libraryLabel}::${label}`;
      let set = ukeyMap.get(groupKey);
      if (!set) {
        set = new Set<string>();
        ukeyMap.set(groupKey, set);
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
    alert(`以下行在已选团队库下未匹配到分组：${preview}`);
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

function hasSequenceOnlyInput(pool: ComponentCatalogGroup[]) {
  const selected = selectedLibraries.value;
  return trimmedLines.value.some((line) =>
    pool.some(
      (g) =>
        (selected.includes(g.category) || selected.includes(g.libraryName)) &&
        g.description.trim() !== line &&
        descriptionFirstSegment(g.description) === line
    )
  );
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

.batchListField {
  flex: 1 1 auto;
  min-height: 0;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
}

.libraryList {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  max-height: 104px;
  overflow-y: auto;
  padding: 0;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-sizing: border-box;
}

.libraryItem {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border-right: 1px solid var(--divider-color);
  border-bottom: 1px solid var(--divider-color);
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.35;
  text-align: center;
  word-break: break-word;
}

.libraryItem:nth-child(2n) {
  border-right: none;
}

.libraryItem.active {
  color: var(--theme-color);
  font-weight: 500;
  background: linear-gradient(
    180deg,
    rgba(25, 137, 250, 0.16) 0%,
    rgba(25, 137, 250, 0.06) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(25, 137, 250, 0.45);
}

.libraryItem.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--theme-color);
}

.libraryCheckbox {
  flex-shrink: 0;
  margin: 0;
  accent-color: var(--theme-color);
}

.textArea {
  flex: 1 1 auto;
  min-height: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--divider-color);
}

.textArea :deep(textarea.van-field__control) {
  box-sizing: border-box;
  line-height: 1.45;
}

.importBtn {
  flex-shrink: 0;
  margin-top: 2px;
}

.hintWarn {
  font-size: 12px;
  color: #ed6a0c;
}
</style>
