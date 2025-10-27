/**
 * 共享的通用工具函数
 * 这些函数不依赖特定平台的API，可以在Figma和MasterGo之间复用
 * 
 * 注意：平台特定的函数（如对象创建、存储操作等）应放在各平台的 adapter.ts 中
 */

// ==================== 对象操作 ====================

/**
 * 深度合并两个对象
 * @param obj1 目标对象
 * @param obj2 源对象
 * @returns 合并后的对象
 */
export function deepMerge(obj1: any, obj2: any): any {
  let key: string;
  for (key in obj2) {
    // 如果target(也就是obj1[key])存在，且是对象的话再去调用deepMerge，否则就是obj1[key]里面没这个对象，需要与obj2[key]合并
    // 如果obj2[key]没有值或者值不是对象，此时直接替换obj1[key]
    obj1[key] =
      obj1[key] &&
      obj1[key].toString() === '[object Object]' &&
      obj2[key] &&
      obj2[key].toString() === '[object Object]'
        ? deepMerge(obj1[key], obj2[key])
        : (obj1[key] = obj2[key]);
  }
  return obj1;
}

// ==================== 颜色转换 ====================

/**
 * 将16进制颜色转换为RGB格式
 * @param str 16进制颜色字符串（如 '#FF0000' 或 '#F00'）
 * @returns RGB对象 { r, g, b, a }，其中a为透明度，默认为1.0（完全不透明）
 */
export const color16ToRgb = (str: string) => {
  var reg = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (!reg.test(str)) {
    return;
  }
  let newStr = str.toLowerCase().replace(/\#/g, '');
  let len = newStr.length;
  if (len == 3) {
    let t = '';
    for (var i = 0; i < len; i++) {
      t += newStr.slice(i, i + 1).concat(newStr.slice(i, i + 1));
    }
    newStr = t;
  }
  let arr: number[] = []; //将字符串分隔，两个两个的分隔
  for (var i = 0; i < 6; i = i + 2) {
    let s = newStr.slice(i, i + 2);
    arr.push(parseInt('0x' + s));
  }

  return {
    r: Number(arr[0]) / 255,
    g: Number(arr[1]) / 255,
    b: Number(arr[2]) / 255,
    a: 1.0, // 默认完全不透明（Figma和MasterGo都支持）
  };
};

// ==================== 节点操作 ====================

/**
 * 克隆节点并可选地修改属性
 * @param node 要克隆的节点
 * @param option 可选的属性修改（如 width, height 等）
 * @returns 克隆后的节点
 */
export const cloneNode = (node: any, option?: any) => {
  const { width, height, ...other } = option || {};
  const clone = node.clone();

  if (width && height) {
    clone.width = width;
    clone.height = height;
  }

  if (other) {
    Object.assign(clone, other);
  }

  return clone;
};

