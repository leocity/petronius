// Tiny DOM helpers shared by every module. Text is always added as text nodes (never as HTML).

// h('div', { class: 'x', onclick: fn, hidden: true }, child, [children], 'text'): attributes starting with "on" are
// listeners, `true` sets a bare attribute, `false`/null skips it; null/false children are skipped.
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
  return el;
};

// el('p', 'empty', 'text'): an element with a class and text, for the lists in the notebook and the map panel.
export const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});
