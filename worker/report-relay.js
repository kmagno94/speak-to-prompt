/* Speak to Prompt report relay (Cloudflare Worker).

   The app's "Send report" button posts here, and this files a GitHub issue
   labeled "report" so the twice-daily review picks it up. People sending a
   report need no account. The GitHub key lives only in this Worker's secret
   settings (GITHUB_TOKEN), never in the app's public code.

   Setup: paste this whole file into a new Worker, then add a Secret named
   GITHUB_TOKEN: a fine-grained GitHub token for kmagno94/speak-to-prompt only,
   with Issues: Read and write and nothing else.

   Updates: GitHub Actions deploys this file after the tests pass (deploy.yml,
   wrangler.toml) once the repo has CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
   secrets. Until then, paste it by hand. Deploys never touch GITHUB_TOKEN.

   Guards: only the app's own web address, only report-shaped text, size caps,
   a few reports per person per hour, no @mentions, and the label is fixed here.

   POST /run: automatic run stats (only from phones with "Show run stats" on).
   Each run becomes one comment on the locked Run log issue (#2). Numbers and
   short labels only: unknown fields, long text, and nested data are dropped. */

const REPO = 'kmagno94/speak-to-prompt';
const ALLOWED_ORIGINS = ['https://kmagno94.github.io'];
const MAX_TITLE = 120;
const MAX_BODY = 4000;
const PER_HOUR = 5;            // reports per person (by IP), best effort
const RUNS_PER_HOUR = 60;      // run stats per person (by IP), best effort
const RUN_LOG_ISSUE = 2;       // the locked "Run log (automatic)" issue
const hits = new Map();         // key -> [timestamps], lives only in this Worker's memory

/* The only run fields accepted, in the order they're shown. */
const RUN_FIELDS = ['app', 'device', 'mode', 'complexity', 'depth', 'est_intake_s', 'est_s', 'est_from', 'intake_model', 'intake_s', 'intake_tokens', 'write_model', 'thinking',
  'write_s', 'write_tokens', 'thinking_tokens', 'detours', 'words_in', 'questions', 'answered', 'tapped', 'words_out', 'num_flags', 'coach', 'xray_pct', 'xray_dropped', 'xray_stray', 'repair', 'repair_s', 'core', 'outcome', 'action', 'xray_opened', 'hidden_s',
  'lessons_v', 'busy_plan', 'grade', 'grade_rearranged', 'grade_invented', 'grade_missing', 'grade_model', 'grade_s'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function reply(status, data, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? cors(origin) : {}) }
  });
}

function tooMany(ip, now, limit = PER_HOUR) {
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= limit) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();   // keep memory small
  return false;
}

/* Plain text only: no pings (@name), no hidden HTML, no control characters. */
function clean(text, max) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/@(?=\w)/g, '@​')
    .slice(0, max)
    .trim();
}

/* One run -> one short comment. Only known fields; values must be numbers,
   true or false, or short text. Returns '' if nothing usable is left. */
function runComment(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return '';
  const rows = [];
  for (const k of RUN_FIELDS) {
    const v = run[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number' && isFinite(v)) rows.push('| ' + k + ' | ' + v + ' |');
    else if (typeof v === 'boolean') rows.push('| ' + k + ' | ' + (v ? 'yes' : 'no') + ' |');
    else if (typeof v === 'string') rows.push('| ' + k + ' | ' + clean(v, 160).replace(/[|\n]/g, ' ') + ' |');
  }
  if (!rows.length || run.mode === undefined) return '';
  return '**Run ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC**\n\n| field | value |\n|---|---|\n' + rows.join('\n');
}

async function github(env, path, payload) {
  return fetch('https://api.github.com/repos/' + REPO + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'speak-to-prompt-report-relay',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '';

    if (request.method === 'OPTIONS') {
      return allowed ? new Response(null, { status: 204, headers: cors(allowed) }) : new Response(null, { status: 403 });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Use POST' }, allowed);
    if (!allowed) return reply(403, { ok: false, error: 'Not from the app' }, '');
    if (!env.GITHUB_TOKEN) return reply(500, { ok: false, error: 'Relay is missing its GitHub key' }, allowed);

    let data;
    try { data = await request.json(); } catch (e) { return reply(400, { ok: false, error: 'Bad report' }, allowed); }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/run') {
      const body = runComment(data && data.run);
      if (!body || body.length > 4000) return reply(400, { ok: false, error: 'Not a run record' }, allowed);
      if (tooMany('run:' + ip, Date.now(), RUNS_PER_HOUR)) return reply(429, { ok: false, error: 'Too many runs' }, allowed);
      const gh = await github(env, '/issues/' + RUN_LOG_ISSUE + '/comments', { body });
      if (!gh.ok) return reply(502, { ok: false, error: 'GitHub said ' + gh.status }, allowed);
      return reply(201, { ok: true }, allowed);
    }
    const title = clean(data && data.title, MAX_TITLE);
    const body = clean(data && data.body, MAX_BODY);
    if (!title.startsWith('Report:') || !body.startsWith('Speak to Prompt report')) {
      return reply(400, { ok: false, error: 'Not a Speak to Prompt report' }, allowed);
    }

    if (tooMany(ip, Date.now())) return reply(429, { ok: false, error: 'Too many reports. Try again in an hour.' }, allowed);

    const gh = await github(env, '/issues', { title, body: body + '\n\n_Sent from the app\'s Something went wrong? button._', labels: ['report'] });
    if (!gh.ok) return reply(502, { ok: false, error: 'GitHub said ' + gh.status }, allowed);
    const issue = await gh.json();
    return reply(201, { ok: true, number: issue.number }, allowed);
  }
};
