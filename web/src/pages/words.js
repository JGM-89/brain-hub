// Key words: gathered from every lesson's keyword list, plus every brain structure.
import { LESSONS } from '../lessons/index.js';
import { STRUCTURES } from '../data/structures.js';
import { get } from '../settings.js';
import { readText } from '../speech.js';

const strip = (h) => h.replace(/<[^>]+>/g, '');

export async function render(main) {
  main.innerHTML = '<div class="page"><p>Loading key words…</p></div>';
  const lessons = await Promise.all(LESSONS.map(async (l) => ({ meta: l, lesson: (await l.load()).default })));
  const map = new Map();
  for (const { meta, lesson } of lessons) {
    for (const k of lesson.keywords || []) {
      const key = k.term.toLowerCase();
      if (!map.has(key)) map.set(key, { term: k.term, simple: k.simple, exam: k.exam, from: [] });
      map.get(key).from.push({ id: meta.id, title: meta.title });
    }
  }
  for (const s of STRUCTURES) {
    const key = s.name.toLowerCase();
    if (!map.has(key)) map.set(key, { term: s.name, simple: s.simple, exam: strip(s.exam?.[0] || ''), from: [], explore: s.id });
  }
  const all = [...map.values()].sort((a, b) => a.term.localeCompare(b.term));

  main.innerHTML = `
  <div class="page">
    <h1>Key words</h1>
    <p class="lead">Every key word from the lessons and the 3D brain, in one place.</p>
    <label for="q" class="sr-only">Search key words</label>
    <input id="q" class="search" type="search" placeholder="Search, for example “synapse”" autocomplete="off" />
    <p id="count" class="source-note" style="border:0"></p>
    <div class="glossary" id="list"></div>
  </div>`;
  const list = main.querySelector('#list');
  const draw = (q = '') => {
    const exam = get('level') === 'exam';
    const items = all.filter((w) => !q || w.term.toLowerCase().includes(q) || strip(w.simple).toLowerCase().includes(q));
    main.querySelector('#count').textContent = `${items.length} words`;
    list.innerHTML = items.map((w, i) => `
      <article class="card">
        <h3>${w.term}</h3>
        <p>${exam && w.exam ? w.exam : w.simple}</p>
        <div class="controls-row">
          <button type="button" data-say="${i}" aria-label="Read ${w.term} aloud">🔊 Hear it</button>
          ${w.explore ? `<a class="btn" href="#/explore/${w.explore}">See it in 3D</a>` : ''}
          ${w.from.map((f) => `<a class="btn" href="#/lesson/${f.id}">${f.title}</a>`).join('')}
        </div>
      </article>`).join('');
    list.onclick = (e) => {
      const b = e.target.closest('[data-say]');
      if (b) { const w = items[Number(b.dataset.say)]; readText(`${w.term}. ${strip(exam && w.exam ? w.exam : w.simple)}`); }
    };
  };
  main.querySelector('#q').addEventListener('input', (e) => draw(e.target.value.trim().toLowerCase()));
  draw();
}
