// A small reusable 3D "stage" for lesson visuals: renderer + camera + orbit controls + the shared
// cinematic look (look.js), resize handling, render-on-demand, camera fly-to/fit, and an HTML label
// layer whose leader lines are anchored to 3D points. Used by the neurons and synapse lessons.
//
//   const stage = createStage(container, { label: 'A 3D neuron' });
//   stage.root.add(mesh);
//   stage.fit(box, { dir: new THREE.Vector3(0, 0, 1) });
//   stage.labels.set([{ key: 'soma', text: 'Cell body', at: () => vec3, side: 'right' }]);
//   stage.onFrame((dt, t) => { ...; return stillAnimating; });
//   stage.dispose();
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLook, studioLights } from './look.js';
import { reducedMotion } from '../settings.js';

const CSS = `
.s3d-host { position: absolute; inset: 0; overflow: hidden; }
.s3d-host canvas { display: block; width: 100% !important; height: 100% !important; touch-action: none; outline: none; }
.s3d-host canvas:focus-visible { outline: 3px solid #FFD36B; outline-offset: -3px; }
.s3d-labels { position: absolute; inset: 0; pointer-events: none; }
.s3d-labels svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.s3d-label { position: absolute; left: 0; top: 0; max-width: min(300px, 46%); padding: 7px 12px 8px; border-radius: 12px;
  background: rgb(9 14 28 / 92%); border: 1.5px solid rgb(255 255 255 / 22%); color: #F4F6FB; font-weight: 700;
  font-size: 16px; line-height: 1.25; box-shadow: 0 6px 18px rgb(0 0 0 / 35%); opacity: 0; transition: opacity .35s ease;
  will-change: transform; }
.s3d-label.on { opacity: 1; }
.s3d-label .sub { display: block; font-weight: 400; font-size: 15px; opacity: .88; margin-top: 2px; }
.s3d-label.drawn { border-style: dashed; }
.s3d-label .tag { display: block; font-size: 15px; font-weight: 700; color: #FFD9A0; margin-top: 3px; }
.s3d-label.plain { background: none; border: 0; box-shadow: none; padding: 2px 4px; font-size: 15px; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
`;

let cssAdded = false;
function addCss() {
  if (cssAdded) return;
  const st = document.createElement('style'); st.textContent = CSS; st.dataset.s3d = '';
  document.head.append(st); cssAdded = true;
}

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/**
 * @param {HTMLElement} container element with a size (position: relative)
 * @param {{fov?:number, label?:string, bloom?:number, envIntensity?:number, minDistance?:number, maxDistance?:number,
 *          safeTop?:()=>number, safeBottom?:()=>number}} opts
 */
