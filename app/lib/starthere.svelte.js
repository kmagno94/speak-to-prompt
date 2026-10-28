/* Start here (idea mvlbzn3ivv4q): when the app opens, a pointer shows where to begin,
   the box or Talk it out, before the idea strip comes in. It plays on every open
   until the first real action (tap into the box, type, paste, Try this one, or
   Talk it out), then never again. The only thing saved is a yes/no flag
   ("stp-started"), never anything typed. StartHere.svelte draws it; app.js holds
   the idea strip back while it shows and brings it in after. */
const KEY = 'stp-started';
export const SHOW_MS = 4500;

function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

class StartHereState {
  active = $state(false);
  #timer = null;

  /* Shortcut hand-offs (#paste, #t=) already know where to go, so they skip it. */
  open() {
    if (seen()) return;
    const h = (typeof location !== 'undefined' && location.hash) || '';
    if (h === '#paste' || h.indexOf('#t=') === 0) return;
    this.active = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#end(), SHOW_MS);
  }
  /* The first action: stop now and never show it again. */
  started() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    if (this.active) this.#end();
  }
  #end() {
    clearTimeout(this.#timer);
    this.active = false;
    try { window.dispatchEvent(new Event('stp-starthere-end')); } catch (e) {}
  }
}

export const startHere = new StartHereState();
