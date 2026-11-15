// Ways of studying the brain — AQA 7182 4.2.2 (A-level only).
// Visual: hand-drawn SVG on the dark stage.
//   - Spatial vs temporal resolution explained with "sharp vs blurry" pictures.
//   - fMRI: oxygen-rich blood flows to active neurons; a slow haemodynamic response you can play.
//   - EEG: electrode cap + illustrative brainwave patterns (alert, relaxed, deep sleep, seizure).
//   - EEG vs fMRI timing side by side.
//   - ERP averaging simulation: average 1 / 5 / 20 / 100 noisy trials and watch the ERP emerge.
//   - Post-mortem: behaviour in life linked to damage found after death (Tan).
//   - A spatial vs temporal resolution chart for all four methods.
import { reducedMotion } from '../settings.js';

/* ------------------------------------------------------------------ colours (dark stage only) */
const C = {
  ink: '#ECEFF7', soft: '#AEB8D2', faint: '#5E6A8A', node: '#16223D',
  cyan: '#73D3FF', link: '#86A8E6', amber: '#FFC965', mint: '#7DE8B4',
  rose: '#FF8DA1', violet: '#C9AAFF', red: '#FF8A7A', o2: '#FF5C6E', deox: '#9A6AB0',
  panel: 'rgba(255,255,255,0.045)', panelLine: 'rgba(255,255,255,0.12)',
};

