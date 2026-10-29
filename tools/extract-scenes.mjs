// Extracts the 47 CodePen scenes (petronius-*/src) into a JSON story graph.
//
// Instead of parsing the hand-wired jQuery, each scene is loaded in jsdom with the
// original jQuery and "played" exhaustively: from every reachable state we click every
// visible clickable element and record which beats become visible. The graph therefore
// reflects what the scene actually did at runtime (including bubbling, dead code, etc.).
//
// Output: data/story/scenes/<scene>.json, data/story/index.json, data/story/report.md
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'story');
const JQUERY = fs.readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8');

// Answers to the password puzzles (verified in the scenes' checkPswd()).
const PASSWORDS = {
  '21-1': ['Strange time'],
  '22': ['8', '21', '34'],
  '24': ['Gualtiero', 'Forsety', 'Cordelia Bianchetti'],
  '25': ['zozza', 'bomba', 'bongiorno'],
  '37': ['back to', 'santa', 'and chill'],
};

// GPS / voice / QR triggers recovered from the APK (the scene-to-scene flow is in data/story/flow.json).
const GPS = [
  [['Schiaffino, 25,'], '7'], [['Schiaffino, 30,', 'Schiaffino, 32,', 'Schiaffino, 23,'], '6'],
  [['Schiaffino, 21,', 'Schiaffino, 20,', 'Baldinucci, 46,'], '8-1'], [['Armenia'], '22-1'],
  [['Baldinucci, 76,', 'Baldinucci, 63,', 'Dergano'], '9'], [['Bausan'], '14'], [['Schiavone'], '15'],
  [['Massara', 'Mercantini'], '32'], [['Candiani'], '26'], [['Cevedale'], '23'], [['Cevedale, 3,'], '24-2'],
  [['Reale'], '33'], [['Bovisasca, 57,', 'Davanzati'], '10'], [['Caianello'], '28'],
  [['Guerzoni, 40', 'Imbonati'], '27'], [['Ciaia, 6,'], '19'], [['Ciaia, 5,'], '36'],
  [['Ciaia, 8,', 'Ciaia, 1,'], '21'], [['Ciaia, 4,', 'Guerzoni, 39,'], '29'], [['Butti'], '17-1'],
  [['Bodio'], '35'], [['Livigno'], '18'], [['Varè'], '20'],
  [['Alfieri', 'Bovisasca, 59,', 'Bovisasca, 1,', 'Bovisasca, 9,', 'Resegone'], '31'], [['Jenner'], '30'],
  [['Carnevali, 113,'], '12'], [['Carnevali, 104,'], '13'], [['Imbriani, 54,'], '11'], [['Durando'], '34'],
];
const VOICE = [
  [['bom'], '8'], [["It's", 'arden'], '17'], [['boom', 'rchive'], '22'], [['oretti'], '24'],
  [['uardia'], '12-1'], [['ong'], '9-1'], [['scotch'], '18-1'],
];
const QR_ONLY = ['1-2', '2-1-3', '4', '5', '5-1', '16', '16-1', '20-1', '21-1', '25', '37'];

// Scenes exported from CodePen in a debug state: JS run after load to restore the intended start.
const FIXUPS = {
  // Exported with the ending video (#container3) visible and the dialogue (#container) hidden.
  '24': '$("#container3").hide(); $("#container").show();',
};

const MAX_STATES = 400;
const TIMER_TICKS = 200;

