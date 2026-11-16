// Ways of studying the brain — AQA 7182 4.2.2 (A-level only).
// Visual: the real 3D brain (FreeSurfer fsaverage cortex + aseg deep structures) and the real
// fsaverage head surface, in one MNI305-based space.
//   - fMRI: an (illustrative) BOLD activation blob on the real cortex, in the right place for the task
//     (visual cortex for seeing; left hand motor area + SMA for right-hand finger tapping), rising with
//     a canonical haemodynamic response (peak about 5 s), and a scanner-style axial slice.
//   - EEG: 10–20 electrodes computed geometrically on the real head mesh (see three/eeg1020.js),
//     an illustrative map of where each rhythm is biggest, and illustrative multi-channel traces.
//   - ERP: averaging simulation (made-up signal + noise) as a chart beside the head.
//   - Post-mortem: Broca's area on the left inferior frontal gyrus ("Tan"), and a real coronal slice
//     cut through the 3D brain, revealing the hippocampus.
import * as THREE from 'three';
import { BrainViewer } from '../brain/viewer.js';
import { reducedMotion } from '../settings.js';
import { createStage, setControls, pressOnly, createLabels, createChips, createPanel, freeRectFor } from '../three/stage-ui.js';
import { quietPicking, installViewShift, cortexLayer, createSlicer, flyTo, toWorld, snapToRegion, regionCentre, fromRAS } from '../three/brain-fx.js';
import { createEegRig, MAPS } from '../three/eeg-rig.js';

/* ------------------------------------------------------------------ colours */
const C = {
  ink: '#ECEFF7', soft: '#C9D2E6', faint: '#5E6A8A', cyan: '#73D3FF', amber: '#FFC965', mint: '#7DE8B4',
  rose: '#FF8DA1', violet: '#C9AAFF', red: '#FF8A7A',
};

// Seeded random numbers, so the "noise" looks the same every time the page loads.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ physiology-shaped curves */
// Canonical-shaped haemodynamic response (double gamma), peak normalised to 1 at about 5 s.
const FACT15 = 1307674368000;
const hrf = (t) => (t <= 0 ? 0 : ((t ** 5 * Math.exp(-t)) / 120 - (t ** 15 * Math.exp(-t)) / (6 * FACT15)) / 0.17547);

/* ------------------------------------------------------------------ ERP simulation data */
const ERP_T = []; for (let t = -100; t <= 500; t += 4) ERP_T.push(t);
const gaussBump = (t, m, s) => Math.exp(-((t - m) ** 2) / (2 * s * s));
// The made-up "true" response: small early peaks (sensory) and a large P300 (cognitive). Microvolts.
const ERP_SIGNAL = ERP_T.map((t) => 1.5 * gaussBump(t, 50, 12) - 3.5 * gaussBump(t, 85, 12) + 6 * gaussBump(t, 320, 55));
const ERP_TRIALS = (() => {
  const r = mulberry32(20140);
  const gauss = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const trials = [];
  for (let k = 0; k < 100; k++) {
    let ar = 0;
    const alphaAmp = 3.5 * (0.6 + 0.4 * r()), phase = r() * Math.PI * 2;
    trials.push(ERP_T.map((t, i) => {
      ar = 0.75 * ar + gauss();
      const noise = ar * (4 / 1.51) + alphaAmp * Math.sin((2 * Math.PI * 10 * t) / 1000 + phase);
      return ERP_SIGNAL[i] + noise;
    }));
  }
  return trials;
})();
const ERP_AVG = Object.fromEntries([1, 5, 20, 100].map((n) => [n, ERP_T.map((_, i) => {
  let s = 0; for (let k = 0; k < n; k++) s += ERP_TRIALS[k][i]; return s / n;
})]));

/* ------------------------------------------------------------------ EEG patterns (illustrative) */
const EEG_KINDS = {
  alert: { label: 'Alert', title: 'Alert and awake: beta waves', desc: 'Fast and small (about 13–30 per second)' },
  relaxed: { label: 'Relaxed', title: 'Relaxed, eyes closed: alpha waves', desc: 'Medium speed (about 8–12 per second)' },
  sleep: { label: 'Deep sleep', title: 'Deep sleep: delta waves', desc: 'Slow and large (under 4 per second)' },
  seizure: { label: 'Epilepsy', title: 'Epileptic seizure', desc: 'Sudden bursts of large spikes' },
};
const TRACE_CH = [
  { name: 'Fz', color: '#73D3FF' }, { name: 'Cz', color: '#7DE8B4' }, { name: 'Pz', color: '#FFC965' },
  { name: 'O1', color: '#FF8DA1' }, { name: 'O2', color: '#C9AAFF' },
];
const FS = 250, LOOP = 8;
const NOISE = TRACE_CH.map((_, k) => {
  const r = mulberry32(911 + k * 31); const a = new Float32Array(FS * LOOP); let n = 0;
  for (let i = 0; i < a.length; i++) { n = 0.8 * n + (r() - 0.5) * 1.4; a[i] = n; }
  return a;
});
const TAU = Math.PI * 2;
function eegSample(kind, t, k) {
  const tt = ((t % LOOP) + LOOP) % LOOP;
  const n = NOISE[k][Math.floor(tt * FS) % (FS * LOOP)];
  const ph = k * 0.7;
  const beta = 7 * Math.sin(TAU * 21 * t + ph) + 4 * Math.sin(TAU * 16 * t + 1 + ph) + 2.5 * n;
  if (kind === 'alert') return beta;
  if (kind === 'relaxed') return (20 + 9 * Math.sin(TAU * 0.9 * t)) * Math.sin(TAU * 10 * t + ph * 0.3) + 2.5 * n;
  if (kind === 'sleep') return 44 * Math.sin(TAU * 1.4 * t + 0.5 + ph * 0.2) + 14 * Math.sin(TAU * 2.7 * t) + 3 * n;
  // seizure: normal background, then a sudden burst of generalised 3-per-second spike-and-wave
  if (tt < 2 || tt > 6.5) return beta;
  const p = ((tt - 2) * 3) % 1;
  return 66 * Math.exp(-(((p - 0.06) / 0.022) ** 2)) - 36 * Math.exp(-(((p - 0.45) / 0.17) ** 2)) + 2.5 * n;
}

/* ------------------------------------------------------------------ canvas charts (pixel units) */
function drawTraces(g, kind, tNow, gains) {
  const L = 46, R = 14, top = 6, bottom = 36;
  const rowH = (g.h - top - bottom) / TRACE_CH.length;
  const win = 3, span = g.w - L - R;
  const sc = (rowH * 0.5) / 60;
  TRACE_CH.forEach((ch, k) => {
    const yc = top + rowH * (k + 0.5);
    g.line([[L, yc], [g.w - R, yc]], 'rgba(255,255,255,.08)', 1);
    const pts = [];
    for (let x = 0; x <= span; x += 1.5) {
      const t = tNow - win + (x / span) * win;
      pts.push([L + x, yc - eegSample(kind, t, k) * gains[k] * sc]);
    }
    g.line(pts, kind === 'seizure' ? '#FF9F8F' : ch.color, 1.6);
    g.text(6, yc, ch.name, { weight: 700, color: ch.color, size: 15 });
  });
  const pps = span / win;
  g.line([[L, g.h - 16], [L + pps, g.h - 16]], C.ink, 3);
  g.text(L + pps + 8, g.h - 16, '1 second', { color: C.soft });
  g.text(g.w - R, g.h - 16, 'Illustrative', { align: 'right', color: C.soft });
}

