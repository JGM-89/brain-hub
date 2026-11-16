// EEG "rig" on the real fsaverage head: a mannequin-style scalp that can show an (illustrative)
// colour map of where brain waves are biggest, 10–20 electrodes placed by eeg1020.js, and the
// measuring arcs of the 10–20 system. Everything is added to viewer.model (glTF space, mm).
import * as THREE from 'three';
import { compute1020, ELECTRODE_ORDER } from './eeg1020.js';

// Illustrative amplitude maps (where each rhythm is largest), as weights on electrode sites.
// Based on standard clinical EEG descriptions: alpha is posterior-dominant (eyes closed);
// beta is mostly frontal–central and small; deep-sleep delta is frontally dominant;
// generalised 3 Hz spike-and-wave (absence seizure) is widespread, frontal-maximal.
export const MAPS = {
  alert: { sites: { F3: 1, F4: 1, Fz: 0.9, C3: 0.8, C4: 0.8, Cz: 0.7 }, sigma: 48, gain: 0.35 },
  relaxed: { sites: { O1: 1, O2: 1, Oz: 1, P3: 0.75, P4: 0.75, Pz: 0.7, P7: 0.5, P8: 0.5 }, sigma: 46, gain: 0.8 },
  sleep: { sites: { Fz: 1, F3: 0.9, F4: 0.9, Fpz: 0.9, Fp1: 0.8, Fp2: 0.8, Cz: 0.6 }, sigma: 70, gain: 1 },
  seizure: { sites: { Fz: 1, F3: 1, F4: 1, Fp1: 0.9, Fp2: 0.9, Cz: 0.9, C3: 0.8, C4: 0.8, Pz: 0.7, P3: 0.6, P4: 0.6 }, sigma: 85, gain: 1 },
  vep: { sites: { O1: 1, O2: 1, Oz: 1.1, Pz: 0.35 }, sigma: 40, gain: 1 },
  p300: { sites: { Pz: 1, Cz: 0.75, P3: 0.7, P4: 0.7 }, sigma: 55, gain: 1 },
  none: { sites: {}, sigma: 50, gain: 0 },
};

