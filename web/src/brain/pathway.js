// Eyes + visual pathway overlay, built in the brain model's own (glTF, mm) space.
// Anchored to real structures: optic chiasm (fsaverage aseg), optic tracts and radiations (HCP1065),
// LGN (Talairach), primary visual cortex (Destrieux). Eye positions come from MediaPipe's canonical
// face model, placed with the fsaverage nasion fiducial, so they are an APPROXIMATION (labelled as such).
import * as THREE from 'three';
import landmarks from '../data/landmarks.json';
import { reducedMotion } from '../settings.js';

// brain (glTF mm) <-> canonical face (cm):  face = S * brain + T
export const FACE_SCALE = 0.1 * 0.92;
const nas = new THREE.Vector3(...landmarks.fiducials_gltf_mm.nasion);
const L168 = new THREE.Vector3(...landmarks.canonical_face_cm.nose_bridge_168);
export const FACE_T = L168.clone().sub(nas.clone().multiplyScalar(FACE_SCALE));
export function brainToFaceMatrix(scale = FACE_SCALE, extra = new THREE.Vector3()) {
  const t = L168.clone().sub(nas.clone().multiplyScalar(scale)).add(extra);
  return new THREE.Matrix4().makeScale(scale, scale, scale).setPosition(t);
}
const faceToBrain = (c) => c.clone().sub(FACE_T).divideScalar(FACE_SCALE);

function eyeCentre(ids) {
  const c = new THREE.Vector3();
  ids.forEach((k) => c.add(new THREE.Vector3(...landmarks.canonical_face_cm[k])));
  c.divideScalar(ids.length);
  c.z -= 1.15; // eyelid opening is ~at the front of the eyeball; centre of a ~24 mm eyeball sits ~11-12 mm behind it
  return faceToBrain(c);
}
// glTF +X = subject's left. MediaPipe landmarks 263/362 are the subject's left eye.
export const EYE_LEFT = eyeCentre(['eye_outer_263', 'eye_inner_362', 'eye_top_386', 'eye_bottom_374']);
export const EYE_RIGHT = eyeCentre(['eye_outer_33', 'eye_inner_133', 'eye_top_159', 'eye_bottom_145']);
export const CHIASM = new THREE.Vector3(...landmarks.optic_chiasm_gltf_mm);
export const COLOURS = { leftField: new THREE.Color('#FF9F1C'), rightField: new THREE.Color('#3A86FF') };

function centroidOf(meshes) {
  const box = new THREE.Box3();
  meshes.forEach((m) => box.expandByObject(m));
  return box.getCenter(new THREE.Vector3());
}

