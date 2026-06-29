export interface ComponentCatalogItem {
  id: string;
  name: string;
  ukey: string;
  description: string;
  type: 'COMPONENT' | 'COMPONENT_SET' | string;
  cover: string;
  width: number;
  height: number;
  libraryName: string;
  category: string;
}

/** 进程内缓存：关闭插件面板后仍保留，重启 MasterGo 后清空 */
let catalogCache: ComponentCatalogItem[] | null = null;
let refreshing = false;
let backgroundRefreshDone = false;

/** 本会话是否已完成过后台刷新 */
export function hasBackgroundRefreshDone() {
  return backgroundRefreshDone;
}

/** 标记本会话后台刷新已完成 */
export function markBackgroundRefreshDone() {
  backgroundRefreshDone = true;
}

/** 读取当前缓存（可能为 null） */
export function getCachedCatalog() {
  return catalogCache;
}

/**
 * 从团队库 API 拉取并更新进程内缓存。
 */
export async function refreshCatalogCache(): Promise<ComponentCatalogItem[]> {
  const rawLibraries = await mg.getTeamLibraryAsync();
  const teamLibraries = Array.isArray(rawLibraries) ? rawLibraries : [];

  if (teamLibraries.length === 0) {
    catalogCache = [];
    return [];
  }

  const allComponents: ComponentCatalogItem[] = [];

  for (const lib of teamLibraries) {
    if (!lib) continue;
    const libName = lib.name ? String(lib.name).trim() : '未命名库';
    if (!lib.componentList || !Array.isArray(lib.componentList)) continue;

    lib.componentList.forEach((comp: any) => {
      if (!comp) return;
      allComponents.push({
        id: comp.id ? String(comp.id) : '',
        name: comp.name ? String(comp.name).trim() : '未命名组件',
        ukey: comp.ukey ? String(comp.ukey) : '',
        description: comp.description ? String(comp.description).trim() : '',
        type: comp.type || 'COMPONENT',
        cover: comp.cover ? String(comp.cover) : '',
        width: Number(comp.width) || 0,
        height: Number(comp.height) || 0,
        libraryName: libName,
        category: libName
      });
    });
  }

  catalogCache = allComponents;
  return allComponents;
}

/** 是否已有后台刷新在进行 */
export function isCatalogRefreshing() {
  return refreshing;
}

/** 标记后台刷新状态 */
export function setCatalogRefreshing(value: boolean) {
  refreshing = value;
}
