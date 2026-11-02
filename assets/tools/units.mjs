// Unit conversions for herramientas.html. Each unit maps to the category's base unit by a factor,
// except temperature, which needs offsets.

export const CATEGORIES = {
  longitud: { nombre: 'Longitud', base: 'mm', units: { 'µm': 0.001, mm: 1, cm: 10, m: 1000, 'in': 25.4, ft: 304.8, mil: 0.0254 } },
  area: { nombre: 'Área', base: 'mm²', units: { 'mm²': 1, 'cm²': 100, 'm²': 1e6, 'in²': 645.16, 'ft²': 92903.04 } },
  volumen: { nombre: 'Volumen', base: 'mm³', units: { 'mm³': 1, 'cm³': 1000, mL: 1000, L: 1e6, 'm³': 1e9, 'in³': 16387.064, 'ft³': 28316846.592, 'gal (EUA)': 3785411.784 } },
  angulo: { nombre: 'Ángulo', base: '°', units: { '°': 1, rad: 180 / Math.PI, grad: 0.9, "'": 1 / 60, '"': 1 / 3600, vuelta: 360 } },
  masa: { nombre: 'Masa', base: 'g', units: { mg: 0.001, g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 } },
  densidad: { nombre: 'Densidad', base: 'g/cm³', units: { 'g/cm³': 1, 'kg/m³': 0.001, 'g/mL': 1, 'lb/in³': 27.679904710, 'lb/ft³': 0.016018463 } },
  esfuerzo: { nombre: 'Presión y esfuerzo', base: 'MPa', units: { MPa: 1, 'N/mm²': 1, GPa: 1000, kPa: 0.001, bar: 0.1, psi: 0.006894757, ksi: 6.894757, 'kgf/cm²': 0.0980665 } },
  fuerza: { nombre: 'Fuerza', base: 'N', units: { N: 1, kN: 1000, kgf: 9.80665, lbf: 4.448221615 } },
  par: { nombre: 'Par de apriete', base: 'N·m', units: { 'N·m': 1, 'N·cm': 0.01, 'kgf·cm': 0.0980665, 'lbf·in': 0.112984829, 'lbf·ft': 1.355817948 } },
  temperatura: { nombre: 'Temperatura', base: '°C', units: { '°C': null, '°F': null, K: null } },
};

const toC = { '°C': v => v, '°F': v => (v - 32) * 5 / 9, K: v => v - 273.15 };
const fromC = { '°C': v => v, '°F': v => v * 9 / 5 + 32, K: v => v + 273.15 };

export function convert(value, from, to, category) {
  const c = CATEGORIES[category];
  if (!c || !(from in c.units) || !(to in c.units)) throw new Error('Unidad no válida.');
  if (category === 'temperatura') return fromC[to](toC[from](value));
  return value * c.units[from] / c.units[to];
}

// Filament: length and weight of a spool for a given diameter (mm) and density (g/cm³).
export function filament({ grams, meters, diameter = 1.75, density = 1.24 }) {
  const gramsPerMeter = Math.PI * (diameter / 2) ** 2 * 1000 / 1000 * density;
  return grams != null ? { grams, meters: grams / gramsPerMeter, gramsPerMeter } : { grams: meters * gramsPerMeter, meters, gramsPerMeter };
}

// Nearest fraction of an inch with a denominator up to 64, for drill and stock sizes.
export function inchFraction(mm, max = 64) {
  const inches = mm / 25.4;
  const whole = Math.floor(inches);
  let n = Math.round((inches - whole) * max), d = max;
  while (n && n % 2 === 0 && d > 1) { n /= 2; d /= 2; }
  const w = n === d ? whole + 1 : whole;
  const text = n === 0 || n === d ? `${w}"` : `${w ? w + ' ' : ''}${n}/${d}"`;
  return { text, inches, error: mm - (w + (n === d ? 0 : n / d)) * 25.4 };
}

export function parseFraction(text) {
  const m = /^\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*"?\s*$/.exec(text) || /^\s*(\d+(?:\.\d+)?)\s*"?\s*$/.exec(text);
  if (!m) return NaN;
  if (m.length === 2) return +m[1] * 25.4;
  return ((+m[1] || 0) + +m[2] / +m[3]) * 25.4;
}
