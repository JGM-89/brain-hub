# Brain Hub

An SEN-friendly, interactive biopsychology hub for A-level Psychology (AQA 7182, spec v1.4).

It has four parts:

- **Explore:** a real 3D brain built from published brain-scan atlases.
- **X-ray me:** the same brain anchored to your head through the webcam, with an equivalent model-head option for anyone who doesn't want to use a camera.
- **Lessons:** nine step-by-step lessons covering the whole Biopsychology section.
- **Key words:** every key term in one place.

## Run it

```bash
cd web
npm install
npm run mediapipe   # once: copies the face-tracking runtime and model into public/
npm run dev         # http://localhost:5180
```

`npm run build` makes a static site in `web/dist/`. You can host it anywhere static: GitHub Pages, Netlify, or a school web server. The webcam feature needs **https** or **localhost**.

## Rebuild the 3D brain (only if you change the anatomy)

```bash
cd tools
py -3.10 -m venv .venv && .venv\Scripts\python -m pip install nilearn trimesh scikit-image scipy fast-simplification mne
.venv\Scripts\python build_brain.py   # writes tools/brain_raw.glb + web/src/data/*.json
cd ../web && npm run models            # compresses into web/public/models/brain.glb
```

Data sources and licences are listed on the site's **Sources** page (`web/src/pages/sources.js`). Source data lives in `tools/data/`. nilearn caches its own downloads in `~/nilearn_data`.

## Where things are

| Path | What it is |
|---|---|
| `web/src/data/structures.js` | Every brain part: plain-English and exam text, AQA links, and data source |
| `web/src/lessons/*.js` | One file per lesson (see `README-lessons.md`) |
| `web/src/brain/viewer.js` | The 3D viewer, shared by every page |
| `web/src/brain/pathway.js` | Eyes and visual pathway overlay |
| `web/src/pages/xray.js` | Webcam mode. Runs on-device only and never records |
| `web/src/settings.js` | Reading settings: font, size, spacing, colours, overlay, calm mode, read-aloud |
| `docs/curriculum-notes.md` | Spec wording, terminology, misconceptions and SEN design rules |

## Hosting

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/pages.yml`). Raw atlas data in `tools/data/` isn't committed: it's third-party data. See the Sources page for where each file comes from.
