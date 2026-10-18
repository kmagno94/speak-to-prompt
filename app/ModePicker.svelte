<script>
  import { ui } from './lib/ui.svelte.js';

  const HINTS = {
    quick: 'Quick: skips the questions and writes right away.',
    normal: 'Normal: asks a few quick questions, then writes.'
  };
  let hint = $derived(HINTS[ui.mode] + (ui.mode !== 'quick' && !ui.hasKey ? ' Needs a free Gemini key (below).' : ''));
</script>

<!-- Mode picker beside Build: Quick skips the questions; Normal asks a few, then writes. -->
<div class="modes" role="radiogroup" aria-label="How much thinking">
  <label class="mode"><input type="radio" name="mode" id="quickMode" value="quick" bind:group={ui.mode}><b>Quick</b><small id="quickLabel">~{ui.quickSecs}s</small></label>
  <label class="mode"><input type="radio" name="mode" id="normalMode" value="normal" bind:group={ui.mode}><b>Normal</b><small>~1 min</small></label>
</div>
<p class="modehint" id="modeHint">{hint}</p>
