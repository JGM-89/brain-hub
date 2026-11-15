// Fight or flight — AQA 7182 4.2.1: "The fight or flight response including the role of adrenaline."
// Visual: a calm story scene (a friendly-looking bear on a forest path), a zoomed brain inset,
// the shared front-view body, and three gauges (heart rate, breathing, pupils). Each step lights
// the next stage of the pathway; the "calming down" step reverses the gauges.
import {
  svg, defs, ROUTES, AUTONOMIC, routePaths, light, watchScale, createLabels, createAnimator,
  injectBodyCSS, injectCSS, playAgainButton, uid, lerp,
} from './shared/body.js';

const S = 1.1, TX = 268, TY = 12;
const O = (x, y) => [+(TX + S * x).toFixed(1), +(TY + S * y).toFixed(1)];
const VB = { x: 0, y: 0, w: 800, h: 600 };
const LABEL_BOTTOM = 440;
const SCENE = { x: 592, y: 12, w: 196, h: 140 };
const INSET = { c: [140, 152], r: 122, z: 1.22 };
const IP = (x, y) => [INSET.c[0] + INSET.z * (x + 6), INSET.c[1] + INSET.z * y]; // inset local -> stage

const REST = { hr: 70, br: 12, pu: 0 };
const AROUSED = { hr: 120, br: 24, pu: 1 };

const STEPS = [
  { // 0 scenario
    on: ['eyes'], bear: 'in', gauges: 'rest', caption: 'A bear steps onto the path ahead',
    labels: [{ at: O(108, 43.5), side: 'left', y: 60, text: 'Your eyes', sub: 'see the bear', color: 'var(--c-pns)' }],
  },
  { // 1 amygdala
    on: ['brain', 'eyes'], bear: 'on', inset: true, gauges: 'rest', caption: 'The amygdala recognises the bear as a threat',
    labels: [],
  },
  { // 2 hypothalamus -> SNS
    on: ['brain', 'cord', 'sym'], bear: 'on', inset: true, gauges: 'rest', caption: 'The hypothalamus switches on the sympathetic nervous system',
    labels: [{ at: O(127, 190), side: 'right', y: 250, text: 'Sympathetic\nnervous system', sub: 'signals travel down\nthe spinal cord', color: 'var(--c-sym)' }],
  },
  { // 3 adrenal medulla
    on: ['cord', 'sym', 'adrenals', 'kidneys'], bear: 'on', gauges: 'rest', caption: 'Sympathetic nerves stimulate the adrenal medulla',
    labels: [
      { at: O(113, 170), side: 'left', y: 200, text: 'Sympathetic\nnerves', color: 'var(--c-sym)' },
      { at: O(147, 221), side: 'right', y: 300, text: 'Adrenal medulla', sub: 'the middle of the\nadrenal gland', color: 'var(--c-gland)' },
    ],
  },
  { // 4 adrenaline in the blood
    on: ['adrenals', 'vessels', 'heart'], bear: 'on', gauges: 'rest', caption: 'Adrenaline is carried around the body in the blood',
    labels: [
      { at: O(93, 224), side: 'left', y: 300, text: 'Adrenal glands', sub: 'release adrenaline', color: 'var(--c-gland)' },
      { at: O(185, 178), side: 'right', y: 240, text: 'Adrenaline', sub: 'in the bloodstream', color: 'var(--c-hormone)' },
    ],
  },
  { // 5 effects
    on: ['organ', 'eyes', 'muscles', 'sweat', 'vessels'], bear: 'on', gauges: 'aroused', caption: 'The body is ready to fight or run',
    labels: [
      { at: O(107, 43.5), side: 'left', y: 40, text: 'Pupils widen', sub: 'more light gets in', color: 'var(--c-sym)' },
      { at: O(116, 66), side: 'left', y: 110, text: 'Less saliva', color: 'var(--c-sym)' },
      { at: O(97, 160), side: 'left', y: 180, text: 'Faster breathing', sub: 'more oxygen', color: 'var(--c-sym)' },
      { at: O(97, 205), side: 'left', y: 270, text: 'Glucose released', sub: 'for energy', color: 'var(--c-sym)' },
      { at: O(108, 268), side: 'left', y: 360, text: 'Digestion slows', color: 'var(--c-sym)' },
      { at: O(132, 170), side: 'right', y: 190, text: 'Heart rate and\nblood pressure rise', color: 'var(--c-sym)' },
      { at: O(181, 155), side: 'right', y: 275, text: 'More sweating', sub: 'to cool down', color: 'var(--c-sym)' },
      { at: O(184, 178), side: 'right', y: 360, text: 'Blood sent to\nthe muscles', color: 'var(--c-sym)' },
    ],
  },
  { // 6 calming down
    on: ['para', 'organ', 'eyes'], bear: 'out', gauges: 'calm', caption: 'The bear has gone. The parasympathetic system calms the body.',
    labels: [
      { at: O(112, 104), side: 'left', y: 150, text: 'Parasympathetic\nnervous system', sub: 'rest and digest', color: 'var(--c-para)' },
      { at: O(108, 268), side: 'left', y: 330, text: 'Digestion\nstarts again', color: 'var(--c-para)' },
      { at: O(132, 170), side: 'right', y: 220, text: 'Heart rate\nslows down', color: 'var(--c-para)' },
      { at: O(146, 150), side: 'right', y: 320, text: 'Breathing\nslows down', color: 'var(--c-para)' },
      { at: O(107, 43.5), side: 'left', y: 40, text: 'Pupils get\nsmaller', color: 'var(--c-para)' },
    ],
  },
  { evaluate: true, caption: 'Three evaluation points' }, // 7
];

