// This file holds the main code for plugins. Code in this file has access to
// the *mastergo document* via the mastergo global object.
// You can access browser APIs in the <script> tag inside "index.html" which has a
// full browser environment (See https://mastergo.com/plugin-docs/how-plugins-run).

import { addMessageListener, sendMsgToUI, MessageType } from '../../../src/messages';

// 手动导入所有消息处理器
import autoGenerateButtons from './messages/auto-generate-buttons';
import clientStorage from './messages/client-storage';
import genButtonPreview from './messages/gen-button-preview';
import genExpandPreview from './messages/gen-expand-preview';
import oneClickCut from './messages/one-click-cut';
import oneClickExpand from './messages/one-click-expand';

const messages = [
  autoGenerateButtons,
  clientStorage,
  genButtonPreview,
  genExpandPreview,
  oneClickCut,
  oneClickExpand,
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
  });
  
  // 监听主题变化事件
  mg.on('themechange', (theme: string) => {
    console.log('Theme changed to:', theme);
    mg.ui.postMessage({ type: 'THEME_CHANGE', theme });
  });
  
  // 立即发送初始主题状态
  const initialTheme = (mg as any).themeColor || 'light';
  console.log('Initial theme:', initialTheme);
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