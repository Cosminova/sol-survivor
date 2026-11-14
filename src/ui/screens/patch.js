// Mission Patch Designer: live HiDPI canvas, labelled controls, autosave to the store, PNG export, print.
import '../../styles/patch.css';
import { h, mount, announce } from '../dom.js';
import { getState, setPatch } from '../../state/store.js';
import { toast } from '../components/common.js';
import { play } from '../audio.js';
import { EMBLEMS } from './learn/patchEmblems.js';
import { SHAPES, DEFAULT_DESIGN, MAX_NAME, MAX_CREW_NAME, MAX_STARS, sanitizeDesign, paintCanvas, patchBlob } from './learn/patchCanvas.js';

const CANVAS_SIZE = 512;
const SAVE_DELAY = 500;

const SWATCHES = {
  bg: [['#0e1736', 'Space navy'], ['#040714', 'Deep space'], ['#7a2a10', 'Mars rust'], ['#2a1f5c', 'Nebula violet'], ['#0b4f5c', 'Ocean teal'], ['#e8eefc', 'Moon white']],
  border: [['#ff7a3d', 'Mars orange'], ['#ffd166', 'Gold'], ['#4fe3ff', 'Telemetry cyan'], ['#cfd8ea', 'Moon silver'], ['#e63946', 'Rocket red'], ['#4ade80', 'Go green']],
  accent: [['#ffd166', 'Gold'], ['#ffffff', 'White'], ['#4fe3ff', 'Cyan'], ['#ff7a3d', 'Orange'], ['#f472b6', 'Pink'], ['#a3e635', 'Lime']],
};
const COLOR_LABELS = { bg: 'Background', border: 'Border', accent: 'Accent & stars' };

function initialDesign() {
  const { patch, lastResult } = getState();
  if (patch) return sanitizeDesign(patch);
  const title = lastResult?.mission?.config?.title;
  return sanitizeDesign({ ...DEFAULT_DESIGN, name: typeof title === 'string' && title ? title : DEFAULT_DESIGN.name });
}

function describe(d) {
  const shape = SHAPES.find((s) => s.id === d.shape)?.label ?? d.shape;
  const emblem = EMBLEMS.find((e) => e.id === d.emblem)?.label ?? d.emblem;
  const crew = d.crew.filter((c) => c.trim()).join(', ') || 'no crew names';
  return `Mission patch preview: ${shape} shape with a ${emblem} emblem. Mission name: ${d.name || 'blank'}. Crew: ${crew}. ${d.stars} star${d.stars === 1 ? '' : 's'}.`;
}

function radioGroup({ name, legend, options, value, onPick, className }) {
  return h('fieldset', { class: ['patch-group', className] },
    h('legend', null, legend),
    h('div', { class: 'patch-options' },
      options.map((o) => h('label', { class: 'patch-opt' },
        h('input', { type: 'radio', name, value: o.id, checked: o.id === value, onchange: () => onPick(o.id) }),
        h('span', { class: 'patch-opt-face' }, h('span', { class: 'patch-opt-icon', 'aria-hidden': 'true' }, o.icon), h('span', null, o.label))))));
}

