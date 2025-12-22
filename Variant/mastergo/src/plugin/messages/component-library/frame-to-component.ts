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
 * 将Frame节点转换为Component节点
 * @param frameNode Frame节点
 * @param componentName 组件名称
 * @param currentPage 当前页面
 * @returns 新创建的Component节点，失败返回null
 */
export function convertFrameToComponent(
  frameNode: any,
  componentName: string,
  currentPage: any,
  layoutInfo?: any, // 可选的布局信息（从解绑前捕获）
): any | null {
  try {
    const originalX = frameNode.x;
    const originalY = frameNode.y;
    const targetWidth = frameNode.width;
    const targetHeight = frameNode.height;

    // 创建新组件
    const newComponent = mg.createComponent();
    newComponent.name = componentName;

    // 添加到页面
    currentPage.appendChild(newComponent);

    // 设置初始位置
    newComponent.x = frameNode.x;
    newComponent.y = frameNode.y;

    // 复制Frame的视觉属性
    copyFrameProperties(frameNode, newComponent);

    // 自动布局属性：优先用外部捕获信息，其次用 frameNode 自身信息
    const nodeAutoLayout = captureAutoLayoutProps(frameNode);
    const finalAutoLayout = mergeAutoLayoutProps(layoutInfo, nodeAutoLayout);
    applyAutoLayoutProps(newComponent, finalAutoLayout);

    // 设置组件尺寸（在迁移子节点前设置，防止约束错位）
    if (typeof targetWidth === 'number' && !Number.isNaN(targetWidth)) {
      (newComponent as any).width = targetWidth;
    }
    if (typeof targetHeight === 'number' && !Number.isNaN(targetHeight)) {
      (newComponent as any).height = targetHeight;
    }

    // 确保位置正确（防止尺寸变化引起的锚点偏移）
    if (typeof originalX === 'number' && !Number.isNaN(originalX)) {
      newComponent.x = originalX;
    }
    if (typeof originalY === 'number' && !Number.isNaN(originalY)) {
      newComponent.y = originalY;
    }

    // 克隆Frame的子节点到Component中，保持原有几何信息
    const frameChildren = [...frameNode.children];
    frameChildren.forEach(child => {
      const childGeometry = captureNodeGeometry(child);
      let nodeForComponent: any = child;

      // 尝试克隆节点，失败则移动原节点
      if (typeof child.clone === 'function') {
        try {
          nodeForComponent = child.clone();
        } catch (cloneError) {
          console.warn(
            `克隆子节点失败 (${child?.name || '未命名'})，改为移动原节点`,
            cloneError,
          );
          nodeForComponent = child;
        }
      } else {
        console.warn(`节点 ${child?.name || '未命名'} 不支持 clone()，改为移动原节点`);
      }

      // 添加到新组件并恢复几何信息
      try {
        newComponent.appendChild(nodeForComponent);
        applyNodeGeometry(nodeForComponent, childGeometry, newComponent);
      } catch (moveError) {
        console.error(`迁移子节点失败 (${child?.name || '未命名'})`, moveError);
      }
    });

    // 移除原Frame
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
  currentPage: any,
): Map<string, any> {
  const createdComponentsMap = new Map<string, any>();

  for (const item of detachedNodes) {
    if (!item.isPreview) {
      // 传递布局信息（如果存在）
      const layoutInfo = (item as any).layoutInfo;
      const newComponent = convertFrameToComponent(item.node, item.name, currentPage, layoutInfo);
      if (newComponent) {
        createdComponentsMap.set(newComponent.name, newComponent);
      }
    }
  }

  return createdComponentsMap;
}

