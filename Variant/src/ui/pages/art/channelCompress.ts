/**
 * 资源位导出：渠道分类 + 压缩 + 打包。移植自 MG插件 index.html。
 * 说明：扫描（导出画板字节）由主线程完成，这里负责渠道解析、压缩到目标大小、无损 ZIP 打包与下载。
 */

import UPNG from 'upng-js';

export interface ScanAsset {
  name: string;
  width: number;
  height: number;
  size: number;
  format: 'JPG' | 'PNG';
  /** 完整组件描述（原生描述/隐藏字段/名称匹配得到，供「渠道+组件描述」分组） */
  componentDescription?: string;
  /** 组件描述来源：原生描述 / 隐藏字段 / 名称匹配 / 未匹配 */
  descriptionSource?: 'native' | 'plugin' | 'match' | 'none';
  buf: Uint8Array;
}

export interface RowSetting {
  targetKB: number | null;
  format: 'JPG' | 'PNG';
}

export interface RowStatus {
  text: string;
  state: 'compressing' | 'done' | 'skipped' | 'fail';
}

type ProgressCb = (done: number, total: number, label: string) => void;
type RowStatusCb = (index: number, status: RowStatus) => void;

/* ============================ 渠道 / 名称解析 ============================ */

const CHANNEL_KEYWORDS = [
  '华为', '荣耀', 'OPPO', '小米', 'vivo', '应用宝', '魅族',
  '三星', '联想', '一加', 'realme', '中兴', '努比亚',
  '苹果', '百度', '腾讯', '京东', '拼多多', '今日头条',
  '抖音', '快手', '微博', '哔哩哔哩', 'B站', '支付宝',
  '4399', '九游', '快爆', '233',
  '360', '微信', '算法', '益玩', '雷电',
];

// 从名称解析渠道：先扫关键词，再用「渠道-文件名」连字符规则，否则未分类
export function parseChannel(name: string): { channel: string; valid: boolean } {
  const searchText = String(name || '').toLowerCase();
  for (const kw of CHANNEL_KEYWORDS) {
    if (searchText.indexOf(kw.toLowerCase()) !== -1) return { channel: kw, valid: true };
  }
  const dash = String(name || '').indexOf('-');
  if (dash > 0) return { channel: String(name).slice(0, dash).trim(), valid: true };
  return { channel: '未分类', valid: false };
}

// 从名称解析目标大小（KB），如 500k / 150KB
export function parseTargetKB(name: string): number | null {
  const m = String(name || '').match(/(\d+(?:\.\d+)?)\s*k(?:b)?(?!\w)/i);
  return m ? parseFloat(m[1]) : null;
}

/* ============================ 二级文件夹分组（渠道 + 组件描述） ============================ */

// 每个 (渠道 + 组件描述) 分组的资源数量；仅当某组 ≥2 时才建二级文件夹
// 无组件描述的资源直接放在渠道文件夹根目录，不影响导出结果
let descGroupCount: Record<string, number> = {};

function descKey(channel: string, description: string): string {
  return channel.toLowerCase() + '|' + description;
}

function exportDescription(asset: ScanAsset): string {
  const description = String(asset.componentDescription || '').trim();
  if (asset.descriptionSource === 'native' || asset.descriptionSource === 'match') return description;
  const separator = description.indexOf('::');
  return separator === -1 ? description : description.slice(separator + 2).trim();
}

function buildDescriptionGroups(assets: ScanAsset[]) {
  descGroupCount = {};
  assets.forEach((a) => {
    const desc = exportDescription(a);
    if (!desc) return;
    const ch = parseChannel(a.name).channel;
    const key = descKey(ch, desc);
    descGroupCount[key] = (descGroupCount[key] || 0) + 1;
  });
}

// 图层名 → ZIP 内相对路径（渠道/[组件描述/]文件名.ext）
function safeSeg(s: string): string {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
}

function assetPath(
  asset: ScanAsset,
  ext: string,
  usedPaths: Record<string, boolean>,
  groupByChannel = true
): string {
  const name = asset.name;
  // 关闭按渠道分组：平铺导出，只保留文件名
  if (!groupByChannel) {
    const base = safeSeg(name);
    let flat = base + '.' + ext;
    let n = 2;
    while (usedPaths[flat]) {
      flat = base + '_' + n + '.' + ext;
      n++;
    }
    usedPaths[flat] = true;
    return flat;
  }
  const r = parseChannel(name);
  const folder = safeSeg(r.channel);
  let path = folder + '/';
  const desc = exportDescription(asset);
  // 仅当同一渠道、同一组件描述下存在 2 个及以上资源位时，才创建二级文件夹
  if (desc && (descGroupCount[descKey(r.channel, desc)] || 0) >= 2) {
    path += safeSeg(desc) + '/';
  }
  const base = safeSeg(name);
  let full = path + base + '.' + ext;
  let n = 2;
  while (usedPaths[full]) {
    full = path + base + '_' + n + '.' + ext;
    n++;
  }
  usedPaths[full] = true;
  return full;
}

