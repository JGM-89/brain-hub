"""
Build the 3D brain models for the website from published neuroimaging atlases.

Nothing here is hand-modelled. Every surface comes from one of:
  * FreeSurfer fsaverage6 pial surface (Fischl et al., 1999), MNI305 space
  * Destrieux gyral/sulcal parcellation on fsaverage (Destrieux et al., 2010)
  * Harvard-Oxford cortical + subcortical atlases (Desikan et al., 2006; FSL), MNI152 space
  * Talairach Daemon labels (Lancaster et al., 2000), registered to MNI152 by
    maximising overlap with the MNI152 brain mask (validated against Harvard-Oxford)

  * FreeSurfer fsaverage aseg segmentation (same MNI305 space as the cortex surface, no registration)
  * CIT168 subcortical atlas (Pauli et al., 2018; CC BY 4.0), MNI152 -> MNI305 via FreeSurfer's published affine
  * HCP1065 tractography atlas (Yeh, 2022; CC BY-SA 4.0): optic tract/chiasm, optic radiation, arcuate fasciculus

Output: tools/brain_raw.glb (compressed into web/public/models by `npm run models`)
        web/src/data/brain-provenance.json, web/src/data/landmarks.json
Coordinates: MNI305 millimetres converted to glTF Y-up with a proper rotation:
  (x, y, z)_RAS -> (-x, z, y)   so +X = subject's left, +Y = up, +Z = forwards (out of the face).
  This matches MediaPipe's canonical face model axes, which makes webcam anchoring simple.
"""
import json, os, sys
import numpy as np
import nibabel as nib
import trimesh
from scipy import ndimage, optimize
from scipy.spatial import cKDTree
from skimage import measure
from nilearn import datasets, surface, image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "tools", "brain_raw.glb")  # compressed into web/public/models by: npm run models
OUT_JSON = os.path.join(ROOT, "web", "src", "data", "brain-provenance.json")
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)

def ras_to_gltf(v):
    v = np.asarray(v, dtype=np.float64)
    return np.stack([-v[:, 0], v[:, 2], v[:, 1]], axis=1)

# FreeSurfer's published MNI305 -> MNI152 affine (surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems)
M305_TO_152 = np.array([[0.9975, -0.0073, 0.0176, -0.0429],
                        [0.0146, 1.0009, -0.0024, 1.5496],
                        [-0.0130, -0.0093, 0.9971, 1.1840],
                        [0, 0, 0, 1]])
M152_TO_305 = np.linalg.inv(M305_TO_152)

def to305(img):
    """Re-label an MNI152-space image with MNI305 world coordinates (affine only, data untouched)."""
    return nib.Nifti1Image(np.asarray(img.dataobj), M152_TO_305 @ img.affine)

def log(*a):
    print(*a, flush=True)

# ---------------------------------------------------------------- cortex
fs5 = datasets.fetch_surf_fsaverage("fsaverage5")
fs6 = datasets.fetch_surf_fsaverage("fsaverage6")
destrieux = datasets.fetch_atlas_surf_destrieux()
dlabels = [l if isinstance(l, str) else l.decode() for l in destrieux["labels"]]
D = {name: i for i, name in enumerate(dlabels)}

LOBE_OF = {}
def put(lobe, names):
    for n in names:
        assert n in D, n
        LOBE_OF[n] = lobe

put("frontal", ["G_and_S_frontomargin", "G_and_S_transv_frontopol", "G_front_inf-Opercular",
                "G_front_inf-Orbital", "G_front_inf-Triangul", "G_front_middle", "G_front_sup",
                "G_orbital", "G_rectus", "Lat_Fis-ant-Horizont", "Lat_Fis-ant-Vertical",
                "S_front_inf", "S_front_middle", "S_front_sup", "S_orbital_lateral",
                "S_orbital_med-olfact", "S_orbital-H_Shaped", "S_suborbital", "G_precentral",
                "S_precentral-inf-part", "S_precentral-sup-part", "G_and_S_paracentral",
                "G_and_S_subcentral"])
put("parietal", ["G_postcentral", "S_postcentral", "G_parietal_sup", "G_pariet_inf-Angular",
                 "G_pariet_inf-Supramar", "G_precuneus", "S_intrapariet_and_P_trans",
                 "S_interm_prim-Jensen", "S_subparietal", "S_cingul-Marginalis"])
