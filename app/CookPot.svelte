<script>
  /* Prompt cooking: a pot inside a progress ring, next to the timer. Your pieces drop in
     as ingredients, it simmers while Gemini works, boils over (then keeps going) when a
     model stalls and another takes over, and plates when it's done. Reads lib/cook.svelte.js.
     Reduce Motion: no movement, the ring and the words still change. */
  import { cook } from './lib/cook.svelte.js';
  let { place } = $props();

  const R = 30, C = 2 * Math.PI * R;
  let moment = $state('');   // 'boil' | 'back' for a few seconds, then back to simmering
  let seenSwitch = 0, seenBack = 0, tm = null;

  $effect(() => {
    const s = cook.switches, b = cook.back;
    if (cook.place !== place) return;
    if (s > seenSwitch) { seenSwitch = s; flash('boil', 3500); }
    else if (b > seenBack) { seenBack = b; flash('back', 4000); }
  });
  /* A new run starts fresh. */
  $effect(() => { cook.run; seenSwitch = 0; seenBack = 0; moment = ''; clearTimeout(tm); });
  function flash(m, len) { moment = m; clearTimeout(tm); tm = setTimeout(() => { moment = ''; }, len); }

  const caption = $derived(
    cook.done ? '🍽️ Plated!'
    : moment === 'boil' ? '💥 Boiled over! Switching burners...'
    : moment === 'back' ? '👋 Welcome back, still simmering'
    : cook.over ? '🔥 Low and slow. Good prompts take a minute'
    : cook.stage === 'read' ? '🥄 Tasting your thoughts' : '🍲 Simmering your prompt'
  );
  const pct = $derived(cook.done ? 100 : Math.max(2, Math.min(100, cook.pct)));
</script>

{#if cook.place === place}
  <div class="cook" class:boil={moment === 'boil'} class:done={cook.done} data-place={place}>
    <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true" focusable="false">
      <circle class="track" cx="36" cy="36" r={R} />
      <circle class="ring" cx="36" cy="36" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - pct / 100)} transform="rotate(-90 36 36)" />
      <g class="steam">
        <path d="M29 30 q-3 -4 0 -8 q3 -4 0 -8" /><path d="M36 28 q-3 -4 0 -8 q3 -4 0 -8" /><path d="M43 30 q-3 -4 0 -8 q3 -4 0 -8" />
      </g>
      <g class="drops">{#each cook.ingredients as _, i}<circle style="--i:{i}" cx={30 + (i % 3) * 6} cy="18" r="2.5" />{/each}</g>
      <g class="pot">
        <path class="body" d="M22 36 h28 v10 a8 8 0 0 1 -8 8 h-12 a8 8 0 0 1 -8 -8 z" />
        <path class="rim" d="M19 36 h34" /><path class="rim" d="M19 39 h-4 M53 39 h4" />
        <circle class="bub" cx="30" cy="41" r="1.6" /><circle class="bub b2" cx="38" cy="43" r="1.3" /><circle class="bub b3" cx="44" cy="40" r="1.4" />
      </g>
    </svg>
    <div class="txt">
      <b class="cap" id="cookCap-{place}">{caption}</b>
      {#if cook.ingredients.length}
        <span class="ing" aria-label="In the pot: {cook.ingredients.join(', ')}">{#each cook.ingredients as name, i}<i style="--i:{i}">{name}</i>{/each}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .cook { display: flex; align-items: center; gap: 12px; margin: 10px 0 4px; }
  svg { flex: 0 0 auto; overflow: visible; }
  .track { fill: none; stroke: var(--line); stroke-width: 4; }
  .ring { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; }
  .done .ring { stroke: var(--ok); }
  .body { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
  .rim { stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; fill: none; }
  .bub { fill: var(--accent); opacity: 0.55; }
  .steam path { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round; opacity: 0.45; }
  .drops circle { fill: var(--accent); opacity: 0; }
  .done .steam, .done .bub { opacity: 0; }
  .txt { display: grid; gap: 6px; min-width: 0; }
  .cap { font-size: 15px; color: var(--ink); }
  .ing { display: flex; flex-wrap: wrap; gap: 4px; }
  .ing i { font-style: normal; font-size: 12px; font-weight: 600; color: var(--muted); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); }
  @media (prefers-reduced-motion: no-preference) {
    .ring { transition: stroke-dashoffset 0.9s ease, stroke 0.3s ease; }
    .steam path { animation: rise 2.4s ease-in-out infinite; }
    .steam path:nth-child(2) { animation-delay: 0.6s; } .steam path:nth-child(3) { animation-delay: 1.2s; }
    .bub { animation: bub 1.6s ease-in-out infinite; } .bub.b2 { animation-delay: 0.5s; } .bub.b3 { animation-delay: 1s; }
    .drops circle { animation: drop 0.9s ease-in calc(var(--i) * 0.35s) 1 both; }
    .ing i { animation: pop 0.35s ease-out calc(var(--i) * 0.35s) both; }
    .boil .pot { animation: wobble 0.4s ease-in-out 0s 4; transform-origin: 36px 46px; }
    .boil .steam path { animation-duration: 0.8s; stroke: var(--record, var(--accent)); opacity: 0.8; }
    .done .pot { animation: ding 0.5s ease-out 1; transform-origin: 36px 46px; }
    @keyframes rise { 0% { transform: translateY(3px); opacity: 0; } 40% { opacity: 0.5; } 100% { transform: translateY(-5px); opacity: 0; } }
    @keyframes bub { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @keyframes drop { 0% { transform: translateY(-14px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(16px); opacity: 0; } }
    @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes wobble { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
    @keyframes ding { 50% { transform: scale(1.08); } }
  }
</style>
