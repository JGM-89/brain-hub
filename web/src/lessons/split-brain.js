// Hemispheric lateralisation and split-brain research — AQA 7182 4.2.2 (A-level only).
// Visual: (1) the real 3D brain with the visual pathway, (2) an interactive re-creation of
// the procedure Sperry used with split-brain patients.
import * as THREE from 'three';
import { BrainViewer } from '../brain/viewer.js';
import { buildVisualPathway } from '../brain/pathway.js';
import { reducedMotion } from '../settings.js';

const ITEMS = [
  { word: 'KEY', icon: '🔑' }, { word: 'CUP', icon: '☕' }, { word: 'BALL', icon: '⚽' }, { word: 'PEN', icon: '🖊️' },
];

const SIM_CSS = `
.sb-sim { position:absolute; inset:0; display:grid; grid-template-rows:auto auto auto; align-content:start; gap:10px; padding:14px; color:var(--stage-ink); overflow:auto; }
.sb-screen { position:relative; background:#F4F4EF; color:#111; border-radius:14px; border:6px solid #2B3550; height:120px; display:grid; place-items:center; overflow:hidden; }
.sb-screen .fix { font-size:34px; font-weight:700; }
.sb-screen .flash { position:absolute; top:50%; transform:translateY(-50%); font-size:30px; font-weight:700; letter-spacing:.06em; }
.sb-screen .flash.l { left:12%; } .sb-screen .flash.r { right:12%; }
.sb-field { position:absolute; top:6px; font-size:13px; font-weight:700; opacity:.65; }
.sb-field.l { left:10px; } .sb-field.r { right:10px; }
.sb-brain { display:grid; grid-template-columns:1fr 34px 1fr; align-items:center; gap:0; max-width:420px; margin:0 auto; width:100%; }
.sb-hemi { border-radius:120px 30px 30px 120px; background:rgb(255 255 255 / 8%); border:2px solid rgb(255 255 255 / 25%); padding:10px 12px; min-height:86px; display:grid; align-content:center; justify-items:center; text-align:center; gap:4px; transition:background .4s, border-color .4s; }
.sb-hemi.right { border-radius:30px 120px 120px 30px; }
.sb-hemi.on-l { background:rgb(58 134 255 / 28%); border-color:#3A86FF; }
.sb-hemi.on-r { background:rgb(255 159 28 / 28%); border-color:#FF9F1C; }
.sb-hemi small { opacity:.8; font-size:13px; }
.sb-cc { height:100%; display:grid; place-items:center; }
.sb-cc span { width:8px; height:70%; border-radius:6px; background:#F4F1DE; }
.sb-cc.cut span { background:repeating-linear-gradient(#F4F1DE 0 8px, transparent 8px 14px); }
.sb-out { display:grid; gap:8px; }
.sb-say { background:rgb(255 255 255 / 10%); border-radius:12px; padding:10px 14px; min-height:48px; font-weight:700; }
.sb-btns { display:flex; flex-wrap:wrap; gap:8px; }
.sb-btns button { background:rgb(255 255 255 / 12%); color:var(--stage-ink); border-color:rgb(255 255 255 / 22%); }
.sb-hand { display:flex; gap:8px; font-size:28px; }
.sb-hand span { padding:6px 10px; border-radius:10px; background:rgb(255 255 255 / 8%); border:2px solid transparent; }
.sb-hand span.pick { border-color:#FF9F1C; background:rgb(255 159 28 / 25%); }
`;

