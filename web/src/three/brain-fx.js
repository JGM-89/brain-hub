// Extra visual effects for the shared BrainViewer, without modifying viewer.js:
//   - activation / lesion / highlight layers painted on the real cortex (share the cortex geometry)
//   - a clipping-plane "slice" with solid cut faces (caps), optionally with a heat blob in the cut
//   - splitting a deep structure (e.g. hippocampus) into front/back parts along its long axis
//   - camera and styling helpers
// All positions are in viewer.model space (glTF, mm: +X = subject's left, +Y up, +Z forward).
import * as THREE from 'three';
import { tissueMaterial } from './look.js';

/** MNI/RAS (x right, y anterior, z superior) -> glTF model space. */
export const fromRAS = (x, y, z) => new THREE.Vector3(-x, z, y);

/** Stop the lesson's brain reacting to clicks (picking changes the viewer's selection state). */
export function quietPicking(viewer) {
  viewer._pick = () => {};
  viewer._hover = () => { viewer.renderer.domElement.style.cursor = 'grab'; };
}

/** Pause / resume a BrainViewer's render loop (e.g. while it is hidden). */
export function setViewerRunning(viewer, on) {
  if (viewer._bxRunning === on) return;
  viewer._bxRunning = on;
  viewer.renderer.setAnimationLoop(on ? () => viewer._tick() : null);
  if (on) viewer.clock.getDelta();
}

/** model space -> world space */
export function toWorld(viewer, p) { return p.clone().applyMatrix4(viewer.model.matrixWorld); }

/** Fly the camera to look at a model-space point from a direction (world-space direction vector). */
export function flyTo(viewer, targetModel, dir, dist = 420, instant = false) {
  viewer.model.updateMatrixWorld(true);
  const t = toWorld(viewer, targetModel);
  let d = dist;
  // use the container's current size (the camera aspect may not have caught up with a layout change yet)
  const el = viewer.container;
  const W = el.clientWidth, H = el.clientHeight;
  const free = viewer._bxFree?.() || null;          // part of the stage not covered by a panel
  const fw = free ? free.w : W, fh = free ? free.h : H;
  const aspect = fw > 2 && fh > 2 ? fw / fh : viewer.camera.aspect;
  if (aspect < 1) d /= Math.pow(aspect, 0.95);
  if (free && H > 2 && fh < H) d *= Math.max(1, (H / fh) * 0.82);
  viewer._flyTo(t, new THREE.Vector3(...dir).normalize().multiplyScalar(d), instant);
}

/**
 * Keep the 3D subject centred in the part of the stage that is not covered by an overlay panel,
 * by shifting the camera's view window (setViewOffset) instead of shrinking the canvas.
 * freeRect() -> {x, y, w, h} in container pixels, or null for the whole stage.
 */
export function installViewShift(viewer, freeRect, baseFov = 32) {
  viewer._bxFree = freeRect;
  viewer.on('frame', () => {
    const cam = viewer.camera;
    const w = viewer.container.clientWidth || 1, h = viewer.container.clientHeight || 1;
    const f = freeRect();
    const cx = f ? f.x + f.w / 2 - w / 2 : 0, cy = f ? f.y + f.h / 2 - h / 2 : 0;
    if (Math.abs(cx) < 1 && Math.abs(cy) < 1) {
      if (cam.view?.enabled || cam.fov !== baseFov || Math.abs(cam.aspect - w / h) > 1e-4) { cam.clearViewOffset(); cam.fov = baseFov; cam.aspect = w / h; cam.updateProjectionMatrix(); }
      return;
    }
    const fullW = w + 2 * Math.abs(cx), fullH = h + 2 * Math.abs(cy);
    const offX = cx < 0 ? -2 * cx : 0, offY = cy < 0 ? -2 * cy : 0;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * fullH / h));
    cam.aspect = fullW / fullH;
    cam.setViewOffset(fullW, fullH, offX, offY, w, h);
  });
}

