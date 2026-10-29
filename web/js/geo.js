// On-site mode: the browser's Geolocation, replacing the original app's LocationSensor
// (which matched the street address; here we measure the distance to each place).
const listeners = new Set();
let watchId = null;

export const geo = {
  pos: null,          // { lat, lng, accuracy (m), at }
  error: null,        // 'denied' | 'unavailable' | 'timeout' | 'unsupported'
  simulated: false,
};

const emit = () => listeners.forEach((fn) => fn(geo));
export const onGeo = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function startGeo() {
  if (watchId != null || geo.simulated) return;
  if (!('geolocation' in navigator)) { geo.error = 'unsupported'; emit(); return; }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      geo.pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
      geo.error = null;
      emit();
    },
    (e) => { geo.error = ['', 'denied', 'unavailable', 'timeout'][e.code] ?? 'unavailable'; emit(); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

export function stopGeo() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

// For testing and demos away from Bovisa: petronius.fakePosition(lat, lng, accuracy)
export function simulate(lat, lng, accuracy = 10) {
  stopGeo();
  geo.simulated = true;
  geo.error = null;
  geo.pos = { lat, lng, accuracy, at: Date.now() };
  emit();
}

// Great-circle distance in metres.
export function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const DEFAULT_RADIUS = 60;     // metres; a place may set its own `radius` (campus, approximate spots)
export const MAX_ACCURACY = 150;      // worse than this, the fix is too vague to unlock anything

// { metres, near, vague } for a place, or null without a position.
export function proximity(place) {
  if (!geo.pos || place?.lat == null) return null;
  const metres = distance(geo.pos, place);
  const vague = geo.pos.accuracy > MAX_ACCURACY;
  // Accept when the place's radius overlaps the fix's own uncertainty (capped so a vague fix can't unlock everything).
  const near = !vague && metres <= (place.radius ?? DEFAULT_RADIUS) + Math.min(geo.pos.accuracy, 40);
  return { metres, near, vague };
}

export const formatDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
