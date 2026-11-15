// Reusable Three.js brain viewer, used by the hero, the explorer and the webcam x-ray mode.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STRUCTURES, byId, REGION_IDS } from '../data/structures.js';
import { reducedMotion } from '../settings.js';
import landmarks from '../data/landmarks.json';

const NODE_TO_STRUCTURE = {};
for (const s of STRUCTURES) for (const n of s.nodes || []) NODE_TO_STRUCTURE[n] = s.id;
const LOBE_IDS = ['frontal', 'parietal', 'temporal', 'occipital', 'insula', 'cingulate'];
const REAL_TISSUE = new THREE.Color('#E9C9C0');
const REGION_COLORS = REGION_IDS.map((id) => new THREE.Color(byId[id]?.color || '#ffffff'));

let gltfPromise = null;
function loadModel() {
  if (!gltfPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    gltfPromise = loader.loadAsync(`${import.meta.env.BASE_URL}models/brain.glb`);
  }
  return gltfPromise;
}

function cortexMaterial(baseColor, shared) {
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide, transparent: true });
  mat.userData.uniforms = shared;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 color;
        uniform float uHighlight; uniform vec3 uRegionColors[7]; uniform float uShowRegions;
        varying float vShade; varying vec3 vRegionColor; varying float vRegionOn; varying float vHL;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vShade = color.r;
        float rid = floor(color.g * 255.0 + 0.5);
        int ri = int(rid);
        vRegionColor = uRegionColors[ri];
        vRegionOn = rid > 0.5 ? 1.0 : 0.0;
        vHL = (uHighlight > 0.5 && abs(rid - uHighlight) < 0.5) ? 1.0 : 0.0;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uShowRegions; uniform float uTime; uniform float uRealMix; uniform vec3 uReal; uniform float uDimOthers; uniform float uPulse;
        varying float vShade; varying vec3 vRegionColor; varying float vRegionOn; varying float vHL;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        vec3 base = mix(diffuse, uReal, uRealMix);
        float shade = 0.52 + 0.48 * vShade;            // sulci darker, gyri lighter
        vec3 col = base * shade;
        float showR = uShowRegions * vRegionOn;
        col = mix(col, mix(col * 0.6, vRegionColor * (0.75 + 0.35 * vShade), 0.92), showR);
        float pulse = uPulse > 0.5 ? 0.82 + 0.18 * sin(uTime * 3.0) : 1.0;
        col = mix(col * (1.0 - 0.55 * uDimOthers), vRegionColor * (0.85 + 0.3 * vShade) * pulse, vHL);
        vec4 diffuseColor = vec4( col, opacity );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vRegionColor * 0.35 * vHL * uPulse;`);
  };
  mat.customProgramCacheKey = () => 'cortex-v1';
  return mat;
}

export class BrainViewer {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { controls: true, autoRotate: false, transparentBg: true, ...opts };
    this.listeners = {};
    this.selected = null;
    this.mode = 'lobes';
    this.explode = 0;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', opts.label || '3D model of a human brain');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    this.camera.position.set(330, 120, 330);

    const hemi = new THREE.HemisphereLight('#ffffff', '#3a3550', 1.4);
    const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(200, 300, 250);
    const rim = new THREE.DirectionalLight('#9db7ff', 1.3); rim.position.set(250, 80, -300);
    const fill = new THREE.DirectionalLight('#ffd9c7', 0.6); fill.position.set(200, -150, 200);
    this.scene.add(hemi, key, rim, fill);
    this.lights = { hemi, key, rim, fill };

    this.root = new THREE.Group();        // whole brain (translated so its centre is at the origin)
    this.scene.add(this.root);

    this.uniforms = {
      uHighlight: { value: 0 }, uRegionColors: { value: REGION_COLORS }, uShowRegions: { value: 0 },
      uTime: { value: 0 }, uRealMix: { value: 0 }, uReal: { value: REAL_TISSUE }, uDimOthers: { value: 0 }, uPulse: { value: 1 },
    };

    if (this.opts.controls) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 120;
      this.controls.maxDistance = 1000;
      this.controls.autoRotate = this.opts.autoRotate && !reducedMotion();
      this.controls.autoRotateSpeed = 0.6;
      this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this._tween = null; });
    }

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this._down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const moved = Math.hypot(e.clientX - this._down[0], e.clientY - this._down[1]);
      this._down = null;
      if (moved < 6) this._pick(e);
    });
    el.addEventListener('pointermove', (e) => this._hover(e));

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this._raf = this.renderer.setAnimationLoop(() => this._tick());
    this.ready = this._load();
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...a) { (this.listeners[evt] || []).forEach((fn) => fn(...a)); }

  async _load() {
    const gltf = await loadModel();
    const model = gltf.scene.clone(true);
    this.meshes = {};
    this.parts = {};      // structure id -> [mesh]
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.name || o.parent?.name;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (name === 'head_skin') {
        o.material = new THREE.MeshStandardMaterial({ color: '#F1C9B5', roughness: 0.7, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.FrontSide });
        o.visible = false; o.renderOrder = 2; this.head = o;
        return;
      }
      this.meshes[name] = o;
      if (name.startsWith('cortex_')) {
        const lobe = name.split('_')[2];
        const color = lobe === 'medialwall' ? '#B7A9A6' : (byId[lobe]?.color || '#cccccc');
        o.material = cortexMaterial(new THREE.Color(color), this.uniforms);
        o.userData.lobe = lobe;
        o.userData.hemi = name.split('_')[1];
        o.userData.structure = lobe === 'medialwall' ? null : lobe;
        if (lobe !== 'medialwall') box.expandByObject(o);
      } else {
        const sid = NODE_TO_STRUCTURE[name];
        const s = byId[sid];
        o.material = new THREE.MeshStandardMaterial({ color: s?.color || '#cccccc', roughness: 0.45, metalness: 0.0, transparent: true });
        o.userData.structure = sid;
        o.userData.hemi = name.endsWith('_left') ? 'left' : name.endsWith('_right') ? 'right' : 'mid';
      }
      o.userData.tract = /^(optic_|arcuate|lgn)/.test(name);
      o.userData.baseColor = o.material.color.clone();
      if (o.userData.structure) (this.parts[o.userData.structure] ||= []).push(o);
    });
    this._addPituitary(model);
    model.updateMatrixWorld(true);
    box.makeEmpty();
    for (const o of Object.values(this.meshes)) if (o.userData.lobe && o.userData.lobe !== 'medialwall') box.expandByObject(o);
    this.center = box.getCenter(new THREE.Vector3());
    this.size = box.getSize(new THREE.Vector3());
    model.position.sub(this.center);
    this.model = model;
    this.root.add(model);
    // explode directions
    this.root.updateMatrixWorld(true);
    for (const o of Object.values(this.meshes)) {
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); // model already re-centred
      const dir = c.clone();
      const name = o.name;
      let dist = 0;
      if (name.startsWith('cortex_')) {
        const side = o.userData.hemi === 'left' ? 1 : -1; // glTF +X = subject's left
        dir.y *= 0.6;
        dir.normalize();
        dir.x += side * 0.9;
        dir.normalize();
        dist = o.userData.lobe === 'insula' ? 55 : o.userData.lobe === 'cingulate' || o.userData.lobe === 'medialwall' ? 40 : 70;
      } else if (/cerebellum/.test(name)) { dir.set(o.userData.hemi === 'left' ? 0.3 : -0.3, -0.7, -0.65).normalize(); dist = 70; }
      else if (/brainstem|substantia/.test(name)) { dir.set(0, -1, 0); dist = 75; }
      else { dir.set(0, 0, 0); dist = 0; }
      o.userData.explodeDir = dir;
      o.userData.explodeDist = dist;
      o.userData.home = o.position.clone();
    }
    this.frame('default', true);
    this.applyMode();
    this.emit('ready');
    return this;
  }

  // The pituitary is outside the brain, so no brain atlas includes it. It is placed APPROXIMATELY:
  // below the hypothalamus and just behind the optic chiasm, joined by the pituitary stalk.
  _addPituitary(model) {
    const hyp = this.meshes.hypothalamus;
    if (!hyp) return;
    model.updateMatrixWorld(true);
    const inv = model.matrixWorld.clone().invert();
    const hb = new THREE.Box3().setFromObject(hyp);
    const chiasm = new THREE.Vector3(...landmarks.optic_chiasm_gltf_mm);
    const stalkTop = new THREE.Vector3(chiasm.x, hb.min.y + 1.5, chiasm.z - 5).applyMatrix4(inv);
    const centre = new THREE.Vector3(chiasm.x, chiasm.y - 13, chiasm.z - 4);
    const mat = new THREE.MeshStandardMaterial({ color: byId.pituitary?.color || '#E07A5F', roughness: 0.45, transparent: true });
    const gland = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
    gland.scale.set(6.5, 3.5, 5);      // roughly 13 mm wide, 7 mm tall, 10 mm front-to-back
    gland.position.copy(centre);
    gland.name = 'pituitary';
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(stalkTop, centre.clone().add(new THREE.Vector3(0, 2.5, 0))), 4, 1.2, 10), mat);
    stalk.name = 'pituitary_stalk';
    for (const m of [gland, stalk]) {
      model.add(m); this.meshes[m.name] = m;
      Object.assign(m.userData, { structure: 'pituitary', approx: true, hemi: 'mid', tract: false, baseColor: mat.color.clone() });
      (this.parts.pituitary ||= []).push(m);
    }
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------- appearance
  setMode(mode) { this.mode = mode; this.applyMode(); }
  setReal(real) { this.real = real; this.applyMode(); }

  applyMode() {
    if (!this.meshes) return;
    const sel = this.selected ? byId[this.selected] : null;
    this.uniforms.uShowRegions.value = this.mode === 'functions' && !sel?.region ? 1 : 0;
    this.uniforms.uHighlight.value = sel?.region || 0;
    this.uniforms.uDimOthers.value = sel?.region ? 1 : 0;
    this.uniforms.uRealMix.value = this.real || this.mode === 'functions' ? 1 : 0;
    for (const o of Object.values(this.meshes)) {
      const sid = o.userData.structure;
      const isCortex = o.name.startsWith('cortex_');
      const isSel = sel && (sid === sel.id);
      let opacity = 1, visible = true;
      if (this.xray && isCortex) opacity = 0.16;
      if (this.hideHemi && isCortex && o.userData.hemi === this.hideHemi) visible = false;
      if (sel && !sel.region) {
        if (isSel) opacity = 1;
        else if (isCortex) opacity = sel.group === 'lobes' ? 0.25 : 0.12;
        else opacity = 0.3;
      }
      if (this.showPaths && !isCortex && !sel) opacity = /optic|lgn/.test(o.name) ? 0.45 : 0.12;
      if (o.userData.tract) {
        const isOptic = /optic|lgn/.test(o.name);
        const showTract = isSel || (isOptic && (this.showPaths || sel?.group === 'vision'));
        visible = visible && !!showTract;
      }
      o.visible = visible;
      o.material.opacity = opacity;
      o.material.depthWrite = opacity > 0.99;
      o.renderOrder = opacity > 0.99 ? 0 : 1;
      if (!isCortex) {
        const c = o.userData.baseColor.clone();
        if (this.real) c.lerp(new THREE.Color('#D8B4A8'), 0.35);
        o.material.color.copy(c);
        o.material.emissive?.set(isSel ? o.userData.baseColor : '#000000');
        o.material.emissiveIntensity = isSel ? 0.35 : 0;
      }
    }
  }

  setXray(on) { this.xray = on; this.applyMode(); }
  setHead(on) { if (this.head) this.head.visible = on; }
  setShowPaths(on) { this.showPaths = on; this.applyMode(); }
  setHideHemisphere(h) { this.hideHemi = h; this.applyMode(); }

  setExplode(t) {
    this.explode = t;
    if (!this.meshes) return;
    for (const o of Object.values(this.meshes)) {
      o.position.copy(o.userData.home).addScaledVector(o.userData.explodeDir, o.userData.explodeDist * t);
    }
  }

  select(id, { fly = true } = {}) {
    this.selected = id;
    this.applyMode();
    if (id && fly) this.focusOn(id);
    this.emit('select', id);
  }

  // --------------------------------------------------------------- camera
  frame(view = 'default', instant = false, dist = 480) {
    const views = {
      default: [1, 0.35, 1], left: [1, 0.05, 0], right: [-1, 0.05, 0], front: [0, 0.1, 1], back: [0, 0.15, -1],
      top: [0.0001, 1, 0.05], bottom: [0.0001, -1, 0.05], inside: [-1, 0.1, 0.0],
      topFront: [0, 1, -0.12], frontHigh: [0, 0.55, 1],
    };
    const d = new THREE.Vector3(...(views[view] || views.default)).normalize();
    if (this.camera.aspect < 1) dist /= Math.pow(this.camera.aspect, 0.85); // narrow screens: step back so the brain fits
    this._flyTo(new THREE.Vector3(0, 0, 0), d.multiplyScalar(dist), instant);
  }

  focusOn(id) {
    const meshes = this.parts?.[id];
    const s = byId[id];
    if (s?.region) {
      // functional regions live on the cortex: pick a view that shows them best
      const v = { motor: [0.6, 0.8, 0.15], somatosensory: [0.6, 0.8, -0.2], visual: [-0.3, 0.2, -1], auditory: [1, 0.5, -0.05], broca: [1, 0.1, 0.5], wernicke: [1, 0.15, -0.25] }[id];
      this._flyTo(new THREE.Vector3(), new THREE.Vector3(...v).normalize().multiplyScalar(440 * (this.camera.aspect < 1 ? 1 / Math.pow(this.camera.aspect, 0.85) : 1)));
      return;
    }
    if (!meshes?.length) return;
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    const c = box.getCenter(new THREE.Vector3());
    const dir = this.camera.position.clone().sub(this.controls?.target || new THREE.Vector3()).normalize();
    const deep = ['deep', 'vision'].includes(s.group) || id === 'substantia_nigra';
    const narrow = this.camera.aspect < 1 ? 1 / Math.pow(this.camera.aspect, 0.85) : 1;
    this._flyTo(c, dir.multiplyScalar((deep ? 330 : 440) * narrow));
  }

  _flyTo(target, offset, instant = false) {
    const toPos = target.clone().add(offset);
    if (instant || reducedMotion() || !this.controls) {
      this.camera.position.copy(toPos);
      this.controls?.target.copy(target);
      this.camera.lookAt(target);
      this._tween = null;
      return;
    }
    this._tween = { t: 0, fromPos: this.camera.position.clone(), toPos, fromT: this.controls.target.clone(), toT: target.clone() };
  }

  orbit(dx, dy) {
    if (!this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += dx; sph.phi = THREE.MathUtils.clamp(sph.phi + dy, 0.05, Math.PI - 0.05);
    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  zoom(f) {
    if (!this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f);
    const len = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(len));
  }

  // --------------------------------------------------------------- picking
  _intersect(e) {
    if (!this.model) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (this.opts.mirrored) this.pointer.x *= -1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.model, true).filter((h) => h.object.visible && h.object !== this.head && h.object.material.opacity > 0.2);
    if (!hits.length) return null;
    const h = hits[0];
    let id = h.object.userData.structure;
    if (h.object.name.startsWith('cortex_') && this.mode === 'functions' && h.face) {
      const col = h.object.geometry.attributes.color;
      const rid = [h.face.a, h.face.b, h.face.c].map((i) => Math.round(col.getY(i) * (col.normalized ? 255 : 1)));
      const best = rid.sort((a, b) => rid.filter((x) => x === b).length - rid.filter((x) => x === a).length)[0];
      if (best > 0) id = REGION_IDS[best];
    }
    return { id, point: h.point };
  }

  _pick(e) {
    const hit = this._intersect(e);
    if (!hit) { this.select(null, { fly: false }); return; }
    this.select(hit.id === this.selected ? null : hit.id, { fly: false });
  }

  _hover(e) {
    if (e.buttons) return;
    const hit = this._intersect(e);
    this.renderer.domElement.style.cursor = hit?.id ? 'pointer' : 'grab';
    this.emit('hover', hit?.id || null, e);
  }

  // project any world-space point to container pixels (null if behind the camera)
  project(p) {
    const v = p.clone().project(this.camera);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * this.container.clientWidth;
    return { x: this.opts.mirrored ? this.container.clientWidth - x : x, y: (1 - v.y) / 2 * this.container.clientHeight };
  }

  // project a structure's centre to screen for an HTML label
  screenPos(id) {
    const s = byId[id];
    let p;
    if (s?.region) {
      // average of region vertices on the left hemisphere (or right if left has none)
      p = this._regionCentre(s.region);
    } else {
      const meshes = this.parts?.[id];
      if (!meshes?.length) return null;
      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
      p = box.getCenter(new THREE.Vector3());
      p.y = box.max.y - (box.max.y - p.y) * 0.3;
    }
    if (!p) return null;
    const v = p.clone().project(this.camera);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * this.container.clientWidth;
    return { x: this.opts.mirrored ? this.container.clientWidth - x : x, y: (1 - v.y) / 2 * this.container.clientHeight };
  }

  _regionCentre(rid) { return this.regionCentreHemi(rid, null); }

  // centre of a painted cortical region, in world space. hemi: 'left' | 'right' | null (left first, then right)
  regionCentreHemi(rid, only) {
    this._rc ||= {};
    const key = `${rid}-${only}`;
    if (this._rc[key]) return this._rc[key].clone().applyMatrix4(this.model.matrixWorld);
    const acc = new THREE.Vector3(); let n = 0; const v = new THREE.Vector3();
    this.model.updateMatrixWorld(true);
    const inv = this.model.matrixWorld.clone().invert();
    for (const hemi of only ? [only] : ['left', 'right']) {
      for (const o of Object.values(this.meshes)) {
        if (!o.name.startsWith(`cortex_${hemi}`)) continue;
        const col = o.geometry.attributes.color, pos = o.geometry.attributes.position;
        for (let i = 0; i < col.count; i++) {
          if (Math.round(col.getY(i) * (col.normalized ? 255 : 1)) === rid) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); acc.add(v); n++; }
        }
      }
      if (n) break;
    }
    if (!n) return null;
    this._rc[key] = acc.divideScalar(n);
    return this._rc[key].clone().applyMatrix4(this.model.matrixWorld);
  }

  _tick() {
    const dt = this.clock.getDelta();
    this.uniforms.uTime.value += dt;
    this.uniforms.uPulse.value = reducedMotion() ? 0 : 1;
    if (this._tween) {
      const tw = this._tween;
      tw.t = Math.min(1, tw.t + dt / 0.9);
      const k = 1 - Math.pow(1 - tw.t, 3);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      if (tw.t >= 1) this._tween = null;
    }
    if (this._explodeTarget != null) {
      const t = this.explode + (this._explodeTarget - this.explode) * Math.min(1, dt * 6);
      this.setExplode(Math.abs(t - this._explodeTarget) < 0.002 ? this._explodeTarget : t);
      if (this.explode === this._explodeTarget) this._explodeTarget = null;
    }
    this.controls?.update();
    this.emit('frame', dt);
    this.renderer.render(this.scene, this.camera);
  }

  animateExplode(t) { if (reducedMotion()) this.setExplode(t); else this._explodeTarget = t; }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this._ro.disconnect();
    this.controls?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
