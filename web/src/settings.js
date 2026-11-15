// Reading & comfort settings. Stored on this device only (localStorage).
const KEY = 'bh-settings';
const DEFAULTS = {
  font: 'atkinson', textSize: '1', spacing: 'normal', theme: 'warm', overlay: 'none',
  motion: '', calm: 'false', level: 'simple', voiceRate: '0.9', voice: '',
};

let state = { ...DEFAULTS };
try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* private mode */ }
const listeners = new Set();

export function get(k) { return state[k]; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function set(k, v) {
  state[k] = String(v);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  apply();
  listeners.forEach((fn) => fn(k, state[k]));
}

export function reducedMotion() {
  return state.motion === 'reduced' || state.calm === 'true' ||
    (!state.motion && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const OVERLAYS = { none: null, yellow: '#FFF3B0', blue: '#CFE6FF', pink: '#FFD8E4', green: '#D6F5D6', peach: '#FFE0C2' };

export function apply() {
  const d = document.documentElement;
  d.dataset.font = state.font;
  d.dataset.spacing = state.spacing;
  d.dataset.theme = state.theme;
  d.dataset.calm = state.calm;
  d.dataset.level = state.level;
  const osReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (state.motion) d.dataset.motion = state.motion;
  else if (osReduce) d.dataset.motion = 'reduced';
  else delete d.dataset.motion;
  d.style.setProperty('--text-scale', state.textSize);
  let ov = document.querySelector('.overlay-tint');
  if (OVERLAYS[state.overlay]) {
    if (!ov) { ov = document.createElement('div'); ov.className = 'overlay-tint'; ov.setAttribute('aria-hidden', 'true'); document.body.append(ov); }
    ov.style.background = OVERLAYS[state.overlay];
  } else ov?.remove();
  document.querySelectorAll('.level-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === state.level)));
}

function optionRow(key, options, label) {
  const btns = options.map(([v, text, extra = '']) =>
    `<button type="button" data-key="${key}" data-value="${v}" aria-pressed="${state[key] === v}">${extra}${text}</button>`).join('');
  return `<fieldset><legend>${label}</legend><div class="option-row">${btns}</div></fieldset>`;
}

export function initSettings() {
  apply();
  const dlg = document.getElementById('settings');
  const render = () => {
    const voices = (window.speechSynthesis?.getVoices() || []).filter((v) => /^en/i.test(v.lang));
    dlg.innerHTML = `
      <div class="settings-inner">
        <div class="settings-head">
          <h2 id="settings-title">Make it comfortable</h2>
          <button type="button" data-close class="btn-quiet" aria-label="Close settings">✕ Close</button>
        </div>
        <p class="settings-preview">This is how text will look. Change anything until it feels easy to read.</p>
        ${optionRow('font', [['atkinson', 'Atkinson'], ['lexend', 'Lexend'], ['opendyslexic', 'OpenDyslexic'], ['arial', 'Arial'], ['verdana', 'Verdana']], 'Letters (font)')}
        ${optionRow('textSize', [['0.9', 'A−'], ['1', 'A'], ['1.15', 'A+'], ['1.3', 'A++'], ['1.5', 'A+++']], 'Text size')}
        ${optionRow('spacing', [['normal', 'Normal'], ['wide', 'Extra space']], 'Space between letters and lines')}
        ${optionRow('theme', [['warm', 'Warm white', '<span class="theme-dot" style="background:#FAF7F0"></span>'], ['cream', 'Cream', '<span class="theme-dot" style="background:#FDF6E3"></span>'], ['blue', 'Blue', '<span class="theme-dot" style="background:#E8F1F8"></span>'], ['green', 'Green', '<span class="theme-dot" style="background:#EAF4EA"></span>'], ['grey', 'Grey', '<span class="theme-dot" style="background:#EDEDED"></span>'], ['dark', 'Dark', '<span class="theme-dot" style="background:#16171C"></span>']], 'Background colour')}
        ${optionRow('overlay', [['none', 'None'], ['yellow', 'Yellow'], ['blue', 'Blue'], ['pink', 'Pink'], ['green', 'Green'], ['peach', 'Peach']], 'Coloured overlay')}
        ${optionRow('calm', [['false', 'Normal'], ['true', 'Calm (less movement, no glow)']], 'Calm mode')}
        ${optionRow('motion', [['', 'Follow my computer'], ['full', 'Animations on'], ['reduced', 'Animations off']], 'Movement')}
        <fieldset><legend>Read aloud</legend>
          <div class="slider"><label for="rate">Reading speed: <span id="rate-val">${state.voiceRate}</span>×</label>
          <input id="rate" type="range" min="0.6" max="1.4" step="0.05" value="${state.voiceRate}" /></div>
          ${voices.length ? `<label for="voice-pick">Voice</label>
          <select id="voice-pick" class="search">${['<option value="">Best British voice (automatic)</option>', ...voices.map((v) => `<option value="${v.name}" ${state.voice === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`)].join('')}</select>`
            : '<p>No voices found on this computer yet. Read-aloud may not work here.</p>'}
        </fieldset>
        <div class="option-row"><button type="button" data-reset>Reset to default</button><button type="button" class="btn-primary" data-close>Done</button></div>
        <p class="source-note">Settings are saved on this device only. Nothing is sent anywhere.</p>
      </div>`;
  };
  document.getElementById('settings-btn').addEventListener('click', () => { render(); dlg.showModal(); });
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => { if (dlg.open) render(); });
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === dlg || b?.hasAttribute('data-close')) { dlg.close(); return; }
    if (b?.hasAttribute('data-reset')) { Object.entries(DEFAULTS).forEach(([k, v]) => set(k, v)); render(); return; }
    if (b?.dataset.key) { set(b.dataset.key, b.dataset.value); render(); dlg.querySelector(`[data-key="${b.dataset.key}"][data-value="${b.dataset.value}"]`)?.focus(); }
  });
  dlg.addEventListener('input', (e) => {
    if (e.target.id === 'rate') { set('voiceRate', e.target.value); dlg.querySelector('#rate-val').textContent = e.target.value; }
    if (e.target.id === 'voice-pick') set('voice', e.target.value);
  });
  document.querySelectorAll('.level-toggle button').forEach((b) => b.addEventListener('click', () => set('level', b.dataset.level)));
}
