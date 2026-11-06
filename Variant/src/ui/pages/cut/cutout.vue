<template>
  <div :class="[$style.container, 'cutout-fill']">
    <!-- 选择图片 -->
    <label :class="$style.selLabel">选择图片<span :class="$style.selInfo">{{ selInfo }}</span></label>

    <!-- 多图切换（选中多张图时显示，位于容差之上，与原插件一致） -->
    <div v-show="showNav" :class="$style.nav">
      <button :class="$style.navBtn" type="button" :disabled="prevDisabled" @click="goPrev">◀</button>
      <span :class="$style.navInfo">{{ navInfo }}</span>
      <button :class="$style.navBtn" type="button" :disabled="nextDisabled" @click="goNext">▶</button>
    </div>

    <!-- 容差 -->
    <div :class="$style.tolRow">
      <label :class="$style.tolLabel">背景容差：{{ tolerance }}</label>
      <button :class="$style.autoBtn" type="button" @click="autoTolerance">自动识别</button>
    </div>
    <input
      type="range"
      min="0"
      max="120"
      :class="$style.slider"
      :value="tolerance"
      @input="onToleranceInput"
    />

    <!-- 预览 -->
    <div ref="previewWrap" :class="[$style.previewWrap, { [$style.hasImg]: hasImg }]">
      <canvas ref="previewCanvas" :class="$style.previewCanvas"></canvas>
    </div>
    <div :class="$style.note">
      插件会自动识别每张图的背景类型（边缘纯色背景 / 圆角白卡·白色底板）并去除，预览即最终效果。可点「自动识别」重新判断，或拖动滑块微调容差。多选时用 ◀ ▶ 切换，各自独立。原图保留不改；点「一键抠图」后放回原图右侧。滚轮缩放、拖动平移，双击复位。
    </div>

    <!-- 弹性占位：把「一键抠图」按钮压到底部（复刻原插件） -->
    <div :class="$style.spacer"></div>

    <!-- 进度 -->
    <div v-show="showProgress" :class="$style.progress">
      <div :class="$style.progressBar"><div :class="$style.progressFill" :style="{ width: progress + '%' }"></div></div>
      <div :class="$style.progressLabel">{{ progressLabel }}</div>
    </div>

    <button :class="$style.runBtn" type="button" :disabled="running" @click="runCutout">一键抠图</button>

    <div v-if="tipText" :class="[$style.tip, $style[tipType]]">{{ tipText }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MessageType, sendMsgToPlugin, addMessageListener } from '../../../messages';

type CutMode = 'edge' | 'white';

interface CutoutImage {
  index: number;
  name: string;
  bytes: Uint8Array;
  mode: CutMode;
  tol: number | null;
  detected: boolean;
  baseData: ImageData | null;
}

// —— UI 绑定状态 ——
const tolerance = ref(0);
const running = ref(false);
const progress = ref(0);
const progressLabel = ref('');
const showProgress = ref(false);
const tipText = ref('');
const tipType = ref<'success' | 'error' | 'warning'>('success');
const selInfo = ref('（请选择带图片的图层）');
const navInfo = ref('');
const showNav = ref(false);
const prevDisabled = ref(true);
const nextDisabled = ref(true);
const hasImg = ref(false);

const previewWrap = ref<HTMLDivElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);

// —— 重数据（非响应式）——
let cutoutImages: CutoutImage[] = [];
let cutoutCur = 0;
let previewBaseData: ImageData | null = null;
let fails: string[] = [];
let total = 0;
let previewRafId = 0;

// 预览缩放/平移
let pvScale = 1, pvTx = 0, pvTy = 0;

function showTip(type: 'success' | 'error' | 'warning', text: string) {
  tipType.value = type;
  tipText.value = text;
}

function requestLoad() {
  sendMsgToPlugin(MessageType.CUTOUT_LOAD, {});
}

// —— 选中内容变化：实时刷新（还原「渠道整理」行为）——
// 用可靠的 SELECTION_INFO 通道（纯对象 layers），而非 live node 的 SELECTION_CHANGE
let selectionSig = '';
function onSelectionInfo(data: any) {
  const layers = (data && data.layers) || [];
  const count = layers.length;
  selInfo.value = count > 0
    ? '（已选择 ' + count + ' 个图层）'
    : '（请选择带图片的图层）';
  const sig = count + '|' + layers.map((l: any) => (l && l.name) || '').join(',');
  if (sig !== selectionSig) {
    selectionSig = sig;
    requestLoad();
  }
}

