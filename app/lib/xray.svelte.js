/* What Prompt X-ray looks at, set by app.js each time a prompt is ready. */
class XrayState {
  prompt = $state('');
  run = $state(0);      // bumps on every new prompt, so X-ray starts closed
  open = $state(false); // X-ray is showing (PromptXray sets it); the Next step dock tucks away
  show = $state(false); // X-ray was asked for: the button lives in XrayBar, the view in PromptXray
  raw = '';
  answers = [];
  core = '';
  known = '';   // the context you picked: counts as yours, never flagged as left out

  set({ prompt, raw, answers, core, known }) {
    this.raw = raw || ''; this.answers = answers || []; this.core = core || ''; this.known = known || '';
    this.prompt = prompt || '';
    this.show = false;
    this.run++;
  }

  /* Clearing also drops your words (Start over forgets the transcript). */
  clear() { this.show = false; this.prompt = ''; this.raw = ''; this.answers = []; this.core = ''; this.known = ''; this.run++; }
}

export const xray = new XrayState();