/** Nearest cortex vertex (model space) of a functional region to p. */
export function snapToRegion(viewer, p, regionId, hemi) {
  let best = null, bd = Infinity;
  const v = new THREE.Vector3();
  for (const o of Object.values(viewer.meshes)) {
    if (!o.name.startsWith(`cortex_${hemi}`)) continue;
    o.updateMatrix();
    const col = o.geometry.attributes.color, pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (regionId && Math.round(col.getY(i) * 255) !== regionId) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix);
      const d = v.distanceToSquared(p);
      if (d < bd) { bd = d; best = v.clone(); }
    }
  }
  return best || p.clone();
}

/**
 * Mirror a functional region from the left hemisphere onto the right one (the homologous area):
 * every right-hemisphere vertex whose mirror image (x -> -x) lies on the left region gets aMask = 1
 * (soft edge to 0 over a few mm). Writes an 'aMask' attribute on the right cortex geometries.
 * Returns the centre (model space) of the masked right-hemisphere vertices.
 */
export function mirrorRegionMask(viewer, regionId) {
  const v = new THREE.Vector3();
  const src = [];
  for (const o of Object.values(viewer.meshes)) {
    if (!o.name.startsWith('cortex_left')) continue;
    o.updateMatrix();
    const col = o.geometry.attributes.color, pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (Math.round(col.getY(i) * 255) === regionId) src.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix).clone());
  }
  const box = new THREE.Box3().setFromPoints(src).expandByScalar(8);
  const centre = new THREE.Vector3(); let n = 0;
  for (const o of Object.values(viewer.meshes)) {
    if (!o.name.startsWith('cortex_right')) continue;
    o.updateMatrix();
    const pos = o.geometry.attributes.position;
    const mask = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix);
      const m = new THREE.Vector3(-v.x, v.y, v.z);
      if (!box.containsPoint(m)) continue;
      let best = Infinity;
      for (const q of src) { const d = q.distanceToSquared(m); if (d < best) best = d; }
      const d = Math.sqrt(best);
      mask[i] = d < 3 ? 1 : d < 7 ? 1 - (d - 3) / 4 : 0;
      if (mask[i] > 0.5) { centre.add(v); n++; }
    }
    o.geometry.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
  }
  return n ? centre.divideScalar(n) : null;
}

/** Centroid (model space) of a region on one hemisphere. */
export function regionCentre(viewer, regionId, hemi) {
  const w = viewer.regionCentreHemi(regionId, hemi);
  return w ? w.applyMatrix4(viewer.model.matrixWorld.clone().invert()) : null;
}

// ------------------------------------------------------------------ cortex layers
const MAXS = 8;
const LAYER_VS = /* glsl */`
#include <common>
#include <clipping_planes_pars_vertex>
attribute vec4 color;
attribute float aMask;
uniform float uMaskW;
uniform mat4 uToModel;
uniform vec4 uSeeds[${MAXS}];
uniform float uW[${MAXS}];
uniform int uN;
uniform float uRegion, uRegionAdd, uRegionMul;
varying float vAct; varying vec3 vModel; varying float vShade; varying vec3 vN;
void main() {
  vec3 p = (uToModel * vec4(position, 1.0)).xyz;
  vModel = p;
  float a = 0.0;
  for (int i = 0; i < ${MAXS}; i++) {
    if (i >= uN) break;
    vec3 d = p - uSeeds[i].xyz;
    a += uW[i] * exp(-dot(d, d) / (2.0 * uSeeds[i].w * uSeeds[i].w));
  }
  float rid = floor(color.g * 255.0 + 0.5);
  float inR = (uRegion > 0.5 && abs(rid - uRegion) < 0.5) ? 1.0 : 0.0;
  a = a * mix(1.0, inR, uRegionMul) + inR * uRegionAdd + aMask * uMaskW;
  vAct = a; vShade = color.r;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const LAYER_FS = /* glsl */`
