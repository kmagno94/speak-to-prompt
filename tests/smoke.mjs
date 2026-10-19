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
async function devOn(p) { await p.evaluate(() => localStorage.setItem('stp-dev', '1')); await p.reload(); }

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], timezoneId: 'America/New_York', ...(opts.ua ? { userAgent: opts.ua } : {}) });
  const p = await ctx.newPage();
  p.errors = [];
  p.calls = [];
  p.repairs = [];   // Auto-Repair requests, kept apart so older tests see only intake and write calls
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
      if (opts.repairFail) return r.fulfill({ status: 503, headers: h, body: JSON.stringify({ error: { code: 503, message: 'mock' } }) });
      const fixed = opts.repair != null ? opts.repair : (opts.write || 'THE PROMPT');
      return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 200 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: fixed }] } }] }) });
    }
    p.calls.push({ model, intake, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: ask });
    if (opts.fail && opts.fail[model]) return r.fulfill({ status: opts.fail[model], headers: h, body: JSON.stringify({ error: { code: opts.fail[model], message: 'mock' } }) });
    const text = intake ? JSON.stringify(opts.intake || { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'standard', questions: [{ question: 'Devices?', choices: ['iPhone'] }] })
      : (opts.write || 'THE PROMPT');
    const finishReason = (opts.finish && opts.finish[model]) || 'STOP';
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ usageMetadata: { totalTokenCount: 500, thoughtsTokenCount: 100 }, candidates: [{ finishReason, content: { parts: [{ text }] } }] }) });
  });
  if (opts.tuning) await p.route(/\/tuning\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.tuning) }));
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
  expect(text.split('\n')[0] === 'Pre-Sleep Focus Setup' && text.includes('### \u{1F680} Prompt Built'), 'shortcut text should be the full note');
  expect(await p.evaluate(() => navigator.clipboard.readText()) === text, 'note should also be copied as a backup');
  expect(/Process Voice Note/.test(await p.textContent('#keepStatus')), 'status should say where it went');
  expect(!(await p.evaluate(() => window.__shared)), 'share sheet should not open on the main button');
  await p.click('#saveShare');
  expect(await p.evaluate(() => window.__shared && window.__shared.text.startsWith('Pre-Sleep Focus Setup')), 'Share instead should open the share sheet with the note');
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
  // Relay down: falls back to the share sheet
  relayUp = false;
  await p.click('#reportSend');
  await p.waitForFunction(() => /share sheet instead/.test(document.getElementById('reportStatus').textContent));
  expect(await p.evaluate(() => window.__shared && window.__shared.text) === text, 'fallback share sheet should get exactly the preview');
  // Relay down on a computer without a share sheet: copy instead
  await p.evaluate(() => { navigator.share = undefined; });
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
  expect(await p.isHidden('#pasteWrap'), 'banner should close after pasting');
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
  const write = 'You are an experienced Japan travel planner.\nContext: My sister and I are planning a 5-day trip to Tokyo next spring with a total budget of $2,000. She loves anime and I love ramen.\nTask: Create a day-by-day itinerary that balances anime spots and ramen shops, with a rough daily budget of $400.\nFormat: Use a table for each day with morning, afternoon, and evening.\nStart right away, and ask at most one short question only if something essential is missing.';
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
  expect(await p.textContent('#xrayText .stray') === '$400.', 'the $400 should be marked as a number you never said');
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
  await p.click('#xrayBtn');
  await p.waitForSelector('#xray', { state: 'detached' });
  expect(await p.isVisible('#output'), 'Done should bring the prompt back');
  expect(!p.errors.length, 'page errors: ' + p.errors.join('; '));
});

