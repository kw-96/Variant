export enum MessageType {
  // 存储相关
  STORAGE = 'storage',
  
  // 选择变化
  SELECTION_CHANGE = 'selectionchange',
  
  // H5切图相关
  ONE_CLICK_CUT = 'oneClickCut',
  ONE_CLICK_EXPAND = 'oneClickExpand',
  GEN_EXPAND_PREVIEW = 'genExpandPreview',
  
  // 按钮尺寸拓展相关
  AUTO_GENERATE_BUTTONS = 'autoGenerateButtons',
  GEN_BUTTON_PREVIEW = 'genButtonPreview',
  
  // 资源位相关
  CREATE_FRAMES = 'createFrames',
  AUTO_LAYOUT = 'autoLayout',
  AUTO_ADD_COMPONENT = 'autoAddComponent',
  GET_FRAME = 'getFrame',
  IMPORT_IMAGES = 'importImages',
  CHANGE_TAB = 'changeTab',
}
