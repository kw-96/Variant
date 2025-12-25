/**
 * 组件导入相关的工具函数集合
 */

/**
 * 判断节点是否为预览节点（名称包含"预览"）
 * @param node 节点对象（需有 name 属性）或节点名称字符串
 * @returns 是否为预览节点
 */
export function isPreviewNode(node: any): boolean {
  if (!node) return false;
  const name = typeof node === 'string' ? node : String(node?.name || '');
  return name.includes('预览');
}

/**
 * 判断父节点是否使用自动布局
 * @param parent 父节点
 * @returns 是否使用自动布局
 */
export function hasAutoLayout(parent: any): boolean {
  if (!parent) return false;
  // flexMode 存在且不为空/无效值
  return parent.flexMode && typeof parent.flexMode === 'string' && parent.flexMode !== 'NONE';
}

/**
 * 复制Frame的视觉属性到目标节点
 * @param source 源节点（Frame）
 * @param target 目标节点（Component）
 */
export function copyFrameProperties(source: any, target: any) {
  if (!source || !target) return;
  
  const visualProps = [
    'fills',
    'strokes',
    'strokeWeight',
    'strokeAlign',
    'dashPattern',
    'effects',
    'opacity',
    'blendMode',
    'cornerRadius',
    'topLeftRadius',
    'topRightRadius',
    'bottomLeftRadius',
    'bottomRightRadius',
    'clipContent',
  ];

  const assignProps = (props: string[]) => {
    props.forEach(prop => {
      if (!(prop in source)) return;
      const value = (source as any)[prop];
      if (value === undefined || typeof value === 'function') return;
      if (typeof mg !== 'undefined' && value === (mg as any).mixed) return;
      try {
        (target as any)[prop] = value;
      } catch (error) {
        console.warn(`属性 ${prop} 复制失败:`, error);
      }
    });
  };

  assignProps(visualProps);
}

/**
 * 查找最左侧且最上方的节点（首个节点）
 * @param nodes 节点数组
 * @returns 首个节点的位置 { x, y }，如果没有节点则返回 null
 */
export function findFirstNodePosition(nodes: any[]): { x: number; y: number } | null {
  if (!nodes || nodes.length === 0) return null;
  
  let firstNode = nodes[0];
  let firstX = typeof firstNode?.x === 'number' ? firstNode.x : 0;
  let firstY = typeof firstNode?.y === 'number' ? firstNode.y : 0;
  
  for (const node of nodes) {
    if (!node) continue;
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    // 优先选择 Y 更小的（更上方），如果 Y 相同则选择 X 更小的（更左侧）
    if (y < firstY || (y === firstY && x < firstX)) {
      firstNode = node;
      firstX = x;
      firstY = y;
    }
  }
  
  return { x: firstX, y: firstY };
}

/**
 * 解析错误信息，返回友好的错误原因
 * @param error 错误对象或错误消息
 * @returns 错误原因字符串
 */
export function parseErrorReason(error: any): string {
  const errorMsg = error?.message || String(error) || '未知错误';
  
  if (errorMsg.includes('2022') || errorMsg.includes('return')) {
    return '组件不存在或权限不足';
  } else if (errorMsg.includes('network') || errorMsg.includes('网络')) {
    return '网络错误';
  }
  
  return errorMsg;
}

/**
 * 必需组件集描述列表（按固定顺序）
 */
export const REQUIRED_COMPONENT_SET_ORDER = ['背景', 'IP', 'LOGO', '主题'] as const;

/**
 * 必需组件集描述集合（用于快速查找）
 */
export const REQUIRED_COMPONENT_SET_DESCRIPTIONS = new Set(REQUIRED_COMPONENT_SET_ORDER);

/**
 * 捕获节点的几何信息（位置、尺寸、旋转等）
 * @param node 要捕获信息的节点
 * @returns 包含几何信息的对象
 */
