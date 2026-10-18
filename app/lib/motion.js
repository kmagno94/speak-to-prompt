/* One switch for every animation: Reduce Motion makes changes instant. */
export const reduceMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ms = (n) => (reduceMotion ? 0 : n);
