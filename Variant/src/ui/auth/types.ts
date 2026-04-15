/**
 * UI 鉴权链路类型定义。
 */
export type AuthSyncSettings = {
  currentUserId: string;
  currentUserName: string;
  canAccessPlugin: boolean;
};

export type AdminSettingsResponse = {
  success?: boolean;
  allowlistUserNames?: string[];
  message?: string;
};
