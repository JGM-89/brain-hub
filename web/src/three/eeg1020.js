// International 10–20 EEG electrode positions, computed geometrically on the real head surface
// (FreeSurfer fsaverage outer skin, in the brain model's glTF space, mm).
//
// Method (after Jasper 1958; automated as in Jurcak, Tsuzuki & Dan 2007):
//   1. Landmarks: nasion, LPA and RPA are the published fsaverage fiducials. The inion is not
//      supplied by fsaverage, so we take the template inion (Iz of MNE's standard_1005 montage, which
//      shares these fiducials: RAS 0, −118.6, −23.1 mm) and project it onto the mid-sagittal contour
//      of the head mesh (the nearest point of the contour in the plane normal to the LPA–RPA axis).
//   2. Every "arc" is the head-surface contour cut by a plane through three points. The contour is
//      found by intersecting the plane with every triangle of the head mesh, then sampled by angle
//      around the arc's centre and measured by arc length.
//   3. Electrodes sit at 10 % / 20 % steps of arc length:
//      nasion–inion (Fpz Fz Cz Pz Oz), LPA–Cz–RPA (T7 C3 Cz C4 T8), the circumference through
//      Fpz–T7–Oz and Fpz–T8–Oz (Fp1 F7 T7 P7 O1 / Fp2 F8 T8 P8 O2), and F3/F4, P3/P4 halfway between
//      the midline and the circumference on the F7–Fz–F8 and P7–Pz–P8 arcs.
//   Cz is iterated so that it is the midpoint of BOTH the nasion–inion and LPA–RPA arcs.
// Modern names are used: T7/T8/P7/P8 (the same positions were called T3/T4/T5/T6 in the original 10–20 papers).
import * as THREE from 'three';
import landmarks from '../data/landmarks.json';

const V = (a) => new THREE.Vector3(...a);

/** Head vertices + triangle indices in the model's (glTF) space. */
function headData(head) {
  head.updateMatrix();
  const m = head.matrix; // head is a direct child of viewer.model
  const pa = head.geometry.attributes.position, na = head.geometry.attributes.normal;
  const pos = new Float32Array(pa.count * 3), nrm = new Float32Array(pa.count * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], i * 3);
    if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
  }
  const index = head.geometry.index ? head.geometry.index.array : Uint32Array.from({ length: pa.count }, (_, i) => i);
  return { pos, nrm, index, count: pa.count };
}

/**
 * Contour of the head surface in the plane through O spanned by u (towards the start point) and w
 * (towards the "top" of the arc). Returns points for angles 0..π (start → over the top → end).
 */
function planeContour(H, O, u, w, bins = 721) {
  const n = new THREE.Vector3().crossVectors(u, w).normalize();
  const r = new Float32Array(bins).fill(-1);
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const d = [0, 0, 0], q = new THREE.Vector3(), t = new THREE.Vector3();
  const { pos, index } = H;
  for (let f = 0; f < index.length; f += 3) {
    for (let k = 0; k < 3; k++) { const i = index[f + k] * 3; p[k].set(pos[i], pos[i + 1], pos[i + 2]); d[k] = t.subVectors(p[k], O).dot(n); }
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if ((d[a] > 0) === (d[b] > 0)) continue;
      q.lerpVectors(p[a], p[b], d[a] / (d[a] - d[b]));
      t.subVectors(q, O);
      const x = t.dot(u), y = t.dot(w);
      if (y < -3) continue;
      const ang = Math.atan2(Math.max(y, 0), x);
      const bi = Math.round((ang / Math.PI) * (bins - 1));
      const rr = Math.hypot(x, y);
      if (rr > r[bi]) r[bi] = rr;
    }
  }
  // fill any empty bins by linear interpolation
  let last = -1;
  for (let i = 0; i < bins; i++) {
    if (r[i] < 0) continue;
    if (last >= 0 && i - last > 1) for (let j = last + 1; j < i; j++) r[j] = r[last] + (r[i] - r[last]) * (j - last) / (i - last);
    if (last < 0) for (let j = 0; j < i; j++) r[j] = r[i];
    last = i;
  }
  for (let j = last + 1; j < bins; j++) r[j] = r[last];
  const pts = [];
  for (let i = 0; i < bins; i++) {
    const ang = (i / (bins - 1)) * Math.PI;
    pts.push(O.clone().addScaledVector(u, Math.cos(ang) * r[i]).addScaledVector(w, Math.sin(ang) * r[i]));
  }
  return pts;
}

class Arc {
  constructor(pts) {
    this.pts = pts;
    this.s = [0];
    for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.s[this.s.length - 1];
  }
  at(frac) { return this.atLength(frac * this.len); }
  atLength(L) {
    const s = this.s; let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid] < L) lo = mid; else hi = mid; }
    const f = (L - s[lo]) / Math.max(1e-9, s[hi] - s[lo]);
    return this.pts[lo].clone().lerp(this.pts[hi], THREE.MathUtils.clamp(f, 0, 1));
  }
  lengthAt(p) {
    let best = 0, bd = Infinity;
    this.pts.forEach((q, i) => { const dd = q.distanceToSquared(p); if (dd < bd) { bd = dd; best = i; } });
    return this.s[best];
  }
}

