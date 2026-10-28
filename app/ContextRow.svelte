<script>
  /* My context (dev tools): pick saved pieces of background for this prompt, or open the
     editor to write a new one (a title and a big text box). See lib/context.svelte.js. */
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { core } from './lib/core.svelte.js';
  import { context, BUDGET } from './lib/context.svelte.js';
  import { ui } from './lib/ui.svelte.js';

  const n = (x) => x.toLocaleString('en-US');
  /* The budget chip: size and % of the 1,500 token budget. Past 100% with a key it says a
     squeeze is coming; after one, it shows before and after (memory only, this visit). */
  const budget = $derived.by(() => {
    if (context.squeezed) return 'squeezed ' + n(context.squeezed.before) + ' → ' + n(context.squeezed.after) + ' tokens · ' + context.pct + '%';
    const base = 'about ' + n(context.tokens) + ' tokens · ' + context.pct + '%';
    if (!context.over) return base;
    return base + (ui.hasKey ? ' · squeezes to fit when you build' : ' · over budget, used in full');
  });

  let armed = $state('');
  let editor = $state();

  /* The editor always opens at its top with the cursor in a title: the new piece (which
     goes first) for + New, the first piece for Edit. */
  async function openAt(id) {
    context.open = true;
    await tick();
    const input = editor?.querySelector(id ? `[data-id="${id}"] input` : '.ctxitem input');
    input?.focus({ preventScroll: true });
    /* After it slides open, so the page is tall enough to bring its top into view. */
    setTimeout(() => editor?.scrollIntoView({ block: 'start', behavior: ms(1) ? 'smooth' : 'auto' }), ms(230));
  }
  function addNew() { openAt(context.add()); }
  function del(id) { if (armed !== id) { armed = id; return; } context.remove(id); armed = ''; }
  function done() { context.save(); context.open = false; armed = ''; }
  /* While the editor is open, the floating 💡 Ideas and 🧪 Test lab buttons tuck away so they
     don't sit on top of the floating Done bar (Test lab, v2.1.7). */
  $effect(() => {
    const on = !!context.open;
    document.body.classList.toggle('fabs-away', on);
    return () => document.body.classList.remove('fabs-away');
  });
</script>

{#if core.dev}
  <div class="ctxrow" id="contextRow">
    <div class="ctxhead">
      <span class="ctxlabel">My context</span>
      {#if context.chosen.length}<span class="ctxcount" class:over={context.over} id="contextCount" title={`Budget: ${n(BUDGET)} tokens`}>{context.chosen.length} added to this prompt · {budget}</span>{/if}
      <button type="button" class="link ctxedit" id="contextEdit" aria-expanded={context.open} onclick={() => (context.open ? done() : openAt(''))}>{context.open ? 'Done' : context.list.length ? 'Edit' : ''}</button>
    </div>
    <div class="chips" role="group" aria-label="Context to add to this prompt">
      {#each context.usable as c (c.id)}
        <button type="button" class="ctxchip" aria-pressed={context.picked.includes(c.id)} onclick={() => context.toggle(c.id)}>{context.picked.includes(c.id) ? '✓ ' : ''}{c.title.trim() || 'Untitled'}</button>
      {/each}
      <button type="button" class="ctxnew" id="contextNew" onclick={addNew}>+ {context.usable.length ? 'New' : 'Add context you can reuse'}</button>
    </div>

    {#if context.open}
      <div class="ctxeditor" id="contextEditor" bind:this={editor} transition:slide={{ duration: ms(220) }}>
        <p class="hint">Each piece is saved on this phone only. Tap its chip above to use it for this prompt: the facts this request needs get worked into the prompt, nothing tacked on.</p>
        {#each context.list as c, i (c.id)}
          <div class="ctxitem" data-id={c.id}>
            <label class="sr" for="ctxTitle-{i}">Title</label>
            <input id="ctxTitle-{i}" class="ctxtitle" maxlength="60" placeholder="Title, like Bean N Bean roasting" value={c.title} oninput={(e) => context.update(c.id, 'title', e.currentTarget.value)}>
            <label class="sr" for="ctxText-{i}">Context</label>
            <textarea id="ctxText-{i}" class="ctxtext" rows="6" maxlength="4000" placeholder="Everything the AI should know about this. Messy is fine." value={c.text} oninput={(e) => context.update(c.id, 'text', e.currentTarget.value)}></textarea>
            <button type="button" class="link del" onclick={() => del(c.id)}>{armed === c.id ? 'Tap again to delete' : 'Delete'}</button>
          </div>
        {/each}
        <!-- Floats at the bottom of the screen (on top of the keyboard) while the editor is open. -->
        <div class="row ctxbar" id="contextBar">
          <button type="button" onclick={addNew}>+ Add another</button>
          <button type="button" class="primary" id="contextDone" onclick={done}>Done</button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .ctxrow { grid-column: 1 / -1; display: grid; gap: var(--sp-2); padding: var(--sp-3); border: 1.5px dashed var(--line); border-radius: var(--r-md); }
  .ctxhead { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .ctxlabel { font-family: var(--display); font-weight: 600; font-size: var(--fs-md); }
  .ctxcount { font-size: var(--fs-xs); color: var(--accent); font-weight: 700; padding: 2px var(--sp-2); border-radius: var(--r-pill); background: var(--accent-soft); font-variant-numeric: tabular-nums; }
  .ctxcount.over { color: var(--warn); background: var(--warn-soft); }
  .ctxedit { margin-left: auto; min-height: var(--tap); }
  .ctxedit:empty { display: none; }
  .ctxchip { min-height: var(--tap); }
  .ctxnew { min-height: var(--tap); padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); border: 1.5px dashed var(--line); background: transparent; color: var(--accent); font-weight: 700; font-size: var(--fs-sm); }
  .ctxeditor { display: grid; gap: var(--sp-3); scroll-margin-top: var(--sp-4); }
  /* Floating Done: sticks to the bottom of the screen, above the keyboard (--kb, lib/keyboard.svelte.js),
     while you scroll through the pieces; settles back at the end of the list. */
  .ctxbar { position: sticky; bottom: calc(var(--kb, 0px) + env(safe-area-inset-bottom, 0px) + 10px); z-index: 5;
    display: grid; grid-template-columns: auto 1fr; gap: var(--sp-2); padding: var(--sp-2); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--surface) 92%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    border: 1px solid var(--line); box-shadow: 0 10px 28px -10px color-mix(in srgb, var(--ink) 45%, transparent); }
  .ctxbar button { min-height: 48px; white-space: nowrap; }
  .ctxitem { display: grid; gap: var(--sp-2); padding-top: var(--sp-3); border-top: 1px solid var(--line); }
  .ctxtitle { font: inherit; font-weight: 700; font-size: 16px; color: var(--ink); background: var(--bg); width: 100%; min-height: var(--tap); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-sm); }
  .ctxtext { font: inherit; font-size: 16px; line-height: 1.5; background: var(--bg); padding: var(--sp-2) var(--sp-3); min-height: 150px; }
  .ctxtitle:focus-visible, .ctxtext:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .del { justify-self: start; color: var(--danger); min-height: 40px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
