/**
 * 导出处理器
 * 负责图片压缩、打包和保存功能
 *
 * 约束：压缩仅调整编码质量或 PNG 调色板，不改变像素宽高；格式转换仅在「期望类型与源数据不一致」时执行。
 */
import UPNG from 'upng-js';

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

export interface CompressStrategyOptions {
  jpgMinQuality: number;
  jpgQualityStep: number;
  jpgMaxRounds: number;
  pngMinColors: number;
}

const DEFAULT_COMPRESS_OPTIONS: CompressStrategyOptions = {
  jpgMinQuality: 0.56,
  jpgQualityStep: 0.06,
  jpgMaxRounds: 7,
  pngMinColors: 16
};

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
 * 通过文件头（magic number）检测图片实际类型
 * @param data 图片数据的 Uint8Array
 * @returns 检测到的类型：'png' | 'jpg' | 'webp' | null
 */
function detectImageTypeByMagicNumber(data: Uint8Array): 'png' | 'jpg' | 'webp' | null {
  if (!data || data.length < 8) return null;
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
      data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A) {
    return 'png';
  }
  
  // JPEG: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'jpg';
  }
  
  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (data.length >= 12 &&
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return 'webp';
  }
  
  return null;
}

/**
 * 将图片数据转换为指定格式（Canvas 与解码后图像同宽高，不缩放）。
 * @param data 原始图片数据
 * @param targetType 目标格式：'jpg' | 'jpeg' | 'png' | 'webp'
 * @returns 转换后的数据
 */
