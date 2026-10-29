/* Auto-grow words box (#32, spec locked 10/28).
   - Empty: the box keeps today's height (the CSS min-height), so the 💡 idea strip fits.
   - Once you type or paste: it fits your words, at least 3 lines, and grows up to about 40% of
     the screen. Past that it scrolls inside, so Build my prompt stays right under your words
     and on screen.
   Plain JS, no saved state. app.js changes the box by code too (paste, ideas, New prompt, Undo)
   and announces it with an "stp:changed" event, so those fit as well. */
export const LINE = 32;                   // the box's line-height in app.css
export const MIN_LINES = 3;
export const CAP = 0.4;                   // share of the screen height

export function growBox(box) {
  /* The tallest the page has been at this width, so the phone keyboard opening (which shrinks the
     window on some browsers) doesn't shrink the cap and make the box jump while you type. */
  let ref = window.innerHeight, refW = window.innerWidth;
  const sync = () => {
    if (window.innerWidth !== refW) { refW = window.innerWidth; ref = window.innerHeight; }
    else ref = Math.max(ref, window.innerHeight);
  };

  function fit() {
    if (!box.value) {
      box.style.height = ''; box.style.minHeight = ''; box.style.overflowY = '';
      return;
    }
    const cs = getComputedStyle(box);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const border = box.offsetHeight - box.clientHeight;
    const floor = MIN_LINES * LINE + pad + border;
    box.style.minHeight = floor + 'px';
    box.style.height = 'auto';            // measure the words themselves
    const want = Math.max(floor, box.scrollHeight + border);
    const cap = Math.max(floor, Math.round(ref * CAP));
    box.style.height = Math.min(want, cap) + 'px';
    box.style.overflowY = want > cap ? 'auto' : 'hidden';
  }

  const onResize = () => { sync(); fit(); };
  box.addEventListener('input', fit);
  box.addEventListener('change', fit);
  box.addEventListener('stp:changed', fit);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  fit();
  return () => {
    box.removeEventListener('input', fit); box.removeEventListener('change', fit); box.removeEventListener('stp:changed', fit);
    window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize);
  };
}
