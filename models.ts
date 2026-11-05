import * as THREE from 'three';
import { SPECIES } from './data';
import type { Species } from './data';

// ---------- Toon (anime cel) shading ----------
let grad: THREE.DataTexture | null = null;
export function gradientMap() {
  if (!grad) {
    // Two hard tones (lit / shadow) like hand-painted anime cels
    const d = new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]);
    grad = new THREE.DataTexture(d, 2, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
  }
  return grad;
}
// Anime rim light + cool shadow tint injected into every toon material
function animeShade(m: THREE.MeshToonMaterial) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', `
      { vec3 nV = normalize(normal); vec3 vD = normalize(vViewPosition);
        float rim = smoothstep(0.66, 0.74, 1.0 - max(dot(nV, vD), 0.0));
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.86, 0.9, 1.08), smoothstep(0.5, 0.2, lum) * 0.5);
        gl_FragColor.rgb += rim * 0.1 * vec3(1.0, 0.96, 0.88); }
      #include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => 'anime';
  return m;
}
const cache = new Map<string, THREE.MeshToonMaterial>();
export function mat(color: string, emissive = 0, fog = true) {
  const k = color + '|' + emissive + '|' + fog;
  let m = cache.get(k);
  if (!m) { m = animeShade(new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), emissive: emissive ? color : '#000000', emissiveIntensity: emissive, fog })); cache.set(k, m); }
  return m;
}
export function toon(color: string, extra: THREE.MeshToonMaterialParameters = {}) { return animeShade(new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra })); }
export const OUTLINE = new THREE.MeshBasicMaterial({ color: '#1e1418', side: THREE.BackSide });
// Natural-looking ground: speckled noise texture
const gtCache = new Map<string, THREE.CanvasTexture>();
export function groundTex(color: string, rep: number) {
  const k = color + rep; const hit = gtCache.get(k); if (hit) return hit;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d')!; const base = new THREE.Color(color);
  x.fillStyle = color; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { const c = base.clone().offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.12); x.fillStyle = c.getStyle(); const r = 1 + Math.random() * 4; x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, r, r * 0.6, Math.random() * 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  gtCache.set(k, t); return t;
}
export const OUTLINE_NF = new THREE.MeshBasicMaterial({ color: '#3b3550', side: THREE.BackSide, fog: false });

// Procedural physically-based terrain. This is intentionally separate from toon()
// so characters retain their original art direction while the landscape gains depth.
const terrainMapsCache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();
function makeTerrainMaps(color: string, repeat: number) {
  const key = `${color}|${repeat}`;
  const cached = terrainMapsCache.get(key); if (cached) return cached;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!; const base = new THREE.Color(color);
  ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
  // Broad organic patches plus fine grain; seamless enough for repeated ground tiles.
  for (let i = 0; i < 1800; i++) {
    const n = (Math.random() - 0.5);
    const c = base.clone().offsetHSL(n * 0.025, n * 0.16, n * 0.22);
    ctx.fillStyle = c.getStyle();
    const r = 1 + Math.random() * (i < 260 ? 13 : 3.5);
    ctx.globalAlpha = i < 260 ? 0.10 : 0.22;
    ctx.beginPath(); ctx.ellipse(Math.random() * S, Math.random() * S, r * (0.7 + Math.random()), r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const map = new THREE.CanvasTexture(cv); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = bumpCanvas.height = S;
  const bx = bumpCanvas.getContext('2d')!; const img = bx.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) { const v = 105 + Math.random() * 90; img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255; }
  bx.putImageData(img, 0, 0);
  const bump = new THREE.CanvasTexture(bumpCanvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(repeat, repeat); bump.anisotropy = 4;
  const result = { map, bump }; terrainMapsCache.set(key, result); return result;
}
export function terrainMat(color: string, repeat = 12) {
  const maps = makeTerrainMaps(color, repeat);
  // A fresh material per mesh is important: streamed chunks dispose their own materials.
  return new THREE.MeshStandardMaterial({ map: maps.map, bumpMap: maps.bump, bumpScale: 0.045, roughness: 0.96, metalness: 0.0 });
}

let clothMap: THREE.CanvasTexture | null = null;
const clothMaterials = new Map<string, THREE.MeshToonMaterial>();
function fabricMat(color: string) {
  let material = clothMaterials.get(color);
  if (material) return material;
  if (!clothMap) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!; ctx.fillStyle = '#efefef'; ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 4) { ctx.strokeStyle = y % 8 ? '#e1e1e1' : '#f9f9f9'; ctx.lineWidth = 0.65; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    for (let x = 0; x < 128; x += 4) { ctx.strokeStyle = x % 8 ? '#fafafa' : '#dcdcdc'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    clothMap = new THREE.CanvasTexture(cv); clothMap.wrapS = clothMap.wrapT = THREE.RepeatWrapping; clothMap.repeat.set(2, 3);
    clothMap.colorSpace = THREE.SRGBColorSpace;
  }
  material = toon(color, { map: clothMap });
  clothMaterials.set(color, material);
  return material;
}

// Inverted-hull outline for the anime ink line look
export function addOutline(root: THREE.Object3D, t = 0.03) {
  root.updateMatrixWorld(true);
  const list: THREE.Mesh[] = [];
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.noOutline && m.material instanceof THREE.MeshToonMaterial) list.push(m); });
  const ws = new THREE.Vector3();
  for (const m of list) {
    const ol = new THREE.Mesh(m.geometry, (m.material as THREE.MeshToonMaterial).fog ? OUTLINE : OUTLINE_NF); ol.userData.noOutline = true;
    m.getWorldScale(ws);
    ol.scale.set(Math.min(1.35, 1 + t / Math.max(0.03, ws.x)), Math.min(1.35, 1 + t / Math.max(0.03, ws.y)), Math.min(1.35, 1 + t / Math.max(0.03, ws.z)));
    m.add(ol);
  }
}

const geo = {
  sphere: new THREE.SphereGeometry(1, 24, 16), cone: new THREE.ConeGeometry(1, 1, 14), box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14), taper: new THREE.CylinderGeometry(1, 0.8, 1, 16), torus: new THREE.TorusGeometry(1, 0.25, 10, 24),
  ico: new THREE.IcosahedronGeometry(1, 1), arc: new THREE.TorusGeometry(1, 0.07, 6, 16, Math.PI * 0.6), cap: new THREE.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
};
type V3 = [number, number, number];
export function part(g: keyof typeof geo, m: THREE.Material, s: V3, p: V3, r: V3 = [0, 0, 0], parent?: THREE.Object3D, noOutline = false) {
  const mesh = new THREE.Mesh(geo[g], m); mesh.scale.set(...s); mesh.position.set(...p); mesh.rotation.set(...r); mesh.castShadow = !noOutline;
  if (noOutline) mesh.userData.noOutline = true;
  parent?.add(mesh); return mesh;
}
const WHITE = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const BLUSH = new THREE.MeshBasicMaterial({ color: '#ff7fa0', transparent: true, opacity: 0.5, depthWrite: false });

// Big sparkly anime eyes
function animeEyes(parent: THREE.Object3D, y: number, z: number, sp: number, size: number, iris: string, eyes: THREE.Object3D[], blush = true) {
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * sp, y, z); e.rotation.y = s * 0.28; parent.add(e); eyes.push(e);
    const ic = new THREE.Color(iris);
    part('sphere', new THREE.MeshBasicMaterial({ color: '#1e1418' }), [size * 0.88, size * 1.08, size * 0.33], [0, 0, -size * 0.02], [0, 0, 0], e, true);
    part('sphere', mat('#fffdf8'), [size * 0.8, size, size * 0.35], [0, 0, 0], [0, 0, 0], e, true);
    part('sphere', new THREE.MeshBasicMaterial({ color: ic.clone().multiplyScalar(0.55) }), [size * 0.66, size * 0.86, size * 0.3], [0, -size * 0.06, size * 0.11], [0, 0, 0], e, true);
    part('sphere', new THREE.MeshBasicMaterial({ color: ic }), [size * 0.58, size * 0.62, size * 0.3], [0, -size * 0.2, size * 0.13], [0, 0, 0], e, true);
    part('sphere', new THREE.MeshBasicMaterial({ color: ic.clone().lerp(new THREE.Color('#ffffff'), 0.45) }), [size * 0.42, size * 0.3, size * 0.3], [0, -size * 0.42, size * 0.15], [0, 0, 0], e, true);
    part('sphere', mat('#0b0612'), [size * 0.3, size * 0.42, size * 0.25], [0, -size * 0.08, size * 0.2], [0, 0, 0], e, true);
    part('sphere', WHITE, [size * 0.24, size * 0.26, size * 0.1], [-size * 0.2, size * 0.28, size * 0.34], [0, 0, 0], e, true);
    part('sphere', WHITE, [size * 0.11, size * 0.11, size * 0.08], [size * 0.22, -size * 0.34, size * 0.32], [0, 0, 0], e, true);
    part('sphere', WHITE, [size * 0.05, size * 0.05, size * 0.05], [size * 0.05, size * 0.4, size * 0.34], [0, 0, 0], e, true);
    // thick upper lash line with a little wing
    part('sphere', mat('#160c12'), [size * 0.92, size * 0.22, size * 0.38], [0, size * 0.84, 0], [0, 0, 0], e, true);
    part('cone', mat('#160c12'), [size * 0.12, size * 0.4, size * 0.1], [s * size * 0.82, size * 0.78, 0], [0, 0, s * -1.9], e, true);
    if (blush) part('sphere', BLUSH, [size * 0.55, size * 0.25, 0.01], [s * size * 0.45, -size * 1.25, -size * 0.05], [0, 0, 0], e, true);
  }
}
// Spiky anime fur tufts fanned out in an arc
export function fluff(parent: THREE.Object3D, m: THREE.Material, x: number, y: number, z: number, n: number, len: number, spread: number, dir: number, tilt = 0) {
  for (let i = 0; i < n; i++) { const a = dir + (i / Math.max(1, n - 1) - 0.5) * spread; part('cone', m, [len * 0.28, len, len * 0.22], [x + Math.sin(a) * len * 0.35, y - Math.cos(a) * len * 0.35, z], [tilt, 0, Math.PI + a], parent); }
}
function mouth(parent: THREE.Object3D, y: number, z: number, w: number, open = false) {
  if (open) { part('sphere', mat('#7a1a2a'), [w, w * 0.8, w * 0.4], [0, y, z], [0, 0, 0], parent, true); part('sphere', mat('#ff8aa0'), [w * 0.6, w * 0.35, w * 0.3], [0, y - w * 0.3, z + w * 0.15], [0, 0, 0], parent, true); }
  else [-1, 1].forEach(s => part('torus', mat('#3a1a22'), [w * 0.5, w * 0.5, w * 0.5], [s * w * 0.48, y, z], [0, 0, Math.PI], parent, true));
}

