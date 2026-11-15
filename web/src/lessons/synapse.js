// Synaptic transmission — AQA 7182 Biopsychology (AS + A-level):
// "The process of synaptic transmission, including reference to neurotransmitters, excitation and inhibition."
// Visual: a large hand-built SVG synapse cross-section on the dark stage. Each step plays only its own
// part of one shared timeline (impulse arrives → vesicles fuse → neurotransmitter diffuses → binds →
// effect), with "Play again". Step 5 lets the learner switch excitatory/inhibitory; step 6 is an
// interactive, learner-paced summation demo with a threshold line. Reduced motion shows still end-states.
import { reducedMotion, get } from '../settings.js';

/* ------------------------------------------------------------------ helpers */
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.append(e);
  return e;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 2.2);
const lerp = (a, b, u) => a + (b - a) * u;
const f1 = (n) => n.toFixed(1);
const place = (el, x, y, k = 1, rot = 0) => el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})${rot ? ` rotate(${rot.toFixed(1)})` : ''}${k !== 1 ? ` scale(${k.toFixed(3)})` : ''}`);
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function makeTweens() {
  let list = [], raf = 0;
  const loop = (now) => {
    const fin = [];
    list = list.filter((tw) => {
      const u = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(u);
      if (u >= 1) { fin.push(tw); return false; }
      return true;
    });
    fin.forEach((tw) => tw.done?.());
    raf = list.length ? requestAnimationFrame(loop) : 0;
  };
  return {
    add(dur, fn, done) {
      if (reducedMotion() || dur <= 0) { fn(1); done?.(); return; }
      list.push({ t0: performance.now(), dur, fn, done });
      if (!raf) raf = requestAnimationFrame(loop);
    },
    clear() { list = []; cancelAnimationFrame(raf); raf = 0; },
  };
}

function label(parent, { at, to, pos = 'right', anchor, text, sub }) {
  const g = s('g', { class: 'lbl' }, parent);
  if (at) {
    s('line', { x1: at[0], y1: at[1], x2: to[0], y2: to[1], class: 'leader' }, g);
    s('circle', { cx: at[0], cy: at[1], r: 4, class: 'leader-dot' }, g);
  }
  const pill = s('rect', { class: 'pill', rx: 10 }, g);
  const [lx, ly] = to;
  const extra = sub ? 22 : 0;
  let x = lx, y = ly, a = 'middle';
  if (pos === 'right') { x = lx + 12; y = ly + 7 - extra / 2; a = 'start'; }
  if (pos === 'left') { x = lx - 12; y = ly + 7 - extra / 2; a = 'end'; }
  if (pos === 'above') { y = ly - 12 - extra; }
  if (pos === 'below') { y = ly + 26; }
  if (pos === 'none') { y = ly + 7 - extra / 2; }
  if (anchor) a = anchor;
  const t = s('text', { x, y, 'text-anchor': a }, g);
  t.append(document.createTextNode(text));
  if (sub) { const ts = s('tspan', { x, dy: 22, class: 'sub' }, t); ts.textContent = sub; }
  g.fit = () => {
    try {
      const b = t.getBBox();
      if (!b.width) return;
      pill.setAttribute('x', f1(b.x - 9)); pill.setAttribute('y', f1(b.y - 4));
      pill.setAttribute('width', f1(b.width + 18)); pill.setAttribute('height', f1(b.height + 8));
    } catch { /* not rendered yet */ }
  };
  return g;
}

/* ------------------------------------------------------------------ look */
const COL = { e: '#FFC65C', i: '#7CC8FF', wrong: '#FF8FB1', pulse: '#9AF4FF', pre: '#9CC1FF', post: '#C8B2FF' };
const SHAPE = {
  e: 'M-6.5,0a6.5,6.5 0 1,0 13,0a6.5,6.5 0 1,0 -13,0',
  i: 'M-7.5,-5 L7.5,-5 L0,7 Z',
  wrong: 'M-6,-6 H6 V6 H-6 Z',
};
const HALF = {
  e: ['M0,-6.5 A6.5,6.5 0 0,0 0,6.5 Z', 'M0,-6.5 A6.5,6.5 0 0,1 0,6.5 Z'],
  i: ['M-7.5,-5 L0,-5 L0,7 Z', 'M0,-5 L7.5,-5 L0,7 Z'],
};
const BOUND_Y = { e: 334, i: 339 };
function receptorD(rx, type) {
  const pocket = type === 'e'
    ? `L${rx - 7.5},334 A7.5,7.5 0 0 0 ${rx + 7.5},334`
    : `L${rx - 8},334 L${rx},346 L${rx + 8},334`;
  return `M${rx - 16},370 L${rx - 16},342 Q${rx - 16},334 ${rx - 9},334 ${pocket} L${rx + 9},334 Q${rx + 16},334 ${rx + 16},342 L${rx + 16},370 Z`;
}

const CSS = `
.syn-vis svg { width: 100%; height: 100%; }
.syn-vis .part { transition: opacity .5s ease; }
.syn-vis .part.dim { opacity: .2; }
.syn-vis .gone { opacity: 0 !important; pointer-events: none; }
.syn-vis .fade { transition: opacity .5s ease; }
.syn-vis .lbl { opacity: 0; transition: opacity .45s ease; pointer-events: none; }
.syn-vis .lbl.on { opacity: 1; }
.syn-vis .leader { stroke: rgb(236 239 247 / 75%); stroke-width: 1.6; }
.syn-vis .leader-dot { fill: #ECEFF7; }
.syn-vis .pill { fill: rgb(8 13 27 / 82%); stroke: rgb(236 239 247 / 18%); stroke-width: 1; }
.syn-vis .diagram text { font-size: 20px; font-weight: 700; letter-spacing: 0; word-spacing: 0; }
.syn-vis .diagram text .sub, .syn-vis .diagram text.sub { font-size: 18px; font-weight: 400; fill: #C3CCE4; }
.syn-vis .diagram text.note { font-size: 18px; font-weight: 400; fill: #C3CCE4; }
.syn-vis .diagram text.big { font-size: 26px; }
.syn-vis .diagram text.glyph { font-size: 26px; }
.syn-vis .diagram text.on-bulb { font-size: 22px; fill: #10131C; }
.syn-vis.calm [filter] { filter: none; }
`;

function defs(svg) {
  const d = s('defs', {}, svg);
  d.innerHTML = `
    <filter id="syn-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="syn-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="syn-pre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22355F"/><stop offset="1" stop-color="#2F4C86"/></linearGradient>
    <linearGradient id="syn-post" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3C2F6B"/><stop offset=".7" stop-color="#271E49"/><stop offset="1" stop-color="#1D1738"/></linearGradient>
    <linearGradient id="syn-rec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2D4FF"/><stop offset="1" stop-color="#8F6FE3"/></linearGradient>
    <radialGradient id="syn-ves" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset="1" stop-color="#9CC1FF" stop-opacity=".06"/></radialGradient>
    <radialGradient id="syn-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9AF4FF" stop-opacity=".8"/><stop offset=".45" stop-color="#3FD8FF" stop-opacity=".28"/><stop offset="1" stop-color="#3FD8FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="syn-soma" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#CBB8FF"/><stop offset=".6" stop-color="#7E62D6"/><stop offset="1" stop-color="#4A3596"/></radialGradient>
    <radialGradient id="syn-bulbE" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF0C9"/><stop offset="1" stop-color="#F0A93A"/></radialGradient>
    <radialGradient id="syn-bulbI" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#E3F4FF"/><stop offset="1" stop-color="#4FA6E8"/></radialGradient>
    <marker id="syn-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ECEFF7"/></marker>`;
}
function spark(parent, r = 9) {
  const g = s('g', { opacity: 0 }, parent);
  s('circle', { r: r * 2.6, fill: 'url(#syn-halo)' }, g);
  s('circle', { r, fill: COL.pulse, filter: 'url(#syn-glow)' }, g);
  return g;
}

/* ------------------------------------------------------------------ main synapse scene */
const PRE_FILL = 'M372,-20 L372,60 C372,112 218,118 216,196 L216,262 Q216,292 246,292 L554,292 Q584,292 584,262 L584,196 C582,118 428,112 428,60 L428,-20 Z';
const PRE_OUT = 'M246,292 Q216,292 216,262 L216,196 C218,118 372,112 372,60 L372,-20 M428,-20 L428,60 C428,112 582,118 584,196 L584,262 Q584,292 554,292';
const RX = [245, 322, 400, 478, 555];
const REL = [{ x: 325, y: 236, fx: 330 }, { x: 400, y: 246, fx: 405 }, { x: 475, y: 236, fx: 480 }];
const STATIC_VES = [[282, 180], [358, 160], [440, 162], [516, 186]];
const OFF = [[-6, -6], [7, -5], [-6, 7], [6, 6]];
// Where each released molecule ends up: r = receptor index (binds), or a free spot in the cleft.
const DEST = [
  [{ r: 1 }, { x: 262, y: 312 }, { x: 296, y: 326 }, { x: 352, y: 306 }],
  [{ r: 2 }, { r: 3 }, { x: 375, y: 322 }, { x: 434, y: 310 }],
  [{ r: 4 }, { x: 452, y: 326 }, { x: 515, y: 308 }, { x: 540, y: 325 }],
];
const TX = [262, 538];
const EZ = [[284, 319], [512, 319]];
const GLYPHS = [[175, 400], [255, 412], [335, 398], [465, 398], [545, 412], [625, 400]];
const T_END = 6800;

function buildMain(svg) {
  const g = s('g', {}, svg);
  const P = {}, Lb = {};
  const st = { type: 'e', wrong: false, meter: false, removal: false };

  // postsynaptic neuron
  P.post = s('g', { class: 'part' }, g);
  s('path', { d: 'M150,348 L650,348 Q680,348 680,378 L680,640 L120,640 L120,378 Q120,348 150,348 Z', fill: 'url(#syn-post)' }, P.post);
  s('path', { d: 'M120,640 L120,378 Q120,348 150,348 L650,348 Q680,348 680,378 L680,640', fill: 'none', stroke: COL.post, 'stroke-width': 3 }, P.post);
  s('path', { d: 'M150,354 L650,354', fill: 'none', stroke: COL.post, 'stroke-width': 1, opacity: 0.35 }, P.post);

  // charge glyphs + meter (excitation / inhibition)
  P.meter = s('g', { class: 'part fade' }, g);
  const glyphs = GLYPHS.map(([x, y]) => { const t = s('text', { x, y, 'text-anchor': 'middle', class: 'glyph', opacity: 0 }, P.meter); return t; });
  const mt = s('text', { x: 400, y: 448, 'text-anchor': 'middle', class: 'note' }, P.meter); mt.textContent = 'Charge inside the postsynaptic neuron';
  s('rect', { x: 240, y: 462, width: 320, height: 16, rx: 8, fill: '#fff', opacity: 0.12 }, P.meter);
  const mfill = s('rect', { x: 400, y: 462, width: 0, height: 16, rx: 8, fill: COL.e }, P.meter);
  s('line', { x1: 400, y1: 454, x2: 400, y2: 486, stroke: '#ECEFF7', 'stroke-width': 2, opacity: 0.7 }, P.meter);
  const mm = s('text', { x: 222, y: 479, 'text-anchor': 'middle', class: 'big' }, P.meter); mm.textContent = '−';
  const mp = s('text', { x: 578, y: 479, 'text-anchor': 'middle', class: 'big' }, P.meter); mp.textContent = '+';
  const mres = s('text', { x: 400, y: 514, 'text-anchor': 'middle', opacity: 0 }, P.meter);

  // receptors
  P.receptors = s('g', { class: 'part' }, g);
  const rec = RX.map((rx) => {
    const body = s('path', { d: receptorD(rx, 'e'), fill: 'url(#syn-rec)' }, P.receptors);
    const glow = s('path', { d: receptorD(rx, 'e'), fill: 'none', stroke: COL.e, 'stroke-width': 2.5, filter: 'url(#syn-soft)', opacity: 0 }, P.receptors);
    return { rx, body, glow };
  });

  // presynaptic terminal
  P.pre = s('g', { class: 'part' }, g);
  s('path', { d: PRE_FILL, fill: 'url(#syn-pre)' }, P.pre);
  s('path', { d: PRE_OUT, fill: 'none', stroke: COL.pre, 'stroke-width': 3 }, P.pre);
  const membrane = s('path', { d: 'M246,292 L554,292', fill: 'none', stroke: COL.pre, 'stroke-width': 3 }, P.pre);
  const glowOut = s('path', { d: PRE_OUT + ' M246,292 L554,292', fill: 'none', stroke: COL.pulse, 'stroke-width': 3, filter: 'url(#syn-glow)', opacity: 0 }, P.pre);
  const omegas = REL.map(() => s('path', { fill: 'none', stroke: COL.pre, 'stroke-width': 2.5, opacity: 0 }, P.pre));

  // reuptake transporters (step 7)
  P.clear = s('g', { class: 'part fade' }, g);
  TX.forEach((x) => {
    s('rect', { x: x - 13, y: 279, width: 9, height: 28, rx: 4.5, fill: '#8FE3FF' }, P.clear);
    s('rect', { x: x + 4, y: 279, width: 9, height: 28, rx: 4.5, fill: '#8FE3FF' }, P.clear);
  });

  // vesicles
  P.vesicles = s('g', { class: 'part' }, g);
  const ves = REL.map((v) => {
    const vg = s('g', {}, P.vesicles);
    const ring = s('circle', { r: 19, fill: 'url(#syn-ves)', stroke: '#CFE0FF', 'stroke-width': 2 }, vg);
    return { ...v, g: vg, ring, cx: v.x, cy: v.y, u2: 0 };
  });
  const statics = [];
  STATIC_VES.forEach(([x, y]) => {
    const vg = s('g', { transform: `translate(${x} ${y})` }, P.vesicles);
    s('circle', { r: 19, fill: 'url(#syn-ves)', stroke: '#CFE0FF', 'stroke-width': 2 }, vg);
    OFF.forEach(([ox, oy]) => statics.push(s('path', { d: SHAPE.e, fill: COL.e, transform: `translate(${ox} ${oy}) scale(.72)` }, vg)));
  });

  // enzymes (step 7) — drawn in the cleft
  EZ.forEach(([x, y]) => s('path', { d: `M${x},${y} L${x + 13},${y - 7} A15,15 0 1,0 ${x + 13},${y + 7} Z`, fill: '#7FE3B5', opacity: 0.95 }, P.clear));

  // neurotransmitter molecules
  P.nt = s('g', { class: 'part' }, g);
  const parts = [];
  DEST.forEach((list, vi) => list.forEach((dst, k) => {
    const el = s('path', { d: SHAPE.e, fill: COL.e, filter: 'url(#syn-soft)' }, P.nt);
    const h1 = s('path', { d: HALF.e[0], fill: COL.e, opacity: 0 }, P.nt);
    const h2 = s('path', { d: HALF.e[1], fill: COL.e, opacity: 0 }, P.nt);
    parts.push({ vi, k, el, h1, h2, ox: OFF[k][0], oy: OFF[k][1], delay: k * 95 + vi * 40, ph: (vi * 4 + k) * 1.7, r: dst.r, tx: dst.r != null ? RX[dst.r] : dst.x, ty: dst.r != null ? 316 : dst.y });
  }));
  parts.forEach((p, i) => {
    p.mode = i % 2 === 0 ? 'reuptake' : 'enzyme';
    if (p.mode === 'reuptake') p.dest = [TX[p.tx < 400 ? 0 : 1], 300];
    else { const e = EZ[p.tx < 400 ? 0 : 1]; p.dest = [e[0] - 2, e[1]]; }
  });
  // a wrong-shaped molecule (lock-and-key step)
  const wrong = s('path', { d: SHAPE.wrong, fill: COL.wrong, filter: 'url(#syn-soft)', opacity: 0 }, g);

  // impulse arriving
  const ap = spark(g, 10);

  // one-way arrow (step 8)
  Lb.oneway = s('g', { class: 'lbl' }, g);
  s('line', { x1: 74, y1: 110, x2: 74, y2: 420, stroke: '#ECEFF7', 'stroke-width': 3, 'marker-end': 'url(#syn-arrow)', opacity: 0.85 }, Lb.oneway);
  const ow1 = s('text', { x: 74, y: 456, 'text-anchor': 'middle' }, Lb.oneway); ow1.textContent = 'One way';
  const ow2 = s('text', { x: 74, y: 478, 'text-anchor': 'middle', class: 'sub' }, Lb.oneway); ow2.textContent = 'only';

  // labels
  Lb.pre = label(g, { at: [540, 150], to: [650, 150], pos: 'above', text: 'Presynaptic neuron', sub: '(terminal button)' });
  Lb.cleft = label(g, { at: [560, 320], to: [600, 252], pos: 'right', text: 'Synaptic cleft', sub: '(the gap)' });
  Lb.post = label(g, { to: [400, 410], pos: 'none', text: 'Postsynaptic neuron' });
  Lb.ap = label(g, { at: [428, 30], to: [520, 40], pos: 'right', text: 'Action potential', sub: '(electrical)' });
  Lb.vesicle = label(g, { at: [535, 186], to: [600, 186], pos: 'right', text: 'Synaptic vesicle' });
  Lb.nt = label(g, { at: [276, 174], to: [150, 122], pos: 'above', text: 'Neurotransmitter' });
  Lb.exo = label(g, { at: [480, 292], to: [610, 296], pos: 'right', text: 'Exocytosis', sub: '(release)' });
  Lb.diff = label(g, { at: [548, 318], to: [610, 296], pos: 'right', text: 'Diffusion', sub: 'across the gap' });
  Lb.receptor = label(g, { at: [571, 356], to: [660, 392], pos: 'right', text: 'Receptor', sub: '(protein)' });
  Lb.wrong = label(g, { at: [200, 305], to: [120, 252], pos: 'above', text: 'Wrong shape', sub: 'cannot bind' });
  Lb.reuptake = label(g, { at: [262, 284], to: [150, 236], pos: 'above', text: 'Reuptake', sub: 'taken back in' });
  Lb.enzyme = label(g, { at: [526, 319], to: [640, 300], pos: 'right', text: 'Enzyme', sub: 'breaks it down' });
  Lb.elec = label(g, { at: [428, 30], to: [520, 40], pos: 'right', text: 'Electrical', sub: 'inside the neuron' });
  Lb.chem = label(g, { at: [560, 320], to: [600, 252], pos: 'right', text: 'Chemical', sub: 'across the gap' });
  Lb.clearMsg = label(g, { to: [400, 320], pos: 'none', text: 'The gap is clear' });

  function setType(type) {
    st.type = type;
    const c = COL[type];
    parts.forEach((p) => { p.el.setAttribute('d', SHAPE[type]); p.el.setAttribute('fill', c); p.h1.setAttribute('d', HALF[type][0]); p.h2.setAttribute('d', HALF[type][1]); p.h1.setAttribute('fill', c); p.h2.setAttribute('fill', c); });
    statics.forEach((el) => { el.setAttribute('d', SHAPE[type]); el.setAttribute('fill', c); });
    rec.forEach((r) => { const d = receptorD(r.rx, type); r.body.setAttribute('d', d); r.glow.setAttribute('d', d); r.glow.setAttribute('stroke', c); });
    glyphs.forEach((t) => { t.textContent = type === 'e' ? '+' : '−'; t.setAttribute('style', `fill:${c}`); });
    mfill.setAttribute('fill', c);
    mres.textContent = type === 'e' ? 'More likely to fire (excitation)' : 'Less likely to fire (inhibition)';
  }

  // where a molecule sits at time t of the main timeline
  function ntPos(p, t) {
    const v = ves[p.vi];
    if (t < 2950 + p.delay) {
      const sq = 1 - 0.55 * v.u2;
      return { x: v.cx + p.ox * sq, y: v.cy + p.oy * sq, k: 0.72, op: 1 };
    }
    const u = seg(t, 2950 + p.delay, 4750 + p.delay * 0.5);
    const e = easeOut(u);
    const sx = v.fx + p.ox * 0.4, sy = 297;
    let x = lerp(sx, p.tx, e) + Math.sin(u * Math.PI * 2.6 + p.ph) * 10 * Math.sin(Math.PI * u);
    let y = lerp(sy, p.ty, e) + Math.sin(u * Math.PI * 3.3 + p.ph * 0.7) * 3 * Math.sin(Math.PI * u);
    if (p.r != null) {
      const b = ease(seg(t, 5000, 5450));
      x = lerp(x, p.tx, b); y = lerp(y, BOUND_Y[st.type], b);
    }
    return { x, y, k: lerp(0.72, 1, seg(t, 2950 + p.delay, 3250 + p.delay)), op: 1 };
  }

  function render(t) {
    // 1. action potential arrives
    const a = seg(t, 0, 1200);
    place(ap, 400, lerp(-30, 180, ease(a)));
    ap.setAttribute('opacity', t <= 0 ? 0 : (1 - seg(t, 1150, 1500)).toFixed(2));
    glowOut.setAttribute('opacity', (seg(t, 950, 1300) * (1 - 0.85 * seg(t, 3200, 4400))).toFixed(2));
    // 2. vesicles move to the membrane and fuse
    ves.forEach((v, k) => {
      const u1 = ease(seg(t, 1500 + k * 120, 2600 + k * 120));
      const u2 = ease(seg(t, 2650 + k * 60, 2950 + k * 60));
      v.cx = lerp(v.x, v.fx, u1); v.cy = lerp(lerp(v.y, 271, u1), 290, u2); v.u2 = u2;
      place(v.g, v.cx, v.cy);
      v.ring.setAttribute('opacity', (1 - u2).toFixed(2));
      const r = 19 * (1 - seg(t, 2950, 3800));
      const om = omegas[k];
      if (u2 > 0.6 && r > 0.5) { om.setAttribute('d', `M${f1(v.fx - r)},292 A${f1(r)},${f1(r)} 0 0 1 ${f1(v.fx + r)},292`); om.setAttribute('opacity', 0.9); } else om.setAttribute('opacity', 0);
    });
    const w = 20 * seg(t, 2750, 2950) * (1 - seg(t, 3800, 4300));
    let dash = [], prev = 246;
    REL.forEach((v) => { dash.push(Math.max(0, v.fx - w / 2 - prev), w); prev = v.fx + w / 2; });
    dash.push(554 - prev + 10, 0.01);
    membrane.setAttribute('stroke-dasharray', dash.map(f1).join(' '));
    // 3–4. diffusion and binding
    parts.forEach((p) => {
      const q = ntPos(p, t);
      place(p.el, q.x, q.y, q.k); p.el.setAttribute('opacity', q.op); p.x = q.x; p.y = q.y;
      p.h1.setAttribute('opacity', 0); p.h2.setAttribute('opacity', 0);
    });
    rec.forEach((r, k) => r.glow.setAttribute('opacity', k > 0 ? seg(t, 5300, 5650).toFixed(2) : 0));
    // wrong-shaped molecule bounces off the empty receptor
    if (st.wrong) {
      const u1 = ease(seg(t, 4700, 5250)), u2 = easeOut(seg(t, 5250, 5950));
      const x = u2 > 0 ? lerp(245, 200, u2) : lerp(214, 245, u1);
      const y = u2 > 0 ? lerp(322, 305, u2) - Math.sin(Math.PI * u2) * 16 : lerp(296, 322, u1);
      place(wrong, x, y, 1, 25 * u2);
      wrong.setAttribute('opacity', seg(t, 4600, 4800).toFixed(2));
    } else wrong.setAttribute('opacity', 0);
    // 5. effect on the postsynaptic neuron
    effect(seg(t, 5600, 6600), t);
  }
  function effect(u, t) {
    const val = (st.type === 'e' ? 1 : -1) * ease(u) * 2;
    mfill.setAttribute('x', f1(val >= 0 ? 400 : 400 + val * 80));
    mfill.setAttribute('width', f1(Math.abs(val) * 80));
    glyphs.forEach((gl, i) => gl.setAttribute('opacity', seg(u, 0.1 + i * 0.1, 0.5 + i * 0.1).toFixed(2)));
    mres.setAttribute('opacity', seg(u, 0.6, 1).toFixed(2));
  }

  // step 7: removal, starting from the end of the main timeline
  function renderRemoval(r) {
    render(T_END);
    rec.forEach((rc, k) => rc.glow.setAttribute('opacity', k > 0 ? (1 - seg(r, 0, 400)).toFixed(2) : 0));
    effect(1 - seg(r, 300, 2300), 0);
    parts.forEach((p, i) => {
      let x = p.tx, y = p.r != null ? BOUND_Y[st.type] : p.ty;
      const ub = ease(seg(r, 0, 500));
      if (p.r != null) y = lerp(y, 314, ub);
      const d = 350 + i * 105;
      const u = ease(seg(r, d, d + 1250));
      x = lerp(x, p.dest[0], u); y = lerp(y, p.dest[1], u);
      let op = 1;
      p.h1.setAttribute('opacity', 0); p.h2.setAttribute('opacity', 0);
      if (p.mode === 'reuptake') {
        const u2 = ease(seg(r, d + 1250, d + 1750));
        y = lerp(y, 262, u2);
        op = 1 - seg(r, d + 1550, d + 1900);
      } else {
        const u2 = seg(r, d + 1250, d + 1900);
        if (u2 > 0) {
          op = 0;
          const hop = (1 - seg(u2, 0.5, 1)).toFixed(2);
          place(p.h1, x - 2 - 12 * u2, y + 5 * u2); place(p.h2, x + 2 + 12 * u2, y - 5 * u2);
          p.h1.setAttribute('opacity', hop); p.h2.setAttribute('opacity', hop);
        }
      }
      place(p.el, x, y); p.el.setAttribute('opacity', op.toFixed(2));
    });
    Lb.clearMsg.classList.toggle('on', r >= 3500);
  }

  function configure(plan) {
    st.wrong = !!plan.wrong;
    setType(plan.type || 'e');
    P.meter.classList.toggle('gone', !plan.meter);
    P.clear.classList.toggle('gone', !plan.removal);
  }
  return { g, P, Lb, render, renderRemoval, configure, setType, st };
}

/* ------------------------------------------------------------------ summation scene */
function buildSum(svg) {
  const g = s('g', {}, svg);
  const Lb = {};
  const SX = 330, SY = 330, R = 64;
  const rand = rng(3);
  const col = '#A891F0';
  // dendrites of the postsynaptic neuron
  const dg = s('g', { fill: 'none', stroke: col, 'stroke-linecap': 'round' }, g);
  const tree = (x, y, ang, gen, W, L) => {
    const len = L[gen] * (0.85 + rand() * 0.3), bend = (rand() - 0.5) * 0.5;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    s('path', { d: `M${f1(x)},${f1(y)} Q${f1(x + Math.cos(ang + bend) * len * 0.55)},${f1(y + Math.sin(ang + bend) * len * 0.55)} ${f1(x2)},${f1(y2)}`, 'stroke-width': W[gen] }, dg);
    if (gen < L.length - 1) { const sp = 0.4 + rand() * 0.2; tree(x2, y2, ang - sp, gen + 1, W, L); tree(x2, y2, ang + sp, gen + 1, W, L); }
  };
  [296, 64].forEach((deg) => { const a = (deg * Math.PI) / 180; tree(SX + Math.cos(a) * (R - 6), SY + Math.sin(a) * (R - 6), a, 0, [8, 4.5, 2.5], [40, 28, 18]); });
  // axon
  s('path', { d: `M${SX + R - 10},${SY - 14} Q${SX + R + 12},${SY - 5} ${SX + R + 26},${SY - 4} L${SX + R + 26},${SY + 4} Q${SX + R + 12},${SY + 5} ${SX + R - 10},${SY + 14}Z`, fill: col }, g);
  s('line', { x1: SX + R + 20, y1: SY, x2: 590, y2: SY, stroke: col, 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
  // soma
  const somaGlow = s('circle', { cx: SX, cy: SY, r: R + 8, fill: 'none', stroke: COL.e, 'stroke-width': 8, filter: 'url(#syn-glow)', opacity: 0 }, g);
  s('circle', { cx: SX, cy: SY, r: R, fill: 'url(#syn-soma)' }, g);
  s('circle', { cx: SX - 4, cy: SY - 4, r: 18, fill: '#E4DCFF', opacity: 0.55 }, g);

  // inputs: two excitatory synapses, one inhibitory synapse
  const inputs = [
    { kind: 'e', deg: 235, from: [150, 92], ctrl: [215, 150] },
    { kind: 'e', deg: 180, from: [30, 300], ctrl: [140, 318] },
    { kind: 'i', deg: 125, from: [130, 548], ctrl: [215, 470] },
  ].map((inp) => {
    const a = (inp.deg * Math.PI) / 180;
    const bx = SX + Math.cos(a) * (R + 22), by = SY + Math.sin(a) * (R + 22);
    const cx = SX + Math.cos(a) * (R + 2), cy = SY + Math.sin(a) * (R + 2);
    const c = COL[inp.kind];
    s('path', { d: `M${inp.from[0]},${inp.from[1]} Q${inp.ctrl[0]},${inp.ctrl[1]} ${f1(bx - Math.cos(a) * 10)},${f1(by - Math.sin(a) * 10)}`, fill: 'none', stroke: c, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.85 }, g);
    s('circle', { cx: f1(bx), cy: f1(by), r: 17, fill: inp.kind === 'e' ? 'url(#syn-bulbE)' : 'url(#syn-bulbI)' }, g);
    const t = s('text', { x: f1(bx), y: f1(by + 7.5), 'text-anchor': 'middle', class: 'on-bulb' }, g); t.textContent = inp.kind === 'e' ? '+' : '−';
    return { ...inp, bx, by, cx, cy, dots: [0, 1, 2, 3].map(() => s('path', { d: SHAPE[inp.kind], fill: c, opacity: 0, filter: 'url(#syn-soft)' }, g)) };
  });
  Lb.e = label(g, { at: [inputs[0].bx + 6, inputs[0].by - 12], to: [330, 166], pos: 'right', text: 'Excitatory synapses (+)' });
  Lb.i = label(g, { at: [inputs[2].bx + 8, inputs[2].by + 12], to: [318, 478], pos: 'right', text: 'Inhibitory synapse (−)' });

  // meter with threshold
  const MX = 701, Y0 = 320, U = 40, TH = 3;
  const yOf = (v) => Y0 - v * U;
  s('rect', { x: MX - 13, y: 150, width: 26, height: 340, rx: 13, fill: '#fff', opacity: 0.1 }, g);
  const fill = s('rect', { x: MX - 11, y: Y0, width: 22, height: 0, rx: 9, fill: COL.e }, g);
  s('line', { x1: MX - 22, y1: Y0, x2: MX + 22, y2: Y0, stroke: '#ECEFF7', 'stroke-width': 2, opacity: 0.7 }, g);
  s('line', { x1: 620, y1: yOf(TH), x2: MX + 26, y2: yOf(TH), stroke: '#FFE7A6', 'stroke-width': 2.5, 'stroke-dasharray': '7 6' }, g);
  const tl = s('text', { x: 676, y: yOf(TH) - 10, 'text-anchor': 'end' }, g); tl.textContent = 'Threshold';
  const rl = s('text', { x: 676, y: Y0 + 26, 'text-anchor': 'end', class: 'note' }, g); rl.textContent = 'Resting';
  const pl = s('text', { x: MX + 22, y: 172, class: 'big' }, g); pl.textContent = '+';
  const ml = s('text', { x: MX + 22, y: 490, class: 'big' }, g); ml.textContent = '−';
  const net = s('text', { x: MX, y: 132, 'text-anchor': 'middle', class: 'big' }, g);
  const marker = s('circle', { cx: MX, cy: Y0, r: 9, fill: '#ECEFF7' }, g);

  // firing
  const sp = spark(g, 9);
  Lb.fire = label(g, { to: [500, 276], pos: 'none', text: 'It fires!', sub: 'action potential' });

  const tw = makeTweens();
  const state = { v: 0, shown: 0, n: 0 };
  let onChange = () => {};
  function drawMeter(v) {
    const y = yOf(v);
    fill.setAttribute('y', f1(Math.min(y, Y0))); fill.setAttribute('height', f1(Math.abs(Y0 - y)));
    fill.setAttribute('fill', v >= 0 ? COL.e : COL.i);
    marker.setAttribute('cy', f1(y));
  }
  function setNet(v) { net.textContent = `Net ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`; }
  function fire() {
    Lb.fire.fit(); Lb.fire.classList.add('on');
    tw.add(1100, (u) => {
      place(sp, lerp(SX + R + 24, 590, ease(u)), SY); sp.setAttribute('opacity', u < 1 ? 1 : 0);
      somaGlow.setAttribute('opacity', (Math.sin(Math.PI * Math.min(1, u * 1.6)) * 0.9).toFixed(2));
      somaGlow.setAttribute('stroke', COL.e);
    }, () => { sp.setAttribute('opacity', 0); somaGlow.setAttribute('opacity', 0); });
  }
  function send(kind) {
    const before = state.v;
    state.v = Math.max(-4, Math.min(4, state.v + (kind === 'e' ? 1 : -1)));
    const src = kind === 'e' ? inputs[state.n++ % 2] : inputs[2];
    const from = state.shown, to = state.v;
    setNet(to);
    tw.add(520, (u) => {
      src.dots.forEach((d, k) => {
        const uu = seg(u, k * 0.08, 0.7 + k * 0.08);
        place(d, lerp(src.bx, src.cx, uu) + (k - 1.5) * 4 * Math.sin(Math.PI * uu), lerp(src.by, src.cy, uu) + (k - 1.5) * 3, 0.8);
        d.setAttribute('opacity', uu > 0 && uu < 1 ? 1 : 0);
      });
    }, () => {
      somaGlow.setAttribute('stroke', COL[kind]);
      tw.add(500, (u) => {
        state.shown = lerp(from, to, ease(u)); drawMeter(state.shown);
        somaGlow.setAttribute('opacity', (Math.sin(Math.PI * u) * 0.6).toFixed(2));
      }, () => {
        state.shown = to; drawMeter(to);
        if (before < TH && to >= TH) fire();
        if (to < TH) Lb.fire.classList.remove('on');
      });
    });
    onChange(state.v);
  }
  function reset() {
    tw.clear();
    state.v = 0; state.shown = 0; state.n = 0;
    drawMeter(0); setNet(0);
    sp.setAttribute('opacity', 0); somaGlow.setAttribute('opacity', 0);
    inputs.forEach((i) => i.dots.forEach((d) => d.setAttribute('opacity', 0)));
    Lb.fire.classList.remove('on');
    onChange(0);
  }
  return { g, P: {}, Lb, send, reset, tw, TH, set onChange(fn) { onChange = fn; }, get v() { return state.v; } };
}

/* ------------------------------------------------------------------ step plan */
const PLAN = [
  { scene: 'main', at: 0, labels: ['pre', 'cleft', 'post'], cap: 'A synapse: two neurons and the tiny gap between them' },
  { scene: 'main', range: [0, 1700], lit: ['pre', 'vesicles', 'nt'], labels: ['ap'], cap: 'Step 1: the action potential arrives at the presynaptic terminal' },
  { scene: 'main', range: [1300, 3700], lit: ['pre', 'vesicles', 'nt'], labels: ['vesicle', 'nt', 'exo'], cap: 'Step 2: vesicles fuse with the membrane and release neurotransmitter' },
  { scene: 'main', range: [2900, 5000], lit: ['nt'], labels: ['diff'], cap: 'Step 3: the neurotransmitter diffuses across the synaptic cleft' },
  { scene: 'main', range: [4500, 6100], lit: ['nt', 'receptors'], labels: ['receptor', 'wrong'], wrong: true, cap: 'Step 4: it binds only to receptors with the matching shape' },
  { scene: 'main', range: [2900, 6800], lit: ['nt', 'receptors', 'post', 'meter'], meter: true, ei: true, cap: '' },
  { scene: 'sum', cap: '' },
  { scene: 'main', removal: true, lit: ['pre', 'nt', 'clear', 'receptors', 'meter'], meter: true, labels: ['reuptake', 'enzyme'], cap: 'Step 7: reuptake and enzymes clear the neurotransmitter away' },
  { scene: 'main', range: [0, 6800], meter: true, labels: ['elec', 'chem', 'oneway'], cap: 'Electrical inside the neuron, chemical across the gap, one way only' },
];
const INTRO = PLAN[0];
const RECAP = { scene: 'main', at: T_END, meter: true, labels: ['elec', 'chem', 'oneway'], cap: 'The whole process, from top to bottom' };
const EI_CAP = { e: 'Excitatory: the inside becomes more positive, so it is more likely to fire', i: 'Inhibitory: the inside becomes more negative, so it is less likely to fire' };

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
      const wrap = document.createElement('div');
      wrap.className = 'fill syn-vis';
      const style = document.createElement('style'); style.textContent = CSS; wrap.append(style);
      container.append(wrap);
      const svg = s('svg', { viewBox: '0 0 800 600', class: 'diagram', role: 'img', preserveAspectRatio: 'xMidYMid meet' }, wrap);
      defs(svg);
      const controls = document.createElement('div'); controls.className = 'vis-controls'; container.append(controls);
      const cap = document.createElement('p'); cap.className = 'vis-caption'; container.append(cap);
      const live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); container.append(live);

      const main = buildMain(svg);
      const sum = buildSum(svg);
      const scenes = { main, sum };
      const tw = makeTweens();
      let current = null, eiType = 'e';

      const setCap = (text) => { cap.textContent = text; svg.setAttribute('aria-label', text); };
      const fitLabels = (sc) => Object.values(sc.Lb).forEach((l) => l.fit?.());
      document.fonts?.ready?.then(() => { if (current) fitLabels(scenes[current.scene]); });

      const btn = (text, onClick, extra = {}) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
        for (const k in extra) b.setAttribute(k, extra[k]);
        b.addEventListener('click', onClick); controls.append(b); return b;
      };

      function play(plan) {
        tw.clear();
        if (plan.removal) { main.renderRemoval(0); tw.add(3900, (u) => main.renderRemoval(u * 3900)); return; }
        if (plan.range) {
          const [a, b] = plan.range;
          main.render(a);
          tw.add(b - a, (u) => main.render(a + (b - a) * u));
        } else main.render(plan.at ?? 0);
      }

      const sumCaption = (v) => {
        if (v === 0 && !sum.touched) return 'Send signals with the buttons. It fires at the threshold.';
        const n = `Net ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}.`;
        if (v >= sum.TH) return `${n} Threshold reached: the neuron fires!`;
        if (v < 0) return `${n} Inhibition is winning, so it does not fire.`;
        return `${n} Below the threshold, so it does not fire yet.`;
      };
      sum.onChange = (v) => { const c = sumCaption(v); setCap(c); live.textContent = c; };

      function show(step) {
        const plan = step < 0 ? INTRO : step >= PLAN.length ? RECAP : PLAN[step];
        current = plan;
        tw.clear(); sum.tw.clear();
        wrap.classList.toggle('calm', get('calm') === 'true');
        for (const [k, sc] of Object.entries(scenes)) sc.g.style.display = k === plan.scene ? '' : 'none';
        const sc = scenes[plan.scene];
        for (const [k, el] of Object.entries(sc.P)) el.classList.toggle('dim', !!plan.lit && !plan.lit.includes(k));
        for (const [k, el] of Object.entries(sc.Lb)) el.classList.toggle('on', (plan.labels || []).includes(k) || (plan.scene === 'sum' && (k === 'e' || k === 'i')));
        fitLabels(sc);
        controls.innerHTML = '';
        live.textContent = '';
        const motion = !reducedMotion();

        if (plan.scene === 'sum') {
          sum.touched = false;
          sum.reset();
          btn('+ Excitatory', () => { sum.touched = true; sum.send('e'); }, { 'aria-label': 'Send an excitatory signal (plus one)' });
          btn('− Inhibitory', () => { sum.touched = true; sum.send('i'); }, { 'aria-label': 'Send an inhibitory signal (minus one)' });
          btn('Reset', () => { sum.touched = false; sum.reset(); });
          return;
        }

        main.configure({ ...plan, type: plan.ei ? eiType : 'e' });
        if (plan.ei) {
          const setEi = (type) => {
            eiType = type;
            bE.setAttribute('aria-pressed', String(type === 'e')); bI.setAttribute('aria-pressed', String(type === 'i'));
            main.configure({ ...plan, type });
            setCap(EI_CAP[type]);
            play(plan);
          };
          const bE = btn('+ Excitatory', () => setEi('e'));
          const bI = btn('− Inhibitory', () => setEi('i'));
          if (motion) btn('↻ Play again', () => play(plan));
          setEi(eiType);
          return;
        }
        setCap(plan.cap);
        if ((plan.range || plan.removal) && motion) btn('↻ Play again', () => play(plan));
        play(plan);
      }

      return { show, dispose() { tw.clear(); sum.tw.clear(); wrap.remove(); controls.remove(); cap.remove(); live.remove(); } };
    },
  },
};