put("temporal", ["G_temp_sup-G_T_transv", "G_temp_sup-Lateral", "G_temp_sup-Plan_polar",
                 "G_temp_sup-Plan_tempo", "G_temporal_inf", "G_temporal_middle", "Pole_temporal",
                 "S_temporal_inf", "S_temporal_sup", "S_temporal_transverse",
                 "G_oc-temp_lat-fusifor", "G_oc-temp_med-Parahip", "S_collat_transv_ant",
                 "S_oc-temp_lat"])
put("occipital", ["G_cuneus", "G_occipital_middle", "G_occipital_sup", "G_oc-temp_med-Lingual",
                  "G_and_S_occipital_inf", "Pole_occipital", "S_calcarine",
                  "S_oc_middle_and_Lunatus", "S_oc_sup_and_transversal", "S_occipital_ant",
                  "S_collat_transv_post"])
put("insula", ["G_Ins_lg_and_S_cent_ins", "G_insular_short", "S_circular_insula_ant",
               "S_circular_insula_inf", "S_circular_insula_sup"])
put("cingulate", ["G_and_S_cingul-Ant", "G_and_S_cingul-Mid-Ant", "G_and_S_cingul-Mid-Post",
                  "G_cingul-Post-dorsal", "G_cingul-Post-ventral", "S_pericallosal",
                  "G_subcallosal"])
put("medialwall", ["Medial_wall", "Unknown"])
# Boundary sulci are split vertex-by-vertex to the lobe of the nearest labelled gyrus
BOUNDARY = {
    "S_central": ["G_precentral", "G_postcentral"],
    "S_parieto_occipital": ["G_precuneus", "G_cuneus"],
    "Lat_Fis-post": ["G_pariet_inf-Supramar", "G_temp_sup-Lateral", "G_temp_sup-Plan_tempo"],
    "S_oc-temp_med_and_Lingual": ["G_oc-temp_med-Lingual", "G_oc-temp_med-Parahip"],
}
missing = [n for n in dlabels if n not in LOBE_OF and n not in BOUNDARY]
assert not missing, missing

LOBES = ["frontal", "parietal", "temporal", "occipital", "insula", "cingulate", "medialwall"]

# Functional regions (painted as a vertex attribute so the site can glow them)
REGIONS = ["none", "motor", "somatosensory", "visual", "auditory", "broca", "wernicke"]
R = {n: i for i, n in enumerate(REGIONS)}

ho_cort = datasets.fetch_atlas_harvard_oxford("cort-maxprob-thr25-1mm")
ho_cort_img = to305(ho_cort.maps if not isinstance(ho_cort.maps, str) else nib.load(ho_cort.maps))
HOC = {n: i for i, n in enumerate(ho_cort.labels)}

