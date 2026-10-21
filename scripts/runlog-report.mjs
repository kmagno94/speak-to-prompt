#!/usr/bin/env node
/* Run log Scorecard: reads the automatic run log (GitHub issue #2, posted by the
   stp-report Worker) and does the math, so the twice-daily review reports exact
   numbers instead of eyeballing tables.

   Usage (from the repo root):
     node scripts/runlog-report.mjs                      all runs
     node scripts/runlog-report.mjs --since 2026-10-18T22:00:00Z
     node scripts/runlog-report.mjs --file comments.json (offline, for tests)
     add --json for machine-readable output

   Needs the gh CLI (already logged in on the review's machine). Read-only. */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'kmagno94/speak-to-prompt';
const RUN_LOG_ISSUE = 2;
const MIN_N = 5;              // fewer runs than this: shown, but marked "too few to trust"
const CLOSE = 0.3;            // an estimate within 30% of the real wait counts as accurate

/* One comment -> one run: { when, ...fields }. Numbers become numbers, yes/no become booleans. */
export function parseComment(c) {
  const run = { when: c.created_at };
  // Backfilled runs were posted later, so their real time is the one in the heading.
  const head = String(c.body || '').match(/^\*\*Run (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC\*\*/);
  if (head) run.when = head[1] + 'T' + head[2] + ':00Z';
  for (const line of String(c.body || '').split('\n')) {
    const m = line.match(/^\|\s*([a-z_]+)\s*\|\s*(.*?)\s*\|$/);
    if (!m || m[1] === 'field') continue;
    const v = m[2];
    run[m[1]] = v === 'yes' ? true : v === 'no' ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  }
  return run.mode !== undefined ? run : null;
}

export function parseRuns(comments) { return comments.map(parseComment).filter(Boolean); }

const num = (x) => typeof x === 'number' && isFinite(x);
function median(a) { const s = a.filter(num).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pct(a, p) { const s = a.filter(num).sort((x, y) => x - y); if (!s.length) return null; return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; }
function share(n, d) { return d ? Math.round((n / d) * 100) : null; }
function round(x, d = 1) { return x == null ? null : Math.round(x * 10 ** d) / 10 ** d; }
/* Pearson correlation: +1 = move together, 0 = no link, -1 = opposite. */
function corr(pairs) {
  const p = pairs.filter(([a, b]) => num(a) && num(b));
  if (p.length < 3) return null;
  const mx = p.reduce((s, [a]) => s + a, 0) / p.length, my = p.reduce((s, [, b]) => s + b, 0) / p.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [a, b] of p) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
  return sxx && syy ? round(sxy / Math.sqrt(sxx * syy), 2) : null;
}
function count(list, key) { const o = {}; for (const r of list) { const k = r[key] ?? '(not logged)'; o[k] = (o[k] || 0) + 1; } return o; }

/* The time you actually sat waiting: reading + writing + any fix (your own answering time not included). */
export function waitOf(r) { return num(r.write_s) ? (r.intake_s || 0) + r.write_s + (num(r.repair_s) ? r.repair_s : 0) : null; }
/* Same depth names the app uses: depth, else Quick mode, else complexity. */
export function depthKey(r) { return r.depth || (/Quick/.test(r.mode || '') ? 'quick' : (r.complexity || 'standard')); }
export function estOf(r) { return num(r.est_s) ? (num(r.est_intake_s) ? r.est_intake_s : 0) + r.est_s : null; }

/* Busy by time of day (Eastern, 3-hour blocks): how often Google's models were busy
   (unavailable, slow, timed out, skipped while resting, or a 503 / no answer) vs at a daily limit. */
const BUSY = /unavailable|was slow|timed out|resting|couldn't be reached/;
export function busyByTime(runs) {
  const blocks = {};
  for (const r of runs) {
    const d = new Date(r.when); if (isNaN(d)) continue;
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(d)) % 24;
    const b = Math.floor(h / 3) * 3, x = (blocks[b] ||= { n: 0, busy: 0, limit: 0, waits: [] });
    x.n++;
    if (BUSY.test(r.detours || '') || /\(503\)|reach Google/.test(r.outcome || '')) x.busy++;
    if (/daily limit/.test(r.detours || '')) x.limit++;
    if (r.outcome === 'ok' && num(waitOf(r))) x.waits.push(waitOf(r));
  }
  const label = (h) => { const f = (x) => (x % 12 || 12) + (x < 12 ? ' AM' : ' PM'); return f(h) + ' to ' + f((h + 3) % 24); };
  return Object.keys(blocks).map(Number).sort((a, b) => a - b).map((b) => ({ block: label(b), n: blocks[b].n, busy_pct: share(blocks[b].busy, blocks[b].n), limit_pct: share(blocks[b].limit, blocks[b].n), wait_p50: round(median(blocks[b].waits)) }));
}

