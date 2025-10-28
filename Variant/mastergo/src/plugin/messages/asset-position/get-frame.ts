/**
 * 获取选中元素的尺寸信息
 * 用于反传对象尺寸信息到UI文本框中
 */
import { MessageType } from '../../../../../src/messages';

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    return;
  }

  const selection = currentPage.selection;
  if (!selection || selection.length === 0) {
    mg.notify('请先选择画板', { timeout: 2000 });
    return;
  }

  // 构建尺寸信息字符串
  const frameInfo: string[] = [];
  
  selection.forEach((item: any) => {
    const name = item.name || '未命名';
    const width = item.width || 0;
    const height = item.height || 0;
    
    // 移除名称中的尺寸后缀（例如："首页 1080×1920" -> "首页"）
    const baseName = name.split(String(width))[0].trim();
    frameInfo.push(`${baseName}\t${width}\t${height}\n`);
  });

  // 发送消息到UI
  mg.ui.postMessage({
    type: MessageType.GET_FRAME,
    data: frameInfo,
  });
}

export default {
  type: MessageType.GET_FRAME as any,
  handler,
};

