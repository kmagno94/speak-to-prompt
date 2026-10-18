/* Shared, reactive app state. Svelte components read it directly; the original
   page code (app.js) updates it, and the components redraw on their own. */
export const ui = $state({
  mode: 'normal',     // 'quick' or 'normal'
  hasKey: false,      // a Gemini key is typed in or saved
  quickSecs: 15       // Quick mode's usual time, learned from run stats when on
});
