<script>
  /* First time? Start here: a short walkthrough for brand new people. One real
     example travels through every step (messy note, Build, a question, the
     finished prompt), the way the app itself goes from loose scratchpad to clean
     index card. "Try it with this example" drops that note into the real box,
     so the first run is guided instead of a blank page. Nothing is saved. */
  const SHORTCUT = 'https://www.icloud.com/shortcuts/391f35e4646d443e92a73e098e0e559b';
  const EXAMPLE = "ok so my mom's birthday is saturday, like 6 people, she hates spicy food, budget maybe $80, help me plan dinner at home lol";
  const PROMPT = 'You are a friendly home cooking planner. Plan a birthday dinner at home this Saturday for my mom and 6 guests. Nothing spicy. Keep the total around $80. Give me a menu, a shopping list with rough prices, and a simple cooking timeline.';

  /* The Talk it out shortcut only runs on iPhone and iPad. */
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  let dialog;
  export function open() {
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.sheet').scrollTop = 0;
  }
  function close() { dialog.close(); }

  function tryExample() {
    const box = document.getElementById('thoughts');
    box.value = EXAMPLE;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    close();
    box.scrollIntoView({ block: 'center' });
    box.focus();
  }
  function openKey() {
    close();
    const panel = document.getElementById('keyPanel');
    panel.open = true;
    panel.scrollIntoView({ block: 'start' });
  }
  /* Tap outside the sheet to close it. */
  function backdrop(e) { if (e.target === dialog) close(); }
</script>

