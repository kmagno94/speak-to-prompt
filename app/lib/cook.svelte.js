/* Prompt cooking (idea mvlhezlg09c9): what the kitchen around the timer shows. app.js fills
   this in from the progress tracker; CookPot.svelte draws it. Labels and numbers only,
   never anything typed. Memory only.
   - place: which tracker is cooking ('build' = reading your thoughts, 'result' = writing)
   - stage: 'read' | 'write'      pct: the progress %      over: past the usual time
   - el, left, elLbl: the timer's own text, shown inside the ring
   - ingredients: plain labels that fly into the pot (Your thoughts, Your answers, ...)
   - switches: a model stalled or ran out and another took over (the boil-over)
   - back: when you came back to the page mid-build (#4: "welcome back")
   - done: plated */
export const cook = $state({ place: null, stage: 'read', pct: 0, over: false, el: '0:00', left: '', elLbl: 'elapsed', ingredients: [], switches: 0, back: 0, done: false, run: 0 });

export function cookStart(place, stage, ingredients) {
  Object.assign(cook, { place, stage, pct: 2, over: false, el: '0:00', left: '', elLbl: 'elapsed', ingredients, switches: 0, back: 0, done: false, run: cook.run + 1 });
}
export function cookStop() { cook.place = null; }

/* Copy the tracker's timer text into the ring. */
export function cookClock(track) {
  if (!track || cook.place !== (track.id === 'buildTrack' ? 'build' : 'result')) return;
  const t = (s) => (track.querySelector(s) || {}).textContent || '';
  const left = t('.left'), lbl = t('.leftlbl');
  cook.el = t('.el') || '0:00';
  cook.elLbl = t('.nums small') || 'elapsed';
  cook.left = left === 'Done' ? (lbl ? 'Done, ' + lbl : 'Done') : left === 'Almost there' ? 'Almost there' : left ? 'about ' + left + ' left' : '';
}

/* Staging only: open /staging/#cookdemo to watch one full cook without calling Gemini:
   ingredients flying in, a stall (lid rattles), a boil-over, and plating. */
export function cookDemo() {
  const track = document.getElementById('buildTrack');
  if (!track) return;
  track.hidden = false;
  track.querySelector("li[data-step='write']")?.classList.add('active');
  cookStart('build', 'write', ['Your thoughts', 'Your answers', 'Your context', 'Lessons learned']);
  const t0 = Date.now(), clock = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const tick = setInterval(() => {
    const s = (Date.now() - t0) / 1000;
    cook.pct = Math.min(95, Math.round(95 * (1 - Math.exp(-s / 5))));
    cook.el = clock(s);
    cook.left = cook.over ? 'Almost there' : 'about ' + clock(Math.max(0, 6 - s)) + ' left';
  }, 250);
  setTimeout(() => { cook.over = true; }, 6000);
  setTimeout(() => { cook.switches++; }, 10000);
  setTimeout(() => { clearInterval(tick); cook.pct = 100; cook.left = 'Done'; cook.done = true; }, 14500);
  setTimeout(() => { cookStop(); track.hidden = true; }, 21000);
}
