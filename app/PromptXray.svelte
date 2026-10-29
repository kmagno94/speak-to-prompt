<script>
  /* Prompt X-ray: tap to see which parts of your prompt came from your words
     (colored, matched words underlined), which were added to help (dashed), and
     which of your sentences didn't make it in. All on the phone (lib/xray.js). */
  import { slide } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { analyze, pieces, whyText } from './lib/xray.js';
  import { ms } from './lib/motion.js';
  import GlowUp from './GlowUp.svelte';

  let on = $state(false);
  let picked = $state(-1);      // tapped part of the prompt
  let source = $state(-1);      // tapped sentence of yours

  $effect(() => { xray.run; on = false; picked = -1; source = -1; });

  /* X-ray takes the prompt box's place while it's open. */
  $effect(() => { const out = document.getElementById('output'); if (out) out.style.display = on ? 'none' : ''; });
  /* The Next step dock tucks away while X-ray is open (#17). */
  $effect(() => { xray.open = !!r; return () => { xray.open = false; }; });

  const r = $derived(on && xray.prompt ? analyze(xray.prompt, xray.raw, xray.answers, xray.core, xray.known) : null);
  const seg = $derived(r && picked >= 0 ? r.segments[picked] : null);
  const src = (i) => r.sources.find((s) => s.i === i);

  function tapSeg(i) { picked = picked === i ? -1 : i; source = r.segments[i].kind === 'from' ? r.segments[i].src : -1; }
  function tapSource(i) { source = source === i ? -1 : i; picked = -1; }
  /* Each of your sentences gets a number, so a color always has a matching label. */
  const num = (i) => r.sources.findIndex((s) => s.i === i) + 1;
  const short = (t) => { const w = String(t).split(/\s+/); return w.slice(0, 4).join(' ') + (w.length > 4 ? '...' : ''); };
  /* Tapping a part slides the key over to its sentence's chip. */
  $effect(() => {
    if (source < 0) return;
    const key = document.getElementById('xrayKey');
    const chip = key && key.querySelector('[data-i="' + source + '"]');
    if (chip) key.scrollTo({ left: chip.offsetLeft - key.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  });
  /* Done from anywhere: close, then bring the prompt back into view. */
  function close() {
    on = false;
    requestAnimationFrame(() => document.getElementById('xrayBar')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
</script>

{#if xray.prompt && !on}
  <div class="xbar" id="xrayBar">
    <GlowUp />
    <button type="button" id="xrayBtn" class="xbtn" aria-pressed="false" onclick={() => (on = true)}>🩻 X-ray</button>
  </div>
{/if}

{#if r}
  <div class="xray" id="xray" transition:slide={{ duration: ms(200) }}>
    <!-- Follows you down a long X-ray, so Done is always one tap away. -->
    <div class="xhead">
      <span class="xt">🩻 <b>{r.pct}%</b> your words</span>
      <button type="button" id="xrayBtn" class="xbtn" aria-pressed="true" onclick={close}>Done</button>
    </div>
    <p class="sum" id="xraySummary">
      About <b>{r.pct}%</b> of this prompt is your words. {r.added} {r.added === 1 ? 'part was' : 'parts were'} added to help.
      {#if r.dropped}<span class="warn"> ⚠️ {r.dropped} {r.dropped === 1 ? 'thing you said isn\'t' : 'things you said aren\'t'} in it. Look for the red chips below.</span>{/if}
      {#if r.stray}<span class="warn"> 🔢 {r.stray} {r.stray === 1 ? 'number you' : 'numbers you'} never said.</span>{/if}
    </p>
    <p class="hint">Each color and number matches one of your sentences in the key at the bottom. Tap anything to see where it came from.</p>

    <div class="xtext" id="xrayText">
      {#each r.segments as s, i}
        {#if s.kind === 'plain'}
          <span class="seg plain">{#each pieces(s) as p}{#if p.stray}<span class="stray">{p.t}</span>{:else}{p.t}{/if}{/each}</span>{' '}
        {:else}
          <button type="button" class="seg {s.kind} c{s.color ?? 0}" class:on={picked === i} class:dim={source >= 0 && s.src !== source}
                  data-kind={s.kind} data-src={s.src ?? ''} onclick={() => tapSeg(i)}
                  aria-label="{s.kind === 'from' ? 'From your sentence ' + num(s.src) : s.kind === 'core' ? (s.text.includes('MY CONTEXT') ? 'Your context' : 'Your core') : 'Added to help: ' + s.why}: {s.text}">
            {#if s.kind === 'from'}<i class="num c{s.color}" aria-hidden="true">{num(s.src)}</i>{/if}{#if s.kind === 'added'}<small class="tag">{s.why}</small>{/if}{#each pieces(s) as p}{#if p.stray}<span class="stray" title="A number you never said">{p.t}</span>{:else if p.hit}<u>{p.t}</u>{:else}{p.t}{/if}{/each}
          </button>{' '}
        {/if}
      {/each}
    </div>

    <details class="full" open={r.dropped > 0}>
      <summary class="yl">Your words, in full</summary>
      <ol class="sources" id="xraySources">
        {#each r.sources as s, n (s.i)}
          <li class:active={source === s.i} class:dropped={!s.used} data-i={s.i}>
            <button type="button" onclick={() => tapSource(s.i)}>
              <i class="num c{s.color}" aria-hidden="true">{n + 1}</i>
              <span>{#if s.kind === 'answer'}<small>Answer: </small>{/if}{s.text}</span>
              {#if !s.used}<b class="miss">Not in the prompt</b>{/if}
            </button>
          </li>
        {/each}
      </ol>
    </details>
    <p class="fine">X-ray matches words on your phone. If something was reworded a lot, it can show as added even though the idea was yours.</p>

    <!-- The color key stays docked at the bottom of the screen while you scroll the X-ray. -->
    <div class="dock" id="xrayDock">
      {#if seg}
        <div class="why" id="xrayWhy" transition:slide={{ duration: ms(150) }}>
          {#if seg.kind === 'from'}
            {@const s = src(seg.src)}
            <p class="wl">{s.kind === 'answer' ? 'From your answer to "' + s.label + '"' : 'From what you said'} <i class="num c{s.color}">{num(s.i)}</i></p>
            <p class="quote c{s.color}">{s.text}</p>
            <p class="wn">Underlined words match yours.</p>
          {:else if seg.kind === 'core'}
            <p class="wl">{seg.text.includes('MY CONTEXT') ? 'Your context' + (seg.text.includes('MY CORE') ? ' and core' : '') : 'Your core'}</p>
            <p>{seg.text.includes('MY CONTEXT') ? 'The context you picked under Build, added at the end so the AI can refer to it.' : 'Added at the end of every prompt while Use my core is on.'}</p>
          {:else}
            <p class="wl">Added to help: {seg.why}</p>
            <p>{whyText(seg.why)}</p>
          {/if}
          {#if seg.stray.length}<p class="warn">🔢 {seg.stray.join(', ')} isn't something you said. Check it before you paste.</p>{/if}
        </div>
      {:else if source >= 0}
        {@const s = src(source)}
        <div class="why" id="xraySourceWhy" transition:slide={{ duration: ms(150) }}>
          <p class="wl">Your sentence {num(s.i)}{s.used ? '' : ': not in the prompt'}</p>
          <p class="quote c{s.color}">{#if s.kind === 'answer'}<small>Answer: </small>{/if}{s.text}</p>
        </div>
      {/if}
      <div class="key" id="xrayKey" role="group" aria-label="Your sentences, by color">
        <span class="kl">Your words</span>
        {#each r.sources as s, n (s.i)}
          <button type="button" class="kchip c{s.color}" class:active={source === s.i} class:dropped={!s.used} data-i={s.i}
                  onclick={() => tapSource(s.i)} aria-label="Sentence {n + 1}{s.used ? '' : ', not in the prompt'}: {s.text}">
            <b>{n + 1}</b>{#if !s.used}<span class="bang" aria-hidden="true">!</span>{/if}<span class="kt">{short(s.text)}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .xbar { display: flex; justify-content: flex-end; margin-bottom: 8px; scroll-margin-top: 12px; }
  .xbtn { min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
  .xray {
    --x0: #fde7b0; --x1: #cdeccf; --x2: #d6e4fb; --x3: #f6d3e4; --x4: #e3d9f7; --x5: #cfeeed;
    display: grid; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  }
  @media (prefers-color-scheme: dark) {
    .xray { --x0: #5a4718; --x1: #24492b; --x2: #263f63; --x3: #5a2a42; --x4: #3d3060; --x5: #1f4a49; }
  }
  /* Sticky inside the card: it rides along while you scroll the X-ray and leaves with it. */
  .xhead { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin: -14px -14px 0; padding: 10px 14px; border-radius: 14px 14px 0 0; background: color-mix(in srgb, var(--surface) 92%, transparent);
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .xt { font-size: 14px; color: var(--muted); }
  .xt b { color: var(--ink); }
  .hint { margin: 0; font-size: 13px; color: var(--muted); }
  .sum { margin: 0; font-size: 15px; line-height: 1.45; }
  .warn { color: var(--danger, #b3261e); font-weight: 600; }
  .xtext { font-size: 16px; line-height: 1.85; padding: 2px; }
  .seg { display: inline; font: inherit; line-height: inherit; text-align: left; min-height: 0; padding: 2px 4px; margin: 0; border-radius: 6px; border: 1.5px solid transparent; background: none; color: var(--ink); box-decoration-break: clone; -webkit-box-decoration-break: clone; cursor: pointer; }
  .seg.from { background: var(--xc); }
  .seg.added { border: 1.5px dashed var(--muted); color: var(--muted); }
  .seg.core { background: var(--line); color: var(--muted); font-size: 14px; white-space: pre-wrap; }
  .seg.plain { padding: 2px 0; cursor: default; }
  .seg.on { outline: 2px solid var(--accent); outline-offset: 1px; }
  .seg.dim { opacity: 0.35; }
  .seg u { text-decoration-thickness: 2px; text-underline-offset: 3px; }
  .tag { font-size: 11px; font-weight: 700; margin-right: 4px; padding: 1px 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); vertical-align: 1px; }
  .stray { text-decoration: underline wavy var(--danger, #b3261e); text-underline-offset: 3px; }
  .c0 { --xc: var(--x0); } .c1 { --xc: var(--x1); } .c2 { --xc: var(--x2); } .c3 { --xc: var(--x3); } .c4 { --xc: var(--x4); } .c5 { --xc: var(--x5); }
  .why { padding: 10px 12px; border-radius: 10px; background: var(--accent-soft); }
  .why p { margin: 0 0 6px; font-size: 14px; } .why p:last-child { margin-bottom: 0; }
  .wl { font-weight: 700; }
  .quote { padding: 6px 10px; border-radius: 8px; background: var(--xc); font-size: 15px !important; }
  .wn { color: var(--muted); }
  .full summary { cursor: pointer; }
  .full[open] summary { margin-bottom: 8px; }
  .yl { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: var(--muted); }
  /* Number badge: the same color and number on the prompt part, the key chip, and the full list. */
  .num { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; margin-right: 4px; border-radius: 999px;
    font-style: normal; font-size: 11px; font-weight: 800; line-height: 1; color: var(--ink); background: var(--xc);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 25%, transparent); vertical-align: 2px; }
  .sources .num { margin-top: 1px; flex: none; vertical-align: 0; }
  /* The dock: docked to the bottom of the screen while the X-ray is on screen. */
  .dock { position: sticky; bottom: 0; z-index: 2; display: grid; gap: 8px; margin: 0 -14px -14px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    border-radius: 0 0 14px 14px; background: color-mix(in srgb, var(--surface) 94%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    border-top: 1px solid var(--line); box-shadow: 0 -10px 24px -18px rgba(10, 20, 40, 0.45); }
  .dock .why { max-height: 34vh; overflow-y: auto; }
  .key { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; align-items: center; padding-bottom: 2px; }
  .key::-webkit-scrollbar { display: none; }
  .kl { flex: none; font-size: 12px; font-weight: 700; color: var(--muted); margin-right: 2px; }
  .kchip { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 10px 4px 4px; border-radius: 999px; font-size: 13px;
    border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); max-width: 190px; }
  .kchip b { display: inline-grid; place-items: center; min-width: 24px; height: 24px; border-radius: 999px; background: var(--xc); font-size: 12px; }
  .kchip .kt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
  .kchip.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .kchip.dropped { border-color: var(--danger, #b3261e); }
  .bang { color: var(--danger, #b3261e); font-weight: 800; }
  .sources { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .sources button { display: flex; gap: 8px; align-items: flex-start; width: 100%; text-align: left; min-height: 0; padding: 8px 10px; border-radius: 10px; font-size: 14px; background: none; border: 1px solid var(--line); color: var(--ink); }
  .sources li.active button { outline: 2px solid var(--accent); }
  .sources li.dropped button { border: 1.5px solid var(--danger, #b3261e); }
  .sources small { color: var(--muted); font-weight: 700; }
  .miss { flex: none; margin-left: auto; font-size: 12px; color: var(--danger, #b3261e); }
  .fine { margin: 0; font-size: 12.5px; color: var(--muted); }
</style>
