<script>
  /* Writer's block nudge: after the box sits still for a few seconds with some words in
     it, one sentence to finish shows up. Tap it to start that line, 🎲 for another,
     ✕ to stop them for this visit. Typing hides it right away. Lines: lib/stuck.js. */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { assess } from './lib/coach.js';
  import { lineOrder, IDLE_MS } from './lib/stuck.js';
  import { ms } from './lib/motion.js';

  let show = $state(false);
  let lines = $state([]);
  let at = $state(0);
  let off = false;      // ✕ tapped: no more nudges until the page reloads
  let timer = null;
  let box;

  function busy() { const b = document.getElementById('build'); return !b || b.disabled; }
  function wait() {
    clearTimeout(timer);
    show = false;
    if (off || !box.value.trim()) return;
    timer = setTimeout(() => {
      if (off || busy() || !box.value.trim()) return;
      const a = assess(box.value);
      lines = lineOrder(box.value, a.checks.filter((c) => !c.hit).map((c) => c.key));
      at = 0;
      show = lines.length > 0;
    }, IDLE_MS);
  }
  function stop() { clearTimeout(timer); show = false; }

  onMount(() => {
    box = document.getElementById('thoughts');
    const form = document.getElementById('form');
    box.addEventListener('input', wait);
    form.addEventListener('submit', stop);
    return () => { clearTimeout(timer); box.removeEventListener('input', wait); form.removeEventListener('submit', stop); };
  });

  /* Start a new line with the sentence and put the cursor after it. */
  function use() {
    const v = box.value.replace(/\s+$/, '');
    box.value = (v ? v + '\n' : '') + lines[at].text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
  function another() { at = (at + 1) % lines.length; }
  function close() { off = true; stop(); }
</script>

{#if show}
  <div class="stuck" id="stuck" role="group" aria-label="Stuck? Finish this sentence" transition:slide={{ duration: ms(200) }}>
    <span class="lbl">✍️ Stuck? Finish this:</span>
    <button type="button" class="line" id="stuckLine" onclick={use}>{lines[at].text.trim()} …</button>
    <button type="button" class="mini" id="stuckNext" onclick={another} aria-label="Another sentence">🎲</button>
    <button type="button" class="mini" id="stuckClose" onclick={close} aria-label="No more of these">✕</button>
  </div>
{/if}

<style>
  .stuck { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
  .lbl { font-size: 14px; font-weight: 600; color: var(--muted); width: 100%; }
  .line { flex: 1 1 auto; min-height: 44px; padding: 8px 14px; border-radius: 999px; font-size: 15px; text-align: left;
    color: var(--accent); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .mini { min-height: 44px; min-width: 44px; padding: 0; border-radius: 999px; font-size: 16px; color: var(--muted); background: transparent; border: 1px solid var(--line); }
  .line:active, .mini:active { transform: scale(0.97); }
</style>
