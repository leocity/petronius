// The engine: plays a scene beat by beat, then uses flow.json to turn the scene's exit into
// destinations ("leads") the player can travel to. Home mode: every trigger is satisfied in-app.
import { flow, clues, cast, media, clueFor, mediaUrl, backgroundFor, figureFor, loadScene, place, sceneFlow, resolveTold, CHARACTERS } from './story.js';
import { save } from './save.js';
import { cluePanel, gallery, bigImage, hints, hotspotImage, compact } from './clue.js';
import { geo, onGeo, proximity, formatDistance, MAX_ACCURACY } from './geo.js';
import { h } from './dom.js';

let state;
let scene;               // current scene data
const ui = {};           // hooks set by main.js: { stage, setBar, openMap, onEnding }

export function init(s, hooks) {
  state = s;
  state.solved ??= [];   // clue keys "<scene>#<beat>" (saves from before clues existed lack these)
  state.items ??= [];    // journal items collected: [{ title, items }]
  state.met ??= [];      // characters who have spoken (notebook "People")
  state.heard ??= [];    // lines that taught the player something to say: [{ key, who, text, scene, day }]
  Object.assign(ui, hooks);
  arrived.clear();       // a new or resumed game vibrates again on arrival
  nextArgs = null;
}

// Lines that teach a voice word (flow.json voice exits' `told`): recorded in the notebook the moment they are read.
const HEARD = new Map();
export function indexHeard() {
  for (const [sid, f] of Object.entries(flow.scenes)) for (const e of f.exits)
    if (e.via === 'voice' && e.told) for (const b of [e.told.beat, ...(e.told.also ?? [])]) {
      const key = `${e.told.scene ?? sid}#${e.told.beat}`;
      HEARD.set(`${e.told.scene ?? sid}#${b}`, { key, match: e.told.match });
    }
}

// Tell the player something went into the notebook (toast + dot on the notebook button, see main.js).
const notify = (kind, text) => ui.notify?.(kind, text);
function addNote(text) {
  if (state.notes.some((n) => norm(n.text) === norm(text))) return false;
  state.notes.push({ text, scene: state.scene, day: state.day });
  notify('note', text);
  return true;
}
export const getState = () => state;

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const persist = () => save(state);
// The original buttons were typed by hand ("DOne", "done", "solved"): tidy single-word labels.
const tidy = (label) => (/^\S+$/.test(label) ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : label);

// ---------- Leads: open destinations on the map ----------
const done = (id) => state.finished.includes(id);
export const leadOpen = (l) => (l.requires ?? []).every(done) && (!l.after || done(l.after));
export const openLeads = () => state.leads.filter(leadOpen);

function addLead(e, fromScene) {
  if (!e.to || state.leads.some((l) => l.to === e.to)) return;
  state.leads.push({ to: e.to, where: e.where ?? sceneFlow(e.to)?.place, via: e.via, from: fromScene,
    requires: e.requires, after: e.after, dayEnd: !!e.dayEnd, told: resolveTold(e.told, fromScene) });
}

// Hub spokes are done when the scene their branch must reach (the hub's final exit `requires`, same order) is finished.
function hubLeads(hubId) {
  const exits = sceneFlow(hubId).exits;
  const final = exits.find((e) => e.requires?.length);
  const spokes = sceneFlow(hubId).hub ?? [];
  spokes.forEach((spoke, i) => {
    if (!done(final.requires[i])) addLead(exits.find((e) => e.to === spoke), hubId);
  });
  addLead(final, hubId);
}

// ---------- Scenes ----------
let starting = false;   // the scene file is fetched first: a second tap meanwhile must not start it twice
export async function startScene(id) {
  if (starting) return;
  starting = true;
  try {
    const loaded = await loadScene(id);
    scene = loaded;
    state.scene = id;
    state.trail = [];
    state.leads = state.leads.filter((l) => l.to !== id);
    state.log.push({ day: state.day, scene: id, place: sceneFlow(id).place, at: new Date().toISOString() });
    for (const p of clues.pickups[id] ?? []) collect(p);
    show(scene.start);
  } catch (err) {
    loadFailed(() => startScene(id));
  } finally {
    starting = false;
  }
}

