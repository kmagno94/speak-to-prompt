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

const REPO_ISSUES = 'https://github.com/kmagno94/speak-to-prompt/issues/new';

class Report {
  open = $state(false);
  run = $state(0);          // bumps on every new result, so the form starts fresh
  collect = null;           // set by app.js: () => [[label, value], ...] for this run

  reset() { this.open = false; this.run++; }

  text(picked, note) {
    const lines = ['Speak to Prompt report', '', 'What went wrong: ' + (picked.length ? picked.join('; ') : 'not picked')];
    if (note.trim()) lines.push('Note: ' + note.trim());
    lines.push('', 'How the run went (none of your words, answers, or prompt):');
    (this.collect ? this.collect() : []).forEach(([k, v]) => { if (v !== '' && v != null) lines.push('- ' + k + ': ' + v); });
    return lines.join('\n');
  }

  issueUrl(picked, note) {
    const title = 'Report: ' + (picked.length ? picked.join(', ') : 'see note');
    return REPO_ISSUES + '?labels=report&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(this.text(picked, note));
  }
}

export const report = new Report();
