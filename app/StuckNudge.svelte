<script>
  /* Writer's block nudge: after the box sits still for a few seconds with some words in
     it, one sentence to finish shows up. Tap it to start that line, 🎲 for another.
     Typing hides it right away, and it comes back after the next quiet stretch. No ✕ on
     purpose: a stray tap shouldn't switch off the help (Test lab, v2.1.6).
     State lives in lib/stuck.svelte.js, shared with the keyboard coach bar, which shows it
     instead while you type (this spot is under the keyboard then). */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { stuck } from './lib/stuck.svelte.js';
  import { kb } from './lib/keyboard.svelte.js';
  import { ms } from './lib/motion.js';

  onMount(() => stuck.attach(document.getElementById('thoughts'), document.getElementById('form')));
</script>

{#if stuck.show && stuck.line}
  <div class="stuck" id="stuck" class:kbaway={kb.open && kb.typing} role="group" aria-label="Stuck? Finish this sentence" transition:slide={{ duration: ms(200) }}>
    <span class="lbl">✍️ Stuck? Finish this:</span>
    <button type="button" class="line" id="stuckLine" onclick={() => stuck.use()}>{stuck.line.text.trim()} …</button>
    <button type="button" class="mini" id="stuckNext" onclick={() => stuck.another()} aria-label="Another sentence">🎲</button>
  </div>
{/if}

<style>
  .stuck { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
  .stuck.kbaway { visibility: hidden; }   /* the keyboard bar has it while you type */
  .lbl { font-size: 14px; font-weight: 600; color: var(--muted); width: 100%; }
  .line { flex: 1 1 auto; min-height: 44px; padding: 8px 14px; border-radius: 999px; font-size: 15px; text-align: left;
    color: var(--accent); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .mini { min-height: 44px; min-width: 44px; padding: 0; border-radius: 999px; font-size: 16px; color: var(--muted); background: transparent; border: 1px solid var(--line); }
  .line:active, .mini:active { transform: scale(0.97); }
</style>
