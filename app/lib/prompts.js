/* The words Speak to Prompt sends to Gemini, and the no-key quick version. */

/* background (My context, dev tools): picked pieces go inside the prompt, just before the
   raw thoughts, so what you copy is one prompt with nothing tacked on after it. */
export function buildPrompt(raw, background) {
  const bg = background ? ["BACKGROUND I PICKED FOR THIS (use what helps, ignore the rest):", background, ""] : [];
  return [
    "I want help with something, but I'm not sure how to ask for it well. My raw thoughts are below, exactly as they came out. Please be my guide.",
    "",
    "Do these steps in order:",
    "",
    "1. Give this chat a short title (5 to 6 words, most specific word first). Write it as: TITLE: [title]",
    "",
    "2. Work out what I actually need: an answer, a plan, a decision, a piece of writing, ideas, or something else. If my thoughts are just a note or a meeting recap, tidy them into a clean summary with action items instead.",
    "",
    "3. If something important is missing (my goal, who this is for, limits like time or budget, or what the result should look like), ask me up to 3 short questions, one at a time, and wait for each answer. If nothing important is missing, skip this step.",
    "",
    "4. Rewrite my request as a clear, complete prompt. Use whatever helps: the expert you should act as, the background, the exact task, an example of a good result, the format, and the tone. Show it under the heading YOUR BETTER PROMPT so I can reuse it.",
    "",
    "5. Then follow that prompt and give me the result.",
    "",
    "Use plain, friendly language. Keep it practical.",
    "",
    ...bg,
    "MY RAW THOUGHTS:",
    "\"\"\"",
    raw,
    "\"\"\""
  ].join("\n");
}

/* Dev tools on: when a question asks what to build a web app with, offer Kevin's
   own stack as a choice. stack is the live label from the build ("Svelte 5 + Vite 8"). */
export function stackChoice(stack) { return 'Speak to Prompt stack (' + stack + ')'; }
export function withStackHint(analyze, stack) {
  return analyze.replace('RAW THOUGHTS:', 'If you ask which tech stack, framework, or tools to build a web app or site with, include "' + stackChoice(stack) + '" as the first choice.\n\nRAW THOUGHTS:');
}

/* Memory ("Tailored to you", dev tools on): the intake step sees what the person
   saved, skips questions it already answers, picks which facts matter, and can
   suggest up to 2 lasting facts to remember. numbered: "1. ...\n2. ..." or ''. */
export function withMemory(analyze, numbered) {
  const known = numbered
    ? 'WHAT I ALREADY KNOW ABOUT THIS PERSON (they saved these on their own phone):\n' + numbered + '\n' +
      'Never ask a question these already answer. In your JSON, also add "use_memory": the numbers of the facts that truly matter for this request (an empty list if none do).\n'
    : '';
  return analyze.replace('RAW THOUGHTS:', known +
    'Also add "remember": up to 2 short lasting facts about the person, stated in the raw thoughts, that would save them re-explaining next time (their devices, school, job, tools, or ongoing situation). First person, under 15 words each. Never health, money amounts, passwords, IDs, addresses, or facts about other people. Skip anything already known above. Use an empty list if nothing fits.\n\nRAW THOUGHTS:');
}

/* My context (dev tools): the question step sees the picked pieces too, so it never asks
   about something they already answer. */
export function withContext(analyze, block) {
  if (!block) return analyze;
  return analyze.replace('RAW THOUGHTS:', 'CONTEXT THE PERSON PICKED FOR THIS REQUEST (already known; never ask a question it answers, and never ask them to repeat it):\n' + block + '\n\nRAW THOUGHTS:');
}

/* Save as context (#50, v2.1.37): the Read call also says whether the raw thoughts hold
   reusable background worth saving as a My context piece. It rides the same call as one more
   JSON field (context_candidate), so the nudge costs no extra request. */
export function withCandidate(analyze) {
  return analyze.replace('RAW THOUGHTS:',
    'Also add "context_candidate" to your JSON. If the raw thoughts spend real effort explaining lasting background the person would otherwise have to explain again in a later request (who they are, their job or business, an ongoing project, their setup, tools, or a standing situation), set it to {"title": "a 2 to 5 word name for that background, like Bean N Bean roasting or My home network", "why": "one short plain line naming what they explained, written to them (for example: You explained how your roasting schedule works)"}. ' +
    'Set it to null when the request is a one-off (a single message, a quick question, a one-time event), when the background is only a sentence or two, or when the context they picked above already covers it.\n\nRAW THOUGHTS:');
}

/* Save as context, the guided interview (#50): after each answer one Flash-Lite call says
   which labeled parts are covered and asks the next question, or says it's done. No cap on
   questions (SPEC 11/08); Save what we have is always on screen. */