/* ============================ 无损 STORE ZIP 打包 ============================ */

const CRC_TABLE = (function () {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(u8: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Array<{ header: Uint8Array; name: Uint8Array }> = [];
  let offset = 0;
  let centralSize = 0;

  entries.forEach((e) => {
    const nameBytes = enc.encode(e.path);
    const data = e.data;
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true);
    lh.setUint16(12, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameBytes, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true);
    ch.setUint16(14, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    central.push({ header: new Uint8Array(ch.buffer), name: nameBytes });

    offset += 30 + nameBytes.length + data.length;
  });

  const centralStart = offset;
  central.forEach((c) => {
    chunks.push(c.header, c.name);
    centralSize += c.header.length + c.name.length;
  });

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);
  eocd.setUint16(20, 0, true);
  chunks.push(new Uint8Array(eocd.buffer));

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}

/* ============================ 压缩（Canvas） ============================ */

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, q: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, mime, q));
}

async function bufToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

// 把导出的 PNG 字节压缩到目标大小（KB），返回 {data, ext, skipped?}
async function compressAsset(
  pngU8: Uint8Array,
  format: 'JPG' | 'PNG',
  targetKB: number | null
): Promise<{ data: Uint8Array; ext: string; skipped?: boolean }> {
  // PNG 且无目标大小：原样保留（无损）
  if (format === 'PNG' && !targetKB) return { data: pngU8, ext: 'png' };

  // PNG 且已小于目标大小：跳过压缩，保留原始文件
  if (format === 'PNG' && targetKB && pngU8.length <= targetKB * 1024) {
    return { data: pngU8, ext: 'png', skipped: true };
  }

  const srcBlob = new Blob([pngU8 as BlobPart], { type: 'image/png' });
  const bmp = await createImageBitmap(srcBlob);
  const w = bmp.width;
  const h = bmp.height;

  if (format === 'JPG') {
    const mime = 'image/jpeg';
    const ext = 'jpg';
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0);

    if (!targetKB) {
      return { data: await bufToU8((await canvasToBlob(canvas, mime, 0.92))!), ext };
    }
    const targetBytes = targetKB * 1024;
    const full = (await canvasToBlob(canvas, mime, 1.0))!;
    if (full.size <= targetBytes) return { data: await bufToU8(full), ext };
    let lo = 0.05;
    let hi = 1.0;
    let best = full;
    for (let i = 0; i < 12; i++) {
      const q = (lo + hi) / 2;
      const b = (await canvasToBlob(canvas, mime, q))!;
      if (b.size <= targetBytes) {
        best = b;
        lo = q;
      } else hi = q;
      if (hi - lo < 0.004) break;
    }
    return { data: await bufToU8(best), ext };
  }

  // PNG 且有目标大小：只压不转格式，用 UPNG（PCA 量化 + 优化 deflate）
  const targetBytes = targetKB! * 1024;
  if (pngU8.length <= targetBytes) return { data: pngU8, ext: 'png' };

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const baseData = ctx.getImageData(0, 0, w, h).data;

  // 优先无损重编码（更优 filter + deflate，尺寸不变、颜色 100% 不变）
  // 很多 PNG 只是原本压得差，走一遍无损即可达标，无需任何减色
  let lossless: ArrayBuffer | null = null;
  try {
    lossless = UPNG.encode([baseData.buffer], w, h, 0);
  } catch (e) {}
  if (lossless && lossless.byteLength <= targetBytes) {
    return { data: new Uint8Array(lossless), ext: 'png' };
  }

  // 二分调色板颜色数：取"≤目标大小"的最多颜色（画质最好）
  let lo = 2;
  let hi = 256;
  let best: ArrayBuffer | null = null;
  for (let i = 0; i < 12; i++) {
    const colors = Math.round((lo + hi) / 2);
    let out: ArrayBuffer;
    try {
      out = UPNG.encode([baseData.buffer], w, h, colors);
    } catch (e) {
      break;
    }
    if (out.byteLength <= targetBytes) {
      best = out;
      lo = colors + 1;
    } else hi = colors - 1;
    if (lo > hi) break;
  }
  if (!best) throw new Error('无法压缩到目标大小');

  // 色差校验：解码压缩结果与原图逐像素比对，掉色明显则判定压缩失败
  const cd = new Uint8Array(UPNG.toRGBA8(UPNG.decode(best))[0]);
  let diffSum = 0;
  let cnt = 0;
  for (let i = 0; i < baseData.length; i += 4) {
    if (baseData[i + 3] === 0) continue; // 全透明像素不计
    diffSum +=
      Math.abs(baseData[i] - cd[i]) +
      Math.abs(baseData[i + 1] - cd[i + 1]) +
      Math.abs(baseData[i + 2] - cd[i + 2]);
    cnt++;
  }
  const avgDiff = cnt ? diffSum / (cnt * 3) : 0; // 每通道平均色差 0~255
  if (avgDiff > 12) {
    throw new Error('色值损失过大（平均色差 ' + avgDiff.toFixed(1) + '/255）');
  }
  return { data: new Uint8Array(best), ext: 'png' };
}

