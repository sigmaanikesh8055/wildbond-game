import * as THREE from 'three';
import { mat, toon, part, addOutline, groundTex } from './models';
import type { HumanLook } from './models';
import { makeHouse, instanced, jitter } from './world';

// ---------- shared types ----------
export type SpotKind = 'water' | 'wood' | 'fish' | 'cook' | 'sleep' | 'shelter' | 'fruit' | 'sit' | 'dance' | 'harvest' | 'swing' | 'slide' | 'seesaw' | 'study' | 'view' | 'dig';
export interface PBox { x0: number; x1: number; z0: number; z1: number; h?: number; e?: number; y0?: number }
export interface PathStep { p: [number, number, number]; d: number; pose: number }
export interface PSpot { x: number; z: number; r: number; kind: SpotKind; label: string; item?: string; key?: string; ry?: number; obj?: THREE.Object3D; y?: number; path?: PathStep[] }
export interface PNpc { id: string; name: string; x: number; z: number; look: HumanLook; lines?: string[]; scale?: number; role?: string; ry?: number }
// Walkable surfaces: flat or sloped boxes (stairs/ramps), round discs, and one-turn spirals
export type Floor = { k: 'box'; cx: number; cz: number; ry: number; hw: number; hd: number; y0: number; y1: number } | { k: 'disc'; cx: number; cz: number; r: number; y: number } | { k: 'spiral'; cx: number; cz: number; r0: number; r1: number; a0: number; turn: number; h: number };
export function floorH(f: Floor, x: number, z: number): number | null {
  const dx = x - f.cx, dz = z - f.cz;
  if (f.k === 'disc') return dx * dx + dz * dz < f.r * f.r ? f.y : null;
  if (f.k === 'spiral') { const r = Math.hypot(dx, dz); if (r < f.r0 || r > f.r1) return null; const rel = (((Math.atan2(dz, dx) - f.a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return rel > f.turn ? null : (f.h * rel) / f.turn; }
  const c = Math.cos(f.ry), s = Math.sin(f.ry); const lx = dx * c - dz * s, lz = dx * s + dz * c;
  if (Math.abs(lx) > f.hw || Math.abs(lz) > f.hd) return null;
  return f.y0 + (f.y1 - f.y0) * ((lz + f.hd) / (2 * f.hd));
}
// visible stone steps along a straight ramp (yTop at the -z end, 0 at the +z end, in ramp-local space)
export function stairs(g: THREE.Object3D, lx: number, lz: number, ry: number, w: number, len: number, yTop: number, color = '#a89c8a', yBase = 0) {
  const st = new THREE.Group(); st.position.set(lx, 0, lz); st.rotation.y = ry; g.add(st); const n = Math.max(3, Math.round(len / 0.45)); const m = mat(color);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const y = yBase + (yTop - yBase) * (1 - t); part('box', m, [w, Math.max(0.2, y - yBase + 0.05), len / n + 0.02], [0, yBase + (y - yBase) / 2, -len / 2 + t * len], [0, 0, 0], st); }
  [-1, 1].forEach(sd => { const rail = part('box', mat('#6b4a32'), [0.08, 0.08, Math.hypot(len, yTop - yBase)], [sd * (w / 2 + 0.05), yBase + (yTop - yBase) / 2 + 0.9, 0], [Math.atan2(yTop - yBase, len), 0, 0], st); rail.userData.noOutline = true; });
  return st;
}
export interface Zone { x: number; z: number; r: number; kind: string; name?: string; mat?: THREE.Material }
export interface Ball { mesh: THREE.Object3D; vel: THREE.Vector3; x0: number; x1: number; z0: number; z1: number; cx: number; cz: number }
export interface PShape { k: 'r' | 'c'; x: number; z: number; w?: number; d?: number; r?: number; col: string }
export type Anim = (t: number, p: THREE.Vector3) => void;
export interface Ctx { gr: THREE.Group; cl: PBox[]; spots: PSpot[]; npcs: PNpc[]; shapes: PShape[]; anims: Anim[]; balls: Ball[]; zones: Zone[]; waters: PBox[]; lamps: THREE.MeshToonMaterial[]; key: string; rnd: () => number; look: (k: number) => HumanLook; floors: Floor[] }

const C = (c: Ctx, x: number, z: number, w: number, d: number, h = 0, e = 0.3, y0?: number) => c.cl.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: h || undefined, e, y0 });

export const flat = (g: THREE.Object3D, w: number, d: number, m: THREE.Material, x: number, y: number, z: number, own = false) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; p.userData.ownGeo = true; p.userData.ownMat = own; p.userData.noOutline = true; g.add(p); return p; };
const disc = (g: THREE.Object3D, r: number, m: THREE.Material, x: number, y: number, z: number, own = false) => { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 32), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; p.userData.ownGeo = true; p.userData.ownMat = own; p.userData.noOutline = true; g.add(p); return p; };
const labCache = new Map<string, THREE.CanvasTexture>();
export function labelTex(text: string, bg: string, fg: string) {
  const k = text + bg + fg; const hit = labCache.get(k); if (hit) return hit;
  const w = 512, h = 160, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d')!;
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4, w - 40);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; labCache.set(k, t); return t;
}
export function sign(g: THREE.Object3D, text: string, x: number, y: number, z: number, ry: number, bg: string, fg: string, w = 2.4, h = 0.75) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTex(text, bg, fg), side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.ownGeo = m.userData.ownMat = true; m.userData.noOutline = true; g.add(m); return m;
}
const water = () => toon('#4fc3f7', { emissive: '#1a7ab0', emissiveIntensity: 0.25 });

