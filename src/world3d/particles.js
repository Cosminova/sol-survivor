// Ambient and feedback particles: drifting dust motes, fading footprints and spark/dust bursts.
import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createParticles({ body, high, reducedMotion }) {
  const group = new THREE.Group();
  const dot = softDot();
  const moteCount = body === 'mars' ? (high ? (reducedMotion ? 120 : 420) : 0) : 0;

  // Dust motes live in a box around the camera and wrap as it moves.
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) motePos.set([Math.random() * 60 - 30, Math.random() * 12, Math.random() * 60 - 30], i * 3);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ map: dot, color: '#e8b98d', size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.visible = moteCount > 0;
  group.add(motes);

  // Footprints: multiply-blended ovals that brighten back to white (no effect) as they fade.
  const prints = 90;
  const printMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const printGeo = new THREE.CircleGeometry(0.11, 10);
  printGeo.scale(1, 1.7, 1);
  printGeo.rotateX(-Math.PI / 2);
  const footprints = new THREE.InstancedMesh(printGeo, printMat, prints);
  footprints.frustumCulled = false;
  const printAge = new Float32Array(prints).fill(999);
  const white = new THREE.Color(1, 1, 1);
  const tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < prints; i += 1) {
    footprints.setMatrixAt(i, m4.makeScale(0, 0, 0));
    footprints.setColorAt(i, white);
  }
  group.add(footprints);
  let printIdx = 0;
  const printDark = new THREE.Color(body === 'moon' ? 0.55 : 0.62, body === 'moon' ? 0.55 : 0.5, body === 'moon' ? 0.55 : 0.45);

  function footprint(x, y, z, heading, side) {
    const ox = Math.cos(heading) * 0.13 * side;
    const oz = -Math.sin(heading) * 0.13 * side;
    q.setFromAxisAngle(up, heading);
    m4.compose(new THREE.Vector3(x + ox, y + 0.02, z + oz), q, new THREE.Vector3(1, 1, 1));
    footprints.setMatrixAt(printIdx, m4);
    footprints.setColorAt(printIdx, printDark);
    printAge[printIdx] = 0;
    printIdx = (printIdx + 1) % prints;
    footprints.instanceMatrix.needsUpdate = true;
    footprints.instanceColor.needsUpdate = true;
  }

  // Bursts: pooled points with velocity and life.
  const maxBurst = high ? 500 : 160;
  const bPos = new Float32Array(maxBurst * 3);
  const bCol = new Float32Array(maxBurst * 3);
  const bVel = new Float32Array(maxBurst * 3);
  const bLife = new Float32Array(maxBurst);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const bMat = new THREE.PointsMaterial({ map: dot, size: 0.25, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bursts = new THREE.Points(bGeo, bMat);
  bursts.frustumCulled = false;
  group.add(bursts);
  const dustMat = new THREE.PointsMaterial({ map: dot, size: 0.9, color: body === 'moon' ? '#b9b5ad' : '#c58c5c', transparent: true, opacity: 0.6, depthWrite: false });
  const dPos = new Float32Array(maxBurst * 3);
  const dVel = new Float32Array(maxBurst * 3);
  const dLife = new Float32Array(maxBurst);
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);
  for (let i = 0; i < maxBurst; i += 1) { bPos[i * 3 + 1] = -999; dPos[i * 3 + 1] = -999; }
  let bIdx = 0;
  let dIdx = 0;
  const g = body === 'moon' ? 1.62 : 3.71;

  function burst(at, { count = 30, color = '#ffd36b', speed = 4, up: upBias = 2 } = {}) {
    const n = Math.min(count, reducedMotion ? Math.ceil(count / 3) : count);
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k += 1) {
      const i = bIdx;
      bIdx = (bIdx + 1) % maxBurst;
      bPos.set([at.x, at.y, at.z], i * 3);
      bVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.5 + upBias, (Math.random() - 0.5) * speed], i * 3);
      bCol.set([c.r, c.g, c.b], i * 3);
      bLife[i] = 0.6 + Math.random() * 0.6;
    }
  }

  function dustCloud(at, { count = 40, speed = 3, radius = 1 } = {}) {
    const n = Math.min(count, reducedMotion ? Math.ceil(count / 3) : count);
    for (let k = 0; k < n; k += 1) {
      const i = dIdx;
      dIdx = (dIdx + 1) % maxBurst;
      const a = Math.random() * Math.PI * 2;
      dPos.set([at.x + Math.cos(a) * radius, at.y + 0.1, at.z + Math.sin(a) * radius], i * 3);
      dVel.set([Math.cos(a) * speed * (0.5 + Math.random()), Math.random() * speed * 0.3, Math.sin(a) * speed * (0.5 + Math.random())], i * 3);
      dLife[i] = 1.5 + Math.random() * 1.5;
    }
  }

  function update(dt, { camera, wind = { x: 0.6, z: 0.2 } }) {
    if (motes.visible) {
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (let i = 0; i < moteCount; i += 1) {
        let x = motePos[i * 3] + wind.x * dt * 2;
        let y = motePos[i * 3 + 1] + Math.sin((i + performance.now() * 0.0005) * 1.3) * dt * 0.2;
        let z = motePos[i * 3 + 2] + wind.z * dt * 2;
        if (x - cx > 30) x -= 60; else if (x - cx < -30) x += 60;
        if (z - cz > 30) z -= 60; else if (z - cz < -30) z += 60;
        if (y > 12) y = 0; else if (y < 0) y = 12;
        motePos.set([x, y, z], i * 3);
      }
      moteGeo.attributes.position.needsUpdate = true;
    }
    for (let i = 0; i < prints; i += 1) {
      if (printAge[i] > 40) continue;
      printAge[i] += dt;
      tmpC.copy(printDark).lerp(white, Math.min(1, printAge[i] / 40));
      footprints.setColorAt(i, tmpC);
    }
    footprints.instanceColor.needsUpdate = true;
    for (let i = 0; i < maxBurst; i += 1) {
      if (bLife[i] > 0) {
        bLife[i] -= dt;
        bVel[i * 3 + 1] -= g * dt;
        bPos[i * 3] += bVel[i * 3] * dt;
        bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
        bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
        if (bLife[i] <= 0) bPos[i * 3 + 1] = -999;
      }
      if (dLife[i] > 0) {
        dLife[i] -= dt;
        const drag = body === 'moon' ? 1 : 0.97; // no air on the Moon: dust flies in clean arcs
        dVel[i * 3] *= drag; dVel[i * 3 + 2] *= drag;
        dVel[i * 3 + 1] -= (body === 'moon' ? g : g * 0.15) * dt;
        dPos[i * 3] += dVel[i * 3] * dt;
        dPos[i * 3 + 1] = Math.max(0, dPos[i * 3 + 1] + dVel[i * 3 + 1] * dt);
        dPos[i * 3 + 2] += dVel[i * 3 + 2] * dt;
        if (dLife[i] <= 0) dPos[i * 3 + 1] = -999;
      }
    }
    bGeo.attributes.position.needsUpdate = true;
    bGeo.attributes.color.needsUpdate = true;
    dGeo.attributes.position.needsUpdate = true;
  }

  function setMoteDensity(k) {
    moteMat.opacity = Math.min(0.9, 0.35 + k * 0.5);
    moteMat.size = 0.1 + k * 0.12;
  }

  return {
    group, footprint, burst, dustCloud, update, setMoteDensity,
    dispose() {
      [moteGeo, printGeo, bGeo, dGeo].forEach((x) => x.dispose());
      [moteMat, printMat, bMat, dustMat].forEach((x) => x.dispose());
      footprints.dispose();
      dot.dispose();
    },
  };
}
