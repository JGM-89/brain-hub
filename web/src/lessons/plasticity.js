// Plasticity and functional recovery after trauma — AQA 7182 4.2.2 (A-level only).
// Visual: hand-drawn SVG on the dark stage.
//   1. A neural network you can "Practise" or "Let time pass" on (use it or lose it).
//   2. Maguire et al. (2000): hippocampus outline + clearly illustrative bars.
//   3. Kühn et al. (2014) and Davidson et al. (2004).
//   4. A damage scenario: a top view of the brain plus a zoomed-in patch of neurons,
//      stepping through unmasking, sprouting, homologous areas, blood vessels and super-sensitivity.
//   5. Evaluation panels (illustrative graphs, labelled as such).
import { reducedMotion } from '../settings.js';

/* ------------------------------------------------------------------ colours (dark stage only) */
const C = {
  ink: '#ECEFF7', soft: '#AEB8D2', faint: '#5E6A8A', node: '#16223D',
  cyan: '#73D3FF', link: '#86A8E6', amber: '#FFC965', mint: '#7DE8B4',
  rose: '#FF8DA1', violet: '#C9AAFF', red: '#FF8A7A',
  panel: 'rgba(255,255,255,0.045)', panelLine: 'rgba(255,255,255,0.12)',
};

/* ------------------------------------------------------------------ tiny SVG helpers */
function T(x, y, str, o = {}) {
  const { size = 15, weight = 400, color = C.ink, anchor = 'start', lh = 1.3, cls = '', extra = '' } = o;
  const lines = Array.isArray(str) ? str : [str];
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" style="fill:${color}" class="${cls}" ${extra}>${lines
    .map((l, i) => `<tspan x="${x}" dy="${i ? (size * lh).toFixed(1) : 0}">${l}</tspan>`).join('')}</text>`;
}
// A label in a dark rounded box, centred on (x, y). `to` draws a leader line to a point.
function pill(x, y, str, o = {}) {
  const { size = 15, color = C.ink, border = 'rgba(255,255,255,.25)', cls = '', extra = '', to = null, lead = C.soft } = o;
  const lines = Array.isArray(str) ? str : [str];
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.56 + 20;
  const h = lines.length * size * 1.3 + 12;
  const leader = to ? `<line x1="${x}" y1="${y}" x2="${to[0]}" y2="${to[1]}" style="stroke:${lead}" stroke-width="1.5"/><circle cx="${to[0]}" cy="${to[1]}" r="3" style="fill:${lead}"/>` : '';
  return `<g class="plx-pill ${cls}" ${extra}>${leader}<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="9" style="fill:rgba(10,16,30,.9);stroke:${border}" stroke-width="1.5"/>${T(x, y - h / 2 + 6 + size * 0.98, lines, { size, weight: 700, color, anchor: 'middle' })}</g>`;
}
const panel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" style="fill:${C.panel};stroke:${C.panelLine}" stroke-width="1.5"/>`;

// Side view of a brain (front on the left), drawn in a 300 x 240 box.
const BRAIN_LAT = `
  <path d="M176 186 C180 204 178 220 172 236 L194 236 C196 218 200 200 204 180 Z" style="fill:#1A2744;stroke:#7F95C4" stroke-width="2"/>
  <path d="M206 172 C214 200 262 206 280 180 C286 168 276 160 266 162 C248 168 226 166 206 172 Z" style="fill:#1E2C4B;stroke:#7F95C4" stroke-width="2"/>
  <path d="M34 128 C22 78 62 30 132 22 C196 14 262 38 284 92 C296 122 290 150 268 160 C250 168 228 166 210 170 C196 174 186 184 168 188 C140 196 104 192 86 176 C76 168 70 160 58 158 C44 156 36 146 34 128 Z" style="fill:#1A2744;stroke:#8FA6D6" stroke-width="2.2"/>
  <g style="fill:none;stroke:#3F5078" stroke-width="2" stroke-linecap="round">
    <path d="M92 150 C120 136 160 130 200 136" style="stroke:#55679A"/>
    <path d="M150 20 C142 52 160 78 146 122"/>
    <path d="M62 80 C80 68 96 86 116 72"/><path d="M76 112 C94 104 108 120 126 110"/>
    <path d="M196 44 C212 64 232 52 246 72"/><path d="M212 104 C230 94 246 114 264 104"/>
    <path d="M116 168 C136 160 156 172 178 164"/><path d="M226 182 C240 188 256 186 270 178"/>
  </g>`;
const brainLat = (tx, ty, s, inner = '') => `<g transform="translate(${tx} ${ty}) scale(${s})">${BRAIN_LAT}${inner}</g>`;

/* ------------------------------------------------------------------ scene 1: the network */
const NODES = {
  a: [60, 200], b: [165, 150], c: [285, 185], d: [405, 140], e: [540, 180],
  f: [110, 290], g: [230, 280], h: [360, 295], i: [480, 280], j: [590, 290],
  k: [240, 85], l: [360, 75], m: [490, 80], n: [595, 110],
};
const PATH = ['a', 'b', 'c', 'd', 'e'];
// [from, to, starting strength 0–5, on the practised path?]
const EDGES = [
  ['a', 'b', 2, 1], ['b', 'c', 2, 1], ['c', 'd', 2, 1], ['d', 'e', 2, 1],
  ['a', 'f', 2], ['f', 'g', 1], ['g', 'c', 3], ['g', 'h', 2], ['h', 'i', 1], ['h', 'c', 2], ['i', 'e', 3],
  ['i', 'j', 1], ['j', 'e', 2], ['b', 'k', 1], ['k', 'c', 2], ['k', 'l', 3], ['l', 'd', 2], ['l', 'm', 1],
  ['m', 'd', 3], ['m', 'n', 2], ['n', 'e', 1], ['b', 'g', 2],
];
const NEW_EDGE = 'b-g'; // the connection that "forms through learning" in step 1

function netSVG() {
  const edges = EDGES.map(([u, v]) => {
    const [x1, y1] = NODES[u], [x2, y2] = NODES[v];
    return `<path class="plx-edge" data-e="${u}-${v}" d="M${x1} ${y1} L${x2} ${y2}" fill="none"/>`;
  }).join('');
  const nodes = Object.entries(NODES).map(([k, [x, y]]) =>
    `<g class="plx-node" data-n="${k}"><circle cx="${x}" cy="${y}" r="12" style="fill:${C.node};stroke:${C.cyan}" stroke-width="2"/><circle class="plx-core" cx="${x}" cy="${y}" r="4.5" fill="${C.cyan}"/></g>`).join('');
  const pathD = 'M' + PATH.map((k) => NODES[k].join(' ')).join(' L');
  return `<g data-scene="net">
    <path class="plx-pathglow" d="${pathD}" fill="none" style="stroke:${C.amber}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
    ${edges}${nodes}
    <circle class="plx-pulse glow" r="7" cx="60" cy="200" fill="${C.amber}" filter="url(#plx-glow)" opacity="0"/>
    ${T(20, 36, '', { size: 15, weight: 700, cls: 'plx-status' })}
    ${T(620, 370, 'Thicker, brighter line = stronger connection', { size: 15, color: C.soft, anchor: 'end', cls: 'plx-key' })}
    ${pill(330, 235, ['New connection', 'forms through learning'], { cls: 'plx-l-new', to: [200, 215] })}
    ${pill(110, 112, 'Pathway you practise', { cls: 'plx-l-path', to: [112, 175], color: C.amber })}
    ${pill(345, 112, 'Stronger with use', { cls: 'plx-l-strong', to: [345, 162], color: C.amber })}
    ${pill(0, 0, 'Not used, so pruned', { cls: 'plx-l-pruned' })}
    ${pill(175, 345, 'Not practised, so getting weaker', { cls: 'plx-l-weak' })}
  </g>`;
}

