// Plasticity and functional recovery after trauma — AQA 7182 4.2.2 (A-level only).
// Visual (3D):
//   - A procedural 3D network of neurons (a MODEL, not data): "Practise" thickens and lights the used
//     pathway; "Let time pass" weakens unused connections until they are pruned.
//   - Maguire et al. (2000): the real hippocampus (FreeSurfer aseg) inside the real brain, split along its
//     long axis so the posterior part can be highlighted. Bars and scatter are illustrative.
//   - Kühn et al. (2014): real right hippocampus, both cerebellar hemispheres and an approximate right
//     dorsolateral prefrontal patch. Davidson et al. (2004): illustrative gamma traces.
//   - Functional recovery: damage to Broca's area on the real left inferior frontal gyrus, then a
//     zoomed-in 3D micro-network for unmasking, sprouting, new blood vessels and super-sensitivity,
//     and the matching (homologous) area lit on the right hemisphere.
//   - Evaluation charts are illustrative (direction only).
import * as THREE from 'three';
import { BrainViewer } from '../brain/viewer.js';
import { reducedMotion } from '../settings.js';
import { createStage, setControls, createLabels, createChips, createPanel, freeRectFor } from '../three/stage-ui.js';
import { quietPicking, installViewShift, setViewerRunning, cortexLayer, mirrorRegionMask, splitLongAxis, styleStructures, flyTo, toWorld, snapToRegion, regionCentre, fromRAS } from '../three/brain-fx.js';
import { NetScene } from '../three/netscene.js';

const C = {
  ink: '#ECEFF7', soft: '#C9D2E6', faint: '#5E6A8A', cyan: '#73D3FF', link: '#86A8E6', amber: '#FFC965',
  mint: '#7DE8B4', rose: '#FF8DA1', violet: '#C9AAFF', red: '#FF8A7A',
};

/* ------------------------------------------------------------------ learning network (model) */
const NODES = {
  a: [60, 200], b: [165, 150], c: [285, 185], d: [405, 140], e: [540, 180],
  f: [110, 290], g: [230, 280], h: [360, 295], i: [480, 280], j: [590, 290],
  k: [240, 85], l: [360, 75], m: [490, 80], n: [595, 110],
};
const ZOFF = { a: 0, b: 18, c: -10, d: 14, e: -4, f: -34, g: 30, h: -26, i: 22, j: -30, k: -36, l: 26, m: -22, n: 10 };
const PATH = ['a', 'b', 'c', 'd', 'e'];
// [from, to, starting strength 0–5, on the practised path?]
const EDGES = [
  ['a', 'b', 2, 1], ['b', 'c', 2, 1], ['c', 'd', 2, 1], ['d', 'e', 2, 1],
  ['a', 'f', 2], ['f', 'g', 1], ['g', 'c', 3], ['g', 'h', 2], ['h', 'i', 1], ['h', 'c', 2], ['i', 'e', 3],
  ['i', 'j', 1], ['j', 'e', 2], ['b', 'k', 1], ['k', 'c', 2], ['k', 'l', 3], ['l', 'd', 2], ['l', 'm', 1],
  ['m', 'd', 3], ['m', 'n', 2], ['n', 'e', 1], ['b', 'g', 2],
];
const NEW_EDGE = 'b-g';
const RADIUS = [0.3, 0.7, 1.0, 1.35, 1.75, 2.2];
const node3 = (k) => new THREE.Vector3((NODES[k][0] - 330) * 0.5, -(NODES[k][1] - 190) * 0.5, ZOFF[k]);

/* ------------------------------------------------------------------ recovery micro-network (model) */
const RN = { d1: [100, 150], d2: [120, 230], d3: [85, 205], h1: [175, 100], h2: [240, 155], h3: [210, 245], h4: [150, 300], h5: [265, 240], h6: [190, 180] };
const RZ = { d1: 10, d2: -12, d3: 22, h1: -14, h2: 16, h3: -8, h4: 12, h5: -20, h6: 4 };
const rn3 = (k) => new THREE.Vector3((RN[k][0] - 175) * 1.2, -(RN[k][1] - 200) * 1.2, RZ[k]);
const R_BROKEN = [['h1', 'd1'], ['h6', 'd3'], ['h3', 'd2'], ['h4', 'd2'], ['d1', 'd3']];
const R_HEALTHY = [['h1', 'h2'], ['h2', 'h5'], ['h5', 'h3']];
const R_DORMANT = [['h1', 'h6'], ['h4', 'h3'], ['h6', 'h3']];
const R_SPROUT = [['h2', 'h6'], ['h5', 'h4'], ['h2', 'h3']];
const HALOS = ['h1', 'h6', 'h3', 'h4'];

