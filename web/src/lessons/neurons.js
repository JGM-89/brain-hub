// Neurons — AQA 7182 Biopsychology (AS + A-level):
// "The structure and function of sensory, relay and motor neurons."
// Visual: real 3D neurons built from published reconstructions (NeuroMorpho.Org, see public/neurons/credits.json):
//   1. a human cortical pyramidal neuron whose parts light up step by step (labels anchored to 3D points),
//   2. myelinated v. unmyelinated axons racing (the impulse jumps node to node on the myelinated one),
//   3. sensory, relay and motor neurons, one row each (real shapes; parts that were not reconstructed are drawn
//      and labelled as drawn),
//   4. a reflex arc through a simple 3D spinal cord: receptor → sensory → relay → motor → muscle.
// Animations play once, with "Play again". With reduced motion they show a still end-state; calm mode turns
// the glow off. The learner can turn and zoom every scene (mouse, touch, or arrow keys when the picture has focus).
import * as THREE from 'three';
import { reducedMotion, get } from '../settings.js';
import { createStage } from '../three/stage3d.js';
import { tissueMaterial } from '../three/look.js';
import { loadSWC, buildNeuron, geodesic, mainAxonTip, straightAxonNodes, updatePixelScale, createSpark } from '../three/neuron3d.js';

const BASE = import.meta.env.BASE_URL;
const SWC = {
  pyramidal: `${BASE}neurons/pyramidal-human-685815936.swc`,
  motor: `${BASE}neurons/motor-rat-alvarez-control-1.swc`,
  relay: `${BASE}neurons/relay-mouse-todd-26-2-15-C.swc`,
  skin: `${BASE}neurons/sensory-skin-ending-mouse-A21-44.swc`,
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (u) => u * u * (3 - 2 * u);

const CSS = `
.nrn3d-cap { background: rgb(8 12 24 / 82%); padding: 8px 14px; border-radius: 12px; width: fit-content; max-width: calc(100% - 32px); line-height: 1.35; }
.nrn3d-note { position: absolute; right: 14px; top: 14px; z-index: 2; background: rgb(8 12 24 / 82%); color: #F4F6FB; border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px; padding: 6px 10px; font-size: 15px; font-weight: 700; max-width: 46%; pointer-events: none; }
.nrn3d-note[hidden] { display: none; }
.nrn3d-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #ECEFF7; font-weight: 700; font-size: 1.05rem; }
.lesson-visual .vis-controls button.nrn3d-btn { min-height: 44px; min-width: 44px; }
@media (max-width: 700px) { .nrn3d-note { max-width: 60%; font-size: 15px; } }
`;

/* ------------------------------------------------------------------ small 3D helpers */
function scaleBar(lengthUm, at, unitsPerUm, color = '#EEF2FF') {
  const g = new THREE.Group();
  const L = lengthUm * unitsPerUm;
  const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(L, L * 0.035, L * 0.035), m);
  bar.position.set(at.x + L / 2, at.y, at.z);
  const capG = new THREE.BoxGeometry(L * 0.03, L * 0.14, L * 0.03);
  const c1 = new THREE.Mesh(capG, m); c1.position.set(at.x, at.y, at.z);
  const c2 = new THREE.Mesh(capG, m); c2.position.set(at.x + L, at.y, at.z);
  g.add(bar, c1, c2);
  g.userData.mid = V(at.x + L / 2, at.y, at.z);
  return g;
}

/** Build a sensory neuron: a REAL skin ending (Wu, Williams & Nathans 2012) on a DRAWN fibre, cell body and
 *  T-junction (the pseudo-unipolar shape of a dorsal root ganglion neuron). All positions in µm (local). */
function sensoryNodes(skin, { arbor, periph, soma, somaR = 22, central, twigs = 3, fibreR = 1.6 }) {
  const nodes = []; let id = 1;
  const add = (p, type, parent, extra = {}) => { const n = { id: id++, type, x: p.x, y: p.y, z: p.z, r: extra.r ?? fibreR, parent, drawn: true, ...extra }; nodes.push(n); return n; };
  const somaN = add(soma, 1, -1, { r: somaR });
  const T = periph[periph.length - 1];
  // short stem from the cell body to the T-junction
  const stem = [soma.clone().lerp(T, 0.45), soma.clone().lerp(T, 0.8), T.clone()];
  let prev = somaN;
  for (const p of stem) prev = add(p, 3, prev.id, { r: fibreR * 1.2 });
  const tNode = prev;
  // peripheral fibre: T → skin (walk the given points backwards)
  prev = tNode;
  for (let i = periph.length - 2; i >= 0; i--) prev = add(periph[i], 3, prev.id, { part: 'dendrites' });
  const J = prev;
  // the real skin ending (no diameters in the original, so a thin fixed radius)
  const map = new Map();
  const root = skin.nodes.find((n) => !skin.nodes.some((m) => m.id === n.parent));
  for (const n of skin.nodes) {
    const p = V(n.x, n.y, n.z).applyMatrix4(arbor);
    const parent = n === root ? J.id : map.get(n.parent);
    const nn = add(p, 3, parent, { r: 0.9, drawn: false, arbor: true, part: 'dendrites' });
    map.set(n.id, nn.id);
  }
  // central branch: T → spinal cord, with a few short twigs ending in terminal buttons
  prev = tNode;
  for (let i = 1; i < central.length; i++) prev = add(central[i], 2, prev.id);
  const end = central[central.length - 1], dir = end.clone().sub(central[central.length - 2]).normalize();
  const side = V(-dir.y, dir.x, 0).normalize();
  const twigLen = end.distanceTo(central[central.length - 2]) * 0.35;
  for (let k = 0; k < twigs; k++) {
    const a = (k - (twigs - 1) / 2) * 0.7;
    const p1 = end.clone().addScaledVector(dir, twigLen * 0.5).addScaledVector(side, a * twigLen * 0.45);
    const p2 = p1.clone().addScaledVector(dir, twigLen * 0.5).addScaledVector(side, a * twigLen * 0.5);
    const m1 = add(p1, 2, prev.id, { r: fibreR * 0.8 });
    add(p2, 2, m1.id, { r: fibreR * 0.7 });
  }
  // impulse distance: starts in the skin ending (negative) and runs through the fibre into the spinal cord
  const g = geodesic(nodes, J.id);
  for (const n of nodes) n.d = n.arbor ? -g.get(n.id) : g.get(n.id);
  return { nodes, junction: J, tNode, somaNode: somaN };
}

/** Extend a reconstruction's main axon (which leaves the tissue) with a DRAWN continuation through `points`
 *  (local µm), ending in a few branches with terminal buttons (a neuromuscular junction). */
function extendAxon(nodes, points, { r = 1.6, twigs = 4, twigLen = 60 } = {}) {
  const tip = mainAxonTip(nodes);
  let id = Math.max(...nodes.map((n) => n.id)) + 1;
  let prev = tip;
  const all = [V(tip.x, tip.y, tip.z), ...points];
  const curve = new THREE.CatmullRomCurve3(all, false, 'centripetal');
  const L = curve.getLength(); const n = Math.max(8, Math.ceil(L / 60));
  for (let i = 1; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const node = { id: id++, type: 2, x: p.x, y: p.y, z: p.z, r, parent: prev.id, drawn: true, noTerminal: true };
    nodes.push(node); prev = node;
  }
  const end = curve.getPointAt(1), dir = curve.getTangentAt(1);
  const side = new THREE.Vector3().crossVectors(dir, V(0, 0, 1)).normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  for (let k = 0; k < twigs; k++) {
    const a = (k / twigs) * Math.PI * 2;
    const off = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a) * 0.6);
    const p1 = end.clone().addScaledVector(dir, twigLen * 0.4).addScaledVector(off, twigLen * 0.45);
    const p2 = p1.clone().addScaledVector(dir, twigLen * 0.3).addScaledVector(off, twigLen * 0.35);
    const m1 = { id: id++, type: 2, x: p1.x, y: p1.y, z: p1.z, r: r * 0.7, parent: prev.id, drawn: true };
    const m2 = { id: id++, type: 2, x: p2.x, y: p2.y, z: p2.z, r: r * 0.6, parent: m1.id, drawn: true };
    nodes.push(m1, m2);
  }
  // drawn nodes past the real tip: remember where the reconstruction stops
  return { realTip: V(tip.x, tip.y, tip.z), end };
}

