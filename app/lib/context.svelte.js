/* My context: reusable pieces of background (a title and some text each) that you pick
   per prompt, so the AI can refer to them without you retyping them.

   In the main app since v2.1.21 (#4, idea mvxaikmmygq5). The hard rule is that the site never
   saves your words, so saving is opt-in, like Remember my key: pieces live in this tab only
   until you turn on "Save on this phone" (KEEP_KEY), which keeps them in this browser
   (localStorage, stp-context) on this phone only. Turning it off deletes what it saved and
   keeps the pieces for this visit. A phone that already had saved pieces from the dev tools
   days counts as opted in. Picks are per visit and never saved.
   Each piece has a CAP of 3,800 characters: you can type past it (up to MAX_TEXT) so nothing
   gets cut off mid-thought, but the editor and the chip say it's over so you can trim it.
   The picked pieces are never tacked onto the prompt: the writer sees them and works in only
   the facts the request needs, so Copy gives the prompt alone (then the core at the end).
   The no-key quick version puts them inside the prompt, before the raw thoughts.
   Budget: picks should stay under BUDGET tokens. Past 100%, a build with a key runs one
   Flash-Lite squeeze (app.js) and keeps the shorter version here in memory only, for these
   exact picks: the saved pieces never change, and a reload or a new pick drops it. */
import { merge, freeTitle } from './contextsync.js';

const KEY = 'stp-context';
const KEEP_KEY = 'stp-context-keep';
const MAX_TITLE = 60;
export const CAP = 3800;      /* characters per piece; past it the editor and chip say so */
const MAX_TEXT = 6000;        /* hard stop, well past the cap, so typing never gets cut off */
export const BUDGET = 1500;   /* tokens; about 4 characters per token */
const HEAD = '---\nMY CONTEXT (background I picked for this request; use it and refer to it by title)';
export const tokensOf = (t) => (t ? Math.ceil((t.length + 2) / 4) : 0);
/* What a block with this body would cost, header included (same count as the chip). */
export const blockTokens = (body) => tokensOf(HEAD + '\n\n' + body);

