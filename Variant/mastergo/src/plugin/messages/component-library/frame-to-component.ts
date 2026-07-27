/**
 * Frame转Component转换器 - 负责将解绑后的Frame转换为本地Component
 */

import {
  copyFrameProperties,
  captureNodeGeometry,
  applyNodeGeometry,
} from './component-utils';
import { applyAutoLayoutProps, captureAutoLayoutProps, mergeAutoLayoutProps } from './auto-layout-props';

/**
 * 解绑后的节点信息
 */
interface DetachedNodeInfo {
  node: any;
  name: string;
  isPreview: boolean;
}

/**
 * 将组件挂到目标父节点并还原 Frame 的位置/尺寸/视觉/自动布局。
 * 结果需与历史实现一致：Component 直接承载原 Frame 的子节点与外观。
 */
function applyFrameAppearanceToComponent(
  frameNode: any,
  newComponent: any,
  targetParent: any,
  layoutInfo: any,
  originalX: number,
  originalY: number,
  targetWidth: number,
  targetHeight: number
) {
  if (newComponent.parent !== targetParent) {
    targetParent.appendChild(newComponent);
  }

  newComponent.x = originalX;
  newComponent.y = originalY;
  copyFrameProperties(frameNode, newComponent);

  const nodeAutoLayout = captureAutoLayoutProps(frameNode);
  const finalAutoLayout = mergeAutoLayoutProps(layoutInfo, nodeAutoLayout);
  applyAutoLayoutProps(newComponent, finalAutoLayout);

  if (typeof targetWidth === 'number' && !Number.isNaN(targetWidth)) {
    (newComponent as any).width = targetWidth;
  }
  if (typeof targetHeight === 'number' && !Number.isNaN(targetHeight)) {
    (newComponent as any).height = targetHeight;
  }

  // 尺寸变化后再次钉住位置，避免锚点偏移
  if (typeof originalX === 'number' && !Number.isNaN(originalX)) {
    newComponent.x = originalX;
  }
  if (typeof originalY === 'number' && !Number.isNaN(originalY)) {
    newComponent.y = originalY;
  }
}

/**
 * 官方 createComponent(children) 失败时，退回「移动原子节点」路径（不 clone）。
 */
function moveChildrenIntoComponent(
  newComponent: any,
  children: any[],
  childGeometries: Array<{ node: any; geometry: any }>
) {
  children.forEach((child, index) => {
    try {
      newComponent.appendChild(child);
      applyNodeGeometry(child, childGeometries[index]?.geometry, newComponent);
    } catch (moveError) {
      console.error(`迁移子节点失败 (${child?.name || '未命名'})`, moveError);
    }
  });
}

/**
 * 将Frame节点转换为Component节点
 * @param frameNode Frame节点
 * @param componentName 组件名称
 * @param currentPage 当前页面
 * @param layoutInfo 可选的布局信息（从解绑前捕获）
 * @returns 新创建的Component节点，失败返回null
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

    // 直接收编原子树（含嵌套 INSTANCE），保证完整还原；不解绑、不临时移出
    const children = [...(frameNode.children || [])].filter(Boolean);
    const childGeometries = children.map((child) => ({
      node: child,
      geometry: captureNodeGeometry(child)
    }));

    let newComponent: any;
    try {
      newComponent =
        children.length > 0 ? mg.createComponent(children) : mg.createComponent();
    } catch (createError) {
      console.warn(`createComponent(children) 失败，改为逐个移动子节点`, createError);
      newComponent = mg.createComponent();
      moveChildrenIntoComponent(newComponent, children, childGeometries);
    }

    newComponent.name = componentName;
    applyFrameAppearanceToComponent(
      frameNode,
      newComponent,
      targetParent,
      layoutInfo,
      originalX,
      originalY,
      targetWidth,
      targetHeight
    );

    childGeometries.forEach(({ node, geometry }) => {
      if (!node || node.removed) return;
      try {
        applyNodeGeometry(node, geometry, newComponent);
      } catch {
        // 单个子节点几何还原失败不阻断整次转换
      }
    });

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
 * @param detachedNodes 解绑后的节点列表
 * @param currentPage 当前页面
 * @returns 组件映射表（组件名称 -> 组件节点）
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
