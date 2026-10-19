<script>
  /* Glow-Up: your messy thoughts and the finished prompt stacked on top of each
     other, with a slider between them. It sweeps once from messy to clean when it
     opens, then you can drag it. "Save as image" draws a card on the phone and
     opens the share sheet. Nothing is uploaded, and your core (About me) is never
     on the card. Shows a short preview unless you choose Show more. */
  import { xray } from './lib/xray.svelte.js';
  import { analyze } from './lib/xray.js';

  const APP_URL = 'kmagno94.github.io/speak-to-prompt';
  const SHORT_WORDS = 45;

  let dialog;
  let v = $state(0);            // 0 = all messy, 100 = all clean
  let full = $state(false);
  let status = $state('');
  let saving = $state(false);
  let sweep = 0, wait = 0;

  /* The prompt without your core block. */
  const prompt = $derived.by(() => {
    const p = String(xray.prompt || '').trimEnd(), c = String(xray.core || '').trim();
    return c && p.endsWith(c) ? p.slice(0, -c.length).trimEnd() : p;
  });
  const raw = $derived(String(xray.raw || '').trim());
  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const clip = (t, n) => { const w = t.trim().split(/\s+/); return w.length > n ? w.slice(0, n).join(' ') + ' ...' : t.trim(); };
  const before = $derived(full ? raw : clip(raw, SHORT_WORDS));
  const after = $derived(full ? prompt : clip(prompt, SHORT_WORDS));
  const pct = $derived(prompt && raw ? analyze(prompt, raw, xray.answers).pct : 0);

  function reduced() { return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  export function open() {
    full = false; status = '';
    if (!dialog.open) dialog.showModal();
    stopSweep();
    if (reduced()) { v = 50; return; }
    /* The one moment: the mess wipes into the clean prompt. */
    v = 0;
    let t0 = 0;
    const dur = 1400;
    const step = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      v = Math.round(100 * (1 - Math.pow(1 - k, 3)));
      if (k < 1) sweep = requestAnimationFrame(step);
    };
    wait = setTimeout(() => { sweep = requestAnimationFrame(step); }, 350);
  }
  function stopSweep() { clearTimeout(wait); cancelAnimationFrame(sweep); }
  function close() { stopSweep(); dialog.close(); }
  function backdrop(e) { if (e.target === dialog) close(); }
  function drag() { stopSweep(); }

  /* ---------- The image card, drawn on a canvas (1080 x 1350, fits a text or a story) ---------- */
  const C = { bg: '#e9edf2', card: '#ffffff', ink: '#18212c', muted: '#566170', line: '#d3dae3', rule: '#c9d6e6', accent: '#1d5c8c', soft: '#dbe8f3' };
  const DISPLAY = '"Bricolage Grotesque", "Avenir Next", "Segoe UI", sans-serif';
  const BODY = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';

  function wrap(ctx, text, width, maxLines) {
    const lines = [];
    for (const para of String(text).split(/\n+/)) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test;
      }
      if (line) lines.push(line);
    }
    if (lines.length > maxLines) {
      const cut = lines.slice(0, maxLines);
      let last = cut[maxLines - 1];
      while (last && ctx.measureText(last + ' ...').width > width) last = last.replace(/\s*\S+$/, '');
      cut[maxLines - 1] = last + ' ...';
      return cut;
    }
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  export function drawCard(canvas) {
    const W = 1080, H = 1350, P = 72;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    // Header
    ctx.fillStyle = C.soft; roundRect(ctx, P, P, 236, 56, 28); ctx.fill();
    ctx.fillStyle = C.accent; ctx.font = '700 28px ' + BODY; ctx.fillText('✨ Glow-Up', P + 26, P + 13);
    ctx.fillStyle = C.ink; ctx.font = '700 58px ' + DISPLAY;
    ctx.fillText('From messy thoughts', P, P + 92); ctx.fillText('to a ready prompt', P, P + 156);

    const size = full ? 27 : 31, lh = Math.round(size * 1.45);
    const innerW = W - P * 2 - 72;

    // Before: loose scratchpad, slightly tilted
    ctx.font = size + 'px ' + BODY;
    const bLines = wrap(ctx, before || '(nothing typed)', innerW, full ? 8 : 5);
    const bH = 76 + bLines.length * lh + 34;
    let y = P + 260;
    ctx.save();
    ctx.translate(W / 2, y + bH / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -(y + bH / 2));
    ctx.fillStyle = '#f4f6f9'; roundRect(ctx, P, y, W - P * 2, bH, 22); ctx.fill();
    ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.strokeStyle = C.line; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.muted; ctx.font = '700 24px ' + BODY; ctx.fillText('Before: what I said', P + 36, y + 30);
    ctx.fillStyle = C.muted; ctx.font = size + 'px ' + BODY;
    bLines.forEach((l, i) => ctx.fillText(l, P + 36, y + 76 + i * lh));
    ctx.restore();

    // Arrow between
    y += bH + 22;
    ctx.fillStyle = C.accent; ctx.font = '700 40px ' + BODY; ctx.textAlign = 'center'; ctx.fillText('↓', W / 2, y); ctx.textAlign = 'left';
    y += 64;

    // After: clean index card with ruled lines
    ctx.font = size + 'px ' + BODY;
    const room = H - y - 210;
    const aMax = Math.max(4, Math.floor((room - 110) / lh));
    const aLines = wrap(ctx, after, innerW, aMax);
    const aH = 76 + aLines.length * lh + 34;
    ctx.fillStyle = C.card; roundRect(ctx, P, y, W - P * 2, aH, 22); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = C.accent; ctx.fillRect(P, y + 18, 10, aH - 36);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 2;
    for (let i = 0; i < aLines.length; i++) { const ly = y + 76 + (i + 1) * lh - 4; ctx.beginPath(); ctx.moveTo(P + 36, ly); ctx.lineTo(W - P - 36, ly); ctx.stroke(); }
    ctx.fillStyle = C.accent; ctx.font = '700 24px ' + BODY; ctx.fillText('After: the prompt', P + 36, y + 30);
    ctx.fillStyle = C.ink; ctx.font = size + 'px ' + BODY;
    aLines.forEach((l, i) => ctx.fillText(l, P + 36, y + 76 + i * lh));

    // Numbers
    y += aH + 40;
    ctx.fillStyle = C.ink; ctx.font = '700 34px ' + DISPLAY;
    ctx.fillText(words(raw) + ' messy words → ' + words(prompt) + ' clear ones', P, y);
    ctx.fillStyle = C.muted; ctx.font = '28px ' + BODY;
    ctx.fillText(pct + '% of the prompt is my own words', P, y + 50);

    // Footer
    ctx.fillStyle = C.line; ctx.fillRect(P, H - P - 64, W - P * 2, 2);
    ctx.fillStyle = C.ink; ctx.font = '700 30px ' + DISPLAY; ctx.fillText('Speak to Prompt', P, H - P - 40);
    ctx.fillStyle = C.muted; ctx.font = '26px ' + BODY; ctx.textAlign = 'right'; ctx.fillText(APP_URL, W - P, H - P - 36); ctx.textAlign = 'left';
    return canvas;
  }

  async function save() {
    saving = true; status = '';
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = drawCard(document.createElement('canvas'));
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'glow-up.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: 'My Glow-Up' }); status = 'Shared. 🎉'; }
        catch (e) { status = e && e.name === 'AbortError' ? '' : 'Couldn\'t open the share sheet.'; }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'glow-up.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        status = 'Saved as glow-up.png.';
      }
    } catch (e) { status = 'Couldn\'t make the image on this browser.'; }
    saving = false;
  }
