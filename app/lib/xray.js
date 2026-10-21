/* Prompt X-ray: which parts of the prompt came from your words, which were added
   to help, and which of your sentences didn't make it in. All on the phone: it
   compares word stems, so it's fast and free, but heavy rewording can look
   "added" even when the idea was yours. */

const STOP = new Set(('the a an and or but to of in on for with is are was were be been it this that these those ' +
  'i me my mine you your yours we our us so as at by from if about can will would should could just really like ' +
  'do does did have has had not no yes its im dont didnt cant some any all what how when where which who whom ' +
  'also then than them they their there here into up out get got make want need please help let lets ' +
  'very more most much many few one thing things something stuff kind sort way well even still only ' +
  'context task background format output constraints details instructions role tone goal note notes ' +
  'ai assistant prompt using use used being am going gonna wanna maybe yeah okay ok um uh ' +
  'because cause getting gotten kinda sorta honestly basically literally actually pretty guess oh').split(/\s+/));

const COLORS = 6;

/* Rough word stem, so "saving", "saves", and "saved" all match "save". */
function stem(w) {
  if (/^\$?\d/.test(w)) return w.replace(/[,]/g, '').replace(/\.0+$/, '');
  let s = w.replace(/'(s|re|ve|ll|d|t)$/, '');
  if (s.length > 4 && s.endsWith('ies')) return s.slice(0, -3) + 'y';
  for (const suf of ['ingly', 'edly', 'ings', 'ing', 'ers', 'er', 'ed', 'es', 'ly', 's']) {
    if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  return s.replace(/(.)\1$/, '$1');   // "planning" -> "plann" -> "plan"
}

function wordsOf(text) { return String(text || '').toLowerCase().match(/\$?\d[\d,]*(?:\.\d+)?|[a-z]+(?:'[a-z]+)?/g) || []; }

function stems(text) {
  const out = new Set();
  for (const w of wordsOf(text)) if (!STOP.has(w.replace(/'.*$/, '')) && (w.length > 1 || /\d/.test(w))) out.add(stem(w));
  return out;
}

/* Short forms like "vs." and "e.g." end with a dot but don't end the sentence. */
const ABBREV = /\b(vs|e\.g|i\.e|etc|approx|dr|mr|mrs|ms|jr|sr|a\.m|p\.m)\.$/i;
function sentences(text) {
  const out = [];
  for (const line of String(text || '').split(/\n+/)) {
    let first = true;
    for (const piece of line.split(/(?<=[.!?])\s+(?=\S)/)) {
      const t = piece.trim();
      if (!t) continue;
      if (!first && ABBREV.test(out[out.length - 1])) out[out.length - 1] += ' ' + t;   // never joins across lines
      else out.push(t);
      first = false;
    }
  }
  return out;
}

/* What an added part is for, in plain words. */
function whyAdded(t) {
  if (/^(you are|act as|as an?|imagine you)/i.test(t)) return 'Expert role';
  if (/\b(start right away|ask (me )?at most|ask (me )?up to|wait for|before you (answer|start))\b/i.test(t)) return 'How to start';
  if (/\b(format|table|bullet|heading|list|numbered|bold|markdown|sections?)\b/i.test(t)) return 'Format';
  if (/\b(tone|friendly|casual|formal|plain language|plain words|simple words)\b/i.test(t)) return 'Tone';
  if (/\b(steps?|step by step|walk me through|troubleshoot|limits?|edge cases?)\b/i.test(t)) return 'Extra coverage';
  if (/\b(example|sample)\b/i.test(t)) return 'Example';
  return 'Guidance';
}

const WHY_TEXT = {
  'Expert role': 'Tells the AI which expert to act as, so it answers with the right know-how.',
  'How to start': 'Tells the AI to get going instead of asking a pile of questions first.',
  'Format': 'Asks for a layout that is easy to read and use.',
  'Tone': 'Sets how the answer should sound.',
  'Extra coverage': 'Asks the AI to cover steps, limits, or troubleshooting so nothing trips you up.',
  'Example': 'Gives the AI an example of a good result.',
  'Guidance': 'Extra direction that helps the AI do a better job.'
};
export function whyText(label) { return WHY_TEXT[label] || WHY_TEXT.Guidance; }

/* Numbers in the prompt that you never said (times, money, versions). */
function strayNumbers(text, said) {
  const have = new Set(wordsOf(said).filter((w) => /\d/.test(w)).map(stem));
  const math = mathOf([...have, ...wordNums(said)]), conv = conversions(text, [...have]);
  return wordsOf(text).filter((w) => /\d/.test(w)).map(stem).filter((n) => !have.has(n) && !conv.has(n) && !(n.includes('$') && math(n)) && !(Number(n) <= 10 && !n.includes('$')));
}

/* Small numbers said as words ("two nights", "split three ways") count for splits. */
const WORD_NUMS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 2 };
export function wordNums(text) { return (String(text || '').toLowerCase().match(/[a-z]+/g) || []).filter((w) => WORD_NUMS[w]).map((w) => String(WORD_NUMS[w])); }

/* Unit conversions of numbers you said are yours too: 140 miles is about 225 km, 38°F is about 3°C.
   Returns the numbers in text (as stems) that are a correct conversion, give or take 2%. */
const CONV = [[/^(km|kilomet)/, (x) => x * 1.609344], [/^(mi\b|miles?)/, (x) => x / 1.609344], [/^(°\s*c|degrees? c|celsius|c\b)/, (x) => (x - 32) * 5 / 9],
  [/^(°\s*f|degrees? f|fahrenheit|f\b)/, (x) => x * 9 / 5 + 32], [/^(kg|kilo)/, (x) => x * 0.453592], [/^(lbs?|pounds?)/, (x) => x / 0.453592]];
export function conversions(text, said) {
  const v = said.map((n) => Number(String(n).replace(/[$,]/g, ''))).filter((x) => !isNaN(x)), out = new Set();
  const re = /(-?\d[\d,]*(?:\.\d+)?)\s*/g; let m;
  while ((m = re.exec(String(text || '')))) {
    const n = Number(m[1].replace(/,/g, '')), unit = String(text).slice(re.lastIndex, re.lastIndex + 12).toLowerCase(), c = CONV.find((u) => u[0].test(unit));
    if (c && v.some((x) => Math.abs(c[1](x) - n) <= Math.max(0.6, Math.abs(c[1](x)) * 0.02))) out.add(stem(m[1].replace(/^-/, '')));
  }
  return out;
}

/* Simple math on numbers you said is yours too (money only, so a made-up count still shows): $200 minus $35.50 is $164.50
   left, and 60% of that is $98.70 (the other 40% is $65.80). Returns a check. */
export function mathOf(said) {
  const key = (x) => String(Math.round(x * 100) / 100);
  const v = [...new Set(said.map((n) => Number(String(n).replace(/[$,]/g, ''))).filter((x) => x > 0))].slice(0, 20);
  const step = new Set(v);
  for (const a of v) for (const b of v) if (a !== b) { step.add(a + b); if (a > b) step.add(a - b); }
  /* Splits and per-night totals: $32 a night for two nights is $64, split three ways is $21.33 each. */
  const small = v.filter((p) => p >= 2 && p <= 12 && p === Math.round(p)), times = new Set(step);
  for (const x of step) for (const p of small) { times.add(x * p); times.add(x / p); }
  for (const x of [...times]) for (const p of small) times.add(x / p);
  const out = new Set([...times].map(key));
  for (const x of step) for (const p of v) if (p < 100) { out.add(key(x * p / 100)); out.add(key(x * (100 - p) / 100)); }
  return (n) => { const x = Number(String(n).replace(/[$,]/g, '')); return x > 0 && out.has(key(x)); };
}

/* prompt: the finished prompt. raw: your thoughts. answers: [{question, answer}].
   core: your core block if it was added (shown as its own part). */
export function analyze(prompt, raw, answers = [], core = '') {
  let body = String(prompt || '');
  let coreText = '';
  if (core && body.trimEnd().endsWith(core.trim())) {
    coreText = core.trim();
    body = body.trimEnd().slice(0, -coreText.length).replace(/\s*$/, '');
  }

  const sources = sentences(raw).map((t) => ({ text: t, kind: 'thought' }))
    .concat((answers || []).filter((a) => a && a.answer).map((a) => ({ text: a.answer, label: a.question, kind: 'answer' })))
    .slice(0, 60)
    .map((s, i) => ({ ...s, i, color: i % COLORS, stems: stems(s.text), used: false }))
    .filter((s) => s.stems.size);
  const said = [raw].concat((answers || []).map((a) => a && a.answer)).join('\n');

  const segments = [];
  let totalWords = 0, fromWords = 0;
  for (const text of sentences(body)) {
    const p = stems(text);
    const n = wordsOf(text).length;
    totalWords += n;
    const stray = strayNumbers(text, said);
    if (!p.size) { segments.push({ text, kind: 'plain', hits: new Set(), stray }); continue; }
    let best = null, bestShared = new Set();
    for (const s of sources) {
      const shared = new Set([...p].filter((x) => s.stems.has(x)));
      if (shared.size > bestShared.size || (shared.size === bestShared.size && shared.size && best && s.stems.size < best.stems.size)) { best = s; bestShared = shared; }
    }
    // Ideas can come from several of your sentences at once, so count words matched anywhere.
    const sharedAll = [...p].filter((x) => sources.some((s) => s.stems.has(x))).length;
    const ratio = sharedAll / p.size;
    const from = best && bestShared.size && ((sharedAll >= 2 && ratio >= 0.2) || (sharedAll >= 1 && p.size <= 2));
    if (from) {
      fromWords += n;
      // every word that came from any of your sentences gets underlined, not just the best match
      const hits = new Set([...p].filter((x) => sources.some((s) => s.stems.has(x))));
      segments.push({ text, kind: 'from', src: best.i, color: best.color, hits, stray });
    } else {
      const label = whyAdded(text);
      segments.push({ text, kind: 'added', why: label, hits: new Set(), stray });
    }
  }

  // A sentence of yours counts as used if most of its words show up somewhere in the prompt.
  const promptStems = stems(body);
  for (const s of sources) {
    const kept = [...s.stems].filter((x) => promptStems.has(x)).length;
    s.used = s.stems.size <= 2 ? kept >= 1 : kept / s.stems.size >= 0.5;
  }

  if (coreText) segments.push({ text: coreText, kind: 'core', hits: new Set(), stray: [] });

  return {
    segments,
    sources: sources.map(({ stems: _s, ...rest }) => rest),
    pct: totalWords ? Math.round((fromWords / totalWords) * 100) : 0,
    added: segments.filter((s) => s.kind === 'added').length,
    dropped: sources.filter((s) => !s.used).length,
    stray: segments.reduce((n, s) => n + s.stray.length, 0)
  };
}

/* Split a segment into words for display, marking ones that came from you
   and numbers you never said. */
export function pieces(seg) {
  return seg.text.split(/(\s+)/).map((t) => {
    const w = (t.toLowerCase().match(/\$?\d[\d,]*(?:\.\d+)?|[a-z]+(?:'[a-z]+)?/) || [])[0];
    const st = w ? stem(w) : '';
    return { t, hit: !!w && seg.hits.has(st), stray: !!w && seg.stray.includes(st) };
  });
}
