import { compareAlphanumeric } from '../../utils/common';
import { containsCatalogHiddenKeyword } from './catalogFilters';
import type { ComponentCatalogGroup } from './catalogGroup';

/** 从分组列表提取团队库标签名 */
export function buildCatalogLibraryTags(groups: ComponentCatalogGroup[]): string[] {
  const tags = new Set<string>();
  groups.forEach((group) => {
    if (group.category && !containsCatalogHiddenKeyword(group.category)) {
      tags.add(group.category);
    }
  });
  return Array.from(tags).sort(compareAlphanumeric);
}