async function convertImageFormat(data: Uint8Array, targetType: 'jpg' | 'jpeg' | 'png' | 'webp'): Promise<Uint8Array> {
  const url = u8aToObjectUrl(data, 'png'); // 原始数据可能是PNG，用于解码
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context 获取失败');
    ctx.drawImage(img, 0, 0);
    
    // 根据目标格式设置MIME类型和质量
    const normalizedType = targetType.toLowerCase() === 'jpeg' ? 'jpg' : targetType.toLowerCase();
    const mime = normalizedType === 'webp' ? 'image/webp' : 
                 (normalizedType === 'jpg' ? 'image/jpeg' : 'image/png');
    const quality = normalizedType === 'png' ? undefined : 0.92; // PNG不支持质量参数
    
    const blob = await canvasToBlob(canvas, mime, quality);
    const arrayBuf = await blob.arrayBuffer();
    return new Uint8Array(arrayBuf);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 确保输出字节与期望扩展名一致：魔数已匹配则原样返回，避免二次编码；仅在不一致时用 Canvas 同尺寸重编码。
 * @param data 文件数据
 * @param expectedType 期望的类型（jpg/jpeg/png/webp）
 * @returns Promise<{ data: Uint8Array; type: string }> 数据与扩展名片段（保持 jpeg 等原始写法）
 */
async function ensureCorrectFormat(data: Uint8Array, expectedType: string): Promise<{ data: Uint8Array; type: string }> {
  const detectedType = detectImageTypeByMagicNumber(data);
  const lowerExpected = expectedType.toLowerCase();
  const normalizedExpected = lowerExpected === 'jpeg' ? 'jpg' : lowerExpected;
  const originalType = lowerExpected;

  if (detectedType && detectedType === normalizedExpected) {
    return { data, type: originalType };
  }

  if (!detectedType) {
    console.warn(`[文件类型验证] 无法识别文件头，将按期望格式尝试同尺寸重编码: ${originalType}`);
    try {
      const convertedData = await convertImageFormat(data, originalType as 'jpg' | 'jpeg' | 'png' | 'webp');
      return { data: convertedData, type: originalType };
    } catch (e) {
      console.error(`[文件类型验证] 格式转换失败:`, e);
      throw new Error('无法将图片转为所选格式，请重试或更换导出格式。');
    }
  }

  console.warn(`[文件类型验证] 魔数与期望不一致，期望: ${originalType}, 实际: ${detectedType}，将同尺寸转换`);

  try {
    const convertedData = await convertImageFormat(data, originalType as 'jpg' | 'jpeg' | 'png' | 'webp');
    return { data: convertedData, type: originalType };
  } catch (e) {
    console.error(`[文件类型验证] 格式转换失败:`, e);
    throw new Error('无法将图片转为所选格式，请重试或更换导出格式。');
  }
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
 * 使用 Canvas 固定尺寸 + 质量阶梯压缩到目标大小（仅 jpg/webp）。
 * 不使用会按浏览器上限缩小画布的第三方压缩库，避免像素尺寸被改变。
 */
async function compressJpegWebpToTarget(
  u8a: Uint8Array,
  outType: 'jpg' | 'jpeg' | 'webp',
  targetK: number,
  options: CompressStrategyOptions
): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }> {
  const mime = outType === 'webp' ? 'image/webp' : 'image/jpeg';
  const tolerance = Math.max(8, Math.floor(targetK * 0.02));
  const qualitySteps = buildQualitySteps(options, targetK, Math.floor(u8a.length / 1000));
  const url = u8aToObjectUrl(u8a, 'png');
  let bestUnder: Uint8Array | null = null;
  let bestUnderQuality = -1;
  let closest: Uint8Array | null = null;
  let closestDiff = Number.POSITIVE_INFINITY;

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context 获取失败');
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0);

    for (let i = 0; i < qualitySteps.length; i++) {
      const quality = qualitySteps[i];
      const blob = await canvasToBlob(canvas, mime, quality);
      const compressedArray = new Uint8Array(await blob.arrayBuffer());
      const sizeK = Math.floor(compressedArray.length / 1000);
      const diff = Math.abs(sizeK - targetK);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = compressedArray;
      }
      if (sizeK <= targetK) {
        if (quality > bestUnderQuality) {
          bestUnder = compressedArray;
          bestUnderQuality = quality;
        }
        if (targetK - sizeK <= tolerance) break;
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  const chosen = bestUnder || closest || u8a;
  const finalSize = Math.floor(chosen.length / 1000);
  return { u8a: chosen, sizeK: finalSize, success: finalSize <= targetK + Math.max(0, tolerance - 1) };
}

/**
 * 使用 UPNG 进行 PNG 量化压缩，保持输出仍为 PNG。
 */
async function compressPngWithUpngToTarget(
  u8a: Uint8Array,
  targetK: number,
  options: CompressStrategyOptions
): Promise<{ u8a: Uint8Array; sizeK: number; success: boolean; }> {
  try {
    const decoded = UPNG.decode(toSafeArrayBuffer(u8a));
    const rgbaList = UPNG.toRGBA8(decoded);
    /** 多帧 PNG 仅处理首帧，与原先导出假设一致 */
    const rgba = rgbaList && rgbaList.length > 0 ? new Uint8Array(rgbaList[0]) : null;
    if (!rgba) {
      const sizeK = Math.floor(u8a.length / 1000);
      return { u8a, sizeK, success: sizeK <= targetK };
    }

    const width = decoded.width;
    const height = decoded.height;
    const colorCandidates = buildPngColorCandidates(options, targetK, Math.floor(u8a.length / 1000));
    const tolerance = Math.max(8, Math.floor(targetK * 0.02));
    let bestUnder: Uint8Array | null = null;
    let bestUnderColors = -1;
    let closest: Uint8Array | null = null;
    let closestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < colorCandidates.length; i++) {
      const colors = colorCandidates[i];
      const encoded = UPNG.encode([rgba.buffer], width, height, colors);
      const current = new Uint8Array(encoded);
      const sizeK = Math.floor(current.length / 1000);
      const diff = Math.abs(sizeK - targetK);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = current;
      }
      if (sizeK <= targetK) {
        if (colors > bestUnderColors) {
          bestUnder = current;
          bestUnderColors = colors;
        }
        if (targetK - sizeK <= tolerance) break;
      }
    }

    const chosen = bestUnder || closest || u8a;
    const finalSize = Math.floor(chosen.length / 1000);
    return { u8a: chosen, sizeK: finalSize, success: finalSize <= targetK + Math.max(0, tolerance - 1) };
  } catch {
    const sizeK = Math.floor(u8a.length / 1000);
    return { u8a, sizeK, success: sizeK <= targetK };
  }
}

