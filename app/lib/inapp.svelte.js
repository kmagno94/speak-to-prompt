/* In-app browser rescue (AGT-147). Links tapped inside Instagram, Facebook, TikTok, or
   Snapchat open in that app's own small browser, where the mic, copying, and a saved key
   often don't work. InAppCard.svelte shows one card about it, once per visit (this tab).
   The only thing saved is a fixed label ("shown" or "continued here"), which also rides on
   run stats while Show run stats is on. The user agent is read here and never stored or sent.
   Staging switch: #inapp shows the card in any browser. */
import { IS_STAGING } from './channel.js';
import { startHere } from './starthere.svelte.js';

const KEY = 'stp-inapp';
const APPS = [
  ['Instagram', /\bInstagram\b/],
  ['Facebook', /FBAN\/|FBAV\//],
  ['TikTok', /TikTok|musical_ly|BytedanceWebview|\btrill_\d/i],
  ['Snapchat', /Snapchat/]
];

/* -> the app whose browser this is, or ''. */
export function inAppName(ua) {
  const hit = APPS.find(([, re]) => re.test(String(ua || '')));
  return hit ? hit[0] : '';
}

/* -> the real browser to send them to, for this kind of device. */
export function realBrowser(ua) {
  if (/iPhone|iPad|iPod/.test(ua || '')) return 'Safari';
  if (/Android/.test(ua || '')) return 'Chrome';
  return 'Safari or Chrome';
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

class InApp {
  show = $state(false);
  app = $state('');        // '' with the staging switch in a normal browser
  browser = realBrowser(ua);
  stat = '';               // run stats: '', 'shown' or 'continued here'

  constructor() {
    try { this.stat = sessionStorage.getItem(KEY) || ''; } catch (e) {}
    const name = inAppName(ua);
    if (name && !this.stat) this.#open(name);
    if (typeof window === 'undefined' || !IS_STAGING) return;
    const test = () => {
      if (!/^#inapp/.test(location.hash)) return;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      this.#open(name);
    };
    test();
    window.addEventListener('hashchange', test);
  }
  #open(name) {
    this.app = name;
    this.show = true;
    this.#mark('shown');
  }
  #mark(v) {
    this.stat = v;
    try { sessionStorage.setItem(KEY, v); } catch (e) {}
  }
  carryOn() {
    if (!this.show) return;
    this.show = false;
    this.#mark('continued here');
    startHere.resume();
  }
}

export const inApp = new InApp();
