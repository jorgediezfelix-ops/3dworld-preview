// Entry point of herramientas.html: shows one tool at a time (#visor, #cotizador…), loads each tool's
// code the first time it opens, and takes files from any upload control or a drop anywhere on the page.
import { $, $$, fmt, store } from './shared.mjs';

const root = $('[data-tools]');
const tools = $$('[data-tool]', root);
const links = $$('[data-tool-link]', root);
const FILE_TOOLS = new Set(['visor', 'analizador', 'cotizador', 'calculadora', 'lotes']);
const MODULES = {
  file: () => import('./ui-file.mjs'),
  materials: () => import('./ui-materials.mjs'),
  design: () => import('./ui-design.mjs'),
};
const OWNER = { visor: 'file', analizador: 'file', cotizador: 'file', calculadora: 'file', lotes: 'file',
  selector: 'materials', comparador: 'materials', tecnologias: 'materials',
  tolerancias: 'design', resistencia: 'design', conversor: 'design' };
const started = new Map();
let active = null;

root.classList.add('tools-ready');

async function open(id, { scroll = false } = {}) {
  if (!OWNER[id]) id = 'visor';
  active = id;
  for (const t of tools) t.hidden = t.id !== id;
  for (const a of links) {
    if (a.dataset.toolLink === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  // On phones the list is a horizontal strip: bring the open tool into view.
  const nav = $('.tools-nav', root), current = links.find(a => a.dataset.toolLink === id);
  if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: current.offsetLeft - nav.clientWidth / 2 + current.offsetWidth / 2 });
  const section = $(`#${id}`);
  if (scroll) {
    const stage = $('.tools-stage', root);
    if (stage.getBoundingClientRect().top < 0 || stage.getBoundingClientRect().top > innerHeight * 0.6) stage.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  if (!started.has(id)) {
    started.set(id, MODULES[OWNER[id]]().then(m => m[id](section)).catch(error => {
      started.delete(id);
      console.error(error);
      const note = document.createElement('p');
      note.className = 'tool-error';
      note.textContent = 'Esta herramienta no pudo cargarse. Revisa tu conexión y recarga la página.';
      section.append(note);
    }));
  }
  const tool = await started.get(id);
  if (active === id) tool?.show?.();
}

root.addEventListener('click', event => {
  const a = event.target.closest('a[href^="#"]');
  const id = a && a.getAttribute('href').slice(1);
  if (!id || !OWNER[id]) return;
  event.preventDefault();
  if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  open(id, { scroll: true });
});
addEventListener('popstate', () => open(location.hash.slice(1)));
open(location.hash.slice(1));
// A link to a tool (herramientas.html#cotizador) lands on it once the page has laid out.
if (OWNER[location.hash.slice(1)]) {
  const land = () => setTimeout(() => $('.tools-stage', root).scrollIntoView({ block: 'start' }), 60);
  if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
}

// Files: the hero drop zone, every upload button and a drop anywhere on the page.
const take = file => {
  if (!file) return;
  if (!FILE_TOOLS.has(active)) { history.pushState(null, '', '#visor'); open('visor', { scroll: true }); }
  store.load(file);
};
root.addEventListener('change', event => {
  if (event.target.matches('[data-file]')) { take(event.target.files[0]); event.target.value = ''; }
});
const drop = $('[data-drop]', root);
let depth = 0;
addEventListener('dragenter', e => { if (e.dataTransfer?.types.includes('Files')) { depth++; drop.classList.add('is-over'); } });
addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('is-over'); } });
addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
addEventListener('drop', e => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  depth = 0; drop.classList.remove('is-over');
  take(e.dataTransfer.files[0]);
});

// The bar above the tools names the loaded part.
const bar = $('[data-part]', root);
store.subscribe(part => {
  bar.hidden = !part;
  root.classList.toggle('has-part', !!part);
  if (!part) return;
  $('[data-part-name]', bar).textContent = part.name;
  const r = part.report;
  $('[data-part-meta]', bar).textContent = r ? `${fmt.size(r.size)} · ${fmt.cm3(r.volume)}` : 'Revisando la malla…';
});
$('[data-part-clear]', bar).addEventListener('click', () => store.clear());
