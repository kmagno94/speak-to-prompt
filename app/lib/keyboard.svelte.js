/* The on-screen keyboard (Build 4). iPhone doesn't shrink the page when the keyboard opens,
   so things pinned to the bottom hide behind it. visualViewport says how much of the screen
   is really showing: the gap under it is the keyboard.
   - kb.inset: px the keyboard covers at the bottom; also set as the CSS var --kb on <html>,
     so anything can sit on top of the keyboard with bottom: var(--kb).
   - kb.open: a real keyboard is up (more than 120px).
   - kb.typing: the thoughts box has the cursor.
   Nothing is saved. Used by the floating Done in My context and the keyboard coach bar. */
export const kb = $state({ inset: 0, open: false, typing: false });

let started = false;
export function watchKeyboard() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const vv = window.visualViewport;
  const update = () => {
    const base = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
    const inset = vv ? Math.max(0, Math.round(base - vv.height - vv.offsetTop)) : 0;
    kb.inset = inset;
    kb.open = inset > 120;
    document.documentElement.style.setProperty('--kb', inset + 'px');
  };
  if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update); }
  window.addEventListener('resize', update);
  const box = document.getElementById('thoughts');
  if (box) {
    box.addEventListener('focus', () => { kb.typing = true; });
    box.addEventListener('blur', () => { kb.typing = false; });
    kb.typing = document.activeElement === box;
  }
  update();
}
