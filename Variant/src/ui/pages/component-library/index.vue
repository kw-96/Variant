<template>
  <div :class="$style.container">
    <!-- 搜索栏 -->
    <div :class="$style.searchBar">
      <van-search
        v-model="searchValue"
        placeholder="搜索组件名称或关键字"
        background="var(--bg-primary)"
        shape="round"
        @update:model-value="handleSearch"
      />
    </div>

    <!-- 动态标签栏 -->
    <div :class="$style.tagSection">
      <div :class="$style.tagList">
        <button
          v-for="tag in visibleTags"
          :key="tag.id"
          :class="[$style.tagItem, tag.id === activeTag && $style.active]"
          @click="handleTagClick(tag.id)"
        >
          {{ tag.name }}
        </button>
        <div v-if="hiddenTagCount > 0" :class="$style.tagMore">
          <span>+{{ hiddenTagCount }}</span>
        </div>
      </div>
      <button :class="$style.expandBtn" @click="handleExpandTags">
        {{ showAllTags ? '收起' : '展开' }}
      </button>
    </div>

    <!-- 组件列表 -->
    <div :class="$style.listWrapper">
      <div
        v-for="component in filteredComponents"
        :key="component.id"
        :class="$style.card"
      >
        <div :class="$style.cardHeader">
          <van-checkbox
            :name="component.id"
            v-model="selectedIds"
            :label="component.name"
          />
          <span :class="$style.cardTag">{{ component.tagName }}</span>
        </div>
        <p :class="$style.cardDesc">{{ component.description }}</p>
      </div>
      <div v-if="filteredComponents.length === 0" :class="$style.empty">
        暂无符合条件的组件
      </div>
    </div>

    <!-- 导入按钮 -->
    <div :class="$style.actionBar">
      <van-button
        type="primary"
        block
        :disabled="selectedIds.length === 0"
        @click="handleImport"
      >
        导入已选组件（{{ selectedIds.length }}）
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';

const searchValue = ref('');
const showAllTags = ref(false);
const activeTag = ref('all');
const selectedIds = ref<string[]>([]);

const tagList = [
  { id: 'all', name: '全部' },
  { id: 'button', name: '按钮' },
  { id: 'card', name: '卡片' },
  { id: 'nav', name: '导航' },
  { id: 'list', name: '列表' },
  { id: 'popup', name: '弹窗' },
];

const componentList = [
  { id: '1', name: '主按钮', description: '品牌色主按钮', tag: 'button', tagName: '按钮' },
  { id: '2', name: '次按钮', description: '线框样式二级按钮', tag: 'button', tagName: '按钮' },
  { id: '3', name: '资讯卡片', description: '图文组合信息卡片', tag: 'card', tagName: '卡片' },
  { id: '4', name: '底部导航', description: '三项底部导航栏', tag: 'nav', tagName: '导航' },
  { id: '5', name: '弹窗框体', description: '标准提示弹窗', tag: 'popup', tagName: '弹窗' },
];

const visibleTags = computed(() => showAllTags.value ? tagList : tagList.slice(0, 4));
const hiddenTagCount = computed(() => Math.max(tagList.length - visibleTags.value.length, 0));

const filteredComponents = computed(() => {
  return componentList.filter(item => {
    const tagMatch = activeTag.value === 'all' || item.tag === activeTag.value;
    const searchMatch = item.name.includes(searchValue.value);
    return tagMatch && searchMatch;
  });
});

function handleSearch() {
  // TODO: 搜索结果可接入真实数据
}

function handleTagClick(tagId: string) {
  activeTag.value = tagId;
}

function handleExpandTags() {
  showAllTags.value = !showAllTags.value;
}

function handleImport() {
  // TODO: 后续接入真实导入逻辑
}
</script>

<style lang="less" module>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
}

.searchBar {
  padding-bottom: 4px;
}

.tagSection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tagList {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.tagItem {
  border: 1px solid var(--divider-color);
  border-radius: 16px;
  padding: 4px 12px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;

  &.active {
    border-color: var(--button-primary-bg);
    color: var(--button-primary-bg);
    background: rgba(50, 150, 250, 0.1);
  }
}

.tagMore {
  min-width: 40px;
  text-align: center;
  color: var(--text-secondary);
}

.expandBtn {
  border: none;
  background: var(--input-bg);
  padding: 4px 10px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--text-secondary);
}

.listWrapper {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card {
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cardTag {
  font-size: 12px;
  color: var(--text-secondary);
}

.cardDesc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px 0;
}

.actionBar {
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}
</style>

