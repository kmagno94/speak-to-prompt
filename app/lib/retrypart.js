/* Try again for a part of the page that didn't load (Lazy.svelte, AGT-228). Some browsers
   remember a failed import() for that address until a reload, so the retry asks for the built
   file under a fresh address. The file name is read from the load function's own code; if
   there is none (the dev server), it just calls load again. */
const bust = () => '?retry=' + Date.now();

/* A style sheet that never arrived has no sheet, or one the browser won't let us read. */
const empty = (l) => { try { return !l.sheet || !l.sheet.cssRules; } catch (e) { return true; } };

/* A part's styles that failed the first time are still on the page: fetch them again. */
function restyle() {
  const failed = [...document.querySelectorAll('link[rel="stylesheet"][href*="/assets/"]')].filter(empty);
  return Promise.all(failed.map((old) => new Promise((ok, no) => {
    const l = old.cloneNode();
    l.href = old.href.split('?')[0] + bust();
    l.onload = ok;
    l.onerror = () => no(new Error('styles did not load'));   /* it stays, so the next try finds it */
    old.replaceWith(l);
  })));
}

/* Parts that only loaded on a retry: opening one again reuses it, since the browser may still
   remember the first failure. */
const got = new Map();
export const loadPart = (load) => got.get(load) || load();

export async function retryPart(load) {
  const file = (String(load).match(/import\(\s*[`'"]\.\/([\w.-]+\.js)[`'"]/) || [])[1];
  if (!file) return load();
  await restyle();
  const m = await import(/* @vite-ignore */ import.meta.url.replace(/[^/]*$/, '') + file + bust());
  got.set(load, m);
  return m;
}
