<script>
  /* 💡 Ideas tab (owner only): a side panel for logging bugs, ideas, and faster ways
     while using the app, then handing them all to Claude in one Fix session prompt.
     Shown only when "Show my Ideas tab" is on in More options. See lib/ideas.svelte.js. */
  import { onMount, tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { ms } from './lib/motion.js';
  import { ideas, startTrail, fixPrompt, KINDS, SOON, AREAS, areaOf } from './lib/ideas.svelte.js';
  import { packIdeas } from './lib/ideashare.js';
  import { IS_STAGING } from './lib/channel.js';
  import { core } from './lib/core.svelte.js';

  /* Owner only (v2.1.48): Fix session and Paste shared ideas show only with Show my dev tools on,
     which is on for Kevin's phone (it turns itself on for a phone with a core). Anyone else
     testing the app (dev tools off) logs ideas and gets Send your ideas to Kevin instead.
     It hides the parts, it isn't a lock: nothing here is secret. */
  const owner = $derived(core.dev);

  let kind = $state('');
  let area = $state('');
  let topic = $state('');
  let topicChosen = $state(false);
  let text = $state('');
  let soon = $state('soon');
  let starter = '';
  let saved = $state('');
  let fixMsg = $state('');
  let armed = $state('');
  let showDone = $state(false);
  let panel = $state();
  let fixBox = $state();

  const K = $derived(KINDS.find((k) => k.key === kind) || KINDS[0]);
  const A = $derived(areaOf(area));
  const groups = $derived([...new Set(AREAS.map((a) => a.group))].map((g) => [g, AREAS.filter((a) => a.group === g)]));
  const picks = $derived(ideas.open ? ideas.suggestions(kind) : []);
  const ready = $derived(!!(kind && area && text.trim() && soon));
  const done = $derived(ideas.list.filter((i) => i.status !== 'open'));

  onMount(() => { startTrail(); ideas.syncDone(); });
  $effect(() => { if (ideas.open) ideas.syncDone(); });
  let clearArmed = $state(false);
  function clearDone() { if (!clearArmed) { clearArmed = true; return; } ideas.clearDone(); clearArmed = false; showDone = false; }

  $effect(() => { if (ideas.open) tick().then(() => panel?.querySelector('button.ichip')?.focus()); });

  function close() { ideas.open = false; armed = ''; }
  function onKey(e) { if (e.key === 'Escape' && ideas.open) close(); }

  function pickArea(key) { area = key; topic = ''; topicChosen = false; }
  function pickTopic(t) {
    topic = t ? t[0] : ''; topicChosen = true;
    if (!text.trim() || text === starter) { starter = t ? t[2] : ''; text = starter; }
  }
  function pickSuggestion(g) {
    pickArea(g.area);
    const t = areaOf(g.area)?.topics.find((x) => x[0] === g.topic);
    pickTopic(t || null);
  }

  function send() {
    if (!ready) return;
    ideas.add({ kind, area, topic, text, soon });
    saved = `${K.icon} In the jar. ${ideas.openList.length} open.`;
    clearShare();
    kind = ''; area = ''; topic = ''; topicChosen = false; text = ''; starter = ''; soon = 'soon';
  }

  async function copyFix() {
    const p = fixPrompt();
    try { await navigator.clipboard.writeText(p); fixMsg = 'Copied. Open Claude and paste it into a new chat.'; }
    catch (e) { fixMsg = 'Couldn’t copy. It’s selected below: copy it by hand.'; await tick(); fixBox?.select(); }
  }

  /* Shared ideas (v2.1.48): copy your own open ideas to text to Kevin, or paste someone's in. */
  let shareMsg = $state(''), shareBad = $state(false), pasteOpen = $state(false), pasteText = $state('');
  let shareBox = $state(), shareOut = $state('');
  let shareTick = $state(0);
  const sayShare = (m, bad = false) => { shareMsg = m; shareBad = bad; shareTick++; };
  /* v2.1.50 (Test lab 11/24, "I keep getting this when I try to copy"): an old answer used to stay on
     screen after you dropped an idea or typed your name, so it looked like the answer to the next tap.
     Now a change to the jar or the name clears it, and every tap's answer flashes in fresh. */
  const clearShare = () => { shareMsg = ''; shareBad = false; shareOut = ''; };
  /* iPhone Safari can leave a clipboard write hanging with no answer; after 1.5 seconds it counts as a no. */
  const writeClip = (t) => Promise.race([navigator.clipboard.writeText(t), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]);
  /* v2.1.49 (Test lab 11/19, "Copy my ideas did not work"): the button used to go gray with no
     word when every open idea was pasted in from someone else (Sample cousin), so a tap did nothing.
     Now it always answers: no ideas of your own says so; a browser that won't copy shows the message
     selected in a box to copy by hand (like Fix session), with an old-style copy tried first. */
  async function copyShare() {
    shareOut = '';
    const n = ideas.mine.length;
    if (!n) {
      const from = [...new Set(ideas.openList.map((i) => i.from).filter(Boolean))].join(' and ');
      return sayShare(ideas.openList.length ? `Nothing to copy yet: your ${ideas.openList.length} open idea${ideas.openList.length === 1 ? ' was' : 's were'} pasted in from ${from || 'someone else'}, and Copy my ideas only sends ideas you drop in the jar here. Drop one in above, then tap Copy my ideas (1).` : 'No ideas of your own yet. Drop one in the jar above first, then Copy my ideas.', true);
    }
    const t = ideas.shareText();
    const ok = `Copied ${n} idea${n === 1 ? '' : 's'}. Paste it in a text to Kevin.`;
    try { await writeClip(t); return sayShare(ok); } catch (e) {}
    shareOut = t;
    await tick();
    shareBox?.focus(); shareBox?.select();
    let old = false; try { old = document.execCommand('copy'); } catch (e) {}
    if (old) { shareOut = ''; return sayShare(ok); }
    sayShare('Couldn’t copy by itself here. The message is selected below: copy it by hand.', true);
  }
  function takeShared(t) {
    const note = ideas.readShared(t);
    if (!note) return sayShare('That isn’t a shared ideas message. Copy the whole text, from “Speak to Prompt · Shared ideas” to the end line.', true);
    if (!note.ideas.length) return sayShare('That message has no ideas in it.', true);
    const r = ideas.bringIn(note);
    pasteOpen = false; pasteText = '';
    sayShare(`From ${r.from}: ` + [r.added && `${r.added} added`, r.same && `${r.same} already here`].filter(Boolean).join(', ') + '.' + (r.added ? ' They’re in Open and ride the next Fix session.' : ''));
  }
  async function pasteShare() {
    try { const t = await navigator.clipboard.readText(); if (t && ideas.readShared(t)) return takeShared(t); } catch (e) {}
    pasteOpen = true;
    sayShare('Paste the message here, then tap Add to my jar.');
  }

  /* Staging test link #sharedsample (v2.1.48): opens the jar with a made-up message from
     "Sample cousin" in the paste box, so Paste shared ideas can be tried on one phone.
     Fixed ids, so a second try shows "already here". Staging only, nothing saved until you tap Add. */
  function sharedSample() {
    if (!IS_STAGING || !/sharedsample/.test(location.hash || '')) return;
    if (!core.dev) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} ideas.open = true; sayShare('Staging sample: turn on More options > Show my dev tools first (Paste shared ideas is owner only), then tap the link again.', true); return; }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    const day = '2026-11-18';
    pasteText = packIdeas([
      { id: 'samplecousin1', kind: 'idea', soon: 'soon', where: 'Your prompt', topicLabel: 'Too long or short', date: day, version: '2.1.47', text: 'Sample: the prompt for my bakery flyer was way longer than I needed, maybe a short version button?', context: { trail: ['Thoughts box', 'Building'] } },
      { id: 'samplecousin2', kind: 'bug', soon: 'now', where: 'Copy and open', topicLabel: '', date: day, version: '2.1.47', text: 'Sample: tapped Copy twice before it said copied, on my iPhone 13.', context: { trail: [] } }
    ], { from: 'Sample cousin', kinds: KINDS, soons: SOON });
    ideas.open = true; pasteOpen = true;
    sayShare('Staging sample: a made-up message from Sample cousin is in the box. Tap Add to my jar.');
    tick().then(() => document.getElementById('ideaShare')?.scrollIntoView({ block: 'center' }));
  }
  onMount(() => { sharedSample(); addEventListener('hashchange', sharedSample); return () => removeEventListener('hashchange', sharedSample); });

  function del(id) {
    if (armed !== id) { armed = id; return; }
    ideas.remove(id); armed = '';
  }

  /* Edit an open idea's text in place: Save keeps it, Cancel leaves it as it was. */
  let editing = $state('');
  let editText = $state('');
  async function startEdit(it) {
    editing = it.id; editText = it.text; armed = '';
    await tick();
    const box = panel?.querySelector(`.item[data-id="${it.id}"] textarea`);
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  }
  function saveEdit() { if (ideas.edit(editing, editText)) { editing = ''; editText = ''; } }
  function cancelEdit() { editing = ''; editText = ''; }

  const kindOf = (k) => KINDS.find((x) => x.key === k) || KINDS[0];
  const soonOf = (k) => SOON.find((x) => x.key === k) || SOON[1];
