<template>
  <div class="art-page">
    <div class="art-note">按类别筛选选中图层，同名分组统一改名。为需要修改的分组填写新名称后点应用。</div>

    <div :class="$style.cats">
      <button
        v-for="c in cats"
        :key="c.value"
        type="button"
        class="art-pill"
        :class="{ active: selectedCats.indexOf(c.value) !== -1 }"
        @click="toggleCat(c.value)"
      >
        {{ c.label }}
      </button>
    </div>

    <div :class="$style.list">
      <div v-if="groups.length === 0" class="art-note">（在画布中选择图层，这里会按同名分组列出）</div>

      <div v-for="g in groups" :key="g.name" :class="$style.row">
        <div :class="$style.rowHead">
          <span :class="$style.oldName">{{ g.name }}</span>
          <span class="art-badge">{{ g.count }} 个</span>
        </div>
        <input v-model="mappingInput[g.name]" type="text" class="art-input" :placeholder="'新名称（留空不改）'" />
      </div>
    </div>

    <button v-if="groups.length" class="art-btn" type="button" @click="runRename">应用命名</button>

    <div v-if="tipText" class="art-tip" :class="tipType">{{ tipText }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import { useResult, useSelectionInfo } from './artBridge';

const cats = [
  { value: 'all', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'instance', label: '实例' },
  { value: 'frame', label: '容器' },
  { value: 'group', label: '分组' },
  { value: 'section', label: '区域' },
];

const selectedCats = ref<string[]>(['all']);
const mappingInput = reactive<Record<string, string>>({});
const { layers } = useSelectionInfo();
const { tipText, tipType } = useResult('rename');

function toggleCat(v: string) {
  if (v === 'all') {
    selectedCats.value = ['all'];
    return;
  }
  const arr = selectedCats.value.filter((c) => c !== 'all');
  const i = arr.indexOf(v);
  if (i === -1) arr.push(v);
  else arr.splice(i, 1);
  selectedCats.value = arr.length ? arr : ['all'];
}

function matchCategory(type: string, category: string): boolean {
  if (category === 'all') return true;
  if (category === 'text') return type === 'TEXT';
  if (category === 'instance') return type === 'INSTANCE' || type === 'COMPONENT';
  if (category === 'frame') return type === 'FRAME' || type === 'COMPONENT_SET';
  if (category === 'section') return type === 'SECTION';
  if (category === 'group') return type === 'GROUP';
  return true;
}

function matchAny(type: string): boolean {
  const c = selectedCats.value;
  if (c.length === 0 || c.indexOf('all') !== -1) return true;
  return c.some((x) => matchCategory(type, x));
}

const groups = computed(() => {
  const map: Record<string, number> = {};
  const order: string[] = [];
  layers.value.forEach((l) => {
    if (!matchAny(l.type)) return;
    if (map[l.name] === undefined) {
      map[l.name] = 0;
      order.push(l.name);
    }
    map[l.name]++;
  });
  return order.map((name) => ({ name, count: map[name] }));
});

function runRename() {
  const mapping: Record<string, string> = {};
  Object.keys(mappingInput).forEach((old) => {
    const nv = (mappingInput[old] || '').trim();
    if (nv) mapping[old] = nv;
  });
  sendMsgToPlugin(MessageType.RENAME, { categories: selectedCats.value, mapping });
}
</script>

<style lang="less" module>
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.list {
  flex: 1 1 auto;
  min-height: 80px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  margin-bottom: 6px;
}

.rowHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.oldName {
  font-size: 12px;
  color: var(--ap-text);
  word-break: break-all;
}
</style>
