import { MessageType } from '../../../../../src/messages';
import { setSafeArea } from './safe-area';
import { LayoutItem, applyLayout, LayoutConfig } from '../../utils/layout-utils';
import { placeTemplateInstance } from '../../utils/component-utils';

interface FrameData extends LayoutItem {
  name: string;
  s?: string;
  type?: string;
  safeArea?: string;
}

/**
 * 创建画板消息处理器
 * 根据UI端发送的数据创建多个画板，并自动排列
 * @param data 包含画板信息的数组
 */
function handler(data: FrameData[]) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  if (data.length === 0) {
    mg.notify('没有数据可用于创建画板', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  const template = selection.length > 0 ? selection[0] : null;
  
  const gap = 30;

  // 计算起始位置
  let startX: number;
  let startY: number;
  
  if (selection.length > 0) {
    // 如果有选中节点，从选中节点右侧开始排列（距离为2倍gap）
    const selectedNode = selection[0];
    startX = selectedNode.x + selectedNode.width + gap * 2;
    startY = selectedNode.y;
  } else {
    // 如果没有选中节点，使用画布视口中心位置
    const viewportCenter = (mg as any).viewport.center;
    startX = viewportCenter.x;
    startY = viewportCenter.y;
  }

  // 第一步：先创建所有画板（放在临时位置，稍后统一排列）
  const frames: Array<{ frame: any; data: FrameData }> = [];
  
  data.forEach((item) => {
    const isPng = item.type?.toLowerCase() === 'png';
    // 临时位置，后续会统一排列
    const frame = createFrame(item, 0, 0, isPng);
    if (template) {
      cloneComponent(frame, template, item);
    }
    // 确保安全区矩形位于容器最上层（在组件克隆之后）
    bringSafeAreasToTop(frame);
    frames.push({ frame, data: item });
  });

  // 第二步：分类画板（横版、竖版、方形）
  const frameCategories = {
    landscape: frames.filter(f => f.data.w > f.data.h),
    portrait: frames.filter(f => f.data.w < f.data.h),
    square: frames.filter(f => f.data.w === f.data.h),
  };

  // 第三步：使用统一的布局算法进行排列
  const layoutConfig: LayoutConfig = {
    x: startX,
    y: startY,
    gap
  };

  applyLayout(
    frameCategories.landscape.map(f => f.data),
    frameCategories.portrait.map(f => f.data),
    frameCategories.square.map(f => f.data),
    layoutConfig,
    (item, x, y) => {
      // 找到对应的画板并设置位置
      const frameItem = frames.find(f => f.data === item);
      if (frameItem) {
        frameItem.frame.x = x;
        frameItem.frame.y = y;
      }
    }
  );

  mg.notify(`成功创建 ${data.length} 个画板`, { timeout: 2000 });
}

/**
 * 创建画板
 */
function createFrame(item: FrameData, x: number, y: number, isPng: boolean): any {
  const node = mg.createFrame();
  node.x = x;
  node.y = y;
  node.width = item.w;
  node.height = item.h;
  
  // 设置名称
  const minName = `${item.name} ${item.w}×${item.h}`;
  const maxName = `${item.name} ${item.s} ${item.w}×${item.h}`;
  node.name = item.s ? maxName : minName;
  
  // 设置插件数据（如果 API 存在）
  try {
    if (item.s && typeof node.setPluginData === 'function') {
      node.setPluginData('s', String(item.s));
    }
    if (item.type && typeof node.setPluginData === 'function') {
      node.setPluginData('type', item.type);
    }
  } catch (e) {
    // setPluginData 可能不存在或出错，忽略
  }
  
  // PNG 类型需要透明填充
  if (isPng) {
    node.fills = [];
  }

  // 添加到页面
  const currentPage = (mg as any).document?.currentPage;
  currentPage.appendChild(node);
  
  // 设置安全区（如果存在）
  try {
    if (item.safeArea) {
      setSafeArea(node, item.w, item.h, item.safeArea);
    }
  } catch (e) {
    // 安全区设置失败不影响画板创建
    console.warn('设置安全区失败:', e);
  }
  
  return node;
}

/**
 * 克隆组件到画板
 */
function cloneComponent(frame: any, template: any, item: FrameData): void {
  placeTemplateInstance(frame, template, item.w, item.h);
}

/**
 * 将安全区矩形移到容器最上层
 * @param frame 画板节点
 */
function bringSafeAreasToTop(frame: any): void {
  if (!frame || !frame.children) return;
  
  // 找到所有安全区矩形（名称以 safeArea- 开头）
  const safeAreaRectangles = frame.children.filter((child: any) => 
    child.name && child.name.startsWith('safeArea-')
  );
  
  // 将所有安全区矩形移到最上层（移动到 children 数组末尾）
  safeAreaRectangles.forEach((rectangle: any) => {
    frame.appendChild(rectangle);
  });
}

export default {
  type: MessageType.CREATE_FRAMES,
  handler,
};
