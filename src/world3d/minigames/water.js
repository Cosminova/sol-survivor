// Greenhouse: water three plants to the right level, then pick the ripe crops if harvest is ready.
import { el } from '../hud.js';
import { waterBand, waterScore, harvestScore, average } from '../minigameScoring.js';

export function createWater({ root, assist, ease, rng, audio, harvestReady, setStatus, finish }) {
  const plants = 3;
  const scores = [];
  let index = 0;
  let level = 0;
  let pouring = false;
  let band = waterBand(0, ease * (assist ? 1.5 : 1));
  const zone = el('div', { class: 'w3d-zone' });
  const fill = el('div', { class: 'w3d-fill', style: 'width:0%' });
  const label = el('div', { style: 'font-size:28px' });
  const pour = el('button', { class: 'w3d-b w3d-primary', style: 'width:100%;padding:14px;font-size:18px' }, '💧 Hold to pour');
  const stage = el('div', null, label, el('div', { class: 'w3d-meter', role: 'img', 'aria-label': 'Water level' }, zone, fill), pour);
  root.append(stage);

  function showPlant() {
    band = waterBand(index, ease * (assist ? 1.5 : 1));
    zone.style.left = `${band.lo * 100}%`;
    zone.style.width = `${(band.hi - band.lo) * 100}%`;
    level = 0;
    fill.style.width = '0%';
    label.textContent = `Plant ${index + 1} of ${plants}  ${'🌱'.repeat(index + 1)}`;
  }

  function release() {
    if (!pouring) return;
    pouring = false;
    const s = waterScore(level, band);
    scores.push(s);
    setStatus(s === 1 ? 'Just right! ✓' : level > band.hi ? 'Too much water ✗ Roots need air too.' : 'A bit thirsty ✗');
    if (s === 1) audio.sfx.success();
    index += 1;
    if (index < plants) showPlant();
    else if (harvestReady) showHarvest();
    else setTimeout(() => finish(average(scores)), 300);
  }

  function showHarvest() {
    const ripe = [];
    const picked = [];
    const buttons = Array.from({ length: 6 }, (_, i) => {
      const isRipe = rng.next() < 0.55 || (i === 5 && !ripe.length);
      if (isRipe) ripe.push(i);
      const b = el('button', { class: 'w3d-wire', 'aria-label': isRipe ? 'Ripe tomato' : 'Green tomato, not ready' }, isRipe ? '🍅 ripe' : '🟢 green');
      b.addEventListener('click', () => {
        if (picked.includes(i)) return;
        picked.push(i);
        b.dataset.done = 'true';
        audio.sfx.click();
      });
      return b;
    });
    const done = el('button', { class: 'w3d-b w3d-primary' }, 'Done picking');
    done.addEventListener('click', () => finish(average(scores) * (0.6 + 0.4 * harvestScore(picked, ripe))));
    stage.replaceChildren(el('p', null, 'Harvest time! Pick only the ripe red tomatoes.'), el('div', { class: 'w3d-grid', style: 'grid-template-columns:repeat(3,1fr)' }, ...buttons), el('div', { class: 'w3d-row' }, done));
    buttons[0].focus();
  }

  const down = (e) => { pouring = true; e.preventDefault(); };
  pour.addEventListener('pointerdown', down);
  pour.addEventListener('pointerup', release);
  pour.addEventListener('pointerleave', release);
  showPlant();

  let drip = 0;
  return {
    tick(dt) {
      if (!pouring || index >= plants) return;
      level = Math.min(1, level + dt * (0.32 / ease));
      fill.style.width = `${level * 100}%`;
      drip -= dt;
      if (drip <= 0) { audio.sfx.water(); drip = 0.12; }
      if (level >= 1) release();
    },
    keydown(e) {
      if (e.code === 'Space' && index < plants) { if (!e.repeat) pouring = true; return true; }
      return false;
    },
    keyup(e) { if (e.code === 'Space') release(); },
    timeout: () => average([...scores, ...Array(Math.max(0, plants - scores.length)).fill(0.3)]),
    destroy() {
      pour.removeEventListener('pointerdown', down);
      pour.removeEventListener('pointerup', release);
      pour.removeEventListener('pointerleave', release);
    },
  };
}