export function captureNodeGeometry(node: any) {
  if (!node) return {};
  
  // 捕获约束对象（确保正确复制 horizontal 和 vertical 属性）
  let constraints: any = undefined;
  if (node.constraints) {
    try {
      // 约束对象结构：{ horizontal: ConstraintType, vertical: ConstraintType }
      // 确保正确捕获 horizontal 和 vertical 属性
      const horizontal = (node.constraints as any).horizontal;
      const vertical = (node.constraints as any).vertical;
      if (horizontal !== undefined || vertical !== undefined) {
        constraints = {
          horizontal: horizontal,
          vertical: vertical,
        };
      }
    } catch {
      // 如果捕获失败，尝试直接复制
      constraints = node.constraints;
    }
  }
  
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    layoutAlign: (node as any).layoutAlign,
    layoutGrow: (node as any).layoutGrow,
    constraints: constraints,
  };
}

/**
 * 应用几何信息到目标节点
 * @param target 目标节点
 * @param geometry 几何信息对象
 * @param parent 父节点（用于判断布局模式）
 */
export function applyNodeGeometry(target: any, geometry: any, parent: any) {
  if (!target || !geometry) return;
  
  const {
    x,
    y,
    width,
    height,
    rotation,
    layoutAlign,
    layoutGrow,
    constraints,
  } = geometry;

  // 应用尺寸
  if (typeof width === 'number' && !Number.isNaN(width) && typeof height === 'number' && !Number.isNaN(height)) {
    if (typeof target.resize === 'function') {
      try {
        target.resize(width, height);
      } catch {
        target.width = width;
        target.height = height;
      }
    } else {
      target.width = width;
      target.height = height;
    }
  }

  // 应用旋转
  if (typeof rotation === 'number' && !Number.isNaN(rotation)) {
    target.rotation = rotation;
  }

  // 根据父节点的布局模式应用位置或布局属性
  if (hasAutoLayout(parent)) {
    // 自动布局模式：应用布局属性
    if (layoutAlign !== undefined) {
      try {
        target.layoutAlign = layoutAlign;
      } catch {}
    }
    if (layoutGrow !== undefined) {
      try {
        target.layoutGrow = layoutGrow;
      } catch {}
    }
  } else {
    // 自由布局模式：应用绝对位置
    if (typeof x === 'number' && !Number.isNaN(x)) {
      target.x = x;
    }
    if (typeof y === 'number' && !Number.isNaN(y)) {
      target.y = y;
    }
  }

  // 应用约束
  // 约束对象结构：{ horizontal: ConstraintType, vertical: ConstraintType }
  // ConstraintType: 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE'
  if (constraints) {
    try {
      // 确保约束对象包含 horizontal 和 vertical 属性
      if (typeof constraints === 'object' && ('horizontal' in constraints || 'vertical' in constraints)) {
        const constraintObj: any = {};
        if ('horizontal' in constraints) {
          constraintObj.horizontal = constraints.horizontal;
        }
        if ('vertical' in constraints) {
          constraintObj.vertical = constraints.vertical;
        }
        target.constraints = constraintObj;
      } else {
        // 如果结构不符合预期，尝试直接赋值
        target.constraints = constraints;
      }
    } catch (e) {
      // 约束设置失败时，记录警告但不中断流程
      console.warn(`应用约束失败 (${target?.name || '未命名'}):`, e);
    }
  }
}

/**
 * 从实例的变体属性中提取组件名称
 * @param instance 实例节点
 * @returns 组件名称（如果无法提取则返回 null）
 */
