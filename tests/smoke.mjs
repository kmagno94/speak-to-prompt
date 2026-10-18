// Speak to Prompt smoke tests. Mocks Gemini, drives the page at phone size,
// and fails (exit 1) on any broken check. Run: npm test (from this folder).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

/* Gemini mock. opts: models, intake (object), write (string), fail (model -> status), finish (model -> reason) */
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], timezoneId: 'America/New_York' });
  const p = await ctx.newPage();
  p.errors = [];
  p.calls = [];
  let reviewN = 0, rewriteN = 0;
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
    const intake = /intake step/.test(ask), research = !!body.tools, review = /strict quality reviewer/.test(ask), rewrite = /REVIEWER'S FIXES/.test(ask), rank = /judging which version/.test(ask);
    p.calls.push({ model, intake, research, review, rewrite, rank, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: ask });
    if (opts.fail && opts.fail[model]) return r.fulfill({ status: opts.fail[model], headers: h, body: JSON.stringify({ error: { code: opts.fail[model], message: 'mock' } }) });
    if (research && opts.researchFail && opts.researchFail[model]) return r.fulfill({ status: 400, headers: h, body: JSON.stringify({ error: { code: 400, message: 'Search not supported' } }) });
    if (review && opts.reviewDelay) await new Promise(res => setTimeout(res, opts.reviewDelay));
    let pick = null;
    if (rank) {
      const blocks = [...ask.matchAll(/VERSION ([A-C]):\n"""\n([\s\S]*?)\n"""/g)].map(m => ({ label: m[1], text: m[2] }));
      const draftText = opts.write || 'THE PROMPT';
      const want = opts.pick === 'draft' ? blocks.find(b => b.text === draftText) : (blocks.filter(b => b.text !== draftText).pop() || blocks[0]);
      pick = { best: want.label, why: 'Mock judge picked it.', seen: blocks.length };
      p.rankSeen = blocks.length;
    }
    const reviews = opts.review || [grade(10)];
    const text = intake ? JSON.stringify(opts.intake || { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'standard', questions: [{ question: 'Devices?', choices: ['iPhone'] }] })
      : research ? (opts.research || '- iOS 27 is the current iPhone software (apple.com)')
      : review ? JSON.stringify(reviews[Math.min(reviewN++, reviews.length - 1)])
      : rewrite ? (opts.rewriteText || 'BETTER PROMPT ' + (++rewriteN))
      : rank ? JSON.stringify(pick)
      : (opts.write || 'THE PROMPT');
    const finishReason = (opts.finish && opts.finish[model]) || 'STOP';
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 500, thoughtsTokenCount: 100 }, candidates: [{ finishReason, content: { parts: [{ text }] } }] }) });
  });
  await p.goto(BASE);
  return p;
}
/* A review where the first n of 10 checks pass; claim is what the reviewer says its total is. */
function grade(n, claim) {
  return { score: claim, checks: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, pass: i < n, fix: i < n ? '' : 'Fix check ' + (i + 1) })) };
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

