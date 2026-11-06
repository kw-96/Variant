<template>
  <div class="art-page" :class="$style.pageFix">
    <div class="art-selbox" v-html="countHtml"></div>

    <div :class="$style.steps">
      <button class="art-btn" type="button" @click="toggleSafeArea">显隐安全区</button>
      <button class="art-btn" type="button" :disabled="busy" @click="startScan">点击导入</button>
      <button
        class="art-btn-ghost"
        type="button"
        :class="{ active: groupByChannel }"
        :title="groupByChannel ? '当前按渠道分组导出，点击改为平铺导出' : '当前平铺导出，点击改为按渠道分组导出'"
        @click="groupByChannel = !groupByChannel"
      >按渠道分组：{{ groupByChannel ? '开' : '关' }}</button>
    </div>

    <div v-if="progress.show" :class="$style.progress">
      <div :class="$style.track"><div :class="$style.fill" :style="{ width: progress.pct + '%' }"></div></div>
      <div :class="$style.progLabel">{{ progress.label }}</div>
    </div>

    <div :class="$style.list">
      <div v-if="assets.length === 0" :class="$style.empty">（在画布中选择图层后，点击「点击导入」加载）</div>

      <div v-for="g in groups" :key="g.channel" :class="$style.group">
        <div
          :class="[$style.groupHead, { [$style.invalid]: !g.valid }]"
          @click="toggle(g.channel)"
        >
          <span :class="$style.gName">{{ g.channel }}{{ g.valid ? '' : '（未识别渠道）' }}</span>
          <span :class="$style.gCount">{{ g.indices.length }} 个</span>
          <span :class="[$style.gToggle, { [$style.open]: !!expanded[g.channel] }]">▾</span>
        </div>
        <div v-show="!!expanded[g.channel]" :class="$style.groupBody">
          <div v-for="idx in g.indices" :key="idx" :class="$style.artRow">
            <div :class="$style.line1">
              <span :class="$style.artName">{{ assets[idx].name }}</span>
              <span :class="$style.artDim">{{ assets[idx].width }} × {{ assets[idx].height }}</span>
            </div>
            <div :class="$style.line2">
              <span :class="[$style.status, statusClass(idx)]">{{ statusText(idx) }}</span>
              <input
                type="text"
                :class="$style.target"
                :value="rows[idx].targetKB == null ? '' : String(rows[idx].targetKB)"
                placeholder="不压缩"
                @input="onTargetInput(idx, $event)"
              />
              <span :class="$style.unit">k</span>
              <select
                :class="$style.type"
                :value="rows[idx].format === 'JPG' ? 'jpg' : 'png'"
                @change="onTypeChange(idx, $event)"
              >
                <option value="jpg">jpg</option>
                <option value="png">png</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div :class="$style.actions">
      <button class="art-btn-ghost" type="button" @click="reimport">重新导入</button>
      <button class="art-btn" type="button" :class="$style.exportBtn" :disabled="busy" @click="doExport">导出文件</button>
    </div>

    <div v-if="tip.text" class="art-tip" :class="tip.type">{{ tip.text }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, useCssModule } from 'vue';
import { MessageType, addMessageListener, sendMsgToPlugin } from '../../../messages';
import { exportChannelZip, parseChannel, parseTargetKB, ScanAsset, RowSetting, RowStatus } from './channelCompress';
import { useSelectionInfo } from './artBridge';

// script 作用域内无法直接使用模板专用的 $style，需显式获取 CSS Module
const style = useCssModule();

const assets = ref<ScanAsset[]>([]);
const rows = reactive<RowSetting[]>([]);
const scanFails = ref<string[]>([]);
const pageName = ref('');
const busy = ref(false);
const progress = reactive({ show: false, pct: 0, label: '' });
const tip = reactive({ text: '', type: 'success' as 'success' | 'error' | 'warning' });
const expanded = reactive<Record<string, boolean>>({});
const rowStatus = reactive<Record<number, RowStatus>>({});
/** 按渠道分组导出；默认开启。关闭后平铺导出，兼容旧导出页的使用习惯。 */
const groupByChannel = ref(true);
const ALL_GROUP_KEY = '全部资源';

const { layers } = useSelectionInfo();

