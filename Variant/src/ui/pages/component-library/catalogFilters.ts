/**
 * 组件库浏览与批量导入共用的屏蔽规则。
 */

/** 需整体屏蔽的分类/描述关键词（与浏览器列表一致） */
export const COMPONENT_LIBRARY_HIDDEN_KEYWORDS = ['在线游戏', '新游预约'] as const;

/** 需在描述维度屏蔽的关键词 */
export const COMPONENT_LIBRARY_EXCLUDED_DESC_KEYWORDS = [
  '背景',
  'LOGO',
  'IP',
  '主题'
] as const;

/** 文案是否命中整体屏蔽关键词 */
export function containsCatalogHiddenKeyword(text: string): boolean {
  return COMPONENT_LIBRARY_HIDDEN_KEYWORDS.some((keyword) => text.includes(keyword));
}

/** 描述是否命中需屏蔽的子集关键词 */
export function containsCatalogExcludedDescription(text: string): boolean {
  return COMPONENT_LIBRARY_EXCLUDED_DESC_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );
}

export interface IComponentLookupRow {
  type: string;
  description: string;
  category: string;
}

/**
 * @returns true 表示该分组在浏览列表规则下应隐藏（不含标签筛选与搜索框）
 */
export function shouldExcludeBrowseGroup<G extends {
  description: string;
  category: string;
  components: { type: string }[];
}>(group: G, allRows: IComponentLookupRow[]): boolean {
  if (
    containsCatalogHiddenKeyword(group.category) ||
    containsCatalogHiddenKeyword(group.description)
  ) {
    return true;
  }
  if (containsCatalogExcludedDescription(group.description)) return true;

  if (!group.description || group.description.trim() === '') {
    const hasComponentSet = group.components.some((c) => c.type === 'COMPONENT_SET');
    if (!hasComponentSet && group.components.length > 0) {
      const hasMatchingComponentSet = allRows.some(
        (comp) =>
          comp.type === 'COMPONENT_SET' &&
          containsCatalogExcludedDescription(comp.description) &&
          comp.category === group.category
      );
      if (hasMatchingComponentSet) return true;
    }
  }
  return false;
}
