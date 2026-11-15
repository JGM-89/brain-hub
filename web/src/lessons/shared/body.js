// Shared front-view human body for the nervous system, endocrine and fight-or-flight lessons.
// Everything is drawn in "body space": 240 wide x 600 tall, centre line x = 120.
// The figure's own RIGHT side is on the viewer's LEFT (as in any front-view diagram), so:
//   heart and stomach sit slightly to screen-right, liver to screen-left.
// Exports: SVG markup snippets, anatomical coordinates, nerve/vessel paths,
// a label engine (leader lines + collision avoidance, text never below ~15px on screen)
// and a small animator that respects reducedMotion().
import { reducedMotion } from '../../settings.js';

export const SVGNS = 'http://www.w3.org/2000/svg';
export const BODY = { w: 240, h: 600, cx: 120 };

// ---------- helpers ----------
const MX = 240;
/** Mirror an absolute path (written with "x,y" pairs) across the body's centre line. */
export const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(MX - Number(x)).toFixed(2)},${y}`);
const both = (d) => [d, mirror(d)];

export function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Build a symmetrical closed outline from a left-half list of cubic segments. */
function symmetric(start, segs) {
  const pts = [start, ...segs.map((s) => [s[4], s[5]])];
  let d = `M${start[0]},${start[1]}`;
  for (const s of segs) d += ` C${s[0]},${s[1]} ${s[2]},${s[3]} ${s[4]},${s[5]}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], p = pts[i];
    d += ` C${MX - s[2]},${s[3]} ${MX - s[0]},${s[1]} ${MX - p[0]},${p[1]}`;
  }
  return d + ' Z';
}

// ---------- the silhouette ----------
export const BODY_PATH = symmetric([120, 4], [
  [101, 4, 90, 19, 90, 40],       // crown to side of head
  [90, 56, 96, 70, 106, 79],      // cheek and jaw
  [107, 84, 107, 89, 107, 93],    // side of neck
  [99, 99, 80, 100, 66, 106],     // slope of the shoulder
  [56, 110, 50, 120, 49, 134],    // deltoid
  [46, 160, 40, 195, 37, 222],    // outer upper arm to elbow
  [34, 250, 30, 280, 28, 302],    // outer forearm to wrist
  [25, 316, 20, 332, 21, 346],    // outer hand
  [22, 358, 31, 362, 34, 354],    // fingertips
  [37, 346, 40, 334, 43, 320],    // inner hand to wrist
  [47, 296, 52, 268, 56, 240],    // inner forearm
  [60, 214, 63, 186, 66, 162],    // inner upper arm
  [68, 152, 73, 150, 76, 157],    // armpit
  [79, 180, 82, 210, 84, 232],    // side of chest to waist
  [85, 250, 77, 270, 76, 292],    // waist to hip
  [75, 330, 82, 390, 86, 440],    // outer thigh to knee
  [87, 470, 81, 500, 85, 535],    // calf
  [87, 552, 90, 562, 90, 570],    // ankle
  [86, 580, 77, 589, 80, 595],    // outer foot
  [86, 601, 104, 599, 108, 592],  // sole and toes
  [110, 584, 107, 576, 106, 568], // inner ankle
  [104, 540, 110, 500, 108, 470], // inner calf
  [106, 452, 109, 442, 110, 430], // inner knee
  [112, 390, 116, 340, 120, 322], // inner thigh to crotch
]);

// ---------- anatomy (body space) ----------
export const ANAT = {
  brain: [120, 28],
  hypothalamus: [120, 41.5],
  pituitary: [120, 47.5],
  pineal: [120, 34],
  eyeL: [108, 43.5], eyeR: [132, 43.5],
  mouth: [120, 66],
  thyroid: [120, 91],
  lungL: [99, 160], lungR: [141, 160],
  heart: [128, 168],
  liver: [100, 205],
  stomach: [141, 208],
  pancreas: [125, 238],
  kidneyL: [94, 241], kidneyR: [146, 238],
  adrenalL: [95, 224], adrenalR: [146, 220.5],
  gut: [120, 268],
  bladder: [120, 304],
  ovaryL: [103, 296], ovaryR: [137, 296],
  testisL: [114, 333], testisR: [126, 333],
  cordTop: [120, 62], cordMid: [120, 150], cordEnd: [120, 236],
  armMuscleL: [57, 178], armMuscleR: [183, 178],
  thighL: [97, 370], thighR: [143, 370],
  handL: [29, 340], handR: [211, 340],
};

const BRAIN_PATH = symmetric([120, 9], [
  [106, 7, 93, 15, 92, 29],
  [91, 39, 94, 48, 101, 52],
  [106, 55, 111, 52, 113, 48],
  [115, 45, 118, 44, 120, 44],
]);
const GYRI = [
  'M99,21 C103,18 108,23 113,19', 'M96,32 C101,29 106,35 112,31', 'M98,43 C102,40 106,45 111,42',
  'M104,13 C107,16 111,13 115,15',
].flatMap(both).join(' ');

