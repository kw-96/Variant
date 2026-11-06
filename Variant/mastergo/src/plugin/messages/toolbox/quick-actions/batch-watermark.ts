/**
 * 批量水印功能（主线程侧）—— 由「批量水印」插件 index.js 移植
 * 支持两种来源：
 *   - 当前选中素材（clone / createInstance 后缩放放入目标画板）
 *   - 上传图片（createImage → 矩形填充）
 * 目标范围：整个文档 / 当前页 / 选中画板。
 */
import { MessageType, sendMsgToUI } from '../../../../../../src/messages';

const M: any = mg as any;

/* ---------------------- 选区推送 ---------------------- */

function pushSelection() {
  const sel = (M.document?.currentPage?.selection || []) as any[];
  const n = sel.length === 1 ? sel[0] : null;
  sendMsgToUI(MessageType.WATERMARK_SELECTION, {
    node: n
      ? {
          id: n.id,
          name: n.name,
          type: n.type,
          width: Math.round(n.width),
          height: Math.round(n.height),
        }
      : null,
    count: sel.length,
  });
}

/* ---------------------- 目标画板收集 ---------------------- */

function getCurrentSelection(): any[] {
  try {
    const s = M.document?.currentPage?.selection;
    if (s && s.length > 0) return s;
  } catch (e) {}
  try {
    const s = M.currentPage?.selection;
    if (s && s.length > 0) return s;
  } catch (e) {}
  try {
    const s = M.document?.selection;
    if (s && s.length > 0) return s;
  } catch (e) {}
  return [];
}

function getFrames(excludeId: string | null, scope: string): any[] {
  const isCanvas = (n: any) => (n.type === 'FRAME' || n.type === 'COMPONENT') && n.id !== excludeId;

  if (scope === 'selected') {
    const list = getCurrentSelection();
    if (list.length === 0) {
      mg.notify('画布上没有选中项');
      return [];
    }
    const frames = list.filter(isCanvas);
    if (frames.length === 0) {
      const types = list.map((n: any) => n.type).join(', ');
      mg.notify(`选中 ${list.length} 项，类型 [${types}]，无画板`);
    }
    return frames;
  }

  const topLevel = (n: any) => {
    if (!isCanvas(n)) return false;
    const p = n.parent;
    return p && p.type !== 'FRAME' && p.type !== 'INSTANCE' && p.type !== 'COMPONENT';
  };

  // 容错：部分运行时可能不提供 findAll，回退为当前页顶层子节点
  const page = M.document?.currentPage;
  if (scope === 'page') {
    try {
      if (page && typeof page.findAll === 'function') return page.findAll(topLevel);
    } catch (e) {
      // 回退
    }
    return (page?.children || []).filter(topLevel);
  }
  try {
    if (M.document && typeof M.document.findAll === 'function') return M.document.findAll(topLevel);
  } catch (e) {
    // 回退
  }
  return (page?.children || []).filter(topLevel);
}

const WATERMARK_DATA_KEY = 'pluginWatermark';

/** 给插件创建的水印打标记，重复应用时只清理自己创建的水印，避免误删用户同名图层 */
function tagWatermark(node: any) {
  try {
    if (node && typeof node.setPluginData === 'function') {
      node.setPluginData(WATERMARK_DATA_KEY, '1');
    }
  } catch (e) {
    // 忽略：运行时可能不支持 pluginData
  }
}

function isPluginWatermark(node: any): boolean {
  try {
    return !!(node && typeof node.getPluginData === 'function' && node.getPluginData(WATERMARK_DATA_KEY) === '1');
  } catch (e) {
    return false;
  }
}

function removeOld(frame: any) {
  const olds = (frame?.children || []).filter(isPluginWatermark);
  for (const n of olds) n.remove();
}

function calcWidth(widthMode: string, widthValue: number, frameWidth: number): number {
  if (widthMode === 'ratio') {
    return Math.max(1, frameWidth * (widthValue / 100));
  }
  return Math.min(widthValue, frameWidth * 0.95);
}

