import { withCandidate, buildPrompt, ANALYZE, WRITE, CLEAN, LEDGER, STANDIN, gapFillPrompt, withContext, SQUEEZE, repairPrompt, stackChoice, withStackHint, withMemory, withLessons, todayText, withToday, gradePrompt, isAside, LABEL_FIXES, LABEL_NAMES, labelFixPrompt, shortWriteText, tipQuestionsPrompt, tipQuestions, TIP_MAX, GRADE_MISSING, GRADE_PASS, capGrade, gradeLabel, goalText } from './prompts.js';
import { memory, answerFact } from './memory.svelte.js';   /* memory: dev-only, see memory.svelte.js */
import { analyze } from './xray.js';
import { numberTokens, numberIssuesFor, numberFlags, flagText, numberDock } from './numcheck.js';
import { assess } from './coach.js';
import { IDEAS as IDEA_LIST } from './ideas.js';
import { ui, notify, saveMode } from "./ui.svelte.js";
import { startHere } from './starthere.svelte.js';
import { cook, cookStart, cookStop, cookClock } from './cook.svelte.js';
import { chat } from './chat.svelte.js';
import { core } from './core.svelte.js';
import { compareRounds } from './compare.js';   /* core: dev-only, see core.svelte.js */
import { context, blockTokens } from './context.svelte.js';   /* My context: main app, opt-in save, see context.svelte.js */
import { report, RELAY } from './report.svelte.js';
import { xray } from './xray.svelte.js';
import { starter } from './starter.svelte.js';
import { SLIDERS } from './starters.js';
import { IS_STAGING } from './channel.js';
import { savectx } from './savectx.svelte.js';   /* Save as context (#50), see savectx.svelte.js */

