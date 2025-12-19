/**
 * 批量命名
 * 对选中的节点进行批量重命名
 */
import { MessageType } from '../../../../../../src/messages';

interface BatchRenameConfig {
  mode: 'fixed' | 'auto';
  position: 'before' | 'after';
  text?: string; // 固定文本模式
  numberType?: 'arabic' | 'chinese-lower' | 'chinese-upper' | 'english-lower' | 'english-upper';
  startNumber?: number;
}

/**
 * 格式化序号
 */
function formatNumber(num: number, type: string): string {
  let result = '';
  
  switch (type) {
    case 'arabic':
      result = String(num);
      break;
    
    case 'chinese-lower':
      result = formatChineseLower(num);
      break;
    
    case 'chinese-upper':
      result = formatChineseUpper(num);
      break;
    
    case 'english-lower':
      result = formatEnglishLower(num);
      break;
    
    case 'english-upper':
      result = formatEnglishUpper(num);
      break;
  }
  
  return result;
}

/**
 * 格式化中文小写数字
 */
function formatChineseLower(num: number): string {
  const map: Record<number, string> = {
    1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
    6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
    11: '十一', 12: '十二', 13: '十三', 14: '十四', 15: '十五',
    16: '十六', 17: '十七', 18: '十八', 19: '十九', 20: '二十',
  };
  if (num <= 20) {
    return map[num] || String(num);
  }
  // 大于20的简单处理
  return String(num);
}

/**
 * 格式化中文大写数字
 */
function formatChineseUpper(num: number): string {
  const map: Record<number, string> = {
    1: '壹', 2: '贰', 3: '叁', 4: '肆', 5: '伍',
    6: '陆', 7: '柒', 8: '捌', 9: '玖', 10: '拾',
    11: '拾壹', 12: '拾贰', 13: '拾叁', 14: '拾肆', 15: '拾伍',
    16: '拾陆', 17: '拾柒', 18: '拾捌', 19: '拾玖', 20: '贰拾',
  };
  if (num <= 20) {
    return map[num] || String(num);
  }
  return String(num);
}

/**
 * 格式化英文小写字母
 */
function formatEnglishLower(num: number): string {
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(96 + num); // a-z
  }
  // 超过26的处理：aa, ab, ...
  let result = '';
  let n = num;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * 格式化英文大写字母
 */
function formatEnglishUpper(num: number): string {
  if (num >= 1 && num <= 26) {
    return String.fromCharCode(64 + num); // A-Z
  }
  let result = '';
  let n = num;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * 处理批量命名
 */
function handler(config: BatchRenameConfig) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection || [];
  if (selection.length === 0) {
    mg.notify('请先选择要重命名的节点', { timeout: 2000 });
    return;
  }

  let renamedCount = 0;
  let currentNumber = config.startNumber || 1;

  for (let i = 0; i < selection.length; i++) {
    const node = selection[i];
    if (!node || !node.name) {
      continue;
    }

    let newName = '';
    const originalName = node.name;

    if (config.mode === 'fixed') {
      // 固定文本模式
      const text = config.text || '';
      if (config.position === 'before') {
        newName = text + originalName;
      } else {
        newName = originalName + text;
      }
    } else {
      // 自动序号模式
      const numberStr = formatNumber(
        currentNumber,
        config.numberType || 'arabic'
      );
      
      if (config.position === 'before') {
        newName = numberStr + originalName;
      } else {
        newName = originalName + numberStr;
      }
      
      currentNumber++;
    }

    // 重命名节点
    try {
      node.name = newName;
      renamedCount++;
    } catch (error) {
      console.warn(`重命名节点失败: ${originalName}`, error);
    }
  }

  if (renamedCount > 0) {
    mg.notify(`成功重命名 ${renamedCount} 个节点`, { timeout: 2000 });
  } else {
    mg.notify('没有节点被重命名', { timeout: 2000 });
  }
}

export default {
  type: MessageType.BATCH_RENAME,
  handler,
};

