import * as THREE from 'three';
import { mat, toon, addOutline, OUTLINE, OUTLINE_NF, part, groundTex, terrainMat } from './models';
import type { Floor } from './places';
import { PORTAL_POS } from './dimension';

export const IX = 300; // home interior origin (underground, never reachable)
export const IY = -200;
export interface Box { x0: number; x1: number; z0: number; z1: number; h?: number; e?: number }
export type HouseFn = (x: number, z: number, w: number, d: number, wall: string, roof: string, chimney?: boolean, big?: boolean, parent?: THREE.Object3D, clist?: Box[], lm?: THREE.MeshToonMaterial[], ry?: number, stairs?: boolean, fl?: Floor[]) => THREE.Object3D;
export let makeHouse: HouseFn = () => new THREE.Group();
export interface World {
  ground: THREE.Mesh; horizon: THREE.Group; floors: Floor[]; inFloors: Floor[];
  colliders: Box[]; inColliders: Box[]; lampMats: THREE.MeshToonMaterial[]; homeDoor: THREE.Object3D; berries: THREE.Group[]; stone: THREE.Mesh; barrier: THREE.Mesh;
  sky: THREE.Mesh; skyU: { top: { value: THREE.Color }; bottom: { value: THREE.Color } }; clouds: THREE.Group; decor: Record<string, THREE.Object3D>; fire: THREE.PointLight; roomLight: THREE.PointLight; villageLight: THREE.PointLight;
  portal: THREE.Group; portalSeal: THREE.Object3D; portalCore: THREE.Object3D;
}
// Shapes for the minimap
export const MAP_SHAPES = {
  houses: [[-18, -14, 7, 6, '#e0574a'], [18, -14, 8, 6, '#3d7be0'], [0, -27, 10, 7, '#5aa04a'], [-23, 12, 6, 6, '#a05ab0'], [23, 12, 6, 6, '#e0a030']] as [number, number, number, number, string][],
  paths: [[0, 5, 6, 60], [0, -10, 50, 5], [0, 105, 6, 150]] as [number, number, number, number][],
};

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function jitter(g: THREE.BufferGeometry, amt: number) {
  const p = g.attributes.position as THREE.BufferAttribute; const map = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; if (!map.has(k)) map.set(k, [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt]); const j = map.get(k)!; p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]); }
  g.computeVertexNormals(); return g;
}

// Instanced helper with matching outline instances
export function instanced(scene: THREE.Object3D, g: THREE.BufferGeometry, color: string, max: number, outline = 1.07, shadow = true, fog = true, ownGeo = false) {
  const m = new THREE.InstancedMesh(g, toon('#ffffff', { fog }), max); m.castShadow = shadow; m.receiveShadow = true; m.userData.ownMat = true; m.userData.ownGeo = ownGeo;
  const og = outline ? g.clone().scale(outline, outline, outline) : null; const o = og ? new THREE.InstancedMesh(og, fog ? OUTLINE : OUTLINE_NF, max) : null;
  if (o) o.userData.ownGeo = true;
  let n = 0; const col = new THREE.Color();
  return {
    add(mx: THREE.Matrix4, c?: string) { if (n >= max) return; m.setMatrixAt(n, mx); o?.setMatrixAt(n, mx); m.setColorAt(n, col.set(c ?? color)); n++; },
    done() { m.count = n; if (o) { o.count = n; scene.add(o); } scene.add(m); if (m.instanceColor) m.instanceColor.needsUpdate = true; },
  };
}

