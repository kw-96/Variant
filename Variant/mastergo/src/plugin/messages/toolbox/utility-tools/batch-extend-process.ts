import { MessageType, sendMsgToUI } from '../../../../../../src/messages';
import { fillTheSelection } from '../../../utils/image-utils';

// 存储等待图片响应的 Promise resolvers
const pendingImageRequests = new Map<string, {
  resolve: (value: Uint8Array | null) => void;
  timeoutId: NodeJS.Timeout;
}>();

// 记录一次批量操作中创建的节点 id
const createdNodeIdPool: string[] = [];
const rowInstanceMap = new Map<number, string>();
let templateNodeId: string | null = null;
let cachedNodeColumns: string[] = [];
let primaryColumnName: string | null = null;
let cachedImageFileNames: string[] = [];
let sessionTotalRows = 0;

const LAYOUT_CONFIG = {
  columnGap: 100,
  rowGap: 100,
  itemsPerRow: 10,
  verticalOffset: 100,
};

type BatchExtendAction = 'prepare' | 'fillText' | 'fillImages' | 'finalize';

function resetSessionState() {
  templateNodeId = null;
  cachedNodeColumns = [];
  createdNodeIdPool.length = 0;
  primaryColumnName = null;
  cachedImageFileNames = [];
  sessionTotalRows = 0;
  rowInstanceMap.clear();
}

/**
 * 处理图片响应
 */
function handleImageResponse(data: {
  fileName: string;
  success: boolean;
  data?: number[];
  error?: string;
}) {
  const pending = pendingImageRequests.get(data.fileName);
  if (!pending) {
    return;
  }
  
  // 清除超时
  clearTimeout(pending.timeoutId);
  
  // 移除pending请求
  pendingImageRequests.delete(data.fileName);
  
  // 解析Promise
  if (data.success && data.data) {
    const imageData = new Uint8Array(data.data);
    pending.resolve(imageData);
    // 清空原始数据引用，帮助GC
    data.data = undefined;
  } else {
    pending.resolve(null);
  }
}

/**
 * 请求加载图片
 * @param fileName 图片文件名
 * @returns 图片数据的 Uint8Array，如果加载失败返回 null
 */
async function requestImageData(fileName: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    // 设置超时（10秒）
    const timeoutId = setTimeout(() => {
      pendingImageRequests.delete(fileName);
      resolve(null);
    }, 10000);
    
    // 存储 resolver
    pendingImageRequests.set(fileName, { resolve, timeoutId });
    
    // 向前端发送请求
    sendMsgToUI(MessageType.BATCH_EXTEND_REQUEST_IMAGE, { fileName });
  });
}

/**
 * 批量延展 - 执行批量操作
 * 根据上传的表格数据和选中的组件进行批量延展
 * @param payload 包含表格数据和图片文件名列表的消息载荷
 */
async function handler(payload: { 
  action?: BatchExtendAction;
  data?: any[]; 
  headers?: string[]; 
  fileName?: string; 
  imageFileNames?: string[];
  rowIndex?: number;
  totalRows?: number;
  rowData?: Record<string, any>;
  columns?: string[];
}) {
  try {
    const action: BatchExtendAction = payload.action || 'prepare';
    switch (action) {
      case 'prepare':
        await handlePrepareClone(payload);
        break;
      case 'fillText':
        await handleFillText(payload);
        break;
      case 'fillImages':
        await handleFillImages(payload);
        break;
      case 'finalize':
        await handleFinalize(payload);
        break;
      default:
        sendStageResult('prepare', false, {
          error: '未知的操作阶段',
          rowIndex: payload.rowIndex ?? 0,
          totalRows: payload.totalRows ?? 0,
        });
    }
  } catch (error: any) {
    mg.notify('批量延展失败: ' + (error.message || '未知错误'), { timeout: 3000 });
    resetSessionState();
    sendMsgToUI(MessageType.BATCH_EXTEND_BATCH_RESULT, {
      stage: payload?.action || 'prepare',
      rowIndex: payload?.rowIndex ?? 0,
      totalRows: payload?.totalRows ?? 1,
      success: false,
      error: error.message || '未知错误',
      createdCount: 0,
    });
  }
}

/**
 * 验证模板节点是否包含所有需要的图层
 */
function validateTemplateNode(
  node: any,
  requiredLayers: string[]
): {
  valid: boolean;
  error?: string;
  missingLayers?: string[];
} {
  // 收集模板节点中的所有子节点名称
  const layerNames = new Set<string>();
  
  function collectLayerNames(n: any) {
    if (!n) return;
    if (n.name) layerNames.add(n.name);
    
    if (n.children && n.children.length > 0) {
      for (const child of n.children) {
        collectLayerNames(child);
      }
    }
  }
  
  collectLayerNames(node);
  
  // 检查是否包含所有必需的图层
  const missingLayers = requiredLayers.filter(layer => !layerNames.has(layer));
  
  if (missingLayers.length > 0) {
    return {
      valid: false,
      error: `模板中缺少以下图层: ${missingLayers.join(', ')}`,
      missingLayers,
    };
  }
  
  return { valid: true };
}

