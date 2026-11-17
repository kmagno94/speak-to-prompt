<script>
  import { untrack } from 'svelte';
  import { ui, saveMode, manualModes } from './lib/ui.svelte.js';

  /* No key: the quick prompt. With a key: Auto (#56), with nothing to pick (v2.1.44). */
  const manual = $derived(manualModes());
  /* v2.1.44 (Kevin 11/17: "phased out and just have auto run with no options"): no picker for anyone, dev tools
     included. With a key it's Auto; with none, the quick prompt. The old picker only comes back for the smoke
     tests written before Auto (__manualModes, test-only, like __openRows). */
  const picker = $derived(manual);
  /* Re-runs only when the key changes, never on a tap, so a pick is never undone. */
  $effect(() => {
    const k = ui.hasKey, man = manual;
    untrack(() => {
      if (man) { if (!k) { if (ui.mode === 'auto' || !ui.modePicked) ui.mode = 'quick'; } else if (!ui.modePicked || ui.mode === 'auto') ui.mode = 'normal'; }
      else ui.mode = k ? 'auto' : 'quick';
    });
  });
  let hint = $derived(
    ui.mode === 'auto'
      ? 'Auto: a few quick questions (skip them anytime), then it writes fast and checks it. If it comes out weak, you get a stronger version.'
      : ui.mode === 'quick'
      ? (ui.hasKey ? 'Quick: skips the questions and writes right away.' : manual ? 'Quick: writes right away. A free key unlocks Normal, which asks a few questions first.' : 'Writes a quick prompt right away. A free key turns on Auto: a few questions, a stronger write, and a Quality check.')
      : 'Normal: asks a few quick questions, then writes.' + (ui.hasKey ? '' : ' Needs a free Gemini key: tap Paste my key below.')
  );
  /* Picking one is remembered on this device (the mode only, never words). */
  const picked = (e) => {
    ui.modePicked = true; saveMode(e.currentTarget.value);
    /* Normal needs a key: with none yet, open the key panel and go there (Customer Eyes, v2.1.23). */
    if (e.currentTarget.value === 'normal' && !ui.hasKey) window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'key', where: 'form' } }));
  };
</script>

{#if picker}
  <!-- The old Quick / Normal picker, for the pre-Auto smoke tests only (__manualModes). -->
  <div class="modes" role="radiogroup" aria-label="How much thinking">
    <label class="mode"><input type="radio" name="mode" id="quickMode" value="quick" bind:group={ui.mode} onchange={picked}><b>Quick</b><small id="quickLabel">~{ui.quickSecs}s</small></label>
    <label class="mode"><input type="radio" name="mode" id="normalMode" value="normal" bind:group={ui.mode} onchange={picked}><b>Normal</b><small>~1 min</small></label>
  </div>
{/if}
<p class="modehint" id="modeHint">{hint}</p>

