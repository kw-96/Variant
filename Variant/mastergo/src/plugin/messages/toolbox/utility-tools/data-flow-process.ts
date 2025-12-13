/**
 * 数据流处理
 * 根据表格数据批量克隆并填充组件属性或文本内容
 */
import { MessageType } from '../../../../../../src/messages';

interface DataFlowData {
  headers: string[]; // 表头数组
  rows: Record<string, any>[]; // 数据行数组（每行是一个对象，key为表头，value为数据值）
}

/**
 * 递归查找节点中指定名称的组件集或组件实例
 */
function findNodeByName(node: any, name: string): any | null {
  if (!node) return null;

  // 检查当前节点名称是否匹配
  if (node.name === name) {
    return node;
  }

  // 递归查找子节点
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const found = findNodeByName(child, name);
      if (found) return found;
    }
  }

  return null;
}

/**
 * 收集节点中的所有文本节点
 */
function collectTextNodes(node: any): any[] {
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

/**
 * 切换组件集的属性
 * @param instance 组件集实例
 * @param propertyName 属性名称（表头名称，需要匹配组件或组件集的名称）
 * @param propertyValue 属性值
 */
function switchComponentSetProperty(instance: any, propertyName: string, propertyValue: string) {
  if (!instance || instance.type !== 'INSTANCE') {
    return false;
  }

  try {
    // 获取组件集的主组件
    const mainComponent = instance.mainComponent || instance.component;
    if (!mainComponent || mainComponent.type !== 'COMPONENT_SET') {
      return false;
    }

    // 获取组件集的属性定义
    const componentPropertyDefinitions = mainComponent.componentPropertyDefinitions || {};
    
    // 查找匹配的属性（支持通过属性名称或key匹配）
    let matchedKey: string | null = null;
    for (const [key, definition] of Object.entries(componentPropertyDefinitions)) {
      const def = definition as any;
      // 检查属性名称是否匹配（支持名称或key匹配）
      if (def.name === propertyName || key === propertyName) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return false;
    }

    // 设置实例的属性值
    if (instance.setProperties && typeof instance.setProperties === 'function') {
      try {
        instance.setProperties({ [matchedKey]: propertyValue });
        return true;
      } catch (error) {
        console.warn(`使用 setProperties 设置属性失败，尝试直接设置:`, error);
      }
    }
    
    // 降级方案：直接设置 componentProperties
    if (instance.componentProperties) {
      instance.componentProperties[matchedKey] = propertyValue;
      return true;
    }

    return false;
  } catch (error) {
    console.error(`切换组件集属性失败 (${propertyName}):`, error);
    return false;
  }
}

/**
 * 替换组件的文本内容
 * @param component 组件实例
 * @param textValue 文本值
 */
function replaceComponentText(component: any, textValue: string) {
  if (!component) return false;

  const textNodes = collectTextNodes(component);
  if (textNodes.length === 0) {
    return false;
  }

  // 如果只有一个文本节点，直接替换
  if (textNodes.length === 1) {
    try {
      textNodes[0].characters = textValue;
      return true;
    } catch (error) {
      console.error('替换文本失败:', error);
      return false;
    }
  }

  // 如果有多个文本节点，尝试替换第一个
  try {
    textNodes[0].characters = textValue;
    return true;
  } catch (error) {
    console.error('替换文本失败:', error);
    return false;
  }
}

/**
 * 处理数据流
 */
function handler(data: DataFlowData) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection || [];
  const targetGroup = selection[0];

  // 验证选中节点
  if (!targetGroup || targetGroup.name !== '数据流') {
    mg.notify('请选择名为"数据流"的组', { timeout: 2000 });
    return;
  }

  if (targetGroup.type !== 'FRAME' && targetGroup.type !== 'GROUP') {
    mg.notify('选中的节点必须是组或画板', { timeout: 2000 });
    return;
  }

  // 验证数据
  if (!data.headers || data.headers.length === 0) {
    mg.notify('表头数据为空', { timeout: 2000 });
    return;
  }

  if (!data.rows || data.rows.length === 0) {
    mg.notify('数据行为空', { timeout: 2000 });
    return;
  }

  // 查找数据流组内的模板实例
  const children = targetGroup.children || [];
  const templateInstance = children.find(
    (child: any) => child.type === 'INSTANCE' || child.type === 'COMPONENT'
  );

  if (!templateInstance) {
    mg.notify('"数据流"组中缺少实例或组件，请先添加模板', {
      timeout: 2000,
    });
    return;
  }

  // 获取模板源
  const templateSource =
    templateInstance.mainComponent ||
    templateInstance.component ||
    templateInstance;

  if (!templateSource) {
    mg.notify('无法获取组件模板', { timeout: 2000 });
    return;
  }

  // 清理其他节点（保留模板实例）
  const otherNodes = children.filter((child: any) => child !== templateInstance);
  otherNodes.forEach((node: any) => node?.remove?.());

  // 克隆并填充数据
  const instances: any[] = [];
  const totalRows = data.rows.length;

  for (let i = 0; i < totalRows; i++) {
    let instance: any = null;

    // 第一行使用模板实例，其他行克隆
    if (i === 0) {
      instance = templateInstance;
    } else {
      if (templateSource.createInstance) {
        instance = templateSource.createInstance();
        targetGroup.appendChild(instance);
      } else if (typeof templateInstance.clone === 'function') {
        instance = templateInstance.clone();
        targetGroup.appendChild(instance);
      } else {
        mg.notify('无法复制实例，请检查组件是否有效', { timeout: 2000 });
        return;
      }
    }

    if (!instance) {
      mg.notify('实例创建失败', { timeout: 2000 });
      return;
    }

    // 获取当前行的数据
    const rowData = data.rows[i];

    // 根据表头处理每个字段
    for (const header of data.headers) {
      const value = rowData[header];
      if (value === undefined || value === null) {
        continue;
      }

      // 在实例中查找对应名称的节点
      const targetNode = findNodeByName(instance, header);
      if (!targetNode) {
        // 如果找不到对应名称的节点，跳过该字段
        continue;
      }

      // 判断节点类型并处理
      if (targetNode.type === 'INSTANCE') {
        // 检查是否是组件集实例
        const mainComponent = targetNode.mainComponent || targetNode.component;
        if (mainComponent && mainComponent.type === 'COMPONENT_SET') {
          // 组件集：切换属性
          const success = switchComponentSetProperty(
            targetNode,
            header,
            String(value)
          );
          if (!success) {
            console.warn(`无法切换组件集属性: ${header}`);
          }
        } else {
          // 普通组件实例：尝试替换文本
          const success = replaceComponentText(targetNode, String(value));
          if (!success) {
            console.warn(`无法替换组件文本: ${header}`);
          }
        }
      } else if (targetNode.type === 'COMPONENT') {
        // 组件：尝试替换文本
        const success = replaceComponentText(targetNode, String(value));
        if (!success) {
          console.warn(`无法替换组件文本: ${header}`);
        }
      } else if (targetNode.type === 'TEXT') {
        // 文本节点：直接替换
        try {
          targetNode.characters = String(value);
        } catch (error) {
          console.warn(`无法替换文本节点: ${header}`, error);
        }
      }
    }

    instances.push(instance);
  }

  // 重置所有实例的位置（可选，根据需求调整）
  instances.forEach(instance => {
    instance.x = 0;
    instance.y = 0;
  });

  // 选中数据流组
  currentPage.selection = [targetGroup];

  mg.notify(`成功处理 ${totalRows} 行数据`, { timeout: 2000 });
}

export default {
  type: MessageType.DATA_FLOW_PROCESS,
  handler,
};

