/* 🧪 Test lab (staging only): walk every check from releases.json for the builds that aren't
   live yet, mark each ✓ Works or ✗ Broken, and get a promote verdict. Ported from B&B Daily.
   - Staging build only. Shown with the Ideas tab toggle, or opened straight from #testlab.
   - Results are saved on this phone only ("stp-testlab", under stg: like everything on staging).
   - A ✗ can go straight into the 💡 Ideas jar, so it rides the next Fix session, or
     📋 Copy report puts every broken check (with your notes) on the clipboard for the chat.
   - Live's version is baked into the staging build by the deploy (LIVE_SEMVER). Staging only,
     ?live=2.0.0 in the address overrides it, to preview a plan. */
import { IS_STAGING } from './channel.js';
import { labPlan, runSteps, verdict, labReport } from './testlabPlan.js';
import { releaseStatus } from './releases.js';
import { SEMVER } from './channel.js';
import { ideas } from './ideas.svelte.js';

const KEY = 'stp-testlab';
const BAKED_LIVE = typeof __LIVE_SEMVER__ !== 'undefined' ? __LIVE_SEMVER__ : '';

function readResults() { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function liveFromUrl() { try { return new URLSearchParams(location.search).get('live') || ''; } catch (e) { return ''; } }

class TestLab {
  enabled = IS_STAGING;
  open = $state(false);
  fromHash = $state(false);
  releases = $state([]);
  loaded = $state(false);
  failedLoad = $state(false);
  live = $state(BAKED_LIVE);
  results = $state({});

  plan = $derived(labPlan(this.releases, this.live));
  verdict = $derived(verdict(this.plan, this.results));
  run = $derived(runSteps(this.plan, this.results));
  visible = $derived(this.enabled && (ideas.on || this.fromHash));
  report = $derived.by(() => { const st = this.live ? releaseStatus(this.releases, this.live) : null; return labReport(this.plan, this.results, { staging: SEMVER, live: this.live, ahead: st ? `${st.count}/${st.limit}` : '' }); });

  constructor() {
    if (!this.enabled) return;
    this.results = readResults();
    this.live = (IS_STAGING && liveFromUrl()) || BAKED_LIVE;
    try { if (location.hash === '#testlab') { this.fromHash = true; this.open = true; } } catch (e) {}
  }

  async load() {
    if (!this.enabled || this.loaded || typeof fetch !== 'function') return;
    try {
      const r = await fetch('releases.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      this.releases = Array.isArray(j.releases) ? j.releases : [];
    } catch (e) { this.failedLoad = true; }
    this.loaded = true;
  }

  mark(key, s, note = '') {
    this.results = { ...this.results, [key]: { s, note: String(note || '').trim().slice(0, 300), at: new Date().toISOString() } };
    try { localStorage.setItem(KEY, JSON.stringify(this.results)); } catch (e) {}
  }
  clear(key) {
    const next = { ...this.results }; delete next[key]; this.results = next;
    try { localStorage.setItem(KEY, JSON.stringify(this.results)); } catch (e) {}
  }
  reset() { this.results = {}; try { localStorage.removeItem(KEY); } catch (e) {} }

  /* ✗ Broken → an open 🔥 Now bug in the Ideas jar. Only the check's own words and the note typed here. */
  toJar(step) {
    const r = this.results[step.key];
    const where = step.version ? `v${step.version} check` : 'Before you promote check';
    const text = `Test lab, ${where}: ${step.say} Expected: ${step.see}${r?.note ? ' What happened: ' + r.note : ''}`;
    ideas.add({ kind: 'bug', area: 'look', topic: '', text, soon: 'now' });
    this.results = { ...this.results, [step.key]: { ...(r || { s: 'fail', note: '' }), s: 'fail', jar: true, at: new Date().toISOString() } };
    try { localStorage.setItem(KEY, JSON.stringify(this.results)); } catch (e) {}
  }
}
export const lab = new TestLab();
