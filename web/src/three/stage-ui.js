// Shared HTML overlay pieces for the big 3D lesson stage:
//   - labels anchored to 3D points, with leader lines (solid backing, >= 15px text)
//   - canvas charts that redraw at the real pixel size (so text is always >= 15px)
//   - a control bar of real <button>s (>= 44px)
// CSS is scoped under .bx3 (injected once).
const CSS = `
.bx3 { position:absolute; inset:0; container-type:size; overflow:hidden; }
.bx3 .bx3-gl, .bx3 .bx3-gl2 { position:absolute; inset:0; }
.bx3 .bx3-gl canvas, .bx3 .bx3-gl2 canvas { display:block; width:100% !important; height:100% !important; }
.bx3 .bx3-gl2[hidden], .bx3 .bx3-gl[hidden] { display:none; }
.bx3 .bx3-gl.bx3-inset { inset: 76px 16px auto auto; width: min(34%, 300px); height: min(34%, 240px); border-radius: 18px; overflow:hidden; box-shadow: 0 0 0 2px rgb(255 255 255 / 22%), 0 14px 40px rgb(0 0 0 / 45%); z-index:3; }
.bx3 .bx3-lead { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4; overflow:visible; }
.bx3 .bx3-labels { position:absolute; inset:0; pointer-events:none; z-index:5; }
.bx3 .bx3-lab { position:absolute; left:0; top:0; max-width:min(260px, 46cqw); background:rgb(9 14 28 / 92%); color:#F2F5FB; border:2px solid var(--bxc, rgb(255 255 255 / 35%)); border-radius:12px; padding:5px 11px; font-size:max(15px, .95rem); font-weight:700; line-height:1.25; box-shadow:0 6px 18px rgb(0 0 0 / 35%); white-space:normal; transition: opacity .35s ease; }
.bx3 .bx3-lab small { display:block; font-weight:400; font-size:max(15px, .85rem); color:#C9D2E6; }
.bx3 .bx3-chip { position:absolute; left:0; top:0; background:rgb(9 14 28 / 90%); color:#fff; border:1.5px solid var(--bxc, rgb(255 255 255 / 40%)); border-radius:8px; padding:1px 6px; font-size:15px; font-weight:700; line-height:1.3; pointer-events:none; z-index:5; }
.bx3 .bx3-panel { position:absolute; z-index:6; background:rgb(8 13 27 / 84%); border:1px solid rgb(255 255 255 / 14%); border-radius:18px; box-shadow:0 18px 50px rgb(0 0 0 / 40%); backdrop-filter: blur(10px); color:#ECEFF7; padding:12px 14px; display:flex; flex-direction:column; gap:6px; transition: opacity .35s ease; }
.bx3 .bx3-panel[hidden] { display:none; }
.bx3 .bx3-panel h3 { margin:0; font-size:max(16px, 1rem); line-height:1.25; }
.bx3 .bx3-panel p { margin:0; font-size:max(15px, .9rem); color:#C9D2E6; }
.bx3 .bx3-panel .bx3-tag { font-size:15px; color:#C9D2E6; font-weight:400; }
.bx3 .bx3-panel canvas { display:block; width:100%; flex:1 1 auto; min-height:0; }
.bx3 .bx3-panel.side { top:72px; right:14px; bottom:74px; width:min(44%, 520px); }
.bx3 .bx3-panel.side.wide { width:min(54%, 660px); }
.bx3 .bx3-panel.bottom { left:14px; right:14px; bottom:74px; height:min(38%, 300px); }
.bx3 .bx3-panel.over { left:14px; right:14px; top:72px; bottom:74px; }
.bx3 .bx3-panel.card { top:72px; left:14px; width:min(42%, 360px); }
.bx3 .bx3-panel.card.right { left:auto; right:14px; }
.bx3 .vis-controls { z-index:7; align-items:center; }
.bx3 .vis-controls .bx3-ctl-label { font-weight:700; color:var(--stage-ink); }
.bx3 .vis-controls input[type=range] { width:min(260px, 60cqw); height:44px; accent-color:#FFC965; }
.bx3 .vis-caption { z-index:7; background:rgb(8 13 27 / 72%); border-radius:12px; padding:6px 12px; margin:0; max-width:none; }
.bx3 .plx3-status { position:absolute; z-index:6; left:14px; top:68px; margin:0; background:rgb(8 13 27 / 80%); border-radius:10px; padding:4px 10px; font-weight:700; font-size:max(15px,.9rem); color:#ECEFF7; }
.bx3 .plx3-status:empty { display:none; }
.bx3 .bx3-tag-illus { position:absolute; z-index:6; right:16px; bottom:76px; background:rgb(8 13 27 / 85%); border:1px dashed rgb(255 255 255 / 40%); border-radius:10px; padding:3px 10px; font-size:15px; color:#E6EAF5; }
@container (max-width: 700px) {
  .bx3 .bx3-panel.side, .bx3 .bx3-panel.side.wide { left:10px; right:10px; top:auto; bottom:70px; width:auto; height:46%; }
  .bx3 .bx3-panel.side.wide { width:min(54%, 660px); }
.bx3 .bx3-panel.bottom { left:10px; right:10px; height:44%; }
  .bx3 .bx3-panel.over { left:8px; right:8px; }
  .bx3 .bx3-panel.card { left:10px; right:10px; width:auto; top:auto; bottom:70px; }
  .bx3 .bx3-gl.bx3-inset { width: 40%; height: 28%; inset: 70px 10px auto auto; }
  .bx3 .bx3-lab { max-width: 52cqw; padding:4px 8px; }
}
@container (max-height: 520px) {
  .bx3 .bx3-panel.side, .bx3 .bx3-panel.over { top:64px; bottom:64px; }
}
:root[data-calm="true"] .bx3 * { transition:none !important; }
`;
let cssDone = false;
export function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style'); s.id = 'bx3-css'; s.textContent = CSS; document.head.append(s);
}

