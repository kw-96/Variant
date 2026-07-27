import type { ComponentCatalogGroup, ComponentCatalogRow } from './catalogGroup';
import {
  catalogTextEquals,
  descriptionFirstSegment,
  isCatalogLibraryMatch,
  normalizeCatalogText
} from './catalogGroup';

/** 旧「必需组件集」描述：导入流程已跳过，改由用户本地建组件 + 批量替换实例 */
const SKIPPED_COMPONENT_SET_DESCRIPTIONS = new Set(['背景', 'IP', 'LOGO', '主题']);

export interface IImportGroupPayload {
  description: string;
  items: Array<{ ukey: string; type?: string }>;
}

/**
 * 判断组件是否应进入导入列表。
 * 跳过背景/IP/LOGO/主题整组；也不再提交任何 COMPONENT_SET。
 */
function shouldIncludeCatalogComponent(
  comp: ComponentCatalogRow,
  description: string
): boolean {
  if (!comp.ukey) return false;
  if (SKIPPED_COMPONENT_SET_DESCRIPTIONS.has(description)) return false;
  const type = String(comp.type || '').toUpperCase();
  return !type || type === 'COMPONENT';
}

/**
 * 从目录分组构建导入载荷（附带 type，供主线程按 API 分流）。
 */
export function buildImportGroupsFromCatalog(
  selectedGroups: ComponentCatalogGroup[]
): IImportGroupPayload[] {
  const map = new Map<string, IImportGroupPayload>();

  selectedGroups.forEach((group) => {
    const libraryLabel = group.category || group.libraryName || '未命名团队库';
    const description = group.description || '未命名';
    const key = `${libraryLabel}::${description}`;

    group.components.forEach((comp) => {
      if (!shouldIncludeCatalogComponent(comp, description)) return;
      let entry = map.get(key);
      if (!entry) {
        entry = { description: key, items: [] };
        map.set(key, entry);
      }
      if (!entry.items.some((item) => item.ukey === String(comp.ukey))) {
        entry.items.push({ ukey: String(comp.ukey), type: comp.type });
      }
    });
  });

  return Array.from(map.values()).filter((g) => g.items.length > 0);
}

/**
 * 将单行输入映射到符合条件的分组（先整描述精确匹配，再退化为「首段序号」）。
 * 产品约定：团队库建库时描述首段（序号）在库内唯一，故序号匹配通常至多命中一个分组。
 * @param pool 已与浏览列表规则对齐、并完成团队库上下文过滤的分组列表
 */
export function matchCatalogLineToGroups(
  line: string,
  libraryLabel: string,
  pool: ComponentCatalogGroup[]
): ComponentCatalogGroup[] {
  const inLib = pool.filter((g) =>
    isCatalogLibraryMatch(g.category, g.libraryName, libraryLabel)
  );
  const normalizedLine = normalizeCatalogText(line);

  const byFull = inLib.filter((g) => catalogTextEquals(g.description, normalizedLine));
  if (byFull.length > 0) return byFull;

  return inLib.filter((g) =>
    catalogTextEquals(descriptionFirstSegment(g.description), normalizedLine)
  );
}

/**
 * 在多个团队库内匹配单行输入。
 * @param libraryLabels 已选团队库名列表
 */
export function matchCatalogLineToMultiLibraryGroups(
  line: string,
  libraryLabels: string[],
  pool: ComponentCatalogGroup[]
): ComponentCatalogGroup[] {
  return libraryLabels.flatMap((lib) => matchCatalogLineToGroups(line, lib, pool));
}