// Recap shown with the quiz: the whole pathway, numbered
const RECAP = {
  on: ['brain', 'cord', 'sym', 'adrenals', 'vessels'],
  labels: [
    { at: O(111, 47), side: 'left', y: 40, text: '1 Amygdala', sub: 'spots the threat', color: 'var(--c-sym)' },
    { at: O(120, 41), side: 'left', y: 120, text: '2 Hypothalamus', sub: 'activates the SNS', color: 'var(--c-sym)' },
    { at: O(113, 170), side: 'left', y: 210, text: '3 Sympathetic\nnervous system', color: 'var(--c-sym)' },
    { at: O(147, 221), side: 'right', y: 230, text: '4 Adrenal medulla', color: 'var(--c-gland)' },
    { at: O(185, 178), side: 'right', y: 320, text: '5 Adrenaline', sub: 'into the blood', color: 'var(--c-hormone)' },
  ],
};

const CSS = `
.fof-vis .fof-svgwrap { flex:1 1 auto; min-height:0; display:flex; }
.fof-vis .fof-scene-sky { fill: color-mix(in srgb, #8EC5E8 38%, var(--surface)); }
.fof-vis .fof-scene-hill { fill: color-mix(in srgb, #9CCB88 42%, var(--surface)); }
.fof-vis .fof-scene-ground { fill: color-mix(in srgb, #7FB56C 50%, var(--surface)); }
.fof-vis .fof-scene-path { fill: color-mix(in srgb, #E2CFA8 75%, var(--surface)); }
.fof-vis .fof-tree { fill: color-mix(in srgb, #2F7552 78%, var(--surface)); }
.fof-vis .fof-trunk { fill: color-mix(in srgb, #7A5536 75%, var(--surface)); }
.fof-vis .fof-sun { fill: color-mix(in srgb, #FFD978 80%, var(--surface)); }
.fof-vis .fof-scene-frame { fill:none; stroke: var(--line); stroke-width: 2; }
.fof-vis .bear-fur { fill: #9A6A45; }
.fof-vis .bear-light { fill: #D9B791; }
.fof-vis .bear-dark { fill: #3B2A1E; }
:root[data-theme="dark"] .fof-vis .bear-fur { fill: #B4835C; }
.fof-vis .fof-bear { transition: opacity .8s ease; }
.fof-vis .fof-bear.gone { opacity: 0; }
.fof-vis .fof-scene-note { font-family: var(--font); font-weight: 700; fill: var(--ink); paint-order: stroke; stroke: color-mix(in srgb, #8EC5E8 38%, var(--surface)); stroke-width: 5px; }
.fof-vis .fof-inset { opacity:0; transition: opacity .5s; }
.fof-vis .fof-inset.show { opacity:1; }
.fof-vis .fof-inset-bg { fill: var(--bh-panel); }
.fof-vis .fof-inset-ring { fill:none; stroke: color-mix(in srgb, var(--ink) 30%, transparent); stroke-width: 2; }
.fof-vis .fof-connector { fill:none; stroke: color-mix(in srgb, var(--ink) 35%, transparent); stroke-width: 1.5; stroke-dasharray: 4 5; }
.fof-vis .fof-head { fill: var(--bh-skin2); stroke: var(--bh-edge); stroke-width: 2; }
.fof-vis .fof-cerebrum { fill: color-mix(in srgb, var(--c-cns) 12%, var(--surface)); stroke: color-mix(in srgb, var(--c-cns) 70%, transparent); stroke-width: 2; }
.fof-vis .fof-gyri { fill:none; stroke: color-mix(in srgb, var(--c-cns) 35%, transparent); stroke-width: 2; stroke-linecap: round; }
.fof-vis .fof-cerebellum { fill: color-mix(in srgb, var(--c-cns) 18%, var(--surface)); stroke: color-mix(in srgb, var(--c-cns) 60%, transparent); stroke-width: 2; }
.fof-vis .fof-stem { fill: color-mix(in srgb, var(--c-cns) 22%, var(--surface)); stroke: color-mix(in srgb, var(--c-cns) 60%, transparent); stroke-width: 2; }
.fof-vis .fof-eye { fill: var(--surface); stroke: var(--bh-edge); stroke-width: 2; }
.fof-vis .fof-iris { fill: color-mix(in srgb, #3D7A9A 75%, var(--surface)); }
.fof-vis .fof-pupil { fill: #111; }
.fof-vis .fof-spot { fill: color-mix(in srgb, var(--sc) 25%, var(--surface)); stroke: var(--sc); stroke-width: 2; transition: fill .5s; }
.fof-vis .fof-spot.on { fill: var(--sc); }
.fof-vis .fof-card { fill: var(--bh-panel); stroke: var(--line); stroke-width: 1.5; }
.fof-vis .fof-g-title { font-family: var(--font); font-weight: 700; fill: var(--ink); }
.fof-vis .fof-g-num { font-family: var(--font); font-weight: 700; fill: var(--gc); font-variant-numeric: tabular-nums; }
.fof-vis .fof-g-unit, .fof-vis .fof-g-note { font-family: var(--font); fill: var(--ink-soft); }
.fof-vis .fof-trace { fill:none; stroke: var(--gc); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.fof-vis .fof-trace-base { stroke: color-mix(in srgb, var(--ink) 12%, transparent); stroke-width: 1; }
.fof-vis .fof-gicon { fill: color-mix(in srgb, var(--gc) 20%, var(--surface)); stroke: var(--gc); stroke-width: 2; stroke-linejoin: round; }
.fof-vis .bh-sweat { fill: #4BA3D9; stroke: color-mix(in srgb, #1C6EA4 60%, transparent); stroke-width: .4; }
.fof-vis .fof-eval { flex:1 1 auto; min-height:0; overflow:auto; padding: 16px; display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; align-content: safe center; }
.fof-vis .fof-evcard { background: var(--bh-panel); border: 1px solid var(--line); border-radius: 16px; padding: 14px; display:flex; flex-direction:column; gap: 8px; }
.fof-vis .fof-evcard svg { width: 72px; height: 72px; }
.fof-vis .fof-evcard h3 { margin:0; font-size: 1rem; }
.fof-vis .fof-evcard p { margin:0; font-size: .85rem; }
.fof-vis .fof-evcard .tag { font-size: .8rem; font-weight: 700; color: var(--ink-soft); }
.fof-vis .ev-ico { fill: color-mix(in srgb, var(--ec) 18%, var(--surface)); stroke: var(--ec); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
@container (max-width: 560px) { .fof-vis .fof-eval { grid-template-columns: 1fr; } }
`;

