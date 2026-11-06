/**
 * 一键抠图（主线程侧）
 * 说明：原图完整保留不动；UI 逐张回传抠好的 PNG，主线程在原图右侧新建
 *       矩形节点承载抠图结果（放回 MG 文件里，不覆盖原图）。
 */
import { MessageType, sendMsgToUI } from '../../../../../src/messages';

// index → 原选中节点，用于给结果定位（放在原图右侧）
let cutoutNodes: any[] = [];
// 本次抠图新建的节点，收尾时统一选中
let cutoutNew: any[] = [];

/** 返回节点 fills 中第一个 IMAGE 填充的下标，无则 -1。 */
function firstImageFillIndex(node: any): number {
  let fills;
  try {
    fills = node.fills;
  } catch (e) {
    return -1;
  }
  if (!Array.isArray(fills)) return -1;
  for (let i = 0; i < fills.length; i++) {
    if (fills[i] && fills[i].type === 'IMAGE') return i;
  }
  return -1;
}

/** 导出所有“带图片填充”的选中节点 PNG，交给 UI 预览与逐张处理（不改任何节点）。 */
async function handleLoad() {
  const currentPage = (mg as any).document?.currentPage;
  const selection = (currentPage && currentPage.selection) || [];
  cutoutNodes = [];
  cutoutNew = [];

  if (selection.length === 0) {
    sendMsgToUI(MessageType.CUTOUT_IMAGES, { items: [] });
    return;
  }

  const items: any[] = [];
  let idx = 0;
  for (let i = 0; i < selection.length; i++) {
    const node = selection[i];
    if (firstImageFillIndex(node) === -1) continue;
    try {
      const bytes = await node.exportAsync({ format: 'PNG' });
      const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      items.push({ index: idx, name: node.name, bytes: buf });
      cutoutNodes[idx] = node;
      idx++;
    } catch (e) {
      // 导出失败的节点跳过，不阻塞其它
    }
  }

  sendMsgToUI(MessageType.CUTOUT_IMAGES, { items });
}

/** 接收 UI 抠好的单张 PNG：在原图右侧新建矩形节点承载它（原图不动）。 */
async function handleResult(data: any) {
  const index = data && data.index;
  const bytes = data && data.bytes;
  const node = cutoutNodes[index];
  if (!node) {
    sendMsgToUI(MessageType.CUTOUT_APPLIED, { fail: '第 ' + (index + 1) + ' 张：原节点丢失' });
    return;
  }
  try {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const image = await (mg as any).createImage(u8);
    const rect = mg.createRectangle();
    rect.resize(node.width, node.height);
    rect.x = node.x + node.width + 40;
    rect.y = node.y;
    rect.name = node.name;
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageRef: image.href }];
    const parent = node.parent;
    if (parent && typeof parent.appendChild === 'function') {
      parent.appendChild(rect);
    }
    cutoutNew.push(rect);
    sendMsgToUI(MessageType.CUTOUT_APPLIED, {});
  } catch (e: any) {
    sendMsgToUI(MessageType.CUTOUT_APPLIED, {
      fail: node.name + '：放回失败（' + String((e && e.message) || e) + '）',
    });
  }
}

/** 抠图收尾：选中所有新建节点并提交撤销记录，通知 UI 结束。 */
function handleFlush() {
  try {
    if (cutoutNew.length) (mg as any).document.currentPage.selection = cutoutNew;
  } catch (e) {}
  if (cutoutNew.length) mg.commitUndo();
  sendMsgToUI(MessageType.CUTOUT_FINISHED, {});
  cutoutNew = [];
}

export default [
  { type: MessageType.CUTOUT_LOAD as any, handler: handleLoad },
  { type: MessageType.CUTOUT_RESULT as any, handler: handleResult },
  { type: MessageType.CUTOUT_FLUSH as any, handler: handleFlush },
];
