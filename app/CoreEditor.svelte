<script>
  import { core, CORE_OPTIONS } from './lib/core.svelte.js';
  import MemoryPanel from './MemoryPanel.svelte';

  let { onclose } = $props();
  let confirmClear = $state(false);

  function setRole(r) { core.role = core.role === r ? '' : r; core.save(); }
</script>

<div class="core" id="coreEditor">
  <p class="intro">Set this once and it's added to every prompt, so you never have to re-explain yourself. Tap to add (tap again to remove), or type your own.</p>

  <section>
    <h3><span>USER</span> About you</h3>
    <p class="hint">Your role, how you like to communicate, and what you value.</p>
    {#each CORE_OPTIONS.user as g}
      <p class="group">{g.group}</p>
      <div class="chips">
        {#each g.items as it}<button type="button" aria-pressed={core.hasLine('user', it)} onclick={() => core.toggle('user', it)}>{it}</button>{/each}
      </div>
    {/each}
    <textarea id="coreUser" rows="4" bind:value={core.user} oninput={() => core.save()} placeholder="For example: I'm a student who works at a coffee shop. I learn best from visuals."></textarea>
  </section>

  <section>
    <h3><span>SOUL</span> How the AI should act</h3>
    <p class="hint">Its voice, tone, and rules for how it treats you.</p>
    {#each CORE_OPTIONS.soul as g}
      <div class="chips">
        {#each g.items as it}<button type="button" aria-pressed={core.hasLine('soul', it)} onclick={() => core.toggle('soul', it)}>{it}</button>{/each}
      </div>
    {/each}
    <textarea id="coreSoul" rows="3" bind:value={core.soul} oninput={() => core.save()} placeholder="For example: Be honest even when it's not what I want to hear."></textarea>
  </section>

  <section>
    <h3><span>IDENTITY</span> The AI's role</h3>
    <p class="hint">Who the AI is for you. Pick one, then add what that means to you.</p>
    <div class="chips" role="group" aria-label="The AI's role">
      {#each CORE_OPTIONS.roles as r}
        <button type="button" aria-pressed={core.role === r} onclick={() => setRole(r)}>{r}</button>
      {/each}
    </div>
    <textarea id="coreIdentity" rows="2" bind:value={core.identity} oninput={() => core.save()} placeholder="For example: Help me plan my week and keep me on track with school."></textarea>
  </section>

  <MemoryPanel />

  {#if core.has}
    <details class="peek">
      <summary>See what gets added to your prompts</summary>
      <div class="block">{core.block}</div>
    </details>
  {/if}

  <p class="dev">Saved on this phone only, for testing while the app is being built.</p>
  <div class="row">
    <button type="button" class="primary" id="coreDone" onclick={onclose}>Done</button>
    {#if core.has}
      {#if confirmClear}
        <button type="button" class="danger" id="coreClearYes" onclick={() => { core.clear(); confirmClear = false; }}>Yes, delete it</button>
        <button type="button" onclick={() => (confirmClear = false)}>Keep it</button>
      {:else}
        <button type="button" id="coreClear" onclick={() => (confirmClear = true)}>Delete my core</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* minmax(0, 1fr): long chips and text wrap inside the card instead of pushing it wider than the screen. */
  .core { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); min-width: 0; }
  section { min-width: 0; }
  .intro, .hint, .dev { margin: 0; color: var(--muted); font-size: 14px; }
  .dev { font-size: 13px; }
  section { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
  h3 { margin: 0; font-family: var(--display); font-size: 18px; display: flex; align-items: center; gap: 8px; }
  h3 span { font-family: var(--body); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
  .group { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: var(--muted); }
  textarea { font: inherit; font-size: 16px; color: var(--ink); background: var(--surface); padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; resize: vertical; width: 100%; }
  .peek { font-size: 14px; }
  .peek summary { font-weight: 700; cursor: pointer; color: var(--accent); }
  .peek .block { margin-top: 8px; white-space: pre-wrap; padding: 10px 12px; border-radius: 12px; background: var(--bubble); line-height: 1.45; }
  .danger { color: var(--danger); }
</style>
