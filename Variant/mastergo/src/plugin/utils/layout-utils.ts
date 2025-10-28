/**
 * 布局工具函数
 * 提供统一的分类、排序、计算逻辑
 */

export interface LayoutItem {
  w: number;
  h: number;
  name?: string;
  [key: string]: any;
}

export interface CategorizedItems<T extends LayoutItem> {
  landscape: T[]; // 横版
  portrait: T[];   // 竖版
  square: T[];     // 方形
  kv: T[];         // KV（仅用于批量创建）
}

/**
 * 分类元素（按宽高比）
 */
export function categorizeItems<T extends LayoutItem>(
  items: T[],
  includeKV: boolean = false
): CategorizedItems<T> {
  const result: CategorizedItems<T> = {
    landscape: [],
    portrait: [],
    square: [],
    kv: [],
  };

  items.forEach(item => {
    if (includeKV && item.name && item.name.toLowerCase().split('kv').length > 1) {
      result.kv.push(item);
    } else if (item.w > item.h) {
      result.landscape.push(item);
    } else if (item.w < item.h) {
      result.portrait.push(item);
    } else {
      result.square.push(item);
    }
  });

  return result;
}

/**
 * 排序元素
 * 横版和竖版按面积排序，方形按宽度排序
 */
export function sortItems<T extends LayoutItem>(items: T[]): {
  landscape: T[];
  portrait: T[];
  square: T[];
} {
  return {
    landscape: [...items].filter(item => item.w > item.h).sort((a, b) => b.w * b.h - a.w * a.h),
    portrait: [...items].filter(item => item.w < item.h).sort((a, b) => b.w * b.h - a.w * a.h),
    square: [...items].filter(item => item.w === item.h).sort((a, b) => b.w - a.w),
  };
}

/**
 * 计算最大宽度和高度
 * maxW 为横版最大宽度和 1920 的较大值
 * maxH 为竖版最大高度
 */
export function calculateMaxDimensions<T extends LayoutItem>(
  landscape: T[],
  portrait: T[]
): { maxW: number; maxH: number } {
  const maxW = Math.max(
    Math.max(...(landscape.length > 0 ? landscape.map(item => item.w) : [0])),
    1920
  );
  const maxH = Math.max(...(portrait.length > 0 ? portrait.map(item => item.h) : [0]));
  
  return { maxW, maxH };
}

/**
 * 判断是否需要换行（横向）
 * @param currentTotalWidth 当前累积宽度
 * @param currentWidth 当前项宽度
 * @param nextItem 下一个元素（可选）
 * @param maxWidth 最大宽度限制
 * @returns 是否需要换行
 */
export function shouldBreakLine(
  currentTotalWidth: number,
  currentWidth: number,
  nextItem: LayoutItem | undefined,
  maxWidth: number
): boolean {
  if (!nextItem) return false;
  return currentTotalWidth + nextItem.w > maxWidth;
}

/**
 * 判断是否需要换列（纵向）
 * @param currentTotalHeight 当前累积高度
 * @param currentHeight 当前项高度
 * @param nextItem 下一个元素（可选）
 * @param maxHeight 最大高度限制
 * @returns 是否需要换列
 */
export function shouldBreakColumn(
  currentTotalHeight: number,
  currentHeight: number,
  nextItem: LayoutItem | undefined,
  maxHeight: number
): boolean {
  if (!nextItem) return false;
  return currentTotalHeight + nextItem.h > maxHeight;
}

