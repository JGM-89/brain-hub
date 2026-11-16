// Fight or flight — AQA 7182 4.2.1: "The fight or flight response including the role of adrenaline."
// Visual: a real 3D human body (BodyParts3D, CC BY 4.0) on a calm dark stage, a small friendly story
// card (a bear on a forest path) and three gauges with example numbers (heart rate, breathing, pupils).
// Each step lights the next stage of the pathway on the real anatomy: eyes -> amygdala -> hypothalamus
// -> sympathetic nerves -> adrenal medulla -> adrenaline in the blood -> effects on the organs, then the
// parasympathetic calm-down. Styling stays calm: soft colours, no flashing, motion only when asked.
import { bodyStage, C } from '../three/body3d.js';
import { reducedMotion } from '../settings.js';

const REST = { hr: 70, br: 12, pu: 0 };
const AROUSED = { hr: 120, br: 24, pu: 1 };
const MEDULLA = '#FF8A5C', LIVER = '#E0A07A', CALM_GUT = '#9FB0D8', SWEAT = '#8FD3FF';
const VESSELS = { arteries: { color: C.blood, alpha: 0.35, glow: 0.05, tint: 0.6 }, veins: { color: C.vein, alpha: 0.3, glow: 0.05, tint: 0.6 } };
const HEAD = { parts: ['skull'], dir: [0.85, 0.12, 0.75], pad: 1.25 };
const TORSO = { parts: ['skull', 'pelvis'], dir: [0.22, 0.05, 1] };
const KIDNEYS = { parts: ['kidney_left', 'kidney_right', 'adrenal_left', 'adrenal_right'], dir: [0, 0.12, 1], pad: 1.5 };
const ADRENAL_INSET = { at: 'adrenal_left', dist: 105, dir: [0.25, 0.25, 1], tag: 'Zoomed in: cut through an adrenal gland',
  only: ['adrenal_left', 'adrenal_medulla_left'],
  clip: { parts: ['adrenal_left', 'adrenal_medulla_left'], normal: [-0.25, -0.25, -1], capColors: { adrenal_left: '#D9A23E', adrenal_medulla_left: '#C04E22' } } };

const flowAll = (v, routes, o) => Promise.all(routes.map((r, i) => v.flow(r, { delay: i * (o.stagger ?? 0.2), ...o })));
const journey = (v, venous, targets, o = {}) => Promise.all(targets.map((t, i) => v.flow([venous, 'heart_lungs', t], { color: C.hormone, speed: 360, count: 2, spacing: 0.45, delay: i * 0.3, ...o })));

const SYM_ROUTES = ['sym_eye_right', 'sym_heart_right', 'sym_lung_left', 'sym_salivary_left', 'sym_splanchnic_right', 'sym_adrenal_left', 'sym_adrenal_right'];

