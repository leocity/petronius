// Journal clues in home mode: the paper item (flyer, sticker, notebook page…) shown in the app, with the
// physical mechanic where there was one (a transparent sheet or a ripped piece to lay over it, a coaster to
// turn, a spot to search) and an answer to type.
import { assetUrl } from './story.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
  return el;
};

// Answers are compared without case, accents, spaces or punctuation ("Tango d'Amore" == "tangodamore"),
// and must match one accepted variant exactly.
export const compact = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const accepts = (clue, text) => (clue.answers ?? []).map(compact).includes(compact(text));

// ---------- Images ----------
// Zoom: the image in a dialog you can pinch, drag and double-tap (wheel and +/- buttons on a computer).
const MAX_ZOOM = 6;
let box;
function panZoom(view, img) {
  let s = 1, x = 0, y = 0;            // scale and offset (px) from the centre of the view
  const pts = new Map();              // active pointers
  let lastTap = 0, moved = 0;
  const apply = () => {
    s = Math.min(MAX_ZOOM, Math.max(1, s));
    const mx = Math.max(0, (img.offsetWidth * s - view.clientWidth) / 2);
    const my = Math.max(0, (img.offsetHeight * s - view.clientHeight) / 2);
    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
    img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    view.classList.toggle('zoomed', s > 1);
  };
  // Zoom to ns keeping the point (fx, fy), measured from the view's centre, under the finger.
  const zoomAt = (ns, fx, fy) => {
    ns = Math.min(MAX_ZOOM, Math.max(1, ns));
    x = fx - (fx - x) * (ns / s); y = fy - (fy - y) * (ns / s); s = ns; apply();
  };
  const centre = (e) => { const r = view.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  view.addEventListener('pointerdown', (e) => {
    try { view.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
  });
  view.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 2) {
      const before = spread();
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()];
      const [fx, fy] = centre({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      if (before > 0) zoomAt(s * (spread() / before), fx, fy);
    } else {
      x += e.clientX - p.x; y += e.clientY - p.y;
      moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
      apply();
    }
  });
  const release = (e) => {
    if (pts.size === 1 && moved < 8 && e.type === 'pointerup') {   // a tap; two quick taps toggle the zoom
      const now = e.timeStamp;
      if (now - lastTap < 320) { const [fx, fy] = centre(e); zoomAt(s > 1 ? 1 : 2.5, fx, fy); lastTap = 0; }
      else lastTap = now;
    }
    pts.delete(e.pointerId);
  };
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);
  view.addEventListener('wheel', (e) => { e.preventDefault(); const [fx, fy] = centre(e); zoomAt(s * (e.deltaY < 0 ? 1.25 : 0.8), fx, fy); }, { passive: false });
  img.addEventListener('load', apply);
  return { by: (f) => zoomAt(s * f, 0, 0), reset: () => { s = 1; x = 0; y = 0; apply(); } };
}

export function zoom(item) {
  box ??= document.body.appendChild(h('dialog', { class: 'zoom', 'aria-label': 'Enlarged image' }));
  const img = h('img', { src: assetUrl(item.file), alt: item.alt ?? '', draggable: 'false' });
  const view = h('div', { class: 'zoom-view' }, img);
  const pz = panZoom(view, img);
  box.replaceChildren(
    view,
    h('p', {}, item.alt ?? ''),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Zoom in', onclick: () => pz.by(1.6) }, '+'),
      h('button', { class: 'btn btn-small', type: 'button', 'aria-label': 'Zoom out', onclick: () => pz.by(1 / 1.6) }, '−'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => box.close() }, 'Close')),
    h('p', { class: 'zoom-help' }, 'Pinch or double-tap to zoom, drag to move.'));
  box.showModal();
}

const thumb = (item) => h('button', { class: `thumb${/\.png$/.test(item.file) ? ' on-dark' : ''}`, type: 'button', onclick: () => zoom(item), 'aria-label': `Enlarge: ${item.alt ?? item.file}` },
  h('img', { src: assetUrl(item.file), alt: '' }));

// One large picture, full width, for the clues that are a single image to study (tap to enlarge).
export const bigImage = (item) => h('button', { class: `big-image${/\.png$/.test(item.file) ? ' on-dark' : ''}`, type: 'button', onclick: () => zoom(item), 'aria-label': `Enlarge: ${item.alt ?? item.file}` },
  h('img', { src: assetUrl(item.file), alt: item.alt ?? '' }));

