<script>
  /* Key nudge (v2.1.23): newcomers on the free Quick version see what a key adds, right
     where it matters, without moving the key panel. Tapping opens the panel at the bottom
     (the same 'key' action Notice buttons use) and scrolls to it.
       place="form"   one slim line under Build my prompt. "Not now" hides it for this tab only.
       place="result" on the finished prompt card: what Normal would have done differently.
     Both disappear the moment a key is typed or saved (ui.hasKey). Nothing is saved:
     "Not now" lives in memory, so a refresh brings the line back. */
  import { slide } from 'svelte/transition';
  import { ui } from './lib/ui.svelte.js';
  import { ms } from './lib/motion.js';

  let { place = 'form' } = $props();

  const unlock = () => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: 'key', where: place } }));
  const later = () => { ui.keyNudgeHidden = true; };
  const show = $derived(!ui.hasKey && (place === 'result' ? ui.quickResult : !ui.keyNudgeHidden));
</script>

{#if show}
  {#if place === 'form'}
    <div class="strip" id="keyNudge" role="group" aria-label="Unlock follow-up questions" transition:slide={{ duration: ms(200) }}>
      <button type="button" class="go" id="keyNudgeGo" onclick={unlock}>
        <span class="lead">You're on Quick mode.</span>
        <span class="pitch">Unlock follow-up questions, free, 1 min →</span>
      </button>
      <button type="button" class="later" id="keyNudgeLater" onclick={later}>Not now</button>
    </div>
  {:else}
    <div class="card" id="keyNudgeResult" role="note">
      <p><b>This was the quick version.</b> With a free key, Gemini asks you 2 or 3 quick questions first (like who it's for or what you've tried), so the prompt fits you.</p>
      <button type="button" class="primary" id="keyNudgeResultGo" onclick={unlock}>Unlock smarter prompts (free, 1 min)</button>
    </div>
  {/if}
{/if}

<style>
  .strip { display: flex; align-items: stretch; gap: 6px; margin-top: 10px; width: 100%; }
  .go { flex: 1 1 auto; display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: center; min-height: 44px; padding: 8px 14px;
    border-radius: 999px; text-align: left; font-size: 14px; color: var(--accent); background: var(--accent-soft);
    border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .lead { color: var(--muted); font-weight: 600; }
  .pitch { font-weight: 600; }
  .later { flex: none; min-height: 44px; padding: 0 12px; border-radius: 999px; font-size: 13px; color: var(--muted);
    background: transparent; border: 1px solid var(--line); }
  .go:active, .later:active { transform: scale(0.97); }
  .card { margin: 12px 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--accent-soft);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
  .card p { margin: 0 0 10px; font-size: 15px; line-height: 1.45; color: var(--ink); }
  .card .primary { width: 100%; }
</style>