#include <common>
#include <clipping_planes_pars_fragment>
uniform float uLevel, uThresh, uOpacity, uTime, uSoft;
uniform int uStyle;
uniform vec3 uColA, uColB, uColC;
varying float vAct; varying vec3 vModel; varying float vShade; varying vec3 vN;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  #include <clipping_planes_fragment>
  float a = vAct * uLevel;
  if (uStyle == 1) a *= 0.75 + 0.5 * vnoise(vModel * 0.45);
  if (uStyle == 0) a *= 0.78 + 0.44 * vnoise(vModel * 0.22 + 3.7);   // fMRI clusters are patchy, not perfect circles
  if (a < uThresh) discard;
  float t = clamp((a - uThresh) / max(1e-3, 1.0 - uThresh), 0.0, 1.0);
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float lam = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.35, 0.55, 0.75))), 0.0);
  vec3 col; float alpha;
  float edge = mix(smoothstep(0.0, 0.12, t), t * t * 0.9, uSoft);
  if (uStyle == 0) {          // BOLD heat map: red -> orange -> yellow
    col = t < 0.55 ? mix(uColA, uColB, t / 0.55) : mix(uColB, uColC, (t - 0.55) / 0.45);
    col *= (0.78 + 0.4 * vShade);
    alpha = edge * uOpacity;
  } else if (uStyle == 1) {   // lesion: dark, mottled, damaged tissue
    float nz = vnoise(vModel * 0.9);
    col = mix(uColA, uColB, nz) * lam * (0.55 + 0.6 * vShade);
    alpha = edge * uOpacity;
  } else {                    // highlight glow in one colour
    col = uColA * (0.65 + 0.5 * vShade) * (0.9 + 0.7 * t) * (0.7 + 0.4 * lam);
    alpha = edge * uOpacity;
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const STYLE = { heat: 0, lesion: 1, glow: 2 };

/**
 * A layer painted on the cortex.
 * @param {object} o  { hemis: ['left','right'], lobes?: [...], style: 'heat'|'lesion'|'glow',
 *                      seeds: [{p: Vector3(model), sigma, w}], region?, regionAdd?, regionMul?,
 *                      colors?: [a,b,c], thresh, opacity, level }
 */
export function cortexLayer(viewer, o = {}) {
  const shared = {
    uLevel: { value: o.level ?? 1 }, uThresh: { value: o.thresh ?? 0.25 }, uOpacity: { value: o.opacity ?? 0.95 },
    uTime: { value: 0 }, uSoft: { value: o.soft ?? 0 }, uStyle: { value: STYLE[o.style || 'heat'] },
    uColA: { value: new THREE.Color(o.colors?.[0] || '#B3120F') }, uColB: { value: new THREE.Color(o.colors?.[1] || '#FF6A13') }, uColC: { value: new THREE.Color(o.colors?.[2] || '#FFE45C') },
    uSeeds: { value: Array.from({ length: MAXS }, () => new THREE.Vector4()) }, uW: { value: new Array(MAXS).fill(0) }, uN: { value: 0 },
    uRegion: { value: o.region || 0 }, uRegionAdd: { value: o.regionAdd ?? 0 }, uRegionMul: { value: o.regionMul ?? 0 },
    uMaskW: { value: o.maskW ?? 0 },
  };
  const meshes = [];
  for (const m of Object.values(viewer.meshes)) {
    if (!m.name.startsWith('cortex_')) continue;
    if (o.hemis && !o.hemis.includes(m.userData.hemi)) continue;
    if (o.lobes && !o.lobes.includes(m.userData.lobe)) continue;
    m.updateMatrix();
    const mat = new THREE.ShaderMaterial({
      vertexShader: LAYER_VS, fragmentShader: LAYER_FS, transparent: true, depthWrite: false, clipping: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.FrontSide,
      uniforms: { ...shared, uToModel: { value: m.matrix.clone() } },
    });
    mat.clippingPlanes = m.material.clippingPlanes || null;
    const layer = new THREE.Mesh(m.geometry, mat);
    layer.raycast = () => {};
    layer.renderOrder = 3;
    layer.name = 'bx-layer';
    m.add(layer);
    meshes.push(layer);
    // parent is scaled (quantised geometry); the child shares geometry, so it must not be scaled again
  }
  const api = {
    uniforms: shared,
    setSeeds(seeds) {
      seeds.slice(0, MAXS).forEach((s, i) => { shared.uSeeds.value[i].set(s.p.x, s.p.y, s.p.z, s.sigma); shared.uW.value[i] = s.w ?? 1; });
      shared.uN.value = Math.min(MAXS, seeds.length);
    },
    set level(v) { shared.uLevel.value = v; }, get level() { return shared.uLevel.value; },
    setVisible(v) { meshes.forEach((m) => { m.visible = v; }); },
    setClipping(planes) { meshes.forEach((m) => { m.material.clippingPlanes = planes; m.material.needsUpdate = true; }); },
    dispose() { meshes.forEach((m) => { m.parent?.remove(m); m.material.dispose(); }); },
  };
  api.setSeeds(o.seeds || []);
  return api;
}

// ------------------------------------------------------------------ slicing with solid cut faces
// Stencil capping: for each group of closed meshes, every surface behind the cutting plane flips one
// stencil bit (parity). Where the bit is odd, the ray started INSIDE that structure at the plane, so a
// flat "cap" in the structure's colour is drawn exactly on the plane. This gives true cross-sections.
const CAP_VS = /* glsl */`
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CAP_FS = /* glsl */`
uniform vec3 uColor, uOffset;
uniform vec4 uHeat[4];
uniform int uHeatN;
uniform float uHeatLevel, uGrain;
varying vec3 vWorld;
float bxHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 lp = vWorld - uOffset;
  vec3 c = uColor * (1.0 - uGrain + 2.0 * uGrain * bxHash(floor(lp * 1.4)));
  float h = 0.0;
  for (int i = 0; i < 4; i++) { if (i >= uHeatN) break; vec3 d = lp - uHeat[i].xyz; h += exp(-dot(d, d) / (2.0 * uHeat[i].w * uHeat[i].w)); }
  h *= uHeatLevel * (0.8 + 0.4 * bxHash(floor(lp * 0.35)));
  if (h > 0.42) {
    float t = clamp((h - 0.42) / 0.58, 0.0, 1.0);
    vec3 hc = t < 0.55 ? mix(vec3(0.45, 0.01, 0.01), vec3(1.0, 0.16, 0.0), t / 0.55) : mix(vec3(1.0, 0.16, 0.0), vec3(1.0, 0.75, 0.1), (t - 0.55) / 0.45);
    c = mix(c, hc * 0.92, smoothstep(0.0, 0.1, t));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// structure groups (one stencil bit each), with default cut-face colours (post-mortem tissue)
const CAP_GROUPS = [
  { test: (n) => n.startsWith('cortex_'), color: '#E4D2C4' },
  { test: (n) => /cerebellum|brainstem/.test(n), color: '#D9C3B4' },
  { test: (n) => /hippocampus/.test(n), color: '#B98F7E' },
  { test: (n) => /ventricle/.test(n), color: '#2C3446' },
  { test: (n) => /thalamus/.test(n) && !/hypo/.test(n), color: '#B98F7E' },
  { test: (n) => /caudate|putamen|pallidum|accumbens/.test(n), color: '#B98F7E' },
  { test: (n) => /amygdala/.test(n), color: '#B98F7E' },
  { test: (n) => /corpus_callosum|hypothalamus|optic_chiasm|substantia|vta/.test(n), color: '#C9AA98' },
];

/**
 * Cut the whole brain with one plane, with solid cut faces (true cross-sections).
 * Groups for setPalette: 0 cortex, 1 cerebellum/brainstem, 2 hippocampus, 3 ventricles,
 * 4 thalamus, 5 basal ganglia, 6 amygdala, 7 other.
 */
export function createSlicer(viewer) {
  const renderer = viewer.renderer;
  renderer.localClippingEnabled = true;
  // the composer's render targets need a stencil buffer
  const comp = viewer.look.composer;
  if (comp) for (const rt of [comp.renderTarget1, comp.renderTarget2]) { if (!rt.stencilBuffer) { rt.stencilBuffer = true; rt.dispose(); } }

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const planes = [plane];
  const heat = { uHeat: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uHeatN: { value: 0 }, uHeatLevel: { value: 0 }, uOffset: { value: new THREE.Vector3() } };
  const writers = [], caps = [];
  const members = CAP_GROUPS.map(() => []);
  for (const o of Object.values(viewer.meshes)) {
    if (o.userData.tract || o.name.startsWith('pituitary')) continue;
    const gi = CAP_GROUPS.findIndex((g) => g.test(o.name));
    if (gi >= 0) members[gi].push(o);
  }
  const root = new THREE.Group(); root.name = 'bx-slicer'; root.visible = false;
  viewer.scene.add(root);
  members.forEach((list, gi) => {
    if (!list.length) return;
    const bit = 1 << gi;
    const wm = new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, clippingPlanes: planes,
      stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilWriteMask: bit,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.InvertStencilOp, stencilZPass: THREE.InvertStencilOp,
    });
    for (const o of list) {
      const w = new THREE.Mesh(o.geometry, wm);
      w.renderOrder = -100; w.raycast = () => {}; w.name = 'bx-stencil'; w.visible = false;
      o.add(w); writers.push(w);
    }
    const cm = new THREE.ShaderMaterial({
      vertexShader: CAP_VS, fragmentShader: CAP_FS, side: THREE.DoubleSide, depthFunc: THREE.LessEqualDepth,
      uniforms: { ...heat, uColor: { value: new THREE.Color(CAP_GROUPS[gi].color) }, uGrain: { value: 0.025 } },
      stencilWrite: true, stencilRef: bit, stencilFuncMask: bit, stencilWriteMask: 0, stencilFunc: THREE.EqualStencilFunc,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), cm);
    cap.renderOrder = -50 + gi;          // cortex first, deep structures drawn over it
    cap.raycast = () => {};
    cap.userData.group = gi;
    root.add(cap); caps.push(cap);
  });

  const look = viewer.look;
  const origAO = look.setAO;
  let active = false;
  // ambient occlusion reads an unclipped depth pass, so keep it off while cutting
  look.setAO = (on) => origAO.call(look, on && !active);
  const layers = new Set();
  const placeCaps = () => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
    const p = plane.coplanarPoint(new THREE.Vector3());
    for (const c of caps) { c.position.copy(p); c.quaternion.copy(q); }
    viewer.model.updateMatrixWorld();
    heat.uOffset.value.setFromMatrixPosition(viewer.model.matrixWorld);
  };
  const setOn = (on) => {
    for (const o of Object.values(viewer.meshes)) {
      if (o.userData.tract) continue;
      o.material.clippingPlanes = on ? planes : null; o.material.needsUpdate = true;
    }
    layers.forEach((l) => l.setClipping(on ? planes : null));
    writers.forEach((w) => { w.visible = on; });
    root.visible = on;
  };
  const api = {
    plane,
    get active() { return active; },
    /** keep everything on the side the normal points to. normal: world-space; point: model space */
    cut(normal, pointModel) {
      viewer.model.updateMatrixWorld(true);
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(...normal).normalize(), toWorld(viewer, pointModel));
      placeCaps();
      if (!active) { active = true; setOn(true); origAO.call(look, false); }
    },
    off() {
      if (!active) return;
      active = false; setOn(false);
      viewer.applyMode();
    },
    /** palette: (groupIndex, defaultColour) -> colour | null (null keeps the default) */
    setPalette(fn) {
      for (const c of caps) { const gi = c.userData.group; c.material.uniforms.uColor.value.set(fn?.(gi, CAP_GROUPS[gi].color) || CAP_GROUPS[gi].color); }
    },
    addLayer(l) { layers.add(l); l.setClipping(active ? planes : null); },
    setHeat(seeds, level = 1) {
      seeds.slice(0, 4).forEach((s, i) => heat.uHeat.value[i].set(s.p.x, s.p.y, s.p.z, s.sigma));
      heat.uHeatN.value = Math.min(4, seeds.length); heat.uHeatLevel.value = level;
    },
    set heatLevel(v) { heat.uHeatLevel.value = v; },
    dispose() {
      api.off();
      look.setAO = origAO;
      writers.forEach((w) => w.parent?.remove(w));
      caps.forEach((c) => { c.geometry.dispose(); c.material.dispose(); });
      viewer.scene.remove(root);
    },
  };
  return api;
}

