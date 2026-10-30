import { loadFlow, clues, sceneFlow, preloadFigures } from './story.js';
import { load, newState, clear, save } from './save.js';
import { init, startScene, resume, getState, showNext, jumpTo, toggleSong, indexHeard } from './game.js';
import { renderMap, simulateTap } from './map.js';
import { renderJournal } from './journal.js';
import { geo, startGeo, stopGeo, simulate, formatDistance, MAX_ACCURACY } from './geo.js';

const $ = (id) => document.getElementById(id);
const screens = ['title', 'play', 'map-screen'];
const showScreen = (id) => screens.forEach((s) => { $(s).hidden = s !== id; });

let flow;
try { flow = await loadFlow(); } catch (err) {
  // The story data could not be fetched (offline on the very first visit): say so instead of showing a blank page.
  const box = Object.assign(document.createElement('div'), { className: 'boot-error' });
  box.append(Object.assign(document.createElement('h1'), { textContent: 'Petronius can’t start' }),
    Object.assign(document.createElement('p'), { textContent: 'The story could not be loaded. Check your connection and reload the page.' }));
  document.getElementById('app').replaceChildren(box);
  throw err;
}
indexHeard();
preloadFigures();

// Works offline once it has been opened (see sw.js). Registered after load so it never competes with the first paint.
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// Full screen where the browser allows it (Android, desktop): hides the address bar. On iPhone, "Add to Home Screen" does it.
const full = $('btn-full');
if (document.fullscreenEnabled && !matchMedia('(display-mode: standalone)').matches) {
  full.hidden = false;
  full.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})));
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    full.setAttribute('aria-pressed', String(on));
    full.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
  });
}

// Whatever goes into the notebook is announced: a toast (tap it to open the notebook) and a dot on the notebook button.
const toasts = $('toasts');
function toast(kind, text) {
  const t = document.createElement('button');
  t.type = 'button';
  t.className = `toast ${kind}`;
  const label = document.createElement('b');
  label.textContent = 'Added to your notebook';
  const body = document.createElement('span');
  body.textContent = text.length > 120 ? `${text.slice(0, 117)}…` : text;
  t.append(label, body);
  t.addEventListener('click', () => { t.remove(); openJournal(); });
  toasts.append(t);
  while (toasts.children.length > 3) toasts.firstChild.remove();
  $('btn-journal').classList.add('has-news');
  setTimeout(() => t.remove(), 5500);
}

function hooks() {
  return {
    stage: $('stage'),
    setBar: (day, where) => { $('bar-day').textContent = day; $('bar-place').textContent = where; },
    openMap, openJournal, closeOverlays,
    onEnding: () => title(),
    onGeo: () => { gpsChip(); if (!$('map-screen').hidden) renderMap($('map'), $('leads'), { geoOnly: true }); },
    onMode: (mode) => applyMode(mode),
    notify: toast,
    // The scene's location photo behind everything (kept while choosing the next place).
    setSong: (has) => { $('btn-song').hidden = !has; },
    onSong: (on) => { $('btn-song').setAttribute('aria-pressed', String(on)); $('btn-song').classList.toggle('on', on); },
    setBackground: (url) => { if (url) $('play').style.setProperty('--bg', `url("${url}")`); },
  };
}

function applyMode(mode) {
  $('bar-gps').hidden = mode !== 'onsite';
  if (mode === 'onsite') { startGeo(); gpsChip(); } else stopGeo();
}

function gpsChip() {
  const chip = $('bar-gps');
  const ok = geo.pos && geo.pos.accuracy <= MAX_ACCURACY;
  chip.textContent = ok ? `GPS ±${formatDistance(geo.pos.accuracy)}` : geo.error ? 'No GPS' : 'GPS…';
  chip.className = `bar-gps ${ok ? 'ok' : geo.error ? 'bad' : ''}`;
}

function openMap() {
  showScreen('map-screen');
  renderMap($('map'), $('leads'), { frame: true });
  $('btn-map-close').focus();
}
function openJournal() {
  $('btn-journal').classList.remove('has-news');
  toasts.replaceChildren();
  renderJournal($('journal-page'));
  $('journal').hidden = false;
  $('btn-journal-close').focus();
}
function closeOverlays() {
  $('journal').hidden = true;
  showScreen('play');
}

function title() {
  const saved = load();
  $('btn-continue').hidden = !(saved && !saved.ending);
  showScreen('title');
}

function newGame(mode) {
  clear();
  const s = newState(flow.start);
  s.mode = mode;
  save(s);
  init(s, hooks());
  applyMode(mode);
  showScreen('play');
  if (mode === 'onsite') {
    // On site even the first scene needs you at the university: it starts as a lead on the map.
    s.scene = null;
    s.leads = [{ to: flow.start, where: sceneFlow(flow.start).place, via: 'qr', from: null }];
    save(s);
    showNext(s.leads, null);
  } else startScene(flow.start);
}

$('btn-new').addEventListener('click', () => newGame('home'));
$('btn-new-onsite').addEventListener('click', () => newGame('onsite'));
$('btn-continue').addEventListener('click', () => {
  const s = load();
  init(s, hooks());
  applyMode(s.mode);
  showScreen('play');
  resume();
});
$('btn-map').addEventListener('click', openMap);
$('btn-song').addEventListener('click', toggleSong);
$('btn-map-close').addEventListener('click', () => { showScreen('play'); });
$('btn-journal').addEventListener('click', openJournal);
$('btn-journal-close').addEventListener('click', () => { $('journal').hidden = true; $('btn-journal').focus(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('journal').hidden) $('journal').hidden = true;
  else if (!$('map-screen').hidden) showScreen('play');
});

// Debug helpers for testing from the console: petronius.state(), petronius.flow, petronius.clues,
// petronius.fakePosition(lat, lng, accuracy) to try on-site mode away from Bovisa,
// petronius.goto('13', '11') to jump to a beat (start or continue a game first),
// petronius.tapMap(lat, lng) to tap the map in home mode.
window.petronius = {
  state: getState, flow, clues, fakePosition: simulate,
  goto: (scene, beat) => { showScreen('play'); jumpTo(scene, beat); },
  // Home mode: tap the map at a place and press Go (what the player does).
  tapMap: (lat, lng) => { if ($('map-screen').hidden) openMap(); simulateTap(lat, lng); },
};
title();
