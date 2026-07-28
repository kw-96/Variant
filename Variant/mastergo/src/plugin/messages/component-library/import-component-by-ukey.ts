// @ts-nocheck
import { MessageType, sendMsgToUI } from '../../../../../src/messages';
import {
  summarizeImportFailures,
  type IImportCompletePayload
} from '../../../../../src/component-library/importFailure';
import { processImportedInstances } from './import-processing';
import {
  createInstanceFromImported,
  importComponentNode,
  type IImportItem
} from './import-one';
import { isPreviewNode, parseErrorReason, REQUIRED_COMPONENT_SET_DESCRIPTIONS } from './component-utils';

type ImportGroup = {
  description: string;
  ukeys?: string[];
  items?: IImportItem[];
};

/** 汇总失败原因并通知 UI / 宿主 */
function finishImport(
  successCount: number,
  failCount: number,
  failedUkeys: Map<string, string>,
  aborted = false
) {
  const { reasonCounts, message } = summarizeImportFailures(failedUkeys);
  const payload: IImportCompletePayload = {
    success: failCount === 0 && !aborted,
    successCount,
    failCount,
    failMessage: message,
    reasonCounts,
    aborted
  };
  if (failCount > 0 || message || aborted) {
    const abortHint = aborted ? '（已中止后续导入）' : '';
    console.error(
      `[组件导入] 成功 ${successCount}，失败 ${failCount}${abortHint}。${message}`.trim(),
      { reasonCounts, aborted }
    );
  } else {
    console.log(`[组件导入] 成功导入并处理 ${successCount} 个组件`);
  }
  sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, payload);
}

/**
 * 通过 ukey 导入组件
 * @param data.groups 按描述分组的组件列表 [{ description: string, ukeys: string[] }]
 * @param data.skipConvert 是否跳过转组件/预览替换，商店图导入时设为 true
 */
/** 将分组统一为带 type 的导入项 */
function normalizeGroupItems(group: ImportGroup): IImportItem[] {
  if (Array.isArray(group.items) && group.items.length > 0) {
    return group.items
      .filter((item) => item && item.ukey)
      .map((item) => ({ ukey: String(item.ukey), type: item.type }));
  }
  if (Array.isArray(group.ukeys)) {
    return group.ukeys.filter(Boolean).map((ukey) => ({ ukey: String(ukey) }));
  }
  return [];
}

