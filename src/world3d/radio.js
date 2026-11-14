// CAPCOM radio: queued subtitle lines with an optional read-aloud voice (speechSynthesis).
export function createRadio(el, { readAloud = false, onChirp } = {}) {
  const queue = [];
  let current = null;
  let timer = 0;
  let speaking = false;

  function speak(text) {
    if (!readAloud || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/^CAPCOM:\s*/, ''));
      u.rate = 1.05;
      u.pitch = 0.95;
      speaking = true;
      u.onend = () => { speaking = false; };
      window.speechSynthesis.speak(u);
    } catch {
      speaking = false;
    }
  }

  function show(line) {
    current = line;
    timer = Math.max(3.5, line.text.length * 0.065);
    el.textContent = line.text;
    el.dataset.tone = line.tone ?? 'info';
    el.classList.add('w3d-on');
    onChirp?.();
    speak(line.text);
  }

  function say(text, { tone = 'info', priority = false } = {}) {
    if (!text) return;
    if (current?.text === text || queue.some((q) => q.text === text)) return;
    const line = { text, tone };
    if (priority) {
      queue.unshift(line);
      if (current && current.tone !== 'alert') timer = 0;
    } else {
      queue.push(line);
    }
    if (queue.length > 4) queue.splice(4);
  }

  function update(dt) {
    if (current) {
      timer -= dt;
      if (timer <= 0 && !speaking) {
        current = null;
        el.classList.remove('w3d-on');
      }
    }
    if (!current && queue.length) show(queue.shift());
  }

  return {
    say,
    update,
    setReadAloud(v) { readAloud = v; },
    dispose() {
      queue.length = 0;
      if (readAloud && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
  };
}
