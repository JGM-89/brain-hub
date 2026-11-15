// Shared "cinematic" look for every 3D scene on the site: image-based lighting, a soft studio
// rig, ambient occlusion, gentle bloom on glowing parts, filmic tone mapping and MSAA.
// Calm mode / reduced motion switches bloom off. Low-power devices drop ambient occlusion.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { get } from '../settings.js';

const envCache = new WeakMap();
function environmentFor(renderer) {
  if (!envCache.has(renderer)) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envCache.set(renderer, pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
  }
  return envCache.get(renderer);
}

// Navy studio backdrop (a soft radial gradient), so post-processing never has to deal with alpha.
export function stageBackground(top = '#1d2a49', bottom = '#070b16') {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function lowPower() {
  return (navigator.hardwareConcurrency || 4) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{post?: boolean, background?: boolean, envIntensity?: number, bloom?: number}} opts
 */
export function createLook(renderer, scene, camera, opts = {}) {
  const o = { post: true, background: true, envIntensity: 0.3, bloom: 0.45, ...opts };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  scene.environment = environmentFor(renderer);
  scene.environmentIntensity = o.envIntensity;
  if (o.background) scene.background = stageBackground();

  if (!o.post) {
    return { render: () => renderer.render(scene, camera), setSize() {}, setCamera(c) { camera = c; }, setAO() {}, dispose() {} };
  }

  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x || 1, size.y || 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  let gtao = null;
  if (!lowPower()) {
    gtao = new GTAOPass(scene, camera, size.x || 1, size.y || 1);
    gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 3, scale: 1.1, samples: 12 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), o.bloom, 0.5, 0.97);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let aoWanted = true;

  return {
    composer,
    render() {
      const calm = get('calm') === 'true';
      bloom.enabled = !calm && o.bloom > 0;
      if (gtao) gtao.enabled = aoWanted;
      composer.render();
    },
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    setCamera(c) { camera = c; renderPass.camera = c; if (gtao) gtao.camera = c; },
    // AO reads depth from everything, so switch it off while parts are see-through
    setAO(on) { aoWanted = on; },
    dispose() { composer.dispose(); target.dispose(); },
  };
}

// Soft studio light rig shared by every scene (key, rim, fill). Returns the group.
export function studioLights(scale = 1) {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight('#fff4ea', 2.0); key.position.set(2, 3, 2.5).multiplyScalar(100 * scale);
  const rim = new THREE.DirectionalLight('#9ab8ff', 1.6); rim.position.set(-2.5, 1, -3).multiplyScalar(100 * scale);
  const fill = new THREE.DirectionalLight('#ffd6c4', 0.45); fill.position.set(-2, -1.5, 2).multiplyScalar(100 * scale);
  g.add(key, rim, fill, new THREE.HemisphereLight('#dfe8ff', '#2a2235', 0.5));
  return g;
}

// Wet-tissue material: physical shading with a soft sheen at grazing angles (reads as living tissue).
export function tissueMaterial(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.4,
    sheen: 0.22, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffe2dc'), ...extra,
  });
}