await check('cut-off answer (finishReason MAX_TOKENS) is not shown', async () => {
  const p = await page({ finish: { 'gemini-3.8-flash': 'MAX_TOKENS' }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  expect(p.calls.filter(c => !c.intake).pop().model === 'gemini-3.7-flash', 'incomplete answer was accepted');
});

const SIMPLE = { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] };
await check('Deep mode: shows the draft at once, polishes in the background, swaps in a rewrite that wins blind', async () => {
  const p = await page({ intake: SIMPLE, review: [grade(7), grade(10)], researchFail: { 'gemini-3.5-flash-lite': 400 }, reviewDelay: 900 });
  await withKey(p); await p.check('#deepMode');
  expect(/blind comparison/.test(await p.textContent('#modeHint')), 'Deep hint missing');
  await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForFunction(() => document.getElementById('output').value === 'THE PROMPT', null, { timeout: 15000 });
  expect(await p.isVisible('#polishStatus'), 'polishing status should show while the draft is up');
  expect(!(await p.isDisabled('#copy')), 'draft should be copyable right away');
  await p.waitForFunction(() => /swapped in/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
  const research = p.calls.filter(c => c.research), draft = p.calls.find(c => !c.intake && !c.research && !c.review && !c.rewrite && !c.rank);
  expect(research.some(c => /lite/.test(c.model)) && research.some(c => c.model === 'gemini-3.8-flash'), 'research should fall back from Flash-Lite to Flash');
  expect(draft.model === 'gemini-3.8-flash' && draft.level === 'high', `draft should be 3.8 Flash at high, got ${draft.model} ${draft.level}`);
  expect(/iOS 27 is the current/.test(draft.text), 'looked-up facts not passed to the writer');
  const reviews = p.calls.filter(c => c.review), rewrites = p.calls.filter(c => c.rewrite);
  expect(reviews.length === 2 && reviews.every(c => !/lite/.test(c.model)), 'reviews should run on Flash, not Flash-Lite');
  expect(/length limit the person did not ask for counts as invented/.test(reviews[0].text), 'rubric missing the no-invented-length rule');
  expect(rewrites.length === 1 && /Fix check 8/.test(rewrites[0].text), 'rewrite did not get the reviewer fixes');
  expect(p.calls.filter(c => c.rank).length === 1, 'expected one blind comparison');
  expect(await p.inputValue('#output') === 'BETTER PROMPT 1', 'winning rewrite not swapped in');
  expect(!(await p.isVisible('#polishStatus')), 'polishing status should clear when done');
  expect(await p.isVisible('#refineLog'), 'refine log hidden');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('Deep mode: 2 rewrites max, scores counted not claimed, draft kept when it wins blind', async () => {
  const p = await page({ intake: SIMPLE, review: [grade(6), grade(7, 10)], pick: 'draft' });
  await withKey(p); await p.check('#deepMode');
  await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForFunction(() => /held up best/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
  expect(p.calls.filter(c => c.rewrite).length === 2, 'a claimed 10/10 was trusted, or the cap is wrong');
  expect(p.rankSeen === 3, 'blind comparison should see the draft and both rewrites');
  expect(await p.inputValue('#output') === 'THE PROMPT', 'draft should stay when it wins');
  expect(/6\/10/.test(await p.textContent('#madeBy')), 'draft score missing: ' + await p.textContent('#madeBy'));
});

await check('Deep mode: a rewrite that scores lower keeps the draft (questions path)', async () => {
  const p = await page({ review: [grade(8), grade(6)] });
  await withKey(p); await p.check('#deepMode');
  await p.fill('#thoughts', 'memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])');
  expect(/Deep prompt/.test(await p.textContent('#qaPlan')), 'questions card should say Deep prompt');
  expect(p.calls.some(c => c.research), 'research should start while the questions are showing');
  await p.click('#qaList .chips button'); await p.click('#qaGo');
  await p.waitForFunction(() => /held up best/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
  expect(p.calls.filter(c => c.rewrite).length === 1, 'should stop after the lower-scoring rewrite');
  expect(!p.calls.some(c => c.rank), 'no comparison needed when the rewrite scored lower');
  expect(await p.inputValue('#output') === 'THE PROMPT', 'should keep the 8/10 draft');
});

await check('Deep mode: the page catches a changed version number even when the reviewer gives 10/10', async () => {
  const p = await page({ intake: SIMPLE, review: [grade(10), grade(10)], write: 'Set it up on iOS 18 at 10:15 PM.', rewriteText: 'Set it up on iOS 27 at 10:15 PM.' });
  await withKey(p); await p.check('#deepMode');
  await p.fill('#thoughts', 'every night at 10:15 on my iPhone, I am on iOS 27'); await p.click('#build');
  await p.waitForFunction(() => /swapped in/.test(document.getElementById('madeBy').textContent), null, { timeout: 15000 });
  const draft = p.calls.find(c => !c.intake && !c.research && !c.review && !c.rewrite && !c.rank);
  expect(/even if you don't recognize it/.test(draft.text), 'writer missing the keep-versions rule');
  const rw = p.calls.find(c => c.rewrite);
  expect(rw && /Keep these exactly as I gave them: 27/.test(rw.text) && /never gave: 18/.test(rw.text), 'rewrite did not get the number fixes');
  expect(await p.inputValue('#output') === 'Set it up on iOS 27 at 10:15 PM.', 'corrected version not shown');
  expect(/Numbers you never gave: 18/.test(await p.textContent('#refineBody')), 'refine log should show the bad number');
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
  await p.click('#moreOpts summary'); await p.check('#statsToggle');
  await withKey(p); await p.fill('#thoughts', 'my secret memo'); await p.click('#build');
  await p.waitForSelector('#qa:not([hidden])'); await p.click('#qaGo'); await done(p);
  await p.waitForTimeout(300);
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
  expect(!(await p.isVisible('#bannerPaste')), 'paste button should only show from the shortcut');
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
  await p.waitForTimeout(4500);
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

await check('usage.json is valid', async () => {
  const p = await page();
  const j = await p.evaluate(() => fetch('usage.json', { cache: 'no-store' }).then(r => r.json()));
  expect(j.day && j.updated && j.models && j.limits, 'usage.json missing day, updated, models, or limits');
});

await browser.close();
server.kill();
for (const r of results) console.log(r.join('  '));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