// Builds the overlay as a child of viewer.model so it shares the brain's transform.
export function buildVisualPathway(viewer) {
  const model = viewer.model;
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const toModel = (v) => v.clone().applyMatrix4(inv);          // world -> model space
  const meshWorld = (name) => viewer.meshes[name] ? toModel(centroidOf([viewer.meshes[name]])) : null;

  const group = new THREE.Group();
  group.name = 'visual_pathway';

  // eyeballs (approximate)
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#F7F7F2', roughness: 0.25, transparent: true, opacity: 0.9 });
  const irisMat = new THREE.MeshStandardMaterial({ color: '#4C6EF5', roughness: 0.3 });
  const eyes = {};
  for (const [side, pos] of [['left', EYE_LEFT], ['right', EYE_RIGHT]]) {
    const eye = new THREE.Group();
    eye.position.copy(pos);
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(12, 40, 24), eyeMat));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), irisMat);
    iris.position.z = 11.9; eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: '#111' }));
    pupil.position.z = 12.0; eye.add(pupil);
    eye.userData.structure = 'eye';
    group.add(eye);
    eyes[side] = eye;
  }

  // key points in glTF space
  const lgnL = meshWorld('lgn_left'), lgnR = meshWorld('lgn_right');
  const otL = meshWorld('optic_tract_left'), otR = meshWorld('optic_tract_right');
  const orL = meshWorld('optic_radiation_left'), orR = meshWorld('optic_radiation_right');
  const v1L = viewer.regionCentreHemi(3, 'left'), v1R = viewer.regionCentreHemi(3, 'right');
  const v1Lm = v1L ? toModel(v1L) : null, v1Rm = v1R ? toModel(v1R) : null;
  const back = (e) => e.clone().add(new THREE.Vector3(0, 0, -12));
  const cL = CHIASM.clone().add(new THREE.Vector3(4, 0, 0)), cR = CHIASM.clone().add(new THREE.Vector3(-4, 0, 0));

  // optic nerves (approximate path from eye to chiasm)
  const nerveMat = new THREE.MeshStandardMaterial({ color: '#FFE8A3', roughness: 0.5, transparent: true, opacity: 0.85 });
  for (const [e, c] of [[EYE_LEFT, cL], [EYE_RIGHT, cR]]) {
    const curve = new THREE.CatmullRomCurve3([back(e), back(e).lerp(c, 0.45).add(new THREE.Vector3(0, 2, 0)), c]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 2.0, 12), nerveMat);
    tube.userData.structure = 'optic_nerve';
    group.add(tube);
  }

  // fibre routes. Right visual field -> left hemisphere (blue); left visual field -> right hemisphere (orange).
  // Each eye: temporal (outer) retina stays same side; nasal (inner) retina crosses at the chiasm.
  const routes = [];
  const mk = (pts, colour, field) => {
    const curve = new THREE.CatmullRomCurve3(pts.filter(Boolean), false, 'centripetal');
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 1.3, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.95, depthTest: false }));
    line.renderOrder = 10;
    line.userData.field = field;
    group.add(line);
    routes.push({ curve, colour, field, line });
  };
  const toLeftHemi = (eye, off) => [back(eye).add(new THREE.Vector3(off, 0, 0)), CHIASM.clone().add(new THREE.Vector3(2.5, 0, 0)), otL, lgnL, orL, v1Lm];
  const toRightHemi = (eye, off) => [back(eye).add(new THREE.Vector3(off, 0, 0)), CHIASM.clone().add(new THREE.Vector3(-2.5, 0, 0)), otR, lgnR, orR, v1Rm];
  // left eye: temporal half is its outer (+x) side -> left hemisphere; nasal half (-x) crosses -> right hemisphere
  mk(toLeftHemi(EYE_LEFT, 1.2), COLOURS.rightField, 'right');
  mk(toRightHemi(EYE_LEFT, -1.2), COLOURS.leftField, 'left');
  // right eye: nasal half (+x side) crosses -> left hemisphere; temporal half (-x) stays -> right hemisphere
  mk(toLeftHemi(EYE_RIGHT, 1.2), COLOURS.rightField, 'right');
  mk(toRightHemi(EYE_RIGHT, -1.2), COLOURS.leftField, 'left');

  // travelling signal dots
  const dotGeo = new THREE.SphereGeometry(2.2, 16, 12);
  const dots = [];
  routes.forEach((r, ri) => {
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: r.colour.clone().lerp(new THREE.Color('#fff'), 0.45), depthTest: false, transparent: true }));
      d.renderOrder = 11;
      d.userData = { route: r, phase: k / 3 + ri * 0.07 };
      group.add(d); dots.push(d);
    }
  });

  model.add(group);
  let t = 0, fieldFilter = null;
  const api = {
    group, eyes, routes,
    update(dt) {
      if (!group.visible) return;
      if (!reducedMotion()) t += dt * 0.22;
      for (const d of dots) {
        const visible = !fieldFilter || d.userData.route.field === fieldFilter;
        d.visible = visible;
        if (!visible) continue;
        const u = reducedMotion() ? (d.userData.phase % 1) : (t + d.userData.phase) % 1;
        d.position.copy(d.userData.route.curve.getPointAt(u));
      }
    },
    // show only one visual field ('left' | 'right' | null for both)
    setField(f) {
      fieldFilter = f;
      routes.forEach((r) => { r.line.material.opacity = !f || r.field === f ? 0.9 : 0.08; });
    },
    setVisible(v) { group.visible = v; },
    dispose() { model.remove(group); },
  };
  viewer.on('frame', (dt) => api.update(dt));
  return api;
}