/** The stage skeleton: gl layers, leader-line svg, label layer, controls and caption. */
export function createStage(container, extraClass = '') {
  injectCSS();
  const root = document.createElement('div');
  root.className = `bx3 ${extraClass}`;
  root.innerHTML = `<div class="bx3-gl"></div><div class="bx3-gl2" hidden></div>
    <svg class="bx3-lead" aria-hidden="true"></svg><div class="bx3-labels" aria-hidden="true"></div>
    <div class="vis-controls" role="group" aria-label="Diagram buttons"></div>
    <p class="vis-caption" aria-live="polite"></p>`;
  container.append(root);
  const q = (s) => root.querySelector(s);
  return { root, gl: q('.bx3-gl'), gl2: q('.bx3-gl2'), lead: q('.bx3-lead'), labels: q('.bx3-labels'), ctrl: q('.vis-controls'), cap: q('.vis-caption') };
}

/** The part of the stage not covered by a visible side/bottom panel (for centring the 3D subject). */
export function freeRectFor(stage) {
  return () => {
    const root = stage.root, W = root.clientWidth, H = root.clientHeight;
    const p = root.querySelector('.bx3-panel:not([hidden])');
    const top = 64, bottom = 64;
    const card = p && p.classList.contains('card');
    if (!p || !(p.classList.contains('side') || p.classList.contains('bottom') || card)) return { x: 0, y: top, w: W, h: H - top - bottom };
    const r = p.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const px = r.left - rr.left, py = r.top - rr.top;
    if ((p.classList.contains('side') || card) && px > W * 0.3) return { x: 0, y: top, w: px - 8, h: H - top - bottom };
    return { x: 0, y: top, w: W, h: Math.max(80, py - top - 6) };
  };
}