export const CTX_PARTS = [
  { key: 'what', label: 'What this is', ask: 'In a sentence or two, what is this? A project, your job, a setup, a routine, anything you keep explaining.' },
  { key: 'facts', label: 'Key facts', ask: 'What should an AI always know about it? Names, numbers, tools, how it works.' },
  { key: 'goals', label: 'Goals', ask: 'What are you usually trying to get done with it, or what does a good result look like?' },
  { key: 'changes', label: 'What changes often', ask: 'What changes often, so an AI should ask you instead of assuming? Say "nothing" if it stays the same.' },
  { key: 'leave', label: 'Leave out', ask: 'Anything an AI should leave out or never do here? Say "nothing" if not.' }
];
function ctxSaid(title, source, turns) {
  const out = ["TITLE: " + (title || "(none yet)"), "", "WHAT THEY SAID FIRST:", '"""', source || "(nothing yet)", '"""'];
  const t = (turns || []).filter((x) => x && x.q);
  out.push("", "QUESTIONS ASKED SO FAR, WITH THEIR ANSWERS:");
  out.push(t.length ? t.map((x) => "Q (" + x.part + "): " + x.q + "\nA: " + (x.a ? x.a : "(skipped, do not ask again)")).join("\n\n") : "None yet.");
  return out;
}
export function interviewPrompt(title, source, turns) {
  return [
    "CONTEXT INTERVIEW STEP. A person is saving reusable background (a \"context\") about one thing in their life or work, so they never have to explain it to an AI again. You interview them, one short question at a time.",
    "The saved context has five parts: what (what this is), facts (key facts: names, numbers, tools, how it works), goals (what they want from it or what good looks like), changes (what changes often, so an AI should ask instead of assuming), leave (what an AI should leave out or never do).",
    "1. Decide which parts their words already cover well enough that an AI would not need to ask.",
    "2. If something important is still missing, ask ONE short, plain, friendly question about the most important missing thing, and say which part it belongs to. Never ask about something they already said, never repeat a question, and never ask again about something they skipped.",
    "3. If nothing important is missing, you are done. Do not ask a question just to fill a part: changes and leave can stay empty when nothing suggests they matter.",
    "",
    'Respond with JSON only, in exactly this shape: {"covered": ["what", "facts"], "done": false, "part": "goals", "question": "the one short question"}. When done is true, question is an empty string.',
    ""
  ].concat(ctxSaid(title, source, turns)).join("\n");
}
/* The iron pass (#50): one Flash-Lite call turns everything they said into the labeled note.
   The phone checks it (no new numbers, under the cap, has its first label) and falls back to
   their own words under the same labels if it fails. */
export function ironPrompt(title, source, turns) {
  return [
    "CONTEXT IRON STEP. Turn what a person said below into one saved context note an AI can read before helping them.",
    "Use only facts they said. Never add a fact, a guess, advice, or a number they did not say. Keep every name, number, version, date, and amount exactly as they wrote it, and keep their hedges (maybe, around, I think).",
    "Write in first person, as them (I, my). Plain words, no filler, nothing said twice. Under 3,000 characters.",
    "Use exactly these labels, each starting its own line, in this order: What this is: / Key facts: / Goals: / What changes often: / Leave out:",
    "Key facts is a short list, one fact per line starting with \"- \". Leave a label out entirely when they said nothing for it (an answer like \"nothing\" or a skipped question means leave it out).",
    "Output only the note: no title line, no intro, no closing line, and no code fences.",
    ""
  ].concat(ctxSaid(title, source, turns)).join("\n");
}

/* My context squeeze: past the 1,500 token budget, one Flash-Lite call makes the picked
   pieces shorter for this build only. Facts stay, filler goes, nothing new comes in. */
export const SQUEEZE = [
  "CONTEXT SQUEEZE STEP. Below is background a person saved and picked for one request. It is too long for the budget.",
  "Rewrite it in under 1,000 words. Keep every concrete fact: names, numbers, dates, times, places, prices, amounts, rules, limits, and preferences, in the person's own words where you can.",
  "Drop repetition, filler, side stories, and anything said twice. Never add a fact, a guess, or advice.",
  "Keep each piece under its [Title] line, in the same order. Plain text only: no intro, no closing line, no note about what you cut.",
  "",
  "BACKGROUND:"
].join("\n");

