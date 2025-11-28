import { MessageType } from '../../../../../../src/messages';

/**
 * 批量延展 - 处理表格文件上传
 * @param data.fileName 文件名
 * @param data.data 前端已解析的表格数据（对象数组）
 * @param data.rowCount 数据行数
 * @param data.images 可选，图片数据（文件名 -> Uint8Array）
 * 
 * 表格格式要求：
 * - 第一列：编号（或 id/ID）
 * - 后续列：图层节点命名（text01, text02, image01, image02...）数量不固定
 * - 内容行：编号、文本内容、图片文件名
 * 
 * 数据格式示例：
 * [
 *   { "编号": 1, "text01": "标题", "text02": "描述", "image01": "pic1.png" },
 *   { "编号": 2, "text01": "标题2", "text02": "描述2", "image01": "pic2.png" }
 * ]
 * 
 * 注意：图片数据量大，不存储到 clientStorage，而是在批量处理时直接从消息中传递
 */
async function handler(data: { fileName: string; data: any[]; rowCount: number; images?: Record<string, number[]> }) {
  try {
    // 1. 验证数据
    if (!data || !data.data || !Array.isArray(data.data)) {
      mg.notify('未接收到有效的表格数据', { timeout: 2000 });
      return;
    }

    if (data.data.length === 0) {
      mg.notify('表格数据为空', { timeout: 2000 });
      return;
    }

    // 2. 提取表头（从第一行对象的键）
    const headers = Object.keys(data.data[0]);

    // 3. 验证表格格式
    const validation = validateTableData(data.data, headers);
    
    if (!validation.valid) {
      mg.notify(`表格格式错误: ${validation.error}`, { timeout: 3000 });
      return;
    }

    // 4. 缓存表格数据到插件存储（不包含图片数据，避免数据过大）
    await mg.clientStorage.setAsync('batch_extend_table_data', {
      headers: headers,
      data: data.data,
      fileName: data.fileName,
      hasImages: !!(data.images && Object.keys(data.images).length > 0), // 标记是否有图片
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error('批量延展 - 表格上传失败:', error);
    mg.notify('表格上传失败: ' + (error.message || '未知错误'), { timeout: 3000 });
  }
}

/**
 * 验证表格数据格式
 * 要求：
 * - 第一列必须是"编号"（或 id/ID）
 * - 后续列为图层节点命名（不能为空）
 * - 至少有两列（编号 + 至少一个节点）
 */
function validateTableData(data: any[], headers: string[]): {
  valid: boolean;
  error?: string;
} {
  if (!data || data.length === 0) {
    return {
      valid: false,
      error: '表格数据为空',
    };
  }

  if (!headers || headers.length < 2) {
    return {
      valid: false,
      error: '表格列数不足，至少需要"编号"列和一个图层节点列',
    };
  }

  // 验证第一列是否为"编号"
  const firstHeader = headers[0];
  if (!firstHeader.includes('编号') && firstHeader !== 'id' && firstHeader !== 'ID') {
    return {
      valid: false,
      error: `第一列应为"编号"，当前为"${firstHeader}"`,
    };
  }

  // 验证每行的编号是否存在
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = row[firstHeader];
    
    if (id === undefined || id === null || String(id).trim() === '') {
      return {
        valid: false,
        error: `第 ${i + 2} 行的编号为空`,
      };
    }
  }

  // 验证图层节点列名格式
  const nodeColumns = headers.slice(1);
  for (const col of nodeColumns) {
    if (!col || col.trim() === '') {
      return {
        valid: false,
        error: '存在空的列名',
      };
    }
  }

  return { valid: true };
}

export default {
  type: MessageType.BATCH_EXTEND_UPLOAD,
  handler,
};

