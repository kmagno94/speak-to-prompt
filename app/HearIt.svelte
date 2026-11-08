<script>
  /* Hear it back (AGT-16, v2.1.33): 🔊 reads the prompt aloud with the phone's own voice
     (speechSynthesis), free and on the device. Tap again to stop. It also stops on a new
     prompt, when the page hides, or when you leave. Nothing is sent or saved.
     v2.1.34 (Test lab: no sound on iPhone): Safari on iOS drops a speak() that comes right
     after a cancel() in the same tap, can sit "paused" after the page was hidden, and can
     lose an utterance it no longer holds on to. So the tap now only cancels when something
     is actually playing, resumes first, sets the language (and an on-device English voice
     when the phone lists one), keeps every piece referenced, and speaks the first piece
     inside the tap, then each next piece when the one before ends. If the phone never
     starts talking within 3 seconds, the button resets and a line says what to check.
     While it plays, a small line reminds that Silent mode mutes it on iPhone. */
  import { onMount, untrack } from 'svelte';
  import { xray } from './lib/xray.svelte.js';

  const can = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  const START_MS = (typeof window !== 'undefined' && window.__hearStartMs) || 3000;   /* tests can shorten it */
  let speaking = $state(false);
  let note = $state('');      // '' | 'tip' (while playing) | 'stuck' (never started)
  let run = 0, held = [], startT = 0;

  /* Short pieces, one after another: some browsers cut a long utterance off partway. */
  function chunks(text) {
    const out = [];
    for (const part of String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?:])\s+/)) {
      const t = part.trim();
      if (!t) continue;
      if (out.length && (out[out.length - 1] + ' ' + t).length <= 220) out[out.length - 1] += ' ' + t;
      else out.push(t);
    }
    return out;
  }

  function busyNow() {
    try { return !!(speechSynthesis.speaking || speechSynthesis.pending); } catch (e) { return false; }
  }

  /* An on-device English voice when the phone lists one; otherwise the default (lang still set). */
  function voice() {
    try {
      const all = typeof speechSynthesis.getVoices === 'function' ? speechSynthesis.getVoices() || [] : [];
      const want = (navigator.language || 'en-US').toLowerCase();
      return all.find((v) => v.lang && v.lang.toLowerCase() === want && v.localService)
        || all.find((v) => v.lang && /^en/i.test(v.lang) && v.localService) || null;
    } catch (e) { return null; }
  }

  function stop(keepNote) {
    run++;
    clearTimeout(startT);
    /* Only cancel when something is playing: a cancel right before a speak makes iOS drop it. */
    if (can && (speaking || busyNow())) { try { speechSynthesis.cancel(); } catch (e) {} }
    held = [];
    speaking = false;
    if (!keepNote) note = '';
  }

  function play() {
    const out = document.getElementById('output');
    const parts = chunks(out ? out.value : xray.prompt);
    if (!parts.length) return;
    if (speaking || busyNow()) stop(true);
    const mine = ++run;
    const v = voice();
    const lang = (v && v.lang) || navigator.language || 'en-US';
    let started = false;
    held = parts.map((t) => {
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 0.95; u.lang = lang;
      if (v) u.voice = v;
      return u;
    });
    held.forEach((u, i) => {
      u.onstart = () => { if (run !== mine) return; started = true; clearTimeout(startT); };
      u.onend = () => {
        if (run !== mine) return;
        const next = held[i + 1];
        if (next) { try { speechSynthesis.speak(next); } catch (e) { speaking = false; } }
        else { speaking = false; note = ''; }
      };
      u.onerror = (e) => {
        if (run !== mine) return;
        /* An interrupt from our own Stop is not an error worth showing. */
        if (e && /interrupt|cancel/i.test(e.error || '')) return;
        speaking = false; note = started ? '' : 'stuck';
      };
    });
    speaking = true;
    note = 'tip';
    try { if (typeof speechSynthesis.resume === 'function') speechSynthesis.resume(); } catch (e) {}
    /* The first piece is spoken inside the tap (iOS needs that); the rest follow on onend. */
    try { speechSynthesis.speak(held[0]); } catch (e) { speaking = false; note = 'stuck'; return; }
    startT = setTimeout(() => {
      if (run !== mine || started) return;
      /* Some browsers never fire onstart but are talking; only give up when nothing is playing. */
      if (busyNow() && speechSynthesis.speaking) return;
      stop(true); note = 'stuck';
    }, START_MS);
  }

  function toggle() { speaking ? stop() : play(); }

  /* A new prompt (or Start over) stops the old one. */
  /* untrack: stop() reads speaking, which must not make this effect rerun (and stop) on every play. */
  $effect(() => { xray.run; untrack(() => stop()); });
  onMount(() => {
    /* Voices load late on some phones; asking once early fills the list for the first tap. */
    try { if (can && typeof speechSynthesis.getVoices === 'function') speechSynthesis.getVoices(); } catch (e) {}
    const hide = () => { if (document.hidden) stop(); };
    const leave = () => stop();
    document.addEventListener('visibilitychange', hide);
    addEventListener('pagehide', leave);
    return () => { document.removeEventListener('visibilitychange', hide); removeEventListener('pagehide', leave); stop(); };
  });
</script>

{#if can}
  <button type="button" id="hearBtn" class="hear" class:on={speaking} aria-pressed={speaking}
          aria-label={speaking ? 'Stop reading the prompt' : 'Read the prompt out loud'} onclick={toggle}>
    {speaking ? '⏹ Stop' : '🔊 Hear it'}
  </button>
  {#if note}
    <span class="hearnote" id="hearNote" role="status">
      {note === 'stuck' ? "Your phone didn't start reading. Turn off Silent mode, turn the volume up, then tap Hear it again." : 'No sound? Silent mode mutes it on iPhone.'}
    </span>
  {/if}
{/if}

<style>
  .hear { margin-right: 6px; min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
  .hear.on { color: var(--accent-ink); background: var(--accent); }
  .hearnote { display: block; order: 99; flex-basis: 100%; text-align: right; margin-top: 4px; font-size: var(--fs-xs, 12px); color: var(--muted); }
</style>
