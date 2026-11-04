<script>
  /* One look for every empty, error, warning, and success message, so they all read the
     same: an icon and a plain title (never color alone), one line on what to do next,
     and up to two buttons. */
  import { fly } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  let { kind = 'info', title = '', text = '', actions = [], id = undefined, countdown = null, onact = () => {} } = $props();
  /* Optional live countdown { until, total, label, done }: m:ss ticks every second and the bar drains. */
  let now = $state(Date.now());
  $effect(() => {
    if (!countdown) return;
    now = Date.now();
    const t = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(t);
  });
  const left = $derived(countdown ? Math.max(0, countdown.until - now) : 0);
  const secs = $derived(Math.ceil(left / 1000));
  const clock = $derived(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
  const pct = $derived(countdown && countdown.total > 0 ? Math.min(100, (100 * left) / countdown.total) : 0);
  const ICON = { empty: '✎', error: '!', warn: '⏳', success: '✓', info: 'i' };
</script>

<div class="msgbox k-{kind}" {id} role={kind === 'error' ? 'alert' : 'status'} in:fly={{ y: 6, duration: ms(200) }}>
  <span class="mic" aria-hidden="true">{ICON[kind] || 'i'}</span>
  <div class="mbody">
    {#if title}<p class="mtitle">{title}</p>{/if}
    {#if countdown}
      <div class="mcount" data-countdown>
        <p class="mclockrow"><span class="mclock">{clock}</span> <span class="mclabel">{secs > 0 ? countdown.label || '' : countdown.done || ''}</span></p>
        <div class="mbar" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}><i style="width: {pct}%"></i></div>
      </div>
    {/if}
    {#if text}<p class="mtext">{text}</p>{/if}
    {#if actions.length}
      <div class="macts">
        {#each actions as a (a.label)}<button type="button" class:primary={a.primary} onclick={() => onact(a.act)}>{a.label}</button>{/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .msgbox { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--sp-3); align-items: start; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); }
  .mic { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 15px; background: var(--accent-soft); color: var(--accent); }
  .mbody { display: grid; gap: var(--sp-1); min-width: 0; }
  .mtitle { margin: 0; font-weight: 700; font-size: var(--fs-sm); }
  .mtext { margin: 0; font-size: var(--fs-sm); color: var(--muted); overflow-wrap: anywhere; }
  .mcount { display: grid; gap: var(--sp-1); margin: var(--sp-1) 0; }
  .mclockrow { margin: 0; display: flex; align-items: baseline; gap: var(--sp-2); flex-wrap: wrap; }
  .mclock { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--accent); line-height: 1.1; }
  .mclabel { font-size: var(--fs-sm); font-weight: 600; color: var(--ink); }
  .mbar { height: 6px; border-radius: var(--r-pill); background: var(--accent-soft); overflow: hidden; }
  .mbar i { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width 1s linear; }
  @media (prefers-reduced-motion: reduce) { .mbar i { transition: none; } }
  .macts { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-1); }
  .macts button { min-height: var(--tap); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sm); font-weight: 700; border-radius: var(--r-pill); }
  .macts button:active { transform: scale(0.97); }
  .k-error { border-color: color-mix(in srgb, var(--danger) 55%, transparent); background: color-mix(in srgb, var(--danger) 7%, var(--surface)); }
  .k-error .mic { background: var(--danger); color: var(--surface); }
  .k-warn { border-color: color-mix(in srgb, var(--warn) 55%, transparent); background: var(--warn-soft); }
  .k-warn .mic { background: var(--warn); color: var(--surface); }
  .k-warn .mtext { color: var(--ink); }
  .k-success { border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 9%, var(--surface)); }
  .k-success .mic { background: var(--ok); color: var(--surface); }
  .k-empty { border-style: dashed; }
</style>
