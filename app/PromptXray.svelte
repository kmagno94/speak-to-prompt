<script>
  /* Prompt X-ray: tap to see which parts of your prompt came from your words
     (colored, matched words underlined), which were added to help (dashed), and
     which of your sentences didn't make it in. All on the phone (lib/xray.js). */
  import { slide } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { analyze, pieces, whyText } from './lib/xray.js';
  import { ms } from './lib/motion.js';

  let on = $state(false);
  let picked = $state(-1);      // tapped part of the prompt
  let source = $state(-1);      // tapped sentence of yours

  $effect(() => { xray.run; on = false; picked = -1; source = -1; });

  /* X-ray takes the prompt box's place while it's open. */
  $effect(() => { const out = document.getElementById('output'); if (out) out.style.display = on ? 'none' : ''; });

  const r = $derived(on && xray.prompt ? analyze(xray.prompt, xray.raw, xray.answers, xray.core) : null);
  const seg = $derived(r && picked >= 0 ? r.segments[picked] : null);
  const src = (i) => r.sources.find((s) => s.i === i);

  function tapSeg(i) { picked = picked === i ? -1 : i; source = r.segments[i].kind === 'from' ? r.segments[i].src : -1; }
  function tapSource(i) { source = source === i ? -1 : i; picked = -1; }
</script>

{#if xray.prompt}
  <div class="xbar">
    <button type="button" id="xrayBtn" class="xbtn" aria-pressed={on} onclick={() => (on = !on)}>{on ? 'Done' : '🩻 X-ray'}</button>
  </div>
{/if}

{#if r}
  <div class="xray" id="xray" transition:slide={{ duration: ms(200) }}>
    <p class="sum" id="xraySummary">
      About <b>{r.pct}%</b> of this prompt is your words. {r.added} {r.added === 1 ? 'part was' : 'parts were'} added to help.
      {#if r.dropped}<span class="warn"> ⚠️ {r.dropped} {r.dropped === 1 ? 'thing you said isn\'t' : 'things you said aren\'t'} in it. Check below.</span>{/if}
      {#if r.stray}<span class="warn"> 🔢 {r.stray} {r.stray === 1 ? 'number you' : 'numbers you'} never said.</span>{/if}
    </p>
    <div class="legend" aria-hidden="true">
      <span><i class="sw from"></i>From your words</span>
      <span><i class="sw added"></i>Added to help</span>
      {#if xray.core}<span><i class="sw core"></i>Your core</span>{/if}
    </div>

    <div class="xtext" id="xrayText">
      {#each r.segments as s, i}
        {#if s.kind === 'plain'}
          <span class="seg plain">{#each pieces(s) as p}{#if p.stray}<span class="stray">{p.t}</span>{:else}{p.t}{/if}{/each}</span>{' '}
        {:else}
          <button type="button" class="seg {s.kind} c{s.color ?? 0}" class:on={picked === i} class:dim={source >= 0 && s.src !== source}
                  data-kind={s.kind} data-src={s.src ?? ''} onclick={() => tapSeg(i)}
                  aria-label="{s.kind === 'from' ? 'From your words' : s.kind === 'core' ? 'Your core' : 'Added to help: ' + s.why}: {s.text}">
            {#if s.kind === 'added'}<small class="tag">{s.why}</small>{/if}{#each pieces(s) as p}{#if p.stray}<span class="stray" title="A number you never said">{p.t}</span>{:else if p.hit}<u>{p.t}</u>{:else}{p.t}{/if}{/each}
          </button>{' '}
        {/if}
      {/each}
    </div>

    {#if seg}
      <div class="why" id="xrayWhy" transition:slide={{ duration: ms(150) }}>
        {#if seg.kind === 'from'}
          {@const s = src(seg.src)}
          <p class="wl">{s.kind === 'answer' ? 'From your answer to "' + s.label + '"' : 'From what you said'}</p>
          <p class="quote c{s.color}">{s.text}</p>
          <p class="wn">Underlined words match yours.</p>
        {:else if seg.kind === 'core'}
          <p class="wl">Your core</p>
          <p>Added at the end of every prompt while Use my core is on.</p>
        {:else}
          <p class="wl">Added to help: {seg.why}</p>
          <p>{whyText(seg.why)}</p>
        {/if}
        {#if seg.stray.length}<p class="warn">🔢 {seg.stray.join(', ')} isn't something you said. Check it before you paste.</p>{/if}
      </div>
    {/if}

    <p class="yl">Your words</p>
    <ol class="sources" id="xraySources">
      {#each r.sources as s (s.i)}
        <li class:active={source === s.i} class:dropped={!s.used} data-i={s.i}>
          <button type="button" onclick={() => tapSource(s.i)}>
            <i class="dot c{s.color}"></i>
            <span>{#if s.kind === 'answer'}<small>Answer: </small>{/if}{s.text}</span>
            {#if !s.used}<b class="miss">Not in the prompt</b>{/if}
          </button>
        </li>
      {/each}
    </ol>
    <p class="fine">X-ray matches words on your phone. If something was reworded a lot, it can show as added even though the idea was yours.</p>
  </div>
{/if}

<style>
  .xbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .xbtn { min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
  .xray {
    --x0: #fde7b0; --x1: #cdeccf; --x2: #d6e4fb; --x3: #f6d3e4; --x4: #e3d9f7; --x5: #cfeeed;
    display: grid; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  }
  @media (prefers-color-scheme: dark) {
    .xray { --x0: #5a4718; --x1: #24492b; --x2: #263f63; --x3: #5a2a42; --x4: #3d3060; --x5: #1f4a49; }
  }
  .sum { margin: 0; font-size: 15px; line-height: 1.45; }
  .warn { color: var(--danger, #b3261e); font-weight: 600; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .sw { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
  .sw.from { background: linear-gradient(90deg, var(--x0) 33%, var(--x2) 33% 66%, var(--x1) 66%); }
  .sw.added { border: 1.5px dashed var(--muted); }
  .sw.core { background: var(--line); }
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
  .yl { margin: 4px 0 0; font-size: 14px; font-weight: 700; color: var(--muted); }
  .sources { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .sources button { display: flex; gap: 8px; align-items: flex-start; width: 100%; text-align: left; min-height: 0; padding: 8px 10px; border-radius: 10px; font-size: 14px; background: none; border: 1px solid var(--line); color: var(--ink); }
  .sources li.active button { outline: 2px solid var(--accent); }
  .sources li.dropped button { border: 1.5px solid var(--danger, #b3261e); }
  .dot { flex: none; width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; background: var(--xc); }
  .sources small { color: var(--muted); font-weight: 700; }
  .miss { flex: none; margin-left: auto; font-size: 12px; color: var(--danger, #b3261e); }
  .fine { margin: 0; font-size: 12.5px; color: var(--muted); }
</style>
