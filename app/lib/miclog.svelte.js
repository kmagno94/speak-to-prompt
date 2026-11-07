/* Mic log (dev tools only): what the browser's speech engine did on each Talk it out run, for
   diagnosing iPhone mic problems like WebKit bug 321436 (iOS 27 Safari hears once per page).
   Event names, counts, timings and error codes only, never your words. Memory only, gone on reload.
   MicButton writes it; it shows in More options > dev tools (v2.1.28, Test lab report: moved there
   from under the mic button once Keep talking was fixed, so it's there for troubleshooting later). */
const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
const appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
const google = !appleTouch && /Chrome\/|Edg\//.test(ua);
const homeScreen = typeof window !== 'undefined' && ((window.navigator && window.navigator.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
const iosVer = (ua.match(/OS (\d+[_.]\d+(?:[_.]\d+)?) like Mac/) || [])[1];

export const micLog = $state({ lines: [] });
let t0 = 0;

/* One line: seconds since the first tap on this page, the run number, and what happened. */
export function micMark(n, what) {
  if (!t0) t0 = Date.now();
  micLog.lines.push('+' + ((Date.now() - t0) / 1000).toFixed(1) + 's  run ' + n + '  ' + what);
  if (micLog.lines.length > 300) micLog.lines.splice(0, micLog.lines.length - 300);
}

export function micLogText() {
  return ['Speak to Prompt mic log',
    'Device: ' + (iosVer ? 'iOS ' + iosVer.replace(/_/g, '.') : appleTouch ? 'Apple touch' : 'computer') + (homeScreen ? ', Home Screen app' : ', browser tab') + ', ' + (google ? "Google's" : "Apple's") + ' speech',
    'UA: ' + ua, '', ...micLog.lines].join('\n');
}
