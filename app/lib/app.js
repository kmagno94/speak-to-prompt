import { buildPrompt, ANALYZE, WRITE, repairPrompt, stackChoice, withStackHint } from './prompts.js';
import { analyze } from './xray.js';
import { assess } from './coach.js';
import { IDEAS as IDEA_LIST } from './ideas.js';
import { ui } from './ui.svelte.js';
import { chat } from './chat.svelte.js';
import { core } from './core.svelte.js';   /* core: dev-only, see core.svelte.js */
import { report, RELAY } from './report.svelte.js';
import { xray } from './xray.svelte.js';
import { starter } from './starter.svelte.js';
import { SLIDERS } from './starters.js';

export function startApp() {
  /* The deck shuffles in place, so each start works on its own copy. */
  var IDEAS = IDEA_LIST.slice();
  var form = document.getElementById("form");
  var thoughts = document.getElementById("thoughts");
  var err = document.getElementById("err");
  var result = document.getElementById("result");
  var output = document.getElementById("output");
  var status = document.getElementById("status");

  /* Run stats: a temporary build aid, off by default and switched on with the
     "Show run stats" toggle. While on, it saves only numbers on this device:
     each run's times, models, tokens, and word counts, plus today's request count
     per model. Never words or prompts. Turning it off deletes all of it. */
  var TEST_FLAG = "stp-test", TEST_LOG = "stp-test-log", TEST_USAGE = "stp-test-usage";
  /* Free-tier daily request limits from Kevin's AI Studio (Oct 2026). Models not
     listed here show their count without a limit. */
  var LIMITS = { "gemini-3.8-flash": 20, "gemini-3.7-flash": 20, "gemini-3.6-flash": 20, "gemini-3.5-flash-lite": 500 };
  var ASSUMED = { "gemini-3.7-flash": true };
  /* Daily limits: from a Usage Check, else what Google itself said in a limit error
     (learned on this device), else the usual free-tier number. */
  var LEARNED_KEY = "stp-learned-limits";
  function learnedLimits() { try { return JSON.parse(localStorage.getItem(LEARNED_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function learnLimit(model, n) { var l = learnedLimits(); l[model] = n; try { localStorage.setItem(LEARNED_KEY, JSON.stringify(l)); } catch (e) {} }
  function dailyLimit(model) { return (studio && studio.limits && studio.limits[model]) || learnedLimits()[model] || LIMITS[model] || null; }
  /* usage.json: Kevin's AI Studio numbers, updated by Claude from screenshots
     (the "Usage Check" key phrase). Counts from this device are added on top for
     runs after that snapshot. Only used when it's for today's Pacific day. */
  var studio = null;
  /* Google's daily limits reset at midnight Pacific. */
  function pacificDay() { try { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  var testLog = (function () {
    var on = false;
    function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function runs() { try { return JSON.parse(read(TEST_LOG) || "[]"); } catch (e) { return []; } }
    function usage() {
      var u = null;
      try { u = JSON.parse(read(TEST_USAGE) || "null"); } catch (e) {}
      if (!u || u.day !== pacificDay()) u = { day: pacificDay(), models: {} };
      return u;
    }
    var COLS = ["when", "mode", "complexity", "depth", "est_s", "intake_model", "intake_s", "intake_tokens", "write_model", "thinking", "write_s", "write_tokens", "thinking_tokens", "detours", "words_in", "questions", "answered", "words_out", "outcome"];
    function n(x) { return x == null ? "?" : Number(x).toLocaleString(); }
    function fmt(r) {
      return r.when + "  " + r.mode + (r.complexity ? " (" + r.complexity + ")" : "") + "\n" +
        "  intake " + (r.intake_s != null ? r.intake_s + "s on " + r.intake_model + ", " + n(r.intake_tokens) + " tokens" : "-") + "\n" +
        "  write " + (r.write_s != null ? r.write_s + "s on " + r.write_model + ", " + r.thinking + " (est " + r.est_s + "s), " + n(r.write_tokens) + " tokens (" + n(r.thinking_tokens) + " thinking)" : "-") + "\n" +
        "  " + r.words_in + " words in, " + (r.words_out || 0) + " out, " + r.answered + "/" + r.questions + " answered" +
        (r.detours ? "\n  detours: " + r.detours : "") + (r.outcome !== "ok" ? "\n  " + r.outcome : "");
    }
    /* Every Flash model the key can use (from Google's model list), plus any
       model that ran today. Before the key is checked, the known models show. */
    var planLoading = false;
    function roleOf(m) {
      var plan = gemini.plan;
      if (!plan) return "";
      var flashes = plan.write.filter(function (x) { return !/lite/.test(x); });
      var i = flashes.indexOf(m);
      if (i === 0) return "writes full prompts";
      if (i > 0) return "backup " + i + " for full prompts";
      if (plan.intake[0] === m) return "questions and Quick prompts";
      if (plan.intake.indexOf(m) !== -1) return "backup for questions";
      return "available, not used by the page";
    }
    var studioLoaded = false;
    function loadStudio() {
      if (studioLoaded) return;
      studioLoaded = true;
      fetch("usage.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { studio = j && j.models ? j : null; render(); }, function () {});
    }
    function studioToday() { return studio && studio.day === pacificDay() ? studio : null; }
    function since(s, t) { return (s.log || []).filter(function (e) { return e[0] > t; }); }
    function clockTime(iso) { try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }
    var fullLeft = null;
    function renderUsage() {
      fullLeft = null;
      var u = usage(), box = document.getElementById("usage");
      box.textContent = "";
      loadStudio();
      var st = studioToday(), stTime = st ? Date.parse(st.updated) : 0;
      document.getElementById("usageSource").textContent = st
        ? "From your AI Studio screenshots at " + clockTime(st.updated) + " (Usage Check), plus runs on this device since then. Chart readings are approximate."
        : "Counted from runs on this device while stats were on. Send Usage Check with AI Studio screenshots for the full picture.";
      /* Just the 4 models the page uses: 3 Flash models for full prompts, plus the
         Flash-Lite that handles questions and Quick prompts. */
      var names = gemini.plan
        ? gemini.plan.write.filter(function (x) { return !/lite/.test(x); }).concat(gemini.plan.intake.slice(0, 1))
        : Object.keys(LIMITS);
      if (!gemini.plan && !planLoading) {
        var k = gemini.key || (document.getElementById("gkey").value || "").trim();
        if (k) { planLoading = true; ensureModel(k).catch(function () {}).then(function () { planLoading = false; if (gemini.plan) render(); }); }
      }
      names.forEach(function (m) {
        var local = u.models[m] || { calls: 0, tokens: 0, out: false, log: [] }, lim = dailyLimit(m);
        var sm = st && st.models[m], s, detail;
        if (sm) {
          var extra = since(local, stTime);
          var tok = (sm.input_tokens || 0) + (sm.output_tokens || 0) + extra.reduce(function (a, e) { return a + (e[1] || 0); }, 0);
          s = { calls: (sm.requests || 0) + extra.length, tokens: tok, out: !!local.out };
          detail = (sm.requests || 0) + " in AI Studio" + (extra.length ? " + " + extra.length + " since" : "") + ", about " + n(tok) + " tokens";
        } else {
          s = local;
          detail = s.calls + " request" + (s.calls === 1 ? "" : "s") + " counted, " + n(s.tokens) + " tokens";
        }
        if (lim && s.calls >= lim) s.out = true;
        /* What's true right now beats the count: a daily limit, Google being busy, or a per-minute pause. */
        var rest = restInfo(m);
        if (rest && rest.why === "day") s.out = true;
        var used = s.out && lim ? lim : s.calls;
        if (lim && !/lite/.test(m)) fullLeft = (fullLeft || 0) + Math.max(0, lim - used);
        var row = document.createElement("div"); row.className = "m" + (s.out ? " out" : "");
        var b = document.createElement("b"); b.textContent = m;
        var role = roleOf(m);
        if (role) { var r = document.createElement("small"); r.className = "role"; r.textContent = role; b.appendChild(r); }
        var t = document.createElement("span");
        var assumed = studio && studio.assumed ? studio.assumed.indexOf(m) !== -1 : ASSUMED[m];
        t.textContent = s.out ? "used up today" + (rest && rest.why === "day" ? ", back at 3 AM" : "")
          : rest && rest.why === "busy" ? "busy at Google, retry in " + rest.mins + " min"
          : rest && rest.why === "minute" ? "per-minute limit, back in " + rest.secs + "s"
          : lim ? "~" + Math.max(0, lim - s.calls) + " of " + lim + (assumed ? " (assumed)" : "") + " left" : "limit unknown";
        if (rest && rest.why !== "day" && !s.out) row.className = "m busy";
        var bar = document.createElement("div"); bar.className = "bar";
        var fill = document.createElement("i"); fill.style.width = (lim ? Math.min(100, Math.round(used / lim * 100)) : 0) + "%";
        bar.appendChild(fill);
        var d = document.createElement("span"); d.style.gridColumn = "1 / -1"; d.style.textAlign = "left";
        d.textContent = detail;
        row.appendChild(b); row.appendChild(t); row.appendChild(bar); row.appendChild(d);
        box.appendChild(row);
      });
    }
    function render() {
      document.getElementById("testLog").hidden = !on;
      document.getElementById("copyAll").hidden = !on;   /* testing only */
      document.getElementById("statsToggle").checked = on;
      if (typeof updateQuickLabel === "function") updateQuickLabel();
      var f = document.getElementById("footerLead");
      if (f) f.textContent = on ? "Run stats are on: timings and counts (never your words) are saved on this device until you turn them off. Your words are gone when you close the tab." : "This site saves nothing. Close or refresh the tab and everything is gone.";
      if (!on) return;
      document.getElementById("usageReset").textContent = "(resets 3 AM Eastern)";
      renderUsage();
      var list = runs();
      document.getElementById("testLogHead").textContent = "Run stats \u00b7 " + list.length + " run" + (list.length === 1 ? "" : "s") +
        (fullLeft != null ? " \u00b7 ~" + fullLeft + " full prompts left today" : "");
      document.getElementById("testRuns").textContent = list.length ? list.slice().reverse().map(fmt).join("\n\n") : "No runs yet. Build a prompt and it will show up here.";
    }
    function setOn(v) {
      on = v;
      store(TEST_FLAG, v ? "1" : null);
      if (!v) { store(TEST_LOG, null); store(TEST_USAGE, null); }
      render();
    }
    function add(r) {
      if (!on) return;
      var d = new Date(), pad = function (x) { return (x < 10 ? "0" : "") + x; };
      r.when = (d.getMonth() + 1) + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      var list = runs(); list.push(r);
      store(TEST_LOG, JSON.stringify(list.slice(-200)));
      render();
    }
    /* Called for every request Gemini answers or refuses. A refusal for the daily
       limit marks the model used up, which also corrects for uncounted runs. */
    function request(model, tokens, limitHit) {
      if (!on) return;
      var u = usage(), s = u.models[model] || (u.models[model] = { calls: 0, tokens: 0, out: false });
      if (limitHit) s.out = true; else { s.calls++; s.tokens += tokens || 0; (s.log || (s.log = [])).push([Date.now(), tokens || 0]); }
      store(TEST_USAGE, JSON.stringify(u));
      render();
    }
    function asText() {
      var u = usage();
      var head = "usage " + u.day + ": " + Object.keys(u.models).map(function (m) { var s = u.models[m]; return m + " " + s.calls + " req, " + s.tokens + " tok" + (s.out ? ", used up" : ""); }).join(" | ");
      return head + "\n" + COLS.join("\t") + "\n" + runs().map(function (r) { return COLS.map(function (c) { return r[c] == null ? "" : String(r[c]); }).join("\t"); }).join("\n");
    }
    function init() {
      setOn(read(TEST_FLAG) === "1");
      var ts = document.getElementById("testStatus");
      document.getElementById("statsToggle").addEventListener("change", function (e) {
        setOn(e.target.checked);
        if (e.target.checked) { ts.textContent = ""; var tl = document.getElementById("testLog"); tl.open = true; tl.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
      document.getElementById("testCopy").addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(asText()).then(function () { ts.textContent = "Copied. Paste it into the build chat."; }, function () { ts.textContent = "Couldn't copy."; });
      });
      document.getElementById("testClear").addEventListener("click", function () { store(TEST_LOG, null); store(TEST_USAGE, null); render(); ts.textContent = "Cleared."; });
    }
    return { init: init, add: add, request: request, runs: runs, on: function () { return on; }, refresh: function () { if (on) render(); } };
  })();
  function words(t) { return (t || "").trim() ? t.trim().split(/\s+/).length : 0; }
  /* One log entry per run, built from what the session already knows. */
  function logRun(extra) {
    if (!testLog.on() || !session) return;
    var r = {
      mode: session.mode || "Quick version (no key)",
      complexity: session.complexity || "",
      intake_model: session.intakeModel || "", intake_tokens: session.intakeTokens, est_intake_s: session.estIntake, intake_s: session.intakeMs != null ? Math.round(session.intakeMs / 100) / 10 : null,
      words_in: words(session.raw),
      questions: (session.questions || []).length,
      answered: (session.answers || []).length
    };
    for (var k in extra) r[k] = extra[k];
    testLog.add(r);
    sendRun(r);
  }



  thoughts.addEventListener("input", function () { err.hidden = true; });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var raw = thoughts.value.trim();
    if (!raw) { err.textContent = "Type or paste something first."; err.hidden = false; thoughts.focus(); return; }
    if (busy) return;
    var key = gemini.key || gkey.value.trim();
    if (key) { geminiFlow(raw, key); return; }
    session = { raw: raw, quick: true };
    showQuick(raw, "");
    logRun({ outcome: "ok", words_out: words(output.value) });
  });

  function setChatName(title) {
    var chatName = document.getElementById("chatName");
    if (title) {
      chatName.textContent = "";
      chatName.appendChild(document.createTextNode("Name the chat: "));
      var b = document.createElement("b"); b.textContent = title; chatName.appendChild(b);
      chatName.hidden = false;
    } else {
      chatName.hidden = true;
    }
  }
  function setReady(ready) {
    document.getElementById("resultHead").textContent = ready ? "Your prompt is ready" : "Writing your prompt...";
    if (!ready) xray.clear();
    document.getElementById("copy").disabled = !ready;
    document.getElementById("copyAll").disabled = !ready;
    document.getElementById("saveNote").disabled = !ready;
    document.getElementById("saveShare").disabled = !ready;
    output.placeholder = ready ? "" : "Your prompt will appear here when it's ready.";
  }
  /* Opens the result card in "writing" mode so the prompt can appear as it streams in. */
  function showWriting(title) {
    if (typeof resetKeep === "function") resetKeep();
    document.getElementById("categoryLine").hidden = true;
    output.value = "";
    status.textContent = "";
    document.getElementById("madeBy").textContent = "";
    document.getElementById("numWarn").hidden = true;
    document.getElementById("repairNote").hidden = true;
    setChatName(title);
    setReady(false);
    qa.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  try { localStorage.removeItem("stp-folder"); } catch (e) {} /* retired setting */
  function setCategoryLine() {
    var name = (session && session.category) || "";
    document.getElementById("categoryLine").hidden = !name;
    document.getElementById("categoryName").textContent = name;
  }
  function showResult(text, madeBy, title) {
    if (typeof resetKeep === "function") resetKeep();
    report.reset();
    xray.set({ prompt: text, raw: session ? session.raw : thoughts.value, answers: session ? session.answers : [], core: core.active ? core.block : '' });   /* Prompt X-ray */
    setCategoryLine();
    setReady(true);
    output.value = text;
    status.className = "status";
    status.textContent = "";
    document.getElementById("madeBy").textContent = madeBy;
    document.getElementById("numWarn").hidden = true;
    setChatName(title);
    qa.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showQuick(raw, reason) {
    showResult(core.apply(buildPrompt(raw)),   /* core */
      reason ? "Quick version. " + reason : "Quick version. Add a free Gemini key at the bottom to get follow-up questions first.",
      "");
  }


  function selectFallback() {
    output.focus();
    output.select();
    output.setSelectionRange(0, output.value.length);
    status.textContent = "Selected. Press and hold, then tap Copy.";
  }

  /* Copy and open: the copy starts inside the tap, and the link opens the app
     (or website) at the same time, so the prompt is ready to paste there. */
  Array.prototype.forEach.call(document.querySelectorAll(".openrow a"), function (a) {
    a.addEventListener("click", function () {
      if (!output.value) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output.value).then(function () {
          promptCopied = true;
          status.textContent = "Copied. Paste it into " + a.textContent + ".";
        }, function () {});
      }
    });
  });
  /* Copy full result (shows only with run stats on, for stress tests): the note,
     answers, what's on screen, the X-ray, and the prompt in one paste. It only
     copies; nothing is sent anywhere. */
  function fullResult() {
    var s = session || {}, raw = s.raw || thoughts.value, ans = s.answers || [], out = ["SPEAK TO PROMPT RESULT"];
    report.collect().forEach(function (r) { if (r[1] !== "" && r[1] != null) out.push(r[0] + ": " + r[1]); });
    out.push("", "MY NOTE", raw);
    if (ans.length) { out.push("", "MY ANSWERS"); ans.forEach(function (a) { out.push("Q: " + a.question, "A: " + a.answer + (a.tapped ? " (tapped)" : "")); }); }
    var shown = ["madeBy", "chatName", "categoryLine", "repairNote", "numWarn"].map(function (id) { var el = document.getElementById(id); return el && !el.hidden ? el.textContent.trim() : ""; }).filter(Boolean);
    if (shown.length) out.push("", "ON SCREEN", shown.join("\n"));
    var x = analyze(output.value, raw, ans, core.active ? core.block : "");
    out.push("", "X-RAY", x.pct + "% your words, " + x.added + " parts added to help");
    x.sources.filter(function (z) { return !z.used; }).forEach(function (z) { out.push("Not in the prompt: " + z.text); });
    var stray = [].concat.apply([], x.segments.map(function (g) { return g.stray; }));
    if (stray.length) out.push("Numbers you never said: " + stray.join(", "));
    out.push("", "PROMPT", output.value);
    return out.join("\n");
  }
  document.getElementById("copyAll").addEventListener("click", function () {
    if (!output.value || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(fullResult()).then(function () { status.textContent = "Copied the full result. Paste it into the stress test chat."; }, function () { status.textContent = "Couldn't copy."; });
  });
  document.getElementById("copy").addEventListener("click", function () {
    var text = output.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        status.textContent = "Copied. Now paste it into your AI.";
        promptCopied = true;
        if (!noteSaved) {
          keepStatus.textContent = "Want a note of this too? Save it now. Your prompt stays copied.";
          saveBtn.classList.add("primary");
        }
      }, selectFallback);
    } else {
      selectFallback();
    }
  });

  function startOver() {
    document.getElementById("categoryLine").hidden = true;
    thoughts.value = "";
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    err.hidden = true;
    document.getElementById("handoff").hidden = true;
    output.value = "";
    status.textContent = "";
    result.hidden = true;
    qa.hidden = true;
    chat.reset();
    session = null;
    writeRun++;
    busy = false;
    setBusy(false);
    stopTicker();
    setProgress(document.getElementById("resultProg"), "off");
    setReady(true);
    resetKeep();
    setBuild("");
    document.getElementById("numWarn").hidden = true;
    ideasSync();
  }
  document.getElementById("reset").addEventListener("click", function () {
    startOver();
    thoughts.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  var pasteWrap = document.getElementById("pasteWrap");
  var pasteBtn = document.getElementById("bannerPaste");
  var pasteHelp = document.getElementById("pasteHelp");
  /* The paste button always sits on top of the box (Kevin likes a dedicated
     button). Coming back from the shortcut it grows into the big banner. Hidden
     only where the browser can't read the clipboard. */
  var canPaste = !!(navigator.clipboard && navigator.clipboard.readText);
  function setShortcutMode(on) {
    pasteWrap.hidden = !(on || canPaste);
    pasteWrap.classList.toggle("banner", on);
    pasteHelp.hidden = !on;
    pasteBtn.textContent = on ? "Tap to paste your transcript" : "\ud83d\udccb Paste";
    ideasSync();
  }
  function shortcutMode() { return pasteWrap.classList.contains("banner"); }
  var handoff = document.getElementById("handoff");
  function pasteFailed() {
    thoughts.focus();
    err.textContent = "Press and hold inside the box, then tap Paste.";
    err.hidden = false;
  }
  /* wrap (optional): turns the transcript into the box text, e.g. the Improve this app background. */
  function pasteFromClipboard(fromShortcut, wrap) {
    if (!navigator.clipboard || !navigator.clipboard.readText) { pasteFailed(); return; }
    navigator.clipboard.readText().then(function (text) {
      text = (text || "").trim();
      if (!text) { err.textContent = "Your clipboard is empty. Copy the transcript in Voice Memos first."; err.hidden = false; return; }
      if (text === "Speak to Prompt: waiting for your transcript") { err.textContent = "That's the shortcut's placeholder, not your transcript. In Voice Memos, choose Copy Transcript first."; err.hidden = false; return; }
      /* From the shortcut, the transcript replaces whatever was in the box
         (a fresh run). Tapped by hand, it adds to what's already typed. */
      var current = fromShortcut ? "" : thoughts.value.trim();
      if (wrap) text = wrap(text);
      thoughts.value = current ? current + "\n\n" + text : text;
      thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
      err.hidden = true;
      setShortcutMode(false);
      if (fromShortcut) handoff.hidden = false;
      ideasSync();
    }, pasteFailed);
  }
  pasteBtn.addEventListener("click", function () { pasteFromClipboard(pasteWrap.classList.contains("banner")); });
  /* Dev tools: the same paste, already wrapped for Improve this app (the button is Svelte-owned, so listen on the wrapper). */
  pasteWrap.addEventListener("click", function (e) {
    if (!e.target.closest("#pasteImprove")) return;
    pasteFromClipboard(pasteWrap.classList.contains("banner"), function (t) { return starter.improveText(t); });
  });

  /* Shortcut hand-off: the shortcut opens this page with #t=<transcript>.
     The text after # never leaves the phone; it is cleared from the address right away. */
  /* #paste: the shortcut is back with a new transcript on the clipboard.
     Safari often reuses the open tab without reloading it, so this also runs on
     hashchange and when the page comes back from Safari's page cache. Each time,
     the old run is cleared so a previous transcript can't linger in the box. */
  function enterPasteMode(firstLoad) {
    /* On first load the later parts of the page aren't set up yet, and there's
       no old run to clear, so only the box is emptied. */
    if (firstLoad) thoughts.value = ""; else startOver();
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    setShortcutMode(true);
    setTimeout(function () { pasteWrap.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50);
  }
  setShortcutMode(false);
  window.addEventListener("hashchange", function () { if (location.hash === "#paste") enterPasteMode(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted && location.hash === "#paste") enterPasteMode(); });
  (function () {
    var h = location.hash || "";
    if (h === "#paste") { enterPasteMode(true); return; }
    if (h.indexOf("#t=") !== 0) return;
    var text = "";
    try { text = decodeURIComponent(h.slice(3)).trim(); } catch (e) { text = ""; }
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (!text) return;
    var current = thoughts.value.trim();
    thoughts.value = current ? current + "\n\n" + text : text;
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    handoff.hidden = false;
  })();
  thoughts.addEventListener("input", function () { handoff.hidden = true; });

  /* Idea strip. Silly but real requests rotate inside the empty box. They clear the
     instant you tap in, paste, or text arrives, and come back only if the box is
     still empty after you leave it. Nothing here is saved. */
  var ideasEl = document.getElementById("ideas");
  var ideasPanel = document.getElementById("ideasPanel");
  var ideasTrack = document.getElementById("ideasTrack");
  var ideasCat = document.getElementById("ideasCat");
  var ideasTry = document.getElementById("ideasTry");
  var ideasPause = document.getElementById("ideasPause");
  var ideasCalm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ideasIdx = 0, ideasTimer = null, ideasIdle = null, ideasBack = null, ideasPaused = false, ideasScrollT = null;
  /* The deck plays in rounds: every round shows one Home life, one Money and time,
     and one classic line, in a fresh order, and never the same category twice in a
     row. Each pass through the deck is reshuffled, so it's different every time. */
  function ideaGroup(it) { return it[3] ? "classic" : it[0]; }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var DECK = [];
  function ideasDeal() {
    var names = ["home", "money", "classic"], pools = {}, rounds = 0, last = DECK.length ? ideaGroup(DECK[DECK.length - 1]) : null;
    names.forEach(function (n) {
      pools[n] = { all: IDEAS.filter(function (it) { return ideaGroup(it) === n; }), left: [] };
      rounds = Math.max(rounds, pools[n].all.length);
    });
    function draw(n) {
      var p = pools[n];
      if (!p.left.length) p.left = shuffled(p.all);
      return p.left.pop();
    }
    DECK = [];
    for (var r = 0; r < rounds; r++) {
      var order = shuffled(names);
      if (order[0] === last) order.push(order.shift());
      order.forEach(function (n) { DECK.push(draw(n)); });
      last = order[order.length - 1];
    }
    ideasTrack.textContent = "";
    DECK.forEach(function (it) {
      var d = document.createElement("div"); d.className = "idea"; d.dataset.group = ideaGroup(it);
      var b = document.createElement("b"); b.textContent = it[1];
      var t = document.createElement("span"); t.textContent = it[2];
      d.appendChild(b); d.appendChild(t); ideasTrack.appendChild(d);
    });
  }
  ideasDeal();
  if (ideasCalm) { ideasPause.textContent = "Next"; ideasPause.removeAttribute("aria-pressed"); ideasPause.setAttribute("aria-label", "Next idea"); }
  function ideasLabel() {
    var it = DECK[ideasIdx];
    ideasCat.textContent = it[3] ? "\u{1F3A9} " + it[3] : (it[0] === "home" ? "\u{1F3E0} Home life" : "\u23F0 Money and time");
    ideasTry.setAttribute("aria-label", "Try this idea: " + it[2]);
  }
  /* Auto-advance jumps straight to the next idea behind a quick fade. iPhone Safari
     can ignore a smooth programmatic scroll inside a snapping strip, which left the
     ideas frozen, so snapping is paused for the jump and the motion comes from the fade. */
  function ideasJump(i) {
    ideasIdx = (i + DECK.length) % DECK.length;
    ideasTrack.style.scrollSnapType = "none";
    ideasTrack.scrollLeft = ideasIdx * ideasTrack.clientWidth;
    void ideasTrack.offsetWidth;
    ideasTrack.style.scrollSnapType = "";
    ideasLabel();
  }
  function ideasGo(i, animate, before) {
    if (!animate || ideasCalm) { if (before) before(); ideasJump(i); return; }
    ideasTrack.classList.add("swap");
    setTimeout(function () { if (before) before(); ideasJump(i); ideasTrack.classList.remove("swap"); }, 160);
  }
  function ideasStop() { clearInterval(ideasTimer); ideasTimer = null; }
  function ideasStart() {
    ideasStop();
    if (ideasCalm || ideasPaused || ideasEl.classList.contains("gone")) return;
    ideasTimer = setInterval(function () {
      if (ideasIdx + 1 < DECK.length) ideasGo(ideasIdx + 1, true);
      else ideasGo(0, true, ideasDeal);
    }, 5000);
  }
  var ideasShowBtn = document.getElementById("ideasShow");
  /* The Show ideas button appears whenever the box is empty and the ideas are tucked away. */
  var thoughtsHint = thoughts.placeholder;
  function ideasBtnSync() {
    /* The box's own hint would peek through the glass, so it waits until the ideas clear. */
    thoughts.placeholder = ideasEl.classList.contains("gone") ? thoughtsHint : "";
    ideasShowBtn.hidden = !(ideasEl.classList.contains("gone") && !thoughts.value.trim() && !shortcutMode());
  }
  function ideasHide() { clearTimeout(ideasBack); ideasEl.classList.add("gone"); ideasStop(); ideasBtnSync(); }
  function ideasSync() {
    if (!ideasEl) return;
    if (thoughts.value.trim() || document.activeElement === thoughts || shortcutMode()) { ideasHide(); return; }
    var wasGone = ideasEl.classList.contains("gone");
    ideasEl.classList.remove("gone");
    ideasBtnSync();
    if (wasGone || !ideasTimer) ideasStart();
  }
  /* Make the box tall enough for the longest idea at the current width. */
  function ideasFit() {
    ideasTrack.style.height = "auto";
    var tallest = 0;
    Array.prototype.forEach.call(ideasTrack.children, function (d) { tallest = Math.max(tallest, d.offsetHeight); });
    ideasTrack.style.height = tallest + "px";
    ideasPanel.style.minHeight = "0";
    var need = ideasPanel.offsetHeight + 18 + 2;
    ideasPanel.style.minHeight = "";
    thoughts.style.minHeight = Math.max(240, need) + "px";
    ideasGo(ideasIdx, false);
  }
  thoughts.addEventListener("pointerdown", ideasHide);
  thoughts.addEventListener("focus", ideasHide);
  thoughts.addEventListener("input", ideasSync);
  thoughts.addEventListener("blur", function () {
    clearTimeout(ideasBack);
    ideasBack = setTimeout(function () { if (document.activeElement !== thoughts) ideasSync(); }, 1500);
  });
  /* A tap on the idea strip starts typing, but a swipe must never count as a tap.
     iPhone can fire a click after a short or slow swipe, so the click is ignored
     when the finger moved, the strip scrolled, the press was long, or the strip
     was still gliding from a swipe a moment ago. */
  var tapX = 0, tapY = 0, tapT = 0, tapLeft = 0, tapBad = false, lastSlide = 0;
  ideasTrack.addEventListener("pointerdown", function (e) {
    tapX = e.clientX; tapY = e.clientY; tapT = Date.now(); tapLeft = ideasTrack.scrollLeft;
    tapBad = Date.now() - lastSlide < 400;
  }, { passive: true });
  ideasTrack.addEventListener("pointermove", function (e) {
    if (Math.abs(e.clientX - tapX) > 8 || Math.abs(e.clientY - tapY) > 8) tapBad = true;
  }, { passive: true });
  ideasTrack.addEventListener("pointercancel", function () { tapBad = true; });
  ideasTrack.addEventListener("scroll", function () { lastSlide = Date.now(); tapBad = true; }, { passive: true });
  ideasTrack.addEventListener("click", function (e) {
    var moved = Math.abs(e.clientX - tapX) > 8 || Math.abs(e.clientY - tapY) > 8;
    if (tapBad || moved || Date.now() - tapT > 400 || Math.abs(ideasTrack.scrollLeft - tapLeft) > 2) return;
    thoughts.focus();
  });
  ideasShowBtn.addEventListener("click", function () {
    clearTimeout(ideasBack);
    thoughts.blur();
    ideasEl.classList.remove("gone");
    ideasBtnSync();
    ideasStart();
  });
  /* iPhone keeps an empty box focused when you tap blank page space, so the ideas
     never got their cue to return. Tapping outside an empty box now lets go of it. */
  document.addEventListener("pointerdown", function (e) {
    if (document.activeElement !== thoughts || thoughts.value.trim()) return;
    if (e.target.closest(".ideabox, input, textarea, select, label[for='thoughts']")) return;
    thoughts.blur();
  });
  ideasTrack.addEventListener("scroll", function () {
    clearTimeout(ideasScrollT);
    ideasScrollT = setTimeout(function () {
      var w = ideasTrack.clientWidth || 1;
      ideasIdx = Math.round(ideasTrack.scrollLeft / w) % DECK.length;
      ideasLabel();
    }, 120);
  });
  /* A finger or cursor on the strip pauses it; it picks back up after 6 quiet seconds. */
  ["pointerdown", "pointerenter", "wheel"].forEach(function (ev) {
    ideasPanel.addEventListener(ev, function () {
      ideasStop(); clearTimeout(ideasIdle);
      ideasIdle = setTimeout(ideasStart, 6000);
    }, { passive: true });
  });
  ideasPause.addEventListener("click", function () {
    if (ideasCalm) { ideasGo(ideasIdx + 1, false); return; }
    ideasPaused = !ideasPaused;
    ideasPause.textContent = ideasPaused ? "Play" : "Pause";
    ideasPause.setAttribute("aria-pressed", String(ideasPaused));
    if (ideasPaused) { ideasStop(); clearTimeout(ideasIdle); } else ideasStart();
  });
  ideasTry.addEventListener("click", function () {
    thoughts.value = DECK[ideasIdx][2];
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    err.hidden = true;
    handoff.hidden = true;
    ideasHide();
  });
  window.addEventListener("resize", function () { clearTimeout(ideasScrollT); ideasScrollT = setTimeout(ideasFit, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ideasFit);
  ideasFit();
  ideasSync();

  /* Gemini key: held in memory for this tab; saved to the phone only if "Remember" is ticked. */
  var KEY_NAME = "stp-gemini-key";
  var gkey = document.getElementById("gkey");
  var remember = document.getElementById("remember");
  var keyStatus = document.getElementById("keyStatus");
  var gemini = { key: "", model: "", plan: null };

  function setKeyStatus(text, kind) {
    keyStatus.textContent = text;
    keyStatus.className = kind || "";
  }
  function storeGet() { try { return localStorage.getItem(KEY_NAME) || ""; } catch (e) { return ""; } }
  function storeSet(v) { try { localStorage.setItem(KEY_NAME, v); } catch (e) {} }
  function storeDel() { try { localStorage.removeItem(KEY_NAME); } catch (e) {} }

  function flashVersion(name) {
    var m = /gemini-(\d+(?:\.\d+)?)-flash/.exec(name);
    return m ? parseFloat(m[1]) : 0;
  }
  /* Each Gemini model has its own free daily limit, so the page keeps a backup order.
     Writing uses the strongest Flash models first; questions use Flash-Lite first,
     which has a much larger free allowance. */
  function planModels(models) {
    var usable = models.filter(function (m) {
      var methods = m.supportedGenerationMethods || m.supportedActions || [];
      var n = m.name || "";
      return methods.indexOf("generateContent") !== -1 && /flash/.test(n) &&
        !/live|tts|image|audio|thinking|exp|embedding/.test(n);
    });
    function byNewest(a, b) {
      var p = (/preview/.test(a.name) ? 1 : 0) - (/preview/.test(b.name) ? 1 : 0);
      if (p) return p;
      return flashVersion(b.name) - flashVersion(a.name);
    }
    function names(list) { return list.map(function (m) { return m.name.replace(/^models\//, ""); }); }
    var flashes = names(usable.filter(function (m) { return !/lite/.test(m.name); }).sort(byNewest).slice(0, 3));
    var lites = names(usable.filter(function (m) { return /lite/.test(m.name); }).sort(byNewest).slice(0, 2));
    var all = names(usable.filter(function (m) { return !/lite/.test(m.name); }).sort(byNewest))
      .concat(names(usable.filter(function (m) { return /lite/.test(m.name); }).sort(byNewest)));
    return { write: flashes.concat(lites), intake: lites.concat(flashes), all: all };
  }

  var saved = storeGet();
  if (saved) {
    gkey.value = saved;
    remember.checked = true;
    gemini.key = saved;
    setKeyStatus("Key saved on this phone. Tap Check key to test it.");
  }

  gkey.addEventListener("input", function () { setKeyStatus(""); gemini.model = ""; gemini.plan = null; });

  remember.addEventListener("change", function () {
    if (remember.checked && gkey.value.trim()) storeSet(gkey.value.trim());
    if (!remember.checked) storeDel();
  });

  var API = "https://generativelanguage.googleapis.com/v1beta/";

  function googleError(status, body) {
    if (status === 400 || status === 403) return "Google didn't accept the key. Copy it again from AI Studio and paste it below. If you locked the key to a website, check that this site is on its list.";
    if (status === 429) return "Google says you've hit a limit. Wait a minute and try again.";
    var msg = (body && body.error && body.error.message) || "";
    return "Google returned an error (" + status + ")." + (msg ? " " + msg : "");
  }
  /* The key travels in a request header, not the web address. If a browser refuses
     the header, it retries once with the key in the address, as Google's docs allow. */
  function callGoogle(path, key, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {}, { "x-goog-api-key": key });
    function handle(r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) { var e = new Error(googleError(r.status, body)); e.status = r.status; e.google = (body && body.error && body.error.message) || ""; e.details = (body && body.error && body.error.details) || []; throw e; }
        return body;
      });
    }
    function timedOut() { var t = new Error("Gemini took too long."); t.status = "timeout"; return t; }
    return fetch(API + path, Object.assign({}, options, { headers: headers })).then(handle, function () {
      if (options.signal && options.signal.aborted) throw timedOut();
      var sep = path.indexOf("?") === -1 ? "?" : "&";
      return fetch(API + path + sep + "key=" + encodeURIComponent(key), options).then(handle, function () {
        if (options.signal && options.signal.aborted) throw timedOut();
        var n = new Error("Couldn't reach Google. Check your connection and try again."); n.status = "network"; throw n;
      });
    });
  }

  /* Confirms the key and picks a model. Resolves to the model name. */
  function verifyKey(key) {
    return callGoogle("models?pageSize=1000", key).then(function (body) {
      var plan = planModels(body.models || []);
      if (!plan.write.length) throw new Error("Your key works, but no Flash model showed up for it.");
      gemini.key = key;
      gemini.plan = plan;
      testLog.refresh();
      gemini.model = plan.write[0];
      if (remember.checked) storeSet(key);
      var backups = plan.write.length - 1;
      setKeyStatus(techOn() ? "Key works. Writing with " + plan.write[0] + ", questions with " + plan.intake[0] +
        (backups ? ", plus " + backups + " backup model" + (backups > 1 ? "s" : "") + " for busy days." : ".")
        : "Key works. You're all set: Gemini will ask a few quick questions, then write your prompt.", "good");
      return gemini.model;
    });
  }

  document.getElementById("checkKey").addEventListener("click", function () {
    var key = gkey.value.trim();
    if (!key) { setKeyStatus("Paste your key first.", "bad"); gkey.focus(); return; }
    setKeyStatus("Checking with Google...");
    verifyKey(key).catch(function (e) { setKeyStatus(e.message, "bad"); });
  });

  document.getElementById("removeKey").addEventListener("click", function () {
    gkey.value = "";
    remember.checked = false;
    gemini.key = "";
    gemini.model = ""; gemini.plan = null;
    storeDel();
    setKeyStatus("Key removed from this page and this phone.");
  });

  /* Gemini flow: read the thoughts, ask up to 3 questions, then write one complete prompt.
     Everything lives in this tab only; nothing is stored. */
  var qa = document.getElementById("qa");
  var buildBtn = document.getElementById("build");
  var buildStatus = document.getElementById("buildStatus");
  var qaStatus = document.getElementById("qaStatus");
  var busy = false;
  var session = null;
  var writeRun = 0;

  function setProgress(el, mode, pct) {
    el.hidden = mode === "off";
    var track = el.closest ? el.closest(".tracker") : null;
    if (track) { track.hidden = mode === "off"; el.hidden = false; }
    el.classList.toggle("indeterminate", mode === "busy");
    el.firstElementChild.style.width = mode === "pct" ? pct + "%" : "";
  }
  function setBuild(text, bad) { stopTicker(); setProgress(document.getElementById("buildProg"), "off"); buildStatus.textContent = text; buildStatus.className = "buildstatus" + (bad ? " bad" : ""); }
  function setBusy(on, label) {
    busy = on;
    buildBtn.disabled = on;
    chat.busy = on;
    buildBtn.textContent = on ? (label || "Working...") : "Build my prompt";
  }



  /* "network": no answer at all (often Safari dropping a request after switching apps). */
  var RETRY = [429, 403, 404, 500, 503, "empty", "timeout", "network"];
  var TIME_LIMIT = 45000;
  /* Tries each model in order. Moves on when a model is out of its daily limit,
     unavailable, slower than TIME_LIMIT, or sends back nothing.
     level sets how much the model thinks first ("low" keeps it quick).
     onModel(name) reports which model is working. Resolves to { text, model, ms }. */
  /* Flash-Lite answers fastest at its lightest setting; Flash models get "low". */
  function levelFor(model) { return /lite/.test(model) ? "minimal" : "low"; }
  var DEPTH = {
    simple:   { level: "low",    words: "light thinking",    secs: 20,  range: "usually about 20 seconds", label: "Quick request" },
    standard: { level: "medium", words: "balanced thinking", secs: 58,  range: "usually about a minute",    label: "Standard request" },
    complex:  { level: "high",   words: "deep thinking",     secs: 70,  range: "usually about a minute",    label: "Complex request" },
    quick:    { level: "quick",  words: "balanced thinking",   secs: 12,  range: "about 10 seconds",         label: "Quick prompt" }
  };
  /* Quick prompts: Flash-Lite is fast enough to think a bit more, which keeps
     it from dropping details. A Flash backup stays light so it stays quick. */
  function quickLevel(model) { return /lite/.test(model) ? "medium" : "low"; }
  function depthWords(depth, model) {
    if (depth.level !== "quick") return depth.words;
    return quickLevel(model) === "medium" ? "balanced thinking" : "light thinking";
  }
  /* Quick prompts go to Flash-Lite first (largest free daily allowance, fastest),
     so they don't spend the small Flash allowance that full prompts need.
     Flash models stay in the list as backups. */
  function writeModels(quick) { return quick ? gemini.plan.intake : gemini.plan.write; }
  function depthOf(c) { return DEPTH[c] || DEPTH.standard; }
  /* Model names and thinking levels only show with run stats on; everyone else
     sees plain words and times. */
  function techOn() { return testLog.on(); }
  function planText(c, model) { var d = depthOf(c); return d.label + (techOn() ? " \u00b7 " + model + " with " + d.words : "") + " \u00b7 " + writeEstimate(DEPTH[c] ? c : "standard").range; }
  /* Model rest list: a model that just said it was busy (or timed out) sits out
     for 10 minutes, and one at its limit sits out for an hour, so the next run
     goes straight to a model that's working instead of waiting on the same one.
     Google has no way to ask "how much is left" with a key, so the page learns
     from what each model just did. Stored on this device: model names and times only. */
  var REST_KEY = "stp-model-rest";
  var REST_BUSY = 10 * 60000;
  function restList() { try { return JSON.parse(localStorage.getItem(REST_KEY) || "{}") || {}; } catch (e) { return {}; } }
  /* why: "busy" (Google overloaded), "minute" (per-minute limit), "day" (daily limit, until 3 AM Eastern). */
  function restModel(model, ms, why) {
    var r = restList(); r[model] = { until: Date.now() + ms, why: why || "busy" };
    try { localStorage.setItem(REST_KEY, JSON.stringify(r)); } catch (e) {}
    testLog.refresh();
  }
  function restInfo(model) {
    var x = restList()[model];
    if (typeof x === "number") x = { until: x, why: "busy" };   // older format
    return x && x.until > Date.now() ? { mins: Math.ceil((x.until - Date.now()) / 60000), secs: Math.ceil((x.until - Date.now()) / 1000), why: x.why } : null;
  }
  /* Milliseconds until daily limits reset (midnight Pacific). */
  function msToReset() {
    try {
      var p = new Date().toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour12: false }).split(":").map(Number);
      return Math.max(60000, (24 * 3600 - ((p[0] % 24) * 3600 + p[1] * 60 + p[2])) * 1000);
    } catch (e) { return 3600000; }
  }
  /* Google's limit errors say which limit was hit: per minute or per day, how
     long to wait, and sometimes the limit itself. */
  function limitKind(e) {
    var out = { daily: false, minute: false, wait: 0, value: 0 };
    (e.details || []).forEach(function (d) {
      if (!d || typeof d !== "object") return;
      (d.violations || []).forEach(function (v) {
        var id = String(v.quotaId || "") + " " + String(v.quotaMetric || "");
        if (/PerDay/i.test(id)) { out.daily = true; if (Number(v.quotaValue) > 0) out.value = Number(v.quotaValue); }
        else if (/PerMinute/i.test(id)) out.minute = true;
      });
      if (d.retryDelay) out.wait = parseFloat(d.retryDelay) || 0;
    });
    if (!out.daily && !out.minute) out.daily = /per day|daily|PerDay/i.test(e.google || "") || !/per minute|PerMinute/i.test(e.google || "");
    if (out.daily) out.minute = false;
    return out;
  }
  function clearRest(model) {
    var r = restList(); if (!(model in r)) return; delete r[model];
    try { localStorage.setItem(REST_KEY, JSON.stringify(r)); } catch (e) {}
  }
  function resting(model) { var r = restInfo(model); return r ? r.mins : 0; }

  /* Tries each model in order and resolves to { text, model, ms, history, ... }.
     - Models resting from a recent problem go to the back of the line.
     - Moves on when a model is out of its limit, busy, slower than its limit,
       or sends back nothing.
     - hedgeAfter (writes only): if the model hasn't answered after that many ms,
       the next model starts too and the first good answer wins (the other is
       stopped). One busy model can't hold you hostage for minutes.
     level sets how much the model thinks first. onModel(name) reports which
     model is working. */
  /* Time away: iPhone pauses the page while you're in another app, so a run's
     seconds would include that time. Waits are logged without it (hidden_s shows it). */
  var awaySpans = [], awayAt = document.visibilityState === "hidden" ? Date.now() : 0;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { if (!awayAt) awayAt = Date.now(); }
    else if (awayAt) { awaySpans.push([awayAt, Date.now()]); awayAt = 0; if (awaySpans.length > 50) awaySpans.shift(); }
  });
  function awayMs(t0) {
    var now = Date.now(), ms = awayAt ? now - Math.max(awayAt, t0) : 0;
    awaySpans.forEach(function (s) { if (s[1] > t0) ms += s[1] - Math.max(s[0], t0); });
    return Math.max(0, ms);
  }
  function askGemini(text, asJson, models, level, onModel, limit, hedgeAfter) {
    var started = Date.now();
    var history = [];
    var fresh = models.filter(function (m) { return !resting(m); });
    var tired = models.filter(function (m) { return resting(m); });
    tired.forEach(function (m) { history.push(m + " skipped (resting " + resting(m) + " more min)"); });
    var list = fresh.concat(tired);
    function payload(withThinking, model) {
      var cfg = {};
      if (asJson) cfg.responseMimeType = "application/json";
      var lvl = withThinking ? (level === "auto" ? levelFor(model) : level === "quick" ? quickLevel(model) : level) : "";
      if (lvl) cfg.thinkingConfig = { thinkingLevel: lvl };
      var p = { contents: [{ role: "user", parts: [{ text: text }] }] };
      if (Object.keys(cfg).length) p.generationConfig = cfg;
      return JSON.stringify(p);
    }
    return new Promise(function (resolve, reject) {
      var next = 0, running = 0, done = false, lastErr = null, live = [];
      function finish(ok, value) {
        if (done) return;
        done = true;
        live.forEach(function (c) { try { c.abort(); } catch (e) {} });
        if (ok) resolve(value); else reject(value);
      }
      function giveUp() {
        if (lastErr && lastErr.status === 429 && lastErr.perMinute) {
          var slow = new Error("Gemini's free per-minute limit is full right now. Wait about a minute and try again.");
          slow.status = 429; slow.google = lastErr.google || "";
          return finish(false, slow);
        }
        if (lastErr && lastErr.status === 429) {
          var all = new Error("Every free Gemini model on your key has hit today's limit. It resets overnight, around 3 AM Eastern.");
          all.status = 429;
          all.google = lastErr.google || "";
          return finish(false, all);
        }
        finish(false, lastErr || new Error("No Gemini model was available."));
      }
      function startNext() {
        if (done) return;
        if (next >= list.length) { if (!running) giveUp(); return; }
        run(next++, true);
      }
      function run(i, withThinking) {
        var model = list[i];
        running++;
        if (onModel) onModel(model);
        var ctrl = window.AbortController ? new AbortController() : null;
        if (ctrl) live.push(ctrl);
        var tAttempt = Date.now();
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, limit || TIME_LIMIT) : null;
        var hedge = hedgeAfter && i < list.length - 1 ? setTimeout(function () {
          if (done || next !== i + 1) return;
          history.push(model + " was slow, so " + list[next] + " started too after " + Math.round((Date.now() - tAttempt) / 1000) + "s");
          startNext();
        }, hedgeAfter) : null;
        var settled = false;
        function settle() { if (settled) return; settled = true; running--; clearTimeout(timer); clearTimeout(hedge); }
        callGoogle("models/" + model + ":generateContent", gemini.key, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload(withThinking, model),
          signal: ctrl ? ctrl.signal : undefined
        }).then(function (res) {
          settle();
          if (done) return;
          var um = res.usageMetadata || {};
          testLog.request(model, um.totalTokenCount || 0, false);
          var c = res.candidates && res.candidates[0];
          var parts = (c && c.content && c.content.parts) || [];
          var out = parts.map(function (p) { return p.thought ? "" : (p.text || ""); }).join("").trim();
          if (!out) { var e = new Error("Gemini sent back an empty answer."); e.status = "empty"; throw e; }
          /* Only accept answers Gemini marks as finished, so a cut-off prompt is never shown. */
          if (c.finishReason && c.finishReason !== "STOP") { var e2 = new Error("Gemini stopped early (" + c.finishReason + ")."); e2.status = "empty"; throw e2; }
          clearRest(model);
          var away = awayMs(started);
          finish(true, { text: out, model: model, ms: Math.max(0, Date.now() - started - away), away: away, history: history, tokens: um.totalTokenCount || null, thinkingTokens: um.thoughtsTokenCount || 0 });
        }).catch(function (e) {
          settle();
          if (done) return;   // another model already won; this one was stopped on purpose
          var secs = Math.round((Date.now() - tAttempt) / 1000);
          /* "after Ns" shows how long a model made you wait before the next one took over */
          if (e.status === "timeout") { history.push(model + " timed out at " + secs + "s"); restModel(model, REST_BUSY, "busy"); }
          else if (e.status === 429) {
            var k = limitKind(e);
            if (k.daily) {
              history.push(model + " was at its daily limit" + (k.value ? " (" + k.value + ")" : ""));
              if (k.value) learnLimit(model, k.value);
              testLog.request(model, 0, true); restModel(model, msToReset(), "day");
            } else {
              e.perMinute = true;
              history.push(model + " hit its per-minute limit" + (k.wait ? ", back in " + Math.round(k.wait) + "s" : ""));
              restModel(model, Math.max(15, k.wait || 60) * 1000, "minute");
            }
          }
          else if (e.status === "empty") history.push(model + " sent an incomplete answer after " + secs + "s");
          else if (e.status === "network") history.push(model + " couldn't be reached after " + secs + "s");   // not the model's fault, so no rest
          else if (RETRY.indexOf(e.status) !== -1) { history.push(model + " was unavailable after " + secs + "s"); if (e.status === 503 || e.status === 500) restModel(model, REST_BUSY, "busy"); }
          /* A model that rejects the thinking setting gets one more try without it. */
          if (e.status === 400 && withThinking) return run(i, false);
          if (RETRY.indexOf(e.status) !== -1) { lastErr = e; if (!running) startNext(); return; }
          finish(false, e);
        });
      }
      startNext();
    });
  }

  var WRITE_LIMIT = 300000;
  /* Usual seconds per model, used only for the progress estimate. */

  /* Learned estimates: while run stats are on, each finished run teaches the
     page how long that kind of run really takes (median of the last 8, once
     there are at least 2). With stats off, the built-in defaults are used. */
  var INTAKE_SECS = 6;
  /* tuning.json: typical times from everyone's logged runs (the run log on
     GitHub), refreshed by the twice-daily review. A phone that hasn't learned
     its own times yet uses these instead of the built-in guesses. */
  var tuning = null;
  function loadTuning() {
    fetch("tuning.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.depth) { tuning = j; updateQuickLabel(); } }, function () {});
  }
  function tuned(key) {
    var t = tuning && (key == null ? tuning.intake : tuning.depth[key]);
    return t && typeof t.secs === "number" && t.secs >= 1 && t.secs <= 600 && t.runs >= 5 ? t : null;
  }
  function depthKeyOf(r) { return r.depth || (/Quick/.test(r.mode || "") ? "quick" : (r.complexity || "standard")); }
  function learned(field, key) {
    if (!testLog.on()) return null;
    var vals = testLog.runs().filter(function (r) {
      return r.outcome === "ok" && typeof r[field] === "number" && (key == null || depthKeyOf(r) === key);
    }).slice(-8).map(function (r) { return r[field]; }).sort(function (a, b) { return a - b; });
    if (vals.length < 2) return null;
    var mid = Math.floor(vals.length / 2);
    var med = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    return { secs: Math.max(2, Math.round(med)), n: vals.length };
  }
  function clock(n) { n = Math.max(0, Math.round(n)); return Math.floor(n / 60) + ":" + (n % 60 < 10 ? "0" : "") + (n % 60); }
  function writeEstimate(key) {
    var l = learned("write_s", key), d = DEPTH[key] || DEPTH.standard, t = tuned(key);
    if (l) return { secs: l.secs, range: "usually about " + clock(l.secs) + " (from your last " + l.n + " runs)", learned: true, from: "phone" };
    if (t) return { secs: t.secs, range: "usually about " + clock(t.secs) + " (from " + t.runs + " recent runs)", tuned: true, from: "shared" };
    return { secs: d.secs, range: d.range, learned: false, from: "built-in" };
  }
  function intakeEstimate() { var l = learned("intake_s", null), t = tuned(null); return l ? l.secs : t ? t.secs : INTAKE_SECS; }
  function updateQuickLabel() {
    var q = writeEstimate("quick"), total = intakeEstimate() + q.secs;
    ui.quickSecs = q.learned || q.tuned ? total : 15;
  }

  /* Mode picker lives in ModePicker.svelte; it reads the shared ui state. */
  function currentMode() { return ui.mode; }
  function updateKeyState() { ui.hasKey = !!(gemini.key || gkey.value.trim()); }
  gkey.addEventListener("input", updateKeyState);
  updateKeyState();

  /* Step tracker with time-based progress: elapsed and an honest estimate of
     what's left. The bar never claims done early (it stops at 95%). */
  function setSteps(track, active, skipAsk) {
    var order = ["read", "ask", "write", "ready"], at = order.indexOf(active);
    Array.prototype.forEach.call(track.querySelectorAll("li"), function (li, i) {
      var step = li.getAttribute("data-step");
      li.className = step === "ask" && skipAsk ? "skip" : i < at ? "done" : i === at ? "active" : "";
      if (i === at) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }
  function startEstimate(bar, label, usual, step, skipAsk) {
    var track = bar.closest(".tracker");
    var elEl = track.querySelector(".el"), leftEl = track.querySelector(".left"), leftLbl = track.querySelector(".leftlbl"), right = track.querySelector(".right"), detail = track.querySelector(".detail");
    var t0 = Date.now(), tModel = Date.now(), model = "";
    setSteps(track, step, skipAsk);
    setProgress(bar, "pct", 2);
    function draw() {
      var secs = (Date.now() - t0) / 1000, since = (Date.now() - tModel) / 1000;
      setProgress(bar, "pct", Math.max(2, Math.min(95, Math.round(95 * (1 - Math.exp(-since / (usual * 0.6)))))));
      var left = usual - since;
      elEl.textContent = clock(secs);
      var over = left <= 1;
      right.classList.toggle("over", over);
      leftEl.textContent = over ? "Almost there" : clock(left);
      leftLbl.textContent = over ? "taking a bit longer than usual" : "estimated left";
      detail.textContent = label + (model && techOn() ? " · " + model : "");
    }
    stopTicker();
    draw();
    ticker = setInterval(draw, 1000);
    return function (m) { model = m; tModel = Date.now(); draw(); };
  }
  function finishTrack(bar, secs, skipAsk) {
    var track = bar.closest(".tracker");
    stopTicker();
    setSteps(track, "ready", skipAsk);
    track.querySelector("li[data-step='ready']").className = "done";
    setProgress(bar, "pct", 100);
    track.querySelector(".el").textContent = clock(secs);
    var right = track.querySelector(".right");
    right.classList.add("over");
    track.querySelector(".left").textContent = "Done";
    track.querySelector(".leftlbl").textContent = "";
  }

  var ticker = null;
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

  function parseIntake(text) {
    var t = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    var data = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
    var qs = Array.isArray(data.questions) ? data.questions : [];
    return {
      title: String(data.title || "").trim(),
      need: String(data.need || "").trim(),
      category: String(data.category || data.folder || "").replace(/["'\/\\#]/g, "").replace(/\s+/g, " ").trim().slice(0, 30),
      complexity: (function (c) { c = String(c || "").toLowerCase(); return /simple/.test(c) ? "simple" : /complex/.test(c) ? "complex" : "standard"; })(data.complexity),
      note: (function (n) {
        n = n && typeof n === "object" ? n : {};
        function list(x) { return (Array.isArray(x) ? x : []).map(function (v) { return String(v).trim(); }).filter(Boolean); }
        return {
          headline: String(n.headline || "").trim(),
          tags: list(n.tags).map(function (t) { return t.replace(/^#/, "").replace(/\s+/g, ""); }).slice(0, 5),
          summary: String(n.summary || "").trim(),
          keyIdeas: list(n.key_ideas),
          actionItems: list(n.action_items),
          unknowns: list(n.unknowns),
          transcript: String(n.clean_transcript || "").trim()
        };
      })(data.note),
      questions: qs.slice(0, 5).map(function (q) {
        return {
          question: String((q && q.question) || "").trim(),
          choices: (Array.isArray(q && q.choices) ? q.choices : []).slice(0, 4).map(function (c) { return String(c).trim(); }).filter(Boolean)
        };
      }).filter(function (q) { return q.question; })
    };
  }

  /* Dev tools on: any question about what to build a web app with gets the
     "Speak to Prompt stack" choice first, even if Gemini forgot it. */
  var STACK = typeof __STACK__ !== "undefined" ? __STACK__ : "Svelte 5 + Vite 8";
  var STACK_Q = /\b(tech(nology)? stack|stack|framework|technolog(y|ies)|programming language|build (it|this|the (app|site|page)) (with|in|on)|built (with|in|on)|what should (i|we) use to build)\b/i;
  function addStackChoice(qs) {
    if (!core.dev) return qs;
    var mine = stackChoice(STACK);
    qs.forEach(function (q) {
      if (!STACK_Q.test(q.question)) return;
      var rest = q.choices.filter(function (c) { return !/speak to prompt stack/i.test(c); });
      q.choices = [mine].concat(rest).slice(0, 4);
    });
    return qs;
  }

  function ensureModel(key) {
    if (gemini.plan && gemini.key === key) return Promise.resolve(gemini.model);
    return verifyKey(key);
  }

  function geminiFlow(raw, key) {
    session = { raw: raw };
    result.hidden = true;
    setBusy(true, "Reading your thoughts...");
    buildStatus.textContent = "";
    session.estIntake = intakeEstimate();
    var onIntakeModel = startEstimate(document.getElementById("buildProg"), "Reading your thoughts", session.estIntake, "read", false);
    var intakeText = (core.dev ? withStackHint(ANALYZE, STACK) : ANALYZE) + "\n" + raw + '\n"""';
    ensureModel(key).then(function () {
      return askGemini(intakeText, true, gemini.plan.intake, "auto", onIntakeModel);
    }).then(function (r) {
      session.intakeModel = r.model; session.intakeMs = r.ms; session.intakeAway = r.away || 0; session.intakeTokens = r.tokens;
      try { return parseIntake(r.text); } catch (e) {
        var others = gemini.plan.write.filter(function (m) { return m !== r.model; });
        return askGemini(intakeText, true, others, "auto", onIntakeModel).then(function (r2) {
          session.intakeModel = r2.model + " (retry)"; session.intakeMs += r2.ms; session.intakeTokens = (session.intakeTokens || 0) + (r2.tokens || 0);
          return parseIntake(r2.text);
        });
      }
    }).then(function (intake) {
      session.title = intake.title;
      session.questions = addStackChoice(intake.questions);
      session.note = intake.note;
      session.complexity = intake.complexity;
      session.category = intake.category;
      session.need = intake.need;
      setBusy(false);
      var mode = currentMode();
      if (mode === "quick") { session.mode = "Quick mode"; setBuild(""); return writeFinal([], true); }
      if (!intake.questions.length) { session.mode = "Full (no questions)"; setBuild(""); return writeFinal([]); }
      setBuild("");
      renderQuestions(intake);
    }).catch(function (e) {
      setBusy(false);
      setBuild("");
      showQuick(raw, "Gemini wasn't available, so this is the quick version. " + (e && e.message ? e.message : ""));
      session.mode = "Intake";
      session.intakeError = e && e.message ? e.message : "unknown";
      logRun({ outcome: "intake failed: " + (e && e.message ? e.message : "unknown") });
    });
  }

  /* The questions are a chat now (ChatBuilder.svelte + chat.svelte.js). */
  function renderQuestions(intake) {
    chat.start(intake, "Your prompt: " + planText(intake.complexity, gemini.plan.write[0]));
    qaStatus.textContent = "";
    qa.hidden = false;
    qa.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  chat.onFinish = function (answers, quick) { if (!busy && session) writeFinal(answers, quick); };

  function writeFinal(answers, quick) {
    if (!session.mode) session.mode = quick ? "Quick prompt button" : "Full";
    session.answers = answers.filter(function (a) { return a.answer; });
    var lines = session.answers.map(function (a) { return "Q: " + a.question + "\nA: " + a.answer + (a.tapped ? " (tapped from suggested options)" : ""); });
    var text = WRITE + "\n\nRAW THOUGHTS:\n\"\"\"\n" + session.raw + "\n\"\"\"\n\nANSWERS TO FOLLOW-UP QUESTIONS:\n" + (lines.length ? lines.join("\n\n") : "None given.");
    /* core: the person's standing profile is attached to the finished prompt by the page.
       The writer sees it so it doesn't repeat or contradict it. */
    if (core.active) text += "\n\nTHE PERSON'S CORE (added to the end of the prompt automatically, so don't repeat it; just don't contradict it):\n" + core.block;
    setBusy(true, "Writing your prompt...");
    setBuild("");
    qaStatus.textContent = "";
    var run = ++writeRun;
    var resultProg = document.getElementById("resultProg");
    showWriting(session.title);
    var depth = quick ? DEPTH.quick : depthOf(session.complexity);
    var depthKey = quick ? "quick" : (DEPTH[session.complexity] ? session.complexity : "standard");
    var est = writeEstimate(depthKey);
    var skipAsk = session.mode === "Quick mode" || !(session.questions && session.questions.length);
    var eta = startEstimate(resultProg, depth.label + (techOn() ? " \u00b7 " + depth.words + (est.learned ? " \u00b7 estimate learned from your runs" : est.tuned ? " \u00b7 estimate from recent runs" : "") : ""), est.secs, "write", skipAsk);
    /* If the writer hasn't answered in about 2.5x the usual time (30 to 90 seconds),
       a backup starts too and the first good prompt wins. */
    var hedgeAfter = Math.min(90, Math.max(30, Math.round(est.secs * 2.5))) * 1000;
    return askGemini(text, false, writeModels(quick), depth.level, function (m) {
      if (run === writeRun) eta(m);
    }, WRITE_LIMIT, hedgeAfter).then(function (r) {
      if (run !== writeRun) { setBusy(false); return; }
      finishTrack(resultProg, r.ms / 1000, skipAsk);
      var draft = cleanPrompt(r.text);
      /* Auto-Repair: check the draft on the phone; only a real problem costs a Gemini call. */
      var before = qualityCheck(draft);
      if (!before.score) return showWritten(draft, r, { status: "none" }, before);
      setBusy(true, "\ud83d\udd27 Fixing " + before.score + (before.score === 1 ? " thing" : " things") + " the check found...");
      document.getElementById("resultHead").textContent = "\ud83d\udd27 Fixing " + before.score + (before.score === 1 ? " thing" : " things") + " the check found...";
      var t0 = Date.now();
      return askGemini(repairPrompt(draft, session.raw, session.answers, before), false, writeModels(true), "low", null, 60000).then(function (r2) {
        if (run !== writeRun) { setBusy(false); return; }
        var fixed = cleanPrompt(r2.text), after = qualityCheck(fixed);
        var secs = Math.round((Date.now() - t0) / 100) / 10;
        if (isBetter(after, before, fixed, draft)) return showWritten(fixed, r, { status: "fixed", secs: secs, model: r2.model, before: before, after: after }, after);
        showWritten(draft, r, { status: "kept original", secs: secs, model: r2.model, before: before }, before);
      }, function (e) {
        if (run !== writeRun) { setBusy(false); return; }
        showWritten(draft, r, { status: "failed", secs: Math.round((Date.now() - t0) / 100) / 10, before: before }, before);
      });

      function showWritten(prompt, r, rep, check) {
        var detour = r.history && r.history.length ? " (" + r.history.join("; ") + ")" : "";
        setBusy(false);
        setBuild("");
        qaStatus.textContent = "";
        var secs = Math.max(1, Math.round(r.ms / 1000 + (rep.secs || 0))) + "s";
        session.repair = rep;
        session.write = { model: r.model, thinking: depthWords(depth, r.model), secs: Math.round(r.ms / 100) / 10, detours: (r.history || []).join("; "), depth: depthKey };
        showResult(core.apply(prompt), techOn()   /* core */
          ? "Built with Gemini (" + r.model + ", " + depthWords(depth, r.model) + ") in " + secs + detour + ". Your AI can start working right away."
          : "Ready in " + secs + ". Your AI can start working right away.", session.title);
        showRepairNote(rep);
        var nc = showNumberCheck(prompt);
        session.numFlags = nc.extra.length + nc.missing.length;
        logRun({ depth: depthKey, est_s: est.secs, est_from: est.from, write_model: r.model, thinking: depthWords(depth, r.model), write_s: Math.round(r.ms / 100) / 10, write_tokens: r.tokens, thinking_tokens: r.thinkingTokens,
          hidden_s: (session.intakeAway || 0) + r.away >= 1000 ? Math.round(((session.intakeAway || 0) + r.away) / 100) / 10 : null,
          detours: (r.history || []).join("; ").replace(/gemini-/g, ""), words_out: words(prompt), core: core.active, outcome: "ok",
          coach: assess(session.raw).score, xray_pct: check.pct, xray_dropped: check.dropped.length, xray_stray: check.stray.length,
          repair: rep.status, repair_s: rep.secs != null ? rep.secs : null });
      }
    }).catch(function (e) {
      if (run !== writeRun) { setBusy(false); return; }
      stopTicker();
      setProgress(resultProg, "off");
      setBusy(false);
      setBuild("");
      qaStatus.textContent = "";
      showQuick(session.raw, "Gemini couldn't finish, so this is the quick version. " + (e && e.message ? e.message : ""));
      session.writeError = e && e.message ? e.message : "unknown";
      logRun({ depth: depthKey, est_s: est.secs, est_from: est.from, outcome: "write failed: " + (e && e.message ? e.message : "unknown") });
    });
  }

  function cleanPrompt(t) { return String(t || "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim(); }

  /* What Auto-Repair looks for: sentences of yours that didn't make it in (X-ray,
     skipping short filler), numbers nobody said, and numbers you said that went
     missing (the number check). score = how many things a fix would address. */
  function qualityCheck(prompt) {
    var x = analyze(prompt, session.raw, session.answers || []);
    var dropped = x.sources.filter(function (s) { return !s.used && words(s.text) >= 4; }).map(function (s) { return s.text; });
    var n = numberIssues(prompt);
    return { pct: x.pct, dropped: dropped, stray: n.extra, missingNums: n.missing, score: dropped.length + n.extra.length + n.missing.length };
  }
  /* Keep a fix only if it solved something, added no new made-up numbers, didn't
     lose numbers, and didn't shrink or balloon the prompt. */
  function isBetter(after, before, fixed, draft) {
    var len = words(fixed) / Math.max(1, words(draft));
    /* Never keep a fix that deleted a number you said (even small ones like a 6am start). */
    var said = numberTokens(saidText(), true), kept = numberTokens(fixed, true), had = numberTokens(draft, true);
    var lost = Object.keys(had).some(function (n) { return said[n] && !kept[n]; });
    return !lost && after.score < before.score && after.stray.length <= before.stray.length && after.missingNums.length <= before.missingNums.length && len >= 0.7 && len <= 1.8;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function showRepairNote(rep) {
    var el = document.getElementById("repairNote");
    if (!rep || rep.status === "none") { el.hidden = true; el.textContent = ""; return; }
    var parts = [];
    if (rep.status === "fixed") {
      var added = rep.before.dropped.length - rep.after.dropped.length + rep.before.missingNums.length - rep.after.missingNums.length;
      var removed = rep.before.stray.length - rep.after.stray.length;
      if (added > 0) parts.push("added " + plural(added, "detail you said", "details you said"));
      if (removed > 0) parts.push("removed " + plural(removed, "made-up number", "made-up numbers"));
      el.textContent = "\ud83d\udd27 Auto-fixed: " + (parts.join(" and ") || "tightened it up") + ". Tap X-ray to see.";
    } else {
      el.textContent = "\ud83d\udd27 The check found " + plural(rep.before.score, "thing", "things") + " to fix, but " + (rep.status === "failed" ? "the fix didn't come through" : "the fix wasn't better") + ", so this is the original. Tap X-ray to see what to check.";
    }
    el.hidden = false;
  }

  /* Number check (free, no Gemini request). The page compares the numbers in the
     prompt (times, money, versions like iOS 27) with what the person said. A writer
     that "corrects" a version it doesn't know (iOS 27 to iOS 18), drops a number, or
     invents one (a 400-word limit) gets flagged before the prompt is pasted anywhere.
     Small counts like "3 tips" are fine unless they follow a version word. */
  var VERSION_WORD = /(ios|ipados|macos|watchos|tvos|visionos|android|windows|version|v)\s*$/i;
  function numberTokens(text, keepSmall) {
    var out = {}, t = String(text || "");
    var re = /(\d{1,2}:\d{2})|\$?(\d[\d,]*(?:\.\d+)?)/g, m;
    while ((m = re.exec(t))) {
      var before = t.slice(Math.max(0, m.index - 12), m.index);
      var lineStart = /(^|\n)\s*$/.test(t.slice(Math.max(0, m.index - 4), m.index)) && /^[.)]/.test(t.slice(re.lastIndex, re.lastIndex + 1));
      if (lineStart) continue; /* list numbering like "1." */
      /* "10:00 AM" is the same number as "10am", so on-the-hour times count as the hour */
      var tok = m[1] ? m[1].replace(/^0?(\d{1,2}):00$/, "$1") : m[2].replace(/,/g, "").replace(/\.0+$/, "");
      if (!tok) continue;
      var small = !m[1] && Number(tok) <= 10 && !VERSION_WORD.test(before);
      if (small && !keepSmall) continue;
      out[tok] = true;
    }
    return out;
  }
  /* Numbers that plain words already say: "two weeks" is 14 days, "half an hour" is 30 minutes. */
  var IMPLIED = [[/\btwo weeks?\b/i, ["14"]], [/\bthree weeks?\b/i, ["21"]], [/\b(a|one) week\b/i, ["7"]], [/\bhalf (an )?hour\b/i, ["30"]], [/\b(an|one) hour\b/i, ["60"]], [/\b(a|one) year\b/i, ["12", "365"]]];
  /* "October 30th, wait no, the 31st": the part before the correction isn't something to keep. */
  var CORRECTION = /[^.!?\n]*?\b(wait,? no|no,? wait|scratch that|i mean|correction|or rather|actually it'?s|actually make it)\b/gi;
  function saidText() { return session.raw + "\n" + (session.answers || []).map(function (a) { return a.answer; }).join("\n"); }
  function numberIssues(promptText) {
    var said = saidText();
    var have = numberTokens(said, true), given = numberTokens(said.replace(CORRECTION, " "), false);
    IMPLIED.forEach(function (x) { if (x[0].test(said)) x[1].forEach(function (n) { have[n] = true; }); });
    var got = numberTokens(promptText, true), gotBig = numberTokens(promptText, false);
    return {
      missing: Object.keys(given).filter(function (n) { return !got[n]; }),
      extra: Object.keys(gotBig).filter(function (n) { return !have[n]; })
    };
  }
  function listWords(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function showNumberCheck(promptText) {
    var el = document.getElementById("numWarn");
    var g = numberIssues(promptText), parts = [];
    if (g.extra.length) parts.push("mentions " + listWords(g.extra) + ", which you never said");
    if (g.missing.length) parts.push("leaves out " + listWords(g.missing) + ", which you did");
    el.hidden = !parts.length;
    el.textContent = parts.length ? "Heads up: this prompt " + parts.join(", and ") + ". Check those numbers before you paste it." : "";
    return g;
  }

  /* Notes: built on demand from this tab's session only. Nothing is stored by the page. */
  var keepStatus = document.getElementById("keepStatus");
  var saveBtn = document.getElementById("saveNote");
  var noteSaved = false, promptCopied = false;
  function resetKeep() { keepStatus.textContent = ""; noteSaved = false; promptCopied = false; saveBtn.classList.remove("primary"); }
  function stamp() {
    var d = new Date();
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  /* Saved notes match Kevin's original voice-note format: the title alone on the
     first line (Apple Notes turns it into the note's big title), then the date,
     title, category and tags, a "## " headline, and "### " section headings.
     style "notes": plain text for the share sheet (the # marks would show as-is).
     style "md": real Markdown for the Save Voice Note shortcut, which turns it
     into rich text (Make Rich Text from Markdown), so Notes shows true headings,
     checklists, and bold. Every line is its own paragraph, because Markdown
     joins lines that touch into one. */
  function buildNote(style, withPrompt) {
    var s0 = session || { raw: thoughts.value.trim() };
    var n = s0.note || {};
    var md = style === "md";
    var title = s0.title || "Captured thought";
    var out = [];
    function head(t) { out.push(""); out.push("### " + t); }
    /* Notes doesn't turn "- [ ]" into a checkbox (it shows the brackets), so both styles use a ☐ box. */
    function bullets(list, check) { list.forEach(function (x) { out.push(check ? "\u2610 " + x : "- " + x); }); }
    function block(t) { out.push(md ? String(t || "").split(/\n+/).join("\n\n") : (t || "")); }
    out.push(md ? "# " + title : title);
    out.push("\ud83d\udcc5 " + stamp());
    out.push("\u26a1 " + title);
    if (s0.category) out.push("\ud83d\udcc1 Category: " + s0.category);
    if (n.tags && n.tags.length) { out.push(""); out.push("\ud83c\udff7\ufe0f TAGS: " + n.tags.map(function (t) { return "#" + t; }).join(" ")); }
    if (n.headline) { out.push(""); out.push("## " + n.headline); }
    if (n.summary) { head("\ud83d\udcdd Summary"); block(n.summary); }
    if (n.keyIdeas && n.keyIdeas.length) { head("\ud83d\udca1 Key Ideas"); bullets(n.keyIdeas); }
    if (n.actionItems && n.actionItems.length) { head("\u2705 Action Items"); bullets(n.actionItems, true); }
    if (n.unknowns && n.unknowns.length) { head("\u2753 Questions / Unknowns"); bullets(n.unknowns); }
    if (s0.answers && s0.answers.length) {
      head("\ud83e\udde9 Follow-up Answers");
      s0.answers.forEach(function (a) { out.push(md ? "- **" + a.question + "** " + a.answer : "- " + a.question + " " + a.answer); });
    }
    head("\ud83d\udde3\ufe0f " + (n.transcript ? "Clean Transcript" : "Raw Thoughts"));
    block(n.transcript || s0.raw || "");
    if (withPrompt && output.value) { head("\ud83d\ude80 Prompt Built"); block(output.value); }
    /* In Markdown, a blank line between lines keeps each one on its own line (lists stay lists). */
    return (md ? out.filter(function (x) { return x !== ""; }).join("\n\n") : out.join("\n")).trim();
  }


  /* Save to Notes. On iPhone and iPad it runs the "Save Voice Note" shortcut,
     which creates the note straight in the 💪Process Voice Note💪 folder (no share
     sheet, no folder picking). The note is also copied first as a backup, in case
     the shortcut isn't installed. "Share instead" keeps the old share sheet.
     Computers keep the share sheet or copy. */
  var SAVE_SHORTCUT = "Save Voice Note";
  var shareBtn = document.getElementById("saveShare");
  var uaKeep = navigator.userAgent || "";
  var appleKeep = /iPhone|iPad|iPod/.test(uaKeep) || (/Macintosh/.test(uaKeep) && navigator.maxTouchPoints > 1);
  /* "Use my Notes shortcuts" (More options, iPhone and iPad only, off by default).
     Kevin's phone has Save Voice Note and File Voice Note; other people don't, so
     without the switch Save to Notes keeps the share sheet and no File button shows. */
  var MINE_KEY = "stp-myshortcuts";
  var mineBox = document.getElementById("myShortcuts");
  var fileLink = document.getElementById("fileLink");
  function mineOn() { try { return appleKeep && localStorage.getItem(MINE_KEY) === "1"; } catch (e) { return false; } }
  function applyMine() {
    var on = mineOn();
    mineBox.checked = on;
    fileLink.hidden = !on;
    shareBtn.hidden = !on;
  }
  document.getElementById("myShortcutsRow").hidden = !appleKeep;
  mineBox.addEventListener("change", function () {
    try { if (mineBox.checked) localStorage.setItem(MINE_KEY, "1"); else localStorage.removeItem(MINE_KEY); } catch (e) {}
    applyMine();
  });
  applyMine();
  function keepDone(msg) { noteSaved = true; saveBtn.classList.remove("primary"); keepStatus.textContent = msg; }
  function shareNote() {
    var note = buildNote("notes", true);
    var title = (session && session.title) || "Speak to Prompt note";
    function copyNote() {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { keepStatus.textContent = "This browser can't save notes from here."; return; }
      navigator.clipboard.writeText(note).then(function () {
        keepDone("Copied the note. Paste it into a new note, then tap Copy prompt again before pasting into your AI.");
      }, function () { keepStatus.textContent = "This browser can't save notes from here."; });
    }
    if (navigator.share) {
      navigator.share({ title: title, text: note }).then(function () {
        keepDone(promptCopied ? "Saved. Your prompt is still copied, so paste it into your AI." : "Saved. Now tap Copy prompt and paste it into your AI.");
      }, function (e) {
        if (e && e.name === "AbortError") return;
        copyNote();
      });
    } else {
      copyNote();
    }
  }
  function runSaveShortcut() {
    var note = buildNote("md", true);   // real Markdown; the shortcut turns it into headings
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(note).catch(function () {});
    var link = document.getElementById("shortcutLink");
    link.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(SAVE_SHORTCUT) + "&input=text&text=" + encodeURIComponent(note);
    link.click();
    promptCopied = false;
    keepDone("Sent to your " + SAVE_SHORTCUT + " shortcut. It lands in \ud83d\udcaaProcess Voice Note\ud83d\udcaa. Tap Copy prompt again before pasting into your AI. Nothing happened? Tap Share instead.");
  }
  saveBtn.addEventListener("click", function () { if (mineOn()) runSaveShortcut(); else shareNote(); });
  shareBtn.addEventListener("click", shareNote);

  /* AI app links. claude.ai/new and chatgpt.com are https links the apps claim
     (universal links), so on iPhone they open the app when it's installed and the
     website when it isn't. Gemini's app only claims a few paths, so iPhone and
     iPad get its "open the app" path; computers keep the regular web address. */
  (function () {
    var ua = navigator.userAgent || "";
    var appleTouch = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (appleTouch) document.getElementById("geminiLink").href = "https://gemini.google.com/app/download/mobile";
    /* Talk it out needs the iPhone shortcut, so computers just get the text box
       (and First time? Start here, which everyone gets). */
    else document.getElementById("talkLink").hidden = true;
  })();
  /* Automatic run log: only while "Show run stats" is on (testing phones), each
     run's numbers go to the relay, which posts them to the Run log issue (#2) for
     the twice-daily review. Fire and forget; a failure never touches the page. */
  /* The run waits until you do something with the prompt, so the log also shows
     what happened next (copied, opened an AI, saved, started over, rebuilt,
     reported, or left the page) and whether you opened X-ray. That's the best
     quality signal there is: a prompt you copy was useful, one you redo wasn't. */
  var pendingRun = null, pendingTimer = 0;
  function sendRun(r) {
    if (!RELAY || !testLog.on()) return;
    flushRun("rebuilt");
    var ans = (session && session.answers) || [];
    var run = { app: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev", device: deviceLine(),
      tapped: ans.filter(function (a) { return a.tapped; }).length, num_flags: session ? session.numFlags : null, xray_opened: false };
    for (var k in r) if (k !== "when") run[k] = r[k];
    pendingRun = run;
    pendingTimer = setTimeout(function () { flushRun("none in 10 min"); }, 600000);   // long prompts take a while to read
  }
  function flushRun(action) {
    if (!pendingRun) return;
    clearTimeout(pendingTimer);
    var run = pendingRun;
    pendingRun = null;
    run.action = action;
    try {
      fetch(RELAY.replace(/\/+$/, "") + "/run", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: run }), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  /* Capture phase: noted before the button's own handler runs. */
  document.addEventListener("click", function (e) {
    if (!pendingRun || !e.target || !e.target.closest) return;
    var t = e.target;
    if (t.closest("#xrayBtn")) { pendingRun.xray_opened = true; return; }
    var ai = t.closest(".openai");
    var a = t.closest("#copy") ? "copied" : ai ? "opened " + ai.textContent.trim() : t.closest("#saveNote, #saveShare") ? "saved note" : t.closest("#glowSave") ? "saved glow-up"
      : t.closest("#reset") ? "started over" : t.closest("#reportSend, #reportIssue") ? "reported" : t.closest("#build") ? "rebuilt" : "";
    if (a) flushRun(a);
  }, true);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushRun("left the page"); });

  /* Version pill (top right): checks version.json when the page opens and whenever
     it comes back into view. "✓ Latest", "Update ready", or plain "Refresh" if it
     couldn't check. Tapping always reloads, which is the only refresh a Home Screen
     web app has. If a prompt is on screen, the first tap asks to tap again. */
  var MY_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  var pill = document.getElementById("versionPill"), pillText = document.getElementById("versionText");
  var pillState = "checking", confirmTimer = 0;
  function setPill(state) {
    pillState = state;
    pill.dataset.state = state;
    pillText.textContent = { checking: "Checking...", latest: "\u2713 Latest", update: "Update ready", refresh: "Refresh", confirm: "Tap again to reload (clears this prompt)" }[state];
    pill.title = state === "latest" ? "You're on the newest version (" + MY_VERSION + "). Tap to refresh." : state === "update" ? "A newer version is live. Tap to reload." : "Tap to refresh";
  }
  function checkVersion() {
    if (MY_VERSION === "dev") { setPill("refresh"); return; }
    fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (pillState === "confirm") return;
      setPill(!j || !j.version ? "refresh" : j.version === MY_VERSION ? "latest" : "update");
    }, function () { if (pillState !== "confirm") setPill("refresh"); });
  }
  pill.addEventListener("click", function () {
    var busyHere = thoughts.value.trim() || !document.getElementById("result").hidden;
    if (busyHere && pillState !== "confirm") {
      var back = pillState;
      setPill("confirm");
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(function () { if (pillState === "confirm") setPill(back); }, 4000);
      return;
    }
    location.reload();
  });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checkVersion(); });
  checkVersion();

  /* "Something went wrong?" (ReportIssue.svelte): the facts about this run, never its words. */
  function deviceLine() {
    var ua = navigator.userAgent || "", touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    var dev = /iPhone/.test(ua) ? "iPhone" : (/iPad/.test(ua) || touchMac) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
    var os = (ua.match(/OS (\d+)[_.]\d+.* like Mac OS X/) || [])[1];
    var br = /EdgiOS|Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "other browser";
    /* Safari has reported iOS 18 on every newer iOS since iOS 26, so 18 really means "18 or later". */
    var osLabel = os ? (Number(os) === 18 ? "iOS 18 or later" : "iOS " + os) : "";
    return dev + (osLabel ? " (" + osLabel + ")" : "") + ", " + br + ", " + window.innerWidth + " x " + window.innerHeight;
  }
  report.collect = function (place) {
    if (place === "front") {
      var fr = [
        ["App version", typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"],
        ["When", new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) + " (" + (Intl.DateTimeFormat().resolvedOptions().timeZone || "local") + ")"],
        ["Device", deviceLine()],
        ["Gemini key", (gemini.key || gkey.value.trim()) ? "yes" : "no"],
        ["Mode picked", ui.mode],
        ["Prompt built in this tab", session ? "yes" : "not yet"],
        ["Sliders", SLIDERS.map(function (sl) { return sl.label + " " + starter.tune[sl.key]; }).join(", ")]
      ];
      if (core.dev) fr.push(["Core", core.active ? "on" : "off"]);
      return fr;
    }
    var s = session || {}, qs = s.questions || [], ans = s.answers || [];
    var tapped = ans.filter(function (a) { return a.tapped; }).length;
    var w = s.write, rows = [
      ["App version", typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"],
      ["When", new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) + " (" + (Intl.DateTimeFormat().resolvedOptions().timeZone || "local") + ")"],
      ["Device", deviceLine()],
      ["Mode", s.mode || (s.quick ? "Quick version (no key)" : "")],
      ["Gemini key", gemini.key ? "yes" : "no"],
      ["Words in", words(s.raw)],
      ["Words out", words(output.value)],
      ["Request size", s.complexity || ""],
      ["Questions", qs.length ? qs.length + " asked, " + ans.length + " answered (" + tapped + " tapped, " + (ans.length - tapped) + " typed), " + (qs.length - ans.length) + " skipped" : "none"],
      ["Read step", s.intakeModel ? s.intakeModel + ", " + (Math.round((s.intakeMs || 0) / 100) / 10) + "s" : ""],
      ["Write step", w ? w.model + ", " + w.thinking + ", " + w.secs + "s (" + w.depth + ")" : ""],
      ["Model detours", w && w.detours ? w.detours : ""],
      ["Errors", [s.intakeError && "read: " + s.intakeError, s.writeError && "write: " + s.writeError].filter(Boolean).join("; ")],
      ["Number check", w ? (s.numFlags ? s.numFlags + " number(s) flagged" : "nothing flagged") : ""],
      ["Auto-Repair", s.repair ? s.repair.status + (s.repair.secs != null ? ", " + s.repair.secs + "s" : "") : ""],
      ["Sliders", SLIDERS.map(function (sl) { return sl.label + " " + starter.tune[sl.key]; }).join(", ")]
    ];
    if (core.dev) rows.push(["Core", core.active ? "on" : "off"]);
    return rows;
  };
  testLog.init();
  loadTuning();
}