/* ------------------------------------------------------------------ tiny SVG helpers */
function T(x, y, str, o = {}) {
  const { size = 15, weight = 400, color = C.ink, anchor = 'start', lh = 1.3, cls = '', extra = '' } = o;
  const lines = Array.isArray(str) ? str : [str];
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" style="fill:${color}" class="${cls}" ${extra}>${lines
    .map((l, i) => `<tspan x="${x}" dy="${i ? (size * lh).toFixed(1) : 0}">${l}</tspan>`).join('')}</text>`;
}
function pill(x, y, str, o = {}) {
  const { size = 15, color = C.ink, border = 'rgba(255,255,255,.25)', cls = '', extra = '', to = null, lead = C.soft } = o;
  const lines = Array.isArray(str) ? str : [str];
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.56 + 20;
  const h = lines.length * size * 1.3 + 12;
  const leader = to ? `<line x1="${x}" y1="${y}" x2="${to[0]}" y2="${to[1]}" style="stroke:${lead}" stroke-width="1.5"/><circle cx="${to[0]}" cy="${to[1]}" r="3" style="fill:${lead}"/>` : '';
  return `<g class="stb-pill ${cls}" ${extra}>${leader}<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="9" style="fill:rgba(10,16,30,.9);stroke:${border}" stroke-width="1.5"/>${T(x, y - h / 2 + 6 + size * 0.98, lines, { size, weight: 700, color, anchor: 'middle' })}</g>`;
}
const panel = (x, y, w, h, cls = '') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="16" style="fill:${C.panel};stroke:${C.panelLine}" stroke-width="1.5"/>`;
const ptsToPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// Seeded random numbers, so the "noise" looks the same every time the page loads.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// A horizontal MRI-style slice seen from above (front at the top), centred on (cx, cy).
function wobbly(cx, cy, rx, ry, amp, lobes, phase = 0) {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const k = 1 + amp * Math.sin(lobes * a + phase);
    pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
  }
  return ptsToPath(pts) + ' Z';
}
function slice(cx, cy, s = 1, inner = '') {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="0" cy="0" rx="108" ry="132" style="fill:#2B3550;stroke:#56627F" stroke-width="3"/>
    <path d="${wobbly(0, 0, 96, 120, 0.035, 16)}" style="fill:#59647E"/>
    <path d="${wobbly(0, 0, 76, 100, 0.06, 13, 1)}" style="fill:#97A1B8"/>
    <line x1="0" y1="-122" x2="0" y2="-40" style="stroke:#2B3550" stroke-width="5"/>
    <line x1="0" y1="50" x2="0" y2="122" style="stroke:#2B3550" stroke-width="5"/>
    <path d="M-6 -36 C-30 -30 -34 10 -14 34 C-10 20 -8 -10 -6 -36 Z" style="fill:#2B3550"/>
    <path d="M6 -36 C30 -30 34 10 14 34 C10 20 8 -10 6 -36 Z" style="fill:#2B3550"/>
    ${inner}
  </g>`;
}

/* ------------------------------------------------------------------ physiology-shaped curves */
// Canonical-shaped haemodynamic response (double gamma), peak normalised to 1 at about 5 s.
const FACT15 = 1307674368000;
const hrf = (t) => (t <= 0 ? 0 : ((t ** 5 * Math.exp(-t)) / 120 - (t ** 15 * Math.exp(-t)) / (6 * FACT15)) / 0.17547);

/* ------------------------------------------------------------------ ERP simulation data */
const ERP_T = []; for (let t = -100; t <= 500; t += 4) ERP_T.push(t);
const gaussBump = (t, m, s) => Math.exp(-((t - m) ** 2) / (2 * s * s));
// The made-up "true" response: small early peaks (sensory) and a large P300 (cognitive). Microvolts.
const ERP_SIGNAL = ERP_T.map((t) => 1.5 * gaussBump(t, 50, 12) - 3.5 * gaussBump(t, 85, 12) + 6 * gaussBump(t, 320, 55));
const ERP_TRIALS = (() => {
  const r = mulberry32(20140);
  const gauss = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const trials = [];
  for (let k = 0; k < 100; k++) {
    let ar = 0;
    const alphaAmp = 3.5 * (0.6 + 0.4 * r()), phase = r() * Math.PI * 2;
    trials.push(ERP_T.map((t, i) => {
      ar = 0.75 * ar + gauss();
      const noise = ar * (4 / 1.51) + alphaAmp * Math.sin((2 * Math.PI * 10 * t) / 1000 + phase);
      return ERP_SIGNAL[i] + noise;
    }));
  }
  return trials;
})();
const ERP_AVG = Object.fromEntries([1, 5, 20, 100].map((n) => [n, ERP_T.map((_, i) => {
  let s = 0; for (let k = 0; k < n; k++) s += ERP_TRIALS[k][i]; return s / n;
})]));
const ex = (t) => 140 + (t + 100) * 0.8; // ms → x (140 … 620)
const erpD = (arr, yc, sc) => ptsToPath(ERP_T.map((t, i) => [ex(t), yc - arr[i] * sc]));

/* ------------------------------------------------------------------ EEG patterns (illustrative) */
const EEG_KINDS = {
  alert: { label: 'Alert', title: 'Alert and awake: beta waves', desc: 'Fast and small (about 13–30 per second)' },
  relaxed: { label: 'Relaxed', title: 'Relaxed, eyes closed: alpha waves', desc: 'Medium speed (about 8–12 per second)' },
  sleep: { label: 'Deep sleep', title: 'Deep sleep: delta waves', desc: 'Slow and large (under 4 per second)' },
  seizure: { label: 'Epilepsy', title: 'Epileptic seizure', desc: 'Sudden bursts of large spikes' },
};
function eegPath(kind, x0, x1, yc, secs = 2) {
  const r = mulberry32(kind.length * 97 + 11);
  const pps = (x1 - x0) / secs;
  let n = 0;
  const pts = [];
  for (let x = x0; x <= x1; x += 1) {
    const t = (x - x0) / pps;
    n = 0.8 * n + (r() - 0.5) * 1.4;
    let v;
    if (kind === 'alert') v = 7 * Math.sin(2 * Math.PI * 21 * t) + 4 * Math.sin(2 * Math.PI * 16 * t + 1) + 2.5 * n;
    else if (kind === 'relaxed') v = (20 + 9 * Math.sin(2 * Math.PI * 0.9 * t)) * Math.sin(2 * Math.PI * 10 * t) + 2.5 * n;
    else if (kind === 'sleep') v = 44 * Math.sin(2 * Math.PI * 1.4 * t + 0.5) + 14 * Math.sin(2 * Math.PI * 2.7 * t) + 3 * n;
    else {
      if (t < 0.6) v = 6 * Math.sin(2 * Math.PI * 18 * t) + 2.5 * n;
      else {
        const p = ((t - 0.6) * 3) % 1;
        v = 66 * Math.exp(-(((p - 0.06) / 0.022) ** 2)) - 36 * Math.exp(-(((p - 0.45) / 0.17) ** 2)) + 2.5 * n;
      }
    }
    pts.push([x, yc - v]);
  }
  return ptsToPath(pts);
}

/* ------------------------------------------------------------------ scenes */
function methodsSVG() {
  const card = (x, y, name, desc, icon) => `${panel(x, y, 300, 170)}${icon}${T(x + 140, y + 66, name, { size: 18, weight: 700 })}${T(x + 140, y + 92, desc, { color: C.soft })}`;
  const fmriIcon = `<circle cx="80" cy="99" r="46" fill="none" style="stroke:#5B6E9E" stroke-width="12"/>${slice(80, 99, 0.24)}<circle class="glow" cx="86" cy="118" r="7" fill="${C.amber}" filter="url(#stb-glow)"/>`;
  const eegHead = `<circle cx="396" cy="99" r="40" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/><path d="M388 60 L396 50 L404 60" fill="none" style="stroke:${C.soft}" stroke-width="2"/>${[[396, 72], [374, 84], [418, 84], [362, 104], [396, 99], [430, 104], [378, 122], [414, 122], [396, 128]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.cyan}"/>`).join('')}`;
  const erpIcon = `<line x1="36" y1="290" x2="128" y2="290" style="stroke:${C.faint}" stroke-width="1.5"/><path class="glow" d="${ptsToPath(ERP_T.map((t, i) => [36 + (t + 100) * 0.153, 290 - ERP_SIGNAL[i] * 7]))}" fill="none" style="stroke:${C.amber}" stroke-width="3" filter="url(#stb-glow)"/>`;
  const pmIcon = `${brainLat(338, 238, 0.32)}<circle cx="418" cy="282" r="20" fill="none" style="stroke:${C.ink}" stroke-width="4"/><line x1="432" y1="296" x2="448" y2="312" style="stroke:${C.ink}" stroke-width="6" stroke-linecap="round"/>`;
  return `<g data-scene="methods">
    ${card(12, 14, 'fMRI', ['Blood oxygen,', 'in a scanner'], fmriIcon)}
    ${card(328, 14, 'EEG', ['Electrical activity', 'from the scalp'], eegHead)}
    ${card(12, 198, 'ERP', ['Brain response', 'to one event'], erpIcon)}
    ${card(328, 198, 'Post-mortem', ['The brain studied', 'after death'], pmIcon)}
  </g>`;
}

function resSVG() {
  const bump = 'M345 290 C420 290 430 290 450 270 C480 236 500 236 525 262 C545 284 560 290 605 290';
  return `<g data-scene="res">
    ${panel(12, 12, 304, 356)}${panel(324, 12, 304, 356)}
    ${T(32, 44, 'Spatial resolution', { size: 17, weight: 700 })}${T(32, 66, 'Where is the activity?', { color: C.soft })}
    ${slice(88, 186, 0.48, `<circle cx="18" cy="-48" r="13" fill="${C.amber}"/>`)}
    ${slice(240, 186, 0.48, `<circle cx="18" cy="-48" r="72" fill="url(#stb-blur)"/>`)}
    ${T(88, 278, 'High:', { anchor: 'middle', weight: 700 })}${T(88, 298, 'a sharp spot', { anchor: 'middle', color: C.soft })}
    ${T(240, 278, 'Low:', { anchor: 'middle', weight: 700 })}${T(240, 298, 'a blurry patch', { anchor: 'middle', color: C.soft })}
    ${T(32, 336, ['Can it tell areas that are', 'close together apart?'], { color: C.soft })}
    ${T(344, 44, 'Temporal resolution', { size: 17, weight: 700 })}${T(344, 66, 'When does it happen?', { color: C.soft })}
    <line x1="345" y1="160" x2="605" y2="160" style="stroke:${C.soft}" stroke-width="1.5"/>
    <line x1="400" y1="98" x2="400" y2="168" style="stroke:${C.soft}" stroke-width="1.5" stroke-dasharray="4 4"/>
    ${T(400, 92, 'Event', { anchor: 'middle', color: C.soft })}
    <path class="glow" d="M345 160 L398 160 L403 112 L409 160 L605 160" fill="none" style="stroke:${C.amber}" stroke-width="3" stroke-linejoin="round" filter="url(#stb-glow)"/>
    ${T(345, 190, 'High: precise timing', { weight: 700 })}
    <line x1="345" y1="290" x2="605" y2="290" style="stroke:${C.soft}" stroke-width="1.5"/>
    <line x1="400" y1="228" x2="400" y2="298" style="stroke:${C.soft}" stroke-width="1.5" stroke-dasharray="4 4"/>
    ${T(400, 222, 'Event', { anchor: 'middle', color: C.soft })}
    <path d="${bump}" fill="none" style="stroke:#9DB3E8" stroke-width="3"/>
    ${T(345, 320, 'Low: slow and blurred', { weight: 700 })}
    ${T(605, 352, 'time →', { anchor: 'end', color: C.soft })}
  </g>`;
}

function fmriSVG() {
  // Blood vessel zoom: cells travel along the tube.
  const cells = Array.from({ length: 12 }, (_, i) => {
    const rich = i % 3 !== 2;
    return `<g class="stb-cell" data-i="${i}"><ellipse cx="0" cy="0" rx="10" ry="7" style="fill:${rich ? C.o2 : C.deox}"/></g>`;
  }).join('');
  const t2x = (t) => 320 + t * 24;
  const bold = ptsToPath(Array.from({ length: 121 }, (_, i) => { const t = i / 10; return [t2x(t), 300 - hrf(t) * 120]; }));
  const ticks = [0, 2, 4, 6, 8, 10, 12].map((t) => `<line x1="${t2x(t)}" y1="318" x2="${t2x(t)}" y2="324" style="stroke:${C.soft}" stroke-width="1.5"/>${T(t2x(t), 342, String(t), { anchor: 'middle', color: C.soft })}`).join('');
  return `<g data-scene="fmri">
    ${slice(140, 196, 1, `<circle class="stb-blob" cx="22" cy="92" r="40" fill="url(#stb-heat)"/>`)}
    ${T(140, 30, '↑ Front', { anchor: 'middle', color: C.soft })}
    <g class="stb-f1">
      <line x1="170" y1="270" x2="330" y2="110" style="stroke:${C.soft}" stroke-width="1.2" stroke-dasharray="4 5"/>
      <line x1="176" y1="300" x2="330" y2="270" style="stroke:${C.soft}" stroke-width="1.2" stroke-dasharray="4 5"/>
      ${panel(330, 60, 296, 308)}
      <g transform="translate(0 0)">
        ${[[400, 120], [460, 108], [520, 122], [575, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" style="fill:${C.node};stroke:${C.amber}" stroke-width="2.5"/><circle class="glow" cx="${x}" cy="${y}" r="5" fill="${C.amber}" filter="url(#stb-glow)"/>`).join('')}
      </g>
      <rect x="340" y="172" width="276" height="56" rx="28" style="fill:#3A1F33;stroke:#B65A78" stroke-width="2"/>
      <g clip-path="url(#stb-vessel-clip)">${cells}</g>
      ${pill(478, 82, 'Active neurons use more oxygen', { color: C.amber })}
      ${pill(478, 258, 'Oxygen-rich blood flows in', { color: C.o2, to: [440, 214] })}
      <ellipse cx="358" cy="300" rx="9" ry="6" style="fill:${C.o2}"/>${T(374, 305, 'oxygen-rich', { color: C.soft })}
      <ellipse cx="490" cy="300" rx="9" ry="6" style="fill:${C.deox}"/>${T(506, 305, 'oxygen-poor', { color: C.soft })}
      ${T(478, 336, ['fMRI detects this change', 'in blood oxygen'], { anchor: 'middle', weight: 700 })}
    </g>
    <g class="stb-f2">
      ${T(320, 70, 'Neurons fire', { weight: 700, color: C.cyan })}
      <line x1="320" y1="120" x2="610" y2="120" style="stroke:${C.faint}" stroke-width="1.5"/>
      <path d="M320 120 L321 88 L327 88 L328 120" fill="none" style="stroke:${C.cyan}" stroke-width="3"/>
      ${T(320, 160, 'fMRI signal (blood oxygen)', { weight: 700, color: C.amber })}
      <line x1="320" y1="300" x2="610" y2="300" style="stroke:${C.faint}" stroke-width="1.5"/>
      <g clip-path="url(#stb-sweep-clip)"><path class="glow" d="${bold}" fill="none" style="stroke:${C.amber}" stroke-width="3.5" filter="url(#stb-glow)"/></g>
      <line class="stb-cursor" x1="320" y1="62" x2="320" y2="306" style="stroke:${C.ink}" stroke-width="1.5" opacity=".7"/>
      ${ticks}${T(612, 366, 'seconds after the task starts', { anchor: 'end', color: C.soft })}
      ${pill(410, 214, ['Rises a few', 'seconds later'], { cls: 'stb-late', to: [t2x(3), 300 - hrf(3) * 120], color: C.amber, lead: C.amber })}
      ${pill(140, 356, 'Shows where to about 1–2 mm', { color: C.ink })}
    </g>
  </g>`;
}

function eegSVG() {
  const el = [[0, -92], [-26, -86], [26, -86], [-50, -52], [0, -52], [50, -52], [-84, -46], [84, -46], [-64, 0], [0, 0], [64, 0], [-98, 0], [98, 0],
    [-50, 52], [0, 52], [50, 52], [-84, 46], [84, 46], [-26, 86], [26, 86]];
  const head = `<g transform="translate(140 206)">
    <ellipse cx="-112" cy="0" rx="10" ry="24" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <ellipse cx="112" cy="0" rx="10" ry="24" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <path d="M-14 -104 L0 -124 L14 -104" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>
    <circle cx="0" cy="0" r="108" style="fill:#22325A;stroke:${C.soft}" stroke-width="2.5"/>
    <circle cx="0" cy="0" r="100" fill="none" style="stroke:#3F5078" stroke-width="1.5" stroke-dasharray="3 5"/>
    ${el.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" style="fill:${C.cyan};stroke:#0D1424" stroke-width="2"/>`).join('')}
  </g>`;
  return `<g data-scene="eeg">
    ${T(140, 72, '↑ Front (nose)', { anchor: 'middle', color: C.soft })}
    ${head}
    ${pill(140, 350, 'Electrodes on the scalp', { to: [140, 258], color: C.cyan, lead: C.cyan })}
    ${panel(272, 28, 356, 340)}
    ${T(290, 60, '', { size: 17, weight: 700, cls: 'stb-eeg-title' })}
    ${T(290, 84, '', { color: C.soft, cls: 'stb-eeg-desc' })}
    <line x1="290" y1="216" x2="612" y2="216" style="stroke:${C.faint}" stroke-width="1" stroke-dasharray="2 6"/>
    <g clip-path="url(#stb-eeg-clip)"><path class="stb-eeg-trace" d="" fill="none" style="stroke:${C.cyan}" stroke-width="2" stroke-linejoin="round"/></g>
    <line x1="290" y1="322" x2="451" y2="322" style="stroke:${C.ink}" stroke-width="3"/>
    ${T(370, 344, '1 second', { anchor: 'middle', color: C.soft })}
    ${T(612, 344, 'Illustrative', { anchor: 'end', color: C.soft })}
  </g>`;
}

function compareSVG() {
  const t2x = (t) => 130 + t * 48.5;
  const r = mulberry32(42);
  let n = 0;
  const eeg = [];
  for (let t = 0; t <= 10; t += 0.01) {
    n = 0.7 * n + (r() - 0.5) * 2;
    const v = 5 * n + 34 * Math.exp(-(((t - 1.33) / 0.07) ** 2)) - 14 * Math.exp(-(((t - 1.12) / 0.03) ** 2));
    eeg.push([t2x(t), 130 - v]);
  }
  const bold = [];
  for (let t = 0; t <= 10; t += 0.05) bold.push([t2x(t), 300 - hrf(t - 1) * 95]);
  const ticks = Array.from({ length: 11 }, (_, t) => `<line x1="${t2x(t)}" y1="318" x2="${t2x(t)}" y2="324" style="stroke:${C.soft}" stroke-width="1.5"/>${T(t2x(t), 342, String(t), { anchor: 'middle', color: C.soft, size: 14 })}`).join('');
  return `<g data-scene="compare">
    ${T(20, 136, 'EEG', { size: 18, weight: 700, color: C.cyan })}
    ${T(20, 276, 'fMRI', { size: 18, weight: 700, color: C.amber })}
    <line x1="130" y1="130" x2="615" y2="130" style="stroke:${C.faint}" stroke-width="1"/>
    <line x1="130" y1="300" x2="615" y2="300" style="stroke:${C.faint}" stroke-width="1"/>
    <line x1="${t2x(1)}" y1="44" x2="${t2x(1)}" y2="312" style="stroke:${C.ink}" stroke-width="1.5" stroke-dasharray="5 5"/>
    ${T(t2x(1), 36, 'Picture shown', { anchor: 'middle', weight: 700 })}
    <g clip-path="url(#stb-cmp-clip)">
      <path d="${ptsToPath(eeg)}" fill="none" style="stroke:${C.cyan}" stroke-width="2"/>
      <path class="glow" d="${ptsToPath(bold)}" fill="none" style="stroke:${C.amber}" stroke-width="3.5" filter="url(#stb-glow)"/>
    </g>
    <line class="stb-cursor" x1="130" y1="44" x2="130" y2="312" style="stroke:${C.ink}" stroke-width="1.5" opacity=".7"/>
    ${ticks}${T(615, 366, 'seconds', { anchor: 'end', color: C.soft })}
    ${pill(330, 70, 'EEG changes within milliseconds', { cls: 'stb-c1', to: [t2x(1.33), 98], color: C.cyan, lead: C.cyan })}
    ${pill(525, 166, ['fMRI signal rises', 'seconds later'], { cls: 'stb-c2', to: [t2x(4), 300 - hrf(3) * 95], color: C.amber, lead: C.amber })}
  </g>`;
}

function erpSVG() {
  const ticks = [-100, 0, 100, 200, 300, 400, 500].map((t) => `<line x1="${ex(t)}" y1="345" x2="${ex(t)}" y2="351" style="stroke:${C.soft}" stroke-width="1.5"/>${T(ex(t), 368, String(t), { anchor: 'middle', color: C.soft, size: 14 })}`).join('');
  const trialCols = ['#7FA0D8', '#8FD0C0', '#B9A0E0'];
  return `<g data-scene="erp">
    ${panel(12, 10, 616, 112, 'stb-pa')}
    ${T(26, 36, '3 single trials (very noisy)', { weight: 700, cls: 'stb-pa' })}
    ${T(614, 36, 'Simulation: made-up signal + noise', { anchor: 'end', color: C.soft })}
    <g clip-path="url(#stb-pa-clip)" class="stb-pa">
      ${[0, 1, 2].map((k) => `<path d="${erpD(ERP_TRIALS[k], 82, 3)}" fill="none" style="stroke:${trialCols[k]}" stroke-width="1.5" opacity=".85"/>`).join('')}
    </g>
    ${panel(12, 130, 616, 218)}
    ${T(26, 156, '', { weight: 700, size: 17, cls: 'stb-n-label', color: C.amber })}
    ${T(26, 178, 'Voltage: positive ↑', { color: C.soft })}
    <rect class="stb-early" x="${ex(0)}" y="134" width="${ex(100) - ex(0)}" height="210" style="fill:rgba(115,211,255,.1)"/>
    <line x1="${ex(-100)}" y1="262" x2="${ex(500)}" y2="262" style="stroke:${C.faint}" stroke-width="1"/>
    <line x1="${ex(0)}" y1="14" x2="${ex(0)}" y2="345" style="stroke:${C.ink}" stroke-width="1.5" stroke-dasharray="5 5" opacity=".75"/>
    <g clip-path="url(#stb-pb-clip)"><path class="stb-avg glow" d="" fill="none" style="stroke:${C.amber}" stroke-width="3" stroke-linejoin="round" filter="url(#stb-glow)"/></g>
    ${ticks}${T(26, 368, 'Time (ms)', { color: C.soft, size: 14 })}
    ${pill(ex(50), 200, ['Early peaks:', 'sensory'], { cls: 'stb-comp', color: C.cyan })}
    ${pill(ex(430), 182, ['P300: later,', 'cognitive'], { cls: 'stb-comp', to: [ex(320), 262 - 6 * 8.5], color: C.amber, lead: C.amber })}
    ${pill(ex(300), 322, 'Timing to the millisecond', { cls: 'stb-ev', color: C.ink })}
    ${pill(ex(200), 112, 'Needs many trials and careful noise removal', { cls: 'stb-ev', color: C.ink })}
  </g>`;
}

function pmSVG() {
  const broca = `<circle class="stb-broca" cx="84" cy="126" r="20" fill="url(#stb-hatch)" style="stroke:${C.red}" stroke-width="3"/>`;
  const hippo = `<path class="stb-hippo glow" d="M106 164 C124 168 150 167 168 162 C180 158 190 150 196 140" fill="none" style="stroke:${C.amber}" stroke-width="9" stroke-linecap="round" filter="url(#stb-glow)"/>`;
  const bubble = `<path d="M40 76 h104 a14 14 0 0 1 14 14 v28 a14 14 0 0 1 -14 14 h-74 l-16 14 v-14 h-14 a14 14 0 0 1 -14 -14 v-28 a14 14 0 0 1 14 -14 z" style="fill:#22325A;stroke:${C.soft}" stroke-width="2"/>${T(92, 110, '“tan”', { anchor: 'middle', size: 20, weight: 700 })}`;
  return `<g data-scene="pm">
    <g class="stb-pm8">
      ${panel(12, 14, 272, 164)}
      ${T(30, 46, '1. In life', { size: 17, weight: 700 })}
      ${bubble}
      ${T(174, 98, ['Understood', 'speech, but', 'could only say', 'one word'], { color: C.soft, lh: 1.25 })}
      ${panel(12, 192, 272, 172)}
      ${T(30, 224, '2. After death', { size: 17, weight: 700 })}
      ${T(30, 252, ['Broca examined his brain', 'and found damage in the', 'left frontal lobe.'], { lh: 1.35 })}
      <path d="M284 300 C330 300 350 230 392 208" fill="none" style="stroke:${C.red}" stroke-width="2" stroke-dasharray="5 5"/>
      ${pill(330, 318, '3. Link the two', { color: C.red, border: C.red })}
    </g>
    <g class="stb-pm9">
      ${panel(12, 14, 272, 164)}
      ${T(30, 46, 'Strength', { size: 17, weight: 700, color: C.mint })}
      ${T(30, 74, ['A more detailed look at', 'deep structures, like the', 'hippocampus, than scans', 'can give.'], { lh: 1.35 })}
      ${panel(12, 192, 272, 172)}
      ${T(30, 224, 'Weaknesses', { size: 17, weight: 700, color: C.red })}
      ${T(30, 252, ['Causation: the damage may', 'have another cause.'], { lh: 1.35 })}
      ${T(30, 306, ['Consent: the person may not', 'have been able to agree.'], { lh: 1.35 })}
    </g>
    ${brainLat(318, 66, 1.02, broca + hippo)}
    ${pill(470, 40, 'Damage: left frontal lobe', { cls: 'stb-pm8l', to: [404, 194], color: C.red, lead: C.red, border: C.red })}
    ${pill(470, 40, 'Deep structure: hippocampus', { cls: 'stb-pm9l', to: [471, 236], color: C.amber, lead: C.amber })}
    ${T(470, 354, 'Left side of the brain (front on the left)', { anchor: 'middle', color: C.soft })}
  </g>`;
}

function chartSVG() {
  const pt = (id, x, y, color, label, lx, ly, anchor) => `<g class="stb-pt" data-m="${id}">
      <circle class="glow" cx="${x}" cy="${y}" r="13" fill="${color}" filter="url(#stb-glow)"/>
      ${T(lx, ly, label, { size: 17, weight: 700, color, anchor })}
    </g>`;
  return `<g data-scene="chart">
    <line x1="110" y1="255" x2="612" y2="255" style="stroke:${C.soft}" stroke-width="2" marker-end="url(#stb-arrow)"/>
    <line x1="110" y1="255" x2="110" y2="30" style="stroke:${C.soft}" stroke-width="2" marker-end="url(#stb-arrow)"/>
    ${T(362, 300, 'Temporal resolution: when →', { anchor: 'middle', weight: 700 })}
    ${T(118, 276, 'Poor (seconds)', { color: C.soft })}${T(612, 276, 'Excellent (milliseconds)', { anchor: 'end', color: C.soft })}
    ${T(18, 142, 'Spatial resolution: where →', { anchor: 'middle', weight: 700, extra: 'transform="rotate(-90 18 142)"' })}
    ${T(100, 44, ['Good', '(mm)'], { anchor: 'end', color: C.soft })}${T(100, 250, 'Poor', { anchor: 'end', color: C.soft })}
    ${pt('fmri', 200, 76, C.amber, 'fMRI', 222, 82, 'start')}
    ${pt('eeg', 540, 226, C.cyan, 'EEG', 518, 202, 'end')}
    ${pt('erp', 540, 226, C.mint, 'ERP', 562, 202, 'start')}
    <g class="stb-pt" data-m="pm">
      <rect x="110" y="312" width="505" height="60" rx="12" style="fill:${C.panel};stroke:${C.violet}" stroke-width="1.5" stroke-dasharray="6 5"/>
      ${T(126, 336, 'Post-mortem (not on this chart)', { weight: 700, color: C.violet })}
      ${T(126, 358, 'Very fine detail of structure, but no activity at all.', { color: C.ink })}
    </g>
    ${pill(404, 104, ['Good spatial: about 1–2 mm', 'Poor temporal: about 5 s lag'], { cls: 'stb-det', extra: 'data-m="fmri"', color: C.amber, border: C.amber })}
    ${pill(410, 150, ['Excellent temporal: milliseconds', 'Poor spatial'], { cls: 'stb-det', extra: 'data-m="eeg"', color: C.cyan, border: C.cyan })}
    ${pill(440, 150, ['Same resolution as EEG,', 'for one type of stimulus'], { cls: 'stb-det', extra: 'data-m="erp"', color: C.mint, border: C.mint })}
  </g>`;
}

const CSS = `
.stb { position:absolute; inset:0; display:flex; flex-direction:column; }
.lesson-visual .stb .vis-controls { position:static; padding:12px 12px 0; margin:0; min-height:56px; align-items:center; }
.stb .stb-svg { flex:1 1 0; min-height:0; width:100%; height:100%; }
.lesson-visual .stb .vis-caption { position:static; margin:0; padding:4px 16px 14px; max-width:none; min-height:2.9em; }
.stb .stb-ctl-label { font-weight:700; color:var(--stage-ink); margin-right:2px; }
.stb [data-scene] { animation: stb-in .5s ease both; }
@keyframes stb-in { from { opacity:0; } }
.stb .stb-pill { transition: opacity .5s ease; }
.stb .off { opacity:0 !important; pointer-events:none; }
.stb .stb-blob { transition: opacity .3s linear; }
.stb .stb-pt, .stb .stb-pa, .stb .stb-early { transition: opacity .5s ease; }
.stb .stb-pt.dim { opacity:.22; }
:root[data-calm="true"] .stb .glow { filter:none; }
@media (prefers-reduced-motion: reduce) { :root:not([data-motion="full"]) .stb * { transition:none !important; animation:none !important; } }
`;

const SVG = `<svg class="diagram stb-svg" viewBox="0 0 640 380" role="img" aria-label="">
  <defs>
    <filter id="stb-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="stb-heat"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".35" stop-color="#FFB347" stop-opacity=".95"/><stop offset=".7" stop-color="#FF6B4A" stop-opacity=".55"/><stop offset="1" stop-color="#FF6B4A" stop-opacity="0"/></radialGradient>
    <radialGradient id="stb-blur"><stop offset="0" stop-color="#FFC965" stop-opacity=".8"/><stop offset=".5" stop-color="#FFC965" stop-opacity=".35"/><stop offset="1" stop-color="#FFC965" stop-opacity="0"/></radialGradient>
    <pattern id="stb-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(255,138,122,.15)"/><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,138,122,.7)" stroke-width="2"/></pattern>
    <marker id="stb-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${C.soft}"/></marker>
    <clipPath id="stb-vessel-clip"><rect x="342" y="174" width="272" height="52" rx="26"/></clipPath>
    <clipPath id="stb-sweep-clip"><rect class="stb-sweep" x="310" y="40" width="0" height="300"/></clipPath>
    <clipPath id="stb-cmp-clip"><rect class="stb-sweep2" x="125" y="40" width="0" height="280"/></clipPath>
    <clipPath id="stb-eeg-clip"><rect x="286" y="96" width="332" height="216"/></clipPath>
    <clipPath id="stb-pa-clip"><rect x="130" y="44" width="496" height="76"/></clipPath>
    <clipPath id="stb-pb-clip"><rect x="130" y="134" width="496" height="210"/></clipPath>
  </defs>
  ${methodsSVG()}${resSVG()}${fmriSVG()}${eegSVG()}${compareSVG()}${erpSVG()}${pmSVG()}${chartSVG()}