const STEPS = [
  {
    title: 'Two hemispheres, one bridge',
    simple: `<p>Your brain has two halves, called the left and right <span class="keyterm">hemispheres</span>.</p>
      <p>They are joined by the <span class="keyterm">corpus callosum</span>. It is a thick bridge made of about 200 million nerve fibres.</p>
      <p>The corpus callosum lets the two hemispheres share information all the time.</p>`,
  },
  {
    title: 'Hemispheric lateralisation',
    simple: `<p><span class="keyterm">Lateralisation</span> means that some jobs are mainly done by one hemisphere.</p>
      <p>For most people, <strong>language</strong> is mainly in the <strong>left</strong> hemisphere. That is where Broca’s and Wernicke’s areas usually are (lit up on the model).</p>
      <p>The right hemisphere is better at some other jobs, such as recognising faces and working with space and shapes.</p>`,
    exam: `<p>Lateralisation is different from localisation. Localisation = a function is in a particular <strong>area</strong>. Lateralisation = a function is mainly in one <strong>hemisphere</strong>.</p>`,
    callout: { type: 'mistake', title: 'Common mistake', html: '<p>There are no “left-brained” or “right-brained” people. Everyone uses both hemispheres, and they work together.</p>' },
  },
  {
    title: 'Crossed wiring',
    simple: `<p>Many connections in the brain cross over to the other side. This is called <span class="keyterm">contralateral</span> control.</p>
      <p>The <strong>left</strong> motor area moves the <strong>right</strong> side of your body.</p>
      <p>The <strong>right</strong> motor area moves the <strong>left</strong> side.</p>
      <p>Touch works in the same crossed way. So your left hand is controlled by, and feels with, your right hemisphere.</p>`,
  },
  {
    title: 'How what you see reaches your brain',
    simple: `<p>Look at the model from above. The <strong>orange</strong> paths carry things you see on your <strong>left</strong> (the left visual field). They go to the <strong>right</strong> hemisphere.</p>
      <p>The <strong>blue</strong> paths carry your <strong>right</strong> visual field to the <strong>left</strong> hemisphere.</p>
      <p>Both eyes send signals to both hemispheres. Some fibres cross over at the <span class="keyterm">optic chiasm</span>.</p>`,
    exam: `<p>Fibres from the nasal (inner) half of each retina cross at the optic chiasm. Fibres from the temporal (outer) half do not. Signals then travel along the optic tract to the lateral geniculate nucleus of the thalamus, and along the optic radiation to the visual cortex.</p>`,
    callout: { type: 'mistake', title: 'Common mistake', html: '<p>It is not “left eye → right brain”. It is the left <strong>visual field</strong> of <strong>both</strong> eyes → right hemisphere.</p>' },
  },
  {
    title: 'The split-brain operation',
    simple: `<p>In the 1960s, some people with very severe epilepsy had their corpus callosum cut. This was done to stop seizures spreading from one hemisphere to the other.</p>
      <p>The operation is called a <span class="keyterm">commissurotomy</span>. People who have had it are called <strong>split-brain patients</strong>.</p>
      <p>Afterwards, the two hemispheres could no longer share information directly.</p>`,
  },
  {
    title: 'Sperry’s procedure',
    simple: `<p>Roger Sperry (1968) studied 11 split-brain patients.</p>
      <p>The patient looked at a dot in the middle of a screen. A word or picture was flashed to <strong>one side</strong> for about one tenth of a second. That is too fast to move the eyes, so the image reached only one hemisphere.</p>
      <p>Try it on the screen: keep your eyes on the +.</p>`,
    exam: `<p>The patient’s hands could reach under the screen to feel objects they could not see. This let Sperry test the right hemisphere, which usually cannot speak.</p>`,
  },
  {
    title: 'What the patients said',
    simple: `<p>Press <strong>Flash right</strong>. The image goes to the left hemisphere, where language usually is. The patient can <strong>say</strong> what they saw.</p>
      <p>Press <strong>Flash left</strong>. The image goes to the right hemisphere. The patient says they saw <strong>nothing</strong>. The right hemisphere saw it but cannot usually speak, and it cannot pass the message across.</p>`,
  },
  {
    title: 'The left hand knows',
    simple: `<p>After a <strong>left</strong> flash, ask the patient to feel for the object with their <strong>left hand</strong>, behind the screen.</p>
      <p>They pick the right one, even though they said they saw nothing. The left hand is controlled by the right hemisphere, which <strong>did</strong> see it.</p>
      <p>Press <strong>Flash left</strong>, then <strong>Feel with left hand</strong>.</p>`,
    exam: `<p>Composite words: in Sperry’s later demonstrations, “KEY|RING” was flashed with “key” in the left visual field and “ring” in the right. Patients said “ring” but picked out a key with their left hand.</p>`,
  },
  {
    title: 'Evaluating split-brain research',
    simple: `<ul>
        <li><strong>Strength:</strong> very careful methods. Flashing for a tenth of a second meant the image reached only one hemisphere.</li>
        <li><strong>Strength:</strong> it showed that the two hemispheres do different jobs (lateralisation).</li>
        <li><strong>Weakness:</strong> only 11 patients, and they all had epilepsy. Their brains might work differently from other people’s, so the results may not generalise.</li>
        <li><strong>Weakness:</strong> the operations differed between patients, so how fully the hemispheres were disconnected varied.</li>
      </ul>`,
    exam: `<p>Later research suggests the hemispheres are more connected and cooperative than early accounts implied, so the left/right differences may have been overstated.</p>`,
  },
];

