<script>
  /* A part of the page most people never open (Test lab, Your core, Mic log): its code is fetched
     the first time it shows, so everyone else's first screen loads less. If the fetch fails
     (offline, or a newer build replaced the file), say so and offer a reload. */
  let { load, ...props } = $props();
</script>

{#await load() then m}
  <m.default {...props} />
{:catch}
  <p class="hint" data-lazyfail role="alert">Couldn't load this part. <button type="button" class="linkish" onclick={() => location.reload()}>Reload the page</button></p>
{/await}
