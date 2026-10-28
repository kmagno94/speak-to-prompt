/* Prompt cooking (idea mvlhezlg09c9): what the pot around the timer shows. app.js fills
   this in from the progress tracker; CookPot.svelte draws it. Labels and numbers only,
   never anything typed. Memory only.
   - place: which tracker is cooking ('build' = reading your thoughts, 'result' = writing)
   - stage: 'read' | 'write'      pct: the progress bar's %     over: past the usual time
   - ingredients: plain labels that drop into the pot (Your thoughts, Your answers, ...)
   - switches: a model stalled or ran out and another took over (the "boiled over" bit)
   - back: when you came back to the page mid-build (#4: "welcome back, still simmering")
   - done: plated */
export const cook = $state({ place: null, stage: 'read', pct: 0, over: false, ingredients: [], switches: 0, back: 0, done: false, run: 0 });

export function cookStart(place, stage, ingredients) {
  Object.assign(cook, { place, stage, pct: 2, over: false, ingredients, switches: 0, back: 0, done: false, run: cook.run + 1 });
}
export function cookStop() { cook.place = null; }

/* Staging only: open /staging/#cookdemo to watch one full cook without calling Gemini,
   including the boil-over that normally needs a busy model. The Test lab links here. */
export function cookDemo() {
  const track = document.getElementById('buildTrack');
  if (!track) return;
  track.hidden = false;
  cookStart('build', 'write', ['Your thoughts', 'Your answers', 'Lessons learned']);
  let pct = 2;
  const tick = setInterval(() => { pct = Math.min(90, pct + 9); cook.pct = pct; }, 500);
  setTimeout(() => { cook.switches++; }, 3000);
  setTimeout(() => { clearInterval(tick); cook.pct = 100; cook.done = true; }, 6500);
  setTimeout(() => { cookStop(); track.hidden = true; }, 10000);
}