function timeAxis(g, x0, x1, y, tMax, step, label) {
  g.line([[x0, y], [x1, y]], C.soft, 1.5);
  for (let t = 0; t <= tMax; t += step) {
    const x = x0 + (t / tMax) * (x1 - x0);
    g.line([[x, y], [x, y + 6]], C.soft, 1.5);
    g.text(x, y + 18, String(t), { align: 'center', color: C.soft });
  }
  if (label) g.text(x1, y + 40, label, { align: 'right', color: C.soft });
}

function drawFmriTime(g, t) {
  const x0 = 14, x1 = g.w - 16, X = (s) => x0 + (s / 12) * (x1 - x0);
  const yN = Math.min(70, g.h * 0.2), yB = g.h - 62, hB = Math.max(60, yB - yN - 64);
  g.text(x0, 14, 'Neurons fire (task starts)', { weight: 700, color: C.cyan });
  g.line([[x0, yN], [x1, yN]], C.faint, 1.5);
  g.line([[X(0), yN], [X(0) + 1, yN - 30], [X(0) + 6, yN - 30], [X(0) + 7, yN]], C.cyan, 3);
  g.text(x0, yN + 28, 'fMRI signal (blood oxygen)', { weight: 700, color: C.amber });
  const pts = [];
  for (let s = 0; s <= Math.min(12, t); s += 0.05) pts.push([X(s), yB - Math.max(-0.2, hrf(s)) * hB]);
  if (pts.length > 1) g.glowLine(pts, C.amber, 3.5);
  g.line([[X(t), yN - 36], [X(t), yB + 4]], 'rgba(236,239,247,.7)', 1.5);
  timeAxis(g, x0, x1, yB, 12, 2, 'seconds after the task starts');
  if (t >= 5.2) g.pill(X(6.6), yB - hB * 0.98, ['Peak about', '5 seconds later'], { color: C.amber, to: [X(5), yB - hB], align: 'left' });
}

function drawCompare(g, t) {
  const x0 = 14, x1 = g.w - 16, X = (s) => x0 + (s / 10) * (x1 - x0);
  const yE = 100, top = yE + 74, yB = g.h - 62, hB = Math.max(50, yB - top);
  g.line([[X(1), 28], [X(1), yB + 4]], C.ink, 1.5, [5, 5]);
  g.text(X(1) + 6, 14, 'Picture shown', { weight: 700 });
  g.text(x0, 46, 'EEG', { weight: 700, color: C.cyan, size: 17 });
  g.text(x0, yE + 48, 'fMRI', { weight: 700, color: C.amber, size: 17 });
  g.line([[x0, yE], [x1, yE]], C.faint, 1);
  const r = mulberry32(42); let n = 0; const eeg = [];
  for (let s = 0; s <= Math.min(10, t); s += 0.01) {
    n = 0.7 * n + (r() - 0.5) * 2;
    // visual evoked response: small dip at ~75 ms, main positive peak (P100) at ~100 ms after the picture
    eeg.push([X(s), yE - (4 * n + 30 * Math.exp(-(((s - 1.1) / 0.025) ** 2)) - 11 * Math.exp(-(((s - 1.075) / 0.015) ** 2)) - 8 * Math.exp(-(((s - 1.17) / 0.03) ** 2))) * 0.9]);
  }
  if (eeg.length > 1) g.line(eeg, C.cyan, 2);
  g.line([[x0, yB], [x1, yB]], C.faint, 1);
  const bold = [];
  for (let s = 0; s <= Math.min(10, t); s += 0.05) bold.push([X(s), yB - Math.max(-0.2, hrf(s - 1)) * hB]);
  if (bold.length > 1) g.glowLine(bold, C.amber, 3.5);
  g.line([[X(t), 28], [X(t), yB + 4]], 'rgba(236,239,247,.7)', 1.5);
  timeAxis(g, x0, x1, yB, 10, 1, 'seconds');
  if (t >= 1.3) g.pill(X(3), 48, 'Within a fraction of a second', { color: C.cyan, to: [X(1.1), yE - 26], align: 'left' });
  if (t >= 4.4) g.pill(X(6.8), top + 16, ['Rises seconds', 'later'], { color: C.amber, to: [X(5.6), yB - hB * 0.92], align: 'left' });
}

function drawResolution(g) {
  const x0 = 14, x1 = g.w - 16;
  const ev = x0 + (x1 - x0) * 0.22;
  const y1 = g.h * 0.36, y2 = g.h - 70;
  g.text(x0, 16, 'When does it happen?', { weight: 700, size: 17 });
  for (const [y, sharp] of [[y1, true], [y2, false]]) {
    g.line([[x0, y], [x1, y]], C.soft, 1.5);
    g.line([[ev, y - 70], [ev, y + 6]], C.soft, 1.5, [4, 4]);
    g.text(ev, y - 82, 'Event', { align: 'center', color: C.soft });
    const pts = [];
    for (let x = x0; x <= x1; x += 1.5) {
      const s = (x - ev) / (x1 - x0);
      const v = sharp ? Math.exp(-(((s - 0.012) / 0.008) ** 2)) : Math.exp(-(((s - 0.3) / 0.14) ** 2));
      pts.push([x, y - v * 58]);
    }
    if (sharp) g.glowLine(pts, C.amber, 3); else g.line(pts, '#9DB3E8', 3);
    g.text(x0, y + 26, sharp ? 'High: precise timing' : 'Low: slow and blurred', { weight: 700 });
  }
  g.text(x1, g.h - 20, 'time →', { align: 'right', color: C.soft });
}

const METHODS = {
  fmri: { label: 'fMRI', color: C.amber, x: 0.18, y: 0.18, detail: ['Good spatial: about 1–2 mm', 'Poor temporal: about 5 s lag'] },
  eeg: { label: 'EEG', color: C.cyan, x: 0.76, y: 0.82, detail: ['Excellent temporal: milliseconds', 'Poor spatial'] },
  erp: { label: 'ERP', color: C.mint, x: 0.76, y: 0.82, detail: ['Same resolution as EEG,', 'for one type of stimulus'] },
};
function drawMethods(g, sel) {
  const L = 52, R = 16, T = 20, B = Math.min(150, g.h * 0.36);
  const x0 = L, x1 = g.w - R, y0 = g.h - B, y1 = T;
  const X = (f) => x0 + f * (x1 - x0), Y = (f) => y0 - (1 - f) * (y0 - y1) + 0 * f;
  g.line([[x0, y0], [x1, y0]], C.soft, 2); g.line([[x0, y0], [x0, y1]], C.soft, 2);
  g.text((x0 + x1) / 2, y0 + 22, 'Temporal resolution: when →', { align: 'center', weight: 700 });
  g.text(x0 + 4, y0 + 46, 'Poor (seconds)', { color: C.soft }); g.text(x1, y0 + 46, 'Excellent (ms)', { align: 'right', color: C.soft });
  g.text(18, (y0 + y1) / 2, 'Spatial resolution: where →', { align: 'center', weight: 700, rotate: -Math.PI / 2 });
  g.text(x0 + 6, y1 + 6, 'Good (mm)', { color: C.soft }); g.text(x0 + 6, y0 - 14, 'Poor', { color: C.soft });
  for (const [k, m] of Object.entries(METHODS)) {
    const on = sel === 'all' || sel === k;
    g.ctx.globalAlpha = on ? 1 : 0.25;
    const px = X(m.x), py = Y(m.y) + (k === 'erp' ? 0 : 0);
    g.dot(px + (k === 'erp' ? 16 : k === 'eeg' ? -16 : 0), py, 12, m.color, true);
    g.text(px + (k === 'erp' ? 34 : k === 'eeg' ? -34 : 22), py - (k === 'fmri' ? 0 : 26), m.label, { weight: 700, size: 17, color: m.color, align: k === 'eeg' ? 'right' : 'left' });
    g.ctx.globalAlpha = 1;
  }
  if (METHODS[sel]) {
    const m = METHODS[sel];
    g.pill((x0 + x1) / 2, (y0 + y1) / 2, m.detail, { color: m.color, border: m.color });
  }
  // post-mortem: not on the chart
  const on = sel === 'all' || sel === 'pm';
  g.ctx.globalAlpha = on ? 1 : 0.3;
  const by = y0 + 66;
  g.ctx.strokeStyle = C.violet; g.ctx.lineWidth = 1.5; g.ctx.setLineDash([6, 5]);
  g.round(x0 - 30, by, x1 - x0 + 30, Math.max(56, g.h - by - 6), 12); g.ctx.stroke(); g.ctx.setLineDash([]);
  g.text(x0 - 18, by + 20, 'Post-mortem (not on this chart)', { weight: 700, color: C.violet });
  g.text(x0 - 18, by + 42, 'Fine detail of structure, but no activity.', { color: C.ink });
  g.ctx.globalAlpha = 1;
}