export const ANALYZE = [
  "You are the intake step of a prompt-building tool for people who are new to AI.",
  "Read the person's raw thoughts below. They may be a messy voice transcript.",
  "1. Work out what they actually need: an answer, a plan, a decision, a piece of writing, ideas, or something else. If the thoughts are just a note or a meeting recap, the need is a clean summary with action items.",
  "2. Decide what is missing that would most improve the final result: their goal, who it is for, limits like time or budget, what a great result looks like, or key facts.",
  "   If the right answer depends on their devices, device models, software or app versions, or accounts and they did not say, ask about it in one question with likely choices to tap (for example: \"Which devices and software versions?\" with choices like \"iPhone, iPad, Mac on the latest versions\").",
  "   If they are setting something up that turns on or changes things and it is unclear whether it should also turn off or undo later, you may ask that too.",
  "3. Ask only questions whose answers would clearly change the result. Match the number to the request: none if nothing important is missing, usually 1 to 3, and up to 5 only for complex requests with many moving parts. Put the most important question first. Never ask about something they already said.",
  "Each question must be short, plain, friendly, and about one thing. Give 2 to 4 short, likely answers they can tap.",
  "",
  "Respond with JSON only, in exactly this shape:",
  '{"title": "5 to 6 word chat title, most specific word first, no filler words", "need": "one plain sentence naming their real goal with the key specifics they gave, like who it is for, how many, and the budget (for example: Plan a game night for 10 first-timers under $90). Start with a verb. Never write they want or the user, and add nothing they did not say", "category": "a 1 or 2 word category for this recording, Title Case, general enough to reuse as a Voice Memos folder for similar recordings (for example Shortcuts, School, Work, Fitness, Ideas)", "complexity": "simple, standard, or complex (simple = a short answer or small task; standard = a typical multi-part request; complex = many moving parts, multi-step setups across devices or tools, plans, or deep analysis)", "questions": [{"question": "...", "choices": ["...", "..."]}], "note": {"headline": "short descriptive heading for a saved note (every note field is written in first person, as if the person wrote it themselves: I want, I need, my budget; never the user, they, or the person)", "tags": ["3 to 5 lowercase single-word tags"], "summary": "2 or 3 plain sentences in first person (for example: I want to start meal prepping on Sundays to save money)", "key_ideas": ["..."], "action_items": ["clear next steps they mentioned or clearly implied"], "unknowns": ["open questions they raised"]}, "shape": {"success": "one plain line on what a great result would look like for them, judged by what they said (a suggestion, never a new requirement, never stricter or more safety-minded than they said)", "format": "a fitting format and length for the answer, in words, fitted to this request (for example: a short numbered plan, about one screen)"}}',
  "",
  "RAW THOUGHTS:",
  '"""'
].join("\n");

/* Prep crew (v2.1.18): a second Flash-Lite model cleans the raw thoughts while the intake
   reads them, so Flash writes from clean words. The phone checks the result (numbers kept,
   length close) and uses the raw words if it fails. Plain text only. */
export const CLEAN = [
  "CLEAN STEP. Below are a person's raw thoughts, often a messy voice transcript. Rewrite them as clean, readable text for a prompt writer.",
  "Remove filler words and fillers like um, uh, like, you know, I mean, so yeah, lol, lmao, haha, and sign-offs like \"ok that's it\", plus false starts, stutters, and accidental repeats. Fix an obvious transcription slip only when the meaning is certain.",
  "Keep everything else, in their own words and order: every fact, name, number, version, date, time, price, amount, limit, preference, question, and side note. Keep every number exactly as written, as digits, even if it looks odd.",
  "Keep their hedges and doubts (maybe, probably, I think, around, not sure) and every request they make, as they said it.",
  "Never add facts, guesses, advice, headings, or bullet points. Never answer their question and never summarize.",
  "Write in first person, as them. Plain text only: no intro, no closing line, no note about what you changed.",
  "",
  "RAW THOUGHTS:",
  '"""'
].join("\n");

/* Fact ledger (v2.1.20, #44): a Flash-Lite model lists what the prompt must keep while the
   intake and the clean step run. Flash gets it as a must-include list, and the phone checks
   the finished prompt against it for free. The phone drops any item the raw words don't back. */
export const LEDGER = [
  "LEDGER STEP. Below are a person's raw thoughts. List every item a prompt built from them must keep so nothing they said gets lost.",
  "Include facts, names, places, numbers, dates, times, amounts, versions, limits, preferences, things to avoid, and each thing they ask for. Keep a hedge with its item (for example: budget maybe $60).",
  "One item per line, starting with \"- \". Each item is a short, clean fact in plain English, under 12 words: no filler, no \"lol\", and words from another language put in English. Keep every number, name, address, code, and link exactly as they wrote it.",
  "At most 12 items, the most important first. Skip filler, feelings, and small talk. Never add anything they did not say, and never make a preference stronger than they said. No intro and no closing line.",
  "",
  "RAW THOUGHTS:",
  '"""'
].join("\n");

/* Stand-in AI test (v2.1.20, #45): a Flash-Lite model plays the AI that will receive the
   prompt and lists what it would still have to ask or guess. Answered gaps get filled from
   the person's own words; the rest are shown to the person. */
