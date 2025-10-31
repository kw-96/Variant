<template>
  <div :class="$style.container">
    <!-- 操作栏 -->
    <div :class="$style.toolbar">
      <div :class="$style.leftActions">
        <van-button
          type="default"
          size="small"
          @click="handleUploadSelection"
        >
          上传所选
        </van-button>
        <van-button
          type="default"
          size="small"
          @click="handleAddSelection"
        >
          添加所选
        </van-button>
      </div>
      <div :class="$style.rightActions">
        <van-button
          type="default"
          size="small"
          plain
          @click="handleClearAll"
        >
          清空
        </van-button>
        <van-button
          type="default"
          size="small"
          plain
          @click="handleToggleAll"
        >
          {{ allSelected ? '取消全选' : '全选' }}
        </van-button>
      </div>
    </div>

    <!-- 标签容器 -->
    <div :class="$style.tagsWrapper">
      <div :class="$style.tagsContainer">
        <div v-if="exportList.length === 0" :class="$style.emptyState">
          <span>暂无导出项</span>
        </div>
        <div
          v-for="(item, index) in exportList"
          :key="index"
          :class="[$style.tagItem, item.checked ? $style.selected : '']"
          @click="handleToggleItem(index)"
        >
          <!-- 左上角清除按钮 -->
          <button :class="$style.closeBtn" title="移除" @click="removeItem(index)">－</button>

          <!-- 顶部行：左侧名称（紧邻清除按钮右侧），右侧尺寸 -->
          <div :class="$style.header">
            <div :class="$style.tagName">{{ (index + 1) + '. ' }}{{ (item.name || '').split(' ')[0] }}</div>
            <div :class="$style.dimRight">{{ item.width }} × {{ item.height }}</div>
          </div>

          <!-- 内容区（保留占位，用于下方状态与控件） -->
          <div :class="$style.tagContent"></div>

          <!-- 左下：大小与压缩状态 -->
          <div :class="$style.statusBox">
            <template v-if="item.imgSize !== undefined">
              <span
                v-if="!item.compressDone"
                :class="item.needCompress ? $style.need : $style.noNeed"
              >
                {{ item.imgSize }}k / {{ item.needCompress ? '待压缩' : '无需压缩' }}
              </span>
              <span
                v-else
                :class="item.compressFailed ? $style.need : $style.noNeed"
              >
                {{ item.compressedSize ?? item.imgSize }}k / {{ item.compressFailed ? '压缩失败' : '已压缩' }}
              </span>
            </template>
          </div>

          <!-- 右下：大小输入与格式选择 -->
          <div :class="$style.controls">
            <input
              :class="$style.sizeInput"
              type="text"
              min="0"
              v-model="item.s"
              inputmode="numeric"
              :placeholder="extractTargetSizeFromName(item.name) || ''"
              @click.stop
              @mousedown.stop
              @input="onEditSize(index, String(item.s || ''))"
            />
            <span :class="$style.suffix">k</span>
            <select
              :class="$style.typeSelect"
              :value="item.type || 'jpg'"
              @click.stop
              @mousedown.stop
              @change="onEditType(index, ($event.target as HTMLSelectElement).value)"
            >
              <option value="jpg">jpg</option>
              <option value="jpeg">jpeg</option>
              <option value="png">png</option>
              <option value="webp">webp</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出按钮 -->
    <van-button
      type="primary"
      block
      @click="handleExport"
      :class="$style.exportBtn"
      :disabled="exportList.filter(item => item.checked).length === 0"
    >
      导出 ({{ exportList.filter(item => item.checked).length }})
    </van-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MessageType } from '../../../messages';
import { sendMsgToPlugin, addMessageListener } from '../../../messages';

interface ExportItem {
  name: string;
  width: number;
  height: number;
  type: string; // 图片格式：jpg/png/webp
  s: string; // 压缩目标大小（单位：k）
  id: string; // 节点ID
  checked: boolean;
  imgData?: Uint8Array; // 图片数据
  imgSize?: number; // 图片大小（单位：k）
  needCompress?: boolean; // 是否需要压缩
  // 导出时动态状态
  compressDone?: boolean; // 是否已完成压缩尝试
  compressedSize?: number; // 压缩后的大小（k）
  compressFailed?: boolean; // 压缩未达到目标
}

const exportList = ref<ExportItem[]>([]);
const allSelected = ref(false);
let exportNum = 0; // 导出序号（用于追加模式）
let currentPageName = ''; // 当前页面名称

