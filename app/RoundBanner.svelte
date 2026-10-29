<script>
  /* Rework rounds: a small banner over the box while you edit a new round (place "form"),
     and on the prompt card once 2 or more rounds are built (place "result"). On the card
     it's a Round 1 / 2 / 3 switcher with each round's score, plus Compare rounds, a spec
     table of where each round is stronger. Up to 3 rounds, all kept in memory (never
     saved) until you start a new prompt. It stays put while you type, unlike a notice. */
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { ui } from './lib/ui.svelte.js';
  import CompareRounds from './CompareRounds.svelte';
  let { place } = $props();
  let open = $state(false);
  const r = $derived(ui.round);
  const show = $derived(!!r && (place === 'form' ? r.stage === 'edit' : r.stage === 'built' && (r.count || 0) >= 2));
  const count = $derived(r ? r.count || 0 : 0);
  const viewing = $derived(r ? r.viewing || count : 0);
  /* The round on screen reads its live Quality check; the others use their saved score. */
  const scores = $derived(Array.from({ length: count }, (_, i) => (i + 1 === viewing ? (ui.grade ? ui.grade.score : null) : r && r.scores ? r.scores[i] : null)));
  const trail = $derived(scores.every((s) => s != null) ? scores.map((s) => s.toFixed(1)).join(' → ') : '');
  const atMax = $derived(!!r && count >= (r.max || 3));
  const fmt = (n) => (n == null ? '' : n.toFixed(1));
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: place } }));
  $effect(() => { if (!show) open = false; });
</script>

{#if show}
  <div class="round" id={place === 'form' ? 'roundForm' : 'roundResult'} transition:slide={{ duration: ms(200) }}>
    {#if place === 'form'}
      <p class="head"><b>🔁 Round {r.n}</b></p>
      <p class="say">Your prompt is in the box with what was weak on top. Change anything, then tap Build my prompt. Your first thoughts and answers are kept for it.</p>
      <button type="button" class="link back" id="roundBackForm" onclick={() => act('roundback')}>← Back to round {r.from}</button>
    {:else}
      <p class="head"><b>🔁 Round {viewing}</b>{#if trail}<span class="scores">Quality check {trail}</span>{/if}</p>
      <div class="pick" role="group" aria-label="Pick a round" style="--n: {count}">
        {#each scores as s, i (i)}
          <button type="button" id={'round' + (i + 1) + 'Result'} aria-pressed={viewing === i + 1} onclick={() => act('round' + (i + 1))}>
            Round {i + 1}{#if s != null}<small>{fmt(s)}</small>{/if}
          </button>
        {/each}
      </div>
      <p class="say">
        {#if viewing > 1}Built from your edits plus your first thoughts and answers. Save to Notes keeps your original words with this prompt.{:else}Your first prompt.{/if}
        All {count} rounds stay until you start a new prompt.
        {#if atMax}<b>{count} rounds is the max.</b> Pick your favorite, or start a new prompt with more detail.{:else}Under the bar? Rework builds round {count + 1} from the round you're looking at.{/if}
      </p>
      <button type="button" class="cmpbtn" id="compareBtn" aria-expanded={open} aria-controls="compareRounds" onclick={() => (open = !open)}>
        {open ? 'Hide comparison' : '⚖️ Compare rounds'}
      </button>
      {#if open}
        <div transition:slide={{ duration: ms(200) }}><CompareRounds /></div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .round { display: grid; gap: var(--sp-2); padding: var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .round > * { min-width: 0; }
  .head { margin: 0; display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: baseline; }
  .head b { font-family: var(--display); font-size: var(--fs-md); }
  .scores { font-size: var(--fs-sm); font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .say { margin: 0; font-size: var(--fs-sm); line-height: 1.45; }
  .back { justify-self: start; min-height: var(--tap); font-weight: 700; }
  .pick { display: grid; grid-template-columns: repeat(var(--n, 2), minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: var(--r-md); background: var(--bg); border: 1.5px solid var(--line); }
  .pick button { min-height: var(--tap); border: 0; border-radius: calc(var(--r-md) - 4px); background: transparent; color: inherit; font: inherit; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 4px 2px; min-width: 0; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
  .pick button small { font-size: var(--fs-sm); font-weight: 600; opacity: 0.8; font-variant-numeric: tabular-nums; }
  .pick button[aria-pressed='true'] { background: var(--accent); color: var(--surface); }
  .pick button:focus-visible, .cmpbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cmpbtn { justify-self: stretch; min-height: var(--tap); border-radius: var(--r-md); border: 1.5px solid var(--accent); background: var(--bg); color: var(--accent); font: inherit; font-weight: 700; cursor: pointer; }
</style>
