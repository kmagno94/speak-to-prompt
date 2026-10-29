<script>
  /* Compare rounds: an Amazon-style spec table for 2 or 3 Rework rounds, so you can see
     which round shines where and keep the one you like. Every cell comes from the Quality
     check each round already got (lib/compare.js), so opening it costs nothing. 🏆 marks
     the stronger round on a row only when the rounds differ. Memory only. */
  import { ui } from './lib/ui.svelte.js';
  const c = $derived(ui.compare);
  const viewing = $derived(ui.round ? ui.round.viewing : 0);
  const act = (a) => window.dispatchEvent(new CustomEvent('stp-act', { detail: { act: a, where: 'result' } }));
</script>

{#if c}
  <div class="cmp" id="compareRounds">
    {#if c.best}
      <p class="best" id="compareBest"><span aria-hidden="true">🏆</span> <b>Best overall: Round {c.best.n}</b> <span class="why">{c.best.why}</span></p>
    {:else}
      <p class="best wait">Still grading a round. The table fills in as each Quality check lands.</p>
    {/if}
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col"><span class="sr">Part of the prompt</span></th>
            {#each c.rounds as n, i (n)}
              <th scope="col" class:on={viewing === n} class:top={c.best && c.best.index === i}>
                <span class="rn">Round</span><span class="num">{n}{#if c.best && c.best.index === i}<span aria-hidden="true"> 🏆</span>{/if}</span>
                {#if viewing === n}
                  <span class="here">Showing</span>
                {:else}
                  <button type="button" class="use" id={'compareUse' + n} onclick={() => act('round' + n)} aria-label={'Use round ' + n}>Use</button>
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each c.rows as row (row.key)}
            <tr class:first={row.key === 'overall'}>
              <th scope="row">{row.label}</th>
              {#each row.cells as cell, i (i)}
                <td class:win={row.win.includes(i)} class:no={cell.ok === false && row.key !== 'overall'} class:on={viewing === c.rounds[i]}>
                  {cell.text}{#if row.win.includes(i)}<span class="tr" aria-hidden="true"> 🏆</span><span class="sr"> (stronger)</span>{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if c.contrasts.length}
      <div class="diff">
        <p class="dh">Where they differ</p>
        <ul>{#each c.contrasts as line (line)}<li>{line}</li>{/each}</ul>
      </div>
    {/if}
    <p class="note">🏆 = has it when another round doesn't. Scores come from each round's Quality check.</p>
  </div>
{/if}

<style>
  .cmp { display: grid; gap: var(--sp-2); min-width: 0; }
  .cmp > * { min-width: 0; }
  .best { margin: 0; font-size: var(--fs-sm); line-height: 1.45; }
  .best b { font-family: var(--display); }
  .best .why { color: var(--muted, inherit); }
  .best.wait { opacity: 0.8; }
  .scroll { overflow-x: auto; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--bg); }
  table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  th, td { padding: 7px 3px; text-align: center; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
  tbody th { text-align: left; font-weight: 600; line-height: 1.25; padding-left: 8px; }
  thead th { font-weight: 700; vertical-align: bottom; }
  thead th { width: 17%; }
  thead th:first-child { width: auto; }
  thead th .rn { display: block; font-size: 11px; font-weight: 600; opacity: 0.75; }
  thead th .num { display: block; font-family: var(--display); font-size: var(--fs-md); white-space: nowrap; }
  thead th .num span { font-size: 12px; }
  .here { display: block; margin-top: 4px; font-size: 11px; font-weight: 600; opacity: 0.75; min-height: 32px; line-height: 32px; }
  .use { display: block; margin: 4px auto 0; min-height: 32px; padding: 0 8px; min-width: 44px; border-radius: 99px; border: 1.5px solid var(--accent); background: transparent; color: var(--accent); font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .use:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  td.on, th.on { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  td.win { font-weight: 800; color: var(--accent); }
  td.no { opacity: 0.6; }
  tr.first td, tr.first th { font-weight: 800; }
  .tr { font-size: 11px; }
  .diff { display: grid; gap: 4px; }
  .dh { margin: 0; font-weight: 700; font-size: var(--fs-sm); }
  .diff ul { margin: 0; padding-left: 1.1em; display: grid; gap: 2px; font-size: var(--fs-sm); line-height: 1.45; }
  .note { margin: 0; font-size: 12px; opacity: 0.75; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