// 预留：如需客户端压缩可使用转换函数

// 上传所选
function handleUploadSelection() {
  exportNum = 0;
  exportList.value = [];
  allSelected.value = false;
  
  sendMsgToPlugin(MessageType.EXPORT_IMAGES, { action: 'new' });
}

// 添加所选
function handleAddSelection() {
  sendMsgToPlugin(MessageType.EXPORT_IMAGES, { action: 'add' });
}

// 清空
function handleClearAll() {
  exportList.value = [];
  allSelected.value = false;
  exportNum = 0;
}

// 全选切换
function handleToggleAll() {
  allSelected.value = !allSelected.value;
  exportList.value.forEach(item => {
    item.checked = allSelected.value;
  });
}

// 单个项目切换
function handleToggleItem(index: number) {
  exportList.value[index].checked = !exportList.value[index].checked;
  // 更新全选状态
  allSelected.value = exportList.value.every(item => item.checked);
}

// 处理帧数据（frameExport 消息）
function handleFrameExport(data: { frameData: any[]; action: string; pageName?: string }) {
  const { frameData, action, pageName } = data;
  
  // 保存页面名称
  if (pageName) {
    currentPageName = pageName;
  }
  
  if (action === 'new') {
    // 新上传：清空列表
    exportList.value = [];
    exportNum = 0;
  }
  
  // 添加帧数据到列表（先添加占位数据，稍后补充图片数据）
  frameData.forEach((item) => {
    const targetFromName = extractTargetSizeFromName(item.name);
    const normalizedS = item.s ? String(item.s).replace(/\D+/g, '') : targetFromName;
    const exportItem: ExportItem = {
      name: item.name,
      width: item.width,
      height: item.height,
      type: item.type || 'jpg',
      s: normalizedS,
      id: item.id || '',
      checked: true,
      compressDone: false,
    };
    exportList.value.push(exportItem);
    exportNum++;
  });
  
  // 自动选中新添加的项目
  updateAllSelectedState();
}

// 从名称中提取目标大小（形如 "1000k" 或 "1000 K" 或在名称末尾的数字）
function extractTargetSizeFromName(name: string): string {
  if (!name) return '';
  // 支持半角/全角 K，前后可有空格或标点
  const kMatch = name.match(/(?:^|\s)(\d{2,6})\s*[kKｋＫ](?=\b|\D)/);
  if (kMatch) return String(kMatch[1]);
  // 兜底：提取形如 "... 300k 720×1252" 中的第一个连续数字块
  const digit = name.match(/(?:^|\s)(\d{2,6})(?=\s|$)/);
  return digit ? String(digit[1]) : '';
}

// 清理为可用文件名，但尽量保留原节点名称语义
function safeNodeFileName(name: string): string {
  const base = String(name || 'item')
    .replace(/[\\/:*?"<>|]+/g, '_') // Windows 不允许字符
    .replace(/\s+/g, ' ') // 规整空格
    .trim();
  return base || 'item';
}

// 处理图片数据（imgExport 消息）
function handleImgExport(data: { imgData: Uint8Array[]; action: string }) {
  const { imgData, action } = data;
  
  if (action === 'new') {
    // 新上传：从索引 0 开始
    imgData.forEach((img, i) => {
      if (i < exportList.value.length) {
        const item = exportList.value[i];
        item.imgData = img;
        item.imgSize = Math.floor(img.length / 1000);
        item.needCompress = item.s !== '' && parseInt(item.s) > 0 && item.imgSize > parseInt(item.s);
      }
    });
  } else {
    // 追加模式：从 exportNum - imgData.length 开始
    const startIndex = exportNum - imgData.length;
    imgData.forEach((img, i) => {
      const index = startIndex + i;
      if (index >= 0 && index < exportList.value.length) {
        const item = exportList.value[index];
        item.imgData = img;
        item.imgSize = Math.floor(img.length / 1000);
        item.needCompress = item.s !== '' && parseInt(item.s) > 0 && item.imgSize > parseInt(item.s);
      }
    });
  }
}

// 更新全选状态
function updateAllSelectedState() {
  if (exportList.value.length === 0) {
    allSelected.value = false;
    return;
  }
  allSelected.value = exportList.value.every(item => item.checked);
}

// 移除单条
function removeItem(index: number) {
  if (index >= 0 && index < exportList.value.length) {
    exportList.value.splice(index, 1);
    updateAllSelectedState();
  }
}

// 内部：根据目标大小更新是否需要压缩
function recomputeCompressFlag(item: ExportItem) {
  if (item.imgSize === undefined) {
    item.needCompress = false;
    return;
  }
  const target = item.s && item.s !== '' ? parseInt(item.s) : 0;
  item.needCompress = target > 0 && item.imgSize > target;
}

// 编辑目标大小
function onEditSize(index: number, value: string) {
  const item = exportList.value[index];
  if (!item) return;
  // 仅保留数字，屏蔽用户输入中的 k/K 及非数字字符
  const digits = (value || '').replace(/\D+/g, '');
  item.s = digits;
  recomputeCompressFlag(item);
}

// 编辑导出格式
function onEditType(index: number, value: string) {
  const item = exportList.value[index];
  if (!item) return;
  item.type = value as any;
}

// 将 Uint8Array 转为 Blob URL
function u8aToObjectUrl(u8a: Uint8Array, type: string): string {
  const mime = type === 'jpg' || type === 'jpeg' ? 'image/jpeg' : (type === 'webp' ? 'image/webp' : 'image/png');
  // 兼容 TS DOM 类型：使用 ArrayBuffer 切片避免 ArrayBufferLike 类型不匹配
  // 避免 SharedArrayBuffer 类型，复制到新的 ArrayBuffer
  const ab2 = new ArrayBuffer(u8a.byteLength);
  new Uint8Array(ab2).set(u8a);
  const blob = new Blob([ab2], { type: mime });
  return URL.createObjectURL(blob);
}

// 加载图片为 HTMLImageElement
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Canvas toBlob Promise 封装
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob); else reject(new Error('toBlob 失败'));
    }, type, quality);
  });
}

