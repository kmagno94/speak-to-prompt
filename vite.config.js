import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/* "staging" when the deploy builds the staging branch (APP_CHANNEL=staging), else "live".
   lib/channel.js uses it for the STAGING badge and the separate saved data. */
const CHANNEL = process.env.APP_CHANNEL === 'staging' ? 'staging' : 'live';
const SEMVER = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8')).version;

/* The commit the page was built from, shown in problem reports. */
function appVersion() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch (e) { return 'dev'; }
}

/* version.json: the commit this build came from, so an open tab can tell when a
   newer version is live and offer to reload. */
function versionJson() {
  return {
    name: 'version-json',
    writeBundle(opts) { writeFileSync(path.join(opts.dir, 'version.json'), JSON.stringify({ version: appVersion() }) + '\n'); }
  };
}

/* "Speak to Prompt stack": the framework and build tool this repo is built with,
   read from the installed packages, so the suggested answer stays right if the
   stack ever changes (for example "Svelte 5 + Vite 8"). */
const STACK_NAMES = [['svelte', 'Svelte'], ['react', 'React'], ['vue', 'Vue'], ['solid-js', 'Solid'], ['astro', 'Astro'], ['next', 'Next.js'], ['vite', 'Vite']];
function stackLabel() {
  const parts = [];
  for (const [pkg, name] of STACK_NAMES) {
    try {
      const v = JSON.parse(readFileSync(path.join(here, 'node_modules', pkg, 'package.json'), 'utf8')).version;
      parts.push(name + ' ' + String(v).split('.')[0]);
    } catch (e) { /* not part of this stack */ }
  }
  return parts.join(' + ') || 'Svelte 5 + Vite 8';
}

/* usage.json, tuning.json, lessons.json, bench.json, and ideas-done.json stay at the repo root, where the Usage
   Check and the review task update them. This serves them in dev and copies them next to
   the built page. */
const ROOT_JSON = ['usage.json', 'tuning.json', 'lessons.json', 'bench.json', 'ideas-done.json'];
function rootJson() {
  return {
    name: 'root-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = ROOT_JSON.find((f) => req.url && new RegExp('/' + f.replace('.', '\\.') + '(\\?|$)').test(req.url));
        if (!name || !existsSync(path.join(here, name))) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(path.join(here, name)));
      });
    },
    writeBundle(opts) { for (const f of ROOT_JSON) if (existsSync(path.join(here, f))) copyFileSync(path.join(here, f), path.join(opts.dir, f)); }
  };
}

// The app's source lives in app/. GitHub Pages serves it at /speak-to-prompt/,
// so the deploy workflow passes that in BASE_PATH; locally it stays "/".
export default defineConfig({
  root: path.join(here, 'app'),
  envDir: here,
  base: process.env.BASE_PATH || '/',
  plugins: [svelte(), rootJson(), versionJson()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()), __STACK__: JSON.stringify(stackLabel()), __CHANNEL__: JSON.stringify(CHANNEL), __SEMVER__: JSON.stringify(SEMVER) },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, target: 'safari16' }
});
