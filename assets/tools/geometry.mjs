// Mesh reading and printability analysis for herramientas.html. Pure functions over triangle soups:
// positions is a Float32Array with 9 numbers (three vertices) per triangle, in millimetres.

const OVERHANG_DEG = 45;
const BED_BAND = 0.3;          // faces this close to the lowest point rest on the bed
const THIN_LIMIT = 0.8;        // two extrusion lines with a 0.4 mm nozzle
const THIN_WARN = 1.2;
const RAY_REACH = 6;           // walls thicker than this are not measured
export const FLAG = { overhang: 1, open: 2, nonManifold: 4, flipped: 8, thin: 16 };

export function parseSTL(buffer) {
  const view = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  if (count && 84 + count * 50 === buffer.byteLength) {
    const out = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
      const at = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) out[i * 9 + k] = view.getFloat32(at + k * 4, true);
    }
    return out;
  }
  const text = new TextDecoder().decode(buffer);
  const numbers = [];
  const vertex = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  for (let m; (m = vertex.exec(text));) numbers.push(+m[1], +m[2], +m[3]);
  if (!numbers.length || numbers.length % 9 || numbers.some(Number.isNaN)) throw new Error('El archivo no es un STL válido.');
  return Float32Array.from(numbers);
}

export function toSTL(positions, name = '3DWORLD') {
  const count = positions.length / 9;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode(name.slice(0, 79)));
  view.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const at = 84 + i * 50;
    const n = normal(positions, i);
    for (let k = 0; k < 3; k++) view.setFloat32(at + k * 4, n[k], true);
    for (let k = 0; k < 9; k++) view.setFloat32(at + 12 + k * 4, positions[i * 9 + k], true);
  }
  return buffer;
}

export function scale(positions, factor) {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i++) out[i] = positions[i] * factor;
  return out;
}

function normal(p, t) {
  const o = t * 9;
  const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
  const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const len = Math.hypot(x, y, z);
  return len ? [x / len, y / len, z / len, len / 2] : [0, 0, 0, 0];
}

export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

// Merge the copies of each vertex that triangle soups repeat, so edges can be shared.
function weld(positions, eps) {
  const n = positions.length / 3;
  const index = new Uint32Array(n);
  const ids = new Map();
  const inv = 1 / eps;
  let next = 0;
  for (let i = 0; i < n; i++) {
    const key = Math.round(positions[3 * i] * inv) + ',' + Math.round(positions[3 * i + 1] * inv) + ',' + Math.round(positions[3 * i + 2] * inv);
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = next++));
    index[i] = id;
  }
  return { index, count: next };
}

// Sort every edge once: shared by two triangles in opposite directions is a closed, well oriented surface.
function edges(index, vertexCount, skip) {
  const triangles = index.length / 3;
  const codes = new Float64Array(triangles * 3);
  let used = 0;
  for (let t = 0; t < triangles; t++) {
    if (skip[t]) continue;
    for (let k = 0; k < 3; k++) {
      const a = index[3 * t + k], b = index[3 * t + (k + 1) % 3];
      codes[used++] = ((a < b ? a : b) * vertexCount + (a < b ? b : a)) * 2 + (a < b ? 0 : 1);
    }
  }
  const sorted = codes.subarray(0, used).sort();
  const open = new Set(), nonManifold = new Set(), flipped = new Set();
  for (let i = 0; i < used;) {
    const edge = Math.floor(sorted[i] / 2);
    let j = i, forward = 0;
    while (j < used && Math.floor(sorted[j] / 2) === edge) forward += sorted[j++] % 2 === 0;
    const count = j - i;
    if (count === 1) open.add(edge);
    else if (count > 2) nonManifold.add(edge);
    else if (forward !== 1) flipped.add(edge);
    i = j;
  }
  return { open, nonManifold, flipped };
}

function shells(index, vertexCount, skip) {
  const parent = new Int32Array(vertexCount).map((_, i) => i);
  const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const used = new Uint8Array(vertexCount);
  for (let t = 0; t < index.length / 3; t++) {
    if (skip[t]) continue;
    const a = index[3 * t], b = index[3 * t + 1], c = index[3 * t + 2];
    used[a] = used[b] = used[c] = 1;
    join(a, b); join(a, c);
  }
  let roots = 0;
  for (let v = 0; v < vertexCount; v++) if (used[v] && find(v) === v) roots++;
  return roots;
}

