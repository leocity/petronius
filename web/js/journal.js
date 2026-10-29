// Petronio's notebook: what the paper journal's "Next place / PSW" slots held, filled in automatically.
import { flow, place, cast, assetUrl } from './story.js';
import { getState } from './game.js';
import { gallery } from './clue.js';

const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

// Words the player can say at voice gates: known once the scene that teaches them is finished,
// or (for words that came from paper riddles) once the gate itself has been reached.
function knownWords(state) {
  const words = [];
  for (const [sceneId, f] of Object.entries(flow.scenes)) {
    for (const e of f.exits) {
      if (e.via !== 'voice') continue;
      const learned = e.requires?.length ? e.requires.every((r) => state.finished.includes(r)) : state.log.some((v) => v.scene === sceneId);
      if (learned && !words.some((w) => w.say === e.say)) words.push({ say: e.say, where: place(f.place)?.name });
    }
  }
  return words;
}

export function renderJournal(page) {
  const state = getState();
  page.replaceChildren();

  page.append(el('h2', null, 'Names and passwords'));
  if (state.notes.length) {
    const ul = el('ul');
    for (const n of state.notes) ul.append(el('li', 'hand', n.text));
    page.append(ul);
  } else page.append(el('p', 'empty', 'Nothing written down yet. When someone says "take note", it ends up here.'));

  page.append(el('h2', null, 'Things to say'));
  const words = knownWords(state);
  if (words.length) {
    const ul = el('ul');
    for (const w of words) { const li = el('li', 'hand', `"${w.say}"`); li.title = w.where ?? ''; ul.append(li); }
    page.append(ul);
  } else page.append(el('p', 'empty', 'Some places only open up if you say the right thing.'));

  page.append(el('h2', null, 'People'));
  if (state.met?.length) for (const id of state.met) {
    const c = cast.characters[id];
    const row = el('div', 'person');
    const img = el('img');
    img.src = assetUrl(c.file); img.alt = ''; img.style.setProperty('--focus', c.focus ?? '50% 12%');
    const text = el('div');
    text.append(el('strong', null, c.name), el('p', null, c.bio));
    row.append(img, text);
    page.append(row);
  } else page.append(el('p', 'empty', 'Nobody yet.'));

  page.append(el('h2', null, 'Things you picked up'));
  if (state.items?.length) for (const it of state.items) {
    page.append(el('p', 'hand', it.title));
    page.append(...gallery(it.items.filter((i) => !i.sheet)));
  } else page.append(el('p', 'empty', 'Flyers, stickers and sheets you solve end up here.'));

  page.append(el('h2', null, 'Places'));
  if (!state.log.length) page.append(el('p', 'empty', 'No places yet.'));
  let day = 0;
  const ul = el('ul');
  for (const v of state.log) {
    if (v.day !== day) { day = v.day; ul.append(el('li', 'day', `Day ${day}`)); }
    const t = new Date(v.at);
    ul.append(el('li', 'hand', `${place(v.place)?.name ?? v.place}, ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`));
  }
  page.append(ul);
}
