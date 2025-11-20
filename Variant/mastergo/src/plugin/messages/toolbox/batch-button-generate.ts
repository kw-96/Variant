// 批量生成按钮
import { MessageType } from '../../../../../src/messages';

interface GenerateData {
  lines?: string[];
}

function handler(data: GenerateData) {
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    mg.notify('当前页面不可用', { timeout: 2000 });
    return;
  }

  const selection = currentPage.selection || [];
  if (selection.length === 0) {
    mg.notify('请先选择名为“数据流”的分组', { timeout: 2000 });
    return;
  }

  const targetGroup = selection[0];
  if (targetGroup.name !== '数据流') {
    mg.notify('请选择名为“数据流”的容器', { timeout: 2000 });
    return;
  }

  if (targetGroup.type !== 'FRAME') {
    mg.notify('请选择“数据流”容器（Frame）', { timeout: 2000 });
    return;
  }

  const lines =
    data?.lines?.map(line => line.trim()).filter(line => line.length > 0) ||
    [];

  if (lines.length === 0) {
    mg.notify('请输入至少一行文本', { timeout: 2000 });
    return;
  }

  const children = targetGroup.children || [];
  const templateInstance = children.find(
    (child: any) => child.type === 'INSTANCE'
  );

  if (!templateInstance) {
    mg.notify('“数据流”分组中缺少实例，请重新转为数据流', {
      timeout: 2000,
    });
    return;
  }

  const templateSource =
    templateInstance.mainComponent || templateInstance.component ||
    templateInstance;

  if (!templateSource) {
    mg.notify('无法获取组件实例，请重新转为数据流', { timeout: 2000 });
    return;
  }

  const otherNodes = children.filter((child: any) => child !== templateInstance);
  otherNodes.forEach((node: any) => node?.remove?.());

  const instances: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    let instance: any = null;
    if (i === 0) {
      instance = templateInstance;
    } else if (templateSource.createInstance) {
      instance = templateSource.createInstance();
      targetGroup.appendChild(instance);
    } else if (typeof templateInstance.clone === 'function') {
      instance = templateInstance.clone();
      targetGroup.appendChild(instance);
    } else {
      mg.notify('无法复制实例，请重新尝试', { timeout: 2000 });
      return;
    }

    if (!instance) {
      mg.notify('实例创建失败，请检查组件是否有效', { timeout: 2000 });
      return;
    }

    const textValue = lines[i];
    applyTextProperty(instance, textValue);

    instances.push(instance);
  }

  instances.forEach(instance => {
    instance.x = 0;
    instance.y = 0;
  });

  currentPage.selection = [targetGroup];
  mg.notify(`已生成 ${lines.length} 个按钮`, { timeout: 2000 });
}

function applyTextProperty(instance: any, value: string) {
  if (!instance) return;
  const textNodes = collectTextNodes(instance);
  if (textNodes.length === 0) {
    mg.notify('实例中未找到文本图层', { timeout: 2000 });
    return;
  }

  if (textNodes.length > 1) {
    mg.notify('实例中存在多个文本图层，请保持只有一个', { timeout: 2000 });
    return;
  }

  const textNode = textNodes[0];
  if (textNode) {
    try {
      textNode.characters = value;
    } catch (error) {
      // ignored
    }
  }
}

function collectTextNodes(node: any): any[] {
  const result: any[] = [];
  if (!node) return result;

  const walk = (target: any) => {
    if (!target) return;

    if (target.type === 'TEXT') {
      result.push(target);
      return;
    }

    if (!target.children || target.children.length === 0) return;

    for (let i = 0; i < target.children.length; i++) {
      walk(target.children[i]);
    }
  };

  walk(node);
  return result;
}

export default {
  type: MessageType.BATCH_BUTTON_GENERATE,
  handler,
};

