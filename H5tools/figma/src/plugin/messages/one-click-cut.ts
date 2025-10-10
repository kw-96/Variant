import { createObject, cloneNode } from '../utils';
import { MessageType } from '@messages';

function handler(data: any) {
  const selection = figma.currentPage.selection[0];
  
  if (!selection || !selection.absoluteBoundingBox) {
    figma.notify('请选择一个有效的元素', { timeout: 2000 });
    return;
  }

  const {
    width: selectionWidth,
    height: selectionHeight,
    x: selectionX,
    y: selectionY,
  } = selection.absoluteBoundingBox;
  let totalFramesHeight = 0;

  data.options.forEach((option, idx) => {
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
    const group = figma.group([frame], figma.currentPage);
    group.name = frame.name;
    group.setPluginData('index', idx.toString());

    totalFramesHeight += frame.height;
  });
}

export default {
  type: MessageType.ONE_CLICK_CUT,
  handler,
};
