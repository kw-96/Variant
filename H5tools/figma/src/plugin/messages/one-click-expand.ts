import { MessageType } from '@/messages';
import { genExpandFrame } from '@/plugin/core';
import { FILL_RULE } from '@/config/rule';
import { deepMerge } from '../utils';

async function handler(data) {
  const loadingNotification = figma.notify('正在处理中，请稍候...', {
    timeout: 10 * 1000,
  });

  const { options, expandData } = data;
  const nodes = Array.from(figma.currentPage.selection).sort((a, b) => {
    return Number(a.getPluginData('index')) - Number(b.getPluginData('index'));
  });

  const position = {
    x: nodes[0].x + nodes[0].width + 50,
    y: nodes[0].y,
  };

  let cumulativeY = position.y;

  await nodes.reduce(async (promise, node) => {
    await promise;

    const index = node.getPluginData('index');
    const option = options[index];

    if (!option) return;

    let config;

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
