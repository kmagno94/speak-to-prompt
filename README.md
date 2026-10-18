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
- **Save to Notes (optional):** after you copy the prompt, the page offers to save a structured note (date, title, tags, summary, key ideas, action items, questions, follow-up answers, clean transcript, and the prompt) in your original voice-note layout. With **Use my Notes shortcuts** on (More options, iPhone and iPad only, off by default), it runs the **Save Voice Note** shortcut, which creates the note straight in the 💪Process Voice Note💪 folder (the note is also copied as a backup, so tap Copy prompt again before pasting into your AI). **Share instead** opens the share sheet if the shortcut isn't installed. With the switch off, and on computers, it uses the share sheet or copy.
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