/* ------------------------------------------------------------------ illustrative charts */
function axes(g, x0, y0, x1, y1) { g.line([[x0, y1], [x0, y0], [x1, y0]], C.soft, 1.5); }
function drawMaguire(g, grow) {
  const half = g.h * 0.48;
  // bars
  const bx0 = 20, by0 = half - 30, bh = half - 70;
  axes(g, bx0, by0, g.w - 16, by0 - bh - 10);
  const bw = Math.min(110, (g.w - 80) / 3);
  const xs = [bx0 + bw * 0.5, bx0 + bw * 2];
  g.rect(xs[0], by0 - bh * 0.55 * grow, bw, bh * 0.55 * grow, '#7186B8');
  g.ctx.save(); g.ctx.shadowColor = C.amber; g.ctx.shadowBlur = document.documentElement.dataset.calm === 'true' ? 0 : 12;
  g.rect(xs[1], by0 - bh * 0.68 * grow, bw, bh * 0.68 * grow, C.amber); g.ctx.restore();
  g.text(g.w - 16, 34, 'Not to scale', { align: 'right', color: C.soft });
  g.text(xs[0] + bw / 2, by0 + 16, 'Control group', { align: 'center' });
  g.text(xs[1] + bw / 2, by0 + 16, 'Taxi drivers', { align: 'center', weight: 700 });
  g.text(bx0, 12, 'Posterior hippocampus grey matter', { weight: 700 });
  // scatter
  const sy0 = g.h - 40, sx0 = 30, sx1 = g.w - 16, sh = half - 70;
  axes(g, sx0, sy0, sx1, sy0 - sh);
  g.text(sx0, half + 12, 'More years as a driver, larger', { weight: 700 });
  g.text(sx0, half + 32, '(right) posterior hippocampus', { weight: 700 });
  const pts = [[0.05, 0.12], [0.14, 0.2], [0.22, 0.18], [0.31, 0.33], [0.42, 0.37], [0.5, 0.45], [0.61, 0.5], [0.72, 0.62], [0.83, 0.66], [0.94, 0.8]];
  g.line([[sx0 + 0.02 * (sx1 - sx0), sy0 - 0.1 * sh], [sx0 + 0.98 * (sx1 - sx0), sy0 - 0.8 * sh]], 'rgba(255,201,101,.6)', 2, [6, 6]);
  pts.forEach(([x, y], i) => { if (i / pts.length <= grow) g.dot(sx0 + x * (sx1 - sx0), sy0 - y * sh * 0.95, 5, C.amber); });
  g.text((sx0 + sx1) / 2, sy0 + 18, 'Years as a taxi driver →', { align: 'center', color: C.soft });
}
function gammaTrace(g, x0, x1, y, amp, seed) {
  const pts = []; let n = 0; let s = seed;
  for (let x = x0; x <= x1; x += 1) {
    s = (s * 9301 + 49297) % 233280; n = 0.7 * n + (s / 233280 - 0.5) * 0.8;
    const t = (x - x0) / (x1 - x0);
    pts.push([x, y - amp * (Math.sin(2 * Math.PI * 38 * t) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 2.2 * t)) + n * 0.4)]);
  }
  return pts;
}
function drawDavidson(g) {
  const x0 = 12, x1 = g.w - 12;
  const y1 = g.h * 0.3, y2 = g.h * 0.72;
  g.text(x0, y1 - 46, 'Students, new to meditation', { color: C.soft });
  g.line(gammaTrace(g, x0, x1, y1, 5, 7), '#7186B8', 1.8);
  g.text(x0, y2 - 66, 'Buddhist monks (years of meditation)', { weight: 700, color: C.amber });
  g.glowLine(gammaTrace(g, x0, x1, y2, 26, 11), C.amber, 1.8);
  g.text(x0, g.h - 14, 'Monks: more gamma activity', { weight: 700 });
}
function drawAge(g, grow) {
  const x0 = 34, x1 = g.w - 16, y0 = g.h - 40, y1 = 20;
  axes(g, x0, y0, x1, y1);
  const pts = [];
  for (let i = 0; i <= 100 * grow; i++) { const t = i / 100; pts.push([x0 + 4 + t * (x1 - x0 - 8), y0 - (0.2 + 0.72 * Math.exp(-t * 3.2)) * (y0 - y1)]); }
  if (pts.length > 1) g.glowLine(pts, C.amber, 3.5);
  [['Child', 0.1], ['Adult', 0.5], ['Older', 0.9]].forEach(([l, t]) => g.text(x0 + t * (x1 - x0), y0 + 18, l, { align: 'center', color: C.soft }));
  g.text(16, (y0 + y1) / 2, 'Plasticity', { align: 'center', color: C.soft, rotate: -Math.PI / 2 });
  if (grow >= 1) g.pill(x0 + 0.62 * (x1 - x0), y0 - 0.62 * (y0 - y1), ['Reduces, but', 'never stops'], { color: C.amber, to: [x0 + 0.85 * (x1 - x0), y0 - 0.25 * (y0 - y1)] });
}
function drawRecoveryEval(g, grow) {
  const half = g.h * 0.5;
  g.text(12, 12, 'Cognitive reserve: Schneider et al. (2014)', { weight: 700 });
  g.text(12, 34, 'Disability-free recovery 1 year after brain injury', { color: C.soft });
  // published percentages (Schneider et al., 2014, Neurology), by years of education
  const DATA = [['Under 12', 9.7, '#7186B8'], ['12–15', 30.8, '#B7A6D8'], ['16 or more', 39.2, C.amber]];
  const by0 = half - 46, top = 62, bh = by0 - top - 22;
  const n = DATA.length, gap = Math.min(40, g.w * 0.06), bw = Math.min(100, (g.w - 40 - gap * (n - 1)) / n);
  const x0b = (g.w - (bw * n + gap * (n - 1))) / 2;
  g.line([[12, by0], [g.w - 12, by0]], C.soft, 1.5);
  DATA.forEach(([lab, v, col], i) => {
    const x = x0b + i * (bw + gap), hgt = bh * (v / 45) * grow;
    g.rect(x, by0 - hgt, bw, hgt, col);
    if (grow >= 1) g.text(x + bw / 2, by0 - hgt - 12, `${v}%`, { align: 'center', weight: 700 });
    g.text(x + bw / 2, by0 + 16, lab, { align: 'center', weight: i === n - 1 ? 700 : 400 });
  });
  g.text(g.w / 2, by0 + 36, 'Years of education', { align: 'center', color: C.soft });
  // rehab curve
  const x0 = 30, x1 = g.w - 16, y0 = g.h - 34, y1 = half + 40;
  g.text(12, half + 12, 'Rehabilitation over time (illustrative)', { weight: 700 });
  axes(g, x0, y0, x1, y1);
  const nat = [], ther = [];
  for (let i = 0; i <= 100 * grow; i++) {
    const t = i / 100, x = x0 + t * (x1 - x0);
    nat.push([x, y0 - (1 - Math.exp(-t * 6)) * 0.62 * (y0 - y1)]);
    if (t >= 0.35) ther.push([x, y0 - ((1 - Math.exp(-t * 6)) * 0.62 + 0.55 * (t - 0.35)) * (y0 - y1)]);
  }
  if (nat.length > 1) g.line(nat, '#9DB3E8', 3);
  if (ther.length > 1) g.glowLine(ther, C.mint, 3);
  if (grow >= 1) {
    g.pill(x0 + 0.72 * (x1 - x0), y0 - 0.32 * (y0 - y1), 'Natural recovery slows', { to: [x0 + 0.72 * (x1 - x0), y0 - 0.6 * (y0 - y1)] });
    g.pill(x0 + 0.5 * (x1 - x0), y1 + 6, 'With therapy', { color: C.mint, to: [x0 + 0.8 * (x1 - x0), y0 - 0.85 * (y0 - y1)] });
  }
  g.text(x1, y0 + 18, 'Time →', { align: 'right', color: C.soft });
}