async function handlePrepareClone(payload: {
  headers?: string[];
  rowIndex?: number;
  totalRows?: number;
  rowData?: Record<string, any>;
  imageFileNames?: string[];
}) {
  const rowIndex = payload.rowIndex ?? 0;
  const totalRows = payload.totalRows ?? 0;
  const rowData = payload.rowData || {};
  sessionTotalRows = totalRows;

  if (!primaryColumnName) {
    if (!payload.headers || payload.headers.length === 0) {
      sendStageResult('prepare', false, {
        rowIndex,
        totalRows,
        error: '缺少表头信息，无法初始化模板',
      });
      return;
    }
    primaryColumnName = payload.headers[0];
    cachedNodeColumns = payload.headers.slice(1);
    cachedImageFileNames = payload.imageFileNames || [];
    createdNodeIdPool.length = 0;
  }

  const templateInfo = ensureTemplateNode(payload.headers);
  if (!templateInfo.success) {
    sendStageResult('prepare', false, {
      rowIndex,
      totalRows,
      error: templateInfo.error,
    });
    return;
  }

  const { templateNode, currentPage } = templateInfo;
  let instance: any = null;

  try {
    instance = cloneFromTemplate(templateNode);
    if (!instance) {
      sendStageResult('prepare', false, {
        rowIndex,
        totalRows,
        error: '创建实例失败',
      });
      return;
    }

    const numberValue = primaryColumnName ? rowData[primaryColumnName] : undefined;
    if (numberValue !== undefined && numberValue !== null) {
      instance.name = String(numberValue);
    }

    applyLayout(instance, templateNode, rowIndex);
    currentPage.appendChild(instance);
    rowInstanceMap.set(rowIndex, instance.id);
    createdNodeIdPool.push(instance.id);

    await delay(50);

    sendStageResult('prepare', true, {
      rowIndex,
      totalRows,
      createdId: instance.id,
    });
  } catch (error: any) {
    sendStageResult('prepare', false, {
      rowIndex,
      totalRows,
      error: error.message || '实例创建失败',
    });
  } finally {
    instance = null;
  }
}

async function handleFillText(payload: {
  rowIndex?: number;
  rowData?: Record<string, any>;
  columns?: string[];
  totalRows?: number;
}) {
  const rowIndex = payload.rowIndex ?? 0;
  const totalRows = payload.totalRows ?? sessionTotalRows;

  const instance = getInstanceByRow(rowIndex);
  if (!instance) {
    sendStageResult('fillText', false, {
      rowIndex,
      totalRows,
      error: '未找到对应的实例节点',
    });
    return;
  }

  const columns = payload.columns && payload.columns.length > 0
    ? payload.columns
    : Object.keys(payload.rowData || {});

  try {
    await applyTextUpdates(instance, payload.rowData || {}, columns);
    await delay(30);
    sendStageResult('fillText', true, {
      rowIndex,
      totalRows,
    });
  } catch (error: any) {
    sendStageResult('fillText', false, {
      rowIndex,
      totalRows,
      error: error.message || '文本填充失败',
    });
  }
}

async function handleFillImages(payload: {
  rowIndex?: number;
  rowData?: Record<string, any>;
  columns?: string[];
  totalRows?: number;
}) {
  const rowIndex = payload.rowIndex ?? 0;
  const totalRows = payload.totalRows ?? sessionTotalRows;
  const instance = getInstanceByRow(rowIndex);

  if (!instance) {
    sendStageResult('fillImages', false, {
      rowIndex,
      totalRows,
      error: '未找到对应的实例节点',
    });
    return;
  }

  const columns = payload.columns && payload.columns.length > 0
    ? payload.columns
    : Object.keys(payload.rowData || {});

  try {
    await applyImageUpdates(instance, payload.rowData || {}, columns);
    await delay(30);
    sendStageResult('fillImages', true, {
      rowIndex,
      totalRows,
    });
  } catch (error: any) {
    sendStageResult('fillImages', false, {
      rowIndex,
      totalRows,
      error: error.message || '图片填充失败',
    });
  }
}

async function handleFinalize(payload: { totalRows?: number }) {
  try {
    const totalRows = payload.totalRows ?? sessionTotalRows;
    const nodes = createdNodeIdPool
      .map(id => mg.getNodeById(id))
      .filter(Boolean);

    if (nodes.length > 0) {
      mg.document.currentPage.selection = nodes;
    }

    console.log(`批量延展完成: 共创建 ${createdNodeIdPool.length} 个节点`);
    mg.notify(`批量延展完成: 共创建 ${createdNodeIdPool.length} 个节点`, { timeout: 3000 });
    await mg.clientStorage.deleteAsync('batch_extend_table_data');

    sendStageResult('finalize', true, {
      rowIndex: 0,
      totalRows,
    });
  } catch (error: any) {
    sendStageResult('finalize', false, {
      rowIndex: 0,
      totalRows: payload.totalRows ?? sessionTotalRows,
      error: error.message || '收尾阶段失败',
    });
  } finally {
    resetSessionState();
  }
}

