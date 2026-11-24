<script>
  /* The note under the box when a draft came back after a reload (v2.1.28, lib/draft.svelte.js).
     Goes away as soon as you type, Build, or tap Start fresh. After a build it says the words are from your last build.
     Last prompt (v2.1.50): with no draft to bring back, a quiet line offers the last finished prompt
     from this tab instead (Copy it, Put my words back, ✕). It isn't the Your words are back note:
     the box stays empty until you ask for the words. */
  import { slide } from 'svelte/transition';
  import { draft, startFresh, lastWordsBack, forgetLast } from './lib/draft.svelte.js';
  import { ms } from './lib/motion.js';

  let lastMsg = $state(''), seeIt = $state(false), lastBox = $state();
  async function copyLast() {
    const t = draft.last?.p || '';
    try { await navigator.clipboard.writeText(t); lastMsg = 'Copied. Paste it into your AI.'; return; } catch (e) {}
    seeIt = true; lastMsg = 'Couldn’t copy by itself here. It’s selected below: copy it by hand.';
    setTimeout(() => { lastBox?.focus(); lastBox?.select(); }, 0);
  }
  function wordsBack() { lastWordsBack(); lastMsg = 'Your words are back in the box. Change anything and build again.'; }
</script>

{#if draft.restored}
  <p class="draftnote" id="draftNote" role="status" transition:slide={{ duration: ms(180) }}>
    <span>{#if draft.built}↩️ Your words from your last build are back (the prompt isn't kept). Change anything and build again. Kept in this tab only, for 30 minutes.{:else}↩️ Your words are back from before the page reloaded. Kept in this tab only, for 30 minutes.{/if}</span>
    <button type="button" id="draftFresh" onclick={startFresh}>Start fresh</button>
  </p>
{:else if draft.last}
  <div class="lastnote" id="lastPrompt" role="status" transition:slide={{ duration: ms(180) }}>
    <p class="lasthead"><span>↩️ Your last prompt is still here from before the reload.</span>
      <button type="button" class="x" id="lastForget" aria-label="Forget my last prompt" onclick={forgetLast}>✕</button></p>
    <div class="lastbtns">
      <button type="button" id="lastCopy" onclick={copyLast}>📋 Copy it</button>
      {#if draft.last.w.trim()}<button type="button" id="lastWords" onclick={wordsBack}>↩ Put my words back</button>{/if}
      <button type="button" class="link" id="lastSee" aria-expanded={seeIt} onclick={() => (seeIt = !seeIt)}>{seeIt ? 'Hide it' : 'See it'}</button>
    </div>
    {#if seeIt}<textarea id="lastText" readonly rows="5" bind:this={lastBox} value={draft.last.p} aria-label="Your last prompt"></textarea>{/if}
    {#if lastMsg}<p class="lastmsg" id="lastMsg">{lastMsg}</p>{/if}
    <small>Kept in this tab only, for 30 minutes. Your next prompt replaces it.</small>
  </div>
{/if}

<style>
  .draftnote { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0 0; padding: 8px 12px; border-radius: 12px;
    font-size: 14px; color: var(--ink); background: var(--accent-soft); }
  .draftnote span { flex: 1 1 200px; }
  .draftnote button, .lastbtns button:not(.link) { flex: none; min-height: 36px; padding: 4px 14px; border-radius: 999px; font: inherit; font-weight: 700; font-size: 14px;
    color: var(--accent); background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); cursor: pointer; }
  .lastnote { display: grid; gap: 8px; margin: 8px 0 0; padding: 8px 12px; border-radius: 12px; font-size: 14px; color: var(--ink);
    border: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent); }
  .lasthead { display: flex; align-items: flex-start; gap: 8px; margin: 0; }
  .lasthead span { flex: 1; }
  .lasthead .x { flex: none; min-width: 36px; min-height: 36px; padding: 0; border: 0; background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
  .lastbtns { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .lastbtns .link { min-height: 36px; }
  .lastnote textarea { font-size: 14px; padding: 8px 10px; background: var(--surface); }
  .lastmsg { margin: 0; color: var(--accent); font-weight: 600; }
  .lastnote small { color: var(--muted); font-size: 12px; }
</style>
