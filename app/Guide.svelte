<script>
  /* First-run guide: a bar along the bottom that walks a brand new person through
     their first prompt with the practice note, and glows around whatever to tap
     next: Paste, Build, a question, Copy. It reads the page as it goes, so it
     follows along whatever order things happen in. Skip anytime. */
  import { fly } from 'svelte/transition';
  import { guide } from './lib/guide.svelte.js';
  import { ms } from './lib/motion.js';

  const STEPS = ['paste', 'build', 'answer', 'copy'];
  let stage = $state('paste');
  let copiedPrompt = false;
  let lastTarget = null;

  const el = (id) => document.getElementById(id);
  function visible(el) { return !!el && !el.hidden && el.offsetParent !== null; }

  function read() {
    if (copiedPrompt) return 'done';
    const result = el('result'), qa = el('qa'), build = el('build'), box = el('thoughts');
    if (visible(result) && el('madeBy') && el('madeBy').textContent.trim()) return 'copy';
    if (visible(qa) && document.querySelector('#qaList .chips button')) return 'answer';
    if (build && build.disabled) return 'wait';
    if (box && box.value.trim()) return 'build';
    return 'paste';
  }
  function targetFor(s) {
    if (s === 'paste') return visible(el('bannerPaste')) ? el('bannerPaste') : el('thoughts');
    return { build: el('build'), answer: el('qa'), copy: el('copy') }[s] || null;
  }
  function mark(s) {
    if (lastTarget) lastTarget.classList.remove('guide-target');
    lastTarget = targetFor(s);
    if (lastTarget) {
      lastTarget.classList.add('guide-target');
      lastTarget.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  $effect(() => {
    if (!guide.active) return;
    copiedPrompt = false; stage = 'paste';
    const onClick = (e) => { if (e.target.closest && e.target.closest('#copy, #copyAll')) copiedPrompt = true; };
    document.addEventListener('click', onClick, true);
    let doneTimer = 0;
    const tick = setInterval(() => {
      const s = read();
      if (s === stage) return;
      stage = s;
      mark(s);
      if (s === 'done') doneTimer = setTimeout(end, 9000);
    }, 300);
    mark('paste');
    return () => { clearInterval(tick); clearTimeout(doneTimer); document.removeEventListener('click', onClick, true); if (lastTarget) lastTarget.classList.remove('guide-target'); lastTarget = null; };
  });

  function end() { guide.stop(); }
  const at = $derived(Math.max(0, STEPS.indexOf(stage === 'wait' ? 'build' : stage === 'done' ? 'copy' : stage)));
  const text = $derived({
    paste: guide.copied
      ? 'Your practice note is copied. Tap 📋 Paste above the box. (Or press and hold inside the box, then tap Paste.)'
      : 'Your practice note is in the box. Read it over: messy is fine.',
    build: 'That\'s a messy note, and that\'s fine. Now tap Build my prompt.',
    wait: 'Reading your note and figuring out what\'s missing...',
    answer: 'Answer with a tap. Pick whatever fits, it\'s just practice. Then keep going.',
    copy: 'Here\'s your prompt! Tap Copy prompt, then open ChatGPT, Claude, or Gemini and paste it.',
    done: '🎉 That\'s it. Next time, use your own messy thoughts.'
  }[stage]);
</script>

{#if guide.active}
  <div class="guide" id="guide" role="status" aria-live="polite" transition:fly={{ y: 40, duration: ms(220) }}>
    <div class="row">
      <span class="steps" aria-label="Step {at + 1} of 4">{#each STEPS as s, i}<i class:on={i <= at} class:now={i === at && stage !== 'done'}></i>{/each}</span>
      <button type="button" class="skip" id="guideSkip" onclick={end}>{stage === 'done' ? 'Done' : 'Skip'}</button>
    </div>
    <p id="guideText">{text}</p>
  </div>
{/if}

<style>
  .guide { position: fixed; z-index: 30; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); max-width: 560px; margin: 0 auto;
    display: grid; gap: 6px; padding: 12px 14px; border-radius: 16px; background: var(--ink); color: var(--surface);
    box-shadow: 0 16px 40px -14px rgba(10, 20, 40, 0.6); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .steps { display: inline-flex; gap: 5px; }
  .steps i { width: 22px; height: 5px; border-radius: 999px; background: color-mix(in srgb, var(--surface) 25%, transparent); }
  .steps i.on { background: var(--accent-soft); }
  .steps i.now { background: var(--record); }
  p { margin: 0; font-size: 15px; line-height: 1.45; }
  .skip { min-height: 32px; padding: 4px 12px; border-radius: 999px; border: 0; background: color-mix(in srgb, var(--surface) 15%, transparent); color: var(--surface); font-size: 13px; font-weight: 700; }
  /* The glow around whatever to tap next. */
  :global(.guide-target) { outline: 3px solid var(--record) !important; outline-offset: 3px; border-radius: 12px; }
  @media (prefers-reduced-motion: no-preference) {
    :global(.guide-target) { animation: guidepulse 1.6s ease-in-out infinite; }
    @keyframes guidepulse { 50% { outline-color: color-mix(in srgb, var(--record) 35%, transparent); } }
  }
</style>
