// Read-aloud with sentence highlighting. One utterance per sentence avoids Chrome's
// ~15 s cut-off and lets us highlight even when a voice gives no word boundaries.
import { get } from './settings.js';

const synth = window.speechSynthesis;
const bar = () => document.getElementById('readbar');
let queue = [], idx = 0, paused = false, active = false;

function pickVoice() {
  const voices = synth?.getVoices() || [];
  const chosen = get('voice');
  if (chosen) { const v = voices.find((x) => x.name === chosen); if (v) return v; }
  const gb = voices.filter((v) => /^en[-_]GB/i.test(v.lang));
  return gb.find((v) => v.localService) || gb.find((v) => /natural/i.test(v.name)) || gb[0] ||
    voices.find((v) => /^en/i.test(v.lang)) || null;
}

function splitSentences(root) {
  // wrap each sentence of each text block in a span so it can be highlighted
  const blocks = root.querySelectorAll('h1,h2,h3,p,li,.speak');
  const spans = [];
  blocks.forEach((block) => {
    if (block.closest('[data-noread]')) return;
    if (block.querySelector('p,li,h1,h2,h3')) return; // leaf blocks only
    const text = block.textContent.trim();
    if (!text) return;
    if (block.children.length) { block.classList.add('sent'); spans.push(block); return; } // keep inline formatting: read as one unit
    if (!block.dataset.split) {
      const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
      block.innerHTML = parts.map((p) => `<span class="sent">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join('');
      block.dataset.split = '1';
    }
    block.querySelectorAll('.sent').forEach((s) => spans.push(s));
  });
  return spans;
}

function clearHL() { document.querySelectorAll('.reading-now').forEach((el) => el.classList.remove('reading-now')); }

function speakNext() {
  clearHL();
  if (idx >= queue.length) { stop(); return; }
  const span = queue[idx];
  span.classList.add('reading-now');
  span.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const u = new SpeechSynthesisUtterance(span.textContent.replace(/\s+/g, ' ').trim());
  const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
  u.rate = Number(get('voiceRate')) || 0.9; u.pitch = 1;
  u.onend = () => { if (!active || paused) return; idx++; speakNext(); };
  u.onerror = () => { if (!active) return; idx++; speakNext(); };
  synth.speak(u);
}

export function canSpeak() { return !!synth; }

export function readElement(root, startEl) {
  if (!synth) { alert('Read aloud is not available in this browser.'); return; }
  synth.cancel();
  queue = splitSentences(root);
  idx = Math.max(0, startEl ? queue.indexOf(startEl) : 0);
  active = true; paused = false;
  bar().hidden = false;
  bar().querySelector('[data-read="toggle"]').textContent = '⏸';
  speakNext();
}

export function readText(text) {
  if (!synth) return;
  synth.cancel(); active = false;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if (v) u.voice = v; u.lang = v?.lang || 'en-GB';
  u.rate = Number(get('voiceRate')) || 0.9;
  synth.speak(u);
}

export function stop() {
  active = false; paused = false; synth?.cancel(); clearHL();
  if (bar()) bar().hidden = true;
}

export function initSpeech() {
  bar().addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.read;
    if (a === 'stop') stop();
    if (a === 'prev') { synth.cancel(); idx = Math.max(0, idx - 1); paused = false; speakNext(); }
    if (a === 'toggle') {
      if (paused) { paused = false; e.target.textContent = '⏸'; e.target.setAttribute('aria-label', 'Pause reading'); speakNext(); }
      else { paused = true; synth.cancel(); e.target.textContent = '▶'; e.target.setAttribute('aria-label', 'Carry on reading'); }
    }
  });
  window.addEventListener('hashchange', stop);
  // click any sentence while reading to jump there
  document.addEventListener('click', (e) => {
    const s = e.target.closest('.sent');
    if (active && s && queue.includes(s)) { synth.cancel(); idx = queue.indexOf(s); speakNext(); }
  });
}

export function readButton(label = 'Read to me') {
  return `<button type="button" class="read-btn" data-read-target><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-speaker"/></svg>${label}</button>`;
}

// wire any [data-read-target] button: reads its closest [data-readable] container
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-read-target]');
  if (!b) return;
  const root = b.closest('[data-readable]') || document.querySelector('[data-readable]');
  if (root) readElement(root);
});
