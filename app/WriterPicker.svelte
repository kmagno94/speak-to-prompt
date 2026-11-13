<script>
  /* Write with (#53, dev tools only): who writes the full prompt, picked right by Build my prompt
     (Kevin, 11/12: "I'd like the option to choose when I hit build prompt but only with dev on").
     Flash is the default. A Shortcut choice hands the Flash write to the STP Flash Backup
     shortcut. Everyone else never sees this row and always gets Flash. */
  import { core } from './lib/core.svelte.js';
  import { ui } from './lib/ui.svelte.js';
  const OPTS = [['flash', 'writerFlash', 'Flash'], ['cloud', 'writerCloud', 'Cloud'], ['gpt', 'writerGpt', 'ChatGPT'], ['device', 'writerDevice', 'On-Device']];
  const hint = $derived(
    core.writer === 'flash' ? 'Flash writes it, like for everyone else.'
      : ui.mode === 'quick' ? 'Quick writes with Gemini. Tap Normal to hand the write to the shortcut.'
      : 'The STP Flash Backup shortcut writes it with ' + (core.writer === 'gpt' ? 'ChatGPT (your words go to OpenAI)' : core.writer === 'device' ? "Apple's on-device model" : "Apple's cloud model")
        + '. One Paste tap brings it back. This build is kept on this device while it waits.'
  );
</script>

{#if core.dev}
  <div class="writer" id="writerSrc">
    <span class="lbl">🛠️ Write with</span>
    <div class="seg" role="group" aria-label="Who writes the prompt">
      {#each OPTS as [val, id, label] (val)}
        <button type="button" {id} aria-pressed={core.writer === val} onclick={() => core.setWriter(val)}>{label}</button>
      {/each}
    </div>
    <p class="hint" id="writerInfo">{hint}</p>
  </div>
{/if}

<style>
  .writer { grid-column: 1 / -1; display: grid; gap: 6px; padding: 8px 10px; border: 1.5px dashed var(--line); border-radius: 14px; }
  .lbl { font-size: 13px; font-weight: 700; color: var(--muted); }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
  .seg button { flex: 1 1 0; min-width: 0; min-height: 40px; padding: 6px 4px; border: none; border-radius: 0; background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; white-space: nowrap; }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }
  .hint { margin: 0; font-size: 12px; color: var(--muted); }
</style>