def build_hemi(hemi):
    pial = surface.load_surf_mesh(fs6[f"pial_{hemi}"])
    sph6 = surface.load_surf_mesh(fs6[f"sphere_{hemi}"]).coordinates
    sph5 = surface.load_surf_mesh(fs5[f"sphere_{hemi}"]).coordinates
    sulc = surface.load_surf_data(fs6[f"sulc_{hemi}"])
    lab5 = np.asarray(destrieux[f"map_{hemi}"]).astype(int)
    # propagate fsaverage5 labels to fsaverage6 (fs5 vertices are the first 10242 of fs6)
    _, nn = cKDTree(sph5).query(sph6)
    lab = lab5[nn]
    lab[:10242] = lab5
    names = np.array(dlabels)[lab]
    verts = np.asarray(pial.coordinates, dtype=np.float64)
    faces = np.asarray(pial.faces)

    lobe = np.array([LOBE_OF.get(n, "") for n in names], dtype=object)
    for sul, gyri in BOUNDARY.items():
        idx = np.where(names == sul)[0]
        if len(idx) == 0:
            continue
        cand = np.where(np.isin(names, gyri))[0]
        _, k = cKDTree(verts[cand]).query(verts[idx])
        lobe[idx] = [LOBE_OF[names[c]] for c in cand[k]]
    assert all(l in LOBES for l in lobe)

    region = np.zeros(len(verts), dtype=np.uint8)
    # central sulcus banks: anterior bank -> motor, posterior bank -> somatosensory
    cs = np.where(names == "S_central")[0]
    pre = np.where(names == "G_precentral")[0]; post = np.where(names == "G_postcentral")[0]
    dpre, _ = cKDTree(verts[pre]).query(verts[cs]); dpost, _ = cKDTree(verts[post]).query(verts[cs])
    region[pre] = R["motor"]; region[post] = R["somatosensory"]
    region[cs[dpre <= dpost]] = R["motor"]; region[cs[dpre > dpost]] = R["somatosensory"]
    region[np.isin(names, ["S_calcarine", "Pole_occipital"])] = R["visual"]
    region[np.isin(names, ["G_temp_sup-G_T_transv", "S_temporal_transverse"])] = R["auditory"]
    if hemi == "left":
        region[np.isin(names, ["G_front_inf-Opercular", "G_front_inf-Triangul"])] = R["broca"]
        # Wernicke: Harvard-Oxford "STG posterior division" + "Planum Temporale",
        # restricted to the superior temporal gyrus surface (Destrieux) so it doesn't bleed.
        ho_on_surf = surface.vol_to_surf(ho_cort_img, pial, interpolation="nearest_most_frequent"
                                         if "nearest_most_frequent" in surface.vol_to_surf.__doc__ else "nearest",
                                         radius=3.0)
        ho_on_surf = np.round(ho_on_surf).astype(int)
        werk_ho = np.isin(ho_on_surf, [HOC["Superior Temporal Gyrus, posterior division"], HOC["Planum Temporale"]])
        stg = np.isin(names, ["G_temp_sup-Lateral", "G_temp_sup-Plan_tempo", "S_temporal_sup"])
        region[werk_ho & stg] = R["wernicke"]

    # sulcal depth -> shading value 0..1 (gyri light, sulci dark), like FreeSurfer displays
    s = np.clip((sulc - np.percentile(sulc, 2)) / (np.percentile(sulc, 98) - np.percentile(sulc, 2)), 0, 1)
    shade = (1.0 - s)

    out = {}
    face_lobe = lobe[faces[:, 0]]
    for L in LOBES:
        fsel = faces[face_lobe == L]
        if len(fsel) == 0:
            continue
        used, inv = np.unique(fsel.ravel(), return_inverse=True)
        out[L] = dict(v=verts[used], f=inv.reshape(-1, 3), region=region[used], shade=shade[used])
    counts = {REGIONS[i]: int((region == i).sum()) for i in range(1, len(REGIONS))}
    log(hemi, "region vertex counts", counts)
    return out

# ================================================================= volumes
DATA = os.path.join(ROOT, "tools", "data")

def volume_mesh(mask, affine, target_faces=6000, sigma=1.0, iters=10, keep_frac=0.05):
    mask = mask.astype(np.float32)
    if mask.sum() < 5:
        raise ValueError("empty mask")
    pad = 3
    sl = ndimage.find_objects(mask > 0)[0]
    sl = tuple(slice(max(s.start - pad, 0), s.stop + pad) for s in sl)
    sub = np.pad(mask[sl], pad)
    sub = ndimage.gaussian_filter(sub, sigma)
    v, f, _, _ = measure.marching_cubes(sub, 0.5)
    v = v + np.array([s.start for s in sl]) - pad
    v = nib.affines.apply_affine(affine, v)
    m = trimesh.Trimesh(v, f, process=True)
    parts = sorted(m.split(only_watertight=False), key=lambda p: -len(p.faces))
    m = trimesh.util.concatenate([p for p in parts if len(p.faces) > keep_frac * len(parts[0].faces)])
    trimesh.smoothing.filter_taubin(m, iterations=iters)
    if len(m.faces) > target_faces:
        m = m.simplify_quadric_decimation(face_count=target_faces)
    m.fix_normals()
    return m

def side_mask(affine, shape, side):
    ijk = np.indices(shape).reshape(3, -1).T
    x = nib.affines.apply_affine(affine, ijk)[:, 0].reshape(shape)
    return x < 0 if side == "left" else x > 0