// 使用二分质量压缩到目标大小（仅 jpg/webp），返回 {u8a, sizeK, success}
async function compressJpegWebpToTarget(u8a: Uint8Array, outType: 'jpg' | 'jpeg' | 'webp', targetK: number): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }>{
  const url = u8aToObjectUrl(u8a, 'png'); // 原始可能为 PNG，这里仅作解码
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context 获取失败');
    ctx.drawImage(img, 0, 0);

  const mime = (outType === 'webp') ? 'image/webp' : 'image/jpeg';
  // 以更高质量为目标：在满足目标体积内尽量提高质量
  let low = 0.5, high = 0.95;
  const tolerance = Math.max(8, Math.floor(targetK * 0.02));
  let bestUnderU8A: Uint8Array | null = null; // 达标范围内的最高质量
  let bestUnderQ = -1;
  let closestU8A: Uint8Array | null = null; // 最接近目标（可能略超）
  let closestDiff = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 8; i++) {
    const q = (low + high) / 2;
    const blob = await canvasToBlob(canvas, mime, q);
    const arrayBuf = await blob.arrayBuffer();
    const cur = new Uint8Array(arrayBuf);
    const sizeK = Math.floor(cur.length / 1000);
    const diff = Math.abs(sizeK - targetK);
    if (diff < closestDiff) { closestDiff = diff; closestU8A = cur; }

    if (sizeK <= targetK) {
      // 达标：提升质量
      if (q > bestUnderQ) { bestUnderQ = q; bestUnderU8A = cur; }
      if (targetK - sizeK <= tolerance) break; // 已足够接近
      low = q;
    } else {
      // 超标：降低质量
      high = q;
    }
  }

  const chosen = bestUnderU8A || closestU8A || u8a;
  const finalSize = Math.floor(chosen.length / 1000);
  const success = finalSize <= targetK + Math.max(0, tolerance - 1);
  return { u8a: chosen, sizeK: finalSize, success };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 动态加载本地 limitPNG（真实库文件位于 mastergo/public/vendor/limitPNG.js，构建后可通过 ./vendor/limitPNG.js 访问，需暴露 window.limitPNG）
