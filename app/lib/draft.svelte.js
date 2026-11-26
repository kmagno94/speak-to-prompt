/* Draft safety net (v2.1.28, idea mw63t6xb2myc, Kevin picked "tab-only" 11/7).
   What's in the words box is kept in this tab's sessionStorage, so a reload, or Safari reloading
   the tab after you jump to another app, brings your words back instead of losing them.
   Kept tight on purpose, because the site's promise is that it doesn't keep your words:
     - sessionStorage only: this tab only, gone when the tab closes. Never localStorage, never sent.
     - Deleted when the box is emptied (New prompt, Clear, Start fresh) and after 30 minutes.
     - Kept through Build my prompt (v2.1.28, Test lab report): Kevin built, saw he forgot to pick
       his context, reloaded, and lost his words. Only the words are kept, never the prompt, and the
       note says they're from your last build.
     - Dropped once the prompt is finished (v2.1.49, Kevin 11/20: the note shouldn't outlive a
       completed prompt). Build still keeps the words while it's writing, so a reload mid-build
       brings them back; once "Your prompt is ready" shows (stp:ready from setReady), they're
       forgotten. Typing in the box after that starts a new draft.
   Brought back only into an empty box, with a note and a Start fresh button.
   Last prompt (v2.1.50, Kevin 11/24: an accidental reload shouldn't lose the most recent prompt):
     - A finished prompt goes into one slot ("stp-last", sessionStorage, this tab only), with the words
       it was built from. The next finished prompt replaces it, and it's gone after 30 minutes or when
       the tab closes. Never localStorage, never sent.
     - After a reload the box still comes back empty with no Your words are back note. A quiet line
       under it offers the last prompt instead: Copy it, Put my words back, or ✕ to forget it.
     - It also refreshes when the page hides, so a Glow-Up or stronger round that swapped the prompt
       in is the one that's kept. */
export const DRAFT_KEY = 'stp-draft';
export const DRAFT_MAX_MS = 30 * 60 * 1000;

export const LAST_KEY = 'stp-last';
export const draft = $state({ restored: false, built: false, last: null });

function read() {
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d.t === 'string' ? d : null; } catch (e) { return null; }
}
function drop() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} }
function keep(text, built = false) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ t: text, at: Date.now(), ...(built ? { b: 1 } : {}) })); } catch (e) {} }

function readLast() {
  try { const d = JSON.parse(sessionStorage.getItem(LAST_KEY) || 'null'); return d && typeof d.p === 'string' && d.p.trim() ? d : null; } catch (e) { return null; }
}
function dropLast() { try { sessionStorage.removeItem(LAST_KEY); } catch (e) {} }
/* The prompt on screen, once it's finished (the result card isn't still cooking). */
function finishedPrompt() {
  const out = document.getElementById('output'), card = document.getElementById('result');
  if (!out || !out.value.trim() || (card && (card.hidden || card.classList.contains('cooking')))) return '';
  return out.value;
}
function keepLast(words) {
  const p = finishedPrompt();
  if (!p) return;
  try { sessionStorage.setItem(LAST_KEY, JSON.stringify({ p, w: String(words || ''), at: Date.now() })); } catch (e) {}
}

let box = null, saveT = 0, lastBuilt = '', lastWords = '';

export function watchDraft() {
  box = document.getElementById('thoughts');
  const form = document.getElementById('form');
  if (!box) return () => {};
  /* Bring back a recent draft, only into an empty box. */
  const d = read();
  if (d && Date.now() - d.at > DRAFT_MAX_MS) drop();
  else if (d && d.t.trim() && !box.value) {
    box.value = d.t;
    box.dispatchEvent(new Event('stp:changed'));
    box.dispatchEvent(new Event('input', { bubbles: true }));   /* the box fits, the idea strip steps aside */
    draft.restored = true;
    draft.built = !!d.b;
    if (d.b) lastBuilt = d.t;
  }
  /* No draft came back: offer the last finished prompt, if this tab has one from the last 30 minutes. */
  const l = readLast();
  if (l && Date.now() - l.at > DRAFT_MAX_MS) dropLast();
  else if (l && !draft.restored && !box.value) { draft.last = { p: l.p, w: l.w || '' }; lastWords = l.w || ''; }
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (box.value.trim()) keep(box.value, box.value === lastBuilt); else drop();
    }, 300);
  };
  const onInput = (e) => {
    if (draft.restored && e.isTrusted) draft.restored = false;
    if (draft.last && e.isTrusted && box.value.trim()) draft.last = null;
    if (!box.value.trim()) { clearTimeout(saveT); drop(); return; }
    save();
  };
  const onChanged = () => { if (!box.value.trim()) { clearTimeout(saveT); drop(); return; } save(); };
  /* Build keeps the words (marked as built), so a reload after Build still has them. */
  const onBuild = () => { if (!box.value.trim()) return; clearTimeout(saveT); lastBuilt = box.value; lastWords = box.value; keep(box.value, true); draft.restored = false; draft.last = null; };
  /* A finished prompt forgets the words (v2.1.49). Box edits after this start a fresh draft. */
  /* v2.1.50: ...and puts the finished prompt in the one Last prompt slot (after setReady, once the prompt is on the card). */
  const onReady = () => { clearTimeout(saveT); drop(); lastBuilt = ''; draft.restored = false; draft.built = false; draft.last = null; setTimeout(() => keepLast(lastWords), 0); };
  const onHide = (e) => { if (e.type === 'pagehide' || document.visibilityState === 'hidden') keepLast(lastWords); };
  /* The 30 minute limit also covers a tab that's just left open. */
  const expire = setInterval(() => {
    const x = read(); if (x && Date.now() - x.at > DRAFT_MAX_MS) drop();
    const y = readLast(); if (y && Date.now() - y.at > DRAFT_MAX_MS) { dropLast(); draft.last = null; }
  }, 60000);
  box.addEventListener('input', onInput);
  box.addEventListener('stp:changed', onChanged);
  form && form.addEventListener('submit', onBuild, true);
  document.addEventListener('stp:ready', onReady);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  return () => {
    document.removeEventListener('stp:ready', onReady);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
    box.removeEventListener('input', onInput); box.removeEventListener('stp:changed', onChanged);
    form && form.removeEventListener('submit', onBuild, true);
    clearInterval(expire); clearTimeout(saveT);
  };
}

/* Start fresh: empty the box and forget the draft. */
export function startFresh() {
  draft.restored = false; draft.built = false; lastBuilt = '';
  drop();
  if (!box) return;
  box.value = '';
  box.dispatchEvent(new Event('stp:changed'));
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
}

/* Last prompt (v2.1.50): put its words back in the box (they count as a draft again), or forget it. */
export function lastWordsBack() {
  const l = draft.last;
  if (!l || !box) return;
  box.value = l.w;
  box.dispatchEvent(new Event('stp:changed'));
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
}
export function forgetLast() { draft.last = null; dropLast(); }
