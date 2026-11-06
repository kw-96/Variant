/**
 * Frame转Component转换器 - 负责将解绑后的Frame转换为本地Component
 */

import { copyFrameProperties } from './component-utils';
import { applyAutoLayoutProps, captureAutoLayoutProps, mergeAutoLayoutProps } from './auto-layout-props';
import { applySubtreeGeometry, captureSubtreeGeometry } from './geometry-tree';

/** 源节点是否启用了自动布局 */
function sourceHasAutoLayout(props: Record<string, any> | undefined): boolean {
  if (!props) return false;
  const flex = props.flexMode;
  const layout = props.layoutMode;
  return (
    (typeof flex === 'string' && flex !== 'NONE') ||
    (typeof layout === 'string' && layout !== 'NONE')
  );
}

/**
 * 解绑后的节点信息
 */
interface DetachedNodeInfo {
  node: any;
  name: string;
  isPreview: boolean;
  description?: string;
}

/**
 * 在挂子节点之前准备空组件：强制自由布局，写好外观与尺寸，避免 append 时被自动布局重排
 */
function prepareEmptyComponent(
  newComponent: any,
  frameNode: any,
  targetParent: any,
  originalX: number,
  originalY: number,
  targetWidth: number,
  targetHeight: number
) {
  if (newComponent.parent !== targetParent) {
    targetParent.appendChild(newComponent);
  }

  // 先关掉自动布局，再挂子节点，否则会打乱组内绝对坐标
  try {
    if ('flexMode' in newComponent) {
      (newComponent as any).flexMode = 'NONE';
    }
  } catch {
    // ignore
  }
  try {
    if ('layoutMode' in newComponent) {
      (newComponent as any).layoutMode = 'NONE';
    }
  } catch {
    // ignore
  }

  newComponent.x = originalX;
  newComponent.y = originalY;
  copyFrameProperties(frameNode, newComponent);

  setExactSize(newComponent, targetWidth, targetHeight);

  if (typeof originalX === 'number' && !Number.isNaN(originalX)) {
    newComponent.x = originalX;
  }
  if (typeof originalY === 'number' && !Number.isNaN(originalY)) {
    newComponent.y = originalY;
  }
}

/** 宽高是否与目标一致（容差 0.5px） */
function sizeMatches(node: any, width: number, height: number): boolean {
  return (
    typeof node?.width === 'number' &&
    typeof node?.height === 'number' &&
    Math.abs(node.width - width) <= 0.5 &&
    Math.abs(node.height - height) <= 0.5
  );
}

/**
 * 精确写入宽高：先解除等比锁定，再一次性 resize；
 * 分别写 width / height 时，等比锁定会让另一边联动（例如 1080×684 变成 684×684）。
 */
function setExactSize(node: any, width: number, height: number) {
  if (
    typeof width !== 'number' || Number.isNaN(width) || !(width > 0) ||
    typeof height !== 'number' || Number.isNaN(height) || !(height > 0)
  ) {
    return;
  }
  try {
    if ('constrainProportions' in node) node.constrainProportions = false;
  } catch {
    // ignore
  }
  try {
    if (typeof node.resize === 'function') node.resize(width, height);
  } catch {
    // 交由下方校验与回退
  }
  if (!sizeMatches(node, width, height)) {
    try {
      node.width = width;
      node.height = height;
    } catch {
      // ignore
    }
  }
  if (!sizeMatches(node, width, height)) {
    try {
      if (typeof node.resize === 'function') {
        node.resize(width, node.height);
        node.resize(width, height);
      }
    } catch {
      // ignore
    }
  }
}


/**
 * 将直接子节点移入组件（整组一起搬）
 */
function moveChildrenIntoComponent(newComponent: any, children: any[]) {
  children.forEach((child) => {
    try {
      newComponent.appendChild(child);
    } catch (moveError) {
      console.error(`迁移子节点失败 (${child?.name || '未命名'})`, moveError);
    }
  });
}

/**
 * 将Frame节点转换为Component节点
 */
