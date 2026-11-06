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

// 工具箱功能模块 - 快捷操作
import autoLayout from './messages/toolbox/quick-actions/auto-layout';
import autoAddComponent from './messages/toolbox/quick-actions/auto-add-component';
import roundToInteger from './messages/toolbox/quick-actions/round-to-integer';
import simpleConstraint from './messages/toolbox/quick-actions/simple-constraint';
import batchConvertToComponent from './messages/toolbox/quick-actions/batch-convert-to-component';
import batchWatermark from './messages/toolbox/quick-actions/batch-watermark';

// 工具箱功能模块 - 实用工具
import batchButtonConvert from './messages/toolbox/utility-tools/convert-to-data-flow/batch-button-convert';
import batchButtonGenerate from './messages/toolbox/utility-tools/batch-button-generate';
import batchExtendUpload from './messages/toolbox/utility-tools/batch-extend-upload';
import batchExtendProcess from './messages/toolbox/utility-tools/batch-extend-process';
import batchRename from './messages/toolbox/utility-tools/batch-rename';
import batchSwitchInstance from './messages/toolbox/utility-tools/batch-switch-instance';
import instanceFit from './messages/toolbox/utility-tools/instance-fit';
import dataFlowConvert from './messages/toolbox/utility-tools/convert-to-data-flow/data-flow-convert';
import dataFlowProcess from './messages/toolbox/utility-tools/data-flow-process';

// 组件库功能模块
import getComponentLibrary from './messages/component-library/get-component-library';
import importComponentByUkey from './messages/component-library/import-component-by-ukey';

// H5 功能模块（一键抠图）
import cutout from './messages/h5-cut/cutout';

// 美术工具（由 MG插件移植）
import artTools from './messages/art-tools';

// PSD 转换（由独立插件 psd-2-mastergo 迁移）
import psdConvert from './messages/psd/psd-convert';

// 窗口控制功能模块
import { collapseWindow, expandWindow, resizeWindow } from './messages/window-control';

/**
 * 读取当前用户信息；部分环境在插件刚启动时会短暂返回 Anonymous，做一次短轮询兜底。
 */
