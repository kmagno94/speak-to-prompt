<script>
  /* My context (dev tools): pick saved pieces of background for this prompt, or open the
     editor to write a new one (a title and a big text box). See lib/context.svelte.js. */
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { core } from './lib/core.svelte.js';
  import { context } from './lib/context.svelte.js';

  let armed = $state('');
  let editor = $state();

  async function addNew() {
    const id = context.add();
    context.open = true;
    await tick();
    editor?.querySelector(`[data-id="${id}"] input`)?.focus();
  }
  function del(id) { if (armed !== id) { armed = id; return; } context.remove(id); armed = ''; }
  function done() { context.save(); context.open = false; armed = ''; }
</script>

{#if core.dev}
  <div class="ctxrow" id="contextRow">
    <div class="ctxhead">
      <span class="ctxlabel">My context</span>
      {#if context.chosen.length}<span class="ctxcount">{context.chosen.length} added to this prompt</span>{/if}
      <button type="button" class="link ctxedit" id="contextEdit" aria-expanded={context.open} onclick={() => (context.open ? done() : (context.open = true))}>{context.open ? 'Done' : context.list.length ? 'Edit' : ''}</button>
    </div>
    <div class="chips" role="group" aria-label="Context to add to this prompt">
      {#each context.usable as c (c.id)}
        <button type="button" class="ctxchip" aria-pressed={context.picked.includes(c.id)} onclick={() => context.toggle(c.id)}>{context.picked.includes(c.id) ? '✓ ' : ''}{c.title.trim() || 'Untitled'}</button>
      {/each}
      <button type="button" class="ctxnew" id="contextNew" onclick={addNew}>+ {context.usable.length ? 'New' : 'Add context you can reuse'}</button>
    </div>

    {#if context.open}
      <div class="ctxeditor" id="contextEditor" bind:this={editor} transition:slide={{ duration: ms(220) }}>
        <p class="hint">Each piece is saved on this phone only. Tap its chip above to add it to a prompt; the AI can then refer to it by its title.</p>
        {#each context.list as c, i (c.id)}
          <div class="ctxitem" data-id={c.id}>
            <label class="sr" for="ctxTitle-{i}">Title</label>
            <input id="ctxTitle-{i}" class="ctxtitle" maxlength="60" placeholder="Title, like Bean N Bean roasting" value={c.title} oninput={(e) => context.update(c.id, 'title', e.currentTarget.value)}>
            <label class="sr" for="ctxText-{i}">Context</label>
            <textarea id="ctxText-{i}" class="ctxtext" rows="6" maxlength="4000" placeholder="Everything the AI should know about this. Messy is fine." value={c.text} oninput={(e) => context.update(c.id, 'text', e.currentTarget.value)}></textarea>
            <button type="button" class="link del" onclick={() => del(c.id)}>{armed === c.id ? 'Tap again to delete' : 'Delete'}</button>
          </div>
        {/each}
        <div class="row">
          <button type="button" onclick={addNew}>+ Add another</button>
          <button type="button" class="primary" onclick={done}>Done</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .ctxrow { grid-column: 1 / -1; display: grid; gap: var(--sp-2); padding: var(--sp-3); border: 1.5px dashed var(--line); border-radius: var(--r-md); }
  .ctxhead { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .ctxlabel { font-family: var(--display); font-weight: 600; font-size: var(--fs-md); }
  .ctxcount { font-size: var(--fs-xs); color: var(--accent); font-weight: 700; }
  .ctxedit { margin-left: auto; min-height: var(--tap); }
  .ctxedit:empty { display: none; }
  .ctxchip { min-height: var(--tap); }
  .ctxnew { min-height: var(--tap); padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); border: 1.5px dashed var(--line); background: transparent; color: var(--accent); font-weight: 700; font-size: var(--fs-sm); }
  .ctxeditor { display: grid; gap: var(--sp-3); }
  .ctxitem { display: grid; gap: var(--sp-2); padding-top: var(--sp-3); border-top: 1px solid var(--line); }
  .ctxtitle { font: inherit; font-weight: 700; font-size: 16px; color: var(--ink); background: var(--bg); width: 100%; min-height: var(--tap); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-sm); }
  .ctxtext { font: inherit; font-size: 16px; line-height: 1.5; background: var(--bg); padding: var(--sp-2) var(--sp-3); min-height: 150px; }
  .ctxtitle:focus-visible, .ctxtext:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .del { justify-self: start; color: var(--danger); min-height: 40px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
