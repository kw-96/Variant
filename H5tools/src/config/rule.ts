export enum FILL_RULE {
  FILL_COLOR = 'fill_color', // 填充色块
  STRETCH = 'stretch', // 保留原图拉伸
}

export enum HEAD_PIC_EXPAND_RULE {
  FILL_TOP_COLOR = `${FILL_RULE.FILL_COLOR} top`,
  FILL_BOTTOM_COLOR = `${FILL_RULE.FILL_COLOR} bottom`,
  FILL_TOP_STRETCH = `${FILL_RULE.STRETCH} top`,
  FILL_BOTTOM_STRETCH = `${FILL_RULE.STRETCH} bottom`,
}
