// @ts-nocheck
import { MessageType } from '../../../../../src/messages';

/**
 * 通过 ukey 导入组件
 * @param data.groups 按描述分组的组件列表 [{ description: string, ukeys: string[] }]
 */
async function handler(data: { groups?: Array<{ description: string; ukeys: string[] }>, ukeys?: string[] }) {
  // 兼容旧格式：如果传递的是 ukeys 数组，转换为 groups 格式
  let groups: Array<{ description: string; ukeys: string[] }> = [];
  if (data.groups && Array.isArray(data.groups)) {
    groups = data.groups;
  } else if (data.ukeys && Array.isArray(data.ukeys)) {
    // 兼容旧格式：所有组件归为一个"未分组"描述
    groups = [{ description: '未分组', ukeys: data.ukeys }];
  }
  
  if (!groups || groups.length === 0) {
    mg.notify('请选择要导入的组件', { timeout: 2000 });
    return;
  }

  const currentPage = mg.document.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const viewportCenter = mg.viewport.center;
  const descriptionGroups: Array<{ description: string; instances: any[] }> = [];
  let successCount = 0;
  let failCount = 0;

  // 1. 按描述分组导入所有组件并创建实例
  for (const group of groups) {
    const instances: any[] = [];
    
    for (const ukey of group.ukeys) {
      try {
        const componentNode = await mg.importComponentByKeyAsync(ukey);
        if (componentNode) {
          const instance = componentNode.createInstance();
          currentPage.appendChild(instance);
          instances.push(instance);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`导入组件失败 (ukey: ${ukey}):`, error);
        failCount++;
      }
    }

    if (instances.length > 0) {
      // 在描述组内排序：名称不含"预览"的在前，含"预览"的在后
      instances.sort((a, b) => {
        const aIsPreview = a.name.includes('预览');
        const bIsPreview = b.name.includes('预览');
        if (aIsPreview && !bIsPreview) return 1;
        if (!aIsPreview && bIsPreview) return -1;
        return 0;
      });
      
      descriptionGroups.push({
        description: group.description,
        instances
      });
    }
  }

  if (descriptionGroups.length === 0) {
    if (failCount > 0) {
       mg.notify(`导入失败，请检查组件是否在团队库中`, { timeout: 3000 });
    }
    return;
  }

  // 2. 计算每个描述组的宽度和高度
  const groupSizes = descriptionGroups.map(group => {
    let groupWidth = 0;
    let groupHeight = 0;
    
    group.instances.forEach((inst, index) => {
      groupWidth += inst.width;
      if (index < group.instances.length - 1) {
        groupWidth += 20; // 同一描述组内组件间隔20px
      }
      groupHeight = Math.max(groupHeight, inst.height);
    });
    
    return { width: groupWidth, height: groupHeight };
  });

  // 3. 按行排列：每行最多3个描述组，描述组之间间隔600px
  const MAX_GROUPS_PER_ROW = 3;
  const GROUP_SPACING = 600; // 不同描述组之间间隔
  const ROW_SPACING = 100; // 行间距
  
  // 计算所有行的总高度，用于垂直居中
  const rows: Array<Array<{ group: typeof descriptionGroups[0]; size: typeof groupSizes[0] }>> = [];
  let currentRowGroups: Array<{ group: typeof descriptionGroups[0]; size: typeof groupSizes[0] }> = [];
  
  // 先分组到行
  for (let i = 0; i < descriptionGroups.length; i++) {
    const group = descriptionGroups[i];
    const size = groupSizes[i];
    
    if (currentRowGroups.length >= MAX_GROUPS_PER_ROW) {
      rows.push([...currentRowGroups]);
      currentRowGroups = [];
    }
    
    currentRowGroups.push({ group, size });
  }
  
  // 添加最后一行
  if (currentRowGroups.length > 0) {
    rows.push(currentRowGroups);
  }
  
  if (rows.length === 0) {
    return;
  }

  // 计算列数（最多3列）
  const columnCount = Math.min(
    MAX_GROUPS_PER_ROW,
    rows.reduce((max, row) => Math.max(max, row.length), 0),
  );

  // 计算每一列的最大宽度
  const columnWidths: number[] = new Array(columnCount).fill(0);
  rows.forEach(row => {
    row.forEach((item, colIndex) => {
      columnWidths[colIndex] = Math.max(columnWidths[colIndex], item.size.width);
    });
  });

  // 计算整行总宽度，用于水平居中
  const totalRowWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) +
    GROUP_SPACING * (columnCount - 1);

  // 计算每一列的起始 X 坐标
  const columnStartX: number[] = [];
  let accumulatedX = viewportCenter.x - totalRowWidth / 2;
  columnWidths.forEach((width, idx) => {
    columnStartX[idx] = accumulatedX;
    accumulatedX += width + GROUP_SPACING;
  });

  // 计算每一行的高度（最大组件高度）
  const rowHeights = rows.map(row =>
    Math.max(...row.map(item => item.size.height)),
  );

  // 总高度用于垂直居中
  const totalHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    ROW_SPACING * (rows.length - 1);

  let currentY = viewportCenter.y - totalHeight / 2;

  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex] || 0;

    row.forEach((item, colIndex) => {
      const startX = columnStartX[colIndex] ?? columnStartX[columnStartX.length - 1];
      let groupX = startX;
      item.group.instances.forEach(inst => {
        inst.x = groupX;
        inst.y = currentY; // 顶对齐
        groupX += inst.width + 20;
      });
    });

    currentY += rowHeight;
    if (rowIndex < rows.length - 1) {
      currentY += ROW_SPACING;
    }
  });

  // 收集所有实例用于后续处理
  const instances: any[] = [];
  descriptionGroups.forEach(group => {
    instances.push(...group.instances);
  });

  // 4. 立即解绑所有实例
  // map 存储: 实例 -> 解绑后的 Frame
  const detachedMap = new Map(); 
  // 存储新创建的组件: 组件名称 -> 组件节点
  const createdComponentsMap = new Map();

  // 为了防止解绑后引用丢失或顺序混乱，先收集解绑后的节点
  const detachedNodes: any[] = [];

  for (const instance of instances) {
    try {
        const isPreview = instance.name.includes('预览');
        const name = instance.name; // 记录原始名称
        
        // 解绑实例
        const detachedNode = instance.detachInstance();
        if (detachedNode) {
            detachedNodes.push({
            node: detachedNode,
            name: name,
            isPreview: isPreview
            });
        } else {
            console.warn(`解绑实例失败: ${name}`);
        }
    } catch (error) {
        console.error('解绑实例出错:', error);
    }
  }

  // 5. 处理非“预览”节点：重新设为组件（改为包裹模式）
  for (const item of detachedNodes) {
    if (!item.isPreview) {
      try {
        const frameNode = item.node;
        const originalX = frameNode.x;
        const originalY = frameNode.y;
        const targetWidth = frameNode.width;
        const targetHeight = frameNode.height;
        
        // 创建新组件 (作为容器)
        const newComponent = mg.createComponent();
        newComponent.name = item.name;
        
        // 1. 添加到页面
        currentPage.appendChild(newComponent);

        // 2. 设置位置（先对齐到原 Frame）
        newComponent.x = frameNode.x;
        newComponent.y = frameNode.y;
        
        // 3. 复制 Frame 的视觉属性，并设置组件布局为自由布局
        copyFrameProperties(frameNode, newComponent);
        newComponent.layoutMode = 'NONE';
        newComponent.paddingLeft = 0;
        newComponent.paddingRight = 0;
        newComponent.paddingTop = 0;
        newComponent.paddingBottom = 0;
        newComponent.itemSpacing = 0;

        // 4. 设置组件尺寸 (在迁移子节点前设置，防止约束错位)
        if (typeof targetWidth === 'number' && !Number.isNaN(targetWidth)) {
          (newComponent as any).width = targetWidth;
        }
        if (typeof targetHeight === 'number' && !Number.isNaN(targetHeight)) {
          (newComponent as any).height = targetHeight;
        }
        // 再次确保位置正确 (防止尺寸变化引起的锚点偏移)
        if (typeof originalX === 'number' && !Number.isNaN(originalX)) {
          newComponent.x = originalX;
        }
        if (typeof originalY === 'number' && !Number.isNaN(originalY)) {
          newComponent.y = originalY;
        }

        // 5. 克隆 Frame 的子节点到 Component 中，保持原有几何信息
        const frameChildren = [...frameNode.children];
        frameChildren.forEach(child => {
          const childGeometry = captureNodeGeometry(child);
          let nodeForComponent: any = child;
          let cloned = false;
          if (typeof child.clone === 'function') {
            try {
              nodeForComponent = child.clone();
              cloned = true;
            } catch (cloneError) {
              console.warn(`克隆子节点失败 (${child?.name || '未命名'})，改为移动原节点`, cloneError);
              nodeForComponent = child;
            }
          } else {
            console.warn(`节点 ${child?.name || '未命名'} 不支持 clone()，改为移动原节点`);
          }

          try {
            newComponent.appendChild(nodeForComponent);
            applyNodeGeometry(nodeForComponent, childGeometry, newComponent);
          } catch (moveError) {
            console.error(`迁移子节点失败 (${child?.name || '未命名'})`, moveError);
          }
        });

        // 6. 移除原 Frame
        if (!frameNode.removed) {
          frameNode.remove();
        }

        // 记录到 Map 中
        createdComponentsMap.set(newComponent.name, newComponent);
      } catch (error) {
          console.error(`转换组件失败 (${item.name}):`, error);
      }
    }
  }

  // 6. 处理“预览”节点：替换内部实例
  for (const item of detachedNodes) {
    if (item.isPreview) {
      try {
          const previewFrame = item.node;
          
          // 递归查找并替换子节点中的实例
          replaceInternalInstances(previewFrame, createdComponentsMap);
      } catch (error) {
          console.error(`处理预览节点失败 (${item.name}):`, error);
      }
    }
  }

  // 7. 组件与容器顶对齐
  alignNodesTop(createdComponentsMap, detachedNodes);

  if (failCount > 0) {
    mg.notify(`成功导入 ${successCount} 个组件，失败 ${failCount} 个`, { timeout: 3000 });
  } else {
    mg.notify(`成功导入并处理 ${successCount} 个组件`, { timeout: 2000 });
  }
}

