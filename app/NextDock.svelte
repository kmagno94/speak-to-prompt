<script>
  /* Next step dock (#17, spec locked 10/28, with the #28 motion kit). A floating pill at the
     bottom that holds the one button you need right now, and it's the only place that button
     lives:
       - Writing your thoughts: Build my prompt sits right under the box (#build, in the form),
         and joins the dock (#dockBuild) only once you scroll past it, so it's never on screen
         twice (Kevin, 10/28). No ⋯ here, nothing to start over yet.
       - Questions: Write my prompt (N of 3), which works at 0 of 3. ⋯ has Quick version
         (the faster, lighter write) and New prompt.
       - Result: Copy prompt. ⋯ has Open in ChatGPT, Claude, Gemini, and New prompt.
     Change your words (or Quick or Normal, Use my core, My context) after a build and the next
     step is to build again. On a finished prompt that's the 'redo' moment: Copy prompt stays
     (so an accidental word never takes it away) next to Rebuild, and ⋯ still has Open in and
     New prompt (Kevin, 10/28).
     Always on, on every screen. It tucks away while the keyboard is up (it fades back in at
     150ms when the keyboard closes), and while X-ray, the Tutorial, or a panel is open.
     These are the real buttons app.js wires up by id (build, copy, reset, the .openrow links),
     so they stay in the page the whole time; only the moment decides which ones show.
     New prompt (#19) shows a 6 second Undo just above the dock (or the keyboard) that brings
     everything back: your words, and the questions or the finished prompt (app.js keeps that
     snapshot and restores it on "stp-undo"). In memory only.
     Ctrl or ⌘ + Enter in the box builds (#27), for iPad keyboards and computers. */
  import { onMount } from 'svelte';
  import { kb } from './lib/keyboard.svelte.js';
  import { chat } from './lib/chat.svelte.js';
  import { xray } from './lib/xray.svelte.js';
  import { ideas } from './lib/ideas.svelte.js';
  import { lab } from './lib/testlab.svelte.js';
  import { context } from './lib/context.svelte.js';

  let moment = $state('input');   // 'input' | 'qa' | 'result' | 'redo' (words changed on a finished prompt)
  let inlineSeen = $state(true);  // the Build my prompt under the box isn't scrolled past yet
  let busy = $state(false), busyLabel = $state('');   // mirrors the inline Build (app.js sets its text and disabled)
  let menu = $state(false);       // the ⋯ menu
  let tutorial = $state(false);   // the First time? Start here sheet is open
  let more, sheet;
  let undo = $state(null);        // { at } for 6 seconds after New prompt; the snapshot itself lives in app.js
  let undoTimer = 0;
  const UNDO_MS = 6000;

  const away = $derived(kb.open || xray.open || tutorial || ideas.open || lab.open || context.open);
  const building = $derived(moment === 'input' || moment === 'redo');   // the next step is Build
  const showBuild = $derived(building && !inlineSeen);
  const showCopy = $derived(moment === 'result' || moment === 'redo');
  /* Nothing to show: the box is in view with its own Build under it. The pill steps aside but the
     page keeps its bottom room, so nothing jumps while you scroll. */
  const idle = $derived(!showBuild && !showCopy && moment !== 'qa');
  const total = $derived(chat.questions.length);
  const answered = $derived(chat.answers.filter((a) => a).length);

  onMount(() => {
    const el = (id) => document.getElementById(id);
    const box = el('thoughts'), form = el('form'), result = el('result'), qa = el('qa'), tut = el('tutorial');
    /* After a Build, any change to what goes in (your words, Quick or Normal, Use my core,
       My context) means the next step is to build again, even with the same words. */
    let built = false, edited = false;
    const read = () => {
      moment = !result.hidden ? (edited ? 'redo' : 'result') : !edited && !qa.hidden ? 'qa' : 'input';
      tutorial = !!(tut && tut.open);
    };
    const onSubmit = () => { built = true; edited = false; queueMicrotask(read); };
    /* Deferred: a field removed while it has the cursor fires "change" in the middle of a redraw. */
    const onChange = (e) => { if (e.target === box || form.contains(e.target)) { if (built) edited = true; queueMicrotask(read); } };
    form.addEventListener('submit', onSubmit, true);
    form.addEventListener('input', onChange, true);
    form.addEventListener('change', onChange, true);
    box.addEventListener('stp:changed', onChange);
    const watch = new MutationObserver(read);
    [result, qa].forEach((n) => watch.observe(n, { attributes: true, attributeFilter: ['hidden'] }));
    if (tut) watch.observe(tut, { attributes: true, attributeFilter: ['open'] });
    read();

    /* Build my prompt under the box: shows only while Build is the next step, and the dock's
       copy of it shows only once you've scrolled past that one. */
    const inline = el('build');
    /* "Past" = scrolled up and out of view (its middle above the top edge). Below the fold at the
       start doesn't count: that's where you are, right at the box (Kevin, 10/28). */
    const seen = new IntersectionObserver(([e]) => { const r = e.boundingClientRect; inlineSeen = !(r.height && r.top + r.height / 2 < (e.rootBounds?.top || 0)); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    seen.observe(inline);
    inlineEl = inline;
    const mirror = () => { busy = inline.disabled; busyLabel = inline.textContent.trim(); };
    const mo = new MutationObserver(mirror);
    mo.observe(inline, { attributes: true, attributeFilter: ['disabled'], childList: true, characterData: true, subtree: true });
    mirror();
    stopContext = () => { if (built) { edited = true; queueMicrotask(read); } };

    /* New prompt: keep the words for 6 seconds, in memory only. This runs before app.js
       clears the box (a capture listener on the button itself). */
    const reset = el('reset');
    const snap = () => {
      const had = !!box.value.trim() || !result.hidden || !qa.hidden;
      built = false; edited = false;   /* back to the start */
      clearTimeout(undoTimer);
      undo = had ? { at: Date.now() } : null;
      if (undo) undoTimer = setTimeout(() => { undo = null; }, UNDO_MS);
    };
    reset.addEventListener('click', snap, true);
    /* After Undo the questions or prompt are back, so changing anything means build again. */
    /* Deferred until app.js has finished putting things back (that fires its own box events). */
    const undone = () => queueMicrotask(() => { built = true; edited = false; read(); });
    window.addEventListener('stp-undo', undone);
    /* Typing something new means you meant it: the Undo goes away. */
    const typed = () => { if (undo && box.value.trim()) { clearTimeout(undoTimer); undo = null; } };
    box.addEventListener('input', typed);
    /* Ctrl or ⌘ + Enter in the box builds, same as tapping Build my prompt. */
    const keys = (e) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing || e.target !== box) return;
      e.preventDefault();
      if (!el('build').disabled) form.requestSubmit();
    };
    document.addEventListener('keydown', keys);
    return () => {
      seen.disconnect(); mo.disconnect();
      reset.removeEventListener('click', snap, true); window.removeEventListener('stp-undo', undone); box.removeEventListener('input', typed); document.removeEventListener('keydown', keys);
      clearTimeout(undoTimer);
      watch.disconnect();
      form.removeEventListener('submit', onSubmit, true); form.removeEventListener('input', onChange, true); form.removeEventListener('change', onChange, true);
      box.removeEventListener('stp:changed', onChange);
    };
  });
  /* Picking a My context chip changes what goes in too. */
  let stopContext = null, lastPicks = null;
  let inlineEl = $state(null);
  $effect(() => { if (inlineEl) inlineEl.hidden = !building; });
  $effect(() => {
    const picks = context.picked.join(',');
    if (lastPicks !== null && picks !== lastPicks) stopContext?.();
    lastPicks = picks;
  });

  /* The page, the 💡 / 🧪 buttons and the Guide make room only while the dock shows. */
  $effect(() => {
    document.body.classList.toggle('dock-on', !away);
    return () => document.body.classList.remove('dock-on');
  });
  /* A new moment or tucking away closes the menu. */
  $effect(() => { moment; away; menu = false; });

  /* Close the menu on a tap outside it or Escape. */
  $effect(() => {
    if (!menu) return;
    const outside = (e) => { if (!sheet?.contains(e.target) && !more?.contains(e.target)) menu = false; };
    const esc = (e) => { if (e.key === 'Escape') { menu = false; more?.focus(); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc); };
  });
  /* Picking anything in the menu closes it, after the tap has done its job (app.js copies and
     the link opens first). */
  const picked = () => setTimeout(() => { menu = false; }, 0);
  function quick() { menu = false; chat.finish(true); }

  /* Undo: app.js puts back your words and whatever was on screen (questions or the prompt). */
  function undoReset() {
    if (!undo) return;
    clearTimeout(undoTimer);
    undo = null;
    window.dispatchEvent(new Event('stp-undo'));
  }
  /* The 💡 / 🧪 buttons slide up while the Undo shows, so nothing overlaps it. */
  $effect(() => {
    document.body.classList.toggle('undo-on', !!undo);
    return () => document.body.classList.remove('undo-on');
  });
  /* Above the keyboard when it's up, else above the dock (or the bottom edge when the dock is away). */
  const undoBottom = $derived(kb.open ? kb.inset + 12 + 'px' : away ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 'calc(var(--dock-lift) + 12px)');
