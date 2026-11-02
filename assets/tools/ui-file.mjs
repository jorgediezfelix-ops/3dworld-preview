// The tools that work on the visitor's file: viewer, analyser, quote, own-printer calculator and lots.
import { $, $$, out, fmt, number, data, store, viewerFor, contactLink } from './shared.mjs';
import { FLAG } from './geometry.mjs';
import { quoteFDM, quoteSLS, batchTable, printEstimate, partFromSize } from './estimate.mjs';
import { filament } from './units.mjs';

const visorSection = () => $('#visor');
let overlay = 0;

// Leaving the viewer: whole part again, measuring off.
function resetInspection(viewer) {
  const v = visorSection(), range = $('[name="corte"]', v), measure = $('[data-measure]', v);
  range.value = 100;
  out(v, 'corte', 'Pieza completa');
  viewer.section(null);
  if (measure.getAttribute('aria-pressed') === 'true') {
    measure.setAttribute('aria-pressed', 'false');
    viewer.measure(false);
    out(v, 'medida', 'Activa la medición y haz clic en dos puntos de la pieza.');
  }
}

// Status lines in every file viewport.
store.status = (message, error = false) => {
  for (const s of $$('[data-viewport="archivo"] [data-status]')) { s.textContent = message; s.classList.toggle('is-error', error); }
  if (error && !store.get()) for (const e of $$('[data-viewport="archivo"] [data-empty]')) e.hidden = false;
};

// The file viewport follows the part; the open tool decides which marks are painted.
let shown = null;
async function fileViewer(section) {
  const bed = (await data).tarifas.fdm.cama_mm;
  const viewer = await viewerFor('archivo', $('[data-viewport]', section), { bed, onMeasure: m => out(visorSection(), 'medida', m
    ? `Distancia: ${fmt.mm(m.distance)}\nΔX ${fmt.mm(m.dx)}, ΔY ${fmt.mm(m.dy)}, ΔZ ${fmt.mm(m.dz)}`
    : 'Ahora haz clic en el segundo punto.') });
  if (!fileViewer.bound) {
    fileViewer.bound = true;
    store.subscribe(part => {
      for (const e of $$('[data-viewport="archivo"] [data-empty]')) e.hidden = !!part;
      if (!part) { viewer.clear(); shown = null; return; }
      if (shown !== part.positions) { shown = part.positions; viewer.show(part.positions); }
      viewer.setFlags(part.report?.flags || null);
    });
  }
  return viewer;
}

async function sample() {
  const { shelfBracket } = await import('./sample.mjs');
  await store.set('escuadra-de-ejemplo.stl', shelfBracket(), { format: 'stl' });
}
document.addEventListener('click', e => { if (e.target.closest('[data-sample]')) sample(); });

function bindViews(section, viewer) {
  for (const b of $$('[data-view]', section)) b.addEventListener('click', () => viewer.view(b.dataset.view));
}

export async function visor(section) {
  const viewer = await fileViewer(section);
  bindViews(section, viewer);
  const range = section.querySelector('[name="corte"]');
  const measure = $('[data-measure]', section);
  const units = $$('[name="unidades"]', section);
  units.forEach(u => u.addEventListener('change', () => store.setUnit(+u.value)));
  range.addEventListener('input', () => {
    const share = +range.value / 100;
    viewer.section(share >= 1 ? null : share);
    out(section, 'corte', share >= 1 || !store.get()?.report ? 'Pieza completa' : `Z = ${fmt.mm(share * store.get().report.size[2])}`);
  });
  $('[name="alambre"]', section).addEventListener('change', e => viewer.setWireframe(e.target.checked));
  measure.addEventListener('click', () => {
    const on = measure.getAttribute('aria-pressed') !== 'true';
    measure.setAttribute('aria-pressed', on);
    viewer.measure(on);
    out(section, 'medida', on ? 'Haz clic en el primer punto de la pieza.' : 'Activa la medición y haz clic en dos puntos de la pieza.');
  });
  store.subscribe(part => {
    const r = part?.report;
    out(section, 'size', r ? fmt.size(r.size) : part ? 'Calculando…' : '—');
    out(section, 'volume', r ? fmt.cm3(r.volume) : '—');
    out(section, 'area', r ? fmt.cm2(r.area) : '—');
    out(section, 'triangles', r ? fmt.n(r.triangles, 0) : '—');
    units.forEach(u => { u.checked = +u.value === (part?.unit || 1); });
    range.value = 100; viewer.section(null); out(section, 'corte', 'Pieza completa');
    if (r && Math.max(...r.size) < 5 && part.unit === 1) store.status('La pieza mide menos de 5 mm. Si el archivo está en pulgadas o metros, cambia las unidades.');
  });
  return { show: () => { viewer.setOverlay(0); overlay = 0; } };
}