// ---------- trees ----------
export type TreeKind = 'banana' | 'banyan' | 'neem' | 'apple' | 'mango' | 'coconut' | 'acacia' | 'baobab' | 'dead';
export function tree(c: Ctx, kind: TreeKind, x: number, z: number, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = c.rnd() * 6.28;
  const bark = mat('#7a5232'); let H = 5, R = 0.4, fruit = '';
  const fr = (m: THREE.Mesh) => { m.name = 'fruit'; };
  switch (kind) {
    case 'banana':
      for (let i = 0; i < 4; i++) part('cyl', mat('#8aa83a'), [0.17 - i * 0.02, 0.62, 0.17 - i * 0.02], [0, 0.31 + i * 0.58, 0], [0, 0, 0], g);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28; part('sphere', mat(k % 2 ? '#5cbf4a' : '#47a83e'), [1.3, 0.05, 0.36], [Math.cos(a) * 0.95, 2.45 + (k % 2) * 0.2, Math.sin(a) * 0.95], [0, -a, -0.45 - (k % 3) * 0.15], g); }
      for (let k = 0; k < 5; k++) fr(part('cyl', mat('#ffe066'), [0.05, 0.3, 0.05], [0.28 + (k % 2) * 0.1, 1.95 - (k >> 1) * 0.16, (k % 2) * 0.1], [0, 0, 0.5], g, true));
      H = 3.2; R = 0.25; fruit = 'banana'; break;
    case 'banyan':
      part('taper', bark, [0.9, 3.4, 0.9], [0, 1.7, 0], [Math.PI, 0, 0], g);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28, r = 1.6 + (k % 3) * 0.9; part('cyl', mat('#8a6a48'), [0.07, 4.6, 0.07], [Math.cos(a) * r, 2.3, Math.sin(a) * r], [0, 0, 0], g); }
      for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28; part('ico', mat(['#3e8a3a', '#2f7a34', '#4a9a40'][k % 3]), [2.4, 1.3, 2.4], [Math.cos(a) * 2.3, 4.8 + (k % 2) * 0.5, Math.sin(a) * 2.3], [0, a, 0], g); }
      part('ico', mat('#3e8a3a'), [3, 1.6, 3], [0, 5.7, 0], [0, 0, 0], g); H = 7; R = 1; break;
    case 'neem':
      part('cyl', bark, [0.22, 2.6, 0.22], [0, 1.3, 0], [0, 0, 0], g);
      for (let k = 0; k < 9; k++) { const a = k * 2.4, rr = 0.6 + (k % 3) * 0.35; part('ico', mat(['#5a9a3a', '#6aa848', '#4f8a34'][k % 3]), [0.9, 0.7, 0.9], [Math.cos(a) * rr, 3 + (k % 4) * 0.35, Math.sin(a) * rr], [0, a, 0], g); }
      H = 4.5; break;
    case 'apple': case 'mango': {
      const ap = kind === 'apple', R2 = ap ? 1.7 : 2;
      part('cyl', bark, [0.24, 2.2, 0.24], [0, 1.1, 0], [0, 0, 0], g);
      part('sphere', mat(ap ? '#5cbf4a' : '#2f7d3a'), [R2, ap ? 1.4 : 1.5, R2], [0, 3, 0], [0, 0, 0], g);
      part('sphere', mat(ap ? '#6cc45a' : '#3a8a40'), [1.1, 0.9, 1.1], [0.6, 3.8, 0.2], [0, 0, 0], g);
      for (let k = 0; k < 10; k++) { const a = k * 2.4, el = 0.3 + (k % 3) * 0.35; fr(part('sphere', mat(ap ? '#e8302a' : '#ffb02b'), ap ? [0.15, 0.15, 0.15] : [0.13, 0.19, 0.13], [Math.cos(a) * R2 * Math.cos(el), 2.4 + Math.sin(el) * 1.3, Math.sin(a) * R2 * Math.cos(el)], [0, 0, 0], g, true)); }
      fruit = kind; H = 4.5; break; }
    case 'coconut': {
      const lean = 0.3 + c.rnd() * 0.5;
      for (let i = 0; i < 6; i++) part('cyl', mat(i % 2 ? '#a07a4a' : '#8a6438'), [0.2 - i * 0.015, 0.75, 0.2 - i * 0.015], [Math.sin(i * 0.25) * lean * i * 0.25, 0.35 + i * 0.68, 0], [0, 0, -lean * 0.12 * i], g);
      const tx = Math.sin(1.25) * lean * 1.5;
      for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28; part('sphere', mat('#3fae4a'), [1.5, 0.06, 0.32], [tx + Math.cos(a) * 1.2, 4.05, Math.sin(a) * 1.2], [0, -a, -0.45], g); }
      for (let k = 0; k < 4; k++) fr(part('sphere', mat('#7a5a2a'), [0.18, 0.18, 0.18], [tx + Math.cos(k * 1.6) * 0.3, 3.85, Math.sin(k * 1.6) * 0.3], [0, 0, 0], g));
      fruit = 'coconut'; H = 5; R = 0.3; break; }
    case 'acacia':
      part('cyl', mat('#6a4a2a'), [0.14, 2.6, 0.14], [0.2, 1.3, 0], [0, 0, -0.15], g); part('cyl', mat('#6a4a2a'), [0.1, 1.4, 0.1], [-0.4, 2.6, 0], [0, 0, 0.6], g);
      part('cyl', mat('#7a9a3a'), [2.6, 0.35, 2.6], [0, 3.3, 0], [0, 0, 0], g); part('cyl', mat('#8aa848'), [1.8, 0.3, 1.8], [-0.5, 3.6, 0.2], [0, 0, 0], g);
      H = 3.8; R = 0.25; break;
    case 'baobab':
      part('taper', mat('#a08a70'), [1.0, 3.6, 1.0], [0, 1.8, 0], [Math.PI, 0, 0], g); part('sphere', mat('#a08a70'), [1.05, 0.6, 1.05], [0, 0.3, 0], [0, 0, 0], g);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; part('cyl', mat('#8a7458'), [0.1, 1.2, 0.1], [Math.cos(a) * 0.6, 4, Math.sin(a) * 0.6], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], g); part('ico', mat('#6a8a3a'), [0.6, 0.4, 0.6], [Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1], [0, 0, 0], g); }
      H = 5; R = 1; break;
    case 'dead': {
      const d = mat('#2a2228'); part('taper', d, [0.25, 3.2, 0.25], [0, 1.6, 0], [Math.PI, 0, 0.08], g);
      for (let k = 0; k < 5; k++) { const a = k * 1.3; part('cyl', d, [0.06, 1.4, 0.06], [Math.cos(a) * 0.5, 2.4 + k * 0.25, Math.sin(a) * 0.5], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], g); }
      H = 3.5; R = 0.25; break; }
  }
  g.scale.setScalar(s); addOutline(g, 0.03); c.gr.add(g);
  C(c, x, z, R * 2 * s, R * 2 * s, H * s, (kind === 'banyan' ? 2.5 : 1.1) * s);
  if (fruit) c.spots.push({ x, z, r: 2.2 + R * s, kind: 'fruit', label: `Pick ${fruit}`, item: fruit, key: `fr_${Math.round(x)}_${Math.round(z)}`, obj: g });
  return g;
}

// ---------- flowers (lily, rose, marigold, sunflower, tulip) ----------
export function flowerField(c: Ctx, cx: number, cz: number, w: number, d: number, n: number, tall = false) {
  const I = (g: THREE.BufferGeometry, col: string) => instanced(c.gr, g, col, n, 0, false, true, true);
  const stems = I(new THREE.CylinderGeometry(0.02, 0.025, 1, 4), '#3a8a2a');
  const tulip = I(new THREE.ConeGeometry(0.12, 0.22, 6, 1, true), '#ff4a6a'), rose = I(new THREE.IcosahedronGeometry(0.11, 1), '#e02a3a');
  const sunP = I(new THREE.TorusGeometry(0.17, 0.08, 4, 10), '#ffd21b'), sunC = I(new THREE.SphereGeometry(0.11, 8, 6), '#6a3a1a');
  const lily = I(new THREE.ConeGeometry(0.16, 0.18, 5, 1, true), '#ffffff'), mari = I(new THREE.IcosahedronGeometry(0.12, 0), '#ff8a1b');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) => { p.set(x, y, z); q.setFromEuler(e.set(rx, 0, 0)); s.set(sx, sy, sz); return m4.compose(p, q, s); };
  for (let i = 0; i < n; i++) {
    const x = cx + (c.rnd() - 0.5) * w, z = cz + (c.rnd() - 0.5) * d, t = Math.floor(c.rnd() * 5);
    const h = (t === 2 ? 1.1 : 0.45) * (tall ? 1.2 : 1) + c.rnd() * 0.2;
    stems.add(M(x, h / 2, z, 1, h, 1));
    if (t === 0) tulip.add(M(x, h + 0.08, z, 1, 1, 1, Math.PI), ['#ff4a6a', '#ffd23b', '#c05aff', '#ff8ad0', '#ffffff'][i % 5]);
    else if (t === 1) rose.add(M(x, h + 0.05, z, 1, 1, 1), ['#e02a3a', '#ff6a8a', '#ffffff', '#ffb0c0'][i % 4]);
    else if (t === 2) { sunP.add(M(x, h, z, 1, 1, 1, 0.3)); sunC.add(M(x, h, z, 1, 1, 0.6, 0.3)); }
    else if (t === 3) lily.add(M(x, h + 0.06, z, 1, 1, 1, Math.PI), ['#ffffff', '#ffc0e0', '#ffe8a0'][i % 3]);
    else mari.add(M(x, h + 0.06, z, 1, 1, 1), ['#ff8a1b', '#ffc21b'][i % 2]);
  }
  [stems, tulip, rose, sunP, sunC, lily, mari].forEach(m => m.done());
}

function bench(c: Ctx, g: THREE.Group, gx: number, gz: number, lx: number, lz: number, ry: number) {
  const b = new THREE.Group(); b.position.set(lx, 0, lz); b.rotation.y = ry; g.add(b);
  part('box', mat('#a0683a'), [1.8, 0.1, 0.5], [0, 0.45, 0], [0, 0, 0], b); part('box', mat('#a0683a'), [1.8, 0.4, 0.08], [0, 0.75, -0.24], [-0.15, 0, 0], b);
  [-0.75, 0.75].forEach(px => part('box', mat('#3a3a48'), [0.08, 0.45, 0.5], [px, 0.22, 0], [0, 0, 0], b));
  c.spots.push({ x: gx + lx, z: gz + lz, r: 1.5, kind: 'sit', label: 'Sit', ry });
}