function drawErp(g, arr, n, step) {
  const L = 16, R = 16;
  const X = (t) => L + ((t + 100) / 600) * (g.w - L - R);
  const topH = step === 5 ? Math.min(130, g.h * 0.26) : 0;
  if (step === 5) {
    g.text(L, 12, '3 single trials (very noisy)', { weight: 700 });
    const yc = 26 + (topH - 26) / 2;
    ['#7FA0D8', '#8FD0C0', '#B9A0E0'].forEach((c, k) => g.line(ERP_T.map((t, i) => [X(t), yc - ERP_TRIALS[k][i] * (topH / 60)]), c, 1.3));
  }
  const y0 = topH + 34, y1 = g.h - 56;
  const base = y0 + (y1 - y0) * 0.68, sc = (base - y0 - 10) / 8;
  const tw = g.text(L, y0 - 12, `Average of ${n} ${n === 1 ? 'trial' : 'trials'}`, { weight: 700, size: 17, color: C.amber });
  if (tw + g.measure('Voltage: positive ↑') + 40 < g.w) g.text(g.w - R, y0 - 12, 'Voltage: positive ↑', { align: 'right', color: C.soft });
  if (step === 6 && n >= 20) { g.ctx.fillStyle = 'rgba(115,211,255,.12)'; g.ctx.fillRect(X(0), y0, X(100) - X(0), y1 - y0); }
  g.line([[X(-100), base], [X(500), base]], C.faint, 1);
  g.line([[X(0), y0], [X(0), y1]], C.ink, 1.5, [5, 5]);
  g.ctx.save(); g.ctx.beginPath(); g.ctx.rect(L, y0, g.w - L - R, y1 - y0); g.ctx.clip();
  g.glowLine(ERP_T.map((t, i) => [X(t), base - arr[i] * sc]), C.amber, 3);
  g.ctx.restore();
  for (const t of [-100, 0, 100, 200, 300, 400, 500]) { g.line([[X(t), y1], [X(t), y1 + 6]], C.soft, 1.5); g.text(X(t), y1 + 18, String(t), { align: 'center', color: C.soft }); }
  g.text(X(0), y1 + 42, '↑ Stimulus', { align: 'center', color: C.soft });
  g.text(g.w - R, y1 + 42, 'Time (ms)', { align: 'right', color: C.soft });
  if (step === 6 && n >= 20) {
    g.pill(X(50), y0 + 26, ['Early peaks:', 'sensory'], { color: C.cyan });
    g.pill(X(400), y0 + 30, ['P300: later,', 'cognitive'], { color: C.amber, to: [X(320), base - 6 * sc] });
  }
  if (step === 7) {
    g.pill(X(200), y0 + 24, ['Needs many trials and', 'careful noise removal'], { color: C.ink });
    g.pill(X(300), base + 40, 'Timing to the millisecond', { color: C.ink });
  }
}

/* ------------------------------------------------------------------ captions [visible, screen-reader] */
const CAPTIONS = [
  ['Spatial resolution = where. Temporal resolution = when.', 'A real 3D brain seen from behind, with an active area on the visual cortex shown either as a sharp small spot (high spatial resolution) or a blurry patch (low). Beside it, two timelines: a sharp response right at the event (high temporal resolution) and a slow, delayed one (low).'],
  ['Active areas need more oxygen, so oxygen-rich blood flows to them. fMRI detects this. The coloured patch is illustrative.', 'A real 3D brain. An illustrative fMRI activation patch glows on the cortex in the area used by the chosen task: the visual cortex at the back for looking at a picture, or the left motor area for tapping the right-hand fingers.'],
  ['Press “Start the task”. The blood signal rises slowly and peaks about 5 seconds after the neurons fire.', 'A scanner-style slice cut through the real 3D brain, seen from above. Beside it, a graph: neurons fire at 0 seconds, but the fMRI blood oxygen signal rises slowly and peaks about 5 seconds later. The active patch on the slice brightens at the same slow pace.'],
  ['Press a button to see a brainwave pattern. Patterns and colours are illustrative.', 'A head with EEG electrodes placed using the international 10–20 system. The scalp is coloured where the chosen brainwave is largest. Beside it, EEG traces from five electrodes show the chosen pattern.'],
  ['Press “Show a picture”. EEG reacts at once; the fMRI signal comes seconds later. Traces are illustrative.', 'A see-through head with EEG electrodes and the brain inside. When a picture is shown, the electrodes at the back of the head react within a fraction of a second, but the fMRI patch on the visual cortex only rises several seconds later. A graph shows both on the same time axis.'],
  ['Simulation. Average more trials and watch the random noise cancel out.', 'A head with the electrode Pz highlighted. Beside it, three very noisy single EEG trials and the average of the chosen number of trials. With more trials the noise cancels out and a clear ERP waveform appears.'],
  ['Early peaks are linked to sensory processing. The P300 is a later, cognitive peak.', 'The averaged ERP with the early peaks, in roughly the first 100 milliseconds, labelled sensory, and a large positive peak at about 300 milliseconds labelled P300, cognitive.'],
  ['ERPs give millisecond timing, but they need many trials and careful noise removal.', 'The averaged ERP with notes: timing to the millisecond, and needs many trials and careful noise removal.'],
  ['Behaviour seen in life is linked to damage found after death.', 'The left side of a real 3D brain. Broca’s area, on the left inferior frontal gyrus, is shown as damaged tissue. A card explains: in life, Tan could only say one word; after death, Broca found damage in the left frontal lobe.'],
  ['A slice cut through the brain shows deep structures, such as the hippocampus. (3D model slice, coloured for clarity.)', 'A coronal slice cut through the real 3D brain, seen from the front, with the hippocampus highlighted on both sides. A slider moves the slice forwards and backwards.'],
  ['Press a method to see where it sits.', 'Chart: spatial resolution going up, temporal resolution going right. fMRI is high and to the left. EEG and ERP are low and to the right. Post-mortem is not on the chart: very fine detail of structure but no activity over time.'],
];
const INTRO = ['Four ways of studying the brain. The coloured patch is illustrative.', 'A see-through head with EEG electrodes on the scalp and the brain inside, with an illustrative fMRI active area glowing on the visual cortex.'];

