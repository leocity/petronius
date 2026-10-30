// Validates data/story/flow.json against the extracted scenes:
// referenced beats/scenes/places exist, every scene exit beat has a flow exit,
// every scene is reachable from `start`, and each ending can be reached (prints a shortest path).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'story');
const flow = JSON.parse(fs.readFileSync(path.join(DIR, 'flow.json'), 'utf8'));
const scenes = Object.fromEntries(fs.readdirSync(path.join(DIR, 'scenes')).map((f) =>
  [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(DIR, 'scenes', f), 'utf8'))]));

const problems = [];
const warn = (m) => problems.push(m);

// Beats where a scene hands control back to the app.
const exitBeats = (s) => Object.values(s.beats).filter((b) => !b.orphan && (b.waitsFor
  || b.kind === 'video'
  || (b.next ?? []).some((n) => s.beats[n.to]?.kind === 'end'))).map((b) => b.id);

for (const id of Object.keys(scenes)) if (!flow.scenes[id]) warn(`scene ${id}: missing from flow`);
for (const [id, f] of Object.entries(flow.scenes)) {
  const s = scenes[id];
  if (!s) { warn(`flow scene ${id}: no such scene`); continue; }
  if (!flow.places[f.place]) warn(`scene ${id}: unknown place ${f.place}`);
  for (const e of f.exits) {
    if (!s.beats[e.from]) warn(`scene ${id}: exit from unknown beat ${e.from}`);
    if (e.to && !scenes[e.to]) warn(`scene ${id}: exit to unknown scene ${e.to}`);
    if (e.where && !flow.places[e.where]) warn(`scene ${id}: unknown place ${e.where}`);
    if (e.via === 'ending' && !flow.endings[e.ending]) warn(`scene ${id}: unknown ending ${e.ending}`);
  }
  const covered = new Set(f.exits.map((e) => e.from));
  for (const b of exitBeats(s)) if (!covered.has(b)) warn(`scene ${id}: exit beat ${b} has no flow exit`);
}

// Every lead (and voice gate) says what the player was told: the referenced line, sentence or clue note must exist.
const clueData = JSON.parse(fs.readFileSync(path.join(DIR, 'clues.json'), 'utf8'));
for (const [id, f] of Object.entries(flow.scenes)) for (const e of f.exits) {
  if (e.via === 'ending' || e.via === 'hub') continue;
  const t = e.told;
  if (!t) { if (e.via !== 'voice') warn(`scene ${id}: exit to ${e.to} has no "told"`); continue; }
  if (t.note) { if (!clueData.clues[t.note]?.note) warn(`scene ${id}: told note ${t.note} has no note`); continue; }
  const line = scenes[t.scene ?? id]?.beats[t.beat];
  if (!line?.text) warn(`scene ${id}: told beat ${t.scene ?? id}#${t.beat} has no text`);
  else if (t.match && !line.text.toLowerCase().includes(t.match.toLowerCase())) warn(`scene ${id}: told match "${t.match}" not in ${t.scene ?? id}#${t.beat}`);
}

// Graph over scenes; "hub" exits return to the hub scene's spokes.
const hubOf = {};
for (const [id, f] of Object.entries(flow.scenes)) for (const spoke of f.hub ?? []) hubOf[spoke] = id;
// Search over (scene, scenes-learned-so-far): an exit with `requires` is only usable once those
// scenes were played, so voice keywords can't be "guessed" before the story teaches them.
const keys = [...new Set(Object.values(flow.scenes).flatMap((f) => f.exits.flatMap((e) => e.requires ?? [])))];
const exitsOf = (id) => (flow.scenes[id]?.exits ?? []).flatMap((e) =>
  e.via === 'hub' ? (flow.scenes[e.to]?.exits ?? []) : [e]);
const prev = new Map();
const reached = new Map(); // scene or END:x -> first state key reaching it
const startKey = `${flow.start}|`;
prev.set(startKey, null); reached.set(flow.start, startKey);
const queue = [startKey];
while (queue.length) {
  const state = queue.shift();
  const [id, known] = state.split('|');
  if (id.startsWith('END:')) continue;
  const learned = new Set(known ? known.split(',') : []);
  if (keys.includes(id)) learned.add(id);
  for (const e of exitsOf(id)) {
    if ((e.requires ?? []).some((r) => !learned.has(r))) continue;
    const to = e.via === 'ending' ? `END:${e.ending}` : e.to;
    if (!to) continue;
    const next = `${to}|${[...learned].sort().join(',')}`;
    if (prev.has(next)) continue;
    prev.set(next, state); queue.push(next);
    if (!reached.has(to)) reached.set(to, next);
  }
}
for (const id of Object.keys(scenes)) if (!reached.has(id)) warn(`scene ${id}: unreachable from ${flow.start}`);

const conf = {};
for (const f of Object.values(flow.scenes)) for (const e of f.exits) conf[e.confidence] = (conf[e.confidence] ?? 0) + 1;
console.log(`scenes ${Object.keys(scenes).length}, exits ${Object.values(conf).reduce((a, b) => a + b, 0)}`, conf);
for (const end of Object.keys(flow.endings)) {
  const key = reached.get(`END:${end}`);
  if (!key) { warn(`ending ${end}: unreachable`); continue; }
  const p = [];
  for (let n = key; n; n = prev.get(n)) p.unshift(n.split('|')[0]);
  console.log(`${end} (${p.length - 2} hops): ${p.join(' -> ')}`);
}
// Every image, portrait, audio and video the story data points to exists in web/assets/ (a missing one shows nothing in the game).
const WEB = path.join(DIR, '..', '..', 'web', 'assets');
const mediaData = JSON.parse(fs.readFileSync(path.join(DIR, 'media.json'), 'utf8'));
const castData = JSON.parse(fs.readFileSync(path.join(DIR, 'cast.json'), 'utf8'));
const need = (dir, file, who) => { if (file && !fs.existsSync(path.join(WEB, dir, file))) warn(`${who}: missing web/assets/${dir}/${file}`); };
const clueItems = (c) => [...(c.items ?? []), ...(c.reveal?.items ?? []), ...(c.image ? [c.image] : [])];
for (const [k, c] of Object.entries(clueData.clues)) for (const it of clueItems(c)) need('journal', it.file, `clue ${k}`);
for (const [k, group] of Object.entries(clueData.pickups ?? {})) for (const p of group) for (const it of p.items ?? []) need('journal', it.file, `pickup ${k}`);
for (const [k, group] of Object.entries(clueData.endings ?? {})) for (const it of group) need('journal', it.file, `ending ${k}`);
for (const [k, c] of Object.entries(castData.characters)) need('journal', c.file, `cast ${k}`);
for (const p of Object.values(mediaData.portraits)) need('media', p.file, 'portrait');
for (const f of Object.keys(mediaData.backgroundFiles)) need('media', f, 'background');
for (const a of [...Object.values(mediaData.audio), ...Object.values(mediaData.videos)]) need('media', a.file, 'media');

if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ` + problems.join('\n- ')); process.exitCode = 1; }
else console.log('flow OK');
