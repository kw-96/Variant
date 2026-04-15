/**
 * 批量转为组件功能
 * 选中多个或单个容器后，依次将被选中容器转为组件
 */
import { MessageType } from '../../../../../../src/messages';
import { convertFrameToComponent } from '../../component-library/frame-to-component';

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    return;
  }

  // 遍历所有选中节点
  for (let i = 0; i < selection.length; i++) {
    const node = selection[i];
    
    if (!node) {
      continue;
    }

    // 只处理 FRAME 类型的容器（COMPONENT 和 INSTANCE 已经是组件，无需转换）
    if (node.type !== 'FRAME') {
      continue;
    }

    // 检查是否为容器（有 children 属性）
    const isContainer = node.children && typeof node.children !== 'undefined';
    if (!isContainer) {
      continue;
    }

    // 获取容器名称，如果没有名称则使用默认名称
    const containerName = node.name || `组件 ${i + 1}`;

    // 将容器转为组件
    convertFrameToComponent(node, containerName, currentPage);
  }
}

export default {
  type: MessageType.BATCH_CONVERT_TO_COMPONENT,
  handler,
};