// —— 收到主线程导出的全部选中图字节 ——
function onCutoutImages(data: any) {
  const items = (data && data.items) || [];
  cutoutImages = items.map((it: any) => ({
    index: it.index,
    name: it.name,
    bytes: it.bytes instanceof Uint8Array ? it.bytes : new Uint8Array(it.bytes),
    mode: 'edge' as CutMode,
    tol: null,
    detected: false,
    baseData: null,
  }));
  cutoutCur = 0;
  if (cutoutImages.length === 0) {
    previewBaseData = null;
    hasImg.value = false;
    updateNav();
    return;
  }
  updateNav();
  showImage(0);
}

function updateNav() {
  showNav.value = cutoutImages.length > 1;
  if (!cutoutImages.length) { navInfo.value = ''; return; }
  const im = cutoutImages[cutoutCur];
  navInfo.value = cutoutCur + 1 + ' / ' + cutoutImages.length + '　' + im.name;
  prevDisabled.value = cutoutCur === 0;
  nextDisabled.value = cutoutCur === cutoutImages.length - 1;
}

function goPrev() { if (cutoutCur > 0) showImage(cutoutCur - 1); }
function goNext() { if (cutoutCur < cutoutImages.length - 1) showImage(cutoutCur + 1); }

// 切到第 k 张：懒解码 + 自动识别模式与容差 + 渲染预览
function showImage(k: number) {
  if (k < 0 || k >= cutoutImages.length) return;
  cutoutCur = k;
  updateNav();
  const im = cutoutImages[k];
  const canvas = previewCanvas.value;
  if (!canvas) return;
  if (im.baseData) {
    previewBaseData = im.baseData;
    canvas.width = im.baseData.width;
    canvas.height = im.baseData.height;
    hasImg.value = true;
    resetPreviewTransform();
    applyTolToSlider(im);
    renderPreview();
    return;
  }
  const blob = new Blob([im.bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const MAX = 1200;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d')!;
    octx.drawImage(img, 0, 0, w, h);
    im.baseData = octx.getImageData(0, 0, w, h);
    URL.revokeObjectURL(url);
    if (cutoutCur !== k) return;
    previewBaseData = im.baseData;
    canvas.width = w; canvas.height = h;
    hasImg.value = true;
    resetPreviewTransform();
    applyTolToSlider(im);
    renderPreview();
  };
  img.onerror = () => { URL.revokeObjectURL(url); };
  img.src = url;
}

// 自动识别背景类型：为该图确定处理模式与容差（预览与导出共用此结果）
function ensureDetected(im: CutoutImage) {
  if (im.detected || !im.baseData) return;
  const res = detectBackground(im.baseData);
  im.mode = res.mode;
  im.tol = res.tol;
  im.detected = true;
}

function applyTolToSlider(im: CutoutImage) {
  ensureDetected(im);
  tolerance.value = im.tol == null ? 0 : im.tol;
}

function onToleranceInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  tolerance.value = v;
  if (cutoutImages[cutoutCur]) cutoutImages[cutoutCur].tol = v;
  scheduleRenderPreview();
}

function renderPreview() {
  if (!previewBaseData || !previewCanvas.value) return;
  const im = cutoutImages[cutoutCur];
  const m: CutMode = im ? im.mode : 'edge';
  const w = previewBaseData.width, h = previewBaseData.height;
  const copy = new ImageData(new Uint8ClampedArray(previewBaseData.data), w, h);
  removeBackgroundByMode(copy, m, tolerance.value);
  const ctx = previewCanvas.value.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(copy, 0, 0);
}

// 按模式调度：边缘背景 / 白色底板
function removeBackgroundByMode(imageData: ImageData, m: CutMode, tol: number) {
  if (m === 'white') floodFillWhiteBoard(imageData, tol);
  else floodFillBackground(imageData, tol);
}

function scheduleRenderPreview() {
  if (previewRafId) return;
  previewRafId = requestAnimationFrame(() => {
    previewRafId = 0;
    renderPreview();
  });
}