STRUCTS = []
def add(name, mesh, source):
    STRUCTS.append((name, mesh, source))
    log(f"  {name}: {len(mesh.vertices)} v / {len(mesh.faces)} f")

# ---- FreeSurfer fsaverage aseg (already MNI305: no registration needed)
ASEG_SRC = "FreeSurfer fsaverage aseg segmentation (same space as the cortex)"
aseg = nib.load(os.path.join(DATA, "aseg.mgz"))
A = np.asarray(aseg.dataobj).astype(int)
def aseg_mesh(ids, **kw):
    return volume_mesh(np.isin(A, ids), aseg.affine, **kw)
ASEG_IDS = {"left": (10, 11, 12, 13, 17, 18, 26, 4, 5, 7, 8), "right": (49, 50, 51, 52, 53, 54, 58, 43, 44, 46, 47)}
for side, (th, ca, pu, pa, hi, am, ac, lv, il, cbw, cbc) in ASEG_IDS.items():
    add(f"thalamus_{side}", aseg_mesh([th]), ASEG_SRC)
    add(f"caudate_{side}", aseg_mesh([ca]), ASEG_SRC)
    add(f"putamen_{side}", aseg_mesh([pu]), ASEG_SRC)
    add(f"pallidum_{side}", aseg_mesh([pa], target_faces=3000), ASEG_SRC)
    add(f"hippocampus_{side}", aseg_mesh([hi]), ASEG_SRC)
    add(f"amygdala_{side}", aseg_mesh([am], target_faces=3000), ASEG_SRC)
    add(f"accumbens_{side}", aseg_mesh([ac], target_faces=2000), ASEG_SRC)
    add(f"ventricle_{side}", aseg_mesh([lv, il], target_faces=6000, sigma=0.8), ASEG_SRC)
    add(f"cerebellum_{side}", aseg_mesh([cbw, cbc], target_faces=18000, sigma=1.0, iters=12), ASEG_SRC)
add("brainstem", aseg_mesh([16], target_faces=8000), ASEG_SRC)
add("corpus_callosum", aseg_mesh([251, 252, 253, 254, 255], target_faces=6000, sigma=0.8), ASEG_SRC)
add("optic_chiasm", aseg_mesh([85], target_faces=1200, sigma=0.7), ASEG_SRC)
add("ventricle_third", aseg_mesh([14], target_faces=2000, sigma=0.7), ASEG_SRC)
add("ventricle_fourth", aseg_mesh([15], target_faces=2000, sigma=0.7), ASEG_SRC)

# ---- CIT168 (MNI152-FSL space -> MNI305)
CIT_SRC = "CIT168 subcortical atlas (Pauli et al., 2018), CC BY 4.0"
cit = nib.load(os.path.join(DATA, "CIT168toMNI152-FSL_prob.nii.gz"))
cit_aff = M152_TO_305 @ cit.affine
C = np.asarray(cit.dataobj)
def cit_mask(idxs, thr=0.4):
    return np.max(C[..., idxs], axis=-1) > thr
add("hypothalamus", volume_mesh(cit_mask([13, 14]), cit_aff, target_faces=3000, sigma=0.8), CIT_SRC)
for side in ["left", "right"]:
    sm = side_mask(cit_aff, C.shape[:3], side)
    add(f"substantia_nigra_{side}", volume_mesh(cit_mask([6, 8]) & sm, cit_aff, target_faces=1500, sigma=0.7), CIT_SRC)
add("vta", volume_mesh(cit_mask([10], 0.3), cit_aff, target_faces=800, sigma=0.7), CIT_SRC)

# ---- HCP1065 tractography (ICBM152 space -> MNI305)
HCP_SRC = "HCP1065 population-averaged tractography atlas (Yeh, 2022), CC BY-SA 4.0"
def hcp(path, **kw):
    im = nib.load(os.path.join(DATA, "hcp1065", "nifti", path))
    return volume_mesh(np.asarray(im.dataobj) > 0, M152_TO_305 @ im.affine, **kw)