const LUNG_L = 'M112,114 C100,112 86,124 82,148 C79,170 80,192 84,204 C95,207 106,205 116,199 C117,170 117,140 112,114 Z';
const LUNG_LOBE_L = 'M85,168 C94,164 104,158 113,150';
const HEART = 'M118,152 C124,146 136,148 140,156 C145,166 140,180 128,191 C120,185 112,175 113,164 C113,158 115,154 118,152 Z';
const HEART_VESSELS = 'M123,151 C121,141 131,136 137,146 M128,150 C129,144 131,141 134,140';
const LIVER = 'M83,194 C98,188 121,190 133,197 C129,209 112,217 92,221 C86,213 83,203 83,194 Z';
const STOMACH = 'M127,196 C137,189 153,193 153,206 C153,221 143,231 128,231 C119,231 115,226 117,221 C125,222 134,216 132,206 C131,202 129,199 127,196 Z';
const PANCREAS = 'M104,239 C109,233 118,233 128,233 C134,232 139,230 143,231 C146,234 143,238 137,240 C128,242 116,244 108,245 C104,245 102,242 104,239 Z';
const ADRENAL_L = 'M88,230 C89,223 94,219 97,219 C100,222 101,227 100,230 C96,231 92,231 88,230 Z';
const ADRENAL_R = 'M140,227 C141,220 146,216 149,216 C152,219 153,224 152,227 C148,228 144,228 140,227 Z';
const GUT_LARGE = 'M98,294 C96,280 96,262 98,250 C100,244 106,243 112,244 L130,244 C136,243 142,245 143,251 C145,262 145,280 142,294';
const GUT_SMALL = 'M106,254 C112,250 118,258 124,254 C130,250 137,256 134,263 C129,270 120,262 114,268 C108,274 104,282 110,286 C116,290 124,282 131,286';
const THYROID = 'M120,93 C116,86 110,85 109,90 C108,96 113,99 118,96 Z M120,93 C124,86 130,85 131,90 C132,96 127,99 122,96 Z M117,95 L123,95';
const EYE_L = 'M102,43.5 C105,40.5 111,40.5 114,43.5 C111,46.5 105,46.5 102,43.5 Z';
const ARM_MUSCLE_L = 'M60,148 C54,164 52,186 52,204 C56,207 60,205 62,201 C64,184 65,166 63,150 Z';
const THIGH_MUSCLE_L = 'M82,318 C80,346 84,380 92,412 C97,414 101,412 104,408 C108,380 110,346 108,318 C100,312 90,312 82,318 Z';

// ---------- peripheral nerves (somatic) ----------
export const NERVES = {
  arm: both('M120,100 C104,102 82,108 66,122 C57,150 51,190 47,226 C44,260 38,286 35,305 C33,320 30,334 28,348'),
  hand: [...both('M34,316 C30,328 25,338 23,347'), ...both('M36,318 C37,330 37,342 36,352')],
  armBranch: both('M54,170 C50,186 49,200 50,214'),
  leg: both('M120,284 C112,294 102,302 98,330 C95,370 97,410 98,440 C99,480 95,510 96,540 C97,558 97,574 95,592'),
  femoral: both('M118,262 C112,276 106,292 104,320 C102,346 100,372 101,398'),
  ribs: [118, 136, 154, 172, 190, 208].flatMap((y) => both(`M120,${y} C110,${y + 2} 98,${y + 4} 86,${y + 12}`)),
  face: [...both('M115,47 C109,53 103,59 99,67'), ...both('M117,50 C113,58 111,66 109,74')],
  neck: both('M120,70 C114,74 110,80 108,88'),
};

// ---------- autonomic nerves ----------
export const AUTONOMIC = {
  chain: both('M113,98 L113,286'),
  // sympathetic: leaves the middle (thoracic and upper lumbar) section of the spinal cord
  symEye: both('M113,100 C111,82 111,62 109,46'),
  symSaliva: both('M113,98 C112,86 112,76 110,68'),
  symLung: ['M120,124 L113,128 C108,136 104,146 100,156', 'M120,124 L127,128 C132,136 136,146 140,156'],
  symHeart: ['M120,136 L127,140 C129,150 129,157 128,164'],
  symLiver: ['M120,196 L113,199 C108,201 103,203 99,205'],
  symStomach: ['M120,198 L127,201 C132,203 136,205 140,208'],
  symAdrenal: ['M120,214 L113,217 C108,220 102,222 96,224', 'M120,212 L127,214 C133,216 139,218 145,220'],
  symGut: ['M120,232 L113,240 C113,250 115,258 117,266'],
  symBladder: ['M120,234 L127,246 C126,272 123,288 121,298'],
  // parasympathetic: leaves the brainstem (e.g. the vagus nerve) and the bottom of the spinal cord
  vagus: ['M117,57 C114,70 112,86 112,102 C112,122 117,142 123,160 C127,174 132,190 138,206 C134,222 126,240 120,258'],
  paraLung: ['M112,118 C108,128 104,140 100,152', 'M114,124 C122,128 130,138 138,150'],
  paraEye: both('M118,45 C115,44.5 113,44 111,43.5'),
  paraSaliva: both('M117,55 C113,59 110,63 108,67'),
  sacral: ['M120,286 C121,292 121,296 120,299', 'M120,286 C124,282 130,280 134,286'],
};

