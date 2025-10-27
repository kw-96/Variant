import { MessageType } from '../../../../src/messages';
import { genExpandFrame } from '../core';
import { deepMerge } from '../../../../src/plugin/utils';

// 定义FILL_RULE常量
const FILL_RULE = {
  STRETCH: 'stretch',
  FILL_COLOR: 'fill_color'
};

// ==================== H5一键切图 - 一键扩展功能 ====================
// 用于"H5一键切图"页面的"一键扩展"按钮
// 将多个选中元素按表格数据扩展成不同尺寸
// 注意：此功能已被禁用
async function handler(data: any) {
  // 功能已禁用，直接返回
  mg.notify('此功能暂不可用', { timeout: 2000 });
  return;
  
  // 以下代码保留但不会执行
  const loadingNotification = mg.notify('正在处理中，请稍候...', {
    timeout: 10 * 1000,
  });

  const { options, expandData } = data;
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage || !currentPage.selection) {
    mg.notify('请先选择要扩展的元素', { timeout: 3000 });
    return;
  }
  
  const nodes = Array.from(currentPage.selection).sort((a: any, b: any) => {
    return Number(a.getPluginData('index')) - Number(b.getPluginData('index'));
  });

  const position = {
    x: (nodes[0] as any).x + (nodes[0] as any).width + 50,
    y: (nodes[0] as any).y,
  };

  let cumulativeY = position.y;

  await nodes.reduce(async (promise: any, node: any) => {
    await promise;

    const index = node.getPluginData('index');
    const option = options[index];

    if (!option) return;

    let config: any;

    if (Number(index) == 0) {
      config = {
        resize: {
          paddingTop: 0,
          paddingBottom: 0,
        },
        fillConfig: {},
      };

      const [expandRule, direction] = expandData.firstPic.expandRule.split(' ');

      config.resize[direction === 'top' ? 'paddingBottom' : 'paddingTop'] =
        node.height;
      if (expandRule === FILL_RULE.STRETCH) {
        config.resize[direction === 'top' ? 'paddingBottom' : 'paddingTop'] =
          node.height - expandData.firstPic.lockNum;
      }

      config.fillConfig.fillRule = expandRule;
      config.fillConfig.fillColor = expandData.firstPic.fillColor;
    } else {
      config = {
        resize: {
          paddingTop: expandData.otherPic.header.lockRatio * node.height,
          paddingBottom: expandData.otherPic.footer.lockRatio * node.height,
        },
        fillConfig: {
          fillRule: expandData.otherPic.body.expandRule,
          fillColor: expandData.otherPic.body.fillColor,
        },
      };
    }

    await genExpandFrame(
      deepMerge(
        {
          node,
          resize: {
            width: option.width,
            height: option.height,
            name: option.name,
          },
          position: {
            x: position.x,
            y: cumulativeY,
          },
          direction: 'vertical',
        },
        config
      )
    );

    cumulativeY += Number(option.height);

    return promise;
  }, Promise.resolve());

  loadingNotification.cancel();
  mg.notify('处理完成', { timeout: 800 });
}

export default {
  type: MessageType.ONE_CLICK_EXPAND,
  handler,
};
