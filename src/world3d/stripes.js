// NASA EVA suit identification stripes on the thighs. On ISS EVAs the lead wears solid red stripes,
// others broken red, diagonal red ("barber pole") or plain white suits. We map crew roles onto that.
import * as THREE from 'three';
import { mat } from './meshes/kit.js';

export const STRIPE_RED = '#c8102e';

export const ROLE_STRIPES = {
  commander: 'solid',
  engineer: 'broken',
  botanist: 'diagonal',
  geologist: 'none',
};

export const STRIPE_LABEL = { solid: 'solid red stripes', broken: 'broken red stripes', diagonal: 'diagonal red stripes', none: 'all-white suit' };

// Adds stripe bands around a leg segment centred on (0, y, 0) with the given radius.
export function addStripes(group, role, { radius, y, height = 0.12 }) {
  const style = ROLE_STRIPES[role] ?? 'none';
  if (style === 'none') return style;
  const red = mat('stripe-red', { color: STRIPE_RED, roughness: 0.6, side: THREE.DoubleSide });
  if (style === 'solid') {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), red).translateY(y));
  } else if (style === 'broken') {
    for (let i = 0; i < 4; i += 1) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 6, 1, true, (i / 4) * Math.PI * 2, Math.PI / 3), red);
      seg.position.y = y;
      group.add(seg);
    }
  } else {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height * 0.7, 16, 1, true), red);
    band.position.y = y;
    band.rotation.x = 0.45;
    group.add(band);
  }
  return style;
}
