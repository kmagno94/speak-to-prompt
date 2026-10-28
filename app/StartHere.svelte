<script>
  /* Start here: a white halo walks you in on open, until the first real action.
     The title's own entrance plays first, then the title and description pulse, then the page scrolls to Talk it out and the
     box, which pulse with ✍️ Start here. State and the "seen" flag live in
     lib/starthere.svelte.js. Taps go straight through to the box underneath.
     Reduce Motion: a still halo and a jump instead of a scroll. */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { startHere } from './lib/starthere.svelte.js';
  import { ms, reduceMotion } from './lib/motion.js';

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

  /* Spotlight: the rest of the page dims a little so the white halo stands out (light
     mode; dark mode's glow already does). It lives on <body> so nothing can trap it. */
  let scrim;
  onMount(() => {
    scrim = document.createElement('div');
    scrim.className = 'sh-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scrim);
    return () => scrim.remove();
  });

  /* Which parts wear the halo (and sit above the spotlight) in each phase. */
  $effect(() => {
    const p = startHere.phase;
    const set = (el, on, cls = 'sh-halo') => el && el.classList.toggle(cls, on);
    set(document.querySelector('.wrap > header .intro'), p === 'title');
    set(document.getElementById('thoughts'), p === 'box');
    set(document.getElementById('talkLink'), p === 'box' && talk);
    set(document.querySelector('.wrap > header'), p === 'title', 'sh-lift');
    /* The whole input card lifts: its entrance animation keeps its insides from lifting on their own. */
    set(document.getElementById('form'), p === 'box', 'sh-lift');
    scrim?.classList.toggle('on', p === 'title' || p === 'box');
    /* Step two: bring Talk it out and the box into view, and let the pointer speak
       instead of the box's own hint (app.js puts the hint back when the ideas settle). */
    if (p === 'box') {
      document.getElementById('form')?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      const box = document.getElementById('thoughts');
      if (box) box.placeholder = '';
    }
  });
</script>

{#if startHere.phase === 'box'}
  <div class="starthere" id="startHere" role="note" transition:fade={{ duration: ms(260) }}>
    <div class="pill">
      <b>✍️ Start here</b>
      <span>Type what's on your mind. Messy is fine.</span>
      {#if talk}<span class="or" id="startHereTalk">or tap <b>Talk it out</b> above ↑</span>{/if}
    </div>
  </div>
{/if}

<style>
  .starthere {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    display: grid; place-content: center; padding: 16px; text-align: center;
    font-size: 16px; color: var(--ink); border-radius: 10px;
  }
  .pill { display: grid; justify-items: center; gap: 6px; padding: 14px 18px; border-radius: 16px;
    background: var(--surface); box-shadow: 0 6px 24px var(--halo-drop), 0 0 0 1px var(--halo-edge); }
  .starthere b { font-size: 20px; color: var(--ink); }
  .starthere .or { font-size: 14px; color: var(--muted); }
  .starthere .or b { font-size: 14px; }
</style>
