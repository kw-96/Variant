import { applyNodeGeometry, captureNodeGeometry } from './component-utils';
import { findReplacementTarget, isRequiredSetSlotName } from './replace-match';

/** 替换行为选项 */
export interface IReplaceInternalOptions {
  /** 为 true 时跳过背景/IP/LOGO/主题槽位（预览内只换对应资源组件） */
  skipRequiredSetSlots?: boolean;
}

/**
 * 检查节点是否仍然有效（未删除且有父节点）
 */
function isNodeValid(node: any): boolean {
  if (!node) return false;
  try {
    return !node.removed && !!node.parent;
  } catch {
    return false;
  }
}

/**
 * 按宽高调整节点尺寸（优先官方 resize API）
 */
function resizeNode(node: any, width: number, height: number) {
  if (!node || !width || !height) return;
  try {
    if (typeof node.resizeWithoutConstraints === 'function') {
      node.resizeWithoutConstraints(width, height);
    } else if (typeof node.resize === 'function') {
      node.resize(width, height);
    } else {
      node.width = width;
      node.height = height;
    }
  } catch {
    // 尺寸调整失败时保持现状
  }
}

/**
 * 替换后恢复槽位尺寸/几何；背景实例铺满父容器（与历史结果一致）
 */
function restoreSlotAppearance(
  instance: any,
  parent: any,
  originalGeometry: any,
  originalWidth: number | null,
  originalHeight: number | null,
  matchedName: string | null,
  originalName: string
) {
  const newWidth = typeof instance.width === 'number' ? instance.width : null;
  const newHeight = typeof instance.height === 'number' ? instance.height : null;

  if (originalWidth && originalHeight && newWidth && newHeight) {
    const needScale =
      Math.abs(newWidth - originalWidth) > 0.5 || Math.abs(newHeight - originalHeight) > 0.5;
    if (needScale) {
      if (typeof instance.rescale === 'function') {
        try {
          instance.rescale(originalWidth / newWidth, { scaleCenter: 'TOPLEFT' });
        } catch {
          resizeNode(instance, originalWidth, originalHeight);
        }
      } else {
        resizeNode(instance, originalWidth, originalHeight);
      }
    }
  }

  const geometryToRestore = { ...originalGeometry };
  delete geometryToRestore.width;
  delete geometryToRestore.height;
  applyNodeGeometry(instance, geometryToRestore, parent);

  const isBackground =
    (matchedName && matchedName.includes('背景')) ||
    (typeof originalName === 'string' && originalName.includes('背景'));
  if (!isBackground) return;

  const currentParent = instance.parent;
  if (!currentParent) return;
  const parentWidth = typeof currentParent.width === 'number' ? currentParent.width : null;
  const parentHeight = typeof currentParent.height === 'number' ? currentParent.height : null;
  if (parentWidth && parentHeight) {
    resizeNode(instance, parentWidth, parentHeight);
  }
}

/**
 * 将实例替换为映射表中的本地组件：优先 swapComponent，失败再删建。
 */
function replaceOneInstance(node: any, targetComponent: any, matchedName: string) {
  if (!isNodeValid(node)) return;

  let parent: any;
  try {
    parent = node.parent;
  } catch {
    return;
  }
  if (!parent) return;

  const originalGeometry = captureNodeGeometry(node);
  const originalWidth = typeof node.width === 'number' ? node.width : null;
  const originalHeight = typeof node.height === 'number' ? node.height : null;
  const originalName = String(node.name || '');

  if (typeof node.swapComponent === 'function') {
    try {
      node.swapComponent(targetComponent);
      try {
        node.name = originalName;
      } catch {
        // 部分节点不允许改名
      }
      restoreSlotAppearance(
        node,
        parent,
        originalGeometry,
        originalWidth,
        originalHeight,
        matchedName,
        originalName
      );
      return;
    } catch {
      // 回退到删建路径
    }
  }

  let newInstance: any;
  try {
    newInstance = targetComponent.createInstance();
  } catch (e) {
    console.error(`创建新实例失败 (${originalName}):`, e);
    return;
  }
  if (!newInstance) return;

  let index: number;
  try {
    index = parent.children.indexOf(node);
  } catch {
    return;
  }
  if (index === -1) return;

  try {
    try {
      newInstance.name = originalName;
    } catch {
      // ignore
    }
    parent.insertChild(index, newInstance);
  } catch (e: any) {
    console.error(`插入新实例失败 (${originalName}):`, e);
    return;
  }

  try {
    node.remove();
  } catch {
    // 旧节点已不存在视为替换成功
  }

  restoreSlotAppearance(
    newInstance,
    parent,
    originalGeometry,
    originalWidth,
    originalHeight,
    matchedName,
    originalName
  );
}

/**
 * 递归替换节点内部的实例为本地组件实例。
 * @param node 要处理的节点
 * @param componentMap 组件映射表（名称 -> 组件节点）
 * @param options 预览替换时可跳过背景/IP/LOGO/主题槽位
 */
export function replaceInternalInstances(
  node: any,
  componentMap: Map<string, any>,
  options?: IReplaceInternalOptions
) {
  if (!node || !componentMap || componentMap.size === 0) return;
  const skipRequiredSetSlots = options?.skipRequiredSetSlots === true;

  if (
    node.type === 'FRAME' ||
    node.type === 'GROUP' ||
    node.type === 'COMPONENT_SET' ||
    node.type === 'COMPONENT'
  ) {
    if (!isNodeValid(node)) return;

    let children: any[];
    try {
      children = node.children || [];
    } catch {
      return;
    }

    const childrenToProcess: Array<{ node: any; name: string }> = [];
    for (const child of children) {
      if (!child || !isNodeValid(child)) continue;
      childrenToProcess.push({ node: child, name: child.name || '未命名' });
    }

    for (const item of childrenToProcess) {
      if (!isNodeValid(item.node)) continue;
      try {
        replaceInternalInstances(item.node, componentMap, options);
      } catch (e: any) {
        if (e?.message && !e.message.includes('does not exist')) {
          console.error(`递归处理子节点失败 (${item.name}):`, e);
        }
      }
    }
    return;
  }

  if (node.type !== 'INSTANCE') return;
  if (!isNodeValid(node)) return;

  // 预览内：不替换背景/IP/LOGO/主题等槽位实例
  if (skipRequiredSetSlots && isRequiredSetSlotName(String(node.name || ''))) {
    return;
  }

  const matched = findReplacementTarget(node, componentMap);
  if (!matched?.targetComponent) return;

  // 匹配目标若是必需组件集名称，预览路径同样跳过
  if (skipRequiredSetSlots && isRequiredSetSlotName(matched.matchedName)) {
    return;
  }

  try {
    replaceOneInstance(node, matched.targetComponent, matched.matchedName);
  } catch (e: any) {
    if (e?.message && !e.message.includes('does not exist')) {
      console.error(`替换实例失败 (${node.name} -> ${matched.matchedName}):`, e);
    }
  }
}
