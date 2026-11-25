<script>
  /* Hear it, Glow-Up and X-ray, right on top of the prompt. v2.1.42 tried folding these into a
     closed More with this prompt row (#33); Kevin's Test lab check (11/15) said they'd never be
     looked at there, so they are back out in plain view. X-ray itself opens in the prompt's
     place (PromptXray.svelte); this bar only asks for it (xray.show).
     AGT-21 (v2.1.30): a one-line hint says what Glow-Up and X-ray are, until you tap either
     one once. Only a yes/no flag is saved, never anything you typed. */
  import { xray } from './lib/xray.svelte.js';
  import GlowUp from './GlowUp.svelte';
  import HearIt from './HearIt.svelte';

  const HINT_KEY = 'stp-xbar-hint';
  let hint = $state((() => { try { return localStorage.getItem(HINT_KEY) !== '1'; } catch (e) { return true; } })());
  function hintSeen() { if (!hint) return; hint = false; try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {} }

</script>

{#if xray.prompt && !xray.show}
  <div class="xbar" id="xrayBar" onclickcapture={(e) => { if (e.target.closest && e.target.closest('#glowBtn, #xrayBtn')) hintSeen(); }}>
    <HearIt />
    <GlowUp />
    <button type="button" id="xrayBtn" class="xbtn" aria-pressed="false" onclick={() => (xray.show = true)}>🩻 X-ray</button>
  </div>
  {#if hint}
    <p class="xhint" id="xbarHint">✨ Glow-Up shows your messy words turning into this prompt. 🩻 X-ray shows which parts came from you.</p>
  {/if}
{/if}

<style>
  .xbar { display: flex; flex-wrap: wrap; row-gap: 4px; align-items: center; justify-content: flex-end; margin-bottom: 8px; scroll-margin-top: 12px; }
  .xhint { margin: -2px 0 10px; font-size: 13px; line-height: 1.4; color: var(--muted); text-align: right; }
  .xbtn { min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
</style>
