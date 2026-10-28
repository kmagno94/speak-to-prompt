<script>
  /* 🧪 Test lab (staging only). A walkthrough of every check for the builds that aren't live yet,
     from releases.json, then the Before you promote checks. ✓ Works / ✗ Broken per step, saved on
     this phone; a broken one can go to the 💡 Ideas jar. See lib/testlab.svelte.js. */
  import { onMount, tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { lab } from './lib/testlab.svelte.js';
  import { SEMVER } from './lib/channel.js';
  import { releaseStatus } from './lib/releases.js';

  let walk = $state(null);        // { steps, i, title } while walking, else null
  let note = $state('');
  let resetArmed = $state(false);
  let copied = $state('');
  let reported = $state('');     // 📋 Copy report feedback
  let showReport = $state(false); // clipboard blocked: show the report to copy by hand
  let panel = $state();

  const status = $derived(lab.live ? releaseStatus(lab.releases, lab.live) : null);
  const step = $derived(walk ? walk.steps[walk.i] : null);
  const res = $derived(step ? lab.results[step.key] : null);
  const tabLabel = $derived(!lab.loaded ? 'Test lab' : lab.verdict.fail ? `✗ ${lab.verdict.fail} broken` : lab.verdict.ready ? '✓ Ready' : lab.verdict.left ? `${lab.verdict.left} left` : 'Test lab');
  const runLabel = $derived(lab.run.recheck ? `▶ Re-check ${lab.run.steps.length} fix${lab.run.steps.length === 1 ? '' : 'es'}` : lab.run.steps.length ? `▶ ${lab.verdict.pass ? 'Continue' : 'Start'} · ${lab.run.steps.length} left` : '');

  onMount(() => { if (lab.enabled) lab.load(); });
  $effect(() => { if (lab.open) { lab.load(); tick().then(() => panel?.querySelector('.primary, button')?.focus()); } });

  function close() { lab.open = false; walk = null; resetArmed = false; reported = ''; showReport = false; }
  function onKey(e) { if (e.key === 'Escape' && lab.open) { if (walk) walk = null; else close(); } }

  function start() { const r = lab.run; if (!r.steps.length) return; walk = { steps: r.steps, i: 0, title: r.recheck ? 'Re-check fixes' : 'Test lab' }; note = lab.results[r.steps[0].key]?.note || ''; }
  function openOne(s) { walk = { steps: [s], i: 0, title: 'One check' }; note = lab.results[s.key]?.note || ''; }
  function go(d) {
    const i = walk.i + d;
    if (i < 0) return;
    if (i >= walk.steps.length) { walk = null; return; }
    walk = { ...walk, i }; note = lab.results[walk.steps[i].key]?.note || ''; reported = ''; showReport = false;
  }
  function works() { lab.mark(step.key, 'pass'); go(1); }
  function broken() { lab.mark(step.key, 'fail', note); }
  function saveNote() { if (res?.s === 'fail') lab.mark(step.key, 'fail', note); }
  function toJar() { lab.mark(step.key, 'fail', note); lab.toJar(step); }
  function reset() { if (!resetArmed) { resetArmed = true; return; } lab.reset(); resetArmed = false; walk = null; }
  /* 📋 Copy report: every broken check with its note, ready to paste into the Claude chat.
     From a step card it saves the note you're typing first. */
  async function copyReport(fromStep) {
    if (fromStep && step) lab.mark(step.key, 'fail', note);
    try { await navigator.clipboard.writeText(lab.report); reported = 'Copied. Paste it into your Claude chat.'; showReport = false; }
    catch (e) { reported = 'Couldn’t copy. Select the report below and copy it.'; showReport = true; }
  }
  async function copyPromote() {
    try { await navigator.clipboard.writeText(lab.verdict.promote); copied = 'Copied. Paste it into your Claude chat.'; }
    catch (e) { copied = 'Couldn’t copy. Type it: ' + lab.verdict.promote; }
  }
  const icon = (s) => (lab.results[s.key]?.s === 'pass' ? '✓' : lab.results[s.key]?.s === 'fail' ? '✗' : '○');
</script>

<svelte:window onkeydown={onKey} />

{#if lab.visible}
  <button type="button" class="labtab" id="labTab" class:bad={lab.verdict.fail} class:good={lab.verdict.ready} aria-expanded={lab.open} onclick={() => (lab.open = !lab.open)} title="Test lab: check staging before a promote">
    <span aria-hidden="true">🧪</span><span>{tabLabel}</span>
  </button>
{/if}

{#if lab.visible && lab.open}
  <button type="button" class="veil" aria-label="Close Test lab" onclick={close} transition:fade={{ duration: ms(180) }}></button>
  <aside class="labpanel" id="labPanel" role="dialog" aria-modal="true" aria-labelledby="labTitle" bind:this={panel} transition:fly={{ x: -380, duration: ms(240), opacity: 1 }}>
    <div class="head">
      <div>
        <h2 id="labTitle">🧪 {walk ? walk.title : 'Test lab'}</h2>
        <p class="sub" id="labLive">{status ? `Live v${status.live} · staging v${SEMVER} · ${status.count}/${status.limit} ahead` : `Staging v${SEMVER} · live version unknown, showing every build`}</p>
      </div>
      <button type="button" class="x" onclick={close} aria-label="Close">✕</button>
    </div>

    {#if !lab.loaded}
      <p class="sub">Loading the checks…</p>
    {:else if lab.failedLoad}
      <p class="sub" id="labError">Couldn’t load releases.json. Reload staging and try again.</p>
    {:else if walk && step}
      <section class="card" id="labStep">
        <p class="lbl">{step.version ? `v${step.version} · ${step.title}` : step.title} · {walk.i + 1} of {walk.steps.length}</p>
        <p class="do"><b>Do:</b> {step.say}</p>
        <p class="see"><b>You should see:</b> {step.see}</p>
        <div class="row">
          <button type="button" class="primary" id="labWorks" onclick={works}>✓ Works</button>
          <button type="button" class="bad" id="labBroken" class:on={res?.s === 'fail'} onclick={broken}>✗ Broken</button>
        </div>
        {#if res?.s === 'fail'}
          <label class="lbl" for="labNote">What happened?</label>
          <textarea id="labNote" rows="2" maxlength="300" bind:value={note} onblur={saveNote} placeholder="What you saw instead"></textarea>
          <button type="button" class="primary" id="labReportStep" onclick={() => copyReport(true)}>📋 Copy report for Claude</button>
          {#if reported}<p class="sub" role="status" id="labReportMsg">{reported}</p>{/if}
          {#if showReport}<textarea class="report" readonly rows="8" aria-label="Test lab report">{lab.report}</textarea>{/if}
          {#if res.jar}
            <p class="okmsg" role="status" id="labJarMsg">💡 In the Ideas jar as a 🔥 Now bug. It rides the next Fix session.</p>
          {:else}
            <button type="button" class="link" id="labJar" onclick={toJar}>💡 Add to Ideas jar instead</button>
          {/if}
        {/if}
        <div class="row nav">
          <button type="button" class="link" onclick={() => go(-1)} disabled={walk.i === 0}>‹ Back</button>
          <button type="button" class="link" id="labNext" onclick={() => go(1)}>{walk.i + 1 < walk.steps.length ? 'Skip ›' : 'Done'}</button>
          <button type="button" class="link" onclick={() => (walk = null)}>See all</button>
        </div>
      </section>
    {:else}
      <section class="verdict" class:bad={lab.verdict.fail} class:good={lab.verdict.ready} id="labVerdict" role="status">
        <p class="vtext">{lab.verdict.text}</p>
        {#if lab.plan.newest}<p class="sub">{lab.verdict.pass} ✓ · {lab.verdict.fail} ✗ · {lab.verdict.left} not checked</p>{/if}
        {#if runLabel}<button type="button" class="primary" id="labRun" onclick={start}>{runLabel}</button>{/if}
        {#if lab.verdict.fail}
          <button type="button" class="primary" id="labReport" onclick={() => copyReport(false)}>📋 Copy report for Claude · {lab.verdict.fail} broken</button>
          {#if reported}<p class="sub" role="status" id="labReportMsg">{reported}</p>{/if}
          {#if showReport}<textarea class="report" readonly rows="8" aria-label="Test lab report">{lab.report}</textarea>{/if}
        {/if}
        {#if lab.verdict.ready}
          <button type="button" class="primary" id="labPromote" onclick={copyPromote}>Copy “{lab.verdict.promote}”</button>
          {#if copied}<p class="sub" role="status">{copied}</p>{/if}
        {/if}
      </section>

      {#each lab.plan.builds as b (b.version || 'x')}
        <section class="build">
          <p class="lbl">{b.version ? `v${b.version} · ${b.title}` : b.title}</p>
          {#each b.steps as s (s.key)}
            <button type="button" class="stepbtn" data-key={s.key} data-s={lab.results[s.key]?.s || ''} onclick={() => openOne(s)}>
              <span class="ic" aria-label={lab.results[s.key]?.s || 'not checked'}>{icon(s)}</span>
              <span class="txt">{s.say}{#if lab.results[s.key]?.note}<small>{lab.results[s.key].note}</small>{/if}</span>
            </button>
          {/each}
        </section>
      {/each}

      <button type="button" class="link del" id="labReset" onclick={reset}>{resetArmed ? 'Tap again to clear every result' : 'Clear results'}</button>
      <p class="privacy">Staging only. Results are saved on this phone only. Rewording a check in releases.json resets that check.</p>
    {/if}
  </aside>
{/if}

<style>
  .labtab {
    position: fixed; z-index: 40; left: calc(env(safe-area-inset-left, 0px) + 12px); bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 10px 16px; border-radius: 999px;
    background: var(--surface); color: var(--ink); border: 1px solid var(--line); font-weight: 700; font-variant-numeric: tabular-nums;
    box-shadow: 0 10px 28px -12px color-mix(in srgb, var(--ink) 55%, transparent); transition: transform 0.15s ease-out;
  }
  .labtab:active { transform: scale(0.96); }
  .labtab.bad { color: var(--danger); border-color: var(--danger); }
  .labtab.good { color: var(--ok); border-color: var(--ok); }
  .labtab[aria-expanded='true'] { opacity: 0; pointer-events: none; }
  .veil { position: fixed; inset: 0; z-index: 49; border: 0; padding: 0; border-radius: 0; min-height: 0; background: color-mix(in srgb, #0b1420 45%, transparent); }
  .labpanel {
    position: fixed; z-index: 50; top: 0; left: 0; bottom: 0; width: min(420px, 100vw); overflow-y: auto; overscroll-behavior: contain;
    background: var(--surface); color: var(--ink); border-right: 1px solid var(--line);
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 24px) calc(env(safe-area-inset-left, 0px) + 16px);
    display: grid; gap: 16px; align-content: start; box-shadow: 24px 0 60px -30px rgba(10, 20, 40, 0.5);
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  h2 { margin: 0; font-family: var(--display); font-size: 24px; line-height: 1.15; }
  .sub { margin: 2px 0 0; font-size: 14px; color: var(--muted); }
  .x { flex: none; width: 44px; height: 44px; min-height: 44px; padding: 0; border-radius: 50%; }
  .lbl { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); }
  .card, .verdict { display: grid; gap: 10px; padding: 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--bg); }
  .verdict.bad { border-color: var(--danger); }
  .verdict.good { border-color: var(--ok); }
  .vtext { margin: 0; font-weight: 700; font-size: 17px; }
  .verdict.bad .vtext { color: var(--danger); }
  .verdict.good .vtext { color: var(--ok); }
  .do, .see { margin: 0; line-height: 1.45; overflow-wrap: anywhere; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .row > button:not(.link) { flex: 1 1 0; min-height: 48px; }
  button.bad { color: var(--danger); border-color: var(--danger); }
  button.bad.on { background: color-mix(in srgb, var(--danger) 12%, var(--surface)); }
  .nav { justify-content: space-between; }
  .nav .link { min-height: 44px; }
  .report { font-size: 13px; min-height: 140px; }
  textarea { width: 100%; min-height: 64px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; resize: vertical; }
  .okmsg { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ok) 14%, var(--surface)); color: var(--ok); font-weight: 700; font-size: 14px; }
  .build { display: grid; gap: 6px; }
  .stepbtn { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: start; text-align: left; min-height: 48px; padding: 10px 12px; border-radius: 12px; font-size: 15px; font-weight: 400; }
  .stepbtn .ic { font-weight: 700; text-align: center; color: var(--muted); }
  .stepbtn[data-s='pass'] .ic { color: var(--ok); }
  .stepbtn[data-s='fail'] .ic { color: var(--danger); }
  .stepbtn[data-s='pass'] .txt { color: var(--muted); }
  .stepbtn small { display: block; margin-top: 2px; font-size: 13px; color: var(--danger); }
  .txt { overflow-wrap: anywhere; }
  .del { color: var(--danger) !important; justify-self: start; min-height: 44px; }
  .privacy { margin: 0; font-size: 13px; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .labtab { transition: none; } }
</style>
