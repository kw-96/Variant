<template>
  <div class="art-page">
    <label class="art-label">选择组件 / 文本图层<span :class="$style.selInfo"> 已选中 <strong>{{ count }}</strong> 个</span></label>

    <div class="art-seg">
      <div class="art-seg-item" :class="{ active: mode === 'text' }" @click="mode = 'text'">文本替换</div>
      <div class="art-seg-item" :class="{ active: mode === 'variant' }" @click="mode = 'variant'">图片替换</div>
      <div class="art-seg-item" :class="{ active: mode === 'name' }" @click="mode = 'name'">图层名</div>
    </div>

    <label class="art-label">属性名称（选填，仅替换该名称的属性）</label>
    <input v-model="propName" type="text" class="art-input" placeholder="留空则替换全部匹配项，例如：奖品名称" />

    <label class="art-label">输入内容（每行一个，按顺序对应）</label>
    <textarea
      v-model="inputText"
      class="art-textarea"
      placeholder="每行输入一个值：&#10;第 1 行 → 第 1 个&#10;第 2 行 → 第 2 个&#10;例如：iQOO Z10x"
    ></textarea>

    <button class="art-btn" type="button" @click="runReplace">一键替换</button>

    <div v-if="tipText" class="art-tip" :class="tipType">{{ tipText }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { MessageType, sendMsgToPlugin } from '../../../messages';
import { useResult, useSelectionInfo } from './artBridge';

const mode = ref<'text' | 'variant' | 'name'>('text');
const propName = ref('');
const inputText = ref('');
const { count } = useSelectionInfo();
const { tipText, tipType } = useResult(['prize', 'common']);

function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function runReplace() {
  const lines = toLines(inputText.value);
  if (mode.value === 'name') {
    sendMsgToPlugin(MessageType.RENAME_LAYERS, { values: lines });
    return;
  }
  sendMsgToPlugin(MessageType.PRIZE_GENERATE, {
    prizeNames: lines,
    scope: mode.value,
    propName: propName.value,
  });
}
</script>

<style lang="less" module>
.selInfo {
  color: var(--ap-text2);
  font-weight: 400;
}

.selInfo strong {
  color: var(--ap-strong);
}
</style>