export async function analizador(section) {
  const viewer = await fileViewer(section);
  bindViews(section, viewer);
  const marks = $$('[name="marca"]', section);
  const mask = () => marks.reduce((m, c) => (c.checked ? m | +c.value : m), 0);
  marks.forEach(c => c.addEventListener('change', () => { overlay = mask(); viewer.setOverlay(overlay); }));
  const list = $('[data-issues]', section);
  store.subscribe(part => {
    const r = part?.report;
    list.replaceChildren(...(r ? r.issues : [{ level: 'empty', title: part ? 'Revisando la malla…' : 'Sube un archivo para revisarlo.' }]).map(issue => {
      const li = document.createElement('li');
      li.className = `is-${issue.level}`;
      const strong = document.createElement('strong');
      strong.textContent = issue.title;
      li.append(strong);
      if (issue.detail) { const p = document.createElement('p'); p.textContent = issue.detail; li.append(p); }
      return li;
    }));
    const yes = v => (v ? 'Sí' : 'No');
    out(section, 'shells', r ? fmt.n(r.shells, 0) : '—');
    out(section, 'open', r ? fmt.n(r.openEdges, 0) : '—');
    out(section, 'nonManifold', r ? fmt.n(r.nonManifoldEdges, 0) : '—');
    out(section, 'flipped', r ? fmt.n(r.flippedEdges, 0) : '—');
    out(section, 'overhang', r ? `${fmt.pct(r.overhang.share)} (${fmt.cm2(r.overhang.area)})` : '—');
    out(section, 'thin', !r ? '—' : !r.thickness ? 'No se midió: la malla tiene errores' : r.thickness.min == null ? `Más de 6 mm` : fmt.mm(r.thickness.min));
    out(section, 'fdm', r ? yes(r.fits.fdm) : '—');
    out(section, 'sls', r ? yes(r.fits.sls) : '—');
  });
  return { show: () => { resetInspection(viewer); overlay = mask(); viewer.setOverlay(overlay); } };
}

// Part for pricing: the analysed file, or the approximate size typed in the form.
function partFor(form) {
  const summary = store.summary();
  if (summary) return summary;
  const size = ['x', 'y', 'z'].map(k => Math.max(1, number(form, k, 10)));
  return partFromSize(size, number(form, 'volumen', 0));
}

function bindForm(form, render) {
  const run = () => { try { render(); } catch (error) { console.error(error); } };
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  form.addEventListener('submit', e => e.preventDefault());
  store.subscribe(part => {
    const manual = $('[data-manual]', form);
    if (manual) manual.hidden = !!part;
    run();
  });
  return run;
}

