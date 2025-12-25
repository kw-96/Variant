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

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';

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
const activeTag = ref(''); // 初始为空，不选中任何标签
const selectedGroupKeys = ref<string[]>([]); // 存储选中的分组Key
const isLoading = ref(true);
const loadingText = ref('加载组件库中...');
const isImporting = ref(false);
const loadError = ref(false);

const componentList = ref<ComponentInfo[]>([]);

// 需要显示的关键词（只显示包含这些关键词的内容）
const targetKeywords = ['在线游戏', '新游预约'];

// 需要屏蔽的描述关键词（不显示包含这些关键词的内容）
const excludedDescriptionKeywords = ['背景', 'LOGO', 'IP', '主题'];

// 检查是否包含目标关键词
function containsTargetKeyword(text: string): boolean {
  return targetKeywords.some(keyword => text.includes(keyword));
}

// 检查是否包含屏蔽的描述关键词
function containsExcludedDescriptionKeyword(text: string): boolean {
  return excludedDescriptionKeywords.some(keyword => text.includes(keyword));
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
  
  return Object.keys(groups).map(key => groups[key]);
});

// 动态生成标签列表（基于分组分类/库名，只显示包含目标关键词的）
const tagList = computed<Tag[]>(() => {
  const tags = new Set<string>();
  groupedComponentList.value.forEach(group => {
    if (group.category && containsTargetKeyword(group.category)) {
      tags.add(group.category);
    }
  });
  
  const dynamicTags = Array.from(tags).sort().map(tag => ({
    id: tag,
    name: tag
  }));

  return dynamicTags;
});

// 筛选分组（只显示包含目标关键词的分组，排除包含屏蔽描述关键词的分组）
const filteredGroups = computed(() => {
  return groupedComponentList.value.filter(group => {
    // 只显示包含目标关键词的分组
    if (!containsTargetKeyword(group.category) && !containsTargetKeyword(group.description)) {
      return false;
    }
    
    // 排除包含屏蔽描述关键词的分组
    if (containsExcludedDescriptionKeyword(group.description)) {
      return false;
    }
    
    // 如果分组描述为空（"无描述"），检查该分组中的组件是否可能是被屏蔽组件集的内部组件
    // 如果该分组中的所有组件都是COMPONENT类型且描述为空，且category包含目标关键词，
    // 则可能是某个被屏蔽组件集的内部组件，应该隐藏
    if (!group.description || group.description.trim() === '') {
      // 检查该分组中是否有组件集类型的组件
      const hasComponentSet = group.components.some(comp => comp.type === 'COMPONENT_SET');
      // 如果都是普通组件且没有组件集，可能是被屏蔽组件集的内部组件
      if (!hasComponentSet && group.components.length > 0) {
        // 检查是否存在同名的组件集（描述包含屏蔽关键词）
        const hasMatchingComponentSet = componentList.value.some(comp => 
          comp.type === 'COMPONENT_SET' &&
          containsExcludedDescriptionKeyword(comp.description) &&
          containsTargetKeyword(comp.category) &&
          comp.category === group.category
        );
        // 如果存在匹配的组件集，则隐藏该"无描述"分组
        if (hasMatchingComponentSet) {
          return false;
        }
      }
    }
    
    // 如果没有选中标签，显示所有匹配的分组；否则只显示匹配选中标签的分组
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
  
  // 1. 收集用户选中的组件
  groupedComponentList.value.forEach(group => {
    if (selectedGroupKeys.value.indexOf(group.key) !== -1) {
      const description = group.description || '未命名';
      if (!descriptionGroups.has(description)) {
        descriptionGroups.set(description, []);
      }
      group.components.forEach(comp => {
        descriptionGroups.get(description)!.push(comp.ukey);
      });
    }
  });

  // 2. 自动添加"背景"、"LOGO"、"IP"、"主题"描述的组件集
  // 每个描述只添加一套（选择第一个匹配的组件集）
  const addedDescriptions = new Set(descriptionGroups.keys());
  const requiredDescriptions = ['背景', 'LOGO', 'IP', '主题'];
  
  requiredDescriptions.forEach(requiredDesc => {
    // 如果该描述还没有被添加，则查找并添加第一个匹配的组件集
    if (!addedDescriptions.has(requiredDesc)) {
      const matchedComponent = componentList.value.find(comp => 
        comp.type === 'COMPONENT_SET' &&
        comp.description === requiredDesc &&
        containsTargetKeyword(comp.category)
      );
      
      if (matchedComponent) {
        if (!descriptionGroups.has(requiredDesc)) {
          descriptionGroups.set(requiredDesc, []);
        }
        descriptionGroups.get(requiredDesc)!.push(matchedComponent.ukey);
        addedDescriptions.add(requiredDesc);
      }
    }
  });

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
let removeListener: (() => void) | null = null;
let importCompleteListener: (() => void) | null = null;
let loadTimeout: any = null;

onMounted(() => {
  isLoading.value = true;
  loadingText.value = '加载组件库中...';
  loadError.value = false;
  
  // 注册消息监听
  removeListener = addMessageListener(MessageType.GET_COMPONENT_LIBRARY, (data: any) => {
    // 修复：解析插件返回的数据结构 { components: [...] }
    if (data && Array.isArray(data.components)) {
      componentList.value = data.components;
    } else if (Array.isArray(data)) {
      // 兼容直接返回数组的情况
      componentList.value = data;
    } else {
      componentList.value = [];
    }

    isLoading.value = false;
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  });

  // 监听导入完成消息
  importCompleteListener = addMessageListener(MessageType.IMPORT_COMPONENT_COMPLETE, () => {
    isImporting.value = false;
    selectedGroupKeys.value = []; // 清空选择
  });

  // 请求组件数据
  sendMsgToPlugin(MessageType.GET_COMPONENT_LIBRARY);
  
  // 设置超时保护 (3秒)
  loadTimeout = setTimeout(() => {
    if (isLoading.value) {
      isLoading.value = false;
      loadError.value = true;
    }
  }, 3000);
});

onUnmounted(() => {
  if (removeListener) {
    removeListener();
  }
  if (importCompleteListener) {
    importCompleteListener();
  }
  if (loadTimeout) {
    clearTimeout(loadTimeout);
  }
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