function extractComponentNameFromVariant(instance: any): string | null {
  if (!instance || instance.type !== 'INSTANCE') return null;

  try {
    const variantProperties = (instance as any).variantProperties;
    if (!Array.isArray(variantProperties) || variantProperties.length === 0) {
      return null;
    }

    // 收集所有变体属性的值
    const variantValues: string[] = [];
    for (const variant of variantProperties) {
      if (variant && typeof variant === 'object') {
        let value: any = null;
        if (variant.value !== undefined) {
          value = variant.value;
        } else if (Array.isArray(variant.values) && variant.values.length > 0) {
          value = variant.values[0];
        } else if (Array.isArray(variant.options) && variant.options.length > 0) {
          value = variant.options[0];
        }

        if (value !== null && value !== undefined) {
          const strValue = String(value);
          // 如果值包含等号，取等号后的部分（例如 "属性=LOGO_横" -> "LOGO_横"）
          const extracted = strValue.includes('=') ? strValue.split('=').pop()?.trim() || strValue : strValue;
          variantValues.push(extracted);
        }
      }
    }

    // 如果只有一个值，直接返回
    if (variantValues.length === 1) {
      return variantValues[0];
    }

    // 如果有多个值，尝试组合
    if (variantValues.length > 1) {
      const descriptiveValue = variantValues.find(v => v.includes('横') || v.includes('竖'));
      const typeValue = variantValues.find(v => 
        v.includes('LOGO') || v.includes('主题') || v.includes('背景') || v.includes('IP')
      );
      
      // 如果找到了类型值和描述性值，组合它们
      if (typeValue && descriptiveValue) {
        return `${typeValue}_${descriptiveValue}`;
      }
      
      // 如果只找到了描述性值，尝试与其他值组合
      if (descriptiveValue) {
        const otherValue = variantValues.find(v => v !== descriptiveValue);
        if (otherValue) {
          const combination1 = `${otherValue}_${descriptiveValue}`;
          const combination2 = `${descriptiveValue}_${otherValue}`;
          // 优先返回类型值在前的组合
          if (otherValue.includes('LOGO') || otherValue.includes('主题') || 
              otherValue.includes('背景') || otherValue.includes('IP')) {
            return combination1;
          }
          return combination2;
        }
        return descriptiveValue;
      }
      
      // 如果只找到了类型值，返回它
      if (typeValue) {
        return typeValue;
      }
      
      // 否则尝试组合所有值（用下划线连接）
      return variantValues.join('_');
    }

    return null;
  } catch (e) {
    console.error('提取变体属性失败:', e);
    return null;
  }
}

/**
 * 递归替换节点内部的实例
 * @param node 要处理的节点
 * @param componentMap 组件映射表（名称 -> 组件节点）
 */
/**
 * 检查节点是否仍然有效（未删除且有父节点）
 */
function isNodeValid(node: any): boolean {
  if (!node) return false;
  try {
    return !node.removed && !!node.parent;
  } catch {
    return false;
  }
}

