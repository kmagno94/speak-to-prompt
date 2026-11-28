<script>
  /* In-app browser rescue (AGT-147): the first thing on the page when it opens inside
     Instagram, Facebook, TikTok, or Snapchat. Says what may break, shows the two taps that
     open it in a real browser, and gets out of the way with Continue here anyway.
     State and detection: lib/inapp.svelte.js. Start here waits behind it and plays after. */
  import { slide } from 'svelte/transition';
  import { inApp } from './lib/inapp.svelte.js';
  import { startHere } from './lib/starthere.svelte.js';
  import { ms } from './lib/motion.js';
</script>

{#if inApp.show}
  <aside class="inapp" id="inApp" aria-labelledby="inAppHead" transition:slide={{ duration: ms(250) }}>
    <h2 id="inAppHead">Open this in {inApp.browser}</h2>
    <p>You're in {inApp.app ? inApp.app + "'s" : "an app's"} built-in browser. The mic, copying, and saving your key often don't work here.</p>
    <div class="pic" aria-hidden="true">
      <div class="bar"><span>✕</span><span class="addr"></span><b>⋯</b></div>
      <div class="menu"><span></span><b>Open in browser ↗</b><span></span></div>
    </div>
    <ol>
      <li>Tap <b>⋯</b> (or the menu button), usually in a top corner.</li>
      <li>Tap <b>Open in browser</b>. It may say <b>Open in external browser</b> or <b>Open in {inApp.browser === 'Safari or Chrome' ? 'Safari' : inApp.browser}</b>.</li>
    </ol>
    <button type="button" id="inAppStay" onclick={() => { inApp.carryOn(); startHere.resume(); }}>Continue here anyway</button>
  </aside>
{/if}

<style>
  .inapp { display: grid; gap: var(--sp-3); margin-bottom: var(--sp-4); padding: var(--sp-4); border-radius: var(--r-md); background: var(--accent-soft); border: 2px solid var(--accent); color: var(--ink); }
  h2 { margin: 0; font-family: var(--display); font-size: var(--fs-xl); line-height: 1.2; }
  p, ol { margin: 0; font-size: var(--fs-sm); line-height: 1.45; }
  ol { padding-left: 1.3em; display: grid; gap: 4px; }
  .pic { justify-self: center; width: min(100%, 280px); display: grid; gap: 6px; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: var(--r-sm); background: var(--surface); }
  .addr { flex: 1; height: 8px; border-radius: 4px; background: var(--line); }
  .bar b { padding: 0 8px; border-radius: var(--r-pill); border: 2px solid var(--accent); color: var(--accent); }
  .menu { justify-self: end; width: 75%; display: grid; gap: 6px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface); font-size: var(--fs-xs); }
  .menu span { height: 8px; width: 70%; border-radius: 4px; background: var(--line); }
  .menu b { color: var(--accent); }
  button { min-height: 48px; font-weight: 700; color: var(--accent); }
  /* Short phones (iPhone SE): the drawing goes so Continue here anyway stays on the first screen. */
  @media (max-height: 640px) { .pic { display: none; } }
</style>
