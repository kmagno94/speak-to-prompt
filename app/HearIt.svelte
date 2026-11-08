<script>
  /* Hear it back (AGT-16, v2.1.33): 🔊 reads the prompt aloud with the phone's own voice
     (speechSynthesis), free and on the device. Tap again to stop. It also stops on a new
     prompt, when the page hides, or when you leave. Nothing is sent or saved. */
  import { onMount } from 'svelte';
  import { xray } from './lib/xray.svelte.js';

  const can = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  let speaking = $state(false);
  let run = 0;

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

  function stop() {
    run++;
    if (can) { try { speechSynthesis.cancel(); } catch (e) {} }
    speaking = false;
  }

  function play() {
    const out = document.getElementById('output');
    const parts = chunks(out ? out.value : xray.prompt);
    if (!parts.length) return;
    stop();
    const mine = ++run;
    speaking = true;
    parts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 0.95;
      if (i === parts.length - 1) u.onend = () => { if (run === mine) speaking = false; };
      u.onerror = () => { if (run === mine) speaking = false; };
      speechSynthesis.speak(u);
    });
  }

  function toggle() { speaking ? stop() : play(); }

  /* A new prompt (or Start over) stops the old one. */
  $effect(() => { xray.run; stop(); });
  onMount(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', hide); removeEventListener('pagehide', stop); stop(); };
  });
</script>

{#if can}
  <button type="button" id="hearBtn" class="hear" class:on={speaking} aria-pressed={speaking}
          aria-label={speaking ? 'Stop reading the prompt' : 'Read the prompt out loud'} onclick={toggle}>
    {speaking ? '⏹ Stop' : '🔊 Hear it'}
  </button>
{/if}

<style>
  .hear { margin-right: 6px; min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
  .hear.on { color: var(--accent-ink); background: var(--accent); }
</style>