export function replaceInternalInstances(node: any, componentMap: Map<string, any>) {
  if (!node) return;

  // 如果是容器类型，递归处理子节点
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
    if (!isNodeValid(node)) return;
    
    // 获取children数组的快照，避免在遍历过程中children数组被修改
    let children: any[];
    try {
      children = node.children || [];
    } catch {
      return;
    }
    
    // 先收集所有需要处理的子节点，避免在遍历过程中节点被删除导致的问题
    const childrenToProcess: Array<{ node: any; name: string }> = [];
    for (const child of children) {
      if (!child) continue;
      
      if (isNodeValid(child)) {
        childrenToProcess.push({
          node: child,
          name: child.name || '未命名'
        });
      }
    }
    
    // 遍历收集到的子节点进行处理
    for (const item of childrenToProcess) {
      let child: any;
      try {
        child = item.node;
      } catch {
        continue;
      }
      
      // 再次检查节点是否仍然有效（可能在收集后被删除）
      if (!isNodeValid(child)) {
        continue;
      }
      
      try {
        replaceInternalInstances(child, componentMap);
      } catch (e: any) {
        // 节点不存在错误是预期的（替换过程中节点会被删除，说明替换成功），静默处理
        // 只记录其他类型的错误
        if (e?.message && !e.message.includes('does not exist')) {
          console.error(`递归处理子节点失败 (${item.name}):`, e);
  } 
        // 继续处理下一个节点，不因为单个节点失败而中断整个替换过程
      }
    }
    
    return; // 容器节点处理完子节点后返回，不再继续处理
  }
  
  // 如果是实例，检查是否需要替换
  if (node.type === 'INSTANCE') {
    if (!isNodeValid(node)) return;
    
    let targetComponent: any = null;
    let matchedName: string | null = null;

    // 首先尝试通过名称直接匹配
    if (componentMap.has(node.name)) {
      targetComponent = componentMap.get(node.name);
      matchedName = node.name;
    } else {
      // 如果名称不匹配，尝试通过变体属性匹配
      const variantComponentName = extractComponentNameFromVariant(node);
      
      if (variantComponentName) {
        // 1. 直接匹配
        if (componentMap.has(variantComponentName)) {
          targetComponent = componentMap.get(variantComponentName);
          matchedName = variantComponentName;
        } else {
          // 2. 获取所有变体值，用于更精确的匹配
          const variantProperties = (node as any).variantProperties;
          const allVariantValues: string[] = [];
          if (Array.isArray(variantProperties)) {
            variantProperties.forEach((v: any) => {
              let val: any = null;
              if (v?.value !== undefined) val = v.value;
              else if (Array.isArray(v?.values) && v.values.length > 0) val = v.values[0];
              else if (Array.isArray(v?.options) && v.options.length > 0) val = v.options[0];
              if (val !== null && val !== undefined) {
                const strVal = String(val);
                const extracted = strVal.includes('=') ? strVal.split('=').pop()?.trim() : strVal;
                if (extracted) allVariantValues.push(extracted);
              }
            });
          }
          
          // 优先查找完全匹配的组件名称
          let foundMatch = false;
          for (const [componentName, component] of componentMap.entries()) {
            // 检查组件名称是否包含所有变体值
            const matchesAll = allVariantValues.length > 0 && 
              allVariantValues.every((val: string) => componentName.includes(val));
            
            if (matchesAll) {
              targetComponent = component;
              matchedName = componentName;
              foundMatch = true;
              break;
            }
          }
          
          // 如果没有完全匹配，尝试模糊匹配
          if (!foundMatch) {
            for (const [componentName, component] of componentMap.entries()) {
              if (componentName.includes(variantComponentName) || variantComponentName.includes(componentName)) {
                targetComponent = component;
                matchedName = componentName;
                break;
              }
            }
          }
        }
      }
    }

    // 如果找到匹配的组件，进行替换
    if (targetComponent) {
      try {
        if (!isNodeValid(node)) return;
        
        let parent: any;
        try {
          parent = node.parent;
        } catch {
          return;
        }
        
        if (!parent) return;
        
        // 捕获原实例的完整几何信息（包括位置、尺寸、旋转、约束、布局属性等）
        const originalGeometry = captureNodeGeometry(node);
        const originalWidth = typeof node.width === 'number' ? node.width : null;
        const originalHeight = typeof node.height === 'number' ? node.height : null;

        let newInstance: any;
        try {
          newInstance = targetComponent.createInstance();
        } catch (e) {
          console.error(`创建新实例失败 (${node.name}):`, e);
          return;
        }
        
        if (!newInstance) {
          console.error(`创建新实例返回空 (${node.name})`);
          return;
        }
        
        // 在父节点中替换实例
        let index: number;
        try {
          index = parent.children.indexOf(node);
        } catch {
          return;
        }
        
        if (index === -1) return;
        
        try {
          parent.insertChild(index, newInstance);
        } catch (e: any) {
          // 插入失败才是真正的错误
          console.error(`插入新实例失败 (${node.name}):`, e);
          return;
        }
        
        // 移除旧实例，如果节点不存在说明已经被删除（替换成功），这是正常的
        try {
          node.remove();
        } catch {
          // 节点不存在是预期的（替换成功），静默处理
        }

        // 使用官方 rescale 方法进行等比缩放（效果与手动缩放一致）
        if (originalWidth && originalHeight && typeof (newInstance as any).rescale === 'function') {
          const newWidth = typeof newInstance.width === 'number' ? newInstance.width : originalWidth;
          const newHeight = typeof newInstance.height === 'number' ? newInstance.height : originalHeight;

          // 以宽度为基准计算缩放系数；如果宽度无效则退回到高度
          let scale: number | null = null;
          if (newWidth && !Number.isNaN(newWidth)) {
            scale = originalWidth / newWidth;
          } else if (newHeight && !Number.isNaN(newHeight)) {
            scale = originalHeight / newHeight;
          }

          if (scale && !Number.isNaN(scale)) {
            try {
              // 以左上角为缩放中心，避免偏移（与大多数手动缩放场景一致）
              (newInstance as any).rescale(scale, { scaleCenter: 'TOPLEFT' });
            } catch {
              // 如果 rescale 调用失败，退回到 resize 方案
              try {
                if (typeof (newInstance as any).resizeWithoutConstraints === 'function') {
                  (newInstance as any).resizeWithoutConstraints(originalWidth, originalHeight);
                } else if (typeof (newInstance as any).resize === 'function') {
                  (newInstance as any).resize(originalWidth, originalHeight);
                } else {
                  (newInstance as any).width = originalWidth;
                  (newInstance as any).height = originalHeight;
                }
              } catch {
                // 忽略兜底失败
              }
            }
          }
        }

        // 恢复所有原始属性（位置、旋转、约束、布局属性等）
        // 注意：尺寸已在上面通过 rescale 或 resize 处理，这里只恢复其他属性
        const geometryToRestore = { ...originalGeometry };
        // 尺寸已在上面处理，避免重复设置
        delete geometryToRestore.width;
        delete geometryToRestore.height;
        applyNodeGeometry(newInstance, geometryToRestore, parent);

        // 如果实例名称包含"背景"，将尺寸调整为父容器尺寸
        const isBackground = (matchedName && matchedName.includes('背景')) || 
                            (typeof node.name === 'string' && node.name.includes('背景'));
        if (isBackground) {
          try {
            // 重新获取parent，因为node已经被删除
            const currentParent = newInstance.parent;
            if (currentParent) {
              const parentWidth = typeof currentParent.width === 'number' ? currentParent.width : null;
              const parentHeight = typeof currentParent.height === 'number' ? currentParent.height : null;
              
              if (parentWidth && parentHeight) {
                try {
                  if (typeof (newInstance as any).resizeWithoutConstraints === 'function') {
                    (newInstance as any).resizeWithoutConstraints(parentWidth, parentHeight);
                  } else if (typeof (newInstance as any).resize === 'function') {
                    (newInstance as any).resize(parentWidth, parentHeight);
                  } else {
                    (newInstance as any).width = parentWidth;
                    (newInstance as any).height = parentHeight;
                  }
                } catch (e: any) {
                  // 新实例不存在才是错误（说明替换失败），节点不存在错误是预期的
                  if (e?.message && !e.message.includes('does not exist')) {
                    console.error('调整背景实例尺寸失败:', e);
                  }
                }
              }
            }
          } catch (e: any) {
            // 新实例不存在才是错误（说明替换失败），节点不存在错误是预期的
            if (e?.message && !e.message.includes('does not exist')) {
              console.error('调整背景实例尺寸时出错:', e);
            }
          }
        }
      } catch (e: any) {
        // 节点不存在错误是预期的（替换过程中节点会被删除，说明替换成功），静默处理
        // 只有在替换操作本身失败（不是节点不存在）才是真正的错误
        if (e?.message && !e.message.includes('does not exist')) {
          console.error(`替换实例失败 (${node.name} -> ${matchedName}):`, e);
        }
      }
    }
  }
}

