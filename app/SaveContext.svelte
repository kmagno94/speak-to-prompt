<script>
  /* Save as context, the sheet (#50, v2.1.37, SPEC LOCKED 11/08): the guided interview, the
     finished piece, and the overlap screen (old vs new with Update, Keep both, Skip), which
     Bring in uses too. All the thinking lives in lib/savectx.svelte.js; this only draws it.
     One question at a time, no cap, and Save what we have is always on screen. Nothing is
     saved until Save, and then only the way every My context piece is: in this tab, and on
     this phone only when Save on this phone is on. */
  import { tick } from 'svelte';
  import { savectx, PARTS } from './lib/savectx.svelte.js';
  import { context, CAP } from './lib/context.svelte.js';

  let dialog = $state();
  const n = (x) => x.toLocaleString('en-US');
  /* The sheet follows savectx.open (app.js and the nudge open it; Close and Done shut it). */
  $effect(() => {
    if (!dialog) return;
    if (savectx.open && !dialog.open) dialog.showModal();
    else if (!savectx.open && dialog.open) dialog.close();
  });
  /* While it's up, the floating 💡 and 🧪 buttons tuck away. */
  $effect(() => {
    document.body.classList.toggle('fabs-away-ctx', savectx.open);
    return () => document.body.classList.remove('fabs-away-ctx');
  });
  /* A new question puts the cursor in the answer box. */
  $effect(() => {
    if (savectx.stage !== 'ask' || !savectx.question) return;
    savectx.question.text;
    tick().then(() => dialog?.querySelector('#ctxAnswer')?.focus({ preventScroll: true }));
  });
  const close = () => savectx.close();
  const asked = $derived(savectx.turns.length);
  const working = $derived(savectx.stage === 'thinking' || savectx.stage === 'ironing');
  const keys = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); savectx.reply(false); } };
  const doneLine = $derived.by(() => {
    const t = savectx.tally;
    if (savectx.from !== 'bringin') return t.updated ? 'Updated your piece with the new words.' : 'Saved to My context.';
    const bits = [t.added && t.added + ' added', t.updated && t.updated + ' updated', t.both && t.both + ' kept as a second piece', t.skipped && t.skipped + ' left as it was', t.same && t.same + ' already here'].filter(Boolean);
    return 'Brought in: ' + bits.join(', ') + '.';
  });
</script>

