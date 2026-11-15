# Curriculum and design notes (research summary, 15 Nov 2026)

## AQA spec (7181/7182, v1.4, first teaching Sept 2025)

AQA spec PDF: https://cdn.sanity.io/files/p28bar15/green/661250c1cb8bd3586f93ddb48c89a3218a3913ca.pdf

**Biological rhythms are removed** from Biopsychology in v1.4. Don't teach them as AQA content.

### AS and A-level (verbatim)
1. "The divisions of the nervous system: central and peripheral (somatic and autonomic)."
2. "The structure and function of sensory, relay and motor neurons. The process of synaptic transmission, including reference to neurotransmitters, excitation and inhibition."
3. "The function of the endocrine system: glands and hormones."
4. "The fight or flight response including the role of adrenaline."

### A-level only (verbatim)
5. "Ways of studying the brain: scanning techniques, including functional magnetic resonance imaging (fMRI); electroencephalogram (EEGs) and event-related potentials (ERPs); post-mortem examinations."
6. "Localisation of function in the brain and hemispheric lateralisation: motor, somatosensory, visual, auditory and language centres; Broca's and Wernicke's areas, split brain research. Plasticity and functional recovery of the brain after trauma."

**No studies are named in the Biopsychology bullets.** Every study is "commonly taught".

## Terminology (AQA mark-scheme style)

### Nervous system
- **CNS** = brain and spinal cord.
- **PNS** = carries messages to and from the CNS. It has two parts:
  - **Somatic:** senses → CNS, and CNS → skeletal muscles; reflexes.
  - **Autonomic:** involuntary; controls internal organs. It splits into:
    - **sympathetic:** arousal, fight or flight;
    - **parasympathetic:** rest and digest.

### Neuron structure
- **Cell body (soma)** with the nucleus.
- **Dendrites:** receive signals from other neurons and carry them towards the cell body.
- **Axon:** carries the impulse away from the cell body.
- **Myelin sheath:** speeds up transmission. The impulse jumps between the **nodes of Ranvier** (saltatory conduction).
- **Terminal buttons:** at the end of the axon; communicate with the next neuron across the synapse.

### Neuron types
| Type | Job | Shape |
|---|---|---|
| Sensory | receptors → CNS | long dendrites, short axons |
| Relay | connects sensory to motor within the CNS | short dendrites, short axons |
| Motor | CNS → effectors (muscles/glands) | short dendrites, long axons |

### Synaptic transmission
1. The action potential (an electrical impulse) reaches the presynaptic terminal.
2. Synaptic vesicles release neurotransmitter by exocytosis.
3. The neurotransmitter diffuses across the synaptic cleft.
4. It binds to receptors on the postsynaptic membrane.

Further points:
- Transmission is **chemical** across the gap and **electrical** within the neuron. It goes in **one direction only**.
- **Excitation:** makes the postsynaptic neuron more likely to fire.
- **Inhibition:** makes it less likely to fire.
- **Summation:** excitatory and inhibitory inputs add up, and the neuron fires only if the net effect reaches the threshold.
- **Reuptake** is GCSE wording, but it is fine to include.

### Endocrine system
- Glands release **hormones** into the **bloodstream**. Hormones are slower and longer-lasting than neurotransmitters.
- **Pituitary** = the "master gland": it controls the release of hormones from other glands. It is controlled by the hypothalamus.
- **Thyroid** → thyroxine (metabolism).
- **Adrenal** → adrenaline (medulla) and cortisol (cortex).
- **Testes** → testosterone. **Ovaries** → oestrogen. **Pancreas** → insulin.
- Only **adrenaline** is named in Biopsychology.

### Fight or flight
1. The amygdala detects a threat and signals the hypothalamus.
2. The hypothalamus activates the **SNS**.
3. The SNS stimulates the **adrenal medulla**.
4. The adrenal medulla releases **adrenaline** (and noradrenaline) into the bloodstream.

Effects: increased heart rate and breathing rate, pupils dilate, sweating, glucose released into the blood, digestion and saliva inhibited.

When the threat passes, the **parasympathetic NS** returns the body to rest.

"SAM pathway" is a Stress-option term; it is fine to mention.

### Ways of studying the brain
| Method | What it does | Resolution |
|---|---|---|
| fMRI | detects changes in blood oxygenation and flow linked to neural activity | good spatial (about 1–2 mm), poor temporal (the signal lags about 5 s behind neural activity) |
| EEG | scalp electrodes record overall electrical activity | excellent temporal (ms), poor spatial |
| ERP | EEG activity time-locked to a stimulus, averaged over many trials so background noise cancels out | — |
| Post-mortem | brain examined after death; structural abnormalities correlated with behaviour recorded in life | — |

ERP components: early ones are "sensory" (under about 100 ms); later ones are "cognitive", e.g. P300.

### Plasticity and functional recovery
- **Plasticity:** the brain changes structure and function with experience and learning, throughout life (including synaptic pruning).
- **Functional recovery** mechanisms:
  - neuronal unmasking (dormant synapses become active);
  - axonal sprouting;
  - reformation of blood vessels;
  - denervation super-sensitivity;
  - recruitment of homologous areas on the opposite hemisphere.
- Commonly taught studies:
  - Maguire et al. (2000), London taxi drivers: more posterior hippocampal grey matter;
  - Kühn et al. (2014), video games;
  - Davidson et al. (2004) (published as Lutz et al., 2004), monks and gamma waves;
  - Schneider et al. (2014), cognitive reserve: more education → more likely disability-free recovery after traumatic brain injury.

### Split brain
Sperry (1968) studied 11 split-brain patients who had had a commissurotomy (corpus callosum cut) to treat severe epilepsy. An image was flashed to one visual field (about 0.1 s), with the eye fixed on a central point.
- **Right visual field → left hemisphere:** the patient could say what they saw.
- **Left visual field → right hemisphere:** the patient could not name it ("nothing there"), but could select the matching object by touch with the **left hand** (behind a screen).
- **Composite words** (e.g. key|ring, from Sperry's later work): the patient said "ring" but picked a key with the left hand.

## Misconceptions reported in AQA examiner reports (per research agent; not independently re-checked)
- Mixing up the sympathetic and parasympathetic systems.
- Confusing hormones with neurotransmitters.
- Describing structure when asked for the **process** of synaptic transmission.
- Picking "relay neuron" for "carries impulses towards the brain" (the answer is sensory).
- Using Phineas Gage as evidence of recovery.

## SEN design rules (summary)
- **Text:** body text 18px or more; line-height 1.5; max width 65ch; left-aligned. No italics or underline for emphasis: use bold. No all-caps.
- **Chunking:** at most about 60 words per screen-chunk and at most 3 new terms per step. Learner-paced (Next button), never auto-advancing.
- **Language:** literal language and a predictable lesson shell. Neutral quiz feedback ("Not quite"), no timers, unlimited retries.
- **Mayer principles:**
  - pre-training (key words first);
  - segmenting (one idea per step);
  - signalling (only the active part at full colour, everything else dimmed);
  - labels next to the things they label.
- **Motion:** respect prefers-reduced-motion and the site's "calm mode" (`reducedMotion()` from `src/settings.js`). Nothing flashes more than 3 times per second.
- **Colour:** never encode meaning by red/green alone; pair colour with a word or icon. Targets are at least 44×44px.
