<script>
  /* Switch to Quick (v2.1.34, Kevin's Test lab note 11/08): on a Normal build, a ⚡ Switch to
     Quick button sits under the timer from the moment Build is tapped, for anyone in a rush.
     Tapping it skips the questions for this build only (the saved Quick or Normal setting stays)
     and the quick version is written as soon as Read is back. The clock never restarts.
     On the questions, the same switch lives in the Next step dock as ⚡ Quick. */
  import { ui } from './lib/ui.svelte.js';
  const go = () => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'goquick', where: 'form' } }));
</script>

{#if ui.reading}
  {#if ui.goQuick}
    <p class="qs done" id="quickSwitched" role="status">⚡ Quick it is: no questions, writing right after Prep.</p>
  {:else}
    <button type="button" class="qs" id="quickSwitch" aria-label="Switch to Quick: skip the questions for this prompt" onclick={go}>⚡ Switch to Quick (no questions)</button>
  {/if}
{/if}

<style>
  .qs { display: block; width: 100%; margin: var(--sp-2, 8px) 0 0; min-height: 44px; padding: 8px 14px; border-radius: 999px; font-size: 15px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; text-align: center; }
  .qs.done { min-height: 0; font-weight: 600; font-size: var(--fs-xs, 13px); background: none; color: var(--muted); }
</style>
