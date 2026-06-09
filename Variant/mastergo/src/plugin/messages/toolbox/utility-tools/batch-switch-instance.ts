import { MessageType, sendMsgToUI } from '../../../../../../src/messages';

interface SwitchPair {
  instanceName: string;
  componentId: string;
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

function replaceInstance(node: any, component: any) {
  const oldName = node.name;
  try {
    if (typeof node.swapComponent === 'function') {
      node.swapComponent(component);
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
  const rule = new Map(pairs.map((p) => [p.instanceName, compMap.get(p.componentId)]));
  let changed = 0;
  forEachTargetInstance(getScanTargets(selection), new Set(), (child) => {
    const target = rule.get(child.name);
    if (target && replaceInstance(child, target)) changed++;
  });

  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed });
  mg.notify(changed > 0 ? `已切换 ${changed} 个实例` : '没有实例被切换', { timeout: 2000 });
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

  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed: deleted });
  mg.notify(deleted > 0 ? `已删除 ${deleted} 个实例` : '没有实例被删除', { timeout: 2000 });
}

export default [
  { type: MessageType.BATCH_SWITCH_INSTANCES_GET, handler: handleGetData },
  { type: MessageType.BATCH_SWITCH_INSTANCES_APPLY, handler: handleApply },
  { type: MessageType.BATCH_SWITCH_INSTANCES_DELETE, handler: handleDelete }
];
