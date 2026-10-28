<script>
  /* Keyboard coach bar (Build 4, idea mvs6n2ke5751): while you type in the thoughts box with
     the on-screen keyboard up, the Ghost Coach and the Stuck? nudge would be under the
     keyboard. This slim bar sits right on top of the keyboard instead: the strength meter,
     plus one tap-to-add chip (the nudge if it's showing, else the coach's top tip).
     Taps don't take the cursor out of the box, so the keyboard stays up. Close the keyboard
     and the bar goes; the coach and nudge are back under the box. Nothing saved or sent. */
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { kb } from './lib/keyboard.svelte.js';
  import { stuck, addLine } from './lib/stuck.svelte.js';
  import { assess, LEVELS } from './lib/coach.js';
  import { ms } from './lib/motion.js';

  let text = $state('');
  let box;
  onMount(() => {
    box = document.getElementById('thoughts');
    const sync = () => { text = box.value; };
    box.addEventListener('input', sync);
    box.addEventListener('stp:changed', sync);
    sync();
    return () => { box.removeEventListener('input', sync); box.removeEventListener('stp:changed', sync); };
  });

  const a = $derived(assess(text));
  const tip = $derived(a.checks.find((c) => !c.hit) || null);
  const show = $derived(kb.open && kb.typing && (a.words >= 3 || stuck.show));
  /* The bar keeps the cursor in the box: no focus change on press. */
  const keep = (e) => e.preventDefault();
  /* The floating 💡 / 🧪 buttons tuck away while the bar is up, so they never cover it. */
  $effect(() => {
    document.body.classList.toggle('fabs-away-kb', show);
    return () => document.body.classList.remove('fabs-away-kb');
  });
</script>

{#if show}
  <div class="kbcoach" id="kbCoach" role="group" aria-label="Prompt coach" style="bottom: {kb.inset}px" transition:fly={{ y: 20, duration: ms(180) }}>
    <div class="meter" role="meter" aria-label="Prompt strength" aria-valuemin="0" aria-valuemax="5" aria-valuenow={a.score} aria-valuetext="{a.score} of 5: {LEVELS[a.score]}">
      <span class="ghost" aria-hidden="true">👻</span>
      <span class="bars" aria-hidden="true">{#each [0, 1, 2, 3, 4] as i}<i class:on={i < a.score}></i>{/each}</span>
      <b class="lvl">{LEVELS[a.score]}</b>
    </div>
    {#if stuck.show && stuck.line}
      <button type="button" class="kbchip nudge" id="kbNudge" onpointerdown={keep} onmousedown={keep} onclick={() => stuck.use()}>✍️ {stuck.line.text.trim()} …</button>
      <button type="button" class="mini" id="kbNext" onpointerdown={keep} onmousedown={keep} onclick={() => stuck.another()} aria-label="Another sentence">🎲</button>
    {:else if tip}
      <button type="button" class="kbchip" id="kbTip" onpointerdown={keep} onmousedown={keep} onclick={() => addLine(box, tip.starter)}>+ {tip.note}</button>
    {/if}
  </div>
{/if}

<style>
  .kbcoach {
    position: fixed; left: 0; right: 0; z-index: 30;
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    -webkit-backdrop-filter: blur(12px) saturate(140%); backdrop-filter: blur(12px) saturate(140%);
    border-top: 1px solid var(--line); box-shadow: 0 -8px 24px -14px color-mix(in srgb, var(--ink) 40%, transparent);
  }
  .meter { flex: none; display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; column-gap: 6px; align-items: center; }
  .ghost { grid-row: 1 / 3; font-size: 18px; }
  .bars { display: grid; grid-template-columns: repeat(5, 9px); gap: 2px; }
  .bars i { height: 5px; border-radius: 999px; background: var(--line); }
  .bars i.on { background: var(--accent); }
  .lvl { font-size: 11px; color: var(--muted); white-space: nowrap; }
  .kbchip { flex: 1 1 auto; min-width: 0; min-height: 40px; padding: 6px 12px; border-radius: 18px; font-size: 14px; line-height: 1.25; text-align: left;
    color: var(--muted); background: transparent; border: 1.5px dashed var(--line); }
  .kbchip.nudge { color: var(--accent); background: var(--accent-soft); border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .mini { flex: none; min-height: 40px; min-width: 40px; padding: 0; border-radius: 999px; font-size: 15px; background: transparent; border: 1px solid var(--line); }
  @media (prefers-reduced-motion: no-preference) { .bars i { transition: background 0.25s ease; } }
</style>
