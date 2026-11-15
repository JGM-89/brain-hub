// "X-ray me": anchors the real 3D brain to the learner's head using on-device face tracking.
// Privacy: the camera only starts after an explicit button press. Video frames are processed
// in this browser tab by MediaPipe (WASM + model served from this site) and are never stored or sent.
import * as THREE from 'three';
import { BrainViewer } from '../brain/viewer.js';
import { buildVisualPathway, brainToFaceMatrix, FACE_SCALE } from '../brain/pathway.js';
import { byId, SOURCES } from '../data/structures.js';
import { readButton } from '../speech.js';
import landmarks from '../data/landmarks.json';

const CAL_KEY = 'bh-xray-calibration';
const LAYERS = {
  lobes: { label: 'Lobes', hint: 'The four lobes of your cortex, sitting inside your skull.' },
  jobs: { label: 'Jobs', hint: 'Try smiling or opening your mouth: your motor area sends the signals that move your face.' },
  deep: { label: 'Deep parts', hint: 'The outer layer is see-through, so you can see the deep structures.' },
  vision: { label: 'Vision', hint: 'Signals travel from your eyes to the back of your brain. Close your eyes and watch the signals stop.' },
};

export function render(main) {
  main.innerHTML = `
  <div class="xray">
    <section>
      <div class="xray-stage" id="xstage" aria-label="Webcam x-ray view">
        <div class="xray-overlay-msg" id="consent">
          <div class="card consent" style="max-width:560px;text-align:left;color:var(--ink)" data-readable>
            <h1 style="font-size:1.6rem">X-ray yourself</h1>
            <p>This uses your camera to place a real 3D brain inside your head, on screen. It moves when you move.</p>
            <ul>
              <li><strong>Your video stays on this computer.</strong> It is not recorded, saved or sent anywhere.</li>
              <li>You can hide your face and just see the brain.</li>
              <li>You don’t have to use the camera. The model head shows exactly the same things.</li>
              <li>People near you may be able to see your screen.</li>
            </ul>
            <div class="controls-row">
              <button type="button" class="btn-primary" id="cam-on">Turn on my camera</button>
              <button type="button" id="demo-on">Use a model head instead</button>
              ${readButton()}
            </div>
          </div>
        </div>
        <div class="mirror" id="mirror" style="position:absolute;inset:0" hidden>
          <video id="video" playsinline muted></video>
          <div id="xray-tint" style="position:absolute;inset:0;background:radial-gradient(80% 80% at 50% 45%, rgb(20 60 140 / 25%), rgb(3 8 20 / 70%));mix-blend-mode:multiply;pointer-events:none"></div>
          <div id="brain3d" style="position:absolute;inset:0"></div>
        </div>
        <div id="xlabels" style="position:absolute;inset:0;pointer-events:none"></div>
        <div class="cam-badge" id="badge" hidden>Camera on</div>
        <p class="xray-overlay-msg" id="status" hidden style="place-items:end center;padding-bottom:20px;font-weight:700"></p>
      </div>
    </section>
    <aside class="panel" id="xpanel" style="display:grid;gap:16px;align-content:start">
      <div>
        <h2>What you will see</h2>
        <p id="layer-hint">Turn on your camera to start.</p>
      </div>
      <fieldset style="border:0;padding:0;margin:0"><legend class="group-label">Show</legend>
        <div class="controls-row" id="layer-btns">${Object.entries(LAYERS).map(([k, v], i) => `<button type="button" data-layer="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}</div>
      </fieldset>
      <fieldset style="border:0;padding:0;margin:0"><legend class="group-label">My face</legend>
        <div class="controls-row" id="face-btns">
          <button type="button" data-face="xray" aria-pressed="true">X-ray look</button>
          <button type="button" data-face="blur" aria-pressed="false">Blurred</button>
          <button type="button" data-face="hide" aria-pressed="false">Hidden</button>
        </div>
      </fieldset>
      <div id="xinfo" class="info" data-readable></div>
      <details>
        <summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">Brain not lining up? Adjust it</summary>
        <div class="slider"><label for="cal-size">Size</label><input id="cal-size" type="range" min="0.8" max="1.15" step="0.01" /></div>
        <div class="slider"><label for="cal-y">Up / down</label><input id="cal-y" type="range" min="-2" max="2" step="0.05" /></div>
        <div class="slider"><label for="cal-z">Forwards / backwards</label><input id="cal-z" type="range" min="-2" max="2" step="0.05" /></div>
        <button type="button" id="cal-reset">Reset</button>
      </details>
      <button type="button" id="cam-off" hidden>Turn camera off</button>
      <p class="source-note">Face tracking runs on this computer using Google MediaPipe. The brain is built from published brain-scan atlases. <a href="#/sources">About the data</a>. Eye positions and optic nerves are approximate.</p>
    </aside>
  </div>`;

  const $ = (s) => main.querySelector(s);
  const video = $('#video');
  let stream = null, landmarker = null, viewer = null, pathway = null, running = false, layer = 'lobes';
  let cal = { size: 1, y: 0, z: 0 };
  try { cal = { ...cal, ...JSON.parse(localStorage.getItem(CAL_KEY) || '{}') }; } catch { /* ignore */ }
  ['size', 'y', 'z'].forEach((k) => { $(`#cal-${k}`).value = cal[k]; });

  const head = new THREE.Matrix4();
  const smoothPos = new THREE.Vector3(), smoothQuat = new THREE.Quaternion(), smoothScale = new THREE.Vector3(1, 1, 1);
  let haveFace = false, lastSeen = 0, blend = {}, depthFix = 0;
  // canonical face model positions (cm) of the landmarks we use for size/position correction
  const CANON = {
    33: landmarks.canonical_face_cm.eye_outer_33, 263: landmarks.canonical_face_cm.eye_outer_263,
    168: landmarks.canonical_face_cm.nose_bridge_168,
  };

  const setStatus = (t) => { const s = $('#status'); s.hidden = !t; s.textContent = t || ''; };

  function applyLayer() {
    if (!viewer?.model) return;
    $('#layer-hint').textContent = LAYERS[layer].hint;
    viewer.select(null, { fly: false });
    viewer.setMode(layer === 'jobs' ? 'functions' : 'lobes');
    viewer.setXray(layer === 'deep' || layer === 'vision');
    viewer.setShowPaths(layer === 'vision');
    pathway?.setVisible(layer === 'vision');
    main.querySelectorAll('[data-layer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
  }

  function renderInfo(id) {
    const s = byId[id];
    $('#xinfo').innerHTML = s ? `<h2>${s.name}</h2><p>${s.simple}</p><div class="controls-row">${readButton()}<a class="btn" href="#/explore/${s.id}">More detail</a></div>
      <p class="source-note">Shape from: ${SOURCES[s.source]}</p>` : '<p>Tap or click a part of the brain to find out what it does.</p>';
  }

  async function start() {
    $('#cam-on').disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      $('#cam-on').disabled = false;
      alert('The camera could not start. You may need to allow camera access in your browser, or use the 3D model instead.');
      return;
    }
    video.srcObject = stream;
    await video.play();
    $('#consent').hidden = true; $('#mirror').hidden = false; $('#badge').hidden = false; $('#cam-off').hidden = false;
    $('#xstage').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    setStatus('Loading face tracking…');

    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const base = import.meta.env.BASE_URL;
    const files = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: `${base}mediapipe/face_landmarker.task`, delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true,
    });
    try { landmarker = await FaceLandmarker.createFromOptions(files, opts('GPU')); }
    catch { landmarker = await FaceLandmarker.createFromOptions(files, opts('CPU')); }

    viewer = new BrainViewer($('#brain3d'), { controls: false, mirrored: true, label: '3D brain placed over your head' });
    viewer.camera = new THREE.PerspectiveCamera(63, video.videoWidth / video.videoHeight, 1, 10000); // MediaPipe's virtual camera (cm)
    viewer.resize();
    viewer.root.matrixAutoUpdate = false;
    await viewer.ready;
    pathway = buildVisualPathway(viewer);
    pathway.setVisible(false);
    viewer.on('select', renderInfo);
    renderInfo(null);
    applyLayer();
    setStatus('Look at the camera');
    running = true;
    track();
  }

  async function startDemo() {
    $('#consent').hidden = true; $('#mirror').hidden = false;
    video.style.display = 'none'; $('#xray-tint').style.display = 'none';
    $('#face-btns').closest('fieldset').hidden = true;
    $('#xstage').style.aspectRatio = '4 / 3';
    viewer = new BrainViewer($('#brain3d'), { controls: true, label: '3D brain inside a model head' });
    viewer.root.matrixAutoUpdate = false;
    await viewer.ready;
    viewer._tween = null;
    viewer.camera.near = 0.5; viewer.camera.far = 2000; viewer.camera.position.set(30, 8, 50);
    viewer.controls.minDistance = 25; viewer.controls.maxDistance = 140; viewer.controls.target.set(0, 3, -5);
    viewer.camera.updateProjectionMatrix();
    viewer.frame = () => {};          // keep our own camera framing
    viewer.focusOn = () => {};
    const recentre = new THREE.Matrix4().makeTranslation(viewer.center.x, viewer.center.y, viewer.center.z);
    const applyCal = () => {
      viewer.root.matrix.copy(brainToFaceMatrix(FACE_SCALE * cal.size, new THREE.Vector3(0, cal.y, cal.z))).multiply(recentre);
      viewer.root.matrixWorldNeedsUpdate = true;
    };
    applyCal();
    main.querySelectorAll('#cal-size,#cal-y,#cal-z').forEach((el) => el.addEventListener('input', applyCal));
    // MediaPipe canonical face model as a glassy head (Apache-2.0)
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const obj = await new OBJLoader().loadAsync(`${import.meta.env.BASE_URL}models/canonical_face.obj`);
    obj.traverse((o) => { if (o.isMesh) {
      o.material = new THREE.MeshPhysicalMaterial({ color: '#d9e6ff', roughness: 0.3, transmission: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
      o.geometry.computeVertexNormals();
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(o.geometry), new THREE.LineBasicMaterial({ color: '#9db7ff', transparent: true, opacity: 0.18 }));
      o.add(wire);
    } });
    viewer.scene.add(obj);
    pathway = buildVisualPathway(viewer);
    pathway.setVisible(false);
    viewer.on('select', renderInfo);
    renderInfo(null);
    applyLayer();
    viewer.controls.autoRotate = false;
  }

  function track() {
    if (!running) return;
    if (video.readyState >= 2) {
      const r = landmarker.detectForVideo(video, performance.now());
      const M = r.facialTransformationMatrixes?.[0];
      if (M) {
        haveFace = true; lastSeen = performance.now();
        head.fromArray(M.data);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
        head.decompose(p, q, sc);
        const k = 0.45; // smoothing: 0 = frozen, 1 = raw (jittery)
        smoothPos.lerp(p, smoothPos.lengthSq() ? k : 1); smoothQuat.slerp(q, k); smoothScale.lerp(sc, k);
        const faceM = new THREE.Matrix4().compose(smoothPos, smoothQuat, smoothScale);
        // MediaPipe's metric depth assumes its own camera, which rarely matches a real webcam, so the
        // brain came out the wrong size. Correct it from what we can actually see: move the head along
        // the camera ray until the projected eye corners match the detected ones, then nudge the
        // nose bridge onto the detected nose bridge.
        const lm = r.faceLandmarks?.[0];
        if (lm) {
          const cam = viewer.camera, asp = cam.aspect;
          const ndc = (i) => new THREE.Vector2((lm[i].x * 2 - 1) * asp, 1 - lm[i].y * 2);
          const proj = (m, c) => { const v = new THREE.Vector3(...c).applyMatrix4(m).project(cam); return new THREE.Vector2(v.x * asp, v.y); };
          const cf = CANON;
          const seen = ndc(33).distanceTo(ndc(263));
          const drawn = proj(faceM, cf[33]).distanceTo(proj(faceM, cf[263]));
          if (seen > 0.01 && drawn > 1e-4) {
            depthFix = depthFix ? depthFix + (drawn / seen - depthFix) * 0.3 : drawn / seen;
            const pos = new THREE.Vector3().setFromMatrixPosition(faceM).multiplyScalar(depthFix);
            faceM.setPosition(pos);
            const a = proj(faceM, cf[168]), o = ndc(168);
            const zDist = Math.abs(pos.z) || 50, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
            faceM.setPosition(pos.add(new THREE.Vector3((o.x - a.x) / asp * zDist * t * asp, (o.y - a.y) * zDist * t, 0)));
          }
        }
        const align = brainToFaceMatrix(FACE_SCALE * cal.size, new THREE.Vector3(0, cal.y, cal.z));
        const recentre = new THREE.Matrix4().makeTranslation(viewer.center.x, viewer.center.y, viewer.center.z);
        viewer.root.matrix.copy(faceM).multiply(align).multiply(recentre);
        viewer.root.matrixWorldNeedsUpdate = true;
        viewer.root.visible = true;
        blend = Object.fromEntries((r.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
        reactToFace();
        setStatus('');
      } else if (performance.now() - lastSeen > 600) {
        viewer.root.visible = false;
        setStatus(haveFace ? 'I can’t see your face. Look at the camera.' : 'Look at the camera');
      }
    }
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(track); else requestAnimationFrame(track);
  }

  let smiling = false;
  function reactToFace() {
    if (layer === 'jobs') {
      const move = Math.max(blend.mouthSmileLeft || 0, blend.mouthSmileRight || 0, (blend.jawOpen || 0) * 0.9);
      const now = move > 0.45;
      if (now !== smiling) {
        smiling = now;
        viewer.select(now ? 'motor' : null, { fly: false });
        if (now) $('#layer-hint').textContent = 'Your motor area is sending signals to the muscles of your face. The face is controlled by the lower part of this strip.';
        else $('#layer-hint').textContent = LAYERS.jobs.hint;
      }
    }
    if (layer === 'vision' && pathway) {
      const closed = (blend.eyeBlinkLeft || 0) > 0.55 && (blend.eyeBlinkRight || 0) > 0.55;
      pathway.group.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'SphereGeometry' && c.userData.route) c.visible = !closed; });
      $('#layer-hint').textContent = closed ? 'Eyes closed: no light reaches your retinas, so these signals stop.' : LAYERS.vision.hint;
    }
  }

  function stop() {
    running = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    landmarker?.close?.(); landmarker = null;
    viewer?.dispose(); viewer = null;
  }

  // labels for the selected part
  const labelLoop = () => {
    if (!main.isConnected) return;
    const id = viewer?.selected;
    const p = id && viewer.root.visible ? viewer.screenPos(id) : null;
    $('#xlabels').innerHTML = p ? `<div class="label3d" style="left:${p.x}px;top:${p.y}px"><span>${byId[id].name}</span></div>` : '';
    requestAnimationFrame(labelLoop);
  };
  requestAnimationFrame(labelLoop);

  $('#cam-on').addEventListener('click', start);
  $('#demo-on').addEventListener('click', startDemo);
  $('#cam-off').addEventListener('click', () => { stop(); location.hash = '#/'; });
  $('#layer-btns').addEventListener('click', (e) => { const b = e.target.closest('[data-layer]'); if (b) { layer = b.dataset.layer; applyLayer(); } });
  $('#face-btns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-face]'); if (!b) return;
    main.querySelectorAll('[data-face]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.face;
    video.style.filter = f === 'xray' ? 'grayscale(1) contrast(1.15) brightness(0.75)' : f === 'blur' ? 'grayscale(0.6) blur(14px) brightness(0.7)' : '';
    video.style.opacity = f === 'hide' ? '0' : '1';
    $('#xray-tint').style.opacity = f === 'hide' ? '0' : '1';
  });
  video.style.filter = 'grayscale(1) contrast(1.15) brightness(0.75)';
  ['size', 'y', 'z'].forEach((k) => $(`#cal-${k}`).addEventListener('input', (e) => {
    cal[k] = Number(e.target.value);
    try { localStorage.setItem(CAL_KEY, JSON.stringify(cal)); } catch { /* ignore */ }
  }));
  $('#cal-reset').addEventListener('click', () => { cal = { size: 1, y: 0, z: 0 }; ['size', 'y', 'z'].forEach((k) => { $(`#cal-${k}`).value = cal[k]; }); try { localStorage.removeItem(CAL_KEY); } catch { /* ignore */ } });
  const onVis = () => {
    if (!document.hidden || !running) return;
    stop(); // never keep the camera running in a hidden tab
    $('#consent').hidden = false; $('#mirror').hidden = true; $('#badge').hidden = true; $('#cam-off').hidden = true; $('#cam-on').disabled = false;
  };
  document.addEventListener('visibilitychange', onVis);
  renderInfo(null);

  return () => { document.removeEventListener('visibilitychange', onVis); stop(); };
}
