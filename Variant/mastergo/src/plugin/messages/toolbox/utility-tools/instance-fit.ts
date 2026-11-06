/**
 * 实例适配
 * 1) 按名称递归查找并选中所有同名实例（仅 INSTANCE）；
 * 2) 「适配」逐个处理当前选中的实例：宽高直接设为根容器宽高（非等比），
 *    约束设为水平、垂直跟随缩放，并贴齐根容器左上角。
 * 3) 每个实例独立校验，失败只恢复该实例并计入跳过，不影响其他实例。
 * 「选中」按名称在选中范围或当前页面查找；「适配」只处理当前直接选中的实例，不按名称过滤。
 */
import { MessageType } from '../../../../../../src/messages';
import { hasAutoLayout } from '../../component-library/component-utils';
import { trySet } from '../../../utils/node-utils';

/** 根容器查找的边界：到达这些类型即停止向上 */
const BOUNDARY_TYPES = new Set(['PAGE', 'SECTION', 'DOCUMENT']);
/** 可作为根容器的类型（最外层画板 / 组件容器） */
const ROOT_TYPES = new Set(['FRAME', 'COMPONENT']);

type Matcher = (node: any) => boolean;

function getChildren(node: any): any[] {
  try {
    return Array.isArray(node?.children) ? node.children : [];
  } catch (e) {
    return [];
  }
}

/**
 * 按作用范围收集匹配的实例（按 id 去重）。
 * scoped=true 表示存在选中对象，结果仅限选中范围内。
 */
function collectInstances(page: any, match: Matcher): { instances: any[]; scoped: boolean } {
  const selection: any[] = (page.selection || []).filter(Boolean);
  const seen = new Set<string>();
  const instances: any[] = [];
  const add = (node: any) => {
    const id = String(node.id);
    if (seen.has(id)) return;
    seen.add(id);
    instances.push(node);
  };
  const walk = (node: any) => {
    getChildren(node).forEach((child) => {
      if (child.type === 'INSTANCE' && match(child)) add(child);
      walk(child);
    });
  };

  if (selection.length === 0) {
    walk(page);
    return { instances, scoped: false };
  }
  selection.forEach((node) => {
    if (node.type === 'INSTANCE') {
      if (match(node)) add(node);
      return;
    }
    walk(node);
  });
  return { instances, scoped: true };
}

function handleSelect(data: { name?: string }) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }
  const name = String(data?.name || '').trim();
  if (!name) {
    mg.notify('请输入实例名称', { timeout: 2000 });
    return;
  }

  const { instances, scoped } = collectInstances(currentPage, (n) => n.name === name);
  if (instances.length === 0) {
    mg.notify(scoped ? '选中范围内无匹配实例' : '未找到同名实例', { timeout: 2000 });
    return;
  }
  currentPage.selection = instances;
  mg.notify(`已选中 ${instances.length} 个实例`, { timeout: 2000 });
}

/** 取实例所在页面 / 分区下的最外层画板或组件容器 */
function findRootContainer(node: any): any {
  let root: any = null;
  let cur = node.parent;
  while (cur && !BOUNDARY_TYPES.has(cur.type)) {
    if (ROOT_TYPES.has(cur.type)) root = cur;
    cur = cur.parent;
  }
  return root;
}

/** 实例自身或其到根容器之间的任一祖先被锁定 */
function isLockedInChain(node: any, root: any): boolean {
  let cur = node;
  while (cur) {
    if (cur.isLocked) return true;
    if (cur === root) break;
    cur = cur.parent;
  }
  return false;
}

const TOLERANCE = 0.5;

function sizeOk(node: any, w: number, h: number): boolean {
  return Math.abs(node.width - w) <= TOLERANCE && Math.abs(node.height - h) <= TOLERANCE;
}

/** 依次尝试多种尺寸写入方式，直到宽高与目标一致 */
function applySize(node: any, w: number, h: number): string[] {
  const tried: string[] = [];
  const attempt = (label: string, fn: () => void) => {
    if (sizeOk(node, w, h)) return;
    tried.push(label);
    try {
      fn();
    } catch (e) {
      // 交由尺寸校验判定
    }
  };
  if (typeof node.resize === 'function') attempt('resize', () => node.resize(w, h));
  attempt('width/height', () => {
    node.width = w;
    node.height = h;
  });
  if (typeof node.resize === 'function') {
    // 部分环境先改一边会被等比联动，分两步再写一次
    attempt('resize×2', () => {
      node.resize(w, node.height);
      node.resize(w, h);
    });
  }
  return tried;
}

/** 将实例左上角对齐根容器左上角（按绝对坐标差修正，抵消中间父级偏移） */
function alignTopLeft(node: any, root: any): boolean {
  if (node.parent === root) {
    node.x = 0;
    node.y = 0;
  }
  for (let i = 0; i < 3; i++) {
    const nb = node.absoluteBoundingBox;
    const rb = root.absoluteBoundingBox;
    if (!nb || !rb) return node.parent === root;
    const dx = nb.x - rb.x;
    const dy = nb.y - rb.y;
    if (Math.abs(dx) <= TOLERANCE && Math.abs(dy) <= TOLERANCE) return true;
    node.x = node.x - dx;
    node.y = node.y - dy;
  }
  const nb = node.absoluteBoundingBox;
  const rb = root.absoluteBoundingBox;
  return !!nb && !!rb && Math.abs(nb.x - rb.x) <= TOLERANCE && Math.abs(nb.y - rb.y) <= TOLERANCE;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(n);
}

/**
 * 适配单个实例；失败时恢复该实例原状并返回原因。
 */
