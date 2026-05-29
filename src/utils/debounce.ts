export function debounce<F extends (...args: any[]) => void>(
  func: F,
  wait: number
): ((...args: Parameters<F>) => void) & { cancel: () => void } {
  let timeout: number | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      window.clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