export function createEegRig(viewer) {
  const head = viewer.head;
  const R = compute1020(head);
  const group = new THREE.Group(); group.name = 'eeg-rig';
  viewer.model.add(group);
  head.updateMatrix();

  // ---- scalp with a colour-map attribute
  const geo = head.geometry.clone();
  const n = geo.attributes.position.count;
  const mapAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
  geo.setAttribute('aMap', mapAttr);
  const P = []; const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) P.push(v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(head.matrix).clone());
  const uni = { uMapOn: { value: 0 } };
  const scalpMat = new THREE.MeshPhysicalMaterial({
    color: '#A9B4CB', roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35,
    transparent: true, opacity: 1, side: THREE.FrontSide,
  });
  scalpMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMap; varying float vMap;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMap = aMap;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uMapOn; varying float vMap;
      vec3 bxMagma(float t) {
        vec3 a = vec3(0.05, 0.02, 0.28), b = vec3(0.45, 0.02, 0.32), c = vec3(0.95, 0.18, 0.04), d = vec3(1.0, 0.72, 0.08);
        return t < 0.33 ? mix(a, b, t / 0.33) : t < 0.66 ? mix(b, c, (t - 0.33) / 0.33) : mix(c, d, (t - 0.66) / 0.34);
      }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float m = clamp(vMap, 0.0, 1.0) * uMapOn;
        vec3 mc = bxMagma(0.2 + 0.8 * m);
        float k = smoothstep(0.08, 0.3, m) * 0.92;
        vec4 diffuseColor = vec4(mix(diffuse, mc, k), opacity);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += mc * k * 0.25;');
  };
  scalpMat.customProgramCacheKey = () => 'bx-scalp-v1';
  const scalp = new THREE.Mesh(geo, scalpMat);
  scalp.position.copy(head.position); scalp.quaternion.copy(head.quaternion); scalp.scale.copy(head.scale);
  scalp.renderOrder = 4;
  scalp.raycast = () => {};
  group.add(scalp);

  // ---- electrodes: a metal cup + a coloured rim, sitting on the scalp along its normal
  const cupGeo = new THREE.CylinderGeometry(5.4, 5.4, 2.4, 28);
  const rimGeo = new THREE.TorusGeometry(6.0, 1.1, 10, 32);
  const metal = new THREE.MeshPhysicalMaterial({ color: '#C9D0DC', metalness: 0.55, roughness: 0.42, clearcoat: 0.3 });
  const electrodes = {};
  const yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1);
  for (const name of ELECTRODE_ORDER) {
    const e = R.electrodes[name];
    const g = new THREE.Group();
    g.position.copy(e.pos).addScaledVector(e.normal, 1.2);
    const cup = new THREE.Mesh(cupGeo, metal);
    cup.quaternion.setFromUnitVectors(yAxis, e.normal);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#4C5A78', emissive: '#000000', roughness: 0.4 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.quaternion.setFromUnitVectors(zAxis, e.normal);
    g.add(cup, rim);
    g.renderOrder = 5;
    g.userData = { name, rimMat, normal: e.normal };
    group.add(g);
    electrodes[name] = g;
  }

  // ---- the measuring arcs (thin lines on the scalp)
  const arcMat = new THREE.MeshBasicMaterial({ color: '#9FD8FF', transparent: true, opacity: 0.55, depthWrite: false });
  const arcs = new THREE.Group();
  const hc = new THREE.Vector3().addVectors(R.fiducials.lpa, R.fiducials.rpa).multiplyScalar(0.5);
  for (const pts of R.arcs) {
    const sel = pts.filter((_, i) => i % 6 === 0);
    const curve = new THREE.CatmullRomCurve3(sel.map((p) => {
      const o = p.clone(); return o.addScaledVector(o.clone().sub(hc).normalize(), 0.9);
    }));
    arcs.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.45, 6), arcMat));
  }
  arcs.visible = false;
  group.add(arcs);

  // ---- fiducial markers (nasion, inion, LPA, RPA)
  const fidMat = new THREE.MeshStandardMaterial({ color: '#FFC965', emissive: '#FFC965', emissiveIntensity: 0.6 });
  const fids = new THREE.Group();
  for (const p of Object.values(R.fiducials)) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(3.2), fidMat); s.position.copy(p); fids.add(s); }
  fids.visible = false;
  group.add(fids);

  // ---- map state (lerped for smooth changes)
  const cur = new Float32Array(n), target = new Float32Array(n);
  const mapValues = (spec) => {
    const out = new Float32Array(n);
    const sites = Object.entries(spec.sites).map(([k, w]) => [R.electrodes[k].pos, w]);
    let mx = 0;
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (const [p, w] of sites) a += w * Math.exp(-P[i].distanceToSquared(p) / (2 * spec.sigma * spec.sigma));
      out[i] = a; if (a > mx) mx = a;
    }
    if (mx > 0) for (let i = 0; i < n; i++) out[i] = (out[i] / mx) * spec.gain;
    return out;
  };
  const mapCache = {};
  let blend = 1;
  const api = {
    group, scalp, electrodes, result: R, arcs, fids,
    centre: new THREE.Vector3().addVectors(R.fiducials.lpa, R.fiducials.rpa).multiplyScalar(0.5).add(new THREE.Vector3(0, 35, 0)),
    setMap(kind, instant = false) {
      const spec = MAPS[kind] || MAPS.none;
      const vals = (mapCache[kind] ||= mapValues(spec));
      target.set(vals);
      uni.uMapOn.value = spec.gain > 0 ? 1 : 0;
      if (instant) { cur.set(vals); mapAttr.array.set(vals); mapAttr.needsUpdate = true; blend = 1; } else blend = 0;
    },
    /** scale the whole map (0..1), e.g. for a brief evoked response */
    setMapGain(gain) { for (let i = 0; i < n; i++) mapAttr.array[i] = cur[i] * gain; mapAttr.needsUpdate = true; },
    setOpacity(o) { scalpMat.opacity = o; scalpMat.depthWrite = o > 0.99; scalp.renderOrder = o > 0.99 ? 0 : 4; },
    setVisible(on) { group.visible = on; },
    highlight(colors = {}) {
      for (const [name, g] of Object.entries(electrodes)) {
        const c = colors[name];
        g.userData.rimMat.color.set(c || '#4C5A78');
        g.userData.rimMat.emissive.set(c || '#000000');
        g.userData.rimMat.emissiveIntensity = c ? 0.9 : 0;
      }
    },
    /** is this electrode on the side of the head facing the camera? */
    facing(name, camera) {
      const g = electrodes[name];
      const wp = g.getWorldPosition(new THREE.Vector3());
      return g.userData.normal.dot(camera.position.clone().sub(wp)) > 0;
    },
    worldPos(name) { return electrodes[name].getWorldPosition(new THREE.Vector3()); },
    update(dt) {
      if (blend >= 1) return;
      blend = Math.min(1, blend + dt / 0.6);
      for (let i = 0; i < n; i++) { cur[i] += (target[i] - cur[i]) * Math.min(1, blend * 1.2); }
      if (blend >= 1) cur.set(target);
      mapAttr.array.set(cur); mapAttr.needsUpdate = true;
    },
    dispose() {
      viewer.model.remove(group);
      geo.dispose(); scalpMat.dispose(); cupGeo.dispose(); rimGeo.dispose(); metal.dispose(); arcMat.dispose(); fidMat.dispose();
      Object.values(electrodes).forEach((g) => g.userData.rimMat.dispose());
      arcs.children.forEach((m) => m.geometry.dispose());
    },
  };
  api.setMap('none', true);
  return api;
}
