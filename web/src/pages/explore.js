import { BrainViewer } from '../brain/viewer.js';
import { STRUCTURES, GROUPS, byId, SOURCES } from '../data/structures.js';
import { get, onChange } from '../settings.js';
import { readButton } from '../speech.js';
import { buildVisualPathway } from '../brain/pathway.js';

export function render(main, [initial]) {
  main.innerHTML = `
  <div class="explorer">
    <aside class="panel" aria-labelledby="parts-title">
      <h2 id="parts-title">Brain parts</h2>
      <p class="source-note" style="border:0;margin:0 0 6px;padding:0">Choose a part, or click on the brain.</p>
      <div id="part-list"></div>
    </aside>
    <section class="stage-wrap" id="stage" aria-label="3D brain">
      <div class="stage-toolbar" role="toolbar" aria-label="View controls">
        <button type="button" data-mode="lobes" aria-pressed="true">Lobes</button>
        <button type="button" data-mode="functions" aria-pressed="false">Jobs (localisation)</button>
        <button type="button" data-real aria-pressed="false">Real colours</button>
        <button type="button" data-xray aria-pressed="false">See inside</button>
        <button type="button" data-head aria-pressed="false">Show head</button>
        <button type="button" data-vision aria-pressed="false">Eyes and vision</button>
        <span class="spacer"></span>
        <button type="button" data-hemi="left" aria-pressed="false" title="Hide the left hemisphere">Hide left</button>
        <button type="button" data-hemi="right" aria-pressed="false" title="Hide the right hemisphere">Hide right</button>
      </div>
      <div id="labels"></div>
      <button type="button" class="panel-toggle left" data-toggle-panel="parts" aria-expanded="true">☰ Parts</button>
      <button type="button" class="panel-toggle right" data-toggle-panel="info" aria-expanded="true">ⓘ Info</button>
      <div class="stage-slider slider">
        <label for="explode">Pull apart: <span id="explode-val">0%</span></label>
        <input id="explode" type="range" min="0" max="1" step="0.01" value="0" />
      </div>
      <div class="stage-hint" id="stage-hint" style="bottom:86px">Drag to turn · Scroll to zoom · Arrow keys work too</div>
    </section>
    <aside class="panel info-panel info" aria-live="polite" data-readable id="info"></aside>
  </div>`;

  const list = main.querySelector('#part-list');
  list.innerHTML = GROUPS.map((g) => `
    <p class="group-label">${g.label}</p>
    <ul class="part-list">${STRUCTURES.filter((s) => s.group === g.id).map((s) => `
      <li><button type="button" data-id="${s.id}" aria-pressed="false"><span class="swatch" style="background:${s.color}"></span>${s.name}</button></li>`).join('')}
    </ul>`).join('');

  const stage = main.querySelector('#stage');
  let pathway = null;
  const viewer = new BrainViewer(stage, { autoRotate: false, label: 'Interactive 3D brain built from real brain-scan atlases' });
  const info = main.querySelector('#info');
  const labels = main.querySelector('#labels');

  const renderInfo = (id) => {
    const s = byId[id];
    if (!s) {
      info.innerHTML = `
        <h2>Explore a real brain</h2>
        <p>This 3D brain is built from real brain scans, not drawn by hand. ${readButton()}</p>
        <ul class="facts">
          <li>Pick a part from the list, or click on the brain.</li>
          <li>Press <strong>Jobs (localisation)</strong> to see which areas do which jobs.</li>
          <li>Slide <strong>Pull apart</strong> to separate the lobes.</li>
          <li>Press <strong>See inside</strong> to look at the deep parts.</li>
        </ul>
        <p class="source-note">Built from published brain atlases. <a href="#/sources">Where does this come from?</a></p>`;
      return;
    }
    const level = get('level');
    info.innerHTML = `
      <p class="eyebrow">${GROUPS.find((g) => g.id === s.group)?.label || ''}</p>
      <h2>${s.name}</h2>
      <div class="controls-row" style="margin:8px 0 14px">${(s.spec || []).map((t) => `<span class="chip spec">AQA: ${t}</span>`).join('')}${s.beyond ? '<span class="chip">Extra: beyond the core spec</span>' : ''}</div>
      <p>${s.simple}</p>
      ${level === 'exam' ? `<h3>Exam detail</h3><ul class="facts">${s.exam.map((x) => `<li>${x}</li>`).join('')}</ul>`
        : `<button type="button" class="btn-quiet" data-show-exam>Show exam detail ▾</button><div hidden data-exam><ul class="facts">${s.exam.map((x) => `<li>${x}</li>`).join('')}</ul></div>`}
      <div class="controls-row">${readButton()}<button type="button" data-clear>Show whole brain</button></div>
      <p class="source-note">3D shape from: ${SOURCES[s.source]} <a href="#/sources">More about the data</a></p>`;
  };

  const syncList = (id) => list.querySelectorAll('button[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));

  viewer.on('select', (id) => {
    renderInfo(id); syncList(id);
    if (id && byId[id].region && viewer.mode !== 'functions') setMode('functions');
    if (id) history.replaceState(null, '', `#/explore/${id}`); else history.replaceState(null, '', '#/explore');
    document.getElementById('live').textContent = id ? `${byId[id].name} selected` : 'Whole brain';
  });

  // hover label
  let hoverId = null;
  viewer.on('hover', (id) => { hoverId = id; });
  viewer.on('frame', () => {
    const ids = [viewer.selected, hoverId && hoverId !== viewer.selected ? hoverId : null].filter(Boolean);
    labels.innerHTML = ids.map((id) => {
      const p = viewer.screenPos(id);
      return p ? `<div class="label3d" style="left:${p.x}px;top:${p.y}px"><span>${byId[id].name}</span></div>` : '';
    }).join('');
  });

  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) viewer.select(viewer.selected === b.dataset.id ? null : b.dataset.id);
  });
  info.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) { viewer.select(null, { fly: false }); viewer.frame('default'); }
    const se = e.target.closest('[data-show-exam]');
    if (se) { se.nextElementSibling.hidden = !se.nextElementSibling.hidden; se.textContent = se.nextElementSibling.hidden ? 'Show exam detail ▾' : 'Hide exam detail ▴'; }
  });

  const tb = main.querySelector('.stage-toolbar');
  const setMode = (m) => {
    viewer.setMode(m);
    tb.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  };
  tb.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { setMode(b.dataset.mode); if (byId[viewer.selected]?.region && b.dataset.mode === 'lobes') viewer.select(null, { fly: false }); }
    if (b.hasAttribute('data-real')) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); viewer.setReal(on); }
    if (b.hasAttribute('data-vision')) {
      const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
      if (on && !pathway) pathway = buildVisualPathway(viewer);
      pathway?.setVisible(on); viewer.setShowPaths(on);
      if (on) { viewer.setXray(true); tb.querySelector('[data-xray]').setAttribute('aria-pressed', 'true'); viewer.frame('topFront', false, 420); }
    }
    if (b.hasAttribute('data-head')) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); viewer.setHead(on); }
    if (b.hasAttribute('data-xray')) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); viewer.setXray(on); }
    if (b.dataset.hemi) {
      const on = b.getAttribute('aria-pressed') !== 'true';
      tb.querySelectorAll('[data-hemi]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', on);
      viewer.setHideHemisphere(on ? b.dataset.hemi : null);
      if (on) viewer.frame(b.dataset.hemi === 'left' ? 'left' : 'right');
    }
  });

  main.querySelectorAll('[data-toggle-panel]').forEach((btn) => btn.addEventListener('click', () => {
    const panel = btn.dataset.togglePanel === 'parts' ? main.querySelector('.explorer > aside') : info;
    const open = panel.classList.toggle('collapsed') === false;
    btn.setAttribute('aria-expanded', String(open));
  }));
  // move the toggle buttons out of the toolbar's way: they sit above the panels
  const ex = main.querySelector('#explode');
  ex.addEventListener('input', () => { viewer.setExplode(Number(ex.value)); main.querySelector('#explode-val').textContent = `${Math.round(ex.value * 100)}%`; });

  // keyboard: arrows orbit, +/- zoom, Esc resets (when focus is not in a form field)
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea, dialog')) return;
    const k = e.key;
    if (k === 'ArrowLeft') viewer.orbit(-0.12, 0); else if (k === 'ArrowRight') viewer.orbit(0.12, 0);
    else if (k === 'ArrowUp') viewer.orbit(0, -0.1); else if (k === 'ArrowDown') viewer.orbit(0, 0.1);
    else if (k === '+' || k === '=') viewer.zoom(0.85); else if (k === '-') viewer.zoom(1.18);
    else if (k === 'Escape') { viewer.select(null, { fly: false }); viewer.frame('default'); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  const offSettings = onChange((k) => { if (k === 'level') renderInfo(viewer.selected); });

  renderInfo(null);
  viewer.ready.then(() => { if (initial && byId[initial]) viewer.select(initial); });

  return () => { window.removeEventListener('keydown', onKey); offSettings(); viewer.dispose(); };
}