// ---------- village extras ----------
export function market(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const cols = [['#e0574a', '#ffffff'], ['#3d7be0', '#ffffff'], ['#5aa04a', '#ffe066'], ['#ff9a2b', '#ffffff']], goods = ['#e8302a', '#ffb02b', '#ffe066', '#5cbf4a', '#a05ab0', '#ff8ad0'];
  for (let i = 0; i < 4; i++) {
    const sx = -9 + i * 6;
    [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]].forEach(([px, pz]) => part('cyl', mat('#7a4a2a'), [0.07, 2.4, 0.07], [sx + px, 1.2, pz], [0, 0, 0], g));
    for (let k = 0; k < 6; k++) part('box', mat(cols[i][k % 2]), [0.45, 0.08, 2], [sx - 1.15 + k * 0.46, 2.45, 0], [0.12, 0, 0], g);
    part('box', mat('#a0683a'), [2.6, 0.12, 1.4], [sx, 0.9, 0], [0, 0, 0], g);
    for (let k = 0; k < 3; k++) { part('box', mat('#c89a5a'), [0.6, 0.3, 0.5], [sx - 0.8 + k * 0.8, 1.1, 0.2], [0, 0, 0], g); for (let j = 0; j < 5; j++) part('sphere', mat(goods[(i * 3 + k) % goods.length]), [0.1, 0.1, 0.1], [sx - 0.95 + k * 0.8 + (j % 3) * 0.15, 1.32, 0.12 + (j >> 1) * 0.15], [0, 0, 0], g, true); }
    C(c, x + sx, z, 2.8, 1.8, 2.5);
  }
  sign(g, 'MARKET', 0, 3.4, 1.2, 0, '#7a4a2a', '#ffe066', 4, 1.2);
  addOutline(g, 0.03); c.gr.add(g);
  c.npcs.push({ id: 'market@' + c.key, name: 'Fruit Seller', x, z: z + 2.2, look: c.look(91), role: 'vendor' }, { id: 'chat@' + c.key + '#m', name: 'Shopper', x: x - 6, z: z + 3.5, look: c.look(92) });
  c.shapes.push({ k: 'r', x, z, w: 24, d: 3, col: '#e0574a' });
}
export function foodShop(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); const dark = mat('#5a2a1a'), tile = mat('#3a3a48');
  part('box', mat('#8a6a50'), [6.4, 0.4, 5.4], [0, 0.2, 0], [0, 0, 0], g); part('box', mat('#f4ead8'), [6, 3, 5], [0, 1.9, 0], [0, 0, 0], g);
  [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]].forEach(([px, pz]) => part('box', dark, [0.3, 3.2, 0.3], [px, 1.9, pz], [0, 0, 0], g));
  part('box', dark, [6.2, 0.25, 0.2], [0, 3.25, 2.55], [0, 0, 0], g);
  part('box', tile, [7.6, 0.3, 6.6], [0, 3.6, 0], [0, 0, 0], g); part('box', mat('#4a4a5a'), [6.4, 0.5, 5.4], [0, 4.0, 0], [0, 0, 0], g); part('box', tile, [4.6, 0.35, 3.8], [0, 4.4, 0], [0, 0, 0], g);
  [[-3.8, -3.3], [3.8, -3.3], [-3.8, 3.3], [3.8, 3.3]].forEach(([px, pz]) => part('cone', tile, [0.18, 0.6, 0.18], [px, 3.9, pz], [0, 0, px > 0 ? -0.7 : 0.7], g));
  for (let k = 0; k < 5; k++) part('box', mat(k % 2 ? '#c0302a' : '#a0201a'), [0.5, 1.1, 0.04], [-1 + k * 0.5, 2.55, 2.62], [0, 0, 0], g);
  sign(g, 'FOOD', 0, 3.25, 2.72, 0, '#1e1418', '#ffe066', 2, 0.55);
  [-2.6, 2.6].forEach(px => { const lm = toon('#ff4a3a', { emissive: '#ff2a1a', emissiveIntensity: 0.9 }); c.lamps.push(lm); part('sphere', lm, [0.25, 0.33, 0.25], [px, 2.75, 2.9], [0, 0, 0], g); });
  part('box', mat('#7a4a2a'), [3, 0.9, 0.6], [0, 0.45, 3.6], [0, 0, 0], g); [-1, 0, 1].forEach(k => part('cyl', mat('#c0503a'), [0.25, 0.06, 0.25], [k * 0.9, 0.65, 4.4], [0, 0, 0], g));
  addOutline(g, 0.03); c.gr.add(g); C(c, x, z, 6.6, 5.6, 4.5); C(c, x, z + 3.6, 3.1, 0.7);
  c.npcs.push({ id: 'food@' + c.key, name: 'Chef Miko', x, z: z + 3.05, look: { ...c.look(77), top: '#ffffff', bottom: '#2a2a3a', acc: 'hat' }, role: 'chef' });
  c.shapes.push({ k: 'r', x, z, w: 6, d: 5, col: '#c0302a' });
}
export function football(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); const W = mat('#ffffff');
  flat(g, 28, 18, mat('#5cbf4a'), 0, 0.03, 0); for (let i = 0; i < 7; i += 2) flat(g, 4, 16, mat('#4fae40'), -12 + i * 4, 0.035, 0);
  [[0, 8, 26, 0.12], [0, -8, 26, 0.12], [13, 0, 0.12, 16], [-13, 0, 0.12, 16], [0, 0, 0.12, 16]].forEach(([px, pz, w, d]) => part('box', W, [w, 0.02, d], [px, 0.05, pz], [0, 0, 0], g, true));
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.45, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.ownGeo = ring.userData.ownMat = true; g.add(ring);
  [-1, 1].forEach(sd => { [-2, 2].forEach(pz => { part('cyl', W, [0.08, 2, 0.08], [sd * 13.3, 1, pz], [0, 0, 0], g); C(c, x + sd * 13.3, z + pz, 0.3, 0.3); }); part('cyl', W, [0.08, 4.1, 0.08], [sd * 13.3, 2, 0], [Math.PI / 2, 0, 0], g);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide })); net.position.set(sd * 14, 1, 0); net.rotation.y = Math.PI / 2; net.userData.ownGeo = net.userData.ownMat = true; g.add(net); });
  addOutline(g, 0.02); c.gr.add(g);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), mat('#ffffff')); ball.userData.ownGeo = true; ball.castShadow = true;
  [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(([dx, dy, dz]) => part('sphere', mat('#1e1418'), [0.13, 0.13, 0.13], [dx * 0.28, dy * 0.28, dz * 0.28], [0, 0, 0], ball, true));
  ball.position.set(x, 0.35, z); c.gr.add(ball);
  c.balls.push({ mesh: ball, vel: new THREE.Vector3(), x0: x - 12.8, x1: x + 12.8, z0: z - 7.7, z1: z + 7.7, cx: x, cz: z });
  c.shapes.push({ k: 'r', x, z, w: 26, d: 16, col: '#5cbf4a' }); c.zones.push({ x, z, r: 14, kind: 'football', name: 'Football Ground' });
}
export function badminton(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); const W = mat('#ffffff');
  flat(g, 8, 15, mat('#3aa06a'), 0, 0.03, 0);
  [[0, 6.7, 6, 0.08], [0, -6.7, 6, 0.08], [3, 0, 0.08, 13.4], [-3, 0, 0.08, 13.4], [0, 2, 6, 0.06], [0, -2, 6, 0.06], [0, 4.35, 0.06, 4.7], [0, -4.35, 0.06, 4.7]].forEach(([px, pz, w, d]) => part('box', W, [w, 0.02, d], [px, 0.05, pz], [0, 0, 0], g, true));
  [-3.3, 3.3].forEach(px => { part('cyl', mat('#3a3a48'), [0.06, 1.6, 0.06], [px, 0.8, 0], [0, 0, 0], g); C(c, x + px, z, 0.3, 0.3); });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.75), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide })); net.position.set(0, 1.2, 0); net.userData.ownGeo = net.userData.ownMat = true; g.add(net);
  part('box', W, [6.6, 0.06, 0.04], [0, 1.58, 0], [0, 0, 0], g); sign(g, 'BADMINTON', 0, 2.4, -7.6, 0, '#2a6a3a', '#ffffff', 3, 0.7);
  addOutline(g, 0.02); c.gr.add(g);
  c.npcs.push({ id: 'badminton@' + c.key, name: 'Coach Ren', x, z: z - 4.5, look: { ...c.look(55), top: '#ffffff', bottom: '#3d7be0' }, role: 'coach' });
  c.zones.push({ x, z, r: 8, kind: 'court', name: 'Badminton Court' }); c.shapes.push({ k: 'r', x, z, w: 8, d: 15, col: '#3aa06a' });
}
export function disco(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); const N = 8, pal = ['#ff2a8a', '#2ad0ff', '#ffe02a', '#8a2aff', '#2aff8a', '#ff7a2a'];
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.1, 0.95), new THREE.MeshBasicMaterial({ color: '#ffffff' }), N * N); tiles.userData.ownGeo = tiles.userData.ownMat = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { m4.makeTranslation(i - N / 2 + 0.5, 0.06, j - N / 2 + 0.5); tiles.setMatrixAt(i * N + j, m4); tiles.setColorAt(i * N + j, col.set(pal[(i + j) % pal.length])); }
  g.add(tiles); const frame = mat('#2a2a3a');
  [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(([px, pz]) => { part('cyl', frame, [0.15, 5, 0.15], [px, 2.5, pz], [0, 0, 0], g); C(c, x + px, z + pz, 0.4, 0.4); });
  part('box', frame, [9.4, 0.25, 0.25], [0, 5, -4.6], [0, 0, 0], g); part('box', frame, [9.4, 0.25, 0.25], [0, 5, 4.6], [0, 0, 0], g); part('box', frame, [0.25, 0.25, 9.4], [0, 5, 0], [0, 0, 0], g);
  const ball = part('sphere', toon('#e0e0f0', { emissive: '#8080a0', emissiveIntensity: 0.7 }), [0.55, 0.55, 0.55], [0, 4.3, 0], [0, 0, 0], g);
  const beams: THREE.Mesh[] = [];
  [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]].forEach(([px, pz], i) => { const geo = new THREE.ConeGeometry(1.3, 5, 16, 1, true); geo.translate(0, -2.5, 0); const bm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: pal[i], transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bm.position.set(px, 4.9, pz); bm.userData.ownGeo = bm.userData.ownMat = true; bm.userData.noOutline = true; g.add(bm); beams.push(bm); });
  sign(g, 'DANCE CLUB', 0, 5.7, 4.65, 0, '#1e1418', '#ff2a8a', 4.4, 1.1);
  addOutline(g, 0.02); c.gr.add(g);
  let last = 0;
  c.anims.push(t => { if (t - last > 0.35) { last = t; for (let i = 0; i < N * N; i++) tiles.setColorAt(i, col.set(pal[Math.floor(Math.random() * pal.length)])); tiles.instanceColor!.needsUpdate = true; } ball.rotation.y = t * 1.5; beams.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.3 + i) * 0.55; b.rotation.z = Math.cos(t * 1.1 + i * 2) * 0.55; }); });
  c.spots.push({ x, z, r: 4, kind: 'dance', label: 'Dance!' }); c.zones.push({ x, z, r: 6, kind: 'dance', name: 'Dance Club' });
  c.npcs.push({ id: 'dancer@' + c.key + '#1', name: 'Dancer Kiko', x: x - 2, z: z + 1.5, look: c.look(66), role: 'dancer' }, { id: 'dancer@' + c.key + '#2', name: 'Dancer Jun', x: x + 2, z: z - 1, look: c.look(67), role: 'dancer' });
  c.shapes.push({ k: 'r', x, z, w: 9, d: 9, col: '#ff2a8a' });
}
export function school(c: Ctx, x: number, z: number) {
  makeHouse(x, z - 5, 12, 7, '#fff2b0', '#d04a3a', false, true, c.gr, c.cl, c.lamps, 0);
  const g = new THREE.Group(); g.position.set(x, 0, z);
  sign(g, 'SCHOOL', 0, 5.4, -1.4, 0, '#2a6a3a', '#ffffff', 3.4, 0.9);
  part('box', mat('#fff2b0'), [1.6, 2, 1.6], [0, 8.6, -5], [0, 0, 0], g); part('cone', mat('#d04a3a'), [1.4, 1.3, 1.4], [0, 10.2, -5], [0, Math.PI / 4, 0], g); part('sphere', mat('#ffd23b', 0.3), [0.35, 0.4, 0.35], [0, 8.6, -4.15], [0, 0, 0], g);
  flat(g, 18, 10, mat('#e6c88e'), 0, 0.025, 4);
  part('box', mat('#ff7a3a'), [3, 0.12, 0.3], [5, 0.6, 5], [0, 0, 0.15], g); part('cone', mat('#3d7be0'), [0.3, 0.5, 0.3], [5, 0.25, 5], [0, 0, 0], g);
  part('cyl', mat('#c8ccd0'), [0.05, 5, 0.05], [-6, 2.5, 2], [0, 0, 0], g); part('box', mat('#3d7be0'), [1.2, 0.7, 0.03], [-5.4, 4.5, 2], [0, 0, 0], g);
  addOutline(g, 0.03); c.gr.add(g);
  const kidLines = ['I love playtime!', 'Do you have a pet? So cool!', 'Our teacher says pets need love every day.', 'I want to be a trainer when I grow up!', 'I can count to one hundred!', 'Look, I lost a tooth!'];
  for (let i = 0; i < 6; i++) c.npcs.push({ id: `chat@${c.key}#k${i}`, name: 'Student', x: x - 5 + i * 2, z: z + 3 + (i % 2) * 2, look: c.look(200 + i), scale: 0.68, role: 'kid', lines: [kidLines[i]] });
  c.npcs.push({ id: `chat@${c.key}#t`, name: 'Teacher', x: x + 3, z: z + 1, look: { ...c.look(210), acc: 'glasses' }, lines: ['Welcome to our little school!', 'The children learn how to care for wild pets here.'] });
  c.shapes.push({ k: 'r', x, z: z - 5, w: 12, d: 7, col: '#d04a3a' }); c.zones.push({ x, z, r: 12, kind: 'school', name: 'Village School' });
}
export function park(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); const fr = mat('#d04a3a');
  disc(g, 15, mat('#6cc45a'), 0, 0.02, 0); const path = new THREE.Mesh(new THREE.RingGeometry(10, 11.4, 48), mat('#e6c88e')); path.rotation.x = -Math.PI / 2; path.position.y = 0.03; path.userData.ownGeo = true; path.userData.noOutline = true; g.add(path);
  [-1.6, 1.6].forEach(px => { part('cyl', fr, [0.08, 2.9, 0.08], [px, 1.4, -0.6], [0.2, 0, 0], g); part('cyl', fr, [0.08, 2.9, 0.08], [px, 1.4, 0.6], [-0.2, 0, 0], g); });
  part('cyl', fr, [0.08, 3.4, 0.08], [0, 2.8, 0], [0, 0, Math.PI / 2], g);
  const swings: THREE.Group[] = [];
  [-0.8, 0.8].forEach(px => { const s = new THREE.Group(); s.position.set(px, 2.8, 0); g.add(s); [-0.25, 0.25].forEach(o => part('cyl', mat('#8a8a90'), [0.015, 2, 0.015], [o, -1, 0], [0, 0, 0], s)); const seat = part('box', mat('#ffd23b'), [0.6, 0.06, 0.3], [0, -2, 0], [0, 0, 0], s); swings.push(s); c.spots.push({ x: x + px, z: z + 1.1, r: 1.2, kind: 'swing', label: 'Ride the swing', obj: seat }); });
  C(c, x, z, 3.6, 1.6, 3);
  part('box', mat('#3d7be0'), [1, 0.1, 4], [-6, 1.15, 0], [0.55, 0, 0], g); [-0.5, 0.5].forEach(o => part('box', mat('#ffe066'), [0.06, 0.25, 4], [-6 + o, 1.3, 0], [0.55, 0, 0], g));
  [-6.45, -5.55].forEach(px => part('cyl', mat('#c8ccd0'), [0.05, 2.4, 0.05], [px, 1.2, -2], [0, 0, 0], g)); for (let i = 0; i < 5; i++) part('cyl', mat('#c8ccd0'), [0.03, 0.9, 0.03], [-6, 0.4 + i * 0.42, -2], [0, 0, Math.PI / 2], g);
  part('box', mat('#ff7a3a'), [1.1, 0.12, 0.8], [-6, 2.3, -2.2], [0, 0, 0], g); C(c, x - 6, z, 1.4, 4.6, 2.4);
  c.spots.push({ x: x - 6, z: z - 2.9, r: 1.3, kind: 'slide', label: 'Go down the slide', path: [
    { p: [x - 6, 0, z - 2.7], d: 0.3, pose: -1 }, { p: [x - 6, 2.3, z - 2.15], d: 1.3, pose: 13 }, { p: [x - 6, 2.3, z - 1.75], d: 0.35, pose: 14 },
    { p: [x - 6, 0.15, z + 2.1], d: 0.9, pose: 14 }, { p: [x - 6, 0, z + 3.1], d: 0.4, pose: -1 }] });
  [0.5, 2.6, 4.7].forEach(a => { const bx = Math.cos(a) * 12.7, bz = Math.sin(a) * 12.7; bench(c, g, x, z, bx, bz, Math.atan2(-bx, -bz)); });
  [[6, -6], [7, 5]].forEach(([px, pz]) => { const lg = new THREE.Group(); lg.position.set(px, 0, pz); part('cyl', mat('#3a3a48'), [0.08, 3, 0.08], [0, 1.5, 0], [0, 0, 0], lg); const lm = toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.1 }); c.lamps.push(lm); part('sphere', lm, [0.24, 0.3, 0.24], [0, 3, 0], [0, 0, 0], lg, true); g.add(lg); });
  sign(g, 'PARK', 0, 2.4, 14.2, Math.PI, '#5aa04a', '#ffffff', 2, 0.6); part('cyl', mat('#6b4a32'), [0.06, 2, 0.06], [-0.9, 1, 14.2], [0, 0, 0], g); part('cyl', mat('#6b4a32'), [0.06, 2, 0.06], [0.9, 1, 14.2], [0, 0, 0], g);
  addOutline(g, 0.03); c.gr.add(g);
  tree(c, 'neem', x + 5, z - 9); tree(c, 'mango', x - 9, z + 6); tree(c, 'apple', x + 9, z + 8);
  c.anims.push(t => swings.forEach((s, i) => (s.rotation.x = Math.sin(t * 1.8 + i * 1.3) * 0.45)));
  c.npcs.push({ id: `chat@${c.key}#p1`, name: 'Walker', x: x + 11, z: z - 2, look: c.look(301), lines: ['I walk around this park every day!', 'Fresh air is good for pets and people.'] }, { id: `chat@${c.key}#p2`, name: 'Little Mo', x: x - 2, z: z + 3, look: c.look(302), scale: 0.68, role: 'kid', lines: ['Wheee! Push me on the swing!'] });
  c.shapes.push({ k: 'c', x, z, r: 15, col: '#6cc45a' }); c.zones.push({ x, z, r: 15, kind: 'park', name: 'Village Park' });
}
export function farm(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  flat(g, 18, 12, toon('#ffffff', { map: groundTex('#8a5a32', 4) }), -3, 0.025, 0, true);
  const crop = instanced(c.gr, new THREE.ConeGeometry(0.25, 0.7, 6), '#5cbf4a', 120, 1.1, true, true, true), pump = instanced(c.gr, new THREE.SphereGeometry(0.3, 10, 8), '#ff8a1b', 40, 1.1, true, true, true);
  const m4 = new THREE.Matrix4();
  for (let r = 0; r < 6; r++) { part('box', mat('#7a4a2a'), [16, 0.25, 0.6], [-3, 0.12, -4.5 + r * 1.8], [0, 0, 0], g); for (let k = 0; k < 15; k++) { const px = x - 10 + k * 1.05, pz = z - 4.5 + r * 1.8; if (r === 2) pump.add(m4.makeTranslation(px, 0.35, pz), k % 2 ? '#ff8a1b' : '#ffb02b'); else crop.add(m4.makeTranslation(px, 0.55, pz), r % 2 ? '#5cbf4a' : '#8ac83a'); } }
  crop.done(); pump.done();
  part('cyl', mat('#7a4a2a'), [0.07, 2.2, 0.07], [-3, 1.1, 6.5], [0, 0, 0], g); part('cyl', mat('#7a4a2a'), [0.05, 1.6, 0.05], [-3, 1.6, 6.5], [0, 0, Math.PI / 2], g); part('sphere', mat('#e8c870'), [0.28, 0.3, 0.28], [-3, 2.35, 6.5], [0, 0, 0], g); part('cone', mat('#8a5a2a'), [0.4, 0.4, 0.4], [-3, 2.7, 6.5], [0, 0, 0], g); part('box', mat('#3d7be0'), [0.5, 0.6, 0.25], [-3, 1.55, 6.5], [0, 0, 0], g);
  part('box', mat('#c0503a'), [2, 1.4, 1.6], [-11, 0.7, 5], [0, 0, 0], g); part('cone', mat('#7a2a1a'), [1.6, 0.8, 1.3], [-11, 1.8, 5], [0, Math.PI / 4, 0], g);
  for (let k = 0; k < 3; k++) { const hx = -12.5 + k * 1.1; part('sphere', mat('#ffffff'), [0.22, 0.2, 0.28], [hx, 0.25, 6.4], [0, 0, 0], g); part('sphere', mat('#ff3a2a'), [0.06, 0.08, 0.06], [hx, 0.45, 6.6], [0, 0, 0], g, true); }
  addOutline(g, 0.03); c.gr.add(g); C(c, x - 11, z + 5, 2.2, 1.8, 2);
  makeHouse(x + 10, z, 6, 6, '#c0503a', '#7a2a1a', false, false, c.gr, c.cl, c.lamps, -Math.PI / 2);
  c.spots.push({ x: x - 3, z, r: 6, kind: 'harvest', label: 'Harvest veggies', item: 'veg', key: `hv_${Math.round(x)}_${Math.round(z)}` }, { x: x - 11, z: z + 6.6, r: 2, kind: 'harvest', label: 'Collect eggs', item: 'egg', key: `eg_${Math.round(x)}_${Math.round(z)}` });
  c.npcs.push({ id: `chat@${c.key}#f`, name: 'Farmer Bo', x: x - 6, z: z + 7, look: { ...c.look(401), acc: 'hat' }, lines: ['These veggies grow fresh every day.', 'Take some! Cooking with veggies makes yummy soup.'] });
  c.shapes.push({ k: 'r', x: x - 3, z, w: 18, d: 12, col: '#8a5a32' }); c.zones.push({ x, z, r: 14, kind: 'farm', name: 'Farm' });
}
export function garden(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  disc(g, 15, mat('#7acb5a'), 0, 0.02, 0);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; if (i % 6 === 0) continue; part('box', mat('#3e8a3a'), [3.7, 1.2, 0.9], [Math.cos(a) * 14, 0.6, Math.sin(a) * 14], [0, -a + Math.PI / 2, 0], g); C(c, x + Math.cos(a) * 14, z + Math.sin(a) * 14, 2, 2, 1.2); }
  part('cyl', mat('#c8c0b0'), [2, 0.6, 2], [0, 0.3, 0], [0, 0, 0], g); part('cyl', water(), [1.8, 0.06, 1.8], [0, 0.6, 0], [0, 0, 0], g, true); part('cyl', mat('#c8c0b0'), [0.3, 1.6, 0.3], [0, 1, 0], [0, 0, 0], g); part('sphere', mat('#c8c0b0'), [0.7, 0.25, 0.7], [0, 1.8, 0], [0, 0, 0], g); C(c, x, z, 4, 4, 2);
  bench(c, g, x, z, 5, 0, -Math.PI / 2); bench(c, g, x, z, -5, 0, Math.PI / 2);
  sign(g, 'FLOWER GARDEN', 0, 2.2, 14.5, Math.PI, '#ff8ad0', '#ffffff', 4, 0.8);
  addOutline(g, 0.03); c.gr.add(g);
  [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, -9], [0, 9]].forEach(([px, pz]) => flowerField(c, x + px, z + pz, 6, 5, 70));
  c.shapes.push({ k: 'c', x, z, r: 15, col: '#ff8ad0' }); c.zones.push({ x, z, r: 15, kind: 'garden', name: 'Flower Garden' });
}
export function haunted(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  disc(g, 22, toon('#ffffff', { map: groundTex('#3a3036', 8) }), 0, 0.02, 0, true);
  makeHouse(x, z - 7, 8, 7, '#4a4248', '#2a1e2a', true, true, c.gr, c.cl, [], 0);
  for (let i = 0; i < 4; i++) part('box', mat('#2a2018'), [1.4, 0.15, 0.08], [(i % 2 ? 2.4 : -2.4), 2.2 + (i >> 1) * 0.3, -3.35], [0, 0, (i % 2 ? 0.4 : -0.4)], g);
  const glow = toon('#7aff8a', { emissive: '#4aff6a', emissiveIntensity: 1.2 });
  [-2.4, 2.4].forEach(px => part('box', glow, [0.75, 0.85, 0.05], [px, 2.4, -3.42], [0, 0, 0], g, true));
  for (let i = 0; i < 10; i++) { const a = i * 0.7 + 0.3, r = 9 + (i % 3) * 3; const gx = Math.cos(a) * r, gz = Math.sin(a) * r + 4; part('box', mat('#6a666e'), [0.7, 0.9, 0.2], [gx, 0.45, gz], [0, a, (i % 3 - 1) * 0.15], g); part('cyl', mat('#6a666e'), [0.35, 0.2, 0.35], [gx, 0.9, gz], [Math.PI / 2, a, 0], g); }
  for (let i = 0; i < 3; i++) { part('sphere', mat('#d06a1a'), [0.4, 0.32, 0.4], [-6 + i * 6, 0.3, 6], [0, 0, 0], g); part('box', toon('#ffd23b', { emissive: '#ffaa00', emissiveIntensity: 1.5 }), [0.3, 0.1, 0.05], [-6 + i * 6, 0.35, 6.38], [0, 0, 0], g, true); }
  sign(g, 'KEEP OUT', 0, 1.6, 14, Math.PI, '#3a2a20', '#ff4a3a', 2, 0.6); part('cyl', mat('#3a2a20'), [0.06, 1.6, 0.06], [0, 0.8, 14.05], [0, 0, 0.1], g);
  const wisps: THREE.Mesh[] = []; for (let i = 0; i < 5; i++) { const w = part('sphere', toon('#bfffd0', { emissive: '#7affa0', emissiveIntensity: 1.5, transparent: true, opacity: 0.7 }), [0.2, 0.2, 0.2], [0, 1.5, 0], [0, 0, 0], g, true); wisps.push(w); }
  addOutline(g, 0.03); c.gr.add(g);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; tree(c, 'dead', x + Math.cos(a) * 16, z + Math.sin(a) * 16, 1 + (i % 2) * 0.3); }
  c.anims.push(t => wisps.forEach((w, i) => w.position.set(Math.cos(t * 0.5 + i * 1.3) * (6 + i), 1.2 + Math.sin(t * 1.5 + i) * 0.5, Math.sin(t * 0.4 + i * 1.3) * (6 + i) + 3)));
  c.zones.push({ x, z, r: 22, kind: 'haunt', name: 'Haunted Hollow' }); c.shapes.push({ k: 'c', x, z, r: 22, col: '#3a3036' });
}
export function waterfall(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const cliff = new THREE.Mesh(jitter(new THREE.BoxGeometry(20, 15, 7, 5, 4, 2), 0.7), mat('#8a8478')); cliff.position.set(0, 7.5, -7); cliff.userData.ownGeo = true; cliff.castShadow = true; g.add(cliff);
  const top = new THREE.Mesh(jitter(new THREE.BoxGeometry(20.5, 1, 7.5, 5, 1, 2), 0.3), mat('#5aae4a')); top.position.set(0, 15.2, -7); top.userData.ownGeo = true; g.add(top);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const x2 = cv.getContext('2d')!; x2.fillStyle = '#5fc8f8'; x2.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) { x2.fillStyle = i % 2 ? '#e8f8ff' : '#a8e4ff'; x2.fillRect(Math.random() * 64, Math.random() * 128, 2 + Math.random() * 4, 10 + Math.random() * 30); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 3);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 })); fall.position.set(0, 7.5, -3.4); fall.userData.ownGeo = fall.userData.ownMat = true; fall.userData.noOutline = true; g.add(fall);
  disc(g, 6, water(), 0, 0.05, 1.5, true); const foam = new THREE.Mesh(new THREE.RingGeometry(1.5, 3, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.07, -1.8); foam.userData.ownGeo = foam.userData.ownMat = true; g.add(foam);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; part('ico', mat('#9a968e'), [0.6, 0.4, 0.6], [Math.cos(a) * 6.3, 0.2, 1.5 + Math.sin(a) * 6.3], [0, a, 0], g); }
  addOutline(g, 0.04); c.gr.add(g);
  c.anims.push(t => { tex.offset.y = (t * 1.6) % 1; foam.scale.setScalar(1 + Math.sin(t * 4) * 0.08); });
  C(c, x, z - 7, 20, 7, 15, 0.3); C(c, x, z + 1.5, 8.4, 8.4); c.waters.push({ x0: x - 4.2, x1: x + 4.2, z0: z - 2.7, z1: z + 5.7 });
  c.spots.push({ x, z: z + 6.6, r: 2.4, kind: 'fish', label: 'Go fishing' });
  c.zones.push({ x, z, r: 14, kind: 'waterfall', name: 'Rainbow Falls' }); c.shapes.push({ k: 'c', x, z: z + 1.5, r: 6, col: '#4fc3f7' });
}

