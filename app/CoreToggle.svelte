<script>
  import { core } from './lib/core.svelte.js';
</script>

{#if core.dev && core.has}
  <label class="coretoggle">
    <input type="checkbox" id="coreToggle" role="switch" bind:checked={core.on} onchange={() => core.save()}>
    <span><b>Use my core</b><small>{core.on ? 'Who you are and how the AI should act shape your prompt' + (core.role ? ' (' + core.role + ')' : '') : 'Off for now'}</small></span>
  </label>
{/if}

<style>
  .coretoggle { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .coretoggle span { display: grid; line-height: 1.2; }
  .coretoggle b { font-size: 15px; }
  .coretoggle small { font-size: 13px; color: var(--muted); }
  input { appearance: none; -webkit-appearance: none; flex: none; width: 40px; height: 24px; margin: 0; border-radius: 999px; background: var(--line); position: relative; cursor: pointer; transition: background 0.15s ease; }
  input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); transition: transform 0.15s ease; }
  input:checked { background: var(--accent); }
  input:checked::after { transform: translateX(16px); }
  input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { input, input::after { transition: none; } }
</style>
