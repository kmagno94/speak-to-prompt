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

/* Test lab plan (app/lib/testlabPlan.js) */
import { labPlan, runSteps, verdict, labReport, unchecked, nextOnRail, BEFORE_PROMOTE } from '../app/lib/testlabPlan.js';

test('test lab plan: builds newer than live, oldest first, then Before you promote', () => {
  const list = [rel('2.1.2', { checks: [{ say: 'a', see: 'b' }, { say: 'c', see: 'd' }] }), rel('2.1.1'), rel('2.1.0')];
  const plan = labPlan(list, '2.1.0');
  assert.deepEqual(plan.builds.map((b) => b.version), ['2.1.1', '2.1.2', '']);
  assert.equal(plan.steps.length, 1 + 2 + BEFORE_PROMOTE.length);
  assert.equal(plan.newest, '2.1.2');
  assert.equal(plan.steps[1].key, '2.1.2#0');
});

test('test lab runs: Re-check walks only broken steps, Continue skips passed ones', () => {
  const plan = labPlan([rel('1.0.2', { checks: [{ say: 'a', see: 'b' }, { say: 'c', see: 'd' }] })], '1.0.1');
  const k = plan.steps.map((s) => s.key);
  assert.equal(runSteps(plan, {}).steps.length, plan.steps.length);
  const passed = { [k[0]]: { s: 'pass' } };
  assert.equal(runSteps(plan, passed).steps.length, plan.steps.length - 1);
  const r = runSteps(plan, { ...passed, [k[1]]: { s: 'fail' } });
  assert.equal(r.recheck, true);
  assert.deepEqual(r.steps.map((s) => s.key), [k[1]]);
});

test('test lab verdict: broken blocks, all pass is ready with the promote phrase, nothing ahead says so', () => {
  const plan = labPlan([rel('1.0.2')], '1.0.1');
  const all = Object.fromEntries(plan.steps.map((s) => [s.key, { s: 'pass' }]));
  const v = verdict(plan, all);
  assert.equal(v.ready, true);
  assert.equal(v.text, `All ${plan.steps.length} work. Ready to promote v1.0.2.`);
  assert.equal(v.promote, 'Pre-flight passed, promote v1.0.2');
  const bad = verdict(plan, { ...all, [plan.steps[0].key]: { s: 'fail' } });
  assert.equal(bad.ready, false);
  assert.equal(bad.text, "Don't promote: 1 broken.");
  const none = verdict(labPlan([rel('1.0.1')], '1.0.1'), {});
  assert.equal(none.ready, false);
  assert.match(none.text, /Nothing on staging is newer than live/);
});

test('test lab report: broken checks in full with the note, counts, and the ask; all pass carries the promote phrase', () => {
  const plan = labPlan([rel('1.0.2', { title: 'Build 9', checks: [{ say: 'Tap X', see: 'Y shows' }, { say: 'Tap Z', see: 'W shows' }] })], '1.0.1');
  const k = plan.steps.map((s) => s.key);
  const r = labReport(plan, { [k[0]]: { s: 'fail', note: 'nothing happened' }, [k[1]]: { s: 'pass' } }, { staging: '1.0.2', live: '1.0.1', ahead: '1/5' });
  assert.match(r, /^Test lab report · staging v1\.0\.2 · live v1\.0\.1 · 1\/5 ahead/);
  assert.match(r, new RegExp(`Result: 1 broken · 1 work · ${plan.steps.length - 2} not checked`));
  assert.match(r, /1\. v1\.0\.2 · Build 9\n   Do: Tap X\n   Expected: Y shows\n   What happened: nothing happened/);
  assert.ok(!/Tap Z/.test(r), 'passed checks stay out of the report');
  assert.match(r, /Fix these on staging/);
  const all = Object.fromEntries(plan.steps.map((s) => [s.key, { s: 'pass' }]));
  assert.match(labReport(plan, all, { staging: '1.0.2' }), /Everything works\. Pre-flight passed, promote v1\.0\.2/);
});

test('test lab rail: next unchecked after a check, wrapping to the top, skipping marked and skipped ones', () => {
  const plan = labPlan([rel('1.0.2', { checks: [{ say: 'a', see: 'b' }, { say: 'c', see: 'd' }, { say: 'e', see: 'f' }] })], '1.0.1');
  const k = plan.steps.map((s) => s.key);
  const res = { [k[1]]: { s: 'fail' }, [k[2]]: { s: 'pass' } };
  assert.equal(unchecked(plan, res).length, plan.steps.length - 2);
  assert.equal(nextOnRail(plan, res, k[1]).key, k[3], 'after a broken one, the next unchecked');
  assert.equal(nextOnRail(plan, res, k[plan.steps.length - 1]).key, k[0], 'wraps to the top');
  assert.equal(nextOnRail(plan, res, k[1], [k[3]]).key, k[4], 'skipped ones stay out');
  const all = Object.fromEntries(plan.steps.map((s) => [s.key, { s: 'pass' }]));
  assert.equal(nextOnRail(plan, all, k[0]), null, 'nothing left');
});

test('the real releases.json: every check in the Test lab plan has say and see', () => {
  const registry = JSON.parse(readFileSync(path.join(root, 'releases.json'), 'utf8'));
  const plan = labPlan(registry.releases, '0.0.0');
  const declared = registry.releases.reduce((n, r) => n + r.checks.length, 0);
  assert.equal(plan.steps.length, declared + BEFORE_PROMOTE.length, 'a check was dropped from the plan');
});