/* ============================ 导出主流程 ============================ */

function downloadBlob(data: Blob | Uint8Array, filename: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function fmtKB(bytes: number): string {
  return Math.round(bytes / 1024) + 'k';
}

function fmtKBExact(bytes: number): string {
  return (Math.ceil((bytes / 1024) * 10) / 10) + 'k';
}

// 压缩全部资源并打包/下载。
// 结果只看：图片是否生成、导出流程是否完成、文件大小是否达到目标（未设置目标则不检查大小）
// oversize：最终导出文件超过目标 KB 的条目说明
// groupByChannel：是否按渠道（及组件描述）建目录；关闭时平铺输出
export async function exportChannelZip(
  assets: ScanAsset[],
  settings: RowSetting[],
  _scanFails: string[],
  onProgress: ProgressCb,
  onRowStatus: RowStatusCb,
  pageName?: string,
  groupByChannel = true
): Promise<{ count: number; oversize: string[] }> {
  // 单张导出直接下载，不做组件描述分组
  if (groupByChannel && assets.length > 1) {
    buildDescriptionGroups(assets);
  } else {
    descGroupCount = {};
  }

  const total = assets.length;
  const entries: Array<ZipEntry & { name: string; ext: string }> = [];
  const usedPaths: Record<string, boolean> = {};
  const oversize: string[] = [];

  for (let i = 0; i < total; i++) {
    const a = assets[i];
    const s = settings[i] || { targetKB: null, format: 'PNG' as const };
    const pngU8 = a.buf instanceof Uint8Array ? a.buf : new Uint8Array(a.buf);
    onRowStatus(i, { state: 'compressing', text: fmtKB(a.size) + ' / 压缩中…' });
    onProgress(i + 0.5, total, '压缩中 ' + (i + 1) + ' / ' + total + '：' + a.name);

    let data: Uint8Array;
    let ext: string;
    let skipped = false;
    let fallback = false;
    try {
      const out = await compressAsset(pngU8, s.format, s.targetKB);
      data = out.data;
      ext = out.ext;
      skipped = !!out.skipped;
    } catch (e) {
      // 压缩失败仍导出原图（未压缩），避免漏图
      data = pngU8;
      ext = 'png';
      fallback = true;
    }
    entries.push({
      path: assetPath(a, ext, usedPaths, groupByChannel),
      data,
      name: a.name,
      ext,
    });

    const sizeOk = !s.targetKB || data.length <= s.targetKB * 1024;
    const sizeInfo = '实际 ' + fmtKBExact(data.length) + ' / 目标 ' + s.targetKB + 'k';
    if (!sizeOk) {
      oversize.push(a.name + '：' + (fallback ? '已导出原图，但大小未达标' : '已压缩，但大小未达标') + '（' + sizeInfo + '）');
      onRowStatus(i, {
        state: 'fail',
        text: fmtKB(a.size) + ' → ' + fmtKB(data.length) + (fallback ? ' 已导出原图，大小未达标' : ' 大小未达标'),
      });
    } else if (fallback) {
      onRowStatus(i, { state: 'done', text: fmtKB(a.size) + ' / 已导出原图' });
    } else {
      onRowStatus(i, {
        state: skipped ? 'skipped' : 'done',
        text: skipped
          ? fmtKB(a.size) + ' / 小于目标，已跳过'
          : fmtKB(a.size) + ' → ' + fmtKB(data.length) + ' 已完成',
      });
    }
  }

  onProgress(total, total, '打包中...');

  // 只有一个顶级文件夹分类时：去掉该文件夹层级（平铺导出时无需处理）
  if (groupByChannel) {
    const topFolders: Record<string, boolean> = {};
    entries.forEach((e) => {
      topFolders[e.path.split('/')[0]] = true;
    });
    if (Object.keys(topFolders).length === 1) {
      entries.forEach((e) => {
        e.path = e.path.split('/').slice(1).join('/');
      });
    }
  }

  if (entries.length === 1) {
    const e = entries[0];
    downloadBlob(e.data, safeSeg(e.name) + '.' + e.ext);
    return { count: 1, oversize };
  }

  // 多文件打包为 ZIP：使用当前 MasterGo 画板页面名称命名，并过滤 Windows 非法字符
  const zipBase = safeSeg(pageName || '');
  const zipName = (zipBase && zipBase !== '未命名')
    ? zipBase + '.zip'
    : '资源位导出_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.zip';
  downloadBlob(buildZip(entries), zipName);
  return { count: entries.length, oversize };
}