<dialog class="tutorial" id="tutorial" bind:this={dialog} onclick={backdrop} aria-labelledby="tutTitle">
  <div class="sheet">
    <div class="top">
      <h2 id="tutTitle">New here? Here's the whole thing.</h2>
      <button type="button" class="x" id="tutClose" onclick={close} aria-label="Close">✕</button>
    </div>
    <p class="intro">You say what's on your mind, messy is fine. The app turns it into one clear prompt you paste into ChatGPT, Claude, or Gemini. Here's one example from start to finish.</p>

    {#if appleTouch}
    <a class="talk" id="tutShortcut" href={SHORTCUT} target="_blank" rel="noopener">
      <span class="dot" aria-hidden="true"></span>
      <span><b>Rather talk than type?</b><br>Get the free Talk it out shortcut</span>
    </a>
    {/if}

    <ol class="flow">
      <li>
        <h3>Dump it</h3>
        <p>Type or talk. No need to be clear or polite. Half sentences and "lol" are fine.</p>
        <div class="scratch" aria-label="Example note">{EXAMPLE}</div>
        <p class="aside">The strength meter under the box lights up as you add things like who it's for or a budget. Tap a faint note to add what's missing.</p>
      </li>
      <li>
        <h3>Tap Build my prompt</h3>
        <p>It reads your note and figures out what's missing. You'll see how long it usually takes.</p>
        <div class="mock build" aria-hidden="true">
          <span class="btn">Build my prompt</span>
          <span class="track"><i class="on">Read</i><i>Ask</i><i>Write</i><i>Ready</i></span>
        </div>
      </li>
      <li>
        <h3>Answer a quick question or two</h3>
        <p>Tap the answer that fits, or type your own. It only asks what would change the result.</p>
        <div class="mock ask" aria-hidden="true">
          <span class="bubble">What kind of dinner?</span>
          <span class="chips"><i class="on">Cozy and simple</i><i>Fancy</i><i>Not sure</i></span>
        </div>
        <p class="aside">Questions need a free Gemini key (about a minute). No key? You still get a quick prompt right away. <button type="button" class="inline" id="tutKey" onclick={openKey}>Set up my key</button></p>
      </li>
      <li>
        <h3>Copy it into any AI</h3>
        <p>Your messy note comes back as a clear prompt. Tap Copy, then open your AI and paste.</p>
        <div class="card" aria-label="Example prompt">{PROMPT}</div>
        <div class="mock ais" aria-hidden="true"><i>ChatGPT</i><i>Claude</i><i>Gemini</i></div>
      </li>
    </ol>

    <details class="extras">
      <summary>Extras you can skip for now</summary>
      <ul>
        <li><b>💡 Ideas</b> in the box: swipe for something to try.</li>
        <li><b>Not sure where to start?</b> Pick a goal and answer a few taps.</li>
        <li><b>X-ray</b> on your prompt: see which parts came from your words.</li>
        <li><b>Something went wrong?</b> Tap it and it tells us what broke. Never your words.</li>
      </ul>
    </details>

    <p class="safe">Nothing is saved. Close the tab and it's gone.</p>
    <div class="actions">
      <button type="button" class="primary" id="tutTry" onclick={tryExample}>Try it with this example</button>
      <button type="button" id="tutDone" onclick={close}>I'm ready</button>
    </div>
  </div>
</dialog>

<style>
  .tutorial { border: 0; padding: 0; margin: auto; width: min(560px, calc(100% - 24px)); max-height: calc(100dvh - 24px); border-radius: 18px; background: var(--surface); color: var(--ink); box-shadow: 0 24px 60px -20px rgba(10, 20, 40, 0.55); }
  .tutorial::backdrop { background: color-mix(in srgb, #0b1420 55%, transparent); }
  .sheet { max-height: calc(100dvh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 20px 18px 18px; display: grid; gap: 14px; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { font-family: var(--display); font-size: 26px; line-height: 1.1; letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
  .x { min-height: 40px; min-width: 40px; padding: 0; border-radius: 999px; border: 0; background: var(--bg); color: var(--muted); font-size: 16px; flex: none; }
  .intro { margin: 0; color: var(--muted); }

  /* Same red record dot as Talk it out, so it reads as the voice way in. */
  .talk { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); text-decoration: none; line-height: 1.35; }
  .talk b { color: var(--accent); }
  .dot { width: 24px; height: 24px; border-radius: 50%; flex: none; background: var(--record); box-shadow: 0 0 0 4px color-mix(in srgb, var(--record) 18%, transparent); }
  .talk:focus-visible, .x:focus-visible, .inline:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

  /* The four steps hang off one line, top to bottom, because they happen in order. */
  .flow { list-style: none; margin: 4px 0 0; padding: 0; counter-reset: step; display: grid; gap: 18px; }
  .flow li { counter-increment: step; position: relative; padding-left: 44px; display: grid; gap: 8px; }
  .flow li::before { content: counter(step); position: absolute; left: 0; top: -2px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-family: var(--display); font-weight: 700; font-size: 15px; background: var(--accent-soft); color: var(--accent); }
  .flow li:not(:last-child)::after { content: ""; position: absolute; left: 14px; top: 34px; bottom: -16px; width: 2px; background: var(--line); }
  h3 { font-family: var(--display); font-size: 18px; margin: 2px 0 0; }
  .flow p { margin: 0; }
  .aside { font-size: 14px; color: var(--muted); }

  /* Loose scratchpad in... */
  .scratch { font-size: 15px; line-height: 1.5; padding: 12px 14px; border-radius: 12px; background: var(--bg); border: 1.5px dashed var(--line); color: var(--ink); transform: rotate(-0.8deg); }
  /* ...clean index card out. */
  .card { font-size: 15px; line-height: 1.6; padding: 12px 14px 12px 18px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent);
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.6em - 1px), var(--rule) calc(1.6em - 1px), var(--rule) 1.6em); background-position: 0 12px; }

  .mock { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; }
  .mock i { font-style: normal; }
  .btn { background: var(--accent); color: var(--accent-ink); font-weight: 700; border-radius: 12px; padding: 8px 14px; }
  .track { display: inline-flex; gap: 4px; }
  .track i { padding: 4px 8px; border-radius: 999px; background: var(--bg); color: var(--muted); }
  .track i.on { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
  .ask { flex-direction: column; align-items: flex-start; }
  .bubble { background: var(--bubble); border-radius: 14px 14px 14px 4px; padding: 8px 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips i, .ais i { padding: 5px 12px; border-radius: 999px; border: 1.5px solid var(--line); }
  .chips i.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .ais i { color: var(--accent); font-weight: 700; }
  .inline { min-height: 0; padding: 0; border: 0; background: none; color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; font-size: inherit; }

  .extras { border-top: 1px solid var(--line); padding-top: 10px; }
  .extras summary { cursor: pointer; font-weight: 700; color: var(--muted); }
  .extras ul { margin: 8px 0 0; padding-left: 18px; display: grid; gap: 4px; font-size: 15px; }
  .safe { margin: 0; font-size: 14px; color: var(--ok); font-weight: 700; }
  .actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; position: sticky; bottom: -18px; background: var(--surface); padding: 10px 0 2px; }
  @media (max-width: 379px) { .actions { grid-template-columns: 1fr; } }

  @media (prefers-reduced-motion: no-preference) {
    .tutorial[open] { animation: rise 0.22s cubic-bezier(.2, .8, .2, 1); }
    @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  }
</style>
