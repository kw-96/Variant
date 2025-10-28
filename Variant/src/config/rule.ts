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

// 存储键名常量
export enum STORAGE_KEY {
  CUT_SIZE = '__cut_size__',
  CUT_SIZE_EXPANSION_SETTING = '__cut_size_expansion_setting__',
  BUTTON_SIZE = '__button_size__',
  BUTTON_SIZE_EXPANSION_SETTING = '__button_size_expansion_setting__',
}
