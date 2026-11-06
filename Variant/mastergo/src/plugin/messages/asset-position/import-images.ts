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

  // 基准坐标取整，保证所有切片的接缝落在整数像素上，避免亚像素抗锯齿产生分割线
  const baseX = Math.round(centerX - totalWidth / 2 + xx);
  const baseY = Math.round(centerY - totalHeight / 2 + yy);

  const batchNodes: any[] = [];

  for (let i = 0; i < data.length; i++) {
    // 切片相对位置使用整数像素
    const relX = Math.round(data[i].x);
    const relY = Math.round(data[i].y);
    // 判断是否为最后一列/最后一行（拼接边缘）
    const isLastCol = Math.abs(data[i].x + data[i].w - totalWidth) < 1e-6;
    const isLastRow = Math.abs(data[i].y + data[i].h - totalHeight) < 1e-6;
    // 最后一列/行的宽高由“原图总宽高 - 前面切片累计宽高”计算，吸收余数；其余使用整数值
    const sliceW = isLastCol ? totalWidth - relX : Math.round(data[i].w);
    const sliceH = isLastRow ? totalHeight - relY : Math.round(data[i].h);

    const pixels = mg.createRectangle();
    pixels.x = baseX + relX;
    pixels.y = baseY + relY;
    pixels.width = sliceW;
    pixels.height = sliceH;
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

