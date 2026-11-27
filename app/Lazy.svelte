<script>
  /* A part of the page most people never open (Test lab, Your core, Mic log): its code is fetched
     the first time it shows, so everyone else's first screen loads less. While it is on its way,
     an optional `waiting` line says so (a slow phone would otherwise show an empty card). If the
     fetch fails (offline, or a newer build replaced the file), say so and offer Try again (keeps
     what's on screen), with a reload as the fallback. */
  import { retryPart } from './lib/retrypart.js';
  let { load, waiting = '', ...props } = $props();
  let again = $state.raw(null);
  const part = $derived(again || load());
</script>

{#await part}
  {#if waiting || again}<p class="hint" data-lazywait role="status">{waiting || 'Trying again…'}</p>{/if}
{:then m}
  <m.default {...props} />
{:catch}
  <p class="hint" data-lazyfail role="alert">Couldn't load this part. <button type="button" data-lazyretry onclick={() => (again = retryPart(load))}>Try again</button> <button type="button" class="linkish" data-lazyreload onclick={() => location.reload()}>Reload the page</button></p>
{/await}
