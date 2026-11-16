"""
Build the 3D human body for the nervous system, endocrine and fight-or-flight lessons.

Source: BodyParts3D release 4.0 (Database Center for Life Science, Japan): polygon meshes of one adult
male, based on whole-body MRI (the TARO voxel model) and refined/supplemented by medical illustrators
(Mitsuhashi et al., 2009, Nucleic Acids Research 37:D782-5). Licence: CC BY 4.0 (README_e.html, licence updated 2025-02-25).
Required attribution: "BodyParts3D, (c) The Database Center for Life Science licensed under
CC Attribution 4.0 International". (The 2013 OBJ file headers still carry the older
CC BY-SA 2.1 JP notice; the database README states the current licence.)

Download (only these, no account needed) into tools/data/bodyparts3d/:
  https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip  -> partof/
  https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip     -> isa/
  plus *_parts_list_e.txt, *_element_parts.txt and README_e.html
Files are keyed by element file id (FJxxxx); each has an FMA concept id and English name.

What is NOT in BodyParts3D 4.0 (so it is approximated here, and flagged "approx" everywhere):
  * spinal cord      -> a smooth tube through the centre of the REAL vertebral canal (found by ray casting
                        each real vertebra), ending at L1/L2 as in adults, realistic widths
  * thyroid gland    -> a two-lobed shape with an isthmus, placed on the REAL trachea just below the
                        REAL cricoid cartilage, at typical adult size
  * lung tissue      -> BP3D only has the airway and blood-vessel trees; the lung outline is a smooth
                        envelope wrapped around those real trees
  * adrenal medulla  -> the central core of the REAL adrenal mesh (about 10% of its volume, deepest part)
  * peripheral nerves (except the eye/orbit nerves) -> diagrammatic paths drawn between real landmarks
                        (vertebrae, ribs, arteries, organs). They show where nerves run, not their exact shape.
  * ovaries          -> none: the model is male. The lessons say so and mark the position in text only.

Coordinates: BodyParts3D millimetres (x = subject's left, y = posterior, z = up) -> glTF Y-up:
  (x, y, z) -> (x, z, -y)   so +X = subject's left, +Y = up, +Z = forwards. Proper rotation, units mm.

Output: tools/body_raw.glb  -> compressed to web/public/models/body.glb by `npm run body`
        web/public/models/body.json        (runtime: parts, anchors, nerve paths, blood routes)
        web/src/data/body-provenance.json  (every node -> FMA ids, element files, approximations)
"""
import json, os, sys
import numpy as np
import trimesh
from scipy import ndimage
from scipy.interpolate import splprep, splev
from skimage import measure, morphology
import networkx as nx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "tools", "data", "bodyparts3d")
OUT_GLB = os.path.join(ROOT, "tools", "body_raw.glb")
OUT_JSON = os.path.join(ROOT, "web", "public", "models", "body.json")
OUT_PROV = os.path.join(ROOT, "web", "src", "data", "body-provenance.json")


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ index
IDX = {}
for tree in ("partof", "isa"):
    for line in open(os.path.join(BP, f"{tree}_idx.tsv"), encoding="utf8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 3 and p[0] not in IDX:
            IDX[p[0]] = (p[1], p[2])

COMPOUND = {}
for tree in ("partof", "isa"):
    for line in open(os.path.join(BP, f"{tree}_element_parts.txt"), encoding="utf8"):
        p = line.rstrip("\n").split("\t")
        if len(p) == 3 and p[0].startswith("FMA"):
            COMPOUND.setdefault((tree, p[1]), []).append(p[2])


def compound(name, tree="partof"):
    els = sorted(set(COMPOUND.get((tree, name), [])))
    if not els:
        raise KeyError(name)
    return els


def by_name(pred):
    return sorted(fj for fj, (_, n) in IDX.items() if pred(n))


def objpath(fj):
    for tree in ("partof", "isa"):
        p = os.path.join(BP, tree, fj + ".obj")
        if os.path.exists(p):
            return p
    raise FileNotFoundError(fj)


_raw = {}


def raw(fj):
    """One BodyParts3D element in its own coordinates (mm)."""
    if fj not in _raw:
        m = trimesh.load(objpath(fj), force="mesh", process=False)
        m.merge_vertices()
        _raw[fj] = m
    return _raw[fj]


def raw_group(fjs):
    ms = [raw(f) for f in fjs]
    return trimesh.util.concatenate(ms) if len(ms) > 1 else ms[0].copy()


def to_gltf(v):
    v = np.asarray(v, dtype=np.float64)
    if v.ndim == 1:
        return np.array([v[0], v[2], -v[1]])
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)


def gl_mesh(m):
    out = trimesh.Trimesh(to_gltf(m.vertices), m.faces.copy(), process=True)
    return out


def decimate(m, faces):
    if len(m.faces) <= faces:
        return m
    lo, hi = m.bounds
    for k in (1.0, 1.1, 1.25, 1.5, 2.0):
        try:
            d = m.simplify_quadric_decimation(face_count=int(faces * k))
        except Exception as e:  # pragma: no cover
            log("  decimate failed", e)
            continue
        # quadric decimation very occasionally throws a vertex far away: check the bounds did not grow
        if len(d.faces) > 0 and np.all(d.bounds[0] > lo - 2) and np.all(d.bounds[1] < hi + 2):
            return d
        log(f"  decimation of {len(m.faces)} -> {int(faces * k)} faces moved a vertex; retrying")
    return m


def smooth(m, iters=6):
    out = m.copy()
    trimesh.smoothing.filter_taubin(out, lamb=0.5, nu=-0.53, iterations=iters)
    lo, hi = m.bounds
    if np.all(out.bounds[0] > lo - 3) and np.all(out.bounds[1] < hi + 3):
        return out
    log("  smoothing moved vertices too far; kept the unsmoothed mesh")
    return m


def element_info(fjs):
    return [{"file": f, "fma": IDX.get(f, ("", ""))[0], "name": IDX.get(f, ("", ""))[1]} for f in fjs]


# ------------------------------------------------------------------ parts (real BodyParts3D meshes)
NODES = {}   # name -> trimesh (glTF coords)
PARTS = {}   # name -> runtime info
PROV = {}    # name -> provenance


def add(name, mesh_bp, faces, cat, label, fjs=None, approx=None, smooth_iters=0, subdiv=0):
    m = mesh_bp.copy()
    if subdiv:
        m = m.subdivide_loop(iterations=subdiv)
    if smooth_iters:
        m = smooth(m, smooth_iters)
    g0 = gl_mesh(m)
    g = decimate(g0, faces)
    g.fix_normals()
    NODES[name] = g
    lo, hi = g.bounds
    PARTS[name] = {"cat": cat, "label": label, "center": np.round(g.centroid if g.is_volume else (lo + hi) / 2, 1).tolist(),
                   "min": np.round(lo, 1).tolist(), "max": np.round(hi, 1).tolist(), "approx": bool(approx)}
    PROV[name] = {"label": label, "faces": int(len(g.faces))}
    if fjs:
        PROV[name]["source"] = "BodyParts3D 4.0"
        PROV[name]["elements"] = element_info(fjs)
    if approx:
        PROV[name]["approximate"] = approx
    log(f"  {name:28s} {len(g.faces):6d} faces  {label}")
    return g


def add_fj(name, fjs, faces, cat, label, **kw):
    return add(name, raw_group(fjs), faces, cat, label, fjs=fjs, **kw)


log("loading BodyParts3D parts")
# --- skin
add_fj("skin", ["FJ2810"], 100000, "skin", "Skin")

# --- central nervous system (real)
brain_all = compound("brain")
SKIP_BRAIN = set(["FJ1730", "FJ1731", "FJ1767", "FJ1814", "FJ1738", "FJ1743", "FJ1750", "FJ1751", "FJ1759", "FJ1807",
                  "FJ1748", "FJ1749", "FJ1739", "FJ1740"])
BRAINSTEM = ["FJ1769", "FJ1831", "FJ1775", "FJ1822", "FJ1770", "FJ1817", "FJ1762", "FJ1779", "FJ1810", "FJ1826"]
CEREBELLUM = ["FJ1781", "FJ1830"]
HYPOTHALAMUS = ["FJ1760", "FJ1808", "FJ1780", "FJ1828"]
cerebrum_fjs = [f for f in brain_all if f not in SKIP_BRAIN and f not in BRAINSTEM + CEREBELLUM + HYPOTHALAMUS + ["FJ1795"]]
cerebrum_fjs = [f for f in cerebrum_fjs if "ventricle" not in IDX[f][1].lower()]
log("  cerebrum pieces:", ", ".join(IDX[f][1] for f in cerebrum_fjs))
add_fj("cerebrum", cerebrum_fjs, 60000, "cns", "Cerebrum")
add_fj("cerebellum", CEREBELLUM, 9000, "cns", "Cerebellum")
add_fj("brainstem", BRAINSTEM, 7000, "cns", "Brainstem")
add_fj("hypothalamus", HYPOTHALAMUS, 2500, "brainpart", "Hypothalamus")
add_fj("thalamus", ["FJ1782", "FJ1827"], 3000, "brainpart", "Thalamus")
add_fj("amygdala_left", ["FJ1753"], 1500, "brainpart", "Amygdala (left)", subdiv=2)
add_fj("amygdala_right", ["FJ1829"], 1500, "brainpart", "Amygdala (right)", subdiv=2)
add_fj("optic_nerves", ["FJ1313", "FJ1364", "FJ1771", "FJ1818", "FJ1773", "FJ1820"], 4000, "cns", "Optic nerves, chiasm and tracts")

