// The endocrine system — AQA 7182 4.2.1: "The function of the endocrine system: glands and hormones."
// Visual: a real 3D human body (BodyParts3D, CC BY 4.0). Each step lights one gland and sends its
// hormone through the real blood vessels: from the gland into a vein, through the heart and lungs,
// then out along the arteries to its target organs. A zoomed-in inset shows the hypothalamus and
// pituitary, and a cut-away of the real adrenal gland shows the cortex and medulla. The model is male,
// so there are no ovaries: this is said on screen. The thyroid, the adrenal medulla and the spinal cord
// are approximate (BodyParts3D has no mesh for them); see src/data/body-provenance.json.
import { bodyStage, C } from '../three/body3d.js';
import { reducedMotion } from '../settings.js';

const KIDNEY = '#C3A6EE', LIVER = '#E0A07A', MEDULLA = '#FF8A5C';
const OVARY_NOTE = 'In females they are in the pelvis (the lower tummy), one on each side of the womb.';

const L = {
  pituitary: { at: 'pituitary', side: 'left', text: 'Pituitary gland', color: C.gland },
  thyroid: { at: 'thyroid', side: 'left', text: 'Thyroid gland', sub: 'drawn at a typical size', color: C.gland },
  adrenals: { at: 'adrenal_right', side: 'left', text: 'Adrenal glands', color: C.gland },
  ovaries: { at: 'ovary_position_right', side: 'left', text: 'Ovaries (in females)', sub: 'not in this male model', short: 'Ovaries (females): not in this model', note: true, color: C.gland },
  pineal: { minor: true, at: 'pineal', side: 'right', text: 'Pineal gland', sub: 'extra: not on the spec', color: C.gland },
  pancreas: { at: 'pancreas', side: 'right', text: 'Pancreas', color: C.gland },
  testes: { at: 'testis_left', side: 'right', text: 'Testes', sub: '(in males)', color: C.gland },
};
const ALL_GLANDS = ['pituitary', 'thyroid', 'adrenals', 'pancreas', 'testes', 'pineal'];
const VESSELS = { arteries: { color: C.blood, alpha: 0.35, glow: 0.05, tint: 0.6 }, veins: { color: C.vein, alpha: 0.3, glow: 0.05, tint: 0.6 } };
const TORSO = { parts: ['skull', 'pelvis', 'testes'], dir: [0, 0.05, 1] };

// A hormone's journey: gland -> vein(s) -> heart and lungs -> artery to a target
function journey(v, venous, targets, { color = C.hormone, speed = 330, count = 2, stagger = 0.35 } = {}) {
  return Promise.all(targets.map((t, i) => v.flow([...[].concat(venous), 'heart_lungs', t], { color, speed, count, spacing: 0.45, delay: i * stagger, size: 9 })));
}