// A base image with a sheet (or ripped piece) the player drags onto it.
// sheet: true -> same size as the base, target (0, 0); or { w, at: [x, y] } as fractions of the base.
// Touch: drag by the grip, so the rest of the image still scrolls the page. Mouse/pen: drag anywhere on it.
function overlay(base, sheet) {
  const spec = sheet.sheet === true ? { w: 1, at: [0, 0] } : sheet.sheet;
  const [tx, ty] = spec.at ?? [0, 0];
  const start = [Math.max(0, Math.min(1 - spec.w, tx + (tx > 0.5 ? -0.35 : 0.12))), Math.max(0, ty > 0.5 ? ty - 0.4 : ty + 0.12)];
  let [x, y] = start;
  const img = h('img', { src: assetUrl(sheet.file), alt: '', draggable: 'false' });
  const grip = h('span', { class: 'grip', 'aria-hidden': 'true' }, '✥');
  const layer = h('div', { class: 'sheet', tabindex: '0', role: 'img', style: `width:${spec.w * 100}%`,
    'aria-label': `${sheet.alt}. Drag it by the handle, or use the arrow keys.` }, img, grip);
  const baseImg = h('img', { src: assetUrl(base.file), alt: base.alt ?? '' });
  // Percent positions are relative to the frame (exactly the base image); the stage adds room below it.
  const frame = h('div', { class: 'overlay-frame' }, baseImg, layer);
  const stage = h('div', { class: 'overlay-stage' }, frame);
  const help = h('p', { class: 'overlay-help', role: 'status' }, 'Drag the handle (or use the arrow keys) until it lines up.');
  const place = () => {
    const snap = Math.hypot(x - tx, y - ty) < 0.03;
    if (snap) { x = tx; y = ty; }
    stage.classList.toggle('aligned', snap);
    help.textContent = snap ? 'It fits.' : 'Drag the handle (or use the arrow keys) until it lines up.';
    layer.style.left = `${x * 100}%`;
    layer.style.top = `${y * 100}%`;
  };
  // A piece that hangs below the base (the torn memo) needs room under it.
  const room = () => {
    if (!baseImg.naturalWidth || !img.naturalWidth) return;
    const ratio = baseImg.naturalHeight / baseImg.naturalWidth;                 // base height / width
    const sheetH = (spec.w * img.naturalHeight / img.naturalWidth) / ratio;     // sheet height in base heights
    // padding-bottom in % is relative to the width, so this holds at any size and before layout.
    stage.style.paddingBottom = `${Math.max(0, ty + sheetH - 1) * ratio * 100}%`;
  };
  baseImg.addEventListener('load', room);
  img.addEventListener('load', room);
  place();
  layer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.target !== grip) return;   // let the page scroll
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    const r = baseImg.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, x0 = x, y0 = y;
    const move = (m) => { x = x0 + (m.clientX - sx) / r.width; y = y0 + (m.clientY - sy) / r.height; place(); };
    const up = () => { layer.removeEventListener('pointermove', move); layer.removeEventListener('pointerup', up); layer.removeEventListener('pointercancel', up); };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
  });
  layer.addEventListener('keydown', (e) => {
    const d = e.shiftKey ? 0.05 : 0.005;
    const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (k) { e.preventDefault(); x += k[0]; y += k[1]; place(); }
  });
  return h('div', { class: 'overlay' }, stage, help,
    h('button', { class: 'btn btn-small', type: 'button', onclick: () => { [x, y] = start; place(); } }, 'Reset'));
}

// An item to rotate until it lines up with something else (the coaster against the mural).
function turner(item) {
  let angle = item.angle ?? 90;
  const img = h('img', { src: assetUrl(item.file), alt: item.alt ?? '' });
  const status = h('p', { class: 'overlay-help', role: 'status' });
  const show = () => {
    angle = ((angle % 360) + 360) % 360;
    img.style.transform = `rotate(${angle}deg)`;
    wrap.classList.toggle('aligned', angle === 0);
    status.textContent = angle === 0 ? 'The stripes line up with the wall.' : 'Turn it until the stripes run like the wall’s.';
  };
  const wrap = h('div', { class: 'turn-stage' }, img);
  const btn = (label, d) => h('button', { class: 'btn btn-small', type: 'button', onclick: () => { angle += d; show(); } }, label);
  show();
  return h('div', { class: 'overlay' }, wrap, status, h('div', { class: 'actions' }, btn('Turn left', -45), btn('Turn right', 45)));
}