function read() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function write(v) { try { if (v.length) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }
/* Opted in: the flag, or pieces already saved before saving became opt-in. */
function readKeep() { try { return localStorage.getItem(KEEP_KEY) === '1' || !!localStorage.getItem(KEY); } catch (e) { return false; } }
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

class Context {
  list = $state([]);       // [{ id, title, text }]
  picked = $state([]);     // ids picked for the next prompt (memory only)
  open = $state(false);    // the My context editor
  keep = $state(false);    // Save on this phone (opt-in)

  usable = $derived(this.list.filter((c) => c.text.trim()));
  chosen = $derived(this.usable.filter((c) => this.picked.includes(c.id)));
  active = $derived(this.chosen.length > 0);
  /* Pieces past the 3,800 character cap (ids), for the editor counter and the chips. */
  overCap = $derived(this.list.filter((c) => c.text.trim().length > CAP).map((c) => c.id));

  /* Changes whenever the picks or their words change, so an old squeeze can't be reused. */
  sig = $derived(this.chosen.map((c) => c.id + '\u0001' + c.title.trim() + '\u0001' + c.text.trim()).join('\u0002'));
  /* The picked pieces as written: [Title] then the text, one after another. */
  body = $derived(this.chosen.map((c) => '[' + (c.title.trim() || 'Context') + ']\n' + c.text.trim()).join('\n\n'));
  squeeze = $state(null);   // { sig, text, before, after }, memory only, never saved
  squeezed = $derived(this.squeeze && this.squeeze.sig === this.sig ? this.squeeze : null);
  block = $derived(HEAD + '\n\n' + (this.squeezed ? this.squeezed.text : this.body));

  /* Rough size of what picking adds (about 4 characters per token), shown under Build and
     logged in run stats, so you can see what context costs. rawTokens is before any squeeze. */
  rawTokens = $derived(this.active ? blockTokens(this.body) : 0);
  tokens = $derived(this.active ? tokensOf(this.block) : 0);
  pct = $derived(Math.round((this.tokens / BUDGET) * 100));
  over = $derived(this.active && !this.squeezed && this.rawTokens > BUDGET);

  /* Recently used first (v2.1.28): pieces carry a `used` time, stamped when a build starts with
     them picked (never on a tap, so chips don't jump around while you pick). Ordered by that,
     then newest first for pieces never used. Only TOP show until you tap +N more. */
  ordered = $derived(this.usable.map((c, i) => [c, i]).sort((a, b) => (b[0].used || 0) - (a[0].used || 0) || a[1] - b[1]).map((x) => x[0]));
  markUsed() {
    if (!this.chosen.length) return;
    const now = Date.now(), ids = this.picked;
    this.list = this.list.map((c) => (ids.includes(c.id) ? { ...c, used: now } : c));
    this.save();
  }

  constructor() { this.keep = readKeep(); this.list = this.keep ? read() : []; }

  save() { if (this.keep) write(this.list.filter((c) => c.title.trim() || c.text.trim())); }
  /* On: saves what's here now. Off: deletes what it saved; the pieces stay for this visit. */
  setKeep(on) {
    this.keep = !!on;
    try { if (on) localStorage.setItem(KEEP_KEY, '1'); else { localStorage.removeItem(KEEP_KEY); localStorage.removeItem(KEY); } } catch (e) {}
    this.save();
  }

  add() {
    const c = { id: newId(), title: '', text: '' };
    this.list = [c, ...this.list];   /* newest first, so the editor opens on it at the top */
    return c.id;
  }
  update(id, field, value) {
    const max = field === 'title' ? MAX_TITLE : MAX_TEXT;
    this.list = this.list.map((c) => (c.id === id ? { ...c, [field]: String(value).slice(0, max) } : c));
    this.save();
  }
  remove(id) {
    this.list = this.list.filter((c) => c.id !== id);
    this.picked = this.picked.filter((p) => p !== id);
    this.save();
  }
  /* Bring in pieces from another device (lib/contextsync.js). Saved only if Save on this phone is on.
     New titles come in; a title that's already here with different words is NOT changed any more
     (v2.1.37, #50): it comes back in r.conflicts for the overlap screen to settle. */
  bringIn(incoming) {
    const r = merge(this.list, incoming, newId);
    this.list = r.list;
    this.save();
    return r;
  }
  /* Save as context (#50): a finished piece goes in as a normal piece, newest first. */
  addPiece(title, text) {
    const c = { id: newId(), title: String(title || '').trim().slice(0, MAX_TITLE), text: String(text || '').slice(0, MAX_TEXT) };
    this.list = [c, ...this.list.filter((x) => x.title.trim() || x.text.trim())];
    this.save();
    return c.id;
  }
  /* The overlap screen's three answers. Update replaces the old words; Keep both adds the new
     one under a free title; Skip changes nothing. Returns the id the new words ended up in. */
  settle(id, text, how, title) {
    if (how === 'update') { this.update(id, 'text', text); return id; }
    if (how === 'both') return this.addPiece(freeTitle(this.list, title), text);
    return '';
  }
  /* Picked for your next prompt: right away when no prompt is on screen; otherwise it waits for
     New prompt, so saving a piece never turns a finished prompt into "build again". */
  later = [];
  pickNext(id, now) {
    if (!id) return;
    if (now) { if (!this.picked.includes(id)) this.picked = [...this.picked, id]; }
    else if (!this.later.includes(id)) this.later.push(id);
  }
  pickWaiting() {
    const ids = this.later.filter((id) => !this.picked.includes(id) && this.list.some((c) => c.id === id));
    this.later = [];
    if (ids.length) this.picked = [...this.picked, ...ids];
  }
  toggle(id) { this.picked = this.picked.includes(id) ? this.picked.filter((p) => p !== id) : [...this.picked, id]; }

}

export const context = new Context();
