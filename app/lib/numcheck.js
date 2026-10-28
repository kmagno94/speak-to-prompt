/* Number check (free, runs on the phone, no Gemini request). Compares the numbers in a
   prompt (times, money, versions like iOS 27) with what the person said, and checks that a
   weekday written next to a date is really that day. A writer that "corrects" a version it
   doesn't know (iOS 27 to iOS 18), drops a number, invents one (a 400-word limit, a year
   nobody said), or writes "Saturday the 30th" when the 30th is a Friday gets flagged before
   the prompt is pasted anywhere. The quality grade is docked when it flags (numberDock).
   Pure functions, so the grader bench and the live page share them. */
import { mathOf, wordNums, conversions } from './xray.js';

/* Small counts like "3 tips" are fine unless they follow a version word. */
const VERSION_WORD = /(ios|ipados|macos|watchos|tvos|visionos|android|windows|version|v)\s*$/i;
export function numberTokens(text, keepSmall) {
  const out = {}, t = String(text || "");
  const re = /(\d{1,2}:\d{2})|\$?(\d[\d,]*(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 12), m.index);
    const lineStart = /(^|\n)\s*$/.test(t.slice(Math.max(0, m.index - 4), m.index)) && /^[.)]/.test(t.slice(re.lastIndex, re.lastIndex + 1));
    if (lineStart) continue; /* list numbering like "1." */
    /* "10:00 AM" is the same number as "10am", so on-the-hour times count as the hour */
    const tok = m[1] ? m[1].replace(/^0?(\d{1,2}):00$/, "$1") : m[2].replace(/,/g, "").replace(/\.0+$/, "");
    if (!tok) continue;
    const small = !m[1] && Number(tok) <= 10 && !VERSION_WORD.test(before);
    if (small && !keepSmall) continue;
    out[tok] = true;
  }
  return out;
}
/* Numbers that plain words already say: "two weeks" is 14 days, "half an hour" is 30 minutes. */
const IMPLIED = [[/\btwo weeks?\b/i, ["14"]], [/\bthree weeks?\b/i, ["21"]], [/\b(a|one) week\b/i, ["7"]], [/\bhalf (an )?hour\b/i, ["30"]], [/\b(an|one) hour\b/i, ["60"]], [/\b(a|one) year\b/i, ["12", "365"]]];
/* "October 30th, wait no, the 31st": the part before the correction isn't something to keep. */
export const CORRECTION = /[^.!?\n]*?\b(wait,? no|no,? wait|scratch that|i mean|correction|or rather|actually it'?s|actually make it)\b/gi;

/* said: everything the person said (raw thoughts, answers, memory, picked context). */
export function numberIssuesFor(promptText, said) {
  said = String(said || "");
  const have = numberTokens(said, true), given = numberTokens(said.replace(CORRECTION, " "), false);
  IMPLIED.forEach((x) => { if (x[0].test(said)) x[1].forEach((n) => { have[n] = true; }); });
  const got = numberTokens(promptText, true), gotBig = numberTokens(promptText, false), math = mathOf(Object.keys(have).concat(wordNums(said)));
  conversions(promptText, Object.keys(have)).forEach((n) => { have[n] = true; });   /* 140 miles is about 225 km */
  const money = {}; (String(promptText || "").match(/\$\d[\d,]*(?:\.\d+)?/g) || []).forEach((m) => { money[m.slice(1).replace(/,/g, "").replace(/\.0+$/, "")] = true; });
  return {
    missing: Object.keys(given).filter((n) => !got[n]),
    extra: Object.keys(gotBig).filter((n) => !have[n] && !(money[n] && math(n)))   /* correct money math isn't made up */
  };
}

/* Weekday check: "Saturday the 30th", "Sat, Oct 30", "Saturday October 30, 2026",
   "Saturday 10/30". With no month, the date is the next one on or after today (this month
   or next). With no year, it's this year unless that's more than a month gone. Returns
   [{ text, said, actual }] for each weekday that doesn't match its date. */
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAY_RE = "(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?\\.?";
const MON_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
const ORD = "(\\d{1,2})(?:st|nd|rd|th)?";
const DATE_RES = [
  /* Saturday, October 30(, 2026) / Saturday Oct 30th */
  new RegExp("\\b" + DAY_RE + ",?\\s+(?:the\\s+)?" + MON_RE + "\\s+" + ORD + "(?:,?\\s+(\\d{4}))?\\b", "gi"),
  /* Saturday 10/30(/2026) */
  new RegExp("\\b" + DAY_RE + ",?\\s+(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?\\b", "gi"),
  /* Saturday the 30th / Saturday, the 30th / Saturday 30th (a bare "Monday 5 tips" isn't a date) */
  new RegExp("\\b" + DAY_RE + ",?\\s+(?:the\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th))(?![\\d\\/:])\\b", "gi")
];
function dayIndex(w) { const k = w.toLowerCase().slice(0, 3); return DAYS.findIndex((d) => d.startsWith(k)); }
function monthIndex(w) { const k = w.toLowerCase().slice(0, 3); return MONTHS.findIndex((m) => m.startsWith(k)); }
function realDate(y, m, d) { const t = new Date(y, m, d); return t.getMonth() === m && t.getDate() === d ? t : null; }
/* today: a Date, or the app's todayText ("Wednesday, October 21, 2026"). */
export function toDate(today) {
  if (today instanceof Date) return today;
  const t = Date.parse(String(today || "").replace(/^[a-z]+,\s*/i, ""));
  return isNaN(t) ? new Date() : new Date(t);
}
export function dateMismatches(text, today) {
  const now = toDate(today), base = new Date(now.getFullYear(), now.getMonth(), now.getDate()), out = [], seen = {};
  const t = String(text || "");
  DATE_RES.forEach((re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) {
      const wd = dayIndex(m[1]);
      let date = null;
      if (kind === 0 || kind === 1) {
        const mon = kind === 0 ? monthIndex(m[2]) : Number(m[2]) - 1, day = Number(m[3]);
        let year = m[4] ? Number(m[4].length === 2 ? "20" + m[4] : m[4]) : now.getFullYear();
        date = realDate(year, mon, day);
        if (date && !m[4] && date < new Date(base.getTime() - 31 * 864e5)) date = realDate(year + 1, mon, day);
      } else {
        const day = Number(m[2] || m[3]);
        for (let k = 0; k < 3 && !date; k++) {
          const c = realDate(base.getFullYear(), base.getMonth() + k, day);
          if (c && c >= base) date = c;
        }
      }
      if (!date || wd < 0) continue;
      const key = m.index + ":" + m[0].length;
      if (seen[key] || out.some((o) => o.at < m.index + m[0].length && m.index < o.at + o.text.length)) continue;
      seen[key] = true;
      if (date.getDay() !== wd) {
        out.push({ at: m.index, text: m[0].trim(), said: DAYS[wd], actual: DAYS[date.getDay()],
          date: MONTHS[date.getMonth()][0].toUpperCase() + MONTHS[date.getMonth()].slice(1) + " " + date.getDate() });
      }
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

/* Everything the phone flags for one prompt. */
export function numberFlags(promptText, said, today) {
  const n = numberIssuesFor(promptText, said);
  return { extra: n.extra, missing: n.missing, dates: dateMismatches(promptText, today) };
}
/* Plain words for what the number check found, or "" when it's clean. */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
export function flagText(f) {
  const parts = [];
  if (f.extra.length) parts.push("mentions " + list(f.extra) + ", which you never said");
  if (f.missing.length) parts.push("leaves out " + list(f.missing) + ", which you did");
  (f.dates || []).forEach((d) => parts.push("says " + d.text + ", but " + d.date + " is a " + cap(d.actual)));
  return parts.join(", and ");
}
/* Grade dock: when the number check flags, the prompt can't pass. Each kind of flag
   (a made-up number, a number left out, a weekday that doesn't match) takes half a point
   off the 4.50 bar: one kind tops out at 4.00, two at 3.50, three at 3.00. */
export function numberDock(g, f) {
  if (!g || !f) return g;
  const kinds = ["extra", "missing", "dates"].filter((k) => f[k] && f[k].length);
  if (!kinds.length) return g;
  const top = 4.5 - 0.5 * kinds.length;
  const craft = Math.round(Math.min(g.craft, top) * 100) / 100;
  return { ...g, craft, pass: false, numCheck: kinds, numBefore: g.craft };
}
