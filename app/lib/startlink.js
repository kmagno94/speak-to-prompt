/* Starter links (AGT-9, v2.1.33): every starter category has its own link, like
   #start=food, that opens the app with Not sure where to start? open and that
   category picked, so a friend lands on the quick taps in one tap. Only the
   category id is in the link, never anything typed. */
import { CATEGORIES } from './starters.js';

/* -> the category for a #start= link, or null. The dev-only category never opens from a link. */
export function startCategory(hash) {
  const m = /^#start=([a-z]+)$/i.exec(String(hash || ''));
  if (!m) return null;
  return CATEGORIES.find((c) => c.id === m[1].toLowerCase() && !c.dev) || null;
}

export function startLink(cat) {
  if (!cat || cat.dev || typeof location === 'undefined') return '';
  return location.origin + location.pathname + '#start=' + cat.id;
}
