/**
 * 自动填充组件到画板
 * 从选中元素中找到组件/实例，自动填充到所有选中的画板中
 */
import { MessageType } from '../../../../../src/messages';

function handler() {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection;
  if (selection.length === 0) {
    mg.notify('请先选择画板和组件', { timeout: 2000 });
    return;
  }

  // 查找组件或实例的 id
  const componentItem = selection.find((item: any) => 
    item.type === 'COMPONENT' || item.type === 'INSTANCE'
  );

  if (!componentItem) {
    mg.notify('请先选择一个组件或实例作为模板', { timeout: 2000 });
    return;
  }

  const id = componentItem.id;
  const key = mg.getNodeById(id);

  if (!key) {
    mg.notify('无法找到组件节点', { timeout: 2000 });
    return;
  }

  let filledCount = 0;

  // 遍历所有选中元素
  for (let i = 0; i < selection.length; i++) {
    const item = selection[i];
    
    // 只处理画板（FRAME）
    if (item.type === 'FRAME') {
      // 计算缩放比例（根据画板是横版还是竖版）
      let scale: number;
      if (item.height > item.width) {
        scale = item.height / key.height;
      } else {
        scale = item.width / key.width;
      }

      // 克隆并添加到画板
      item.appendChild(key.clone());

      // 获取刚添加的克隆组件
      const clonedComponent = item.children[item.children.length - 1];

      // 先进行缩放
      clonedComponent.rescale(scale, { scaleCenter: 'CENTER' });

      // 关闭等比例约束（MasterGo 使用 constrainProportions）
      clonedComponent.constrainProportions = false;

      // 调整到画板大小
      clonedComponent.width = item.width;
      clonedComponent.height = item.height;

      // 设置位置
      clonedComponent.x = 0;
      clonedComponent.y = 0;

      filledCount++;
    }
  }

  mg.notify(`成功填充 ${filledCount} 个画板`, { timeout: 2000 });
}

export default {
  type: MessageType.AUTO_ADD_COMPONENT,
  handler,
};