// ---------- Creatures (chibi anime mascots, each with its own silhouette) ----------
// Pet outfits (hats, bows, scarves...) placed on top of the head
export const PET_GEAR: Record<string, string> = { pethat: 'Party Hat', petcap: 'Sport Cap', petbow: 'Ribbon Bow', petscarf: 'Cozy Scarf', petflower: 'Flower Crown', petglasses: 'Cool Glasses' };
export function dressCreature(g: THREE.Group, acc?: string) {
  if (!acc || !PET_GEAR[acc]) return;
  const head = (g.userData.parts.head ?? g.userData.body) as THREE.Object3D; g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head); const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  const front = new THREE.Vector3(top.x, (box.min.y + box.max.y) / 2, box.max.z); const low = new THREE.Vector3(top.x, box.min.y, top.z);
  const w = Math.max(0.25, (box.max.x - box.min.x) * 0.5); const a = new THREE.Group(); let at = top;
  switch (acc) {
    case 'pethat': part('cone', mat('#ff5a8a'), [w * 0.45, w * 1.1, w * 0.45], [0, w * 0.5, 0], [0, 0, 0.15], a); part('sphere', mat('#ffe066'), [w * 0.14, w * 0.14, w * 0.14], [w * 0.08, w * 1.08, 0], [0, 0, 0], a); for (let i = 0; i < 3; i++) part('sphere', mat(['#ffe066', '#7ad0ff', '#ffffff'][i]), [w * 0.08, w * 0.08, w * 0.08], [Math.cos(i * 2) * w * 0.3, w * 0.3, Math.sin(i * 2) * w * 0.3], [0, 0, 0], a, true); break;
    case 'petcap': part('cap', mat('#3d7be0'), [w * 0.7, w * 0.6, w * 0.7], [0, -w * 0.05, 0], [0, 0, 0], a); part('box', mat('#3d7be0'), [w * 0.7, w * 0.06, w * 0.6], [0, 0, w * 0.6], [0.1, 0, 0], a); break;
    case 'petbow': [-1, 1].forEach(s => part('cone', mat('#ff4a6a'), [w * 0.25, w * 0.45, w * 0.12], [s * w * 0.25, w * 0.08, 0], [0, 0, s * Math.PI / 2], a)); part('sphere', mat('#ff4a6a'), [w * 0.12, w * 0.12, w * 0.12], [0, w * 0.08, 0], [0, 0, 0], a); break;
    case 'petflower': for (let i = 0; i < 7; i++) { const t = (i / 7) * Math.PI * 2; part('sphere', mat(['#ff8ad0', '#ffe066', '#ffffff', '#b48aff'][i % 4]), [w * 0.14, w * 0.14, w * 0.14], [Math.cos(t) * w * 0.55, w * 0.02, Math.sin(t) * w * 0.55], [0, 0, 0], a); } break;
    case 'petscarf': at = low; part('torus', mat('#e0302a'), [w * 0.75, w * 0.75, w * 1.4], [0, w * 0.05, 0], [Math.PI / 2, 0, 0], a); part('box', mat('#e0302a'), [w * 0.2, w * 0.55, w * 0.06], [w * 0.3, -w * 0.25, w * 0.6], [0, 0, 0.2], a); break;
    case 'petglasses': at = front; [-1, 1].forEach(s => part('torus', mat('#151515'), [w * 0.2, w * 0.2, w * 0.3], [s * w * 0.28, 0, 0.02], [0, 0, 0], a)); part('box', mat('#151515'), [w * 0.2, w * 0.03, w * 0.03], [0, 0, 0.02], [0, 0, 0], a); break;
  }
  addOutline(a, 0.012); head.worldToLocal(at); a.position.copy(at); const inv = new THREE.Vector3(); head.getWorldScale(inv); a.scale.set(1 / inv.x, 1 / inv.y, 1 / inv.z); head.add(a);
  g.userData.acc = acc;
}
// Floating text (damage numbers etc.)
export function textSprite(text: string, color: string) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d')!;
  x.font = 'bold 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = '#1e1418'; x.strokeText(text, 128, 66); x.fillStyle = color; x.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(cv); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(1.4, 0.7, 1); s.renderOrder = 10; return s;
}
export function buildCreature(spId: string, acc?: string): THREE.Group {
  const s = SPECIES[spId]; const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const c = mat(s.color), a = mat(s.accent), cream = mat('#fff4e0'); const parts: Record<string, THREE.Object3D> = {}; const eyes: THREE.Object3D[] = [];
  switch (spId) {
    case 'emberkit': case 'pyrelynx': {
      const big = spId === 'pyrelynx';
      part('sphere', c, big ? [0.42, 0.42, 0.72] : [0.36, 0.34, 0.48], [0, big ? 0.72 : 0.5, 0], [0, 0, 0], body);
      part('sphere', cream, big ? [0.3, 0.3, 0.4] : [0.26, 0.24, 0.3], [0, big ? 0.65 : 0.45, big ? 0.3 : 0.2], [0, 0, 0], body);
      const head = new THREE.Group(); head.position.set(0, big ? 1.35 : 0.98, big ? 0.55 : 0.28); body.add(head); parts.head = head;
      part('sphere', c, [0.48, 0.42, 0.42], [0, 0, 0], [0, 0, 0], head);
      part('sphere', cream, [0.3, 0.2, 0.2], [0, -0.14, 0.28], [0, 0, 0], head);
      part('sphere', mat('#3a1a1a'), [0.05, 0.035, 0.03], [0, -0.06, 0.42], [0, 0, 0], head, true);
      [-1, 1].forEach(x => { part('cone', c, [0.16, 0.42, 0.12], [x * 0.28, 0.42, -0.02], [0, 0, x * -0.35], head); part('cone', mat('#ffd36a', 0.6), [0.08, 0.24, 0.05], [x * 0.29, 0.43, 0.04], [0, 0, x * -0.35], head, true);
        [0, 1].forEach(k => part('box', mat('#fff'), [0.18, 0.008, 0.008], [x * 0.38, -0.1 - k * 0.05, 0.3], [0, 0, x * (0.15 - k * 0.25)], head, true)); });
      if (big) part('torus', mat('#ff9a2b', 0.6), [0.42, 0.42, 0.9], [0, -0.15, -0.05], [Math.PI / 2, 0, 0], head);
      animeEyes(head, 0.04, 0.37, 0.17, big ? 0.12 : 0.13, big ? '#c0402b' : '#e0701b', eyes); mouth(head, -0.16, 0.39, 0.035);
      const L = big ? 0.55 : 0.35; [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.25], [0.2, -0.25]].forEach(([x, z], i) => { const lg = new THREE.Group(); lg.position.set(x, L, z * (big ? 1.5 : 1)); body.add(lg); part('cyl', c, [0.08, L, 0.08], [0, -L / 2, 0], [0, 0, 0], lg); part('sphere', cream, [0.1, 0.07, 0.12], [0, -L, 0.03], [0, 0, 0], lg); parts['leg' + i] = lg; });
      const tails = new THREE.Group(); tails.position.set(0, big ? 0.8 : 0.55, big ? -0.68 : -0.42); body.add(tails); parts.tail = tails;
      (big ? [-0.3, 0, 0.3] : [-0.18, 0.18]).forEach(x => { part('sphere', c, [0.12, 0.12, 0.45], [x, 0.25, -0.25], [-0.8, x, 0], tails); part('sphere', mat('#ffb02b', 1.2), [0.13, 0.18, 0.13], [x * 1.4, 0.58, -0.5], [0, 0, 0], tails, true); });
      break;
    }
    case 'rillfin': case 'tidalisk': {
      const big = spId === 'tidalisk'; const segs = big ? 5 : 2;
      for (let i = 0; i < segs; i++) { const sz = 0.36 - i * (big ? 0.04 : 0.09); const m = part('sphere', c, [sz, sz, sz * 1.15], [0, 0.85, -0.3 - i * 0.42], [0, 0, 0], body); parts['seg' + i] = m; }
      const head = new THREE.Group(); head.position.set(0, 1.0, 0.25); body.add(head); parts.head = head;
      part('sphere', c, [0.5, 0.44, 0.46], [0, 0, 0], [0, 0, 0], head); part('sphere', mat('#eaf8ff'), [0.34, 0.22, 0.3], [0, -0.18, 0.2], [0, 0, 0], head);
      [-1, 1].forEach(x => { for (let k = 0; k < 3; k++) part('sphere', mat('#ff9ac8'), [0.06, 0.2, 0.06], [x * (0.45 + k * 0.03), 0.12 + k * 0.1, -0.05 - k * 0.08], [0, 0, x * (1.0 + k * 0.3)], head); });
      [-1, 1].forEach(x => { const fin = part('cone', a, [0.22, 0.4, 0.05], [x * 0.34, 0.72, -0.1], [0, 0, x * 1.9], body); parts['fin' + x] = fin; });
      part('sphere', new THREE.MeshToonMaterial({ color: '#bff0ff', transparent: true, opacity: 0.55, gradientMap: gradientMap() }), [0.26, 0.26, 0.26], [0, 1.42, -0.3], [0, 0, 0], body, true);
      if (big) part('cone', mat('#8ff0ff', 0.4), [0.45, 0.55, 0.08], [0, 0.48, -0.1], [0, 0, 0], head);
      animeEyes(head, 0.04, 0.39, 0.19, 0.14, '#1b6fe0', eyes); mouth(head, -0.14, 0.42, 0.04, true);
      parts.float = body; break;
    }
    case 'mossbun': case 'grovehorn': {
      const big = spId === 'grovehorn';
      part('sphere', c, big ? [0.55, 0.55, 0.72] : [0.45, 0.42, 0.45], [0, big ? 0.95 : 0.45, 0], [0, 0, 0], body);
      part('sphere', mat('#f2ffe0'), big ? [0.4, 0.4, 0.3] : [0.32, 0.3, 0.2], [0, big ? 0.88 : 0.4, big ? 0.48 : 0.32], [0, 0, 0], body);
      const head = new THREE.Group(); head.position.set(0, big ? 1.65 : 0.92, big ? 0.55 : 0.18); body.add(head); parts.head = head;
      part('sphere', c, [0.42, 0.38, 0.38], [0, 0, 0], [0, 0, 0], head);
      [-1, 1].forEach(x => { const ear = new THREE.Group(); ear.position.set(x * 0.2, 0.3, -0.05); ear.rotation.z = x * -0.3; head.add(ear); part('sphere', c, [0.12, 0.42, 0.06], [0, 0.35, 0], [0, 0, 0], ear); part('sphere', mat('#9de07a'), [0.07, 0.32, 0.03], [0, 0.35, 0.04], [0, 0, 0], ear, true); parts['ear' + x] = ear; });
      part('sphere', mat('#2b9b3b'), [0.12, 0.05, 0.12], [0, 0.4, 0.1], [0.3, 0, 0], head);
      if (big) { [-1, 1].forEach(x => { const ant = new THREE.Group(); ant.position.set(x * 0.16, 0.32, 0); head.add(ant); part('cyl', a, [0.05, 0.7, 0.05], [x * 0.15, 0.35, 0], [0, 0, x * -0.4], ant); part('ico', mat('#4ccc4c'), [0.24, 0.22, 0.24], [x * 0.35, 0.78, 0], [0, 0, 0], ant); part('ico', mat('#ff9ad5'), [0.07, 0.07, 0.07], [x * 0.42, 0.95, 0.1], [0, 0, 0], ant, true); });
        [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.4], [0.3, -0.4]].forEach(([x, z], i) => { const lg = new THREE.Group(); lg.position.set(x, 0.7, z); body.add(lg); part('cyl', a, [0.1, 0.7, 0.1], [0, -0.35, 0], [0, 0, 0], lg); parts['leg' + i] = lg; }); }
      else [-1, 1].forEach(x => part('sphere', c, [0.14, 0.09, 0.22], [x * 0.22, 0.07, 0.15], [0, 0, 0], body));
      part('sphere', mat('#ffffff'), [0.16, 0.16, 0.16], [0, big ? 0.95 : 0.45, big ? -0.72 : -0.45], [0, 0, 0], body);
      animeEyes(head, 0.0, 0.33, 0.15, 0.12, '#2b8a3b', eyes); mouth(head, -0.15, 0.36, 0.035);
      parts.hop = body; break;
    }
    case 'voltmite': case 'arcbeetle': {
      const big = spId === 'arcbeetle';
      [-1, 1].forEach(x => { const sh = part('sphere', c, [0.3, 0.3, 0.55], [x * 0.18, 0.62, -0.1], [0, 0, x * 0.18], body); parts['shell' + x] = sh; });
      part('sphere', mat('#2b2b40'), [0.33, 0.26, 0.38], [0, 0.5, 0.05], [0, 0, 0], body);
      const head = new THREE.Group(); head.position.set(0, 0.68, 0.42); body.add(head); parts.head = head;
      part('sphere', c, [0.36, 0.32, 0.32], [0, 0, 0], [0, 0, 0], head);
      for (let i = 0; i < 3; i++) [-1, 1].forEach(x => part('cyl', a, [0.03, 0.38, 0.03], [x * 0.32, 0.3, 0.2 - i * 0.22], [0, 0, x * 0.9], body));
      const hm = mat('#fff35a', 1.4);
      if (big) { [-1, 1].forEach(x => part('cone', a, [0.07, 0.6, 0.07], [x * 0.13, 0.4, 0.05], [0.3, 0, x * -0.3], head)); parts.arc = part('torus', hm, [0.14, 0.14, 0.14], [0, 0.72, 0.15], [0, 0, 0], head, true); }
      else [-1, 1].forEach(x => { part('cyl', a, [0.015, 0.3, 0.015], [x * 0.1, 0.3, 0], [0, 0, x * -0.3], head); part('sphere', hm, [0.06, 0.06, 0.06], [x * 0.18, 0.46, 0], [0, 0, 0], head, true); });
      part('sphere', hm, [0.1, 0.1, 0.1], [0, 0.85, -0.55], [0, 0, 0], body, true);
      animeEyes(head, 0.02, 0.27, 0.13, 0.11, '#1b9bff', eyes); mouth(head, -0.13, 0.3, 0.03, true);
      parts.jitter = body; break;
    }
    case 'pebblob': case 'cragmaul': {
      const big = spId === 'cragmaul';
      if (big) {
        part('ico', c, [0.7, 0.8, 0.55], [0, 1.3, 0], [0, 0, 0], body);
        const head = new THREE.Group(); head.position.set(0, 2.1, 0.15); body.add(head); parts.head = head;
        part('ico', a, [0.42, 0.38, 0.36], [0, 0, 0], [0, 0.4, 0], head);
        [-1, 1].forEach(x => { const arm = new THREE.Group(); arm.position.set(x * 0.75, 1.6, 0); body.add(arm); part('cyl', c, [0.15, 0.7, 0.15], [0, -0.35, 0], [0, 0, 0], arm); part('ico', a, [0.36, 0.36, 0.36], [0, -0.8, 0.05], [0, 0, 0], arm); parts['arm' + x] = arm;
          const lg = new THREE.Group(); lg.position.set(x * 0.35, 0.6, 0); body.add(lg); part('cyl', c, [0.2, 0.6, 0.2], [0, -0.3, 0], [0, 0, 0], lg); parts['leg' + (x + 1)] = lg; });
        animeEyes(head, 0.02, 0.33, 0.14, 0.11, '#ff8a00', eyes, false); mouth(head, -0.18, 0.34, 0.04);
      } else {
        part('sphere', new THREE.MeshToonMaterial({ color: s.color, gradientMap: gradientMap(), transparent: true, opacity: 0.9 }), [0.55, 0.46, 0.5], [0, 0.46, 0], [0, 0, 0], body);
        for (let i = 0; i < 6; i++) part('ico', mat(['#8a7a6a', '#c0a080', '#6a5a4a'][i % 3]), [0.11, 0.11, 0.11], [Math.cos(i * 1.1) * 0.32, 0.25 + (i % 3) * 0.2, -0.15 + Math.sin(i * 2) * 0.15], [i, i, 0], body);
        animeEyes(body, 0.55, 0.45, 0.16, 0.13, '#5a3a1a', eyes); mouth(body, 0.36, 0.5, 0.04, true);
      }
      parts.squash = body; break;
    }
    case 'gustwing': {
      part('sphere', c, [0.36, 0.34, 0.4], [0, 1.3, 0], [0, 0, 0], body); part('sphere', mat('#ffffff'), [0.26, 0.24, 0.2], [0, 1.22, 0.22], [0, 0, 0], body);
      part('cone', mat('#ffb02b'), [0.07, 0.18, 0.07], [0, 1.3, 0.44], [Math.PI / 2, 0, 0], body);
      [0, 1, 2].forEach(k => part('cone', a, [0.04, 0.22, 0.04], [(k - 1) * 0.08, 1.7, 0.05], [-0.3, 0, (k - 1) * 0.4], body));
      [-1, 1].forEach(x => { const w = new THREE.Group(); w.position.set(x * 0.3, 1.38, 0); body.add(w); part('sphere', a, [0.5, 0.05, 0.25], [x * 0.45, 0, 0], [0, 0, 0], w); part('sphere', c, [0.35, 0.05, 0.18], [x * 0.8, 0, -0.08], [0, x * 0.3, 0], w); parts['wing' + x] = w; });
      for (let i = 0; i < 3; i++) part('sphere', a, [0.06, 0.03, 0.3], [(i - 1) * 0.1, 1.28, -0.5], [0, (i - 1) * 0.3, 0], body);
      animeEyes(body, 1.4, 0.32, 0.14, 0.11, '#2b6a9b', eyes);
      parts.float = body; break;
    }
    case 'shadeling': case 'duskwraith': {
      const big = spId === 'duskwraith';
      part('cone', c, big ? [0.6, 1.5, 0.6] : [0.42, 0.9, 0.42], [0, big ? 1.1 : 0.75, 0], [Math.PI, 0, 0], body);
      const head = new THREE.Group(); head.position.set(0, big ? 1.95 : 1.32, 0); body.add(head); parts.head = head;
      part('sphere', c, big ? [0.48, 0.46, 0.46] : [0.4, 0.38, 0.38], [0, 0, 0], [0, 0, 0], head);
      [-1, 1].forEach(x => part('cone', c, [0.1, 0.35, 0.08], [x * 0.25, 0.38, 0], [0, 0, x * -0.4], head));
      animeEyes(head, 0.04, big ? 0.38 : 0.31, 0.15, 0.13, s.accent, eyes, false);
      if (big) { [-1, 1].forEach(x => part('cone', c, [0.2, 1.3, 0.1], [x * 0.6, 1.4, -0.1], [0, 0, x * 2.6], body)); }
      part('sphere', new THREE.MeshBasicMaterial({ color: s.accent, transparent: true, opacity: 0.25, depthWrite: false }), [0.7, 0.7, 0.7], [0, 1.3, 0], [0, 0, 0], body, true);
      parts.float = body; break;
    }
    case 'frostnib': {
      part('sphere', c, [0.45, 0.4, 0.5], [0, 0.48, 0], [0, 0, 0], body);
      const head = new THREE.Group(); head.position.set(0, 0.55, 0.32); body.add(head); parts.head = head;
      part('sphere', mat('#f2fbff'), [0.3, 0.27, 0.27], [0, 0, 0], [0, 0, 0], head); part('sphere', mat('#2a3a5a'), [0.05, 0.04, 0.04], [0, -0.04, 0.27], [0, 0, 0], head, true);
      const ice = toon('#dff6ff', { emissive: '#5ac0ff', emissiveIntensity: 0.25 });
      for (let i = 0; i < 16; i++) { const th = (i / 16) * Math.PI * 2; const ph = 0.3 + (i % 3) * 0.35; part('cone', ice, [0.07, 0.42, 0.07], [Math.cos(th) * 0.32 * Math.cos(ph), 0.62 + Math.sin(ph) * 0.25, Math.sin(th) * 0.3 - 0.12], [Math.sin(th) * -0.9 - 0.5, 0, Math.cos(th) * -0.9], body); }
      animeEyes(head, 0.04, 0.23, 0.11, 0.1, '#3a8ac0', eyes); mouth(head, -0.1, 0.26, 0.025);
      parts.squash = body; break;
    }
    case 'ironmaw': {
      const m = toon('#7a8590', { emissive: '#101820', emissiveIntensity: 0.2 });
      part('box', m, [1.2, 0.9, 1.8], [0, 1.2, 0], [0, 0, 0], body);
      const jaw = new THREE.Group(); jaw.position.set(0, 1.2, 0.9); body.add(jaw);
      part('box', m, [1, 0.45, 0.9], [0, 0.25, 0.4], [0, 0, 0], jaw); parts.jaw = part('box', mat('#4a5560'), [0.95, 0.3, 0.85], [0, -0.25, 0.4], [0, 0, 0], jaw);
      for (let i = 0; i < 5; i++) part('cone', mat('#ffffff'), [0.06, 0.18, 0.06], [-0.35 + i * 0.18, -0.05, 0.8], [Math.PI, 0, 0], jaw, true);
      [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]].forEach(([x, z], i) => { const lg = new THREE.Group(); lg.position.set(x, 0.85, z); body.add(lg); part('cyl', m, [0.18, 0.85, 0.18], [0, -0.42, 0], [0, 0, 0], lg); parts['leg' + i] = lg; });
      for (let i = 0; i < 4; i++) part('cone', mat('#9a2bff', 1), [0.12, 0.4, 0.12], [0, 1.8, 0.6 - i * 0.4], [-0.3, 0, 0], body);
      [-1, 1].forEach(x => part('sphere', mat('#c06aff', 2), [0.1, 0.07, 0.05], [x * 0.3, 1.62, 1.36], [0, 0, 0], body, true));
      break;
    }
    default: buildGeneric(body, s, parts, eyes);
  }
  if (['emberkit', 'pyrelynx', 'mossbun', 'grovehorn', 'frostnib'].includes(spId) && parts.head) {
    [-1, 1].forEach(sd => fluff(parts.head, c, sd * 0.4, -0.12, 0, 3, 0.2, 0.9, sd * Math.PI / 2 + sd * 0.35));
    fluff(parts.head, c, 0, 0.36, 0.05, 3, 0.18, 0.8, Math.PI);
    if (spId.startsWith('ember') || spId === 'pyrelynx') fluff(body, cream, 0, spId === 'pyrelynx' ? 0.9 : 0.62, spId === 'pyrelynx' ? 0.6 : 0.36, 5, 0.18, 1.6, 0, -0.5);
  }
  body.scale.setScalar(s.scale);
  addOutline(body, 0.03);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.6 * s.scale, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
  g.userData = { body, parts, eyes, sp: spId, t: Math.random() * 10, flash: 0, attack: 0, moveKind: '', moveT: 0, moveTotal: 0.4, react: 0, reactKind: '', blink: 2 + Math.random() * 3, acc: '' };
  dressCreature(g, acc);
  return g;
}

