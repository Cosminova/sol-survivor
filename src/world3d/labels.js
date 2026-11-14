// Floating name/task labels above astronauts and stations (CSS2DRenderer, inside the container).
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function createLabels(container) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'w3d-labels';
  container.appendChild(renderer.domElement);
  const objects = new Set();

  function add(parent, { text = '', y = 2.3, className = '' } = {}) {
    const div = document.createElement('div');
    div.className = `w3d-lab ${className}`;
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.set(0, y, 0);
    parent.add(obj);
    objects.add(obj);
    return {
      obj,
      set(t) { if (div.textContent !== t) div.textContent = t; },
      show(v) { obj.visible = v; },
      remove() { parent.remove(obj); div.remove(); objects.delete(obj); },
    };
  }

  return {
    add,
    render: (scene, camera) => renderer.render(scene, camera),
    setSize: (w, h) => renderer.setSize(w, h),
    dispose() {
      for (const o of objects) { o.parent?.remove(o); o.element.remove(); }
      objects.clear();
      renderer.domElement.remove();
    },
  };
}
