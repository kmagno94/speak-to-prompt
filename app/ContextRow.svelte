<script>
  /* My context: pick pieces of background for this prompt, or open the editor to write a new
     one (a title and a big text box). In the main app since v2.1.21 (#4): saving is opt-in
     (Save on this phone), and each piece shows its size against the 3,800 character cap.
     See lib/context.svelte.js. */
  import { tick, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { context, BUDGET, CAP } from './lib/context.svelte.js';
  import { ui } from './lib/ui.svelte.js';
  import { pack, unpack } from './lib/contextsync.js';

  const n = (x) => x.toLocaleString('en-US');
  /* The budget chip: size and % of the 1,500 token budget. Past 100% with a key it says a
     squeeze is coming; after one, it shows before and after (memory only, this visit). */
  const budget = $derived.by(() => {
    if (context.squeezed) return 'squeezed ' + n(context.squeezed.before) + ' → ' + n(context.squeezed.after) + ' tokens · ' + context.pct + '%';
    const base = 'about ' + n(context.tokens) + ' tokens · ' + context.pct + '%';
    if (!context.over) return base;
    return base + (ui.hasKey ? ' · squeezes to fit when you build' : ' · over budget, used in full');
  });

  const len = (c) => c.text.trim().length;
  /* Compact chips (v2.1.28): recently used first, TOP shown, the rest behind +N more. A picked piece
     always shows, so you can see what's going into the prompt. Titles show without a leading "#". */
  const TOP = 3;
  let showAll = $state(false);
  const shown = $derived(showAll ? context.ordered : context.ordered.filter((c, i) => i < TOP || context.picked.includes(c.id)));
  const hidden = $derived(context.ordered.length - shown.length);
  const label = (c) => (c.title.trim().replace(/^#+\s*/, '') || 'Untitled');
  onMount(() => {
    const form = document.getElementById('form');
    const stamp = () => context.markUsed();
    form && form.addEventListener('submit', stamp, true);
    return () => form && form.removeEventListener('submit', stamp, true);
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
  /* On all your devices (v2.1.28, lib/contextsync.js): Send to Notes hands the pieces to the share
     sheet (Notes syncs them through iCloud), or copies them where there's no share sheet.
     Bring in reads a copied note from the clipboard, or from a paste box if the browser won't. */
  let syncMsg = $state(''), syncBad = $state(false), pasteOpen = $state(false), pasteText = $state('');
  const say = (m, bad = false) => { syncMsg = m; syncBad = bad; };
  async function sendOut() {
    const pieces = context.list.filter((c) => c.title.trim() || c.text.trim());
    if (!pieces.length) return say('Add a piece first, then send it.', true);
    const text = pack(pieces);
    if (navigator.share) {
      try { await navigator.share({ title: 'Speak to Prompt · My context', text }); return say('Sent. Pick Notes in the share sheet and it syncs to your other devices with iCloud.'); }
      catch (e) { if (e && e.name === 'AbortError') return say(''); }
    }
    try { await navigator.clipboard.writeText(text); say('Copied. Paste it into a note in Apple Notes and it syncs to your other devices with iCloud.'); }
    catch (e) { say('This browser won\'t copy. Try Safari.', true); }
  }
  function take(text) {
    const pieces = unpack(text);
    if (!pieces) return say('No My context code found. Copy the whole note from Notes, including the last line, then tap Bring in.', true);
    if (!pieces.length) return say('That note has no pieces in it.', true);
    const r = context.bringIn(pieces);
    pasteOpen = false; pasteText = '';
    const bits = [r.added && r.added + ' added', r.updated && r.updated + ' updated', r.same && r.same + ' already here'].filter(Boolean).join(', ');
    say('Brought in: ' + bits + '.' + (context.keep ? '' : ' Turn on Save on this phone to keep them after you close the tab.'));
  }
  async function bringIn() {
    if (!context.open) await openAt('');
    try { const t = await navigator.clipboard.readText(); if (t && unpack(t)) return take(t); } catch (e) {}
    pasteOpen = true;
    say('Paste the note here, then tap Bring in.');
  }
  /* While the editor is open, the floating 💡 Ideas and 🧪 Test lab buttons tuck away so they
     don't sit on top of the floating Done bar (Test lab, v2.1.7). */
  $effect(() => {
    const on = !!context.open;
    document.body.classList.toggle('fabs-away', on);
    return () => document.body.classList.remove('fabs-away');
  });
</script>

<div class="ctxrow" id="contextRow">
  <div class="ctxhead">
    <span class="ctxlabel">My context</span>
    {#if context.chosen.length}<span class="ctxcount" class:over={context.over} id="contextCount" title={`Budget: ${n(BUDGET)} tokens`}>{context.chosen.length} added to this prompt · {budget}</span>{/if}
    <button type="button" class="link ctxedit" id="contextEdit" aria-expanded={context.open} onclick={() => (context.open ? done() : openAt(''))}>{context.open ? 'Done' : context.list.length ? 'Edit' : ''}</button>
  </div>
  <div class="chips" role="group" aria-label="Context to add to this prompt">
    {#each shown as c (c.id)}
      <button type="button" class="ctxchip" class:overcap={context.overCap.includes(c.id)} aria-pressed={context.picked.includes(c.id)} title={(c.title.trim() || 'Untitled') + (context.overCap.includes(c.id) ? ` · over the ${n(CAP)} character cap` : '')} onclick={() => context.toggle(c.id)}>{context.picked.includes(c.id) ? '✓ ' : ''}{label(c)}{#if context.overCap.includes(c.id)}<span class="capflag"> · over {n(CAP)}</span>{/if}</button>
    {/each}
    {#if hidden > 0}
      <button type="button" class="ctxmore" id="contextMore" aria-expanded="false" onclick={() => (showAll = true)}>+{hidden} more</button>
    {:else if showAll && context.ordered.length > TOP}
      <button type="button" class="ctxmore" id="contextLess" aria-expanded="true" onclick={() => (showAll = false)}>Show less</button>
    {/if}
    <button type="button" class="ctxnew" id="contextNew" onclick={addNew}>+ {context.usable.length ? 'New' : 'Add context you can reuse'}</button>
    {#if !context.usable.length}<button type="button" class="link ctxin" id="contextInQuick" onclick={bringIn}>📥 Bring in from another device</button>{/if}
  </div>

  {#if context.open}
    <div class="ctxeditor" id="contextEditor" bind:this={editor} transition:slide={{ duration: ms(220) }}>
      <label class="keep" for="contextKeep">
        <input type="checkbox" id="contextKeep" checked={context.keep} onchange={(e) => context.setKeep(e.currentTarget.checked)}>
        <span><b>Save on this phone</b><small>{context.keep ? 'Saved in this browser on this phone only, never sent anywhere except inside prompts you build. Turn off to delete them from this phone.' : 'Off: these pieces go away when you close or refresh. Turn on to keep them on this phone only.'}</small></span>
      </label>
      <div class="sync" id="contextSync">
        <b>📲 On all your devices</b>
        <small>Send to Notes, and iCloud puts the note on your iPad and Mac. There, copy the note and tap Bring in. Only goes where you send it.</small>
        <div class="syncbtns">
          <button type="button" id="contextSend" onclick={sendOut}>📤 Send to Notes</button>
          <button type="button" id="contextIn" onclick={bringIn}>📥 Bring in</button>
        </div>
        {#if pasteOpen}
          <label class="sr" for="contextPaste">Paste the note</label>
          <textarea id="contextPaste" class="ctxtext" rows="4" placeholder="Paste the whole note from Notes here" bind:value={pasteText}></textarea>
          <button type="button" class="primary" id="contextPasteGo" onclick={() => take(pasteText)}>Bring in</button>
        {/if}
        {#if syncMsg}<p class="syncmsg" class:bad={syncBad} id="contextSyncMsg" role="status">{syncMsg}</p>{/if}
      </div>
      <p class="hint">Tap a chip above to use that piece for this prompt: the facts this request needs get worked into the prompt, nothing tacked on. Keep each piece under {n(CAP)} characters.</p>
      {#each context.list as c, i (c.id)}
        <div class="ctxitem" data-id={c.id}>
          <label class="sr" for="ctxTitle-{i}">Title</label>
          <input id="ctxTitle-{i}" class="ctxtitle" maxlength="60" placeholder="Title, like Bean N Bean roasting" value={c.title} oninput={(e) => context.update(c.id, 'title', e.currentTarget.value)}>
          <label class="sr" for="ctxText-{i}">Context</label>
          <textarea id="ctxText-{i}" class="ctxtext" class:overcap={len(c) > CAP} rows="6" maxlength="6000" aria-describedby="ctxSize-{i}" placeholder="Everything the AI should know about this. Messy is fine." value={c.text} oninput={(e) => context.update(c.id, 'text', e.currentTarget.value)}></textarea>
          <p class="size" class:overcap={len(c) > CAP} id="ctxSize-{i}" aria-live="polite">{#if len(c) > CAP}⚠️ Over the {n(CAP)} character cap by {n(len(c) - CAP)}. Trim it so the AI gets the parts that matter.{:else}{n(len(c))} / {n(CAP)} characters{/if}</p>
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

<style>
  .ctxrow { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-2); padding: var(--sp-3); border: 1.5px dashed var(--line); border-radius: var(--r-md); }
  .ctxhead { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .ctxlabel { font-family: var(--display); font-weight: 600; font-size: var(--fs-md); }
  .ctxcount { font-size: var(--fs-xs); color: var(--accent); font-weight: 700; padding: 2px var(--sp-2); border-radius: var(--r-pill); background: var(--accent-soft); font-variant-numeric: tabular-nums; }
  .ctxcount.over { color: var(--warn); background: var(--warn-soft); }
  .ctxedit { margin-left: auto; min-height: var(--tap); }
  .ctxedit:empty { display: none; }
  /* One line each: long titles trim with … (the full title is in the tooltip and the editor). */
  .ctxchip { min-height: var(--tap); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chips .ctxmore { min-height: var(--tap); border-style: dashed; color: var(--accent); font-weight: 700; background: transparent; }
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
  .keep { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--accent-soft); cursor: pointer; }
  .keep input { width: 22px; height: 22px; margin-top: 2px; flex: none; accent-color: var(--accent); }
  .keep span { display: grid; gap: 2px; }
  .keep small { font-size: var(--fs-xs); color: var(--muted); line-height: 1.4; }
  /* The 3,800 cap: a quiet counter, amber with the overage once a piece goes past it. */
  .size { margin: -4px 0 0; font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; }
  .size.overcap { color: var(--warn); font-weight: 700; }
  .ctxtext.overcap { border-color: var(--warn); }
  .ctxchip.overcap { border-color: var(--warn); }
  .capflag { color: var(--warn); font-weight: 700; }
  .del { justify-self: start; color: var(--danger); min-height: 40px; }
  .ctxin { min-height: var(--tap); font-size: var(--fs-sm); }
  .sync { display: grid; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); border: 1px solid var(--line); }
  .sync small { font-size: var(--fs-xs); color: var(--muted); line-height: 1.4; }
  .sync, .syncbtns > * { min-width: 0; }
  .syncbtns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); }
  .syncbtns button { min-height: 44px; padding-inline: var(--sp-2); }
  .syncmsg { margin: 0; font-size: var(--fs-xs); color: var(--accent); font-weight: 600; }
  .syncmsg.bad { color: var(--warn); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
