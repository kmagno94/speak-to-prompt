/* Shared, reactive app state. Svelte components read it directly; the original
   page code (app.js) updates it, and the components redraw on their own. */
export const ui = $state({
  mode: 'normal',     // 'quick' or 'normal'
  hasKey: false,      // a Gemini key is typed in or saved
  quickSecs: 15,      // Quick mode's usual time, learned from run stats when on
  /* One message per place ('form' under the thoughts box, 'result' on the prompt card),
     shown by Notice.svelte with the shared Message look. app.js sets them with
     notify(); a button's `act` comes back to app.js as a window 'stp-act' event. */
  notices: { form: null, result: null }
});

/* kind: 'empty' | 'error' | 'warn' | 'success' | 'info'. actions: [{ label, act, primary }] */
export function notify(where, kind, title, text, actions) {
  ui.notices[where] = kind ? { kind, title, text: text || '', actions: actions || [], at: Date.now() } : null;
}
