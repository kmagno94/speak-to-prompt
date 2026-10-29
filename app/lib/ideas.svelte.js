/* 💡 Ideas tab: Kevin's own bug, idea, and "faster way" jar for improving Speak to Prompt.
   Ported from B&B Daily's Ideas tab, cut down for a static site:
   - Owner only. Hidden until "Show my Ideas tab" is on in More options.
   - Saved on this phone only (localStorage). Nothing goes to a server.
   - Never holds the user's words: the panel saves only what is typed into the panel
     itself. The context trail keeps area names and problem signals (like "Gemini
     failed"), never anything from the prompt box, questions, or result.
   - The trail lives in memory only and resets on reload, by design.
   - Fix session copies one prompt that hands every open idea to a fresh Claude chat. */

import { RELEASE_LIMIT } from './releases.js';

const LIST_KEY = 'stp-ideas';
const ON_KEY = 'stp-ideas-on';
const SEMVER = typeof __SEMVER__ !== 'undefined' ? __SEMVER__ : '';
export const REPO = 'kmagno94/speak-to-prompt';

export const KINDS = [
  { key: 'bug', icon: '🐞', label: 'Bug', ph: 'What went wrong? What did you expect?' },
  { key: 'idea', icon: '💡', label: 'Idea', ph: 'What should it do? Why would it help?' },
  { key: 'faster', icon: '⚡', label: 'Faster way', ph: 'What takes too long? What would be quicker?' }
];
export const SOON = [
  { key: 'now', icon: '🔥', label: 'Now', hint: 'Next session' },
  { key: 'soon', icon: '🗓️', label: 'Soon', hint: 'This week' },
  { key: 'someday', icon: '🌱', label: 'Someday', hint: 'When there’s time' }
];

/* Areas of Speak to Prompt, each with a few starter topics. Keys are permanent;
   labels and starters can change. `sel` maps taps on the page to an area. */
export const AREAS = [
  { key: 'input', label: 'Thoughts box', group: 'Before', sel: '#thoughts, #ideas, #ideasShow, #pasteWrap, #voiceRow, #coach, #handoff',
    topics: [['paste', 'Paste or transcript', 'Pasting in a transcript '], ['strip', 'Idea strip', 'The swipe ideas '], ['talk', 'Talk it out shortcut', 'The Talk it out shortcut ']] },
  { key: 'start', label: 'Not sure where to start?', group: 'Before', sel: '.starterwrap',
    topics: [['cats', 'Categories', 'The categories '], ['answers', 'Tap answers', 'The tap answers '], ['sliders', 'Sliders', 'The sliders ']] },
  { key: 'modes', label: 'Quick and Normal', group: 'Before', sel: '.modes, #modeHint, .coretoggle',
    topics: [['pick', 'Which mode to pick', 'Choosing a mode '], ['time', 'Time estimate', 'The time shown for a mode ']] },
  { key: 'build', label: 'Building', group: 'During', sel: '#build, #dockBuild, #buildTrack, #buildStatus, #resultTrack',
    topics: [['slow', 'Too slow', 'Building took '], ['fallback', 'Fell back to quick version', 'It switched to the quick version when '], ['estimate', 'Estimate was off', 'The time left said ']] },
  { key: 'questions', label: 'Follow-up questions', group: 'During', sel: '#qa',
    topics: [['quality', 'Question quality', 'A question asked '], ['count', 'Too many or too few', 'It asked '], ['taps', 'Suggested answers', 'The suggested answers ']] },
  { key: 'result', label: 'Your prompt', group: 'After', sel: '#result, #output, #madeBy, #gradeNote, #numWarn, #repairNote, .xray',
    topics: [['quality', 'Prompt quality', 'The prompt '], ['missing', 'Left something out', 'It left out '], ['length', 'Too long or short', 'The prompt was '], ['grade', 'Grade or X-ray', 'The grade said ']] },
  { key: 'copy', label: 'Copy and open', group: 'After', sel: '#copy, #copyNote, .openrow, #status',
    topics: [['copy', 'Copy didn’t work', 'Copying '], ['open', 'Opening the AI app', 'Opening ']] },
  { key: 'notes', label: 'Save to Notes', group: 'After', sel: '.keep, #fileLink',
    topics: [['save', 'Saving a record', 'Save to Notes ']] },
  { key: 'key', label: 'Gemini key', group: 'Setup', sel: '#keyPanel',
    topics: [['setup', 'Getting a key', 'Setting up the key '], ['limits', 'Daily limits', 'It ran out of ']] },
  { key: 'dev', label: 'Dev tools and core', group: 'Setup', sel: '#moreOpts, #devRow, #testLog, #coreBtn',
    topics: [['core', 'Your core', 'Your core '], ['grader', 'Grader and bench', 'The grader '], ['stats', 'Run stats', 'Run stats ']] },
  { key: 'guide', label: 'First time and guide', group: 'Setup', sel: '#tutorial, #guide, #firstTime',
    topics: [['tutorial', 'Tutorial', 'The tutorial ']] },
  { key: 'look', label: 'Look and feel', group: 'Anywhere', sel: '',
    topics: [['layout', 'Layout', 'On my phone the '], ['words', 'Wording', 'The words '], ['motion', 'Animation', 'The animation ']] }
];
export const areaOf = (key) => AREAS.find((a) => a.key === key) || null;
/* Most specific first: Copy and open sits inside the result card, so it's checked before it. */
const MATCH_ORDER = ['copy', 'notes', 'build', 'modes', 'start', 'input', 'questions', 'guide', 'key', 'dev', 'result'];

