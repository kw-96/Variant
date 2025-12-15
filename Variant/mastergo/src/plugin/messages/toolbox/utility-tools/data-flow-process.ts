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
 * 判断是否为组件集实例
 * @param instance 实例节点
 */
function isComponentSetInstance(instance: any): boolean {
  if (!instance || instance.type !== 'INSTANCE') return false;
  const mainComponent = instance.mainComponent || instance.component;
  if (!mainComponent) return false;
  if (mainComponent.type === 'COMPONENT_SET') return true;
  if (mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') return true;
  return false;
}

/**
 * 组件集实例：直接切换到指定的变体状态（取第一个 VARIANT 属性）
 * - 表格单元格值：期望为变体名称（如 image09_1）
 * - 兼容组件集中选项格式：属性1=image09_1（仅比较等号后半段）
 * @param instance 组件集实例
 * @param desiredVariantName 期望的变体名称
 */
function switchComponentSetVariant(instance: any, desiredVariantName: string): boolean {
  if (!instance || instance.type !== 'INSTANCE') return false;

  // 使用官方提供的 variantProperties 读取变体信息
  const variantProperties = (instance as any).variantProperties;
  if (!Array.isArray(variantProperties) || variantProperties.length === 0) {
    console.warn('实例不存在 variantProperties，无法切换组件集变体');
    return false;
  }

  // 取第一个变体属性，直接使用 SDK 暴露的 property 字段作为真实属性名
  const firstVariant = variantProperties[0] || {};
  const propKey = (firstVariant as any).property;

  if (!propKey) {
    console.warn('变体属性缺少 property 字段，无法切换组件集变体');
    return false;
  }

  // 不同版本 SDK 中字段命名可能不同，这里做一次兼容性兜底
  let variantOptions: string[] = [];
  if (Array.isArray(firstVariant.options)) {
    variantOptions = firstVariant.options;
  } else if (Array.isArray(firstVariant.values)) {
    variantOptions = firstVariant.values;
  } else if (Array.isArray(firstVariant.variants)) {
    variantOptions = firstVariant.variants;
  }

  const normalize = (val: string) => {
    if (!val) return '';
    const parts = String(val).split('=');
    return String(parts[parts.length - 1]).trim().toLowerCase();
  };

  let finalValue: any = desiredVariantName;
  if (variantOptions.length > 0) {
    const desiredLower = String(desiredVariantName).toLowerCase();
    const desiredNorm = normalize(desiredVariantName);

    const matched = variantOptions.find(opt => {
      if (!opt) return false;
      if (opt.toLowerCase() === desiredLower) return true;
      return normalize(opt) === desiredNorm;
    });

    if (matched) {
      finalValue = matched;
    } else {
      console.warn('目标变体不在可选列表，使用默认项');
    }
  }

  if (typeof (instance as any).setVariantPropertyValues === 'function') {
    try {
      (instance as any).setVariantPropertyValues({ [propKey]: finalValue });
      return true;
    } catch (error) {
      console.warn('setVariantPropertyValues 调用失败，尝试 setProperties', error);
    }
  }

  if (typeof instance.setProperties === 'function') {
    try {
      instance.setProperties({ [propKey]: finalValue });
      return true;
    } catch (error) {
      console.warn('setProperties 调用失败，无法切换组件集变体', error);
    }
  }

  console.warn('无法切换组件集变体（API 均失败）');
  return false;
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
        const strValue = String(value);

        // 组件集实例：仅切换变体状态，不做文本替换
        if (isComponentSetInstance(targetNode)) {
          const ok = switchComponentSetVariant(targetNode, strValue);
          if (!ok) {
            console.warn(`无法切换组件集变体: ${header}`, { nodeName: targetNode.name });
          }
          continue;
        }

        // 非组件集实例：直接替换文本
        const ok = replaceComponentText(targetNode, strValue);
        if (!ok) {
          console.warn(`无法替换实例文本: ${header}`, { nodeName: targetNode.name });
        }
      } else if (targetNode.type === 'COMPONENT') {
        const success = replaceComponentText(targetNode, String(value));
        if (!success) {
          console.warn(`无法替换组件文本: ${header}`, { nodeName: targetNode.name });
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