/** Replace the control bar. defs: [{label, onClick, key?, pressed?, range?:{min,max,step,value,onInput,label}}] */
export function setControls(ctrl, defs, label = '') {
  const kids = [];
  if (label) { const s = document.createElement('span'); s.className = 'bx3-ctl-label'; s.textContent = label; kids.push(s); }
  for (const d of defs) {
    if (d.range) {
      const id = `bx3r-${Math.random().toString(36).slice(2, 8)}`;
      const l = document.createElement('label'); l.htmlFor = id; l.className = 'bx3-ctl-label'; l.textContent = d.range.label;
      const r = document.createElement('input');
      Object.assign(r, { type: 'range', id, min: d.range.min, max: d.range.max, step: d.range.step, value: d.range.value });
      r.addEventListener('input', () => d.range.onInput(Number(r.value)));
      kids.push(l, r);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = d.label;
    if (d.pressed !== undefined) b.setAttribute('aria-pressed', String(d.pressed));
    if (d.key) b.dataset.key = d.key;
    b.addEventListener('click', d.onClick);
    kids.push(b);
  }
  ctrl.replaceChildren(...kids);
}
export const pressOnly = (ctrl, key) => ctrl.querySelectorAll('button[data-key]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)));

/**
 * Labels with leader lines. Each label: { id, html, color, anchor: () => world Vector3 | null,
 *   dx, dy (px offset of the box from the anchor, scaled for small stages), facing?: () => bool }
 */
export function createLabels(stage, project, bounds = null) {
  const els = new Map();
  let list = [];
  const svgNS = 'http://www.w3.org/2000/svg';
  return {
    set(next) {
      list = next;
      const keep = new Set(next.map((l) => l.id));
      for (const [id, e] of els) if (!keep.has(id)) { e.box.remove(); e.line.remove(); e.dot.remove(); els.delete(id); }
      for (const l of next) {
        let e = els.get(l.id);
        if (!e) {
          const box = document.createElement('div'); box.className = 'bx3-lab';
          const line = document.createElementNS(svgNS, 'line'); line.setAttribute('stroke-width', '2');
          const dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('r', '4');
          stage.labels.append(box); stage.lead.append(line, dot);
          e = { box, line, dot }; els.set(l.id, e);
        }
        e.box.innerHTML = l.html;
        const c = l.color || '#ffffff';
        e.box.style.setProperty('--bxc', c);
        e.line.setAttribute('stroke', c); e.dot.setAttribute('fill', c);
      }
    },
    clear() { this.set([]); },
    update() {
      const W = stage.root.clientWidth, H = stage.root.clientHeight;
      const k = Math.max(0.5, Math.min(1, Math.min(W, H) / 720));
      for (const l of list) {
        const e = els.get(l.id);
        const a = l.anchor?.();
        const p = a ? project(a) : null;
        const vis = p && (!l.facing || l.facing()) && l.show !== false;
        e.box.style.opacity = vis ? '1' : '0';
        e.line.style.display = e.dot.style.display = vis ? '' : 'none';
        if (!vis) continue;
        const bw = e.box.offsetWidth, bh = e.box.offsetHeight;
        let cx = p.x + (l.dx || 0) * k, cy = p.y + (l.dy || 0) * k;
        const b = bounds?.() || { x: 0, y: 58, w: W, h: H - 128 };
        cx = Math.max(b.x + bw / 2 + 8, Math.min(b.x + b.w - bw / 2 - 8, cx));
        cy = Math.max(b.y + bh / 2 + 8, Math.min(b.y + b.h - bh / 2, cy));
        e.box.style.transform = `translate(${(cx - bw / 2).toFixed(1)}px, ${(cy - bh / 2).toFixed(1)}px)`;
        // leader from the nearest box edge to the anchor
        const ex = Math.max(cx - bw / 2, Math.min(cx + bw / 2, p.x)), ey = Math.max(cy - bh / 2, Math.min(cy + bh / 2, p.y));
        e.line.setAttribute('x1', ex); e.line.setAttribute('y1', ey); e.line.setAttribute('x2', p.x); e.line.setAttribute('y2', p.y);
        e.dot.setAttribute('cx', p.x); e.dot.setAttribute('cy', p.y);
      }
    },
    dispose() { this.set([]); },
  };
}

/** Small name chips that sit directly on 3D points (e.g. electrode names). */
export function createChips(stage, project) {
  let items = [];
  return {
    set(next) {
      items.forEach((i) => i.el.remove());
      items = next.map((n) => {
        const el = document.createElement('span'); el.className = 'bx3-chip'; el.textContent = n.text;
        if (n.color) el.style.setProperty('--bxc', n.color);
        stage.labels.append(el);
        return { ...n, el };
      });
    },
    update() {
      for (const i of items) {
        const p = i.anchor ? project(i.anchor()) : null;
        const vis = p && (!i.facing || i.facing());
        i.el.style.display = vis ? '' : 'none';
        if (vis) i.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, ${i.below ? '45%' : i.centre ? '-50%' : '-145%'})`;
      }
    },
    dispose() { this.set([]); },
  };
}

/** A panel with a title and a canvas chart that redraws at real pixel size. */
export function createPanel(stage, cls = 'side') {
  const el = document.createElement('div');
  el.className = `bx3-panel ${cls}`; el.hidden = true;
  el.innerHTML = '<h3></h3><p class="bx3-sub"></p><canvas role="img"></canvas>';
  stage.root.append(el);
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let draw = null;
  const font = () => getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif';
  const redraw = () => {
    if (el.hidden || !draw) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(makeG(ctx, w, h, font()));
  };
  const ro = new ResizeObserver(redraw); ro.observe(canvas);
  return {
    el,
    show(opts) {
      el.className = `bx3-panel ${opts.cls || cls}`;
      el.querySelector('h3').textContent = opts.title || '';
      const sub = el.querySelector('.bx3-sub'); sub.innerHTML = opts.sub || ''; sub.hidden = !opts.sub;
      canvas.hidden = !opts.draw;
      canvas.setAttribute('aria-label', opts.aria || opts.title || '');
      draw = opts.draw || null;
      el.hidden = false;
      requestAnimationFrame(redraw);
    },
    hide() { el.hidden = true; draw = null; },
    redraw,
    dispose() { ro.disconnect(); el.remove(); },
  };
}

// Drawing helpers in CSS pixels.
function makeG(ctx, w, h, fontFamily) {
  const g = {
    ctx, w, h,
    font(size = 15, weight = 400) { ctx.font = `${weight} ${Math.max(15, size)}px ${fontFamily}`; },
    text(x, y, str, o = {}) {
      g.font(o.size || 15, o.weight || 400);
      ctx.fillStyle = o.color || '#ECEFF7'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
      if (o.rotate) { ctx.save(); ctx.translate(x, y); ctx.rotate(o.rotate); ctx.fillText(str, 0, 0); ctx.restore(); } else ctx.fillText(str, x, y);
      return ctx.measureText(str).width;
    },
    measure(str, size = 15, weight = 400) { g.font(size, weight); return ctx.measureText(str).width; },
    pill(x, y, lines, o = {}) {
      lines = Array.isArray(lines) ? lines : [lines];
      const size = Math.max(15, o.size || 15);
      g.font(size, 700);
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const lh = size * 1.25, bw = tw + 20, bh = lines.length * lh + 10;
      let bx = x - (o.align === 'left' ? 0 : o.align === 'right' ? bw : bw / 2), by = y - bh / 2;
      bx = Math.max(2, Math.min(w - bw - 2, bx)); by = Math.max(2, Math.min(h - bh - 2, by));
      if (o.to) { g.line([[bx + bw / 2, by + bh / 2], o.to], o.color || '#AEB8D2', 1.6); ctx.fillStyle = o.color || '#AEB8D2'; ctx.beginPath(); ctx.arc(o.to[0], o.to[1], 3.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(9,14,28,.94)'; ctx.strokeStyle = o.border || o.color || 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.6;
      g.round(bx, by, bw, bh, 9); ctx.fill(); ctx.stroke();
      lines.forEach((l, i) => g.text(bx + 10, by + 5 + lh * (i + 0.5), l, { size, weight: 700, color: o.color || '#ECEFF7' }));
      return { x: bx, y: by, w: bw, h: bh };
    },
    round(x, y, rw, rh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + rw, y, x + rw, y + rh, r); ctx.arcTo(x + rw, y + rh, x, y + rh, r); ctx.arcTo(x, y + rh, x, y, r); ctx.arcTo(x, y, x + rw, y, r); ctx.closePath(); },
    line(pts, color = '#AEB8D2', width = 1.5, dash = null) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    },
    glowLine(pts, color, width = 3) {
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = document.documentElement.dataset.calm === 'true' ? 0 : 10; g.line(pts, color, width); ctx.restore();
    },
    dot(x, y, r, color, glow = false) { ctx.save(); if (glow && document.documentElement.dataset.calm !== 'true') { ctx.shadowColor = color; ctx.shadowBlur = 14; } ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); },
    rect(x, y, rw, rh, color, r = 6) { ctx.fillStyle = color; g.round(x, y, rw, rh, r); ctx.fill(); },
  };
  return g;
}

/** requestAnimationFrame tween; with reduced motion jumps to the end. Returns a cancel function. */
export function tween(dur, fn, done, reduced) {
  if (reduced) { fn(1); done?.(); return () => {}; }
  let raf = 0; const t0 = performance.now();
  const frame = (now) => { const p = Math.min(1, (now - t0) / dur); fn(p); if (p < 1) raf = requestAnimationFrame(frame); else done?.(); };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
