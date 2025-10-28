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
 * @param frame 画板节点
 * @param width 画板宽度
 * @param height 画板高度
 * @param safeInfo 安全区信息
 * @param index 安全区索引
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

  // 计算安全区的实际大小和位置
  rectangle.resize(
    width - (safeInfo.left || 0) - (safeInfo.right || 0),
    height - (safeInfo.top || 0) - (safeInfo.bottom || 0)
  );
  rectangle.x = safeInfo.left || 0;
  rectangle.y = safeInfo.top || 0;

  // 设置不同安全区的颜色
  const colors = [
    { r: 0.8, g: 0, b: 0 }, // 红色
    { r: 0, g: 0.8, b: 0 }, // 绿色
    { r: 0, g: 0, b: 0.8 }, // 蓝色
  ];
  rectangle.fills = [
    {
      type: 'SOLID',
      color: colors[index % colors.length],
      opacity: 0.4,
    },
  ];
  rectangle.visible = false; // 默认隐藏安全区

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

  safeAreaGroups.forEach((areaStr, index) => {
    if (!areaStr.trim()) return;

    const safeInfo = parseSafeArea(areaStr.trim());
    createSafeAreaRectangle(frame, width, height, safeInfo, index);
  });
}

