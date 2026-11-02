// Stress and deflection of simple printed geometries for herramientas.html (N, mm, MPa).

export const SECTIONS = {
  rect: { nombre: 'Rectangular sólida', campos: ['b', 'h'] },
  hollow: { nombre: 'Rectangular hueca', campos: ['b', 'h', 't'] },
  round: { nombre: 'Redonda sólida', campos: ['d'] },
  tube: { nombre: 'Tubo', campos: ['d', 't'] },
};

export function section(shape, { b, h, d, t } = {}) {
  const positive = v => Number.isFinite(v) && v > 0;
  if (shape === 'rect' && positive(b) && positive(h)) return { area: b * h, I: b * h ** 3 / 12, c: h / 2 };
  if (shape === 'hollow' && positive(b) && positive(h) && positive(t) && 2 * t < Math.min(b, h)) {
    const bi = b - 2 * t, hi = h - 2 * t;
    return { area: b * h - bi * hi, I: (b * h ** 3 - bi * hi ** 3) / 12, c: h / 2 };
  }
  if (shape === 'round' && positive(d)) return { area: Math.PI * d ** 2 / 4, I: Math.PI * d ** 4 / 64, c: d / 2 };
  if (shape === 'tube' && positive(d) && positive(t) && 2 * t < d) {
    const di = d - 2 * t;
    return { area: Math.PI * (d ** 2 - di ** 2) / 4, I: Math.PI * (d ** 4 - di ** 4) / 64, c: d / 2 };
  }
  throw new RangeError('Revisa las medidas de la sección: deben ser positivas y la pared menor que la mitad del ancho.');
}

// Maximum bending moment and deflection for a load F (N) on a span L (mm); E in MPa.
export const CASES = {
  voladizo: { nombre: 'Voladizo con carga en la punta', M: (F, L) => F * L, delta: (F, L, E, I) => F * L ** 3 / (3 * E * I) },
  voladizo_reparto: { nombre: 'Voladizo con carga repartida', M: (F, L) => F * L / 2, delta: (F, L, E, I) => F * L ** 3 / (8 * E * I) },
  apoyada: { nombre: 'Apoyada en los extremos, carga al centro', M: (F, L) => F * L / 4, delta: (F, L, E, I) => F * L ** 3 / (48 * E * I) },
  apoyada_reparto: { nombre: 'Apoyada en los extremos, carga repartida', M: (F, L) => F * L / 8, delta: (F, L, E, I) => 5 * F * L ** 3 / (384 * E * I) },
  tension: { nombre: 'Tensión o compresión axial' },
};

// mat: { tension (MPa), modulo (GPa), z (strength share across layers) }.
export function check({ caso, F, L, shape, dims, mat, layers = 'xy', required = 2 }) {
  if (!(F > 0 && L > 0)) throw new RangeError('La carga y la longitud deben ser mayores que cero.');
  const s = section(shape, dims);
  const E = mat.modulo * 1000;
  const strength = mat.tension * (layers === 'z' ? mat.z : 1);
  let stress, deflection, moment = 0, buckling = null;
  if (caso === 'tension') {
    stress = F / s.area;
    deflection = F * L / (s.area * E);
    buckling = Math.PI ** 2 * E * s.I / L ** 2;   // Euler, both ends pinned
  } else {
    const c = CASES[caso];
    if (!c) throw new Error(`Caso de carga desconocido: ${caso}`);
    moment = c.M(F, L);
    stress = moment * s.c / s.I;
    deflection = c.delta(F, L, E, s.I);
  }
  const safety = strength / stress;
  const verdict = safety >= required ? 'ok' : safety >= 1 ? 'justo' : 'falla';
  return { section: s, moment, stress, deflection, strength, safety, verdict, buckling, maxLoad: F * safety / required };
}
