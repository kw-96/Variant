/**
 * 共享UI库 - 主入口文件
 * 基于H5tools提取的UI组件和样式系统
 */

// 导出所有hooks
export { providePopup, usePopup } from './hooks/usePopup';
export { default as useSetting } from './hooks/useSetting';
export { default as useStandardConfigs } from './hooks/useStandardConfigs';

// 导出所有工具函数
export { deepCopy, generateRandomId } from './utils/common';
export * from './utils/storage';

// 导出所有指令
export { default as inputDblclickSelect } from './directives/input-dblclick-select';

// 导出所有类型定义
export * from './types/ui';

// 导出所有组件
export { default as DataFileDropZone } from './components/DataFileDropZone.vue';
export { default as DraggableList } from './components/DraggableList.vue';
export { default as ConfigSelector } from './components/ConfigSelector.vue';