function cssAssets(css) {
  // class -> asset basename, from rules like `.char_img_sirio { background: url(.../sirio_shocked.png) }`
  const map = {};
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const url = m[2].match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
    if (!url || !/petronius\.epizy\.com\/assets\//.test(url[1])) continue;
    for (const sel of m[1].split(',')) {
      const s = sel.trim().match(/^([.#])([\w-]+)$/);
      if (s) map[s[1] === '#' ? '#' + s[2] : s[2]] = path.basename(url[1]);
    }
  }
  return map;
}

function load(scene) {
  const dir = path.join(ROOT, `petronius-${scene}`, 'src');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/onload="[^"]*"/g, '');
  // Browsers skip stray `}` (20-1 has one) but jsdom's CSS parser rejects the whole sheet.
  let depth = 0;
  const css = [...fs.readFileSync(path.join(dir, 'style.css'), 'utf8').replace(/@import[^;]+;/g, '')]
    .filter((ch) => (ch === '{' ? ++depth : ch === '}' ? depth-- > 0 || (depth = 0) : true)).join('');
  const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');
  return { html, css, js, fixup: FIXUPS[scene] };
}

function boot(src) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.message || e)));
  const dom = new JSDOM(`<!doctype html><html><head><style>${src.css}</style></head><body>${src.html}</body></html>`,
    { runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: false });
  const w = dom.window;
  const timers = [];
  w.alert = () => {};
  // Scenes only use setInterval (arrow bounce + puzzle countdowns); setTimeout is jQuery-internal.
  w.setInterval = (fn) => { timers.push(fn); return timers.length; };
  w.setTimeout = () => 0;
  w.clearInterval = w.clearTimeout = () => {};
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  // Elements hidden by the stylesheet (computed once; afterwards only inline styles change).
  const cssHidden = new Set([...w.document.body.querySelectorAll('*')].filter((e) => w.getComputedStyle(e).display === 'none'));
  w.document.documentElement.requestFullscreen = () => Promise.resolve();
  w.eval(JQUERY);
  w.jQuery.fx.off = true;
  try { w.eval(src.js); } catch (e) { errors.push('script: ' + e.message); }
  if (src.fixup) w.eval(src.fixup);
  const loadTimers = timers.length;
  return { dom, w, doc: w.document, timers, loadTimers, errors, cssHidden };
}

const isVisible = (env, el) => {
  for (let e = el; e && e.tagName !== 'BODY'; e = e.parentElement) {
    const d = e.style.display;
    if (d === 'none' || (!d && env.cssHidden.has(e))) return false;
  }
  return true;
};

// In-place snapshot/restore of the mutable DOM state (inline styles, classes, input values).
// Structure changes (jQuery .append moving nodes) are detected via `shape` and force a replay.
const shape = (env) => [...env.doc.body.querySelectorAll('*')].map((e) => e.parentElement.children.length + e.tagName).join();
function snapshot(env) {
  const els = [...env.doc.body.querySelectorAll('*')];
  return { shape: shape(env), attrs: els.map((e) => [e, e.getAttribute('style'), e.getAttribute('class'), e.value]) };
}
function restore(env, snap) {
  if (shape(env) !== snap.shape) return false;
  for (const [e, style, cls, value] of snap.attrs) {
    if (style === null) e.removeAttribute('style'); else if (e.getAttribute('style') !== style) e.setAttribute('style', style);
    if (cls === null) e.removeAttribute('class'); else if (e.getAttribute('class') !== cls) e.setAttribute('class', cls);
    if (value !== undefined && e.value !== value) e.value = value;
  }
  return true;
}

// A beat is a dialogue line (element with a direct .box child), a #containerN that is a
// text-only card, a password puzzle or a full-screen video, or the end screen (#loading).
function isBeat(el) {
  if (!el.id) return false;
  if (el.id === 'loading') return true;
  if ([...el.children].some((c) => c.classList.contains('box'))) return true;
  // Any other #containerN that holds no dialogue is a full-screen "screen" (card, puzzle, timer, video, image).
  return /^container/.test(el.id) && !el.querySelector('.box');
}

const beatsOf = (doc) => [...doc.body.querySelectorAll('[id]')].filter(isBeat);
const visibleBeats = (env) => beatsOf(env.doc).filter((b) => isVisible(env, b)).map((b) => b.id);
const stateKey = (env) =>
  shape(env) + '#' + [...env.doc.body.querySelectorAll('*')].map((e) => (e.getAttribute('style') || '') + '.' + (e.getAttribute('class') || '')).join('|')
  + '#' + [...env.doc.querySelectorAll('input')].map((i) => i.value).join(',');

