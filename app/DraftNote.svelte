<script>
  /* The note under the box when a draft came back after a reload (v2.1.28, lib/draft.svelte.js).
     Goes away as soon as you type, Build, or tap Start fresh. After a build it says the words are from your last build. */
  import { slide } from 'svelte/transition';
  import { draft, startFresh } from './lib/draft.svelte.js';
  import { ms } from './lib/motion.js';
</script>

{#if draft.restored}
  <p class="draftnote" id="draftNote" role="status" transition:slide={{ duration: ms(180) }}>
    <span>{#if draft.built}↩️ Your words from your last build are back (the prompt isn't kept). Change anything and build again. Kept in this tab only, for 30 minutes.{:else}↩️ Your words are back from before the page reloaded. Kept in this tab only, for 30 minutes.{/if}</span>
    <button type="button" id="draftFresh" onclick={startFresh}>Start fresh</button>
  </p>
{/if}

<style>
  .draftnote { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0 0; padding: 8px 12px; border-radius: 12px;
    font-size: 14px; color: var(--ink); background: var(--accent-soft); }
  .draftnote span { flex: 1 1 200px; }
  .draftnote button { flex: none; min-height: 36px; padding: 4px 14px; border-radius: 999px; font: inherit; font-weight: 700; font-size: 14px;
    color: var(--accent); background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); cursor: pointer; }
</style>
