<script>
  /* Long prompts: the box keeps a tidy height, and "Show the whole prompt" opens it to
     full length (and back). Shows only when the prompt is taller than the box. */
  import { onMount } from 'svelte';
  let long = $state(false);
  let open = $state(false);
  let out;
  function measure() {
    if (!out) return;
    if (open) { out.style.height = 'auto'; out.style.height = out.scrollHeight + 'px'; return; }
    out.style.height = '';
    long = out.scrollHeight > out.clientHeight + 24;
  }
  function toggle() { open = !open; measure(); if (!open) out.scrollTop = 0; }
  onMount(() => {
    out = document.getElementById('output');
    const reset = () => { open = false; requestAnimationFrame(measure); };
    const mo = new MutationObserver(reset);
    const made = document.getElementById('madeBy'), result = document.getElementById('result');
    if (made) mo.observe(made, { childList: true, characterData: true, subtree: true });
    if (result) mo.observe(result, { attributes: true, attributeFilter: ['hidden'] });
    addEventListener('resize', measure);
    return () => { mo.disconnect(); removeEventListener('resize', measure); };
  });
</script>

{#if long}
  <button type="button" class="link more" id="outputMore" aria-expanded={open} aria-controls="output" onclick={toggle}>{open ? 'Show less' : 'Show the whole prompt'}</button>
{/if}

<style>
  .more { justify-self: start; align-self: flex-start; min-height: 40px; font-weight: 700; margin-top: calc(var(--sp-2) * -1); }
</style>
