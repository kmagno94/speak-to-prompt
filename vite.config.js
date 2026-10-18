import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/* The commit the page was built from, shown in problem reports. */
function appVersion() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch (e) { return 'dev'; }
}

/* usage.json stays at the repo root, where the Usage Check and the review task
   update it. This serves it in dev and copies it next to the built page. */
function usageJson() {
  const src = path.join(here, 'usage.json');
  return {
    name: 'usage-json',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !/\/usage\.json(\?|$)/.test(req.url)) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(src));
      });
    },
    writeBundle(opts) { copyFileSync(src, path.join(opts.dir, 'usage.json')); }
  };
}

// The app's source lives in app/. GitHub Pages serves it at /speak-to-prompt/,
// so the deploy workflow passes that in BASE_PATH; locally it stays "/".
export default defineConfig({
  root: path.join(here, 'app'),
  envDir: here,
  base: process.env.BASE_PATH || '/',
  plugins: [svelte(), usageJson()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, target: 'safari16' }
});
