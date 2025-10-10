const messageHandlers = {};
let hasListened = false;

const onmessage = event => {
  const { type, data } = event?.data?.pluginMessage || event || {};
  const handlers = messageHandlers[type] || [];

  try {
    handlers.forEach(handler => handler(data));
  } catch (e) {
    console.error(e);
  }
};

export const addMessageListener = (type, handler) => {
  if (!hasListened) {
    try {
      window.addEventListener('message', onmessage);
    } catch (e) {}
    try {
      figma.ui.on('message', onmessage);
    } catch (e) {}
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

export const removeMessageListener = (type, handler) => {
  const handlers = messageHandlers[type] || [];

  handlers.splice(handlers.indexOf(handler), 1);
};

export const clearMessageListener = type => {
  messageHandlers[type] = [];
};
