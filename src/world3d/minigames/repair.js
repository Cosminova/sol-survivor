// Wire repair: connect each wire to its match. Colors AND shapes, so it is colorblind-safe.
import { el } from '../hud.js';
import { makeWirePuzzle, wireQuality, WIRE_SYMBOLS } from '../minigameScoring.js';

const sym = (id) => WIRE_SYMBOLS.find((w) => w.id === id);

export function createRepair({ root, assist, rng, audio, limit, setStatus, finish }) {
  const n = assist ? 3 : 4;
  const { left, right } = makeWirePuzzle(rng, n);
  const done = new Set();
  let selected = null;
  let mistakes = 0;
  let time = 0;

  const btn = (id, side) => {
    const s = sym(id);
    const b = el('button', { class: 'w3d-wire', style: `color:${s.color}`, 'aria-pressed': 'false', 'aria-label': `${side} ${s.id} ${s.shape}` }, `${s.shape} ${s.id}`);
    b.dataset.id = id;
    return b;
  };
  const leftBtns = left.map((id) => btn(id, 'Left'));
  const rightBtns = right.map((id) => btn(id, 'Right'));

  leftBtns.forEach((b) => b.addEventListener('click', () => {
    if (done.has(b.dataset.id)) return;
    leftBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    selected = b.dataset.id;
    audio.sfx.click();
    setStatus(`Now pick the matching ${sym(selected).shape} on the right.`);
    rightBtns.find((x) => !done.has(x.dataset.id))?.focus();
  }));
  rightBtns.forEach((b) => b.addEventListener('click', () => {
    if (!selected || done.has(b.dataset.id)) return;
    if (b.dataset.id === selected) {
      done.add(selected);
      [...leftBtns, ...rightBtns].filter((x) => x.dataset.id === selected).forEach((x) => { x.dataset.done = 'true'; x.setAttribute('aria-pressed', 'false'); });
      audio.sfx.success();
      setStatus('Connected! ⚡');
      selected = null;
      if (done.size === n) setTimeout(() => finish(wireQuality(mistakes, time, limit)), 300);
      else leftBtns.find((x) => !done.has(x.dataset.id))?.focus();
    } else {
      mistakes += 1;
      audio.sfx.spark();
      setStatus('Bzzt! Wrong wire. Match the shape and color.');
    }
  }));

  root.append(el('div', { class: 'w3d-grid', style: 'grid-template-columns:1fr 60px 1fr;align-items:center' },
    el('div', { class: 'w3d-grid' }, ...leftBtns),
    el('div', { style: 'text-align:center;font-size:28px' }, '⚡'),
    el('div', { class: 'w3d-grid' }, ...rightBtns)));
  requestAnimationFrame(() => leftBtns[0].focus());

  return {
    tick(dt) { time += dt; },
    keydown: () => false,
    timeout: () => wireQuality(mistakes + (n - done.size) * 2, time, limit),
    destroy() {},
  };
}
