import type { ComponentCatalogGroup } from './catalogGroup';
import {
  catalogTextEquals,
  descriptionFirstSegment,
  isCatalogLibraryMatch,
  normalizeCatalogText
} from './catalogGroup';

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