export function animateCreature(g: THREE.Group, dt: number, moving: boolean) {
  const u = g.userData; u.t += dt * (moving ? 2.2 : 1); const t = u.t; const b = u.body as THREE.Group; const p = u.parts; const sc = SPECIES[u.sp].scale;
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.setScalar(sc);
  // idle breathing
  const br = 1 + Math.sin(t * 2.4) * 0.025; b.scale.y = sc * br; b.scale.x = sc / Math.sqrt(br);
  if (p.float) b.position.y = 0.15 + Math.sin(t * 3) * 0.12;
  if (p.hop) b.position.y = moving ? Math.abs(Math.sin(t * 6)) * 0.12 : 0;
  if (p.squash) { const s = 1 + Math.sin(t * (moving ? 10 : 3)) * 0.07; b.scale.y = sc * s; b.scale.x = sc / s; }
  if (p.jitter && moving) b.position.x = Math.sin(t * 40) * 0.03;
  u.still = moving ? 0 : (u.still ?? 0) + dt;
  const wag = moving ? 6 : u.still > 3 ? 2.2 : 4;
  if (p.tail) { p.tail.rotation.y = Math.sin(t * wag) * (moving ? 0.6 : 0.4) + Math.sin(t * wag * 2) * 0.08; p.tail.rotation.x = Math.sin(t * 2) * 0.15 + (moving ? 0.2 : 0); }
  if (p['wing-1']) { p['wing-1'].rotation.z = Math.sin(t * 12) * 0.6; p['wing1'].rotation.z = -Math.sin(t * 12) * 0.6; }
  if (p['fin-1']) { p['fin-1'].rotation.y = Math.sin(t * 5) * 0.3; p['fin1'].rotation.y = -Math.sin(t * 5) * 0.3; }
  for (let i = 0; i < 5; i++) if (p['seg' + i]) p['seg' + i].position.x = Math.sin(t * 3 - i * 0.8) * 0.12 * i;
  // ear twitches: quick flick every few seconds
  u.twitch = (u.twitch ?? 2) - dt; if (u.twitch < -0.25) u.twitch = 1.5 + Math.random() * 4;
  const tw = u.twitch < 0 ? Math.sin(-u.twitch * 40) * 0.35 : 0;
  if (p['ear-1']) { p['ear-1'].rotation.x = Math.sin(t * 3) * 0.08 + (moving ? -0.25 : 0); p['ear1'].rotation.x = Math.sin(t * 3 + 1) * 0.08 + (moving ? -0.25 : 0); p['ear1'].rotation.y = tw; }
  // diagonal trot gait (front-left with back-right)
  for (let i = 0; i < 4; i++) if (p['leg' + i]) p['leg' + i].rotation.x = moving ? Math.sin(t * 9 + ((i === 0 || i === 3) ? 0 : Math.PI)) * 0.65 : 0;
  if (p.head) {
    // look around while idle, head bob while walking
    const look = Math.sin(t * 0.35) > 0.6 ? 0.55 : Math.sin(t * 0.35) < -0.7 ? -0.5 : 0;
    u.lookY = (u.lookY ?? 0) + ((moving ? 0 : look) - (u.lookY ?? 0)) * Math.min(1, dt * 3);
    p.head.rotation.y = u.lookY + Math.sin(t * 0.7) * 0.06; p.head.rotation.z = moving ? 0 : Math.sin(t * 0.5) * 0.12 + (u.still > 5 ? 0.18 : 0);
    p.head.rotation.x = moving ? Math.sin(t * 18) * 0.06 : 0;
  }
  if (p.arc) p.arc.rotation.y += dt * 10;
  if (p.jaw) p.jaw.rotation.x = Math.max(0, Math.sin(t * 2)) * 0.3 + u.attack * 0.6;
  if (p['arm-1']) { p['arm-1'].rotation.x = Math.sin(t * 4) * (moving ? 0.6 : 0.1) - u.attack * 2; p['arm1'].rotation.x = -Math.sin(t * 4) * (moving ? 0.6 : 0.1); }
  if (!p.float && !p.hop && moving) { b.position.y = Math.abs(Math.sin(t * 9)) * 0.07; b.rotation.x = 0.05; b.rotation.z = Math.sin(t * 9) * 0.03; }
  // sit down after standing still for a while (4-legged pets)
  const sitK = Math.min(1, Math.max(0, (u.still - 3) * 1.5));
  if (sitK > 0 && p.leg2 && p.leg3 && !moving) { b.rotation.x = -0.32 * sitK; b.position.y -= 0.06 * sitK * sc; b.position.z = -0.08 * sitK; p.leg2.rotation.x = 1.1 * sitK; p.leg3.rotation.x = 1.1 * sitK; p.leg0.rotation.x = 0.3 * sitK; p.leg1.rotation.x = 0.3 * sitK; if (p.head) p.head.rotation.x = 0.32 * sitK; }
  // blink
  u.blink -= dt; const closed = u.blink < 0.12; if (u.blink < 0) u.blink = 2 + Math.random() * 4;
  (u.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = closed ? 0.1 : 1));
  // reactions (feed / love / happy)
  if (u.react > 0) {
    u.react -= dt; const r = u.react;
    if (u.reactKind === 'happy') { b.position.y += Math.abs(Math.sin(r * 7)) * 0.25; b.rotation.z = Math.sin(r * 10) * 0.12; (u.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = 0.35)); }
    else if (u.reactKind === 'eat') { if (p.head) p.head.rotation.x = Math.sin(r * 20) * 0.3; else b.rotation.x = Math.sin(r * 20) * 0.15; (u.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = 0.25)); }
    else if (u.reactKind === 'love') { const s = 1 + Math.sin(r * 14) * 0.1; b.scale.set(sc / s, sc * s, sc); b.rotation.z = Math.sin(r * 8) * 0.25; (u.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = 0.3)); }
  }
  if (u.attack > 0) { b.position.z += Math.sin(u.attack * Math.PI) * 0.5; u.attack = Math.max(0, u.attack - dt * 3); }
  if (u.moveT > 0) {
    u.moveT = Math.max(0, u.moveT - dt);
    const phase = 1 - u.moveT / Math.max(0.05, u.moveTotal), pulse = Math.sin(phase * Math.PI);
    // Attack poses vary by move family, rather than all pets doing one forward hop.
    switch (u.moveKind) {
      case 'light': b.rotation.y += (phase - 0.5) * 0.6; b.rotation.z += pulse * 0.16; if (p.head) p.head.rotation.x -= pulse * 0.15; break;
      case 'heavy': b.position.y -= pulse * 0.17; b.rotation.x -= pulse * 0.38; b.scale.y *= 1 - pulse * 0.12; if (p.head) p.head.rotation.x += pulse * 0.35; break;
      case 'projectile': b.rotation.x += pulse * 0.22; b.position.z += pulse * 0.18; if (p.head) p.head.rotation.x -= pulse * 0.4; if (p['wing-1']) { p['wing-1'].rotation.z += pulse * 0.4; p.wing1.rotation.z -= pulse * 0.4; } break;
      case 'melee': b.rotation.z += pulse * 0.4; b.position.z += pulse * 0.3; if (p['arm-1']) p['arm-1'].rotation.x -= pulse * 1.1; break;
      case 'dash': b.rotation.x += pulse * 0.45; b.scale.y *= 1 - pulse * 0.16; b.scale.z *= 1 + pulse * 0.18; if (p.tail) p.tail.rotation.x += pulse * 0.4; break;
      case 'aoe': b.position.y += pulse * 0.18; b.scale.multiplyScalar(1 + pulse * 0.18); if (p['wing-1']) { p['wing-1'].rotation.z += pulse; p.wing1.rotation.z -= pulse; } break;
      case 'heal': case 'buff': b.position.y += pulse * 0.12; b.rotation.y += pulse * 0.22; if (p.head) p.head.rotation.x -= pulse * 0.26; break;
    }
  }
  if (u.flash > 0) { u.flash -= dt; b.position.x += Math.sin(u.flash * 80) * 0.08; b.rotation.z += Math.sin(u.flash * 40) * 0.16; b.scale.y *= 0.9 + Math.min(0.1, u.flash * 0.5); }
}

