// @ts-nocheck

/**
 * 自动布局属性捕获与回填（兼容不同 MasterGo SDK 字段）
 *
 * 说明：
 * - MasterGo 文档中自动布局字段以 `flexMode`/`padding*`/`itemSpacing` 等为主：
 *   `https://developers.mastergo.com/apis/componentSetNode.html`
 * - 代码中同时兼容 Figma 风格的 `layoutMode`（若存在）
 */

export type AutoLayoutProps = Record<string, any>;

const AUTO_LAYOUT_KEYS = [
  // MasterGo 风格
  'flexMode',
  'flexWrap',
  'itemSpacing',
  'crossAxisSpacing',
  'mainAxisAlignItems',
  'crossAxisAlignItems',
  'mainAxisSizingMode',
  'crossAxisSizingMode',
  'crossAxisAlignContent',
  'itemReverseZIndex',
  'strokesIncludedInLayout',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // Figma 风格（部分环境可能存在）
  'layoutMode',
];

/**
 * 捕获节点的自动布局相关属性（存在才记录）
 */
export function captureAutoLayoutProps(node: any): AutoLayoutProps {
  const result: AutoLayoutProps = {};
  if (!node) return result;

  for (const key of AUTO_LAYOUT_KEYS) {
    try {
      if (!(key in node)) continue;
      const val = node[key];
      if (val === undefined || typeof val === 'function') continue;
      if (typeof mg !== 'undefined' && val === (mg as any).mixed) continue;
      result[key] = val;
    } catch {
      // ignore
    }
  }

  return result;
}

/**
 * 回填自动布局属性到目标节点（尽力而为，失败忽略）
 */
export function applyAutoLayoutProps(target: any, props?: AutoLayoutProps) {
  if (!target || !props) return;

  for (const key of AUTO_LAYOUT_KEYS) {
    if (!(key in props)) continue;
    try {
      target[key] = props[key];
    } catch {
      // ignore
    }
  }
}

/**
 * 合并两份自动布局属性（后者优先）
 */
export function mergeAutoLayoutProps(a?: AutoLayoutProps, b?: AutoLayoutProps): AutoLayoutProps {
  return { ...(a || {}), ...(b || {}) };
}