export const STANDIN = [
  "STAND-IN TEST. You are the AI assistant that will receive the prompt below from a person. Before you start, list what you would still have to ask them, or would have to guess, to do an excellent job.",
  "Only real gaps that would clearly change your answer. Not style choices, not things the prompt already says, and not things a good assistant can sensibly decide on its own.",
  "At most 4. If you could start right away and do an excellent job, return an empty list.",
  'Respond with JSON only, in exactly this shape: {"gaps": [{"question": "the short question you would ask them"}]}',
  "",
  "PROMPT YOU RECEIVED:",
  '"""'
].join("\n");
export function gapFillPrompt(prompt, gaps, raw, answers) {
  const out = [
    "You are improving a prompt by adding a few short lines. Keep every existing line exactly as written, word for word, in the same order. Do not reword, merge, or remove anything.",
    "An AI reading this prompt said it would still need to know the things below. For each one, look in the person's raw thoughts and answers. If they already said it, add one short line with that fact, in their meaning, where it fits. If they did not say it, skip it: never guess or invent.",
    "Do not add numbers, people, devices, or requirements they did not say. If none of these are answered below, return the prompt unchanged. Output only the full prompt: no title, no commentary, and no code fences.",
    "",
    "GAPS AN AI FOUND:"
  ];
  gaps.forEach((g, i) => out.push((i + 1) + ". " + g));
  out.push("", "RAW THOUGHTS:", '"""', raw, '"""');
  const a = (answers || []).filter((x) => x && x.answer);
  if (a.length) out.push("", "ANSWERS TO FOLLOW-UP QUESTIONS:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n\n"));
  out.push("", "PROMPT TO IMPROVE:", '"""', prompt, '"""');
  return out.join("\n");
}

export const WRITE = [
  "You are a world-class prompt engineer. Turn a person's raw thoughts and their answers into one complete, ready-to-paste prompt for any AI assistant, such as ChatGPT, Claude, or Gemini.",
  "Build the prompt from whichever of these help: the expert role the AI should take; the full background and context; the exact task; one line on what a great result looks like (how the person will judge it); an example of a good result, only if it removes ambiguity; the format and length of the response; and the tone.",
  "Keep every relevant detail from the thoughts and answers: facts, names, numbers, dates, limits, and preferences. Drop filler, repetition, and false starts.",
  "Never add devices, people, facts, or requirements they did not mention or confirm.",
  "An answer marked (tapped from suggested options) is the closest of a few preset choices, not their own words, so treat it as approximate. If it conflicts with, narrows, or shifts the goal stated in the raw thoughts, follow the raw thoughts and use the tapped answer only where it fits. Typed answers are their own words.",
  "Keep every number, version, and product name exactly as they said it, even if you don't recognize it. Newer versions may exist that you don't know about, so never swap in a different version or round a number.",
  "Keep their hedges. If they said maybe, probably, I think, around, or not sure, keep that doubt in the prompt instead of turning it into a fact.",
  "Write dates and times the way they said them. Never add a year, a weekday, a month, or a time they didn't say, and add no extra words to them. If a weekday and a date they gave don't match, keep both as they said them and ask the AI to check which one they meant, instead of picking one.",
  "Don't make their preferences stronger than they said. No strictly, absolutely, always, or must unless they used that word.",
  "Keep the full scope of what they want. Do not narrow it. When it helps them succeed, ask the AI to also cover how it works, the steps, and known limits or troubleshooting.",
  "Write it in first person, as the person talking to the AI. If the thoughts are a note or a meeting recap, the task is a clean summary with action items.",
  "Only if the person raised several separate goals or ideas and it is unclear which to pursue first, end the prompt by asking the AI to lay those goals out as numbered options, each with 2 to 4 sentences on what it would produce, then wait for the person to choose. Different ways to reach one goal are not separate goals: in that case, ask the AI to recommend the best approach, briefly say why, and carry it out. Otherwise, end the prompt by telling the AI to start right away, and to ask at most one short question only if something essential is still missing.",
  "Before you finish, check once that every key fact is kept, the task is unmistakable, the format is stated, and what a great result looks like is stated. Do not show this check.",
  "Output only the prompt itself. No title, no preamble, no commentary, and no code fences. Simple labels such as Context: and Task: are fine."
].join("\n");

/* Short writer text for the Shortcut stand-in (#53, v2.1.41, dev tools only). Apple's models
   lost details under the full WRITE rules (first test 11/12: Cloud dropped the date, the budget,
   and three preferences), so the shortcut gets a short version: six plain rules, the notes, the
   answers, and the must-keep list last, where a small model reads it right before writing.
   One to one with what Flash gets (Kevin, 11/12: "I wanted everything to be a one to one fit"):
   lessons, your core, memory, and picked My context all ride along, each in a compact form.
   Only Rework is left out (round 2 stays on Gemini). Flash never gets this text. */
