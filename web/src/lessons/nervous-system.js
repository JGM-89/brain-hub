// The nervous system — AQA 7182 4.2.1: "The divisions of the nervous system:
// central and peripheral (somatic and autonomic)."
// Visual: an expandable tree of the divisions, linked to a front-view body.
// Choosing a branch (or moving to a step) lights up that division on the body.
import {
  svg, defs, NERVES, AUTONOMIC, ANAT, light, watchScale, createLabels, createAnimator,
  injectBodyCSS, injectCSS, playAgainButton, uid,
} from './shared/body.js';

const NODES = {
  ns: { name: 'Nervous system', sub: 'carries messages, mainly as electrical signals', colour: 'var(--bh-ink)', kids: ['cns', 'pns'], crumb: ['ns'] },
  cns: { name: 'Central nervous system (CNS)', sub: 'brain + spinal cord', colour: 'var(--c-cns)', crumb: ['ns', 'cns'] },
  pns: { name: 'Peripheral nervous system (PNS)', sub: 'all the other nerves', colour: 'var(--c-pns)', kids: ['som', 'aut'], crumb: ['ns', 'pns'] },
  som: { name: 'Somatic', sub: 'senses, skeletal muscles, reflexes', colour: 'var(--c-pns)', crumb: ['ns', 'pns', 'som'] },
  aut: { name: 'Autonomic', sub: 'internal organs, automatic', colour: 'var(--c-aut)', kids: ['sym', 'para'], crumb: ['ns', 'pns', 'aut'] },
  sym: { name: 'Sympathetic', sub: 'arousal: fight or flight', colour: 'var(--c-sym)', crumb: ['ns', 'pns', 'aut', 'sym'] },
  para: { name: 'Parasympathetic', sub: 'rest and digest', colour: 'var(--c-para)', crumb: ['ns', 'pns', 'aut', 'para'] },
};
const SHORT = { ns: 'Nervous system', cns: 'CNS', pns: 'PNS', som: 'Somatic', aut: 'Autonomic', sym: 'Sympathetic', para: 'Parasympathetic' };

