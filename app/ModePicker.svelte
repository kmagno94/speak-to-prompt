<script>
  import { untrack } from 'svelte';
  import { ui, saveMode, manualModes } from './lib/ui.svelte.js';
  import { core } from './lib/core.svelte.js';

  /* Newcomers have no key, so they start in Quick and never hit a "needs a key" wall.
     With a key it's Auto (#56, v2.1.43): Read, the questions (Skip all at the top), a Flash-Lite
     write, then the Quality check decides what's next. There's nothing to pick. Quick and Normal
     stay as manual overrides with dev tools on (Auto is still the default there), and for the
     smoke tests written before Auto (__manualModes, the old picker: Normal once a key exists). */
  const manual = $derived(manualModes());
  const picker = $derived(!ui.hasKey || manual || core.dev);
  /* Re-runs only when the key or dev tools change (like before Auto), never on a tap, so a pick is never undone. */
  $effect(() => {
    const k = ui.hasKey, dev = core.dev, man = manual;
    untrack(() => {
      if (!k) { if (ui.mode === 'auto' || !ui.modePicked) ui.mode = 'quick'; }
      else if (man) { if (!ui.modePicked || ui.mode === 'auto') ui.mode = 'normal'; }
      else if (dev) { if (!ui.modePicked) ui.mode = 'auto'; }
      else ui.mode = 'auto';
    });
  });
  let hint = $derived(
    ui.mode === 'auto'
      ? 'Auto: a few quick questions (skip them anytime), then it writes fast and checks it. If it comes out weak, you get a stronger version.'
      : ui.mode === 'quick'
      ? (ui.hasKey ? 'Quick: skips the questions and writes right away.' : 'Quick: writes right away. A free key unlocks Normal, which asks a few questions first.')
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
  <!-- Mode picker: Quick skips the questions; Normal asks a few, then writes. Auto shows here with dev tools only. -->
  <div class="modes" class:three={ui.hasKey && core.dev && !manual} role="radiogroup" aria-label="How much thinking">
    {#if ui.hasKey && core.dev && !manual}<label class="mode"><input type="radio" name="mode" id="autoMode" value="auto" bind:group={ui.mode} onchange={picked}><b>Auto</b><small>default</small></label>{/if}
    <label class="mode"><input type="radio" name="mode" id="quickMode" value="quick" bind:group={ui.mode} onchange={picked}><b>Quick</b><small id="quickLabel">~{ui.quickSecs}s</small></label>
    <label class="mode"><input type="radio" name="mode" id="normalMode" value="normal" bind:group={ui.mode} onchange={picked}><b>Normal</b><small>~1 min</small></label>
  </div>
{/if}
<p class="modehint" id="modeHint">{hint}</p>