// Rare, dangerous-looking volcanic pool. A clear stone rim marks where it is
// safe to walk; the engine keeps the player out of the molten center.
export function lavaLake(c: Ctx, x: number, z: number) {
  const r = 8.2, g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g);
  disc(g, r + 2.8, toon('#403333'), 0, 0.045, 0);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#a92b13'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 110; i++) {
    const px = c.rnd() * 128, py = c.rnd() * 128;
    ctx.fillStyle = ['#fc5b1b', '#ffc34b', '#ee3d17', '#69231e'][i % 4];
    ctx.beginPath(); ctx.ellipse(px, py, 2 + c.rnd() * 11, 1 + c.rnd() * 5, c.rnd() * 6, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1.4, 1.4);
  const surface = disc(g, r, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 0, 0.095, 0, true);
  surface.userData.ownMat = true;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, rr = r + 0.45 + c.rnd() * 1.05;
    part('ico', mat(i % 3 ? '#443638' : '#55423b'), [0.4 + c.rnd() * 0.35, 0.3, 0.35], [Math.cos(a) * rr, 0.21, Math.sin(a) * rr], [0, a, 0], g);
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.7, rr = 1.8 + (i % 3) * 1.7;
    part('ico', mat('#3a3030'), [0.4, 0.18, 0.5], [Math.cos(a) * rr, 0.13, Math.sin(a) * rr], [0, a, 0], g);
  }
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    const a = c.rnd() * Math.PI * 2, rr = c.rnd() * (r - 1);
    const b = part('sphere', new THREE.MeshBasicMaterial({ color: i % 3 ? '#f99133' : '#ffe78c', transparent: true, opacity: 0.75 }), [0.12, 0.12, 0.12], [Math.cos(a) * rr, 0.16, Math.sin(a) * rr], [0, 0, 0], g, true);
    b.userData.offset = c.rnd() * 9; bubbles.push(b);
  }
  c.anims.push(t => { tex.offset.x = (t * 0.025) % 1; tex.offset.y = (t * 0.04) % 1; for (const b of bubbles) { const phase = (t * 0.8 + b.userData.offset) % 2; b.position.y = 0.12 + phase * 0.32; b.scale.setScalar(Math.max(0.01, 1 - phase * 0.42)); (b.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.75 - phase * 0.4); } });
  c.zones.push({ x, z, r: r + 1.1, kind: 'lava', name: 'Emberglass Lake' });
  c.shapes.push({ k: 'c', x, z, r: r + 1.1, col: '#d84324' });
}