// Uniform grid of triangles for the wall-thickness rays.
function grid(positions, box) {
  const triangles = positions.length / 9;
  const longest = Math.max(...box.size) || 1;
  const cell = Math.max(longest / Math.min(96, Math.max(8, Math.cbrt(triangles) * 2)), 0.05);
  const dims = box.size.map(s => Math.max(1, Math.ceil(s / cell)));
  const cellOf = (v, k) => Math.min(dims[k] - 1, Math.max(0, Math.floor((v - box.min[k]) / cell)));
  const ranges = new Int32Array(triangles * 6);
  const counts = new Int32Array(dims[0] * dims[1] * dims[2] + 1);
  const each = (t, visit) => {
    const r = ranges.subarray(t * 6, t * 6 + 6);
    for (let x = r[0]; x <= r[3]; x++) for (let y = r[1]; y <= r[4]; y++) for (let z = r[2]; z <= r[5]; z++) visit((x * dims[1] + y) * dims[2] + z);
  };
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      const o = t * 9 + k;
      ranges[t * 6 + k] = cellOf(Math.min(positions[o], positions[o + 3], positions[o + 6]), k);
      ranges[t * 6 + 3 + k] = cellOf(Math.max(positions[o], positions[o + 3], positions[o + 6]), k);
    }
    each(t, c => counts[c + 1]++);
  }
  for (let c = 1; c < counts.length; c++) counts[c] += counts[c - 1];
  const items = new Int32Array(counts[counts.length - 1]);
  const fill = counts.slice();
  for (let t = 0; t < triangles; t++) each(t, c => { items[fill[c]++] = t; });
  return { cell, dims, counts, items, min: box.min };
}

