// Copies MediaPipe's WASM runtime into public/ and downloads the face model once,
// so the webcam feature runs entirely from this site (no third-party requests at runtime).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
const out = 'public/mediapipe';
mkdirSync(`${out}/wasm`, { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/wasm', `${out}/wasm`, { recursive: true });
const model = `${out}/face_landmarker.task`;
if (!existsSync(model)) {
  const url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  writeFileSync(model, Buffer.from(await res.arrayBuffer()));
}
console.log('MediaPipe assets ready in', out);
