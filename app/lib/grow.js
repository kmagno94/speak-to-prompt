/* Auto-grow words box (#32, spec locked 10/28).
   - Empty: the box keeps today's height (the CSS min-height), so the 💡 idea strip fits.
   - Once you type or paste: it fits your words, at least 3 lines, and grows up to about 40% of
     the screen. Past that it scrolls inside, so Build my prompt stays right under your words
     and on screen.
   Plain JS, no saved state. app.js changes the box by code too (paste, ideas, New prompt, Undo)
   and announces it with an "stp:changed" event, so those fit as well.
   No jerking (v2.1.28, idea mw6216uhhuaf): it used to set the real box to height:auto to measure
   on every keystroke. That collapsed the box for a moment, reset its inner scroll, and Safari
   snapped the page around to find the cursor, so you lost sight of what you were typing. Now a
   hidden twin box does the measuring, the real box only changes height when the answer changes,
   and only a width change (rotate) refits on resize. Height-only resizes, like Safari's address
   bar sliding while you scroll your results or the keyboard opening, leave the box alone. */
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

  /* The hidden twin: same width, font and padding as the box, off screen, never focusable. */
  let twin = null;
  function measure(cs) {
    if (!twin) {
      twin = document.createElement('textarea');
      twin.setAttribute('aria-hidden', 'true'); twin.tabIndex = -1; twin.id = 'thoughtsTwin';
      twin.style.cssText = 'position:absolute;top:0;left:-9999px;visibility:hidden;pointer-events:none;overflow:hidden;height:0;min-height:0;max-height:none;';
      document.body.appendChild(twin);
    }
    for (const k of ['boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize']) twin.style[k] = cs[k];
    twin.style.width = box.getBoundingClientRect().width + 'px';
    twin.value = box.value;
    return twin.scrollHeight;
  }

  function fit() {
    if (!box.value) {
      box.style.height = ''; box.style.minHeight = ''; box.style.overflowY = '';
      return;
    }
    const cs = getComputedStyle(box);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const border = box.offsetHeight - box.clientHeight;
    const floor = MIN_LINES * LINE + pad + border;
    const want = Math.max(floor, measure(cs) + border);
    const cap = Math.max(floor, Math.round(ref * CAP));
    const h = Math.min(want, cap) + 'px', ov = want > cap ? 'auto' : 'hidden';
    /* Touch the real box only when something changed, so typing inside a full box moves nothing. */
    if (box.style.minHeight !== floor + 'px') box.style.minHeight = floor + 'px';
    if (box.style.height !== h) box.style.height = h;
    if (box.style.overflowY !== ov) box.style.overflowY = ov;
  }

  /* Only a width change refits: Safari's address bar and the keyboard change the height alone. */
  let lastW = window.innerWidth;
  const onResize = () => { sync(); if (window.innerWidth !== lastW) { lastW = window.innerWidth; fit(); } };
  box.addEventListener('input', fit);
  box.addEventListener('change', fit);
  box.addEventListener('stp:changed', fit);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  fit();
  return () => {
    box.removeEventListener('input', fit); box.removeEventListener('change', fit); box.removeEventListener('stp:changed', fit);
    window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize);
    if (twin) { twin.remove(); twin = null; }
  };
}
