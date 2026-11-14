// Ice drill: hold to drill down, release before the bit overheats.
import { el } from '../hud.js';
import { drillStart, drillStep, drillQuality, DRILL } from '../minigameScoring.js';

export function createDrill({ root, ease, audio, limit, setStatus, finish }) {
  let s = drillStart();
  let drilling = false;
  let time = 0;
  let hum = 0;
  const depthFill = el('div', { class: 'w3d-fill', style: 'width:0%' });
  const heatFill = el('div', { class: 'w3d-heat', style: 'width:0%' });
  const btn = el('button', { class: 'w3d-b w3d-primary', style: 'width:100%;padding:14px;font-size:18px' }, '🧊 Hold to drill');
  root.append(
    el('div', null, 'Depth to ice'), el('div', { class: 'w3d-meter', role: 'meter', 'aria-label': 'Drill depth' }, depthFill),
    el('div', null, '🌡️ Drill heat (let go before it fills!)'), el('div', { class: 'w3d-meter', role: 'meter', 'aria-label': 'Drill heat' }, heatFill),
    btn);
  const down = (e) => { drilling = true; e.preventDefault(); };
  const up = () => { drilling = false; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);

  return {
    tick(dt) {
      time += dt;
      const before = s.overheats;
      s = drillStep(s, { drilling, dt, ease });
      if (s.overheats > before) { audio.sfx.fail(); setStatus('Overheated! The bit jammed. Let it cool.'); drilling = false; }
      else if (s.jamTime <= 0) setStatus(drilling ? 'Drilling…' : s.heat > 0.05 ? 'Cooling down' : 'Ready');
      depthFill.style.width = `${(s.depth / DRILL.target) * 100}%`;
      heatFill.style.width = `${s.heat * 100}%`;
      hum -= dt;
      if (drilling && hum <= 0) { audio.sfx.drill(); hum = 0.1; }
      if (s.depth >= DRILL.target) { audio.sfx.perfect(); finish(drillQuality(s, time, limit)); }
    },
    keydown(e) {
      if (e.code === 'Space' || e.code === 'KeyE') { drilling = true; return true; }
      return false;
    },
    keyup(e) { if (e.code === 'Space' || e.code === 'KeyE') drilling = false; },
    timeout: () => drillQuality(s, time, limit),
    destroy() {
      btn.removeEventListener('pointerdown', down);
      btn.removeEventListener('pointerup', up);
      btn.removeEventListener('pointerleave', up);
    },
  };
}
