/* Test lab plan and verdict, plain JS so tests/releases.test.mjs can run it without a browser.
   Ported from B&B Daily's testlab.svelte.js (v3.21 to v3.45), cut down for a static site.
   Plan = every releases.json build newer than live, oldest first so features are tested in the
   order they were built, then the fixed "Before you promote" checks. */
import { aheadOf } from './releases.js';

/* Checks every promote needs that aren't tied to one build. Rewording one resets its result. */
export const BEFORE_PROMOTE = [
  { say: 'On the iPhone, portrait: build one Quick prompt and one Normal prompt, then copy one.', see: 'Nothing overlaps or is cut off, every button responds, and Copy turns into a check.' },
  { say: 'On the iPad: one pass through the first screen, questions, and the result.', see: 'The layout fills the screen and reads well.' },
  { say: 'Turn on iPhone Reduce Motion, build a prompt, then turn it off.', see: 'Everything still works and just snaps into place.' },
  { say: 'Turn on Dark Mode and look at the first screen and a result.', see: 'All text is readable, no white boxes.' }
];

export const stepKey = (version, i) => `${version}#${i}`;

export function labPlan(releases = [], live = '') {
  const builds = aheadOf(releases, live).reverse().map((r) => ({
    version: r.version,
    title: r.title || '',
    steps: (Array.isArray(r.checks) ? r.checks : []).filter((c) => c && c.say && c.see)
      .map((c, i) => ({ key: stepKey(r.version, i), say: String(c.say), see: String(c.see), version: r.version, title: r.title || '' }))
  })).filter((b) => b.steps.length);
  builds.push({ version: '', title: 'Before you promote', steps: BEFORE_PROMOTE.map((c, i) => ({ key: `x-${i}`, ...c, version: '', title: 'Before you promote' })) });
  return { builds, steps: builds.flatMap((b) => b.steps), newest: aheadOf(releases, live)[0]?.version || '' };
}

/* What a run walks: only ✗ steps while any are broken (Re-check), else every step not ✓ yet (Continue). */
export function runSteps(plan, results = {}) {
  const fails = plan.steps.filter((s) => results[s.key]?.s === 'fail');
  if (fails.length) return { steps: fails, recheck: true };
  return { steps: plan.steps.filter((s) => results[s.key]?.s !== 'pass'), recheck: false };
}

export function verdict(plan, results = {}) {
  const total = plan.steps.length;
  const pass = plan.steps.filter((s) => results[s.key]?.s === 'pass').length;
  const fail = plan.steps.filter((s) => results[s.key]?.s === 'fail').length;
  const left = total - pass - fail;
  const ready = total > 0 && pass === total && !!plan.newest;
  let text;
  if (!plan.newest) text = 'Nothing on staging is newer than live. Nothing to promote.';
  else if (fail) text = `Don't promote: ${fail} broken.`;
  else if (left) text = `${pass} of ${total} checked. ${left} to go.`;
  else text = `All ${total} work. Ready to promote v${plan.newest}.`;
  return { total, pass, fail, left, ready, text, promote: ready ? `Pre-flight passed, promote v${plan.newest}` : '' };
}

/* 📋 Copy report: everything a Claude chat needs to fix what broke, ready to paste. Broken
   checks in full (Do, Expected, What happened), then a count of what's left. meta: { staging, live, ahead }. */
export function labReport(plan, results = {}, meta = {}) {
  const v = verdict(plan, results);
  const where = (s) => (s.version ? `v${s.version} · ${s.title}` : 'Before you promote');
  const head = [`Test lab report · staging v${meta.staging || '?'}${meta.live ? ` · live v${meta.live}` : ''}${meta.ahead ? ` · ${meta.ahead} ahead` : ''}`,
    `Result: ${v.fail} broken · ${v.pass} work · ${v.left} not checked`];
  const fails = plan.steps.filter((s) => results[s.key]?.s === 'fail');
  const lines = [...head, ''];
  if (fails.length) {
    lines.push('Broken:');
    fails.forEach((s, i) => {
      const note = String(results[s.key]?.note || '').trim();
      lines.push(`${i + 1}. ${where(s)}`, `   Do: ${s.say}`, `   Expected: ${s.see}`, `   What happened: ${note || '(no note)'}`);
    });
    lines.push('', 'Fix these on staging, add a smoke test for each, then tell me what to re-check in the Test lab.');
  } else if (v.ready) {
    lines.push(`Everything works. ${v.promote}`);
  } else {
    lines.push(`Nothing broken so far. ${v.left} still to check.`);
  }
  return lines.join('\n');
}
