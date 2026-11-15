<script>
  /* ⚡ Quick version (faster, lighter): one steady chip under the tracker from Build to Ready
     (#51, v2.1.37, SPEC LOCKED 11/08). It began as Switch to Quick in v2.1.34, which only
     showed while Read ran. Now it stays for the whole build, for anyone who gets impatient:
       - During Prep (place="build"): this build skips the questions and the quick version is
         written the moment Read is back.
       - During Write (place="result"): the Flash race stops and the quick model writes from
         your words and any answers so far.
       - At 2:00 the Taking longer than usual note shows, and its countdown lives on this chip
         (#41): at 0:00 the quick model takes over by itself.
       - Once the prompt is written and only the finishing checks are left, there is nothing
         left to speed up, so the chip turns into a quiet line.
     Never the main button: waiting for the full version stays the default. This build only,
     the saved Quick or Normal setting never changes. The clock never restarts.
     On the questions, the same switch lives in the Next step dock as ⚡ Quick version. */
  import { ui } from './lib/ui.svelte.js';
  let { place = 'build' } = $props();
  const go = () => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'goquick', where: place } }));

  const here = $derived(place === 'build' ? ui.reading : ui.build === 'write' || ui.build === 'finish');
  /* The countdown from 2:00 (ui.slow: { until, total }), ticking once a second. */
  let now = $state(Date.now());
  $effect(() => {
    if (!ui.slow) return;
    now = Date.now();
    const t = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(t);
  });
  const left = $derived(ui.slow ? Math.max(0, ui.slow.until - now) : 0);
  const secs = $derived(Math.ceil(left / 1000));
  const clock = $derived(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
  const pct = $derived(ui.slow && ui.slow.total > 0 ? Math.min(100, (100 * left) / ui.slow.total) : 0);
</script>

{#if here}
  {#if place === 'build'}
    {#if ui.goQuick}
      <p class="qs done" id="quickSwitched" role="status">⚡ Quick version it is: no questions, writing right after Prep.</p>
    {:else}
      <button type="button" class="qs" id="quickSwitch" aria-label="Quick version: faster and lighter, skips the questions for this prompt" onclick={go}>⚡ Quick version <small>(faster, lighter)</small></button>
    {/if}
  {:else if ui.switched}
    <p class="qs done" id="quickSwitchedWrite" role="status">⚡ Quick version it is: the quick model is writing it now.</p>
  {:else if ui.quickOn}
    <!-- Already the quick version (Quick mode): nothing to switch to. -->
  {:else if ui.build === 'finish'}
    <p class="qs done" id="quickPast" role="status">✍️ Written. Just the finishing checks left.</p>
  {:else}
    <button type="button" class="qs" class:slow={!!ui.slow} id="quickChip" aria-label="Quick version: faster and lighter, the quick model writes it now" onclick={go}>
      <span>⚡ Quick version <small>(faster, lighter)</small></span>
      {#if ui.slow}
        <span class="count" id="quickCount" data-countdown><b>{clock}</b> {secs > 0 ? 'until it takes over by itself' : 'Switching to quick...'}</span>
        <i class="bar" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}><i style="width: {pct}%"></i></i>
      {/if}
    </button>
  {/if}
{/if}

<style>
  .qs { display: grid; gap: 4px; justify-items: center; width: 100%; margin: var(--sp-2, 8px) 0 0; min-height: 44px; padding: 8px 14px; border-radius: 999px; font-size: 15px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; text-align: center; }
  .qs small { font-weight: 600; font-size: var(--fs-xs, 13px); }
  .qs.done { min-height: 0; font-weight: 600; font-size: var(--fs-xs, 13px); background: none; color: var(--muted); }
  .qs.slow { border-radius: var(--r-md, 14px); padding-bottom: 10px; }
  .count { font-size: var(--fs-xs, 13px); font-weight: 600; color: var(--ink); }
  .count b { font-size: 17px; font-variant-numeric: tabular-nums; color: var(--accent); }
  .bar { display: block; width: 100%; height: 5px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 18%, transparent); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width 1s linear; }
  @media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>
