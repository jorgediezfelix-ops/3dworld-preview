// Print time, weight and price for herramientas.html, from the part's geometry and tarifas.json.
// A part is { volume: mm³, area: mm², size: [x, y, z] mm, support: mm³ of support columns }.

const LINE = 0.45;             // extrusion width, mm
const SKIN = 0.8;              // top and bottom skin, mm
const SUPPORT_DENSITY = 0.15;
const LAYER_SECONDS = 2.5;     // travel, retraction and layer change

export const money = v => `$${Math.round(v).toLocaleString('es-MX')}`;

export function material(data, id) {
  const tech = data.materiales.materiales.find(m => m.id === id);
  const rate = data.tarifas.materiales[id];
  if (!tech || !rate) throw new Error(`Material desconocido: ${id}`);
  return { ...tech, precio_g: rate.g, hora: data.tarifas.fdm.hora[rate.hora], velocidad: rate.velocidad || 1, bajoPedido: rate.dias_bajo_pedido || 0 };
}

// Slicer-like estimate: walls and skins follow the surface, infill fills the rest.
// layer and flow (mm³/s for PLA) override the quality preset, for the visitor's own printer.
export function printEstimate(part, { material: id = 'PLA', quality = 'estandar', infill = 20, walls = 3, supports = true, layer, flow: ownFlow } = {}, data) {
  const m = material(data, id);
  const preset = data.tarifas.calidades.find(c => c.id === quality) || data.tarifas.calidades[1];
  const q = { ...preset, capa: layer > 0 ? layer : preset.capa, flujo: ownFlow > 0 ? ownFlow : preset.flujo };
  // Side walls are walls × LINE deep and top/bottom skins SKIN deep; without slicing, take the mean.
  const shell = Math.min(part.volume, part.area * (walls * LINE + SKIN) / 2);
  const fill = (part.volume - shell) * infill / 100;
  const support = supports ? (part.support || 0) * SUPPORT_DENSITY : 0;
  const extruded = shell + fill + support;
  const flow = q.flujo * m.velocidad;
  const layers = Math.ceil(part.size[2] / q.capa);
  const seconds = shell / (flow * 0.75) + fill / (flow * 1.25) + support / (flow * 1.2) + layers * LAYER_SECONDS;
  const grams = extruded / 1000 * m.densidad;
  return { grams, hours: seconds / 3600, layers, extruded, shell, fill, support, material: m, quality: q };
}

export function perPlate(size, { cama_mm: bed, separacion_mm: gap }) {
  const fit = (w, d) => Math.floor((bed[0] + gap) / (w + gap)) * Math.floor((bed[1] + gap) / (d + gap));
  if (size[2] > bed[2]) return 0;
  return Math.max(fit(size[0], size[1]), fit(size[1], size[0]));
}

const discount = (steps, qty) => steps.reduce((d, [from, value]) => (qty >= from ? value : d), 0);

// Floor per piece: $290 for one piece easing to $95 from 20 pieces (content/precios-servicios.json).
export function floorPerPiece(qty, f) {
  if (qty >= f.lote_desde) return f.minimo_lote;
  const k = Math.log(f.minimo_pieza / f.minimo_lote) / Math.log(f.lote_desde);
  return Math.max(f.minimo_lote, f.minimo_pieza * qty ** -k);
}

function leadDays(hours, finishDays, data) {
  const c = data.tarifas.capacidad;
  return c.dias_revision + Math.max(1, Math.ceil(hours / (c.impresoras * c.horas_dia))) + finishDays + c.dias_envio;
}

export function quoteFDM(part, options, data) {
  const f = data.tarifas.fdm;
  const qty = Math.max(1, Math.round(options.quantity || 1));
  const finish = data.tarifas.acabados.find(a => a.id === (options.finish || 'estandar')) || data.tarifas.acabados[0];
  const est = printEstimate(part, options, data);
  const slots = perPlate(part.size, f);
  if (!slots) return { ok: false, reason: 'size', estimate: est };
  if (finish.materiales && !finish.materiales.includes(est.material.id)) return { ok: false, reason: 'finish', estimate: est, finish };
  const plates = Math.ceil(qty / slots);
  const hours = est.hours * qty + plates * f.calentamiento_min / 60;
  const machine = hours * est.material.hora * (1 - discount(f.descuento_maquina, qty));
  const materialCost = est.grams * qty * est.material.precio_g;
  const setup = f.preparacion_pedido + plates * f.preparacion_placa;
  const finishing = qty * (finish.pieza + finish.cm2 * part.area / 100);
  const raw = machine + materialCost + setup + finishing;
  const floor = floorPerPiece(qty, f) * qty;
  const total = Math.max(raw, floor);
  return {
    ok: true, technology: 'FDM', quantity: qty, total, unit: total / qty, minimum: raw < floor,
    breakdown: { machine, material: materialCost, setup, finishing },
    plates, perPlate: slots, hours, grams: est.grams * qty, days: leadDays(hours, finish.dias, data) + est.material.bajoPedido, estimate: est, finish,
  };
}

export function quoteSLS(part, { quantity = 1 } = {}, data) {
  const s = data.tarifas.sls;
  const qty = Math.max(1, Math.round(quantity));
  const camera = [...s.camara_mm].sort((a, b) => a - b);
  if (![...part.size].sort((a, b) => a - b).every((v, k) => v <= camera[k])) return { ok: false, reason: 'size' };
  const cm3 = part.volume / 1000;
  const pieces = qty * (cm3 * s.cm3 + s.pieza) * (1 - discount(s.descuento, qty));
  const raw = s.preparacion_pedido + pieces;
  const total = Math.max(raw, s.minimo_pedido);
  return {
    ok: true, technology: 'SLS', material: s.material, quantity: qty, total, unit: total / qty, minimum: raw < s.minimo_pedido,
    grams: cm3 * s.densidad * qty, days: s.dias + data.tarifas.capacidad.dias_envio + Math.floor(qty * cm3 / 8000),
  };
}

export function batchTable(part, options, data, quantities = [1, 10, 100, 1000]) {
  return quantities.map(quantity => {
    const fdm = quoteFDM(part, { ...options, quantity }, data);
    const sls = quoteSLS(part, { quantity }, data);
    const options_ = [fdm, sls].filter(x => x.ok);
    const best = options_.length ? options_.reduce((a, b) => (b.unit < a.unit ? b : a)) : null;
    return { quantity, fdm, sls, best: best && best.technology };
  });
}

// Manual entry when there is no file: a box of the given size filled to the given share.
export function partFromSize(size, volumeCm3) {
  const [x, y, z] = size;
  const boxVolume = x * y * z;
  const volume = Math.min(volumeCm3 * 1000 || boxVolume * 0.35, boxVolume);
  const k = Math.cbrt(volume / boxVolume);
  const area = 2 * (x * y + y * z + x * z) * k * k * 1.15;
  return { volume, area, size, support: boxVolume * 0.04 };
}
