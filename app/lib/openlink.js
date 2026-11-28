/* Skip the paste: on computers and iPad, Open in ChatGPT or Claude carries the finished prompt in
   the address (?q=), so the chat opens with it already there. The copy still happens on the same
   tap as the backup. iPhone and Android keep the plain link (an app can swallow the part after the
   question mark), and so does Gemini and any prompt too long for an address. Plain JS, no page
   access, so the tests can use it too. */

/* Off (Kevin, 11/27, privacy): a prompt in the address can sit in browser history. While this
   is false every Open in tap uses the plain link and you paste, as before. */
export const PREFILL_ON = false;
export const PREFILL_MAX = 6000;   /* characters of the encoded prompt */
const PREFILL = { ChatGPT: 'https://chatgpt.com/?q=', Claude: 'https://claude.ai/new?q=' };

/* iPad (it says Macintosh with a touch screen) or a computer. */
export function opensWebsite(nav) {
  const ua = (nav && nav.userAgent) || '';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return true;
  return /Windows NT|Macintosh|X11|CrOS/.test(ua) && !/iPhone|iPod|Android|Mobi/.test(ua);
}

/* The address with the prompt in it, or "" when this tap should use the plain link. */
export function prefillLink(name, prompt, nav) {
  const base = PREFILL[name], text = String(prompt || '');
  if (!base || !text.trim() || !opensWebsite(nav)) return '';
  let q;
  try { q = encodeURIComponent(text); } catch (e) { return ''; }   /* half an emoji can't be encoded */
  return q.length > PREFILL_MAX ? '' : base + q;
}