function hit(p, t, o, d) {
  const a = t * 9;
  const e1x = p[a + 3] - p[a], e1y = p[a + 4] - p[a + 1], e1z = p[a + 5] - p[a + 2];
  const e2x = p[a + 6] - p[a], e2y = p[a + 7] - p[a + 1], e2z = p[a + 8] - p[a + 2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const sx = o[0] - p[a], sy = o[1] - p[a + 1], sz = o[2] - p[a + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return dist > 1e-4 ? dist : Infinity;
}

// Walk the grid cells along the ray (3D DDA) and return the nearest wall within reach.
function cast(positions, g, origin, dir, source, reach) {
  let cellIdx = [0, 1, 2].map(k => Math.min(g.dims[k] - 1, Math.max(0, Math.floor((origin[k] - g.min[k]) / g.cell))));
  const step = dir.map(v => (v > 0 ? 1 : -1));
  const next = [0, 1, 2].map(k => {
    if (!dir[k]) return Infinity;
    const edge = g.min[k] + (cellIdx[k] + (dir[k] > 0 ? 1 : 0)) * g.cell;
    return (edge - origin[k]) / dir[k];
  });
  const delta = dir.map(v => (v ? Math.abs(g.cell / v) : Infinity));
  let best = Infinity, travelled = 0;
  while (travelled <= Math.min(reach, best)) {
    const c = (cellIdx[0] * g.dims[1] + cellIdx[1]) * g.dims[2] + cellIdx[2];
    for (let i = g.counts[c]; i < g.counts[c + 1]; i++) {
      const t = g.items[i];
      if (t !== source) best = Math.min(best, hit(positions, t, origin, dir));
    }
    const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
    travelled = next[k];
    cellIdx[k] += step[k];
    if (cellIdx[k] < 0 || cellIdx[k] >= g.dims[k]) break;
    next[k] += delta[k];
  }
  return best <= reach ? best : Infinity;
}

function thickness(positions, box, orientation, flags, normals, areas) {
  const triangles = positions.length / 9;
  const g = grid(positions, box);
  const samples = Math.min(triangles, 3000);
  const total = areas.reduce((a, b) => a + b, 0);
  let thinArea = 0, warnArea = 0, sampledArea = 0, min = Infinity;
  let acc = 0, target = total / samples / 2, t = 0;
  for (let s = 0; s < samples && t < triangles; s++, target += total / samples) {
    while (t < triangles - 1 && acc + areas[t] < target) acc += areas[t++];
    if (!areas[t]) continue;
    const n = normals.subarray(t * 3, t * 3 + 3).map(v => v * -orientation);
    const o = t * 9;
    const c = [0, 1, 2].map(k => (positions[o + k] + positions[o + 3 + k] + positions[o + 6 + k]) / 3 + n[k] * 1e-3);
    const wall = cast(positions, g, c, n, t, RAY_REACH);
    sampledArea += areas[t];
    if (wall < min) min = wall;
    if (wall < THIN_LIMIT) { thinArea += areas[t]; flags[t] |= FLAG.thin; }
    else if (wall < THIN_WARN) warnArea += areas[t];
  }
  return { min: Number.isFinite(min) ? min : null, thin: sampledArea ? thinArea / sampledArea : 0, warn: sampledArea ? warnArea / sampledArea : 0, limit: THIN_LIMIT, caution: THIN_WARN, samples };
}

export function fitsVolume(size, volume) {
  const a = [...size].sort((x, y) => x - y), b = [...volume].sort((x, y) => x - y);
  return a.every((v, k) => v <= b[k]);
}

export function analyze(positions, { bed = [250, 250, 250], sls = [300, 300, 300], walls = true } = {}) {
  const triangles = positions.length / 9;
  if (!triangles) throw new Error('El archivo no tiene triángulos.');
  const box = bounds(positions);
  const diag = Math.hypot(...box.size);
  const normals = new Float32Array(triangles * 3), areas = new Float32Array(triangles);
  const skip = new Uint8Array(triangles);
  let signed = 0, area = 0;
  for (let t = 0; t < triangles; t++) {
    const n = normal(positions, t);
    normals.set(n.slice(0, 3), t * 3);
    areas[t] = n[3];
    area += n[3];
    if (n[3] < diag * diag * 1e-14) skip[t] = 1;
    const o = t * 9, p = positions;
    signed += (p[o] * (p[o + 4] * p[o + 8] - p[o + 5] * p[o + 7]) - p[o + 1] * (p[o + 3] * p[o + 8] - p[o + 5] * p[o + 6]) + p[o + 2] * (p[o + 3] * p[o + 7] - p[o + 4] * p[o + 6])) / 6;
  }
  const { index, count } = weld(positions, Math.max(diag * 1e-6, 1e-6));
  for (let t = 0; t < triangles; t++) {
    const a = index[3 * t], b = index[3 * t + 1], c = index[3 * t + 2];
    if (a === b || b === c || a === c) skip[t] = 1;
  }
  const bad = edges(index, count, skip);
  const flags = new Uint8Array(triangles);
  if (bad.open.size || bad.nonManifold.size || bad.flipped.size) {
    for (let t = 0; t < triangles; t++) {
      if (skip[t]) continue;
      for (let k = 0; k < 3; k++) {
        const a = index[3 * t + k], b = index[3 * t + (k + 1) % 3];
        const edge = (a < b ? a : b) * count + (a < b ? b : a);
        if (bad.open.has(edge)) flags[t] |= FLAG.open;
        if (bad.nonManifold.has(edge)) flags[t] |= FLAG.nonManifold;
        if (bad.flipped.has(edge)) flags[t] |= FLAG.flipped;
      }
    }
  }
  const orientation = signed < 0 ? -1 : 1;
  const limit = -Math.cos((90 - OVERHANG_DEG) * Math.PI / 180);
  const zmin = box.min[2];
  let overArea = 0, support = 0;
  for (let t = 0; t < triangles; t++) {
    const nz = normals[t * 3 + 2] * orientation, o = t * 9;
    if (skip[t] || nz >= limit) continue;
    const top = Math.max(positions[o + 2], positions[o + 5], positions[o + 8]);
    if (top - zmin < BED_BAND) continue;
    flags[t] |= FLAG.overhang;
    overArea += areas[t];
    support += areas[t] * -nz * ((positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3 - zmin);
  }
  const report = {
    triangles, vertices: count, min: box.min, max: box.max, size: box.size,
    volume: Math.abs(signed), signedVolume: signed, area,
    shells: shells(index, count, skip),
    openEdges: bad.open.size, nonManifoldEdges: bad.nonManifold.size, flippedEdges: bad.flipped.size,
    degenerate: skip.reduce((a, b) => a + b, 0),
    overhang: { area: overArea, share: area ? overArea / area : 0, support, angle: OVERHANG_DEG },
    fits: { fdm: fitsVolume(box.size, bed), sls: fitsVolume(box.size, sls) },
    flags,
  };
  report.watertight = !report.openEdges && !report.nonManifoldEdges;
  report.thickness = walls && report.watertight && !report.flippedEdges ? thickness(positions, box, orientation, flags, normals, areas) : null;
  report.issues = issues(report);
  return report;
}

const mm = v => `${v.toLocaleString('es-MX', { maximumFractionDigits: v < 10 ? 2 : 1 })} mm`;
const count = (n, one, many) => `${n.toLocaleString('es-MX')} ${n === 1 ? one : many}`;

// Plain-language findings, most serious first.
export function issues(r) {
  const list = [];
  const add = (level, id, title, detail) => list.push({ level, id, title, detail });
  if (r.openEdges) add('error', 'open', 'La malla tiene huecos', `${count(r.openEdges, 'arista abierta', 'aristas abiertas')}: la superficie no cierra y el laminador puede inventar o perder paredes. Repárala exportando como sólido cerrado o con la reparación automática de tu laminador.`);
  if (r.nonManifoldEdges) add('error', 'nonManifold', 'Hay aristas compartidas por más de dos caras', `${count(r.nonManifoldEdges, 'arista no es manifold', 'aristas no son manifold')}: suele pasar al juntar cuerpos que se tocan en una línea. Únelos con una operación booleana o sepáralos.`);
  if (r.flippedEdges) add('error', 'flipped', 'Hay caras con la normal invertida', `${count(r.flippedEdges, 'arista une caras', 'aristas unen caras')} orientadas al revés. Recalcula las normales antes de laminar.`);
  if (r.signedVolume < 0 && !r.flippedEdges) add('warn', 'inverted', 'Todas las normales apuntan hacia adentro', 'El volumen es correcto, pero el archivo está volteado de adentro hacia afuera. La mayoría de los laminadores lo corrige solo.');
  if (!r.fits.fdm) add(r.fits.sls ? 'warn' : 'error', 'size', 'No cabe en una sola impresión FDM', `Mide ${r.size.map(v => Math.round(v)).join(' × ')} mm. ${r.fits.sls ? 'Cabe en SLS, o la dividimos en partes con uniones.' : 'La dividimos en partes con uniones o ajustamos la escala.'}`);
  if (r.thickness && r.thickness.thin > 0.002) add('warn', 'thin', 'Paredes más delgadas de lo recomendable', `El ${(r.thickness.thin * 100).toFixed(1)} % de la superficie tiene paredes de menos de ${mm(r.thickness.limit)} (la más delgada mide ${mm(r.thickness.min)}). Engrósalas a ${mm(r.thickness.caution)} o más para que se impriman completas.`);
  if (r.overhang.share > 0.02) add('warn', 'overhang', 'Necesita soportes', `El ${(r.overhang.share * 100).toFixed(0)} % de la superficie queda en voladizo a más de ${r.overhang.angle}°. Prueba otra orientación o agrega chaflanes para reducir soportes.`);
  if (r.degenerate) add('info', 'degenerate', 'Triángulos sin área', `${count(r.degenerate, 'triángulo colapsado', 'triángulos colapsados')}. No afectan la impresión y los laminadores los descartan.`);
  if (r.shells > 1) add('info', 'shells', `${r.shells} cuerpos separados`, 'El archivo trae varias piezas o cuerpos sueltos. Revisa que sea intencional: se imprimirán como piezas independientes.');
  if (r.volume < 1) add('error', 'empty', 'La pieza casi no tiene volumen', 'Revisa que el archivo sea un sólido y que las unidades sean milímetros.');
  if (!list.some(i => i.level === 'error')) list.unshift({ level: 'ok', id: 'ready', title: 'Lista para laminar', detail: r.watertight ? 'La malla está cerrada y bien orientada.' : 'Sin errores de malla.' });
  return list;
}
