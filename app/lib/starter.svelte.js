/* "Not sure where to start?" as a short chat: pick a category, answer a couple
   of tap-or-type questions, and get starting text for the main box. */
import { CATEGORIES, EXTRA, SLIDERS } from './starters.js';
import { ms } from './motion.js';
import { rotating, SHOW } from './rotate.js';

let nextId = 1;

/* Slider settings are remembered on this device, so they open where you left
   them. Only the four numbers are kept, nothing you typed. */
const TUNE_KEY = 'stp-tune';
function middle() { return Object.fromEntries(SLIDERS.map((s) => [s.key, 3])); }
function savedTune() {
  const t = middle();
  try {
    const got = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}');
    SLIDERS.forEach((s) => { const v = Number(got[s.key]); if (v >= 1 && v <= 5) t[s.key] = Math.round(v); });
  } catch (e) {}
  return t;
}

class StarterSession {
  open = $state(false);
  cat = $state(null);        // the chosen category
  answers = $state([]);      // per question: null = not asked, '' = skipped, text
  messages = $state([]);     // [{ id, from: 'ai' | 'me', text }]
  current = $state(-1);      // -1 = choosing a category; then the question index
  typing = $state(false);
  page = $state(0);          // taps on "More options" for the current question
  tune = $state(savedTune());   // fine-tune sliders, 1 to 5, remembered on this device

  questions = $derived(this.cat ? [...this.cat.questions, EXTRA] : []);
  done = $derived(this.cat !== null && this.current >= this.questions.length);
  /* The answer options showing right now: 5 from the question's pool, picked by
     the current 3-hour window. The dev-only category always shows everything. */
  choices = $derived.by(() => {
    const q = this.questions[this.current];
    if (!q) return [];
    return this.cat.dev ? q.choices.slice() : rotating(q.choices, this.cat.id + ':' + this.current, this.page);
  });
  tuned = $derived(SLIDERS.some((s) => Number(this.tune[s.key]) !== 3));
  canRotate = $derived(!!this.cat && !this.cat.dev && (this.questions[this.current]?.choices.length || 0) > SHOW);
  /* The starting text, rebuilt as answers change. */
  text = $derived.by(() => {
    if (!this.cat) return '';
    const lines = ['I need help with ' + this.cat.phrase + '.'].concat(this.cat.context || []);
    this.questions.forEach((q, i) => {
      const a = this.answers[i];
      if (a) lines.push(q.say + ': ' + a.replace(/[.\s]+$/, '') + '.');
    });
    SLIDERS.forEach((s) => {
      const said = s.steps[this.tune[s.key] - 1];
      if (said) lines.push(s.say + ': ' + said + '.');
    });
    if (this.cat.ask) lines.push(this.cat.ask);
    return lines.join('\n');
  });
  #timer = 0;

  begin() {
    clearTimeout(this.#timer);
    this.open = true; this.cat = null; this.answers = []; this.messages = [];
    this.current = -1; this.typing = false;
    const t = savedTune();
    SLIDERS.forEach((s) => { this.tune[s.key] = t[s.key]; });
    this.#say('ai', 'No problem. What do you want help with?', 'q');
    this.#say('ai', 'Pick one, or describe it in your own words.', 'help');
  }

  saveTune() {
    const t = Object.fromEntries(SLIDERS.map((s) => [s.key, Number(this.tune[s.key])]));
    try {
      if (SLIDERS.every((s) => t[s.key] === 3)) localStorage.removeItem(TUNE_KEY);
      else localStorage.setItem(TUNE_KEY, JSON.stringify(t));
    } catch (e) {}
  }

  resetTune() { SLIDERS.forEach((s) => { this.tune[s.key] = 3; }); }

  close() { clearTimeout(this.#timer); this.open = false; }

  pick(cat) {
    if (this.typing || this.cat) return;
    this.cat = cat;
    this.answers = this.questions.map(() => null);
    this.#say('me', cat.emoji + ' ' + cat.label);
    this.#ask(0);
  }

  reply(text) {
    const t = String(text || '').trim();
    if (!t || this.typing || this.done) return;
    if (!this.cat) {
      /* Typed instead of picking: treat it as "Not sure yet" with that as the topic. */
      this.cat = CATEGORIES.find((c) => c.id === 'general');
      this.answers = this.questions.map(() => null);
      this.answers[1] = t;
      this.#say('me', t);
      this.#ask(0);
      return;
    }
    const q = this.questions[this.current];
    this.answers[this.current] = q.end && t === "That's it" ? '' : t;
    this.#say('me', t);
    this.#ask(this.#nextOpen());
  }

  skip() {
    if (this.typing || !this.cat || this.done) return;
    this.answers[this.current] = '';
    this.#say('me', 'Skip');
    this.#ask(this.#nextOpen());
  }

  #nextOpen() {
    const i = this.answers.findIndex((a) => a === null);
    return i === -1 ? this.questions.length : i;
  }

  more() { if (!this.typing) this.page++; }

  /* "Paste for Improve this app" (dev tools, shortcut banner): wrap a transcript in
     the Improve this app background and your saved sliders, no questions. */
  improveText(transcript) {
    const app = CATEGORIES.find((c) => c.id === 'app');
    const lines = ['I need help with ' + app.phrase + '.'].concat(app.context || []);
    lines.push('My idea, in my own words:', String(transcript || '').trim());
    SLIDERS.forEach((s) => {
      const said = s.steps[this.tune[s.key] - 1];
      if (said) lines.push(s.say + ': ' + said + '.');
    });
    if (app.ask) lines.push(app.ask);
    return lines.join('\n');
  }

  #ask(i) {
    clearTimeout(this.#timer);
    this.current = i;
    this.page = 0;
    this.typing = true;
    this.#timer = setTimeout(() => {
      this.typing = false;
      if (i >= this.questions.length) this.#say('ai', 'Here\'s your starting point. Slide to dial anything up or down, then build your prompt or put it in the box to add more.', 'help');
      else this.#say('ai', this.questions[i].q, 'q');
    }, ms(400));
  }

  /* kind: 'q' = a question (bold), 'help' = a helper line (small and gray). */
  #say(from, text, kind = '') { this.messages.push({ id: nextId++, from, text, kind }); }
}

export const starter = new StarterSession();