// What each division looks like on the body. Coordinates are body space (= the SVG's own space here).
const ARM_R = [190, 200], LEG_L = [97, 420];
const STATES = {
  ns: {
    on: ['cns', 'som', 'aut'], nerve: { som: 'pns', sym: 'pns', para: 'pns' },
    caption: 'The two main parts: the CNS and the PNS',
    labels: [
      { at: [120, 120], side: 'left', y: 120, text: 'Central nervous\nsystem (CNS)', short: 'CNS', sub: 'brain + spinal cord', color: 'var(--c-cns)' },
      { at: ARM_R, side: 'right', text: 'Peripheral\nnervous\nsystem (PNS)', short: 'PNS', sub: 'all the other\nnerves', color: 'var(--c-pns)' },
    ],
  },
  cns: {
    on: ['cns'], nerve: { som: 'pns', sym: 'pns', para: 'pns' },
    caption: 'The CNS: the brain and the spinal cord',
    labels: [
      { at: [97, 26], side: 'left', y: 26, text: 'Brain', color: 'var(--c-cns)' },
      { at: [120, 165], side: 'left', y: 165, text: 'Spinal cord', sub: 'inside the\nbackbone', color: 'var(--c-cns)' },
    ],
  },
  pns: {
    on: ['som', 'aut'], nerve: { som: 'pns', sym: 'pns', para: 'pns' },
    caption: 'The PNS: nerves carry messages to and from the CNS',
    labels: [
      { at: ARM_R, side: 'right', text: 'Nerves in\nthe arm', color: 'var(--c-pns)' },
      { at: LEG_L, side: 'left', text: 'Nerves in\nthe leg', color: 'var(--c-pns)' },
      { at: [86, 184], side: 'left', y: 184, text: 'Nerves to\nthe chest', color: 'var(--c-pns)' },
    ],
  },
  som: {
    on: ['som', 'muscles'], nerve: { som: 'pns', sym: 'pns', para: 'pns' },
    caption: 'Somatic: a message comes in from the skin, and a message goes out to a muscle',
    labels: [
      { at: [211, 345], side: 'right', y: 330, text: 'Sensory nerve', sub: 'skin → CNS', color: 'var(--c-pns)' },
      { at: [57, 178], side: 'left', y: 178, text: 'Motor nerve', sub: 'CNS → muscle', color: 'var(--c-muscle)' },
      { at: [143, 372], side: 'right', y: 420, text: 'Skeletal\nmuscle', color: 'var(--c-muscle)' },
    ],
  },
  aut: {
    on: ['aut', 'organ', 'eyes'], nerve: { som: 'pns', sym: 'aut', para: 'aut' },
    caption: 'Autonomic: nerves to the internal organs, working automatically',
    labels: [
      { at: ANAT.eyeL, side: 'left', y: 40, text: 'Pupils', color: 'var(--c-aut)' },
      { at: [96, 160], side: 'left', text: 'Lungs', color: 'var(--c-aut)' },
      { at: [108, 270], side: 'left', text: 'Intestines', color: 'var(--c-aut)' },
      { at: [132, 172], side: 'right', y: 160, text: 'Heart', color: 'var(--c-aut)' },
      { at: [144, 208], side: 'right', y: 215, text: 'Stomach', color: 'var(--c-aut)' },
      { at: [126, 305], side: 'right', y: 300, text: 'Bladder', color: 'var(--c-aut)' },
    ],
  },
  sym: {
    on: ['sym', 'organ', 'eyes', 'adrenals'], nerve: { som: 'pns', sym: 'sym', para: 'para' },
    caption: 'Sympathetic: the body gets ready for action',
    labels: [
      { at: ANAT.eyeL, side: 'left', y: 40, text: 'Pupils', sub: 'get wider', short: 'Wider pupils', color: 'var(--c-sym)' },
      { at: [114, 66], side: 'left', y: 100, text: 'Mouth', sub: 'less saliva', short: 'Less saliva', color: 'var(--c-sym)' },
      { at: [96, 160], side: 'left', y: 165, text: 'Lungs', sub: 'breathing\nspeeds up', short: 'Faster\nbreathing', color: 'var(--c-sym)' },
      { at: [108, 270], side: 'left', text: 'Intestines', sub: 'digestion\nslows down', short: 'Slower\ndigestion', color: 'var(--c-sym)' },
      { at: [132, 172], side: 'right', y: 150, text: 'Heart', sub: 'beats faster', short: 'Faster\nheart', color: 'var(--c-sym)' },
      { at: [148, 220], side: 'right', y: 240, text: 'Adrenal\nglands', sub: 'release\nadrenaline', short: 'Adrenaline', color: 'var(--c-sym)' },
    ],
  },
  para: {
    on: ['para', 'organ', 'eyes'], nerve: { som: 'pns', sym: 'sym', para: 'para' },
    caption: 'Parasympathetic: the body rests and digests',
    labels: [
      { at: ANAT.eyeL, side: 'left', y: 40, text: 'Pupils', sub: 'get smaller', short: 'Smaller\npupils', color: 'var(--c-para)' },
      { at: [114, 66], side: 'left', y: 100, text: 'Mouth', sub: 'more saliva', short: 'More saliva', color: 'var(--c-para)' },
      { at: [96, 160], side: 'left', y: 165, text: 'Lungs', sub: 'breathing\nslows down', short: 'Slower\nbreathing', color: 'var(--c-para)' },
      { at: [108, 270], side: 'left', text: 'Intestines', sub: 'digestion\nstarts again', short: 'Digestion\nrestarts', color: 'var(--c-para)' },
      { at: [132, 172], side: 'right', y: 150, text: 'Heart', sub: 'slows down', short: 'Slower\nheart', color: 'var(--c-para)' },
      { at: [113, 110], side: 'right', y: 70, text: 'Vagus nerve', sub: 'from the\nbrainstem', color: 'var(--c-para)' },
    ],
  },
};