const STEPS = [
  { // 0 glands and hormones
    caption: 'Each gland releases hormones into the blood',
    spec: { lit: { ...Object.fromEntries(ALL_GLANDS.map((g) => [g, C.gland])), ...VESSELS } },
    frame: TORSO,
    labels: [L.pituitary, L.thyroid, L.adrenals, L.ovaries, L.pineal, L.pancreas, L.testes],
    async play(v) {
      v.flow(['v_thyroid', 'heart_lungs', 'a_arm_right'], { speed: 330, count: 2 });
      v.flow(['v_adrenal_left', 'heart_lungs', 'a_leg_left'], { speed: 330, count: 2, delay: 0.5 });
      v.flow(['v_pituitary', 'heart_lungs', 'a_head_left'], { speed: 330, count: 2, delay: 1 });
      v.flow(['v_testis_right', 'heart_lungs', 'a_leg_right'], { speed: 330, count: 2, delay: 1.5 });
      await v.flow(['v_pancreas_liver'], { speed: 200, count: 2, delay: 0.8 });
    },
  },
  { // 1 target cells
    caption: 'Hormones reach every part of the body in the blood, but only target cells respond',
    spec: { lit: { ...VESSELS, adrenal_right: C.gland } },
    frame: TORSO,
    receptor: true,
    labels: [{ at: 'aortic_arch', side: 'left', text: 'Hormones in the blood', sub: 'carried everywhere', color: C.hormone }],
    async play(v) { await journey(v, 'v_adrenal_right', ['a_head_right', 'a_arm_left', 'a_kidney_left', 'a_leg_right', 'a_gut']); },
  },
  { // 2 master gland
    caption: 'The pituitary sends hormones in the blood to other glands',
    spec: { lit: { hypothalamus: C.brainpart, pituitary: C.gland, thyroid: C.gland, adrenals: C.gland, testes: C.gland, ...VESSELS } },
    frame: TORSO,
    inset: { at: { at: 'pituitary', offset: [0, 8, 0] }, dist: 95, dir: [1, 0.1, 0.3], tag: 'Zoomed in: base of the brain', only: ['hypothalamus', 'pituitary', 'optic_nerves', 'brainstem', 'thalamus'] },
    labels: [
      { at: 'hypothalamus', view: 'inset', side: 'left', text: 'Hypothalamus', sub: 'part of the brain', color: C.brainpart },
      { at: 'pituitary', view: 'inset', side: 'right', text: 'Pituitary gland', sub: 'the “master gland”', color: C.gland },
      { ...L.thyroid, side: 'left' }, { ...L.adrenals, side: 'left' }, { ...L.testes, side: 'right' }, { ...L.ovaries, side: 'left' },
    ],
    async play(v, tok) {
      await v.flow('hypo_pit', { color: C.brainpart, speed: 14, size: 2.2, count: 3, spacing: 0.5, fixed: true });
      if (!v.alive(tok)) return;
      await journey(v, 'v_pituitary', ['a_thyroid_left', 'a_adrenal_left', 'a_adrenal_right', 'a_testis_left', 'a_testis_right'], { color: C.gland });
    },
  },
  { // 3 thyroid
    caption: 'Thyroxine travels to cells all over the body',
    spec: { lit: { thyroid: C.gland, heart: C.heart, muscles: { color: C.hormone, alpha: 0.75, glow: 0.15 }, ...VESSELS } },
    frame: TORSO,
    labels: [
      { at: 'thyroid', side: 'left', text: 'Thyroid gland', sub: 'releases thyroxine (drawn at a typical size)', short: 'Thyroid: thyroxine', color: C.gland },
      { at: 'heart', side: 'right', text: 'Heart', sub: 'heart rate increases', color: C.heart },
      { at: 'muscle_thigh_left', side: 'right', text: 'Cells all over the body', sub: 'metabolism speeds up', short: 'Body cells', color: C.hormone },
    ],
    async play(v, tok) {
      await journey(v, 'v_thyroid', ['a_heart', 'a_arm_left', 'a_arm_right', 'a_thigh_left', 'a_thigh_right', 'a_head_right'], { stagger: 0.25 });
      if (v.alive(tok)) v.rhythm('heart', { rate: 85, amp: 0.03, duration: 8 });
    },
  },
  { // 4 adrenal glands
    caption: 'Each adrenal gland has two parts, which release different hormones',
    note: 'Cut-away: the medulla is shown as the central core of the real gland (its exact edge is approximate)',
    spec: { lit: { adrenals: C.gland, medullas: { color: MEDULLA, glow: 0.45, tint: 0.6 }, kidneys: { color: KIDNEY, alpha: 0.85, glow: 0.05 }, veins: VESSELS.veins } },
    frame: { parts: ['kidney_left', 'kidney_right', 'adrenal_left', 'adrenal_right'], dir: [0, 0.12, 1], pad: 1.5 },
    inset: { at: 'adrenal_left', dist: 105, dir: [0.25, 0.25, 1], tag: 'Zoomed in: cut through an adrenal gland',
      only: ['adrenal_left', 'adrenal_medulla_left'],
  clip: { parts: ['adrenal_left', 'adrenal_medulla_left'], normal: [-0.25, -0.25, -1], capColors: { adrenal_left: '#D9A23E', adrenal_medulla_left: '#C04E22' } } },
    labels: [
      { at: 'adrenal_right', side: 'left', text: 'Adrenal glands', sub: 'on top of the kidneys', color: C.gland },
      { at: 'kidney_right', side: 'left', text: 'Kidney', color: KIDNEY },
      { at: { at: 'adrenal_left', offset: [12, 14, 0] }, view: 'inset', side: 'right', y: 0.6, text: 'Adrenal cortex', sub: 'outer layer → cortisol', short: 'Cortex: cortisol', color: C.gland },
      { at: 'adrenal_medulla_left', view: 'inset', side: 'right', y: 0.8, text: 'Adrenal medulla', sub: 'middle → adrenaline', short: 'Medulla: adrenaline', color: MEDULLA },
    ],
    async play(v) {
      v.flow('v_adrenal_right', { color: C.hormone, speed: 120, count: 4, spacing: 0.6 });
      await v.flow('v_adrenal_left', { color: C.hormone, speed: 120, count: 4, spacing: 0.6 });
    },
  },
  { // 5 pancreas
    caption: 'Insulin helps cells take in glucose from the blood',
    spec: { lit: { pancreas: C.gland, liver: LIVER, thigh_muscles: { color: C.muscle, alpha: 0.85, glow: 0.15 }, ...VESSELS } },
    frame: { parts: ['ribcage', 'muscle_thigh_left', 'muscle_thigh_right'], dir: [0, 0.05, 1] },
    labels: [
      { at: 'pancreas', side: 'right', text: 'Pancreas', sub: 'releases insulin', short: 'Pancreas: insulin', color: C.gland },
      { at: 'liver', side: 'left', text: 'Liver', sub: 'takes in glucose', color: LIVER },
      { at: 'muscle_thigh_right', side: 'left', text: 'Muscle cells', sub: 'take in glucose', color: C.muscle },
    ],
    async play(v, tok) {
      await v.flow('v_pancreas_liver', { speed: 160, count: 3, spacing: 0.5 });
      if (!v.alive(tok)) return;
      await Promise.all(['a_thigh_left', 'a_thigh_right'].map((t, i) => v.flow(['v_liver', 'heart_lungs', t], { speed: 330, count: 2, spacing: 0.45, delay: i * 0.4 })));
    },
  },
  { // 6 ovaries and testes
    caption: 'Ovaries release oestrogen. Testes release testosterone.',
    note: 'This 3D model is of a male body, so it has testes but no ovaries',
    spec: { lit: { testes: C.gland, muscles: { color: C.hormone, alpha: 0.7, glow: 0.12 }, ...VESSELS } },
    frame: { parts: ['ribcage', 'pelvis', 'testes', 'muscle_thigh_left'], dir: [0, 0.05, 1] },
    labels: [
      { at: 'ovary_position_right', side: 'left', text: 'Ovaries (in females)', sub: `release oestrogen. Not in this male model. ${OVARY_NOTE}`, short: 'Ovaries (females): not in this model', note: true, color: C.gland },
      { at: 'testis_left', side: 'right', text: 'Testes (in males)', sub: 'release testosterone', short: 'Testes: testosterone', color: C.gland },
    ],
    async play(v) {
      await Promise.all([
        journey(v, 'v_testis_left', ['a_arm_left', 'a_thigh_left', 'a_head_left']),
        journey(v, 'v_testis_right', ['a_arm_right', 'a_thigh_right'], { stagger: 0.5 }),
      ]);
    },
  },
  { // 7 compare
    caption: 'Two ways of sending messages around the body',
    compare: true,
    spec: { lit: { arm_right: C.pns, spinal_cord: { color: C.cns, glow: 0.2 }, ...VESSELS, adrenal_right: C.gland } },
    frame: { parts: ['skull', 'muscle_arm_right', 'adrenal_right', 'hand_right'], dir: [-0.15, 0.05, 1] },
    labels: [
      { at: { at: 'arm_right', offset: [0, 80, 0] }, side: 'left', text: 'Nervous system', sub: 'electrical impulses: very fast', color: C.pns },
      { at: 'aortic_arch', side: 'right', text: 'Endocrine system', sub: 'hormone in the blood: slower', color: C.hormone },
    ],
    async play(v, tok) {
      const lit = (on) => v.setState({ ...STEPS[7].spec, lit: { ...STEPS[7].spec.lit, ...(on.nerve ? { muscle_arm_right: C.pns } : {}), ...(on.hormone ? { muscle_arm_left: C.hormone, thigh_muscles: C.hormone } : {}) } });
      const state = { nerve: false, hormone: false };
      const hormone = journey(v, 'v_adrenal_right', ['a_biceps_left', 'a_thigh_left', 'a_thigh_right'], { speed: 260, count: 2 })
        .then((ok) => { if (ok.every(Boolean) && v.alive(tok)) { state.hormone = true; lit(state); } });
      for (let i = 0; i < 3; i++) {
        await v.flow('motor_arm_right', { color: C.pns, speed: 1800, size: 11, track: i === 0 });
        if (!v.alive(tok)) return;
        state.nerve = true; lit(state);
        await v.wait(0.45);
        state.nerve = false; lit(state);
        if (!(await v.wait(0.9))) return;
      }
      await hormone;
    },
  },
];

