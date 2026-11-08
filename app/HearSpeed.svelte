<script>
  /* Hear it speed in More options (v2.1.36): 1x, 1.25x, 1.5x (default) or 2x. Applies the
     next time you tap 🔊 Hear it. Only shows where the browser can speak. */
  import { hear, RATES, setRate } from './lib/hear.svelte.js';
  const can = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const label = (r) => r + 'x';
</script>

{#if can}
  <div class="stats" id="hearSpeed">
    <p class="srchead">🔊 Hear it speed</p>
    <div class="seg" role="group" aria-label="Hear it speed">
      {#each RATES as r}
        <button type="button" id={'hearRate' + String(r).replace('.', '_')} aria-pressed={hear.rate === r} onclick={() => setRate(r)}>{label(r)}</button>
      {/each}
    </div>
    <p class="hint">How fast 🔊 Hear it reads your prompt. 1.5x is the default; Safari on iPhone runs a little fast, so try 1.25x if it's hard to follow.</p>
  </div>
{/if}

<style>
  .seg button { padding: 8px 14px; }
</style>