// A mine offers four distinct veins each in-game day. Each completed dig has
// exactly a 10% diamond roll; otherwise it produces tradable crystal ore.
export function mine(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g);
  disc(g, 10, toon('#504c50'), 0, 0.052, 0);
  const back = mat('#625b59'), timber = mat('#7b5234');
  part('ico', back, [4.4, 3.1, 3.2], [0, 1.3, -4.1], [0, 0.2, 0], g);
  const mouth = part('sphere', mat('#171922'), [1.8, 1.65, 0.18], [0, 1.35, -1.22], [0, 0, 0], g, true);
  mouth.userData.noOutline = true;
  for (const side of [-1, 1]) {
    part('box', timber, [0.28, 3.1, 0.32], [side * 1.85, 1.55, -1], [0, 0, 0], g);
    part('box', timber, [0.25, 0.2, 2.8], [side * 0.85, 0.11, 1], [0, 0, 0], g);
    for (let k = 0; k < 3; k++) part('box', timber, [2, 0.1, 0.18], [0, 0.12, k * 0.65 + 0.3], [0, 0, 0], g);
  }
  part('box', timber, [4.15, 0.33, 0.34], [0, 3.12, -1], [0, 0, 0], g);
  part('cyl', mat('#b3b0a8'), [0.06, 2.6, 0.06], [-6.9, 1.3, 4.5], [0, 0, 0], g);
  sign(g, 'CRYSTAL MINE', -6.9, 2.5, 4.56, Math.PI, '#4a3841', '#ffe8b3', 2.6, 0.55);
  c.cl.push({ x0: x - 4.1, x1: x + 4.1, z0: z - 7.2, z1: z - 2.1, h: 4 });
  const veins: [number, number][] = [[-5.3, 0.4], [5.2, 0.2], [-3.2, 5.3], [3.4, 5.1]];
  veins.forEach(([vx, vz], i) => {
    const nugget = new THREE.Group(); nugget.position.set(vx, 0, vz); g.add(nugget);
    part('ico', mat(i % 2 ? '#77737c' : '#88828c'), [0.55, 0.48, 0.52], [0, 0.39, 0], [i * 0.24, i, 0], nugget);
    for (let k = 0; k < 3; k++) {
      const crystal = part('cone', toon(k === 1 ? '#c0e6ff' : '#9ab6dd', { emissive: '#34608d', emissiveIntensity: 0.14 }), [0.1, 0.3 + k * 0.08, 0.1], [(k - 1) * 0.19, 0.78, (k % 2) * 0.15], [0, 0, (k - 1) * 0.28], nugget);
      crystal.name = 'oreCrystal';
    }
    addOutline(nugget, 0.018);
    c.spots.push({ x: x + vx, z: z + vz, r: 1.65, kind: 'dig', label: 'Dig this crystal vein', key: `mine_${c.key}_${i}`, obj: nugget });
  });
  c.zones.push({ x, z, r: 13, kind: 'mine', name: 'Crystal Mine' });
  c.shapes.push({ k: 'c', x, z, r: 7, col: '#77717c' });
}