const RECAP_LABELS = [
  { ...L.pituitary, sub: 'controls other glands' }, { ...L.thyroid, sub: 'thyroxine' }, { ...L.adrenals, sub: 'adrenaline (medulla), cortisol (cortex)' },
  { ...L.ovaries, sub: 'oestrogen (not in this male model)', short: 'Ovaries (females): not in this model' }, { ...L.pancreas, sub: 'insulin' }, { ...L.testes, sub: 'testosterone' },
];

const CSS = `
.en3-panel { width: min(380px, 46%); border-radius: 16px; background: rgba(11,17,34,.93); border: 1px solid rgba(220,230,255,.18);
  box-shadow: 0 8px 24px rgba(0,0,0,.35); color: #F3F6FF; padding: 10px 12px 12px; font: 15px/1.35 var(--font, system-ui, sans-serif); }
.en3-panel h3 { margin: 0 0 4px; font-size: 16px; color: #F3F6FF; }
.en3-panel p { margin: 4px 0 0; color: #C9D3EE; font-size: 15px; }
.en3-panel svg { width: 100%; height: auto; display: block; }
.en3-receptor { position: absolute; right: 12px; z-index: 3; }
.en3-cmp { width: 100%; max-width: 760px; }
.en3-cmp table { width: 100%; border-collapse: collapse; font-size: 15px; color: #F3F6FF; }
.en3-cmp th, .en3-cmp td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.14); }
.en3-cmp thead th { color: #C9D3EE; }
.en3-cmp tbody th { color: #C9D3EE; font-weight: 700; width: 24%; }
.en3-tube { fill: rgba(255,112,136,.18); stroke: rgba(255,112,136,.7); stroke-width: 2; }
.en3-cell { fill: rgba(255,255,255,.07); stroke: rgba(230,236,255,.5); stroke-width: 2; transition: fill .6s, stroke .6s; }
.en3-cell.responds { fill: rgba(255,210,122,.32); stroke: #FFD27A; }
.en3-nuc { fill: rgba(255,255,255,.14); }
.en3-rec { fill: none; stroke: rgba(240,244,255,.85); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
.en3-hor { fill: #FFD27A; stroke: #0b1120; stroke-width: 1; }
.en3-mover { transition: transform 2.2s cubic-bezier(.45,.05,.35,1); }
.en3-txt { font: 600 15px var(--font, system-ui); fill: #E8EDFF; }
@media (prefers-reduced-motion: reduce) { .en3-mover, .en3-cell { transition: none; } }
`;

