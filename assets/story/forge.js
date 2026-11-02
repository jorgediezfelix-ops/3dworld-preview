/* 3DWORLD / "Así nace una pieza": one flange, four states driven by scroll progress.
   Scan (point cloud) → CAD (edges and dimensions) → print (clipped layers) → inspection (deviation map).
   Loaded on demand by storytelling.js; renders only while the stage is on screen. */
import * as THREE from '../vendor/three-0.170.0/three.module.min.js';
export { chapterProgress } from './progress.mjs';

const HEIGHT = 0.62;            // model units; 1 unit = 100 mm
const LAYER_MM = 0.2;
const LAYERS = Math.round(HEIGHT * 100 / LAYER_MM);
const ICE = new THREE.Color('#b9e2f7');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);

function ring(outer, inner, depth, y, holes = []) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  for (const [x, z, r] of [[0, 0, inner], ...holes]) {
    const hole = new THREE.Path();
    hole.absarc(x, z, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 72 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

function rib(angle) {
  const profile = new THREE.Shape([
    new THREE.Vector2(0.6, 0.12), new THREE.Vector2(0.93, 0.12),
    new THREE.Vector2(0.93, 0.165), new THREE.Vector2(0.6, 0.5),
  ]);
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: 0.05, bevelEnabled: false });
  geometry.translate(0, 0, -0.025);
  geometry.rotateY(angle);
  return geometry;
}

function flange() {
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return [Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.066];
  });
  return [
    ring(1, 0.46, 0.12, 0, bolts),
    ring(0.62, 0.46, 0.44, 0.12),
    ring(0.68, 0.46, 0.06, 0.56),
    ...Array.from({ length: 8 }, (_, i) => rib(i * Math.PI / 4 + Math.PI / 8)),
  ];
}

/* Area-weighted surface sampling: the cloud reads like a real scan, dense on large faces. */
function sample(geometries, count) {
  const tris = [], areas = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let total = 0;
  for (const source of geometries) {
    const position = (source.index ? source.toNonIndexed() : source).attributes.position;
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
      total += new THREE.Triangle(a, b, c).getArea();
      areas.push(total); tris.push(a.clone(), b.clone(), c.clone());
    }
  }
  const points = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const target = Math.random() * total;
    let lo = 0, hi = areas.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < target) lo = mid + 1; else hi = mid; }
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const [p, q, r] = [tris[lo * 3], tris[lo * 3 + 1], tris[lo * 3 + 2]];
    points[i * 3] = p.x + (q.x - p.x) * u + (r.x - p.x) * v;
    points[i * 3 + 1] = p.y + (q.y - p.y) * u + (r.y - p.y) * v;
    points[i * 3 + 2] = p.z + (q.z - p.z) * u + (r.z - p.z) * v;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

function dimensions() {
  const t = 0.035, s = [];
  const line = (x1, y1, x2, y2) => s.push(x1, y1, 0, x2, y2, 0);
  // Diameter: extension lines, dimension line and oblique terminators.
  line(-1, 0.14, -1, 0.84); line(1, 0.14, 1, 0.84); line(-1, 0.78, 1, 0.78);
  line(-1 - t, 0.78 - t, -1 + t, 0.78 + t); line(1 - t, 0.78 - t, 1 + t, 0.78 + t);
  // Height.
  line(1.04, 0, 1.24, 0); line(0.72, HEIGHT, 1.24, HEIGHT); line(1.18, 0, 1.18, HEIGHT);
  line(1.18 - t, -t, 1.18 + t, t); line(1.18 - t, HEIGHT - t, 1.18 + t, HEIGHT + t);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(s, 3));
  return geometry;
}

