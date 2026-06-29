<template>
  <div :class="$style.pageRoot">
  <div :class="$style.container">
    <div :class="$style.searchBarRow">
      <div :class="$style.searchGrow">
        <van-search
          v-model="searchValue"
          placeholder="搜索名称或关键词"
          shape="round"
          clearable
          :class="$style.searchBar"
          @clear="handleClear"
        />
      </div>
      <van-button
        type="primary"
        plain
        size="small"
        :class="$style.batchBtn"
        @click="handleGoBatchImport"
      >
        批量导入
      </van-button>
    </div>

    <!-- 动态标签栏 (定高隐藏 + 下拉框) -->
    <div :class="[$style.tagSection, showDropdown && $style.tagSectionElevated]">
      <!-- 常驻显示的标签栏 (限制高度，溢出隐藏) -->
      <div :class="$style.tagBar">
        <div :class="$style.tagList">
          <div
            v-for="tag in tagList"
            :key="tag.id"
            :class="[$style.tagItem, tag.id === activeTag && $style.active]"
            @click="handleTagClick(tag.id)"
          >
            {{ tag.name }}
          </div>
        </div>
        <!-- 展开/收起按钮 -->
        <button :class="$style.expandBtn" @click="toggleDropdown">
          {{ showDropdown ? '收起' : '展开' }}
        </button>
      </div>

      <!-- 下拉框 (显示所有标签) -->
      <div v-if="showDropdown" :class="$style.dropdown" @click.stop>
        <div :class="$style.dropdownContent">
          <div
            v-for="tag in tagList"
            :key="tag.id"
            :class="[$style.tagItem, tag.id === activeTag && $style.active]"
            @click="handleTagClick(tag.id)"
          >
            {{ tag.name }}
          </div>
        </div>
      </div>
    </div>

    <CatalogGroupList
      v-model:selected-keys="selectedGroupKeys"
      :groups="filteredGroups"
      :loading="isLoading"
      :loading-text="loadingText"
      :empty-text="getEmptyText()"
    />

    <!-- 导入按钮 -->
    <div :class="$style.actionBar">
      <van-button
        type="primary"
        block
        :disabled="selectedGroupKeys.length === 0 || isImporting"
        :loading="isImporting"
        loading-text="导入中..."
        @click="handleImport"
      >
        立即导入
      </van-button>
    </div>
    <div v-if="showDropdown" :class="$style.dropdownOverlay" @click="showDropdown = false"></div>
  </div>

  <van-popup
    v-model:show="showBatchImportPopup"
    position="center"
    round
    :teleport="false"
    :close-on-click-overlay="true"
    :style="{
      width: 'calc(100vw - 32px)',
      height: 'calc(100vh - 32px)',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      boxSizing: 'border-box'
    }"
  >
    <BatchImportPanel
      v-if="showBatchImportPopup"
      :rows="componentList"
      :catalog-loading="isLoading"
      :catalog-load-error="loadError"
      @close="showBatchImportPopup = false"
    />
  </van-popup>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ComponentLibrary'
};
</script>

