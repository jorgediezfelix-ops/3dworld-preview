// ISO 286 limits and fits (hole-basis and common hole letters) and printed-part clearances for herramientas.html.
// Deviations are in micrometres; sizes in millimetres.

const LIMITS = [3, 6, 10, 14, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500];
const MAIN = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 11, 11, 12, 12];

// Standard tolerance grades per main size range (ISO 286-1, table 1).
const IT = {
  5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27],
  6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
  7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
  8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
  9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155],
  10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
  11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400],
  12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630],
};

const main = values => MAIN.map(i => values[i]);
// Fundamental deviations of shafts: upper deviation es for c–h, lower deviation ei for k–s.
const SHAFT = {
  c: [-60, -70, -80, -95, -95, -110, -110, -120, -130, -140, -150, -170, -180, -200, -210, -230, -240, -260, -280, -300, -330, -360, -400, -440, -480],
  d: main([-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230]),
  e: main([-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135]),
  f: main([-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68]),
  g: main([-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20]),
  h: LIMITS.map(() => 0),
  k: main([0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5]),
  m: main([2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23]),
  n: main([4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40]),
  p: main([6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68]),
  r: [10, 15, 19, 23, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132],
  s: [14, 19, 23, 28, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252],
};
const UPPER = new Set(['c', 'd', 'e', 'f', 'g', 'h']);

export const HOLES = ['H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'G6', 'G7', 'F7', 'F8', 'JS7'];
export const SHAFTS = ['c11', 'd9', 'd10', 'e8', 'e9', 'f6', 'f7', 'g5', 'g6', 'h5', 'h6', 'h7', 'h8', 'h9', 'h11', 'js6', 'k5', 'k6', 'm6', 'n6', 'p6', 'r6', 's6'];
export const PRESETS = [
  { hole: 'H11', shaft: 'c11', nombre: 'Juego amplio', uso: 'Piezas que deben entrar sin esfuerzo aunque estén sucias o calientes: bisagras rústicas, pasadores de maquinaria agrícola.' },
  { hole: 'H9', shaft: 'd9', nombre: 'Giro libre', uso: 'Ejes que giran con holgura generosa: poleas locas, rodillos de baja velocidad.' },
  { hole: 'H8', shaft: 'f7', nombre: 'Giro con juego normal', uso: 'Ejes lubricados que giran o se deslizan: chumaceras, guías de máquina herramienta.' },
  { hole: 'H7', shaft: 'g6', nombre: 'Deslizante preciso', uso: 'Piezas que se deslizan sin juego apreciable: pernos de localización, émbolos, guías de herramental.' },
  { hole: 'H7', shaft: 'h6', nombre: 'Localización con juego', uso: 'Se monta a mano y queda centrado: engranes y poleas con chaveta, bujes desmontables.' },
  { hole: 'H7', shaft: 'k6', nombre: 'Transición', uso: 'Localización precisa que se monta con golpes suaves: pistas de rodamientos, acoplamientos.' },
  { hole: 'H7', shaft: 'n6', nombre: 'Transición ajustada', uso: 'Más firme que k6; se monta con prensa ligera: engranes que transmiten par moderado.' },
  { hole: 'H7', shaft: 'p6', nombre: 'Apriete ligero', uso: 'Prensado en frío que no se afloja: bujes de bronce, casquillos en carcasas.' },
  { hole: 'H7', shaft: 's6', nombre: 'Apriete fuerte', uso: 'Unión permanente que transmite par sin chaveta: coronas en cubos, prensado en caliente.' },
];

function range(size) {
  if (!(size > 0 && size <= 500)) throw new RangeError('La medida nominal debe estar entre 0.1 y 500 mm.');
  return LIMITS.findIndex(limit => size <= limit);
}

function parse(code, letters) {
  const m = /^([a-zA-Z]{1,2})(\d{1,2})$/.exec(code || '');
  if (!m || !letters.includes(m[1]) || !IT[m[2]]) throw new Error(`Clase de tolerancia no válida: ${code}`);
  return { letter: m[1], grade: +m[2] };
}

export function tolerance(size, grade) {
  return IT[grade][MAIN[range(size)]];
}

export function shaftLimits(size, code) {
  const { letter, grade } = parse(code, [...Object.keys(SHAFT), 'js']);
  const it = tolerance(size, grade);
  if (letter === 'js') return { upper: it / 2, lower: -it / 2, it };
  let dev = SHAFT[letter][range(size)];
  if (letter === 'k' && (grade > 7 || grade < 4)) dev = 0;
  return UPPER.has(letter) ? { upper: dev, lower: dev - it, it } : { upper: dev + it, lower: dev, it };
}

// Hole letters F and G mirror shafts f and g (EI = −es); H starts at zero.
export function holeLimits(size, code) {
  const { letter, grade } = parse(code, ['F', 'G', 'H', 'JS']);
  const it = tolerance(size, grade);
  if (letter === 'JS') return { upper: it / 2, lower: -it / 2, it };
  const lower = letter === 'H' ? 0 : -SHAFT[letter.toLowerCase()][range(size)];
  return { upper: lower + it, lower, it };
}

export function fit(size, holeCode, shaftCode) {
  const hole = holeLimits(size, holeCode), shaft = shaftLimits(size, shaftCode);
  const max = hole.upper - shaft.lower, min = hole.lower - shaft.upper;
  const type = min >= 0 ? 'juego' : max <= 0 ? 'apriete' : 'transicion';
  return { size, hole, shaft, max, min, type };
}

// Diametral clearance to model for printed parts (shaft at nominal, hole enlarged), in mm.
export const PRINT_FITS = [
  { id: 'apriete', nombre: 'A presión', detalle: 'Entra con prensa o martillo de goma y no se suelta.', FDM: 0, SLS: 0, SLA: 0 },
  { id: 'firme', nombre: 'Firme', detalle: 'Entra empujando con la mano y se queda en su lugar.', FDM: 0.15, SLS: 0.1, SLA: 0.08 },
  { id: 'deslizante', nombre: 'Deslizante', detalle: 'Se desliza o gira sin juego visible.', FDM: 0.3, SLS: 0.2, SLA: 0.15 },
  { id: 'libre', nombre: 'Libre', detalle: 'Gira suelto; para bisagras y ejes de baja precisión.', FDM: 0.5, SLS: 0.35, SLA: 0.3 },
  { id: 'ensamblado', nombre: 'Impreso ya ensamblado', detalle: 'Piezas móviles que salen de la impresora unidas.', FDM: 0.6, SLS: 0.5, SLA: 0.4 },
];

export function printFit(size, fitId, technology = 'FDM', axis = 'vertical') {
  const f = PRINT_FITS.find(x => x.id === fitId);
  if (!f || !(technology in f)) throw new Error('Ajuste o tecnología no válidos.');
  if (!(size > 0)) throw new RangeError('La medida nominal debe ser mayor que cero.');
  // FDM holes come out undersized: vertical holes by about 0.1 mm, horizontal ones flatten on top.
  const compensation = technology === 'FDM' ? (axis === 'horizontal' ? 0.2 : 0.1) : 0;
  const clearance = f[technology];
  return { fit: f, technology, shaft: size, hole: size + clearance + compensation, clearance, compensation, radial: (clearance + compensation) / 2 };
}
