/**
 * 组件布局计算器 - 两级分组 + 套件配对排版
 */

/**
 * 描述组信息
 */
interface DescriptionGroup {
  description: string;
  instances: any[];
}

/**
 * 布局配置
 */
interface LayoutConfig {
  pairSpacing: number; // 同一套件内（正式图↔预览图）水平间距（较小）
  setGap: number; // 同一描述组内不同套件之间的间距
  groupGap: number; // 不同组件描述组之间的横向 / 纵向间距
  maxRowWidth: number; // 组件描述组整体排列的单行最大宽度
  maxSetRowWidth: number; // 同一组件描述组内，套件单行最大宽度（含素材宽度及间距），超出则套件整体换行
}

/**
 * 默认布局配置
 */
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  pairSpacing: 50,
  setGap: 300,
  groupGap: 300,
  maxRowWidth: 10000,
  maxSetRowWidth: 15000,
};

/**
 * 判断画板名称是否为“预览图”
 */
function isPreviewByName(name: any): boolean {
  return /预览/.test(String(name || ''));
}

/**
 * 归一化画板名称，用于正式图 / 预览图配对：
 * 忽略 _预览 / 预览、文件大小（如 500k / 1.2M）、尺寸（如 1080x594 / 1080*594）及分隔符。
 */
function normalizePairKey(name: any): string {
  let s = String(name || '');
  // 去除预览标记
  s = s.replace(/_?预览/g, '');
  // 去除文件大小：500k / 500kb / 1.2m / 1.2mb
  s = s.replace(/\d+(\.\d+)?\s*(kb|mb|k|m)\b/gi, ' ');
  // 去除尺寸：1080x594 / 1080X2400 / 1080*594 / 1080×594
  s = s.replace(/\d+\s*[x×*]\s*\d+/gi, ' ');
  // 归并分隔符与空白
  s = s.replace(/[\s_\-—–－]+/g, ' ').trim().toLowerCase();
  return s;
}

/** 两素材尺寸是否完全相同（四舍五入到整数像素） */
function sameSize(a: any, b: any): boolean {
  return (
    (Math.round(a.width) || 0) === (Math.round(b.width) || 0) &&
    (Math.round(a.height) || 0) === (Math.round(b.height) || 0)
  );
}

/** 两素材尺寸差异度（|Δw|+|Δh|），用于“尺寸最接近”匹配 */
function sizeDist(a: any, b: any): number {
  const dw = (Math.round(a.width) || 0) - (Math.round(b.width) || 0);
  const dh = (Math.round(a.height) || 0) - (Math.round(b.height) || 0);
  return Math.abs(dw) + Math.abs(dh);
}

/**
 * 将正式图与预览图按尺寸优先规则配对：
 * 第 1 轮：尺寸完全相同的优先配对；
 * 第 2 轮：剩余正式图选尺寸最接近的预览图配对；
 * 文件大小不同不影响配对。严格“正式图 ↔ 预览图”，不会把两张同类配成一套。
 * @returns 成套的 [正式图, 预览图] 列表，以及未配对的正式图 / 预览图
 */
function matchOfficialsToPreviews(
  officials: any[],
  previews: any[],
): { pairs: any[][]; unmatchedOfficials: any[]; unmatchedPreviews: any[] } {
  const pairs: any[][] = [];
  const usedO = new Set<any>();
  const usedP = new Set<any>();

  // 第 1 轮：尺寸完全相同优先
  officials.forEach((o) => {
    for (const p of previews) {
      if (usedP.has(p)) continue;
      if (sameSize(o, p)) {
        pairs.push([o, p]);
        usedO.add(o);
        usedP.add(p);
        break;
      }
    }
  });

  // 第 2 轮：剩余正式图选尺寸最接近的预览图
  officials.forEach((o) => {
    if (usedO.has(o)) return;
    let best: any = null;
    let bestDist = Infinity;
    previews.forEach((p) => {
      if (usedP.has(p)) return;
      const d = sizeDist(o, p);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });
    if (best) {
      pairs.push([o, best]);
      usedO.add(o);
      usedP.add(best);
    }
  });

  return {
    pairs,
    unmatchedOfficials: officials.filter((o) => !usedO.has(o)),
    unmatchedPreviews: previews.filter((p) => !usedP.has(p)),
  };
}

/**
 * 在单个组件描述组内，构建“套件”列表。每个套件是一组左右相邻的素材：
 * 正式图在前（左），预览图在后（右）。
 * 1) 按主体名称（normalizePairKey）分组，同主体内按“尺寸完全相同 → 尺寸最接近”配对；
 * 2) 主体名称无法匹配的素材，在整组内按“正式图 ↔ 预览图 尺寸相同 → 最接近”兜底配对；
 * 3) 仍无法匹配的素材单独成套，不影响其它已配对套件。
 * @returns 套件数组，套件为素材数组（通常 [正式图, 预览图]）
 */