export default {
  id: 'split-brain',
  title: 'Lateralisation and split-brain research',
  objectives: [
    'Explain what hemispheric lateralisation means, and how it differs from localisation.',
    'Explain why the left visual field goes to the right hemisphere.',
    'Describe and evaluate Sperry’s split-brain research.',
  ],
  keywords: [
    { term: 'Hemispheric lateralisation', simple: 'Some jobs are done mainly by one half of the brain.', exam: 'The idea that the two halves of the brain are functionally different, and that certain mental processes are mainly controlled by one hemisphere rather than the other.' },
    { term: 'Corpus callosum', simple: 'The thick bridge of nerve fibres that joins the two hemispheres.' },
    { term: 'Visual field', simple: 'Everything you can see. The left visual field is everything to the left of where you are looking.' },
    { term: 'Split-brain patient', simple: 'Someone whose corpus callosum has been cut, often to treat severe epilepsy.' },
    { term: 'Contralateral', simple: 'On the opposite side.' },
  ],
  steps: STEPS,
  quiz: [
    { q: 'An image is flashed to a split-brain patient’s LEFT visual field. What will they most likely say?', options: ['They name the object', 'They say they saw nothing', 'They describe the colour only', 'They say the word backwards'], answer: 1, explain: 'The image reaches the right hemisphere, which usually can’t produce speech, and the message can’t cross the cut corpus callosum.', hint: 'Which hemisphere gets the left visual field? Can it speak?' },
    { q: 'Which hand could pick out the object after a left visual field flash?', options: ['Right hand', 'Left hand', 'Both hands equally', 'Neither hand'], answer: 1, explain: 'The left hand is controlled by the right hemisphere, which saw the image.' },
    { q: 'What does hemispheric lateralisation mean?', options: ['Each area of the brain has a specific job', 'Some functions are mainly in one hemisphere', 'The brain can change after damage', 'The hemispheres are identical'], answer: 1, explain: 'Lateralisation = a function is dominated by one hemisphere (e.g. language in the left).', hint: 'Localisation is about areas. Lateralisation is about…' },
    { q: 'Why was the image flashed for only about 1/10 of a second?', options: ['So the patient would not get bored', 'So there was no time to move the eyes and send it to both hemispheres', 'Because the screen was slow', 'To test memory'], answer: 1, explain: 'If the eyes moved, the image could fall in both visual fields and reach both hemispheres.' },
  ],
  summary: [
    'Language is usually lateralised to the left hemisphere.',
    'Left visual field → right hemisphere; right visual field → left hemisphere (from both eyes).',
    'Sperry (1968): split-brain patients could name right-field images, but only identify left-field images with the left hand. Evaluate: 11 patients with epilepsy, so generalising is hard.',
  ],
  visual: {
    dark: true,
    async create(container) {
      container.insertAdjacentHTML('beforeend', `<style>${SIM_CSS}</style>
        <div class="fill" data-panel="3d"></div>
        <div class="sb-labels" style="position:absolute;inset:0;pointer-events:none"></div>
        <div class="sb-sim" data-panel="sim" hidden>
          <div class="sb-screen" role="img" aria-label="The screen the patient looks at, with a cross in the middle">
            <span class="sb-field l">Left visual field</span><span class="sb-field r">Right visual field</span>
            <span class="fix" aria-hidden="true">+</span><span class="flash l" hidden></span><span class="flash r" hidden></span>
          </div>
          <div class="sb-brain" aria-live="polite">
            <div class="sb-hemi left" data-h="L"><strong>Left hemisphere</strong><small>Can speak</small><span data-saw></span></div>
            <div class="sb-cc cut" title="Corpus callosum (cut)"><span></span></div>
            <div class="sb-hemi right" data-h="R"><strong>Right hemisphere</strong><small>Controls left hand</small><span data-saw></span></div>
          </div>
          <div class="sb-out">
            <div class="sb-say" data-say>Keep your eyes on the + and press a button.</div>
            <div class="sb-btns">
              <button type="button" data-flash="L">Flash left</button>
              <button type="button" data-flash="R">Flash right</button>
              <button type="button" data-feel disabled>Feel with left hand</button>
            </div>
            <div class="sb-hand" data-hand hidden aria-label="Objects behind the screen">${ITEMS.map((it) => `<span data-w="${it.word}">${it.icon}</span>`).join('')}</div>
          </div>
        </div>
        <p class="vis-caption"></p>`);
      const fill = container.querySelector('[data-panel="3d"]');
      const sim = container.querySelector('[data-panel="sim"]');
      const cap = container.querySelector('.vis-caption');
      const labels = container.querySelector('.sb-labels');
      const viewer = new BrainViewer(fill, { label: '3D brain for this step' });
      await viewer.ready;
      const pathway = buildVisualPathway(viewer);
      pathway.setVisible(false);

      // hemisphere labels for the top view
      let showHemiLabels = false;
      viewer.on('frame', () => {
        if (!showHemiLabels) { labels.innerHTML = ''; return; }
        const half = viewer.size.x * 0.4;
        const l = viewer.project(new THREE.Vector3(half, 40, -60)), r = viewer.project(new THREE.Vector3(-half, 40, -60));
        labels.innerHTML = [[l, 'Left hemisphere'], [r, 'Right hemisphere']].map(([p, t]) => p ? `<div class="label3d" style="left:${p.x}px;top:${p.y}px"><span>${t}</span></div>` : '').join('');
      });

      // ---- the experiment
      let last = null, timer = null;
      const flashEls = { L: sim.querySelector('.flash.l'), R: sim.querySelector('.flash.r') };
      const say = sim.querySelector('[data-say]');
      const hemi = { L: sim.querySelector('[data-h="L"]'), R: sim.querySelector('[data-h="R"]') };
      const feelBtn = sim.querySelector('[data-feel]');
      const hand = sim.querySelector('[data-hand]');
      const reset = () => {
        Object.values(flashEls).forEach((e) => { e.hidden = true; });
        hemi.L.className = 'sb-hemi left'; hemi.R.className = 'sb-hemi right';
        hemi.L.querySelector('[data-saw]').textContent = ''; hemi.R.querySelector('[data-saw]').textContent = '';
        hand.hidden = true; hand.querySelectorAll('span').forEach((s) => s.classList.remove('pick'));
      };
      sim.addEventListener('click', (e) => {
        const f = e.target.closest('[data-flash]')?.dataset.flash;
        if (f) {
          reset(); clearTimeout(timer);
          last = { side: f, item: ITEMS[Math.floor(Math.random() * ITEMS.length)] };
          const el = flashEls[f];
          el.textContent = last.item.word; el.hidden = false;
          // shown long enough to read on screen, but the real flash was about 0.1 s
          timer = setTimeout(() => { el.hidden = true; }, reducedMotion() ? 1500 : 450);
          const target = f === 'L' ? 'R' : 'L';   // contralateral
          hemi[target].classList.add(f === 'L' ? 'on-r' : 'on-l');
          hemi[target].querySelector('[data-saw]').textContent = `Saw: ${last.item.word}`;
          if (f === 'R') { say.textContent = `Patient says: “I saw the word ${last.item.word.toLowerCase()}.”`; feelBtn.disabled = true; }
          else { say.textContent = 'Patient says: “I didn’t see anything.”'; feelBtn.disabled = false; }
        }
        if (e.target.closest('[data-feel]') && last?.side === 'L') {
          hand.hidden = false;
          hand.querySelector(`[data-w="${last.item.word}"]`).classList.add('pick');
          say.textContent = `The left hand picks out the ${last.item.word.toLowerCase()} ${last.item.icon}, but the patient still can’t say why.`;
        }
      });

      const show3d = (on) => { fill.hidden = !on; sim.hidden = on; };
      return {
        show(step) {
          showHemiLabels = false;
          pathway.setVisible(false); viewer.setShowPaths(false); viewer.setXray(false); viewer.setMode('lobes'); viewer.setHideHemisphere(null);
          show3d(step < 5 || step >= 8);
          if (step <= 0) { viewer.setHideHemisphere('left'); viewer.select('corpus_callosum', { fly: false }); viewer.frame('left'); cap.textContent = 'Left hemisphere hidden: the corpus callosum joins the two halves'; return; }
          if (step === 1) { viewer.select(null, { fly: false }); viewer.setMode('functions'); viewer.frame('frontHigh'); cap.textContent = 'Language areas: usually in the left hemisphere'; return; }
          if (step === 2) { viewer.select('motor'); cap.textContent = 'Motor areas: each controls the opposite side of the body'; return; }
          if (step === 3) {
            viewer.select(null, { fly: false }); viewer.setXray(true); viewer.setShowPaths(true); pathway.setVisible(true); pathway.setField(null);
            viewer.frame('topFront', false, 420); showHemiLabels = true;
            cap.textContent = 'Seen from above. Orange: left visual field. Blue: right visual field.'; return;
          }
          if (step === 4) { viewer.setHideHemisphere('left'); viewer.select('corpus_callosum', { fly: false }); viewer.frame('left'); cap.textContent = 'In a split-brain operation, this bridge is cut'; return; }
          if (step >= 5 && step <= 7) { reset(); say.textContent = step === 7 ? 'Press Flash left, then Feel with left hand.' : 'Keep your eyes on the + and press a button.'; cap.textContent = ''; return; }
          viewer.select(null, { fly: false }); viewer.setMode('lobes'); viewer.frame('default'); cap.textContent = 'Two hemispheres, working together';
        },
        dispose() { clearTimeout(timer); pathway.dispose(); viewer.dispose(); },
      };
    },
  },
};