const STEPS = [
  { // 0 scenario
    bear: 'in', gauges: 'rest', caption: 'A bear steps onto the path ahead',
    spec: { lit: { eyes: C.pns } },
    frame: { parts: ['skull', 'ribcage'], dir: [0.3, 0.08, 1] },
    labels: [{ at: 'eye_right', side: 'left', text: 'Your eyes', sub: 'see the bear', color: C.pns }],
    async play() {},
  },
  { // 1 amygdala
    bear: 'on', gauges: 'rest', caption: 'The amygdala recognises the bear as a threat',
    note: 'Simplified route: signals from the eyes pass through other brain areas (such as the thalamus and visual cortex) before they reach the amygdala',
    spec: { lit: { eyes: C.pns, optic_nerves: C.pns, amygdala: { color: C.sym, glow: 0.5 }, cerebrum: { color: '#E3B3AA', alpha: 0.18, tint: 0, glow: 0 } }, skin: 0.6 },
    frame: HEAD,
    labels: [
      { at: 'amygdala_left', side: 'right', text: 'Amygdala', sub: 'recognises the threat', color: C.sym },
      { at: 'eye_left', side: 'left', text: 'Eyes', sub: 'send signals to the brain', color: C.pns },
    ],
    async play(v) { await flowAll(v, ['see_left', 'see_right'], { color: C.pns, speed: 95, size: 3.4, count: 3, spacing: 0.5, stagger: 0.1, fixed: true }); },
  },
  { // 2 hypothalamus -> SNS
    bear: 'on', gauges: 'rest', caption: 'The hypothalamus switches on the sympathetic nervous system',
    spec: { lit: { amygdala: C.sym, hypothalamus: { color: C.brainpart, glow: 0.5 }, 'nerves:sym': C.sym, spinal_cord: { color: C.cns, glow: 0.25 }, brainstem: { color: C.cns, alpha: 0.5, glow: 0.1 } } },
    frame: TORSO,
    labels: [
      { at: 'hypothalamus', side: 'left', text: 'Hypothalamus', sub: 'activates the SNS', color: C.brainpart },
      { at: 'symtrunk_left', side: 'right', text: 'Sympathetic nervous system', sub: 'signals travel down the spinal cord', color: C.sym },
    ],
    async play(v, tok) {
      if (!reducedMotion()) {
        v.frame(HEAD);
        v.setLabels([{ at: 'hypothalamus', side: 'right', text: 'Hypothalamus', sub: 'activates the SNS', color: C.brainpart }, { at: 'amygdala_left', side: 'right', text: 'Amygdala', sub: 'sends a distress signal', color: C.sym }]);
        await flowAll(v, ['amyg_hypo_left', 'amyg_hypo_right'], { color: C.sym, speed: 30, size: 3, count: 2, spacing: 0.5, fixed: true });
        if (!v.alive(tok)) return;
        v.frame(TORSO);
        v.setLabels(STEPS[2].labels);
        await v.wait(0.8);
        if (!v.alive(tok)) return;
      }
      await flowAll(v, ['cns_down', ...SYM_ROUTES], { color: C.sym, speed: 620, size: 10, stagger: 0.15 });
    },
  },
  { // 3 adrenal medulla
    bear: 'on', gauges: 'rest', caption: 'Sympathetic nerves stimulate the adrenal medulla',
    note: 'Cut-away: the medulla is shown as the central core of the real gland (its exact edge is approximate)',
    spec: { lit: { sym_adrenal_left: C.sym, sym_adrenal_right: C.sym, splanchnic_left: C.sym, splanchnic_right: C.sym, symtrunk_left: C.sym, symtrunk_right: C.sym,
      adrenals: C.gland, medullas: { color: MEDULLA, glow: 0.5, tint: 0.6 }, kidneys: { color: '#C3A6EE', alpha: 0.6, glow: 0.04 } } },
    frame: KIDNEYS,
    inset: ADRENAL_INSET,
    labels: [
      { at: 'sym_adrenal_right', side: 'left', text: 'Sympathetic nerves', sub: 'reach the adrenal glands', color: C.sym },
      { at: 'adrenal_right', side: 'left', text: 'Adrenal glands', sub: 'on top of the kidneys', color: C.gland },
      { at: 'adrenal_medulla_left', view: 'inset', side: 'right', y: 0.8, text: 'Adrenal medulla', sub: 'the middle of the adrenal gland', color: MEDULLA },
    ],
    async play(v) { await flowAll(v, ['sym_adrenal_left', 'sym_adrenal_right'], { color: C.sym, speed: 420, size: 9, count: 3, spacing: 0.5 }); },
  },
  { // 4 adrenaline in the blood
    bear: 'on', gauges: 'rest', caption: 'Adrenaline is carried around the body in the blood',
    spec: { lit: { adrenals: C.gland, heart: C.heart, ...VESSELS } },
    frame: TORSO,
    labels: [
      { at: 'adrenal_right', side: 'left', text: 'Adrenal glands', sub: 'release adrenaline', color: C.gland },
      { at: 'aortic_arch', side: 'right', text: 'Adrenaline', sub: 'in the bloodstream', color: C.hormone },
      { at: 'heart', side: 'right', text: 'Heart', sub: 'pumps it around the body', color: C.heart },
    ],
    async play(v) {
      await Promise.all([
        journey(v, 'v_adrenal_left', ['a_head_left', 'a_arm_left', 'a_thigh_left', 'a_heart']),
        journey(v, 'v_adrenal_right', ['a_head_right', 'a_arm_right', 'a_thigh_right', 'a_liver'], { delay: 0.2 }),
      ]);
    },
  },
  { // 5 effects
    bear: 'on', gauges: 'aroused', caption: 'The body is ready to fight or run',
    spec: { lit: { eyes: C.sym, salivary: C.sym, lungs: { color: C.sym, alpha: 0.8 }, heart: C.sym, liver: LIVER, intestines: { color: CALM_GUT, alpha: 0.55, glow: 0 }, stomach: { color: CALM_GUT, alpha: 0.55, glow: 0 },
      muscles: { color: C.muscle, glow: 0.25 }, arteries: VESSELS.arteries }, skin: 1.6 },
    frame: TORSO,
    labels: [
      { at: 'eye_right', side: 'left', text: 'Pupils widen', sub: 'more light gets in', color: C.sym },
      { minor: true, at: 'mouth', side: 'left', text: 'Less saliva', color: C.sym },
      { at: 'lung_right', side: 'left', text: 'Faster breathing', sub: 'more oxygen', color: C.sym },
      { minor: true, at: 'liver', side: 'left', text: 'Glucose released', sub: 'for energy', color: LIVER },
      { at: 'small_intestine', side: 'left', text: 'Digestion slows', color: CALM_GUT },
      { at: 'heart', side: 'left', text: 'Heart rate and blood pressure rise', short: 'Heart rate up', color: C.sym },
      { minor: true, at: 'arm_skin_right', side: 'left', text: 'More sweating', sub: 'to cool down', color: SWEAT },
      { at: 'muscle_thigh_left', side: 'right', text: 'Blood sent to the muscles', color: C.muscle },
    ],
    async play(v, tok, g) {
      v.rhythm('heart', { rate: 120, amp: 0.035, duration: 10 });
      v.rhythm('lungs', { rate: 24, amp: 0.03, axes: [1, 0.6, 1], duration: 10, kind: 'breath' });
      g.tween(AROUSED, 2.6, tok);
      v.flow('v_liver', { color: '#F4F7FF', speed: 220, count: 3, spacing: 0.5, size: 7 });
      await flowAll(v, ['a_thigh_left', 'a_thigh_right', 'a_biceps_left', 'a_biceps_right'], { color: C.blood, speed: 420, count: 3, spacing: 0.45, stagger: 0.25 });
    },
  },
  { // 6 calming down
    bear: 'out', gauges: 'calm', caption: 'The bear has gone. The parasympathetic system calms the body.',
    spec: { lit: { 'nerves:para': C.para, brainstem: { color: C.cns, glow: 0.25 }, eyes: C.para, lungs: { color: C.para, alpha: 0.8 }, heart: C.para, intestines: C.para, stomach: C.para } },
    frame: TORSO,
    labels: [
      { at: 'vagus_neck_right', side: 'left', text: 'Parasympathetic nervous system', sub: 'rest and digest', color: C.para },
      { at: 'eye_right', side: 'left', text: 'Pupils get smaller', color: C.para },
      { at: 'small_intestine', side: 'left', text: 'Digestion starts again', color: C.para },
      { at: 'heart', side: 'right', text: 'Heart rate slows down', color: C.para },
      { at: 'lung_left', side: 'right', text: 'Breathing slows down', color: C.para },
    ],
    async play(v, tok, g) {
      v.rhythm('heart', { rate: 70, amp: 0.03, duration: 10 });
      v.rhythm('lungs', { rate: 12, amp: 0.03, axes: [1, 0.6, 1], duration: 10, kind: 'breath' });
      g.tween(REST, 3.6, tok);
      await flowAll(v, ['vagus_left', 'vagus_right', 'vagus_heart_left', 'vagus_lung_right', 'para_eye_right', 'para_eye_left'], { color: C.para, speed: 480, stagger: 0.25 });
    },
  },
  { evaluate: true, gauges: 'rest', caption: 'Three evaluation points', spec: { lit: {} }, frame: TORSO, labels: [] }, // 7
];

