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
  
  // 工具箱相关
  ROUND_TO_INTEGER = 'roundToInteger',
  SIMPLE_CONSTRAINT = 'simpleConstraint',
  
  // 导出相关
  EXPORT_IMAGES = 'exportImages',
  FRAME_EXPORT = 'frameExport',
  IMG_EXPORT = 'imgExport',
  
  // 安全区相关
  TOGGLE_SAFE_AREA = 'toggleSafeArea',
  GET_SAFE_AREA_STATUS = 'getSafeAreaStatus',
  SAFE_AREA_STATUS = 'safeAreaStatus',
  
  // 窗口控制相关
  COLLAPSE_WINDOW = 'collapseWindow',
  EXPAND_WINDOW = 'expandWindow',
  WINDOW_STATE_CHANGED = 'windowStateChanged',
  
  // 通知相关
  SHOW_NOTIFY = 'showNotify',

  // 批量按钮
  BATCH_BUTTON_CONVERT = 'batchButtonConvert',
  BATCH_BUTTON_GENERATE = 'batchButtonGenerate',

  // 批量延展
  BATCH_EXTEND_UPLOAD = 'batchExtendUpload',
  BATCH_EXTEND_PROCESS = 'batchExtendProcess',
  BATCH_EXTEND_REQUEST_IMAGE = 'batchExtendRequestImage',
  BATCH_EXTEND_IMAGE_RESPONSE = 'batchExtendImageResponse',
  BATCH_EXTEND_BATCH_RESULT = 'batchExtendBatchResult',

  // 组件库相关
  GET_COMPONENT_LIBRARY = 'getComponentLibrary',
  IMPORT_COMPONENT_BY_UKEY = 'importComponentByUkey',

  // 数据流相关
  DATA_FLOW_PROCESS = 'dataFlowProcess',
}