// 辅助函数：递归替换内部实例
function replaceInternalInstances(node: any, componentMap: Map<string, any>) {
  if (!node) return;

  // 如果是 Frame 或 Group，继续递归
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
        
        // 复制位置和尺寸
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

export default {
  type: MessageType.IMPORT_COMPONENT_BY_UKEY,
  handler,
};

function copyFrameProperties(source: any, target: any) {
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

function captureNodeGeometry(node: any) {
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

function applyNodeGeometry(target: any, geometry: any, parent: any) {
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

  if (typeof rotation === 'number' && !Number.isNaN(rotation)) {
    target.rotation = rotation;
  }

  const parentLayoutMode = parent && typeof parent.layoutMode === 'string' ? parent.layoutMode : 'NONE';
  if (parentLayoutMode && parentLayoutMode !== 'NONE') {
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
    if (typeof x === 'number' && !Number.isNaN(x)) {
      target.x = x;
    }
    if (typeof y === 'number' && !Number.isNaN(y)) {
      target.y = y;
    }
  }

  if (constraints) {
    try {
      target.constraints = constraints;
    } catch {}
  }
}

function alignNodesTop(componentMap: Map<string, any>, detachedNodes: any[]) {
  const nodes: any[] = [];
  componentMap.forEach(node => {
    if (node && !node.removed && typeof node.y === 'number' && !Number.isNaN(node.y)) {
      nodes.push(node);
    }
  });
  detachedNodes.forEach(item => {
    if (item.isPreview && item.node && !item.node.removed && typeof item.node.y === 'number' && !Number.isNaN(item.node.y)) {
      nodes.push(item.node);
    }
  });
  if (nodes.length === 0) return;

  const targetY = nodes.reduce((min, node) => Math.min(min, node.y), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(targetY)) return;

  nodes.forEach(node => {
    try {
      node.y = targetY;
    } catch (error) {
      console.warn(`节点 ${node.name || '未命名'} 顶对齐失败:`, error);
    }
  });
}
