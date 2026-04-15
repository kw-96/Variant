import { onBeforeUnmount, ref } from 'vue';
import { MessageType } from '../../messages';
import type { AuthSyncSettings, AdminSettingsResponse } from './types';

const DEFAULT_SETTINGS: AuthSyncSettings = {
  currentUserId: '',
  currentUserName: 'Anonymous',
  canAccessPlugin: false
};

let adminSettingsEndpoint = 'https://n8n.ds.163.com/webhook/mastergo-layout-admin-settings';

/**
 * 配置 n8n 鉴权 Webhook 地址。
 * @param url 完整 Webhook 地址
 */
export function configureN8nAdminSettingsEndpoint(url: string) {
  adminSettingsEndpoint = url.trim() || adminSettingsEndpoint;
}

/**
 * 权限检测：读取当前用户，并基于 n8n 准入名单校验可访问性。
 */
export function usePluginAuth() {
  const settings = ref<AuthSyncSettings>({ ...DEFAULT_SETTINGS });
  const remoteAdminSettingsUnavailable = ref(false);
  const pendingResolvers = new Map<string, { resolve: (value: AuthSyncSettings) => void; reject: (reason?: unknown) => void }>();

  function handleMessage(event: MessageEvent) {
    const payload = event.data?.pluginMessage ?? event.data;
    if (payload?.type !== MessageType.CURRENT_USER_RESULT) return;
    const requestId = payload?.data?.requestId;
    const resolver = pendingResolvers.get(requestId);
    if (!resolver) return;
    pendingResolvers.delete(requestId);
    settings.value = payload.data.settings || { ...DEFAULT_SETTINGS };
    if (payload.data.success) {
      resolver.resolve(settings.value);
      return;
    }
    resolver.reject(new Error(payload.data.message || '同步配置处理失败'));
  }

  window.addEventListener('message', handleMessage);
  onBeforeUnmount(() => window.removeEventListener('message', handleMessage));

  async function loadSyncSettings() {
    const currentUser = await requestCurrentUser();
    try {
      const remote = await loadAdminSettingsFromWorkflow();
      if (remote?.success === false) {
        remoteAdminSettingsUnavailable.value = true;
        settings.value = { ...currentUser, canAccessPlugin: false };
        return settings.value;
      }
      remoteAdminSettingsUnavailable.value = false;
      const remoteAllowlist = normalizeEntries(Array.isArray(remote.allowlistUserNames) ? remote.allowlistUserNames : []);
      const canAccessPlugin = isAllowlisted(remoteAllowlist, currentUser.currentUserName, currentUser.currentUserId);
      settings.value = { ...currentUser, canAccessPlugin };
      return settings.value;
    } catch {
      remoteAdminSettingsUnavailable.value = true;
      settings.value = { ...currentUser, canAccessPlugin: false };
      return settings.value;
    }
  }

  return { settings, remoteAdminSettingsUnavailable, loadSyncSettings };

  function requestCurrentUser() {
    return new Promise<AuthSyncSettings>((resolve, reject) => {
      const requestId = `auth-current-user-${Date.now()}-${pendingResolvers.size + 1}`;
      const timer = window.setTimeout(() => {
        pendingResolvers.delete(requestId);
        reject(new Error('等待插件返回当前用户信息超时，请重新打开插件后重试。'));
      }, 10000);
      pendingResolvers.set(requestId, {
        resolve: (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        reject: (reason) => {
          window.clearTimeout(timer);
          reject(reason);
        }
      });
      parent.postMessage(
        {
          pluginMessage: {
            type: MessageType.GET_CURRENT_USER,
            data: { requestId }
          }
        },
        '*'
      );
    });
  }
}

async function loadAdminSettingsFromWorkflow() {
  const response = await fetch(adminSettingsEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load-admin-settings' })
  });
  if (!response.ok) throw new Error(`n8n 调用失败，状态码：${response.status}`);
  const raw = await response.json();
  return normalizeAdminSettingsResponse(raw);
}

function normalizeAdminSettingsResponse(raw: unknown): AdminSettingsResponse {
  if (raw == null || typeof raw !== 'object') return {};
  if (Array.isArray(raw) && raw.length > 0) return normalizeAdminSettingsResponse(raw[0]);
  const record = raw as Record<string, unknown>;
  if (record.json && typeof record.json === 'object') return normalizeAdminSettingsResponse(record.json);
  if (record.data && typeof record.data === 'object') return normalizeAdminSettingsResponse(record.data);
  if (record.body && typeof record.body === 'object') return normalizeAdminSettingsResponse(record.body);
  return raw as AdminSettingsResponse;
}

function normalizeEntries(items: string[]) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
}

function isAllowlisted(entries: string[], userName: string, userId: string) {
  const normalizedEntries = entries.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const normalizedUserName = String(userName || '').trim().toLowerCase();
  const normalizedUserId = String(userId || '').trim().toLowerCase();
  return normalizedEntries.indexOf(normalizedUserName) >= 0 || normalizedEntries.indexOf(normalizedUserId) >= 0;
}
