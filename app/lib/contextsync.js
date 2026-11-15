/* My context on all your devices (v2.1.28, idea mvxecifv8i68).
   The site has no server and no accounts, so it can't talk to iCloud itself. Apple Notes can:
   Copy for Notes packs your pieces into one note, you paste it into Notes, iCloud syncs it to
   your iPad and Mac. There, copy the note and tap Bring in: the note is read back into My context.
   Nothing is sent anywhere by the site. The note only goes where you put it.

   Format (plain text, v2.1.28 Test lab report): the note is just your pieces, no code.
     Speak to Prompt · My context · 3 pieces · 11/7
     ...how to use it...
     ## Title
     text
     ~ end of My context ~
   It used to end with a STPCTX1: restore code (base64 of the same pieces), which looked like
   a block of garbage characters in Notes, and it hid a trap: edits made in Notes were ignored,
   since only the code was read. Now Bring in reads the readable part, so the note is the source
   of truth and an edit in Notes comes across. Anything after the end line is ignored, so you can
   jot below it. A text line that starts with ## (or is the end line) gets a \ in front so it
   can't split a piece; Bring in takes it back off. Old notes with the code still come in.
*/
export const TAG = 'STPCTX1:';
export const HEAD = 'Speak to Prompt · My context';
export const END = '~ end of My context ~';
const SPECIAL = /^\\*(##|~ end of My context ~)/;   /* text lines that get a backslash in front so they can't split a piece */
const MAX_PIECES = 50, MAX_TITLE = 60, MAX_TEXT = 6000;

function fromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const clean = (list) => list
  .filter((c) => c && typeof c === 'object' && (String(c.title || '').trim() || String(c.text || '').trim()))
  .slice(0, MAX_PIECES)
  .map((c) => ({ title: String(c.title || '').trim().slice(0, MAX_TITLE), text: String(c.text || '').slice(0, MAX_TEXT) }));

/* The note: your pieces in plain words, which is also what Bring in reads back. */
export function pack(list, date = new Date()) {
  const pieces = clean(list);
  const day = (date.getMonth() + 1) + '/' + date.getDate();
  const head = 'Speak to Prompt · My context · ' + pieces.length + ' piece' + (pieces.length === 1 ? '' : 's') + ' · ' + day;
  const how = 'On another device: copy this whole note, open Speak to Prompt, My context, and tap Bring in. Edit a piece here and Bring in picks up the change.';
  const esc = (t) => t.split('\n').map((l) => (SPECIAL.test(l) ? '\\' + l : l)).join('\n');
  const body = pieces.map((c) => '## ' + (c.title || 'Untitled').replace(/\n/g, ' ') + '\n' + esc(c.text.trim())).join('\n\n');
  return head + '\n' + how + '\n\n' + body + '\n\n' + END;
}

/* Reads the readable note: from the header line to the end line, one piece per ## title. */
function readNote(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const h = lines.findIndex((l) => l.trim().startsWith(HEAD));
  if (h < 0) return null;
  const out = [];
  let cur = null;
  for (let i = h + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === END || l.trim().startsWith(TAG)) break;   /* the end line, or an old note's code */
    const m = l.match(/^##\s*(.*)$/);
    if (m) { cur = { title: m[1].trim(), text: [] }; out.push(cur); continue; }
    if (!cur) continue;   /* the how-to line and blanks before the first piece */
    cur.text.push(SPECIAL.test(l) && l.startsWith('\\') ? l.slice(1) : l);
  }
  return out.map((c) => ({ title: c.title === 'Untitled' ? '' : c.title, text: c.text.join('\n').trim() }));
}

/* Reads pieces back from a pasted note. An old note's STPCTX1: code wins when it's there and
   whole (that's exactly what was sent); otherwise the readable note. Null when it's neither. */
export function unpack(text) {
  const m = String(text || '').match(/STPCTX1:([A-Za-z0-9+/=\s]+)/);
  if (m) {
    try {
      const list = JSON.parse(fromB64(m[1].replace(/\s+/g, '')));
      if (Array.isArray(list)) return clean(list);
    } catch (e) {}
  }
  const read = readNote(text);
  return read ? clean(read) : null;
}

/* Folds pieces in by title: a new title is added and the same title and words are left alone.
   The same title with different words used to be overwritten without a word (Bring in's silent
   overwrite). Since v2.1.37 (#50) those come back as `conflicts` and nothing is changed: the
   overlap screen (SaveContext.svelte) shows old vs new and the person picks Update, Keep both,
   or Skip for each one. Nothing here is ever deleted. */
export function merge(list, incoming, newId) {
  const out = list.filter((c) => c.title.trim() || c.text.trim()).map((c) => ({ ...c }));
  const conflicts = [];
  let added = 0, same = 0;
  for (const inc of incoming) {
    const key = inc.title.toLowerCase();
    const hit = out.find((c) => c.title.trim().toLowerCase() === key);
    if (!hit) { out.push({ id: newId(), title: inc.title, text: inc.text }); added++; }
    else if (hit.text.trim() !== inc.text.trim()) conflicts.push({ id: hit.id, title: hit.title, old: hit.text, text: inc.text });
    else same++;
  }
  return { list: out, added, updated: 0, same, conflicts };
}

/* Does a new piece overlap one that's already here? The same title (any case), or mostly the
   same words: 60% or more of the new piece's meaning words are in the old one (8 words at least,
   so two short notes never match by accident). Returns the existing piece, or null. */
const STOP = /^(that|this|with|from|have|want|need|about|they|their|them|then|just|like|some|into|your|will|would|should|could|really|very|also|what|when|there|here|been|were|each|which|because|always|never|what's)$/;
const meaning = (t) => [...new Set((String(t).toLowerCase().match(/[a-z0-9][a-z0-9']{3,}/g) || []).filter((w) => !STOP.test(w)))];
export function findOverlap(list, piece) {
  const key = String(piece.title || '').trim().toLowerCase();
  const text = String(piece.text || '').trim();
  const byTitle = key && list.find((c) => c.title.trim().toLowerCase() === key && c.text.trim());
  if (byTitle) return byTitle.text.trim() === text ? null : byTitle;
  const words = meaning(text);
  if (words.length < 8) return null;
  let best = null, top = 0;
  for (const c of list) {
    if (!c.text.trim()) continue;
    const have = new Set(meaning(c.text));
    const share = words.filter((w) => have.has(w)).length / words.length;
    if (share >= 0.6 && share > top) { best = c; top = share; }
  }
  return best;
}
/* A free title for Keep both: "Title (new)", then "Title (new 2)"... within the 60 character cap. */
export function freeTitle(list, title) {
  const taken = new Set(list.map((c) => c.title.trim().toLowerCase()));
  const base = String(title || 'Untitled').trim();
  for (let i = 1; i < 50; i++) {
    const tail = i === 1 ? ' (new)' : ' (new ' + i + ')';
    const t = base.slice(0, MAX_TITLE - tail.length) + tail;
    if (!taken.has(t.toLowerCase())) return t;
  }
  return base.slice(0, MAX_TITLE);
}
