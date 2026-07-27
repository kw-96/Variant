import type { IImportCompletePayload } from '../../../component-library/importFailure';

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
    if (successCount > 0) {
      alert(`成功导入 ${successCount} 个组件`);
    }
    return;
  }

  const parts = [
    `成功 ${successCount} 个，失败 ${failCount} 个`,
    failMessage,
    aborted ? '因连续失败过多已中止后续导入' : ''
  ].filter(Boolean);

  alert(parts.join('\n'));
}
