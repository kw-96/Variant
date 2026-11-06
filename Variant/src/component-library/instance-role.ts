/** 背景实例：「背景」「0-背景」「1_背景」等 */
export function isBackgroundInstanceName(name: string): boolean {
  return /^(?:\d+\s*[-_—–－]\s*)?背景$/.test(
    String(name || '').normalize('NFKC').trim()
  );
}