let scanBuf: ScanAsset[] = [];
let scanFailBuf: string[] = [];
let scanTotal = 0;
const offs: Array<() => void> = [];

function fmtKB(bytes: number) {
  return Math.round(bytes / 1024) + 'k';
}

const groups = computed(() => {
  if (!groupByChannel.value) {
    return [
      {
        channel: ALL_GROUP_KEY,
        valid: true,
        indices: assets.value.map((_, idx) => idx),
      },
    ];
  }
  const map: Record<string, number[]> = {};
  const valid: Record<string, boolean> = {};
  const order: string[] = [];
  assets.value.forEach((a, idx) => {
    const r = parseChannel(a.name);
    if (map[r.channel] === undefined) {
      map[r.channel] = [];
      valid[r.channel] = r.valid;
      order.push(r.channel);
    }
    map[r.channel].push(idx);
  });
  return order.map((c) => ({ channel: c, valid: valid[c], indices: map[c] }));
});

watch(groupByChannel, (on) => {
  if (on) {
    Object.keys(expanded).forEach((k) => delete expanded[k]);
  } else {
    expanded[ALL_GROUP_KEY] = true;
  }
});

const countHtml = computed(() => {
  if (assets.value.length) {
    if (!groupByChannel.value) {
      return '已扫描 <strong>' + assets.value.length + '</strong> 个画板（平铺导出）';
    }
    const validCount = groups.value.filter((g) => g.valid).length;
    return '已扫描 <strong>' + assets.value.length + '</strong> 个画板，' + validCount + ' 个渠道';
  }
  return '已选择 <strong>' + layers.value.length + '</strong> 个图层，点击「点击导入」加载';
});

function statusText(idx: number): string {
  const s = rowStatus[idx];
  if (s) return s.text;
  return fmtKB(assets.value[idx].size) + ' / 待压缩';
}

function statusClass(idx: number): string {
  const s = rowStatus[idx];
  if (!s) return '';
  if (s.state === 'done' || s.state === 'skipped') return style.done;
  if (s.state === 'fail') return style.fail;
  return '';
}

function toggle(channel: string) {
  expanded[channel] = !expanded[channel];
}

function onTargetInput(idx: number, ev: Event) {
  const v = parseFloat((ev.target as HTMLInputElement).value);
  rows[idx].targetKB = v > 0 ? v : null;
}

function onTypeChange(idx: number, ev: Event) {
  rows[idx].format = (ev.target as HTMLSelectElement).value === 'jpg' ? 'JPG' : 'PNG';
}

function startScan() {
  busy.value = true;
  tip.text = '';
  scanBuf = [];
  scanFailBuf = [];
  scanTotal = 0;
  progress.show = true;
  progress.pct = 0;
  progress.label = '导入中...';
  sendMsgToPlugin(MessageType.CHANNEL_SCAN_START, {});
}

function onReady(d: any) {
  scanTotal = (d && d.total) || 0;
  pageName.value = (d && d.pageName) || '';
  if (scanTotal === 0) {
    progress.show = false;
    busy.value = false;
    tip.type = 'warning';
    tip.text = '请先在画布中选择画板。';
    return;
  }
  sendMsgToPlugin(MessageType.CHANNEL_SCAN_ONE, { index: 0 });
}

function onItem(d: any) {
  if (!d) return;
  if (d.item) scanBuf.push(d.item);
  if (d.fail) scanFailBuf.push(d.fail);
  const done = d.index + 1;
  progress.pct = Math.round((done / (scanTotal || 1)) * 100);
  progress.label = '导入中 ' + done + ' / ' + scanTotal + (d.item ? '：' + d.item.name : '');
  if (done < scanTotal) {
    sendMsgToPlugin(MessageType.CHANNEL_SCAN_ONE, { index: done });
  } else {
    finishScan();
  }
}

// 透明像素兜底检测：解码导出的 PNG 字节，若存在透明像素返回 true
function hasTransparentPixels(bytes: Uint8Array): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          let transparent = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 250) { transparent = true; break; }
          }
          URL.revokeObjectURL(url);
          resolve(transparent);
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve(false);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    } catch (e) {
      resolve(false);
    }
  });
}