/** Arc over the head from a to b, passing through (or towards) "via". */
function arcThrough(H, a, b, via) {
  const O = a.clone().add(b).multiplyScalar(0.5);
  const u = a.clone().sub(O).normalize();
  const w = via.clone().sub(O); w.addScaledVector(u, -w.dot(u)).normalize();
  return new Arc(planeContour(H, O, u, w));
}

let cache = null;

/**
 * @param {THREE.Mesh} head viewer.head (child of viewer.model)
 * @returns {{ electrodes: Record<string,{pos:THREE.Vector3, normal:THREE.Vector3}>, fiducials, arcs: THREE.Vector3[][] }}
 *   all in viewer.model space (glTF, mm)
 */
export function compute1020(head) {
  if (cache?.head === head.geometry) return cache.result;
  const H = headData(head);
  const N = V(landmarks.fiducials_gltf_mm.nasion), L = V(landmarks.fiducials_gltf_mm.lpa), R = V(landmarks.fiducials_gltf_mm.rpa);
  const up = new THREE.Vector3(0, 1, 0);

  // --- derive the inion: mid-sagittal plane, opposite the nasion from the ear midpoint
  const O = L.clone().add(R).multiplyScalar(0.5);
  const lat = L.clone().sub(R).normalize();
  const fwd = N.clone().sub(O); fwd.addScaledVector(lat, -fwd.dot(lat)).normalize();
  const top = new THREE.Vector3().crossVectors(lat, fwd).normalize();
  if (top.dot(up) < 0) top.negate();
  const mid = planeContour(H, O, fwd, top);
  const IZ_TEMPLATE = new THREE.Vector3(0, -23.1, -118.6);   // RAS (0, −118.6, −23.1) in glTF axes
  let I = mid[0];
  for (const p of mid) if (p.distanceToSquared(IZ_TEMPLATE) < I.distanceToSquared(IZ_TEMPLATE)) I = p;
  I = I.clone();

  // --- Cz: midpoint of both the nasion–inion and LPA–RPA arcs (iterate to agree)
  let Cz = O.clone().addScaledVector(top, 100);
  let sag, cor;
  for (let k = 0; k < 4; k++) {
    sag = arcThrough(H, N, I, Cz);
    Cz = sag.at(0.5);
    cor = arcThrough(H, L, R, Cz);
    Cz = cor.at(0.5);
  }
  sag = arcThrough(H, N, I, Cz);
  const e = {};
  const put = (name, p) => { e[name] = p; };
  put('Fpz', sag.at(0.1)); put('Fz', sag.at(0.3)); put('Cz', Cz); put('Pz', sag.at(0.7)); put('Oz', sag.at(0.9));
  put('T7', cor.at(0.1)); put('C3', cor.at(0.3)); put('C4', cor.at(0.7)); put('T8', cor.at(0.9));
  // circumference, each half through T7 or T8
  const cl = arcThrough(H, e.Fpz, e.Oz, e.T7), cr = arcThrough(H, e.Fpz, e.Oz, e.T8);
  put('Fp1', cl.at(0.1)); put('F7', cl.at(0.3)); put('P7', cl.at(0.7)); put('O1', cl.at(0.9));
  put('Fp2', cr.at(0.1)); put('F8', cr.at(0.3)); put('P8', cr.at(0.7)); put('O2', cr.at(0.9));
  // F3/F4 and P3/P4: halfway between the circumference and the midline
  const fa = arcThrough(H, e.F7, e.F8, e.Fz), sFz = fa.lengthAt(e.Fz);
  put('F3', fa.atLength(sFz / 2)); put('F4', fa.atLength((sFz + fa.len) / 2));
  const pa = arcThrough(H, e.P7, e.P8, e.Pz), sPz = pa.lengthAt(e.Pz);
  put('P3', pa.atLength(sPz / 2)); put('P4', pa.atLength((sPz + pa.len) / 2));

  // outward normal = normal of the nearest head vertex
  const electrodes = {};
  const tmp = new THREE.Vector3();
  for (const [name, p] of Object.entries(e)) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < H.count; i++) { tmp.set(H.pos[i * 3], H.pos[i * 3 + 1], H.pos[i * 3 + 2]); const dd = tmp.distanceToSquared(p); if (dd < bd) { bd = dd; best = i; } }
    const normal = new THREE.Vector3(H.nrm[best * 3], H.nrm[best * 3 + 1], H.nrm[best * 3 + 2]);
    if (normal.lengthSq() < 0.5 || normal.dot(p.clone().sub(O)) < 0) normal.copy(p).sub(O).normalize();
    electrodes[name] = { pos: p, normal: normal.normalize() };
  }
  const arcs = [sag, cor, cl, cr, fa, pa].map((a) => a.pts);
  const result = { electrodes, fiducials: { nasion: N, inion: I, lpa: L, rpa: R }, arcs, arcLengths: { nasionInion: sag.len, lpaRpa: cor.len } };
  cache = { head: head.geometry, result };
  return result;
}

export const ELECTRODE_ORDER = ['Fp1', 'Fpz', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P7', 'P3', 'Pz', 'P4', 'P8', 'O1', 'Oz', 'O2'];