export function convertFrameToComponent(
  frameNode: any,
  componentName: string,
  currentPage: any,
  layoutInfo?: any
): any | null {
  let newComponent: any = null;
  let children: any[] = [];
  try {
    const originalX = frameNode.x;
    const originalY = frameNode.y;
    const targetWidth = frameNode.width;
    const targetHeight = frameNode.height;
    const originalParent = frameNode.parent;
    const targetParent =
      originalParent && originalParent !== currentPage ? originalParent : currentPage;

    const sourceAutoLayout = mergeAutoLayoutProps(
      layoutInfo,
      captureAutoLayoutProps(frameNode)
    );
    const subtreeGeometry = captureSubtreeGeometry(frameNode);
    children = [...(frameNode.children || [])].filter(Boolean);

    newComponent = mg.createComponent();
    newComponent.name = componentName;

    // 关键：先自由布局 + 定尺寸，再搬子节点，最后整树还原几何
    prepareEmptyComponent(
      newComponent,
      frameNode,
      targetParent,
      originalX,
      originalY,
      targetWidth,
      targetHeight
    );
    moveChildrenIntoComponent(newComponent, children);
    applySubtreeGeometry(subtreeGeometry);

    // 源本身是自动布局时，几何还原后再打开，避免搬入过程重排
    if (sourceHasAutoLayout(sourceAutoLayout)) {
      applyAutoLayoutProps(newComponent, sourceAutoLayout);
      newComponent.x = originalX;
      newComponent.y = originalY;
      setExactSize(newComponent, targetWidth, targetHeight);
    }

    // 校验组件尺寸与原画板一致；不一致先修正一次，仍不一致则回滚，保留原画板
    if (!sizeMatches(newComponent, targetWidth, targetHeight)) {
      setExactSize(newComponent, targetWidth, targetHeight);
    }
    if (!sizeMatches(newComponent, targetWidth, targetHeight)) {
      throw new Error(
        `组件尺寸与原画板不一致：预期 ${targetWidth}×${targetHeight}，实际 ${newComponent.width}×${newComponent.height}`
      );
    }

    if (!frameNode.removed) {
      frameNode.remove();
    }

    return newComponent;
  } catch (error) {
    console.error(`转换组件失败 (${componentName}):`, error);
    // 回滚：把子节点放回原画板并删除半成品组件，避免画布上出现尺寸错误的组件
    try {
      if (newComponent && !newComponent.removed && frameNode && !frameNode.removed) {
        children.forEach((child) => {
          try {
            frameNode.appendChild(child);
          } catch {
            // ignore
          }
        });
        newComponent.remove();
      }
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * 批量处理非预览节点，将Frame转换为Component
 * @param outComponents 可选，收集本次创建的全部组件（按创建顺序，含同名节点）
 * @param outFailures 可选，收集转换失败（含回滚）的素材，供导入结果统计
 */
export function processNonPreviewNodes(
  detachedNodes: DetachedNodeInfo[],
  currentPage: any,
  outComponents?: any[],
  outFailures?: Array<{ name: string; reason: string }>
): Map<string, any> {
  const createdComponentsMap = new Map<string, any>();

  for (const item of detachedNodes) {
    if (!item.isPreview) {
      const layoutInfo = (item as any).layoutInfo;
      const newComponent = convertFrameToComponent(item.node, item.name, currentPage, layoutInfo);
      if (newComponent) {
        // 转换会新建组件节点，需重新写入完整组件描述
        try {
          if (item.description && typeof (newComponent as any).setPluginData === 'function') {
            (newComponent as any).setPluginData('componentDescription', item.description);
          }
        } catch (e) {
          // 忽略
        }
        createdComponentsMap.set(newComponent.name, newComponent);
        if (outComponents) outComponents.push(newComponent);
      } else if (outFailures) {
        outFailures.push({ name: item.name, reason: '转为组件失败（尺寸校验未通过，已回滚）' });
      }
    }
  }

  return createdComponentsMap;
}
