<script>
  /* Hear it, Glow-Up and X-ray (#33, v2.1.42): these used to sit on top of the prompt. They now
     live inside More with this prompt, under the Copy buttons, so the result shows the prompt
     and Copy first. X-ray itself still opens in the prompt's place (PromptXray.svelte); this
     bar only asks for it (xray.show).
     AGT-21 (v2.1.30): a one-line hint says what Glow-Up and X-ray are, until you tap either
     one once. Only a yes/no flag is saved, never anything you typed. */
  import { tick } from 'svelte';
  import { xray } from './lib/xray.svelte.js';
  import { ms } from './lib/motion.js';
  import GlowUp from './GlowUp.svelte';
  import HearIt from './HearIt.svelte';

  const HINT_KEY = 'stp-xbar-hint';
  let hint = $state((() => { try { return localStorage.getItem(HINT_KEY) !== '1'; } catch (e) { return true; } })());
  function hintSeen() { if (!hint) return; hint = false; try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {} }

  /* X-ray takes the prompt box's place, which is above this row: go up to it. */
  async function openXray() {
    xray.show = true;
    await tick();
    document.getElementById('xray')?.scrollIntoView({ block: 'start', behavior: ms(1) ? 'smooth' : 'auto' });
  }
</script>

{#if xray.prompt && !xray.show}
  <div class="xbar" id="xrayBar" onclickcapture={(e) => { if (e.target.closest && e.target.closest('#glowBtn, #xrayBtn')) hintSeen(); }}>
    <HearIt />
    <GlowUp />
    <button type="button" id="xrayBtn" class="xbtn" aria-pressed="false" onclick={openXray}>🩻 X-ray</button>
  </div>
  {#if hint}
    <p class="xhint" id="xbarHint">✨ Glow-Up shows your messy words turning into this prompt. 🩻 X-ray shows which parts came from you.</p>
  {/if}
{/if}

<style>
  .xbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px 0; scroll-margin-top: 12px; }
  .xhint { margin: -2px 0 0; font-size: 13px; line-height: 1.4; color: var(--muted); }
  .xbtn { min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: var(--accent-soft); border: none; }
</style>