async function handler(data: { groups?: ImportGroup[], ukeys?: string[], skipConvert?: boolean }) {
  // 兼容旧格式：如果传递的是 ukeys 数组，转换为 groups 格式
  let groups: ImportGroup[] = [];
  if (data.groups && Array.isArray(data.groups)) {
    groups = data.groups;
  } else if (data.ukeys && Array.isArray(data.ukeys)) {
    // 兼容旧格式：所有组件归为一个"未分组"描述
    groups = [{ description: '未分组', ukeys: data.ukeys }];
  }
  
  if (!groups || groups.length === 0) {
    console.error('[组件导入] 请选择要导入的组件');
    sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
      success: false,
      successCount: 0,
      failCount: 0,
      failMessage: '请选择要导入的组件'
    });
    return;
  }

  const currentPage = mg.document.currentPage;
  if (!currentPage) {
    console.error('[组件导入] 当前页面不可用');
    sendMsgToUI(MessageType.IMPORT_COMPONENT_COMPLETE, {
      success: false,
      successCount: 0,
      failCount: 0,
      failMessage: '当前页面不可用'
    });
    return;
  }

  const viewportCenter = mg.viewport.center;
  let descriptionGroups: Array<{ description: string; instances: any[] }> = [];
  let successCount = 0;
  let failCount = 0;
  const skipConvert = data.skipConvert === true; // 商店图导入时跳过转换步骤
  const failedUkeys = new Map<string, string>(); // 记录失败的 ukey 和原因，用于汇总错误信息

  // 获取团队库，用于补全缺失的 type 信息
  let teamLibraries: any[] = [];
  try {
    teamLibraries = await mg.getTeamLibraryAsync();
  } catch (error) {
    console.warn('获取团队库失败，将跳过组件类型补全:', error);
  }

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

  // 1) 先批量拉取远端 ComponentNode，再统一 createInstance
  //    组件集走专用 API，避免 2022-return:5
  type PendingImport = {
    description: string;
    item: IImportItem;
    componentNode: any;
  };
  const pendingImports: PendingImport[] = [];

  for (const group of groups) {
    const items = normalizeGroupItems(group);

    // 跳过 4 个必需组件集（后续专用流程处理）
    let descriptionToCheck = group.description;
    if (group.description.includes('::')) {
      const parts = group.description.split('::');
      if (parts.length === 2) {
        descriptionToCheck = parts[1];
      }
    }
    if (REQUIRED_COMPONENT_SET_DESCRIPTIONS.has(descriptionToCheck)) {
      continue;
    }

    for (const rawItem of items) {
      try {
        const mapped = ukeyToComponentMap.get(rawItem.ukey);
        const item: IImportItem = {
          ukey: rawItem.ukey,
          type: rawItem.type || mapped?.type
        };

        // 非必需组件集：不能用 importComponentByKeyAsync
        if (String(item.type || '').toUpperCase() === 'COMPONENT_SET') {
          continue;
        }

        const result = await importComponentNode(item);
        if (result.skipped) continue;
        if (!result.componentNode) {
          failedUkeys.set(item.ukey, result.error || '导入失败');
          failCount++;
          console.error(`[组件导入] 失败 ukey=${item.ukey} type=${item.type || '未知'} reason=${result.error || '未知'}`);
          continue;
        }

        pendingImports.push({
          description: group.description,
          item,
          componentNode: result.componentNode
        });
      } catch (error: any) {
        failedUkeys.set(rawItem.ukey, parseErrorReason(error));
        failCount++;
        console.error(`[组件导入] 异常 ukey=${rawItem.ukey}`, error);
      }
    }
  }
  const instancesByDescription = new Map<string, any[]>();
  for (const pending of pendingImports) {
    try {
      const created = createInstanceFromImported(pending.componentNode);
      if (!created.instance) {
        failedUkeys.set(pending.item.ukey, created.error || '创建实例失败');
        failCount++;
        console.error(
          `[组件导入] 创建实例失败 ukey=${pending.item.ukey} reason=${created.error || '未知'}`
        );
        continue;
      }

      currentPage.appendChild(created.instance);
      const list = instancesByDescription.get(pending.description) || [];
      list.push(created.instance);
      instancesByDescription.set(pending.description, list);
      successCount++;
    } catch (error: any) {
      failedUkeys.set(pending.item.ukey, parseErrorReason(error));
      failCount++;
      console.error(`[组件导入] 创建实例异常 ukey=${pending.item.ukey}`, error);
    }
  }

  instancesByDescription.forEach((instances, description) => {
    // 在描述组内排序：名称不含"预览"的在前，含"预览"的在后
    instances.sort((a, b) => {
      const aIsPreview = isPreviewNode(a);
      const bIsPreview = isPreviewNode(b);
      if (aIsPreview && !bIsPreview) return 1;
      if (!aIsPreview && bIsPreview) return -1;
      return 0;
    });
    descriptionGroups.push({ description, instances });
  });
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

      // 提取组件名称的基础部分（去掉"_预览"后缀、文件大小和尺寸）
      const getBaseName = (name: string): string => {
        let nameStr = String(name || '').trim();
        if (!nameStr) return '';
        if (nameStr.includes('_预览')) {
          nameStr = nameStr.replace(/_预览/g, '');
        }
        nameStr = nameStr.replace(/\s+\d+[×x]\d+$/i, '');
        nameStr = nameStr.replace(/\s+\d+\.?\d*\s*k$/i, '');
        return nameStr.trim();
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
        
        const groupKey = baseName || name;
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
          return;
        }

        if (groupKey.includes('-')) {
          const firstDashIndex = groupKey.indexOf('-');
          const prefix = groupKey.substring(0, firstDashIndex);

          const similarGroups: Array<{ key: string; instances: any[]; suffix: string }> = [];
          nameGroups.forEach((instances, key) => {
            if (key.includes('-') && key.startsWith(prefix + '-')) {
              const keySuffix = key.substring(firstDashIndex + 1);
              similarGroups.push({ key, instances, suffix: keySuffix });
            }
          });

          if (similarGroups.length > 1) {
            const suffixes = similarGroups.map(g => g.suffix);
            const commonSuffixPrefix = getCommonPrefix(suffixes);

            if (commonSuffixPrefix.length > 0) {
              const mergedKey = prefix + '-' + commonSuffixPrefix;
              const mergedInstances: any[] = [];

              similarGroups.forEach(g => {
                mergedInstances.push(...g.instances);
                processedKeys.add(g.key);
              });

              mergedGroups.set(mergedKey, mergedInstances);
              return;
            }
          }
        }

        mergedGroups.set(groupKey, groupInstances);
        processedKeys.add(groupKey);
      });

      mergedGroups.forEach((groupInstances) => {
        splitGroups.push({
          description: singleGroup.description,
          instances: groupInstances
        });
      });

      descriptionGroups = splitGroups;
    }
  }

  if (descriptionGroups.length === 0) {
    // 已跳过必需组件集；无普通组件可导入时直接结束
    finishImport(successCount, failCount, failedUkeys);
    return;
  }

  try {
  // 3) 排布 / 解绑 / 转组件 / 预览内资源实例替换（不再导入或替换必需组件集槽位）
  try {
    await processImportedInstances(
      descriptionGroups,
      currentPage,
      viewportCenter,
      skipConvert
    );
  } catch (error: any) {
    failedUkeys.set('__layout__', parseErrorReason(error) || '排布处理失败');
    failCount++;
  }

  finishImport(successCount, failCount, failedUkeys);
  } catch (error: any) {
    failedUkeys.set('__fatal__', parseErrorReason(error) || '导入过程异常中断');
    failCount++;
    finishImport(successCount, failCount, failedUkeys);
  }
}

export default {
  type: MessageType.IMPORT_COMPONENT_BY_UKEY,
  handler,
};