// ---------- pieces of the picture ----------
function sceneMarkup(id) {
  const { x, y, w, h } = SCENE;
  const tree = (tx, ty, s) => `<g transform="translate(${tx} ${ty}) scale(${s})"><rect class="fof-trunk" x="-3" y="-6" width="6" height="12" rx="2"/><path class="fof-tree" d="M0,-58 L16,-30 L9,-30 L20,-12 L-20,-12 L-9,-30 L-16,-30 Z"/></g>`;
  return `<g class="fof-scene" transform="translate(${x} ${y})">
    <clipPath id="${id}-scene"><rect width="${w}" height="${h}" rx="16"/></clipPath>
    <g clip-path="url(#${id}-scene)">
      <rect class="fof-scene-sky" width="${w}" height="${h}"/>
      <circle class="fof-sun" cx="160" cy="28" r="13"/>
      <path class="fof-scene-hill" d="M0,84 C40,62 80,70 110,78 C140,86 170,66 ${w},72 L${w},${h} L0,${h} Z"/>
      <path class="fof-scene-ground" d="M0,98 C60,92 120,96 ${w},92 L${w},${h} L0,${h} Z"/>
      ${tree(22, 102, 1.1)}${tree(48, 96, 0.8)}${tree(176, 98, 0.9)}${tree(150, 92, 0.6)}
      <path class="fof-scene-path" d="M70,${h} C78,124 96,108 104,98 C108,94 114,92 120,92 L128,92 C122,96 118,104 118,112 C118,124 130,134 140,${h} Z"/>
      <g class="fof-bear" transform="translate(126 112) scale(.62)">
        <ellipse class="bear-fur" cx="0" cy="-26" rx="34" ry="20"/>
        <ellipse class="bear-fur" cx="10" cy="-40" rx="17" ry="11"/>
        <rect class="bear-fur" x="-27" y="-16" width="12" height="18" rx="6"/><rect class="bear-fur" x="-10" y="-14" width="12" height="16" rx="6"/>
        <rect class="bear-fur" x="10" y="-16" width="12" height="18" rx="6"/><rect class="bear-fur" x="22" y="-14" width="11" height="16" rx="6"/>
        <circle class="bear-fur" cx="-40" cy="-49" r="5.5"/><circle class="bear-fur" cx="-27" cy="-50" r="5.5"/>
        <circle class="bear-light" cx="-40" cy="-49" r="2.6"/><circle class="bear-light" cx="-27" cy="-50" r="2.6"/>
        <circle class="bear-fur" cx="-34" cy="-36" r="14"/>
        <ellipse class="bear-light" cx="-45" cy="-31" rx="9" ry="7"/>
        <ellipse class="bear-dark" cx="-51" cy="-33" rx="3.2" ry="2.6"/>
        <circle class="bear-dark" cx="-36" cy="-40" r="2"/>
        <path d="M-49,-27 C-47,-25 -44,-25 -42,-27" fill="none" stroke="#3B2A1E" stroke-width="1.4" stroke-linecap="round"/>
      </g>
    </g>
    <rect class="fof-scene-frame" width="${w}" height="${h}" rx="16"/>
  </g>`;
}

