/* Draft safety net (v2.1.28, idea mw63t6xb2myc, Kevin picked "tab-only" 11/7).
   What's in the words box is kept in this tab's sessionStorage, so a reload, or Safari reloading
   the tab after you jump to another app, brings your words back instead of losing them.
   Kept tight on purpose, because the site's promise is that it doesn't keep your words:
     - sessionStorage only: this tab only, gone when the tab closes. Never localStorage, never sent.
     - Deleted when the box is emptied (New prompt, Clear, Start fresh) and after 30 minutes.
     - Kept through Build my prompt (v2.1.28, Test lab report): Kevin built, saw he forgot to pick
       his context, reloaded, and lost his words. Only the words are kept, never the prompt, and the
       note says they're from your last build.
   Brought back only into an empty box, with a note and a Start fresh button. */
export const DRAFT_KEY = 'stp-draft';
export const DRAFT_MAX_MS = 30 * 60 * 1000;

export const draft = $state({ restored: false, built: false });

function read() {
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d.t === 'string' ? d : null; } catch (e) { return null; }
}
function drop() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {} }
function keep(text, built = false) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ t: text, at: Date.now(), ...(built ? { b: 1 } : {}) })); } catch (e) {} }

let box = null, saveT = 0, lastBuilt = '';

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
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (box.value.trim()) keep(box.value, box.value === lastBuilt); else drop();
    }, 300);
  };
  const onInput = (e) => {
    if (draft.restored && e.isTrusted) draft.restored = false;
    if (!box.value.trim()) { clearTimeout(saveT); drop(); return; }
    save();
  };
  const onChanged = () => { if (!box.value.trim()) { clearTimeout(saveT); drop(); return; } save(); };
  /* Build keeps the words (marked as built), so a reload after Build still has them. */
  const onBuild = () => { if (!box.value.trim()) return; clearTimeout(saveT); lastBuilt = box.value; keep(box.value, true); draft.restored = false; };
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
  draft.restored = false; draft.built = false; lastBuilt = '';
  drop();
  if (!box) return;
  box.value = '';
  box.dispatchEvent(new Event('stp:changed'));
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
}