export function shortWriteText(o) {
  const out = [
    "Rewrite my notes below into one clear prompt that I can paste into an AI assistant such as ChatGPT, Claude, or Gemini.",
    "",
    "Rules:",
    "1. Write it as me, in first person.",
    "2. Use these labels, each on its own line, in this order: Role: (the expert the AI should be), Context: (my situation), Task: (exactly what I want), Limits: (every limit, like, and dislike I gave), A great answer: (how I will judge it), Format: (the shape and length of the answer).",
    "3. Keep every name, number, date, limit, like, and dislike from my notes and answers. Write numbers as digits, exactly as I gave them (like $75 or the 14th). Keep words like maybe and around.",
    "4. Add nothing I did not say: no new facts, people, devices, or rules.",
    "5. End with this line: Start right away, and ask at most one short question only if something essential is missing.",
    "6. Output only the prompt. No title, no intro, no closing words, no code fences."
  ];
  const ls = (o.lessons || []).filter(Boolean);
  if (ls.length) out.push("", "Extra rules learned from earlier prompts (follow them when they fit; what I said always wins):", ...ls.map((l) => "- " + l));
  if (o.core) out.push("", "ABOUT ME (my standing background: who I am, how I like answers, and the role I want the AI to take. Use it to shape the prompt where it fits this request, in plain words. Never paste it in as a block, and never let it push out a detail from my notes):", o.core);
  const mem = (o.memory || []).filter(Boolean);
  if (mem.length) out.push("", "FACTS I SAVED ABOUT MYSELF (they matter for this request; work them in where they help):", ...mem.map((m) => "- " + m));
  out.push("", "MY NOTES:", '"""', o.raw || "", '"""');
  const a = (o.answers || []).filter((x) => x && x.answer);
  if (a.length) out.push("", "MY ANSWERS TO FOLLOW-UP QUESTIONS:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n"));
  if (o.goal) out.push("", "MY GOAL IN ONE LINE (aim the prompt at it; it adds no facts): " + o.goal);
  const sh = o.shape || {};
  if (sh.success || sh.format) out.push("", "ONLY IF I DID NOT SAY (suggestions, my own words win):" + (sh.success ? "\nA great answer: " + sh.success : "") + (sh.format ? "\nFormat: " + sh.format : ""));
  if (o.context) out.push("", "BACKGROUND I PICKED (use only the facts this request needs, in plain words; never paste it in as a block):", o.context);
  if (o.today) out.push("", "TODAY IS " + o.today + ". Use it only to count days. Never add a year, weekday, or month to a date I gave.");
  const items = o.items || [];
  if (items.length) out.push("", "MUST KEEP (every item below has to be in the prompt, in a clean sentence):", ...items.map((i) => "- " + i));
  out.push("", "Now write the prompt.");
  return out.join("\n");
}

/* Lessons learned: short, general rules the twice-daily review writes into
   lessons.json from graded runs and stress tests. They never hold anyone's words,
   only how to write better prompts. Added to WRITE so every run uses them. */
/* Today's date from the phone, so plans with relative days ("by Friday") count
   from the real day instead of a guess. The grader sees it too, as known. */
