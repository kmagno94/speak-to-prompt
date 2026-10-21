/* The words Speak to Prompt sends to Gemini, and the no-key quick version. */

export function buildPrompt(raw) {
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
  '{"title": "5 to 6 word chat title, most specific word first, no filler words", "need": "one plain sentence describing what they need", "category": "a 1 or 2 word category for this recording, Title Case, general enough to reuse as a Voice Memos folder for similar recordings (for example Shortcuts, School, Work, Fitness, Ideas)", "complexity": "simple, standard, or complex (simple = a short answer or small task; standard = a typical multi-part request; complex = many moving parts, multi-step setups across devices or tools, plans, or deep analysis)", "questions": [{"question": "...", "choices": ["...", "..."]}], "note": {"headline": "short descriptive heading for a saved note (every note field is written in first person, as if the person wrote it themselves: I want, I need, my budget; never the user, they, or the person)", "tags": ["3 to 5 lowercase single-word tags"], "summary": "2 or 3 plain sentences in first person (for example: I want to start meal prepping on Sundays to save money)", "key_ideas": ["..."], "action_items": ["clear next steps they mentioned or clearly implied"], "unknowns": ["open questions they raised"], "clean_transcript": "their raw thoughts, lightly cleaned: remove filler words, false starts and accidental repeats, keep their wording and every detail"}}',
  "",
  "RAW THOUGHTS:",
  '"""'
].join("\n");

export const WRITE = [
  "You are a world-class prompt engineer. Turn a person's raw thoughts and their answers into one complete, ready-to-paste prompt for any AI assistant, such as ChatGPT, Claude, or Gemini.",
  "Build the prompt from whichever of these help: the expert role the AI should take; the full background and context; the exact task; an example of a good result, only if it removes ambiguity; the format and length of the response; and the tone.",
  "Keep every relevant detail from the thoughts and answers: facts, names, numbers, dates, limits, and preferences. Drop filler, repetition, and false starts.",
  "Never add devices, people, facts, or requirements they did not mention or confirm.",
  "An answer marked (tapped from suggested options) is the closest of a few preset choices, not their own words, so treat it as approximate. If it conflicts with, narrows, or shifts the goal stated in the raw thoughts, follow the raw thoughts and use the tapped answer only where it fits. Typed answers are their own words.",
  "Keep every number, version, and product name exactly as they said it, even if you don't recognize it. Newer versions may exist that you don't know about, so never swap in a different version or round a number.",
  "Keep the full scope of what they want. Do not narrow it. When it helps them succeed, ask the AI to also cover how it works, the steps, and known limits or troubleshooting.",
  "Write it in first person, as the person talking to the AI. If the thoughts are a note or a meeting recap, the task is a clean summary with action items.",
  "Only if the person raised several separate goals or ideas and it is unclear which to pursue first, end the prompt by asking the AI to lay those goals out as numbered options, each with 2 to 4 sentences on what it would produce, then wait for the person to choose. Different ways to reach one goal are not separate goals: in that case, ask the AI to recommend the best approach, briefly say why, and carry it out. Otherwise, end the prompt by telling the AI to start right away, and to ask at most one short question only if something essential is still missing.",
  "Before you finish, check once that every key fact is kept, the task is unmistakable, and the format is stated. Do not show this check.",
  "Output only the prompt itself. No title, no preamble, no commentary, and no code fences. Simple labels such as Context: and Task: are fine."
].join("\n");

/* Lessons learned: short, general rules the twice-daily review writes into
   lessons.json from graded runs and stress tests. They never hold anyone's words,
   only how to write better prompts. Added to WRITE so every run uses them. */
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
export function gradePrompt(prompt, raw, answers, calibration, lessons) {
  const ls = (lessons || []).filter((l) => l && l.id && l.text);
  const out = [
    "You are a strict senior prompt engineer reviewing one prompt written by a prompt-building tool. Compare the person's raw thoughts with the prompt to grade. Judge how well the prompt sets an AI up to give this person a great result, not how long it is or how polite it sounds. Be hard to impress: most decent prompts land in the 3s or low 4s.",
    "",
    "missing: go through every label and list each one that is weak or absent: role (who the AI should be, stated up front, not buried inside the task), task (an unmistakable job), context (background the AI needs), format (the shape of the answer, such as a table, list, steps, or sections, AND roughly how long), success (what a great result looks like, or how the person will judge it), constraints (limits and hard noes the person gave), steps (how-to or troubleshooting the person needs), ending (a clear start-now or pick-an-option ending). A prompt that never says how long or what shape the answer should be is missing format. Use an empty list only if every label is clearly covered.",
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

/* Label fix: when the quality grade is under the bar and the only thing missing is
   a label the app can add on its own (how long the answer should be, or a start-now
   ending), one small call adds just that line. The page checks nothing else
   changed, grades it again, and keeps it only if the grade went up. */
export const LABEL_FIXES = ['format', 'ending'];
export function labelFixPrompt(prompt, missing) {
  const out = ["You are finishing a prompt by adding one or two short lines. Keep every existing line exactly as written, word for word, in the same order. Do not reword, merge, or remove anything."];
  if (missing.includes('format')) out.push("", "- Add one new line, just before the closing line, saying roughly how long the answer should be and what shape it takes, fitted to this request (for example: Keep it to about one screen, with short bullets instead of long paragraphs). Say the length in words, not new numbers.");
  if (missing.includes('ending')) out.push("", "- Add one closing line at the very end telling the AI to start right away, and to ask at most one short question only if something essential is missing.");
  out.push("", "Do not add facts, people, numbers, or requirements. Output only the full prompt: no title, no commentary, and no code fences.");
  out.push("", "PROMPT TO FINISH:", '"""', prompt, '"""');
  return out.join("\n");
}

/* Auto-Repair: one small, targeted fix when the phone's checks (X-ray and the
   number check) find details that were left out or numbers nobody said. It never
   rewrites the whole prompt; the page rechecks the result and keeps the original
   if the fix isn't better. */
/* A short reaction or feeling ("this sounds like a lot of work honestly") is not a
   detail the AI needs. Auto-Repair skips these so it never pastes them in. */
const ASIDE = /\b(honestly|tbh|lol|lmao|haha|ugh|sounds like a lot|that's a lot|this is a lot|kind of a pain|kinda a pain|so annoying|kinda annoying|i'm tired of|i guess)\b/i;
export function isAside(text) {
  const t = String(text || "").trim();
  return t.split(/\s+/).length <= 10 && ASIDE.test(t);
}
export function repairPrompt(prompt, raw, answers, problems) {
  const out = ["You are fixing a prompt that was written from a person's raw thoughts. Make only the fixes listed below. Keep everything else exactly as written, word for word, in the same order and format."];
  let n = 1;
  if (problems.dropped.length) {
    out.push("", n++ + ". These things the person said are missing. Add each one where it fits naturally, in the person's meaning. If one is clearly small talk, a feeling, or a reaction (how they feel about the work), or doesn't matter to the request, skip it. Never paste feelings and reactions in:");
    problems.dropped.forEach((d) => out.push('- "' + d + '"'));
  }
  if (problems.stray.length) {
    out.push("", n++ + ". These numbers are in the prompt but the person never said them: " + problems.stray.join(", ") + ". Remove them. If the idea still matters, say it without a made-up number (for example \"a daily budget that fits the total\").");
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
