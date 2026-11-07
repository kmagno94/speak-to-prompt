<script>
  /* Talk it out (AGT-2, v2.1.26 as Talk here; v2.1.27 took over the Talk it out name and red record dot): the browser's own speech-to-text (Web Speech API,
     SpeechRecognition or webkitSpeechRecognition), not Gemini audio, so no key and no quota.
       - Shows only where the browser has it (Safari on iPhone and Mac, Chrome). Others never see it.
       - Tap to start, tap to stop. Words land live in the box and add to what's already there.
       - If the browser stops listening on its own while the button is on, it quietly restarts.
       - Stops on Build, when the page is hidden, or when you tap it again.
       - While listening, a red Stop pill floats at the bottom of the screen (above the keyboard
         and the coach bar) with a running timer, so stopping is always one obvious tap even
         after the box grows and the top button scrolls away (v2.1.28, Test lab report).
     Nothing is saved: no audio, no transcript copy. Only the words box gets the text.
     Test hook: window.__micRestartMs shortens the restart wait. */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { fly } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { kb } from './lib/keyboard.svelte.js';

  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  /* Chrome and Edge on a computer or Android send speech to Google; anything on an iPhone/iPad (all WebKit) and Mac Safari use Apple's. */
  const google = !appleTouch && /Chrome\/|Edg\//.test(ua);
  const homeScreen = typeof window !== 'undefined' && ((window.navigator && window.navigator.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));

  let on = $state(false);        // the button is on (listening, or about to restart)
  let note = $state('');         // a problem to show under the button
  let secs = $state(0);          // how long the mic has been on, for the Stop pill
  let rec = null, base = '', heard = false, quickEnds = 0, startedAt = 0, restartT = 0, tickT = 0;
  const clock = $derived(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
  /* The pill sits on the keyboard, or above the keyboard coach bar when that's up. */
  /* ...and above the Next step dock (its Build my prompt bar) when that's showing, so neither covers the other. */
  let dockLift = $state(0);
  $effect(() => {
    if (!on) { dockLift = 0; return; }
    let raf = 0;
    const look = () => {
      const d = document.getElementById('nextDock');
      /* Its resting spot (height plus its 16px gap and the home bar), not its sliding edge, so the pill never wobbles. */
      const h = d && !d.classList.contains('away') && getComputedStyle(d).display !== 'none' && d.offsetHeight
        ? d.offsetHeight + (parseFloat(getComputedStyle(d).bottom) || 0) - 14 + 8 : 0;
      if (h !== dockLift) dockLift = h;
      raf = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(raf);
  });
  const lift = $derived(Math.max(kb.open ? kb.inset + 64 : 0, dockLift));
  /* The floating 💡 / 🧪 buttons tuck away while the pill is up, so they never cover it. */
  $effect(() => {
    document.body.classList.toggle('fabs-away-mic', on);
    return () => document.body.classList.remove('fabs-away-mic');
  });

  const box = () => document.getElementById('thoughts');
  const service = google ? "Google's" : "Apple's";

  function put(text) {
    const b = box(); if (!b) return;
    b.value = text;
    b.dispatchEvent(new Event('input', { bubbles: true }));   /* the rest of the page reacts like typing */
    b.scrollTop = b.scrollHeight;
  }

  /* One recognizer run. Each run starts from what's in the box now, so a restart never loses words. */
  function run() {
    const b = box(); if (!b) return;
    const now = b.value;
    base = now && !/\s$/.test(now) ? now + ' ' : now;
    heard = false; startedAt = Date.now();
    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (e) => {
      let said = '';
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      said = said.replace(/^\s+/, '');
      if (said) { heard = true; note = ''; }
      put(base + said);
    };
    rec.onerror = (e) => {
      const err = e && e.error;
      if (err === 'no-speech' || err === 'aborted') return;   /* quiet room or our own stop: onend handles it */
      stop();
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        note = homeScreen
          ? 'The mic works in Safari, not the Home Screen app yet. Open this page in Safari, or use the mic on your keyboard.'
          : appleTouch
            ? 'Speech needs Siri turned on in Settings, or use the mic on your keyboard.'
            : 'The mic is blocked for this page. Allow it in your browser\'s site settings, or type instead.';
      } else if (err === 'audio-capture') note = 'No microphone found. Check that one is connected, or type instead.';
      else if (err === 'network') note = 'The speech service couldn\'t be reached. Try again, or use the mic on your keyboard.';
      else note = 'The mic stopped (' + (err || 'unknown') + '). Tap Talk it out to try again.';
    };
    rec.onend = () => {
      rec = null;
      if (!on) return;
      /* Ended fast with nothing heard, 3 times in a row: the browser won't listen, so stop instead of looping. */
      quickEnds = !heard && Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
      if (quickEnds >= 3) {
        stop();
        note = appleTouch ? 'Speech needs Siri turned on in Settings, or use the mic on your keyboard.' : 'The mic keeps stopping. Tap Talk it out to try again, or type instead.';
        return;
      }
      restartT = setTimeout(() => { if (on) start(true); }, window.__micRestartMs ?? 250);
    };
    try { rec.start(); }
    catch (e) { rec = null; stop(); note = 'The mic couldn\'t start. Tap Talk it out to try again.'; }
  }

  function start(again) {
    if (!SR) return;
    if (!again) { note = ''; quickEnds = 0; secs = 0; clearInterval(tickT); tickT = setInterval(() => { secs++; }, 1000); }
    on = true;
    const b = box();
    if (b) b.dataset.listening = '1';   /* app.js keeps the idea strip away while listening */
    if (!again && b) { b.dispatchEvent(new Event('input', { bubbles: true })); b.scrollIntoView({ block: 'center', behavior: ms(1) ? 'smooth' : 'auto' }); }
    run();
  }

  function stop() {
    on = false;
    clearTimeout(restartT); clearInterval(tickT);
    const b = box();
    if (b) { delete b.dataset.listening; b.dispatchEvent(new Event('input', { bubbles: true })); }
    if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) {} }
  }

  const toggle = () => (on ? stop() : start(false));
  /* The input card has a transform (its entrance animation), which traps position: fixed inside
     the card. Moving the pill to <body> pins it to the screen for real. */
  function toBody(node) { document.body.appendChild(node); return { destroy() { node.remove(); } }; }

  onMount(() => {
    if (!SR) return;
    const form = document.getElementById('form');
    const off = () => { if (on) stop(); };
    const hide = () => { if (document.hidden) off(); };
    form && form.addEventListener('submit', off, true);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', off);
    return () => {
      off();
      form && form.removeEventListener('submit', off, true);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', off);
    };
  });
