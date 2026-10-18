/* "Something went wrong?" under the finished prompt.
   The report is built on demand from how the run went: timing, lengths, models,
   settings, and errors. Never the person's thoughts, answers, or prompt. Nothing
   is saved or sent by the page; the person sends it themselves (share sheet, copy,
   or, with dev tools on, a GitHub issue the review task picks up). */

export const REASONS = [
  'Missed my point',
  'Changed or lost details',
  'Too long',
  'Too short',
  "Questions didn't fit",
  'Too slow',
  'Error or got stuck',
  'Something else'
];

/* The front-page link: nothing has been built yet, so the choices are about the page itself. */
export const FRONT_REASONS = [
  'A button did nothing',
  'Something looks off',
  'Ideas got stuck',
  "Talk it out didn't work",
  'Not sure where to start broke',
  'Error message',
  'Something else'
];

const REPO_ISSUES = 'https://github.com/kmagno94/speak-to-prompt/issues/new';

/* The report relay (worker/report-relay.js on Cloudflare). Set in .env at the repo
   root; empty means reports go out through the share sheet instead. */
export const RELAY = import.meta.env.VITE_REPORT_RELAY || '';

class Report {
  run = $state(0);          // bumps on every new result, so the form starts fresh
  collect = null;           // set by app.js: (place) => [[label, value], ...]

  reset() { this.run++; }

  /* place: 'result' (under the prompt) or 'front' (the first screen). */
  text(picked, note, place = 'result') {
    const front = place === 'front';
    const lines = ['Speak to Prompt report', '', 'Where: ' + (front ? 'front page' : 'after building a prompt'), 'What went wrong: ' + (picked.length ? picked.join('; ') : 'not picked')];
    if (note.trim()) lines.push('Note: ' + note.trim());
    lines.push('', front ? 'How the page was set up (none of your words):' : 'How the run went (none of your words, answers, or prompt):');
    (this.collect ? this.collect(place) : []).forEach(([k, v]) => { if (v !== '' && v != null) lines.push('- ' + k + ': ' + v); });
    return lines.join('\n');
  }

  title(picked, place = 'result') { return 'Report: ' + (place === 'front' ? 'front page, ' : '') + (picked.length ? picked.join(', ') : 'see note'); }

  issueUrl(picked, note, place = 'result') {
    return REPO_ISSUES + '?labels=report&title=' + encodeURIComponent(this.title(picked, place)) + '&body=' + encodeURIComponent(this.text(picked, note, place));
  }

  /* One tap, no account: the relay files the GitHub issue. Resolves to the issue number. */
  relay(picked, note, place = 'result') {
    return fetch(RELAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: this.title(picked, place), body: this.text(picked, note, place) })
    }).then((r) => r.json().catch(() => ({})).then((d) => {
      if (!r.ok || !d.ok) throw new Error(d.error || 'status ' + r.status);
      return d.number;
    }));
  }
}

export const report = new Report();