// 自动识别容差
function estimateTolerance(base: ImageData): number {
  const w = base.width, h = base.height, d = base.data;
  let br = 0, bg = 0, bb = 0, n = 0;
  const acc = (o: number) => { br += d[o]; bg += d[o + 1]; bb += d[o + 2]; n++; };
  for (let x = 0; x < w; x++) { acc(x * 4); acc(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { acc((y * w) * 4); acc((y * w + w - 1) * 4); }
  if (n === 0) return 32;
  br /= n; bg /= n; bb /= n;
  const dist: number[] = [];
  const push = (o: number) => {
    const dr = d[o] - br, dg = d[o + 1] - bg, db = d[o + 2] - bb;
    dist.push(Math.sqrt(dr * dr + dg * dg + db * db));
  };
  for (let x = 0; x < w; x++) { push(x * 4); push(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { push((y * w) * 4); push((y * w + w - 1) * 4); }
  dist.sort((a, b) => a - b);
  const p90 = dist[Math.floor(dist.length * 0.9)] || 0;
  const tol = Math.round(p90 / 1.732 + 8);
  return Math.max(8, Math.min(120, tol));
}

// 手动重新识别：重跑背景类型判定 + 容差
function autoTolerance() {
  if (!previewBaseData) return;
  const im = cutoutImages[cutoutCur];
  if (!im) return;
  const res = detectBackground(previewBaseData);
  im.mode = res.mode;
  im.tol = res.tol;
  im.detected = true;
  tolerance.value = res.tol;
  renderPreview();
}

// 自动识别背景类型：
// 1) 透明圆角 + 中央大面积近白连通区 → 白色底板（圆角白卡 PNG）；
// 2) 四边均为不透明且同色 → 边缘背景；
// 3) 兜底：有大面积近白优先白底，否则边缘。
function detectBackground(base: ImageData): { mode: CutMode; tol: number } {
  const n = base.width * base.height;
  const whiteTol = estimateWhiteTolerance(base);
  const whiteArea = largestNearWhiteArea(base, whiteTol);
  const bigWhite = whiteArea >= n * 0.01;
  const transparentCorners = countTransparentCorners(base);

  // 1) 透明圆角 + 大面积近白 → 白色底板（先于边缘判定，避免圆角 PNG 误判）
  if (bigWhite && transparentCorners >= 2) {
    return { mode: 'white', tol: whiteTol };
  }
  // 2) 四边均为不透明且颜色一致 → 连续边缘背景
  const border = analyzeBorders(base);
  if (border.opaqueRatio >= 0.9 && border.std <= 45) {
    return { mode: 'edge', tol: estimateTolerance(base) };
  }
  // 3) 兜底：存在大面积近白优先按白底处理，否则按边缘处理
  if (bigWhite) {
    return { mode: 'white', tol: whiteTol };
  }
  return { mode: 'edge', tol: estimateTolerance(base) };
}

// 四个角是否透明（圆角 PNG 的角通常为透明像素）
function countTransparentCorners(base: ImageData): number {
  const w = base.width, h = base.height, d = base.data;
  const corners = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)];
  let c = 0;
  for (let i = 0; i < corners.length; i++) {
    if (d[corners[i] * 4 + 3] < 10) c++;
  }
  return c;
}

// 四边像素：不透明占比 + 颜色离散度（判断是否连续同色背景）
function analyzeBorders(base: ImageData): { opaqueRatio: number; std: number } {
  const w = base.width, h = base.height, d = base.data;
  let total = 0, opaque = 0, sr = 0, sg = 0, sb = 0;
  const collect = (o: number) => {
    total++;
    if (d[o + 3] > 10) { opaque++; sr += d[o]; sg += d[o + 1]; sb += d[o + 2]; }
  };
  for (let x = 0; x < w; x++) { collect(x * 4); collect(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { collect((y * w) * 4); collect((y * w + w - 1) * 4); }
  const opaqueRatio = total ? opaque / total : 0;
  if (opaque === 0) return { opaqueRatio: 0, std: 999 };
  const mr = sr / opaque, mg = sg / opaque, mb = sb / opaque;
  let vs = 0;
  const varc = (o: number) => {
    if (d[o + 3] > 10) {
      const dr = d[o] - mr, dg = d[o + 1] - mg, db = d[o + 2] - mb;
      vs += dr * dr + dg * dg + db * db;
    }
  };
  for (let x = 0; x < w; x++) { varc(x * 4); varc(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { varc((y * w) * 4); varc((y * w + w - 1) * 4); }
  return { opaqueRatio, std: Math.sqrt(vs / opaque) };
}

// 最大近白连通区面积（用于判定是否存在白色底板）
function largestNearWhiteArea(base: ImageData, toleranceVal: number): number {
  const w = base.width, h = base.height, d = base.data;
  const n = w * h;
  const minChannel = Math.max(0, 255 - toleranceVal);
  const maxChroma = Math.max(8, Math.round(toleranceVal * 0.6));
  const isWhite = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] === 0) continue;
    const r = d[o], g = d[o + 1], b = d[o + 2];
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (mn >= minChannel && (mx - mn) <= maxChroma) isWhite[i] = 1;
  }
  const label = new Uint8Array(n);
  const stack: number[] = [];
  let best = 0;
  for (let start = 0; start < n; start++) {
    if (!isWhite[start] || label[start]) continue;
    let area = 0;
    stack.length = 0;
    stack.push(start);
    label[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const px = p % w, py = (p - px) / w;
      if (px > 0) { const q = p - 1; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (px < w - 1) { const q = p + 1; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (py > 0) { const q = p - w; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (py < h - 1) { const q = p + w; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
    }
    if (area > best) best = area;
  }
  return best;
}

// 泛洪去底：从四边泛洪，把与边缘背景色相近的连通区域置透明。
// 背景基准色仅取「不透明」的边缘像素均值，忽略透明像素（不把透明当成黑色背景）。
function floodFillBackground(imageData: ImageData, toleranceVal: number) {
  const w = imageData.width, h = imageData.height;
  const d = imageData.data;
  // 边缘不透明像素均值作为背景基准色
  let br = 0, bg = 0, bb = 0, cnt = 0;
  const sample = (o: number) => {
    if (d[o + 3] > 10) { br += d[o]; bg += d[o + 1]; bb += d[o + 2]; cnt++; }
  };
  for (let x = 0; x < w; x++) { sample(x * 4); sample(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { sample((y * w) * 4); sample((y * w + w - 1) * 4); }
  if (cnt === 0) return; // 边缘全透明，无连续边缘背景可去除
  br /= cnt; bg /= cnt; bb /= cnt;
  const tol2 = toleranceVal * toleranceVal * 3;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const o = p * 4;
    // 已透明像素：视为背景，继续向内扩散但不改动
    if (d[o + 3] !== 0) {
      const dr = d[o] - br, dg = d[o + 1] - bg, db = d[o + 2] - bb;
      if (dr * dr + dg * dg + db * db > tol2) continue; // 主体，停止扩散
      d[o + 3] = 0;
    }
    const px = p % w, py = (p - px) / w;
    if (px > 0) stack.push(p - 1);
    if (px < w - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - w);
    if (py < h - 1) stack.push(p + w);
  }
}

// 本地去底：从四边泛洪，去掉与背景相近的纯色，返回 PNG 字节
function removeBgLocal(pngBytes: Uint8Array, m: CutMode, toleranceVal: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        removeBackgroundByMode(imageData, m, toleranceVal);
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((outBlob) => {
          URL.revokeObjectURL(url);
          if (!outBlob) { reject(new Error('生成图片失败')); return; }
          outBlob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
        }, 'image/png');
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败')); };
    img.src = url;
  });
}

// 白色底板去除：识别近白像素，删除面积较大的连通近白区域（即使未连到边缘），
// 保留主体、文字、高光中的小块白色细节。
function floodFillWhiteBoard(imageData: ImageData, toleranceVal: number) {
  const w = imageData.width, h = imageData.height;
  const d = imageData.data;
  const n = w * h;
  // 近白判定：各通道足够亮且色度低。容差越大越宽松。
  const minChannel = Math.max(0, 255 - toleranceVal);
  const maxChroma = Math.max(8, Math.round(toleranceVal * 0.6));
  const isWhite = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] === 0) continue; // 已透明跳过
    const r = d[o], g = d[o + 1], b = d[o + 2];
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (mn >= minChannel && (mx - mn) <= maxChroma) isWhite[i] = 1;
  }
  // 连通域（4 邻接）：面积达到阈值的近白区域才删除
  const areaThreshold = Math.max(400, Math.floor(n * 0.01));
  const label = new Uint8Array(n);
  const stack: number[] = [];
  const region: number[] = [];
  for (let start = 0; start < n; start++) {
    if (!isWhite[start] || label[start]) continue;
    region.length = 0;
    stack.length = 0;
    stack.push(start);
    label[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      region.push(p);
      const px = p % w, py = (p - px) / w;
      if (px > 0) { const q = p - 1; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (px < w - 1) { const q = p + 1; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (py > 0) { const q = p - w; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
      if (py < h - 1) { const q = p + w; if (isWhite[q] && !label[q]) { label[q] = 1; stack.push(q); } }
    }
    if (region.length >= areaThreshold) {
      for (let k = 0; k < region.length; k++) d[region[k] * 4 + 3] = 0;
    }
  }
}

// 白色容差自动识别：统计近白像素偏离纯白的程度
function estimateWhiteTolerance(base: ImageData): number {
  const w = base.width, h = base.height, d = base.data;
  const n = w * h;
  let sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] === 0) continue;
    const r = d[o], g = d[o + 1], b = d[o + 2];
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (mn >= 200 && (mx - mn) <= 40) { sum += (255 - mn) + (mx - mn); cnt++; }
  }
  if (cnt === 0) return 30;
  const avg = sum / cnt;
  return Math.max(16, Math.min(120, Math.round(avg + 24)));
}

// —— 预览缩放/平移 ——
function applyPreviewTransform() {
  if (!previewCanvas.value) return;
  previewCanvas.value.style.transform =
    'translate(' + pvTx + 'px,' + pvTy + 'px) scale(' + pvScale + ')';
}
function resetPreviewTransform() {
  pvScale = 1; pvTx = 0; pvTy = 0;
  applyPreviewTransform();
}

function onWheel(e: WheelEvent) {
  if (!previewBaseData || !previewCanvas.value) return;
  e.preventDefault();
  const rect = previewCanvas.value.getBoundingClientRect();
  const cx = e.clientX - (rect.left + rect.width / 2);
  const cy = e.clientY - (rect.top + rect.height / 2);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const next = Math.min(8, Math.max(1, pvScale * factor));
  const ratio = next / pvScale;
  pvTx = pvTx - cx * (ratio - 1);
  pvTy = pvTy - cy * (ratio - 1);
  pvScale = next;
  if (pvScale === 1) { pvTx = 0; pvTy = 0; }
  applyPreviewTransform();
}

let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
function onPointerDown(e: PointerEvent) {
  if (!previewBaseData || pvScale <= 1 || !previewCanvas.value) return;
  dragging = true; sx = e.clientX; sy = e.clientY; ox = pvTx; oy = pvTy;
  previewCanvas.value.setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  pvTx = ox + (e.clientX - sx);
  pvTy = oy + (e.clientY - sy);
  applyPreviewTransform();
}
function onPointerUp() { dragging = false; }

// —— 运行 ——
async function runCutout() {
  if (!cutoutImages.length) {
    showTip('warning', '选中的图层里没有可处理的图片填充。');
    return;
  }
  running.value = true;
  tipText.value = '';
  showProgress.value = true;
  progress.value = 0;
  progressLabel.value = '抠图中...';

  fails = [];
  total = cutoutImages.length;
  for (let i = 0; i < cutoutImages.length; i++) {
    const im = cutoutImages[i];
    progress.value = Math.round((i / total) * 100);
    progressLabel.value = '抠图中 ' + (i + 1) + ' / ' + total + '：' + im.name;
    try {
      // 未浏览过的图：先解码并自动识别，保证与预览用同一套模式与容差
      if (!im.detected) {
        if (!im.baseData) im.baseData = await decodeBaseData(im.bytes);
        ensureDetected(im);
      }
      const tol = im.tol == null ? 0 : im.tol;
      const outBuf = await removeBgLocal(im.bytes, im.mode, tol);
      sendMsgToPlugin(MessageType.CUTOUT_RESULT, { index: im.index, bytes: outBuf });
    } catch (e: any) {
      fails.push(im.name + '：' + String((e && e.message) || e));
    }
  }
  sendMsgToPlugin(MessageType.CUTOUT_FLUSH, {});
}

// 解码 PNG 字节为（限宽 1200 的）ImageData，用于自动识别
function decodeBaseData(pngBytes: Uint8Array): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const octx = off.getContext('2d')!;
        octx.drawImage(img, 0, 0, w, h);
        const data = octx.getImageData(0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(data);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败')); };
    img.src = url;
  });
}

function onCutoutApplied(data: any) {
  if (data && data.fail) fails.push(data.fail);
  progress.value = Math.min(100, progress.value + Math.round(100 / (total || 1)));
}

function finishCutout() {
  showProgress.value = false;
  running.value = false;
  const okCount = total - fails.length;
  if (fails.length) {
    showTip('error', '已放回 ' + okCount + ' 张，' + fails.length + ' 张失败（原图保留未改）。\n' + fails.join('\n'));
  } else {
    showTip('success', '已放回 ' + okCount + ' 张抠图到画布（原图保留未改）。');
  }
}

// —— 生命周期 ——
let removeImages: (() => void) | null = null;
let removeApplied: (() => void) | null = null;
let removeFinished: (() => void) | null = null;
let removeSelection: (() => void) | null = null;

onMounted(() => {
  removeImages = addMessageListener(MessageType.CUTOUT_IMAGES, onCutoutImages);
  removeApplied = addMessageListener(MessageType.CUTOUT_APPLIED, onCutoutApplied);
  removeFinished = addMessageListener(MessageType.CUTOUT_FINISHED, finishCutout);
  removeSelection = addMessageListener(MessageType.SELECTION_INFO, onSelectionInfo);
  const wrap = previewWrap.value;
  const canvas = previewCanvas.value;
  if (wrap) wrap.addEventListener('wheel', onWheel, { passive: false });
  if (canvas) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('dblclick', resetPreviewTransform);
  }
  // 主动请求一次当前选中态：显示图层数并触发首次导出
  sendMsgToPlugin(MessageType.SELECTION_INFO_REQ, {});
});

