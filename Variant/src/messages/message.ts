// 全局类型声明
declare global {
  const figma: any;
  const mg: any;
}

const messageHandlers: any = {};
let hasListened = false;

const onmessage = (event: any) => {
  let type, data;
  
  if (event?.data?.pluginMessage) {
    // Figma 风格: event.data.pluginMessage = { type, data }
    ({ type, data } = event.data.pluginMessage);
  } else if (event?.data?.type) {
    // MasterGo 风格: event.data = { type, data }
    ({ type, data } = event.data);
  } else if (event?.type && event?.data !== undefined) {
    // 降级方案: event = { type, data }
    ({ type, data } = event);
  }
  
  const handlers = messageHandlers[type] || [];

  if (handlers.length > 0) {
    try {
      handlers.forEach((handler: any) => {
        handler(data);
      });
    } catch (e) {
      console.error('Error executing handler:', e);
    }
  }
};

export const addMessageListener = (type: any, handler: any) => {
  if (!hasListened) {
    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('message', onmessage);
      } catch (e) {
        console.error('Error adding window message listener:', e);
      }
    }
    
    if (typeof figma !== 'undefined' && figma?.ui?.on) {
      try {
        figma.ui.on('message', onmessage);
      } catch (e) {
        console.error('Error adding figma.ui.on listener:', e);
      }
    }
    
    hasListened = true;
  }
  const handlers = messageHandlers[type];

  if (!handlers) {
    messageHandlers[type] = [handler];
  } else if (!handlers.includes(handler)) {
    handlers.push(handler);
  }

  const removeListener = () => removeMessageListener(type, handler);
  return removeListener;
};

export const removeMessageListener = (type: any, handler: any) => {
  const handlers = messageHandlers[type] || [];

  handlers.splice(handlers.indexOf(handler), 1);
};

export const clearMessageListener = (type: any) => {
  messageHandlers[type] = [];
};