// The scene file could not be fetched (offline, a dropped connection): say so and let the player try again.
// The game state is untouched, so nothing is lost.
function loadFailed(retry) {
  ui.closeOverlays?.();
  ui.stage.replaceChildren(h('div', { class: 'next full' },
    h('h2', {}, 'No connection'),
    h('p', {}, 'This place could not be loaded. Your game is saved: check your connection and try again.'),
    h('button', { class: 'btn btn-primary', onclick: retry }, 'Try again')));
}

// Testing helper (petronius.goto in the console): jump straight to a beat of a scene.
export async function jumpTo(id, beat) {
  scene = await loadScene(id);
  state.scene = id;
  state.trail = [];
  show(beat ?? scene.start);
}

export async function resume() {
  // A save from an older version of the story may name a scene or beat that no longer exists: choose where to go instead.
  if (!state.scene || !sceneFlow(state.scene)) { state.scene = null; return showNext(openLeads(), null); }
  try { scene = await loadScene(state.scene); } catch { return loadFailed(resume); }
  show(scene.beats[state.beat] ? state.beat : scene.start, { keepTrail: true });
}

function show(id, { keepTrail = false } = {}) {
  const beat = scene.beats[id];
  if (!keepTrail) state.trail.push(id);
  state.beat = id;
  persist();
  bar();
  ui.setBackground?.(backgroundFor(state.scene, beat));
  // Lines with nothing to read or choose are only pauses in the original: skip them.
  const single = uniqueNext(beat);
  if (beat.kind === 'line' && !beat.text && !beat.instruction && !beat.waitsFor && single.length === 1 && !single[0].label)
    return go(single[0]);
  render(beat);
}

function bar() {
  const p = place(sceneFlow(state.scene)?.place ?? '');
  ui.setBar(`Day ${state.day}`, p?.name ?? '');
  ui.setSong?.(!!media.sceneSongs[state.scene]);
}

const uniqueNext = (beat) => {
  const seen = new Set();
  const all = (beat.next ?? []).filter((n) => !seen.has(n.to + '|' + (n.label ?? '')) && seen.add(n.to + '|' + (n.label ?? '')));
  const labelled = all.filter((n) => n.label && !n.kind);
  return labelled.length ? labelled : all;
};

function go(edge) {
  const target = scene.beats[edge.to];
  if (!target || target.kind === 'end') return finishScene(state.beat);
  show(edge.to);
}

function back() {
  if (state.trail.length < 2) return;
  state.trail.pop();
  show(state.trail.pop());
}

// ---------- Beat rendering ----------
function render(beat) {
  const stage = ui.stage;
  stage.replaceChildren();
  takeNotes(beat);
  const rule = HEARD.get(`${state.scene}#${beat.id}`);
  if (rule && !state.heard.some((x) => x.key === rule.key)) {
    const q = resolveTold({ beat: beat.id, match: rule.match }, state.scene);
    if (q) { state.heard.push({ key: rule.key, who: q.who, text: q.text, scene: state.scene, day: state.day }); notify('heard', `${q.who}: “${q.text}”`); }
  }
  if (beat.speaker && cast.characters[beat.speaker] && !state.met.includes(beat.speaker)) state.met.push(beat.speaker);
  switch (beat.kind) {
    case 'card': return stage.append(cardView(beat.text, () => go(uniqueNext(beat)[0])));
    case 'image': return stage.append(lostView(`Picture missing: ${beat.asset}`, () => go(uniqueNext(beat)[0])));
    case 'puzzle': return stage.append(puzzleView(beat));
    case 'timer': return stage.append(timerView(beat));
    case 'video': return ending(beat.id);
    default: return lineView(beat);
  }
}

