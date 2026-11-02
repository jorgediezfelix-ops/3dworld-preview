// three.js viewport for herramientas.html: the part sits on a 250 mm print bed, Z up, millimetres.
// Renders on demand; analysis flags tint triangles; a Z section shows the inside; two clicks measure.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FLAG } from './geometry.mjs';

const PART = [201, 214, 226];
const TINTS = [[FLAG.open, [229, 72, 77]], [FLAG.nonManifold, [217, 70, 239]], [FLAG.flipped, [124, 92, 255]], [FLAG.thin, [34, 195, 238]], [FLAG.overhang, [240, 164, 58]]];
const CUT = 0x7ad7ff;

export function createViewer(host, { bed = [250, 250, 250], onMeasure = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 20000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  // The wheel scrolls the page until the visitor clicks or touches the model; then it zooms.
  controls.enableZoom = false;
  renderer.domElement.addEventListener('pointerdown', () => { controls.enableZoom = true; host.classList.add('is-active'); });
  renderer.domElement.addEventListener('pointerleave', () => { controls.enableZoom = false; host.classList.remove('is-active'); });
  const sky = new THREE.HemisphereLight(0xf4f8ff, 0x1a2633, 1.5);
  sky.position.set(0, 0, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(220, -320, 420);
  const rim = new THREE.DirectionalLight(0x9fdcff, 0.6);
  rim.position.set(-300, 260, 120);
  scene.add(sky, key, rim, bedLines(bed));

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
  const markers = new THREE.Group();
  scene.add(markers);
  let part = null, cut = null, wire = null, flags = null, overlay = 0, size = [0, 0, 0];

  let pending = false;
  const frame = () => { pending = false; controls.update(); renderer.render(scene, camera); };
  const request = () => { if (!pending) { pending = true; requestAnimationFrame(frame); } };
  controls.addEventListener('change', request);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    request();
  };
  new ResizeObserver(resize).observe(host);

  function paint() {
    if (!part) return;
    const colors = part.geometry.getAttribute('color');
    const out = colors.array;
    for (let t = 0; t < out.length / 9; t++) {
      let rgb = PART;
      if (flags && overlay) for (const [bit, tint] of TINTS) if (flags[t] & overlay & bit) { rgb = tint; break; }
      for (let k = 0; k < 3; k++) out.set(rgb, t * 9 + k * 3);
    }
    colors.needsUpdate = true;
    request();
  }

  function clear() {
    for (const obj of [part, cut, wire]) if (obj) { scene.remove(obj); obj.geometry.dispose(); obj.material.dispose(); }
    part = cut = wire = null;
    clearMeasure();
  }

  function show(positions, options = {}) {
    clear();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    g.computeBoundingBox();
    const b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(positions.length), 3, true));
    g.computeBoundingSphere();
    size = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    part = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04, clippingPlanes: [plane] }));
    cut = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: CUT, side: THREE.BackSide, clippingPlanes: [plane] }));
    scene.add(part, cut);
    flags = options.flags || null;
    paint();
    if (options.keepView) request(); else view('iso');
  }

  function view(name) {
    const radius = part ? part.geometry.boundingSphere.radius : 140;
    const target = new THREE.Vector3(0, 0, part ? size[2] / 2 : 0);
    const dirs = { iso: [1, -1.25, 0.9], frente: [0, -1, 0.02], arriba: [0.0001, -0.0001, 1], derecha: [1, 0, 0.02] };
    const dir = new THREE.Vector3(...(dirs[name] || dirs.iso)).normalize();
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.08;
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.near = distance / 100; camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
    request();
  }

  function setWireframe(on) {
    if (wire) { scene.remove(wire); wire.geometry.dispose(); wire.material.dispose(); wire = null; }
    if (on && part) {
      wire = new THREE.LineSegments(new THREE.WireframeGeometry(part.geometry), new THREE.LineBasicMaterial({ color: 0x0b1622, transparent: true, opacity: 0.35, clippingPlanes: [plane] }));
      scene.add(wire);
    }
    request();
  }

  // share: 0–1 of the part height, or null to show it whole.
  function section(share) {
    plane.constant = share == null || !part ? 1e6 : Math.max(0.01, share * size[2]);
    request();
  }

  function setOverlay(mask) { overlay = mask; paint(); }
  function setFlags(next) { flags = next; paint(); }

  let measuring = false, picks = [];
  function clearMeasure() {
    picks = [];
    for (const m of [...markers.children]) { markers.remove(m); m.geometry.dispose(); m.material.dispose(); }
    request();
  }
  function measure(on) { measuring = on; clearMeasure(); renderer.domElement.style.cursor = on ? 'crosshair' : ''; }
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!measuring || !part || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(part, false).find(h => h.point.z <= plane.constant + 1e-6);
    if (!hit) return;
    if (picks.length === 2) clearMeasure();
    picks.push(hit.point.clone());
    const dot = new THREE.Mesh(new THREE.SphereGeometry(part.geometry.boundingSphere.radius / 45, 16, 12), new THREE.MeshBasicMaterial({ color: CUT, depthTest: false }));
    dot.position.copy(hit.point);
    dot.renderOrder = 2;
    markers.add(dot);
    if (picks.length === 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(picks), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false }));
      line.renderOrder = 2;
      markers.add(line);
      const [a, b] = picks;
      onMeasure({ distance: a.distanceTo(b), dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y), dz: Math.abs(b.z - a.z) });
    } else onMeasure(null);
    request();
  });

  resize();
  view('iso');
  return { show, view, section, setWireframe, setOverlay, setFlags, measure, clear, get size() { return size; } };
}

function bedLines([w, d]) {
  const minor = [], major = [];
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += 10) (Math.round(x + w / 2) % 50 ? minor : major).push(x, -d / 2, 0, x, d / 2, 0);
  for (let y = -d / 2; y <= d / 2 + 1e-6; y += 10) (Math.round(y + d / 2) % 50 ? minor : major).push(-w / 2, y, 0, w / 2, y, 0);
  const lines = (points, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  };
  const group = new THREE.Group();
  group.add(lines(minor, 0x6f8aa3, 0.18), lines(major, 0x9fb7cc, 0.34));
  return group;
}
