import { parseErrorReason } from './component-utils';

export interface IImportItem {
  ukey: string;
  type?: string;
}

/**
 * 短暂让出宿主，便于控制台按阶段观察 2022 刷屏位置。
 */
export function delayHost(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 输出导入阶段诊断标记（便于对照宿主 2022-return:5 出现区间）。
 */
export function logImportStage(stage: string, detail?: string) {
  const suffix = detail ? ` | ${detail}` : '';
  console.log(`[导入诊断] ===== ${stage}${suffix} =====`);
}

/**
 * 仅拉取团队库 ComponentNode，不创建实例。
 */
export async function importComponentNode(
  item: IImportItem
): Promise<{ componentNode: any | null; skipped?: boolean; error?: string }> {
  const ukey = String(item.ukey || '').trim();
  if (!ukey) {
    return { componentNode: null, error: '无效的 ukey' };
  }

  const type = String(item.type || '').toUpperCase();
  if (type === 'COMPONENT_SET') {
    return { componentNode: null, skipped: true };
  }

  if (typeof mg.importComponentByKeyAsync !== 'function') {
    return { componentNode: null, error: '当前环境不支持按 ukey 导入' };
  }

  try {
    const componentNode = await mg.importComponentByKeyAsync(ukey);
    if (!componentNode || typeof componentNode.createInstance !== 'function') {
      return { componentNode: null, error: '组件不存在或返回无效' };
    }
    return { componentNode };
  } catch (error: unknown) {
    return { componentNode: null, error: parseErrorReason(error) };
  }
}

/**
 * 从已导入的 ComponentNode 创建实例。
 */
export function createInstanceFromImported(
  componentNode: any
): { instance: any | null; error?: string } {
  try {
    if (!componentNode || typeof componentNode.createInstance !== 'function') {
      return { instance: null, error: '组件不存在或返回无效' };
    }
    const instance = componentNode.createInstance();
    if (!instance) {
      return { instance: null, error: '创建实例失败' };
    }
    return { instance };
  } catch (error: unknown) {
    return { instance: null, error: parseErrorReason(error) };
  }
}

/**
 * 按类型导入单个团队库组件并创建实例。
 * COMPONENT 走 importComponentByKeyAsync；COMPONENT_SET 交由组件集流程处理。
 */
export async function importOneComponentInstance(
  item: IImportItem
): Promise<{ instance: any | null; skipped?: boolean; error?: string }> {
  const imported = await importComponentNode(item);
  if (imported.skipped) {
    return { instance: null, skipped: true };
  }
  if (!imported.componentNode) {
    return { instance: null, error: imported.error };
  }
  return createInstanceFromImported(imported.componentNode);
}
