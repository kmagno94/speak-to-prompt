<script>
  /* Can't-see-it radar (AGT-71, Slice 1). When your words point at something your AI can't see
     (this email, my resume, the rubric), one friendly card under the prompt says to paste or
     attach it. Free, on the phone (lib/coach.js), nothing sent, nothing saved, and the prompt
     itself is never changed. Got it hides it until the next prompt. */
  import { slide } from 'svelte/transition';
  import { xray } from './lib/xray.svelte.js';
  import { cantSeeThings, cantSeeLine } from './lib/coach.js';
  import { ms } from './lib/motion.js';

  let gone = $state('');   // the words of the prompt whose card was dismissed
  const things = $derived(xray.prompt ? (xray.run, cantSeeThings(xray.raw)) : []);
  const key = $derived(xray.prompt ? (xray.run, xray.raw) : '');
  $effect(() => { if (!xray.prompt) gone = ''; });   // a new prompt (or Start over) brings the card back
  const show = $derived(things.length > 0 && gone !== key);
</script>

{#if show}
  <aside class="cantsee" id="cantSee" role="status" transition:slide={{ duration: ms(250) }}>
    <p class="cs">🙈 {cantSeeLine(things)}</p>
    <button type="button" id="cantSeeGot" onclick={() => (gone = key)}>Got it</button>
  </aside>
{/if}

<style>
  .cantsee { display: grid; gap: var(--sp-2); margin: var(--sp-3) 0 var(--sp-2); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--accent-soft); }
  .cs { margin: 0; font-size: var(--fs-sm); line-height: 1.4; color: var(--ink); overflow-wrap: anywhere; }
  button { justify-self: start; min-height: 48px; padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); font-size: var(--fs-sm); font-weight: 700; color: var(--accent); background: var(--surface); border: none; }
  button:active { transform: scale(0.97); }
</style>
