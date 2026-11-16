// Real neuron shapes in 3D, built from SWC reconstructions (NeuroMorpho.Org format).
//
//   import { loadSWC, buildNeuron } from '../three/neuron3d.js';
//   const swc = await loadSWC(`${import.meta.env.BASE_URL}neurons/pyramidal-human-685815936.swc`);
//   const n = buildNeuron(swc, { myelin: { start: 40, internode: 90, gap: 9 }, terminals: { radius: 2.6 } });
//   group.add(n.group);                       // units = micrometres (scale the group to taste)
//   n.highlight(['axon', 'myelin']);          // dim everything else (null = all lit)
//   n.setFront('axon', 600, 1);               // glowing action-potential band 600 µm down the axon
//   n.axonFrontAt(u)                          // → front position for progress u (0..1); saltatory if myelinated
//   n.anchor('soma')                          // → THREE.Vector3 in world space, for labels
//   n.update(dt) every frame, n.dispose() when done.
//
// Parts: 'dendrites' | 'soma' | 'nucleus' | 'axon' | 'myelin' | 'nodes' | 'terminals'.
// Every vertex carries its path distance (µm) from the cell body ("aDist"), so one shader uniform can sweep a
// glowing impulse along all branches at once. Nodes may carry `drawn: true` for parts added as an illustration
// (e.g. an axon that leaves the reconstructed tissue) and `part` to override the part a node belongs to, and
// `d` to override its path distance (e.g. a sensory neuron whose impulse starts at the skin).
import * as THREE from 'three';
import { tissueMaterial } from './look.js';
import { get } from '../settings.js';

/* ------------------------------------------------------------------ SWC */
export function parseSWC(text) {
  const nodes = []; const header = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { header.push(line.slice(1).trim()); continue; }
    const a = line.split(/\s+/);
    if (a.length < 7) continue;
    nodes.push({ id: +a[0], type: +a[1], x: +a[2], y: +a[3], z: +a[4], r: +a[5], parent: +a[6] });
  }
  return { nodes, header };
}
const swcCache = new Map();
export function loadSWC(url) {
  if (!swcCache.has(url)) {
    swcCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`Could not load ${url}`); return r.text(); }).then(parseSWC));
  }
  return swcCache.get(url).then((s) => ({ header: s.header, nodes: s.nodes.map((n) => ({ ...n })) }));
}

/* ------------------------------------------------------------------ tree helpers */
function index(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map(nodes.map((n) => [n.id, []]));
  for (const n of nodes) if (byId.has(n.parent)) kids.get(n.parent).push(n);
  return { byId, kids };
}
const P = (n) => new THREE.Vector3(n.x, n.y, n.z);

/** Soma centre and radius (handles 1-point, 3-point and contour somas). */
export function somaOf(nodes) {
  const s = nodes.filter((n) => n.type === 1);
  if (!s.length) return null;
  const c = new THREE.Vector3();
  s.forEach((n) => c.add(P(n)));
  c.divideScalar(s.length);
  let maxR = 0, meanD = 0;
  s.forEach((n) => { maxR = Math.max(maxR, n.r); meanD += P(n).distanceTo(c); });
  meanD /= s.length;
  return { center: c, radius: Math.max(maxR, meanD * 0.9, 2), ids: new Set(s.map((n) => n.id)) };
}

/** The axon tip furthest (straight-line) from the cell body: a good "end of the main axon". */
export function mainAxonTip(nodes) {
  const { kids } = index(nodes);
  const soma = somaOf(nodes);
  const c = soma ? soma.center : P(nodes[0]);
  let best = null, bd = -1;
  for (const n of nodes) {
    if (n.type !== 2 || kids.get(n.id).length) continue;
    const d = P(n).distanceTo(c);
    if (d > bd) { bd = d; best = n; }
  }
  return best;
}

/** Path distance (µm) between `fromId` and every node, walking the tree in both directions. */
export function geodesic(nodes, fromId) {
  const { byId, kids } = index(nodes);
  const dist = new Map([[fromId, 0]]);
  const stack = [fromId];
  while (stack.length) {
    const id = stack.pop(); const n = byId.get(id); const d = dist.get(id);
    const nb = [...kids.get(id)];
    if (byId.has(n.parent)) nb.push(byId.get(n.parent));
    for (const m of nb) if (!dist.has(m.id)) { dist.set(m.id, d + P(m).distanceTo(P(n))); stack.push(m.id); }
  }
  return dist;
}