</script>

<svelte:window onkeydown={onKey} />

{#if ideas.on}
  <button type="button" class="ideatab" id="ideaTab" aria-expanded={ideas.open} onclick={() => (ideas.open = !ideas.open)} title="Log a bug or idea">
    <span aria-hidden="true">💡</span><span class="tablabel">Ideas</span>{#if ideas.openList.length}<b class="count">{ideas.openList.length}</b>{/if}
  </button>
{/if}

{#if ideas.on && ideas.open}
  <button type="button" class="veil" aria-label="Close ideas" onclick={close} transition:fade={{ duration: ms(180) }}></button>
  <aside class="ideapanel" id="ideaPanel" role="dialog" aria-modal="true" aria-labelledby="ideaTitle" bind:this={panel} transition:fly={{ x: 380, duration: ms(240), opacity: 1 }}>
    <div class="head">
      <div>
        <h2 id="ideaTitle">💡 Ideas jar</h2>
        <p class="sub">Bugs, ideas, faster ways. Saved on this phone only{ideas.todayCount ? ` · ${ideas.todayCount} today` : ''}.</p>
      </div>
      <button type="button" class="x" onclick={close} aria-label="Close">✕</button>
    </div>

    <section class="step">
      <p class="lbl">What is it?</p>
      <div class="ichips">
        {#each KINDS as k (k.key)}<button type="button" class="ichip big" id="ideaKind-{k.key}" class:on={kind === k.key} aria-pressed={kind === k.key} onclick={() => (kind = k.key)}><span aria-hidden="true">{k.icon}</span> {k.label}</button>{/each}
      </div>
    </section>

    {#if kind && picks.length}
      <section class="step" id="ideaPicks">
        <p class="lbl">Looks like it might be…</p>
        <div class="picks">
          {#each picks as g (g.area + g.topic)}
            {@const a = areaOf(g.area)}{@const t = a?.topics.find((x) => x[0] === g.topic)}
            <button type="button" class="pick" class:on={area === g.area && topic === g.topic} onclick={() => pickSuggestion(g)}>
              <b>{a?.label}{t ? ' › ' + t[1] : ''}</b><small>{g.why}</small>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if kind}
      <section class="step">
        <p class="lbl">Where?</p>
        {#each groups as [g, list] (g)}
          <div class="grp"><span class="gname">{g}</span>
            <div class="ichips">{#each list as a (a.key)}<button type="button" class="ichip" id="ideaArea-{a.key}" class:on={area === a.key} aria-pressed={area === a.key} onclick={() => pickArea(a.key)}>{a.label}</button>{/each}</div>
          </div>
        {/each}
      </section>
    {/if}

    {#if A}
      <section class="step">
        <p class="lbl">About what?</p>
        <div class="ichips">
          {#each A.topics as t (t[0])}<button type="button" class="ichip" class:on={topic === t[0]} aria-pressed={topic === t[0]} onclick={() => pickTopic(t)}>{t[1]}</button>{/each}
          <button type="button" class="ichip" class:on={topicChosen && !topic} aria-pressed={topicChosen && !topic} onclick={() => pickTopic(null)}>Something else</button>
        </div>
      </section>
      <section class="step">
        <label class="lbl" for="ideaText">Say it</label>
        <textarea id="ideaText" rows="3" bind:value={text} placeholder={K.ph} maxlength="1000"></textarea>
      </section>
      <section class="step">
        <p class="lbl">How soon?</p>
        <div class="ichips">
          {#each SOON as s (s.key)}<button type="button" class="ichip" class:on={soon === s.key} aria-pressed={soon === s.key} onclick={() => (soon = s.key)}><span aria-hidden="true">{s.icon}</span> {s.label}<small>{s.hint}</small></button>{/each}
        </div>
      </section>
    {/if}

    {#if kind}
      <button type="button" class="primary send" id="ideaSave" disabled={!ready} onclick={send}>{ready ? 'Drop it in the jar' : 'Pick a spot and say what it is'}</button>
    {/if}
    {#if saved}<p class="saved" id="ideaSaved" role="status">{saved}</p>{/if}

    {#if owner}
    <section class="fix" id="ideaFixBox">
      <p class="lbl">🛠️ Fix session</p>
      <p class="sub">{ideas.openList.length ? `Hands all ${ideas.openList.length} open idea${ideas.openList.length === 1 ? '' : 's'} to a new Claude chat, oldest first, with the repo and the staging rules.` : 'No open ideas yet. Log one above and it shows up here.'}</p>
      <div class="row">
        <button type="button" id="ideaFix" disabled={!ideas.openList.length} onclick={copyFix}>Copy fix session</button>
        <a class="openclaude" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a>
      </div>
      {#if fixMsg}<p class="sub" role="status" id="ideaFixMsg">{fixMsg}</p>{/if}
      {#if fixMsg.startsWith('Couldn')}<textarea class="fixbox" readonly bind:this={fixBox} value={fixPrompt()} aria-label="Fix session prompt"></textarea>{/if}
    </section>
    {/if}

    <section class="fix share" id="ideaShare">
      <p class="lbl">{owner ? '👥 Shared ideas' : '📤 Send your ideas to Kevin'}</p>
      <p class="sub">{owner ? 'Got ideas from someone testing the app? Copy their whole message, then tap Paste. They land in Open and ride your Fix session.' : 'Type your first name, tap Copy my ideas, and paste it in a text to Kevin. That’s it: he takes it from there.'}</p>
      <label class="namebox" for="ideaName"><span>Your first name, so Kevin knows who sent it</span>
        <input id="ideaName" maxlength="30" autocomplete="given-name" placeholder="Like Maria" value={ideas.name} oninput={(e) => { ideas.setName(e.currentTarget.value); if (shareBad) clearShare(); }}>
      </label>
      <div class="row">
        <button type="button" id="ideaCopyShare" class:quiet={!ideas.mine.length} onclick={copyShare}>📋 Copy my ideas{ideas.mine.length ? ` (${ideas.mine.length})` : ''}</button>
        {#if owner}<button type="button" id="ideaPasteShare" onclick={pasteShare}>📥 Paste shared ideas</button>{/if}
      </div>
      {#if pasteOpen}
        <label class="sr" for="ideaPasteBox">Paste the shared ideas message</label>
        <textarea id="ideaPasteBox" rows="4" placeholder="Paste the whole message here" bind:value={pasteText}></textarea>
        <button type="button" class="primary" id="ideaPasteGo" disabled={!pasteText.trim()} onclick={() => takeShared(pasteText)}>Add to my jar</button>
      {/if}
      {#if shareOut}<textarea class="fixbox" id="ideaShareBox" readonly bind:this={shareBox} value={shareOut} aria-label="Your shared ideas message"></textarea>{/if}
      {#if shareMsg}{#key shareTick}<p class="sub sharemsg" class:bad={shareBad} role="status" id="ideaShareMsg" in:fade={{ duration: ms(220) }}>{shareMsg}</p>{/key}{/if}
    </section>

    <section class="list" aria-label="Your ideas">
      {#if ideas.closedNote}<p class="closed" id="ideaClosed" role="status">{ideas.closedNote}</p>{/if}
      <p class="lbl">Open <span class="n">{ideas.openList.length}</span></p>
      {#each ideas.openList as it (it.id)}
        <div class="item" data-id={it.id}>
          <span class="ic" aria-hidden="true">{kindOf(it.kind).icon}</span>
          <div class="body">
            {#if editing === it.id}
              <label class="sr" for="ideaEdit-{it.id}">Edit this idea</label>
              <textarea id="ideaEdit-{it.id}" class="editbox" rows="3" maxlength="1000" bind:value={editText}></textarea>
              <div class="acts">
                <button type="button" class="link save" disabled={!editText.trim()} onclick={saveEdit}>Save</button>
                <button type="button" class="link" onclick={cancelEdit}>Cancel</button>
              </div>
            {:else}
            <p class="txt">{it.text}</p>
            <p class="meta">{#if it.from}<b class="from">from {it.from}</b> · {/if}{it.where}{it.topicLabel ? ' › ' + it.topicLabel : ''} · {soonOf(it.soon).icon} {soonOf(it.soon).label} · {it.date}</p>
            <div class="acts">
              <button type="button" class="link" onclick={() => startEdit(it)}>Edit</button>
              <button type="button" class="link" onclick={() => ideas.setStatus(it.id, 'fixed')}>Mark fixed</button>
              <button type="button" class="link" onclick={() => ideas.setStatus(it.id, 'dismissed')}>Won’t do</button>
              <button type="button" class="link del" onclick={() => del(it.id)}>{armed === it.id ? 'Tap again to delete' : 'Delete'}</button>
            </div>
            {/if}
          </div>
        </div>
      {/each}
      {#if done.length}
        <button type="button" class="link" onclick={() => (showDone = !showDone)} aria-expanded={showDone}>{showDone ? 'Hide' : 'Show'} done ({done.length})</button>
        {#if showDone}
          {#each done as it (it.id)}
            <div class="item done" data-id={it.id}>
              <span class="ic" aria-hidden="true">{kindOf(it.kind).icon}</span>
              <div class="body">
                <p class="txt">{it.text}</p>
                <p class="meta">{it.where} · {it.status === 'fixed' ? `✅ Fixed${it.fixedIn ? ' in v' + it.fixedIn : ''}${it.by ? ' (' + it.by + ')' : ''}` : '🚫 Won’t do'}</p>
                {#if it.fixNote}<p class="meta">{it.fixNote}</p>{/if}
                <div class="acts">
                  <button type="button" class="link" onclick={() => ideas.setStatus(it.id, 'open')}>Reopen</button>
                  <button type="button" class="link del" onclick={() => del(it.id)}>{armed === it.id ? 'Tap again to delete' : 'Delete'}</button>
                </div>
              </div>
            </div>
          {/each}
          <button type="button" class="link del" id="ideaClearDone" onclick={clearDone}>{clearArmed ? `Tap again to clear ${done.length} done` : `Clear done (${done.length})`}</button>
        {/if}
      {/if}
    </section>

    <p class="privacy">Only what you type here is saved, on this phone. Nothing from your prompt box, questions, or results is ever kept, and the site sends nothing: Copy my ideas only goes where you paste it. Turn off in More options.</p>
  </aside>
{/if}

<style>
  .ideatab {
    position: fixed; z-index: 40; right: calc(env(safe-area-inset-right, 0px) + 12px); bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 10px 16px; border-radius: 999px;
    background: var(--surface); color: var(--ink); border: 1px solid var(--line); font-weight: 700;
    box-shadow: 0 10px 28px -12px color-mix(in srgb, var(--ink) 55%, transparent);
    transition: transform 0.15s ease-out;
  }
  .ideatab:active { transform: scale(0.96); }
  .ideatab[aria-expanded='true'] { opacity: 0; pointer-events: none; }
  .count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-size: 13px; display: inline-grid; place-items: center; font-variant-numeric: tabular-nums; }
  .veil { position: fixed; inset: 0; z-index: 49; border: 0; padding: 0; border-radius: 0; min-height: 0; background: color-mix(in srgb, #0b1420 45%, transparent); }
  .ideapanel {
    position: fixed; z-index: 50; top: 0; right: 0; bottom: 0; width: min(420px, 100vw); overflow-y: auto; overscroll-behavior: contain;
    background: var(--surface); color: var(--ink); border-left: 1px solid var(--line);
    padding: calc(env(safe-area-inset-top, 0px) + 16px) calc(env(safe-area-inset-right, 0px) + 16px) calc(env(safe-area-inset-bottom, 0px) + 24px) 16px;
    display: grid; gap: 16px; align-content: start; box-shadow: -24px 0 60px -30px rgba(10, 20, 40, 0.5);
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  h2 { margin: 0; font-family: var(--display); font-size: 24px; line-height: 1.15; }
  .sub { margin: 2px 0 0; font-size: 14px; color: var(--muted); }
  .x { flex: none; width: 44px; height: 44px; min-height: 44px; padding: 0; border-radius: 50%; }
  .step { display: grid; gap: 8px; }
  .lbl { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); }
  .lbl .n { font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .ichip { min-height: 44px; padding: 8px 14px; border-radius: 999px; font-size: 15px; transition: transform 0.15s ease-out; }
  .ichip:active, .pick:active { transform: scale(0.97); }
  .ichip.big { flex: 1 1 0; font-weight: 700; }
  .ichip small { display: block; font-size: 12px; color: var(--muted); }
  .ichip.on, .pick.on { background: var(--accent-soft); border-color: var(--accent); color: var(--ink); box-shadow: inset 0 0 0 1px var(--accent); }
  .grp { display: grid; gap: 6px; }
  .gname { font-size: 12px; color: var(--muted); }
  .picks { display: grid; gap: 8px; }
  .pick { display: grid; gap: 2px; text-align: left; min-height: 48px; padding: 10px 14px; border-style: dashed; transition: transform 0.15s ease-out; }
  .pick small { font-size: 13px; color: var(--muted); }
  textarea { width: 100%; min-height: 88px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; font-size: 16px; resize: vertical; }
  .send { width: 100%; }
  .saved { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ok) 14%, var(--surface)); color: var(--ok); font-weight: 700; }
  .fix { display: grid; gap: 8px; padding: 14px; border-radius: 14px; border: 1px dashed var(--line); background: var(--bg); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .openclaude { color: var(--accent); font-weight: 700; padding: 10px 4px; text-underline-offset: 3px; }
  .fixbox { min-height: 160px; font: 13px/1.45 var(--mono); }
  .list { display: grid; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px; }
  .item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; }
  .item .ic { font-size: 18px; line-height: 1.4; }
  .txt { margin: 0; overflow-wrap: anywhere; }
  .done .txt { text-decoration: line-through; color: var(--muted); }
  .meta { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
  .acts { display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .acts .link { min-height: 40px; }
  .del { color: var(--danger) !important; }
  .save { font-weight: 700; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .closed { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ok) 14%, var(--surface)); color: var(--ok); font-weight: 700; font-size: 14px; }
  .privacy { margin: 0; font-size: 13px; color: var(--muted); }
  .namebox { display: grid; gap: 4px; font-size: 14px; color: var(--muted); }
  .namebox input { font: inherit; font-size: 16px; color: var(--ink); background: var(--surface); min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; }
  .sharemsg { color: var(--accent); font-weight: 600; }
  .sharemsg.bad { color: var(--warn); }
  #ideaCopyShare.quiet { opacity: 0.6; }
  .from { color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .ideatab, .ichip, .pick { transition: none; } }
</style>
