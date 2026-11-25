/* Ghost Coach: checks what you've written for the five things great prompts
   usually have, right on the phone. No Gemini call, nothing saved or sent.

   Each check is a plain pattern match, so it's a nudge, not a grade: it can
   miss things said in an unusual way, and that's fine. */

export const CHECKS = [
  {
    key: 'goal', label: 'Goal',
    note: 'What do you want out of this?', starter: 'What I want: ',
    test: /\b(help|want|need|trying to|looking for|make|write|plan|create|build|fix|figure out|decide|choose|learn|explain|find|organi[sz]e|improve|how (do|can|should) i|what should i|can you|could you|should i|let'?s|let me know|i'?d like|i would like|tell me|give me|show me|walk me)\b|\?/i
  },
  {
    key: 'who', label: "Who it's for",
    note: "Who's it for?", starter: "It's for ",
    test: /\bfor (me|my|a|an|the|our|us|him|her|them|kids|people|beginners|someone|work|school|class)\b|\b(audience|readers|customers|clients|students|coworkers|users?|guests|visitors|beginners|my (boss|manager|team|class|teacher|mom|dad|family|friends?|cousins?|kids?|partner|wife|husband|girlfriend|boyfriend|landlord|followers))\b/i
  },
  {
    key: 'details', label: 'Details',
    note: 'Add a detail or two', starter: 'Details: ',
    test: (t, words) => words >= 40 || (words >= 12 && /\d/.test(t))
  },
  {
    key: 'limits', label: 'Limits',
    note: 'Any limits? Time, budget, or length', starter: 'Limits: ',
    test: /\bby (mon|tues|wednes|thurs|fri|satur|sun)day\b|\bby (tomorrow|tonight|the end|next|noon|\d)|\b(before|until|deadline|due|tonight|tomorrow|this (week|month|weekend)|next (week|month|year|fall|spring|summer|winter)|budget|cheap|free|under|less than|no more than|at most|max(imum)?|only|without|can'?t|cannot|don'?t want|avoid|minutes?|hours?|days?|weeks?|words?|pages?)\b|\$\s?\d/i
  },
  {
    key: 'good', label: 'What good looks like',
    note: 'What would a great result look like?', starter: 'A great result would be ',
    test: /\b(list|table|steps?|step by step|checklist|bullets?|summary|outline|email|text message|template|example|format|short|brief|detailed|paragraph|script|draft|schedule|so that|looks? like|should (be|include|have)|end up with|result|options|compare|pros and cons|guide|recipe|itinerary|routine|letter|post|caption|essay|report|audit)\b/i
  }
];

export const LEVELS = ['Just getting started', 'Just getting started', 'Getting there', 'Solid', 'Strong', 'Ready to shine'];

export function words(text) { return (text || '').trim() ? text.trim().split(/\s+/).length : 0; }

/* -> { words, score 0 to 5, checks: [{ ...check, hit }] } */
export function assess(text) {
  const t = String(text || '');
  const w = words(t);
  const checks = CHECKS.map((c) => ({ ...c, hit: typeof c.test === 'function' ? c.test(t, w) : c.test.test(t) }));
  return { words: w, score: checks.filter((c) => c.hit).length, checks };
}

/* Can't-see-it radar (AGT-71, Slice 1): words that point at something your AI can't see
   (this email, my resume, the rubric). Free, on the phone, no Gemini call. Bare "code" is left
   out on purpose (dress code), only "my code" and "this code" count. */
const CANT_SEE = [
  { name: 'email', see: false, re: /\b(?:this|my|the|that) email\b|\bthe email below\b/i },
  { name: 'resume', see: false, re: /\b(?:my|the|this) (?:resume|résumé)\b/i },
  { name: 'CV', see: false, re: /\b(?:my|the|this) cv\b/i },
  { name: 'attachment', see: false, re: /\bthe attach(?:ed|ment)\b|\bmy attach(?:ed|ment)\b/i },
  { name: 'code', see: false, re: /\b(?:my|this) code\b/i },
  { name: 'article', see: false, re: /\b(?:that|this|the) article\b/i },
  { name: 'essay', see: false, re: /\bmy essay\b/i },
  { name: 'rubric', see: false, re: /\bthe rubric\b|\bmy rubric\b/i },
  { name: 'document', see: false, re: /\b(?:this|my) document\b/i },
  { name: 'spreadsheet', see: false, re: /\b(?:this|my) spreadsheet\b/i },
  { name: 'screenshot', see: true, re: /\b(?:the|this|my|that) screenshot\b/i },
  { name: 'photo', see: true, re: /\b(?:this|my|the|that) photo\b/i }
];
const BIG_BLOCK = 150;   /* more than this many words after the phrase: the text is probably already pasted */

/* -> up to two { name, see } the note points at but the AI can't see. [] when none, or when a big block follows. */
export function cantSeeThings(text) {
  const t = String(text || '');
  const out = [];
  for (const c of CANT_SEE) {
    const m = c.re.exec(t);
    if (!m) continue;
    if (words(t.slice(m.index + m[0].length)) > BIG_BLOCK) continue;
    if (!out.some((o) => o.name === c.name)) out.push({ name: c.name, see: c.see, at: m.index });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 2).map(({ name, see }) => ({ name, see }));
}

/* The card's one short line. */
export function cantSeeLine(things) {
  if (!things.length) return '';
  const names = things.map((t) => t.name);
  const list = names.length === 2 ? names[0] + ' and ' + names[1] : names[0];
  const attach = things.filter((t) => t.see), paste = things.filter((t) => !t.see);
  const pasteList = paste.map((t) => t.name).join(' and '), attachList = attach.map((t) => t.name).join(' and ');
  if (!attach.length) return "Your AI can't see your " + list + '. Paste it right under the prompt when you send it.';
  if (!paste.length) return "Your AI can't see your " + list + '. Attach it in the chat after you paste the prompt.';
  return "Your AI can't see your " + pasteList + ' or your ' + attachList + '. Paste the ' + pasteList + ' under the prompt, and attach the ' + attachList + ' in the chat.';
}
