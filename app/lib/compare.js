/* Compare rounds: an Amazon-style spec table for 2 or 3 Rework rounds, built only from
   the Quality check each round already got (no extra Gemini calls, nothing saved).

   rounds: [{ n, g, words }] where g is that round's grade ({ craft, missing[], invented,
   rearranged, numCheck, broke[] }) or null while it's still grading.

   "Stronger" means: a higher Quality score overall, and for each part of a great prompt,
   having it when another round doesn't. A row only crowns a winner when the rounds differ,
   so a row everyone gets right (or wrong) has no 🏆. */
import { LABEL_NAMES } from './prompts.js';

/* The parts of a great prompt, in the order a reader thinks about them. Short names for
   the table; LABEL_NAMES keeps the longer wording the Quality check uses. */
export const COMPARE_ROWS = [
  { key: 'role', label: 'Who the AI is' },
  { key: 'task', label: 'The exact job' },
  { key: 'context', label: 'Background' },
  { key: 'format', label: 'Shape and length' },
  { key: 'success', label: 'What great looks like' },
  { key: 'constraints', label: 'Your limits' },
  { key: 'steps', label: 'How-to steps' },
  { key: 'ending', label: 'Start-now ending' },
  { key: 'honest', label: 'Sticks to what you said' },
  { key: 'clear', label: 'Reads like instructions' }
];

function has(g, key) {
  if (!g) return null;
  if (key === 'honest') return !g.invented && !(g.numCheck && g.numCheck.length);
  if (key === 'clear') return !g.rearranged;
  return (g.missing || []).indexOf(key) === -1;
}

function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

export function compareRounds(rounds) {
  const list = (rounds || []).filter(Boolean);
  const graded = list.filter((r) => r.g);
  /* Overall: the highest score wins (ties share it). */
  const top = graded.length ? Math.max(...graded.map((r) => r.g.craft)) : null;
  const overall = {
    key: 'overall', label: 'Quality check',
    cells: list.map((r) => (r.g ? { ok: r.g.craft >= 4.5, text: (Math.round(r.g.craft * 10) / 10).toFixed(1) } : { ok: null, text: '…' })),
    win: graded.length > 1 && graded.some((r) => r.g.craft !== top) ? list.map((r, i) => (r.g && r.g.craft === top ? i : -1)).filter((i) => i >= 0) : []
  };
  const rows = COMPARE_ROWS.map((row) => {
    const cells = list.map((r) => {
      const v = has(r.g, row.key);
      return { ok: v, text: v == null ? '…' : v ? '✓' : '✗' };
    });
    const known = cells.filter((c) => c.ok != null);
    const differ = known.length > 1 && known.some((c) => c.ok) && known.some((c) => !c.ok);
    return { key: row.key, label: row.label, hint: LABEL_NAMES[row.key] || '', cells, win: differ ? cells.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0) : [] };
  });
  const length = { key: 'length', label: 'Length', cells: list.map((r) => ({ ok: null, text: (r.words || 0) + ' words' })), win: [] };

  /* Best overall: highest score, then the most ✓, then the newest round. */
  let best = null;
  if (graded.length === list.length && list.length > 1) {
    const ticks = (i) => rows.filter((row) => row.cells[i].ok).length;
    const order = list.map((r, i) => i).sort((a, b) => list[b].g.craft - list[a].g.craft || ticks(b) - ticks(a) || list[b].n - list[a].n);
    const i = order[0];
    const strong = rows.filter((row) => row.win.length && row.win.indexOf(i) !== -1 && row.win.length < list.length).map((row) => row.label);
    best = { n: list[i].n, index: i, why: strong.length ? 'strongest at ' + andList(strong.slice(0, 3)) : 'the highest Quality check' };
  }

  /* Contrasts: for each pair, where one has something the other doesn't. */
  const contrasts = [];
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      if (!list[a].g || !list[b].g) continue;
      const aWins = rows.filter((row) => row.cells[a].ok && !row.cells[b].ok).map((row) => row.label);
      const bWins = rows.filter((row) => row.cells[b].ok && !row.cells[a].ok).map((row) => row.label);
      const A = 'Round ' + list[a].n, B = 'Round ' + list[b].n;
      if (!aWins.length && !bWins.length) contrasts.push(A + ' and ' + B + ' cover the same parts' + (list[a].g.craft === list[b].g.craft ? '.' : ', and ' + (list[a].g.craft > list[b].g.craft ? A : B) + ' scores higher.'));
      if (aWins.length) contrasts.push(A + ' beats ' + B + ' at ' + andList(aWins) + '.');
      if (bWins.length) contrasts.push(B + ' beats ' + A + ' at ' + andList(bWins) + '.');
    }
  }
  return { rounds: list.map((r) => r.n), rows: [overall, ...rows, length], best, contrasts };
}