# --- glands (real)
add_fj("pituitary", ["FJ1796"], 1500, "gland", "Pituitary gland")
add_fj("pineal", ["FJ1795"], 800, "gland", "Pineal gland", subdiv=2)
add_fj("adrenal_left", ["FJ3129"], 2500, "gland", "Adrenal gland (left)")
add_fj("adrenal_right", ["FJ3130"], 2500, "gland", "Adrenal gland (right)")
panc = [f for f in compound("pancreas") if "duct" not in IDX[f][1].lower()]
add_fj("pancreas", panc, 4000, "gland", "Pancreas")
add_fj("testis_left", ["FJ3138"], 1500, "gland", "Testis (left)", subdiv=2)
add_fj("testis_right", ["FJ3142"], 1500, "gland", "Testis (right)", subdiv=2)
add_fj("salivary_left", ["FJ2766", "FJ2765"], 1500, "organ", "Salivary glands (left)")
add_fj("salivary_right", ["FJ2768", "FJ2767"], 1500, "organ", "Salivary glands (right)")

# --- eyes (real)
def eye_parts(side):
    els = compound(f"{side} eyeball")
    sclera = [f for f in els if "iris" not in IDX[f][1].lower()]
    iris = [f for f in els if "iris" in IDX[f][1].lower()]
    return sclera, iris


for side in ("left", "right"):
    sc, ir = eye_parts(side)
    add_fj(f"eye_{side}", sc, 2500, "organ", f"Eye ({side})")
    add_fj(f"iris_{side}", ir, 800, "organ", f"Iris ({side})")
add_fj("ciliary_ganglia", ["FJ1288", "FJ1339", "FJ1319", "FJ1370"], 1200, "nerve", "Ciliary ganglia and short ciliary nerves")

# --- organs (real)
heart_els = [f for f in compound("heart") if not any(k in IDX[f][1].lower() for k in ("cavity", "papillary", "leaflet", "cusp", "valve", "chorda"))]
add_fj("heart", heart_els, 22000, "organ", "Heart")
liver_els = [f for f in compound("liver") if IDX[f][1].startswith("Hepatovenous segment") or IDX[f][1] == "Caudate lobe of liver"]
add_fj("liver", liver_els, 14000, "organ", "Liver")
add_fj("stomach", ["FJ2564"], 3500, "organ", "Stomach")
add_fj("esophagus", ["FJ2563"], 1500, "organ", "Oesophagus")
add_fj("small_intestine", compound("small intestine"), 24000, "organ", "Small intestine")
add_fj("large_intestine", compound("large intestine"), 9000, "organ", "Large intestine")
add_fj("kidney_left", ["FJ3145"], 3000, "organ", "Kidney (left)")
add_fj("kidney_right", ["FJ3147"], 3000, "organ", "Kidney (right)")
add_fj("ureters", ["FJ3144", "FJ3146"], 1500, "organ", "Ureters")
add_fj("bladder", ["FJ3149"], 2500, "organ", "Bladder", subdiv=2)
add_fj("spleen", ["FJ2561"], 2000, "organ", "Spleen")
airway_els = ["FJ2541", "FJ2450", "FJ2539"] + [f for f in compound("right lung") + compound("left lung") if "bronch" in IDX[f][1].lower()]
add_fj("airways", sorted(set(airway_els)), 16000, "organ", "Windpipe and bronchi")

# --- skeletal muscles (real)
add_fj("muscle_arm_left", ["FJ1478M", "FJ1512M"], 2500, "muscle", "Biceps (left arm)")
add_fj("muscle_arm_right", ["FJ1478", "FJ1512"], 2500, "muscle", "Biceps (right arm)")
add_fj("muscle_thigh_left", ["FJ1433M", "FJ1441M", "FJ1442M", "FJ1443M"], 5000, "muscle", "Quadriceps (left thigh)")
add_fj("muscle_thigh_right", ["FJ1433", "FJ1441", "FJ1442", "FJ1443"], 5000, "muscle", "Quadriceps (right thigh)")
add_fj("muscle_calf_left", ["FJ1394M", "FJ1397M"], 2500, "muscle", "Calf muscle (left)")
add_fj("muscle_calf_right", ["FJ1394", "FJ1397"], 2500, "muscle", "Calf muscle (right)")

# --- skeleton (real, shown faintly for context)
VERTEBRAE = [f for f in compound("vertebral column") if "disk" not in IDX[f][1].lower()]
spine_els = compound("vertebral column") + ["FJ3393"] + by_name(lambda n: n.lower() == "coccyx")
add_fj("spine", sorted(set(spine_els)), 26000, "bone", "Backbone (vertebral column)")
skull_els = [f for f in compound("skull") if not any(k in IDX[f][1].lower() for k in ("eyeball", "lens", "iris", "cornea", "sclera", "choroid", "vitreous", "lacrimal gland", "suspensory", "chamber", "retina", "ciliary"))]
add_fj("skull", skull_els, 16000, "bone", "Skull")
add_fj("ribcage", compound("rib cage"), 18000, "bone", "Ribs and breastbone")
add_fj("pelvis", ["FJ3152", "FJ3288"], 6000, "bone", "Pelvis")
limb_bones = ["FJ3262", "FJ3368", "FJ3277", "FJ3349", "FJ3286", "FJ3391", "FJ3259", "FJ3365", "FJ3282", "FJ3387", "FJ3260", "FJ3366",
              "FJ3237", "FJ3362", "FJ3279", "FJ3384"]
add_fj("limb_bones", limb_bones, 14000, "bone", "Arm and leg bones")

# --- blood vessels (real)
ART = {
    "asc_aorta": "FJ3413", "arch": "FJ3411", "desc_aorta": "FJ3427", "abd_aorta": "FJ1932", "thor_aorta": "FJ1931",
    "brachiocephalic": "FJ3417", "r_cca": "FJ3564", "l_cca": "FJ3483", "r_ica": "FJ1682", "l_ica": "FJ1682M",
    "r_subclavian": "FJ3579", "l_subclavian": "FJ3479", "r_axillary": "FJ2268", "l_axillary": "FJ2216",
    "r_brachial": "FJ2271", "l_brachial": "FJ2219", "r_radial": "FJ2294", "l_radial": "FJ2242", "r_ulnar": "FJ2310", "l_ulnar": "FJ2258",
    "r_common_iliac": "FJ3565", "l_common_iliac": "FJ3464", "r_ext_iliac": "FJ3567", "l_ext_iliac": "FJ3466",
    "r_femoral": "FJ2143", "l_femoral": "FJ2074", "r_popliteal": "FJ2170", "l_popliteal": "FJ2086",
    "r_renal": "FJ3576", "l_renal": "FJ3476", "celiac": "FJ3421", "sma": "FJ3644",
    "pulm_trunk": "FJ2966", "r_pulm_art": "FJ3019", "l_pulm_art": "FJ2924",
}
hep_art = by_name(lambda n: n == "Hepatic artery proper") + by_name(lambda n: n == "Common hepatic artery")
coronary = by_name(lambda n: n in ("Trunk of left coronary artery", "Trunk of right coronary artery", "Trunk of anterior interventricular branch of left coronary artery"))
VEIN = {
    "ivc_a": "FJ3441", "ivc_b": "FJ3659", "svc": "FJ3645", "r_brachioceph_v": "FJ3583", "l_brachioceph_v": "FJ3482",
    "r_ijv": "FJ3585", "l_ijv": "FJ3485", "r_subclavian_v": "FJ3587", "l_subclavian_v": "FJ3486",
    "r_renal_v": "FJ3577", "r_renal_v2": "FJ3578", "l_renal_v": "FJ3477", "l_renal_v2": "FJ3478",
    "r_suprarenal_v": "FJ3580", "l_suprarenal_v": "FJ3480", "r_testicular_v": "FJ3618", "l_testicular_v": "FJ3533",
    "portal": "FJ1853", "splenic_v": "FJ3641", "smv": "FJ3647", "r_hepatic_v": "FJ2416", "m_hepatic_v": "FJ2414", "l_hepatic_v": "FJ2415",
    "r_common_iliac_v": "FJ3566", "l_common_iliac_v": "FJ3465", "r_ext_iliac_v": "FJ3568", "l_ext_iliac_v": "FJ3484",
    "r_femoral_v": "FJ2144", "l_femoral_v": "FJ2102",
    "r_sup_pulm_v": "FJ3020", "r_inf_pulm_v": "FJ3040",
}
for k, v in list(ART.items()) + list(VEIN.items()):
    assert v in IDX, (k, v)
art_els = sorted(set(ART.values()) | set(hep_art) | set(by_name(lambda n: n in ("Right testicular artery", "Left testicular artery"))))
art_els = [f for f in art_els if f not in (ART["pulm_trunk"], ART["r_pulm_art"], ART["l_pulm_art"])]
add_fj("arteries", art_els, 22000, "artery", "Arteries")
vein_els = sorted(set(VEIN.values()) - {VEIN["r_sup_pulm_v"], VEIN["r_inf_pulm_v"]})
add_fj("veins", vein_els, 18000, "vein", "Veins")
add_fj("pulmonary_vessels", [ART["pulm_trunk"], ART["r_pulm_art"], ART["l_pulm_art"]], 4000, "vein", "Pulmonary arteries")

CAV = {k: raw(by_name(lambda n, k=k: n == k)[0]) for k in ("Cavity of right atrium", "Cavity of right ventricle", "Cavity of left atrium", "Cavity of left ventricle")}


# ================================================================== landmarks (BodyParts3D coordinates)
def cen(fjs):
    m = raw_group(fjs if isinstance(fjs, (list, tuple)) else [fjs])
    return m.vertices.mean(axis=0)


def slab_centre(fjs, z, half=4.0):
    v = raw_group(fjs if isinstance(fjs, (list, tuple)) else [fjs]).vertices
    s = v[np.abs(v[:, 2] - z) < half]
    if len(s) == 0:
        s = v[np.argsort(np.abs(v[:, 2] - z))[:30]]
    return (s.min(axis=0) + s.max(axis=0)) / 2


