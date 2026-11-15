// The endocrine system — AQA 7182 4.2.1: "The function of the endocrine system: glands and hormones."
// Visual: a front-view body (head to hips) on a dark stage. Each step lights one gland and sends
// its hormone through the blood vessels to its targets. Zoomed insets show receptors, the
// hypothalamus–pituitary link and the two layers of the adrenal gland. The last step compares
// the nervous and endocrine systems side by side.
import {
  svg, defs, routePaths, light, watchScale, createLabels, createAnimator,
  injectBodyCSS, injectCSS, playAgainButton, uid, svgEl,
} from './shared/body.js';

// body space -> stage space
const S = 1.45, TX = 226, TY = 14;
const O = (x, y) => [+(TX + S * x).toFixed(1), +(TY + S * y).toFixed(1)];
const VB = { x: 0, y: 0, w: 800, h: 600 };

// Small "target cells" where hormones arrive (body space)
const TARGETS = { armL: [40, 300], armR: [200, 300], legL: [102, 372], legR: [138, 372], headL: [113, 52], headR: [127, 52] };

const GLAND_LABELS = [
  { at: O(120, 47.8), side: 'left', y: 70, text: 'Pituitary gland', color: 'var(--c-gland)' },
  { at: O(116, 91), side: 'left', y: 140, text: 'Thyroid gland', color: 'var(--c-gland)' },
  { at: O(93, 224), side: 'left', y: 320, text: 'Adrenal glands', color: 'var(--c-gland)' },
  { at: O(101, 296), side: 'left', y: 430, text: 'Ovaries', sub: '(in females)', color: 'var(--c-gland)' },
  { at: O(121, 34), side: 'right', y: 40, text: 'Pineal gland', sub: 'extra: not on\nthe spec', color: 'var(--c-gland)' },
  { at: O(138, 236), side: 'right', y: 340, text: 'Pancreas', color: 'var(--c-gland)' },
  { at: O(128, 334), side: 'right', y: 480, text: 'Testes', sub: '(in males)', color: 'var(--c-gland)' },
];
const ALL_GLANDS = ['pituitary', 'thyroid', 'adrenals', 'pancreas', 'ovaries', 'testes', 'pineal'];

const STEPS = [
  { // 0 glands and hormones
    on: [...ALL_GLANDS, 'vessels'], caption: 'Each gland releases hormones into the blood',
    labels: [...GLAND_LABELS, { at: O(185, 178), side: 'right', y: 220, text: 'Blood vessels', color: 'var(--c-blood)' }],
  },
  { // 1 target cells
    on: ['vessels'], inset: 'receptor', caption: 'Zoomed in: a hormone fits the receptor on its target cell',
    labels: [],
  },
  { // 2 master gland
    on: ['pituitary', 'hypothalamus', 'brain', 'thyroid', 'adrenals', 'ovaries', 'testes', 'vessels'], inset: 'pituitary',
    caption: 'The pituitary sends hormones in the blood to other glands',
    labels: [
      { at: O(122, 91), side: 'right', y: 140, text: 'Thyroid gland', color: 'var(--c-gland)' },
      { at: O(148, 220.5), side: 'right', y: 290, text: 'Adrenal glands', color: 'var(--c-gland)' },
      { at: O(139, 296), side: 'right', y: 400, text: 'Ovaries', sub: '(in females)', color: 'var(--c-gland)' },
      { at: O(128, 334), side: 'right', y: 480, text: 'Testes', sub: '(in males)', color: 'var(--c-gland)' },
    ],
  },
  { // 3 thyroid
    on: ['thyroid', 'vessels', 'targets', 'heart'], caption: 'Thyroxine travels to cells all over the body',
    labels: [
      { at: O(114, 91), side: 'left', y: 130, text: 'Thyroid gland', sub: 'releases thyroxine', short: 'Thyroid:\nthyroxine', color: 'var(--c-gland)' },
      { at: O(131, 170), side: 'right', y: 230, text: 'Heart', sub: 'heart rate\nincreases', color: 'var(--c-heart)' },
      { at: O(200, 300), side: 'right', y: 420, text: 'Cells all over\nthe body', sub: 'metabolism\nspeeds up', short: 'Body cells', color: 'var(--c-hormone)' },
    ],
  },
  { // 4 adrenal glands
    on: ['adrenals', 'kidneys', 'vessels'], inset: 'adrenal', caption: 'Each adrenal gland has two parts, which release different hormones',
    labels: [
      { at: O(93, 224), side: 'left', y: 300, text: 'Adrenal glands', sub: 'on top of the\nkidneys', color: 'var(--c-gland)' },
      { at: O(93, 244), side: 'left', y: 400, text: 'Kidney', color: 'var(--c-kidney)' },
    ],
  },
  { // 5 pancreas
    on: ['pancreas', 'liver', 'vessels', 'targets'], caption: 'Insulin helps cells take in glucose from the blood',
    labels: [
      { at: O(139, 236), side: 'right', y: 320, text: 'Pancreas', sub: 'releases insulin', short: 'Pancreas:\ninsulin', color: 'var(--c-gland)' },
      { at: O(95, 205), side: 'left', y: 270, text: 'Liver', sub: 'takes in glucose', color: 'var(--c-liver)' },
      { at: O(102, 372), side: 'left', y: 470, text: 'Muscle cells', sub: 'take in glucose', color: 'var(--c-hormone)' },
    ],
  },
  { // 6 ovaries and testes
    on: ['ovaries', 'testes', 'vessels', 'targets'], caption: 'Ovaries release oestrogen. Testes release testosterone.',
    labels: [
      { at: O(101, 296), side: 'left', y: 400, text: 'Ovaries', sub: '(in females)\nrelease oestrogen', short: 'Ovaries:\noestrogen', color: 'var(--c-gland)' },
      { at: O(128, 334), side: 'right', y: 440, text: 'Testes', sub: '(in males) release\ntestosterone', short: 'Testes:\ntestosterone', color: 'var(--c-gland)' },
    ],
  },
  { compare: true, caption: 'Two ways of sending messages around the body' }, // 7
];

