<script>
  import { fly, slide } from 'svelte/transition';
  import { starter } from './lib/starter.svelte.js';
  import { CATEGORIES } from './lib/starters.js';
  import { ms } from './lib/motion.js';

  let draft = $state('');
  let thread = $state();
  let card = $state();

  function send() { starter.reply(draft); draft = ''; }
  /* The helper sits inside the main form, so Return must not submit it. */
  function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); send(); } }

  function toggle() {
    if (starter.open) { starter.close(); return; }
    starter.begin();
  }

  /* Hand the starting text to the main box. Firing "input" lets the rest of the
     page react as if it were typed (the idea strip clears, notices reset). */
  function useText(build) {
    const box = document.getElementById('thoughts');
    box.value = starter.text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    starter.close();
    if (build) document.getElementById('form').requestSubmit();
    else box.scrollIntoView({ block: 'center', behavior: ms(1) ? 'smooth' : 'auto' });
  }

  $effect(() => {
    if (starter.open && card) card.scrollIntoView({ block: 'start', behavior: ms(1) ? 'smooth' : 'auto' });
  });
  $effect(() => {
    starter.messages.length; starter.typing;
    thread?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: ms(1) ? 'smooth' : 'auto' });
  });
</script>

<button type="button" class="startbtn" id="starterBtn" aria-expanded={starter.open} onclick={toggle}>
  <span aria-hidden="true">💡</span> Not sure where to start?
</button>

{#if starter.open}
  <div class="starter" id="starter" bind:this={card} transition:slide={{ duration: ms(220) }}>
    <div class="head">
      <b>Let's find a starting point</b>
      <button type="button" class="x" id="starterClose" aria-label="Close" onclick={() => starter.close()}>✕</button>
    </div>

    <div class="thread" bind:this={thread} role="log" aria-live="polite">
      {#each starter.messages as m (m.id)}
        <div class="msg {m.from}" in:fly={{ y: 10, duration: ms(220) }}><p>{m.text}</p></div>
      {/each}
      {#if starter.typing}
        <div class="msg ai typing" aria-label="Writing the next question"><span></span><span></span><span></span></div>
      {:else if !starter.cat}
        <div class="cats" role="group" aria-label="What do you want help with?" in:fly={{ y: 6, duration: ms(180) }}>
          {#each CATEGORIES as c (c.id)}
            <button type="button" class:general={c.id === 'general'} onclick={() => starter.pick(c)}><span aria-hidden="true">{c.emoji}</span>{c.label}</button>
          {/each}
        </div>
      {:else if !starter.done}
        <div class="chips" role="group" aria-label="Quick answers" in:fly={{ y: 6, duration: ms(180) }}>
          {#each starter.questions[starter.current].choices as c}
            <button type="button" onclick={() => starter.reply(c)}>{c}</button>
          {/each}
          {#if !starter.questions[starter.current].end}
            <button type="button" class="skip" onclick={() => starter.skip()}>Skip</button>
          {/if}
        </div>
      {/if}
    </div>

    {#if !starter.done}
      <div class="composer">
        <input id="starterOwn" bind:value={draft} onkeydown={onKey} autocomplete="off" enterkeyhint="send"
               placeholder={starter.cat ? 'Or type your own answer' : 'Or describe it in your own words'}
               aria-label={starter.cat ? 'Type your own answer' : 'Describe what you want help with'} disabled={starter.typing}>
        <button type="button" disabled={!draft.trim() || starter.typing} onclick={send}>Send</button>
      </div>
    {:else}
      <div class="out" in:fly={{ y: 8, duration: ms(220) }}>
        <p>Your starting point</p>
        <div class="text">{starter.text}</div>
      </div>
      <div class="row">
        <button type="button" class="primary" id="starterBuild" onclick={() => useText(true)}>Build my prompt</button>
        <button type="button" id="starterUse" onclick={() => useText(false)}>Put it in the box</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .startbtn {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 8px;
    min-height: 44px; padding: 9px 16px; border-radius: 999px; font-weight: 700;
    background: var(--accent-soft); color: var(--accent); border: 1px solid transparent;
  }
  .startbtn[aria-expanded='true'] { border-color: var(--accent); }
  .starter {
    display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 14px; border-radius: 16px;
    background: var(--surface); border: 1px solid var(--line);
    box-shadow: 0 10px 24px -18px rgba(20, 40, 70, 0.35);
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .head b { font-family: var(--display); font-size: 19px; }
  .x { min-height: 40px; padding: 6px 12px; border-radius: 999px; background: var(--bg); border-color: transparent; color: var(--muted); }
  .msg.me p { margin: 0; padding: 10px 14px; border-radius: 18px 18px 6px 18px; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); gap: 8px; }
  .cats button {
    display: flex; align-items: center; gap: 8px; text-align: left; min-height: 48px;
    padding: 10px 12px; border-radius: 14px; font-size: 15px; font-weight: 700;
    background: var(--bg); border-color: transparent;
  }
  .cats button span { font-size: 20px; }
  .cats button.general { grid-column: 1 / -1; background: var(--accent-soft); color: var(--accent); }
  .cats button:active, .chips :global(button:active) { transform: scale(0.97); }
  .out { display: grid; gap: 6px; }
  .out p { margin: 0; font-size: 14px; font-weight: 700; color: var(--muted); }
  .out .text { white-space: pre-wrap; padding: 12px 14px; border-radius: 12px; background: var(--bg); line-height: 1.5; }
</style>
