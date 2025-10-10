import { createObject, cloneNode } from '../utils';
import { MessageType } from '../../../../src/messages';

// ==================== H5一键切图 - 一键分割功能 ====================
// 用于"H5一键切图"页面的"一键分割"按钮
// 根据表格数据将选中元素按比例切割成多个尺寸
function handler(data: any) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage || !currentPage.selection || currentPage.selection.length === 0) {
    mg.notify('请先选择一个元素', { timeout: 3000 });
    return;
  }
  
  const selection = currentPage.selection[0];

  const {
    width: selectionWidth,
    height: selectionHeight,
    x: selectionX,
    y: selectionY,
  } = selection.absoluteBoundingBox;
  let totalFramesHeight = 0;

  data.options.forEach((option: any, idx: number) => {
    if (totalFramesHeight >= selectionHeight) {
      return;
    }

    const frame = createObject('createFrame', {
      name: `${option.name || data.itemName}-${option.width}x${option.height}`,
      x: selectionX + selectionWidth + 50,
      y: selectionY + totalFramesHeight,
      width: selectionWidth,
      height: Math.min(
        selectionHeight - totalFramesHeight,
        Math.floor((selectionWidth / option.width) * option.height)
      ),
      fills: [],
    });

    const clone = cloneNode(selection, {
      x: 0,
      y: -totalFramesHeight,
    });

    frame.appendChild(clone);
    
    // 创建组（MasterGo 需要先添加到页面,然后再创建组）
    currentPage.appendChild(frame);
    const group = mg.group([frame], currentPage);
    group.name = frame.name;
    group.setPluginData('index', idx.toString());

    totalFramesHeight += frame.height;
  });
}

export default {
  type: MessageType.ONE_CLICK_CUT,
  handler,
};
