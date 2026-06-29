import { MessageType, sendMsgToUI } from '../../../../../src/messages';
import {
  getCachedCatalog,
  hasBackgroundRefreshDone,
  isCatalogRefreshing,
  markBackgroundRefreshDone,
  refreshCatalogCache,
  setCatalogRefreshing
} from './catalog-loader';

function sendCatalogPayload(components: unknown[], fromCache: boolean) {
  sendMsgToUI(MessageType.GET_COMPONENT_LIBRARY, { components, fromCache });
}

async function refreshInBackground() {
  if (isCatalogRefreshing()) return;
  setCatalogRefreshing(true);
  try {
    const components = await refreshCatalogCache();
    sendCatalogPayload(components, false);
  } catch (error: unknown) {
    const cached = getCachedCatalog();
    if (!cached) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      sendMsgToUI(MessageType.SHOW_NOTIFY, {
        message: `获取组件列表失败: ${errorMsg}`,
        timeout: 3000
      });
      sendCatalogPayload([], false);
    }
  } finally {
    setCatalogRefreshing(false);
  }
}

async function handler(data?: { backgroundRefresh?: boolean }) {
  const cached = getCachedCatalog();
  const shouldRefresh = data?.backgroundRefresh !== false;

  if (cached) {
    sendCatalogPayload(cached, true);
    if (shouldRefresh && !hasBackgroundRefreshDone()) {
      markBackgroundRefreshDone();
      void refreshInBackground();
    }
    return;
  }

  try {
    const components = await refreshCatalogCache();
    markBackgroundRefreshDone();
    if (components.length === 0) {
      sendMsgToUI(MessageType.SHOW_NOTIFY, { message: '未订阅任何团队库或库内暂无组件', timeout: 2000 });
    }
    sendCatalogPayload(components, false);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    sendMsgToUI(MessageType.SHOW_NOTIFY, { message: `获取组件列表失败: ${errorMsg}`, timeout: 3000 });
    sendCatalogPayload([], false);
  }
}

export default {
  type: MessageType.GET_COMPONENT_LIBRARY,
  handler
};
