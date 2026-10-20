<script>
  /* Memory section inside Your core: the "Tailor prompts to me" switch, your saved
     facts (tap ✕ to forget one), add your own, Export and Import memory.md
     (the share sheet can save it to iCloud Drive), and Forget everything. */
  import { memory, MAX_FACTS } from './lib/memory.svelte.js';

  let draft = $state('');
  let status = $state('');
  let confirmForget = $state(false);
  let fileInput;

  function addOwn() { if (memory.add(draft)) { draft = ''; status = ''; } else if (draft.trim()) status = 'Already saved.'; }

  async function exportMd() {
    status = '';
    const blob = new Blob([memory.toMarkdown()], { type: 'text/markdown' });
    const file = new File([blob], 'memory.md', { type: 'text/markdown' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Speak to Prompt memory' });
        status = 'Shared. Save to Files to keep it in iCloud Drive.';
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'memory.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status = 'Saved as memory.md.';
  }
  async function importMd(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const n = memory.importMarkdown(await f.text());
    status = n ? 'Added ' + n + ' fact' + (n === 1 ? '' : 's') + '.' : 'Nothing new in that file.';
    e.target.value = '';
  }
</script>

<section class="mem" id="memoryPanel">
  <h3><span>MEMORY</span> What it knows about you</h3>
  <label class="check"><input type="checkbox" id="memoryOn" checked={memory.on} onchange={(e) => memory.setOn(e.target.checked)}> Tailor prompts to me</label>
  <p class="hint">Short facts like your devices, school, or job, so Gemini stops asking what you've already told it. Only the facts that matter for a request go into that prompt. Saved on this phone only, never on a server.</p>

  {#if memory.facts.length}
    <ul class="facts" id="memoryFacts">
      {#each memory.facts as f, i (f.t)}
        <li><span>{f.t}</span><button type="button" class="x" aria-label="Forget: {f.t}" onclick={() => memory.remove(i)}>✕</button></li>
      {/each}
    </ul>
  {:else}
    <p class="hint empty">Nothing saved yet. After a prompt, tap what you want remembered, or add it here.</p>
  {/if}

  <div class="addrow">
    <input type="text" id="memoryAdd" maxlength="160" placeholder="For example: I use an iPhone 16 on iOS 27" bind:value={draft} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOwn(); } }}>
    <button type="button" id="memoryAddBtn" onclick={addOwn} disabled={!draft.trim()}>Add</button>
  </div>
  <p class="hint">{memory.facts.length} of {MAX_FACTS}. Export makes a memory.md you can save to iCloud Drive, or Import into Safari or the Home Screen app (they keep separate memories).</p>
  <div class="row">
    <button type="button" id="memoryExport" onclick={exportMd} disabled={!memory.facts.length}>Export memory.md</button>
    <button type="button" id="memoryImportBtn" onclick={() => fileInput.click()}>Import</button>
    <input type="file" id="memoryImport" accept=".md,.txt,text/markdown,text/plain" bind:this={fileInput} onchange={importMd} hidden>
    {#if memory.facts.length}
      {#if confirmForget}
        <button type="button" class="danger" id="memoryForgetYes" onclick={() => { memory.clear(); confirmForget = false; }}>Yes, forget all</button>
      {:else}
        <button type="button" id="memoryForget" onclick={() => (confirmForget = true)}>Forget everything</button>
      {/if}
    {/if}
  </div>
  {#if status}<p class="hint ok" id="memoryStatus" role="status">{status}</p>{/if}
</section>

<style>
  section { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
  h3 { margin: 0; font-family: var(--display); font-size: 18px; display: flex; align-items: center; gap: 8px; }
  h3 span { font-family: var(--body); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
  .hint { margin: 0; color: var(--muted); font-size: 14px; }
  .ok { color: var(--ok); font-weight: 700; }
  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .facts li { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: 10px; background: var(--bubble); font-size: 15px; }
  .facts span { flex: 1; }
  .x { flex: none; min-height: 32px; min-width: 32px; padding: 0; border: 0; border-radius: 999px; background: none; color: var(--muted); }
  .addrow { display: flex; gap: 8px; }
  .addrow input { flex: 1; min-width: 0; font: inherit; font-size: 16px; color: var(--ink); background: var(--surface); padding: 9px 12px; border: 1px solid var(--line); border-radius: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .row button { min-height: 40px; padding: 8px 14px; font-size: 14px; }
  .danger { color: var(--danger); }
</style>
