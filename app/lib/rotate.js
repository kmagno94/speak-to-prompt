/* Rotating options, with nothing saved.

   The day is cut into 3-hour windows on your phone's clock (12 to 3, 3 to 6,
   6 to 9, 9 to 12, morning and night). Every window gets its own number, and
   that number seeds a shuffle. Same window, same shuffle, so the options stay
   put while you're using them. New window, new shuffle, so they feel fresh
   next time. No storage needed: the clock is the memory. */
export const WINDOW_HOURS = 3;
export const SHOW = 5;   // options shown at once; smaller lists just show everything

export function windowNumber(now = Date.now()) {
  const local = now - new Date(now).getTimezoneOffset() * 60000;   // line windows up with local time
  return Math.floor(local / (WINDOW_HOURS * 3600000));
}

/* Turns text like "money:0" into a number, so each question shuffles differently. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* A tiny random-number generator that always gives the same sequence for the same seed. */
function seeded(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The options to show for one question right now. `page` is how many times
   "More options" was tapped: each tap shows the next group, then wraps around. */
export function rotating(list, key, page = 0, now = Date.now()) {
  if (list.length <= SHOW) return list.slice();
  const rand = seeded(hash(key + ':' + windowNumber(now)));
  const order = list.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const pages = Math.ceil(order.length / SHOW), start = (page % pages) * SHOW;
  const group = order.slice(start, start + SHOW);
  /* A short last group borrows from the front so there are always SHOW options. */
  return group.length < SHOW ? group.concat(order.slice(0, SHOW - group.length)) : group;
}
