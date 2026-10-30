// Story data: data/story/flow.json (hand-curated scene flow) + data/story/scenes/<id>.json (extracted scenes).
const BASE = new URL('../../data/story/', import.meta.url);
const cache = new Map();

export let flow = null;
export let clues = null;   // data/story/clues.json: digital versions of the paper journal's clues
export let cast = null;    // data/story/cast.json: portraits and bios from the character cards
export let media = null;   // data/story/media.json: the original game's backgrounds, portraits, audio, videos

export async function loadFlow() {
  [flow, clues, cast, media] = await Promise.all(['flow.json', 'clues.json', 'cast.json', 'media.json'].map(async (f) => (await fetch(new URL(f, BASE))).json()));
  return flow;
}

export const clueFor = (scene, beat) => clues.clues[`${scene}#${beat}`];
export const assetUrl = (file) => new URL(`../assets/journal/${file}`, import.meta.url).href;
export const mediaUrl = (file) => new URL(`../assets/media/${file}`, import.meta.url).href;

// Background of a beat: the one the original CSS set on the beat's #containerN.
export function backgroundFor(sceneId, beat) {
  const bgs = media.backgrounds[sceneId];
  if (!bgs) return null;
  const file = bgs[beat?.container ?? 'container'] ?? bgs.container ?? Object.values(bgs)[0];
  return file ? mediaUrl(file) : null;
}

// Portrait of a speaker: the variant the beat used (inside/outside), unless it names another character.
export function figureFor(who, beat) {
  let name = beat?.portrait?.asset?.replace(/\.png$/, '');
  if (!name || !name.startsWith(who) || !media.portraits[name]) name = media.portraitDefault[who];
  return name ? mediaUrl(media.portraits[name].file) : null;
}

const loaded = new Map();   // scenes already fetched, readable synchronously
// The cut-out portraits are small (about 70 KB each): load them up front so a character never pops in late.
export function preloadFigures() {
  for (const p of Object.values(media.portraits)) new Image().src = mediaUrl(p.file);
}

export async function loadScene(id) {
  if (!cache.has(id)) cache.set(id, fetch(new URL(`scenes/${id}.json`, BASE)).then((r) => { const d = r.json(); d.then((x) => loaded.set(id, x)); return d; }));
  return cache.get(id);
}
export const sceneIfLoaded = (id) => loaded.get(id);

export const place = (id) => flow.places[id];
export const sceneFlow = (id) => flow.scenes[id];

export const CHARACTERS = {
  petronio: 'Petronio', sirio: 'Sirio', yda: 'Yda', minerva: 'Minerva',
  roberto: 'Roberto', guido: 'Guido', gabriele: 'Gabriele', su: 'Su',
};

// "What the player was told" (flow.json `told`): { who, text } or null.
//   { note } -> the note of that clue; { scene?, beat, match? } -> a line (the sentence containing `match`, else all of it).
export function resolveTold(told, sceneId) {
  if (!told) return null;
  if (told.note) { const note = clues.clues[told.note]?.note; return note ? { who: 'Notebook', text: note } : null; }
  const line = sceneIfLoaded(told.scene ?? sceneId)?.beats[told.beat];
  if (!line?.text) return null;
  let text = line.text.replace(/\s+/g, ' ').trim();
  if (told.match) {
    const sentences = text.match(/[^.!?…]+[.!?…]*/g)?.map((x) => x.trim()) ?? [];
    text = sentences.find((x) => x.toLowerCase().includes(told.match.toLowerCase())) ?? text;
  }
  return { who: CHARACTERS[line.speaker] ?? line.speaker ?? '', text };
}
