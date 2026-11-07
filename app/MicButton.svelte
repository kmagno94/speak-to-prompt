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
       - Stop, fix a word, tap Talk it out again works (v2.1.28, Test lab report): each run owns its
         recognizer, so a stopped one that finishes late can't clobber the new one, write old words over
         your fix, or kick off a second recognizer. Stop tears it down right away (abort), since the
         words are already in the box live.
       - Typing in the box while it listens keeps your edit: new words add after it.
       - If the mic never actually comes on (no audio within a few seconds), it tries once with a fresh
         recognizer, then stops and says so instead of looking like it's recording.
     Nothing is saved: no audio, no transcript copy. Only the words box gets the text.
       - Safari's mic only hears once per page on iOS 27 (WebKit bug 321436, confirmed by the mic log 11/7:
         run 2 starts and turns the audio on, then never hears speech). So on an iPhone or iPad, a run after
         the first that hears no speech in a few seconds stops and hands off to the keyboard mic: a note says
         why and a Use my keyboard mic button puts the cursor at the end of the box. The page remembers, so
         later taps on Talk it out go straight to the keyboard instead of pretending to listen. A reload
         gives a fresh page. Test hook: window.__micDeafMs shortens the wait.
       - Websites can't start the keyboard's own mic (no iOS API for it), so the closest is one tap away:
         once this Safari version has gone deaf on this phone (saved as just the version number,
         stp-mic-deaf), every page after its first run turns the button into Keep talking, which opens the
         keyboard with the cursor at the end, so its 🎤 is the next tap. No 5 second wait, no auto restart
         into a deaf mic. If a later run on that version does hear speech, the flag clears itself, and a
         Safari update starts fresh (v2.1.28, Test lab report).
       - Mic log (dev tools only): every recognizer event with its run number and timing, for diagnosing
         iPhone problems like WebKit bug 321436 (on iOS 27, every dictation after the first in a page can be
         deaf). Event names, counts and error codes only, never your words. Memory only, gone on reload.
     Test hooks: window.__micRestartMs shortens the restart wait, window.__micWatchMs the no-audio wait. */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { fly } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { kb } from './lib/keyboard.svelte.js';
  import { core } from './lib/core.svelte.js';

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
  let said = '', skip = 0;         // this run's words so far, and how much of them is already part of base (after you type)
  let live = false, watchT = 0, retried = false;
  let deaf = $state(false), deafT = 0;   // Safari's mic stopped hearing on this page (iOS 27 bug): use the keyboard mic
  let ranOnce = $state(false);           // a run already happened on this page
  const DEAF_KEY = 'stp-mic-deaf';
  const safariVer = appleTouch ? ((ua.match(/Version\/([\d.]+)/) || [])[1] || '') : '';
  let knownDeaf = $state(false);
  try { knownDeaf = !!safariVer && localStorage.getItem(DEAF_KEY) === safariVer; } catch (e) {}
  /* Keyboard mode: this page's Safari mic is used up (seen now, or known for this Safari version). */
  const kbMode = $derived(deaf || (knownDeaf && ranOnce));
  const KEEP_NOTE = 'To keep going, tap Keep talking: it opens your keyboard, then tap its 🎤. Safari\'s mic only listens once per page on this iPhone right now (an Apple bug in iOS 27).';
  const DEAF_NOTE = 'Safari\'s mic only listens once per page on this iPhone right now (an Apple bug in iOS 27). Tap the 🎤 on your keyboard to keep talking. Your words go where the cursor is.';
  /* Mic log: never words. t0 is the first tap on this page, runN counts recognizers made. */
  let log = $state([]), t0 = 0, runN = 0, copied = $state(false);
  function mark(n, what) {
    if (!t0) t0 = Date.now();
    log.push('+' + ((Date.now() - t0) / 1000).toFixed(1) + 's  run ' + n + '  ' + what);
    if (log.length > 300) log.splice(0, log.length - 300);
  }
  const iosVer = (ua.match(/OS (\d+[_.]\d+(?:[_.]\d+)?) like Mac/) || [])[1];
  function logText() {
    return ['Speak to Prompt mic log', 'Device: ' + (iosVer ? 'iOS ' + iosVer.replace(/_/g, '.') : appleTouch ? 'Apple touch' : 'computer') + (homeScreen ? ', Home Screen app' : ', browser tab') + ', ' + (google ? "Google's" : "Apple's") + ' speech',
      'UA: ' + ua, '', ...log].join('\n');
  }
  async function copyLog() {
    try { await navigator.clipboard.writeText(logText()); copied = true; setTimeout(() => { copied = false; }, 1800); } catch (e) {}
  }   // the mic really came on (audio or words), the no-audio timer, one fresh try used
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

  /* Tear a recognizer down for good: its late events (a final result, onend) can't reach the page anymore. */
  function kill(r) {
    if (!r) return;
    mark(r.__n, 'torn down (abort)');
    r.onresult = r.onerror = r.onend = r.onaudiostart = null;
    try { (r.abort || r.stop).call(r); } catch (e) {}
  }

  /* No audio and no words a few seconds after the mic should be on: it's stuck (it says recording, nothing shows).
     Try once with a fresh recognizer; if that's stuck too, stop and say so. */
  function watch() {
    clearTimeout(watchT);
    watchT = setTimeout(() => {
      if (!on || live) return;
      if (!retried) { mark(runN, 'watch: no audio yet, fresh try'); retried = true; kill(rec); rec = null; run(); watch(); return; }
      mark(runN, 'watch: still no audio, gave up');
      stop();
      note = homeScreen
        ? 'The mic didn\'t come on. It works in Safari, not the Home Screen app yet. Open this page in Safari, or use the mic on your keyboard.'
        : 'The mic didn\'t come on. Tap Talk it out to try again, or use the mic on your keyboard.';
    }, window.__micWatchMs ?? 4000);
  }

  /* One recognizer run. Each run starts from what's in the box now, so a restart never loses words. */
  function run() {
    const b = box(); if (!b) return;
    const now = b.value;
    base = now && !/\s$/.test(now) ? now + ' ' : now;
    said = ''; skip = 0;
    heard = false; startedAt = Date.now();
    const r = new SR();
    rec = r;
    const n = r.__n = ++runN;
    mark(n, 'new recognizer, start() called' + (document.activeElement === b ? ' (box focused)' : '') + (document.hidden ? ' (page hidden)' : ''));
    /* Every event the browser sends, for the mic log. Names only. */
    for (const ev of ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch'])
      try { r.addEventListener(ev, () => mark(n, ev + (r === rec ? '' : ' (old)'))); } catch (e) {}
    let results = 0, spoke = false;
    try { r.addEventListener('speechstart', () => { spoke = true; if (n >= 2) healed(); }); } catch (e) {}
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onaudiostart = () => { if (r === rec) live = true; };
    r.onresult = (e) => {
      results++;
      if (results <= 3 || results % 10 === 0) mark(n, 'result #' + results + ' (' + e.results.length + ' parts' + (e.results.length && e.results[e.results.length - 1].isFinal ? ', final' : '') + ')' + (r === rec && on ? '' : ' ignored, old'));
      if (r !== rec || !on) return;   /* a recognizer we already stopped: ignore it */
      let all = '';
      for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript;
      said = all.replace(/^\s+/, '');
      const fresh = said.slice(skip).replace(/^\s+/, '');
      if (said) { heard = true; live = true; spoke = true; note = ''; if (n >= 2) healed(); }
      put(base + fresh);
    };
    r.onerror = (e) => {
      mark(n, 'error: ' + (e && e.error) + (e && e.message ? ' (' + String(e.message).slice(0, 80) + ')' : '') + (r === rec ? '' : ' (old)'));
      if (r !== rec) return;
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
    r.onend = () => {
      mark(n, 'end after ' + results + ' results' + (r === rec ? '' : ' (old)'));
      if (r !== rec) return;   /* an old recognizer ending late must not null the new one or start another */
      rec = null;
      if (!on) return;
      /* Ended fast with nothing heard, 3 times in a row: the browser won't listen, so stop instead of looping. */
      quickEnds = !heard && Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
      if (quickEnds >= 3) {
        stop();
        note = appleTouch ? 'Speech needs Siri turned on in Settings, or use the mic on your keyboard.' : 'The mic keeps stopping. Tap Talk it out to try again, or type instead.';
        return;
      }
      /* Known deaf Safari: a restart would never hear, so stop and point at Keep talking instead. */
      if (knownDeaf) { mark(n, 'ended on its own; known deaf Safari, no restart'); stop(); note = KEEP_NOTE; return; }
      restartT = setTimeout(() => { if (on && !rec) start(true); }, window.__micRestartMs ?? 250);
    };
    /* iOS 27: a run after the first can be deaf (audio on, never hears). No speech in a few seconds: hand off. */
    clearTimeout(deafT);
    if (appleTouch && !google && n >= 2) deafT = setTimeout(() => { if (r === rec && on && !spoke) gone(n); }, window.__micDeafMs ?? 4500);
    try { r.start(); }
    catch (e) { mark(n, 'start() threw: ' + (e && e.name)); if (rec === r) rec = null; stop(); note = 'The mic couldn\'t start. Tap Talk it out to try again.'; }
  }

  /* Safari's mic went deaf on this page: stop, explain, and offer the keyboard mic. */
  function gone(n) {
    mark(n, 'deaf: no speech heard, handing off to the keyboard mic');
    deaf = true;
    if (safariVer) { knownDeaf = true; try { localStorage.setItem(DEAF_KEY, safariVer); } catch (e) {} }
    stop();
    note = DEAF_NOTE;
  }
  /* A run after the first heard speech: this Safari isn't deaf after all (or Apple fixed it). */
  function healed() {
    if (!knownDeaf) return;
    knownDeaf = false;
    try { localStorage.removeItem(DEAF_KEY); } catch (e) {}
    mark(runN, 'heard on a later run: deaf flag cleared');
  }
  /* Put the cursor at the end of the box, so the keyboard (and its 🎤) comes up. Opens the keyboard only from a tap. */
  function keyboard() {
    const b = box(); if (!b) return;
    b.focus();
    try { b.setSelectionRange(b.value.length, b.value.length); } catch (e) {}
    b.scrollIntoView({ block: 'center', behavior: ms(1) ? 'smooth' : 'auto' });
  }

  function start(again) {
    if (!SR) return;
    if (kbMode && !again) { mark(runN, 'tap: Keep talking (Safari mic used up on this page, keyboard)'); deaf = true; note = DEAF_NOTE; keyboard(); return; }
    if (!again) ranOnce = true;
    mark(runN + 1, again ? 'auto restart' : 'tap: Talk it out');
    clearTimeout(restartT);
    kill(rec); rec = null;   /* never two recognizers at once */
    const b = box();
    if (!again) {
      note = ''; quickEnds = 0; secs = 0; live = false; retried = false;
      clearInterval(tickT); tickT = setInterval(() => { secs++; }, 1000);
      /* Close the keyboard (you're talking now), so you can watch your words fill in. */
      if (b && document.activeElement === b) b.blur();
    }
    on = true;
    if (b) b.dataset.listening = '1';   /* app.js keeps the idea strip away while listening */
    if (!again && b) { b.dispatchEvent(new Event('input', { bubbles: true })); b.scrollIntoView({ block: 'center', behavior: ms(1) ? 'smooth' : 'auto' }); }
    run();
    if (!again) watch();
  }

  function stop() {
    if (on) mark(runN, 'stop');
    on = false;
    clearTimeout(restartT); clearInterval(tickT); clearTimeout(watchT); clearTimeout(deafT);
    const b = box();
    if (b) { delete b.dataset.listening; b.dispatchEvent(new Event('input', { bubbles: true })); }
    const r = rec; rec = null;
    kill(r);
  }

  /* You typed in the box while it listens: keep your edit, and add new words after it. */
  function typed(e) {
    if (!on || !e.isTrusted) return;   /* our own put() sends untrusted input events */
    const b = box(); if (!b || e.target !== b) return;
    base = b.value && !/\s$/.test(b.value) ? b.value + ' ' : b.value;
    skip = said.length;
  }

  const toggle = () => { if (on) { stop(); if (knownDeaf) note = KEEP_NOTE; } else start(false); };
  const pillStop = () => { stop(); if (knownDeaf) note = KEEP_NOTE; };
  /* The input card has a transform (its entrance animation), which traps position: fixed inside
     the card. Moving the pill to <body> pins it to the screen for real. */
  function toBody(node) { document.body.appendChild(node); return { destroy() { node.remove(); } }; }

  onMount(() => {
    if (!SR) return;
    const form = document.getElementById('form');
    const off = () => { if (on) stop(); };
    const hide = () => { if (document.hidden) { if (on) mark(runN, 'page hidden'); off(); } };
    form && form.addEventListener('submit', off, true);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', off);
    document.addEventListener('input', typed, true);
    return () => {
      off();
      document.removeEventListener('input', typed, true);
      form && form.removeEventListener('submit', off, true);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', off);
    };
  });
</script>

{#if SR}
  <button type="button" class="mic" class:on id="micBtn" aria-pressed={on} onclick={toggle}>
    <span class="dot" aria-hidden="true"></span>
    <span>{on ? 'Stop listening' : kbMode ? 'Keep talking ⌨️' : 'Talk it out'}</span>
  </button>
  {#if on || note}
    <p class="micnote" class:warn={!!note} id="micNote" role="status" transition:slide={{ duration: ms(160) }}>
      {#if note}{note}{#if kbMode} <button type="button" class="kbbtn" id="micKeyboard" onclick={keyboard}>⌨️ Use my keyboard mic</button>{/if}{:else}Listening. Your words show up in the box as you talk. Tap the red Tap to stop button at the bottom when you're done. While the mic is on, your voice goes to {service} speech service; nothing is saved here.{/if}
    </p>
  {/if}
  {#if core.dev && log.length}
    <details class="miclog" id="micLog">
      <summary>🎙️ Mic log ({log.length})</summary>
      <button type="button" class="miclogcopy" id="micLogCopy" onclick={copyLog}>{copied ? 'Copied' : 'Copy mic log'}</button>
      <pre>{logText()}</pre>
    </details>
  {/if}
  {#if on}
    <button type="button" class="micstop" id="micStop" use:toBody style="bottom: calc({lift}px + 14px + env(safe-area-inset-bottom, 0px))" onclick={pillStop}
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
  .miclog { flex: 1 1 100%; font-size: 13px; }
  .miclog summary { cursor: pointer; color: var(--muted, var(--ink)); }
  .miclog pre { max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px; margin: 6px 0 0; }
  .miclogcopy { font: inherit; font-weight: 700; min-height: 40px; padding: 6px 14px; margin-top: 6px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  .kbbtn { display: inline-flex; align-items: center; min-height: 44px; margin-top: 8px; padding: 8px 16px; border-radius: 999px; font: inherit; font-weight: 700;
    color: var(--ink); background: var(--surface); border: 1px solid var(--line); cursor: pointer; }
  .kbbtn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .micnote { flex: 1 1 100%; margin: 0; font-size: 14px; color: var(--muted, var(--ink)); }
  .micnote.warn { color: var(--ink); background: var(--accent-soft); border-radius: 12px; padding: 8px 12px; }
</style>