/* ------------------------------------------------------------------ captions [visible, screen-reader] */
const CAPTIONS = [
  ['Learning can make a new connection between neurons. (A 3D model, not real data.)', 'A 3D model of a network of neurons. A new connection grows between two neurons, labelled: new connection forms through learning.'],
  ['Press Practise, then Let time pass. Watch which connections stay. (A 3D model.)', 'An interactive 3D model of a network of neurons. Practising strengthens one pathway, which gets thicker and glows. Letting time pass weakens connections that were not used, until some are pruned.'],
  ['Taxi drivers had more grey matter in the posterior hippocampus. Charts are illustrative.', 'A see-through 3D brain with the real hippocampus inside. Its back (posterior) part glows on both sides. Illustrative bars: taxi drivers higher than controls. Illustrative dots: more years as a driver goes with a larger posterior hippocampus.'],
  ['Lit areas: more grey matter after video-game training (Kühn et al., 2014). Graph: gamma waves in meditation (Davidson et al., 2004). Waves are illustrative.', 'A see-through 3D brain with the right hippocampus, the cerebellum and an approximate right prefrontal area lit up, where Kühn et al. found more grey matter. Beside it, illustrative gamma waves: small for students, larger for Buddhist monks.'],
  ['Press “Damage this area” to see a stroke damage Broca’s area.', 'A 3D brain seen from the left. A button damages Broca’s area, on the left frontal lobe, shown as dark damaged tissue.'],
  ['Neuronal unmasking: dormant synapses become active. (A 3D model.)', 'A zoomed-in 3D model of neurons next to the damaged area. Thin grey dormant connections become bright, active connections.'],
  ['Axonal sprouting: new nerve endings grow around the damage. (A 3D model.)', 'A zoomed-in 3D model of neurons next to the damaged area. New green branches grow from healthy neurons to other healthy neurons.'],
  ['Homologous area: the matching area in the right hemisphere helps. Position approximate.', 'A 3D brain seen from the front. Broca’s area on the left is damaged. The matching area on the right hemisphere lights up, with an arrow across from the damaged side.'],
  ['New blood vessels form, and neurons become more sensitive. (A 3D model.)', 'A zoomed-in 3D model of neurons. New blood vessels grow towards the damaged area, and glowing rings appear around neurons that lost input, showing they are more sensitive.'],
  ['Evaluating plasticity: age and negative plasticity. Graph is illustrative.', 'A 3D brain with the somatosensory cortex lit up, linked to phantom limb sensations. Beside it, an illustrative curve: plasticity is highest in childhood and reduces with age but never reaches zero.'],
  ['Evaluating recovery: cognitive reserve (Schneider et al., 2014) and rehabilitation. The therapy curve is illustrative.', 'Bars from Schneider et al. (2014): disability-free recovery one year after brain injury was 9.7% with under 12 years of education, 30.8% with 12 to 15 years and 39.2% with 16 or more years. Illustrative curve: natural recovery slows down, and therapy helps it continue. Behind, the 3D brain with the damaged area and the helping area on the other side.'],
];
const INTRO = ['Neurons connect to each other at synapses, forming networks. (A 3D model.)', 'A 3D model of a network of neurons joined by connections of different strengths.'];

