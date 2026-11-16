// Reusable 3D human body viewer for the biopsychology lessons (nervous system, endocrine system,
// fight or flight). The anatomy comes from BodyParts3D (DBCLS, CC BY 4.0): polygon meshes of one adult
// male, based on whole-body MRI (the TARO voxel model) and refined/supplemented by medical illustrators
// (Mitsuhashi et al., 2009, Nucleic Acids Research 37:D782-5). A few parts BodyParts3D does not have
// (spinal cord, thyroid, lung tissue, adrenal medulla, most peripheral nerves) are drawn from real
// landmarks; see body-provenance.json. Whatever drawn part is on show is named in the caption.
//
// Features: glassy skin over real organs; highlight + dim-the-rest signalling; HTML labels with
// leader lines anchored to 3D points; camera framing; particle flows along nerve and blood routes;
// a picture-in-picture "zoomed in" inset (with an optional cut-away); heart beat / breathing.
// Respects reduced motion (no moving particles, end states) and calm mode (no glow, no bloom).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, studioLights, tissueMaterial, lowPower } from './look.js';
import { reducedMotion, get } from '../settings.js';

// Role colours, matching the site's dark-stage palette
export const C = {
  cns: '#B3A6FF', pns: '#4FD2CB', aut: '#F0C35A', sym: '#FF9A5C', para: '#7DBBFF', gland: '#FFC15E',
  hormone: '#FFD27A', blood: '#FF7088', heart: '#FF7B8E', brainpart: '#E9A0FF', muscle: '#FF9A86', vein: '#7FA6FF', calm: '#8FE3B0',
};

const BASE = {
  cerebrum: '#E3B3AA', cerebellum: '#D6A196', brainstem: '#E2B6A2', spinal_cord: '#F0D7BC', hypothalamus: '#EFA3BC', thalamus: '#E5B2C4',
  amygdala_left: '#F08AA6', amygdala_right: '#F08AA6', optic_nerves: '#F1E0C6', pituitary: '#E0856A', pineal: '#D39B85',
  adrenal_left: '#E7B24D', adrenal_right: '#E7B24D', adrenal_medulla_left: '#C25A2A', adrenal_medulla_right: '#C25A2A',
  pancreas: '#E9C27D', testis_left: '#E8D4C4', testis_right: '#E8D4C4', salivary_left: '#E6BD9B', salivary_right: '#E6BD9B',
  eye_left: '#F2EEE6', eye_right: '#F2EEE6', iris_left: '#4F7FAE', iris_right: '#4F7FAE', ciliary_ganglia: '#F1E0C6',
  heart: '#B13A3D', liver: '#7C3427', stomach: '#DF9984', esophagus: '#D58B79', small_intestine: '#E7AC92', large_intestine: '#D6937A',
  kidney_left: '#8F3C34', kidney_right: '#8F3C34', ureters: '#D7A08C', bladder: '#E3B39A', spleen: '#73303F', airways: '#EFD8CA',
  lung_left: '#E9A2A8', lung_right: '#E9A2A8', thyroid: '#B85A4E', spine: '#EFE5D3', skull: '#EFE5D3', ribcage: '#EFE5D3', pelvis: '#EFE5D3',
  limb_bones: '#EFE5D3', arteries: '#C9313C', veins: '#4060B5', pulmonary_vessels: '#5D74C2',
  muscle_arm_left: '#B5473D', muscle_arm_right: '#B5473D', muscle_thigh_left: '#B5473D', muscle_thigh_right: '#B5473D',
  muscle_calf_left: '#B5473D', muscle_calf_right: '#B5473D',
};

export const GROUPS = {
  brain: ['cerebrum', 'cerebellum', 'brainstem'],
  cns: ['cerebrum', 'cerebellum', 'brainstem', 'spinal_cord'],
  amygdala: ['amygdala_left', 'amygdala_right'],
  adrenals: ['adrenal_left', 'adrenal_right'],
  medullas: ['adrenal_medulla_left', 'adrenal_medulla_right'],
  kidneys: ['kidney_left', 'kidney_right'],
  lungs: ['lung_left', 'lung_right'],
  eyes: ['eye_left', 'eye_right', 'iris_left', 'iris_right'],
  testes: ['testis_left', 'testis_right'],
  salivary: ['salivary_left', 'salivary_right'],
  gut: ['stomach', 'small_intestine', 'large_intestine', 'esophagus'],
  intestines: ['small_intestine', 'large_intestine'],
  bones: ['spine', 'skull', 'ribcage', 'pelvis', 'limb_bones'],
  vessels: ['arteries', 'veins', 'pulmonary_vessels'],
  muscles: ['muscle_arm_left', 'muscle_arm_right', 'muscle_thigh_left', 'muscle_thigh_right', 'muscle_calf_left', 'muscle_calf_right'],
  arm_muscles: ['muscle_arm_left', 'muscle_arm_right'],
  thigh_muscles: ['muscle_thigh_left', 'muscle_thigh_right'],
  glands: ['pituitary', 'thyroid', 'adrenal_left', 'adrenal_right', 'pancreas', 'testis_left', 'testis_right', 'pineal'],
};
const BONES = new Set(GROUPS.bones);

