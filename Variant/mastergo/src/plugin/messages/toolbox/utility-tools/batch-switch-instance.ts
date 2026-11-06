import { MessageType, sendMsgToUI } from '../../../../../../src/messages';
import { hasAutoLayout } from '../../component-library/component-utils';
import { trySet } from '../../../utils/node-utils';

interface SwitchPair {
  instanceName: string;
  componentId: string;
  /** 是否为「背景」替换：由 UI 按实例名判定（背景/0-背景 等），新逻辑下按画板 cover 铺满 */
  backgroundFill?: boolean;
  /** true=旧版逻辑（优先直接换引用、保留旧图层名）；缺省/false=新版逻辑（新建实例等比适配） */
  legacy?: boolean;
}

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE']);
/** 选中容器下可再探查一层的组/容器类型（不进入实例内部） */
const WRAPPER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET']);

function hasChildren(node: any) {
  return node && CONTAINER_TYPES.has(node.type) && Array.isArray(node.children);
}

function isWrapperNode(node: any) {
  return !!node && WRAPPER_TYPES.has(node.type) && Array.isArray(node.children);
}

function currentPage() {
  return (mg as any).document?.currentPage;
}

function walk(node: any, visit: (node: any) => void) {
  if (!node) return;
  visit(node);
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child: any) => walk(child, visit));
}

/** 查找实例所在画板：取最外层 FRAME 祖先（即页面上的顶层画板）；无则回退直接父级 */
function findArtboard(node: any) {
  let cur = node?.parent;
  let frame: any = null;
  while (cur) {
    if (cur.type === 'FRAME') frame = cur;
    cur = cur.parent;
  }
  return frame || node?.parent || null;
}

/** 跳过实例节点，避免遍历实例内部结构 */
function getScanTargets(selection: any[]) {
  return selection.filter((node) => hasChildren(node) && node.type !== 'INSTANCE');
}

/**
 * 遍历选中容器下：直接子实例 + 直接子组/容器内的一层实例。
 */
function forEachTargetInstance(
  targets: any[],
  selectedNames: Set<string>,
  visit: (instance: any) => void
) {
  targets.forEach((target) => {
    if (!hasChildren(target)) return;
    target.children.forEach((child: any) => {
      if (child?.type === 'INSTANCE') {
        const name = String(child?.name || '').trim();
        if (name && !selectedNames.has(name)) visit(child);
        return;
      }
      if (!isWrapperNode(child)) return;
      child.children.forEach((nested: any) => {
        if (nested?.type !== 'INSTANCE') return;
        const name = String(nested?.name || '').trim();
        if (name && !selectedNames.has(name)) visit(nested);
      });
    });
  });
}

function collectPageComponents(page: any, selectedIds: Set<string>) {
  const map = new Map<string, { id: string; name: string }>();
  walk(page, (node) => {
    if (node?.type !== 'COMPONENT' || selectedIds.has(String(node.id))) return;
    if (typeof node.createInstance !== 'function') return;
    map.set(String(node.id), { id: String(node.id), name: node.name || '未命名组件' });
  });
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' })
  );
}

function collectDirectInstanceNames(selection: any[]) {
  const selectedNames = new Set(selection.map((n) => String(n?.name || '')));
  const names = new Set<string>();
  forEachTargetInstance(getScanTargets(selection), selectedNames, (inst) => {
    names.add(String(inst.name).trim());
  });
  return [...names].sort((a, b) =>
    a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' })
  );
}

function handleGetData() {
  const page = currentPage();
  const selection = page?.selection || [];
  if (!page || selection.length === 0) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
      instances: [],
      components: [],
      message: '请先选择组件或容器'
    });
    return;
  }

  const targets = getScanTargets(selection);
  if (targets.length === 0) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
      instances: [],
      components: [],
      message: '所选对象没有可读取的实例'
    });
    return;
  }

  const instances = collectDirectInstanceNames(selection).map((name) => ({ name }));
  if (instances.length === 0) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
      instances: [],
      components: [],
      message: '所选容器下没有可切换的实例'
    });
    return;
  }

  const selectedIds = new Set(selection.map((n: any) => String(n?.id || '')));
  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
    instances,
    components: collectPageComponents(page, selectedIds),
    message: ''
  });
}

