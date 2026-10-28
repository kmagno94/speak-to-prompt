<script>
  /* The trip at a glance: Speak, Answer, Copy. Reads where the page is from what's on
     screen (the questions card, the result card, the build tracker), so app.js needs no
     extra wiring. Each step has a number or a check, a word, and a short line, so it
     never relies on color alone. */
  import { onMount } from 'svelte';
  import { ui } from './lib/ui.svelte.js';

  let stage = $state('speak');   // speak | answer | copy
  let busy = $state(false);

  function read() {
    const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden; };
    const ready = vis('result') && !!document.getElementById('madeBy')?.textContent.trim();
    busy = !ready && (vis('buildTrack') || vis('resultTrack'));
    if (ready || (vis('result') && !vis('resultTrack'))) stage = 'copy';
    else if (vis('qa')) stage = 'answer';
    else if (busy) stage = ui.mode === 'quick' ? 'copy' : 'answer';
    else if (vis('result')) stage = 'copy';
    else stage = 'speak';
  }

  onMount(() => {
    read();
    const mo = new MutationObserver(read);
    for (const id of ['qa', 'result', 'buildTrack', 'resultTrack']) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] }); }
    const made = document.getElementById('madeBy'); if (made) mo.observe(made, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  });

  const order = ['speak', 'answer', 'copy'];
  const skipAnswer = $derived(ui.mode === 'quick' && stage !== 'speak');
  const steps = $derived([
    { key: 'speak', n: 1, word: 'Speak', line: 'Say it messy' },
    { key: 'answer', n: 2, word: 'Answer', line: skipAnswer ? 'Skipped in Quick' : stage === 'answer' && busy ? 'Reading your thoughts…' : 'A few quick taps' },
    { key: 'copy', n: 3, word: 'Copy', line: stage === 'copy' && busy ? 'Writing your prompt…' : 'Take it to any AI' }
  ]);
  const at = $derived(order.indexOf(stage));
  const stepState = (s, i) => (s.key === 'answer' && skipAnswer ? 'skip' : i < at ? 'done' : i === at ? 'now' : 'next');
</script>

<nav class="journey" aria-label="Your progress" style="--p: {at / 2}">
  <ol>
    {#each steps as s, i (s.key)}
      {@const st = stepState(s, i)}
      <li class={st} aria-current={st === 'now' ? 'step' : undefined}>
        <span class="dot" aria-hidden="true">{st === 'done' ? '✓' : st === 'skip' ? '–' : s.n}</span>
        <span class="word">{s.word}<span class="sr">{st === 'done' ? ', done' : st === 'now' ? ', you are here' : st === 'skip' ? ', skipped' : ''}</span></span>
        <span class="line">{s.line}</span>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .journey { position: relative; }
  ol { position: relative; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-2); }
  /* The trail: a dashed path between the stops, inked in as you go. */
  ol::before, ol::after { content: ''; position: absolute; top: 15px; left: calc(100% / 6); right: calc(100% / 6); height: 2px; }
  ol::before { background: repeating-linear-gradient(to right, var(--line) 0 6px, transparent 6px 11px); }
  ol::after { background: var(--accent); transform-origin: left center; transform: scaleX(var(--p)); transition: transform var(--dur-slow) var(--ease); }
  li { position: relative; z-index: 1; display: grid; justify-items: center; text-align: center; gap: 2px; min-width: 0; }
  .dot {
    width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 4px;
    font-weight: 800; font-size: var(--fs-sm); background: var(--bg); color: var(--muted); border: 2px solid var(--line);
    transition: transform var(--dur) var(--ease);
  }
  .word { font-family: var(--display); font-weight: 600; font-size: var(--fs-sm); color: var(--muted); }
  .line { font-size: var(--fs-xs); color: var(--muted); line-height: 1.3; overflow-wrap: anywhere; }
  .now .dot { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); transform: scale(1.08); box-shadow: 0 0 0 5px var(--accent-soft); }
  .now .word { color: var(--ink); font-weight: 700; }
  .now .line { color: var(--ink); }
  .done .dot { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
  .done .word { color: var(--ink); }
  .skip .dot { border-style: dashed; }
  .skip .word, .skip .line { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--muted) 60%, transparent); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
