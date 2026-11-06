import type { IImportCompletePayload } from '../../../component-library/importFailure';

/** 延后弹出原生提示框，先让界面把按钮从「导入中」刷新回来，避免 alert 阻塞渲染 */
function notify(message: string) {
  setTimeout(() => alert(message), 50);
}

/**
 * 展示组件导入完成结果（成功/失败汇总）。
 */
export function showImportCompleteResult(data: unknown) {
  const payload = (data || {}) as IImportCompletePayload;
  const successCount = Number(payload.successCount) || 0;
  const failCount = Number(payload.failCount) || 0;
  const failMessage = payload.failMessage || '';
  const aborted = !!payload.aborted;

  if (failCount <= 0 && !failMessage) {
    notify(successCount > 0 ? `成功导入 ${successCount} 个组件` : '没有可导入的普通组件（组件集已自动跳过）。');
    return;
  }

  const parts = [
    `成功 ${successCount} 个，失败 ${failCount} 个`,
    failMessage,
    aborted ? '因连续失败过多已中止后续导入' : ''
  ].filter(Boolean);

  notify(parts.join('\n'));
}