// ---------- blood vessels (arteries, simplified) ----------
export const VESSELS = {
  aorta: 'M123,160 C121,150 121,144 121,140 C121,180 121,230 121,282',
  carotid: both('M121,140 C118,120 114,96 113,70 C112,62 112,56 113,50'),
  subclavian: both('M121,140 C108,132 84,120 70,124 C60,150 54,190 51,226 C48,260 42,286 39,305'),
  renal: both('M121,240 C112,240 104,241 100,241'),
  iliac: both('M121,282 C114,292 106,300 103,330 C101,370 101,410 102,440 C103,480 99,520 100,560'),
};

// Routes the hormone particles follow (all continuous paths in body space).
const FROM_HEART = 'M124,163 C122,156 121,148 121,140';
export const ROUTES = {
  armL: FROM_HEART + ' C108,132 84,120 70,124 C60,150 54,190 51,226 C48,260 42,286 39,305',
  armR: FROM_HEART + ' C134,132 156,120 170,124 C180,150 186,190 189,226 C192,260 198,286 201,305',
  headL: FROM_HEART + ' C118,120 114,96 113,70 C112,62 112,56 113,50',
  headR: FROM_HEART + ' C122,120 126,96 127,70 C128,62 128,56 127,50',
  legL: 'M124,166 C121,190 121,230 121,282 C114,292 106,300 103,330 C101,370 101,400 102,420',
  legR: 'M124,166 C121,190 121,230 121,282 C126,292 134,300 137,330 C139,370 139,400 138,420',
  toAdrenalL: 'M124,166 C121,190 121,220 121,236 C112,237 104,232 97,226',
  toAdrenalR: 'M124,166 C121,190 121,220 121,234 C130,232 140,228 145,222',
  toThyroid: FROM_HEART + ' C120,124 119,108 118,96',
  toOvaryL: 'M124,166 C121,190 121,230 121,282 C116,288 108,292 104,295',
  toOvaryR: 'M124,166 C121,190 121,230 121,282 C126,288 132,292 136,295',
  toTestisL: 'M124,166 C121,190 121,230 121,282 C118,300 115,314 114,328',
  toTestisR: 'M124,166 C121,190 121,230 121,282 C122,300 125,314 126,328',
  toLiver: 'M124,166 C121,180 116,192 104,204',
  toStomach: 'M124,166 C126,180 132,192 138,204',
  toLungL: FROM_HEART + ' C114,140 106,150 100,160',
  toLungR: FROM_HEART + ' C128,140 134,150 140,160',
  // glands into the blood, heading for the heart
  pituitaryOut: 'M120,49 C117,56 114,66 113,76 C114,100 118,130 121,150 C122,156 123,160 124,163',
  thyroidOut: 'M118,96 C117,112 119,136 121,150 C122,156 123,160 124,163',
  adrenalLOut: 'M96,226 C102,234 112,237 119,236 C119,210 121,186 124,168',
  adrenalROut: 'M145,222 C138,230 128,234 122,234 C121,210 122,186 124,168',
  pancreasOut: 'M124,237 C118,226 110,214 101,207',
  pancreasToHeart: 'M101,207 C108,196 118,182 124,168',
  ovaryLOut: 'M104,296 C110,290 117,286 119,282 C119,240 121,200 124,168',
  ovaryROut: 'M136,296 C130,290 123,286 121,282 C121,240 122,200 124,168',
  testisLOut: 'M114,330 C116,312 118,296 119,282 C119,240 121,200 124,168',
  testisROut: 'M126,330 C124,312 122,296 121,282 C121,240 122,200 124,168',
};

// ---------- markup snippets ----------
const P = (d, cls, part, extra = '') => `<path d="${d}" class="${cls}" ${part ? `data-part="${part}"` : ''} ${extra}/>`;

