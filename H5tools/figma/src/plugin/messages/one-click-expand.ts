import { MessageType } from '../../../../src/messages';
import { genExpandFrame } from '../core';
// 定义FILL_RULE常量
const FILL_RULE = {
  STRETCH: 'stretch',
  FILL_COLOR: 'fillColor'
};
import { deepMerge } from '../../../../src/plugin/utils';

async function handler(data: any) {
  const loadingNotification = figma.notify('正在处理中，请稍候...', {
    timeout: 10 * 1000,
  });

  const { options, expandData } = data;
  const nodes = Array.from(figma.currentPage.selection).sort((a: any, b: any) => {
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
  figma.notify('处理完成', { timeout: 800 });
}

export default {
  type: MessageType.ONE_CLICK_EXPAND,
  handler,
};
