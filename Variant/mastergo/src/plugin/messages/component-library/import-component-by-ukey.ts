// @ts-nocheck
import { MessageType } from '../../../../../src/messages';
import { replaceInternalInstances } from './component-utils';
import { calculateGroupSizes, arrangeComponentLayout } from './layout-calculator';
import { processNonPreviewNodes } from './frame-to-component';

/**
 * 通过 ukey 导入组件
 * @param data.groups 按描述分组的组件列表 [{ description: string, ukeys: string[] }]
 */
async function handler(data: { groups?: Array<{ description: string; ukeys: string[] }>, ukeys?: string[] }) {
  // 兼容旧格式：如果传递的是 ukeys 数组，转换为 groups 格式
  let groups: Array<{ description: string; ukeys: string[] }> = [];
  if (data.groups && Array.isArray(data.groups)) {
    groups = data.groups;
  } else if (data.ukeys && Array.isArray(data.ukeys)) {
    // 兼容旧格式：所有组件归为一个"未分组"描述
    groups = [{ description: '未分组', ukeys: data.ukeys }];
  }
  
  if (!groups || groups.length === 0) {
    mg.notify('请选择要导入的组件', { timeout: 2000 });
    return;
  }

  const currentPage = mg.document.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const viewportCenter = mg.viewport.center;
  const descriptionGroups: Array<{ description: string; instances: any[] }> = [];
  let successCount = 0;
  let failCount = 0;

  // 1. 按描述分组导入所有组件并创建实例
  for (const group of groups) {
    const instances: any[] = [];
    
    for (const ukey of group.ukeys) {
      try {
        const componentNode = await mg.importComponentByKeyAsync(ukey);
        if (componentNode) {
          const instance = componentNode.createInstance();
          currentPage.appendChild(instance);
          instances.push(instance);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`导入组件失败 (ukey: ${ukey}):`, error);
        failCount++;
      }
    }

    if (instances.length > 0) {
      // 在描述组内排序：名称不含"预览"的在前，含"预览"的在后
      instances.sort((a, b) => {
        const aIsPreview = a.name.includes('预览');
        const bIsPreview = b.name.includes('预览');
        if (aIsPreview && !bIsPreview) return 1;
        if (!aIsPreview && bIsPreview) return -1;
        return 0;
      });
      
      descriptionGroups.push({
        description: group.description,
        instances
      });
    }
  }

  if (descriptionGroups.length === 0) {
    if (failCount > 0) {
       mg.notify(`导入失败，请检查组件是否在团队库中`, { timeout: 3000 });
    }
    return;
  }

  // 2. 计算每个描述组的尺寸
  const groupSizes = calculateGroupSizes(descriptionGroups);

  // 3. 按行列排列组件
  arrangeComponentLayout(descriptionGroups, groupSizes, viewportCenter);

  // 收集所有实例用于后续处理
  const instances: any[] = [];
  descriptionGroups.forEach(group => {
    instances.push(...group.instances);
  });

  // 4. 立即解绑所有实例
  const detachedNodes: any[] = [];

  for (const instance of instances) {
    try {
      const isPreview = instance.name.includes('预览');
      const name = instance.name;
      
      const detachedNode = instance.detachInstance();
      if (detachedNode) {
        detachedNodes.push({
          node: detachedNode,
          name: name,
          isPreview: isPreview
        });
      } else {
        console.warn(`解绑实例失败: ${name}`);
      }
    } catch (error) {
      console.error('解绑实例出错:', error);
    }
  }

  // 5. 处理非"预览"节点：将Frame转换为Component
  const createdComponentsMap = processNonPreviewNodes(detachedNodes, currentPage);

  // 6. 处理"预览"节点：替换内部实例
  for (const item of detachedNodes) {
    if (item.isPreview) {
      try {
          const previewFrame = item.node;
          
          // 递归查找并替换子节点中的实例
          replaceInternalInstances(previewFrame, createdComponentsMap);
      } catch (error) {
          console.error(`处理预览节点失败 (${item.name}):`, error);
      }
    }
  }

  // 7. 完成处理（已在排列阶段实现同行顶对齐，无需额外操作）

  if (failCount > 0) {
    mg.notify(`成功导入 ${successCount} 个组件，失败 ${failCount} 个`, { timeout: 3000 });
  } else {
    mg.notify(`成功导入并处理 ${successCount} 个组件`, { timeout: 2000 });
  }
}

export default {
  type: MessageType.IMPORT_COMPONENT_BY_UKEY,
  handler,
};

