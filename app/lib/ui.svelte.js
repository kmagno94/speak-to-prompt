/* Shared, reactive app state. Svelte components read it directly; the original
   page code (app.js) updates it, and the components redraw on their own. */
/* Quick or Normal is remembered on this device (#21), right next to the 4 slider numbers
   (stp-tune). It is a setting, never your words. New prompt keeps it (#23). */
const MODE_KEY = 'stp-mode';
function savedMode() {
  try { const v = localStorage.getItem(MODE_KEY); return v === 'quick' || v === 'normal' || v === 'auto' ? v : null; } catch (e) { return null; }
}
export function saveMode(m) {
  try { if (m === 'quick' || m === 'normal' || m === 'auto') localStorage.setItem(MODE_KEY, m); } catch (e) {}
}
/* Auto (#56, v2.1.43, SPEC LOCKED 11/15 + 11/17): with a key there is no Quick or Normal to
   pick. Read, then the questions (Skip all at the top), then a Flash-Lite write, and the
   Quality check decides what's next. Quick and Normal stay as manual overrides only with dev
   tools on, and for the smoke tests written before Auto (test-only hook, like __openRows). */
export function manualModes() { return typeof window !== 'undefined' && !!window.__manualModes; }
const mode0 = savedMode();
/* Test-only hook (like __checkMaxMs): the smoke tests written before R4 tap Mode and My context
   directly, so they start with Options open. Nothing sets this on the real site. */
export function rowsOpen() { return typeof window !== 'undefined' && !!window.__openRows; }

export const ui = $state({
  mode: mode0 || 'quick',   // 'quick', 'normal' or 'auto' (#56: the only mode with a key). Quick until a key exists (ModePicker), unless picked
  modePicked: !!mode0,      // the person chose a mode themselves (now or on an earlier visit), so it no longer follows the key
  hasKey: false,      // a Gemini key is typed in or saved
  quickResult: false,      // the prompt on screen is the quick version (KeyNudge on the result card)
  keyNudgeHidden: false,   // "Not now" on the Quick mode key line (KeyNudge.svelte). Memory only, back on refresh
  quickSecs: 15,      // Quick mode's usual time, learned from run stats when on
  /* One message per place ('form' under the thoughts box, 'result' on the prompt card),
     shown by Notice.svelte with the shared Message look. app.js sets them with
     notify(); a button's `act` comes back to app.js as a window 'stp-act' event. */
  notices: { form: null, result: null },
  round: null,        // Rework rounds: { n, stage: edit | ask (v2.1.39, the tip's questions) | writing | built, viewing, from, count, max, scores }. Memory only
  compare: null,      // Compare rounds table (lib/compare.js) once 2+ rounds are built. Memory only
  grade: null,        // the Quality check for the prompt on screen: { score, pass, label, tip, working }
  reading: false,     // Read is running on a Normal build, so Switch to Quick can show (v2.1.34)
  goQuick: false,     // Switch to Quick was tapped during Read: this build skips the questions
  /* ⚡ Quick version chip, Build to Ready (#51, v2.1.37). Memory only. */
  build: '',          // which part of a build is running: '' | 'read' | 'write' | 'finish' (Polish and Check)
  quickOn: false,     // this write is already the quick version (Quick mode), so there's nothing to switch to
  switched: false,    // the chip was tapped during Write: the quick model is writing it now
  slow: null,         // from 2:00 on a slow Flash write: { until, total }, the countdown shown on the chip
  statsOn: false,     // Show run stats and daily usage is on (the 👍 Worked great tap only shows then, #5)
  /* R4 Calm first screen (#29, v2.1.42). Starts closed on every load and is never saved. */
  hold: null,         // #56 under 2: the first prompt, kept on screen while a stronger one writes: { text, score }. Memory only
  openCompare: false, // #56: the Stronger version ready note's Compare opens the rounds table
  optionsOpen: rowsOpen()    // the Options chip under the box is open (Mode, the sliders, My context)
});

/* kind: 'empty' | 'error' | 'warn' | 'success' | 'info'. actions: [{ label, act, primary }]
   countdown (optional): { until, total, label, done } shows a live m:ss timer and a draining bar. */
export function notify(where, kind, title, text, actions, countdown) {
  ui.notices[where] = kind ? { kind, title, text: text || '', actions: actions || [], countdown: countdown || null, at: Date.now() } : null;
}