export function gallery(items) {
  const out = [];
  const thumbs = [];
  items.forEach((it, i) => {
    if (it.sheet) return;
    if (it.turn) { out.push(turner(it)); return; }
    const next = items[i + 1];
    if (next?.sheet) out.push(overlay(it, next));
    else thumbs.push(thumb(it));
  });
  if (thumbs.length) out.unshift(h('div', { class: 'gallery' }, thumbs));
  return out;
}

// ---------- The clue panel ----------
// onSolved(clue) is called once the player has solved it, or chose to see the solution; onDone() continues the scene.
export function cluePanel(clue, { doneLabel = 'Continue', onSolved, onDone }) {
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const hintList = h('ol', { class: 'hints' });
  const finish = (msg) => {
    feedback.textContent = msg;
    onSolved?.(clue);
    form?.querySelector('input')?.setAttribute('disabled', '');
    actions.replaceChildren(h('button', { class: 'btn btn-primary', type: 'button', onclick: onDone }, doneLabel));
    actions.querySelector('button').focus();
  };

  let shown = 0;
  const hintBtn = clue.answers && h('button', { class: 'btn', type: 'button', onclick: () => {
    if (shown < (clue.hints ?? []).length) hintList.append(h('li', {}, clue.hints[shown++]));
    else finish(`Solution: ${clue.solution}`);
    if (shown === (clue.hints ?? []).length) hintBtn.textContent = 'Show the solution';
  } }, (clue.hints ?? []).length ? 'Hint' : 'Show the solution');

  const actions = h('div', { class: 'actions' });
  let form = null;
  if (clue.answers) {
    const input = h('input', { id: 'clue-answer', autocomplete: 'off', spellcheck: 'false' });
    form = h('form', { onsubmit: (e) => {
      e.preventDefault();
      if (accepts(clue, input.value)) finish(`That's it: ${clue.solution}.`);
      else { feedback.textContent = input.value.trim() ? 'Not quite. Look again, or ask for a hint.' : 'Write your answer first.'; input.select(); }
    } }, h('label', { for: 'clue-answer' }, clue.question), input);
    actions.append(h('button', { class: 'btn btn-primary', type: 'submit' }, 'Check'), hintBtn);
    form.append(feedback, hintList, actions);
  } else {
    actions.append(h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { onSolved?.(clue); onDone(); } }, doneLabel));
  }

  // reveal: a second step (search the spot on the map, read the inscription) that shows more.
  let reveal = null;
  if (clue.reveal) {
    const body = h('div', { class: 'reveal', hidden: true },
      clue.reveal.text ? h('p', {}, clue.reveal.text) : null, gallery(clue.reveal.items ?? []));
    reveal = h('div', {}, h('button', { class: 'btn', type: 'button', onclick: (e) => { body.hidden = false; e.currentTarget.remove(); } }, clue.reveal.label), body);
  }

  return h('section', { class: 'clue full', 'aria-label': clue.title },
    h('h2', {}, clue.title),
    clue.text ? h('p', {}, clue.text) : null,
    gallery(clue.items ?? []),
    reveal,
    form ?? actions);
}

// Hints for the scene's own password puzzles (they have their own answer fields). Returns { btn, list }.
export function hints(clue) {
  let shown = 0;
  const list = h('ol', { class: 'hints' });
  const btn = h('button', { class: 'btn', type: 'button', onclick: () => {
    if (shown < (clue.hints ?? []).length) list.append(h('li', {}, clue.hints[shown++]));
    else { list.append(h('li', { class: 'solution' }, `Solution: ${clue.solution}`)); btn.remove(); }
    if (shown === (clue.hints ?? []).length && btn.isConnected) btn.textContent = 'Show the solution';
  } }, 'Hint');
  return { btn, list };
}

// Find-the-differences on an image (timer beats): returns { el, onWrong } where taps outside the areas call onWrong.
export function hotspotImage(image, areas, { onFound, onAllFound, onWrong }) {
  const found = new Set();
  const img = h('img', { src: assetUrl(image.file), alt: image.alt ?? '' });
  const marks = areas.map(([x0, y0, x1, y1], i) => h('button', {
    class: 'spot', type: 'button', 'aria-label': `Difference ${i + 1}`,
    style: `left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%`,
    onclick: (e) => {
      e.stopPropagation();
      if (found.has(i)) return;
      found.add(i);
      e.currentTarget.classList.add('found');
      onFound?.(found.size);
      if (found.size === areas.length) onAllFound();
    },
  }));
  const el = h('div', { class: 'spot-stage', onclick: () => onWrong?.() }, img, marks);
  return el;
}
