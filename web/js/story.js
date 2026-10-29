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

export async function loadScene(id) {
  if (!cache.has(id)) cache.set(id, fetch(new URL(`scenes/${id}.json`, BASE)).then((r) => r.json()));
  return cache.get(id);
}

export const place = (id) => flow.places[id];
export const sceneFlow = (id) => flow.scenes[id];

export const CHARACTERS = {
  petronio: 'Petronio', sirio: 'Sirio', yda: 'Yda', minerva: 'Minerva',
  roberto: 'Roberto', guido: 'Guido', gabriele: 'Gabriele', su: 'Su',
};
