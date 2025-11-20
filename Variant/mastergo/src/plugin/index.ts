// This file holds the main code for plugins. Code in this file has access to
// the *mastergo document* via the mastergo global object.
// You can access browser APIs in the <script> tag inside "index.html" which has a
// full browser environment (See https://mastergo.com/plugin-docs/how-plugins-run).

import { sendMsgToUI, MessageType } from '../../../src/messages';

// ==================== 导入所有消息处理器 ====================
// 按照功能模块分组组织，便于维护和扩展

// 插件通信基础设施
import clientStorage from './messages/client-storage';
import showNotify from './messages/show-notify';

// 资源位功能模块
import createFrames from './messages/asset-position/create-frames';
import getFrame from './messages/asset-position/get-frame';
import importImages from './messages/asset-position/import-images';
import exportImages from './messages/asset-position/export-images';
import toggleSafeArea from './messages/asset-position/toggle-safe-area';
import getSafeAreaStatus from './messages/asset-position/get-safe-area-status';

// 工具箱功能模块
import autoLayout from './messages/toolbox/auto-layout';
import autoAddComponent from './messages/toolbox/auto-add-component';
import roundToInteger from './messages/toolbox/round-to-integer';
import batchButtonConvert from './messages/toolbox/batch-button-convert';
import batchButtonGenerate from './messages/toolbox/batch-button-generate';

// H5切图功能模块
import oneClickCut from './messages/h5-cut/one-click-cut';
import oneClickExpand from './messages/h5-cut/one-click-expand';
import genExpandPreview from './messages/h5-cut/gen-expand-preview';
import autoGenerateButtons from './messages/h5-cut/auto-generate-buttons';
import genButtonPreview from './messages/h5-cut/gen-button-preview';

// 窗口控制功能模块
import { collapseWindow, expandWindow } from './messages/window-control';

// 注册所有消息处理器
const messages = [
  // 基础设施
  clientStorage,
  showNotify,
  
  // 资源位
  createFrames,
  getFrame,
  importImages,
  exportImages,
  toggleSafeArea,
  getSafeAreaStatus,
  
  // 工具箱
  autoLayout,
  autoAddComponent,
  roundToInteger,
  batchButtonConvert,
  batchButtonGenerate,
  
  // H5切图
  oneClickCut,
  oneClickExpand,
  genExpandPreview,
  autoGenerateButtons,
  genButtonPreview,
  
  // 窗口控制
  collapseWindow,
  expandWindow,
];

// Runs this code if the plugin is run in MasterGo
// MasterGo 会自动注入 __html__ 全局变量，包含 manifest.json 中 ui 字段指向的文件内容

try {
  // 直接使用 __html__ 全局变量，不需要声明
  mg.showUI(__html__);

  // MasterGo 插件主线程使用 mg.ui.onmessage 接收来自 UI 的消息
  mg.ui.onmessage = (msg: any) => {
    const { type, data } = msg;
    
    if (!type) {
      return;
    }
    
    // 手动触发对应的消息处理器
    messages.forEach((message: any) => {
      if (message.type === type) {
        try {
          message.handler(data);
        } catch (error: any) {
          console.error('Error executing handler:', error);
        }
      }
    });
  };

  // 监听页面变化事件
  mg.on('currentpagechange', () => {
    const currentPage = (mg as any).document?.currentPage;
    if (currentPage) {
      sendMsgToUI(MessageType.SELECTION_CHANGE, currentPage.selection || []);
    } else {
      sendMsgToUI(MessageType.SELECTION_CHANGE, []);
    }
  });
  
  // 监听选择变化事件
  mg.on('selectionchange', () => {
    const currentPage = (mg as any).document?.currentPage;
    sendMsgToUI(MessageType.SELECTION_CHANGE, currentPage ? currentPage.selection || [] : []);
    
    // 当选择变化时，自动获取安全区状态
    const getSafeAreaStatusHandler = messages.find((m: any) => m.type === MessageType.GET_SAFE_AREA_STATUS);
    if (getSafeAreaStatusHandler) {
      (getSafeAreaStatusHandler.handler as any)();
    }
  });
  
  // 监听主题变化事件
  mg.on('themechange', (theme: string) => {
    mg.ui.postMessage({ type: 'THEME_CHANGE', theme });
  });
  
  // 立即发送初始主题状态
  const initialTheme = (mg as any).themeColor || 'light';
  mg.ui.postMessage({ type: 'THEME_CHANGE', theme: initialTheme });
  
  // 立即发送初始选择状态
  const currentPage = (mg as any).document?.currentPage;
  if (currentPage) {
    sendMsgToUI(MessageType.SELECTION_CHANGE, currentPage.selection || []);
  } else {
    sendMsgToUI(MessageType.SELECTION_CHANGE, []);
  }
  
} catch (error) {
  console.error('MasterGo plugin initialization error:', error);
}