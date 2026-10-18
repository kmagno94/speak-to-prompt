<script>
  /* Ghost Coach: a Prompt Strength meter and up to two faint notes for what's
     missing, updated as you type. All on the phone (lib/coach.js), nothing sent. */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { assess, LEVELS } from './lib/coach.js';
  import { ms } from './lib/motion.js';

  let text = $state('');
  let box;

  const a = $derived(assess(text));
  const show = $derived(a.words >= 3);
  const missing = $derived(a.checks.filter((c) => !c.hit).slice(0, 2));
  const covered = $derived(a.checks.filter((c) => c.hit).map((c) => c.label));

  onMount(() => {
    box = document.getElementById('thoughts');
    const sync = () => { text = box.value; };
    box.addEventListener('input', sync);
    box.addEventListener('stp:changed', sync);   // app.js changed the box (paste, ideas, start over)
    sync();
    return () => { box.removeEventListener('input', sync); box.removeEventListener('stp:changed', sync); };
  });

  /* Tap a note: start a new line with its phrase and put the cursor after it. */
  function add(c) {
    const v = box.value.replace(/\s+$/, '');
    box.value = (v ? v + '\n' : '') + c.starter;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
</script>

{#if show}
  <div class="coach" id="coach" transition:slide={{ duration: ms(200) }}>
    <div class="top">
      <span class="name"><span aria-hidden="true">👻</span> Prompt strength</span>
      <span class="level" id="coachLevel" class:max={a.score === 5}>{LEVELS[a.score]}{a.score === 5 ? ' ✨' : ''}</span>
    </div>
    <div class="meter" role="meter" aria-label="Prompt strength" aria-valuemin="0" aria-valuemax="5"
         aria-valuenow={a.score} aria-valuetext="{a.score} of 5: {LEVELS[a.score]}{covered.length ? '. Has ' + covered.join(', ') : ''}">
      {#each [0, 1, 2, 3, 4] as i}<span class:on={i < a.score}></span>{/each}
    </div>
    {#if missing.length}
      <div class="notes" aria-label="Ideas to make it stronger">
        {#each missing as c (c.key)}
          <button type="button" class="note" data-key={c.key} onclick={() => add(c)} in:slide={{ duration: ms(160) }}>+ {c.note}</button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .coach { display: grid; gap: 8px; margin-top: 10px; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; }
  .name { color: var(--muted); font-weight: 600; }
  .level { font-weight: 700; color: var(--ink); transition: color 0.2s ease; }
  .level.max { color: var(--ok); }
  .meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .meter span { height: 6px; border-radius: 999px; background: var(--line); transition: background 0.25s ease; }
  .meter span.on { background: var(--accent); }
  .notes { display: flex; flex-wrap: wrap; gap: 6px; }
  .note { min-height: 0; padding: 6px 12px; border-radius: 999px; font-size: 14px; color: var(--muted); background: transparent; border: 1.5px dashed var(--line); }
  .note:active { transform: scale(0.97); }
  @media (prefers-reduced-motion: reduce) { .meter span, .level { transition: none; } }
</style>
