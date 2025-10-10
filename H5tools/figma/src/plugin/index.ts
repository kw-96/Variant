// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
import { addMessageListener, sendMsgToUI, MessageType } from '@/messages';

const messages = []
const messagesContext = require.context('./messages', false, /\.ts$/)
messagesContext.keys().forEach(key => {
  messages.push(messagesContext(key).default)
})

// Runs this code if the plugin is run in Figma
if (figma.editorType === 'figma') {
  // This plugin will open a window to prompt the user to enter a number, and
  // it will then create that many rectangles on the screen.

  // This shows the HTML page in "ui.html".
  figma.showUI(__html__);

  figma.ui.resize(400, 667);

  // 注册消息监听器
  messages.forEach(message => addMessageListener(message.type, message.handler));

  sendMsgToUI(MessageType.SELECTION_CHANGE, figma.currentPage.selection);
  figma.on('selectionchange', () => {
    sendMsgToUI(MessageType.SELECTION_CHANGE, figma.currentPage.selection);
  });
}