def extreme(fjs, axis, sign):
    v = raw_group(fjs if isinstance(fjs, (list, tuple)) else [fjs]).vertices
    return v[np.argmax(sign * v[:, axis])]


ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"]
VLABEL = {}
for f in VERTEBRAE:
    n = IDX[f][1].lower()
    if n == "atlas":
        VLABEL["C1"] = f
    elif n == "axis":
        VLABEL["C2"] = f
    elif n == "sacrum":
        continue
    else:
        w, kind = n.split()[0], n.split()[1]
        VLABEL[{"cervical": "C", "thoracic": "T", "lumbar": "L"}[kind] + str(ORD.index(w) + 1)] = f
LEVELS = [f"C{i}" for i in range(1, 8)] + [f"T{i}" for i in range(1, 13)] + [f"L{i}" for i in range(1, 6)]
assert all(l in VLABEL for l in LEVELS), sorted(VLABEL)


def ray_hits(m, o, d):
    """All points where a ray hits a mesh (Moller-Trumbore, vectorised; no rtree needed)."""
    tri = m.triangles
    e1 = tri[:, 1] - tri[:, 0]; e2 = tri[:, 2] - tri[:, 0]
    h = np.cross(d, e2); a = np.einsum("ij,ij->i", e1, h)
    ok = np.abs(a) > 1e-9
    f = np.zeros_like(a); f[ok] = 1.0 / a[ok]
    s = o - tri[:, 0]; u = f * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, e1); v = f * (q @ d)
    t = f * np.einsum("ij,ij->i", e2, q)
    hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)
    return o + np.outer(t[hit], d)


def canal(fj):
    """Centre of the vertebral canal of one real vertebra, by casting rays front-to-back through it."""
    m = raw(fj)
    lo, hi = m.bounds
    xc = np.median(m.vertices[:, 0])
    cands = []
    for t in np.linspace(0.15, 0.85, 15):
        z = lo[2] + t * (hi[2] - lo[2])
        ys = np.sort(ray_hits(m, np.array([xc, lo[1] - 20, z]), np.array([0, 1.0, 0]))[:, 1])
        if len(ys) > 1:
            keep = [ys[0]]
            for y in ys[1:]:
                if y - keep[-1] > 0.6:
                    keep.append(y)
            ys = np.array(keep)
        for i in range(1, len(ys) - 1, 2):
            gap = ys[i + 1] - ys[i]
            if 8 < gap < 40:
                cands.append((z, (ys[i] + ys[i + 1]) / 2, gap, ys[0], ys[i]))
                break
    if not cands:
        return None
    c = np.array(cands)
    z, y, gap, front, back = np.median(c, axis=0)
    return {"canal": np.array([xc, y, z]), "depth": gap, "front": front, "back": back}


V = {}
for l in LEVELS:
    info = canal(VLABEL[l]) or {}
    m = raw(VLABEL[l])
    lo, hi = m.bounds
    c = info.get("canal")
    if c is None:
        c = np.array([np.median(m.vertices[:, 0]), (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2])
        log("  !! no canal found for", l)
    v = m.vertices
    front = info.get("front", lo[1])
    back = info.get("back", c[1] - 8)
    body = v[(v[:, 1] < back + 1) & (np.abs(v[:, 2] - c[2]) < 8)]
    half = np.percentile(np.abs(body[:, 0] - c[0]), 97) if len(body) > 20 else 15
    V[l] = {"canal": c, "front": front, "back": back, "half": half, "lo": lo, "hi": hi}
log("  canal centres:", " ".join(f"{l}:{V[l]['canal'][2]:.0f}/{V[l]['canal'][1]:.0f}" for l in LEVELS))
SACRUM = raw("FJ3393")
COCCYX = by_name(lambda n: n.lower() == "coccyx")

MEDULLA = ["FJ1769", "FJ1831"]
med_v = raw_group(MEDULLA).vertices
cord_top = med_v[med_v[:, 2] < med_v[:, 2].min() + 5].mean(axis=0)


def spline(points, step=3.0, smooth_s=0.0, k=3):
    p = np.asarray(points, dtype=float)
    keep = [0]
    for i in range(1, len(p)):
        if np.linalg.norm(p[i] - p[keep[-1]]) > 0.5:
            keep.append(i)
    p = p[keep]
    if len(p) < 2:
        return p
    k = min(k, len(p) - 1)
    tck, u = splprep(p.T, s=smooth_s * len(p), k=k)
    fine = np.array(splev(np.linspace(0, 1, max(20, len(p) * 30)), tck)).T
    seg = np.linalg.norm(np.diff(fine, axis=0), axis=1)
    L = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(L[-1] / step) + 1)
    return np.array([np.interp(np.linspace(0, L[-1], n), L, fine[:, i]) for i in range(3)]).T


# ------------------------------------------------------------------ spinal cord (APPROXIMATE, through the real canal)
log("building approximate parts")
cord_levels = [l for l in LEVELS if l[0] in "CT"] + ["L1"]
cord_pts = [cord_top] + [V[l]["canal"] for l in cord_levels]
conus_end = V["L1"]["canal"].copy(); conus_end[2] = V["L1"]["lo"][2] - 2
cord_pts.append(conus_end)
CORD = spline(cord_pts, step=2.0, smooth_s=1.5)


def cord_radius(z):
    zs = [cord_top[2], V["C4"]["canal"][2], V["C6"]["canal"][2], V["T2"]["canal"][2], V["T6"]["canal"][2],
          V["T11"]["canal"][2], V["L1"]["canal"][2] + 4, conus_end[2]]
    rx = [5.2, 6.4, 6.6, 5.0, 4.3, 4.8, 3.0, 1.0]
    ry = [4.4, 4.2, 4.3, 4.0, 3.8, 4.0, 2.8, 1.0]
    zs, rx, ry = zs[::-1], rx[::-1], ry[::-1]
    return np.interp(z, zs, rx), np.interp(z, zs, ry)


def tube(path, radius_fn, seg=20, cap=True):
    path = np.asarray(path)
    verts, faces = [], []
    n = len(path)
    for i in range(n):
        t = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        t /= np.linalg.norm(t) + 1e-9
        ref = np.array([1.0, 0, 0]) if abs(t[0]) < 0.9 else np.array([0, 1.0, 0])
        a = ref - t * np.dot(ref, t); a /= np.linalg.norm(a)
        b = np.cross(t, a)
        rx, ry = radius_fn(i, path[i])
        for j in range(seg):
            th = 2 * np.pi * j / seg
            verts.append(path[i] + rx * np.cos(th) * a + ry * np.sin(th) * b)
    for i in range(n - 1):
        for j in range(seg):
            a0, a1 = i * seg + j, i * seg + (j + 1) % seg
            b0, b1 = a0 + seg, a1 + seg
            faces += [[a0, b0, a1], [a1, b0, b1]]
    if cap:
        for end, c in ((0, path[0]), (n - 1, path[-1])):
            ci = len(verts); verts.append(c)
            for j in range(seg):
                a0, a1 = end * seg + j, end * seg + (j + 1) % seg
                faces.append([ci, a1, a0] if end == 0 else [ci, a0, a1])
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=True)
    m.fix_normals()
    return m


cord_mesh = tube(CORD, lambda i, p: cord_radius(p[2]), seg=24)
add("spinal_cord", cord_mesh, 6000, "cns", "Spinal cord",
    approx="BodyParts3D 4.0 has no spinal cord mesh. Drawn as a smooth tube through the centre of the real vertebral canal "
           "(found by ray casting each real vertebra), from the real medulla oblongata to the L1/L2 level, with typical adult widths.")

# ------------------------------------------------------------------ thyroid (APPROXIMATE, placed on the real trachea)
cric_low = raw("FJ2440").bounds[0][2]
tv = raw("FJ2541").vertices


def trachea_at(z):
    s = tv[np.abs(tv[:, 2] - z) < 3]
    lo, hi = s.min(axis=0), s.max(axis=0)
    return (lo + hi) / 2, (hi - lo) / 2


tc, tr = trachea_at(cric_low - 12)
pitch = 0.6
gx = np.arange(tc[0] - 40, tc[0] + 40, pitch)
gy = np.arange(tc[1] - 30, tc[1] + 25, pitch)
gz = np.arange(cric_low - 45, cric_low + 30, pitch)
X, Y, Z = np.meshgrid(gx, gy, gz, indexing="ij")


def ellipsoid(cx, cy, cz, ax, ay, az, taper=0.0):
    up = np.clip((Z - cz) / az, 0, 1)
    s = 1 - taper * up
    return np.sqrt(((X - cx) / (ax * s)) ** 2 + ((Y - cy) / (ay * s)) ** 2 + ((Z - cz) / az) ** 2) - 1


def smin(a, b, k=0.35):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


lobe_z = cric_low - 8
f = ellipsoid(tc[0] - (tr[0] + 7), tc[1] - 3, lobe_z, 9.0, 8.5, 25.0, taper=0.5)
f = smin(f, ellipsoid(tc[0] + (tr[0] + 7), tc[1] - 3, lobe_z, 9.0, 8.5, 25.0, taper=0.5))
f = smin(f, ellipsoid(tc[0], tc[1] - tr[1] - 3.5, cric_low - 14, 13.0, 3.6, 8.5), k=0.5)
cyl = np.sqrt(((X - tc[0]) / (tr[0] + 1.0)) ** 2 + ((Y - tc[1]) / (tr[1] + 1.0)) ** 2) - 1
f = np.maximum(f, -cyl)
verts, faces, _, _ = measure.marching_cubes(f, 0.0, spacing=(pitch, pitch, pitch))
verts += np.array([gx[0], gy[0], gz[0]])
thy = trimesh.Trimesh(verts, faces[:, ::-1], process=True)
add("thyroid", thy, 3000, "gland", "Thyroid gland", smooth_iters=6,
    approx="BodyParts3D 4.0 has no thyroid gland. Drawn as two lobes joined by an isthmus, at typical adult size "
           "(lobes about 5 cm tall), wrapped around the real trachea just below the real cricoid cartilage, where the thyroid sits.")


