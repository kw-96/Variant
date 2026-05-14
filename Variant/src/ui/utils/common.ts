/**
 * 通用工具函数 - 从H5tools提取
 */

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 深拷贝后的对象
 */
export const deepCopy = (obj: any) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 生成随机ID
 * @returns 随机ID字符串
 */
export const generateRandomId = () => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * 列表展示用字母数字混合自然排序（A-Z、0-9 分段连续编号等）。
 * @param a 参与比较的字符串
 * @param b 参与比较的字符串
 * @returns 与 localeCompare 一致：负数表示 a 排在 b 前
 */
export function compareAlphanumeric(a: string, b: string): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  });
}