// step index -> which node is chosen and which branches are open
const STEP_TREE = [
  { node: 'ns', open: [] },
  { node: 'cns', open: [] },
  { node: 'pns', open: ['pns'] },
  { node: 'som', open: ['pns'] },
  { node: 'aut', open: ['pns', 'aut'] },
  { node: 'sym', open: ['pns', 'aut'] },
  { node: 'para', open: ['pns', 'aut'] },
  { node: 'sym', open: ['pns', 'aut'], compare: true },
];

const CSS = `
.ns-vis { container-type: size; container-name: nsvis; }
.ns-vis .ns-grid { flex:1 1 auto; min-height:0; display:grid; grid-template-columns: minmax(220px, 43%) minmax(0, 1fr); }
.ns-vis .ns-tree { overflow:auto; padding: 16px 4px 16px 16px; border-right: 1px solid var(--line); background: var(--bh-panel); }
.ns-vis .ns-tree-title { font-size: .85rem; font-weight: 700; color: var(--bh-soft); margin: 0 0 8px; }
.ns-vis .ns-ul { list-style:none; margin:0; padding:0; }
.ns-vis .ns-ul .ns-ul { margin-left: 12px; }
.ns-vis .ns-ul .ns-ul > li { position:relative; padding: 6px 0 0 18px; }
.ns-vis .ns-ul .ns-ul > li::before { content:''; position:absolute; left:0; top:0; bottom:0; border-left: 2px solid color-mix(in srgb, var(--ink) 22%, transparent); }
.ns-vis .ns-ul .ns-ul > li:last-child::before { bottom:auto; height: 30px; }
.ns-vis .ns-ul .ns-ul > li::after { content:''; position:absolute; left:0; top: 30px; width: 16px; border-top: 2px solid color-mix(in srgb, var(--ink) 22%, transparent); }
.ns-vis .ns-node { width:100%; justify-content:flex-start; text-align:left; gap:10px; padding: 6px 10px; min-height:48px; border-radius: 12px;
  border: 2px solid color-mix(in srgb, var(--nc) 35%, var(--line)); background: var(--surface); color: var(--ink); line-height:1.25; }
.ns-vis .ns-node .ns-dot { flex:none; width:14px; height:14px; border-radius:50%; background: var(--nc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--nc) 20%, transparent); }
.ns-vis .ns-node .ns-txt { display:flex; flex-direction:column; min-width:0; }
.ns-vis .ns-node .ns-name { font-weight:700; font-size:.88rem; }
.ns-vis .ns-node .ns-sub { font-size:.78rem; color: var(--ink-soft); }
.ns-vis .ns-node .ns-chev { margin-left:auto; flex:none; font-size:.8rem; color: var(--ink-soft); transition: transform .25s; }
.ns-vis .ns-node[aria-expanded="true"] .ns-chev { transform: rotate(90deg); }
.ns-vis .ns-tree .ns-node[aria-pressed="true"] { background: color-mix(in srgb, var(--nc) 16%, var(--surface)); border-color: var(--nc); color: var(--ink); box-shadow: 0 2px 10px color-mix(in srgb, var(--nc) 22%, transparent); }
.ns-vis .ns-tree .ns-node[aria-pressed="true"] .ns-sub { color: var(--ink); }
.ns-vis .ns-bodypanel { position:relative; display:flex; flex-direction:column; min-width:0; min-height:0; }
.ns-vis .ns-crumb { display:none; margin: 10px 14px 0; font-size:.85rem; font-weight:700; color: var(--bh-soft); }
.ns-vis .ns-crumb b { color: var(--bh-ink); }
.ns-vis .ns-bodypanel .vis-controls { position: static; gap: 8px; padding: 10px 12px 0; }
.ns-vis .vis-controls button { min-height:44px; font-size:.85rem; padding: 0 12px; }
.ns-vis .vis-controls button[data-cmp][aria-pressed="true"] { background: color-mix(in srgb, var(--cc) 18%, var(--surface)); border-color: var(--cc); color: var(--ink); }
.ns-vis .bh-nerve.som { --nc: var(--ns-som, var(--c-pns)); }
.ns-vis .bh-nerve.sym { --nc: var(--ns-sym, var(--c-sym)); }
.ns-vis .bh-nerve.para { --nc: var(--ns-para, var(--c-para)); }
@container nsvis (max-width: 560px) {
  .ns-vis .ns-grid { grid-template-columns: 1fr; }
  .ns-vis .ns-tree { display:none; }
  .ns-vis .ns-crumb { display:block; }
}
`;