// ------------------------------------------------------------------ split a structure along its long axis
/**
 * Splits a deep-structure mesh into a front and a back part along its principal (long) axis.
 * The original mesh is hidden (material.visible) while the split is shown.
 * @returns {{front: THREE.Mesh, back: THREE.Mesh, show(on), dispose()}}
 */
export function splitLongAxis(viewer, name, backFraction = 0.42, colors = { front: '#8FA3C8', back: '#FFC23D' }) {
  const src = viewer.meshes[name];
  src.updateMatrix();
  const g = src.geometry, pos = g.attributes.position, idx = g.index.array;
  const P = []; const v = new THREE.Vector3(); const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(src.matrix); P.push(v.clone()); c.add(v); }
  c.divideScalar(P.length);
  // principal axis by power iteration on the covariance matrix
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of P) { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
  let ax = [0, 0, 1];
  for (let k = 0; k < 40; k++) { const n = [0, 1, 2].map((a) => C[a][0] * ax[0] + C[a][1] * ax[1] + C[a][2] * ax[2]); const l = Math.hypot(...n); ax = n.map((x) => x / l); }
  const axis = new THREE.Vector3(...ax);
  if (axis.z > 0) axis.negate();                     // point towards the back (−Z = posterior)
  const s = P.map((p) => p.clone().sub(c).dot(axis));
  const sMin = Math.min(...s), sMax = Math.max(...s);
  const cutS = sMax - backFraction * (sMax - sMin);   // back part = the most posterior fraction of the length
  const fi = [], bi = [];
  for (let f = 0; f < idx.length; f += 3) {
    const m = (s[idx[f]] + s[idx[f + 1]] + s[idx[f + 2]]) / 3;
    (m > cutS ? bi : fi).push(idx[f], idx[f + 1], idx[f + 2]);
  }
  const make = (list, col, emissive) => {
    const geo = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) geo.setAttribute(k, a);
    geo.setIndex(list);
    const mat = tissueMaterial(new THREE.Color(col), { roughness: 0.4 });
    if (emissive) { mat.emissive = new THREE.Color(col); mat.emissiveIntensity = 0.55; }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(src.position); mesh.quaternion.copy(src.quaternion); mesh.scale.copy(src.scale);
    mesh.raycast = () => {};
    mesh.visible = false;
    viewer.model.add(mesh);
    return mesh;
  };
  const front = make(fi, colors.front, false), back = make(bi, colors.back, true);
  // a point on the back part, for labels
  const backCentre = new THREE.Vector3(); let nb = 0;
  P.forEach((p, i) => { if (s[i] > cutS) { backCentre.add(p); nb++; } });
  backCentre.divideScalar(Math.max(1, nb));
  const frontCentre = new THREE.Vector3(); let nf = 0;
  P.forEach((p, i) => { if (s[i] <= cutS) { frontCentre.add(p); nf++; } });
  frontCentre.divideScalar(Math.max(1, nf));
  return {
    front, back, backCentre, frontCentre,
    show(on) { front.visible = back.visible = on; src.material.visible = !on; },
    dispose() { for (const m of [front, back]) { viewer.model.remove(m); m.geometry.dispose(); m.material.dispose(); } src.material.visible = true; },
  };
}

/** Make some non-cortex structures glow / dim others. Re-apply after any viewer.applyMode(). */
export function styleStructures(viewer, { glow = {}, hide = [], dim = null, dimOpacity = 0.12 } = {}) {
  for (const o of Object.values(viewer.meshes)) {
    if (o.name.startsWith('cortex_') || o.userData.tract) continue;
    const name = o.name;
    if (glow[name]) {
      o.material.emissive?.set(glow[name]);
      o.material.emissiveIntensity = 0.22;
      o.material.color.set(glow[name]);
      o.material.opacity = 1; o.material.depthWrite = true; o.renderOrder = 0;
    } else if (hide.includes(name) || (dim && dim.test(name))) {
      o.material.opacity = hide.includes(name) ? 0 : dimOpacity;
      o.material.depthWrite = false; o.renderOrder = 1;
      if (hide.includes(name)) o.visible = false;
    }
  }
}
