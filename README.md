# Speak to Prompt

Turn messy thoughts, typed or spoken, into one ready-to-paste prompt for any AI. Stateless: nothing is saved. Built for AI beginners.

**Live:** https://kmagno94.github.io/speak-to-prompt/
**Staging (test copy):** https://kmagno94.github.io/speak-to-prompt/staging/

## Why it exists

Most people who try ChatGPT, Claude, or Gemini get mediocre answers because they don't know how to ask. Speak to Prompt takes whatever is on your mind, in whatever shape it comes out, and turns it into a prompt that gets a great answer on the first try.

## How to use it

1. **Get your thoughts in.** Type them, or talk in Voice Memos and paste the transcript.
   Blank page? Tap **Not sure where to start?** (under the box). Pick a category (or "Not sure yet"), tap or type a couple of quick answers, then use the sliders to dial **Detail**, **Tone**, **My level**, and **Ideas** up or down. The sliders are remembered on your device (just the four numbers), so they open where you left them; **Reset to middle** clears them. The tap answers rotate: each question has a pool of up to 10, shows 5, and serves a new 5 every 3 hours (12, 3, 6, and 9 o'clock, morning and night). Nothing is saved; the clock picks them. **More options** shows the rest right away. It writes a starting point you can build from right away or put in the box to add more.
   Stuck? The empty box rotates silly but real ideas (swipe through them, or tap **Try this one**). They clear the moment you tap in to type.
2. **Tap Build my prompt** in the Next step dock, the floating pill at the bottom of the screen. It always holds the one button you need right now: Build my prompt, then Write my prompt (N of 3) while questions show, then Copy prompt. Its ⋯ holds the rest. Change your words after a build and it goes back to Build my prompt. It tucks away while the keyboard, X-ray, the Tutorial, or a panel is open. On an iPad keyboard or a computer, **Ctrl or ⌘ + Enter** in the box builds too.
3. **Tap Copy prompt** in the dock and paste it into any AI, or tap **⋯** then **ChatGPT**, **Claude**, or **Gemini** under **Open in** to copy it and open that app in one tap.

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

Tap premade options or type your own. A **Use my core** switch under the box turns it on or off. The writer sees it too, so the prompt doesn't repeat or contradict it.

### My context (testing)

Also behind **Show my dev tools**. Under Build, **My context** keeps reusable pieces of background, each a title and a big text box (like "Bean N Bean roasting" or "My WGU class"). Tap a chip to use that piece for this prompt. Nothing is tacked on after the prompt: the writer sees the picked pieces and works in only the facts this request needs, so **Copy gives the prompt only** (then Your core at the very end). With no key, the quick version puts the picked pieces inside the prompt, before your thoughts. Their numbers count as yours (number check, X-ray), and X-ray labels those parts **Your context**. **+ New** or **Edit** opens the editor at its top with the cursor in a title (a new piece goes first; Delete asks twice). Saved on this phone only (`stp-context`); picks are never saved. **Budget:** the chip next to My context shows about how many tokens the picks add and the % of a 1,500 token budget. Past 100%, a build with a key runs one Flash-Lite squeeze that keeps every fact and drops the filler, and the chip shows before and after (like squeezed 2,100 → 1,240 tokens · 83%). The squeezed version lives in memory for those exact picks only: your saved pieces never change, and a new pick, an edit, or a reload drops it. If the squeeze fails or doesn't come out shorter, the full pieces are used. Without a key the chip says over budget, used in full.

### 💡 Ideas tab (just for me)

Hidden unless **More options > Show my Ideas tab** is on. A 💡 button at the bottom right opens a side panel to log what I notice while using the app:

1. **What is it?** 🐞 Bug, 💡 Idea, or ⚡ Faster way.
2. **Looks like it might be…** up to 3 guesses from where I just tapped and what just went wrong (Gemini failed, copy failed, fast repeat taps, a page error). Tapping one fills in the spot, topic, and a starter sentence.
3. **Where?** 12 areas of the app, grouped Before, During, After, Setup, Anywhere. Then **About what?** a few topics per area, and **Say it**.
4. **How soon?** 🔥 Now, 🗓️ Soon, or 🌱 Someday. Then **Drop it in the jar**.

Each open idea can be edited (**Edit**, then Save or Cancel), marked fixed (it records the version), won't do, reopened, or deleted. **Copy fix session** copies one prompt with every open idea, oldest first, plus the repo and the staging rules, ready to paste into a new Claude chat.

**Fixes close their own ideas:** each fix commit adds the idea's id to `ideas-done.json` (id, commit, version, and a short note about the fix, never the idea's text). When the tab opens, matching open ideas move to done ("Fixed in v2.1.0 (b1db256)") with a line saying how many closed, so the next Fix session lists only what's left. **Reopen** keeps an idea open even though a fix lists it. **Clear done** (asks twice) removes all done ideas from the phone.

