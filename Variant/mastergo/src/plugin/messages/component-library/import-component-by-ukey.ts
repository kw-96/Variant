// @ts-nocheck
import { MessageType, sendMsgToUI } from '../../../../../src/messages';
import { importRequiredComponentSet } from './import-required-component-set';
import { processImportedInstances } from './import-processing';
import { isPreviewNode, replaceInternalInstances, parseErrorReason, REQUIRED_COMPONENT_SET_ORDER, REQUIRED_COMPONENT_SET_DESCRIPTIONS } from './component-utils';
import { calculateGroupSizes } from './layout-calculator';

/**
 * 通过 ukey 导入组件
 * @param data.groups 按描述分组的组件列表 [{ description: string, ukeys: string[] }]
 * @param data.skipConvert 是否跳过转换步骤（第五步和第六步），商店图导入时设为 true
 */
async function handler(data: { groups?: Array<{ description: string; ukeys: string[] }>, ukeys?: string[], skipConvert?: boolean }) {
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
    sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
      success: false,
      successCount: 0,
      failCount: 0,
    });
    return;
  }

  const currentPage = mg.document.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
      success: false,
      successCount: 0,
      failCount: 0,
    });
    return;
  }

  const viewportCenter = mg.viewport.center;
  const descriptionGroups: Array<{ description: string; instances: any[] }> = [];
  let successCount = 0;
  let failCount = 0;
  const skipConvert = data.skipConvert === true; // 商店图导入时跳过转换步骤
  const failedUkeys = new Map<string, string>(); // 记录失败的 ukey 和原因，用于汇总错误信息

  // 获取团队库，用于检查组件类型
  let teamLibraries: any[] = [];
  try {
    teamLibraries = await mg.getTeamLibraryAsync();
  } catch (error) {
    console.warn('获取团队库失败，将跳过组件类型检查:', error);
  }

  // 建立ukey到组件的映射
  const ukeyToComponentMap = new Map<string, any>();
  for (const lib of teamLibraries) {
    if (lib && lib.componentList && Array.isArray(lib.componentList)) {
      lib.componentList.forEach((comp: any) => {
        if (comp && comp.ukey) {
          ukeyToComponentMap.set(String(comp.ukey), comp);
        }
      });
    }
  }

  // 1) 先收集普通组件实例（用于计算布局）
  // 2) 再导入普通组件（以及非必需组件集会被跳过）
  for (const group of groups) {
    const instances: any[] = [];
    
    for (const ukey of group.ukeys) {
      try {
        // 检查 ukey 是否有效
        if (!ukey || typeof ukey !== 'string' || ukey.trim() === '') {
          failedUkeys.set(ukey, '无效的 ukey');
          failCount++;
          continue;
        }

        // 跳过 4 个必需组件集（已在第一阶段处理）
        if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(group.description)) continue;

        // 跳过非必需组件集（避免 importComponentByKeyAsync 报错）
        const componentInfo = ukeyToComponentMap.get(ukey);
        if (componentInfo && componentInfo.type === 'COMPONENT_SET') continue;

        if (typeof mg.importComponentByKeyAsync !== 'function') {
          failCount++;
          continue;
        }

        let componentNode: any;
        try {
          componentNode = await mg.importComponentByKeyAsync(ukey);
        } catch (error: any) {
          // 捕获导入错误，包括可能的 2022-return:5 等内部错误
          failedUkeys.set(ukey, parseErrorReason(error));
          failCount++;
          continue;
        }
        
        // 如果返回 null 或无效，也可能是 2022-return:5 错误（MasterGo 内部可能不抛异常，而是返回 null）
        if (!componentNode || typeof componentNode.createInstance !== 'function') {
          // 记录失败信息（可能是组件不存在或权限不足导致的返回 null）
          failedUkeys.set(ukey, '组件不存在或返回无效');
          failCount++;
          continue;
        }

        const instance = componentNode.createInstance();
        if (!instance) {
          failCount++;
          continue;
        }

        currentPage.appendChild(instance);
        instances.push(instance);
        successCount++;
      } catch (error: any) {
        failedUkeys.set(ukey, parseErrorReason(error));
        failCount++;
      }
    }

    if (instances.length > 0) {
      // 在描述组内排序：名称不含"预览"的在前，含"预览"的在后
      instances.sort((a, b) => {
        const aIsPreview = isPreviewNode(a);
        const bIsPreview = isPreviewNode(b);
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
    // 如果没有普通组件，直接处理必需组件集
    const requiredMap = new Map<string, string>();
    groups.forEach(g => {
      if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(g.description) && Array.isArray(g.ukeys) && g.ukeys[0]) {
        requiredMap.set(g.description, String(g.ukeys[0]));
      }
    });

    let setX = viewportCenter.x;
    const defaultSetY = viewportCenter.y - 360;
    for (const desc of REQUIRED_COMPONENT_SET_ORDER) {
      const ukey = requiredMap.get(desc);
      if (!ukey) continue;
      try {
        const result = await importRequiredComponentSet(ukey, desc, currentPage, { x: setX, y: defaultSetY, gap: 20 });
        if (result?.success) {
          successCount++;
          if (typeof result.endX === 'number') setX = result.endX;
        } else {
          // 记录组件集导入失败
          failedUkeys.set(ukey, result?.error || '组件集导入失败');
          failCount++;
        }
      } catch (e: any) {
        failedUkeys.set(ukey, parseErrorReason(e));
        failCount++;
      }
    }

    if (failCount > 0) {
      mg.notify(`导入失败，请检查组件是否在团队库中`, { timeout: 3000 });
    }
    
    // 发送导入完成消息到 UI 端
    sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
      success: failCount === 0,
      successCount,
      failCount,
    });
    return;
  }

  // 3) 先排列普通组件（在插件界面中显示出来的导入内容），但不替换实例（因为必需组件集还未导入）
  // 保存普通组件实例的名称列表，用于后续识别
  const normalComponentNames = new Set<string>();
  descriptionGroups.forEach(group => {
    group.instances.forEach(inst => {
      if (inst && inst.name) {
        normalComponentNames.add(String(inst.name));
      }
    });
  });

  const processResult = processImportedInstances(descriptionGroups, currentPage, viewportCenter, skipConvert);

  // 4) 根据首个普通组件的位置，计算必需组件集的位置
  let requiredSetX = viewportCenter.x; // 默认值
  let requiredSetY = viewportCenter.y - 360; // 默认值
  let convertedComponentNames: Set<string> | null = null;
  
  if (processResult !== null && typeof processResult === 'object' && 'x' in processResult && 'y' in processResult) {
    // 必需组件集的首个组件放在首个普通组件的正上方，间距 3000
    const componentSetSpacing = 3000;
    requiredSetX = processResult.x;
    requiredSetY = processResult.y - componentSetSpacing;
    // 如果是普通导入，获取已转换组件的名称列表
    if ('convertedComponentNames' in processResult && processResult.convertedComponentNames instanceof Set) {
      convertedComponentNames = processResult.convertedComponentNames;
    }
  }

  // 5) 按固定顺序处理 4 个组件集（横向一排：背景、IP、LOGO、主题；每组先横后竖）
  const requiredMap = new Map<string, string>();
    groups.forEach(g => {
      if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(g.description) && Array.isArray(g.ukeys) && g.ukeys[0]) {
        requiredMap.set(g.description, String(g.ukeys[0]));
      }
    });

  // 给组件集一条单独的横向排布行，首个组件放在首个普通组件的正上方
  // 同时收集所有必需组件集的组件（用于替换普通组件内部的实例）
  const requiredComponentsMap = new Map<string, any>();
  let setX = requiredSetX;
  for (const desc of REQUIRED_COMPONENT_SET_ORDER) {
    const ukey = requiredMap.get(desc);
    if (!ukey) continue;
    try {
      const result = await importRequiredComponentSet(ukey, desc, currentPage, { x: setX, y: requiredSetY, gap: 20 });
      if (result?.success) {
        successCount++;
        if (typeof result.endX === 'number') setX = result.endX;
        // 收集必需组件集的组件
        if (result.components && result.components.size > 0) {
          result.components.forEach((component, name) => {
            requiredComponentsMap.set(name, component);
          });
        }
      } else {
        // 记录组件集导入失败
        failedUkeys.set(ukey, result?.error || '组件集导入失败');
        failCount++;
      }
    } catch (e: any) {
      failedUkeys.set(ukey, parseErrorReason(e));
      failCount++;
    }
  }

  // 6) 替换普通组件内部的实例为必需组件集的组件实例
  if (requiredComponentsMap.size > 0) {
    try {
      const pageChildren = currentPage.children || [];
      for (const child of pageChildren) {
        if (!child) continue;
        
        if (skipConvert) {
          // 商店图导入：查找 Frame 节点（解绑后的普通组件）
          if (child.type === 'FRAME' && normalComponentNames.has(child.name)) {
            try {
              if (!child.removed) {
                replaceInternalInstances(child, requiredComponentsMap);
              }
            } catch (e: any) {
              // 节点不存在错误是预期的（替换过程中节点会被删除），静默处理
              if (e?.message && !e.message.includes('does not exist')) {
                console.error(`替换普通组件内部实例失败 (${child.name}):`, e);
              }
            }
          }
        } else {
          // 组件库导入：查找 Component 节点（已转换的普通组件）
          if (child.type === 'COMPONENT' && convertedComponentNames && convertedComponentNames.has(child.name)) {
            try {
              if (!child.removed) {
                replaceInternalInstances(child, requiredComponentsMap);
              }
            } catch (e: any) {
              // 节点不存在错误是预期的（替换过程中节点会被删除），静默处理
              if (e?.message && !e.message.includes('does not exist')) {
                console.error(`替换普通组件内部实例失败 (${child.name}):`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('替换普通组件内部实例时出错:', e);
    }
    
    // 等待一段时间，确保所有替换操作的副作用（如节点删除、状态更新等）已完成
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 7. 完成处理（已在排列阶段实现同行顶对齐，无需额外操作）

  // 汇总并输出错误信息
  if (failCount > 0 || failedUkeys.size > 0) {
    mg.notify(`成功导入 ${successCount} 个组件，失败 ${failCount} 个`, { timeout: 3000 });
  } else {
    mg.notify(`成功导入并处理 ${successCount} 个组件`, { timeout: 2000 });
  }

  // 发送导入完成消息到 UI 端
  sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
    success: true,
    successCount,
    failCount,
  });
}

export default {
  type: MessageType.IMPORT_COMPONENT_BY_UKEY,
  handler,
};
