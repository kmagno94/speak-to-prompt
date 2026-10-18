<script>
  import { slide } from 'svelte/transition';
  import { report, REASONS, RELAY } from './lib/report.svelte.js';
  import { core } from './lib/core.svelte.js';
  import { ms } from './lib/motion.js';

  let picked = $state([]);
  let note = $state('');
  let status = $state('');
  let sent = $state(false);
  let sending = $state(false);

  /* A new prompt means a new report. */
  $effect(() => { report.run; picked = []; note = ''; status = ''; sent = false; });

  const ready = $derived(picked.length > 0 || note.trim().length > 0);
  const preview = $derived(report.open ? report.text(picked, note) : '');
  const issue = $derived(report.open && core.dev && !RELAY ? report.issueUrl(picked, note) : '');

  function pick(r) { picked = picked.includes(r) ? picked.filter((x) => x !== r) : [...picked, r]; }

  function done(msg) { sent = true; status = msg; }

  function send() {
    if (RELAY) {
      sending = true; status = 'Sending...';
      report.relay(picked, note).then(
        (n) => { sending = false; done('Sent! It\'s report #' + n + ' on the bug list. Thanks, this helps fix it.'); },
        () => { sending = false; shareOrCopy('Couldn\'t reach the bug list, so '); });
      return;
    }
    shareOrCopy('');
  }

  function shareOrCopy(lead) {
    const text = report.text(picked, note);
    const copy = () => {
      if (!navigator.clipboard?.writeText) { status = "This browser can't send it from here. Open \"See exactly what's sent\" and copy it."; return; }
      navigator.clipboard.writeText(text).then(
        () => done((lead ? lead + 'it was copied instead. ' : 'Copied. ') + 'Paste it into a message to whoever shared this app with you. Thanks!'),
        () => { status = "Couldn't copy. Open \"See exactly what's sent\" and copy it."; });
    };
    if (navigator.share) {
      navigator.share({ title: 'Speak to Prompt report', text }).then(
        () => done(lead ? lead + 'it went through your share sheet instead. Thanks!' : 'Sent. Thanks, this helps fix it.'),
        (e) => { if (e?.name !== 'AbortError') copy(); });
    } else copy();
  }
</script>

<div class="report">
  <button type="button" id="reportBtn" class="reportbtn" aria-expanded={report.open} aria-controls="reportBox"
          onclick={() => (report.open = !report.open)}>{report.open ? 'Close report' : 'Something went wrong?'}</button>
  {#if report.open}
    <div class="reportbox" id="reportBox" transition:slide={{ duration: ms(200) }}>
      <p class="rhead">What went wrong? Tap any that fit.</p>
      <div class="chips" role="group" aria-label="What went wrong">
        {#each REASONS as r}
          <button type="button" aria-pressed={picked.includes(r)} onclick={() => pick(r)}>{r}</button>
        {/each}
      </div>
      <label for="reportNote">Anything else? <span>(optional)</span></label>
      <textarea id="reportNote" rows="2" bind:value={note} placeholder="What did you expect instead?"></textarea>
      <p class="hint">{RELAY ? 'Goes to the app\'s public bug list. ' : ''}Your thoughts, answers, and prompt are never included. Only how the run went: timing, lengths, models, and settings.</p>
      <details class="what">
        <summary>See exactly what's sent</summary>
        <pre id="reportPreview">{preview}</pre>
      </details>
      <div class="row">
        <button type="button" class="primary" id="reportSend" disabled={!ready || sending} onclick={send}>{sending ? 'Sending...' : sent ? 'Send again' : 'Send report'}</button>
        {#if issue}
          <a class="ghlink" id="reportIssue" href={issue} target="_blank" rel="noopener"
             aria-disabled={!ready} onclick={(e) => { if (!ready) e.preventDefault(); else done('Opened GitHub. Tap Submit there, and the next review picks it up.'); }}>File a GitHub issue</a>
        {/if}
      </div>
      <p id="reportStatus" class="status" role="status">{status}</p>
    </div>
  {/if}
</div>

<style>
  .report { display: grid; gap: 10px; }
  .reportbtn { justify-self: end; background: none; border: none; min-height: 0; padding: 4px 2px; font-size: 14px; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
  .reportbox { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
  .rhead { margin: 0; font-weight: 700; }
  label { font-size: 14px; font-weight: 700; }
  label span { font-weight: 400; color: var(--muted); }
  textarea { width: 100%; min-height: 0; font: inherit; font-size: 16px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg, var(--surface)); color: var(--ink); resize: vertical; box-sizing: border-box; }
  .hint { margin: 0; font-size: 13px; color: var(--muted); }
  .what summary { cursor: pointer; font-size: 14px; color: var(--accent); }
  .what pre { margin: 8px 0 0; padding: 10px 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.45; border-radius: 10px; background: color-mix(in srgb, var(--line) 35%, transparent); }
  .ghlink { font-size: 14px; color: var(--accent); text-decoration: underline; text-underline-offset: 3px; padding: 8px 2px; }
  .ghlink[aria-disabled="true"] { opacity: 0.5; }
</style>
