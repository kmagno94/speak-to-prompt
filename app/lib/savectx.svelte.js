/* Save as context (#50, v2.1.37, SPEC LOCKED 11/08).
   When your words hold background you'd otherwise retype (who you are, a project, a setup), the
   app offers to turn it into a My context piece:
   - The nudge: the Read call that already runs adds one field (context_candidate), so spotting
     it costs no extra request. It shows on Quick mode too. No key, no Read, no nudge.
   - Manual: 🧱 Save as context in the result's ⋯, and Build one with questions in the My
     context editor. These work with no key too (the five fixed questions below).
   - The interview: one question at a time, no cap. After each answer one Flash-Lite call says
     which parts are covered and asks the next thing, or says nothing important is missing.
     Save what we have is always on screen. If a call fails, the fixed questions take over.
   - The piece: labeled parts (What this is, Key facts, Goals, What changes often, Leave out).
     One Flash-Lite pass irons it (only facts you said, first person). The phone checks it:
     any number you never said, or a note past the cap, and your own words are used instead.
   - Saving: a normal My context piece (lib/context.svelte.js), so it follows Save on this
     phone like every other piece. An overlap with a piece you already have shows old vs new
     with Update, Keep both, or Skip. Bring in uses the same screen for its overlaps.
   Everything here lives in memory until you tap Save. Closing the sheet drops it. */
import { context, CAP } from './context.svelte.js';
import { findOverlap } from './contextsync.js';
import { CTX_PARTS, interviewPrompt, ironPrompt } from './prompts.js';

export const PARTS = CTX_PARTS;
const KEYS = PARTS.map((p) => p.key);
const NOTHING = /^\s*(no|nope|nah|nothing|none|n\/a|na|not really|nothing really)[\s.!]*$/i;
const nums = (t) => String(t).replace(/,(?=\d{3}\b)/g, '').match(/\d+(?:[.:/]\d+)*/g) || [];
const TITLE_MAX = 60, ANSWER_MAX = 2000, SOURCE_MAX = 12000;

/* The note from their own words, no AI: each answer under its part's label. The words they
   started with go under What this is when no answer covers it. Used with no key, and whenever
   the iron pass fails its check. */
export function plainPiece(source, turns) {
  const by = {};
  (turns || []).forEach((t) => { if (t && t.a && !NOTHING.test(t.a) && KEYS.includes(t.part)) (by[t.part] = by[t.part] || []).push(t.a.trim()); });
  const src = String(source || '').trim();
  if (src) by.what = [src].concat(by.what || []);
  const out = PARTS.filter((p) => by[p.key]).map((p) => p.label + ':\n' + by[p.key].join('\n'));
  return out.join('\n\n').slice(0, CAP);
}
/* The phone's check on the ironed note: it has to start the labeled parts, fit the cap, and
   hold no number the person never said. Returns '' when it passes, else why not. */
export function ironProblem(text, said) {
  if (!text || !/^What this is:/im.test(text)) return 'no labels';
  if (text.length > CAP) return 'too long';
  const have = String(said).replace(/,(?=\d{3}\b)/g, '');
  const extra = nums(text).filter((n) => have.indexOf(n) === -1);
  return extra.length ? 'new number' : '';
}
/* Which labeled parts a note already has, for the Covered so far checklist. */
export function partsIn(text) {
  return PARTS.filter((p) => new RegExp('^' + p.label + ':\\s*\\S', 'im').test(String(text || '')) || new RegExp('^' + p.label + ':\\s*\\n\\s*\\S', 'im').test(String(text || ''))).map((p) => p.key);
}
function parseTurn(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const d = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
  return {
    covered: (Array.isArray(d.covered) ? d.covered : []).map((k) => String(k).toLowerCase()).filter((k) => KEYS.includes(k)),
    done: d.done === true,
    part: KEYS.includes(String(d.part || '').toLowerCase()) ? String(d.part).toLowerCase() : '',
    question: String(d.question || '').trim().slice(0, 300)
  };
}

