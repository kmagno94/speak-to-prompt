/* Draft safety net (v2.1.28, idea mw63t6xb2myc, Kevin picked "tab-only" 11/7).
   What's in the words box is kept in this tab's sessionStorage, so a reload, or Safari reloading
   the tab after you jump to another app, brings your words back instead of losing them.
   Kept tight on purpose, because the site's promise is that it doesn't keep your words:
     - sessionStorage only: this tab only, gone when the tab closes. Never localStorage, never sent.
     - Deleted when you tap Build my prompt, when the box is emptied (New prompt, Clear),
       and after 30 minutes.
     - After Build it stays off until you type in the box again.
   Brought back only into an empty box, with a note and a Start fresh button. */
export const DRAFT_KEY = 'stp-draft';
export const DRAFT_MAX_MS = 30 * 60 * 1000;

export const draft = $state({ restored: false });

function read() {
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d.t === 'string' ? d : null; } catch (e) { return null; }
}
function drop() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} }
function keep(text) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ t: text, at: Date.now() })); } catch (e) {} }

let box = null, paused = false, saveT = 0;

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
  }
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (paused) return;
      if (box.value.trim()) keep(box.value); else drop();
    }, 300);
  };
  const onInput = (e) => {
    if (e.isTrusted) paused = false;   /* typing again after Build turns the net back on */
    if (draft.restored && e.isTrusted) draft.restored = false;
    if (!box.value.trim()) { clearTimeout(saveT); drop(); return; }
    save();
  };
  const onChanged = () => { if (!box.value.trim()) { clearTimeout(saveT); drop(); return; } save(); };
  const onBuild = () => { if (!box.value.trim()) return; clearTimeout(saveT); drop(); paused = true; draft.restored = false; };
  /* The 30 minute limit also covers a tab that's just left open. */
  const expire = setInterval(() => { const x = read(); if (x && Date.now() - x.at > DRAFT_MAX_MS) drop(); }, 60000);
  box.addEventListener('input', onInput);
  box.addEventListener('stp:changed', onChanged);
  form && form.addEventListener('submit', onBuild, true);
  return () => {
    box.removeEventListener('input', onInput); box.removeEventListener('stp:changed', onChanged);
    form && form.removeEventListener('submit', onBuild, true);
    clearInterval(expire); clearTimeout(saveT);
  };
}

/* Start fresh: empty the box and forget the draft. */
export function startFresh() {
  draft.restored = false;
  drop();
  if (!box) return;
  box.value = '';
  box.dispatchEvent(new Event('stp:changed'));
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
}
