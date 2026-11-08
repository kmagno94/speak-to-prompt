/* Prompt school, first slice (AGT-4, v2.1.32): one "Move I made" card under the prompt.
   It picks one part X-ray marks as added to help, matches it to one of Ghost Coach's
   5 checks (goal, who, details, limits, good), and explains that move in plain words.
   All on the phone, no Gemini call, nothing saved: it runs fresh on every prompt. */
import { analyze } from './xray.js';
import { CHECKS, assess } from './coach.js';

/* One fixed plain reason per Ghost Coach check. */
export const MOVES = {
  goal: { title: 'I spelled out the goal', why: 'Answers land closer when the AI knows exactly what you want out of it.' },
  who: { title: "I said who it's for", why: 'Answers get way more specific when the AI knows who they are for.' },
  details: { title: 'I asked for the key details', why: 'Details are what turn a generic answer into one that fits you.' },
  limits: { title: 'I set the limits', why: 'Time, budget, and length limits keep the AI from overdoing it.' },
  good: { title: 'I said what a great result looks like', why: 'When the AI can picture the finished thing, it aims right at it.' }
};

/* Does an added part of the prompt do this check's job? Details has its own pattern,
   since Ghost Coach counts words for it, which says nothing about one sentence. */
const DETAILS = /\b(include|specific|details?|mention|cover|exact|each|every)\b/i;
function does(check, text) {
  if (check.key === 'details') return DETAILS.test(text);
  return typeof check.test === 'function' ? check.test(text, text.split(/\s+/).length) : check.test.test(text);
}

/* Teaching order: the moves beginners skip most come first. */
const ORDER = ['who', 'good', 'limits', 'goal', 'details'];
/* When no part matches a check, X-ray's own label can still point to one. */
const FROM_LABEL = { Format: 'good', Example: 'good' };

function short(t, max = 140) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '...' : s;
}

/* -> null, or { key, title, why, quote, tip } where tip is a starter line for next time
   (only when your own words didn't already do this move). */
export function pickMove(prompt, raw, answers = [], core = '', known = '') {
  if (!String(prompt || '').trim()) return null;
  const r = analyze(prompt, raw, answers, core, known);
  const added = r.segments.filter((s) => s.kind === 'added' && s.why !== 'Your context');
  if (!added.length) return null;
  const said = [raw].concat((answers || []).map((a) => a && a.answer)).filter(Boolean).join('\n');
  const yours = new Set(assess(said).checks.filter((c) => c.hit).map((c) => c.key));
  const byKey = Object.fromEntries(CHECKS.map((c) => [c.key, c]));
  const order = ORDER.filter((k) => !yours.has(k)).concat(ORDER.filter((k) => yours.has(k)));
  let key = '', seg = null;
  for (const k of order) {
    const hit = added.find((s) => does(byKey[k], s.text));
    if (hit) { key = k; seg = hit; break; }
  }
  if (!seg) {
    seg = added.find((s) => FROM_LABEL[s.why]);
    if (seg) key = FROM_LABEL[seg.why];
  }
  if (!seg) return null;
  return { key, ...MOVES[key], quote: short(seg.text), tip: yours.has(key) ? '' : byKey[key].starter.trim() };
}