// ---------- Anime humans with jointed limbs ----------
export interface HumanLook { skin: string; hair: string; hairColor: string; top: string; bottom: string; shoes: string; acc: string; pack: string; eye?: string; body?: string; coat?: string; coatA?: string; coatB?: string }
// Traditional geometric patterns painted on a canvas (checker, hexagon, wave scales, stripes, arrow feathers)
const patCache = new Map<string, THREE.CanvasTexture>();
export function patternTex(kind: string, a: string, b: string) {
  const key = kind + a + b; const hit = patCache.get(key); if (hit) return hit;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d')!;
  x.fillStyle = a; x.fillRect(0, 0, S, S); x.fillStyle = b; x.strokeStyle = b;
  if (kind === 'check') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32); }
  else if (kind === 'hex') { x.lineWidth = 5; for (let j = -1; j < 4; j++) for (let i = -1; i < 4; i++) { const cx = i * 44 + (j % 2 ? 22 : 0), cy = j * 38; x.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + Math.cos(an) * 24, cy + Math.sin(an) * 24); } x.closePath(); x.stroke(); } }
  else if (kind === 'wave') { x.lineWidth = 3; for (let j = 0; j < 6; j++) for (let i = -1; i < 5; i++) { const cx = i * 32 + (j % 2 ? 16 : 0), cy = j * 16 + 16; for (let r = 16; r > 2; r -= 5) { x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.stroke(); } } }
  else if (kind === 'stripe') { for (let i = 0; i < 8; i += 2) x.fillRect(i * 16, 0, 16, S); }
  else if (kind === 'arrow') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const ox = i * 32, oy = j * 32; x.beginPath(); if ((i + j) % 2) { x.moveTo(ox, oy); x.lineTo(ox + 16, oy + 10); x.lineTo(ox + 16, oy + 32); x.lineTo(ox, oy + 22); } else { x.moveTo(ox + 32, oy); x.lineTo(ox + 16, oy + 10); x.lineTo(ox + 16, oy + 32); x.lineTo(ox + 32, oy + 22); } x.closePath(); x.fill(); } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kind === 'stripe' ? 3 : 4, 2.5); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  patCache.set(key, t); return t;
}
export const COATS = ['none', 'check', 'hex', 'wave', 'stripe', 'arrow'];
export function buildHuman(look: HumanLook, scale = 1): THREE.Group {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const skin = mat(look.skin), top = fabricMat(look.top), bot = fabricMat(look.bottom), hairM = mat(look.hairColor), shoe = mat(look.shoes), white = mat('#f6f6f6');
  const legs: { thigh: THREE.Group; knee: THREE.Group }[] = [], arms: { sh: THREE.Group; el: THREE.Group }[] = []; const eyes: THREE.Object3D[] = [];
  const male = look.body === 'male' || (!look.body && ['spiky', 'buzz', 'short', 'messy', 'undercut'].includes(look.hair));
  const hips = new THREE.Group(); hips.position.y = 0.97; body.add(hips);
  part('box', bot, [male ? 0.36 : 0.4, 0.22, 0.24], [0, 0.02, 0], [0, 0, 0], hips);
  part('box', mat('#3a2a20'), [male ? 0.38 : 0.42, 0.05, 0.26], [0, 0.11, 0], [0, 0, 0], hips);
  part('box', mat('#d8c060'), [0.06, 0.05, 0.02], [0, 0.11, 0.135], [0, 0, 0], hips, true);
  for (const x of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(x * 0.1, 0, 0); hips.add(thigh);
    part('cyl', bot, [0.1, 0.46, 0.11], [0, -0.22, 0], [0, 0, 0], thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    part('cyl', bot, [0.09, 0.44, 0.1], [0, -0.21, 0], [0, 0, 0], knee);
    const foot = new THREE.Group(); foot.position.y = -0.44; knee.add(foot);
    part('box', shoe, [0.15, 0.1, 0.28], [0, -0.02, 0.05], [0, 0, 0], foot);
    part('box', white, [0.16, 0.045, 0.3], [0, -0.08, 0.05], [0, 0, 0], foot);
    part('sphere', white, [0.075, 0.05, 0.06], [0, -0.04, 0.19], [0, 0, 0], foot);
    for (let lace = 0; lace < 3; lace++) part('box', white, [0.105, 0.008, 0.015], [0, 0.036, -0.02 + lace * 0.055], [0, 0, 0], foot, true);
    part('box', white, [0.14, 0.034, 0.09], [0, -0.01, -0.09], [0, 0, 0], foot);
    legs.push({ thigh, knee, foot } as { thigh: THREE.Group; knee: THREE.Group });
  }
  const torso = new THREE.Group(); torso.position.y = 0.97; body.add(torso);
  part('taper', top, male ? [0.25, 0.56, 0.16] : [0.2, 0.52, 0.14], [0, 0.29, 0], [Math.PI, 0, 0], torso);
  const trim = mat(new THREE.Color(look.top).lerp(new THREE.Color('#ffffff'), 0.35).getStyle());
  [-1, 1].forEach(side => part('box', trim, [0.025, 0.49, 0.018], [side * (male ? 0.22 : 0.18), 0.3, 0.115], [0, 0, side * 0.14], torso, true));
  part('box', mat('#ded7c8'), [0.055, 0.51, 0.022], [0.005, 0.31, 0.149], [0, 0, 0], torso, true);
  for (let button = 0; button < 4; button++) part('sphere', mat('#eee1c3'), [0.014, 0.014, 0.01], [0.005, 0.14 + button * 0.115, 0.168], [0, 0, 0], torso, true);
  if (!male) part('sphere', top, [0.17, 0.1, 0.1], [0, 0.4, 0.07], [0, 0, 0], torso);
  part('box', mat('#ffffff'), [0.2, 0.06, 0.05], [0, 0.55, 0.11], [0.3, 0, 0], torso);
  [-1, 1].forEach(side => part('box', mat('#f6f1e8'), [0.095, 0.035, 0.07], [side * 0.075, 0.55, 0.1], [0, 0, side * 0.35], torso));
  part('cyl', skin, [0.06, 0.14, 0.06], [0, 0.6, 0], [0, 0, 0], torso);
  // Open long coat with a traditional pattern
  const coatM = (look.coat === '__never__' ? toon('#ffffff', { map: patternTex('check', '#000', '#fff') }) : null) as THREE.MeshToonMaterial | null; // long coats removed
  const sleeves: THREE.Mesh[] = []; let coatPivot: THREE.Group | null = null;
  if (coatM) {
    coatPivot = new THREE.Group(); coatPivot.position.y = 0.58; torso.add(coatPivot);
    const cg = new THREE.CylinderGeometry(male ? 0.27 : 0.23, male ? 0.37 : 0.34, 1.12, 20, 1, true, 0.42, Math.PI * 2 - 0.84);
    const coat = new THREE.Mesh(cg, coatM); coat.position.y = -0.56; coat.castShadow = true; coat.userData.noOutline = true; coatPivot.add(coat);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(male ? 0.372 : 0.342, male ? 0.375 : 0.345, 0.04, 20, 1, true, 0.42, Math.PI * 2 - 0.84), new THREE.MeshBasicMaterial({ color: '#1e1418', side: THREE.DoubleSide })); hem.position.y = -1.11; coatPivot.add(hem);
    [-1, 1].forEach(sd => part('box', mat('#1e1418'), [0.015, 1.1, 0.02], [Math.sin(sd * 0.42) * (male ? 0.32 : 0.29), -0.56, Math.cos(0.42) * (male ? 0.32 : 0.29)], [0, 0, 0], coatPivot!, true));
  }
  for (const x of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(x * (male ? 0.3 : 0.24), 0.5, 0); torso.add(sh);
    part('cyl', top, [0.075, 0.04, 0.08], [0, -0.3, 0], [0, 0, 0], sh, true);
    part('sphere', top, [0.08, 0.08, 0.08], [0, 0, 0], [0, 0, 0], sh);
    part('cyl', top, [0.065, 0.3, 0.07], [0, -0.15, 0], [0, 0, 0], sh);
    if (coatM) { const sl = part('box', coatM, [0.2, 0.34, 0.22], [x * 0.02, -0.2, 0], [0, 0, 0], sh); sl.userData.noOutline = true; sleeves.push(sl); part('box', mat('#1e1418'), [0.205, 0.02, 0.225], [x * 0.02, -0.37, 0], [0, 0, 0], sh, true); }
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    part('cyl', trim, [0.072, 0.055, 0.077], [0, -0.02, 0], [0, 0, 0], el);
    part('cyl', skin, [0.05, 0.27, 0.05], [0, -0.13, 0], [0, 0, 0], el);
    // Anime-style hands: palm, four individually modeled fingers, thumb and subtle nails.
    part('sphere', skin, [0.067, 0.073, 0.052], [0, -0.29, 0.012], [0, 0, 0], el);
    for (let finger = 0; finger < 4; finger++) {
      const fx = (finger - 1.5) * 0.029;
      const len = [0.075, 0.09, 0.086, 0.068][finger];
      part('sphere', skin, [0.014, len, 0.014], [fx, -0.345 - len * 0.35, 0.025], [0, 0, (finger - 1.5) * -0.07], el);
      part('sphere', mat('#f5d6c8'), [0.008, 0.012, 0.004], [fx, -0.345 - len * 0.68, 0.038], [0, 0, 0], el, true);
    }
    part('sphere', skin, [0.016, 0.065, 0.016], [x < 0 ? 0.068 : -0.068, -0.31, 0.035], [0, 0, x < 0 ? -0.75 : 0.75], el);
    arms.push({ sh, el });
  }
  const head = new THREE.Group(); head.position.set(0, 0.84, 0); torso.add(head);
  part('sphere', skin, [0.23, 0.25, 0.23], [0, 0, 0], [0, 0, 0], head);
  part('sphere', skin, [0.18, 0.15, 0.18], [0, -0.11, 0.03], [0, 0, 0], head);
  [-1, 1].forEach(x => part('sphere', skin, [0.04, 0.06, 0.03], [x * 0.225, -0.02, 0], [0, 0, 0], head));
  [-1, 1].forEach(side => part('sphere', new THREE.MeshBasicMaterial({ color: '#fff0e5', transparent: true, opacity: 0.24, depthWrite: false }), [0.055, 0.035, 0.009], [side * 0.15, -0.1, 0.182], [0, 0, 0], head, true));
  animeEyes(head, -0.02, 0.19, 0.085, male ? 0.06 : 0.072, look.eye ?? '#5a3a2a', eyes, !male);
  const brows: THREE.Group[] = [];
  [-1, 1].forEach(x => { const brow = new THREE.Group(); brow.position.set(x * 0.085, male ? 0.065 : 0.075, 0.215); brow.userData.baseY = brow.position.y; head.add(brow); part('box', hairM, [male ? 0.085 : 0.07, male ? 0.026 : 0.014, 0.02], [0, 0, 0], [0, 0, x * (male ? 0.08 : -0.15)], brow, true); brows.push(brow); });
  if (male) head.scale.set(0.97, 0.98, 0.97);
  const mouthNeutral = part('box', mat('#7a3a3a'), [0.04, 0.009, 0.01], [0, -0.135, 0.205], [0, 0, 0], head, true);
  const mouthSmile = part('arc', mat('#7a3039'), [0.043, 0.037, 0.04], [0, -0.122, 0.211], [0, 0, Math.PI * 0.73], head, true); mouthSmile.visible = true;
  const mouthOpen = part('sphere', mat('#82313c'), [0.026, 0.035, 0.009], [0, -0.131, 0.211], [0, 0, 0], head, true); mouthOpen.visible = false;
  part('sphere', mat(look.skin), [0.015, 0.012, 0.012], [0, -0.06, 0.232], [0, 0, 0], head, true);
  // hair
  const cap = part('cap', hairM, [0.255, 0.27, 0.262], [0, 0.01, -0.01], [-0.38, 0, 0], head);
  part('sphere', hairM, [0.235, 0.24, 0.2], [0, 0.0, -0.08], [0, 0, 0], head);
  if (look.hair !== 'buzz') {
    for (let i = 0; i < 6; i++) { const x = -0.15 + i * 0.06; part('cone', hairM, [0.055, 0.17, 0.04], [x, 0.12, 0.19 - Math.abs(x) * 0.35], [Math.PI - 0.25, 0, x * 1.2], head); }
    [-1, 1].forEach(x => part('cone', hairM, [0.06, 0.24, 0.05], [x * 0.21, -0.02, 0.06], [Math.PI, 0, x * -0.15], head));
  } else cap.scale.multiplyScalar(0.98);
  switch (look.hair) {
    case 'spiky': for (let i = 0; i < 8; i++) part('cone', hairM, [0.07, 0.24, 0.07], [Math.cos(i * 0.8) * 0.12, 0.24, -0.06 + Math.sin(i * 1.7) * 0.1], [-0.5 + Math.sin(i) * 0.3, 0, Math.cos(i * 0.8) * -0.7], head); break;
    case 'long': part('sphere', hairM, [0.24, 0.42, 0.13], [0, -0.26, -0.12], [0, 0, 0], head); [-1, 1].forEach(x => part('sphere', hairM, [0.07, 0.3, 0.07], [x * 0.2, -0.25, 0.04], [0, 0, 0], head)); break;
    case 'bob': [-1, 1].forEach(x => part('sphere', hairM, [0.1, 0.2, 0.18], [x * 0.19, -0.08, -0.02], [0, 0, 0], head)); break;
    case 'pony': part('sphere', hairM, [0.08, 0.08, 0.08], [0, 0.08, -0.25], [0, 0, 0], head); part('cone', hairM, [0.09, 0.45, 0.09], [0, -0.12, -0.32], [2.75, 0, 0], head); break;
    case 'bun': part('sphere', hairM, [0.12, 0.12, 0.12], [0, 0.26, -0.12], [0, 0, 0], head); break;
    case 'short': for (let i = 0; i < 5; i++) part('cone', hairM, [0.07, 0.16, 0.06], [-0.12 + i * 0.06, 0.2, 0.05 - Math.abs(i - 2) * 0.03], [-0.9, 0, (i - 2) * 0.3], head); break;
    case 'messy': for (let i = 0; i < 10; i++) part('cone', hairM, [0.07, 0.2, 0.06], [Math.cos(i * 0.63) * 0.15, 0.2 + (i % 3) * 0.02, Math.sin(i * 0.63) * 0.14 - 0.02], [Math.sin(i * 0.63) * -0.9, 0, Math.cos(i * 0.63) * -0.9], head); break;
    case 'undercut': part('sphere', hairM, [0.22, 0.12, 0.25], [0, 0.22, 0.0], [-0.2, 0, 0], head); part('cone', hairM, [0.1, 0.25, 0.08], [0.05, 0.25, 0.16], [-1.2, 0, -0.3], head); break;
  }
  const shine = mat(new THREE.Color(look.hairColor).lerp(new THREE.Color('#ffffff'), 0.45).getStyle());
  part('arc', shine, [0.272, 0.272, 0.272], [0, 0.02, -0.01], [-0.55, 0, Math.PI * 0.2], head, true);
  switch (look.acc) {
    case 'scarf': part('torus', mat('#ffd23b'), [0.14, 0.14, 0.35], [0, 0.6, 0], [Math.PI / 2, 0, 0], torso); part('box', mat('#ffd23b'), [0.08, 0.3, 0.03], [0.07, 0.42, 0.14], [0, 0, 0.1], torso); break;
    case 'hat': part('cap', mat('#2a2a35'), [0.26, 0.22, 0.27], [0, 0.07, -0.01], [-0.15, 0, 0], head); part('box', mat('#2a2a35'), [0.22, 0.02, 0.17], [0, 0.11, 0.27], [0.15, 0, 0], head); break;
    case 'goggles': part('torus', mat('#5a3a2a'), [0.24, 0.24, 0.3], [0, 0.12, 0], [Math.PI / 2 - 0.3, 0, 0], head); [-1, 1].forEach(x => part('cyl', mat('#5ad0ff', 0.4), [0.06, 0.04, 0.06], [x * 0.08, 0.17, 0.2], [Math.PI / 2 - 0.4, 0, 0], head)); break;
    case 'glasses': [-1, 1].forEach(x => part('torus', mat('#151515'), [0.055, 0.05, 0.05], [x * 0.085, -0.02, 0.235], [0, 0, 0], head, true)); part('box', mat('#151515'), [0.05, 0.01, 0.01], [0, 0, 0.24], [0, 0, 0], head, true); break;
  }
  switch (look.pack) {
    case 'satchel': part('box', mat('#8a5a2b'), [0.32, 0.26, 0.1], [0.12, 0.05, -0.18], [0, 0, 0], torso); part('box', mat('#6a3a1b'), [0.04, 0.7, 0.02], [0, 0.3, 0.13], [0, 0, 0.6], torso); break;
    case 'roll': part('box', mat('#5a6a4a'), [0.34, 0.4, 0.16], [0, 0.3, -0.22], [0, 0, 0], torso); part('cyl', mat('#c03b2b'), [0.08, 0.42, 0.08], [0, 0.56, -0.24], [0, 0, Math.PI / 2], torso); break;
    case 'big': part('box', mat('#3b5a8a'), [0.42, 0.55, 0.26], [0, 0.28, -0.26], [0, 0, 0], torso); part('box', mat('#ffd23b'), [0.26, 0.14, 0.05], [0, 0.18, -0.4], [0, 0, 0], torso); break;
  }
  body.scale.setScalar(scale);
  addOutline(body, 0.016);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
  g.userData = { coatPivot, sleeves, body, legs, arms, head, torso, hips, eyes, t: 0, emote: 0, emoteKind: 0, blink: 3 };
  g.userData.face = { brows, mouthNeutral, mouthSmile, mouthOpen };
  return g;
}

