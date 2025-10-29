/**
 * 导出图片处理器
 * 用于处理"上传所选"和"添加所选"功能
 * 根据UI端的请求收集当前选中元素的帧数据和图片数据
 */
import { MessageType } from '../../../../../src/messages';

interface FrameExportData {
  name: string;
  width: number;
  height: number;
  type: string;
  s: string;
  id: string;
}

interface ExportImagesPayload {
  action: 'new' | 'add';
}

/**
 * 获取节点名称（处理组件名称格式）
 */
function getNodeName(node: any): string {
  let name = node.name || '未命名';
  
  // 如果是组件且有 '=' 分隔符，取后面的部分
  if (name.split('=').length > 1 && node.type === 'COMPONENT') {
    name = name.split('=')[1];
  }
  
  return name;
}

/**
 * 检测图片格式
 * 优先级：pluginData > 节点属性 > 默认jpg
 */
function detectImageType(node: any): string {
  const typeAllow = ['jpg', 'jpeg', 'png', 'webp'];
  
  // 优先检查 pluginData 中的 type
  try {
    const pluginType = (node as any).getPluginData?.('type');
    if (pluginType && pluginType !== '' && typeAllow.includes(pluginType)) {
      return pluginType;
    }
  } catch (e) {
    // getPluginData 可能不存在，忽略
  }
  
  // 检查节点属性：fills为空或圆角不为0或名称包含png -> png
  if (
    (!node.fills || node.fills.length === 0) ||
    (node.bottomLeftRadius || node.bottomRightRadius || node.topLeftRadius || node.topRightRadius) ||
    node.name.split('png').length > 1
  ) {
    return 'png';
  }
  
  return 'jpg';
}

/**
 * 获取压缩大小设置
 * 优先级：pluginData > 名称匹配 > 空
 */
function getCompressionSize(node: any, name: string): string {
  // 优先检查 pluginData 中的 s
  try {
    const pluginS = (node as any).getPluginData?.('s');
    if (pluginS && pluginS !== '') {
      return pluginS;
    }
  } catch (e) {
    // getPluginData 可能不存在，忽略
  }
  
  // 从名称中匹配：如 "xxx 100k" -> "100"
  const nameMatch = name.match(/(\d+)(?=[kK])/);
  if (nameMatch) {
    const size = nameMatch[1];
    // 首次识别成功，保存到 pluginData
    try {
      if (typeof (node as any).setPluginData === 'function') {
        (node as any).setPluginData('s', size);
      }
    } catch (e) {
      // setPluginData 可能失败，忽略
    }
    return size;
  }
  
  return '';
}

function handler(payload: ExportImagesPayload) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    mg.notify('请先选择要导出的元素', { timeout: 2000 });
    return;
  }

  const { action } = payload; // 'new' 或 'add'
  
  // 收集帧数据
  const frameData: FrameExportData[] = [];
  const validNodes: any[] = [];
  
  for (let i = 0; i < selection.length; i++) {
    const node = selection[i];
    
    // 只处理可见且尺寸合理的节点
    if (!node.isVisible || node.width * node.height >= 4096 * 4096) {
      continue;
    }
    
    const name = getNodeName(node);
    const imgType = detectImageType(node);
    const compressionSize = getCompressionSize(node, name);
    
    frameData.push({
      name,
      width: node.width,
      height: node.height,
      type: imgType,
      s: compressionSize,
      id: node.id || '',
    });
    
    validNodes.push(node);
  }
  
  if (frameData.length === 0) {
    mg.notify('没有可导出的元素', { timeout: 2000 });
    return;
  }
  
  // 显示加载提示
  const loading = mg.notify('加载中，请耐心等待~', {
    position: 'top',
    timeout: 30000,
    isLoading: true,
  });
  
  // 第一步：发送帧数据
  mg.ui.postMessage({
    type: 'frameExport',
    data: {
      frameData,
      action,
    },
  });
  
  // 第二步：异步导出图片数据
  setTimeout(() => {
    const imgData: Uint8Array[] = [];
    
    for (let i = 0; i < validNodes.length; i++) {
      const node = validNodes[i];
      try {
        // MasterGo 导出图片（PNG格式，1x缩放）
        if ((node as any).export) {
          imgData.push((node as any).export({ 
            format: 'PNG',
            constraint: { type: 'SCALE', value: 1 }
          }));
        } else {
          // 如果 export 方法不存在，使用空数据占位
          console.warn('节点不支持 export 方法:', node);
          imgData.push(new Uint8Array(0));
        }
      } catch (e) {
        console.error('导出图片失败:', e);
        imgData.push(new Uint8Array(0));
      }
    }
    
    // 发送图片数据
    mg.ui.postMessage({
      type: 'imgExport',
      data: {
        imgData,
        action,
      },
    });
    
    // 关闭加载提示
    loading.cancel();
  }, 100);
}

export default {
  type: MessageType.EXPORT_IMAGES as any,
  handler,
};
