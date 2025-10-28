import { FILL_RULE, HEAD_PIC_EXPAND_RULE } from '../../config/rule';

export const getExpandRules = () => {
  return {
    firstPic: {
      rules: [
        {
          text: '向上扩展，色块自定义',
          value: HEAD_PIC_EXPAND_RULE.FILL_TOP_COLOR,
        },
        {
          text: '向下扩展，色块自定义',
          value: HEAD_PIC_EXPAND_RULE.FILL_BOTTOM_COLOR,
        },
        {
          text: '按原图拉伸（上）',
          value: HEAD_PIC_EXPAND_RULE.FILL_TOP_STRETCH,
        },
        {
          text: '按原图拉伸（下）',
          value: HEAD_PIC_EXPAND_RULE.FILL_BOTTOM_STRETCH,
        },
      ],
    },
    otherPic: {
      header: {},
      body: {
        rules: [
          {
            text: '色块填充',
            value: FILL_RULE.FILL_COLOR,
          },
          {
            text: '保留原图拉伸',
            value: FILL_RULE.STRETCH,
          },
        ],
      },
      footer: {},
    },
  };
};

export const getDefaultExpandData = () => {
  return {
    firstPic: {
      expandRule: HEAD_PIC_EXPAND_RULE.FILL_TOP_COLOR,
      fillColor: '#FFA3A3',
      lockNum: 10,
    },
    otherPic: {
      header: {
        lockRatio: 0.25,
      },
      body: {
        expandRule: FILL_RULE.STRETCH,
        fillColor: '#FFA3A3',
      },
      footer: {
        lockRatio: 0.25,
      },
    },
  };
};

