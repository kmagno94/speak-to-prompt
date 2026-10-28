/* Writer's block nudge state, shared by the nudge under the box (StuckNudge.svelte) and the
   coach bar on top of the keyboard (KeyboardCoach.svelte), so both show the same sentence.
   After the box sits still for IDLE_MS with some words in it, one sentence to finish shows.
   Typing hides it; it comes back after the next quiet stretch. Nothing saved or sent. */
import { assess } from './coach.js';
import { lineOrder, IDLE_MS } from './stuck.js';

class Stuck {
  show = $state(false);
  lines = $state([]);
  at = $state(0);
  #timer = null;
  #box = null;

  /* Called once by StuckNudge on mount; returns the cleanup. */
  attach(box, form) {
    this.#box = box;
    const wait = () => this.wait(), stop = () => this.stop();
    box.addEventListener('input', wait);
    form?.addEventListener('submit', stop);
    return () => { clearTimeout(this.#timer); box.removeEventListener('input', wait); form?.removeEventListener('submit', stop); };
  }
  #busy() { const b = document.getElementById('build'); return !b || b.disabled; }
  wait() {
    const box = this.#box;
    clearTimeout(this.#timer);
    this.show = false;
    if (!box || !box.value.trim()) return;
    this.#timer = setTimeout(() => {
      if (this.#busy() || !box.value.trim()) return;
      const a = assess(box.value);
      this.lines = lineOrder(box.value, a.checks.filter((c) => !c.hit).map((c) => c.key));
      this.at = 0;
      this.show = this.lines.length > 0;
    }, IDLE_MS);
  }
  stop() { clearTimeout(this.#timer); this.show = false; }
  get line() { return this.lines[this.at] || null; }
  another() { if (this.lines.length) this.at = (this.at + 1) % this.lines.length; }
  /* Start a new line with the sentence and put the cursor after it. */
  use() {
    const box = this.#box, l = this.line;
    if (!box || !l) return;
    addLine(box, l.text);
  }
}

/* Shared by the nudge and the Ghost Coach notes: a new line with the phrase, cursor after it. */
export function addLine(box, text) {
  const v = box.value.replace(/\s+$/, '');
  box.value = (v ? v + '\n' : '') + text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
}

export const stuck = new Stuck();
