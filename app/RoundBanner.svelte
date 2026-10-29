<script>
  /* Rework round 2: a small banner over the box while you edit (place "form"), and on the
     prompt card once round 2 is built (place "result"). On the card it's a Round 1 / Round 2
     switcher: both rounds are kept (in memory only) until you start a new prompt, so you can
     flip back and forth and keep the one you like. It stays put while you type, unlike a
     notice. State is ui.round. */
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { ui } from './lib/ui.svelte.js';
  let { place } = $props();
  const r = $derived(ui.round);
  const show = $derived(!!r && (place === 'form' ? r.stage === 'edit' : r.stage === 'built'));
  const viewing = $derived(r && r.viewing === 1 ? 1 : 2);
  const s1 = $derived(r && r.before != null ? r.before : viewing === 1 && ui.grade ? ui.grade.score : null);
  const s2 = $derived(viewing === 2 ? (ui.grade ? ui.grade.score : null) : r ? r.after : null);
  const fmt = (n) => (n == null ? '' : n.toFixed(1));
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: place } }));
</script>

{#if show}
  <div class="round" id={place === 'form' ? 'roundForm' : 'roundResult'} transition:slide={{ duration: ms(200) }}>
    {#if place === 'form'}
      <p class="head"><b>🔁 Round 2</b></p>
      <p class="say">Your prompt is in the box with what was weak on top. Change anything, then tap Build my prompt. Your first thoughts and answers are kept for it.</p>
      <button type="button" class="link back" id="round1Form" onclick={() => act('round1')}>← Back to round 1</button>
    {:else}
      <p class="head"><b>🔁 Round {viewing}</b>{#if s1 != null && s2 != null}<span class="scores">Quality check {fmt(s1)} → {fmt(s2)}</span>{/if}</p>
      <div class="pick" role="group" aria-label="Pick a round">
        <button type="button" id="round1Result" aria-pressed={viewing === 1} onclick={() => act('round1')}>
          Round 1{#if s1 != null}<small>{fmt(s1)}</small>{/if}
        </button>
        <button type="button" id="round2Result" aria-pressed={viewing === 2} onclick={() => act('round2')}>
          Round 2{#if s2 != null}<small>{fmt(s2)}</small>{/if}
        </button>
      </div>
      {#if viewing === 2}
        <p class="say">Built from your edits plus your first thoughts and answers. Save to Notes keeps your original words with this new prompt. Round 1 is kept: tap it to compare.</p>
      {:else}
        <p class="say">Your first prompt. Round 2 is kept too: tap it to flip back. Both stay until you start a new prompt.</p>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .round { display: grid; gap: var(--sp-2); padding: var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .head { margin: 0; display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: baseline; }
  .head b { font-family: var(--display); font-size: var(--fs-md); }
  .scores { font-size: var(--fs-sm); font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .say { margin: 0; font-size: var(--fs-sm); line-height: 1.45; }
  .back { justify-self: start; min-height: var(--tap); font-weight: 700; }
  .pick { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: var(--r-md); background: var(--bg); border: 1.5px solid var(--line); }
  .pick button { min-height: var(--tap); border: 0; border-radius: calc(var(--r-md) - 4px); background: transparent; color: inherit; font: inherit; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer; transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
  .pick button { white-space: nowrap; }
  .pick button small { font-size: var(--fs-sm); font-weight: 600; opacity: 0.8; font-variant-numeric: tabular-nums; }
  .pick button[aria-pressed='true'] { background: var(--accent); color: var(--surface); }
  .pick button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