function nodeButton(id) {
  const n = NODES[id];
  const kids = n.kids && id !== 'ns';
  return `<button type="button" class="ns-node" data-node="${id}" aria-pressed="false" ${kids ? `aria-expanded="false" aria-controls="ns-kids-${id}"` : ''} style="--nc:${n.colour}">
    <span class="ns-dot" aria-hidden="true"></span>
    <span class="ns-txt"><span class="ns-name">${n.name}</span><span class="ns-sub">${n.sub}</span></span>
    ${kids ? '<span class="ns-chev" aria-hidden="true">▸</span>' : ''}</button>`;
}

const N = (d, cls, part, name = '') => `<path d="${d}" class="bh-nerve ${cls}" data-part="${part}" ${name ? `data-n="${name}"` : ''}/>`;

function bodyMarkup(id) {
  const somatic = [
    N(NERVES.arm[0], 'som', 'som pns', 'armL'), N(NERVES.arm[1], 'som', 'som pns', 'armR'),
    ...NERVES.hand.map((d) => N(d, 'som fine', 'som pns')),
    ...NERVES.armBranch.map((d) => N(d, 'som fine', 'som pns')),
    N(NERVES.leg[0], 'som', 'som pns', 'legL'), N(NERVES.leg[1], 'som', 'som pns', 'legR'),
    ...NERVES.femoral.map((d) => N(d, 'som fine', 'som pns')),
    ...NERVES.ribs.map((d) => N(d, 'som fine', 'som pns')),
    ...NERVES.face.map((d, i) => N(d, 'som fine', 'som pns', `face${i}`)),
    ...NERVES.neck.map((d) => N(d, 'som fine', 'som pns')),
  ].join('');
  const symKeys = ['symEye', 'symSaliva', 'symLung', 'symHeart', 'symLiver', 'symStomach', 'symAdrenal', 'symGut', 'symBladder'];
  const paraKeys = ['vagus', 'paraLung', 'paraEye', 'paraSaliva', 'sacral'];
  const autonomic = [
    ...AUTONOMIC.chain.map((d) => N(d, 'sym chain', 'sym aut')),
    ...symKeys.flatMap((k) => AUTONOMIC[k].map((d, i) => N(d, 'sym', 'sym aut', `${k}${i}`))),
    ...paraKeys.flatMap((k) => AUTONOMIC[k].map((d, i) => N(d, 'para', 'para aut', `${k}${i}`))),
  ].join('');
  return `${defs(id)}
    ${svg.silhouette(id)}
    <g class="ns-organs">
      ${svg.lungs()}${svg.liver()}${svg.kidneys('kidneys')}${svg.adrenals('adrenals')}${svg.stomach()}${svg.gut()}${svg.bladder()}${svg.heart()}${svg.muscles('muscles')}${svg.eyes('eyes')}
    </g>
    <g class="ns-aut">${autonomic}</g>
    <g class="ns-som">${somatic}</g>
    ${svg.cord()}${svg.brain()}
    <path data-n="cordRoute" d="M120,14 L120,236" fill="none" stroke="none"/>
    <g class="ns-fx"></g>
    <g class="ns-labels"></g>`;
}