function lineView(beat) {
  const who = beat.speaker ?? 'petronio';
  const color = `var(--c-${who}, var(--muted))`;
  const nexts = uniqueNext(beat);
  const choices = nexts.filter((n) => n.label);
  const say = h('div', { class: 'say' },
    h('span', { class: 'name-tag', style: `--c:${color}` }, CHARACTERS[who] ?? who),
    beat.text ? h('p', {}, beat.text) : null);

  const clue = beat.instruction && !beat.waitsFor && clueFor(state.scene, beat.id);
  if (clue) {
    const cont = choices.length === 1 ? choices[0] : nexts[0];
    // The speaker stays on screen above the clue, with their line, as in any other beat.
    if (beat.text) ui.stage.append(
      h('div', { class: 'portrait-wall' }, portrait(who, beat)),
      h('div', { class: 'say full' }, h('span', { class: 'name-tag', style: `--c:${color}` }, CHARACTERS[who] ?? who), h('p', {}, beat.text)));
    ui.stage.append(
      cluePanel(clue, {
        doneLabel: cont?.label ? tidy(cont.label) : 'Continue',
        onSolved: (c) => solved(c, `${state.scene}#${beat.id}`),
        onDone: () => (cont ? go(cont) : finishScene(beat.id)),
      }));
    return;
  }
  if (beat.waitsFor === 'voice') say.append(voiceView(beat));
  else if (choices.length) say.append(h('div', { class: 'choices' }, choices.map((n) => h('button', { class: 'btn', onclick: () => go(n) }, tidy(n.label)))));
  else {
    const advance = () => (nexts.length ? go(nexts[0]) : finishScene(beat.id));
    say.tabIndex = 0;
    say.setAttribute('role', 'button');
    say.append(h('span', { class: 'tap-hint' }, 'Tap to continue'));
    say.addEventListener('click', advance);
    say.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } });
    queueMicrotask(() => say.focus({ preventScroll: true, focusVisible: false }));
  }
  ui.stage.append(
    h('div', { class: 'portrait-wall' }, portrait(who, beat)),
    say);
}

// The original cut-out portrait, standing in the scene: Petronio on the left, whoever he talks to on the right.
function portrait(who, beat) {
  const src = figureFor(who, beat);
  if (!src) return null;
  return h('img', { class: `figure${who === 'petronio' ? '' : ' right'}`, src, alt: '', 'aria-hidden': 'true' });
}

// The location's song: the original had a play button in scenes with an <audio>; here it sits in the top bar.
const player = new Audio();
player.preload = 'none';
export function toggleSong() {
  const file = media.sceneSongs[state.scene];
  if (!file) return;
  const src = mediaUrl(media.audio[file].file);
  if (!player.src.endsWith(media.audio[file].file)) player.src = src;
  if (player.paused) player.play(); else player.pause();
}
export const songPlaying = () => !player.paused;
player.addEventListener('play', () => ui.onSong?.(true));
player.addEventListener('pause', () => ui.onSong?.(false));


// A solved clue: its note goes in the notebook, its items in "Things you picked up".
function solved(clue, key) {
  if (state.solved.includes(key)) return;
  state.solved.push(key);
  if (clue.note) addNote(clue.note);
  if (clue.items?.length) collect(clue);
  persist();
}
function collect(item) {
  if (state.items.some((i) => i.title === item.title)) return;
  state.items.push({ title: item.title, items: item.items });
  if (item.note) addNote(item.note);
}

function takeNotes(beat) {
  for (const part of (beat.instruction ?? '').split(' / ')) {
    const m = part.match(/take note of\s+"?([^"]+?)"?\s*$/i);
    if (m) addNote(m[1]);
  }
}

function cardView(text, onNext) {
  const el = h('div', { class: 'card full', tabindex: '0', role: 'button', onclick: onNext,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNext(); } } }, text, h('small', {}, 'Tap to continue'));
  queueMicrotask(() => el.focus({ preventScroll: true, focusVisible: false }));
  return el;
}

function lostView(text, onNext) {
  return h('div', { class: 'full', style: 'display:grid;gap:1rem;align-content:center' },
    h('div', { class: 'lost' }, text, h('br'), 'The original artwork was on hosting that no longer exists.'),
    h('button', { class: 'btn', style: 'justify-self:center', onclick: onNext }, 'Continue'));
}

