// Petronio's notebook: what the paper journal's "Next place / PSW" slots held, filled in automatically.
import { place, cast, assetUrl } from './story.js';
import { getState, openLeads, leadCard } from './game.js';
import { gallery } from './clue.js';
import { el } from './dom.js';

export function renderJournal(page) {
  const state = getState();
  page.replaceChildren();

  // Where to next: what the player was told, newest first (home mode: they find it on the map; on site they walk).
  const leads = openLeads();
  page.append(el('h2', null, 'Where to next'));
  if (leads.length) { const box = el('div', 'leadcards'); for (const l of leads) box.append(leadCard(l)); page.append(box); }
  else page.append(el('p', 'empty', 'Nowhere yet. Finish the scene you are in.'));

  page.append(el('h2', null, 'Names and passwords'));
  if (state.notes.length) {
    const ul = el('ul');
    for (const n of state.notes) ul.append(el('li', 'hand', n.text));
    page.append(ul);
  } else page.append(el('p', 'empty', 'Nothing written down yet. When someone says "take note", it ends up here.'));

  page.append(el('h2', null, 'What people told you'));
  if (state.heard?.length) {
    const ul = el('ul');
    for (const h of state.heard) ul.append(el('li', 'hand', `${h.who}: “${h.text}”`));
    page.append(ul);
  } else page.append(el('p', 'empty', 'Some places only open up if you say the right thing. Listen to what people say.'));

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
