<script>
  /* 🎙️ Mic log in More options > dev tools (lib/miclog.svelte.js). Never your words, memory only. */
  import { micLog, micLogText } from './lib/miclog.svelte.js';
  let copied = $state(false);
  async function copy() {
    try { await navigator.clipboard.writeText(micLogText()); copied = true; setTimeout(() => { copied = false; }, 1800); } catch (e) {}
  }
</script>

<div class="stats miclogrow" id="micLogRow">
  <p class="srchead">🎙️ Mic log</p>
  {#if micLog.lines.length}
    <details class="miclog" id="micLog">
      <summary>{micLog.lines.length} events this page</summary>
      <pre>{micLogText()}</pre>
    </details>
    <div class="row"><button type="button" id="micLogCopy" onclick={copy}>{copied ? 'Copied' : 'Copy mic log'}</button></div>
  {:else}
    <p class="hint" id="micLogEmpty">Nothing yet. Use Talk it out, then come back here.</p>
  {/if}
  <p class="hint">What the speech engine did on each Talk it out run (event names, counts, error codes), for troubleshooting the mic. Never your words. Memory only, gone when you reload.</p>
</div>

<style>
  .miclog summary { cursor: pointer; }
  .miclog pre { max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px; margin: 6px 0 0; }
</style>
