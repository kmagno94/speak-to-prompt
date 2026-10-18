<script>
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { chat } from './lib/chat.svelte.js';
  import { ms } from './lib/motion.js';

  let draft = $state('');
  let thread;

  function send(e) {
    e.preventDefault();
    chat.reply(draft);
    draft = '';
  }

  /* Keep the newest message in view. Reading length and typing here is what
     makes this re-run whenever a message lands or the "..." bubble shows. */
  $effect(() => {
    chat.messages.length; chat.typing;
    thread?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: ms(1) ? 'smooth' : 'auto' });
  });
</script>

{#snippet bubble(m)}
  {#if m.from === 'me'}
    <button type="button" class="mine" class:skipped={m.text === 'Skip'} disabled={chat.busy}
            onclick={() => chat.edit(m.q)} aria-label="Your answer: {m.text}. Tap to change it">{m.text}</button>
  {:else}
    <p>{m.text}</p>
  {/if}
{/snippet}

<p class="eyebrow">A few quick questions</p>
<h2 id="qaTitle">{chat.title}</h2>
<p id="qaNeed" class="need">{chat.need}</p>
<p id="qaPlan" class="plan">{chat.plan}</p>

<div id="qaList" class="thread" bind:this={thread} role="log" aria-live="polite" aria-label="Questions and your answers">
  {#each chat.messages as m (m.id)}
    <div class="msg {m.from}" in:fly={{ y: 10, duration: ms(220) }}>{@render bubble(m)}</div>
  {/each}
  {#if chat.typing}
    <div class="msg ai typing" aria-label="Writing the next question"><span></span><span></span><span></span></div>
  {:else if chat.current >= 0 && !chat.done}
    <div class="chips" role="group" aria-label="Quick answers" in:fly={{ y: 6, duration: ms(180) }}>
      {#each chat.questions[chat.current].choices as c}
        <button type="button" disabled={chat.busy} onclick={() => chat.reply(c)}>{c}</button>
      {/each}
      <button type="button" class="skip" disabled={chat.busy} onclick={() => chat.skip()}>Skip</button>
    </div>
  {/if}
</div>

{#if chat.current >= 0 && !chat.done}
  <form class="composer" onsubmit={send}>
    <input id="qaOwn" bind:value={draft} placeholder="Or type your own answer" autocomplete="off"
           enterkeyhint="send" aria-label="Type your own answer" disabled={chat.busy || chat.typing}>
    <button type="submit" disabled={!draft.trim() || chat.busy || chat.typing}>Send</button>
  </form>
{/if}

{#if chat.brief.length}
  <div class="brief">
    <p>Going into your prompt</p>
    <ul>
      {#each chat.brief as a (a.i)}
        <li animate:flip={{ duration: ms(250) }}>
          <button type="button" disabled={chat.busy} onclick={() => chat.edit(a.i)}>
            <span>{a.question}</span><b>{a.answer}</b>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<div class="row">
  <button type="button" class="primary" id="qaGo" disabled={chat.busy} onclick={() => chat.finish(false)}>Write my prompt</button>
  <button type="button" id="qaSkip" disabled={chat.busy} onclick={() => chat.finish(true)}>Quick prompt</button>
</div>

<style>
  .thread { display: flex; flex-direction: column; gap: 8px; }
  .msg { max-width: 86%; }
  .msg.ai { align-self: flex-start; }
  .msg.me { align-self: flex-end; }
  .msg p { margin: 0; padding: 10px 14px; border-radius: 18px 18px 18px 6px; background: var(--bg); line-height: 1.4; }
  .mine {
    padding: 10px 14px; min-height: 0; border: 0; border-radius: 18px 18px 6px 18px;
    background: var(--accent); color: var(--accent-ink); font-weight: 700; text-align: left;
  }
  .mine.skipped { background: var(--line); color: var(--muted); }
  .mine:active { transform: scale(0.97); }
  .typing { display: flex; gap: 5px; padding: 14px 16px; border-radius: 18px 18px 18px 6px; background: var(--bg); }
  .typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); opacity: 0.5; }
  .chips .skip { color: var(--muted); }
  .composer { display: flex; gap: 8px; }
  .composer input {
    flex: 1; min-width: 0; font: inherit; font-size: 16px; color: var(--ink);
    padding: 10px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface);
  }
  .composer button { border-radius: 999px; padding: 10px 16px; min-height: 44px; font-weight: 700; }
  .brief { border-top: 1px solid var(--line); padding-top: 12px; display: grid; gap: 6px; }
  .brief p { margin: 0; font-size: 14px; font-weight: 700; color: var(--muted); }
  .brief ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .brief li button {
    width: 100%; min-height: 0; text-align: left; display: grid; gap: 2px;
    padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
  }
  .brief li span { font-size: 13px; color: var(--muted); }
  .brief li b { font-size: 15px; }
  @media (prefers-reduced-motion: no-preference) {
    .typing span { animation: blink 1s ease-in-out infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes blink { 50% { opacity: 1; transform: translateY(-3px); } }
  }
</style>
