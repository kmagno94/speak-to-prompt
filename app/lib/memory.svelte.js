/* Memory ("Tailored to you"): short facts about your world (devices, school,
   job, tools) so Gemini stops asking what you've already told it. Opt-in, and
   saved only on this phone (localStorage). Export and Import memory.md through
   the share sheet is how it gets to iCloud Drive or another browser.

   How it's used, so prompts don't get bulky:
   - The intake step sees the numbered facts, skips questions they answer, and
     picks which ones matter for this request (use_memory).
   - Only the picked facts go into writing the prompt.
   - After a run, "Remember for next time?" offers your answers and up to 2
     lasting facts Gemini spotted. Nothing is saved without a tap.

   DEVELOPMENT ONLY for now: only with "Show my dev tools" on, like your core. */
import { core } from './core.svelte.js';

const KEY = 'stp-memory';
export const MAX_FACTS = 30;
export const MAX_LEN = 160;

function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
const norm = (t) => String(t || '').replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
const same = (a, b) => norm(a).toLowerCase().replace(/[.!]+$/, '') === norm(b).toLowerCase().replace(/[.!]+$/, '');

class Memory {
  on = $state(false);
  facts = $state([]);          // [{ t, at }]
  suggestions = $state([]);    // "Remember for next time?" after a run (not saved until tapped)

  /* Is memory used right now (dev tools on and the switch on). */
  active = $derived(core.dev && this.on);

  constructor() {
    const v = read();
    if (v) { this.on = !!v.on; this.facts = Array.isArray(v.facts) ? v.facts.filter((f) => f && f.t).slice(0, MAX_FACTS) : []; }
  }
  save() {
    try {
      if (this.on || this.facts.length) localStorage.setItem(KEY, JSON.stringify({ on: this.on, facts: this.facts }));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }
  has(t) { return this.facts.some((f) => same(f.t, t)); }
  /* Returns true if it was added. Newest first; the oldest drop off past the cap. */
  add(t) {
    const x = norm(t);
    if (!x || this.has(x)) return false;
    this.facts = [{ t: x, at: new Date().toISOString().slice(0, 10) }, ...this.facts].slice(0, MAX_FACTS);
    this.save();
    return true;
  }
  remove(i) { this.facts = this.facts.filter((_, j) => j !== i); this.save(); }
  clear() { this.facts = []; this.save(); }
  setOn(v) { this.on = !!v; this.save(); }

  /* Numbered list for the intake step. */
  numbered() { return this.facts.map((f, i) => (i + 1) + '. ' + f.t).join('\n'); }
  /* Facts by the numbers Gemini picked (1-based), ignoring anything out of range. */
  pick(nums) {
    const seen = new Set();
    return (Array.isArray(nums) ? nums : []).map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= this.facts.length && !seen.has(n) && seen.add(n)).map((n) => this.facts[n - 1].t);
  }

  toMarkdown() {
    return ['# Speak to Prompt memory', '', 'Saved on my phone only. One fact per line; edit freely, then Import it back.', '', ...this.facts.map((f) => '- ' + f.t), ''].join('\n');
  }
  /* Adds every "- fact" line (or any plain line) that isn't a heading or the note. Returns how many were new. */
  importMarkdown(text) {
    let n = 0;
    for (const line of String(text || '').split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith('#') || /^Saved on my phone only/i.test(l)) continue;
      if (this.add(l)) n++;
    }
    return n;
  }
}

export const memory = new Memory();

/* An answer to a follow-up question, worded as a fact to remember:
   "Which devices and versions?" + "iPhone 16 on iOS 27" -> "Which devices and versions: iPhone 16 on iOS 27". */
export function answerFact(a) {
  const q = String(a.question || '').replace(/\?+\s*$/, '').trim();
  const ans = String(a.answer || '').trim();
  return q && ans ? norm(q + ': ' + ans) : '';
}
