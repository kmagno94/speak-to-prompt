// Release check for the staging lane: releases.json is well formed, its newest entry matches
// package.json, and staging is not past the release limit. Exit 1 on any problem.
//
// Live's version comes from main's package.json:
//   - in the deploy:  LIVE_PACKAGE=../live/package.json (the live lane's checkout)
//   - locally:        read with `git show origin/main:package.json` (run `git fetch origin main` first)
// Run: node scripts/check-release.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RELEASE_LIMIT, registryProblems, releaseStatus, aheadOf } from '../app/lib/releases.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const limit = Number(process.env.RELEASE_LIMIT) || RELEASE_LIMIT;
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const notice = (title, msg) => console.log(process.env.GITHUB_ACTIONS ? `::notice title=${title}::${msg}` : `${title}: ${msg}`);
const fail = (msg) => { console.log(process.env.GITHUB_ACTIONS ? `::error title=Release check failed::${msg}` : `FAIL  ${msg}`); };

let registry = null;
try { registry = JSON.parse(readFileSync(path.join(root, 'releases.json'), 'utf8')); }
catch (e) { fail('releases.json is missing or is not valid JSON: ' + e.message); process.exit(1); }

const problems = registryProblems(registry, pkg.version);

let live = '';
const livePkg = process.env.LIVE_PACKAGE;
try {
  if (livePkg && existsSync(livePkg)) live = JSON.parse(readFileSync(livePkg, 'utf8')).version;
  else live = JSON.parse(execFileSync('git', ['show', 'origin/main:package.json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).version;
} catch (e) { notice('Live version unknown', 'Could not read main\'s package.json, so the release limit was not checked.'); }

if (live && !problems.length) {
  const st = releaseStatus(registry.releases, live, limit);
  const list = aheadOf(registry.releases, live).map((r) => r.version).join(', ');
  notice('Release limit', `${st.label} (live ${live}${list ? '; on staging only: ' + list : ''}).`);
  // At the limit still passes (that push is the 5th build). Past it fails: test and promote first.
  if (st.ahead > limit) problems.push(`Staging is ${st.ahead} builds ahead of live (limit ${limit}). Run the promote checklist on staging and promote before adding more.`);
}

problems.forEach(fail);
if (problems.length) process.exit(1);
console.log('Release check passed.');