</script>

{#if undo}
  {#key undo.at}
    <div class="undo" id="undoToast" role="status" aria-live="polite" style="bottom: {undoBottom}">
      <span>Prompt cleared</span>
      <button type="button" id="undoReset" onpointerdown={(e) => e.preventDefault()} onclick={undoReset}>Undo</button>
      <i class="tick" aria-hidden="true" style="animation-duration: {UNDO_MS}ms"></i>
    </div>
  {/key}
{/if}

<div class="dock" id="nextDock" class:away class:idle={idle && !away} data-moment={moment} role="group" aria-label="Next step" aria-hidden={away} inert={away}>
  <div class="sheet" id="dockMenu" bind:this={sheet} hidden={!menu || moment === 'input'} role="menu" aria-label="More">
    <div class="openrow" hidden={!showCopy}>
      <span class="ghead" id="dockOpenHead">Open in</span>
      <a class="openai" href="https://chatgpt.com/" target="_blank" rel="noopener" role="menuitem" onclick={picked}>ChatGPT</a>
      <a class="openai" href="https://claude.ai/new" target="_blank" rel="noopener" role="menuitem" onclick={picked}>Claude</a>
      <a class="openai" id="geminiLink" href="https://gemini.google.com/app" target="_blank" rel="noopener" role="menuitem" onclick={picked}>Gemini</a>
    </div>
    <div class="grp" hidden={moment !== 'qa'}>
      <span class="ghead">Write it now</span>
      <button type="button" id="qaSkip" role="menuitem" disabled={chat.busy} onclick={quick}>Quick version <small>faster, lighter</small></button>
    </div>
    <div class="grp">
      <span class="ghead">Start again</span>
      <button type="button" id="reset" role="menuitem" onclick={picked}>New prompt</button>
    </div>
  </div>

  <div class="bar">
    <button type="button" class="primary main copybig" class:alt={showBuild} id="copy" hidden={!showCopy}>Copy prompt</button>
    <button type="submit" form="form" class="primary main" id="dockBuild" hidden={!showBuild} disabled={busy}>{busy ? busyLabel : moment === 'redo' ? 'Rebuild' : 'Build my prompt'}</button>
    <button type="button" class="primary main" id="qaGo" hidden={moment !== 'qa'} disabled={chat.busy} onclick={() => chat.finish(false)}>Write my prompt{total ? ` (${answered} of ${total})` : ''}</button>
    <button type="button" class="more" id="dockMore" hidden={moment === 'input'} aria-haspopup="menu" aria-expanded={menu} aria-controls="dockMenu" aria-label="More" bind:this={more} onclick={() => (menu = !menu)}>⋯</button>
  </div>
</div>

<style>
  /* A floating pill on every screen: 16px from the edges on phones, centered (up to 480px) on
     iPad and computers, about 64px tall with 48px buttons, above the home bar. */
  .dock {
    position: fixed; z-index: 35;
    left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px));
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    max-width: 480px; margin: 0 auto;
    transition: opacity var(--dur-fast) var(--ease), translate var(--dur-fast) var(--ease);
  }
  .bar {
    display: flex; gap: 8px; padding: 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid var(--line);
    box-shadow: 0 14px 34px -16px color-mix(in srgb, var(--ink) 55%, transparent), 0 2px 8px -4px color-mix(in srgb, var(--ink) 25%, transparent);
  }
  /* Idle: the box and its Build are in view, so the pill steps aside (the page keeps its room). */
  .dock.idle { opacity: 0; translate: 0 calc(100% + 24px); pointer-events: none; visibility: hidden;
    transition: opacity var(--dur-fast) var(--ease), translate var(--dur-fast) var(--ease), visibility 0s linear var(--dur-fast); }
  /* Tucked away: slides down and fades out (Reduce Motion: it just goes). */
  .dock.away { opacity: 0; translate: 0 calc(100% + 24px); pointer-events: none; visibility: hidden;
    transition: opacity var(--dur-reveal) var(--ease), translate var(--dur-reveal) var(--ease), visibility 0s linear var(--dur-reveal); }

  .bar button { min-height: 48px; border-radius: 999px; }
  .bar button.main { flex: 1 1 auto; min-width: 0; padding: 8px 18px; font-size: var(--fs-md); font-family: var(--display); font-weight: 700; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: auto; }
  .bar button.main:disabled { opacity: 0.7; }
  /* Redo: Copy prompt (the prompt you already have) sits beside Rebuild as the lighter button. */
  .bar button.alt { flex: 0 1 auto; background: transparent; color: var(--accent); border: 1.5px solid var(--accent); box-shadow: none; padding: 8px 14px; }
  .bar button.alt + button.main { padding: 8px 14px; }
  .more { flex: none; width: 48px; padding: 0; font-size: 22px; line-height: 1; font-weight: 700; color: var(--ink); }
  .more[aria-expanded='true'] { background: var(--accent-soft); border-color: transparent; color: var(--accent); }

  /* The ⋯ menu opens above the pill, on the right. */
  .sheet {
    position: absolute; right: 0; bottom: calc(100% + 8px); width: min(280px, 100%);
    display: grid; gap: 4px; padding: 10px; border-radius: 18px;
    background: var(--surface); border: 1px solid var(--line);
    box-shadow: 0 18px 40px -16px color-mix(in srgb, var(--ink) 55%, transparent);
  }
  @media (prefers-reduced-motion: no-preference) {
    .sheet:not([hidden]) { animation: pop var(--dur-fast) var(--ease); transform-origin: bottom right; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
  }
  .sheet .openrow, .sheet .grp { display: grid; gap: 2px; }
  /* A line between the groups that show (the first one showing gets none). */
  .sheet > :not([hidden]) ~ .grp:not([hidden]) { border-top: 1px solid var(--line); padding-top: 6px; margin-top: 2px; }
  .ghead { flex-basis: auto; padding: 4px 10px 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  .sheet a, .sheet button {
    display: flex; align-items: baseline; gap: 8px; width: 100%; min-height: 48px; padding: 10px 12px; border-radius: 12px;
    border: 0; background: transparent; color: var(--ink); font-weight: 700; font-size: var(--fs-md); text-align: left; text-decoration: none;
  }
  .sheet a:hover, .sheet button:hover:not(:disabled) { background: var(--accent-soft); }
  .sheet small { font-weight: 400; font-size: var(--fs-xs); color: var(--muted); }

  /* The 6 second Undo after New prompt (#19): a small dark pill above the dock, centered. */
  .undo {
    position: fixed; z-index: 36; left: 50%; translate: -50% 0;
    display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 18px; border-radius: 999px; overflow: hidden;
    background: var(--ink); color: var(--surface); font-weight: 700; font-size: var(--fs-sm); white-space: nowrap;
    box-shadow: 0 14px 34px -14px color-mix(in srgb, var(--ink) 70%, transparent);
    transition: bottom var(--dur-reveal) var(--ease);
  }
  .undo button { min-height: 44px; padding: 6px 16px; border: 0; border-radius: 999px; background: transparent; color: var(--accent-soft); font-weight: 800; }
  .undo button:hover { background: color-mix(in srgb, var(--surface) 15%, transparent); }
  .undo .tick { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--accent-soft); transform-origin: left; opacity: 0.7; }
  @media (prefers-reduced-motion: no-preference) {
    .undo { animation: undoin var(--dur-reveal) var(--ease); }
    @keyframes undoin { from { opacity: 0; translate: -50% 12px; } }
    .undo .tick { animation: undotick linear forwards; }
    @keyframes undotick { to { transform: scaleX(0); } }
  }
</style>
