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
  let descriptionGroups: Array<{ description: string; instances: any[] }> = [];
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
        // 支持"库名::描述"格式
        let descriptionToCheck = group.description;
        if (group.description.includes('::')) {
          const parts = group.description.split('::');
          if (parts.length === 2) {
            descriptionToCheck = parts[1]; // 提取描述部分
          }
        }
        if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(descriptionToCheck)) continue;

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

  // 检查单个描述组是否需要使用多描述组排列规则
  // 条件：存在含预览命名的组件或存在5个以上组件（必需组件集除外）
  // 如果满足条件，将单个描述组拆分成多个子描述组（按组件名称相似性分组），然后使用多描述组的排列规则
  if (descriptionGroups.length === 1 && 
      !REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(descriptionGroups[0]?.description || '')) {
    const singleGroup = descriptionGroups[0];
    const hasPreview = singleGroup?.instances.some((inst: any) => isPreviewNode(inst));
    const hasMoreThan5 = (singleGroup?.instances.length || 0) > 5;
    
    if (hasPreview || hasMoreThan5) {
      // 按组件名称相似性分组
      const instances = singleGroup.instances || [];
      const splitGroups: Array<{ description: string; instances: any[] }> = [];
      
      console.log('[组件分组] 开始分组，总组件数:', instances.length);
      console.log('[组件分组] 原始组件名称列表:', instances.map(inst => inst?.name || '未命名'));
      
      // 提取组件名称的基础部分（去掉"_预览"后缀、文件大小和尺寸）
      // 命名格式："名称 文件大小 尺寸" 或 "名称_预览 文件大小 尺寸"
      const getBaseName = (name: string): string => {
        const originalName = name;
        let nameStr = String(name || '').trim();
        if (!nameStr) {
          console.log('[getBaseName] 原始名称为空:', originalName);
          return '';
        }
        
        console.log('[getBaseName] 原始名称:', originalName);
        
        // 先去掉"_预览"后缀（注意是下划线+预览）
        if (nameStr.includes('_预览')) {
          nameStr = nameStr.replace(/_预览/g, '');
          console.log('[getBaseName] 去掉"_预览"后:', nameStr);
        }
        
        // 去掉末尾的文件大小和尺寸部分
        // 格式通常是：空格 + 数字+k（如"300k"、"500k"） + 空格 + 尺寸（如"1080×1880"、"1080x1880"）
        // 尺寸符号可能是 ×（Unicode）或 x（ASCII）
        // 例如："组件A 300k 1080×1880" -> "组件A"
        // 例如："组件A_预览 500k 1080×1880" -> "组件A"
        
        // 先去掉末尾的尺寸格式（支持 × 和 x 两种符号，如"1080×1880"、"1080x1880"等）
        const beforeSize = nameStr;
        // 匹配：空格 + 数字 + ×或x + 数字
        nameStr = nameStr.replace(/\s+\d+[×x]\d+$/i, '');
        if (beforeSize !== nameStr) {
          console.log('[getBaseName] 去掉尺寸后:', nameStr);
        }
        
        // 再去掉末尾的文件大小格式（如"300k"、"500k"等，单位是k）
        const beforeFileSize = nameStr;
        // 匹配：空格 + 数字（可含小数点）+ k
        nameStr = nameStr.replace(/\s+\d+\.?\d*\s*k$/i, '');
        if (beforeFileSize !== nameStr) {
          console.log('[getBaseName] 去掉文件大小后:', nameStr);
        }
        
        const result = nameStr.trim();
        console.log('[getBaseName] 最终基础名称:', result, '(原始:', originalName, ')');
        return result;
      };
      
      // 计算多个字符串的共同前缀
      const getCommonPrefix = (strs: string[]): string => {
        if (strs.length === 0) return '';
        if (strs.length === 1) return strs[0];
        
        let prefix = strs[0];
        for (let i = 1; i < strs.length; i++) {
          const str = strs[i];
          let j = 0;
          while (j < prefix.length && j < str.length && prefix[j] === str[j]) {
            j++;
          }
          prefix = prefix.substring(0, j);
          if (prefix === '') break;
        }
        return prefix;
      };
      
      // 按基础名称分组（初步分组）
      const nameGroups = new Map<string, any[]>();
      instances.forEach(inst => {
        const name = inst?.name || '';
        const baseName = getBaseName(name);
        
        // 如果基础名称为空，使用原名称
        const groupKey = baseName || name;
        
        console.log('[分组] 组件名称:', name, '-> 基础名称:', baseName, '-> 分组键:', groupKey);
        
        if (!nameGroups.has(groupKey)) {
          nameGroups.set(groupKey, []);
        }
        nameGroups.get(groupKey)!.push(inst);
      });
      
      // 对于包含"-"的名称，进一步合并相似的分组
      // 如果多个分组的前缀（首个"-"前面）相同，且"-"后面的部分有共同前缀，则合并为一组
      const mergedGroups = new Map<string, any[]>();
      const processedKeys = new Set<string>();
      
      nameGroups.forEach((groupInstances, groupKey) => {
        if (processedKeys.has(groupKey)) {
          console.log('[分组合并] 跳过已处理的分组键:', groupKey);
          return;
        }
        
        // 如果名称包含"-"，尝试找到相似的分组
        if (groupKey.includes('-')) {
          const firstDashIndex = groupKey.indexOf('-');
          const prefix = groupKey.substring(0, firstDashIndex);
          const suffix = groupKey.substring(firstDashIndex + 1);
          
          console.log('[分组合并] 检查分组键:', groupKey, '前缀:', prefix, '后缀:', suffix);
          
          // 查找所有具有相同前缀的分组
          const similarGroups: Array<{ key: string; instances: any[]; suffix: string }> = [];
          nameGroups.forEach((instances, key) => {
            if (key.includes('-') && key.startsWith(prefix + '-')) {
              const keySuffix = key.substring(firstDashIndex + 1);
              similarGroups.push({ key, instances, suffix: keySuffix });
              console.log('[分组合并] 找到相似分组:', key, '后缀:', keySuffix);
            }
          });
          
          console.log('[分组合并] 相似分组数量:', similarGroups.length, '分组键列表:', similarGroups.map(g => g.key));
          
          // 如果有多个相似分组，计算共同前缀
          if (similarGroups.length > 1) {
            const suffixes = similarGroups.map(g => g.suffix);
            const commonSuffixPrefix = getCommonPrefix(suffixes);
            
            console.log('[分组合并] 后缀列表:', suffixes, '共同前缀:', commonSuffixPrefix, '长度:', commonSuffixPrefix.length);
            
            // 如果共同前缀长度大于0，合并这些分组
            if (commonSuffixPrefix.length > 0) {
              const mergedKey = prefix + '-' + commonSuffixPrefix;
              const mergedInstances: any[] = [];
              
              similarGroups.forEach(g => {
                mergedInstances.push(...g.instances);
                processedKeys.add(g.key);
              });
              
              mergedGroups.set(mergedKey, mergedInstances);
              console.log('[分组合并] 合并分组:', similarGroups.map(g => g.key).join(', '), '-> 合并键:', mergedKey);
              return;
            } else {
              console.log('[分组合并] 共同前缀为空，不合并');
            }
          } else {
            console.log('[分组合并] 相似分组数量不足，不合并');
          }
        }
        
        // 如果没有合并，直接使用原分组
        mergedGroups.set(groupKey, groupInstances);
        processedKeys.add(groupKey);
      });
      
      console.log('[组件分组] 分组结果:');
      mergedGroups.forEach((groupInstances, groupKey) => {
        console.log('[组件分组] 分组键:', groupKey, '包含组件数:', groupInstances.length, '组件名称:', groupInstances.map(inst => inst?.name || '未命名'));
      });
      
      // 将分组后的组件转换为描述组
      mergedGroups.forEach((groupInstances, groupKey) => {
        splitGroups.push({
          description: singleGroup.description,
          instances: groupInstances
        });
      });
      
      console.log('[组件分组] 最终生成的子描述组数量:', splitGroups.length);
      
      // 替换原来的单个描述组为拆分后的多个子描述组
      descriptionGroups = splitGroups;
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

    let setX = Math.round(viewportCenter.x);
    const defaultSetY = Math.round(viewportCenter.y - 360);
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

  // 处理普通组件的排列（单个描述组如果满足条件，已经在上面拆分成多个子组）
  // 注意：必需组件集始终使用原来的规则
  const processResult = processImportedInstances(descriptionGroups, currentPage, viewportCenter, skipConvert);

  // 4) 根据首个普通组件的位置，计算必需组件集的位置
  let requiredSetX = Math.round(viewportCenter.x); // 默认值
  let requiredSetY = Math.round(viewportCenter.y - 360); // 默认值
  let convertedComponentNames: Set<string> | null = null;
  
  if (processResult !== null && typeof processResult === 'object' && 'x' in processResult && 'y' in processResult) {
    // 必需组件集的首个组件放在首个普通组件的正上方，间距 3000
    const componentSetSpacing = 3000;
    requiredSetX = Math.round(processResult.x);
    requiredSetY = Math.round(processResult.y - componentSetSpacing);
    // 如果是普通导入，获取已转换组件的名称列表
    if ('convertedComponentNames' in processResult && processResult.convertedComponentNames instanceof Set) {
      convertedComponentNames = processResult.convertedComponentNames;
    }
  }

  // 5) 按团队库和固定顺序处理必需组件集
  // 支持"库名::描述"格式，为每个团队库分别导入对应的必需组件集
  const requiredMapByLibrary = new Map<string, Map<string, string>>(); // 库名 -> (描述 -> ukey)
  
  groups.forEach(g => {
    // 检查是否为必需组件集描述（支持"库名::描述"格式）
    let libraryName: string | null = null;
    let description: string = g.description;
    
    // 解析"库名::描述"格式
    if (g.description.includes('::')) {
      const parts = g.description.split('::');
      if (parts.length === 2) {
        libraryName = parts[0];
        description = parts[1];
      }
    }
    
    // 检查是否为必需组件集描述
    if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(description) && Array.isArray(g.ukeys) && g.ukeys[0]) {
      const libKey = libraryName || 'default'; // 如果没有库名，使用 'default'
      if (!requiredMapByLibrary.has(libKey)) {
        requiredMapByLibrary.set(libKey, new Map());
      }
      requiredMapByLibrary.get(libKey)!.set(description, String(g.ukeys[0]));
    }
  });

  // 给组件集一条单独的横向排布行，首个组件放在首个普通组件的正上方
  // 同时收集所有必需组件集的组件（用于替换普通组件内部的实例）
  const requiredComponentsMap = new Map<string, any>();
  let setX = requiredSetX;
  
  // 为每个团队库分别导入必需组件集
  for (const [libKey, requiredMap] of requiredMapByLibrary.entries()) {
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
