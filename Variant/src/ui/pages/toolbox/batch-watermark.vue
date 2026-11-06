<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <button :class="$style.backButton" @click="emit('back')" title="返回">
        <van-icon name="arrow-left" />
      </button>
      <div :class="$style.title">批量水印</div>
    </div>

    <div :class="$style.content">
      <div :class="$style.hint">在目标画板上批量添加统一水印</div>

      <!-- 来源方式 -->
      <div :class="$style.label">选择水印来源</div>
      <div :class="$style.modes">
        <div
          :class="[$style.mode, mode === 'selection' && $style.modeActive]"
          @click="mode = 'selection'"
        >
          <div :class="$style.modeIcon">◎</div>
          <div :class="$style.modeName">当前选中</div>
        </div>
        <div
          :class="[$style.mode, mode === 'image' && $style.modeActive]"
          @click="mode = 'image'"
        >
          <div :class="$style.modeIcon">▣</div>
          <div :class="$style.modeName">上传图片</div>
        </div>
      </div>

      <!-- 当前选中 -->
      <div v-show="mode === 'selection'">
        <div :class="[$style.selInfo, currentSelId && $style.selInfoOk]">
          {{ selText }}
        </div>
        <button
          v-if="currentSelId && !lockedSourceId"
          :class="$style.lockBtn"
          @click="lockSource"
        >
          锁定为水印源
        </button>
        <div v-if="lockedSourceId" :class="$style.lockedInfo">
          <strong>水印源已锁定</strong>：{{ lockedSourceName }}<br />
          <span :class="$style.lockedSub">现在可以选中目标画板了</span>
          <button :class="$style.unlockBtn" @click="unlockSource">解除</button>
        </div>
      </div>

      <!-- 上传图片 -->
      <div v-show="mode === 'image'">
        <div
          :class="[$style.drop, imagePreview && $style.dropHasImage]"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <img v-if="imagePreview" :src="imagePreview" :class="$style.dropImg" alt="" />
          <template v-else>
            <div>拖入图片，或</div>
            <label :class="$style.dropLabel" @click="triggerFile">点击选择文件</label>
          </template>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          :class="$style.fileInput"
          @change="onFileChange"
        />
        <button v-if="imagePreview" :class="$style.lockBtn" @click="clearImage">
          重新选择
        </button>
      </div>

      <div :class="$style.divider"></div>

      <!-- 应用范围 -->
      <div :class="$style.label">应用范围</div>
      <select v-model="scope" :class="$style.select">
        <option value="all">全部画板（整个文档）</option>
        <option value="page">仅当前页所有画板（默认）</option>
        <option value="selected">仅选中的画板</option>
      </select>

      <!-- 位置 -->
      <div :class="$style.label">位置</div>
      <select v-model="position" :class="$style.select">
        <option value="bottom-center">底部居中</option>
        <option value="bottom-left">底部左</option>
        <option value="bottom-right">底部右</option>
        <option value="top-center">顶部居中</option>
        <option value="top-left">顶部左</option>
        <option value="top-right">顶部右</option>
        <option value="center">正中央</option>
      </select>

      <div :class="$style.row">
        <div :class="$style.col">
          <div :class="$style.label">宽度模式</div>
          <select v-model="widthMode" :class="$style.select" @change="onWidthModeChange">
            <option value="ratio">按画板比例 (%)</option>
            <option value="fixed">固定像素 (px)</option>
          </select>
        </div>
        <div :class="$style.col">
          <div :class="$style.label">数值</div>
          <input
            v-model.number="widthValue"
            type="number"
            min="1"
            :max="widthMode === 'ratio' ? 100 : 4000"
            :class="$style.input"
          />
        </div>
        <div :class="$style.col">
          <div :class="$style.label">边距 (px)</div>
          <input v-model.number="margin" type="number" min="0" max="500" :class="$style.input" />
        </div>
      </div>

      <div :class="$style.label">
        透明度 <span :class="$style.val">{{ opacityPercent }}%</span>
      </div>
      <input
        v-model.number="opacityPercent"
        type="range"
        min="0"
        max="100"
        :class="$style.range"
        :style="rangeStyle"
      />
    </div>

    <div :class="$style.footer">
      <van-button type="primary" block :disabled="!canApply" @click="handleApply">
        一键应用
      </van-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MessageType, sendMsgToPlugin, addMessageListener } from '../../../messages';

const emit = defineEmits<{ (e: 'back'): void }>();

type Mode = 'selection' | 'image';
const mode = ref<Mode>('selection');

// 通用参数
const scope = ref('page');
const position = ref('bottom-center');
const widthMode = ref<'ratio' | 'fixed'>('ratio');
const widthValue = ref(30);
const margin = ref(24);
const opacityPercent = ref(100);

// 当前选中
const currentSelId = ref('');
const currentSelText = ref('');
const selCount = ref(0);
const lockedSourceId = ref('');
const lockedSourceName = ref('');

// 图片
const fileInput = ref<HTMLInputElement | null>(null);
const imageBytes = ref<number[] | null>(null);
const imgW = ref(0);
const imgH = ref(0);
const imagePreview = ref('');

const selText = computed(() => {
  if (currentSelId.value) return currentSelText.value;
  if (selCount.value > 1) return `已选中 ${selCount.value} 项（如需选画板作目标，先锁定水印源）`;
  return '在画布中选中一个素材';
});

const opacity = computed(() => opacityPercent.value / 100);

