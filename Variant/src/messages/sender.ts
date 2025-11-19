import { MessageType } from './messageType';

/**
 * 深拷贝消息数据，保留 TypedArray 以支持图片像素数据
 * @param value 消息数据
 * @param cache 循环引用缓存
 */
function cloneMessageData(value: any, cache: WeakMap<object, any> = new WeakMap()): any {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback to manual clone
    }
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (cache.has(value)) {
    return cache.get(value);
  }

  if (ArrayBuffer.isView(value)) {
    const copy = new (value.constructor as any)(value as any);
    return copy;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  if (Array.isArray(value)) {
    const arrCopy = value.map((item) => cloneMessageData(item, cache));
    cache.set(value, arrCopy);
    return arrCopy;
  }

  const objCopy: Record<string, any> = {};
  cache.set(value, objCopy);
  for (const key in value) {
    objCopy[key] = cloneMessageData(value[key], cache);
  }
  return objCopy;
}

/**
 * 向UI发送消息（兼容 Figma / MasterGo）
 */
export const sendMsgToUI = (type: MessageType, data: any = {}) => {
  try {
    if (typeof figma !== 'undefined' && figma?.ui?.postMessage) {
      figma.ui.postMessage({ type, data });
      return;
    }
  } catch {}
  try {
    if (typeof mg !== 'undefined' && mg?.ui?.postMessage) {
      mg.ui.postMessage({ type, data });
      return;
    }
  } catch {}
  try {
    window.parent?.postMessage({ pluginMessage: { type, data } }, '*');
  } catch {}
};

/**
 * 向插件发送消息
 */
export const sendMsgToPlugin = (type: MessageType, data: any = {}) => {
  try {
    const message = { type, data: cloneMessageData(data) };
    parent.postMessage(message, '*');
  } catch (error) {
    console.error('Error sending message to plugin:', error);
  }
};