async function finishScan() {
  // 透明像素兜底：被判为 JPG 的项，若实际导出图含透明像素，强制改为 PNG
  progress.label = '识别透明背景...';
  for (const a of scanBuf) {
    if (a.format === 'JPG' && a.buf) {
      if (await hasTransparentPixels(a.buf)) a.format = 'PNG';
    }
  }
  progress.show = false;
  busy.value = false;
  assets.value = scanBuf;
  scanFails.value = scanFailBuf;
  rows.splice(0, rows.length);
  Object.keys(rowStatus).forEach((k) => delete rowStatus[k as any]);
  scanBuf.forEach((a) => {
    rows.push({ targetKB: parseTargetKB(a.name), format: a.format === 'JPG' ? 'JPG' : 'PNG' });
  });
  // 默认折叠全部渠道分组（与旧插件一致，点击分组头才展开）
  Object.keys(expanded).forEach((k) => delete expanded[k]);
  if (assets.value.length === 0 && scanFails.value.length) {
    tip.type = 'error';
    tip.text = '导入失败。\n' + scanFails.value.join('\n');
  }
}

function reimport() {
  assets.value = [];
  rows.splice(0, rows.length);
  scanFails.value = [];
  Object.keys(rowStatus).forEach((k) => delete rowStatus[k as any]);
  Object.keys(expanded).forEach((k) => delete expanded[k]);
  progress.show = false;
  tip.text = '';
}

async function doExport() {
  if (assets.value.length === 0) {
    tip.type = 'warning';
    tip.text = '请先点击「点击导入」加载画板。';
    return;
  }
  busy.value = true;
  tip.text = '';
  progress.show = true;
  progress.pct = 0;
  progress.label = '准备导出...';
  try {
    const settings: RowSetting[] = rows.map((r) => ({
      targetKB: r.targetKB && r.targetKB > 0 ? r.targetKB : null,
      format: r.format,
    }));
    const { count, oversize } = await exportChannelZip(
      assets.value,
      settings,
      scanFails.value,
      (done, total, label) => {
        progress.pct = Math.round((done / (total || 1)) * 100);
        progress.label = label;
      },
      (index, status) => {
        rowStatus[index] = status;
      },
      pageName.value,
      groupByChannel.value
    );
    progress.pct = 100;
    // 结果只判断：图片是否生成成功、导出流程是否完成、文件大小是否达标；组件描述不参与判定
    const doneText = count === 1 ? '已导出 1 张图片' : '已导出 ' + count + ' 个文件到 ZIP';
    const notes: string[] = [];
    if (scanFails.value.length) notes.push(scanFails.value.length + ' 张图片生成失败');
    if (oversize.length) notes.push(oversize.length + ' 个文件大小未达标');
    if (notes.length) {
      tip.type = scanFails.value.length ? 'error' : 'warning';
      tip.text = doneText + '（' + notes.join('，') + '）。\n' + scanFails.value.concat(oversize).join('\n');
    } else {
      tip.type = 'success';
      tip.text = doneText + '，已完成。';
    }
  } catch (e: any) {
    tip.type = 'error';
    tip.text = '导出失败：' + String((e && e.message) || e);
  } finally {
    progress.show = false;
    busy.value = false;
  }
}

function toggleSafeArea() {
  sendMsgToPlugin(MessageType.TOGGLE_SAFE_AREA);
}

onMounted(() => {
  offs.push(addMessageListener(MessageType.CHANNEL_SCAN_READY, onReady));
  offs.push(addMessageListener(MessageType.CHANNEL_SCAN_ITEM, onItem));
});
onUnmounted(() => {
  offs.forEach((f) => f && f());
});
</script>

<style lang="less" module>
/* 绝对铺满高度确定的 .van-tabs__content（其 position:relative 由 App.vue 设定），
 * 绕开 vant tabContent/panel 的高度塌陷，使内部 .list（flex:1）获得确定高度并独立滚动。 */
/* 完整 flex 高度链：父级 .van-tabs__content 已锁定高度（App.vue），
 * 这里作为 flex:1 的填充项撑满剩余空间，使内部 .list 获得确定高度并成为唯一滚动容器。 */