/**
 * 复制到独立 ArrayBuffer，规避 ArrayBufferLike 类型兼容问题。
 */
function toSafeArrayBuffer(u8a: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8a.byteLength);
  new Uint8Array(ab).set(u8a);
  return ab;
}

function buildQualitySteps(options: CompressStrategyOptions, targetK: number, originalK: number) {
  const compressionRatio = originalK > 0 ? targetK / originalK : 1;
  const isAggressive = compressionRatio < 0.6;
  const minQuality = clamp(isAggressive ? options.jpgMinQuality - 0.1 : options.jpgMinQuality, 0.3, 0.95);
  const step = clamp(isAggressive ? options.jpgQualityStep + 0.02 : options.jpgQualityStep, 0.02, 0.3);
  const maxRounds = clampInt(isAggressive ? options.jpgMaxRounds + 2 : options.jpgMaxRounds, 3, 12);
  const steps: number[] = [];
  let current = 0.92;
  for (let i = 0; i < maxRounds; i++) {
    steps.push(Number(Math.max(minQuality, current).toFixed(2)));
    current -= step;
  }
  return [...new Set(steps)];
}

function buildPngColorCandidates(options: CompressStrategyOptions, targetK: number, originalK: number) {
  const compressionRatio = originalK > 0 ? targetK / originalK : 1;
  const isAggressive = compressionRatio < 0.55;
  const adjustedMinColors = isAggressive ? Math.min(options.pngMinColors, 8) : options.pngMinColors;
  const minColors = clampInt(adjustedMinColors, 8, 256);
  const base = [256, 192, 128, 96, 64, 48, 32, 24, 16, 8];
  return base.filter((colors) => colors >= minColors);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max));
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
  
  const options: CompressStrategyOptions = { ...DEFAULT_COMPRESS_OPTIONS };

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    const targetK = item.s && item.s !== '' ? parseInt(item.s) : 0;
    let outData = item.imgData as Uint8Array;
    let outSize = Math.floor(outData.length / 1000);
    let failed = false;

    if (targetK > 0 && item.needCompress) {
      if (item.type === 'jpg' || item.type === 'jpeg' || item.type === 'webp') {
        try {
          const { u8a, sizeK, success } = await compressJpegWebpToTarget(outData, item.type as any, targetK, options);
          outData = u8a;
          outSize = sizeK;
          failed = !success;
        } catch (e) {
          failed = true;
        }
      } else if (item.type === 'png') {
        try {
          const { u8a, sizeK, success } = await compressPngWithUpngToTarget(outData, targetK, options);
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

    // 确保文件数据格式与期望格式匹配（如果格式不匹配，会进行格式转换）
    const { data: finalData, type: finalType } = await ensureCorrectFormat(outData, item.type || 'png');
    const nodeFile = `${safeNodeFileName(item.name)}.${finalType}`;
    files.push({ name: nodeFile, data: finalData });
  }

  // 获取文件MIME类型的辅助函数
  const getMimeType = (fileName: string): string => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      return 'image/jpeg';
    } else if (lowerName.endsWith('.webp')) {
      return 'image/webp';
    } else if (lowerName.endsWith('.png')) {
      return 'image/png';
    }
    // 默认返回PNG
    return 'image/png';
  };

  if (files.length === 1) {
    // 单个文件：直接保存，不打包
    const saveAs = await loadFileSaver();
    if (!saveAs) throw new Error('无法加载保存依赖（FileSaver）');
    const file = files[0];
    const mime = getMimeType(file.name);
    const blob = new Blob([file.data], { type: mime });
    (window as any).saveAs(blob, file.name);
  } else {
    // 多个文件：打包为 ZIP
    const toZip = files.map(f => ({
      name: f.name,
      data: f.data,
      type: getMimeType(f.name)
    }));
    // 压缩包名：直接使用 PageNode 的 name
    const packBase = currentPageName ? safeNodeFileName(currentPageName) : 'export';
    await zipAndSave(toZip, `${packBase}.zip`);
  }
}