function clickables(env) {
  const $ = env.w.jQuery;
  return [...env.doc.body.querySelectorAll('*')].filter((el) => {
    if (el.id === 'play' || el.classList.contains('audio')) return false;
    const ev = $._data(el, 'events');
    if (!(ev && ev.click) && !el.getAttribute('onclick')) return false;
    return isVisible(env, el);
  });
}

const pathOf = (doc, el) => {
  const p = [];
  for (let e = el; e && e !== doc.body; e = e.parentElement) p.unshift([...e.parentElement.children].indexOf(e));
  return p;
};
const byPath = (doc, p) => p.reduce((e, i) => e && e.children[i], doc.body);

// Actions: {type:'click', path} | {type:'password', path, answers} | {type:'timeout', timer}
//        | {type:'force', id}  (hide every beat, then show beat `id`: used to explore orphan branches)
function apply(env, a) {
  if (a.type === 'force') {
    for (const b of beatsOf(env.doc)) b.style.display = 'none';
    for (let e = env.doc.getElementById(a.id); e && e.tagName !== 'BODY'; e = e.parentElement) e.style.display = 'block';
    return;
  }
  if (a.type === 'timeout') {
    const fn = env.timers[a.timer];
    for (let i = 0; i < TIMER_TICKS; i++) { try { fn.call(env.w); } catch { break; } }
    return;
  }
  if (a.type === 'password') {
    const inputs = [...env.doc.querySelectorAll('input[id^="pswd"]')];
    inputs.forEach((inp, i) => { inp.value = a.answers[i] ?? ''; });
  }
  const el = byPath(env.doc, a.path);
  try {
    el.click();
    // jsdom only runs inline on* attributes with runScripts:'dangerously'; run them here instead.
    if (el.getAttribute('onclick')) env.w.eval(el.getAttribute('onclick'));
  } catch (e) { env.errors.push('click: ' + e.message); }
}

function replay(src, actions) {
  const env = boot(src);
  for (const a of actions) apply(env, a);
  return env;
}

function labelOf(el) {
  if (el.tagName === 'INPUT') return el.value || 'submit';
  if (el.classList.contains('scelta')) return el.textContent.replace(/\s+/g, ' ').trim();
  return null;
}

// Beat that "owns" a clickable: the clickable itself or its nearest beat ancestor.
function ownerBeat(el) {
  for (let e = el; e; e = e.parentElement) if (isBeat(e)) return e.id;
  return null;
}

function explore(scene, src, init = []) {
  const passwords = PASSWORDS[scene];
  let env = replay(src, init);
  const startBeats = visibleBeats(env);
  const seen = new Set([stateKey(env)]);
  const queue = [{ actions: init, snap: snapshot(env), env, timer: false }];
  const edges = new Map(); // "from|label|to" -> edge
  const visited = new Set(startBeats);
  const errors = new Set(env.errors);
  const timerBeats = new Set();

  const record = (from, to, label, kind) => {
    const k = `${from}|${label ?? ''}|${to}|${kind ?? ''}`;
    if (!edges.has(k)) edges.set(k, { from, to, ...(label ? { label } : {}), ...(kind ? { kind } : {}) });
  };
  // Bring `env` to the given state: restore in place when possible, otherwise replay from scratch.
  const goto = (st) => {
    if (st.env === env && restore(env, st.snap)) return;
    env = replay(src, st.actions);
    st.env = env; st.snap = snapshot(env);
  };

  while (queue.length && seen.size < MAX_STATES) {
    const st = queue.shift();
    goto(st);
    const before = new Set(visibleBeats(env));
    const timersBefore = env.timers.length;
    const candidates = [];
    for (const el of clickables(env)) {
      const p = pathOf(env.doc, el);
      const from = ownerBeat(el);
      const label = labelOf(el);
      if (el.getAttribute('onclick')?.includes('checkPswd')) {
        candidates.push({ a: { type: 'password', path: p, answers: passwords ?? [] }, from, label: 'password: correct', kind: 'password-correct' });
        candidates.push({ a: { type: 'password', path: p, answers: [] }, from, label: 'password: wrong', kind: 'password-wrong' });
      } else if (el.classList.contains('back')) {
        // Back arrows are explored (scenes like 9 reveal a "don't remember" choice only after going
        // back, via `$("#3 p").append(...)`) but not recorded: the engine offers "back" generically.
        candidates.push({ a: { type: 'click', path: p }, from: null });
      } else candidates.push({ a: { type: 'click', path: p }, from, label });
    }
    // Explore expiry of a puzzle countdown started on the path to this state (always via a fresh replay,
    // since the timer's closure state cannot be restored in place).
    const timerBeat = [...before].find((id) => env.doc.getElementById(id)?.querySelector('#timer'));
    if (st.timer && timerBeat) candidates.push({ timeout: true, from: timerBeat, label: 'time runs out', kind: 'timeout' });

    for (const c of candidates) {
      let next, actions;
      if (c.timeout) {
        next = replay(src, st.actions);
        actions = [...st.actions, { type: 'timeout', timer: next.timers.length - 1 }];
        apply(next, actions.at(-1));
      } else {
        goto(st);
        actions = [...st.actions, c.a];
        const n0 = env.timers.length;
        apply(env, c.a);
        next = env;
        c.startedTimer = env.timers.length > n0;
      }
      next.errors.forEach((e) => errors.add(e));
      if (c.startedTimer && c.from) timerBeats.add(c.from);
      const fresh = visibleBeats(next).filter((b) => !before.has(b));
      fresh.forEach((b) => visited.add(b));
      if (c.from) for (const to of fresh) record(c.from, to, c.label, c.kind);
      const key = stateKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ actions, snap: snapshot(next), env: next, timer: !c.timeout && (st.timer || c.startedTimer) });
      }
    }
  }
  return { startBeats, edges: [...edges.values()], visited, errors: [...errors], truncated: seen.size >= MAX_STATES, states: seen.size, timerBeats };
}

