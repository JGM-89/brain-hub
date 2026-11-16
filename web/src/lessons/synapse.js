// Synaptic transmission — AQA 7182 Biopsychology (AS + A-level):
// "The process of synaptic transmission, including reference to neurotransmitters, excitation and inhibition."
// Visual: a 3D synapse, cut open so you can see inside: presynaptic terminal (bouton) with vesicles, the
// synaptic cleft, and a dendritic spine of the next neuron. Membranes, vesicles (40 nm), the cleft (20 nm) and the
// receptor proteins are roughly to scale with each other; the neurotransmitter molecules are drawn much bigger and
// far fewer. Receptor, transporter and enzyme shapes are smoothed surfaces computed from real Protein Data Bank
// structures (public/molecules, see public/neurons/credits.json). Step 6 (summation) uses a real human neuron
// (NeuroMorpho.Org). Each step plays its own part once, with "Play again"; reduced motion shows still end-states;
// calm mode removes the glow.
import * as THREE from 'three';
import { reducedMotion, get } from '../settings.js';
import { createStage } from '../three/stage3d.js';
import { tissueMaterial } from '../three/look.js';
import { loadSWC, buildNeuron, updatePixelScale, createSpark } from '../three/neuron3d.js';

const BASE = import.meta.env.BASE_URL;
const MOL = {
  ampa: `${BASE}molecules/ampa-receptor-3KG2.json`,
  gaba: `${BASE}molecules/gabaa-receptor-6HUP.json`,
  sert: `${BASE}molecules/serotonin-transporter-5I6X.json`,
  ache: `${BASE}molecules/acetylcholinesterase-4EY4.json`,
};
const PYR = `${BASE}neurons/pyramidal-human-685815936.swc`;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - Math.pow(1 - u, 2.4);
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

const COL = { e: '#FFC65C', i: '#7CC8FF', wrong: '#FF8FB1', ca: '#9DF29B', na: '#FFB070', cl: '#86B8FF' };

const CSS = `
.syn3d-cap { background: rgb(8 12 24 / 82%); padding: 8px 14px; border-radius: 12px; width: fit-content; max-width: calc(100% - 32px); line-height: 1.35; }
.syn3d-note { position: absolute; right: 14px; top: 14px; z-index: 2; background: rgb(8 12 24 / 82%); color: #F4F6FB; border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px; padding: 6px 10px; font-size: 15px; font-weight: 700; max-width: 42%; pointer-events: none; line-height: 1.3; }
.syn3d-note[hidden] { display: none; }
.syn3d-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #ECEFF7; font-weight: 700; font-size: 1.05rem; }
.syn3d-meter { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 2; width: 92px; padding: 10px 8px 12px; border-radius: 14px;
  background: rgb(8 12 24 / 86%); border: 1px solid rgb(255 255 255 / 20%); color: #F4F6FB; text-align: center; pointer-events: none; }
.syn3d-meter[hidden] { display: none; }
.syn3d-meter h4 { margin: 0 0 6px; font-size: 15px; line-height: 1.2; }
.syn3d-meter .track { position: relative; height: 180px; width: 22px; margin: 4px auto; border-radius: 11px; background: rgb(255 255 255 / 12%); }
.syn3d-meter .zero { position: absolute; left: -10px; right: -10px; top: 50%; height: 2px; background: rgb(255 255 255 / 55%); }
.syn3d-meter .th { position: absolute; left: -14px; right: -14px; height: 0; border-top: 3px dashed #FFE7A6; }
.syn3d-meter .fill { position: absolute; left: 3px; right: 3px; border-radius: 8px; transition: none; }
.syn3d-meter .dot { position: absolute; left: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: #ECEFF7; box-shadow: 0 0 0 3px #0A0F1E; }
.syn3d-meter .end { font-size: 18px; font-weight: 800; line-height: 1; }
.syn3d-meter .thl { font-size: 15px; color: #FFE7A6; font-weight: 700; }
.lesson-visual .vis-controls button.syn3d-btn { min-height: 44px; min-width: 44px; }
@media (max-width: 700px) { .syn3d-meter { width: 78px; } .syn3d-meter .track { height: 130px; } .syn3d-note { max-width: 55%; } }
`;

/* ------------------------------------------------------------------ data loading */
function b64(s, Type) {
  const bin = atob(s); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}
const molCache = new Map();
/** A smoothed protein surface (nm, +Y = outside the cell, membrane centre at y = 0). */
function loadMol(url) {
  if (!molCache.has(url)) {
    molCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }).then((j) => {
      const q = b64(j.positions, Int16Array); const idx = b64(j.indices, Uint16Array);
      const pos = new Float32Array(q.length); for (let i = 0; i < q.length; i++) pos[i] = q[i] / 100;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      g.computeBoundingBox();
      return { geo: g, meta: j };
    }));
  }
  return molCache.get(url);
}