export function mountForge({ canvas, compact = false, onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  const group = new THREE.Group();
  group.position.y = -HEIGHT / 2;
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xdcecf6, 0x0a1620, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb7dc, 1.8); rim.position.set(-4, 2, -3); scene.add(rim);

  const parts = flange();
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const uniforms = { uClip: { value: 0 }, uGlow: { value: 0 }, uDev: { value: 0 }, uDevScan: { value: -2 } };
  const solid = new THREE.MeshStandardMaterial({ color: 0xe6eae7, roughness: 0.58, metalness: 0.04, clippingPlanes: [clip] });
  solid.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; uniform float uClip, uGlow, uDev, uDevScan;
        vec3 deviation(vec3 p){
          float n = sin(p.x*5.3 + sin(p.z*3.1)*1.7) * cos(p.y*7.0 + p.z*2.3) * .5 + .5;
          n = clamp(n * 1.15 - .07, 0., 1.);
          vec3 low = vec3(.13,.39,.80), mid = vec3(.27,.78,.68), high = vec3(.97,.69,.27);
          return n < .5 ? mix(low, mid, n * 2.) : mix(mid, high, n * 2. - 1.);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float layer = smoothstep(0., .22, abs(fract(vObj.y * 155.) - .5));
        diffuseColor.rgb *= mix(.9, 1., layer);
        float measured = uDev * step(vObj.x, uDevScan);
        diffuseColor.rgb = mix(diffuseColor.rgb, deviation(vObj), measured);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(.45,.75,1.) * exp(-max(uClip - vObj.y, 0.) * 70.) * uGlow;
        totalEmissiveRadiance += vec3(.55,.85,1.) * exp(-abs(vObj.x - uDevScan) * 40.) * uDev * .7;`);
  };
  const cap = new THREE.MeshBasicMaterial({ color: 0x9fd6f5, side: THREE.BackSide, clippingPlanes: [clip] });
  const solids = new THREE.Group();
  for (const geometry of parts) solids.add(new THREE.Mesh(geometry, solid), new THREE.Mesh(geometry, cap));
  solids.visible = false;
  group.add(solids);

  const edgeGeometries = parts.map(g => new THREE.EdgesGeometry(g, 24));
  const edgeMaterial = new THREE.LineDashedMaterial({ color: 0xa9d4ee, dashSize: 0, gapSize: 9, transparent: true, opacity: 0, depthWrite: false });
  let edgeCount = 0, longest = 0;
  for (const geometry of edgeGeometries) {
    const lines = new THREE.LineSegments(geometry, edgeMaterial);
    lines.computeLineDistances();
    const distances = geometry.attributes.lineDistance.array;
    for (let i = 1; i < distances.length; i += 2) longest = Math.max(longest, distances[i]);
    edgeCount += geometry.attributes.position.count / 2;
    group.add(lines);
  }

  const dims = new THREE.LineSegments(dimensions(), new THREE.LineDashedMaterial({ color: 0xcfe7f5, dashSize: 0, gapSize: 9, transparent: true, opacity: 0, depthWrite: false }));
  dims.computeLineDistances();
  group.add(dims);

  const pointCount = compact ? 12000 : 22000;
  const cloud = sample(parts, pointCount);
  const pointUniforms = { uScan: { value: -2 }, uFade: { value: 0 }, uSize: { value: 1 }, uColor: { value: ICE } };
  const points = new THREE.Points(cloud, new THREE.ShaderMaterial({
    uniforms: pointUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uScan, uSize; attribute float aSeed; varying float vGlow, vSeen, vSeed;
      void main(){
        vec4 view = modelViewMatrix * vec4(position, 1.);
        float d = uScan - position.x;
        vSeen = step(0., d); vGlow = exp(-abs(d) * 22.); vSeed = aSeed;
        gl_PointSize = uSize * (2.1 + vGlow * 2.6 + aSeed * .9) * (3.6 / -view.z);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade; varying float vGlow, vSeen, vSeed;
      void main(){
        float r = length(gl_PointCoord - .5); if (r > .5) discard;
        float a = smoothstep(.5, .05, r) * (vSeen * (.7 + vSeed * .3) + (1. - vSeen) * .12 + vGlow) * uFade;
        gl_FragColor = vec4(uColor + vGlow * vec3(.5, .45, .3), a);
      }`,
  }));
  group.add(points);

  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uAlpha; varying vec2 vUv;
      void main(){ float edge = smoothstep(0., .18, vUv.y) * smoothstep(1., .82, vUv.y);
        float core = exp(-abs(vUv.x - .5) * 260.);
        gl_FragColor = vec4(.72, .9, 1., (core * .9 + .05) * edge * uAlpha * .55); }`,
  }));
  sweep.rotation.y = Math.PI / 2;
  sweep.position.y = HEIGHT / 2;
  group.add(sweep);

  const anchors = { diameter: new THREE.Vector3(0, 0.86, 0), height: new THREE.Vector3(1.27, HEIGHT / 2, 0) };
  const projected = new THREE.Vector3();
  const state = { target: 0, progress: 0, tiltX: 0, tiltY: 0, pointerX: 0, pointerY: 0, width: 1, height: 1, running: false, frame: 0, time: 0 };

  function layout() {
    const box = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width)), height = Math.max(1, Math.round(box.height));
    if (width === state.width && height === state.height) return;
    state.width = width; state.height = height;
    const wide = width >= 900;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, wide ? 1.75 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const reach = wide ? 1.38 : 1.3;
    state.distance = Math.max(reach / vertical, reach / (vertical * Math.min(camera.aspect, wide ? 0.95 : camera.aspect))) * (wide ? 1.12 : 1.18);
    if (wide) camera.setViewOffset(width, height, -width * 0.2, 0, width, height);
    else camera.setViewOffset(width, height, 0, height * 0.17, width, height);
    camera.updateProjectionMatrix();
    pointUniforms.uSize.value = renderer.getPixelRatio() * (wide ? 1.15 : 1);
  }

  function draw() {
    const p = state.progress;
    const scan = span(p, 0.02, 0.2), cad = span(p, 0.26, 0.44), print = span(p, 0.5, 0.74), measure = span(p, 0.78, 0.93);
    // Scan: the cloud appears behind a moving laser plane, then condenses into edges.
    pointUniforms.uScan.value = -1.2 + scan * 2.4;
    pointUniforms.uFade.value = 1 - span(p, 0.3, 0.42);
    points.visible = pointUniforms.uFade.value > 0.001;
    // CAD: every edge draws from its start, like a drafting pass; dimensions follow.
    edgeMaterial.dashSize = cad * longest + 0.0001;
    edgeMaterial.opacity = span(p, 0.22, 0.28) * (1 - 0.62 * span(p, 0.52, 0.62)) * (1 - 0.7 * span(p, 0.8, 0.92));
    dims.material.dashSize = span(p, 0.34, 0.44) * 2.1 + 0.0001;
    dims.material.opacity = span(p, 0.32, 0.36) * (1 - span(p, 0.47, 0.52));
    dims.visible = dims.material.opacity > 0.001;
    // Print: the clipping plane rises one 0.2 mm layer at a time; the cut face glows.
    const layer = Math.round(print * LAYERS);
    uniforms.uClip.value = print >= 1 ? HEIGHT + 0.05 : layer / LAYERS * HEIGHT;
    clip.constant = group.position.y + uniforms.uClip.value;
    uniforms.uGlow.value = print > 0 && print < 1 ? 1 : 0;
    solids.visible = layer > 0;
    // Inspection: a second sweep paints the deviation map onto the finished part.
    uniforms.uDev.value = span(p, 0.76, 0.8);
    uniforms.uDevScan.value = -1.2 + measure * 2.4;
    const scanning = scan > 0 && scan < 1, inspecting = measure > 0 && measure < 1;
    sweep.visible = scanning || inspecting;
    sweep.position.x = scanning ? pointUniforms.uScan.value : uniforms.uDevScan.value;
    sweep.material.uniforms.uAlpha.value = scanning ? Math.sin(scan * Math.PI) : Math.sin(measure * Math.PI);

    const elevation = 0.5 - 0.1 * smooth(span(p, 0.74, 1));
    const distance = state.distance * (1 - 0.06 * smooth(span(p, 0.76, 1)));
    camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    camera.lookAt(0, 0, 0);
    group.rotation.y = -0.75 + p * 2.3 + state.time * 0.035 + state.tiltY;
    group.rotation.x = state.tiltX;
    renderer.render(scene, camera);

    group.updateMatrixWorld();
    const screen = vector => {
      projected.copy(vector).applyMatrix4(group.matrixWorld).project(camera);
      return { x: (projected.x * 0.5 + 0.5) * state.width, y: (-projected.y * 0.5 + 0.5) * state.height };
    };
    onFrame?.({
      progress: p, stage: Math.min(3, Math.floor(p * 4 + 0.0001)),
      points: pointCount, edges: edgeCount, layer, layers: LAYERS, z: layer * LAYER_MM,
      labels: dims.visible ? { opacity: dims.material.opacity, diameter: screen(anchors.diameter), height: screen(anchors.height) } : null,
    });
  }

  function tick(now) {
    state.frame = 0;
    if (!state.running) return;
    state.time = now / 1000;
    state.progress += (state.target - state.progress) * 0.11;
    if (Math.abs(state.target - state.progress) < 0.0004) state.progress = state.target;
    state.tiltX += (state.pointerY * 0.08 - state.tiltX) * 0.06;
    state.tiltY += (state.pointerX * 0.18 - state.tiltY) * 0.06;
    layout();
    draw();
    state.frame = requestAnimationFrame(tick);
  }

  const resize = new ResizeObserver(() => { state.width = 0; if (!state.running) { layout(); draw(); } });
  resize.observe(canvas.parentElement);
  layout();
  draw();

  return {
    metrics: { points: pointCount, edges: edgeCount, layers: LAYERS },
    setProgress(value) { state.target = clamp(value); },
    setPointer(x, y) { state.pointerX = clamp(x, -1, 1); state.pointerY = clamp(y, -1, 1); },
    start() { if (state.running) return; state.running = true; state.frame = requestAnimationFrame(tick); },
    stop() { state.running = false; cancelAnimationFrame(state.frame); state.frame = 0; },
    dispose() {
      this.stop(); resize.disconnect();
      scene.traverse(node => { node.geometry?.dispose(); node.material?.dispose?.(); });
      parts.forEach(g => g.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
