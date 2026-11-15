import { BrainViewer } from '../brain/viewer.js';
import { LESSONS } from '../lessons/index.js';
import { getProgress } from './lesson.js';
import { readButton } from '../speech.js';

export function render(main) {
  const progress = getProgress();
  const resume = LESSONS.find((l) => progress[l.id] && !progress[l.id].done && progress[l.id].step > 0);
  main.innerHTML = `
  <div class="page">
    <section class="hero">
      <div data-readable>
        <p class="eyebrow">A-level Psychology · Biopsychology</p>
        <h1>Explore the brain, one step at a time.</h1>
        <p class="lead">A real 3D brain built from brain-scan data. Short lessons with pictures. Your own brain, seen through your webcam.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/explore">Explore the 3D brain</a>
          <a class="btn" href="#/xray">X-ray me (webcam)</a>
          ${resume ? `<a class="btn" href="#/lesson/${resume.id}">Carry on: ${resume.title}</a>` : `<a class="btn" href="#/learn">Start a lesson</a>`}
        </div>
        <div class="controls-row" style="margin-top:14px">${readButton('Read this page to me')}</div>
      </div>
      <div class="hero-stage" id="hero-stage" aria-label="A real 3D brain, slowly turning"></div>
    </section>

    <div class="section-title"><h2>Lessons</h2><a href="#/learn">See all lessons →</a></div>
    <div class="grid">
      ${LESSONS.map((l) => `
        <a class="card tile" href="#/lesson/${l.id}">
          <span class="tile-icon" aria-hidden="true">${l.icon}</span>
          <h3>${l.title}</h3>
          <p>${l.blurb}</p>
          <div class="tile-meta"><span class="chip spec">${l.spec}</span><span class="chip">About ${l.minutes} min</span>${progress[l.id]?.done ? '<span class="chip" style="color:var(--good)">✓ Done</span>' : ''}</div>
        </a>`).join('')}
    </div>

    <div class="section-title"><h2>Made to be easy to use</h2></div>
    <div class="grid">
      <div class="card"><h3>Your settings</h3><p>Change the font, text size, spacing and background colour, or add a coloured overlay. Press <strong>Settings</strong> at the top.</p></div>
      <div class="card"><h3>Simple or exam words</h3><p>Everything is explained simply first. Switch to <strong>Exam words</strong> for the A-level detail.</p></div>
      <div class="card"><h3>Read to me</h3><p>Press <strong>Read to me</strong> on any page to hear it read out, with each sentence highlighted.</p></div>
      <div class="card"><h3>Real science</h3><p>The 3D brain is built from published brain-scan atlases, not drawn by hand. <a href="#/sources">See where it comes from</a>.</p></div>
    </div>
  </div>
  <footer class="footer">Brain Hub · Made for A-level Psychology (AQA 7182 Biopsychology). Brain models from FreeSurfer, CIT168, HCP1065 and Talairach atlases. <a href="#/sources">Sources and licences</a>.</footer>`;

  const viewer = new BrainViewer(main.querySelector('#hero-stage'), { autoRotate: true, label: 'A real 3D brain, slowly turning. Drag to turn it.' });
  viewer.ready.then(() => viewer.frame('default', true, 430));
  return () => viewer.dispose();
}
