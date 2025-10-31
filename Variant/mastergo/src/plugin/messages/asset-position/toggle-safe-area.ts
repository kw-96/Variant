import { MessageType, sendMsgToUI } from '../../../../../src/messages';

// ==================== 切换安全区显示/隐藏 ====================
// 用于显隐安全区按钮功能
// 切换选中容器内所有带有 safeArea- 前缀的节点的显示/隐藏状态
function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    return;
  }

  // 收集所有容器中的安全区节点
  const allSafeAreaNodes: any[] = [];
  
  // 遍历所有选中的容器
  for (let i = 0; i < selection.length; i++) {
    const container = selection[i];
    
    // 检查是否为容器类型（有 children 属性）
    if (!container.children || typeof container.children !== 'object') {
      continue;
    }

    // 遍历容器的所有子节点
    const children = container.children;
    
    if (Array.isArray(children)) {
      children.forEach((child: any) => {
        if (child.name && typeof child.name === 'string' && child.name.startsWith('safeArea-')) {
          allSafeAreaNodes.push(child);
        }
      });
    } else if (children && typeof children.length !== 'undefined') {
      // 处理类数组对象
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        if (child && child.name && typeof child.name === 'string' && child.name.startsWith('safeArea-')) {
          allSafeAreaNodes.push(child);
        }
      }
    }
  }

  if (allSafeAreaNodes.length === 0) {
    return;
  }

  // 确定目标状态：如果所有节点都可见，则隐藏；否则显示
  const allVisible = allSafeAreaNodes.every((node: any) => node.isVisible !== false);
  const targetVisible = !allVisible;

  // 切换所有安全区节点的显示状态
  allSafeAreaNodes.forEach((node: any) => {
    try {
      node.isVisible = targetVisible;
    } catch (error) {
      console.error('切换节点显示状态失败:', error);
    }
  });

  // 通知 UI 更新状态
  sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
    visible: targetVisible,
    hasSafeArea: true,
  });
}

export default {
  type: MessageType.TOGGLE_SAFE_AREA,
  handler,
};