export function animateHuman(g: THREE.Group, dt: number, speed: number) {
  const u = g.userData; const moving = speed > 0.1; const run = Math.min(1, speed / 10);
  u.t += dt * (moving ? 4.5 + speed * 0.75 : 1.4);
  const A = moving ? 0.5 + run * 0.4 : 0; const s = Math.sin(u.t), c = Math.cos(u.t);
  const L = u.legs, R = u.arms;
  u.body.position.set(0, 0, 0); u.body.rotation.set(0, 0, 0); u.torso.rotation.set(0, 0, 0); u.hips.rotation.set(0, 0, 0); u.torso.scale.set(1, 1, 1);
  // full reset every frame so poses (skate, boat, sleep) never leave limbs twisted
  L.forEach((l: { thigh: THREE.Group; knee: THREE.Group; foot?: THREE.Group }) => { l.thigh.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); l.foot?.rotation.set(0, 0, 0); });
  R.forEach((a: { sh: THREE.Group; el: THREE.Group }) => { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); });
  u.head.rotation.set(0, 0, 0); u.hips.rotation.set(0, 0, 0);
  const F = L.map((l: { foot?: THREE.Group }) => l.foot);
  if (moving) {
    // leg i: swing phase when sin > 0 (knee lifts), stance when sin < 0 (straight leg, foot flat)
    [0, 1].forEach(i => {
      const ph = i ? s : -s, pc = i ? -c : c;
      L[i].thigh.rotation.x = ph * A - (pc > 0 ? pc * 0.15 * A : 0);
      const lift = Math.max(0, pc); L[i].knee.rotation.x = 0.06 + lift * A * (1.6 + run * 0.9);
      if (F[i]) F[i].rotation.x = -L[i].thigh.rotation.x - L[i].knee.rotation.x * 0.55 + (ph < -0.6 ? (ph + 0.6) * -0.9 : 0) + lift * 0.25;
    });
    const armA = A * (0.75 + run * 0.35);
    R[0].sh.rotation.set(s * armA, 0, -0.1 - run * 0.1); R[1].sh.rotation.set(-s * armA, 0, 0.1 + run * 0.1);
    R[0].el.rotation.x = -0.3 - run * 1.15 - Math.max(0, s) * 0.35; R[1].el.rotation.x = -0.3 - run * 1.15 - Math.max(0, -s) * 0.35;
    // double bob per cycle (lowest on contact), hip sway and counter-rotating shoulders
    u.body.position.y = (Math.abs(c) - 0.5) * 0.06 * (0.6 + run * 1.2);
    u.hips.rotation.y = -s * 0.16 * A; u.hips.rotation.z = c * 0.05; u.torso.rotation.y = s * 0.2 * A; u.torso.rotation.z = -c * 0.03;
    u.body.rotation.x = run * 0.2; u.torso.rotation.x = run * 0.08;
    u.head.rotation.set(-run * 0.16 + Math.abs(c) * 0.03, -s * 0.12 * A, c * 0.02);
    if (u.coatPivot) { u.coatPivot.rotation.x = -(0.08 + run * 0.35) - Math.abs(c) * 0.06; u.coatPivot.rotation.z = s * 0.04; }
    (u.sleeves as THREE.Mesh[]).forEach((sl, i) => (sl.rotation.x = 0.25 + run * 0.3 + Math.sin(u.t * 2 + i) * 0.1));
  } else {
    const br = Math.sin(u.t) * 0.012; u.torso.scale.y = 1 + br;
    L.forEach((l: { thigh: THREE.Group; knee: THREE.Group; foot?: THREE.Group }) => { l.thigh.rotation.x = 0; l.knee.rotation.x = 0.02; if (l.foot) l.foot.rotation.x = 0; });
    u.hips.rotation.z = Math.sin(u.t * 0.5) * 0.015;
    if (u.coatPivot) { u.coatPivot.rotation.x = Math.sin(u.t * 0.8) * 0.015; u.coatPivot.rotation.z = 0; }
    (u.sleeves as THREE.Mesh[]).forEach(sl => (sl.rotation.x = Math.sin(u.t * 0.8) * 0.03));
    R[0].sh.rotation.set(0.05, 0, -0.1 - br * 3); R[1].sh.rotation.set(0.05, 0, 0.1 + br * 3); R[0].el.rotation.x = -0.15; R[1].el.rotation.x = -0.15;
    u.head.rotation.set(Math.sin(u.t * 0.4) * 0.04, Math.sin(u.t * 0.3) * 0.2, 0);
  }
  u.blink -= dt; const closed = u.blink < 0.1; if (u.blink < 0) u.blink = 2.5 + Math.random() * 3;
  u.exprT = Math.max(0, (u.exprT ?? 0) - dt);
  const mood = u.exprT > 0 ? u.expression : u.emote > 0 ? ([0, 1, 3, 5, 11, 13].includes(u.emoteKind) ? 'happy' : u.emoteKind === 9 ? 'sleep' : [6, 7, 8, 15].includes(u.emoteKind) ? 'focused' : 'calm') : moving && run > 0.8 ? 'focused' : 'calm';
  const face = u.face as { brows: THREE.Group[]; mouthNeutral: THREE.Mesh; mouthSmile: THREE.Mesh; mouthOpen: THREE.Mesh };
  if (face) {
    face.mouthNeutral.visible = mood === 'calm' || mood === 'focused';
    face.mouthSmile.visible = mood === 'happy';
    face.mouthOpen.visible = mood === 'surprised' || mood === 'hurt';
    face.brows.forEach((brow, i) => { brow.position.y = brow.userData.baseY + (mood === 'surprised' ? 0.035 : mood === 'focused' ? -0.02 : 0); brow.rotation.z = mood === 'focused' ? (i ? 0.25 : -0.25) : mood === 'hurt' ? (i ? -0.35 : 0.35) : mood === 'happy' ? (i ? -0.08 : 0.08) : 0; });
  }
  (u.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = closed || mood === 'sleep' ? 0.08 : mood === 'happy' ? 0.7 : mood === 'focused' ? 0.85 : 1));
  if (u.emote > 0) {
    u.emote -= dt; const e = u.emote; const k = u.emoteKind;
    if (k === 0) { R[1].sh.rotation.set(0, 0, 2.7); R[1].el.rotation.set(0, 0, 0); R[1].el.rotation.z = Math.sin(e * 14) * 0.5; }
    if (k === 1) { R[0].sh.rotation.set(0, 0, -2.8); R[1].sh.rotation.set(0, 0, 2.8); u.body.position.y = Math.abs(Math.sin(e * 8)) * 0.35; }
    if (k === 2) { u.body.rotation.x = 0.55; R[0].sh.rotation.x = 0.2; R[1].sh.rotation.x = 0.2; }
    if (k === 3) { u.body.rotation.y = e * 8; R[0].sh.rotation.set(0, 0, -1.8 + Math.sin(e * 10) * 0.5); R[1].sh.rotation.set(0, 0, 1.8 + Math.sin(e * 10) * 0.5); u.body.position.y = Math.abs(Math.sin(e * 10)) * 0.15; }
    if (k === 14) { u.body.position.y = -0.47; L.forEach((l: { thigh: THREE.Group; knee: THREE.Group }) => { l.thigh.rotation.x = -1.5; l.knee.rotation.x = 1.5; }); R[0].sh.rotation.set(-0.35, 0, -0.1); R[1].sh.rotation.set(-0.35, 0, 0.1); R[0].el.rotation.x = -0.9; R[1].el.rotation.x = -0.9; u.head.rotation.y = Math.sin(u.t * 0.4) * 0.3; u.emote = Math.max(u.emote, 0.5); }
    if (k === 15) { const sw = Math.sin(e * 14); R[1].sh.rotation.set(-1.6 - sw * 0.9, 0, 0.3); R[1].el.rotation.x = -0.3; R[0].sh.rotation.set(-0.4, 0, -0.3); u.torso.rotation.y = -sw * 0.35; }
    if (k === 12) { const sw = Math.sin(e * 5); R[0].sh.rotation.set(-0.9, 0, 0.25 + sw * 0.35); R[1].sh.rotation.set(-0.6, 0, -0.1 + sw * 0.35); R[0].el.rotation.x = -0.5; R[1].el.rotation.x = -0.3; u.torso.rotation.y = sw * 0.25; u.torso.rotation.x = 0.2; u.head.rotation.x = 0.25; }
    if (k === 13) { const st = Math.sin(e * 1.5); R[0].sh.rotation.set(0, 0, -2.9 - st * 0.1); R[1].sh.rotation.set(0, 0, 2.9 + st * 0.1); u.torso.rotation.z = st * 0.12; u.head.rotation.x = -0.2; }
    if (k === 10) { u.body.position.y = -0.62; L.forEach((l: { thigh: THREE.Group; knee: THREE.Group; foot?: THREE.Group }) => { l.thigh.rotation.x = -1.45; l.knee.rotation.x = 0.35; if (l.foot) l.foot.rotation.x = 0; }); const rw = Math.sin(u.t * 2.2) * (u.rowing ? 0.6 : 0.1); R[0].sh.rotation.set(-1.1 + rw, 0, -0.2); R[1].sh.rotation.set(-1.1 + rw, 0, 0.2); R[0].el.rotation.x = -0.6 - rw * 0.5; R[1].el.rotation.x = -0.6 - rw * 0.5; u.torso.rotation.x = rw * 0.25; }
    if (k === 11) { u.body.rotation.y = Math.PI / 2; u.body.position.y = 0.12 + Math.sin(u.t * 3) * 0.015; L[0].thigh.rotation.set(-0.35, 0, 0.18); L[1].thigh.rotation.set(-0.35, 0, -0.18); L[0].knee.rotation.x = 0.7; L[1].knee.rotation.x = 0.7; R[0].sh.rotation.set(0, 0, -1.15 + (u.lean ?? 0)); R[1].sh.rotation.set(0, 0, 1.15 + (u.lean ?? 0)); R[0].el.rotation.x = -0.2; R[1].el.rotation.x = -0.2; u.torso.rotation.z = (u.lean ?? 0) * 0.6; u.head.rotation.set(0, -Math.PI / 2 + 0.2, 0); }
    if (k === 9) { (u.eyes as THREE.Object3D[]).forEach(ey => (ey.scale.y = 0.08)); u.torso.scale.y = 1 + Math.sin(e * 1.6) * 0.03; R[0].sh.rotation.set(-2.6, 0, 0.3); R[0].el.rotation.x = -1.6; R[1].sh.rotation.set(0.1, 0, 0.15); L[1].thigh.rotation.x = -0.4; L[1].knee.rotation.x = 0.7; u.head.rotation.set(0, 0.35, 0); u.emote = Math.max(u.emote, 0.5); }
    if (k === 6) { const sw = Math.sin(e * 9); R[0].sh.rotation.set(-2.2 + sw * 1.1, 0, 0.3); R[1].sh.rotation.set(-2.2 + sw * 1.1, 0, -0.3); R[0].el.rotation.x = -0.3; R[1].el.rotation.x = -0.3; u.torso.rotation.x = 0.15 + Math.max(0, sw) * 0.25; L[0].thigh.rotation.x = -0.3; L[1].thigh.rotation.x = 0.2; }
    if (k === 7) { R[1].sh.rotation.set(-1.2 + Math.sin(e * 3) * 0.1, 0, 0); R[1].el.rotation.x = -0.4; R[0].sh.rotation.set(-1.0, 0, 0.3); R[0].el.rotation.x = -0.8; u.head.rotation.x = 0.15; }
    if (k === 8) { u.body.position.y = -0.3; L.forEach((l: { thigh: THREE.Group; knee: THREE.Group }) => { l.thigh.rotation.x = -1.0; l.knee.rotation.x = 1.7; }); R[0].sh.rotation.set(-0.9 + Math.sin(e * 6) * 0.3, 0, 0); R[1].sh.rotation.set(-0.9 - Math.sin(e * 6) * 0.3, 0, 0); u.torso.rotation.x = 0.3; }
    if (k === 4 || k === 5) {
      u.body.position.y = -0.3; L.forEach((l: { thigh: THREE.Group; knee: THREE.Group }) => { l.thigh.rotation.x = -1.0; l.knee.rotation.x = 1.7; });
      u.torso.rotation.x = 0.35; u.head.rotation.x = 0.3;
      if (k === 4) { R[1].sh.rotation.set(-1.3, 0, 0); R[1].el.rotation.x = -0.2; }
      else { R[1].sh.rotation.set(-1.1 + Math.sin(e * 10) * 0.15, 0, 0); R[1].el.rotation.x = -0.5 + Math.sin(e * 10) * 0.2; R[0].sh.rotation.set(-0.9, 0, 0); }
    }
  }
}