export function todayText(d) {
  try { return (d || new Date()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
}
export function withToday(write, today) {
  if (!today) return write;
  return write + "\n\nTODAY: " + today + " (the person's own date). Use it only to work out which days are left or how far away a date is. Never guess a different day. Never copy its year, weekday, or month onto a date the person gave. Only say what day it is if the plan depends on it.";
}
export function withLessons(write, lessons) {
  if (!lessons || !lessons.length) return write;
  return write + "\n\nLESSONS FROM REVIEWS OF EARLIER PROMPTS (general rules this tool has learned; follow them when they fit this request, and never let one override what the person actually said):\n- " + lessons.join("\n- ");
}

/* Quality grade (run stats on): a second opinion on the finished prompt from the
   fast model, in the background after the prompt is shown. It answers only with
   a score and fixed labels (and lesson ids), so the run log never holds anyone's words.
   Scores are 1.00 to 5.00 (two decimals); GRADE_PASS is the bar a prompt must reach. */
export const GRADE_MISSING = ['role', 'task', 'context', 'format', 'success', 'constraints', 'steps', 'ending'];
export const GRADE_PASS = 4.5;
export function gradePrompt(prompt, raw, answers, calibration, lessons, today) {
  const ls = (lessons || []).filter((l) => l && l.id && l.text);
  const out = [
    "You are a strict senior prompt engineer reviewing one prompt written by a prompt-building tool. Compare the person's raw thoughts with the prompt to grade. Judge how well the prompt sets an AI up to give this person a great result, not how long it is or how polite it sounds. Be hard to impress: most decent prompts land in the 3s or low 4s.",
    "",
    "missing: go through every label and list each one that is weak or absent: role (who the AI should be, stated up front, not buried inside the task), task (an unmistakable job), context (background the AI needs), format (the shape of the answer, such as a table, list, steps, or sections, AND roughly how long), success (what a great result looks like, or how the person will judge it), constraints (limits and hard noes the person gave; if they gave none, constraints is not missing), steps (how-to or troubleshooting, only when the request needs one; otherwise steps is not missing), ending (a clear start-now or pick-an-option ending). A prompt that never says how long or what shape the answer should be is missing format. A label that doesn't apply to this request is never missing. Use an empty list only if every label that applies is clearly covered.",
    "rearranged: true if most of the prompt is the person's own sentences reordered or relabeled, instead of clear instructions written for the AI.",
    "invented: true if it adds facts, people, devices, numbers, or requirements the person never said or confirmed. Correct math on their own numbers (a total, what is left, a split) and unit conversions are fine.",
    "broke: the id of every lesson below that the prompt breaks (an empty list if it breaks none, or if there are no lessons). A lesson that doesn't apply to this request is not broken.",
    "craft, 1.00 to 5.00 with two decimals (like 3.77 or 4.62), decided after the labels above. The band comes from the labels; the decimals say how strong it is inside its band: 1.00 to 1.99 = their sentences moved around under labels, with no real instructions; 2.00 to 2.99 = mostly their words reorganized, with a vague task; 3.00 to 3.99 = clear and usable, but two or more labels are weak or missing; 4.00 to 4.49 = strong but held back: one weak or missing label, a broken lesson, or lines that could be sharper; 4.50 to 4.99 = passes: nothing in missing, nothing in broke, nothing rearranged, nothing invented, and every line earns its place; 5.00 = flawless, very rare. Never give 4.50 or more if missing or broke has anything in it.",
    "",
    'Respond with JSON only, in exactly this shape: {"missing": ["format"], "broke": [], "rearranged": false, "invented": false, "craft": 4.12}'
  ];
  if (ls.length) out.push("", "LESSONS LEARNED (rules from reviews of earlier prompts; each one is a thing a good prompt must not get wrong. List the id of any the prompt breaks in broke):", ...ls.map((l) => "- " + l.id + ": " + l.text));
  const cal = (calibration || []).filter(Boolean);
  if (cal.length) out.push("", "CALIBRATION FROM CLAUDE'S REVIEWS OF YOUR PAST GRADES (you graded these kinds of prompts wrong before; follow these):", ...cal.map((c) => "- " + c));
  if (today) out.push("", "TODAY'S DATE (from the person's phone; the prompt may use it, and it counts as something they said): " + today);
  out.push("", "PERSON'S RAW THOUGHTS:", '"""', raw, '"""');
  const a = (answers || []).filter((x) => x && x.answer);
  if (a.length) out.push("", "THEIR ANSWERS TO FOLLOW-UP QUESTIONS:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n\n"));
  out.push("", "PROMPT TO GRADE:", '"""', prompt, '"""');
  return out.join("\n");
}

/* The same caps the page applies after the model answers, so a soft score can't
   slip through: each missing label costs a point (one missing tops out at 4.00),
   a broken lesson caps at 4.40 and each more costs half a point, rearranged caps
   at 2, invented at 3. Kept to the nearest hundredth. */
export function capGrade(craft, missing, rearranged, invented, broke) {
  let g = Math.max(1, Math.min(5, Number(craft)));
  const miss = (missing || []).length, nb = (broke || []).length;
  if (miss) g = Math.min(g, Math.max(1, 5 - miss));
  if (nb) g = Math.min(g, Math.max(1, 4.9 - 0.5 * nb));
  if (rearranged) g = Math.min(g, 2);
  if (invented) g = Math.min(g, 3);
  return Math.round(g * 100) / 100;
}
/* How the page shows a grade: the nearest tenth for the scale, plus the exact
   hundredths when they differ (so a 4.47 that shows as 4.5 can't look like a pass). */
export function gradeLabel(g) {
  const tenth = (Math.round(g * 10) / 10).toFixed(1), exact = g.toFixed(2);
  return tenth + " of 5" + (Number(tenth) === Number(exact) ? "" : " (" + exact + ")");
}

/* Label fix: when the quality grade is under the bar and something missing is a
   label the app can add on its own (how long, what a great result looks like, the
   person's limits, how-to steps, or a start-now ending), one small call adds just
   those lines. The page checks nothing else changed, grades it again, and keeps it
   only if the grade went up. Up to two tries. */
export const LABEL_FIXES = ['format', 'success', 'constraints', 'steps', 'ending'];
export const LABEL_NAMES = { role: 'who the AI is', task: 'the exact job', context: 'background', format: 'how long and what shape', success: 'what a great result looks like', constraints: 'your limits', steps: 'how-to steps', ending: 'a start-now ending' };
export function labelFixPrompt(prompt, missing, raw, answers) {
  const out = ["You are finishing a prompt by adding a few short lines. Keep every existing line exactly as written, word for word, in the same order. Do not reword, merge, or remove anything."];
  if (missing.includes('success')) out.push("", "- Add one new line, after the task, saying what a great result looks like for this request, so the AI knows how it will be judged (for example: A great answer is one I can follow tonight without looking anything else up). Use only what the prompt and the person already said.");
  if (missing.includes('constraints')) out.push("", "- Add one new line listing the limits the person gave in their raw thoughts or answers below (such as budget, time, or things to avoid), in their meaning. Only limits they actually said; if they gave none, skip this.");
  if (missing.includes('steps')) out.push("", "- Add one new line asking the AI to give clear numbered how-to steps, plus a quick fix for anything likely to go wrong.");
  if (missing.includes('format')) out.push("", "- Add one new line, just before the closing line, saying roughly how long the answer should be and what shape it takes, fitted to this request (for example: Keep it to about one screen, with short bullets instead of long paragraphs). Say the length in words, not new numbers.");
  if (missing.includes('ending')) out.push("", "- Add one closing line at the very end telling the AI to start right away, and to ask at most one short question only if something essential is missing.");
  out.push("", "Do not add facts, people, numbers, or requirements. Output only the full prompt: no title, no commentary, and no code fences.");
  if (missing.includes('constraints') && raw) {
    out.push("", "PERSON'S RAW THOUGHTS (only to find their limits):", '"""', raw, '"""');
    const a = (answers || []).filter((x) => x && x.answer);
    if (a.length) out.push("", "THEIR ANSWERS:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n\n"));
  }
  out.push("", "PROMPT TO FINISH:", '"""', prompt, '"""');
  return out.join("\n");
}

