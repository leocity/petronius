// Fills `lat`/`lng` of data/story/flow.json places that lack them, via OpenStreetMap Nominatim
// (1 request/second as per its usage policy). Re-run after adding places; existing coordinates are kept.
// A place may set `geo` to override the query (e.g. a single street number instead of a range).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'story', 'flow.json');
const flow = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "Via Schiaffino 20-32, Milano" -> "Via Schiaffino 20, Milano"; "A / B, Milano" -> "A, Milano"
const query = (p) => p.geo ?? p.address.replace(/(\d+)-\d+/, '$1').replace(/ \/ [^,]+/, '');

for (const [id, p] of Object.entries(flow.places)) {
  if (p.lat != null) continue;
  const q = query(p);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'petronius-revival/0.1 (university project archive)' } });
  if (!res.ok) { console.log(`${id.padEnd(16)} HTTP ${res.status} (${q}): stopped, re-run later`); break; }
  const [hit] = await res.json();
  if (hit) { p.lat = +(+hit.lat).toFixed(6); p.lng = +(+hit.lon).toFixed(6); }
  console.log(`${id.padEnd(16)} ${hit ? `${p.lat}, ${p.lng}` : 'NOT FOUND'}  (${q})`);
  await sleep(1100);
}
fs.writeFileSync(FILE, JSON.stringify(flow, null, 2) + '\n');
