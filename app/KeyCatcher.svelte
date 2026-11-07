<script>
  /* Key catcher (AGT-15, merged with the key nudges in v2.1.23): the key panel opens with two
     big steps instead of a wall of text.
       1. Get my free key: opens Google AI Studio's key page in a new tab.
       2. Paste my key: reads the clipboard (only on that tap), checks it looks like a key,
          puts it in the box and runs Check key (one test call), then celebrates.
     Coming back from AI Studio (the tab shows again) opens the panel, scrolls to it and pulses
     Paste my key, like the Talk it out paste banner. The clipboard text is never shown,
     logged or saved. All of this is memory only; Remember my key stays your choice.
     v2.1.25 (Test lab 11/07): coming back from AI Studio tries the paste and the check by
     itself where the browser allows it (Chrome and others). iPhone Safari never lets a page
     read the clipboard without a tap plus its own Paste bubble, so there it falls back to the
     pulsing button. Once the key works and Remember my key is off, Remember wears the white
     halo (and scrolls into view) until it's ticked, so a click-through doesn't lose the key.
     Full version after a key (v2.1.25): if the prompt on screen is the quick version, a card
     right here says it rebuilds the full way in 5 seconds (questions first), with Build it now
     and Not now. Typing in the box, or any build, calls it off. Nothing is saved. */
  import { onMount } from 'svelte';
  import { ui } from './lib/ui.svelte.js';

  const STUDIO = 'https://aistudio.google.com/apikey';
  /* Gemini keys today look like AIza plus 35 letters, numbers, - or _. A different-looking
     single word is still tried (the test call is the real check); spaces or a sentence are not. */
  const KEY_RE = /AIza[0-9A-Za-z_-]{35}/;
  const LOOSE_RE = /^[0-9A-Za-z_.-]{30,80}$/;

  let hunting = $state(false);   // went to AI Studio from here and hasn't pasted yet
  let pulse = $state(false);
  let note = $state('');
  let kind = $state('');         // '' | 'good' | 'bad'
  let busy = $state(false);
  let full = $state(null);       // { left } while the 5 second full-version offer counts down
  let fullTick = 0;
  const FULL_MS = (typeof window !== 'undefined' && window.__fullWaitMs) || 5000;

  function panel() { return document.getElementById('keyPanel'); }
  let lastBack = 0;
  function bringBack() {
    const p = panel();
    if (!p || busy || Date.now() - lastBack < 1500) return;   /* focus and visibilitychange both fire */
    lastBack = Date.now();
    p.open = true;
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pulse = true;
    note = 'Welcome back! Copied your key? Tap Paste my key.';
    kind = '';
    pasteKey(true);   /* where the browser allows it, no tap needed */
  }

  /* Remember my key wears the white halo until it's ticked (v2.1.25). */
  function haloRemember() {
    const keep = document.getElementById('remember'), row = keep && keep.closest('label');
    if (!row || keep.checked) return;
    row.classList.add('keep-halo');
    setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    const off = () => { if (keep.checked) { row.classList.remove('keep-halo'); keep.removeEventListener('change', off); } };
    keep.addEventListener('change', off);
  }

  onMount(() => {
    const back = () => { if (hunting && document.visibilityState === 'visible') bringBack(); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => { document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); };
  });

  function getKey() { hunting = true; note = ''; kind = ''; }

  function say(text, k = '') { note = text; kind = k; }

  /* Waits for Check key's answer in #keyStatus (app.js sets class good or bad). */
  function awaitCheck() {
    const st = document.getElementById('keyStatus');
    return new Promise((done) => {
      if (!st) return done('bad');
      const obs = new MutationObserver(() => { if (st.className === 'good' || st.className === 'bad') { obs.disconnect(); clearTimeout(t); done(st.className); } });
      const t = setTimeout(() => { obs.disconnect(); done('bad'); }, 20000);
      obs.observe(st, { attributes: true, childList: true, characterData: true, subtree: true });
    });
  }

  /* auto: tried by itself on the way back from AI Studio. Anything that doesn't work out
     (no permission, no key on the clipboard) quietly leaves the pulsing button to tap. */
  /* The quick prompt on screen can rebuild the full way now that the key works. */
  function offerFull() {
    const box = document.getElementById('thoughts');
    if (!ui.quickResult || !box || !box.value.trim()) return;
    const end = Date.now() + FULL_MS;
    full = { left: Math.ceil(FULL_MS / 1000), pct: 100 };
    clearInterval(fullTick);
    const stop = () => cancelFull();
    box.addEventListener('input', stop, { once: true });
    window.addEventListener('stp-build-start', stop, { once: true });
    fullTick = setInterval(() => {
      const ms = end - Date.now();
      if (ms <= 0) return goFull();
      full = { left: Math.ceil(ms / 1000), pct: Math.round((100 * ms) / FULL_MS) };
    }, 200);
  }
  function cancelFull() { clearInterval(fullTick); full = null; }
  function goFull() {
    if (!full) return;
    cancelFull();
    window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'fullbuild', where: 'form' } }));
  }

  async function pasteKey(auto = false) {
    if (busy) return;
    const box = document.getElementById('gkey');
    let text = '';
    if (auto && !(navigator.clipboard && navigator.clipboard.readText)) return;
    try { text = (await navigator.clipboard.readText()) || ''; }
    catch (e) {
      if (auto) return say('Welcome back! Tap Paste my key. On iPhone, tap the Paste bubble that pops up too, that part is Apple\'s rule.');
      pulse = false;
      box?.focus();
      return say('Your browser kept the clipboard closed. Long-press the key box below and tap Paste, then Check key.', 'bad');
    }
    const raw = text.trim();
    const key = (raw.match(KEY_RE) || [])[0] || (LOOSE_RE.test(raw) ? raw : '');
    if (auto && !key) return;   /* clipboard isn't a key yet: leave the button pulsing, say nothing */
    pulse = false;
    if (!key) {
      return say(raw ? "That doesn't look like a Gemini key (they start with AIza). In AI Studio, tap the copy button next to your key, then come back." : 'Your clipboard is empty. Copy your key in AI Studio first, then tap Paste my key.', 'bad');
    }
    box.value = key;
    box.dispatchEvent(new Event('input', { bubbles: true }));   // app.js resets status and updates ui.hasKey
    busy = true;
    say('Got it. Checking with Google...');
    const waiting = awaitCheck();
    document.getElementById('checkKey')?.click();
    const res = await waiting;
    busy = false;
    if (res === 'good') {
      hunting = false;
      const keep = document.getElementById('remember');
      say('🎉 You\'re in! Your next prompt asks a few quick questions first.' + (keep && !keep.checked ? ' Tick Remember my key (glowing below) so you never paste it again.' : ''), 'good');
      haloRemember();
      offerFull();
    } else {
      say('Google didn\'t accept that one. The message below says why.', 'bad');
    }
  }
