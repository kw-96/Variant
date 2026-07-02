/** 归一化团队库名称，便于精确/前缀匹配 */
function normalizeLibraryLabel(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** 强制屏蔽的团队库名称（完全匹配，大小写不敏感） */
export const COMPONENT_LIBRARY_BLOCKED_LIBRARY_NAMES = [
  '线框图组件',
  '支付宝小程序基础控件库',
  'Ant Design 5.0',
  'Ant Design For AI',
  'MasterGo Design For AI',
  'TDesign for mobile',
  'WeUI基础样式库',
  '🚧 Music One 测试版',
  'Music One 测试版',
  '有道精品课品牌迭代'
] as const;

/** 强制屏蔽的团队库名称前缀（归一化后以该前缀开头即屏蔽） */
export const COMPONENT_LIBRARY_BLOCKED_LIBRARY_PREFIXES = [
  'Arco Design Mobile',
  'Arco Design System',
  'Element Plus Design'
] as const;

/**
 * 判断团队库是否命中强制屏蔽名单。
 * @param libraryLabel 团队库名称（category / libraryName）
 */
export function isCatalogLibraryBlocked(libraryLabel: string): boolean {
  const normalized = normalizeLibraryLabel(libraryLabel);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  const blocked = COMPONENT_LIBRARY_BLOCKED_LIBRARY_NAMES.some(
    (name) => normalizeLibraryLabel(name).toLowerCase() === lower
  );
  if (blocked) return true;

  return COMPONENT_LIBRARY_BLOCKED_LIBRARY_PREFIXES.some((prefix) =>
    lower.startsWith(normalizeLibraryLabel(prefix).toLowerCase())
  );
}
