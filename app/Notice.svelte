<script>
  /* Shows the current message for one place on the page (ui.notices[where]) in the shared
     Message look. Buttons send their `act` to app.js as a window 'stp-act' event. */
  import { ui } from './lib/ui.svelte.js';
  import Message from './Message.svelte';
  let { where } = $props();
  const n = $derived(ui.notices[where]);
  function onact(act) { window.dispatchEvent(new CustomEvent('stp-act', { detail: { act, where } })); }
</script>

{#if n}
  {#key n.at}
    <Message id={'notice-' + where} kind={n.kind} title={n.title} text={n.text} actions={n.actions} {onact} />
  {/key}
{/if}