**Privacy:** ideas are saved on this phone only (`stp-ideas`, and under `stg:` on staging). Only what's typed in the panel is kept. The "where I just was" trail holds area names and problem signals, in memory only, and never anything from the prompt box, questions, or results. Nothing is sent anywhere.

### 🧪 Test lab (staging only)

On the staging build only, a 🧪 button at the bottom left (with **Show my Ideas tab** on) opens the Test lab. The link `kmagno94.github.io/speak-to-prompt/staging/#testlab` opens it straight away. It lists every check from `releases.json` for the builds that aren't live yet, oldest first, then four **Before you promote** checks (iPhone, iPad, Reduce Motion, Dark Mode).

- **Start / Continue** walks the checks one at a time: what to do, what you should see, then **✓ Works** or **✗ Broken** with a note. Steps you passed don't come back.
- **Re-check** walks only the broken ones once there are any, after a fix.
- **💡 Add to Ideas jar** turns a broken check into a 🔥 Now bug, so it rides the next Fix session.
- The verdict: "Don't promote: 2 broken", or "All 14 work. Ready to promote v2.1.3" with a button that copies **Pre-flight passed, promote v2.1.3** for the Claude chat.
- Live's version is passed in by the deploy, so the plan always matches what's actually live. Results are saved on this phone only (`stp-testlab` under `stg:`). The live build never shows it.

### Two modes (next to Build my prompt)

| Mode | What it does | Time |
|---|---|---|
| **Quick** | Skips the questions and writes right away on Flash-Lite (500 free requests a day), so it doesn't touch the smaller Flash allowance. | about 15 seconds |
| **Normal** | Asks a few questions, then writes on the newest Flash. | usually 1 to 2 minutes |

You can also tap **⋯** in the dock, then **Quick version**, to write right away the faster, lighter way with whatever you've answered.

The app starts in **Quick** when there's no key, so nobody hits a "needs a key" wall, and moves to **Normal** once a key is added, unless you picked a mode yourself.

### The journey (what the page looks like)

- **Speak › Answer › Copy** at the top shows where you are: numbered, labeled, a check when done, and "Skipped in Quick" when there are no questions.
- **One message style** for empty, error, warning, and success notes (`Message.svelte`): an icon and a plain title, one line on what to do next, and a button. Gemini failing still gives the quick prompt, with Try again, Fix my key, or when the limit comes back.
- **Copy is the finish line:** one big button that turns into a check. Long prompts get Show the whole prompt.
- **Quality check** (when the grader runs): a 5-step meter, the score, a plain label, and one tip.
- **Gentle input notes** for one word, very long notes, and other languages. The build always goes ahead.
- **Motion** is small and uses shared tokens (150 to 300 ms, ease-out, transform and opacity only), with a welcome under a second. Reduce Motion turns it all off.

