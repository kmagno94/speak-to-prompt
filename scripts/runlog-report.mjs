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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = 'kmagno94/speak-to-prompt';
const RUN_LOG_ISSUE = 2;
const MIN_N = 5;              // fewer runs than this: shown, but marked "too few to trust"
const CLOSE = 0.3;            // an estimate within 30% of the real wait counts as accurate

/* One comment -> one run: { when, ...fields }. Numbers become numbers, yes/no become booleans. */
export function parseComment(c) {
  const run = { when: c.created_at };
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
export function estOf(r) { return num(r.est_s) ? (num(r.est_intake_s) ? r.est_intake_s : 0) + r.est_s : null; }

export function scorecard(runs) {
  const ok = runs.filter((r) => r.outcome === 'ok');
  const timed = ok.filter((r) => num(waitOf(r)) && num(estOf(r)));
  const errs = timed.map((r) => Math.abs(waitOf(r) - estOf(r)) / Math.max(1, waitOf(r)));
  const depthKeys = [...new Set(ok.map((r) => r.depth).filter(Boolean))];
  const byDepth = depthKeys.map((d) => {
    const rs = ok.filter((r) => r.depth === d);
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
      size_link: { words_in: corr(ok.map((r) => [r.words_in, r.write_s])), words_out: corr(ok.map((r) => [r.words_out, r.write_s])) }
    },
    models: {
      write: models,
      fallback_pct: share(ok.filter((r) => r.detours).length, ok.length),
      detours: ok.filter((r) => r.detours).map((r) => r.detours)
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
    use: {
      n: acted.length, actions: count(acted, 'action'),
      kept_pct: share(kept.length, acted.length), redone_pct: share(redone.length, acted.length),
      xray_opened_pct: share(acted.filter((r) => r.xray_opened === true).length, acted.length)
    }
  };
  s.flags = flagsFor(s);
  return s;
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
    `| Longer prompt means longer write? (words out) | ${fmt(s.speed.size_link.words_out)} |`, '');
  if (s.speed.by_depth.length) {
    L.push('| Depth | Runs | Write typical | Write slow | Estimate | Within 30% | Real / estimate | Suggested default |', '|---|---|---|---|---|---|---|---|');
    for (const d of s.speed.by_depth) L.push(`| ${d.depth} | ${d.n} | ${fmt(d.write_p50, 's')} | ${fmt(d.write_p90, 's')} | ${fmt(d.est_p50, 's')} | ${fmt(d.within, '%')} | ${fmt(d.bias, 'x')} | ${d.suggest_s ? d.suggest_s + 's' : 'need ' + MIN_N + ' runs'} |`);
    L.push('');
  }
  L.push('**Quality**' + few(s.quality.n), '', '| Measure | Value |', '|---|---|',
    `| Your words in the final prompt, typical | ${fmt(s.quality.xray_pct_p50, '%')} |`,
    `| Prompts still missing a detail | ${fmt(s.quality.dropped_pct, '%')} |`,
    `| Prompts with a made-up number | ${fmt(s.quality.stray_pct, '%')} |`,
    `| Number check warnings | ${fmt(s.quality.num_flag_pct, '%')} |`,
    `| Ghost Coach score, typical | ${fmt(s.quality.coach_p50, ' of 5')} |`,
    `| Better coach score means more of your words kept? (-1 to 1) | ${fmt(s.quality.coach_vs_xray)} |`,
    `| Auto-Repair ran | ${s.quality.repair.ran} (${fmt(s.quality.repair.ran_pct, '%')}): fixed ${s.quality.repair.fixed || 0}, kept original ${s.quality.repair['kept original'] || 0}, failed ${s.quality.repair.failed || 0}, typical ${fmt(s.quality.repair.secs_p50, 's')} |`, '');
  L.push('**What happened next**' + few(s.use.n), '', '| Measure | Value |', '|---|---|',
    `| Kept (copied, opened an AI, or saved) | ${fmt(s.use.kept_pct, '%')} |`,
    `| Redone (started over or rebuilt) | ${fmt(s.use.redone_pct, '%')} |`,
    `| Opened X-ray | ${fmt(s.use.xray_opened_pct, '%')} |`,
    `| All actions | ${Object.entries(s.use.actions).map(([k, v]) => k + ' ' + v).join(', ') || 'none yet'} |`, '');
  L.push('**Models**', '', `Write models: ${Object.entries(s.models.write).map(([k, v]) => k + ' ' + v).join(', ') || 'n/a'}. Fallbacks in ${fmt(s.models.fallback_pct, '%')} of runs.`, '');
  L.push('**Flags**', '', ...(s.flags.length ? s.flags.map((x) => '- ' + x) : ['- None']));
  return L.join('\n');
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
  const s = scorecard(parseRuns(comments));
  console.log(process.argv.includes('--json') ? JSON.stringify(s, null, 2) : markdown(s, since));
}
