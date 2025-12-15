/**
 * 转为数据流的公共工具函数
 */

// 收集文本节点
export function collectTextNodes(node: any): any[] {
  const result: any[] = [];
  if (!node) return result;

  const walk = (target: any) => {
    if (!target) return;

    if (target.type === 'TEXT') {
      result.push(target);
      return;
    }

    if (!target.children || target.children.length === 0) return;

    for (let i = 0; i < target.children.length; i++) {
      walk(target.children[i]);
    }
  };

  walk(node);
  return result;
}

// 创建自动布局容器
export function createAutoLayoutContainer(instance: any, currentPage: any, viewportCenter?: { x: number; y: number }) {
  try {
    const container = mg.createFrame();
    container.name = '数据流';

    const targetX = viewportCenter
      ? viewportCenter.x - instance.width / 2
      : 0;
    const targetY = viewportCenter
      ? viewportCenter.y - instance.height / 2
      : 0;

    container.x = targetX;
    container.y = targetY;

    if (typeof container.resizeWithoutConstraints === 'function') {
      container.resizeWithoutConstraints(instance.width, instance.height);
    } else if (typeof container.resize === 'function') {
      container.resize(instance.width, instance.height);
    } else {
      container.width = instance.width;
      container.height = instance.height;
    }

    try {
      container.flexMode = 'VERTICAL';
      container.mainAxisAlignItems = 'CENTER';
      container.crossAxisAlignItems = 'CENTER';
      container.mainAxisSizingMode = 'AUTO';
      container.crossAxisSizingMode = 'AUTO';
      container.itemSpacing = 20;
      container.paddingTop = 0;
      container.paddingBottom = 0;
      container.paddingLeft = 0;
      container.paddingRight = 0;
      container.flexGrow = 0;
    } catch (error) {
      // 忽略自动布局设置失败的场景
    }

    container.clipsContent = false;
    container.fills = [];

    currentPage.appendChild(container);
    container.appendChild(instance);
    return container;
  } catch (error) {
    return null;
  }
}

/**
 * 转为数据流的核心逻辑
 * @param requireSingleTextNode 是否要求仅存在一个文本节点
 */
export function convertToDataFlow(requireSingleTextNode: boolean = true): void {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection || [];
  if (selection.length === 0) {
    mg.notify('请先选择组件或实例', { timeout: 2000 });
    return;
  }

  if (selection.length > 1) {
    mg.notify('一次只能选择一个组件或实例', { timeout: 2000 });
    return;
  }

  const selectedNode = selection[0];
  if (selectedNode.type !== 'COMPONENT' && selectedNode.type !== 'INSTANCE') {
    mg.notify('请选择组件或实例', { timeout: 2000 });
    return;
  }

  const componentSource =
    selectedNode.type === 'COMPONENT'
      ? selectedNode
      : selectedNode.mainComponent;

  if (!componentSource) {
    mg.notify('无法找到组件源，请检查组件是否完整', { timeout: 2000 });
    return;
  }

  // 如果需要检查文本节点
  if (requireSingleTextNode) {
    const textNodes = collectTextNodes(componentSource);
    if (textNodes.length === 0) {
      mg.notify('组件中未找到文本图层，请先添加文本', { timeout: 2000 });
      return;
    }

    if (textNodes.length > 1) {
      mg.notify('组件中存在多个文本图层，请保留一个文本节点', { timeout: 2000 });
      return;
    }
  }

  let instance: any = null;
  try {
    if (componentSource.createInstance) {
      instance = componentSource.createInstance();
    } else if (typeof selectedNode.clone === 'function') {
      instance = selectedNode.clone();
    }
  } catch (error) {
    instance = null;
  }

  if (!instance) {
    mg.notify('无法创建实例，请检查组件是否有效', { timeout: 2000 });
    return;
  }

  const viewportCenter = (mg as any).viewport?.center;

  const container = createAutoLayoutContainer(instance, currentPage, viewportCenter);
  if (!container) {
    mg.notify('创建容器失败，请重试', { timeout: 2000 });
    return;
  }

  currentPage.selection = [container];
  mg.notify('已创建"数据流"容器', { timeout: 2000 });
}