<dialog class="savectx" id="saveCtx" bind:this={dialog} oncancel={(e) => { e.preventDefault(); close(); }} aria-labelledby="saveCtxTitle">
  {#if savectx.open}
    <div class="sheet">
      <div class="top">
        <h2 id="saveCtxTitle">{savectx.stage === 'overlap' ? 'You already have this one' : savectx.stage === 'done' ? 'All set' : '🧱 Save as context'}</h2>
        <button type="button" class="x" id="saveCtxClose" aria-label="Close" onclick={close}>✕</button>
      </div>

      {#if savectx.stage === 'ask' || working}
        <p class="intro">A few quick questions, one at a time. Then it's saved as a My context piece you can pick for any prompt, so you never explain it again.</p>
        <label class="lbl" for="ctxTitleIn">Title</label>
        <input id="ctxTitleIn" class="titlein" maxlength="60" placeholder="Like Bean N Bean roasting" bind:value={savectx.title}>
        <div class="covered" id="ctxCovered" aria-label="Covered so far">
          <span class="chead">Covered so far</span>
          <ul>
            {#each PARTS as p (p.key)}
              <li class:on={savectx.covered.includes(p.key)} data-part={p.key}><i aria-hidden="true">{savectx.covered.includes(p.key) ? '✓' : '○'}</i> {p.label}<span class="sr">{savectx.covered.includes(p.key) ? ' (covered)' : ' (not yet)'}</span></li>
            {/each}
          </ul>
        </div>
        {#if savectx.stage === 'thinking'}
          <p class="work" id="ctxWorking" role="status">{asked ? 'Checking what is still missing...' : 'Reading what you already said...'}</p>
        {:else if savectx.stage === 'ironing'}
          <p class="work" id="ctxWorking" role="status">Ironing it into a clean note...</p>
        {:else if savectx.question}
          <div class="qa">
            <label class="q" id="ctxQuestion" for="ctxAnswer">{savectx.question.text}</label>
            <textarea id="ctxAnswer" rows="4" maxlength="2000" placeholder="Messy is fine." bind:value={savectx.answer} onkeydown={keys}></textarea>
            {#if savectx.error}<p class="err" role="alert">{savectx.error}</p>{/if}
            <div class="row2">
              <button type="button" class="primary" id="ctxNext" disabled={!savectx.answer.trim()} onclick={() => savectx.reply(false)}>Next</button>
              <button type="button" id="ctxSkip" onclick={() => savectx.reply(true)}>Skip this one</button>
            </div>
          </div>
        {/if}
        <div class="foot">
          <button type="button" class="savenow" id="ctxSaveNow" disabled={savectx.stage === 'ironing' || !savectx.hasWords} onclick={() => savectx.finish()}>Save what we have</button>
          <small>{asked ? `${asked} answered or skipped so far. ` : ''}No limit on questions: it stops when nothing important is missing.</small>
        </div>

      {:else if savectx.stage === 'review'}
        <p class="intro">{savectx.ironed === 'ai' ? 'Here it is, cleaned up from only what you said. Change anything, then save.' : 'Here it is, in your own words. Change anything, then save.'}</p>
        <label class="lbl" for="ctxTitleIn">Title</label>
        <input id="ctxTitleIn" class="titlein" maxlength="60" placeholder="Like Bean N Bean roasting" bind:value={savectx.title}>
        <label class="lbl" for="ctxPiece">Your context</label>
        <textarea id="ctxPiece" class="piece" rows="12" maxlength="6000" bind:value={savectx.text}></textarea>
        <p class="size" class:over={savectx.text.trim().length > CAP} id="ctxPieceSize">{n(savectx.text.trim().length)} / {n(CAP)} characters</p>
        {#if savectx.error}<p class="err" role="alert">{savectx.error}</p>{/if}
        <div class="row2">
          <button type="button" class="primary" id="ctxSave" onclick={() => savectx.save()}>Save to My context</button>
          <button type="button" id="ctxCancel" onclick={close}>Don't save</button>
        </div>

      {:else if savectx.stage === 'overlap' && savectx.conflict}
        <p class="intro" id="ctxOverlapLine">
          {#if savectx.from === 'bringin'}“{savectx.conflict.title}” is already here with different words{savectx.conflicts.length > 1 ? ` (${savectx.at + 1} of ${savectx.conflicts.length})` : ''}. Nothing has been changed. Pick what to keep.
          {:else}This looks a lot like “{savectx.conflict.title}”, which you already saved. Nothing has been changed. Pick what to keep.{/if}
        </p>
        <div class="versus">
          <div class="side"><span class="tag">Already here</span><pre id="ctxOld">{savectx.conflict.old.trim()}</pre></div>
          <div class="side new"><span class="tag">New</span><pre id="ctxNew">{savectx.conflict.text.trim()}</pre></div>
        </div>
        <div class="row3">
          <button type="button" class="primary" id="ctxUpdate" onclick={() => savectx.settle('update')}>Update<small>replace the old words</small></button>
          <button type="button" id="ctxBoth" onclick={() => savectx.settle('both')}>Keep both<small>save the new one too</small></button>
          <button type="button" id="ctxSkipOverlap" onclick={() => savectx.settle('skip')}>Skip<small>leave it as it was</small></button>
        </div>

      {:else if savectx.stage === 'done'}
        <p class="ok" id="ctxDoneLine" role="status">✓ {doneLine}</p>
        {#if savectx.from !== 'bringin'}
          <p class="intro">{savectx.pickedNow ? 'It is picked for your next prompt.' : 'It will be picked for your next prompt when you tap New prompt.'} Find it any time under My context.</p>
        {/if}
        <!-- The same Save on this phone switch as the My context editor: pieces only stay on the phone when it's on. -->
        <label class="keepsw" for="ctxKeepHere">
          <input type="checkbox" id="ctxKeepHere" checked={context.keep} onchange={(e) => context.setKeep(e.currentTarget.checked)}>
          <span><b>Save on this phone</b><small>{context.keep ? 'On: saved in this browser on this phone only. Turn off to delete your pieces from this phone.' : 'Off right now, so your pieces go away when you close or refresh. Turn on to keep them on this phone only.'}</small></span>
        </label>
        <button type="button" class="primary" id="ctxDone" onclick={close}>Done</button>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .savectx { border: 0; padding: 0; margin: auto; width: min(560px, calc(100% - 24px)); max-height: calc(100dvh - 24px); border-radius: 18px; background: var(--surface); color: var(--ink); box-shadow: 0 24px 60px -20px rgba(10, 20, 40, 0.55); }
  .savectx::backdrop { background: color-mix(in srgb, #0b1420 55%, transparent); }
  .sheet { max-height: calc(100dvh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 20px 18px 18px; display: grid; gap: 12px; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { font-family: var(--display); font-size: 24px; line-height: 1.15; letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
  .x { min-height: 40px; min-width: 40px; padding: 0; border-radius: 999px; border: 0; background: var(--bg); color: var(--muted); font-size: 16px; flex: none; }
  .intro { margin: 0; color: var(--muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .lbl { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); font-family: var(--body); margin-bottom: -6px; }
  .titlein { font: inherit; font-weight: 700; font-size: 16px; color: var(--ink); background: var(--bg); width: 100%; min-height: var(--tap); padding: var(--sp-2) var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-sm); }
  textarea { font: inherit; font-size: 16px; line-height: 1.5; background: var(--bg); padding: var(--sp-2) var(--sp-3); }
  .titlein:focus-visible, textarea:focus-visible, .x:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .covered { display: grid; gap: 6px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--bg); }
  .chead { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
  .covered ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .covered li { font-size: var(--fs-sm); color: var(--muted); }
  .covered li i { font-style: normal; display: inline-block; width: 1.1em; }
  .covered li.on { color: var(--ok); font-weight: 700; }
  .qa { display: grid; gap: var(--sp-2); }
  .q { font-family: var(--display); font-weight: 600; font-size: var(--fs-md); line-height: 1.35; }
  .work { margin: 0; padding: var(--sp-4) 0; font-weight: 600; color: var(--accent); }
  .err { margin: 0; font-size: var(--fs-sm); color: var(--warn); font-weight: 700; }
  .row2 { display: grid; grid-template-columns: 1fr auto; gap: var(--sp-2); }
  .row3 { display: grid; gap: var(--sp-2); }
  .row3 button { display: grid; gap: 2px; justify-items: start; text-align: left; font-weight: 700; }
  .row3 small { font-weight: 500; font-size: var(--fs-xs); opacity: 0.85; }
  .foot { display: grid; gap: 4px; padding-top: var(--sp-3); border-top: 1px solid var(--line); }
  .foot small { font-size: var(--fs-xs); color: var(--muted); }
  .savenow { font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; border-radius: var(--r-pill); }
  .savenow:disabled { opacity: 0.55; }
  .piece { min-height: 220px; }
  .size { margin: -6px 0 0; font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; }
  .size.over { color: var(--warn); font-weight: 700; }
  .versus { display: grid; gap: var(--sp-2); }
  .side { display: grid; gap: 4px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--bg); min-width: 0; }
  .side.new { border-color: var(--accent); }
  .tag { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
  .side.new .tag { color: var(--accent); }
  pre { margin: 0; font: inherit; font-size: var(--fs-sm); line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 28dvh; overflow-y: auto; }
  .ok { margin: 0; font-weight: 700; color: var(--ok); }
  .hint { margin: 0; font-size: var(--fs-xs); color: var(--muted); }
  .keepsw { display: flex; flex-direction: row; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); background: var(--accent-soft); cursor: pointer; font-family: var(--body); font-size: var(--fs-sm); font-weight: 400; }
  .keepsw input { width: 22px; height: 22px; margin-top: 2px; flex: none; accent-color: var(--accent); }
  .keepsw span { display: grid; gap: 2px; }
  .keepsw small { font-size: var(--fs-xs); color: var(--muted); line-height: 1.4; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (min-width: 560px) { .versus { grid-template-columns: 1fr 1fr; } .row3 { grid-template-columns: repeat(3, 1fr); } }
  @media (prefers-reduced-motion: no-preference) {
    .savectx[open] { animation: ctxrise 0.22s cubic-bezier(.2, .8, .2, 1); }
    @keyframes ctxrise { from { opacity: 0; transform: translateY(14px); } }
  }
</style>