export default {
  id: 'nervous-system',
  title: 'The nervous system',
  objectives: [
    'Name the two main parts of the nervous system and say what is in each one.',
    'Explain the difference between the somatic and autonomic nervous systems.',
    'Describe what the sympathetic and parasympathetic systems do, without mixing them up.',
  ],
  keywords: [
    { term: 'Central nervous system (CNS)', simple: 'The brain and the spinal cord.', exam: 'Made up of the brain and spinal cord. The brain is the centre of conscious awareness; the spinal cord relays information between the brain and the rest of the body.' },
    { term: 'Peripheral nervous system (PNS)', simple: 'All the nerves outside the brain and spinal cord.', exam: 'Transmits messages, via millions of neurons, to and from the CNS. It is divided into the somatic and autonomic nervous systems.' },
    { term: 'Somatic nervous system', simple: 'The nerves that connect your senses and skeletal muscles to the CNS. You can mostly control it.', exam: 'Transmits information from sense organs to the CNS and from the CNS to skeletal muscles. Mostly voluntary; also involved in reflex arcs.' },
    { term: 'Autonomic nervous system', simple: 'The nerves that control your internal organs automatically, without you thinking.', exam: 'Governs vital involuntary functions such as heart rate, breathing, digestion and stress responses. Divided into the sympathetic and parasympathetic branches.' },
    { term: 'Sympathetic nervous system', simple: 'The part of the autonomic system that gets your body ready for action (fight or flight).', exam: 'The branch of the autonomic nervous system that increases arousal, for example raising heart rate and inhibiting digestion, as part of the fight or flight response.' },
    { term: 'Parasympathetic nervous system', simple: 'The part of the autonomic system that calms your body down (rest and digest).', exam: 'The branch of the autonomic nervous system that returns the body to its resting state; antagonistic to the sympathetic nervous system.' },
  ],
  steps: [
    {
      title: 'Two main parts',
      simple: `<p>Your <span class="keyterm">nervous system</span> carries messages around your body, mainly as electrical signals.</p>
        <p>It has two main parts:</p>
        <ul>
          <li>the <strong>central nervous system (CNS)</strong>: your brain and spinal cord;</li>
          <li>the <strong>peripheral nervous system (PNS)</strong>: all the nerves that connect the CNS to the rest of your body.</li>
        </ul>
        <p>Choose a part of the tree to see it on the body.</p>`,
      exam: '<p>The nervous system is a network of nerve cells (neurons). It has two main jobs: to collect, process and respond to information from the environment, and to coordinate the working of different organs and cells in the body.</p>',
    },
    {
      title: 'The central nervous system',
      simple: `<p>The <span class="keyterm">CNS</span> is made of the <strong>brain</strong> and the <strong>spinal cord</strong>.</p>
        <p>The <strong>brain</strong> makes decisions. Thinking, memory and conscious awareness happen here.</p>
        <p>The <strong>spinal cord</strong> runs down inside your backbone. It passes messages between the brain and the rest of the body.</p>`,
      exam: '<p>The spinal cord is an extension of the brain. It is connected to different parts of the body by pairs of spinal nerves. It is also responsible for simple reflexes that do not involve the brain, such as pulling your hand away from something hot.</p>',
    },
    {
      title: 'The peripheral nervous system',
      simple: `<p>The <span class="keyterm">PNS</span> is all the nerves outside the brain and spinal cord.</p>
        <p>It carries messages <strong>to</strong> the CNS from your senses and organs. It also carries messages <strong>from</strong> the CNS out to your muscles and glands.</p>
        <p>The PNS has two parts: the <strong>somatic</strong> and the <strong>autonomic</strong> nervous systems.</p>`,
      exam: '<p>The PNS sends information to the CNS from the outside world, and transmits messages from the CNS to muscles and glands in the body.</p>',
    },
    {
      title: 'The somatic nervous system',
      simple: `<p>The <span class="keyterm">somatic nervous system</span> connects the CNS to your <strong>senses</strong> and your <strong>skeletal muscles</strong> (the muscles that move your bones).</p>
        <p>It is mostly <strong>voluntary</strong>: you choose what to do.</p>
        <p>Examples:</p>
        <ul>
          <li>feeling that a mug is hot (senses → CNS);</li>
          <li>picking up a pen (CNS → muscles);</li>
          <li>a <strong>reflex</strong>, like pulling your hand away from a hot pan.</li>
        </ul>`,
      exam: '<p>The somatic system carries sensory information from receptors to the CNS, and motor commands from the CNS to skeletal muscles. Reflexes are not voluntary, but they still use the somatic system: a reflex arc goes through the spinal cord without waiting for the brain, so it is very fast.</p>',
    },
    {
      title: 'The autonomic nervous system',
      simple: `<p>The <span class="keyterm">autonomic nervous system</span> controls your <strong>internal organs</strong>, such as your heart, lungs, stomach and glands.</p>
        <p>It is <strong>involuntary</strong>: it works automatically, without you thinking about it. "Autonomic" sounds like "automatic".</p>
        <p>Examples: heart rate, breathing rate, digestion, sweating and the size of your pupils.</p>`,
      exam: '<p>The autonomic system is needed because vital functions must keep going without conscious thought, including when we are asleep. It has two branches, the sympathetic and parasympathetic, and many organs receive nerves from both.</p>',
      callout: { type: 'exam', title: 'Exam tip', html: '<p>To “outline the divisions of the nervous system”, work down the tree: CNS and PNS, then somatic and autonomic, then sympathetic and parasympathetic. Give one function for each.</p>' },
    },
    {
      title: 'The sympathetic nervous system',
      simple: `<p>The <span class="keyterm">sympathetic nervous system</span> gets your body ready for action. This is called <strong>arousal</strong>.</p>
        <p>It is switched on when you are stressed or in danger. It is part of the <strong>fight or flight</strong> response.</p>
        <p>It makes your heart beat faster, speeds up your breathing, widens your pupils and slows down digestion.</p>`,
      exam: '<p>The sympathetic system also stimulates the adrenal medulla to release adrenaline into the bloodstream (see the fight or flight lesson). Sympathetic nerves leave the middle section of the spinal cord.</p>',
    },
    {
      title: 'The parasympathetic nervous system',
      simple: `<p>The <span class="keyterm">parasympathetic nervous system</span> calms your body down. It is often called the <strong>rest and digest</strong> system.</p>
        <p>It works when you are relaxed. It also takes over when a threat has gone.</p>
        <p>It slows your heart rate and breathing, makes your pupils smaller and starts digestion again.</p>`,
      exam: '<p>The two branches are <strong>antagonistic</strong>: they have opposite effects on the same organs. Parasympathetic nerves leave the brainstem (for example the vagus nerve, which reaches the heart, lungs and gut) and the bottom of the spinal cord.</p>',
    },
    {
      title: 'Don’t mix them up',
      simple: `<p>The two parts of the autonomic system are easy to mix up. Here is a way to remember them:</p>
        <ul>
          <li><strong>S</strong>ympathetic = <strong>S</strong>tress. It <strong>speeds you up</strong>.</li>
          <li><strong>P</strong>arasympathetic = <strong>P</strong>eace. It <strong>calms you down</strong>.</li>
        </ul>
        <p>Use the two buttons on the body to compare them.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Students often mix up the sympathetic and parasympathetic systems. Fight or flight is caused by the <strong>sympathetic</strong> system. The <strong>parasympathetic</strong> system brings the body back to rest.</p>' },
    },
  ],
  quiz: [
    { q: 'Which two structures make up the central nervous system?', options: ['The brain and the spinal cord', 'The brain and the nerves', 'The spinal cord and the nerves', 'The brain and the heart'], answer: 0, explain: 'The CNS is the brain and the spinal cord. Everything else is the PNS.', hint: '“Central” means in the middle. Which parts run down the middle of your body?' },
    { q: 'You decide to pick up a pen. Which division sends the message to your arm muscles?', options: ['Somatic nervous system', 'Autonomic nervous system', 'Sympathetic nervous system', 'Parasympathetic nervous system'], answer: 0, explain: 'The somatic system controls skeletal muscles, which you move by choice.', hint: 'Is this something you choose to do, or something that happens automatically?' },
    { q: 'A dog runs towards you and your heart starts to beat faster. Which division causes this?', options: ['Parasympathetic', 'Sympathetic', 'Somatic', 'Central'], answer: 1, explain: 'The sympathetic system increases arousal as part of fight or flight. S = Stress.', hint: 'S is for Stress, P is for Peace.' },
    { q: 'After a scare, your breathing slows down and you feel hungry again. Which division is working now?', options: ['Sympathetic', 'Somatic', 'Parasympathetic', 'Central'], answer: 2, explain: 'The parasympathetic system returns the body to rest: rest and digest.', hint: 'Which system is called “rest and digest”?' },
    { q: 'Which statement describes the autonomic nervous system?', options: ['It is voluntary and moves skeletal muscles', 'It is part of the CNS', 'It is involuntary and controls internal organs', 'It is made of the brain only'], answer: 2, explain: 'The autonomic system works automatically and controls organs such as the heart and stomach.', hint: '“Autonomic” sounds like “automatic”.' },
  ],
  summary: [
    'CNS = brain + spinal cord. PNS = all the nerves outside the CNS.',
    'PNS → somatic (senses, skeletal muscles, reflexes; mostly voluntary) and autonomic (internal organs; involuntary).',
    'Autonomic → sympathetic (S = Stress: fight or flight) and parasympathetic (P = Peace: rest and digest).',
  ],
  visual: {
    dark: false,
    async create(container) {
      injectBodyCSS();
      injectCSS('ns-vis-css', CSS);
      const id = uid('ns');
      const VB = { x: -150, y: -10, w: 540, h: 620 };
      const root = document.createElement('div');
      root.className = 'bhv ns-vis';
      root.innerHTML = `
        <div class="ns-grid">
          <nav class="ns-tree" aria-label="Divisions of the nervous system">
            <p class="ns-tree-title">Choose a part to see it on the body</p>
            <ul class="ns-ul">
              <li>${nodeButton('ns')}
                <ul class="ns-ul">
                  <li>${nodeButton('cns')}</li>
                  <li>${nodeButton('pns')}
                    <ul class="ns-ul" id="ns-kids-pns" data-kids="pns" hidden>
                      <li>${nodeButton('som')}</li>
                      <li>${nodeButton('aut')}
                        <ul class="ns-ul" id="ns-kids-aut" data-kids="aut" hidden>
                          <li>${nodeButton('sym')}</li>
                          <li>${nodeButton('para')}</li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>
          <div class="ns-bodypanel">
            <p class="ns-crumb" aria-hidden="true"></p>
            <svg class="bh-svg diagram" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Body diagram">${bodyMarkup(id)}</svg>
            <p class="vis-caption" aria-hidden="true"></p>
          </div>
        </div>`;
      container.append(root);

      const tree = root.querySelector('.ns-tree');
      const panel = root.querySelector('.ns-bodypanel');
      const svgRoot = root.querySelector('svg');
      const cap = root.querySelector('.vis-caption');
      const crumb = root.querySelector('.ns-crumb');
      const labels = createLabels(svgRoot.querySelector('.ns-labels'), VB);
      const anim = createAnimator(svgRoot.querySelector('.ns-fx'));
      const unwatch = watchScale(svgRoot, VB, (k) => labels.setScale(k));
      const q = (n) => svgRoot.querySelector(`[data-n="${n}"]`);

      // controls: play again + (last step) compare buttons
      const ctl = playAgainButton(panel, () => run(current, true));
      panel.insertBefore(ctl.bar, svgRoot); // in the flow, so it never covers a label
      const cmpBtns = ['sym', 'para'].map((n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.cmp = n;
        b.style.setProperty('--cc', NODES[n].colour);
        b.setAttribute('aria-pressed', 'false');
        b.textContent = n === 'sym' ? 'S: Sympathetic' : 'P: Parasympathetic';
        b.addEventListener('click', () => { setNode(n); run(n, true); });
        ctl.button.before(b);
        return b;
      });

      let current = 'ns', compare = false;
      const open = { pns: false, aut: false };

      function setOpen(n, on) {
        open[n] = on;
        tree.querySelector(`[data-kids="${n}"]`).hidden = !on;
        tree.querySelector(`[data-node="${n}"]`).setAttribute('aria-expanded', String(on));
      }
      function setNode(n) {
        current = n;
        tree.querySelectorAll('.ns-node').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.node === n)));
        cmpBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cmp === n)));
        crumb.innerHTML = NODES[n].crumb.map((c, i, a) => (i === a.length - 1 ? `<b>${SHORT[c]}</b>` : SHORT[c])).join(' › ');
      }

      async function run(n, animate) {
        const st = STATES[n];
        light(svgRoot, st.on);
        for (const [k, v] of Object.entries(st.nerve)) svgRoot.style.setProperty(`--ns-${k}`, `var(--c-${v})`);
        labels.set(st.labels);
        let text = st.caption;
        if (compare && n === 'sym') text = 'S = Stress: the sympathetic system speeds you up';
        if (compare && n === 'para') text = 'P = Peace: the parasympathetic system calms you down';
        cap.textContent = text;
        svgRoot.setAttribute('aria-label', `Body diagram. ${text}. Labels: ${st.labels.map((l) => `${l.text.replace(/\n/g, ' ')}${l.sub ? ` (${l.sub.replace(/\n/g, ' ')})` : ''}`).join('; ')}.`);
        ctl.show(true);
        const t = anim.clear();
        if (!animate) return;
        const c = (v) => `var(--c-${v})`;
        if (n === 'ns' || n === 'cns') {
          await anim.pulse(q('cordRoute'), { color: c('cns'), dur: 1300, r: 3.4 });
          if (!anim.alive(t) || n === 'cns') return;
          ['armL', 'armR', 'legL', 'legR'].forEach((p) => anim.pulse(q(p), { color: c('pns'), dur: 1700 }));
        } else if (n === 'pns') {
          ['armL', 'armR', 'legL', 'legR'].forEach((p, i) => anim.stream(q(p), { color: c('pns'), dur: 1700, count: 2, spacing: 700, reverse: i % 2 === 1 }));
          ['face0', 'face1', 'face2', 'face3'].forEach((p) => anim.pulse(q(p), { color: c('pns'), dur: 900, reverse: true, delay: 400 }));
        } else if (n === 'som') {
          await anim.pulse(q('armR'), { color: c('pns'), dur: 1600, reverse: true, r: 3.2 });
          if (!anim.alive(t)) return;
          await anim.pulse(q('armL'), { color: c('muscle'), dur: 1600, r: 3.2 });
          if (!anim.alive(t)) return;
          if (anim.reduced()) return;
          const m = svgRoot.querySelectorAll('.bh-muscle')[0];
          m?.classList.remove('bh-arrive'); void m?.getBBox(); m?.classList.add('bh-arrive');
        } else if (n === 'aut' || n === 'sym' || n === 'para') {
          const names = [...svgRoot.querySelectorAll(n === 'para' ? '.bh-nerve.para[data-n]' : n === 'sym' ? '.bh-nerve.sym[data-n]' : '.bh-nerve[data-part~="aut"][data-n]')].map((e) => e.dataset.n);
          names.forEach((p, i) => anim.pulse(q(p), { color: c(n === 'aut' ? 'aut' : n), dur: p.startsWith('vagus') ? 2600 : 1300, delay: (i % 4) * 180 }));
        }
      }

      tree.addEventListener('click', (e) => {
        const b = e.target.closest('.ns-node');
        if (!b) return;
        const n = b.dataset.node;
        if (n === current && NODES[n].kids && n !== 'ns') { setOpen(n, !open[n]); return; }
        if (NODES[n].kids && n !== 'ns') setOpen(n, true);
        setNode(n);
        run(n, true);
      });

      return {
        show(step) {
          const s = step < 0 ? { node: 'ns', open: [] } : step >= STEP_TREE.length ? { node: 'ns', open: ['pns', 'aut'] } : STEP_TREE[step];
          compare = !!s.compare;
          cmpBtns.forEach((b) => { b.hidden = !compare; });
          setOpen('pns', s.open.includes('pns'));
          setOpen('aut', s.open.includes('aut'));
          setNode(s.node);
          run(s.node, step >= 0 && step < STEP_TREE.length);
        },
        dispose() { anim.clear(); unwatch(); root.remove(); },
      };
    },
  },
};
