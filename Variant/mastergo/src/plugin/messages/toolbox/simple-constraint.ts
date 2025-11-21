/**
 * 简单约束
 * 将容器内的子节点约束设置为 SCALE，并根据父容器尺寸调整图片填充模式
 */
import { MessageType } from '../../../../../src/messages';

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    mg.notify('请先选择要处理的容器', { timeout: 2000 });
    return;
  }

  let processedCount = 0;

  const processNode = (node: any) => {
    if (!node || (node.name && node.name.includes('#no'))) {
      return;
    }

    if ('constraints' in node) {
      try {
        node.constraints = {
          horizontal: 'SCALE',
          vertical: 'SCALE',
        };
      } catch (error) {
        console.warn('设置约束失败', error);
      }
    }
    
    if ('fills' in node && Array.isArray(node.fills)) {
      const parent = node.parent;
      node.fills = node.fills.map((fill: any) => {
        if (fill?.type !== 'IMAGE') {
          return fill;
        }

        const canCompareSize =
          parent &&
          typeof parent.width === 'number' &&
          typeof parent.height === 'number' &&
          typeof node.width === 'number' &&
          typeof node.height === 'number';
        
        const scaleMode = canCompareSize && node.width >= parent.width && node.height >= parent.height
          ? 'FILL'
          : 'FIT';

        return { ...fill, scaleMode };
      });
    }

    processedCount += 1;
  };

  selection.forEach((node: any) => {
    if (!node) return;

    const isContainer = ['FRAME', 'COMPONENT', 'INSTANCE'].includes(node.type);
    if (isContainer && Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        if (child && child.name && !child.name.includes('#no')) {
          processNode(child);
        }
      });
    }
  });

  if (processedCount > 0) {
    mg.notify(`已处理 ${processedCount} 个图层`, { timeout: 2000 });
  } else {
    mg.notify('未找到可处理的子图层', { timeout: 2000 });
  }
}

export default {
  type: MessageType.SIMPLE_CONSTRAINT,
  handler,
};


