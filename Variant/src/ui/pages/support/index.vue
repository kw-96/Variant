<template>
  <div :class="$style.container">
    <!-- 动态标签栏 (定高隐藏 + 下拉框) -->
    <div :class="$style.tagSection">
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
      <div v-if="showDropdown" :class="$style.dropdown">
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
      <!-- 遮罩层 (点击关闭下拉框) -->
      <div v-if="showDropdown" :class="$style.mask" @click="showDropdown = false"></div>
    </div>

    <!-- 组件分组列表 -->
    <div :class="$style.listWrapper">
      <van-loading v-if="isLoading" type="spinner" vertical color="#1989fa">
        {{ loadingText }}
      </van-loading>
      
      <template v-else>
        <van-checkbox-group v-model="selectedGroupKeys">
          <div
            v-for="group in filteredGroups"
            :key="group.key"
            :class="$style.card"
          >
            <div :class="$style.cardHeader">
              <van-checkbox
                :name="group.key"
                shape="square"
              >
                {{ group.description || '无描述' }}
              </van-checkbox>
            </div>
            <div :class="$style.cardFooter">
               <span :class="$style.libraryName">{{ group.libraryName }}</span>
            </div>
          </div>
        </van-checkbox-group>
        <div v-if="filteredGroups.length === 0" :class="$style.empty">
          {{ getEmptyText() }}
        </div>
      </template>
    </div>

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
  </div>
</template>

<script lang="ts">
export default {
  name: 'SupportPage'
};
</script>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';
import { compareAlphanumeric } from '../../utils/common';
import { useComponentCatalog } from '../../hooks/useComponentCatalog';

interface ComponentInfo {
  id: string;
  name: string;
  ukey: string;
  description: string;
  type: string;
  cover: string;
  width: number;
  height: number;
  libraryName: string;
  category: string;
}

interface ComponentGroup {
  key: string; // 唯一标识
  description: string;
  category: string;
  components: ComponentInfo[];
  cover: string;
  libraryName: string;
}

interface Tag {
  id: string;
  name: string;
}

const showDropdown = ref(false);
const activeTag = ref('');
const selectedGroupKeys = ref<string[]>([]);
const isImporting = ref(false);

const { componentList, isLoading, loadingText, loadError } = useComponentCatalog();

// 需要显示的关键词（仅匹配团队库名）
const targetKeywords = ['在线游戏', '新游预约'];

// 检查是否包含目标关键词
function containsTargetKeyword(text: string): boolean {
  return targetKeywords.some(keyword => text.includes(keyword));
}

// 按 库名 分组组件
const groupedComponentList = computed<ComponentGroup[]>(() => {
  const groups: Record<string, ComponentGroup> = {};
  
  componentList.value.forEach(comp => {
    const desc = comp.description ? comp.description.trim() : '';
    // 生成唯一Key：库名::描述
    const uniqueKey = `${comp.category}::${desc}`;
    
    if (!groups[uniqueKey]) {
      groups[uniqueKey] = {
        key: uniqueKey,
        description: desc,
        category: comp.category, // 这里的 category 已经是库名
        components: [],
        cover: comp.cover,
        libraryName: comp.libraryName
      };
    }
    
    groups[uniqueKey].components.push(comp);
    
    // 如果当前组封面为空，且当前组件有封面，则更新
    if (!groups[uniqueKey].cover && comp.cover) {
      groups[uniqueKey].cover = comp.cover;
    }
  });

  const list = Object.keys(groups).map((key) => groups[key]);
  list.forEach((g) => {
    g.components.sort((c1, c2) => compareAlphanumeric(c1.name || '', c2.name || ''));
  });
  list.sort((g1, g2) => {
    const lib1 = g1.libraryName || g1.category || '';
    const lib2 = g2.libraryName || g2.category || '';
    const byLib = compareAlphanumeric(lib1, lib2);
    if (byLib !== 0) return byLib;
    return compareAlphanumeric(g1.description || '', g2.description || '');
  });
  return list;
});

// 动态生成标签列表（基于分组分类/库名，只显示包含目标关键词的）
const tagList = computed<Tag[]>(() => {
  const tags = new Set<string>();
  groupedComponentList.value.forEach(group => {
    if (group.category && containsTargetKeyword(group.category)) {
      tags.add(group.category);
    }
  });
  
  const dynamicTags = Array.from(tags).sort(compareAlphanumeric).map(tag => ({
    id: tag,
    name: tag
  }));

  return dynamicTags;
});

// 筛选分组（只显示包含目标团队库关键词且有描述的分组）
const filteredGroups = computed(() => {
  return groupedComponentList.value.filter(group => {
    if (!containsTargetKeyword(group.category)) {
      return false;
    }
    if (!group.description || group.description.trim() === '') {
      return false;
    }
    const tagMatch = !activeTag.value || activeTag.value === '' || group.category === activeTag.value;
    return tagMatch;
  });
});

function getEmptyText() {
  if (loadError.value) return '加载超时或失败，请向开发者反馈问题';
  return componentList.value.length === 0 ? '未找到团队库，请检查团队库订阅（快捷键：Ctrl+Alt+4。团队库中激活所需库后，再打开组件库）' : '暂无符合条件的团队库';
}

function handleTagClick(tagId: string) {
  activeTag.value = tagId;
  showDropdown.value = false; // 选择后关闭下拉框
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
          (comp.category === libraryName || comp.libraryName === libraryName) &&
          containsTargetKeyword(comp.category)
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
    sendMsgToPlugin(MessageType.IMPORT_COMPONENT_BY_UKEY, { groups, skipConvert: true });
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
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background-color: var(--bg-secondary);
}

.tagSection {
  position: relative; /* 为下拉框定位 */
  z-index: 10;
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

/* 遮罩层 */
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90; /* 在下拉框之下 */
  background: transparent; /* 透明遮罩，仅用于点击关闭 */
}

.listWrapper {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px; /* 滚动条空间 */
}

.card {
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;
  
  &:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* Ensure checkbox text handles long descriptions gracefully */
  :global(.van-checkbox__label) {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 8px;
      color: var(--text-primary);
      font-size: 13px;
  }
}

.cardFooter {
    display: flex;
    justify-content: flex-end;
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

.actionBar {
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}
</style>
