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

/**
 * 统一的布局配置
 */
export interface LayoutConfig {
  x: number;
  y: number;
  gap: number;
}

/**
 * 统一的布局回调接口
 * @param item 当前处理的元素
 * @param x 元素的 x 坐标
 * @param y 元素的 y 坐标
 */
export type LayoutCallback<T extends LayoutItem> = (item: T, x: number, y: number) => void;

/**
 * 统一的布局算法
 * 根据元素分类（横版、竖版、方形）自动排列
 */
export function applyLayout<T extends LayoutItem>(
  landscape: T[],
  portrait: T[],
  square: T[],
  config: LayoutConfig,
  callback: LayoutCallback<T>
): void {
  const { x: startX, y: startY, gap } = config;
  
  // 记录横版实际占用的最大宽度（用于计算竖版起始位置）
  let actualLandscapeWidth = 0;
  let currentY = startY;

  // 1. 排列横版元素：按宽度从大到小排序，从上到下排列
  const sortedLandscape = [...landscape].sort((a, b) => b.w - a.w);
  
  sortedLandscape.forEach((item, i) => {
    callback(item, startX, currentY);
    
    // 更新横版实际占用的最大宽度
    actualLandscapeWidth = Math.max(actualLandscapeWidth, item.w);
    
    // 下一个横版的Y位置 = 当前Y + 当前横版高度 + 间距
    if (i < sortedLandscape.length - 1) {
      currentY += item.h + gap;
    }
  });

  // 2. 排列竖版元素：按高度从大到小排序，从左到右排列
  // 如果有横版，竖版从横版右侧开始；如果没有横版，竖版直接从起始位置开始
  const portraitStartX = landscape.length > 0 
    ? startX + actualLandscapeWidth + gap 
    : startX;
  
  const sortedPortrait = [...portrait].sort((a, b) => b.h - a.h);
  let currentX = portraitStartX;
  
  sortedPortrait.forEach((item, i) => {
    callback(item, currentX, startY);
    
    // 下一个竖版的X位置 = 当前X + 当前竖版宽度 + 间距
    if (i < sortedPortrait.length - 1) {
      currentX += item.w + gap;
    }
  });

  // 3. 排列方形元素：按宽度从大到小排序，从左到右排列
  // 方形位于竖版下方，起始位置为竖版的右侧
  const squareStartX = portrait.length > 0
    ? currentX + gap  // 如果有竖版，从最后一个竖版右侧开始
    : portraitStartX;  // 如果没有竖版，从竖版起始位置开始
  const squareStartY = landscape.length > 0
    ? currentY + gap  // 如果有横版，从最后一个横版下方开始
    : startY;          // 如果没有横版，从起始位置开始
  
  const sortedSquare = [...square].sort((a, b) => b.w - a.w);
  let squareX = squareStartX;
  
  sortedSquare.forEach((item, i) => {
    callback(item, squareX, squareStartY);
    
    // 下一个方形的X位置 = 当前X + 当前方形宽度 + 间距
    if (i < sortedSquare.length - 1) {
      squareX += item.w + gap;
    }
  });
}

