// Floating name/task labels above astronauts and stations (CSS2DRenderer, inside the container).
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { stripEmoji } from './hud.js';

export function createLabels(container, { onTag } = {}) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'w3d-labels';
  container.appendChild(renderer.domElement);
  const objects = new Set();

  function add(parent, { text = '', y = 2.3, className = '' } = {}) {
    const div = document.createElement('div');
    div.className = `w3d-lab ${className}`;
    div.textContent = stripEmoji(text).trim();
    const obj = new CSS2DObject(div);
    obj.position.set(0, y, 0);
    parent.add(obj);
    objects.add(obj);
    return {
      obj,
      set(t) { const v = stripEmoji(t).trim(); if (div.textContent !== v) div.textContent = v; },
      show(v) { obj.visible = v; },
      remove() { parent.remove(obj); div.remove(); objects.delete(obj); },
    };
  }

  // Crew name tag: a real button (name, role, low-health mark). onTag(id, anchor) gets the tag's centre in viewport px.
  function addTag(parent, { id, y = 2.3 } = {}) {
    const span = (cls, text = '') => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w3d-tag';
    const star = span('w3d-tag-star', '★');
    const name = span('w3d-tag-name');
    const warn = span('w3d-tag-warn', '!');
    const role = span('w3d-tag-role');
    star.setAttribute('aria-hidden', 'true');
    warn.setAttribute('aria-hidden', 'true');
    warn.title = 'Health is low';
    btn.append(span('w3d-tag-top'), role);
    btn.firstChild.append(star, name, warn);
    btn.addEventListener('pointerdown', (e) => e.stopPropagation()); // never starts a camera drag
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = btn.getBoundingClientRect();
      onTag?.(id, { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
    });
    const obj = new CSS2DObject(btn);
    obj.position.set(0, y, 0);
    parent.add(obj);
    objects.add(obj);
    let shown = true;
    let onScreen = true;
    let sig = '';
    const apply = () => { obj.visible = shown && onScreen; };
    return {
      obj,
      set({ first, full, role: roleText, player, low }) {
        const next = `${first}|${full}|${roleText}|${player}|${low}`;
        if (next === sig) return;
        sig = next;
        name.textContent = first;
        role.textContent = roleText;
        btn.dataset.player = String(Boolean(player));
        btn.dataset.low = String(Boolean(low));
        btn.setAttribute('aria-label', `Show ${full}'s stats${low ? ' (health is low)' : ''}`);
      },
      show(v) { shown = v; apply(); },
      // Hidden when off screen or behind the camera; fades as the astronaut gets further away.
      place({ visible, distance }) {
        onScreen = visible;
        apply();
        btn.style.opacity = String(Math.min(1, Math.max(0.5, 1 - (distance - 14) / 70)));
      },
      remove() { parent.remove(obj); btn.remove(); objects.delete(obj); },
    };
  }

  return {
    add,
    addTag,
    render: (scene, camera) => renderer.render(scene, camera),
    setSize: (w, h) => renderer.setSize(w, h),
    dispose() {
      for (const o of objects) { o.parent?.remove(o); o.element.remove(); }
      objects.clear();
      renderer.domElement.remove();
    },
  };
}