export function scorecard(runs) {
  const ok = runs.filter((r) => r.outcome === 'ok');
  const timed = ok.filter((r) => num(waitOf(r)) && num(estOf(r)));
  const errs = timed.map((r) => Math.abs(waitOf(r) - estOf(r)) / Math.max(1, waitOf(r)));
  const depthKeys = [...new Set(ok.map(depthKey))];
  const byDepth = depthKeys.map((d) => {
    const rs = ok.filter((r) => depthKey(r) === d);
    const t = rs.filter((r) => num(waitOf(r)) && num(estOf(r)));
    return {
      depth: d, n: rs.length,
      write_p50: round(median(rs.map((r) => r.write_s))), write_p90: round(pct(rs.map((r) => r.write_s), 90)),
      est_p50: round(median(rs.map((r) => r.est_s))),
      within: share(t.filter((r) => Math.abs(waitOf(r) - estOf(r)) / Math.max(1, waitOf(r)) <= CLOSE).length, t.length),
      bias: round(median(t.map((r) => waitOf(r) / Math.max(1, estOf(r)))), 2),
      suggest_s: rs.length >= MIN_N ? Math.round(median(rs.map((r) => r.write_s))) : null
    };
  });
  const withX = ok.filter((r) => num(r.xray_pct));
  const repaired = ok.filter((r) => r.repair && r.repair !== 'none');
  const acted = ok.filter((r) => r.action);
  const kept = acted.filter((r) => /^(copied|opened|saved)/.test(r.action));
  const redone = acted.filter((r) => /^(started over|rebuilt)/.test(r.action));
  const models = count(ok, 'write_model');

  const s = {
    runs: runs.length, ok: ok.length, failed: runs.length - ok.length,
    failures: runs.filter((r) => r.outcome !== 'ok').map((r) => ({ when: r.when, outcome: r.outcome })),
    speed: {
      wait_p50: round(median(ok.map(waitOf))), wait_p90: round(pct(ok.map(waitOf), 90)),
      est_within_pct: share(errs.filter((e) => e <= CLOSE).length, errs.length), est_n: errs.length,
      est_median_error_pct: errs.length ? Math.round(median(errs) * 100) : null,
      by_depth: byDepth,
      by_source: Object.entries(count(timed, 'est_from')).map(([src, n]) => {
        const t = timed.filter((r) => (r.est_from ?? '(not logged)') === src);
        return { src, n, within: share(t.filter((r) => Math.abs(waitOf(r) - estOf(r)) / Math.max(1, waitOf(r)) <= CLOSE).length, t.length) };
      }),
      busy_plan: { n: ok.filter((r) => r.busy_plan).length, wait_p50: round(median(ok.filter((r) => r.busy_plan).map(waitOf))), moved: ok.filter((r) => /first/.test(r.busy_plan || '')).length },
      away: { n: ok.filter((r) => num(r.hidden_s) && r.hidden_s > 0).length, secs_p50: round(median(ok.map((r) => r.hidden_s).filter((x) => num(x) && x > 0))) },
      size_link: { words_in: corr(ok.map((r) => [r.words_in, r.write_s])), words_out: corr(ok.map((r) => [r.words_out, r.write_s])) }
    },
    models: {
      write: models,
      fallback_pct: share(ok.filter((r) => r.detours).length, ok.length),
      detours: ok.filter((r) => r.detours).map((r) => r.detours),
      by_time: busyByTime(runs)
    },
    quality: {
      n: withX.length,
      xray_pct_p50: round(median(withX.map((r) => r.xray_pct)), 0),
      dropped_pct: share(withX.filter((r) => r.xray_dropped > 0).length, withX.length),
      stray_pct: share(withX.filter((r) => r.xray_stray > 0).length, withX.length),
      num_flag_pct: share(ok.filter((r) => r.num_flags > 0).length, ok.filter((r) => num(r.num_flags)).length),
      coach_p50: median(withX.map((r) => r.coach)),
      coach_vs_xray: corr(withX.map((r) => [r.coach, r.xray_pct])),
      repair: { ran: repaired.length, ran_pct: share(repaired.length, withX.length), ...count(repaired, 'repair'), secs_p50: round(median(repaired.map((r) => r.repair_s))) }
    },
    grades: gradesOf(ok),
    use: {
      n: acted.length, actions: count(acted, 'action'),
      kept_pct: share(kept.length, acted.length), redone_pct: share(redone.length, acted.length),
      xray_opened_pct: share(acted.filter((r) => r.xray_opened === true).length, acted.length)
    }
  };
  s.flags = flagsFor(s);
  return s;
}

