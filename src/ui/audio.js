// Generated sound effects (no audio files). Silent unless the Sound setting is on.
import { getState } from '../state/store.js';

let ctx = null;

function audio() {
  if (!getState().settings.sound) return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = ctx ?? new Ctor();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ac, { freq, to = freq, start = 0, dur = 0.15, type = 'sine', gain = 0.08 }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  click: [{ freq: 660, to: 880, dur: 0.06, type: 'triangle', gain: 0.05 }],
  sol: [{ freq: 392, dur: 0.12, type: 'triangle' }, { freq: 523, start: 0.1, dur: 0.18, type: 'triangle' }],
  alert: [{ freq: 880, dur: 0.14, type: 'square', gain: 0.04 }, { freq: 660, start: 0.18, dur: 0.14, type: 'square', gain: 0.04 }, { freq: 880, start: 0.36, dur: 0.14, type: 'square', gain: 0.04 }],
  good: [{ freq: 523, dur: 0.12 }, { freq: 659, start: 0.1, dur: 0.12 }, { freq: 784, start: 0.2, dur: 0.25 }],
  bad: [{ freq: 300, to: 160, dur: 0.4, type: 'sawtooth', gain: 0.04 }],
  win: [{ freq: 523, dur: 0.15 }, { freq: 659, start: 0.15, dur: 0.15 }, { freq: 784, start: 0.3, dur: 0.15 }, { freq: 1047, start: 0.45, dur: 0.5 }],
};

export function play(name) {
  try {
    const ac = audio();
    if (!ac) return;
    for (const t of SOUNDS[name] ?? []) tone(ac, t);
  } catch (err) {
    console.warn('[audio]', err);
  }
}
