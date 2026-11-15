// Brain structures shown in the 3D explorer.
// `simple` = plain English for everyone. `exam` = A-level detail and key terms.
// `spec` = where this links to the AQA 7182 specification (v1.4, first teaching Sept 2025).
// `nodes` = mesh names inside public/models/brain.glb (built by tools/build_brain.py).

const both = (base) => [`${base}_left`, `${base}_right`];
const cortex = (lobe) => [`cortex_left_${lobe}`, `cortex_right_${lobe}`];

export const SOURCES = {
  fsaverage: 'FreeSurfer fsaverage pial surface, an average of 40 adult brain scans, made with the method of Fischl et al. (1999). Lobes are made from the Destrieux gyrus and sulcus atlas (Destrieux et al., 2010).',
  aseg: 'FreeSurfer fsaverage brain segmentation, made from the same 40 brain scans as the cortex, so everything lines up exactly.',
  cit: 'CIT168 atlas of deep brain structures (Pauli et al., 2018), made from high-resolution MRI scans of 168 adults.',
  hcp: 'HCP1065 fibre-tract atlas (Yeh, 2022), made by tracking water movement along nerve fibres in the brain scans of 1,065 young adults.',
  approx: 'APPROXIMATE position and size. The pituitary hangs under the brain in a small hollow in the skull, so brain-scan atlases leave it out. It is placed where it sits in real people: below the hypothalamus, and just below and slightly behind the optic chiasm.',
  tal: 'Talairach Daemon atlas (Lancaster et al., 2000), digitised from the Talairach & Tournoux (1988) atlas, which is based on one person’s brain, and aligned to the other atlases for this site.',
  func: 'Painted onto the real cortex surface from published atlases: Destrieux labels (motor, somatosensory, auditory, visual, Broca) and the Harvard–Oxford cortical atlas (Wernicke).',
};

export const GROUPS = [
  { id: 'lobes', label: 'The four lobes (and two hidden areas)' },
  { id: 'functions', label: 'Jobs of the cortex (localisation)' },
  { id: 'deep', label: 'Deep inside' },
  { id: 'base', label: 'Back and bottom' },
  { id: 'vision', label: 'Vision pathway' },
];

