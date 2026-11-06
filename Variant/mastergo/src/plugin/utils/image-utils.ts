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
