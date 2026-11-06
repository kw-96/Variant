// @ts-nocheck
import { isPreviewNode, findFirstNodePosition } from './component-utils';
import { replaceInternalInstances } from './replace-internal-instances';
import { arrangeComponentLayout } from './layout-calculator';
import { processNonPreviewNodes } from './frame-to-component';

/** 在节点上保存完整组件描述（供资源位导出分组） */
function tagComponentDescription(node: any, description: string): void {
  if (!node || !description) return;
  try {
    if (typeof node.setPluginData === 'function') {
      node.setPluginData('componentDescription', description);
    }
  } catch (e) {
    // setPluginData 可能不可用，忽略
  }
}

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
  | { x: number; y: number; finalNodes: any[]; conversionFailures?: Array<{ name: string; reason: string }> }
  | {
      x: number;
      y: number;
      convertedComponentNames: Set<string>;
      finalNodes: any[];
      conversionFailures?: Array<{ name: string; reason: string }>;
    }
> {
  if (!descriptionGroups || descriptionGroups.length === 0) return null;

  arrangeComponentLayout(descriptionGroups, viewportCenter);

  // 导入时为每个资源保存其所属的完整组件描述（供资源位导出按「渠道+组件描述」分组）
  const detachedNodes: any[] = [];
  for (const group of descriptionGroups) {
    const description = String(group?.description || '');
    for (const instance of group.instances || []) {
      try {
        const name = String(instance?.name || '');
        const isPreview = isPreviewNode(instance);
        const detachedNode = instance.detachInstance();
        if (detachedNode) {
          tagComponentDescription(detachedNode, description);
          detachedNodes.push({ node: detachedNode, name, isPreview, description });
        }
      } catch (e) {
        // 静默处理解绑失败，继续处理其他实例
      }
    }
  }

  // 商店图导入：只解绑排布，不转组件、不替换槽位
  if (skipConvert) {
    if (detachedNodes.length === 0) return null;
    const nodes = detachedNodes.map((item) => item.node).filter(Boolean);
    const position = findFirstNodePosition(nodes);
    if (!position) return null;
    return { ...position, finalNodes: nodes };
  }

  const createdComponents: any[] = [];
  const conversionFailures: Array<{ name: string; reason: string }> = [];
  const createdComponentsMap = processNonPreviewNodes(detachedNodes, currentPage, createdComponents, conversionFailures);

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
  createdComponents.forEach((component) => {
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

  return { ...position, convertedComponentNames, finalNodes: allFinalNodes, conversionFailures };
}
