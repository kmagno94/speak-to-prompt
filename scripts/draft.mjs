#!/usr/bin/env node
/* Grading session drafts. A draft is lessons.draft.json (not committed). The app
   loads it from a link (#draft=<base64url JSON>) on one device, with no push.

   node scripts/draft.mjs start          copy lessons.json to the draft (if none yet)
   node scripts/draft.mjs link           check the draft, print its link
   node scripts/draft.mjs load "<link>"  rebuild the draft from a link (new session)
   node scripts/draft.mjs diff           what the draft changes vs lessons.json
   node scripts/draft.mjs promote        check the draft, write it to lessons.json

   DRAFT=<path> uses another draft file; BASE=<url> sets the link's site. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(ROOT, 'lessons.json');
const DRAFT = process.env.DRAFT || path.join(ROOT, 'lessons.draft.json');
const BASE = process.env.BASE || 'https://kmagno94.github.io/speak-to-prompt/';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const save = (f, j) => writeFileSync(f, JSON.stringify(j, null, 2) + '\n');

/* Same rules as the lessons.json smoke check, plus unique ids. */
export function problems(j) {
  const out = [];
  if (typeof j.version !== 'number' || typeof j.grader_version !== 'number') out.push('version and grader_version must be numbers');
  for (const k of ['lessons', 'grader']) {
    if (!Array.isArray(j[k])) { out.push(k + ' must be a list'); continue; }
    if (j[k].length > 6) out.push(k + ' has ' + j[k].length + ' items (max 6)');
    const ids = new Set();
    for (const l of j[k]) {
      if (!l.id || ids.has(l.id)) out.push(k + ': missing or repeated id ' + l.id);
      ids.add(l.id);
      if (!l.text || l.text.length > 240) out.push(l.id + ': text must be 1 to 240 characters');
      if (/—|@/.test(l.text || '')) out.push(l.id + ': no em dashes or @');
      if (!l.why) out.push(l.id + ': needs a why');
    }
  }
  return out;
}
export function linkFor(j, base = BASE) {
  const slim = { version: j.version, grader_version: j.grader_version, lessons: j.lessons, grader: j.grader };
  return base + '#draft=' + Buffer.from(JSON.stringify(slim), 'utf8').toString('base64url');
}
function check(j) { const p = problems(j); if (p.length) { console.error('Draft has problems:\n- ' + p.join('\n- ')); process.exit(1); } }
function diff(a, b) {
  const lines = [];
  for (const k of ['lessons', 'grader']) {
    const old = new Map((a[k] || []).map((l) => [l.id, l.text]));
    for (const l of b[k] || []) {
      if (!old.has(l.id)) lines.push('+ ' + l.id + ': ' + l.text);
      else if (old.get(l.id) !== l.text) lines.push('~ ' + l.id + ': ' + l.text);
      old.delete(l.id);
    }
    for (const id of old.keys()) lines.push('- ' + id + ' (removed)');
  }
  return lines;
}

const [cmd, arg] = process.argv.slice(2);
if (import.meta.url === 'file://' + process.argv[1]) {
  if (cmd === 'start') {
    if (existsSync(DRAFT)) console.log('Draft already exists: ' + DRAFT);
    else { save(DRAFT, read(LIVE)); console.log('Draft started from lessons.json: ' + DRAFT); }
  } else if (cmd === 'link') {
    const j = read(DRAFT); check(j); console.log(linkFor(j));
  } else if (cmd === 'load') {
    const m = String(arg || '').match(/#draft=([A-Za-z0-9_-]+)/);
    if (!m) { console.error('No #draft= in that link'); process.exit(1); }
    const j = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    const live = read(LIVE);
    save(DRAFT, { ...live, ...j }); console.log('Draft rebuilt from the link: ' + DRAFT);
  } else if (cmd === 'diff') {
    const d = diff(read(LIVE), read(DRAFT)); console.log(d.length ? d.join('\n') : 'No changes from lessons.json');
  } else if (cmd === 'promote') {
    const live = read(LIVE), j = read(DRAFT); check(j);
    const d = diff(live, j);
    if (!d.length && j.version === live.version && j.grader_version === live.grader_version) { console.log('Nothing to promote'); process.exit(0); }
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    save(LIVE, { ...live, ...j, note: live.note, updated: stamp });
    console.log('Promoted to lessons.json (lessons v' + j.version + ', g' + j.grader_version + '):\n' + d.join('\n'));
  } else {
    console.log('Use: start, link, load "<link>", diff, or promote');
    process.exit(1);
  }
}
