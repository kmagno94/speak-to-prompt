/* Writer's block nudge (idea mvni8bq6ecec): when the box sits still for a bit with a few
   words in it, one playful sentence to finish shows under it. Tap it and it starts a new
   line, so you just keep typing. All on the phone, nothing saved or sent.

   Each line leans on one of the Ghost Coach's five pieces (lib/coach.js), so the first
   one shown aims at something your thoughts don't have yet. "any" lines fit anything. */
export const IDLE_MS = 6000;

export const LINES = [
  { key: 'goal', text: 'The thing I really want is ' },
  { key: 'goal', text: "If this goes well, I'll finally " },
  { key: 'who', text: 'The person this is really for is ' },
  { key: 'who', text: 'The people who will see this are ' },
  { key: 'details', text: 'The part nobody knows yet is ' },
  { key: 'details', text: 'Oh, and one more thing: ' },
  { key: 'limits', text: 'The catch is ' },
  { key: 'limits', text: "I've only got " },
  { key: 'good', text: "I'll know it worked when " },
  { key: 'good', text: "I'd be thrilled if it " },
  { key: 'any', text: 'The hardest part is ' },
  { key: 'any', text: "What I've tried so far: " },
  { key: 'any', text: "Honestly, I'm stuck on " }
];

/* The order to offer lines in: ones for missing pieces first (in the coach's order),
   then the rest. Lines already in the box are skipped. */
export function lineOrder(text, missingKeys) {
  const low = (text || '').toLowerCase();
  const fresh = LINES.filter((l) => !low.includes(l.text.trim().toLowerCase()));
  const first = fresh.filter((l) => missingKeys.includes(l.key));
  first.sort((a, b) => missingKeys.indexOf(a.key) - missingKeys.indexOf(b.key));
  return first.concat(fresh.filter((l) => !missingKeys.includes(l.key)));
}
