import { MessageType } from '../../../../../src/messages';
import { setSafeArea } from './safe-area';
import { categorizeItems, calculateMaxDimensions, LayoutItem } from '../../utils/layout-utils';

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
  if (selection.length === 0) {
    mg.notify('请先选择一个模板图层', { timeout: 2000 });
    return;
  }

  const template = selection[0];
  const gap = 30;

  // 获取视口位置
  const viewportBounds = (mg as any).viewport?.bounds || { x: 0, y: 0, width: 800, height: 600 };
  const viewX = viewportBounds.x;
  const viewY = viewportBounds.y;

  // 分类画板（包含 KV）
  const categories = categorizeItems(data, true);

  // 计算 maxW 和 maxH
  const { maxW, maxH } = calculateMaxDimensions(categories.landscape, categories.portrait);

  // 1. 处理 KV（横向排列）
  const kvH: number[] = [0];
  let currentX = viewX;
  let currentY = viewY;

  categories.kv.forEach(item => {
    const isPng = item.type?.toLowerCase() === 'png';
    const frame = createFrame(item, currentX, currentY, isPng);
    cloneComponent(frame, template, item);
    currentX += item.w + gap;
    kvH.push(item.h);
  });

  // 2. 处理横版（横向排列）
  currentX = viewX;
  currentY = viewY + Math.max(...kvH) + gap;
  
  const lineH: number[] = [];
  let lineAllW = 0;
  
  categories.landscape.forEach((item, i) => {
    const isPng = item.type?.toLowerCase() === 'png';
    const frame = createFrame(item, currentX, currentY, isPng);
    cloneComponent(frame, template, item);
    
    lineAllW += item.w + gap;
    lineH.push(item.h);
    
    const nextItem = categories.landscape[i + 1];
    if (nextItem && (lineAllW + nextItem.w) <= maxW) {
      currentX += item.w + gap;
    } else {
      currentX = viewX;
      currentY += Math.max(...lineH) + gap;
      lineH.length = 0;
      lineAllW = 0;
    }
  });

  // 3. 处理竖版（纵向排列）
  currentX = viewX + maxW + gap;
  currentY = viewY + Math.max(...kvH) + gap;
  
  const lineW: number[] = [];
  let lineAllH = 0;
  
  categories.portrait.forEach((item, i) => {
    let isPng = item.type?.toLowerCase() === 'png';
    if (item.name && item.name.split('弹窗').length > 1) {
      isPng = true;
    }
    const frame = createFrame(item, currentX, currentY, isPng);
    cloneComponent(frame, template, item);
    
    lineAllH += item.h + gap;
    lineW.push(item.w);
    
    const nextItem = categories.portrait[i + 1];
    if (nextItem && (lineAllH + nextItem.h) <= maxH) {
      currentY += item.h + gap;
    } else {
      currentY = viewY + Math.max(...kvH) + gap;
      currentX += Math.max(...lineW) + gap;
      lineW.length = 0;
      lineAllH = 0;
    }
  });

  // 4. 处理方形（横向排列）
  currentX = viewX + maxW + gap;
  currentY = viewY + Math.max(...kvH) + gap + maxH;
  
  lineH.length = 0;
  lineAllW = 0;
  
  categories.square.forEach((item, i) => {
    const isPng = item.type?.toLowerCase() === 'png';
    const frame = createFrame(item, currentX, currentY, isPng);
    cloneComponent(frame, template, item);
    
    lineAllW += item.w + gap;
    lineH.push(item.h);
    
    const nextItem = categories.square[i + 1];
    if (nextItem && (lineAllW + nextItem.w) <= maxW) {
      currentX += item.w + gap;
    } else {
      currentX = viewX + maxW + gap;
      currentY += Math.max(...lineH) + gap;
      lineH.length = 0;
      lineAllW = 0;
    }
  });

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
  const maxName = `${item.name} ${item.s}k ${item.w}×${item.h}`;
  node.name = item.s ? maxName : minName;
  
  // 设置插件数据
  if (item.s) {
    node.setPluginData('s', String(item.s));
  }
  if (item.type) {
    node.setPluginData('type', item.type);
  }
  
  // PNG 类型需要透明填充
  if (isPng) {
    node.fills = [];
  }

  // 添加到页面
  const currentPage = (mg as any).document?.currentPage;
  currentPage.appendChild(node);
  
  // 设置安全区
  if (item.safeArea) {
    setSafeArea(node, item.w, item.h, item.safeArea);
  }
  
  return node;
}

/**
 * 克隆组件到画板
 */
function cloneComponent(frame: any, template: any, item: FrameData): void {
  if (!template) return;

  let instance: any;
  
  if (template.type === 'COMPONENT') {
    instance = template.createInstance();
  } else if (template.type === 'INSTANCE') {
    instance = template.mainComponent.createInstance();
  } else {
    instance = template.clone();
  }

  // MasterGo 需要先添加到画板再调整
  frame.appendChild(instance);
  
  // 调整实例大小以匹配画板
  instance.width = item.w;
  instance.height = item.h;
  instance.x = 0;
  instance.y = 0;
}

export default {
  type: MessageType.CREATE_FRAMES,
  handler,
};