let limitPNGLoading: Promise<any> | null = null;
let limitPNGScriptsInjected = false;
async function loadLimitPNG(timeoutMs = 8000): Promise<any | null> {
  if ((window as any).limitPNG) return (window as any).limitPNG;
  if (!limitPNGLoading) {
    limitPNGLoading = new Promise(async (resolve) => {
      try {
        const timer = setTimeout(() => {
          resolve(null);
        }, timeoutMs);

        if (!limitPNGScriptsInjected) {
          const script = document.createElement('script');
          // 使用相对路径，要求构建工具将 src/ui/vendor 作为静态资源拷贝
          script.src = './vendor/limitPNG.js';
          script.onload = () => { clearTimeout(timer); resolve((window as any).limitPNG || null); };
          script.onerror = () => { clearTimeout(timer); resolve(null); };
          document.head.appendChild(script);
          limitPNGScriptsInjected = true;
        } else {
          // 已注入但未就绪，等待就绪或超时
          const checkReady = () => {
            if ((window as any).limitPNG) {
              clearTimeout(timer);
              resolve((window as any).limitPNG);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        }
      } catch {
        resolve(null);
      }
    });
  }
  return await limitPNGLoading;
}

// 使用 limitPNG 将 PNG 压缩至目标大小；要求库提供 compressToTarget(u8a, targetK) → Uint8Array
async function compressPngToTarget(u8a: Uint8Array, targetK: number): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }>{
  const lib = await loadLimitPNG();
  if (lib && typeof lib.compressToTarget === 'function') {
    try {
      const ret = await lib.compressToTarget(u8a, targetK);
      const out: Uint8Array = ret instanceof Uint8Array
        ? ret
        : (ret && ret.buffer instanceof ArrayBuffer
          ? new Uint8Array(ret.buffer)
          : (ret && ret.byteLength !== undefined
            ? new Uint8Array(ret)
            : u8a));
      const sizeK = Math.floor(out.length / 1000);
      return { u8a: out, sizeK, success: sizeK <= targetK };
    } catch (e) {
      // 库存在但压缩失败，回退为原图
      const sizeK = Math.floor(u8a.length / 1000);
      return { u8a, sizeK, success: sizeK <= targetK };
    }
  }
  // 未加载到库：保持原图，并按目标判定
  const sizeK = Math.floor(u8a.length / 1000);
  return { u8a, sizeK, success: sizeK <= targetK };
}

// 动态加载 CDN：JSZip + FileSaver（按原始版本方案）
let jszipLoading: Promise<any> | null = null;
let filesaverLoading: Promise<any> | null = null;

function injectScriptOnce(srcs: string[], globalCheck: () => any, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve) => {
    if (globalCheck()) { resolve(globalCheck()); return; }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    let i = 0;
    const next = () => {
      if (globalCheck()) { clearTimeout(timer); resolve(globalCheck()); return; }
      if (i >= srcs.length) { clearTimeout(timer); resolve(null); return; }
      const s = document.createElement('script');
      s.src = srcs[i++];
      s.async = true;
      s.onload = () => { if (globalCheck()) { clearTimeout(timer); resolve(globalCheck()); } else { next(); } };
      s.onerror = () => { next(); };
      document.head.appendChild(s);
    };
    next();
  });
}

async function loadJSZip(): Promise<any | null> {
  if (!jszipLoading) {
    jszipLoading = injectScriptOnce([
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js'
    ], () => (window as any).JSZip);
  }
  return jszipLoading;
}

async function loadFileSaver(): Promise<any | null> {
  if (!filesaverLoading) {
    filesaverLoading = injectScriptOnce([
      'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
    ], () => (window as any).saveAs);
  }
  return filesaverLoading;
}

// 打包为 ZIP 并保存（JSZip + FileSaver，原始实现思路）
async function zipAndSave(files: { name: string; data: Uint8Array; type: string }[], zipName: string) {
  try {
    const JSZip = await loadJSZip();
    const saveAs = await loadFileSaver();
    if (!JSZip || !saveAs) throw new Error('无法加载打包依赖（JSZip 或 FileSaver）');

    const zip = new JSZip();
    for (const f of files) {
      if (!f || !f.name || !f.data) continue;
      const buf = (f.data instanceof Uint8Array) ? f.data : new Uint8Array(f.data);
      zip.file(f.name, buf);
    }
    const content: Blob = await zip.generateAsync({ type: 'blob' });
    (window as any).saveAs(content, zipName);
  } catch (e: any) {
    console.error('打包失败', e);
    throw e;
  }
}