function puzzleView(beat) {
  const edge = (kind) => beat.next?.find((n) => n.kind === kind);
  const inputs = Array.from({ length: beat.inputs }, (_, i) => h('input', { id: `pz-${i}`, autocomplete: 'off', spellcheck: 'false' }));
  const clue = clueFor(state.scene, beat.id);
  const help = clue?.hints && hints(clue);
  const form = h('form', { class: 'puzzle full', onsubmit: (e) => {
    e.preventDefault();
    // Any order; case, spaces and punctuation ignored (the original compared exact strings, one try).
    const given = inputs.map((i) => compact(i.value)).sort();
    const want = (beat.answers ?? []).map(compact).sort();
    const ok = want.length > 0 && given.length === want.length && given.every((g, i) => g === want[i]);
    const next = edge(ok ? 'password-correct' : 'password-wrong');
    if (next) go(next);
  } },
    h('h2', {}, beat.prompt.charAt(0) + beat.prompt.slice(1).toLowerCase()),
    h('p', {}, 'You get one try. The order doesn’t matter.'),
    inputs.map((inp, i) => [h('label', { for: inp.id }, `${i + 1}.`), inp]),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Check'),
      h('button', { class: 'btn', type: 'button', onclick: () => ui.openJournal() }, 'Open notebook'),
      help?.btn),
    help?.list);
  queueMicrotask(() => inputs[0]?.focus());
  return form;
}

function timerView(beat) {
  // Some countdowns only have a time-out edge (22): "I'm ready" then just skips the wait.
  const timeout = beat.next?.find((n) => n.kind === 'timeout') ?? beat.next?.find((n) => !n.kind);
  const success = beat.next?.find((n) => !n.kind) ?? timeout;
  const clue = clueFor(state.scene, beat.id);
  const hotspots = !!clue?.hotspots;
  let left = (beat.seconds ?? 60) + (hotspots && window.innerWidth < 600 ? 30 : 0);   // small screens need longer to compare
  const count = h('div', { class: 'countdown', 'aria-live': 'off' }, String(left));
  let tick = null;
  const finish = (edge) => { clearInterval(tick); go(edge); };

  // The clock only starts when the player presses Start, so reading the instructions and opening the picture are free.
  const body = h('div', { class: 'timed-body' });
  const start = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
    start.remove();
    tick = setInterval(() => {
      left -= 1;
      count.textContent = String(Math.max(left, 0));
      if (!count.isConnected) { clearInterval(tick); return; }   // the player left this screen: stop, don't jump
      if (left <= 0) finish(timeout);
    }, 1000);
    if (hotspots) {
      // Find the differences: tap the areas on the image; a tap elsewhere costs 5 seconds.
      const progress = h('p', { class: 'feedback', role: 'status' }, `0 of ${clue.hotspots.length} found`);
      body.append(
        gallery(clue.items ?? []),
        hotspotImage(clue.image, clue.hotspots, {
          onFound: (n) => { progress.textContent = `${n} of ${clue.hotspots.length} found`; },
          onAllFound: () => finish(success),
          onWrong: () => { left = Math.max(1, left - 5); count.textContent = String(left); progress.textContent = 'Not that. −5 seconds.'; },
        }),
        progress);
    } else {
      body.append(...(clue?.items ?? []).map(bigImage), h('p', {}, 'Remember what you need before time runs out.'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => finish(success) }, "I'm ready"));
    }
  } }, `Start the clock (${left} s)`);

  return h('div', { class: 'puzzle full' }, h('h2', {}, clue?.title ?? 'Against the clock'),
    clue?.text ? h('p', {}, clue.text) : null,
    h('p', {}, 'The clock starts when you press the button, not before.'),
    start, count, body);
}