export function defs(uid) {
  return `<defs>
    <linearGradient id="${uid}-skin" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" class="bh-skin-a"/><stop offset=".5" class="bh-skin-b"/><stop offset="1" class="bh-skin-a"/>
    </linearGradient>
    <radialGradient id="${uid}-glow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;
}

export const svg = {
  silhouette: (uid) => `<path class="bh-skin" d="${BODY_PATH}" fill="url(#${uid}-skin)"/>`,
  brain: (part = 'brain cns') => `<g class="bh-brain" data-part="${part}"><path class="bh-brain-shape" d="${BRAIN_PATH}"/><path class="bh-brain-gyri" d="${GYRI} M120,10 L120,44"/></g>`,
  cord: (part = 'cord cns') => `<g class="bh-cord" data-part="${part}">
      <path class="bh-cord-halo" d="M120,44 L120,236"/>
      <path class="bh-cord-line" d="M120,44 L120,62"/><path class="bh-cord-line thin" d="M120,62 L120,236"/>
      <path class="bh-cauda" d="M120,236 L118,300 M120,236 L120,302 M120,236 L122,300 M120,236 L116,296 M120,236 L124,296"/></g>`,
  eyes: (part = 'eyes') => `<g data-part="${part}" class="bh-eyes">${both(EYE_L).map((d) => `<path class="bh-eye" d="${d}"/>`).join('')}
      <circle class="bh-iris" cx="${ANAT.eyeL[0]}" cy="${ANAT.eyeL[1]}" r="2.3"/><circle class="bh-iris" cx="${ANAT.eyeR[0]}" cy="${ANAT.eyeR[1]}" r="2.3"/>
      <circle class="bh-pupil" cx="${ANAT.eyeL[0]}" cy="${ANAT.eyeL[1]}" r="1.1"/><circle class="bh-pupil" cx="${ANAT.eyeR[0]}" cy="${ANAT.eyeR[1]}" r="1.1"/></g>`,
  lungs: (part = 'lungs organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-lung)">${both(LUNG_L).map((d) => `<path class="bh-organ" d="${d}"/>`).join('')}${both(LUNG_LOBE_L).map((d) => `<path class="bh-organ-line" d="${d}"/>`).join('')}</g>`,
  heart: (part = 'heart organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-heart)"><path class="bh-organ" d="${HEART}"/><path class="bh-organ-line" d="${HEART_VESSELS}"/></g>`,
  liver: (part = 'liver organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-liver)"><path class="bh-organ" d="${LIVER}"/></g>`,
  stomach: (part = 'stomach organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-gut)"><path class="bh-organ" d="${STOMACH}"/></g>`,
  gut: (part = 'gut organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-gut)"><path class="bh-organ bh-gut-large" d="${GUT_LARGE}"/><path class="bh-organ-line" d="${GUT_SMALL}"/></g>`,
  kidneys: (part = 'kidneys organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-kidney)">
      <ellipse class="bh-organ" cx="${ANAT.kidneyL[0]}" cy="${ANAT.kidneyL[1]}" rx="7.5" ry="12" transform="rotate(-8 ${ANAT.kidneyL[0]} ${ANAT.kidneyL[1]})"/>
      <ellipse class="bh-organ" cx="${ANAT.kidneyR[0]}" cy="${ANAT.kidneyR[1]}" rx="7.5" ry="12" transform="rotate(8 ${ANAT.kidneyR[0]} ${ANAT.kidneyR[1]})"/></g>`,
  bladder: (part = 'bladder organ') => `<g data-part="${part}" class="bh-organ-g" style="--oc:var(--c-kidney)"><ellipse class="bh-organ" cx="120" cy="304" rx="10" ry="7"/></g>`,
  muscles: (part = 'muscles') => `<g data-part="${part}" class="bh-organ-g bh-muscle-g" style="--oc:var(--c-muscle)">${[...both(ARM_MUSCLE_L), ...both(THIGH_MUSCLE_L)].map((d) => `<path class="bh-organ bh-muscle" d="${d}"/>`).join('')}</g>`,
  // glands
  hypothalamus: (part = 'hypothalamus gland') => `<ellipse data-part="${part}" class="bh-gland" style="--gc:var(--c-brainpart)" cx="120" cy="41.5" rx="4.2" ry="2.4"/>`,
  pituitary: (part = 'pituitary gland') => `<g data-part="${part}" class="bh-gland-g" style="--gc:var(--c-gland)"><path class="bh-gland-stalk" d="M120,43 L120,46"/><circle class="bh-gland" cx="120" cy="47.8" r="2.6"/></g>`,
  pineal: (part = 'pineal gland') => `<circle data-part="${part}" class="bh-gland bh-extra" style="--gc:var(--c-gland)" cx="120" cy="34" r="2"/>`,
  thyroid: (part = 'thyroid gland') => `<path data-part="${part}" class="bh-gland" style="--gc:var(--c-gland)" d="${THYROID}"/>`,
  adrenals: (part = 'adrenals gland') => `<g data-part="${part}" class="bh-gland-g" style="--gc:var(--c-gland)"><path class="bh-gland" d="${ADRENAL_L}"/><path class="bh-gland" d="${ADRENAL_R}"/></g>`,
  pancreas: (part = 'pancreas gland') => `<path data-part="${part}" class="bh-gland" style="--gc:var(--c-gland)" d="${PANCREAS}"/>`,
  ovaries: (part = 'ovaries gland') => `<g data-part="${part}" class="bh-gland-g" style="--gc:var(--c-gland)">
      <path class="bh-gland-stalk" d="M107,294 C112,288 128,288 133,294"/>
      <ellipse class="bh-gland" cx="103" cy="296" rx="4.6" ry="3.1"/><ellipse class="bh-gland" cx="137" cy="296" rx="4.6" ry="3.1"/></g>`,
  testes: (part = 'testes gland') => `<g data-part="${part}" class="bh-gland-g" style="--gc:var(--c-gland)">
      <ellipse class="bh-gland" cx="114" cy="333" rx="4" ry="5.6"/><ellipse class="bh-gland" cx="126" cy="333" rx="4" ry="5.6"/></g>`,
  vessels: (part = 'vessels') => `<g data-part="${part}" class="bh-vessels">${[VESSELS.aorta, ...VESSELS.carotid, ...VESSELS.subclavian, ...VESSELS.renal, ...VESSELS.iliac].map((d) => `<path d="${d}"/>`).join('')}</g>`,
  nerves(list, cls, part) { return list.map((d) => P(d, `bh-nerve ${cls}`, part)).join(''); },
};

/** All routes as invisible paths, so the animator can move particles along them. */
export function routePaths(routes = ROUTES) {
  return `<g class="bh-routes" aria-hidden="true">${Object.entries(routes).map(([k, d]) => `<path data-route="${k}" d="${d}"/>`).join('')}</g>`;
}

// ---------- parts on/off ----------
/** Light the parts whose data-part tokens include any of `on`; hide `hide`; dim everything else. */
export function light(root, on = [], hide = []) {
  const onS = new Set(on), hideS = new Set(hide);
  root.querySelectorAll('[data-part]').forEach((el) => {
    const toks = el.dataset.part.split(/\s+/);
    const isOn = toks.some((t) => onS.has(t));
    const isHide = !isOn && toks.some((t) => hideS.has(t));
    el.classList.toggle('is-on', isOn);
    el.classList.toggle('is-hide', isHide);
    el.classList.toggle('is-dim', !isOn && !isHide);
  });
}

// ---------- scale watcher ----------
/** Keeps `--k` (viewBox units per screen pixel) up to date so text can stay readable. */
export function watchScale(svgElm, vb, cb) {
  let last = 0;
  const run = () => {
    const r = svgElm.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const k = 1 / Math.min(r.width / vb.w, r.height / vb.h);
    if (Math.abs(k - last) < 0.005) return;
    last = k;
    svgElm.style.setProperty('--k', k.toFixed(3));
    cb?.(k);
  };
  const ro = new ResizeObserver(run);
  ro.observe(svgElm);
  run();
  return () => ro.disconnect();
}

// ---------- labels with leader lines ----------
/**
 * labels: [{ at:[x,y], text:'Thyroid', sub:'releases thyroxine', side:'left'|'right'|'manual', y?, x?, anchor?, color? }]
 * Coordinates are in the SVG's outer (viewBox) space. Text sits at the left/right margin and
 * the leader line runs from the text to a dot on the thing it names.
 */
export function createLabels(layer, vb, opts = {}) {
  const margin = opts.margin ?? 12;
  const dflt = () => [vb.y + 8, vb.y + vb.h - 8];
  let bounds = { left: dflt(), right: dflt() };
  let k = 1, items = [];
  const fsMain = () => Math.max(17, 16 * k);
  const fsSub = () => Math.max(15, 14.5 * k);

  let last = [];
  const compact = () => k > 1.8; // small screens: short names only, no second lines
  function set(labels = []) {
    last = labels;
    layer.replaceChildren();
    const cmp = compact();
    items = labels.map((L0, i) => {
      const L = cmp ? { ...L0, text: L0.short ?? L0.text, sub: L0.short ? '' : (L0.compactSub ?? '') } : L0;
      const g = svgEl('g', { class: `bh-lbl ${L.cls || ''}` });
      g.style.animationDelay = `${i * 90}ms`;
      if (L.color) g.style.setProperty('--lc', L.color);
      const line = svgEl('polyline', { class: 'bh-lbl-line' });
      const dot = svgEl('circle', { class: 'bh-lbl-dot', cx: L.at[0], cy: L.at[1] });
      const text = svgEl('text', { class: 'bh-lbl-text' });
      const rows = [
        ...String(L.text).split('\n').map((t) => ({ t, sub: false })),
        ...(L.sub ? String(L.sub).split('\n').map((t) => ({ t, sub: true })) : []),
      ].map((r) => {
        const ts = svgEl('tspan', { class: r.sub ? 'bh-lbl-sub' : 'bh-lbl-main' });
        ts.textContent = r.t;
        text.append(ts);
        return { ...r, ts };
      });
      if (L.noDot) dot.setAttribute('hidden', '');
      g.append(line, dot, text);
      layer.append(g);
      return { L, g, line, dot, text, rows };
    });
    layout();
  }

  function layout() {
    if (!items.length) return;
    const fm = fsMain(), fsb = fsSub(), m = margin * Math.max(1, k * 0.8), gap = 8 * k;
    const lh = (r) => (r.sub ? fsb : fm) * 1.2;
    for (const it of items) {
      it.h = it.rows.reduce((s, r) => s + lh(r), 0);
      it.cy = it.L.y ?? it.L.at[1];
      it.dot.setAttribute('r', (3.6 * Math.max(1, k * 0.9)).toFixed(2));
    }
    // collision avoidance per side
    for (const side of ['left', 'right']) {
      const col = items.filter((it) => (it.L.side || 'left') === side).sort((a, b) => a.cy - b.cy);
      const [minY, maxY] = bounds[side];
      for (let i = 0; i < col.length; i++) {
        const prev = col[i - 1];
        const lo = prev ? prev.cy + prev.h / 2 + gap + col[i].h / 2 : minY + col[i].h / 2;
        col[i].cy = Math.max(col[i].cy, lo);
      }
      for (let i = col.length - 1; i >= 0; i--) {
        const next = col[i + 1];
        const hi = next ? next.cy - next.h / 2 - gap - col[i].h / 2 : maxY - col[i].h / 2;
        col[i].cy = Math.min(col[i].cy, hi);
      }
    }
    for (const it of items) {
      const { L } = it;
      const side = L.side || 'left';
      let x, anchor;
      if (side === 'manual') { x = L.x; anchor = L.anchor || 'start'; }
      else if (side === 'left') { x = vb.x + m; anchor = 'start'; }
      else { x = vb.x + vb.w - m; anchor = 'end'; }
      it.text.setAttribute('text-anchor', anchor);
      let y = it.cy - it.h / 2;
      for (const r of it.rows) {
        const f = r.sub ? fsb : fm;
        r.ts.setAttribute('x', x);
        r.ts.setAttribute('y', (y + f * 0.92).toFixed(1));
        r.ts.style.fontSize = `${f.toFixed(1)}px`;
        y += f * 1.2;
      }
      let w = 0;
      try { w = it.text.getBBox().width; } catch { w = 0; }
      const [tx, ty] = L.at;
      let pts = '';
      const pad = 6 * k, elbow = 10 * k;
      const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, right = left + w;
      if (tx > right + pad || tx < left - pad) {
        const dir = tx > right ? 1 : -1;
        const x0 = dir === 1 ? right + pad : left - pad;
        if ((tx - x0) * dir > elbow * 1.5) pts = `${x0},${it.cy} ${x0 + dir * elbow},${it.cy} ${tx},${ty}`;
        else pts = `${x0},${it.cy} ${tx},${ty}`;
      } else {
        const top = it.cy - it.h / 2, bot = it.cy + it.h / 2;
        if (ty < top - pad || ty > bot + pad) {
          const y0 = ty < top ? top - pad / 2 : bot + pad / 2;
          pts = `${Math.min(Math.max(tx, left), right)},${y0} ${tx},${ty}`;
        }
      }
      it.line.setAttribute('points', pts);
    }
  }

  return {
    set,
    layout,
    setScale(newK) {
      const was = compact();
      k = newK;
      if (compact() !== was) set(last); else layout();
    },
    /** Limit where side labels may go (e.g. to keep clear of a panel). */
    setBounds(b = {}) { bounds = { left: b.left || dflt(), right: b.right || dflt() }; },
    clear() { set([]); },
  };
}

// ---------- animation ----------
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A tiny animator. Every call to clear() cancels running animations (they resolve early) and removes
 * the temporary dots. When reducedMotion() is on, nothing moves: pulses become still dotted trails
 * that show the direction of travel (the end-state).
 */
export function createAnimator(layer) {
  let gen = 0;
  const temp = new Set();
  const rm = () => reducedMotion();
  const add = (e) => { layer.append(e); temp.add(e); return e; };

  function frame(dur, fn, token = gen) {
    return new Promise((res) => {
      if (rm() || dur <= 0) { fn(1); res(); return; }
      const t0 = performance.now();
      const tick = (now) => {
        if (token !== gen) { res(); return; }
        const t = Math.min(1, (now - t0) / dur);
        fn(t);
        if (t < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  function wait(ms) {
    if (rm()) return Promise.resolve();
    const token = gen;
    return new Promise((res) => setTimeout(() => res(token === gen), ms));
  }
  function trail(path, { color, r = 2, n = 4, reverse = false, cls = '' } = {}) {
    const L = path.getTotalLength();
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 1);
      const p = path.getPointAtLength((reverse ? 1 - f : f) * L);
      const c = add(svgEl('circle', { cx: p.x, cy: p.y, r: r * (0.6 + 0.4 * f), class: `bh-trail ${cls}` }));
      c.style.setProperty('--pc', color);
    }
  }
  /** Move one glowing dot along a path. Resolves when it arrives (or when cancelled). */
  async function pulse(path, { color = 'currentColor', r = 2.6, dur = 1400, reverse = false, keep = false, cls = '', delay = 0, make = null, linear = false, noTrail = false } = {}) {
    if (!path) return;
    if (rm()) { if (!noTrail) trail(path, { color, r: r * 0.8, reverse, cls }); return; }
    const token = gen;
    if (delay) { await wait(delay); if (token !== gen) return; }
    const L = path.getTotalLength();
    const c = add(make ? make() : svgEl('circle', { r, class: `bh-pulse ${cls}` }));
    c.style.setProperty('--pc', color);
    await frame(dur, (t) => {
      const e = linear ? t : ease(t);
      const p = path.getPointAtLength((reverse ? 1 - e : e) * L);
      if (make) c.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      else { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); }
      c.style.opacity = String(Math.min(1, t * 6, keep ? 1 : (1 - t) * 6));
    }, token);
    if (!keep) { c.remove(); temp.delete(c); }
  }
  /** Several dots, one after another, along the same path. */
  function stream(path, { count = 4, spacing = 260, ...opts } = {}) {
    if (rm()) { pulse(path, opts); return Promise.resolve(); }
    return Promise.all(Array.from({ length: count }, (_, i) => pulse(path, { ...opts, delay: (opts.delay || 0) + i * spacing })));
  }
  return {
    frame, wait, pulse, stream, trail,
    get token() { return gen; },
    alive(token) { return token === gen; },
    clear() { gen++; temp.forEach((e) => e.remove()); temp.clear(); return gen; },
    reduced: rm,
  };
}

// ---------- shared CSS ----------
const CSS = `
.bhv { position:absolute; inset:0; display:flex; flex-direction:column; color:var(--bh-ink);
  --bh-bg: var(--surface); --bh-ink: var(--ink); --bh-soft: var(--ink-soft);
  --bh-skin1: color-mix(in srgb, var(--accent) 6%, var(--surface));
  --bh-skin2: color-mix(in srgb, var(--accent) 12%, var(--surface));
  --bh-edge: color-mix(in srgb, var(--ink) 24%, transparent);
  --bh-organ: color-mix(in srgb, var(--ink) 7%, var(--surface));
  --bh-organ-edge: color-mix(in srgb, var(--ink) 26%, transparent);
  --bh-panel: color-mix(in srgb, var(--ink) 4%, var(--surface));
  --c-cns:#5B45D0; --c-pns:#0B7A84; --c-aut:#8C5E00; --c-sym:#C2410C; --c-para:#1F67B5;
  --c-blood:#B8324A; --c-gland:#A35F00; --c-brainpart:#7A4DD8; --c-hormone:#C26A00;
  --c-heart:#C0394F; --c-lung:#C2577A; --c-liver:#8A4B2A; --c-gut:#9A6A1E; --c-kidney:#7B5C9E; --c-muscle:#B04A3A;
}
:root[data-theme="dark"] .bhv, .lesson-visual.dark .bhv {
  --c-cns:#B3A6FF; --c-pns:#4FD2CB; --c-aut:#F0C35A; --c-sym:#FF9A5C; --c-para:#7DBBFF;
  --c-blood:#FF7088; --c-gland:#FFC15E; --c-brainpart:#C9A7FF; --c-hormone:#FFD27A;
  --c-heart:#FF7B8E; --c-lung:#FF9BB8; --c-liver:#E0A07A; --c-gut:#E8C07A; --c-kidney:#C3A6EE; --c-muscle:#FF9A86;
}
.lesson-visual.dark .bhv {
  --bh-bg: var(--stage); --bh-ink: var(--stage-ink); --bh-soft: #B9C2DA;
  --bh-skin1: rgb(150 175 255 / 7%); --bh-skin2: rgb(150 175 255 / 15%);
  --bh-edge: rgb(200 215 255 / 34%);
  --bh-organ: rgb(255 255 255 / 7%); --bh-organ-edge: rgb(220 230 255 / 26%);
  --bh-panel: rgb(255 255 255 / 6%);
}
.bhv .bh-svg { flex:1 1 auto; min-height:0; width:100%; display:block; }
.bhv .vis-caption, .lesson-visual .bhv .vis-caption { position:static; margin:0; padding:6px 16px 12px; max-width:none; font-weight:700; font-size:.95rem; color:var(--bh-ink); }
.bhv .bh-skin-a { stop-color: var(--bh-skin1); }
.bhv .bh-skin-b { stop-color: var(--bh-skin2); }
.bhv .bh-skin { stroke: var(--bh-edge); stroke-width: 1.1; filter: drop-shadow(0 4px 10px rgb(20 30 60 / 8%)); }
.lesson-visual.dark .bhv .bh-skin { filter: drop-shadow(0 0 14px rgb(120 150 255 / 14%)); }
.bhv [data-part] { transition: opacity .55s ease; }
.bhv .is-dim { opacity: .2; }
.bhv .is-hide { opacity: 0; pointer-events:none; }
.bhv .is-on { opacity: 1; }
.bhv .bh-brain-shape { fill: color-mix(in srgb, var(--c-cns) 16%, var(--bh-bg)); stroke: var(--c-cns); stroke-width: 1; }
.bhv .bh-brain-gyri { fill:none; stroke: color-mix(in srgb, var(--c-cns) 55%, transparent); stroke-width: .7; stroke-linecap: round; }
.bhv .bh-cord-halo { stroke: color-mix(in srgb, var(--c-cns) 18%, transparent); stroke-width: 9; stroke-linecap: round; }
.bhv .bh-cord-line { stroke: var(--c-cns); stroke-width: 5; stroke-linecap: round; }
.bhv .bh-cord-line.thin { stroke-width: 3.6; }
.bhv .bh-cauda { stroke: var(--c-cns); stroke-width: .9; fill:none; stroke-linecap: round; }
.bhv .bh-nerve { fill:none; stroke: var(--nc, var(--c-pns)); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.bhv .bh-nerve.fine { stroke-width: 1; }
.bhv .bh-nerve.chain { stroke-dasharray: 1.5 3; stroke-width: 1.8; }
.bhv .bh-organ { fill: var(--bh-organ); stroke: var(--bh-organ-edge); stroke-width: .8; transition: fill .5s, stroke .5s; }
.bhv .bh-gut-large { fill: none; stroke-width: 6; stroke-linecap: round; stroke: color-mix(in srgb, var(--bh-organ-edge) 60%, var(--bh-organ)); }
.bhv .bh-organ-line { fill: none; stroke: var(--bh-organ-edge); stroke-width: .8; stroke-linecap: round; }
.bhv .bh-organ-g.is-on .bh-organ { fill: color-mix(in srgb, var(--oc) 32%, var(--bh-bg)); stroke: var(--oc); }
.bhv .bh-organ-g.is-on .bh-gut-large { fill:none; stroke: color-mix(in srgb, var(--oc) 45%, var(--bh-bg)); }
.bhv .bh-organ-g.is-on .bh-organ-line { stroke: var(--oc); }
.bhv .bh-eye { fill: var(--bh-bg); stroke: var(--bh-edge); stroke-width: .7; }
.bhv .bh-iris { fill: color-mix(in srgb, #3D7A9A 70%, var(--bh-bg)); }
.bhv .bh-pupil { fill: #111; }
.lesson-visual.dark .bhv .bh-pupil { fill: #05070d; }
.bhv .bh-gland { fill: color-mix(in srgb, var(--gc) 30%, var(--bh-bg)); stroke: var(--gc); stroke-width: .9; transition: fill .5s; }
.bhv .bh-gland-stalk { fill:none; stroke: var(--gc); stroke-width: 1; }
.bhv .bh-gland.bh-extra { stroke-dasharray: 1.2 1.2; }
.bhv .is-on .bh-gland, .bhv .bh-gland.is-on { fill: var(--gc); }
.bhv .bh-vessels path { fill:none; stroke: var(--c-blood); stroke-width: 1.3; stroke-linecap: round; opacity: .75; }
.bhv .bh-routes path { fill:none; stroke:none; }
.bhv .bh-pulse { fill: var(--pc); stroke: var(--bh-bg); stroke-width: .6; }
.bhv .bh-trail { fill: var(--pc); opacity: .85; }
.lesson-visual.dark .bhv .bh-pulse { filter: drop-shadow(0 0 3px var(--pc)); }
.lesson-visual.dark .bhv .is-on .bh-gland, .lesson-visual.dark .bhv .bh-gland.is-on { filter: drop-shadow(0 0 3px var(--gc)); }
.bhv .bh-arrive { animation: bhArrive 1.6s ease-out 1; transform-box: fill-box; transform-origin: center; }
@keyframes bhArrive { 0% { transform: scale(1); } 35% { transform: scale(1.35); } 100% { transform: scale(1); } }
/* labels */
.bhv .bh-lbl { animation: bhFade .5s ease both; }
@keyframes bhFade { from { opacity: 0; } to { opacity: 1; } }
.bhv .bh-lbl-text { font-family: var(--font); paint-order: stroke; stroke: var(--bh-bg); stroke-width: calc(5px * var(--k, 1)); stroke-linejoin: round; letter-spacing: 0; word-spacing: 0; }
.bhv .bh-lbl-main { font-weight: 700; fill: var(--bh-ink); }
.bhv .bh-lbl-sub { font-weight: 400; fill: var(--bh-soft); }
.bhv .bh-lbl-line { fill:none; stroke: color-mix(in srgb, var(--lc, var(--bh-ink)) 75%, var(--bh-ink)); stroke-width: calc(1.5px * var(--k, 1)); stroke-linecap: round; stroke-linejoin: round; }
.bhv .bh-lbl-dot { fill: var(--lc, var(--bh-ink)); stroke: var(--bh-bg); stroke-width: calc(1.5px * var(--k, 1)); }
.bhv .vis-controls { position:absolute; top:12px; left:12px; right:auto; z-index:3; }
.bhv .bh-foot { display:flex; align-items:center; gap: 8px; padding-right: 12px; min-height: 52px; }
.bhv .bh-foot .vis-caption { flex: 1 1 auto; padding-top: 8px; padding-bottom: 10px; }
.bhv .bh-foot .vis-controls { position: static; flex: none; }
.bhv .bh-foot .vis-controls button { font-size: .85rem; padding: 0 14px; }
:root[data-calm="true"] .bhv * { filter: none !important; }
`;

export function injectCSS(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.append(s);
}
export function injectBodyCSS() { injectCSS('bh-body-css', CSS); }

/** A "Play again" button inside a .vis-controls bar. Hidden when motion is reduced. */
export function playAgainButton(parent, onClick) {
  const bar = document.createElement('div');
  bar.className = 'vis-controls';
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = '<span aria-hidden="true">↻</span> Play again';
  b.addEventListener('click', onClick);
  bar.append(b);
  parent.append(bar);
  return {
    bar, button: b,
    show(on) { b.hidden = !on || reducedMotion(); bar.hidden = b.hidden && !bar.querySelector('button:not([hidden])'); },
  };
}

let uidN = 0;
export const uid = (p = 'bh') => `${p}${++uidN}`;