</script>

{#if SR}
  <button type="button" class="mic" class:on id="micBtn" aria-pressed={on} onclick={toggle}>
    <span class="dot" aria-hidden="true"></span>
    <span>{on ? 'Stop listening' : 'Talk it out'}</span>
  </button>
  {#if on || note}
    <p class="micnote" class:warn={!!note} id="micNote" role="status" transition:slide={{ duration: ms(160) }}>
      {#if note}{note}{:else}Listening. Your words show up in the box as you talk. Tap the red Tap to stop button at the bottom when you're done. While the mic is on, your voice goes to {service} speech service; nothing is saved here.{/if}
    </p>
  {/if}
  {#if on}
    <button type="button" class="micstop" id="micStop" use:toBody style="bottom: calc({lift}px + 14px + env(safe-area-inset-bottom, 0px))" onclick={stop}
      aria-label="Stop listening, {clock}" transition:fly={{ y: 24, duration: ms(180) }}>
      <span class="sq" aria-hidden="true"></span>
      <span>Tap to stop</span>
      <span class="time" aria-hidden="true">{clock}</span>
    </button>
  {/if}
{/if}

<style>
  .mic { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 11px 20px 11px 12px; border-radius: 999px;
    font: inherit; font-weight: 700; color: var(--ink); background: var(--surface); border: 1px solid var(--line); cursor: pointer;
    box-shadow: 0 1px 0 var(--line), 0 8px 20px -16px rgba(20, 40, 70, 0.5); transition: transform var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease); }
  .mic:active { transform: scale(0.97); }
  .mic:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .dot { width: 24px; height: 24px; border-radius: 50%; background: var(--record); box-shadow: 0 0 0 4px color-mix(in srgb, var(--record) 18%, transparent); position: relative; }
  .dot::after { content: ""; position: absolute; left: 9px; top: 5px; width: 6px; height: 10px; border-radius: 3px; background: var(--surface); }
  .mic.on { background: color-mix(in srgb, var(--record) 12%, var(--surface)); border-color: color-mix(in srgb, var(--record) 45%, var(--line)); }
  .mic.on .dot { background: var(--record); animation: breathe 1.4s ease-in-out infinite; }
  .mic.on .dot::after { left: 7px; top: 7px; width: 10px; height: 10px; border-radius: 2px; }
  @keyframes breathe { 50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--record) 10%, transparent); } }
  @media (prefers-reduced-motion: reduce) { .mic.on .dot { animation: none; box-shadow: 0 0 0 6px color-mix(in srgb, var(--record) 25%, transparent); } }
  /* The floating Stop pill: red, centered, always on screen while the mic is on. */
  .micstop { position: fixed; left: 50%; translate: -50% 0; z-index: 37; display: inline-flex; align-items: center; gap: 10px;
    min-height: 52px; padding: 12px 20px 12px 14px; border-radius: 999px; border: 0; cursor: pointer;
    font: inherit; font-weight: 800; color: #fff; background: var(--record);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--record) 22%, transparent), 0 14px 30px -12px rgba(10, 20, 40, 0.6); }
  .micstop:active { scale: 0.97; }
  .micstop:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .micstop > span { white-space: nowrap; }
  .micstop .sq { width: 14px; height: 14px; border-radius: 3px; background: #fff; }
  .micstop .time { font-variant-numeric: tabular-nums; font-weight: 600; opacity: 0.9; padding-left: 10px; border-left: 1px solid rgba(255, 255, 255, 0.45); }
  @media (prefers-reduced-motion: no-preference) { .micstop { animation: stopglow 1.8s ease-in-out infinite; } }
  @keyframes stopglow { 50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--record) 12%, transparent), 0 14px 30px -12px rgba(10, 20, 40, 0.6); } }
  .micnote { flex: 1 1 100%; margin: 0; font-size: 14px; color: var(--muted, var(--ink)); }
  .micnote.warn { color: var(--ink); background: var(--accent-soft); border-radius: 12px; padding: 8px 12px; }
</style>
