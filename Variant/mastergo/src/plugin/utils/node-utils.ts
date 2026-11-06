/**
 * 通用节点工具：文本节点收集、尺寸调整、安全写入
 */

/** 安全写入属性（当前上下文不支持该属性或值为 undefined 时忽略） */
export function trySet(node: any, key: string, value: any) {
  if (value === undefined) return;
  try {
    node[key] = value;
  } catch (e) {
    // ignore
  }
}

/** 递归收集节点下所有文本节点 */
export function collectTextNodes(node: any): any[] {
  const result: any[] = [];
  const walk = (target: any) => {
    if (!target) return;
    if (target.type === 'TEXT') {
      result.push(target);
      return;
    }
    let children: any = null;
    try {
      children = target.children;
    } catch (e) {
      children = null;
    }
    if (!children || children.length === 0) return;
    for (let i = 0; i < children.length; i++) walk(children[i]);
  };
  walk(node);
  return result;
}

/**
 * 精确设置尺寸（优先 resizeWithoutConstraints → resize → 直接赋值）
 * @param unlockRatio 为 true 时先解除等比约束
 */
export function resizeNode(node: any, width: number, height: number, unlockRatio = false) {
  if (!node || !(width > 0) || !(height > 0)) return;
  if (unlockRatio) {
    try {
      if ('constrainProportions' in node) node.constrainProportions = false;
    } catch (e) {
      // ignore
    }
  }
  try {
    if (typeof node.resizeWithoutConstraints === 'function') {
      node.resizeWithoutConstraints(width, height);
    } else if (typeof node.resize === 'function') {
      node.resize(width, height);
    } else {
      node.width = width;
      node.height = height;
    }
  } catch (e) {
    try {
      node.width = width;
      node.height = height;
    } catch (e2) {
      // ignore
    }
  }
}
