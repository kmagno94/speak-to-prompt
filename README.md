# Speak to Prompt

Turn messy thoughts, typed or spoken, into one ready-to-paste prompt for any AI. Stateless: nothing is saved. Built for AI beginners.

**Live:** https://kmagno94.github.io/speak-to-prompt/

## Why it exists

Most people who try ChatGPT, Claude, or Gemini get mediocre answers because they don't know how to ask. Speak to Prompt takes whatever is on your mind, in whatever shape it comes out, and turns it into a prompt that gets a great answer on the first try.

## How to use it

1. **Get your thoughts in.** Type them, or talk in Voice Memos and paste the transcript.
   Blank page? Tap **Not sure where to start?** (under Build my prompt). Pick a category (or "Not sure yet"), tap or type a couple of quick answers, then use the sliders to dial **Detail**, **Tone**, **My level**, and **Ideas** up or down. The sliders are remembered on your device (just the four numbers), so they open where you left them; **Reset to middle** clears them. The tap answers rotate: each question has a pool of up to 10, shows 5, and serves a new 5 every 3 hours (12, 3, 6, and 9 o'clock, morning and night). Nothing is saved; the clock picks them. **More options** shows the rest right away. It writes a starting point you can build from right away or put in the box to add more.
   Stuck? The empty box rotates silly but real ideas (swipe through them, or tap **Try this one**). They clear the moment you tap in to type.
2. **Tap Build my prompt.**
3. **Copy the prompt** and paste it into any AI, or tap **ChatGPT**, **Claude**, or **Gemini** under **Copy and open in** to copy it and open that app in one tap.

### With or without a key

| | Quick version | With a free Gemini key |
|---|---|---|
| Setup | None | About a minute at Google AI Studio |
| Follow-up questions | Asked by the AI you paste into | Asked as a short chat on the page: tap an answer, type your own, or skip. Usually 1 to 3, up to 5 for complex requests. Tapped answers are marked as suggested: the page asks you to double-check them, tapping one loads it into the box to say it your way, and the writer treats them as approximate so they can't steer the prompt away from what you said |
| Result | A guided prompt that clarifies, then answers | One complete prompt your AI can start on right away |

### Your core (testing)

Hidden unless **More options > Show my dev tools** is on (it turns itself on for a phone that already has a core). The switch also shows Improve this app.

Set up once in **Not sure where to start? > Set up your core**, then every prompt ends with it, so the AI already knows you:

- **USER (About you):** your role, how you like answers, what you value.
- **SOUL (How the AI should act):** voice and rules, like "Be direct" or "Challenge me, with care".
- **IDENTITY (The AI's role):** Coach, Chief of staff, Accountability partner, Tutor, Thinking partner, or Expert advisor, plus what that means to you.

**Paste for Improve this app (dev tools):** when Talk it out brings you back, a second button under Tap to paste your transcript pastes it already wrapped in the Improve this app background and your saved sliders, so you can build right away.

**Improve this app (testing):** the last option in Not sure where to start? asks what you want to change (including **Review how it's going** for audits) and which part of the app, then writes a starting point with the app's background built in (what it is, the stack, how changes ship), ready to build into a prompt for a build chat.

Tap premade options or type your own. A **Use my core** switch under Build my prompt turns it on or off. The writer sees it too, so the prompt doesn't repeat or contradict it.

### Two modes (next to Build my prompt)

| Mode | What it does | Time |
|---|---|---|
| **Quick** | Skips the questions and writes right away on Flash-Lite (500 free requests a day), so it doesn't touch the smaller Flash allowance. | about 15 seconds |
| **Normal** | Asks a few questions, then writes on the newest Flash. | usually 1 to 2 minutes |

You can also tap **Quick prompt** on the questions card to write right away with whatever you've answered.

**Number check (free).** Every prompt is checked by the page itself, with no extra Gemini request: if it mentions a number you never said (like iOS 18 when you said iOS 27, or a made-up 400-word limit) or leaves out one you did, a "Heads up" note shows above the prompt. The writer is also told to keep every number, version, and product name exactly as you said it, even ones it doesn't recognize.

*A Deep mode (look-ups, review, rewrite loop) was built and tested, then removed: it never beat Normal and used up to 6 Flash requests a run.*

If Gemini is unavailable, the page falls back to the quick version and says why.

### One prompt, plus an optional note

- **One prompt to copy.** If your thoughts point in one direction, the prompt tells the AI to start right away. If they hold several directions, it asks the AI to lay them out as numbered options and let you pick first.
- **👻 Ghost Coach (under the box):** once you've written a few words, a **Prompt strength** meter (0 to 5) checks for the five things great prompts usually have: a goal, who it's for, details, limits (time, budget, length), and what a great result looks like. Up to two faint notes show what's missing; tap one to start a new line with a phrase like "It's for ". It runs on your phone (`app/lib/coach.js`, simple pattern checks), so it's instant, free, and sends nothing.
- **🔧 Auto-Repair (automatic, with a key):** after Gemini writes your prompt, the phone checks it with X-ray and the number check. If it's clean (most runs), you get it right away. If a sentence of yours (4+ words) was left out, a number appears that you never said, or a number you said went missing, one small fix request goes to the fast model ("add these, remove these, change nothing else"). The page rechecks the fix and keeps it only if it's better and added nothing new; otherwise you get the original. A note under "Ready in" says what happened. Run stats log the X-ray results and the repair outcome.
- **✨ Glow-Up (next to X-ray):** your messy thoughts and the finished prompt stacked in one box with a slider between them; it sweeps from messy to clean once when it opens (not with reduced motion), then you drag it. Shows the first 45 words of each unless you turn on **Show more of my words**. **Save as image** draws a 1080 x 1350 card on the phone (before, after, word counts, your-words %, app name and address) and opens the share sheet, or downloads it on computers. Your core is cut off the card, and nothing is uploaded. Run stats log it as "saved glow-up" (`app/GlowUp.svelte`).
- **🩻 Prompt X-ray (above your prompt):** tap **X-ray** to see where every part came from. Long X-rays stay easy to read: a slim bar with your-words % and **Done** follows you down the page, and a color key docked at the bottom of the screen shows one numbered chip per sentence of yours (red if it's not in the prompt). Each colored part carries the same number, and tapping a part or a chip shows the explanation right in the dock. The full list of your sentences is folded at the end (open if something was left out). Parts built from your words are colored to match the sentence they came from, with your matching words underlined; parts Speak to Prompt added are dashed and labeled (Expert role, Format, How to start...). It also flags any sentence of yours that **isn't in the prompt** and any **number you never said**. Tap a part to see its source or why it was added. It runs on your phone (`app/lib/xray.js`, word matching), so it's free and instant; heavy rewording can show as added even when the idea was yours.
- **Something went wrong? (front page):** the same report, under Not sure where to start?, for problems before a prompt exists (a button did nothing, something looks off, ideas got stuck, Talk it out, the starter, an error message). It sends page facts only: version, device, key yes or no, mode, whether a prompt was built in this tab, and sliders.
- **Something went wrong? (under your prompt):** tap what went wrong (chips, any number) and add an optional note. The report holds only how the run went: app version, device, mode, word counts, how many questions were asked, tapped, typed, or skipped, models and timing, model detours, errors, the number check result, and slider settings. Never your thoughts, answers, or prompt. **See exactly what's sent** shows it word for word. **Send report** files it as a GitHub issue labeled `report` in one tap, with no account, through a small Cloudflare Worker (`worker/report-relay.js`) that holds a GitHub key limited to this repo's issues. The twice-daily review picks it up. If the relay is down, or not set up yet (`VITE_REPORT_RELAY` in `.env` is empty), it falls back to the share sheet (computers copy it); with **Show my dev tools** on and no relay, **File a GitHub issue** opens a prefilled issue instead.
  - **Automatic run log:** while **Show run stats and daily usage** is on (testing phones only), each run's numbers-only record also goes to the relay's `/run`, which posts it as a comment on the locked **Run log (automatic)** issue (#2) for the twice-daily review. With run stats off, nothing is sent.
  - **What happened next:** the run is sent when you act on the prompt (copied, opened an AI, saved, started over, rebuilt, reported, left the page, or nothing in 10 minutes), with whether you opened X-ray. Detours say how long each model made you wait before the next one took over ("was unavailable after 290s").
  - **Stress tests:** a daily scheduled task writes a tricky note with an answer key on the Notion "Stress Test Lab" page. Kevin runs it and pastes the result; the next review grades it, adds a test for any bug it finds, and fixes what the rules allow.
  - **Scorecard:** `node scripts/runlog-report.mjs [--since ISO] [--json]` reads issue #2 and reports speed vs estimates (by depth, with suggested defaults after 5 runs), quality (X-ray, number check, Auto-Repair), what happened next, model fallbacks, and flags. The twice-daily review runs it.
  - **Self-tuning estimates:** `node scripts/runlog-report.mjs --tuning` writes `tuning.json` (repo root) with the typical wait per depth from the last 20 ok runs (only depths with 5+ runs). The page loads it, so a phone that hasn't learned its own times yet shows real numbers instead of the built-in guesses. Order: your phone's last 8 runs (with run stats on), then tuning.json, then built-in defaults. Each run logs `est_from` (phone, shared, built-in) so the Scorecard grades each source. The review refreshes the file.
  - **Relay guards:** only requests from the app's web address, only report-shaped text, size caps, 5 reports per person per hour (best effort), @mentions and HTML defused, label fixed to `report`, and the key never leaves Cloudflare. Tests cover each guard.
- **Save to Notes (optional):** after you copy the prompt, the page offers to save a structured note (date, title, tags, summary, key ideas, action items, questions, follow-up answers, clean transcript, and the prompt) in your original voice-note layout. With **Use my Notes shortcuts** on (More options, iPhone and iPad only, off by default), it runs the **Save Voice Note** shortcut with the note in Markdown (`# ` title, `##`/`###` headings, `☐` action items, bold questions, a blank line between lines); the shortcut turns it into rich text with **Make Rich Text from Markdown** and creates the note straight in the 💪Process Voice Note💪 folder, so Notes shows real headings (the note is also copied as a backup, so tap Copy prompt again before pasting into your AI). **Share instead** opens the share sheet if the shortcut isn't installed. With the switch off, and on computers, it uses the share sheet or copy.
- **First time? Start here:** next to Talk it out (and on computers too) opens a short walkthrough (`app/Tutorial.svelte`): a realistic messy practice note, picked at random from 8 everyday asks (`app/lib/examples.js`, with **↻ Another one** to shuffle and tags on why messy is fine), goes through all four steps (dump it, Build, a question, copy into any AI), with the Talk it out shortcut link at the top on iPhone and iPad and a Set up my key button. **Copy this note and try it** copies the note and closes, then the **first-run guide** (`app/Guide.svelte`, a bar along the bottom) walks them through the real thing, glowing around what to tap next: Paste, Build my prompt, a question, Copy prompt, then "That's it." It reads the page as it goes and can be skipped anytime. If the browser won't copy, the note goes in the box and the guide starts at Build. It never opens by itself.
- **🧠 Memory, "Tailored to you" (dev tools on, opt-in):** short facts about your world (devices, school, job, tools) in Your core, saved only on this phone (`stp-memory`, 30 max). The intake step sees them numbered, skips questions they answer, and picks which matter (`use_memory`); only those go into writing the prompt, and they count as things you said (number check, X-ray, Auto-Repair). After a run, **Remember for next time?** offers your answers and up to 2 lasting facts Gemini spotted (`remember`; never health, money amounts, IDs, addresses, or other people); nothing saves without a tap. **Export memory.md** goes through the share sheet (Save to Files puts it in iCloud Drive); **Import** reads it back, which also moves memory between Safari and the Home Screen app. **Forget everything** clears it. While on, the front chip says **🧠 Tailored to you · this phone only** and the footer says so. Reports show counts only, never facts (`app/lib/memory.svelte.js`, `MemoryPanel.svelte`, `MemorySuggest.svelte`).
- **Paste button:** a small 📋 Paste button always sits on top of the box (where the browser can read the clipboard); coming back from the shortcut it grows into the big paste banner.
- **Honest limits:** Google has no "how much is left" endpoint (limits are per project: requests per minute, tokens per minute, requests per day; daily resets at midnight Pacific). But a limit error (429) says which limit was hit and how long to wait, so the page reads it: a per-minute limit rests that model for the wait time and never says "used up"; a daily limit marks it used up until 3 AM Eastern and, if Google includes the number, learns your real daily limit (`stp-learned-limits`). Today's usage shows what's true right now: "used up today, back at 3 AM", "busy at Google, retry in 7 min" (503 high demand), "per-minute limit, back in 30s", or "~N of 20 left".
- **Version pill (top right):** each build writes `version.json`; the page checks it on open and whenever it comes back into view. The pill says **✓ Latest**, **Update ready** (filled), or **Refresh** if it couldn't check. Tapping always reloads, which is the only refresh a Home Screen web app has; with a prompt on screen, the first tap asks to tap again.
- **Busy models:** Google has no way to check remaining quota with a key, so the page learns from what models just did. A model that says it's busy (or times out) rests for 10 minutes and one at its limit rests for an hour (`stp-model-rest` on this device: model names and times only); resting models go to the back of the line. For writes, if the model hasn't answered in about 2.5x the usual time (30 to 90s), the next model starts too and the first good answer wins. Detours say what happened ("skipped (resting 7 more min)", "was slow, so gemini-3.7-flash started too after 43s").
- **Speak to Prompt stack (dev tools on):** when Gemini asks which stack or framework to build a web app with, the first choice is always "Speak to Prompt stack (Svelte 5 + Vite 8)". The versions come from the installed packages at build time (`__STACK__` in vite.config.js), so the label updates itself if the stack changes.
- **File voice note (with Use my Notes shortcuts on):** a button next to Talk it out runs the **File Voice Note** shortcut: it copies a note from 💪Process Voice Note💪, moves it to Voice Notes, and opens Claude so you can paste it.

The page itself still saves nothing. Your notes live in Apple Notes, on your account.

### Voice on iPhone

Tap **Talk it out** on the page to run the **Speak to Prompt** shortcut (`shortcuts://run-shortcut?name=Speak%20to%20Prompt`). It opens Voice Memos, then brings you back to the page with one big paste button. First time? Install it here:
https://www.icloud.com/shortcuts/391f35e4646d443e92a73e098e0e559b

After you build your prompt, the shortcut waits in the background. Paste the prompt into your AI, then tap the shortcut's notification: Voice Memos opens so you can move or delete the recording, and the shortcut brings you back to Safari. The shortcut uses whatever text is on your clipboard, so you can also copy text from anywhere before running it. Every Gemini prompt also shows a short **Category** under the chat name.

Voice Memos transcripts are made on the phone and need iOS 18 or later on an iPhone 12 or newer.

## Privacy

- **The site saves nothing.** There is no server, no database, no analytics, and no cookies. Close or refresh the tab and everything is gone.
- **Your Gemini key** is only saved on your phone if you tick "Remember my key," and it is sent only to Google, in a request header.
- **With a key, your words go to Google** to build the prompt, and nowhere else. On Google's free tier, Google may use what you send to improve its products.
- **Run stats (optional, for testing):** a "Show run stats and daily usage" toggle under **More options** saves timings, token counts, and today's requests per model on your device, so you can see what's left of each free limit. It never saves your words or prompts, and turning it off deletes everything it saved.
- **Your core (testing only):** saved in Safari on your phone while the app is being built, and only ever sent inside prompts you build. Delete it any time from the core screen. Plan: keep it as a dev tool behind Show my dev tools rather than delete it; decide about shipping after a real user test.
- **usage.json** holds daily Gemini request and token counts read from AI Studio screenshots (no prompts, no words, no key). Run stats shows it next to the runs counted on your device.
- **Lock your key to this site** (optional): in Google Cloud Credentials, restrict it to the website `https://kmagno94.github.io/*` and to the Generative Language API, so a leaked key is useless anywhere else.

## How it's built

- **Svelte 5 + Vite.** It builds to plain static files (about 30 KB of script, gzipped) and is tuned for Safari on iPhone, iPad, and Mac.
- **Hosted free on GitHub Pages**, published by GitHub Actions. Every push to `main` runs the smoke tests first, so the live site only gets builds that passed.
- **Where things live:**

  | Path | What it is |
  |---|---|
  | `app/App.svelte` | The page markup |
  | `app/ModePicker.svelte` | The Quick and Normal picker, the first part rebuilt as a Svelte component |
  | `app/StartHelper.svelte`, `app/lib/starter.svelte.js`, `app/lib/starters.js` | Not sure where to start?: 11 categories with tap-or-type questions and fine-tune sliders that write a starting point |
  | `app/lib/rotate.js` | Picks which 5 starter answers show, from the current 3-hour window (no storage) |
  | `app/lib/core.svelte.js`, `app/CoreEditor.svelte`, `app/CoreToggle.svelte` | Your core (USER, SOUL, IDENTITY). Testing only; remove these files, the lines marked "core" in app.js, and the "Improve this app" category in starters.js before shipping |
  | `app/ChatBuilder.svelte`, `app/lib/chat.svelte.js` | The follow-up questions as a chat: tap, type, or skip, edit any answer, live summary. See `docs/chat-builder.md` |
  | `app/lib/ui.svelte.js` | Shared app state that components react to |
  | `app/lib/app.js` | The page's behavior: Gemini calls, questions, results, idea strip, run stats |
  | `app/lib/prompts.js` | What gets sent to Gemini, and the no-key quick version |
  | `app/lib/ideas.js` | The idea strip's ideas |
  | `app/app.css` | Styles and color tokens (light and dark) |
  | `usage.json` | Daily Gemini usage from AI Studio screenshots, copied into the build |
  | `.github/workflows/deploy.yml` | Test, build, and publish |

- **Run it locally:** `npm install`, then `npm run dev` and open the Network address on your iPhone (same Wi-Fi). Changes show up as you save.
- New features are built as Svelte components. Older parts move into components when they're next changed.
- Gemini is called directly from the browser. The page lists the models your key can use and builds a plan, so it keeps working when Google renames models:
  - **Questions** go to Flash-Lite first, which has the largest free daily allowance (500 requests on the free tier).
  - **The final prompt** goes to the newest Flash model first, for the best writing. Gemini rates each request as quick, standard, or complex, and the writing step thinks lightly, in a balanced way, or deeply to match. The plan and its usual time are shown before you start, and there's no rush: it only switches models if one errors out or hits its daily limit.
  - **Backups:** each model has its own daily limit, so when one runs out the page moves to the next. Only when every model is used up does it switch to the quick version.
- The prompt logic comes from my Prompt Optimization Engine: a short chat title, working out what the person actually needs, clarifying questions, then a prompt built from role, context, task, example, format, and tone.

## Tests

`npm install && npm test` (from the repo root) builds the app and runs smoke tests against a mocked Gemini: quick version, full flow, Quick mode, model fallback, cut-off answers, the number check, repeat shortcut runs, run stats privacy, the Talk it out link, the Copy and open app links, the simple first screen, the mode picker, the idea strip, and usage.json.

## Status

Working prototype, being tested with family. Built step by step with Claude; every change is a commit in this repo.