/* ------------------------------------------------------------------ the visual */
const VISUAL = {
  dark: true,
  async create(container) {
    const S = createStage(container, 'stb3');
    const viewer = new BrainViewer(S.gl, { label: '3D brain for this step' });
    await viewer.ready;
    quietPicking(viewer);
    const freeRect = freeRectFor(S);
    installViewShift(viewer, freeRect);
    viewer.setReal(true);
    const rm = () => reducedMotion();
    const cam = viewer.camera;
    viewer.model.updateMatrixWorld(true);
    const W = (p) => toWorld(viewer, p);
    const project = (p) => { const q = viewer.project(p); return q && { x: q.x + S.gl.offsetLeft, y: q.y + S.gl.offsetTop }; };
    const labels = createLabels(S, project, freeRect);
    const chips = createChips(S, project);
    const panel = createPanel(S, 'side');
    const facing = (pModel, n) => { const nv = new THREE.Vector3(...n).normalize(); return () => nv.dot(cam.position.clone().sub(W(pModel))) > 0; };
    const brainC = viewer.center.clone(); // brain centre in model space

    // ---- anchor points on the real cortex (model space)
    const extreme = (mesh, axis, sign) => {
      const o = viewer.meshes[mesh]; o.updateMatrix(); let best = null; const v = new THREE.Vector3(); const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix); if (!best || sign * v[axis] > sign * best[axis]) best = v.clone(); }
      return best;
    };
    const P = {
      v1L: regionCentre(viewer, 3, 'left'), v1R: regionCentre(viewer, 3, 'right'),
      poleL: extreme('cortex_left_occipital', 'z', -1), poleR: extreme('cortex_right_occipital', 'z', -1),
      hand: snapToRegion(viewer, fromRAS(-38, -24, 60), 1, 'left'),          // hand knob, left precentral gyrus
      s1: snapToRegion(viewer, fromRAS(-40, -32, 56), 2, 'left'),
      sma: snapToRegion(viewer, fromRAS(-4, -8, 64), 0, 'left'),             // supplementary motor area (medial)
      broca: regionCentre(viewer, 5, 'left'),
    };
    const TASKS = {
      see: {
        label: 'Looking at a picture', area: 'Visual cortex', where: 'occipital lobe, at the back',
        seeds: [{ p: P.v1L, sigma: 11, w: 0.85 }, { p: P.v1R, sigma: 11, w: 0.85 }, { p: P.poleL, sigma: 11, w: 0.9 }, { p: P.poleR, sigma: 11, w: 0.9 }],
        view: [0.55, 0.35, -1], dist: 470, anchor: P.poleL, nrm: [0.3, 0.1, -1], cutY: P.v1L.y + 2, cutView: [0.05, 1, -0.35],
      },
      tap: {
        label: 'Tapping right-hand fingers', area: 'Left motor area', where: 'frontal lobe (controls the right hand)',
        seeds: [{ p: P.hand, sigma: 8, w: 1 }, { p: P.s1, sigma: 7, w: 0.5 }, { p: P.sma, sigma: 7, w: 0.6 }],
        view: [1, 0.95, 0.05], dist: 430, anchor: P.hand, nrm: [0.5, 1, 0], cutY: P.hand.y - 6, cutView: [0.05, 1, 0.3],
      },
    };
    let task = 'see';

    // ---- effects
    const bold = cortexLayer(viewer, { style: 'heat', thresh: 0.3, opacity: 0.95 });
    const lesion = cortexLayer(viewer, { hemis: ['left'], lobes: ['frontal'], style: 'lesion', region: 5, regionAdd: 1, thresh: 0.5, colors: ['#2E0B09', '#7A2618'], opacity: 0.97 });
    const slicer = createSlicer(viewer);
    slicer.addLayer(bold); slicer.addLayer(lesion);
    const rig = createEegRig(viewer);
    // cut-face colours. Groups: 0 cortex, 1 cerebellum/brainstem, 2 hippocampus, 3 ventricles, 4 thalamus, 5 basal ganglia, 6 amygdala, 7 other
    const MRI = (g) => ['#C7CBD3', '#B9BDC6', '#8F949E', '#1E232E', '#8F949E', '#8F949E', '#8F949E', '#AEB2BB'][g];   // like a T1 scan: white matter light, grey matter darker, fluid dark
    const TISSUE = (g) => (g === 2 ? '#FFC23D' : null);
    let hippoCut = { left: null, right: null };

    // channel gains for the traces: how big each rhythm is at each traced electrode (from the same maps)
    const gainsFor = (kind) => {
      const spec = MAPS[kind];
      const val = (name) => Object.entries(spec.sites).reduce((a, [k, w]) => a + w * Math.exp(-rig.result.electrodes[name].pos.distanceToSquared(rig.result.electrodes[k].pos) / (2 * spec.sigma ** 2)), 0);
      const all = Object.keys(rig.result.electrodes).map(val); const mx = Math.max(...all);
      return TRACE_CH.map((c) => 0.3 + 0.7 * val(c.name) / mx);
    };

    // ---- per-frame
    let eegKind = 'alert', eegOn = false, tEeg = 3, gains = gainsFor('alert');
    viewer.on('frame', (dt) => {
      rig.update(dt);
      if (eegOn) { if (!rm()) tEeg += dt; panel.redraw(); }
      labels.update(); chips.update();
    });

    // ---- animation bookkeeping
    const cancels = new Set();
    const stopAll = () => { cancels.forEach((c) => c()); cancels.clear(); };
    const run = (dur, fn, done) => {
      if (rm()) { fn(1); done?.(); return; }
      let raf = 0; const t0 = performance.now();
      const fr = (now) => { const p = Math.min(1, (now - t0) / dur); fn(p); if (p < 1) raf = requestAnimationFrame(fr); else { cancels.delete(cancel); done?.(); } };
      const cancel = () => cancelAnimationFrame(raf);
      cancels.add(cancel); raf = requestAnimationFrame(fr);
    };
    const ctl = (defs, label) => setControls(S.ctrl, defs, label);
    const cap = (t) => { S.cap.textContent = t; };
    let instant = true;
    let building = false, pendingFly = null;
    // during a step change, wait until panels are placed so the subject is centred in the free space
    const fly = (target, dir, dist) => { if (building) pendingFly = [target, dir, dist]; else flyTo(viewer, target, dir, dist, instant || rm()); };

    const reset = () => {
      stopAll();
      eegOn = false;
      labels.clear(); chips.set([]); panel.hide();
      slicer.off(); slicer.setHeat([], 0);
      bold.setVisible(false); lesion.setVisible(false);
      rig.setVisible(false); rig.highlight({}); rig.setMap('none', true); rig.arcs.visible = false; rig.fids.visible = false;
      viewer.setXray(false); viewer.setHideHemisphere(null);
      S.root.dataset.layout = 'full';
      ctl([]);
    };

    // ---- step builders
    const showBold = (t, level = 1, sharpness = null) => {
      const tk = TASKS[t];
      let seeds = tk.seeds;
      if (sharpness === 'sharp') seeds = [{ p: P.poleL, sigma: 4.5, w: 1 }];
      if (sharpness === 'blurry') seeds = [{ p: P.poleL, sigma: 30, w: 1 }];
      bold.setSeeds(seeds);
      bold.uniforms.uSoft.value = sharpness === 'blurry' ? 1 : 0;
      bold.uniforms.uThresh.value = sharpness === 'blurry' ? 0.05 : 0.3;
      bold.level = level;
      bold.setVisible(true);
    };
    const taskLabel = (t, extra = '') => {
      const tk = TASKS[t];
      labels.set([{ id: 'area', html: `${tk.area}<small>${tk.where}</small>${extra}`, color: C.amber, anchor: () => W(tk.anchor), facing: facing(tk.anchor, tk.nrm), dx: t === 'see' ? -170 : -190, dy: -120 }]);
    };
    const headScene = (opacity, dir = [1, 0.6, 1], dist = 700) => {
      rig.setVisible(true); rig.setOpacity(opacity);
      fly(rig.centre, dir, dist);
    };
    const electrodeChips = (names = Object.keys(rig.electrodes)) => {
      const hl = Object.fromEntries(TRACE_CH.map((c) => [c.name, c.color]));
      chips.set(names.map((n) => ({ text: n, color: hl[n], anchor: () => rig.worldPos(n), facing: () => rig.facing(n, cam) })));
    };

    const orientChips = (y, sides = false) => chips.set([
      { text: 'Front', centre: true, anchor: () => W(new THREE.Vector3(brainC.x, y, brainC.z + 96)) },
      { text: 'Back', centre: true, anchor: () => W(new THREE.Vector3(brainC.x, y, brainC.z - 100)) },
      ...(sides ? [
        { text: 'Left', centre: true, anchor: () => W(new THREE.Vector3(brainC.x + 80, y, brainC.z)) },     // +X = subject's left
        { text: 'Right', centre: true, anchor: () => W(new THREE.Vector3(brainC.x - 80, y, brainC.z)) },
      ] : []),
    ]);
    const updateHippoCut = (z) => {
      for (const h of ['left', 'right']) {
        const o = viewer.meshes[`hippocampus_${h}`]; o.updateMatrix();
        const pos = o.geometry.attributes.position; const v = new THREE.Vector3(); const acc = new THREE.Vector3(); let n = 0;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix); if (Math.abs(v.z - z) < 2.5) { acc.add(v); n++; } }
        hippoCut[h] = n ? acc.divideScalar(n) : null;
      }
    };
    const hippoBox = new THREE.Box3();
    ['left', 'right'].forEach((h) => { const o = viewer.meshes[`hippocampus_${h}`]; o.updateMatrix(); o.geometry.computeBoundingBox(); hippoBox.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix)); });
    const hippoMid = hippoBox.getCenter(new THREE.Vector3());

    const STEPS = {
      [-1]: () => {
        headScene(0.24, [0.8, 0.45, -1], 560);
        showBold('see', 0.9);
        labels.set([
          { id: 'eeg', html: 'EEG electrodes<small>on the scalp</small>', color: C.cyan, anchor: () => rig.worldPos('C3'), facing: () => rig.facing('C3', cam), dx: 150, dy: -90 },
          { id: 'fmri', html: 'Active area<small>as fMRI shows it</small>', color: C.amber, anchor: () => W(P.poleL), dx: -150, dy: 40 },
        ]);
        cap(INTRO[0]); return INTRO[1];
      },
      0: () => {
        S.root.dataset.layout = 'side';
        let mode = 'sharp';
        const set = (m) => {
          mode = m; pressOnly(S.ctrl, m); showBold('see', 1, m);
          labels.set([{ id: 'sp', html: m === 'sharp' ? 'High spatial resolution<small>a sharp, small spot</small>' : 'Low spatial resolution<small>a blurry patch</small>', color: C.amber, anchor: () => W(P.poleL), dx: -150, dy: -130 }]);
        };
        ctl([{ label: 'Sharp spot', key: 'sharp', pressed: true, onClick: () => set('sharp') }, { label: 'Blurry patch', key: 'blurry', pressed: false, onClick: () => set('blurry') }], 'Where:');
        set(mode);
        fly(brainC, [0.75, 0.35, -1], 370);
        panel.show({ cls: 'side', title: 'Temporal resolution', sub: 'How precisely it shows when activity happens', draw: drawResolution, aria: 'Two timelines. High temporal resolution: a sharp response right at the event. Low: a slow, blurred response after it.' });
        cap(CAPTIONS[0][0]);
      },
      1: () => {
        const set = (t) => {
          task = t; pressOnly(S.ctrl, t); showBold(t, 1); taskLabel(t);
          fly(brainC, TASKS[t].view, TASKS[t].dist);
          orientChips(brainC.y + 30);
          cap(`${TASKS[t].label}: the ${TASKS[t].area.toLowerCase()} becomes more active. The coloured patch is illustrative.`);
        };
        ctl(Object.entries(TASKS).map(([k, v]) => ({ label: v.label, key: k, pressed: k === task, onClick: () => set(k) })), 'Task:');
        set(task);
        panel.show({ cls: 'card right', title: 'What fMRI picks up', sub: '1. Neurons in an area work harder.<br>2. They use more oxygen.<br>3. More oxygen-rich blood flows in.<br>4. fMRI detects the change in blood oxygen (the BOLD signal).' });
      },
      2: () => {
        S.root.dataset.layout = 'side';
        const tk = TASKS[task];
        let slice = true, t = 12;
        const draw = (g) => drawFmriTime(g, t);
        const setT = (s) => {
          t = s;
          // the map marks the area once the signal has risen (it stays marked after the peak)
          const lvl = s >= 5 ? Math.max(0.55, hrf(s)) : Math.max(0, hrf(s));
          bold.level = lvl; slicer.heatLevel = s >= 5 ? Math.max(0.55, lvl) : lvl;
          panel.redraw();
        };
        const setSlice = (on) => {
          slice = on; pressOnly(S.ctrl, on ? 'slice' : 'whole');
          if (on) {
            slicer.setPalette(MRI);
            slicer.cut([0, -1, 0], new THREE.Vector3(0, tk.cutY, 0));
            slicer.setHeat(tk.seeds.slice(0, 4), t >= 5 ? Math.max(0.55, hrf(t)) : Math.max(0, hrf(t)));
            fly(brainC, tk.cutView, 450);
            labels.set([
              { id: 'area', html: `${tk.area}<small>fMRI can locate this to about 1–2 mm (patch is illustrative)</small>`, color: C.amber, anchor: () => W(new THREE.Vector3(tk.anchor.x, tk.cutY, tk.anchor.z)), dx: -150, dy: -110 },
            ]);
            orientChips(tk.cutY, true);
          } else {
            slicer.off(); orientChips(brainC.y + 30);
            fly(brainC, tk.view, tk.dist); taskLabel(task);
          }
        };
        showBold(task, 1);
        setControls(S.ctrl, [
          { label: '▶ Start the task', onClick: () => { stopAll(); setT(0); run(12000, (p) => setT(p * 12)); } },
          { label: 'Slice', key: 'slice', pressed: true, onClick: () => setSlice(true) },
          { label: 'Whole brain', key: 'whole', pressed: false, onClick: () => setSlice(false) },
        ]);
        panel.show({ cls: 'side', title: `fMRI timing: ${tk.label.toLowerCase()}`, sub: 'Model curve (typical response). Time shown in real seconds.', draw, aria: 'Graph: neurons fire at 0 seconds; the fMRI signal rises slowly and peaks about 5 seconds later.' });
        setSlice(true);
        setT(instant || rm() ? 12 : 0);
        if (!instant && !rm()) run(12000, (p) => setT(p * 12));
        cap(CAPTIONS[2][0]);
      },
      3: () => {
        S.root.dataset.layout = 'side';
        headScene(1, [0.3, 1, -0.6], 560);
        rig.highlight(Object.fromEntries(TRACE_CH.map((c) => [c.name, c.color])));
        electrodeChips();
        eegOn = true;
        let lines = false;
        const setKind = (k) => {
          eegKind = k; gains = gainsFor(k); pressOnly(S.ctrl, k); rig.setMap(k, instant || rm());
          panel.show({ cls: 'side', title: EEG_KINDS[k].title, sub: EEG_KINDS[k].desc, draw: (g) => drawTraces(g, eegKind, tEeg, gains), aria: `EEG traces from electrodes Fz, Cz, Pz, O1 and O2 showing ${EEG_KINDS[k].title}. Illustrative.` });
          cap(`${EEG_KINDS[k].title}. Colour on the scalp: where these waves are biggest. Illustrative.`);
        };
        const setLines = () => {
          lines = !lines;
          rig.arcs.visible = lines; rig.fids.visible = lines;
          S.ctrl.querySelector('[data-key="lines"]').setAttribute('aria-pressed', String(lines));
          const f = rig.result.fiducials;
          labels.set(lines ? [
            { id: 'nas', html: 'Nasion<small>top of the nose</small>', color: C.amber, anchor: () => W(f.nasion), dx: -60, dy: 120 },
            { id: 'ini', html: 'Inion<small>bump at the back of the skull</small>', color: C.amber, anchor: () => W(f.inion), dx: 70, dy: 120 },
            { id: 'lpa', html: 'Ear point', color: C.amber, anchor: () => W(f.lpa), dx: 10, dy: 130 },
          ] : []);
          flyTo(viewer, rig.centre, lines ? [1, 0.3, 0.02] : [0.3, 1, -0.6], lines ? 680 : 560, rm());
          if (lines) cap('The 10–20 system: distances from the nasion to the inion, and ear to ear, are split into 10% and 20% steps. Positions on this model are approximate.');
          else setKind(eegKind);
        };
        ctl([...Object.entries(EEG_KINDS).map(([k, v]) => ({ label: v.label, key: k, pressed: k === eegKind, onClick: () => setKind(k) })),
          { label: '10–20 lines', key: 'lines', pressed: false, onClick: setLines }]);
        setKind(eegKind);
      },
      4: () => {
        S.root.dataset.layout = 'side';
        headScene(0.2, [0.85, 0.5, -1], 540);
        showBold('see', 0);
        rig.setMap('vep', true); rig.setMapGain(0);
        let t = 10;
        const labE = { id: 'e', html: 'EEG: within a fraction of a second', color: C.cyan, anchor: () => rig.worldPos('Oz'), dx: 130, dy: -120, show: false };
        const labF = { id: 'f', html: 'fMRI: seconds later', color: C.amber, anchor: () => W(P.poleR), dx: -120, dy: 110, show: false };
        labels.set([labE, labF]);
        const setT = (s) => {
          t = s;
          const e = s > 1.08 ? Math.exp(-(((s - 1.25) / 0.45) ** 2)) : 0;      // visual evoked response (held a little longer so it can be seen)
          rig.setMapGain(e);
          rig.highlight(e > 0.3 ? { O1: C.cyan, O2: C.cyan, Oz: C.cyan } : {});
          bold.level = s - 1 >= 5 ? Math.max(0.55, hrf(s - 1)) : Math.max(0, hrf(s - 1));
          labE.show = s >= 1.12; labF.show = s >= 4.2;
          panel.redraw();
        };
        ctl([{ label: '▶ Show a picture', onClick: () => { stopAll(); setT(0); run(10000, (p) => setT(p * 10)); } }]);
        panel.show({ cls: 'side', title: 'EEG and fMRI on one timeline', sub: 'Illustrative traces. Time shown in real seconds.', draw: (g) => drawCompare(g, t), aria: 'EEG changes within a fraction of a second of the picture; the fMRI signal rises seconds later.' });
        setT(instant || rm() ? 10 : 0);
        if (rm()) { rig.setMapGain(0.9); rig.highlight({ O1: C.cyan, O2: C.cyan, Oz: C.cyan }); }
        if (!instant && !rm()) run(10000, (p) => setT(p * 10));
        cap(CAPTIONS[4][0]);
      },
      erp: (step) => {
        S.root.dataset.layout = 'side';
        headScene(0.3, [0.9, 0.75, -0.7], 520);
        rig.highlight({ Pz: C.amber });
        chips.set([{ text: 'Pz', color: C.amber, anchor: () => rig.worldPos('Pz'), facing: () => rig.facing('Pz', cam) }]);
        labels.set([{ id: 'pz', html: 'Recording electrode<small>simulated data</small>', color: C.amber, anchor: () => rig.worldPos('Pz'), dx: -150, dy: -110 }]);
        if (step === 6 && nTrials < 20 && !instant) nTrials = 100;
        const N_CAPTION = {
          1: 'One trial: the response is hidden in the random noise.',
          5: 'Five trials averaged: a shape is starting to appear.',
          20: 'Twenty trials averaged: the peaks are now clear.',
          100: '100 trials averaged: the noise has almost cancelled out.',
        };
        const setN = (n, animate) => {
          nTrials = n; pressOnly(S.ctrl, String(n));
          const from = shown.slice(), to = ERP_AVG[n];
          stopAll();
          const apply = (p) => { const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2; shown = from.map((v, i) => v + (to[i] - v) * e); panel.redraw(); };
          if (animate) run(700, apply); else apply(1);
          if (step === 5) cap(`Simulation. ${N_CAPTION[n]}`);
          else if (step === 6 && n < 20) cap('Average at least 20 trials to see the components clearly.');
          else cap(CAPTIONS[step][0]);
        };
        ctl([1, 5, 20, 100].map((n) => ({ label: String(n), key: String(n), pressed: n === nTrials, onClick: () => setN(n, true) })), 'Trials to average:');
        panel.show({ cls: 'side wide', title: step === 5 ? 'Averaging trials' : step === 6 ? 'ERP components' : 'ERPs: timing to the millisecond', sub: 'Simulation: made-up signal + noise', draw: (g) => drawErp(g, shown, nTrials, step), aria: CAPTIONS[step][1] });
        setN(nTrials, !instant);
      },
      8: () => {
        lesion.setVisible(true);
        fly(brainC, [1, 0.12, 0.25], 420);
        labels.set([{ id: 'b', html: 'Damage found here<small>around Broca’s area, left frontal lobe</small>', color: C.red, anchor: () => W(P.broca), facing: facing(P.broca, [1, 0, 0.3]), dx: -40, dy: 150 }]);
        panel.show({ cls: 'card right', title: 'Broca’s patient “Tan”', sub: '<strong>1. In life:</strong> he understood speech, but could only say “tan”.<br><strong>2. After death:</strong> Broca examined his brain and found damage in the left frontal lobe.<br><strong>3.</strong> Broca linked the two.' });
        cap(CAPTIONS[8][0]);
      },
      9: () => {
        slicer.setPalette(TISSUE);
        let z = hippoMid.z;
        const setZ = (val) => {
          z = val; slicer.cut([0, 0, -1], new THREE.Vector3(0, 0, z)); updateHippoCut(z);
          labels.set([
            { id: 'h', html: 'Hippocampus<small>a deep structure</small>', color: '#FFC23D', anchor: () => (hippoCut.left ? W(hippoCut.left) : null), dx: 150, dy: 110 },
            { id: 'h2', html: 'Hippocampus', color: '#FFC23D', anchor: () => (hippoCut.right ? W(hippoCut.right) : null), dx: -150, dy: 110 },
          ]);
        };
        // front view: the subject's left is on the viewer's right
        chips.set([
          { text: 'Left', centre: true, anchor: () => W(new THREE.Vector3(brainC.x + 82, brainC.y + 40, z)) },
          { text: 'Right', centre: true, anchor: () => W(new THREE.Vector3(brainC.x - 82, brainC.y + 40, z)) },
        ]);
        setZ(z);
        fly(new THREE.Vector3(brainC.x, brainC.y - 8, z), [0.42, 0.32, 1], 420);
        const zMin = Math.round(hippoBox.min.z + 2), zMax = Math.round(hippoBox.max.z + 30);
        ctl([{ range: { label: 'Move the slice', min: zMin, max: zMax, step: 1, value: Math.round(z), onInput: (v) => { setZ(v); cap(v > hippoBox.max.z ? 'This slice is in front of the hippocampus.' : CAPTIONS[9][0]); } } }]);
        cap(CAPTIONS[9][0]);
      },
      10: () => {
        S.root.dataset.layout = 'side';
        headScene(0.22, [0.8, 0.45, -1], 560);
        showBold('see', 0.9);
        let sel = 'all';
        const text = {
          all: CAPTIONS[10][0],
          fmri: 'fMRI: good spatial resolution, poor temporal resolution.',
          eeg: 'EEG: excellent temporal resolution, poor spatial resolution.',
          erp: 'ERP: excellent temporal resolution, poor spatial resolution, for one type of stimulus.',
          pm: 'Post-mortem: very fine structural detail, but it shows no activity over time.',
        };
        const pick = (m) => { sel = m; pressOnly(S.ctrl, m); panel.redraw(); cap(text[m]); };
        ctl([...[['fmri', 'fMRI'], ['eeg', 'EEG'], ['erp', 'ERP'], ['pm', 'Post-mortem']].map(([k, l]) => ({ label: l, key: k, pressed: false, onClick: () => pick(k) })),
          { label: 'Show all', key: 'all', pressed: true, onClick: () => pick('all') }]);
        panel.show({ cls: 'side wide', title: 'Comparing the methods', draw: (g) => drawMethods(g, sel), aria: CAPTIONS[10][1] });
        pick('all');
      },
    };

    let nTrials = 1;
    let shown = ERP_AVG[1].slice();
    let stepNow = -2;
    return {
      show(step) {
        const moved = step !== stepNow;
        stepNow = step;
        instant = !moved;
        reset();
        const s = Math.max(-1, Math.min(10, step));
        const fn = s >= 5 && s <= 7 ? () => STEPS.erp(s) : STEPS[s];
        building = true; pendingFly = null;
        const aria = fn() || CAPTIONS[s]?.[1] || INTRO[1];
        building = false;
        if (pendingFly) flyTo(viewer, ...pendingFly, instant || rm());
        viewer.renderer.domElement.setAttribute('aria-label', aria);
        S.root.setAttribute('aria-label', aria);
        instant = false;
      },
      dispose() {
        stopAll(); labels.dispose(); chips.dispose(); panel.dispose();
        bold.dispose(); lesion.dispose(); slicer.dispose(); rig.dispose();
        viewer.dispose(); S.root.remove();
      },
    };
  },
};