</svg>`;

const CAPTIONS = [
  ['Spatial resolution = where. Temporal resolution = when.', 'Left: two brain slices, one with a sharp small spot (high spatial resolution), one with a blurry patch (low). Right: two timelines, one with a sharp response right at the event (high temporal resolution), one slow and delayed (low).'],
  ['Active neurons need more oxygen, so oxygen-rich blood flows to them. fMRI detects this.', 'A brain slice with an active area at the back, and a zoomed-in blood vessel where oxygen-rich blood cells flow towards active neurons.'],
  ['Press “Start the task”. The blood signal rises a few seconds after the neurons fire.', 'Graph: neurons fire at 0 seconds, but the fMRI blood oxygen signal rises slowly and peaks several seconds later. The active area on the brain slice brightens at the same slow pace.'],
  ['Press a button to see a brainwave pattern. Patterns are illustrative.', 'A head seen from above covered in electrodes, and an EEG trace showing the selected brainwave pattern.'],
  ['Press “Show a picture”. EEG reacts at once; the fMRI signal comes seconds later.', 'Two traces on the same time axis. When a picture is shown, the EEG changes within a fraction of a second, but the fMRI signal only rises several seconds later.'],
  ['Simulation. Average more trials and watch the random noise cancel out.', 'Top: three very noisy single EEG trials. Bottom: the average of the chosen number of trials. With more trials the noise cancels out and a clear ERP waveform appears.'],
  ['Early peaks are linked to sensory processing. The P300 is a later, cognitive peak.', 'The averaged ERP with the early peaks, in roughly the first 100 milliseconds, labelled sensory, and a large positive peak at about 300 milliseconds labelled P300, cognitive.'],
  ['ERPs give millisecond timing, but they need many trials and careful noise removal.', 'The averaged ERP with notes: timing to the millisecond, and needs many trials and careful noise removal.'],
  ['Behaviour seen in life is linked to damage found after death.', 'Card 1: in life, Tan could only say one word. Card 2: after death, Broca found damage in the left frontal lobe, shown on a side view of the brain.'],
  ['Post-mortems give fine detail, but causation and consent are problems.', 'A side view of the brain with the deep hippocampus highlighted. Cards list a strength (detail of deep structures) and weaknesses (causation and consent).'],
  ['Press a method to see where it sits.', 'Chart: spatial resolution going up, temporal resolution going right. fMRI is high and to the left. EEG and ERP are low and to the right. Post-mortem is not on the chart: very fine detail of structure but no activity over time.'],
];

/* ------------------------------------------------------------------ the lesson */
export default {
  id: 'studying-the-brain',
  title: 'Ways of studying the brain',
  objectives: [
    'Describe how fMRI, EEG, ERPs and post-mortem examinations work.',
    'Explain spatial and temporal resolution, and use them to compare methods.',
    'Give a strength and a weakness for each method.',
  ],
  keywords: [
    { term: 'fMRI', simple: 'A brain scan that shows which areas are active by detecting changes in blood oxygen.', exam: 'Functional magnetic resonance imaging: detects changes in blood oxygenation and flow that occur as a result of neural activity in specific parts of the brain.' },
    { term: 'EEG', simple: 'Electrodes on the scalp record the brain’s overall electrical activity as brainwaves.', exam: 'Electroencephalogram: a record of the electrical activity of the brain, measured by electrodes placed on the scalp.' },
    { term: 'ERP', simple: 'The brain’s electrical response to one particular stimulus, found by averaging many EEG trials.', exam: 'Event-related potential: a small voltage change in the brain, time-locked to a specific stimulus, extracted from the EEG by statistical averaging.' },
    { term: 'Post-mortem examination', simple: 'Studying a person’s brain after they have died.', exam: 'Analysis of a person’s brain after death, to look for structural abnormalities that may explain behaviour observed while they were alive.' },
    { term: 'Spatial resolution', simple: 'How precisely a method can show where activity is.', exam: 'The smallest feature or area a technique can detect: how precisely it can locate brain activity.' },
    { term: 'Temporal resolution', simple: 'How precisely a method can show when activity happens.', exam: 'How accurately a technique can detect changes in brain activity over time.' },
  ],
  steps: [
    {
      title: 'Where and when',
      simple: `<p>Each way of studying the brain is good at different things.</p>
        <p><span class="keyterm">Spatial resolution</span> is how precisely a method shows <strong>where</strong> activity happens.</p>
        <p><span class="keyterm">Temporal resolution</span> is how precisely it shows <strong>when</strong> activity happens.</p>
        <p>Memory tip: <strong>s</strong>patial = <strong>s</strong>pace. <strong>T</strong>emporal = <strong>t</strong>ime.</p>`,
      exam: `<p>Spatial resolution is often given in millimetres: the smaller the detail a method can pick out, the better. Temporal resolution is about how quickly a method can detect a change in activity, often given in milliseconds or seconds.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>Swapping the two words. <strong>Spatial</strong> is about <strong>where</strong> (space). <strong>Temporal</strong> is about <strong>when</strong> (time).</p>' },
    },
    {
      title: 'fMRI: what it measures',
      simple: `<p><span class="keyterm">fMRI</span> stands for functional magnetic resonance imaging.</p>
        <p>When an area of the brain is more active, it uses more <strong>oxygen</strong>. More oxygen-rich blood flows to that area.</p>
        <p>fMRI detects these <strong>changes in blood oxygen and blood flow</strong>. It produces 3D images showing which areas are active during a task.</p>`,
      exam: `<p>Oxygen-rich and oxygen-poor haemoglobin have different magnetic properties. fMRI detects this difference, called the BOLD (blood oxygen level-dependent) signal. The change in blood flow after neural activity is called the <strong>haemodynamic response</strong>.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>fMRI does <strong>not</strong> measure neurons firing directly. It measures changes in <strong>blood oxygen</strong>, which happen because of neural activity.</p>' },
    },
    {
      title: 'fMRI: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> it is non-invasive and does not use harmful radiation (unlike a PET scan).</li>
          <li><strong>Strength:</strong> good <strong>spatial</strong> resolution, about 1–2 mm. It shows quite precisely where activity is.</li>
          <li><strong>Weakness:</strong> poor <strong>temporal</strong> resolution. The blood signal lags about 5 seconds behind the neural activity.</li>
          <li><strong>Weakness:</strong> it is expensive.</li>
        </ul>`,
      exam: `<p>fMRI only measures blood flow, so it cannot show the activity of individual neurons. It shows that an area is active during a task, but this does not prove the area causes the behaviour. The person must also keep very still in the scanner.</p>`,
    },
    {
      title: 'EEG: what it measures',
      simple: `<p><span class="keyterm">EEG</span> stands for electroencephalogram.</p>
        <p>Electrodes are placed on the scalp, usually in a cap. They record the <strong>overall electrical activity</strong> of the brain.</p>
        <p>The recording shows <strong>brainwaves</strong>. Different patterns go with different states, like being alert, relaxed or deeply asleep.</p>
        <p>Try the buttons to see some patterns.</p>`,
      exam: `<p>The signal comes from millions of neurons that are active together, mostly near the surface of the brain. Brainwaves are described by their frequency (speed) and amplitude (size). EEG is used to help diagnose epilepsy, which shows sudden bursts of electrical activity, and to study sleep.</p>`,
    },
    {
      title: 'EEG: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> excellent <strong>temporal</strong> resolution. It picks up changes within milliseconds.</li>
          <li><strong>Strength:</strong> it is non-invasive and much cheaper than fMRI.</li>
          <li><strong>Weakness:</strong> poor <strong>spatial</strong> resolution. The signal is a mix from many neurons, so it cannot pinpoint where activity comes from, especially deep in the brain.</li>
        </ul>
        <p>Press <strong>Show a picture</strong> to compare EEG and fMRI timing.</p>`,
      exam: `<p>EEG cannot tell apart activity in neighbouring areas, and it is not good at detecting activity in deep brain structures. It has been very useful in diagnosing epilepsy and in sleep research.</p>`,
    },
    {
      title: 'ERPs: finding a signal in the noise',
      simple: `<p>Raw EEG has a lot of background activity. This makes it hard to see the brain’s response to one event.</p>
        <p>So researchers show the same <strong>stimulus</strong> (such as a sound) many times. They line up each trial to the moment of the stimulus and <strong>average</strong> them.</p>
        <p>Random background activity cancels out. What is left is the <span class="keyterm">event-related potential (ERP)</span>.</p>`,
      exam: `<p>ERPs are types of brainwave triggered by particular events. They are extracted from the overall EEG using statistical averaging. Each trial is <strong>time-locked</strong> to the stimulus, so the response happens at the same moment in every trial while the background activity does not.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>Explain <strong>why</strong> averaging works: the response to the stimulus is the same each time, but the background activity is random, so it averages out.</p>' },
    },
    {
      title: 'ERP components',
      simple: `<p>An ERP has peaks and dips called <strong>components</strong>.</p>
        <p><strong>Early</strong> components, in roughly the first 100 milliseconds, are linked to <strong>sensory</strong> processing.</p>
        <p><strong>Later</strong> components are linked to <strong>cognitive</strong> processing, such as attention. One example is the <span class="keyterm">P300</span>: a positive peak about 300 milliseconds after the stimulus.</p>`,
      exam: `<p>Early (sensory) components reflect the initial response to the physical stimulus. Later (cognitive) components reflect processing such as attention and memory. Some textbooks draw ERPs with negative voltage upwards, so check the axis.</p>`,
    },
    {
      title: 'ERPs: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> excellent <strong>temporal</strong> resolution, like EEG: measured in milliseconds.</li>
          <li><strong>Strength:</strong> more specific than raw EEG. It shows the response to one type of stimulus.</li>
          <li><strong>Weakness:</strong> lack of <strong>standardisation</strong>. Studies use different methods, so findings are hard to compare.</li>
          <li><strong>Weakness:</strong> background noise must be completely removed, which is not easy.</li>
        </ul>`,
      exam: `<p>ERPs have been widely used to measure cognitive functions such as attention and perception. Like EEG, they still have poor spatial resolution.</p>`,
    },
    {
      title: 'Post-mortem examinations',
      simple: `<p>A <span class="keyterm">post-mortem examination</span> means studying the brain <strong>after a person has died</strong>.</p>
        <p>Researchers look for damage or unusual structure. They link it to the person’s <strong>behaviour during their life</strong>.</p>
        <p>For example, Broca’s patient “Tan” understood speech but could only say one word. After Tan died, Broca found damage in the left frontal lobe.</p>`,
      exam: `<p>Post-mortems are often used with people who had a rare disorder or unusual behaviour while alive. HM’s brain was also examined in detail after his death, to show exactly which parts had been removed or damaged.</p>`,
    },
    {
      title: 'Post-mortems: strengths and weaknesses',
      simple: `<ul>
          <li><strong>Strength:</strong> a more detailed look at the brain than scans give, including <strong>deep structures</strong> such as the hippocampus.</li>
          <li><strong>Strength:</strong> they gave early evidence for localisation, such as Broca’s area.</li>
          <li><strong>Weakness:</strong> causation. The damage might have been caused by something else, such as another illness, so it may not explain the behaviour.</li>
          <li><strong>Weakness:</strong> consent. The person may not have been able to give fully informed consent.</li>
        </ul>`,
      exam: `<p>Post-mortems are retrospective: the person cannot be tested again to check a link between the damage and their behaviour. Consent is an issue for people such as HM, whose memory problems may have made it difficult to give fully informed consent.</p>`,
    },
    {
      title: 'Comparing the methods',
      simple: `<ul>
          <li><strong>fMRI:</strong> good spatial, poor temporal.</li>
          <li><strong>EEG and ERPs:</strong> excellent temporal, poor spatial.</li>
          <li><strong>Post-mortem:</strong> very fine detail of structure, but it cannot show activity, because the person has died.</li>
        </ul>
        <p>Press a method to highlight it on the chart.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>In a “compare” question, use the same feature for both methods. For example: “fMRI has better <strong>spatial</strong> resolution than EEG, but EEG has better <strong>temporal</strong> resolution.”</p>' },
    },
  ],
  quiz: [
    { q: 'What does fMRI detect?', options: ['Changes in blood oxygen and blood flow', 'The electrical activity of single neurons', 'The structure of the brain after death', 'Electrical activity through the scalp'], answer: 0, explain: 'fMRI detects the change in blood oxygen that follows neural activity (the haemodynamic response).', hint: 'Active areas need more oxygen. How does the oxygen get there?' },
    { q: 'Which method has the best temporal resolution?', options: ['Post-mortem', 'fMRI', 'EEG', 'They are all the same'], answer: 2, explain: 'EEG picks up changes within milliseconds.', hint: 'Temporal = time. Which one reacts fastest?' },
    { q: 'How are ERPs taken from the EEG?', options: ['By averaging many trials, each lined up to the stimulus', 'By taking one long recording', 'By measuring blood flow', 'By looking at the brain after death'], answer: 0, explain: 'Averaging many time-locked trials makes the random background activity cancel out.', hint: 'Think about the demo: what happened to the noise when you added more trials?' },
    { q: 'The P300 is…', options: ['An early, sensory component', 'A later, cognitive component, about 300 ms after the stimulus', 'A type of brain scanner', 'A stage of sleep'], answer: 1, explain: 'The P300 is a positive peak about 300 ms after the stimulus, linked to cognitive processing such as attention.', hint: 'The number tells you when it happens. Is 300 ms early or late?' },
    { q: 'Which is a weakness of post-mortem examinations?', options: ['They cannot show structure in detail', 'Damage found may have another cause, so causation is hard to establish', 'They use radiation', 'They have poor spatial resolution'], answer: 1, explain: 'The damage might be caused by something else, such as another illness, so we cannot be sure it caused the behaviour.', hint: 'Think about everything that might have happened to the brain before death.' },
  ],
  summary: [
    'fMRI: detects changes in blood oxygen. Good spatial resolution (about 1–2 mm), poor temporal (about 5 s lag).',
    'EEG: overall electrical activity from the scalp. ERPs: EEG averaged over many trials of one stimulus. Both have excellent temporal but poor spatial resolution.',
    'Post-mortem: the brain is studied after death and linked to behaviour in life. Detailed, but causation and consent are problems.',
  ],
  visual: {
    dark: true,
    async create(container) {
      const root = document.createElement('div');
      root.className = 'stb';
      root.innerHTML = `<style>${CSS}</style><div class="vis-controls" role="group" aria-label="Diagram buttons"></div>${SVG}<p class="vis-caption" aria-live="polite"></p>`;
      container.append(root);
      const svg = root.querySelector('svg');
      const ctrl = root.querySelector('.vis-controls');
      const cap = root.querySelector('.vis-caption');
      const $ = (s, r = svg) => r.querySelector(s);
      const $$ = (s, r = svg) => [...r.querySelectorAll(s)];
      const rm = () => reducedMotion();

      const timers = new Set();
      let raf = 0;
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
      const stopAll = () => { timers.forEach(clearTimeout); timers.clear(); cancelAnimationFrame(raf); raf = 0; };
      // Run fn(progress 0..1) over `dur` ms; with reduced motion jump straight to the end.
      const tween = (dur, fn, done) => {
        cancelAnimationFrame(raf);
        if (rm()) { fn(1); done?.(); return; }
        const t0 = performance.now();
        const frame = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          fn(p);
          if (p < 1) raf = requestAnimationFrame(frame); else done?.();
        };
        raf = requestAnimationFrame(frame);
      };
      const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
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
      const fitPills = (scope) => {
        $$('.stb-pill', scope).forEach((g) => {
          const t = $('text', g), r = $('rect', g);
          const b = t.getBBox();
          if (!b.width) return;
          r.setAttribute('x', b.x - 10); r.setAttribute('width', b.width + 20);
          r.setAttribute('y', b.y - 6); r.setAttribute('height', b.height + 12);
        });
      };
      const show = (el, on) => el.classList.toggle('off', !on);

      const setControls = (defs, label = '') => {
        const kids = [];
        if (label) { const s = document.createElement('span'); s.className = 'stb-ctl-label'; s.textContent = label; kids.push(s); }
        defs.forEach((d) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = d.label;
          if (d.pressed !== undefined) b.setAttribute('aria-pressed', String(d.pressed));
          if (d.key) b.dataset.key = d.key;
          b.addEventListener('click', d.onClick);
          kids.push(b);
        });
        ctrl.replaceChildren(...kids);
      };
      const pressOnly = (key) => $$('button[data-key]', ctrl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)));

      /* ---------- fMRI: blood flow (step 1) */
      const cells = $$('.stb-cell');
      const placeCells = (offset) => {
        cells.forEach((c, i) => {
          const x = 330 + (((i * 26 + offset) % 312) + 312) % 312;
          const y = 200 + Math.sin(i * 1.7) * 9;
          c.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(i * 37) % 60 - 30})`);
        });
      };
      const flow = () => {
        placeCells(0);
        tween(8000, (p) => placeCells(ease(p) * 260));
      };

      /* ---------- fMRI: timing (step 2) */
      const blob = $('.stb-blob');
      const sweep = $('.stb-sweep');
      const fCursor = $('[data-scene="fmri"] .stb-cursor');
      const setFmriTime = (t) => { // t in seconds 0..12
        const x = 320 + t * 24;
        sweep.setAttribute('width', Math.max(0, x - 310 + 2));
        fCursor.setAttribute('x1', x); fCursor.setAttribute('x2', x);
        // The map shows the area once the signal has risen (it stays marked after the peak).
        blob.style.opacity = String(t >= 5 ? 1 : Math.max(0, Math.min(1, hrf(t))));
        show($('.stb-late'), t >= 4);
      };
      const runFmri = () => { setFmriTime(0); tween(6000, (p) => setFmriTime(p * 12)); };

      /* ---------- EEG */
      let eegKind = 'alert';
      const setEeg = (kind, animate) => {
        eegKind = kind;
        $('.stb-eeg-title').textContent = EEG_KINDS[kind].title;
        $('.stb-eeg-desc').textContent = EEG_KINDS[kind].desc;
        const tr = $('.stb-eeg-trace');
        tr.setAttribute('d', eegPath(kind, 290, 612, 216));
        tr.style.stroke = kind === 'seizure' ? C.red : C.cyan;
        grow(tr, animate, 1600);
        pressOnly(kind);
        cap.textContent = `${EEG_KINDS[kind].title}. ${EEG_KINDS[kind].desc}. Illustrative pattern.`;
      };

      /* ---------- EEG vs fMRI */
      const sweep2 = $('.stb-sweep2');
      const cCursor = $('[data-scene="compare"] .stb-cursor');
      const setCmpTime = (t) => { // 0..10 s
        const x = 130 + t * 48.5;
        sweep2.setAttribute('width', Math.max(0, x - 125 + 2));
        cCursor.setAttribute('x1', x); cCursor.setAttribute('x2', x);
        show($('.stb-c1'), t >= 1.6);
        show($('.stb-c2'), t >= 4.2);
      };
      const runCmp = () => { setCmpTime(0); tween(7000, (p) => setCmpTime(p * 10)); };

      /* ---------- ERP averaging */
      let nTrials = 1;
      let shown = ERP_AVG[1].slice();
      const avgPath = $('.stb-avg');
      const nLabel = $('.stb-n-label');
      const N_CAPTION = {
        1: 'One trial: the response is hidden in the random noise.',
        5: 'Five trials averaged: a shape is starting to appear.',
        20: 'Twenty trials averaged: the peaks are now clear.',
        100: '100 trials averaged: the noise has almost cancelled out.',
      };
      let erpStep = 5;
      const drawAvg = (arr) => avgPath.setAttribute('d', erpD(arr, 262, 8.5));
      const updateErpLabels = () => {
        const clear = nTrials >= 20;
        $$('.stb-comp').forEach((el) => show(el, erpStep === 6 && clear));
        show($('.stb-early'), erpStep === 6 && clear);
        $$('.stb-ev').forEach((el) => show(el, erpStep === 7));
        $$('.stb-pa').forEach((el) => el.classList.toggle('dim', erpStep === 6));
      };
      const setN = (n, animate) => {
        nTrials = n;
        nLabel.textContent = `Average of ${n} ${n === 1 ? 'trial' : 'trials'}`;
        pressOnly(String(n));
        const from = shown.slice(), to = ERP_AVG[n];
        const apply = (p) => { const e = ease(p); shown = from.map((v, i) => v + (to[i] - v) * e); drawAvg(shown); };
        if (animate) tween(700, apply); else apply(1);
        updateErpLabels();
        if (erpStep === 5) cap.textContent = `Simulation. ${N_CAPTION[n]}`;
        else if (erpStep === 6 && n < 20) cap.textContent = 'Average at least 20 trials to see the components clearly.';
        else cap.textContent = CAPTIONS[erpStep][0];
      };

      /* ---------- chart */
      const pickMethod = (m) => {
        $$('.stb-pt').forEach((g) => g.classList.toggle('dim', m !== 'all' && g.dataset.m !== m));
        $$('.stb-det').forEach((g) => show(g, g.dataset.m === m));
        pressOnly(m);
        const text = {
          all: CAPTIONS[10][0],
          fmri: 'fMRI: good spatial resolution, poor temporal resolution.',
          eeg: 'EEG: excellent temporal resolution, poor spatial resolution.',
          erp: 'ERP: excellent temporal resolution, poor spatial resolution, for one type of stimulus.',
          pm: 'Post-mortem: very fine structural detail, but it shows no activity over time.',
        };
        cap.textContent = text[m];
      };

      /* ---------- scene switching */
      const SCENE_OF = (s) => (s < 0 ? 'methods' : s === 0 ? 'res' : s <= 2 ? 'fmri' : s === 3 ? 'eeg' : s === 4 ? 'compare' : s <= 7 ? 'erp' : s <= 9 ? 'pm' : 'chart');
      const scenes = Object.fromEntries($$('[data-scene]').map((g) => [g.dataset.scene, g]));
      let current = null;
      const setScene = (name) => {
        if (current !== name) {
          Object.entries(scenes).forEach(([k, g]) => { g.style.display = k === name ? '' : 'none'; });
          current = name;
        }
        return scenes[name];
      };

      let stepNow = -2;
      const play = (step, animate) => {
        stopAll();
        const name = SCENE_OF(step);
        const scene = setScene(name);
        const [caption, aria] = CAPTIONS[step] || (step < 0
          ? ['Four ways of studying the brain.', 'Four cards: fMRI measures blood oxygen in a scanner; EEG measures electrical activity from the scalp; ERP is the brain response to one event; post-mortem is the brain studied after death.']
          : ['Spatial = where. Temporal = when.', CAPTIONS[10][1]]);
        cap.textContent = caption;
        svg.setAttribute('aria-label', aria);
        setControls([]);
        fitPills(scene);

        if (name === 'fmri') {
          const one = step === 1;
          show($('.stb-f1'), one); show($('.stb-f2'), !one);
          $('.stb-f1').style.display = one ? '' : 'none';
          $('.stb-f2').style.display = one ? 'none' : '';
          fitPills(scene);
          if (one) {
            blob.style.opacity = '1';
            if (animate && !rm()) flow(); else placeCells(120);
            setControls([{ label: '↻ Play again', onClick: () => { stopAll(); flow(); } }]);
          } else {
            setFmriTime(rm() || !animate ? 12 : 0);
            setControls([{ label: '▶ Start the task', onClick: () => { stopAll(); runFmri(); } }]);
          }
        } else if (name === 'eeg') {
          setControls(Object.entries(EEG_KINDS).map(([k, v]) => ({ label: v.label, key: k, pressed: k === eegKind, onClick: () => setEeg(k, true) })));
          setEeg(eegKind, animate);
        } else if (name === 'compare') {
          setCmpTime(rm() || !animate ? 10 : 0);
          setControls([{ label: '▶ Show a picture', onClick: () => { stopAll(); runCmp(); } }]);
        } else if (name === 'erp') {
          erpStep = step;
          if (step === 6 && nTrials < 20 && animate) nTrials = 100;
          setControls([1, 5, 20, 100].map((n) => ({ label: String(n), key: String(n), pressed: n === nTrials, onClick: () => setN(n, true) })), 'Trials to average:');
          setN(nTrials, animate);
          fitPills(scene);
        } else if (name === 'pm') {
          const eight = step === 8;
          $('.stb-pm8').style.display = eight ? '' : 'none';
          $('.stb-pm9').style.display = eight ? 'none' : '';
          show($('.stb-pm8l'), eight); show($('.stb-pm9l'), !eight);
          $('.stb-broca').style.opacity = eight ? '1' : '0.35';
          $('.stb-hippo').style.display = eight ? 'none' : '';
          fitPills(scene);
        } else if (name === 'chart') {
          if (step === 10) {
            setControls([
              ...[['fmri', 'fMRI'], ['eeg', 'EEG'], ['erp', 'ERP'], ['pm', 'Post-mortem']].map(([k, l]) => ({ label: l, key: k, pressed: false, onClick: () => pickMethod(k) })),
              { label: 'Show all', key: 'all', pressed: true, onClick: () => pickMethod('all') },
            ]);
          }
          pickMethod('all');
          if (step !== 10) cap.textContent = caption;
          fitPills(scene);
        }
      };

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
