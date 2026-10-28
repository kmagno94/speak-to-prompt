<script>
  /* Start here: a pointer over the empty box on open, until the first real action.
     State and the "seen" flag live in lib/starthere.svelte.js. Taps go straight
     through to the box underneath. Reduce Motion: a still highlight, no pulse. */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { startHere } from './lib/starthere.svelte.js';
  import { ms } from './lib/motion.js';

  let talk = $state(false);

  onMount(() => {
    startHere.open();
    const box = document.getElementById('thoughts');
    const talkLink = document.getElementById('talkLink');
    /* app.js hides Talk it out on computers right after this mounts, so look a moment later. */
    const t = setTimeout(() => { talk = !!talkLink && !talkLink.hidden; }, 0);
    const done = () => startHere.started();
    const typed = () => { if (box.value.trim()) done(); };
    const hits = [['thoughts', 'focus'], ['thoughts', 'pointerdown'], ['talkLink', 'click'], ['ideasTry', 'click'], ['bannerPaste', 'click']];
    hits.forEach(([id, ev]) => document.getElementById(id)?.addEventListener(ev, done));
    box.addEventListener('input', typed);
    box.addEventListener('stp:changed', typed);
    /* The Talk it out shortcut coming back to paste counts too. */
    const hand = () => { if (location.hash === '#paste') done(); };
    window.addEventListener('hashchange', hand);
    return () => {
      window.removeEventListener('hashchange', hand);
      clearTimeout(t);
      hits.forEach(([id, ev]) => document.getElementById(id)?.removeEventListener(ev, done));
      box.removeEventListener('input', typed);
      box.removeEventListener('stp:changed', typed);
    };
  });

  /* The box and Talk it out glow together while the pointer shows. */
  $effect(() => {
    const on = startHere.active;
    document.querySelector('.ideabox')?.classList.toggle('starthere-on', on);
    document.getElementById('talkLink')?.classList.toggle('starthere-on', on && talk);
  });
</script>

{#if startHere.active}
  <div class="starthere" id="startHere" role="note" transition:fade={{ duration: ms(220) }}>
    <span class="tap" aria-hidden="true"></span>
    <b>✍️ Start here</b>
    <span>Type what's on your mind. Messy is fine.</span>
    {#if talk}<span class="or" id="startHereTalk">or tap <b>Talk it out</b> above ↑</span>{/if}
  </div>
{/if}

<style>
  .starthere {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    display: grid; place-content: center; justify-items: center; gap: 6px; padding: 16px; text-align: center;
    font-size: 16px; color: var(--ink); border-radius: 10px;
  }
  .starthere b { font-size: 18px; color: var(--accent); }
  .starthere .or { font-size: 14px; color: var(--muted); }
  .starthere .or b { font-size: 14px; }
  .tap { width: 18px; height: 18px; border-radius: 50%; background: var(--accent); opacity: 0.85; margin-bottom: 4px; }
  @media (prefers-reduced-motion: no-preference) {
    .tap { animation: sh-tap 1.5s ease-out infinite; }
    @keyframes sh-tap {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); transform: scale(0.9); }
      60% { box-shadow: 0 0 0 18px transparent; transform: scale(1); }
      100% { box-shadow: 0 0 0 0 transparent; transform: scale(0.9); }
    }
  }
</style>
