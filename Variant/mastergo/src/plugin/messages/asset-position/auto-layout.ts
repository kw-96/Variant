/**
 * 自动排列选中元素
 * 根据元素的宽高自动进行排列布局
 */
import { MessageType } from '../../../../../src/messages';
import { sortItems, calculateMaxDimensions, LayoutItem } from '../../utils/layout-utils';

interface NodeInfo extends LayoutItem {
  x: number;
  y: number;
  i: number;
  node: any;
}

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    mg.notify('请先选择要排列的元素', { timeout: 2000 });
    return;
  }

  // 记录原始位置
  const XX = Math.min(...selection.map((item: any) => item.x));
  const YY = Math.min(...selection.map((item: any) => item.y));

  // 构建节点信息数组
  const nodes: NodeInfo[] = [];
  for (let i = 0; i < selection.length; i++) {
    nodes.push({
      x: selection[i].x,
      y: selection[i].y,
      w: selection[i].width,
      h: selection[i].height,
      i: i,
      node: selection[i],
    });
  }

  // 分类和排序
  const { landscape, portrait, square } = sortItems(nodes);

  // 计算 maxW 和 maxH
  const { maxW, maxH } = calculateMaxDimensions(landscape, portrait);

  const gap = 30;
  let x = XX;
  let y = YY;
  let lineMaxH: number[] = [];
  let lineMaxW: number[] = [];
  let lineW = 0;
  let lineH = 0;

  // 排列横版元素
  for (let e = 0; e < landscape.length; e++) {
    if (e !== landscape.length - 1) {
      lineW += landscape[e].w + landscape[e + 1].w;
    }
    lineMaxH.push(landscape[e].h);
    selection[landscape[e].i].x = x;
    selection[landscape[e].i].y = y;

    if (lineW > maxW) {
      lineW = 0;
      x = XX;
      y = y + Math.max(...lineMaxH) + gap;
      lineMaxH = [];
    } else {
      x = x + landscape[e].w;
    }
  }

  // 排列竖版元素（从横版右侧开始）
  x = XX + maxW + gap;
  y = YY;
  lineMaxW = [];
  lineH = 0;

  for (let e = 0; e < portrait.length; e++) {
    if (e !== portrait.length - 1) {
      lineH += portrait[e].h + portrait[e + 1].h;
    }
    lineMaxW.push(portrait[e].w);
    selection[portrait[e].i].x = x;
    selection[portrait[e].i].y = y;

    if (lineH > maxH) {
      lineH = 0;
      y = YY;
      x = x + Math.max(...lineMaxW) + gap;
      lineMaxW = [];
    } else {
      y = y + portrait[e].h;
    }
  }

  // 排列方形元素（从下方开始）
  x = XX + maxW + gap;
  y = YY + maxH + gap;
  lineMaxH = [];
  lineW = 0;

  for (let e = 0; e < square.length; e++) {
    if (e !== square.length - 1) {
      lineW += square[e].w + square[e + 1].w;
    }
    lineMaxH.push(square[e].h);
    selection[square[e].i].x = x;
    selection[square[e].i].y = y;

    if (lineW > maxW) {
      lineW = 0;
      x = XX + maxW + gap;
      y = y + Math.max(...lineMaxH) + gap;
      lineMaxH = [];
    } else {
      x = x + square[e].w + gap;
    }
  }

  mg.notify(`成功排列 ${selection.length} 个元素`, { timeout: 2000 });
}

export default {
  type: MessageType.AUTO_LAYOUT as any,
  handler,
};