// Floating emoji sprites (hearts, food, sparkles)
const spriteMats = new Map<string, THREE.SpriteMaterial>();
export function emojiSprite(e: string) {
  let m = spriteMats.get(e);
  if (!m) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const x = cv.getContext('2d')!;
    x.font = '72px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 48, 54);
    m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }); spriteMats.set(e, m);
  }
  return new THREE.Sprite(m.clone());
}

export function buildBoat() {
  const g = new THREE.Group(); const wood = mat('#a8683a'), dark = mat('#7a4622');
  const hull = part('sphere', wood, [0.95, 0.5, 2.3], [0, 0.05, 0], [0, 0, 0], g); hull.scale.y = 0.5;
  part('sphere', mat('#6a3a1a'), [0.82, 0.3, 2.1], [0, 0.22, 0], [0, 0, 0], g, true);
  part('torus', dark, [0.9, 2.25, 0.5], [0, 0.3, 0], [Math.PI / 2, 0, 0], g);
  [-0.7, 0.5].forEach(z => part('box', dark, [1.5, 0.08, 0.3], [0, 0.3, z], [0, 0, 0], g));
  part('box', mat('#e8e0d0'), [0.1, 0.5, 0.1], [0, 0.5, 2.1], [0.4, 0, 0], g);
  [-1, 1].forEach(sd => { const o = new THREE.Group(); o.position.set(sd * 0.9, 0.45, 0.1); g.add(o); part('cyl', mat('#c89a5a'), [0.03, 2, 0.03], [sd * 0.3, -0.1, 0], [0, 0, sd * 1.2], o); part('box', mat('#c89a5a'), [0.25, 0.04, 0.5], [sd * 1.15, -0.5, 0], [0, 0, sd * 1.2], o); g.userData['oar' + sd] = o; });
  addOutline(g, 0.03); return g;
}