function buildSetsWithinGroup(instances: any[]): any[][] {
  const valid = (instances || []).filter(Boolean);
  if (valid.length === 0) return [];
  if (valid.length === 1) return [[valid[0]]];

  // 按归一化主体分组，保持首次出现顺序
  const keyOrder: string[] = [];
  const keyMap = new Map<string, { officials: any[]; previews: any[] }>();
  valid.forEach((inst) => {
    const key = normalizePairKey(inst.name);
    let rec = keyMap.get(key);
    if (!rec) {
      rec = { officials: [], previews: [] };
      keyMap.set(key, rec);
      keyOrder.push(key);
    }
    if (isPreviewByName(inst.name)) rec.previews.push(inst);
    else rec.officials.push(inst);
  });

  const sets: any[][] = [];
  const leftoverOfficials: any[] = [];
  const leftoverPreviews: any[] = [];

  // 1) 同主体名称内：尺寸优先配对（完全相同 → 最接近）
  keyOrder.forEach((key) => {
    const rec = keyMap.get(key)!;
    const { pairs, unmatchedOfficials, unmatchedPreviews } = matchOfficialsToPreviews(
      rec.officials,
      rec.previews,
    );
    pairs.forEach((pair) => sets.push(pair));
    unmatchedOfficials.forEach((n) => leftoverOfficials.push(n));
    unmatchedPreviews.forEach((n) => leftoverPreviews.push(n));
  });

  // 2) 名称无法匹配的素材，在整组内按尺寸优先兜底配对（严格 正式 ↔ 预览）
  const {
    pairs: fbPairs,
    unmatchedOfficials: restOfficials,
    unmatchedPreviews: restPreviews,
  } = matchOfficialsToPreviews(leftoverOfficials, leftoverPreviews);
  fbPairs.forEach((pair) => sets.push(pair));

  // 3) 仍未配对的素材单独成套
  restOfficials.forEach((n) => sets.push([n]));
  restPreviews.forEach((n) => sets.push([n]));

  return sets;
}

/**
 * 两级分组 + 套件配对自动排版：
 * 第一层：按组件描述分组（descriptionGroups 已分好），组间横向/纵向间距 groupGap(300)，超过 maxRowWidth 换行；
 * 第二层（描述组内）：先把素材配成“套件”（正式图左 + 预览图右），套件之间间距 setGap(300)；
 *   放入下一套件后单行总宽度（含素材宽度及间距）超过 maxSetRowWidth(15000) 时，该套件整体换到下一行，
 *   行间距 setGap；套件不拆分、素材不缩放；
 * 第三层（套件内）：正式图与预览图左右相邻，间距 pairSpacing(50，较小)。
 * @param descriptionGroups 描述组列表
 * @param viewportCenter 视口中心坐标（作为排列起点参考）
 * @param config 布局配置
 */
export function arrangeComponentLayout(
  descriptionGroups: DescriptionGroup[],
  viewportCenter: { x: number; y: number },
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): void {
  const PAIR_SP = config.pairSpacing; // 套件内间距（小）
  const SET_GAP = config.setGap; // 套件之间间距
  const GROUP_GAP = config.groupGap; // 组间横向 / 纵向间距
  const MAX_W = config.maxRowWidth;
  const MAX_SET_ROW_W = config.maxSetRowWidth;

  // 为每个描述组构建套件，并按套件单行最大宽度将套件整体换行，计算整组尺寸
  const blocks = (descriptionGroups || [])
    .map((group) => {
      const sets = buildSetsWithinGroup(group ? group.instances : []);
      const setInfos = sets.map((setItems) => {
        let w = 0;
        let h = 0;
        setItems.forEach((inst, idx) => {
          w += Math.round(inst.width) || 0;
          if (idx < setItems.length - 1) w += PAIR_SP;
          h = Math.max(h, Math.round(inst.height) || 0);
        });
        return { items: setItems, width: w, height: h };
      });

      // 套件为最小换行单位：放入下一套件后单行总宽度超过 MAX_SET_ROW_W 时，该套件换到下一行
      const rows: { setInfos: typeof setInfos; width: number; height: number }[] = [];
      setInfos.forEach((s) => {
        const row = rows[rows.length - 1];
        if (row && row.width + SET_GAP + s.width <= MAX_SET_ROW_W) {
          row.width += SET_GAP + s.width;
          row.height = Math.max(row.height, s.height);
          row.setInfos.push(s);
        } else {
          rows.push({ setInfos: [s], width: s.width, height: s.height });
        }
      });

      let width = 0;
      let height = 0;
      rows.forEach((r, idx) => {
        width = Math.max(width, r.width);
        height += r.height;
        if (idx < rows.length - 1) height += SET_GAP;
      });
      return { rows, setInfos, width, height };
    })
    .filter((b) => b.setInfos.length > 0);

  if (blocks.length === 0) return;

  const startX = Math.round(viewportCenter.x);
  const startY = Math.round(viewportCenter.y);

  let curX = startX; // 当前组行内已排到的右边界
  let curY = startY; // 当前组行顶部 Y
  let rowHeight = 0; // 当前组行内最高的组高度
  let rowStarted = false;

  blocks.forEach((block) => {
    // 描述组作为整体判断是否需要换行
    if (rowStarted) {
      const used = curX - startX;
      if (used + GROUP_GAP + block.width > MAX_W) {
        curY += rowHeight + GROUP_GAP;
        curX = startX;
        rowHeight = 0;
        rowStarted = false;
      } else {
        curX += GROUP_GAP;
      }
    }

    // 组内按行排列，行内套件从左到右排列
    let sy = curY;
    block.rows.forEach((row) => {
      let sx = curX;
      row.setInfos.forEach((s) => {
        let ix = sx;
        s.items.forEach((inst) => {
          inst.x = Math.round(ix);
          inst.y = Math.round(sy);
          ix += (Math.round(inst.width) || 0) + PAIR_SP;
        });
        sx += s.width + SET_GAP;
      });
      sy += row.height + SET_GAP;
    });

    curX += block.width;
    rowHeight = Math.max(rowHeight, block.height);
    rowStarted = true;
  });
}
