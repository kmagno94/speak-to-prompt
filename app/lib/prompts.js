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
  '{"title": "5 to 6 word chat title, most specific word first, no filler words", "need": "one plain sentence describing what they need", "category": "a 1 or 2 word category for this recording, Title Case, general enough to reuse as a Voice Memos folder for similar recordings (for example Shortcuts, School, Work, Fitness, Ideas)", "complexity": "simple, standard, or complex (simple = a short answer or small task; standard = a typical multi-part request; complex = many moving parts, multi-step setups across devices or tools, plans, or deep analysis)", "questions": [{"question": "...", "choices": ["...", "..."]}], "note": {"headline": "short descriptive heading for a saved note", "tags": ["3 to 5 lowercase single-word tags"], "summary": "2 or 3 plain sentences", "key_ideas": ["..."], "action_items": ["clear next steps they mentioned or clearly implied"], "unknowns": ["open questions they raised"], "clean_transcript": "their raw thoughts, lightly cleaned: remove filler words, false starts and accidental repeats, keep their wording and every detail"}}',
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