export function buildSurfboard() {
  const g = new THREE.Group();
  const deck = mat('#ef7048');
  const rail = mat('#f5d28a');
  const top = part('box', deck, [0.72, 0.09, 2.45], [0, 0.12, 0], [0, 0, 0], g);
  top.scale.x = 0.78;
  part('box', rail, [0.42, 0.025, 1.65], [0, 0.18, 0.02], [0, 0, 0], g);
  part('cone', rail, [0.36, 0.12, 0.32], [0, 0.12, 1.25], [Math.PI / 2, 0, 0], g);
  [-0.2, 0, 0.2].forEach(x => part('box', mat('#263b55'), [0.045, 0.18, 0.18], [x, 0.02, -1.05], [0, 0, 0], g));
  addOutline(g, 0.018);
  return g;
}

export function buildSkate() {
  const g = new THREE.Group();
  part('box', mat('#ff5a6a'), [0.32, 0.05, 1.05], [0, 0.14, 0], [0, 0, 0], g); part('box', mat('#2a2a3a'), [0.3, 0.012, 0.95], [0, 0.17, 0], [0, 0, 0], g, true);
  [-1, 1].forEach(e => part('sphere', mat('#ff5a6a'), [0.16, 0.025, 0.12], [0, 0.15 + 0.02, e * 0.53], [e * -0.25, 0, 0], g));
  [-0.36, 0.36].forEach(z => { part('box', mat('#c8ccd0'), [0.3, 0.04, 0.08], [0, 0.09, z], [0, 0, 0], g); [-1, 1].forEach(x => part('cyl', mat('#ffe066'), [0.05, 0.05, 0.05], [x * 0.17, 0.05, z], [0, 0, Math.PI / 2], g)); });
  addOutline(g, 0.012); return g;
}
// Small jumping fish (pond / river / ocean)
export function buildFish(color: string, belly: string) {
  const g = new THREE.Group();
  part('sphere', mat(color), [0.13, 0.15, 0.34], [0, 0, 0], [0, 0, 0], g); part('sphere', mat(belly), [0.1, 0.09, 0.26], [0, -0.06, 0.02], [0, 0, 0], g);
  part('cone', mat(color), [0.14, 0.2, 0.03], [0, 0, -0.4], [-Math.PI / 2, 0, 0], g); part('cone', mat(color), [0.03, 0.14, 0.12], [0, 0.15, 0], [0, 0, 0], g);
  [-1, 1].forEach(s => { part('sphere', mat('#ffffff'), [0.035, 0.035, 0.02], [s * 0.1, 0.04, 0.2], [0, 0, 0], g, true); part('sphere', mat('#111111'), [0.02, 0.02, 0.015], [s * 0.11, 0.04, 0.21], [0, 0, 0], g, true); });
  addOutline(g, 0.012); return g;
}
// Hand tools for jobs
export function buildTool(kind: string) {
  const g = new THREE.Group();
  if (kind === 'wood') { part('cyl', mat('#8a5a2e'), [0.025, 0.6, 0.025], [0, -0.3, 0.05], [0, 0, 0], g); part('box', mat('#c8ccd0'), [0.04, 0.16, 0.2], [0, -0.55, 0.15], [0, 0, 0], g); }
  else if (kind === 'fish') { part('cyl', mat('#7a4a2a'), [0.015, 1.6, 0.015], [0, -0.3, 0.7], [1.2, 0, 0], g); part('sphere', mat('#ff4a4a'), [0.05, 0.05, 0.05], [0, -0.6, 1.4], [0, 0, 0], g); }
  else if (kind === 'water') { part('cyl', mat('#8a9aa8'), [0.12, 0.2, 0.12], [0, -0.38, 0.05], [0, 0, 0], g); part('cyl', toon('#5fd0ff', { emissive: '#2a8ac0', emissiveIntensity: 0.2 }), [0.1, 0.02, 0.1], [0, -0.29, 0.05], [0, 0, 0], g, true); }
  else if (kind === 'cook') part('cyl', mat('#3a3a40'), [0.14, 0.12, 0.14], [0, -0.38, 0.1], [0, 0, 0], g);
  else if (kind === 'dig') {
    part('cyl', mat('#835a3b'), [0.04, 0.82, 0.04], [0, -0.42, 0.04], [0, 0, -0.12], g);
    part('box', mat('#aeb9c4'), [0.58, 0.14, 0.16], [0, -0.88, 0.08], [0, 0, 0.1], g);
    [-1, 1].forEach(side => part('cone', mat('#dbe3e8'), [0.1, 0.34, 0.08], [side * 0.31, -0.88, 0.08], [0, 0, side * -Math.PI / 2], g));
  }
  else if (kind === 'racket') { part('cyl', mat('#2a2a3a'), [0.02, 0.4, 0.02], [0, -0.32, 0.1], [0.6, 0, 0], g); part('torus', mat('#e0302a'), [0.16, 0.22, 0.16], [0, -0.55, 0.38], [0.6, 0, 0], g); }
  else if (kind === 'broom') { part('cyl', mat('#a87a4a'), [0.022, 1.2, 0.022], [0, -0.5, 0.15], [0.5, 0, 0], g); part('cone', mat('#e0c070'), [0.13, 0.3, 0.06], [0, -1.05, 0.45], [0.5 + Math.PI, 0, 0], g); }
  else if (kind === 'can') { part('cyl', mat('#5aa04a'), [0.1, 0.16, 0.1], [0, -0.36, 0.06], [0, 0, 0], g); part('cyl', mat('#5aa04a'), [0.02, 0.22, 0.02], [0, -0.32, 0.22], [1.0, 0, 0], g); }
  addOutline(g, 0.012); return g;
}

