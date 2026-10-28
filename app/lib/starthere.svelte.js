/* Start here (idea mvlbzn3ivv4q): when the app opens, a white halo walks you in.
   0. 'intro': the title's own entrance plays first (the waveform settling into lines).
   1. 'title': the title and description pulse first, so you know what this is.
   2. 'box': the page scrolls down to Talk it out and the box, which pulse with
      ✍️ Start here over the box. Then the idea strip comes in.
   It plays on every open until the first real action (tap into the box, type, paste,
   Try this one, or Talk it out), then never again. The only thing saved is a yes/no
   flag ("stp-started"), never anything typed. StartHere.svelte draws it; app.js holds
   the idea strip back while it shows and brings it in after. */
import { reduceMotion } from './motion.js';

const KEY = 'stp-started';
/* The waveform entrance takes about 1.5s (app.css .wave); Reduce Motion has none. */
export const INTRO_MS = reduceMotion ? 0 : 1600;
export const TITLE_MS = 1800;
export const BOX_MS = 4500;

function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

class StartHereState {
  active = $state(false);
  phase = $state('');      // 'intro' | 'title' | 'box'
  #timers = [];

  /* Shortcut hand-offs (#paste, #t=) already know where to go, so they skip it. */
  open() {
    if (seen()) return;
    const h = (typeof location !== 'undefined' && location.hash) || '';
    if (h === '#paste' || h.indexOf('#t=') === 0) return;
    this.active = true;
    this.phase = INTRO_MS ? 'intro' : 'title';
    this.#clear();
    this.#timers.push(setTimeout(() => { if (this.active) this.phase = 'title'; }, INTRO_MS));
    this.#timers.push(setTimeout(() => { if (this.active) this.phase = 'box'; }, INTRO_MS + TITLE_MS));
    this.#timers.push(setTimeout(() => this.#end(), INTRO_MS + TITLE_MS + BOX_MS));
  }
  /* The first action: stop now and never show it again. */
  started() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    if (this.active) this.#end();
  }
  #clear() { this.#timers.forEach(clearTimeout); this.#timers = []; }
  #end() {
    this.#clear();
    this.active = false;
    this.phase = '';
    try { window.dispatchEvent(new Event('stp-starthere-end')); } catch (e) {}
  }
}

export const startHere = new StartHereState();