**Number check (free).** Every prompt is checked by the page itself, with no extra Gemini request (`app/lib/numcheck.js`): if it mentions a number you never said (like iOS 18 when you said iOS 27, a made-up 400-word limit, or a year), leaves out one you did, or puts a weekday next to a date that isn't that day ("Saturday the 30th" when the 30th is a Friday), a "Heads up" note shows above the prompt. The writer is also told to keep every number, version, and product name exactly as you said it, to keep your hedges (maybe, I think, around), to add no year, weekday, month, or time to a date you gave (if your own weekday and date don't match, the prompt asks the AI to check instead of picking one), and not to make a preference stronger than you said it (no strictly you didn't say). When the number check flags, the Quality check is docked below the bar (half a point off 4.50 for each kind: made-up number, missing number, wrong weekday).

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
- **New prompt (⋯ in the dock, was Start over) offers Undo for 6 seconds**, which puts your words back in the box (memory only; build again for a new prompt). After that it **forgets the transcript:** it clears the box, the result, and X-ray. Only a fingerprint of what you built from (a length and a hash, never the words, in memory only) stays, so if Paste finds that same transcript still on the clipboard it says so instead of bringing it back, with **Use it anyway** if you meant it.
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
- **Lessons learned (lessons.json):** short, general prompt-writing rules (never anyone's words) that the twice-daily review keeps from graded runs and stress tests. Every prompt build adds them to the writing step, and the quality grade checks every prompt against them as the list of what not to do. It also holds grader rules: calibration Claude writes when its own grade of a pasted result disagrees with the app's. At most 6 of each, versioned, and every change is a commit you can undo.
- **Quality grade (run stats on only):** after the prompt shows, Flash-Lite grades it in the background with a strict rubric, scored to the hundredth (1.00 to 5.00) and shown to the tenth, with the exact score next to it when they differ (4.5 of 5 (4.47)). **The pass bar is 4.5:** the line says ✅ passes or ✋ below the 4.5 bar. Each missing part costs a point (one missing tops out at 4.00), each lesson from lessons.json the prompt breaks caps it at 4.40 (half a point more per extra lesson), rearranged caps at 2, invented at 3. Only the score, pass yes or no, the fixed labels, and lesson ids (like L2) go into the run log, never your words. The Scorecard shows the pass rate and which lessons get broken most. Parts that don't apply (your limits when you gave none, how-to steps when none are needed) never count as missing. If the number check flags the prompt, the grade is docked below the bar (`grade_numcheck` in the run log says which kinds), and the grader bench docks its cases the same way.
- **🔁 Rework from this prompt (round 2):** when the Quality check is under the bar, tap Rework and your prompt goes back in the box with one **What was weak** line on top. Change anything (add a fact, cut a line, fix the weak spot), then tap Build my prompt. Round 2 writes from your original thoughts and answers (kept in memory only) plus your edited prompt, with no new questions, and lines you typed count as your words for the number check and the grader. The timer reads **Round 2** with the running total for both rounds, the card shows the score before and after, and **Save to Notes** keeps your original words with the new prompt. **← Back to round 1** (over the box or on the card) puts the first prompt, its grade, and your words back. If round 2 fails, round 1 comes back on its own.
- **Screen stays awake while it works:** building asks Safari for a screen wake lock and lets it go when the prompt is ready, fails, or you leave. Phones without it see a tip to keep the tab open.
- **Label fix:** when a prompt is under the bar and something missing is a part the app can add on its own (how long, what a great result looks like, your limits, how-to steps, a start-now ending), one small Flash-Lite call adds just those lines, the grader looks again, and the new version is kept only if it scores higher. Up to two tries, so a prompt that improves but is still under the bar gets a second pass. If it still can't reach 4.5, you get the best version with a note saying what's still weak, in plain words.
- **usage.json** holds daily Gemini request and token counts read from AI Studio screenshots (no prompts, no words, no key). Run stats shows it next to the runs counted on your device.
- **Lock your key to this site** (optional): in Google Cloud Credentials, restrict it to the website `https://kmagno94.github.io/*` and to the Generative Language API, so a leaked key is useless anywhere else.

## How it's built

- **Svelte 5 + Vite.** It builds to plain static files (about 30 KB of script, gzipped) and is tuned for Safari on iPhone, iPad, and Mac.
- **Hosted free on GitHub Pages**, published by GitHub Actions. Every push to `main` or `staging` runs the smoke tests for both versions first, so neither site gets a build that failed. See How releases work below.
- **Where things live:**

  | Path | What it is |
  |---|---|
  | `app/App.svelte` | The page markup |
  | `app/Message.svelte`, `app/Notice.svelte` | The one look for empty, error, warning, and success messages, and where each shows |
  | `app/JourneyStrip.svelte`, `app/QualityCheck.svelte`, `app/OutputMore.svelte` | Speak › Answer › Copy, the glanceable Quality check, and Show the whole prompt |
  | `app/ModePicker.svelte` | The Quick and Normal picker, the first part rebuilt as a Svelte component |
  | `app/StartHelper.svelte`, `app/lib/starter.svelte.js`, `app/lib/starters.js` | Not sure where to start?: 11 categories with tap-or-type questions and fine-tune sliders that write a starting point |
  | `app/lib/rotate.js` | Picks which 5 starter answers show, from the current 3-hour window (no storage) |
  | `app/lib/core.svelte.js`, `app/CoreEditor.svelte`, `app/CoreToggle.svelte` | Your core (USER, SOUL, IDENTITY). Testing only; remove these files, the lines marked "core" in app.js, and the "Improve this app" category in starters.js before shipping |
  | `app/ChatBuilder.svelte`, `app/lib/chat.svelte.js` | The follow-up questions as a chat: tap, type, or skip, edit any answer, live summary. See `docs/chat-builder.md` |
  | `app/lib/ui.svelte.js` | Shared app state that components react to |
  | `app/lib/app.js` | The page's behavior: Gemini calls, questions, results, idea strip, run stats |
  | `app/lib/prompts.js` | What gets sent to Gemini, and the no-key quick version |
  | `app/lib/numcheck.js` | The number check: made-up or missing numbers, weekdays that don't match their dates, and the grade dock (shared by the page and the grader bench) |
  | `app/lib/ideas.js` | The idea strip's ideas |
  | `app/app.css` | Styles and color tokens (light and dark) |
  | `ideas-done.json` | Idea ids closed by fix commits (no idea text); the Ideas tab marks them fixed, copied into the build |
  | `releases.json`, `app/lib/releases.js`, `scripts/check-release.mjs` | Every staging build with its checks, the N/5 release limit, and the deploy's release check |
  | `usage.json` | Daily Gemini usage from AI Studio screenshots, copied into the build |
  | `lessons.json` | Lessons learned: up to 6 short rules the review keeps from graded runs, added to every prompt build, copied into the build |
  | `.github/workflows/deploy.yml` | Test, build, and publish live and staging together, roll back by tag (and deploy the report Worker once its Cloudflare secrets are set) |
  | `app/ContextRow.svelte`, `app/lib/context.svelte.js` | My context (dev tools): reusable background picked per prompt |
  | `app/StartHere.svelte`, `app/lib/starthere.svelte.js` | Start here: on open, a white halo on the title and description, then a scroll to Talk it out and the box, until the first action, then the idea strip. Keeps only a yes/no flag (`stp-started`) |
  | `app/StuckNudge.svelte`, `app/lib/stuck.js` | Stuck? A sentence to finish after the box sits still about 6 seconds, aimed at what the Ghost Coach says is missing |
  | `app/CookPot.svelte`, `app/lib/cook.svelte.js` | Prompt cooking: a big ring around the timer with a kitchen inside (ingredients fly in, lid rattles when slow, boil-over on a model hand-off, plated). Staging has a `#cookdemo` preview |
  | `app/KeyboardCoach.svelte`, `app/lib/keyboard.svelte.js`, `app/lib/stuck.svelte.js` | The on-screen keyboard (`--kb`, so bars can sit on top of it), the coach bar that rides on it while you type, and the Stuck? nudge state it shares with the box |
  | `app/RoundBanner.svelte` | Rework round 2: the banner over the box and on the card, with Back to round 1 |
  | `app/IdeasTab.svelte`, `app/lib/ideas.svelte.js` | The owner-only Ideas tab: capture panel, context trail, fix session prompt |
  | `app/TestLab.svelte`, `app/lib/testlab.svelte.js`, `app/lib/testlabPlan.js` | Staging only: the 🧪 Test lab, a walkthrough of every `releases.json` check not live yet, with ✓ / ✗, notes, and the promote verdict |
  | `app/lib/channel.js` | Staging only: the STAGING badge, and the `stg:` prefix that keeps staging's saved data apart from live's |
  | `worker/report-relay.js`, `worker/wrangler.toml` | The report and run log relay on Cloudflare, and its deploy settings |

- **Run it locally:** `npm install`, then `npm run dev` and open the Network address on your iPhone (same Wi-Fi). Changes show up as you save.
- New features are built as Svelte components. Older parts move into components when they're next changed.
- Gemini is called directly from the browser. The page lists the models your key can use and builds a plan, so it keeps working when Google renames models:
  - **Questions** go to Flash-Lite first, which has the largest free daily allowance (500 requests on the free tier).
  - **The final prompt** goes to the newest Flash model first, for the best writing. Gemini rates each request as quick, standard, or complex, and the writing step thinks lightly, in a balanced way, or deeply to match. The plan and its usual time are shown before you start, and there's no rush: it only switches models if one errors out or hits its daily limit.
  - **Busy hours:** tuning.json also lists 3-hour blocks where the usual writer is busy at least half the time. There the page starts on the less busy Flash model (if the run log shows one) and starts a backup after 30 seconds instead of up to 90.
  - **Backups:** each model has its own daily limit, so when one runs out the page moves to the next. Only when every model is used up does it switch to the quick version.
- The prompt logic comes from my Prompt Optimization Engine: a short chat title, working out what the person actually needs, clarifying questions, then a prompt built from role, context, task, example, format, and tone.

## How releases work

Staging first. Live only changes through a promote.

| Step | What happens |
|---|---|
| **Capture** | Bugs, ideas and faster ways go in the 💡 Ideas tab. Anything asked for in chat but not built comes back in a "Queued for my jar" table to drop in |
| **Fix session** | Ideas tab > Copy fix session, paste into a fresh Claude chat. It checks the release limit before any code, then plans: small safe fixes in one batch, the rest one at a time |
| **Build** | All work goes to the `staging` branch. Each session is one staging build: patch version bump plus a new entry at the top of `releases.json`. Each push checks the release list, runs the quick core tests, and publishes staging at `/speak-to-prompt/staging/` with a STAGING badge and its version, in a few minutes. Live stays as it is. The full suite runs in the background on the same push (see Two test speeds below) |
| **Release limit** | Staging can be at most **5 builds** ahead of live (entries in `releases.json` newer than main's `package.json`). Past 5 the deploy stops with "Staging is 6 builds ahead of live": test and promote first. `npm run check:release` shows the count locally |
| **Test** | Open the staging Test lab on the iPhone (`/speak-to-prompt/staging/#testlab`) and walk every check: ✓ Works or ✗ Broken. For a broken one, type what happened and tap 📋 Copy report for Claude to paste straight into the chat (or send it to the 💡 Ideas jar). ▶ Continue at the top (and Continue to the next check after a ✗) always picks up the checks not marked yet. When everything passes it says Ready to promote and copies the promote phrase |
| **Promote** | Say "Pre-flight passed, promote": a pull request from `staging` into `main`. Its Promote check runs the full suite on what goes live; merge only when it's green, then tag `main` with the version (like `v2.0.1`). The main deploy runs the full suite on both versions again before live changes. Nothing else ever changes `main`. The count resets to 0/5 by itself. Ends with a ✅ table and a 🔁 Loop check (what slowed this round, did anything skip the process, one fix for the loop) |
| **Roll back** | "Roll back to vX.Y.Z" = Actions > Test and deploy > Run workflow, type the tag to go back to (like `v2.0.0`) in live_tag. That pins live to it (a `live-hold` tag) without touching `main`, and later staging pushes keep it pinned. Run it again with `main` to unpin once a fix is promoted. A manual run skips the release check, so a roll back is never blocked |
| **Audit** | A full loop audit only after a roll back, the same check failing twice, or about once a month |

- **Versions** are semver in `package.json`, shown on the staging badge. The version pill shows the commit each build came from. The newest `releases.json` entry always matches `package.json` (the release check fails otherwise).
- **`releases.json`** (repo root, copied into the build) lists every staging build, newest first: version, date, title, plain-English items, and `checks` (`say` what to do, `see` what should happen). Never anything a user typed. The logic lives in `app/lib/releases.js`; `scripts/check-release.mjs` runs it in the deploy. The loop is ported from B&B Daily's continuous improvement loop.
- **Saved data is kept apart.** Staging and live share one web address, so the staging build prefixes every saved key with `stg:`. Testing never touches live settings, and staging asks for its own Gemini key.
- **Only a normal push to `main`** deploys the report Worker, so staging work never changes the live relay.

## Tests

`npm install && npm test` (from the repo root) first runs the release list tests (`tests/releases.test.mjs`: version order, the N/5 count, and that `releases.json` matches `package.json`), then builds the app and runs smoke tests against a mocked Gemini: quick version, full flow, Quick mode, model fallback, cut-off answers, the number check, repeat shortcut runs, run stats privacy, the Talk it out link, the Copy and open app links, the simple first screen, the mode picker, the idea strip, usage.json, lessons learned, and the quality grade.

**Two test speeds.** Staging stays quick, live stays safe:

| When | What runs | Gates |
|---|---|---|
| Push to `staging` | Release check, release tests, `QUICK=1` core smoke tests (22 checks: the main journey, Gemini failures, privacy rules, Ideas tab, staging/live split). Live is rebuilt without re-testing when main's commit already passed its full run | The staging deploy (a few minutes) |
| Same push, in the background | "Full tests (staging, background)": every check | Nothing, but a failure turns the run red. Fix it before the next session |
| Pull request `staging` into `main` | "Promote check" (`.github/workflows/promote-check.yml`): release check plus every check on the live build. Fails if the pull request isn't from `staging` | The merge |
| Push to `main`, or a roll back | Every check on both versions | The live deploy |

`QUICK=1 npm test` runs the core set locally in about a minute. The core list is `CORE` in `tests/smoke.mjs`; it fails if a core check is renamed or removed, so keep the list in step.

**Fast check while working:** `ONLY=grade npm test` builds and runs only the checks whose name matches (any word or regex, case ignored, like `ONLY="grade|scorecard"`), in under a minute. It says how many it skipped. The plain `npm test` is still what ships: GitHub Actions runs every check in the background on staging, and before every promote and live deploy.

## Status

Working prototype, being tested with family. Built step by step with Claude; every change is a commit in this repo.