/* ------------------------------------------------------------------ geometry builder */
class Buf {
  constructor() { this.pos = []; this.nor = []; this.dist = []; this.rad = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(this.dist, 1));
    g.setAttribute('aRad', new THREE.Float32BufferAttribute(this.rad, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Sample a smooth curve through points (centripetal Catmull–Rom), interpolating radius and distance. */
function sampleCurve(pts, rad, dst, step) {
  if (pts.length < 2) return null;
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null;
  const out = { p: [], r: [], d: [] };
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const L = pts[i].distanceTo(pts[i + 1]);
    const k = Math.max(1, Math.min(8, Math.ceil(L / step)));
    for (let j = 0; j < k; j++) {
      const f = j / k;
      out.p.push(curve ? curve.getPoint((i + f) / (n - 1)) : pts[i].clone().lerp(pts[i + 1], f));
      out.r.push(rad[i] + (rad[i + 1] - rad[i]) * f);
      out.d.push(dst[i] + (dst[i + 1] - dst[i]) * f);
    }
  }
  out.p.push(pts[n - 1].clone()); out.r.push(rad[n - 1]); out.d.push(dst[n - 1]);
  return out;
}

const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Vector3();
/** Append a tube (rings along a sampled path) to a buffer. */
function addTube(buf, s, radial, { capStart = false, capEnd = true } = {}) {
  const m = s.p.length; if (m < 2) return;
  const base = buf.count;
  let prevN = null;
  const T = [];
  for (let i = 0; i < m; i++) {
    const a = s.p[Math.max(0, i - 1)], b = s.p[Math.min(m - 1, i + 1)];
    T.push(_q.subVectors(b, a).normalize().clone());
  }
  for (let i = 0; i < m; i++) {
    const t = T[i];
    if (!prevN) {
      _n.set(0, 1, 0); if (Math.abs(t.dot(_n)) > 0.9) _n.set(1, 0, 0);
      _n.sub(_t.copy(t).multiplyScalar(_n.dot(t))).normalize();
    } else {
      _n.copy(prevN).sub(_t.copy(t).multiplyScalar(prevN.dot(t)));
      if (_n.lengthSq() < 1e-8) { _n.set(0, 1, 0); if (Math.abs(t.dot(_n)) > 0.9) _n.set(1, 0, 0); _n.sub(_t.copy(t).multiplyScalar(_n.dot(t))); }
      _n.normalize();
    }
    prevN = _n.clone();
    _b.crossVectors(t, _n);
    const r = s.r[i], p = s.p[i], d = s.d[i];
    for (let k = 0; k < radial; k++) {
      const th = (k / radial) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const nx = c * _n.x + sn * _b.x, ny = c * _n.y + sn * _b.y, nz = c * _n.z + sn * _b.z;
      buf.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      buf.nor.push(nx, ny, nz);
      buf.dist.push(d);
      buf.rad.push(r);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = base + i * radial + k, b = base + i * radial + ((k + 1) % radial);
      const c = a + radial, e = b + radial;
      buf.idx.push(a, c, b, b, c, e);
    }
  }
  const cap = (i, sign) => {
    const t = T[i], p = s.p[i], r = s.r[i];
    const tip = buf.count;
    buf.pos.push(p.x + t.x * r * 0.9 * sign, p.y + t.y * r * 0.9 * sign, p.z + t.z * r * 0.9 * sign);
    buf.nor.push(t.x * sign, t.y * sign, t.z * sign);
    buf.dist.push(s.d[i]);
    buf.rad.push(r);
    const ring = base + i * radial;
    for (let k = 0; k < radial; k++) {
      const a = ring + k, b = ring + ((k + 1) % radial);
      if (sign > 0) buf.idx.push(a, b, tip); else buf.idx.push(b, a, tip);
    }
  };
  if (capEnd) cap(m - 1, 1);
  if (capStart) cap(0, -1);
}

/* ------------------------------------------------------------------ material with impulse glow + dimming */
const GLOW = '#FFE9A8';
// Thin branches never get thinner than ~1 pixel on screen (so a whole neuron stays visible from far away,
// while close-ups show true thickness). Call updatePixelScale(camera, canvasHeightPx) once per frame.
const PX = { value: 0.002 };
export function updatePixelScale(camera, heightPx) {
  PX.value = (2 * Math.tan(((camera.fov || 30) * Math.PI) / 360)) / Math.max(1, heightPx);
}
function neuronMaterial(color, F, extra = {}) {
  const { glowGain, minPx, swell, ...matOpts } = extra;
  const mat = tissueMaterial(color, { roughness: 0.42, ...matOpts });
  const U = {
    uDim: { value: 0 }, uFocus: { value: 0 }, uFade: { value: 0 },
    uFront: F.front, uWidth: F.width, uDir: F.dir, uGlow: F.glow,
    uGlowCol: { value: new THREE.Color(GLOW) }, uRimCol: { value: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55) },
    uGlowGain: { value: glowGain ?? 1 }, uCalm: F.calm, uPxScale: PX, uMinPx: { value: minPx ?? 1.15 }, uSwell: { value: swell ?? 2.2 },
  };
  mat.userData.U = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aDist;
        attribute float aRad;
        uniform float uPxScale, uMinPx, uFront, uWidth, uDir, uGlow, uSwell;
        varying float vDist;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vDist = aDist;
        if (aRad > 0.0) {
          vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
          float sc = length(modelMatrix[0].xyz);
          float wpp = uPxScale * max(-mv0.z, 0.0) / max(sc, 1e-6);
          float sg = (aDist - uFront) * uDir;
          float gw = max(uWidth, 0.001);
          float gv = (sg > 0.0 ? exp(-sg * sg / (gw * gw)) : 0.7 * exp(-sg * sg / (9.0 * gw * gw))) * uGlow;
          transformed += normal * (max(aRad, uMinPx * wpp) - aRad + gv * uSwell * wpp);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uDim, uFocus, uFade, uFront, uWidth, uDir, uGlow, uGlowGain, uCalm;
        uniform vec3 uGlowCol, uRimCol;
        varying float vDist;
        float glowAt(float d) {
          float s = (d - uFront) * uDir;
          float w = max(uWidth, 0.001);
          float g = s > 0.0 ? exp(-s * s / (w * w)) : 0.7 * exp(-s * s / (9.0 * w * w));
          return g * uGlow;
        }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float gl = glowAt(vDist);
        vec3 base = diffuse;
        float lum = dot(base, vec3(0.3, 0.59, 0.11));
        base = mix(base, vec3(lum) * vec3(0.55, 0.6, 0.75), uDim * 0.6);
        base = mix(base, uGlowCol, clamp(gl, 0.0, 1.0) * 0.75 * min(uGlowGain, 1.0));
        vec4 diffuseColor = vec4(base, opacity * (1.0 - uFade));`)
      .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, vec3(0.025, 0.035, 0.07), uDim * 0.78);
        #include <opaque_fragment>`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        totalEmissiveRadiance += uGlowCol * gl * uGlowGain * (uCalm > 0.5 ? 0.25 : 1.6);
        totalEmissiveRadiance += uRimCol * fres * uFocus * (uCalm > 0.5 ? 0.0 : 0.35);`);
  };
  mat.customProgramCacheKey = () => 'neuron-glow-v4';
  return mat;
}

/* ------------------------------------------------------------------ build */
const PART_COLORS = {
  dendrites: '#C99BE0', soma: '#F09C8A', nucleus: '#6E4AA8', axon: '#EDB487',
  myelin: '#F4F8FF', nodes: '#3FE0F0', terminals: '#FFC65C',
};

/**
 * @param {{nodes: object[]}} swc
 * @param {object} opts
 *  minRadius (µm, visual minimum), radiusScale, step (µm sampling), radial (ring segments),
 *  colors {part: css}, nucleus (bool), myelin {start, internode, gap, radius|thickness, end, path:'main'|nodeId[]},
 *  terminals {radius, min (µm path distance)}, somaScale
 */
export function buildNeuron(swc, opts = {}) {
  const o = { minRadius: 0.8, radiusScale: 1, step: 3, radial: 7, nucleus: true, somaScale: 1, minPx: 1.15, ...opts };
  const colors = { ...PART_COLORS, ...(o.colors || {}) };
  const nodes = swc.nodes;
  const { byId, kids } = index(nodes);
  const soma = somaOf(nodes);
  const isSoma = (n) => soma && soma.ids.has(n.id);
  const partOf = (n) => n.part || (n.type === 1 ? 'soma' : n.type === 2 ? 'axon' : 'dendrites');
  const vr = (n) => Math.max(o.minRadius, n.r * o.radiusScale) * (n.rScale || 1);

  // path distance from the cell body (or the root), unless nodes carry their own `d`
  const D = new Map();
  const roots = nodes.filter((n) => !byId.has(n.parent));
  const order = [];
  {
    const stack = roots.map((r) => r.id);
    while (stack.length) { const id = stack.pop(); order.push(id); for (const k of kids.get(id)) stack.push(k.id); }
  }
  for (const id of order) {
    const n = byId.get(id);
    if (n.d != null) { D.set(id, n.d); continue; }
    if (isSoma(n) || !byId.has(n.parent)) { D.set(id, 0); continue; }
    const p = byId.get(n.parent);
    D.set(id, isSoma(p) ? P(n).distanceTo(soma.center) : D.get(p.id) + P(n).distanceTo(P(p)));
  }

  // ---- sections (unbranched runs) → tubes per part
  const bufs = {};
  const buf = (part) => (bufs[part] ||= new Buf());
  const extent = { dendrites: 0, axon: 0 };
  const starts = [];
  for (const n of nodes) {
    if (isSoma(n)) continue;
    const p = byId.get(n.parent);
    if (!p || isSoma(p) || kids.get(p.id).length !== 1 || partOf(p) !== partOf(n)) starts.push(n);
  }
  for (const s of starts) {
    const part = partOf(s);
    const chain = [s];
    let cur = s;
    while (kids.get(cur.id).length === 1 && partOf(kids.get(cur.id)[0]) === part) { cur = kids.get(cur.id)[0]; chain.push(cur); }
    const p = byId.get(s.parent);
    const pts = [], rad = [], dst = [];
    let capStart = false;
    if (p && isSoma(p)) {
      const dir = P(s).sub(soma.center).normalize();
      pts.push(soma.center.clone().addScaledVector(dir, soma.radius * o.somaScale * 0.55)); rad.push(vr(s) * 1.4); dst.push(0);
    } else if (p) { pts.push(P(p)); rad.push(Math.min(vr(p), vr(s) * 1.5)); dst.push(D.get(p.id)); }
    else capStart = true;
    for (const c of chain) { pts.push(P(c)); rad.push(vr(c)); dst.push(D.get(c.id)); }
    if (pts.length < 2) continue;
    const thick = rad[0] > o.minRadius * 2.2;
    const sm = sampleCurve(pts, rad, dst, o.step);
    addTube(buf(part), sm, thick ? o.radial + 3 : o.radial, { capStart, capEnd: !kids.get(cur.id).length });
    if (part in extent) for (const d of dst) extent[part] = Math.max(extent[part], Math.abs(d));
  }

  const group = new THREE.Group();
  group.name = 'neuron';
  // impulse "fronts": one for dendrites (inflow), one for the axon side (outflow)
  const calm = { value: get('calm') === 'true' ? 1 : 0 };
  const fronts = {
    dendrites: { front: { value: -1e6 }, width: { value: 30 }, dir: { value: -1 }, glow: { value: 0 }, calm },
    axon: { front: { value: -1e6 }, width: { value: 30 }, dir: { value: 1 }, glow: { value: 0 }, calm },
    soma: { front: { value: 0 }, width: { value: 1e9 }, dir: { value: 1 }, glow: { value: 0 }, calm },
  };
  const meshes = {};
  const mats = {};
  const addMesh = (part, geo, mat) => {
    const m = new THREE.Mesh(geo, mat); m.name = part;
    group.add(m); meshes[part] = m; mats[part] = mat; return m;
  };
  if (bufs.dendrites) addMesh('dendrites', bufs.dendrites.geometry(), neuronMaterial(colors.dendrites, fronts.dendrites, { minPx: o.minPx }));
  if (bufs.axon) addMesh('axon', bufs.axon.geometry(), neuronMaterial(colors.axon, fronts.axon, { minPx: o.minPx }));
  for (const k of Object.keys(bufs)) if (!meshes[k]) addMesh(k, bufs[k].geometry(), neuronMaterial(colors[k] || colors.dendrites, fronts.dendrites, { minPx: o.minPx }));

  // ---- soma: a smooth body that swells towards each stem (a "hillock" for every process)
  if (soma) {
    const R = soma.radius * o.somaScale;
    const g = new THREE.IcosahedronGeometry(R, 5);
    const stems = [];
    for (const s of nodes) if (!isSoma(s) && byId.get(s.parent) && isSoma(byId.get(s.parent))) {
      stems.push({ d: P(s).sub(soma.center).normalize(), w: Math.min(1, vr(s) / R * 3.2 + 0.25) });
    }
    const pos = g.attributes.position; const v = new THREE.Vector3(); const nn = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); nn.copy(v).normalize();
      let push = 0;
      for (const st of stems) { const c = nn.dot(st.d); if (c > 0.5) { const u = (c - 0.5) / 0.5; push = Math.max(push, st.w * u * u * u); } }
      v.multiplyScalar(1 + 0.55 * push);
      v.add(soma.center); pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(new Float32Array(pos.count), 1));
    addMesh('soma', g, neuronMaterial(colors.soma, fronts.soma, { transparent: true, depthWrite: true }));
    if (o.nucleus) {
      const ng = new THREE.SphereGeometry(R * 0.42, 32, 24);
      ng.translate(soma.center.x, soma.center.y, soma.center.z);
      ng.setAttribute('aDist', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count), 1));
      const nm = addMesh('nucleus', ng, neuronMaterial(colors.nucleus, fronts.soma, { roughness: 0.35 }));
      const nl = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 20, 14), nm.material);
      nl.geometry.translate(soma.center.x + R * 0.12, soma.center.y + R * 0.1, soma.center.z + R * 0.3);
      nl.geometry.setAttribute('aDist', new THREE.Float32BufferAttribute(new Float32Array(nl.geometry.attributes.position.count), 1));
      nm.add(nl);
      nm.visible = false;
    }
  }

  // ---- main axon path (cell body → furthest axon tip): myelin sits along it
  let mainPath = null;
  const tip = mainAxonTip(nodes);
  if (tip) {
    const chain = [];
    for (let n = tip; n && !isSoma(n); n = byId.get(n.parent)) chain.push(n);
    chain.reverse();
    const pts = chain.map(P), rad = chain.map(vr), dst = chain.map((n) => D.get(n.id));
    if (soma) { pts.unshift(soma.center.clone()); rad.unshift(rad[0]); dst.unshift(0); }
    mainPath = sampleCurve(pts, rad, dst, 2);
    mainPath.ids = chain.map((n) => n.id);
  }
  const pathAt = (path, d) => {           // point/radius at path distance d
    const ds = path.d; let i = 1;
    while (i < ds.length - 1 && ds[i] < d) i++;
    const f = THREE.MathUtils.clamp((d - ds[i - 1]) / Math.max(1e-6, ds[i] - ds[i - 1]), 0, 1);
    return { p: path.p[i - 1].clone().lerp(path.p[i], f), r: path.r[i - 1] + (path.r[i] - path.r[i - 1]) * f, i };
  };
  const subPath = (path, d0, d1, stepD) => {
    const out = { p: [], r: [], d: [] };
    const k = Math.max(2, Math.ceil((d1 - d0) / stepD));
    for (let j = 0; j <= k; j++) { const d = d0 + ((d1 - d0) * j) / k; const a = pathAt(path, d); out.p.push(a.p); out.r.push(a.r); out.d.push(d); }
    return out;
  };

  const myelinInfo = { sheaths: [], nodes: [], start: 0, end: 0 };
  if (o.myelin && mainPath) {
    const m = { start: 30, internode: 80, gap: 8, thickness: 2.3, endPad: 40, ...o.myelin };
    const total = mainPath.d[mainPath.d.length - 1];
    const end = m.end ?? total - m.endPad;
    const sheathBuf = new Buf(), nodeBuf = new Buf();
    let s0 = m.start;
    myelinInfo.start = m.start;
    while (s0 + m.internode * 0.5 < end) {
      const s1 = Math.min(end, s0 + m.internode);
      const sp = subPath(mainPath, s0, s1, Math.max(1.5, m.internode / 40));
      const L = s1 - s0;
      const rIn = sp.r.map((r) => r);
      const rOut = m.radius || Math.max(...rIn) * m.thickness;
      sp.r = sp.d.map((d, j) => {
        const u = Math.min(d - s0, s1 - d) / Math.min(L / 2, rOut * 2.2);
        const k = Math.min(1, u);
        return rIn[j] * 1.05 + (rOut - rIn[j] * 1.05) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
      });
      addTube(sheathBuf, sp, 18, { capStart: false, capEnd: false });
      myelinInfo.sheaths.push({ d0: s0, d1: s1, mid: pathAt(mainPath, (s0 + s1) / 2).p, r: rOut });
      const nd = s1 + m.gap / 2;
      if (nd < total - 4) {
        const np = subPath(mainPath, nd - m.gap * 0.32, nd + m.gap * 0.32, m.gap * 0.2);
        np.r = np.r.map((r) => r * 1.45);
        addTube(nodeBuf, np, 16, { capStart: true, capEnd: true });
        myelinInfo.nodes.push({ d: nd, p: pathAt(mainPath, nd).p });
      }
      myelinInfo.end = s1;
      s0 = s1 + m.gap;
    }
    if (sheathBuf.count) addMesh('myelin', sheathBuf.geometry(), neuronMaterial(colors.myelin, fronts.axon, { roughness: 0.3, clearcoat: 0.6, glowGain: 0.12, minPx: o.minPx * 2.3, swell: 0 }));
    if (nodeBuf.count) addMesh('nodes', nodeBuf.geometry(), neuronMaterial(colors.nodes, fronts.axon, { glowGain: 1.3, minPx: o.minPx * 1.65 }));
  }

  // ---- terminal buttons: a swelling at the end of each axon branch
  const termInfo = [];
  if (o.terminals !== false) {
    const t = { radius: 2.2, min: 0, ...(o.terminals || {}) };
    for (const n of nodes) {
      if (partOf(n) !== 'axon' || kids.get(n.id).length || isSoma(n) || D.get(n.id) < t.min || n.noTerminal) continue;
      const p = byId.get(n.parent);
      const dir = p ? P(n).sub(P(p)).normalize() : new THREE.Vector3(0, 1, 0);
      const r = (n.terminalRadius || t.radius);
      termInfo.push({ p: P(n).addScaledVector(dir, r * 0.55), r, d: D.get(n.id), dir, id: n.id });
    }
    if (termInfo.length) {
      const sg = new THREE.SphereGeometry(1, 18, 12);
      const im = new THREE.InstancedMesh(sg, neuronMaterial(colors.terminals, fronts.axon, { glowGain: 1.2 }), termInfo.length);
      const dAttr = new Float32Array(termInfo.length);
      const mtx = new THREE.Matrix4();
      termInfo.forEach((ti, i) => { mtx.makeScale(ti.r, ti.r * 0.92, ti.r).setPosition(ti.p); im.setMatrixAt(i, mtx); dAttr[i] = ti.d; });
      sg.setAttribute('aDist', new THREE.InstancedBufferAttribute(dAttr, 1));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.name = 'terminals';
      group.add(im); meshes.terminals = im; mats.terminals = im.material;
    }
  }

  // ---------------------------------------------------------------- state & API
  const dimT = {}, dimC = {}, focT = {}, focC = {};
  for (const k of Object.keys(mats)) { dimT[k] = dimC[k] = 0; focT[k] = focC[k] = 0; }
  let somaOpacityT = 1, somaOpacityC = 1;
  const maxDist = { dendrites: extent.dendrites, axon: Math.max(extent.axon, mainPath ? mainPath.d[mainPath.d.length - 1] : 0) };
  const world = (v) => { group.updateWorldMatrix(true, false); return group.localToWorld(v.clone()); };

  // a few useful anchor points (local coords)
  const anchors = {};
  if (soma) { anchors.soma = soma.center.clone(); anchors.nucleus = soma.center.clone(); }
  {
    let best = null, bs = -1;
    const c = soma ? soma.center : P(nodes[0]);
    for (const n of nodes) {
      if (partOf(n) !== 'dendrites') continue;
      const d = D.get(n.id); const md = maxDist.dendrites || 1;
      if (Math.abs(d) < md * 0.35 || Math.abs(d) > md * 0.7) continue;
      const sc = P(n).distanceTo(c);
      if (sc > bs) { bs = sc; best = n; }
    }
    if (best) anchors.dendrites = P(best);
  }
  if (mainPath) {
    anchors.axon = pathAt(mainPath, Math.min(maxDist.axon * 0.35, (myelinInfo.sheaths[0]?.d0 ?? 30) * 0.6 + 6)).p;
    anchors.axonMid = pathAt(mainPath, maxDist.axon * 0.5).p;
    anchors.axonEnd = pathAt(mainPath, maxDist.axon).p;
  }
  if (myelinInfo.sheaths.length) anchors.myelin = myelinInfo.sheaths[Math.min(1, myelinInfo.sheaths.length - 1)].mid;
  if (myelinInfo.nodes.length) anchors.nodes = myelinInfo.nodes[Math.min(1, myelinInfo.nodes.length - 1)].p;
  if (termInfo.length) {
    const far = termInfo.reduce((a, b) => (b.d > a.d ? b : a));
    anchors.terminals = far.p.clone();
  }

  const model = {
    group, meshes, soma, mainPath, myelin: myelinInfo, terminals: termInfo, maxDist, nodes, D,
    colors,
    /** Light these parts and dim the rest. null/undefined = everything lit, no focus rim. */
    highlight(parts, { instant = false, focus = true } = {}) {
      for (const k of Object.keys(mats)) {
        const on = !parts || parts.includes(k) || (k === 'nucleus' && parts.includes('soma'));
        dimT[k] = on ? 0 : 1;
        focT[k] = parts && on && focus ? 1 : 0;
        if (instant) { dimC[k] = dimT[k]; focC[k] = focT[k]; }
      }
      this.apply();
    },
    /** Make the cell body see-through (to show the nucleus). */
    showNucleus(on, { instant = false } = {}) {
      somaOpacityT = on ? 0.38 : 1;
      if (instant) somaOpacityC = somaOpacityT;
      if (meshes.nucleus) meshes.nucleus.visible = on || somaOpacityC < 0.99;
      this.apply();
    },
    setVisible(part, on) { if (meshes[part]) meshes[part].visible = on; },
    /** Position (µm path distance) of the glowing band. side: 'axon' | 'dendrites' | 'soma'. glow 0..1 */
    setFront(side, d, glow = 1, width) {
      const f = fronts[side]; if (!f) return;
      if (side === 'soma') { f.glow.value = glow; return; }
      f.front.value = d; f.glow.value = glow; if (width != null) f.width.value = width;
    },
    /** +1: the band moves away from the cell body (axon); -1: towards it (dendrites, the default). */
    setDirection(side, dir) { if (fronts[side]) fronts[side].dir.value = dir; },
    clearSignals() { for (const k in fronts) { fronts[k].glow.value = 0; if (k !== 'soma') fronts[k].front.value = -1e6; } },
    /** Front position for progress u (0..1) along the axon. With myelin the band rests on a node, then hops. */
    axonFrontAt(u) {
      const total = maxDist.axon;
      const ns = myelinInfo.nodes;
      u = Math.min(1, Math.max(0, u));
      if (!ns.length) return u * total;
      // stops: cell body, start of the myelin, every node, end. Bare stretches are crossed smoothly;
      // each myelinated stretch is a quick hop (the band waits at a node, then jumps to the next one).
      const stops = [0, myelinInfo.start, ...ns.map((n) => n.d), total];
      const meanGap = (ns[ns.length - 1].d - myelinInfo.start) / Math.max(1, ns.length);
      const segs = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const len = stops[i + 1] - stops[i];
        const hop = i >= 1 && i <= ns.length;          // myelinated internode
        segs.push({ a: stops[i], b: stops[i + 1], hop, w: hop ? 0.42 : Math.max(0.05, len / meanGap) });
      }
      const W = segs.reduce((s2, g) => s2 + g.w, 0);
      let x = u * W;
      for (const g of segs) {
        if (x <= g.w) { const f = x / g.w; return g.a + (g.b - g.a) * (g.hop ? THREE.MathUtils.smoothstep(f, 0.55, 1.0) : f); }
        x -= g.w;
      }
      return total;
    },
    /** World position at path distance d along the main axon (cell body → furthest axon tip). */
    pointAt(d) { return mainPath ? world(pathAt(mainPath, THREE.MathUtils.clamp(d, 0, mainPath.d[mainPath.d.length - 1])).p) : null; },
    anchor(name) { const a = anchors[name]; return a ? world(a) : null; },
    anchorLocal(name) { return anchors[name]?.clone() || null; },
    toWorld: world,
    /** World-space Box3 of the whole neuron (or of the nodes of some parts). */
    box(parts) {
      group.updateWorldMatrix(true, false);
      const b = new THREE.Box3();
      const add = (v) => b.expandByPoint(world(v));
      if (!parts) { for (const n of nodes) add(P(n)); if (soma) { const r = soma.radius; add(soma.center.clone().addScalar(r)); add(soma.center.clone().addScalar(-r)); } }
      else {
        for (const n of nodes) if (parts.includes(partOf(n)) || (parts.includes('soma') && isSoma(n))) add(P(n));
        if (parts.includes('soma') && soma) { const r = soma.radius * 1.4; add(soma.center.clone().addScalar(r)); add(soma.center.clone().addScalar(-r)); }
        if (parts.includes('terminals')) termInfo.forEach((t) => add(t.p));
      }
      return b;
    },
    /** World-space points from a dendrite node nearest `worldPoint` back to the cell body. */
    pathToSoma(worldPoint) {
      const lp = group.worldToLocal(worldPoint.clone());
      let best = null, bd = Infinity;
      for (const n of nodes) { if (partOf(n) !== 'dendrites') continue; const d = P(n).distanceToSquared(lp); if (d < bd) { bd = d; best = n; } }
      const pts = [];
      for (let n = best; n && !isSoma(n); n = byId.get(n.parent)) pts.push(world(P(n)));
      if (soma) pts.push(world(soma.center));
      return pts;
    },
    nearestNode(worldPoint, part = 'dendrites') {
      const lp = group.worldToLocal(worldPoint.clone());
      let best = null, bd = Infinity;
      for (const n of nodes) { if (partOf(n) !== part) continue; const d = P(n).distanceToSquared(lp); if (d < bd) { bd = d; best = n; } }
      return best ? { node: best, p: world(P(best)), d: D.get(best.id) } : null;
    },
    apply() {
      for (const k of Object.keys(mats)) { mats[k].userData.U.uDim.value = dimC[k]; mats[k].userData.U.uFocus.value = focC[k]; }
      if (mats.soma) {
        mats.soma.opacity = somaOpacityC;
        mats.soma.depthWrite = somaOpacityC > 0.99;
      }
      if (meshes.nucleus) meshes.nucleus.visible = somaOpacityC < 0.99;
      calm.value = get('calm') === 'true' ? 1 : 0;
    },
    /** Ease dims/focus/opacity towards their targets. Returns true while still changing. */
    update(dt) {
      let busy = false;
      const k = 1 - Math.exp(-dt * 7);
      for (const key of Object.keys(mats)) {
        if (Math.abs(dimC[key] - dimT[key]) > 0.002 || Math.abs(focC[key] - focT[key]) > 0.002) {
          dimC[key] += (dimT[key] - dimC[key]) * k; focC[key] += (focT[key] - focC[key]) * k; busy = true;
        } else { dimC[key] = dimT[key]; focC[key] = focT[key]; }
      }
      if (Math.abs(somaOpacityC - somaOpacityT) > 0.003) { somaOpacityC += (somaOpacityT - somaOpacityC) * k; busy = true; } else somaOpacityC = somaOpacityT;
      this.apply();
      return busy;
    },
    dispose() {
      group.traverse((o2) => { o2.geometry?.dispose(); });
      Object.values(mats).forEach((m) => m.dispose());
      group.removeFromParent();
    },
  };
  model.highlight(null, { instant: true });
  return model;
}

/** A straight, synthetic axon (for demos such as myelinated v. unmyelinated). Units: µm. */
export function straightAxonNodes(length, { radius = 1, step = 20, start = new THREE.Vector3(), dir = new THREE.Vector3(1, 0, 0) } = {}) {
  const nodes = [];
  const n = Math.ceil(length / step);
  for (let i = 0; i <= n; i++) {
    const p = start.clone().addScaledVector(dir, (length * i) / n);
    nodes.push({ id: i + 1, type: 2, x: p.x, y: p.y, z: p.z, r: radius, parent: i === 0 ? -1 : i, drawn: true });
  }
  return nodes;
}

/** A soft glowing dot (additive sprite) to mark the impulse in wide shots. Calm mode: a small solid dot. */
let sparkTex = null;
export function createSpark(color = GLOW, size = 1) {
  if (!sparkTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.22, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.28)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    sparkTex = new THREE.CanvasTexture(c); sparkTex.colorSpace = THREE.SRGBColorSpace;
  }
  const calm = get('calm') === 'true';
  const m = new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, depthTest: false, depthWrite: false,
    blending: calm ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false });
  const sp = new THREE.Sprite(m);
  sp.scale.setScalar(size * (calm ? 0.6 : 1));
  sp.renderOrder = 10;
  sp.visible = false;
  return sp;
}