onUnmounted(() => {
  removeImages && removeImages();
  removeApplied && removeApplied();
  removeFinished && removeFinished();
  removeSelection && removeSelection();
  const wrap = previewWrap.value;
  if (wrap) wrap.removeEventListener('wheel', onWheel);
});
</script>

<style lang="less" module>
.container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 100%;
}

.spacer {
  flex: 1 1 auto;
  min-height: 8px;
}

.selbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.selLabel {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
}

.selInfo {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.autoBtn {
  width: auto !important;
  padding: 4px 10px !important;
  font-size: 11px;
  border: 1px solid var(--border-color) !important;
  border-radius: 6px;
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  cursor: pointer;
}

.autoBtn:hover {
  background-color: var(--input-bg) !important;
}

.tolRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tolLabel {
  font-size: 13px;
  color: var(--text-primary);
}

.slider {
  width: 100%;
  height: 6px;
  margin: 6px 0;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 999px;
  background-color: rgba(140, 140, 140, 0.6);
  accent-color: var(--button-primary-bg);
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--button-primary-bg);
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--button-primary-bg);
  border: 2px solid #fff;
}

.slider::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background-color: rgba(140, 140, 140, 0.6);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.navBtn {
  width: auto !important;
  padding: 4px 12px !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 6px;
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  cursor: pointer;
}

.navBtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.navInfo {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.previewWrap {
  position: relative;
  width: 100%;
  height: 160px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2a2a2a;
  background-image:
    linear-gradient(45deg, #3a3a3a 25%, transparent 25%),
    linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3a3a3a 75%),
    linear-gradient(-45deg, transparent 75%, #3a3a3a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.previewCanvas {
  max-width: 100%;
  max-height: 100%;
  transform-origin: center center;
  display: none;
}

.hasImg .previewCanvas {
  display: block;
}

.note {
  margin-bottom: 4px;
  padding: 7px 10px;
  border-radius: 6px;
  background-color: var(--input-bg);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
  text-align: left;
}

.progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progressBar {
  width: 100%;
  height: 6px;
  border-radius: 4px;
  background-color: var(--input-bg);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background-color: var(--button-primary-bg);
  transition: width 0.2s;
}

.progressLabel {
  font-size: 11px;
  color: var(--text-secondary);
}

.runBtn {
  width: 100% !important;
  padding: 10px !important;
  border: 1px solid var(--button-primary-bg) !important;
  border-radius: 6px;
  background-color: var(--button-primary-bg) !important;
  color: #ffffff !important;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.runBtn:hover {
  opacity: 0.92;
}

.runBtn:disabled {
  opacity: 0.6;
  cursor: default;
}

.tip {
  padding: 9px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.success {
  background-color: #1f3a2a;
  color: #7ee2a8;
  border: 1px solid #2f5b41;
}

.error {
  background-color: #3a1f1f;
  color: #ff9b9b;
  border: 1px solid #5b2f2f;
}

.warning {
  background-color: #3a341f;
  color: #ffd98a;
  border: 1px solid #5b502f;
}
</style>
