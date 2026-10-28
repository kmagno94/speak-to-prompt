<script>
  /* Rework round 2: a small banner over the box while you edit (place "form"), and on the
     prompt card once round 2 is built (place "result"), each with Back to round 1.
     It stays put while you type, unlike a notice. State is ui.round (memory only). */
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { ui } from './lib/ui.svelte.js';
  let { place } = $props();
  const r = $derived(ui.round);
  const show = $derived(!!r && (place === 'form' ? r.stage === 'edit' : r.stage === 'built'));
  const after = $derived(place === 'result' && ui.grade ? ui.grade.score : null);
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: place } }));
</script>

{#if show}
  <div class="round" id={place === 'form' ? 'roundForm' : 'roundResult'} transition:slide={{ duration: ms(200) }}>
    <p class="head"><b>🔁 Round 2</b>{#if place === 'result' && r.before != null && after != null}<span class="scores">Quality check {r.before.toFixed(1)} → {after.toFixed(1)}</span>{/if}</p>
    {#if place === 'form'}
      <p class="say">Your prompt is in the box with what was weak on top. Change anything, then tap Build my prompt. Your first thoughts and answers are kept for it.</p>
    {:else}
      <p class="say">Built from your edits plus your first thoughts and answers. Save to Notes keeps your original words with this new prompt.</p>
    {/if}
    <button type="button" class="link back" id={place === 'form' ? 'round1Form' : 'round1Result'} onclick={() => act('round1')}>← Back to round 1</button>
  </div>
{/if}

<style>
  .round { display: grid; gap: var(--sp-1); padding: var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .head { margin: 0; display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: baseline; }
  .head b { font-family: var(--display); font-size: var(--fs-md); }
  .scores { font-size: var(--fs-sm); font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .say { margin: 0; font-size: var(--fs-sm); line-height: 1.45; }
  .back { justify-self: start; min-height: var(--tap); font-weight: 700; }
</style>