const rangeStyle = computed(() => ({
  background: `linear-gradient(to right, var(--theme-color, #1890ff) 0%, var(--theme-color, #1890ff) ${opacityPercent.value}%, var(--divider-color, #d9d9d9) ${opacityPercent.value}%, var(--divider-color, #d9d9d9) 100%)`,
}));

const canApply = computed(() => {
  if (mode.value === 'selection') return !!(lockedSourceId.value || currentSelId.value);
  return !!imageBytes.value;
});

function onWidthModeChange() {
  widthValue.value = widthMode.value === 'ratio' ? 30 : 200;
}

function lockSource() {
  if (!currentSelId.value) return;
  lockedSourceId.value = currentSelId.value;
  lockedSourceName.value = currentSelText.value;
}

function unlockSource() {
  lockedSourceId.value = '';
  lockedSourceName.value = '';
}

function triggerFile() {
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) handleFile(files[0]);
}

function onDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files[0]) handleFile(files[0]);
}

function handleFile(file: File) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const buf = ev.target?.result as ArrayBuffer;
    imageBytes.value = Array.from(new Uint8Array(buf));
    const url = URL.createObjectURL(new Blob([buf], { type: file.type }));
    const img = new Image();
    img.onload = () => {
      imgW.value = img.naturalWidth;
      imgH.value = img.naturalHeight;
      imagePreview.value = url;
    };
    img.src = url;
  };
  reader.readAsArrayBuffer(file);
}

function clearImage() {
  imageBytes.value = null;
  imgW.value = 0;
  imgH.value = 0;
  imagePreview.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

function handleApply() {
  const common = {
    scope: scope.value,
    position: position.value,
    widthMode: widthMode.value,
    widthValue: widthValue.value,
    opacity: opacity.value,
    margin: margin.value,
  };
  if (mode.value === 'selection') {
    const sourceId = lockedSourceId.value || currentSelId.value;
    if (!sourceId) return;
    sendMsgToPlugin(MessageType.WATERMARK_APPLY_SELECTION, { sourceId, ...common });
  } else if (imageBytes.value) {
    sendMsgToPlugin(MessageType.WATERMARK_APPLY_IMAGE, {
      bytes: imageBytes.value,
      imgWidth: imgW.value,
      imgHeight: imgH.value,
      ...common,
    });
  }
}

function onSelection(data: any) {
  if (data && data.node) {
    currentSelId.value = data.node.id;
    currentSelText.value = `${data.node.name} · ${data.node.width}×${data.node.height}`;
  } else {
    currentSelId.value = '';
    currentSelText.value = '';
  }
  selCount.value = data ? data.count || 0 : 0;
}

const offs: Array<() => void> = [];

onMounted(() => {
  offs.push(addMessageListener(MessageType.WATERMARK_SELECTION, onSelection));
  offs.push(addMessageListener(MessageType.SELECTION_CHANGE, () => {
    sendMsgToPlugin(MessageType.WATERMARK_GET_SELECTION);
  }));
  sendMsgToPlugin(MessageType.WATERMARK_GET_SELECTION);
});

onUnmounted(() => {
  offs.forEach((f) => f && f());
});
</script>

<style lang="less" module>
.page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  z-index: 10;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
}

.backButton {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--theme-color);
  padding: 4px 8px;
}

.title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.hint {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 12px;
}

.label {
  display: block;
  margin-top: 12px;
  margin-bottom: 4px;
  font-weight: 500;
  font-size: 12px;
  color: var(--text-primary);
}

.val {
  float: right;
  font-weight: normal;
  color: var(--text-secondary);
}

.modes {
  display: flex;
  gap: 8px;
}

.mode {
  flex: 1;
  padding: 12px 6px;
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  background: var(--bg-secondary);
  transition: all 0.15s;
}

.modeActive {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

.modeIcon {
  font-size: 18px;
  margin-bottom: 4px;
}

.modeName {
  font-size: 12px;
  font-weight: 500;
}

.selInfo {
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.selInfoOk {
  color: var(--theme-color);
}

.lockBtn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  border: 1px solid var(--theme-color);
  border-radius: 4px;
  background: transparent;
  color: var(--theme-color);
  cursor: pointer;
  font-size: 12px;
}

.lockedInfo {
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
}

.lockedSub {
  color: var(--text-secondary);
}

.unlockBtn {
  margin-left: 8px;
  border: none;
  background: transparent;
  color: #ee0a24;
  cursor: pointer;
  font-size: 12px;
}

.drop {
  margin-top: 4px;
  border: 1px dashed var(--divider-color);
  border-radius: 4px;
  padding: 24px 12px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
}

.dropHasImage {
  padding: 8px;
  border-style: solid;
  background: var(--bg-primary);
}

.dropImg {
  max-width: 100%;
  max-height: 120px;
  display: block;
}

.dropLabel {
  cursor: pointer;
  color: var(--theme-color);
  text-decoration: underline;
}

.fileInput {
  position: absolute;
  left: -9999px;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.divider {
  border-top: 1px solid var(--divider-color);
  margin: 16px 0;
}

.select,
.input {
  width: 100%;
  padding: 7px 8px;
  border: 1px solid var(--divider-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}

.range {
  width: 100%;
  margin-top: 8px;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--divider-color, #d9d9d9);
  outline: none;
  cursor: pointer;
}

.range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: transparent;
}

.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--theme-color, #1890ff);
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.row {
  display: flex;
  gap: 8px;
}

.col {
  flex: 1;
  min-width: 0;
}

.footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--divider-color);
  background: var(--bg-primary);
}
</style>