export function createStage(container, opts = {}) {
  addCss();
  const o = { fov: 32, bloom: 0.5, envIntensity: 0.32, label: '3D model', ...opts };
  const host = document.createElement('div'); host.className = 's3d-host';
  container.append(host);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', o.label);
  canvas.tabIndex = 0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);
  const lights = studioLights(1);
  camera.add(lights);
  scene.add(camera);
  const look = createLook(renderer, scene, camera, { bloom: o.bloom, envIntensity: o.envIntensity });
  const root = new THREE.Group();
  scene.add(root);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.9;
  // keyboard: arrow keys turn the model, + and − zoom (when the canvas has focus)
  canvas.addEventListener('keydown', (e) => {
    const off = camera.position.clone().sub(controls.target);
    const step = Math.PI / 18;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') off.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.key === 'ArrowLeft' ? -step : step);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const right = new THREE.Vector3().crossVectors(camera.up, off).normalize();
      const next = off.clone().applyAxisAngle(right, e.key === 'ArrowUp' ? step : -step);
      if (Math.abs(next.clone().normalize().y) < 0.97) off.copy(next);
    } else if (e.key === '+' || e.key === '=') off.multiplyScalar(0.88);
    else if (e.key === '-' || e.key === '_') off.multiplyScalar(1.13);
    else return;
    e.preventDefault();
    tween = null; userMoved = true; interactListeners.forEach((fn) => fn());
    camera.position.copy(controls.target).add(off);
    dirty = true;
  });
  let userMoved = false;
  const interactListeners = new Set();
  controls.addEventListener('start', () => { tween = null; userMoved = true; interactListeners.forEach((fn) => fn()); });
  controls.addEventListener('change', () => { dirty = true; });

  // ---------------------------------------------------------------- labels
  const labels = createLabels(host, camera, o);

  // ---------------------------------------------------------------- size
  let W = 1, H = 1;
  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    look.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    labels.resize(W, H);
    if (lastFit && !userMoved) fit(lastFit.box, { ...lastFit.opts, instant: true });
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---------------------------------------------------------------- camera moves
  let tween = null;
  let lastFit = null;
  function flyTo(position, target, { duration = 1.1, instant = false } = {}) {
    const fast = instant || reducedMotion();
    if (fast) {
      camera.position.copy(position); controls.target.copy(target); controls.update(); tween = null; dirty = true; return;
    }
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: position.clone(), t1: target.clone(), u: 0, dur: duration };
  }
  /** Fit a Box3 (world coords) in view. dir = direction from target to camera. */
  function fit(box, opts2 = {}) {
    const { dir = new THREE.Vector3(0, 0.15, 1), padding = 1.12, shift = [0, 0] } = opts2;
    lastFit = { box: box.clone(), opts: opts2 };
    if (!opts2.keepUserFlag) userMoved = false;
    const center = box.getCenter(new THREE.Vector3());
    const d = dir.clone().normalize();
    // project the box extents onto the camera's screen axes
    const up = Math.abs(d.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, d).normalize();
    const camUp = new THREE.Vector3().crossVectors(d, right).normalize();
    let hw = 0, hh = 0, hd = 0;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3((i & 1) ? box.max.x : box.min.x, (i & 2) ? box.max.y : box.min.y, (i & 4) ? box.max.z : box.min.z).sub(center);
      hw = Math.max(hw, Math.abs(c.dot(right))); hh = Math.max(hh, Math.abs(c.dot(camUp))); hd = Math.max(hd, Math.abs(c.dot(d)));
    }
    const vfov = (camera.fov * Math.PI) / 180;
    const aspect = W / H;
    const usableH = 1 - (labels.safeTop() + labels.safeBottom()) / H;   // keep the subject clear of buttons + caption
    const distH = (hh * padding) / Math.tan(vfov / 2) / Math.max(0.5, usableH);
    const distW = (hw * padding) / (Math.tan(vfov / 2) * aspect);
    const dist = Math.max(distH, distW) + hd;
    // move the target so the subject sits in the middle of the usable area
    const vShift = ((labels.safeTop() - labels.safeBottom()) / 2 / H) * 2 * Math.tan(vfov / 2) * (dist - hd);
    const target = center.clone().addScaledVector(camUp, vShift).addScaledVector(right, shift[0] * hw).addScaledVector(camUp, shift[1] * hh);
    const pos = target.clone().addScaledVector(d, dist);
    camera.near = Math.max(dist / 200, (dist - hd * 3) / 20);
    camera.far = dist * 6 + hd * 4;
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.18;
    controls.maxDistance = dist * 3;
    flyTo(pos, target, opts2);
  }

  // ---------------------------------------------------------------- loop
  const frameFns = new Set();
  let dirty = true;
  let last = performance.now();
  let time = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    let active = false;
    for (const fn of frameFns) if (fn(dt, time)) active = true;
    if (tween) {
      tween.u = Math.min(1, tween.u + dt / tween.dur);
      const k = ease(tween.u);
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.u >= 1) tween = null;
      active = true;
    }
    if (controls.update()) active = true;
    if (active || dirty) {
      look.render();
      labels.update();
      dirty = false;
    }
  }
  renderer.setAnimationLoop(tick);
  resize();

  return {
    renderer, scene, camera, controls, root, look, labels, canvas, host,
    get size() { return { w: W, h: H }; },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onInteract(fn) { interactListeners.add(fn); return () => interactListeners.delete(fn); },
    get userMoved() { return userMoved; },
    requestRender() { dirty = true; },
    setLabel(text) { canvas.setAttribute('aria-label', text); },
    fit, flyTo,
    /** Ambient occlusion: off, or on with a radius in world units suited to this scene. */
    setAO(on, params) {
      look.setAO(!!on);
      const gtao = look.composer?.passes.find((p) => p.isGTAOPass || p.constructor?.name === 'GTAOPass' || p.gtaoMaterial);
      if (on && gtao && params) gtao.updateGtaoMaterial({ distanceExponent: 1.4, scale: 1.0, samples: 12, ...params });
      dirty = true;
    },
    refit() { if (lastFit) fit(lastFit.box, { ...lastFit.opts }); },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      labels.dispose();
      look.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const m = obj.material; if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.remove();
    },
  };
}

