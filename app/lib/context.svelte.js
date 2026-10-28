/* My context: reusable pieces of background (a title and some text each) that you pick
   per prompt, so the AI can refer to them without you retyping them.

   DEVELOPMENT ONLY, like Your core: shown only with "Show my dev tools" on, saved in this
   browser (localStorage) on this phone only. Picks are per visit and never saved.
   The picked pieces are added to the end of the prompt (before the core), and the writer
   sees them so it can refer to them by title instead of repeating them. */
import { core } from './core.svelte.js';

const KEY = 'stp-context';
const MAX_TITLE = 60;
const MAX_TEXT = 4000;

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

  block = $derived.by(() => {
    const parts = ['---', 'MY CONTEXT (background I picked for this request; use it and refer to it by title)'];
    for (const c of this.chosen) parts.push('', '[' + (c.title.trim() || 'Context') + ']', c.text.trim());
    return parts.join('\n');
  });

  /* Rough size of what picking adds (about 4 characters per token), shown under Build and
     logged in run stats, so you can see what context costs. */
  tokens = $derived(this.active ? Math.ceil((this.block.length + 2) / 4) : 0);

  constructor() { this.list = read(); }

  save() { write(this.list.filter((c) => c.title.trim() || c.text.trim())); }

  add() {
    const c = { id: newId(), title: '', text: '' };
    this.list = [...this.list, c];
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

  /* Used by app.js on every finished prompt (before the core is added). */
  apply(prompt) { return this.active ? prompt + '\n\n' + this.block : prompt; }
}

export const context = new Context();
