// The nervous system — AQA 7182 4.2.1: "The divisions of the nervous system:
// central and peripheral (somatic and autonomic)."
// Visual: a real 3D human body (BodyParts3D, CC BY 4.0) with a tree of the divisions beside it.
// Choosing a branch (or moving to a step) lights up that division in 3D and sends signals along it.
// The spinal cord and the peripheral nerves are drawn along real landmarks (BodyParts3D has no
// spinal cord or body-wide nerves); see src/data/body-provenance.json.
import { bodyStage, C } from '../three/body3d.js';

const NODES = {
  ns: { name: 'Nervous system', sub: 'carries messages, mainly as electrical signals', colour: '#E8ECF8', kids: ['cns', 'pns'], crumb: ['ns'] },
  cns: { name: 'Central nervous system (CNS)', sub: 'brain + spinal cord', colour: C.cns, crumb: ['ns', 'cns'] },
  pns: { name: 'Peripheral nervous system (PNS)', sub: 'all the other nerves', colour: C.pns, kids: ['som', 'aut'], crumb: ['ns', 'pns'] },
  som: { name: 'Somatic', sub: 'senses, skeletal muscles, reflexes', colour: C.pns, crumb: ['ns', 'pns', 'som'] },
  aut: { name: 'Autonomic', sub: 'internal organs, automatic', colour: C.aut, kids: ['sym', 'para'], crumb: ['ns', 'pns', 'aut'] },
  sym: { name: 'Sympathetic', sub: 'arousal: fight or flight', colour: C.sym, crumb: ['ns', 'pns', 'aut', 'sym'] },
  para: { name: 'Parasympathetic', sub: 'rest and digest', colour: C.para, crumb: ['ns', 'pns', 'aut', 'para'] },
};
const SHORT = { ns: 'Nervous system', cns: 'CNS', pns: 'PNS', som: 'Somatic', aut: 'Autonomic', sym: 'Sympathetic', para: 'Parasympathetic' };

const AUT_ORGANS = ['eyes', 'salivary', 'lungs', 'heart', 'stomach', 'intestines', 'bladder', 'liver'];

