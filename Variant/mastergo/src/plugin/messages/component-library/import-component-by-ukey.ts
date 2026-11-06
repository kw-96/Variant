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

async function handler(data: { groups?: ImportGroup[], ukeys?: string[], skipConvert?: boolean, regionName?: string }) {
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
  // 保留同一组件描述组内的全部素材，不在配对前按名称拆分；
  // 正式图/预览图的名称标准化配对与尺寸接近度兜底配对，统一在 layout-calculator 内完成。

  if (descriptionGroups.length === 0) {
    // 已跳过必需组件集；无普通组件可导入时直接结束
    finishImport(successCount, failCount, failedUkeys);
    return;
  }

  try {
  // 3) 排布 / 解绑 / 转组件 / 预览内资源实例替换（不再导入或替换必需组件集槽位）
  let processResult: any = null;
  try {
    processResult = await processImportedInstances(
      descriptionGroups,
      currentPage,
      viewportCenter,
      skipConvert
    );
  } catch (error: any) {
    failedUkeys.set('__layout__', parseErrorReason(error) || '排布处理失败');
    failCount++;
  }

  // 2.5) 转换失败（尺寸校验回滚等）的素材不计入成功数，避免提示与实际产物不一致
  const conversionFailures: Array<{ name: string; reason: string }> =
    processResult && Array.isArray(processResult.conversionFailures)
      ? processResult.conversionFailures
      : [];
  if (conversionFailures.length) {
    conversionFailures.forEach((item, index) => {
      failedUkeys.set(`convert:${index}:${item.name}`, item.reason || '转为组件失败');
    });
    failCount += conversionFailures.length;
    successCount = Math.max(0, successCount - conversionFailures.length);
  }

  // 4) 导入成功后：将本次导入的全部素材包裹进以渠道名命名的区域（Section，缺失时回退 Frame）
  const regionName = String(data.regionName || '').trim();
  if (
    regionName &&
    successCount > 0 &&
    processResult &&
    Array.isArray(processResult.finalNodes) &&
    processResult.finalNodes.length > 0
  ) {
    try {
      createChannelRegion(processResult.finalNodes, regionName, currentPage);
    } catch (error) {
      console.error('[组件导入] 创建渠道区域失败:', error);
    }
  }

  finishImport(successCount, failCount, failedUkeys);
  } catch (error: any) {
    failedUkeys.set('__fatal__', parseErrorReason(error) || '导入过程异常中断');
    failCount++;
    finishImport(successCount, failCount, failedUkeys);
  }
}

/**
 * 将本次导入的所有素材包裹进一个以渠道名命名的区域（Section）。
 * - 使用 MasterGo 的“区域（Section）”，而非画板（Frame）；
 * - 区域背景填充 #3D3D3D；
 * - 区域宽高按素材整体边界计算，并向四周各扩展 400px；
 * - 保持素材当前相对位置、尺寸、名称与排版不变。
 */
function createChannelRegion(nodes: any[], name: string, currentPage: any) {
  const valid = nodes.filter(
    (n) =>
      n &&
      !n.removed &&
      typeof n.x === 'number' &&
      typeof n.y === 'number' &&
      typeof n.width === 'number' &&
      typeof n.height === 'number'
  );
  if (!valid.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  valid.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  const PAD = 400;
  // 记录各素材当前绝对坐标，稍后按区域位置换算相对坐标以保持排版
  const abs = valid.map((n) => ({ node: n, absX: n.x, absY: n.y }));

  // 兼容不支持 Section 的运行时：回退为普通画板（Frame），避免导入结果丢失
  let section: any = null;
  try {
    section = typeof (mg as any).createSection === 'function' ? (mg as any).createSection() : null;
  } catch (e) {
    section = null;
  }
  if (!section) {
    section = mg.createFrame();
    section.clipsContent = false;
  }
  section.name = name;
  currentPage.appendChild(section);

  // 背景填充 #3D3D3D（MasterGo SolidPaint.color 要求 RGBA，透明度写在 color.a 内）
  try {
    section.fills = [
      {
        type: 'SOLID',
        color: { r: 61 / 255, g: 61 / 255, b: 61 / 255, a: 1 },
      },
    ];
  } catch (e) {
    console.error('[组件导入] 设置区域填充失败:', e);
  }

  section.x = minX - PAD;
  section.y = minY - PAD;
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  if (typeof section.resizeWithoutConstraints === 'function') {
    section.resizeWithoutConstraints(w, h);
  } else if (typeof section.resize === 'function') {
    section.resize(w, h);
  } else {
    section.width = w;
    section.height = h;
  }

  abs.forEach(({ node, absX, absY }) => {
    try {
      section.appendChild(node);
      node.x = absX - section.x;
      node.y = absY - section.y;
    } catch (e) {
      console.error('[组件导入] 移动素材到区域失败:', e);
    }
  });

  return section;
}

export default {
  type: MessageType.IMPORT_COMPONENT_BY_UKEY,
  handler,
};
