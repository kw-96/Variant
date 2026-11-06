/**
 * 图片切片工具
 * 负责将大图片裁剪为指定尺寸的切片
 */

/**
 * 切片区域类型定义
 */
export interface SliceArea {
  w: number; // 宽度
  h: number; // 高度
  x: number; // X坐标
  y: number; // Y坐标
}

/**
 * 裁剪图片为指定最大尺寸的切片
 * @param w 图片宽度
 * @param h 图片高度
 * @param maxSize 切片最大尺寸（默认4096）
 * @returns 切片区域数组
 */
export function creCutArea(w: number, h: number, maxSize: number = 4096): SliceArea[] {
  // 原图总宽高按整数像素处理，作为切割的基准
  const W = Math.round(w);
  const H = Math.round(h);
  const cuts: SliceArea[] = [];

  // 如果图片尺寸小于maxSize，直接返回单个整数切片
  if (W <= maxSize && H <= maxSize) {
    return [{ w: W, h: H, x: 0, y: 0 }];
  }

  // 计算需要切片的行列数
  const cols = Math.ceil(W / maxSize);
  const rows = Math.ceil(H / maxSize);

  // 除最后一列/最后一行外，统一使用整数像素的基准尺寸与整数位置
  const baseW = Math.ceil(W / cols);
  const baseH = Math.ceil(H / rows);

  for (let row = 0; row < rows; row++) {
    const isLastRow = row === rows - 1;
    // 整数像素位置
    const y = baseH * row;
    // 最后一行高度 = 原图总高 - 前面切片累计高度（吸收余数）
    const sliceH = isLastRow ? H - baseH * (rows - 1) : baseH;

    for (let col = 0; col < cols; col++) {
      const isLastCol = col === cols - 1;
      // 整数像素位置
      const x = baseW * col;
      // 最后一列宽度 = 原图总宽 - 前面切片累计宽度（吸收余数）
      const sliceW = isLastCol ? W - baseW * (cols - 1) : baseW;

      cuts.push({ w: sliceW, h: sliceH, x, y });
    }
  }

  return cuts;
}

/**
 * 裁剪图片为切片
 * @param file 图片文件
 * @param maxSize 切片最大尺寸（默认4096）
 * @returns 包含切片图片数据和切片区域信息的对象
 */
export async function cutImgToCanvas(
  file: File,
  maxSize: number = 4096
): Promise<{ imgs: Uint8Array[]; cuts: SliceArea[] }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('无法获取canvas上下文'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // 计算切片
        const cuts = creCutArea(img.width, img.height, maxSize);
        const cutImgs: Uint8Array[] = [];

        cuts.forEach((cut) => {
          // 源文件裁剪坐标与裁剪尺寸强制使用整数像素，保证像素级精确切割
          const cropX = Math.round(cut.x);
          const cropY = Math.round(cut.y);
          const cropW = Math.round(cut.w);
          const cropH = Math.round(cut.h);

          const canvas2 = document.createElement('canvas');
          canvas2.width = cropW;
          canvas2.height = cropH;
          const ctx2 = canvas2.getContext('2d');

          if (ctx2) {
            ctx2.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const dataURL = canvas2.toDataURL('image/png');
            const base64 = dataURL.split(',')[1];
            const imgData = new Uint8Array(
              atob(base64)
                .split('')
                .map((c) => c.charCodeAt(0))
            );
            cutImgs.push(imgData);
          }
        });

        resolve({ imgs: cutImgs, cuts });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

