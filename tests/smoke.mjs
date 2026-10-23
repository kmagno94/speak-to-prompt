// Speak to Prompt smoke tests. Mocks Gemini, drives the page at phone size,
// and fails (exit 1) on any broken check. Run: npm install && npm test (from the repo root).
// Fast check while working: ONLY=grade npm test runs just the checks whose name
// matches (any word or regex, case ignored). The full run is still what ships.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Tests run against the built app (npm test builds first), the same files GitHub Pages serves.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 8765 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}/`;

function browserPath() {
  const dir = '/opt/pw-browsers';
  if (!existsSync(dir)) return undefined;
  const shell = readdirSync(dir).find(d => d.startsWith('chromium_headless_shell'));
  if (shell) return `${dir}/${shell}/chrome-linux/headless_shell`;
  return undefined;
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: browserPath() });

const results = [];
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
let skipped = 0;
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) { skipped++; return; }
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

/* Gemini mock. opts: models, intake (object), write (string), fail (model -> status), finish (model -> reason) */
async function devOn(p) { await p.evaluate(() => localStorage.setItem('stp-dev', '1')); await p.reload(); }

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], timezoneId: 'America/New_York', ...(opts.ua ? { userAgent: opts.ua } : {}) });
  const p = await ctx.newPage();
  p.errors = [];
  p.calls = [];
  p.repairs = [];   // Auto-Repair requests, kept apart so older tests see only intake and write calls
  p.grades = [];    // quality grade requests (run stats on), also kept apart
  p.fixes = [];     // label fix requests (below the bar, with a label the app can add)
  p.on('pageerror', e => p.errors.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.route(/generativelanguage\.googleapis\.com/, async r => {
    const u = r.request().url(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    const models = opts.models || ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
    if (u.includes('/models?')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ models: models.map(n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] })) }) });
    const model = (u.match(/models\/([^:]+):/) || [])[1];
    const body = JSON.parse(r.request().postData());
    const ask = body.contents[0].parts[0].text;
    const intake = /intake step/.test(ask);
    if (/PROMPT TO FIX:/.test(ask)) {
      p.repairs.push({ model, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: ask });
      if (opts.repairDelay) await new Promise(res => setTimeout(res, opts.repairDelay));
      if (opts.repairFail) return r.fulfill({ status: 503, headers: h, body: JSON.stringify({ error: { code: 503, message: 'mock' } }) });
      const fixed = opts.repair != null ? opts.repair : (opts.write || 'THE PROMPT');
      return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 200 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: fixed }] } }] }) });
    }
    if (/PROMPT TO FINISH:/.test(ask)) {
      p.fixes.push({ model, text: ask });
      if (opts.fixFail) return r.fulfill({ status: 503, headers: h, body: JSON.stringify({ error: { code: 503, message: 'mock' } }) });
      const done = opts.labelFixFn ? opts.labelFixFn(ask, p.fixes.length) : opts.labelFix != null ? opts.labelFix : (opts.write || 'THE PROMPT');
      return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 120 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: done }] } }] }) });
    }
    if (/PROMPT TO GRADE:/.test(ask)) {
      if (opts.regrade && p.grades.length) opts = { ...opts, grade: opts.regrade };
      if (opts.gradeSeq) opts = { ...opts, grade: opts.gradeSeq[Math.min(p.grades.length, opts.gradeSeq.length - 1)] };
      p.grades.push({ model, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, json: !!(body.generationConfig && body.generationConfig.responseMimeType), text: ask });
      if (opts.gradeBusyOnce) { p.busy = p.busy || new Map(); const k = ask.slice(-300); if (!p.busy.has(k)) p.busy.set(k, Date.now()); if (Date.now() - p.busy.get(k) < 400) { return r.fulfill({ status: 503, headers: h, body: JSON.stringify({ error: { code: 503, message: 'This model is currently experiencing high demand.' } }) }); } }
      if (opts.gradeFail) return r.fulfill({ status: 503, headers: h, body: JSON.stringify({ error: { code: 503, message: 'mock' } }) });
      const g = JSON.stringify((opts.gradeFn && opts.gradeFn(ask)) || opts.grade || { craft: 4, rearranged: false, invented: false, missing: [] });
      return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 150 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: g }] } }] }) });
    }
    p.calls.push({ model, intake, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: ask });
    if (!intake && opts.hold === model) { await new Promise(res => { p.release = res; }); try { return await r.fulfill({ status: 503, headers: h, body: '{"error":{"code":503,"message":"mock busy"}}' }); } catch (e) { return; } }
    if (opts.drop && opts.drop[model]) return r.abort('failed');   // no answer at all, like Safari dropping the request
    if (opts.fail && opts.fail[model]) return r.fulfill({ status: opts.fail[model], headers: h, body: JSON.stringify({ error: { code: opts.fail[model], message: 'mock', details: (opts.failDetails && opts.failDetails[model]) || [] } }) });
    const text = intake ? JSON.stringify(opts.intake || { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'standard', questions: [{ question: 'Devices?', choices: ['iPhone'] }] })
      : (opts.write || 'THE PROMPT');
    const finishReason = (opts.finish && opts.finish[model]) || 'STOP';
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 500, thoughtsTokenCount: 100 }, candidates: [{ finishReason, content: { parts: [{ text }] } }] }) });
  });
  if (opts.lessons !== undefined) await p.route(/\/lessons\.json/, r => opts.lessons === null ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.lessons) }));
  /* The real tuning.json has busy hours, which would make tests depend on the time
     of day. Tests get it without "busy" unless they pass their own. */
  const tuning = opts.tuning || (() => { const t = JSON.parse(readFileSync(path.join(ROOT, 'tuning.json'), 'utf8')); delete t.busy; return t; })();
  await p.route(/\/tuning\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tuning) }));
  await p.goto(BASE);
  return p;
}
/* Starter answers rotate, so a given option may be in the next group: tap
   "More options" until it shows up. */
async function pickChip(p, text) {
  for (let i = 0; i < 4; i++) {
    const hit = await p.$(`#starter .chips button:text-is("${text}")`);
    if (hit) return hit.click();
    const more = await p.$('#rotateMore');
    if (!more) break;
    await more.click();
  }
  throw new Error('option not found: ' + text);
}
async function withKey(p) { await p.click('#keyPanel summary'); await p.fill('#gkey', 'FAKE'); }
async function done(p) { await p.waitForFunction(() => document.getElementById('madeBy').textContent.length > 0, null, { timeout: 15000 }); }

