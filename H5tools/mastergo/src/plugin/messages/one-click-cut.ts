import { MessageType } from '../../../../src/messages';

// ==================== H5一键切图 - 一键分割功能 ====================
// 用于"H5一键切图"页面的"一键分割"按钮
// 使用MasterGo基础API实现一键切割
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
  
  const frames: any[] = [];
  let cumulativeY = 0;
  
  // 根据表格数据创建容器
  for (let idx = 0; idx < data.options.length; idx++) {
    const option = data.options[idx];
    
    try {
      // 创建容器
      const frame = mg.createFrame();
      frame.name = `${option.name || data.itemName}-${option.width}x${option.height}`;
      frame.x = selectionX + selectionWidth + 200; // 移动到右侧200px
      frame.y = selectionY + cumulativeY;
      frame.width = Number(option.width);
      frame.height = Number(option.height);
      frame.clipsContent = true; // 设置裁剪超出内容
      frame.fills = []; // 透明背景
      
      // 克隆选中元素
      const clone = selection.clone();
      
      // 先将克隆元素添加到容器中
      frame.appendChild(clone);
      
      // 然后设置克隆元素在容器中的相对位置
      // 由于容器会裁剪，我们需要让克隆元素向上偏移，以显示原始图像的对应部分
      clone.x = 0; // 水平位置对齐容器左边缘
      clone.y = -cumulativeY; // 向上偏移累计高度，显示对应的图像部分
      
      // 将容器添加到页面
      currentPage.appendChild(frame);
      frame.setPluginData('index', idx.toString());
      frames.push(frame);
      
      cumulativeY += Number(option.height);
    } catch (error) {
      mg.notify(`创建第${idx + 1}个容器时出错: ${error}`, { timeout: 5000 });
    }
  }
  
  // 提交撤销历史
  mg.commitUndo();
}

export default {
  type: MessageType.ONE_CLICK_CUT,
  handler,
};