// Recap shown with the quiz: the whole pathway, numbered
const RECAP = {
  spec: { lit: { amygdala: C.sym, hypothalamus: C.brainpart, 'nerves:sym': C.sym, spinal_cord: C.cns, adrenals: C.gland, ...VESSELS } },
  labels: [
    { at: 'amygdala_right', side: 'left', order: 1, text: '1 Amygdala', sub: 'spots the threat', color: C.sym },
    { at: 'hypothalamus', side: 'right', order: 1, text: '2 Hypothalamus', sub: 'activates the SNS', color: C.brainpart },
    { at: 'symtrunk_right', side: 'left', order: 3, text: '3 Sympathetic nervous system', color: C.sym },
    { at: 'adrenal_left', side: 'right', order: 4, text: '4 Adrenal medulla', sub: 'inside the adrenal gland', color: C.gland },
    { at: 'aortic_arch', side: 'right', order: 5, text: '5 Adrenaline', sub: 'into the blood', color: C.hormone },
  ],
};

const EVAL = [
  { title: 'Tend and befriend', tag: 'Limitation: may not fit females', color: C.para, text: 'Taylor et al. (2000) suggested that females may respond to threat by protecting their young and turning to others for support, rather than fighting or running.',
    icon: '<circle class="fof3-ico" cx="24" cy="20" r="8"/><circle class="fof3-ico" cx="48" cy="20" r="8"/><path class="fof3-ico" d="M12,58 C12,40 36,40 36,58 M36,58 C36,40 60,40 60,58"/><path class="fof3-ico" d="M30,40 L42,40"/>' },
  { title: 'Freeze', tag: 'Limitation: an incomplete model', color: C.cns, text: 'Gray (1988) argued that the first response to danger is often to freeze: to stay still and alert, ready to act.',
    icon: '<circle class="fof3-ico" cx="36" cy="36" r="26"/><path class="fof3-ico" d="M28,24 L28,48 M44,24 L44,48"/>' },
  { title: 'Modern life', tag: 'Limitation: maladaptive today', color: C.sym, text: 'Most stress today, like exams or traffic, does not need fighting or running. Repeated activation may harm health, for example by raising blood pressure.',
    icon: '<rect class="fof3-ico" x="16" y="10" width="40" height="52" rx="5"/><path class="fof3-ico" d="M25,24 L47,24 M25,34 L47,34 M25,44 L39,44"/>' },
];

