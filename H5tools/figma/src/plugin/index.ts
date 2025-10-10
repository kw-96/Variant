// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
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

// Runs this code if (globalThis as any).figma exists and is running in Figma
if (typeof (globalThis as any).figma !== 'undefined' && (globalThis as any).figma.editorType === 'figma') {
  const figma = (globalThis as any).figma;

  // This plugin will open a window to prompt the user to enter a number, and
  // it will then create that many rectangles on the screen.

  // This shows the HTML page in "ui.html".
  figma.showUI('index.html');

  figma.ui.resize(400, 667);

  // 注册消息监听器
  messages.forEach(message => addMessageListener(message.type, message.handler));

  sendMsgToUI(MessageType.SELECTION_CHANGE, figma.currentPage.selection);
  figma.on('selectionchange', () => {
    sendMsgToUI(MessageType.SELECTION_CHANGE, figma.currentPage.selection);
  });
}