/* ------------------------------------------------------------------ scene 2: Maguire */
function maguireSVG() {
  const hippo = `
    <path d="M100 172 C112 174 126 175 140 174" fill="none" style="stroke:#7186B8" stroke-width="12" stroke-linecap="round"/>
    <path class="glow" d="M140 174 C160 172 180 165 196 150" fill="none" style="stroke:${C.amber}" stroke-width="13" stroke-linecap="round" filter="url(#plx-glow)"/>`;
  const dots = [[388, 338], [410, 333], [432, 330], [455, 323], [478, 320], [505, 314], [530, 307], [560, 301], [590, 291]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.amber}"/>`).join('');
  return `<g data-scene="maguire">
    ${brainLat(5, 75, 1.05, hippo)}
    ${T(36, 322, 'Front', { color: C.soft })}${T(316, 322, 'Back', { color: C.soft, anchor: 'end' })}
    ${pill(190, 46, ['Posterior (back) part:', 'larger in taxi drivers'], { to: [188, 247], color: C.amber })}
    ${pill(122, 356, 'Hippocampus (deep inside)', { to: [132, 258] })}
    ${T(340, 40, 'Posterior hippocampus grey matter', { weight: 700 })}
    ${T(340, 60, '(illustrative, not real data)', { color: C.soft })}
    <line x1="355" y1="190" x2="612" y2="190" style="stroke:${C.soft}" stroke-width="1.5"/>
    <rect class="plx-bar" x="370" y="125" width="90" height="65" rx="6" style="fill:#7186B8"/>
    <rect class="plx-bar glow" x="500" y="85" width="90" height="105" rx="6" style="fill:${C.amber}" filter="url(#plx-glow)"/>
    ${T(415, 210, 'Control group', { anchor: 'middle' })}${T(545, 210, 'Taxi drivers', { anchor: 'middle', weight: 700 })}
    ${T(340, 240, ['More years as a driver,', 'larger posterior hippocampus'], { weight: 700, lh: 1.25 })}
    <line x1="370" y1="350" x2="612" y2="350" style="stroke:${C.soft}" stroke-width="1.5"/>
    <line x1="370" y1="350" x2="370" y2="275" style="stroke:${C.soft}" stroke-width="1.5"/>
    <path d="M380 342 L604 288" style="stroke:${C.amber}" stroke-width="2" stroke-dasharray="6 6" opacity=".8"/>
    ${dots}
    ${T(495, 372, 'Years as a taxi driver (illustrative)', { anchor: 'middle', color: C.soft })}
    ${T(360, 314, 'Size', { anchor: 'middle', color: C.soft, extra: 'transform="rotate(-90 360 314)"' })}
  </g>`;
}

