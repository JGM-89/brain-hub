// Localisation of function — AQA 7182 4.2.2 (A-level only).
// Visual: the real 3D brain, with each step lighting up one area.
import { BrainViewer } from '../brain/viewer.js';

const STEP_VIEW = [
  { select: null, mode: 'lobes', view: 'default', caption: 'The cortex: the wrinkly outer layer' },
  { select: 'motor', caption: 'Motor area — frontal lobe' },
  { select: 'somatosensory', caption: 'Somatosensory area — parietal lobe' },
  { select: 'visual', caption: 'Visual area — occipital lobe' },
  { select: 'auditory', caption: 'Auditory area — temporal lobe' },
  { select: 'broca', caption: 'Broca’s area — left frontal lobe' },
  { select: 'wernicke', caption: 'Wernicke’s area — left temporal lobe' },
  { select: null, mode: 'functions', view: 'left', caption: 'All six areas together' },
];

export default {
  id: 'localisation',
  title: 'Localisation of function',
  objectives: [
    'Find the motor, somatosensory, visual and auditory areas on a real brain.',
    'Explain what Broca’s and Wernicke’s areas do, and what happens when they are damaged.',
    'Use evidence for and against localisation in an exam answer.',
  ],
  keywords: [
    { term: 'Localisation of function', simple: 'The idea that different parts of the brain do different jobs.', exam: 'The theory that specific areas of the brain are associated with specific physical and psychological functions.' },
    { term: 'Cortex', simple: 'The thin, wrinkly outer layer of the brain.', exam: 'The cerebral cortex: the outer layer of the cerebrum, about 3 mm thick, divided into four lobes in each hemisphere.' },
    { term: 'Hemisphere', simple: 'One half of the brain. There is a left and a right hemisphere.' },
    { term: 'Contralateral', simple: 'On the opposite side. The left side of the brain controls the right side of the body.' },
    { term: 'Aphasia', simple: 'Difficulty using or understanding language, caused by brain damage.' },
  ],
  steps: [
    {
      title: 'Different areas, different jobs',
      simple: `<p>The outer layer of your brain is called the <span class="keyterm">cortex</span>. It is split into two halves, called <strong>hemispheres</strong>.</p>
        <p>Scientists found that some areas of the cortex have particular jobs. This idea is called <span class="keyterm">localisation of function</span>.</p>
        <p>Turn the brain with your mouse or finger. Each hemisphere has four lobes: frontal, parietal, temporal and occipital.</p>`,
      exam: `<p>Before Broca and Wernicke, many scientists thought all parts of the brain worked together in the same way (a <strong>holistic</strong> view). Broca’s and Wernicke’s case studies were key early evidence for localisation.</p>`,
    },
    {
      title: 'The motor area',
      simple: `<p>The <span class="keyterm">motor area</span> is a strip at the back of the <strong>frontal lobe</strong>.</p>
        <p>It sends messages to your muscles when you <strong>choose</strong> to move.</p>
        <p>The left motor area moves the <strong>right</strong> side of your body. The right motor area moves the <strong>left</strong> side.</p>`,
      exam: `<p>The primary motor cortex is in both hemispheres and controls voluntary movement on the opposite (contralateral) side of the body. Different regions control different body parts in a logical order. Damage may cause loss of control over fine movements.</p>`,
    },
    {
      title: 'The somatosensory area',
      simple: `<p>The <span class="keyterm">somatosensory area</span> is just behind the motor area, at the front of the <strong>parietal lobe</strong>.</p>
        <p>It receives feelings from your skin: touch, pressure, pain and temperature.</p>
        <p>Very sensitive parts of your body, like your lips and fingertips, have a bigger share of this strip.</p>`,
      exam: `<p>The motor and somatosensory areas are separated by the <strong>central sulcus</strong>. Like the motor area, it works contralaterally.</p>`,
    },
    {
      title: 'The visual area',
      simple: `<p>The <span class="keyterm">visual area</span> is at the very back of the brain, in the <strong>occipital lobe</strong>.</p>
        <p>Signals travel from the back of your eyes, along the optic nerves, to this area.</p>
        <p>The right visual area deals with things on your <strong>left</strong> side, and the left visual area deals with things on your <strong>right</strong>.</p>`,
      exam: `<p>Each eye sends information from the right visual field to the left visual cortex, and from the left visual field to the right visual cortex. Damage to the left visual cortex can therefore cause loss of the right visual field of <strong>both</strong> eyes.</p>`,
      callout: { type: 'mistake', title: 'Common mistake', html: '<p>It is not “left eye to right brain”. It is the left <strong>visual field</strong> (everything you see to the left of where you are looking) that goes to the right hemisphere, from both eyes.</p>' },
    },
    {
      title: 'The auditory area',
      simple: `<p>The <span class="keyterm">auditory area</span> is in the <strong>temporal lobe</strong>, tucked into the deep groove at the side of the brain.</p>
        <p>It receives signals from your ears and works out sounds, like how high or how loud they are.</p>`,
      exam: `<p>Sound travels from the cochlea along the auditory nerve, through the brainstem and thalamus, to the auditory cortex. Damage may cause partial hearing loss.</p>`,
    },
    {
      title: 'Broca’s area: making speech',
      simple: `<p><span class="keyterm">Broca’s area</span> is in the <strong>left frontal lobe</strong> for most people.</p>
        <p>It helps you <strong>produce</strong> speech.</p>
        <p>In 1861, Paul Broca studied a patient nicknamed “Tan”. He could understand what people said, but the only word he could say was “tan”. After he died, Broca found damage in this area.</p>
        <p>Damage here causes <strong>Broca’s aphasia</strong>: speech is slow and takes a lot of effort, but understanding is mostly fine.</p>`,
      exam: `<p>Broca’s area is in the left inferior frontal gyrus. Broca’s findings came from a <strong>post-mortem</strong> examination. Dronkers et al. (2007) later used MRI on the preserved brains of “Tan” and a second patient of Broca’s. The damage went deeper and wider than Broca’s area alone, suggesting language relies on a network of regions rather than one area.</p>`,
    },
    {
      title: 'Wernicke’s area: understanding language',
      simple: `<p><span class="keyterm">Wernicke’s area</span> is in the <strong>left temporal lobe</strong> for most people.</p>
        <p>It helps you <strong>understand</strong> language.</p>
        <p>People with damage here have <strong>Wernicke’s aphasia</strong>. They speak fluently, but what they say often does not make sense, and they find it hard to understand others.</p>`,
      exam: `<p>Carl Wernicke described this in 1874. Wernicke’s area is linked to Broca’s area by a bundle of nerve fibres called the <strong>arcuate fasciculus</strong>.</p>`,
      callout: { type: 'exam', title: 'Exam tip', html: '<p>A 2-mark question might ask for the difference in function: Broca’s area = <strong>speech production</strong>; Wernicke’s area = <strong>language comprehension</strong>.</p>' },
    },
    {
      title: 'Evaluating localisation',
      simple: `<p>In a 16-mark essay you need to <strong>evaluate</strong>. Here are three points you can use:</p>
        <ul>
          <li><strong>Strength — brain scans.</strong> Petersen et al. (1988) scanned people doing different word tasks. An area near Wernicke’s area was active when they listened to words. Frontal areas near Broca’s area were active when they had to say words. Different tasks used different areas, which supports localisation.</li>
          <li><strong>Strength — case studies.</strong> Patients like Tan and HM show that damage to one area can affect one function.</li>
          <li><strong>Weakness — the brain works as a whole.</strong> Lashley (1950) removed between 10% and 50% of the cortex in rats learning a maze. No area was more important than any other for learning. He suggested learning uses the whole cortex. This idea is called <strong>equipotentiality</strong>.</li>
        </ul>`,
      exam: `<p>Another counterpoint: plasticity. After damage, other areas can sometimes take over a function, which suggests functions are not completely fixed to one place.</p>`,
    },
  ],
  quiz: [
    { q: 'Which lobe contains the motor area?', options: ['Frontal lobe', 'Parietal lobe', 'Occipital lobe', 'Temporal lobe'], answer: 0, explain: 'The motor area is a strip at the back of the frontal lobe.', hint: 'It is just in front of the central sulcus.' },
    { q: 'What does Wernicke’s area mainly do?', options: ['Produces speech', 'Understands language', 'Controls balance', 'Processes touch'], answer: 1, explain: 'Wernicke’s area is linked with language comprehension.', hint: 'Broca = producing speech. The other one is about…' },
    { q: 'A patient’s left visual cortex is damaged. Which part of what they see is affected?', options: ['Everything seen by the left eye', 'The left visual field', 'The right visual field', 'Nothing, the right side takes over'], answer: 2, explain: 'Each visual cortex processes the opposite visual field, from both eyes.', hint: 'Think “contralateral”.' },
    { q: 'Tan (Broca’s patient) could understand speech but could only say one word. What is this called?', options: ['Wernicke’s aphasia', 'Broca’s aphasia', 'Amnesia', 'Equipotentiality'], answer: 1, explain: 'Broca’s aphasia: slow, effortful speech production with comprehension mostly intact.' },
  ],
  summary: [
    'Motor = frontal. Somatosensory = parietal. Visual = occipital. Auditory = temporal.',
    'Broca’s area (left frontal) = producing speech. Wernicke’s area (left temporal) = understanding language.',
    'Evidence for: brain scans and case studies. Evidence against: Lashley’s equipotentiality and plasticity.',
  ],
  visual: {
    dark: true,
    async create(container) {
      const fill = document.createElement('div'); fill.className = 'fill'; container.append(fill);
      const cap = document.createElement('p'); cap.className = 'vis-caption'; container.append(cap);
      const viewer = new BrainViewer(fill, { label: '3D brain showing the area for this step' });
      await viewer.ready;
      return {
        show(step) {
          const s = STEP_VIEW[Math.max(0, Math.min(step, STEP_VIEW.length - 1))];
          if (step < 0) { viewer.select(null, { fly: false }); viewer.setMode('lobes'); viewer.frame('default'); cap.textContent = 'Turn me with your mouse or finger'; return; }
          viewer.setMode(s.select ? 'functions' : s.mode);
          viewer.select(s.select);
          if (!s.select) viewer.frame(s.view);
          cap.textContent = s.caption;
        },
        dispose() { viewer.dispose(); },
      };
    },
  },
};
