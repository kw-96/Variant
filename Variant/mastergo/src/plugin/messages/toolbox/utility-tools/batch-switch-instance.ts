import { MessageType, sendMsgToUI } from '../../../../../../src/messages';

interface SwitchPair {
  instanceName: string;
  componentId: string;
}

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE']);

function hasChildren(node: any) {
  return node && CONTAINER_TYPES.has(node.type) && Array.isArray(node.children);
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
  selection.filter(hasChildren).forEach((node) => {
    node.children.forEach((child: any) => {
      const name = String(child?.name || '').trim();
      if (child?.type === 'INSTANCE' && name && !selectedNames.has(name)) {
        names.add(name);
      }
    });
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

  const targets = selection.filter(hasChildren);
  if (targets.length === 0) {
    sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
      instances: [],
      components: [],
      message: '所选对象没有可读取的直接子实例'
    });
    return;
  }

  const selectedIds = new Set(selection.map((n: any) => String(n?.id || '')));
  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_DATA, {
    instances: collectDirectInstanceNames(targets).map((name) => ({ name })),
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
  selection.filter(hasChildren).forEach((node) => {
    const children = [...node.children];
    children.forEach((child: any) => {
      const target = child?.type === 'INSTANCE' ? rule.get(child.name) : null;
      if (target && replaceInstance(child, target)) changed++;
    });
  });

  sendMsgToUI(MessageType.BATCH_SWITCH_INSTANCES_RESULT, { changed });
  mg.notify(changed > 0 ? `已切换 ${changed} 个实例` : '没有实例被切换', { timeout: 2000 });
}

export default [
  { type: MessageType.BATCH_SWITCH_INSTANCES_GET, handler: handleGetData },
  { type: MessageType.BATCH_SWITCH_INSTANCES_APPLY, handler: handleApply }
];
