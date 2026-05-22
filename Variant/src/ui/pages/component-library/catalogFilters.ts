/**
 * 组件库浏览与批量导入共用的屏蔽规则。
 */

/** 需整体屏蔽的团队库（分类）关键词，不作用于组件描述 */
export const COMPONENT_LIBRARY_HIDDEN_KEYWORDS = ['在线游戏', '新游预约'] as const;

/** 团队库名是否命中整体屏蔽关键词 */
export function containsCatalogHiddenKeyword(libraryLabel: string): boolean {
  return COMPONENT_LIBRARY_HIDDEN_KEYWORDS.some((keyword) => libraryLabel.includes(keyword));
}

/**
 * @returns true 表示该分组在浏览列表规则下应隐藏（不含标签筛选与搜索框）
 */
export function shouldExcludeBrowseGroup(group: {
  description: string;
  category: string;
}): boolean {
  if (containsCatalogHiddenKeyword(group.category)) {
    return true;
  }
  return !group.description || group.description.trim() === '';
}
