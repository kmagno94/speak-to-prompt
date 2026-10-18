/* What Prompt X-ray looks at, set by app.js each time a prompt is ready. */
class XrayState {
  prompt = $state('');
  run = $state(0);      // bumps on every new prompt, so X-ray starts closed
  raw = '';
  answers = [];
  core = '';

  set({ prompt, raw, answers, core }) {
    this.raw = raw || ''; this.answers = answers || []; this.core = core || '';
    this.prompt = prompt || '';
    this.run++;
  }

  clear() { this.prompt = ''; this.run++; }
}

export const xray = new XrayState();