const CSS = `
.en-vis .en-inset { opacity:0; transition: opacity .5s ease; pointer-events:none; }
.en-vis .en-inset.show { opacity:1; }
.en-vis .en-inset-bg { fill: color-mix(in srgb, var(--bh-bg) 92%, #fff 8%); }
.en-vis .en-inset-ring { fill:none; stroke: color-mix(in srgb, var(--bh-ink) 40%, transparent); stroke-width: 2; }
.en-vis .en-connector { fill:none; stroke: color-mix(in srgb, var(--bh-ink) 40%, transparent); stroke-width: 1.5; stroke-dasharray: 4 5; }
.en-vis .en-zoomring { fill:none; stroke: color-mix(in srgb, var(--bh-ink) 55%, transparent); stroke-width: 1.5; }
.en-vis .en-tube { fill: color-mix(in srgb, var(--c-blood) 22%, transparent); stroke: color-mix(in srgb, var(--c-blood) 70%, transparent); stroke-width: 2; }
.en-vis .en-cell { fill: color-mix(in srgb, var(--bh-ink) 8%, transparent); stroke: color-mix(in srgb, var(--bh-ink) 45%, transparent); stroke-width: 2; transition: fill .6s, stroke .6s; }
.en-vis .en-cell.responds { fill: color-mix(in srgb, var(--c-hormone) 30%, transparent); stroke: var(--c-hormone); }
.en-vis .en-nucleus { fill: color-mix(in srgb, var(--bh-ink) 16%, transparent); }
.en-vis .en-rec { fill:none; stroke: color-mix(in srgb, var(--bh-ink) 80%, transparent); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
.en-vis .en-hormone { fill: var(--c-hormone); stroke: var(--bh-bg); stroke-width: 1; }
.en-vis .en-docked { opacity: 0; transition: opacity .4s; }
.en-vis .en-docked.on { opacity: 1; }
.en-vis .en-brainmass { fill: color-mix(in srgb, var(--c-cns) 14%, transparent); stroke: color-mix(in srgb, var(--c-cns) 60%, transparent); stroke-width: 2; }
.en-vis .en-gyri { fill:none; stroke: color-mix(in srgb, var(--c-cns) 45%, transparent); stroke-width: 2.5; stroke-linecap: round; }
.en-vis .en-hypo { fill: color-mix(in srgb, var(--c-brainpart) 45%, transparent); stroke: var(--c-brainpart); stroke-width: 2; }
.en-vis .en-pit { fill: color-mix(in srgb, var(--c-gland) 55%, transparent); stroke: var(--c-gland); stroke-width: 2; }
.en-vis .en-stalk { fill:none; stroke: var(--c-gland); stroke-width: 7; stroke-linecap: round; opacity:.7; }
.en-vis .en-bone { fill:none; stroke: color-mix(in srgb, var(--bh-ink) 35%, transparent); stroke-width: 5; stroke-linecap: round; }
.en-vis .en-cortex { fill: color-mix(in srgb, var(--c-gland) 40%, transparent); stroke: var(--c-gland); stroke-width: 2; }
.en-vis .en-medulla { fill: color-mix(in srgb, var(--c-sym) 55%, transparent); stroke: var(--c-sym); stroke-width: 2; }
.en-vis .en-kidney { fill: color-mix(in srgb, var(--c-kidney) 22%, transparent); stroke: color-mix(in srgb, var(--c-kidney) 70%, transparent); stroke-width: 2; }
.en-vis .bh-target { fill: color-mix(in srgb, var(--c-hormone) 15%, transparent); stroke: color-mix(in srgb, var(--c-hormone) 60%, transparent); stroke-width: .8; transition: fill .5s; }
.en-vis .bh-target.hit { fill: var(--c-hormone); }
.en-vis .en-svgwrap { flex:1 1 auto; min-height:0; display:flex; }
.en-vis .en-compare { flex:1 1 auto; min-height:0; overflow:auto; padding: 14px 16px 4px; display:grid; gap: 12px; align-content:start; }
.en-vis .en-lanes { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.en-vis .en-lane { background: var(--bh-panel); border: 1px solid rgb(255 255 255 / 14%); border-radius: 14px; padding: 10px 12px; }
.en-vis .en-lane h3 { margin: 0 0 2px; font-size: 1rem; color: var(--bh-ink); }
.en-vis .en-lane p { margin: 4px 0 0; font-size: .85rem; color: var(--bh-soft); }
.en-vis .en-lane svg { width: 100%; height: auto; display:block; }
.en-vis table { width:100%; border-collapse: collapse; font-size: .85rem; color: var(--bh-ink); }
.en-vis th, .en-vis td { text-align:left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid rgb(255 255 255 / 14%); }
.en-vis thead th { font-size: .85rem; color: var(--bh-soft); }
.en-vis tbody th { font-weight: 700; color: var(--bh-soft); width: 26%; }
.en-vis .lane-nerve { fill:none; stroke: var(--c-pns); stroke-width: 4; stroke-linecap: round; }
.en-vis .lane-myelin { fill: color-mix(in srgb, var(--c-pns) 35%, var(--bh-bg)); stroke: var(--c-pns); stroke-width: 1.5; }
.en-vis .lane-soma { fill: color-mix(in srgb, var(--c-pns) 30%, var(--bh-bg)); stroke: var(--c-pns); stroke-width: 2; }
.en-vis .lane-vessel { fill:none; stroke: var(--c-blood); stroke-width: 9; stroke-linecap: round; opacity:.45; }
.en-vis .lane-gland { fill: color-mix(in srgb, var(--c-gland) 40%, var(--bh-bg)); stroke: var(--c-gland); stroke-width: 2; }
.en-vis .lane-target { fill: color-mix(in srgb, var(--bh-ink) 10%, transparent); stroke: color-mix(in srgb, var(--bh-ink) 50%, transparent); stroke-width: 2; transition: fill .25s ease-out, stroke .25s; }
.en-vis .lane-target.slow { transition: fill 1.2s ease, stroke 1.2s; }
.en-vis .lane-target.on { fill: var(--tc); stroke: var(--tc); }
.en-vis .lane-txt { font-family: var(--font); font-size: 15px; fill: var(--bh-soft); }
@container (max-width: 520px) { .en-vis .en-lanes { grid-template-columns: 1fr; } }
`;

