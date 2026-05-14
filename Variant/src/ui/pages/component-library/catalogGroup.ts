import { compareAlphanumeric } from '../../utils/common';

/** MasterGo GET_COMPONENT_LIBRARY 返回单条组件 */
export interface ComponentCatalogRow {
  id: string;
  name: string;
  ukey: string;
  description: string;
  type: string;
  cover: string;
  width: number;
  height: number;
  libraryName: string;
  category: string;
}

/** 与浏览页分组卡片一致的聚合结构 */
export interface ComponentCatalogGroup {
  key: string;
  description: string;
  category: string;
  components: ComponentCatalogRow[];
  cover: string;
  libraryName: string;
}

/**
 * 按 库类目 + 组件描述 聚合并排序（卡片列表顺序）。
 */
export function buildComponentCatalogGroups(
  rows: ComponentCatalogRow[]
): ComponentCatalogGroup[] {
  const groups: Record<string, ComponentCatalogGroup> = {};

  rows.forEach((comp) => {
    const desc = comp.description ? comp.description.trim() : '';
    const uniqueKey = `${comp.category}::${desc}`;

    if (!groups[uniqueKey]) {
      groups[uniqueKey] = {
        key: uniqueKey,
        description: desc,
        category: comp.category,
        components: [],
        cover: comp.cover,
        libraryName: comp.libraryName
      };
    }

    groups[uniqueKey].components.push(comp);

    if (!groups[uniqueKey].cover && comp.cover) {
      groups[uniqueKey].cover = comp.cover;
    }
  });

  const list = Object.keys(groups).map((k) => groups[k]);
  list.forEach((g) => {
    g.components.sort((c1, c2) => compareAlphanumeric(c1.name || '', c2.name || ''));
  });
  list.sort((g1, g2) => {
    const lib1 = g1.libraryName || g1.category || '';
    const lib2 = g2.libraryName || g2.category || '';
    const byLib = compareAlphanumeric(lib1, lib2);
    if (byLib !== 0) return byLib;
    return compareAlphanumeric(g1.description || '', g2.description || '');
  });
  return list;
}

/**
 * 组件描述中取第一个空白符前的片段（团队库内作为「序号」使用；建库时约定序号在库内唯一）。
 */
export function descriptionFirstSegment(description: string): string {
  const t = description.trim();
  const m = t.match(/^(\S+)/);
  return m ? m[1] : '';
}