function colorGroup(key, value, onPick) {
  const custom = h('input', {
    type: 'color', class: 'patch-color-input', value, 'aria-label': `Custom ${COLOR_LABELS[key].toLowerCase()} color`,
    oninput: (e) => onPick(e.target.value, true),
  });
  return h('fieldset', { class: 'patch-group patch-colors', dataset: { key } },
    h('legend', null, COLOR_LABELS[key]),
    h('div', { class: 'patch-swatches' },
      SWATCHES[key].map(([hex, label]) => h('label', { class: 'patch-swatch', title: label },
        h('input', { type: 'radio', name: `patch-${key}`, value: hex, checked: hex === value, onchange: () => onPick(hex, false) }),
        h('span', { class: 'patch-swatch-dot', style: { '--swatch': hex }, 'aria-hidden': 'true' }),
        h('span', { class: 'sr-only' }, label))),
      h('label', { class: 'patch-custom' }, custom, h('span', { 'aria-hidden': 'true' }, 'Custom'))));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, class: 'sr-only' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function render(root) {
  let design = initialDesign();
  let saveTimer = null;
  let printCleanup = null;

  const canvas = h('canvas', { class: 'patch-canvas', role: 'img', width: CANVAS_SIZE, height: CANVAS_SIZE });
  const status = h('span', { class: 'patch-status faint' });
  const starsOut = h('output', { class: 'patch-stars-out mono', for: 'patch-stars' }, String(design.stars));

  const paint = () => {
    paintCanvas(canvas, design, CANVAS_SIZE);
    canvas.setAttribute('aria-label', describe(design));
  };

  const save = (explicit = false) => {
    clearTimeout(saveTimer);
    setPatch(design);
    status.textContent = 'Saved ✓';
    if (explicit) { toast('Patch saved to this device.', { icon: '🧵' }); play('good'); }
  };

  const update = (patch) => {
    design = sanitizeDesign({ ...design, ...patch });
    paint();
    status.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(false), SAVE_DELAY);
  };

  function syncColorRadios(key, hex, fromCustom) {
    root.querySelectorAll(`.patch-colors[data-key="${key}"] input[type=radio]`).forEach((r) => { r.checked = !fromCustom && r.value === hex; });
    const custom = root.querySelector(`.patch-colors[data-key="${key}"] input[type=color]`);
    if (custom && !fromCustom) custom.value = hex;
  }

  const pickColor = (key) => (hex, fromCustom) => { update({ [key]: hex }); syncColorRadios(key, hex, fromCustom); };

  async function exportPng() {
    try {
      download(await patchBlob(design, 1024), 'sol-survivor-patch.png');
      announce('Patch image downloaded.');
      play('win');
    } catch (err) {
      console.error('[patch] export failed', err);
      toast('Sorry, this device could not create the image. Try Print instead.', { icon: '⚠️' });
    }
  }

  function printPatch() {
    root.classList.add('patch-printing');
    const done = () => { root.classList.remove('patch-printing'); window.removeEventListener('afterprint', done); printCleanup = null; };
    printCleanup = done;
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(() => printCleanup?.(), 1000);
  }

  function reset() {
    design = sanitizeDesign(DEFAULT_DESIGN);
    mount(controlsSlot, controls());
    paint();
    save(false);
    announce('Patch reset to the default design.');
  }

  const textInput = (id, label, value, max, onInput) => h('label', { class: 'field', for: id },
    h('span', null, label),
    h('input', { class: 'input', id, type: 'text', value, maxlength: max, autocomplete: 'off', spellcheck: 'false', oninput: (e) => onInput(e.target.value) }));

  function controls() {
    return h('div', { class: 'patch-controls stack' },
      h('section', { class: 'panel stack', 'aria-labelledby': 'patch-words' },
        h('h2', { id: 'patch-words', class: 'panel-title' }, 'Words'),
        textInput('patch-name', `Mission name (up to ${MAX_NAME} letters)`, design.name, MAX_NAME, (v) => update({ name: v })),
        h('fieldset', { class: 'patch-group' },
          h('legend', null, 'Crew names (up to 4)'),
          h('div', { class: 'patch-crew' }, design.crew.map((name, i) => textInput(`patch-crew-${i}`, `Crew member ${i + 1}`, name, MAX_CREW_NAME,
            (v) => update({ crew: design.crew.map((c, j) => (j === i ? v : c)) })))))),
      h('section', { class: 'panel stack', 'aria-labelledby': 'patch-look' },
        h('h2', { id: 'patch-look', class: 'panel-title mars' }, 'Shape & emblem'),
        radioGroup({ name: 'patch-shape', legend: 'Patch shape', options: SHAPES, value: design.shape, onPick: (v) => update({ shape: v }) }),
        radioGroup({ name: 'patch-emblem', legend: 'Emblem', options: EMBLEMS, value: design.emblem, onPick: (v) => update({ emblem: v }), className: 'patch-emblems' }),
        h('label', { class: 'field', for: 'patch-stars' },
          h('span', null, 'Stars ', starsOut),
          h('input', { id: 'patch-stars', type: 'range', min: 0, max: MAX_STARS, step: 1, value: design.stars,
            oninput: (e) => { starsOut.textContent = e.target.value; update({ stars: Number(e.target.value) }); } }))),
      h('section', { class: 'panel stack', 'aria-labelledby': 'patch-colors-title' },
        h('h2', { id: 'patch-colors-title', class: 'panel-title' }, 'Colors'),
        ['bg', 'border', 'accent'].map((key) => colorGroup(key, design[key], pickColor(key)))));
  }

  const controlsSlot = h('div', { class: 'no-print' });
  mount(controlsSlot, controls());

  mount(root,
    h('header', { class: 'screen-head no-print' },
      h('div', null,
        h('span', { class: 'kicker mars' }, '🧵 Mission Patch Designer'),
        h('h1', null, 'Design your crew’s patch'),
        h('p', null, 'Every NASA crew designs a patch for its mission and wears it on their flight suits. Make one for your outpost!')),
      h('a', { class: 'btn btn-ghost', href: '#/badges' }, '← Back to badges')),
    h('div', { class: 'patch-layout' },
      h('section', { class: 'patch-preview panel', 'aria-label': 'Patch preview' },
        h('div', { class: 'patch-stage' }, canvas),
        h('div', { class: 'row patch-actions no-print' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => save(true) }, '💾 Save'),
          h('button', { type: 'button', class: 'btn btn-cyan', onclick: exportPng }, '⬇️ Export PNG'),
          h('button', { type: 'button', class: 'btn', onclick: printPatch }, '🖨️ Print'),
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: reset }, '↺ Reset')),
        h('p', { class: 'center no-print' }, status)),
      controlsSlot));

  paint();
  return () => {
    clearTimeout(saveTimer);
    if (status.textContent === 'Saving…') setPatch(design);
    printCleanup?.();
  };
}
