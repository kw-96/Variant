/**
 * 自动排列选中元素
 * 根据元素的宽高自动进行排列布局
 */
import { MessageType } from '../../../../../src/messages';
import { sortItems, LayoutItem, applyLayout, LayoutConfig } from '../../utils/layout-utils';

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

  // 使用统一的布局算法
  const layoutConfig: LayoutConfig = {
    x: XX,
    y: YY,
    gap: 30
  };

  applyLayout(
    landscape,
    portrait,
    square,
    layoutConfig,
    (item, x, y) => {
      selection[item.i].x = x;
      selection[item.i].y = y;
    }
  );

}

export default {
  type: MessageType.AUTO_LAYOUT as any,
  handler,
};