class SaveCtx {
  /* The nudge (this build only, memory only). */
  candidate = $state(null);   // { title, why } from the Read call
  nudgeOff = $state(false);   // Not now, or already saved
  /* Run stats (v2.1.37): how far the offer got on this build, as one fixed label and never a
     word anyone typed: shown, tapped, saved, not now (the card), manual, manual saved (the ⋯
     menu). app.js adds it to the run record, only while Show run stats is on. */
  stat = '';
  onStat = null;              // set by app.js: (label) => void
  setStat(v) { this.stat = v; if (this.onStat) this.onStat(v); }
  later() { this.nudgeOff = true; this.setStat('not now'); }

  /* The sheet. */
  open = $state(false);
  stage = $state('');         // ask | thinking | ironing | review | overlap | done
  from = $state('');          // nudge | result | editor | bringin
  title = $state('');
  source = $state('');        // the words they started with (their note and answers), memory only
  turns = $state([]);         // [{ part, q, a }]
  covered = $state([]);       // part keys
  question = $state(null);    // { part, text }
  answer = $state('');
  text = $state('');          // the finished piece, editable before saving
  ironed = $state('');        // 'ai' | 'plain'
  error = $state('');
  conflicts = $state([]);     // [{ id, title, old, text }], settled one at a time
  at = $state(0);             // which conflict is on screen
  tally = $state({ added: 0, same: 0, updated: 0, both: 0, skipped: 0 });
  savedId = $state('');
  pickedNow = $state(false);
  asker = null;               // set by app.js: () => null with no key, else (text, asJson) => Promise<string>
  hasResult = () => false;    // set by app.js: is a finished prompt on screen?
  run = 0;

  said = $derived(this.source + '\n' + this.turns.map((t) => t.a || '').join('\n'));
  hasWords = $derived(!!(this.source.trim() || this.turns.some((t) => t.a && !NOTHING.test(t.a))));
  conflict = $derived(this.conflicts[this.at] || null);

  get ask() { return this.asker ? this.asker() : null; }

