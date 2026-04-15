import { MessageType, sendMsgToUI } from '../../../../../src/messages';

// ==================== 切换安全区显示/隐藏 ====================
// 用于显隐安全区按钮功能
// 切换选中容器内所有带有 safeArea- 前缀的节点的显示/隐藏状态
// @param data 可选参数，如果包含 updateStatus: true，则发送状态更新到UI
function handler(data?: { updateStatus?: boolean }) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    return;
  }

  // 按容器分组收集安全区节点
  const containerSafeAreaNodes: Array<{ container: any; nodes: any[] }> = [];
  
  // 遍历所有选中的容器
  for (let i = 0; i < selection.length; i++) {
    const container = selection[i];
    
    // 检查是否为容器类型（有 children 属性）
    if (!container.children || typeof container.children !== 'object') {
      continue;
    }

    // 收集该容器中的安全区节点
    const safeAreaNodes: any[] = [];
    const children = container.children;
    
    if (Array.isArray(children)) {
      children.forEach((child: any) => {
        if (child.name && typeof child.name === 'string' && child.name.startsWith('safeArea-')) {
          safeAreaNodes.push(child);
        }
      });
    } else if (children && typeof children.length !== 'undefined') {
      // 处理类数组对象
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        if (child && child.name && typeof child.name === 'string' && child.name.startsWith('safeArea-')) {
          safeAreaNodes.push(child);
        }
      }
    }

    if (safeAreaNodes.length > 0) {
      containerSafeAreaNodes.push({ container, nodes: safeAreaNodes });
    }
  }

  if (containerSafeAreaNodes.length === 0) {
    return;
  }

  // 判断每个容器的安全区状态
  const containerStates: boolean[] = [];
  containerSafeAreaNodes.forEach(({ nodes }) => {
    // 判断该容器内所有安全区节点是否都可见
    const allVisible = nodes.every((node: any) => node.isVisible !== false);
    containerStates.push(allVisible);
  });

  // 确定目标状态
  let targetVisible: boolean;
  
  if (containerStates.length === 1) {
    // 单个容器：如果显示则隐藏，如果隐藏则显示
    targetVisible = !containerStates[0];
  } else {
    // 多个容器
    const allSame = containerStates.every(state => state === containerStates[0]);
    
    if (allSame) {
      // 状态一致：都是显示则隐藏，都是隐藏则显示
      targetVisible = !containerStates[0];
    } else {
      // 状态不一致：统一显示
      targetVisible = true;
    }
  }

  // 切换所有安全区节点的显示状态
  containerSafeAreaNodes.forEach(({ nodes }) => {
    nodes.forEach((node: any) => {
      try {
        node.isVisible = targetVisible;
      } catch (error) {
        console.error('切换节点显示状态失败:', error);
      }
    });
  });

  // 如果是从UI触发（需要更新状态），则发送状态更新
  if (data?.updateStatus === true) {
    sendMsgToUI(MessageType.SAFE_AREA_STATUS, {
      visible: targetVisible,
      hasSafeArea: true,
    });
  }
}

export default {
  type: MessageType.TOGGLE_SAFE_AREA,
  handler,
};