function fitOne(node: any, root: any): string | null {
  const targetW = root.width;
  const targetH = root.height;
  const parentAuto = hasAutoLayout(node.parent);
  const selfAuto = hasAutoLayout(node);
  const saved = {
    width: node.width,
    height: node.height,
    relativeTransform: node.relativeTransform,
    constraints: node.constraints ? { ...node.constraints } : undefined,
    constrainProportions: node.constrainProportions,
    mainAxisSizingMode: selfAuto ? node.mainAxisSizingMode : undefined,
    crossAxisSizingMode: selfAuto ? node.crossAxisSizingMode : undefined,
    layoutPositioning: parentAuto ? node.layoutPositioning : undefined,
    minWidth: node.minWidth,
    maxWidth: node.maxWidth,
    minHeight: node.minHeight,
    maxHeight: node.maxHeight,
  };
  const restore = () => {
    trySet(node, 'layoutPositioning', saved.layoutPositioning);
    trySet(node, 'mainAxisSizingMode', saved.mainAxisSizingMode);
    trySet(node, 'crossAxisSizingMode', saved.crossAxisSizingMode);
    trySet(node, 'constrainProportions', false);
    try {
      if (typeof node.resize === 'function') node.resize(saved.width, saved.height);
    } catch (e) {
      // ignore
    }
    trySet(node, 'relativeTransform', saved.relativeTransform);
    trySet(node, 'constraints', saved.constraints);
    ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach((k) => trySet(node, k, (saved as any)[k]));
    trySet(node, 'constrainProportions', saved.constrainProportions);
  };

  try {
    // 1) 解除会阻止自由改尺寸的设置：等比锁定、自身自动布局「自适应」、最小/最大宽高、父级自动布局流
    trySet(node, 'constrainProportions', false);
    if (selfAuto) {
      trySet(node, 'mainAxisSizingMode', 'FIXED');
      trySet(node, 'crossAxisSizingMode', 'FIXED');
    }
    ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach((k) => {
      if (node[k] != null) trySet(node, k, null);
    });
    if (parentAuto && node.layoutPositioning !== 'ABSOLUTE') trySet(node, 'layoutPositioning', 'ABSOLUTE');

    // 2) 尺寸：直接设为根容器宽高（非等比）
    const tried = applySize(node, targetW, targetH);
    if (!sizeOk(node, targetW, targetH)) {
      const diag = [
        `等比锁定=${String(node.constrainProportions)}`,
        selfAuto ? `自身自动布局=${node.mainAxisSizingMode}/${node.crossAxisSizingMode}` : '',
        parentAuto ? `父级自动布局定位=${node.layoutPositioning}` : '',
        `已尝试 ${tried.join('、') || '无'}`,
      ].filter(Boolean).join('，');
      const reason = `尺寸未能设为 ${fmt(targetW)}×${fmt(targetH)}，实际 ${fmt(node.width)}×${fmt(node.height)}（${diag}）`;
      restore();
      return reason;
    }

    // 3) 约束：水平、垂直跟随缩放
    trySet(node, 'constraints', { horizontal: 'SCALE', vertical: 'SCALE' });
    if (node.constraints?.horizontal !== 'SCALE' || node.constraints?.vertical !== 'SCALE') {
      restore();
      return '无法设置跟随缩放约束';
    }

    // 4) 位置：贴齐根容器左上角
    if (!alignTopLeft(node, root)) {
      restore();
      return '无法贴齐画板左上角';
    }
    if (!sizeOk(node, targetW, targetH)) {
      restore();
      return '定位后尺寸被改变';
    }
    return null;
  } catch (error: any) {
    restore();
    return String(error?.message || '适配过程异常');
  }
}

function handleApply() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }
  const seen = new Set<string>();
  const instances = (currentPage.selection || []).filter((node: any) => {
    if (node?.type !== 'INSTANCE' || node.removed) return false;
    const id = String(node.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (instances.length === 0) {
    mg.notify('请先选中一个或多个实例，再点击适配', { timeout: 2000 });
    return;
  }

  let skipLocked = 0;
  let skipNoRoot = 0;
  const jobs: Array<{ node: any; root: any }> = [];
  instances.forEach((node: any) => {
    const root = findRootContainer(node);
    if (!root || !(root.width > 0) || !(root.height > 0)) {
      skipNoRoot++;
      return;
    }
    if (isLockedInChain(node, root)) {
      skipLocked++;
      return;
    }
    jobs.push({ node, root });
  });

  const details: string[] = [];
  if (skipLocked) details.push(`锁定 ${skipLocked}`);
  if (skipNoRoot) details.push(`无画板 ${skipNoRoot}`);
  if (jobs.length === 0) {
    mg.notify(`没有可适配的实例，跳过 ${skipLocked + skipNoRoot} 个（${details.join('，')}）`, { timeout: 3000 });
    return;
  }

  let success = 0;
  const failures: string[] = [];
  jobs.forEach(({ node, root }) => {
    const reason = fitOne(node, root);
    if (reason) {
      failures.push(`${node.name}：${reason}`);
      console.warn('[实例适配] 跳过', node.name, reason);
    } else {
      success++;
    }
  });
  if (success > 0) mg.commitUndo();

  if (failures.length) details.push(`无法修改 ${failures.length}`);
  const skipped = skipLocked + skipNoRoot + failures.length;
  const suffix = skipped > 0 ? `，跳过 ${skipped} 个（${details.join('，')}）` : '';
  const firstReason = failures.length ? `\n${failures[0]}` : '';
  mg.notify(`已适配 ${success} 个实例${suffix}${firstReason}`, { timeout: failures.length ? 6000 : 3000 });
}

export default [
  { type: MessageType.INSTANCE_FIT_SELECT, handler: handleSelect },
  { type: MessageType.INSTANCE_FIT_APPLY, handler: handleApply },
];
