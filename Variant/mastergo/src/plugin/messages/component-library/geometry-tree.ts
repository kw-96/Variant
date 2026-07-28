/**
 * 子树几何捕获与还原 - 整树写回；组不改宽高；实例精确写宽高
 */

import { applyNodeGeometry, captureNodeGeometry } from './component-utils';

/** 组类节点：改宽高会缩放子节点 */
const GROUP_LIKE_TYPES = new Set(['GROUP', 'BOOLEAN_OPERATION']);

/** 可继续向下遍历的类型 */
const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'BOOLEAN_OPERATION']);

/** 子树中单个节点的几何快照 */
export interface IGeometryEntry {
  node: any;
  geometry: any;
  depth: number;
}

/**
 * 精确设置尺寸（优先 resizeWithoutConstraints）
 */
function resizeNode(node: any, width: number, height: number) {
  if (!node || !(width > 0) || !(height > 0)) return;
  try {
    if (typeof node.resizeWithoutConstraints === 'function') {
      node.resizeWithoutConstraints(width, height);
    } else if (typeof node.resize === 'function') {
      node.resize(width, height);
    } else {
      node.width = width;
      node.height = height;
    }
  } catch {
    try {
      node.width = width;
      node.height = height;
    } catch {
      // ignore
    }
  }
}

/**
 * 递归收集子树几何（进入组/Frame，不进入 INSTANCE 内部）
 */
function collectSubtree(parent: any, depth: number, out: IGeometryEntry[]) {
  let children: any[];
  try {
    children = [...(parent.children || [])];
  } catch {
    return;
  }

  for (const child of children) {
    if (!child) continue;
    out.push({
      node: child,
      geometry: captureNodeGeometry(child),
      depth
    });
    if (child.type === 'INSTANCE') continue;
    if (CONTAINER_TYPES.has(child.type)) {
      collectSubtree(child, depth + 1, out);
    }
  }
}

/**
 * 捕获 root 下整棵子树的几何（不含 root 自身）
 */
export function captureSubtreeGeometry(root: any): IGeometryEntry[] {
  const out: IGeometryEntry[] = [];
  if (!root) return out;
  collectSubtree(root, 0, out);
  return out;
}

/**
 * 还原单条快照
 */
function applyOneEntry(entry: IGeometryEntry) {
  const { node, geometry } = entry;
  if (!node || !geometry) return;
  try {
    if (node.removed) return;
  } catch {
    return;
  }

  let parent: any;
  try {
    parent = node.parent;
  } catch {
    return;
  }
  if (!parent) return;

  if (node.type === 'INSTANCE') {
    const width = geometry.width;
    const height = geometry.height;
    if (typeof width === 'number' && typeof height === 'number') {
      resizeNode(node, width, height);
    }
    const rest = { ...geometry };
    delete rest.width;
    delete rest.height;
    applyNodeGeometry(node, rest, parent);
    return;
  }

  if (GROUP_LIKE_TYPES.has(node.type)) {
    const rest = { ...geometry };
    delete rest.width;
    delete rest.height;
    applyNodeGeometry(node, rest, parent);
    return;
  }

  applyNodeGeometry(node, geometry, parent);
}

/**
 * 整树还原：先容器（浅→深，组不改尺寸），再实例（深→浅）
 */
export function applySubtreeGeometry(entries: IGeometryEntry[]) {
  if (!entries || entries.length === 0) return;

  const ordered = [...entries].sort((a, b) => a.depth - b.depth);
  for (const entry of ordered) {
    if (entry.node?.type === 'INSTANCE') continue;
    try {
      applyOneEntry(entry);
    } catch {
      // ignore
    }
  }

  const instances = ordered
    .filter((entry) => entry.node?.type === 'INSTANCE')
    .sort((a, b) => b.depth - a.depth);
  for (const entry of instances) {
    try {
      applyOneEntry(entry);
    } catch {
      // ignore
    }
  }
}