// ------------------------------------------------------------------ loading (shared by every viewer)
let assetPromise = null;
function loadAssets() {
  if (!assetPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const base = import.meta.env.BASE_URL;
    assetPromise = Promise.all([
      loader.loadAsync(`${base}models/body.glb`),
      fetch(`${base}models/body.json`).then((r) => r.json()),
    ]).then(([gltf, data]) => {
      gltf.scene.traverse((o) => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
      return { gltf, data };
    });
  }
  return assetPromise;
}

// ------------------------------------------------------------------ materials
function bodyMaterial(color, { minPx = 0, radius = 0 } = {}) {
  const u = {
    uGhost: { value: 1 }, uGhostAlpha: { value: 1 }, uGhostColor: { value: new THREE.Color('#9FB6EA') },
    uGlow: { value: 0 }, uGlowColor: { value: new THREE.Color('#ffffff') }, uTint: { value: new THREE.Color('#ffffff') },
    uTintAmt: { value: 0 }, uAlpha: { value: 1 }, uMinPx: { value: minPx }, uPxWorld: { value: 0.001 }, uRadius: { value: radius },
  };
  const mat = tissueMaterial(new THREE.Color(color), { transparent: true, roughness: 0.48 });
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uMinPx; uniform float uPxWorld; uniform float uRadius;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (uMinPx > 0.0) {
          float camD = distance(cameraPosition, (modelMatrix * vec4(transformed, 1.0)).xyz);
          float rmin = 0.5 * uMinPx * uPxWorld * camD;
          transformed += normalize(objectNormal) * max(0.0, rmin - uRadius);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGhost; uniform float uGhostAlpha; uniform vec3 uGhostColor; uniform float uGlow; uniform vec3 uGlowColor;
        uniform vec3 uTint; uniform float uTintAmt; uniform float uAlpha;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint, uTintAmt);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, uGhostColor, 0.6), uGhost);
          float ga = (0.03 + 0.5 * fres) * uGhostAlpha;
          diffuseColor.a = mix(diffuseColor.a * uAlpha, ga, uGhost);
          totalEmissiveRadiance += uGlowColor * uGlow * (0.3 + 0.7 * fres);
          totalEmissiveRadiance += uGhostColor * (uGhost * fres * 0.08 * uGhostAlpha);
        }`);
  };
  mat.customProgramCacheKey = () => 'b3-body-v1';
  return mat;
}

function skinMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#CFE0FF', roughness: 0.25, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: true, depthWrite: false, side: THREE.FrontSide });
  const u = { uRim: { value: new THREE.Color('#7FA2F0') }, uStrength: { value: 1 } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uStrength;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
          diffuseColor.a = (0.025 + 0.34 * fres) * uStrength;
          totalEmissiveRadiance += uRim * fres * 0.22 * uStrength;
        }`);
  };
  mat.customProgramCacheKey = () => 'b3-skin-v1';
  return mat;
}

// ------------------------------------------------------------------ particles
class Polyline {
  constructor(points) {
    this.p = points.map((q) => (q.isVector3 ? q : new THREE.Vector3(...q)));
    this.L = [0];
    for (let i = 1; i < this.p.length; i++) this.L.push(this.L[i - 1] + this.p[i].distanceTo(this.p[i - 1]));
    this.length = this.L[this.L.length - 1];
  }
  at(s, out = new THREE.Vector3()) {
    const L = this.L;
    if (s <= 0) return out.copy(this.p[0]);
    if (s >= this.length) return out.copy(this.p[this.p.length - 1]);
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    const t = (s - L[lo]) / (L[hi] - L[lo] || 1);
    return out.copy(this.p[lo]).lerp(this.p[hi], t);
  }
}