/* ------------------------------------------------------------------ the visual */
const VISUAL = {
  dark: true,
  async create(container) {
    const S = createStage(container, 'plx3');
    const show = { brain: true, net: false, inset: false };
    const rm = () => reducedMotion();
    // ---- 3D brain (real data)
    const viewer = new BrainViewer(S.gl, { label: '3D brain for this step' });
    // ---- 3D network (model)
    const net = new NetScene(S.gl2, { label: '3D model of connected neurons' });
    await viewer.ready;
    quietPicking(viewer);
    const freeRect = freeRectFor(S);
    installViewShift(viewer, () => (show.inset ? null : freeRect()));
    viewer.setReal(true);
    viewer.model.updateMatrixWorld(true);
    const W = (p) => toWorld(viewer, p);
    const cam = viewer.camera;
    const projBrain = (p) => { const q = viewer.project(p); return q && { x: q.x + S.gl.offsetLeft, y: q.y + S.gl.offsetTop }; };
    const projNet = (p) => net.project(p);
    const labB = createLabels(S, projBrain, freeRect);
    const labN = createLabels(S, projNet, () => {
      const Wd = S.root.clientWidth, Hd = S.root.clientHeight;
      return show.inset ? { x: 0, y: 58, w: Wd - S.gl.offsetWidth - 30, h: Hd - 128 } : { x: 0, y: 58, w: Wd, h: Hd - 128 };
    });
    const chipsB = createChips(S, projBrain);
    const panel = createPanel(S, 'side');
    const facing = (pModel, n) => { const nv = new THREE.Vector3(...n).normalize(); return () => nv.dot(cam.position.clone().sub(W(pModel))) > 0; };
    const brainC = viewer.center.clone();

    // ---- anchors on the real brain (model space)
    const P = {
      broca: regionCentre(viewer, 5, 'left'),
      dlpfcR: snapToRegion(viewer, fromRAS(38, 34, 32), 0, 'right'),       // approximate right DLPFC (middle frontal gyrus)
      s1L: regionCentre(viewer, 2, 'left'),
    };
    // the homologous area: Broca's area mirrored, vertex by vertex, onto the right hemisphere
    P.brocaR = mirrorRegionMask(viewer, 5) || snapToRegion(viewer, new THREE.Vector3(-P.broca.x, P.broca.y, P.broca.z), 0, 'right');
    const centreOf = (name) => { const o = viewer.meshes[name]; o.updateMatrix(); o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(o.matrix); };
    P.hippoR = centreOf('hippocampus_right'); P.cblL = centreOf('cerebellum_left'); P.cblR = centreOf('cerebellum_right');

    const lesion = cortexLayer(viewer, { hemis: ['left'], lobes: ['frontal'], style: 'lesion', region: 5, regionAdd: 1, thresh: 0.5, colors: ['#2E0B09', '#7A2618'], opacity: 0.97 });
    const homo = cortexLayer(viewer, { hemis: ['right'], style: 'glow', maskW: 1, thresh: 0.4, colors: ['#C9AAFF'], opacity: 0.92 });
    const dlpfc = cortexLayer(viewer, { hemis: ['right'], lobes: ['frontal'], style: 'glow', seeds: [{ p: P.dlpfcR, sigma: 11, w: 1 }], thresh: 0.35, colors: ['#FFC965'], opacity: 0.9 });
    const s1 = cortexLayer(viewer, { style: 'glow', region: 2, regionAdd: 1, thresh: 0.4, colors: ['#C9AAFF'], opacity: 0.85 });
    const hippoL = splitLongAxis(viewer, 'hippocampus_left', 0.3), hippoR = splitLongAxis(viewer, 'hippocampus_right', 0.3);
    // arc from the damaged area to the matching area (over the top of the brain)
    const arcCurve = new THREE.CatmullRomCurve3([P.broca.clone().add(new THREE.Vector3(6, 4, 0)), new THREE.Vector3(brainC.x + 32, P.broca.y + 46, P.broca.z + 30), new THREE.Vector3(brainC.x - 32, P.broca.y + 46, P.broca.z + 30), P.brocaR.clone().add(new THREE.Vector3(-6, 4, 0))]);
    const arcGeo = new THREE.TubeGeometry(arcCurve, 120, 1.4, 10, false);
    const arc = new THREE.Mesh(arcGeo, new THREE.MeshBasicMaterial({ color: '#C9AAFF', transparent: true, opacity: 0.95 }));
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 20), arc.material);
    arrowHead.position.copy(arcCurve.getPointAt(1));
    arrowHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arcCurve.getTangentAt(1).normalize());
    arc.raycast = arrowHead.raycast = () => {};
    arc.visible = arrowHead.visible = false;
    viewer.model.add(arc, arrowHead);
    const setArc = (p) => { arcGeo.setDrawRange(0, Math.floor((arcGeo.index.count / 6) * p) * 6); arc.visible = p > 0.001; arrowHead.visible = p >= 0.999; };

    // ---- animation bookkeeping
    const cancels = new Set();
    const stopAll = () => { cancels.forEach((c) => c()); cancels.clear(); };
    const run = (dur, fn, done, delay = 0) => {
      if (rm()) { fn(1); done?.(); return; }
      let raf = 0, t0 = 0;
      const fr = (now) => { if (!t0) t0 = now + delay; const p = Math.max(0, Math.min(1, (now - t0) / dur)); fn(p); if (p < 1) raf = requestAnimationFrame(fr); else { cancels.delete(cancel); done?.(); } };
      const cancel = () => cancelAnimationFrame(raf);
      cancels.add(cancel); raf = requestAnimationFrame(fr);
    };
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
    const ctl = (defs, label) => setControls(S.ctrl, defs, label);
    const cap = (t) => { S.cap.textContent = t; };
    let instant = true, building = false, pendingFly = null;
    const fly = (target, dir, dist) => { if (building) pendingFly = [target, dir, dist]; else flyTo(viewer, target, dir, dist, instant || rm()); };

    // =========================================================== learning network
    const learn = new THREE.Group(); net.root.add(learn);
    const nodes = Object.fromEntries(Object.keys(NODES).map((k, i) => [k, net.neuron(node3(k), { radius: PATH.includes(k) ? 6.5 : 5.5, seed: 11 + i * 7, parent: learn })]));
    const edges = EDGES.map(([u, v, s0, onPath], i) => {
      const L = net.link(nodes[u], nodes[v], { seed: 101 + i * 13, bend: 0.18, parent: learn });
      return { key: `${u}-${v}`, s0, s: s0, shown: s0, onPath: !!onPath, L };
    });
    const pulseDot = net.pulseDot('#FFE2A0', 2.6);
    const used = new Set();
    let practised = 0, waited = 0, weakenedPath = false;
    const styleEdge = (e, sVal = e.s) => {
      const s = Math.max(0, Math.min(5, sVal));
      const fl = Math.floor(s), fr = s - fl;
      const rad = RADIUS[fl] + (RADIUS[Math.min(5, fl + 1)] - RADIUS[fl]) * fr;
      e.L.setRadius(rad);
      const strong = s >= 3.5;
      const col = new THREE.Color(C.link).lerp(new THREE.Color(C.amber), THREE.MathUtils.clamp((s - 3) / 1.2, 0, 1));
      e.L.setColor(col, strong ? 0.42 : 0.12 + 0.06 * s);
      e.L.setOpacity(s < 0.5 ? 0.12 + 0.3 * s : 0.55 + 0.09 * s);
    };
    const restyle = (animate) => {
      edges.forEach((e) => {
        const from = e.shown, to = e.s;
        if (!animate || rm() || from === to) { e.shown = to; styleEdge(e); return; }
        run(700, (p) => { e.shown = from + (to - from) * ease(p); styleEdge(e, e.shown); });
      });
    };
    const resetNet = () => { edges.forEach((e) => { e.s = e.s0; e.shown = e.s0; styleEdge(e); e.L.setGrow(1); }); used.clear(); practised = 0; waited = 0; weakenedPath = false; };
    const pulse = () => {
      const nodeEls = PATH.map((k) => nodes[k]);
      const pathEdges = PATH.slice(0, -1).map((k, i) => edges.find((e) => e.key === `${k}-${PATH[i + 1]}`));
      if (rm()) { nodeEls.forEach((n) => n.setActive(1)); setTimeout(() => nodeEls.forEach((n) => n.setActive(0)), 900); return; }
      pulseDot.visible = true;
      run(2200, (p) => {
        const seg = Math.min(pathEdges.length - 1, Math.floor(p * pathEdges.length));
        const f = p * pathEdges.length - seg;
        pulseDot.position.copy(pathEdges[seg].L.curve.getPointAt(Math.min(1, f)));
        nodeEls.forEach((n, i) => n.setActive(Math.max(0, 1 - Math.abs(p * pathEdges.length - i) * 2.2)));
      }, () => { pulseDot.visible = false; nodeEls.forEach((n) => n.setActive(0)); });
    };
    const strongLabelEdge = () => edges.find((e) => e.key === 'b-c');
    const netLabels = () => {
      const out = [];
      if (practised === 0 && waited === 0) out.push({ id: 'path', html: 'Pathway you practise', color: C.amber, anchor: () => nodes.a.pos, dx: 40, dy: -120 });
      if (edges.some((e) => e.onPath && e.s >= 4)) out.push({ id: 'strong', html: 'Stronger with use<small>thicker, brighter connection</small>', color: C.amber, anchor: () => strongLabelEdge().L.curve.getPointAt(0.5), dx: 30, dy: -130 });
      if (weakenedPath && !edges.some((e) => e.onPath && e.s >= 4)) out.push({ id: 'weak', html: 'Not practised, so getting weaker', color: C.soft, anchor: () => strongLabelEdge().L.curve.getPointAt(0.5), dx: 30, dy: -130 });
      const pruned = edges.find((e) => e.s === 0);
      if (pruned) out.push({ id: 'pruned', html: 'Not used, so pruned', color: C.rose, anchor: () => pruned.L.curve.getPointAt(0.5), dx: 0, dy: 120 });
      labN.set(out);
      S.status.textContent = `Practised ${practised} ${practised === 1 ? 'time' : 'times'} · Time passed ${waited} ${waited === 1 ? 'time' : 'times'}`;
    };
    const practise = () => {
      practised++;
      edges.filter((e) => e.onPath).forEach((e) => { e.s = Math.min(5, e.s + 1); used.add(e.key); });
      restyle(true); pulse(); netLabels();
      cap('Practising sends signals along the same pathway, so those connections get stronger.');
    };
    const letTimePass = () => {
      waited++;
      edges.forEach((e) => { if (!used.has(e.key) && e.s > 0) { e.s -= 1; if (e.onPath) weakenedPath = true; } });
      used.clear(); restyle(true); netLabels();
      cap(edges.some((e) => e.s === 0) ? 'Connections that were not used got weaker. Some have been pruned (removed).' : 'Time passed. Connections that were not used got weaker.');
    };
    S.status = document.createElement('p');
    S.status.className = 'plx3-status';
    S.root.append(S.status);

    // =========================================================== recovery micro-network
    const rec = new THREE.Group(); net.root.add(rec);
    const rnodes = Object.fromEntries(Object.keys(RN).map((k, i) => [k, net.neuron(rn3(k), { radius: 7, seed: 300 + i * 17, parent: rec })]));
    const mk = (pairs, color, seed) => pairs.map(([u, v], i) => net.link(rnodes[u], rnodes[v], { seed: seed + i * 11, bend: 0.22, color, parent: rec, segs: 72 }));
    const broken = mk(R_BROKEN, C.link, 500);
    const healthy = mk(R_HEALTHY, C.link, 600);
    const dormant = mk(R_DORMANT, '#56607A', 700);
    const sprouts = mk(R_SPROUT, C.mint, 800);
    healthy.forEach((l) => { l.setRadius(1.4); l.setColor(C.link, 0.2); });
    // damaged tissue: a soft dark-red cloud around the dead neurons
    const dz = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshPhysicalMaterial({ color: '#7A1E22', transparent: true, opacity: 0.28, roughness: 0.6, depthWrite: false, emissive: new THREE.Color('#3A0608'), emissiveIntensity: 0.4 }));
    dz.scale.set(62, 96, 52); dz.position.set((100 - 175) * 1.2, -(195 - 200) * 1.2, 6);
    rec.add(dz);
    const vOld = net.vessel([new THREE.Vector3(-40, -150, -20), new THREE.Vector3(30, -150, -10), new THREE.Vector3(105, -115, -14), new THREE.Vector3(150, -55, -18)], { radius: 4.2, parent: rec });
    const vNew = [
      net.vessel([new THREE.Vector3(-4, -151, -18), new THREE.Vector3(-18, -110, -8), new THREE.Vector3(-34, -78, 4), new THREE.Vector3(-58, -60, 10)], { radius: 2.6, parent: rec }),
      net.vessel([new THREE.Vector3(76, -132, -14), new THREE.Vector3(60, -96, -6), new THREE.Vector3(36, -76, 2), new THREE.Vector3(8, -70, 8)], { radius: 2.4, parent: rec }),
    ];
    const halos = HALOS.map((k) => net.halo(rnodes[k]));
    let halosOn = 0;
    net.on('frame', () => {
      // halos are static (a pulsing glow would read as the neuron firing)
      if (halosOn > 0) halos.forEach((h) => h.set(halosOn, 0, net.camera));
      labN.update();
    });
    const setDamage = (on) => {
      ['d1', 'd2', 'd3'].forEach((k) => rnodes[k].setDead(on));
      broken.forEach((l) => { l.setColor(on ? '#B5444C' : C.link, on ? 0.1 : 0.2); l.setRadius(on ? 0.9 : 1.4); l.setOpacity(on ? 0.45 : 0.9); l.setGrow(on ? 0.55 : 1); });
      dz.visible = on;
    };
    const setUnmask = (p) => dormant.forEach((l) => {
      l.setRadius(0.55 + 1.35 * p);
      l.setColor(new THREE.Color('#56607A').lerp(new THREE.Color('#2FC4FF'), p), 0.1 + 1.0 * p);
      l.setOpacity(0.45 + 0.5 * p);
    });
    const setSprout = (p, i = null) => sprouts.forEach((l, k) => { l.setRadius(1.2); l.setColor(C.mint, 0.7); l.setOpacity(p > 0 ? 1 : 0); if (i === null || i === k) l.setGrow(p); });
    const setVessels = (p) => vNew.forEach((v) => v.setGrow(p));
    const setHalos = (o) => { halosOn = o; halos.forEach((h) => h.set(o, 0, net.camera)); };

    // =========================================================== modes
    const setMode = (mode) => {
      // 'brain' = brain full stage; 'net' = network full stage; 'inset' = network + small brain in a corner
      show.brain = mode !== 'net'; show.net = mode !== 'brain'; show.inset = mode === 'inset';
      S.gl.hidden = !show.brain; S.gl2.hidden = !show.net;
      S.gl.classList.toggle('bx3-inset', show.inset);
      setViewerRunning(viewer, show.brain);
      net.setRunning(show.net);
      learn.visible = false; rec.visible = false;
    };
    viewer.on('frame', () => { labB.update(); chipsB.update(); });

    const resetAll = () => {
      stopAll();
      labB.clear(); labN.clear(); chipsB.set([]); panel.hide();
      S.status.textContent = '';
      lesion.setVisible(false); homo.setVisible(false); dlpfc.setVisible(false); s1.setVisible(false);
      lesion.level = 1; homo.level = 1;
      hippoL.show(false); hippoR.show(false);
      setArc(0);
      viewer.setXray(false); viewer.select(null, { fly: false }); viewer.setMode('lobes');
      ctl([]);
    };
    let damaged = false;

    const STEPS = {
      [-1]: () => {
        setMode('net'); learn.visible = true; resetNet();
        edges.find((e) => e.key === NEW_EDGE).L.setOpacity(0);
        net.view(new THREE.Vector3(8, -4, 0), [0.25, 0.25, 1], 510, instant);
        cap(INTRO[0]); return INTRO[1];
      },
      0: () => {
        setMode('net'); learn.visible = true; resetNet();
        const ne = edges.find((e) => e.key === NEW_EDGE);
        const grow = () => {
          stopAll();
          ne.L.setRadius(1.7); ne.L.setColor(C.mint, 0.9); ne.L.setOpacity(1); ne.L.setGrow(0);
          run(1800, (p) => ne.L.setGrow(ease(p)), null, 300);
        };
        labN.set([{ id: 'new', html: 'New connection<small>forms through learning</small>', color: C.mint, anchor: () => ne.L.curve.getPointAt(0.55), dx: 120, dy: 110 }]);
        net.view(new THREE.Vector3(-40, 0, 0), [0.15, 0.2, 1], 380, instant);
        if (instant || rm()) { ne.L.setRadius(1.7); ne.L.setColor(C.mint, 0.9); ne.L.setOpacity(1); ne.L.setGrow(1); } else grow();
        ctl([{ label: '↻ Play again', onClick: grow }]);
        cap(CAPTIONS[0][0]);
      },
      1: () => {
        setMode('net'); learn.visible = true;
        edges.forEach((e) => { e.L.setGrow(1); styleEdge(e); });
        net.view(new THREE.Vector3(8, -4, 0), [0.25, 0.25, 1], 510, instant);
        ctl([
          { label: 'Practise', onClick: practise },
          { label: 'Let time pass', onClick: letTimePass },
          { label: '↺ Start again', onClick: () => { resetNet(); netLabels(); cap(CAPTIONS[1][0]); } },
        ]);
        netLabels();
        cap(CAPTIONS[1][0]);
      },
      2: () => {
        setMode('brain');
        viewer.setXray(true);
        hippoL.show(true); hippoR.show(true);
        styleStructures(viewer, { dim: /^(?!hippocampus)/, dimOpacity: 0.07 });
        fly(brainC, [1, 0.45, -0.25], 330);
        labB.set([
          { id: 'post', html: 'Posterior (back) hippocampus<small>more grey matter in taxi drivers (boundary approximate)</small>', color: '#FFC23D', anchor: () => W(hippoL.backCentre), dx: -40, dy: -150 },
          { id: 'ant', html: 'Front part', color: '#8FA3C8', anchor: () => W(hippoL.frontCentre), dx: 60, dy: 120 },
        ]);
        let grow = instant || rm() ? 1 : 0;
        panel.show({ cls: 'side', title: 'Maguire et al. (2000)', sub: 'Illustrative, not real data', draw: (g) => drawMaguire(g, grow), aria: 'Illustrative bars: taxi drivers have more posterior hippocampus grey matter than controls. Illustrative dots: more years as a driver, larger posterior hippocampus.' });
        const play = () => { stopAll(); run(1400, (p) => { grow = ease(p); panel.redraw(); }); };
        if (grow < 1) play();
        ctl([{ label: '↻ Play again', onClick: play }]);
        cap(CAPTIONS[2][0]);
      },
      3: () => {
        setMode('brain');
        viewer.setXray(true);
        styleStructures(viewer, { glow: { hippocampus_right: '#F2A93B', cerebellum_left: '#F2A93B', cerebellum_right: '#F2A93B' }, dim: /^(?!hippocampus_right|cerebellum)/, dimOpacity: 0.07 });
        dlpfc.setVisible(true);
        fly(brainC, [-1, 0.3, 0.35], 420);
        labB.set([
          { id: 'pfc', html: 'Prefrontal cortex<small>right side (approximate). Kühn et al.: more grey matter</small>', color: C.amber, anchor: () => W(P.dlpfcR), dx: 40, dy: -130 },
          { id: 'hip', html: 'Hippocampus<small>right side</small>', color: C.amber, anchor: () => W(P.hippoR), dx: 120, dy: 60 },
          { id: 'cbl', html: 'Cerebellum', color: C.amber, anchor: () => W(P.cblR), dx: -110, dy: 90 },
        ]);
        panel.show({ cls: 'side', title: 'Davidson et al. (2004)', sub: 'Gamma waves during meditation (illustrative)', draw: drawDavidson, aria: 'Illustrative EEG gamma waves: small for students new to meditation, much larger for Buddhist monks.' });
        cap(CAPTIONS[3][0]);
      },
      4: () => {
        setMode('brain');
        fly(brainC, [1, 0.12, 0.25], 420);
        const apply = (on, animate) => {
          damaged = on;
          lesion.setVisible(on);
          if (on && animate) run(1200, (p) => { lesion.level = 0.5 + 0.5 * ease(p); }); else lesion.level = 1;
          labB.set(on ? [{ id: 'dmg', html: 'Damage<small>e.g. a stroke in Broca’s area</small>', color: C.red, anchor: () => W(P.broca), facing: facing(P.broca, [1, 0, 0.3]), dx: -30, dy: 150 }]
            : [{ id: 'b', html: 'Broca’s area<small>left frontal lobe</small>', color: C.soft, anchor: () => W(P.broca), facing: facing(P.broca, [1, 0, 0.3]), dx: -30, dy: 150 }]);
          ctl([{ label: on ? '↺ Undo the damage' : 'Damage this area', onClick: () => apply(!damaged, true) }]);
          cap(on ? 'Broca’s area is damaged. Nearby neurons have lost some of their connections.' : CAPTIONS[4][0]);
        };
        apply(damaged, false);
      },
      micro: (step) => {
        setMode('inset'); rec.visible = true;
        // the small brain shows where we are zoomed in
        lesion.setVisible(true); lesion.level = 1;
        flyTo(viewer, P.broca, [1, 0.15, 0.3], 260, true);
        chipsB.set([{ text: 'Zoomed in here', color: C.red, anchor: () => W(P.broca) }]);
        setDamage(true);
        net.view(new THREE.Vector3(60, -5, 0), [0.2, 0.15, 1], 700, instant);
        const dmgLab = { id: 'dz', html: 'Damaged area<small>these neurons have died</small>', color: C.red, anchor: () => dz.position, dx: -30, dy: 190 };
        // state up to this step
        setUnmask(step >= 6 ? 1 : 0);
        setSprout(step >= 8 ? 1 : 0);
        sprouts.forEach((l) => l.setOpacity(step >= 8 ? 0.85 : 0));
        if (step >= 6) dormant.forEach((l) => l.setColor(C.cyan, 0.35));
        setVessels(0); setHalos(0);
        const play = () => {
          stopAll();
          if (step === 5) { setUnmask(0); run(1600, (p) => setUnmask(ease(p)), null, 300); }
          if (step === 6) { setSprout(0); sprouts.forEach((l, i) => run(1800, (p) => l.setGrow(ease(p)), null, 300 + i * 450)); setSprout(0.0001); }
          if (step === 8) { setVessels(0); setHalos(0); run(2200, (p) => setVessels(ease(p)), null, 200); run(1200, (p) => setHalos(p), null, 1400); }
        };
        if (step === 5) labN.set([dmgLab, { id: 'um', html: 'Dormant synapses switch on', color: C.cyan, anchor: () => dormant[0].curve.getPointAt(0.5), dx: 130, dy: -120 }]);
        if (step === 6) labN.set([dmgLab, { id: 'sp', html: 'New nerve endings grow<small>between healthy neurons</small>', color: C.mint, anchor: () => sprouts[0].curve.getPointAt(0.6), dx: 140, dy: -120 }]);
        if (step === 8) labN.set([dmgLab,
          { id: 'v', html: 'New blood vessels form', color: C.rose, anchor: () => vNew[0].curve.getPointAt(0.6), dx: 150, dy: 70 },
          { id: 'h', html: 'Neurons become more sensitive<small>they lost some input</small>', color: C.amber, anchor: () => rnodes.h6.pos, dx: 170, dy: -110 }]);
        if (instant || rm()) {
          if (step === 5) setUnmask(1);
          if (step === 6) { setSprout(1); }
          if (step === 8) { setVessels(1); setHalos(1); }
        } else play();
        ctl([{ label: '↻ Play again', onClick: play }]);
        cap(CAPTIONS[step][0]);
      },
      7: () => {
        setMode('brain');
        lesion.setVisible(true); homo.setVisible(true);
        fly(brainC, [-0.3, 0.15, 1], 420);
        labB.set([
          { id: 'l', html: 'Damaged area<small>left hemisphere</small>', color: C.red, anchor: () => W(P.broca), dx: 110, dy: 120 },
          { id: 'r', html: 'Matching area on the right helps<small>position approximate</small>', color: C.violet, anchor: () => W(P.brocaR), dx: -110, dy: 120 },
        ]);
        const play = () => { stopAll(); homo.level = 0; setArc(0); run(1200, (p) => setArc(ease(p)), null, 200); run(1400, (p) => { homo.level = ease(p); }, null, 900); };
        if (instant || rm()) { setArc(1); homo.level = 1; } else play();
        ctl([{ label: '↻ Play again', onClick: play }]);
        cap(CAPTIONS[7][0]);
      },
      9: () => {
        setMode('brain');
        s1.setVisible(true);
        fly(brainC, [0.9, 0.9, -0.1], 430);
        labB.set([{ id: 's1', html: 'Somatosensory cortex<small>changes here are linked to phantom limb sensations</small>', color: C.violet, anchor: () => W(P.s1L), dx: -60, dy: -140 }]);
        let grow = instant || rm() ? 1 : 0;
        panel.show({ cls: 'side', title: 'Age (illustrative)', sub: 'How plastic the brain is across life. <strong>Negative plasticity:</strong> many people who lose a limb still feel it (phantom limb).', draw: (g) => drawAge(g, grow), aria: 'Illustrative curve: plasticity is highest in childhood and reduces with age, but never stops.' });
        const play = () => { stopAll(); run(1500, (p) => { grow = ease(p); panel.redraw(); }); };
        if (grow < 1) play();
        ctl([{ label: '↻ Play again', onClick: play }]);
        cap(CAPTIONS[9][0]);
      },
      10: () => {
        setMode('brain');
        lesion.setVisible(true); homo.setVisible(true); setArc(1);
        fly(brainC, [-0.3, 0.15, 1], 460);
        let grow = instant || rm() ? 1 : 0;
        panel.show({ cls: 'side wide', title: 'Evaluating functional recovery', sub: 'Bars: published values. Curve: illustrative.', draw: (g) => drawRecoveryEval(g, grow), aria: CAPTIONS[10][1] });
        const play = () => { stopAll(); run(1600, (p) => { grow = ease(p); panel.redraw(); }); };
        if (grow < 1) play();
        ctl([{ label: '↻ Play again', onClick: play }]);
        cap(CAPTIONS[10][0]);
      },
    };

    let stepNow = -2;
    return {
      show(step) {
        const moved = step !== stepNow;
        stepNow = step;
        instant = !moved;
        resetAll();
        const s = Math.max(-1, Math.min(10, step));
        const fn = [5, 6, 8].includes(s) ? () => STEPS.micro(s) : STEPS[s];
        building = true; pendingFly = null;
        const aria = fn() || CAPTIONS[s]?.[1] || INTRO[1];
        building = false;
        if (pendingFly) flyTo(viewer, ...pendingFly, instant || rm());
        S.root.setAttribute('aria-label', aria);
        viewer.renderer.domElement.setAttribute('aria-label', aria);
        net.renderer.domElement.setAttribute('aria-label', aria);
        instant = false;
      },
      dispose() {
        stopAll(); labB.dispose(); labN.dispose(); chipsB.dispose(); panel.dispose();
        lesion.dispose(); homo.dispose(); dlpfc.dispose(); s1.dispose(); hippoL.dispose(); hippoR.dispose();
        arcGeo.dispose(); arc.material.dispose(); arrowHead.geometry.dispose();
        net.dispose(); viewer.dispose(); S.root.remove();
      },
    };
  },
};

