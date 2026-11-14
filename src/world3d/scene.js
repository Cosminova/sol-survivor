// Renderer, camera, lights and fog. Handles quality tiers, resize and WebGL context loss.
import * as THREE from 'three';

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

const WEAK_GPU = /swiftshader|llvmpipe|mali-[gt]?[4-7]|adreno \(tm\) [3-5]|intel\(r\) (hd|uhd) graphics [2-6]|powervr/i;

export function detectQuality(container) {
  const small = Math.min(container.clientWidth || innerWidth, container.clientHeight || innerHeight) < 560;
  const cores = navigator.hardwareConcurrency ?? 4;
  let weak = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    weak = WEAK_GPU.test(name);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    weak = false;
  }
  return small || weak || cores <= 2 ? 'low' : 'high';
}

export function createStage(container, { quality }) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'w3d-canvas';
  renderer.domElement.setAttribute('aria-label', '3D outpost view');
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.15, 45000); // far enough for the 30 km lidar horizon
  camera.position.set(0, 4, 14);

  const sun = new THREE.DirectionalLight('#fff4e6', 3);
  sun.castShadow = high;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#ffd9b8', '#4a2a1a', 0.6);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight('#9fb8ff', 0); // earthshine / sky bounce
  scene.add(fill);

  scene.fog = new THREE.FogExp2('#c99a72', 0.004);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = null;

  // Bakes the given sky-only scene into an environment map for reflections (visors, panels).
  function bakeEnvironment(skyScene) {
    const next = pmrem.fromScene(skyScene, 0.04, 0.1, 2200);
    scene.environment = next.texture;
    envTarget?.dispose();
    envTarget = next;
  }

  function setSize(w, h) {
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Keeps the shadow frustum centred on the player so shadows stay crisp near the action.
  function aimSun(dir, focus) {
    sun.position.set(focus.x + dir.x * 120, focus.y + Math.max(dir.y, 0.05) * 120, focus.z + dir.z * 120);
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
  }

  let lost = false;
  const onLost = (e) => { e.preventDefault(); lost = true; };
  const onRestored = () => { lost = false; };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);

  return {
    renderer, scene, camera, sun, hemi, fill, high,
    bakeEnvironment, setSize, aimSun,
    isLost: () => lost,
    dispose() {
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      envTarget?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