/* ------------------------------------------------------------------ the lesson (text fact-checked: keep) */
export default {
  id: 'studying-the-brain',
  title: 'Ways of studying the brain',
  objectives: [
    'Describe how fMRI, EEG, ERPs and post-mortem examinations work.',
    'Explain spatial and temporal resolution, and use them to compare methods.',
    'Give a strength and a weakness for each method.',
  ],
  keywords: [
    { term: 'fMRI', simple: 'A brain scan that shows which areas are active by detecting changes in blood oxygen.', exam: 'Functional magnetic resonance imaging: detects changes in blood oxygenation and flow that occur as a result of neural activity in specific parts of the brain.' },
    { term: 'EEG', simple: 'Electrodes on the scalp record the brain’s overall electrical activity as brainwaves.', exam: 'Electroencephalogram: a record of the electrical activity of the brain, measured by electrodes placed on the scalp.' },
    { term: 'ERP', simple: 'The brain’s electrical response to one particular stimulus, found by averaging many EEG trials.', exam: 'Event-related potential: a small voltage change in the brain, time-locked to a specific stimulus, extracted from the EEG by statistical averaging.' },
    { term: 'Post-mortem examination', simple: 'Studying a person’s brain after they have died.', exam: 'Analysis of a person’s brain after death, to look for structural abnormalities that may explain behaviour observed while they were alive.' },
    { term: 'Spatial resolution', simple: 'How precisely a method can show where activity is.', exam: 'The smallest feature or area a technique can detect: how precisely it can locate brain activity.' },
    { term: 'Temporal resolution', simple: 'How precisely a method can show when activity happens.', exam: 'How accurately a technique can detect changes in brain activity over time.' },
  ],
  steps: [
    {
      title: 'Where and when',
      simple: `<p>Each way of studying the brain is good at different things.</p>
        <p><span class="keyterm">Spatial resolution</span> is how precisely a method shows <strong>where</strong> activity happens.</p>
        <p><span class="keyterm">Temporal resolution</span> is how precisely it shows <strong>when</strong> activity happens.</p>
        <p>Memory tip: <strong>s</strong>patial = <strong>s</strong>pace. <strong>T</strong>emporal = <strong>t</strong>ime.</p>`,
      exam: `<p>Spatial resolution is often given in millimetres: the smaller the detail a method can pick out, the better. Temporal resolution is about how quickly a method can detect a change in activity, often given in milliseconds or seconds.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Swapping the two words. <strong>Spatial</strong> is about <strong>where</strong> (space). <strong>Temporal</strong> is about <strong>when</strong> (time).</p>' },
    },
    {
      title: 'fMRI: what it measures',
      simple: `<p><span class="keyterm">fMRI</span> stands for functional magnetic resonance imaging.</p>
        <p>When an area of the brain is more active, it uses more <strong>oxygen</strong>. More oxygen-rich blood flows to that area.</p>
        <p>fMRI detects these <strong>changes in blood oxygen and blood flow</strong>. It produces 3D images showing which areas are active during a task.</p>`,
      exam: `<p>Oxygen-rich and oxygen-poor haemoglobin have different magnetic properties. fMRI detects this difference, called the BOLD (blood oxygen level-dependent) signal. The change in blood flow after neural activity is called the <strong>haemodynamic response</strong>.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>fMRI does <strong>not</strong> measure neurons firing directly. It measures changes in <strong>blood oxygen</strong>, which happen because of neural activity.</p>' },
    },
    {
      title: 'fMRI: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> it is non-invasive and does not use harmful radiation (unlike a PET scan).</li>
          <li><strong>Strength:</strong> good <strong>spatial</strong> resolution, about 1–2 mm. It shows quite precisely where activity is.</li>
          <li><strong>Weakness:</strong> poor <strong>temporal</strong> resolution. The blood signal lags about 5 seconds behind the neural activity.</li>
          <li><strong>Weakness:</strong> it is expensive.</li>
        </ul>`,
      exam: `<p>fMRI only measures blood flow, so it cannot show the activity of individual neurons. It shows that an area is active during a task, but this does not prove the area causes the behaviour. The person must also keep very still in the scanner.</p>`,
    },
    {
      title: 'EEG: what it measures',
      simple: `<p><span class="keyterm">EEG</span> stands for electroencephalogram.</p>
        <p>Electrodes are placed on the scalp, usually in a cap. They record the <strong>overall electrical activity</strong> of the brain.</p>
        <p>The recording shows <strong>brainwaves</strong>. Different patterns go with different states, like being alert, relaxed or deeply asleep.</p>
        <p>Try the buttons to see some patterns.</p>`,
      exam: `<p>The signal comes from millions of neurons that are active together, mostly near the surface of the brain. Brainwaves are described by their frequency (speed) and amplitude (size). EEG is used to help diagnose epilepsy, which shows sudden bursts of electrical activity, and to study sleep.</p>`,
    },
    {
      title: 'EEG: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> excellent <strong>temporal</strong> resolution. It picks up changes within milliseconds.</li>
          <li><strong>Strength:</strong> it is non-invasive and much cheaper than fMRI.</li>
          <li><strong>Weakness:</strong> poor <strong>spatial</strong> resolution. The signal is a mix from many neurons, so it cannot pinpoint where activity comes from, especially deep in the brain.</li>
        </ul>
        <p>Press <strong>Show a picture</strong> to compare EEG and fMRI timing.</p>`,
      exam: `<p>EEG cannot tell apart activity in neighbouring areas, and it is not good at detecting activity in deep brain structures. It has been very useful in diagnosing epilepsy and in sleep research.</p>`,
    },
    {
      title: 'ERPs: finding a signal in the noise',
      simple: `<p>Raw EEG has a lot of background activity. This makes it hard to see the brain’s response to one event.</p>
        <p>So researchers show the same <strong>stimulus</strong> (such as a sound) many times. They line up each trial to the moment of the stimulus and <strong>average</strong> them.</p>
        <p>Random background activity cancels out. What is left is the <span class="keyterm">event-related potential (ERP)</span>.</p>`,
      exam: `<p>ERPs are types of brainwave triggered by particular events. They are extracted from the overall EEG using statistical averaging. Each trial is <strong>time-locked</strong> to the stimulus, so the response happens at the same moment in every trial while the background activity does not.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Explain <strong>why</strong> averaging works: the response to the stimulus is the same each time, but the background activity is random, so it averages out.</p>' },
    },
    {
      title: 'ERP components',
      simple: `<p>An ERP has peaks and dips called <strong>components</strong>.</p>
        <p><strong>Early</strong> components, in roughly the first 100 milliseconds, are linked to <strong>sensory</strong> processing.</p>
        <p><strong>Later</strong> components are linked to <strong>cognitive</strong> processing, such as attention. One example is the <span class="keyterm">P300</span>: a positive peak about 300 milliseconds after the stimulus.</p>`,
      exam: `<p>Early (sensory) components reflect the initial response to the physical stimulus. Later (cognitive) components reflect processing such as attention and memory. Some textbooks draw ERPs with negative voltage upwards, so check the axis.</p>`,
    },
    {
      title: 'ERPs: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> excellent <strong>temporal</strong> resolution, like EEG: measured in milliseconds.</li>
          <li><strong>Strength:</strong> more specific than raw EEG. It shows the response to one type of stimulus.</li>
          <li><strong>Weakness:</strong> lack of <strong>standardisation</strong>. Studies use different methods, so findings are hard to compare.</li>
          <li><strong>Weakness:</strong> background noise must be completely removed, which is not easy.</li>
        </ul>`,
      exam: `<p>ERPs have been widely used to measure cognitive functions such as attention and perception. Like EEG, they still have poor spatial resolution.</p>`,
    },
    {
      title: 'Post-mortem examinations',
      simple: `<p>A <span class="keyterm">post-mortem examination</span> means studying the brain <strong>after a person has died</strong>.</p>
        <p>Researchers look for damage or unusual structure. They link it to the person’s <strong>behaviour during their life</strong>.</p>
        <p>For example, Broca’s patient “Tan” understood speech but could only say one word. After Tan died, Broca found damage in the left frontal lobe.</p>`,
      exam: `<p>Post-mortems are often used with people who had a rare disorder or unusual behaviour while alive. HM’s brain was also examined in detail after his death, to show exactly which parts had been removed or damaged.</p>`,
    },
    {
      title: 'Post-mortems: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> a more detailed look at the brain than scans give, including <strong>deep structures</strong> such as the hippocampus.</li>
          <li><strong>Strength:</strong> they gave early evidence for localisation, such as Broca’s area.</li>
          <li><strong>Weakness:</strong> causation. The damage might have been caused by something else, such as another illness, so it may not explain the behaviour.</li>
          <li><strong>Weakness:</strong> consent. The person may not have been able to give fully informed consent.</li>
        </ul>`,
      exam: `<p>Post-mortems are retrospective: the person cannot be tested again to check a link between the damage and their behaviour. Consent is an issue for people such as HM, whose memory problems may have made it difficult to give fully informed consent.</p>`,
    },
    {
      title: 'Comparing the methods',
      simple: `<ul>
          <li><strong>fMRI:</strong> good spatial, poor temporal.</li>
          <li><strong>EEG and ERPs:</strong> excellent temporal, poor spatial.</li>
          <li><strong>Post-mortem:</strong> very fine detail of structure, but it cannot show activity, because the person has died.</li>
        </ul>
        <p>Press a method to highlight it on the chart.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>In a “compare” question, use the same feature for both methods. For example: “fMRI has better <strong>spatial</strong> resolution than EEG, but EEG has better <strong>temporal</strong> resolution.”</p>' },
    },
  ],
  quiz: [
    { q: 'What does fMRI detect?', options: ['Changes in blood oxygen and blood flow', 'The electrical activity of single neurons', 'The structure of the brain after death', 'Electrical activity through the scalp'], answer: 0, explain: 'fMRI detects the change in blood oxygen that follows neural activity (the haemodynamic response).', hint: 'Active areas need more oxygen. How does the oxygen get there?' },
    { q: 'Which method has the best temporal resolution?', options: ['Post-mortem', 'fMRI', 'EEG', 'They are all the same'], answer: 2, explain: 'EEG picks up changes within milliseconds.', hint: 'Temporal = time. Which one reacts fastest?' },
    { q: 'How are ERPs taken from the EEG?', options: ['By averaging many trials, each lined up to the stimulus', 'By taking one long recording', 'By measuring blood flow', 'By looking at the brain after death'], answer: 0, explain: 'Averaging many time-locked trials makes the random background activity cancel out.', hint: 'Think about the demo: what happened to the noise when you added more trials?' },
    { q: 'The P300 is…', options: ['An early, sensory component', 'A later, cognitive component, about 300 ms after the stimulus', 'A type of brain scanner', 'A stage of sleep'], answer: 1, explain: 'The P300 is a positive peak about 300 ms after the stimulus, linked to cognitive processing such as attention.', hint: 'The number tells you when it happens. Is 300 ms early or late?' },
    { q: 'Which is a weakness of post-mortem examinations?', options: ['They cannot show structure in detail', 'Damage found may have another cause, so causation is hard to establish', 'They use radiation', 'They have poor spatial resolution'], answer: 1, explain: 'The damage might be caused by something else, such as another illness, so we cannot be sure it caused the behaviour.', hint: 'Think about everything that might have happened to the brain before death.' },
  ],
  summary: [
    'fMRI: detects changes in blood oxygen. Good spatial resolution (about 1–2 mm), poor temporal (about 5 s lag).',
    'EEG: overall electrical activity from the scalp. ERPs: EEG averaged over many trials of one stimulus. Both have excellent temporal but poor spatial resolution.',
    'Post-mortem: the brain is studied after death and linked to behaviour in life. Detailed, but causation and consent are problems.',
  ],
  visual: VISUAL,
};
