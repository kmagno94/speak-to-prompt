/* Staging vs live. The deploy builds the staging branch with APP_CHANNEL=staging and
   serves it from /speak-to-prompt/staging/. That copy of the page:
   - keeps its own saved settings: every localStorage and sessionStorage key gets a
     "stg:" prefix, because staging and live share one web address and would
     otherwise share (and overwrite) each other's saved data
   - shows a STAGING badge with its version, so the two never get mixed up
   main.js imports this first, so the prefix is in place before any other code
   reads storage. The live build skips all of it. */
export const CHANNEL = typeof __CHANNEL__ !== 'undefined' ? __CHANNEL__ : 'live';
export const IS_STAGING = CHANNEL === 'staging';
export const SEMVER = typeof __SEMVER__ !== 'undefined' ? __SEMVER__ : '';
const PREFIX = 'stg:';

if (IS_STAGING && typeof Storage !== 'undefined') {
  const p = Storage.prototype;
  const get = p.getItem, set = p.setItem, del = p.removeItem, key = p.key;
  p.getItem = function (k) { return get.call(this, PREFIX + k); };
  p.setItem = function (k, v) { return set.call(this, PREFIX + k, v); };
  p.removeItem = function (k) { return del.call(this, PREFIX + k); };
  /* clear() on staging only clears staging's keys, never live's. */
  p.clear = function () {
    const own = [];
    for (let i = 0; i < this.length; i++) { const k = key.call(this, i); if (k && k.startsWith(PREFIX)) own.push(k); }
    own.forEach((k) => del.call(this, k));
  };
}

export function showStagingBadge() {
  if (!IS_STAGING) return;
  const build = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  document.title = 'STAGING · ' + document.title;
  const b = document.createElement('div');
  b.className = 'stg-badge';
  b.id = 'stgBadge';
  b.setAttribute('role', 'note');
  b.textContent = 'STAGING' + (SEMVER ? ' · v' + SEMVER : '') + ' · ' + build + ' · test copy, not the live app';
  document.body.prepend(b);
}
