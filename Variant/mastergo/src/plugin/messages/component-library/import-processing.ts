// @ts-nocheck
import { isPreviewNode, findFirstNodePosition } from './component-utils';
import { replaceInternalInstances } from './replace-internal-instances';
import { calculateGroupSizes, arrangeComponentLayout } from './layout-calculator';
import { processNonPreviewNodes } from './frame-to-component';

/**
 * 普通组件导入后的处理流程（布局 / 解绑 / 可选转换）
 * @param descriptionGroups 按描述分组的实例列表
 * @param currentPage 当前页面
 * @param viewportCenter 视口中心
 * @param skipConvert 是否跳过转换步骤（商店图导入时，没有预览节点，不需要转换为组件）
 * @returns 首个普通组件的位置 { x, y }，以及已转换组件的名称列表
 */
export async function processImportedInstances(
  descriptionGroups: Array<{ description: string; instances: any[] }>,
  currentPage: any,
  viewportCenter: any,
  skipConvert: boolean,
): Promise<
  | null
  | { x: number; y: number }
  | { x: number; y: number; convertedComponentNames: Set<string> }
> {
  if (!descriptionGroups || descriptionGroups.length === 0) return null;

  const groupSizes = calculateGroupSizes(descriptionGroups);
  arrangeComponentLayout(descriptionGroups, groupSizes, viewportCenter);

  const instances: any[] = [];
  descriptionGroups.forEach((group) => instances.push(...group.instances));

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

  // 商店图导入：只解绑排布，不转组件、不替换槽位
  if (skipConvert) {
    if (detachedNodes.length === 0) return null;
    const nodes = detachedNodes.map((item) => item.node).filter(Boolean);
    const position = findFirstNodePosition(nodes);
    if (!position) return null;
    return position;
  }

  const createdComponentsMap = processNonPreviewNodes(detachedNodes, currentPage);

  const convertedComponentNames = new Set<string>();
  createdComponentsMap.forEach((component, name) => {
    if (component && name) {
      convertedComponentNames.add(name);
    }
  });

  // 仅处理预览节点：把内部「对应资源组件」实例换成刚转好的本地组件
  for (const item of detachedNodes) {
    if (!item.isPreview) continue;
    try {
      replaceInternalInstances(item.node, createdComponentsMap, {
        skipRequiredSetSlots: true
      });
    } catch (e) {
      // 静默处理预览节点替换失败，继续处理其他节点
    }
  }

  const allFinalNodes: any[] = [];
  createdComponentsMap.forEach((component) => {
    if (component && typeof component.y === 'number') {
      allFinalNodes.push(component);
    }
  });
  detachedNodes.forEach((item) => {
    if (item.isPreview && item.node && typeof item.node.y === 'number') {
      allFinalNodes.push(item.node);
    }
  });

  if (allFinalNodes.length === 0) {
    return null;
  }

  const position = findFirstNodePosition(allFinalNodes);
  if (!position) return null;

  return { ...position, convertedComponentNames };
}
