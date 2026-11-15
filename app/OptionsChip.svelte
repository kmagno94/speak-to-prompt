<script>
  /* Options (#29 Calm first screen, v2.1.42): on first load the page shows the words box and
     Build my prompt. Mode, the four sliders and My context sit behind this one chip, which
     always says the mode you are in (Options · Quick), since that is the one setting that
     changes how long Build takes. Tapping it opens them inline right under it, and Build my
     prompt moves down with them. Open or closed is kept in memory only: closed on every load.
     The parts stay on the page while it is closed (the mode still follows your key, and
     picked context still goes into the prompt), they are only out of sight. */
  import { ui } from './lib/ui.svelte.js';
  import { context } from './lib/context.svelte.js';
  import { starter } from './lib/starter.svelte.js';
  import { SLIDERS } from './lib/starters.js';
  import ModePicker from './ModePicker.svelte';
  import ContextRow from './ContextRow.svelte';

  const mode = $derived(ui.mode === 'quick' ? 'Quick' : 'Normal');
  /* The My context editor can be opened from elsewhere (Save as context, Bring in): it lives in here, so open up. */
  $effect(() => { if (context.open) ui.optionsOpen = true; });

  function said(sl) {
    const t = sl.steps[starter.tune[sl.key] - 1];
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'No preference';
  }
</script>

<button type="button" class="optchip" id="optionsChip" aria-expanded={ui.optionsOpen} aria-controls="optionsPanel"
        onclick={() => (ui.optionsOpen = !ui.optionsOpen)}>
  <span aria-hidden="true">⚙️</span> Options · <b id="optionsMode">{mode}</b><i class="chev" aria-hidden="true">▾</i>
</button>

<div class="optpanel" id="optionsPanel" hidden={!ui.optionsOpen}>
  <ModePicker />
  <div class="tune" id="optionsTune">
    <div class="tunehead">
      <p>Fine-tune it</p>
      {#if starter.tuned}<button type="button" id="optTuneReset" class="reset" onclick={() => starter.resetTune()}>Reset to middle</button>{/if}
    </div>
    {#each SLIDERS as sl (sl.key)}
      <div class="slider">
        <label for="opt-tune-{sl.key}">{sl.label}</label>
        <input type="range" id="opt-tune-{sl.key}" min="1" max="5" step="1" bind:value={starter.tune[sl.key]} aria-valuetext={said(sl)}>
        <div class="ends"><span>{sl.low}</span><span>{sl.high}</span></div>
        <b class:off={Number(starter.tune[sl.key]) === 3}>{said(sl)}</b>
      </div>
    {/each}
    <p class="tunenote" id="optTuneNote">{starter.tuneLines.length ? 'Goes in with your words when you build: ' + starter.tuneLines.map((t) => t.line).join(' ') : 'In the middle, the sliders add nothing.'}</p>
  </div>
  <ContextRow />
</div>

<style>
  .optchip {
    grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; gap: 6px;
    min-height: var(--tap, 44px); padding: 8px 14px; border-radius: 999px; font-size: 14px; font-weight: 600;
    color: var(--muted); background: transparent; border: 1px solid var(--line);
  }
  .optchip b { color: var(--ink); font-weight: 700; }
  .optchip[aria-expanded='true'] { border-color: var(--accent); color: var(--accent); }
  .chev { font-style: normal; font-size: 12px; transition: transform 0.18s ease; }
  .optchip[aria-expanded='true'] .chev { transform: rotate(180deg); }
  .optpanel { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; animation: optin 0.18s ease; }
  .optpanel[hidden] { display: none; }
  @keyframes optin { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  .tune { display: grid; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); }
  .tunehead { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; }
  .tunehead p { margin: 0; font-size: 14px; font-weight: 700; color: var(--muted); }
  .reset { background: none; border: none; padding: 4px 2px; min-height: 0; box-shadow: none; color: var(--muted); font: inherit; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .slider { display: grid; grid-template-columns: 76px minmax(0, 1fr); column-gap: 10px; row-gap: 2px; align-items: center; }
  .slider label { font-weight: 700; font-size: 15px; }
  .slider input { width: 100%; margin: 0; height: 32px; accent-color: var(--accent); cursor: pointer; }
  .slider .ends, .slider b { grid-column: 2; }
  .slider .ends { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
  .slider b { font-size: 13px; color: var(--accent); }
  .slider b.off { color: var(--muted); font-weight: 400; }
  .tunenote { margin: 0; font-size: 13px; line-height: 1.4; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .optpanel { animation: none; } .chev { transition: none; } }
</style>
