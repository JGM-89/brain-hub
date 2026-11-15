// Lesson registry. Order follows the AQA 7182 Biopsychology section (v1.4).
// Each lesson module default-exports a lesson object — see README-lessons.md for the contract.
export const LESSONS = [
  { id: 'nervous-system', title: 'The nervous system', icon: '🌳', minutes: 8, spec: 'AS + A-level', blurb: 'How the brain, spinal cord and nerves are organised, and what the autonomic system does.', load: () => import('./nervous-system.js') },
  { id: 'neurons', title: 'Neurons', icon: '⚡', minutes: 10, spec: 'AS + A-level', blurb: 'The three types of neuron, their parts, and how a signal travels along one.', load: () => import('./neurons.js') },
  { id: 'synapse', title: 'Synaptic transmission', icon: '🧪', minutes: 10, spec: 'AS + A-level', blurb: 'Step by step: how one neuron passes a message to the next, including excitation and inhibition.', load: () => import('./synapse.js') },
  { id: 'endocrine', title: 'The endocrine system', icon: '🫀', minutes: 8, spec: 'AS + A-level', blurb: 'Glands, hormones and the pituitary “master gland”.', load: () => import('./endocrine.js') },
  { id: 'fight-or-flight', title: 'Fight or flight', icon: '🐻', minutes: 8, spec: 'AS + A-level', blurb: 'What happens in your body when you meet a threat, and the role of adrenaline.', load: () => import('./fight-or-flight.js') },
  { id: 'localisation', title: 'Localisation of function', icon: '🗺️', minutes: 12, spec: 'A-level', blurb: 'Which parts of the cortex do which jobs, on a real 3D brain.', load: () => import('./localisation.js') },
  { id: 'split-brain', title: 'Lateralisation and split-brain research', icon: '👁️', minutes: 12, spec: 'A-level', blurb: 'Why the left visual field goes to the right hemisphere, and Sperry’s famous experiment.', load: () => import('./split-brain.js') },
  { id: 'plasticity', title: 'Plasticity and functional recovery', icon: '🌱', minutes: 10, spec: 'A-level', blurb: 'How the brain changes with experience and recovers after damage.', load: () => import('./plasticity.js') },
  { id: 'studying-the-brain', title: 'Ways of studying the brain', icon: '🔬', minutes: 12, spec: 'A-level', blurb: 'fMRI, EEG, ERPs and post-mortems: what each one shows, and their strengths and weaknesses.', load: () => import('./studying-the-brain.js') },
];

export const byLessonId = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
