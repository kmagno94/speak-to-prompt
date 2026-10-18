// Speak to Prompt smoke tests. Mocks Gemini, drives the page at phone size,
// and fails (exit 1) on any broken check. Run: npm install && npm test (from the repo root).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
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
    p.calls.push({ model, intake, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: ask });
    if (opts.fail && opts.fail[model]) return r.fulfill({ status: opts.fail[model], headers: h, body: JSON.stringify({ error: { code: opts.fail[model], message: 'mock' } }) });
    const text = intake ? JSON.stringify(opts.intake || { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'standard', questions: [{ question: 'Devices?', choices: ['iPhone'] }] })
      : (opts.write || 'THE PROMPT');
    const finishReason = (opts.finish && opts.finish[model]) || 'STOP';
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 500, thoughtsTokenCount: 100 }, candidates: [{ finishReason, content: { parts: [{ text }] } }] }) });
  });
  await p.goto(BASE);
  return p;
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
  expect(await p.$$eval('.brief li', l => l.length) === 2, 'summary should list the 2 answered questions');
  await p.click('.brief li button >> text=Tokyo');
  await p.waitForSelector('#qaList .msg.ai >> text=let\'s change that');
  await p.click('#qaList .chips button >> text=Paris');
  await p.waitForSelector('.brief li >> text=Paris');
  await p.click('#qaGo'); await done(p);
  const write = p.calls.find(c => !c.intake).text;
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
  await p.click('#starter .chips button >> text=Save for something');
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
  await p.click('#starter .chips button >> text=Fix a problem');
  await p.waitForSelector('#starter .msg.ai >> text=Anything else');
  await p.click("#starter .chips button >> text=That's it");
  await p.click('#starterBuild'); await done(p);
  const out = await p.inputValue('#output');
  expect(/What it's about: my car makes a weird noise\./.test(out) && /What I want: Fix a problem\./.test(out) && !/Also:/.test(out) && !/Detail:/.test(out), 'build did not use the starting text (sliders should reset to the middle)');
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