// ------------------------------------------------------------------ HTML label layer
function createLabels(host, camera, o) {
  const layer = document.createElement('div'); layer.className = 's3d-labels'; layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.append(svg); host.append(layer);
  let W = 1, H = 1;
  let items = [];
  const v = new THREE.Vector3();

  function make(spec) {
    const el = document.createElement('div');
    el.className = `s3d-label${spec.drawn ? ' drawn' : ''}${spec.plain ? ' plain' : ''}`;
    el.innerHTML = `${spec.text}${spec.sub ? `<span class="sub">${spec.sub}</span>` : ''}${spec.tag ? `<span class="tag">${spec.tag}</span>` : ''}`;
    if (spec.color) el.style.borderColor = spec.color;
    layer.append(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', spec.color || 'rgba(255,255,255,0.85)'); line.setAttribute('stroke-width', '2');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4.5'); dot.setAttribute('fill', spec.color || '#fff'); dot.setAttribute('stroke', '#0A0F1E'); dot.setAttribute('stroke-width', '2');
    const halo = line.cloneNode(); halo.setAttribute('stroke', 'rgba(5,8,18,0.75)'); halo.setAttribute('stroke-width', '5');
    svg.append(halo, line, dot);
    requestAnimationFrame(() => el.classList.add('on'));
    return { spec, el, line, halo, dot, w: 0, h: 0 };
  }
  function safeTop() { return typeof o.safeTop === 'function' ? o.safeTop() : 64; }
  function safeBottom() { return typeof o.safeBottom === 'function' ? o.safeBottom() : 64; }

  return {
    safeTop, safeBottom,
    resize(w, h) { W = w; H = h; items.forEach((it) => { it.w = 0; }); },
    /** list: [{key, text, sub?, tag?, at: Vector3 | () => Vector3, side?: 'right'|'left'|'top'|'bottom', dist?: px, color?, drawn?, plain?, line?: false}] */
    set(list = []) {
      const keep = new Map(items.map((it) => [it.spec.key + '|' + it.spec.text + '|' + (it.spec.sub || '') + '|' + (it.spec.tag || ''), it]));
      const next = [];
      for (const spec of list) {
        const k = spec.key + '|' + spec.text + '|' + (spec.sub || '') + '|' + (spec.tag || '');
        if (keep.has(k)) { const it = keep.get(k); it.spec = spec; next.push(it); keep.delete(k); } else next.push(make(spec));
      }
      keep.forEach((it) => { it.el.remove(); it.line.remove(); it.halo.remove(); it.dot.remove(); });
      items = next;
    },
    update() {
      const top = safeTop() + 6, bottom = H - safeBottom() - 6;
      const placed = [];
      for (const it of items) {
        const s = it.spec;
        const p = typeof s.at === 'function' ? s.at() : s.at;
        if (!p) { it.el.style.visibility = 'hidden'; continue; }
        v.copy(p).project(camera);
        const ax0 = (v.x * 0.5 + 0.5) * W, ay0 = (-v.y * 0.5 + 0.5) * H;
        const behind = v.z > 1 || ax0 < -4 || ax0 > W + 4 || ay0 < -4 || ay0 > H + 4;
        const ax = (v.x * 0.5 + 0.5) * W, ay = (-v.y * 0.5 + 0.5) * H;
        if (!it.w) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
        const d = s.dist ?? 70;
        let side = s.side || 'auto';
        if (side === 'auto') side = ax > W * 0.55 ? 'left' : 'right';
        let x, y;
        if (side === 'right') { x = ax + d; y = ay - it.h / 2 - d * 0.35; }
        else if (side === 'left') { x = ax - d - it.w; y = ay - it.h / 2 - d * 0.35; }
        else if (side === 'top') { x = ax - it.w / 2; y = ay - d - it.h; }
        else if (side === 'bottom') { x = ax - it.w / 2; y = ay + d; }
        else { x = ax - it.w / 2; y = ay - it.h / 2; }   // 'center'
        if (s.offset) { x += s.offset[0]; y += s.offset[1]; }
        x = Math.min(Math.max(10, x), W - it.w - 10);
        y = Math.min(Math.max(top, y), bottom - it.h);
        placed.push({ it, ax, ay, x, y, behind });
      }
      // push overlapping labels apart (simple vertical relaxation)
      placed.sort((a, b) => a.y - b.y);
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++) {
          const a = placed[j], b = placed[i];
          const ox = Math.min(a.x + a.it.w, b.x + b.it.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.it.h, b.y + b.it.h) - Math.max(a.y, b.y);
          if (ox > -6 && oy > -6) {
            b.y = a.y + a.it.h + 8;
            if (b.y + b.it.h > bottom) { b.y = bottom - b.it.h; a.y = Math.max(top, b.y - a.it.h - 8); }
          }
        }
      }
      for (const p of placed) {
        const { it, ax, ay, x, y, behind } = p;
        it.el.style.visibility = behind ? 'hidden' : 'visible';
        it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        const showLine = it.spec.line !== false && !behind;
        // leader line: from the anchor to the nearest point of the label box
        const lx = Math.min(Math.max(ax, x), x + it.w), ly = Math.min(Math.max(ay, y), y + it.h);
        for (const l of [it.line, it.halo]) {
          l.setAttribute('x1', ax.toFixed(1)); l.setAttribute('y1', ay.toFixed(1));
          l.setAttribute('x2', lx.toFixed(1)); l.setAttribute('y2', ly.toFixed(1));
          l.style.display = showLine ? '' : 'none';
        }
        it.dot.setAttribute('cx', ax.toFixed(1)); it.dot.setAttribute('cy', ay.toFixed(1));
        it.dot.style.display = showLine ? '' : 'none';
      }
    },
    dispose() { layer.remove(); },
  };
}
