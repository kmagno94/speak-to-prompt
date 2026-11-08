/* Hear it speed (v2.1.36, Kevin's ask): picked in More options, remembered on this phone.
   Only the number is saved (stp-hear-rate), never anything typed. 1.5x by default. */
const KEY = 'stp-hear-rate';
export const RATES = [1, 1.25, 1.5, 2];
export const DEFAULT_RATE = 1.5;
function saved() {
  try { const v = Number(localStorage.getItem(KEY)); return RATES.includes(v) ? v : DEFAULT_RATE; } catch (e) { return DEFAULT_RATE; }
}
export const hear = $state({ rate: saved() });
export function setRate(v) {
  if (!RATES.includes(v)) return;
  hear.rate = v;
  try { localStorage.setItem(KEY, String(v)); } catch (e) {}
}