export async function cotizador(section) {
  const d = await data;
  const form = $('form', section);
  const request = $('[data-request]', section);
  const breakdown = $('[data-breakdown]', section);
  bindForm(form, () => {
    const part = store.get();
    const tech = form.elements.tecnologia.value;
    $$('[data-only]', form).forEach(el => { el.hidden = el.dataset.only !== tech; });
    if (part && !part.report) { out(section, 'unit', 'Calculando…'); return; }
    const geometry = partFor(form);
    const quantity = Math.max(1, Math.round(number(form, 'cantidad', 1)));
    const options = { material: form.elements.material.value, quality: form.elements.calidad.value, infill: +form.elements.relleno.value, finish: form.elements.acabado.value, quantity };
    const q = tech === 'SLS' ? quoteSLS(geometry, { quantity }, d) : quoteFDM(geometry, options, d);
    request.hidden = !q.ok;
    if (!q.ok) {
      ['unit', 'total', 'days', 'grams', 'hours'].forEach(k => out(section, k, '—'));
      breakdown.replaceChildren();
      out(section, 'nota', q.reason === 'size' ? (tech === 'SLS' ? 'La pieza no cabe en la cámara SLS de 300 mm. Escríbenos: la dividimos en partes con uniones.' : `No cabe en una sola impresión FDM de ${d.tarifas.fdm.cama_mm[0]} mm. Prueba SLS o escríbenos para dividirla en partes.`)
        : `El ${q.finish.nombre.toLowerCase()} solo se hace en ${q.finish.materiales.join(' y ')}.`);
      return;
    }
    out(section, 'unit', fmt.money(q.unit));
    out(section, 'total', `${fmt.money(q.total)} por ${quantity} ${quantity === 1 ? 'pieza' : 'piezas'}`);
    out(section, 'days', fmt.days(q.days));
    out(section, 'grams', fmt.g(q.grams / quantity));
    out(section, 'hours', q.hours ? fmt.h(q.hours) : 'Según la carga de la cámara');
    const rows = q.breakdown ? [['Material', q.breakdown.material], ['Tiempo de máquina', q.breakdown.machine], ['Preparación de archivo y placas', q.breakdown.setup], ['Acabado', q.breakdown.finishing]] : [];
    if (q.minimum) rows.push([tech === 'SLS' ? 'Ajuste al pedido mínimo SLS' : 'Ajuste al mínimo por pieza', q.total - rows.reduce((s, [, v]) => s + v, 0)]);
    breakdown.replaceChildren(...rows.filter(([, v]) => v > 0.5 || rows.length === 1).map(([label, value]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<th scope="row"></th><td></td>';
      tr.cells[0].textContent = label; tr.cells[1].textContent = fmt.money(value);
      return tr;
    }));
    if (tech === 'SLS') breakdown.replaceChildren();
    const onRequest = tech === 'FDM' && q.estimate.material.bajoPedido
      ? `El ${q.estimate.material.id} se imprime bajo pedido; por eso la entrega suma ${q.estimate.material.bajoPedido} días hábiles. ` : '';
    out(section, 'nota', onRequest + (q.minimum && tech === 'FDM'
      ? `Las piezas pequeñas parten de ${fmt.money(d.tarifas.fdm.minimo_pieza)}; desde ${d.tarifas.fdm.lote_desde} piezas, de ${fmt.money(d.tarifas.fdm.minimo_lote)} cada una. El precio incluye IVA.`
      : 'El precio incluye IVA. Al recibir tu archivo revisamos la orientación y te enviamos la cotización formal con fecha de entrega.'));
    const material = tech === 'SLS' ? 'PA12 (SLS)' : d.materiales.materiales.find(m => m.id === options.material).nombre;
    request.href = contactLink(quantity >= d.tarifas.fdm.lote_desde ? 'Series cortas' : 'Impresión 3D y prototipos', [
      `Cotización en línea: ${part?.name || 'pieza sin archivo'}`, fmt.size(geometry.size), material,
      tech === 'FDM' && form.elements.acabado.selectedOptions[0].text, `${quantity} ${quantity === 1 ? 'pieza' : 'piezas'}`, `${fmt.money(q.total)} con IVA`]);
  });
  return {};
}

