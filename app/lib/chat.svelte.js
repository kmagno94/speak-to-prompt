/* The follow-up questions as a chat. One reactive object holds the whole
   conversation; components only read it and call its methods, so the thread,
   the quick-reply buttons, and the "Going into your prompt" list can never
   disagree with each other. */
import { ms } from './motion.js';

let nextId = 1;

class ChatSession {
  title = $state('');
  need = $state('');
  plan = $state('');
  questions = $state([]);   // [{ question, choices }]
  answers = $state([]);     // per question: null = not asked yet, '' = skipped, text = answer
  messages = $state([]);    // [{ id, from: 'ai' | 'me', text, q }]
  current = $state(-1);     // question being asked; questions.length when all are done
  typing = $state(false);   // the "..." bubble before the next question
  busy = $state(false);     // a prompt is being written

  done = $derived(this.questions.length > 0 && this.current >= this.questions.length);
  /* What the person has told us so far, in question order, for the live summary. */
  brief = $derived(
    this.questions
      .map((q, i) => ({ i, question: q.question, answer: this.answers[i] }))
      .filter((a) => a.answer)
  );

  onFinish = null;          // set by app.js: (answers, quick) => write the prompt
  #timer = 0;

  start(intake, plan) {
    this.reset();
    this.title = intake.title || "Let's get the details right";
    this.need = intake.need || '';
    this.plan = plan || '';
    this.questions = intake.questions;
    this.answers = intake.questions.map(() => null);
    this.#say('ai', 'Got it. ' + (intake.questions.length === 1 ? 'One quick question' : intake.questions.length + ' quick questions') + ' so your prompt gets it right. Tap an answer, type your own, or skip.');
    this.#ask(0);
  }

  reset() {
    clearTimeout(this.#timer);
    this.title = this.need = this.plan = '';
    this.questions = []; this.answers = []; this.messages = [];
    this.current = -1; this.typing = false;
  }

  reply(text) {
    const t = String(text || '').trim();
    if (!t || this.typing || this.current < 0 || this.done) return;
    this.answers[this.current] = t;
    this.#say('me', t, this.current);
    this.#ask(this.#nextOpen());
  }

  skip() {
    if (this.typing || this.current < 0 || this.done) return;
    this.answers[this.current] = '';
    this.#say('me', 'Skip', this.current);
    this.#ask(this.#nextOpen());
  }

  /* Tap an earlier answer to change it: that question is asked again. */
  edit(i) {
    if (this.busy || i == null || i < 0 || i >= this.questions.length) return;
    clearTimeout(this.#timer);
    this.typing = false;
    this.current = i;
    this.#say('ai', 'Sure, let\'s change that. ' + this.questions[i].question, i);
  }

  finish(quick) {
    if (this.busy || !this.onFinish) return;
    const answers = this.questions.map((q, i) => ({ question: q.question, answer: this.answers[i] || '' }));
    this.onFinish(answers, !!quick);
  }

  #nextOpen() {
    const i = this.answers.findIndex((a) => a === null);
    return i === -1 ? this.questions.length : i;
  }

  #ask(i) {
    clearTimeout(this.#timer);
    this.current = i;
    this.typing = true;
    this.#timer = setTimeout(() => {
      this.typing = false;
      if (i >= this.questions.length) this.#say('ai', 'That\'s everything I need. Tap Write my prompt when you\'re ready, or tap any answer to change it.');
      else this.#say('ai', this.questions[i].question, i);
    }, ms(450));
  }

  #say(from, text, q = null) {
    this.messages.push({ id: nextId++, from, text, q });
  }
}

export const chat = new ChatSession();
