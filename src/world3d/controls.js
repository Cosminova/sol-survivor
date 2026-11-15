// Keyboard, mouse-orbit, wheel and touch-joystick input. Mini-games can capture the keyboard.
const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function createControls(container, canvas, { onAction }) {
  const keys = new Set();
  const look = { dx: 0, dy: 0, zoom: 0 };
  const joy = { x: 0, y: 0, active: false };
  let capture = null; // { keydown(e), keyup(e) }
  let enabled = true;

  const inScope = (e) => {
    if (!container.isConnected || isTyping(e.target)) return false;
    const a = document.activeElement;
    return !a || a === document.body || container.contains(a);
  };

  function onKeyDown(e) {
    if (!inScope(e)) return;
    if (capture) {
      if (capture.keydown?.(e) !== false) e.preventDefault();
      return;
    }
    if (e.code === 'Escape') { onAction('pause'); e.preventDefault(); return; }
    if (!enabled) return;
    if (MOVE_KEYS[e.code]) { keys.add(e.code); e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('Shift');
    if (e.repeat) return;
    const onButton = e.target?.tagName === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space');
    if (['KeyE', 'Enter', 'Space', 'NumpadEnter'].includes(e.code) && !onButton) { onAction('interact'); e.preventDefault(); }
    else if (e.code === 'KeyC') onAction('switch', e.shiftKey ? -1 : 1); // Tab is left alone so it can reach name tags and buttons
    else if (e.code === 'KeyP') onAction('pause');
    else if (/^Digit[1-4]$/.test(e.code)) onAction('select', Number(e.code.slice(5)) - 1);
    else if (e.code === 'KeyH') onAction('help');
    else if (e.code === 'KeyM') onAction('mute');
    else if (e.code === 'KeyQ') onAction('why');
  }

  function onKeyUp(e) {
    if (capture) { capture.keyup?.(e); return; }
    keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.delete('Shift');
    if (['KeyE', 'Enter', 'Space', 'NumpadEnter'].includes(e.code)) onAction('interactUp');
  }

  const onBlur = () => keys.clear();

  let drag = null;
  function onPointerDown(e) {
    canvas.focus({ preventScroll: true });
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag || drag.id !== e.pointerId) return;
    look.dx += e.clientX - drag.x;
    look.dy += e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function onPointerUp(e) {
    if (drag?.id === e.pointerId) drag = null;
  }
  const onWheel = (e) => { e.preventDefault(); look.zoom += Math.sign(e.deltaY); };
  const onContext = (e) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContext);

  // Touch joystick: the HUD supplies the base element.
  let joyCleanup = null;
  function attachJoystick(base, knob) {
    let id = null;
    const set = (e) => {
      const r = base.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      joy.x = x; joy.y = -y; joy.active = true;
      knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
    };
    const down = (e) => { id = e.pointerId; base.setPointerCapture?.(id); set(e); e.preventDefault(); };
    const move = (e) => { if (e.pointerId === id) set(e); };
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null; joy.x = 0; joy.y = 0; joy.active = false;
      knob.style.transform = '';
    };
    base.addEventListener('pointerdown', down);
    base.addEventListener('pointermove', move);
    base.addEventListener('pointerup', up);
    base.addEventListener('pointercancel', up);
    joyCleanup = () => {
      base.removeEventListener('pointerdown', down);
      base.removeEventListener('pointermove', move);
      base.removeEventListener('pointerup', up);
      base.removeEventListener('pointercancel', up);
    };
  }

  function read() {
    // Focus somewhere else on the page (a stats popup, a dictionary card): let go of any held walking keys.
    const a = document.activeElement;
    if (keys.size && a && a !== document.body && !container.contains(a)) keys.clear();
    let x = joy.x;
    let y = joy.y;
    if (enabled && !capture) {
      for (const k of keys) {
        const v = MOVE_KEYS[k];
        if (v) { x += v[0]; y += v[1]; }
      }
    } else {
      x = 0; y = 0;
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    const out = { x, y, run: keys.has('Shift') || Math.hypot(joy.x, joy.y) > 0.92, look: { ...look } };
    look.dx = 0; look.dy = 0; look.zoom = 0;
    return out;
  }

  return {
    read,
    attachJoystick,
    release() { keys.clear(); drag = null; },
    setCapture(handler) { capture = handler; keys.clear(); },
    setEnabled(v) { enabled = v; if (!v) keys.clear(); },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
      joyCleanup?.();
    },
  };
}
