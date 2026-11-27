<script>
  /* A part of the page most people never open (Test lab, Your core, Mic log): its code is fetched
     the first time it shows, so everyone else's first screen loads less. While it is on its way,
     an optional `waiting` line says so (a slow phone would otherwise show an empty card). If the
     fetch fails (offline, or a newer build replaced the file), say so and offer a reload. */
  let { load, waiting = '', ...props } = $props();
</script>

{#await load()}
  {#if waiting}<p class="hint" data-lazywait role="status">{waiting}</p>{/if}
{:then m}
  <m.default {...props} />
{:catch}
  <p class="hint" data-lazyfail role="alert">Couldn't load this part. <button type="button" class="linkish" onclick={() => location.reload()}>Reload the page</button></p>
{/await}
