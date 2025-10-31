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
  let W = w;
  let H = h;
  let cutW = 1;
  let cutH = 1;
  const cuts: SliceArea[] = [];

  // 如果图片尺寸小于maxSize，直接返回
  if (W <= maxSize && H <= maxSize) {
    return [{ w: W, h: H, x: 0, y: 0 }];
  }

  // 计算需要切片的数量
  cutW = Math.ceil(W / maxSize);
  cutH = Math.ceil(H / maxSize);

  const Ws = Math.ceil(W / cutW);
  const Hs = Math.ceil(H / cutH);
  const lastWs = W - (Ws * (cutW - 1));
  const lastHs = H - (Hs * (cutH - 1));

  let X = 0;
  let Y = 0;

  for (let i = 0; i < cutW * cutH; i++) {
    const isLastRow = Math.floor(i / cutW) === cutH - 1;
    const isLastCol = (i + 1) % cutW === 0;

    let sliceW = isLastCol ? lastWs : Ws;
    let sliceH = isLastRow ? lastHs : Hs;

    cuts.push({ w: sliceW, h: sliceH, x: X, y: Y });

    X += Ws;
    if ((i + 1) % cutW === 0) {
      X = 0;
      Y += Hs;
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
          const canvas2 = document.createElement('canvas');
          canvas2.width = cut.w;
          canvas2.height = cut.h;
          const ctx2 = canvas2.getContext('2d');

          if (ctx2) {
            ctx2.drawImage(canvas, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
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