function muscleMesh(length, radius, color = '#C4505C') {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector2(radius * Math.pow(Math.sin(Math.PI * u), 0.75) + radius * 0.04, (u - 0.5) * length)); }
  const g = new THREE.LatheGeometry(pts, 40);
  g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, tissueMaterial(color, { roughness: 0.55, sheen: 0.4 }));
  // tendon ends
  const tg = new THREE.CylinderGeometry(radius * 0.09, radius * 0.12, length * 0.22, 16); tg.rotateZ(Math.PI / 2);
  const tm = tissueMaterial('#EDE3D3', { roughness: 0.4 });
  const t1 = new THREE.Mesh(tg, tm); t1.position.x = -length * 0.58;
  const t2 = new THREE.Mesh(tg, tm); t2.position.x = length * 0.58;
  m.add(t1, t2);
  return m;
}

/** Point at path distance d along a polyline (local points) → world, via toWorld. */
function polyline(points, toWorld) {
  const ds = [0];
  for (let i = 1; i < points.length; i++) ds.push(ds[i - 1] + points[i].distanceTo(points[i - 1]));
  return {
    length: ds[ds.length - 1],
    at(d) {
      let i = 1; while (i < ds.length - 1 && ds[i] < d) i++;
      const f = clamp((d - ds[i - 1]) / Math.max(1e-6, ds[i] - ds[i - 1]));
      return toWorld(points[i - 1].clone().lerp(points[i], f));
    },
  };
}

/* ------------------------------------------------------------------ step plan */
const PLAN = [
  { scene: 'anat', view: 'whole', lit: null, labels: ['somaS', 'dendS', 'axonS'], cap: 'A neuron: one nerve cell. This shape is a real reconstruction from a human brain.' },
  { scene: 'anat', view: 'soma', lit: ['dendrites', 'soma'], nucleus: true, labels: ['dendrites', 'soma', 'nucleus'], anim: 'inflow', cap: 'Dendrites carry signals in towards the cell body, which contains the nucleus.' },
  { scene: 'anat', view: 'axon', lit: ['axon', 'myelin', 'nodes'], labels: ['axon', 'myelin'], cap: 'The axon carries the signal away from the cell body. Myelin added to show where it sits.' },
  { scene: 'anat', view: 'terminals', lit: ['terminals', 'next'], labels: ['terminals', 'gap', 'next'], cap: 'Terminal buttons pass the message to the next neuron across a tiny gap. Gap drawn much wider than real.' },
  { scene: 'anat', view: 'whole', lit: null, labels: ['n1', 'n2', 'n3', 'n4'], anim: 'impulse', cap: 'The impulse travels one way: dendrites → cell body → axon → terminal buttons.' },
  { scene: 'salt', labels: ['withM', 'sheath', 'node', 'without'], anim: 'race', cap: 'Not to scale. With myelin the impulse jumps from node to node, so it arrives sooner.' },
  { scene: 'types', row: 'sensory', labels: ['s_skin', 's_dend', 's_soma', 's_axon'], anim: 'sensory', cap: 'Sensory neuron: long dendrite, short axon. Skin ending is real (mouse); the rest is drawn.' },
  { scene: 'types', row: 'relay', labels: ['r_dend', 'r_soma', 'r_axon'], anim: 'relay', cap: 'Relay neuron: short dendrites, short axon. Real reconstruction from a mouse spinal cord.' },
  { scene: 'types', row: 'motor', labels: ['m_dend', 'm_soma', 'm_axon', 'm_muscle'], anim: 'motor', cap: 'Motor neuron: short dendrites, long axon. Real rat motor neuron; the axon outside the spinal cord, its myelin and the muscle are drawn.' },
  { scene: 'reflex', labels: ['x_rec', 'x_sens', 'x_relay', 'x_motor', 'x_muscle', 'x_cord'], anim: 'reflex', cap: 'Reflex arc: receptor → sensory → relay → motor → muscle. Relay and motor cell shapes are real, resized to fit. The long fibres, cord, skin and muscle are drawn.' },
];
const INTRO = { scene: 'anat', view: 'whole', lit: null, labels: [], cap: 'A real human neuron. Drag to turn it, scroll or pinch to zoom.' };
const RECAP = { scene: 'anat', view: 'whole', lit: null, labels: ['dendS', 'somaS', 'axonS', 'myelinS', 'termS'], cap: 'All the parts of a neuron' };
const NOTES = {
  anat: 'Real shape · myelin and terminal buttons added',
  salt: 'Not to scale',
  types: 'Real shapes · sizes differ: see scale bars',
  reflex: 'Not to scale · long fibres drawn',
};

