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
  const rw = $derived(ui.rework);
  let mine = $state('');
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: 'result' } }));
  const answer = (text, tapped) => { window.dispatchEvent(new CustomEvent('stp-rework-answer', { detail: { answer: text, tapped } })); mine = ''; };
</script>

{#if g}
  <div class="qc {tone}" id="qualityCheck" in:fly={{ y: 6, duration: ms(220) }}>
    <div class="top">
      <span class="ic" aria-hidden="true">{icon}</span>
      <p class="lab"><b>{g.label}</b><span class="sub">Quality check</span></p>
      <p class="score" aria-label={`Score ${g.score} out of 5`}><b>{g.score.toFixed(1)}</b><span>/5</span></p>
    </div>
    <div class="meter" role="img" aria-label={`${g.score.toFixed(1)} out of 5`}>
      {#each [1, 2, 3, 4, 5] as i (i)}<i style="--f: {Math.max(0, Math.min(1, g.score - (i - 1)))}"></i>{/each}
    </div>
    <p class="tip">{g.working ? 'Polishing a few lines…' : 'Tip: ' + g.tip}</p>
    {#if g.note}<p class="rwnote" id="reworkNote">🔁 {g.note}</p>{/if}
    {#if rw && rw.stage === 'asking'}
      <p class="rwbusy" role="status">Checking if one question would help…</p>
    {:else if rw && rw.stage === 'question'}
      <div class="rwq" id="reworkQ">
        <p class="rwask"><b>One question to bring it up:</b> {rw.question}</p>
        {#if rw.choices.length}<div class="chips">{#each rw.choices as c (c)}<button type="button" onclick={() => answer(c, true)}>{c}</button>{/each}</div>{/if}
        <div class="rwmine">
          <label class="sr" for="reworkMine">Your answer</label>
          <input id="reworkMine" bind:value={mine} placeholder="Or type your answer" autocomplete="off" maxlength="500">
          <button type="button" class="primary" disabled={!mine.trim()} onclick={() => answer(mine, false)}>Rework</button>
        </div>
        <button type="button" class="link" onclick={() => answer('', false)}>Skip the question, just rework</button>
      </div>
    {:else if rw && rw.stage === 'writing'}
      <p class="rwbusy" role="status">Reworking from your first prompt…</p>
    {:else if !g.pass && !g.working && !g.reworked}
      <button type="button" class="rwbtn" id="reworkBtn" onclick={() => act('rework')}>🔁 Rework from this prompt</button>
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
  .lab, .tip, .score b, .rwq, .rwnote, .rwbusy { color: var(--ink); }
  .rwbtn { justify-self: start; min-height: var(--tap); font-weight: 700; border-radius: var(--r-pill); padding: var(--sp-2) var(--sp-4); }
  .rwnote { margin: 0; font-size: var(--fs-sm); font-weight: 700; }
  .rwbusy { margin: 0; font-size: var(--fs-sm); }
  .rwq { display: grid; gap: var(--sp-2); padding-top: var(--sp-2); border-top: 1px solid var(--line); }
  .rwask { margin: 0; font-size: var(--fs-sm); }
  .rwmine { display: flex; gap: var(--sp-2); }
  .rwmine input { flex: 1; min-width: 0; font: inherit; font-size: 16px; color: var(--ink); background: var(--surface); padding: var(--sp-2) var(--sp-3); min-height: var(--tap); border: 1px solid var(--line); border-radius: var(--r-sm); }
  .rwmine button { min-height: var(--tap); }
  .rwq .link { justify-self: start; min-height: 40px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
