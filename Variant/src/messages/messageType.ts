// 插件发出的消息
export enum MessageType {
  SELECTION_CHANGE = 'selection_change',
  STORAGE = 'storage',
  NOTIFICATION = 'notification', // 添加通知消息类型
  GENERATE_BUTTONS_RESULT = 'generateButtonsResult', // 添加按钮生成结果消息类型
  ONE_CLICK_CUT = 'cut',
  ONE_CLICK_EXPAND = 'expand',
  AUTO_GENERATE_BUTTONS = 'autoGenerateButtons',
  GENERATE_BUTTONS = 'generateButtons',
  GEN_EXPAND_PREVIEW = 'genExpandPreview',
  GEN_BUTTON_PREVIEW = 'genButtonPreview',
}