for side, S in [("left", "L"), ("right", "R")]:
    add(f"optic_tract_{side}", hcp(f"cranial nerve/CNII_{S}.nii.gz", target_faces=2500, sigma=1.2, iters=15), HCP_SRC)
    add(f"optic_radiation_{side}", hcp(f"projection/OR_{S}.nii.gz", target_faces=7000, sigma=1.5, iters=15), HCP_SRC)
    add(f"arcuate_{side}", hcp(f"association/AF_{S}.nii.gz", target_faces=9000, sigma=1.5, iters=15), HCP_SRC)

# ---- Talairach Daemon: lateral geniculate nucleus only (not present in the other atlases)
TAL_SRC = "Talairach Daemon atlas (Lancaster et al., 2000), registered to MNI152 then MNI305"
tal_ba = datasets.fetch_atlas_talairach("ba")
tal_lobe = datasets.fetch_atlas_talairach("lobe")
def timg(t):
    return t.maps if not isinstance(t.maps, str) else nib.load(t.maps)
mni_mask = datasets.load_mni152_brain_mask(resolution=1)
tal_lobe_img = timg(tal_lobe)
tdat = np.asarray(tal_lobe_img.dataobj) > 0
mdat = np.asarray(mni_mask.dataobj) > 0
tpts = nib.affines.apply_affine(tal_lobe_img.affine, np.argwhere(tdat)[::7])
mpts = nib.affines.apply_affine(mni_mask.affine, np.argwhere(mdat)[::7])
mni_inv = np.linalg.inv(mni_mask.affine); tinv = np.linalg.inv(tal_lobe_img.affine)
msm = ndimage.gaussian_filter(mdat.astype(np.float32), 2.0); tsm = ndimage.gaussian_filter(tdat.astype(np.float32), 2.0)

def params_to_affine(p):
    tx, ty, tz, rx, ry, rz, sx, sy, sz = p
    cx, sxn = np.cos(rx), np.sin(rx); cy, syn = np.cos(ry), np.sin(ry); cz, szn = np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sxn], [0, sxn, cx]]); Ry = np.array([[cy, 0, syn], [0, 1, 0], [-syn, 0, cy]])
    Rz = np.array([[cz, -szn, 0], [szn, cz, 0], [0, 0, 1]])
    M = np.eye(4); M[:3, :3] = Rz @ Ry @ Rx @ np.diag([sx, sy, sz]); M[:3, 3] = [tx, ty, tz]
    return M

def cost(p):
    M = params_to_affine(p)
    inside = ndimage.map_coordinates(msm, nib.affines.apply_affine(mni_inv @ M, tpts).T, order=1).mean()
    tq = nib.affines.apply_affine(tinv @ np.linalg.inv(M), mpts)
    ok = np.all((tq >= 0) & (tq <= np.array(tsm.shape) - 1), axis=1)   # Talairach volume is cropped below z=-42
    return -(inside + ndimage.map_coordinates(tsm, tq[ok].T, order=1).mean())

p0 = np.r_[mpts.mean(0) - tpts.mean(0), 0, 0, 0, mpts.std(0) / tpts.std(0)]
res = optimize.minimize(cost, p0, method="Powell", options=dict(maxiter=6000, xtol=1e-4, ftol=1e-6))
res = optimize.minimize(cost, res.x, method="Nelder-Mead", options=dict(maxiter=6000, xatol=1e-4, fatol=1e-7))
TAL2MNI = params_to_affine(res.x)
tal_ba_img = timg(tal_ba)
TBA = {n: i for i, n in enumerate(tal_ba.labels)}
tal_aff = M152_TO_305 @ TAL2MNI @ tal_ba_img.affine
TB = np.asarray(tal_ba_img.dataobj)
# validation against independent data: Talairach thalamic nuclei vs fsaverage aseg thalamus
TH_NUCLEI = ["Ventral Posterior Lateral Nucleus", "Pulvinar", "Medial Dorsal Nucleus", "Lateral Geniculum Body",
             "Ventral Lateral Nucleus", "Ventral Anterior Nucleus", "Anterior Nucleus", "Lateral Posterior Nucleus",
             "Lateral Dorsal Nucleus", "Midline Nucleus", "Ventral Posterior Medial Nucleus", "Medial Geniculum Body"]
