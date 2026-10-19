import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/* The commit the page was built from, shown in problem reports. */
function appVersion() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch (e) { return 'dev'; }
}

/* usage.json and tuning.json stay at the repo root, where the Usage Check and
   the review task update them. This serves them in dev and copies them next to
   the built page. */
const ROOT_JSON = ['usage.json', 'tuning.json'];
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
  plugins: [svelte(), rootJson()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, target: 'safari16' }
});
