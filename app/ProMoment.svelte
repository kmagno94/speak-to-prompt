<script>
  /* Pro prompt moment (AGT-17, v2.1.33; every run since v2.1.34, Kevin's Test lab note:
     "let the user know their input was great on each run, for continued reassurance").
     Whenever a note hits all 5 Prompt strength parts, or a prompt scores a full 5 of 5 on the
     Quality check, it shows. The very first one says Your first pro prompt; after that it says
     Pro prompt. Only a yes/no flag is saved (stp-pro, "has had a first one"), never anything typed.

     Folded into v2.1.36 (Kevin's Test lab report: "still don't see it. Let's make it a button.
     When they click it confetti and then list bullet points on what made it good for
     reassurance"): the self-fading badge kept slipping by unseen (it timed out, or popped while
     the page was scrolling). Now it's a 🏆 button at the top of the result that stays until the
     next prompt, with a soft shimmer so it gets noticed. Tapping it plays the confetti (every
     tap) and opens What made it good: one plain bullet per strength part the note hit, plus
     the perfect Quality check score when that's why. Tap again to tuck it away. Nothing times
     out, so a later grade or polish on the same prompt keeps it open. Reduce Motion: no
     shimmer, no confetti, a still glow when open. */
  import { slide } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { ui } from './lib/ui.svelte.js';
  import { assess } from './lib/coach.js';
  import { ms, reduceMotion } from './lib/motion.js';

  const KEY = 'stp-pro';
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } }

  /* One reassuring line per strength part, in the same order as Prompt strength. */
  const WHY = {
    goal: "You said what you want, so the AI knows the goal from the first line.",
    who: "You said who it's for, so it can pitch the tone and level just right.",
    details: "You gave real details (numbers, names, specifics), so it doesn't have to guess.",
    limits: "You set limits like time, budget or size, so the answer fits your real life.",
    good: "You said what a great result looks like, so it comes back in the shape you need."
  };

  let had = seen();             // a first pro prompt already happened on this phone
  let firstRaw = $state(null);  // the note that was the first pro prompt (this visit)
  let lastRaw = '';
  let open = $state(false);
  let pops = $state(0);         // each tap replays the confetti
  let tapped = $state(false);   // the shimmer stops once it's been tapped

  const reason = $derived.by(() => {
    if (!xray.prompt) return '';
    if (ui.grade && !ui.grade.working && ui.grade.score >= 5) return 'grade';
    return assess(xray.raw).score === 5 ? 'note' : '';
  });
  const raw = $derived.by(() => { xray.run; return xray.raw; });
  const hits = $derived(reason ? assess(raw).checks.filter((c) => c.hit) : []);
  const first = $derived(firstRaw !== null && firstRaw === raw);

  /* A new note closes the list; a re-set of the same prompt (grade, polish) leaves it be. */
  $effect(() => {
    const r = raw;
    if (r !== lastRaw) { lastRaw = r; open = false; pops = 0; tapped = false; }
  });
  /* The first pro prompt on this phone: remember only that it happened. */
  $effect(() => {
    if (!reason || had) return;
    had = true; firstRaw = raw;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  });

  function toggle() {
    tapped = true;
    open = !open;
    if (open) pops++;
  }

  /* 18 pieces, fixed spread so it looks the same every time. */
  const BITS = Array.from({ length: 18 }, (_, i) => ({ x: Math.round(Math.cos(i * 2.4) * 140), y: -40 - (i * 37) % 90, r: (i * 47) % 360, c: i % 3, d: (i % 6) * 40 }));
</script>

{#if reason}
  <div class="pro" id="proMoment" data-why={reason} class:open class:still={reduceMotion}>
    <button type="button" class="probtn" class:shimmer={!tapped && !reduceMotion} id="proBtn" aria-expanded={open} aria-controls="proWhy" onclick={toggle}>
      {#if open && !reduceMotion && pops}
        {#key pops}
          <span class="burst" aria-hidden="true">
            {#each BITS as b}<i class="c{b.c}" style="--x: {b.x}px; --y: {b.y}px; --r: {b.r}deg; animation-delay: {b.d}ms"></i>{/each}
          </span>
        {/key}
      {/if}
      <b><span aria-hidden="true">🏆</span> {first ? 'Your first pro prompt' : 'Pro prompt'}</b>
      <span class="sub">{open ? 'Tap to tuck this away' : 'Tap to see what made it great'}</span>
    </button>
    {#if open}
      <div class="why" id="proWhy" transition:slide={{ duration: ms(250) }}>
        <p class="head">What made it good</p>
        <ul>
          {#if reason === 'grade'}<li><span aria-hidden="true">✅</span> The Quality check gave it a perfect 5 out of 5.</li>{/if}
          {#each hits as c (c.key)}<li data-part={c.key}><span aria-hidden="true">✓</span> <b>{c.label}:</b> {WHY[c.key]}</li>{/each}
        </ul>
        <p class="foot">{first ? 'Great start. Write your next note like this one and it will land just as well.' : 'Great input again. Keep writing notes like this one.'}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .pro { margin: 0 0 var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); color: var(--ink); overflow: visible; }
  .pro.still.open { box-shadow: 0 0 0 3px var(--accent), 0 0 18px 2px color-mix(in srgb, var(--accent) 45%, transparent); }
  .probtn { position: relative; display: grid; gap: 2px; justify-items: center; width: 100%; min-height: 48px; padding: var(--sp-2) var(--sp-3); border: 0; border-radius: var(--r-md); background: transparent; color: inherit; font: inherit; text-align: center; cursor: pointer; overflow: visible; -webkit-tap-highlight-color: transparent; }
  .probtn:active { transform: scale(.98); }
  .probtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .probtn b { font-family: var(--display); font-size: var(--fs-md); }
  .sub { font-size: var(--fs-xs); color: var(--muted); }
  .shimmer { animation: nudge 2.4s var(--ease) infinite; }
  @keyframes nudge {
    0%, 70%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent); }
    35% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 40%, transparent); }
  }
  .why { padding: 0 var(--sp-3) var(--sp-3); }
  .head { margin: 0 0 var(--sp-1); font-weight: 600; font-size: var(--fs-sm); }
  .why ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .why li { font-size: var(--fs-sm); line-height: 1.35; }
  .why li > span { color: var(--ok); font-weight: 700; }
  .foot { margin: var(--sp-2) 0 0; font-size: var(--fs-xs); color: var(--muted); }
  .burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
  .burst i { position: absolute; width: 7px; height: 11px; border-radius: 2px; opacity: 0; animation: pop 1.2s var(--ease) forwards; }
  .burst .c0 { background: var(--accent); }
  .burst .c1 { background: var(--ok); }
  .burst .c2 { background: var(--warn); }
  @keyframes pop {
    0% { opacity: 1; transform: translate(0, 0) rotate(0); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 60px)) rotate(var(--r)); }
  }
</style>
