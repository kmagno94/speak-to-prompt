<script>
  /* Save as context, the nudge (#50, v2.1.37, SPEC LOCKED 11/08). When the Read call spots
     background you'd otherwise retype, this card offers to save it as a My context piece.
       - place="wait": under the tracker (next to the ⚡ Quick version chip) while the prompt
         is being written, so the wait is put to use.
       - place="done": under the result, if the prompt finished first, so the offer isn't lost.
     Not now hides it for this prompt. Nothing is saved unless you finish the interview and tap
     Save. See lib/savectx.svelte.js. */
  import { ui } from './lib/ui.svelte.js';
  import { savectx } from './lib/savectx.svelte.js';
  let { place = 'wait' } = $props();
  const show = $derived(!!savectx.candidate && !savectx.nudgeOff && (place === 'wait' ? !!ui.build : !ui.build));
  const go = () => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'savectx', where: 'nudge' } }));
</script>

{#if show}
  <div class="ctxnudge" id={place === 'wait' ? 'ctxNudgeWait' : 'ctxNudge'} role="status">
    <p class="t">🧱 Save “{savectx.candidate.title}” as context?</p>
    <p class="d">{savectx.candidate.why ? savectx.candidate.why + ' ' : ''}{place === 'wait' ? 'While you wait, answer a few quick questions once' : 'Answer a few quick questions once'} and you won't have to explain it again.</p>
    <div class="acts">
      <button type="button" class="go" id={place === 'wait' ? 'ctxNudgeGoWait' : 'ctxNudgeGo'} onclick={go}>Save as context</button>
      <button type="button" class="link" id={place === 'wait' ? 'ctxNudgeLaterWait' : 'ctxNudgeLater'} onclick={() => (savectx.nudgeOff = true)}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .ctxnudge { display: grid; gap: var(--sp-1); margin-top: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); border: 1.5px dashed var(--line); background: var(--surface); }
  .t { margin: 0; font-weight: 700; font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .d { margin: 0; font-size: var(--fs-sm); color: var(--muted); }
  .acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-4); margin-top: var(--sp-1); }
  .go { min-height: var(--tap); padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); font-size: var(--fs-sm); font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
  .go:active { transform: scale(0.97); }
  .link { min-height: var(--tap); font-size: var(--fs-sm); }
</style>