/* Quality grades (the fast model's second opinion on each finished prompt) and
   how they move with each lessons.json version. The review uses these to add,
   keep, or retire lessons. */
export function gradesOf(ok) {
  const g = ok.filter((r) => num(r.grade));
  const avg = (rs) => (rs.length ? round(rs.reduce((a, r) => a + r.grade, 0) / rs.length, 2) : null);
  const missing = {};
  for (const r of g) for (const m of String(r.grade_missing || '').split('+')) if (m && m !== 'none') missing[m] = (missing[m] || 0) + 1;
  const versions = [...new Set(g.map((r) => (num(r.lessons_v) ? r.lessons_v : 0)))].sort((a, b) => a - b);
  return {
    n: g.length, avg: avg(g), p50: median(g.map((r) => r.grade)),
    rearranged_pct: share(g.filter((r) => r.grade_rearranged === true).length, g.length),
    invented_pct: share(g.filter((r) => r.grade_invented === true).length, g.length),
    missing: Object.entries(missing).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n, pct: share(n, g.length) })),
    by_model: [...new Set(g.map((r) => String(r.write_model || '').replace(/^gemini-/, '')))].filter(Boolean).map((m) => { const rs = g.filter((r) => String(r.write_model || '').replace(/^gemini-/, '') === m); return { model: m, n: rs.length, avg: avg(rs) }; }),
    by_lessons: versions.map((v) => { const rs = g.filter((r) => (num(r.lessons_v) ? r.lessons_v : 0) === v); return { v, n: rs.length, avg: avg(rs) }; })
  };
}

/* Things the review should act on or raise with Kevin. */
export function flagsFor(s) {
  const f = [];
  if (s.failed) f.push(`${s.failed} run(s) failed: ${s.failures.map((x) => x.outcome).join('; ')}`);
  if (s.speed.est_n >= MIN_N && s.speed.est_within_pct < 60) f.push(`Estimates are off: only ${s.speed.est_within_pct}% within 30% of the real wait. Recalibrate defaults where a depth has a suggested value (auto-approved).`);
  for (const d of s.speed.by_depth) if (d.suggest_s && d.est_p50 && Math.abs(d.suggest_s - d.est_p50) / d.suggest_s > CLOSE) f.push(`${d.depth}: estimate ${d.est_p50}s vs real ${d.suggest_s}s (median of ${d.n}).`);
  if (s.ok >= MIN_N && s.models.fallback_pct >= 30) f.push(`Model fallbacks in ${s.models.fallback_pct}% of runs. Check limits and routing (Kevin's call).`);
  if (s.quality.n >= MIN_N && s.quality.stray_pct >= 20) f.push(`Made-up numbers in ${s.quality.stray_pct}% of final prompts after repair. Look at the WRITE prompt (Kevin's call).`);
  if (s.quality.n >= MIN_N && s.quality.dropped_pct >= 30) f.push(`Details still dropped in ${s.quality.dropped_pct}% of final prompts. Look at repairs and the WRITE prompt (Kevin's call).`);
  if ((s.quality.repair.failed || 0) + (s.quality.repair['kept original'] || 0) >= 3 && s.quality.repair.ran && ((s.quality.repair.fixed || 0) / s.quality.repair.ran) < 0.5) f.push(`Auto-Repair helped in under half its tries (${s.quality.repair.fixed || 0} of ${s.quality.repair.ran}).`);
  const g = s.grades;
  if (g && g.n >= MIN_N && g.rearranged_pct >= 30) f.push(`Graded prompts read like rearranged words in ${g.rearranged_pct}% of runs. Consider a lesson (lessons.json rules).`);
  if (g && g.n >= MIN_N && g.invented_pct >= 20) f.push(`Graded prompts added things nobody said in ${g.invented_pct}% of runs. Consider a lesson (lessons.json rules).`);
  if (g && g.n >= MIN_N) for (const m of g.missing) if (m.pct >= 40) f.push(`Graded prompts were missing "${m.label}" in ${m.pct}% of runs. Consider a lesson (lessons.json rules).`);
  if (g && g.by_lessons.length >= 2) {
    const [prev, cur] = g.by_lessons.slice(-2);
    if (prev.n >= MIN_N && cur.n >= MIN_N && cur.avg != null && prev.avg != null && prev.avg - cur.avg >= 0.5) f.push(`Lessons v${cur.v} grades ${cur.avg} vs v${prev.v} ${prev.avg}: the newest lesson change made prompts worse. Revert it (lessons.json rules).`);
  }
  if (s.use.n >= MIN_N && s.use.redone_pct >= 30) f.push(`${s.use.redone_pct}% of prompts were redone (started over or rebuilt). Something isn't landing.`);
  return f;
}

