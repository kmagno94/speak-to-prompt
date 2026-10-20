<script>
  /* "Remember for next time?" under a finished prompt (memory on). Offers your
     answers and up to 2 lasting facts Gemini spotted. Nothing is saved until you
     tap one, and it's saved only on this phone. */
  import { slide } from 'svelte/transition';
  import { memory } from './lib/memory.svelte.js';
  import { ms } from './lib/motion.js';

  let saved = $state([]);
  $effect(() => { memory.suggestions; saved = []; });

  function keep(t) { if (memory.add(t)) saved = [...saved, t]; }
  function dismiss() { memory.suggestions = []; }
</script>

{#if memory.active && memory.suggestions.length}
  <div class="remember" id="memorySuggest" transition:slide={{ duration: ms(180) }}>
    <p class="head"><span aria-hidden="true">🧠</span> Remember for next time?</p>
    <p class="hint">Tap anything you're tired of explaining. It stays on this phone only.</p>
    <div class="chips">
      {#each memory.suggestions as t (t)}
        {#if saved.includes(t)}
          <span class="done">✓ {t}</span>
        {:else}
          <button type="button" class="add" onclick={() => keep(t)}>+ {t}</button>
        {/if}
      {/each}
    </div>
    <button type="button" class="later" id="memoryDismiss" onclick={dismiss}>{saved.length ? 'Done' : 'Not now'}</button>
  </div>
{/if}

<style>
  .remember { display: grid; gap: 8px; padding: 12px 14px; margin-top: 10px; border-radius: 14px; border: 1.5px dashed var(--accent); background: color-mix(in srgb, var(--accent-soft) 55%, transparent); }
  .head { margin: 0; font-weight: 700; }
  .hint { margin: 0; font-size: 13px; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .add, .done { min-height: 0; padding: 7px 12px; border-radius: 999px; font-size: 14px; text-align: left; }
  .add { background: var(--surface); border: 1.5px solid var(--line); color: var(--ink); }
  .done { background: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .later { justify-self: start; min-height: 0; padding: 4px 2px; border: 0; background: none; color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; font-size: 14px; }
</style>
