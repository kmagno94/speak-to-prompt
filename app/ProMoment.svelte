<script>
  /* Your first pro prompt (AGT-17, v2.1.33): the first time a note hits all 5 Prompt strength
     parts, or a prompt scores a full 5 of 5 on the Quality check, a soft confetti burst and a
     small badge show once, then fade after a few seconds so the result stays calm.
     Reduce Motion gets a still glow instead of confetti. Only a yes/no flag is saved
     (stp-pro), never anything typed. */
  import { fade } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { ui } from './lib/ui.svelte.js';
  import { assess } from './lib/coach.js';
  import { ms, reduceMotion } from './lib/motion.js';

  const KEY = 'stp-pro';
  const SHOW_MS = (typeof window !== 'undefined' && window.__proMs) || 6000;   /* tests can shorten it */
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } }

  let done = seen();
  let why = $state('');     // '' = hidden, 'note' or 'grade'
  let timer = 0;

  const reason = $derived.by(() => {
    if (!xray.prompt) return '';
    if (ui.grade && !ui.grade.working && ui.grade.score >= 5) return 'grade';
    return assess(xray.raw).score === 5 ? 'note' : '';
  });

  /* A new prompt clears a badge from before. */
  $effect(() => { xray.run; why = ''; clearTimeout(timer); });
  $effect(() => {
    if (done || !reason) return;
    done = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    why = reason;
    timer = setTimeout(() => { why = ''; }, SHOW_MS);
  });

  /* 18 pieces, fixed spread so it looks the same every time. */
  const BITS = Array.from({ length: 18 }, (_, i) => ({ x: Math.round(Math.cos(i * 2.4) * 140), y: -40 - (i * 37) % 90, r: (i * 47) % 360, c: i % 3, d: (i % 6) * 40 }));
</script>

{#if why}
  <div class="pro" class:still={reduceMotion} id="proMoment" role="status" out:fade={{ duration: ms(400) }}>
    {#if !reduceMotion}
      <div class="burst" aria-hidden="true">
        {#each BITS as b}<i class="c{b.c}" style="--x: {b.x}px; --y: {b.y}px; --r: {b.r}deg; animation-delay: {b.d}ms"></i>{/each}
      </div>
    {/if}
    <b><span aria-hidden="true">🏆</span> Your first pro prompt</b>
    <span class="sub">{why === 'grade' ? 'A perfect 5 out of 5 on the Quality check.' : 'Your note had all 5 things great prompts have.'}</span>
  </div>
{/if}

<style>
  .pro { position: relative; display: grid; gap: 2px; justify-items: center; text-align: center; margin: 0 0 var(--sp-3); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); color: var(--ink); }
  .pro b { font-family: var(--display); font-size: var(--fs-md); }
  .sub { font-size: var(--fs-xs); color: var(--muted); }
  .pro.still { box-shadow: 0 0 0 3px var(--accent), 0 0 18px 2px color-mix(in srgb, var(--accent) 45%, transparent); }
  .burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
  .burst i { position: absolute; width: 7px; height: 11px; border-radius: 2px; opacity: 0; animation: pop 1.2s var(--ease) forwards; }
  .burst .c0 { background: var(--accent); }
  .burst .c1 { background: var(--ok); }
  .burst .c2 { background: var(--warn); }
  @keyframes pop {
    0% { opacity: 1; transform: translate(0, 0) rotate(0); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 60px)) rotate(var(--r)); }
  }
</style>
