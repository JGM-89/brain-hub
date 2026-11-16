// A small, self-contained 3D scene for procedural neuron networks (clearly a MODEL, not data):
// glowing somas with short dendrites, axon-like links whose thickness and glow show connection
// strength, synaptic boutons, travelling signal pulses, growth (sprouting) by draw range,
// blood vessels and soft "halo" shells. Uses the shared cinematic look.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, studioLights } from './look.js';
import { reducedMotion } from '../settings.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Tube whose radius is a uniform (built at radius 1; vertices pushed along their radial normal).
function radiusMaterial(params) {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4, transparent: true, ...params });
  const uR = { value: 1 };
  mat.userData.uR = uR;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uR = uR;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uR;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normal * (uR - 1.0);');
  };
  mat.customProgramCacheKey = () => 'bx-radius-tube';
  return mat;
}

function taperTube(curve, segs, r0, r1, radial = 6) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position, p = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

export class NetScene {
  constructor(container, { label = '3D model of connected neurons' } = {}) {
    this.container = container;
    this.listeners = {};
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', label);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 1, 3000);
    this.camera.position.set(0, 30, 300);
    this.camera.add(studioLights(1.2));
    this.scene.add(this.camera);
    this.look = createLook(this.renderer, this.scene, this.camera, { bloom: 0.55, envIntensity: 0.35 });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 120, maxDistance: 520 });
    this.controls.addEventListener('start', () => { this._tween = null; });
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.clock = new THREE.Clock();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this.running = false;
    this.setRunning(true);
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.look.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setRunning(on) {
    if (this.running === on) return;
    this.running = on;
    this.renderer.setAnimationLoop(on ? () => this._tick() : null);
    if (on) this.clock.getDelta();
  }
  restart() { this.renderer.setAnimationLoop(null); this.renderer.setAnimationLoop(() => this._tick()); }
  /** world point -> container pixels */
  project(p) {
    const v = p.clone().project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * this.container.clientWidth, y: (1 - v.y) / 2 * this.container.clientHeight };
  }
  view(target, dir, dist, instant = false) {
    let d = dist;
    const a = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
    if (a < 1) d /= Math.pow(a, 0.9);
    const to = target.clone().add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
    if (instant || reducedMotion()) { this.camera.position.copy(to); this.controls.target.copy(target); this._tween = null; return; }
    this._tween = { t: 0, fp: this.camera.position.clone(), tp: to, ft: this.controls.target.clone(), tt: target.clone() };
  }
  _tick() {
    const dt = Math.min(0.1, this.clock.getDelta());
    if (this._tween) {
      const tw = this._tween; tw.t = Math.min(1, tw.t + dt / 0.9); const k = 1 - (1 - tw.t) ** 3;
      this.camera.position.lerpVectors(tw.fp, tw.tp, k); this.controls.target.lerpVectors(tw.ft, tw.tt, k);
      if (tw.t >= 1) this._tween = null;
    }
    this.controls.update();
    (this.listeners.frame || []).forEach((fn) => fn(dt));
    this.look.render();
  }
  clear() {
    this.root.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); if (!o.userData.sharedMat) o.material?.dispose(); } });
    this.root.clear();
  }
  dispose() {
    this.setRunning(false);
    this._ro.disconnect();
    this.clear();
    this.controls.dispose();
    this.look.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ------------------------------------------------------------ building blocks
  /** A neuron: soma + nucleus glow + short tapered dendrites. */
  neuron(pos, { radius = 6, seed = 1, color = '#4C8EE6', parent = this.root } = {}) {
    const r = rng(seed);
    const g = new THREE.Group(); g.position.copy(pos);
    const geo = new THREE.IcosahedronGeometry(radius, 4);
    const pa = geo.attributes.position, v = new THREE.Vector3();
    const ph = [r() * 6, r() * 6, r() * 6];
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      const n = v.clone().normalize();
      const k = 1 + 0.12 * Math.sin(n.x * 3 + ph[0]) * Math.sin(n.y * 3 + ph[1]) + 0.08 * Math.sin(n.z * 4 + ph[2]);
      v.multiplyScalar(k); pa.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const somaMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.5, sheenColor: new THREE.Color('#cfe8ff'), transparent: true, opacity: 0.82, depthWrite: false, emissive: new THREE.Color(color), emissiveIntensity: 0.18 });
    const soma = new THREE.Mesh(geo, somaMat);
    soma.renderOrder = 2;
    const coreMat = new THREE.MeshBasicMaterial({ color: '#D8F0FF', transparent: true, opacity: 0.95 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.42, 16, 12), coreMat);
    core.renderOrder = 1;
    g.add(soma, core);
    const dendMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, transparent: true, emissive: new THREE.Color(color), emissiveIntensity: 0.08 });
    const nd = 4 + Math.floor(r() * 3);
    for (let i = 0; i < nd; i++) {
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const len = radius * (2.0 + r() * 1.6);
      const bend = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(radius * 1.1);
      const c = new THREE.CatmullRomCurve3([dir.clone().multiplyScalar(radius * 0.8), dir.clone().multiplyScalar(radius * 0.8 + len * 0.55).add(bend), dir.clone().multiplyScalar(radius * 0.8 + len).add(bend.clone().multiplyScalar(1.6))]);
      g.add(new THREE.Mesh(taperTube(c, 16, radius * 0.16, radius * 0.03, 6), dendMat));
    }
    parent.add(g);
    const api = {
      group: g, soma, core, radius, pos: g.position,
      setColor(c) { somaMat.color.set(c); somaMat.emissive.set(c); dendMat.color.set(c); dendMat.emissive.set(c); },
      setActive(a) { coreMat.color.set(a > 0.5 ? '#FFE7A3' : '#D8F0FF'); somaMat.emissiveIntensity = 0.18 + 0.6 * a; },
      setOpacity(o) { somaMat.opacity = 0.82 * o; dendMat.opacity = o; coreMat.opacity = 0.95 * o; dendMat.depthWrite = o > 0.95; },
      setDead(d) { // damaged neuron: shrunken, dark, no glow
        somaMat.color.set(d ? '#5A3A44' : color); somaMat.emissive.set(d ? '#000000' : color);
        dendMat.color.set(d ? '#4A3038' : color); dendMat.emissive.set(d ? '#000000' : color);
        coreMat.opacity = d ? 0.12 : 0.95; coreMat.color.set(d ? '#7A4A50' : '#D8F0FF'); g.scale.setScalar(d ? 0.82 : 1);
      },
    };
    return api;
  }

  /** A connection from neuron a to neuron b (axon-like tube + synaptic bouton). */
  link(a, b, { seed = 1, bend = 0.25, color = '#7FA0D8', parent = this.root, segs = 64 } = {}) {
    const r = rng(seed);
    const pa = a.pos.clone(), pb = b.pos.clone();
    const dir = pb.clone().sub(pa).normalize();
    const start = pa.clone().addScaledVector(dir, a.radius * 0.95);
    const end = pb.clone().addScaledVector(dir, -(b.radius * 1.05 + 1.2));
    const perp = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(dir).normalize();
    const mid = start.clone().lerp(end, 0.5).addScaledVector(perp, start.distanceTo(end) * bend);
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const geo = new THREE.TubeGeometry(curve, segs, 1, 8, false);
    const mat = radiusMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.2 });
    const tube = new THREE.Mesh(geo, mat);
    const bMat = new THREE.MeshPhysicalMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.3, roughness: 0.3, transparent: true });
    const bouton = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), bMat);
    bouton.position.copy(end);
    parent.add(tube, bouton);
    const total = geo.index.count;
    const api = {
      curve, tube, bouton, a, b,
      radius: 1,
      setRadius(rad) { api.radius = rad; mat.userData.uR.value = rad; bouton.scale.setScalar(Math.max(0.6, rad * 1.5)); },
      setColor(c, glow = 0.2) { mat.color.set(c); mat.emissive.set(c); mat.emissiveIntensity = glow; bMat.color.set(c); bMat.emissive.set(c); bMat.emissiveIntensity = glow + 0.15; },
      setOpacity(o) { mat.opacity = o; bMat.opacity = o; mat.depthWrite = bMat.depthWrite = o > 0.95; tube.visible = bouton.visible = o > 0.01; },
      /** 0..1: how much of the link exists (sprouting / severed) */
      setGrow(p) { geo.setDrawRange(0, Math.max(0, Math.floor((total / 6) * p)) * 6); bouton.visible = p >= 0.999 && mat.opacity > 0.01; },
    };
    api.setRadius(1);
    return api;
  }

  /** a blood vessel (thick red tube) along points; growable */
  vessel(points, { radius = 3, color = '#C8414F', parent = this.root } = {}) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 80, radius, 12, false);
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ffc0c8'), emissive: new THREE.Color(color), emissiveIntensity: 0.12 });
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    const total = geo.index.count;
    return { mesh: m, curve, setGrow(p) { geo.setDrawRange(0, Math.floor((total / 6) * p) * 6); m.visible = p > 0.001; } };
  }

  /** soft glowing shell around a neuron (e.g. super-sensitivity) */
  halo(neuron, { color = '#FFC965', parent = this.root } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
    const m = new THREE.Mesh(new THREE.SphereGeometry(neuron.radius * 2.1, 32, 20), mat);
    m.position.copy(neuron.pos);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(neuron.radius * 2.0, 0.45, 8, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
    ring.position.copy(neuron.pos);
    parent.add(m, ring);
    return {
      mesh: m, ring,
      set(o, pulse = 0, camera = null) { mat.opacity = 0.22 * o * (1 + 0.35 * pulse); ring.material.opacity = 0.85 * o; const s = 1 + 0.06 * pulse; m.scale.setScalar(s); ring.scale.setScalar(s); if (camera) ring.lookAt(camera.position); },
    };
  }

  /** a glowing dot used for travelling signals */
  pulseDot(color = '#FFD27A', radius = 2.4) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.visible = false;
    this.root.add(m);
    return m;
  }
}