function scaleNode(node: any, scale: number) {
  if (typeof node.rescale === 'function') {
    try {
      node.rescale(scale);
      return;
    } catch (e) {}
  }
  node.resize(node.width * scale, node.height * scale);
}

function placePosition(node: any, frame: any, position: string, margin: number) {
  const fw = frame.width;
  const fh = frame.height;
  const nw = node.width;
  const nh = node.height;
  let x: number;
  let y: number;
  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-center':
      x = (fw - nw) / 2;
      y = margin;
      break;
    case 'top-right':
      x = fw - nw - margin;
      y = margin;
      break;
    case 'center':
      x = (fw - nw) / 2;
      y = (fh - nh) / 2;
      break;
    case 'bottom-left':
      x = margin;
      y = fh - nh - margin;
      break;
    case 'bottom-right':
      x = fw - nw - margin;
      y = fh - nh - margin;
      break;
    case 'bottom-center':
    default:
      x = (fw - nw) / 2;
      y = fh - nh - margin;
      break;
  }
  node.x = Math.round(x);
  node.y = Math.round(y);
}

/* ---------------------- 应用水印 ---------------------- */

async function applySelection(data: any) {
  const { sourceId, scope, position, widthMode, widthValue, opacity, margin } = data || {};
  let src: any = null;
  try {
    src = typeof M.getNodeById === 'function' ? M.getNodeById(sourceId) : null;
  } catch (e) {
    src = null;
  }
  if (!src) {
    mg.notify('素材已丢失，请重新选中');
    return;
  }
  const frames = getFrames(sourceId, scope);
  if (frames.length === 0) {
    mg.notify('未找到目标画板');
    return;
  }

  for (const frame of frames) {
    removeOld(frame);
    const copy = src.type === 'COMPONENT' ? src.createInstance() : src.clone();
    copy.name = 'watermark';
    tagWatermark(copy);
    const targetW = calcWidth(widthMode, widthValue, frame.width);
    scaleNode(copy, targetW / src.width);
    copy.opacity = opacity;
    frame.appendChild(copy);
    placePosition(copy, frame, position, margin);
  }
  mg.commitUndo();
  mg.notify(`已为 ${frames.length} 个画板添加水印`);
}

async function applyImage(data: any) {
  const { bytes, imgWidth, imgHeight, scope, position, widthMode, widthValue, opacity, margin } = data || {};
  const frames = getFrames(null, scope);
  if (frames.length === 0) {
    mg.notify('未找到目标画板');
    return;
  }

  const handle = await M.createImage(new Uint8Array(bytes));
  const ratio = imgHeight / imgWidth;

  for (const frame of frames) {
    removeOld(frame);
    const rect = M.createRectangle();
    rect.name = 'watermark';
    tagWatermark(rect);
    const w = calcWidth(widthMode, widthValue, frame.width);
    rect.resize(w, w * ratio);
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageRef: handle.href }];
    rect.opacity = opacity;
    frame.appendChild(rect);
    placePosition(rect, frame, position, margin);
  }
  mg.commitUndo();
  mg.notify(`已为 ${frames.length} 个画板添加水印`);
}

/* ---------------------- 导出处理器 ---------------------- */

export default [
  {
    type: MessageType.WATERMARK_GET_SELECTION,
    handler: () => {
      pushSelection();
    },
  },
  {
    type: MessageType.WATERMARK_APPLY_SELECTION,
    handler: (data: any) => {
      applySelection(data).catch((e: any) => {
        console.error(e);
        mg.notify('出错: ' + (e && e.message ? e.message : e));
      });
    },
  },
  {
    type: MessageType.WATERMARK_APPLY_IMAGE,
    handler: (data: any) => {
      applyImage(data).catch((e: any) => {
        console.error(e);
        mg.notify('出错: ' + (e && e.message ? e.message : e));
      });
    },
  },
];