type SwitchResult = { ok: true } | { ok: false; reason: string };

/** 宽高比相对容差 */
const RATIO_TOLERANCE = 0.01;

/** 尺寸上限校验容差（px） */
const FIT_TOLERANCE = 0.5;
/** 中心点校验容差（px） */
const CENTER_TOLERANCE = 0.5;

function absCenter(node: any): { cx: number; cy: number } | null {
  const b = node?.absoluteBoundingBox;
  if (!b) return null;
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

/**
 * 统一替换逻辑（不区分实例类型，背景除外）：新建目标实例 → 等比适配旧外框 → 居中 → 目标组件命名 → 校验通过后删除旧实例。
 * 1) 每次都由目标组件新建实例，插入旧实例所在父级与图层序号，不使用 swapComponent；
 * 2) 以旧实例宽、高为尺寸上限，新实例保持自身原始比例，缩放比 = min(旧宽/新原始宽, 旧高/新原始高)，可放大也可缩小；
 * 3) 在旧实例外框内水平、垂直居中：新 X = 旧 X + (旧宽 − 新宽) / 2，新 Y = 旧 Y + (旧高 − 新高) / 2；
 *    再按绝对中心点差值校正，抵消分组等嵌套父级的坐标换算偏差；自动布局流内子项位置由布局决定，不写 X/Y；
 * 4) 图层名称统一为目标组件名称；保留父级、图层顺序、约束及自动布局定位方式；
 * 5) 校验新宽 ≤ 旧宽、新高 ≤ 旧高、比例未变形、名称正确；非自动布局时另校验中心点一致；自动布局流内只校验宽高，位置按布局决定；失败则删除新实例、保留旧实例。
 * 原子性：先插入新实例（旧实例暂留），校验通过才删除旧实例。
 */
function replaceInstance(node: any, component: any): SwitchResult {
  const oldName = node.name;
  let next: any = null;
  const fail = (reason: string): SwitchResult => {
    if (next) {
      try {
        next.remove();
      } catch (e) {
        // ignore
      }
    }
    return { ok: false, reason };
  };
  try {
    const parent = node.parent;
    const idx = parent?.children?.indexOf(node);
    if (!parent || idx == null || idx < 0) return fail('无法定位旧实例所在父级');

    const maxW = node.width;
    const maxH = node.height;
    if (!(maxW > 0) || !(maxH > 0)) return fail('无法读取旧实例宽高');
    const oldX = node.x;
    const oldY = node.y;
    const oldCenter = absCenter(node);
    const parentAuto = hasAutoLayout(parent);
    const isAbsolute = parentAuto && node.layoutPositioning === 'ABSOLUTE';
    const writePosition = !parentAuto || isAbsolute;
    const oldConstraints = writePosition ? node.constraints : undefined;
    const oldFlexGrow = parentAuto ? node.flexGrow : undefined;
    const oldAlignSelf = parentAuto ? node.alignSelf : undefined;

    if (typeof component?.createInstance !== 'function') return fail('目标组件无法创建实例');
    // 新实例插入旧实例所在图层序号，旧实例移除后即占据原图层顺序
    next = component.createInstance();
    parent.insertChild(idx, next);
    if (next.parent !== parent) return fail('新实例未能保持在旧实例父级');

    // 缩放阶段先脱离自动布局流，避免被拉伸
    if (parentAuto) trySet(next, 'layoutPositioning', 'ABSOLUTE');

    const origW = next.width;
    const origH = next.height;
    if (!(origW > 0) || !(origH > 0)) return fail('无法读取新实例原始尺寸');
    const origRatio = origW / origH;

    const scale = Math.min(maxW / origW, maxH / origH);
    if (typeof next.rescale === 'function') {
      if (Math.abs(scale - 1) > 1e-6) next.rescale(scale, { scaleCenter: 'TOPLEFT' });
    } else if (typeof next.resize === 'function') {
      next.resize(origW * scale, origH * scale);
    } else {
      return fail('新实例不支持缩放');
    }

    // 先在脱离自动布局的状态下读取真实尺寸并校验，
    // 避免恢复 AUTO 后布局重排导致尺寸被改写、进而误判失败
    const newW = next.width;
    const newH = next.height;
    if (!(newW > 0) || !(newH > 0)) return fail('新实例尺寸无效');
    if (newW > maxW + FIT_TOLERANCE) return fail(`宽度超出旧实例 ${(newW - maxW).toFixed(1)}px`);
    if (newH > maxH + FIT_TOLERANCE) return fail(`高度超出旧实例 ${(newH - maxH).toFixed(1)}px`);
    if (Math.abs(newW / newH - origRatio) > origRatio * RATIO_TOLERANCE) {
      return fail('新实例比例发生变形');
    }

    // 恢复布局定位方式与约束（恢复后尺寸由布局决定，非自动布局不受影响）
    if (parentAuto) {
      trySet(next, 'layoutPositioning', isAbsolute ? 'ABSOLUTE' : 'AUTO');
      trySet(next, 'flexGrow', oldFlexGrow);
      trySet(next, 'alignSelf', oldAlignSelf);
      const afterW = next.width;
      const afterH = next.height;
      if (Math.abs(afterW - newW) > FIT_TOLERANCE || Math.abs(afterH - newH) > FIT_TOLERANCE) {
        console.warn('[批量切换实例] 自动布局恢复后尺寸变化：', oldName, `${newW}x${newH} -> ${afterW}x${afterH}`);
      }
    }
    trySet(next, 'constraints', oldConstraints);

    // 非自动布局：在旧实例外框内居中，保持旧实例中心点；自动布局流内的位置由布局决定，不写 X/Y、不校验位置
    if (writePosition) {
      if (typeof next.x !== 'number' || typeof next.y !== 'number') return fail('新实例不支持定位');
      next.x = oldX + (maxW - newW) / 2;
      next.y = oldY + (maxH - newH) / 2;
      const cur = absCenter(next);
      if (oldCenter && cur) {
        const dx = oldCenter.cx - cur.cx;
        const dy = oldCenter.cy - cur.cy;
        if (Math.abs(dx) > CENTER_TOLERANCE || Math.abs(dy) > CENTER_TOLERANCE) {
          next.x = next.x + dx;
          next.y = next.y + dy;
        }
      }
      const newCenter = absCenter(next);
      if (oldCenter && newCenter) {
        const dx = newCenter.cx - oldCenter.cx;
        const dy = newCenter.cy - oldCenter.cy;
        if (Math.abs(dx) > CENTER_TOLERANCE || Math.abs(dy) > CENTER_TOLERANCE) {
          return fail(`中心点偏移 ${dx.toFixed(1)}, ${dy.toFixed(1)}px`);
        }
      }
    }

    next.name = component.name;
    if (next.name !== component.name) return fail('新实例名称未能正确设置');

    node.remove();
    return { ok: true };
  } catch (error) {
    console.warn(`切换实例失败: ${oldName}`, error);
    return fail('替换过程异常');
  }
}

/** 背景覆盖校验容差（px） */
const COVER_TOLERANCE = 0.5;

/**
 * 背景铺满替换：由 UI「背景」替换栏触发，不依赖实例图层名称。
 * 1) 读取实例所在画板宽高为覆盖目标；
 * 2) 新背景保持自身原始比例，等比缩放后宽、高均不小于画板（cover：取较大缩放比）；
 * 3) 在画板内水平、垂直居中：x=(画板宽-背景宽)/2，y=(画板高-背景高)/2；
 * 4) 保留原画板、原图层顺序；自动布局画板中先设为绝对定位再居中；
 * 5) 校验背景是否完整覆盖画板；未覆盖则删除新实例、保留旧实例并返回失败。
 * 原子性：先插入新实例（旧实例暂留），校验通过才删除旧实例；失败则删除新实例。
 */
function replaceBackgroundInstance(node: any, component: any): SwitchResult {
  const oldName = node.name;
  let next: any = null;
  const fail = (reason: string): SwitchResult => {
    if (next) {
      try {
        next.remove();
      } catch (e) {
        // ignore
      }
      next = null;
    }
    return { ok: false, reason };
  };
  try {
    const parent = node.parent;
    const idx = parent?.children?.indexOf(node);
    if (!parent || idx == null || idx < 0) return fail('无法定位旧实例所在父级');

    const artboard = findArtboard(node);
    if (!artboard) return fail('未找到实例所在画板');
    const targetW = artboard.width;
    const targetH = artboard.height;
    if (!(targetW > 0) || !(targetH > 0)) return fail('无法读取画板尺寸');

    const parentAuto = hasAutoLayout(parent);
    const oldConstraints = node.constraints;

    if (typeof component?.createInstance !== 'function') return fail('目标组件无法创建实例');
    // 先插入新实例于旧实例原位置（旧实例暂留，保证可回滚）
    next = component.createInstance();
    parent.insertChild(idx, next);
    if (next.parent !== parent) return fail('新实例未能保持在旧实例父级');

    // 自动布局：先转绝对定位，避免入流影响画板尺寸
    if (parentAuto) trySet(next, 'layoutPositioning', 'ABSOLUTE');

    if (typeof next.resetOverrides === 'function') {
      try {
        next.resetOverrides();
      } catch (e) {
        // 忽略：后续按原始比例缩放兜底
      }
    }
    if (parentAuto) trySet(next, 'layoutPositioning', 'ABSOLUTE');

    const origW = next.width;
    const origH = next.height;
    if (!(origW > 0) || !(origH > 0)) return fail('无法读取新实例原始尺寸');

    // 等比 cover 缩放：宽、高均不小于画板
    const scale = Math.max(targetW / origW, targetH / origH);
    if (typeof next.rescale === 'function') {
      if (Math.abs(scale - 1) > 1e-6) next.rescale(scale, { scaleCenter: 'TOPLEFT' });
    } else if (typeof next.resize === 'function') {
      next.resize(origW * scale, origH * scale);
    } else {
      return fail('新实例不支持缩放');
    }

    const newW = next.width;
    const newH = next.height;
    trySet(next, 'constraints', oldConstraints);

    // 画板内居中（转换为父级局部坐标）
    const artAbs = artboard.absoluteBoundingBox;
    const parentAbs = parent.absoluteBoundingBox;
    if (artAbs && parentAbs) {
      const absX = artAbs.x + (targetW - newW) / 2;
      const absY = artAbs.y + (targetH - newH) / 2;
      if (typeof next.x === 'number') next.x = absX - parentAbs.x;
      if (typeof next.y === 'number') next.y = absY - parentAbs.y;
    } else {
      if (typeof next.x === 'number') next.x = (targetW - newW) / 2;
      if (typeof next.y === 'number') next.y = (targetH - newH) / 2;
    }

    // 校验背景是否完整覆盖画板
    const nb = next.absoluteBoundingBox;
    const ab = artboard.absoluteBoundingBox;
    let covered: boolean;
    if (nb && ab) {
      covered =
        nb.x <= ab.x + COVER_TOLERANCE &&
        nb.y <= ab.y + COVER_TOLERANCE &&
        nb.x + nb.width >= ab.x + ab.width - COVER_TOLERANCE &&
        nb.y + nb.height >= ab.y + ab.height - COVER_TOLERANCE;
    } else {
      covered = newW >= targetW - COVER_TOLERANCE && newH >= targetH - COVER_TOLERANCE;
    }
    if (!covered) return fail('背景未完整覆盖画板');

    next.name = component.name;
    if (next.name !== component.name) return fail('新实例名称未能正确设置');

    // 校验通过：删除旧实例
    node.remove();
    return { ok: true };
  } catch (error) {
    console.warn(`背景切换失败: ${oldName}`, error);
    return fail('背景替换过程异常');
  }
}

function replaceLegacyInstance(node: any, component: any): boolean {
  const oldName = node.name;
  try {
    if (typeof node.swapComponent === 'function') {
      node.swapComponent(component);
      // 旧版模式：保留旧图层名
      node.name = oldName;
      return true;
    }
    const parent = node.parent;
    const idx = parent?.children?.indexOf(node);
    if (!parent || idx < 0 || typeof component.createInstance !== 'function') return false;
    const next = component.createInstance();
    next.name = oldName;
    next.x = node.x;
    next.y = node.y;
    if (typeof next.resizeWithoutConstraints === 'function') {
      next.resizeWithoutConstraints(node.width, node.height);
    } else if (typeof next.resize === 'function') {
      next.resize(node.width, node.height);
    }
    parent.insertChild(idx, next);
    node.remove();
    return true;
  } catch (error) {
    console.warn(`切换实例失败: ${oldName}`, error);
    return false;
  }
}

function handleApply(data: { pairs?: SwitchPair[] }) {
  const page = currentPage();
  const selection = page?.selection || [];
  const pairs = (data?.pairs || []).filter((p) => p.instanceName && p.componentId);
  if (!page || selection.length === 0 || pairs.length === 0) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed: 0 });
    mg.notify('没有可切换的实例', { timeout: 2000 });
    return;
  }

  const compMap = new Map<string, any>();
  collectPageComponents(page, new Set()).forEach((c) => compMap.set(c.id, null));
  walk(page, (node) => {
    const id = String(node?.id || '');
    if (compMap.has(id) && node?.type === 'COMPONENT') compMap.set(id, node);
  });
  const rule = new Map(
    pairs.map((p) => [
      p.instanceName,
      {
        component: compMap.get(p.componentId),
        backgroundFill: !!p.backgroundFill,
        legacy: p.legacy === true,
      },
    ])
  );

  // 先收集再替换，避免遍历中插入/删除子节点导致重复或遗漏
  const jobs: Array<{ node: any; target: any; backgroundFill: boolean; legacy: boolean }> = [];
  const failures: Array<{ name: string; reason: string }> = [];
  forEachTargetInstance(getScanTargets(selection), new Set(), (child) => {
    const name = String(child.name || '').trim();
    const r = rule.get(child.name);
    if (!r) return;
    if (!r.component) {
      failures.push({ name, reason: '未找到目标组件' });
      return;
    }
    jobs.push({ node: child, target: r.component, backgroundFill: r.backgroundFill, legacy: r.legacy });
  });

  let changed = 0;
  jobs.forEach(({ node, target, backgroundFill, legacy }) => {
    const name = String(node.name || '').trim();
    // 勾选「旧版模式」：原地换引用并保留旧图层名；默认走新版逻辑（新建实例、等比适配、居中）
    if (legacy) {
      if (replaceLegacyInstance(node, target)) changed++;
      else failures.push({ name, reason: '旧版模式切换失败' });
      return;
    }
    const result = backgroundFill
      ? replaceBackgroundInstance(node, target)
      : replaceInstance(node, target);
    if (result.ok) changed++;
    else failures.push({ name, reason: result.reason });
  });

  if (changed > 0) {
    try {
      (mg as any).commitUndo && (mg as any).commitUndo();
    } catch (e) {
      // 撤销记录失败不影响结果
    }
  }

  if (failures.length) {
    console.warn('[批量切换实例] 以下项切换失败（已保留旧实例）：', failures);
  }
  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed, failures });

  let msg = changed > 0 ? `已切换 ${changed} 个实例` : '没有实例被切换';
  if (failures.length) {
    const shown = failures
      .slice(0, 3)
      .map((f) => `${f.name}：${f.reason}`)
      .join('；');
    const more = failures.length > 3 ? ` 等 ${failures.length} 项` : '';
    msg += `，${failures.length} 项失败已保留原实例（${shown}${more}）`;
  }
  mg.notify(msg, { timeout: failures.length ? 6000 : 2000 });
}

function handleDelete(data: { instanceName?: string }) {
  const page = currentPage();
  const selection = page?.selection || [];
  const instanceName = String(data?.instanceName || '').trim();
  if (!page || selection.length === 0 || !instanceName) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed: 0 });
    mg.notify('没有可删除的实例', { timeout: 2000 });
    return;
  }

  let deleted = 0;
  forEachTargetInstance(getScanTargets(selection), new Set(), (child) => {
    if (child.name !== instanceName) return;
    try {
      child.remove();
      deleted++;
    } catch (error) {
      console.warn(`删除实例失败: ${instanceName}`, error);
    }
  });

  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed: deleted, deleted, instanceName });
  mg.notify(deleted > 0 ? `已删除 ${deleted} 个实例` : '没有实例被删除', { timeout: 2000 });
}

export default [
  { type: MessageType.BATCH_SWITCH_INSTANCES_GET, handler: handleGetData },
  { type: MessageType.BATCH_SWITCH_INSTANCES_APPLY, handler: handleApply },
  { type: MessageType.BATCH_SWITCH_INSTANCES_DELETE, handler: handleDelete }
];
