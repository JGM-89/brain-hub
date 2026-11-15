// Lesson player: the same predictable shell for every lesson.
// Intro (objectives + key words) -> numbered steps (one idea each) -> quiz -> summary.
import { byLessonId, LESSONS } from '../lessons/index.js';
import { get, onChange } from '../settings.js';
import { readButton, stop as stopSpeech } from '../speech.js';

const PROGRESS_KEY = 'bh-progress';
function saveProgress(id, step, done) {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    p[id] = { step, done: done || p[id]?.done || false };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}
export function getProgress() { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; } }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export async function render(main, [id]) {
  const meta = byLessonId[id];
  if (!meta) { location.hash = '#/learn'; return; }
  const lesson = (await meta.load()).default;
  const total = lesson.steps.length + 2; // intro + steps + quiz
  let i = Math.min(getProgress()[id]?.step ?? 0, total - 1);
  if (getProgress()[id]?.done) i = 0;

  main.innerHTML = `
  <div class="lesson">
    <div class="lesson-head">
      <div>
        <p class="eyebrow"><a href="#/learn">Lessons</a> › AQA Biopsychology · ${meta.spec}</p>
        <h1>${lesson.title}</h1>
      </div>
      <div class="progress" aria-live="polite"><span id="step-label"></span><div class="dots" aria-hidden="true">${Array.from({ length: total }, () => '<span></span>').join('')}</div></div>
    </div>
    <div class="lesson-body">
      <div class="lesson-visual ${lesson.visual?.dark ? 'dark' : ''}" id="visual" aria-label="Diagram for this step"></div>
      <div class="lesson-text">
        <article class="card" id="step" data-readable tabindex="-1"></article>
        <nav class="lesson-nav" aria-label="Lesson steps">
          <button type="button" id="back">← Back</button>
          <button type="button" class="btn-primary" id="next">Next step →</button>
        </nav>
      </div>
    </div>
  </div>`;

  const stepEl = main.querySelector('#step');
  const visualEl = main.querySelector('#visual');
  const visual = lesson.visual?.create ? await lesson.visual.create(visualEl, { lesson }) : null;
  const quizState = lesson.quiz.map(() => ({ answered: false, correct: false }));

  const draw = () => {
    stopSpeech();
    const level = get('level');
    const dots = main.querySelectorAll('.dots span');
    dots.forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'now' : ''; });
    main.querySelector('#step-label').textContent = `Step ${i + 1} of ${total}`;
    main.querySelector('#back').disabled = i === 0;
    const next = main.querySelector('#next');
    next.textContent = i === total - 1 ? 'Finish ✓' : i === 0 ? 'Start the lesson →' : i === total - 2 ? 'Check what I know →' : 'Next step →';

    if (i === 0) {
      stepEl.innerHTML = `
        <p class="step-kicker">Before you start · about ${meta.minutes} minutes</p>
        <h2>In this lesson you will</h2>
        <ul class="objectives">${lesson.objectives.map((o) => `<li>${o}</li>`).join('')}</ul>
        <h3 style="margin-top:1.2em">Key words you will meet</h3>
        <dl class="keywords">${lesson.keywords.map((k) => `<div><dt><strong>${k.term}</strong></dt><dd>${level === 'exam' && k.exam ? k.exam : k.simple}</dd></div>`).join('')}</dl>
        <div class="controls-row">${readButton()}</div>`;
    } else if (i <= lesson.steps.length) {
      const s = lesson.steps[i - 1];
      const callout = s.callout ? `<div class="callout ${s.callout.type || ''}"><h3>${s.callout.title}</h3>${s.callout.html}</div>` : '';
      stepEl.innerHTML = `
        <p class="step-kicker">Step ${i} of ${lesson.steps.length}</p>
        <h2>${s.title}</h2>
        ${s.simple}
        ${s.exam ? (level === 'exam' ? `<div class="callout exam"><h3>Exam detail</h3>${s.exam}</div>` : `<button type="button" class="btn-quiet" data-toggle-exam>Show exam detail ▾</button><div class="callout exam" hidden><h3>Exam detail</h3>${s.exam}</div>`) : ''}
        ${callout}
        <div class="controls-row" style="margin-top:12px">${readButton()}</div>`;
    } else {
      stepEl.innerHTML = `
        <p class="step-kicker">Check what you know</p>
        <h2>Quick questions</h2>
        <p>No timer and no score. Try as many times as you like.</p>
        <div class="quiz">${lesson.quiz.map((q, qi) => `
          <fieldset class="quiz-item" data-q="${qi}" style="border:0;padding:0;margin:0 0 18px">
            <legend class="quiz-q">${qi + 1}. ${q.q}</legend>
            <div class="quiz-options">${q.options.map((o, oi) => `<button type="button" data-o="${oi}" class="${quizState[qi].correct && oi === q.answer ? 'correct' : ''}">${o}</button>`).join('')}</div>
            <div class="feedback" role="status" ${quizState[qi].answered ? '' : 'hidden'}>${quizState[qi].correct ? `✓ Yes! ${q.explain}` : ''}</div>
          </fieldset>`).join('')}
        </div>
        ${lesson.summary ? `<div class="callout"><h3>Remember</h3><ul>${lesson.summary.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}`;
    }
    visual?.show?.(i - 1, { level });
    saveProgress(id, i, false);
  };

  stepEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle-exam]');
    if (t) { const box = t.nextElementSibling; box.hidden = !box.hidden; t.textContent = box.hidden ? 'Show exam detail ▾' : 'Hide exam detail ▴'; }
    const opt = e.target.closest('.quiz-options button');
    if (opt) {
      const qi = Number(opt.closest('[data-q]').dataset.q), oi = Number(opt.dataset.o), q = lesson.quiz[qi];
      const fb = opt.closest('[data-q]').querySelector('.feedback');
      quizState[qi].answered = true;
      fb.hidden = false;
      if (oi === q.answer) {
        quizState[qi].correct = true;
        opt.classList.add('correct');
        fb.innerHTML = `✓ Yes! ${q.explain}`;
      } else {
        opt.classList.add('tryagain');
        fb.innerHTML = `Not quite. ${q.hint || 'Have another look and try again.'}`;
      }
    }
  });

  main.querySelector('#back').addEventListener('click', () => { if (i > 0) { i--; draw(); stepEl.focus(); } });
  main.querySelector('#next').addEventListener('click', () => {
    if (i < total - 1) { i++; draw(); stepEl.focus(); window.scrollTo({ top: 0 }); return; }
    saveProgress(id, 0, true);
    const idx = LESSONS.findIndex((l) => l.id === id);
    const nextLesson = LESSONS[idx + 1];
    stepEl.innerHTML = `<h2>Well done! 🎉</h2><p>You have finished <strong>${esc(lesson.title)}</strong>.</p>
      <div class="controls-row">${nextLesson ? `<a class="btn btn-primary" href="#/lesson/${nextLesson.id}">Next lesson: ${nextLesson.title} →</a>` : ''}<a class="btn" href="#/learn">All lessons</a><button type="button" data-restart>Do this lesson again</button></div>`;
    stepEl.querySelector('[data-restart]')?.addEventListener('click', () => { i = 0; draw(); });
  });

  const off = onChange((k) => { if (k === 'level') draw(); });
  draw();
  return () => { off(); visual?.dispose?.(); };
}