# ------------------------------------------------------------------ lungs (APPROXIMATE envelope around the real trees)
def envelope(fjs, pitch=2.5, grow=6, shrink=2, sigma=1.2, keep_x=None):
    pts = np.vstack([trimesh.sample.sample_surface(raw(f), max(200, int(raw(f).area / 4)))[0] for f in fjs] +
                    [raw(f).vertices for f in fjs])
    lo = pts.min(axis=0) - (grow + 4) * pitch
    idx = np.floor((pts - lo) / pitch).astype(int)
    shape = idx.max(axis=0) + grow + 6
    g = np.zeros(shape, bool); g[tuple(idx.T)] = True
    g = ndimage.binary_dilation(g, morphology.ball(grow))
    for zz in range(g.shape[2]):
        g[:, :, zz] = ndimage.binary_fill_holes(g[:, :, zz])
    g = ndimage.binary_fill_holes(g)
    g = ndimage.binary_erosion(g, morphology.ball(shrink))
    if keep_x is not None:   # keep each lung on its own side, so the two outlines never meet at the midline
        xs = lo[0] + np.arange(g.shape[0]) * pitch
        g[~keep_x(xs), :, :] = False
    gf = ndimage.gaussian_filter(g.astype(float), sigma)
    v, fc, _, _ = measure.marching_cubes(gf, 0.5, spacing=(pitch,) * 3)
    return trimesh.Trimesh(v + lo, fc[:, ::-1], process=True)


for side in ("right", "left"):
    els = compound(f"{side} lung")
    stray = [f for f in els if raw(f).bounds[0][2] < 1050]   # a few elements filed under the lung lie far outside the chest
    if stray:
        log(f"  {side} lung: leaving out", [(f, IDX[f][1], round(raw(f).bounds[0][2])) for f in stray])
    els = [f for f in els if f not in stray]
    mid = trachea_at(1300)[0][0]
    keep = (lambda xs: xs < mid - 6) if side == "right" else (lambda xs: xs > mid + 6)
    add(f"lung_{side}", envelope(els, keep_x=keep), 7000, "organ", f"Lung ({side})", fjs=els,
        approx="BodyParts3D 4.0 models each lung as its real airway (bronchial) tree and blood vessels, without the soft lung tissue. "
               "The lung outline here is a smooth envelope wrapped around those real trees.")


# ------------------------------------------------------------------ adrenal medulla (APPROXIMATE core of the real gland)
def core(fj, frac=0.10, pitch=0.35):
    m = raw(fj)
    vg = m.voxelized(pitch).fill()
    mat = np.pad(vg.matrix, 2)
    d = ndimage.distance_transform_edt(mat)
    inside = d[mat]
    thr = np.quantile(inside, 1 - frac)
    gf = ndimage.gaussian_filter((d >= thr).astype(float), 1.2)
    v, fc, _, _ = measure.marching_cubes(gf, 0.5, spacing=(pitch,) * 3)
    origin = vg.translation - 2 * pitch
    return trimesh.Trimesh(v + origin, fc[:, ::-1], process=True)


for side, fj in (("left", "FJ3129"), ("right", "FJ3130")):
    add(f"adrenal_medulla_{side}", core(fj), 1200, "gland", f"Adrenal medulla ({side})", smooth_iters=4, fjs=[fj],
        approx="BodyParts3D 4.0 models the adrenal gland as one piece. The medulla is shown as the deepest central part of the "
               "real gland, about 10% of its volume (in life the medulla is roughly a tenth of the gland). The rest is the cortex.")

# PART3


# ================================================================== export
def r1(a):
    return np.round(np.asarray(a, dtype=float), 1).tolist()


def export(paths=None, routes=None, anchors=None):
    scene = trimesh.Scene()
    for name, g in NODES.items():
        g = g.copy()
        g.visual = trimesh.visual.ColorVisuals(g)
        scene.add_geometry(g, node_name=name, geom_name=name)
    scene.export(OUT_GLB)
    data = {
        "about": "BodyParts3D (c) The Database Center for Life Science, CC BY 4.0. Units mm. glTF axes: +X subject's left, +Y up, +Z forwards.",
        "parts": PARTS, "nerves": paths or {}, "routes": routes or {}, "anchors": anchors or {},
    }
    json.dump(data, open(OUT_JSON, "w"), separators=(",", ":"))
    prov = {
        "source": "BodyParts3D release 4.0, Database Center for Life Science (DBCLS), Japan. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
        "licence": "CC BY 4.0 (database README_e.html, licence updated 2025-02-25). Attribution: \"BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution 4.0 International\".",
        "licence_note": "The 2013 OBJ file headers still state CC BY-SA 2.1 Japan; the database README states the current licence, CC BY 4.0.",
        "body": "Polygon meshes of one adult male, based on whole-body MRI (the TARO voxel model) and refined/supplemented by medical illustrators (Mitsuhashi et al., 2009, Nucleic Acids Research 37:D782-5).",
        "coordinates": "BodyParts3D mm (x left, y posterior, z up) -> glTF (x, z, -y).",
        "processing": "Elements merged per node, decimated with quadric edge collapse (trimesh/fast-simplification); very low-poly parts (testes, bladder, amygdala, pineal) subdivided once or twice for smooth shading. Compressed with gltf-transform meshopt.",
        "not_in_model": {
            "ovaries": "The model is of a male body, so there are no ovaries. The lessons say this and mark their usual position with a dashed label only.",
        },
        "nodes": PROV,
        "diagrammatic_paths": (paths or {}) and {k: v.get("note", "") for k, v in (paths or {}).items()},
    }
    json.dump(prov, open(OUT_PROV, "w"), indent=1)
    log("wrote", OUT_GLB, f"{os.path.getsize(OUT_GLB) / 1e6:.1f} MB raw;", OUT_JSON, f"{os.path.getsize(OUT_JSON) / 1e3:.0f} kB")


if __name__ == "__main__" and "--meshes-only" in sys.argv:
    export()
    sys.exit(0)

# ================================================================== vessel centre lines (from the real vessel meshes)
from scipy.spatial import cKDTree

_skel = {}


def skeleton(fjs, pitch):
    key = (tuple(fjs), pitch)
    if key not in _skel:
        m = raw_group(list(fjs))
        vg = m.voxelized(pitch)
        try:
            vg = vg.fill()
        except Exception:
            pass
        mat = np.pad(vg.matrix, 1)
        sk = morphology.skeletonize(mat.astype(np.uint8)) > 0
        idx = np.argwhere(sk) - 1
        pts = vg.indices_to_points(idx) if hasattr(vg, "indices_to_points") else trimesh.transformations.transform_points(idx * 1.0, vg.transform)
        G = nx.Graph()
        G.add_nodes_from(range(len(idx)))
        for a, b in cKDTree(idx).query_pairs(1.75):
            G.add_edge(a, b, w=float(np.linalg.norm(idx[a] - idx[b])))
        comp = max(nx.connected_components(G), key=len)
        _skel[key] = (pts, G.subgraph(comp).copy())
    return _skel[key]


def centerline(fjs, a=None, b=None, pitch=0.8):
    """Path along the skeleton of a real vessel, from the node nearest a to the node nearest b (or the far end)."""
    fjs = fjs if isinstance(fjs, (list, tuple)) else [fjs]
    pts, G = skeleton(tuple(fjs), pitch)
    nodes = np.array(list(G.nodes))

    def nearest(p):
        return nodes[np.argmin(np.linalg.norm(pts[nodes] - p, axis=1))]

    def far(s):
        d = nx.single_source_dijkstra_path_length(G, s, weight="w")
        return max(d, key=d.get)

    s = nearest(a) if a is not None else far(far(nodes[0]))
    t = nearest(b) if b is not None else far(s)
    return pts[nx.shortest_path(G, s, t, weight="w")]


def chain(start, *steps, step=3.0, smooth_s=1.5):
    out = [np.asarray(start, dtype=float)]
    for st in steps:
        if isinstance(st, tuple) and st[0] == "v":
            _, fjs, end = st[0], st[1], st[2] if len(st) > 2 else None
            pitch = st[3] if len(st) > 3 else 0.8
            out.extend(centerline(fjs, out[-1], end, pitch))
        else:
            out.append(np.asarray(st, dtype=float))
    return spline(out, step=step, smooth_s=smooth_s)


def nearest_on(fjs, p):
    v = raw_group(fjs if isinstance(fjs, (list, tuple)) else [fjs]).vertices
    return v[np.argmin(np.linalg.norm(v - p, axis=1))]


log("vessel centre lines")
RA, RV = cen_c = CAV["Cavity of right atrium"].vertices.mean(0), CAV["Cavity of right ventricle"].vertices.mean(0)
LA, LV = CAV["Cavity of left atrium"].vertices.mean(0), CAV["Cavity of left ventricle"].vertices.mean(0)
IVC = [VEIN["ivc_a"], VEIN["ivc_b"]]
ivc_top = extreme(IVC, 2, 1)
AORTA = centerline([ART["asc_aorta"], ART["arch"], ART["desc_aorta"]], extreme(ART["asc_aorta"], 2, -1), extreme(ART["desc_aorta"], 2, -1), pitch=1.0)
log("  aorta", len(AORTA), "pts", AORTA[0].round(0), "->", AORTA[-1].round(0))


def arterial(branches, end=None):
    """LV -> aorta -> a chain of real branch arteries (each followed from where we enter it to its far end)."""
    first = raw_group([ART.get(branches[0], branches[0])]).vertices
    d = np.min(np.linalg.norm(AORTA[:, None, :] - first[None, ::7, :], axis=2), axis=1)
    k = int(np.argmin(d))
    steps = [LV] + list(AORTA[: k + 1])
    out = [np.asarray(p) for p in steps]
    for b in branches:
        fj = ART.get(b, b)
        out.extend(centerline(fj, out[-1], None))
    if end is not None:
        out.append(np.asarray(end))
    return spline(out, step=3.0, smooth_s=1.5)