.pageFix {
  flex: 1 1 auto;
  min-height: 0 !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.steps {
  display: flex;
  align-items: center;
  gap: 8px;
}

.steps > :global(.art-btn) {
  flex: 1;
}

/* 分组开关：保持单行，不参与均分 */
.steps > :global(.art-btn-ghost) {
  flex: none;
  white-space: nowrap;
}

.steps > :global(.art-btn-ghost.active) {
  color: var(--ap-blue);
  border-color: var(--ap-blue);
}

.progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.track {
  height: 8px;
  border-radius: 99px;
  background: var(--ap-box);
  overflow: hidden;
}

.fill {
  height: 100%;
  width: 0%;
  border-radius: 99px;
  background: linear-gradient(90deg, #4a7dff, #a78bfa);
  transition: width 0.2s ease;
}

.progLabel {
  font-size: 11px;
  color: var(--ap-text2);
}

.list {
  display: block;
  flex: 1 1 auto;
  min-height: 80px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  border: 1px solid var(--ap-card-border);
  border-radius: 10px;
  background: var(--ap-body-bg);
}

.list::-webkit-scrollbar {
  width: 10px;
}

.list::-webkit-scrollbar-thumb {
  background: var(--ap-text2);
  border-radius: 6px;
  border: 2px solid var(--ap-body-bg);
}

.list::-webkit-scrollbar-thumb:hover {
  background: var(--ap-blue);
}

.list::-webkit-scrollbar-track {
  background: transparent;
}

.empty {
  font-size: 11px;
  color: var(--ap-text2);
  padding: 4px 0;
}

/* 可展开渠道分组 */
.group {
  flex: none;
  margin-bottom: 10px;
  border: 1px solid var(--ap-card-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--ap-card-bg);
}

.group:last-child {
  margin-bottom: 0;
}

.groupHead {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  background: var(--ap-head-bg);
  cursor: pointer;
  transition: background 0.15s ease;
}

.groupHead:hover {
  background: var(--ap-head-hover);
}

.groupHead.invalid {
  background: var(--ap-invalid-bg);
}

.gName {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--ap-strong);
  word-break: break-all;
}

.groupHead.invalid .gName {
  color: var(--ap-invalid-text);
}

.gCount {
  flex: none;
  padding: 2px 9px;
  border-radius: 10px;
  background: var(--ap-count-bg);
  color: var(--ap-count-text);
  font-size: 11px;
  font-weight: 500;
}

.groupHead.invalid .gCount {
  background: rgba(255, 217, 138, 0.13);
  color: var(--ap-invalid-text);
}

.gToggle {
  flex: none;
  color: var(--ap-text2);
  font-size: 12px;
  transition: transform 0.15s;
}

.gToggle.open {
  transform: rotate(180deg);
}

.groupBody {
  padding: 4px 12px;
  background: var(--ap-body-bg);
}

/* 单个画板行 */
.artRow {
  padding: 10px 0;
  border-bottom: 1px solid var(--ap-divider);
}

.artRow:last-child {
  border-bottom: none;
}

.line1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.artName {
  font-size: 12px;
  color: var(--ap-text);
  word-break: break-all;
}

.artDim {
  flex: none;
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--ap-dim-bg);
  font-size: 11px;
  color: var(--ap-text2);
  white-space: nowrap;
}

.line2 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #ff9b9b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status.done {
  color: #7ee2a8;
}

.status.fail {
  color: #ff9b9b;
}

.target {
  width: 48px;
  flex: none;
  padding: 5px 4px;
  text-align: center;
  border: 1px solid var(--ap-input-border);
  border-radius: 6px;
  background: var(--ap-input-bg);
  color: var(--ap-input-text);
  font-size: 12px;
  outline: none;
}

.unit {
  flex: none;
  font-size: 11px;
  color: var(--ap-text2);
}

.type {
  width: 56px;
  flex: none;
  padding: 5px 4px;
  border: 1px solid var(--ap-input-border);
  border-radius: 6px;
  background: var(--ap-input-bg);
  color: var(--ap-input-text);
  font-size: 12px;
  outline: none;
}

/* 底部操作 */
.actions {
  display: flex;
  gap: 10px;
  flex: none;
  margin-top: 2px;
  box-sizing: border-box;
}

.actions > :global(.art-btn),
.actions > :global(.art-btn-ghost) {
  box-sizing: border-box;
}

.exportBtn {
  flex: 1;
  width: auto;
  min-width: 0;
}
</style>