// A restful shaded beach seat, close enough to the surf to hear fish jump.
export function beachRest(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g);
  const wood = mat('#b58453'), cloth = mat('#fcbd73');
  let seat: THREE.Mesh | null = null;
  [-1.1, 1.1].forEach(side => {
    const top = part('box', wood, [1.3, 0.1, 0.7], [side, 0.48, 0.1], [0, 0, 0], g);
    if (side < 0) seat = top;
    part('box', wood, [1.3, 0.08, 0.75], [side, 0.72, -0.25], [-0.4, 0, 0], g);
    [-0.48, 0.48].forEach(px => part('box', wood, [0.08, 0.48, 0.08], [side + px, 0.24, 0.12], [0, 0, 0], g));
  });
  part('cyl', mat('#f5f0e0'), [0.055, 2.9, 0.055], [0, 1.45, -0.25], [0, 0, 0], g);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.85, 0.85, 12), cloth); canopy.position.set(0, 2.95, -0.25); canopy.castShadow = true; g.add(canopy);
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) {
      const a = i * Math.PI / 6;
      const segment = new THREE.Mesh(new THREE.ConeGeometry(2.84, 0.86, 3, 1, false, a, Math.PI / 6), mat('#f8ede0'));
      segment.position.copy(canopy.position); segment.castShadow = true; g.add(segment);
    }
  }
  part('cyl', mat('#9a6b4b'), [0.4, 0.18, 0.4], [0, 0.1, -0.25], [0, 0, 0], g);
  addOutline(g, 0.025);
  c.spots.push({ x: x - 1.1, z: z + 1, r: 1.9, kind: 'shelter', label: 'Rest under the umbrella', obj: seat ?? undefined });
  c.zones.push({ x, z, r: 4, kind: 'beachrest', name: 'Beach Rest' });
}
export function monument(c: Ctx, x: number, z: number, kind: 'statue' | 'tower' | 'arch' | 'lighthouse') {
  const g = new THREE.Group(); g.position.set(x, 0, z); const st = mat('#b8b0a0'), moss = mat('#6aa848'); let name = '';
  if (kind === 'statue') {
    part('box', st, [4.5, 1.6, 4.5], [0, 0.8, 0], [0, 0, 0], g); part('box', mat('#a8a090'), [3.6, 0.6, 3.6], [0, 1.9, 0], [0, 0, 0], g);
    part('cone', st, [1.8, 6, 1.8], [0, 5.2, 0], [0, 0, 0], g); part('sphere', st, [1.4, 1.2, 1], [0, 7.6, 0], [0, 0, 0], g); part('sphere', st, [0.85, 0.95, 0.85], [0, 9.2, 0], [0, 0, 0], g);
    part('cone', st, [0.9, 1.1, 0.9], [0, 10.3, -0.1], [-0.3, 0, 0], g);
    [-1, 1].forEach(s => part('cyl', st, [0.3, 2.6, 0.3], [s * 1.0, 6.8, 0.8], [0.9, 0, s * 0.3], g));
    part('box', mat('#c8ccd0'), [0.25, 6, 0.12], [0, 6.2, 1.9], [0, 0, 0], g); part('box', st, [1.6, 0.25, 0.3], [0, 7.7, 1.9], [0, 0, 0], g);
    [[-1.6, 1.8], [1.5, -1.4], [0.4, 2]].forEach(([px, pz]) => part('sphere', moss, [0.6, 0.25, 0.6], [px, 1.65, pz], [0, 0, 0], g));
    C(c, x, z, 4.6, 4.6, 11); name = 'Old Guardian Statue';
  } else if (kind === 'tower') {
    [[3, 5, 2.5], [2.6, 5, 7.5], [2.2, 4, 12]].forEach(([r, h, y]) => part('cyl', st, [r, h, r], [0, y, 0], [0, 0, 0], g));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; part('box', st, [0.7, 0.8, 0.7], [Math.cos(a) * 2.1, 14.4, Math.sin(a) * 2.1], [0, -a, 0], g); if (i % 3 === 0) part('box', mat('#2a2228'), [0.6, 1.1, 0.1], [Math.cos(a) * 2.62, 8, Math.sin(a) * 2.62], [0, -a + Math.PI / 2, 0], g, true); }
    part('cyl', mat('#5a4a3a'), [0.06, 3, 0.06], [0, 15.5, 0], [0, 0, 0], g); part('box', mat('#d04a3a'), [1.2, 0.7, 0.04], [0.6, 16.5, 0], [0, 0, 0], g);
    part('box', mat('#3a2a20'), [1.4, 2.4, 0.2], [0, 1.2, 3.02], [0, 0, 0], g, true); C(c, x, z, 6, 6, 15); name = 'Ancient Sky Tower';
  } else if (kind === 'arch') {
    [-4, 4].forEach(px => { part('box', st, [1.6, 9, 1.6], [px, 4.5, 0], [0, 0, 0], g); C(c, x + px, z, 1.8, 1.8, 9); });
    part('box', st, [11, 1.4, 2], [0, 9.6, 0], [0, 0, 0], g); part('box', mat('#a8a090'), [12, 0.5, 2.4], [0, 10.5, 0], [0, 0, 0], g);
    [-3, 0, 3].forEach(px => part('sphere', mat('#e0a030', 0.3), [0.4, 0.4, 0.15], [px, 9.6, 1.02], [0, 0, 0], g));
    name = 'Sunrise Arch';
  } else {
    for (let i = 0; i < 6; i++) part('cyl', mat(i % 2 ? '#ffffff' : '#e0302a'), [1.6 - i * 0.12, 2, 1.6 - i * 0.12], [0, 1 + i * 2, 0], [0, 0, 0], g);
    part('cyl', mat('#3a3a48'), [1.4, 0.2, 1.4], [0, 12.1, 0], [0, 0, 0], g); const lm = toon('#ffe7a0', { emissive: '#ffdd66', emissiveIntensity: 1 }); c.lamps.push(lm); part('cyl', lm, [0.8, 1.4, 0.8], [0, 12.9, 0], [0, 0, 0], g); part('cone', mat('#e0302a'), [1.1, 1, 1.1], [0, 14.1, 0], [0, 0, 0], g);
    C(c, x, z, 3.4, 3.4, 14); name = 'Seaside Lighthouse';
  }
  addOutline(g, 0.04); c.gr.add(g); c.zones.push({ x, z, r: 12, kind: 'landmark', name }); c.shapes.push({ k: 'c', x, z, r: 3, col: '#b8b0a0' });
}
const peakGeo = jitter(new THREE.ConeGeometry(1, 1, 9, 4), 0.1);
export function peak(c: Ctx, x: number, z: number, r: number, h: number, snow = true) {
  const m = new THREE.Mesh(peakGeo, mat(['#8a8478', '#9a9488', '#7a7468'][Math.floor(c.rnd() * 3)])); m.scale.set(r, h, r); m.position.set(x, h / 2 - 0.5, z); m.rotation.y = c.rnd() * 6; m.castShadow = true; m.receiveShadow = true; c.gr.add(m);
  if (snow) { const s = new THREE.Mesh(peakGeo, mat('#f4f8ff')); s.scale.set(r * 0.36, h * 0.36, r * 0.36); s.position.set(x, h * 0.82 - 0.5, z); s.rotation.y = m.rotation.y; c.gr.add(s); }
  addOutline(m, 0.08); C(c, x, z, r * 1.85, r * 1.85, h * 0.7, 0.5); c.shapes.push({ k: 'c', x, z, r: r * 0.9, col: '#8a8478' });
}
export function cave(c: Ctx, x: number, z: number) {
  const R = 9; peak(c, x, z - 13, 15, 26, true);
  const dmat = toon('#6a625a', { side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const dome = new THREE.Mesh(jitter(new THREE.SphereGeometry(R, 22, 10, Math.PI * 0.62, Math.PI * 2 - 0.5, 0, Math.PI / 2), 0.5), dmat); dome.position.set(x, -0.2, z); dome.userData.ownGeo = dome.userData.ownMat = true; dome.castShadow = true; c.gr.add(dome);
  const g = new THREE.Group(); g.position.set(x, 0, z);
  disc(g, R, mat('#3a342e'), 0, 0.03, 0);
  for (let i = 0; i < 9; i++) { const a = i * 0.9, r = 3 + (i % 3) * 1.8; part('cone', mat('#7a7068'), [0.35, 1.2 + (i % 3) * 0.5, 0.35], [Math.cos(a) * r, 0.6, Math.sin(a) * r], [0, 0, 0], g); part('cone', mat('#7a7068'), [0.25, 1, 0.25], [Math.cos(a + 0.4) * r, 6.5 - (i % 3) * 0.6, Math.sin(a + 0.4) * r], [Math.PI, 0, 0], g); }
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.5; part('cone', toon(i % 2 ? '#7ae0ff' : '#c08aff', { emissive: i % 2 ? '#3ab0ff' : '#8a4aff', emissiveIntensity: 1.2 }), [0.25, 0.9, 0.25], [Math.cos(a) * 6.5, 0.45, Math.sin(a) * 6.5], [0, 0, 0.2], g); }
  addOutline(g, 0.03); c.gr.add(g);
  const open = Math.PI / 2; // opening faces +z
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - open), Math.cos(a - open))) < 0.4) continue; C(c, x + Math.cos(a) * (R - 0.4), z + Math.sin(a) * (R - 0.4), 2.2, 2.2); }
  c.zones.push({ x, z, r: R - 0.5, kind: 'cave', name: 'Crystal Cave', mat: dmat }); c.shapes.push({ k: 'c', x, z, r: R, col: '#5a524a' });
}
export function river(c: Ctx, cx: number, cz: number, bridge: boolean) {
  const g = new THREE.Group(); const L = 64, W = 7;
  flat(g, L, W + 3, mat('#d8c890'), cx, 0.03, cz); flat(g, L, W, water(), cx, 0.05, cz, true);
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5 + Math.random() * 2, 0.12), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.6 })); f.rotation.x = -Math.PI / 2; f.position.set(cx - L / 2 + Math.random() * L, 0.07, cz + (Math.random() - 0.5) * W * 0.8); f.userData.ownGeo = f.userData.ownMat = true; g.add(f); }
  c.gr.add(g);
  if (bridge) {
    C(c, cx - 17.25, cz, 29.5, W); C(c, cx + 17.25, cz, 29.5, W);
    const b = new THREE.Group(); b.position.set(cx, 0, cz); const root = mat('#6a4a2a'), moss = mat('#4a8a3a');
    for (let k = 0; k < 7; k++) part('cyl', root, [0.16, W + 4, 0.16], [-0.9 + k * 0.3, 0.12 + Math.sin(k) * 0.03, 0], [Math.PI / 2, 0, (k - 3) * 0.02], b);
    [-1.3, 1.3].forEach(sx => { const arc = new THREE.Mesh(new THREE.TorusGeometry(W / 2 + 1.6, 0.12, 6, 20, Math.PI), root); arc.rotation.y = Math.PI / 2; arc.position.set(sx, -1.6, 0); arc.scale.set(1, 0.5, 1); arc.userData.ownGeo = true; b.add(arc);
      for (let k = 0; k < 6; k++) part('cyl', root, [0.04, 1.4, 0.04], [sx, 0.7, -W / 2 + k * (W / 5)], [0, 0, 0], b); });
    for (let k = 0; k < 8; k++) part('sphere', moss, [0.35, 0.18, 0.35], [(k % 2 ? 1.3 : -1.3), 1.25, -W / 2 + k * 1.1], [0, 0, 0], b);
    for (let k = 0; k < 6; k++) part('cyl', root, [0.03, 1.8, 0.03], [(k % 2 ? 1.5 : -1.5), -0.2, -2.5 + k], [0, 0, 0], b);
    addOutline(b, 0.02); c.gr.add(b);
    c.zones.push({ x: cx, z: cz, r: 5, kind: 'bridge', name: 'Living Root Bridge' });
  } else C(c, cx, cz, L, W);
  c.waters.push({ x0: cx - L / 2, x1: cx + L / 2, z0: cz - W / 2, z1: cz + W / 2 });
  [-20, 14].forEach(o => c.spots.push({ x: cx + o, z: cz + W / 2 + 1.2, r: 2.4, kind: 'fish', label: 'Go fishing' }));
  c.shapes.push({ k: 'r', x: cx, z: cz, w: L, d: W, col: '#4fc3f7' });
}