const fmt = (x, unit = '') => (x == null ? 'n/a' : x + unit);
const few = (n) => (n < MIN_N ? ` (only ${n}, too few to trust)` : '');

export function markdown(s, since) {
  const L = [];
  L.push(`### Scorecard${since ? ' since ' + since : ' (all runs)'}`, '');
  L.push(`**Runs:** ${s.runs} (${s.ok} ok, ${s.failed} failed)`, '');
  L.push('**Speed and estimates**', '', '| Measure | Value |', '|---|---|',
    `| Wait (reading + writing + fix), typical | ${fmt(s.speed.wait_p50, 's')} |`,
    `| Wait, slow runs (90th percentile) | ${fmt(s.speed.wait_p90, 's')} |`,
    `| Estimate within 30% of real wait | ${fmt(s.speed.est_within_pct, '%')}${few(s.speed.est_n)} |`,
    `| Typical estimate miss | ${fmt(s.speed.est_median_error_pct, '%')} |`,
    `| Longer request means longer write? (words in, -1 to 1) | ${fmt(s.speed.size_link.words_in)} |`,
    `| Longer prompt means longer write? (words out) | ${fmt(s.speed.size_link.words_out)} |`,
    `| Busy-hours plan used (less busy model first and/or backup at 30s) | ${s.speed.busy_plan ? s.speed.busy_plan.n + (s.speed.busy_plan.n ? ', typical wait ' + fmt(s.speed.busy_plan.wait_p50, 's') + ', started on another model ' + s.speed.busy_plan.moved + 'x' : '') : 0} |`,
    `| Runs where you left the app mid-run (that time is left out of the wait) | ${s.speed.away.n}${s.speed.away.n ? ', typical ' + s.speed.away.secs_p50 + 's away' : ''} |`, '');
  if (s.speed.by_depth.length) {
    L.push('| Depth | Runs | Write typical | Write slow | Estimate | Within 30% | Real / estimate | Suggested default |', '|---|---|---|---|---|---|---|---|');
    for (const d of s.speed.by_depth) L.push(`| ${d.depth} | ${d.n} | ${fmt(d.write_p50, 's')} | ${fmt(d.write_p90, 's')} | ${fmt(d.est_p50, 's')} | ${fmt(d.within, '%')} | ${fmt(d.bias, 'x')} | ${d.suggest_s ? d.suggest_s + 's' : 'need ' + MIN_N + ' runs'} |`);
    L.push('');
  }
  if (s.speed.by_source.length) L.push('Where estimates came from: ' + s.speed.by_source.map((x) => `${x.src} ${x.n} (${fmt(x.within, '%')} within 30%)`).join(', ') + '.', '');
  L.push('**Quality**' + few(s.quality.n), '', '| Measure | Value |', '|---|---|',
    `| Your words in the final prompt, typical | ${fmt(s.quality.xray_pct_p50, '%')} |`,
    `| Prompts still missing a detail | ${fmt(s.quality.dropped_pct, '%')} |`,
    `| Prompts with a made-up number | ${fmt(s.quality.stray_pct, '%')} |`,
    `| Number check warnings | ${fmt(s.quality.num_flag_pct, '%')} |`,
    `| Ghost Coach score, typical | ${fmt(s.quality.coach_p50, ' of 5')} |`,
    `| Better coach score means more of your words kept? (-1 to 1) | ${fmt(s.quality.coach_vs_xray)} |`,
    `| Auto-Repair ran | ${s.quality.repair.ran} (${fmt(s.quality.repair.ran_pct, '%')}): fixed ${s.quality.repair.fixed || 0}, kept original ${s.quality.repair['kept original'] || 0}, failed ${s.quality.repair.failed || 0}, typical ${fmt(s.quality.repair.secs_p50, 's')} |`, '');
  const g = s.grades || { n: 0, missing: [], by_lessons: [] };
  L.push('**Prompt grades (fast model, 1 to 5)**' + few(g.n), '', '| Measure | Value |', '|---|---|',
    `| Graded runs | ${g.n} |`,
    `| Grade, average | ${fmt(g.avg, ' of 5')} |`,
    `| Reads like rearranged words | ${fmt(g.rearranged_pct, '%')} |`,
    `| Added something nobody said | ${fmt(g.invented_pct, '%')} |`,
    `| Most often missing | ${g.missing.length ? g.missing.map((m) => m.label + ' ' + m.pct + '%').join(', ') : 'nothing yet'} |`,
    `| By write model | ${(g.by_model || []).length ? g.by_model.map((b) => b.model + ': ' + fmt(b.avg) + ' (' + b.n + ')').join(', ') : 'n/a'} |`,
    `| By lessons version | ${g.by_lessons.length ? g.by_lessons.map((b) => 'v' + b.v + ': ' + fmt(b.avg) + ' (' + b.n + ' runs)').join(', ') : 'n/a'} |`, '');
  L.push('**What happened next**' + few(s.use.n), '', '| Measure | Value |', '|---|---|',
    `| Kept (copied, opened an AI, or saved) | ${fmt(s.use.kept_pct, '%')} |`,
    `| Redone (started over or rebuilt) | ${fmt(s.use.redone_pct, '%')} |`,
    `| Opened X-ray | ${fmt(s.use.xray_opened_pct, '%')} |`,
    `| All actions | ${Object.entries(s.use.actions).map(([k, v]) => k + ' ' + v).join(', ') || 'none yet'} |`, '');
  L.push('**Models**', '', `Write models: ${Object.entries(s.models.write).map(([k, v]) => k + ' ' + v).join(', ') || 'n/a'}. Fallbacks in ${fmt(s.models.fallback_pct, '%')} of runs.`, '');
  L.push('Busy by time of day (Eastern):', '', '| Time | Runs | Models busy | Hit a daily limit | Typical wait |', '|---|---|---|---|---|',
    ...s.models.by_time.map((t) => `| ${t.block} | ${t.n}${t.n < MIN_N ? ' (too few to trust)' : ''} | ${fmt(t.busy_pct, '%')} | ${fmt(t.limit_pct, '%')} | ${fmt(t.wait_p50, 's')} |`), '');
  L.push('**Flags**', '', ...(s.flags.length ? s.flags.map((x) => '- ' + x) : ['- None']));
  return L.join('\n');
}