// 导出
function handleExport() {
  const selectedItems = exportList.value.filter(item => item.checked && item.imgData);
  if (selectedItems.length === 0) {
    alert('请至少选择一个可导出的项目');
    return;
  }

  // 压缩并保存
  (async () => {
    const files: { name: string; data: Uint8Array; }[] = [];
    for (const item of selectedItems) {
      const targetK = item.s && item.s !== '' ? parseInt(item.s) : 0;
      let outData = item.imgData as Uint8Array;
      let outSize = Math.floor(outData.length / 1000);
      let failed = false;

      if (targetK > 0 && item.needCompress) {
        if (item.type === 'jpg' || item.type === 'jpeg' || item.type === 'webp') {
          try {
            const { u8a, sizeK, success } = await compressJpegWebpToTarget(outData, item.type as any, targetK);
            outData = u8a;
            outSize = sizeK;
            failed = !success;
          } catch (e) {
            failed = true;
          }
        } else if (item.type === 'png') {
          try {
            const { u8a, sizeK, success } = await compressPngToTarget(outData, targetK);
            outData = u8a;
            outSize = sizeK;
            failed = !success;
          } catch (e) {
            failed = outSize > targetK;
          }
        } else {
          failed = outSize > targetK;
        }
        item.compressDone = true;
        item.compressedSize = outSize;
        item.compressFailed = failed;
      } else {
        item.compressDone = true;
        item.compressedSize = outSize;
        item.compressFailed = false;
      }

      const nodeFile = `${safeNodeFileName(item.name)}.${item.type || 'png'}`;
      files.push({ name: nodeFile, data: outData });
    }

    try {
      if (files.length === 1) {
        // 单个文件：直接保存，不打包
        const saveAs = await loadFileSaver();
        if (!saveAs) throw new Error('无法加载保存依赖（FileSaver）');
        const file = files[0];
        const mime = (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) ? 'image/jpeg' : (file.name.endsWith('.webp') ? 'image/webp' : 'image/png');
        const blob = new Blob([file.data], { type: mime });
        (window as any).saveAs(blob, file.name);
      } else {
        // 多个文件：打包为 ZIP
        const toZip = files.map(f => ({
          name: f.name,
          data: f.data,
          type: (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg')) ? 'image/jpeg' : (f.name.endsWith('.webp') ? 'image/webp' : 'image/png')
        }));
        // 压缩包名：直接使用 PageNode 的 name
        const packBase = currentPageName ? safeNodeFileName(currentPageName) : 'export';
        await zipAndSave(toZip, `${packBase}.zip`);
      }
    } catch (err: any) {
      console.error('导出失败详情：', err);
      alert(`导出失败：${err?.message || err}`);
    }
  })();
}

// 监听插件消息
let frameExportListener: (() => void) | null = null;
let imgExportListener: (() => void) | null = null;

onMounted(() => {
  // 监听 frameExport 消息
  frameExportListener = addMessageListener('frameExport', (data: any) => {
    handleFrameExport(data);
  });
  
  // 监听 imgExport 消息
  imgExportListener = addMessageListener('imgExport', (data: any) => {
    handleImgExport(data);
  });
});

onUnmounted(() => {
  // 清理监听器
  if (frameExportListener) {
    frameExportListener();
  }
  if (imgExportListener) {
    imgExportListener();
  }
});
</script>

<style lang="less" module>
.container {
  height: 95%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 12px 0;
  background-color: var(--bg-secondary);
  flex-shrink: 0;
  box-sizing: border-box;
}

.leftActions {
  display: flex;
  gap: 8px;
}

.rightActions {
  display: flex;
  gap: 8px;
}

.tagsWrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.tagsContainer {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emptyState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.tagItem {
  position: relative;
  padding: 12px 12px 36px 12px; // 预留底部空间放控件
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.closeBtn {
  position: absolute;
  left: 8px;
  top: 6px;
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
}

.selected {
  border-color: var(--primary-color, #1989fa);
  box-shadow: 0 0 0 2px rgba(25,137,250,0.15) inset;
}

.header {
  position: absolute;
  left: 36px; // 清除按钮右侧留白
  right: 12px;
  top: 6px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dimRight { font-size: 11px; color: var(--text-secondary); }

.tagContent {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 24px; // 顶部行占位
}

.tagName {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.tagInfo {
  font-size: 11px;
  color: var(--text-secondary);
}

.sizeInfo {
  color: var(--text-secondary);
  opacity: 0.7;
}

.imgSizeInfo {
  font-size: 10px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.statusBox {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 11px;
}

.need { color: #d9534f; }
.noNeed { color: #3c763d; }

.controls {
  position: absolute;
  right: 12px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sizeInput {
  width: 42px;
  height: 16px;
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
}

.suffix {
  font-size: 11px;
  color: var(--text-secondary);
}

.typeSelect {
  height: 16px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.typeSelect:focus,
.typeSelect:active,
.typeSelect:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: var(--border-color);
}

.exportBtn {
  flex-shrink: 0;
  margin-top: 12px;
}
</style>
