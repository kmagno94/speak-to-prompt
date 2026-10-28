/* Motion kit (#28, built into the Next step dock): one set of speeds and one easing curve for
   every animation, so the app moves like one thing instead of a pile of effects.
   The same numbers live in app.css as --dur-fast (taps), --dur-reveal and --dur-scroll.
   One switch for every animation: Reduce Motion makes changes instant (things jump or fade,
   never slide). */
export const reduceMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ms = (n) => (reduceMotion ? 0 : n);
export const SPEED = { tap: 150, reveal: 250, scroll: 400 };
export const EASE = 'cubic-bezier(.2, .8, .2, 1)';
