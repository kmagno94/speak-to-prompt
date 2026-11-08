<script>
  /* Prompt school (AGT-4, v2.1.32): one "Move I made" card under the prompt, so each run
     teaches one small skill. Picked on the phone from X-ray's added-to-help parts
     (lib/moves.js). Memory only: nothing is saved or sent. Steps aside while X-ray is open. */
  import { slide } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { pickMove } from './lib/moves.js';
  import { ms } from './lib/motion.js';

  const move = $derived(xray.prompt ? pickMove(xray.prompt, xray.raw, xray.answers, xray.core, xray.known) : null);
</script>

{#if move && !xray.open}
  <aside class="move" id="moveCard" data-move={move.key} aria-label="Move I made" transition:slide={{ duration: ms(200) }}>
    <p class="mhead"><span aria-hidden="true">🎓</span> Move I made</p>
    <p class="mtitle">{move.title}</p>
    <p class="mwhy">Why: {move.why}</p>
    <blockquote class="mquote">{move.quote}</blockquote>
    {#if move.tip}
      <p class="mtip">Try it yourself next time: start a line with <b>"{move.tip} ..."</b></p>
    {/if}
  </aside>
{/if}

<style>
  .move { margin: var(--sp-3) 0 var(--sp-2); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--accent-soft); display: grid; gap: 6px; }
  .move p { margin: 0; }
  .mhead { font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.02em; color: var(--accent); }
  .mtitle { font-size: var(--fs-md); font-weight: 700; color: var(--ink); }
  .mwhy { font-size: var(--fs-sm); line-height: 1.4; color: var(--ink); }
  .mquote { margin: 2px 0 0; padding: 4px 0 4px 10px; border-left: 3px dashed var(--accent); font-size: var(--fs-xs); line-height: 1.4; color: var(--muted); }
  .mtip { font-size: var(--fs-xs); line-height: 1.4; color: var(--muted); }
</style>