export const STRUCTURES = [
  // ---------------------------------------------------------------- lobes
  {
    id: 'frontal', group: 'lobes', name: 'Frontal lobe', color: '#3D7FD9', nodes: cortex('frontal'), source: 'fsaverage',
    spec: ['Localisation of function'],
    simple: 'The frontal lobe is at the front of your brain, behind your forehead. It helps you plan, make decisions, control what you do, and move your body.',
    exam: [
      'Contains the <strong>motor area</strong> (primary motor cortex) at its back edge, in front of the central sulcus.',
      'Usually contains <strong>Broca’s area</strong> in the left hemisphere (speech production).',
      'The prefrontal cortex is linked with <strong>executive functions</strong>: planning, decision-making and impulse control.',
      'Phineas Gage (1848): after an iron rod damaged his left frontal lobe, people who knew him reported large changes in his personality.',
    ],
  },
  {
    id: 'parietal', group: 'lobes', name: 'Parietal lobe', color: '#E69F00', nodes: cortex('parietal'), source: 'fsaverage',
    spec: ['Localisation of function'],
    simple: 'The parietal lobe is at the top of your head, towards the back. It makes sense of touch, pain and temperature, and knows where your body parts are.',
    exam: [
      'Contains the <strong>somatosensory area</strong> just behind the central sulcus.',
      'Combines information from the senses, for example to judge space and position.',
    ],
  },
  {
    id: 'temporal', group: 'lobes', name: 'Temporal lobe', color: '#009E73', nodes: cortex('temporal'), source: 'fsaverage',
    spec: ['Localisation of function'],
    simple: 'The temporal lobes are at the sides of your head, near your ears. They help with hearing, understanding language and memory.',
    exam: [
      'Contains the <strong>auditory area</strong> (primary auditory cortex).',
      'Usually contains <strong>Wernicke’s area</strong> in the left hemisphere (language comprehension).',
      'The hippocampus sits on its inner side and is important for forming new long-term memories.',
    ],
  },
  {
    id: 'occipital', group: 'lobes', name: 'Occipital lobe', color: '#CC79A7', nodes: cortex('occipital'), source: 'fsaverage',
    spec: ['Localisation of function'],
    simple: 'The occipital lobe is at the very back of your brain. It is the main area for seeing.',
    exam: [
      'Contains the <strong>visual area</strong> (primary visual cortex), around the calcarine sulcus.',
      'Each hemisphere processes the <strong>opposite half of what you see</strong>: the left visual field goes to the right hemisphere.',
    ],
  },
  {
    id: 'insula', group: 'lobes', name: 'Insula (hidden lobe)', color: '#56B4E9', nodes: cortex('insula'), source: 'fsaverage', beyond: true,
    simple: 'The insula is folded away inside the side of the brain, so you cannot see it from outside. It helps you sense what is happening inside your body, like your heartbeat, and is linked with feelings like disgust.',
    exam: ['Not named in the AQA specification. Linked with taste, awareness of body states (interoception) and emotion.'],
  },
  {
    id: 'cingulate', group: 'lobes', name: 'Cingulate cortex', color: '#B9A100', nodes: cortex('cingulate'), source: 'fsaverage', beyond: true,
    simple: 'The cingulate cortex is a curved strip on the inside of each hemisphere. It wraps around the corpus callosum. It is involved in emotion and attention.',
    exam: ['Often counted as part of the limbic system. Not named in the AQA specification.'],
  },

  // ---------------------------------------------------------------- functional areas (painted on cortex)
  {
    id: 'motor', group: 'functions', name: 'Motor area', color: '#E4572E', region: 1, source: 'func',
    spec: ['Localisation of function'],
    simple: 'The motor area is a strip at the back of the frontal lobe. It sends messages that make your muscles move when you choose to move.',
    exam: [
      'Found in both hemispheres. Controls <strong>voluntary movement</strong>.',
      'Works <strong>contralaterally</strong>: the left motor area controls the right side of the body, and the right controls the left.',
      'Different parts of the strip control different body parts, in order (mapped by Penfield).',
      'Damage can cause loss of control over fine movements on the opposite side of the body.',
    ],
  },
  {
    id: 'somatosensory', group: 'functions', name: 'Somatosensory area', color: '#F2A541', region: 2, source: 'func',
    spec: ['Localisation of function'],
    simple: 'The somatosensory area is a strip at the front of the parietal lobe, just behind the motor area. It feels touch, pressure, pain and temperature from your skin.',
    exam: [
      'Separated from the motor area by the <strong>central sulcus</strong>.',
      'Receives information from the skin on the <strong>opposite side</strong> of the body.',
      'Body parts that are very sensitive, like the face and hands, take up more of the strip.',
    ],
  },
  {
    id: 'visual', group: 'functions', name: 'Visual area', color: '#C04ABC', region: 3, source: 'func',
    spec: ['Localisation of function'],
    simple: 'The visual area is at the very back of the brain. It receives signals from your eyes and begins to work out what you are seeing.',
    exam: [
      'Primary visual cortex, in the <strong>occipital lobe</strong>.',
      'Route: retina → optic nerve → optic chiasm → optic tract → thalamus (lateral geniculate nucleus) → visual cortex.',
      'Each hemisphere receives information from the <strong>opposite visual field</strong>.',
      'Damage to one side can cause loss of vision in the opposite half of the visual field.',
    ],
  },
  {
    id: 'auditory', group: 'functions', name: 'Auditory area', color: '#2A9D8F', region: 4, source: 'func',
    spec: ['Localisation of function'],
    simple: 'The auditory area is in the temporal lobe. It receives signals from your ears and works out sounds, such as how high or loud they are.',
    exam: [
      'Primary auditory cortex, on the upper surface of the <strong>temporal lobe</strong> (Heschl’s gyrus).',
      'Route: cochlea → auditory nerve → brainstem → thalamus → auditory cortex.',
      'Damage can cause partial hearing loss. More widespread damage affects understanding of complex sounds.',
    ],
  },
  {
    id: 'broca', group: 'functions', name: 'Broca’s area', color: '#E63946', region: 5, source: 'func',
    spec: ['Localisation of function', 'Hemispheric lateralisation'],
    simple: 'Broca’s area is in the left frontal lobe for most people. It helps you produce speech: putting words together and saying them.',
    exam: [
      'In the <strong>left frontal lobe</strong> (inferior frontal gyrus) in most people.',
      'Named after Paul Broca, who in 1861 studied a patient nicknamed “Tan”, who could understand speech but could only say the word “tan”.',
      '<strong>Broca’s aphasia</strong>: slow, effortful speech that lacks fluency, while understanding is mostly intact.',
      'Dronkers et al. (2007) re-scanned the preserved brains of Broca’s patients with MRI and found damage spread to other areas too, so language may involve networks, not one spot.',
    ],
  },
  {
    id: 'wernicke', group: 'functions', name: 'Wernicke’s area', color: '#457B9D', region: 6, source: 'func',
    spec: ['Localisation of function', 'Hemispheric lateralisation'],
    simple: 'Wernicke’s area is in the left temporal lobe for most people. It helps you understand language.',
    exam: [
      'In the <strong>left temporal lobe</strong> (back of the superior temporal gyrus) in most people.',
      'Named after Carl Wernicke (1874).',
      '<strong>Wernicke’s aphasia</strong>: speech is fluent but often meaningless, sometimes with made-up words, and understanding is poor.',
      'Linked to Broca’s area by a bundle of nerve fibres called the arcuate fasciculus.',
    ],
  },

  {
    id: 'arcuate', group: 'functions', name: 'Arcuate fasciculus', color: '#FFB703', nodes: both('arcuate'), source: 'hcp', beyond: true,
    spec: ['Localisation of function'],
    simple: 'The arcuate fasciculus is a curved bundle of nerve fibres. In the left hemisphere it links Broca’s area and Wernicke’s area, so understanding and speaking can work together.',
    exam: [
      'A white-matter tract: bundles of myelinated axons connecting areas of cortex.',
      'Damage to it is linked with conduction aphasia: people can understand and speak, but find it hard to repeat what they hear.',
    ],
  },

  // ---------------------------------------------------------------- deep structures
  {
    id: 'corpus_callosum', group: 'deep', name: 'Corpus callosum', color: '#F4F1DE', nodes: ['corpus_callosum'], source: 'aseg',
    spec: ['Hemispheric lateralisation', 'Split-brain research'],
    simple: 'The corpus callosum is a thick bridge of nerve fibres that joins the left and right halves of the brain, so they can share information.',
    exam: [
      'In <strong>split-brain</strong> patients it was cut to treat severe epilepsy.',
      'Sperry (1968) showed each hemisphere could then work separately. Words shown to the right visual field (left hemisphere) could be named. Things shown to the left visual field (right hemisphere) could not be named, but could be picked out by touch with the left hand.',
    ],
  },
  {
    id: 'thalamus', group: 'deep', name: 'Thalamus', color: '#8E7DBE', nodes: both('thalamus'), source: 'aseg',
    simple: 'The thalamus is near the middle of the brain. It works like a relay station: most information from your senses passes through it on the way to the cortex.',
    exam: ['Information from every sense except smell passes through the thalamus.', 'The lateral geniculate nucleus (vision) is part of the thalamus.'],
  },
  {
    id: 'hypothalamus', group: 'deep', name: 'Hypothalamus', color: '#F28482', nodes: ['hypothalamus'], source: 'cit',
    spec: ['Endocrine system', 'Fight or flight'],
    simple: 'The hypothalamus is small and sits below the thalamus. It keeps your body balanced, controlling things like temperature, hunger and thirst. It also controls the pituitary gland and starts the fight-or-flight response.',
    exam: [
      'Links the <strong>nervous system</strong> and the <strong>endocrine system</strong>: it controls the pituitary gland, which hangs just below it.',
      'Fight or flight: when a threat is detected, the hypothalamus activates the <strong>sympathetic nervous system</strong>, which triggers the adrenal medulla to release <strong>adrenaline</strong>.',
      'Linked with hunger and fullness in the Eating behaviour option.',
    ],
  },
  {
    id: 'pituitary', group: 'deep', name: 'Pituitary gland', color: '#E07A5F', nodes: ['pituitary', 'pituitary_stalk'], source: 'approx',
    spec: ['Endocrine system', 'Fight or flight'],
    simple: 'The pituitary gland is about the size of a pea. It hangs below the hypothalamus on a thin stalk. It is called the “master gland” because its hormones control many other glands.',
    exam: [
      'Controlled by the <strong>hypothalamus</strong>, which links the nervous and endocrine systems.',
      'Releases hormones such as ACTH, which travels in the blood to the adrenal cortex and triggers the release of cortisol (the HPA axis, from the Stress option).',
    ],
  },
  {
    id: 'hippocampus', group: 'deep', name: 'Hippocampus', color: '#F6BD60', nodes: both('hippocampus'), source: 'aseg',
    spec: ['Plasticity'],
    simple: 'The hippocampus is a curved shape inside each temporal lobe. It is very important for making new long-term memories and for finding your way around.',
    exam: [
      'Patient HM had the inner part of both temporal lobes removed in 1953, including about half of each hippocampus. Afterwards he could not form new long-term memories of facts and events.',
      'Maguire et al. (2000): London taxi drivers had more grey matter in the back of the hippocampus than control participants, and this was linked to how long they had been driving taxis. This is evidence of <strong>plasticity</strong>.',
    ],
  },
  {
    id: 'amygdala', group: 'deep', name: 'Amygdala', color: '#D62828', nodes: both('amygdala'), source: 'aseg',
    spec: ['Fight or flight', 'Aggression (option)'],
    simple: 'The amygdala is an almond-shaped area deep in each temporal lobe, just in front of the hippocampus. It helps you notice danger and feel emotions like fear.',
    exam: [
      'Part of the <strong>limbic system</strong>. Signals the hypothalamus when a threat is detected.',
      'Linked with aggression in the Aggression option (limbic system explanations).',
    ],
  },
  {
    id: 'basal_ganglia', group: 'deep', name: 'Basal ganglia', color: '#90BE6D', nodes: [...both('caudate'), ...both('putamen'), ...both('pallidum')], source: 'aseg', beyond: true,
    spec: ['OCD (Clinical psychology)'],
    simple: 'The basal ganglia are a group of structures deep inside the brain. They help you start movements, make them smooth, and form habits.',
    exam: [
      'Includes the caudate nucleus, putamen and globus pallidus.',
      'Neural explanations of OCD often describe a loop between the orbitofrontal cortex, the caudate nucleus and the thalamus.',
    ],
  },
  {
    id: 'accumbens', group: 'deep', name: 'Nucleus accumbens', color: '#F9844A', nodes: both('accumbens'), source: 'aseg', beyond: true,
    spec: ['Addiction (option)', 'Schizophrenia (option)'],
    simple: 'The nucleus accumbens is a small area involved in reward. Dopamine released here is linked with wanting things and with learning what is rewarding.',
    exam: ['Part of the brain’s reward pathway. Nicotine increases dopamine release here, which is one explanation for nicotine addiction.'],
  },
  {
    id: 'ventricles', group: 'deep', name: 'Ventricles', color: '#7FC8F8', nodes: [...both('ventricle'), 'ventricle_third', 'ventricle_fourth'], source: 'aseg', beyond: true,
    spec: ['Schizophrenia (option)'],
    simple: 'The ventricles are spaces inside the brain filled with fluid (cerebrospinal fluid). The fluid cushions and protects the brain.',
    exam: ['Enlarged ventricles have been found in some people with schizophrenia, one of its neural correlates.'],
  },

  // ---------------------------------------------------------------- base
  {
    id: 'cerebellum', group: 'base', name: 'Cerebellum', color: '#9C6644', nodes: both('cerebellum'), source: 'aseg',
    simple: 'The cerebellum (“little brain”) is at the back, underneath the occipital lobes. It controls balance and posture and makes your movements smooth and accurate.',
    exam: ['Coordinates movement and balance, and is involved in learning motor skills.', 'Damage can cause clumsy, unsteady movement.'],
  },
  {
    id: 'brainstem', group: 'base', name: 'Brainstem', color: '#B08968', nodes: ['brainstem'], source: 'aseg',
    simple: 'The brainstem connects the brain to the spinal cord. It controls automatic jobs that keep you alive, like breathing, heart rate and swallowing.',
    exam: ['Made of the midbrain, pons and medulla.', 'The medulla helps control heart rate and breathing.'],
  },
  {
    id: 'substantia_nigra', group: 'base', name: 'Substantia nigra', color: '#3A3A3A', nodes: both('substantia_nigra'), source: 'cit', beyond: true,
    simple: 'The substantia nigra is a small dark area in the midbrain. Its cells make dopamine, which helps control movement.',
    exam: ['Loss of dopamine-producing cells here causes the movement symptoms of Parkinson’s disease.'],
  },

  {
    id: 'vta', group: 'base', name: 'Ventral tegmental area', color: '#FB5607', nodes: ['vta'], source: 'cit', beyond: true,
    spec: ['Addiction (option)', 'Schizophrenia (option)'],
    simple: 'The ventral tegmental area (VTA) is a small area in the midbrain. Its cells send dopamine to reward areas like the nucleus accumbens.',
    exam: ['Start of the mesolimbic dopamine pathway (VTA → nucleus accumbens), which is linked with reward, addiction, and the dopamine hypothesis of schizophrenia.'],
  },

  // ---------------------------------------------------------------- vision pathway
  {
    id: 'optic_chiasm', group: 'vision', name: 'Optic chiasm', color: '#FFE08A', nodes: ['optic_chiasm'], source: 'aseg',
    spec: ['Split-brain research'],
    simple: 'The optic chiasm is where the two optic nerves meet, just above the pituitary gland. Here, some fibres from each eye cross over to the other side of the brain.',
    exam: [
      'Fibres from the inner (nasal) half of each retina cross over. Fibres from the outer half stay on the same side.',
      'Result: everything in the <strong>left visual field</strong> goes to the <strong>right hemisphere</strong>, and the right visual field goes to the left hemisphere.',
      'This is why split-brain studies flash images to one side of a fixation point.',
    ],
  },
  {
    id: 'optic_tract', group: 'vision', name: 'Optic tract', color: '#FFD166', nodes: both('optic_tract'), source: 'hcp',
    spec: ['Split-brain research'],
    simple: 'The optic tracts carry signals from your eyes towards the thalamus, after some of the fibres have crossed over at the optic chiasm.',
    exam: ['After the optic chiasm, each optic tract carries information about the <strong>opposite visual field</strong> from both eyes.'],
  },
  {
    id: 'lgn', group: 'vision', name: 'Lateral geniculate nucleus', color: '#06D6A0', nodes: both('lgn'), source: 'tal',
    simple: 'The lateral geniculate nucleus is a small part of the thalamus. It passes signals from your eyes on to the visual cortex.',
    exam: ['Optic tract fibres connect here. From here, the optic radiations carry the signals to the primary visual cortex.'],
  },
  {
    id: 'optic_radiation', group: 'vision', name: 'Optic radiation', color: '#9BF6FF', nodes: both('optic_radiation'), source: 'hcp',
    simple: 'The optic radiations are wide fans of nerve fibres. They carry visual signals from the thalamus to the visual cortex at the back of the brain.',
    exam: ['Run from the lateral geniculate nucleus to the primary visual cortex in the occipital lobe.', 'Damage can cause loss of part of the visual field on the opposite side.'],
  },
];

export const byId = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));
export const REGION_IDS = ['none', 'motor', 'somatosensory', 'visual', 'auditory', 'broca', 'wernicke'];
