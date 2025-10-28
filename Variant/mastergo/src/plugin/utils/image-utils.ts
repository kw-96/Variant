/**
 * MasterGo 图片工具函数
 * 提供图片填充相关功能
 */

/**
 * 填充图片到节点
 * @param node 目标节点
 * @param img Uint8Array 图片数据
 */
export async function fillTheSelection(node: any, img: Uint8Array): Promise<void> {
  const imageHandle = await mg.createImage(img);
  // 设置图片填充
  node.fills = [
    {
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageRef: imageHandle.href,
    },
  ];
}

/**
 * 填充图片到节点（带滤镜）
 * @param node 目标节点
 * @param img Uint8Array 图片数据
 */
export async function fillTheSelection2(node: any, img: Uint8Array): Promise<void> {
  const imageHandle = await mg.createImage(img);
  // 设置图片填充
  node.fills = [
    {
      type: 'IMAGE',
      imageRef: imageHandle.href,
      filters: {
        contrast: 0,
        exposure: 0,
        highlights: 0,
        hue: 0,
        saturation: -1,
        shadows: 0,
        temperature: 0,
        tint: 0,
      },
      scaleMode: 'TILE',
      alpha: 0.5,
    },
  ];
}