/* Auto-Repair: one small, targeted fix when the phone's checks (X-ray and the
   number check) find details that were left out or numbers nobody said. It never
   rewrites the whole prompt; the page rechecks the result and keeps the original
   if the fix isn't better. */
/* A short reaction or feeling ("this sounds like a lot of work honestly") is not a
   detail the AI needs. Auto-Repair skips these so it never pastes them in. */
const ASIDE = /\b(honestly|tbh|lol|lmao|haha|ugh|sorry|sounds like a lot|that's a lot|this is a lot|kind of a pain|kinda a pain|so annoying|kinda annoying|i'm tired of|i guess|that'?s it|what else)\b/i;   /* sign-offs like "I think that's it" too (flow bench run 1) */
export function isAside(text) {
  const t = String(text || "").trim();
  return t.split(/\s+/).length <= 10 && ASIDE.test(t);
}
export function repairPrompt(prompt, raw, answers, problems) {
  const out = ["You are fixing a prompt that was written from a person's raw thoughts. Make only the fixes listed below. Keep everything else exactly as written, word for word, in the same order and format."];
  let n = 1;
  if (problems.dropped.length) {
    out.push("", n++ + ". These things the person said are missing. Add each one where it fits naturally, rewritten as a clean line in plain English: no filler, no \"lol\" or \"um\", no sign-offs like \"I think that's it\", and words from another language put in English. Never paste their raw sentence in. If one is clearly small talk, a feeling, or a reaction (how they feel about the work), or doesn't matter to the request, skip it. Never paste feelings and reactions in:");
    problems.dropped.forEach((d) => out.push('- "' + d + '"'));
  }
  if (problems.stray.length) {
    out.push("", n++ + ". These numbers are in the prompt but the person never said them: " + problems.stray.join(", ") + ". Remove them. If the idea still matters, say it in words without a number, and never leave a sentence unfinished or a blank where the number was.");
  }
  if (problems.strict && problems.strict.length) {
    out.push("", n++ + ". These words make the person's preference stricter, safer, or more medical than they said: " + problems.strict.join(", ") + ". Take them out and say the preference at the strength they said it (for example \"Dana is gluten-free, so I need dishes she can eat\"). Remove any safety tips or rules they didn't ask for, and never leave a sentence unfinished.");
  }
  if (problems.missingNums.length) {
    out.push("", n++ + ". These numbers the person said are missing. Put each one back exactly as written: " + problems.missingNums.join(", ") + ".");
  }
  out.push("", "Keep every number, version, and product name exactly as the person said it. Do not add anything else. Output only the fixed prompt: no title, no commentary, and no code fences.");
  out.push("", "RAW THOUGHTS:", '"""', raw, '"""');
  const a = (answers || []).filter((x) => x && x.answer);
  if (a.length) out.push("", "ANSWERS TO FOLLOW-UP QUESTIONS:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n\n"));
  out.push("", "PROMPT TO FIX:", '"""', prompt, '"""');
  return out.join("\n");
}

/* Clarity mirror (AGT-13, v2.1.29): the one-line goal shown above the questions.
   Edited = the person rewrote it, so it's their own words and sets the aim.
   Kept = they saw the Read step's line and left it, so it's a confirmed aim, but
   their raw thoughts still win on any detail. */