// ------------------------------------------------------------------ CSS (scoped)
const CSS = `
.b3 { position:absolute; inset:0; overflow:hidden; }
.b3 canvas { display:block; width:100%; height:100%; outline:none; touch-action:none; cursor:grab; }
.b3 canvas:focus-visible { box-shadow: inset 0 0 0 3px #FFD27A; }
.b3-overlay { position:absolute; inset:0; pointer-events:none; }
.b3-overlay svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.b3-lead { stroke-width:2; fill:none; }
.b3-dot { stroke:#0b1120; stroke-width:2; }
.b3-label { position:absolute; left:0; top:0; max-width:230px; padding:6px 11px 7px; border-radius:11px; background:rgba(11,17,34,.95);
  border:2px solid var(--lc,#fff); color:#F3F6FF; font-family:var(--font, system-ui, sans-serif); font-weight:700; font-size:16px; line-height:1.25;
  box-shadow:0 6px 18px rgba(0,0,0,.35); white-space:pre-line; will-change:transform; transition: opacity .35s ease; }
.b3-label .b3-sub { display:block; font-weight:500; font-size:15px; color:#CAD4EE; margin-top:1px; }
.b3-label.b3-note { border-style:dashed; }
.b3-inset { position:absolute; border-radius:20px; box-shadow: 0 0 0 2px rgba(220,230,255,.35), 0 10px 30px rgba(0,0,0,.45); pointer-events:none; }
.b3-inset-tag { position:absolute; left:12px; top:10px; padding:3px 10px; border-radius:999px; background:rgba(11,17,34,.9); color:#E8EDFF;
  font: 700 15px/1.3 var(--font, system-ui, sans-serif); border:1px solid rgba(220,230,255,.3); }
.b3-loading { position:absolute; inset:0; display:grid; place-items:center; color:#C9D3EE; font: 600 16px var(--font, system-ui); }
@media (prefers-reduced-motion: reduce) { .b3-label { transition:none; } }
`;
function injectCSS() {
  if (document.getElementById('b3-css')) return;
  const s = document.createElement('style'); s.id = 'b3-css'; s.textContent = CSS; document.head.append(s);
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ================================================================== the viewer
export class BodyViewer {
  constructor(container, opts = {}) {
    injectCSS();
    this.container = container;
    this.opts = opts;
    this.root = document.createElement('div');
    this.root.className = 'b3';
    container.append(this.root);
    const loading = document.createElement('p'); loading.className = 'b3-loading'; loading.textContent = 'Loading the 3D body…';
    this.root.append(loading);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower() ? 1.5 : 2));
    this.renderer.localClippingEnabled = true;
    const el = this.renderer.domElement;
    el.tabIndex = 0;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', opts.label || '3D model of the human body');
    this.root.append(el);

    this.overlay = document.createElement('div'); this.overlay.className = 'b3-overlay';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.append(this.svg);
    this.root.append(this.overlay);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 5, 12000);
    this.camera.layers.enable(1);
    this.camera.position.set(0, 1100, 3800);
    this.lights = studioLights(3);
    this.camera.add(this.lights);
    this.scene.add(this.camera);
    this.look = createLook(this.renderer, this.scene, this.camera, { bloom: 0.55, envIntensity: 0.35 });
    this.look.setAO(false);
    this.insetCam = new THREE.PerspectiveCamera(28, 1, 1, 4000);
    this.insetCam.layers.set(0);

    this.controls = new OrbitControls(this.camera, el);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 60, maxDistance: 6000, rotateSpeed: 0.7, zoomSpeed: 0.8, panSpeed: 0.6 });
    this.controls.addEventListener('start', () => { this._tween = null; this._userMoved = true; });
    el.addEventListener('keydown', (e) => this._key(e));

    this.safe = { left: 0, right: 0, top: 0, bottom: 0 };
    this.meshes = {}; this.nerves = {}; this.labels = []; this.flows = []; this.tracks = []; this.pulses = {};
    this.time = 0; this.paused = false; this.token = 0; this.waiters = [];
    this.clock = new THREE.Clock();
    this.clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e6);

    this._initParticles();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this.ready = this._load().then(() => { loading.remove(); return this; });
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // ---------------------------------------------------------------- loading
  async _load() {
    const { gltf, data } = await loadAssets();
    this.data = data;
    const model = gltf.scene.clone(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.name || o.parent?.name;
      o.name = name;
      if (name === 'skin') {
        o.material = skinMaterial();
        o.renderOrder = 20;
        o.layers.set(1);
        this.skin = o;
        return;
      }
      o.material = bodyMaterial(BASE[name] || '#cccccc');
      o.userData.base = new THREE.Color(BASE[name] || '#cccccc');
      o.userData.homePos = o.position.clone();
      o.userData.homeScale = o.scale.clone();
      if (BONES.has(name)) o.layers.set(1);
      this._initState(o, BONES.has(name) ? 'bone' : data.parts[name]?.cat);
      this.meshes[name] = o;
    });
    this.model = model;
    this.scene.add(model);
    // diagrammatic nerves as tubes (kept a few pixels wide on screen at any zoom)
    for (const [name, n] of Object.entries(data.nerves)) {
      const pts = n.pts.map((p) => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, Math.min(400, Math.max(8, pts.length * 2)), n.r, 7, false);
      const col = { som: C.pns, sym: C.sym, para: C.para }[n.kind] || C.pns;
      const mesh = new THREE.Mesh(geo, bodyMaterial('#E9DCC2', { minPx: n.kind === 'som' && n.r < 1 ? 1.6 : 2.4, radius: n.r }));
      mesh.name = name;
      mesh.userData.kind = n.kind;
      mesh.userData.base = new THREE.Color('#E9DCC2');
      mesh.userData.role = new THREE.Color(col);
      this._initState(mesh, 'nerve');
      mesh.visible = false;
      this.nerves[name] = mesh;
      this.scene.add(mesh);
    }
    this.routes = {};
    for (const [k, r] of Object.entries(data.routes)) this.routes[k] = r;
    const box = new THREE.Box3().setFromObject(this.skin);
    this.bodyBox = box;
    this.frame({ box, dir: [0, 0.05, 1] }, true);
    this.setState({});
  }

  _initState(o, cat) {
    const ga = { bone: 0.38, nerve: 0.55, artery: 0.65, vein: 0.65 }[cat] ?? 0.9;
    o.userData.cat = cat;
    o.userData.ghostAlpha = ga;
    o.userData.cur = { ghost: 1, glow: 0, tint: 0, alpha: 1 };
    o.userData.tgt = { ghost: 1, glow: 0, tint: 0, alpha: 1 };
    o.userData.tintColor = new THREE.Color('#ffffff');
    o.userData.glowColor = new THREE.Color('#ffffff');
  }

  // ---------------------------------------------------------------- state: what is lit, ghosted, hidden
  expand(names) {
    const out = [];
    for (const n of [].concat(names || [])) {
      if (GROUPS[n]) out.push(...GROUPS[n]);
      else if (n.startsWith('nerves:')) {
        const kind = n.slice(7);
        out.push(...Object.keys(this.nerves || {}).filter((k) => kind === 'all' || this.nerves[k].userData.kind === kind));
      } else if (n.endsWith('*')) {
        const pre = n.slice(0, -1);
        out.push(...[...Object.keys(this.meshes || {}), ...Object.keys(this.nerves || {})].filter((k) => k.startsWith(pre)));
      } else out.push(n);
    }
    return out;
  }

  get(name) { return this.meshes?.[name] || this.nerves?.[name]; }

  /**
   * spec = {
   *   lit:   { name|group: colour | { color, glow, tint, alpha } }   highlighted (solid, tinted, glowing)
   *   solid: [names]          shown in natural colour as context
   *   nerves: { name|group: colour }   nerve tubes shown dimly in a colour (others hidden)
   *   hide:  [names]          not drawn at all
   *   skin: 0..1 (default 1), bones: 0..1 (default 1)
   * }
   * Everything else is ghosted (faint glass).
   */
  setState(spec = {}, { instant = false } = {}) {
    if (!this.meshes) { this._pending = spec; return; }
    this.spec = spec;
    const calm = get('calm') === 'true';
    const lit = new Map(), solid = new Set(this.expand(spec.solid)), hide = new Set(this.expand(spec.hide));
    for (const [k, v] of Object.entries(spec.lit || {})) for (const n of this.expand(k)) lit.set(n, typeof v === 'string' ? { color: v } : v);
    const nerveOn = new Map();
    for (const [k, v] of Object.entries(spec.nerves || {})) for (const n of this.expand(k)) nerveOn.set(n, v);
    const apply = (o, name) => {
      const ud = o.userData, t = ud.tgt;
      o.visible = !hide.has(name);
      const L = lit.get(name);
      if (L) {
        t.ghost = 0; t.alpha = L.alpha ?? 1;
        t.tint = L.tint ?? (ud.cat === 'nerve' ? 0.85 : 0.72);
        t.glow = calm ? 0.06 : (L.glow ?? 0.38);
        ud.tintColor.set(L.color || '#ffffff'); ud.glowColor.set(L.color || '#ffffff');
      } else if (solid.has(name)) {
        t.ghost = 0; t.alpha = 1; t.tint = 0; t.glow = 0;
      } else {
        t.ghost = 1; t.glow = 0; t.tint = 0; t.alpha = 1;
      }
      if (ud.cat === 'bone') ud.ghostScale = spec.bones ?? 1;
    };
    for (const [name, o] of Object.entries(this.meshes)) apply(o, name);
    for (const [name, o] of Object.entries(this.nerves)) {
      apply(o, name);
      const on = nerveOn.get(name);
      if (!lit.has(name)) {
        o.visible = !!on && !hide.has(name);
        if (on) { o.userData.tgt.ghost = 0; o.userData.tgt.tint = 0.75; o.userData.tgt.alpha = 0.55; o.userData.tintColor.set(on); o.userData.tgt.glow = 0; }
      }
    }
    this.skinStrength = spec.skin ?? 1;
    // which drawn (not scanned) parts are highlighted or shown right now, for the on-screen note
    const drawn = [];
    const shown = (n) => (lit.has(n) || solid.has(n)) && !hide.has(n);
    if (shown('spinal_cord')) drawn.push('spinal cord');
    if (Object.keys(this.nerves).some((n) => this.nerves[n].visible)) drawn.push('nerves');
    if (shown('thyroid')) drawn.push('thyroid');
    if (shown('lung_left') || shown('lung_right')) drawn.push('lung outline');
    if (shown('adrenal_medulla_left') || shown('adrenal_medulla_right')) drawn.push('adrenal medulla');
    this.drawn = drawn;
    this.onState?.(drawn);
    if (instant || reducedMotion()) this._snap();
  }

  _snap() {
    for (const o of [...Object.values(this.meshes), ...Object.values(this.nerves)]) Object.assign(o.userData.cur, o.userData.tgt);
  }

  _applyMaterials(dt) {
    const k = reducedMotion() ? 1 : Math.min(1, dt * 4.5);
    const calm = get('calm') === 'true';
    for (const o of [...Object.values(this.meshes), ...Object.values(this.nerves)]) {
      if (!o.visible) continue;
      const { cur, tgt } = o.userData;
      for (const key of ['ghost', 'glow', 'tint', 'alpha']) cur[key] += (tgt[key] - cur[key]) * k;
      const u = o.material.userData.u;
      u.uGhost.value = cur.ghost;
      u.uGhostAlpha.value = o.userData.ghostAlpha * (o.userData.ghostScale ?? 1);
      u.uGlow.value = calm ? Math.min(cur.glow, 0.06) : cur.glow;
      u.uGlowColor.value.copy(o.userData.glowColor);
      u.uTint.value.copy(o.userData.tintColor);
      u.uTintAmt.value = cur.tint;
      u.uAlpha.value = cur.alpha;
      u.uPxWorld.value = this._pxWorld || 0.001;
      const see = cur.ghost > 0.02 || cur.alpha < 0.98;
      o.material.depthWrite = !see;
      o.renderOrder = see ? (o.userData.cat === 'bone' ? 3 : 5) : 0;
    }
    if (this.skin) {
      const s = this.skin.material.userData.u.uStrength;
      s.value += ((this.skinStrength ?? 1) - s.value) * k;
      this.skin.visible = s.value > 0.01;
    }
  }

  // ---------------------------------------------------------------- positions
  /** World position of a part / anchor / point (glTF mm). */
  point(at) {
    if (Array.isArray(at)) return new THREE.Vector3(...at);
    if (at?.isVector3) return at.clone();
    if (typeof at === 'object' && at) return this.point(at.at).add(new THREE.Vector3(...(at.offset || [0, 0, 0])));
    const a = this.data?.anchors?.[at];
    if (a) return new THREE.Vector3(...a);
    const p = this.data?.parts?.[at];
    if (p) return new THREE.Vector3(...p.center);
    if (GROUPS[at]) { const v = new THREE.Vector3(); GROUPS[at].forEach((n) => v.add(this.point(n))); return v.divideScalar(GROUPS[at].length); }
    const n = this.data?.nerves?.[at];
    if (n) return new THREE.Vector3(...n.pts[Math.floor(n.pts.length / 2)]);
    return new THREE.Vector3();
  }

  boxOf(names) {
    const box = new THREE.Box3();
    for (const n of this.expand(names)) {
      const p = this.data.parts[n];
      if (p) { box.expandByPoint(new THREE.Vector3(...p.min)); box.expandByPoint(new THREE.Vector3(...p.max)); }
      else if (this.data.anchors[n]) box.expandByPoint(new THREE.Vector3(...this.data.anchors[n]));
      else if (this.data.nerves[n]) this.data.nerves[n].pts.forEach((q) => box.expandByPoint(new THREE.Vector3(...q)));
    }
    return box;
  }

  // ---------------------------------------------------------------- camera
  setSafe(s) { this.safe = { left: 0, right: 0, top: 0, bottom: 0, ...s }; this._applyViewOffset(); this._layoutInset(); }

  _applyViewOffset() {
    const W = this.W || 1, H = this.H || 1, s = this.safe;
    const dx = (s.left - s.right) / 2, dy = (s.top - s.bottom) / 2;
    this.camera.setViewOffset(W, H, -dx, -dy, W, H);
    this.camera.updateProjectionMatrix();
  }

  /**
   * frame({ parts | box | center+size, dir:[x,y,z] (towards the camera), pad, height (mm, optional) })
   */
  frame(f = {}, instant = false) {
    if (!this.data) return;
    this._lastFrame = f;
    this._userMoved = false;
    let box = f.box;
    if (!box && f.parts) box = this.boxOf(f.parts);
    if (!box && f.center) { const c = this.point(f.center); const h = (f.size || 300) / 2; box = new THREE.Box3(c.clone().subScalar(h), c.clone().addScalar(h)); }
    if (!box || box.isEmpty()) box = this.bodyBox;
    this._frameBox = box.clone();
    const center = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(...(f.dir || [0, 0.05, 1])).normalize();
    // camera basis for this direction
    const z = dir.clone(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    let hw = 0, hh = 0, hd = 0;
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
      hw = Math.max(hw, Math.abs(c.dot(x))); hh = Math.max(hh, Math.abs(c.dot(y))); hd = Math.max(hd, c.dot(z));
    }
    const W = this.W || 1, H = this.H || 1, s = this.safe;
    const fw = Math.max(80, W - s.left - s.right), fh = Math.max(80, H - s.top - s.bottom);
    const tv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const pad = f.pad ?? 1.12;
    const dist = Math.max((hh * pad) / (tv * (fh / H)), (hw * pad) / (tv * (W / H) * (fw / W))) + hd;
    this._flyTo(center, dir.multiplyScalar(dist), instant);
  }

  _flyTo(target, offset, instant) {
    const toPos = target.clone().add(offset);
    if (instant || reducedMotion()) {
      this.camera.position.copy(toPos); this.controls.target.copy(target); this.camera.lookAt(target); this._tween = null;
      return;
    }
    this._tween = { t: 0, fromPos: this.camera.position.clone(), toPos, fromT: this.controls.target.clone(), toT: target.clone() };
  }

  resetView() { if (this._lastFrame) this.frame(this._lastFrame); }

  _key(e) {
    const step = 0.14;
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let used = true;
    if (e.key === 'ArrowLeft') sph.theta -= step;
    else if (e.key === 'ArrowRight') sph.theta += step;
    else if (e.key === 'ArrowUp') sph.phi = Math.max(0.1, sph.phi - step);
    else if (e.key === 'ArrowDown') sph.phi = Math.min(Math.PI - 0.1, sph.phi + step);
    else if (e.key === '+' || e.key === '=') sph.radius = Math.max(this.controls.minDistance, sph.radius * 0.85);
    else if (e.key === '-' || e.key === '_') sph.radius = Math.min(this.controls.maxDistance, sph.radius / 0.85);
    else if (e.key === 'r' || e.key === 'R' || e.key === 'Home') { this.resetView(); e.preventDefault(); return; }
    else used = false;
    if (!used) return;
    e.preventDefault();
    this._tween = null;
    this._userMoved = true;
    off.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(off);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.W = w; this.H = h;
    this.renderer.setSize(w, h, false);
    this.look.setSize(w, h);
    this.camera.aspect = w / h;
    this._applyViewOffset();
    this._layoutInset();
    if (this._lastFrame && !this._userMoved) this.frame(this._lastFrame, true);
  }

  // ---------------------------------------------------------------- labels
  /**
   * labels: [{ at, text, sub, color, side: 'left'|'right'|'auto', view: 'main'|'inset', note: bool }]
   */
  setLabels(list = []) {
    for (const l of this.labels) { l.el.remove(); l.line.remove(); l.dot.remove(); }
    this.labels = [];
    const narrow = (this.W || 800) < 560;
    for (const spec of list) {
      if (narrow && spec.minor) continue; // small screens: only the key labels
      const el = document.createElement('div');
      el.className = `b3-label${spec.note ? ' b3-note' : ''}`;
      el.style.setProperty('--lc', spec.color || '#ffffff');
      const text = narrow && spec.short ? spec.short : spec.text;
      el.textContent = text;
      if (spec.sub && !narrow) { const s = document.createElement('span'); s.className = 'b3-sub'; s.textContent = spec.sub; el.append(s); }
      if (narrow) el.style.maxWidth = '160px';
      this.overlay.append(el);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('class', 'b3-lead'); line.setAttribute('stroke', spec.color || '#fff');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('class', 'b3-dot'); dot.setAttribute('r', '5'); dot.setAttribute('fill', spec.color || '#fff');
      this.svg.append(line, dot);
      this.labels.push({ spec, el, line, dot, w: 0, h: 0 });
    }
    // measure once
    for (const l of this.labels) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
  }

  _project(p, cam, rect) {
    const v = p.clone().project(cam);
    return { x: rect.x + (v.x + 1) / 2 * rect.w, y: rect.y + (1 - v.y) / 2 * rect.h, behind: v.z > 1 };
  }

  _layoutLabels() {
    if (!this.labels.length) return;
    const W = this.W, H = this.H, s = this.safe;
    const groups = { main: { left: [], right: [] }, inset: { left: [], right: [] } };
    for (const l of this.labels) {
      const view = l.spec.view === 'inset' && this.inset ? 'inset' : 'main';
      const rect = view === 'inset' ? this.inset.px : { x: 0, y: 0, w: W, h: H };
      const cam = view === 'inset' ? this.insetCam : this.camera;
      const a = this._project(this.point(l.spec.at), cam, rect);
      l.a = a; l.view = view;
      let side = l.spec.side || 'auto';
      if (side === 'auto') side = a.x < rect.x + rect.w / 2 ? 'left' : 'right';
      l.side = side;
      groups[view][side].push(l);
    }
    const gap = 8;
    // where the framed anatomy sits on screen: label columns go just outside it when there is room
    let sil = null;
    if (this._frameBox) {
      sil = { l: Infinity, r: -Infinity };
      const b = this._frameBox, c = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        c.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
        const q = this._project(c, this.camera, { x: 0, y: 0, w: W, h: H });
        sil.l = Math.min(sil.l, q.x); sil.r = Math.max(sil.r, q.x);
      }
    }
    for (const view of ['main', 'inset']) {
      const rect = view === 'inset' && this.inset ? this.inset.px : { x: s.left, y: s.top, w: W - s.left - s.right, h: H - s.top - s.bottom };
      for (const side of ['left', 'right']) {
        const arr = groups[view][side].sort((p, q) => (p.spec.order ?? p.a.y) - (q.spec.order ?? q.a.y));
        if (!arr.length) continue;
        // column x: next to the anchors, but inside the free area
        const reach = view === 'inset' ? 26 : Math.max(40, Math.min(110, rect.w * 0.08));
        let colX;
        const useSil = view === 'main' && sil && !this.inset?.spec?.noSil;
        if (side === 'left') {
          colX = Math.min(...arr.map((l) => l.a.x)) - reach;
          if (useSil) colX = Math.min(colX, sil.l - 14);
          colX = Math.max(colX, rect.x + 10 + Math.max(...arr.map((l) => l.w)));
        } else {
          colX = Math.max(...arr.map((l) => l.a.x)) + reach;
          if (useSil) colX = Math.max(colX, sil.r + 14);
          colX = Math.min(colX, rect.x + rect.w - 10 - Math.max(...arr.map((l) => l.w)));
        }
        let y = rect.y + (view === 'inset' ? 44 : 8);
        for (const l of arr) {
          const want = l.spec.y != null ? rect.y + l.spec.y * rect.h : l.a.y - l.h / 2;
          l.y = Math.max(want, y);
          y = l.y + l.h + gap;
        }
        const over = y - gap - (rect.y + rect.h - 8);
        const avail = rect.h - 16 - gap * (arr.length - 1);
        const need = arr.reduce((t, l) => t + l.h, 0);
        if (need > avail) { // too many to fit: keep the top ones readable, let the last ones overlap
          let yy = rect.y + 8;
          for (const l of arr) { l.y = yy; yy += Math.max(18, (avail / need) * l.h) + gap; }
        } else
        if (over > 0) {
          let floor = rect.y + rect.h - 8;
          for (let i = arr.length - 1; i >= 0; i--) {
            const l = arr[i];
            l.y = Math.min(l.y, floor - l.h);
            floor = l.y - gap;
          }
        }
        for (const l of arr) {
          const x = side === 'left' ? colX - l.w : colX;
          l.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(l.y)}px)`;
          const ex = side === 'left' ? colX : colX, ey = l.y + l.h / 2;
          const midx = side === 'left' ? Math.min(ex + 14, l.a.x) : Math.max(ex - 14, l.a.x);
          l.line.setAttribute('points', `${l.a.x.toFixed(1)},${l.a.y.toFixed(1)} ${midx.toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
          l.dot.setAttribute('cx', l.a.x.toFixed(1)); l.dot.setAttribute('cy', l.a.y.toFixed(1));
          const hidden = l.a.behind;
          l.el.style.opacity = hidden ? '0' : '1';
          l.line.style.opacity = l.dot.style.opacity = hidden ? '0' : '1';
        }
      }
    }
  }

  // ---------------------------------------------------------------- inset (picture in picture)
  /**
   * setInset({ at, dist, dir, rect: { x, y, w, h } as fractions, tag, clip: { parts, normal, at } }) or null
   */
  setInset(spec) {
    this.insetEl?.remove();
    this.inset = null;
    if (this._clipMats) for (const m of this._clipMats) { m.clippingPlanes = null; m.needsUpdate = true; }
    this._clipMats = null;
    this._caps?.forEach((c) => { c.removeFromParent(); c.material.dispose(); });
    this._caps = null;
    for (const o of this._soloed || []) o.layers.disable(3);
    this._soloed = null;
    if (!spec) return;
    if (spec.only) {
      // the inset shows only these parts (plus particles), so the close-up is not cluttered
      this._soloed = this.expand(spec.only).map((n) => this.get(n)).filter(Boolean);
      for (const o of this._soloed) o.layers.enable(3);
    }
    const el = document.createElement('div'); el.className = 'b3-inset';
    if (spec.tag) { const t = document.createElement('span'); t.className = 'b3-inset-tag'; t.textContent = spec.tag; el.append(t); }
    this.overlay.prepend(el);
    this.insetEl = el;
    this.inset = { spec, px: { x: 0, y: 0, w: 1, h: 1 } };
    const target = this.point(spec.at);
    const dir = new THREE.Vector3(...(spec.dir || [0, 0, 1])).normalize();
    this.insetCam.position.copy(target).addScaledVector(dir, spec.dist || 200);
    this.insetCam.up.set(0, 1, 0);
    this.insetCam.lookAt(target);
    if (spec.clip) {
      const n = new THREE.Vector3(...spec.clip.normal).normalize();
      this.insetClip = new THREE.Plane().setFromNormalAndCoplanarPoint(n, this.point(spec.clip.at || spec.at));
      this._clipMats = [];
      this._caps = [];
      for (const name of this.expand(spec.clip.parts)) {
        const m = this.meshes[name];
        if (!m) continue;
        m.material.clippingPlanes = [this.clipPlane];
        m.material.side = THREE.FrontSide;
        m.material.needsUpdate = true;
        this._clipMats.push(m.material);
        const cap = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: spec.clip.capColors?.[name] || m.userData.base, side: THREE.BackSide, clippingPlanes: [this.clipPlane] }));
        cap.layers.set(2);
        m.add(cap);
        this._caps.push(cap);
      }
    }
    this._layoutInset();
  }

  _layoutInset() {
    if (!this.inset) return;
    const r = this.inset.spec.rect || { x: 0.6, y: 0.13, w: 0.39, h: 0.5 };
    const W = this.W, H = this.H;
    let w = r.w * W, h = r.h * H;
    const side = Math.min(w, h * 1.25);
    w = side; h = Math.min(h, side / 1.0);
    const x = Math.min(W - w - 8, Math.max(8, r.x * W)), y = Math.min(H - h - 8, Math.max(8, r.y * H, (this.safe.top || 0)));
    this.inset.px = { x, y, w, h };
    Object.assign(this.insetEl.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    this.insetCam.aspect = w / h;
    this.insetCam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- particles and flows
  // Particles are small instanced glowing spheres (additive), kept at least a few pixels wide.
  _initParticles() {
    const N = 2400;
    this.pN = N;
    this.pMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.points = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), this.pMat, N);
    this.points.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.points.setColorAt(0, new THREE.Color());
    this.points.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.points.count = 0;
    this.points.renderOrder = 50;
    this.points.layers.enable(3);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /** A polyline from one or more route names (joined end to end) or raw point arrays. */
  path(spec) {
    const pts = [];
    for (const part of [].concat(spec)) {
      let arr = typeof part === 'string' ? (this.routes[part]?.pts || this.data.nerves[part]?.pts) : part;
      if (!arr) { console.warn('[body3d] no route', part); continue; }
      if (typeof part === 'string' && part.startsWith('-')) arr = [...(this.routes[part.slice(1)]?.pts || this.data.nerves[part.slice(1)]?.pts || [])].reverse();
      pts.push(...arr);
    }
    return new Polyline(pts);
  }

  /**
   * Send particles along a path. opts: { color, speed (mm/s), count, spacing (s), size (mm), delay (s), track (bool), trail }
   * Returns a promise that resolves when the last particle arrives (immediately in reduced motion).
   */
  flow(route, opts = {}) {
    const o = { color: C.hormone, speed: 260, count: 1, spacing: 0.35, size: 9, delay: 0, track: true, trail: 4, ...opts };
    const line = route instanceof Polyline ? route : this.path(route);
    if (!line.length) return Promise.resolve(true);
    const tok = this.token;
    if (o.track) this._addTrack(line, o.color, o.trackOpacity ?? 0.28);
    if (reducedMotion()) {
      this._staticDots(line, o);
      return Promise.resolve(this.token === tok);
    }
    return new Promise((resolve) => {
      this.flows.push({ line, o, start: this.time + o.delay, color: new THREE.Color(o.color), resolve, tok,
        end: this.time + o.delay + line.length / o.speed + (o.count - 1) * o.spacing });
    });
  }

  _addTrack(line, color, opacity) {
    const pts = line.p;
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, Math.min(500, Math.max(8, pts.length)), 0.8, 5, false);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: reducedMotion() ? Math.max(opacity, 0.34) : opacity, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPxWorld = { get value() { return mat.userData.px || 0.001; } };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uPxWorld;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float camD = distance(cameraPosition, (modelMatrix * vec4(transformed, 1.0)).xyz);
          transformed += normalize(normal) * max(0.0, 0.5 * 2.2 * uPxWorld * camD - 0.8);`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 40;
    this.scene.add(m);
    this.tracks.push(m);
  }

  _staticDots(line, o) {
    const n = Math.max(3, Math.min(18, Math.round(line.length / 70)));
    const pts = [];
    for (let i = 1; i <= n; i++) pts.push({ p: line.at((i / n) * line.length), a: 0.45 + 0.55 * (i / n), s: o.size * (0.7 + 0.5 * (i / n)) });
    this._static = (this._static || []).concat(pts.map((q) => ({ ...q, c: new THREE.Color(o.color), fixed: o.fixed })));
  }

  _updateParticles() {
    let n = 0;
    const tmp = new THREE.Vector3(), m4 = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const camPos = this.camera.position, px = this._pxWorld || 0.001;
    const put = (p, c, a, s, fixed) => {
      if (n >= this.pN) return;
      const minR = fixed ? 0 : 0.5 * 7 * px * camPos.distanceTo(p) * (s / 10);
      const r = Math.max(s / 2, minR);
      m4.compose(p, q, sc.set(r, r, r));
      this.points.setMatrixAt(n, m4);
      this.points.setColorAt(n, col.copy(c).multiplyScalar(a));
      n++;
    };
    const keep = [];
    for (const f of this.flows) {
      if (f.tok !== this.token) { f.resolve(false); continue; }
      const { line, o } = f;
      for (let i = 0; i < o.count; i++) {
        const t0 = f.start + i * o.spacing;
        const d = (this.time - t0) * o.speed;
        if (d < 0 || d > line.length + o.trail * 7) continue;
        for (let k = 0; k <= o.trail; k++) {
          const dk = d - k * o.size * 0.8;
          if (dk < 0 || dk > line.length) continue;
          put(line.at(dk, tmp), f.color, k === 0 ? 1 : 0.55 * (1 - k / (o.trail + 1)), k === 0 ? o.size : o.size * (1 - k / (o.trail + 2)), o.fixed);
        }
      }
      if (this.time >= f.end + o.trail * o.size * 0.8 / o.speed) f.resolve(true);
      else keep.push(f);
    }
    this.flows = keep;
    for (const q of this._static || []) put(q.p, q.c, q.a, q.s, q.fixed);
    this.points.count = n;
    this.points.instanceMatrix.needsUpdate = true;
    if (this.points.instanceColor) this.points.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- rhythmic motion (heart beat, breathing) - finite, paused by pause()
  rhythm(name, { rate = 70, amp = 0.03, axes = [1, 1, 1], duration = 12, kind = 'beat' } = {}) {
    const meshes = this.expand(name).map((n) => this.meshes[n]).filter(Boolean);
    for (const m of meshes) this.pulses[m.name] = { m, rate, amp, axes, kind, until: this.time + duration, c: new THREE.Vector3(...this.data.parts[m.name].center) };
  }

  stopRhythm() {
    for (const p of Object.values(this.pulses)) { p.m.scale.copy(p.m.userData.homeScale); p.m.position.copy(p.m.userData.homePos); }
    this.pulses = {};
  }

  _updateRhythm() {
    for (const [k, p] of Object.entries(this.pulses)) {
      let s = 0;
      if (!reducedMotion() && this.time < p.until) {
        const ph = (this.time * p.rate / 60) % 1;
        s = p.kind === 'breath' ? 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI)
          : (ph < 0.15 ? Math.sin(ph / 0.15 * Math.PI) : ph < 0.35 ? 0.45 * Math.sin((ph - 0.15) / 0.2 * Math.PI) : 0);
      }
      const f = 1 + p.amp * s;
      // scale about the organ's centre, on top of the node's own (dequantisation) transform:
      // world' = c + f (T + S q - c)  ->  position = c (1 - f) + f T, scale = f S
      const fv = new THREE.Vector3(1 + (f - 1) * p.axes[0], 1 + (f - 1) * p.axes[1], 1 + (f - 1) * p.axes[2]);
      const { homePos, homeScale } = p.m.userData;
      p.m.scale.copy(homeScale).multiply(fv);
      p.m.position.set(p.c.x * (1 - fv.x) + fv.x * homePos.x, p.c.y * (1 - fv.y) + fv.y * homePos.y, p.c.z * (1 - fv.z) + fv.z * homePos.z);
      if (this.time >= p.until) { p.m.scale.copy(homeScale); p.m.position.copy(homePos); delete this.pulses[k]; }
    }
  }

  // ---------------------------------------------------------------- sequencing helpers
  /** Cancel running flows/waits and start a new animation "token". */
  clearAnim() {
    this.token++;
    for (const f of this.flows) f.resolve(false);
    this.flows = [];
    for (const w of this.waiters) w.resolve(false);
    this.waiters = [];
    this._static = [];
    for (const t of this.tracks) { t.removeFromParent(); t.geometry.dispose(); t.material.dispose(); }
    this.tracks = [];
    this.stopRhythm();
    return this.token;
  }

  alive(tok) { return tok === this.token; }

  /** Wait in viewer time (pauses with the viewer). Resolves false if cancelled. */
  wait(seconds) {
    if (reducedMotion()) return Promise.resolve(true);
    return new Promise((resolve) => this.waiters.push({ at: this.time + seconds, resolve, tok: this.token }));
  }

  setPaused(p) { this.paused = p; }

  // ---------------------------------------------------------------- frame loop
  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.paused) this.time += dt;
    if (this._tween) {
      const tw = this._tween;
      tw.t = Math.min(1, tw.t + dt / 1.1);
      const k = easeInOut(tw.t);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      if (tw.t >= 1) this._tween = null;
    }
    this.controls.update();
    if (!this.data) { this.look.render(); return; }
    const H = this.H || 1;
    this._pxWorld = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / H;
    for (const t of this.tracks) t.material.userData.px = this._pxWorld;
    this.waiters = this.waiters.filter((w) => { if (w.tok !== this.token) { w.resolve(false); return false; } if (this.time >= w.at) { w.resolve(true); return false; } return true; });
    this._applyMaterials(dt);
    this._updateParticles();
    this._updateRhythm();
    // main view
    this.clipPlane.constant = 1e6;
    this.look.setCamera(this.camera);
    this.look.render();
    // inset view
    if (this.inset) {
      const r = this.renderer, { x, y, w, h } = this.inset.px;
      const pr = this.H;
      if (this.insetClip) this.clipPlane.copy(this.insetClip);
      this.insetCam.layers.set(this._soloed ? 3 : 0);
      if (this._caps?.length) this.insetCam.layers.enable(2);
      const skinVis = this.skin?.visible;
      r.setScissorTest(true);
      r.setViewport(x, pr - y - h, w, h);
      r.setScissor(x, pr - y - h, w, h);
      r.autoClear = true;
      r.render(this.scene, this.insetCam);
      r.setScissorTest(false);
      r.setViewport(0, 0, this.W, this.H);
      if (this.skin) this.skin.visible = skinVis;
      this.clipPlane.constant = 1e6;
    }
    this._layoutLabels();
  }

  dispose() {
    this.clearAnim();
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();
    this.controls.dispose();
    for (const o of [...Object.values(this.meshes || {})]) o.material.dispose();
    for (const o of Object.values(this.nerves || {})) { o.geometry.dispose(); o.material.dispose(); }
    this.skin?.material.dispose();
    this.points.geometry.dispose(); this.pMat.dispose();
    this.look.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}

// ------------------------------------------------------------------ shared control bar (real buttons, 44px+)
const BAR_CSS = `
.b3-bar { position:absolute; left:12px; bottom:12px; display:flex; flex-wrap:wrap; gap:8px; z-index:3; }
.b3-bar button { min-height:44px; min-width:44px; padding:0 14px; border-radius:12px; font: 700 15px/1 var(--font, system-ui); color:#EEF2FF;
  background: rgba(14,21,40,.88); border:1.5px solid rgba(220,230,255,.28); cursor:pointer; }
.b3-bar button:hover { background: rgba(32,44,78,.95); }
.b3-bar button:focus-visible { outline: 3px solid #FFD27A; outline-offset: 2px; }
.b3-bar button[aria-pressed="true"] { background:#F3F6FF; color:#0E1528; }
.b3-bar button[hidden] { display:none; }
`;
export function controlBar(parent, { onReplay, onReset, onPause, extra = [] } = {}) {
  if (!document.getElementById('b3-bar-css')) { const s = document.createElement('style'); s.id = 'b3-bar-css'; s.textContent = BAR_CSS; document.head.append(s); }
  const bar = document.createElement('div');
  bar.className = 'b3-bar';
  const mk = (txt, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; if (label) b.setAttribute('aria-label', label); b.addEventListener('click', fn); bar.append(b); return b; };
  const replay = mk('▶ Play again', 'Play the animation for this step again', () => onReplay?.());
  let paused = false;
  const pause = mk('❚❚ Pause', 'Pause the animation', () => {
    paused = !paused;
    pause.textContent = paused ? '▶ Resume' : '❚❚ Pause';
    pause.setAttribute('aria-label', paused ? 'Resume the animation' : 'Pause the animation');
    onPause?.(paused);
  });
  const reset = mk('⟲ Reset view', 'Turn the body back to the starting view', () => onReset?.());
  for (const e of extra) bar.append(e);
  parent.append(bar);
  return {
    bar, replay, pause, reset,
    setPaused(p) { paused = p; pause.textContent = p ? '▶ Resume' : '❚❚ Pause'; },
    showMotion(on) { replay.hidden = !on; pause.hidden = !on || reducedMotion(); },
  };
}

// ------------------------------------------------------------------ lesson stage: viewer + caption + bottom dock (+ optional left panel)
const STAGE_CSS = `
.b3-stage { position:absolute; inset:0; color:#F3F6FF; }
.b3-caption { position:absolute; top:12px; left:12px; right:12px; margin:0; pointer-events:none; z-index:3; }
.b3-caption > span { display:inline-block; max-width:min(720px, 100%); background:rgba(11,17,34,.9); color:#F3F6FF; font:700 17px/1.35 var(--font, system-ui);
  padding:8px 14px; border-radius:12px; border:1px solid rgba(220,230,255,.18); box-shadow:0 6px 18px rgba(0,0,0,.3); }
.b3-caption > span:empty { display:none; }
.b3-caption small { display:block; font-weight:500; font-size:15px; color:#C9D3EE; margin-top:2px; }
.b3-dock { position:absolute; left:12px; right:12px; bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; pointer-events:none; z-index:3; }
.b3-dock > * { pointer-events:auto; }
.b3-dock .b3-bar { position:static; }
.b3-left { position:absolute; left:12px; z-index:3; }
`;
export function bodyStage(container, { label = '3D model of the human body', panel = null } = {}) {
  if (!document.getElementById('b3-stage-css')) { const s = document.createElement('style'); s.id = 'b3-stage-css'; s.textContent = STAGE_CSS; document.head.append(s); }
  const root = document.createElement('div');
  root.className = 'b3-stage';
  container.append(root);
  const viewer = new BodyViewer(root, { label });
  const cap = document.createElement('p'); cap.className = 'b3-caption'; cap.setAttribute('aria-live', 'polite');
  const capText = document.createElement('span'); cap.append(capText);
  const dock = document.createElement('div'); dock.className = 'b3-dock';
  root.append(cap, dock);
  const handlers = { replay: null, pause: null };
  const bar = controlBar(dock, {
    onReplay: () => { viewer.setPaused(false); bar.setPaused(false); handlers.replay?.(); },
    onPause: (p) => viewer.setPaused(p),
    onReset: () => { viewer._userMoved = false; viewer.resetView(); },
  });
  let leftEl = null;
  // caption = step text + lesson note + automatic "drawn, not scanned" note for what is on show
  cap.text = ''; cap.note = ''; cap.extra = '';
  const renderCaption = () => {
    const drawn = viewer.drawn?.length ? `Drawn, not scanned: ${viewer.drawn.join(', ')}` : '';
    capText.textContent = cap.text;
    for (const n of [cap.note, drawn]) {
      if (!n) continue;
      const s = document.createElement('small'); s.textContent = n; capText.append(s);
    }
    const parts = [cap.text, cap.note, drawn, cap.extra].filter(Boolean).map((t) => t.replace(/[.\s]+$/, ''));
    viewer.renderer.domElement.setAttribute('aria-label', `3D body. ${parts.join('. ')}.`);
  };
  viewer.onState = () => renderCaption();
  const safe = () => {
    const H = root.clientHeight;
    const top = cap.offsetTop + cap.offsetHeight + 10;
    const bottom = H - dock.offsetTop + 10;
    let left = 0;
    if (leftEl && !leftEl.hidden && leftEl.offsetWidth) { leftEl.style.top = `${top}px`; leftEl.style.maxHeight = `${Math.max(120, dock.offsetTop - top - 10)}px`; left = leftEl.offsetWidth + 20; }
    const next = { top, bottom, left, right: 0, ...(stage.extraSafe || {}) };
    const prev = viewer.safe;
    if (['top', 'bottom', 'left', 'right'].every((k) => Math.abs((prev[k] || 0) - next[k]) < 4)) return;
    viewer.setSafe(next);
    if (viewer._lastFrame && !viewer._userMoved) viewer.frame(viewer._lastFrame, !viewer._tween);
  };
  const ro = new ResizeObserver(() => safe());
  ro.observe(cap); ro.observe(dock); ro.observe(root);
  const stage = {
    root, viewer, cap, dock, bar, handlers,
    setCaption(text, note) {
      cap.text = text; cap.note = note || '';
      renderCaption();
    },
    describe(extra) { cap.extra = extra || ''; renderCaption(); },
    setLeft(el) { leftEl = el; if (el) { el.classList.add('b3-left'); root.append(el); ro.observe(el); } safe(); },
    refreshSafe: safe,
    /** run a step script: cancels the previous one; fn(tok) gets the token */
    play(fn) {
      const tok = viewer.clearAnim();
      viewer.setPaused(false); bar.setPaused(false);
      return Promise.resolve().then(() => fn(tok)).catch((e) => console.error(e));
    },
    dispose() { ro.disconnect(); viewer.dispose(); root.remove(); },
  };
  if (panel) stage.setLeft(panel);
  return stage;
}