// ---------- airports + planes ----------
export const PLANES = [
  { name: 'Sky Cub', color: '#ffd23b', trim: '#e0574a', speed: 22, kind: 'prop', desc: 'Slow and easy. Great for beginners.' },
  { name: 'Sunbird', color: '#ff7a3b', trim: '#ffffff', speed: 28, kind: 'prop', desc: 'A bright and friendly little plane.' },
  { name: 'Royal Glider', color: '#ffffff', trim: '#7a5ad0', speed: 24, kind: 'glider', desc: 'Long wings. Very smooth and calm.' },
  { name: 'Blue Falcon', color: '#3d7be0', trim: '#ffe066', speed: 36, kind: 'jet', desc: 'A fast jet with a sharp nose.' },
  { name: 'Thunder Jet', color: '#5a2a8a', trim: '#ffe066', speed: 46, kind: 'jet', desc: 'The fastest plane! Hold on tight.' },
];
export function buildPlane(i: number) {
  const P = PLANES[i]; const g = new THREE.Group(); const body = mat(P.color), trim = mat(P.trim), dark = mat('#2a2a3a');
  const glass = toon('#9ad8ff', { transparent: true, opacity: 0.55, emissive: '#3a7aa0', emissiveIntensity: 0.3 }); const jet = P.kind === 'jet';
  part('sphere', body, [0.78, 0.78, 2.9], [0, 0.9, 0], [0, 0, 0], g); part('cone', body, [0.55, 1.6, 0.55], [0, 0.95, -3.3], [-Math.PI / 2, 0, 0], g);
  part('box', trim, [0.06, 0.25, 4.6], [0.72, 0.95, -0.4], [0, 0, 0], g, true); part('box', trim, [0.06, 0.25, 4.6], [-0.72, 0.95, -0.4], [0, 0, 0], g, true);
  part('sphere', glass, [0.5, 0.45, 0.9], [0, 1.5, 0.5], [0, 0, 0], g, true);
  const ws = P.kind === 'glider' ? 10 : jet ? 6 : 7.4, wy = jet ? 0.7 : 1.15;
  if (jet) [-1, 1].forEach(s => { part('box', body, [ws / 2, 0.12, 1.4], [s * ws / 4, wy, -0.3], [0, s * 0.45, 0], g); part('cyl', dark, [0.28, 1.4, 0.28], [s * 1.4, 0.5, 0.1], [Math.PI / 2, 0, 0], g); part('cone', toon('#7ad0ff', { emissive: '#3ab0ff', emissiveIntensity: 1.5 }), [0.22, 0.6, 0.22], [s * 1.4, 0.5, -0.9], [-Math.PI / 2, 0, 0], g, true); });
  else { part('box', body, [ws, 0.12, 1.3], [0, wy, 0.2], [0, 0, 0], g); [-1, 1].forEach(s => part('box', trim, [0.9, 0.14, 1.32], [s * (ws / 2 - 0.45), wy, 0.2], [0, 0, 0], g)); }
  part('box', body, [0.1, 1.2, 1], [0, 1.65, -3.6], [0, 0, 0], g); part('box', trim, [0.12, 0.4, 0.6], [0, 2.05, -3.75], [0, 0, 0], g); part('box', body, [2.6, 0.08, 0.6], [0, 1.0, -3.75], [0, 0, 0], g);
  if (!jet) { part('cone', trim, [0.3, 0.5, 0.3], [0, 0.92, 3.0], [Math.PI / 2, 0, 0], g); const prop = new THREE.Group(); prop.position.set(0, 0.92, 3.15); g.add(prop); part('box', dark, [2.2, 0.16, 0.05], [0, 0, 0], [0, 0, 0], prop); g.userData.prop = prop; }
  [[0, 2], [-0.9, -0.2], [0.9, -0.2]].forEach(([px, pz]) => { part('cyl', dark, [0.04, 0.5, 0.04], [px, 0.35, pz], [0, 0, 0], g); part('cyl', dark, [0.2, 0.12, 0.2], [px, 0.15, pz], [0, 0, Math.PI / 2], g); });
  addOutline(g, 0.03); return g;
}
export function airport(c: Ctx, x: number, z: number, name: string) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  flat(g, 60, 10, mat('#3a3a42'), 0, 0.03, 0); for (let i = 0; i < 11; i++) part('box', mat('#ffffff'), [2.6, 0.02, 0.3], [-25 + i * 5, 0.05, 0], [0, 0, 0], g, true);
  for (let i = 0; i < 16; i++) { const lm = toon('#ffe066', { emissive: '#ffcc33', emissiveIntensity: 0.1 }); c.lamps.push(lm); part('sphere', lm, [0.12, 0.12, 0.12], [-29 + i * 3.9, 0.12, (i % 2 ? 5.2 : -5.2)], [0, 0, 0], g, true); }
  flat(g, 34, 14, mat('#9a9aa0'), 0, 0.028, 13);
  part('cyl', mat('#e8e8f0'), [1.3, 9, 1.3], [-20, 4.5, 16], [0, 0, 0], g); part('cyl', toon('#7ad0ff', { transparent: true, opacity: 0.7, emissive: '#3a90c0', emissiveIntensity: 0.4 }), [2.1, 1.8, 2.1], [-20, 9.9, 16], [0, 0, 0], g); part('cone', mat('#d04a3a'), [2.4, 1.2, 2.4], [-20, 11.4, 16], [0, 0, 0], g); C(c, x - 20, z + 16, 3, 3, 12);
  const hangar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 12, 20, 1, false, 0, Math.PI), mat('#a8b0b8')); hangar.rotation.set(0, 0, Math.PI / 2); hangar.rotation.order = 'ZXY'; hangar.position.set(16, 0, 20); hangar.userData.ownGeo = true; g.add(hangar); C(c, x + 16, z + 20, 12, 10, 5);
  part('cyl', mat('#c8ccd0'), [0.06, 4, 0.06], [-28, 2, 8], [0, 0, 0], g); part('cone', mat('#ff7a1b'), [0.35, 1.6, 0.35], [-27.2, 3.8, 8], [0, 0, Math.PI / 2 + 0.2], g);
  sign(g, 'AIRPORT', -10, 3.2, 20.8, Math.PI, '#3d7be0', '#ffffff', 4, 1); part('cyl', mat('#6b4a32'), [0.08, 3, 0.08], [-11.8, 1.5, 20.8], [0, 0, 0], g); part('cyl', mat('#6b4a32'), [0.08, 3, 0.08], [-8.2, 1.5, 20.8], [0, 0, 0], g);
  addOutline(g, 0.03); c.gr.add(g);
  for (let i = 0; i < 5; i++) { const p = buildPlane(i); const px = -12 + i * 6; p.position.set(x + px, 0, z + 12); p.rotation.y = Math.PI; c.gr.add(p); C(c, x + px, z + 12, 3, 5, 2, 0.2); }
  c.npcs.push({ id: 'commander@' + c.key, name: 'Commander Hale', x: x - 5, z: z + 6.5, look: { ...c.look(500), body: 'male', top: '#4a5a3a', bottom: '#3a4a2a', acc: 'hat', hair: 'short' }, role: 'commander' });
  c.zones.push({ x, z: z + 6, r: 30, kind: 'airport', name }); c.shapes.push({ k: 'r', x, z, w: 60, d: 10, col: '#3a3a42' });
}