const TRI = 'M-6.5,-5 L6.5,-5 L0,6.5 Z';
function receptorSVG() {
  const cups = (cx, cy, r, shape) => [-125, -90, -55].map((a) => {
    const rad = (a * Math.PI) / 180, x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
    const d = shape === 'v' ? 'M-8,-9 L0,0 L8,-9' : 'M-7,-9 L-7,0 L7,0 L7,-9';
    return `<path class="en3-rec" d="${d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a + 90})"/>`;
  }).join('');
  return `<svg viewBox="-170 -110 340 215" role="img" aria-label="Zoomed in: a hormone in the blood fits the receptor on a target cell, like a key in a lock. The other cell has no matching receptor, so it does not respond.">
    <rect class="en3-tube" x="-168" y="-104" width="336" height="42" rx="8"/>
    <text class="en3-txt" x="0" y="-74" text-anchor="middle" style="font-size:14px">blood vessel</text>
    <path class="en3-hor" d="${TRI}" transform="translate(-140 -90)"/><path class="en3-hor" d="${TRI}" transform="translate(80 -88)"/><path class="en3-hor" d="${TRI}" transform="translate(140 -92)"/>
    <circle class="en3-cell" data-cell="a" cx="-70" cy="42" r="48"/><circle class="en3-nuc" cx="-70" cy="50" r="14"/>${cups(-70, 42, 48, 'v')}
    <circle class="en3-cell" cx="72" cy="42" r="48"/><circle class="en3-nuc" cx="72" cy="50" r="14"/>${cups(72, 42, 48, 'sq')}
    <path class="en3-hor en3-mover" data-mover d="${TRI}" style="transform: translate(-110px, -84px)"/>
    <text class="en3-txt" x="-70" y="104" text-anchor="middle">target cell</text>
    <text class="en3-txt" x="72" y="104" text-anchor="middle">not a target</text>
  </svg>`;
}