<script lang="ts" setup>
import { computed, ref, onMounted, onBeforeUnmount, onUnmounted, inject, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';
import { useComponentCatalog } from '../../hooks/useComponentCatalog';
import useComponentCatalogStore from '../../store/useComponentCatalogStore';
import { shouldExcludeBrowseGroup } from './catalogFilters';
import BatchImportPanel from './batch-import.vue';
import CatalogGroupList from './CatalogGroupList.vue';

interface Tag {
  id: string;
  name: string;
}

const showBatchImportPopup = ref(false);

const searchValue = ref('');
const showDropdown = ref(false);
const activeTag = ref('all');
const selectedGroupKeys = ref<string[]>([]);
const isImporting = ref(false);

const { componentList, isLoading, loadingText, loadError } = useComponentCatalog();
const catalogStore = useComponentCatalogStore();
const { groups: groupedComponentList, libraryTags } = storeToRefs(catalogStore);

const activeMainNav = inject<Ref<number>>('activeMainNav');
const componentLibraryNavIndex = inject<number>('componentLibraryNavIndex', 3);

watch(
  () => activeMainNav?.value,
  (idx) => {
    if (idx !== undefined && idx !== componentLibraryNavIndex) {
      showDropdown.value = false;
      showBatchImportPopup.value = false;
    }
  }
);

onBeforeUnmount(() => {
  showDropdown.value = false;
  showBatchImportPopup.value = false;
});

// 动态生成标签列表（标签名已在 store 中预计算）
const tagList = computed<Tag[]>(() => [
  { id: 'all', name: '全部' },
  ...libraryTags.value.map((tag) => ({ id: tag, name: tag }))
]);

// 筛选分组
const filteredGroups = computed(() => {
  return groupedComponentList.value.filter((group) => {
    if (shouldExcludeBrowseGroup(group)) {
      return false;
    }

    const tagMatch = activeTag.value === 'all' || group.category === activeTag.value;
    const searchMatch = group.description
      .toLowerCase()
      .includes(searchValue.value.toLowerCase());
    return tagMatch && searchMatch;
  });
});

function getEmptyText() {
  if (loadError.value) return '加载超时或失败，请向开发者反馈问题';
  return componentList.value.length === 0 ? '未找到团队库，请检查团队库订阅（快捷键：Ctrl+Alt+4。团队库中激活所需库后，再打开组件库）' : '暂无符合条件的团队库';
}

function handleClear() {
  searchValue.value = '';
}

function handleGoBatchImport() {
  showBatchImportPopup.value = true;
}

function handleTagClick(tagId: string) {
  if (activeTag.value === tagId) {
    showDropdown.value = false;
    return;
  }
  activeTag.value = tagId;
  showDropdown.value = false;
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function handleImport() {
  if (selectedGroupKeys.value.length === 0) return;
  
  isImporting.value = true;
  
  // 按描述分组收集组件 ukey
  const descriptionGroups = new Map<string, string[]>();
  
  // 1. 收集用户选中的组件，并记录涉及的团队库
  const selectedLibraries = new Set<string>();
  groupedComponentList.value.forEach(group => {
    if (selectedGroupKeys.value.indexOf(group.key) !== -1) {
      const description = group.description || '未命名';
      if (!descriptionGroups.has(description)) {
        descriptionGroups.set(description, []);
      }
      group.components.forEach(comp => {
        descriptionGroups.get(description)!.push(comp.ukey);
        // 记录涉及的团队库
        if (comp.category || comp.libraryName) {
          selectedLibraries.add(comp.category || comp.libraryName);
        }
      });
    }
  });

  // 2. 为每个涉及的团队库自动添加"背景"、"LOGO"、"IP"、"主题"描述的组件集
  // 使用"库名::描述"格式，以便为不同团队库导入不同的必需组件集
  // 【临时禁用】不自动导入必需组件集
  /*
  const addedDescriptions = new Set(descriptionGroups.keys());
  const requiredDescriptions = ['背景', 'LOGO', 'IP', '主题'];
  
  selectedLibraries.forEach(libraryName => {
    requiredDescriptions.forEach(requiredDesc => {
      // 使用"库名::描述"格式作为key
      const libraryDescriptionKey = `${libraryName}::${requiredDesc}`;
      
      // 如果该描述还没有被添加，则查找该团队库对应的必需组件集
      if (!addedDescriptions.has(libraryDescriptionKey)) {
        const matchedComponent = componentList.value.find(comp => 
          comp.type === 'COMPONENT_SET' &&
          comp.description === requiredDesc &&
          (comp.category === libraryName || comp.libraryName === libraryName)
        );
        
        if (matchedComponent) {
          if (!descriptionGroups.has(libraryDescriptionKey)) {
            descriptionGroups.set(libraryDescriptionKey, []);
          }
          descriptionGroups.get(libraryDescriptionKey)!.push(matchedComponent.ukey);
          addedDescriptions.add(libraryDescriptionKey);
        }
      }
    });
  });
  */

  // 转换为数组格式：{ description, ukeys }
  const groups = Array.from(descriptionGroups.entries()).map(([description, ukeys]) => ({
    description,
    ukeys
  }));

  if (groups.length > 0) {
    sendMsgToPlugin(MessageType.IMPORT_COMPONENT_BY_UKEY, { groups });
    // 导入状态将在收到导入完成消息后清除
  } else {
    isImporting.value = false;
  }
}

// 消息监听清理函数
let importCompleteListener: (() => void) | null = null;

onMounted(() => {
  importCompleteListener = addMessageListener(MessageType.IMPORT_COMPONENT_COMPLETE, () => {
    isImporting.value = false;
    selectedGroupKeys.value = [];
  });
});

onUnmounted(() => {
  importCompleteListener?.();
});
</script>

<style lang="less" module>
.pageRoot {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.container {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background-color: var(--bg-secondary);
}

.searchBarRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.searchGrow {
  flex: 1;
  min-width: 0;
}

.batchBtn {
  flex-shrink: 0;
  white-space: nowrap;
}

.searchBar {
  /* 覆盖 Vant 搜索框内部样式 */
  :global {
    .van-search {
      background-color: transparent;
      padding: 0;
    }
    .van-search__content {
      background-color: transparent;
      padding-left: 0;
    }
    .van-field__left-icon {
      margin-right: var(--van-padding-base);
      margin-left: var(--van-padding-base);
    }
  }
}

.tagSection {
  position: relative;
  z-index: 10;
}

.tagSectionElevated {
  z-index: 110;
}

.tagBar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  position: relative;
}

.tagList {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  flex: 1;
  /* 限制高度为一行的高度，溢出隐藏，不横向滚动 */
  height: 26px; 
  overflow: hidden;
}

.tagItem {
  /* 纯文本样式 */
  border: none;
  background: transparent;
  padding: 4px 0;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  transition: all 0.2s;
  position: relative;
  white-space: nowrap;

  &.active {
    color: var(--theme-color);
    font-weight: 500;
    
    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--theme-color);
        border-radius: 1px;
    }
  }
  
  &:hover:not(.active) {
      color: var(--text-primary);
  }
}

.expandBtn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--theme-color);
  font-size: 12px;
  display: flex;
  align-items: center;
  height: 26px; /* 与 tagItem 对齐 */
  white-space: nowrap;
  
  &:hover {
    opacity: 0.8;
  }
}

/* 下拉框样式 */
.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--bg-primary); /* 使用主背景色 */
  border: 1px solid var(--divider-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px;
  margin-top: 4px;
  z-index: 100;
}

.dropdownContent {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.dropdownOverlay {
  position: absolute;
  inset: 0;
  z-index: 80;
  background: transparent;
}

.actionBar {
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}
</style>