tal_th = np.isin(TB, [TBA[n] for n in TH_NUCLEI]).astype(np.uint8)
tal_th_on_aseg = np.asarray(image.resample_to_img(nib.Nifti1Image(tal_th, tal_aff), aseg, interpolation="nearest",
                                                  force_resample=True, copy_header=True).dataobj) > 0
aseg_th = np.isin(A, [10, 49])
validation = {"talairach_thalamus_vs_fsaverage_thalamus_dice": float(2 * (tal_th_on_aseg & aseg_th).sum() / (tal_th_on_aseg.sum() + aseg_th.sum())),
              "talairach_fit_params": np.round(res.x, 4).tolist()}
log("validation", validation)
for side in ["left", "right"]:
    sm = side_mask(tal_aff, TB.shape, side)
    add(f"lgn_{side}", volume_mesh((TB == TBA["Lateral Geniculum Body"]) & sm, tal_aff, target_faces=800, sigma=0.8), TAL_SRC)

# ================================================================= landmarks (webcam anchoring + vision lesson)
from mne.io import read_fiducials
fids, _ = read_fiducials(os.path.join(DATA, "fsaverage-fiducials.fif"))
fid = {({1: "lpa", 2: "nasion", 3: "rpa"})[int(f["ident"])]: (np.array(f["r"]) * 1000).tolist() for f in fids}
# MediaPipe canonical face model (Apache-2.0): vertex order == landmark index, units cm, axes match our glTF axes
cfm = np.array([list(map(float, l.split()[1:4])) for l in open(os.path.join(DATA, "canonical_face_model.obj")) if l.startswith("v ")])
LM = {"nose_bridge_168": 168, "forehead_10": 10, "chin_152": 152, "eye_outer_33": 33, "eye_inner_133": 133,
      "eye_inner_362": 362, "eye_outer_263": 263, "eye_top_159": 159, "eye_bottom_145": 145, "eye_top_386": 386, "eye_bottom_374": 374}
landmarks = {"fiducials_ras_mm": fid,
             "fiducials_gltf_mm": {k: ras_to_gltf(np.array([v]))[0].tolist() for k, v in fid.items()},
             "canonical_face_cm": {k: cfm[i].tolist() for k, i in LM.items()},
             "optic_chiasm_gltf_mm": ras_to_gltf(nib.affines.apply_affine(aseg.affine, np.argwhere(A == 85)).mean(0, keepdims=True))[0].tolist()}

# ================================================================= write
scene = trimesh.Scene()
prov = {"cortex": {}, "structures": {}, "validation": validation, "regions": REGIONS, "lobes": LOBES}
for hemi in ["left", "right"]:
    for L, p in build_hemi(hemi).items():
        m = trimesh.Trimesh(ras_to_gltf(p["v"]), p["f"], process=False)
        col = np.zeros((len(p["v"]), 4), dtype=np.uint8)
        col[:, 0] = (p["shade"] * 255).astype(np.uint8); col[:, 1] = p["region"]; col[:, 3] = 255
        m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=col)
        name = f"cortex_{hemi}_{L}"
        scene.add_geometry(m, node_name=name, geom_name=name)
        prov["cortex"][name] = "FreeSurfer fsaverage6 pial surface; lobe from Destrieux parcellation"
for name, mesh, source in STRUCTS:
    scene.add_geometry(trimesh.Trimesh(ras_to_gltf(mesh.vertices), mesh.faces, process=False), node_name=name, geom_name=name)
    prov["structures"][name] = source
sk_v, sk_f = nib.freesurfer.read_geometry(os.path.join(DATA, "outer_skin.surf"))
skin = trimesh.Trimesh(ras_to_gltf(sk_v), sk_f, process=True)
skin.fix_normals()
skin = skin.simplify_quadric_decimation(face_count=12000)
scene.add_geometry(skin, node_name="head_skin", geom_name="head_skin")
prov["structures"]["head_skin"] = "FreeSurfer fsaverage outer skin (BEM) surface"

scene.export(OUT_GLB)
json.dump(prov, open(OUT_JSON, "w"), indent=1)
json.dump(landmarks, open(os.path.join(os.path.dirname(OUT_JSON), "landmarks.json"), "w"), indent=1)
log("wrote", OUT_GLB, os.path.getsize(OUT_GLB) // 1024, "KB")
