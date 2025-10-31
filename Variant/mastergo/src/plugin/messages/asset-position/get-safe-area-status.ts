import { MessageType, sendMsgToUI } from '../../../../../src/messages';

// ==================== 获取安全区显示状态 ====================
// 用于显隐安全区按钮的状态检查
// 检查选中容器内所有带有 safeArea- 前缀的节点的显示状态
function handler(data?: any) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
      visible: false,
      hasSafeArea: false,
    });
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
      visible: false,
      hasSafeArea: false,
    });
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
    sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
      visible: false,
      hasSafeArea: false,
    });
    return;
  }

  // 检查所有安全区节点的显示状态
  // 如果至少有一个节点可见，则认为安全区是显示状态
  const hasVisible = allSafeAreaNodes.some((node: any) => node.isVisible !== false);

  sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
    visible: hasVisible,
    hasSafeArea: true,
  });
}

export default {
  type: MessageType.GET_SAFE_AREA_STATUS,
  handler,
};

