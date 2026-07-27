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
