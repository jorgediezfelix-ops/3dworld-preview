// State and helpers shared by every tool on herramientas.html: the data files, number formats,
// the part the visitor loaded (with its analysis) and the 3D viewports.
import { analyze, scale } from './geometry.mjs';
import { readFile } from './loaders.mjs';
import { createAnalysisClient } from './analysis-client.mjs';

const json = name => fetch(new URL(`./${name}.json`, import.meta.url)).then(r => {
  if (!r.ok) throw new Error(`No se pudo leer ${name}.json`);
  return r.json();
});
export const data = Promise.all(['tarifas', 'materiales', 'tecnologias'].map(json))
  .then(([tarifas, materiales, tecnologias]) => ({ tarifas, materiales, tecnologias }));

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const out = (el, key, text) => { const node = $(`[data-out="${key}"]`, el); if (node) node.textContent = text; };

const nf = (v, digits) => v.toLocaleString('es-MX', { maximumFractionDigits: digits });
export const fmt = {
  n: (v, digits = 1) => nf(v, digits),
  mm: v => `${nf(v, Math.abs(v) < 10 ? 2 : 1)} mm`,
  size: s => `${s.map(v => nf(v, v < 10 ? 2 : 1)).join(' × ')} mm`,
  cm3: v => `${nf(v / 1000, v < 10000 ? 2 : 1)} cm³`,
  cm2: v => `${nf(v / 100, 1)} cm²`,
  g: v => (v >= 1000 ? `${nf(v / 1000, 2)} kg` : `${nf(v, v < 10 ? 1 : 0)} g`),
  h: hours => (hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${Math.floor(hours)} h ${String(Math.round(hours % 1 * 60)).padStart(2, '0')} min`),
  money: v => `$${nf(Math.round(v), 0)}`,
  cost: v => (v < 100 ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${nf(Math.round(v), 0)}`),
  days: d => `${d} ${d === 1 ? 'día hábil' : 'días hábiles'}`,
  pct: v => `${nf(v * 100, v < 0.1 ? 1 : 0)} %`,
};
export const number = (form, name, fallback = 0) => {
  const v = parseFloat(String(form.elements[name]?.value ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : fallback;
};

// Contact link with the request summarised, as contacto.html expects it.
export function contactLink(category, items) {
  return 'contacto.html?' + new URLSearchParams({ categoria: category, interes: items.filter(Boolean).join(' · ') });
}

// The visitor's part: original triangles, unit factor, scaled triangles and their analysis.
let part = null, loadRevision = 0;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn(part));
export const store = {
  get: () => part,
  subscribe(fn) { listeners.add(fn); fn(part); return () => listeners.delete(fn); },
  async load(file) {
    const revision = ++loadRevision;
    store.status(`Leyendo ${file.name}…`);
    try {
      const { positions, format } = await readFile(file, (...args) => { if (revision === loadRevision) store.status(...args); });
      if (revision !== loadRevision) return;
      await store.set(file.name, positions, { format });
    } catch (error) {
      if (revision === loadRevision) store.status(error.message, true);
    }
  },
  async set(name, raw, extra = {}) {
    loadRevision++;
    part = { name, raw, unit: 1, positions: raw, report: null, analyzing: true, ...extra };
    emit();
    await analyzePart();
  },
  async setUnit(unit) {
    if (!part || part.unit === unit) return;
    part = { ...part, unit, positions: unit === 1 ? part.raw : scale(part.raw, unit), report: null, analyzing: true };
    emit();
    await analyzePart();
  },
  clear() { loadRevision++;part = null;store.status('');emit(); },
  // Geometry summary for quotes: volume, area and size in mm, support columns in mm³.
  summary() {
    const r = part?.report;
    return r && { volume: r.volume, area: r.area, size: r.size, support: r.overhang.support };
  },
  status: () => {},
};

const analyzeInWorker = createAnalysisClient(() => new Worker(new URL('./analyze-worker.mjs', import.meta.url), { type: 'module' }));

async function analyzePart() {
  const current = part;
  store.status('Revisando la malla…');
  const copy = current.positions.slice();
  let report;
  try {
    ({ report } = await analyzeInWorker(copy));
  } catch (error) {
    if (part !== current) return;
    if (error.message !== 'worker') { part = {...current, analyzing:false};store.status(error.message, true);emit();return; }
    report = analyze(current.positions);
  }
  if (part !== current) return;
  part = { ...current, report, analyzing: false };
  store.status('');
  emit();
}

// One viewport follows the visitor's file between the viewer and the analyser.
const viewers = {};
export async function viewerFor(kind, slot, options = {}) {
  if (!viewers[kind]) {
    viewers[kind] = (async () => {
      const { createViewer } = await import('./viewer.mjs');
      const host = document.createElement('div');
      host.className = 'viewport-canvas';
      slot.prepend(host);
      return { host, viewer: createViewer(host, options) };
    })();
  }
  const v = await viewers[kind];
  if (v.host.parentElement !== slot) slot.prepend(v.host);
  return v.viewer;
}
