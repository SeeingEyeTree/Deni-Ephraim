import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ config */
const CFG = window.TREE_SITE || {};
const PROJECTS = (CFG.projects || []).slice(0, 10);
const isLive = (p) => p && !p.stub && p.title; // stubs keep their branch but stay unlit
// The ten branches of the model that carry projects, ordered so the first
// few projects land far apart from each other around the crown.
const SLOT_BOUGHS = ['Bough_01', 'Bough_05', 'Bough_07', 'Bough_03', 'Bough_12',
  'Bough_06', 'Bough_13', 'Bough_11', 'Bough_04', 'Bough_10'];
const MODEL_URL = CFG.model || 'assets/blue_tree.web.glb';
const GLOW = new THREE.Color('#7fe3ff');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const labelsEl = $('labels');
const panel = $('panel');
const indexEl = $('index');
const hud = $('hud');

/* ---------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let dprCap = 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const FOG = new THREE.Color('#c4c7cc');
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, 24, 78);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
camera.position.set(11.5, 5.2, 12.5);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 3.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minPolarAngle = Math.PI * 0.12;
controls.enablePan = false;
controls.autoRotate = !REDUCED;
controls.autoRotateSpeed = 0.35;
controls.addEventListener('start', () => { controls.autoRotate = false; $('hint').classList.add('gone'); });

scene.add(new THREE.HemisphereLight('#f2f6fb', '#80838a', 1.25));
const sun = new THREE.DirectionalLight('#f6f4f0', 1.6);
sun.position.set(6, 12, 5);
scene.add(sun);

/* -------------------------------------------------------------------- wind */
const U = { clipA: { value: new THREE.Vector3() }, clipB: { value: new THREE.Vector3() }, clipR: { value: 0 }, time: { value: 0 }, wind: { value: REDUCED ? 0 : 1 }, flutter: { value: REDUCED ? 0 : 1 } };
const WIND_GLSL = /* glsl */`
uniform float uTime; uniform float uWind;
vec3 windOffset(vec3 p){
  float h = smoothstep(1.5, 7.0, p.y);
  float r = length(p.xz);
  float a = uWind * h * (0.05 + 0.03 * r);
  return vec3(
    a * sin(uTime * 0.9 + p.x * 0.25 + p.z * 0.18) + a * 0.4 * sin(uTime * 2.1 + p.z * 0.9),
    a * 0.35 * sin(uTime * 1.3 + r * 0.8),
    a * 0.7 * cos(uTime * 0.7 + p.z * 0.22 - p.x * 0.15));
}`;
// While a project is open, anything inside a tube from the camera to the showcased object is
// not drawn, so leaves and twigs never sit in front of it.
const CLIP_DECL = 'uniform vec3 uClipA; uniform vec3 uClipB; uniform float uClipR; varying vec3 vClipPos;\n';
const CLIP_TEST = `if (uClipR > 0.0) { vec3 ab = uClipB - uClipA; float ct = clamp(dot(vClipPos - uClipA, ab) / dot(ab, ab), 0.0, 1.0);
  if (length(vClipPos - (uClipA + ab * ct)) < uClipR) discard; }\n`;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// CPU mirror of the shader, for the handful of points labels and hero leaves follow
function windOffset(p, out) {
  const t = U.time.value, h = smooth(1.5, 7, p.y), r = Math.hypot(p.x, p.z);
  const a = U.wind.value * h * (0.05 + 0.03 * r);
  return out.set(
    a * Math.sin(t * 0.9 + p.x * 0.25 + p.z * 0.18) + a * 0.4 * Math.sin(t * 2.1 + p.z * 0.9),
    a * 0.35 * Math.sin(t * 1.3 + r * 0.8),
    a * 0.7 * Math.cos(t * 0.7 + p.z * 0.22 - p.x * 0.15));
}
function addWind(material, leaf) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.time;
    shader.uniforms.uWind = U.wind;
    shader.uniforms.uFlutter = U.flutter;
    shader.uniforms.uClipA = U.clipA; shader.uniforms.uClipB = U.clipB; shader.uniforms.uClipR = U.clipR;
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', CLIP_DECL + 'void main() {\n' + CLIP_TEST);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vClipPos;\n' + WIND_GLSL + (leaf ? '\nattribute vec2 aLeaf; uniform float uFlutter;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
        (leaf ? 'transformed += normal * (uFlutter * aLeaf.x * 0.05 * sin(uTime * 4.5 + aLeaf.y * 40.0));\n' : '') +
        'transformed += windOffset(position);\nvClipPos = transformed;');
    if (leaf) {
      // leaves carry soft "outward from the crown" normals; do not flip them on back faces
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
    }
  };
  material.customProgramCacheKey = () => (leaf ? 'wind-leaf' : 'wind-bark');
  return material;
}
const barkMat = addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), false);
const leafMat = addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), true);

