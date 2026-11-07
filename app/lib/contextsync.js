/* My context on all your devices (v2.1.28, idea mvxecifv8i68).
   The site has no server and no accounts, so it can't talk to iCloud itself. Apple Notes can:
   "Send to Notes" packs your pieces into one note (readable, plus a restore code at the end)
   and hands it to the share sheet, where you pick Notes. iCloud syncs that note to your iPad and
   Mac. There, copy the note and tap "Bring in": the code is read back into My context.
   Nothing is sent anywhere by the site. The note only goes where you send it.

   Format (plain text, safe to edit the readable part, only the code line is read):
     Speak to Prompt · My context · 3 pieces
     ...how to use it...
     ## Title
     text
     STPCTX1:<base64 of UTF-8 JSON [{ "title", "text" }]>   (wrapped every 76 characters)
   The code is wrapped into short lines (v2.1.28, Test lab report): one giant unbroken line is a
   likely reason Notes' share sheet popped up and closed. Bring in ignores the line breaks.
*/
export const TAG = 'STPCTX1:';
const MAX_PIECES = 50, MAX_TITLE = 60, MAX_TEXT = 6000;

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
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

/* The note: a readable copy for you, then the code the app reads back. */
export function pack(list, date = new Date()) {
  const pieces = clean(list);
  const day = (date.getMonth() + 1) + '/' + date.getDate();
  const head = 'Speak to Prompt · My context · ' + pieces.length + ' piece' + (pieces.length === 1 ? '' : 's') + ' · ' + day;
  const how = 'On another device: copy this whole note, open Speak to Prompt, My context, and tap Bring in. The code at the end is what the app reads.';
  const body = pieces.map((c) => '## ' + (c.title || 'Untitled') + '\n' + c.text.trim()).join('\n\n');
  const code = (TAG + toB64(JSON.stringify(pieces))).match(/.{1,76}/g).join('\n');
  return head + '\n' + how + '\n\n' + body + '\n\n' + code;
}

/* Reads pieces back from a pasted note. Returns null when there's no code or it's broken. */
export function unpack(text) {
  const m = String(text || '').match(/STPCTX1:([A-Za-z0-9+/=\s]+)/);
  if (!m) return null;
  try {
    const list = JSON.parse(fromB64(m[1].replace(/\s+/g, '')));
    return Array.isArray(list) ? clean(list) : null;
  } catch (e) { return null; }
}

/* Folds pieces in by title: a new title is added, the same title with new words is updated,
   the same title and words are left alone. Nothing here is ever deleted. */
export function merge(list, incoming, newId) {
  const out = list.filter((c) => c.title.trim() || c.text.trim()).map((c) => ({ ...c }));
  let added = 0, updated = 0, same = 0;
  for (const inc of incoming) {
    const key = inc.title.toLowerCase();
    const hit = out.find((c) => c.title.trim().toLowerCase() === key);
    if (!hit) { out.push({ id: newId(), title: inc.title, text: inc.text }); added++; }
    else if (hit.text.trim() !== inc.text.trim()) { hit.text = inc.text; updated++; }
    else same++;
  }
  return { list: out, added, updated, same };
}