/* ------------------------------------------------------------------ shapes */
/** Smooth lathe from (r, y) control points. */
function lathe(points, segs = 96, steps = 90) {
  const c = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = c.getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return { geo: new THREE.LatheGeometry(pts, segs), profile: pts };
}
/** The outline where the cut plane (z = 0) slices a lathe: drawn as a thin bright tube (the membrane edge). */
function cutOutline(profile, radius, mat) {
  const left = profile.slice().reverse().map((p) => V(-p.x, p.y, 0.5));
  const right = profile.map((p) => V(p.x, p.y, 0.5));
  const pts = [...left, ...right.slice(1)];
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, radius, 6, false), mat);
}
/** Membrane material: cut open by the clipping plane; the inside surface is shaded as cytoplasm. */
function membraneMaterial(color, inner, clip, U = {}) {
  const m = tissueMaterial(color, { side: THREE.DoubleSide, clippingPlanes: [clip], roughness: 0.48, clearcoat: 0.35 });
  const uniforms = { uInner: { value: new THREE.Color(inner) }, uInnerGlow: U.uInnerGlow || { value: new THREE.Color(0, 0, 0) },
    uAPy: U.uAPy || { value: -1e6 }, uAPGlow: U.uAPGlow || { value: 0 }, uAPCol: { value: new THREE.Color('#FFE9A8') } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uInner, uInnerGlow, uAPCol; uniform float uAPy, uAPGlow; varying float vY;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( gl_FrontFacing ? diffuse : uInner, opacity );')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float ap = exp(-pow((vY - uAPy) / 70.0, 2.0)) * uAPGlow;
        totalEmissiveRadiance += uAPCol * ap * 1.4;
        if (!gl_FrontFacing) totalEmissiveRadiance += uInnerGlow;`);
  };
  m.customProgramCacheKey = () => 'syn-membrane-v1';
  return m;
}
/** A small "key-shaped" molecule made of fused balls (drawn ~10× bigger than a real neurotransmitter). */
function moleculeGeo(kind) {
  const parts = [];
  const add = (r, x, y, z) => { const k = 1.25; const g = new THREE.SphereGeometry(r * k, 14, 10); g.translate(x * k, y * k, z * k); parts.push(g); };
  if (kind === 'e') { add(2.4, 0, 0, 0); add(1.9, 2.9, 1.0, 0); add(1.6, -2.6, 1.3, 0.4); add(1.3, 4.8, 2.4, 0); }
  else if (kind === 'i') { add(2.3, 0, 0, 0); add(2.1, 3.2, 0, 0); add(1.5, 5.6, 0.8, 0); add(1.5, -2.6, -1.0, 0); }
  else { add(2.0, 0, 0, 0); add(2.0, 2.6, 2.6, 0); add(2.0, -2.6, 2.6, 0); add(2.0, 0, 1.7, 2.8); }  // wrong shape
  const merged = mergeGeos(parts); parts.forEach((p) => p.dispose());
  return merged;
}
function mergeGeos(list) {
  let nv = 0, ni = 0; list.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
    const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[oi + i] = gi[i] + ov;
    ov += g.attributes.position.count; oi += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/* ------------------------------------------------------------------ step plan */
// Shared timeline for the main scene (seconds):
//   0–1.4 impulse arrives · 1.0–2.2 calcium in · 1.5–3.4 vesicles fuse (exocytosis) · 2–5 diffusion · 4–5.4 binding
//   5–7 ions flow (excitation / inhibition).   Clearing has its own timeline (0–4.4 s).
const T_END = 7.2;
const PLAN = [
  { view: 'overview', at: 0, labels: ['pre', 'cleft', 'post'], cap: 'A synapse, cut open: the end of one neuron, a tiny gap, and the next neuron.' },
  { view: 'overview', range: [0, 2.2], labels: ['ap', 'ca'], cap: 'Step 1: the action potential arrives at the presynaptic terminal' },
  { view: 'zone', range: [1.2, 3.6], labels: ['vesicle', 'nt', 'exo'], cap: 'Step 2: vesicles fuse with the membrane and release neurotransmitter' },
  { view: 'zone', range: [2.6, 5.0], labels: ['diff'], cap: 'Step 3: the neurotransmitter diffuses across the synaptic cleft' },
  { view: 'receptor', range: [3.8, 5.6], labels: ['receptor', 'wrong'], wrong: true, cap: 'Step 4: it binds only to receptors with the matching shape' },
  { view: 'effect', range: [4.6, T_END], labels: ['ions', 'receptor'], ei: true, meter: true, cap: '' },
  { view: 'sum', cap: '' },
  { view: 'clear', removal: true, labels: ['reuptake', 'enzyme'], cap: 'Step 7: reuptake and enzymes clear the neurotransmitter away' },
  { view: 'overview', range: [0, T_END], labels: ['elec', 'chem', 'oneway'], cap: 'Electrical inside the neuron, chemical across the gap, one way only' },
];
const INTRO = PLAN[0];
const RECAP = { view: 'overview', at: T_END, labels: ['elec', 'chem', 'oneway'], cap: 'The whole process, from top to bottom' };
const EI_CAP = { e: 'Excitatory: the inside becomes more positive, so it is more likely to fire', i: 'Inhibitory: the inside becomes more negative, so it is less likely to fire. Real inhibitory synapses are usually on the cell body or the dendrite itself.' };
const NOTE_MAIN = 'A model, not a scan. Molecules drawn much bigger, and far fewer';

/* ------------------------------------------------------------------ lesson */
export default {
  id: 'synapse',
  title: 'Synaptic transmission',
  objectives: [
    'Describe the process of synaptic transmission, step by step.',
    'Explain excitation, inhibition and summation.',
    'Explain why synaptic transmission only goes in one direction.',
  ],
  keywords: [
    { term: 'Synapse', simple: 'The meeting point between two neurons, including the tiny gap between them.', exam: 'The junction between two neurons: the presynaptic terminal, the synaptic cleft and the postsynaptic membrane.' },
    { term: 'Neurotransmitter', simple: 'A chemical messenger. It carries the signal across the gap between two neurons.', exam: 'A chemical released from synaptic vesicles that crosses the synaptic cleft and binds to receptor sites on the postsynaptic neuron.' },
    { term: 'Receptor', simple: 'A protein on the next neuron. Only a neurotransmitter with the right shape can attach to it.', exam: 'A protein molecule on the postsynaptic membrane with a specific shape, so only a particular neurotransmitter can bind to it.' },
    { term: 'Excitation', simple: 'When a neurotransmitter makes the next neuron more likely to fire.', exam: 'The neurotransmitter makes the inside of the postsynaptic neuron more positively charged, so it is more likely to fire an action potential.' },
    { term: 'Inhibition', simple: 'When a neurotransmitter makes the next neuron less likely to fire.', exam: 'The neurotransmitter makes the inside of the postsynaptic neuron more negatively charged, so it is less likely to fire an action potential.' },
    { term: 'Summation', simple: 'Adding up all the signals. The neuron only fires if the total is big enough.', exam: 'The excitatory and inhibitory influences on a postsynaptic neuron are added together. An action potential is only triggered if the net effect reaches the threshold.' },
  ],
  steps: [
    {
      title: 'What is a synapse?',
      simple: `<p>Neurons do not touch each other. The <span class="keyterm">synapse</span> is the place where two neurons meet. It has three parts:</p>
        <ul>
          <li>the end of the first neuron, called the <strong>presynaptic</strong> neuron</li>
          <li>a tiny gap, called the <span class="keyterm">synaptic cleft</span></li>
          <li>the next neuron, called the <strong>postsynaptic</strong> neuron</li>
        </ul>
        <p>“Pre” means before. “Post” means after.</p>`,
      exam: `<p>The presynaptic terminal is the terminal button at the end of the first neuron’s axon. The postsynaptic membrane is often on a dendrite of the next neuron.</p>`,
    },
    {
      title: 'Step 1: The impulse arrives',
      simple: `<p>An electrical impulse, called an <strong>action potential</strong>, travels down the axon of the presynaptic neuron.</p>
        <p>It arrives at the <strong>presynaptic terminal</strong> (the terminal button).</p>
        <p>Up to here the signal is <strong>electrical</strong>. To cross the gap, it has to become a <strong>chemical</strong> signal.</p>`,
      exam: `<p>The arrival of the action potential causes calcium ions to enter the presynaptic terminal. This triggers the release of neurotransmitter in the next step.</p>`,
    },
    {
      title: 'Step 2: Vesicles release neurotransmitter',
      simple: `<p>The presynaptic terminal contains tiny bubbles called <strong>synaptic vesicles</strong>. Each one is full of a <span class="keyterm">neurotransmitter</span>: a chemical messenger.</p>
        <p>The vesicles move to the edge of the cell. They join with the cell membrane and empty the neurotransmitter into the gap.</p>
        <p>This way of releasing a chemical is called <strong>exocytosis</strong>.</p>`,
      exam: `<p>Exocytosis: the vesicle membrane fuses with the presynaptic membrane, and the neurotransmitter is released into the synaptic cleft.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Do not mix up <strong>neurotransmitters</strong> and <strong>hormones</strong>. Neurotransmitters cross the tiny gap at a synapse and act very quickly. Hormones are released by glands into the <strong>bloodstream</strong> and act more slowly.</p>' },
    },
    {
      title: 'Step 3: Crossing the gap',
      simple: `<p>The neurotransmitter spreads out across the synaptic cleft. This spreading out is called <strong>diffusion</strong>.</p>
        <p>The molecules move from where there are lots of them (next to the presynaptic neuron) to where there are fewer (next to the postsynaptic neuron).</p>
        <p>The gap is very small, so this happens very quickly.</p>`,
      exam: `<p>Diffusion is a passive process: the neurotransmitter moves down a concentration gradient. No energy is needed for it to cross the cleft.</p>`,
    },
    {
      title: 'Step 4: Binding to receptors',
      simple: `<p>On the postsynaptic membrane there are <span class="keyterm">receptors</span>. A receptor is a protein molecule with a particular shape.</p>
        <p>A neurotransmitter can only attach (<strong>bind</strong>) to a receptor that matches its shape. People call this “lock and key”. It means only the right key fits the lock.</p>
        <p>A molecule with the wrong shape cannot bind.</p>`,
      exam: `<p>Receptor sites are specific: each type of receptor only binds a particular neurotransmitter. When the neurotransmitter binds, it changes the electrical charge of the postsynaptic neuron (the next step).</p>`,
    },
    {
      title: 'Step 5: Excitation or inhibition',
      simple: `<p>When the neurotransmitter binds, it changes the charge inside the postsynaptic neuron.</p>
        <p><span class="keyterm">Excitation</span>: the neuron becomes <strong>more likely</strong> to fire. The inside becomes more positive.</p>
        <p><span class="keyterm">Inhibition</span>: the neuron becomes <strong>less likely</strong> to fire. The inside becomes more negative.</p>
        <p>Use the buttons above the diagram to see both.</p>`,
      exam: `<p>AQA textbooks often give <strong>adrenaline</strong> as an example of an excitatory neurotransmitter and <strong>serotonin</strong> (or GABA) as an example of an inhibitory one. Strictly, the effect depends on the type of receptor that the neurotransmitter binds to. The charge changes are called excitatory and inhibitory postsynaptic potentials (EPSPs and IPSPs).</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Adrenaline can act as a <strong>hormone</strong> (carried in the blood) and as a <strong>neurotransmitter</strong> (at a synapse). Make it clear which one you mean.</p>' },
    },
    {
      title: 'Step 6: Summation',
      simple: `<p>A neuron gets messages from many synapses at the same time. Some are excitatory and some are inhibitory.</p>
        <p><span class="keyterm">Summation</span> means adding them all up. The neuron only fires if the total reaches a level called the <strong>threshold</strong>.</p>
        <p>Try it: use the buttons above the diagram to send excitatory (+) and inhibitory (−) signals.</p>`,
      exam: `<p>If the net effect is inhibitory, the postsynaptic neuron is less likely to fire. If the net effect is excitatory and reaches the threshold, an action potential is triggered. <strong>Spatial summation</strong>: many presynaptic neurons release neurotransmitter at the same time. <strong>Temporal summation</strong>: one presynaptic neuron releases neurotransmitter many times in quick succession. In real neurons these effects fade quickly, so the inputs must arrive close together.</p>`,
    },
    {
      title: 'Step 7: Clearing the gap',
      simple: `<p>The neurotransmitter has to be removed from the gap. If it stayed, its effect would carry on.</p>
        <p>There are two ways:</p>
        <ul>
          <li><strong>Reuptake</strong>: it is taken back into the presynaptic neuron to be used again.</li>
          <li><strong>Enzymes</strong> break it down into smaller pieces.</li>
        </ul>
        <p>Now the synapse is ready for the next signal.</p>`,
      exam: `<p>Some drugs work by changing this step. For example, SSRIs (used to treat depression and OCD) block the reuptake of serotonin, so more serotonin stays in the synaptic cleft. The enzyme acetylcholinesterase breaks down the neurotransmitter acetylcholine.</p>`,
    },
    {
      title: 'One way only: electrical, then chemical',
      simple: `<p>Synaptic transmission only goes in <strong>one direction</strong>: from the presynaptic neuron to the postsynaptic neuron.</p>
        <p>This is because the vesicles are only in the presynaptic neuron, and the receptors are only on the postsynaptic neuron.</p>
        <p>The signal is <strong>electrical</strong> inside a neuron and <strong>chemical</strong> across the gap.</p>`,
      exam: `<p>A full answer, in order: action potential arrives → vesicles fuse with the membrane and release neurotransmitter (exocytosis) → diffusion across the synaptic cleft → binding to postsynaptic receptor sites → excitation or inhibition → summation decides whether the postsynaptic neuron fires → neurotransmitter removed by reuptake or enzymes.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>If a question asks you to describe the <strong>process</strong> of synaptic transmission, describe what happens, in order. Do not just label or describe the <strong>structure</strong> of the synapse. This is an easy mistake to make.</p>' },
    },
  ],
  quiz: [
    { q: 'What is released from synaptic vesicles?', options: ['Hormones', 'Neurotransmitter', 'Electrical impulses', 'Receptors'], answer: 1, explain: 'Vesicles release neurotransmitter into the synaptic cleft by exocytosis.', hint: 'It is a chemical messenger, but not a hormone.' },
    { q: 'How does the neurotransmitter cross the synaptic cleft?', options: ['It is carried in the blood', 'It diffuses across the gap', 'It travels as an electrical impulse', 'It is pumped across by the receptors'], answer: 1, explain: 'The neurotransmitter diffuses across the synaptic cleft, from where there is more of it to where there is less.', hint: 'The signal is chemical in the gap. How do chemicals spread out?' },
    { q: 'What does an inhibitory neurotransmitter do?', options: ['Makes the postsynaptic neuron more likely to fire', 'Makes the postsynaptic neuron less likely to fire', 'Breaks down the receptors', 'Makes the presynaptic neuron release more vesicles'], answer: 1, explain: 'Inhibition makes the inside of the postsynaptic neuron more negative, so it is less likely to fire.', hint: '“Inhibit” means to hold back.' },
    { q: 'Why does synaptic transmission only go in one direction?', options: ['Vesicles are only in the presynaptic neuron and receptors are only on the postsynaptic neuron', 'The gap is too wide to cross backwards', 'Electrical impulses can only move forwards', 'Hormones block the way back'], answer: 0, explain: 'Neurotransmitter is only released from the presynaptic side and can only bind on the postsynaptic side.', hint: 'Think about where the vesicles are and where the receptors are.' },
    { q: 'What is summation?', options: ['Excitatory and inhibitory inputs are added up, and the neuron fires only if the net effect reaches the threshold', 'Neurotransmitter is broken down by enzymes', 'A vesicle joins with the cell membrane', 'The impulse jumps between the nodes of Ranvier'], answer: 0, explain: 'Summation adds up all the excitatory and inhibitory influences. If the total reaches the threshold, the neuron fires.', hint: '“Sum” means total.' },
  ],
  summary: [
    'Action potential arrives → vesicles release neurotransmitter (exocytosis) → it diffuses across the cleft → it binds to receptors.',
    'Excitation = more likely to fire. Inhibition = less likely to fire. Summation: it fires only if the net effect reaches the threshold.',
    'Neurotransmitter is cleared by reuptake or enzymes. Transmission is one way: electrical inside a neuron, chemical across the gap.',
  ],
  visual: {
    dark: true,
    async create(container) {
      const style = document.createElement('style'); style.textContent = CSS; container.append(style);
      const loading = document.createElement('div'); loading.className = 'syn3d-loading'; loading.textContent = 'Loading the 3D synapse…';
      container.append(loading);
      const controls = document.createElement('div'); controls.className = 'vis-controls'; container.append(controls);
      const note = document.createElement('p'); note.className = 'syn3d-note'; note.hidden = true; container.append(note);
      const meter = document.createElement('div'); meter.className = 'syn3d-meter'; meter.hidden = true; meter.setAttribute('aria-hidden', 'true');
      meter.innerHTML = `<h4>Inside the next neuron</h4><div class="end">+</div><div class="track"><div class="zero"></div><div class="th" hidden></div><div class="fill"></div><div class="dot"></div></div><div class="end">−</div><div class="thl" hidden>Dashed line: threshold</div>`;
      container.append(meter);
      const cap = document.createElement('p'); cap.className = 'vis-caption syn3d-cap'; container.append(cap);
      const live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); container.append(live);

      const stage = createStage(container, {
        label: '3D synapse',
        safeTop: () => (controls.childElementCount ? controls.offsetTop + controls.offsetHeight + 6 : 16),
        safeBottom: () => container.clientHeight - cap.offsetTop + 6,
      });
      container.insertBefore(stage.host, controls);

      const [ampa, gaba, sert, ache, pyr] = await Promise.all([loadMol(MOL.ampa), loadMol(MOL.gaba), loadMol(MOL.sert), loadMol(MOL.ache), loadSWC(PYR)]);
      loading.remove();
      const calm = () => get('calm') === 'true';

      /* ============================================================ main scene (units: nm; 1 world unit = 100 nm) */
      const main = new THREE.Group(); main.scale.setScalar(0.01);
      const clip = new THREE.Plane(V(0, 0, -1), 0);
      const preU = { uAPy: { value: -1e6 }, uAPGlow: { value: 0 } };
      const postU = { uInnerGlow: { value: new THREE.Color(0, 0, 0) } };
      const pre = lathe([[0, 20], [120, 20], [200, 24], [265, 48], [310, 110], [330, 200], [322, 300], [285, 390], [220, 470], [150, 540], [105, 620], [92, 760], [90, 980]]);
      const preMesh = new THREE.Mesh(pre.geo, membraneMaterial('#EBA6BF', '#A65C80', clip, preU));
      const spine = lathe([[0, 0], [140, 0], [215, -10], [262, -55], [282, -140], [262, -235], [200, -310], [120, -365], [72, -420], [62, -500], [66, -580], [90, -640], [140, -690]]);
      const postMat = membraneMaterial('#B7A4F2', '#9A90DA', clip, postU);
      const spineMesh = new THREE.Mesh(spine.geo, postMat);
      const shaftGeo = new THREE.CylinderGeometry(230, 230, 1700, 96, 1, true); shaftGeo.rotateZ(Math.PI / 2); shaftGeo.translate(0, -860, 0);
      const shaft = new THREE.Mesh(shaftGeo, postMat);
      const edgeMat = new THREE.MeshStandardMaterial({ color: '#FFE3EF', roughness: 0.5, emissive: new THREE.Color('#3A2030') });
      const edgeMatPost = new THREE.MeshStandardMaterial({ color: '#E6DEFF', roughness: 0.5, emissive: new THREE.Color('#201A40') });
      const preEdge = cutOutline(pre.profile, 3.5, edgeMat);
      const spineEdge = cutOutline(spine.profile, 3.5, edgeMatPost);
      const shaftEdges = [-1, 1].map((sg) => new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1700, 6).rotateZ(Math.PI / 2).translate(0, -860 + sg * 230, 0.5), edgeMatPost));
      main.add(preMesh, spineMesh, shaft, preEdge, spineEdge, ...shaftEdges);

      // vesicles: a reserve pool (static) and four docked at the active zone (three of them release)
      const rand = rng(11);
      const profR = (y) => { let best = 0; for (const p of pre.profile) if (Math.abs(p.y - y) < 12) best = Math.max(best, p.x); return best; };
      const vesMat = new THREE.MeshPhysicalMaterial({ color: '#F4E6FF', roughness: 0.22, clearcoat: 0.6, transparent: true, opacity: 0.82, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });
      const vesGeo = new THREE.SphereGeometry(20, 28, 18);
      const pool = [];
      for (let tries = 0; pool.length < 46 && tries < 4000; tries++) {
        const y = 85 + rand() * 400; const R = profR(y) - 38; if (R < 30) continue;
        const a = Math.PI + rand() * Math.PI; const r = Math.sqrt(rand()) * R;
        const p = V(Math.cos(a) * r, y, Math.sin(a) * r);
        if (p.z > -24) continue;
        if (pool.some((q) => q.distanceTo(p) < 46)) continue;
        pool.push(p);
      }
      const poolMesh = new THREE.InstancedMesh(vesGeo, vesMat, pool.length);
      const mtx = new THREE.Matrix4();
      pool.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); poolMesh.setMatrixAt(i, mtx); });
      main.add(poolMesh);
      const DOCK = [V(-118, 46, -46), V(-38, 46, -74), V(44, 46, -34), V(122, 46, -62)];
      const docked = DOCK.map((p) => { const m = new THREE.Mesh(vesGeo, vesMat); m.position.copy(p); main.add(m); return m; });
      const FUSE = [1.5, 1.85, 2.2];   // fusion start times for docked vesicles 0..2 (3 stays docked)

      // receptors in the postsynaptic density (only behind the cut plane)
      const recSpots = [];
      for (let tries = 0; recSpots.length < 11 && tries < 3000; tries++) {
        const a = Math.PI + rand() * Math.PI, r = Math.sqrt(rand()) * 150;
        const p = V(Math.cos(a) * r, -3, Math.sin(a) * r);
        if (p.z > -12) continue;
        if (recSpots.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 36)) continue;
        recSpots.push(p);
      }
      const recRot = recSpots.map(() => rand() * Math.PI * 2);
      let FOCUS = 0; recSpots.forEach((p, j) => { if (Math.hypot(p.x, p.z + 30) < Math.hypot(recSpots[FOCUS].x, recSpots[FOCUS].z + 30)) FOCUS = j; });
      const siteOf = (geo, r, y) => {   // the mesh vertex nearest a target point on the protein surface
        const pos = geo.attributes.position; let best = null, bd = Infinity; const t = V(r, y, 0); const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const d = v.distanceToSquared(t); if (d < bd) { bd = d; best = v.clone(); } }
        return best;
      };
      const protMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.35, sheen: 0.35, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
      const RECEPTOR = {
        e: { geo: ampa.geo, color: '#3FC4B0', site: siteOf(ampa.geo, 6, 7.5), pdb: '3KG2', name: 'glutamate receptor' },
        i: { geo: gaba.geo, color: '#8F8CFF', site: siteOf(gaba.geo, 5, 5.5), pdb: '6HUP', name: 'GABA-A receptor' },
      };
      for (const k of ['e', 'i']) {
        const R = RECEPTOR[k];
        const im = new THREE.InstancedMesh(R.geo, protMat('#ffffff'), recSpots.length);
        const base = new THREE.Color(R.color);
        recSpots.forEach((p, j) => { mtx.makeRotationY(recRot[j]).setPosition(p); im.setMatrixAt(j, mtx); im.setColorAt(j, base); });
        im.instanceColor.needsUpdate = true;
        R.mesh = im; R.base = base; main.add(im);
        R.sites = recSpots.map((p, j) => R.site.clone().applyAxisAngle(V(0, 1, 0), recRot[j]).add(p));
        R.tops = recSpots.map((p) => p.clone().add(V(0, k === 'e' ? 15 : 9, 0)));
      }
      // reuptake transporters (presynaptic membrane, outside facing the cleft) and enzymes (in the cleft)
      const tSpots = [V(-150, 21, -34), V(-170, 21, -150), V(200, 21, -95), V(150, 21, -175), V(-60, 21, -215), V(80, 21, -215)];
      const tMesh = new THREE.InstancedMesh(sert.geo, protMat('#F2A06A'), tSpots.length);
      tSpots.forEach((p, j) => { mtx.makeRotationX(Math.PI).premultiply(new THREE.Matrix4().makeRotationY(j * 1.7)).setPosition(p.x, p.y + 1, p.z); tMesh.setMatrixAt(j, mtx); });
      const eSpots = [V(-245, 9, -60), V(150, 9, -32), V(-120, 9, -190), V(140, 10, -200), V(10, 9, -250)];
      const eMesh = new THREE.InstancedMesh(ache.geo, protMat('#A3DB6E'), eSpots.length);
      eSpots.forEach((p, j) => { mtx.makeRotationFromEuler(new THREE.Euler(j * 0.9, j * 1.3, j * 0.4)).setPosition(p); eMesh.setMatrixAt(j, mtx); });
      main.add(tMesh, eMesh);

      // neurotransmitter particles: 14 per releasing vesicle
      const N_PER = 14, NP = N_PER * FUSE.length;
      const ntGeo = { e: moleculeGeo('e'), i: moleculeGeo('i'), wrong: moleculeGeo('wrong') };
      const ntMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.6, emissive: new THREE.Color(c), emissiveIntensity: 0.25 });
      const ntMesh = { e: new THREE.InstancedMesh(ntGeo.e, ntMat(COL.e), NP), i: new THREE.InstancedMesh(ntGeo.i, ntMat(COL.i), NP) };
      main.add(ntMesh.e, ntMesh.i);
      const wrongMesh = new THREE.InstancedMesh(ntGeo.wrong, ntMat(COL.wrong), 1); main.add(wrongMesh);
      const fragMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1.7, 10, 8), ntMat('#E8D9A8'), NP * 2); main.add(fragMesh);
      const particles = [];
      let siteUse = recSpots.map(() => 0);
      for (let i = 0; i < NP; i++) {
        const k = Math.floor(i / N_PER);
        const off = V(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(22);
        const tr = FUSE[k] + 0.5 + rand() * 0.3;
        let target, site = -1;
        if (i % 3 !== 2) {
          // nearest receptor with a free site
          let best = -1, bd = Infinity;
          recSpots.forEach((p, j) => { if (siteUse[j] >= 2) return; const d = Math.hypot(p.x - DOCK[k].x, p.z - DOCK[k].z) + rand() * 60; if (d < bd) { bd = d; best = j; } });
          if (best >= 0) { site = best; siteUse[best]++; }
        }
        if (site < 0) target = V((rand() - 0.5) * 380, 6 + rand() * 10, -20 - rand() * 180);
        const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
        const removal = i % 2 === 0 ? { kind: 'reuptake', j: i % tSpots.length } : { kind: 'enzyme', j: i % eSpots.length };
        particles.push({ k, off, tr, ta: tr + 1.3 + rand() * 1.0, site, target, ph, rot, removal, spin: rand() * 2 - 1 });
      }
      const pore = (k) => V(DOCK[k].x, 14, DOCK[k].z);
      const vesState = (k, t) => {
        if (k >= FUSE.length) return { p: DOCK[k], s: 1 };
        const u = seg(t, FUSE[k], FUSE[k] + 1.0);
        return { p: V(DOCK[k].x, 46 - 22 * easeOut(Math.min(1, u * 1.4)), DOCK[k].z), s: 1 - smooth(seg(u, 0.35, 1.0)) };
      };
      const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
      let mode = 'e';
      function wander(p, t, amp = 1) {   // gentle Brownian-looking jitter
        return V(Math.sin(t * 1.7 + p.ph[0]) * 6 + Math.sin(t * 3.1 + p.ph[1]) * 3, Math.sin(t * 2.3 + p.ph[2]) * 2.2, Math.cos(t * 1.9 + p.ph[3]) * 6).multiplyScalar(amp);
      }
      function particlePos(p, t, R) {
        const pr = pore(p.k);
        if (t < p.tr) { const vs = vesState(p.k, t); return { pos: vs.p.clone().addScaledVector(p.off, 0.9 * Math.max(0.35, vs.s)), vis: vs.s > 0.02 || t >= p.tr - 0.05, bound: false }; }
        const end = p.site >= 0 ? R.sites[p.site].clone() : p.target.clone();
        const u = seg(t, p.tr, p.ta);
        if (u < 1) {
          const e = easeOut(u);
          const pos = pr.clone().lerp(end, e);
          const env = Math.sin(Math.PI * u);
          pos.x += (Math.sin(u * 9 + p.ph[0]) * 24 + Math.sin(u * 17 + p.ph[1]) * 9) * env;
          pos.z += (Math.cos(u * 8 + p.ph[2]) * 24) * env;
          pos.y = Math.min(16, Math.max(3, pos.y + Math.sin(u * 11 + p.ph[3]) * 4 * env));
          return { pos, vis: true, bound: false };
        }
        return { pos: end.add(p.site >= 0 ? V(0, 0, 0) : wander(p, t)), vis: true, bound: p.site >= 0 };
      }
      // calcium ions (step 1) and sodium / chloride ions (step 5)
      const caMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 10, 8), ntMat(COL.ca), 12); main.add(caMesh);
      const ionMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 10, 8), ntMat(COL.na), 40); main.add(ionMesh);
      const ions = Array.from({ length: 40 }, (_, i) => ({ j: i % recSpots.length, te: 5.0 + rand() * 1.5, a: rand() * 6.28, r: 20 + rand() * 120, d: 40 + rand() * 120, o: V((rand() - 0.5) * 4, 0, (rand() - 0.5) * 4) }));
      const cas = Array.from({ length: 12 }, (_, i) => ({ k: i % 3, t0: 0.9 + rand() * 0.6, o: V((rand() - 0.5) * 50, 0, (rand() - 0.5) * 30) }));
      const hide = (im, i) => { mtx.makeScale(0, 0, 0); im.setMatrixAt(i, mtx); };

      /** Draw the main scene at time t of the shared timeline. */
      function render(t, { wrong = false } = {}) {
        const R = RECEPTOR[mode];
        // impulse arriving down the axon into the terminal
        preU.uAPy.value = 980 - 1000 * easeOut(seg(t, 0, 1.3));
        preU.uAPGlow.value = (calm() ? 0.3 : 1) * (t > 0 && t < 1.9 ? 1 - seg(t, 1.3, 1.9) : 0);
        // vesicles
        for (let k = 0; k < DOCK.length; k++) { const vs = vesState(k, t); docked[k].position.copy(vs.p); docked[k].scale.setScalar(Math.max(0.0001, vs.s)); docked[k].visible = vs.s > 0.01; }
        // calcium
        cas.forEach((c, i) => {
          const u = seg(t, c.t0, c.t0 + 0.9);
          if (u <= 0 || u >= 1 || t > 2.4) { hide(caMesh, i); return; }
          const p = V(DOCK[c.k].x + c.o.x, 2 + 70 * easeOut(u), DOCK[c.k].z + c.o.z);
          mtx.makeScale(1, 1, 1).setPosition(p); caMesh.setMatrixAt(i, mtx);
        });
        caMesh.instanceMatrix.needsUpdate = true;
        // neurotransmitter
        const im = ntMesh[mode]; ntMesh.e.visible = mode === 'e'; ntMesh.i.visible = mode === 'i';
        const bound = recSpots.map(() => 0);
        particles.forEach((p, i) => {
          const s = particlePos(p, t, R);
          if (!s.vis) { hide(im, i); return; }
          if (s.bound) bound[p.site]++;
          tmpQ.copy(p.rot); if (!s.bound) tmpQ.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), t * p.spin));
          mtx.compose(s.pos, tmpQ, tmpS.set(1, 1, 1)); im.setMatrixAt(i, mtx);
        });
        im.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < NP * 2; i++) hide(fragMesh, i); fragMesh.instanceMatrix.needsUpdate = true;
        // receptors light up when something is bound
        const lit = new THREE.Color();
        recSpots.forEach((_, j) => { lit.copy(R.base).lerp(new THREE.Color('#ffffff'), bound[j] ? 0.3 : 0); R.mesh.setColorAt(j, lit); });
        R.mesh.instanceColor.needsUpdate = true;
        RECEPTOR.e.mesh.visible = mode === 'e'; RECEPTOR.i.mesh.visible = mode === 'i';
        // the wrong-shaped molecule bounces off (step 4 only)
        if (wrong) {
          const site = R.sites[FOCUS], start = V(site.x - 45, 15, site.z + 6), back = V(site.x + 40, 16, site.z + 8);
          const u1 = seg(t, 3.9, 4.8), u2 = seg(t, 4.8, 5.6);
          const p = u2 > 0 ? site.clone().add(V(0, 3, 0)).lerp(back, easeOut(u2)) : start.clone().lerp(site.clone().add(V(0, 3, 0)), smooth(u1));
          mtx.compose(p, new THREE.Quaternion().setFromAxisAngle(V(0.3, 1, 0.2).normalize(), t * 1.3), tmpS.set(1, 1, 1));
          wrongMesh.setMatrixAt(0, mtx); wrongMesh.visible = t > 3.85;
        } else wrongMesh.visible = false;
        wrongMesh.instanceMatrix.needsUpdate = true;
        // ions flowing through the open receptors into the spine
        const ionCol = new THREE.Color(mode === 'e' ? COL.na : COL.cl);
        ionMesh.material.color.copy(ionCol); ionMesh.material.emissive.copy(ionCol);
        ions.forEach((o, i) => {
          const u = seg(t, o.te, o.te + 1.4);
          if (u <= 0 || !bound[o.j] && t < T_END) { hide(ionMesh, i); return; }
          const top = recSpots[o.j].clone().add(V(0, 12, 0));
          let p;
          if (u < 0.45) p = top.clone().lerp(recSpots[o.j].clone().add(V(0, -8, 0)), smooth(u / 0.45)).add(o.o);
          else { const w = smooth((u - 0.45) / 0.55); p = recSpots[o.j].clone().add(V(Math.cos(o.a) * o.r * w * 0.5, -8 - o.d * w, Math.sin(o.a) * o.r * w * 0.35 - 6 * w)); }
          if (p.z > -4) p.z = -4;
          mtx.makeTranslation(p.x, p.y, p.z); ionMesh.setMatrixAt(i, mtx);
        });
        ionMesh.instanceMatrix.needsUpdate = true;
        const eff = smooth(seg(t, 5.2, 6.9));
        const gl = (calm() ? 0.08 : 0.2) * eff;
        postU.uInnerGlow.value.set(mode === 'e' ? '#FF9A3D' : '#3D8BFF').multiplyScalar(gl);
        return eff;
      }

      /** Clearing the cleft: reuptake into the terminal, or broken down by an enzyme. */
      function renderRemoval(t) {
        render(T_END);
        const R = RECEPTOR[mode];
        const im = ntMesh[mode];
        const back = new THREE.Color();
        recSpots.forEach((_, j) => { back.copy(R.base).lerp(new THREE.Color('#ffffff'), 0.45 * (1 - seg(t, 0.2, 0.8))); R.mesh.setColorAt(j, back); });
        R.mesh.instanceColor.needsUpdate = true;
        postU.uInnerGlow.value.multiplyScalar(1 - seg(t, 0, 1.2));
        for (let i = 0; i < ionMesh.count; i++) hide(ionMesh, i); ionMesh.instanceMatrix.needsUpdate = true;
        particles.forEach((p, i) => {
          const s = particlePos(p, T_END, R);
          const delay = (i % 7) * 0.12;
          const u1 = seg(t, 0.3 + delay, 2.3 + delay);
          const dest = p.removal.kind === 'reuptake' ? tSpots[p.removal.j].clone().add(V(0, -7, 0)) : eSpots[p.removal.j].clone().add(V(0, -2, 0));
          let pos = s.pos.clone().add(V(0, 4 * smooth(seg(t, delay, 0.3 + delay)), 0)).lerp(dest, smooth(u1));
          pos.add(wander(p, t, Math.sin(Math.PI * u1) * 2));
          let scale = 1;
          const u2 = seg(t, 2.3 + delay, 3.4 + delay);
          if (p.removal.kind === 'reuptake') {
            if (u2 > 0) { pos = dest.clone().add(V(0, 70 * easeOut(u2), 0)); scale = 1 - smooth(seg(u2, 0.4, 1)); }
            hide(fragMesh, i * 2); hide(fragMesh, i * 2 + 1);
          } else {
            scale = u2 > 0 ? 0 : 1;
            for (let h = 0; h < 2; h++) {
              if (u2 <= 0 || u2 >= 1) { hide(fragMesh, i * 2 + h); continue; }
              const dir = V(h ? 1 : -1, 0.4, h ? 0.3 : -0.3).normalize();
              const fp = dest.clone().addScaledVector(dir, 4 + 26 * easeOut(u2));
              const fs = 1 - smooth(seg(u2, 0.5, 1));
              mtx.makeScale(fs, fs, fs).setPosition(fp); fragMesh.setMatrixAt(i * 2 + h, mtx);
            }
          }
          if (scale <= 0.001) { hide(im, i); return; }
          mtx.compose(pos, p.rot, tmpS.set(scale, scale, scale)); im.setMatrixAt(i, mtx);
        });
        im.instanceMatrix.needsUpdate = true; fragMesh.instanceMatrix.needsUpdate = true;
      }

      const W = (x, y, z) => main.localToWorld(V(x, y, z));
      const LBL = {
        pre: { text: 'Presynaptic terminal', sub: 'the end of the first neuron', at: () => W(-322, 250, 0), side: 'left', dist: 60 },
        cleft: { text: 'Synaptic cleft', sub: 'the gap: about 20 nm (20 millionths of a millimetre)', at: () => W(-215, 10, -10), side: 'left', dist: 70 },
        post: { text: 'Postsynaptic neuron', sub: 'here, a spine on a dendrite', at: () => W(-282, -150, 0), side: 'left', dist: 60 },
        ap: { text: 'Action potential arrives', sub: 'electrical', at: () => W(-95, 650, 0), side: 'right', dist: 140 },
        ca: { text: 'Calcium ions flow in', at: () => W(-60, 40, -50), side: 'right', dist: 150 },
        vesicle: { text: 'Synaptic vesicle', sub: 'full of neurotransmitter', at: () => W(122, 60, -62), side: 'right', dist: 70 },
        nt: { text: 'Neurotransmitter', sub: 'drawn much bigger than real', at: () => main.localToWorld(particlePos(particles[3], lastT, RECEPTOR[mode]).pos), side: 'left', dist: 80 },
        exo: { text: 'Exocytosis', sub: 'the vesicle joins the membrane', at: () => W(-38, 22, -74), side: 'top', dist: 120, offset: [-60, 0] },
        diff: { text: 'Diffusion', sub: 'spreading across the gap', at: () => W(0, 10, -60), side: 'right', dist: 140, offset: [0, -60] },
        receptor: { text: 'Receptor', sub: '', at: () => main.localToWorld(RECEPTOR[mode].tops[FOCUS].clone()), side: 'left', dist: 90 },
        wrong: { text: 'Wrong shape', sub: 'it cannot bind', at: () => wrongMesh.visible ? (wrongMesh.getMatrixAt(0, mtx), main.localToWorld(tmpP.setFromMatrixPosition(mtx).clone())) : null, side: 'right', dist: 90 },
        ions: { text: 'Positive ions flow in', sub: 'the inside becomes more positive', at: () => W(0, -70, -40), side: 'left', dist: 90 },
        reuptake: { text: 'Reuptake', sub: 'a transporter protein takes it back in', tag: 'example shape: a serotonin transporter (PDB 5I6X)', at: () => W(-150, 20, -34), side: 'top', dist: 120, offset: [-40, 0] },
        enzyme: { text: 'Enzyme', sub: 'breaks it down', tag: 'example shape: acetylcholinesterase (PDB 4EY4)', at: () => W(150, 9, -32), side: 'bottom', dist: 110 },
        elec: { text: 'Electrical', sub: 'the impulse inside the neuron', at: () => W(-95, 600, 0), side: 'right', dist: 150 },
        chem: { text: 'Chemical', sub: 'neurotransmitter crosses the gap', at: () => W(-150, 10, -30), side: 'left', dist: 90 },
        oneway: { text: 'One way only', sub: 'vesicles only here, receptors only there', at: () => W(120, -6, -40), side: 'right', dist: 110, offset: [0, 40] },
      };
      const VIEWS = {
        overview: { box: [V(-360, -1000, -330), V(360, 900, 0)], dir: V(0.42, 0.16, 1) },
        zone: { box: [V(-165, -25, -110), V(165, 105, 0)], dir: V(0.22, 0.1, 1) },
        receptor: { box: [V(recSpots[FOCUS].x - 60, -6, recSpots[FOCUS].z - 20), V(recSpots[FOCUS].x + 60, 30, 0)], dir: V(0.1, 0.06, 1) },
        effect: { box: [V(-210, -220, -150), V(210, 110, 0)], dir: V(0.3, 0.12, 1) },
        clear: { box: [V(-200, -25, -120), V(200, 80, 0)], dir: V(0.15, 0.12, 1) },
      };
      stage.root.add(main);

      /* ============================================================ summation scene (a real human neuron) */
      const sum = new THREE.Group(); sum.scale.setScalar(0.01); sum.visible = false; stage.root.add(sum);
      const neuron = buildNeuron(pyr, { minRadius: 0.7, step: 3, radial: 7, nucleus: false, myelin: { start: 42, internode: 70, gap: 10, thickness: 3.2, endPad: 60 }, terminals: { radius: 2.4 } });
      sum.add(neuron.group);
      const sc = neuron.soma.center;
      const pickDend = (dir, lo, hi) => {
        let b = null, bs = -Infinity;
        for (const nd of neuron.nodes) {
          if (nd.type !== 3) continue; const d = neuron.D.get(nd.id); if (d < lo || d > hi) continue;
          const v = V(nd.x, nd.y, nd.z).sub(sc).normalize(); const s2 = v.dot(dir);
          if (s2 > bs) { bs = s2; b = nd; }
        }
        return V(b.x, b.y, b.z);
      };
      const inputs = [
        { kind: 'e', at: pickDend(V(-1, 0.1, 0.2).normalize(), 55, 85) },
        { kind: 'e', at: pickDend(V(0.9, -0.2, 0.3).normalize(), 55, 85) },
        { kind: 'i', at: sc.clone().add(V(-neuron.soma.radius * 0.95, -neuron.soma.radius * 0.5, neuron.soma.radius * 0.5)) },
      ].map((inp) => {
        const out = inp.at.clone().sub(sc).setY(inp.at.y - sc.y + 30).normalize();
        const bp = inp.at.clone().addScaledVector(out, 7.5);
        const col = COL[inp.kind];
        const bm = new THREE.Mesh(new THREE.SphereGeometry(6.5, 24, 16), tissueMaterial(col, { emissive: new THREE.Color(col), emissiveIntensity: 0.15 }));
        bm.position.copy(bp);
        const stubEnd = bp.clone().addScaledVector(out, 70).add(V(0, 25, 0));
        const stub = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bp, bp.clone().lerp(stubEnd, 0.5).add(V(6, 4, 0)), stubEnd]), 24, 1.8, 8), tissueMaterial(col));
        sum.add(bm, stub);
        return { ...inp, bp, mesh: bm };
      });
      const sparkIn = createSpark(undefined, 0.16); const sparkAx = createSpark(undefined, 0.3);
      stage.root.add(sparkIn, sparkAx);
      const SW = (p) => sum.localToWorld(p.clone());
      const SUM_LBL = {
        e: { text: 'Excitatory synapses (+)', at: () => SW(inputs[0].bp), side: 'left', dist: 70 },
        e2: { text: 'Excitatory (+)', at: () => SW(inputs[1].bp), side: 'top', dist: 70 },
        i: { text: 'Inhibitory synapse (−)', at: () => SW(inputs[2].bp), side: 'bottom', dist: 90, offset: [-60, 0] },
        fire: { text: 'It fires!', sub: 'an action potential travels down the axon', at: () => neuron.anchor('axonMid') && neuron.pointAt(110), side: 'right', dist: 80 },
      };
      const sumBox = () => { const c = SW(sc); return new THREE.Box3(c.clone().add(V(-1.15, -1.5, -0.6)), c.clone().add(V(1.15, 0.9, 0.6))); };

      /* ============================================================ animation plumbing */
      let anim = null, lastT = 0;
      const tickers = new Set();
      stage.onFrame((dt) => {
        updatePixelScale(stage.camera, stage.size.h);
        let busy = neuron.update(dt);
        for (const f of tickers) if (f(dt)) busy = true;
        if (anim) {
          anim.t += dt; const done = anim.t >= anim.dur;
          anim.fn(Math.min(anim.t, anim.dur));
          if (done) { const a = anim; anim = null; a.done?.(); }
          busy = true;
        }
        return busy;
      });
      function play(dur, fn, { still = dur } = {}) {
        if (reducedMotion()) { anim = null; fn(still); stage.requestRender(); return; }
        anim = { t: 0, dur, fn }; fn(0);
      }

      /* ---------------------------------------------------------- meter */
      const mDot = meter.querySelector('.dot'), mFill = meter.querySelector('.fill'), mTh = meter.querySelector('.th'), mThl = meter.querySelector('.thl');
      function setMeter(v, range = 4, th = null) {   // v in [-range, range]
        const y = 50 - (v / range) * 50;
        mDot.style.top = `${y}%`;
        mFill.style.top = `${Math.min(50, y)}%`; mFill.style.height = `${Math.abs(50 - y)}%`;
        mFill.style.background = v >= 0 ? COL.e : COL.i;
        mTh.hidden = th == null; mThl.hidden = th == null;
        if (th != null) mTh.style.top = `${50 - (th / range) * 50}%`;
      }

      /* ---------------------------------------------------------- summation logic */
      const S = { v: 0, shown: 0, n: 0, touched: false, fired: false };
      const TH = 3;
      let sumAnims = [];
      tickers.add((dt) => {
        if (!sumAnims.length) return false;
        sumAnims = sumAnims.filter((a) => { a.t += dt; a.fn(Math.min(1, a.t / a.dur)); if (a.t >= a.dur) { a.done?.(); return false; } return true; });
        return true;
      });
      function sumAnim(dur, fn, done) {
        if (reducedMotion()) { fn(1); done?.(); stage.requestRender(); return; }
        sumAnims.push({ t: 0, dur, fn, done });
      }
      const sumCaption = (v) => {
        if (v === 0 && !S.touched) return 'Send signals with the buttons. It fires at the threshold.';
        const n = `Net ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}.`;
        if (v >= TH) return `${n} Threshold reached: the neuron fires!`;
        if (v < 0) return `${n} Inhibition is winning, so it does not fire.`;
        return `${n} Below the threshold, so it does not fire yet.`;
      };
      function sumSetCaption() { const c = sumCaption(S.v); cap.textContent = c; stage.setLabel(c); live.textContent = c; }
      function fire() {
        S.fired = true;
        stage.labels.set(['e', 'e2', 'i', 'fire'].map((k) => ({ key: k, ...SUM_LBL[k] })));
        sumAnim(2.6, (u) => {
          const G = calm() ? 0.75 : 1;
          neuron.setFront('soma', 0, G * Math.sin(Math.PI * Math.min(1, u * 3)));
          neuron.setFront('axon', neuron.axonFrontAt(u), u < 1 ? G : 0, 22);
          sparkAx.visible = u > 0 && u < 1; if (sparkAx.visible) sparkAx.position.copy(neuron.pointAt(neuron.axonFrontAt(u)));
        }, () => { neuron.setFront('axon', -1e6, 0); sparkAx.visible = false; });
      }
      function send(kind) {
        S.touched = true;
        const before = S.v;
        S.v = Math.max(-4, Math.min(4, S.v + (kind === 'e' ? 1 : -1)));
        const src = kind === 'e' ? inputs[S.n++ % 2] : inputs[2];
        const path = neuron.pathToSoma(SW(src.bp));
        path.unshift(SW(src.bp));
        const from = S.shown, to = S.v;
        sumSetCaption();
        sparkIn.material.color.set(COL[kind]);
        sumAnim(0.7, (u) => {
          const f = u * (path.length - 1); const i = Math.min(path.length - 2, Math.floor(f));
          sparkIn.visible = u < 1; sparkIn.position.copy(path[i]).lerp(path[i + 1], f - i);
        }, () => {
          sparkIn.visible = false;
          neuron.meshes.soma.material.userData.U.uGlowCol.value.set(COL[kind]);
          sumAnim(0.5, (u) => {
            S.shown = from + (to - from) * smooth(u); setMeter(S.shown, 4, TH);
            neuron.setFront('soma', 0, (calm() ? 0.4 : 0.8) * Math.sin(Math.PI * u));
          }, () => {
            neuron.meshes.soma.material.userData.U.uGlowCol.value.set('#FFE9A8');
            S.shown = to; setMeter(to, 4, TH);
            if (before < TH && to >= TH) fire();
            if (to < TH && S.fired) { S.fired = false; stage.labels.set(['e', 'e2', 'i'].map((k) => ({ key: k, ...SUM_LBL[k] }))); }
          });
        });
      }
      function resetSum() {
        sumAnims = []; S.v = 0; S.shown = 0; S.n = 0; S.touched = false; S.fired = false;
        neuron.clearSignals(); sparkIn.visible = false; sparkAx.visible = false;
        setMeter(0, 4, TH); sumSetCaption();
        stage.labels.set(['e', 'e2', 'i'].map((k) => ({ key: k, ...SUM_LBL[k] })));
      }

      /* ---------------------------------------------------------- show */
      let current = null, eiType = 'e';
      const btn = (text, onClick, extra = {}) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'syn3d-btn'; b.textContent = text;
        for (const k in extra) b.setAttribute(k, extra[k]);
        b.addEventListener('click', onClick); controls.append(b); return b;
      };
      stage.onInteract(() => {
        if (controls.querySelector('[data-reset]')) return;
        btn('⟲ Reset view', (e) => { e.currentTarget.remove(); frame(current, false); }, { 'data-reset': '' });
      });
      function frame(plan, instant) {
        if (plan.view === 'sum') { stage.fit(sumBox(), { dir: V(0.15, 0.05, 1), padding: 1.0, instant }); return; }
        const v = VIEWS[plan.view];
        main.updateMatrixWorld(true);
        const box = new THREE.Box3(main.localToWorld(v.box[0].clone()), main.localToWorld(v.box[1].clone()));
        stage.fit(box, { dir: v.dir, padding: 1.04, instant });
      }
      function setLabels(keys) {
        const R = RECEPTOR[mode];
        const list = keys.filter((k) => LBL[k]).map((k) => {
          const spec = { key: k, ...LBL[k] };
          if (k === 'receptor') { spec.sub = 'a protein with a matching shape'; spec.tag = `shape from a real ${R.name} (PDB ${R.pdb})`; }
          if (k === 'ions') { spec.text = mode === 'e' ? 'Positive ions flow in' : 'Negative ions flow in'; spec.sub = mode === 'e' ? 'the inside becomes more positive' : 'the inside becomes more negative'; spec.key = `ions-${mode}`; }
          return spec;
        });
        stage.labels.set(list);
      }
      function playMain(plan) {
        const opts = { wrong: !!plan.wrong };
        if (plan.removal) { play(4.6, (t) => { lastT = T_END; renderRemoval(t); }); return; }
        if (plan.range) {
          const [a, b] = plan.range;
          play(b - a, (t) => {
            lastT = a + t;
            const eff = render(a + t, opts);
            if (plan.meter) setMeter((mode === 'e' ? 2 : -2) * eff, 4);
          });
        } else { lastT = plan.at ?? 0; render(lastT, opts); }
      }

      function show(step) {
        const plan = step < 0 ? INTRO : step >= PLAN.length ? RECAP : PLAN[step];
        const prev = current; current = plan;
        anim = null; sumAnims = [];
        controls.innerHTML = '';
        live.textContent = '';
        const isSum = plan.view === 'sum';
        main.visible = !isSum; sum.visible = isSum; sparkIn.visible = false; sparkAx.visible = false;
        meter.hidden = !(isSum || plan.meter);
        note.hidden = false;
        note.textContent = isSum ? 'Real human neuron · myelin and synapses drawn, synapses much bigger than real' : NOTE_MAIN;
        stage.setAO(false);   // screen-space AO leaves dark blocks at these small scales
        const motion = !reducedMotion();

        if (isSum) {
          mode = 'e';
          neuron.highlight(null, { instant: true });
          btn('+ Excitatory', () => send('e'), { 'aria-label': 'Send an excitatory signal (plus one)' });
          btn('− Inhibitory', () => send('i'), { 'aria-label': 'Send an inhibitory signal (minus one)' });
          btn('Reset', () => resetSum());
          resetSum();
          frame(plan, !prev || prev.view !== 'sum');
          return;
        }
        mode = plan.ei ? eiType : 'e';
        if (plan.ei) {
          const setEi = (type) => {
            eiType = type; mode = type;
            bE.setAttribute('aria-pressed', String(type === 'e')); bI.setAttribute('aria-pressed', String(type === 'i'));
            cap.textContent = EI_CAP[type]; stage.setLabel(EI_CAP[type]); live.textContent = EI_CAP[type];
            setLabels(plan.labels);
            playMain(plan);
          };
          const bE = btn('+ Excitatory', () => setEi('e'));
          const bI = btn('− Inhibitory', () => setEi('i'));
          if (motion) btn('↻ Play again', () => playMain(plan));
          setEi(eiType);
        } else {
          cap.textContent = plan.cap; stage.setLabel(plan.cap);
          setLabels(plan.labels);
          if ((plan.range || plan.removal) && motion) btn('↻ Play again', () => playMain(plan));
          playMain(plan);
        }
        frame(plan, !prev || prev.view === 'sum');
        stage.requestRender();
      }

      return {
        show,
        dispose() {
          anim = null; sumAnims = [];
          neuron.dispose();
          Object.values(ntGeo).forEach((g) => g.dispose());
          stage.dispose();
          [style, controls, note, meter, cap, live, loading].forEach((e) => e.remove());
        },
      };
    },
  },
};