function insetMarkup(id) {
  const [cx, cy] = INSET.c, r = INSET.r;
  return `<g class="fof-inset" transform="translate(${cx} ${cy})">
    <clipPath id="${id}-inset"><circle r="${r}"/></clipPath>
    <circle class="fof-inset-bg" r="${r}"/>
    <g clip-path="url(#${id}-inset)"><g transform="scale(${INSET.z}) translate(6 0)">
      <path class="fof-head" d="M-104,120 C-104,90 -96,74 -100,58 C-106,40 -116,30 -112,16 C-110,6 -102,2 -100,-10 C-104,-60 -60,-104 2,-104 C70,-104 112,-60 112,0 C112,40 96,70 80,92 L76,120 Z"/>
      <path class="fof-cerebrum" d="M-82,2 C-86,-48 -42,-84 8,-82 C56,-80 90,-48 88,-6 C87,14 76,26 60,30 C42,34 26,30 16,36 C4,44 -18,46 -36,40 C-54,34 -66,26 -72,18 C-78,12 -82,8 -82,2 Z"/>
      <path class="fof-gyri" d="M-60,-40 C-48,-56 -30,-44 -18,-60 M4,-66 C18,-54 30,-70 44,-56 M52,-30 C64,-40 74,-24 80,-34 M-64,-6 C-52,-16 -40,0 -28,-10 M30,-20 C42,-30 52,-14 62,-22"/>
      <path class="fof-cerebellum" d="M46,34 C58,30 76,32 78,46 C78,58 62,64 50,60 C42,56 40,42 46,34 Z"/>
      <path class="fof-stem" d="M16,32 C20,48 22,70 24,130 L38,130 C36,72 34,48 32,30 Z"/>
      <path class="fof-eye" d="M-104,4 C-98,-4 -88,-4 -82,4 C-88,12 -98,12 -104,4 Z"/><circle class="fof-iris" cx="-93" cy="4" r="5"/><circle class="fof-pupil" cx="-93" cy="4" r="2.2"/>
      <ellipse class="fof-spot" data-spot="amyg" style="--sc: var(--c-sym)" cx="2" cy="24" rx="9" ry="6" transform="rotate(-20 2 24)"/>
      <ellipse class="fof-spot" data-spot="hypo" style="--sc: var(--c-brainpart)" cx="-14" cy="8" rx="10" ry="6"/>
      <path data-ipath="see" d="M-82,4 C-60,4 -30,16 -4,23" fill="none"/>
      <path data-ipath="ah" d="M0,20 C-2,13 -6,9 -12,8" fill="none"/>
      <path data-ipath="down" d="M-10,10 C4,14 20,22 25,40 C28,60 30,84 31,124" fill="none"/>
      <g class="fof-ifx"></g>
    </g></g>
    <circle class="fof-inset-ring" r="${r}"/>
  </g>`;
}

const HEART_ICON = 'M0,6 C-10,-2 -12,-10 -6,-13 C-3,-14 -1,-12 0,-9 C1,-12 3,-14 6,-13 C12,-10 10,-2 0,6 Z';
const LUNG_ICON = 'M-2,-12 L-2,-4 C-6,-10 -13,-6 -13,2 C-13,8 -10,11 -6,11 C-3,11 -2,8 -2,4 Z M2,-12 L2,-4 C6,-10 13,-6 13,2 C13,8 10,11 6,11 C3,11 2,8 2,4 Z';
const EYE_ICON = 'M-13,0 C-8,-8 8,-8 13,0 C8,8 -8,8 -13,0 Z';
const GAUGES = [
  { key: 'hr', x: 12, title: 'Heart rate', unit: 'beats per\nminute', icon: HEART_ICON, color: 'var(--c-heart)' },
  { key: 'br', x: 274, title: 'Breathing', unit: 'breaths per\nminute', icon: LUNG_ICON, color: 'var(--c-pns)' },
  { key: 'pu', x: 536, title: 'Pupils', unit: 'pupil size', icon: EYE_ICON, color: 'var(--c-cns)' },
];
const GW = 252, GH = 136, GY = 456;

