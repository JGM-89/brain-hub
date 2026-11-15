// Neurons — AQA 7182 Biopsychology (AS + A-level):
// "The structure and function of sensory, relay and motor neurons."
// Visual: hand-built SVG scenes on the dark stage —
//   1. an anatomical neuron whose parts light up step by step (leader-line labels),
//   2. a zoomed-in axon race: myelinated (jumps node to node) v. unmyelinated,
//   3. sensory, relay and motor neurons side by side at their typical shapes,
//   4. a reflex arc (hot object → receptor → sensory → relay → motor → muscle).
// Every animation plays once (with a "Play again" button) and shows a still end-state when
// reducedMotion() is on.
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
const lerp = (a, b, u) => a + (b - a) * u;
const f1 = (n) => n.toFixed(1);
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// One rAF loop for all tweens. In reduced-motion mode a tween jumps straight to its end.
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

// A label: dot on the part, leader line, text on a soft dark pill.
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
  if (pos === 'none') { y = ly + 7; }
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

/* ------------------------------------------------------------------ palette */
const C = {
  cell: '#F4A28A', next: '#8FB6FF', pulse: '#9AF4FF',
  sens: '#FFB27D', relay: '#B9A2FF', motor: '#6FD8C4',
};

const CSS = `
.nrn-vis svg { width: 100%; height: 100%; }
.nrn-vis .part { transition: opacity .5s ease; }
.nrn-vis .part.dim { opacity: .16; }
.nrn-vis .part.gone { opacity: 0; }
.nrn-vis .lbl { opacity: 0; transition: opacity .45s ease; pointer-events: none; }
.nrn-vis .lbl.on { opacity: 1; }
.nrn-vis .leader { stroke: rgb(236 239 247 / 75%); stroke-width: 1.6; }
.nrn-vis .leader-dot { fill: #ECEFF7; }
.nrn-vis .pill { fill: rgb(8 13 27 / 80%); stroke: rgb(236 239 247 / 18%); stroke-width: 1; }
.nrn-vis .diagram text { font-size: 20px; font-weight: 700; letter-spacing: 0; word-spacing: 0; }
.nrn-vis .diagram text .sub, .nrn-vis .diagram text.sub { font-size: 18px; font-weight: 400; fill: #C3CCE4; }
.nrn-vis .diagram text.h { font-size: 22px; }
.nrn-vis .diagram text.note { font-size: 18px; font-weight: 400; fill: #C3CCE4; }
.nrn-vis .diagram text.ok { font-size: 18px; fill: #9AF4FF; }
.nrn-vis.calm [filter] { filter: none; }
`;

function defs(svg) {
  const d = s('defs', {}, svg);
  d.innerHTML = `
    <filter id="nrn-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="nrn-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="nrn-soma" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE3D8"/><stop offset=".55" stop-color="#F4A28A"/><stop offset="1" stop-color="#C9654F"/></radialGradient>
    <radialGradient id="nrn-nuc" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#C9BDFF"/><stop offset=".6" stop-color="#7E6BEA"/><stop offset="1" stop-color="#4C3AB8"/></radialGradient>
    <linearGradient id="nrn-my" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF5D6"/><stop offset=".45" stop-color="#F5CD6E"/><stop offset="1" stop-color="#B8842A"/></linearGradient>
    <linearGradient id="nrn-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9CC"/><stop offset=".5" stop-color="#F4A28A"/><stop offset="1" stop-color="#BE5C48"/></linearGradient>
    <radialGradient id="nrn-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9AF4FF" stop-opacity=".75"/><stop offset=".45" stop-color="#3FD8FF" stop-opacity=".28"/><stop offset="1" stop-color="#3FD8FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="nrn-warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF0C2" stop-opacity=".9"/><stop offset=".5" stop-color="#FFC27A" stop-opacity=".3"/><stop offset="1" stop-color="#FFC27A" stop-opacity="0"/></radialGradient>
    <radialGradient id="nrn-g-sens" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE6D2"/><stop offset="1" stop-color="${C.sens}"/></radialGradient>
    <radialGradient id="nrn-g-relay" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#EEE6FF"/><stop offset="1" stop-color="${C.relay}"/></radialGradient>
    <radialGradient id="nrn-g-motor" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#DDFBF4"/><stop offset="1" stop-color="${C.motor}"/></radialGradient>
    <radialGradient id="nrn-muscle" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#FFC2CB"/><stop offset=".6" stop-color="#E8798A"/><stop offset="1" stop-color="#B44A5C"/></radialGradient>
    <linearGradient id="nrn-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6DCC4"/><stop offset="1" stop-color="#D9A47E"/></linearGradient>
    <linearGradient id="nrn-hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB36B"/><stop offset="1" stop-color="#D8452F"/></linearGradient>
    <radialGradient id="nrn-cord" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3A4E7C"/><stop offset="1" stop-color="#26355A"/></radialGradient>
    <marker id="nrn-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ECEFF7"/></marker>`;
}

// A glowing impulse "spark": bright core + soft halo.
function spark(parent, r = 9) {
  const g = s('g', { opacity: 0 }, parent);
  s('circle', { r: r * 2.6, fill: 'url(#nrn-halo)' }, g);
  s('circle', { r, fill: C.pulse, filter: 'url(#nrn-glow)' }, g);
  return g;
}
const place = (el, x, y, k = 1) => el.setAttribute('transform', `translate(${f1(x)} ${f1(y)})${k !== 1 ? ` scale(${k.toFixed(3)})` : ''}`);

