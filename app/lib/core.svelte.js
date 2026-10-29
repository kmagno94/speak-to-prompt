/* Your core: who you are (USER), how the AI should act (SOUL), and the AI's
   role (IDENTITY). When "Use my core" is on, the writer uses it to shape every
   prompt so you never have to re-explain yourself. It is never tacked onto the
   end of the finished prompt.

   DEVELOPMENT ONLY: saved in this browser (localStorage) while the app is being
   shaped, like run stats. To remove later, delete this file, CoreEditor.svelte,
   CoreToggle.svelte, and the lines in app.js marked "core". */
const KEY = 'stp-core';
/* "Show my dev tools" (More options): Your core and Improve this app only show
   when it's on. Off by default; turns itself on for a phone that already has a core. */
const DEV_KEY = 'stp-dev';
const OLD_ASK = 'Ask before assuming';
const NEW_ASK = 'Ask if something essential is missing';

function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function write(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }

class Core {
  user = $state('');       // USER.md: role, communication style, values, operating principles
  soul = $state('');       // SOUL.md: voice, tone, behavior rules
  role = $state('');       // IDENTITY.md: the AI's role (Coach, Chief of staff, ...)
  identity = $state('');   // IDENTITY.md: what that role means for you
  on = $state(true);       // the "Use my core" switch
  dev = $state(false);     // the "Show my dev tools" switch

  has = $derived(!!(this.user.trim() || this.soul.trim() || this.role || this.identity.trim()));
  active = $derived(this.dev && this.on && this.has);   // is the core added to prompts right now

  /* The block the writer reads (with a header). Never attached to the finished prompt. */
  block = $derived.by(() => {
    const parts = ['---', 'MY CORE (standing context about me; use it in every answer)'];
    if (this.user.trim()) parts.push('', 'About me:', this.user.trim());
    if (this.soul.trim()) parts.push('', 'How to work with me:', this.soul.trim());
    if (this.role || this.identity.trim()) {
      parts.push('', 'Your role with me:' + (this.role ? ' ' + this.role + '.' : ''));
      if (this.identity.trim()) parts.push(this.identity.trim());
    }
    return parts.join('\n');
  });
  /* The same without the header: plain background for the no-key quick version, and
     what counts as things you said (number check, X-ray, Quality check). */
  facts = $derived(this.block.split('\n').slice(2).join('\n').trim());

  constructor() {
    const v = read();
    if (v) { this.user = v.user || ''; this.soul = v.soul || ''; this.role = v.role || ''; this.identity = v.identity || ''; this.on = v.on !== false; }
    /* "Ask before assuming" clashed with every prompt's "start right away" ending. */
    if (this.soul.includes(OLD_ASK)) { this.soul = this.soul.split(OLD_ASK).join(NEW_ASK); this.save(); }
    let d = null;
    try { d = localStorage.getItem(DEV_KEY); } catch (e) {}
    this.dev = d === '1' || (d === null && !!v);
    if (d === null && v) this.saveDev();
  }

  save() {
    write(this.has ? { user: this.user, soul: this.soul, role: this.role, identity: this.identity, on: this.on } : null);
  }

  clear() {
    this.user = this.soul = this.role = this.identity = '';
    this.on = true;
    write(null);
  }

  /* Premade lines toggle: tap to add, tap again to remove. */
  hasLine(field, line) {
    return this[field].split('\n').some((l) => l.replace(/^-\s*/, '').trim() === line);
  }
  toggle(field, line) {
    const lines = this[field].split('\n');
    if (this.hasLine(field, line)) {
      this[field] = lines.filter((l) => l.replace(/^-\s*/, '').trim() !== line).join('\n').replace(/^\n+|\n+$/g, '');
    } else {
      const cur = this[field].trim();
      this[field] = (cur ? cur + '\n' : '') + '- ' + line;
    }
    this.save();
  }

  /* What the core adds when it's on, as plain background ("" when off). */
  get background() { return this.active ? this.facts : ''; }

  saveDev() { try { if (this.dev) localStorage.setItem(DEV_KEY, '1'); else localStorage.setItem(DEV_KEY, '0'); } catch (e) {} }
}

export const core = new Core();

/* Premade options, so you can tap instead of type. */
export const CORE_OPTIONS = {
  user: [
    { group: 'Who I am', items: ['Student', 'Working full time', 'Working part time', 'Small business owner', 'Changing careers', 'Parent', 'Creator'] },
    { group: 'How I like answers', items: ['Short and direct', 'Visual: tables and lists', 'Step by step', 'Casual, like a friend', 'Explain the why'] },
    { group: 'What I value', items: ['Progress over perfection', 'Keep it simple', 'Learn by doing', 'Save money where I can', 'Protect my time'] }
  ],
  soul: [
    { group: 'Voice and behavior', items: ['Be direct', 'Challenge me, with care', 'No hedging or filler', 'Ask if something essential is missing', 'Give one clear recommendation', 'Use plain words, no jargon', 'Keep me accountable', 'Celebrate wins briefly'] }
  ],
  roles: ['Coach', 'Chief of staff', 'Accountability partner', 'Tutor', 'Thinking partner', 'Expert advisor']
};
