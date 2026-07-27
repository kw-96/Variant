/**
 * 汇总导入失败原因，生成可读提示文案。
 */
export function summarizeImportFailures(
  failedUkeys: Map<string, string> | Record<string, string>
): {
  reasonCounts: Array<{ reason: string; count: number }>;
  message: string;
} {
  const counts = new Map<string, number>();
  const entries =
    failedUkeys instanceof Map
      ? failedUkeys.entries()
      : Object.entries(failedUkeys || {});

  for (const [, reason] of entries) {
    const key = String(reason || '未知错误');
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const reasonCounts = Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const detail = reasonCounts
    .slice(0, 3)
    .map((item) => `${item.reason}×${item.count}`)
    .join('；');

  return {
    reasonCounts,
    message: detail
      ? `失败原因：${detail}${reasonCounts.length > 3 ? ' 等' : ''}`
      : ''
  };
}

/** 导入完成消息载荷 */
export interface IImportCompletePayload {
  success: boolean;
  successCount: number;
  failCount: number;
  failMessage?: string;
  reasonCounts?: Array<{ reason: string; count: number }>;
  aborted?: boolean;
}
