// Synthesized WebAudio sound effects (no audio files, works offline). Default volume is low.
// Every cue has a caption so deaf and hard-of-hearing players get the same information.
export const CAPTIONS = {
  alarm: '[suit alarm beeping]',
  heartbeat: '[heartbeat]',
  radio: '[radio chirp]',
  impact: '[impact boom]',
  siren: '[storm siren]',
  levelUp: '[fanfare]',
  wind: '[wind gusting]',
};

export function createAudio({ muted = false, volume = 0.18 } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let isMuted = muted;
  let breath = null;

  function ensure() {
    if (ctx) return ctx.state === 'suspended' ? (ctx.resume(), ctx) : ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted ? 0 : volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.5, at = 0, slide = 0 } = {}) {
    const c = ensure();
    if (!c || isMuted) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, { freq = 800, q = 1, gain = 0.4, at = 0, type = 'bandpass' } = {}) {
    const c = ensure();
    if (!c || isMuted) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const sfx = {
    step: (moon) => noise(0.09, { freq: moon ? 500 : 900, q: 0.8, gain: 0.18 }),
    radio: () => { tone(1400, 0.05, { type: 'square', gain: 0.12 }); tone(1900, 0.06, { type: 'square', gain: 0.12, at: 0.07 }); noise(0.18, { freq: 2500, q: 0.5, gain: 0.05, at: 0.02 }); },
    alarm: () => { tone(880, 0.12, { type: 'square', gain: 0.15 }); tone(880, 0.12, { type: 'square', gain: 0.15, at: 0.2 }); },
    heartbeat: () => { tone(60, 0.12, { gain: 0.6 }); tone(55, 0.14, { gain: 0.45, at: 0.18 }); },
    success: () => [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.3, at: i * 0.08 })),
    perfect: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.32, at: i * 0.07 })),
    fail: () => tone(220, 0.3, { type: 'sawtooth', gain: 0.15, slide: 0.6 }),
    click: () => tone(1200, 0.03, { type: 'square', gain: 0.08 }),
    tick: () => tone(1700, 0.025, { gain: 0.1 }),
    pickup: () => [880, 1320, 1760].forEach((f, i) => tone(f, 0.12, { type: 'sine', gain: 0.25, at: i * 0.05 })),
    xp: () => tone(1320, 0.08, { type: 'sine', gain: 0.15, slide: 1.5 }),
    levelUp: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.3, at: i * 0.11 })),
    impact: () => { noise(0.6, { freq: 200, q: 0.5, gain: 0.7, type: 'lowpass' }); tone(70, 0.5, { gain: 0.5, slide: 0.4 }); },
    whoosh: () => noise(0.8, { freq: 600, q: 0.6, gain: 0.25 }),
    siren: () => { for (let i = 0; i < 3; i += 1) tone(600, 0.35, { type: 'sawtooth', gain: 0.1, at: i * 0.4, slide: 1.6 }); },
    scoop: () => noise(0.18, { freq: 400, q: 1.5, gain: 0.3 }),
    drill: () => tone(110, 0.12, { type: 'sawtooth', gain: 0.08 }),
    water: () => noise(0.12, { freq: 3000, q: 2, gain: 0.08 }),
    spark: () => noise(0.07, { freq: 5000, q: 3, gain: 0.12 }),
    engine: () => noise(2.5, { freq: 160, q: 0.4, gain: 0.5, type: 'lowpass' }),
  };

  // Soft looping suit breathing while on EVA.
  function setBreathing(on, rate = 1) {
    const c = ctx;
    if (!c || isMuted) {
      if (breath) { clearInterval(breath); breath = null; }
      return;
    }
    if (on && !breath) {
      const period = 3200 / rate;
      noise(1.2, { freq: 700, q: 0.4, gain: 0.04 });
      breath = setInterval(() => noise(1.2, { freq: 700, q: 0.4, gain: 0.04 }), period);
    } else if (!on && breath) {
      clearInterval(breath);
      breath = null;
    }
  }

  return {
    sfx,
    unlock: ensure,
    setBreathing,
    get muted() { return isMuted; },
    setMuted(v) {
      isMuted = v;
      if (master) master.gain.value = v ? 0 : volume;
      if (v) setBreathing(false);
    },
    dispose() {
      setBreathing(false);
      ctx?.close?.();
      ctx = null;
    },
  };
}
