export function lodash_debounce<F extends (...args: any[]) => any>(
  func: F,
  wait: number
): (...args: Parameters<F>) => void {
  let timeout: number | null = null;

  return (...args: Parameters<F>) => {
    if (timeout) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}
