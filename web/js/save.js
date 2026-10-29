// Game state, persisted in localStorage (per browser). Everything else is derived from the story data.
const KEY = 'petronius.save.v1';

export function newState(start) {
  return {
    mode: 'home',
    day: 1,
    scene: start,        // scene being played, or null while choosing where to go
    beat: null,          // current beat id inside `scene`
    trail: [],           // beats visited in the current scene (for "back")
    finished: [],        // scenes completed at least once (unlocks `requires`)
    leads: [],           // open destinations: [{ to, where, via, from: scene, after?, requires? }]
    notes: [],           // [{ text, scene, day }] from "take note of …" instructions
    log: [],             // [{ day, scene, place, at }]
    ending: null,
  };
}

export function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: play without saving */ }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