/* ------------------------------------------------------------------ the lesson (text fact-checked: keep) */
export default {
  id: 'plasticity',
  title: 'Plasticity and functional recovery',
  objectives: [
    'Explain what plasticity is, including synaptic pruning.',
    'Describe evidence for plasticity, such as the London taxi driver study.',
    'Describe and evaluate how the brain can recover after trauma.',
  ],
  keywords: [
    { term: 'Plasticity', simple: 'The brain’s ability to change because of experience and learning.', exam: 'The brain’s tendency to change and adapt, both structurally and functionally, as a result of experience and new learning.' },
    { term: 'Synaptic pruning', simple: 'Removing connections between neurons that are rarely used.', exam: 'The process by which rarely used synaptic connections are deleted and frequently used connections are strengthened.' },
    { term: 'Functional recovery', simple: 'When healthy parts of the brain take over the jobs of damaged parts.', exam: 'A form of plasticity: after trauma, the brain’s ability to transfer functions usually performed by a damaged area to other, undamaged areas.' },
    { term: 'Neuronal unmasking', simple: 'Dormant (unused) synapses become active after brain damage.', exam: 'Dormant synapses become active when neural input to them increases after nearby damage, opening connections to regions that are not normally activated.' },
    { term: 'Axonal sprouting', simple: 'Healthy neurons grow new nerve endings to make new connections.', exam: 'The growth of new nerve endings which connect with other undamaged nerve cells to form new neuronal pathways.' },
    { term: 'Cognitive reserve', simple: 'Extra brain “resources”, linked to things like more years of education, that may help the brain cope with damage.', exam: 'The idea that greater mental resources (for example from more years of education) help the brain to cope with damage. Linked to Schneider et al. (2014).' },
  ],
  steps: [
    {
      title: 'Your brain can change',
      simple: `<p><span class="keyterm">Plasticity</span> means the brain can change its <strong>structure</strong> and how it <strong>works</strong>.</p>
        <p>It changes because of <strong>experience and learning</strong>. When you learn something, the connections between your neurons change.</p>
        <p>Plasticity happens <strong>throughout life</strong>, not just when you are a baby.</p>`,
      exam: `<p>In infancy the brain forms new synaptic connections very quickly. Researchers once thought these changes stopped in childhood. Research now shows the adult brain also changes as a result of learning and experience.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>“Plasticity only happens in childhood.” This is wrong. Plasticity is greatest when we are young, but it continues in adults. The London taxi driver study is one example.</p>' },
    },
    {
      title: 'Use it or lose it',
      simple: `<p>Neurons connect to each other at <strong>synapses</strong>.</p>
        <p>When you use a connection a lot, it gets <strong>stronger</strong>.</p>
        <p>Connections you rarely use get weaker, and some are removed. This is called <span class="keyterm">synaptic pruning</span>.</p>
        <p>Try it: press <strong>Practise</strong> a few times. Then press <strong>Let time pass</strong> a few times.</p>`,
      exam: `<p>As we age, rarely used synaptic connections are deleted and frequently used connections are strengthened. Pruning is a normal part of brain development.</p>`,
    },
    {
      title: 'Evidence: London taxi drivers',
      simple: `<p>Maguire et al. (2000) used MRI scans to study the brains of <strong>London taxi drivers</strong>. To get a licence, drivers must learn thousands of London streets.</p>
        <p>The taxi drivers had more grey matter in the <span class="keyterm">posterior hippocampus</span> (the back part) than a control group.</p>
        <p>The longer someone had been a taxi driver, the larger this area tended to be.</p>`,
      exam: `<p>The hippocampus is linked to spatial memory and navigation. The positive correlation with time spent as a taxi driver suggests the brain changed in response to the demands of the job. Because the study is correlational, we cannot be completely sure that the job caused the difference.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Be precise. Write “more grey matter in the <strong>posterior hippocampus</strong>”, not just “a bigger brain”.</p>' },
    },
    {
      title: 'Evidence: video games and meditation',
      simple: `<p>Kühn et al. (2014) asked people to play the video game <strong>Super Mario 64</strong> for at least 30 minutes a day for two months. Compared with a control group, they had <strong>more grey matter</strong> in several brain areas.</p>
        <p>Davidson et al. (2004) compared <strong>Buddhist monks</strong>, who had meditated for many years, with students who were new to meditation. During meditation the monks had much more <strong>gamma wave</strong> activity.</p>`,
      exam: `<p>Kühn et al. found increases in areas including the hippocampus, the prefrontal cortex and the cerebellum. Davidson et al. recorded gamma waves using EEG. Gamma waves are linked to coordinated neuron activity. The monks had more gamma activity even before meditating, suggesting long-term change.</p>`,
    },
    {
      title: 'Functional recovery after trauma',
      simple: `<p>Brain <strong>trauma</strong> means damage, for example from a stroke or a head injury.</p>
        <p>After trauma, healthy parts of the brain can sometimes take over the jobs of the damaged parts. This is called <span class="keyterm">functional recovery</span>. It is a type of plasticity.</p>
        <p>Press <strong>Damage this area</strong>. The next steps show how the brain responds.</p>`,
      exam: `<p>Recovery can happen quickly at first (spontaneous recovery) and then slow down after several weeks or months. At that point, rehabilitation therapy may be needed to help further recovery.</p>`,
    },
    {
      title: 'Neuronal unmasking',
      simple: `<p>The brain has some <strong>dormant synapses</strong>. These are connections that exist, but are not normally used.</p>
        <p>After damage nearby, these dormant synapses can <strong>become active</strong>. This opens up connections to areas that are not normally used.</p>
        <p>This is called <span class="keyterm">neuronal unmasking</span>.</p>`,
      exam: `<p>Wall (1977) described dormant synapses: their function is blocked because the rate of neural input to them is too low. When surrounding areas are damaged, the input to them increases and they are “unmasked”. This can lead to new structures developing over time.</p>`,
    },
    {
      title: 'Axonal sprouting',
      simple: `<p>Healthy neurons can grow <strong>new nerve endings</strong>.</p>
        <p>These new branches connect with other <strong>undamaged</strong> neurons. Together they make new pathways around the damaged area.</p>
        <p>This is called <span class="keyterm">axonal sprouting</span>.</p>`,
      exam: `<p>Axonal sprouting is the growth of new nerve endings which connect with other undamaged nerve cells to form new neuronal pathways. This helps to replace connections that were lost when neurons died.</p>`,
    },
    {
      title: 'Using the other side of the brain',
      simple: `<p>Sometimes the <strong>matching area on the other side of the brain</strong> helps with the job of the damaged area.</p>
        <p>This is called recruitment of <strong>homologous areas</strong> on the opposite hemisphere.</p>
        <p>For example, if a language area in the left hemisphere is damaged, the matching area in the right hemisphere may start to help with language.</p>`,
      exam: `<p>“Homologous” means matching: the area in the same position in the opposite hemisphere. Recruiting it allows specific tasks to still be performed, for example language production after damage to Broca’s area.</p>`,
    },
    {
      title: 'Blood vessels and super-sensitivity',
      simple: `<p>Two more changes can help recovery:</p>
        <ul>
          <li><strong>Reformation of blood vessels.</strong> New blood vessels form near the damaged area.</li>
          <li><strong>Denervation super-sensitivity.</strong> Neurons that have lost their input become <strong>more sensitive</strong> to the signals they still receive. This helps make up for the lost connections.</li>
        </ul>`,
      exam: `<p>“Denervation” means losing nerve input. In denervation super-sensitivity, axons that do a similar job become aroused to a higher level to compensate for the ones that are lost. This can have negative effects too, such as pain.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>For a “describe” question, name each mechanism and give a one-sentence definition: unmasking, axonal sprouting, homologous areas, blood vessels, denervation super-sensitivity.</p>' },
    },
    {
      title: 'Evaluating plasticity',
      simple: `<ul>
          <li><strong>Age.</strong> Plasticity tends to reduce as we get older, but it does not stop. Bezzola et al. (2012) found that golf training changed brain activity in adults aged 40 to 60.</li>
          <li><strong>Negative plasticity.</strong> Not all changes are helpful. Many people who lose a limb still feel sensations in it (phantom limb). This is thought to be caused by changes in the somatosensory cortex.</li>
        </ul>`,
      exam: `<p>Bezzola et al. (2012) found that 40 hours of golf training changed brain activity linked to movement in participants aged 40 to 60. This suggests plasticity continues throughout the lifespan. Long-term drug use has also been linked to harmful brain changes, another example of negative plasticity.</p>`,
    },
    {
      title: 'Evaluating functional recovery',
      simple: `<ul>
          <li><strong>Practical application.</strong> Research into recovery has helped develop <strong>neurorehabilitation</strong>, such as movement therapy. This matters because natural (spontaneous) recovery slows down after a few weeks.</li>
          <li><strong>Cognitive reserve.</strong> Schneider et al. (2014) found that people with more years of education were more likely to make a <strong>disability-free recovery</strong> after a traumatic brain injury.</li>
        </ul>`,
      exam: `<p>Schneider et al. suggested that more education gives the brain a “cognitive reserve” that helps it adapt after damage. Age may also matter: because plasticity tends to reduce with age, recovery may be harder for older people.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Do not use <strong>Phineas Gage</strong> as evidence of recovery. His case is about frontal lobe damage changing his personality, so it belongs in localisation. For recovery, use the mechanisms and studies such as Schneider et al. (2014).</p>' },
    },
  ],
  quiz: [
    { q: 'What is synaptic pruning?', options: ['Rarely used connections are removed', 'New neurons are grown', 'Damaged neurons are repaired', 'New blood vessels form'], answer: 0, explain: 'Rarely used connections are deleted, and frequently used ones are strengthened.', hint: 'Think “use it or lose it”.' },
    { q: 'Maguire et al. (2000) found that London taxi drivers had more grey matter in which area?', options: ['Broca’s area', 'The posterior hippocampus', 'The cerebellum', 'The occipital lobe'], answer: 1, explain: 'The posterior hippocampus is linked to spatial memory and navigation.', hint: 'The area is linked to finding your way. It is the back part of a structure deep in the temporal lobe.' },
    { q: 'After a stroke, dormant synapses become active. What is this called?', options: ['Axonal sprouting', 'Synaptic pruning', 'Neuronal unmasking', 'Denervation super-sensitivity'], answer: 2, explain: 'Neuronal unmasking: synapses that were “masked” (not used) become active.', hint: 'Something hidden is uncovered.' },
    { q: 'What did Schneider et al. (2014) find?', options: ['Children never recover from brain injury', 'People with more years of education were more likely to make a disability-free recovery after brain injury', 'Video games increase grey matter', 'Plasticity stops in adulthood'], answer: 1, explain: 'This is evidence for cognitive reserve.', hint: 'This study is about education and recovery.' },
    { q: 'Which statement about plasticity is correct?', options: ['It only happens in childhood', 'It happens throughout life, although it tends to reduce with age', 'It only happens after brain damage', 'It only happens in the hippocampus'], answer: 1, explain: 'Plasticity continues throughout life. Maguire’s adult taxi drivers are one example.', hint: 'Think about the taxi drivers. Were they children?' },
  ],
  summary: [
    'Plasticity: the brain changes with experience and learning, throughout life. Used connections get stronger; unused ones are pruned.',
    'Evidence: Maguire et al. (2000) taxi drivers had more grey matter in the posterior hippocampus. Also Kühn et al. (2014) and Davidson et al. (2004).',
    'Recovery after trauma: neuronal unmasking, axonal sprouting, homologous areas, new blood vessels, denervation super-sensitivity.',
  ],
  visual: VISUAL,
};
