<script>
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { chat, GOAL_MAX } from './lib/chat.svelte.js';
  import { ms } from './lib/motion.js';

  let draft = $state('');
  /* Clarity mirror (AGT-13): fix the goal line before the prompt gets written. */
  let editingGoal = $state(false);
  let goalDraft = $state('');
  let goalBox = $state();
  function editGoal() {
    goalDraft = chat.need;
    editingGoal = true;
    setTimeout(() => { goalBox?.focus(); goalBox?.select(); }, 0);
  }
  function saveGoal(e) {
    e.preventDefault();
    chat.setGoal(goalDraft);
    editingGoal = false;
  }
  /* A new set of questions closes an open edit. */
  $effect(() => { chat.readGoal; chat.title; editingGoal = false; });
  let thread;
  let own;

  /* Change an answer. A tapped one is loaded into the box so you can say it your way. */
  function change(i) {
    const was = chat.tapped[i] ? chat.answers[i] : '';
    chat.edit(i);
    draft = was || '';
    if (was) setTimeout(() => own?.focus(), 0);
  }

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
            onclick={() => change(m.q)} aria-label="Your answer: {m.text}. Tap to change it">{m.text}</button>
  {:else}
    <p class:q={m.kind === 'q'} class:help={m.kind === 'help'}>{m.text}</p>
  {/if}
{/snippet}

<p class="eyebrow">A few quick questions</p>
<h2 id="qaTitle">{chat.title}</h2>
{#if chat.need}
  {#if editingGoal}
    <form class="goaledit" id="qaGoalEdit" onsubmit={saveGoal}>
      <label for="qaGoalInput">Your goal, in your words</label>
      <textarea id="qaGoalInput" bind:this={goalBox} bind:value={goalDraft} rows="2" maxlength={GOAL_MAX}
                enterkeyhint="done" onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) saveGoal(e); if (e.key === 'Escape') editingGoal = false; }}></textarea>
      <div class="goalbtns">
        <button type="submit" id="qaGoalSave" class="primary">Save goal</button>
        <button type="button" id="qaGoalCancel" onclick={() => (editingGoal = false)}>Cancel</button>
      </div>
    </form>
  {:else}
    <p id="qaNeed" class="need goal">
      <span class="goallbl">{chat.goalEdited ? 'Your goal (your words):' : 'Your goal:'}</span>
      <span id="qaGoalText">{chat.need}</span>
      <button type="button" id="qaGoalEditBtn" class="linkish goalbtn" disabled={chat.busy} onclick={editGoal}
              aria-label="Edit your goal">Edit</button>
    </p>
    {#if !chat.goalEdited}<p class="goalhint" id="qaGoalHint">Not quite it? Tap Edit and fix it, so your prompt aims at the right thing.</p>{/if}
  {/if}
{/if}
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
        <button type="button" disabled={chat.busy} onclick={() => chat.reply(c, true)}>{c}</button>
      {/each}
      <button type="button" class="skip" disabled={chat.busy} onclick={() => chat.skip()}>Skip</button>
    </div>
  {/if}
</div>

{#if chat.current >= 0 && !chat.done}
  <form class="composer" onsubmit={send}>
    <input id="qaOwn" bind:this={own} bind:value={draft} placeholder="Or type your own answer" autocomplete="off"
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
          <button type="button" disabled={chat.busy} onclick={() => change(a.i)}>
            <span>{a.question}{#if a.tapped}<em class="tapped"> (suggested, tap to say it your way)</em>{/if}</span><b>{a.answer}</b>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<!-- Write my prompt and Quick version live in the Next step dock (NextDock.svelte, #17). -->

