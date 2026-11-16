import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/700.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import './styles.css';
import { initSettings } from './settings.js';
import { initSpeech, stop as stopSpeech } from './speech.js';

const routes = {
  '': () => import('./pages/home.js'),
  explore: () => import('./pages/explore.js'),
  xray: () => import('./pages/xray.js'),
  learn: () => import('./pages/learn.js'),
  lesson: () => import('./pages/lesson.js'),
  words: () => import('./pages/words.js'),
  sources: () => import('./pages/sources.js'),
};

let cleanup = null;
let routeToken = 0;
const main = document.getElementById('main');

async function route() {
  const [, name = '', ...rest] = (location.hash || '#/').slice(1).split('/');
  const load = routes[name] || routes[''];
  stopSpeech();
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  document.querySelectorAll('.topnav a').forEach((a) => {
    const target = a.getAttribute('href').slice(2);
    if (target === name || (target === 'learn' && name === 'lesson')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  main.innerHTML = '';
  const token = ++routeToken;
  const mod = await load();
  if (token !== routeToken) return;              // the learner moved on while this page was loading
  const done = (await mod.render(main, rest)) || null;
  if (token !== routeToken) { try { done?.(); } catch (e) { console.error(e); } return; } // stale page: tidy up its 3D
  cleanup = done;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

initSettings();
initSpeech();
window.addEventListener('hashchange', route);
route();