await check('quick version works with no key', async () => {
  const p = await page();
  await p.fill('#thoughts', 'help me plan a 5k'); await p.click('#build'); await done(p);
  const out = await p.inputValue('#output');
  expect(/MY RAW THOUGHTS/.test(out) && /help me plan a 5k/.test(out), 'quick prompt missing raw thoughts');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('full flow: Lite asks, Flash writes, answers and category shown', async () => {
  const p = await page();
  await withKey(p);
  await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])');
  await p.click('#qaList .chips button'); await p.click('#qaGo'); await done(p);
  const intake = p.calls.find(c => c.intake), write = p.calls.find(c => !c.intake);
  expect(/lite/.test(intake.model), 'intake should use Flash-Lite, got ' + intake.model);
  expect(write.model === 'gemini-3.8-flash', 'write should use 3.8 Flash, got ' + write.model);
  expect(write.level === 'medium', 'standard request should think at medium, got ' + write.level);
  expect(/A: iPhone/.test(write.text), 'answer not sent to the writer');
  expect(/Pre-Sleep Focus Setup/.test(await p.textContent('#chatName')), 'chat name missing');
  expect(/Category: Shortcuts/.test(await p.textContent('#categoryLine')), 'category line missing');
  expect(await p.inputValue('#output') === 'THE PROMPT', 'prompt not shown');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('Quick mode writes on Flash-Lite at medium thinking', async () => {
  const p = await page();
  await withKey(p); await p.check('#quickMode');
  await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  const write = p.calls.filter(c => !c.intake).pop();
  expect(/lite/.test(write.model) && write.level === 'medium', `got ${write.model} ${write.level}`);
});

await check('falls back to the next Flash when 3.8 is out (429)', async () => {
  const p = await page({ fail: { 'gemini-3.8-flash': 429 }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  expect(p.calls.filter(c => !c.intake).pop().model === 'gemini-3.7-flash', 'did not fall back to 3.7 Flash');
});

await check('Couldn\'t reach Google on one model tries the next model', async () => {
  const p = await page({ drop: { 'gemini-3.8-flash': true }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  expect(p.calls.filter(c => !c.intake).pop().model === 'gemini-3.7-flash', 'did not move on to 3.7 Flash after a dropped request');
  expect(await p.inputValue('#output') === 'THE PROMPT', 'prompt not shown after the backup answered');
  const rest = await p.evaluate(() => localStorage.getItem('stp-model-rest') || '');
  expect(!/3\.8/.test(rest), 'a dropped connection should not put the model on the rest list: ' + rest);
});

await check('cut-off answer (finishReason MAX_TOKENS) is not shown', async () => {
  const p = await page({ finish: { 'gemini-3.8-flash': 'MAX_TOKENS' }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  expect(p.calls.filter(c => !c.intake).pop().model === 'gemini-3.7-flash', 'incomplete answer was accepted');
});

await check('number check flags a changed version, and stays quiet when numbers match', async () => {
  const p = await page({ intake: { title: 'T', need: 'N', category: 'Shortcuts', complexity: 'simple', questions: [] }, write: 'Set it up on iOS 18 at 10:15 PM. Keep it under 400 words.' });
  await withKey(p);
  await p.fill('#thoughts', 'every night at 10:15 on my iPhone, I am on iOS 27'); await p.click('#build'); await done(p);
  const warn = await p.textContent('#numWarn');
  expect(await p.isVisible('#numWarn') && /mentions 18 and 400, which you never said/.test(warn) && /leaves out 27/.test(warn), 'number warning wrong: ' + warn);
  const write = p.calls.find(c => !c.intake);
  expect(/even if you don't recognize it/.test(write.text), 'writer missing the keep-versions rule');
  const q = await page({ intake: { title: 'T', need: 'N', category: 'Shortcuts', complexity: 'simple', questions: [] }, write: 'Set it up on iOS 27 at 10:15 PM. Give me 3 options.' });
  await withKey(q);
  await q.fill('#thoughts', 'every night at 10:15 on my iPhone, I am on iOS 27'); await q.click('#build'); await done(q);
  expect(!(await q.isVisible('#numWarn')), 'number warning showed on a clean prompt');
  expect(!(await q.$('#deepMode')), 'Deep mode should be gone');
  expect(!(await q.$('#example')), 'Try an example should be gone');
  expect(await q.evaluate(() => document.getElementById('starterBtn').closest('.buildrow') !== null), 'Not sure where to start should sit in the Build row');
});

await check('repeat shortcut run replaces the old transcript', async () => {
  const p = await page();
  await p.goto(BASE + '#paste');
  await p.evaluate(() => navigator.clipboard.writeText('OLD memo'));
  await p.click('#bannerPaste'); await p.waitForTimeout(200);
  await p.click('#build'); await p.waitForSelector('#result:not([hidden])');
  await p.evaluate(() => navigator.clipboard.writeText('NEW memo'));
  await p.evaluate(() => { location.href = location.pathname + '#paste'; }); await p.waitForTimeout(300);
  expect(await p.$eval('#result', e => e.hidden), 'old result still showing');
  await p.click('#bannerPaste'); await p.waitForTimeout(200);
  expect(await p.inputValue('#thoughts') === 'NEW memo', 'box was not replaced: ' + await p.inputValue('#thoughts'));
});

await check('run stats: logs numbers only, never words; 4 models listed', async () => {
  const p = await page();
  const sentRuns = [];
  await p.route('https://relay.test/report/run', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    sentRuns.push(r.request().postData());
    return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
  });
  // Run stats off: nothing is sent anywhere
  await withKey(p); await p.fill('#thoughts', 'my secret memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo'); await done(p);
  await p.waitForTimeout(300);
  expect(sentRuns.length === 0, 'runs must not be sent while run stats is off');
  await p.click('#reset');
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await p.fill('#thoughts', 'my secret memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo');
  await p.waitForFunction(() => /Ready|Built/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
  await p.waitForTimeout(400);
  // Run stats on: the record waits until you do something with the prompt
  expect(sentRuns.length === 0, 'the run should wait for what happens next');
  await p.click('#xrayBtn'); await p.click('#copy');
  await p.waitForTimeout(400);
  expect(sentRuns.length === 1, 'one run should be sent once you copy, got ' + sentRuns.length);
  const sent = JSON.parse(sentRuns[0]).run;
  expect(sent.mode && sent.app && sent.device && sent.words_in === 3 && sent.outcome === 'ok' && !('when' in sent), 'run record wrong: ' + sentRuns[0]);
  expect(sent.action === 'copied' && sent.xray_opened === true && typeof sent.est_intake_s === 'number', 'should log what happened next, X-ray, and the reading estimate: ' + sentRuns[0]);
  expect(!/secret|memo|THE PROMPT/.test(sentRuns[0]), 'words leaked into the run log: ' + sentRuns[0]);
  const stored = await p.evaluate(() => (localStorage.getItem('stp-test-log') || '') + (localStorage.getItem('stp-test-usage') || ''));
  expect(stored.length > 0, 'nothing logged');
  expect(!/secret/.test(stored), 'words leaked into storage');
  const rows = await p.$$eval('#usage .m', l => l.length);
  expect(rows === 4, 'expected 4 models in Today\'s usage, got ' + rows);
  await p.uncheck('#statsToggle');
  const after = await p.evaluate(() => [localStorage.getItem('stp-test-log'), localStorage.getItem('stp-test-usage')]);
  expect(!after[0] && !after[1], 'turning stats off did not delete them');
});

await check('Talk it out runs the Speak to Prompt shortcut', async () => {
  const p = await page();
  expect(/name=Speak%20to%20Prompt$/.test(await p.getAttribute('#talkLink', 'href')), 'Talk it out not pointing at Speak to Prompt');
  expect(!(await p.$('#fileMemo')), 'cleanup button should be gone');
});

await check('AI app links: Gemini opens the app on iPhone, web on computers', async () => {
  const p = await page();
  expect(await p.getAttribute('#geminiLink', 'href') === 'https://gemini.google.com/app', 'desktop Gemini link changed');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const m = await ctx.newPage(); await m.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); await m.goto(BASE);
  expect(await m.getAttribute('#geminiLink', 'href') === 'https://gemini.google.com/app/download/mobile', 'iPhone Gemini link not set to the app path');
});

await check('first screen is simple; plain words; copy and open', async () => {
  const p = await page({ intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  for (const id of ['#statsToggle', '#memoGuide']) expect(!(await p.isVisible(id)), id + ' should be folded under More options');
  expect(await p.isVisible('#quickMode'), 'Quick mode should sit next to Build my prompt');
  const qRow = await p.evaluate(() => document.getElementById('quickMode').closest('.row') === document.getElementById('build').closest('.row'));
  expect(qRow, 'Quick mode is not in the Build row');
  expect(await p.isVisible('#bannerPaste') && (await p.textContent('#bannerPaste')).includes('Paste') && !(await p.$('#pasteWrap.banner')), 'a small Paste button should sit on top of the box');
  const above = await p.evaluate(() => document.getElementById('pasteWrap').getBoundingClientRect().bottom <= document.getElementById('thoughts').getBoundingClientRect().top);
  expect(above, 'Paste should be above the text box');
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  const made = await p.textContent('#madeBy');
  expect(/^Ready in \d+s/.test(made) && !/gemini/i.test(made), 'technical words showing: ' + made);
  await p.evaluate(() => { document.querySelectorAll('.openrow a').forEach(a => a.removeAttribute('href')); });
  await p.click('.openrow a >> text=Claude'); await p.waitForTimeout(300);
  expect(await p.evaluate(() => navigator.clipboard.readText()) === 'THE PROMPT', 'Copy and open did not copy the prompt');
});

await check('idea strip: fits the box, clears on tap, fills on Try, returns when empty', async () => {
  const p = await page();
  await p.waitForTimeout(300);
  expect(await p.isVisible('#ideas .ideas-track'), 'ideas not showing on an empty box');
  const fit = await p.evaluate(() => {
    const t = document.getElementById('ideasTrack'), box = document.getElementById('thoughts'), panel = document.getElementById('ideasPanel');
    const tallest = Math.max(...[...t.children].map(d => d.scrollHeight));
    const kids = [...t.children], groups = kids.map(d => d.dataset.group);
    const rounds = []; for (let i = 0; i + 3 <= groups.length; i += 3) rounds.push(new Set(groups.slice(i, i + 3)).size);
    return { tallest, track: t.clientHeight, panelBottom: panel.getBoundingClientRect().bottom, boxBottom: box.getBoundingClientRect().bottom,
      n: new Set(kids.map(d => d.textContent)).size, len: kids.length,
      backToBack: groups.some((g, i) => i && g === groups[i - 1]), fullRounds: rounds.every(x => x === 3) };
  });
  expect(fit.n === 48, 'expected 48 different ideas, got ' + fit.n);
  expect(fit.len % 3 === 0 && fit.fullRounds, 'every round should show each category once');
  expect(!fit.backToBack, 'same category played twice in a row');
  const before = await p.evaluate(() => [document.getElementById('ideasTrack').scrollLeft, document.querySelector('#ideasTry').getAttribute('aria-label')]);
  await p.waitForTimeout(6200); /* one 5-second rotation plus the fade */
  const after = await p.evaluate(() => [document.getElementById('ideasTrack').scrollLeft, document.querySelector('#ideasTry').getAttribute('aria-label')]);
  expect(after[0] > before[0] && after[1] !== before[1], `ideas did not rotate on their own (scroll ${before[0]} to ${after[0]})`);
  expect(after[0] % (await p.$eval('#ideasTrack', t => t.clientWidth)) === 0, 'rotation stopped between two ideas');
  expect(fit.tallest <= fit.track, `longest idea (${fit.tallest}px) taller than the strip (${fit.track}px)`);
  expect(fit.panelBottom <= fit.boxBottom + 1, 'idea panel spills past the box');
  await p.click('#thoughts', { position: { x: 20, y: 12 } });
  await p.waitForTimeout(250);
  expect(!(await p.isVisible('#ideas .ideas-track')), 'ideas did not clear when tapping in');
  await p.click('#build', { trial: true }); await p.evaluate(() => document.activeElement.blur());
  await p.waitForTimeout(1900);
  expect(await p.isVisible('#ideas .ideas-track'), 'ideas did not come back to an empty box');
  await p.click('#ideasTry');
  expect((await p.inputValue('#thoughts')).length > 20, 'Try this one did not fill the box');
  await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(1900);
  expect(!(await p.isVisible('#ideas .ideas-track')), 'ideas came back over text');
  expect(!(await p.isVisible('#ideasShow')), 'Show ideas button showing over text');
  await p.fill('#thoughts', ''); await p.focus('#thoughts'); await p.waitForTimeout(250);
  expect(!(await p.isVisible('#ideas .ideas-track')), 'ideas showing while typing');
  await p.click('#ideasShow'); await p.waitForTimeout(350);
  expect(await p.isVisible('#ideas .ideas-track'), 'Show ideas button did not bring them back');
  expect(!(await p.isVisible('#ideasShow')), 'Show ideas button should hide once ideas are back');
  await p.click('#thoughts', { position: { x: 20, y: 12 } }); await p.waitForTimeout(250);
  await p.click('h1'); await p.waitForTimeout(1900);
  expect(await p.isVisible('#ideas .ideas-track'), 'tapping outside an empty box did not bring the ideas back');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('mode picker (Svelte component): hint follows the mode and the key', async () => {
  const p = await page();
  expect(/Normal: .*Needs a free Gemini key/.test(await p.textContent('#modeHint')), 'Normal without a key should say it needs one');
  await p.check('#quickMode');
  expect(/^Quick: skips/.test(await p.textContent('#modeHint')), 'hint did not switch to Quick');
  await p.check('#normalMode'); await withKey(p);
  expect(!/Needs a free Gemini key/.test(await p.textContent('#modeHint')), 'hint still asks for a key after one was typed');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('chat questions: tap, type, skip, edit an answer, live summary, all sent to the writer', async () => {
  const p = await page({ intake: { title: 'Trip Plan', need: 'N', category: 'Travel', complexity: 'standard', questions: [
    { question: 'Where to?', choices: ['Tokyo', 'Paris'] },
    { question: 'How long?', choices: ['3 days'] },
    { question: 'Budget?', choices: ['Under $1,000'] }] } });
  await withKey(p); await p.fill('#thoughts', 'plan a trip'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])');
  expect(await p.textContent('#qaTitle') === 'Trip Plan', 'chat title missing');
  await p.click('#qaList .chips button >> text=Tokyo');
  await p.waitForSelector('#qaList .msg.ai >> text=How long?');
  await p.fill('#qaOwn', '5 days'); await p.press('#qaOwn', 'Enter');
  await p.waitForSelector('#qaList .msg.ai >> text=Budget?');
  await p.click('#qaList .chips .skip');
  await p.waitForSelector('#qaList .msg.ai >> text=everything I need');
  expect(await p.isVisible('#qaList .msg.ai >> text=Quick check: you tapped a suggested answer'), 'should ask to double-check the tapped answer');
  expect(await p.$$eval('.brief li', l => l.length) === 2, 'summary should list the 2 answered questions');
  expect(await p.$$eval('.brief li em.tapped', l => l.length) === 1, 'only the tapped answer should be marked as suggested');
  await p.click('.brief li button >> text=Tokyo');
  await p.waitForSelector('#qaList .msg.ai >> text=let\'s change that');
  expect(await p.inputValue('#qaOwn') === 'Tokyo', 'changing a tapped answer should load it into the box to say it your way');
  await p.click('#qaList .chips button >> text=Paris');
  await p.waitForSelector('.brief li >> text=Paris');
  await p.click('#qaGo'); await done(p);
  const write = p.calls.find(c => !c.intake).text;
  expect(/A: Paris \(tapped from suggested options\)/.test(write) && /A: 5 days(\n|$)/.test(write) && /treat it as approximate/.test(write), 'writer should know which answers were tapped: ' + write.slice(-200));
  expect(/Q: Where to\?\nA: Paris/.test(write) && /A: 5 days/.test(write) && !/A: Tokyo/.test(write) && !/Budget\?/.test(write), 'writer got the wrong answers: ' + write.slice(-200));
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('not sure where to start: pick a category, tap and type answers, get starting text', async () => {
  const p = await page();
  await p.click('#starterBtn');
  await p.waitForSelector('#starter .cats button');
  expect(await p.$$eval('#starter .cats button', l => l.length) >= 8, 'expected a general option plus specific categories');
  await p.click('#starter .cats button >> text=Money and budgeting');
  await p.waitForSelector("#starter .msg.ai >> text=What's the goal?");
  await pickChip(p, 'Save for something');
  await p.waitForSelector('#starter .msg.ai >> text=What makes it hard?');
  await p.fill('#starterOwn', 'late night delivery'); await p.press('#starterOwn', 'Enter');
  await p.waitForSelector('#starter .msg.ai >> text=Anything else');
  await p.fill('#starterOwn', 'Japan trip next fall, about $1,500'); await p.press('#starterOwn', 'Enter');
  await p.waitForSelector('#starterUse');
  expect(!(await p.isVisible('#result')), 'Return in the helper must not submit the main form');
  expect(await p.$$eval('#starter input[type=range]', l => l.length) === 4, 'expected 4 fine-tune sliders');
  const slide = (id, v) => p.$eval(id, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await slide('#tune-detail', 5); await slide('#tune-tone', 1); await slide('#tune-level', 2);
  await slide('#tune-creative', 4); await slide('#tune-creative', 3);
  expect(/Go deep and cover everything/.test(await p.textContent('#starter .slider:has(#tune-detail) b')), 'slider label did not follow the value');
  await p.click('#starterUse');
  const box = await p.inputValue('#thoughts');
  expect(/money and budgeting/.test(box) && /My goal: Save for something\./.test(box) && /What makes it hard: late night delivery\./.test(box) && /Also: Japan trip next fall, about \$1,500\./.test(box) && /Detail: go deep and cover everything\./.test(box)
    && /Tone: very casual, like a friend\./.test(box) && /My level: I'm fairly new, keep jargon light\./.test(box) && !/Ideas:/.test(box), 'starting text wrong: ' + box);
  await p.waitForSelector('#starter', { state: 'detached', timeout: 2000 }).catch(() => { throw new Error('helper should close after use'); });
  expect(!(await p.isVisible('#ideas .ideas-track')), 'idea strip should clear once the box has text');
  // Typing instead of picking, then Build my prompt straight away
  await p.click('#starterBtn'); await p.waitForSelector('#starter .cats button');
  await p.fill('#starterOwn', 'my car makes a weird noise'); await p.press('#starterOwn', 'Enter');
  await p.waitForSelector('#starter .msg.ai >> text=What kind of help');
  await pickChip(p, 'Fix a problem');
  await p.waitForSelector('#starter .msg.ai >> text=Anything else');
  await p.click("#starter .chips button >> text=That's it");
  expect(await p.inputValue('#tune-detail') === '5' && await p.inputValue('#tune-tone') === '1' && await p.inputValue('#tune-level') === '2', 'sliders should open where they were left');
  await p.click('#starterBuild'); await done(p);
  const out = await p.inputValue('#output');
  expect(/What it's about: my car makes a weird noise\./.test(out) && /What I want: Fix a problem\./.test(out) && !/Also:/.test(out) && /Detail: go deep and cover everything\./.test(out), 'build did not use the starting text with the remembered sliders');
  // Remembered after a reload; Reset puts them back in the middle and forgets them
  await p.reload();
  await p.click('#starterBtn'); await p.waitForSelector('#starter .cats button');
  await p.click('#starter .cats button >> text=Money and budgeting');
  await p.waitForSelector("#starter .msg.ai >> text=What's the goal?");
  await p.click('#starter button.skip'); await p.waitForSelector('#starter .msg.ai >> text=What makes it hard?');
  await p.click('#starter button.skip'); await p.waitForSelector('#starter .msg.ai >> text=Anything else');
  await p.click("#starter .chips button >> text=That's it");
  await p.waitForSelector('#tuneReset');
  expect(await p.inputValue('#tune-detail') === '5', 'sliders should survive a reload');
  await p.click('#tuneReset');
  expect(await p.inputValue('#tune-detail') === '3' && await p.evaluate(() => localStorage.getItem('stp-tune')) === null, 'Reset should center the sliders and forget them');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('idea strip: a swipe never counts as a tap; a clean tap still starts typing', async () => {
  const p = await page();
  await p.waitForTimeout(300);
  const box = await (await p.$('#ideasTrack')).boundingBox();
  const y = box.y + box.height / 2;
  // Swipe: press, drag left 60px while the strip scrolls, release
  await p.mouse.move(box.x + box.width * 0.7, y); await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.7 - 60, y, { steps: 6 });
  await p.$eval('#ideasTrack', t => t.scrollBy({ left: t.clientWidth }));
  await p.mouse.up();
  await p.waitForTimeout(250);
  expect(await p.evaluate(() => document.activeElement.id) !== 'thoughts', 'a swipe opened the text box');
  expect(await p.isVisible('#ideas .ideas-track'), 'ideas cleared after a swipe');
  // Clean tap, after the strip has settled
  await p.waitForTimeout(500);
  await p.mouse.click(box.x + box.width / 2, y);
  await p.waitForTimeout(250);
  expect(await p.evaluate(() => document.activeElement.id) === 'thoughts', 'a clean tap should start typing');
});

await check('core (USER, SOUL, IDENTITY): set up once, added to every prompt, switch, kept on reload, delete', async () => {
  const p = await page(); await devOn(p);
  expect(!(await p.$('#coreToggle')), 'no switch before a core exists');
  await p.click('#starterBtn'); await p.click('#coreBtn');
  await p.waitForSelector('#coreEditor');
  await p.click('#coreEditor .chips button >> text=Student');
  await p.click('#coreEditor .chips button >> text=Visual: tables and lists');
  await p.fill('#coreUser', (await p.inputValue('#coreUser')) + '\nI work at a coffee shop.');
  await p.click('#coreEditor .chips button >> text=Be direct');
  await p.click('#coreEditor .chips button >> text=No hedging or filler');
  await p.click('#coreEditor .chips button >> text=No hedging or filler');   // second tap removes it
  expect(await p.getAttribute('#coreEditor .chips button >> text=Be direct', 'aria-pressed') === 'true', 'tapped option should show as picked');
  expect(!/No hedging/.test(await p.inputValue('#coreSoul')), 'second tap should remove the line');
  await p.click('#coreEditor .chips button >> text=Coach');
  await p.fill('#coreIdentity', 'Keep me on track with school.');
  expect((await p.inputValue('#coreSoul')).match(/Be direct/g).length === 1, 'premade line added twice');
  await p.click('#coreDone'); await p.click('#starterClose');
  expect(await p.isChecked('#coreToggle'), 'core should be on once set up');
  // No-key quick version gets the core block
  await p.fill('#thoughts', 'help me plan my week'); await p.click('#build'); await done(p);
  let out = await p.inputValue('#output');
  expect(/MY CORE/.test(out) && /About me:\n- Student\n- Visual: tables and lists\nI work at a coffee shop\./.test(out) && /How to work with me:\n- Be direct/.test(out) && /Your role with me: Coach\.\nKeep me on track with school\./.test(out), 'core block wrong: ' + out.slice(-300));
  // Kept after reload, and the switch turns it off
  await p.reload(); await p.waitForTimeout(300);
  expect(await p.isChecked('#coreToggle'), 'core not kept after reload');
  await p.click('.coretoggle');
  expect(!(await p.isChecked('#coreToggle')), 'switch did not turn off');
  await p.fill('#thoughts', 'help me plan my week'); await p.click('#build'); await done(p);
  out = await p.inputValue('#output');
  expect(!/MY CORE/.test(out), 'core added while switched off');
  // With a key: the writer sees the core, and the finished prompt ends with it
  await p.click('.coretoggle');
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo'); await done(p);
  const write = p.calls.filter(c => !c.intake).pop().text;
  expect(/THE PERSON'S CORE/.test(write) && /Be direct/.test(write), 'writer did not see the core');
  out = await p.inputValue('#output');
  expect(/^THE PROMPT\n\n---\nMY CORE/.test(out), 'finished prompt should end with the core: ' + out.slice(0, 80));
  expect(!(await p.isVisible('#numWarn')), 'numbers in the core should not trigger the number check');
  // Delete
  await p.click('#starterBtn'); await p.click('#coreBtn'); await p.click('#coreClear'); await p.click('#coreClearYes');
  expect(await p.evaluate(() => localStorage.getItem('stp-core')) === null, 'core not deleted from the phone');
  expect(!(await p.$('#coreToggle')), 'switch should disappear after delete');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('starter: Improve this app writes a starting point with the app background built in', async () => {
  const p = await page(); await devOn(p);
  await p.click('#starterBtn'); await p.click('#starter .cats button >> text=Improve this app');
  await p.waitForSelector('#starter .msg.ai >> text=What do you want to change?');
  await p.click('#starter .chips button >> text=Add a feature');
  await p.waitForSelector('#starter .msg.ai >> text=Which part of the app?');
  await p.click('#starter .chips button >> text=Idea strip');
  await p.waitForSelector('#starter .msg.ai >> text=Anything else');
  await p.fill('#starterOwn', 'let me save favorite ideas'); await p.press('#starterOwn', 'Enter');
  await p.waitForSelector('#starterUse'); await p.click('#starterUse');
  const box = await p.inputValue('#thoughts');
  expect(/improving my Speak to Prompt web app/.test(box) && /Svelte 5 \+ Vite/.test(box) && /tests\/smoke\.mjs/.test(box)
    && /Change: Add a feature\./.test(box) && /Part of the app: Idea strip\./.test(box) && /Also: let me save favorite ideas\./.test(box)
    && /What I want back:/.test(box.split('\n').pop()), 'app starting text wrong: ' + box);
});

await check('dev tools: hidden by default, switch shows them, an existing core turns them on and gets the new ask wording', async () => {
  const p = await page();
  await p.click('#starterBtn'); await p.waitForSelector('#starter .cats button');
  expect(!(await p.$('#coreBtn')) && !(await p.$('#starter .cats button >> text=Improve this app')), 'dev tools should be hidden by default');
  await p.click('#starterClose');
  await p.click('#moreOpts summary'); await p.check('#devTools');
  await p.click('#starterBtn'); await p.waitForSelector('#starter .cats button');
  expect(await p.isVisible('#coreBtn') && await p.isVisible('#starter .cats button >> text=Improve this app'), 'switch should show Your core and Improve this app');
  // A phone that already has a core (Kevin's) gets dev tools on by itself, and the old chip is reworded
  const q = await page();
  await q.evaluate(() => localStorage.setItem('stp-core', JSON.stringify({ user: '- Student', soul: '- Ask before assuming\n- Be direct', role: 'Thinking partner', identity: '', on: true })));
  await q.reload();
  expect(await q.isChecked('#coreToggle'), 'existing core should switch dev tools on');
  await q.fill('#thoughts', 'plan my week'); await q.click('#build'); await done(q);
  const out = await q.inputValue('#output');
  expect(/- Ask if something essential is missing/.test(out) && !/Ask before assuming/.test(out), 'old ask wording should be replaced: ' + out.slice(-200));
  // Switch off: the core stops being added
  await q.click('#moreOpts summary'); await q.uncheck('#devTools');
  await q.fill('#thoughts', 'plan my week again'); await q.click('#build'); await done(q);
  expect(!/MY CORE/.test(await q.inputValue('#output')) && !(await q.$('#coreToggle')), 'dev tools off should drop the core');
});

await check('starter answers: 5 at a time, same all window, new set every 3 hours, More options shows others', async () => {
  const p = await page();
  await p.evaluate(() => localStorage.setItem('stp-dev', '1'));
  const visible = () => p.$$eval('#starter .chips button', l => l.filter(b => !b.classList.contains('skip') && b.id !== 'rotateMore').map(b => b.textContent.trim()));
  async function openMoney(time) {
    await p.clock.setFixedTime(new Date(time));
    await p.reload(); await p.waitForTimeout(150);
    await p.click('#starterBtn'); await p.click('#starter .cats button >> text=Money and budgeting');
    await p.waitForSelector("#starter .msg.ai >> text=What's the goal?");
    return visible();
  }
  const t0 = new Date('2026-10-20T09:10:00-04:00').getTime();   // 9:10 AM Eastern (the test page runs on New York time), inside the 9 to 12 window
  const a = await openMoney(t0);
  const same = await openMoney(t0 + 2.5 * 3600000);              // 11:40 AM, same window
  const next = await openMoney(t0 + 3 * 3600000);                // 12:10 PM, next window
  expect(a.length === 5 && next.length === 5, 'should show 5 options, got ' + a.length + ' and ' + next.length);
  expect(a.join('|') === same.join('|'), 'options changed inside the same 3-hour window');
  expect(a.join('|') !== next.join('|'), 'options did not change in the next window');
  await p.click('#rotateMore');
  const more = await visible();
  expect(more.length === 5 && more.some(x => !next.includes(x)), 'More options should show a different group');
  // Categories never rotate, and the dev category shows every option
  expect((await p.$$eval('#starter .cats button', l => l.length)) === 0, 'categories gone after picking');
  await p.click('#starterClose'); await p.click('#starterBtn');
  await p.click('#starter .cats button >> text=Improve this app');
  await p.waitForSelector('#starter .msg.ai >> text=What do you want to change?');
  expect((await visible()).length === 7 && !(await p.$('#rotateMore')), 'Improve this app should show all 7 options, no rotation');
  expect((await visible()).includes("Review how it's going"), 'Improve this app should offer Review how it\'s going');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('Save to Notes: title on the first line, then the original voice-note layout', async () => {
  const p = await page({ intake: { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'simple', questions: [],
    note: { headline: 'Wind-Down Automation Plan', tags: ['sleep', 'shortcuts'], summary: 'A nightly wind-down.', key_ideas: ['Night Shift at 10:15'], action_items: ['Build the shortcut'], unknowns: [], clean_transcript: 'every night at 10:15' } } });
  await p.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await withKey(p); await p.fill('#thoughts', 'every night at 10:15'); await p.click('#build'); await done(p);
  await p.click('#saveNote');
  const note = await p.evaluate(() => window.__shared && window.__shared.text);
  const lines = note.split('\n');
  expect(lines[0] === 'Pre-Sleep Focus Setup', 'first line should be the title, got: ' + lines[0]);
  expect(/^\u{1F4C5} /u.test(lines[1]) && lines[2] === '\u26a1 Pre-Sleep Focus Setup' && lines[3] === '\u{1F4C1} Category: Shortcuts', 'date, title, category lines wrong: ' + lines.slice(1, 4).join(' | '));
  expect(note.includes('\u{1F3F7}\uFE0F TAGS: #sleep #shortcuts') && note.includes('\n## Wind-Down Automation Plan\n'), 'tags or ## headline missing');
  expect(note.includes('\n### \u{1F4DD} Summary\nA nightly wind-down.') && note.includes('\n### \u{1F4A1} Key Ideas\n- Night Shift at 10:15') && note.includes('\n### \u2705 Action Items\n\u2610 Build the shortcut'), 'section layout wrong:\n' + note);
  expect(!/SUMMARY|KEY IDEAS/.test(note), 'old all-caps headings still there');
  expect(note.includes('### \u{1F680} Prompt Built\nTHE PROMPT'), 'prompt missing from the note');
  const which = note.indexOf('\u{1F449} Which to use: paste only the Prompt Built part'), line = note.indexOf('\u2501\u2501\u2501'), built = note.indexOf('### \u{1F680} Prompt Built');
  expect(line > 0 && which > line && built > which && /the prompt wins/.test(note), 'note needs a clear line and a which-to-use rule right before the prompt:\n' + note);
});

await check('Copy prompt + my note: prompt first, then the note under a line that says the prompt wins', async () => {
  const p = await page({ write: 'Plan the party for Friday the 13th at 7:30 PM.', intake: { title: 'Friday Party', need: 'N', category: 'Life', complexity: 'simple', questions: [{ question: 'Indoors?', choices: ['Yes'] }],
    note: { headline: 'H', tags: [], summary: 'A party plan.', key_ideas: [], action_items: ['Buy snacks'], unknowns: ['How many guests?'], clean_transcript: '' } } });
  await withKey(p); await p.fill('#thoughts', 'party on the 14th, no wait, the 13th, at 7:30'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaList .chips button'); await p.click('#qaGo'); await done(p);
  await p.click('#copyNote'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  expect(t.startsWith('Plan the party for Friday the 13th at 7:30 PM.\n\n\u2501'), 'prompt should come first, then the line:\n' + t);
  expect(/MY ORIGINAL NOTE \(background only\)\nUse the prompt above\..*If it disagrees with the prompt above, the prompt wins\.\n\nFriday Party\n/.test(t) && /\nparty on the 14th, no wait, the 13th, at 7:30$/.test(t), 'note part wrong:\n' + t);
  // The whole saved note comes along: summary, to-dos, open questions, answers (report #6)
  expect(t.includes('### \u{1F4DD} Summary\nA party plan.') && t.includes('\u2610 Buy snacks') && t.includes('- How many guests?') && t.includes('- Indoors? Yes') && !t.includes('Prompt Built'), 'the full note should be attached, without a second copy of the prompt:\n' + t);
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('my Notes shortcuts switch: off keeps the share sheet; on runs Save Voice Note and shows File voice note', async () => {
  const p = await page({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    intake: { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'simple', questions: [], note: { headline: 'H', tags: [], summary: 'S', key_ideas: [], action_items: [], unknowns: [], clean_transcript: 'every night' } } });
  await p.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await withKey(p); await p.fill('#thoughts', 'every night'); await p.click('#build'); await done(p);
  expect(!(await p.isVisible('#saveShare')) && !(await p.isVisible('#fileLink')), 'switch off: no Share instead, no File voice note');
  await p.click('#saveNote');
  expect(await p.evaluate(() => window.__shared && window.__shared.text.startsWith('Pre-Sleep Focus Setup')), 'switch off: Save to Notes should use the share sheet');
  await p.evaluate(() => { window.__shared = null; });
  await p.click('#moreOpts summary'); await p.check('#myShortcuts');
  expect(await p.isVisible('#saveShare'), 'Share instead should show with the switch on');
  expect(await p.isVisible('#fileLink') && (await p.getAttribute('#fileLink', 'href')) === 'shortcuts://run-shortcut?name=File%20Voice%20Note', 'File voice note button missing or wrong link');
  await p.click('#saveNote');
  const href = await p.getAttribute('#shortcutLink', 'href');
  expect(href.startsWith('shortcuts://run-shortcut?name=Save%20Voice%20Note&input=text&text='), 'wrong shortcut link: ' + href.slice(0, 80));
  const text = decodeURIComponent(href.split('&text=')[1]);
  // Markdown for the shortcut: "# " title, every line its own paragraph, real headings
  expect(!text.includes('[ ]'), 'no raw Markdown checkboxes (Notes shows the brackets)');
  expect(text.split('\n')[0] === '# Pre-Sleep Focus Setup' && text.includes('\n\n## H\n\n### \u{1F4DD} Summary\n\nS') && text.includes('\n\n---\n\n\u{1F449} Which to use:') && text.includes('\n\n### \u{1F680} Prompt Built\n\nTHE PROMPT'), 'shortcut text should be the full note in Markdown:\n' + text);
  expect(await p.evaluate(() => navigator.clipboard.readText()) === text, 'note should also be copied as a backup');
  expect(/Process Voice Note/.test(await p.textContent('#keepStatus')), 'status should say where it went');
  expect(!(await p.evaluate(() => window.__shared)), 'share sheet should not open on the main button');
  await p.click('#saveShare');
  expect(await p.evaluate(() => window.__shared && window.__shared.text.startsWith('Pre-Sleep Focus Setup')), 'Share instead should open the share sheet with the note');
});

await check('first-time tutorial: opens from First time?, example fills the box, key and shortcut links work', async () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  let p = await page({ ua: IPHONE });
  expect(await p.isVisible('#firstTime') && await p.isVisible('#talkLink'), 'iPhone: Talk it out and First time? should both show');
  expect(!(await p.isVisible('#tutorial')), 'tutorial should not open by itself');
  await p.click('#firstTime'); await p.waitForSelector('#tutorial[open]');
  expect((await p.getAttribute('#tutShortcut', 'href')).startsWith('https://www.icloud.com/shortcuts/'), 'shortcut link should be at the top of the tutorial');
  const txt = await p.textContent('#tutorial');
  expect(!/\u2014/.test(txt) && (await p.$$eval('#tutorial .flow > li', l => l.length)) === 4, 'tutorial should have 4 steps and no em dashes');
  // A random realistic practice note, with why-messy-is-fine tags and a shuffle
  const note1 = await p.textContent('#tutNote');
  expect(note1.length > 40 && (await p.$$eval('#tutorial .whyok span', l => l.length)) === 3, 'practice note with 3 tags');
  for (let i = 0; i < 5 && (await p.textContent('#tutNote')) === note1; i++) await p.click('#tutShuffle');
  const note = await p.textContent('#tutNote');
  expect(note !== note1, 'Another one should change the note');
  // Copy this note and try it: copies, closes, and the guide walks through paste
  await p.click('#tutTry'); await p.waitForSelector('#tutorial', { state: 'hidden' });
  expect(await p.evaluate(() => navigator.clipboard.readText()) === note, 'the note should be on the clipboard');
  await p.waitForSelector('#guide');
  expect(/Paste/.test(await p.textContent('#guideText')) && await p.evaluate(() => document.getElementById('bannerPaste').classList.contains('guide-target')), 'guide should point at Paste');
  await p.click('#bannerPaste');
  await p.waitForFunction(() => /Build my prompt/.test(document.getElementById('guideText').textContent));
  expect(await p.inputValue('#thoughts') === note && await p.evaluate(() => document.getElementById('build').classList.contains('guide-target')), 'after pasting, guide should point at Build');
  await p.click('#guideSkip'); await p.waitForSelector('#guide', { state: 'detached' });
  expect(!(await p.$('.guide-target')), 'skipping should clear the glow');
  await p.click('#firstTime'); await p.waitForSelector('#tutorial[open]');
  await p.click('#tutKey'); await p.waitForSelector('#tutorial', { state: 'hidden' });
  expect(await p.evaluate(() => document.getElementById('keyPanel').open), 'Set up my key should open the key panel');
  // Computers: no shortcut, but First time? still shows and the tutorial has no shortcut card
  p = await page();
  expect(await p.isVisible('#firstTime') && !(await p.isVisible('#talkLink')), 'computer: First time? shows, Talk it out does not');
  await p.click('#firstTime'); await p.waitForSelector('#tutorial[open]');
  expect(!(await p.$('#tutShortcut')), 'computer: no shortcut card');
  await p.click('#tutDone'); await p.waitForSelector('#tutorial', { state: 'hidden' });
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('dev tools on: a "which stack" question offers the Speak to Prompt stack first, with live versions', async () => {
  const { readFileSync } = await import('node:fs');
  const major = (pkg) => JSON.parse(readFileSync(new URL('../node_modules/' + pkg + '/package.json', import.meta.url), 'utf8')).version.split('.')[0];
  const want = 'Speak to Prompt stack (Svelte ' + major('svelte') + ' + Vite ' + major('vite') + ')';
  const intake = { title: 'Habit App', need: 'N', category: 'Development', complexity: 'standard', questions: [{ question: 'Which tech stack should the app use?', choices: ['React + Vite', 'Plain HTML', 'Not sure', 'Vue'] }, { question: 'Who is it for?', choices: ['Just me', 'Friends'] }] };
  let p = await page({ intake });
  await devOn(p);
  await withKey(p); await p.fill('#thoughts', 'build me a habit tracker web app'); await p.click('#build'); await p.waitForSelector('#qaList .chips button');
  const chips = await p.$$eval('#qaList .chips button', l => l.map(b => b.textContent.trim()));
  expect(chips[0] === want && chips.length >= 4 && !chips.includes('Vue'), 'stack choice should be first (4 max): ' + chips.join(' | '));
  expect(p.calls[0].intake && p.calls[0].text.includes(want), 'intake request should mention the stack choice');
  expect(/first person/.test(p.calls[0].text) && /never the user/.test(p.calls[0].text), 'note fields should be asked for in first person');
  // Dev tools off: untouched
  p = await page({ intake });
  await withKey(p); await p.fill('#thoughts', 'build me a habit tracker web app'); await p.click('#build'); await p.waitForSelector('#qaList .chips button');
  const plain = await p.$$eval('#qaList .chips button', l => l.map(b => b.textContent.trim()));
  expect(!plain.some(c => /Speak to Prompt stack/.test(c)) && !p.calls[0].text.includes('Speak to Prompt stack'), 'dev off: no stack choice');
});

await check('my Notes shortcuts: kept on reload; never offered on computers', async () => {
  const p = await page({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await p.click('#moreOpts summary'); await p.check('#myShortcuts');
  await p.reload();
  expect(await p.isVisible('#fileLink'), 'File voice note should still show after reload');
  const c = await page();
  await c.click('#moreOpts summary');
  expect(!(await c.isVisible('#myShortcutsRow')) && !(await c.isVisible('#saveShare')) && !(await c.isVisible('#fileLink')), 'computers should not see the switch or shortcut buttons');
});

await check('something went wrong: quick report with run facts only, never your words; share, copy, GitHub issue', async () => {
  const p = await page({ intake: { title: 'Trip Plan', need: 'N', category: 'Travel', complexity: 'standard', questions: [
    { question: 'Where to?', choices: ['Tokyo', 'Paris'] },
    { question: 'How long?', choices: ['3 days'] }] } });
  await p.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  // The report relay (a fake address in tests): answer CORS, record what was sent
  let relayUp = true; const relayed = [];
  await p.route('https://relay.test/report', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    relayed.push(JSON.parse(r.request().postData()));
    return relayUp ? r.fulfill({ status: 201, headers: h, body: JSON.stringify({ ok: true, number: 7 }) }) : r.fulfill({ status: 500, headers: h, body: JSON.stringify({ ok: false }) });
  });
  await withKey(p); await p.fill('#thoughts', 'plan a secretword trip'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])');
  await p.click('#qaList .chips button >> text=Tokyo');
  await p.waitForSelector('#qaList .msg.ai >> text=How long?');
  await p.fill('#qaOwn', 'five lazy days'); await p.press('#qaOwn', 'Enter');
  await p.waitForSelector('#qaList .msg.ai >> text=everything I need');
  await p.click('#qaGo'); await done(p);
  // Sits right under the prompt, closed until tapped
  expect(await p.evaluate(() => document.getElementById('output').nextElementSibling.classList.contains('report')), 'report should sit right below the prompt');
  expect(!(await p.$('#reportBox')), 'report form should start closed');
  await p.click('#reportBtn');
  expect(await p.isDisabled('#reportSend'), 'Send should wait for a pick or a note');
  expect(!(await p.$('#reportIssue')), 'GitHub issue link is a dev tool');
  await p.click('#reportBox .chips button >> text=Missed my point');
  await p.click('#reportBox .chips button >> text=Too long');
  await p.fill('#reportNote', 'expected a packing list');
  const text = await p.$eval('#reportPreview', el => el.textContent);
  expect(/What went wrong: Missed my point; Too long/.test(text) && /Note: expected a packing list/.test(text), 'picks or note missing: ' + text);
  expect(/- App version: \S+/.test(text) && /- Mode: Full/.test(text) && /- Words in: 4/.test(text) && /- Questions: 2 asked, 2 answered \(1 tapped, 1 typed\), 0 skipped/.test(text) && /- Write step: \S+/.test(text) && /- Sliders: Detail 3/.test(text), 'run facts missing: ' + text);
  expect(!/secretword|Tokyo|five lazy|THE PROMPT/.test(text), 'report must never include thoughts, answers, or the prompt: ' + text);
  expect(/public bug list/.test(await p.textContent('#reportBox .hint')), 'should say reports go to the public bug list');
  // One tap: the relay files it, no account, no share sheet
  await p.click('#reportSend');
  await p.waitForFunction(() => /report #7/.test(document.getElementById('reportStatus').textContent));
  expect(relayed.length === 1 && relayed[0].title === 'Report: Missed my point, Too long' && relayed[0].body === text, 'relay should get exactly the preview: ' + JSON.stringify(relayed[0]).slice(0, 120));
  expect(!(await p.evaluate(() => window.__shared)), 'share sheet should not open when the relay works');
  // Sent: the box empties so the next critique starts fresh (report #7)
  expect(await p.$$eval('#reportBox .chips button[aria-pressed="true"]', l => l.length) === 0 && (await p.inputValue('#reportNote')) === '' && await p.isDisabled('#reportSend'), 'after sending, picks and note should clear');
  expect(/report #7/.test(await p.textContent('#reportStatus')) && /Send another/.test(await p.textContent('#reportSend')), 'after sending, the thanks stays and the button says Send another');
  const refill = async () => { await p.click('#reportBox .chips button >> text=Missed my point'); await p.click('#reportBox .chips button >> text=Too long'); await p.fill('#reportNote', 'expected a packing list'); };
  // Relay down: falls back to the share sheet
  relayUp = false; await refill();
  await p.click('#reportSend');
  await p.waitForFunction(() => /share sheet instead/.test(document.getElementById('reportStatus').textContent));
  expect(await p.evaluate(() => window.__shared && window.__shared.text) === text, 'fallback share sheet should get exactly the preview');
  // Relay down on a computer without a share sheet: copy instead
  await p.evaluate(() => { navigator.share = undefined; }); await refill();
  await p.click('#reportSend');
  await p.waitForFunction(() => /copied instead/.test(document.getElementById('reportStatus').textContent));
  expect((await p.evaluate(() => navigator.clipboard.readText())) === text, 'copy fallback should copy the report');
  // Dev tools: the core line shows; the manual GitHub link isn't needed with the relay
  await p.click('#moreOpts summary'); await p.check('#devTools');
  const devText = await p.$eval('#reportPreview', el => el.textContent);
  expect(/- Core: (on|off)/.test(devText), 'dev reports should say whether the core was on');
  expect(!(await p.$('#reportIssue')), 'with the relay, no manual GitHub link');
  // A new prompt starts a fresh, closed report
  await p.click('#reset'); await p.fill('#thoughts', 'another one'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo');
  await p.waitForSelector('#reportBox', { state: 'detached', timeout: 15000 }).catch(() => { throw new Error('a new prompt should close the report'); });
  await done(p);
  await p.click('#reportBtn');
  expect(await p.$$eval('#reportBox .chips button[aria-pressed="true"]', l => l.length) === 0 && (await p.inputValue('#reportNote')) === '', 'a new prompt should clear the old picks');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('front page report: its own link and choices, page facts only, sent through the relay', async () => {
  const p = await page();
  const relayed = [];
  await p.route('https://relay.test/report', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    relayed.push(JSON.parse(r.request().postData()));
    return r.fulfill({ status: 201, headers: h, body: JSON.stringify({ ok: true, number: 3 }) });
  });
  await p.fill('#thoughts', 'my private secretword thoughts');
  expect(await p.isVisible('#frontReportBtn') && !(await p.$('#reportBtn:visible')), 'front page should have its own report link');
  await p.click('#frontReportBtn');
  await p.click('#frontReportBox .chips button >> text=A button did nothing');
  const text = await p.$eval('#frontReportPreview', el => el.textContent);
  expect(/Where: front page/.test(text) && /- Prompt built in this tab: not yet/.test(text) && /- Mode picked: (quick|normal)/.test(text) && /- Device: /.test(text), 'front facts missing: ' + text);
  expect(!/Words in|secretword/.test(text), 'front report should hold page facts only: ' + text);
  await p.click('#frontReportSend');
  await p.waitForFunction(() => /report #3/.test(document.getElementById('frontReportStatus').textContent));
  expect(relayed.length === 1 && relayed[0].title === 'Report: front page, A button did nothing' && relayed[0].body === text, 'relay should get the front report');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('shortcut banner: Paste for Improve this app wraps the transcript (dev tools only)', async () => {
  const p = await page();
  await p.goto(BASE + '#paste'); await p.waitForSelector('#pasteWrap.banner');
  expect(!(await p.$('#pasteImprove')), 'Improve this app paste is a dev tool');
  await p.evaluate(() => localStorage.setItem('stp-dev', '1'));
  await p.evaluate(() => navigator.clipboard.writeText('add a dark mode toggle to the idea strip'));
  await p.goto('about:blank'); await p.goto(BASE + '#paste'); await p.waitForSelector('#pasteImprove');
  await p.click('#pasteImprove');
  await p.waitForFunction(() => document.getElementById('thoughts').value.length > 0);
  const box = await p.inputValue('#thoughts');
  expect(/^I need help with improving my Speak to Prompt web app\./.test(box) && /Svelte 5 \+ Vite/.test(box) && /My idea, in my own words:\nadd a dark mode toggle to the idea strip/.test(box) && /What I want back:/.test(box.split('\n').pop()), 'wrapped text wrong: ' + box);
  expect(!(await p.$('#pasteWrap.banner')) && await p.isVisible('#bannerPaste'), 'banner should shrink back to the small Paste button after pasting');
  // Safari freezes its iOS version at 18, so the report says 18 or later
  const q = await page({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1' });
  await q.click('#frontReportBtn');
  expect(/- Device: iPhone \(iOS 18 or later\), Safari/.test(await q.$eval('#frontReportPreview', el => el.textContent)), 'iOS version should read 18 or later');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('ghost coach: meter and notes follow what you write; tap a note to add its phrase', async () => {
  const p = await page();
  expect(!(await p.$('#coach')), 'coach should wait until there are a few words');
  await p.fill('#thoughts', 'meal prep ideas');
  await p.waitForSelector('#coach');
  const seg = () => p.$$eval('#coach .meter span.on', l => l.length);
  const notes = () => p.$$eval('#coach .note', l => l.map(b => b.dataset.key));
  expect(await seg() === 0 && (await notes()).join() === 'goal,who', 'bare thoughts: 0 of 5, notes for goal and who: ' + (await notes()));
  await p.click('#coach .note[data-key="goal"]');
  expect(await p.inputValue('#thoughts') === 'meal prep ideas\nWhat I want: ', 'tapping a note should add its phrase on a new line');
  expect(await p.evaluate(() => document.activeElement.id) === 'thoughts', 'cursor should be in the box after a note');
  await p.type('#thoughts', 'help me plan a week of lunches');
  expect(await seg() >= 1 && (await notes())[0] === 'who', 'goal covered, next note is who');
  await p.fill('#thoughts', 'Help me plan a week of lunches for me and my girlfriend. Budget is under $60 and each one should take 20 minutes or less. I want a shopping list and a simple schedule so that Sunday prep is quick. We both like spicy food, no pork.');
  expect(await seg() === 5 && /Ready to shine/.test(await p.textContent('#coachLevel')) && !(await p.$('#coach .note')), 'full thoughts should hit 5 of 5 with no notes');
  expect(/5 of 5/.test(await p.getAttribute('#coach .meter', 'aria-valuetext')), 'meter should be readable by VoiceOver');
  // Text set by the app (an idea from the strip) updates the coach too
  await p.fill('#thoughts', ''); await p.waitForSelector('#coach', { state: 'detached' });
  await p.evaluate(() => { const t = document.getElementById('thoughts'); t.value = 'plan a trip to Japan next fall'; t.dispatchEvent(new Event('stp:changed')); });
  await p.waitForSelector('#coach');
  expect(await seg() >= 2, 'coach should update when the app changes the box');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('prompt x-ray: your words colored, added parts dashed, dropped sentences and stray numbers flagged', async () => {
  const write = 'You are an experienced Japan travel planner.\nContext: My sister and I are planning a 5-day trip to Tokyo next spring with a total budget of $2,000. She loves anime and I love ramen.\nTask: Create a day-by-day itinerary that balances anime spots and ramen shops, with a rough daily budget of $450.\nFormat: Use a table for each day with morning, afternoon, and evening.\nStart right away, and ask at most one short question only if something essential is missing.';
  const p = await page({ write, intake: { title: 'Tokyo Trip', need: 'N', category: 'Travel', complexity: 'standard', questions: [{ question: 'What should the plan look like?', choices: ['Day by day schedule'] }] } });
  await withKey(p);
  await p.fill('#thoughts', 'ok so I want to plan a trip to Tokyo with my sister next spring. We have about 5 days and maybe $2,000 total. She loves anime and I love ramen. Also I get motion sick on long bus rides.');
  await p.click('#build'); await p.waitForSelector('#qa:not([hidden])');
  await p.click('#qaList .chips button >> text=Day by day schedule');
  await p.waitForSelector('#qaList .msg.ai >> text=everything I need');
  await p.click('#qaGo'); await done(p);
  expect(!(await p.$('#xray')) && await p.isVisible('#output'), 'X-ray starts closed');
  await p.click('#xrayBtn');
  await p.waitForSelector('#xray', { state: 'visible' });
  expect(await p.isHidden('#output'), 'X-ray should take the prompt box\'s place: ' + await p.evaluate(() => getComputedStyle(document.getElementById('output')).display));
  const kinds = await p.$$eval('#xrayText .seg[data-kind]', l => l.map(b => b.dataset.kind));
  expect(kinds[0] === 'added' && kinds.filter(k => k === 'from').length >= 3 && kinds.filter(k => k === 'added').length >= 2, 'parts sorted wrong: ' + kinds);
  expect(/Expert role/.test(await p.textContent('#xrayText .seg[data-kind="added"] .tag')), 'role line should be tagged Expert role');
  const sum = await p.textContent('#xraySummary');
  expect(/\d+%/.test(sum) && /1 thing you said isn't in it/.test(sum) && /1 number you never said/.test(sum), 'summary wrong: ' + sum);
  expect(/motion sick/.test(await p.textContent('#xraySources li.dropped')), 'motion sick should be flagged as not in the prompt');
  expect(await p.textContent('#xrayText .stray') === '$450.', 'the $450 should be marked as a number you never said');
  // Tap a part from your words: shows where it came from and dims the rest
  await p.click('#xrayText .seg[data-kind="from"] >> nth=0');
  expect(/From what you said/.test(await p.textContent('#xrayWhy')) && /Tokyo/.test(await p.textContent('#xrayWhy .quote')), 'tapping should show the source sentence');
  expect(await p.$$eval('#xrayText .seg.dim', l => l.length) > 0 && await p.$$eval('#xraySources li.active', l => l.length) === 1, 'other parts should dim and the source should light up');
  // Tap an added part: explains why
  await p.click('#xrayText .seg[data-kind="added"] >> nth=0');
  expect(/Added to help: Expert role/.test(await p.textContent('#xrayWhy')), 'added part should explain itself');
  // Answers count as your words
  expect(await p.$$eval('#xraySources li small', l => l.some(x => /Answer/.test(x.textContent))), 'your answers should be listed as sources');
  // Done brings the prompt back; copy still copies the real prompt
  // Sticky frame: Done rides along at the top, the color key docks at the bottom
  const pos = await p.evaluate(() => [getComputedStyle(document.querySelector('#xray .xhead')).position, getComputedStyle(document.getElementById('xrayDock')).position]);
  expect(pos[0] === 'sticky' && pos[1] === 'sticky', 'header and dock should be sticky: ' + pos.join());
  const nSrc = await p.$$eval('#xraySources li', l => l.length);
  expect(nSrc > 0 && (await p.$$eval('#xrayKey .kchip', l => l.length)) === nSrc, 'one key chip per sentence of yours');
  expect(await p.$$eval('#xrayKey .kchip.dropped', l => l.length) >= 1, 'a dropped sentence should show as a red chip in the key');
  const badge = await p.textContent('#xrayText .seg[data-kind="from"] .num');
  expect(/^\d+$/.test(badge.trim()), 'parts from your words should carry their sentence number');
  await p.click('#xrayKey .kchip >> nth=0'); await p.waitForSelector('#xraySourceWhy', { state: 'visible' });
  expect( /Your sentence 1/.test(await p.textContent('#xraySourceWhy')), 'tapping a key chip should show that sentence in the dock');
  expect(!(await p.isVisible('#xrayBar')), 'only one X-ray button while open (Done is in the sticky bar)');
  await p.click('#xrayBtn');
  await p.waitForSelector('#xray', { state: 'detached' });
  expect(await p.isVisible('#xrayBar') && await p.isVisible('#output'), 'closing should bring back the prompt and the X-ray button');
  expect(await p.isVisible('#output'), 'Done should bring the prompt back');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('auto-repair: clean prompts go straight through; real problems get one small fix, rechecked, kept only if better', async () => {
  const RAW = 'ok so I want to plan a trip to Tokyo with my sister next spring. We have about 5 days and maybe $2,000 total. She loves anime and I love ramen. Also I get motion sick on long bus rides.';
  const BAD = 'You are an experienced Japan travel planner.\nContext: My sister and I are planning a 5-day trip to Tokyo next spring with a total budget of $2,000. She loves anime and I love ramen.\nTask: Create a day-by-day itinerary that balances anime spots and ramen shops, with a rough daily budget of $450.\nStart right away.';
  const GOOD = BAD.replace('with a rough daily budget of $450.', 'with a daily budget that fits the total. I get motion sick on long bus rides, so keep long bus trips out.');
  const intake = { title: 'Tokyo Trip', need: 'N', category: 'Travel', complexity: 'standard', questions: [] };
  const relayRoute = async (p, sent) => p.route('https://relay.test/report/run', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    sent.push(JSON.parse(r.request().postData()).run); return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
  });
  async function run(opts) {
    const p = await page({ intake, ...opts }); const sent = [];
    await relayRoute(p, sent);
    await p.click('#moreOpts summary'); await p.check('#statsToggle');
    await withKey(p); await p.fill('#thoughts', RAW); await p.click('#build'); await done(p);
    await p.click('#copy'); await p.waitForTimeout(300);   // acting on the prompt sends the run
    return { p, sent };
  }
  // 1. Clean: no extra call, no note
  let { p, sent } = await run({ write: GOOD });
  expect(p.repairs.length === 0 && await p.isHidden('#repairNote'), 'a clean prompt should skip the repair');
  expect(sent[0] && sent[0].action === 'copied' && sent[0].repair === 'none' && sent[0].xray_dropped === 0 && sent[0].xray_stray === 0 && typeof sent[0].xray_pct === 'number' && typeof sent[0].coach === 'number', 'run log should carry X-ray and coach results: ' + JSON.stringify(sent[0]));
  // 2. Problems found, fix is better: use it, say what changed
  ({ p, sent } = await run({ write: BAD, repair: GOOD }));
  expect(p.repairs.length === 1, 'one repair call, got ' + p.repairs.length);
  const ask = p.repairs[0].text;
  expect(/Also I get motion sick on long bus rides\./.test(ask) && /\$450/.test(ask) && /PROMPT TO FIX:/.test(ask) && /word for word/.test(ask), 'repair request should list exactly what to fix: ' + ask.slice(0, 300));
  expect(/lite/.test(p.repairs[0].model) && p.repairs[0].level === 'low', 'repair should use the fast model at low thinking: ' + p.repairs[0].model + ' ' + p.repairs[0].level);
  expect(await p.inputValue('#output') === GOOD, 'the fixed prompt should be shown');
  const note = await p.textContent('#repairNote');
  expect(/Auto-fixed: added 1 detail you said and removed 1 made-up number/.test(note), 'note wrong: ' + note);
  expect(sent[0].repair === 'fixed' && typeof sent[0].repair_s === 'number' && sent[0].xray_dropped === 0, 'run log should record the fix: ' + JSON.stringify(sent[0]));
  expect(!(await p.isVisible('#numWarn')), 'no number warning once the made-up number is gone');
  // 2b. The fix takes a while: elapsed matches the total and names the finishing touch (report #5)
  ({ p, sent } = await run({ write: BAD, repair: GOOD, repairDelay: 2200 }));
  const total = (await p.textContent('#madeBy')).match(/in (\d+)s/), el = await p.textContent('#resultTrack .el');
  expect(total && el === '0:0' + total[1] && /finishing touch/.test(await p.textContent('#resultTrack .leftlbl')), 'elapsed ' + el + ' should match the total ' + (total && total[1]) + 's and mention the finishing touch');
  // 3. Fix isn't better: keep the original and say so
  ({ p, sent } = await run({ write: BAD, repair: BAD + '\nAlso budget $999 a day.' }));
  expect(await p.inputValue('#output') === BAD && /wasn't better, so this is the original/.test(await p.textContent('#repairNote')) && sent[0].repair === 'kept original', 'a worse fix must be thrown away');
  // 4. Fix fails: original, page still works
  ({ p, sent } = await run({ write: BAD, repairFail: true }));
  expect(await p.inputValue('#output') === BAD && /didn't come through/.test(await p.textContent('#repairNote')) && sent[0].repair === 'failed', 'a failed fix should fall back to the original');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('auto-repair skips feelings and asides: they never trigger a fix or get pasted in (regular run Oct 21)', async () => {
  const RAW = 'ok so I want to plan a trip to Tokyo with my sister next spring. We have about 5 days and maybe $2,000 total. She loves anime and I love ramen. Also I get motion sick on long bus rides. This sounds like a lot of work honestly.';
  const BAD = 'You are an experienced Japan travel planner.\nContext: My sister and I are planning a 5-day trip to Tokyo next spring with a total budget of $2,000. She loves anime and I love ramen.\nTask: Create a day-by-day itinerary that balances anime spots and ramen shops, with a rough daily budget of $450.\nStart right away.';
  const GOOD = BAD.replace('with a rough daily budget of $450.', 'with a daily budget that fits the total. I get motion sick on long bus rides, so keep long bus trips out.');
  const intake = { title: 'Tokyo Trip', need: 'N', category: 'Travel', complexity: 'standard', questions: [] };
  async function run(opts) {
    const p = await page({ intake, ...opts });
    await withKey(p); await p.fill('#thoughts', RAW); await p.click('#build'); await done(p);
    return p;
  }
  // 1. Only the aside is left out: nothing to fix
  let p = await run({ write: GOOD });
  expect(p.repairs.length === 0 && await p.isHidden('#repairNote'), 'a left-out feeling should not trigger a repair: ' + (p.repairs[0] && p.repairs[0].text.slice(0, 400)));
  // 2. Real problems too: the repair list names them, not the aside
  p = await run({ write: BAD, repair: GOOD });
  expect(p.repairs.length === 1, 'real problems should still get one repair');
  const ask = p.repairs[0].text.split('RAW THOUGHTS:')[0];
  expect(/motion sick/.test(ask) && !/sounds like a lot/.test(ask), 'repair list should skip the aside: ' + ask.slice(0, 500));
  expect(/feelings/.test(ask), 'repair instructions should say to skip feelings and reactions');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('auto-repair never strips real times; corrected numbers and "two weeks" are not flagged (Kevin\'s stress test)', async () => {
  const RAW = 'ok so um I need help planning the next two weeks because it\'s getting kind of chaotic. My exam is Friday October 30th, wait no, I just checked, it\'s actually Saturday the 31st at 10am. I work Tuesday 6am to 2pm and Saturday 7 to 3. I focus best at the library after 7pm. Budget is $120 for the two weeks.';
  const DRAFT = 'You are an expert study planner.\nI need a realistic two-week plan.\nContext: Exam on Saturday, October 31st at 10:00 AM. I work Tuesdays 6:00 AM to 2:00 PM and Saturdays 7:00 AM to 3:00 PM. I focus best at the library after 7:00 PM. Budget: $120 total for the 14 days.\nTask: Build a day-by-day plan.\nStart right away.';
  const intake = { title: 'Exam Plan', need: 'N', category: 'School', complexity: 'standard', questions: [] };
  async function run(opts) {
    const p = await page({ intake, ...opts });
    await withKey(p); await p.fill('#thoughts', RAW); await p.click('#build'); await done(p);
    return p;
  }
  // 1. Times rewritten as 10:00 AM, "two weeks" as 14 days, and the corrected 30th left out: all fine, nothing to fix
  let p = await run({ write: DRAFT });
  expect(!(await p.isVisible('#numWarn')), 'no number warning expected: ' + await p.textContent('#numWarn'));
  expect(p.repairs.length === 0, 'nothing to repair, but a repair ran: ' + (p.repairs[0] && p.repairs[0].text.slice(0, 400)));
  // 2. A real made-up number, but the "fix" also strips real times: throw the fix away
  const WITH_STRAY = DRAFT.replace('Task: Build a day-by-day plan.', 'Task: Build a day-by-day plan with 25 practice questions.');
  const STRIPPED = WITH_STRAY.replace(/\d{1,2}:00 /g, '').replace(' with 25 practice questions', '');
  p = await run({ write: WITH_STRAY, repair: STRIPPED });
  expect(p.repairs.length === 1, 'the made-up 25 should trigger one repair');
  expect(await p.inputValue('#output') === WITH_STRAY && /wasn't better/.test(await p.textContent('#repairNote')), 'a fix that deletes your times must be thrown away');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('X-ray keeps "vs." and "e.g." inside one sentence, but never joins lines', async () => {
  const { analyze } = await import('../app/lib/xray.js');
  const x = analyze('Flag the Saturday work shift vs. exam conflict, e.g. a swap. Then plan it.\nNext line vs.\nLast line.', 'work shift exam conflict swap');
  const texts = x.segments.map((s) => s.text);
  expect(texts.length === 4 && texts[0] === 'Flag the Saturday work shift vs. exam conflict, e.g. a swap.' && texts[2] === 'Next line vs.', 'sentences split wrong: ' + JSON.stringify(texts));
});

await check('busy models: a resting model is skipped next time, and a slow writer gets a backup racing it', async () => {
  const intake = { title: 'T', need: 'N', category: 'Ideas', complexity: 'standard', questions: [] };
  // 1. 3.8 says it's busy: 3.7 writes, and 3.8 rests, so the next run skips it
  let p = await page({ intake, fail: { 'gemini-3.8-flash': 503 } });
  await withKey(p); await p.fill('#thoughts', 'plan my week'); await p.click('#build'); await done(p);
  const first = p.calls.filter(c => !c.intake).map(c => c.model);
  expect(first[0] === 'gemini-3.8-flash' && first[1] === 'gemini-3.7-flash', 'first run order wrong: ' + first.join(', '));
  const rest = await p.evaluate(() => JSON.parse(localStorage.getItem('stp-model-rest') || '{}'));
  expect(rest['gemini-3.8-flash'] && rest['gemini-3.8-flash'].until > Date.now() && rest['gemini-3.8-flash'].why === 'busy', 'busy model should be resting: ' + JSON.stringify(rest));
  expect(!/plan my week/.test(JSON.stringify(rest)), 'rest list must hold model names only');
  p.calls.length = 0;
  await p.click('#reset'); await p.fill('#thoughts', 'plan my week'); await p.click('#build');
  for (let i = 0; i < 100 && !p.calls.some(c => !c.intake); i++) await p.waitForTimeout(100);
  const second = p.calls.filter(c => !c.intake).map(c => c.model);
  expect(second[0] === 'gemini-3.7-flash', 'resting model should go to the back of the line: ' + second.join(', '));
  // 2. Hedge: 3.8 hangs; after the hedge time 3.7 starts too and wins; 3.8 is stopped
  p = await page({ intake, hold: 'gemini-3.8-flash' });
  await p.clock.install();
  await withKey(p); await p.fill('#thoughts', 'plan my week'); await p.click('#build');
  await p.waitForFunction(() => true); await p.waitForTimeout(300);
  for (let i = 0; i < 20 && !p.calls.some(c => !c.intake); i++) { await p.clock.runFor(1000); }
  expect(p.calls.filter(c => !c.intake).map(c => c.model).join() === 'gemini-3.8-flash', 'only the first writer should start at first');
  await p.clock.runFor(95000);
  await p.waitForFunction(() => document.getElementById('madeBy').textContent.length > 0, null, { timeout: 15000 });
  const writers = p.calls.filter(c => !c.intake).map(c => c.model);
  expect(writers.join() === 'gemini-3.8-flash,gemini-3.7-flash' && await p.inputValue('#output') === 'THE PROMPT', 'backup should race and win: ' + writers.join(', '));
  if (p.release) p.release();
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('first-run guide: follows a whole run (build, answer, copy) to the finish', async () => {
  const p = await page();
  await withKey(p);
  await p.click('#firstTime'); await p.waitForSelector('#tutorial[open]');
  await p.click('#tutTry'); await p.waitForSelector('#guide');
  await p.click('#bannerPaste');
  await p.waitForFunction(() => /Build my prompt/.test(document.getElementById('guideText').textContent));
  await p.click('#build');
  await p.waitForFunction(() => /Answer with a tap/.test(document.getElementById('guideText').textContent), null, { timeout: 15000 });
  await p.click('#qaList .chips button'); await p.click('#qaGo');
  await p.waitForFunction(() => /Tap Copy prompt/.test(document.getElementById('guideText').textContent), null, { timeout: 15000 });
  expect(await p.evaluate(() => document.getElementById('copy').classList.contains('guide-target')), 'guide should point at Copy');
  await p.click('#copy');
  await p.waitForFunction(() => /That's it/.test(document.getElementById('guideText').textContent));
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('Glow-Up: before and after slider, short by default, no core, saves a PNG on the phone', async () => {
  const RAW = Array.from({ length: 70 }, (_, i) => 'word' + i).join(' ') + ' plan my week please';
  const p = await page({ intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] }, write: 'You are a planner. Plan my week with three focus blocks.' });
  await p.evaluate(() => localStorage.setItem('stp-core', JSON.stringify({ user: '- Student', soul: '- Be direct', role: 'Thinking partner', identity: '', on: true })));
  await p.reload();
  const sent = [];
  await p.route('https://relay.test/report/run', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    sent.push(JSON.parse(r.request().postData()).run); return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
  });
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', RAW); await p.click('#build'); await done(p);
  expect(/MY CORE/.test(await p.inputValue('#output')), 'setup: the core should be on this prompt');
  await p.click('#glowBtn'); await p.waitForSelector('#glowup[open]');
  const after = await p.textContent('#glowAfter');
  expect(/Plan my week/.test(after) && !/MY CORE|Student|Thinking partner/.test(after), 'the card must never show the core: ' + after);
  const before = await p.textContent('#glowBefore');
  expect(/word0/.test(before) && !/word60/.test(before) && /\.\.\./.test(before), 'short preview by default');
  await p.check('#glowFull');
  expect(/word60/.test(await p.textContent('#glowBefore')), 'Show more should show the rest');
  expect((await p.getAttribute('#glowRange', 'type')) === 'range' && /74 messy words/.test(await p.textContent('#glowStats')), 'slider and stats should show');
  await p.evaluate(() => { window.__png = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__png = { type: d.files[0].type, size: d.files[0].size, name: d.files[0].name }; }; });
  await p.click('#glowSave'); await p.waitForFunction(() => window.__png, null, { timeout: 10000 });
  const png = await p.evaluate(() => window.__png);
  expect(png.type === 'image/png' && png.size > 20000 && png.name === 'glow-up.png', 'should share a real PNG: ' + JSON.stringify(png));
  await p.waitForTimeout(300);
  expect(sent[0] && sent[0].action === 'saved glow-up', 'run log should record the glow-up: ' + JSON.stringify(sent[0]));
  expect(await p.evaluate(() => getComputedStyle(document.getElementById('glowTitle')).borderBottomStyle) === 'none', 'title should not get the result card underline');
  const txt = await p.textContent('#glowup');
  expect(!/\u2014/.test(txt), 'no em dashes');
  await p.click('#glowDone'); await p.waitForSelector('#glowup', { state: 'hidden' });
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('limits: per-minute is a pause, daily is used up (and learned), busy says busy; version pill shows Latest or Update ready and reloads', async () => {
  const minute = [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }];
  const daily = [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '25' }] }];
  const p = await page({ intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'standard', questions: [] },
    fail: { 'gemini-3.8-flash': 429, 'gemini-3.7-flash': 429, 'gemini-3.6-flash': 503 }, failDetails: { 'gemini-3.8-flash': minute, 'gemini-3.7-flash': daily } });
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'plan my week'); await p.click('#build'); await done(p);
  expect(await p.inputValue('#output') === 'THE PROMPT', 'Flash-Lite should still write it');
  await p.click('#testLog summary').catch(() => {});
  const rows = await p.$$eval('#usage .m', l => Object.fromEntries(l.map(r => [r.querySelector('b').firstChild.textContent.trim(), r.querySelector(':scope > span').textContent])));
  expect(/per-minute limit, back in \d+s/.test(rows['gemini-3.8-flash']), 'per-minute should be a pause, not used up: ' + rows['gemini-3.8-flash']);
  expect(/used up today, back at 3 AM/.test(rows['gemini-3.7-flash']), 'daily limit should say used up: ' + rows['gemini-3.7-flash']);
  expect(/busy at Google, retry in \d+ min/.test(rows['gemini-3.6-flash']), 'a busy model should say busy: ' + rows['gemini-3.6-flash']);
  expect(await p.evaluate(() => JSON.parse(localStorage.getItem('stp-learned-limits') || '{}')['gemini-3.7-flash']) === 25, 'the daily limit Google reported should be learned');
  // Version pill, top right: Latest now; Update ready when a newer build is live; tapping reloads (asks twice if a prompt is on screen)
  await p.waitForFunction(() => document.getElementById('versionPill').dataset.state === 'latest');
  expect(/Latest/.test(await p.textContent('#versionPill')), 'pill should say Latest when the version matches');
  const box = await p.evaluate(() => { const r = document.getElementById('versionPill').getBoundingClientRect(); return [r.right, r.top, innerWidth]; });
  expect(box[2] - box[0] < 40 && box[1] < 80, 'pill should sit at the top right: ' + box.join());
  await p.route(/version\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":"newer123"}' }));
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForFunction(() => document.getElementById('versionPill').dataset.state === 'update');
  expect(/Update ready/.test(await p.textContent('#versionPill')), 'pill should say Update ready');
  await p.evaluate(() => { window.__before = 1; });
  await p.click('#versionPill');
  expect(/Tap again/.test(await p.textContent('#versionPill')) && await p.evaluate(() => window.__before === 1), 'with a prompt on screen, the first tap should ask again, not reload');
  await p.click('#versionPill'); await p.waitForLoadState('load');
  await p.waitForFunction(() => !window.__before, null, { timeout: 5000 });
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('memory (Tailored to you): opt-in, only picked facts go in, nothing saved without a tap, export and import, says so up front', async () => {
  const intake = { title: 'Shortcut Help', need: 'N', category: 'Shortcuts', complexity: 'standard',
    questions: [{ question: 'Which Mac do you use?', choices: ['MacBook Air', 'iMac'] }],
    use_memory: [1, 9], remember: ['I study at WGU for cybersecurity'] };
  const p = await page({ intake, write: 'Act as a Shortcuts expert. On my iPhone 16 with iOS 27, build a shortcut that silences my phone at work.' });
  await devOn(p);
  expect(/Nothing is saved/.test(await p.textContent('#saveChip')), 'memory off: the front still says nothing is saved');
  // Turn it on and save two facts in Your core
  await p.click('#starterBtn'); await p.click('#coreBtn'); await p.waitForSelector('#memoryPanel');
  await p.check('#memoryOn');
  await p.fill('#memoryAdd', 'I work at a coffee shop'); await p.click('#memoryAddBtn');
  await p.fill('#memoryAdd', 'I use an iPhone 16 on iOS 27'); await p.click('#memoryAddBtn');
  expect((await p.$$eval('#memoryFacts li', l => l.length)) === 2, 'two facts saved');
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Your core must not push the page sideways');
  await p.click('#coreDone');
  expect(/Tailored to you · this phone only/.test(await p.textContent('#saveChip')) && /saved on this phone only/.test(await p.textContent('#footer')), 'the front and footer should say memory is on');
  // Build: intake sees the numbered facts (newest first); the writer gets only the picked one (1 = iPhone)
  await withKey(p); await p.fill('#thoughts', 'make a shortcut to silence my phone at work'); await p.click('#build');
  await p.waitForSelector('#qaList .chips button'); await p.click('#qaList .chips button'); await p.click('#qaGo'); await done(p);
  const intakeAsk = p.calls.find(c => c.intake).text, writeAsk = p.calls.filter(c => !c.intake).pop().text;
  expect(/WHAT I ALREADY KNOW ABOUT THIS PERSON/.test(intakeAsk) && /1\. I use an iPhone 16 on iOS 27/.test(intakeAsk) && /2\. I work at a coffee shop/.test(intakeAsk), 'intake should see the numbered facts');
  const bg = writeAsk.split('BACKGROUND THE PERSON SAVED')[1] || '';
  expect(/iPhone 16 on iOS 27/.test(bg) && !/coffee shop/.test(bg), 'the writer should get only the picked fact (and ignore an out-of-range pick): ' + bg);
  expect(!(await p.isVisible('#numWarn')), 'numbers from the prompt that match memory are fine: ' + await p.textContent('#numWarn'));
  // Remember for next time: suggestions, nothing saved until a tap
  await p.waitForSelector('#memorySuggest');
  const offers = await p.$$eval('#memorySuggest .add', l => l.map(b => b.textContent));
  expect(offers.some(o => /WGU/.test(o)) && offers.some(o => /Which Mac do you use: MacBook Air/.test(o)), 'should offer the spotted fact and the answer: ' + offers.join(' | '));
  expect((await p.evaluate(() => JSON.parse(localStorage.getItem('stp-memory')).facts.length)) === 2, 'nothing saved without a tap');
  await p.click('#memorySuggest .add >> nth=0');
  expect((await p.evaluate(() => JSON.parse(localStorage.getItem('stp-memory')).facts.length)) === 3 && /✓/.test(await p.textContent('#memorySuggest')), 'a tap saves it');
  // Report facts show counts only, never the facts
  await p.click('#reportBtn'); await p.click('#reportBox .chips button >> nth=0'); await p.waitForSelector('#reportPreview', { state: 'attached' });
  const rep = await p.$eval('#reportPreview', el => el.textContent);
  expect(/Memory: on, 3 saved, 1 used/.test(rep) && !/coffee shop|iPhone 16 on iOS 27|WGU/.test(rep), 'report should show memory counts only: ' + rep.slice(0, 400));
  await p.click('#reportBtn');
  // Export and import
  await p.evaluate(() => { window.__md = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__md = { name: d.files[0].name, text: await d.files[0].text() }; }; });
  await p.click('#reset');
  if (!(await p.$('#starter'))) await p.evaluate(() => document.getElementById('starterBtn').click());
  await p.waitForSelector('#coreBtn');
  if (!(await p.$('#memoryPanel'))) await p.evaluate(() => document.getElementById('coreBtn').click());
  await p.waitForSelector('#memoryPanel');
  await p.click('#memoryExport'); await p.waitForFunction(() => window.__md);
  const md = await p.evaluate(() => window.__md);
  expect(md.name === 'memory.md' && /^# Speak to Prompt memory/.test(md.text) && /- I work at a coffee shop/.test(md.text), 'export should be a memory.md file: ' + md.text);
  await p.setInputFiles('#memoryImport', { name: 'memory.md', mimeType: 'text/markdown', buffer: Buffer.from('# Speak to Prompt memory\n\n- I use an iPhone 16 on iOS 27\n- My Mac is a MacBook Air M4\n') });
  await p.waitForFunction(() => /Added 1 fact/.test((document.getElementById('memoryStatus') || {}).textContent || ''));
  // Forget everything, then off: back to "Nothing is saved" and no memory in the intake
  await p.click('#memoryForget'); await p.click('#memoryForgetYes');
  await p.uncheck('#memoryOn'); await p.click('#coreDone');
  expect(/Nothing is saved/.test(await p.textContent('#saveChip')) && (await p.evaluate(() => localStorage.getItem('stp-memory'))) === null, 'forgetting and switching off should leave nothing stored');
  p.calls.length = 0;
  await p.fill('#thoughts', 'make a shortcut to silence my phone at work'); await p.click('#build');
  for (let i = 0; i < 50 && !p.calls.some(c => c.intake); i++) await p.waitForTimeout(100);
  expect(!/WHAT I ALREADY KNOW|"remember"/.test(p.calls.find(c => c.intake).text), 'memory off: no memory in the intake');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('run log scorecard: parses Worker comments and does the math exactly', async () => {
  const { parseRuns, scorecard, markdown } = await import('../scripts/runlog-report.mjs');
  const row = (o) => ({ created_at: o.when || '2026-10-19T01:00:00Z', body: '**Run x**\n\n| field | value |\n|---|---|\n' + Object.entries(o).filter(([k]) => k !== 'when').map(([k, v]) => '| ' + k + ' | ' + (v === true ? 'yes' : v === false ? 'no' : v) + ' |').join('\n') });
  const base = { mode: 'Full', depth: 'standard', est_intake_s: 2, est_s: 10, intake_s: 2, outcome: 'ok', write_model: 'gemini-3.8-flash', xray_dropped: 0, xray_stray: 0, num_flags: 0, coach: 4, repair: 'none' };
  const comments = [
    row({ ...base, write_s: 10, words_in: 20, xray_pct: 80, action: 'copied', xray_opened: true }),
    row({ ...base, write_s: 11, words_in: 40, xray_pct: 70, action: 'opened Claude' }),
    row({ ...base, write_s: 9, words_in: 10, xray_pct: 90, action: 'copied' }),
    row({ ...base, write_s: 30, words_in: 300, xray_pct: 40, xray_dropped: 1, repair: 'fixed', repair_s: 2, action: 'started over', detours: 'gemini-3.8-flash was unavailable', write_model: 'gemini-3.6-flash' }),
    row({ ...base, write_s: 10, words_in: 30, xray_pct: 75, action: 'rebuilt' }),
    row({ ...base, outcome: 'write failed: mock' }),
    { created_at: '2026-10-19T02:00:00Z', body: 'not a run' }
  ];
  const runs = parseRuns(comments);
  expect(runs.length === 6 && runs[0].write_s === 10 && runs[0].xray_opened === true && runs[0].action === 'copied', 'parsing wrong: ' + JSON.stringify(runs[0]));
  expect(runs[0].when === '2026-10-19T01:00:00Z', 'plain run should keep its posted time');
  const late = parseRuns([{ created_at: '2026-10-19T03:00:00Z', body: '**Run 2026-10-17 20:30 UTC**\n\n| field | value |\n|---|---|\n| mode | Full |' }])[0];
  expect(late.when === '2026-10-17T20:30:00Z', 'backfilled run should use the time in its heading: ' + late.when);
  const s = scorecard(runs);
  expect(s.runs === 6 && s.ok === 5 && s.failed === 1, 'counts wrong');
  // waits: 12, 13, 11, 34, 12 vs estimate 12 -> within 30%: 4 of 5
  expect(s.speed.wait_p50 === 12 && s.speed.est_within_pct === 80 && s.speed.by_depth[0].suggest_s === 10, 'speed math wrong: ' + JSON.stringify(s.speed));
  expect(s.speed.size_link.words_in > 0.9, 'size link should be strong here: ' + s.speed.size_link.words_in);
  expect(s.quality.dropped_pct === 20 && s.quality.repair.ran === 1 && s.quality.repair.fixed === 1 && s.models.fallback_pct === 20, 'quality math wrong: ' + JSON.stringify(s.quality));
  expect(s.use.kept_pct === 60 && s.use.redone_pct === 40 && s.use.xray_opened_pct === 20, 'use math wrong: ' + JSON.stringify(s.use));
  expect(s.flags.some((f) => /1 run\(s\) failed/.test(f)) && s.flags.some((f) => /40% of prompts were redone/.test(f)), 'flags missing: ' + s.flags.join(' | '));
  const md = markdown(s, '2026-10-19');
  expect(/### Scorecard since 2026-10-19/.test(md) && /\| standard \| 5 \|/.test(md) && !/—/.test(md), 'markdown wrong or has an em dash');
});

await check('report relay (Cloudflare Worker): only the app, only reports, no pings, fixed label, rate limit', async () => {
  const { default: relay } = await import('../worker/report-relay.js');
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(JSON.stringify({ number: 42 }), { status: 201 }); };
  const APP = 'https://kmagno94.github.io', env = { GITHUB_TOKEN: 'tok' };
  const post = (body, origin = APP, ip = '1.1.1.1', e = env) => relay.fetch(new Request('https://relay.example/', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) }), e);
  const good = { title: 'Report: Too long', body: 'Speak to Prompt report\n\nWhat went wrong: Too long\nNote: ask @kmagno94 <b>now</b>' };
  try {
    const pre = await relay.fetch(new Request('https://relay.example/', { method: 'OPTIONS', headers: { Origin: APP } }), env);
    expect(pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === APP, 'preflight from the app should pass');
    const evilPre = await relay.fetch(new Request('https://relay.example/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
    expect(evilPre.status === 403, 'preflight from other sites should fail');
    expect((await post(good, 'https://evil.example')).status === 403, 'posts from other sites should be refused');
    expect((await post(good, APP, '2.2.2.2', {})).status === 500, 'missing key should fail clearly');
    expect((await post({ title: 'hello', body: 'spam' }, APP, '3.3.3.3')).status === 400, 'non-report text should be refused');
    expect(sent.length === 0, 'nothing should reach GitHub for refused requests');
    const ok = await post(good, APP, '4.4.4.4');
    const out = await ok.json();
    expect(ok.status === 201 && out.ok && out.number === 42, 'good report should return the issue number');
    const call = sent[0], gh = JSON.parse(call.init.body);
    expect(call.url === 'https://api.github.com/repos/kmagno94/speak-to-prompt/issues' && call.init.headers.Authorization === 'Bearer tok', 'should call GitHub issues with the key');
    expect(JSON.stringify(gh.labels) === '["report"]' && gh.title === 'Report: Too long', 'label should be fixed to report');
    expect(!/@kmagno94/.test(gh.body) && /@​kmagno94/.test(gh.body) && !/<b>/.test(gh.body), 'mentions and HTML should be defused: ' + gh.body);
    expect(!JSON.stringify(out).includes('tok'), 'the key must never come back to the page');
    // /run: one comment on the Run log issue, known fields only
    const postRun = (run, ip) => relay.fetch(new Request('https://relay.example/run', { method: 'POST',
      headers: { Origin: APP, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ run }) }), env);
    sent.length = 0;
    const r1 = await postRun({ mode: 'Full', words_in: 12, write_s: 9.5, core: true, outcome: 'ok', repair: 'fixed', xray_pct: 54, coach: 4, action: 'copied', xray_opened: true, est_intake_s: 3, hidden_s: 41.2, lessons_v: 2, grade: 4, grade_rearranged: false, grade_missing: 'format+success', grade_model: '3.5-flash-lite', secret: 'my words', nested: { a: 1 }, detours: 'x'.repeat(500) + ' | @kmagno94' }, '6.6.6.6');
    expect(r1.status === 201 && sent.length === 1 && sent[0].url === 'https://api.github.com/repos/kmagno94/speak-to-prompt/issues/2/comments', 'run should become a comment on issue #2');
    const c = JSON.parse(sent[0].init.body).body;
    expect(/\| mode \| Full \|/.test(c) && /\| words_in \| 12 \|/.test(c) && /\| core \| yes \|/.test(c) && /\| repair \| fixed \|/.test(c) && /\| xray_pct \| 54 \|/.test(c) && /\| coach \| 4 \|/.test(c) && /\| action \| copied \|/.test(c) && /\| xray_opened \| yes \|/.test(c) && /\| est_intake_s \| 3 \|/.test(c) && /\| hidden_s \| 41.2 \|/.test(c) && /\| lessons_v \| 2 \|/.test(c) && /\| grade \| 4 \|/.test(c) && /\| grade_rearranged \| no \|/.test(c) && /\| grade_missing \| format\+success \|/.test(c) && /\| grade_model \| 3\.5-flash-lite \|/.test(c), 'run comment missing fields: ' + c);
    expect(!/secret|my words|nested/.test(c) && !/@kmagno94/.test(c) && c.length < 1000, 'unknown fields, pings, and long text must be dropped: ' + c);
    expect((await postRun({ words_in: 3 }, '6.6.6.6')).status === 400 && (await postRun('nope', '6.6.6.6')).status === 400, 'non-run data should be refused');
    let lastRun;
    for (let i = 0; i < 60; i++) lastRun = await postRun({ mode: 'Quick' }, '7.7.7.7');
    expect(lastRun.status === 201 && (await postRun({ mode: 'Quick' }, '7.7.7.7')).status === 429, 'the 61st run in an hour should be refused');
    let last;
    for (let i = 0; i < 5; i++) last = await post(good, APP, '5.5.5.5');
    expect(last.status === 201 && (await post(good, APP, '5.5.5.5')).status === 429, 'a 6th report in an hour should be refused');
  } finally { globalThis.fetch = realFetch; }
});

await check('self-tuning estimates: shared times first, your own once learned, built-in if too few', async () => {
  async function firstRun(tuning) {
    const p = await page({ tuning });
    const sent = [];
    await p.route('https://relay.test/report/run', async r => {
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      sent.push(JSON.parse(r.request().postData()).run);
      return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
    });
    await withKey(p); await p.click('#moreOpts summary'); await p.check('#statsToggle');
    for (let i = 0; i < 3; i++) {
      await p.fill('#thoughts', 'plan my week'); await p.click('#build');
      await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo');
      await p.waitForFunction(() => /Ready|Built/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
      await p.click('#copy'); await p.waitForTimeout(300); await p.click('#reset');
    }
    return sent;
  }
  const t = await firstRun({ updated: 'x', intake: { secs: 4, runs: 9 }, depth: { standard: { secs: 33, runs: 9 } } });
  expect(t[0].est_from === 'shared' && t[0].est_s === 33 && t[0].est_intake_s === 4, 'fresh phone should use tuning.json: ' + JSON.stringify(t[0]));
  expect(t[2].est_from === 'phone' && t[2].est_s !== 33, 'after 2 runs the phone should use its own times: ' + JSON.stringify(t[2]));
  const few = await firstRun({ updated: 'x', depth: { standard: { secs: 33, runs: 3 } } });
  expect(few[0].est_from === 'built-in' && few[0].est_s === 31, 'too few shared runs should be ignored: ' + JSON.stringify(few[0]));
  const { tuningFrom, parseRuns } = await import('../scripts/runlog-report.mjs');
  const row = (o, i) => ({ created_at: '2026-10-19T0' + i + ':00:00Z', body: '**Run x**\n\n| field | value |\n|---|---|\n' + Object.entries(o).map(([k, v]) => '| ' + k + ' | ' + v + ' |').join('\n') });
  const runs = parseRuns([10, 12, 11, 50, 13, 9].map((w, i) => row({ mode: 'Full', depth: 'standard', write_s: w, intake_s: 2, outcome: 'ok' }, i))
    .concat([row({ mode: 'Full', depth: 'complex', write_s: 20, outcome: 'ok' }, 7), row({ mode: 'Full', depth: 'standard', outcome: 'write failed: x' }, 8)]));
  const tf = tuningFrom(runs, '2026-10-19T09:00:00Z');
  expect(tf.depth.standard.secs === 12 && tf.depth.standard.runs === 6 && !tf.depth.complex && tf.intake.secs === 2, 'tuning math wrong: ' + JSON.stringify(tf));
});

await check('built-in complex estimate matches the Scorecard-calibrated default', async () => {
  const p = await page({ tuning: { updated: 'x', depth: {} }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'complex', questions: [] } });
  const sent = [];
  await p.route('https://relay.test/report/run', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    sent.push(JSON.parse(r.request().postData()).run);
    return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
  });
  await withKey(p); await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  await p.click('#copy'); await p.waitForTimeout(300); await p.click('#reset'); await p.waitForTimeout(300);
  expect(sent[0] && sent[0].depth === 'complex' && sent[0].est_from === 'built-in' && sent[0].est_s === 45, 'complex built-in estimate: ' + JSON.stringify(sent[0]));
});

await check('time away from the app is left out of the logged write time', async () => {
  const p = await page({ hold: 'gemini-3.8-flash', intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  const sent = [];
  await p.route('https://relay.test/report/run', async r => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    sent.push(JSON.parse(r.request().postData()).run);
    return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
  });
  await withKey(p); await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForTimeout(500);
  const vis = (v) => p.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { get: () => v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await vis('hidden'); await p.waitForTimeout(2500); await vis('visible');
  p.release(); await done(p);
  await p.click('#copy'); await p.waitForTimeout(300);
  const r = sent[0] || {};
  expect(r.outcome === 'ok' && r.hidden_s >= 2 && r.write_s < 2, 'write_s should leave out time away, hidden_s should show it: ' + JSON.stringify(r));
});

await check('Scorecard: busy by time of day, in Eastern time', async () => {
  const { busyByTime } = await import('../scripts/runlog-report.mjs');
  const t = busyByTime([
    { when: '2026-10-19T14:00:00Z', outcome: 'ok', write_s: 10, detours: '3.8-flash was unavailable after 1s' },
    { when: '2026-10-19T14:30:00Z', outcome: 'ok', write_s: 20, detours: '' },
    { when: '2026-10-19T02:00:00Z', outcome: 'ok', write_s: 5, detours: '3.8-flash was at its daily limit' }]);
  const am = t.find((x) => x.block === '9 AM to 12 PM'), pm = t.find((x) => x.block === '9 PM to 12 AM');
  expect(am && am.n === 2 && am.busy_pct === 50 && am.wait_p50 === 15 && pm && pm.limit_pct === 100 && pm.busy_pct === 0, 'busy by time wrong: ' + JSON.stringify(t));
});

await check('Dev tools row: Copy full result and Copy for grader check show only with Show my dev tools on, apart from the everyday buttons', async () => {
  const p = await page({ write: 'Plan a surprise party for Marco on Friday the 13th at 7:30 PM. Budget is $200 with $35.50 spent. Keep it under 400 words.' });
  await withKey(p);
  await p.fill('#thoughts', 'surprise party for Marco on friday the 13th at 7:30. budget is $200 and I spent $35.50. two people are vegan so plan food around that.');
  await p.click('#build'); await p.waitForSelector('#qa:not([hidden])');
  await p.click('#qaList .chips button'); await p.click('#qaGo'); await done(p);
  expect(!(await p.isVisible('#copyAll')) && !(await p.isVisible('#copyGrader')), 'dev copy buttons should hide with dev tools off');
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  expect(!(await p.isVisible('#copyAll')), 'run stats alone should not show the dev copy buttons');
  await p.check('#devTools');
  expect(await p.isVisible('#copyAll') && await p.isVisible('#copyGrader'), 'dev copy buttons should show with dev tools on');
  expect(await p.$('.row #copyAll') === null || await p.$('#devRow #copyAll') !== null, 'Copy full result lives in the dev tools row');
  expect(await p.$eval('#copy', (b) => !b.closest('#devRow')) && await p.$eval('#copyGrader', (b) => !!b.closest('#devRow')), 'everyday buttons stay outside the dev row');
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  for (const want of ['MY NOTE', 'surprise party for Marco', 'MY ANSWERS', 'A: iPhone', 'X-RAY', '% your words', 'Not in the prompt: two people are vegan', 'Numbers you never said: 400', 'PROMPT', 'Keep it under 400 words', 'App version'])
    expect(t.includes(want), 'full result missing "' + want + '":\n' + t);
  await p.click('#copyGrader'); await p.waitForTimeout(300);
  const gt = await p.evaluate(() => navigator.clipboard.readText());
  expect(/^regular run\n\nSPEAK TO PROMPT RESULT/.test(gt) && gt.includes('MY NOTE') && gt.includes('Keep it under 400 words') && gt.includes('GRADER DETAILS'), 'grader copy wrong: ' + JSON.stringify(gt.slice(0, 1500)));
  expect(/grader check/.test(await p.textContent('#status')), 'status should say what was copied');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('number check: correct math on your numbers is not "made up" (stress test 2)', async () => {
  const note = "alright so I want to throw a surprise party for my friend Marco, he turns 25 on November 14th, no wait that's a Saturday and he works Saturdays, let's do Friday the 13th instead, at 8pm, actually make it 7:30 so people can leave by 11. it's at my place, I can fit maybe 15 people max but I'm inviting 12. budget is $200, and I already spent $35.50 on decorations so really it's whatever is left. two people are vegan and one can't eat shellfish, so no shrimp at all. I want to send the invite with the Invitations app on iOS 27 but I've never used it, so walk me through that too. don't tell me to rent a venue, I don't want that. food should be like 60% of the budget and the rest goes to drinks and a cake. I need a timeline for the day of, starting from when I get off work at 3, a shopping list with rough prices, and a text I can send everyone saying keep it a secret. oh and Marco's girlfriend Ana is helping so split the tasks between us, she's free after 5. keep it simple, I've never hosted anything before, honestly kind of nervous lol";
  const write = 'You are an expert event planner. Marco turns 25. Friday, November 13th at 7:30 PM, wrapping up by 11:00 PM. Max 15 people, 12 invited. Budget: total $200, $35.50 already spent on decorations, leaving $164.50. Put about 60% ($98.70) toward food and the remaining $65.80 toward drinks and a cake. 2 guests are vegan, 1 cannot eat shellfish. Walk me through the Invitations app on iOS 27. I get off work at 3:00 PM; Ana is free after 5:00 PM.';
  const p = await page({ write, intake: { title: 'T', need: 'N', category: 'Events', complexity: 'standard', questions: [] } });
  await withKey(p); await p.fill('#thoughts', note); await p.click('#build'); await done(p);
  expect(!p.repairs.some((r) => /never said them/.test(r.text)), 'Auto-Repair should not be told to remove correct math: ' + (p.repairs[0] || {}).text);
  expect(await p.isHidden('#numWarn'), 'no number warning for correct math: ' + await p.textContent('#numWarn'));
  expect((await p.inputValue('#output')).includes('$164.50'), 'the $164.50 left should stay');
  await p.click('#xrayBtn');
  expect(!/never said/.test(await p.textContent('#xraySummary')), 'X-ray should not call correct math a number you never said');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('number check: a number that is not math on yours is still flagged', async () => {
  const p = await page({ write: 'Budget $200, $35.50 spent, $164.50 left. Keep it under 400 words and spend $57.25 on cake.', intake: { title: 'T', need: 'N', category: 'Events', complexity: 'standard', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'budget is $200 and I spent $35.50 on decorations'); await p.click('#build'); await done(p);
  const w = await p.textContent('#numWarn');
  expect(/400/.test(w) && /57\.25/.test(w) && !/164/.test(w), 'should flag 400 and 57.25 but not 164.50: ' + w);
});

await check('number check: splits and unit conversions of your numbers are not "made up" (stress test 3)', async () => {
  const note = "it's about 140 miles, and ines is from madrid so she's gonna ask how far that is in kilometers. it's $32 a night for two nights and we're splitting it three ways. the forecast says it drops to 38 at night, fahrenheit, and my sleeping bag is rated 20 degrees. dev wants to do the full 9 mile ridge loop.";
  const write = 'You are a camping trip planner. Distance: about 140 miles (about 225 km for Ines). Cost: $32 a night for 2 nights is $64 total, split 3 ways is about $21.33 each. Nights drop to 38°F (about 3°C); my bag is rated 20°F. Dev hikes the 9-mile ridge loop.';
  const p = await page({ write, intake: { title: 'T', need: 'N', category: 'Travel', complexity: 'standard', questions: [] } });
  await withKey(p); await p.fill('#thoughts', note); await p.click('#build'); await done(p);
  expect(!p.repairs.some((r) => /never said them/.test(r.text)), 'Auto-Repair should not be told to remove correct math or conversions: ' + (p.repairs[0] || {}).text);
  expect(await p.isHidden('#numWarn'), 'no number warning for a split or a conversion: ' + await p.textContent('#numWarn'));
  const out = await p.inputValue('#output');
  for (const n of ['$64', '$21.33', '225 km']) expect(out.includes(n), n + ' should stay');
  await p.click('#xrayBtn');
  expect(!/never said/.test(await p.textContent('#xraySummary')), 'X-ray should not call a split or conversion a number you never said');
  const q = await page({ write: 'Drive 140 miles (about 300 km). Pay $32 a night, $50 each.', intake: { title: 'T', need: 'N', category: 'Travel', complexity: 'standard', questions: [] } });
  await withKey(q); await q.fill('#thoughts', "it's 140 miles and $32 a night for two nights split three ways"); await q.click('#build'); await done(q);
  const w = await q.textContent('#numWarn');
  expect(/300/.test(w) && /50/.test(w), 'a wrong conversion (300 km) and a wrong split ($50) should still be flagged: ' + w);
  expect(!p.errors.length && !q.errors.length, 'page errors: ' + p.errors.concat(q.errors).join('; '));
});

/* Lessons learned (lessons.json) and the quality grade that feeds them. */
const relayRun = async (p, sent) => p.route('https://relay.test/report/run', async r => {
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
  sent.push(JSON.parse(r.request().postData()).run); return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
});
const noQ = { title: 'Lessons Test', need: 'N', category: 'Ideas', complexity: 'standard', questions: [] };

await check('lessons learned: lessons.json rules go into the writing step, cleaned and capped at 6, and the run logs the version', async () => {
  const many = [{ text: 'Rule A: state the format.' }, { text: 'x'.repeat(300) }, { text: 'Rule\nB  spaced' }].concat([1, 2, 3, 4, 5, 6].map(n => ({ text: 'Extra ' + n })));
  const p = await page({ intake: noQ, lessons: { version: 7, lessons: many } }); const sent = [];
  await relayRun(p, sent);
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'help me plan a garden'); await p.click('#build'); await done(p);
  const w = p.calls.filter(c => !c.intake).pop().text;
  const lines = (w.split('LESSONS FROM REVIEWS')[1] || '').split('RAW THOUGHTS:')[0].split('\n').filter(l => l.startsWith('- '));
  expect(/LESSONS FROM REVIEWS OF EARLIER PROMPTS/.test(w) && lines[0] === '- Rule A: state the format.' && lines[1] === '- Rule B spaced', 'lessons should be cleaned and listed: ' + lines.join(' | '));
  expect(lines.length === 6 && !w.includes('x'.repeat(250)), 'at most 6 lessons and none over 240 characters, got ' + lines.length);
  expect(w.indexOf('LESSONS FROM REVIEWS') < w.indexOf('RAW THOUGHTS:'), 'lessons belong with the instructions, before the raw thoughts');
  await p.click('#copy'); await p.waitForTimeout(300);
  expect(sent[0] && sent[0].lessons_v === 7, 'run should log lessons_v 7: ' + JSON.stringify(sent[0]));
  // No lessons file: no lessons block, version 0
  const q = await page({ intake: noQ, lessons: null });
  await withKey(q); await q.fill('#thoughts', 'help me plan a garden'); await q.click('#build'); await done(q);
  expect(!/LESSONS FROM REVIEWS/.test(q.calls.filter(c => !c.intake).pop().text), 'no lessons file means no lessons block');
  expect(!p.errors.length && !q.errors.length, 'page errors: ' + p.errors.concat(q.errors).join('; '));
});

await check('quality grade: with run stats on, the fast model grades the prompt after it shows; only the score and labels reach the run log', async () => {
  const RAW = 'ok so I want to start a little plant swap at the community garden, first Sunday of the month, Rosa said the shed has a table';
  const p = await page({ intake: noQ, write: 'Plant swap prompt', grade: { craft: 2, rearranged: true, invented: false, missing: ['format', 'bogus', 'format', 'Success'] } }); const sent = [];
  await relayRun(p, sent);
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', RAW); await p.click('#build'); await done(p);
  expect(await p.inputValue('#output') === 'Plant swap prompt', 'the prompt shows without waiting for the grade');
  await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 });
  const note = await p.textContent('#gradeNote');
  expect(/Quality check: 2\.0 of 5 \u00b7 \u270b below the 4\.5 bar/.test(note) && /rearranged/.test(note) && /could add: format \(how long and what shape\), success \(what a great result looks like\)/.test(note) && !/bogus/.test(note), 'grade note wrong: ' + note);
  expect(p.grades.length === 1 && /lite/.test(p.grades[0].model) && p.grades[0].level === 'low' && p.grades[0].json, 'grade should be one JSON call on Flash-Lite at low thinking: ' + JSON.stringify(p.grades[0] && { m: p.grades[0].model, l: p.grades[0].level }));
  expect(p.grades[0].text.includes(RAW) && p.grades[0].text.includes('PROMPT TO GRADE:') && p.grades[0].text.includes('Plant swap prompt'), 'grader should see the raw thoughts and the prompt');
  expect(p.calls.filter(c => !c.intake).length === 1, 'the grade is not a second write call');
  await p.click('#copy'); await p.waitForTimeout(400);
  const r = sent[0] || {};
  expect(r.grade === 2 && r.grade_pass === false && r.grade_broke === 'none' && r.grade_rearranged === true && r.grade_invented === false && r.grade_missing === 'format+success' && /lite/.test(r.grade_model) && typeof r.grade_s === 'number' && r.action === 'copied', 'run should carry the grade: ' + JSON.stringify(r));
  expect(!JSON.stringify(r).includes('plant') && !('_grade' in r), 'no words and no internals in the run log: ' + JSON.stringify(r));
  // Stats off: no grade call, no note
  const q = await page({ intake: noQ });
  await withKey(q); await q.fill('#thoughts', RAW); await q.click('#build'); await done(q); await q.waitForTimeout(300);
  expect(q.grades.length === 0 && await q.isHidden('#gradeNote'), 'no grade with run stats off');
  // Grade fails: the run still goes out, without a grade
  const f = await page({ intake: noQ, gradeFail: true }); const sentF = [];
  await relayRun(f, sentF);
  await f.click('#moreOpts summary'); await f.check('#statsToggle');
  await withKey(f); await f.fill('#thoughts', RAW); await f.click('#build'); await done(f);
  await f.waitForTimeout(300); await f.click('#copy'); await f.waitForTimeout(400);
  expect(sentF[0] && sentF[0].action === 'copied' && sentF[0].grade === undefined && await f.isHidden('#gradeNote'), 'a failed grade should not block the run: ' + JSON.stringify(sentF[0]));
  expect(!p.errors.length && !q.errors.length && !f.errors.length, 'page errors: ' + p.errors.concat(q.errors, f.errors).join('; '));
});

await check('stricter grader: caps soft scores, uses grader calibration from lessons.json, and logs the grader version', async () => {
  const p = await page({ intake: noQ, write: 'Plant swap prompt', grade: { craft: 5, rearranged: false, invented: false, missing: ['format'] },
    lessons: { version: 4, lessons: [{ text: 'Writer rule.' }], grader_version: 3, grader: [{ text: 'A prompt with no stated length is missing format.' }] } }); const sent = [];
  await relayRun(p, sent);
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'plant swap at the garden, first sunday'); await p.click('#build'); await done(p);
  await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 });
  expect(/Quality check: 4\.0 of 5 \u00b7/.test(await p.textContent('#gradeNote')), 'a 5 with a missing label should be capped at 4.00: ' + await p.textContent('#gradeNote'));
  const ask = p.grades[0].text;
  expect(/CALIBRATION FROM CLAUDE'S REVIEWS/.test(ask) && ask.includes('- A prompt with no stated length is missing format.') && ask.indexOf('CALIBRATION') < ask.indexOf('PROMPT TO GRADE:'), 'grader calibration should be in the grade request');
  expect(/Never give 4\.50 or more if missing or broke has anything in it/.test(ask) && !/LESSONS FROM REVIEWS/.test(ask), 'grade request uses the strict rubric, not the writer wording');
  expect(ask.includes('- L1: Writer rule.') && ask.indexOf('LESSONS LEARNED') < ask.indexOf('PROMPT TO GRADE:'), 'grader should check the writer lessons, with ids, as what not to do');
  await p.click('#copy'); await p.waitForTimeout(400);
  expect(sent[0] && sent[0].grade === 4 && / g3$/.test(sent[0].grade_model) && sent[0].lessons_v === 4, 'run should log the capped grade and grader g3: ' + JSON.stringify(sent[0]));
  const { capGrade } = await import('../app/lib/prompts.js');
  expect(capGrade(5, [], true, false) === 2 && capGrade(5, [], false, true) === 3 && capGrade(4, ['a', 'b', 'c'], false, false) === 2 && capGrade(5, [], false, false) === 5, 'caps wrong');
  expect(capGrade(4.737, [], false, false) === 4.74 && capGrade(4.9, ['format'], false, false) === 4 && capGrade(4.8, [], false, false, ['L1']) === 4.4 && capGrade(4.8, [], false, false, ['L1', 'L2']) === 3.9 && capGrade(3.215, [], false, false) === 3.22, 'hundredths caps wrong');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('label fix: below the bar with a label the app can add, small calls add those lines, regrade, and keep them only if better, up to two tries', async () => {
  const DRAFT = 'You are a meal prep coach.\nContext: Two roommates, $80 a week, vegetarian lunches.\nTask: Plan 10 lunches.\nStart right away.';
  const FIXED = 'You are a meal prep coach.\nContext: Two roommates, $80 a week, vegetarian lunches.\nTask: Plan 10 lunches.\nKeep it to about one screen, with short bullets instead of long paragraphs.\nStart right away.';
  const L = { version: 2, lessons: [], grader_version: 5, grader: [] };
  async function run(opts) {
    const p = await page({ intake: noQ, write: DRAFT, lessons: L, grade: { craft: 4.3, rearranged: false, invented: false, missing: ['format'] }, ...opts }); const sent = [];
    await p.route('https://relay.test/report/run', async r => {
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      sent.push(JSON.parse(r.request().postData()).run); return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
    });
    await p.click('#moreOpts summary'); await p.check('#statsToggle');
    await withKey(p); await p.fill('#thoughts', 'meal prep for me and my roommate'); await p.click('#build'); await done(p);
    await p.waitForFunction(() => /\u{1F527} (added|tried|couldn|skipped)/u.test(document.getElementById('gradeNote').textContent), null, { timeout: 8000 });
    return { p, sent, note: await p.textContent('#gradeNote') };
  }
  // 1. Fix scores higher: the new prompt shows, the note says what changed, the run logs both grades
  let { p, sent, note } = await run({ labelFix: FIXED, regrade: { craft: 4.7, rearranged: false, invented: false, missing: [] } });
  expect(p.fixes.length === 1 && /PROMPT TO FINISH:/.test(p.fixes[0].text) && /how long/.test(p.fixes[0].text) && /lite/.test(p.fixes[0].model), 'one label fix call on the fast model asking for a length: ' + (p.fixes[0] && p.fixes[0].model));
  expect(p.grades.length === 3 && p.grades[1].text.includes('about one screen') && p.grades[2].text.includes('about one screen'), 'the fixed prompt should be graded again, and its pass confirmed: ' + p.grades.length);
  expect(await p.inputValue('#output') === FIXED, 'the fixed prompt should replace the draft');
  expect(/4\.7 of 5/.test(note) && /passes the 4\.5 bar/.test(note) && /added format, up from 4\.0 \(.*s fix\)$/.test(note.trim()), 'note wrong: ' + note);
  await p.check('#devTools'); await p.click('#copyGrader'); await p.waitForTimeout(300);
  const gt = await p.evaluate(() => navigator.clipboard.readText());
  expect(/First grade: 4\.00 \u00b7 missing format/.test(gt) && /After the fix: 4\.70 \u00b7 missing none/.test(gt) && /Label fix: added format/.test(gt) && gt.includes('PROMPT BEFORE THE LABEL FIX\n' + DRAFT) && /GRADER DETAILS \(g5, lessons v\d+, live\)/.test(gt), 'grader copy should show both grades and the draft: ' + JSON.stringify(gt));
  await p.click('#copy'); await p.waitForTimeout(400);
  expect(sent[0] && sent[0].grade === 4.7 && sent[0].grade_before === 4 && sent[0].label_fix === 'added format' && typeof sent[0].label_fix_s === 'number' && sent[0].grade_pass === true, 'run should log the fix: ' + JSON.stringify(sent[0]));
  // 2. Fix doesn't score higher: original stays
  ({ p, sent, note } = await run({ labelFix: FIXED, regrade: { craft: 4.2, rearranged: false, invented: false, missing: ['format'] } }));
  expect(await p.inputValue('#output') === DRAFT && /didn't score higher, so this is the original/.test(note) && /4\.0 of 5/.test(note), 'a fix that is not better must be thrown away: ' + note);
  // 3. Fix rewrites other lines: thrown away without a second grade
  ({ p, sent, note } = await run({ labelFix: FIXED.replace('Plan 10 lunches.', 'Plan ten tasty lunches.') }));
  expect(await p.inputValue('#output') === DRAFT && p.grades.length === 1 && /changed other lines/.test(note), 'a fix that rewrites lines must be thrown away: ' + note);
  // 4. Fix fails: original stays, page still works
  ({ p, sent, note } = await run({ fixFail: true }));
  expect(await p.inputValue('#output') === DRAFT && /couldn't add format/.test(note), 'a failed fix should keep the original: ' + note);
  // 5. Two tries: the first fix adds success and the limits, still under the bar, so a second adds a length
  const FIX1 = DRAFT.replace('Start right away.', 'A great plan is one we can shop for in one trip.\nNo meat, ever.\nStart right away.');
  const FIX2 = FIX1.replace('Start right away.', 'Keep it to about one screen, with short bullets.\nStart right away.');
  ({ p, sent, note } = await run({ labelFixFn: (ask, n) => n === 1 ? FIX1 : FIX2, gradeSeq: [
    { craft: 3.4, rearranged: false, invented: false, missing: ['success', 'constraints', 'format'] },
    { craft: 3.9, rearranged: false, invented: false, missing: ['format'] },
    { craft: 4.7, rearranged: false, invented: false, missing: [] }] }));
  expect(p.fixes.length === 2 && /great result looks like/.test(p.fixes[0].text) && /limits the person gave/.test(p.fixes[0].text) && /how long/.test(p.fixes[0].text) && /PERSON'S RAW THOUGHTS \(only to find their limits\)/.test(p.fixes[0].text) && !/who the AI/.test(p.fixes[0].text), 'first try should add success, limits and length (never role), with the raw thoughts for limits: ' + (p.fixes[0] && p.fixes[0].text.slice(0, 300)));
  expect(p.fixes[1].text.includes('No meat, ever.') && /how long/.test(p.fixes[1].text) && !/great result looks like/.test(p.fixes[1].text) && !/RAW THOUGHTS/.test(p.fixes[1].text), 'second try works on the first fix and adds only what is still missing');
  expect(await p.inputValue('#output') === FIX2 && /4\.7 of 5/.test(note) && /added success, constraints and format, up from 2\.0 in 2 tries/.test(note), 'two-try note wrong: ' + note);
  await p.click('#copy'); await p.waitForTimeout(400);
  expect(sent[0] && sent[0].label_fix === 'added success+constraints+format' && sent[0].label_fix_tries === 2 && sent[0].grade_before === 2 && sent[0].grade === 4.7, 'run should log both tries: ' + JSON.stringify(sent[0]));
  const w = p.calls.find((c) => !c.intake);
  expect(/what a great result looks like/.test(w.text) && /A label that doesn't apply to this request is never missing/.test(p.grades[0].text) && /constraints is not missing/.test(p.grades[0].text), 'writer asks for a success line and the grader skips labels that do not apply');
  // 6. Only a label the app cannot add is missing: no fix call
  const q = await page({ intake: noQ, write: DRAFT, lessons: L, grade: { craft: 3.6, rearranged: false, invented: false, missing: ['role', 'context'] } });
  await q.click('#moreOpts summary'); await q.check('#statsToggle');
  await withKey(q); await q.fill('#thoughts', 'meal prep for me and my roommate'); await q.click('#build'); await done(q);
  await q.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 }); await q.waitForTimeout(500);
  expect(q.fixes.length === 0 && !/\u{1F527}/u.test(await q.textContent('#gradeNote')), 'no fix when a label the app cannot add is missing');
  expect(!p.errors.length && !q.errors.length, 'page errors: ' + p.errors.concat(q.errors).join('; '));
});

await check("today's date: the writer and the grader both get the phone's date, so relative days are counted, not guessed", async () => {
  const p = await page({ intake: noQ, write: 'Study plan prompt' });
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'study plan for my quiz on friday'); await p.click('#build'); await done(p);
  await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 });
  const want = await p.evaluate(() => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  const w = p.calls.find((c) => !c.intake);
  expect(w && w.text.includes('TODAY: ' + want) && /Never guess a different day/.test(w.text), 'write step should get today: ' + (w && w.text.slice(-400)));
  expect(w.text.indexOf('TODAY:') < w.text.indexOf('RAW THOUGHTS:'), 'today goes with the instructions, before the raw thoughts');
  expect(p.grades[0] && p.grades[0].text.includes("TODAY'S DATE (from the person's phone") && p.grades[0].text.includes(want), 'grader should know today too');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

async function writeCall(p) {
  for (let i = 0; i < 80; i++) { const c = p.calls.find((x) => !x.intake); if (c) return c; await p.waitForTimeout(100); }
  throw new Error('no write call arrived');
}
await check('grading session: a draft link swaps in draft lessons and grader rules on this device only, with a Live/Draft switch in dev tools', async () => {
  const { linkFor, problems } = await import('../scripts/draft.mjs');
  const LIVE = { version: 2, updated: 'x', lessons: [{ id: 'L1', text: 'Live writer rule.', why: 'w' }], grader_version: 8, grader: [{ id: 'G1', text: 'Live grader rule.', why: 'w' }] };
  const DRAFT = { version: 3, lessons: [{ id: 'L1', text: 'Draft writer rule, with an apostrophe\'s worth.', why: 'w' }], grader_version: 9, grader: [{ id: 'G1', text: 'Draft grader rule.', why: 'w' }] };
  expect(problems(DRAFT).length === 0 && problems({ ...DRAFT, grader: [DRAFT.grader[0], DRAFT.grader[0]] }).length === 1, 'the script should catch repeated ids');
  const link = linkFor(DRAFT, BASE.replace(/\/?$/, '/'));
  const p = await page({ intake: noQ, write: 'Study prompt', lessons: LIVE });
  await devOn(p);
  await p.goto('about:blank'); await p.goto(link);
  expect(!/#draft=/.test(p.url()), 'the draft should leave the address bar once saved: ' + p.url());
  await p.click('#moreOpts summary');
  expect(await p.getAttribute('#srcDraft', 'aria-pressed') === 'true' && /Using Draft \w+: g9, lessons v3/.test(await p.textContent('#srcInfo')) && /Live is g8/.test(await p.textContent('#srcInfo')), 'switch should show Draft: ' + await p.textContent('#srcInfo'));
  await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'study plan'); await p.click('#build'); await done(p);
  await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 });
  const w = await writeCall(p);
  expect(w.text.includes("Draft writer rule, with an apostrophe's worth.") && !w.text.includes('Live writer rule.'), 'writer should use the draft lessons');
  expect(p.grades[0].text.includes('Draft grader rule.') && / g9 draft \w+, /.test(await p.textContent('#gradeNote')), 'grader should use the draft and say so: ' + await p.textContent('#gradeNote'));
  await p.click('#copyGrader'); await p.waitForTimeout(200);
  expect(/GRADER DETAILS \(g9, lessons v3, draft \w+\)/.test(await p.evaluate(() => navigator.clipboard.readText())), 'grader copy should name the draft');
  // Copy draft link gives back the same draft
  await p.click('#draftCopy'); await p.waitForTimeout(200);
  expect((await p.evaluate(() => navigator.clipboard.readText())).split('#draft=')[1] === link.split('#draft=')[1], 'Copy draft link should give the same draft back');
  // Switch to Live: next build uses lessons.json
  await p.click('#srcLive');
  expect(/Using Live\. Live is g8/.test(await p.textContent('#srcInfo')), 'Live should show: ' + await p.textContent('#srcInfo'));
  p.calls.length = 0; p.grades.length = 0;
  await p.click('#reset'); await p.fill('#thoughts', 'study plan again'); await p.click('#build'); await done(p);
  await p.waitForFunction(() => / g8, /.test(document.getElementById('gradeNote').textContent), null, { timeout: 8000 }).catch(() => {});
  expect((await writeCall(p)).text.includes('Live writer rule.') && / g8, /.test(await p.textContent('#gradeNote')), 'Live should use lessons.json: ' + await p.textContent('#gradeNote'));
  // Dev tools off: always Live, even with Draft picked
  await p.click('#srcDraft'); await p.uncheck('#devTools'); await p.waitForTimeout(100);
  p.calls.length = 0;
  await p.click('#reset'); await p.fill('#thoughts', 'study plan three'); await p.click('#build'); await done(p);
  expect((await writeCall(p)).text.includes('Live writer rule.'), 'with dev tools off, everyone gets Live');
  // Paste draft link (Home Screen app, where a link opens Safari instead)
  const q = await page({ intake: noQ, lessons: LIVE });
  await p.close(); await devOn(q); await q.bringToFront(); await q.click('#moreOpts summary');
  await q.evaluate(() => navigator.clipboard.writeText('nothing here')); await q.click('#draftPaste');
  await q.waitForFunction(() => /No draft link/.test(document.getElementById('srcInfo').textContent), null, { timeout: 5000 }).catch(() => {});
  expect(/No draft link on the clipboard/.test(await q.textContent('#srcInfo')) && await q.isDisabled('#srcDraft'), 'a bad paste should say so');
  await q.evaluate((l) => navigator.clipboard.writeText('here you go: ' + l), link); await q.click('#draftPaste');
  await q.waitForFunction(() => /Using Draft/.test(document.getElementById('srcInfo').textContent), null, { timeout: 3000 }).catch(() => {});
  expect(/Using Draft \w+: g9/.test(await q.textContent('#srcInfo')), 'pasting the link should switch to Draft: ' + await q.textContent('#srcInfo'));
  await q.click('#draftClear');
  expect(/Using Live/.test(await q.textContent('#srcInfo')) && await q.isDisabled('#srcDraft'), 'Clear draft should go back to Live');
  expect(!p.errors.length && !q.errors.length, 'page errors: ' + p.errors.concat(q.errors).join('; '));
});

await check('grader bench: one tap grades every bench.json case with the current grader and compares with the answer key', async () => {
  const bench = JSON.parse(readFileSync(path.join(ROOT, 'bench.json'), 'utf8'));
  expect(bench.cases.length >= 6 && bench.cases.every((c) => c.id && c.raw && c.prompt && c.today && c.key && typeof c.key.score === 'number' && Array.isArray(c.key.missing)), 'bench.json cases need id, raw, prompt, today, and a key');
  expect(bench.cases.some((c) => c.key.score >= 4.5) && bench.cases.some((c) => c.key.score < 4.5) && bench.cases.some((c) => c.holdout), 'bench needs passes, fails, and holdouts');
  expect(!/\u2014/.test(JSON.stringify(bench)), 'no em dashes in bench.json');
  // The grader agrees with the key on every case except the first, which it overrates
  const first = bench.cases[0];
  const gradeFn = (ask) => { const c = bench.cases.find((x) => ask.includes(x.prompt)); if (!c) return null;
    return c === first ? { craft: 4.8, missing: [], invented: false, rearranged: false, broke: [] } : { craft: c.key.score, missing: c.key.missing, invented: c.key.invented, rearranged: c.key.rearranged, broke: c.key.broke }; };
  const p = await page({ gradeFn });
  await devOn(p); await withKey(p); await p.click('#moreOpts summary');
  await p.click('#benchRun');
  await p.waitForSelector('#benchOut:not([hidden])', { timeout: 15000 });
  const n = bench.cases.length, sum = await p.textContent('.benchsum');
  const passes = bench.cases.filter((c) => c === first || c.key.score >= 4.5).length;
  expect(p.grades.length === n + passes, 'one grade per case plus a second look for each pass: ' + p.grades.length + ' vs ' + (n + passes));
  expect(new RegExp('^Live g\\d+: ' + (n - 1) + ' of ' + n + ' pass/fail agree').test(sum) && new RegExp('labels exact ' + (n - 1) + '/' + n).test(sum), 'summary wrong: ' + sum);
  expect(p.grades.every((g) => /TODAY'S DATE/.test(g.text)) && p.grades[0].text.includes(first.today), 'each case is graded with its own date');
  expect(await p.$$eval('.benchout tbody tr', (r) => r.length) === n && await p.$$eval('.benchout tr.hold', (r) => r.length) === bench.cases.filter((c) => c.holdout).length, 'one row per case, holdouts marked');
  expect(/\u274c/.test(await p.textContent('.benchout tbody tr:first-child')), 'the overrated case shows a miss');
  await p.click('#benchCopy'); await p.waitForTimeout(200);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  expect(/^bench results\n\nGRADER BENCH\n/.test(t) && t.includes(first.id + ': Claude ' + first.key.score.toFixed(2) + ' / grader 4.80'), 'bench copy wrong: ' + t.slice(0, 300));
  // A busy server gets one retry, so it doesn't show up as an error row
  const b = await page({ gradeFn, gradeBusyOnce: true });
  await b.addInitScript(() => { window.__benchRetryMs = 800; }); await b.reload();
  await devOn(b); await withKey(b); await b.click('#moreOpts summary'); await b.click('#benchRun');
  await b.waitForSelector('#benchOut:not([hidden])', { timeout: 20000 });
  expect(!/error/.test(await b.textContent('#benchOut')) && new RegExp((n - 1) + ' of ' + n).test(await b.textContent('.benchsum')), 'busy errors should be retried: ' + await b.textContent('.benchsum'));
  await b.close();
  // A second run remembers the first for comparison
  await p.click('#benchRun'); await p.waitForFunction(() => /Done/.test(document.getElementById('benchInfo').textContent) && document.getElementById('benchRun').disabled === false, null, { timeout: 15000 });
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('confirm passes: a pass gets a second look and the lower grade wins; fails need no second look', async () => {
  const PASS = { craft: 4.7, missing: [], invented: false, rearranged: false, broke: [] }, FAIL = { craft: 4.0, missing: ['format'], invented: false, rearranged: false, broke: [] };
  async function run(seq) {
    let i = 0;
    const p = await page({ intake: noQ, write: 'Confirm prompt', gradeFn: () => seq[Math.min(i++, seq.length - 1)] }); const sent = [];
    await p.route('https://relay.test/report/run', async (r) => {
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      sent.push(JSON.parse(r.request().postData()).run); return r.fulfill({ status: 201, headers: h, body: '{"ok":true}' });
    });
    await p.click('#moreOpts summary'); await p.check('#statsToggle');
    await withKey(p); await p.fill('#thoughts', 'a note'); await p.click('#build'); await done(p);
    await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 8000 }); await p.waitForTimeout(400);
    const note = await p.textContent('#gradeNote');
    await p.click('#copy'); await p.waitForTimeout(400);
    return { p, note, r: sent[0] || {} };
  }
  // Lucky pass, then a fail: the lower grade wins
  let { p, note, r } = await run([PASS, FAIL]);
  expect(p.grades.length >= 2 && /4\.0 of 5/.test(note) && /below the 4\.5 bar/.test(note) && /a second look gave 4\.00 \(first 4\.70\)/.test(note), 'a lucky pass should drop: ' + note);
  expect(r.grade === 4 && r.grade_confirm === 'dropped', 'run log should show the drop: ' + JSON.stringify(r));
  // Real pass: both agree, it stays a pass and says confirmed
  ({ p, note, r } = await run([PASS, PASS]));
  expect(p.grades.length === 2 && /4\.7 of 5/.test(note) && /passes the 4\.5 bar, confirmed/.test(note) && r.grade_confirm === 'held', 'a real pass should hold: ' + note);
  // A fail needs no second look
  ({ p, note, r } = await run([{ ...FAIL, missing: ['format', 'success'] }]));
  expect(p.grades.length === 1 && r.grade_confirm === 'none', 'a fail gets one grade only: ' + p.grades.length);
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('quality grade: hundredths, a 4.5 pass bar, and lessons learned as the rubric (broken lessons cost points)', async () => {
  const L = { version: 2, lessons: [{ id: 'L1', text: 'Write the Task as a clear instruction.' }, { id: 'L2', text: 'State leftover money as exact math.' }], grader_version: 4, grader: [] };
  async function run(grade) {
    const p = await page({ intake: noQ, write: 'Garden prompt', grade, lessons: L }); const sent = [];
    await relayRun(p, sent);
    await p.click('#moreOpts summary'); await p.check('#statsToggle');
    await withKey(p); await p.fill('#thoughts', 'garden budget is 200 and i spent 35.50 already'); await p.click('#build'); await done(p);
    await p.waitForSelector('#gradeNote:not([hidden])', { timeout: 5000 });
    const note = await p.textContent('#gradeNote');
    await p.click('#copy'); await p.waitForTimeout(400);
    expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
    return { p, note, r: sent[0] || {} };
  }
  // A strong prompt: kept to the hundredth, shown to the tenth, passes
  const a = await run({ craft: 4.737, broke: [], rearranged: false, invented: false, missing: [] });
  expect(/Quality check: 4\.7 of 5 \(4\.74\) \u00b7 \u2705 passes the 4\.5 bar/.test(a.note), 'pass note wrong: ' + a.note);
  expect(a.r.grade === 4.74 && a.r.grade_pass === true && a.r.grade_broke === 'none' && / g4$/.test(a.r.grade_model), 'run should log 4.74, pass, g4: ' + JSON.stringify(a.r));
  // Breaks a lesson: capped at 4.40, fails, unknown ids dropped
  const b = await run({ craft: 4.8, broke: ['l2', 'L9', 'L2'], rearranged: false, invented: false, missing: [] });
  expect(/Quality check: 4\.4 of 5 \u00b7 \u270b below the 4\.5 bar/.test(b.note) && /broke lesson L2/.test(b.note) && !/L9/.test(b.note), 'broken lesson note wrong: ' + b.note);
  expect(b.r.grade === 4.4 && b.r.grade_pass === false && b.r.grade_broke === 'L2', 'run should log the broken lesson: ' + JSON.stringify(b.r));
  // Edge: 4.47 rounds to 4.5 on the scale but is below the bar, so the exact score shows
  const c = await run({ craft: 4.47, broke: [], rearranged: false, invented: false, missing: [] });
  expect(/Quality check: 4\.5 of 5 \(4\.47\) \u00b7 \u270b below the 4\.5 bar/.test(c.note) && c.r.grade_pass === false, 'a 4.47 must not look like a pass: ' + c.note);
  // An old-style whole number still works
  const d = await run({ craft: 5, rearranged: false, invented: false, missing: [] });
  expect(/Quality check: 5\.0 of 5 \u00b7 \u2705 passes/.test(d.note) && d.r.grade === 5, 'whole numbers should still grade: ' + d.note);
});

await check('Scorecard: grades by lessons version, with flags to add or revert a lesson', async () => {
  const { parseRuns, scorecard, markdown } = await import('../scripts/runlog-report.mjs');
  const row = (i, v, grade, re, miss) => ({ created_at: '2026-10-21T0' + (i % 10) + ':00:00Z', body: `**Run 2026-10-21 0${i % 10}:00 UTC**\n\n| field | value |\n|---|---|\n| mode | Full |\n| outcome | ok |\n| write_s | 30 |\n| lessons_v | ${v} |\n| grade | ${grade} |\n| grade_rearranged | ${re ? 'yes' : 'no'} |\n| grade_invented | no |\n| grade_missing | ${miss} |` });
  const comments = [0, 1, 2, 3, 4].map(i => row(i, 1, 4, false, 'none')).concat([5, 6, 7, 8, 9].map(i => row(i, 2, 3, true, 'format+success')));
  const s = scorecard(parseRuns(comments));
  expect(s.grades.n === 10 && s.grades.avg === 3.5 && s.grades.rearranged_pct === 50, 'grade math wrong: ' + JSON.stringify(s.grades));
  expect(s.grades.by_lessons.length === 2 && s.grades.by_lessons[1].avg === 3 && s.grades.missing[0].label === 'format' && s.grades.missing[0].pct === 50, 'by-version or missing wrong: ' + JSON.stringify(s.grades));
  expect(s.flags.some(f => /rearranged words in 50%/.test(f)) && s.flags.some(f => /missing "format" in 50%/.test(f)) && s.flags.some(f => /Lessons v2 grades 3 vs v1 4.*Revert/.test(f)), 'flags missing: ' + s.flags.join(' | '));
  const md = markdown(s);
  expect(/Prompt grades/.test(md) && /v1: 4 \(5 runs\), v2: 3 \(5 runs\)/.test(md), 'markdown missing grades: ' + md.split('Prompt grades')[1]);
  // A stricter grader (g2) must not look like a worse lesson
  const gv = (c, n) => ({ ...c, body: c.body + `\n| grade_model | 3.5-flash-lite g${n} |` });
  const mixed = scorecard(parseRuns([0, 1, 2, 3, 4].map(i => gv(row(i, 1, 4, false, 'none'), 1)).concat([5, 6, 7, 8, 9].map(i => gv(row(i, 2, 3, false, 'none'), 2)))));
  expect(!mixed.flags.some(f => /Revert/.test(f)) && mixed.grades.grader === 2 && mixed.grades.by_grader.length === 2 && mixed.grades.by_lessons.length === 1, 'grader change should not trigger a lesson revert: ' + JSON.stringify(mixed.grades) + ' ' + mixed.flags.join(' | '));
  const soft = scorecard(parseRuns(Array.from({ length: 10 }, (_, i) => gv(row(i, 1, 5, false, 'none'), 2))));
  expect(soft.flags.some(f => /Grader g2 averages 5 over 10 runs/.test(f)), 'a grader handing out 5s should be flagged: ' + soft.flags.join(' | '));
  const none = markdown(scorecard(parseRuns([row(1, 0, 4, false, 'none')].map(c => ({ ...c, body: c.body.replace(/\| grade.*\n?/g, '') })))));
  expect(/Graded runs \| 0/.test(none), 'no grades should still print cleanly');
});

await check('Scorecard: pass rate on the 4.5 bar and which lessons graded prompts broke', async () => {
  const { parseRuns, scorecard, markdown } = await import('../scripts/runlog-report.mjs');
  const row = (i, grade, pass, broke) => ({ created_at: '2026-10-22T0' + i + ':00:00Z', body: `**Run 2026-10-22 0${i}:00 UTC**\n\n| field | value |\n|---|---|\n| mode | Full |\n| outcome | ok |\n| write_s | 30 |\n| grade | ${grade} |\n| grade_pass | ${pass ? 'yes' : 'no'} |\n| grade_broke | ${broke} |\n| grade_model | 3.5-flash-lite g4 |` });
  const s = scorecard(parseRuns([row(1, 4.74, true, 'none'), row(2, 4.4, false, 'L2'), row(3, 3.77, false, 'L1+L2'), row(4, 4.62, true, 'none'), row(5, 4.0, false, 'L2')]));
  expect(s.grades.pass_n === 5 && s.grades.pass_pct === 40 && s.grades.avg === 4.31 && s.grades.broke[0].id === 'L2' && s.grades.broke[0].pct === 60, 'pass or broke math wrong: ' + JSON.stringify(s.grades));
  expect(s.flags.some(f => /broke lesson L2 in 60%/.test(f)) && !s.flags.some(f => /lesson L1 in/.test(f)), 'should flag the lesson broken most: ' + s.flags.join(' | '));
  const md = markdown(s);
  expect(/Passed the 4\.5 bar \(newest grader\) \| 40% of 5/.test(md) && /Lessons broken \(newest grader\) \| L2 60%, L1 20%/.test(md), 'markdown missing pass rate or lessons: ' + md.split('Prompt grades')[1]);
});

await check('busy hours: tuning.json picks a less busy start model per 3-hour block from the last 14 days', async () => {
  const { tuningFrom, parseRuns } = await import('../scripts/runlog-report.mjs');
  const row = (when, o) => ({ created_at: when, body: '**Run x**\n\n| field | value |\n|---|---|\n' + Object.entries({ mode: 'Full', depth: 'standard', outcome: 'ok', write_s: 40, ...o }).map(([k, v]) => '| ' + k + ' | ' + v + ' |').join('\n') });
  const c = [];
  // 9 PM to 12 AM Eastern (02:00 UTC in October): 3.8 busy 5 of 6, 3.6 busy 0 of 5
  for (let i = 0; i < 5; i++) c.push(row(`2026-10-${10 + i}T02:0${i}:00Z`, { write_model: 'gemini-3.6-flash', detours: '3.8-flash was unavailable after 1s; 3.7-flash was slow, so 3.6-flash started too after 30s' }));
  c.push(row('2026-10-15T02:30:00Z', { write_model: 'gemini-3.8-flash' }));
  // 9 AM to 12 PM: every Flash busy, so no new start, just the early backup
  for (let i = 0; i < 5; i++) c.push(row(`2026-10-${10 + i}T14:0${i}:00Z`, { write_model: 'gemini-3.5-flash-lite', detours: '3.8-flash was unavailable after 0s; 3.7-flash was unavailable after 0s; 3.6-flash was unavailable after 4s' }));
  // 3 PM to 6 PM: 3.8 fine
  for (let i = 0; i < 6; i++) c.push(row(`2026-10-${10 + i}T20:00:00Z`, { write_model: 'gemini-3.8-flash' }));
  // Over 14 days old: ignored (would make 6 AM busy)
  for (let i = 0; i < 6; i++) c.push(row(`2026-09-2${i}T11:00:00Z`, { write_model: 'gemini-3.7-flash', detours: '3.8-flash was unavailable after 0s' }));
  const b = tuningFrom(parseRuns(c), '2026-10-16T00:00:00Z').busy;
  expect(b['21'] && b['21'].start === '3.6-flash' && b['21'].race_s === 30 && /busy 5 of 6/.test(b['21'].why), 'evening block should start on 3.6: ' + JSON.stringify(b));
  expect(b['9'] && b['9'].start === null && b['9'].race_s === 30, 'all-busy block keeps the order but races early: ' + JSON.stringify(b['9']));
  expect(!b['15'] && !b['6'], 'quiet block and old runs should not get a plan: ' + JSON.stringify(b));
});

await check('busy hours: the app starts on the less busy model in a busy block and logs the plan', async () => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date())) % 24;
  const block = String(Math.floor(h / 3) * 3);
  async function run(plan) {
    const p = await page({ intake: noQ, tuning: { updated: 'x', depth: { standard: { secs: 40, runs: 9 } }, busy: { [block]: plan } } }); const sent = [];
    await relayRun(p, sent);
    await p.click('#moreOpts summary'); await p.check('#statsToggle');
    await withKey(p); await p.fill('#thoughts', 'plan my week'); await p.click('#build'); await done(p);
    const track = await p.textContent('#resultTrack');
    await p.click('#copy'); await p.waitForTimeout(400);
    return { p, track, run: sent[0] || {}, write: p.calls.filter(c => !c.intake)[0] };
  }
  let r = await run({ start: '3.6-flash', race_s: 30, why: 'x' });
  expect(r.write.model === 'gemini-3.6-flash', 'busy block should start on 3.6, got ' + r.write.model);
  expect(r.run.busy_plan === '3.6-flash first, backup at 30s', 'run should log the plan: ' + JSON.stringify(r.run.busy_plan));
  expect(/busy hours: 3\.6-flash first/.test(r.track), 'tracker should say busy hours with run stats on: ' + r.track);
  r = await run({ start: null, race_s: 30, why: 'x' });
  expect(r.write.model === 'gemini-3.8-flash' && r.run.busy_plan === 'backup at 30s', 'no start model keeps the order: ' + r.write.model + ' ' + r.run.busy_plan);
  r = await run({ start: '3.5-flash-lite', race_s: 30, why: 'x' });
  expect(r.write.model === 'gemini-3.8-flash', 'Flash-Lite is never the busy-hours start');
  const q = await page({ intake: noQ });
  await withKey(q); await q.fill('#thoughts', 'plan my week'); await q.click('#build'); await done(q);
  expect(q.calls.filter(c => !c.intake)[0].model === 'gemini-3.8-flash', 'no busy plan means the normal order');
  expect(!r.p.errors.length && !q.errors.length, 'page errors: ' + r.p.errors.concat(q.errors).join('; '));
});

await check('lessons.json is valid: versioned, at most 6 short lessons, no em dashes or mentions', async () => {
  const p = await page();
  const j = await p.evaluate(() => fetch('lessons.json', { cache: 'no-store' }).then(r => r.json()));
  expect(typeof j.version === 'number' && Array.isArray(j.lessons) && j.lessons.length <= 6 && j.updated, 'lessons.json needs version, updated, and up to 6 lessons');
  expect(typeof j.grader_version === 'number' && Array.isArray(j.grader) && j.grader.length <= 6, 'lessons.json needs grader_version and up to 6 grader rules');
  for (const l of j.lessons.concat(j.grader)) expect(l.text && l.text.length <= 240 && !/\u2014|@/.test(l.text) && l.why, 'bad lesson: ' + JSON.stringify(l));
  for (const k of ['lessons', 'grader']) { const ids = j[k].map((l) => l.id); expect(ids.every((id, i) => id && ids.indexOf(id) === i), k + ' has a missing or repeated id: ' + ids.join(', ')); }
  const { problems } = await import('../scripts/draft.mjs');
  expect(problems(j).length === 0, 'scripts/draft.mjs should accept lessons.json: ' + problems(j).join('; '));
});

await check('usage.json is valid', async () => {
  const p = await page();
  const j = await p.evaluate(() => fetch('usage.json', { cache: 'no-store' }).then(r => r.json()));
  expect(j.day && j.updated && j.models && j.limits, 'usage.json missing day, updated, models, or limits');
});

/* Staging vs live (lib/channel.js). The deploy runs these tests once per lane: plain for
   live, APP_CHANNEL=staging for staging, so each build is checked for the right behavior. */
if (process.env.APP_CHANNEL === 'staging') {
  await check('staging build: shows the STAGING badge and keeps its saved data under stg: keys', async () => {
    const p = await page();
    const badge = await p.textContent('#stgBadge').catch(() => '');
    expect(/STAGING · v\d+\.\d+\.\d+/.test(badge || ''), 'STAGING badge with version missing, got: ' + badge);
    expect(/^STAGING/.test(await p.title()), 'tab title should start with STAGING');
    const keys = await p.evaluate(() => {
      localStorage.setItem('stp-probe', '1');
      const raw = []; for (let i = 0; i < localStorage.length; i++) raw.push(localStorage.key(i));
      const back = localStorage.getItem('stp-probe');
      localStorage.removeItem('stp-probe');
      return { raw, back };
    });
    expect(keys.back === '1', 'reading back a saved key failed on staging');
    expect(keys.raw.length && keys.raw.every(k => k.startsWith('stg:')), 'every stored key should start with stg:, got: ' + keys.raw.join(', '));
  });
} else {
  await check('live build: no STAGING badge and saved keys stay unprefixed', async () => {
    const p = await page();
    expect(!(await p.$('#stgBadge')), 'live build must not show the STAGING badge');
    const raw = await p.evaluate(() => { localStorage.setItem('stp-probe', '1'); const r = []; for (let i = 0; i < localStorage.length; i++) r.push(localStorage.key(i)); localStorage.removeItem('stp-probe'); return r; });
    expect(raw.includes('stp-probe') && !raw.some(k => k.startsWith('stg:')), 'live keys should be unprefixed, got: ' + raw.join(', '));
  });
}

await browser.close();
server.kill();
for (const r of results) console.log(r.join('  '));
/* On GitHub Actions, each failure also becomes an annotation on the run page. */
if (process.env.GITHUB_ACTIONS) for (const r of results) if (r[0] === 'FAIL') console.log('::error title=Smoke test failed::' + (r[1] + ': ' + (r[2] || '')).replace(/\r?\n/g, ' ').slice(0, 900));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed` + (ONLY ? `, ${skipped} skipped (ONLY=${process.env.ONLY}; run plain npm test before pushing)` : ''));
if (ONLY && !results.length) { console.log('No check name matches ONLY=' + process.env.ONLY); process.exit(1); }
process.exit(failed ? 1 : 0);