export function startApp() {
  /* What you copy is the prompt only. Nothing is tacked onto the end any more: the writer
     works your core and My context into the prompt itself, using only what this request
     needs (the no-key quick version puts both inside the prompt, before your thoughts). */
  function extras(p) { return p; }
  function extraBlock() { return ""; }
  /* Picked context and your core as plain text: count as things you said (number check, X-ray, grade). */
  function knownText() {
    var parts = context.active ? context.chosen.map(function (c) { return c.text.trim(); }) : [];
    if (core.background) parts.push(core.background);   /* core */
    return parts.join("\n");
  }
  /* The background the no-key quick version puts inside the prompt: My context, then your core. */
  function quickBackground() {
    var parts = [];
    if (context.active) parts.push(context.block.replace(/^---\n[^\n]*\n\n?/, ""));
    if (core.background) parts.push(core.background);   /* core */
    return parts.join("\n\n");
  }
  /* The grader treats your core as something you said, so working it in isn't "made up". */
  function gradeAnswers() {
    var a = (session && session.answers) || [];
    return core.background ? a.concat([{ question: "My standing context (my core)", answer: core.background }]) : a;
  }
  function sessionKnown() { return (session && session.known) || ""; }
  /* Ideas tab signals: names and fixed notes only, never the user's words (lib/ideas.svelte.js). */
  function signal(name, note) { try { window.dispatchEvent(new CustomEvent("stp-signal", { detail: { s: name, note: note || "" } })); } catch (e) {} }
  /* The deck shuffles in place, so each start works on its own copy. */
  var IDEAS = IDEA_LIST.slice();
  var form = document.getElementById("form");
  var thoughts = document.getElementById("thoughts");
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
  var LIMITS = { "gemini-3.8-flash": 20, "gemini-3.7-flash": 20, "gemini-3.6-flash": 20, "gemini-3.5-flash-lite": 500, "gemini-3.1-flash-lite": 500 };   /* Gemma dropped in v2.1.25 */
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
    var COLS = ["when", "mode", "complexity", "depth", "est_s", "intake_model", "intake_s", "intake_tokens", "write_model", "thinking", "write_s", "write_tokens", "thinking_tokens", "detours", "words_in", "questions", "answered", "words_out", "context", "context_tok", "outcome"];
    function n(x) { return x == null ? "?" : Number(x).toLocaleString(); }
    function fmt(r) {
      return r.when + "  " + r.mode + (r.complexity ? " (" + r.complexity + ")" : "") + "\n" +
        "  intake " + (r.intake_s != null ? r.intake_s + "s on " + r.intake_model + ", " + n(r.intake_tokens) + " tokens" : "-") + "\n" +
        "  write " + (r.write_s != null ? r.write_s + "s on " + r.write_model + ", " + r.thinking + " (est " + r.est_s + "s), " + n(r.write_tokens) + " tokens (" + n(r.thinking_tokens) + " thinking)" : "-") + "\n" +
        "  " + r.words_in + " words in, " + (r.words_out || 0) + " out, " + r.answered + "/" + r.questions + " answered" +
        (r.context ? "\n  context: " + r.context + " picked, about " + n(r.context_tok) + " tokens added" + (r.context_raw_tok ? " (squeezed from " + n(r.context_raw_tok) + ")" : r.squeeze ? " (squeeze " + r.squeeze + ")" : "") : "") +
        (r.ctx_nudge ? "\n  save as context offer: " + r.ctx_nudge : "") + (r.worked ? "\n  \ud83d\udc4d worked great" : "") +
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
      if (/lite/.test(m) && plan.intake.indexOf(m) !== -1) return "grades prompts, lists your facts, backup for questions";
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
    /* AI Studio numbers belong to the key they were read from (v2.1.28): another key gets its own clean count. */
    function studioToday() { return studio && studio.day === pacificDay() && studioMine() ? studio : null; }
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
      /* The models the page leans on: 3 Flash models for full prompts, the Flash-Lite that
         handles questions and Quick prompts, and any Gemma that grades (v2.1.22). */
      var names = gemini.plan
        ? gemini.plan.write.filter(function (x) { return !/lite/.test(x); }).concat(gemini.plan.intake.filter(function (x) { return /lite/.test(x); }))   /* every Flash-Lite: they grade too (v2.1.25) */
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
        /* What's true right now beats the count: a model Google says is used up for today. */
        var rest = restInfo(m);
        if (rest && rest.why === "day") s.out = true;
        var used = s.out && lim ? lim : s.calls;
        /* Full prompts left (v2.1.25): only the Flash models that write Normal prompts count
           (it summed Gemma's ~1,500 a day in v2.1.22, so it said ~4,560). */
        if (lim && isFlashWriter(m)) fullLeft = (fullLeft || 0) + Math.max(0, lim - used);
        var row = document.createElement("div"); row.className = "m" + (s.out ? " out" : "");
        var b = document.createElement("b"); b.textContent = m;
        var role = roleOf(m);
        if (role) { var r = document.createElement("small"); r.className = "role"; r.textContent = role; b.appendChild(r); }
        var t = document.createElement("span");
        var assumed = studio && studio.assumed ? studio.assumed.indexOf(m) !== -1 : ASSUMED[m];
        t.textContent = s.out ? "used up today" + (rest && rest.why === "day" ? ", back at 3 AM" : "")
          : lim ? "~" + Math.max(0, lim - s.calls) + " of " + lim + (assumed ? " (assumed)" : "") + " left" : "limit unknown";
        var bar = document.createElement("div"); bar.className = "bar";
        var fill = document.createElement("i"); fill.style.width = (lim ? Math.min(100, Math.round(used / lim * 100)) : 0) + "%";
        bar.appendChild(fill);
        var d = document.createElement("span"); d.style.gridColumn = "1 / -1"; d.style.textAlign = "left";
        var mm = local.miss || {}, mk = Object.keys(mm), mn = mk.reduce(function (a, k) { return a + mm[k]; }, 0);
        d.textContent = detail + (mn ? " · " + mn + " more tried, no answer (" + mk.map(function (k) { return mm[k] + " " + k; }).join(", ") + ")" : "");
        row.appendChild(b); row.appendChild(t); row.appendChild(bar); row.appendChild(d);
        box.appendChild(row);
      });
    }
    function render() {
      document.getElementById("testLog").hidden = !on;
      document.getElementById("statsToggle").checked = on;
      if (typeof updateQuickLabel === "function") updateQuickLabel();
      var f = document.getElementById("footerLead");
      if (f) f.textContent = on ? "Run stats are on: timings and counts (never your words) are saved on this device until you turn them off. Your words are gone when you close the tab." : "This site saves nothing. What you type stays in this tab only, for up to 30 minutes, so a reload doesn't lose it. Close the tab and it's gone.";
      if (!on) return;
      document.getElementById("usageReset").textContent = "(resets 3 AM Eastern)";
      renderUsage();
      var list = runs();
      document.getElementById("testLogHead").textContent = "Run stats \u00b7 " + list.length + " run" + (list.length === 1 ? "" : "s") +
        (fullLeft != null ? " \u00b7 ~" + fullLeft + " full prompts left today on Flash" : "");
      document.getElementById("testRuns").textContent = list.length ? list.slice().reverse().map(fmt).join("\n\n") : "No runs yet. Build a prompt and it will show up here.";
    }
    function setOn(v) {
      on = v;
      ui.statsOn = !!v;
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
    /* Adds one field to the newest run on this device (the 👍 Worked great tap, #5). */
    function mark(field, value) {
      if (!on) return;
      var list = runs(); if (!list.length) return;
      list[list.length - 1][field] = value;
      store(TEST_LOG, JSON.stringify(list));
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
    /* Requests that never came back with an answer (v2.1.25): timed out, busy, turned down,
       or a faster backup answered first. They don't count against "left", but showing them
       means a model that keeps missing (like a slow Gemma) is plain to see, not invisible. */
    function miss(model, why) {
      if (!on || !model) return;
      var u = usage(), s = u.models[model] || (u.models[model] = { calls: 0, tokens: 0, out: false });
      var m = s.miss || (s.miss = {});
      m[why] = (m[why] || 0) + 1;
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
    /* A new Gemini key starts today's count fresh (v2.1.28). Run history stays. */
    function newKey() { store(TEST_USAGE, null); if (on) render(); }
    return { init: init, add: add, mark: mark, request: request, miss: miss, runs: runs, newKey: newKey, on: function () { return on; }, refresh: function () { if (on) render(); } };
  })();
  function words(t) { return (t || "").trim() ? t.trim().split(/\s+/).length : 0; }
  /* One log entry per run, built from what the session already knows. */
  function logRun(extra) {
    if (!testLog.on() || !session) return;
    var r = {
      mode: (session.mode || "Quick version (no key)") + (session.switchedQuick ? " (switched to Quick " + session.switchedQuick + ")" : ""),
      complexity: session.complexity || "",
      intake_model: session.intakeModel || "", intake_tokens: session.intakeTokens, est_intake_s: session.estIntake, intake_s: session.intakeMs != null ? Math.round(session.intakeMs / 100) / 10 : null,
      words_in: words(session.raw),
      questions: (session.questions || []).length,
      answered: (session.answers || []).length,
      context: context.active ? context.chosen.length : 0, context_tok: context.tokens,   /* My context: counts only */
      context_raw_tok: context.active && context.rawTokens !== context.tokens ? context.rawTokens : null, squeeze: session.squeeze || null,
      clean: session.clean ? session.clean.status + (session.clean.why ? " (" + session.clean.why + ")" : "") : null,   /* prep crew: status, model, time, word count only */
      clean_model: session.clean && session.clean.model || null, clean_s: session.clean && session.clean.ms != null ? Math.round(session.clean.ms / 100) / 10 : null, clean_words: session.clean && session.clean.words || null,
      ledger: session.ledger ? session.ledger.status : null, ledger_items: session.ledger && session.ledger.items ? session.ledger.items.length : null, ledger_model: session.ledger && session.ledger.model || null,
      shape: session.shape ? !!(session.shape.success || session.shape.format) : null,
      ctx_nudge: savectx.stat || null   /* Save as context (#50): a fixed label only (shown, tapped, saved, not now, manual, manual saved) */
    };
    for (var k in extra) r[k] = extra[k];
    testLog.add(r);
    sendRun(r);
  }



  thoughts.addEventListener("input", function () { notify("form"); });

  /* Gentle, non-blocking notes about the input itself. The build always goes ahead. */
  function inputHint(raw) {
    var n = words(raw);
    var spanish = (raw.toLowerCase().match(/(^|\s)(que|para|por|una|los|las|del|est[aá]|quiero|tengo)(?=\s|$)/g) || []).length;
    var letters = raw.replace(/[^\p{L}]/gu, ""), nonLatin = letters ? letters.replace(/[A-Za-z\u00C0-\u024F]/g, "").length / letters.length : 0;
    if (n <= 2) return notify("form", "info", "Short works, a sentence works better", "Building now. Next time, add what you want to happen, like 'help me plan a 5k for a beginner', for a sharper prompt.");
    if (n > 600) return notify("form", "info", "That's a lot, and that's fine", "Long, rambling notes are welcome. The prompt keeps the key details, so give it a moment.");
    if (spanish >= 3 || nonLatin > 0.3) return notify("form", "info", "Writing in another language?", "Your words go in exactly as you wrote them. To get the answer in your language, add a line like 'Answer in Spanish'.");
  }

  /* Full version after a key (KeyCatcher, v2.1.25): Normal for this build (questions first),
     back to the box, and build. The words in the box are the ones the quick prompt came from. */
  var forceAsk = false;   /* AGT-14: the full-version rebuild promises questions first, so a strong note still gets them */
  function fullBuild() {
    if (!ui.hasKey || !thoughts.value.trim()) return;
    forceAsk = true;
    ui.mode = "normal"; ui.modePicked = true; saveMode("normal");
    notify("result");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.requestSubmit ? form.requestSubmit() : document.getElementById("build").click();
  }
  /* Buttons on the shared messages (Notice.svelte) come back here. */
  window.addEventListener("stp-act", function (e) {
    var act = e.detail && e.detail.act;
    if (act === "idea") { if (typeof ideasTry !== "undefined" && DECK.length) { ideasTry.click(); } thoughts.focus(); notify("form"); }
    else if (act === "paste") pasteBtn.click();
    else if (act === "pasteanyway" && pendingPaste) pasteFromClipboard(pendingPaste.fromShortcut, pendingPaste.wrap, true);
    else if (act === "retry") { notify("result"); form.requestSubmit ? form.requestSubmit() : document.getElementById("build").click(); }
    else if (act === "key") { var kp = document.getElementById("keyPanel"); kp.open = true; kp.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (act === "quickmode") { ui.mode = "quick"; ui.modePicked = true; notify("result"); form.requestSubmit ? form.requestSubmit() : document.getElementById("build").click(); }
    else if (act === "dismiss") notify(e.detail.where);
    else if (act === "askanyway") askAnyway();   /* AGT-14: bring back the questions a strong note skipped */
    else if (act === "fullbuild") fullBuild();   /* v2.1.25: the key just worked, rebuild the quick prompt the full way */
    else if (act === "rework") startRework(false);   /* #2: builds round 2 right away */
    else if (act === "reworkedit") startRework(true);   /* Edit first: the box, then Build */
    else if (act === "guide") startGuided();   /* v2.1.39: questions about what was weak, then the next round */
    else if (act === "slowquick") slowQuick(false);
    else if (act === "flashquick") { stopFlashWait(); notify("result"); if (session && !busy) writeFinal(session.answers, true); }
    else if (act === "roundback") backToBase();
    else if (act === "goquick") goQuick();
    else if (act === "worked") workedGreat();   /* #5 */
    else if (act === "savectx") saveAsContext(e.detail.where === "nudge" ? "nudge" : "result");   /* #50 */
    else if (act === "scrun") scRun();   /* #53: the Shortcut stand-in's card */
    else if (/^scother-/.test(act)) scOther(act.slice(8));
    else if (act === "scflash") scFlash();
    else if (act === "scpaste") scPaste();
    else if (/^round[1-9]$/.test(act)) showRound(Number(act.slice(5)));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var raw = thoughts.value.trim();
    if (!raw) { notify("form", "empty", "Start with a thought", "Type or paste what's on your mind, or tap Talk it out. A messy sentence or two is plenty.", [{ label: "Give me an idea", act: "idea" }]); thoughts.focus(); return; }
    if (busy) return;
    window.dispatchEvent(new Event("stp-build-start"));   /* calls off the full-version countdown (KeyCatcher, v2.1.25) */
    var key = gemini.key || gkey.value.trim();
    if (ui.round && ui.round.stage === "edit" && rounds.length && key) { roundNext(raw); return; }   /* Rework: the next round */
    if (ui.round || rounds.length || reworkDraft) clearRounds();
    rememberUsed(raw);
    inputHint(raw);
    if (key) { geminiFlow(raw, key); return; }
    session = { raw: raw, quick: true, known: knownText() };
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
    /* Cooking (v2.1.19): until the prompt is ready, the card shows only the heading, the
       tracker, and messages. The prompt comes up once Write, Polish, and Check are done. */
    document.getElementById("result").classList.toggle("cooking", !ready);
    if (!ready) xray.clear();
    document.getElementById("copy").disabled = !ready;
    document.getElementById("copyAll").disabled = !ready;
    document.getElementById("copyGrader").disabled = !ready;
    document.getElementById("copyNote").disabled = !ready;
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
    document.getElementById("gapNote").hidden = true;
    setChatName(title);
    setReady(false);
    qa.hidden = true;
    result.hidden = false;   /* writeFinal snaps to its cooking ring once the tracker shows */
  }
  try { localStorage.removeItem("stp-folder"); } catch (e) {} /* retired setting */
  function setCategoryLine() {
    var name = (session && session.category) || "";
    document.getElementById("categoryLine").hidden = !name;
    document.getElementById("categoryName").textContent = name;
  }
  /* When Gemini can't finish, the quick prompt still shows, and one message says what
     happened and the next step (Try again, Fix my key, or just wait). */
  function failNotice(e) {
    var st = e && e.status, offline = navigator.onLine === false || st === "network";
    var retry = { label: "Try again", act: "retry", primary: true };
    if (offline) return notify("result", "error", "You look offline", "Your quick prompt below still works. Reconnect, then tap Try again for follow-up questions.", [retry]);
    if (st === 429) return e.perMinute
      ? notify("result", "warn", "Google needs a short breather", "Too many requests this minute. Your quick prompt is below. Wait a minute, then tap Try again.", [retry])
      : notify("result", "warn", "Today's free Gemini limit is used up", "Your quick prompt is below and ready to copy. Google's free limit refreshes overnight, so follow-up questions are back tomorrow.");
    if (st === 400 || st === 403) return notify("result", "error", "Google didn't accept your key", "Your quick prompt is below. Copy your key again from Google AI Studio, paste it, and tap Check key.", [{ label: "Fix my key", act: "key", primary: true }]);
    notify("result", "error", "Gemini didn't come through", "No problem: your quick prompt is below, ready to copy. Tap Try again for the full version with follow-up questions.", [retry]);
  }
  function showResult(text, madeBy, title) {
    notify("result");
    ui.build = ""; ui.slow = null; ui.switched = false;   /* #51: Ready, the chip steps away */
    ui.quickResult = false;   /* showQuick turns it back on; KeyNudge reads it */
    if (typeof resetKeep === "function") resetKeep();
    report.reset();
    xray.set({ prompt: text, raw: session ? session.raw : thoughts.value, answers: session ? withMem(session.answers) : [], core: extraBlock(), known: sessionKnown() });   /* Prompt X-ray */
    setCategoryLine();
    setReady(true);
    output.value = text;
    document.getElementById("gapNote").hidden = true; document.getElementById("gapAsk").hidden = true;   /* a new result never shows old stand-in questions */
    status.className = "status";
    status.textContent = "";
    document.getElementById("madeBy").textContent = madeBy;
    document.getElementById("numWarn").hidden = true;
    setChatName(title);
    qa.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
    countRun();   /* first-timer count for the time strip (v2.1.33) */
    window.dispatchEvent(new Event("stp-ready"));   /* a prompt just finished: the dock's Copy prompt pulses once (#31) */
  }
  function showQuick(raw, reason) {
    showResult(buildPrompt(raw, quickBackground()),   /* core and My context go inside */
      reason ? "Quick version. " + reason : "Quick version.",   /* the key pitch lives in KeyNudge.svelte now (v2.1.23) */
      "");
    ui.quickResult = true;
  }


  /* The finish line answers back: Copy turns into a check for a moment. */
  function copiedFlash(btn) {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.classList.remove("copied"); void btn.offsetWidth; btn.classList.add("copied");
    btn.textContent = "\u2713 Copied";
    clearTimeout(btn._flash);
    btn._flash = setTimeout(function () { btn.classList.remove("copied"); btn.textContent = btn.dataset.label; }, 2200);
  }
  function selectFallback() {
    signal("copy-failed", "Copy prompt");
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
      /* The status line sits right under these links, so the answer shows where you tapped. */
      var cant = "Couldn't copy it. Tap Copy prompt first, then open " + a.textContent + ".";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output.value).then(function () {
          promptCopied = true;
          status.textContent = "Copied. Opening " + a.textContent + ": paste it there.";
        }, function () { signal("copy-failed", "Copy and open"); status.textContent = cant; });
      } else status.textContent = cant;
    });
  });
  /* Dev tools row (Show my dev tools on), kept apart from the everyday buttons.
     Copy full result (stress tests): the note, answers, what's on screen, the
     X-ray, the grader's details, and the prompt in one paste. Copy for grader
     check: the same, starting with "regular run" so Claude does a quick grader
     comparison. Both only copy; nothing is sent anywhere. */
  function fullResult() {
    var s = session || {}, raw = s.raw || thoughts.value, ans = s.answers || [], out = ["SPEAK TO PROMPT RESULT"];
    report.collect().forEach(function (r) { if (r[1] !== "" && r[1] != null) out.push(r[0] + ": " + r[1]); });
    out.push("", "MY NOTE", raw);
    if (ans.length) { out.push("", "MY ANSWERS"); ans.forEach(function (a) { out.push("Q: " + a.question, "A: " + a.answer + (a.tapped ? " (tapped)" : "")); }); }
    var shown = ["madeBy", "chatName", "categoryLine", "repairNote", "numWarn", "gradeNote"].map(function (id) { var el = document.getElementById(id); return el && !el.hidden ? el.textContent.trim() : ""; }).filter(Boolean);
    if (shown.length) out.push("", "ON SCREEN", shown.join("\n"));
    var x = analyze(output.value, raw, ans, extraBlock(), sessionKnown());
    out.push("", "X-RAY", x.pct + "% your words, " + x.added + " parts added to help");
    x.sources.filter(function (z) { return !z.used; }).forEach(function (z) { out.push("Not in the prompt: " + z.text); });
    var stray = [].concat.apply([], x.segments.map(function (g) { return g.stray; }));
    if (stray.length) out.push("Numbers you never said: " + stray.join(", "));
    if (s.grades && s.grades.length) {
      out.push("", "GRADER DETAILS (" + (lessons.gv ? "g" + lessons.gv : "g1") + ", lessons v" + (lessons.v || 0) + (lessons.src === "draft" ? ", draft " + lessons.id : ", live") + ")");
      s.grades.forEach(function (g, i) { out.push((s.grades.length > 1 ? (i ? "After the fix: " : "First grade: ") : "Grade: ") + g.craft.toFixed(2) + " \u00b7 missing " + (g.missing.join(", ") || "none") + " \u00b7 broke " + (g.broke.join(", ") || "none") + " \u00b7 rearranged " + (g.rearranged ? "yes" : "no") + " \u00b7 invented " + (g.invented ? "yes" : "no") + (g.numCheck ? " \u00b7 number check docked " + g.numBefore.toFixed(2) + " (" + g.numCheck.join("+") + ")" : "") + (g.confirm ? " \u00b7 pass check " + g.confirm + (g.secondCraft != null ? " (" + g.firstCraft.toFixed(2) + " then " + g.secondCraft.toFixed(2) + ")" : "") : "")); });
    } else out.push("", "GRADER DETAILS", "No grade for this run. Turn on run stats before building to get one.");
    if (s.draftBefore) out.push("", "PROMPT BEFORE THE LABEL FIX", s.draftBefore);
    if (s.reworkText) { out.push("", "ROUND " + (s.round || 2) + " EDITS (what went back in the box)", s.reworkText); if (rounds[0]) out.push("", "ROUND 1 PROMPT", rounds[0].output); }
    out.push("", "PROMPT", output.value);
    return out.join("\n");
  }
  /* Copy prompt + my note: the prompt first, then the original note under a clear
     line that says which one to follow, so a corrected detail ("the 14th, no wait,
     the 13th") can't win over the prompt. */
  var WHICH = "Use the prompt above. This note is only extra context. If it disagrees with the prompt above, the prompt wins.";
  /* The note is the same one Save to Notes makes (summary, to-dos, open questions), not just the raw words (report #6). */
  function promptWithNote() {
    return output.value + "\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nMY ORIGINAL NOTE (background only)\n" + WHICH + "\n\n" + buildNote("notes", false);
  }
  document.getElementById("copyNote").addEventListener("click", function () {
    if (!output.value || !navigator.clipboard || !navigator.clipboard.writeText) { selectFallback(); return; }
    navigator.clipboard.writeText(promptWithNote()).then(function () { promptCopied = true; status.textContent = "Copied your prompt with your note under it. Now paste it into your AI."; }, selectFallback);
  });
  document.getElementById("copyGrader").addEventListener("click", function () {
    if (!output.value || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText("regular run\n\n" + fullResult()).then(function () { status.textContent = "Copied for a grader check. Paste it into Claude."; }, function () { status.textContent = "Couldn't copy."; });
  });
  document.getElementById("copyAll").addEventListener("click", function () {
    if (!output.value || !navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(fullResult()).then(function () { status.textContent = "Copied the full result. Paste it into the stress test chat."; }, function () { status.textContent = "Couldn't copy."; });
  });
  document.getElementById("copy").addEventListener("click", function () {
    var text = output.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        status.textContent = "Copied. Paste it into your AI and take the first step.";
        copiedFlash(document.getElementById("copy"));
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

  /* Start over forgets the transcript. All that stays is a short fingerprint (a length
     and a hash, never the words) of what you built from, in memory only, so Paste can
     warn when the clipboard still holds that same transcript. */
  var usedPrints = [], pastedPrint = "", pendingPaste = null;
  function printOf(t) {
    var s = String(t || "").toLowerCase().replace(/\s+/g, " ").trim(), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return s ? s.length + ":" + h.toString(36) : "";
  }
  function rememberUsed(raw) {
    [printOf(raw), pastedPrint].forEach(function (p) { if (p && usedPrints.indexOf(p) === -1) usedPrints.push(p); });
    if (usedPrints.length > 5) usedPrints = usedPrints.slice(-5);
  }
  function startOver() {
    memory.suggestions = [];
    pastedPrint = ""; pendingPaste = null;
    xray.clear();
    clearRounds();
    document.getElementById("categoryLine").hidden = true;
    thoughts.value = "";
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    notify("form");
    document.getElementById("handoff").hidden = true;
    output.value = "";
    status.textContent = "";
    result.hidden = true;
    qa.hidden = true;
    chat.reset();
    scStop();   /* #53: a build waiting on the shortcut is called off, and its kept words deleted */
    session = null;
    writeRun++;
    busy = false;
    setBusy(false);
    ui.build = ""; ui.slow = null; ui.switched = false;
    savectx.newBuild();
    context.pickWaiting();   /* #50: a piece saved from the last prompt is picked for this one */
    stopTicker();
    setProgress(document.getElementById("resultProg"), "off");
    setReady(true);
    resetKeep();
    setBuild("");
    document.getElementById("numWarn").hidden = true;
    hideGrade();
    ideasSync();
  }
  document.getElementById("reset").addEventListener("click", function () {
    snapForUndo();
    startOver();
    thoughts.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* Undo for New prompt (#19): for a few seconds, what was on screen is kept in memory (never
     saved) so Undo can bring it all back: your words, and the questions or the finished prompt
     with its notes, X-ray, and Quality check. The Undo pill (NextDock.svelte) sends "stp-undo".
     Mid-build there's nothing finished to bring back, so only your words return. */
  var undoSnap = null, undoTimer = 0;
  function snapForUndo() {
    clearTimeout(undoTimer);
    undoSnap = null;
    var resultUp = !result.hidden && !busy && !!output.value;
    var qaUp = !qa.hidden && !busy && chat.questions.length > 0;
    if (!thoughts.value.trim() && !resultUp && !qaUp) return;
    undoSnap = { box: thoughts.value, session: resultUp || qaUp ? session : null };
    if (resultUp) undoSnap.result = { output: output.value, dom: snapResult(), grade: ui.grade, round: ui.round, rounds: rounds.slice(), reworkFrom: reworkFrom, reworkSeed: reworkSeed, reworkDraft: reworkDraft, compare: ui.compare,
      mem: memory.suggestions.slice(), status: status.textContent, keep: keepStatus.textContent, noteSaved: noteSaved, promptCopied: promptCopied };
    if (qaUp) undoSnap.qa = JSON.parse(JSON.stringify({ title: chat.title, need: chat.need, readGoal: chat.readGoal, goalEdited: chat.goalEdited, plan: chat.plan, questions: chat.questions,
      answers: chat.answers, tapped: chat.tapped, messages: chat.messages, current: chat.current }));
    undoTimer = setTimeout(function () { undoSnap = null; }, 7000);   /* a little past the 6 second pill */
  }
  window.addEventListener("stp-undo", function () {
    var u = undoSnap;
    if (!u) return;
    undoSnap = null;
    clearTimeout(undoTimer);
    writeRun++;
    setBusy(false);
    stopTicker();
    setBuild("");
    thoughts.value = u.box;
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    if (u.qa) {
      session = u.session;
      Object.keys(u.qa).forEach(function (k) { chat[k] = u.qa[k]; });
      chat.typing = false;
      result.hidden = true;
      qa.hidden = false;
    }
    if (u.result) {
      session = u.session;
      output.value = u.result.output;
      setReady(true);
      restoreResult(u.result.dom);
      xray.set({ prompt: output.value, raw: session.raw, answers: withMem(session.answers), core: extraBlock(), known: sessionKnown() });
      ui.grade = u.result.grade;
      ui.round = u.result.round;
      rounds = u.result.rounds || [];
      reworkFrom = u.result.reworkFrom || 0;
      reworkSeed = u.result.reworkSeed || "";
      reworkDraft = u.result.reworkDraft || null;
      ui.compare = u.result.compare || null;
      memory.suggestions = u.result.mem;
      status.textContent = u.result.status;
      keepStatus.textContent = u.result.keep;
      noteSaved = u.result.noteSaved;
      promptCopied = u.result.promptCopied;
      qa.hidden = true;
      result.hidden = false;
      output.dispatchEvent(new Event("stp:changed"));
    }
    ideasSync();
    var back = u.result ? result : u.qa ? qa : null;
    if (back) back.scrollIntoView({ behavior: "smooth", block: "start" });
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
    notify("form", "info", "Paste it in yourself", "Press and hold inside the box, then tap Paste.");
  }
  /* wrap (optional): turns the transcript into the box text, e.g. the Improve this app background. */
  /* anyway: the person saw the "same transcript" warning and wants it pasted regardless. */
  function pasteFromClipboard(fromShortcut, wrap, anyway) {
    if (!navigator.clipboard || !navigator.clipboard.readText) { pasteFailed(); return; }
    pendingPaste = null;
    navigator.clipboard.readText().then(function (text) {
      text = (text || "").trim();
      if (!text) { notify("form", "warn", "Your clipboard is empty", "In Voice Memos, tap the three dots on your recording, then Copy Transcript. Then come back and tap Paste.", [{ label: "Paste again", act: "paste", primary: true }]); return; }
      if (text === "Speak to Prompt: waiting for your transcript") { notify("form", "warn", "That's the shortcut's placeholder", "It isn't your transcript yet. In Voice Memos, choose Copy Transcript, then tap Paste.", [{ label: "Paste again", act: "paste", primary: true }]); return; }
      if (!anyway && usedPrints.indexOf(printOf(text)) !== -1) {
        pendingPaste = { fromShortcut: fromShortcut, wrap: wrap };
        notify("form", "warn", "That's the transcript you already used", "Your clipboard still has the last one. In Voice Memos, tap the three dots on your new recording, then Copy Transcript, and paste again.", [{ label: "Paste again", act: "paste", primary: true }, { label: "Use it anyway", act: "pasteanyway" }]);
        return;
      }
      pastedPrint = printOf(text);
      /* From the shortcut, the transcript replaces whatever was in the box
         (a fresh run). Tapped by hand, it adds to what's already typed. */
      var current = fromShortcut ? "" : thoughts.value.trim();
      if (wrap) text = wrap(text);
      thoughts.value = current ? current + "\n\n" + text : text;
      thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
      notify("form");
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
  /* Staging test switches (staging only, this tab only, nothing saved). Put either word
     after # (or both, like #flashbusy-slowtest):
     - flashbusy: for 5 minutes every Flash model answers "busy" without anything being
       sent, to see the page keep cycling, Switch to quick at 2:00, and the quick model at 3:00.
     - slowtest: the timing runs 10x faster (next Flash every 3 seconds, Switch to quick
       at 0:12, quick model at 0:18). A reload goes back to normal.
     - lowgrade (v2.1.39): the first Quality check of each prompt comes back under the bar
       (3.4, missing who the AI is and background), so Ask me, then rewrite can be tried
       without waiting for a weak prompt. The grader still runs; only its answer is swapped,
       and round 2 gets its real grade. Needs Show run stats on, like every Quality check. */
  var fakeBusyUntil = 0, fakeLowGrade = false;
  function stagingSwitches() {
    var h = location.hash || "";
    if (/^#stpback=/.test(h)) return;   /* a shortcut result (#53) is never a test switch */
    if (IS_STAGING && /lowgrade/.test(h)) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      fakeLowGrade = true;
      notify("form", "info", "Low grade test is on", "Staging test. Turn on Show run stats in More options, then build any prompt: its first Quality check comes back under the bar, so you can try Ask me, then rewrite. Reload to go back to normal.");
      return;
    }
    if (!IS_STAGING || !/flashbusy|slowtest/.test(h)) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    var fb = /flashbusy/.test(h), st = /slowtest/.test(h);
    if (fb) fakeBusyUntil = Date.now() + 5 * 60000;
    if (st) TIME_SCALE = 0.1;
    var at = st ? ["0:12", "0:18"] : ["2:00", "3:00"];
    notify("form", "info", fb && st ? "Busy Flash + 10x timing test is on" : fb ? "Flash models will say busy for 5 minutes" : "Slow-write test is on (10x faster)",
      "Staging test. Tap Normal and build" + (fb ? ": every Flash model says busy, the page keeps trying them" : " something with a few details") + ", the \u26a1 Quick version chip under the timer grows a countdown at " + at[0] + ", and the quick model writes it at " + at[1] + ". Reload to go back to normal.");
  }
  window.addEventListener("hashchange", stagingSwitches);
  setTimeout(stagingSwitches, 0);
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
    ideasShowBtn.hidden = !(ideasEl.classList.contains("gone") && !thoughts.value.trim() && !shortcutMode() && !startHere.active);
  }
  function ideasHide() { clearTimeout(ideasBack); ideasEl.classList.add("gone"); ideasStop(); ideasBtnSync(); }
  function ideasSync() {
    if (!ideasEl) return;
    /* Start here (StartHere.svelte) shows first; the ideas come in when it ends. */
    /* Talk it out (MicButton.svelte) sets data-listening, so the ideas stay away while the mic is on. */
    if (thoughts.value.trim() || thoughts.dataset.listening || document.activeElement === thoughts || shortcutMode() || startHere.active) { ideasHide(); return; }
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
  window.addEventListener("stp-starthere-end", function () { ideasSync(); });
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
    notify("form");
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
  /* Which key the counters belong to (v2.1.28, idea mw4h2n0fwm08). Each Google account's key has
     its own daily limits, so a different key must not inherit "Flash is used up" or the old
     counts. Only a short scrambled fingerprint is kept (8 hex characters, can't be turned back
     into the key), never the key itself.
     - stp-key-fp: the key the counters are for now. A key with a new fingerprint clears today's
       used-up list and the run stats counts.
     - stp-studio-fp: the first key seen, the one the AI Studio screenshots (usage.json) are read
       from. Those numbers only show while that key is in use. */
  var FP_KEY = "stp-key-fp", STUDIO_FP = "stp-studio-fp";
  function keyPrint(key) {
    var h = 0x811c9dc5;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function studioMine() { var home = lsGet(STUDIO_FP), now = lsGet(FP_KEY); return !home || !now || home === now; }
  /* Called when Google accepts a key. Returns true when it's a different key than last time. */
  function keyChanged(key) {
    var fp = keyPrint(key), was = lsGet(FP_KEY);
    if (!lsGet(STUDIO_FP)) lsSet(STUDIO_FP, was || fp);
    lsSet(FP_KEY, fp);
    if (!was || was === fp) return false;
    try { localStorage.removeItem(REST_KEY); } catch (e) {}
    testLog.newKey();
    return true;
  }

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
    var lites = names(usable.filter(function (m) { return /lite/.test(m.name); }).sort(byNewest).slice(0, 3));   /* up to 3, so the Flash-Lite crew can spread out (v2.1.20) */
    var all = names(usable.filter(function (m) { return !/lite/.test(m.name); }).sort(byNewest))
      .concat(names(usable.filter(function (m) { return /lite/.test(m.name); }).sort(byNewest)));
    /* Gemma (v2.1.22) is dropped in v2.1.25: on a real free key both Gemma 4 models sat
       the full 30s without answering, so every grade waited for nothing and then fell
       to Flash. Flash-Lite has room to spare (about 500 a day per model), so grading and
       the fact list are back on it. gemma stays an empty list so the routes stay simple. */
    return { write: flashes.concat(lites), intake: lites.concat(flashes), gemma: [], all: all };
  }
  function isGemma(model) { return /gemma/.test(model || ""); }
  function isFlashWriter(model) { return /flash/.test(model || "") && !/lite/.test(model || "") && !isGemma(model); }
  /* Plain family name for the run log: Flash-Lite or Flash (Gemma kept for old logs, v2.1.25). */
  function familyOf(model) { return isGemma(model) ? "Gemma" : /lite/.test(model || "") ? "Flash-Lite" : /flash/.test(model || "") ? "Flash" : ""; }
  /* What happened before the model that did the job got it, from askGemini's hand-off notes
     ("gemini-3.5-flash-lite timed out at 30s"). Empty when the first pick did it. */
  function handoffs(model, history) {
    return (history || []).join("; ");
  }
  /* Step by step's "who" line: the family that did the job, plus any hand-offs before it (v2.1.25). */
  function crewWho(model, history, fallback) {
    if (!model) return fallback || "";
    var why = handoffs(model, history).replace(/gemini-/g, "");
    return familyOf(model) + (why ? " (hand-off: " + why + ")" : "");
  }

  /* ROUTES (v2.1.25, Gemma dropped): which models do each job, best fit first. One place to change it.
       read        questions step           Flash-Lite, then Flash         speed, JSON
       clean/ledger prep crew               Flash-Lite crew (ledger: a second Flash-Lite joins after 10s)
       write       Normal and Rework        Flash only (#35)               best writing
       quick       Quick prompts, Polish    Flash-Lite, then Flash         speed
       standin     Check's test run (8s)    Flash-Lite                     has to be fast
       grade       quality grade + bench    Flash-Lite only, never the writer, never Flash; the other joins at 12s
       squeeze     My context too long      Flash-Lite                     you're waiting, so fast first
       labelfix    add a missing label      Flash-Lite, then Flash
     The grader is never the model that wrote the prompt. */
  function route(job, writer) {
    var p = gemini.plan || { write: [], intake: [] };
    var lites = p.intake.filter(function (m) { return /lite/.test(m); });
    if (job === "grade") return graderModels(writer).filter(function (m, i, a) { return m !== writer && a.indexOf(m) === i; });
    if (job === "ledger") return liteCrew(2);
    if (job === "squeeze") return lites;
    return p.intake;
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
      var fresh = keyChanged(key);
      testLog.refresh();
      gemini.model = plan.write[0];
      if (remember.checked) storeSet(key);
      var backups = plan.write.length - 1;
      setKeyStatus((techOn() ? "Key works. Writing with " + plan.write[0] + ", questions with " + plan.intake[0] +
        (backups ? ", plus " + backups + " backup model" + (backups > 1 ? "s" : "") + " for busy days" : "") +
        (plan.gemma.length ? ". Grading and fact lists on " + plan.gemma.join(" and ") + "." : ".")
        : "Key works. You're all set: Gemini will ask a few quick questions, then write your prompt.") +
        (fresh ? " New key, so today's limits start fresh." : ""), "good");
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
    if (remember.closest("label")) remember.closest("label").classList.remove("keep-halo");   /* v2.1.25 */
    gemini.key = "";
    gemini.model = ""; gemini.plan = null;
    storeDel();
    updateKeyState();   /* the Quick mode nudges come back (v2.1.23) */
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
  /* Snap to the cooking (Build 4): Build closes the keyboard and brings the tracker with the
     cooking ring to the middle of the screen. The keyboard needs a moment to get out of
     the way first, or the scroll lands short. */
  function snapTo(el) {
    if (!el) return;
    var a = document.activeElement, typed = a && /^(TEXTAREA|INPUT)$/.test(a.tagName);
    if (typed) a.blur();
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var go = function () { if (!el.hidden) el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" }); };
    if (typed) setTimeout(go, 320); else requestAnimationFrame(go);
  }
  function setBuild(text, bad) { stopTicker(); setProgress(document.getElementById("buildProg"), "off"); buildStatus.textContent = text; buildStatus.className = "buildstatus" + (bad ? " bad" : ""); }
  function setBusy(on, label) {
    busy = on;
    buildBtn.disabled = on;
    chat.busy = on;
    buildBtn.textContent = on ? (label || "Working...") : "Build my prompt";
    if (!on) ui.reading = false;   /* Switch to Quick (QuickSwitch.svelte) only shows while Read runs */
    if (on) wakeOn(); else wakeOff();
  }
  /* Keep the screen awake while Gemini works, so the phone doesn't lock mid-build.
     Only while busy: let go when it's done, fails, or the page is hidden; ask again if
     you come back mid-build. Phones without it get a one-line tip instead. */
  var wakeLock = null, wakeTip = document.getElementById("wakeTip");
  function wakeOn() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) { if (wakeTip) wakeTip.hidden = false; return; }
    if (wakeLock || document.visibilityState !== "visible") return;
    navigator.wakeLock.request("screen").then(function (l) {
      if (!busy) { l.release().catch(function () {}); return; }
      wakeLock = l;
      l.addEventListener && l.addEventListener("release", function () { if (wakeLock === l) wakeLock = null; });
    }, function () { if (wakeTip) wakeTip.hidden = false; });
  }
  function wakeOff() {
    if (wakeTip) wakeTip.hidden = true;
    var l = wakeLock; wakeLock = null;
    if (l) l.release().catch(function () {});
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && busy) wakeOn(); });



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
    simple:   { level: "low",    words: "light thinking",    secs: 12,  range: "usually about 12 seconds", label: "Quick request" },
    standard: { level: "medium", words: "balanced thinking", secs: 31,  range: "usually about 30 seconds", label: "Standard request" },
    complex:  { level: "high",   words: "deep thinking",     secs: 45,  range: "usually about 45 seconds",    label: "Complex request" },
    quick:    { level: "quick",  words: "balanced thinking",   secs: 12,  range: "about 10 seconds",         label: "Quick prompt" }
  };
  /* Quick prompts: Flash-Lite is fast enough to think a bit more, which keeps
     it from dropping details. A Flash backup stays light so it stays quick. */
  function quickLevel(model) { return /lite/.test(model) ? "medium" : "low"; }
  function depthWords(depth, model) {
    if (/^shortcut-/.test(model)) return "Apple " + scLabel(scOf(model)) + " model";   /* #53 */
    if (depth.level !== "quick") return depth.words;
    return quickLevel(model) === "medium" ? "balanced thinking" : "light thinking";
  }
  /* Quick prompts go to Flash-Lite first (largest free daily allowance, fastest),
     so they don't spend the small Flash allowance that full prompts need.
     Flash models stay in the list as backups. */
  function writeModels(quick) { return quick ? gemini.plan.intake : gemini.plan.write; }
  /* #35 widened (10/30): Normal and Rework prompts are written by Flash models only.
     A weaker backup (Flash-Lite) slipping in during a busy spell is what added junk
     numbers, so it never writes these without asking. A key with no Flash model at all
     keeps the old list, so the app still works. */
  function fullWriters() { var f = gemini.plan.write.filter(function (m) { return !/lite/.test(m); }); return f.length ? f : gemini.plan.write; }
  function flashOnly() { return fullWriters().every(function (m) { return !/lite/.test(m); }); }
  function depthOf(c) { return DEPTH[c] || DEPTH.standard; }
  /* Model names and thinking levels only show with run stats on; everyone else
     sees plain words and times. */
  function techOn() { return testLog.on(); }
  function planText(c, model) { var d = depthOf(c); return d.label + (techOn() ? " \u00b7 " + model + " with " + d.words : "") + " \u00b7 " + writeEstimate(DEPTH[c] ? c : "standard").range; }
  /* Used up for today (v2.1.18): rest times are gone. A busy, slow, or per-minute-limited
     model is simply tried again on the next pass of the cycle. The only thing remembered is
     a model Google says has hit today's limit, until the daily reset (3 AM Eastern), so a
     build doesn't keep knocking on a model that can't answer and the page can say when
     Flash is back. Stored on this device: model names and times only. Older busy and
     per-minute entries are ignored. */
  var REST_KEY = "stp-model-rest";
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
    if (x && x.why && x.why !== "day") return null;   // busy and per-minute rests are retired
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
     - Models used up for today go to the back of the line.
     - handle.cycle (Normal and Rework writes): when every model has said busy, it waits
       a moment and goes around again, until handle.stop() (Switch to quick, or 3:00).
       Models used up for today drop out of the cycle; a per-minute limit is waited out
       for that model only. No rest times are saved.
     - Moves on when a model is out of its limit, busy, slower than its limit,
       or sends back nothing.
     - hedgeAfter (writes only): if the model hasn't answered after that many ms,
       the next model starts too and the first good answer wins (the other is
       stopped). One busy model can't hold you hostage for minutes.
     level sets how much the model thinks first. onModel(name) reports which
     model is working. handle (optional): askGemini puts handle.stop() on it, which
     stops every model still working and rejects with status "stopped". It returns
     false if an answer already came back (too late to stop). */
  /* Time away: iPhone pauses the page while you're in another app, so a run's
     seconds would include that time. Waits are logged without it (hidden_s shows it). */
  var awaySpans = [], awayAt = document.visibilityState === "hidden" ? Date.now() : 0;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { if (!awayAt) awayAt = Date.now(); }
    else {
      if (awayAt) { awaySpans.push([awayAt, Date.now()]); awayAt = 0; if (awaySpans.length > 50) awaySpans.shift(); }
      comeBack();
    }
  });
  /* Leaving mid-build (idea mvojarxehejm). iPhone pauses the page in another app and
     web notifications only work for Home Screen apps, so instead: a request that drops
     while you're away gets one more try on the same model (askGemini), the tab title
     says when it's ready if it finishes while you're gone, and coming back says so. */
  var titleBase = "", readyAway = "";
  function doneAway(what) {
    if (document.visibilityState !== "hidden") return false;
    if (!titleBase) titleBase = document.title;
    document.title = (what === "questions" ? "\u2753 Questions ready \u00b7 " : "\u2705 Prompt ready \u00b7 ") + titleBase;
    readyAway = what;
    return true;
  }
  function comeBack() {
    if (titleBase) { document.title = titleBase; titleBase = ""; }
    if (readyAway === "prompt" && !result.hidden) notify("result", "success", "Ready while you were away", "Your prompt finished while you were in another app. It's below, ready to copy.");
    readyAway = "";
    if (busy) cook.back = Date.now();
  }
  function awayMs(t0) {
    var now = Date.now(), ms = awayAt ? now - Math.max(awayAt, t0) : 0;
    awaySpans.forEach(function (s) { if (s[1] > t0) ms += s[1] - Math.max(s[0], t0); });
    return Math.max(0, ms);
  }
  function askGemini(text, asJson, models, level, onModel, limit, hedgeAfter, handle) {
    var started = Date.now();
    var history = [];
    var fresh = models.filter(function (m) { return !resting(m); });
    var tired = models.filter(function (m) { return resting(m); });
    tired.forEach(function (m) { history.push(m + " skipped (used up today)"); });
    var list = fresh.concat(tired);
    function payload(withThinking, model) {
      var cfg = {}, gem = isGemma(model);
      /* Gemma (v2.1.22) doesn't take Gemini's JSON switch or thinking level, so it gets
         neither and is asked in words for bare JSON instead (pulled out below). */
      if (asJson && !gem) cfg.responseMimeType = "application/json";
      var lvl = withThinking && !gem ? (level === "auto" ? levelFor(model) : level === "quick" ? quickLevel(model) : level) : "";
      if (lvl) cfg.thinkingConfig = { thinkingLevel: lvl };
      var ask = asJson && gem ? text + "\n\nReply with only the JSON object: no code fences, no other words." : text;
      var p = { contents: [{ role: "user", parts: [{ text: ask }] }] };
      if (Object.keys(cfg).length) p.generationConfig = cfg;
      return JSON.stringify(p);
    }
    return new Promise(function (resolve, reject) {
      var next = 0, running = 0, done = false, lastErr = null, live = [], awayTried = {};
      var dead = {}, waitUntil = {}, pass = 1, pauseT = null, raced = false;
      function finish(ok, value) {
        if (done) return;
        done = true;
        raced = !!ok;   /* anything still in flight now was beaten by a faster model */
        clearTimeout(pauseT);
        live.forEach(function (c) { try { c.abort(); } catch (e) {} });
        if (ok) resolve(value); else reject(value);
      }
      if (handle) handle.stop = function () {
        if (done) return false;
        var s = new Error("Switched to the quick model."); s.status = "stopped";
        finish(false, s);
        return true;
      };
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
        if (next >= list.length) { if (!running) { if (handle && handle.cycle) goAround(); else giveUp(); } return; }
        var m = list[next];
        if (dead[m] && handle && handle.cycle) { next++; return startNext(); }
        run(next++, true);
      }
      /* Every model said busy: pause, then try them all again (only the ones not used up). */
      function goAround() {
        var alive = list.filter(function (m) { return !dead[m]; });
        if (!alive.length) return giveUp();
        var now = Date.now(), soonest = Math.min.apply(null, alive.map(function (m) { return waitUntil[m] || 0; }));
        var wait = Math.max(CYCLE_PAUSE * TIME_SCALE, soonest - now);
        history.push("every model busy, trying again in " + Math.round(wait / 1000) + "s");
        pauseT = setTimeout(function () {
          if (done) return;
          pass++;
          var t = Date.now();
          list = alive.filter(function (m) { return (waitUntil[m] || 0) <= t; }).concat(alive.filter(function (m) { return (waitUntil[m] || 0) > t; }));
          next = 0;
          cookSwitch();
          startNext();
        }, wait);
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
          cookSwitch();
          startNext();
        }, hedgeAfter) : null;
        var settled = false;
        function settle() { if (settled) return; settled = true; running--; clearTimeout(timer); clearTimeout(hedge); }
        /* Staging #flashbusy: Flash answers "busy" without anything being sent. */
        var call = fakeBusyUntil > Date.now() && /flash/.test(model) && !/lite/.test(model)
          ? new Promise(function (res, rej) { setTimeout(function () { var b = new Error("Staging test: Flash busy."); b.status = 503; rej(b); }, 300); })
          : callGoogle("models/" + model + ":generateContent", gemini.key, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload(withThinking, model),
          signal: ctrl ? ctrl.signal : undefined
        });
        call.then(function (res) {
          settle();
          if (done) return;
          var um = res.usageMetadata || {};
          testLog.request(model, um.totalTokenCount || 0, false);
          var c = res.candidates && res.candidates[0];
          var parts = (c && c.content && c.content.parts) || [];
          var out = parts.map(function (p) { return p.thought ? "" : (p.text || ""); }).join("").trim();
          if (out && asJson && isGemma(model)) {   /* Gemma: keep just the JSON object, so every reader gets clean JSON */
            var ja = out.indexOf("{"), jb = out.lastIndexOf("}");
            out = ja >= 0 && jb > ja ? out.slice(ja, jb + 1) : "";
          }
          if (!out) { var e = new Error("Gemini sent back an empty answer."); e.status = "empty"; throw e; }
          /* Only accept answers Gemini marks as finished, so a cut-off prompt is never shown. */
          if (c.finishReason && c.finishReason !== "STOP") { var e2 = new Error("Gemini stopped early (" + c.finishReason + ")."); e2.status = "empty"; throw e2; }
          clearRest(model);
          var away = awayMs(started);
          finish(true, { text: out, model: model, ms: Math.max(0, Date.now() - started - away), away: away, history: history, tokens: um.totalTokenCount || null, thinkingTokens: um.thoughtsTokenCount || 0 });
        }).catch(function (e) {
          settle();
          if (done) { if (raced) testLog.miss(model, "slower than a backup"); return; }   // another model already won; this one was stopped on purpose
          var secs = Math.round((Date.now() - tAttempt) / 1000);
          /* Run stats: every request that didn't answer shows on its model's usage row (v2.1.25). */
          if (!(e.status === 400 && !isGemma(model))) testLog.miss(model, e.status === "timeout" ? "timed out" : e.status === 429 ? (limitKind(e).daily ? "daily limit" : "per-minute limit")
            : e.status === 400 && isGemma(model) ? "turned down" : e.status === "empty" ? "incomplete" : e.status === "network" ? "unreachable" : "busy");
          /* Dropped or timed out while you were in another app: not the model's fault, so the
             same model gets one more try (no rest, no backup spent) now that you're back. */
          if ((e.status === "network" || e.status === "timeout") && !awayTried[i] && awayMs(tAttempt) >= 1000) {
            awayTried[i] = true;
            history.push(model + " dropped while you were away, so it tried again");
            return run(i, withThinking);
          }
          /* "after Ns" shows how long a model made you wait before the next one took over */
          if (e.status === "timeout") history.push(model + " timed out at " + secs + "s");
          else if (e.status === 429) {
            var k = limitKind(e);
            if (k.daily) {
              history.push(model + " was at its daily limit" + (k.value ? " (" + k.value + ")" : ""));
              if (k.value) learnLimit(model, k.value);
              testLog.request(model, 0, true); restModel(model, msToReset(), "day"); dead[model] = true;
            } else {
              e.perMinute = true;
              history.push(model + " hit its per-minute limit" + (k.wait ? ", back in " + Math.round(k.wait) + "s" : ""));
              waitUntil[model] = Date.now() + Math.max(15, k.wait || 60) * 1000 * TIME_SCALE;   /* this build only, nothing saved */
            }
          }
          else if (e.status === "empty") history.push(model + " sent an incomplete answer after " + secs + "s");
          else if (e.status === "network") history.push(model + " couldn't be reached after " + secs + "s");   // not the model's fault, so no rest
          else if (RETRY.indexOf(e.status) !== -1) history.push(model + " was unavailable after " + secs + "s");
          /* A model that rejects the thinking setting gets one more try without it. */
          if (e.status === 400 && withThinking && !isGemma(model)) return run(i, false);
          /* A Gemma model that turns the request down (400) just hands it to the next model. */
          if (e.status === 400 && isGemma(model)) history.push(model + " turned the request down, so the next model took it");
          if (RETRY.indexOf(e.status) !== -1 || (e.status === 400 && isGemma(model))) { lastErr = e; if (!running) { if (next < list.length) cookSwitch(); startNext(); } return; }
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
  /* Busy hours (tuning.json "busy", written by the review from the run log): in a
     3-hour block (Eastern, Google's load doesn't care where the phone is) where the
     usual writer is busy at least half the time, start on the less busy Flash model
     if the log shows one, and start a backup after race_s seconds instead of up to 90. */
  function busyNow() {
    var b = tuning && tuning.busy, h;
    if (!b || typeof b !== "object") return null;
    try { h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date())) % 24; } catch (e) { return null; }
    var p = b[String(Math.floor(h / 3) * 3)];
    if (!p || typeof p.race_s !== "number") return null;
    return { start: typeof p.start === "string" ? p.start : "", race: Math.min(90, Math.max(15, Math.round(p.race_s))) };
  }
  function busyOrder(models, start) {
    for (var i = 1; i < models.length; i++) if (start && models[i].replace(/^gemini-/, "") === start && !/lite/.test(models[i])) return [models[i]].concat(models.slice(0, i), models.slice(i + 1));
    return models;
  }
  /* lessons.json: short rules the twice-daily review learned from graded runs and
     stress tests (general prompt-writing lessons, never anyone's words). Every
     prompt build uses them. At most 6, each kept short, so the writer stays fast. */
  var lessons = { v: 0, list: [], items: [], gv: 1, grader: [], src: "live" };
  /* Grading sessions (dev tools only): a draft of lessons.json rides in a link
     (#draft=<base64url JSON>) made by scripts/draft.mjs. Opening or pasting it
     saves the draft on this device and switches to it, so grader tweaks can be
     tried right away with no push. Live is lessons.json from the site, which is
     what everyone else gets. Draft only applies while Show my dev tools is on. */
  var DRAFT_KEY = "stp-lessons-draft", SRC_KEY = "stp-lessons-src", liveLessons = lessons;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function draftFrom(text) {
    var m = String(text || "").match(/#draft=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
      var b = m[1].replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "=";
      var bin = atob(b), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var j = JSON.parse(new TextDecoder().decode(bytes));
      if (!j || !(Array.isArray(j.lessons) || Array.isArray(j.grader))) return null;
      var h = 5381; for (i = 0; i < m[1].length; i++) h = ((h * 33) ^ m[1].charCodeAt(i)) >>> 0;
      return { j: j, b64: m[1], id: h.toString(36).slice(0, 5), at: new Date().toISOString() };
    } catch (e) { return null; }
  }
  function fmtWhen(d) { try { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }
  function savedDraft() { try { var d = JSON.parse(lsGet(DRAFT_KEY) || "null"); return d && d.j && d.b64 ? d : null; } catch (e) { return null; } }
  function applySrc() {
    var d = savedDraft(), useDraft = !!(core.dev && d && lsGet(SRC_KEY) === "draft");
    if (useDraft) { lessons = lessonsFrom(d.j); lessons.src = "draft"; lessons.id = d.id; }
    else lessons = liveLessons;
    renderSrc(d, useDraft);
  }
  function renderSrc(d, useDraft) {
    var live = document.getElementById("srcLive"); if (!live) return;
    var dr = document.getElementById("srcDraft"), info = document.getElementById("srcInfo");
    live.setAttribute("aria-pressed", useDraft ? "false" : "true");
    dr.setAttribute("aria-pressed", useDraft ? "true" : "false");
    dr.disabled = !d; document.getElementById("draftCopy").disabled = !d; document.getElementById("draftClear").disabled = !d;
    var lv = "Live is g" + liveLessons.gv + ", lessons v" + (liveLessons.v || 0) + ".";
    if (useDraft) info.textContent = "Using Draft " + d.id + ": g" + lessons.gv + ", lessons v" + (lessons.v || 0) + ", loaded " + fmtWhen(new Date(d.at)) + ". " + lv;
    else info.textContent = "Using Live. " + lv + (d ? " Draft " + d.id + " is saved." : "");
  }
  function takeDraft(d) { if (!d) return false; lsSet(DRAFT_KEY, JSON.stringify(d)); lsSet(SRC_KEY, "draft"); applySrc(); return true; }
  function loadLessons() {
    var fromLink = draftFrom(location.hash);
    if (fromLink) { takeDraft(fromLink); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    applySrc();
    fetch("lessons.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { liveLessons = lessonsFrom(j); liveLessons.src = "live"; applySrc(); }, function () {});
  }
  document.getElementById("srcLive").addEventListener("click", function () { lsSet(SRC_KEY, "live"); applySrc(); });
  document.getElementById("srcDraft").addEventListener("click", function () { lsSet(SRC_KEY, "draft"); applySrc(); });
  document.getElementById("draftClear").addEventListener("click", function () { lsSet(DRAFT_KEY, null); lsSet(SRC_KEY, "live"); applySrc(); });
  document.getElementById("devTools").addEventListener("change", function () { setTimeout(applySrc, 0); });
  document.getElementById("draftPaste").addEventListener("click", function () {
    var info = document.getElementById("srcInfo");
    if (!navigator.clipboard || !navigator.clipboard.readText) { info.textContent = "This browser can't read the clipboard. Open the draft link in this browser instead."; return; }
    navigator.clipboard.readText().then(function (t) {
      if (!takeDraft(draftFrom(t))) info.textContent = "No draft link on the clipboard. Copy the whole link from Claude, then tap Paste draft link.";
    }, function () { info.textContent = "Couldn't read the clipboard."; });
  });
  /* Grader bench (dev tools): bench.json holds fixed prompts with Claude's answer
     key. One tap grades them all with the current grader (Live or Draft) and shows
     how often it agrees. Same prompts every time, so a change in agreement comes
     from the grader, not from the writer. Results stay on this device. */
  var BENCH_KEY = "stp-bench", benchText = "", BENCH_RETRY_MS = window.__benchRetryMs || 4000;
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sameSet(a, b) { a = (a || []).slice().sort(); b = (b || []).slice().sort(); return a.join() === b.join(); }
  function benchLabel() { return (lessons.src === "draft" ? "Draft " + lessons.id : "Live") + " g" + lessons.gv; }
  function benchRun() {
    var info = document.getElementById("benchInfo"), btn = document.getElementById("benchRun");
    var key = gemini.key || gkey.value.trim();
    if (!key) { info.textContent = "Add your Gemini key first (Unlock smarter prompts, at the bottom)."; return; }
    btn.disabled = true;
    var ready = gemini.plan ? Promise.resolve() : verifyKey(key);
    ready.then(function () { return fetch("bench.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("bench.json"); return r.json(); }); })
      .then(function (b) {
        var cases = (b && b.cases) || [], items = lessons.items, grader = lessons.grader, label = benchLabel(), done = 0, out = [];
        info.textContent = "Grading 0 of " + cases.length + " with " + label + "...";
        /* A busy server (503) or a full per-minute limit gets one retry after a short wait. */
        function ask(c, retried) {
          return askGemini(gradePrompt(c.prompt, c.raw, c.answers || [], grader, items, c.today), true, route("grade"), "low", null, 45000).catch(function (e) {
            var busy = e && (e.status === 503 || e.status === 500 || (e.status === 429 && e.perMinute) || /high demand|overloaded/i.test(e.message || ""));
            if (retried || !busy) throw e;
            return new Promise(function (res) { setTimeout(res, BENCH_RETRY_MS); }).then(function () { return ask(c, true); });
          });
        }
        /* Same dock as a live run: the phone's number check on the case's own note and answers. */
        function caseFlags(c) { return numberFlags(c.prompt, [c.raw].concat((c.answers || []).map(function (a) { return a.answer; })).join("\n"), c.today); }
        function once(c) { return function () { return ask(c, false).then(function (r) { var g = gradeFrom(r.text, items); if (!g) throw new Error("Couldn't read the grade."); g = numberDock(g, caseFlags(c)); g.model = r.model; g.history = r.history || []; return g; }); }; }
        function one(c, i) {
          return gradeConfirmed(once(c)).then(function (g) {
            out[i] = { c: c, g: g, model: g.model };
          }, function (e) { out[i] = { c: c, g: null, err: (e && e.message) || "failed" }; }).then(function () {
            done++; info.textContent = "Grading " + done + " of " + cases.length + " with " + label + "...";
          });
        }
        /* Four at a time, so a free key's per-minute limit isn't hit all at once. */
        var chain = Promise.resolve(), step = 4;
        for (var i = 0; i < cases.length; i += step) (function (start) {
          chain = chain.then(function () { return Promise.all(cases.slice(start, start + step).map(function (c, k) { return one(c, start + k); })); });
        })(i);
        return chain.then(function () { showBench(out, label); });
      })
      .catch(function (e) { info.textContent = "Couldn't run the bench: " + ((e && e.message) || "unknown"); })
      .then(function () { btn.disabled = false; });
  }
  function showBench(out, label) {
    var ok = out.filter(function (o) { return o.g; }), n = ok.length;
    var agree = ok.filter(function (o) { return (o.g.craft >= GRADE_PASS) === (o.c.key.score >= GRADE_PASS); }).length;
    var inv = ok.filter(function (o) { return o.g.invented === !!o.c.key.invented; }).length;
    var lab = ok.filter(function (o) { return sameSet(o.g.missing, o.c.key.missing); }).length;
    var gap = n ? ok.reduce(function (t, o) { return t + Math.abs(o.g.craft - o.c.key.score); }, 0) / n : 0;
    var pct = n ? Math.round(100 * agree / n) : 0;
    var hist = {}; try { hist = JSON.parse(lsGet(BENCH_KEY) || "{}") || {}; } catch (e) {}
    var prev = Object.keys(hist).filter(function (k) { return k !== label; }).map(function (k) { return k + ": " + hist[k].pct + "%"; });
    hist[label] = { pct: pct, gap: Math.round(gap * 100) / 100, at: new Date().toISOString() };
    lsSet(BENCH_KEY, JSON.stringify(hist));
    var sum = label + ": " + agree + " of " + n + " pass/fail agree (" + pct + "%) \u00b7 avg gap " + gap.toFixed(2) + " \u00b7 invented " + inv + "/" + n + " \u00b7 labels exact " + lab + "/" + n;
    /* Who graded (v2.1.25): a count per model, and how many cases landed far from the key. */
    var by = {}; ok.forEach(function (o) { var m = String(o.g.model || "?").replace(/^gemini-/, ""); by[m] = (by[m] || 0) + 1; });
    var far = ok.filter(function (o) { return Math.abs(o.g.craft - o.c.key.score) > 0.5; }).length;
    var whoLine = "Graded by: " + Object.keys(by).map(function (m) { return m + " " + by[m]; }).join(", ") +
      " \u00b7 " + far + " of " + n + " more than half a point off the key";
    var rows = out.map(function (o) {
      var k = o.c.key, g = o.g, hold = o.c.holdout ? " class=\"hold\"" : "";
      if (!g) return "<tr" + hold + "><td>" + esc(o.c.id) + "</td><td>" + k.score.toFixed(2) + "</td><td>error</td><td>\u26a0\ufe0f<small>" + esc(o.err) + "</small></td></tr>";
      var match = (g.craft >= GRADE_PASS) === (k.score >= GRADE_PASS);
      var diff = [];
      if (!sameSet(g.missing, k.missing)) diff.push("missing: " + (g.missing.join(", ") || "none") + " vs " + (k.missing.join(", ") || "none"));
      if (g.invented !== !!k.invented) diff.push("invented " + (g.invented ? "yes" : "no") + " vs " + (k.invented ? "yes" : "no"));
      if (g.rearranged !== !!k.rearranged) diff.push("rearranged " + (g.rearranged ? "yes" : "no") + " vs " + (k.rearranged ? "yes" : "no"));
      if (confirmNote(g)) diff.push(confirmNote(g));
      if (g.numCheck) diff.push("number check docked it from " + g.numBefore.toFixed(2));
      var miss = handoffs(g.model, g.history).replace(/gemini-/g, "");
      return "<tr" + hold + "><td>" + esc(o.c.id) + "<small>" + esc(o.c.name) + "</small></td><td>" + k.score.toFixed(2) + "</td><td>" + g.craft.toFixed(2) + "<small>" + esc(String(g.model || "").replace(/^gemini-/, "")) + (miss ? " (hand-off: " + esc(miss) + ")" : "") + "</small></td><td>" + (match ? "\u2705" : "\u274c") + (diff.length ? "<small>" + esc(diff.join("; ")) + "</small>" : "") + "</td></tr>";
    }).join("");
    var el = document.getElementById("benchOut");
    el.innerHTML = "<p class=\"benchsum\">" + esc(sum) + "</p><p class=\"hint benchwho\">" + esc(whoLine) + "</p>" + (prev.length ? "<p class=\"hint\">Last runs: " + esc(prev.join(" \u00b7 ")) + "</p>" : "") +
      "<table><thead><tr><th>Case</th><th>Claude</th><th>Grader</th><th>Match</th></tr></thead><tbody>" + rows + "</tbody></table>";
    el.hidden = false;
    document.getElementById("benchInfo").textContent = "Done. \ud83d\udd12 cases are the final check: don't tune rules to them.";
    benchText = ["GRADER BENCH", sum, whoLine].concat(prev.length ? ["Last runs: " + prev.join(" \u00b7 ")] : []).concat(out.map(function (o) {
      var k = o.c.key, g = o.g;
      if (!g) return o.c.id + (o.c.holdout ? " (holdout)" : "") + ": error " + o.err;
      return o.c.id + (o.c.holdout ? " (holdout)" : "") + ": Claude " + k.score.toFixed(2) + " / grader " + g.craft.toFixed(2) + " on " + String(g.model || "?").replace(/^gemini-/, "") + " \u00b7 missing " + (g.missing.join(", ") || "none") + " (key: " + (k.missing.join(", ") || "none") + ") \u00b7 invented " + (g.invented ? "yes" : "no") + " (key: " + (k.invented ? "yes" : "no") + ") \u00b7 broke " + (g.broke.join(", ") || "none") + " \u00b7 rearranged " + (g.rearranged ? "yes" : "no") + (g.confirm ? " \u00b7 pass check " + g.confirm + " (" + g.firstCraft.toFixed(2) + " then " + (g.secondCraft != null ? g.secondCraft.toFixed(2) : "none") + ")" : "") + (g.numCheck ? " \u00b7 number check docked " + g.numBefore.toFixed(2) + " to " + g.craft.toFixed(2) + " (" + g.numCheck.join("+") + ")" : "");
    })).join("\n");
    document.getElementById("benchCopy").disabled = false;
  }
  document.getElementById("benchRun").addEventListener("click", benchRun);

  /* Flow bench (dev tools, v2.1.20, #47): the 5 hardest notes in flowbench.json, each run
     through the old flow (like live: Read, Write, Polish) and the new flow (Prep crew,
     fact ledger, shape, Polish with the ledger, stand-in AI). One shared Read per note sets
     the thinking depth for both, the answers come from the file, and your core, My context,
     and memory stay out, so the flow is the only difference. The flows take turns going
     first. Copy for Claude labels each pair A and B at random (the key stays on this phone
     until Copy reveal), so Claude scores them blind. About 10 Flash writes. */
  var FLOW_KEY = "stp-flowbench", FLOW_LAST = "stp-flowbench-last", flowText = "", flowReveal = "", flowLast = null, FLOW_RETRY_MS = window.__flowRetryMs || 10000;
  /* Run 1 lost 3 of 5 pairs to busy errors: a busy flow gets one more try after a short wait,
     and Rerun failed notes redoes only the halves that errored. The last run is kept on this
     phone (bench notes and prompts only) so a reload doesn't lose it. */
  try { flowLast = JSON.parse(lsGet(FLOW_LAST) || "null"); } catch (e) { flowLast = null; }
  function busyErr(e) { return !!e && (e.status === 503 || e.status === 500 || e.status === "timeout" || e.status === "empty" || e.status === "network" || (e.status === 429 && e.perMinute) || /high demand|overloaded/i.test(e.message || "")); }
  function flowTry(c, flow) {
    return flowOne(c, flow).catch(function (e) {
      if (!busyErr(e)) throw e;
      return new Promise(function (res) { setTimeout(res, FLOW_RETRY_MS); }).then(function () { return flowOne(c, flow); });
    });
  }
  function flowFailed() { return !!(flowLast && flowLast.results && flowLast.results.some(function (r) { return !r.old || r.old.err || !r.new || r.new.err; })); }
  function flowOne(c, flow) {
    var s = { raw: c.raw, known: "", today: c.today, memFacts: [], bench: true,
      answers: (c.answers || []).map(function (a) { return { question: a.question, answer: a.answer }; }), questions: (c.answers || []).slice() };
    session = s;
    var t0 = Date.now(), steps = [];
    function step(name, p) { var t = Date.now(); return p.then(function (v) { steps.push(name + " " + secsText((Date.now() - t) / 1000)); return v; }); }
    var prep = flow === "new" ? step("prep", Promise.all([startClean(c.raw), startLedger(c.raw)])) : Promise.resolve();
    var out = { flow: flow };
    return prep.then(function () {
      if (flow === "new") s.shape = c._shape || null;
      return step("write", askGemini(writerText(true), false, fullWriters(), depthOf(c._complexity).level, null, WRITE_LIMIT, ROTATE_MS));
    }).then(function (r) {
      var check = flow === "new" ? fullCheck : qualityCheck, draft = cleanPrompt(r.text), before = check(draft);
      out.model = r.model; out.prompt = draft; out.repair = "none";
      if (!before.score) return;
      return step("polish", askGemini(repairPrompt(draft, s.raw, withMem(s.answers), { dropped: before.dropped.concat(before.facts || []), stray: before.stray, missingNums: before.missingNums, strict: before.strict }), false, writeModels(true), "low", null, 60000)).then(function (r2) {
        var fixed = cleanPrompt(r2.text), after = check(fixed);
        if (isBetter(after, before, fixed, draft)) { out.prompt = fixed; out.repair = "fixed"; } else out.repair = "kept original";
      }, function () { out.repair = "failed"; });
    }).then(function () {
      if (flow !== "new") return;
      if (words(c.raw) < STANDIN_MIN_WORDS) { out.standin = "skipped (short note, like the app)"; out.open = 0; return; }
      return step("stand-in", standIn(out.prompt)).then(function (st) { if (st.prompt) out.prompt = st.prompt; out.standin = st.status; out.open = st.open.length; });
    }).then(function () {
      var x = qualityCheck(out.prompt), nf = promptFlags(out.prompt);
      out.secs = (Date.now() - t0) / 1000; out.steps = steps; out.words = words(out.prompt);
      out.xray = x.pct; out.dropped = x.dropped.length; out.numflags = nf.extra.length + nf.missing.length + nf.dates.length; out.strict = (x.strict || []).length;
      if (flow === "new") { out.clean = s.clean ? s.clean.status : ""; out.ledger = s.ledger && s.ledger.items ? s.ledger.items.length : 0; out.ledgerMissing = missingFacts(out.prompt).length; }
      return out;
    });
  }
  function flowRun(onlyFailed) {
    var info = document.getElementById("flowInfo"), btn = document.getElementById("flowRun");
    var key = gemini.key || gkey.value.trim();
    if (!key) { info.textContent = "Add your Gemini key first (Unlock smarter prompts, at the bottom)."; return; }
    if (busy) { info.textContent = "Finish the build that's running first."; return; }
    var saved = session, results = [], prior = {}, redone = [];
    if (onlyFailed === true && flowLast && flowLast.results) flowLast.results.forEach(function (r) { prior[r.c.id] = r; });
    else onlyFailed = false;
    /* Rerun redoes only the errored notes that are ticked in the table (all ticked by default), so
       a note can sit out a rerun to save Gemini calls. */
    var picked = onlyFailed ? Array.prototype.map.call(document.querySelectorAll("#flowOut .flowPick:checked"), function (b) { return b.getAttribute("data-id"); }) : null;
    if (onlyFailed && !picked.length) { info.textContent = "Tick at least one note to rerun."; return; }
    btn.disabled = true; document.getElementById("flowRetry").disabled = true;
    setBusy(true, "Flow bench running...");
    var ready = gemini.plan ? Promise.resolve() : verifyKey(key);
    ready.then(function () { return fetch("flowbench.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("flowbench.json"); return r.json(); }); })
      .then(function (b) {
        var cases = (b && b.cases) || [], chain = Promise.resolve();
        cases.forEach(function (c, i) {
          var tag = "Note " + (i + 1) + " of " + cases.length + " (" + c.name + "): ", had = prior[c.id];
          if (onlyFailed && had && had.old && !had.old.err && had.new && !had.new.err) { results[i] = had; return; }   /* this pair already worked */
          if (onlyFailed && picked.indexOf(c.id) < 0) { results[i] = had || { c: c }; return; }   /* not ticked: sits this rerun out */
          if (onlyFailed) redone.push(c.id);
          chain = chain.then(function () {
            if (had && had.c && had.c._complexity) { c._complexity = had.c._complexity; c._shape = had.c._shape; return; }
            info.textContent = tag + "reading...";
            session = { raw: c.raw, answers: [], today: c.today, known: "" };
            return askGemini(ANALYZE + "\n" + c.raw + '\n"""', true, gemini.plan.intake, "auto", null).then(function (r) {
              var it = parseIntake(r.text); c._complexity = it.complexity; c._shape = it.shape;
            }, function () { c._complexity = "standard"; c._shape = null; });
          }).then(function () {
            var res = { c: c }, order = i % 2 ? ["new", "old"] : ["old", "new"];
            if (had) { res.old = had.old; res.new = had.new; res.label = had.label; }   /* a rerun keeps the pair's A/B letters */
            return order.reduce(function (p, flow) {
              return p.then(function () {
                if (res[flow] && !res[flow].err) return;   /* rerun: keep the half that worked */
                info.textContent = tag + (flow === "new" ? "new flow" : "old flow") + "...";
                return flowTry(c, flow).then(function (o) { res[flow] = o; }, function (e) { res[flow] = { flow: flow, err: (e && e.message) || "failed" }; });
              });
            }, Promise.resolve()).then(function () { results[i] = res; });
          });
        });
        return chain.then(function () { showFlow(results, onlyFailed ? redone : null); });
      })
      .catch(function (e) { info.textContent = "Couldn't run the flow bench: " + ((e && e.message) || "unknown"); })
      .then(function () { session = saved; setBusy(false); btn.disabled = false; document.getElementById("flowRetry").disabled = !flowFailed(); });
  }
  /* redone: the note ids a rerun redid (null on a full run). A rerun's Copy for Claude has only
     those notes, since Claude scored the rest already; Copy reveal always covers every note.
     A pair keeps its A/B letters for the life of a run (r.label; older saved runs fall back to
     the saved map), so the reveal still matches scores from before the rerun. restore: rebuild
     the copies from the saved run after a reload, without re-running anything. */
  function showFlow(results, redone, restore) {
    var at = restore && flowLast && flowLast.at ? flowLast.at : new Date().toISOString();
    var ids = redone && redone.length ? redone : null, oldMap = {};
    if (ids || restore) { try { oldMap = JSON.parse(lsGet(FLOW_KEY) || "{}").map || {}; } catch (e) { oldMap = {}; } }
    var map = {}, blind = [], reveal = [], when = new Date(at).toLocaleString("en-US"), ver = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
    function sum(o) {
      if (!o || o.err) return "error: " + (o && o.err);
      return secsText(o.secs) + ", " + o.words + " words, X-ray " + o.xray + "%, " + o.dropped + " dropped, " + o.numflags + " number flags, " + (o.strict || 0) + " stricter words, repair " + o.repair +
        (o.flow === "new" ? ", clean " + o.clean + ", ledger " + o.ledger + " items (" + o.ledgerMissing + " missing), stand-in " + (o.standin || "none") + (o.open ? " (" + o.open + " open)" : "") : "") +
        " [" + (o.model || "").replace(/^gemini-/, "") + "; " + (o.steps || []).join(", ") + "]";
    }
    var howTo = "Score each pair against its key, without knowing which flow is which: how many key items each prompt keeps, anything invented or changed (dates, numbers, strictness), and which prompt would get the better answer from an AI. Then ask Kevin for the reveal.";
    if (ids) blind.push("FLOW BENCH (blind, rerun) \u00b7 app " + ver + " \u00b7 " + when + " \u00b7 " + ids.length + " of " + results.length + " notes",
      "Only the notes that errored last time. You scored the other pairs already, and every pair keeps its A and B letters, so a prompt you saw before is still under the same letter.", howTo);
    else blind.push("FLOW BENCH (blind) \u00b7 app " + ver + " \u00b7 " + when, howTo);
    results.forEach(function (r) {
      r.label = r.label || oldMap[r.c.id] || (Math.random() < 0.5 ? "A=new, B=old" : "A=old, B=new");
      var aNew = /^A=new/.test(r.label), A = aNew ? r.new : r.old, B = aNew ? r.old : r.new;
      map[r.c.id] = r.label;
      if (!ids || ids.indexOf(r.c.id) >= 0) blind.push("", "== " + r.c.id + " \u00b7 " + r.c.name + " ==", "Today: " + r.c.today, "Raw thoughts:", r.c.raw,
        "Answers: " + ((r.c.answers || []).map(function (a) { return a.question + " " + a.answer; }).join(" | ") || "none"),
        "Key:", "- " + r.c.key.join("\n- "),
        "--- Prompt A ---", A && A.prompt ? A.prompt : "(error: " + (A && A.err) + ")",
        "--- Prompt B ---", B && B.prompt ? B.prompt : "(error: " + (B && B.err) + ")");
      reveal.push(r.c.id + ": " + map[r.c.id] + (ids && ids.indexOf(r.c.id) >= 0 ? " (rerun)" : ""), "  old: " + sum(r.old), "  new: " + sum(r.new));
    });
    flowLast = { at: at, results: results, redone: ids };
    lsSet(FLOW_LAST, JSON.stringify(flowLast));
    lsSet(FLOW_KEY, JSON.stringify({ at: at, map: map }));
    flowText = blind.join("\n");
    flowReveal = ["FLOW BENCH reveal \u00b7 app " + ver + " \u00b7 " + when + " \u00b7 all " + results.length + " notes"].concat(reveal).join("\n");
    var rows = results.map(function (r) {
      function cell(o) { return !o || o.err ? "\u26a0\ufe0f error" : secsText(o.secs) + "<small>" + o.dropped + " dropped \u00b7 " + o.numflags + " flags" + (o.flow === "new" ? " \u00b7 ledger " + o.ledgerMissing + "/" + o.ledger + " missing" : "") + "</small>"; }
      var bad = !r.old || r.old.err || !r.new || r.new.err;
      var pick = bad ? '<label class="flowpick"><input type="checkbox" class="flowPick" data-id="' + esc(r.c.id) + '" checked> rerun</label>' : "";
      return "<tr><td>" + esc(r.c.id) + "<small>" + esc(r.c.name) + "</small>" + pick + "</td><td>" + cell(r.old) + "</td><td>" + cell(r.new) + "</td></tr>";
    }).join("");
    var el = document.getElementById("flowOut");
    el.innerHTML = "<table><thead><tr><th>Note</th><th>Old flow</th><th>New flow</th></tr></thead><tbody>" + rows + "</tbody></table>";
    el.hidden = false;
    document.getElementById("flowInfo").textContent = restore
      ? "Your last run (" + when + ") is loaded" + (flowFailed() ? ". Some halves errored: untick any note you want to skip, then tap Rerun failed notes." : ". Copy reveal covers all " + results.length + " notes.")
      : ids
      ? "Done. Copy for Claude has just the " + ids.length + " rerun note" + (ids.length === 1 ? "" : "s") + "; Copy reveal covers all " + results.length + ". Copy reveal only after Claude has scored."
      : "Done. Tap Copy for Claude and paste it into a chat. Copy reveal only after Claude has scored.";
    document.getElementById("flowCopy").disabled = false;
    document.getElementById("flowReveal").disabled = false;
  }
  document.getElementById("flowRun").addEventListener("click", function () { flowRun(false); });
  document.getElementById("flowRetry").addEventListener("click", function () { flowRun(true); });
  document.getElementById("flowRetry").disabled = !flowFailed();
  if (flowLast && flowLast.results && flowLast.results.length && flowLast.results.every(function (r) { return r && r.c && r.c.id && Array.isArray(r.c.key); })) {
    try { showFlow(flowLast.results, flowLast.redone, true); } catch (e) { /* a broken saved run just means no copies until the next run */ }
  }
  document.getElementById("flowCopy").addEventListener("click", function () {
    if (!flowText || !navigator.clipboard) return;
    navigator.clipboard.writeText(flowText).then(function () { document.getElementById("flowInfo").textContent = "Copied the blind pairs. Paste them to Claude."; }, function () {});
  });
  document.getElementById("flowReveal").addEventListener("click", function () {
    if (!flowReveal || !navigator.clipboard) return;
    navigator.clipboard.writeText(flowReveal).then(function () { document.getElementById("flowInfo").textContent = "Copied the reveal (which is which, times, and checks)."; }, function () {});
  });
  document.getElementById("benchCopy").addEventListener("click", function () {
    if (!benchText || !navigator.clipboard) return;
    navigator.clipboard.writeText("bench results\n\n" + benchText).then(function () { document.getElementById("benchInfo").textContent = "Copied. Paste it to Claude."; }, function () {});
  });
  document.getElementById("draftCopy").addEventListener("click", function () {
    var d = savedDraft(); if (!d || !navigator.clipboard) return;
    navigator.clipboard.writeText(location.origin + location.pathname + "#draft=" + d.b64).then(function () { document.getElementById("srcInfo").textContent = "Copied draft " + d.id + "'s link."; }, function () {});
  });
  /* The grader also gets the writer lessons, with their ids (L1, L2...), as the
     rubric of what not to do, and says which ones a prompt broke. */
  function lessonsFrom(j) {
    function clean(arr) {
      return (Array.isArray(arr) ? arr : []).map(function (l, i) {
        var id = String((l && l.id) || "");
        return { id: /^[A-Z]\d{1,3}$/.test(id) ? id : "L" + (i + 1), text: String((l && l.text) || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim() };
      }).filter(function (t) { return t.text && t.text.length <= 240; }).slice(0, 6);
    }
    var items = clean(j && j.lessons), grader = clean(j && j.grader);
    function texts(a) { return a.map(function (t) { return t.text; }); }
    return { v: items.length && typeof j.version === "number" ? j.version : 0, list: texts(items), items: items,
      gv: j && typeof j.grader_version === "number" ? j.grader_version : 1, grader: texts(grader) };
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
  /* Cooking steps (v2.1.18): Read and Clean run side by side on two Flash-Lite models, then
     Ask, then Write on Flash, then Polish (Auto-Repair on Flash-Lite, shown only on runs that
     need it, #36), then Check (the quality grade and its label fix, run stats on, v2.1.19),
     then Ready. Clean keeps its own state because it can finish during Ask. */
  /* Sections (v2.1.20): the seven cooking steps are grouped into four dots so the row stays
     calm on a phone: Prep (Read + Clean + the fact ledger), Ask, Write, and Finish (Polish +
     Check, shown only when either runs). The step inside a section shows on the detail line,
     and at Ready a time strip shows how long each part took. */
  var STEPS = ["read", "clean", "ask", "write", "polish", "check", "ready"];
  var GROUP = { read: "prep", clean: "prep", ask: "ask", write: "write", polish: "finish", check: "finish", ready: "done" };
  var GROUPS = ["prep", "ask", "write", "finish", "done"];
  function setSteps(track, active, skipAsk) {
    var at = GROUPS.indexOf(GROUP[active] || active), cs = prepStatus();
    Array.prototype.forEach.call(track.querySelectorAll(":scope > ol > li"), function (li) {
      var g = li.getAttribute("data-step"), i = GROUPS.indexOf(g);
      var cls = g === "ask" && skipAsk ? "skip" : i < at ? "done" : i === at ? "active" : "";
      if (g === "prep" && cs === "running") cls = "active";   /* Clean or the ledger can still be going during Ask */
      if (g === "finish") li.hidden = !(GROUP[active] === "finish" || (session && (session.polished || session.checked)));
      li.className = cls;
      if (cls === "active") li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    var strip = track.querySelector(".timestrip");
    if (strip && active !== "ready") strip.hidden = true;
  }
  /* Time strip at Ready: one bar split by how long each part took (Prep, Write, Polish,
     Check), with a small legend. Machine time only; your answering time isn't counted. */
  /* First-timers (v2.1.33): the time strip and Step by step stay out of the way for the first
     3 prompts on this phone, so the result is calmer. Run stats or dev tools always show it.
     Only a count is saved (stp-runs, capped at 3), never anything typed. The choice is made
     once per prompt, so a grade that lands later doesn't make it pop in. */
  var RUNS_KEY = "stp-runs", FIRST_RUNS = 3;
  function runsDone() { try { return Math.min(FIRST_RUNS, Number(localStorage.getItem(RUNS_KEY)) || 0); } catch (e) { return FIRST_RUNS; } }
  function countRun() { var n = runsDone(); if (n < FIRST_RUNS) { try { localStorage.setItem(RUNS_KEY, String(n + 1)); } catch (e) {} } }
  function stripAllowed() { return techOn() || core.dev || runsDone() >= FIRST_RUNS; }
  function showTimeStrip(track, parts, rows) {
    var strip = track.querySelector(".timestrip");
    if (!strip) return;
    if (session && session.stripOk == null) session.stripOk = stripAllowed();
    if (!(session ? session.stripOk : stripAllowed())) { strip.textContent = ""; strip.hidden = true; return; }
    parts = parts.filter(function (x) { return x[3]; });   /* every part that ran, even a quick one */
    var total = parts.reduce(function (a, x) { return a + x[1]; }, 0);
    strip.textContent = "";
    if (parts.length < 2 && !(rows && rows.length)) { strip.hidden = true; return; }
    total = total || parts.length;
    var bar = document.createElement("div"); bar.className = "tsbar";
    var legend = document.createElement("div"); legend.className = "tslegend";
    parts.forEach(function (x) {
      var seg = document.createElement("i"); seg.className = "ts-" + x[0];
      seg.style.flexGrow = String(Math.max(x[1] || 0, total * 0.04));
      seg.title = x[2] + " " + secsText(x[1]);
      bar.appendChild(seg);
      var item = document.createElement("span"); item.className = "ts-" + x[0];
      item.textContent = x[2] + " " + secsText(x[1]);
      legend.appendChild(item);
    });
    if (parts.length >= 2) { strip.appendChild(bar); strip.appendChild(legend); }
    if (rows && rows.length) strip.appendChild(breakdown(rows));
    strip.setAttribute("aria-label", "Time per part: " + parts.map(function (x) { return x[2] + " " + secsText(x[1]); }).join(", "));
    strip.hidden = false;
  }
  /* Step by step (v2.1.20): a closed details box under the strip with every step that ran,
     which kind of model did it, how long it took, and what happened. Model names only with
     run stats on, like everywhere else. Counts and labels only, never anyone's words. */
  function breakdown(rows) {
    var d = document.createElement("details"); d.className = "tsdetail";
    var sum = document.createElement("summary"); sum.textContent = "Step by step (" + rows.length + " steps)";
    d.appendChild(sum);
    var list = document.createElement("ol");
    rows.forEach(function (x) {
      var li = document.createElement("li"); li.className = "ts-row" + (x.skip ? " skipped" : "");
      var head = document.createElement("div"); head.className = "tsr-head";
      var name = document.createElement("b"); name.textContent = x.name;
      var time = document.createElement("span"); time.className = "tsr-time"; time.textContent = x.secs == null ? "" : secsText(x.secs);
      head.appendChild(name); head.appendChild(time);
      var who = document.createElement("small"); who.className = "tsr-who"; who.textContent = x.who + (x.model && techOn() ? " \u00b7 " + x.model.replace(/^gemini-/, "") : "") + (x.when ? " \u00b7 " + x.when : "");
      var what = document.createElement("span"); what.className = "tsr-what"; what.textContent = x.what;
      li.appendChild(head); li.appendChild(who); li.appendChild(what);
      list.appendChild(li);
    });
    d.appendChild(list);
    return d;
  }
  function secsText(s) { return s < 10 ? (Math.round(s * 10) / 10) + "s" : Math.round(s) + "s"; }
  /* Prep (the "clean" step on the tracker) is the clean step plus the fact ledger, side by side. */
  function prepStatus() {
    var c = session && session.clean ? session.clean.status : "", l = session && session.ledger ? session.ledger.status : "";
    if (!c && !l) return "";
    if (c === "running" || l === "running") return "running";
    if ((c || "skipped") === "skipped" && (l || "skipped") === "skipped") return "skipped";
    return "done";
  }
  function prepRunning() { return prepStatus() === "running"; }
  /* The clean step finished: tick it on whichever tracker is showing. */
  function refreshClean() {
    ["buildTrack", "resultTrack"].forEach(function (id) {
      var li = document.querySelector("#" + id + " li[data-step='prep']");
      /* Prep ticks done once Read is back and Clean and the ledger are finished. */
      if (!li || li.className !== "active" || prepRunning() || !session || session.intakeMs == null) return;
      li.className = "done"; li.removeAttribute("aria-current");
    });
  }

  /* offset: seconds already spent (Rework round 1), so elapsed shows the running total. */
  /* carry (v2.1.34): seconds already on the clock from Prep, so elapsed picks up where it was. */
  function startEstimate(bar, label, usual, step, skipAsk, offset, carry) {
    var track = bar.closest(".tracker");
    offset = offset || 0;
    carry = carry || 0;
    track.querySelector(".nums small").textContent = offset ? (session && session.round > 2 ? "total, all rounds" : "total, both rounds") : "elapsed";
    var elEl = track.querySelector(".el"), leftEl = track.querySelector(".left"), leftLbl = track.querySelector(".leftlbl"), right = track.querySelector(".right"), detail = track.querySelector(".detail");
    var t0 = Date.now(), tModel = Date.now(), model = "";
    setSteps(track, step, skipAsk);
    setProgress(bar, "pct", 2);
    cookStart(track.id === "buildTrack" ? "build" : "result", step === "write" ? "write" : "read", cookIngredients(step));
    function draw() {
      var secs = (Date.now() - t0) / 1000, since = (Date.now() - tModel) / 1000;
      var pct = Math.max(2, Math.min(95, Math.round(95 * (1 - Math.exp(-since / (usual * 0.6))))));
      setProgress(bar, "pct", pct);
      cook.pct = pct;
      var left = usual - since;
      elEl.textContent = clock(secs + offset + carry);
      var over = left <= 1;
      cook.over = over;
      right.classList.toggle("over", over);
      leftEl.textContent = over ? "Almost there" : clock(left);
      leftLbl.textContent = over ? "taking a bit longer than usual" : "estimated left";
      detail.textContent = label + (model && techOn() ? " · " + model : "");
      cookClock(track);
    }
    stopTicker();
    draw();
    ticker = setInterval(draw, 1000);
    var api = function (m) { model = m; tModel = Date.now(); draw(); };
    /* A new cooking step on the same clock (Polish, Check): elapsed keeps running, the
       estimate starts over for that step. */
    api.phase = function (lbl, secs, m) { label = lbl; usual = secs; model = m || ""; tModel = Date.now(); draw(); };
    return api;
  }
  /* Prompt cooking: plain labels for what went into the pot, never the words themselves. */
  function cookIngredients(step) {
    var list = ["Your thoughts"];
    if (step === "write" && session && session.round >= 2) list.push("Your edits");
    if (step === "write" && session && session.answers && session.answers.length) list.push("Your answers");
    if (context.active) list.push("Your context");
    if (core.active) list.push("Your core");
    if (step === "write" && lessons.list.length) list.push("Lessons learned");
    return list;
  }
  /* A model stalled or ran out and the next one took over: the pot boils over. */
  function cookSwitch() { if (cook.place && !cook.done) cook.switches++; }
  function finishTrack(bar, secs, skipAsk, offset) {
    var track = bar.closest(".tracker");
    secs += offset || 0;
    stopTicker();
    cook.done = true;
    setSteps(track, "ready", skipAsk);
    track.querySelectorAll(":scope > ol > li:not([hidden])").forEach(function (li) { if (li.className !== "skip") li.className = "done"; });
    setProgress(bar, "pct", 100);
    track.querySelector(".el").textContent = clock(secs);
    var right = track.querySelector(".right");
    right.classList.add("over");
    track.querySelector(".left").textContent = "Done";
    track.querySelector(".leftlbl").textContent = "";
    cookClock(track);
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
      shape: (function (sh) { sh = sh && typeof sh === "object" ? sh : {}; return { success: String(sh.success || "").trim().slice(0, 240), format: String(sh.format || "").trim().slice(0, 240) }; })(data.shape),
      memUse: Array.isArray(data.use_memory) ? data.use_memory : [],
      memRemember: (Array.isArray(data.remember) ? data.remember : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean).slice(0, 2),
      /* Save as context (#50): background worth keeping, spotted by this same call. */
      candidate: (function (c) { return c && typeof c === "object" && String(c.title || "").trim() ? { title: String(c.title), why: String(c.why || "") } : null; })(data.context_candidate),
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

  /* My context budget: past 1,500 tokens, one Flash-Lite call (Gemma as backup, v2.1.22)
     makes the picks shorter for this build. Kept in memory only for these exact picks;
     if it fails or doesn't come out shorter, the full pieces are used. Not retried after that. */
  function squeezeContext(onModel) {
    if (!context.over) return Promise.resolve();
    var sig = context.sig, before = context.rawTokens;
    setBusy(true, "Squeezing your context to fit...");
    return askGemini(SQUEEZE + "\n\"\"\"\n" + context.body + "\n\"\"\"", false, route("squeeze"), "auto", onModel, 45000).then(function (r) {
      var text = cleanPrompt(r.text);
      if (context.sig !== sig) return;
      var after = blockTokens(text);
      if (!text || after >= before) { if (session) session.squeeze = "no gain"; return; }
      context.squeeze = { sig: sig, text: text, before: before, after: after };
      if (session) session.squeeze = before + " to " + after;
    }, function () { if (session) session.squeeze = "failed"; }).then(function () { setBusy(true, "Reading your thoughts..."); });
  }

  /* Prep crew (v2.1.18, backlog #42): while one Flash-Lite model reads the thoughts and
     picks questions, the other Flash-Lite model cleans them (filler, false starts, repeats
     out; every fact, number, and hedge kept). Flash then writes from the clean version.
     A phone check (free) keeps the raw words instead if the clean version lost a number or
     came out much shorter or longer. Short notes (under 20 words) skip it. Never Flash, so
     it never spends the small Flash allowance. Memory only. */
  var CLEAN_MIN_WORDS = 20, CLEAN_LIMIT = 15000;
  function cleanOk(raw, text) {
    if (!text) return "empty";
    var a = words(raw), b = words(text);
    if (b < a * 0.35) return "too short";
    if (b > a * 1.25 + 5) return "too long";
    var have = text.replace(/,(?=\d{3}\b)/g, "");
    var lost = (raw.replace(/,(?=\d{3}\b)/g, "").match(/\d+(?:[.:/]\d+)*/g) || []).filter(function (n) { return have.indexOf(n) === -1; });
    return lost.length ? "lost a number" : "";
  }
  /* The Flash-Lite crew: each job starts on a different Flash-Lite model when the key has
     more than one (Read on the 1st, Clean on the 2nd, the ledger on the 3rd or back to the
     1st), and falls back to the others. */
  function liteCrew(i) {
    var l = gemini.plan.intake.filter(function (m) { return /lite/.test(m); });
    if (!l.length) return [];
    var k = i % l.length;
    return l.slice(k).concat(l.slice(0, k));
  }
  /* Words that carry meaning, cut to 5 letters so "budgets" matches "budget". */
  var LEDGER_STOP = /^(that|this|with|from|have|want|need|about|around|maybe|they|their|them|then|just|like|some|into|your|will|would|should|could|really|very|also|what|when|make|sure|think|probably|thing|things|there|here|been|were|each)$/;
  function keyWords(t) { return (String(t).toLowerCase().match(/[a-z][a-z']{3,}/g) || []).filter(function (w) { return !LEDGER_STOP.test(w); }).map(function (w) { return w.slice(0, 5); }); }
  function numsIn(t) { return String(t).replace(/,(?=\d{3}\b)/g, "").match(/\d+(?:[.:/]\d+)*/g) || []; }
  /* Is this item in that text? Every number in it, and at least `need` of its meaning words. */
  function hasItem(item, text, need) {
    var low = String(text).toLowerCase().replace(/,(?=\d{3}\b)/g, "");
    if (numsIn(item).some(function (n) { return low.indexOf(n) === -1; })) return false;
    var kw = keyWords(item);
    if (!kw.length) return true;
    return kw.filter(function (w) { return low.indexOf(w) !== -1; }).length / kw.length >= need;
  }
  var LEDGER_LIMIT = 15000, LEDGER_RACE_MS = 10000;   /* Flash-Lite lists the facts (Gemma dropped, v2.1.25); a second Flash-Lite joins if it takes over 10s */
  function startLedger(raw) {
    var order = route("ledger"), mine = session, t0 = Date.now(), timer;
    if (words(raw) < CLEAN_MIN_WORDS || !order.length) { mine.ledger = { status: "skipped" }; return Promise.resolve(); }
    mine.ledger = { status: "running" };
    return Promise.race([
      askGemini(LEDGER + "\n" + raw + '\n"""', false, order, "auto", null, LEDGER_LIMIT, LEDGER_RACE_MS).then(function (r) {
        var seen = {}, all = cleanPrompt(r.text).split("\n").map(function (l) { return l.replace(/^\s*[-*\u2022\d.)]+\s*/, "").trim(); }).filter(function (l) { return l && words(l) <= 16; });
        /* The phone keeps only items the raw words back up (every number, most of the meaning). */
        var items = all.filter(function (l) { var k = l.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return hasItem(l, raw, 0.5) && !strictAddsVs(l, raw).length; }).slice(0, 12);
        mine.ledger = { status: items.length ? "ok" : "empty", items: items, dropped: all.length - items.length, model: r.model, ms: r.ms, history: r.history || [] };
      }, function () { mine.ledger = { status: "failed", ms: Date.now() - t0 }; }),
      new Promise(function (res) { timer = setTimeout(function () { if (mine.ledger.status === "running") mine.ledger = { status: "failed", why: "slow" }; res(); }, LEDGER_LIMIT + 2000); })
    ]).then(function () { clearTimeout(timer); if (session === mine) refreshClean(); });
  }
  /* Coverage check (free): which ledger items the prompt is missing. */
  function missingFacts(prompt) {
    var items = session && session.ledger && session.ledger.items || [];
    return items.filter(function (it) { return !hasItem(it, prompt, 0.5); });
  }
  /* The phone's checks plus the ledger: what Polish gets asked to fix. */
  function fullCheck(prompt) {
    var c = qualityCheck(prompt), miss = missingFacts(prompt);
    var extra = miss.filter(function (m) { return !c.dropped.some(function (d) { return hasItem(m, d, 0.6); }); });
    c.facts = extra;
    c.score += extra.length;
    return c;
  }
  function startClean(raw) {
    var lites = liteCrew(0);
    if (words(raw) < CLEAN_MIN_WORDS || !lites.length) { session.clean = { status: "skipped" }; return Promise.resolve(); }
    var order = liteCrew(1), mine = session, t0 = Date.now();
    mine.clean = { status: "running" };
    var timer;
    return Promise.race([
      askGemini(CLEAN + "\n" + raw + '\n"""', false, order, "auto", null, CLEAN_LIMIT).then(function (r) {
        var text = cleanPrompt(r.text), why = cleanOk(raw, text);
        mine.clean = why ? { status: "kept raw", why: why, model: r.model, ms: r.ms } : { status: "ok", text: text, model: r.model, ms: r.ms, words: words(text) };
      }, function () { mine.clean = { status: "failed", ms: Date.now() - t0 }; }),
      new Promise(function (res) { timer = setTimeout(function () { if (mine.clean.status === "running") mine.clean = { status: "failed", why: "slow", ms: Date.now() - t0 }; res(); }, CLEAN_LIMIT + 2000); })
    ]).then(function () { clearTimeout(timer); if (session === mine) refreshClean(); });
  }

  function geminiFlow(raw, key) {
    session = { raw: raw, known: knownText(), forceAsk: forceAsk };
    forceAsk = false;
    result.hidden = true;
    setBusy(true, "Reading your thoughts...");
    buildStatus.textContent = "";
    session.estIntake = intakeEstimate();
    /* Switch to Quick (v2.1.34): offered from the moment Build is tapped in Normal, so a person in
       a rush can skip the questions on the fly. The clock keeps going from here (session.t0). */
    session.t0 = Date.now();
    ui.goQuick = false;
    ui.reading = currentMode() !== "quick";
    ui.build = "read"; ui.switched = false; ui.slow = null; ui.quickOn = currentMode() === "quick";   /* #51: the chip stays from here to Ready */
    savectx.newBuild();   /* #50: last build's Save as context offer never carries over */
    var onIntakeModel = startEstimate(document.getElementById("buildProg"), "Reading your thoughts", session.estIntake, "read", false);
    snapTo(document.getElementById("buildTrack"));
    var base = core.dev ? withStackHint(ANALYZE, STACK) : ANALYZE;
    if (memory.active) base = withMemory(base, memory.numbered());   /* memory */
    base = withCandidate(base);   /* #50: the same Read call also spots background worth saving, no extra call */
    memory.suggestions = [];
    var intakeText = "";
    ensureModel(key).then(function () {
      return squeezeContext(onIntakeModel);
    }).then(function () {
      /* My context goes in after any squeeze, so the question step sees the same version the writer will. */
      intakeText = (context.active ? withContext(base, context.block) : base) + "\n" + raw + '\n"""';
      session.cleanP = Promise.all([startClean(raw), startLedger(raw)]);
      setSteps(document.getElementById("buildTrack"), "read", false);
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
      session.shape = intake.shape;
      if (session.note && !session.note.transcript && session.cleanP) session.cleanP.then(function () { if (session && session.note && !session.note.transcript && session.clean && session.clean.text) session.note.transcript = session.clean.text; });
      /* memory: only the facts the intake picked go into writing the prompt. */
      session.memFacts = memory.active ? memory.pick(intake.memUse) : [];
      session.memRemember = memory.active ? intake.memRemember : [];
      session.complexity = intake.complexity;
      session.category = intake.category;
      session.need = intake.need;
      savectx.setCandidate(intake.candidate);   /* #50: the nudge shows under the tracker while it writes, or under the result */
      session.readSecs = (Date.now() - session.t0) / 1000;   /* the Write clock picks up from here */
      setBusy(false);
      ui.build = "";
      var mode = currentMode();
      if (mode === "quick" || session.goQuick) { session.mode = "Quick mode"; if (session.goQuick) session.switchedQuick = "during Prep"; setBuild(""); return writeFinal([], true); }
      if (!intake.questions.length) { session.mode = "Full (no questions)"; setBuild(""); return writeFinal([]); }
      /* AGT-14 (v2.1.31): a note that already has everything skips the questions. */
      if (strongNote(raw, intake)) {
        session.skippedIntake = intake; session.strongSkip = true;
        session.questions = [];
        session.mode = "Full (strong note)"; setBuild(""); return writeFinal([]);
      }
      setBuild("");
      renderQuestions(intake);
    }).catch(function (e) {
      setBusy(false);
      setBuild("");
      cookStop();
      ui.build = "";
      signal("gemini-failed", "Before questions");
      showQuick(raw, "Gemini wasn't available, so this is the quick version. " + (e && e.message ? e.message : ""));
      failNotice(e);
      session.mode = "Intake";
      session.intakeError = e && e.message ? e.message : "unknown";
      logRun({ outcome: "intake failed: " + (e && e.message ? e.message : "unknown") });
    });
  }

  /* Strong note, no questions (AGT-14, v2.1.31, SPEC 11/07): Ghost Coach finds all 5 parts on
     the phone (goal, who it's for, details, limits, what good looks like), and Read asked for
     at most 2 questions on a request that isn't complex. Then the questions Read picked are
     kept, not asked, and the prompt is written right away. Ask me anyway brings them back,
     no new Read. Free: a phone check on top of the Read that already ran. */
  var STRONG_MAX_QS = 2;
  function strongNote(raw, intake) {
    if (!intake || !intake.questions || !intake.questions.length) return false;
    if (session.forceAsk || session.round >= 2 || intake.complexity === "complex" || intake.questions.length > STRONG_MAX_QS) return false;
    return assess(raw).score === 5;
  }
  function askAnyway() {
    var intake = session && session.skippedIntake;
    if (!intake || busy) return;
    session.strongSkip = false; session.skippedIntake = null;
    session.mode = "Full (asked anyway)";
    session.questions = addStackChoice(intake.questions);
    notify("result");
    result.hidden = true;
    renderQuestions(intake);
  }

  /* Switch to Quick (Kevin, Test lab 11/08: "always present from the start, in case they're in
     a rush"). While Read runs it marks this build to skip the questions and write the quick
     version the moment Read is back; on the questions it writes the quick version now. Either
     way the clock picks up where it was, never from 0. This build only: the saved Quick or
     Normal setting doesn't change. */
  function goQuick() {
    if (!session) return;
    if (ui.reading) { if (session.round >= 2) return; session.goQuick = true; ui.goQuick = true; return; }
    if (!qa.hidden && !busy) { session.switchedQuick = "on the questions"; chat.finish(true); return; }
    /* #51 (v2.1.37): during Write, the chip stops the Flash race and the quick model writes from
       your words and any answers so far. Still waiting on the cleanup: it writes quick when that ends. */
    if (ui.build !== "write" || ui.quickOn || ui.switched) return;
    if (session.waitingClean) { session.quickAfterClean = true; ui.switched = true; return; }
    /* #53: waiting on the shortcut, the chip calls it off and the quick model writes now. */
    if (scWait) { scStop(); notify("result"); session.slowSwitch = "tapped while waiting on the shortcut"; ui.switched = true; setBusy(false); writeFinal(session.answers, true); return; }
    slowQuick(false);
  }

  /* Save as context (#50, v2.1.37): opens the guided interview (SaveContext.svelte) from the nudge
     or from the result's ⋯. It starts from the words of this prompt (your note and your answers),
     held in memory only. Its Flash-Lite calls go through here so they use the same key, model
     plan, and usage count as everything else; with no key it asks its five fixed questions. */
  function saveAsContext(from) {
    var s = session, said = s ? s.raw : thoughts.value.trim();
    var ans = (s && s.answers || []).filter(function (a) { return a.answer && !a.tapped; }).map(function (a) { return a.question + " " + a.answer; });
    var title = savectx.candidate ? savectx.candidate.title : "";
    savectx.start(from, title, [said].concat(ans).filter(Boolean).join("\n"));
  }
  savectx.hasResult = function () { return !result.hidden; };
  /* Run stats: the run record waits for what you do next, so a tap or a save after Ready still makes it in. */
  savectx.onStat = function (v) { if (pendingRun) pendingRun.ctx_nudge = v; };
  savectx.asker = function () {
    var key = gemini.key || gkey.value.trim();
    if (!key) return null;
    return function (text, asJson) {
      return ensureModel(key).then(function () {
        var lites = route("squeeze");
        return askGemini(text, asJson, lites.length ? lites : gemini.plan.intake, "auto", null, 30000);
      }).then(function (r) { return r.text; });
    };
  };

  /* The questions are a chat now (ChatBuilder.svelte + chat.svelte.js). */
  function renderQuestions(intake) {
    chat.start(intake, "Your prompt: " + planText(intake.complexity, gemini.plan.write[0]));
    qaStatus.textContent = "";
    qa.hidden = false;
    qa.scrollIntoView({ behavior: "smooth", block: "start" });
    doneAway("questions");
  }
  chat.onFinish = function (answers, quick) { if (busy || !session) return; if (guide) guidedBuild(answers, quick); else writeFinal(answers, quick); };

  /* Everything the writer reads: rules, lessons, raw thoughts, answers, context, core, memory. */
  /* bare (Flow bench): leave out My context, your core, and memory, so only the flow differs. */
  function writerText(bare) {
    var lines = session.answers.map(function (a) { return "Q: " + a.question + "\nA: " + a.answer + (a.tapped ? " (tapped from suggested options)" : ""); });
    /* Prep crew: the clean step's version (filler out, every detail kept) when it passed the phone check. */
    var cleaned = session.clean && session.clean.status === "ok" ? session.clean.text : "";
    var text = withToday(withLessons(WRITE, lessons.list), session.today) + (cleaned ? "\n\nThe raw thoughts below were lightly cleaned by an earlier step: filler, false starts, and repeats removed, every detail kept." : "") + "\n\nRAW THOUGHTS:\n\"\"\"\n" + (cleaned || session.raw) + "\n\"\"\"\n\nANSWERS TO FOLLOW-UP QUESTIONS:\n" + (lines.length ? lines.join("\n\n") : "None given.");
    text += goalText(session.goal);
    /* core: the person's standing profile shapes the prompt; it is never attached to it. */
    /* My context is not attached to the prompt: the writer works in only what this request needs. */
    /* Fact ledger (#44): what this prompt must keep, listed by Flash-Lite from the raw words. */
    var items = session.ledger && session.ledger.items || [];
    if (items.length) text += "\n\nMUST-KEEP CHECKLIST (listed from the raw thoughts by an earlier step; it adds nothing new. Every item has to be in the prompt, written cleanly in your own sentences where it fits, never pasted as a raw line):\n- " + items.join("\n- ");
    /* Success + format up front (#46): the intake's suggestions, a default only. */
    var sh0 = session.shape || {}, sh = { success: sh0.success && !strictAdds(sh0.success).length ? sh0.success : "", format: sh0.format };
    if (sh.success || sh.format) text += "\n\nSUGGESTED SHAPE (suggested by an earlier step, not the person's words. Use it only where they didn't say otherwise; their own words always win. It never makes a preference stronger and never adds safety, health, or strictness rules):" + (sh.success ? "\nA great result: " + sh.success : "") + (sh.format ? "\nFormat and length: " + sh.format : "");
    if (bare) return text;
    if (context.active) text += "\n\nCONTEXT THE PERSON PICKED FOR THIS REQUEST (it is NOT attached to the prompt, so the prompt has to stand on its own. Work in only the facts from it that this request needs, in plain words, where they fit. Leave out anything that doesn't matter here, never paste it in as a block, and never point to it by its title):\n" + context.block;
    if (core.active) text += "\n\nTHE PERSON'S CORE (their standing context. It is NOT attached to the prompt, so the prompt has to stand on its own. Use it to shape the prompt: who they are, how they like answers, how the AI should work with them, and the AI's role, wherever it fits this request, in plain words. Never paste it in as a block, never list it back, and never mention \"my core\"):\n" + core.block;
    if (session.reworkText) text += "\n\nROUND " + session.round + ": THE PERSON REWORKED THE PROMPT FROM ROUND " + (session.reworkOf || 1) + ". Their edited version is below, with what was weak noted at the top. Start from it: keep what works and every change they made, fix what was weak, and follow every rule above. The raw thoughts and answers above stay the source of truth for facts. Never copy the \"What was weak\" line into the prompt.\nEDITED PROMPT:\n\"\"\"\n" + session.reworkText + "\n\"\"\"";
    if (session.memFacts && session.memFacts.length) text += "\n\nBACKGROUND THE PERSON SAVED ABOUT THEMSELVES (it matters for this request; work it in where it helps, in their voice, and don't list it back as a block):\n- " + session.memFacts.join("\n- ");   /* memory */
    return text;
  }
  /* #35 widened, SPEC LOCKED 10/29 (B, default is wait): when no Flash model can write a
     Normal or Rework prompt, the page says so and waits for one on its own, about as long
     as the soonest one is resting (at least a minute), then writes. One tap uses the quick
     model now instead. If Flash is used up for the day, it only offers the quick model.
     Memory only; leaving, New prompt, or Back to round N stops the wait.
     v2.1.15 fix (11/04): the wait never goes past 3 minutes a round. If no Flash model is
     free by then, the quick model writes it on its own. Waiting longer felt unbearable. */
  var FLASH_WAIT_MAX = 3 * 60000;
  /* SPEC LOCKED 11/04 (timing): each Flash writer gets 30 seconds on its own, then the next
     one joins the race (first good prompt wins), so 3 Flash models are all working by 1:00.
     At 2:00 (the make or break point) a note offers Switch to quick with a live countdown;
     at 3:00 the quick model takes over on its own. The countdown stays because it's a promise
     ("you'll have a prompt by 3:00"), not a threat, and it matches the busy-Flash note. */
  var ROTATE_MS = 30000;
  var SLOW_OFFER_MS = 2 * 60000;
  var TIME_SCALE = 1;   /* staging #slowtest: 10x faster (3s, 12s, 18s) to try it without a slow day */
  var CYCLE_PAUSE = 20000;
  var POLISH_SECS = 5, CHECK_SECS = 8, CHECK_MAX = window.__checkMaxMs || 30000;   /* usual Polish and Check times; the prompt never waits past CHECK_MAX for the check */
  var STANDIN_SECS = 5, STANDIN_MAX = 8000, STANDIN_MIN_WORDS = 60, STANDIN_FILL_MS = 5000;   /* flow bench run 2: long notes hit the cap 3 of 3 times mid-fill, so the fill only starts with 5s left */   /* flow bench run 1: 13s for no gaps on short notes, so long notes only, 8s cap */

  /* Stand-in AI test (v2.1.20, #45), the first part of Check on Normal and Rework prompts:
     a Flash-Lite model plays the AI that will receive the prompt and lists what it would
     still have to ask or guess. Another Flash-Lite model fills only the gaps the person
     already answered (the phone keeps it only if every line stayed and no new numbers came
     in). Up to 2 rounds; it stops at no gaps or nothing filled. Gaps nobody answered are
     shown to the person. Targeted lines, never a rewrite. */
  function parseGaps(text) {
    try {
      var t = String(text).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
      var d = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
      return (Array.isArray(d.gaps) ? d.gaps : []).map(function (g) { return String((g && g.question) || (typeof g === "string" ? g : "")).trim(); }).filter(Boolean).slice(0, 4);
    } catch (e) { return null; }
  }
  function standIn(prompt) {
    var t0 = Date.now(), cur = prompt, timer;
    var st = { prompt: "", gaps: 0, added: 0, open: [], rounds: 0, status: "failed" };
    function lines(t) { return t.split("\n").filter(function (l) { return l.trim(); }).length; }
    function round() {
      st.rounds++;
      return askGemini(STANDIN + "\n" + cur + '\n"""', true, liteCrew(1), "low", null, 7000).then(function (r) {
        if (!st.model) st.model = r.model;
        var gaps = parseGaps(r.text);
        if (gaps === null) { st.status = st.added ? "added " + st.added : "failed"; return; }
        if (st.rounds === 1) st.gaps = gaps.length;
        if (!gaps.length) { st.open = []; st.status = st.added ? "added " + st.added : "no gaps"; return; }
        st.open = gaps;   /* found gaps count even if the fill runs out of time */
        if (Date.now() - t0 > STANDIN_MAX * TIME_SCALE - STANDIN_FILL_MS * TIME_SCALE) { st.status = st.added ? "added " + st.added : "gaps only"; return; }   /* no time to fill: skip the call */
        return askGemini(gapFillPrompt(cur, gaps, session.raw, withMem(session.answers)), false, liteCrew(0), "low", null, 15000).then(function (r2) {
          var fixed = cleanPrompt(r2.text);
          if (!fixed || fixed === cur || !onlyAdded(fixed, cur, gaps.length)) { st.open = gaps; st.status = st.added ? "added " + st.added : "kept"; return; }
          st.added += Math.max(1, lines(fixed) - lines(cur));
          cur = fixed; st.prompt = cur; st.open = [];
          if (st.rounds < 2) return round();
          st.open = []; st.status = "added " + st.added;
        }, function () { st.open = gaps; st.status = st.added ? "added " + st.added : "failed"; });
      });
    }
    return Promise.race([
      round().catch(function () {}),
      new Promise(function (res) { timer = setTimeout(function () { if (!st.added && st.status === "failed") st.status = st.open.length ? "gaps only" : "slow"; res(); }, STANDIN_MAX * TIME_SCALE); })
    ]).then(function () {
      clearTimeout(timer);
      var out = { model: st.model || "", prompt: st.prompt, gaps: st.gaps, added: st.added, open: st.open.slice(), rounds: st.rounds, status: st.status, secs: Math.round((Date.now() - t0) / 100) / 10 };
      if (out.status === "failed" && out.added) out.status = "added " + out.added;
      return out;
    });
  }
  function showGapNote(st) {
    var el = document.getElementById("gapNote");
    if (!st || (!st.added && !st.open.length)) { el.hidden = true; el.textContent = ""; return; }
    /* Test lab 11/05: plain words, split into short lines (heading, what it is, what happened);
       an open question shows once, in its answer box, not repeated here. */
    var lines = ['<strong class="gaphead">\ud83e\udd16 Test run</strong>', '<span class="gapsub">A stand-in AI read your prompt the way your AI will.</span>'];
    if (st.added) lines.push('<span class="gapres">\u2705 Added ' + (st.added === 1 ? "one thing" : st.added + " things") + ' you had already said.</span>');
    lines.push(st.open.length ? '<span class="gapres">Your AI may still ask ' + (st.open.slice(0, 2).length === 1 ? "this" : "these") + ':</span><span class="gapsub">Answer to add it to your prompt, or skip.</span>' : '<span class="gapres">\u2705 Your AI can start right away.</span>');
    el.innerHTML = lines.join("");
    el.hidden = false;
    showGapAsk(st.open.slice(0, 2));
  }
  /* #48, SPEC LOCKED 11/05 (A, AI fits it in; no re-check after): each open stand-in question
     gets an answer box. Add to prompt puts the answer with the follow-up answers (so its
     numbers count as yours) and runs one Flash-Lite gap fill that may only add lines and has to
     include the answer. If that fails or adds anything else, the phone adds a plain line, so
     the answer is never lost. Skip costs nothing. Cheaper than rebuilding: 1 small call vs 4. */
  var gapBusy = false;
  function showGapAsk(qs) {
    var box = document.getElementById("gapAsk");
    box.innerHTML = (qs || []).map(function (q, i) {
      return '<div class="gaprow" data-q="' + esc(q) + '"><label for="gapIn' + i + '">' + esc(q) + '</label>' +
        '<div class="gapline"><input type="text" id="gapIn' + i + '" class="gapin" placeholder="Your answer" autocomplete="off" enterkeyhint="done">' +
        '<button type="button" class="gapadd" disabled>Add to prompt</button><button type="button" class="gapskip linkish">Skip</button></div>' +
        '<small class="gapmsg" role="status"></small></div>';
    }).join("");
    box.hidden = !(qs && qs.length);
  }
  function gapPlainLine(cur, q, a) {
    var line = String(q).trim() + " " + String(a).trim().replace(/[.\s]+$/, "") + ".";
    var lines = cur.split("\n"), last = lines.length - 1;
    while (last > 0 && !lines[last].trim()) last--;
    if (/start right away|ask at most one/i.test(lines[last] || "")) lines.splice(last, 0, line, ""); else lines.push("", line);
    return lines.join("\n");
  }
  function gapSetPrompt(text) {
    if (!session) return;
    session.basePrompt = text;
    output.value = extras(text);
    xray.set({ prompt: output.value, raw: session.raw, answers: withMem(session.answers), core: extraBlock(), known: sessionKnown() });
    showNumberCheck(text);
  }
  function gapAdd(row) {
    var input = row.querySelector(".gapin"), q = row.getAttribute("data-q"), a = input.value.trim();
    if (!a || !session || gapBusy) return;
    var addBtn = row.querySelector(".gapadd"), msg = row.querySelector(".gapmsg"), mine = session, cur = output.value;
    gapBusy = true;
    input.disabled = true; addBtn.disabled = true; row.querySelector(".gapskip").disabled = true;
    addBtn.textContent = "Adding...";
    session.answers = (session.answers || []).concat([{ question: q, answer: a }]);
    askGemini(gapFillPrompt(cur, [q], session.raw, withMem(session.answers)), false, liteCrew(0), "low", null, 15000).then(function (r) {
      var fixed = cleanPrompt(r.text);
      return fixed && fixed !== cur && onlyAdded(fixed, cur, 1) && hasItem(a, fixed, 0.5) ? fixed : "";
    }, function () { return ""; }).then(function (fixed) {
      gapBusy = false;
      if (session !== mine || output.value !== cur) return;   /* they moved on or edited it: leave it alone */
      var fit = !!fixed;
      gapSetPrompt(fit ? fixed : gapPlainLine(cur, q, a));
      row.classList.add("done");
      row.innerHTML = "";
      var done = document.createElement("small"), head = document.createElement("strong"), said = document.createElement("span");
      done.setAttribute("role", "status");
      head.textContent = "\u2705 Added to your prompt" + (fit ? "" : " as its own line");
      said.className = "gapsaid"; said.textContent = a;
      done.appendChild(head); done.appendChild(said);
      row.appendChild(done);
      if (pendingRun) pendingRun.standin_answered = (pendingRun.standin_answered || 0) + 1;
    });
  }
  (function () {
    var box = document.getElementById("gapAsk");
    box.addEventListener("input", function (e) {
      var row = e.target.closest(".gaprow"); if (!row || !e.target.classList.contains("gapin")) return;
      row.querySelector(".gapadd").disabled = !e.target.value.trim() || gapBusy;
    });
    box.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !e.target.classList.contains("gapin")) return;
      e.preventDefault(); gapAdd(e.target.closest(".gaprow"));
    });
    box.addEventListener("click", function (e) {
      var row = e.target.closest(".gaprow"); if (!row) return;
      if (e.target.classList.contains("gapadd")) gapAdd(row);
      else if (e.target.classList.contains("gapskip")) { row.hidden = true; if (!box.querySelector(".gaprow:not([hidden])")) box.hidden = true; }
    });
  })();   /* every Flash said busy: wait this long, then go around again */
  var flashWait = null;
  function flashBusy(e) { var s = e && e.status; return s === 429 || s === 500 || s === 503 || s === 404 || s === "timeout" || s === "empty"; }
  function stopFlashWait() { if (flashWait) { clearInterval(flashWait.tick); clearTimeout(flashWait.timer); flashWait = null; } }
  /* Slow write (11/04): a Flash write still going at 2:00 gets the Switch to quick note,
     and at 3:00 the quick model takes over by itself. The 3 minutes count from the first
     Write tap of this round (at least 20 seconds more for a write that starts late). Memory only. */
  var slowWrite = null;
  function stopSlowWrite() { if (slowWrite) { clearInterval(slowWrite.tick); clearTimeout(slowWrite.offer); clearTimeout(slowWrite.auto); slowWrite = null; } ui.slow = null; }
  function watchSlowWrite(run, handle) {
    stopSlowWrite();
    var key = session.round || 1, now = Date.now();
    if (!session.writeStart || session.writeStart.round !== key) session.writeStart = { round: key, at: now };
    var cap = FLASH_WAIT_MAX * TIME_SCALE;
    var autoAt = Math.max(now + 20000 * TIME_SCALE, session.writeStart.at + cap);
    var offerAt = Math.max(now, autoAt - (cap - SLOW_OFFER_MS * TIME_SCALE));
    slowWrite = {
      run: run, handle: handle, autoAt: autoAt,
      tick: setInterval(function () { if (run !== writeRun) stopSlowWrite(); }, 1000),
      offer: setTimeout(function () {
        if (!slowWrite || run !== writeRun || !busy) return;
        slowWrite.offered = true;
        /* #51 (SPEC 11/08, round 5): the note says why, and its countdown joins the one steady
           ⚡ Quick version chip under the tracker instead of bringing a second button. */
        ui.slow = { until: autoAt, total: autoAt - Date.now() };
        notify("result", "info", "Taking longer than usual",
          "Flash is still writing and may finish any second. If it isn't done when the countdown on \u26a1 Quick version hits 0:00, the quick model takes over, so you'll have a prompt by then. Or tap it now: faster, but not as strong.");
      }, offerAt - now),
      auto: setTimeout(function () { slowQuick(true); }, autoAt - now)
    };
  }
  /* Tap (or 3:00): stop the Flash write and let the quick model write it. If Flash just
     finished, it's too late to stop, so its prompt shows instead. */
  function slowQuick(auto) {
    var s = slowWrite;
    if (!s || s.run !== writeRun || !session) return;
    if (!s.handle.stop || !s.handle.stop()) return;
    var early = !auto && !s.offered;   /* #51: tapped the chip before the 2:00 note */
    stopSlowWrite();
    notify("result");
    session.autoQuick = !!auto;
    session.slowSwitch = auto ? "auto at 3:00" : early ? "tapped early" : "tapped";
    if (!auto) ui.switched = true;
    logRun({ outcome: auto ? "flash slow 3 min, quick model wrote it" : early ? "switched to quick during write" : "flash slow, switched to quick", round: session.round || null });
    setBusy(false);
    writeFinal(session.answers, true);
  }

  /* Only one case left (v2.1.18): every Flash model is used up for today. Busy Flash keeps
     cycling until Switch to quick or 3:00, so there is no busy wait any more. */
  function askFlashWait(why) {
    stopFlashWait();
    stopTicker();
    cookStop();
    setProgress(document.getElementById("resultProg"), "off");
    setBusy(false);
    setBuild("");
    ui.build = "";
    qaStatus.textContent = "";
    session.flashAsked = (session.flashAsked || 0) + 1;
    logRun({ outcome: "flash used up, asked: " + why, round: session.round || null });
    document.getElementById("resultHead").textContent = "Flash is used up for today";
    return notify("result", "warn", "Today's Flash limit is used up", "Flash comes back around 3 AM Eastern. The quick model can write it now: faster, but not as strong.", [{ label: "Use quick model now", act: "flashquick" }]);
  }
  function flashUsedUp() { return fullWriters().every(function (m) { var r = restInfo(m); return r && r.why === "day"; }); }
  /* Flash said busy every time until it ran out of models (cycling stops only when a model
     is used up for the day, so this is rare): the quick model writes it, with a note. */
  function quickAfterBusy() {
    session.autoQuick = true;
    logRun({ outcome: "flash busy, quick model wrote it", round: session.round || null });
    notify("result");
    writeFinal(session.answers, true);
  }
  /* Shortcut stand-in for the Flash write (#53, v2.1.40, dev tools only, SPEC LOCKED 11/11).
     Busy hours make Flash unreliable, so with Write with set to Shortcut (More options, dev
     tools) the full write is handed to the Apple Shortcut "STP Flash Backup", which runs
     Apple's Use Model (Cloud or On-Device) on an iPhone, iPad, or Mac:
       1. A card offers one tap: it copies the job for the shortcut (scText) and opens
          shortcuts://run-shortcut with the address to come back to as the shortcut's input.
          That address ends in #stpback=cloud., #stpback=cloudpro. or #stpback=ondevice., which is also how
          the shortcut knows which model to use. What gets copied is the short writer text
          (scText, v2.1.41), since Apple's models dropped details under the full one.
       2. The shortcut opens that address with the prompt after it (the part after # never
          leaves the device). Over 8,000 characters it copies the prompt instead and sends the
          word STP-CLIPBOARD, and the card asks for one Paste tap.
       3. The answer goes through the same Polish and Check as a Flash answer. Run stats tag
          the writer as shortcut-cloud or shortcut-on-device, so grades can be compared.
     Nothing switches models on its own: the card always has Run shortcut again, Try the other
     model, and Use Flash instead, and your words and answers stay put.
     Safari often reuses the open tab (hashchange); when the shortcut opens a new tab instead,
     the build is picked up there from a copy kept on this device (localStorage "stp-sc-wait":
     this build's session, your words included). That copy exists only while a build waits on
     the shortcut, and is deleted when the result is back, on Use Flash instead, on New prompt,
     and after 30 minutes. Dev tools only; everyone else never writes it. */
  var SC_NAME = "STP Flash Backup", SC_KEY = "stp-sc-wait", SC_MAX_MS = 30 * 60000, SC_MIN_WORDS = 8, SC_LONG = "STP-CLIPBOARD";
  var scWait = null;   /* the write waiting on the shortcut: { run, text, model, t0, sent, swaps, resolve, reject } */
  var scBack = null;   /* a result that arrived in a tab the shortcut opened: { model, text, long, t0 } */
  var scLeaving = 0;   /* when the shortcut was last opened, so the leave warning stays quiet for it */
  /* Three Apple models (Cloud Pro added in v2.1.41): the name in the saved setting, the word the
     shortcut matches in its input, the label on screen, and the tag in run stats. */
  var SC_MODELS = { cloud: { slug: "cloud", label: "Cloud", tag: "shortcut-cloud" }, pro: { slug: "cloudpro", label: "Cloud Pro", tag: "shortcut-cloud-pro" }, device: { slug: "ondevice", label: "On-Device", tag: "shortcut-on-device" } };
  function scModel() { return core.dev && SC_MODELS[core.writer] ? core.writer : ""; }
  function scLabel(m) { return (SC_MODELS[m] || SC_MODELS.cloud).label; }
  function scOf(tagOrSlug) { for (var k in SC_MODELS) if (SC_MODELS[k].tag === tagOrSlug || SC_MODELS[k].slug === tagOrSlug) return k; return "cloud"; }
  /* What the shortcut's model reads (v2.1.41): the short rules, not the full WRITE text. Apple's
     models dropped details under the long one. Everything else Flash gets rides along in a
     compact form: lessons, your core, the memory facts Read picked, and picked My context. */
  function scText() {
    var cleaned = session.clean && session.clean.status === "ok" ? session.clean.text : "";
    var sh0 = session.shape || {};
    return shortWriteText({ raw: cleaned || session.raw, answers: session.answers, goal: session.goal && session.goal.text || "",
      shape: { success: sh0.success && !strictAdds(sh0.success).length ? sh0.success : "", format: sh0.format },
      context: context.active ? context.block : "", today: session.today, items: session.ledger && session.ledger.items || [],
      lessons: lessons.list, core: core.active ? core.facts : "", memory: session.memFacts || [] });
  }
  function scLink(m) {
    var back = location.origin + location.pathname + "#stpback=" + (SC_MODELS[m] || SC_MODELS.cloud).slug + ".";
    return "shortcuts://run-shortcut?name=" + encodeURIComponent(SC_NAME) + "&input=text&text=" + encodeURIComponent(back);
  }
  function scDrop() { try { localStorage.removeItem(SC_KEY); } catch (e) {} }
  function scRead() {
    try {
      var d = JSON.parse(localStorage.getItem(SC_KEY) || "null");
      if (d && Date.now() - d.at > SC_MAX_MS) { scDrop(); return null; }
      return d && d.session && typeof d.session.raw === "string" ? d : null;
    } catch (e) { return null; }
  }
  /* The copy a new tab picks the build up from: the session without anything that can't be saved. */
  function scKeep() {
    if (!scWait || !session) return;
    var s = {};
    for (var k in session) { var v = session[k]; if (typeof v !== "function" && !(v && typeof v.then === "function")) s[k] = v; }
    try { localStorage.setItem(SC_KEY, JSON.stringify({ at: Date.now(), t0: scWait.t0, model: scWait.model, session: s })); } catch (e) {}
  }
  function scStop() {
    var w = scWait;
    scWait = null; scBack = null;
    if (!w) return;
    scDrop();
    var s = new Error("The shortcut write was called off."); s.status = "stopped";
    w.reject(s);
  }
  function askShortcut(text, run, onModel) {
    return new Promise(function (resolve, reject) {
      var m = (session && session.scModel) || scModel() || "cloud";
      scWait = { run: run, text: text, model: m, t0: Date.now(), sent: false, swaps: [], resolve: resolve, reject: reject };
      if (scBack) {   /* back in a new tab: the answer (or the Paste card) is already here */
        var b = scBack; scBack = null;
        scWait.model = b.model; scWait.t0 = b.t0 || scWait.t0; scWait.sent = true;
        if (onModel) onModel(SC_NAME + " (" + scLabel(b.model) + ")");
        if (b.long) scCard("long"); else scTake(b.text);
        return;
      }
      if (onModel) onModel(SC_NAME + " (" + scLabel(m) + ")");
      scCard("ready");
    });
  }
  function scCard(state) {
    var w = scWait;
    if (!w) return;
    var name = SC_NAME + " (" + scLabel(w.model) + ")";
    var others = ["pro", "cloud", "device"].filter(function (m) { return m !== w.model; });
    var run = { label: w.sent ? "Run shortcut again" : "Copy and run shortcut", act: "scrun", primary: state !== "long" };
    var swap = { label: "Try " + scLabel(others[0]), act: "scother-" + others[0] }, swap2 = { label: "Try " + scLabel(others[1]), act: "scother-" + others[1] }, flash = { label: "Use Flash instead", act: "scflash" };
    var paste = { label: "Paste result", act: "scpaste", primary: state === "long" };
    document.getElementById("resultHead").textContent = state === "ready" ? "Ready for the shortcut" : "Waiting for the shortcut...";
    if (state === "ready") notify("result", "info", "Hand this write to " + name, "One tap copies your notes with a short set of writing rules and runs the shortcut. It brings you back here with the prompt, then Polish and Check carry on like always.", [run, swap, swap2, flash]);
    else if (state === "wait") notify("result", "info", "Waiting for " + name, "When the shortcut is done it opens this page again with your prompt. Nothing came back? Run it again, try another model, or let Flash write it. Your words and answers stay put.", [run, swap, swap2, flash, paste]);
    else if (state === "long") notify("result", "info", "Result was long, tap Paste", "The shortcut copied the prompt instead of sending it in the link.", [paste, run, flash]);
    else if (state === "same") notify("result", "warn", "The shortcut hasn't answered yet", "Your clipboard still has what was sent to the shortcut, not its answer. Run it again, or let Flash write it.", [run, swap, swap2, flash, paste]);
    else if (state === "nocopy") notify("result", "warn", "Couldn't copy for the shortcut", "This browser didn't allow the copy, so the shortcut wasn't opened. Tap to try again, or let Flash write it.", [run, flash]);
    else if (state === "nopaste") notify("result", "warn", "Couldn't read the clipboard", "This browser didn't allow the paste. Run the shortcut again, or let Flash write it.", [paste, run, flash]);
    else notify("result", "warn", "That didn't look like a prompt", "The shortcut came back with almost nothing. Run it again, try another model, or let Flash write it.", [run, swap, swap2, flash, paste]);
  }
  /* Copy the job, keep the build for a new tab, open the shortcut. Needs a tap. */
  function scRun() {
    var w = scWait;
    if (!w || !session) return;
    if (!navigator.clipboard || !navigator.clipboard.writeText) return scCard("nocopy");
    navigator.clipboard.writeText(w.text).then(function () {
      if (scWait !== w) return;
      if (!w.sent) w.t0 = Date.now();
      w.sent = true;
      scKeep();
      scCard("wait");
      scLeaving = Date.now();
      (window.__scOpen || function (u) { location.href = u; })(scLink(w.model));
    }, function () { if (scWait === w) scCard("nocopy"); });
  }
  /* Try another Apple model for this build only; the saved Write with setting stays. */
  function scOther(m) {
    var w = scWait;
    if (!w || !session || !SC_MODELS[m]) return;
    w.model = m;
    session.scModel = w.model;
    w.swaps.push("switched to the " + scLabel(w.model) + " model");
    scRun();
  }
  function scFlash() {
    if (!scWait || !session) return;
    scStop();
    notify("result");
    session.noShortcut = true;
    setBusy(false);
    writeFinal(session.answers, false);
  }
  function scPaste() {
    var w = scWait;
    if (!w) return;
    if (!navigator.clipboard || !navigator.clipboard.readText) return scCard("nopaste");
    navigator.clipboard.readText().then(function (t) { if (scWait === w) scTake(t, true); }, function () { if (scWait === w) scCard("nopaste"); });
  }
  /* The shortcut's answer. Almost nothing, or the text that was sent out, is not a prompt:
     the card comes back and nothing is lost. Otherwise it carries on like a Flash answer. */
  function scTake(text, pasted) {
    var w = scWait;
    if (!w) return;
    var out = cleanPrompt(text);
    if (pasted && out === cleanPrompt(w.text)) return scCard("same");
    if (words(out) < SC_MIN_WORDS) return scCard("junk");
    scWait = null;
    scDrop();
    notify("result");
    w.resolve({ text: out, model: SC_MODELS[w.model].tag, ms: Math.max(0, Date.now() - w.t0), away: 0, history: w.swaps, tokens: null, thinkingTokens: 0 });
  }
  /* The shortcut is back: #stpback=<cloud|ondevice>.<the prompt, URL-encoded, or STP-CLIPBOARD>. */
  function scReturn() {
    var mt = /^#stpback=(cloudpro|cloud|ondevice)\.([\s\S]*)$/.exec(location.hash || "");
    if (!mt) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    var model = scOf(mt[1]), text = mt[2];
    try { text = decodeURIComponent(text); } catch (e) { try { text = decodeURIComponent(text.replace(/%(?![0-9a-f]{2})/gi, "%25")); } catch (e2) {} }
    text = text.trim();
    var long = text === SC_LONG;
    /* Same tab: the build is still here, waiting. */
    if (scWait && session) { scWait.model = model; if (long) scCard("long"); else scTake(text); return; }
    /* A new tab: pick the build up from the kept copy, then delete it. */
    var snap = scRead();
    if (!snap || busy || session) return notify("form", "info", "No build was waiting for the shortcut", "The shortcut came back, but there's no build here for its answer. It may have finished in another tab, or more than 30 minutes passed. Build again to send a new one.");
    scDrop();
    session = snap.session;
    session.cleanP = null; session.scModel = model;
    thoughts.value = session.raw;
    thoughts.dispatchEvent(new Event("stp:changed"));
    var key = gemini.key || gkey.value.trim();
    var plain = function () {   /* no saved key in this tab: the prompt still shows, without Polish and Check */
      if (long) return notify("form", "info", "The prompt is on your clipboard", "The shortcut copied it because it was long. This tab has no Gemini key, so Polish and Check can't run: paste it straight into your AI.");
      var out = cleanPrompt(text);
      session.basePrompt = out;
      showResult(extras(out), "Written by " + SC_NAME + " (" + scLabel(model) + "). Polish and Check were skipped: this tab has no Gemini key.", session.title);
    };
    if (!key) return plain();
    scBack = { model: model, text: text, long: long, t0: snap.t0 };
    ensureModel(key).then(function () { writeFinal(session.answers || [], false); }, plain);
  }
  window.addEventListener("hashchange", scReturn);
  setTimeout(scReturn, 0);
  /* Back on a tab whose build was picked up by the tab the shortcut opened (or sat past 30
     minutes): the wait ends here and the words stay in the box. */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !scWait || !scWait.sent || /^#stpback=/.test(location.hash || "") || scRead()) return;
    scStop();
    stopTicker();
    cookStop();
    setProgress(document.getElementById("resultProg"), "off");
    setBusy(false);
    setBuild("");
    ui.build = "";
    result.hidden = true;
    notify("form", "info", "The shortcut hand-off ended here", "It finished in the tab the shortcut opened, or 30 minutes passed. Your words are still in the box: tap Build my prompt to go again.");
  });

  function writeFinal(answers, quick) {
    stopFlashWait();
    stopSlowWrite();
    if (scWait) scStop();   /* #53: a new write replaces one that was waiting on the shortcut */
    /* The clean step is still going (rare, it started with the questions): wait for it. */
    if (session.cleanP && prepRunning()) {
      setBusy(true, "Finishing the cleanup...");
      showWriting(session.title);
      setSteps(document.getElementById("resultTrack"), "clean", session.mode === "Quick mode" || !(session.questions && session.questions.length));
      document.getElementById("resultTrack").hidden = false;
      var waitRun = ++writeRun, waitT0 = Date.now();
      ui.build = "write"; ui.quickOn = !!quick; session.waitingClean = true;   /* #51: the chip works here too */
      return session.cleanP.then(function () {
        session.waitingClean = false;
        session.prepWaitMs = (session.prepWaitMs || 0) + (Date.now() - waitT0); if (waitRun === writeRun) { setBusy(false); return writeFinal(answers, quick || !!session.quickAfterClean); } });
    }
    if (!session.mode) session.mode = quick ? "Quick prompt button" : "Full";
    session.answers = answers.filter(function (a) { return a.answer; });
    /* Clarity mirror (AGT-13): the goal line from the questions card. An edited goal is
       the person's own words; one left as is was seen and kept. Rework rounds keep it. */
    if (!(session.round >= 2) && !scBack) {   /* #53: back from the shortcut in a new tab, the goal line is the one that was sent */
      var askedHere = session.questions && session.questions.length && chat.readGoal && chat.readGoal === session.need;
      session.goal = askedHere && chat.need ? { text: chat.need, edited: !!chat.goalEdited } : null;
    }
    session.polished = false; session.checked = false; session.cooking = false; session.standin = null;
    var lines = session.answers.map(function (a) { return "Q: " + a.question + "\nA: " + a.answer + (a.tapped ? " (tapped from suggested options)" : ""); });
    session.lessonsV = lessons.list.length ? lessons.v : 0;
    session.today = todayText();
    var text = writerText();
    setBusy(true, "Writing your prompt...");
    /* #51: the ⚡ Quick version chip stays under the tracker for the whole write. A quick write
       that came from a tap on it says so; Quick mode shows no chip (it's already quick). */
    ui.build = "write"; ui.slow = null;
    if (!quick) ui.switched = false;
    ui.quickOn = !!quick && !ui.switched;
    session.quickAfterClean = false;
    hideGrade();
    setBuild("");
    qaStatus.textContent = "";
    var run = ++writeRun;
    var resultProg = document.getElementById("resultProg");
    showWriting(session.title);
    var depth = quick ? DEPTH.quick : depthOf(session.complexity);
    var depthKey = quick ? "quick" : (DEPTH[session.complexity] ? session.complexity : "standard");
    var est = writeEstimate(depthKey);
    var skipAsk = session.mode === "Quick mode" || session.round >= 2 || !(session.questions && session.questions.length);
    var offset = session.round >= 2 ? session.round1Secs || 0 : 0;   /* Rework rounds: running total */
    /* v2.1.34: the Write clock picks up where Prep's clock stopped instead of starting at 0:00
       (Kevin: "when it switches the timer shouldn't restart from 0"). Display only: run stats,
       learned estimates and the Ready in line still use the write time itself. */
    var carry = offset ? 0 : session.readSecs || 0;
    var busyP = quick ? null : busyNow();
    var baseModels = quick ? writeModels(true) : fullWriters();
    var models = busyP ? busyOrder(baseModels, busyP.start) : baseModels;
    var movedStart = busyP && models[0] !== baseModels[0];
    session.busyPlan = busyP ? (movedStart ? models[0].replace(/^gemini-/, "") + " first, " : "") + "backup at " + busyP.race + "s" : "";
    var writeLabel = (session.round >= 2 ? "Round " + session.round + " \u00b7 " : "") + depth.label + (techOn() ? " \u00b7 " + depth.words + (est.learned ? " \u00b7 estimate learned from your runs" : est.tuned ? " \u00b7 estimate from recent runs" : "") + (busyP ? " \u00b7 busy hours: " + session.busyPlan : "") : "");
    var eta = startEstimate(resultProg, writeLabel, est.secs, "write", skipAsk, offset, carry);
    snapTo(document.getElementById("resultTrack"));
    /* Each writer gets 30 seconds on its own (SPEC 11/04), then the next one starts too
       and the first good prompt wins. Busy hours can start the backup sooner. */
    var hedgeAfter = ROTATE_MS * TIME_SCALE;
    if (busyP) hedgeAfter = Math.min(hedgeAfter, busyP.race * 1000);
    /* Shortcut stand-in (#53, dev tools): the first full write goes to the STP Flash Backup
       shortcut instead of Flash. Quick writes and Rework rounds stay on Gemini. */
    var viaSc = !quick && !(session.round >= 2) && !session.noShortcut && !!(scBack || scModel());
    /* Every Flash model is used up for today: say so before anything is sent (#35). */
    if (!viaSc && !quick && flashOnly() && flashUsedUp()) { askFlashWait("all used up"); return Promise.resolve(); }
    var handle = { cycle: !quick && flashOnly() };
    if (!quick && !viaSc) watchSlowWrite(run, handle);
    var onWriter = function (m) { if (run === writeRun) eta(m); };
    return (viaSc ? askShortcut(scText(), run, onWriter) : askGemini(text, false, models, depth.level, onWriter, WRITE_LIMIT, hedgeAfter, handle)).then(function (r) {
      if (slowWrite && slowWrite.run === run) { if (slowWrite.offered) notify("result"); stopSlowWrite(); }
      if (run !== writeRun) { setBusy(false); return; }
      var draft = cleanPrompt(r.text);
      /* Auto-Repair: check the draft on the phone; only a real problem costs a Gemini call. */
      var before = fullCheck(draft);
      if (!before.score) return showWritten(draft, r, { status: "none" }, before);
      session.polished = true;
      ui.build = "finish";   /* #51: written, only the finishing checks are left */
      setSteps(resultProg.closest(".tracker"), "polish", skipAsk);
      eta.phase("Polish \u00b7 fixing " + before.score + (before.score === 1 ? " thing" : " things") + " the check found", POLISH_SECS, techOn() ? writeModels(true)[0] : "");
      setBusy(true, "\ud83d\udd27 Fixing " + before.score + (before.score === 1 ? " thing" : " things") + " the check found...");
      document.getElementById("resultHead").textContent = "\ud83d\udd27 Fixing " + before.score + (before.score === 1 ? " thing" : " things") + " the check found...";
      var t0 = Date.now();
      var asks = { dropped: before.dropped.concat(before.facts), stray: before.stray, missingNums: before.missingNums, strict: before.strict };
      return askGemini(repairPrompt(draft, session.raw, withMem(session.answers), asks), false, writeModels(true), "low", null, 60000).then(function (r2) {
        if (run !== writeRun) { setBusy(false); return; }
        var fixed = cleanPrompt(r2.text), after = fullCheck(fixed);
        var secs = Math.round((Date.now() - t0) / 100) / 10;
        if (isBetter(after, before, fixed, draft)) return showWritten(fixed, r, { status: "fixed", secs: secs, model: r2.model, before: before, after: after }, after);
        showWritten(draft, r, { status: "kept original", secs: secs, model: r2.model, before: before }, before);
      }, function (e) {
        if (run !== writeRun) { setBusy(false); return; }
        showWritten(draft, r, { status: "failed", secs: Math.round((Date.now() - t0) / 100) / 10, before: before }, before);
      });

      function showWritten(prompt, r, rep, check) {
        var detour = r.history && r.history.length ? " (" + r.history.join("; ") + ")" : "";
        session.repair = rep;
        session.write = { model: r.model, thinking: depthWords(depth, r.model), secs: Math.round(r.ms / 100) / 10, detours: (r.history || []).join("; "), depth: depthKey };
        session.basePrompt = prompt;
        session.workSecs = (offset || (session.intakeMs || 0) / 1000) + r.ms / 1000 + (rep.secs || 0);
        var nc0 = promptFlags(prompt);
        session.numFlags = nc0.extra.length + nc0.missing.length + nc0.dates.length;
        logRun({ depth: depthKey, est_s: est.secs, est_from: est.from, write_model: r.model, thinking: depthWords(depth, r.model), write_s: Math.round(r.ms / 100) / 10, write_tokens: r.tokens, thinking_tokens: r.thinkingTokens,
          hidden_s: (session.intakeAway || 0) + r.away >= 1000 ? Math.round(((session.intakeAway || 0) + r.away) / 100) / 10 : null,
          detours: (r.history || []).join("; ").replace(/gemini-/g, ""), words_out: words(prompt), core: core.active, outcome: "ok",
          coach: assess(session.raw).score, xray_pct: check.pct, xray_dropped: check.dropped.length, xray_stray: check.stray.length, ledger_missing: (check.facts || []).length,
          repair: rep.status, repair_s: rep.secs != null ? rep.secs : null, lessons_v: session.lessonsV || 0, busy_plan: session.busyPlan || null,
          round: session.round || null, total_s: offset ? Math.round(session.workSecs * 10) / 10 : null, slow_switch: session.slowSwitch || null });
        session.slowSwitch = null;
        /* Check (v2.1.19, run stats on): the quality grade, and its label fix when it's under
           the bar, run inside the timer. The prompt comes up when they're done, or after
           CHECK_MAX at most; anything still going then finishes in the background like before. */
        session.cooking = true;
        var doStand = !quick && words(session.raw) >= STANDIN_MIN_WORDS, grading = testLog.on();
        if (!doStand && !grading) return reveal(0);
        session.checked = true;
        ui.build = "finish";
        setSteps(resultProg.closest(".tracker"), "check", skipAsk);
        setBusy(true, "\ud83c\udfaf Checking it like your AI would...");
        document.getElementById("resultHead").textContent = "\ud83c\udfaf Checking it like your AI would...";
        var t0 = Date.now(), shown = false;
        var cap = setTimeout(go, CHECK_MAX * TIME_SCALE);
        if (doStand) eta.phase("Check \u00b7 a stand-in AI looks for gaps", STANDIN_SECS, techOn() ? liteCrew(1)[0] : "");
        (doStand ? standIn(prompt) : Promise.resolve(null)).then(function (st) {
          if (shown || run !== writeRun) return;
          if (st) {
            session.standin = st;
            if (st.prompt) session.basePrompt = st.prompt;
            if (pendingRun) { pendingRun.standin = st.status; pendingRun.standin_gaps = st.gaps; pendingRun.standin_added = st.added; pendingRun.standin_open = st.open.length; pendingRun.standin_s = st.secs; pendingRun.words_out = words(session.basePrompt); }
          }
          if (!grading) return go();
          eta.phase("Check \u00b7 grading the prompt" + (lessons.list.length ? " against " + lessons.list.length + " lessons" : ""), CHECK_SECS);
          var job = gradeRun(session.basePrompt, run, r.model);
          if (!job) return go();
          job.then(go, go);
        });
        function go() {
          if (shown) return;
          shown = true;
          clearTimeout(cap);
          if (run !== writeRun) return;
          reveal(Math.round((Date.now() - t0) / 100) / 10);
        }
        /* Every step that ran, for Step by step under the time strip. */
        function stepRows(r, rep, checkSecs) {
          var rows = [], c = session.clean || {}, l = session.ledger || {}, st = session.standin, gf = session.gradeFields, g = session.grades && session.grades[session.grades.length - 1];
          var ms = function (x) { return x != null ? x / 1000 : null; };
          if (!(session.round >= 2)) {
            var q = (session.questions || []).length;
            rows.push({ name: "Read", who: "Flash-Lite", model: String(session.intakeModel || ""), secs: ms(session.intakeMs), what: session.strongSkip ? "Picked " + plural(session.skippedIntake.questions.length, "question", "questions") + ", skipped: your note had all 5 parts" : q ? "Picked " + plural(q, "question", "questions") + (session.shape && (session.shape.success || session.shape.format) ? ", plus a suggested great result and format" : "") : "Nothing missing, so no questions" + (session.shape && (session.shape.success || session.shape.format) ? "; suggested a great result and format" : "") });
            rows.push({ name: "Clean", who: c.status === "skipped" ? "Skipped" : "Flash-Lite", model: c.model, when: c.status && c.status !== "skipped" ? "alongside Read" : "", secs: ms(c.ms), skip: c.status === "skipped",
              what: c.status === "ok" ? "Filler out, " + words(session.raw) + " to " + c.words + " words, every number kept" : c.status === "kept raw" ? "Used your raw words (the clean version " + (c.why || "didn't pass the check") + ")" : c.status === "skipped" ? "Short note, nothing to clean" : c.status === "failed" ? "Didn't come through, used your raw words" : "Didn't run" });
            rows.push({ name: "Fact ledger", who: l.status === "skipped" ? "Skipped" : crewWho(l.model, l.history, "Flash-Lite"), model: l.model, when: l.status && l.status !== "skipped" ? "alongside Read" : "", secs: ms(l.ms), skip: l.status === "skipped",
              what: l.status === "ok" ? plural(l.items.length, "must-keep item", "must-keep items") + (l.dropped ? " (" + plural(l.dropped, "unbacked item", "unbacked items") + " thrown out)" : "") : l.status === "empty" ? "Nothing it listed was backed by your words" : l.status === "skipped" ? "Short note, nothing to list" : l.status === "failed" ? "Didn't come through, skipped" : "Didn't run" });
            if (session.prepWaitMs >= 500) rows.push({ name: "Prep wait", who: "Waiting", secs: session.prepWaitMs / 1000, what: "Clean or the ledger was still going when you finished, so writing waited for it" });
            var a = (session.answers || []).length, tapped = (session.answers || []).filter(function (x) { return x.tapped; }).length;
            rows.push({ name: "Ask", who: "You", secs: null, skip: !q, what: q ? plural(a, "answer", "answers") + " of " + q + (tapped ? " (" + tapped + " tapped)" : "") + (session.goal && session.goal.edited ? "; you fixed the goal line" : "") : session.strongSkip ? "Skipped: your note had everything" : "No questions this time" });
          }
          rows.push({ name: "Write", who: /^shortcut-/.test(r.model) ? "Shortcut" : /lite/.test(r.model) ? "Flash-Lite (quick)" : "Flash", model: r.model, secs: r.ms / 1000,
            what: (r.history && r.history.length ? plural(r.history.length, "hand-off", "hand-offs") + " before it wrote" : "Written on the first try") + ((session.ledger && session.ledger.items && session.ledger.items.length) ? ", with the must-keep list" : "") });
          if (session.polished) rows.push({ name: "Polish", who: "Flash-Lite", model: rep.model, secs: rep.secs || 0,
            what: rep.status === "fixed" ? "Fixed what the checks found" + ((rep.before && rep.before.facts && rep.before.facts.length) ? ", including " + plural(rep.before.facts.length, "missed must-keep item", "missed must-keep items") : "") : rep.status === "kept original" ? "Tried a fix, but it wasn't better, kept the original" : "The fix didn't come through, kept the original" });
          if (st) rows.push({ name: "Stand-in AI", who: "Flash-Lite", model: st.model, secs: st.secs,
            what: st.status === "no gaps" ? "Could start right away, no gaps" : st.added ? "Filled " + plural(st.added, "gap", "gaps") + " from what you said" + (st.open.length ? ", " + st.open.length + " left for you" : "") : st.open.length ? plural(st.open.length, "gap", "gaps") + (st.status === "gaps only" ? " found, no time to fill, shown under the prompt" : " you didn't answer, shown under the prompt") : st.status === "slow" ? "Ran out of time, skipped" : "Didn't come through, skipped" });
          /* Grade (v2.1.25): names who actually graded and any hand-offs. Still running at
             Ready? This row updates itself when the grade lands (session.refreshSteps). */
          if (session.checked && testLog.on()) rows.push({ name: "Grade", who: g ? crewWho(g.model, g.history, "") : session.gradeFailed ? "No grader answered" : "Flash-Lite (never the writer, never Flash)",
            model: g ? String(g.model || "") : "", secs: gf ? gf.grade_s : null,
            what: g ? "Scored " + (Math.round(g.craft * 10) / 10).toFixed(1) + (g.pass ? ", passes the bar" : ", under the bar") + (session.labelFix && /added/.test(session.labelFix.status) ? ", then added missing lines" : "")
              : session.gradeFailed ? "Every grader missed this time (" + session.gradeFailed + "), so there's no score. The prompt is fine to use."
              : "Took longer than the Check, still grading. This row updates when it lands." });
          return rows;
        }
        function reveal(checkSecs) {
          session.cooking = false;
          setBusy(false);
          setBuild("");
          qaStatus.textContent = "";
          var finalPrompt = session.basePrompt || prompt, more = (rep.secs || 0) + (checkSecs || 0);
          /* v2.1.34: Ready in counts Prep too (carry), so it matches the timer, which no longer restarts at Write. */
          var secs = Math.max(1, Math.round(r.ms / 1000 + more + carry)) + "s";
          /* Elapsed matches the total: Polish and Check count, and the line under Done says how much they added. */
          finishTrack(resultProg, r.ms / 1000 + more, skipAsk, offset + carry);
          resultProg.closest(".tracker").querySelector(".detail").textContent = writeLabel + (techOn() ? " \u00b7 " + r.model : "");
          var stripTrack = resultProg.closest(".tracker"), stripParts = [
            ["prep", ((session.intakeMs || 0) + (session.prepWaitMs || 0)) / 1000, "Prep", !(session.round >= 2) && session.intakeMs != null],
            ["write", r.ms / 1000, "Write", true], ["polish", rep.secs || 0, "Polish", !!session.polished], ["check", checkSecs || 0, "Check", !!session.checked]];
          showTimeStrip(stripTrack, stripParts, stepRows(r, rep, checkSecs));   /* at Ready, the line says how it was written again, not the last step */
          /* A grade that lands after Ready redraws Step by step, keeping it open if it was (v2.1.25). */
          var mine = session;
          session.refreshSteps = function () {
            if (session !== mine) return;
            var was = stripTrack.querySelector(".tsdetail"), open = !!(was && was.open);
            showTimeStrip(stripTrack, stripParts, stepRows(r, rep, checkSecs));
            var now = stripTrack.querySelector(".tsdetail"); if (now && open) now.open = true;
          };
          if (more >= 0.5) { resultProg.closest(".tracker").querySelector(".leftlbl").textContent = "includes " + Math.max(1, Math.round(more)) + "s " + (rep.secs && checkSecs ? "polish and check" : rep.secs ? "polish" : "check"); cookClock(resultProg.closest(".tracker")); }
          var total = offset ? " (" + Math.max(1, Math.round(session.workSecs + (checkSecs || 0))) + "s total, " + (session.round > 2 ? "all rounds" : "both rounds") + ")" : "";
          var bySc = /^shortcut-/.test(r.model) ? SC_NAME + " (" + scLabel(scOf(r.model)) + ")" : "";   /* #53 */
          showResult(extras(finalPrompt), techOn()   /* core */
            ? (offset ? "Round " + session.round + " built" : "Built") + " with " + (bySc || "Gemini (" + r.model + ", " + depthWords(depth, r.model) + ")") + " in " + secs + total + detour + ". Your AI can start working right away."
            : (offset ? "Round " + session.round + " ready in " : "Ready in ") + secs + total + (bySc ? ", written by " + bySc : "") + ". Your AI can start working right away.", session.title);
          if (session.round >= 2 && ui.round) roundBuilt(session.round);
          /* Left mid-build and came back before it finished: say it picked back up. */
          if (!doneAway("prompt") && (session.intakeAway || 0) + (r.away || 0) >= 3000) notify("result", "info", "Picked back up", "You left mid-build, so it paused and finished when you came back. Nothing was lost.");
          session.writeStart = null;
          if (session.autoQuick) { session.autoQuick = false; notify("result", "info", "The quick model wrote this one", "Flash couldn't finish within 3 minutes, so the quick model wrote it to keep you moving. Check the Quality check before you paste it."); }
          showRepairNote(rep);
          showGapNote(session.standin);
          if (session.strongSkip && !ui.notices.result) notify("result", "info", "Your note had everything", "No questions needed, so it went straight to writing your prompt.", [{ label: "Ask me anyway", act: "askanyway" }]);
          /* memory: offer to remember lasting facts and your answers. Nothing saves without a tap. */
          if (memory.active) {
            var offer = [];
            (session.memRemember || []).concat(session.answers.map(answerFact)).forEach(function (t) {
              if (t && !memory.has(t) && offer.every(function (o) { return o.toLowerCase() !== t.toLowerCase(); })) offer.push(t);
            });
            memory.suggestions = offer.slice(0, 4);
          }
          var nc = showNumberCheck(finalPrompt);
          session.numFlags = nc.extra.length + nc.missing.length + nc.dates.length;
        }
      }
    }).catch(function (e) {
      if (e && e.status === "stopped") return;   /* Switch to quick stopped it; the quick write is already going */
      if (slowWrite && slowWrite.run === run) { if (slowWrite.offered) notify("result"); stopSlowWrite(); }
      if (run !== writeRun) { setBusy(false); return; }
      stopTicker();
      cookStop();
      setProgress(resultProg, "off");
      setBusy(false);
      setBuild("");
      ui.build = "";
      qaStatus.textContent = "";
      signal("gemini-failed", "While writing");
      /* No Flash model could write it: ask wait or quick model instead of a silent backup (#35).
         Offline and key problems keep their own messages below. */
      if (!quick && flashOnly() && flashBusy(e)) return flashUsedUp() ? askFlashWait(e && e.message ? e.message : "unknown") : quickAfterBusy();
      session.writeStart = null;
      if (session.round >= 2 && rounds.length) {   /* A Rework round failed: the round it came from comes back, nothing lost */
        var why = e && e.message ? e.message : "unknown", failedN = session.round, backN = reworkFrom + 1;
        logRun({ depth: depthKey, est_s: est.secs, est_from: est.from, outcome: "write failed: " + why, round: failedN });
        backToBase();
        return notify("result", "error", "Round " + failedN + " didn't come through", "Your round " + backN + " prompt is back and ready to copy. Tap Rework from this prompt to try again.");
      }
      showQuick(session.raw, "Gemini couldn't finish, so this is the quick version. " + (e && e.message ? e.message : ""));
      failNotice(e);
      session.writeError = e && e.message ? e.message : "unknown";
      logRun({ depth: depthKey, est_s: est.secs, est_from: est.from, outcome: "write failed: " + (e && e.message ? e.message : "unknown") });
    });
  }

  /* Quality grade (run stats on, with a key): after the prompt is on screen, the
     fast model scores it in the background (1.00 to 5.00, pass at 4.5, rearranged,
     invented, what's missing, which lessons it broke). Only the score, fixed
     labels, and lesson ids go into the run, for the review's lessons learned.
     It never slows the prompt down; if it's late or fails, the run is sent
     without it. */
  function hideGrade() { var el = document.getElementById("gradeNote"); el.hidden = true; el.textContent = ""; ui.grade = null; }

  /* Rework (from the Quality check, when it's under the bar): the prompt goes back in the
     box with one "What was weak" line on top, for the person to change as they like. Their
     original thoughts and answers stay in memory (never saved): the new round writes from
     them plus the edited prompt, with no questions, and Save to Notes keeps the original
     words with the new prompt.
     Up to ROUND_MAX rounds. rounds[i] is a snapshot of round i+1 (session, prompt, card,
     grade, box); the round on screen is live and is snapshotted when you leave it. Once
     there are 2 or more, Round 1 / 2 / 3 on the card flips between them, Compare lines
     them up, and Rework builds the next round from whichever round you're viewing.
     reworkDraft keeps your edits if you go back before the new round is built, so Rework
     picks up where you left off. All in memory only, never saved. */
  var ROUND_MAX = 3;
  var rounds = [], reworkFrom = 0, reworkSeed = "", reworkDraft = null;   /* reworkDraft: { from, text } */
  function clearRounds() { rounds = []; reworkFrom = 0; reworkSeed = ""; reworkDraft = null; guide = null; ui.round = null; ui.compare = null; }
  var ROUND_IDS = ["resultHead", "resultTrack", "madeBy", "chatName", "categoryLine", "repairNote", "numWarn", "gradeNote"];
  function lastGrade() { return session && session.grades && session.grades.length ? session.grades[session.grades.length - 1] : null; }
  function reworkNotes(g) {
    var n = [];
    if (g.rearranged) n.push("It reads like your words rearranged, not clear instructions for the AI.");
    if (g.invented) n.push("It added something you didn't say.");
    g.missing.forEach(function (m) { n.push("It's missing " + (LABEL_NAMES[m] || m) + "."); });
    (g.broke || []).forEach(function (b) { n.push("It broke lesson " + b + "."); });
    if (g.numCheck) n.push("The number check flagged a number or date.");
    if (!n.length) n.push("It could be sharper and more specific.");
    return n;
  }
  function snapResult() {
    var snap = {};
    ROUND_IDS.forEach(function (id) { var el = document.getElementById(id); if (el) { var k = keepOut(el); snap[id] = { html: el.innerHTML, hidden: el.hidden }; keepIn(el, k); } });
    return snap;
  }
  function restoreResult(snap) {
    ROUND_IDS.forEach(function (id) { var el = document.getElementById(id); if (el && snap[id]) { var k = keepOut(el); el.innerHTML = snap[id].html; keepIn(el, k); el.hidden = snap[id].hidden; } });
  }
  /* A part drawn by Svelte (marked data-keep, like the cooking pot) must never be rebuilt
     from saved HTML, or Svelte loses track of it. It steps out for the copy and goes back
     into the same spot. */
  function keepOut(el) {
    var k = el.querySelector("[data-keep]");
    if (!k) return null;
    var mark = document.createComment("keep");
    k.replaceWith(mark);
    return k;
  }
  function keepIn(el, k) {
    if (!k) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_COMMENT), n;
    while ((n = w.nextNode())) if (n.data === "keep") { n.replaceWith(k); return; }
    el.appendChild(k);
  }
  function roundSnap() { return { session: session, output: output.value, grade: ui.grade, dom: snapResult(), box: thoughts.value }; }
  function viewingRound() { return ui.round && ui.round.viewing ? ui.round.viewing : rounds.length; }
  /* Puts a saved round back on screen: prompt, card, Quality check, and the box. */
  function restoreRound(r) {
    session = r.session;
    thoughts.value = r.box;
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    output.value = r.output;
    restoreResult(r.dom);
    if (typeof resetKeep === "function") resetKeep();
    setReady(true);
    xray.set({ prompt: output.value, raw: session.raw, answers: withMem(session.answers), core: extraBlock(), known: sessionKnown() });
    ui.grade = r.grade;
    qa.hidden = true;
    result.hidden = false;
    output.dispatchEvent(new Event("stp:changed"));
  }
  /* Scores for the switcher and the Compare table, from each round's Quality check. The
     round on screen reads live, so a grade that lands later shows up right away. */
  function refreshCompare() {
    if (!ui.round || ui.round.stage !== "built" || rounds.length < 2) { ui.compare = null; return; }
    var v = viewingRound() - 1;
    var list = rounds.map(function (r, i) {
      var s = i === v ? session : r.session, g = s && s.grades && s.grades.length ? s.grades[s.grades.length - 1] : null;
      return { n: i + 1, g: g, words: words(i === v ? output.value : r.output) };
    });
    ui.compare = compareRounds(list);
    ui.round = Object.assign({}, ui.round, { scores: list.map(function (x) { return x.g ? Math.round(x.g.craft * 10) / 10 : null; }) });
  }
  /* edit false (Rework, #2, idea mvu5g66pdbqo): the round builds right away from the weak line
     plus the prompt, no second Build tap. edit true (Edit first): the prompt waits in the box
     for your changes, then Build my prompt. */
  function startRework(edit) {
    var g = lastGrade(), key = gemini.key || gkey.value.trim();
    if (!g || g.pass || !session || !session.basePrompt || busy || !key || !gemini.plan) return;
    if ((ui.round && ui.round.stage !== "built") || rounds.length >= ROUND_MAX) return;
    var from = rounds.length ? viewingRound() - 1 : 0;
    rounds[from] = Object.assign({}, rounds[from] || {}, roundSnap());
    reworkFrom = from;
    reworkSeed = "What was weak: " + reworkNotes(g).join(" ") + "\n\n" + session.basePrompt;
    notify("result"); notify("form");
    thoughts.value = reworkDraft && reworkDraft.from === from ? reworkDraft.text : reworkSeed;   /* your earlier edits come back */
    reworkDraft = null;
    thoughts.dispatchEvent(new Event("stp:changed"));   /* Ghost Coach re-reads the box */
    ideasSync();
    ui.round = Object.assign({}, ui.round || {}, { n: rounds.length + 1, stage: "edit", from: from + 1, count: rounds.length, max: ROUND_MAX });
    result.hidden = true;
    if (!edit) { form.requestSubmit ? form.requestSubmit() : document.getElementById("build").click(); return; }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    try { thoughts.focus({ preventScroll: true }); thoughts.setSelectionRange(0, 0); } catch (e) {}
  }
  function roundNext(text) {
    var s1 = rounds[reworkFrom].session, seedLines = reworkSeed.split(/\n+/).map(function (l) { return l.trim(); });
    var n = rounds.length + 1;
    /* Lines the person typed or changed count as their own words, like an answer, so the
       number check and the grader don't treat them as made up. */
    var added = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(function (l) {
      return l && seedLines.indexOf(l) === -1 && !/^what was weak:/i.test(l);
    }).join("\n").slice(0, 2000);
    session = Object.assign({}, s1, { answers: (s1.answers || []).slice(), grades: null, gradeFields: null, draftBefore: null, repair: null, numFlags: 0,
      round: n, reworkOf: reworkFrom + 1, reworkText: text.slice(0, 12000), round1Secs: s1.workSecs || 0, mode: "Rework round " + n });
    if (added) session.answers.push({ question: "What I changed when reworking", answer: added, tapped: false });
    ui.round = Object.assign({}, ui.round, { stage: "writing" });
    notify("form");
    writeFinal(session.answers, false);
  }
  /* Ask me, then rewrite (v2.1.39, idea mwct7axlrttc): the Quality check tip used to leave the
     fixing to you ("add that to your note and build again"). Now one tap turns what was weak
     into up to 3 short questions with answers to tap (or type your own, or skip), and your
     answers build the next round as a full rewrite. One Flash-Lite call writes the questions
     to fit your request; if it fails or runs past 8 seconds the phone's own questions are
     used, so the button never dead-ends. Same rounds as Rework (max 3, Back, Compare), and
     the answers stay in memory only, never saved. */
  var guide = null;   /* { base, run } while the questions are being written or are on screen */
  var guideRun = 0;
  function tipWeak(g) {
    if (!g || g.pass) return [];
    var w = g.missing.slice();
    if (g.rearranged && w.indexOf("task") === -1) w.unshift("task");
    if (!w.length && !g.invented && !g.numCheck) w.push("detail");
    return w.slice(0, TIP_MAX);
  }
  function startGuided() {
    var g = lastGrade(), key = gemini.key || gkey.value.trim(), weak = tipWeak(g);
    if (!weak.length || !session || !session.basePrompt || busy || !key || !gemini.plan) return;
    if ((ui.round && ui.round.stage !== "built") || rounds.length >= ROUND_MAX) return;
    var from = rounds.length ? viewingRound() - 1 : 0;
    rounds[from] = Object.assign({}, rounds[from] || {}, roundSnap());
    reworkFrom = from;
    reworkSeed = "What was weak: " + reworkNotes(g).join(" ") + "\n\n" + session.basePrompt;
    notify("result"); notify("form");
    var base = session, run = ++guideRun, n = rounds.length + 1;
    guide = { base: base, run: run };
    ui.round = Object.assign({}, ui.round || {}, { n: n, stage: "ask", from: from + 1, count: rounds.length, max: ROUND_MAX });
    result.hidden = true;
    chat.reset();
    chat.title = "Let's sharpen your prompt";
    window.dispatchEvent(new Event("stp-asking"));   /* the dock: Write my prompt is next (NextDock.svelte) */
    setBusy(true, "Writing your questions...");
    qaStatus.textContent = "Writing " + (weak.length === 1 ? "a quick question" : weak.length + " quick questions") + " about what was weak...";
    qa.hidden = false;
    qa.scrollIntoView({ behavior: "smooth", block: "start" });
    askGemini(tipQuestionsPrompt(base.basePrompt, weak, base.raw, withMem(base.answers)), true, gemini.plan.intake, "low", null, 8000).then(function (r) { return r.text; }, function () { return ""; }).then(function (text) {
      if (!guide || guide.run !== run) return;   /* Back, Start over, or a new build: leave it alone */
      setBusy(false);
      qaStatus.textContent = "";
      var qs = tipQuestions(weak, text);
      guide.asked = qs.length; guide.fromAi = qs.filter(function (q) { return q.from === "ai"; }).length;
      chat.start({ title: "Let's sharpen your prompt", need: "", questions: qs.map(function (q) { return { question: q.question, choices: q.choices }; }) },
        "Round " + n + ": your answers go into a rewrite of your prompt. Your first thoughts and answers are kept.");
      qa.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  /* The answers join your earlier ones (so their numbers count as yours), and the round
     writes from them plus the prompt with its weak line, like Rework. All skipped is fine:
     it's a plain Rework then. */
  function guidedBuild(answers, quick) {
    var s1 = guide.base, n = rounds.length + 1, got = answers.filter(function (a) { return a.answer; });
    session = Object.assign({}, s1, { answers: (s1.answers || []).concat(got), grades: null, gradeFields: null, draftBefore: null, repair: null, numFlags: 0,
      round: n, reworkOf: reworkFrom + 1, reworkText: reworkSeed.slice(0, 12000), round1Secs: s1.workSecs || 0, mode: "Rework round " + n + " (asked)",
      guided: { asked: guide.asked || 0, answered: got.length, ai: guide.fromAi || 0 } });
    guide = null;
    ui.round = Object.assign({}, ui.round, { stage: "writing" });
    notify("form");
    writeFinal(session.answers, !!quick);
  }
  function roundBuilt(n) {
    rounds[n - 1] = roundSnap();
    ui.round = Object.assign({}, ui.round, { stage: "built", viewing: n, count: rounds.length, max: ROUND_MAX });
    refreshCompare();
  }
  /* ← Back to round N, before the new round is built: that round comes back as it was,
     and your edits wait for the next Rework. */
  function backToBase() {
    if (!ui.round || ui.round.stage === "built" || !rounds[reworkFrom]) return;
    /* From the questions (stage ask) or a round built from them, nothing was typed in the box:
       any earlier Edit first draft stays as it was. */
    var asked = ui.round.stage === "ask" || !!(session && session.guided);
    var text = asked ? "" : ui.round.stage === "edit" ? thoughts.value : session && session.reworkText ? session.reworkText : "";
    if (!asked) reworkDraft = text && text.trim() !== reworkSeed.trim() ? { from: reworkFrom, text: text } : null;
    guide = null; guideRun++;
    qaStatus.textContent = "";
    writeRun++;
    setBusy(false);
    stopTicker();
    setBuild("");
    restoreRound(rounds[reworkFrom]);
    document.getElementById("resultHead").textContent = "Your prompt is ready";
    if (rounds.length > 1) ui.round = Object.assign({}, ui.round, { stage: "built", viewing: reworkFrom + 1, count: rounds.length, n: rounds.length });
    else { rounds = []; ui.round = null; }
    notify("form"); notify("result");
    refreshCompare();
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /* Flip between built rounds. The round you leave is snapshotted, so its prompt, card,
     score and box come back exactly. A grade still on its way for the round you leave
     is dropped (writeRun), so it can't land on the other round. */
  function showRound(n) {
    var r = ui.round, v = viewingRound();
    if (!r || r.stage !== "built" || n < 1 || n > rounds.length || v === n || !rounds[n - 1]) return;
    rounds[v - 1] = Object.assign({}, rounds[v - 1], roundSnap());
    writeRun++;
    setBusy(false);
    stopTicker();
    restoreRound(rounds[n - 1]);
    ui.round = Object.assign({}, r, { viewing: n });
    notify("result");
    refreshCompare();
    ideasSync();
  }
  function gradeFrom(text, items) {
    var j; try { j = JSON.parse(String(text || "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "")); } catch (e) { return null; }
    var c = Number(j && j.craft);
    if (!(c >= 1 && c <= 5)) return null;
    var miss = (Array.isArray(j.missing) ? j.missing : []).map(function (m) { return String(m).toLowerCase().trim(); })
      .filter(function (m, i, a) { return GRADE_MISSING.indexOf(m) !== -1 && a.indexOf(m) === i; });
    var ids = (items || []).map(function (l) { return l.id; });
    var broke = (Array.isArray(j.broke) ? j.broke : []).map(function (b) { return String(b).toUpperCase().trim(); })
      .filter(function (b, i, a) { return ids.indexOf(b) !== -1 && a.indexOf(b) === i; });
    var re = j.rearranged === true, inv = j.invented === true, g = capGrade(c, miss, re, inv, broke);
    return { craft: g, pass: g >= GRADE_PASS, rearranged: re, invented: inv, missing: miss, broke: broke };
  }
  /* One grade: a promise of the parsed grade (with .model), or an error. */
  /* The grader is never the model that wrote the prompt, so it can't go easy on its own
     work (v2.1.15 fix, 11/04). A Flash-Lite prompt (Quick mode or the quick model after a
     Flash wait) is graded by a Flash model first, then the other Flash-Lite. A Flash prompt
     is graded by Flash-Lite as before. Resting models still go to the back of the line. */
  /* Graders (v2.1.25): every Flash-Lite but the writer. Flash never grades, so a grade can't
     spend one of the 20 Flash writes a day. The one exception: a key with a single Flash-Lite
     that wrote this prompt itself (Quick mode), where only a Flash can grade without the
     writer grading its own work. */
  function graderModels(writer) {
    var lites = gemini.plan.intake.filter(function (m) { return /lite/.test(m); });
    var others = lites.filter(function (m) { return m !== writer; });
    if (others.length) return others;
    var flashes = gemini.plan.intake.filter(function (m) { return !/lite/.test(m) && m !== writer; });
    return flashes.length ? flashes.slice(0, 1) : lites;
  }
  function gradeOnce(prompt, raw, answers, today, items, grader, writer) {
    return function () {
      return askGemini(gradePrompt(prompt, raw, answers, grader, items, today), true, route("grade", writer), "low", null, 30000, GRADE_HEDGE_MS).then(function (r) {
        var g = gradeFrom(r.text, items); if (!g) throw new Error("Couldn't read the grade.");
        g = numberDock(g, session ? promptFlags(prompt) : null);   /* the number check flagged: docked */
        g.model = r.model; g.history = r.history || []; return g;
      });
    };
  }
  var GRADE_HEDGE_MS = window.__gradeHedgeMs || 12000;   /* v2.1.25: the other Flash-Lite joins a slow grade after 12s */
  /* Confirm passes: the grader varies a little run to run, so a borderline prompt
     could pass on one lucky grade. Any grade at or over the bar gets a second look,
     and the lower one wins. Fails need no second look. If the second look doesn't
     come back, the first grade stands, marked unconfirmed. */
  function gradeConfirmed(once) {
    return once().then(function (g) {
      if (!g.pass) return g;
      return once().then(function (g2) {
        var low = g2.craft < g.craft ? g2 : g;
        low.confirm = g2.pass ? "held" : "dropped"; low.firstCraft = g.craft; low.secondCraft = g2.craft;
        return low;
      }, function () { g.confirm = "unconfirmed"; g.firstCraft = g.craft; return g; });
    });
  }
  function confirmNote(g) {
    return g.confirm === "dropped" ? "a second look gave " + g.secondCraft.toFixed(2) + " (first " + g.firstCraft.toFixed(2) + ")" : g.confirm === "unconfirmed" ? "pass not confirmed" : "";
  }
  function gradeRun(prompt, run, writer) {
    if (!testLog.on() || !gemini.plan || !session) return;
    var target = pendingRun, t0 = Date.now();
    var items = lessons.items;
    var job = gradeConfirmed(gradeOnce(prompt, session.raw, gradeAnswers(), session.today, items, lessons.grader, writer)).then(function (g) {
      /* Staging #lowgrade test: round 1 reads as under the bar, whatever the grader said. */
      if (IS_STAGING && fakeLowGrade && !(session && session.round >= 2)) g = { craft: 3.4, pass: false, rearranged: false, invented: false, missing: ["role", "context"], broke: [], model: g.model, history: g.history };
      var r = g;
      var fields = { grade: g.craft, grade_pass: g.pass, grade_rearranged: g.rearranged, grade_invented: g.invented, grade_missing: g.missing.join("+") || "none",
        grade_broke: g.broke.join("+") || "none", grade_confirm: g.confirm || "none", grade_numcheck: g.numCheck ? g.numCheck.join("+") : "none",
        grade_model: String(r.model || "").replace(/gemini-/, "") + " g" + lessons.gv + (lessons.src === "draft" ? " draft " + lessons.id : ""), grade_s: Math.round((Date.now() - t0) / 100) / 10,
        grade_by: familyOf(r.model), grade_handoff: handoffs(r.model, g.history).replace(/gemini-/g, "") || "none" };
      if (target) for (var k in fields) if (k !== "grade_by" && k !== "grade_handoff") target[k] = fields[k];   /* those two are for this phone's notes only */
      if (run !== writeRun) return;
      session.grades = [g];
      session.gradeFields = fields;
      var el = document.getElementById("gradeNote");
      el.textContent = gradeText(g, fields, "");
      el.hidden = false;
      if (canFix(g)) return fixLabel(prompt, run, target, g, fields, items, el, writer);
    }, function (e) {
      /* Every grader missed (v2.1.25): say so, instead of "Still grading" forever. */
      if (run !== writeRun || !session) return;
      session.gradeFailed = (e && e.message) || "no grader answered";
    }).then(function () { if (run === writeRun && session && session.refreshSteps) session.refreshSteps(); });
    if (target) target._grade = job;
    return job;
  }
  /* The glanceable Quality check (QualityCheck.svelte): score, a plain label, one tip. */
  function gradeView(g, extra) {
    var tip = g.pass ? "Paste it as is. It covers what a great answer needs."
      : g.numCheck ? "Check the numbers and dates in the Heads up note before you paste it."
      : g.invented ? "Check it didn't add anything you didn't say."
      : g.rearranged ? "Say what you want done, not only what's on your mind."
      : g.missing.length ? "It could say " + andList(g.missing.slice(0, TIP_MAX).map(function (m) { return LABEL_NAMES[m] || m; })) + "."
      : "A detail or two about what you want would sharpen it.";
    var score = Math.round(g.craft * 10) / 10, ask = tipWeak(g).length;
    return { score: score, pass: !!g.pass, ask: ask, label: g.pass ? "Ready to go" : score >= 3.5 ? "Good start" : "Could be sharper", tip: tip, working: /adding .*\.\.\.$/.test(extra || "") };
  }
  function gradeText(g, fields, extra) {
    ui.grade = gradeView(g, extra);
    if (ui.round) queueMicrotask(refreshCompare);   /* Compare rounds reads the new grade */
    var notes = [g.pass ? "\u2705 passes the " + GRADE_PASS + " bar" + (g.confirm === "held" ? ", confirmed" : "") : "\u270b below the " + GRADE_PASS + " bar"];
    if (confirmNote(g)) notes.push(confirmNote(g));
    if (g.rearranged) notes.push("reads like your words rearranged");
    if (g.invented) notes.push("added something you didn't say");
    if (g.missing.length) notes.push("could add: " + g.missing.map(function (m) { return m + (LABEL_NAMES[m] ? " (" + LABEL_NAMES[m] + ")" : ""); }).join(", "));
    if (g.broke.length) notes.push("broke lesson " + g.broke.join(", "));
    if (g.numCheck) notes.push("docked from " + g.numBefore.toFixed(2) + ": the number check flagged it");
    if (extra) notes.push(extra);
    /* The first grader didn't answer: say what happened (v2.1.25). */
    var why = fields.grade_handoff && fields.grade_handoff !== "none" ? ", hand-off: " + fields.grade_handoff : "";
    return "\ud83c\udfaf Quality check: " + gradeLabel(g.craft) + " \u00b7 " + notes.join(" \u00b7 ") + " (graded by " + (fields.grade_by ? fields.grade_by + " " : "") + fields.grade_model + ", " + fields.grade_s + "s" + (fields.fix_s != null ? " + " + fields.fix_s + "s fix" : "") + why + ")";
  }
  /* Below the bar with a label the app can add (LABEL_FIXES): one small call adds
     those lines, the phone checks nothing else changed, the grader looks again, and
     the new version is kept only if it scores higher and you haven't used the prompt
     yet. Up to two tries: a second try runs when the first was thrown away, or when
     it helped but the prompt is still under the bar with something left to add. */
  function andList(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function fixList(g) { return g.missing.filter(function (m) { return LABEL_FIXES.indexOf(m) !== -1; }); }
  function canFix(g) { return !g.pass && !g.rearranged && !g.invented && fixList(g).length > 0; }
  function fixLabel(prompt, run, target, g, fields, items, el, writer) {
    var t0 = Date.now(), first = g, best = g, cur = prompt, tries = 0, added = [], last = "", lastStatus = "kept original";
    function secs() { return Math.round((Date.now() - t0) / 100) / 10; }
    function used() { return run !== writeRun || pendingRun !== target || (session && session.cooking ? false : output.value !== extras(cur)); }
    function end(status, note) {
      var s = secs();
      if (target) { target.label_fix = status; target.label_fix_s = s; target.label_fix_tries = tries; }
      if (session) session.labelFix = { status: status, secs: s, tries: tries };
      fields.fix_s = s;
      if (run === writeRun) el.textContent = gradeText(best, fields, "\ud83d\udd27 " + note);
      if (run === writeRun && session && session.refreshSteps) session.refreshSteps();
    }
    function finish() {
      if (added.length) return end("added " + added.join("+"), "added " + andList(added) + ", up from " + (Math.round(first.craft * 10) / 10).toFixed(1) + (tries > 1 ? " in " + tries + " tries" : ""));
      return end(lastStatus, last + ", so this is the original");
    }
    function again(status, note) {
      lastStatus = status; last = note;
      return tries < 2 ? attempt() : finish();
    }
    function attempt() {
      tries++;
      var list = fixList(best), what = andList(list);
      el.textContent = gradeText(best, fields, "\ud83d\udd27 adding " + what + (tries > 1 ? ", try 2" : "") + "...");
      return askGemini(labelFixPrompt(cur, list, session.raw, withMem(session.answers)), false, route("labelfix"), "low", null, 30000).then(function (r) {
        var fixed = cleanPrompt(r.text);
        if (!onlyAdded(fixed, cur, list.length)) return again("kept original", "tried adding " + what + ", but it changed other lines");
        if (used()) return end("skipped, already used", "skipped adding " + what + " because you already used this prompt");
        return gradeConfirmed(gradeOnce(fixed, session.raw, gradeAnswers(), session.today, items, lessons.grader, writer)).then(function (g2) {
          if (!g2 || g2.craft <= best.craft) return again("kept original", "tried adding " + what + ", but it didn't score higher");
          if (used()) return end("skipped, already used", "skipped adding " + what + " because you already used this prompt");
          list.forEach(function (m) { if (g2.missing.indexOf(m) === -1 && added.indexOf(m) === -1) added.push(m); });
          if (!added.length) added = list.slice();
          session.grades.push(g2);
          session.draftBefore = prompt;
          cur = fixed; best = g2;
          session.basePrompt = fixed;
          if (!session.cooking) {   /* while cooking, the reveal shows the fixed version */
            output.value = extras(fixed);
            xray.set({ prompt: output.value, raw: session.raw, answers: withMem(session.answers), core: extraBlock(), known: sessionKnown() });
          }
          var nc = session.cooking ? promptFlags(fixed) : showNumberCheck(fixed);
          session.numFlags = nc.extra.length + nc.missing.length + nc.dates.length;
          if (target) {
            target.grade_before = first.craft; target.grade = g2.craft; target.grade_pass = g2.pass; target.grade_missing = g2.missing.join("+") || "none";
            target.grade_broke = g2.broke.join("+") || "none"; target.grade_rearranged = g2.rearranged; target.grade_invented = g2.invented; target.grade_confirm = g2.confirm || "none"; target.grade_numcheck = g2.numCheck ? g2.numCheck.join("+") : "none";
            target.words_out = words(fixed); target.num_flags = session.numFlags;
          }
          return tries < 2 && canFix(g2) ? attempt() : finish();
        });
      }).catch(function () { return again("failed", "couldn't add " + what + " this time"); });
    }
    return attempt();
  }
  /* The fix may only add lines: every original line still there, in order, and a
     few new words at most, with no new made-up numbers. */
  function onlyAdded(fixed, prompt, n) {
    var pos = 0, lines = prompt.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    for (var i = 0; i < lines.length; i++) { var at = fixed.indexOf(lines[i], pos); if (at < 0) return false; pos = at + lines[i].length; }
    var add = words(fixed) - words(prompt);
    return add >= 3 && add <= 20 + 25 * Math.max(1, n || 1) && numberIssues(fixed).extra.length <= numberIssues(prompt).extra.length;
  }

  function cleanPrompt(t) { return String(t || "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim(); }

  /* What Auto-Repair looks for: sentences of yours that didn't make it in (X-ray,
     skipping short filler and feelings), numbers nobody said, and numbers you said that went
     missing (the number check). score = how many things a fix would address. */
  function qualityCheck(prompt) {
    var x = analyze(prompt, session.raw, withMem(session.answers));
    var dropped = x.sources.filter(function (s) { return !s.used && words(s.text) >= 4 && !isAside(s.text); }).map(function (s) { return s.text; });
    var n = numberIssues(prompt), strict = strictAdds(prompt);
    return { pct: x.pct, dropped: dropped, stray: n.extra, missingNums: n.missing, strict: strict, score: dropped.length + n.extra.length + n.missing.length + strict.length };
  }
  /* Strictness guard (flow bench run 2, B9: "gluten free" became "safely eat" and
     cross-contamination tips; T2: "can't eat shellfish" became an allergy). Free, on the phone:
     words that make a preference stricter or more medical than the person said. Polish takes
     them out, and the ledger and the suggested shape can't carry them in. A word they said
     themselves (or one from the same family) is always fine. */
  var STRICT = [
    { re: /\b(safe|safely|safety)\b/i, said: /\bsaf(e|ely|ety)\b/i },
    { re: /\bcross[- ]?contaminat\w*/i, said: /contaminat/i },
    { re: /\ballerg\w*/i, said: /allerg/i },
    { re: /\b(celiac|coeliac)\b/i, said: /\b(celiac|coeliac)\b/i },
    { re: /\bmedical(ly)?\b/i, said: /\bmedical/i },
    { re: /\bstrict(ly)?\b/i, said: /\bstrict/i }
  ];
  function strictAddsVs(text, said) {
    var t = String(text || ""), heard = String(said || "");
    return STRICT.filter(function (s) { return s.re.test(t) && !s.said.test(heard); }).map(function (s) { return t.match(s.re)[0].toLowerCase(); });
  }
  function strictAdds(text) { return strictAddsVs(text, saidText()); }
  /* Keep a fix only if it solved something, added no new made-up numbers, didn't
     lose numbers, and didn't shrink or balloon the prompt. */
  /* #34: a sentence that stops right where a value belongs ("totaling.", "each person owes.", "= ,"). */
  var HANGING = /\b(is|owes|owe|totaling|totals|equals|comes to|for a total of)\s*[.,;)]|=\s*(?![\s$\d(~\u2248-])|\b(owes|totaling|equals|comes to)\s*$/im;
  function hanging(text) { return HANGING.test(String(text || "")); }
  function isBetter(after, before, fixed, draft) {
    if (hanging(fixed) && !hanging(draft)) return false;
    var len = words(fixed) / Math.max(1, words(draft));
    /* Never keep a fix that deleted a number you said (even small ones like a 6am start). */
    var said = numberTokens(saidText(), true), kept = numberTokens(fixed, true), had = numberTokens(draft, true);
    var lost = Object.keys(had).some(function (n) { return said[n] && !kept[n]; });
    return !lost && after.score < before.score && after.stray.length <= before.stray.length && after.missingNums.length <= before.missingNums.length && (after.strict || []).length <= (before.strict || []).length && len >= 0.7 && len <= 1.8;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function showRepairNote(rep) {
    var el = document.getElementById("repairNote");
    if (!rep || rep.status === "none") { el.hidden = true; el.textContent = ""; return; }
    var parts = [];
    if (rep.status === "fixed") {
      var added = rep.before.dropped.length - rep.after.dropped.length + rep.before.missingNums.length - rep.after.missingNums.length + (rep.before.facts || []).length - (rep.after.facts || []).length;
      var removed = rep.before.stray.length - rep.after.stray.length;
      var eased = (rep.before.strict || []).length - (rep.after.strict || []).length;
      if (added > 0) parts.push("added " + plural(added, "detail you said", "details you said"));
      if (removed > 0) parts.push("removed " + plural(removed, "made-up number", "made-up numbers"));
      if (eased > 0) parts.push("took out " + plural(eased, "word that made it stricter than you said", "words that made it stricter than you said"));
      el.textContent = "\ud83d\udd27 Auto-fixed: " + (parts.join(" and ") || "tightened it up") + ". Tap X-ray to see.";
    } else {
      /* AGT-21 (v2.1.30): first-timers read "the fix wasn't better" as "something broke", so
         the line says it plainly. The reason why (Polish tried and kept the original) only
         shows with run stats or dev tools on. */
      el.textContent = "\ud83d\udc40 Your prompt is ready. We spotted " + plural(rep.before.score, "thing", "things") + " worth a quick look before you paste: tap X-ray to see " + (rep.before.score === 1 ? "it" : "them") + "." +
        (techOn() || core.dev ? " (Polish tried a fix, but " + (rep.status === "failed" ? "it didn't come through" : "it wasn't better") + ", so this is the original.)" : "");
    }
    el.hidden = false;
  }

  /* Number check (free, no Gemini request). The page compares the numbers in the
     prompt (times, money, versions like iOS 27) with what the person said. A writer
     that "corrects" a version it doesn't know (iOS 27 to iOS 18), drops a number, or
     invents one (a 400-word limit) gets flagged before the prompt is pasted anywhere.
     Small counts like "3 tips" are fine unless they follow a version word. */
  /* Your saved memory facts that went into this prompt count as things you said
     (so "iOS 27" from memory isn't a made-up number). */
  function withMem(answers) {
    var mem = (session && session.memFacts) || [];
    return (answers || []).concat(mem.map(function (f) { return { question: "Your saved memory", answer: f }; }));
  }
  function saidText() { return ownText() + (session.known ? "\n" + session.known : ""); }
  /* What you said for this prompt only: your thoughts, answers, and the memory facts picked for
     it. Picked context and your core are background (session.known): their numbers count as
     yours, but a skipped one is never "left out" (#3). */
  function ownText() { return session.raw + "\n" + withMem(session.answers).map(function (a) { return a.answer; }).join("\n"); }
  /* Number check: lib/numcheck.js (shared with the grader bench). */
  function numberIssues(promptText) { return numberIssuesFor(promptText, ownText(), session.known || ""); }
  function promptFlags(promptText) { return numberFlags(promptText, ownText(), session.today || new Date(), session.known || ""); }
  /* The Heads up note: made-up or missing numbers, and a weekday that doesn't match its date. */
  function showNumberCheck(promptText) {
    var el = document.getElementById("numWarn");
    var f = promptFlags(promptText), msg = flagText(f);
    el.hidden = !msg;
    el.textContent = msg ? "Heads up: this prompt " + msg + ". Check " + (f.dates.length && !f.extra.length && !f.missing.length ? "that date" : f.dates.length ? "those numbers and dates" : "those numbers") + " before you paste it." : "";
    return f;
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
    if (withPrompt && output.value) {
      /* A clear line between the record and the prompt, saying which one to paste. */
      out.push(""); out.push(md ? "---" : "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501");
      out.push("\ud83d\udc49 Which to use: paste only the Prompt Built part below into your AI. Everything above is your record and background. If anything above disagrees with the prompt, the prompt wins.");
      head("\ud83d\ude80 Prompt Built"); block(output.value);
    }
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
    var grade = run._grade;
    delete run._grade;
    /* Wait a few seconds for the quality grade, unless the page is going away. */
    if (grade && action !== "left the page") {
      var sent = false, send = function () { if (!sent) { sent = true; postRun(run); } };
      grade.then(send, send);
      setTimeout(send, 8000);
      return;
    }
    postRun(run);
  }
  function postRun(run) {
    if (run.outcome === "ok") lastSent = run;
    try {
      fetch(RELAY.replace(/\/+$/, "") + "/run", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: run }), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  /* 👍 Worked great (#5, v2.1.38): one tap under a finished prompt, only with run stats on, so
     reviews learn what works and not just what breaks. A yes on the run record, never words.
     Still waiting to be sent: it rides along. Already sent (you copied first): a tiny follow-up
     record goes out with the mode and the yes, marked so it never counts as a second run. */
  var lastSent = null;
  function workedGreat() {
    if (!testLog.on() || !session) return;
    testLog.mark("worked", true);
    if (pendingRun) { pendingRun.worked = true; return; }
    if (!RELAY || !lastSent) return;
    postRun({ app: lastSent.app, device: lastSent.device, mode: lastSent.mode, depth: lastSent.depth || null, write_model: lastSent.write_model || null, outcome: "thumbs up", worked: true });
    lastSent = null;
  }
  /* Stay-on-screen guard (#37, v2.1.38): closing or refreshing while a prompt is being written
     asks first (the browser's own Leave site? box). Only while it works, never when idle.
     Phones can't catch an app switch, so this mostly helps iPad keyboards and computers. */
  window.addEventListener("beforeunload", function (e) { if (busy && Date.now() - scLeaving > 3000) { e.preventDefault(); e.returnValue = ""; } });   /* #53: opening the shortcut is not leaving */

  /* Capture phase: noted before the button's own handler runs. */
  document.addEventListener("click", function (e) {
    if (!pendingRun || !e.target || !e.target.closest) return;
    var t = e.target;
    if (t.closest("#xrayBtn")) { pendingRun.xray_opened = true; return; }
    var ai = t.closest(".openai");
    var a = t.closest("#copy") ? "copied" : t.closest("#copyNote") ? "copied with note" : ai ? "opened " + ai.textContent.trim() : t.closest("#saveNote, #saveShare") ? "saved note" : t.closest("#glowSave") ? "saved glow-up"
      : t.closest("#reset") ? "started over" : t.closest("#reportSend, #reportIssue") ? "reported" : t.closest("#build, #dockBuild") ? "rebuilt" : "";
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
      if (core.dev) fr.push(["Memory", memory.active ? "on, " + memory.facts.length + " saved" : "off"]);
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
      ["Label fix", s.labelFix ? s.labelFix.status + ", " + s.labelFix.secs + "s" : ""],
      ["Sliders", SLIDERS.map(function (sl) { return sl.label + " " + starter.tune[sl.key]; }).join(", ")]
    ];
    if (core.dev) rows.push(["Core", core.active ? "on" : "off"]);
    if (core.dev) rows.push(["Memory", memory.active ? "on, " + memory.facts.length + " saved, " + ((session && session.memFacts) || []).length + " used" : "off"]);   /* counts only, never the facts */
    return rows;
  };
  testLog.init();
  loadTuning();
  loadLessons();
}