export function goalText(goal) {
  const t = goal && String(goal.text || "").trim();
  if (!t) return "";
  return goal.edited
    ? "\n\nTHE PERSON'S GOAL, IN THEIR OWN WORDS (they corrected an earlier step's read of what they want, so this is what the prompt must aim at. Facts and details still come from the raw thoughts and answers; never add anything the goal doesn't say):\n" + t
    : "\n\nTHE GOAL THE PERSON CONFIRMED (an earlier step's one-line read of what they want; they saw it and left it as is. Aim the prompt at it, but their raw thoughts and answers win on every detail, and it never adds a fact):\n" + t;
}

/* Ask me, then rewrite (v2.1.39, idea mwct7axlrttc): the Quality check tip used to say "add
   that to your note and build again". Now one Flash-Lite call turns each weak spot into one
   short question with answers to tap (typing your own always works), and the answers build
   the next Rework round. TIP_FALLBACK is the phone's own question per weak spot, used when
   the call fails or leaves one out, so the button never dead-ends. */
export const TIP_FALLBACK = {
  role: { question: 'Who should the AI act as for this?', choices: ['An expert in this topic', 'A patient teacher', 'A straight-talking coach'] },
  task: { question: 'What is the one thing you want the AI to do?', choices: ['Give me a plan', 'Write it for me', 'Help me decide', 'Explain it simply'] },
  context: { question: 'What background should the AI know first?', choices: ["I'm new to this", "I've tried and got stuck", 'It is for someone else'] },
  format: { question: 'How long should the answer be, and in what shape?', choices: ['Short bullets, one screen', 'Numbered steps', 'A table', 'A few short paragraphs'] },
  success: { question: 'What would make the answer great for you?', choices: ['I can act on it today', 'Simple enough for a beginner', 'It covers every detail'] },
  constraints: { question: 'Any limits the AI should stick to?', choices: ['Keep it cheap or free', 'Keep it quick', 'No limits'] },
  steps: { question: 'Do you want how-to steps?', choices: ['Yes, numbered steps', 'Yes, with fixes if something goes wrong', 'No, just the answer'] },
  ending: { question: 'Should the AI start right away or check with you first?', choices: ['Start right away', 'Ask me one question first'] },
  detail: { question: 'What detail would make this fit you better?', choices: ['Who it is for', 'My deadline', 'What I have tried already'] }
};
export const TIP_MAX = 3;
export function tipQuestionsPrompt(prompt, weak, raw, answers) {
  const out = [
    "TIP QUESTIONS STEP. A prompt-building tool wrote the prompt below from a beginner's raw thoughts, and a reviewer found weak spots. Write one short question for each weak spot, so the person's answers can fix it.",
    "Each question is plain, friendly, about one thing, under 14 words, and fitted to this request (never generic). Give 2 to 4 short, likely answers to tap, fitted to this request, under 8 words each. Never ask about something the raw thoughts or answers already say. Never put a fact, number, or name in a choice unless the person said it.",
    "",
    "WEAK SPOTS (use these ids):"
  ];
  weak.forEach((w) => out.push("- " + w + ": " + (w === 'detail' ? 'the prompt could be sharper and more specific' : 'the prompt is weak on ' + (LABEL_NAMES[w] || w))));
  out.push("", "Respond with JSON only, in exactly this shape:", '{"questions": [{"id": "the weak spot id", "question": "the question", "choices": ["a likely answer", "another"]}]}',
    "", "RAW THOUGHTS:", '"""', raw, '"""');
  const a = (answers || []).filter((x) => x && x.answer);
  if (a.length) out.push("", "THEIR ANSWERS SO FAR:", a.map((x) => "Q: " + x.question + "\nA: " + x.answer).join("\n\n"));
  out.push("", "PROMPT:", '"""', prompt, '"""');
  return out.join("\n");
}
/* One question per weak spot, in order: the model's when it gave a usable one, else the phone's. */
export function tipQuestions(weak, text) {
  let got = [];
  try {
    const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    const d = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
    got = Array.isArray(d.questions) ? d.questions : [];
  } catch (e) { got = []; }
  const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  return weak.slice(0, TIP_MAX).map((w) => {
    const m = got.find((q) => q && String(q.id || '').toLowerCase().trim() === w);
    const question = m ? clean(m.question, 160) : '';
    const choices = m && Array.isArray(m.choices) ? m.choices.map((c) => clean(c, 60)).filter(Boolean).filter((c, i, arr) => arr.indexOf(c) === i).slice(0, 4) : [];
    const fb = TIP_FALLBACK[w] || TIP_FALLBACK.detail;
    return question && choices.length >= 2 ? { question, choices, weak: w, from: 'ai' } : { question: fb.question, choices: fb.choices.slice(), weak: w, from: 'phone' };
  });
}
