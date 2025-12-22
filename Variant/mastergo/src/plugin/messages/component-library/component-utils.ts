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
 * 判断父节点是否使用自动布局（兼容 MasterGo 的 flexMode 和 Figma 风格的 layoutMode）
 * @param parent 父节点
 * @returns 是否使用自动布局
 */
export function hasAutoLayout(parent: any): boolean {
  if (!parent) return false;
  // MasterGo 风格：flexMode 存在且不为空/无效值
  if (parent.flexMode && typeof parent.flexMode === 'string' && parent.flexMode !== 'NONE') {
    return true;
  }
  // Figma 风格兼容：layoutMode 存在且不为 NONE
  if (parent.layoutMode && typeof parent.layoutMode === 'string' && parent.layoutMode !== 'NONE') {
    return true;
  }
  return false;
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
 * 捕获节点的几何信息（位置、尺寸、旋转等）
 * @param node 要捕获信息的节点
 * @returns 包含几何信息的对象
 */
export function captureNodeGeometry(node: any) {
  if (!node) return {};
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    layoutAlign: (node as any).layoutAlign,
    layoutGrow: (node as any).layoutGrow,
    constraints: node.constraints,
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

  // 根据父节点的布局模式应用位置或布局属性（统一判断：兼容 flexMode 和 layoutMode）
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
  if (constraints) {
    try {
      target.constraints = constraints;
    } catch {}
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
    // 获取变体属性
    const variantProperties = (instance as any).variantProperties;
    if (!Array.isArray(variantProperties) || variantProperties.length === 0) {
      return null;
    }

    // 收集所有变体属性的值
    const variantValues: string[] = [];
    for (const variant of variantProperties) {
      if (variant && typeof variant === 'object') {
        // 获取变体的值（可能是 value、values 或 options）
        let value: any = null;
        if (variant.value !== undefined) {
          value = variant.value;
        } else if (Array.isArray(variant.values) && variant.values.length > 0) {
          value = variant.values[0]; // 取第一个值
        } else if (Array.isArray(variant.options) && variant.options.length > 0) {
          value = variant.options[0]; // 取第一个选项
        }

        if (value !== null && value !== undefined) {
          const strValue = String(value);
          // 如果值包含等号，取等号后的部分（例如 "属性=LOGO_横" -> "LOGO_横"）
          if (strValue.includes('=')) {
            variantValues.push(strValue.split('=').pop()?.trim() || strValue);
          } else {
            variantValues.push(strValue);
          }
        }
      }
    }

    // 如果只有一个值，直接返回
    if (variantValues.length === 1) {
      return variantValues[0];
    }

    // 如果有多个值，尝试组合（例如 "LOGO_横"）
    if (variantValues.length > 1) {
      // 尝试找到包含描述性关键词的值（如包含"横"、"竖"等）
      const descriptiveValue = variantValues.find(v => v.includes('横') || v.includes('竖'));
      if (descriptiveValue) {
        return descriptiveValue;
      }
      // 否则返回第一个值
      return variantValues[0];
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
export function replaceInternalInstances(node: any, componentMap: Map<string, any>) {
  if (!node) return;

  // 如果是容器类型，递归处理子节点
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
    const children = node.children || [];
    // 使用副本遍历，因为替换操作会修改 children 数组
    [...children].forEach(child => replaceInternalInstances(child, componentMap));
  } 
  // 如果是实例，检查是否需要替换
  else if (node.type === 'INSTANCE') {
    let targetComponent: any = null;
    let matchedName: string | null = null;

    // 首先尝试通过名称直接匹配
    if (componentMap.has(node.name)) {
      targetComponent = componentMap.get(node.name);
      matchedName = node.name;
    } else {
      // 如果名称不匹配，尝试通过变体属性匹配
      const variantComponentName = extractComponentNameFromVariant(node);
      if (variantComponentName && componentMap.has(variantComponentName)) {
        targetComponent = componentMap.get(variantComponentName);
        matchedName = variantComponentName;
      }
    }

    // 如果找到匹配的组件，进行替换
    if (targetComponent) {
      try {
        // 记录原实例的几何信息（用于恢复位置和等比缩放目标尺寸）
        const originalX = typeof node.x === 'number' ? node.x : null;
        const originalY = typeof node.y === 'number' ? node.y : null;
        const originalWidth = typeof node.width === 'number' ? node.width : null;
        const originalHeight = typeof node.height === 'number' ? node.height : null;

        const newInstance = targetComponent.createInstance();

        // 在父节点中替换实例
        const parent = node.parent;
        if (parent) {
          const index = parent.children.indexOf(node);
          parent.insertChild(index, newInstance);
          node.remove(); // 移除旧实例
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

        // 恢复位置
        if (originalX !== null) {
          try {
            newInstance.x = originalX;
          } catch {}
        }
        if (originalY !== null) {
          try {
            newInstance.y = originalY;
          } catch {}
        }

        // 如果实例名称包含"背景"，将尺寸调整为父容器尺寸
        const isBackground = (matchedName && matchedName.includes('背景')) || 
                            (typeof node.name === 'string' && node.name.includes('背景'));
        if (isBackground && parent) {
          try {
            const parentWidth = typeof parent.width === 'number' ? parent.width : null;
            const parentHeight = typeof parent.height === 'number' ? parent.height : null;
            
            if (parentWidth && parentHeight) {
              if (typeof (newInstance as any).resizeWithoutConstraints === 'function') {
                (newInstance as any).resizeWithoutConstraints(parentWidth, parentHeight);
              } else if (typeof (newInstance as any).resize === 'function') {
                (newInstance as any).resize(parentWidth, parentHeight);
              } else {
                (newInstance as any).width = parentWidth;
                (newInstance as any).height = parentHeight;
              }
            }
          } catch {
            // 忽略背景尺寸调整失败
          }
        }
      } catch (e) {
        console.error(`替换实例失败 (${node.name} -> ${matchedName}):`, e);
      }
    }
  }
}

