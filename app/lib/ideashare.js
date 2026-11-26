/* Shared ideas (v2.1.48, idea mwmf8i543klj): someone else testing the app (a cousin, a friend)
   logs ideas in their own 💡 Ideas jar, taps Copy my ideas to send, and texts the note to Kevin.
   Kevin taps Paste shared ideas in his jar: they come in as open ideas marked "from <name>",
   so Copy fix session hands them to Claude like his own, and ideas-done.json closes them by id
   (on both phones, since the ids travel with the note).
   No server: the site sends nothing. The note only goes where the person who copied it puts it,
   and it holds only what was typed into the Ideas panel, never the prompt box.

   Format (plain text, readable in Messages):
     Speak to Prompt · Shared ideas · from Maria · 2 ideas · 11/18
     ...how to use it...
     ## 🐞 Bug · 🔥 Now · Your prompt > Prompt quality · 2026-11-18 · v2.1.47 · id mwmf8i543klj
     what they typed
     ↳ trail: Thoughts box > Building
     ~ end of shared ideas ~
   A typed line that starts with ##, ↳ or the end line gets a \ in front so it can't split an
   idea; Paste takes it back off. Anything after the end line is ignored. */
export const HEAD = 'Speak to Prompt · Shared ideas';
export const END = '~ end of shared ideas ~';
const TRAIL = '↳ trail: ';
const SPECIAL = /^\\*(##|↳|~ end of shared ideas ~)/;
const MAX_IDEAS = 50, MAX_TEXT = 1000, MAX_NAME = 30;

const cleanName = (n) => String(n || '').replace(/[\n·]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

/* kinds/soons are the KINDS and SOON lists from ideas.svelte.js, passed in so this file stays plain JS. */
export function packIdeas(list, { from = '', kinds, soons, areaLabel = (k) => k, date = new Date() }) {
  const items = list.filter((i) => i && String(i.text || '').trim()).slice(0, MAX_IDEAS);
  const name = cleanName(from);
  const day = (date.getMonth() + 1) + '/' + date.getDate();
  const head = HEAD + (name ? ' · from ' + name : '') + ' · ' + items.length + ' idea' + (items.length === 1 ? '' : 's') + ' · ' + day;
  const how = 'Send this whole message to Kevin. He copies it and taps 📥 Paste shared ideas in his 💡 Ideas jar.';
  const esc = (t) => t.split('\n').map((l) => (SPECIAL.test(l) ? '\\' + l : l)).join('\n');
  const body = items.map((i) => {
    const k = kinds.find((x) => x.key === i.kind) || kinds[0];
    const s = soons.find((x) => x.key === i.soon) || soons[1];
    const where = String(i.where || 'Other').replace(/[\n·]/g, ' ') + (i.topicLabel ? ' > ' + String(i.topicLabel).replace(/[\n·]/g, ' ') : '');
    const top = `## ${k.icon} ${k.label} · ${s.icon} ${s.label} · ${where} · ${i.date || ''}${i.version ? ' · v' + i.version : ''} · id ${i.id}`;
    const trail = i.context?.trail?.length ? '\n' + TRAIL + i.context.trail.map(areaLabel).join(' > ') : '';
    return top + '\n' + esc(String(i.text).trim()) + trail;
  }).join('\n\n');
  return head + '\n' + how + '\n\n' + body + '\n\n' + END;
}

/* Reads a note back: { from, ideas: [{ id, kind, soon, where, topicLabel, date, version, text, trail }] },
   or null when the text isn't a shared ideas note. */
export function unpackIdeas(text, { kinds, soons }) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
  const h = lines.findIndex((l) => l.trim().startsWith(HEAD));
  if (h < 0) return null;
  const fm = lines[h].match(/· from (.+?) · \d+ ideas? ·/);
  const from = fm ? cleanName(fm[1]) : '';
  const out = [];
  let cur = null;
  for (let i = h + 1; i < lines.length && out.length <= MAX_IDEAS; i++) {
    const l = lines[i];
    if (l.trim() === END) break;
    if (l.startsWith('## ')) {
      const parts = l.slice(3).split(' · ');
      const idm = parts[parts.length - 1].match(/^id ([a-z0-9]{6,20})$/);
      if (!idm) { cur = null; continue; }
      const k = kinds.find((x) => parts[0] === x.icon + ' ' + x.label) || kinds[0];
      const s = soons.find((x) => parts[1] === x.icon + ' ' + x.label) || soons[1];
      const version = (parts.find((p) => /^v\d+\.\d+\.\d+$/.test(p)) || '').slice(1);
      const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || '';
      const [where, topicLabel = ''] = String(parts[2] || 'Other').split(' > ');
      cur = { id: idm[1], kind: k.key, soon: s.key, where: where.trim(), topicLabel: topicLabel.trim(), date, version, text: [], trail: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (l.startsWith(TRAIL)) { cur.trail = l.slice(TRAIL.length).split(' > ').map((x) => x.trim()).filter(Boolean); continue; }
    cur.text.push(l.replace(/^\\(\\*(?:##|↳|~ end of shared ideas ~))/, '$1'));
  }
  return {
    from,
    ideas: out.slice(0, MAX_IDEAS).map((c) => ({ ...c, text: c.text.join('\n').trim().slice(0, MAX_TEXT) })).filter((c) => c.text)
  };
}
