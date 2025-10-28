/**
 * 图片导入处理
 * 处理大图裁剪并拼接导入
 */
import { MessageType } from '../../../../../src/messages';
import { fillTheSelection } from '../../utils/image-utils';

// 导入状态
let importNum = 0;
let xx = 0;
let yy = 0;
let time = 0;
let ww = 0;
let hh = 0;

/**
 * 设置导入数量
 */
function handleImportNum(num: number) {
  importNum = num;
  xx = 0;
  yy = 0;
  time = 0;
  ww = 0;
  hh = 0;
}

/**
 * 处理像素图片导入
 * @param data 切片数据数组
 */
async function handlePixelIm(data: any[]) {
  const loading = mg.notify('文件较大时会卡顿，请耐心等待', {
    position: 'bottom',
    timeout: 2000,
  });

  const currentPage = (mg as any).document?.currentPage;
  const viewX = currentPage.viewport?.bounds?.x || 0;
  const viewY = currentPage.viewport?.bounds?.y || 0;

  let x = viewX + xx;
  let y = viewY + yy;

  const nodes: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const pixels = mg.createRectangle();
    pixels.x = x + data[i].x;
    pixels.y = y + data[i].y;
    pixels.width = data[i].w;
    pixels.height = data[i].h;
    pixels.name = data[i].name;

    // 填充图片
    await fillTheSelection(pixels, data[i].img);

    // 如果是最后一个切片，创建组
    if (i === data.length - 1) {
      // 获取第一个切片的位置
      const firstNode = nodes[nodes.length - data.length + 1];
      const group = mg.group([firstNode]);
      group.name = data[i].name.split('-')[0];

      // 将其他切片添加到组中
      for (let ii = 1; ii < data.length; ii++) {
        firstNode.appendChild(nodes[nodes.length - data.length + 1 + ii]);
      }

      currentPage.selection = [firstNode];
    }

    nodes.push(pixels);
  }

  xx += data[0].w + 20;
  time++;
  if (hh < data[0].h) {
    hh = data[0].h;
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

