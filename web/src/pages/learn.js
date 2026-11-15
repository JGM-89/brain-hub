import { LESSONS } from '../lessons/index.js';
import { getProgress } from './lesson.js';

export function render(main) {
  const progress = getProgress();
  const block = (title, filter, note) => `
    <div class="section-title"><h2>${title}</h2><span class="chip">${note}</span></div>
    <div class="grid">${LESSONS.filter(filter).map((l, i) => `
      <a class="card tile" href="#/lesson/${l.id}">
        <span class="tile-icon" aria-hidden="true">${l.icon}</span>
        <h3>${l.title}</h3>
        <p>${l.blurb}</p>
        <div class="tile-meta"><span class="chip">About ${l.minutes} min</span>${progress[l.id]?.done ? '<span class="chip" style="color:var(--good)">✓ Done</span>' : progress[l.id]?.step ? '<span class="chip">Started</span>' : ''}</div>
      </a>`).join('')}</div>`;
  main.innerHTML = `
  <div class="page">
    <p class="eyebrow">AQA A-level Psychology (7182) · Biopsychology</p>
    <h1>Lessons</h1>
    <p class="lead">Each lesson has the same parts: what you will learn, key words, short steps with a picture, then a few questions. There is no timer.</p>
    ${block('AS and A-level', (l) => l.spec === 'AS + A-level', 'AS Paper 2 · A-level Paper 2')}
    ${block('A-level only', (l) => l.spec === 'A-level', 'A-level Paper 2')}
    <div class="callout" style="margin-top:32px"><h3>Note for teachers</h3><p>Content follows the AQA specification v1.4 (first teaching September 2025). Biological rhythms were removed from Biopsychology in this version, so they are not included.</p></div>
  </div>`;
}
