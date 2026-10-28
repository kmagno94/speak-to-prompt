<script>
  import { ui } from './lib/ui.svelte.js';

  /* Newcomers have no key, so they start in Quick and never hit a "needs a key" wall.
     Once a key is typed or saved, it moves to Normal, unless they picked a mode. */
  $effect(() => { const k = ui.hasKey; if (!ui.modePicked) ui.mode = k ? 'normal' : 'quick'; });
  let hint = $derived(
    ui.mode === 'quick'
      ? (ui.hasKey ? 'Quick: skips the questions and writes right away.' : 'Quick: writes right away. Add a free Gemini key (below) and Normal asks a few questions first.')
      : 'Normal: asks a few quick questions, then writes.' + (ui.hasKey ? '' : ' Needs a free Gemini key (below).')
  );
  const picked = () => (ui.modePicked = true);
</script>

<!-- Mode picker beside Build: Quick skips the questions; Normal asks a few, then writes. -->
<div class="modes" role="radiogroup" aria-label="How much thinking">
  <label class="mode"><input type="radio" name="mode" id="quickMode" value="quick" bind:group={ui.mode} onchange={picked}><b>Quick</b><small id="quickLabel">~{ui.quickSecs}s</small></label>
  <label class="mode"><input type="radio" name="mode" id="normalMode" value="normal" bind:group={ui.mode} onchange={picked}><b>Normal</b><small>~1 min</small></label>
</div>
<p class="modehint" id="modeHint">{hint}</p>