export default {
  id: 'endocrine',
  title: 'The endocrine system',
  objectives: [
    'Explain what glands and hormones are, and how hormones reach their target cells.',
    'Name the key glands, where they are, and the hormone each one releases.',
    'Compare the endocrine system with the nervous system.',
  ],
  keywords: [
    { term: 'Endocrine system', simple: 'A set of glands that send chemical messages (hormones) around the body in the blood.', exam: 'One of the body’s major information systems. It instructs glands to release hormones directly into the bloodstream, which carries them to target organs.' },
    { term: 'Gland', simple: 'An organ that makes and releases hormones.', exam: 'An organ in the body that synthesises substances such as hormones.' },
    { term: 'Hormone', simple: 'A chemical messenger carried in the blood.', exam: 'A chemical substance that circulates in the bloodstream and only affects target organs, which have receptors for that hormone.' },
    { term: 'Target cell', simple: 'A cell with the right receptor for a hormone. Only target cells respond to that hormone.' },
    { term: 'Pituitary gland', simple: 'The “master gland” at the base of the brain. It controls the release of hormones from other glands.', exam: 'Controlled by the hypothalamus. It releases hormones that regulate other endocrine glands, for example ACTH, which stimulates the adrenal cortex.' },
    { term: 'Adrenaline', simple: 'A hormone from the adrenal glands that gets the body ready for action.', exam: 'Released by the adrenal medulla when the sympathetic nervous system is activated. It is the key hormone in the fight or flight response.' },
  ],
  steps: [
    {
      title: 'Glands and hormones',
      simple: `<p>The <span class="keyterm">endocrine system</span> is a set of <strong>glands</strong> in different parts of your body.</p>
        <p>A <span class="keyterm">gland</span> makes chemical messengers called <span class="keyterm">hormones</span>.</p>
        <p>Glands release hormones <strong>straight into the bloodstream</strong>. The blood carries them all around the body.</p>`,
      exam: '<p>The endocrine system works alongside the nervous system, but it uses chemicals carried in the blood instead of electrical impulses along neurons. The pineal gland (which releases melatonin) is also an endocrine gland, but it is not on the AQA specification.</p>',
    },
    {
      title: 'Hormones find their target cells',
      simple: `<p>Hormones travel everywhere in the blood, but they only affect some cells. These are called <span class="keyterm">target cells</span>.</p>
        <p>Target cells have <strong>receptors</strong>. A hormone fits its receptor like a key fits a lock.</p>
        <p>When the hormone attaches, the cell responds. Cells without the right receptor are not affected.</p>`,
      exam: '<p>Each hormone binds only to its own receptors. When enough receptors are stimulated, there is a physiological reaction in the target organ. One hormone can affect many organs at the same time, if they all have the right receptors.</p>',
    },
    {
      title: 'The pituitary: the “master gland”',
      simple: `<p>The <span class="keyterm">pituitary gland</span> is a small gland at the base of the brain.</p>
        <p>It is called the <strong>“master gland”</strong> because it controls the release of hormones from other glands, such as the thyroid and the adrenal glands.</p>
        <p>The pituitary is controlled by the <strong>hypothalamus</strong>, a part of the brain just above it.</p>`,
      exam: '<p>The hypothalamus links the nervous system to the endocrine system. For example, the pituitary releases <strong>ACTH</strong> (adrenocorticotropic hormone), which travels in the blood to the adrenal cortex and makes it release cortisol.</p>',
    },
    {
      title: 'The thyroid gland',
      simple: `<p>The <strong>thyroid gland</strong> is in your neck.</p>
        <p>It releases a hormone called <span class="keyterm">thyroxine</span>.</p>
        <p>Thyroxine controls your <span class="keyterm">metabolism</span>: how quickly your cells use energy. It affects cells all over the body, including cells in the heart, where it can increase heart rate.</p>`,
      exam: '<p>The thyroid is itself controlled by the pituitary gland, which releases thyroid-stimulating hormone (TSH). Changes in metabolic rate also affect growth.</p>',
    },
    {
      title: 'The adrenal glands',
      simple: `<p>You have two <strong>adrenal glands</strong>. They sit on top of your kidneys. Each one has two parts:</p>
        <ul>
          <li>the <strong>adrenal medulla</strong> (the middle) releases <span class="keyterm">adrenaline</span>, which gets your body ready for action in fight or flight;</li>
          <li>the <strong>adrenal cortex</strong> (the outer layer) releases <span class="keyterm">cortisol</span>, which helps the body cope with stress that goes on for longer.</li>
        </ul>`,
      exam: '<p>The adrenal medulla is stimulated by the sympathetic nervous system. The adrenal cortex is stimulated by ACTH from the pituitary. Cortisol increases the glucose available in the blood. (Cortisol and long-term stress are covered in the Stress option.)</p>',
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>The sympathetic nervous system does <strong>not</strong> release adrenaline itself. The SNS <strong>stimulates</strong> the adrenal medulla, and the <strong>adrenal medulla releases</strong> adrenaline into the blood.</p>' },
    },
    {
      title: 'The pancreas',
      simple: `<p>The <strong>pancreas</strong> is behind your stomach.</p>
        <p>It releases a hormone called <span class="keyterm">insulin</span>.</p>
        <p>Insulin helps cells, such as liver and muscle cells, take in <strong>glucose</strong> (sugar) from the blood. This lowers the amount of glucose in your blood, for example after a meal.</p>`,
      exam: '<p>Beyond the specification: the pancreas also releases glucagon, which raises blood glucose when it is low. Insulin and glucagon work together to keep blood glucose balanced.</p>',
    },
    {
      title: 'Ovaries and testes',
      simple: `<p>The <strong>ovaries</strong> (in females) release <span class="keyterm">oestrogen</span>. Oestrogen controls the female reproductive system, including the menstrual cycle.</p>
        <p>The <strong>testes</strong> (in males) release <span class="keyterm">testosterone</span>. Testosterone controls the development of male characteristics at puberty, such as a deeper voice and muscle growth.</p>`,
      exam: '<p>Both males and females produce some oestrogen and some testosterone, but in different amounts. The release of both hormones is controlled by the pituitary gland.</p>',
    },
    {
      title: 'Nervous system or endocrine system?',
      simple: `<p>Both systems carry messages around the body, but in different ways.</p>
        <ul>
          <li>The <strong>nervous system</strong> uses electrical impulses along neurons. It is <strong>very fast</strong>, and its effects are <strong>short-lived</strong>.</li>
          <li>The <strong>endocrine system</strong> uses hormones in the blood. It is <strong>slower</strong>, but its effects <strong>last longer</strong>.</li>
        </ul>`,
      exam: '<p>The two systems often work together. In fight or flight, the sympathetic nervous system (nerves) triggers the adrenal medulla (a gland) to release adrenaline (a hormone). Some hormones, such as adrenaline, act within seconds.</p>',
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Do not mix up <strong>hormones</strong> and <strong>neurotransmitters</strong>. Hormones travel in the <strong>blood</strong> to target cells anywhere in the body. Neurotransmitters cross the tiny gap (the <strong>synapse</strong>) between a neuron and the next cell.</p>' },
    },
  ],
  quiz: [
    { q: 'How do hormones travel around the body?', options: ['As electrical impulses along neurons', 'In the bloodstream', 'Across synapses', 'Through the spinal cord'], answer: 1, explain: 'Glands release hormones straight into the bloodstream, which carries them around the body.', hint: 'Think about the vessels in the diagram.' },
    { q: 'Why is the pituitary called the “master gland”?', options: ['It is the biggest gland', 'It releases adrenaline', 'It controls the release of hormones from other glands', 'It controls the whole nervous system'], answer: 2, explain: 'The pituitary releases hormones that control other glands, such as the thyroid and adrenal glands.', hint: 'A “master” tells others what to do.' },
    { q: 'Which part of the adrenal gland releases adrenaline?', options: ['Adrenal cortex', 'Adrenal medulla', 'Pituitary', 'Thyroid'], answer: 1, explain: 'The adrenal medulla, in the middle of the adrenal gland, releases adrenaline.', hint: 'Medulla = middle.' },
    { q: 'Which hormone does the thyroid gland release?', options: ['Thyroxine', 'Insulin', 'Cortisol', 'Testosterone'], answer: 0, explain: 'The thyroid releases thyroxine, which controls metabolism.', hint: 'The name of the hormone sounds like the name of the gland.' },
    { q: 'Compared with the nervous system, the endocrine system is…', options: ['faster, with shorter-lasting effects', 'slower, with longer-lasting effects', 'faster, with longer-lasting effects', 'slower, with shorter-lasting effects'], answer: 1, explain: 'Hormones in the blood take longer to arrive, but their effects last longer.', hint: 'Watch the two messages in the last step: which one arrives first, and which glow stays?' },
  ],
  summary: [
    'Glands release hormones into the bloodstream. Hormones only affect target cells that have the right receptors.',
    'Hypothalamus → pituitary (“master gland”) → other glands. Thyroid → thyroxine. Adrenal medulla → adrenaline; adrenal cortex → cortisol. Pancreas → insulin. Ovaries → oestrogen. Testes → testosterone.',
    'Endocrine system: slower, longer-lasting. Nervous system: very fast, short-lived.',
  ],
  visual: {
    dark: true,
    async create(container) {
      if (!document.getElementById('en3-css')) { const s = document.createElement('style'); s.id = 'en3-css'; s.textContent = CSS; document.head.append(s); }
      const stage = bodyStage(container, { label: '3D body showing the endocrine glands' });
      const v = stage.viewer;
      // receptor close-up (2D: cells and receptors are far too small to see on a whole body)
      const rec = document.createElement('div');
      rec.className = 'en3-panel en3-receptor';
      rec.innerHTML = `<h3>Zoomed in: a target cell</h3>${receptorSVG()}<p>The hormone fits its receptor like a key in a lock, so the cell responds.</p>`;
      rec.hidden = true;
      stage.root.append(rec);
      const mover = rec.querySelector('[data-mover]');
      const cellA = rec.querySelector('[data-cell="a"]');
      // comparison table
      const cmp = document.createElement('div');
      cmp.className = 'en3-panel en3-cmp';
      cmp.innerHTML = `<table>
        <thead><tr><th scope="col"></th><th scope="col">Nervous system</th><th scope="col">Endocrine system</th></tr></thead>
        <tbody>
          <tr><th scope="row">Message</th><td>Electrical impulses (and neurotransmitters at synapses)</td><td>Hormones</td></tr>
          <tr><th scope="row">Travels</th><td>Along neurons</td><td>In the bloodstream</td></tr>
          <tr><th scope="row">Speed</th><td>Very fast</td><td>Slower</td></tr>
          <tr><th scope="row">Effects last</th><td>A short time</td><td>Longer</td></tr>
          <tr><th scope="row">Acts on</th><td>The muscles and glands its neurons reach</td><td>Any target cell with the right receptor</td></tr>
        </tbody></table>`;
      cmp.hidden = true;
      stage.dock.append(cmp);
      // the page shows straight away; the 3D model fills in when it has loaded
      let loaded = false, pending = null;
      v.ready.then(() => { loaded = true; if (pending !== null) api.show(pending); });

      const placeRec = () => {
        rec.style.top = `${stage.cap.offsetTop + stage.cap.offsetHeight + 10}px`;
        stage.extraSafe = rec.hidden ? null : { right: rec.offsetWidth + 20 };
        stage.refreshSafe();
      };
      function receptorAnim(tok) {
        mover.style.transition = 'none';
        mover.style.transform = 'translate(-110px, -84px)';
        cellA.classList.remove('responds');
        if (reducedMotion()) { mover.style.transform = 'translate(-70px, -12px)'; cellA.classList.add('responds'); return; }
        void mover.getBoundingClientRect();
        mover.style.transition = '';
        v.wait(0.4).then((ok) => { if (ok && v.alive(tok)) mover.style.transform = 'translate(-70px, -12px)'; });
        v.wait(2.8).then((ok) => { if (ok && v.alive(tok)) cellA.classList.add('responds'); });
      }

      let current = -1;
      function show(step) {
        current = step;
        const inRange = step >= 0 && step < STEPS.length;
        const st = inRange ? STEPS[step] : STEPS[0];
        v.setInset(inRange && st.inset ? st.inset : null);
        v.setState(st.spec);
        v.frame(st.frame);
        rec.hidden = !(inRange && st.receptor);
        cmp.hidden = !(inRange && st.compare);
        placeRec();
        let caption = st.caption, labels = st.labels;
        if (step < 0) { caption = 'The main glands of the endocrine system'; labels = STEPS[0].labels; }
        if (step >= STEPS.length) { caption = 'The glands and the hormones they release'; labels = RECAP_LABELS; }
        v.setLabels(labels);
        stage.setCaption(caption, inRange ? st.note : '');
        stage.describe(`Labels: ${labels.map((l) => `${l.text}${l.sub ? ` (${l.sub})` : ''}`).join('; ')}.`);
        stage.bar.showMotion(inRange);
        const run = () => stage.play(async (tok) => {
          if (st.receptor) receptorAnim(tok);
          await st.play(v, tok);
        });
        stage.handlers.replay = inRange ? run : null;
        if (inRange) run(); else v.clearAnim();
      }

      const api = {
        show(step) { if (!loaded) { pending = step; return; } show(step); },
        dispose() { stage.dispose(); },
      };
      return api;
    },
  },
};
