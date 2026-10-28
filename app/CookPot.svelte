<script>
  /* Prompt cooking: a kitchen inside a big progress ring that wraps the timer.
     - Your pieces fly in as chips and splash into the pot; the spoon stirs, it bubbles
       and steams, and a line of chef talk changes every few seconds.
     - Past the usual time the lid goes on and rattles ("the chef is being picky").
     - A model handing off: the pot shakes, foam spills, the flames flare, and it slides
       over to a new burner ("Boiled over! Switching burners...").
     - Done: the pot turns into a plate under a cloche that lifts with a burst of sparkles.
     Reads lib/cook.svelte.js. Labels only, never your words.
     Reduce Motion: nothing moves; the ring, the words, and the pot's state still change. */
  import { fade } from 'svelte/transition';
  import { cook } from './lib/cook.svelte.js';
  import { ms } from './lib/motion.js';
  let { place } = $props();

  const R = 92, C = 2 * Math.PI * R;
  const LINES = {
    read: ['🥄 Tasting your thoughts', '👃 Sniffing out what you really need', '🔪 Chopping it into bite-size pieces', '📋 Reading the order ticket'],
    write: ['🍲 Simmering your prompt', '🥄 Stirring in your answers', '🧂 A pinch of context', '🔥 Bringing it to a gentle boil', '🌿 Letting the flavors meld', '👨‍🍳 Seasoning to taste'],
    over: ['🫕 Lid on, low and slow', '👨‍🍳 The chef is being extra picky', '⏳ Good prompts take a minute', '🍽️ Warming the plates']
  };

  let moment = $state('');   // 'boil' | 'back' for a few seconds
  let n = $state(0);         // which chef line is showing
  let seenSwitch = 0, seenBack = 0, tm = null;

  /* A new run starts fresh. */
  $effect(() => { cook.run; seenSwitch = 0; seenBack = 0; moment = ''; n = 0; clearTimeout(tm); });
  $effect(() => {
    const s = cook.switches, b = cook.back;
    if (cook.place !== place) return;
    if (s > seenSwitch) { seenSwitch = s; flash('boil', 3600); }
    else if (b > seenBack) { seenBack = b; flash('back', 4000); }
  });
  function flash(m, len) { moment = m; clearTimeout(tm); tm = setTimeout(() => { moment = ''; }, len); }
  /* Chef talk changes every few seconds while it cooks. */
  $effect(() => {
    if (cook.place !== place || cook.done) return;
    cook.stage; cook.over;
    n = 0;
    const iv = setInterval(() => { n++; }, 3200);
    return () => clearInterval(iv);
  });

  const list = $derived(cook.over ? LINES.over : LINES[cook.stage] || LINES.write);
  const caption = $derived(
    cook.done ? '🍽️ Order up! Your prompt is plated'
    : moment === 'boil' ? '💥 Boiled over! Switching burners...'
    : moment === 'back' ? '👋 Welcome back, still simmering'
    : list[n % list.length]
  );
  const pct = $derived(cook.done ? 100 : Math.max(2, Math.min(100, cook.pct)));
</script>

