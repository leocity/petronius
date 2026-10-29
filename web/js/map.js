// Map of Bovisa / Dergano (Leaflet + OpenStreetMap). Orange pins are open leads, white pins places already visited.
// On-site mode adds your position (with its accuracy circle) and each lead's arrival radius.
import { flow, place } from './story.js';
import { getState, openLeads, destButton, travel } from './game.js';
import { geo, proximity, formatDistance, DEFAULT_RADIUS } from './geo.js';

let map;
let layer;      // places
let meLayer;    // your position (on site)

// frame: fit the view to the leads (and you, on site), when the map is opened.
// geoOnly: a live GPS update: redraw your position and the list, keep the place pins (and any open popup).
export function renderMap(container, list, { frame = false, geoOnly = false } = {}) {
  const L = window.L;
  if (!map) {
    map = L.map(container, { zoomControl: true, attributionControl: true }).setView([45.5025, 9.1695], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    meLayer = L.layerGroup().addTo(map);
  }
  const state = getState();
  const onsite = state.mode === 'onsite';
  const leads = openLeads();
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
    const pts = leads.map((l) => place(l.where)).filter((p) => p?.lat != null).map((p) => [p.lat, p.lng]);
    if (onsite && geo.pos) pts.push([geo.pos.lat, geo.pos.lng]);
    if (pts.length) map.fitBounds(pts, { maxZoom: 16, padding: [40, 40] });
  }, 0);
}

function drawPlaces(L, state, onsite, leads) {
  layer.clearLayers();
  const leadPlaces = new Set(leads.map((l) => l.where));
  const visited = new Set(state.log.map((v) => v.place));
  const pin = (cls) => L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

  for (const [id, p] of Object.entries(flow.places)) {
    if (p.lat == null || (!leadPlaces.has(id) && !visited.has(id))) continue;
    const isLead = leadPlaces.has(id);
    if (isLead && onsite) L.circle([p.lat, p.lng], { radius: p.radius ?? DEFAULT_RADIUS, color: '#ef6630', weight: 2, dashArray: '4 6', fillOpacity: 0.08 }).addTo(layer);
    const m = L.marker([p.lat, p.lng], { icon: pin(isLead ? 'lead' : ''), title: p.name, keyboard: true }).addTo(layer);
    const box = document.createElement('div');
    box.append(Object.assign(document.createElement('strong'), { textContent: p.name }), document.createElement('br'), p.address);
    for (const l of leads.filter((x) => x.where === id)) {
      const px = onsite ? proximity(p) : null;
      if (onsite && !px?.near) {
        box.append(document.createElement('br'), px ? `${formatDistance(px.metres)} away` : 'Waiting for your position');
      }
      const b = Object.assign(document.createElement('button'), {
        className: 'btn btn-primary',
        textContent: !onsite || px?.near ? 'Go here' : 'I’m already here',
      });
      b.addEventListener('click', () => travel(l));
      box.append(document.createElement('br'), b);
    }
    m.bindPopup(box);
  }
}

function renderList(list, leads) {
  list.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = leads.length ? 'Open leads' : 'No open leads';
  list.append(title);
  if (!leads.length) list.append(Object.assign(document.createElement('p'), { textContent: 'Finish the scene you are in to find out where to go.' }));
  for (const l of leads) list.append(destButton(l));
}