def aorta_to(z_end, end=None):
    k = int(np.argmin(np.abs(AORTA[:, 2] - z_end) + (np.arange(len(AORTA)) < len(AORTA) // 3) * 1e4))
    out = [LV] + list(AORTA[: k + 1]) + ([end] if end is not None else [])
    return spline(out, step=3.0, smooth_s=1.5)


SIDE = {
    "left": dict(sx=1, humerus="FJ3262", radius="FJ3277", ulna="FJ3286", clavicle="FJ3237", femur="FJ3259", tibia="FJ3282", calc="FJ3256",
                 meta3="FJ3246", finger="FJ3186", axillary="FJ2216", brachial="FJ2219", radial="FJ2242", ulnar="FJ2258", femoral="FJ2074",
                 popliteal="FJ2086", ext_iliac="FJ3466", hip="FJ3288", biceps=["FJ1478M", "FJ1512M"], quad=["FJ1433M", "FJ1441M", "FJ1442M", "FJ1443M"],
                 calf=["FJ1394M", "FJ1397M"], psoas="FJ1431M", ciliary="FJ1288", submand=["FJ2766", "FJ2765"], kidney="FJ3145", adrenal="FJ3129",
                 bronchus="FJ2450", ica="FJ1682M", cca="FJ3483", ijv="FJ3485", subclavian="FJ3479", testis="FJ3138", testicular_v="FJ3533",
                 suprarenal_v="FJ3480", renal_v=["FJ3477", "FJ3478"], amygdala="FJ1753", optic="FJ1313", tract="FJ1773", rib4="FJ3231",
                 rib6="FJ3233", rib8="FJ3235", lung="lung_left", precentral="FJ1800", postcentral="FJ1797", gastroc=["FJ1394M", "FJ1397M"]),
    "right": dict(sx=-1, humerus="FJ3368", radius="FJ3349", ulna="FJ3391", clavicle="FJ3362", femur="FJ3365", tibia="FJ3387", calc="FJ3360",
                  meta3="FJ3354", finger="FJ3196", axillary="FJ2268", brachial="FJ2271", radial="FJ2294", ulnar="FJ2310", femoral="FJ2143",
                  popliteal="FJ2170", ext_iliac="FJ3567", hip="FJ3152", biceps=["FJ1478", "FJ1512"], quad=["FJ1433", "FJ1441", "FJ1442", "FJ1443"],
                  calf=["FJ1394", "FJ1397"], psoas="FJ1431", ciliary="FJ1339", submand=["FJ2768", "FJ2767"], kidney="FJ3147", adrenal="FJ3130",
                  bronchus="FJ2539", ica="FJ1682", cca="FJ3564", ijv="FJ3585", subclavian="FJ3579", testis="FJ3142", testicular_v="FJ3618",
                  suprarenal_v="FJ3580", renal_v=["FJ3577", "FJ3578"], amygdala="FJ1829", optic="FJ1364", tract="FJ1820", rib4="FJ3340",
                  rib6="FJ3344", rib8="FJ3347", lung="lung_right", precentral="FJ1801", postcentral="FJ1798", gastroc=["FJ1394", "FJ1397"]),
}

# ================================================================== diagrammatic nerve paths
log("nerve paths")
NERVES = {}


def nerve(name, kind, r, pts, note, step=5.0, smooth_s=2.0):
    p = spline(pts, step=step, smooth_s=smooth_s)
    NERVES[name] = {"kind": kind, "r": r, "pts": p, "note": note}
    return p


def cord_at(z):
    return CORD[np.argmin(np.abs(CORD[:, 2] - z))]


def cord_slice(z_from, z_to):
    i, j = np.argmin(np.abs(CORD[:, 2] - z_from)), np.argmin(np.abs(CORD[:, 2] - z_to))
    return CORD[i:j + 1] if i <= j else CORD[j:i + 1][::-1]


def vc(l):
    return V[l]["canal"]


def foramen(l, sx, out=14):
    c = vc(l)
    return np.array([c[0] + sx * out, c[1] - 4, c[2] - 6])


def bone_axis(fj, frac):
    """Point on the long axis of a long bone, frac 0 = bottom, 1 = top (slab centre)."""
    m = raw(fj)
    lo, hi = m.bounds
    return slab_centre(fj, lo[2] + frac * (hi[2] - lo[2]), half=6)


def offset(p, dx=0, dy=0, dz=0):
    return np.asarray(p) + np.array([dx, dy, dz])


sym_trunk = {}
for side, S in SIDE.items():
    sx = S["sx"]
    # ---------------- somatic: arm (brachial plexus -> median nerve), musculocutaneous to biceps
    ax_mid = slab_centre(S["axillary"], cen(S["axillary"])[2])
    br = centerline(S["brachial"], extreme(S["brachial"], 2, 1), extreme(S["brachial"], 2, -1))
    wrist = (extreme(S["radius"], 2, -1) + extreme(S["ulna"], 2, -1)) / 2
    palm = cen(S["meta3"])
    clav = cen(S["clavicle"])
    plexus = [cord_at(vc("C6")[2]), foramen("C6", sx, 16), offset(foramen("C7", sx, 40), dy=-10, dz=-6),
              offset(clav, dx=-sx * 10, dy=14, dz=-6), offset(ax_mid, dy=6)]
    arm = plexus + [offset(p, dx=-sx * 4, dy=3) for p in br[::max(1, len(br) // 8)]] + \
        [offset(br[-1], dy=-4, dz=-30), offset(wrist, dy=-14), offset(palm, dy=-10), cen(S["finger"])]
    nerve(f"arm_{side}", "som", 2.4, arm, "Brachial plexus and median nerve: from the cervical spinal cord (C6), behind the real clavicle, "
          "through the armpit beside the real axillary artery, down the arm beside the real brachial artery to the hand.")
    bic = cen(S["biceps"])
    nerve(f"biceps_{side}", "som", 1.6, [offset(ax_mid, dy=6), offset(ax_mid, dx=sx * 18, dy=-6, dz=-30), offset(bic, dy=10)],
          "Musculocutaneous nerve to the biceps (diagrammatic).")
    # ---------------- somatic: leg (sciatic -> tibial), femoral to quadriceps
    fem = raw(S["femur"]); flo, fhi = fem.bounds
    sacral = SACRUM.vertices
    s1 = sacral[(np.abs(sacral[:, 0] - sx * 28) < 8) & (sacral[:, 2] > 880)]
    s_front = s1[np.argmin(s1[:, 1])] if len(s1) else np.array([sx * 28, -60, 890])
    hip = raw(S["hip"]).vertices
    post = hip[hip[:, 1] > np.median(hip[:, 1])]
    isch = post[np.argmin(post[:, 2])]                       # ischial tuberosity (lowest point of the back of the hip bone)
    fv = fem.vertices
    troch = fv[fv[:, 2] > fhi[2] - 70][np.argmax(sx * fv[fv[:, 2] > fhi[2] - 70][:, 0])]   # greater trochanter
    exit_pt = np.array([sx * (abs(s_front[0]) + 30), s_front[1] + 40, isch[2] + 75])   # greater sciatic foramen (below piriformis)
    between = (isch + troch) / 2
    leg = [vc("L5") + np.array([sx * 6, 0, 0]), offset(s_front, dx=sx * 8, dy=-6), exit_pt, offset(between, dy=18, dz=10),
           offset(bone_axis(S["femur"], 0.85), dx=sx * 4, dy=32), offset(bone_axis(S["femur"], 0.55), dy=30),
           offset(bone_axis(S["femur"], 0.25), dy=28), offset(cen(S["popliteal"]), dy=8),
           offset(bone_axis(S["tibia"], 0.7), dx=-sx * 6, dy=30), offset(bone_axis(S["tibia"], 0.35), dx=-sx * 8, dy=24),
           offset(bone_axis(S["tibia"], 0.06), dx=-sx * 16, dy=18), offset(cen(S["calc"]), dx=-sx * 6, dy=-40, dz=-10)]
    nerve(f"leg_{side}", "som", 3.0, leg, "Sacral plexus and sciatic/tibial nerve: from the lower spinal nerves, in front of the real sacrum, "
          "out through the real greater sciatic notch, down behind the real femur and tibia to the sole of the foot.")
    fa = centerline(S["femoral"], extreme(S["femoral"], 2, 1), extreme(S["femoral"], 2, -1))
    quad = cen(S["quad"])
    femn = [vc("L3") + np.array([sx * 8, 0, 0]), offset(cen(S["psoas"]), dy=-4), offset(fa[0], dx=sx * 14, dy=-2),
            offset(fa[len(fa) // 6], dx=sx * 16, dy=-6), offset(quad, dy=-6)]
    nerve(f"femoral_{side}", "som", 2.0, femn, "Femoral nerve: from the lumbar spinal nerves, through the real psoas muscle, "
          "next to the real femoral artery into the quadriceps (diagrammatic).")
    # ---------------- somatic: three intercostal nerves following the real ribs
    for rib, lvl in (("rib4", "T4"), ("rib6", "T6"), ("rib8", "T8")):
        rv = raw(S[rib]).vertices
        ang = np.arctan2(-(rv[:, 1] - rv[:, 1].mean()), sx * rv[:, 0])
        bins = np.linspace(np.percentile(ang, 1), np.percentile(ang, 99), 14)
        pts = [cord_at(vc(lvl)[2]), foramen(lvl, sx, 14)]
        for a0, a1 in zip(bins[:-1], bins[1:]):
            sel = rv[(ang >= a0) & (ang < a1)]
            if len(sel) > 5:
                pts.append(offset(sel.mean(0), dz=-4))
        nerve(f"intercostal_{lvl}_{side}", "som", 1.2, pts, f"Intercostal nerve {lvl}: follows the lower edge of the real rib (diagrammatic).")

    # ---------------- autonomic: sympathetic trunk along the real vertebrae
    tr = []
    for l in LEVELS[1:]:
        v = V[l]; c = v["canal"]
        if l[0] == "C":
            p = np.array([c[0] + sx * (v["half"] + 9), v["front"] + 0.55 * (v["back"] - v["front"]), c[2]])
        elif l[0] == "T":
            p = np.array([c[0] + sx * (v["half"] + 5), v["back"] + 1, c[2]])
        else:
            p = np.array([c[0] + sx * (v["half"] - 1), v["front"] + 0.3 * (v["back"] - v["front"]), c[2]])
        tr.append(p)
    sv = SACRUM.vertices
    for zf, xo in ((0.8, 24), (0.55, 18), (0.3, 11)):
        z = sv[:, 2].min() + zf * (sv[:, 2].max() - sv[:, 2].min())
        band = sv[(np.abs(sv[:, 2] - z) < 6) & (np.abs(sv[:, 0] - sx * xo) < 6)]
        if len(band):
            tr.append(offset(band[np.argmin(band[:, 1])], dy=-3))
    tr.append(np.array([0.0, sv[np.argmin(sv[:, 2]), 1] - 8, sv[:, 2].min() - 6]))
    sym_trunk[side] = nerve(f"symtrunk_{side}", "sym", 2.0, tr, "Sympathetic trunk: a chain of ganglia running beside the real vertebrae "
                            "from the neck to the coccyx (diagrammatic position).", smooth_s=4.0)

    def trunk_at(z):
        t = sym_trunk[side]
        return t[np.argmin(np.abs(t[:, 2] - z))]

    S["trunk_at"] = trunk_at
    # white rami: spinal cord -> trunk (sympathetic outflow T1-L2 only)
    for l in ("T1", "T3", "T5", "T7", "T9", "T11", "L1"):
        nerve(f"ramus_{l}_{side}", "sym", 1.0, [cord_at(vc(l)[2]), foramen(l, sx, 12), trunk_at(vc(l)[2] - 4)],
              "Sympathetic nerve fibres leave the middle (thoracic and upper lumbar) spinal cord and join the trunk (diagrammatic).")

# ---------------- organ landmarks for nerve endings
HEART_C = cen(heart_els)
trachea_bottom = extreme(["FJ2541"], 2, -1)
arch_low = AORTA[np.argmax(AORTA[:, 2])]
CARDIAC_PLEXUS = (trachea_bottom + arch_low) / 2 + np.array([0, -8, -10])
celiac_origin = extreme(ART["celiac"], 1, 1)
STOMACH_C = cen("FJ2564")
PORTA = extreme(VEIN["portal"], 2, 1)
SI_C = cen(compound("small intestine"))
BLADDER_C = cen("FJ3149")
RECTUM = by_name(lambda n: n == "Rectum")
H_C = cen(HYPOTHALAMUS)
MID_C, PONS_C = cen(["FJ1770", "FJ1817"]), cen(["FJ1775", "FJ1822"])
MED_C = cen(MEDULLA)
BRAIN_DOWN = [H_C, offset(MID_C, dy=-4), PONS_C, offset(MED_C, dz=-6), cord_top]
sma_mid = cen(ART["sma"])

for side, S in SIDE.items():
    sx = S["sx"]
    trunk_at = S["trunk_at"]
    cg = celiac_origin + np.array([sx * 14, -2, -4])
    S["celiac_ganglion"] = cg
    eye_c = cen(compound(f"{side} eyeball"))
    S["eye_c"] = eye_c
    ica = centerline(S["ica"], extreme(S["ica"], 2, -1), extreme(S["ica"], 2, 1))
    scg = trunk_at(vc("C2")[2])
    nerve(f"sym_eye_{side}", "sym", 1.1, [scg] + [offset(p, dx=sx * 3, dy=4) for p in ica[::max(1, len(ica) // 6)]] +
          [cen(S["ciliary"]), offset(eye_c, dy=9)], "Sympathetic fibres to the eye: from the top ganglion of the trunk, along the real internal carotid artery (diagrammatic).")
    sal = cen(S["submand"])
    nerve(f"sym_salivary_{side}", "sym", 1.0, [scg, offset(scg, dy=-14, dz=-6), offset(sal, dy=12, dz=4), sal], "Sympathetic fibres to the salivary glands (diagrammatic).")
    nerve(f"sym_heart_{side}", "sym", 1.2, [trunk_at(vc("C6")[2]), offset(trunk_at(vc("T1")[2]), dx=-sx * 10, dy=-14), CARDIAC_PLEXUS + np.array([sx * 6, 0, 0]),
                                             offset(HEART_C, dx=sx * 10, dy=-10)], "Cardiac nerves from the neck ganglia to the heart (diagrammatic).")
    hil = cen(S["bronchus"])
    nerve(f"sym_lung_{side}", "sym", 1.1, [trunk_at(vc("T3")[2]), offset(trunk_at(vc("T3")[2]), dx=sx * 4, dy=-14, dz=-10), hil,
                                            offset(hil, dx=sx * 40, dz=-10)], "Sympathetic fibres to the lung (diagrammatic).")
    spl = [trunk_at(vc("T6")[2]), offset(trunk_at(vc("T8")[2]), dx=-sx * 5, dy=-8),
           np.array([vc("T10")[0] + sx * (V["T10"]["half"] - 2), V["T10"]["front"] + 4, vc("T10")[2]]),
           np.array([vc("T12")[0] + sx * (V["T12"]["half"] - 4), V["T12"]["front"] - 2, vc("T12")[2]]), cg]
    nerve(f"splanchnic_{side}", "sym", 1.4, spl, "Greater splanchnic nerve: from the thoracic trunk down to the coeliac ganglion beside the real coeliac trunk (diagrammatic).")
    ad_c = cen(S["adrenal"])
    ad_med = NODES[f"adrenal_medulla_{side}"].centroid
    ad_med_bp = np.array([ad_med[0], -ad_med[2], ad_med[1]])
    nerve(f"sym_adrenal_{side}", "sym", 1.2, [trunk_at(vc("T10")[2]), offset(trunk_at(vc("T11")[2]), dx=-sx * 3, dy=-10),
                                               offset(cg, dx=sx * 10, dz=6), offset(ad_c, dx=-sx * 8, dz=-4), ad_med_bp],
          "Splanchnic fibres to the adrenal medulla (they reach it directly, without a relay) (diagrammatic).")
    nerve(f"sym_bladder_{side}", "sym", 1.0, [trunk_at(vc("L1")[2]), offset(trunk_at(vc("L3")[2]), dx=-sx * 8, dy=-12),
                                               np.array([sx * 6, V["L5"]["front"] - 8, vc("L5")[2] - 10]), offset(BLADDER_C, dx=sx * 20, dy=10, dz=10), BLADDER_C],
          "Sympathetic fibres to the bladder via the hypogastric nerves (diagrammatic).")

    # ---------------- parasympathetic: vagus (cranial nerve X)
    mv = med_v[np.abs(med_v[:, 2] - 1482) < 4]
    olive = mv[np.argmax(sx * mv[:, 0])]
    jf = np.array([sx * 30, olive[1] - 14, vc("C1")[2] + 8])
    ica_s = slab_centre(S["ica"], 1440)
    cca_s = slab_centre(S["cca"], 1355)
    ijv_s = slab_centre(S["ijv"], 1355)
    neck1 = np.array([ica_s[0] + sx * 7, ica_s[1] + 9, 1440])
    neck2 = np.array([(cca_s[0] + ijv_s[0]) / 2, max(cca_s[1], ijv_s[1]) + 5, 1355])
    es = lambda z: slab_centre("FJ2563", z)
    if side == "right":
        sub = slab_centre(S["subclavian"], cen(S["subclavian"])[2])
        thor = [np.array([sub[0] * 0.55, sub[1] - 7, sub[2] + 4]), np.array([trachea_at(1300)[0][0] - trachea_at(1300)[1][0] - 6, trachea_at(1300)[0][1] + 4, 1300]),
                offset(hil, dx=10, dy=16), offset(es(1210), dx=-6, dy=9), offset(es(1160), dx=-3, dy=10),
                offset(es(1125), dy=10), offset(STOMACH_C, dx=-20, dy=24, dz=10)]
    else:
        sub = slab_centre(S["subclavian"], 1330)
        arch_l = AORTA[np.argmax(AORTA[:, 0] * (AORTA[:, 2] > 1270))]
        thor = [np.array([(cca_s[0] + sub[0]) / 2, (cca_s[1] + sub[1]) / 2, 1330]), offset(arch_l, dx=12, dy=-4),
                offset(hil, dx=-8, dy=16), offset(es(1210), dx=4, dy=-9), offset(es(1160), dx=3, dy=-10),
                offset(es(1125), dy=-10), offset(STOMACH_C, dx=-12, dy=-30, dz=24)]
    vag = nerve(f"vagus_{side}", "para", 1.8, [olive, jf, neck1, neck2] + thor,
                "Vagus nerve: from the real medulla oblongata, down the neck between the real carotid artery and jugular vein, "
                "behind the real lung root, along the real oesophagus to the stomach (diagrammatic).", smooth_s=3.0)
    S["vagus"] = vag

    def vag_at(z, vag=vag):
        return vag[np.argmin(np.abs(vag[:, 2] - z))]

    S["vag_at"] = vag_at
    nerve(f"vagus_heart_{side}", "para", 1.1, [vag_at(1320), CARDIAC_PLEXUS + np.array([-sx * 4, 0, 4]), offset(HEART_C, dx=-sx * 4, dy=-14, dz=8)],
          "Cardiac branches of the vagus (diagrammatic).")
    nerve(f"vagus_lung_{side}", "para", 1.0, [vag_at(hil[2] + 4), hil, offset(hil, dx=sx * 34, dz=6)], "Pulmonary branches of the vagus (diagrammatic).")
    # oculomotor (III) -> real ciliary ganglion -> eye
    nerve(f"para_eye_{side}", "para", 1.0, [offset(MID_C, dx=sx * 4, dy=-10), np.array([sx * 12, MID_C[1] - 26, MID_C[2] - 6]),
                                             cen(S["ciliary"]), offset(eye_c, dy=9)],
          "Oculomotor nerve (cranial nerve III) to the real ciliary ganglion and the eye (diagrammatic up to the ganglion).")
    nerve(f"para_salivary_{side}", "para", 1.0, [np.array([sx * 12, PONS_C[1] - 6, PONS_C[2] - 18]), np.array([sx * 42, PONS_C[1] - 26, PONS_C[2] - 26]),
                                                  offset(sal, dy=16, dz=14), sal], "Facial nerve (chorda tympani) fibres to the submandibular and sublingual glands (diagrammatic).")
    sac = SACRUM.vertices
    s3 = sac[(np.abs(sac[:, 2] - 830) < 7) & (np.abs(sac[:, 0] - sx * 20) < 6)]
    s3f = s3[np.argmin(s3[:, 1])] if len(s3) else np.array([sx * 20, -50, 830])
    sacral_canal = np.array([0, sac[(np.abs(sac[:, 0]) < 4) & (np.abs(sac[:, 2] - 860) < 6)][:, 1].mean() if True else -20, 860])
    nerve(f"pelvic_{side}", "para", 1.2, [conus_end, vc("L3"), vc("L5"), sacral_canal, offset(s3f, dy=-4), offset(BLADDER_C, dx=sx * 26, dy=14, dz=-6), BLADDER_C],
          "Pelvic splanchnic nerves: parasympathetic fibres from the lowest part of the spinal cord, leaving through the real sacrum to the bladder (diagrammatic).")

# vagal branches to the abdomen (single paths)
nerve("vagus_liver", "para", 1.0, [SIDE["left"]["vag_at"](1135), offset(PORTA, dx=10, dy=-6, dz=12), PORTA], "Hepatic branch of the vagus (diagrammatic).")
nerve("vagus_gut", "para", 1.0, [SIDE["right"]["vag_at"](1125), SIDE["right"]["celiac_ganglion"], offset(sma_mid, dy=-6), SI_C],
      "Vagal fibres to the intestines, via the coeliac plexus and along the real superior mesenteric artery (diagrammatic).")
nerve("sym_gut", "sym", 1.0, [SIDE["left"]["celiac_ganglion"], offset(sma_mid, dx=8, dy=-2), offset(SI_C, dx=12)],
      "Sympathetic fibres from the coeliac ganglion to the intestines (diagrammatic).")
nerve("sym_stomach", "sym", 1.0, [SIDE["left"]["celiac_ganglion"], offset(STOMACH_C, dx=-10, dy=20, dz=-10), STOMACH_C], "Sympathetic fibres to the stomach (diagrammatic).")
nerve("sym_liver", "sym", 1.0, [SIDE["right"]["celiac_ganglion"], offset(PORTA, dx=-6, dy=4), PORTA], "Sympathetic fibres to the liver (diagrammatic).")
for k, dx in enumerate((-2.2, 2.2, -0.8, 0.8)):
    nerve(f"cauda_{k}", "som", 0.7, [offset(conus_end, dx=dx * 0.3, dz=4), offset(vc("L2"), dx=dx), offset(vc("L3"), dx=dx), offset(vc("L4"), dx=dx * 1.2),
                                     offset(vc("L5"), dx=dx * 1.4), offset(sacral_canal, dx=dx * 1.6)],
          "Cauda equina: spinal nerve roots below the end of the spinal cord (diagrammatic).")
log("  nerves:", len(NERVES))

# ================================================================== signal routes (for animated pulses)
log("signal routes")
ROUTES = {}


def route(name, parts, kind, step=6.0, smooth_s=1.0):
    pts = []
    for p in parts:
        p = np.asarray(p, dtype=float)
        pts.extend(p if p.ndim == 2 else [p])
    ROUTES[name] = {"kind": kind, "pts": spline(pts, step=step, smooth_s=smooth_s)}
    return ROUTES[name]["pts"]


def seg(path, z_from=None, z_to=None, from_pt=None, to_pt=None):
    path = np.asarray(path)
    i = int(np.argmin(np.linalg.norm(path - from_pt, axis=1))) if from_pt is not None else (int(np.argmin(np.abs(path[:, 2] - z_from))) if z_from is not None else 0)
    j = int(np.argmin(np.linalg.norm(path - to_pt, axis=1))) if to_pt is not None else (int(np.argmin(np.abs(path[:, 2] - z_to))) if z_to is not None else len(path) - 1)
    return path[i:j + 1] if i <= j else path[j:i + 1][::-1]


N = lambda n: NERVES[n]["pts"]
route("cns_down", [BRAIN_DOWN, CORD], "cns")
for side, S in SIDE.items():
    sx = S["sx"]
    oth = "right" if side == "left" else "left"
    tr = N(f"symtrunk_{side}")

    def sym_via(level, branch, trunk_to_z=None):
        rz = vc(level)[2]
        bz = N(branch)[0][2] if trunk_to_z is None else trunk_to_z
        return [BRAIN_DOWN, cord_slice(cord_top[2], rz), N(f"ramus_{level}_{side}"), seg(tr, rz - 4, bz), N(branch)]

    route(f"sym_eye_{side}", sym_via("T1", f"sym_eye_{side}"), "sym")
    route(f"sym_salivary_{side}", sym_via("T1", f"sym_salivary_{side}"), "sym")
    route(f"sym_heart_{side}", sym_via("T1", f"sym_heart_{side}"), "sym")
    route(f"sym_lung_{side}", sym_via("T3", f"sym_lung_{side}"), "sym")
    route(f"sym_splanchnic_{side}", sym_via("T5", f"splanchnic_{side}"), "sym")
    route(f"sym_adrenal_{side}", sym_via("T9", f"sym_adrenal_{side}"), "sym")
    route(f"sym_bladder_{side}", sym_via("L1", f"sym_bladder_{side}"), "sym")
    vag = N(f"vagus_{side}")
    route(f"vagus_{side}", [H_C, offset(MID_C, dy=-4), PONS_C, vag], "para")
    route(f"vagus_heart_{side}", [H_C, offset(MID_C, dy=-4), PONS_C, seg(vag, to_pt=N(f"vagus_heart_{side}")[0]), N(f"vagus_heart_{side}")], "para")
    route(f"vagus_lung_{side}", [H_C, offset(MID_C, dy=-4), PONS_C, seg(vag, to_pt=N(f"vagus_lung_{side}")[0]), N(f"vagus_lung_{side}")], "para")
    route(f"para_eye_{side}", [H_C, N(f"para_eye_{side}")], "para")
    route(f"para_salivary_{side}", [H_C, offset(MID_C, dy=-4), N(f"para_salivary_{side}")], "para")
    route(f"pelvic_{side}", [BRAIN_DOWN, CORD, N(f"pelvic_{side}")], "para")
    # somatic: motor (opposite motor cortex -> crosses in the medulla -> cord -> arm -> biceps); sensory (hand -> cord -> opposite cortex)
    pc = cen(SIDE[oth]["precentral"]); poc = cen(SIDE[oth]["postcentral"])
    th = cen(["FJ1782"] if oth == "left" else ["FJ1827"])
    arm = N(f"arm_{side}")
    bic = N(f"biceps_{side}")
    k_ax = int(np.argmin(np.linalg.norm(arm - bic[0], axis=1)))
    route(f"motor_arm_{side}", [offset(pc, dz=20), offset(th, dx=-sx * 6, dz=4), MID_C + np.array([-sx * 4, 0, 0]), PONS_C, MED_C,
                                cord_slice(cord_top[2], vc("C6")[2]), arm[:k_ax + 1], bic], "som")
    route(f"sensory_arm_{side}", [arm[::-1], cord_slice(vc("C6")[2], cord_top[2]), MED_C, PONS_C, th, offset(poc, dz=20)], "som")
    leg = N(f"leg_{side}")
    route(f"motor_leg_{side}", [offset(pc, dx=sx * 10, dz=26), th, MID_C, PONS_C, MED_C, CORD, leg], "som")
    route(f"sensory_leg_{side}", [leg[::-1], CORD[::-1], MED_C, PONS_C, th, offset(poc, dz=24)], "som")
    route(f"motor_thigh_{side}", [offset(pc, dx=sx * 10, dz=26), th, MID_C, PONS_C, MED_C, cord_slice(cord_top[2], vc("L1")[2]), N(f"femoral_{side}")], "som")
    # vision -> amygdala (eye -> optic nerve -> chiasm -> optic tract -> thalamus -> amygdala)
    on = raw(S["optic"]).vertices
    on_front = on[np.argmin(on[:, 1])]; on_back = on[np.argmax(on[:, 1])]
    chi = cen(["FJ1771", "FJ1818"])
    tv_ = raw(S["tract"]).vertices
    tract_end = tv_[np.argmax(tv_[:, 1])]
    amy = cen(S["amygdala"])
    route(f"see_{side}", [offset(S["eye_c"], dy=6), on_front, on_back, chi, offset(chi, dx=sx * 6, dy=6), tract_end,
                          offset(cen(["FJ1782"] if side == "left" else ["FJ1827"]), dx=sx * 6, dy=10, dz=-6), offset(amy, dz=6), amy], "cns", step=2.0, smooth_s=0.5)
    route(f"amyg_hypo_{side}", [amy, offset(amy, dx=-sx * 6, dy=-4, dz=8), offset(H_C, dx=sx * 4, dz=4), H_C], "cns", step=1.5, smooth_s=0.2)
pit = cen("FJ1796")
route("hypo_pit", [H_C, offset(H_C, dz=-6), offset(pit, dz=4), pit], "cns", step=1.0, smooth_s=0.1)

# ================================================================== blood routes (along real vessel centre lines)
log("blood routes")
BLOOD = {}


def flat(parts):
    pts = []
    for p in parts:
        p = np.asarray(p, dtype=float)
        pts.extend(p if p.ndim == 2 else [p])
    return pts


def blood(name, pts, kind, step=6.0):
    BLOOD[name] = {"kind": kind, "pts": spline(flat(pts), step=step, smooth_s=1.0)}


rl = NODES["lung_right"].centroid
rl_bp = np.array([rl[0], -rl[2], rl[1]])
pt = centerline(ART["pulm_trunk"], RV, None)
rpa = centerline(ART["r_pulm_art"], pt[-1], None)
rspv = centerline(VEIN["r_sup_pulm_v"], None, LA)
blood("heart_lungs", [RA, RV, pt, rpa, offset(rl_bp, dx=10), rspv[::-1] if np.linalg.norm(rspv[0] - LA) < np.linalg.norm(rspv[-1] - LA) else rspv, LA, LV], "lungs")
ivc_cl = centerline(IVC, extreme(IVC, 2, -1), ivc_top, pitch=1.2)
svc_cl = centerline(VEIN["svc"], extreme(VEIN["svc"], 2, 1), extreme(VEIN["svc"], 2, -1), pitch=1.0)


def up_ivc(p):
    return [seg(ivc_cl, from_pt=p), RA]


for side, S in SIDE.items():
    ad = cen(S["adrenal"])
    sv_ = centerline(S["suprarenal_v"], ad, None)
    if side == "left":
        rv_ = centerline(S["renal_v"], sv_[-1], nearest_on(IVC, sv_[-1]))
        blood(f"v_adrenal_{side}", [ad, sv_, rv_] + up_ivc(rv_[-1]), "vein")
    else:
        blood(f"v_adrenal_{side}", [ad, sv_] + up_ivc(sv_[-1]), "vein")
    te = cen(S["testis"])
    tvn = centerline(S["testicular_v"], te, None, pitch=1.0)
    if side == "left":
        rv_ = centerline(S["renal_v"], tvn[-1], nearest_on(IVC, tvn[-1]))
        blood(f"v_testis_{side}", [te, tvn, rv_] + up_ivc(rv_[-1]), "vein")
    else:
        blood(f"v_testis_{side}", [te, tvn] + up_ivc(tvn[-1]), "vein")
ijv = centerline(VEIN["r_ijv"], extreme(VEIN["r_ijv"], 2, 1), extreme(VEIN["r_ijv"], 2, -1))
rbv = centerline(VEIN["r_brachioceph_v"], ijv[-1], extreme(VEIN["r_brachioceph_v"], 2, -1))
blood("v_pituitary", [pit, offset(pit, dx=-14, dz=-4), np.array([-30, pit[1] + 24, 1478]), ijv, rbv, seg(svc_cl, from_pt=rbv[-1]), RA], "vein")
thy_c = NODES["thyroid"].centroid
thy_bp = np.array([thy_c[0], -thy_c[2], thy_c[1]]) + np.array([0, 0, -12])
lbv = centerline(VEIN["l_brachioceph_v"], nearest_on(VEIN["l_brachioceph_v"], thy_bp), extreme(VEIN["l_brachioceph_v"], 0, -1))
blood("v_thyroid", [thy_bp, offset(thy_bp, dz=-20), lbv, seg(svc_cl, from_pt=lbv[-1]), RA], "vein")
pan = cen(panc)
spv = centerline(VEIN["splenic_v"], nearest_on(VEIN["splenic_v"], pan), nearest_on(VEIN["splenic_v"], cen(VEIN["portal"])))
por = centerline(VEIN["portal"], spv[-1], PORTA)
LIVER_C = cen(liver_els)
blood("v_pancreas_liver", [pan, spv, por, offset(PORTA, dx=-20, dz=10), LIVER_C], "portal")
rhv = centerline(VEIN["r_hepatic_v"], None, nearest_on(IVC, cen(VEIN["r_hepatic_v"])))
blood("v_liver", [LIVER_C, rhv] + up_ivc(rhv[-1]), "vein")

ARTERIAL = {
    "a_head_right": (["brachiocephalic", "r_cca", "r_ica"], None), "a_head_left": (["l_cca", "l_ica"], None),
    "a_arm_right": (["brachiocephalic", "r_subclavian", "r_axillary", "r_brachial", "r_radial"], None),
    "a_arm_left": (["l_subclavian", "l_axillary", "l_brachial", "l_radial"], None),
    "a_leg_right": (["r_common_iliac", "r_ext_iliac", "r_femoral", "r_popliteal"], None),
    "a_leg_left": (["l_common_iliac", "l_ext_iliac", "l_femoral", "l_popliteal"], None),
    "a_kidney_right": (["r_renal"], cen("FJ3147")), "a_kidney_left": (["l_renal"], cen("FJ3145")),
    "a_gut": (["sma"], SI_C), "a_liver": (["celiac", "FJ3078", "FJ3081"], LIVER_C),
    "a_thigh_right": (["r_common_iliac", "r_ext_iliac", "r_femoral"], cen(SIDE["right"]["quad"])),
    "a_thigh_left": (["l_common_iliac", "l_ext_iliac", "l_femoral"], cen(SIDE["left"]["quad"])),
    "a_biceps_right": (["brachiocephalic", "r_subclavian", "r_axillary", "r_brachial"], cen(SIDE["right"]["biceps"])),
    "a_biceps_left": (["l_subclavian", "l_axillary", "l_brachial"], cen(SIDE["left"]["biceps"])),
}
for name, (br_, end) in ARTERIAL.items():
    pts = arterial(br_, end)
    if name.startswith(("a_thigh", "a_biceps")):
        # stop where the artery comes closest to the muscle, then go into it
        k = int(np.argmin(np.linalg.norm(pts[: -1] - end, axis=1)))
        pts = np.vstack([pts[: k + 1], [end]])
    blood(name, pts, "artery")
thy_l = thy_bp + np.array([20, 0, 14]); thy_r = thy_bp + np.array([-20, 0, 14])
for nm, br_, end in (("a_thyroid_left", ["l_cca"], thy_l), ("a_thyroid_right", ["brachiocephalic", "r_cca"], thy_r)):
    pts = arterial(br_)
    k = int(np.argmin(np.abs(pts[:, 2] - (end[2] + 30)) + (pts[:, 2] < end[2]) * 1e3))
    blood(nm, [pts[: k + 1], offset(end, dy=-6, dz=12), end], "artery")
for side, S in SIDE.items():
    ad = cen(S["adrenal"])
    blood(f"a_adrenal_{side}", list(aorta_to(ad[2] - 6)) + [offset(ad, dx=-S["sx"] * 14, dz=-6), ad], "artery")
    ta = by_name(lambda n, side=side: n == f"{side.capitalize()} testicular artery")
    blood(f"a_testis_{side}", [arterial(ta, cen(S["testis"]))], "artery")
lco = by_name(lambda n: n == "Trunk of left coronary artery")
blood("a_heart", [LV] + list(AORTA[:6]) + list(centerline(lco, AORTA[3], None)) + [offset(HEART_C, dx=10, dy=-24, dz=-20)], "artery")
blood("a_stomach", list(aorta_to(celiac_origin[2], celiac_origin)) + [offset(celiac_origin, dx=12, dy=-14, dz=8), STOMACH_C], "artery")
log("  blood routes:", len(BLOOD))

# ================================================================== anchors (label points)
ANCH = {
    "cardiac_plexus": CARDIAC_PLEXUS, "celiac_ganglion": celiac_origin + np.array([0, -4, -6]),
    "hand_right": cen(SIDE["right"]["finger"]), "hand_left": cen(SIDE["left"]["finger"]),
    "foot_right": cen(SIDE["right"]["calc"]), "foot_left": cen(SIDE["left"]["calc"]),
    "mouth": (cen(SIDE["left"]["submand"]) + cen(SIDE["right"]["submand"])) / 2 + np.array([0, -18, 6]),
    "right_atrium": RA, "left_ventricle": LV, "aortic_arch": arch_low,
    "forehead_skin": extreme("FJ2810", 1, -1) * 0 + np.array([0, extreme("FJ2810", 1, -1)[1], 1590]),
    # Ovaries are NOT in this male model. Typical position (lateral pelvic wall, level of the pelvic inlet), for a text marker only.
    "ovary_position_left": np.array([55.0, -70.0, 870.0]), "ovary_position_right": np.array([-55.0, -70.0, 870.0]),
}
fs = raw("FJ2810").vertices
band = fs[(np.abs(fs[:, 2] - 1585) < 6) & (np.abs(fs[:, 0]) < 8)]
ANCH["forehead_skin"] = band[np.argmin(band[:, 1])]
arm_skin = fs[(np.abs(fs[:, 2] - 1150) < 8) & (fs[:, 0] < -150)]
ANCH["arm_skin_right"] = arm_skin[np.argmin(arm_skin[:, 1])] if len(arm_skin) else np.array([-190, -100, 1150])
for side, S in SIDE.items():
    ANCH[f"eye_{side}"] = S["eye_c"]
    ANCH[f"vagus_neck_{side}"] = S["vag_at"](1380)
    ANCH[f"symtrunk_{side}"] = S["trunk_at"](vc("T6")[2])
    ANCH[f"celiac_ganglion_{side}"] = S["celiac_ganglion"]


def to_json_paths(d, extra=()):
    out = {}
    for k, v in d.items():
        e = {kk: vv for kk, vv in v.items() if kk not in ("pts",) + tuple(extra)}
        e["pts"] = r1(to_gltf(v["pts"]))
        out[k] = e
    return out


nerves_json = to_json_paths(NERVES, extra=("note",))
routes_json = to_json_paths(ROUTES)
routes_json.update(to_json_paths(BLOOD))
anchors_json = {k: r1(to_gltf(v)) for k, v in ANCH.items()}
export(paths=nerves_json, routes=routes_json, anchors=anchors_json)
json_prov = json.load(open(OUT_PROV))
json_prov["diagrammatic_paths"] = {k: v["note"] for k, v in NERVES.items()}
json_prov["animation_routes"] = "Signal and blood routes for the animations follow these nerve paths and the centre lines of the real BodyParts3D vessels (found by 3D skeletonisation). Straight links join vessels where BodyParts3D has no mesh (for example the venous sinuses of the skull, the small thyroid veins and the lung capillaries)."
json.dump(json_prov, open(OUT_PROV, "w"), indent=1)
log("done")
