/**
 * 组件克隆与布局工具
 * 提供统一的将模板节点放入画板的能力
 */

/**
 * 克隆节点为实例
 * @param template 模板节点（COMPONENT/INSTANCE/普通节点）
 */
function createInstanceFromTemplate(template: any): any | null {
  if (!template) return null;

  if (template.type === 'COMPONENT') {
    return template.createInstance();
  }

  if (template.type === 'INSTANCE' && template.mainComponent) {
    return template.mainComponent.createInstance();
  }

  return template.clone();
}

/**
 * 调整节点尺寸
 */
function resizeNode(node: any, width: number, height: number) {
  if (!node) return;

  if ('constrainProportions' in node) {
    (node as any).constrainProportions = false;
  }

  if (typeof node.resizeWithoutConstraints === 'function') {
    node.resizeWithoutConstraints(width, height);
    return;
  }

  if (typeof node.resize === 'function') {
    node.resize(width, height);
    return;
  }

  node.width = width;
  node.height = height;
}

/**
 * 统一的模板放置逻辑
 * @param frame 目标画板
 * @param template 模板节点
 * @param width 目标宽度
 * @param height 目标高度
 */
export function placeTemplateInstance(
  frame: any,
  template: any,
  width: number,
  height: number
): any | null {
  if (!frame || !template) return null;

  const instance = createInstanceFromTemplate(template);
  if (!instance) return null;

  frame.appendChild(instance);
  resizeNode(instance, width, height);

  instance.x = 0;
  instance.y = 0;

  return instance;
}