const clean = (s) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

function describe(doc, el, assets) {
  const beat = { id: el.id };
  if (el.id === 'loading') return { ...beat, kind: 'end' };
  // The original set each scene's background on its #containerN: record which one holds this beat.
  const box = el.id.startsWith('container') ? el : el.parentElement?.closest('[id^="container"]');
  if (box) beat.container = box.id;
  const name = el.querySelector('.char_name_l');
  const portrait = [...el.querySelectorAll('[class*="char_img_"]')].flatMap((e) => [...e.classList]).find((c) => c.startsWith('char_img_'));
  if (!name && !portrait) {
    const inputs = el.querySelectorAll('input[id^="pswd"]');
    if (inputs.length) return { ...beat, kind: 'puzzle', prompt: clean(el.textContent), inputs: inputs.length };
    const timer = el.querySelector('#timer');
    if (timer) {
      const t = { ...beat, kind: 'timer', seconds: parseInt(timer.textContent, 10) || null };
      const img = el.querySelector('img');
      if (img) t.image = path.basename(img.getAttribute('src'));
      const hints = el.querySelectorAll('.hint').length;
      if (hints) t.hints = hints; // find-the-differences: click all hint areas before time runs out
      return t;
    }
    const video = el.querySelector('video source, video[src]');
    if (video) return { ...beat, kind: 'video', src: path.basename(video.getAttribute('src')) };
    const text = clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
    if (!text && assets['#' + el.id]) return { ...beat, kind: 'image', asset: assets['#' + el.id] };
    return { ...beat, kind: 'card', text };
  }
  beat.kind = 'line';
  if (name) beat.speaker = name.textContent.trim().toLowerCase();
  if (portrait) beat.portrait = { class: portrait, asset: assets[portrait] ?? null };
  const p = el.querySelector('.testo');
  if (p) {
    const c = p.cloneNode(true);
    c.querySelectorAll('.scelta, input, script').forEach((x) => x.remove());
    c.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    const t = clean(c.textContent);
    if (t) beat.text = t;
  }
  const instr = [...el.querySelectorAll('b')].map((b) => clean(b.textContent)).filter(Boolean);
  if (instr.length) beat.instruction = instr.join(' / ');
  const media = [];
  for (const e of el.querySelectorAll('*')) {
    for (const c of e.classList) if (assets[c] && !c.startsWith('char_img_')) media.push({ type: 'image', class: c, asset: assets[c] });
    if (e.id && assets['#' + e.id]) media.push({ type: 'image', id: e.id, asset: assets['#' + e.id] });
    if (e.tagName === 'AUDIO' || e.tagName === 'VIDEO' || e.tagName === 'SOURCE') {
      const s = e.getAttribute('src');
      if (s) media.push({ type: e.tagName === 'VIDEO' || /\.mp4/.test(s) ? 'video' : 'audio', src: /epizy/.test(s) ? path.basename(s) : s.split('?')[0] });
    }
    if (e.tagName === 'IMG' && !/play\.png/.test(e.getAttribute('src') || '')) media.push({ type: 'image', asset: path.basename(e.getAttribute('src') || '') });
  }
  if (media.length) beat.media = media;
  const inputs = el.querySelectorAll('input[id^="pswd"]');
  if (inputs.length) beat.inputs = inputs.length;
  if (el.querySelector('#timer')) beat.timer = true;
  return beat;
}