/* Busy hours: per 3-hour block (Eastern), how often each write model was busy
   (unavailable, slow, timed out, unreachable, at a limit, or skipped while
   resting). Where the usual first model was busy at least half the time (5+
   tries), the app starts on a clearly less busy Flash model there (3+ tries, at
   least 25 points less busy, and busy under half the time) and starts a backup
   after 30 seconds instead of waiting up to 90. Flash-Lite is never the start,
   to keep quality. Only the last 14 days count, so it follows Google's load. */
const BUSY_MODEL = /(unavailable|was slow|timed out|couldn't be reached|daily limit|skipped)/;
const RACE_S = 30;
export function easternHour(when) {
  const d = new Date(when); if (isNaN(d)) return null;
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(d)) % 24;
}
export function busyPlan(runs) {
  const ok = runs.filter((r) => r.outcome === 'ok' && r.write_model);
  const newest = Math.max(0, ...ok.map((r) => Date.parse(r.when) || 0));
  const recent = ok.filter((r) => newest - (Date.parse(r.when) || 0) <= 14 * 864e5);
  const blocks = {}, total = {};
  for (const r of recent) {
    const h = easternHour(r.when); if (h == null) continue;
    const x = (blocks[Math.floor(h / 3) * 3] ||= {}), seen = new Set();
    const tally = (k, bad) => { if (seen.has(k)) return; seen.add(k); const y = (x[k] ||= { tries: 0, busy: 0 }); y.tries++; if (bad) y.busy++; total[k] = (total[k] || 0) + 1; };
    for (const part of String(r.detours || '').split(';')) { const m = part.trim().match(/^(?:gemini-)?(\d[\d.]*-flash(?:-lite)?)\s+(.*)$/); if (m) tally(m[1], BUSY_MODEL.test(m[2])); }
    for (const w of String(r.write_model).split(',')) tally(w.trim().replace(/^gemini-/, ''), false);
  }
  const first = Object.keys(total).filter((k) => !/lite/.test(k)).sort((a, b) => total[b] - total[a])[0];
  const plan = {};
  for (const [b, x] of Object.entries(blocks)) {
    const f = x[first];
    if (!f || f.tries < MIN_N || f.busy / f.tries < 0.5) continue;
    const pf = share(f.busy, f.tries);
    const better = Object.entries(x).filter(([k, y]) => k !== first && !/lite/.test(k) && y.tries >= 3 && share(y.busy, y.tries) <= pf - 25 && y.busy / y.tries < 0.5)
      .sort((a, b) => a[1].busy / a[1].tries - b[1].busy / b[1].tries)[0];
    plan[b] = { start: better ? better[0] : null, race_s: RACE_S,
      why: `${first} busy ${f.busy} of ${f.tries}` + (better ? `, ${better[0]} busy ${better[1].busy} of ${better[1].tries}` : ', no Flash model clearly less busy') };
  }
  return plan;
}