</script>

{#if xray.prompt}
  <button type="button" id="glowBtn" class="glow" onclick={open}>✨ Glow-Up</button>
{/if}

<dialog class="glowup" id="glowup" bind:this={dialog} onclick={backdrop} aria-labelledby="glowTitle">
  <div class="sheet">
    <div class="top">
      <h2 id="glowTitle">✨ Your Glow-Up</h2>
      <button type="button" class="x" onclick={close} aria-label="Close">✕</button>
    </div>
    <p class="intro">Drag to see your messy thoughts turn into the prompt.</p>

    <div class="stage" class:full style="--v: {v}%">
      <div class="layer before" id="glowBefore"><span class="lbl">Before: what you said</span><p>{before}</p></div>
      <div class="layer after" id="glowAfter" aria-hidden={v < 50}><span class="lbl">After: the prompt</span><p>{after}</p></div>
      <div class="seam" aria-hidden="true"><i></i></div>
      <input type="range" id="glowRange" min="0" max="100" bind:value={v} oninput={drag} onpointerdown={drag} aria-label="Before and after">
    </div>

    <p class="glowstats" id="glowStats"><b>{words(raw)}</b> messy words → <b>{words(prompt)}</b> clear ones · <b>{pct}%</b> your words</p>

    <label class="check"><input type="checkbox" id="glowFull" bind:checked={full}> Show more of my words</label>
    <p class="fine">Shows the first few lines unless you turn this on. The image is made on your phone and only goes where you send it. Your core is never on it.</p>

    <div class="actions">
      <button type="button" class="primary" id="glowSave" onclick={save} disabled={saving}>{saving ? 'Making it...' : 'Save as image'}</button>
      <button type="button" id="glowDone" onclick={close}>Done</button>
    </div>
    <p class="status" id="glowStatus" role="status">{status}</p>
  </div>
</dialog>

<style>
  /* Same pill as X-ray, outlined so X-ray stays the main one. */
  .glow { margin-right: auto; min-height: 0; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; color: var(--accent); background: none; border: 1.5px solid var(--accent-soft); }
  .glowup { border: 0; padding: 0; margin: auto; width: min(560px, calc(100% - 24px)); max-height: calc(100dvh - 24px); border-radius: 18px; background: var(--surface); color: var(--ink); box-shadow: 0 24px 60px -20px rgba(10, 20, 40, 0.55); }
  .glowup::backdrop { background: color-mix(in srgb, #0b1420 55%, transparent); }
  .sheet { max-height: calc(100dvh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 20px 18px 16px; display: grid; gap: 12px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  /* The id beats the page's #result h2 underline (the dialog lives inside the result card). */
  #glowTitle { font-family: var(--display); font-size: 26px; line-height: 1.1; letter-spacing: -0.02em; margin: 0; padding: 0; border: 0; }
  .x { min-height: 40px; min-width: 40px; padding: 0; border-radius: 999px; border: 0; background: var(--bg); color: var(--muted); font-size: 16px; flex: none; }
  .intro, .fine { margin: 0; color: var(--muted); font-size: 14px; }

  /* Two cards in the same spot; the slider wipes the clean one over the messy one. */
  .stage { position: relative; height: 300px; border-radius: 14px; overflow: hidden; touch-action: pan-y; }
  .stage.full { height: 460px; }
  .layer { position: absolute; inset: 0; padding: 14px 16px; overflow: hidden; font-size: 15px; line-height: 1.55; }
  .layer p { margin: 6px 0 0; white-space: pre-wrap; }
  .layer::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; background: linear-gradient(transparent, var(--fade)); }
  .lbl { font-size: 12px; font-weight: 700; }
  .before { --fade: var(--bg); background: var(--bg); border: 1.5px dashed var(--line); border-radius: 14px; color: var(--muted); }
  .before p { transform: rotate(-0.6deg); }
  .after { --fade: var(--surface); background: var(--surface); border: 1px solid var(--line); border-left: 5px solid var(--accent); border-radius: 14px; color: var(--ink);
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.55em - 1px), var(--rule) calc(1.55em - 1px), var(--rule) 1.55em); background-position: 0 calc(14px + 18px + 6px);
    clip-path: inset(0 calc(100% - var(--v)) 0 0); }
  .after .lbl { color: var(--accent); }
  .seam { position: absolute; top: 0; bottom: 0; left: var(--v); width: 0; pointer-events: none; }
  .seam::before { content: ""; position: absolute; top: 0; bottom: 0; left: -1.5px; width: 3px; background: var(--accent); }
  .seam i { position: absolute; top: 50%; left: -16px; width: 32px; height: 32px; margin-top: -16px; border-radius: 50%; background: var(--accent); box-shadow: 0 2px 10px rgba(10, 20, 40, 0.3); }
  .seam i::before { content: "‹ ›"; position: absolute; inset: 0; display: grid; place-items: center; color: var(--accent-ink); font-style: normal; font-weight: 700; font-size: 14px; letter-spacing: 1px; }
  input[type="range"] { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; }
  .stage:focus-within .seam i { outline: 3px solid var(--accent); outline-offset: 3px; }

  .glowstats { margin: 0; font-size: 15px; }
  .actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
  .status { margin: 0; min-height: 1.2em; font-size: 14px; color: var(--ok); }
</style>