/* Problem signals and the topic each one points at. app.js raises them with
   window.dispatchEvent(new CustomEvent('stp-signal', { detail: { s, note } })). */
const SIGNAL_TOPIC = { 'gemini-failed': ['build', 'fallback'], 'copy-failed': ['copy', 'copy'], 'rage-tap': null, 'page-error': null, 'slow': ['build', 'slow'] };
export const SIGNAL_LABEL = { 'gemini-failed': 'Gemini failed', 'copy-failed': 'Copy failed', 'rage-tap': 'Fast repeat taps', 'page-error': 'Page error', 'slow': 'Slow build' };

function readList() { try { const v = JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function writeList(v) { try { if (v.length) localStorage.setItem(LIST_KEY, JSON.stringify(v)); else localStorage.removeItem(LIST_KEY); } catch (e) {} }
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

class Ideas {
  on = $state(false);        // "Show my Ideas tab"
  list = $state([]);         // every idea on this phone
  open = $state(false);      // the panel
  trail = $state([]);        // last places, newest first: [{ area, signals: [{ s, note }] }]

  openList = $derived(this.list.filter((i) => i.status === 'open').sort((a, b) => (a.at < b.at ? -1 : 1)));
  todayCount = $derived(this.list.filter((i) => i.date === today()).length);

  constructor() {
    try { this.on = localStorage.getItem(ON_KEY) === '1'; } catch (e) {}
    this.list = readList();
  }

  saveOn() { try { if (this.on) localStorage.setItem(ON_KEY, '1'); else localStorage.removeItem(ON_KEY); } catch (e) {} if (!this.on) this.open = false; }

  add({ kind, area, topic, text, soon }) {
    const a = areaOf(area), t = a && topic ? a.topics.find((x) => x[0] === topic) : null;
    const item = {
      id: newId(), kind, area, where: a ? a.label : 'Other', topic: topic || '', topicLabel: t ? t[1] : '',
      text: String(text || '').trim().slice(0, 1000), soon,
      context: { trail: this.trail.map((p) => p.area), signals: this.trail.flatMap((p) => p.signals.map((g) => ({ s: g.s, area: p.area }))) },
      at: new Date().toISOString(), date: today(), version: SEMVER, status: 'open'
    };
    this.list = [item, ...this.list];
    writeList(this.list);
    return item;
  }

  setStatus(id, status) {
    /* Reopening keeps an idea open even if a fix lists it later, so it isn't closed again. */
    this.list = this.list.map((i) => (i.id !== id ? i : { ...i, status, statusAt: new Date().toISOString(), fixedIn: status === 'fixed' ? SEMVER : undefined, by: undefined, keepOpen: status === 'open' ? true : i.keepOpen }));
    writeList(this.list);
  }

  /* Edit: change what an idea says. Same 1,000 character cap as a new one; empty keeps the old text. */
  edit(id, text) {
    const t = String(text || '').trim().slice(0, 1000);
    if (!t) return false;
    this.list = this.list.map((i) => (i.id !== id ? i : { ...i, text: t, editedAt: new Date().toISOString() }));
    writeList(this.list);
    return true;
  }

  remove(id) { this.list = this.list.filter((i) => i.id !== id); writeList(this.list); }

  /* Clear done: removes every fixed and won't-do idea from this phone. */
  clearDone() { this.list = this.list.filter((i) => i.status === 'open'); writeList(this.list); }

  /* Fixes close their own ideas: each fix commit adds the idea's id to ideas-done.json
     (ids, commit, and a short note about the fix, never the idea's text). On open, the
     tab marks matching open ideas fixed, so the next Fix session only lists what's left. */
  closedNote = $state('');
  async syncDone() {
    if (!this.on || typeof fetch !== 'function') return;
    let done = [];
    try { const r = await fetch('ideas-done.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) done = (await r.json()).done || []; } catch (e) { return; }
    const byId = new Map(done.filter((d) => d && typeof d.id === 'string').map((d) => [d.id, d]));
    let n = 0;
    this.list = this.list.map((i) => {
      const d = byId.get(i.id);
      if (!d || i.status !== 'open' || i.keepOpen) return i;
      n++;
      return { ...i, status: 'fixed', statusAt: new Date().toISOString(), fixedIn: String(d.version || SEMVER).slice(0, 20), by: String(d.commit || '').slice(0, 12), fixNote: String(d.note || '').slice(0, 140) };
    });
    if (n) { writeList(this.list); this.closedNote = `✅ ${n} idea${n === 1 ? '' : 's'} closed by the latest fixes. They're under Show done.`; }
  }

  /* Context trail: called when a tap lands in a new area. Keeps the last 3. */
  notePlace(area) {
    if (!area || (this.trail[0] && this.trail[0].area === area)) return;
    this.trail = [{ area, signals: [] }, ...this.trail.filter((p) => p.area !== area)].slice(0, 3);
  }
  signal(s, note) {
    if (!SIGNAL_LABEL[s]) return;
    const t = SIGNAL_TOPIC[s];
    if (t && (!this.trail[0] || this.trail[0].area !== t[0])) this.notePlace(t[0]);
    if (!this.trail.length) this.trail = [{ area: 'look', signals: [] }];
    const head = this.trail[0];
    if (head.signals.some((g) => g.s === s)) return;
    this.trail = [{ ...head, signals: [...head.signals, { s, note: String(note || '').slice(0, 80) }] }, ...this.trail.slice(1)];
  }

  /* "Looks like it might be…": up to 3 picks from the trail, problems first. */
  suggestions(kind) {
    const out = [];
    const push = (area, topic, why) => { if (out.length < 3 && areaOf(area) && !out.some((o) => o.area === area && o.topic === topic)) out.push({ area, topic, why }); };
    for (const p of this.trail) for (const g of p.signals) {
      const t = SIGNAL_TOPIC[g.s];
      push(t ? t[0] : p.area, t ? t[1] : (areaOf(p.area)?.topics[0] || [''])[0], SIGNAL_LABEL[g.s]);
    }
    if (kind !== 'bug' || out.length < 3) for (const p of this.trail) push(p.area, (areaOf(p.area)?.topics[0] || [''])[0], 'You were just here');
    return out;
  }
}
export const ideas = new Ideas();

/* Tap tracking for the trail, plus the two signals the page can spot by itself:
   fast repeat taps on one control, and script errors. Reads only which control
   was tapped, never what's typed. */
let started = false;
export function startTrail() {
  if (started || typeof document === 'undefined') return;
  started = true;
  let last = { el: null, n: 0, t: 0 };
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el || el.closest('.ideatab, .ideapanel')) return;
    const hit = MATCH_ORDER.find((k) => el.closest(areaOf(k).sel));
    if (hit) ideas.notePlace(hit);
    const ctl = el.closest('button, a, label, input');
    const now = Date.now();
    if (ctl && ctl === last.el && now - last.t < 700) { last.n++; if (last.n >= 3) ideas.signal('rage-tap', ''); }
    else last = { el: ctl, n: 1, t: now };
    last.t = now;
  }, true);
  window.addEventListener('stp-signal', (e) => { const d = e.detail || {}; ideas.signal(d.s, d.note); });
  window.addEventListener('error', () => ideas.signal('page-error', ''));
  window.addEventListener('unhandledrejection', () => ideas.signal('page-error', ''));
}

/* Fix session: one prompt that hands every open idea to a fresh Claude chat. */
export function fixPrompt(list = ideas.openList) {
  const k = (key) => KINDS.find((x) => x.key === key) || KINDS[0];
  const s = (key) => SOON.find((x) => x.key === key) || SOON[1];
  const lines = list.map((i, n) => {
    const ctx = [i.context?.trail?.length ? 'trail: ' + i.context.trail.map((a) => areaOf(a)?.label || a).join(' > ') : '', i.context?.signals?.length ? 'signals: ' + i.context.signals.map((g) => SIGNAL_LABEL[g.s] + ' in ' + (areaOf(g.area)?.label || g.area)).join(', ') : ''].filter(Boolean).join('; ');
    return `${n + 1}. ${k(i.kind).icon} ${k(i.kind).label} · ${s(i.soon).icon} ${s(i.soon).label} · ${i.where}${i.topicLabel ? ' > ' + i.topicLabel : ''} · logged ${i.date}${i.version ? ' on v' + i.version : ''} (id ${i.id})\n   ${i.text}${ctx ? '\n   Context: ' + ctx : ''}`;
  });
  return `Fix session: Speak to Prompt, ${list.length} open idea${list.length === 1 ? '' : 's'} from my Ideas tab.

Start your first reply with this chat name in its own code block, plus "Rename this chat to this":
Speak to Prompt · Fix session · ${new Date().getMonth() + 1}/${new Date().getDate()}

Project facts:
- Repo: ${REPO}. Ask me to attach it if you can't reach it.
- Live: https://kmagno94.github.io/speak-to-prompt/ | Staging: https://kmagno94.github.io/speak-to-prompt/staging/
- Svelte 5 + Vite on GitHub Pages, npm test gates every deploy.
- Hard rule: the site never saves the user's words.

Open ideas, oldest first:
${lines.join('\n') || '(none)'}

Do this:
1. Read README.md first (How releases work has the whole loop).
2. Release limit, before any code: git fetch origin main, then npm run check:release. If staging is ${RELEASE_LIMIT}/${RELEASE_LIMIT} ahead of live or more, stop: tell me to run the promote checklist on staging and promote first, build nothing, and put every change I ask for in the backlog (step 8). Also check the latest staging run's "Full tests (staging, background)" job (gh run list --branch staging); if it's red, fixing that comes first.
3. Plan: a table of every idea (#, what you'd change, size S/M/L, risk). Group the small safe ones into one batch, then the rest one at a time, most urgent first, each with options and one recommendation. Wait for my OK.
4. Build on the staging branch only. Never push to main. Only a promote pull request touches main. Add a smoke test for each bug you fix.
5. For each change: a messy voice-memo style "Try it" note (made-up details) plus a what-to-tap, what-I-should-see table.
6. In the same commit as each fix, add the idea's id to ideas-done.json at the repo root ({ "id", "commit", "version", "note" }, where the note says what changed and never repeats the idea's text). My Ideas tab closes those ideas by itself once staging deploys, so the next Fix session only lists what's left. Tell me which numbers you closed so I can check them; if one isn't right I'll tap Reopen.
7. Finish the session as one staging build: bump the patch version in package.json and package-lock.json, and add a matching entry at the top of releases.json (version, date, title, plain-English items, and checks with "say" and "see" that I can do on staging today; if a check needs a state that isn't there yet, ship a preview or sample with it). Before you push: npm run check:release, QUICK=1 npm test (the core set, about a minute), and ONLY=<area> npm test for every area you touched. The staging deploy runs the same quick gate; confirm its build and deploy jobs finished green before saying staging is updated. The full suite runs in the background on that push ("Full tests (staging, background)"): tell me when it's green, and if it's red, fix it before anything else. Then tell me "Staging is N/${RELEASE_LIMIT} ahead of live" and give me the staging Test lab link: https://kmagno94.github.io/speak-to-prompt/staging/#testlab (it walks every releases.json check for the builds that aren't live yet, so write checks I can tap through there).
8. Backlog, so nothing gets lost: anything I ask for that you don't build this session (limit reached, out of scope, or "later") goes in a "Queued for my jar" table at the end (kind, area, how soon, one line in my words), so I can drop each one in the 💡 jar.
9. Promote, only when I say "Pre-flight passed, promote" (the Test lab copies that phrase once every check passes): open the pull request from staging into main, wait for its Promote check (the full suite on what goes live) to pass, then merge it, tag main with the version (like v2.1.1), and confirm the main deploy run (full suite on both lanes) finished green. Return a ✅ table, one row per step. Then a 🔁 Loop check table (Question | Answer): what slowed this round, did anything skip the process, and one fix for the loop (or "none"). A real fix goes in the Queued for my jar table. "Roll back to vX.Y.Z" means Actions > Test and deploy > Run workflow with that tag in live_tag.
10. A full loop audit only after a roll back, the same check failing twice, or about once a month.

How I work: casual like a friend, tables and lists, one clear recommendation. Start every reply with "STEP #: " and a one-line summary. Never say a push or deploy worked unless you confirmed it. Delete only when I say so. Never put my email on a public page. No em dashes. If Notion is connected, log each change in this project's Building Log with your full response.`;
}