</script>

{#if !ui.hasKey || busy}
  <div class="catcher" id="keyCatcher">
    <a class="step" id="getKey" href={STUDIO} target="_blank" rel="noopener" onclick={getKey}>
      <span class="n">1</span><span><b>Get my free key</b><small>Opens Google AI Studio. Sign in, tap Create API key, copy it.</small></span>
    </a>
    <button type="button" class="step paste" class:pulse id="pasteKey" onclick={() => pasteKey(false)} disabled={busy}>
      <span class="n">2</span><span><b>📋 Paste my key</b><small>Come back here and tap. We check it for you.</small></span>
    </button>
  </div>
{/if}
{#if note}<p class="catchnote {kind}" id="catchNote" role="status">{note}</p>{/if}
{#if full}
  <div class="fullcard" id="fullOffer" role="group" aria-label="Rebuild the full version">
    <p><b>Your prompt rebuilds the full way in {full.left}s.</b> Gemini asks a few quick questions first, so it fits you.</p>
    <div class="fullbar" aria-hidden="true"><i style="width: {full.pct}%"></i></div>
    <div class="fullrow">
      <button type="button" class="primary" id="fullGo" onclick={goFull}>Build it now</button>
      <button type="button" id="fullLater" onclick={cancelFull}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .catcher { display: grid; gap: 8px; margin: 4px 0 10px; }
  .step { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 14px; border-radius: var(--r-md);
    text-align: left; text-decoration: none; color: var(--ink); background: var(--surface); border: 1.5px solid var(--line); font: inherit; }
  .step b { display: block; font-size: 16px; }
  .step small { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
  .n { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; font-weight: 700;
    color: var(--accent-ink); background: var(--accent); }
  .paste { border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: var(--accent-soft); }
  .paste b { color: var(--accent); }
  .step:active { transform: scale(0.98); }
  .step:disabled { opacity: 0.6; }
  .pulse { animation: catchpulse 1.2s ease-in-out 3; }
  @keyframes catchpulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 35%, transparent); } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; outline: 2px solid var(--accent); } }
  .catchnote { margin: 0 0 10px; font-size: 14px; color: var(--muted); }
  .fullcard { margin: 0 0 12px; padding: 12px 14px; border-radius: var(--r-md); background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
  .fullcard p { margin: 0 0 8px; font-size: 15px; line-height: 1.4; color: var(--ink); }
  .fullbar { height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 18%, transparent); overflow: hidden; margin-bottom: 10px; }
  .fullbar i { display: block; height: 100%; background: var(--accent); transition: width 0.2s linear; }
  .fullrow { display: flex; gap: 8px; }
  .fullrow button { flex: 1 1 0; min-height: 44px; }
  @media (prefers-reduced-motion: reduce) { .fullbar i { transition: none; } }
  .catchnote.good { color: var(--ink); font-weight: 600; }
  .catchnote.bad { color: var(--ink); }
</style>
