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
  p.on('pageerror', e => p.errors.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.route(/generativelanguage\.googleapis\.com/, async r => {
    const u = r.request().url(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    const models = opts.models || ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
    if (u.includes('/models?')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ models: models.map(n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] })) }) });
    const model = (u.match(/models\/([^:]+):/) || [])[1];
    const body = JSON.parse(r.request().postData());
    const intake = /intake step/.test(body.contents[0].parts[0].text);
    p.calls.push({ model, intake, level: body.generationConfig && body.generationConfig.thinkingConfig && body.generationConfig.thinkingConfig.thinkingLevel, text: body.contents[0].parts[0].text });
    if (opts.fail && opts.fail[model]) return r.fulfill({ status: opts.fail[model], headers: h, body: JSON.stringify({ error: { code: opts.fail[model], message: 'mock' } }) });
    const text = intake ? JSON.stringify(opts.intake || { title: 'Pre-Sleep Focus Setup', need: 'N', category: 'Shortcuts', complexity: 'standard', questions: [{ question: 'Devices?', choices: ['iPhone'] }] }) : (opts.write || 'THE PROMPT');
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
  expect(/gemini-3\.7-flash/.test(await p.textContent('#madeBy')), 'did not fall back to 3.7 Flash');
});

await check('cut-off answer (finishReason MAX_TOKENS) is not shown', async () => {
  const p = await page({ finish: { 'gemini-3.8-flash': 'MAX_TOKENS' }, intake: { title: 'T', need: 'N', category: 'Ideas', complexity: 'simple', questions: [] } });
  await withKey(p); await p.fill('#thoughts', 'memo'); await p.click('#build'); await done(p);
  expect(/gemini-3\.7-flash/.test(await p.textContent('#madeBy')), 'incomplete answer was accepted');
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
  await p.check('#statsToggle');
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

await check('from the shortcut: Clean up voice memo shows and leaves the clipboard alone', async () => {
  const p = await page({ intake: { title: 'T', need: 'N', category: 'Shortcuts', complexity: 'simple', questions: [] } });
  expect(/name=Speak%20to%20Prompt$/.test(await p.getAttribute('#talkLink', 'href')), 'Talk it out not pointing at Speak to Prompt');
  await withKey(p); await p.fill('#thoughts', 'typed, not from the shortcut'); await p.click('#build'); await done(p);
  expect(await p.$eval('#folderRow', e => e.hidden), 'cleanup button showed without the shortcut');
  await p.goto(BASE + '#paste');
  await p.evaluate(() => navigator.clipboard.writeText('memo from shortcut'));
  await p.click('#bannerPaste'); await p.waitForTimeout(200);
  await p.click('#build'); // same tab: the key is still filled in
  await p.waitForSelector('#folderRow:not([hidden])', { timeout: 15000 }).catch(() => { throw new Error('cleanup button missing after a shortcut run'); });
  await p.evaluate(() => navigator.clipboard.writeText('THE PROMPT'));
  await p.click('#fileMemo').catch(() => {}); await p.waitForTimeout(300);
  expect(await p.evaluate(() => navigator.clipboard.readText()) === 'THE PROMPT', 'clipboard was changed');
});

await check('AI app links: Gemini opens the app on iPhone, web on computers', async () => {
  const p = await page();
  expect(await p.getAttribute('#geminiLink', 'href') === 'https://gemini.google.com/app', 'desktop Gemini link changed');
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const m = await ctx.newPage(); await m.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); await m.goto(BASE);
  expect(await m.getAttribute('#geminiLink', 'href') === 'https://gemini.google.com/app/download/mobile', 'iPhone Gemini link not set to the app path');
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