function gaugesMarkup() {
  return GAUGES.map((g) => `<g class="fof-gauge" data-g="${g.key}" transform="translate(${g.x} ${GY})" style="--gc:${g.color}">
    <rect class="fof-card" width="${GW}" height="${GH}" rx="16"/>
    <path class="fof-gicon" transform="translate(26 30)" d="${g.icon}"/>
    ${g.key === 'pu' ? '<circle class="fof-gicon" transform="translate(26 30)" r="3.5"/>' : ''}
    <text class="fof-g-title" x="46" y="36">${g.title}</text>
    <text class="fof-g-num" x="18" y="88"></text>
    <text class="fof-g-unit" x="18" y="112">${g.unit.split('\n').map((t, i) => `<tspan x="18" ${i ? 'dy="1.15em"' : ''}>${t}</tspan>`).join('')}</text>
    ${g.key === 'pu'
    ? `<g transform="translate(186 82)"><path class="fof-eye" d="M-56,0 C-34,-30 34,-30 56,0 C34,30 -34,30 -56,0 Z"/><circle class="fof-iris" r="22"/><circle class="fof-pupil" data-pupil r="7"/><circle r="3" cx="7" cy="-8" fill="#fff" opacity=".8"/></g>`
    : `<line class="fof-trace-base" x1="124" x2="240" y1="92" y2="92"/><path class="fof-trace"/>`}
  </g>`).join('');
}

