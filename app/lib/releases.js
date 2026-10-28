/* Release registry and release limit, ported from B&B Daily's continuous improvement loop
   (whatsNew + testlab, v3.45+), cut down for a static site.
   - releases.json at the repo root lists every staging build, newest first. Its top entry's
     version always matches package.json, and each entry carries the checks to run before promote.
   - Live = the version in main's package.json. Staging is N builds ahead when releases.json has
     N entries newer than that. A promote (staging merged into main) resets it to 0 by itself.
   - At RELEASE_LIMIT builds ahead, stop building: test staging and promote first.
   Plain JS, no Svelte runes, so the deploy check and the tests can use it too. */

export const RELEASE_LIMIT = 5;

/* "2.1.10" -> [2, 1, 10]. A leading v is fine. Anything else -> null. */
export function parseVersion(v) {
  const m = String(v || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/* Sort helper: > 0 when a is newer. Unparseable versions count as oldest. */
export function compareVersions(a, b) {
  const x = parseVersion(a) || [-1, 0, 0], y = parseVersion(b) || [-1, 0, 0];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/* Staging releases newer than live, newest first. */
export const aheadOf = (releases = [], live = '') =>
  releases.filter((r) => compareVersions(r.version, live) > 0).sort((a, b) => compareVersions(b.version, a.version));

/* N/5 status. preview shows the capped look without any real builds (B&B's Preview 5/5). */
export function releaseStatus(releases, live, limit = RELEASE_LIMIT, { preview = false } = {}) {
  const ahead = aheadOf(releases, live).length;
  const count = preview ? limit : ahead;
  return {
    live: live || '(none yet)',
    ahead,
    count,
    limit,
    atLimit: count >= limit,
    tone: count >= limit ? 'red' : count >= limit - 1 ? 'caramel' : 'green',
    label: `Staging is ${count}/${limit} ahead of live`
  };
}

/* Shape problems in releases.json, as plain sentences ([] = fine). pkgVersion is package.json's. */
export function registryProblems(registry, pkgVersion) {
  const list = registry && Array.isArray(registry.releases) ? registry.releases : null;
  if (!list) return ['releases.json needs a "releases" list.'];
  if (!list.length) return ['releases.json has no releases yet.'];
  const out = [];
  const seen = new Set();
  list.forEach((r, i) => {
    const where = `releases.json entry ${i + 1}`;
    if (!parseVersion(r.version)) out.push(`${where}: version "${r.version}" should look like 2.1.1.`);
    else if (seen.has(r.version)) out.push(`${where}: version ${r.version} is listed twice.`);
    seen.add(r.version);
    if (!r.title) out.push(`${where}: add a short title.`);
    if (!Array.isArray(r.items) || !r.items.length) out.push(`${where}: add at least one plain-English item.`);
    if (!Array.isArray(r.checks) || !r.checks.length) out.push(`${where}: add at least one check (say + see).`);
    else r.checks.forEach((c, j) => { if (!c || !c.say || !c.see) out.push(`${where}, check ${j + 1}: needs both "say" and "see".`); });
    if (i && compareVersions(list[i - 1].version, r.version) <= 0) out.push(`${where}: list newest first (${r.version} sits under ${list[i - 1].version}).`);
  });
  if (pkgVersion && list[0].version !== pkgVersion) out.push(`package.json is ${pkgVersion} but the newest releases.json entry is ${list[0].version}. Bump one to match the other.`);
  return out;
}