// Branching dendrite tree (seeded so it looks the same every time).
function tree(parent, rand, x, y, ang, gen, W, L, chain) {
  const len = L[gen] * (0.85 + rand() * 0.3);
  const bend = (rand() - 0.5) * 0.6;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  const mx = x + Math.cos(ang + bend) * len * 0.55, my = y + Math.sin(ang + bend) * len * 0.55;
  s('path', { d: `M${f1(x)},${f1(y)} Q${f1(mx)},${f1(my)} ${f1(x2)},${f1(y2)}`, 'stroke-width': W[gen] }, parent);
  if (chain) chain.push([x2, y2]);
  if (gen < L.length - 1) {
    const sp = 0.36 + rand() * 0.24;
    tree(parent, rand, x2, y2, ang - sp, gen + 1, W, L, chain);
    tree(parent, rand, x2, y2, ang + sp, gen + 1, W, L, null);
  }
}
const rad = (deg) => (deg * Math.PI) / 180;

/* ------------------------------------------------------------------ scene 1: anatomy */
function buildAnatomy(svg) {
  const g = s('g', {}, svg);
  const P = {}, Lb = {};
  const SX = 205, SY = 300, R0 = 40;
  const rand = rng(11);

  // next neuron (only shown in the terminal-buttons step)
  P.next = s('g', { class: 'part', fill: 'none', stroke: C.next, 'stroke-linecap': 'round' }, g);
  s('path', { d: 'M830,262 Q780,270 746,293', 'stroke-width': 7 }, P.next);
  s('path', { d: 'M792,268 Q776,244 768,222', 'stroke-width': 3.5 }, P.next);
  s('path', { d: 'M812,266 Q790,320 750,352', 'stroke-width': 5 }, P.next);
  s('path', { d: 'M780,315 Q800,345 804,372', 'stroke-width': 3 }, P.next);

  // dendrites
  P.dendrites = s('g', { class: 'part', fill: 'none', stroke: C.cell, 'stroke-linecap': 'round' }, g);
  const W = [8, 5.2, 3.4, 2.2], L = [46, 32, 22, 15];
  const chain = [];
  const roots = [[180, 0], [214, 0], [148, 0], [250, 1], [112, 1]];
  roots.forEach(([deg, gen], k) => {
    const a = rad(deg);
    const x0 = SX + Math.cos(a) * (R0 - 6), y0 = SY + Math.sin(a) * (R0 - 6);
    if (k === 0) chain.push([x0, y0]);
    tree(P.dendrites, rand, x0, y0, a, gen, W.slice(gen), L.slice(gen), k === 0 ? chain : null);
  });

  // cell body (blob) + nucleus
  P.soma = s('g', { class: 'part' }, g);
  const pts = [];
  for (let i = 0; i < 44; i++) {
    const th = (i / 44) * Math.PI * 2;
    const r = R0 + 4 * Math.sin(3 * th + 0.5) + 2.5 * Math.cos(5 * th);
    pts.push([SX + Math.cos(th) * r, SY + Math.sin(th) * r]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[43], pts[0]).map(f1)}`;
  pts.forEach((p, i) => { const m = mid(p, pts[(i + 1) % 44]); d += ` Q${f1(p[0])},${f1(p[1])} ${f1(m[0])},${f1(m[1])}`; });
  s('path', { d: d + 'Z', fill: 'url(#nrn-soma)' }, P.soma);
  P.nucleus = s('g', { class: 'part' }, g);
  s('circle', { cx: SX - 3, cy: SY - 2, r: 15, fill: 'url(#nrn-nuc)' }, P.nucleus);
  s('circle', { cx: SX - 7, cy: SY - 6, r: 4, fill: '#ECE6FF', opacity: 0.75 }, P.nucleus);

  // axon (gentle curve) + hillock
  const AX0 = SX + 36, AX1 = 640;
  const ay = (x) => SY + 7 * Math.sin(((x - AX0) / (AX1 - AX0)) * Math.PI * 1.5);
  P.axon = s('g', { class: 'part' }, g);
  s('path', { d: `M${SX + 28},${SY - 13} Q${SX + 44},${SY - 5} ${AX0 + 14},${f1(ay(AX0 + 14) - 3.5)} L${AX0 + 14},${f1(ay(AX0 + 14) + 3.5)} Q${SX + 44},${SY + 5} ${SX + 28},${SY + 13}Z`, fill: C.cell }, P.axon);
  let ad = `M${AX0},${SY}`;
  for (let x = AX0 + 8; x <= AX1; x += 8) ad += ` L${x},${f1(ay(x))}`;
  s('path', { d: ad, fill: 'none', stroke: C.cell, 'stroke-width': 7, 'stroke-linecap': 'round' }, P.axon);

  // myelin sheath segments with nodes of Ranvier between them
  P.myelin = s('g', { class: 'part' }, g);
  const MY = [262, 334, 406, 478, 550], ML = 58;
  MY.forEach((a) => {
    const cx = a + ML / 2, cy = ay(cx);
    const ang = (Math.atan2(ay(cx + 1) - ay(cx - 1), 2) * 180) / Math.PI;
    const tr = `rotate(${ang.toFixed(2)} ${f1(cx)} ${f1(cy)})`;
    s('rect', { x: f1(cx - ML / 2), y: f1(cy - 13), width: ML, height: 26, rx: 13, fill: 'url(#nrn-my)', transform: tr }, P.myelin);
    s('rect', { x: f1(cx - ML / 2 + 7), y: f1(cy - 9), width: ML - 14, height: 5, rx: 2.5, fill: '#fff', opacity: 0.35, transform: tr }, P.myelin);
  });
  const nodes = [AX0 + 16, 327, 399, 471, 543, 616];

  // axon terminals + terminal buttons
  P.terminals = s('g', { class: 'part' }, g);
  const E = [AX1, ay(AX1)];
  const bulbs = [[700, 246], [722, 294], [704, 350]];
  bulbs.forEach(([bx, by]) => {
    s('path', { d: `M${E[0] - 4},${f1(E[1])} Q${672},${f1(by * 0.45 + E[1] * 0.55)} ${bx - 8},${by}`, fill: 'none', stroke: C.cell, 'stroke-width': 5, 'stroke-linecap': 'round' }, P.terminals);
    s('circle', { cx: bx, cy: by, r: 11, fill: 'url(#nrn-soma)' }, P.terminals);
  });

  // labels
  Lb.dendrites = label(g, { at: chain[2], to: [95, 150], pos: 'above', text: 'Dendrites' });
  Lb.nucleus = label(g, { at: [SX + 4, SY - 8], to: [292, 186], pos: 'right', text: 'Nucleus' });
  Lb.soma = label(g, { at: [SX + 20, SY + 33], to: [232, 442], pos: 'below', text: 'Cell body (soma)' });
  Lb.axon = label(g, { at: [628, ay(628)], to: [598, 228], pos: 'above', text: 'Axon' });
  Lb.myelin = label(g, { at: [435, ay(435) + 13], to: [435, 402], pos: 'below', text: 'Myelin sheath' });
  Lb.node = label(g, { at: [471, ay(471) - 4], to: [471, 226], pos: 'above', text: 'Node of Ranvier' });
  Lb.terminals = label(g, { at: [706, 361], to: [606, 420], pos: 'below', text: 'Terminal buttons' });
  Lb.gap = label(g, { at: [734, 294], to: [784, 196], pos: 'above', anchor: 'end', text: 'Synapse (tiny gap)' });
  Lb.next = label(g, { at: [786, 315], to: [790, 470], pos: 'below', anchor: 'end', text: 'Next neuron' });
  // direction arrow (impulse step)
  Lb.direction = s('g', { class: 'lbl' }, g);
  s('line', { x1: 150, y1: 512, x2: 690, y2: 512, stroke: '#ECEFF7', 'stroke-width': 2.5, 'marker-end': 'url(#nrn-arrow)', opacity: 0.8 }, Lb.direction);
  const dt = s('text', { x: 420, y: 498, 'text-anchor': 'middle', class: 'note' }, Lb.direction);
  dt.textContent = 'dendrites → cell body → axon → terminal buttons';

  // impulse sprites
  const warm = s('g', { opacity: 0 }, g);
  s('circle', { r: 26, fill: 'url(#nrn-warm)' }, warm);
  const somaGlow = s('circle', { cx: SX, cy: SY, r: 62, fill: 'url(#nrn-warm)', opacity: 0 }, g);
  const nodeGlow = nodes.map((x) => s('circle', { cx: x, cy: f1(ay(x)), r: 8, fill: C.pulse, filter: 'url(#nrn-glow)', opacity: 0 }, g));
  const sp = spark(g, 8);
  const splits = bulbs.map(() => spark(g, 6));
  const bulbGlow = bulbs.map(([bx, by]) => s('circle', { cx: bx, cy: by, r: 22, fill: 'url(#nrn-halo)', opacity: 0 }, g));

  // pre-compute the dendrite → soma route
  const route = chain.slice().reverse().concat([[SX, SY]]);
  const routeLen = [0];
  for (let i = 1; i < route.length; i++) routeLen.push(routeLen[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const along = (u) => {
    const L2 = u * routeLen[routeLen.length - 1];
    let i = 1; while (i < routeLen.length - 1 && routeLen[i] < L2) i++;
    const k = (L2 - routeLen[i - 1]) / (routeLen[i] - routeLen[i - 1] || 1);
    return [lerp(route[i - 1][0], route[i][0], k), lerp(route[i - 1][1], route[i][1], k)];
  };

  // Impulse timeline (ms): 0–1300 signal gathers along a dendrite, 1300–1700 cell body fires,
  // 1700–3600 action potential jumps node to node, 3600–4300 spreads into the terminal buttons.
  const HOP = 380, T_AX = 1700, T_END = T_AX + HOP * (nodes.length - 1);
  function impulse(t) {
    const u = seg(t, 0, 1300);
    const [wx, wy] = along(ease(u));
    place(warm, wx, wy); warm.setAttribute('opacity', f1(t < 1350 ? Math.min(1, u * 6) : 0));
    somaGlow.setAttribute('opacity', (seg(t, 1100, 1450) * (1 - seg(t, 1800, 2600)) * 0.9).toFixed(2));
    // node hopping
    let x = nodes[0], vis = 0;
    if (t >= T_AX && t < T_END + 80) {
      const k = Math.min(nodes.length - 2, Math.floor((t - T_AX) / HOP));
      const local = (t - T_AX - k * HOP) / HOP;
      x = lerp(nodes[k], nodes[k + 1], ease(seg(local, 0.62, 1)));
      vis = 1;
      if (t >= T_END) x = nodes[nodes.length - 1];
    }
    if (t >= T_END && t < T_END + 300) { x = lerp(nodes[nodes.length - 1], AX1, seg(t, T_END, T_END + 300)); vis = 1; }
    place(sp, x, ay(x)); sp.setAttribute('opacity', vis);
    nodeGlow.forEach((c, k) => {
      const tv = T_AX + k * HOP;
      c.setAttribute('opacity', t < tv ? 0 : Math.max(0.3, 1 - (t - tv) / 700).toFixed(2));
    });
    const ub = seg(t, T_END + 300, T_END + 900);
    splits.forEach((spk, k) => {
      const [bx, by] = bulbs[k];
      place(spk, lerp(AX1, bx, ease(ub)), lerp(E[1], by, ease(ub)));
      spk.setAttribute('opacity', ub > 0 && ub < 1 ? 1 : 0);
      bulbGlow[k].setAttribute('opacity', (seg(t, T_END + 850, T_END + 1100)).toFixed(2));
    });
  }
  const IMPULSE_DUR = T_END + 1200;
  function clearFx() { impulse(-1); }

  return { g, P, Lb, impulse, IMPULSE_DUR, clearFx };
}

/* ------------------------------------------------------------------ scene 2: saltatory race */
function buildSalt(svg) {
  const g = s('g', {}, svg);
  const Lb = {};
  const title = (y, a, b) => { const t = s('text', { x: 50, y, class: 'h' }, g); t.append(document.createTextNode(a)); const ts = s('tspan', { class: 'sub' }, t); ts.textContent = b; };
  title(140, 'With a myelin sheath', '  ·  the impulse jumps');
  title(352, 'Without myelin', '  ·  it travels along every part');

  // row 1 — myelinated
  const Y1 = 230;
  s('rect', { x: 50, y: Y1 - 11, width: 700, height: 22, rx: 11, fill: 'url(#nrn-tube)' }, g);
  const MS = [80, 192, 304, 416, 528, 640], MW = 92;
  MS.forEach((a) => {
    s('rect', { x: a, y: Y1 - 31, width: MW, height: 62, rx: 28, fill: 'url(#nrn-my)' }, g);
    s('rect', { x: a + 12, y: Y1 - 25, width: MW - 24, height: 9, rx: 4.5, fill: '#fff', opacity: 0.3 }, g);
    [0.34, 0.66].forEach((k) => s('path', { d: `M${a + MW * k},${Y1 - 27} Q${a + MW * k + 7},${Y1} ${a + MW * k},${Y1 + 27}`, fill: 'none', stroke: '#8A5E16', 'stroke-width': 1.4, opacity: 0.35 }, g));
  });
  const hops = [62, 182, 294, 406, 518, 630, 742];
  const arcs = hops.slice(0, -1).map((x, k) => s('path', { d: `M${x},${Y1 - 16} Q${(x + hops[k + 1]) / 2},${Y1 - 92} ${hops[k + 1]},${Y1 - 16}`, fill: 'none', stroke: C.pulse, 'stroke-width': 2.5, 'stroke-dasharray': '5 6', 'stroke-linecap': 'round', opacity: 0 }, g));
  const nodeGlow = hops.map((x) => s('circle', { cx: x, cy: Y1, r: 9, fill: C.pulse, filter: 'url(#nrn-glow)', opacity: 0 }, g));
  const sp1 = spark(g, 9);
  Lb.myelin = label(g, { at: [126, Y1 + 31], to: [126, 292], pos: 'below', text: 'Myelin sheath' });
  Lb.node = label(g, { at: [406, Y1 + 11], to: [406, 292], pos: 'below', text: 'Node of Ranvier' });
  const done1 = s('text', { x: 750, y: 318, 'text-anchor': 'end', class: 'ok', opacity: 0 }, g); done1.textContent = '✓ Arrived first';

  // row 2 — unmyelinated
  const Y2 = 418;
  s('rect', { x: 50, y: Y2 - 11, width: 700, height: 22, rx: 11, fill: 'url(#nrn-tube)' }, g);
  const trail = s('rect', { x: 50, y: Y2 - 11, height: 22, rx: 11, width: 0, fill: C.pulse, opacity: 0.32 }, g);
  const sp2 = spark(g, 9);
  const done2 = s('text', { x: 750, y: 468, 'text-anchor': 'end', class: 'ok', opacity: 0 }, g); done2.textContent = '✓ Arrived later';
  Lb.axon2 = label(g, { at: [150, Y2 + 11], to: [150, 452], pos: 'below', text: 'Axon with no myelin' });

  const HOP = 420, T0 = 300, T1 = T0 + HOP * (hops.length - 1), T2 = 6600;
  function race(t) {
    let x = hops[0], vis1 = 0;
    if (t >= T0 && t < T1 + 250) {
      const k = Math.min(hops.length - 2, Math.floor((t - T0) / HOP));
      x = t >= T1 ? hops[hops.length - 1] : lerp(hops[k], hops[k + 1], ease(seg((t - T0 - k * HOP) / HOP, 0.6, 1)));
      vis1 = 1;
      // the spark rises along the arc while it jumps
      const kk = Math.min(hops.length - 2, Math.floor((t - T0) / HOP));
      const lu = seg((t - T0 - kk * HOP) / HOP, 0.6, 1);
      const lift = t >= T1 ? 0 : Math.sin(Math.PI * lu) * 58;
      place(sp1, x, Y1 - lift);
    } else place(sp1, x, Y1);
    sp1.setAttribute('opacity', vis1);
    arcs.forEach((a, k) => a.setAttribute('opacity', t >= T0 + k * HOP + HOP * 0.6 ? 0.8 : 0));
    nodeGlow.forEach((c, k) => { const tv = T0 + k * HOP; c.setAttribute('opacity', t < tv ? 0 : Math.max(0.35, 1 - (t - tv) / 700).toFixed(2)); });
    done1.setAttribute('opacity', seg(t, T1 + 100, T1 + 500).toFixed(2));
    const u2 = seg(t, T0, T2 - 300);
    const x2 = lerp(50, 750, u2);
    place(sp2, x2, Y2); sp2.setAttribute('opacity', t >= T0 && t < T2 - 200 ? 1 : 0);
    trail.setAttribute('width', f1(Math.max(0, x2 - 50)));
    done2.setAttribute('opacity', seg(t, T2 - 250, T2).toFixed(2));
  }
  return { g, P: {}, Lb, race, DUR: T2 };
}

/* ------------------------------------------------------------------ scene 3: three types */
function fiber(parent, x1, x2, y, color, myelin) {
  s('line', { x1, y1: y, x2, y2: y, stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' }, parent);
  if (!myelin) return;
  for (let a = x1 + 10; a + 40 <= x2 - 6; a += 52) {
    s('rect', { x: a, y: y - 9, width: 42, height: 18, rx: 9, fill: 'url(#nrn-my)' }, parent);
  }
}
function bulbsAt(parent, x, y, color, grad) {
  [[24, -16], [30, 0], [24, 16]].forEach(([dx, dy]) => {
    s('path', { d: `M${x},${y} Q${x + 14},${y + dy * 0.3} ${x + dx - 5},${y + dy}`, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }, parent);
    s('circle', { cx: x + dx, cy: y + dy, r: 6.5, fill: grad }, parent);
  });
}
function bush(parent, rand, x, y, r, angles, color) {
  const g = s('g', { fill: 'none', stroke: color, 'stroke-linecap': 'round' }, parent);
  angles.forEach((deg) => { const a = rad(deg); tree(g, rand, x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3), a, 0, [4, 2.6, 1.6], [20, 14, 9]); });
}
function chevrons(parent, xs, y) {
  xs.forEach((x) => s('path', { d: `M${x - 4},${y - 6} L${x + 3},${y} L${x - 4},${y + 6}`, fill: 'none', stroke: '#0D1424', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }, parent));
}

function buildTypes(svg) {
  const g = s('g', {}, svg);
  const P = {}, rand = rng(5);
  const title = (p, y, a, b) => { const t = s('text', { x: 40, y, class: 'h' }, p); t.append(document.createTextNode(a)); const ts = s('tspan', { class: 'sub' }, t); ts.textContent = b; };
  const note = (p, x, y, txt) => { const t = s('text', { x, y, 'text-anchor': 'middle', class: 'note' }, p); t.textContent = txt; };

  // sensory
  const yS = 150;
  P.sensory = s('g', { class: 'part' }, g);
  title(P.sensory, 98, 'Sensory neuron', '  ·  from receptors to the CNS');
  bush(P.sensory, rand, 74, yS, 4, [160, 180, 200], C.sens);
  fiber(P.sensory, 74, 470, yS, C.sens, true);
  s('line', { x1: 470, y1: yS, x2: 470, y2: yS + 26, stroke: C.sens, 'stroke-width': 4 }, P.sensory);
  s('circle', { cx: 470, cy: yS + 40, r: 15, fill: 'url(#nrn-g-sens)' }, P.sensory);
  s('circle', { cx: 468, cy: yS + 39, r: 5, fill: '#7E6BEA', opacity: 0.8 }, P.sensory);
  fiber(P.sensory, 470, 600, yS, C.sens, true);
  bulbsAt(P.sensory, 600, yS, C.sens, 'url(#nrn-g-sens)');
  chevrons(P.sensory, [131, 235, 339, 527], yS);
  note(P.sensory, 270, yS + 38, 'long dendrite');
  note(P.sensory, 560, yS + 38, 'short axon');
  note(P.sensory, 470, yS + 80, 'cell body');

  // relay
  const yR = 318;
  P.relay = s('g', { class: 'part' }, g);
  title(P.relay, 262, 'Relay neuron', '  ·  inside the CNS (brain and spinal cord)');
  bush(P.relay, rand, 320, yR, 17, [150, 185, 220, 250, 115], C.relay);
  fiber(P.relay, 336, 470, yR, C.relay, false);
  s('circle', { cx: 320, cy: yR, r: 17, fill: 'url(#nrn-g-relay)' }, P.relay);
  s('circle', { cx: 318, cy: yR - 1, r: 6, fill: '#7E6BEA', opacity: 0.8 }, P.relay);
  bulbsAt(P.relay, 470, yR, C.relay, 'url(#nrn-g-relay)');
  chevrons(P.relay, [380, 430], yR);
  note(P.relay, 268, yR + 64, 'short dendrites');
  note(P.relay, 420, yR + 40, 'short axon');

  // motor
  const yM = 462;
  P.motor = s('g', { class: 'part' }, g);
  title(P.motor, 400, 'Motor neuron', '  ·  from the CNS to muscles and glands');
  bush(P.motor, rand, 120, yM, 19, [150, 180, 210, 132, 228], C.motor);
  fiber(P.motor, 138, 640, yM, C.motor, true);
  s('circle', { cx: 120, cy: yM, r: 19, fill: 'url(#nrn-g-motor)' }, P.motor);
  s('circle', { cx: 118, cy: yM - 1, r: 6.5, fill: '#7E6BEA', opacity: 0.8 }, P.motor);
  const muscle = s('g', {}, P.motor);
  s('rect', { x: 676, y: yM - 46, width: 64, height: 92, rx: 22, fill: 'url(#nrn-muscle)' }, muscle);
  for (let x = 688; x <= 728; x += 8) s('line', { x1: x, y1: yM - 38, x2: x, y2: yM + 38, stroke: '#FFE1E6', 'stroke-width': 1.2, opacity: 0.45 }, muscle);
  bulbsAt(P.motor, 640, yM, C.motor, 'url(#nrn-g-motor)');
  chevrons(P.motor, [247, 351, 455, 559], yM);
  note(P.motor, 84, yM + 64, 'short dendrites');
  note(P.motor, 390, yM + 40, 'long axon');
  note(P.motor, 708, yM + 66, 'muscle');

  // pulses
  const FX = s('g', {}, g);
  const mk = (y) => ({ trail: s('line', { x1: 0, y1: y, x2: 0, y2: y, stroke: C.pulse, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, FX), sp: spark(FX, 7), y });
  const R = { sensory: { ...mk(yS), x0: 56, x1: 632, dur: 2300 }, relay: { ...mk(yR), x0: 276, x1: 500, dur: 1300 }, motor: { ...mk(yM), x0: 82, x1: 668, dur: 2300 } };
  function run(kind, t) {
    Object.entries(R).forEach(([k, r]) => {
      const on = k === kind;
      const u = on ? seg(t, 200, 200 + r.dur) : 0;
      const x = lerp(r.x0, r.x1, ease(u));
      place(r.sp, x, r.y); r.sp.setAttribute('opacity', on && u > 0 && u < 1 ? 1 : 0);
      r.trail.setAttribute('x1', r.x0); r.trail.setAttribute('x2', f1(x)); r.trail.setAttribute('opacity', on && u > 0 ? 0.75 : 0);
    });
    const c = kind === 'motor' ? Math.sin(Math.PI * seg(t, 2450, 3300)) : 0;
    muscle.setAttribute('transform', `translate(708 ${yM}) scale(${(1 - 0.12 * c).toFixed(3)} ${(1 + 0.08 * c).toFixed(3)}) translate(-708 ${-yM})`);
  }
  return { g, P, Lb: {}, run, dur: { sensory: 2600, relay: 1600, motor: 3400 } };
}

/* ------------------------------------------------------------------ scene 4: reflex arc */
function buildReflex(svg) {
  const g = s('g', {}, svg);
  const Lb = {};
  // spinal cord cross-section
  const cord = s('g', {}, g);
  s('ellipse', { cx: 612, cy: 250, rx: 118, ry: 98, fill: 'url(#nrn-cord)', stroke: '#7487BC', 'stroke-width': 2 }, cord);
  const gm = s('g', { fill: '#A796DD', opacity: 0.42 }, cord);
  s('ellipse', { cx: 580, cy: 208, rx: 14, ry: 40, transform: 'rotate(-28 580 208)' }, gm);
  s('ellipse', { cx: 644, cy: 208, rx: 14, ry: 40, transform: 'rotate(28 644 208)' }, gm);
  s('ellipse', { cx: 576, cy: 290, rx: 26, ry: 34, transform: 'rotate(18 576 290)' }, gm);
  s('ellipse', { cx: 648, cy: 290, rx: 26, ry: 34, transform: 'rotate(-18 648 290)' }, gm);
  s('rect', { x: 577, y: 238, width: 70, height: 24, rx: 12 }, gm);
  s('circle', { cx: 612, cy: 250, r: 4, fill: '#0D1424' }, cord);

  // muscle (effector) with tendons
  const muscle = s('g', {}, g);
  s('line', { x1: 252, y1: 492, x2: 284, y2: 492, stroke: '#E9DCCF', 'stroke-width': 5, 'stroke-linecap': 'round' }, muscle);
  s('line', { x1: 436, y1: 492, x2: 468, y2: 492, stroke: '#E9DCCF', 'stroke-width': 5, 'stroke-linecap': 'round' }, muscle);
  s('path', { d: 'M282,492 C304,462 414,462 438,492 C414,522 304,522 282,492Z', fill: 'url(#nrn-muscle)' }, muscle);
  [-10, 0, 10].forEach((dy) => s('path', { d: `M300,${492 + dy} C330,${486 + dy * 1.4} 390,${486 + dy * 1.4} 420,${492 + dy}`, fill: 'none', stroke: '#FFE1E6', 'stroke-width': 1.2, opacity: 0.5 }, muscle));

  // hot object + heat
  s('rect', { x: 138, y: 350, width: 70, height: 92, rx: 14, fill: 'url(#nrn-hot)' }, g);
  s('rect', { x: 146, y: 357, width: 54, height: 8, rx: 4, fill: '#fff', opacity: 0.25 }, g);
  [152, 173, 194].forEach((x) => s('path', { d: `M${x},342 q-8,-10 0,-20 q8,-10 0,-20`, fill: 'none', stroke: '#FFB088', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.8 }, g));
  const hot = s('text', { x: 220, y: 372, 'text-anchor': 'start', class: 'note' }, g); hot.textContent = 'Hot object';

  // finger (moves away at the end)
  const finger = s('g', {}, g);
  s('rect', { x: -40, y: 378, width: 172, height: 44, rx: 22, fill: 'url(#nrn-skin)' }, finger);
  s('rect', { x: 100, y: 381, width: 24, height: 13, rx: 6.5, fill: '#FBEADF', opacity: 0.9 }, finger);
  s('path', { d: 'M52,382 q-5,18 0,36 M60,382 q-5,18 0,36', fill: 'none', stroke: '#B98762', 'stroke-width': 1.3, opacity: 0.6 }, finger);
  const receptor = s('circle', { cx: 124, cy: 404, r: 5.5, fill: '#FFE08A', filter: 'url(#nrn-soft)' }, finger);

  // neurons
  const N = s('g', { fill: 'none', 'stroke-linecap': 'round' }, g);
  const sensD = (dx) => `M${124 + dx},404 C${108 + dx},300 170,196 300,170 C380,154 430,154 482,162 C522,168 548,182 572,206`;
  const pS = s('path', { d: sensD(0), stroke: C.sens, 'stroke-width': 5 }, N);
  s('line', { x1: 482, y1: 162, x2: 482, y2: 148, stroke: C.sens, 'stroke-width': 4 }, N);
  s('circle', { cx: 482, cy: 138, r: 11, fill: 'url(#nrn-g-sens)', stroke: 'none' }, N);
  const pR = s('path', { d: 'M572,206 C588,232 590,258 580,286', stroke: C.relay, 'stroke-width': 4 }, N);
  s('circle', { cx: 586, cy: 244, r: 7, fill: 'url(#nrn-g-relay)', stroke: 'none' }, N);
  const pM = s('path', { d: 'M578,294 C540,320 520,340 500,362 C472,394 452,440 440,486', stroke: C.motor, 'stroke-width': 5 }, N);
  s('circle', { cx: 580, cy: 294, r: 10, fill: 'url(#nrn-g-motor)', stroke: 'none' }, N);
  const paths = [pS, pR, pM];
  const lens = paths.map((p) => { try { return p.getTotalLength(); } catch { return 400; } });
  const trails = paths.map((p, k) => s('path', { d: p.getAttribute('d'), fill: 'none', stroke: C.pulse, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': `${f1(lens[k] + 80)} ${f1(lens[k] + 80)}`, 'stroke-dashoffset': f1(lens[k] + 80), opacity: 0.85 }, g));
  const sp = spark(g, 8);

  Lb.l1 = label(finger, { at: [124, 410], to: [30, 470], pos: 'below', anchor: 'start', text: '1. Receptor in skin' });
  Lb.l2 = label(g, { at: [300, 170], to: [300, 122], pos: 'above', text: '2. Sensory neuron' });
  Lb.l3 = label(g, { at: [586, 244], to: [705, 132], pos: 'above', text: '3. Relay neuron' });
  Lb.l4 = label(g, { at: [486, 380], to: [528, 452], pos: 'right', text: '4. Motor neuron' });
  Lb.l5 = label(g, { at: [360, 470], to: [360, 440], pos: 'above', text: '5. Muscle contracts' });
  Lb.cord = label(g, { at: [700, 316], to: [736, 386], pos: 'below', text: 'Spinal cord', sub: '(CNS)' });

  // Timeline: 0–500 receptor, 500–2300 sensory, 2300–2900 relay, 2900–4400 motor, 4400–5300 muscle + hand moves.
  const SEG = [[500, 2300], [2300, 2900], [2900, 4400]];
  const LBL_T = [0, 600, 2300, 2900, 4400];
  function run(t) {
    receptor.setAttribute('r', f1(5.5 + 3 * Math.sin(Math.PI * seg(t, 0, 700))));
    let shown = 0;
    SEG.forEach(([a, b], k) => {
      const u = seg(t, a, b);
      trails[k].setAttribute('stroke-dashoffset', f1(lens[k] * (1 - u) + 80));
      if (u > 0 && u < 1) {
        let p = { x: 0, y: 0 };
        try { p = paths[k].getPointAtLength(lens[k] * u); } catch { /* ignore */ }
        place(sp, p.x, p.y); shown = 1;
      }
    });
    sp.setAttribute('opacity', shown);
    const c = Math.sin(Math.PI * 0.5 * seg(t, 4400, 4900));
    muscle.setAttribute('transform', `translate(360 492) scale(${(1 - 0.14 * c).toFixed(3)} ${(1 + 0.22 * c).toFixed(3)}) translate(-360 -492)`);
    const dx = -46 * ease(seg(t, 4500, 5200));
    finger.setAttribute('transform', `translate(${f1(dx)} 0)`);
    const d = sensD(dx); pS.setAttribute('d', d); trails[0].setAttribute('d', d);
    ['l1', 'l2', 'l3', 'l4', 'l5'].forEach((k, i) => Lb[k].classList.toggle('on', t >= LBL_T[i]));
  }
  return { g, P: {}, Lb, run, DUR: 5400 };
}

/* ------------------------------------------------------------------ step plan */
const ALL = ['dendrites', 'soma', 'nucleus', 'axon', 'myelin', 'terminals'];
const PLAN = [
  { scene: 'anat', lit: ALL, labels: [], cap: 'A neuron: one nerve cell' },
  { scene: 'anat', lit: ['dendrites', 'soma', 'nucleus'], labels: ['dendrites', 'soma', 'nucleus'], cap: 'Dendrites receive signals and carry them to the cell body' },
  { scene: 'anat', lit: ['axon', 'myelin'], labels: ['axon', 'myelin'], cap: 'The axon carries the signal away from the cell body' },
  { scene: 'anat', lit: ['terminals', 'next'], labels: ['terminals', 'gap', 'next'], cap: 'Terminal buttons pass the message to the next neuron' },
  { scene: 'anat', lit: ALL, labels: ['direction'], anim: 'impulse', cap: 'The impulse travels one way: from the dendrites to the terminal buttons' },
  { scene: 'salt', labels: ['myelin', 'node', 'axon2'], anim: 'race', cap: 'Not to scale. Myelin makes the impulse jump, so it arrives sooner.' },
  { scene: 'types', lit: ['sensory'], anim: 'sensory', cap: 'Sensory neuron: long dendrite, short axon' },
  { scene: 'types', lit: ['relay'], anim: 'relay', cap: 'Relay neuron: short dendrites, short axon' },
  { scene: 'types', lit: ['motor'], anim: 'motor', cap: 'Motor neuron: short dendrites, long axon' },
  { scene: 'reflex', labels: ['cord'], anim: 'reflex', cap: 'Reflex arc: receptor → sensory → relay → motor → muscle' },
];
const INTRO = { scene: 'anat', lit: ALL, labels: [], cap: 'A neuron (nerve cell)' };
const RECAP = { scene: 'anat', lit: ALL, labels: ['dendrites', 'nucleus', 'soma', 'axon', 'myelin', 'node', 'terminals'], cap: 'All the parts of a neuron' };

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
      exam: `<p>Sensory neurons carry nerve impulses from sensory receptors in the peripheral nervous system (PNS) to the CNS. Not every message goes all the way to the brain. Some end in the spinal cord, which allows quick reflexes.</p>`,
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
      const wrap = document.createElement('div');
      wrap.className = 'fill nrn-vis';
      const style = document.createElement('style'); style.textContent = CSS; wrap.append(style);
      container.append(wrap);
      const svg = s('svg', { viewBox: '0 0 800 600', class: 'diagram', role: 'img', preserveAspectRatio: 'xMidYMid meet' }, wrap);
      defs(svg);
      const controls = document.createElement('div'); controls.className = 'vis-controls'; container.append(controls);
      const cap = document.createElement('p'); cap.className = 'vis-caption'; container.append(cap);

      const scenes = { anat: buildAnatomy(svg), salt: buildSalt(svg), types: buildTypes(svg), reflex: buildReflex(svg) };
      const tw = makeTweens();
      let current = null;

      const fitLabels = (sc) => Object.values(sc.Lb).forEach((l) => l.fit?.());
      document.fonts?.ready?.then(() => { if (current) fitLabels(scenes[current.scene]); });

      function play(plan) {
        tw.clear();
        const sc = scenes[plan.scene];
        if (plan.anim === 'impulse') tw.add(sc.IMPULSE_DUR, (u) => sc.impulse(u * sc.IMPULSE_DUR));
        else if (plan.anim === 'race') tw.add(sc.DUR, (u) => sc.race(u * sc.DUR));
        else if (plan.anim === 'reflex') tw.add(sc.DUR, (u) => sc.run(u * sc.DUR));
        else if (['sensory', 'relay', 'motor'].includes(plan.anim)) { const d = sc.dur[plan.anim]; tw.add(d, (u) => sc.run(plan.anim, u * d)); }
      }

      function show(step) {
        const plan = step < 0 ? INTRO : step >= PLAN.length ? RECAP : PLAN[step];
        current = plan;
        tw.clear();
        wrap.classList.toggle('calm', get('calm') === 'true');
        for (const [k, sc] of Object.entries(scenes)) sc.g.style.display = k === plan.scene ? '' : 'none';
        const sc = scenes[plan.scene];
        for (const [k, el] of Object.entries(sc.P)) {
          const on = !plan.lit || plan.lit.includes(k);
          el.classList.toggle('dim', !on);
          if (k === 'next') el.classList.toggle('gone', !on);
        }
        for (const [k, el] of Object.entries(sc.Lb)) if (!/^l\d$/.test(k)) el.classList.toggle('on', (plan.labels || []).includes(k));
        fitLabels(sc);
        // reset any effects before playing
        if (plan.scene === 'anat') sc.clearFx();
        if (plan.scene === 'types') sc.run(null, 0);
        if (plan.scene === 'salt') sc.race(0);
        if (plan.scene === 'reflex') sc.run(0);
        cap.textContent = plan.cap;
        svg.setAttribute('aria-label', plan.cap);
        controls.innerHTML = '';
        if (plan.anim) {
          if (!reducedMotion()) {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = '↻ Play again';
            b.addEventListener('click', () => play(plan));
            controls.append(b);
          }
          play(plan);
        }
      }

      return { show, dispose() { tw.clear(); wrap.remove(); controls.remove(); cap.remove(); } };
    },
  },
};
