/**
 * 组件布局计算器 - 负责多描述组组件的行列排列和定位
 */

/**
 * 描述组信息
 */
interface DescriptionGroup {
  description: string;
  instances: any[];
}

/**
 * 尺寸信息
 */
interface SizeInfo {
  width: number;
  height: number;
}

/**
 * 布局配置
 */
interface LayoutConfig {
  maxGroupsPerRow: number; // 每行最多描述组数量
  groupSpacing: number; // 描述组之间间隔
  rowSpacing: number; // 行间距
  instanceSpacing: number; // 同一描述组内实例间隔
}

/**
 * 默认布局配置
 */
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  maxGroupsPerRow: 3,
  groupSpacing: 600,
  rowSpacing: 600,
  instanceSpacing: 20,
};

/**
 * 计算每个描述组的尺寸
 * @param descriptionGroups 描述组列表
 * @param config 布局配置
 * @returns 尺寸信息数组
 */
export function calculateGroupSizes(
  descriptionGroups: DescriptionGroup[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): SizeInfo[] {
  return descriptionGroups.map(group => {
    let groupWidth = 0;
    let groupHeight = 0;

    group.instances.forEach((inst, index) => {
      groupWidth += inst.width;
      if (index < group.instances.length - 1) {
        groupWidth += config.instanceSpacing;
      }
      groupHeight = Math.max(groupHeight, inst.height);
    });

    return { width: groupWidth, height: groupHeight };
  });
}

/**
 * 执行组件布局排列
 * @param descriptionGroups 描述组列表
 * @param groupSizes 描述组尺寸数组
 * @param viewportCenter 视口中心坐标
 * @param config 布局配置
 */
export function arrangeComponentLayout(
  descriptionGroups: DescriptionGroup[],
  groupSizes: SizeInfo[],
  viewportCenter: { x: number; y: number },
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): void {
  // 预处理：将超过5个组件的组拆分成多个子组
  interface ProcessedGroupItem {
    group: DescriptionGroup;
    size: SizeInfo;
    isFromLargeGroup: boolean; // 标记是否来自超过5个组件的组
  }
  
  const processedGroups: ProcessedGroupItem[] = [];
  const maxInstancesPerSubGroup = 5;
  
  for (let i = 0; i < descriptionGroups.length; i++) {
    const group = descriptionGroups[i];
    const size = groupSizes[i];
    
    // 如果当前组内的组件数量超过5个，拆分成多个子组
    if (group.instances.length > maxInstancesPerSubGroup) {
      // 将组件按每5个一组拆分
      for (let j = 0; j < group.instances.length; j += maxInstancesPerSubGroup) {
        const subInstances = group.instances.slice(j, j + maxInstancesPerSubGroup);
        const subGroup: DescriptionGroup = {
          description: group.description,
          instances: subInstances
        };
        
        // 计算子组的尺寸
        let subGroupWidth = 0;
        let subGroupHeight = 0;
        subInstances.forEach((inst, index) => {
          subGroupWidth += inst.width;
          if (index < subInstances.length - 1) {
            subGroupWidth += config.instanceSpacing;
          }
          subGroupHeight = Math.max(subGroupHeight, inst.height);
        });
        
        const subSize: SizeInfo = {
          width: subGroupWidth,
          height: subGroupHeight
        };
        
        processedGroups.push({ 
          group: subGroup, 
          size: subSize,
          isFromLargeGroup: true // 标记为来自大组
        });
      }
    } else {
      processedGroups.push({ 
        group, 
        size,
        isFromLargeGroup: false
      });
    }
  }
  
  // 按行分组
  const rows: Array<Array<{ group: DescriptionGroup; size: SizeInfo }>> = [];
  let currentRowGroups: Array<{ group: DescriptionGroup; size: SizeInfo }> = [];

  for (let i = 0; i < processedGroups.length; i++) {
    const item = processedGroups[i];
    
    // 如果这个组是从超过5个组件的组拆分出来的，让它单独占一行
    if (item.isFromLargeGroup) {
      // 如果当前行有内容，先保存当前行
      if (currentRowGroups.length > 0) {
        rows.push([...currentRowGroups]);
        currentRowGroups = [];
      }
      // 让这个子组单独占一行
      rows.push([{ group: item.group, size: item.size }]);
      continue;
    }

    if (currentRowGroups.length >= config.maxGroupsPerRow) {
      rows.push([...currentRowGroups]);
      currentRowGroups = [];
    }

    currentRowGroups.push({ group: item.group, size: item.size });
  }

  // 添加最后一行
  if (currentRowGroups.length > 0) {
    rows.push(currentRowGroups);
  }

  if (rows.length === 0) {
    return;
  }

  // 计算列数
  const columnCount = Math.min(
    config.maxGroupsPerRow,
    rows.reduce((max, row) => Math.max(max, row.length), 0),
  );

  // 计算每一列的最大宽度
  const columnWidths: number[] = new Array(columnCount).fill(0);
  rows.forEach(row => {
    row.forEach((item, colIndex) => {
      columnWidths[colIndex] = Math.max(columnWidths[colIndex], item.size.width);
    });
  });

  // 计算总宽度用于水平居中
  const totalRowWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) +
    config.groupSpacing * (columnCount - 1);

  // 计算每一列的起始X坐标
  const columnStartX: number[] = [];
  let accumulatedX = viewportCenter.x - totalRowWidth / 2;
  columnWidths.forEach((width, idx) => {
    columnStartX[idx] = accumulatedX;
    accumulatedX += width + config.groupSpacing;
  });

  // 计算每一行的高度
  const rowHeights = rows.map(row =>
    Math.max(...row.map(item => item.size.height)),
  );

  // 计算总高度用于垂直居中
  const totalHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) +
    config.rowSpacing * (rows.length - 1);

  let currentY = viewportCenter.y - totalHeight / 2;

  // 按行排列所有组件
  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex] || 0;

    row.forEach((item, colIndex) => {
      const startX = columnStartX[colIndex] ?? columnStartX[columnStartX.length - 1];
      let groupX = startX;

      // 同一描述组内的实例水平排列
      item.group.instances.forEach(inst => {
        inst.x = groupX;
        inst.y = currentY; // 同行顶对齐
        groupX += inst.width + config.instanceSpacing;
      });
    });

    // 更新Y坐标到下一行
    currentY += rowHeight;
    if (rowIndex < rows.length - 1) {
      currentY += config.rowSpacing;
    }
  });
}

