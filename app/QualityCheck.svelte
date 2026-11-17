<script>
  /* Quality check at a glance: a 5-step meter, the score, a plain label, and one tip.
     The label and icon carry the meaning, so it never relies on color alone. The full
     grader line (#gradeNote, with model and timing) stays under it for testing. */
  import { fly } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { ui } from './lib/ui.svelte.js';
  const g = $derived(ui.grade);
  const tone = $derived(!g ? '' : g.pass ? 'good' : g.score >= 3.5 ? 'mid' : 'low');
  const icon = $derived(tone === 'good' ? '✓' : tone === 'mid' ? '◐' : '✋');
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: 'result' } }));
</script>

{#if g && g.failed}
  <!-- v2.1.44: a grade that never came back says so, so a missing card never looks like a bug -->
  <div class="qc" id="qualityCheck" in:fly={{ y: 6, duration: ms(220) }}>
    <p class="tip" id="gradeFailed"><b>Quality check didn't come back this time.</b> Google was slow to answer. Your prompt is fine to use.</p>
  </div>
{:else if g}
  <div class="qc {tone}" id="qualityCheck" in:fly={{ y: 6, duration: ms(220) }}>
    <div class="top">
      <span class="ic" aria-hidden="true">{icon}</span>
      <p class="lab"><b>{g.label}</b><span class="sub">Quality check</span></p>
      <p class="score" aria-label={`Score ${g.score} out of 5`}><b>{g.score.toFixed(1)}</b><span>/5</span></p>
    </div>
    <div class="meter" role="img" aria-label={`${g.score.toFixed(1)} out of 5`}>
      {#each [1, 2, 3, 4, 5] as i (i)}<i style="--f: {Math.max(0, Math.min(1, g.score - (i - 1)))}"></i>{/each}
    </div>
    {#if g.auto && !g.pass}
      <!-- #56 What's thin (v2.1.43, SPEC LOCKED 11/15 round 5): up to 3 plain lines on what's missing, so you can
           decide without reading the whole prompt. The stand-in's questions (if any) sit just above this card. -->
      <div class="thin" id="whatsThin">
        <p class="thinhead"><b>What's thin</b>{#if g.working}<span> · polishing a few lines…</span>{/if}</p>
        <ul>{#each g.thin as line, i (i)}<li>{line}</li>{/each}</ul>
        {#if g.used}
          <p class="thinused" id="thinUsed" role="status">✅ Copied. Paste it into your AI.</p>
        {:else if !g.working && ui.hasKey && (!ui.round || (ui.round.stage === 'built' && ui.round.count < ui.round.max))}
          <div class="thinbtns">
            <button type="button" class="primary usebtn" id="thinUse" onclick={() => act('thinuse')}>Use it</button>
            <button type="button" class="rwbtn" id="thinStronger" onclick={() => act('stronger')}>💪 Make it stronger</button>
          </div>
          <p class="askhint">Make it stronger rewrites it with the stronger model. Your first prompt stays, one tap away.</p>
        {/if}
      </div>
    {:else}
    <p class="tip">{g.working ? 'Polishing a few lines…' : 'Tip: ' + g.tip}</p>
    {/if}
    {#if !g.auto && !g.pass && !g.working && ui.hasKey && (!ui.round || (ui.round.stage === 'built' && ui.round.count < ui.round.max))}
      <!-- v2.1.39 (idea mwct7axlrttc): the tip asks you about what was weak and rewrites from your
           answers, so fixing it is a few taps and not "add that to your note and build again". -->
      {#if g.ask}
        <button type="button" class="askbtn" id="guideBtn" onclick={() => act('guide')}>💬 Ask me, then rewrite</button>
        <p class="askhint" id="guideHint">{g.ask === 1 ? 'One quick question' : g.ask + ' quick questions'} about what was weak. Tap an answer or type your own.</p>
      {/if}
      <div class="rwrow">
        <button type="button" class="rwbtn" id="reworkBtn" onclick={() => act('rework')}>🔁 Rework from this prompt</button>
        <button type="button" class="rwedit" id="reworkEditBtn" onclick={() => act('reworkedit')}>✏️ Edit first</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .qc { display: grid; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--bg); }
  .top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--sp-3); align-items: center; }
  .ic { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; background: var(--accent-soft); color: var(--accent); }
  .lab { margin: 0; display: grid; line-height: 1.2; }
  .lab b { font-family: var(--display); font-size: var(--fs-md); }
  .sub { font-size: var(--fs-xs); color: var(--muted); }
  .score { margin: 0; font-variant-numeric: tabular-nums; }
  .score b { font-family: var(--display); font-size: var(--fs-xl); }
  .score span { color: var(--muted); font-size: var(--fs-sm); }
  .meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .meter i { position: relative; height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; }
  .meter i::after { content: ''; position: absolute; inset: 0; background: currentColor; transform-origin: left center; transform: scaleX(var(--f)); transition: transform var(--dur-slow) var(--ease); }
  .tip { margin: 0; font-size: var(--fs-sm); }
  .good { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); }
  .good .ic { background: var(--ok); color: var(--surface); }
  .mid { color: var(--accent); }
  .low { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); }
  .low .ic { background: var(--warn); color: var(--surface); }
  .lab, .tip, .score b { color: var(--ink); }
  /* Rework builds right away (#2); Edit first is the lighter way to change it before it builds. */
  .rwrow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
  .rwedit { min-height: var(--tap); padding: var(--sp-2) var(--sp-3); border: 0; background: transparent; color: var(--accent); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .askbtn { justify-self: start; min-height: var(--tap); font-weight: 800; border-radius: var(--r-pill); padding: var(--sp-2) var(--sp-4); background: var(--accent); color: var(--accent-ink); border: 0; }
  .askhint { margin: 0; font-size: var(--fs-xs); color: var(--muted); }
  .rwbtn { justify-self: start; min-height: var(--tap); font-weight: 700; border-radius: var(--r-pill); padding: var(--sp-2) var(--sp-4); }
  .thin { display: grid; gap: var(--sp-2); }
  .thinhead { margin: 0; color: var(--ink); }
  .thinhead span { color: var(--muted); font-size: var(--fs-sm); }
  .thin ul { margin: 0; padding-left: 1.2em; color: var(--ink); font-size: var(--fs-sm); display: grid; gap: 2px; }
  .thinbtns { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .usebtn { min-height: var(--tap); font-weight: 800; border-radius: var(--r-pill); padding: var(--sp-2) var(--sp-5, 24px); }
  .thinused { margin: 0; font-weight: 700; color: var(--ink); }
</style>