await check('auto-repair: clean prompts go straight through; real problems get one small fix, rechecked, kept only if better', async () => {
  const RAW = 'ok so I want to plan a trip to Tokyo with my sister next spring. We have about 5 days and maybe $2,000 total. She loves anime and I love ramen. Also I get motion sick on long bus rides.';
  const BAD = 'You are an experienced Japan travel planner.\nContext: My sister and I are planning a 5-day trip to Tokyo next spring with a total budget of $2,000. She loves anime and I love ramen.\nTask: Create a day-by-day itinerary that balances anime spots and ramen shops, with a rough daily budget of $400.\nStart right away.';
  const GOOD = BAD.replace('with a rough daily budget of $400.', 'with a daily budget that fits the total. I get motion sick on long bus rides, so keep long bus trips out.');
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
  expect(/Also I get motion sick on long bus rides\./.test(ask) && /\$400/.test(ask) && /PROMPT TO FIX:/.test(ask) && /word for word/.test(ask), 'repair request should list exactly what to fix: ' + ask.slice(0, 300));
  expect(/lite/.test(p.repairs[0].model) && p.repairs[0].level === 'low', 'repair should use the fast model at low thinking: ' + p.repairs[0].model + ' ' + p.repairs[0].level);
  expect(await p.inputValue('#output') === GOOD, 'the fixed prompt should be shown');
  const note = await p.textContent('#repairNote');
  expect(/Auto-fixed: added 1 detail you said and removed 1 made-up number/.test(note), 'note wrong: ' + note);
  expect(sent[0].repair === 'fixed' && typeof sent[0].repair_s === 'number' && sent[0].xray_dropped === 0, 'run log should record the fix: ' + JSON.stringify(sent[0]));
  expect(!(await p.isVisible('#numWarn')), 'no number warning once the made-up number is gone');
  // 3. Fix isn't better: keep the original and say so
  ({ p, sent } = await run({ write: BAD, repair: BAD + '\nAlso budget $999 a day.' }));
  expect(await p.inputValue('#output') === BAD && /wasn't better, so this is the original/.test(await p.textContent('#repairNote')) && sent[0].repair === 'kept original', 'a worse fix must be thrown away');
  // 4. Fix fails: original, page still works
  ({ p, sent } = await run({ write: BAD, repairFail: true }));
  expect(await p.inputValue('#output') === BAD && /didn't come through/.test(await p.textContent('#repairNote')) && sent[0].repair === 'failed', 'a failed fix should fall back to the original');
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
    const r1 = await postRun({ mode: 'Full', words_in: 12, write_s: 9.5, core: true, outcome: 'ok', repair: 'fixed', xray_pct: 54, coach: 4, action: 'copied', xray_opened: true, est_intake_s: 3, secret: 'my words', nested: { a: 1 }, detours: 'x'.repeat(500) + ' | @kmagno94' }, '6.6.6.6');
    expect(r1.status === 201 && sent.length === 1 && sent[0].url === 'https://api.github.com/repos/kmagno94/speak-to-prompt/issues/2/comments', 'run should become a comment on issue #2');
    const c = JSON.parse(sent[0].init.body).body;
    expect(/\| mode \| Full \|/.test(c) && /\| words_in \| 12 \|/.test(c) && /\| core \| yes \|/.test(c) && /\| repair \| fixed \|/.test(c) && /\| xray_pct \| 54 \|/.test(c) && /\| coach \| 4 \|/.test(c) && /\| action \| copied \|/.test(c) && /\| xray_opened \| yes \|/.test(c) && /\| est_intake_s \| 3 \|/.test(c), 'run comment missing fields: ' + c);
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
  expect(few[0].est_from === 'built-in' && few[0].est_s !== 33, 'too few shared runs should be ignored: ' + JSON.stringify(few[0]));
  const { tuningFrom, parseRuns } = await import('../scripts/runlog-report.mjs');
  const row = (o, i) => ({ created_at: '2026-10-19T0' + i + ':00:00Z', body: '**Run x**\n\n| field | value |\n|---|---|\n' + Object.entries(o).map(([k, v]) => '| ' + k + ' | ' + v + ' |').join('\n') });
  const runs = parseRuns([10, 12, 11, 50, 13, 9].map((w, i) => row({ mode: 'Full', depth: 'standard', write_s: w, intake_s: 2, outcome: 'ok' }, i))
    .concat([row({ mode: 'Full', depth: 'complex', write_s: 20, outcome: 'ok' }, 7), row({ mode: 'Full', depth: 'standard', outcome: 'write failed: x' }, 8)]));
  const tf = tuningFrom(runs, '2026-10-19T09:00:00Z');
  expect(tf.depth.standard.secs === 12 && tf.depth.standard.runs === 6 && !tf.depth.complex && tf.intake.secs === 2, 'tuning math wrong: ' + JSON.stringify(tf));
});

await check('usage.json is valid', async () => {
  const p = await page();
  const j = await p.evaluate(() => fetch('usage.json', { cache: 'no-store' }).then(r => r.json()));
  expect(j.day && j.updated && j.models && j.limits, 'usage.json missing day, updated, models, or limits');
});

await browser.close();
server.kill();
for (const r of results) console.log(r.join('  '));
/* On GitHub Actions, each failure also becomes an annotation on the run page. */
if (process.env.GITHUB_ACTIONS) for (const r of results) if (r[0] === 'FAIL') console.log('::error title=Smoke test failed::' + (r[1] + ': ' + (r[2] || '')).replace(/\r?\n/g, ' ').slice(0, 900));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