function haloMaterial(xray) {
  return new THREE.ShaderMaterial({
    uniforms: { uClipA: U.clipA, uClipB: U.clipB, uClipR: U.clipR, uTime: U.time, uWind: U.wind, uColor: { value: GLOW }, uStrength: { value: 0.5 }, uInflate: { value: xray ? 0.012 : 0.05 } },
    vertexShader: WIND_GLSL + `
      uniform float uInflate; varying float vRim; varying vec3 vClipPos;
      void main(){
        vec3 p = position + normal * uInflate + windOffset(position);
        vClipPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vRim = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uStrength; varying float vRim;
      ` + CLIP_DECL + `void main(){ ` + CLIP_TEST + ` gl_FragColor = vec4(uColor * (0.25 + 0.75 * pow(vRim, 1.5)) * uStrength, 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: !xray, fog: false,
  });
}

/* -------------------------------------------------------------- small bits */
function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function heroLeafGeometry(L) {
  // a proper leaf: pointed oval, folded slightly along a bright midrib, hanging tip-down
  const n = 9, pos = [], col = [], idx = [];
  const edge = new THREE.Color('#2f9fe8'), mid = new THREE.Color('#e6f8ff');
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = -0.12 * L - t * L;
    const w = 0.30 * L * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8);
    pos.push(-w, y, -w * 0.28, 0, y, 0, w, y, -w * 0.28);
    col.push(edge.r, edge.g, edge.b, mid.r, mid.g, mid.b, edge.r, edge.g, edge.b);
    if (i < n) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const s0 = pos.length / 3; // stem
  pos.push(-0.012 * L, 0, 0, 0.012 * L, 0, 0, 0, -0.14 * L, 0);
  col.push(1, 1, 1, 1, 1, 1, 1, 1, 1);
  idx.push(s0, s0 + 2, s0 + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function leafGeometry(s) {
  const g = new THREE.BufferGeometry();
  const p = [0, 0, 0, -0.21, 0.28, -0.03, -0.23, 0.66, -0.02, 0, 1, 0.03, 0.23, 0.66, -0.02, 0.21, 0.28, -0.03].map((v) => v * s);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4]);
  g.computeVertexNormals();
  return g;
}
const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------- environment */
function buildEnvironment() {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshLambertMaterial({ color: '#b6b9be' }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(40,46,58,0.42)'], [0.45, 'rgba(40,46,58,0.22)'], [1, 'rgba(40,46,58,0)']]),
    transparent: true, depthWrite: false, fog: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  scene.add(shadow);

  // rocks, standing stones and far hills: all gray, merged into one draw call
  const parts = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rock = (x, z, sx, sy, sz, detail) => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.82 + 0.36 * Math.abs(Math.sin(pos.getX(i) * 12.9 + pos.getY(i) * 78.2 + pos.getZ(i) * 37.7 + x));
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.scale(sx, sy, sz);
    g.rotateY(rnd() * 6.28);
    g.translate(x, sy * 0.25, z);
    const shade = 0.42 + rnd() * 0.14;
    const col = new Float32Array(pos.count * 3).fill(shade);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  for (let i = 0; i < 16; i++) {
    const a = rnd() * 6.28, r = 5.5 + rnd() * 13;
    const s = 0.35 + rnd() * 0.9;
    rock(Math.cos(a) * r, Math.sin(a) * r, s * (1 + rnd()), s * (0.6 + rnd() * 0.5), s, 0);
  }
  for (let i = 0; i < 5; i++) { // standing stones
    const a = 0.7 + i * 1.26 + rnd() * 0.4, r = 15 + rnd() * 7;
    rock(Math.cos(a) * r, Math.sin(a) * r, 0.8 + rnd() * 0.5, 2.6 + rnd() * 2.2, 0.7 + rnd() * 0.4, 0);
  }
  for (let i = 0; i < 9; i++) { // hills in the fog
    const a = i * 0.7 + rnd() * 0.3, r = 46 + rnd() * 22;
    rock(Math.cos(a) * r, Math.sin(a) * r, 12 + rnd() * 10, 4 + rnd() * 6, 10 + rnd() * 8, 1);
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  scene.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
}

/* -------------------------------------------------------------------- tree */
const tree = new THREE.Group();
scene.add(tree);
const boughs = {};          // name -> { barkGeo, leafGeo, path[], tip }
const slots = [];           // one per project
const pathPoints = [];      // every centre-line point, used to spawn falling leaves

function bakeGeometry(mesh, leaf) {
  // The web copy of the model is quantized; bake it to plain world-space floats once at load
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry, m = mesh.matrixWorld, n = src.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(m).toArray(P, i * 3);
    v.fromBufferAttribute(src.attributes.normal, i).transformDirection(m).toArray(N, i * 3);
    v.fromBufferAttribute(src.attributes.color, i).toArray(C, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (leaf) {
    const L = new Float32Array(n * 2), uv = src.attributes.uv;
    for (let i = 0; i < n; i++) { L[i * 2] = uv.getX(i); L[i * 2 + 1] = uv.getY(i); }
    g.setAttribute('aLeaf', new THREE.BufferAttribute(L, 2));
  }
  g.setIndex(src.index);
  g.computeBoundingSphere();
  g.boundingSphere.radius += 0.6; // room for the sway
  return g;
}

/* What hangs at the tip of a project branch and gets zoomed in on. In projects.js:
 *   leaf: { image: 'assets/x.png', size: 1.2 }          a picture, always facing the viewer
 *   leaf: { model: 'assets/x.glb', size: 1.2, spin: true, turn: 90 }   a 3D model
 * With no "leaf" the branch gets the default glowing leaf. */
const assetLoader = new GLTFLoader();
function loadGLB(url, ok, progress, bad) {
  const b64 = (window.TREE_ASSETS_B64 || {})[url]; // hosted preview embeds models; a normal site fetches them
  if (b64) assetLoader.parse(decodeB64(b64), '', ok, bad);
  else assetLoader.load(url, ok, progress, bad);
}
function makeHero(leaf, leafGeo) {
  const hero = new THREE.Group();
  const fallback = () => hero.add(new THREE.Mesh(leafGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
  if (!leaf || (!leaf.image && !leaf.model)) { fallback(); return { hero, size: 0.9, billboard: false, spin: false }; }
  const size = leaf.size || 1.2;
  if (leaf.image) {
    new THREE.TextureLoader().load(leaf.image, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const a = tex.image.width / tex.image.height;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(a >= 1 ? size : size * a, a >= 1 ? size / a : size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, fog: false }));
      m.position.y = -size / 2;
      hero.add(m);
    }, undefined, () => { console.warn('leaf image failed to load:', leaf.image); fallback(); });
    return { hero, size, billboard: true, spin: false };
  }
  loadGLB(leaf.model, (gltf) => {
    const obj = gltf.scene;
    obj.rotation.y = THREE.MathUtils.degToRad(leaf.turn || 0);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z);
    const holder = new THREE.Group(); // normalise: centred, longest side = size, hanging just below the tip
    obj.position.sub(c);
    holder.add(obj);
    holder.scale.setScalar(k);
    holder.position.y = -dim.y * k / 2;
    obj.traverse((o) => { if (o.isMesh && o.material) o.material.fog = false; });
    hero.add(holder);
  }, undefined, () => { console.warn('leaf model failed to load:', leaf.model); fallback(); });
  return { hero, size, billboard: false, spin: !!leaf.spin };
}

function buildTree(gltf) {
  gltf.scene.updateMatrixWorld(true);
  let trunkGeo;
  const plainBark = [], plainLeaves = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    // quantizing can push a mesh one node down, so look at the parent's name and extras too
    const full = o.name + ' ' + (o.parent ? o.parent.name : '');
    const id = (full.match(/Bough_\d+/) || [])[0];
    if (!id) { if (/Trunk/.test(full)) trunkGeo = bakeGeometry(o, false); return; }
    const b = (boughs[id] ||= {});
    if (/_Leaves/.test(o.name)) { b.leafGeo = bakeGeometry(o, true); return; }
    b.barkGeo = bakeGeometry(o, false);
    const data = o.userData.path ? o.userData : o.parent.userData;
    const raw = data.path || [];
    b.path = [];
    for (let i = 0; i < raw.length; i += 3) b.path.push(new THREE.Vector3(raw[i], raw[i + 1], raw[i + 2]));
    b.tip = new THREE.Vector3().fromArray(data.tip || raw.slice(-3));
    pathPoints.push(...b.path.slice(3));
  });
  const used = new Set(SLOT_BOUGHS.filter((_, i) => isLive(PROJECTS[i])));
  for (const [name, b] of Object.entries(boughs)) {
    if (used.has(name)) continue;
    plainBark.push(b.barkGeo);
    plainLeaves.push(b.leafGeo);
  }
  // everything that is not a project branch collapses into two draw calls
  tree.add(new THREE.Mesh(mergeGeometries([trunkGeo, ...plainBark]), barkMat));
  if (plainLeaves.length) tree.add(new THREE.Mesh(mergeGeometries(plainLeaves), leafMat));

  const glowTex = radialTexture([[0, 'rgba(190,240,255,1)'], [0.25, 'rgba(127,227,255,0.55)'], [1, 'rgba(127,227,255,0)']]);
  const heroGeo = heroLeafGeometry(0.8);

  PROJECTS.forEach((project, i) => {
    const b = boughs[SLOT_BOUGHS[i]];
    if (!b || !isLive(project)) return;
    const bark = new THREE.Mesh(b.barkGeo, addWind(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: GLOW, emissiveIntensity: 0.6 }), false));
    const leaves = new THREE.Mesh(b.leafGeo, addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color('#1b6fc4'), emissiveIntensity: 0.25 }), true));
    const halo = new THREE.Mesh(b.barkGeo, haloMaterial(false));
    const xray = new THREE.Mesh(b.barkGeo, haloMaterial(true));
    halo.renderOrder = 2;
    xray.renderOrder = 3;
    tree.add(bark, leaves, halo, xray);

    const out = new THREE.Vector3(b.tip.x, 0, b.tip.z);
    if (out.lengthSq() < 0.04) out.set(1, 0, 0);
    out.normalize();
    const anchor = b.tip.clone().addScaledVector(out, 0.85).add(new THREE.Vector3(0, -0.1, 0));
    const { hero, size, billboard, spin } = makeHero(project.leaf, heroGeo);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sprite.scale.setScalar(1.7);
    tree.add(hero, sprite);

    const view = new THREE.Vector3().subVectors(anchor, new THREE.Vector3(0, 4.4, 0));
    view.y = Math.min(0.45, Math.max(-0.05, view.y / (view.length() || 1))) * Math.hypot(view.x, view.z);
    view.normalize();
    slots.push({
      i: slots.length, project, b, bark, leaves, halo, xray, hero, size, billboard, spin, sprite, anchor, out, view,
      slug: project.slug || String(project.title || 'project-' + (i + 1)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      phase: slots.length * 1.7, hover: 0, dim: 1, foc: 0, yaw: Math.atan2(out.x, out.z), label: null, cur: anchor.clone(), screen: [],
    });
  });
}

/* ---------------------------------------------------- falling + fallen leaves */
const LEAF_COLORS = ['#0f3f8f', '#1560bd', '#1e86dd', '#38a9ee', '#6cc9f5', '#a9e4fb'].map((c) => new THREE.Color(c));
const FALL_N = 56;
let falling = null;
const fallState = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function buildLeaves() {
  const geo = leafGeometry(0.3);
  geo.translate(0, -0.15, 0);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  // static scatter under the crown
  const N = 320, fallen = new THREE.InstancedMesh(geo, mat, N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.283, r = 0.8 + Math.pow(Math.random(), 0.7) * 6.5;
    _e.set(-Math.PI / 2 + rand(-0.15, 0.15), 0, Math.random() * 6.283, 'YXZ');
    _m.compose(_p.set(Math.cos(a) * r, 0.02 + Math.random() * 0.01, Math.sin(a) * r), _q.setFromEuler(_e), _s.setScalar(rand(0.7, 1.2)));
    fallen.setMatrixAt(i, _m);
    fallen.setColorAt(i, LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0]);
  }
  scene.add(fallen);

  falling = new THREE.InstancedMesh(geo, mat, FALL_N);
  falling.frustumCulled = false;
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < FALL_N; i++) {
    fallState.push({ p: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), vy: 0, ph: 0, life: 0, rest: 0, s: 1 });
    respawn(fallState[i], true);
    falling.setColorAt(i, LEAF_COLORS[1 + ((Math.random() * (LEAF_COLORS.length - 1)) | 0)]);
  }
  scene.add(falling);
}
function respawn(f, scatter) {
  const src = pathPoints[(Math.random() * pathPoints.length) | 0] || _p.set(0, 5, 0);
  f.p.set(src.x + rand(-0.5, 0.5), src.y + rand(-0.4, 0.2), src.z + rand(-0.5, 0.5));
  if (scatter) f.p.y = rand(0.2, f.p.y);
  f.rot.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
  f.spin.set(rand(-1.6, 1.6), rand(-1.2, 1.2), rand(-1.6, 1.6));
  f.vy = rand(0.38, 0.75);
  f.ph = rand(0, 6.28);
  f.rest = 0;
  f.wait = scatter ? 0 : rand(0, 6);
  f.s = 0;
}
function updateFalling(dt) {
  if (!falling || !falling.visible) return;
  const t = U.time.value;
  for (let i = 0; i < FALL_N; i++) {
    const f = fallState[i];
    if (f.wait > 0) { f.wait -= dt; continue; }
    if (f.p.y > 0.03) {
      f.s = Math.min(1, f.s + dt * 2);
      f.p.y -= f.vy * dt;
      f.p.x += (Math.sin(t * 1.3 + f.ph) * 0.45 + 0.28) * dt;
      f.p.z += Math.cos(t * 1.1 + f.ph * 1.7) * 0.4 * dt;
      f.rot.x += f.spin.x * dt; f.rot.y += f.spin.y * dt; f.rot.z += f.spin.z * dt;
    } else {
      f.rest += dt;
      f.rot.x += (-Math.PI / 2 - f.rot.x) * Math.min(1, dt * 6);
      if (f.rest > 5) f.s = Math.max(0, f.s - dt * 0.8);
      if (f.s <= 0) respawn(f, false);
    }
    _m.compose(f.p, _q.setFromEuler(f.rot), _s.setScalar(f.s));
    falling.setMatrixAt(i, _m);
  }
  falling.instanceMatrix.needsUpdate = true;
}

/* -------------------------------------------------------------- labels / UI */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function buildUI() {
  $('brand-title').textContent = CFG.title || 'Projects';
  $('brand-sub').textContent = CFG.tagline || '';
  document.title = CFG.title || document.title;
  slots.forEach((s) => {
    const b = el('button', 'label');
    b.type = 'button';
    b.append(el('i'), el('span', null, s.project.short || s.project.title));
    b.addEventListener('click', () => focus(s));
    b.addEventListener('pointerenter', () => { hovered = s; });
    b.addEventListener('pointerleave', () => { if (hovered === s) hovered = null; });
    labelsEl.append(b);
    s.label = b;

    const li = el('li');
    const a = el('button', null, s.project.short || s.project.title);
    a.type = 'button';
    a.addEventListener('click', () => focus(s));
    a.addEventListener('pointerenter', () => { hovered = s; });
    a.addEventListener('pointerleave', () => { if (hovered === s) hovered = null; });
    a.addEventListener('focus', () => { hovered = s; });
    a.addEventListener('blur', () => { if (hovered === s) hovered = null; });
    li.append(a);
    indexEl.append(li);
    s.indexBtn = a;
  });
  $('panel-close').addEventListener('click', unfocus);
  $('panel-prev').addEventListener('click', () => step(-1));
  $('panel-next').addEventListener('click', () => step(1));
  $('index-toggle').addEventListener('click', () => document.body.classList.toggle('index-open'));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') unfocus();
    else if (focused && e.key === 'ArrowRight') step(1);
    else if (focused && e.key === 'ArrowLeft') step(-1);
    else if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) togglePerf();
  });
  window.addEventListener('hashchange', openFromHash);
}
function fillPanel(s) {
  const p = s.project;
  $('panel-kicker').textContent = [p.status, p.year].filter(Boolean).join(' · ') || 'Project';
  $('panel-title').textContent = p.title;
  $('panel-summary').textContent = p.summary || '';
  const body = $('panel-body');
  body.replaceChildren(...[].concat(p.body || []).map((t) => el('p', null, t)));
  $('panel-facts').replaceChildren(...(p.facts || []).flatMap((f) => [el('dt', null, f.label), el('dd', null, f.value)]));
  $('panel-tags').replaceChildren(...(p.tags || []).map((t) => el('li', null, t)));
  $('panel-links').replaceChildren(...(p.links || []).map((l) => {
    const a = el('a', 'link', l.label);
    a.href = l.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.append(el('span', 'arrow', '↗'));
    return a;
  }));
  $('panel-count').textContent = `${s.i + 1} / ${slots.length}`;
  $('panel-scroll').scrollTop = 0;
}

/* ------------------------------------------------------------ camera moves */
let clipSlot = null;
let focused = null, hovered = null, focusAmt = 0, tween = null, homePose = null;
const cyl = (v) => ({ a: Math.atan2(v.x, v.z), r: Math.hypot(v.x, v.z), y: v.y });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, amt, done) {
  const from = cyl(camera.position), to = cyl(pos);
  let da = to.a - from.a;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  tween = { from, to, da, t0: controls.target.clone(), t1: target.clone(), f0: focusAmt, f1: amt, start: performance.now(), dur: REDUCED ? 1 : 1300, done };
  controls.enabled = false;
}
function updateTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.start) / tween.dur), e = ease(k);
  const a = tween.from.a + tween.da * e, r = tween.from.r + (tween.to.r - tween.from.r) * e;
  camera.position.set(Math.sin(a) * r, tween.from.y + (tween.to.y - tween.from.y) * e, Math.cos(a) * r);
  controls.target.lerpVectors(tween.t0, tween.t1, e);
  focusAmt = tween.f0 + (tween.f1 - tween.f0) * e;
  camera.lookAt(controls.target);
  applyViewOffset();
  if (k >= 1) { const d = tween.done; tween = null; d && d(); }
}
function applyViewOffset() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (focusAmt < 0.002) { if (camera.view) camera.clearViewOffset(); return; }
  if (w >= 820) camera.setViewOffset(w, h, panel.offsetWidth * 0.5 * focusAmt, 0, w, h);
  else camera.setViewOffset(w, h, 0, panel.offsetHeight * 0.5 * focusAmt, w, h);
}
function focus(s) {
  if (focused === s) return;
  if (!focused) homePose = { pos: camera.position.clone(), target: controls.target.clone() };
  if (focused) focused.indexBtn.classList.remove('on');
  focused = s;
  hovered = null;
  controls.autoRotate = false;
  $('hint').classList.add('gone');
  fillPanel(s);
  s.indexBtn.classList.add('on');
  document.body.classList.add('focused');
  document.body.classList.remove('index-open');
  panel.setAttribute('aria-hidden', 'false');
  const dist = (canvas.clientWidth < 820 ? 5.2 : 3.6) * Math.max(1, s.size / 1.0); // the leaf gets the smaller share of the screen
  const look = s.anchor.clone().add(new THREE.Vector3(0, -s.size / 2, 0)); // centre of the hanging object
  clipSlot = s;
  flyTo(look.clone().addScaledVector(s.view, dist), look, 1);
  try { if (location.hash.slice(1) !== s.slug) location.hash = s.slug; } catch (_) { /* sandboxed */ }
  $('panel-close').focus({ preventScroll: true });
}
function unfocus() {
  if (!focused) return;
  focused.indexBtn.classList.remove('on');
  focused = null;
  document.body.classList.remove('focused');
  panel.setAttribute('aria-hidden', 'true');
  flyTo(homePose.pos, homePose.target, 0, () => { controls.enabled = true; });
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* sandboxed */ }
}
function step(d) {
  if (!focused || !slots.length) return;
  focus(slots[(focused.i + d + slots.length) % slots.length]);
}
function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'perf') { togglePerf(true); return; }
  const s = slots.find((x) => x.slug === h);
  if (s) focus(s);
  else if (!h && focused) unfocus();
}

/* --------------------------------------------------------- pointer picking */
const pointer = { x: -1e4, y: -1e4, downX: 0, downY: 0, inside: false };
canvas.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; });
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
canvas.addEventListener('pointerdown', (e) => { pointer.downX = e.clientX; pointer.downY = e.clientY; pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 6) return;
  if (focused) { unfocus(); return; }
  const s = pick(e.clientX, e.clientY, e.pointerType === 'touch' ? 34 : 22);
  if (s) focus(s);
});
function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / l));
  return Math.hypot(px - a.x - dx * t, py - a.y - dy * t);
}
// Screen-space pick against each project branch's centre line: forgiving, and no raycasting
function pick(x, y, tol) {
  let best = null, bd = tol;
  for (const s of slots) {
    for (let i = 1; i < s.screen.length; i++) {
      const a = s.screen[i - 1], b = s.screen[i];
      if (a.z > 1 || b.z > 1) continue;
      const d = segDist(x, y, a, b) - (i === s.screen.length - 1 ? 10 : 0);
      if (d < bd) { bd = d; best = s; }
    }
  }
  return best;
}

/* ------------------------------------------------------------- per frame */
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v, out) {
  _v.copy(v).project(camera);
  out.x = (_v.x * 0.5 + 0.5) * canvas.clientWidth;
  out.y = (-_v.y * 0.5 + 0.5) * canvas.clientHeight;
  out.z = _v.z;
  return out;
}
function updateProjects(dt) {
  const t = U.time.value;
  if (clipSlot) {
    U.clipA.value.copy(camera.position);
    U.clipB.value.copy(clipSlot.cur).y -= clipSlot.size / 2;
    U.clipR.value = clipSlot.size * 0.62 * smooth(0.5, 1, focusAmt);
  }
  const camA = Math.atan2(camera.position.x, camera.position.z);
  if (!focused && !tween && pointer.inside && !hoverFromDom()) hovered = pick(pointer.x, pointer.y, 20);
  canvas.style.cursor = hovered && !focused ? 'pointer' : '';
  for (const s of slots) {
    const on = (hovered === s || focused === s) ? 1 : 0;
    s.hover += (on - s.hover) * Math.min(1, dt * 8);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + s.phase);
    const k = Math.min(1, dt * 5);
    s.dim += ((focused && focused !== s ? 0.15 : 1) - s.dim) * k;
    s.foc += ((focused === s ? 1 : 0) - s.foc) * k;
    const dim = s.dim, calm = 1 - 0.6 * focusAmt; // quieter glow while a project is open
    s.bark.material.emissiveIntensity = (0.45 + 0.25 * pulse + 0.9 * s.hover) * dim * calm;
    s.leaves.material.emissiveIntensity = (0.16 + 0.1 * pulse + 0.35 * s.hover) * dim;
    s.halo.material.uniforms.uStrength.value = (0.4 + 0.25 * pulse + 0.8 * s.hover) * dim * calm;
    s.xray.material.uniforms.uStrength.value = (0.2 + 0.08 * pulse + 0.3 * s.hover) * dim * (1 - 0.9 * focusAmt);

    s.cur.copy(s.anchor).add(windOffset(s.b.tip, _w));
    s.hero.position.copy(s.cur);
    if (s.billboard) s.hero.quaternion.copy(camera.quaternion);
    else {
      const face = s.foc > 0.5 ? Math.atan2(camera.position.x - s.cur.x, camera.position.z - s.cur.z) : s.yaw;
      s.turn = s.turn === undefined ? face : s.turn + Math.atan2(Math.sin(face - s.turn), Math.cos(face - s.turn)) * Math.min(1, dt * 3);
      s.hero.rotation.set(0, s.turn + (s.spin ? t * 0.5 : Math.sin(t * 0.6 + s.phase) * 0.45 * U.wind.value), Math.sin(t * 1.1 + s.phase) * 0.08 * U.wind.value);
    }
    s.hero.scale.setScalar((1 + 0.35 * s.foc) * (0.25 + 0.75 * dim));
    s.sprite.position.copy(s.cur).y -= s.size / 2;
    s.sprite.material.opacity = (0.4 + 0.2 * pulse + 0.25 * s.hover) * dim * (1 - 0.8 * s.foc);
    s.sprite.scale.setScalar(1.15 + 0.2 * pulse + 0.4 * s.hover + 1.2 * s.foc);

    // screen-space centre line, for picking
    for (let i = 0; i < s.b.path.length; i++) {
      const p = s.b.path[i];
      project(_v.copy(p).add(windOffset(p, _w)), s.screen[i] ||= { x: 0, y: 0, z: 0 });
    }
    project(s.cur, s.screen[s.b.path.length] ||= { x: 0, y: 0, z: 0 });

    // label
    const sp = s.screen[s.b.path.length];
    const facing = Math.cos(Math.atan2(s.anchor.x, s.anchor.z) - camA);
    const vis = focused || sp.z > 1 ? 0 : smooth(-0.3, 0.25, facing); // far-side labels fade out
    s.label.style.transform = `translate3d(${sp.x.toFixed(1)}px,${sp.y.toFixed(1)}px,0) translate(-50%,-150%)`;
    s.label.style.opacity = vis.toFixed(2);
    s.label.style.zIndex = String(100 + Math.round(facing * 50));
    s.label.classList.toggle('hover', s.hover > 0.5);
    s.label.style.pointerEvents = vis < 0.05 ? 'none' : '';
  }
}
function hoverFromDom() {
  return hovered && (hovered.label.matches(':hover') || hovered.indexBtn.matches(':hover, :focus-visible'));
}

/* ------------------------------------------------ performance + quality */
const perf = { frames: [], cpu: [], sub: [], level: 0, accT: 0, accN: 0, warm: 0, shown: false, last: 0 };
const LEVELS = ['full', 'dpr 1.5', 'dpr 1', 'no falling leaves / flutter', 'no wind, no halos'];
function degrade() {
  if (perf.level >= LEVELS.length - 1) return;
  perf.level++;
  if (perf.level === 1) dprCap = 1.5;
  if (perf.level === 2) dprCap = 1;
  if (perf.level <= 2) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap)); resize(); }
  if (perf.level === 3) { if (falling) falling.visible = false; U.flutter.value = 0; }
  if (perf.level === 4) { U.wind.value = 0; slots.forEach((s) => { s.halo.visible = false; }); }
}
function recordPerf(dtMs, cpuMs, subMs) {
  if (dtMs > 1000) return; // tab was in the background
  perf.frames.push(dtMs); perf.cpu.push(cpuMs); perf.sub.push(subMs);
  if (perf.frames.length > 180) { perf.frames.shift(); perf.cpu.shift(); perf.sub.shift(); }
  perf.warm += dtMs;
  if (perf.warm < 1500) return; // ignore start-up hitches (shader compile, first upload)
  perf.accT += dtMs; perf.accN++;
  if (perf.accT >= 2000) {
    const avg = perf.accT / perf.accN;
    perf.accT = perf.accN = 0;
    if (avg > 21 && !tween) degrade(); // under ~48 fps for two seconds: shed load, one step at a time
  }
}
function togglePerf(force) {
  perf.shown = force === true ? true : !perf.shown;
  hud.hidden = !perf.shown;
}
function drawPerf(now) {
  if (!perf.shown || now - perf.last < 400 || !perf.frames.length) return;
  perf.last = now;
  const f = [...perf.frames].sort((a, b) => a - b);
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const cpu = perf.cpu.reduce((a, b) => a + b, 0) / perf.cpu.length;
  const sub = perf.sub.reduce((a, b) => a + b, 0) / perf.sub.length;
  const r = renderer.info.render;
  hud.textContent =
    `${(1000 / avg).toFixed(0)} fps   frame ${avg.toFixed(1)} ms   p95 ${f[Math.floor(f.length * 0.95)].toFixed(1)} ms\n` +
    `script ${cpu.toFixed(2)} ms   draw submit ${sub.toFixed(2)} ms\n` +
    `draw calls ${r.calls}   triangles ${(r.triangles / 1000).toFixed(1)}k\n` +
    `pixel ratio ${renderer.getPixelRatio().toFixed(2)}   quality: ${LEVELS[perf.level]}`;
}
window.__tree = { camera, controls, slots, scene, renderer };
window.__treePerf = () => {
  const f = [...perf.frames].sort((a, b) => a - b);
  const avg = f.reduce((a, b) => a + b, 0) / (f.length || 1);
  return {
    fps: +(1000 / avg).toFixed(1), frameMs: +avg.toFixed(2), p95Ms: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(2),
    scriptMs: +(perf.cpu.reduce((a, b) => a + b, 0) / (perf.cpu.length || 1)).toFixed(3),
    submitMs: +(perf.sub.reduce((a, b) => a + b, 0) / (perf.sub.length || 1)).toFixed(3),
    drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, programs: renderer.info.programs.length,
    pixelRatio: renderer.getPixelRatio(), level: LEVELS[perf.level],
  };
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 56 : 42; // pull back on portrait phones
  camera.updateProjectionMatrix();
  applyViewOffset();
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - last;
  last = now;
  const dt = Math.min(0.05, dtMs / 1000);
  const c0 = performance.now();
  U.time.value += dt;
  updateTween(now);
  if (!tween && !focused) controls.update();
  updateFalling(dt);
  updateProjects(dt);
  const c1 = performance.now();
  renderer.render(scene, camera);
  recordPerf(dtMs, c1 - c0, performance.now() - c1);
  drawPerf(now);
}

/* -------------------------------------------------------------------- boot */
function decodeB64(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function start(gltf) {
  buildTree(gltf);
  buildLeaves();
  buildUI();
  resize();
  renderer.compile(scene, camera);
  document.body.classList.add('ready');
  requestAnimationFrame((t) => { last = t; frame(t); });
  openFromHash();
}
function fail(err) {
  console.error(err);
  $('loader').textContent = location.protocol === 'file:'
    ? 'The tree model cannot load from a file:// page. Serve this folder (for example: python -m http.server) and open it over http.'
    : 'Could not load the tree model.';
}
buildEnvironment();
resize();
loadGLB(MODEL_URL, start, (e) => { if (e.total) $('loader-bar').style.transform = `scaleX(${e.loaded / e.total})`; }, fail);
