/**
 * 组件导入相关的工具函数集合
 */

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

  // 根据父节点的布局模式应用位置或布局属性
  const parentLayoutMode = parent && typeof parent.layoutMode === 'string' ? parent.layoutMode : 'NONE';
  if (parentLayoutMode && parentLayoutMode !== 'NONE') {
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
    if (componentMap.has(node.name)) {
      try {
        const localComponent = componentMap.get(node.name);
        const newInstance = localComponent.createInstance();
        const geometry = captureNodeGeometry(node);
        
        // 在父节点中替换实例
        const parent = node.parent;
        if (parent) {
          const index = parent.children.indexOf(node);
          parent.insertChild(index, newInstance);
          node.remove(); // 移除旧实例
          applyNodeGeometry(newInstance, geometry, parent);
        }
      } catch (e) {
        console.error(`替换实例失败 (${node.name}):`, e);
      }
    }
  }
}

