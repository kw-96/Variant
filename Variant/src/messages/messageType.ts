export enum MessageType {
  // 存储相关
  STORAGE = 'storage',
  
  // 选择变化
  SELECTION_CHANGE = 'selectionchange',
  
  // H5 旧切图能力（MasterGo 端入口已下线；Figma 端仍保留处理器）
  ONE_CLICK_CUT = 'oneClickCut',
  ONE_CLICK_EXPAND = 'oneClickExpand',
  GEN_EXPAND_PREVIEW = 'genExpandPreview',
  GEN_BUTTON_PREVIEW = 'genButtonPreview',

  // 一键抠图相关
  CUTOUT_LOAD = 'cutoutLoad',
  CUTOUT_IMAGES = 'cutoutImages',
  CUTOUT_RESULT = 'cutoutResult',
  CUTOUT_APPLIED = 'cutoutApplied',
  CUTOUT_FLUSH = 'cutoutFlush',
  CUTOUT_FINISHED = 'cutoutFinished',
  
  // 资源位相关
  CREATE_FRAMES = 'createFrames',
  AUTO_LAYOUT = 'autoLayout',
  AUTO_ADD_COMPONENT = 'autoAddComponent',
  GET_FRAME = 'getFrame',
  IMPORT_IMAGES = 'importImages',
  
  // 工具箱相关
  ROUND_TO_INTEGER = 'roundToInteger',
  SIMPLE_CONSTRAINT = 'simpleConstraint',
  BATCH_CONVERT_TO_COMPONENT = 'batchConvertToComponent',
  
  // 导出相关
  EXPORT_IMAGES = 'exportImages',
  
  // 安全区相关
  TOGGLE_SAFE_AREA = 'toggleSafeArea',
  
  // 窗口控制相关
  COLLAPSE_WINDOW = 'collapseWindow',
  EXPAND_WINDOW = 'expandWindow',
  WINDOW_STATE_CHANGED = 'windowStateChanged',
  RESIZE_WINDOW = 'resizeWindow',
  
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
  IMPORT_COMPONENT_COMPLETE = 'importComponentComplete',

  // 数据流相关
  DATA_FLOW_CONVERT = 'dataFlowConvert',
  DATA_FLOW_PROCESS = 'dataFlowProcess',

  // 批量命名相关
  BATCH_RENAME = 'batchRename',

  // 批量切换实例相关
  BATCH_SWITCH_INSTANCES_GET = 'batchSwitchInstancesGet',
  BATCH_SWITCH_INSTANCES_DATA = 'batchSwitchInstancesData',
  BATCH_SWITCH_INSTANCES_APPLY = 'batchSwitchInstancesApply',
  BATCH_SWITCH_INSTANCES_DELETE = 'batchSwitchInstancesDelete',
  BATCH_SWITCH_INSTANCES_RESULT = 'batchSwitchInstancesResult',

  // 实例适配
  INSTANCE_FIT_SELECT = 'instanceFitSelect',
  INSTANCE_FIT_APPLY = 'instanceFitApply',

  // 鉴权链路（仅权限检测）
  GET_CURRENT_USER = 'GET_CURRENT_USER',
  CURRENT_USER_RESULT = 'CURRENT_USER_RESULT',

  // 美术工具（由 MG插件移植）
  APPLY = 'apply',
  RENAME = 'rename',
  PRIZE_GENERATE = 'prizeGenerate',
  RENAME_LAYERS = 'renameLayers',
  TITLE_REPLACE = 'titleReplace',
  TITLE_EXTRACT = 'titleExtract',
  TITLE_EXTRACT_RESULT = 'titleExtractResult',
  CHANNEL_SCAN_START = 'channelScanStart',
  CHANNEL_SCAN_READY = 'channelScanReady',
  CHANNEL_SCAN_ONE = 'channelScanOne',
  CHANNEL_SCAN_ITEM = 'channelScanItem',
  PLUGIN_RESULT = 'pluginResult',
  SELECTION_INFO = 'selectionInfo',
  SELECTION_INFO_REQ = 'selectionInfoReq',

  // 批量水印
  WATERMARK_GET_SELECTION = 'watermarkGetSelection',
  WATERMARK_SELECTION = 'watermarkSelection',
  WATERMARK_APPLY_SELECTION = 'watermarkApplySelection',
  WATERMARK_APPLY_IMAGE = 'watermarkApplyImage',

  // PSD 转换（界面 iframe 与主线程之间的透明转发通道）
  PSD_TO_PLUGIN = 'psdToPlugin',
  PSD_TO_UI = 'psdToUi'
}