// ---------- story card (a friendly bear on a forest path) ----------
function sceneSVG() {
  const w = 196, h = 140;
  const tree = (tx, ty, s) => `<g transform="translate(${tx} ${ty}) scale(${s})"><rect fill="#7A5536" x="-3" y="-6" width="6" height="12" rx="2"/><path fill="#2F7552" d="M0,-58 L16,-30 L9,-30 L20,-12 L-20,-12 L-9,-30 L-16,-30 Z"/></g>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Story picture: a forest path. A bear may be on the path.">
    <defs><clipPath id="fof3-clip"><rect width="${w}" height="${h}" rx="14"/></clipPath></defs>
    <g clip-path="url(#fof3-clip)">
      <rect fill="#9CCBEA" width="${w}" height="${h}"/>
      <circle fill="#FFE08A" cx="160" cy="28" r="13"/>
      <path fill="#A9D394" d="M0,84 C40,62 80,70 110,78 C140,86 170,66 ${w},72 L${w},${h} L0,${h} Z"/>
      <path fill="#86BE72" d="M0,98 C60,92 120,96 ${w},92 L${w},${h} L0,${h} Z"/>
      ${tree(22, 102, 1.1)}${tree(48, 96, 0.8)}${tree(176, 98, 0.9)}${tree(150, 92, 0.6)}
      <path fill="#E8D8B6" d="M70,${h} C78,124 96,108 104,98 C108,94 114,92 120,92 L128,92 C122,96 118,104 118,112 C118,124 130,134 140,${h} Z"/>
      <g class="fof3-bear">
        <ellipse fill="#9A6A45" cx="0" cy="-26" rx="34" ry="20"/><ellipse fill="#9A6A45" cx="10" cy="-40" rx="17" ry="11"/>
        <rect fill="#9A6A45" x="-27" y="-16" width="12" height="18" rx="6"/><rect fill="#9A6A45" x="-10" y="-14" width="12" height="16" rx="6"/>
        <rect fill="#9A6A45" x="10" y="-16" width="12" height="18" rx="6"/><rect fill="#9A6A45" x="22" y="-14" width="11" height="16" rx="6"/>
        <circle fill="#9A6A45" cx="-40" cy="-49" r="5.5"/><circle fill="#9A6A45" cx="-27" cy="-50" r="5.5"/>
        <circle fill="#D9B791" cx="-40" cy="-49" r="2.6"/><circle fill="#D9B791" cx="-27" cy="-50" r="2.6"/>
        <circle fill="#9A6A45" cx="-34" cy="-36" r="14"/><ellipse fill="#D9B791" cx="-45" cy="-31" rx="9" ry="7"/>
        <ellipse fill="#3B2A1E" cx="-51" cy="-33" rx="3.2" ry="2.6"/><circle fill="#3B2A1E" cx="-36" cy="-40" r="2"/>
        <path d="M-49,-27 C-47,-25 -44,-25 -42,-27" fill="none" stroke="#3B2A1E" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <text class="fof3-gone" x="${w / 2}" y="30" text-anchor="middle">The bear has gone</text>
    </g>
  </svg>`;
}

