# Speak to Prompt

Turn messy thoughts, typed or spoken, into one ready-to-paste prompt for any AI. Stateless: nothing is saved. Built for AI beginners.

**Live:** https://kmagno94.github.io/speak-to-prompt/

## Why it exists

Most people who try ChatGPT, Claude, or Gemini get mediocre answers because they don't know how to ask. Speak to Prompt takes whatever is on your mind, in whatever shape it comes out, and turns it into a prompt that gets a great answer on the first try.

## How to use it

1. **Get your thoughts in.** Type them, or talk in Voice Memos and paste the transcript.
2. **Tap Build my prompt.**
3. **Copy the prompt** and paste it into any AI.

### Two versions

| | Quick version | With a free Gemini key |
|---|---|---|
| Setup | None | About a minute at Google AI Studio |
| Follow-up questions | Asked by the AI you paste into | Asked on the page, tap to answer: usually 1 to 3, up to 5 for complex requests |
| Result | A guided prompt that clarifies, then answers | One complete prompt your AI can start on right away |

**In a pinch?** Turn on **Quick mode** before you start to skip the questions and get a prompt in about 20 seconds, or tap **Quick prompt** on the questions card to write right away with whatever you've answered.

If Gemini is unavailable, the page falls back to the quick version and says why.

### One prompt, plus an optional note

- **One prompt to copy.** If your thoughts point in one direction, the prompt tells the AI to start right away. If they hold several directions, it asks the AI to lay them out as numbered options and let you pick first.
- **Save to Notes (optional):** after you copy the prompt, the page offers to save a structured note (date, title, tags, summary, key ideas, action items, questions, follow-up answers, clean transcript, and the prompt) through the iPhone share sheet. Saving doesn't touch your clipboard, so your prompt is still ready to paste.

The page itself still saves nothing. Your notes live in Apple Notes, on your account.

### Voice on iPhone

The **Speak to Prompt** shortcut opens Voice Memos, then brings you back to the page with one big paste button:
https://www.icloud.com/shortcuts/dd0556b734bd4c5783a3d9421a1e7876

Voice Memos transcripts are made on the phone and need iOS 18 or later on an iPhone 12 or newer.

## Privacy

- **The site saves nothing.** There is no server, no database, no analytics, and no cookies. Close or refresh the tab and everything is gone.
- **Your Gemini key** is only saved on your phone if you tick "Remember my key," and it is sent only to Google, in a request header.
- **With a key, your words go to Google** to build the prompt, and nowhere else. On Google's free tier, Google may use what you send to improve its products.
- **Lock your key to this site** (optional): in Google Cloud Credentials, restrict it to the website `https://kmagno94.github.io/*` and to the Generative Language API, so a leaked key is useless anywhere else.

## How it's built

- One `index.html` file: HTML, CSS, and plain JavaScript. No build step and no dependencies.
- Hosted free on GitHub Pages.
- Gemini is called directly from the browser. The page lists the models your key can use and builds a plan, so it keeps working when Google renames models:
  - **Questions** go to Flash-Lite first, which has the largest free daily allowance (500 requests on the free tier).
  - **The final prompt** goes to the newest Flash model first, for the best writing. Gemini rates each request as quick, standard, or complex, and the writing step thinks lightly, in a balanced way, or deeply to match. The plan and its usual time are shown before you start, and there's no rush: it only switches models if one errors out or hits its daily limit.
  - **Backups:** each model has its own daily limit, so when one runs out the page moves to the next. Only when every model is used up does it switch to the quick version.
- The prompt logic comes from my Prompt Optimization Engine: a short chat title, working out what the person actually needs, clarifying questions, then a prompt built from role, context, task, example, format, and tone.

## Status

Working prototype, being tested with family. Built step by step with Claude; every change is a commit in this repo.
