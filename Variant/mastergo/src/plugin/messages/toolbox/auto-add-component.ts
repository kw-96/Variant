/**
 * 自动填充组件到画板
 * 从选中元素中找到组件/实例，自动填充到所有选中的画板中
 */
import { MessageType } from '../../../../../src/messages';
import { placeTemplateInstance } from '../../utils/component-utils';
import { bringSafeAreasToTop } from '../asset-position/safe-area';

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

  // 查找所有组件或实例
  const componentItems = selection.filter((item: any) => 
    item.type === 'COMPONENT' || item.type === 'INSTANCE'
  );

  if (componentItems.length === 0) {
    mg.notify('请先选择一个组件或实例作为模板', { timeout: 2000 });
    return;
  }

  // 检测到多个组件时提示并阻止操作
  if (componentItems.length > 1) {
    mg.notify('检测到多个组件，请只选择一个组件作为模板', { timeout: 2000 });
    return;
  }

  const componentItem = componentItems[0];

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
      const instance = placeTemplateInstance(item, key, item.width, item.height);
      if (!instance) {
        continue;
      }

      // 确保安全区矩形位于容器最上层（在组件填充之后）
      bringSafeAreasToTop(item);

      filledCount++;
    }
  }

}

export default {
  type: MessageType.AUTO_ADD_COMPONENT,
  handler,
};