// ---------- gauges (example numbers) ----------
const HEART_ICON = 'M0,6 C-10,-2 -12,-10 -6,-13 C-3,-14 -1,-12 0,-9 C1,-12 3,-14 6,-13 C12,-10 10,-2 0,6 Z';
const LUNG_ICON = 'M-2,-12 L-2,-4 C-6,-10 -13,-6 -13,2 C-13,8 -10,11 -6,11 C-3,11 -2,8 -2,4 Z M2,-12 L2,-4 C6,-10 13,-6 13,2 C13,8 10,11 6,11 C3,11 2,8 2,4 Z';
const EYE_ICON = 'M-13,0 C-8,-8 8,-8 13,0 C8,8 -8,8 -13,0 Z';
const GAUGES = [
  { key: 'hr', title: 'Heart rate', unit: 'beats per minute', icon: HEART_ICON, color: C.heart },
  { key: 'br', title: 'Breathing', unit: 'breaths per minute', icon: LUNG_ICON, color: C.pns },
  { key: 'pu', title: 'Pupils', unit: 'pupil size', icon: EYE_ICON, color: C.cns },
];
function heartTrace(rate) {
  const x0 = 0, x1 = 116, b = 30, n = (rate / 60) * 4;
  const gap = (x1 - x0) / n;
  let d = `M${x0},${b}`;
  for (let c = x0 + gap * 0.5; c < x1 - 6; c += gap) {
    d += ` L${(c - 6).toFixed(1)},${b} L${(c - 3).toFixed(1)},${b - 3} L${(c - 1.5).toFixed(1)},${b + 4} L${c.toFixed(1)},${b - 24} L${(c + 2).toFixed(1)},${b + 6} L${(c + 4).toFixed(1)},${b} L${(c + 6).toFixed(1)},${b - 3} L${(c + 8).toFixed(1)},${b}`;
  }
  return `${d} L${x1},${b}`;
}
function breathTrace(rate) {
  const x0 = 0, x1 = 116, b = 30, cycles = (rate / 60) * 15;
  let d = '';
  for (let i = 0; i <= 90; i++) {
    const x = x0 + ((x1 - x0) * i) / 90;
    const y = b - 16 * (1 - Math.cos((i / 90) * cycles * 2 * Math.PI)) / 2;
    d += `${i ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}
const lerp = (a, b, t) => a + (b - a) * t;

const CSS = `
.fof3-side { position:absolute; right:12px; z-index:3; display:flex; flex-direction:column; gap:10px; width: 214px; }
.fof3-scene { border-radius:16px; overflow:hidden; box-shadow: 0 8px 22px rgba(0,0,0,.35); border: 2px solid rgba(220,230,255,.22); line-height:0; }
.fof3-scene svg { width:100%; height:auto; display:block; }
.fof3-bear { transform: translate(126px, 112px) scale(.62); transition: opacity .9s ease, transform 2.4s ease; }
.fof3-gone { font: 700 14px var(--font, system-ui); fill: #14213D; opacity: 0; transition: opacity .6s; }
.fof3-scene.gone .fof3-bear { opacity: 0; transform: translate(230px, 112px) scale(-.62, .62); }
.fof3-scene.gone .fof3-gone { opacity: 1; }
.fof3-scene.away .fof3-bear { opacity: 0; transform: translate(230px, 112px) scale(.62); transition: none; }
.fof3-gauges { display:flex; flex-direction:column; gap:8px; }
.fof3-gauge { border-radius:14px; background: rgba(11,17,34,.92); border:1px solid rgba(220,230,255,.18); padding: 8px 10px; color:#F3F6FF;
  display:grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items:center; }
.fof3-gauge .fof3-t { font: 700 15px var(--font, system-ui); display:flex; align-items:center; gap:6px; grid-column: 1 / 3; }
.fof3-gauge .fof3-n { font: 700 28px/1 var(--font, system-ui); color: var(--gc); font-variant-numeric: tabular-nums; min-width: 2.4ch; }
.fof3-gauge .fof3-n small { display:block; font: 500 15px/1.2 var(--font, system-ui); color:#C9D3EE; }
.fof3-gauge svg.fof3-tr { width:100%; height:44px; }
.fof3-gauge path.fof3-line { fill:none; stroke: var(--gc); stroke-width:2.4; stroke-linejoin:round; stroke-linecap:round; }
.fof3-icon { fill: color-mix(in srgb, var(--gc) 25%, transparent); stroke: var(--gc); stroke-width:2; }
.fof3-note { margin:0; font: 600 15px var(--font, system-ui); color:#C9D3EE; text-align:right; }
.fof3-eval { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; width:100%; }
.fof3-ev { font-family: var(--font, system-ui, sans-serif); border-radius:16px; background: rgba(11,17,34,.94); border:1px solid rgba(220,230,255,.18); padding:12px; color:#F3F6FF; display:flex; flex-direction:column; gap:6px; }
.fof3-ev svg { width:56px; height:56px; }
.fof3-ev h3 { margin:0; font-size:17px; }
.fof3-ev p { margin:0; font-size:15px; color:#DCE3F7; }
.fof3-ev .tag { font-size:15px; font-weight:700; color:#C9D3EE; }
.fof3-ico { fill: color-mix(in srgb, var(--ec) 22%, transparent); stroke: var(--ec); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.fof3-compact.fof3-side { position: static; width: 100%; flex-direction: row; flex-wrap: nowrap; gap: 6px; align-items: stretch; }
.fof3-compact .fof3-scene { width: 92px; flex: none; border-radius: 10px; align-self: center; }
.fof3-compact .fof3-gauges { flex-direction: row; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; min-width: 0; }
.fof3-compact .fof3-gauge { flex: 1 1 0; min-width: 0; padding: 6px 7px; display: block; }
.fof3-compact .fof3-gauge svg.fof3-tr, .fof3-compact .fof3-gauge small, .fof3-compact .fof3-t svg { display: none; }
.fof3-compact .fof3-gauge .fof3-n { font-size: 22px; }
.fof3-compact .fof3-t { overflow-wrap: anywhere; }
.fof3-compact .fof3-gauge[data-g="pu"] .fof3-n { font-size: 17px; }
.fof3-compact .fof3-note { flex-basis: 100%; text-align: left; }
.fof3-eval[hidden], .fof3-side[hidden] { display: none; }
@media (max-width: 700px) { .fof3-eval { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .fof3-bear, .fof3-gone { transition: none; } }
`;

export default {
  id: 'fight-or-flight',
  title: 'Fight or flight',
  objectives: [
    'Describe the steps of the fight or flight response in order, from the amygdala to adrenaline.',
    'Explain how adrenaline changes the body, and why each change helps.',
    'Evaluate the fight or flight response using tend and befriend, freeze and modern stressors.',
  ],
  keywords: [
    { term: 'Fight or flight response', simple: 'The body’s automatic way of getting ready to fight a threat or run away from it.', exam: 'An automatic, involuntary response to a perceived threat, in which the sympathetic nervous system and adrenaline prepare the body for physical action.' },
    { term: 'Amygdala', simple: 'A small part deep in the brain that links what you sense with emotions such as fear.', exam: 'Part of the limbic system. It associates sensory signals with emotions linked to fight or flight, such as fear and anger, and signals the hypothalamus.' },
    { term: 'Hypothalamus', simple: 'A small part at the base of the brain that acts like a command centre.', exam: 'Receives the distress signal from the amygdala and activates the sympathetic nervous system (and controls the pituitary gland).' },
    { term: 'Sympathetic nervous system', simple: 'The part of the autonomic system that gets your body ready for action.', exam: 'The branch of the autonomic nervous system that increases arousal and stimulates the adrenal medulla.' },
    { term: 'Adrenaline', simple: 'A hormone that gets your body ready for action. It is released by the adrenal medulla.', exam: 'Released by the adrenal medulla into the bloodstream; it binds to receptors on target organs, causing the physiological changes of fight or flight.' },
    { term: 'Parasympathetic nervous system', simple: 'The part of the autonomic system that calms your body down: “rest and digest”.', exam: 'The branch of the autonomic nervous system that returns the body to its resting state once the threat has passed.' },
  ],
  steps: [
    {
      title: 'A walk in the woods',
      simple: `<p>Imagine you are walking along a path in a quiet forest. A large bear steps onto the path ahead of you.</p>
        <p>Without you thinking, your body gets ready to <strong>fight</strong> the threat or run away from it (<strong>flight</strong>).</p>
        <p>This automatic reaction is called the <span class="keyterm">fight or flight response</span>. It happens in seconds. We will follow it one step at a time.</p>`,
      exam: '<p>The fight or flight response is an automatic, involuntary reaction to a perceived threat. It is thought to have evolved because it helped our ancestors survive physical dangers, such as predators.</p>',
    },
    {
      title: 'The amygdala spots danger',
      simple: `<p>Your eyes and ears send information to your brain.</p>
        <p>The <span class="keyterm">amygdala</span> is a small part deep inside the brain. It links what you see and hear with emotions such as <strong>fear</strong>.</p>
        <p>The amygdala recognises the bear as a <strong>threat</strong>. It sends a distress signal to another part of the brain, the <strong>hypothalamus</strong>.</p>`,
      exam: '<p>The amygdala is part of the limbic system. It associates sensory signals with emotions linked to fight or flight, such as fear and anger.</p>',
    },
    {
      title: 'The hypothalamus switches on the SNS',
      simple: `<p>The <span class="keyterm">hypothalamus</span> is a small area at the base of the brain. It works like a command centre.</p>
        <p>It activates the <span class="keyterm">sympathetic nervous system</span> (SNS). This is the part of the autonomic nervous system that gets the body ready for action.</p>
        <p>Signals travel down the spinal cord and out along sympathetic nerves.</p>`,
      exam: '<p>The SNS is part of the autonomic nervous system, so this happens involuntarily. Sympathetic nerves act directly on some organs, for example the heart, as well as on the adrenal medulla.</p>',
    },
    {
      title: 'The adrenal medulla',
      simple: `<p>Sympathetic nerves reach the <strong>adrenal glands</strong>, which sit on top of your kidneys.</p>
        <p>The SNS <strong>stimulates</strong> the middle part of each adrenal gland. This part is called the <span class="keyterm">adrenal medulla</span>.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>The SNS does <strong>not</strong> release adrenaline itself. The SNS <strong>stimulates</strong> the adrenal medulla, and the <strong>adrenal medulla releases</strong> adrenaline.</p>' },
    },
    {
      title: 'Adrenaline enters the blood',
      simple: `<p>The adrenal medulla releases the hormone <span class="keyterm">adrenaline</span> (and a similar hormone, noradrenaline) into the <strong>bloodstream</strong>.</p>
        <p>The blood carries adrenaline quickly around the body. It reaches target organs such as the heart, lungs and muscles, and they respond.</p>`,
      exam: '<p>This route, from the hypothalamus through the sympathetic nervous system to the adrenal medulla, is called the <strong>sympathomedullary pathway</strong> (SAM pathway). The term comes from the Stress option, and using it adds precision to an answer.</p>',
    },
    {
      title: 'The body gets ready for action',
      simple: `<p>Adrenaline and the SNS change the body so you can fight or run:</p>
        <ul>
          <li>heart rate and blood pressure go <strong>up</strong>;</li>
          <li>breathing gets <strong>faster</strong>, to take in more oxygen;</li>
          <li>pupils <strong>dilate</strong> (get wider) to let in more light;</li>
          <li>you <strong>sweat</strong> more, to cool down;</li>
          <li><strong>glucose</strong> is released into the blood for energy;</li>
          <li>digestion and saliva <strong>slow down</strong>, and more blood goes to the muscles.</li>
        </ul>`,
      exam: '<p>These changes increase the supply of oxygen and glucose to the muscles and brain, ready for physical action. Functions that are not needed right now, such as digestion, are inhibited. (The numbers on the gauges are examples only.)</p>',
    },
    {
      title: 'Calming down: rest and digest',
      simple: `<p>The bear walks away. The threat has passed.</p>
        <p>The <span class="keyterm">parasympathetic nervous system</span> now takes over. It is the “rest and digest” system.</p>
        <p>It slows your heart rate and breathing, makes your pupils smaller and starts digestion again. Your body goes back to its normal resting state.</p>`,
      exam: '<p>If the threat carries on, a second, slower system also becomes involved: the <strong>HPA axis</strong> (hypothalamus → pituitary → adrenal cortex), which releases <strong>cortisol</strong>. This comes from the Stress option, so treat it as an exam extra here.</p>',
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>It is the <strong>parasympathetic</strong> system that calms the body down, not the sympathetic. S = Stress (speeds you up). P = Peace (calms you down).</p>' },
    },
    {
      title: 'Evaluating fight or flight',
      simple: `<p>Three points you can use when you evaluate:</p>
        <ul>
          <li><strong>Tend and befriend.</strong> Taylor et al. (2000) suggested females may protect their young and seek support from others, rather than fight or run.</li>
          <li><strong>Freeze.</strong> Gray (1988) argued the first response is often to freeze: to stay still and alert.</li>
          <li><strong>Modern life.</strong> Exams and traffic do not need fighting or running, so the response can be maladaptive and may harm health.</li>
        </ul>`,
      exam: '<p>Taylor et al. argued that early research on fight or flight was mostly carried out on males, so the theory may not apply equally to females (beta bias). Repeated activation of the response has been linked to health problems such as high blood pressure.</p>',
    },
  ],
  quiz: [
    { q: 'Which part of the brain first recognises the threat?', options: ['The amygdala', 'The hypothalamus', 'The pituitary gland', 'The cerebellum'], answer: 0, explain: 'The amygdala links what we sense with emotions such as fear, and sends a distress signal to the hypothalamus.', hint: 'It is the part linked with fear.' },
    { q: 'What does the hypothalamus activate in fight or flight?', options: ['The parasympathetic nervous system', 'The sympathetic nervous system', 'The somatic nervous system', 'The pancreas'], answer: 1, explain: 'The hypothalamus activates the sympathetic nervous system, which gets the body ready for action.', hint: 'S = Stress.' },
    { q: 'Which part of the adrenal gland releases adrenaline?', options: ['Adrenal cortex', 'Adrenal medulla', 'Kidney', 'Spinal cord'], answer: 1, explain: 'The SNS stimulates the adrenal medulla, which releases adrenaline into the bloodstream.', hint: 'Medulla = middle.' },
    { q: 'Which of these is an effect of adrenaline?', options: ['Digestion speeds up', 'Heart rate slows down', 'Pupils dilate', 'More saliva is made'], answer: 2, explain: 'Pupils dilate to let in more light. Digestion and saliva are reduced, and heart rate goes up.', hint: 'Think about what helps you see and run.' },
    { q: 'Which system returns the body to its resting state when the threat has gone?', options: ['Sympathetic nervous system', 'Somatic nervous system', 'Parasympathetic nervous system', 'Central nervous system'], answer: 2, explain: 'The parasympathetic nervous system is the “rest and digest” system.', hint: 'P = Peace.' },
  ],
  summary: [
    'Amygdala → hypothalamus → sympathetic nervous system → adrenal medulla → adrenaline into the blood.',
    'Adrenaline and the SNS: faster heart rate and breathing, dilated pupils, sweating, glucose released, less digestion and saliva.',
    'When the threat passes, the parasympathetic nervous system brings the body back to rest (“rest and digest”).',
  ],
  visual: {
    dark: true,
    async create(container) {
      if (!document.getElementById('fof3-css')) { const s = document.createElement('style'); s.id = 'fof3-css'; s.textContent = CSS; document.head.append(s); }
      const stage = bodyStage(container, { label: '3D body showing the fight or flight response' });
      const v = stage.viewer;

      // right-hand column: story card + gauges (moves into the bottom dock on narrow stages)
      const side = document.createElement('div');
      side.className = 'fof3-side';
      side.innerHTML = `<div class="fof3-scene">${sceneSVG()}</div>
        <div class="fof3-gauges" aria-label="Gauges with example numbers">
          ${GAUGES.map((g) => `<div class="fof3-gauge" data-g="${g.key}" style="--gc:${g.color}">
            <span class="fof3-t"><svg width="26" height="26" viewBox="-14 -14 28 28" aria-hidden="true"><path class="fof3-icon" d="${g.icon}"/>${g.key === 'pu' ? '<circle class="fof3-icon" r="3.5"/>' : ''}</svg>${g.title}</span>
            <span class="fof3-n"><span data-num></span><small>${g.unit}</small></span>
            ${g.key === 'pu'
    ? '<svg class="fof3-tr" viewBox="-60 -32 120 64" aria-hidden="true"><path d="M-56,0 C-34,-30 34,-30 56,0 C34,30 -34,30 -56,0 Z" fill="#F4F1EA" stroke="#C9D3EE" stroke-width="2"/><circle r="22" fill="#4F7FAE"/><circle data-pupil r="7" fill="#111"/><circle r="3" cx="7" cy="-8" fill="#fff" opacity=".8"/></svg>'
    : '<svg class="fof3-tr" viewBox="-2 0 120 40" preserveAspectRatio="none" aria-hidden="true"><path class="fof3-line" data-trace/></svg>'}
          </div>`).join('')}
          <p class="fof3-note">Example numbers</p>
        </div>`;
      stage.root.append(side);
      const scene = side.querySelector('.fof3-scene');
      const evalEl = document.createElement('div');
      evalEl.className = 'fof3-eval';
      evalEl.innerHTML = EVAL.map((e) => `<div class="fof3-ev" style="--ec:${e.color}"><svg viewBox="0 0 72 72" aria-hidden="true">${e.icon}</svg><span class="tag">${e.tag}</span><h3>${e.title}</h3><p>${e.text}</p></div>`).join('');
      evalEl.hidden = true;
      stage.dock.append(evalEl);

      const G = Object.fromEntries(GAUGES.map((g) => [g.key, side.querySelector(`[data-g="${g.key}"]`)]));
      let gv = { ...REST };
      function drawGauges(val) {
        gv = { ...val };
        G.hr.querySelector('[data-num]').textContent = Math.round(val.hr);
        G.hr.querySelector('[data-trace]').setAttribute('d', heartTrace(val.hr));
        G.br.querySelector('[data-num]').textContent = Math.round(val.br);
        G.br.querySelector('[data-trace]').setAttribute('d', breathTrace(val.br));
        G.pu.querySelector('[data-num]').textContent = val.pu > 0.5 ? 'Wider' : 'Normal';
        G.pu.querySelector('[data-pupil]').setAttribute('r', lerp(7, 16, val.pu).toFixed(2));
      }
      const gauges = {
        tween(to, dur, tok) {
          if (reducedMotion()) { drawGauges(to); return Promise.resolve(); }
          const from = { ...gv }, t0 = v.time;
          return new Promise((resolve) => {
            const step = () => {
              if (!v.alive(tok)) { resolve(); return; }
              const t = Math.min(1, (v.time - t0) / dur);
              const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              drawGauges({ hr: lerp(from.hr, to.hr, e), br: lerp(from.br, to.br, e), pu: lerp(from.pu, to.pu, e) });
              if (t < 1) requestAnimationFrame(step); else resolve();
            };
            requestAnimationFrame(step);
          });
        },
      };
      drawGauges(REST);

      function bear(mode, animate) {
        scene.classList.remove('gone', 'away');
        if (mode === 'none') { scene.classList.add('away'); return; }
        if (mode === 'out') {
          if (!animate || reducedMotion()) { scene.classList.add('away'); scene.classList.add('gone'); return; }
          void scene.offsetWidth; scene.classList.add('gone');
          return;
        }
        if (mode === 'in' && animate && !reducedMotion()) {
          scene.classList.add('away');
          void scene.offsetWidth;
          requestAnimationFrame(() => requestAnimationFrame(() => scene.classList.remove('away')));
        }
      }

      const layout = () => {
        const compact = container.clientWidth < 700 || container.clientHeight < 560;
        side.classList.toggle('fof3-compact', compact);
        if (compact) { if (side.parentElement !== stage.dock) stage.dock.prepend(side); stage.extraSafe = null; }
        else {
          if (side.parentElement !== stage.root) stage.root.append(side);
          side.style.top = `${stage.cap.offsetTop + stage.cap.offsetHeight + 10}px`;
          stage.extraSafe = side.hidden ? null : { right: side.offsetWidth + 20 };
        }
        stage.refreshSafe();
      };
      const ro = new ResizeObserver(layout);
      ro.observe(container);
      // the page shows straight away; the 3D model fills in when it has loaded
      let loaded = false, pending = null;
      v.ready.then(() => { loaded = true; if (pending !== null) api.show(pending); });

      function show(step) {
        const inRange = step >= 0 && step < STEPS.length;
        const st = inRange ? STEPS[step] : null;
        const isEval = !!st?.evaluate;
        evalEl.hidden = !isEval;
        side.hidden = isEval;
        layout();
        v.setInset(st?.inset || null);
        let caption, labels;
        if (!inRange) {
          const data = step < 0 ? { spec: { lit: {} }, labels: [] } : RECAP;
          v.setState(data.spec);
          v.frame(TORSO);
          labels = data.labels;
          caption = step < 0 ? 'A calm walk in the woods' : 'The whole pathway, in order';
          bear(step < 0 ? 'none' : 'on', false);
          drawGauges(REST);
          v.clearAnim();
        } else {
          v.setState(st.spec);
          v.frame(st.frame);
          labels = st.labels;
          caption = st.caption;
          bear(st.bear || 'on', true);
          drawGauges(st.gauges === 'calm' ? AROUSED : REST);
        }
        v.setLabels(labels);
        stage.setCaption(caption, st?.note || '');
        stage.describe(`${labels.length ? `Labels: ${labels.map((l) => `${l.text}${l.sub ? ` (${l.sub})` : ''}`).join('; ')}. ` : ''}Heart rate ${Math.round(st?.gauges === 'aroused' ? AROUSED.hr : REST.hr)}, breathing ${st?.gauges === 'aroused' ? AROUSED.br : REST.br} per minute (example numbers).`);
        const motion = inRange && !isEval;
        stage.bar.showMotion(motion);
        const run = () => stage.play(async (tok) => {
          if (st.gauges === 'calm') drawGauges(AROUSED);
          else if (st.gauges === 'aroused') drawGauges(REST);
          if (st.bear === 'in' || st.bear === 'out') bear(st.bear, true);
          if (st.inset) v.setInset(st.inset);
          v.setState(st.spec);
          v.frame(st.frame);
          v.setLabels(st.labels);
          await st.play(v, tok, gauges);
          if (reducedMotion()) drawGauges(st.gauges === 'aroused' ? AROUSED : REST);
        });
        stage.handlers.replay = motion ? run : null;
        if (motion) run(); else if (inRange) v.clearAnim();
      }

      const api = {
        show(step) { if (!loaded) { pending = step; return; } show(step); },
        dispose() { ro.disconnect(); stage.dispose(); },
      };
      return api;
    },
  },
};