  /* A new build starts clean: last build's nudge never carries over. */
  newBuild() { this.candidate = null; this.nudgeOff = false; this.stat = ''; }
  setCandidate(c) {
    const title = c && String(c.title || '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
    this.candidate = title ? { title, why: String(c.why || '').replace(/\s+/g, ' ').trim().slice(0, 160) } : null;
    if (this.candidate) this.setStat('shown');
  }

  reset() {
    this.run++;
    this.stage = ''; this.title = ''; this.source = ''; this.turns = []; this.covered = []; this.question = null;
    this.answer = ''; this.text = ''; this.ironed = ''; this.error = ''; this.conflicts = []; this.at = 0;
    this.tally = { added: 0, same: 0, updated: 0, both: 0, skipped: 0 }; this.savedId = ''; this.pickedNow = false;
  }
  close() { this.open = false; this.reset(); }

  /* Opens the interview. source: the words to start from ('' from the editor). */
  start(from, title, source) {
    this.reset();
    this.from = from;
    this.title = String(title || '').slice(0, TITLE_MAX);
    this.source = String(source || '').trim().slice(0, SOURCE_MAX);
    this.open = true;
    if (from === 'nudge') { this.nudgeOff = true; this.setStat('tapped'); }
    else if (from === 'result') this.setStat('manual');
    this.next();
  }
  /* Bring in found pieces whose title is already here with different words. */
  review(conflicts, tally) {
    this.reset();
    this.from = 'bringin';
    this.conflicts = conflicts;
    this.tally = { added: tally.added || 0, same: tally.same || 0, updated: 0, both: 0, skipped: 0 };
    this.stage = 'overlap';
    this.open = true;
  }

  mark(keys) { this.covered = KEYS.filter((k) => this.covered.includes(k) || keys.includes(k)); }
  /* The fixed questions: the first part not covered and not asked yet. */
  fixedNext() {
    const asked = this.turns.map((t) => t.part);
    const p = PARTS.find((x) => !this.covered.includes(x.key) && !asked.includes(x.key));
    return p ? { part: p.key, text: p.ask } : null;
  }
  setQuestion(q) {
    if (!q) return this.finish();
    this.question = q; this.answer = ''; this.stage = 'ask';
  }
  next() {
    const run = this.run;
    this.error = '';
    /* Nothing said yet (opened from the editor): start with What this is, no call needed. */
    if (!this.ask || !this.hasWords) return this.setQuestion(this.fixedNext());
    this.stage = 'thinking';
    this.ask(interviewPrompt(this.title, this.source, this.turns), true).then((raw) => {
      if (run !== this.run) return;
      const r = parseTurn(raw);
      this.mark(r.covered);
      const asked = this.turns.map((t) => t.q.toLowerCase());
      if (r.done || !r.question || asked.includes(r.question.toLowerCase())) return this.finish();
      this.setQuestion({ part: r.part || (this.fixedNext() || { part: 'facts' }).part, text: r.question });
    }).catch(() => {
      if (run !== this.run) return;
      this.setQuestion(this.fixedNext());
    });
  }
  reply(skip) {
    if (!this.question || this.stage !== 'ask') return;
    const a = skip ? '' : this.answer.trim().slice(0, ANSWER_MAX);
    if (!skip && !a) return;
    this.turns = [...this.turns, { part: this.question.part, q: this.question.text, a }];
    if (a && !NOTHING.test(a)) this.mark([this.question.part]);
    this.question = null; this.answer = '';
    this.next();
  }
  /* Done asking, or Save what we have: iron it, check it, show it. */
  finish() {
    const run = ++this.run;
    this.question = null;
    if (!this.hasWords) { this.error = 'Answer one question first, so there is something to save.'; return this.setQuestion(this.fixedNext() || { part: 'what', text: PARTS[0].ask }); }
    const plain = () => { this.text = plainPiece(this.source, this.turns); this.ironed = 'plain'; this.show(); };
    if (!this.ask) return plain();
    this.stage = 'ironing';
    this.ask(ironPrompt(this.title, this.source, this.turns), false).then((raw) => {
      if (run !== this.run) return;
      const text = String(raw || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
      if (ironProblem(text, this.said)) return plain();
      this.text = text; this.ironed = 'ai'; this.show();
    }).catch(() => { if (run === this.run) plain(); });
  }
  show() { this.mark(partsIn(this.text)); this.stage = 'review'; }

  /* Save: straight in, unless it overlaps a piece that's already here. */
  save() {
    const title = this.title.trim().slice(0, TITLE_MAX), text = this.text.trim();
    if (!title) { this.error = 'Give it a short title first, so you can find it later.'; return; }
    if (!text) { this.error = 'There is nothing in it yet.'; return; }
    this.error = '';
    const hit = findOverlap(context.list, { title, text });
    if (hit) { this.conflicts = [{ id: hit.id, title: hit.title, old: hit.text, text, newTitle: title }]; this.at = 0; this.stage = 'overlap'; return; }
    this.saved(context.addPiece(title, text));
  }
  settle(how) {
    const c = this.conflict;
    if (!c) return;
    const id = context.settle(c.id, c.text, how, c.newTitle || c.title);
    const t = { ...this.tally };
    if (how === 'update') t.updated++; else if (how === 'both') t.both++; else t.skipped++;
    this.tally = t;
    if (this.from !== 'bringin') return how === 'skip' ? this.close() : this.saved(id);
    if (this.at + 1 < this.conflicts.length) this.at++;
    else this.stage = 'done';
  }
  saved(id) {
    this.savedId = id;
    this.pickedNow = !this.hasResult();
    context.pickNext(id, this.pickedNow);
    this.nudgeOff = true;
    if (this.from === 'nudge') this.setStat('saved'); else if (this.from === 'result') this.setStat('manual saved');
    this.stage = 'done';
  }
}

export const savectx = new SaveCtx();
