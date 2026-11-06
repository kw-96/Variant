<template>
  <div class="art-page">
    <div class="art-seg">
      <div class="art-seg-item" :class="{ active: mode === 'prize' }" @click="mode = 'prize'">奖品替换</div>
      <div class="art-seg-item" :class="{ active: mode === 'title' }" @click="mode = 'title'">一级标替换</div>
    </div>

    <div class="h5-selrow">
      <div class="art-selbox">已选中 <strong>{{ count }}</strong> 个组件实例</div>
      <button
        v-if="mode === 'title'"
        class="art-btn h5-action-btn"
        type="button"
        @click="runExtract"
      >提取命名</button>
    </div>

    <template v-if="mode === 'prize'">
      <textarea v-model="prizeText" class="art-textarea" placeholder="使用说明：&#10;1.选中需替换的H5奖品组件，按选中顺序每行对应一个奖品。&#10;2.插件按完整名称匹配奖品变体，同步更新命名【奖品名称】图层文本；&#10;3.仅文案更新不算图片替换成功，图片未匹配或切换失败会单独提示；&#10;4.输入更多行会自动补建实例。&#10;&#10;&#10;每行一个目标值，例如：&#10;奖品1&#10;奖品2&#10;奖品3&#10;..."></textarea>
      <button class="art-btn" type="button" @click="runApply">开始替换</button>
    </template>

    <template v-else>
      <textarea v-model="titleText" class="art-textarea" placeholder="在选中组件（含嵌套实例）中查找名为「一级标」的可见文本属性/文本图层，按行逐个替换。&#10;隐藏图层及隐藏父级内的一级标不参与替换，也不会提取命名或占用输入行。&#10;&#10;每行一个一级标文字"></textarea>
      <button class="art-btn" type="button" @click="runTitle">开始替换</button>
    </template>

    <div v-if="tipText" class="art-tip" :class="tipType">{{ tipText }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MessageType, sendMsgToPlugin, addMessageListener } from '../../../messages';
import { useResult, useSelectionInfo } from './artBridge';

const mode = ref<'prize' | 'title'>('prize');
const prizeText = ref('');
const titleText = ref('');
const { count } = useSelectionInfo();
const { tipText, tipType } = useResult(['attr', 'oneclick']);

function toLines(text: string): string[] {
  return text.split('\n');
}

function runApply() {
  sendMsgToPlugin(MessageType.APPLY, { targetValues: toLines(prizeText.value) });
}

function runTitle() {
  sendMsgToPlugin(MessageType.TITLE_REPLACE, { values: toLines(titleText.value) });
}

// 提取命名：读取选中画板中的「一级标」文本，按顺序回填输入框（不改画布）
function runExtract() {
  sendMsgToPlugin(MessageType.TITLE_EXTRACT, {});
}

let removeExtract: (() => void) | null = null;
onMounted(() => {
  removeExtract = addMessageListener(MessageType.TITLE_EXTRACT_RESULT, (data: any) => {
    const lines: string[] = (data && data.lines) || [];
    const unmatched: string[] = (data && data.unmatched) || [];
    titleText.value = lines.join('\n');
    if (unmatched.length) {
      tipType.value = 'warning';
      tipText.value = '已提取 ' + lines.length + ' 个可见一级标；'
        + unmatched.length + ' 个对象未找到可见一级标：' + unmatched.join('、');
    } else {
      tipType.value = 'success';
      tipText.value = '已提取 ' + lines.length + ' 个一级标，可确认或修改后点击开始替换。';
    }
  });
});

onUnmounted(() => {
  removeExtract && removeExtract();
});
</script>
