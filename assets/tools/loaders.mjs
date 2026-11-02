// Read STL, OBJ, 3MF and STEP files into a triangle soup (Float32Array, 9 numbers per triangle).
// three.js loaders and the STEP kernel load only when a file of that type arrives.
import { parseSTL } from './geometry.mjs';

const OCCT = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/';
export const FORMATS = ['stl', 'obj', '3mf', 'step', 'stp'];
export const MAX_BYTES = 150 * 1024 * 1024;

export function extension(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

// Bake every mesh of a three.js object into world coordinates.
function fromObject(root) {
  root.updateMatrixWorld(true);
  const chunks = [];
  root.traverse(node => {
    if (!node.isMesh) return;
    const g = (node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()).applyMatrix4(node.matrixWorld);
    chunks.push(g.getAttribute('position').array);
  });
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

let occt;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('No se pudo cargar el lector de STEP. Revisa tu conexión.'));
    document.head.append(s);
  });
}

async function readStep(buffer) {
  if (!occt) {
    if (!window.occtimportjs) await loadScript(OCCT + 'occt-import-js.js');
    occt = await window.occtimportjs({ locateFile: name => OCCT + name });
  }
  const result = occt.ReadStepFile(new Uint8Array(buffer), { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0008, angularDeflection: 0.3 });
  if (!result.success || !result.meshes.length) throw new Error('No encontramos sólidos en el archivo STEP.');
  const chunks = result.meshes.map(m => {
    const p = m.attributes.position.array, idx = m.index.array, out = new Float32Array(idx.length * 3);
    for (let i = 0; i < idx.length; i++) out.set([p[idx[i] * 3], p[idx[i] * 3 + 1], p[idx[i] * 3 + 2]], i * 3);
    return out;
  });
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export async function readFile(file, onStatus = () => {}) {
  const type = extension(file.name);
  if (!FORMATS.includes(type)) throw new Error('Usa un archivo STL, OBJ, 3MF o STEP.');
  if (file.size > MAX_BYTES) throw new Error('El archivo pesa más de 150 MB. Simplifica la malla o envíanoslo por correo.');
  const buffer = await file.arrayBuffer();
  let positions;
  if (type === 'stl') positions = parseSTL(buffer);
  else if (type === 'obj') {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
    positions = fromObject(new OBJLoader().parse(new TextDecoder().decode(buffer)));
  } else if (type === '3mf') {
    const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js');
    positions = fromObject(new ThreeMFLoader().parse(buffer));
  } else {
    onStatus('Convirtiendo el STEP a malla…');
    positions = await readStep(buffer);
  }
  if (!positions.length) throw new Error('El archivo no tiene geometría que podamos leer.');
  return { positions, format: type === 'stp' ? 'step' : type };
}