function build(scene) {
  const src = load(scene);
  const assets = cssAssets(src.css);
  const r = explore(scene, src);
  // Beats never shown by playing the scene: force each one visible and explore from there,
  // so disconnected branches (e.g. what followed a "press the talk button" beat) are kept.
  const orphans = new Set();
  for (const b of beatsOf(boot(src).doc)) {
    if (r.visited.has(b.id)) continue;
    const sub = explore(scene, src, [{ type: 'force', id: b.id }]);
    for (const id of sub.visited) if (!r.visited.has(id)) { orphans.add(id); r.visited.add(id); }
    r.edges.push(...sub.edges.filter((e) => orphans.has(e.from)));
    sub.timerBeats.forEach((id) => r.timerBeats.add(id));
    r.errors.push(...sub.errors.filter((e) => !r.errors.includes(e)));
  }
  const env = boot(src);
  const beats = {};
  for (const el of beatsOf(env.doc)) beats[el.id] = describe(env.doc, el, assets);
  for (const e of r.edges) {
    const b = beats[e.from];
    if (!b) continue;
    (b.next ??= []).push({ to: e.to, ...(e.label ? { label: e.label } : {}), ...(e.kind ? { kind: e.kind } : {}) });
  }
  for (const id of r.timerBeats) if (beats[id]) beats[id].startsTimer = true;
  // Accepted answers, in input order (the original compared case-sensitively against a few variants).
  for (const b of Object.values(beats)) if (b.kind === 'puzzle' && PASSWORDS[scene]) b.answers = PASSWORDS[scene];
  for (const id of orphans) {
    if (!beats[id]) continue;
    // Unreachable cards are CodePen-template leftovers ("Una notte dopo...", empty screens): drop them.
    if (beats[id].kind === 'card') { delete beats[id]; orphans.delete(id); r.visited.delete(id); continue; }
    beats[id].orphan = true;
  }
  // "Press the talk button to say something or leave": the scene waits for a voice keyword (APK trigger).
  for (const b of Object.values(beats))
    if (!b.next?.length && /talk button/i.test(b.instruction ?? '')) b.waitsFor = 'voice';
  for (const b of Object.values(beats)) if (b.next) b.next = b.next.filter((n) => beats[n.to]);
  const order = beatsOf(env.doc).map((b) => b.id).filter((id) => r.visited.has(id));
  const story = {
    scene,
    pen: (fs.readFileSync(path.join(ROOT, `petronius-${scene}`, 'README.markdown'), 'utf8').match(/https:\/\/codepen\.io\/[^\s)\]]+/) || [null])[0],
    start: r.startBeats[0] ?? null,
    characters: [...new Set(Object.values(beats).map((b) => b.speaker).filter(Boolean))],
    assets: [...new Set(Object.values(assets))],
    beats: Object.fromEntries(order.map((id) => [id, beats[id]])),
  };
  return { story, r };
}