// Generic body-plan builder used by the 70 data-driven species
function buildGeneric(body: THREE.Group, s: Species, parts: Record<string, THREE.Object3D>, eyes: THREE.Object3D[]) {
  const G = s.gen!; const c = mat(s.color), a = mat(s.accent), belly = mat('#fff6e6'); const f = G.f;
  const head = new THREE.Group(); let headR = 0.36; const tailAt = new THREE.Vector3(); let backY = 0.9, backZ = 0, faceOnBody = false;
  switch (G.plan) {
    case 'quad': {
      part('sphere', c, [0.42, 0.38, 0.62], [0, 0.66, 0], [0, 0, 0], body);
      if (f.has('b')) part('sphere', belly, [0.3, 0.28, 0.45], [0, 0.56, 0.08], [0, 0, 0], body);
      head.position.set(0, 1.1, 0.52);
      [[-0.22, 0.32], [0.22, 0.32], [-0.22, -0.32], [0.22, -0.32]].forEach(([x, z], i) => { const lg = new THREE.Group(); lg.position.set(x, 0.5, z); body.add(lg); part('cyl', c, [0.09, 0.5, 0.09], [0, -0.25, 0], [0, 0, 0], lg); part('sphere', f.has('b') ? belly : a, [0.11, 0.07, 0.13], [0, -0.5, 0.03], [0, 0, 0], lg); parts['leg' + i] = lg; });
      tailAt.set(0, 0.75, -0.58); backY = 1.02; break;
    }
    case 'biped': {
      part('sphere', c, [0.44, 0.52, 0.4], [0, 0.95, 0], [0, 0, 0], body);
      if (f.has('b')) part('sphere', belly, [0.32, 0.38, 0.2], [0, 0.9, 0.24], [0, 0, 0], body);
      head.position.set(0, 1.68, 0.05);
      [-1, 1].forEach((x, i) => { const lg = new THREE.Group(); lg.position.set(x * 0.2, 0.55, 0); body.add(lg); part('cyl', c, [0.12, 0.5, 0.12], [0, -0.25, 0], [0, 0, 0], lg); part('sphere', a, [0.15, 0.08, 0.2], [0, -0.52, 0.06], [0, 0, 0], lg); parts['leg' + i] = lg;
        const arm = new THREE.Group(); arm.position.set(x * 0.44, 1.2, 0); body.add(arm); part('cyl', c, [0.08, 0.45, 0.08], [0, -0.22, 0], [0, 0, 0], arm); part('sphere', a, [0.11, 0.11, 0.11], [0, -0.48, 0], [0, 0, 0], arm); parts['arm' + x] = arm; });
      tailAt.set(0, 0.75, -0.38); backY = 1.4; backZ = -0.25; break;
    }
    case 'blob': {
      part('sphere', c, [0.56, 0.5, 0.54], [0, 0.5, 0], [0, 0, 0], body);
      if (f.has('b')) part('sphere', belly, [0.38, 0.34, 0.25], [0, 0.42, 0.32], [0, 0, 0], body);
      head.position.set(0, 0.62, 0.12); headR = 0.42; faceOnBody = true; tailAt.set(0, 0.4, -0.5); backY = 0.95; parts.squash = body; break;
    }
    case 'bird': {
      part('sphere', c, [0.36, 0.36, 0.44], [0, 1.3, 0], [0, 0, 0], body);
      if (f.has('b')) part('sphere', belly, [0.26, 0.26, 0.24], [0, 1.22, 0.22], [0, 0, 0], body);
      head.position.set(0, 1.7, 0.22);
      part('cone', mat('#ffb02b'), [0.06, 0.16, 0.06], [0, 1.66, 0.6], [Math.PI / 2, 0, 0], body);
      [-1, 1].forEach(x => { const w = new THREE.Group(); w.position.set(x * 0.3, 1.4, 0); body.add(w); part('sphere', a, [0.55, 0.05, 0.26], [x * 0.48, 0, 0], [0, 0, 0], w); part('sphere', c, [0.38, 0.05, 0.2], [x * 0.85, 0, -0.1], [0, x * 0.3, 0], w); parts['wing' + x] = w; });
      [-1, 1].forEach(x => part('cyl', mat('#ffb02b'), [0.03, 0.25, 0.03], [x * 0.12, 1.0, 0], [0, 0, 0], body));
      tailAt.set(0, 1.25, -0.42); backY = 1.62; parts.float = body; break;
    }
    case 'serpent': {
      for (let i = 0; i < 5; i++) { const sz = 0.34 - i * 0.05; parts['seg' + i] = part('sphere', c, [sz, sz, sz * 1.2], [0, 0.4 + sz * 0.6, -0.1 - i * 0.42], [0, 0, 0], body); }
      if (f.has('b')) part('sphere', belly, [0.26, 0.2, 0.3], [0, 0.45, 0.05], [0, 0, 0], body);
      head.position.set(0, 0.95, 0.32); tailAt.set(0, 0.35, -2.1); backY = 0.75; backZ = -0.6; break;
    }
    case 'fish': {
      part('sphere', c, [0.4, 0.42, 0.56], [0, 1.0, 0], [0, 0, 0], body);
      if (f.has('b')) part('sphere', belly, [0.3, 0.3, 0.36], [0, 0.9, 0.15], [0, 0, 0], body);
      head.position.set(0, 1.05, 0.2); headR = 0.44; faceOnBody = true;
      [-1, 1].forEach(x => { parts['fin' + x] = part('cone', a, [0.2, 0.38, 0.05], [x * 0.4, 0.95, 0], [0, 0, x * 1.9], body); });
      part('cone', a, [0.06, 0.4, 0.25], [0, 1.45, -0.05], [-0.3, 0, 0], body);
      tailAt.set(0, 1.0, -0.55); backY = 1.4; parts.float = body; break;
    }
    case 'bug': {
      part('sphere', c, [0.36, 0.3, 0.5], [0, 0.55, -0.15], [0, 0, 0], body);
      part('sphere', a, [0.3, 0.26, 0.3], [0, 0.55, 0.25], [0, 0, 0], body);
      for (let i = 0; i < 3; i++) [-1, 1].forEach(x => part('cyl', a, [0.03, 0.4, 0.03], [x * 0.32, 0.3, 0.25 - i * 0.25], [0, 0, x * 0.9], body));
      head.position.set(0, 0.7, 0.6); headR = 0.32; tailAt.set(0, 0.55, -0.6); backY = 0.85; backZ = -0.15; break;
    }
    case 'ghost': {
      part('cone', c, [0.45, 0.95, 0.45], [0, 0.75, 0], [Math.PI, 0, 0], body);
      head.position.set(0, 1.38, 0); tailAt.set(0, 0.4, -0.2); backY = 1.7; parts.float = body; break;
    }
  }
  body.add(head); parts.head = head;
  if (!faceOnBody) part('sphere', c, [headR * 1.15, headR, headR], [0, 0, 0], [0, 0, 0], head);
  if (!faceOnBody && f.has('b')) part('sphere', belly, [headR * 0.7, headR * 0.45, headR * 0.4], [0, -headR * 0.35, headR * 0.65], [0, 0, 0], head);
  const hz = faceOnBody ? (G.plan === 'blob' ? 0.42 : 0.36) : headR * 0.92; const ey = 0.04;
  animeEyes(head, ey, hz, headR * 0.42, headR * 0.34, G.eye, eyes, !f.has('g'));
  mouth(head, ey - headR * 0.42, hz + 0.03, 0.035, f.has('s') || f.has('m'));
  const furry = G.plan === 'quad' || G.plan === 'biped' || G.plan === 'bird' || G.plan === 'blob';
  if (furry && !faceOnBody) {
    [-1, 1].forEach(sd => fluff(head, sd < 0 ? c : c, sd * headR * 1.0, -headR * 0.25, 0, 3, headR * 0.5, 0.9, sd * Math.PI / 2 + sd * 0.35));
    fluff(head, c, 0, headR * 0.95, 0.05, 3, headR * 0.45, 0.9, Math.PI);
  }
  if (furry && G.plan !== 'bird') fluff(body, f.has('b') ? belly : a, 0, G.plan === 'biped' ? 1.25 : G.plan === 'blob' ? 0.3 : 0.62, G.plan === 'quad' ? 0.5 : 0.3, 5, 0.22, 1.6, 0, -0.5);
  // forehead marking (unique per species from its accent)
  const mk = mat(new THREE.Color(s.accent).lerp(new THREE.Color(s.color), 0.15).getStyle());
  const mz = faceOnBody ? hz - 0.02 : headR * 0.86, my = faceOnBody ? ey + headR * 0.55 : headR * 0.5;
  if (G.eye.charCodeAt(2) % 3 === 0) part('cone', mk, [0.05, 0.16, 0.02], [0, my, mz], [-0.4, 0, Math.PI], head, true);
  else if (G.eye.charCodeAt(2) % 3 === 1) [-1, 1].forEach(sd => part('box', mk, [0.12, 0.03, 0.02], [sd * 0.07, my, mz], [-0.4, 0, sd * 0.5], head, true));
  else part('sphere', mk, [0.06, 0.06, 0.02], [0, my, mz], [-0.4, 0, 0], head, true);
  // toe pads on paws
  if (G.plan === 'quad') for (let i = 0; i < 4; i++) { const lg = parts['leg' + i]; if (lg) [-1, 0, 1].forEach(k => part('sphere', mat('#ffb0c0'), [0.03, 0.02, 0.03], [k * 0.05, -0.53, 0.13], [0, 0, 0], lg, true)); }
  const top = faceOnBody ? 0.4 : headR * 0.85;
  if (G.ears === 'cat') [-1, 1].forEach(x => { const g = new THREE.Group(); g.position.set(x * headR * 0.6, top, 0); g.rotation.z = x * -0.3; head.add(g); part('cone', c, [0.14, 0.36, 0.1], [0, 0.15, 0], [0, 0, 0], g); part('cone', a, [0.07, 0.22, 0.04], [0, 0.13, 0.05], [0, 0, 0], g, true); parts['ear' + x] = g; });
  if (G.ears === 'long') [-1, 1].forEach(x => { const g = new THREE.Group(); g.position.set(x * headR * 0.45, top, -0.05); g.rotation.z = x * -0.25; head.add(g); part('sphere', c, [0.11, 0.4, 0.06], [0, 0.36, 0], [0, 0, 0], g); part('sphere', a, [0.06, 0.3, 0.03], [0, 0.36, 0.04], [0, 0, 0], g, true); parts['ear' + x] = g; });
  if (G.ears === 'round') [-1, 1].forEach(x => { const g = new THREE.Group(); g.position.set(x * headR * 0.7, top * 0.9, 0); head.add(g); part('sphere', c, [0.14, 0.14, 0.07], [0, 0.05, 0], [0, 0, 0], g); part('sphere', a, [0.08, 0.08, 0.04], [0, 0.05, 0.04], [0, 0, 0], g, true); parts['ear' + x] = g; });
  if (G.ears === 'fin') [-1, 1].forEach(x => { const g = new THREE.Group(); g.position.set(x * headR * 0.9, 0.05, -0.05); head.add(g); part('cone', a, [0.16, 0.36, 0.04], [x * 0.12, 0, 0], [0, 0, x * -1.3], g); parts['ear' + x] = g; });
  if (G.horn === 'one') part('cone', a, [0.07, 0.4, 0.07], [0, top + 0.12, headR * 0.35], [0.3, 0, 0], head);
  if (G.horn === 'two') [-1, 1].forEach(x => part('cone', a, [0.06, 0.34, 0.06], [x * headR * 0.4, top + 0.08, 0.05], [0.2, 0, x * -0.35], head));
  if (G.horn === 'antler') [-1, 1].forEach(x => { part('cyl', a, [0.04, 0.5, 0.04], [x * 0.2, top + 0.2, 0], [0, 0, x * -0.5], head); part('cyl', a, [0.03, 0.25, 0.03], [x * 0.32, top + 0.38, 0.05], [0.4, 0, x * 0.3], head); part('ico', mat('#7ad06a'), [0.1, 0.1, 0.1], [x * 0.38, top + 0.5, 0], [0, 0, 0], head); });
  if (G.horn === 'crystal') { const cm = toon(s.accent, { emissive: s.accent, emissiveIntensity: 0.4 }); [[0, 0.2], [-0.12, 0.12], [0.12, 0.12]].forEach(([x, hh]) => part('cone', cm, [0.06, hh + 0.18, 0.06], [x, top + hh * 0.6, 0], [0, 0, x * -2], head)); }
  if (f.has('m')) part('torus', a, [headR * 1.05, headR * 1.05, headR * 1.4], [0, -headR * 0.3, -0.05], [Math.PI / 2, 0, 0], head);
  const tg = new THREE.Group(); tg.position.copy(tailAt); body.add(tg); parts.tail = tg;
  switch (G.tail) {
    case 'fluffy': part('sphere', c, [0.16, 0.16, 0.42], [0, 0.22, -0.25], [-0.7, 0, 0], tg); part('sphere', a, [0.14, 0.14, 0.18], [0, 0.48, -0.48], [0, 0, 0], tg); break;
    case 'thin': part('cyl', c, [0.04, 0.7, 0.04], [0, 0.2, -0.3], [-1.0, 0, 0], tg); part('sphere', a, [0.1, 0.1, 0.1], [0, 0.42, -0.6], [0, 0, 0], tg); break;
    case 'flame': part('cyl', c, [0.06, 0.5, 0.06], [0, 0.15, -0.2], [-0.9, 0, 0], tg); [0, 1].forEach(k => part('cone', mat(k ? '#ffe066' : '#ff8a2a', 1.2), [0.14 - k * 0.05, 0.4 - k * 0.12, 0.14 - k * 0.05], [0, 0.45 + k * 0.05, -0.42], [0, 0, 0], tg, true)); break;
    case 'leaf': part('sphere', mat('#5cbf4a'), [0.24, 0.04, 0.4], [0, 0.2, -0.35], [-0.6, 0, 0], tg); break;
    case 'fin': part('cone', a, [0.3, 0.35, 0.05], [0, 0, -0.2], [-Math.PI / 2, 0, 0], tg); break;
    case 'club': part('cyl', c, [0.07, 0.5, 0.07], [0, 0.1, -0.25], [-1.2, 0, 0], tg); part('ico', a, [0.18, 0.18, 0.18], [0, 0.2, -0.5], [0, 0, 0], tg); break;
  }
  if (f.has('w') && G.plan !== 'bird') [-1, 1].forEach(x => { const w = new THREE.Group(); w.position.set(x * 0.15, backY, backZ); body.add(w); part('sphere', toon(s.accent, { transparent: true, opacity: 0.75 }), [0.45, 0.04, 0.28], [x * 0.4, 0.05, -0.1], [0, 0, x * 0.3], w, true); parts['wing' + x] = w; });
  if (f.has('s')) for (let i = 0; i < 4; i++) part('cone', a, [0.07, 0.26, 0.07], [0, backY + 0.02 - Math.abs(i - 1.5) * 0.03, backZ + 0.25 - i * 0.18], [-0.4, 0, 0], body);
  if (f.has('p')) for (let i = 0; i < 5; i++) part('sphere', a, [0.07, 0.07, 0.03], [Math.cos(i * 1.7) * 0.3, backY - 0.25 + Math.sin(i * 2.1) * 0.12, backZ + Math.sin(i) * 0.3], [0, i, 0], body, true);
  if (f.has('g')) part('sphere', new THREE.MeshBasicMaterial({ color: s.accent, transparent: true, opacity: 0.18, depthWrite: false }), [0.75, 0.75, 0.75], [0, backY - 0.2, 0], [0, 0, 0], body, true);
}
