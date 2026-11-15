export function render(main) {
  main.innerHTML = `
  <div class="page" data-readable>
    <h1>Where the science comes from</h1>
    <p class="lead">The 3D brain on this site is not drawn by an artist. Almost every shape was made by computer from published brain atlases used by neuroscientists. The few parts that are approximate are listed below.</p>

    <h2>How the 3D brain was made</h2>
    <ol>
      <li>Scientists scan many people’s brains with MRI and average them together into a “template” brain.</li>
      <li>Experts and computer programs label the parts (for example “hippocampus”) in that template. This is called an <strong>atlas</strong>.</li>
      <li>We turned each labelled part into a 3D shape, kept the shapes in the same position as in the scans, and smoothed them a little so they look clean.</li>
    </ol>
    <p>Because most of these are averages of many people, your own brain will be a slightly different shape and size.</p>

    <h2>The atlases we used</h2>
    <div class="grid">
      <div class="card"><h3>Cortex and lobes</h3><p><strong>FreeSurfer fsaverage</strong> pial surface, an average of 40 adults made with the method of Fischl et al. (1999). Lobes and the motor, somatosensory, visual, auditory and Broca’s areas come from the <strong>Destrieux</strong> parcellation (Destrieux et al., 2010).</p></div>
      <div class="card"><h3>Wernicke’s area</h3><p>The back of the left superior temporal gyrus and the planum temporale, from the <strong>Harvard–Oxford cortical atlas</strong> (Desikan et al., 2006; Makris et al., 2006). There is no single agreed border for Wernicke’s area, so this follows a common definition.</p></div>
      <div class="card"><h3>Deep structures</h3><p>Thalamus, hippocampus, amygdala, basal ganglia, nucleus accumbens, ventricles, cerebellum, brainstem, corpus callosum and optic chiasm: <strong>FreeSurfer fsaverage aseg</strong> segmentation, in the same space as the cortex.</p></div>
      <div class="card"><h3>Hypothalamus and dopamine areas</h3><p>Hypothalamus (with mammillary bodies), substantia nigra and ventral tegmental area: <strong>CIT168 atlas</strong> (Pauli et al., 2018), CC BY 4.0.</p></div>
      <div class="card"><h3>Nerve-fibre tracts</h3><p>Optic tracts, optic radiations and the arcuate fasciculus: <strong>HCP1065 tractography atlas</strong> (Yeh, 2022, Nature Communications), CC BY-SA 4.0, built from the Human Connectome Project.</p></div>
      <div class="card"><h3>Lateral geniculate nucleus</h3><p>From the <strong>Talairach Daemon</strong> atlas (Lancaster et al., 2000). Unlike the others, this atlas is based on one person’s brain, studied after death, not an average of scans. It was aligned to the other atlases by computer, and we checked the alignment against FreeSurfer’s thalamus.</p></div>
    </div>

    <h2>What is approximate</h2>
    <ul>
      <li><strong>Eyes and optic nerves:</strong> brain atlases stop at the skull, so the eyes are placed using Google MediaPipe’s average face model. The optic nerve is drawn as a smooth path from each eye to the optic chiasm.</li>
      <li><strong>Pituitary gland:</strong> it hangs under the brain, so brain atlases leave it out. It is drawn as a simple shape of about the right size, placed below the hypothalamus and optic chiasm.</li>
      <li><strong>Coloured signal paths</strong> in the vision views show the route signals take. They are a diagram drawn through the real structures, not individual nerve fibres.</li>
      <li><strong>Webcam mode</strong> fits an average brain to your face, so it is a good estimate, not a scan of you.</li>
    </ul>

    <h2>Your privacy</h2>
    <p>The webcam feature runs entirely in your browser. Video is never recorded, saved or uploaded, and the face-tracking files are served by this site. Settings and lesson progress are saved only on your device.</p>

    <h2>Licences and credits</h2>
    <ul class="source-note" style="border:0">
      <li>FreeSurfer data: “All or portions of this licensed product (such portions are the ‘Software’) have been obtained under license from The General Hospital Corporation (‘MGH’)”, used under the FreeSurfer Software License. For research and education, not clinical use.</li>
      <li>CIT168: Pauli, Nili & Tyszka (2018), Scientific Data. CC BY 4.0.</li>
      <li>HCP1065: Yeh (2022), Nature Communications 13:4933. CC BY-SA 4.0. Data were provided in part by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657), funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research, and by the McDonnell Center for Systems Neuroscience at Washington University.</li>
      <li>Harvard–Oxford atlas: FSL, CC BY-SA 4.0. Talairach Daemon: Lancaster et al. (2000).</li>
      <li>MediaPipe Face Landmarker and canonical face model: Google, Apache 2.0.</li>
      <li>Fonts: Atkinson Hyperlegible (Braille Institute), Lexend, OpenDyslexic, SIL Open Font Licence.</li>
      <li>The 3D brain model file made from these sources is shared under CC BY-SA 4.0 where the source licences allow. The parts made from FreeSurfer data stay under the FreeSurfer Software License.</li>
    </ul>
  </div>`;
}