function heartTrace(rate) {
  const x0 = 124, x1 = 240, b = 92, n = (rate / 60) * 4; // 4 seconds of trace
  const gap = (x1 - x0) / n;
  let d = `M${x0},${b}`;
  for (let c = x0 + gap * 0.5; c < x1 - 6; c += gap) {
    d += ` L${(c - 6).toFixed(1)},${b} L${(c - 3).toFixed(1)},${b - 3} L${(c - 1.5).toFixed(1)},${b + 4} L${c.toFixed(1)},${b - 26} L${(c + 2).toFixed(1)},${b + 7} L${(c + 4).toFixed(1)},${b} L${(c + 6).toFixed(1)},${b - 3} L${(c + 8).toFixed(1)},${b}`;
  }
  return `${d} L${x1},${b}`;
}
function breathTrace(rate) {
  const x0 = 124, x1 = 240, b = 92, cycles = (rate / 60) * 15; // 15 seconds of trace
  let d = '';
  for (let i = 0; i <= 90; i++) {
    const x = x0 + ((x1 - x0) * i) / 90;
    const y = b - 16 * (1 - Math.cos((i / 90) * cycles * 2 * Math.PI)) / 2;
    d += `${i ? ' L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

const EVAL = [
  { title: 'Tend and befriend', tag: 'Limitation: may not fit females', color: 'var(--c-para)', text: 'Taylor et al. (2000) suggested that females may respond to threat by protecting their young and turning to others for support, rather than fighting or running.',
    icon: '<circle class="ev-ico" cx="24" cy="20" r="8"/><circle class="ev-ico" cx="48" cy="20" r="8"/><path class="ev-ico" d="M12,58 C12,40 36,40 36,58 M36,58 C36,40 60,40 60,58"/><path class="ev-ico" d="M30,40 L42,40"/>' },
  { title: 'Freeze', tag: 'Limitation: an incomplete model', color: 'var(--c-cns)', text: 'Gray (1988) argued that the first response to danger is often to freeze: to stay still and alert, ready to act.',
    icon: '<circle class="ev-ico" cx="36" cy="36" r="26"/><path class="ev-ico" d="M28,24 L28,48 M44,24 L44,48"/>' },
  { title: 'Modern life', tag: 'Limitation: maladaptive today', color: 'var(--c-sym)', text: 'Most stress today, like exams or traffic, does not need fighting or running. Repeated activation may harm health, for example by raising blood pressure.',
    icon: '<rect class="ev-ico" x="16" y="10" width="40" height="52" rx="5"/><path class="ev-ico" d="M25,24 L47,24 M25,34 L47,34 M25,44 L39,44"/>' },
];

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
    dark: false,
    async create(container) {
      injectBodyCSS();
      injectCSS('fof-vis-css', CSS);
      const id = uid('fof');
      const N = (d, cls, part, name = '') => `<path d="${d}" class="bh-nerve ${cls}" data-part="${part}" ${name ? `data-n="${name}"` : ''} style="--nc: var(--c-${cls.split(' ')[0]})"/>`;
      const symKeys = ['symEye', 'symSaliva', 'symLung', 'symHeart', 'symLiver', 'symStomach', 'symAdrenal', 'symGut'];
      const nerves = [
        ...AUTONOMIC.chain.map((d) => N(d, 'sym chain', 'sym')),
        ...symKeys.flatMap((k) => AUTONOMIC[k].map((d, i) => N(d, 'sym', 'sym', `${k}${i}`))),
        ...['vagus', 'paraLung', 'paraEye', 'paraSaliva', 'sacral'].flatMap((k) => AUTONOMIC[k].map((d, i) => N(d, 'para', 'para', `${k}${i}`))),
      ].join('');
      const sweat = ['M133,13 C135,17 136,19 134,21 C132,22 130,20 131,18 C131,16 132,15 133,13 Z', 'M181,150 C183,154 184,156 182,158 C180,159 178,157 179,155 C179,153 180,152 181,150 Z', 'M58,166 C60,170 61,172 59,174 C57,175 55,173 56,171 C56,169 57,168 58,166 Z'];
      const [ix, iy] = INSET.c;
      const head = O(112, 26);
      const ca = Math.atan2(head[1] - iy, head[0] - ix);

      const root = document.createElement('div');
      root.className = 'bhv fof-vis';
      root.innerHTML = `
        <div class="fof-svgwrap">
        <svg class="bh-svg diagram" viewBox="0 0 800 600" role="img" aria-label="Fight or flight diagram">
          ${defs(id)}
          <defs>
            <linearGradient id="${id}-fadeg" x1="0" y1="0" x2="0" y2="1"><stop offset=".64" stop-color="#fff"/><stop offset=".74" stop-color="#000"/></linearGradient>
            <mask id="${id}-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="600"><rect width="800" height="600" fill="url(#${id}-fadeg)"/></mask>
          </defs>
          <g mask="url(#${id}-fade)">
            <g transform="translate(${TX} ${TY}) scale(${S})">
              ${svg.silhouette(id)}
              <g>${svg.lungs()}${svg.liver()}${svg.kidneys('kidneys organ')}${svg.stomach()}${svg.gut()}${svg.heart('heart organ')}${svg.muscles('muscles')}</g>
              ${svg.vessels('vessels')}
              ${nerves}
              ${svg.cord('cord')}${svg.brain('brain')}
              ${svg.adrenals('adrenals')}
              ${svg.eyes('eyes')}
              <g data-part="sweat">${sweat.map((d) => `<path class="bh-sweat" d="${d}"/>`).join('')}</g>
              ${routePaths({ ...ROUTES, cordDown: 'M120,44 L120,214', cordAdrenalL: 'M120,44 L120,214 L113,217 C108,220 102,222 96,224', cordAdrenalR: 'M120,44 L120,212 L127,214 C133,216 139,218 145,220' })}
              <g class="fof-fx"></g>
            </g>
          </g>
          <line class="fof-connector fof-inset" x1="${(ix + INSET.r * Math.cos(ca)).toFixed(1)}" y1="${(iy + INSET.r * Math.sin(ca)).toFixed(1)}" x2="${head[0]}" y2="${head[1]}"/>
          ${insetMarkup(id)}
          ${sceneMarkup(id)}
          <text class="fof-scene-note" x="${SCENE.x + SCENE.w / 2}" y="${SCENE.y + 30}" text-anchor="middle" hidden>The bear has gone</text>
          ${gaugesMarkup()}
          <text class="fof-g-note" x="788" y="448" text-anchor="end">Example numbers</text>
          <g class="fof-labels"></g>
        </svg></div>
        <div class="fof-eval" hidden>
          ${EVAL.map((e) => `<div class="fof-evcard" style="--ec:${e.color}"><svg viewBox="0 0 72 72" aria-hidden="true">${e.icon}</svg><span class="tag">${e.tag}</span><h3>${e.title}</h3><p>${e.text}</p></div>`).join('')}
        </div>
        <div class="bh-foot"><p class="vis-caption" aria-hidden="true"></p></div>`;
      container.append(root);

      const svgRoot = root.querySelector('.bh-svg');
      const wrap = root.querySelector('.fof-svgwrap');
      const evalEl = root.querySelector('.fof-eval');
      const cap = root.querySelector('.vis-caption');
      const bear = svgRoot.querySelector('.fof-bear');
      const note = svgRoot.querySelector('.fof-scene-note');
      const labels = createLabels(svgRoot.querySelector('.fof-labels'), VB);
      const anim = createAnimator(svgRoot.querySelector('.fof-fx'));
      const ianim = createAnimator(svgRoot.querySelector('.fof-ifx'));
      const route = (n) => svgRoot.querySelector(`[data-route="${n}"]`);
      const nerve = (n) => svgRoot.querySelector(`[data-n="${n}"]`);
      const ipath = (n) => svgRoot.querySelector(`[data-ipath="${n}"]`);
      const spot = (n) => svgRoot.querySelector(`[data-spot="${n}"]`);
      const ctl = playAgainButton(root.querySelector('.bh-foot'), () => play(current));
      let current = -1, k = 1;

      // ---- gauges ----
      const G = Object.fromEntries(GAUGES.map((g) => [g.key, svgRoot.querySelector(`[data-g="${g.key}"]`)]));
      let gv = { ...REST };
      function drawGauges(v) {
        gv = v;
        G.hr.querySelector('.fof-g-num').textContent = Math.round(v.hr);
        G.hr.querySelector('.fof-trace').setAttribute('d', heartTrace(v.hr));
        G.br.querySelector('.fof-g-num').textContent = Math.round(v.br);
        G.br.querySelector('.fof-trace').setAttribute('d', breathTrace(v.br));
        G.pu.querySelector('.fof-g-num').textContent = v.pu > 0.5 ? 'Wider' : 'Normal';
        G.pu.querySelector('[data-pupil]').setAttribute('r', lerp(7, 16, v.pu).toFixed(2));
      }
      function sizeGauges() {
        const fm = Math.max(17, 16 * k), fs = Math.max(15, 14.5 * k), fn = Math.max(34, 30 * k);
        svgRoot.querySelectorAll('.fof-g-title').forEach((t) => { t.style.fontSize = `${fm}px`; });
        svgRoot.querySelectorAll('.fof-g-num').forEach((t) => { t.style.fontSize = `${G.pu.contains(t) ? fm * 1.15 : fn}px`; });
        svgRoot.querySelectorAll('.fof-g-unit').forEach((t) => { t.style.fontSize = `${fs}px`; t.style.display = k > 1.7 ? 'none' : ''; });
        svgRoot.querySelectorAll('.fof-g-note, .fof-scene-note').forEach((t) => { t.style.fontSize = `${fs}px`; });
      }
      function tweenGauges(to, dur = 2600) {
        const from = { ...gv };
        return anim.frame(dur, (t) => {
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          drawGauges({ hr: lerp(from.hr, to.hr, e), br: lerp(from.br, to.br, e), pu: lerp(from.pu, to.pu, e) });
        });
      }
      const unwatch = watchScale(svgRoot, VB, (nk) => { k = nk; labels.setScale(nk); sizeGauges(); });
      drawGauges(REST);

      // ---- bear ----
      const BEAR_AT = 'translate(126 112) scale(.62)';
      function bearState(mode, animate) {
        note.toggleAttribute('hidden', mode !== 'out');
        if (mode === 'none') { bear.classList.add('gone'); bear.setAttribute('transform', BEAR_AT); return Promise.resolve(); }
        if (mode === 'on' || !animate || anim.reduced()) {
          bear.classList.toggle('gone', mode === 'out');
          bear.setAttribute('transform', mode === 'out' ? 'translate(230 112) scale(.62)' : BEAR_AT);
          return Promise.resolve();
        }
        if (mode === 'in') {
          bear.classList.remove('gone');
          return anim.frame(1800, (t) => {
            const e = 1 - (1 - t) * (1 - t);
            bear.setAttribute('transform', `translate(${lerp(220, 126, e).toFixed(1)} 112) scale(.62)`);
          });
        }
        // out: walks off to the right and fades
        bear.classList.remove('gone');
        return anim.frame(2600, (t) => {
          bear.setAttribute('transform', `translate(${lerp(126, 240, t).toFixed(1)} 112) scale(-.62 .62)`);
          if (t > 0.6) bear.classList.add('gone');
        });
      }

      async function play(step) {
        const t = anim.clear();
        ianim.clear();
        svgRoot.querySelectorAll('.fof-spot.on').forEach((e) => e.classList.remove('on'));
        const st = STEPS[step];
        const sym = 'var(--c-sym)';
        // gauges start state
        if (st.gauges === 'calm') drawGauges(AROUSED);
        else if (st.gauges === 'aroused') drawGauges(REST);
        else drawGauges(REST);
        const walking = st.bear ? bearState(st.bear, true) : null;
        if (st.bear === 'in') await walking;
        if (!anim.alive(t)) return;
        switch (step) {
          case 1: {
            await ianim.pulse(ipath('see'), { color: 'var(--c-pns)', r: 5, dur: 1400 });
            if (!anim.alive(t)) return;
            spot('amyg').classList.add('on');
            break;
          }
          case 2: {
            spot('amyg').classList.add('on');
            await ianim.pulse(ipath('ah'), { color: sym, r: 5, dur: 800 });
            if (!anim.alive(t)) return;
            spot('hypo').classList.add('on');
            await ianim.pulse(ipath('down'), { color: sym, r: 5, dur: 1200 });
            if (!anim.alive(t)) return;
            await anim.pulse(route('cordDown'), { color: sym, r: 3, dur: 1300 });
            if (!anim.alive(t)) return;
            ['symHeart0', 'symLung0', 'symLung1', 'symEye0', 'symEye1', 'symStomach0', 'symGut0'].forEach((n, i) => anim.pulse(nerve(n), { color: sym, r: 2.4, dur: 1000, delay: i * 120 }));
            break;
          }
          case 3: {
            await Promise.all([anim.pulse(route('cordAdrenalL'), { color: sym, r: 3, dur: 1800 }), anim.pulse(route('cordAdrenalR'), { color: sym, r: 3, dur: 1800 })]);
            if (!anim.alive(t) || anim.reduced()) return;
            svgRoot.querySelectorAll('[data-part="adrenals"] .bh-gland').forEach((g) => { g.classList.remove('bh-arrive'); void g.getBBox(); g.classList.add('bh-arrive'); });
            break;
          }
          case 4: {
            const H = { color: 'var(--c-hormone)', r: 2.6 };
            await Promise.all([anim.stream(route('adrenalLOut'), { ...H, count: 3, spacing: 300, dur: 1400 }), anim.stream(route('adrenalROut'), { ...H, count: 3, spacing: 300, dur: 1400 })]);
            if (!anim.alive(t)) return;
            await Promise.all(['armL', 'armR', 'legL', 'legR', 'headL', 'headR', 'toLungL', 'toLungR'].map((n) => anim.stream(route(n), { ...H, count: 2, spacing: 350, dur: 1700 })));
            break;
          }
          case 5: {
            ['armL', 'armR', 'legL', 'legR'].forEach((n) => anim.stream(route(n), { color: 'var(--c-blood)', r: 2.6, count: 3, spacing: 400, dur: 1600 }));
            await tweenGauges(AROUSED);
            break;
          }
          case 6: {
            ['vagus0', 'paraLung0', 'paraLung1', 'paraEye0', 'paraEye1', 'paraSaliva0', 'paraSaliva1'].forEach((n, i) => anim.pulse(nerve(n), { color: 'var(--c-para)', r: 2.6, dur: n.startsWith('vagus') ? 2600 : 1200, delay: i * 150 }));
            await tweenGauges(REST, 3600);
            break;
          }
          default:
        }
        if (anim.reduced()) {
          // still end-state
          if (step === 1) spot('amyg').classList.add('on');
          if (step === 2) { spot('amyg').classList.add('on'); spot('hypo').classList.add('on'); }
          drawGauges(st.gauges === 'aroused' ? AROUSED : REST);
        }
      }

      return {
        show(step) {
          current = step;
          const inRange = step >= 0 && step < STEPS.length;
          const st = inRange ? STEPS[step] : null;
          const isEval = !!st?.evaluate;
          wrap.hidden = isEval;
          evalEl.hidden = !isEval;
          svgRoot.querySelectorAll('.fof-inset').forEach((g) => g.classList.toggle('show', !!st?.inset));
          labels.setBounds({ left: [st?.inset ? 280 : 12, LABEL_BOTTOM], right: [SCENE.y + SCENE.h + 16, LABEL_BOTTOM] });
          let caption;
          if (!inRange) {
            const data = step < 0 ? { on: [], labels: [] } : RECAP;
            light(svgRoot, data.on);
            labels.set(data.labels);
            anim.clear(); ianim.clear();
            drawGauges(REST);
            bearState(step < 0 ? 'none' : 'on', false);
            caption = step < 0 ? 'A calm walk in the woods' : 'The whole pathway, in order';
          } else {
            caption = st.caption;
            if (!isEval) {
              light(svgRoot, st.on);
              let lbls = st.labels;
              if (st.inset) {
                lbls = [...lbls,
                  { at: IP(2, 24), side: 'manual', x: INSET.c[0], y: INSET.c[1] + INSET.r + 34, anchor: 'middle', text: 'Amygdala', sub: step === 1 ? 'recognises the threat' : 'sends a distress signal', color: 'var(--c-sym)' },
                ];
                if (step === 2) lbls.push({ at: IP(-14, 8), side: 'manual', x: INSET.c[0] + 140, y: 40, anchor: 'start', text: 'Hypothalamus', sub: 'activates the SNS', color: 'var(--c-brainpart)' });
              }
              labels.set(lbls);
              play(step);
            } else {
              anim.clear(); ianim.clear();
            }
          }
          cap.textContent = caption;
          svgRoot.setAttribute('aria-label', `Fight or flight diagram. ${caption}. Heart rate ${Math.round(gv.hr)}, breathing ${Math.round(gv.br)} per minute (example numbers).`);
          ctl.show(inRange && !isEval);
        },
        dispose() { anim.clear(); ianim.clear(); unwatch(); root.remove(); },
      };
    },
  },
};
