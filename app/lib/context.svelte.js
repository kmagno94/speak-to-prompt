/* My context: reusable pieces of background (a title and some text each) that you pick
   per prompt, so the AI can refer to them without you retyping them.

   DEVELOPMENT ONLY, like Your core: shown only with "Show my dev tools" on, saved in this
   browser (localStorage) on this phone only. Picks are per visit and never saved.
   The picked pieces are never tacked onto the prompt: the writer sees them and works in only
   the facts the request needs, so Copy gives the prompt alone (then the core at the end).
   The no-key quick version puts them inside the prompt, before the raw thoughts.
   Budget: picks should stay under BUDGET tokens. Past 100%, a build with a key runs one
   Flash-Lite squeeze (app.js) and keeps the shorter version here in memory only, for these
   exact picks: the saved pieces never change, and a reload or a new pick drops it. */
import { core } from './core.svelte.js';

const KEY = 'stp-context';
const MAX_TITLE = 60;
const MAX_TEXT = 4000;
export const BUDGET = 1500;   /* tokens; about 4 characters per token */
const HEAD = '---\nMY CONTEXT (background I picked for this request; use it and refer to it by title)';
export const tokensOf = (t) => (t ? Math.ceil((t.length + 2) / 4) : 0);
/* What a block with this body would cost, header included (same count as the chip). */
export const blockTokens = (body) => tokensOf(HEAD + '\n\n' + body);

function read() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function write(v) { try { if (v.length) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

class Context {
  list = $state([]);       // [{ id, title, text }]
  picked = $state([]);     // ids picked for the next prompt (memory only)
  open = $state(false);    // the My context editor

  usable = $derived(this.list.filter((c) => c.text.trim()));
  chosen = $derived(this.usable.filter((c) => this.picked.includes(c.id)));
  active = $derived(core.dev && this.chosen.length > 0);

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

  constructor() { this.list = read(); }

  save() { write(this.list.filter((c) => c.title.trim() || c.text.trim())); }

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
  toggle(id) { this.picked = this.picked.includes(id) ? this.picked.filter((p) => p !== id) : [...this.picked, id]; }

}

export const context = new Context();