/* tuning.json: typical seconds per depth from the most recent ok runs, for
   phones that haven't learned their own times yet. Only depths with enough runs. */
const RECENT = 20;
export function tuningFrom(runs, now = new Date().toISOString()) {
  const ok = runs.filter((r) => r.outcome === 'ok').sort((a, b) => String(a.when).localeCompare(String(b.when)));
  const pick = (rs, field) => {
    const v = rs.map((r) => r[field]).filter(num).slice(-RECENT);
    return v.length >= MIN_N ? { secs: Math.max(1, Math.round(median(v))), runs: v.length } : null;
  };
  const depth = {};
  for (const d of [...new Set(ok.map(depthKey))].sort()) { const t = pick(ok.filter((r) => depthKey(r) === d), 'write_s'); if (t) depth[d] = t; }
  return { note: 'Typical wait times from the run log (issue #2), written by the review. The app uses these until a phone has learned its own. busy: 3-hour blocks (Eastern, by start hour) where the usual writer is busy at least half the time; the app starts on the less busy model there and races a backup after race_s seconds.', updated: now.slice(0, 16).replace('T', ' ') + ' UTC', intake: pick(ok, 'intake_s'), depth, busy: busyPlan(runs) };
}

function fetchComments(since) {
  const q = `repos/${REPO}/issues/${RUN_LOG_ISSUE}/comments?per_page=100` + (since ? '&since=' + encodeURIComponent(since) : '');
  const out = execFileSync('gh', ['api', '--paginate', '--slurp', q], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out).flat();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const since = arg('--since');
  const file = arg('--file');
  let comments = file ? JSON.parse(readFileSync(file, 'utf8')) : fetchComments(since);
  if (since) comments = comments.filter((c) => c.created_at >= new Date(since).toISOString().slice(0, 19));
  if (process.argv.includes('--tuning')) {
    const out = arg('--tuning') && !arg('--tuning').startsWith('--') ? arg('--tuning') : 'tuning.json';
    const t = tuningFrom(parseRuns(comments));
    writeFileSync(out, JSON.stringify(t, null, 2) + '\n');
    console.log(JSON.stringify(t, null, 2));
    process.exit(0);
  }
  const s = scorecard(parseRuns(comments));
  console.log(process.argv.includes('--json') ? JSON.stringify(s, null, 2) : markdown(s, since));
}