/* ------------------------------------------------------------------ lesson */
export default {
  id: 'neurons',
  title: 'Neurons',
  objectives: [
    'Name the parts of a neuron and say what each part does.',
    'Describe how an electrical impulse travels along an axon.',
    'Compare sensory, relay and motor neurons, and explain how they work together in a reflex.',
  ],
  keywords: [
    { term: 'Neuron', simple: 'A nerve cell. It carries messages as electrical signals.', exam: 'The basic building block of the nervous system: a cell specialised to send electrical and chemical signals.' },
    { term: 'Dendrites', simple: 'Branches that receive signals from other neurons and carry them to the cell body.', exam: 'Branch-like structures that receive nerve impulses from neighbouring neurons and carry them towards the cell body.' },
    { term: 'Axon', simple: 'A long fibre that carries the signal away from the cell body.', exam: 'Carries the electrical impulse away from the cell body, down the length of the neuron.' },
    { term: 'Myelin sheath', simple: 'A fatty layer around the axon. It makes the signal travel faster.', exam: 'A fatty layer that protects and insulates the axon and speeds up transmission. The impulse jumps between gaps in it called nodes of Ranvier.' },
    { term: 'Action potential', simple: 'The electrical impulse that travels along the axon when a neuron fires.', exam: 'A brief change in the electrical charge of the neuron, from negative inside to positive inside, that travels along the axon.' },
    { term: 'Terminal buttons', simple: 'The ends of the axon. They pass the message on to the next neuron.', exam: 'Found at the end of the axon. They communicate with the next neuron across a tiny gap at the synapse (the synaptic cleft).' },
  ],
  steps: [
    {
      title: 'What is a neuron?',
      simple: `<p>A <span class="keyterm">neuron</span> is a nerve cell. Neurons carry messages around your body as <strong>electrical</strong> signals.</p>
        <p>Your brain, spinal cord and nerves contain billions of neurons.</p>
        <p>All neurons have the same basic parts. First you will meet each part. Then you will meet the three types of neuron.</p>`,
      exam: `<p>Within a neuron the signal is <strong>electrical</strong>. Between two neurons the signal is <strong>chemical</strong>. You will learn about the chemical part in the next lesson, Synaptic transmission.</p>`,
    },
    {
      title: 'Dendrites and the cell body',
      simple: `<p><span class="keyterm">Dendrites</span> are the branches at one end of the neuron. They <strong>receive</strong> signals from other neurons and carry them <strong>towards</strong> the cell body.</p>
        <p>The <span class="keyterm">cell body</span> (also called the soma) is the main part of the cell.</p>
        <p>The cell body contains the <span class="keyterm">nucleus</span>. The nucleus holds the cell’s genetic material (DNA).</p>`,
      exam: `<p>In an exam answer: dendrites carry nerve impulses from neighbouring neurons <strong>towards</strong> the cell body. The cell body includes the nucleus, which contains the genetic material of the cell.</p>`,
    },
    {
      title: 'The axon and the myelin sheath',
      simple: `<p>The <span class="keyterm">axon</span> is a long, thin fibre. It carries the electrical signal <strong>away</strong> from the cell body.</p>
        <p>Many axons are covered in a <span class="keyterm">myelin sheath</span>. This is a fatty layer, a bit like the plastic coating on an electric wire.</p>
        <p>The myelin sheath protects the axon. It also makes the signal travel <strong>faster</strong>.</p>`,
      exam: `<p>The myelin sheath is made by cells that wrap their fatty membrane around the axon. In the peripheral nervous system these are called Schwann cells. The myelin is broken up by small gaps called <strong>nodes of Ranvier</strong> (see step 6).</p>`,
    },
    {
      title: 'Terminal buttons',
      simple: `<p>At the far end of the axon are the <span class="keyterm">terminal buttons</span>.</p>
        <p>They pass the message on to the <strong>next</strong> neuron.</p>
        <p>The two neurons do not touch. There is a tiny gap between them. The meeting point is called a <strong>synapse</strong>.</p>
        <p>You will learn what happens at the synapse in the next lesson.</p>`,
      exam: `<p>Terminal buttons contain synaptic vesicles filled with neurotransmitter. They communicate with the next neuron by releasing this chemical into the gap (the synaptic cleft).</p>`,
    },
    {
      title: 'How the signal travels',
      simple: `<p>Signals come in through the dendrites and reach the cell body.</p>
        <p>If the signal is strong enough, the neuron <strong>fires</strong>. A short electrical impulse, called an <span class="keyterm">action potential</span>, travels down the axon to the terminal buttons.</p>
        <p>The signal normally travels one way: dendrites → cell body → axon → terminal buttons.</p>`,
      exam: `<p>At rest, the inside of a neuron is negatively charged compared with the outside (the resting potential, about −70 millivolts). When the neuron is activated, the inside briefly becomes positively charged. This change is the action potential. It moves along the axon as an electrical impulse.</p>`,
    },
    {
      title: 'Jumping from node to node',
      simple: `<p>The myelin sheath has small gaps along it. These gaps are called <span class="keyterm">nodes of Ranvier</span>.</p>
        <p>The impulse <strong>jumps</strong> from one gap to the next. It skips the parts covered in myelin. This is called <span class="keyterm">saltatory conduction</span>.</p>
        <p>Jumping is faster than travelling along every part of the axon. The diagram compares an axon with myelin and an axon without it.</p>`,
      exam: `<p>Myelin insulates the axon, so the action potential can only happen at the nodes of Ranvier. “Saltatory” comes from the Latin word <strong>saltare</strong>, which means “to jump”. This is why myelinated axons carry impulses much faster than unmyelinated axons.</p>`,
    },
    {
      title: 'Sensory neurons',
      simple: `<p><span class="keyterm">Sensory neurons</span> carry messages from your senses <strong>to</strong> the central nervous system (CNS). The CNS is your brain and spinal cord.</p>
        <p>They start at <strong>receptors</strong>, for example in your skin, eyes, ears and tongue.</p>
        <p>Shape: <strong>long dendrites</strong> and <strong>short axons</strong>.</p>`,
      exam: `<p>Sensory neurons carry nerve impulses from sensory receptors in the peripheral nervous system (PNS) to the CNS. Not every message goes all the way to the brain. Some end in the spinal cord, which allows quick reflexes.</p>
        <p>AQA calls the long fibre from the receptor a <strong>dendrite</strong>, so use that word in the exam. Many scientists call it an axon, because it carries action potentials like an axon does.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>A question may ask which neuron carries impulses <strong>towards the brain</strong> (or the CNS). The answer is the <strong>sensory</strong> neuron, not the relay neuron. This is an easy mistake to make.</p>' },
    },
    {
      title: 'Relay neurons',
      simple: `<p><span class="keyterm">Relay neurons</span> connect sensory neurons to motor neurons. They can also connect to other relay neurons.</p>
        <p>They are found only in the <strong>brain and spinal cord</strong> (the CNS).</p>
        <p>Shape: <strong>short dendrites</strong> and <strong>short axons</strong>.</p>`,
      exam: `<p>Relay neurons allow sensory and motor neurons to communicate with each other. They are sometimes called interneurons.</p>`,
    },
    {
      title: 'Motor neurons',
      simple: `<p><span class="keyterm">Motor neurons</span> carry messages <strong>from</strong> the CNS <strong>to</strong> effectors. Effectors are the muscles and glands that respond.</p>
        <p>Their cell bodies are in the brain or spinal cord. Their long axons reach out into the body.</p>
        <p>Shape: <strong>short dendrites</strong> and <strong>long axons</strong>.</p>`,
      exam: `<p>The cell bodies of motor neurons may be in the CNS, but their long axons form part of the PNS. Motor neurons form synapses with muscles. When stimulated, they release neurotransmitter that binds to receptors on the muscle, which triggers a response that leads to movement.</p>`,
    },
    {
      title: 'Working together: the reflex arc',
      simple: `<p>You touch something hot. This happens very quickly:</p>
        <ol>
          <li>A <strong>receptor</strong> in your skin detects the heat.</li>
          <li>A <strong>sensory neuron</strong> carries the message to the spinal cord.</li>
          <li>A <strong>relay neuron</strong> in the spinal cord passes it on.</li>
          <li>A <strong>motor neuron</strong> carries it to a muscle in your arm.</li>
          <li>The <strong>muscle</strong> contracts and your hand moves away.</li>
        </ol>
        <p>This path is called a <span class="keyterm">reflex arc</span>.</p>`,
      exam: `<p>The reflex is fast because the spinal cord sends the response before the brain is involved. A message also goes on to the brain. This is why you can pull your hand away before you feel the pain.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Use a reflex arc to show how the three types link up: <strong>sensory → relay → motor</strong>.</p>' },
    },
  ],
  quiz: [
    { q: 'Which part of a neuron carries the impulse away from the cell body?', options: ['Dendrites', 'Axon', 'Nucleus', 'Receptor'], answer: 1, explain: 'The axon carries the electrical impulse away from the cell body towards the terminal buttons.', hint: 'It is the long fibre that is often covered in myelin.' },
    { q: 'What does the myelin sheath do?', options: ['Stores the cell’s DNA', 'Speeds up the electrical impulse', 'Releases neurotransmitter', 'Receives signals from other neurons'], answer: 1, explain: 'Myelin insulates the axon, so the impulse jumps between the nodes of Ranvier and travels faster.', hint: 'Think about the race between the two axons.' },
    { q: 'Which type of neuron carries impulses from receptors towards the brain?', options: ['Relay neuron', 'Motor neuron', 'Sensory neuron', 'Effector neuron'], answer: 2, explain: 'Sensory neurons carry messages from receptors (for example in the skin) to the CNS.', hint: 'Which neuron starts at your senses?' },
    { q: 'Which neuron has short dendrites and a long axon?', options: ['Sensory neuron', 'Relay neuron', 'Motor neuron', 'All three'], answer: 2, explain: 'Motor neurons have short dendrites and long axons, so they can reach from the CNS to a muscle or gland.', hint: 'This neuron has to reach all the way from the spinal cord to a muscle.' },
    { q: 'In a reflex arc, what is the correct order of neurons?', options: ['Motor → relay → sensory', 'Sensory → relay → motor', 'Relay → sensory → motor', 'Sensory → motor → relay'], answer: 1, explain: 'Receptor → sensory neuron → relay neuron (in the spinal cord) → motor neuron → muscle.', hint: 'The message starts at a receptor in your skin.' },
  ],
  summary: [
    'Dendrites receive signals → cell body (with the nucleus) → axon → terminal buttons pass the message on.',
    'Myelin speeds up the impulse: it jumps between the nodes of Ranvier (saltatory conduction).',
    'Sensory: receptors → CNS. Relay: inside the CNS. Motor: CNS → muscles and glands.',
  ],
  visual: {
    dark: true,
    async create(container) {
      const style = document.createElement('style'); style.textContent = CSS; container.append(style);
      const loading = document.createElement('div'); loading.className = 'nrn3d-loading'; loading.textContent = 'Loading the 3D neurons…';
      container.append(loading);
      const controls = document.createElement('div'); controls.className = 'vis-controls'; container.append(controls);
      const note = document.createElement('p'); note.className = 'nrn3d-note'; note.hidden = true; container.append(note);
      const cap = document.createElement('p'); cap.className = 'vis-caption nrn3d-cap'; container.append(cap);

      const stage = createStage(container, {
        label: 'A 3D neuron',
        safeTop: () => (controls.childElementCount ? controls.offsetTop + controls.offsetHeight + 6 : 16) + (note.hidden ? 0 : 0),
        safeBottom: () => container.clientHeight - cap.offsetTop + 6,
      });
      container.insertBefore(stage.host, controls);

      const [pyrSwc, motorSwc, relaySwc, skinSwc] = await Promise.all([SWC.pyramidal, SWC.motor, SWC.relay, SWC.skin].map(loadSWC));
      loading.remove();

      const models = new Set();
      stage.onFrame((dt) => {
        updatePixelScale(stage.camera, stage.size.h);
        let busy = false;
        for (const m of models) if (m.update(dt)) busy = true;
        return busy;
      });

      /* ---------------------------------------------------------------- scene: anatomy (pyramidal neuron) */
      const scenes = {};
      function buildAnat() {
        const g = new THREE.Group(); g.scale.setScalar(0.01);
        const n = buildNeuron(pyrSwc, { minRadius: 0.7, step: 3, radial: 7, myelin: { start: 42, internode: 70, gap: 10, thickness: 3.2, endPad: 60 }, terminals: { radius: 2.4 } });
        g.add(n.group); models.add(n);
        // terminal button inside the densest cluster of endings (for the close-up), and a drawn "next neuron"
        const dendPts = n.nodes.filter((nd) => nd.type === 3 || nd.type === 4).map((nd) => V(nd.x, nd.y, nd.z));
        let best = n.terminals[0], bc = -Infinity;
        for (const t of n.terminals) {
          if (t.d < n.maxDist.axon * 0.6 || dendPts.some((p) => p.distanceToSquared(t.p) < 90 * 90)) continue;
          let c = 0; for (const u of n.terminals) if (u !== t && u.p.distanceTo(t.p) < 150) c++;
          const sc = c + t.d / 1000;
          if (sc > bc) { bc = sc; best = t; }
        }
        const dir = best.dir.clone();
        const q = new THREE.Vector3().crossVectors(dir, V(0, 0, 1)).normalize();
        const C = best.p.clone().addScaledVector(dir, best.r + 3.0 + 2.2);
        const nextNodes = [];
        for (let i = 0; i <= 10; i++) {
          const u = i / 10 - 0.5;
          const p = C.clone().addScaledVector(q, u * 260).addScaledVector(dir, 14 * u * u * 4);
          nextNodes.push({ id: i + 1, type: 3, x: p.x, y: p.y, z: p.z, r: 2.2 - Math.abs(u) * 0.6, parent: i ? i : -1, drawn: true });
        }
        const next = buildNeuron({ nodes: nextNodes }, { minRadius: 1, terminals: false, nucleus: false, colors: { dendrites: '#8FB0F0' } });
        g.add(next.group); models.add(next);
        const box = n.box();
        const bar = scaleBar(100, V(box.min.x / 0.01 - 160, box.min.y / 0.01 + 60, 0), 1);
        g.add(bar);
        // anchors
        const soma = n.soma;
        const dendNear = (lo, hi, pref = V(0, 1, 0)) => {
          let b = null, bs = -Infinity;
          for (const nd of n.nodes) {
            if (nd.type !== 3 && nd.type !== 4) continue;
            const d = n.D.get(nd.id); if (d < lo || d > hi) continue;
            const p = V(nd.x, nd.y, nd.z).sub(soma.center);
            const s2 = p.normalize().dot(pref);
            if (s2 > bs) { bs = s2; b = nd; }
          }
          return b ? V(b.x, b.y, b.z) : soma.center.clone();
        };
        const W = (p) => n.toWorld(p);
        const A = {
          somaC: soma.center.clone(),
          dendClose: dendNear(34, 52, V(-0.9, 0.3, 0.2).normalize()),
          dendFar: dendNear(150, 260, V(-0.7, 0.6, 0).normalize()),
          apical: dendNear(380, 600, V(0, 1, 0)),
          nucleusP: soma.center.clone().add(V(-soma.radius * 0.25, -soma.radius * 0.1, soma.radius * 0.3)),
        };
        const sheath1 = n.myelin.sheaths[1] || n.myelin.sheaths[0];
        const node1 = n.myelin.nodes[1] || n.myelin.nodes[0];
        const ais = n.mainPath ? n.mainPath.p[Math.min(n.mainPath.p.length - 1, 14)] : soma.center;
        const LBL = {
          somaS: { text: 'Cell body', at: () => W(A.somaC), side: 'right', dist: 90 },
          dendS: { text: 'Dendrites', at: () => W(A.apical), side: 'left' },
          axonS: { text: 'Axon', at: () => n.anchor('axonMid'), side: 'right' },
          myelinS: { text: 'Myelin sheath', tag: 'added to show where it sits', drawn: true, at: () => W(sheath1.mid), side: 'left' },
          termS: { text: 'Terminal buttons', tag: 'drawn at the axon ends', drawn: true, at: () => W(best.p), side: 'right' },
          dendrites: { text: 'Dendrites', sub: 'receive signals', at: () => W(A.dendClose), side: 'left', dist: 80 },
          soma: { text: 'Cell body (soma)', at: () => W(soma.center.clone().add(V(soma.radius * 0.7, soma.radius * 0.4, 0))), side: 'right', dist: 80 },
          nucleus: { text: 'Nucleus', sub: 'holds the DNA', tag: 'drawn', at: () => W(A.nucleusP), side: 'bottom', dist: 70 },
          axon: { text: 'Axon', sub: 'carries the signal away', at: () => W(ais), side: 'right', dist: 70 },
          myelin: { text: 'Myelin sheath', tag: 'added to show where it sits', drawn: true, at: () => W(sheath1.mid), side: 'left', dist: 70 },
          node: { text: 'Node of Ranvier', at: () => W(node1.p), side: 'right' },
          terminals: { text: 'Terminal button', tag: 'drawn at the axon ends', drawn: true, at: () => W(best.p.clone().addScaledVector(dir, -best.r * 0.3)), side: 'left', dist: 80 },
          gap: { text: 'Tiny gap', sub: 'part of the synapse', at: () => W(best.p.clone().addScaledVector(dir, best.r + 1.5)), side: 'right', dist: 90 },
          next: { text: 'Next neuron', tag: 'drawn', drawn: true, at: () => W(C.clone().addScaledVector(q, 30)), side: 'bottom', dist: 60 },
          n1: { text: '1 Dendrites', at: () => W(A.apical), side: 'left' },
          n2: { text: '2 Cell body', at: () => W(A.somaC), side: 'right', dist: 90 },
          n3: { text: '3 Axon', at: () => n.anchor('axonMid'), side: 'right' },
          n4: { text: '4 Terminal buttons', tag: 'drawn at the axon ends', drawn: true, at: () => W(best.p), side: 'right' },
          bar: { text: '100 µm (0.1 mm)', plain: true, line: false, at: () => g.localToWorld(bar.userData.mid.clone()), side: 'bottom', dist: 10 },
        };
        const VIEWS = {
          whole: () => ({ box: n.box(), dir: V(0.18, 0.08, 1) }),
          soma: () => { const c = W(soma.center); const r = 0.3; return { box: new THREE.Box3(c.clone().subScalar(r), c.clone().addScalar(r)), dir: V(-0.25, 0.1, 1) }; },
          axon: () => {
            const b = new THREE.Box3(); b.expandByPoint(W(soma.center.clone().addScalar(25))); b.expandByPoint(W(soma.center.clone().addScalar(-25)));
            for (let i = 0; i < n.mainPath.p.length; i++) if (n.mainPath.d[i] < 240) b.expandByPoint(W(n.mainPath.p[i]));
            return { box: b, dir: V(0.35, 0.05, 1) };
          },
          terminals: () => { const c = W(best.p); const r = 0.3; return { box: new THREE.Box3(c.clone().subScalar(r), c.clone().addScalar(r)), dir: V(0, 0, 1).addScaledVector(dir, -0.15) }; },
        };
        const spark = createSpark(undefined, 0.55);
        return { group: g, n, next, LBL, VIEWS, bar, spark, sparks: [spark] };
      }

      /* ---------------------------------------------------------------- scene: myelin race */
      function buildSalt() {
        const g = new THREE.Group(); g.scale.setScalar(0.01);
        const L = 900;
        const top = buildNeuron({ nodes: straightAxonNodes(L, { radius: 9, step: 30, start: V(-L / 2, 70, 0) }) },
          { minRadius: 9, step: 8, radial: 20, myelin: { start: 20, internode: 96, gap: 16, thickness: 2.0, endPad: 26 }, terminals: { radius: 17 } });
        const bot = buildNeuron({ nodes: straightAxonNodes(L, { radius: 9, step: 30, start: V(-L / 2, -70, 0) }) },
          { minRadius: 9, step: 8, radial: 20, terminals: { radius: 17 } });
        g.add(top.group, bot.group); models.add(top); models.add(bot);
        const W = (m, p) => m.toWorld(p);
        const LBL = {
          withM: { text: 'With myelin', sub: 'jumps from node to node', at: () => W(top, V(-L / 2 + 4, 70, 0)), side: 'top', dist: 60 },
          sheath: { text: 'Myelin sheath', at: () => W(top, top.myelin.sheaths[2].mid), side: 'top', dist: 60 },
          node: { text: 'Node of Ranvier', sub: 'a gap in the myelin', at: () => W(top, top.myelin.nodes[4].p), side: 'top', dist: 60 },
          without: { text: 'Without myelin', sub: 'travels along every part', at: () => W(bot, V(-L / 2 + 4, -70, 0)), side: 'bottom', dist: 60 },
          first: { text: 'Arrives first', at: () => W(top, V(L / 2, 70, 0)), side: 'top', dist: 60 },
        };
        const box = new THREE.Box3(W(bot, V(-L / 2 - 20, -150, -30)), W(top, V(L / 2 + 20, 150, 30)));
        return { group: g, top, bot, LBL, VIEWS: { main: () => ({ box, dir: V(0.05, 0.22, 1) }) }, L };
      }

      /* ---------------------------------------------------------------- scene: the three types */
      function buildTypes() {
        const g = new THREE.Group();
        // sensory: real skin ending + drawn fibre, cell body (DRG) and T-junction
        const sK = 0.0024;
        const sg = new THREE.Group(); sg.scale.setScalar(sK); sg.position.set(-4.6, 3.3, 0);
        const arbor = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
        const periph = [];
        for (let i = 0; i <= 12; i++) { const x = (i / 12) * 2300; periph.push(V(x, Math.sin(i * 0.9) * 18, Math.cos(i * 0.7) * 10)); }
        const T = periph[periph.length - 1];
        const sens = sensoryNodes(skinSwc, {
          arbor, periph, soma: T.clone().add(V(-10, 190, 0)), somaR: 20,
          central: [T.clone(), T.clone().add(V(220, -10, 0)), T.clone().add(V(480, 0, 0)), T.clone().add(V(640, -6, 0))],
        });
        const sensory = buildNeuron({ nodes: sens.nodes }, { minRadius: 1.4, step: 6, terminals: { radius: 9 }, nucleus: false });
        sensory.setDirection('dendrites', 1);
        sg.add(sensory.group); models.add(sensory);
        const sBar = scaleBar(500, V(-1250, -470, 0), 1); sg.add(sBar);
        g.add(sg);

        // relay: real mouse spinal interneuron, turned on its side
        const rK = 0.0062;
        const rg = new THREE.Group(); rg.scale.setScalar(rK); rg.position.set(0, -0.15, 0); rg.rotation.z = -Math.PI / 2;
        const relay = buildNeuron(relaySwc, { minRadius: 0.55, step: 2, radial: 6, terminals: { radius: 2.4 }, nucleus: false });
        rg.add(relay.group); models.add(relay);
        const rBar = scaleBar(100, V(-160, 220, 0), 1); const rBarG = new THREE.Group(); rBarG.add(rBar); rBarG.rotation.z = Math.PI / 2; rg.add(rBarG);
        g.add(rg);

        // motor: real rat motor neuron; the axon leaves the spinal cord, so its continuation is drawn
        const mK = 0.00125;
        const mg = new THREE.Group(); mg.scale.setScalar(mK); mg.position.set(-3.7, -3.5, 0); mg.rotation.y = Math.PI;
        const mNodes = motorSwc.nodes.map((nd) => ({ ...nd }));
        const tip0 = mainAxonTip(mNodes);
        const t0 = V(tip0.x, tip0.y, tip0.z);
        const ext = extendAxon(mNodes, [t0.clone().add(V(-500, 120, 0)), t0.clone().add(V(-2000, 260, 0)), t0.clone().add(V(-3800, 140, 0)), t0.clone().add(V(-5200, 60, 0))], { r: 2.2, twigs: 5, twigLen: 160 });
        const motor = buildNeuron({ nodes: mNodes }, { minRadius: 0.9, step: 6, radial: 6, myelin: { start: 900, internode: 420, gap: 55, thickness: 2.6, endPad: 280 }, terminals: { radius: 22 }, nucleus: false });
        mg.add(motor.group); models.add(motor);
        const muscle = muscleMesh(1700, 380);
        muscle.position.copy(ext.end).add(V(-520, -330, 0)); muscle.rotation.z = 0.12;
        mg.add(muscle);
        const mBar = scaleBar(500, V(800, -950, 0), 1); mBar.rotation.y = Math.PI; mg.add(mBar);
        g.add(mg);

        const S = (m, p) => m.toWorld(p);
        const sAt = (part) => {
          if (part === 'skin') { const b = new THREE.Vector3(); let k = 0; for (const nd of sens.nodes) if (nd.arbor) { b.add(V(nd.x, nd.y, nd.z)); k++; } return b.divideScalar(k); }
          return null;
        };
        const skinC = sAt('skin');
        const motorSoma = motor.soma.center.clone();
        const motorDend = (() => { let b = null, bs = -1; for (const nd of motor.nodes) { if (nd.type !== 3) continue; const d = motor.D.get(nd.id); if (d > 250 && d < 450 && nd.y > bs) { bs = nd.y; b = nd; } } return b ? V(b.x, b.y, b.z) : motorSoma; })();
        const relaySoma = relay.soma.center.clone();
        const relayDend = (() => { let b = null, bs = -1; for (const nd of relay.nodes) { if (nd.type !== 3) continue; const d = relay.D.get(nd.id); if (d > bs) { bs = d; b = nd; } } return V(b.x, b.y, b.z); })();
        const relayAx = relay.anchorLocal('axonMid');
        const LBL = {
          s_skin: { text: 'Receptor ending in the skin', tag: 'real reconstruction (mouse)', at: () => S(sensory, skinC), side: 'bottom', dist: 70 },
          s_dend: { text: 'Long dendrite', sub: 'from the receptor', tag: 'drawn, and much longer in real life. Scientists often call this fibre an axon too', drawn: true, at: () => S(sensory, periph[6]), side: 'bottom', dist: 60 },
          s_soma: { text: 'Cell body', sub: 'in a ganglion next to the spinal cord', tag: 'drawn', drawn: true, at: () => S(sensory, sens.somaNode && V(sens.somaNode.x, sens.somaNode.y, sens.somaNode.z)), side: 'top', dist: 60 },
          s_axon: { text: 'Short axon', sub: 'into the spinal cord', tag: 'drawn', drawn: true, at: () => S(sensory, T.clone().add(V(380, 0, 0))), side: 'bottom', dist: 70 },
          r_dend: { text: 'Short dendrites', at: () => S(relay, relayDend), side: 'top', dist: 60 },
          r_soma: { text: 'Cell body', at: () => S(relay, relaySoma), side: 'bottom', dist: 80 },
          r_axon: { text: 'Short axon', sub: 'stays inside the spinal cord', at: () => S(relay, relayAx), side: 'top', dist: 70 },
          m_dend: { text: 'Short dendrites', sub: 'compared with the axon', at: () => S(motor, motorDend), side: 'top', dist: 50 },
          m_soma: { text: 'Cell body', sub: 'in the spinal cord', at: () => S(motor, motorSoma), side: 'bottom', dist: 70 },
          m_axon: { text: 'Long axon', sub: 'in a human leg it can be about 1 metre long', tag: 'drawn here much shorter', drawn: true, at: () => S(motor, ext.realTip.clone().lerp(ext.end, 0.55)), side: 'top', dist: 60 },
          m_muscle: { text: 'Muscle (effector)', tag: 'drawn', drawn: true, at: () => mg.localToWorld(muscle.position.clone()), side: 'bottom', dist: 50 },
          b_s: { text: '500 µm (0.5 mm)', plain: true, line: false, at: () => sg.localToWorld(sBar.userData.mid.clone()), side: 'bottom', dist: 6 },
          b_r: { text: '100 µm (0.1 mm)', plain: true, line: false, at: () => rBarG.localToWorld(rBar.userData.mid.clone()), side: 'bottom', dist: 6 },
          b_m: { text: '500 µm (0.5 mm)', plain: true, line: false, at: () => mBar.localToWorld(mBar.userData.mid.clone()), side: 'bottom', dist: 6 },
        };
        const rowBox = (m, extra = []) => { const b = m.box(); extra.forEach((p) => b.expandByPoint(p)); return b; };
        const VIEWS = {
          sensory: () => ({ box: rowBox(sensory), dir: V(0, 0.12, 1) }),
          relay: () => ({ box: rowBox(relay).expandByScalar(0.15), dir: V(0, 0.12, 1) }),
          motor: () => { const b = rowBox(motor); b.expandByObject(muscle); return { box: b, dir: V(0, 0.12, 1) }; },
        };
        const sPath = polyline([...periph, ...[T.clone().add(V(220, -10, 0)), T.clone().add(V(480, 0, 0)), T.clone().add(V(640, -6, 0))]], (p) => sensory.toWorld(p));
        const sparks = { sensory: createSpark(undefined, 0.42), relay: createSpark(undefined, 0.3), motor: createSpark(undefined, 0.42) };
        return { group: g, sensory, relay, motor, muscle, LBL, VIEWS, rows: { sensory: sg, relay: rg, motor: mg }, bars: { sensory: sBar, relay: rBarG, motor: mBar }, sparks: Object.values(sparks), spark: sparks, sPath };
      }

      /* ---------------------------------------------------------------- scene: reflex arc */
      function buildReflex() {
        const g = new THREE.Group();
        const mat = (c, o = {}) => tissueMaterial(c, o);
        // spinal cord: white matter (oval) with the butterfly of grey matter on the cut face
        const half = [[0, 0.55], [0.22, 0.6], [0.4, 0.85], [0.55, 1.25], [0.7, 1.7], [0.85, 2.0], [1.0, 2.08], [1.08, 1.95], [0.98, 1.6], [0.85, 1.2],
          [0.82, 0.8], [1.0, 0.55], [1.35, 0.35], [1.5, 0.1], [1.6, -0.3], [1.9, -0.7], [2.0, -1.15], [1.82, -1.55], [1.4, -1.7], [0.95, -1.55], [0.6, -1.15],
          [0.38, -0.7], [0.2, -0.48], [0, -0.42]];
        const grey = new THREE.Shape();
        half.forEach(([x, y], i) => (i ? grey.lineTo(x, y) : grey.moveTo(x, y)));
        for (let i = half.length - 1; i >= 0; i--) grey.lineTo(-half[i][0], half[i][1]);
        const greyPts = grey.getPoints(); const smoothGrey = new THREE.Shape(new THREE.SplineCurve(greyPts.map((p) => new THREE.Vector2(p.x, p.y))).getPoints(220));
        const white = new THREE.Shape(); white.absellipse(0, 0, 3.0, 2.35, 0, Math.PI * 2, false, 0);
        const notch = new THREE.Path(); notch.absellipse(0, 0.12, 0.09, 0.09, 0, Math.PI * 2, false, 0);
        smoothGrey.holes.push(notch);
        const depth = 2.6;
        const wg = new THREE.ExtrudeGeometry(white, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4, curveSegments: 72 });
        wg.translate(0, 0, -depth);
        const cord = new THREE.Mesh(wg, mat('#F1E3D3', { roughness: 0.6 }));
        const gg = new THREE.ExtrudeGeometry(smoothGrey, { depth: 0.05, bevelEnabled: false });
        gg.translate(0, 0, 0.1);
        const greyM = new THREE.Mesh(gg, mat('#B98A93', { roughness: 0.6 }));
        g.add(cord, greyM);
        // nerves: translucent sheaths so the fibres inside can be seen
        const nerveMat = new THREE.MeshStandardMaterial({ color: '#F4E7C2', roughness: 0.95, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 0.3 });
        const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, r, 20, false), nerveMat);
        const z0 = -0.5;
        const DRG = V(3.5, 2.6, z0);
        const dorsal = [V(1.0, 2.05, z0), V(2.2, 2.72, z0), DRG.clone(), V(4.4, 1.55, z0), V(5.0, 0.95, z0)];
        const ventral = [V(1.75, -1.75, z0), V(3.0, -1.55, z0), V(4.3, -0.35, z0), V(5.0, 0.6, z0)];
        const spinal = [V(4.9, 0.8, z0), V(5.8, 0.82, z0), V(6.6, 0.8, z0)];
        const toSkin = [V(6.5, 0.85, z0), V(7.2, 1.6, z0), V(7.8, 2.7, z0), V(8.1, 3.25, z0)];
        const toMuscle = [V(6.5, 0.75, z0), V(7.3, -0.3, z0), V(7.7, -1.5, z0)];
        g.add(tube(dorsal, 0.2), tube(ventral, 0.2), tube(spinal, 0.28), tube(toSkin, 0.18), tube(toMuscle, 0.2));
        const drg = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshPhysicalMaterial({ color: '#F2DDB0', roughness: 0.5, transparent: true, opacity: 0.28, depthWrite: false }));
        drg.scale.set(0.6, 0.42, 0.42); drg.position.copy(DRG); g.add(drg);
        // skin (a slab) with a hot object on it, and a muscle
        const skinG = new THREE.BoxGeometry(3.2, 0.45, 2.4, 1, 1, 1);
        const skin = new THREE.Mesh(skinG, new THREE.MeshPhysicalMaterial({ color: '#E7B9A3', roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false, sheen: 0.4, sheenColor: new THREE.Color('#ffe2dc') }));
        skin.position.set(8.8, 3.55, z0); g.add(skin);
        const hotMat = new THREE.MeshStandardMaterial({ color: '#FF7A3D', emissive: new THREE.Color('#FF5A1F'), emissiveIntensity: 0.6, roughness: 0.4 });
        const hot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.32, 40), hotMat);
        hot.position.set(9.0, 4.15, z0); g.add(hot);
        const muscle = muscleMesh(2.6, 0.72);
        muscle.position.set(8.75, -2.2, z0); muscle.rotation.z = -0.15; g.add(muscle);

        // neurons (µm inside each group; each group scaled to fit)
        const k = 0.0016;
        const sg = new THREE.Group(); sg.scale.setScalar(k); g.add(sg);
        const L = (p) => p.clone().divideScalar(k);
        const skinPts = new THREE.CatmullRomCurve3([...toSkin].reverse().map((p) => p.clone().add(V(0, 0, 0.12))));
        const nervePts = new THREE.CatmullRomCurve3([...spinal].reverse().map((p) => p.clone().add(V(0, 0.05, 0.12))));
        const dorsPts = new THREE.CatmullRomCurve3([...dorsal].reverse().map((p) => p.clone().add(V(0, 0.04, 0.12))));
        const periph = [];
        const pushCurve = (c, from, to, n) => { for (let i = 0; i <= n; i++) periph.push(L(c.getPoint(from + ((to - from) * i) / n))); };
        periph.push(L(V(8.4, 3.45, z0 + 0.12)));
        pushCurve(skinPts, 0, 1, 10);
        pushCurve(nervePts, 0.05, 1, 6);
        const tDrg = 0.5;
        pushCurve(dorsPts, 0.05, tDrg, 8);
        const T = periph[periph.length - 1];
        const arbor = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(0.6)).premultiply(new THREE.Matrix4().makeScale(0.75, 0.75, 0.75)).setPosition(periph[0]);
        const central = [T.clone()];
        for (let i = 1; i <= 6; i++) central.push(L(dorsPts.getPoint(tDrg + ((1 - tDrg) * i) / 6)));
        central.push(L(V(0.95, 1.55, z0 + 0.62)), L(V(0.85, 0.95, 0.22)), L(V(0.8, 0.55, 0.22)));
        const sens = sensoryNodes(skinSwc, { arbor: arbor.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)), periph: periph.slice(), soma: T.clone().add(V(0, 95, 0)), somaR: 55, central, fibreR: 3, twigs: 3 });
        // the matrix above was built with setPosition(periph[0]) so the arbor root sits at the skin entry point
        const sensory = buildNeuron({ nodes: sens.nodes }, { minRadius: 2, minPx: 1.7, step: 20, terminals: { radius: 30 }, nucleus: false, colors: { dendrites: '#E7A2D6', axon: '#E7A2D6', soma: '#F0A0C8', terminals: '#FFC65C' } });
        sensory.setDirection('dendrites', 1);
        sg.add(sensory.group); models.add(sensory);

        // relay neuron in the grey matter between the horns
        const rg = new THREE.Group(); rg.scale.setScalar(0.0027); rg.position.set(0.78, 0.05, 0.25); rg.rotation.set(0, 0, 0.25);
        const relay = buildNeuron(relaySwc, { minRadius: 0.6, minPx: 1.4, step: 3, radial: 6, terminals: { radius: 6 }, nucleus: false, colors: { dendrites: '#9FD3A5', axon: '#9FD3A5', soma: '#A9E0AE', terminals: '#FFC65C' } });
        rg.add(relay.group); models.add(relay); g.add(rg);

        // motor neuron in the ventral horn; its axon is drawn out through the ventral root to the muscle
        const mg = new THREE.Group(); mg.scale.setScalar(0.00115); mg.position.set(1.4, -1.2, 0.25); mg.rotation.set(0, Math.PI, -0.35);
        g.add(mg); mg.updateMatrixWorld(true); g.updateMatrixWorld(true);
        const mNodes = motorSwc.nodes.map((nd) => ({ ...nd }));
        const toLocal = (p) => mg.worldToLocal(g.localToWorld(p.clone()));
        const vPts = new THREE.CatmullRomCurve3(ventral.map((p) => p.clone().add(V(0, 0.03, 0.1))));
        const mPts = new THREE.CatmullRomCurve3(toMuscle.map((p) => p.clone().add(V(0, -0.04, 0.1))));
        const route = [];
        for (let i = 1; i <= 6; i++) route.push(toLocal(vPts.getPoint(i / 6)));
        route.push(toLocal(V(5.8, 0.74, z0 + 0.1)));
        for (let i = 0; i <= 5; i++) route.push(toLocal(mPts.getPoint(i / 5)));
        route.push(toLocal(V(7.95, -1.85, z0 + 0.2)));
        const ext = extendAxon(mNodes, route, { r: 3, twigs: 5, twigLen: 380 });
        const motor = buildNeuron({ nodes: mNodes }, { minRadius: 1.2, minPx: 1.5, step: 10, radial: 6, myelin: { start: 1200, internode: 900, gap: 120, thickness: 2.6, endPad: 700 }, terminals: { radius: 50 }, nucleus: false, colors: { dendrites: '#8FC0F5', axon: '#8FC0F5', soma: '#9CC9FA' } });
        mg.add(motor.group); models.add(motor);

        const W = (m, p) => m.toWorld(p);
        const LBL = {
          x_rec: { text: 'Receptor in the skin', sub: 'detects the heat', at: () => g.localToWorld(V(8.3, 3.5, z0 + 0.3)), side: 'left', dist: 90 },
          x_hot: { text: 'Hot object', plain: true, line: false, at: () => g.localToWorld(V(9.0, 4.4, z0)), side: 'top', dist: 6 },
          x_sens: { text: 'Sensory neuron', at: () => W(sensory, periph[14]), side: 'top', dist: 60, color: '#E7A2D6' },
          x_relay: { text: 'Relay neuron', sub: 'in the spinal cord', at: () => W(relay, relay.soma.center), side: 'top', dist: 120, offset: [-120, 0], color: '#9FD3A5' },
          x_motor: { text: 'Motor neuron', at: () => W(motor, motor.soma.center), side: 'bottom', dist: 110, color: '#8FC0F5' },
          x_muscle: { text: 'Muscle (effector)', sub: 'contracts', at: () => g.localToWorld(V(9.0, -2.45, z0 + 0.4)), side: 'bottom', dist: 50 },
          x_cord: { text: 'Spinal cord', sub: 'cut across', at: () => g.localToWorld(V(-2.3, 1.0, 0.1)), side: 'top', dist: 70 },
        };
        const box = new THREE.Box3(V(-3.2, -3.1, -1), V(10.2, 4.5, 0.5));
        const sPath = polyline([...periph, ...central.slice(1)], (p) => sensory.toWorld(p));
        const sparks = { sensory: createSpark(undefined, 0.5), relay: createSpark(undefined, 0.42), motor: createSpark(undefined, 0.5) };
        return { group: g, sensory, relay, motor, muscle, hot, hotMat, LBL, VIEWS: { main: () => ({ box, dir: V(0.12, 0.1, 1) }) }, periph, ext, sparks: Object.values(sparks), spark: sparks, sPath };
      }

      /* ---------------------------------------------------------------- animations */
      let anim = null;
      stage.onFrame((dt) => {
        if (!anim) return false;
        anim.t += dt;
        const done = anim.t >= anim.dur;
        anim.fn(Math.min(anim.t, anim.dur));
        if (done) { const a = anim; anim = null; a.done?.(); }
        return true;
      });
      function play(dur, fn, { still = dur, done } = {}) {
        if (reducedMotion()) { anim = null; fn(still); done?.(); stage.requestRender(); return; }
        anim = { t: 0, dur, fn, done }; fn(0);
      }
      const glowOn = () => (get('calm') === 'true' ? 0.75 : 1);

      // a neuron's standard sequence: signals flow in along dendrites → cell body → out along the axon
      function neuronSequence(m, t, { dIn = 1.2, soma = 0.5, out = 2.4, delay = 0, axonWidth = 34, dendWidth = 40, spark = null } = {}) {
        const G = glowOn();
        const u1 = seg(t, delay, delay + dIn), u2 = seg(t, delay + dIn, delay + dIn + soma), u3 = seg(t, delay + dIn + soma * 0.6, delay + dIn + soma * 0.6 + out);
        const dMax = m.maxDist.dendrites;
        m.setFront('dendrites', dMax * (1 - u1) - 10, t > delay && u1 < 1 ? G : u1 >= 1 ? G * Math.max(0, 1 - (t - delay - dIn) * 2.5) : 0, dendWidth);
        m.setFront('soma', 0, (t > delay + dIn * 0.85 ? Math.sin(Math.PI * Math.min(1, u2 * 0.999 + (u3 > 0 ? 0.3 * u3 : 0))) : 0) * G * 0.9);
        if (u3 > 0) m.setFront('axon', m.axonFrontAt(u3), G, axonWidth); else m.setFront('axon', -1e6, 0);
        if (spark) {
          spark.visible = u3 > 0 && u3 < 1;
          if (spark.visible) spark.position.copy(m.pointAt(m.axonFrontAt(u3)));
        }
      }

      /* ---------------------------------------------------------------- show */
      let current = null;
      const offInteract = stage.onInteract(() => { if (!controls.querySelector('[data-reset]')) addResetBtn(); });
      function addResetBtn() {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nrn3d-btn'; b.dataset.reset = '';
        b.textContent = '⟲ Reset view'; b.addEventListener('click', () => { b.remove(); frame(current, false); });
        controls.append(b);
      }
      function sceneOf(name) {
        if (!scenes[name]) {
          const sc = { anat: buildAnat, salt: buildSalt, types: buildTypes, reflex: buildReflex }[name]();
          const wrap = new THREE.Group(); wrap.add(sc.group, ...(sc.sparks || []));
          sc.group = wrap; scenes[name] = sc;
          stage.root.add(wrap);
        }
        return scenes[name];
      }
      function frame(plan, instant) {
        const sc = sceneOf(plan.scene);
        const v = plan.scene === 'anat' ? sc.VIEWS[plan.view]() : plan.scene === 'types' ? sc.VIEWS[plan.row]() : sc.VIEWS.main();
        stage.fit(v.box, { dir: v.dir, padding: plan.scene === 'anat' && plan.view !== 'whole' ? 1.12 : 1.06, instant });
      }
      function setLabels(sc, keys) { stage.labels.set(keys.filter((k) => sc.LBL[k]).map((k) => ({ key: k, ...sc.LBL[k] }))); }

      function show(step) {
        const plan = step < 0 ? INTRO : step >= PLAN.length ? RECAP : PLAN[step];
        const prev = current;
        current = plan;
        anim = null;
        const sc = sceneOf(plan.scene);
        for (const [k, s2] of Object.entries(scenes)) s2.group.visible = k === plan.scene;
        (sc.sparks || []).forEach((sp) => { sp.visible = false; });
        controls.innerHTML = '';
        note.textContent = NOTES[plan.scene]; note.hidden = false;
        cap.textContent = plan.cap; stage.setLabel(plan.cap);
        stage.setAO(false);   // screen-space AO leaves dark blocks around thin tubes

        if (plan.scene === 'anat') {
          const n = sc.n;
          n.clearSignals();
          n.highlight(plan.lit, { instant: prev?.scene !== 'anat' });
          sc.next.highlight(plan.lit && !plan.lit.includes('next') ? [] : null);
          sc.next.group.visible = plan.view === 'terminals';
          n.showNucleus(!!plan.nucleus);
          sc.bar.visible = plan.view === 'whole';
          setLabels(sc, [...plan.labels, ...(plan.view === 'whole' ? ['bar'] : [])]);
          if (plan.anim === 'inflow') {
            const run = () => play(2.6, (t) => {
              const u = seg(t, 0, 2.0);
              n.setFront('dendrites', 150 * (1 - u) - 6, glowOn() * (u < 1 ? 1 : 0), 22);
              n.setFront('soma', 0, glowOn() * 0.8 * Math.sin(Math.PI * seg(t, 1.6, 2.6)));
            }, { still: 2.6 });
            addPlay(run); run();
          } else if (plan.anim === 'impulse') {
            const run = () => play(5.4, (t) => neuronSequence(n, t, { dIn: 1.5, soma: 0.6, out: 3.2, axonWidth: 45, dendWidth: 90, spark: sc.spark }), { still: 5.4 });
            addPlay(run); run();
          }
        } else if (plan.scene === 'salt') {
          const { top, bot, L } = sc;
          const T1 = 4.2, T2 = 8.8;
          setLabels(sc, plan.labels);
          const run = () => play(T2 + 0.4, (t) => {
            const G = glowOn();
            const u1 = clamp(t / T1), u2 = clamp(t / T2);
            top.setFront('axon', u1 < 1 ? top.axonFrontAt(u1) : L, G, u1 < 1 ? 18 : 30);
            bot.setFront('axon', u2 * L, G, 34);
            setLabels(sc, t >= T1 ? [...plan.labels, 'first'] : plan.labels);
          }, { still: T1 });
          addPlay(run); run();
        } else if (plan.scene === 'types') {
          const ms = { sensory: sc.sensory, relay: sc.relay, motor: sc.motor };
          for (const [k, m] of Object.entries(ms)) { m.clearSignals(); m.highlight(k === plan.row ? null : [], { instant: prev?.scene !== 'types' }); }
          sc.muscle.material.userData.dim = plan.row !== 'motor';
          sc.muscle.material.color.set(plan.row === 'motor' ? '#C4505C' : '#5A4650');
          for (const [k, b] of Object.entries(sc.bars)) b.visible = k === plan.row;
          setLabels(sc, [...plan.labels, { sensory: 'b_s', relay: 'b_r', motor: 'b_m' }[plan.row]]);
          const m = ms[plan.row];
          let run;
          if (plan.row === 'sensory') {
            const dmin = Math.min(...m.nodes.map((nd) => nd.d)), dmax = Math.max(...m.nodes.map((nd) => nd.d));
            run = () => play(4.0, (t) => {
              const G = glowOn(); const u = clamp(t / 3.6);
              const f = dmin + (dmax - dmin) * u;
              m.setFront('dendrites', f, u < 1 ? G : 0, 90); m.setFront('axon', f, u < 1 ? G : 0, 90);
              m.setFront('soma', 0, G * 0.8 * Math.sin(Math.PI * seg(f, 2150, 2700)));
              const sp = sc.spark.sensory; sp.visible = f >= 0 && u < 1; if (sp.visible) sp.position.copy(sc.sPath.at(f));
            }, { still: 3.4 });
          } else if (plan.row === 'relay') {
            run = () => play(3.6, (t) => neuronSequence(m, t, { dIn: 1.0, soma: 0.5, out: 1.8, axonWidth: 40, dendWidth: 30, spark: sc.spark.relay }), { still: 3.2 });
          } else {
            run = () => play(5.4, (t) => {
              neuronSequence(m, t, { dIn: 1.0, soma: 0.5, out: 3.4, axonWidth: 90, dendWidth: 150, spark: sc.spark.motor });
              const c = smooth(seg(t, 4.6, 5.2));
              sc.muscle.scale.set(1 - 0.12 * c, 1 + 0.14 * c, 1 + 0.14 * c);
            }, { still: 4.75 });
          }
          addPlay(run); run();
        } else if (plan.scene === 'reflex') {
          const { sensory, relay, motor, muscle, hotMat } = sc;
          [sensory, relay, motor].forEach((m) => { m.clearSignals(); m.highlight(null, { instant: true }); });
          setLabels(sc, [...plan.labels, 'x_hot']);
          const dmin = Math.min(...sensory.nodes.map((nd) => nd.d)), dmax = Math.max(...sensory.nodes.map((nd) => nd.d));
          const run = () => play(10.5, (t) => {
            const G = glowOn();
            hotMat.emissiveIntensity = 0.5 + 0.6 * smooth(seg(t, 0, 0.6)) * (get('calm') === 'true' ? 0.3 : 1);
            const u = seg(t, 0.4, 4.2);
            const f = dmin + (dmax - dmin) * u;
            sensory.setFront('dendrites', f, u > 0 && u < 1 ? G : 0, 450); sensory.setFront('axon', f, u > 0 && u < 1 ? G : 0, 450);
            sensory.setFront('soma', 0, G * 0.8 * Math.sin(Math.PI * seg(u, 0.55, 0.8)));
            const sp = sc.spark.sensory; sp.visible = f >= 0 && u > 0 && u < 1; if (sp.visible) sp.position.copy(sc.sPath.at(f));
            neuronSequence(relay, t, { delay: 4.0, dIn: 0.8, soma: 0.4, out: 1.2, axonWidth: 60, dendWidth: 40, spark: sc.spark.relay });
            neuronSequence(motor, t, { delay: 6.0, dIn: 0.7, soma: 0.4, out: 2.8, axonWidth: 420, dendWidth: 260, spark: sc.spark.motor });
            const c = smooth(seg(t, 9.2, 9.9));
            muscle.scale.set(1 - 0.14 * c, 1 + 0.16 * c, 1 + 0.16 * c);
          }, { still: 10.5 });
          addPlay(run); run();
        }
        frame(plan, !prev || prev.scene !== plan.scene);
        stage.requestRender();
      }
      function addPlay(run) {
        if (reducedMotion()) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nrn3d-btn'; b.textContent = '↻ Play again';
        b.addEventListener('click', run); controls.prepend(b);
      }

      return {
        show,
        dispose() {
          anim = null; offInteract();
          for (const m of models) m.dispose();
          stage.dispose();
          [style, controls, note, cap, loading].forEach((e) => e.remove());
        },
      };
    },
  },
};
