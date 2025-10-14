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