// English proofreading of the original dialogue (data/story/text-fixes.json, hand-curated):
// '<scene>#<beat>' -> { text | instruction | prompt: corrected value, next: { old label: new label } }.
// A fix whose beat or label no longer exists is reported, never silently dropped.
const TEXT_FIXES = fs.existsSync(path.join(OUT, 'text-fixes.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'text-fixes.json'), 'utf8')).scenes : {};
function applyTextFixes(story, r) {
  r.stale ??= [];
  for (const [key, fix] of Object.entries(TEXT_FIXES)) {
    const [scene, id] = key.split('#');
    if (scene !== story.scene) continue;
    const beat = story.beats[id];
    if (!beat) { r.stale.push(key); continue; }
    for (const field of ['text', 'instruction', 'prompt']) if (fix[field] != null) beat[field] = fix[field];
    for (const [from, to] of Object.entries(fix.next ?? {})) {
      const edges = (beat.next ?? []).filter((n) => n.label === from);
      if (!edges.length) r.stale.push(`${key} label "${from}"`);
      edges.forEach((n) => { n.label = to; });
    }
  }
  if (r.stale.length) console.warn(`${story.scene}: text fixes not applied: ${r.stale.join(', ')}`);
}

function main() {
  const scenes = fs.readdirSync(ROOT).filter((d) => /^petronius-/.test(d)).map((d) => d.slice('petronius-'.length))
    .sort((a, b) => a.split('-').map(Number).reduce((x, n, i) => x || n - (b.split('-').map(Number)[i] ?? -1), 0));
  const only = process.argv[2];
  fs.mkdirSync(path.join(OUT, 'scenes'), { recursive: true });
  const report = ['# Scene extraction report', '', '| scene | beats | edges | states | dead ends | orphans (kept) | leftovers (dropped) | errors |', '|---|---|---|---|---|---|---|---|'];
  const index = [];
  const built = scenes.filter((s) => !only || s === only).map(build);
  // Orphan lines whose text also appears in a reachable beat of any scene are copy-paste leftovers: drop them.
  const reachable = new Set(built.flatMap(({ story }) => Object.values(story.beats).filter((b) => !b.orphan && b.text).map((b) => b.text)));
  for (const { story, r } of built) {
    r.leftovers = [];
    for (const [id, b] of Object.entries(story.beats))
      if (b.orphan && b.text && reachable.has(b.text)) { delete story.beats[id]; r.leftovers.push(id); }
    for (const b of Object.values(story.beats)) if (b.next) b.next = b.next.filter((n) => story.beats[n.to]);
  }
  for (const { story, r } of built) {
    const scene = story.scene;
    const unreachable = Object.values(story.beats).filter((b) => b.orphan).map((b) => b.id);
    applyTextFixes(story, r);
    fs.writeFileSync(path.join(OUT, 'scenes', `${scene}.json`), JSON.stringify(story, null, 2) + '\n');
    const dead = Object.values(story.beats).filter((b) => !['end', 'video'].includes(b.kind) && !b.waitsFor && !(b.next?.length)).map((b) => b.id);
    const nEdges = Object.values(story.beats).reduce((n, b) => n + (b.next?.length ?? 0), 0);
    report.push(`| ${scene} | ${Object.keys(story.beats).length} | ${nEdges} | ${r.states}${r.truncated ? ' (truncated)' : ''} | ${dead.join(' ') || '-'} | ${unreachable.join(' ') || '-'} | ${r.leftovers.join(' ') || '-'} | ${r.errors.map((e) => e.slice(0, 60)).join('; ') || '-'} |`);
    index.push({ scene, characters: story.characters, beats: Object.keys(story.beats).length });
    console.log(`${scene}: ${Object.keys(story.beats).length} beats, ${nEdges} edges, ${r.states} states${dead.length ? ', dead ends: ' + dead.join(' ') : ''}`);
  }
  if (!only) {
    const triggers = {
      gps: GPS.map(([match, scene]) => ({ match, scene })),
      voice: VOICE.map(([match, scene]) => ({ match, scene })),
      qrOnly: QR_ONLY,
    };
    fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ scenes: index, triggers }, null, 2) + '\n');
    fs.writeFileSync(path.join(OUT, 'report.md'), report.join('\n') + '\n');
  }
}

main();
