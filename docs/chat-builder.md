# Chat builder: how the follow-up questions work (Svelte 5 + Vite)

The follow-up questions are a short chat. Gemini's intake step returns up to five questions, each with a few likely answers. The chat asks them one at a time, the person taps an answer, types their own, or skips, and a live list shows what is going into the prompt. **Write my prompt** sends the answers to the writer.

## The approach, and why

**One reactive session object plus small components that only read it.**

- `app/lib/chat.svelte.js` holds the whole conversation in one class, `ChatSession`, using `$state` fields and `$derived` values. Every change goes through its methods: `start`, `reply`, `skip`, `edit`, `finish`, `reset`.
- `app/ChatBuilder.svelte` draws it: the message thread, the quick-reply buttons, the type-your-own box, the "Going into your prompt" list, and the Write and Quick buttons.

Why this shape:

- **One source of truth.** The thread, the buttons, and the summary all read the same object, so they can't disagree. Before, answers were read back out of the page, which is fragile.
- **Easy to test and reuse.** The logic doesn't touch the page, so it can be checked without a browser, and a different screen (a full-screen chat, the Prompt Bubbles game) could reuse it.
- **Plays well with the older code.** `app.js` only calls `chat.start(...)`, `chat.reset()`, and sets `chat.busy`. It never edits the chat's markup, so Svelte stays in charge of that DOM.

## Svelte 5 and Vite features in use

| Feature | Where | What it does here |
|---|---|---|
| `$state` in a class (`.svelte.js` file) | `chat.svelte.js` | Reactive fields shared across components without stores |
| `$derived` | `done`, `brief` | The summary list and the finished state update themselves |
| `$effect` | `ChatBuilder.svelte` | Scrolls the newest message into view when a message lands |
| Private fields (`#timer`, `#ask`) | `chat.svelte.js` | Internals components can't call by mistake |
| `{#snippet}` and `{@render}` | `bubble(m)` | One template for "their" and "your" bubbles |
| `bind:value`, `bind:this` | composer, thread | Two-way text box; a handle on the thread for scrolling |
| Event attributes (`onclick`, `onsubmit`) | everywhere | Svelte 5's plain event syntax |
| `in:fly`, `animate:flip` | messages, summary | Messages rise in; summary rows slide when an answer changes |
| Keyed `{#each ... (m.id)}` | thread, summary | Stable identity, so animations and edits hit the right row |
| Vite dev server with `--host` | `npm run dev` | Live reload on the iPhone over Wi-Fi while building |
| Vite build target `safari16` | `vite.config.js` | Modern output for Apple devices |

## The UX patterns

- **One question at a time**, with a short "..." bubble first so it reads like a conversation, not a form.
- **Quick replies under the newest question:** Gemini's likely answers plus **Skip**. They disappear once answered, so only the current question is tappable.
- **Type your own** in a rounded box. The Return key sends (`enterkeyhint="send"`), and the font is 16px so iPhone doesn't zoom.
- **Change anything:** tap your earlier reply bubble, or a row in "Going into your prompt", and that question is asked again. The new answer replaces the old one.
- **Finish whenever:** Write my prompt and Quick prompt are always there. Unanswered questions are simply left out.
- **Accessible:** the thread is a `role="log"` with polite announcements, buttons have clear labels, and Reduce Motion turns off every animation and the typing delay.

## How it works, step by step

1. **Build my prompt** runs the intake step (`app.js`). Gemini returns a title, the need, and questions with choices.
2. `renderQuestions(intake)` calls `chat.start(intake, planText)` and shows the card.
3. `start` resets everything, adds the "Got it" message, and calls `#ask(0)`: `typing` turns on, then after 0.45s the question becomes a message.
4. Tapping a choice calls `chat.reply(choice)`. It stores the answer, adds your bubble, and asks the next question that hasn't been answered yet. Typing works the same way. **Skip** stores an empty answer, so it's asked once and left out.
5. `edit(i)` makes question `i` current again. After you answer, the chat continues with the first question that was never asked, or says it's done.
6. **Write my prompt** calls `chat.finish(false)`, which hands `{question, answer}` pairs to `chat.onFinish`. `app.js` set that to `writeFinal`, which keeps the non-empty answers and sends them to the writer.
7. While writing, `app.js` sets `chat.busy = true`, which disables every chat button.

## Limits, pitfalls, and how to troubleshoot

- **Don't destructure state.** `const { answers } = chat` loses reactivity. Always read `chat.answers`.
- **Sending state to an API:** state objects are proxies. Use `$state.snapshot(x)` or build plain objects (as `finish` does) before `JSON.stringify` or `fetch`.
- **Effects that write what they read loop forever.** The scroll effect only reads; keep it that way. To read without subscribing, use `untrack`.
- **Never edit Svelte-owned markup from `app.js`.** Svelte will overwrite or lose it. Go through the session object instead. (The old `qaList.textContent = ""` reset had to become `chat.reset()` for this reason.)
- **Timers outlive restarts.** A restart mid-typing would post a stale question, so `#timer` is cleared in `reset` and `edit`. Clear any new timers the same way.
- **The iPhone keyboard covers the bottom.** The box sits just under the thread and `scrollIntoView({block: 'nearest'})` keeps the newest message visible. If it ever hides behind the keyboard, scroll on `visualViewport` resize.
- **Animations:** only `transform` and `opacity` move, and `ms()` in `lib/motion.js` sets them to 0 for Reduce Motion.
- **Hot reload resets the chat.** Vite reloads `chat.svelte.js` on save, so an in-progress chat starts over in dev. That's expected.
- **Tests:** `tests/smoke.mjs` covers tap, type, skip, edit, the live summary, and exactly which answers reach the writer. Run `npm test`. If a selector changes, update the test in the same commit.