export async function calculadora(section) {
  const d = await data;
  const form = $('form', section);
  bindForm(form, () => {
    const part = store.get();
    if (part && !part.report) { out(section, 'unit', 'Calculando…'); return; }
    const geometry = partFor(form);
    const id = form.elements.material.value;
    const e = printEstimate(geometry, { material: id, infill: number(form, 'relleno', 20), walls: Math.max(1, number(form, 'perimetros', 3)), layer: number(form, 'capa', 0.2), flow: number(form, 'flujo', 12) }, d);
    const qty = Math.max(1, Math.round(number(form, 'cantidad', 1)));
    const material = e.grams / 1000 * number(form, 'precio', 0);
    const energy = e.hours * number(form, 'potencia', 0) / 1000 * number(form, 'kwh', 0);
    out(section, 'unit', fmt.cost(material + energy));
    out(section, 'grams', fmt.g(e.grams * qty));
    out(section, 'meters', `${fmt.n(filament({ grams: e.grams * qty, density: e.material.densidad }).meters, 1)} m de 1.75 mm`);
    out(section, 'hours', fmt.h(e.hours * qty));
    out(section, 'layers', fmt.n(e.layers, 0));
    out(section, 'material', fmt.cost(material * qty));
    out(section, 'energy', fmt.cost(energy * qty));
    out(section, 'total', fmt.cost((material + energy) * qty));
  });
  return {};
}

export async function lotes(section) {
  const d = await data;
  const form = $('form', section);
  const body = $('[data-lots]', section);
  const request = $('[data-request]', section);
  bindForm(form, () => {
    const part = store.get();
    if (part && !part.report) { body.innerHTML = '<tr><td colspan="7">Calculando…</td></tr>'; return; }
    const geometry = partFor(form);
    const extra = Math.max(1, Math.round(number(form, 'otra', 250)));
    const quantities = [...new Set([1, 10, 100, 1000, extra])].sort((a, b) => a - b);
    const options = { material: form.elements.material.value, infill: +form.elements.relleno.value, finish: form.elements.acabado.value };
    const rows = batchTable(geometry, options, d, quantities);
    const cell = (q, key, best) => {
      const td = document.createElement('td');
      td.textContent = !q.ok ? (q.reason === 'finish' ? 'Acabado no disponible' : 'No cabe') : key === 'unit' ? fmt.money(q.unit) : key === 'total' ? fmt.money(q.total) : fmt.days(q.days);
      if (best && key === 'unit') td.className = 'is-best';
      return td;
    };
    body.replaceChildren(...rows.map(row => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = `${fmt.n(row.quantity, 0)} ${row.quantity === 1 ? 'pieza' : 'piezas'}`;
      tr.append(th, ...['unit', 'total', 'days'].map(k => cell(row.fdm, k, row.best === 'FDM')), ...['unit', 'total', 'days'].map(k => cell(row.sls, k, row.best === 'SLS')));
      return tr;
    }));
    const big = rows.at(-1);
    const onRequest = rows[0].fdm.estimate?.material.bajoPedido ? `El ${options.material} se imprime bajo pedido: la entrega FDM ya incluye ${rows[0].fdm.estimate.material.bajoPedido} días hábiles más. ` : '';
    out(section, 'nota', 'Precios con IVA. ' + onRequest + (big.quantity >= 500
      ? 'Con cientos o miles de piezas iguales, el moldeo por inyección puede salir más barato por pieza aunque requiere un molde; te ayudamos a compararlo.'
      : 'En FDM las piezas se acomodan varias por placa; en SLS se acomodan en el volumen de la cámara y no necesitan soportes.'));
    request.href = contactLink('Series cortas', [`Lote: ${part?.name || 'pieza sin archivo'}`, fmt.size(geometry.size),
      d.materiales.materiales.find(m => m.id === options.material).nombre, `cantidades ${quantities.map(q => fmt.n(q, 0)).join(', ')}`]);
  });
  return {};
}
