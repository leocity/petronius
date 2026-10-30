// Map of Bovisa / Dergano (Leaflet + OpenStreetMap).
// Home mode: the map doesn't show where the open leads are. The player reads what they were told, taps the place
// on the map and presses Go: a lead opens if the spot is within its reach (the place's radius, or ~28 px of
// map at the current zoom, whichever is larger, at most 150 m). Visited places stay as white pins.
// On-site mode: orange pins and radius circles for the leads, plus your position and its accuracy.
import { flow, place } from './story.js';
import { getState, openLeads, destButton, leadCard, travel } from './game.js';
import { geo, proximity, formatDistance, distance, DEFAULT_RADIUS } from './geo.js';

const CENTER = [45.5025, 9.1695];
let map;
let layer;       // places
let meLayer;     // your position (on site)
let guessLayer;  // the spot tapped (home)
let panel;       // the list under the map
let guess = null;
let misses = 0;
let message = '';

const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

// frame: the map was just opened (home: back to the neighbourhood; on site: fit the leads and you).
// geoOnly: a live GPS update: redraw your position and the list, keep the place pins (and any open popup).
export function renderMap(container, list, { frame = false, geoOnly = false } = {}) {
  const L = window.L;
  panel = list;
  if (!map) {
    map = L.map(container, { zoomControl: true, attributionControl: true }).setView(CENTER, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    meLayer = L.layerGroup().addTo(map);
    guessLayer = L.layerGroup().addTo(map);
    map.on('click', (e) => tapMap(e.latlng.lat, e.latlng.lng));
  }
  const state = getState();
  const onsite = state.mode === 'onsite';
  const leads = openLeads();
  if (frame) { guess = null; misses = 0; message = ''; guessLayer.clearLayers(); }
  if (!geoOnly) drawPlaces(L, state, onsite, leads);
  meLayer.clearLayers();
  if (onsite && geo.pos) {
    L.circle([geo.pos.lat, geo.pos.lng], { radius: geo.pos.accuracy, color: '#19a39a', weight: 1, fillOpacity: 0.12 }).addTo(meLayer);
    L.marker([geo.pos.lat, geo.pos.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), title: 'You', keyboard: false }).addTo(meLayer);
  }
  renderList(list, leads);
  if (!frame) return;
  setTimeout(() => {
    map.invalidateSize();
    if (!onsite) { map.setView(CENTER, window.innerWidth < 600 ? 14 : 15); return; }   // home: never zoom to the answer
    const pts = leads.map((l) => place(l.where)).filter((p) => p?.lat != null).map((p) => [p.lat, p.lng]);
    if (geo.pos) pts.push([geo.pos.lat, geo.pos.lng]);
    if (pts.length) map.fitBounds(pts, { maxZoom: 16, padding: [40, 40] });
  }, 0);
}

function drawPlaces(L, state, onsite, leads) {
  layer.clearLayers();
  const leadPlaces = new Set(leads.map((l) => l.where));
  const visited = new Set(state.log.map((v) => v.place));
  const pin = (cls) => L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

  for (const [id, p] of Object.entries(flow.places)) {
    const isLead = onsite && leadPlaces.has(id);
    if (p.lat == null || (!isLead && !visited.has(id))) continue;
    if (isLead) L.circle([p.lat, p.lng], { radius: p.radius ?? DEFAULT_RADIUS, color: '#ef6630', weight: 2, dashArray: '4 6', fillOpacity: 0.08 }).addTo(layer);
    const m = L.marker([p.lat, p.lng], { icon: pin(isLead ? 'lead' : ''), title: p.name, keyboard: true }).addTo(layer);
    const box = document.createElement('div');
    box.append(Object.assign(document.createElement('strong'), { textContent: p.name }), document.createElement('br'), p.address);
    if (isLead) for (const l of leads.filter((x) => x.where === id)) {
      const px = proximity(p);
      if (!px?.near) box.append(document.createElement('br'), px ? `${formatDistance(px.metres)} away` : 'Waiting for your position');
      const b = Object.assign(document.createElement('button'), {
        className: 'btn btn-primary',
        textContent: px?.near ? 'Go here' : 'I’m already here',
      });
      b.addEventListener('click', () => travel(l));
      box.append(document.createElement('br'), b);
    }
    m.bindPopup(box);
  }
}

// ---------- Home mode: tap a spot, press Go ----------
export function tapMap(lat, lng) {
  if (getState().mode === 'onsite') return;
  const L = window.L;
  guess = { lat, lng };
  message = '';
  guessLayer.clearLayers();
  L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div class="pin guess"></div>', iconSize: [28, 28], iconAnchor: [14, 14] }), interactive: false, keyboard: false }).addTo(guessLayer);
  renderList(panel, openLeads());
}

function checkGuess() {
  if (!guess) return;
  const leads = openLeads();
  // How much map a fingertip covers here: a tap within ~28 px of the place counts, up to 150 m.
  const mpp = (156543.03 * Math.cos((guess.lat * Math.PI) / 180)) / 2 ** map.getZoom();
  const tolerance = Math.min(150, 28 * mpp);
  let best = null;
  let nearest = null;
  for (const l of leads) {
    const p = place(l.where);
    if (p?.lat == null) continue;
    const d = distance(guess, p);
    if (!nearest || d < nearest.d) nearest = { l, d };
    if (d <= Math.max(p.radius ?? DEFAULT_RADIUS, tolerance) && (!best || d < best.d)) best = { l, d };
  }
  if (best) { guess = null; guessLayer.clearLayers(); travel(best.l); return; }
  misses += 1;
  message = !nearest ? 'Nothing to find right now.'
    : misses >= 2 ? `Nothing here. The closest place you’re looking for is about ${formatDistance(nearest.d)} from this spot.`
    : 'Nothing here. Try somewhere else.';
  renderList(panel, leads);
}

// For tests and the playtest bot: tap the map and press Go.
export function simulateTap(lat, lng) {
  tapMap(lat, lng);
  checkGuess();
}

function renderList(list, leads) {
  list.replaceChildren();
  const onsite = getState().mode === 'onsite';
  list.append(el('h2', null, !leads.length ? 'No open leads' : onsite ? 'Open leads' : 'Find the place'));
  if (!leads.length) { list.append(el('p', null, 'Finish the scene you are in to find out where to go.')); return; }
  if (onsite) { for (const l of leads) list.append(destButton(l)); return; }

  list.append(el('p', null, 'Zoom in and tap the place on the map, then press Go.'));
  const go = el('button', 'btn btn-primary go-btn', 'Go to this spot');
  go.type = 'button';
  go.disabled = !guess;
  go.addEventListener('click', checkGuess);
  list.append(go);
  if (message) list.append(Object.assign(el('p', 'feedback', message), { role: 'status' }));
  const cards = el('div', 'leadcards');
  for (const l of leads) cards.append(leadCard(l));
  list.append(cards);
}
