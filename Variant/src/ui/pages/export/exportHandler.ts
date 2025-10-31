/**
 * 导出处理器
 * 负责图片压缩、打包和保存功能
 */

// 导出项接口定义
export interface ExportItem {
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

/**
 * 清理为可用文件名，但尽量保留原节点名称语义
 */
function safeNodeFileName(name: string): string {
  const base = String(name || 'item')
    .replace(/[\\/:*?"<>|]+/g, '_') // Windows 不允许字符
    .replace(/\s+/g, ' ') // 规整空格
    .trim();
  return base || 'item';
}

/**
 * 将 Uint8Array 转为 Blob URL
 */
function u8aToObjectUrl(u8a: Uint8Array, type: string): string {
  const mime = type === 'jpg' || type === 'jpeg' ? 'image/jpeg' : (type === 'webp' ? 'image/webp' : 'image/png');
  // 兼容 TS DOM 类型：使用 ArrayBuffer 切片避免 ArrayBufferLike 类型不匹配
  // 避免 SharedArrayBuffer 类型，复制到新的 ArrayBuffer
  const ab2 = new ArrayBuffer(u8a.byteLength);
  new Uint8Array(ab2).set(u8a);
  const blob = new Blob([ab2], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * 加载图片为 HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Canvas toBlob Promise 封装
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob); else reject(new Error('toBlob 失败'));
    }, type, quality);
  });
}

/**
 * 使用二分质量压缩到目标大小（仅 jpg/webp），返回 {u8a, sizeK, success}
 */
async function compressJpegWebpToTarget(u8a: Uint8Array, outType: 'jpg' | 'jpeg' | 'webp', targetK: number): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }> {
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

/**
 * 动态加载本地 limitPNG
 */
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

/**
 * 使用 limitPNG 将 PNG 压缩至目标大小
 */
async function compressPngToTarget(u8a: Uint8Array, targetK: number): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }> {
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

/**
 * 动态加载 CDN：JSZip + FileSaver
 */
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

/**
 * 打包为 ZIP 并保存
 */
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

/**
 * 导出处理器主函数
 * @param selectedItems 选中的导出项列表
 * @param currentPageName 当前页面名称
 * @param updateItemCallback 更新项的回调函数，使用 item.id 来定位（可选）
 */
export async function exportHandler(
  selectedItems: ExportItem[],
  currentPageName: string,
  updateItemCallback?: (itemId: string, updates: Partial<ExportItem>) => void
): Promise<void> {
  if (selectedItems.length === 0) {
    throw new Error('请至少选择一个可导出的项目');
  }

  const files: { name: string; data: Uint8Array; }[] = [];
  
  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
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
      
      // 更新项状态
      if (updateItemCallback) {
        updateItemCallback(item.id, {
          compressDone: true,
          compressedSize: outSize,
          compressFailed: failed,
        });
      }
    } else {
      // 更新项状态
      if (updateItemCallback) {
        updateItemCallback(item.id, {
          compressDone: true,
          compressedSize: outSize,
          compressFailed: false,
        });
      }
    }

    const nodeFile = `${safeNodeFileName(item.name)}.${item.type || 'png'}`;
    files.push({ name: nodeFile, data: outData });
  }

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
}