/* ------------------------------------------------------------------ scene 3: Kühn and Davidson */
function wavePath(x0, x1, y, amp, period) {
  let d = '';
  for (let x = x0; x <= x1; x += 1.5) {
    const yy = y + amp * Math.sin(((x - x0) / period) * 2 * Math.PI) * (0.72 + 0.28 * Math.sin((x - x0) / 23));
    d += `${d ? ' L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return d;
}
function studiesSVG() {
  const spots = `
    <circle class="glow" cx="72" cy="82" r="10" fill="${C.amber}" filter="url(#plx-glow)"/>
    <circle cx="150" cy="172" r="10" fill="${C.amber}" opacity=".9"/><circle cx="150" cy="172" r="16" fill="none" style="stroke:${C.amber}" stroke-width="2" stroke-dasharray="4 4"/>
    <circle class="glow" cx="243" cy="186" r="10" fill="${C.amber}" filter="url(#plx-glow)"/>`;
  return `<g data-scene="studies">
    ${panel(12, 12, 304, 356)}${panel(324, 12, 304, 356)}
    ${T(32, 44, 'Video games', { size: 17, weight: 700 })}${T(32, 66, 'Kühn et al. (2014)', { color: C.soft })}
    ${brainLat(15, 95, 0.95, spots)}
    ${pill(120, 100, 'Prefrontal cortex', { to: [83, 173], color: C.amber })}
    ${pill(110, 338, 'Hippocampus', { to: [158, 258], color: C.amber })}
    ${pill(252, 338, 'Cerebellum', { to: [246, 272], color: C.amber })}
    ${T(344, 44, 'Meditation', { size: 17, weight: 700 })}${T(344, 66, 'Davidson et al. (2004)', { color: C.soft })}
    ${T(344, 112, 'Students (new to meditation)', { color: C.soft })}
    <path class="plx-wave" d="${wavePath(346, 606, 150, 5, 9)}" fill="none" style="stroke:#7186B8" stroke-width="2"/>
    ${T(344, 206, 'Buddhist monks', { weight: 700, color: C.amber })}
    <path class="plx-wave glow" d="${wavePath(346, 606, 256, 24, 9)}" fill="none" style="stroke:${C.amber}" stroke-width="2" filter="url(#plx-glow)"/>
    ${T(344, 318, ['More gamma wave activity', 'in the monks (illustrative)'], { weight: 700 })}
  </g>`;
}

/* ------------------------------------------------------------------ scene 4: damage and recovery */
const IC = [165, 195]; // centre of the zoomed-in circle
const RN = { d1: [100, 150], d2: [120, 230], d3: [85, 205], h1: [175, 100], h2: [240, 155], h3: [210, 245], h4: [150, 300], h5: [265, 240], h6: [190, 180] };
const R_BROKEN = [['h1', 'd1'], ['h6', 'd3'], ['h3', 'd2'], ['h4', 'd2'], ['d1', 'd3']];
const R_HEALTHY = [['h1', 'h2'], ['h2', 'h5'], ['h5', 'h3']];
const R_DORMANT = [['h1', 'h6'], ['h4', 'h3'], ['h6', 'h3']];
const R_SPROUT = ['M240 155 Q232 188 190 180', 'M265 240 Q236 306 150 300', 'M240 155 Q262 206 210 245'];
const R_VESSEL_NEW = ['M172 326 C160 292 146 266 126 250', 'M238 320 C232 290 214 272 186 262'];
const seg = (u, v) => `M${RN[u][0]} ${RN[u][1]} L${RN[v][0]} ${RN[v][1]}`;

function hemi(side) {
  // Top view, front at the top. Left hemisphere is on the viewer's left.
  const m = (x) => (side === 'L' ? x : 970 - x);
  const P = (pts) => pts.map(([x, y]) => `${m(x)} ${y}`);
  const [a, b, c, d, e, f, g, h, i, j] = P([[481, 50], [425, 46], [376, 96], [372, 176], [368, 256], [414, 318], [481, 322], [440, 100], [400, 200], [450, 270]]);
  return `<path d="M${a} C${b} ${c} ${d} C${e} ${f} ${g} Z" style="fill:#1A2744;stroke:#8FA6D6" stroke-width="2.2"/>
    <g style="fill:none;stroke:#3F5078" stroke-width="2" stroke-linecap="round">
      <path d="M${P([[470, 80]])} Q${h} ${P([[400, 120]])}"/><path d="M${P([[468, 160]])} Q${i} ${P([[392, 236]])}"/><path d="M${P([[472, 230]])} Q${j} ${P([[420, 296]])}"/>
    </g>`;
}
function recoverySVG() {
  const broken = R_BROKEN.map(([u, v]) => `<path class="plx-broken" d="${seg(u, v)}" stroke="${C.link}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');
  const healthy = R_HEALTHY.map(([u, v]) => `<path d="${seg(u, v)}" style="stroke:${C.link}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');
  const dorm = R_DORMANT.map(([u, v]) => `<path d="${seg(u, v)}" style="stroke:${C.faint}" stroke-width="2.5" stroke-dasharray="3 6" fill="none" stroke-linecap="round"/>
      <path class="plx-unmask plx-grow glow" d="${seg(u, v)}" style="stroke:${C.cyan}" stroke-width="3.5" fill="none" stroke-linecap="round" filter="url(#plx-glow)"/>`).join('');
  const sprouts = R_SPROUT.map((d) => `<path class="plx-sprout plx-grow glow" d="${d}" style="stroke:${C.mint}" stroke-width="3.5" fill="none" stroke-linecap="round" filter="url(#plx-glow)"/>`).join('');
  const vessels = R_VESSEL_NEW.map((d) => `<path class="plx-vnew plx-grow" d="${d}" style="stroke:${C.rose}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('');
  const halos = ['h6', 'h3', 'h4'].map((k) => `<circle class="plx-halo" cx="${RN[k][0]}" cy="${RN[k][1]}" r="21" fill="none" style="stroke:${C.amber}" stroke-width="2.5"/>`).join('');
  const nodes = Object.entries(RN).map(([k, [x, y]]) => {
    const dead = k[0] === 'd';
    return `<g class="${dead ? 'plx-dnode' : ''}"><circle cx="${x}" cy="${y}" r="11" style="fill:${C.node};stroke:${C.cyan}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${C.cyan}"/>${dead
      ? `<g class="plx-x" style="stroke:${C.red}" stroke-width="3" stroke-linecap="round"><line x1="${x - 7}" y1="${y - 7}" x2="${x + 7}" y2="${y + 7}"/><line x1="${x + 7}" y1="${y - 7}" x2="${x - 7}" y2="${y + 7}"/></g>` : ''}</g>`;
  }).join('');
  return `<g data-scene="recovery">
    <g class="plx-r-brain">
      ${T(485, 30, '↑ Front', { anchor: 'middle', color: C.soft })}
      ${hemi('L')}${hemi('R')}
      ${T(426, 346, ['Left', 'hemisphere'], { anchor: 'middle', color: C.soft, lh: 1.2 })}
      ${T(546, 346, ['Right', 'hemisphere'], { anchor: 'middle', color: C.soft, lh: 1.2 })}
      <circle class="plx-bspot" cx="420" cy="150" r="24" fill="url(#plx-hatch)" style="stroke:${C.red}" stroke-width="2.5"/>
      <circle class="plx-ring" cx="420" cy="150" r="30" fill="none" style="stroke:${C.soft}" stroke-width="1.5" stroke-dasharray="4 4"/>
      <line x1="398" y1="136" x2="245" y2="80" style="stroke:${C.soft}" stroke-width="1.2" stroke-dasharray="4 5"/>
      <line x1="400" y1="166" x2="245" y2="310" style="stroke:${C.soft}" stroke-width="1.2" stroke-dasharray="4 5"/>
      <g class="plx-m-homo">
        <circle class="plx-homo glow" cx="550" cy="150" r="24" fill="${C.violet}" filter="url(#plx-glow)"/>
        <path class="plx-arc plx-grow" d="M444 140 Q485 108 524 140" fill="none" style="stroke:${C.violet}" stroke-width="3" marker-end="url(#plx-arrow)"/>
      </g>
    </g>
    <g class="plx-r-inset">
      <circle cx="${IC[0]}" cy="${IC[1]}" r="140" style="fill:#111B33;stroke:${C.soft}" stroke-width="2"/>
      <g clip-path="url(#plx-inset-clip)">
        <ellipse class="plx-dzone" cx="110" cy="190" rx="58" ry="80" fill="url(#plx-hatch)" style="stroke:${C.red}" stroke-width="2" stroke-dasharray="6 5"/>
        <path d="M150 322 C200 334 262 314 302 252" style="stroke:${C.rose}" stroke-width="5" fill="none" opacity=".45" stroke-linecap="round"/>
        <g class="plx-m-vessel">${vessels}</g>
        ${healthy}${broken}
        <g class="plx-m-unmask">${dorm}</g>
        <g class="plx-m-sprout">${sprouts}</g>
        <g class="plx-m-halo">${halos}</g>
        ${nodes}
      </g>
    </g>
    ${pill(292, 195, 'Zoomed in', { cls: 'plx-rl plx-rl-zoom', color: C.soft })}
    ${pill(420, 212, ['Damage', '(e.g. stroke)'], { cls: 'plx-rl plx-rl-dmg', color: C.red, border: C.red })}
    ${pill(100, 92, 'Neurons die', { cls: 'plx-rl plx-rl-dmg', color: C.red, border: C.red })}
    ${pill(165, 32, 'Dormant synapses switch on', { cls: 'plx-rl plx-rl-5', to: [182, 140], color: C.cyan, lead: C.cyan })}
    ${pill(165, 32, 'New nerve endings grow', { cls: 'plx-rl plx-rl-6', to: [226, 176], color: C.mint, lead: C.mint })}
    ${pill(550, 78, ['Matching area on', 'the right helps'], { cls: 'plx-rl plx-rl-7', to: [550, 126], color: C.violet, lead: C.violet })}
    ${pill(165, 32, 'Neurons become more sensitive', { cls: 'plx-rl plx-rl-8', to: [190, 159], color: C.amber, lead: C.amber })}
    ${pill(165, 362, 'New blood vessels form', { cls: 'plx-rl plx-rl-8', to: [212, 288], color: C.rose, lead: C.rose })}
  </g>`;
}

/* ------------------------------------------------------------------ scenes 5 and 6: evaluation */
function evalASVG() {
  return `<g data-scene="evalA">
    ${panel(12, 12, 304, 356)}${panel(324, 12, 304, 356)}
    ${T(32, 44, 'Age', { size: 17, weight: 700 })}
    ${T(32, 68, ['How plastic the brain is,', 'across life (illustrative)'], { color: C.soft })}
    <line x1="55" y1="300" x2="298" y2="300" style="stroke:${C.soft}" stroke-width="1.5"/>
    <line x1="55" y1="300" x2="55" y2="112" style="stroke:${C.soft}" stroke-width="1.5"/>
    <path class="plx-grow glow" d="M60 125 C110 135 140 225 195 245 C235 258 265 262 296 264" fill="none" style="stroke:${C.amber}" stroke-width="3.5" filter="url(#plx-glow)"/>
    ${pill(226, 196, ['Reduces, but', 'never stops'], { to: [242, 257], color: C.amber })}
    ${T(80, 322, 'Child', { anchor: 'middle', color: C.soft })}${T(176, 322, 'Adult', { anchor: 'middle', color: C.soft })}${T(270, 322, 'Older', { anchor: 'middle', color: C.soft })}
    ${T(40, 210, 'Plasticity', { anchor: 'middle', color: C.soft, extra: 'transform="rotate(-90 40 210)"' })}
    ${T(344, 44, 'Negative plasticity', { size: 17, weight: 700 })}
    ${T(344, 68, 'Not every change is helpful.', { color: C.soft })}
    <circle cx="349" cy="100" r="13" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <rect x="334" y="118" width="30" height="92" rx="12" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <rect x="356" y="132" width="94" height="26" rx="12" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <rect x="450" y="134" width="88" height="22" rx="10" fill="none" style="stroke:${C.violet}" stroke-width="2.5" stroke-dasharray="6 5"/>
    <ellipse cx="557" cy="145" rx="18" ry="14" fill="none" style="stroke:${C.violet}" stroke-width="2.5" stroke-dasharray="6 5"/>
    ${pill(505, 96, 'Missing, but still felt', { to: [500, 134], color: C.violet, lead: C.violet })}
    ${T(344, 238, 'Phantom limb', { weight: 700, color: C.violet })}
    ${T(344, 262, ['Many people who lose a limb', 'still feel sensations in it.', 'This is linked to changes in', 'the somatosensory cortex.'], { lh: 1.35 })}
  </g>`;
}
function evalBSVG() {
  return `<g data-scene="evalB">
    ${panel(12, 12, 304, 356)}${panel(324, 12, 304, 356)}
    ${T(32, 44, 'Cognitive reserve', { size: 17, weight: 700 })}${T(32, 66, 'Schneider et al. (2014)', { color: C.soft })}
    ${T(32, 98, ['Bar height: chance of a', 'disability-free recovery'], { weight: 700 })}
    ${T(32, 140, '(illustrative: direction only)', { color: C.soft })}
    <line x1="40" y1="300" x2="295" y2="300" style="stroke:${C.soft}" stroke-width="1.5"/>
    <rect class="plx-bar" x="58" y="245" width="95" height="55" rx="6" style="fill:#7186B8"/>
    <rect class="plx-bar glow" x="183" y="160" width="95" height="140" rx="6" style="fill:${C.amber}" filter="url(#plx-glow)"/>
    ${T(105, 322, ['Fewer years', 'of education'], { anchor: 'middle', lh: 1.2 })}
    ${T(230, 322, ['More years', 'of education'], { anchor: 'middle', weight: 700, lh: 1.2 })}
    ${T(344, 44, 'Neurorehabilitation', { size: 17, weight: 700 })}${T(344, 66, 'Recovery over time (illustrative)', { color: C.soft })}
    <line x1="360" y1="300" x2="608" y2="300" style="stroke:${C.soft}" stroke-width="1.5"/>
    <line x1="360" y1="300" x2="360" y2="100" style="stroke:${C.soft}" stroke-width="1.5"/>
    <path class="plx-grow" d="M360 300 C390 200 420 175 470 168 C520 164 560 164 606 163" fill="none" style="stroke:#9DB3E8" stroke-width="3.5"/>
    <path class="plx-grow glow" d="M470 168 C520 152 560 132 606 118" fill="none" style="stroke:${C.mint}" stroke-width="3.5" stroke-dasharray="8 6" filter="url(#plx-glow)"/>
    ${pill(530, 216, ['Natural recovery', 'slows down'], { to: [540, 165] })}
    ${pill(540, 98, 'With therapy', { to: [580, 128], color: C.mint, lead: C.mint })}
    ${T(606, 322, 'Time →', { anchor: 'end', color: C.soft })}
    ${T(346, 205, 'Recovery', { anchor: 'middle', color: C.soft, extra: 'transform="rotate(-90 346 205)"' })}
  </g>`;
}

const CSS = `
.plx { position:absolute; inset:0; display:flex; flex-direction:column; }
.lesson-visual .plx .vis-controls { position:static; padding:12px 12px 0; margin:0; min-height:56px; }
.plx .plx-svg { flex:1 1 0; min-height:0; width:100%; height:100%; }
.lesson-visual .plx .vis-caption { position:static; margin:0; padding:4px 16px 14px; max-width:none; min-height:2.9em; }
.plx [data-scene] { animation: plx-in .5s ease both; }
@keyframes plx-in { from { opacity:0; } }
.plx .plx-edge { stroke-linecap:round; transition: stroke-width .7s ease, stroke .7s ease, opacity .7s ease; }
.plx .plx-pathglow { opacity:0; transition: opacity .6s ease; }
.plx .plx-pathglow.on { opacity:.13; }
.plx .plx-core { transition: fill .35s ease; }
.plx .plx-node.on .plx-core { fill:${C.amber}; }
.plx .plx-pill { transition: opacity .5s ease; }
.plx .plx-pill.off { opacity:0; pointer-events:none; }
.plx .plx-bar { transform-box: fill-box; transform-origin: 50% 100%; transition: transform 1.1s cubic-bezier(.2,.7,.2,1); }
.plx .plx-bar.low { transform: scaleY(0); transition:none; }
.plx .plx-dzone, .plx .plx-bspot, .plx .plx-x, .plx .plx-rl-dmg { opacity:0; transition: opacity .9s ease; }
.plx .plx-damaged .plx-dzone, .plx .plx-damaged .plx-bspot, .plx .plx-damaged .plx-x { opacity:1; }
.plx .plx-broken { transition: stroke .9s ease, opacity .9s ease; }
.plx .plx-damaged .plx-broken { stroke:${C.red}; opacity:.5; stroke-dasharray:4 6; }
.plx .plx-dnode > circle { transition: opacity .9s ease; }
.plx .plx-damaged .plx-dnode > circle { opacity:.3; }
.plx .plx-homo { opacity:0; transition: opacity 1.2s ease; }
.plx .plx-m-homo.on .plx-homo { opacity:.85; }
.plx .plx-halo { opacity:0; transform-box: fill-box; transform-origin:center; transform: scale(.55); transition: opacity 1s ease, transform 1.2s ease; }
.plx .plx-m-halo.on .plx-halo { opacity:1; transform: scale(1); }
.plx .plx-r-brain, .plx .plx-r-inset, .plx .plx-m-unmask, .plx .plx-m-sprout, .plx .plx-m-vessel, .plx .plx-m-halo { transition: opacity .5s ease; }
:root[data-calm="true"] .plx .glow { filter:none; }
@media (prefers-reduced-motion: reduce) { :root:not([data-motion="full"]) .plx * { transition:none !important; animation:none !important; } }
`;

const SVG = `<svg class="diagram plx-svg" viewBox="0 0 640 380" role="img" aria-label="">
  <defs>
    <filter id="plx-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="plx-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(255,138,122,.12)"/><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,138,122,.6)" stroke-width="2"/></pattern>
    <clipPath id="plx-inset-clip"><circle cx="${IC[0]}" cy="${IC[1]}" r="139"/></clipPath>
    <marker id="plx-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${C.violet}"/></marker>
  </defs>
  ${netSVG()}${maguireSVG()}${studiesSVG()}${recoverySVG()}${evalASVG()}${evalBSVG()}
</svg>`;

// Per-step caption (visible) and fuller description (for screen readers).
const CAPTIONS = [
  ['Learning can make a new connection between neurons.', 'A network of neurons. A new connection grows between two neurons, labelled: new connection forms through learning.'],
  ['Press Practise, then Let time pass. Watch which connections stay.', 'An interactive network of neurons. Practising strengthens one pathway. Letting time pass weakens connections that were not used, until some are pruned.'],
  ['Taxi drivers had a larger posterior hippocampus. Bars are illustrative.', 'Side view of the brain with the hippocampus highlighted, its back part marked larger in taxi drivers. Illustrative bars: taxi drivers higher than controls. Illustrative dots: more years as a driver goes with a larger posterior hippocampus.'],
  ['Video games and meditation are also linked to brain changes. Waves are illustrative.', 'Left: brain with the prefrontal cortex, hippocampus and cerebellum marked, where Kühn et al. found more grey matter. Right: illustrative gamma waves, small for students and larger for Buddhist monks.'],
  ['Press “Damage this area” to see a stroke damage a small area.', 'Top view of the brain and a zoomed-in circle of neurons. A small area of the left hemisphere can be damaged with the button.'],
  ['Neuronal unmasking: dormant synapses become active.', 'Zoomed-in neurons next to a damaged area. Grey dashed dormant synapses turn into bright active connections.'],
  ['Axonal sprouting: new nerve endings grow around the damage.', 'Zoomed-in neurons next to a damaged area. New green branches grow from healthy neurons to other healthy neurons.'],
  ['Homologous area: the matching area in the right hemisphere helps.', 'Top view of the brain. An arrow goes from the damaged area in the left hemisphere to the matching area in the right hemisphere, which lights up.'],
  ['New blood vessels form, and neurons become more sensitive.', 'Zoomed-in neurons. New blood vessels grow towards the damaged area, and rings appear around neurons that lost input, showing they are more sensitive.'],
  ['Evaluating plasticity: age and negative plasticity. Graph is illustrative.', 'Left: an illustrative curve showing plasticity is highest in childhood and reduces with age but never reaches zero. Right: a phantom limb drawing, the missing part still felt.'],
  ['Evaluating recovery: cognitive reserve and rehabilitation. Graphs are illustrative.', 'Left: illustrative bars, more years of education linked to a higher chance of disability-free recovery. Right: illustrative curve, natural recovery slows down, and therapy helps it continue.'],
];

/* ------------------------------------------------------------------ the lesson */
export default {
  id: 'plasticity',
  title: 'Plasticity and functional recovery',
  objectives: [
    'Explain what plasticity is, including synaptic pruning.',
    'Describe evidence for plasticity, such as the London taxi driver study.',
    'Describe and evaluate how the brain can recover after trauma.',
  ],
  keywords: [
    { term: 'Plasticity', simple: 'The brain’s ability to change because of experience and learning.', exam: 'The brain’s tendency to change and adapt, both structurally and functionally, as a result of experience and new learning.' },
    { term: 'Synaptic pruning', simple: 'Removing connections between neurons that are rarely used.', exam: 'The process by which rarely used synaptic connections are deleted and frequently used connections are strengthened.' },
    { term: 'Functional recovery', simple: 'When healthy parts of the brain take over the jobs of damaged parts.', exam: 'A form of plasticity: after trauma, the brain’s ability to transfer functions usually performed by a damaged area to other, undamaged areas.' },
    { term: 'Neuronal unmasking', simple: 'Dormant (unused) synapses become active after brain damage.', exam: 'Dormant synapses become active when neural input to them increases after nearby damage, opening connections to regions that are not normally activated.' },
    { term: 'Axonal sprouting', simple: 'Healthy neurons grow new nerve endings to make new connections.', exam: 'The growth of new nerve endings which connect with other undamaged nerve cells to form new neuronal pathways.' },
    { term: 'Cognitive reserve', simple: 'Extra brain “resources”, linked to things like more years of education, that may help the brain cope with damage.', exam: 'The idea that greater mental resources (for example from more years of education) help the brain to cope with damage. Linked to Schneider et al. (2014).' },
  ],
  steps: [
    {
      title: 'Your brain can change',
      simple: `<p><span class="keyterm">Plasticity</span> means the brain can change its <strong>structure</strong> and how it <strong>works</strong>.</p>
        <p>It changes because of <strong>experience and learning</strong>. When you learn something, the connections between your neurons change.</p>
        <p>Plasticity happens <strong>throughout life</strong>, not just when you are a baby.</p>`,
      exam: `<p>In infancy the brain forms new synaptic connections very quickly. Researchers once thought these changes stopped in childhood. Research now shows the adult brain also changes as a result of learning and experience.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>“Plasticity only happens in childhood.” This is wrong. Plasticity is greatest when we are young, but it continues in adults. The London taxi driver study is one example.</p>' },
    },
    {
      title: 'Use it or lose it',
      simple: `<p>Neurons connect to each other at <strong>synapses</strong>.</p>
        <p>When you use a connection a lot, it gets <strong>stronger</strong>.</p>
        <p>Connections you rarely use get weaker, and some are removed. This is called <span class="keyterm">synaptic pruning</span>.</p>
        <p>Try it: press <strong>Practise</strong> a few times. Then press <strong>Let time pass</strong> a few times.</p>`,
      exam: `<p>As we age, rarely used synaptic connections are deleted and frequently used connections are strengthened. Pruning is a normal part of brain development.</p>`,
    },
    {
      title: 'Evidence: London taxi drivers',
      simple: `<p>Maguire et al. (2000) used MRI scans to study the brains of <strong>London taxi drivers</strong>. To get a licence, drivers must learn thousands of London streets.</p>
        <p>The taxi drivers had more grey matter in the <span class="keyterm">posterior hippocampus</span> (the back part) than a control group.</p>
        <p>The longer someone had been a taxi driver, the larger this area tended to be.</p>`,
      exam: `<p>The hippocampus is linked to spatial memory and navigation. The positive correlation with time spent as a taxi driver suggests the brain changed in response to the demands of the job. Because the study is correlational, we cannot be completely sure that the job caused the difference.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Be precise. Write “more grey matter in the <strong>posterior hippocampus</strong>”, not just “a bigger brain”.</p>' },
    },
    {
      title: 'Evidence: video games and meditation',
      simple: `<p>Kühn et al. (2014) asked people to play the video game <strong>Super Mario 64</strong> for at least 30 minutes a day for two months. Compared with a control group, they had <strong>more grey matter</strong> in several brain areas.</p>
        <p>Davidson et al. (2004) compared <strong>Buddhist monks</strong>, who had meditated for many years, with students who were new to meditation. During meditation the monks had much more <strong>gamma wave</strong> activity.</p>`,
      exam: `<p>Kühn et al. found increases in areas including the hippocampus, the prefrontal cortex and the cerebellum. Davidson et al. recorded gamma waves using EEG. Gamma waves are linked to coordinated neuron activity. The monks had more gamma activity even before meditating, suggesting long-term change.</p>`,
    },
    {
      title: 'Functional recovery after trauma',
      simple: `<p>Brain <strong>trauma</strong> means damage, for example from a stroke or a head injury.</p>
        <p>After trauma, healthy parts of the brain can sometimes take over the jobs of the damaged parts. This is called <span class="keyterm">functional recovery</span>. It is a type of plasticity.</p>
        <p>Press <strong>Damage this area</strong>. The next steps show how the brain responds.</p>`,
      exam: `<p>Recovery can happen quickly at first (spontaneous recovery) and then slow down after several weeks or months. At that point, rehabilitation therapy may be needed to help further recovery.</p>`,
    },
    {
      title: 'Neuronal unmasking',
      simple: `<p>The brain has some <strong>dormant synapses</strong>. These are connections that exist, but are not normally used.</p>
        <p>After damage nearby, these dormant synapses can <strong>become active</strong>. This opens up connections to areas that are not normally used.</p>
        <p>This is called <span class="keyterm">neuronal unmasking</span>.</p>`,
      exam: `<p>Wall (1977) described dormant synapses: their function is blocked because the rate of neural input to them is too low. When surrounding areas are damaged, the input to them increases and they are “unmasked”. This can lead to new structures developing over time.</p>`,
    },
    {
      title: 'Axonal sprouting',
      simple: `<p>Healthy neurons can grow <strong>new nerve endings</strong>.</p>
        <p>These new branches connect with other <strong>undamaged</strong> neurons. Together they make new pathways around the damaged area.</p>
        <p>This is called <span class="keyterm">axonal sprouting</span>.</p>`,
      exam: `<p>Axonal sprouting is the growth of new nerve endings which connect with other undamaged nerve cells to form new neuronal pathways. This helps to replace connections that were lost when neurons died.</p>`,
    },
    {
      title: 'Using the other side of the brain',
      simple: `<p>Sometimes the <strong>matching area on the other side of the brain</strong> helps with the job of the damaged area.</p>
        <p>This is called recruitment of <strong>homologous areas</strong> on the opposite hemisphere.</p>
        <p>For example, if a language area in the left hemisphere is damaged, the matching area in the right hemisphere may start to help with language.</p>`,
      exam: `<p>“Homologous” means matching: the area in the same position in the opposite hemisphere. Recruiting it allows specific tasks to still be performed, for example language production after damage to Broca’s area.</p>`,
    },
    {
      title: 'Blood vessels and super-sensitivity',
      simple: `<p>Two more changes can help recovery:</p>
        <ul>
          <li><strong>Reformation of blood vessels.</strong> New blood vessels form near the damaged area.</li>
          <li><strong>Denervation super-sensitivity.</strong> Neurons that have lost their input become <strong>more sensitive</strong> to the signals they still receive. This helps make up for the lost connections.</li>
        </ul>`,
      exam: `<p>“Denervation” means losing nerve input. In denervation super-sensitivity, axons that do a similar job become aroused to a higher level to compensate for the ones that are lost. This can have negative effects too, such as pain.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>For a “describe” question, name each mechanism and give a one-sentence definition: unmasking, axonal sprouting, homologous areas, blood vessels, denervation super-sensitivity.</p>' },
    },
    {
      title: 'Evaluating plasticity',
      simple: `<ul>
          <li><strong>Age.</strong> Plasticity tends to reduce as we get older, but it does not stop. Bezzola et al. (2012) found that golf training changed brain activity in adults aged 40 to 60.</li>
          <li><strong>Negative plasticity.</strong> Not all changes are helpful. Many people who lose a limb still feel sensations in it (phantom limb). This is thought to be caused by changes in the somatosensory cortex.</li>
        </ul>`,
      exam: `<p>Bezzola et al. (2012) found that 40 hours of golf training changed brain activity linked to movement in participants aged 40 to 60. This suggests plasticity continues throughout the lifespan. Long-term drug use has also been linked to harmful brain changes, another example of negative plasticity.</p>`,
    },
    {
      title: 'Evaluating functional recovery',
      simple: `<ul>
          <li><strong>Practical application.</strong> Research into recovery has helped develop <strong>neurorehabilitation</strong>, such as movement therapy. This matters because natural (spontaneous) recovery slows down after a few weeks.</li>
          <li><strong>Cognitive reserve.</strong> Schneider et al. (2014) found that people with more years of education were more likely to make a <strong>disability-free recovery</strong> after a traumatic brain injury.</li>
        </ul>`,
      exam: `<p>Schneider et al. suggested that more education gives the brain a “cognitive reserve” that helps it adapt after damage. Age may also matter: because plasticity tends to reduce with age, recovery may be harder for older people.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Do not use <strong>Phineas Gage</strong> as evidence of recovery. His case is about frontal lobe damage changing his personality, so it belongs in localisation. For recovery, use the mechanisms and studies such as Schneider et al. (2014).</p>' },
    },
  ],
  quiz: [
    { q: 'What is synaptic pruning?', options: ['Rarely used connections are removed', 'New neurons are grown', 'Damaged neurons are repaired', 'New blood vessels form'], answer: 0, explain: 'Rarely used connections are deleted, and frequently used ones are strengthened.', hint: 'Think “use it or lose it”.' },
    { q: 'Maguire et al. (2000) found that London taxi drivers had more grey matter in which area?', options: ['Broca’s area', 'The posterior hippocampus', 'The cerebellum', 'The occipital lobe'], answer: 1, explain: 'The posterior hippocampus is linked to spatial memory and navigation.', hint: 'The area is linked to finding your way. It is the back part of a structure deep in the temporal lobe.' },
    { q: 'After a stroke, dormant synapses become active. What is this called?', options: ['Axonal sprouting', 'Synaptic pruning', 'Neuronal unmasking', 'Denervation super-sensitivity'], answer: 2, explain: 'Neuronal unmasking: synapses that were “masked” (not used) become active.', hint: 'Something hidden is uncovered.' },
    { q: 'What did Schneider et al. (2014) find?', options: ['Children never recover from brain injury', 'People with more years of education were more likely to make a disability-free recovery after brain injury', 'Video games increase grey matter', 'Plasticity stops in adulthood'], answer: 1, explain: 'This is evidence for cognitive reserve.', hint: 'This study is about education and recovery.' },
    { q: 'Which statement about plasticity is correct?', options: ['It only happens in childhood', 'It happens throughout life, although it tends to reduce with age', 'It only happens after brain damage', 'It only happens in the hippocampus'], answer: 1, explain: 'Plasticity continues throughout life. Maguire’s adult taxi drivers are one example.', hint: 'Think about the taxi drivers. Were they children?' },
  ],
  summary: [
    'Plasticity: the brain changes with experience and learning, throughout life. Used connections get stronger; unused ones are pruned.',
    'Evidence: Maguire et al. (2000) taxi drivers had more grey matter in the posterior hippocampus. Also Kühn et al. (2014) and Davidson et al. (2004).',
    'Recovery after trauma: neuronal unmasking, axonal sprouting, homologous areas, new blood vessels, denervation super-sensitivity.',
  ],
  visual: {
    dark: true,
    async create(container) {
      const root = document.createElement('div');
      root.className = 'plx';
      root.innerHTML = `<style>${CSS}</style><div class="vis-controls" role="group" aria-label="Diagram buttons"></div>${SVG}<p class="vis-caption" aria-live="polite"></p>`;
      container.append(root);
      const svg = root.querySelector('svg');
      const ctrl = root.querySelector('.vis-controls');
      const cap = root.querySelector('.vis-caption');
      const $ = (s, r = svg) => r.querySelector(s);
      const $$ = (s, r = svg) => [...r.querySelectorAll(s)];
      const rm = () => reducedMotion();

      // ---- animation bookkeeping (everything is cancelled on step change and dispose)
      const timers = new Set();
      let raf = 0;
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
      const stopAll = () => { timers.forEach(clearTimeout); timers.clear(); cancelAnimationFrame(raf); raf = 0; };

      const grow = (p, animate, dur = 1200, delay = 0) => {
        const len = p.getTotalLength() + 2;
        p.style.transition = 'none';
        p.style.strokeDasharray = `${len} ${len}`;
        if (!animate || rm()) { p.style.strokeDashoffset = '0'; return; }
        p.style.strokeDashoffset = `${len}`;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset ${dur}ms ease ${delay}ms`;
        p.style.strokeDashoffset = '0';
      };
      const ungrow = (p) => {
        const len = p.getTotalLength() + 2;
        p.style.transition = 'none';
        p.style.strokeDasharray = `${len} ${len}`;
        p.style.strokeDashoffset = `${len}`;
      };
      // Resize every label box to fit its text in the current font.
      const fitPills = (scope) => {
        $$('.plx-pill', scope).forEach((g) => {
          const t = $('text', g), r = $('rect', g);
          const b = t.getBBox();
          if (!b.width) return;
          r.setAttribute('x', b.x - 10); r.setAttribute('width', b.width + 20);
          r.setAttribute('y', b.y - 6); r.setAttribute('height', b.height + 12);
        });
      };
      const showPill = (el, on) => el.classList.toggle('off', !on);

      // ---- controls
      const setControls = (defs) => {
        ctrl.replaceChildren(...defs.map((d) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = d.label;
          if (d.id) b.dataset.id = d.id;
          b.addEventListener('click', d.onClick);
          return b;
        }));
      };

      // ================= network state
      const edges = EDGES.map(([u, v, s, onPath]) => ({ key: `${u}-${v}`, s0: s, s, onPath: !!onPath, el: $(`[data-e="${u}-${v}"]`) }));
      const used = new Set();
      let practised = 0, waited = 0, weakenedPath = false;
      const statusEl = $('.plx-status');
      const styleEdge = (e) => {
        const s = e.s, el = e.el;
        el.style.transition = '';
        el.style.strokeWidth = s === 0 ? '1.5' : String(1.2 + s * 1.5);
        el.style.stroke = s >= 4 ? C.amber : s === 0 ? C.faint : C.link;
        el.style.opacity = s === 0 ? '0.35' : String(0.3 + s * 0.14);
        el.style.strokeDasharray = s === 0 ? '3 7' : 'none';
        el.style.strokeDashoffset = '0';
        el.classList.toggle('glow', s >= 4);
        if (s >= 4) el.setAttribute('filter', 'url(#plx-glow)'); else el.removeAttribute('filter');
      };
      const times = (n) => `${n} ${n === 1 ? 'time' : 'times'}`;
      const updateNetLabels = (interactive) => {
        statusEl.textContent = interactive ? `Practised ${times(practised)} · Time passed ${times(waited)}` : '';
        showPill($('.plx-l-path'), interactive && practised === 0 && waited === 0);
        showPill($('.plx-l-strong'), interactive && edges.some((e) => e.onPath && e.s >= 4));
        showPill($('.plx-l-weak'), interactive && weakenedPath && !edges.some((e) => e.onPath && e.s >= 4));
        const pruned = edges.find((e) => e.s === 0);
        const pl = $('.plx-l-pruned');
        if (interactive && pruned) {
          const [u, v] = pruned.key.split('-');
          const mx = (NODES[u][0] + NODES[v][0]) / 2, my = (NODES[u][1] + NODES[v][1]) / 2;
          const ly = my > 200 ? my + 44 : my - 40;
          const lx = Math.max(110, Math.min(530, mx));
          pl.setAttribute('transform', `translate(${lx} ${ly})`);
          if (!pl.querySelector('line')) {
            pl.insertAdjacentHTML('afterbegin', `<line style="stroke:${C.soft}" stroke-width="1.5"/>`);
          }
          const ln = pl.querySelector('line');
          ln.setAttribute('x1', 0); ln.setAttribute('y1', 0); ln.setAttribute('x2', mx - lx); ln.setAttribute('y2', my - ly);
          showPill(pl, true);
        } else showPill(pl, false);
        fitPills($('[data-scene="net"]'));
      };
      const resetNet = () => {
        edges.forEach((e) => { e.s = e.s0; styleEdge(e); });
        used.clear(); practised = 0; waited = 0; weakenedPath = false;
      };
      const pulse = () => {
        const dot = $('.plx-pulse');
        const nodeEls = PATH.map((k) => $(`[data-n="${k}"]`));
        if (rm()) { // still frame: light the whole pathway briefly, no motion
          nodeEls.forEach((n) => n.classList.add('on'));
          later(() => nodeEls.forEach((n) => n.classList.remove('on')), 900);
          return;
        }
        cancelAnimationFrame(raf);
        const pts = PATH.map((k) => NODES[k]);
        const dur = 2000, t0 = performance.now();
        let lastNode = -1;
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          const sgm = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(sgm)), f = sgm - i;
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
          dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('opacity', '1');
          const ni = Math.round(sgm);
          if (ni !== lastNode && Math.abs(sgm - ni) < 0.08) {
            lastNode = ni; const el = nodeEls[ni]; el.classList.add('on'); later(() => el.classList.remove('on'), 600);
          }
          if (t < 1) raf = requestAnimationFrame(frame); else dot.setAttribute('opacity', '0');
        };
        raf = requestAnimationFrame(frame);
      };
      const practise = () => {
        practised++;
        edges.filter((e) => e.onPath).forEach((e) => { e.s = Math.min(5, e.s + 1); used.add(e.key); styleEdge(e); });
        pulse();
        updateNetLabels(true);
        cap.textContent = 'Practising sends signals along the same pathway, so those connections get stronger.';
      };
      const letTimePass = () => {
        waited++;
        edges.forEach((e) => {
          if (!used.has(e.key) && e.s > 0) { e.s -= 1; if (e.onPath) weakenedPath = true; styleEdge(e); }
        });
        used.clear();
        updateNetLabels(true);
        cap.textContent = edges.some((e) => e.s === 0)
          ? 'Connections that were not used got weaker. Some have been pruned (removed).'
          : 'Time passed. Connections that were not used got weaker.';
      };

      // ================= recovery state
      const rScene = $('[data-scene="recovery"]');
      let damaged = false;
      const setDamage = (on) => { damaged = on; rScene.classList.toggle('plx-damaged', on); };
      const showRecovery = (step, animate) => {
        if (step >= 5) setDamage(true);
        $('.plx-r-brain').classList.toggle('dim', ![4, 7].includes(step));
        $('.plx-r-inset').classList.toggle('dim', step === 7);
        $('.plx-m-unmask').classList.toggle('dim', step > 5);
        $('.plx-m-sprout').classList.toggle('dim', step > 6);
        $$('.plx-unmask').forEach((p, i) => (step >= 5 ? grow(p, animate && step === 5, 1400, 300 + i * 450) : ungrow(p)));
        $$('.plx-sprout').forEach((p, i) => (step >= 6 ? grow(p, animate && step === 6, 1800, 300 + i * 500) : ungrow(p)));
        $$('.plx-vnew').forEach((p, i) => (step >= 8 ? grow(p, animate && step === 8, 1800, 200 + i * 500) : ungrow(p)));
        const halo = $('.plx-m-halo'), homo = $('.plx-m-homo');
        halo.classList.remove('on'); homo.classList.remove('on');
        if (step >= 8) { halo.getBoundingClientRect(); later(() => halo.classList.add('on'), animate && step === 8 && !rm() ? 900 : 0); }
        if (step >= 7) { homo.getBoundingClientRect(); later(() => homo.classList.add('on'), animate && step === 7 && !rm() ? 900 : 0); }
        const arc = $('.plx-arc');
        arc.removeAttribute('marker-end');
        if (step >= 7) {
          const slow = animate && step === 7 && !rm();
          grow(arc, slow, 1100);
          later(() => arc.setAttribute('marker-end', 'url(#plx-arrow)'), slow ? 1100 : 0);
        } else ungrow(arc);
        $$('.plx-rl').forEach((el) => showPill(el, false));
        if (step === 4) { showPill($('.plx-rl-zoom'), true); $$('.plx-rl-dmg').forEach((el) => { showPill(el, damaged); el.style.opacity = damaged ? '1' : '0'; }); }
        $$(`.plx-rl-${step}`).forEach((el) => showPill(el, true));
        fitPills(rScene);
      };

      // ================= scene switching
      const SCENE_OF = (s) => (s <= 1 || s >= 11 ? 'net' : s === 2 ? 'maguire' : s === 3 ? 'studies' : s <= 8 ? 'recovery' : s === 9 ? 'evalA' : 'evalB');
      const scenes = Object.fromEntries($$('[data-scene]').map((g) => [g.dataset.scene, g]));
      let current = null;
      const setScene = (name) => {
        if (current !== name) {
          Object.entries(scenes).forEach(([k, g]) => { g.style.display = k === name ? '' : 'none'; });
          current = name;
        }
        return scenes[name];
      };
      const growBars = (scope, animate) => {
        $$('.plx-bar', scope).forEach((b) => {
          b.classList.add('low'); b.getBoundingClientRect();
          if (animate && !rm()) later(() => b.classList.remove('low'), 150); else b.classList.remove('low');
        });
      };

      let stepNow = -1;
      const play = (step, animate = true) => {
        stopAll();
        const name = SCENE_OF(step);
        const scene = setScene(name);
        const [caption, aria] = CAPTIONS[step] || ['Neurons connect to each other at synapses, forming networks.', 'A network of neurons connected by links of different strengths.'];
        cap.textContent = caption;
        svg.setAttribute('aria-label', aria);
        setControls([]);

        if (name === 'net') {
          const interactive = step === 1;
          $('.plx-pathglow').classList.toggle('on', interactive);
          $('.plx-key').style.display = step === 0 ? 'none' : '';
          edges.forEach(styleEdge);
          if (step < 0) edges.find((e) => e.key === NEW_EDGE).el.style.opacity = '0';
          showPill($('.plx-l-new'), step === 0);
          if (step === 0) {
            const ne = edges.find((e) => e.key === NEW_EDGE);
            ne.el.style.stroke = C.mint; ne.el.style.opacity = '1';
            ne.el.style.strokeWidth = '4';
            grow(ne.el, animate, 1600, 400);
            setControls([{ label: '↻ Play again', onClick: () => play(0) }]);
          }
          if (interactive) {
            setControls([
              { label: 'Practise', onClick: practise },
              { label: 'Let time pass', onClick: letTimePass },
              { label: '↺ Start again', onClick: () => { resetNet(); updateNetLabels(true); cap.textContent = CAPTIONS[1][0]; } },
            ]);
          }
          updateNetLabels(interactive);
        } else if (name === 'maguire') {
          fitPills(scene);
          growBars(scene, animate);
          setControls([{ label: '↻ Play again', onClick: () => play(2) }]);
        } else if (name === 'studies') {
          fitPills(scene);
          $$('.plx-wave', scene).forEach((p, i) => grow(p, animate, 1600, i * 400));
          setControls([{ label: '↻ Play again', onClick: () => play(3) }]);
        } else if (name === 'recovery') {
          if (step === 4) {
            const label = () => (damaged ? '↺ Undo the damage' : 'Damage this area');
            setControls([{ label: label(), id: 'dmg', onClick: (ev) => {
              setDamage(!damaged);
              ev.currentTarget.textContent = label();
              cap.textContent = damaged ? 'A small area is damaged. Nearby neurons have lost some of their connections.' : CAPTIONS[4][0];
              showRecovery(4, true);
            } }]);
            if (damaged) cap.textContent = 'A small area is damaged. Nearby neurons have lost some of their connections.';
          } else {
            setControls([{ label: '↻ Play again', onClick: () => play(step) }]);
          }
          showRecovery(step, animate);
        } else {
          fitPills(scene);
          growBars(scene, animate);
          $$('.plx-grow', scene).forEach((p, i) => grow(p, animate, 1500, 200 + i * 500));
          if (name === 'evalB') setControls([{ label: '↻ Play again', onClick: () => play(10) }]);
          if (name === 'evalA') setControls([{ label: '↻ Play again', onClick: () => play(9) }]);
        }
      };

      edges.forEach(styleEdge);
      return {
        show(step) {
          const moved = step !== stepNow;
          stepNow = step;
          play(step, moved);
        },
        dispose() { stopAll(); root.remove(); },
      };
    },
  },
};
