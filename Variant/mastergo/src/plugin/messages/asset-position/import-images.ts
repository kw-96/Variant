/**
 * 图片导入处理
 * 处理大图裁剪并拼接导入
 */
import { MessageType } from '../../../../../src/messages';
import { fillTheSelection } from '../../utils/image-utils';

// 导入状态
let xx = 0;
let yy = 0;
let time = 0;
let hh = 0;

/**
 * 设置导入数量
 */
function handleImportNum(_num: number) {
  xx = 0;
  yy = 0;
  time = 0;
  hh = 0;
}

/**
 * 处理像素图片导入
 * @param data 切片数据数组
 */
async function handlePixelIm(data: any[]) {
  if (!data?.length) {
    return;
  }

  const loading = mg.notify('文件较大时会卡顿，请耐心等待', {
    position: 'bottom',
    timeout: 2000,
  });

  const currentPage = (mg as any).document?.currentPage;
  const viewport = (mg as any).viewport ?? currentPage?.viewport;
  const bounds = viewport?.bounds;
  const centerX =
    viewport?.center?.x ??
    (bounds ? bounds.x + bounds.width / 2 : 0);
  const centerY =
    viewport?.center?.y ??
    (bounds ? bounds.y + bounds.height / 2 : 0);

  const totalWidth = data.reduce(
    (max, item) => Math.max(max, item.x + item.w),
    0
  );
  const totalHeight = data.reduce(
    (max, item) => Math.max(max, item.y + item.h),
    0
  );

  const baseX = centerX - totalWidth / 2 + xx;
  const baseY = centerY - totalHeight / 2 + yy;

  const batchNodes: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const pixels = mg.createRectangle();
    pixels.x = baseX + data[i].x;
    pixels.y = baseY + data[i].y;
    pixels.width = data[i].w;
    pixels.height = data[i].h;
    pixels.name = data[i].name;

    // 填充图片
    await fillTheSelection(pixels, data[i].img);

    batchNodes.push(pixels);
  }

  if (batchNodes.length) {
    const group = mg.group(batchNodes);
    group.name = data[0].name.split('-')[0];
    (mg as any).document.currentPage.selection = [group];
  }

  xx += totalWidth + 20;
  time++;
  if (hh < totalHeight) {
    hh = totalHeight;
  }

  if (time % 4 === 0) {
    xx = 0;
    yy += hh;
    hh = 0;
  }

  loading.cancel();
}

export default {
  type: MessageType.IMPORT_IMAGES as any,
  handler: (data: any) => {
    if (typeof data === 'number') {
      handleImportNum(data);
    } else {
      handlePixelIm(data);
    }
  },
};

