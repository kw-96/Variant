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

  if (typeof targetWidth === 'number' && !Number.isNaN(targetWidth)) {
    (newComponent as any).width = targetWidth;
  }
  if (typeof targetHeight === 'number' && !Number.isNaN(targetHeight)) {
    (newComponent as any).height = targetHeight;
  }

  if (typeof originalX === 'number' && !Number.isNaN(originalX)) {
    newComponent.x = originalX;
  }
  if (typeof originalY === 'number' && !Number.isNaN(originalY)) {
    newComponent.y = originalY;
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
    const children = [...(frameNode.children || [])].filter(Boolean);

    const newComponent = mg.createComponent();
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
      if (typeof targetWidth === 'number') (newComponent as any).width = targetWidth;
      if (typeof targetHeight === 'number') (newComponent as any).height = targetHeight;
    }

    if (!frameNode.removed) {
      frameNode.remove();
    }

    return newComponent;
  } catch (error) {
    console.error(`转换组件失败 (${componentName}):`, error);
    return null;
  }
}

/**
 * 批量处理非预览节点，将Frame转换为Component
 */
export function processNonPreviewNodes(
  detachedNodes: DetachedNodeInfo[],
  currentPage: any
): Map<string, any> {
  const createdComponentsMap = new Map<string, any>();

  for (const item of detachedNodes) {
    if (!item.isPreview) {
      const layoutInfo = (item as any).layoutInfo;
      const newComponent = convertFrameToComponent(item.node, item.name, currentPage, layoutInfo);
      if (newComponent) {
        createdComponentsMap.set(newComponent.name, newComponent);
      }
    }
  }

  return createdComponentsMap;
}
