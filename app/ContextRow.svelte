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
  import { savectx } from './lib/savectx.svelte.js';

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

  /* Pills (v2.1.48, idea mwmevd3e9pix): the editor lists your pieces as pills and opens one
     at a time, so there's no scrolling past every big text box. `focus` is the open piece.
     ↩ Revert changes puts it back the way it was when you opened it (`snap`), and a delete
     shows Undo for a few seconds, in case of a missed tap. Memory only, like the pieces. */
  let focus = $state('');
  let snap = $state(null);
  let undo = $state(null), undoTimer;
  const cur = $derived(context.list.find((c) => c.id === focus) || null);
  const changed = $derived(!!(cur && snap && snap.id === cur.id && (snap.title !== cur.title || snap.text !== cur.text)));
  function show(id) {
    armed = '';
    const c = context.list.find((x) => x.id === id);
    focus = c ? c.id : '';
    snap = c ? { id: c.id, title: c.title, text: c.text } : null;
  }
  function revert() {
    if (!changed) return;
    context.update(snap.id, 'title', snap.title);
    context.update(snap.id, 'text', snap.text);
  }
  /* v2.1.49 (Test lab 11/19): the open piece sits right under its own pill (not below every pill),
     and the tapped pill comes to the top of the screen so its box is in view. ← All pieces, a delete,
     and + Add another snap back up to the pills instead of leaving you at the bottom. */
  const behavior = () => (ms(1) ? 'smooth' : 'auto');
  function toPill(id) { editor?.querySelector(`.ctxpill[data-pill="${id}"]`)?.scrollIntoView({ block: 'start', behavior: behavior() }); }
  function toPills() { (editor?.querySelector('.pillwrap') || editor)?.scrollIntoView({ block: 'start', behavior: behavior() }); }
  async function pickPill(id) {
    show(id);
    await tick();
    toPill(id);
  }
  async function back() {
    show('');
    await tick();
    toPills();
    editor?.querySelector('.ctxpill')?.focus({ preventScroll: true });
  }

  /* + New opens the new piece (it goes first) with the cursor in its title. Edit opens the pills,
     or the only piece straight away when there's just one. Either way the editor's top comes into view. */
  async function openAt(id) {
    const wasOpen = !!(context.open && editor);
    context.open = true;
    show(id || (context.list.length === 1 ? context.list[0].id : ''));
    await tick();
    if (id) editor?.querySelector('.ctxitem input')?.focus({ preventScroll: true });
    else editor?.querySelector('.ctxpill')?.focus({ preventScroll: true });
    /* After it slides open, so the page is tall enough to bring the pills into view
       (straight away when the editor was already open, like + Add another). */
    const snapUp = () => (id ? toPill(id) : toPills());
    if (wasOpen) snapUp(); else setTimeout(snapUp, ms(230));
  }
  function addNew() { openAt(context.add()); }
  function del(id) {
    if (armed !== id) { armed = id; return; }
    clearTimeout(undoTimer);
    undo = context.remove(id);
    armed = ''; show('');
    undoTimer = setTimeout(() => (undo = null), 8000);
    tick().then(toPills);
  }
  function undoDelete() {
    if (!undo) return;
    clearTimeout(undoTimer);
    const id = undo.piece.id;
    context.restore(undo);
    undo = null;
    pickPill(id);
  }
  function done() { context.save(); context.open = false; armed = ''; show(''); clearTimeout(undoTimer); undo = null; }
  /* On all your devices (v2.1.28, lib/contextsync.js): Copy for Notes copies the pieces as one note,
     then (iPhone/iPad) an Open Notes button opens Apple Notes to paste it into a new note; iCloud syncs it.
     It used to hand the note to the share sheet, but Notes' share sheet popped up and closed on it
     (Test lab report, 11/7), so copying is the main way and Share another way is the backup.
     Bring in reads a copied note from the clipboard, or from a paste box if the browser won't.
     The note is plain words now, no code at the end (v2.1.28 Test lab report), and an edit made in Notes comes across. */
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  let syncMsg = $state(''), syncBad = $state(false), pasteOpen = $state(false), pasteText = $state(''), copiedNote = $state(false);
  const say = (m, bad = false) => { syncMsg = m; syncBad = bad; };
  const ready = () => context.list.filter((c) => c.title.trim() || c.text.trim());
  async function sendOut() {
    const pieces = ready();
    copiedNote = false;
    if (!pieces.length) return say('Add a piece first, then send it.', true);
    const text = pack(pieces);
    try {
      await navigator.clipboard.writeText(text);
      copiedNote = true;
      return say(appleTouch
        ? 'Copied. Tap Open Notes, start a new note (✏️), and paste. iCloud puts it on your iPad and Mac.'
        : 'Copied. Paste it into a new note in Apple Notes and iCloud puts it on your other devices.');
    } catch (e) {}
    if (canShare) return shareOut();
    say('This browser won\'t copy. Try Safari.', true);
  }
  /* The backup: the share sheet, text only (the first line is the title anyway). */
  async function shareOut() {
    const pieces = ready();
    if (!pieces.length) return say('Add a piece first, then send it.', true);
    try { await navigator.share({ text: pack(pieces) }); say('Sent.'); }
    catch (e) { if (!(e && e.name === 'AbortError')) say('The share sheet didn\'t work here. Use Copy for Notes instead.', true); }
  }
  function take(text) {
    const pieces = unpack(text);
    if (!pieces) return say('That isn\'t a My context note. In Notes, copy the whole note, from the first line to ~ end of My context ~, then tap Bring in.', true);
    if (!pieces.length) return say('That note has no pieces in it.', true);
    const r = context.bringIn(pieces);
    pasteOpen = false; pasteText = '';
    /* v2.1.37 (#50): a title that's already here with different words is never overwritten
       without asking. Those open the overlap screen (old vs new: Update, Keep both, Skip). */
    const clash = r.conflicts.length;
    const bits = [r.added && r.added + ' added', r.same && r.same + ' already here', clash && clash + (clash === 1 ? ' needs your pick' : ' need your pick')].filter(Boolean).join(', ');
    say('Brought in: ' + bits + '.' + (context.keep ? '' : ' Turn on Save on this phone to keep them after you close the tab.'));
    if (clash) savectx.review(r.conflicts, r);
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
      {#if context.list.length}
        <div class="pillwrap">
          <p class="pillhead" id="contextPillHead">{cur ? 'Your pieces' : 'Tap a piece to edit or delete it'}</p>
          <div class="pills" role="group" aria-labelledby="contextPillHead">
            {#each context.list as c (c.id)}
              <button type="button" class="ctxpill" data-pill={c.id} class:overcap={context.overCap.includes(c.id)} aria-pressed={focus === c.id} onclick={() => pickPill(c.id)}>{label(c)}{#if context.overCap.includes(c.id)}<span class="capflag"> · over {n(CAP)}</span>{/if}</button>
              {#if cur && cur.id === c.id}
              <div class="ctxitem" data-id={cur.id}>
                <label class="sr" for="ctxTitle">Title</label>
                <input id="ctxTitle" class="ctxtitle" maxlength="60" placeholder="Title, like Bean N Bean roasting" value={cur.title} oninput={(e) => context.update(cur.id, 'title', e.currentTarget.value)}>
                <label class="sr" for="ctxText">Context</label>
                <textarea id="ctxText" class="ctxtext" class:overcap={len(cur) > CAP} rows="6" maxlength="6000" aria-describedby="ctxSize" placeholder="Everything the AI should know about this. Messy is fine." value={cur.text} oninput={(e) => context.update(cur.id, 'text', e.currentTarget.value)}></textarea>
                <p class="size" class:overcap={len(cur) > CAP} id="ctxSize" aria-live="polite">{#if len(cur) > CAP}⚠️ Over the {n(CAP)} character cap by {n(len(cur) - CAP)}. Trim it so the AI gets the parts that matter.{:else}{n(len(cur))} / {n(CAP)} characters{/if}</p>
                <div class="itemacts">
                  <button type="button" class="link back" id="contextBack" onclick={back}>← All pieces</button>
                  <button type="button" class="link revert" id="contextRevert" disabled={!changed} onclick={revert}>↩ Revert changes</button>
                  <button type="button" class="link del" onclick={() => del(cur.id)}>{armed === cur.id ? 'Tap again to delete' : 'Delete'}</button>
                </div>
              </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      {#if undo}
        <p class="undo" id="contextUndo" role="status">Deleted “{label(undo.piece)}”. <button type="button" class="link" id="contextUndoBtn" onclick={undoDelete}>Undo</button></p>
      {/if}
      <label class="keep" for="contextKeep">
        <input type="checkbox" id="contextKeep" checked={context.keep} onchange={(e) => context.setKeep(e.currentTarget.checked)}>
        <span><b>Save on this phone</b><small>{context.keep ? 'Saved in this browser on this phone only, never sent anywhere except inside prompts you build. Turn off to delete them from this phone.' : 'Off: these pieces go away when you close or refresh. Turn on to keep them on this phone only.'}</small></span>
      </label>
      <div class="sync" id="contextSync">
        <b>📲 On all your devices</b>
        <small>Copy for Notes, paste it into a new note, and iCloud puts it on your iPad and Mac. There, copy the note and tap Bring in. Only goes where you put it.</small>
        <div class="syncbtns">
          <button type="button" id="contextSend" onclick={sendOut}>📋 Copy for Notes</button>
          <button type="button" id="contextIn" onclick={bringIn}>📥 Bring in</button>
        </div>
        {#if copiedNote && appleTouch}<a class="opennotes" id="contextOpenNotes" href="mobilenotes://">📝 Open Notes</a>{/if}
        {#if canShare}<button type="button" class="link sharealt" id="contextShare" onclick={shareOut}>Share another way</button>{/if}
        {#if pasteOpen}
          <label class="sr" for="contextPaste">Paste the note</label>
          <textarea id="contextPaste" class="ctxtext" rows="4" placeholder="Paste the whole note from Notes here" bind:value={pasteText}></textarea>
          <button type="button" class="primary" id="contextPasteGo" onclick={() => take(pasteText)}>Bring in</button>
        {/if}
        {#if syncMsg}<p class="syncmsg" class:bad={syncBad} id="contextSyncMsg" role="status">{syncMsg}</p>{/if}
      </div>
      <button type="button" class="guided" id="contextGuided" onclick={() => savectx.start('editor', '', '')}>🧱 Build one with questions<small>Answer a few questions and it writes the piece for you</small></button>
      <p class="hint">Tap a chip above to use that piece for this prompt: the facts this request needs get worked into the prompt, nothing tacked on. Keep each piece under {n(CAP)} characters.</p>
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
  /* Inside the pills row, the open piece takes a full line right under its pill; the pills after it wrap below. */
  .ctxitem { flex: 1 1 100%; min-width: 0; display: grid; gap: var(--sp-2); padding: var(--sp-3); border: 1.5px solid var(--accent); border-radius: var(--r-md); scroll-margin: var(--sp-4); }
  /* Pills (v2.1.48): every piece as one tap target; the open one is filled in. */
  .pillwrap { display: grid; gap: var(--sp-2); }
  .pillhead { margin: 0; font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
  .pills { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .pillwrap, .ctxpill { scroll-margin-top: var(--sp-4); }
  .ctxpill { min-height: var(--tap); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); font-size: var(--fs-sm); }
  .ctxpill[aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); font-weight: 700; }
  .ctxpill.overcap { border-color: var(--warn); }
  .itemacts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1) var(--sp-4); }
  .itemacts .link { min-height: 40px; }
  .revert:disabled { opacity: 0.45; }
  .undo { margin: 0; display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--warn-soft); font-size: var(--fs-sm); font-weight: 600; }
  .undo .link { min-height: 40px; font-weight: 700; }
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
  .del { color: var(--danger); min-height: 40px; }
  .ctxin { min-height: var(--tap); font-size: var(--fs-sm); }
  .guided { display: grid; gap: 2px; justify-items: start; text-align: left; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; border-radius: var(--r-md); }
  .guided small { font-weight: 500; font-size: var(--fs-xs); color: var(--muted); }
  .sync { display: grid; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); border: 1px solid var(--line); }
  .sync small { font-size: var(--fs-xs); color: var(--muted); line-height: 1.4; }
  .sync, .syncbtns > * { min-width: 0; }
  .syncbtns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); }
  .syncbtns button { min-height: 44px; padding-inline: var(--sp-2); }
  .opennotes { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: var(--sp-2); border-radius: 999px; font-weight: 700; text-decoration: none;
    color: var(--ink); background: var(--accent-soft); border: 1px solid var(--line); }
  .opennotes:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .sharealt { display: block; margin-top: var(--sp-2); min-height: 36px; font-size: 14px; }
  .syncmsg { margin: 0; font-size: var(--fs-xs); color: var(--accent); font-weight: 600; }
  .syncmsg.bad { color: var(--warn); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