// What each division looks like on the 3D body
const STATES = {
  ns: {
    caption: 'The two main parts: the CNS and the PNS',
    spec: { lit: { cns: C.cns }, nerves: { 'nerves:all': C.pns } },
    frame: { parts: ['skin'], dir: [0, 0.04, 1] },
    labels: [
      { at: 'cerebrum', side: 'left', text: 'Central nervous system (CNS)', short: 'CNS', sub: 'brain + spinal cord', color: C.cns },
      { at: { at: 'spinal_cord', offset: [0, -60, 0] }, side: 'left', text: 'Spinal cord', color: C.cns },
      { at: 'arm_left', side: 'right', text: 'Peripheral nervous system (PNS)', short: 'PNS', sub: 'all the other nerves', color: C.pns },
    ],
    async play(v, tok) {
      await v.flow('cns_down', { color: C.cns, speed: 650, size: 11 });
      if (!v.alive(tok)) return;
      ['arm_left', 'arm_right', 'leg_left', 'leg_right'].forEach((n) => v.flow(n, { color: C.pns, speed: 520, size: 10, track: false }));
    },
  },
  cns: {
    caption: 'The CNS: the brain and the spinal cord',
    spec: { lit: { cns: C.cns }, bones: 1.8 },
    frame: { parts: ['skull', 'pelvis'], dir: [0.65, 0.08, 1] },
    labels: [
      { at: 'cerebrum', side: 'left', text: 'Brain', color: C.cns },
      { at: { at: 'spinal_cord', offset: [0, 40, 0] }, side: 'right', text: 'Spinal cord', sub: 'inside the backbone', color: C.cns },
      { minor: true, at: { at: 'spine', offset: [0, -160, 0] }, side: 'right', text: 'Backbone', sub: '(vertebrae)', color: '#EFE5D3' },
    ],
    async play(v) { await v.flow('cns_down', { color: C.cns, speed: 520, size: 12, count: 2, spacing: 0.9 }); },
  },
  pns: {
    caption: 'The PNS: nerves carry messages to and from the CNS',
    spec: { lit: { 'nerves:all': C.pns }, solid: [], nerves: {} },
    frame: { parts: ['skin'], dir: [0, 0.04, 1] },
    labels: [
      { at: { at: 'arm_left', offset: [20, -120, 0] }, side: 'right', text: 'Nerves in the arm', color: C.pns },
      { at: { at: 'leg_right', offset: [0, -60, 0] }, side: 'left', text: 'Nerves in the leg', color: C.pns },
      { at: 'intercostal_T6_right', side: 'left', text: 'Nerves to the chest', color: C.pns },
      { at: 'symtrunk_left', side: 'right', text: 'Nerves to the organs', color: C.pns },
    ],
    async play(v) {
      v.flow('sensory_arm_left', { color: C.pns, speed: 700, count: 2, spacing: 0.8, track: false });
      v.flow('motor_leg_right', { color: C.pns, speed: 700, count: 2, spacing: 0.8, track: false });
      await v.flow('sensory_leg_left', { color: C.pns, speed: 700, count: 2, spacing: 0.8, track: false, delay: 0.6 });
    },
  },
  som: {
    caption: 'Somatic: a message comes in from the skin, and a message goes out to a muscle',
    spec: { lit: { arm_right: C.pns, biceps_right: C.muscle, muscle_arm_right: C.muscle, spinal_cord: C.cns, cerebrum: { color: C.cns, alpha: 0.5, glow: 0.2 } }, nerves: { 'nerves:som': '#5f7f86' } },
    frame: { parts: ['muscle_arm_right', 'hand_right', 'skull'], dir: [-0.35, 0.05, 1] },
    labels: [
      { at: { at: 'hand_right', offset: [0, 120, 20] }, side: 'left', text: 'Sensory nerve', sub: 'skin → CNS', color: C.pns },
      { at: 'biceps_right', side: 'right', text: 'Motor nerve', sub: 'CNS → muscle', color: C.muscle },
      { at: 'muscle_arm_right', side: 'left', text: 'Skeletal muscle', sub: '(biceps)', color: C.muscle },
      { at: { at: 'spinal_cord', offset: [0, 150, 0] }, side: 'right', text: 'Spinal cord', color: C.cns },
    ],
    async play(v, tok) {
      await v.flow('sensory_arm_right', { color: C.pns, speed: 650, size: 12 });
      if (!v.alive(tok)) return;
      await v.wait(0.3);
      await v.flow('motor_arm_right', { color: C.muscle, speed: 650, size: 12 });
      if (!v.alive(tok)) return;
      v.rhythm('muscle_arm_right', { rate: 40, amp: 0.05, duration: 1.4 });
    },
  },
  aut: {
    caption: 'Autonomic: nerves to the internal organs, working automatically',
    spec: { lit: { ...Object.fromEntries(AUT_ORGANS.map((o) => [o, C.aut])), 'nerves:sym': C.aut, 'nerves:para': C.aut } },
    frame: { parts: ['skull', 'pelvis', 'ribcage'], dir: [0.25, 0.05, 1] },
    labels: [
      { at: 'eye_right', side: 'left', text: 'Pupils', color: C.aut },
      { at: 'lung_right', side: 'left', text: 'Lungs', color: C.aut },
      { at: 'small_intestine', side: 'left', text: 'Intestines', color: C.aut },
      { at: 'heart', side: 'right', text: 'Heart', color: C.aut },
      { at: 'stomach', side: 'right', text: 'Stomach', color: C.aut },
      { at: 'bladder', side: 'right', text: 'Bladder', color: C.aut },
    ],
    async play(v) {
      ['sym_heart_right', 'vagus_heart_left', 'sym_lung_left', 'vagus_lung_right', 'sym_eye_right', 'para_eye_left', 'vagus_left', 'pelvic_right']
        .forEach((r, i) => v.flow(r, { color: C.aut, speed: 600, delay: (i % 4) * 0.25, track: false }));
      await v.wait(4);
    },
  },
  sym: {
    caption: 'Sympathetic: the body gets ready for action',
    spec: { lit: { 'nerves:sym': C.sym, spinal_cord: { color: C.cns, glow: 0.2 }, eyes: C.sym, salivary: C.sym, lungs: C.sym, heart: C.sym, intestines: C.sym, adrenals: C.gland } },
    frame: { parts: ['skull', 'pelvis', 'ribcage'], dir: [0.25, 0.05, 1] },
    labels: [
      { at: 'eye_right', side: 'left', text: 'Pupils', sub: 'get wider', short: 'Wider pupils', color: C.sym },
      { minor: true, at: 'mouth', side: 'left', text: 'Mouth', sub: 'less saliva', short: 'Less saliva', color: C.sym },
      { at: 'lung_right', side: 'left', text: 'Lungs', sub: 'breathing speeds up', short: 'Faster breathing', color: C.sym },
      { at: 'small_intestine', side: 'left', text: 'Intestines', sub: 'digestion slows down', short: 'Slower digestion', color: C.sym },
      { at: 'heart', side: 'right', text: 'Heart', sub: 'beats faster', short: 'Faster heart', color: C.sym },
      { at: 'adrenal_left', side: 'right', text: 'Adrenal glands', sub: 'release adrenaline', short: 'Adrenaline', color: C.gland },
      { minor: true, at: 'symtrunk_left', side: 'right', text: 'Sympathetic nerves', sub: 'leave the middle section of the spinal cord (chest and upper-back level)', short: 'Sympathetic nerves', color: C.sym },
    ],
    async play(v) {
      ['sym_eye_right', 'sym_salivary_left', 'sym_heart_right', 'sym_lung_left', 'sym_splanchnic_right', 'sym_adrenal_left', 'sym_adrenal_right']
        .forEach((r, i) => v.flow(r, { color: C.sym, speed: 650, delay: i * 0.18, track: false }));
      v.rhythm('heart', { rate: 115, amp: 0.035, duration: 9 });
      v.rhythm('lungs', { rate: 22, amp: 0.025, axes: [1, 0.6, 1], duration: 9, kind: 'breath' });
      await v.wait(4);
    },
  },
  para: {
    caption: 'Parasympathetic: the body rests and digests',
    spec: { lit: { 'nerves:para': C.para, brainstem: { color: C.cns, glow: 0.3 }, eyes: C.para, salivary: C.para, lungs: C.para, heart: C.para, intestines: C.para } },
    frame: { parts: ['skull', 'pelvis', 'ribcage'], dir: [0.25, 0.05, 1] },
    labels: [
      { at: 'eye_right', side: 'left', text: 'Pupils', sub: 'get smaller', short: 'Smaller pupils', color: C.para },
      { minor: true, at: 'mouth', side: 'left', text: 'Mouth', sub: 'more saliva', short: 'More saliva', color: C.para },
      { at: 'lung_right', side: 'left', text: 'Lungs', sub: 'breathing slows down', short: 'Slower breathing', color: C.para },
      { at: 'small_intestine', side: 'left', text: 'Intestines', sub: 'digestion starts again', short: 'Digestion restarts', color: C.para },
      { at: 'heart', side: 'right', text: 'Heart', sub: 'slows down', short: 'Slower heart', color: C.para },
      { at: 'vagus_neck_left', side: 'right', text: 'Vagus nerve', sub: 'from the brainstem', color: C.para },
    ],
    async play(v) {
      ['vagus_left', 'vagus_right', 'vagus_heart_left', 'vagus_lung_right', 'para_eye_right', 'para_salivary_left', 'pelvic_left']
        .forEach((r, i) => v.flow(r, { color: C.para, speed: 520, delay: i * 0.2, track: false }));
      v.rhythm('heart', { rate: 60, amp: 0.03, duration: 9 });
      v.rhythm('lungs', { rate: 10, amp: 0.025, axes: [1, 0.6, 1], duration: 9, kind: 'breath' });
      await v.wait(4);
    },
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
.ns3-tree { width: 252px; overflow:auto; padding: 12px 8px 12px 12px; border-radius: 16px; background: rgba(11,17,34,.9);
  border: 1px solid rgba(220,230,255,.16); box-shadow: 0 8px 24px rgba(0,0,0,.3); color:#F3F6FF; }
.ns3-tree-title { font-size: .9rem; font-weight: 700; color: #C9D3EE; margin: 0 0 8px; }
.ns3-ul { list-style:none; margin:0; padding:0; }
.ns3-ul .ns3-ul { margin-left: 10px; }
.ns3-ul .ns3-ul > li { position:relative; padding: 6px 0 0 16px; }
.ns3-ul .ns3-ul > li::before { content:''; position:absolute; left:0; top:0; bottom:0; border-left: 2px solid rgba(220,230,255,.22); }
.ns3-ul .ns3-ul > li:last-child::before { bottom:auto; height: 30px; }
.ns3-ul .ns3-ul > li::after { content:''; position:absolute; left:0; top: 30px; width: 14px; border-top: 2px solid rgba(220,230,255,.22); }
.ns3-node { width:100%; display:flex; align-items:center; text-align:left; gap:9px; padding: 6px 9px; min-height:48px; border-radius: 12px; cursor:pointer;
  border: 2px solid color-mix(in srgb, var(--nc) 40%, transparent); background: rgba(255,255,255,.05); color: #F3F6FF; line-height:1.25; font: inherit; }
.ns3-node:hover { background: rgba(255,255,255,.1); }
.ns3-node:focus-visible { outline: 3px solid #FFD27A; outline-offset: 2px; }
.ns3-node .ns3-dot { flex:none; width:14px; height:14px; border-radius:50%; background: var(--nc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--nc) 25%, transparent); }
.ns3-node .ns3-txt { display:flex; flex-direction:column; min-width:0; }
.ns3-node .ns3-name { font-weight:700; font-size:15px; }
.ns3-node .ns3-sub { font-size:15px; color: #C9D3EE; }
.ns3-node .ns3-chev { margin-left:auto; flex:none; color: #C9D3EE; transition: transform .25s; }
.ns3-node[aria-expanded="true"] .ns3-chev { transform: rotate(90deg); }
.ns3-node[aria-pressed="true"] { background: color-mix(in srgb, var(--nc) 26%, rgba(11,17,34,.9)); border-color: var(--nc); }
.ns3-crumb { margin: 0; padding: 6px 12px; border-radius: 12px; background: rgba(11,17,34,.9); color:#C9D3EE; font: 700 15px/1.3 var(--font, system-ui); }
.ns3-crumb b { color: #fff; }
.b3-bar button.ns3-cmp[aria-pressed="true"] { background: var(--cc); color:#0E1528; border-color: var(--cc); }
@media (prefers-reduced-motion: reduce) { .ns3-node .ns3-chev { transition: none; } }
`;

function nodeButton(id) {
  const n = NODES[id];
  const kids = n.kids && id !== 'ns';
  return `<button type="button" class="ns3-node" data-node="${id}" aria-pressed="false" ${kids ? `aria-expanded="false" aria-controls="ns3-kids-${id}"` : ''} style="--nc:${n.colour}">
    <span class="ns3-dot" aria-hidden="true"></span>
    <span class="ns3-txt"><span class="ns3-name">${n.name}</span><span class="ns3-sub">${n.sub}</span></span>
    ${kids ? '<span class="ns3-chev" aria-hidden="true">▸</span>' : ''}</button>`;
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
        <p>Use the S and P buttons under the 3D body to compare them.</p>`,
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
    dark: true,
    async create(container) {
      if (!document.getElementById('ns3-css')) { const s = document.createElement('style'); s.id = 'ns3-css'; s.textContent = CSS; document.head.append(s); }
      const tree = document.createElement('nav');
      tree.className = 'ns3-tree';
      tree.setAttribute('aria-label', 'Divisions of the nervous system');
      tree.innerHTML = `
        <p class="ns3-tree-title">Choose a part to see it on the body</p>
        <ul class="ns3-ul">
          <li>${nodeButton('ns')}
            <ul class="ns3-ul">
              <li>${nodeButton('cns')}</li>
              <li>${nodeButton('pns')}
                <ul class="ns3-ul" id="ns3-kids-pns" data-kids="pns" hidden>
                  <li>${nodeButton('som')}</li>
                  <li>${nodeButton('aut')}
                    <ul class="ns3-ul" id="ns3-kids-aut" data-kids="aut" hidden>
                      <li>${nodeButton('sym')}</li>
                      <li>${nodeButton('para')}</li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>`;
      const stage = bodyStage(container, { label: '3D body showing the nervous system' });
      const v = stage.viewer;
      const crumb = document.createElement('p');
      crumb.className = 'ns3-crumb';
      crumb.setAttribute('aria-hidden', 'true');
      stage.dock.prepend(crumb);
      // the tree sits beside the body on wide stages; on narrow ones a breadcrumb replaces it
      const fit = () => {
        const wide = container.clientWidth >= 860;
        tree.hidden = !wide;
        crumb.hidden = wide;
        stage.refreshSafe();
      };
      stage.setLeft(tree);
      const ro = new ResizeObserver(fit);
      ro.observe(container);
      // the page shows straight away; the 3D model fills in when it has loaded
      let loaded = false, pending = null;
      v.ready.then(() => { loaded = true; if (pending !== null) api.show(pending); });

      const cmpBtns = ['sym', 'para'].map((n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ns3-cmp';
        b.dataset.cmp = n;
        b.style.setProperty('--cc', NODES[n].colour);
        b.setAttribute('aria-pressed', 'false');
        b.textContent = n === 'sym' ? 'S: Sympathetic' : 'P: Parasympathetic';
        b.addEventListener('click', () => { setNode(n); run(n, true); });
        return b;
      });
      cmpBtns.reverse().forEach((b) => stage.bar.bar.prepend(b));

      let current = 'ns', compare = false;
      const open = { pns: false, aut: false };
      function setOpen(n, on) {
        open[n] = on;
        tree.querySelector(`[data-kids="${n}"]`).hidden = !on;
        tree.querySelector(`[data-node="${n}"]`).setAttribute('aria-expanded', String(on));
      }
      function setNode(n) {
        current = n;
        tree.querySelectorAll('.ns3-node').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.node === n)));
        cmpBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cmp === n)));
        crumb.innerHTML = NODES[n].crumb.map((c, i, a) => (i === a.length - 1 ? `<b>${SHORT[c]}</b>` : SHORT[c])).join(' › ');
      }
      function run(n, animate) {
        const st = STATES[n];
        v.setState(st.spec);
        v.frame(st.frame);
        v.setLabels(st.labels);
        let text = st.caption;
        if (compare && n === 'sym') text = 'S = Stress: the sympathetic system speeds you up';
        if (compare && n === 'para') text = 'P = Peace: the parasympathetic system calms you down';
        stage.setCaption(text);
        stage.describe(`Labels: ${st.labels.map((l) => `${l.text}${l.sub ? ` (${l.sub})` : ''}`).join('; ')}.`);
        stage.bar.showMotion(animate);
        stage.handlers.replay = () => stage.play((tok) => st.play(v, tok));
        if (animate) stage.play((tok) => st.play(v, tok));
        else v.clearAnim();
      }

      tree.addEventListener('click', (e) => {
        const b = e.target.closest('.ns3-node');
        if (!b) return;
        const n = b.dataset.node;
        if (n === current && NODES[n].kids && n !== 'ns') { setOpen(n, !open[n]); return; }
        if (NODES[n].kids && n !== 'ns') setOpen(n, true);
        setNode(n);
        run(n, true);
      });
      fit();

      const api = {
        show(step) {
          if (!loaded) { pending = step; return; }
          const s = step < 0 ? { node: 'ns', open: [] } : step >= STEP_TREE.length ? { node: 'ns', open: ['pns', 'aut'] } : STEP_TREE[step];
          compare = !!s.compare;
          cmpBtns.forEach((b) => { b.hidden = !compare; });
          setOpen('pns', s.open.includes('pns'));
          setOpen('aut', s.open.includes('aut'));
          setNode(s.node);
          run(s.node, step >= 0 && step < STEP_TREE.length);
        },
        dispose() { ro.disconnect(); stage.dispose(); },
      };
      return api;
    },
  },
};