function ensureTemplateNode(headers?: string[]) {
  const currentPage = mg.document.currentPage;
  if (!currentPage) {
    return { success: false, error: '当前页面不可用' };
  }

  if (templateNodeId) {
    const templateNode = mg.getNodeById(templateNodeId);
    if (templateNode) {
      return { success: true, templateNode, currentPage };
    }
  }

  const selection = currentPage.selection;
  if (!selection || selection.length !== 1) {
    return { success: false, error: '请选择单个模板节点' };
  }

  const templateNode = selection[0];
  if (templateNode.type !== 'COMPONENT' && templateNode.type !== 'INSTANCE') {
    return { success: false, error: '请选择组件或实例作为模板' };
  }

  const columns = headers ? headers.slice(1) : cachedNodeColumns;
  const validationResult = validateTemplateNode(templateNode, columns);
  if (!validationResult.valid) {
    return { success: false, error: validationResult.error || '模板验证失败' };
  }

  templateNodeId = templateNode.id;
  cachedNodeColumns = columns;
  return { success: true, templateNode, currentPage };
}

function cloneFromTemplate(templateNode: any) {
  if (templateNode.type === 'COMPONENT') {
    return templateNode.createInstance();
  }
  return templateNode.clone();
}

function applyLayout(instance: any, templateNode: any, globalIndex: number) {
  const startX = templateNode.x;
  const startY = templateNode.y + templateNode.height + LAYOUT_CONFIG.verticalOffset;
  const rowPos = Math.floor(globalIndex / LAYOUT_CONFIG.itemsPerRow);
  const colPos = globalIndex % LAYOUT_CONFIG.itemsPerRow;

  instance.x = startX + colPos * (instance.width + LAYOUT_CONFIG.columnGap);
  instance.y = startY + rowPos * (instance.height + LAYOUT_CONFIG.rowGap);
}

async function applyTextUpdates(
  instance: any,
  rowData: Record<string, any>,
  columns: string[],
) {
  for (const layerName of columns) {
    const value = rowData[layerName];
    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }

    const targetLayer = findLayerByName(instance, layerName);
    if (!targetLayer || targetLayer.type !== 'TEXT') {
      continue;
    }

    try {
      targetLayer.characters = String(value);
    } catch (error) {
      // 静默处理字体异常
    }
  }
}

async function applyImageUpdates(
  instance: any,
  rowData: Record<string, any>,
  columns: string[],
) {
  for (const layerName of columns) {
    const value = rowData[layerName];
    if (!value) {
      continue;
    }

    const imagePath = String(value);
    const imageName = imagePath.split(/[/\\]/).pop() || imagePath;
    if (!cachedImageFileNames.includes(imageName)) {
      continue;
    }

    const targetLayer = findLayerByName(instance, layerName);
    if (!targetLayer) {
      continue;
    }

    try {
      let imageData = await requestImageData(imageName);
      if (imageData) {
        await fillTheSelection(targetLayer, imageData);
        imageData = null as any;
      }
    } catch (error) {
      // 静默处理图片填充失败
    }
  }
}

function getInstanceByRow(rowIndex: number) {
  const instanceId = rowInstanceMap.get(rowIndex);
  if (!instanceId) {
    return null;
  }
  return mg.getNodeById(instanceId);
}

function sendStageResult(
  stage: BatchExtendAction,
  success: boolean,
  payload: {
    rowIndex?: number;
    totalRows?: number;
    error?: string;
    createdId?: string;
    createdCount?: number;
  },
) {
  sendMsgToUI(MessageType.BATCH_EXTEND_BATCH_RESULT, {
    stage,
    success,
    rowIndex: payload.rowIndex ?? 0,
    totalRows: payload.totalRows ?? sessionTotalRows,
    error: payload.error,
    createdId: payload.createdId,
    createdCount: payload.createdCount,
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 在节点树中查找指定名称的图层
 */
function findLayerByName(node: any, name: string): any | null {
  if (!node) return null;
  
  if (node.name === name) {
    return node;
  }
  
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const found = findLayerByName(child, name);
      if (found) return found;
    }
  }
  
  return null;
}

// 导出两个handler：一个处理批量操作，一个处理图片响应
export default [
  {
    type: MessageType.BATCH_EXTEND_PROCESS,
    handler,
  },
  {
    type: MessageType.BATCH_EXTEND_IMAGE_RESPONSE,
    handler: handleImageResponse,
  },
];

