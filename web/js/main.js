import { loadFlow, clues, sceneFlow } from './story.js';
import { load, newState, clear, save } from './save.js';
import { init, startScene, resume, getState, showNext, jumpTo, toggleSong } from './game.js';
import { renderMap } from './map.js';
import { renderJournal } from './journal.js';
import { geo, startGeo, stopGeo, simulate, formatDistance, MAX_ACCURACY } from './geo.js';

const $ = (id) => document.getElementById(id);
const screens = ['title', 'play', 'map-screen'];
const showScreen = (id) => screens.forEach((s) => { $(s).hidden = s !== id; });

const flow = await loadFlow();

function hooks() {
  return {
    stage: $('stage'),
    setBar: (day, where) => { $('bar-day').textContent = day; $('bar-place').textContent = where; },
    openMap, openJournal, closeOverlays,
    onEnding: () => title(),
    onGeo: () => { gpsChip(); if (!$('map-screen').hidden) renderMap($('map'), $('leads'), { geoOnly: true }); },
    onMode: (mode) => applyMode(mode),
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
// petronius.goto('13', '11') to jump to a beat (start or continue a game first).
window.petronius = { state: getState, flow, clues, fakePosition: simulate, goto: (scene, beat) => { showScreen('play'); jumpTo(scene, beat); } };
title();