// "Press the talk button to say something or leave": home mode types (or speaks) the keyword.
function voiceView(beat) {
  const exits = sceneFlow(state.scene).exits.filter((e) => e.from === beat.id && e.via === 'voice');
  const input = h('input', { id: 'say-input', autocomplete: 'off', placeholder: 'Type what you say' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const attempt = (text) => {
    const said = norm(text);
    const hit = exits.find((e) => e.match.every((m) => said.includes(m.toLowerCase())));
    if (!hit) { feedback.textContent = 'Nothing happens. It might be something you read or heard earlier: check your notebook.'; return; }
    markFinished(state.scene);
    startScene(hit.to);
  };
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const mic = SR && h('button', { class: 'btn mic', type: 'button', onclick: () => {
    const rec = new SR(); rec.lang = 'en-US';
    mic.classList.add('listening'); mic.textContent = 'Listening…';
    rec.onresult = (e) => { input.value = e.results[0][0].transcript; attempt(input.value); };
    rec.onend = () => { mic.classList.remove('listening'); mic.textContent = 'Speak'; };
    rec.onerror = (e) => { feedback.textContent = e.error === 'not-allowed' ? 'The microphone is off for this page. You can type it instead.' : 'I couldn’t hear you. Try again, or type it.'; };
    try { rec.start(); } catch { rec.onend(); }
  } }, 'Speak');
  queueMicrotask(() => input.focus());
  return h('form', { class: 'puzzle', style: 'box-shadow:none;border:0;padding:1rem 0 0', onsubmit: (e) => { e.preventDefault(); attempt(input.value); } },
    h('label', { for: 'say-input' }, 'Say something here, or go back if you don’t remember.'),
    input, feedback,
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Say it'), mic,
      h('button', { class: 'btn', type: 'button', onclick: back }, 'Go back')));
}

// ---------- Leaving a scene ----------
function markFinished(id) { if (!done(id)) state.finished.push(id); }

function finishScene(fromBeat) {
  const id = state.scene;
  player.pause();
  ui.setSong?.(false);
  markFinished(id);
  let exits = sceneFlow(id).exits.filter((e) => e.from === fromBeat && e.via !== 'voice');
  if (!exits.length) exits = sceneFlow(id).exits.filter((e) => e.via !== 'voice' && e.via !== 'ending');
  const end = exits.find((e) => e.via === 'ending');
  if (end) return ending(fromBeat);

  for (const e of exits) {
    if (e.via === 'hub') hubLeads(e.to);
    else addLead(e, id);
  }
  const fresh = openLeads().filter((l) => l.from === id || exits.some((e) => e.via === 'hub' && l.from === e.to));
  const dayEnd = exits.some((e) => e.dayEnd);
  if (dayEnd) state.day += 1;
  state.scene = null; state.beat = null; state.trail = [];
  persist();
  showNext(fresh.length ? fresh : openLeads(), dayEnd ? state.day : null);
}

// ---------- Choosing the next place ----------
// Home mode: tap a place to go there. On-site mode: a place unlocks when the GPS puts you within its radius;
// "I'm already here" and switching to home mode are always available, so a bad fix never blocks the story.
let nextArgs = null;
const arrived = new Set();
onGeo(() => {
  if (state?.mode !== 'onsite') return;
  ui.onGeo?.();
  const here = openLeads().filter((l) => proximity(place(l.where))?.near && !arrived.has(l.to));
  if (here.length) { here.forEach((l) => arrived.add(l.to)); navigator.vibrate?.([120, 60, 120]); }
  if (nextArgs && ui.stage.querySelector('.next')) renderNext();
});

export function showNext(leads, newDay) {
  nextArgs = { leads, newDay };
  renderNext();
  // Fetch the candidate scenes while the player reads and looks for the place, so the walk doesn't wait on a weak signal.
  for (const l of leads) loadScene(l.to).catch(() => {});
}

function renderNext() {
  const { leads, newDay } = nextArgs;
  const onsite = state.mode === 'onsite';
  ui.setBar(`Day ${state.day}`, 'On the way');
  ui.stage.replaceChildren(h('div', { class: 'next full' },
    h('h2', {}, newDay ? `Day ${newDay}` : 'Where to next?'),
    h('p', {}, newDay ? 'Back through the university doors before anyone notices. Tomorrow starts here:'
      : onsite ? 'Walk there. The scene unlocks when you arrive.' : 'Here is what you were told. Find the place on the map.'),
    onsite ? gpsNotice() : null,
    !leads.length ? h('p', {}, 'No open leads. Check the map.')
      : onsite ? h('div', { class: 'choices' }, leads.map((l) => destButton(l)))
      : h('div', { class: 'leadcards' }, leads.map((l) => leadCard(l))),
    h('button', { class: onsite ? 'btn' : 'btn btn-primary', onclick: ui.openMap }, onsite ? 'Open map' : 'Find it on the map')));
}

function gpsNotice() {
  if (geo.pos && geo.pos.accuracy <= MAX_ACCURACY) return null;
  const why = geo.error === 'denied' ? 'Location access is off for this page.'
    : geo.error ? 'Your position isn’t available right now.'
    : geo.pos ? `Your position is only accurate to about ${formatDistance(geo.pos.accuracy)}. Step outside or wait a moment.`
    : 'Looking for your position…';
  return h('div', { class: 'gps-notice', role: 'status' }, h('p', {}, why),
    geo.error ? h('button', { class: 'btn btn-small', onclick: () => setMode('home') }, 'Switch to home mode') : null);
}

export function setMode(mode) {
  state.mode = mode;
  persist();
  ui.onMode?.(mode);
  if (nextArgs && ui.stage.querySelector('.next')) renderNext();
}

// Home mode: what the player was told about the next place (not its name on a button: they find it on the map).
export function leadCard(l) {
  const t = l.told;
  const p = place(l.where);
  return h('figure', { class: 'lead-card', 'data-scene': l.to },
    h('blockquote', {}, t?.text ?? p?.name ?? l.to),
    h('figcaption', {}, t?.who ?? p?.address ?? ''));
}

export function destButton(l) {
  const p = place(l.where) ?? { name: l.to };
  if (state.mode !== 'onsite') {
    return h('button', { class: 'btn dest', 'data-scene': l.to, onclick: () => travel(l) },
      h('strong', {}, p.name), h('span', {}, p.address));
  }
  const px = proximity(p);
  const status = !px ? (geo.error ? 'No position' : 'Finding you…')
    : px.near ? 'You’re here: start the scene'
    : `${formatDistance(px.metres)} away${px.vague ? ' (rough position)' : ''}`;
  return h('div', { class: 'dest-wrap' },
    h('button', { class: `btn dest${px?.near ? ' btn-primary' : ' far'}`, 'data-scene': l.to, 'aria-disabled': px?.near ? 'false' : 'true',
      onclick: () => { if (px?.near) travel(l); } },
      h('strong', {}, p.name), h('span', {}, p.address), h('em', { class: 'dist' }, status)),
    px?.near ? null : h('button', { class: 'link-btn', onclick: () => travel(l) }, 'I’m already here'));
}

export function travel(lead) { ui.closeOverlays?.(); startScene(lead.to); }

function ending(fromBeat) {
  const e = sceneFlow(state.scene).exits.find((x) => x.from === fromBeat && x.via === 'ending')
    ?? sceneFlow(state.scene).exits.find((x) => x.via === 'ending');
  const info = flow.endings[e.ending];
  markFinished(state.scene);
  state.ending = e.ending;
  state.scene = null;
  persist();
  ui.setBar(`Day ${state.day}`, 'The end');
  const videoBeat = Object.values(scene?.beats ?? {}).find((b) => b.kind === 'video');
  const video = videoBeat && media.videos[videoBeat.src];
  player.pause();
  ui.stage.replaceChildren(h('div', { class: 'ending full' },
    video ? h('video', { class: 'ending-video', src: mediaUrl(video.file), controls: true, autoplay: true, playsinline: true }) : null,
    h('div', { class: 'envelope' }, h('b', {}, `Envelope ${e.ending}`), h('strong', {}, info.title)),
    h('p', {}, info.how),
    gallery(clues.endings[e.ending] ?? []),
    h('button', { class: 'btn btn-primary', onclick: ui.onEnding }, 'Back to the title')));
}
