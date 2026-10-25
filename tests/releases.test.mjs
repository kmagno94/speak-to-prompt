// Release registry and release limit (app/lib/releases.js), plus the real releases.json.
// Fast, no browser: node --test tests/releases.test.mjs (npm test runs it first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseVersion, compareVersions, aheadOf, releaseStatus, registryProblems, RELEASE_LIMIT } from '../app/lib/releases.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (version, extra = {}) => ({ version, title: 't', items: ['i'], checks: [{ say: 's', see: 'e' }], ...extra });

test('versions: semver compare, 2.1.10 is newer than 2.1.9, junk counts as oldest', () => {
  assert.deepEqual(parseVersion('v2.1.10'), [2, 1, 10]);
  assert.equal(parseVersion('2.1'), null);
  assert.ok(compareVersions('2.1.10', '2.1.9') > 0);
  assert.ok(compareVersions('3.0.0', '2.99.99') > 0);
  assert.equal(compareVersions('2.1.1', 'v2.1.1'), 0);
  assert.ok(compareVersions('junk', '0.0.1') < 0);
});

test('ahead counts only staging builds newer than live, newest first', () => {
  const list = [rel('2.1.1'), rel('2.1.0'), rel('2.0.1'), rel('2.0.0')];
  assert.deepEqual(aheadOf(list, '2.0.0').map((r) => r.version), ['2.1.1', '2.1.0', '2.0.1']);
  assert.equal(aheadOf(list, '2.1.1').length, 0, 'a promote resets the count to 0');
});

test('status: green, caramel at 4, red at 5, preview shows 5/5 with no builds', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => rel(`1.0.${i + 1}`));
  assert.equal(releaseStatus(mk(3), '1.0.0').tone, 'green');
  assert.equal(releaseStatus(mk(4), '1.0.0').tone, 'caramel');
  const five = releaseStatus(mk(5), '1.0.0');
  assert.equal(five.tone, 'red');
  assert.equal(five.atLimit, true);
  assert.equal(five.label, 'Staging is 5/5 ahead of live');
  const pv = releaseStatus([], '1.0.0', RELEASE_LIMIT, { preview: true });
  assert.equal(pv.count, 5);
  assert.equal(pv.ahead, 0);
});

test('registry problems: version mismatch, order, duplicates, missing checks', () => {
  assert.deepEqual(registryProblems({ releases: [rel('1.0.1'), rel('1.0.0')] }, '1.0.1'), []);
  assert.match(registryProblems({ releases: [rel('1.0.1')] }, '1.0.2').join(' '), /package\.json is 1\.0\.2/);
  assert.match(registryProblems({ releases: [rel('1.0.0'), rel('1.0.1')] }, '1.0.0').join(' '), /newest first/);
  assert.match(registryProblems({ releases: [rel('1.0.1'), rel('1.0.1')] }, '1.0.1').join(' '), /listed twice/);
  assert.match(registryProblems({ releases: [rel('1.0.1', { checks: [] })] }, '1.0.1').join(' '), /at least one check/);
  assert.match(registryProblems({ releases: [rel('1.0.1', { checks: [{ say: 'x' }] })] }, '1.0.1').join(' '), /both "say" and "see"/);
  assert.match(registryProblems({}, '1.0.0').join(' '), /needs a "releases" list/);
});

test('the real releases.json is well formed and matches package.json', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(path.join(root, 'releases.json'), 'utf8'));
  assert.deepEqual(registryProblems(registry, pkg.version), []);
});