async function resolveCurrentUserInfo() {
  const maxRetries = 6;
  const retryDelayMs = 200;
  for (let i = 0; i <= maxRetries; i++) {
    const user = mg.currentUser;
    const userId = String(user?.id || '');
    const userName = String(user?.name || '').trim() || 'Anonymous';
    if (userId || userName !== 'Anonymous') {
      return { currentUserId: userId, currentUserName: userName };
    }
    if (i < maxRetries) {
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return { currentUserId: '', currentUserName: 'Anonymous' };
}

// 注册所有消息处理器（部分模块导出处理器数组，concat 统一展开一层）
const messages: any[] = ([] as any[]).concat(
  // 基础设施
  clientStorage,
  showNotify,

  // 资源位
  createFrames,
  getFrame,
  importImages,
  exportImages,
  toggleSafeArea,

  // 工具箱
  autoLayout,
  autoAddComponent,
  roundToInteger,
  simpleConstraint,
  batchConvertToComponent,
  batchWatermark,
  batchButtonConvert,
  batchButtonGenerate,
  batchExtendUpload,
  batchExtendProcess,
  batchRename,
  batchSwitchInstance,
  instanceFit,
  dataFlowConvert,
  dataFlowProcess,
  getComponentLibrary,
  importComponentByUkey,

  // H5（一键抠图）
  cutout,

  // 窗口控制
  collapseWindow,
  expandWindow,
  resizeWindow,

  // 美术工具
  artTools,

  // PSD 转换
  psdConvert,
);

// Runs this code if the plugin is run in MasterGo
// MasterGo 会自动注入 __html__ 全局变量，包含 manifest.json 中 ui 字段指向的文件内容

try {
  // 不自动打开面板，只在用户点击"打开面板"菜单项时打开
  // mg.showUI(__html__); // 已移除自动打开

  // MasterGo 插件主线程使用 mg.ui.onmessage 接收来自 UI 的消息
  // 注意：只有在调用 mg.showUI() 后，mg.ui.onmessage 才会生效
  // 但为了支持菜单命令不打开面板，我们延迟初始化 UI 消息监听
  let uiMessageHandlerInitialized = false;
  
  const initializeUIMessageHandler = () => {
    if (uiMessageHandlerInitialized) return;
    uiMessageHandlerInitialized = true;
    
    mg.ui.onmessage = async (rawMsg: any) => {
    const normalizedMsg = rawMsg?.pluginMessage ?? rawMsg;
    const { type, data } = normalizedMsg || {};
    
    if (!type) {
      return;
    }

    if (type === MessageType.GET_CURRENT_USER) {
      const currentUserInfo = await resolveCurrentUserInfo();
      mg.ui.postMessage({
        type: MessageType.CURRENT_USER_RESULT,
        data: {
          requestId: data?.requestId || '',
          success: true,
          settings: {
            ...currentUserInfo,
            canAccessPlugin: false
          }
        }
      });
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
  };

  // 如果面板已经打开（例如从其他方式打开），初始化消息处理器
  // 否则等待"打开面板"命令时再初始化
  try {
    if ((mg as any).ui) {
      initializeUIMessageHandler();
    }
  } catch (e) {
    // UI 未初始化，等待打开面板时再初始化
  }

  const pushSelection = () => {
    const currentPage = (mg as any).document?.currentPage;
    const selection: any[] = currentPage?.selection || [];
    // 只传轻量字段，避免每次选择变化都序列化整棵节点
    sendMsgToUI(
      MessageType.SELECTION_CHANGE,
      selection.map((node: any) => ({ id: node.id, type: node.type, name: node.name }))
    );
  };

  // 监听页面变化事件
  mg.on('currentpagechange', pushSelection);

  // 监听选择变化事件
  mg.on('selectionchange', pushSelection);
  
  // 处理菜单命令的通用函数
  const handleMenuCommand = (payload: any) => {
    // 兼容多种事件格式：字符串或对象
    const command =
      typeof payload === 'string'
        ? payload
        : payload?.command || payload?.name || payload?.type || payload?.action || '';

    // 将 kebab-case 命令转换为 camelCase MessageType
    const commandToMessageType: Record<string, string> = {
      open: 'open',
      'auto-add-component': MessageType.AUTO_ADD_COMPONENT,
      'auto-layout': MessageType.AUTO_LAYOUT,
      'round-to-integer': MessageType.ROUND_TO_INTEGER,
      'simple-constraint': MessageType.SIMPLE_CONSTRAINT,
      'batch-convert-to-component': MessageType.BATCH_CONVERT_TO_COMPONENT,
      'toggle-safe-area': MessageType.TOGGLE_SAFE_AREA,
    };

    // 直接点击插件（无子菜单）或「打开面板」命令：打开面板
    if (command === 'open' || command === '') {
      // 打开面板命令
      mg.showUI(__html__, { width: 405, height: 680 });
      // 初始化 UI 消息处理器（如果尚未初始化）
      initializeUIMessageHandler();
      return;
    }

    const messageType = commandToMessageType[command];
    if (!messageType) {
      return;
    }

    // 其他命令：只执行功能，不打开面板
    // 注意：这些命令不会调用 mg.showUI()，因此不会打开面板
    const messageHandler = messages.find((m: any) => m.type === messageType);
    if (messageHandler && messageHandler.handler) {
      try {
        (messageHandler.handler as () => void)();
      } catch (error: any) {
        console.error('Error executing menu command handler:', error);
      }
    }
  };

  // 监听菜单命令（MasterGo 官方支持 run 事件）
  mg.on('run', handleMenuCommand);

  // 立即发送初始选择状态
  pushSelection();
  
} catch (error) {
  console.error('MasterGo plugin initialization error:', error);
}