function insetFrame(name, cx, cy, r, inner, id) {
  return `<g class="en-inset" data-inset="${name}" transform="translate(${cx} ${cy})">
    <clipPath id="${id}-clip-${name}"><circle r="${r}"/></clipPath>
    <circle class="en-inset-bg" r="${r}"/>
    <g clip-path="url(#${id}-clip-${name})">${inner}</g>
    <circle class="en-inset-ring" r="${r}"/>
  </g>`;
}

// Inset geometry (stage space)
const IN = {
  receptor: { c: [620, 300], r: 150, zoom: O(176, 140) },
  pituitary: { c: [150, 190], r: 125, zoom: O(120, 47.8) },
  adrenal: { c: [640, 330], r: 128, zoom: O(146, 220.5) },
};

const TRI = 'M-6.5,-5 L6.5,-5 L0,6.5 Z';
function receptorInset() {
  const cups = (cx, cy, r, shape) => [-125, -90, -55].map((a) => {
    const rad = (a * Math.PI) / 180, x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
    const d = shape === 'v' ? 'M-8,-9 L0,0 L8,-9' : 'M-7,-9 L-7,0 L7,0 L7,-9';
    return `<path class="en-rec" d="${d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a + 90})"/>`;
  }).join('');
  return `<rect class="en-tube" x="-170" y="-98" width="340" height="44" rx="8"/>
    <circle class="en-cell" data-cell="a" cx="-64" cy="48" r="50"/><circle class="en-nucleus" cx="-64" cy="56" r="15"/>${cups(-64, 48, 50, 'v')}
    <circle class="en-cell" data-cell="b" cx="70" cy="48" r="50"/><circle class="en-nucleus" cx="70" cy="56" r="15"/>${cups(70, 48, 50, 'sq')}
    <path class="en-hormone en-docked" d="${TRI}" transform="translate(-64 -6)"/>
    <path data-ipath="flow" d="M-170,-76 L170,-76" fill="none"/>
    <path data-ipath="dock" d="M-150,-76 C-110,-76 -64,-66 -64,-6" fill="none"/>`;
}
function pituitaryInset() {
  return `<path class="en-brainmass" d="M-140,20 C-130,-80 -50,-130 20,-126 C90,-122 140,-70 140,0 L140,20 C90,30 50,24 30,12 C16,4 -16,4 -30,12 C-60,28 -100,30 -140,20 Z"/>
    <path class="en-gyri" d="M-110,-20 C-96,-34 -84,-14 -70,-30 C-58,-44 -46,-24 -34,-38 M30,-40 C44,-56 56,-34 70,-50 C82,-62 94,-42 108,-54 M-80,-70 C-66,-84 -50,-66 -36,-82 M40,-92 C54,-102 66,-86 80,-96"/>
    <ellipse class="en-hypo" cx="0" cy="-8" rx="34" ry="19"/>
    <path class="en-stalk" d="M0,10 C1,24 2,34 3,44"/>
    <path class="en-bone" d="M-42,62 C-36,96 42,96 48,62"/>
    <ellipse class="en-pit" cx="3" cy="62" rx="28" ry="20"/>
    <path data-ipath="hp" d="M0,-6 C1,18 2,36 3,56" fill="none"/>
    <path data-ipath="out" d="M3,70 C4,92 6,108 8,130" fill="none"/>`;
}
function adrenalInset() {
  return `<ellipse class="en-kidney" cx="0" cy="150" rx="120" ry="70"/>
    <path class="en-cortex" d="M-96,62 C-86,-14 -34,-82 8,-88 C52,-82 90,-14 98,62 C42,84 -42,84 -96,62 Z"/>
    <path class="en-medulla" d="M-52,44 C-44,-4 -12,-44 8,-48 C32,-44 58,-4 58,44 C22,56 -20,56 -52,44 Z"/>`;
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
      injectBodyCSS();
      injectCSS('en-vis-css', CSS);
      const id = uid('en');
      const targets = Object.entries(TARGETS).map(([k, [x, y]]) => `<circle class="bh-target" data-target="${k}" cx="${x}" cy="${y}" r="3.2"/>`).join('')
        + `<circle class="bh-target" data-target="heart" cx="128" cy="168" r="0"/>`;
      const connector = (name) => {
        const { c, r, zoom } = IN[name];
        const a = Math.atan2(zoom[1] - c[1], zoom[0] - c[0]);
        const sx = c[0] + r * Math.cos(a), sy = c[1] + r * Math.sin(a);
        return `<g class="en-inset" data-inset="${name}"><line class="en-connector" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${zoom[0]}" y2="${zoom[1]}"/><circle class="en-zoomring" cx="${zoom[0]}" cy="${zoom[1]}" r="9"/></g>`;
      };
      const root = document.createElement('div');
      root.className = 'bhv en-vis';
      root.innerHTML = `
        <div class="en-svgwrap">
        <svg class="bh-svg diagram" viewBox="0 0 800 600" role="img" aria-label="Body diagram">
          ${defs(id)}
          <defs>
            <linearGradient id="${id}-fadeg" x1="0" y1="0" x2="0" y2="1"><stop offset=".84" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
            <mask id="${id}-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="600"><rect width="800" height="600" fill="url(#${id}-fadeg)"/></mask>
          </defs>
          <g mask="url(#${id}-fade)">
            <g class="en-body" transform="translate(${TX} ${TY}) scale(${S})">
              ${svg.silhouette(id)}
              <g>${svg.lungs()}${svg.liver('liver organ')}${svg.kidneys('kidneys organ')}${svg.stomach()}${svg.gut()}${svg.bladder()}${svg.heart('heart organ')}</g>
              ${svg.brain('brain')}
              ${svg.vessels('vessels')}
              <g data-part="targets">${targets}</g>
              ${svg.hypothalamus('hypothalamus')}${svg.pineal('pineal')}${svg.pituitary('pituitary')}${svg.thyroid('thyroid')}
              ${svg.adrenals('adrenals')}${svg.pancreas('pancreas')}${svg.ovaries('ovaries')}${svg.testes('testes')}
              ${routePaths()}
              <g class="en-fx"></g>
            </g>
          </g>
          ${connector('receptor')}${connector('pituitary')}${connector('adrenal')}
          ${insetFrame('receptor', ...IN.receptor.c, IN.receptor.r, receptorInset() + '<g class="en-ifx"></g>', id)}
          ${insetFrame('pituitary', ...IN.pituitary.c, IN.pituitary.r, pituitaryInset() + '<g class="en-ifx"></g>', id)}
          ${insetFrame('adrenal', ...IN.adrenal.c, IN.adrenal.r, adrenalInset(), id)}
          <g class="en-labels"></g>
        </svg></div>
        <div class="en-compare" hidden>
          <div class="en-lanes">
            <div class="en-lane">
              <h3>Nervous system</h3>
              <svg viewBox="0 0 300 92" role="img" aria-label="A fast electrical impulse travels along a neuron to a muscle. The muscle responds briefly.">
                <path class="lane-nerve" d="M8,30 L22,40 M8,60 L22,50 M12,46 L22,46"/>
                <circle class="lane-soma" cx="30" cy="46" r="11"/>
                <path class="lane-nerve" data-lane="axon" d="M41,46 L258,46"/>
                ${[60, 104, 148, 192, 236].map((x) => `<rect class="lane-myelin" x="${x}" y="39" width="34" height="14" rx="7"/>`).join('')}
                <circle class="lane-target" data-lt="n" style="--tc: var(--c-pns)" cx="280" cy="46" r="13"/>
                <text class="lane-txt" x="298" y="84" text-anchor="end">muscle</text>
                <g class="lane-fx"></g>
              </svg>
              <p><strong>Very fast</strong> · effect is <strong>short-lived</strong></p>
            </div>
            <div class="en-lane">
              <h3>Endocrine system</h3>
              <svg viewBox="0 0 300 92" role="img" aria-label="A gland releases hormone into a blood vessel. It travels slowly to a target cell, which stays switched on for longer.">
                <circle class="lane-gland" cx="22" cy="46" r="15"/>
                <path class="lane-vessel" data-lane="vessel" d="M38,46 C78,16 108,76 148,46 C188,16 218,76 258,46"/>
                <circle class="lane-target slow" data-lt="e" style="--tc: var(--c-hormone)" cx="280" cy="46" r="13"/>
                <text class="lane-txt" x="22" y="84" text-anchor="middle">gland</text>
                <text class="lane-txt" x="298" y="84" text-anchor="end">target</text>
                <g class="lane-fx"></g>
              </svg>
              <p><strong>Slower</strong> · effect <strong>lasts longer</strong></p>
            </div>
          </div>
          <table>
            <thead><tr><th scope="col"></th><th scope="col">Nervous system</th><th scope="col">Endocrine system</th></tr></thead>
            <tbody>
              <tr><th scope="row">Message</th><td>Electrical impulses (and neurotransmitters at synapses)</td><td>Hormones</td></tr>
              <tr><th scope="row">Travels</th><td>Along neurons</td><td>In the bloodstream</td></tr>
              <tr><th scope="row">Speed</th><td>Very fast</td><td>Slower</td></tr>
              <tr><th scope="row">Effects last</th><td>A short time</td><td>Longer</td></tr>
              <tr><th scope="row">Acts on</th><td>The muscles and glands its neurons reach</td><td>Any target cell with the right receptor</td></tr>
            </tbody>
          </table>
        </div>
        <div class="bh-foot"><p class="vis-caption" aria-hidden="true"></p></div>`;
      container.append(root);

      const svgRoot = root.querySelector('.bh-svg');
      const wrap = root.querySelector('.en-svgwrap');
      const cmp = root.querySelector('.en-compare');
      const cap = root.querySelector('.vis-caption');
      const labels = createLabels(svgRoot.querySelector('.en-labels'), VB);
      const anim = createAnimator(svgRoot.querySelector('.en-fx'));
      const ianim = { receptor: createAnimator(svgRoot.querySelector('[data-inset="receptor"] .en-ifx')), pituitary: createAnimator(svgRoot.querySelector('[data-inset="pituitary"] .en-ifx')) };
      const lanes = [...root.querySelectorAll('.en-lane svg')].map((s) => createAnimator(s.querySelector('.lane-fx')));
      const unwatch = watchScale(svgRoot, VB, (k) => labels.setScale(k));
      const route = (n) => svgRoot.querySelector(`[data-route="${n}"]`);
      const ip = (inset, n) => svgRoot.querySelector(`[data-inset="${inset}"] [data-ipath="${n}"]`);
      const hormone = () => { const p = svgEl('path', { d: TRI, class: 'en-hormone' }); return p; };
      const smallHormone = () => svgEl('path', { d: 'M-2.6,-2 L2.6,-2 L0,2.6 Z', class: 'en-hormone' });
      const ctl = playAgainButton(root.querySelector('.bh-foot'), () => play(current));
      let current = -1;

      const H = { color: 'var(--c-hormone)', r: 2.2, make: smallHormone };
      const hit = (names) => names.forEach((n) => svgRoot.querySelector(`[data-target="${n}"]`)?.classList.add('hit'));
      async function spread(t, out, to, { count = 3 } = {}) {
        await anim.stream(route(out), { ...H, count, spacing: 320, dur: 1500 });
        if (!anim.alive(t)) return;
        await Promise.all(to.map((n) => anim.stream(route(n), { ...H, count: 2, spacing: 380, dur: 1800 })));
        if (!anim.alive(t)) return;
        hit(to.map((n) => n.replace(/^to/, '')));
      }

      async function play(step) {
        const t = anim.clear();
        Object.values(ianim).forEach((a) => a.clear());
        lanes.forEach((a) => a.clear());
        svgRoot.querySelectorAll('.bh-target.hit').forEach((e) => e.classList.remove('hit'));
        svgRoot.querySelectorAll('.en-cell.responds, .en-docked.on').forEach((e) => e.classList.remove('responds', 'on'));
        root.querySelectorAll('.lane-target.on').forEach((e) => e.classList.remove('on'));
        const rm = anim.reduced();
        const all = ['headL', 'headR', 'armL', 'armR', 'legL', 'legR'];
        switch (step) {
          case 0: {
            const outs = ['pituitaryOut', 'thyroidOut', 'adrenalLOut', 'adrenalROut', 'ovaryLOut', 'ovaryROut', 'testisLOut', 'testisROut'];
            await Promise.all([...outs.map((o, i) => anim.stream(route(o), { ...H, count: 2, spacing: 400, dur: 1600, delay: i * 120 })),
              anim.stream(route('pancreasOut'), { ...H, count: 2, spacing: 400, dur: 900 })]);
            if (!anim.alive(t)) return;
            await Promise.all(['armL', 'armR', 'legL', 'legR'].map((n) => anim.stream(route(n), { ...H, count: 2, spacing: 400, dur: 1800 })));
            break;
          }
          case 1: {
            const ia = ianim.receptor;
            const tok = ia.token;
            const big = { color: 'var(--c-hormone)', make: hormone, dur: 3200, linear: true, noTrail: true };
            ia.stream(ip('receptor', 'flow'), { ...big, count: 4, spacing: 900 });
            if (rm) { ia.trail(ip('receptor', 'flow'), { color: 'var(--c-hormone)', r: 4, n: 5 }); }
            await ia.pulse(ip('receptor', 'dock'), { color: 'var(--c-hormone)', make: hormone, dur: 2200, delay: 600, keep: false, noTrail: true });
            if (!ia.alive(tok)) return;
            svgRoot.querySelector('.en-docked').classList.add('on');
            svgRoot.querySelector('[data-cell="a"]').classList.add('responds');
            break;
          }
          case 2: {
            const ia = ianim.pituitary;
            const tok = ia.token;
            await ia.pulse(ip('pituitary', 'hp'), { color: 'var(--c-brainpart)', r: 6, dur: 1200 });
            if (!ia.alive(tok)) return;
            ia.stream(ip('pituitary', 'out'), { color: 'var(--c-gland)', r: 5, count: 3, spacing: 300, dur: 1000 });
            await spread(t, 'pituitaryOut', ['toThyroid', 'toAdrenalL', 'toAdrenalR', 'toOvaryL', 'toOvaryR', 'toTestisL', 'toTestisR']);
            break;
          }
          case 3:
            await spread(t, 'thyroidOut', [...all, 'toLungL']);
            hit(['heart', ...all]);
            break;
          case 4:
            await spread(t, 'adrenalROut', ['armL', 'armR', 'legL', 'legR', 'headL', 'headR']);
            anim.stream(route('adrenalLOut'), { ...H, count: 2, spacing: 320, dur: 1500 });
            break;
          case 5:
            await anim.stream(route('pancreasOut'), { ...H, count: 3, spacing: 300, dur: 1000 });
            if (!anim.alive(t)) return;
            await anim.stream(route('pancreasToHeart'), { ...H, count: 2, spacing: 300, dur: 900 });
            if (!anim.alive(t)) return;
            await Promise.all(['legL', 'legR', 'armL', 'armR'].map((n) => anim.stream(route(n), { ...H, count: 2, spacing: 380, dur: 1800 })));
            hit(['legL', 'legR', 'armL', 'armR']);
            break;
          case 6:
            await Promise.all(['ovaryLOut', 'ovaryROut', 'testisLOut', 'testisROut'].map((o) => anim.stream(route(o), { ...H, count: 2, spacing: 380, dur: 1700 })));
            if (!anim.alive(t)) return;
            await Promise.all(['armL', 'armR', 'legL', 'legR', 'headL', 'headR'].map((n) => anim.stream(route(n), { ...H, count: 1, dur: 1800 })));
            hit(['armL', 'armR', 'legL', 'legR', 'headL', 'headR']);
            break;
          case 7: {
            const [na, ea] = lanes;
            const axon = root.querySelector('[data-lane="axon"]'), vessel = root.querySelector('[data-lane="vessel"]');
            const nt = root.querySelector('[data-lt="n"]'), et = root.querySelector('[data-lt="e"]');
            const tok = na.token;
            if (rm) {
              na.trail(axon, { color: 'var(--c-pns)', r: 4, n: 5 });
              ea.trail(vessel, { color: 'var(--c-hormone)', r: 4, n: 6 });
              et.classList.add('on');
              break;
            }
            // endocrine: a slow stream that keeps the target switched on
            ea.stream(vessel, { color: 'var(--c-hormone)', r: 4.5, count: 5, spacing: 500, dur: 3400, linear: true }).then(() => {});
            ea.wait(3300).then((ok) => { if (ok) et.classList.add('on'); });
            // nervous: three quick impulses, each giving a brief response
            for (let i = 0; i < 3; i++) {
              await na.pulse(axon, { color: 'var(--c-pns)', r: 5, dur: 380, linear: true });
              if (!na.alive(tok)) return;
              nt.classList.add('on');
              await na.wait(450);
              nt.classList.remove('on');
              if (!(await na.wait(800))) return;
            }
            break;
          }
          default:
        }
      }

      return {
        show(step) {
          current = step;
          const isCmp = step === 7;
          const st = step < 0 || step >= STEPS.length ? STEPS[0] : STEPS[step];
          wrap.hidden = isCmp;
          cmp.hidden = !isCmp;
          cap.textContent = step < 0 ? 'The main glands of the endocrine system' : step >= STEPS.length ? 'The glands and the hormones they release' : st.caption;
          if (step >= STEPS.length) {
            labels.set([
              { ...GLAND_LABELS[0], sub: 'controls other glands' }, { ...GLAND_LABELS[1], sub: 'thyroxine' }, { ...GLAND_LABELS[2], sub: 'adrenaline (medulla)\ncortisol (cortex)' },
              { ...GLAND_LABELS[3], sub: '(in females)\noestrogen' }, { ...GLAND_LABELS[5], sub: 'insulin' }, { ...GLAND_LABELS[6], sub: '(in males)\ntestosterone' },
            ]);
            light(svgRoot, ['pituitary', 'thyroid', 'adrenals', 'pancreas', 'ovaries', 'testes', 'vessels']);
          } else if (!isCmp) {
            light(svgRoot, st.on);
            labels.set(st.labels);
          }
          svgRoot.querySelectorAll('.en-inset').forEach((g) => g.classList.toggle('show', !!st.inset && g.dataset.inset === st.inset && step >= 0 && step < STEPS.length));
          // labels for things inside the insets
          if (step === 1) {
            labels.set([
              { at: [620, 224], side: 'manual', x: 620, y: 120, anchor: 'middle', text: 'Hormones in the blood', color: 'var(--c-hormone)' },
              { at: [556, 398], side: 'manual', x: 556, y: 495, anchor: 'middle', text: 'Target cell', sub: 'right receptor:\nit responds', short: 'Target\ncell', color: 'var(--c-hormone)' },
              { at: [690, 398], side: 'manual', x: 708, y: 495, anchor: 'middle', text: 'Not a target', sub: 'no matching\nreceptor', short: 'Not a\ntarget', color: 'var(--bh-soft)' },
            ]);
          } else if (step === 2) {
            labels.set([...st.labels,
              { at: [150, 182], side: 'manual', x: 150, y: 36, anchor: 'middle', text: 'Hypothalamus', sub: 'part of the brain', color: 'var(--c-brainpart)' },
              { at: [153, 262], side: 'manual', x: 150, y: 352, anchor: 'middle', text: 'Pituitary gland', sub: 'the “master gland”', color: 'var(--c-gland)' },
            ]);
          } else if (step === 4) {
            labels.set([...st.labels,
              { at: [598, 300], side: 'manual', x: 640, y: 168, anchor: 'middle', text: 'Adrenal cortex', sub: 'outer layer → cortisol', short: 'Cortex:\ncortisol', color: 'var(--c-gland)' },
              { at: [646, 340], side: 'manual', x: 640, y: 500, anchor: 'middle', text: 'Adrenal medulla', sub: 'middle → adrenaline', short: 'Medulla:\nadrenaline', color: 'var(--c-sym)' },
            ]);
          }
          const text = cap.textContent;
          svgRoot.setAttribute('aria-label', `Body diagram on a dark background. ${text}.`);
          ctl.show(step >= 0 && step < STEPS.length);
          if (step >= 0 && step < STEPS.length) play(step);
          else { anim.clear(); Object.values(ianim).forEach((a) => a.clear()); }
        },
        dispose() { anim.clear(); Object.values(ianim).forEach((a) => a.clear()); lanes.forEach((a) => a.clear()); unwatch(); root.remove(); },
      };
    },
  },
};
