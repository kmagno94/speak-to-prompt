/* Shared, reactive app state. Svelte components read it directly; the original
   page code (app.js) updates it, and the components redraw on their own. */
/* Quick or Normal is remembered on this device (#21), right next to the 4 slider numbers
   (stp-tune). It is a setting, never your words. New prompt keeps it (#23). */
const MODE_KEY = 'stp-mode';
function savedMode() {
  try { const v = localStorage.getItem(MODE_KEY); return v === 'quick' || v === 'normal' ? v : null; } catch (e) { return null; }
}
export function saveMode(m) {
  try { if (m === 'quick' || m === 'normal') localStorage.setItem(MODE_KEY, m); } catch (e) {}
}
const mode0 = savedMode();

export const ui = $state({
  mode: mode0 || 'quick',   // 'quick' or 'normal'. Quick until a key exists (ModePicker), unless picked
  modePicked: !!mode0,      // the person chose a mode themselves (now or on an earlier visit), so it no longer follows the key
  hasKey: false,      // a Gemini key is typed in or saved
  quickSecs: 15,      // Quick mode's usual time, learned from run stats when on
  /* One message per place ('form' under the thoughts box, 'result' on the prompt card),
     shown by Notice.svelte with the shared Message look. app.js sets them with
     notify(); a button's `act` comes back to app.js as a window 'stp-act' event. */
  notices: { form: null, result: null },
  round: null,        // Rework rounds: { n, stage: edit | writing | built, viewing, from, count, max, scores }. Memory only
  compare: null,      // Compare rounds table (lib/compare.js) once 2+ rounds are built. Memory only
  grade: null         // the Quality check for the prompt on screen: { score, pass, label, tip, working }
});

/* kind: 'empty' | 'error' | 'warn' | 'success' | 'info'. actions: [{ label, act, primary }] */
export function notify(where, kind, title, text, actions) {
  ui.notices[where] = kind ? { kind, title, text: text || '', actions: actions || [], at: Date.now() } : null;
}
