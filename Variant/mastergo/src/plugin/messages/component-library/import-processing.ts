// @ts-nocheck
import { replaceInternalInstances, isPreviewNode, findFirstNodePosition } from './component-utils';
import { calculateGroupSizes, arrangeComponentLayout } from './layout-calculator';
import { processNonPreviewNodes } from './frame-to-component';

/**
 * 普通组件导入后的处理流程（布局 / 解绑 / 可选转换）
 * @param descriptionGroups 按描述分组的实例列表
 * @param currentPage 当前页面
 * @param viewportCenter 视口中心
 * @param skipConvert 是否跳过转换步骤（商店图导入时，没有预览节点，不需要转换为组件）
 * @param requiredComponentsMap 必需组件集的组件映射表（名称 -> 组件节点），用于替换普通组件内部的实例
 * @returns 首个普通组件的位置 { x, y }（用于确定必需组件集的位置），以及已转换组件的名称列表
 */
export function processImportedInstances(
  descriptionGroups: Array<{ description: string; instances: any[] }>,
  currentPage: any,
  viewportCenter: any,
  skipConvert: boolean,
  requiredComponentsMap?: Map<string, any>,
): { x: number; y: number } | null | { x: number; y: number; convertedComponentNames: Set<string> } {
  if (!descriptionGroups || descriptionGroups.length === 0) return null;

  const groupSizes = calculateGroupSizes(descriptionGroups);
  arrangeComponentLayout(descriptionGroups, groupSizes, viewportCenter);

  const instances: any[] = [];
  descriptionGroups.forEach(group => instances.push(...group.instances));

  // 解绑所有实例
  const detachedNodes: any[] = [];
  for (const instance of instances) {
    try {
      const name = String(instance?.name || '');
      const isPreview = isPreviewNode(instance);
      const detachedNode = instance.detachInstance();
      if (detachedNode) {
        detachedNodes.push({ node: detachedNode, name, isPreview });
      }
    } catch (e) {
      // 静默处理解绑失败，继续处理其他实例
    }
  }

  // 如果跳过转换（商店图导入），替换普通组件内部的实例为必需组件集的组件实例
  if (skipConvert) {
    // 如果有必需组件集的组件映射表，替换普通组件内部的实例
    if (requiredComponentsMap && requiredComponentsMap.size > 0) {
      for (const item of detachedNodes) {
        try {
          replaceInternalInstances(item.node, requiredComponentsMap);
        } catch (e) {
          console.error(`替换普通组件内部实例失败 (${item.name}):`, e);
        }
      }
    }
    
    if (detachedNodes.length === 0) return null;
    // 找到最左侧且最上方的节点（首个普通组件）
    const nodes = detachedNodes.map(item => item.node).filter(Boolean);
    const position = findFirstNodePosition(nodes);
    if (!position) return null;
    return position;
  }

  // 普通导入：转换非预览节点为组件
  const createdComponentsMap = processNonPreviewNodes(detachedNodes, currentPage);
  
  // 收集已转换组件的名称列表（用于后续替换内部实例）
  const convertedComponentNames = new Set<string>();
  createdComponentsMap.forEach((component, name) => {
    if (component && name) {
      convertedComponentNames.add(name);
    }
  });
  
  // 处理预览节点：替换内部实例
  for (const item of detachedNodes) {
    if (!item.isPreview) continue;
    try {
      replaceInternalInstances(item.node, createdComponentsMap);
    } catch (e) {
      // 静默处理预览节点替换失败，继续处理其他节点
    }
  }
  
  // 获取所有最终节点（转换后的组件 + 预览节点）的最顶部 Y 坐标
  const allFinalNodes: any[] = [];
  // 添加转换后的组件
  createdComponentsMap.forEach(component => {
    if (component && typeof component.y === 'number') {
      allFinalNodes.push(component);
    }
  });
  // 添加预览节点（解绑后的 Frame）
  detachedNodes.forEach(item => {
    if (item.isPreview && item.node && typeof item.node.y === 'number') {
      allFinalNodes.push(item.node);
    }
  });
  
  if (allFinalNodes.length === 0) {
    return null;
  }
  
  // 找到最左侧且最上方的节点（首个普通组件）
  const position = findFirstNodePosition(allFinalNodes);
  if (!position) return null;
  
  return { ...position, convertedComponentNames };
}


