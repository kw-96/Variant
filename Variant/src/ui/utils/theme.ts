/**
 * 主题工具 - 明暗模式的唯一来源
 * 主题遵循顺序：已记住的手动选择 > 系统 prefers-color-scheme > 深色兜底。
 * 插件不再下发主题，避免多个来源互相覆盖。
 */

export type ThemeName = 'dark' | 'light';

/** 主题持久化的 storage key */
export const THEME_STORAGE_KEY = 'theme_mode';

/**
 * 读取系统主题（prefers-color-scheme），不支持时回退深色
 * @returns 系统当前明暗主题
 */
export function getSystemTheme(): ThemeName {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch {}
  return 'dark';
}

/**
 * 把主题写到根节点，供 CSS 变量切换
 * @param theme 主题名称
 */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
}
