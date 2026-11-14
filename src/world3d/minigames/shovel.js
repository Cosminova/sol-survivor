// Regolith shovel timing meter: hit the green zone to scoop a full load onto the berm.
import { el } from '../hud.js';
import { needlePos, shovelZone, shovelHit, average } from '../minigameScoring.js';

export function createShovel({ root, assist, ease, audio, setStatus, finish }) {
  const scoops = assist ? 3 : 4;
  const zone = shovelZone(ease, assist);
  const zoneEl = el('div', { class: 'w3d-zone', style: `left:${(zone.centre - zone.half) * 100}%;width:${zone.half * 200}%` });
  const needle = el('div', { class: 'w3d-needle' });
  const pile = el('div', { style: 'font-size:28px;letter-spacing:4px;min-height:36px', 'aria-label': 'Scoops' });
  const btn = el('button', { class: 'w3d-b w3d-primary', style: 'width:100%;padding:14px;font-size:18px' }, '⛏️ Scoop!');
  root.append(el('div', { class: 'w3d-meter', role: 'img', 'aria-label': 'Timing meter' }, zoneEl, needle), pile, btn);
  const results = [];
  let t = 0;
  let speed = 0.75 / ease;
  let cooldown = 0;

  function hit() {
    if (cooldown > 0 || results.length >= scoops) return;
    const pos = needlePos(t, speed);
    const s = shovelHit(pos, zone);
    results.push(s);
    cooldown = 0.25;
    audio.sfx.scoop();
    if (s === 1) audio.sfx.success();
    setStatus(s === 1 ? 'Perfect scoop! ✓✓' : s > 0 ? 'Good scoop ✓' : 'Missed! ✗ Wait for the green zone.');
    pile.textContent = results.map((r) => (r === 1 ? '🟫' : r > 0 ? '🟤' : '▫️')).join('');
    speed *= 1.12;
    if (results.length >= scoops) setTimeout(() => finish(average(results)), 350);
  }
  btn.addEventListener('click', hit);

  return {
    tick(dt) {
      t += dt;
      cooldown -= dt;
      needle.style.left = `${needlePos(t, speed) * 100}%`;
    },
    keydown(e) {
      if (['Space', 'KeyE', 'Enter'].includes(e.code)) { if (!e.repeat) hit(); return true; }
      return false;
    },
    timeout: () => average([...results, ...Array(scoops - results.length).fill(0)]),
    destroy() { btn.removeEventListener('click', hit); },
  };
}
