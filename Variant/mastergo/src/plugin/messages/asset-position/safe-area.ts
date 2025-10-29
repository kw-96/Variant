/**
 * 安全区工具函数
 * 用于创建和管理画板的安全区域
 */

/**
 * 解析安全区字符串为对象
 * 支持格式：left:10,top:20,right:10,bottom:20
 * @param str 安全区字符串
 * @returns 安全区对象
 */
export function parseSafeArea(str: string): Record<string, number> {
  if (!str || typeof str !== 'string' || !str.trim()) {
    return {};
  }

  const result: Record<string, number> = {};
  const pairs = str.match(/(\w+)\s*:\s*(\d+)/g) || [];

  pairs.forEach((pair) => {
    const [key, value] = pair.split(':').map((item) => item.trim());
    result[key] = parseInt(value, 10);
  });

  return result;
}

/**
 * 创建安全区矩形
 * 安全区参数表示矩形距离容器各边的距离
 * 例如：left:48, right:48, top:48, bottom:50
 * 表示矩形距离左边48px，右边48px，上边48px，下边50px
 * 
 * @param frame 画板节点（容器）
 * @param width 容器宽度
 * @param height 容器高度
 * @param safeInfo 安全区信息对象 {left, right, top, bottom}
 * @param index 安全区索引（用于命名）
 * @returns 创建的安全区矩形
 */
export function createSafeAreaRectangle(
  frame: any,
  width: number,
  height: number,
  safeInfo: Record<string, number>,
  index: number
): any {
  const rectangle = mg.createRectangle();
  rectangle.name = `safeArea-${index + 1}`;

  // 安全区参数：left/right/top/bottom 表示矩形距离容器各边的距离
  const left = safeInfo.left || 0;
  const right = safeInfo.right || 0;
  const top = safeInfo.top || 0;
  const bottom = safeInfo.bottom || 0;

  // 计算安全区矩形的尺寸：
  // 宽度 = 容器宽度 - 左边距 - 右边距
  // 高度 = 容器高度 - 上边距 - 下边距
  const rectWidth = Math.max(0, width - left - right);
  const rectHeight = Math.max(0, height - top - bottom);

  // 安全区矩形的位置：
  // x = left（距离容器左边的距离）
  // y = top（距离容器上边的距离）
  rectangle.width = rectWidth;
  rectangle.height = rectHeight;
  rectangle.x = left;
  rectangle.y = top;

  // 设置不同安全区的颜色（包含透明度属性）
  const colors = [
    { r: 0.8, g: 0, b: 0, a: 0.4 }, // 红色，透明度 0.4
    { r: 0, g: 0.8, b: 0, a: 0.4 }, // 绿色，透明度 0.4
    { r: 0, g: 0, b: 0.8, a: 0.4 }, // 蓝色，透明度 0.4
  ];
  rectangle.fills = [
    {
      type: 'SOLID',
      color: colors[index % colors.length],
    },
  ];
  // MasterGo 使用 isVisible 属性来控制节点的显示/隐藏
  rectangle.isVisible = true; // 默认显示安全区
  rectangle.isLocked = true; // 默认锁定安全区

  frame.appendChild(rectangle);
  return rectangle;
}

/**
 * 设置画板的安全区
 * @param frame 画板节点
 * @param width 画板宽度
 * @param height 画板高度
 * @param safeArea 安全区字符串（支持多个，用分号分隔）
 */
export function setSafeArea(frame: any, width: number, height: number, safeArea?: string): void {
  if (!safeArea) return;

  // 按分号分割多个安全区
  const safeAreaGroups = safeArea.split(';');
  
  // 存储创建的所有安全区矩形
  const rectangles: any[] = [];

  safeAreaGroups.forEach((areaStr, index) => {
    if (!areaStr.trim()) return;

    const safeInfo = parseSafeArea(areaStr.trim());
    const rectangle = createSafeAreaRectangle(frame, width, height, safeInfo, index);
    rectangles.push(rectangle);
  });
  
  // 将所有安全区矩形移到最上层（移动到 children 数组末尾）
  // 在 DOM 结构中，appendChild 会将已存在的元素移到末尾，从而显示在最上层
  rectangles.forEach(rectangle => {
    frame.appendChild(rectangle);
  });
}