export function buildWorld(scene: THREE.Scene): World {
  const colliders: Box[] = [], inColliders: Box[] = [], lampMats: THREE.MeshToonMaterial[] = [], floors: Floor[] = [], inFloors: Floor[] = [];
  const addC = (x: number, z: number, w: number, d: number, list = colliders, h = 0) => list.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: h || undefined });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), eu = new THREE.Euler();
  const M = (x: number, y: number, z: number, s: number | [number, number, number], ry = 0) => { pv.set(x, y, z); q.setFromEuler(eu.set(0, ry, 0)); if (typeof s === 'number') sv.setScalar(s); else sv.set(...s); return m4.compose(pv, q, sv); };

  // Sky dome
  const skyU = { top: { value: new THREE.Color('#2f86e8') }, bottom: { value: new THREE.Color('#d4efff') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.8+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.0); }',
  }));
  sky.renderOrder = -10; scene.add(sky);

  // Clouds (big puffy anime clouds)
  const clouds = new THREE.Group(); const cm = mat('#ffffff', 0.35, false);
  for (let i = 0; i < 18; i++) {
    const cg = new THREE.Group(); const a = rnd() * Math.PI * 2, r = 180 + rnd() * 200; cg.position.set(Math.cos(a) * r, 80 + rnd() * 70, 90 + Math.sin(a) * r);
    const n = 5 + Math.floor(rnd() * 5); for (let k = 0; k < n; k++) part('sphere', cm, [8 + rnd() * 10, 6 + rnd() * 8, 8 + rnd() * 8], [(k - n / 2) * 9 + rnd() * 4, rnd() * 6, rnd() * 8], [0, 0, 0], cg, true);
    cg.lookAt(0, cg.position.y, 90); clouds.add(cg);
  }
  scene.add(clouds);

  // Distant mountains (layered blue -> green), snow caps
  const mtnG = jitter(new THREE.ConeGeometry(1, 1, 9, 4), 0.12);
  const horizon = new THREE.Group(); scene.add(horizon);
  const farM = instanced(horizon, mtnG, '#7f9fcf', 40, 1.015, false, false); const snow = instanced(horizon, new THREE.ConeGeometry(1, 1, 9, 1), '#ffffff', 40, 0, false, false);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + rnd() * 0.2, r = 330 + rnd() * 60; const h = 110 + rnd() * 90, w = 60 + rnd() * 40; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    farM.add(M(x, h / 2 - 5, z, [w, h, w], rnd() * 6), ['#7f9fcf', '#8aa8d6', '#7393c4'][i % 3]); snow.add(M(x, h - 5 - h * 0.12, z, [w * 0.25, h * 0.25, w * 0.25])); }
  farM.done(); snow.done();
  const nearM = instanced(horizon, mtnG, '#5f9a6a', 40, 1.02, false, false);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + rnd() * 0.3, r = 260 + rnd() * 40; const h = 50 + rnd() * 50, w = 45 + rnd() * 30; nearM.add(M(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r, [w, h, w], rnd() * 6), ['#5f9a6a', '#6aa874', '#548f62'][i % 3]); }
  nearM.done();

  // Ground
  const ground = (x: number, z: number, w: number, d: number, c: string, y = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(c)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); return m; };
  const bigGround = ground(0, 90, 3000, 3000, '#72bd55', -0.7); bigGround.material = terrainMat('#648d43', 220);
  const vg = ground(0, -3, 84, 74, '#82c95e', 0.06); vg.material = terrainMat('#709c4e', 18);
  MAP_SHAPES.paths.forEach(([x, z, w, d]) => { const p = ground(x, z, w, d, '#b99a69', 0.1); p.material = terrainMat('#b99a69', 14); });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 32), mat('#ddd2bd')); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.12, 0); plaza.receiveShadow = true; scene.add(plaza);
  const grove = new THREE.Mesh(new THREE.CircleGeometry(14, 24), mat('#4f9a48')); grove.rotation.x = -Math.PI / 2; grove.position.set(-22, 0.08, 130); scene.add(grove);
  ground(0, 205, 50, 40, '#a8a596', 0.09);
  // fountain in plaza
  const fountain = new THREE.Group(); fountain.position.set(0, 0, 0);
  part('cyl', mat('#c8c0b0'), [3, 0.7, 3], [0, 0.35, 0], [0, 0, 0], fountain); part('cyl', toon('#5fd0ff', { emissive: '#2a8ac0', emissiveIntensity: 0.25 }), [2.7, 0.1, 2.7], [0, 0.66, 0], [0, 0, 0], fountain, true);
  part('cyl', mat('#c8c0b0'), [0.4, 2, 0.4], [0, 1.2, 0], [0, 0, 0], fountain); part('sphere', mat('#c8c0b0'), [1, 0.35, 1], [0, 2.2, 0], [0, 0, 0], fountain); part('sphere', toon('#bff0ff', { transparent: true, opacity: 0.7 }), [0.5, 0.8, 0.5], [0, 2.7, 0], [0, 0, 0], fountain, true);
  addOutline(fountain); scene.add(fountain); addC(0, 0, 6, 6);
  // pond with stones
  const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 28), toon('#4fc3f7', { emissive: '#1a7ab0', emissiveIntensity: 0.2 })); pond.rotation.x = -Math.PI / 2; pond.position.set(-29, 0.12, -27); scene.add(pond); addC(-29, -27, 8, 8);

  // River + sandy banks + bridge
  const riverBank = ground(0, 95, 240, 10, '#ecdcaa', 0.11); riverBank.material = terrainMat('#c6ad7c', 28);
  const river = ground(0, 95, 240, 6.5, '#4fc3f7', 0.14); river.material = toon('#4fc3f7', { emissive: '#1a7ab0', emissiveIntensity: 0.25 });
  for (let i = 0; i < 40; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(2 + rnd() * 3, 0.15), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); f.rotation.x = -Math.PI / 2; f.position.set(-110 + rnd() * 220, 0.17, 95 + (rnd() - 0.5) * 5); scene.add(f); }
  addC(-21, 95, 36, 6); addC(21, 95, 36, 6);
  const bridge = new THREE.Group(); bridge.position.set(0, 0, 95);
  part('box', mat('#a0683a'), [6, 0.35, 9], [0, 0.3, 0], [0, 0, 0], bridge);
  for (let i = -4; i <= 4; i += 2) [-1, 1].forEach(s => part('box', mat('#7a4a2a'), [0.2, 1.1, 0.2], [s * 2.9, 0.9, i], [0, 0, 0], bridge));
  [-1, 1].forEach(s => part('box', mat('#8a5a32'), [0.18, 0.18, 9], [s * 2.9, 1.4, 0], [0, 0, 0], bridge));
  addOutline(bridge); scene.add(bridge);

  // Detailed cottages
  let homeDoor: THREE.Object3D = new THREE.Group();
  const house: HouseFn = (x, z, w, d, wall, roof, chimney = true, big = false, parent = scene, clist = colliders, lm = lampMats, ry = 0, stairs = false, fl = floors) => {
    const lampMats = lm;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; const H = big ? 3.8 : 3.2, slope = big ? 2.8 : 2.3, base = 0.6;
    part('box', mat('#a39c90'), [w + 0.3, base, d + 0.3], [0, base / 2, 0], [0, 0, 0], g);
    part('box', mat(wall), [w, H, d], [0, base + H / 2, 0], [0, 0, 0], g);
    const beam = mat('#6b4a32');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => part('box', beam, [0.24, H, 0.24], [sx * w / 2, base + H / 2, sz * d / 2], [0, 0, 0], g));
    part('box', beam, [w + 0.1, 0.18, 0.1], [0, base + H * 0.52, d / 2 + 0.04], [0, 0, 0], g);
    part('box', beam, [w + 0.1, 0.22, d + 0.1], [0, base + H, 0], [0, 0, 0], g);
    const half = w / 2 + 0.7, len = Math.hypot(half, slope), ang = Math.atan2(slope, half);
    [-1, 1].forEach(s => part('box', mat(roof), [len + 0.1, 0.25, d + 1.3], [s * half / 2, base + H + slope / 2 + 0.1, 0], [0, 0, -s * ang], g));
    part('box', mat(new THREE.Color(roof).multiplyScalar(0.7).getStyle()), [0.35, 0.3, d + 1.4], [0, base + H + slope + 0.15, 0], [0, 0, 0], g);
    const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, slope); tri.lineTo(-w / 2, 0);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d - 0.05, bevelEnabled: false }), mat(wall)); gable.position.set(0, base + H, -d / 2 + 0.02); g.add(gable);
    const glassMat = toon('#bfe3f5', { emissive: '#ffcc66', emissiveIntensity: 0 }); lampMats.push(glassMat);
    const win = (px: number, py: number, pz: number, ry: number) => {
      const wg = new THREE.Group(); wg.position.set(px, py, pz); wg.rotation.y = ry; g.add(wg);
      part('box', mat('#fbf6ec'), [1.05, 1.15, 0.12], [0, 0, 0], [0, 0, 0], wg); part('box', glassMat, [0.82, 0.92, 0.12], [0, 0, 0.03], [0, 0, 0], wg, true);
      part('box', mat('#fbf6ec'), [0.08, 0.92, 0.16], [0, 0, 0.04], [0, 0, 0], wg, true); part('box', mat('#fbf6ec'), [0.82, 0.08, 0.16], [0, 0, 0.04], [0, 0, 0], wg, true);
      part('box', mat('#7a4a2a'), [1.2, 0.25, 0.32], [0, -0.68, 0.14], [0, 0, 0], wg);
      ['#ff6a8a', '#ffd23b', '#ffffff', '#ff8ad0'].forEach((fc, i) => part('sphere', mat(fc), [0.1, 0.1, 0.1], [-0.42 + i * 0.28, -0.5, 0.2], [0, 0, 0], wg, true));
      [-1, 1].forEach(s => part('box', mat(roof), [0.3, 1.15, 0.06], [s * 0.7, 0, 0.02], [0, 0, 0], wg));
    };
    [-1, 1].forEach(sx => win(sx * w * 0.3, base + 1.8, d / 2 + 0.06, 0));
    [-1, 1].forEach(sx => win(sx * (w / 2 + 0.06), base + 1.8, 0, sx * Math.PI / 2));
    part('cyl', mat('#fbf6ec'), [0.42, 0.1, 0.42], [0, base + H + slope * 0.4, d / 2 + 0.02], [Math.PI / 2, 0, 0], g); part('cyl', glassMat, [0.32, 0.12, 0.32], [0, base + H + slope * 0.4, d / 2 + 0.04], [Math.PI / 2, 0, 0], g, true);
    // door (opens on a hinge)
    part('box', mat('#fbf6ec'), [1.45, 2.4, 0.14], [0, base + 1.15, d / 2 + 0.04], [0, 0, 0], g);
    part('box', mat('#22140c'), [1.15, 2.15, 0.05], [0, base + 1.07, d / 2 + 0.12], [0, 0, 0], g, true);
    const door = new THREE.Group(); door.position.set(-0.56, base, d / 2 + 0.17); g.add(door);
    part('box', mat('#9a5a2e'), [1.12, 2.12, 0.1], [0.56, 1.06, 0], [0, 0, 0], door);
    part('box', mat('#7a4220'), [0.9, 0.06, 0.12], [0.56, 0.7, 0.01], [0, 0, 0], door, true); part('box', mat('#7a4220'), [0.9, 0.06, 0.12], [0.56, 1.5, 0.01], [0, 0, 0], door, true);
    part('sphere', mat('#ffd23b', 0.3), [0.06, 0.06, 0.06], [0.95, 1.05, 0.08], [0, 0, 0], door, true);
    part('box', mat('#a39c90'), [1.9, 0.3, 0.9], [0, 0.15, d / 2 + 0.6], [0, 0, 0], g);
    // porch lamp
    const lampMat = toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.1 }); lampMats.push(lampMat);
    part('box', mat('#333'), [0.2, 0.3, 0.2], [0.95, base + 2.25, d / 2 + 0.25], [0, 0, 0], g); part('sphere', lampMat, [0.12, 0.14, 0.12], [0.95, base + 2.2, d / 2 + 0.25], [0, 0, 0], g, true);
    if (chimney) { part('box', mat('#b0603e'), [0.65, 2, 0.65], [w * 0.27, base + H + slope * 0.6, -d * 0.15], [0, 0, 0], g); part('box', mat('#5a3a2a'), [0.85, 0.18, 0.85], [w * 0.27, base + H + slope * 0.6 + 1.05, -d * 0.15], [0, 0, 0], g); }
    // bushes
    [-1, 1].forEach(sx => part('ico', mat('#4caf50'), [0.7, 0.55, 0.6], [sx * (w / 2 + 0.2), 0.45, d / 2 + 0.5], [0, 0, 0], g));
    if (stairs) { // outside staircase you can really climb, up to a balcony
      const top = base + H * 0.95 + 0.1, sx = w / 2 + 1.0, zb = d / 2 + 0.9, zt = -d / 2 + 2.0, len = zb - zt, zc = (zb + zt) / 2;
      const st = mat('#8a6a50'); const n = Math.round(len / 0.4);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const y = top * (1 - t); part('box', st, [1.1, Math.max(0.2, y), len / n + 0.02], [sx, y / 2, zt + t * len], [0, 0, 0], g); }
      part('box', st, [1.6, 0.25, 2.2], [sx, top - 0.12, -d / 2 + 0.9], [0, 0, 0], g);
      [-0.75, 0.75].forEach(o => part('box', mat('#6b4a32'), [0.08, 0.9, 2.2], [sx + o, top + 0.45, -d / 2 + 0.9], [0, 0, 0], g));
      part('box', mat('#6b4a32'), [0.08, 0.08, Math.hypot(len, top)], [sx + 0.6, top / 2 + 0.9, zc], [Math.atan2(top, len), 0, 0], g);
      part('box', mat('#9a5a2e'), [0.1, 1.9, 0.9], [w / 2 + 0.06, top + 0.95, -d / 2 + 0.9], [0, 0, 0], g);
      const cs = Math.cos(ry), sn = Math.sin(ry); const W = (lx: number, lz: number) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
      const [rx, rz] = W(sx, zc), [bx, bz] = W(sx, -d / 2 + 0.9);
      fl.push({ k: 'box', cx: rx, cz: rz, ry, hw: 0.6, hd: len / 2, y0: top, y1: 0 }, { k: 'box', cx: bx, cz: bz, ry, hw: 0.8, hd: 1.1, y0: top, y1: top });
    }
    addOutline(g, 0.04); parent.add(g); const odd = Math.abs(Math.round(ry / (Math.PI / 2))) % 2 === 1; addC(x, z, odd ? d + 0.6 : w + 0.6, odd ? w + 0.6 : d + 0.6, clist, big ? 8 : 7);
    return door;
  };
  makeHouse = house;
  homeDoor = house(-18, -14, 7, 6, '#fff3dc', '#e0574a');
  house(18, -14, 8, 6, '#e8f0ff', '#3d7be0');
  house(0, -27, 10, 7, '#f6ead0', '#5aa04a', true, true);
  house(-23, 12, 6, 6, '#ffe6ec', '#a05ab0'); house(23, 12, 6, 6, '#eaffea', '#e0a030', false);
  // shop sign
  const sign = new THREE.Group(); sign.position.set(21.5, 0, -9.5); part('cyl', mat('#6b4a32'), [0.08, 2, 0.08], [0, 1, 0], [0, 0, 0], sign); part('box', mat('#3d7be0'), [1.3, 0.8, 0.12], [0, 2, 0], [0, 0, 0], sign); part('sphere', mat('#ffd23b'), [0.22, 0.22, 0.1], [0, 2, 0.08], [0, 0, 0], sign); addOutline(sign); scene.add(sign);

  // Lamp posts
  [[-6, -4], [6, -4], [-6, 18], [6, 18], [-4, 30], [4, 30]].forEach(([x, z]) => { const lg = new THREE.Group(); lg.position.set(x, 0, z); part('cyl', mat('#3a3a48'), [0.1, 3.2, 0.1], [0, 1.6, 0], [0, 0, 0], lg); part('box', mat('#3a3a48'), [0.5, 0.1, 0.5], [0, 3.25, 0], [0, 0, 0], lg);
    const lm = toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.1 }); lampMats.push(lm); part('sphere', lm, [0.26, 0.32, 0.26], [0, 3.0, 0], [0, 0, 0], lg, true); addOutline(lg); scene.add(lg); addC(x, z, 0.4, 0.4); });
  const villageLight = new THREE.PointLight('#ffb05a', 0, 40); villageLight.position.set(0, 5, 2); scene.add(villageLight);

  // Fences (posts + rails) with gate
  const posts = instanced(scene, new THREE.BoxGeometry(0.22, 1.1, 0.22), '#9a6a3a', 300, 1.12);
  const rails = instanced(scene, new THREE.BoxGeometry(2, 0.14, 0.1), '#b07a44', 400, 0);
  const fenceSeg = (x: number, z: number, rot: number) => { posts.add(M(x, 0.55, z, 1)); rails.add(M(x + (rot ? 0 : 1), 0.75, z + (rot ? 1 : 0), 1, rot)); rails.add(M(x + (rot ? 0 : 1), 0.4, z + (rot ? 1 : 0), 1, rot)); addC(x + (rot ? 0 : 1), z + (rot ? 1 : 0), rot ? 0.4 : 2.2, rot ? 2.2 : 0.4); };
  for (let x = -40; x < 40; x += 2) { if (x < -5 || x > 3) { fenceSeg(x, 31, 0); fenceSeg(x, -38, 0); } }
  for (let z = -38; z < 31; z += 2) { if (z < -14 || z > -8) { fenceSeg(-40, z, Math.PI / 2); fenceSeg(40, z, Math.PI / 2); } }
  posts.done(); rails.done();

  // The only gateway to the Fourth Dimension, still sealed until ten diamonds
  // have been mined. The outer arch can be seen from Embervale's east gate.
  const portal = new THREE.Group(); portal.position.set(PORTAL_POS.x, 0, PORTAL_POS.z);
  part('cyl', mat('#78778b'), [3.5, 0.28, 3.5], [0, 0.14, 0], [0, 0, 0], portal);
  part('cyl', mat('#9995a5'), [2.8, 0.12, 2.8], [0, 0.36, 0], [0, 0, 0], portal);
  const frame = mat('#858095'), cap = mat('#b5adc1');
  [-1, 1].forEach(side => {
    part('box', frame, [0.72, 5.1, 0.82], [0, 2.76, side * 1.9], [0, 0, side * 0.08], portal);
    part('ico', cap, [0.52, 0.46, 0.52], [0, 5.23, side * 1.95], [0, 0, 0], portal);
    addC(PORTAL_POS.x, PORTAL_POS.z + side * 1.9, 0.85, 0.95);
  });
  part('box', frame, [0.85, 0.65, 4.8], [0, 5.15, 0], [0, 0, 0], portal);
  const portalCore = new THREE.Group(); portalCore.position.y = 2.9; portal.add(portalCore);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 8, 32), new THREE.MeshBasicMaterial({ color: '#bcb5ff', transparent: true, opacity: 0.82 })); halo.rotation.y = Math.PI / 2; portalCore.add(halo);
  const veil = new THREE.Mesh(new THREE.CircleGeometry(1.68, 32), new THREE.MeshBasicMaterial({ color: '#816bb1', transparent: true, opacity: 0.64, side: THREE.DoubleSide, depthWrite: false })); veil.rotation.y = Math.PI / 2; portalCore.add(veil);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; part('ico', mat(i % 2 ? '#bfacf0' : '#a8dce8', 0.35), [0.13, 0.18, 0.13], [0, Math.sin(a) * 2.25, Math.cos(a) * 2.25], [0, 0, a], portalCore, true); }
  const portalSeal = new THREE.Group(); portalSeal.position.y = 2.9; portal.add(portalSeal);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.73, 32), new THREE.MeshBasicMaterial({ color: '#252438', side: THREE.DoubleSide, opacity: 0.87, transparent: true })); seal.rotation.y = Math.PI / 2; portalSeal.add(seal);
  for (let i = 0; i < 3; i++) { const crack = new THREE.Mesh(new THREE.TorusGeometry(0.48 + i * 0.38, 0.025, 4, 18, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: '#735b8e', side: THREE.DoubleSide })); crack.rotation.y = Math.PI / 2; crack.rotation.x = i * 0.9; portalSeal.add(crack); }
  addOutline(portal, 0.035); scene.add(portal);
  addC(PORTAL_POS.x, PORTAL_POS.z, 0.44, 3.1);

  // Trees: round anime trees + pines (instanced with outlines)
  const trunk = instanced(scene, new THREE.CylinderGeometry(0.2, 0.34, 2.4, 7), '#7a5232', 700, 1.1);
  const blob = instanced(scene, new THREE.IcosahedronGeometry(1.5, 1), '#4caf50', 2400, 1.06);
  const pine = instanced(scene, new THREE.ConeGeometry(1.7, 2.4, 8), '#2f7d4a', 1200, 1.06);
  const greens = ['#4caf50', '#5cbf4a', '#43a047', '#6cc45a', '#3e9a45'], pines = ['#2f7d4a', '#2a6e44', '#357f50'];
  const tree = (x: number, z: number, s: number, kind: 'round' | 'pine') => {
    if (Math.hypot(x - PORTAL_POS.x, z - PORTAL_POS.z) < 11) return;
    trunk.add(M(x, 1.2 * s, z, s));
    if (kind === 'round') { const c = greens[Math.floor(rnd() * greens.length)];
      blob.add(M(x, 3.1 * s, z, s), c); blob.add(M(x + 0.9 * s, 2.7 * s, z + 0.3 * s, 0.72 * s), c); blob.add(M(x - 0.8 * s, 2.8 * s, z - 0.4 * s, 0.78 * s), c); blob.add(M(x + 0.1 * s, 3.9 * s, z - 0.1 * s, 0.68 * s), greens[(greens.indexOf(c) + 3) % 5]); }
    else { const c = pines[Math.floor(rnd() * pines.length)]; for (let k = 0; k < 3; k++) pine.add(M(x, (2.3 + k * 1.3) * s, z, [s * (1 - k * 0.25), s, s * (1 - k * 0.25)]), c); }
    colliders.push({ x0: x - 0.4 * s, x1: x + 0.4 * s, z0: z - 0.4 * s, z1: z + 0.4 * s, h: 5.5 * s, e: 1.3 * s });
  };
  for (let z = 34; z < 228; z += 3.4) { tree(-36 - rnd() * 7, z, 0.9 + rnd() * 0.6, rnd() < 0.4 ? 'pine' : 'round'); tree(36 + rnd() * 7, z, 0.9 + rnd() * 0.6, rnd() < 0.4 ? 'pine' : 'round'); }
  for (let i = 0; i < 80; i++) tree(-70 + rnd() * 140, -42 - rnd() * 25, 1 + rnd() * 0.6, rnd() < 0.5 ? 'pine' : 'round');
  for (let i = 0; i < 50; i++) tree((rnd() < 0.5 ? -1 : 1) * (44 + rnd() * 25), -40 + rnd() * 80, 1 + rnd() * 0.6, rnd() < 0.4 ? 'pine' : 'round');
  for (let i = 0; i < 24; i++) { const a = rnd() * 6.28, r = 7 + rnd() * 6; tree(-22 + Math.cos(a) * r, 130 + Math.sin(a) * r, 1.1 + rnd() * 0.5, 'pine'); }
  for (let i = 0; i < 30; i++) { const x = -30 + rnd() * 60, z = 40 + rnd() * 138; if (Math.abs(x) < 6 || Math.abs(z - 95) < 7 || (Math.abs(x + 22) < 9 && Math.abs(z - 130) < 9)) continue; tree(x, z, 0.8 + rnd() * 0.5, rnd() < 0.3 ? 'pine' : 'round'); }
  [[-34, -2], [-34, 22], [34, -2], [34, 22], [-12, 24], [12, -32], [-30, -12], [30, -30]].forEach(([x, z]) => tree(x, z, 1.1, 'round'));
  trunk.done(); blob.done(); pine.done();

  // Rocky cliffs with grassy tops along the valley
  const cliffG = jitter(new THREE.CylinderGeometry(1, 1.25, 1, 8, 3), 0.15);
  const cliff = instanced(scene, cliffG, '#b3a796', 80, 1.03); const cliffTop = instanced(scene, jitter(new THREE.CylinderGeometry(1.08, 1.05, 1, 8, 1), 0.1), '#5aae4a', 80, 1.03);
  const addCliff = (x: number, z: number, r: number, h: number) => { cliff.add(M(x, h / 2, z, [r, h, r], rnd() * 6), ['#b3a796', '#a89c8a', '#c0b4a2'][Math.floor(rnd() * 3)]); cliffTop.add(M(x, h + 0.3, z, [r, 0.8, r], rnd() * 6)); };
  for (let z = 40; z < 240; z += 14) { addCliff(-58 - rnd() * 12, z, 5 + rnd() * 5, 10 + rnd() * 16); addCliff(58 + rnd() * 12, z + 7, 5 + rnd() * 5, 10 + rnd() * 16); }
  for (let x = -80; x <= 80; x += 16) addCliff(x + rnd() * 6, -75 - rnd() * 10, 7 + rnd() * 5, 12 + rnd() * 14);
  [[-60, -20], [-62, 10], [62, -20], [64, 15]].forEach(([x, z]) => addCliff(x, z, 7, 14 + rnd() * 6));
  cliff.done(); cliffTop.done();

  // Rocks & boulders
  const rocks = instanced(scene, jitter(new THREE.IcosahedronGeometry(0.7, 1), 0.3), '#a9a59c', 200, 1.08);
  for (let i = 0; i < 120; i++) { const x = -32 + rnd() * 64, z = 36 + rnd() * 185; if (Math.abs(x) < 4) continue; rocks.add(M(x, 0.25, z, [0.6 + rnd(), 0.5 + rnd() * 0.6, 0.6 + rnd()], rnd() * 6), ['#a9a59c', '#9a968e', '#b8b4aa'][i % 3]); }
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; rocks.add(M(-29 + Math.cos(a) * 5.3, 0.2, -27 + Math.sin(a) * 5.3, 0.6 + rnd() * 0.4, rnd() * 6)); }
  for (let i = 0; i < 30; i++) rocks.add(M(-100 + rnd() * 200, 0.15, 95 + (rnd() < 0.5 ? -1 : 1) * (3.6 + rnd()), 0.5 + rnd() * 0.5, rnd() * 6), '#c8c2b4');
  [[-26, 60, 2.4], [24, 78, 2.8], [-18, 150, 2.2], [27, 170, 3], [-30, 112, 2.6]].forEach(([x, z, s]) => { rocks.add(M(x, s * 0.4, z, s, rnd() * 6)); addC(x, z, s * 1.3, s * 1.3); });
  rocks.done();

  // Grass tufts & flowers
  const blades = instanced(scene, new THREE.ConeGeometry(0.1, 0.8, 4), '#5aa83a', 5000, 0, false);
  const grassC = ['#5aa83a', '#6cbf44', '#4e9a34', '#7acb50'];
  for (let p = 0; p < 16; p++) { const cx = -25 + rnd() * 50, cz = 45 + rnd() * 132; if (Math.abs(cz - 95) < 7) continue; for (let i = 0; i < 230; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 6.5; blades.add(M(cx + Math.cos(a) * r, 0.4, cz + Math.sin(a) * r, [1, 0.8 + rnd() * 0.8, 1], rnd() * 3), grassC[i % 4]); } }
  for (let i = 0; i < 1200; i++) { const x = -38 + rnd() * 76, z = -36 + rnd() * 66; if (Math.hypot(x, z) < 10 || Math.abs(x) < 4) continue; blades.add(M(x, 0.25, z, [0.8, 0.5 + rnd() * 0.4, 0.8], rnd() * 3), grassC[i % 4]); }
  blades.done();
  const flowers = instanced(scene, new THREE.SphereGeometry(0.13, 6, 5), '#ff8ad0', 1400, 0, false);
  const fc = ['#ff8ad0', '#ffffff', '#ffe066', '#b48aff', '#ff6a6a'];
  for (let i = 0; i < 1400; i++) { const x = -38 + rnd() * 76, z = -36 + rnd() * 250; if (Math.abs(x) < 4 || Math.abs(z - 95) < 6 || Math.hypot(x, z) < 10) continue; flowers.add(M(x, 0.18, z, 1), fc[i % 5]); }
  flowers.done();

  // Ruins
  const ruins = new THREE.Group();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const h = 3 + (i % 3) * 1.6; const px = Math.cos(a) * 15, pz = 205 + Math.sin(a) * 15;
    part('cyl', mat('#c4bca8'), [0.75, h, 0.75], [px, h / 2, pz], [0, 0, (i % 4 === 0) ? 0.08 : 0], ruins); part('box', mat('#b0a894'), [1.8, 0.4, 1.8], [px, h + 0.2, pz], [0, a, 0], ruins); part('ico', mat('#5aa84a'), [0.6, 0.3, 0.6], [px, h + 0.5, pz], [0, 0, 0], ruins); addC(px, pz, 1.5, 1.5); }
  part('cyl', mat('#9a9080'), [3.2, 0.6, 3.6], [0, 0.3, 214], [0, 0, 0], ruins);
  part('torus', mat('#9a2bff', 1.1), [2, 2, 2], [0, 4, 218], [0, 0, 0], ruins);
  addOutline(ruins); scene.add(ruins);
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 8, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#b46aff', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })); barrier.position.set(0, 4, 205); scene.add(barrier);

  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), toon('#9ad0ff', { emissive: '#5ab0ff', emissiveIntensity: 0.8 })); stone.position.set(32, 0.8, 120); scene.add(stone);

  // Berry bushes
  const berries: THREE.Group[] = [];
  [[-20, 50], [22, 60], [-28, 85], [25, 110], [-15, 140], [28, 150], [-30, 165], [12, 125]].forEach(([x, z]) => {
    const g = new THREE.Group(); [[0, 0.7, 0, 0.9], [0.6, 0.5, 0.3, 0.6], [-0.6, 0.5, -0.2, 0.65]].forEach(([bx, by, bz, s]) => part('ico', mat('#3f9a3a'), [s, s * 0.85, s], [bx, by, bz], [0, 0, 0], g));
    addOutline(g, 0.03);
    for (let k = 0; k < 7; k++) { const be = part('sphere', mat('#ff9a2b', 0.25), [0.14, 0.14, 0.14], [Math.cos(k * 1.3) * 0.75, 0.6 + (k % 3) * 0.25, Math.sin(k * 1.3) * 0.75], [0, 0, 0], g, true); be.name = 'berry'; }
    g.position.set(x, 0, z); scene.add(g); berries.push(g);
  });

  // ---------- Home interior (cutaway room, front wall open for the camera) ----------
  const room = new THREE.Group(); room.position.set(IX, IY, 0);
  part('box', mat('#d29a62'), [14, 0.2, 12], [0, -0.1, 0], [0, 0, 0], room, true);
  for (let i = -6; i <= 6; i++) part('box', mat('#b07a48'), [0.04, 0.02, 12], [i, 0.005, 0], [0, 0, 0], room, true);
  const wallM = mat('#f6e6c8');
  part('box', wallM, [14, 5, 0.3], [0, 2.5, -6], [0, 0, 0], room); part('box', wallM, [0.3, 5, 12], [-7, 2.5, 0], [0, 0, 0], room); part('box', wallM, [0.3, 5, 12], [7, 2.5, 0], [0, 0, 0], room);
  part('box', mat('#a8744a'), [14, 1.2, 0.36], [0, 0.6, -5.98], [0, 0, 0], room); part('box', mat('#a8744a'), [0.36, 1.2, 12], [-6.98, 0.6, 0], [0, 0, 0], room); part('box', mat('#a8744a'), [0.36, 1.2, 12], [6.98, 0.6, 0], [0, 0, 0], room);
  // window with sky
  part('box', mat('#fbf6ec'), [2.6, 2, 0.2], [2.5, 2.9, -5.8], [0, 0, 0], room); part('box', new THREE.MeshBasicMaterial({ color: '#9fdcff' }), [2.2, 1.6, 0.2], [2.5, 2.9, -5.74], [0, 0, 0], room, true);
  part('box', mat('#fbf6ec'), [0.1, 1.6, 0.25], [2.5, 2.9, -5.7], [0, 0, 0], room, true);
  [-1, 1].forEach(s => part('box', mat('#ff9ab0'), [0.5, 2.4, 0.12], [2.5 + s * 1.5, 2.8, -5.65], [0, 0, 0], room));
  // bed
  part('box', mat('#8a5530'), [2.4, 0.5, 3.4], [-5, 0.25, -3.9], [0, 0, 0], room); part('box', mat('#ffffff'), [2.2, 0.3, 3.2], [-5, 0.65, -3.9], [0, 0, 0], room);
  part('box', mat('#5b8fd6'), [2.3, 0.32, 2.1], [-5, 0.72, -3.2], [0, 0, 0], room); part('box', mat('#ffffff'), [1.4, 0.28, 0.6], [-5, 0.9, -5.1], [0, 0, 0], room); part('box', mat('#8a5530'), [2.4, 1.4, 0.2], [-5, 0.7, -5.6], [0, 0, 0], room);
  addC(IX - 5, -3.9, 2.6, 3.6, inColliders, 1.4);
  // table + stools + teapot
  part('cyl', mat('#a0683a'), [1, 0.1, 1], [1, 0.8, -1], [0, 0, 0], room); part('cyl', mat('#7a4a2a'), [0.12, 0.8, 0.12], [1, 0.4, -1], [0, 0, 0], room);
  [-1, 1].forEach(s => { part('cyl', mat('#c0503a'), [0.35, 0.08, 0.35], [1 + s * 1.5, 0.5, -1], [0, 0, 0], room); part('cyl', mat('#7a4a2a'), [0.06, 0.5, 0.06], [1 + s * 1.5, 0.25, -1], [0, 0, 0], room); });
  part('sphere', mat('#ffffff'), [0.22, 0.18, 0.22], [1, 1.02, -1], [0, 0, 0], room); addC(IX + 1, -1, 2, 2, inColliders);
  // bookshelf
  part('box', mat('#8a5530'), [2.2, 3.2, 0.7], [5.6, 1.6, -5.4], [0, 0, 0], room);
  for (let r = 0; r < 3; r++) for (let b = 0; b < 7; b++) part('box', mat(['#e0574a', '#3d7be0', '#5aa04a', '#ffd23b', '#a05ab0'][(b + r) % 5]), [0.2, 0.7, 0.4], [4.8 + b * 0.26, 0.75 + r * 0.95, -5.15], [0, 0, (b % 3 === 0) ? 0.1 : 0], room, true);
  addC(IX + 5.6, -5.4, 2.4, 1, inColliders);
  // fireplace
  part('box', mat('#9a8f86'), [2.8, 2.8, 0.9], [-1.5, 1.4, -5.5], [0, 0, 0], room); part('box', mat('#2a1a12'), [1.6, 1.3, 0.3], [-1.5, 0.75, -5.05], [0, 0, 0], room, true);
  part('box', mat('#7a4a2a'), [3.1, 0.2, 1], [-1.5, 2.85, -5.4], [0, 0, 0], room);
  [0, 1, 2].forEach(k => part('cone', mat(['#ff7a1b', '#ffb02b', '#ffe066'][k], 1.5), [0.3 - k * 0.07, 0.7 - k * 0.12, 0.3 - k * 0.07], [-1.5 + (k - 1) * 0.25, 0.5, -4.95], [0, 0, 0], room, true));
  const fire = new THREE.PointLight('#ff9a3a', 18, 12); fire.position.set(IX - 1.5, IY + 1, -4.4); scene.add(fire); addC(IX - 1.5, -5.4, 3, 1.2, inColliders);
  // rug, chest, plants, exit mat
  part('cyl', mat('#c0504a'), [2.6, 0.03, 2.6], [0, 0.02, 1], [0, 0, 0], room, true); part('cyl', mat('#f0c060'), [1.8, 0.035, 1.8], [0, 0.025, 1], [0, 0, 0], room, true);
  part('box', mat('#9a5a2e'), [1.4, 0.8, 0.9], [5.2, 0.4, -1.5], [0, 0, 0], room); part('box', mat('#7a4220'), [1.5, 0.25, 1], [5.2, 0.9, -1.5], [0, 0, 0], room); part('box', mat('#ffd23b'), [0.2, 0.3, 0.05], [5.2, 0.7, -1.02], [0, 0, 0], room, true);
  addC(IX + 5.2, -1.5, 1.6, 1.1, inColliders);
  [[-6.2, 4.8], [6.2, 4.8], [-6.2, -1]].forEach(([x, z]) => { part('cyl', mat('#c0603a'), [0.35, 0.6, 0.35], [x, 0.3, z], [0, 0, 0], room); part('ico', mat('#4caf50'), [0.6, 0.7, 0.6], [x, 1.1, z], [0, 0, 0], room); });
  part('box', mat('#7a5a3a'), [2, 0.04, 1], [0, 0.02, 5.4], [0, 0, 0], room, true);
  // decorations bought in the shop
  const decor: Record<string, THREE.Object3D> = {};
  const dg = (id: string) => { const g = new THREE.Group(); room.add(g); decor[id] = g; return g; };
  { const g = dg('rug'); part('box', mat('#3d7be0'), [3, 0.03, 2], [-4, 0.03, 2.5], [0, 0, 0], g, true); part('box', mat('#ffffff'), [2.4, 0.035, 0.2], [-4, 0.035, 2.5], [0, 0, 0], g, true); }
  { const g = dg('fern'); part('cyl', mat('#e0a030'), [0.45, 0.7, 0.45], [3.5, 0.35, -5], [0, 0, 0], g); for (let k = 0; k < 6; k++) part('cone', mat('#3e9a45'), [0.15, 1.2, 0.15], [3.5 + Math.cos(k) * 0.3, 1.2, -5 + Math.sin(k) * 0.3], [Math.sin(k) * 0.6, 0, Math.cos(k) * 0.6], g); }
  { const g = dg('lantern'); part('cyl', mat('#333'), [0.02, 1, 0.02], [0, 4.5, 0], [0, 0, 0], g, true); part('ico', mat('#ffe066', 1.5), [0.4, 0.4, 0.4], [0, 3.8, 0], [0, 0, 0], g); }
  { const g = dg('bed'); part('cyl', mat('#ff9ab0'), [0.9, 0.25, 0.9], [-2.5, 0.12, 3.5], [0, 0, 0], g); part('cyl', mat('#ffffff'), [0.7, 0.27, 0.7], [-2.5, 0.15, 3.5], [0, 0, 0], g); }
  { const g = dg('shelf'); part('box', mat('#8a5530'), [3, 0.15, 0.4], [-4.5, 2.6, -5.7], [0, 0, 0], g); for (let k = 0; k < 6; k++) part('box', mat(['#ffd23b', '#b48aff', '#5ad0ff'][k % 3]), [0.35, 0.5, 0.04], [-5.7 + k * 0.48, 2.95, -5.65], [0, 0, 0], g); }
  // Loft over the bed + staircase on the left wall
  const wd = mat('#a0683a'), wd2 = mat('#7a4a2a');
  part('box', wd, [4.2, 0.25, 4], [-4.9, 2.9, -4], [0, 0, 0], room); [[-2.9, -2.1], [-2.9, -5.9]].forEach(([px, pz]) => part('cyl', wd2, [0.12, 2.9, 0.12], [px, 1.45, pz], [0, 0, 0], room));
  for (let i = 0; i < 6; i++) part('cyl', wd2, [0.04, 0.8, 0.04], [-2.9, 3.4, -2.1 - i * 0.75], [0, 0, 0], room); part('box', wd2, [0.1, 0.1, 4], [-2.9, 3.8, -4], [0, 0, 0], room);
  for (let i = 0; i < 8; i++) part('box', wd, [1.1, 0.18, 0.62], [-6.35, 0.3 + i * 0.36, 2.9 - i * 0.62], [0, 0, 0], room);
  part('box', wd2, [0.1, 0.1, 5.4], [-5.75, 2.2, 0.8], [0.52, 0, 0], room);
  inFloors.push({ k: 'box', cx: IX - 6.35, cz: 0.6, ry: 0, hw: 0.6, hd: 2.6, y0: 3.03, y1: 0 }, { k: 'box', cx: IX - 4.9, cz: -4, ry: 0, hw: 2.15, hd: 2.05, y0: 3.03, y1: 3.03 });
  inColliders.push({ x0: IX - 3.0, x1: IX - 2.7, z0: -6, z1: -2.2, y0: 2.4, h: 6 } as Box, { x0: IX - 5.6, x1: IX - 2.7, z0: -2.15, z1: -1.95, y0: 2.4, h: 6 } as Box);
  inColliders.push({ x0: IX - 5.75, x1: IX - 5.55, z0: -2, z1: 3.3, h: 6 } as Box);
  part('box', mat('#ffffff'), [1.6, 0.3, 2], [-5.4, 3.15, -4.4], [0, 0, 0], room); part('box', mat('#ffd23b'), [1.4, 0.25, 0.6], [-5.4, 3.3, -5.2], [0, 0, 0], room);
  // roof beams + slanted rafters (open so the camera can see inside)
  for (let i = -2; i <= 2; i++) part('box', wd2, [14, 0.25, 0.3], [0, 5.1, i * 2.6], [0, 0, 0], room);
  [-1, 1].forEach(sd => { for (let i = -2; i <= 2; i++) part('box', wd2, [0.25, 0.25, 7.6], [sd * 3.6, 6.4, i * 2.6], [0, Math.PI / 2, sd * 0.55], room); });
  part('box', wd2, [0.3, 0.3, 12], [0, 7.6, 0], [0, 0, 0], room);
  // Kitchen: counter, stove, pot, shelf
  part('box', mat('#e8dcc8'), [1.3, 1.1, 3.2], [6.2, 0.55, 2.4], [0, 0, 0], room); part('box', mat('#8a5530'), [1.4, 0.12, 3.3], [6.2, 1.15, 2.4], [0, 0, 0], room);
  part('box', mat('#3a3a44'), [1.1, 0.1, 1.1], [6.2, 1.25, 1.6], [0, 0, 0], room); part('cyl', mat('#5a5a66'), [0.32, 0.35, 0.32], [6.2, 1.5, 1.6], [0, 0, 0], room);
  part('cyl', mat('#ff7a1b', 1.2), [0.25, 0.03, 0.25], [6.2, 1.31, 1.6], [0, 0, 0], room, true);
  part('box', mat('#8a5530'), [0.4, 0.08, 2.2], [6.7, 2.6, 2.6], [0, 0, 0], room); ['#e0574a', '#ffd23b', '#5aa04a', '#3d7be0'].forEach((cc, i) => part('cyl', mat(cc), [0.12, 0.3, 0.12], [6.7, 2.82, 1.8 + i * 0.5], [0, 0, 0], room));
  addC(IX + 6.2, 2.4, 1.4, 3.3, inColliders);
  addOutline(room, 0.03); scene.add(room);
  const roomLight = new THREE.PointLight('#ffe2b0', 25, 22); roomLight.position.set(IX, IY + 4.2, 0); scene.add(roomLight);

  return { ground: bigGround, horizon, floors, inFloors, colliders, inColliders, lampMats, homeDoor, berries, stone, barrier, sky, skyU, clouds, decor, fire, roomLight, villageLight, portal, portalSeal, portalCore };
}