{#if cook.place === place}
  <div class="cook" class:boil={moment === 'boil'} class:over={cook.over && !cook.done} class:done={cook.done} data-place={place}>
    <div class="stage">
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle class="track" cx="100" cy="100" r={R} />
        <circle class="ring" cx="100" cy="100" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - pct / 100)} transform="rotate(-90 100 100)" />
        <circle class="glow" cx="100" cy="100" r={R} />

        <g class="kitchen">
          <rect class="burner" x="62" y="134" width="76" height="5" rx="2.5" />
          <g class="flames">
            {#each [74, 87, 100, 113, 126] as x, i}<path style="--i:{i}" d="M{x} 133 c-7 -4 -6 -10 0 -16 c6 6 7 12 0 16z" /><path class="core" style="--i:{i}" d="M{x} 133 c-3 -2 -3 -5 0 -8 c3 3 3 6 0 8z" />{/each}
          </g>

          <g class="pot">
            <g class="steam">
              <path d="M86 46 q-5 -6 0 -12 q5 -6 0 -12" /><path d="M100 42 q-5 -6 0 -12 q5 -6 0 -12" /><path d="M114 46 q-5 -6 0 -12 q5 -6 0 -12" />
            </g>
            <g class="spoon"><line x1="114" y1="36" x2="98" y2="72" /><ellipse cx="97" cy="75" rx="5" ry="3" /></g>
            <path class="body" d="M62 70 h76 v30 a18 18 0 0 1 -18 18 h-40 a18 18 0 0 1 -18 -18 z" />
            <ellipse class="soup" cx="100" cy="74" rx="36" ry="4.5" />
            <g class="bubbles"><circle cx="82" cy="75" r="2.6" /><circle class="b2" cx="100" cy="76" r="2" /><circle class="b3" cx="116" cy="75" r="2.4" /></g>
            {#each cook.ingredients as _, i}
              <g class="splash" style="--i:{i}"><circle cx="92" cy="72" r="2" /><circle cx="100" cy="68" r="2.4" /><circle cx="108" cy="72" r="2" /></g>
            {/each}
            <line class="rim" x1="56" y1="70" x2="144" y2="70" />
            <path class="handle" d="M56 78 h-9 M144 78 h9" />
            <g class="lid"><path d="M58 69 Q100 40 142 69 Z" /><circle cx="100" cy="51" r="4.5" /></g>
            <g class="foam">
              {#each [[62, 68, 7], [76, 64, 8], [92, 62, 9], [108, 62, 9], [124, 64, 8], [138, 68, 7], [58, 84, 5], [142, 90, 5]] as [x, y, r], i}<circle style="--i:{i}" cx={x} cy={y} {r} />{/each}
            </g>
          </g>

          <g class="plate">
            <ellipse class="dish" cx="100" cy="112" rx="50" ry="9" />
            <g class="paper"><rect x="80" y="88" width="40" height="22" rx="3" /><line x1="86" y1="95" x2="114" y2="95" /><line x1="86" y1="100" x2="110" y2="100" /><line x1="86" y1="105" x2="104" y2="105" /></g>
            <g class="cloche"><path d="M64 110 a36 32 0 0 1 72 0 z" /><circle cx="100" cy="75" r="4.5" /><line x1="58" y1="110" x2="142" y2="110" /></g>
            <text class="star" x="122" y="88" text-anchor="middle">✨</text>
            {#each Array(10) as _, i}<circle class="spark" style="--a:{i * 36}deg" cx="100" cy="92" r="3" />{/each}
          </g>
        </g>

        <text class="clock" x="100" y="163" text-anchor="middle">{cook.el}</text>
        <text class="sub" x="100" y="177" text-anchor="middle">{cook.left}</text>
        {#if cook.elLbl && cook.elLbl !== 'elapsed'}<text class="sub" x="100" y="188" text-anchor="middle">{cook.elLbl}</text>{/if}
      </svg>
      <div class="fly" aria-hidden="true">
        {#each cook.ingredients as name, i}<span style="--i:{i}; --sx:{i % 2 ? 150 : -150}px">{name}</span>{/each}
      </div>
    </div>

    {#key caption}
      <b class="cap" id="cookCap-{place}" role="status" in:fade={{ duration: ms(220) }}>{caption}</b>
    {/key}
    {#if cook.ingredients.length}
      <span class="ing" aria-label="In the pot: {cook.ingredients.join(', ')}">{#each cook.ingredients as name, i}<i style="--i:{i}">✓ {name}</i>{/each}</span>
    {/if}
  </div>
{/if}

<style>
  .cook { display: grid; justify-items: center; gap: 8px; margin: 4px 0 2px; text-align: center; }
  .stage { position: relative; width: min(220px, 64vw); aspect-ratio: 1; }
  svg { width: 100%; height: 100%; overflow: visible; display: block; }
  .track { fill: none; stroke: var(--line); stroke-width: 8; }
  .ring { fill: none; stroke: var(--accent); stroke-width: 8; stroke-linecap: round; }
  .glow { fill: none; stroke: var(--accent); stroke-width: 18; opacity: 0; }
  .done .ring { stroke: var(--ok); }

  .burner { fill: var(--muted); opacity: 0.6; }
  .flames path { fill: #f97316; transform-box: fill-box; transform-origin: 50% 100%; }
  .flames .core { fill: #fde047; }
  .body { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 3; }
  .soup { fill: var(--accent); opacity: 0.35; }
  .rim, .handle { stroke: var(--accent); stroke-width: 5; stroke-linecap: round; fill: none; }
  .bubbles circle, .splash circle { fill: var(--accent); opacity: 0.6; }
  .splash circle { opacity: 0; }
  .steam path { fill: none; stroke: var(--muted); stroke-width: 2.2; stroke-linecap: round; opacity: 0.5; }
  .spoon line { stroke: var(--muted); stroke-width: 4; stroke-linecap: round; }
  .spoon ellipse { fill: var(--muted); }
  .lid { opacity: 0; }
  .lid path { fill: var(--surface); stroke: var(--accent); stroke-width: 3; }
  .lid circle { fill: var(--accent); }
  .over .lid { opacity: 1; }
  .over .spoon, .over .steam { opacity: 0; }
  .foam circle { fill: #fff; stroke: color-mix(in srgb, var(--ink) 18%, transparent); stroke-width: 1; opacity: 0; }
  .boil .foam circle { opacity: 1; }
  .boil .flames path { fill: #ef4444; } .boil .flames .core { fill: #fb923c; }
  .plate { opacity: 0; }
  .dish { fill: var(--surface); stroke: var(--line); stroke-width: 3; }
  .cloche path { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 3; }
  .cloche circle { fill: var(--accent); }
  .cloche line { stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
  .star { font-size: 22px; opacity: 0; }
  .paper rect { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
  .paper line { stroke: var(--accent); stroke-width: 2; stroke-linecap: round; opacity: 0.7; }
  .spark { fill: var(--ok); opacity: 0; transform-origin: 100px 92px; }
  .done .pot, .done .flames, .done .burner { opacity: 0; }
  .done .plate, .done .star { opacity: 1; }
  .done .cloche { transform: translate(18px, -26px) rotate(18deg); transform-origin: 136px 110px; }

  .clock { font-family: var(--mono); font-size: 24px; fill: var(--ink); font-variant-numeric: tabular-nums; }
  .sub { font-size: 10.5px; fill: var(--muted); }

  .fly { position: absolute; inset: 0; pointer-events: none; }
  .fly span { position: absolute; left: 50%; top: 34%; white-space: nowrap; font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
    color: var(--accent-ink); background: var(--accent); opacity: 0; transform: translate(-50%, -50%) scale(0.3); }

  .cap { font-size: 15px; color: var(--ink); min-height: 1.4em; }
  .ing { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
  .ing i { font-style: normal; font-size: 12px; font-weight: 600; color: var(--muted); padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); }

  @media (prefers-reduced-motion: no-preference) {
    .ring { transition: stroke-dashoffset 0.9s ease, stroke 0.4s ease; }
    .flames path { animation: flick 0.5s ease-in-out calc(var(--i) * -0.13s) infinite alternate; }
    .steam path { animation: rise 2.2s ease-in-out infinite; }
    .steam path:nth-child(2) { animation-delay: 0.7s; } .steam path:nth-child(3) { animation-delay: 1.4s; }
    .spoon { transform-origin: 114px 36px; animation: stir 1.6s ease-in-out infinite alternate; }
    .bubbles circle { animation: bub 1.4s ease-in infinite; } .bubbles .b2 { animation-delay: 0.45s; } .bubbles .b3 { animation-delay: 0.9s; }
    .fly span { animation: fly 1s cubic-bezier(.3, .7, .4, 1) calc(0.25s + var(--i) * 0.75s) both; }
    .splash circle { animation: splash 0.5s ease-out calc(1.05s + var(--i) * 0.75s) both; }
    .splash circle:nth-child(1) { --dx: -6px; } .splash circle:nth-child(3) { --dx: 6px; }
    .ing i { animation: land 0.3s ease-out calc(1.1s + var(--i) * 0.75s) both; }
    .soup { animation: swell 2.4s ease-in-out infinite; transform-origin: 100px 74px; }
    .over .lid { animation: rattle 1.8s ease-in-out infinite; transform-origin: 100px 69px; }
    .glow { animation: none; }
    .boil .pot { animation: shake 0.11s linear 0s 8, slide 1.1s ease 0.95s both; transform-origin: 100px 110px; }
    .boil .foam circle { animation: foam 0.6s ease-out calc(var(--i) * 0.06s) both; }
    .boil .flames path { animation: flare 0.25s ease-in-out infinite alternate; }
    .boil .glow { animation: pulse 0.6s ease-out 3; stroke: #ef4444; }
    .done .plate { animation: pop 0.45s cubic-bezier(.3, 1.6, .5, 1) both; transform-origin: 100px 110px; }
    .done .cloche { transition: transform 0.7s cubic-bezier(.3, 1.4, .5, 1) 0.45s; }
    .done .star { animation: pop 0.5s ease-out 0.7s both; transform-origin: 100px 98px; transform-box: fill-box; }
    .done .spark { animation: burst 0.9s ease-out 0.7s both; }
    .done .glow { animation: pulse 0.9s ease-out 0.4s 1; stroke: var(--ok); }
    @keyframes flick { to { transform: scaleY(1.25) scaleX(0.85); } }
    @keyframes flare { from { transform: scaleY(1.6); } to { transform: scaleY(2.1) scaleX(1.2); } }
    @keyframes rise { 0% { transform: translateY(4px); opacity: 0; } 40% { opacity: 0.6; } 100% { transform: translateY(-8px); opacity: 0; } }
    @keyframes stir { from { transform: rotate(-16deg); } to { transform: rotate(14deg); } }
    @keyframes bub { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 30% { opacity: 0.7; } 100% { transform: translateY(-10px) scale(1.2); opacity: 0; } }
    @keyframes fly {
      0% { opacity: 0; transform: translate(calc(-50% + var(--sx)), -170%) scale(0.9) rotate(calc(var(--sx) / 12)); }
      15% { opacity: 1; }
      65% { opacity: 1; transform: translate(-50%, -190%) scale(0.85) rotate(0deg); }
      100% { opacity: 0; transform: translate(-50%, 40%) scale(0.25); }
    }
    @keyframes splash { 0% { opacity: 0.8; transform: translate(0, 0); } 100% { opacity: 0; transform: translate(var(--dx, 0), -14px); } }
    @keyframes land { from { color: var(--muted); border-style: dashed; opacity: 0.35; } to { color: var(--ink); border-style: solid; opacity: 1; } }
    @keyframes swell { 50% { transform: scaleY(1.6); } }
    @keyframes rattle { 0%, 60%, 100% { transform: rotate(0) translateY(0); } 66% { transform: rotate(-5deg) translateY(-3px); } 72% { transform: rotate(5deg) translateY(-2px); } 78% { transform: rotate(-3deg) translateY(-3px); } 84% { transform: rotate(0) translateY(0); } }
    @keyframes shake { 0% { transform: translate(-3px, 0) rotate(-3deg); } 50% { transform: translate(3px, -2px) rotate(3deg); } 100% { transform: translate(-3px, 0) rotate(-3deg); } }
    @keyframes foam { 0% { opacity: 0; transform: scale(0.2); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes slide { 0% { transform: translateX(0); } 45% { transform: translateX(120px); opacity: 0; } 55% { transform: translateX(-120px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
    @keyframes pulse { 0% { opacity: 0.5; } 100% { opacity: 0; } }
    @keyframes pop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes burst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-70px) scale(0.4); } }
  }
  @media (prefers-reduced-motion: reduce) {
    .fly { display: none; }
    .done .cloche { transform: translate(18px, -26px) rotate(18deg); }
  }
</style>
