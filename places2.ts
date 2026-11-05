import * as THREE from 'three';
import { mat, toon, part, addOutline, buildHuman, groundTex } from './models';
import { Ctx, PBox, flat, sign, stairs, tree } from './places';
import { sfx } from './audio';

const C = (c: Ctx, x: number, z: number, w: number, d: number, h = 0, e = 0.3, y0?: number) => c.cl.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: h || undefined, e, y0 } as PBox);
function ringWall(c: Ctx, x: number, z: number, R: number, n: number, size: number, h: number, gap: number, y0?: number, gapAt = Math.PI / 2) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < gap) continue; C(c, x + Math.cos(a) * R, z + Math.sin(a) * R, size, size, h, 0.3, y0); }
}

// Simple enterable room: 4 walls, door on +z side, roof that hides when you are inside
export function room(c: Ctx, x: number, z: number, w: number, d: number, H: number, wall: string, roof: string, floor: string) {
  const g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g); const wm = mat(wall), T = 0.3, door = 1.7;
  flat(g, w, d, toon('#ffffff', { map: groundTex(floor, 4) }), 0, 0.04, 0, true);
  part('box', wm, [w, H, T], [0, H / 2, -d / 2], [0, 0, 0], g); C(c, x, z - d / 2, w + 0.2, T + 0.2, H);
  [-1, 1].forEach(s => { part('box', wm, [T, H, d], [s * w / 2, H / 2, 0], [0, 0, 0], g); C(c, x + s * w / 2, z, T + 0.2, d + 0.2, H);
    const seg = (w - door) / 2; part('box', wm, [seg, H, T], [s * (door / 2 + seg / 2), H / 2, d / 2], [0, 0, 0], g); C(c, x + s * (door / 2 + seg / 2), z + d / 2, seg + 0.1, T + 0.2, H);
    part('box', toon('#bfe3f5', { emissive: '#ffcc66', emissiveIntensity: 0.05 }), [0.06, 1, 1.4], [s * (w / 2 + 0.01), 2, 0], [0, 0, 0], g, true); });
  part('box', wm, [door, H - 2.5, T], [0, 2.5 + (H - 2.5) / 2, d / 2], [0, 0, 0], g);
  part('box', mat('#5a3a2a'), [door + 0.3, 0.2, T + 0.1], [0, 2.5, d / 2], [0, 0, 0], g);
  const rf = new THREE.Group(); rf.position.y = H; g.add(rf); const half = w / 2 + 0.6, sl = 2, len = Math.hypot(half, sl), ang = Math.atan2(sl, half);
  [-1, 1].forEach(s => part('box', mat(roof), [len + 0.1, 0.22, d + 1], [s * half / 2, sl / 2, 0], [0, 0, -s * ang], rf));
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, sl); tri.lineTo(-w / 2, 0);
  const gab = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d - 0.1, bevelEnabled: false }), wm); gab.position.z = -d / 2 + 0.05; gab.userData.ownGeo = true; rf.add(gab);
  c.anims.push((_t, p) => { rf.visible = !(Math.abs(p.x - x) < w / 2 + 0.3 && Math.abs(p.z - z) < d / 2 + 0.3); });
  g.userData.roof = rf;
  c.shapes.push({ k: 'r', x, z, w, d, col: roof });
  return g;
}

// Guide and playground share the same interaction positions.
export const SCHOOL_SPOTS = {
  entrance: [0, 0.9],
  seesaw: [2.75, 7.15],
  swing: [-4, 7.55],
} as const;

// ---------- School with classroom + playable equipment ----------
export function schoolB(c: Ctx, x: number, z: number) {
  const bz = z - 4; const g = room(c, x, bz, 12, 8, 3.6, '#fff2b0', '#d04a3a', '#c8945a');
  part('box', mat('#2a5a3a'), [5.2, 2, 0.08], [0, 2, -3.8], [0, 0, 0], g); part('box', mat('#8a5530'), [5.4, 0.12, 0.2], [0, 0.95, -3.75], [0, 0, 0], g);
  sign(g, 'A B C   1 + 2 = 3', 0, 2.1, -3.74, 0, '#2a5a3a', '#ffffff', 4.8, 1.6);
  part('box', mat('#8a5530'), [1.8, 0.9, 0.8], [0, 0.45, -2.6], [0, 0, 0], g); part('sphere', mat('#e8302a'), [0.12, 0.12, 0.12], [0.5, 1.0, -2.6], [0, 0, 0], g);
  const lines = ['Shh! We are studying!', 'I love learning about pets!', '2 + 2 = 4! I know it!', 'Our teacher is so nice.', 'Fire beats nature pets!'];
  let k = 0;
  [-0.8, 1.4].forEach((rz, ri) => [-3, 0, 3].forEach(cx => {
    part('box', mat('#c8945a'), [1.2, 0.08, 0.6], [cx, 0.62, rz], [0, 0, 0], g); [-0.5, 0.5].forEach(o => part('box', mat('#6a4a2a'), [0.06, 0.6, 0.5], [cx + o, 0.3, rz], [0, 0, 0], g));
    part('box', mat('#3d7be0'), [0.5, 0.06, 0.45], [cx, 0.3, rz + 0.55], [0, 0, 0], g); part('box', mat('#3d7be0'), [0.5, 0.45, 0.06], [cx, 0.52, rz + 0.78], [0, 0, 0], g);
    part('box', mat('#ffffff'), [0.35, 0.02, 0.25], [cx - 0.2, 0.67, rz], [0, 0, 0], g, true);
    if (ri === 1 && cx === 3) { c.spots.push({ x: x + cx, z: bz + rz + 0.55, r: 1.0, kind: 'study', label: 'Sit and study', ry: Math.PI }); return; }
    c.npcs.push({ id: `chat@${c.key}#s${k}`, name: 'Student', x: x + cx, z: bz + rz + 0.55, look: c.look(220 + k), scale: 0.68, role: 'student', ry: Math.PI, lines: [lines[k % lines.length]] }); k++;
  }));
  c.npcs.push({ id: `chat@${c.key}#t`, name: 'Teacher', x, z: bz - 2.0, look: { ...c.look(210), acc: 'glasses' }, role: 'teacher', ry: 0, lines: ['Welcome to our school!', 'Sit at the empty desk to join the class!'] });
  sign(g, 'SCHOOL', 0, 3.25, 4.17, 0, '#2a6a3a', '#ffffff', 2.6, 0.6);
  // yard + seesaw
  const yd = new THREE.Group(); yd.position.set(x, 0, z); c.gr.add(yd);
  flat(yd, 16, 9, mat('#e6c88e'), 0, 0.025, 5);
  const piv = new THREE.Group(); piv.position.set(4, 0.55, 6); yd.add(piv);
  part('cone', mat('#d04a3a'), [0.35, 0.55, 0.35], [4, 0.27, 6], [0, Math.PI / 4, 0], yd);
  part('box', mat('#ff9a2b'), [3, 0.1, 0.35], [0, 0, 0], [0, 0, 0], piv);
  [-1, 1].forEach(s => { part('box', mat('#3d7be0'), [0.4, 0.06, 0.4], [s * 1.25, 0.06, 0], [0, 0, 0], piv); part('cyl', mat('#c8ccd0'), [0.03, 0.4, 0.03], [s * 1.0, 0.25, 0], [0, 0, 0], piv); part('cyl', mat('#c8ccd0'), [0.03, 0.4, 0.03], [s * 1.0, 0.45, 0], [Math.PI / 2, 0, 0], piv); });
  C(c, x + 4, z + 6, 0.6, 0.6);
  c.spots.push({ x: x + SCHOOL_SPOTS.seesaw[0], z: z + SCHOOL_SPOTS.seesaw[1], r: 1.75, kind: 'seesaw', label: 'Ride the seesaw', obj: piv });
  // A separate swing next to the seesaw. The seat itself is the animation
  // anchor, so boarding and the ride use the same 3D location.
  const sx = -4, sz = 6.45;
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    part('cyl', mat('#b44e4b'), [0.075, 2.95, 0.075], [sx + side * 1.25, 1.47, sz + end * 0.58], [end * 0.18, 0, side * 0.13], yd);
  }
  part('cyl', mat('#b44e4b'), [0.075, 2.75, 0.075], [sx, 2.9, sz], [0, 0, Math.PI / 2], yd);
  const swing = new THREE.Group(); swing.position.set(sx, 2.85, sz); yd.add(swing);
  [-0.28, 0.28].forEach(side => part('cyl', mat('#b6bbc4'), [0.018, 1.94, 0.018], [side, -0.97, 0], [0, 0, 0], swing));
  const seat = part('box', mat('#ffd35a'), [0.75, 0.09, 0.4], [0, -1.94, 0], [0, 0, 0], swing);
  C(c, x + sx - 1.25, z + sz, 0.2, 0.3); C(c, x + sx + 1.25, z + sz, 0.2, 0.3);
  c.spots.push({ x: x + SCHOOL_SPOTS.swing[0], z: z + SCHOOL_SPOTS.swing[1], r: 1.7, kind: 'swing', label: 'Ride the swing', obj: seat });
  c.anims.push(t => { swing.rotation.x = Math.sin(t * 1.65) * 0.38; });
  part('cyl', mat('#c8ccd0'), [0.05, 5, 0.05], [-6, 2.5, 3], [0, 0, 0], yd); part('box', mat('#3d7be0'), [1.2, 0.7, 0.03], [-5.4, 4.5, 3], [0, 0, 0], yd);
  addOutline(g, 0.03); addOutline(yd, 0.03);
  for (let i = 0; i < 2; i++) c.npcs.push({ id: `chat@${c.key}#k${i}`, name: 'Little Kid', x: x - 3 + i * 3, z: z + 4, look: c.look(240 + i), scale: 0.68, role: 'kid', lines: [['Play seesaw with me!', 'Recess is the best!'][i]] });
  c.zones.push({ x, z: bz + 3, r: 13, kind: 'school', name: 'Village School' });
}

// ---------- Horror house ----------
function faceTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d')!;
  x.fillStyle = '#d8dcd8'; x.beginPath(); x.ellipse(128, 132, 78, 104, 0, 0, 7); x.fill();
  x.fillStyle = '#0a0606'; [[95, 110], [161, 110]].forEach(([ex, ey]) => { x.beginPath(); x.ellipse(ex, ey, 20, 28, 0, 0, 7); x.fill(); });
  x.fillStyle = '#ff1a1a'; [[95, 114], [161, 114]].forEach(([ex, ey]) => { x.beginPath(); x.arc(ex, ey, 4, 0, 7); x.fill(); });
  x.fillStyle = '#0a0606'; x.beginPath(); x.ellipse(128, 190, 26, 42, 0, 0, 7); x.fill();
  x.strokeStyle = '#3a2a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(60, 60); x.lineTo(110, 150); x.lineTo(90, 230); x.stroke();
  x.strokeStyle = '#8a1010'; x.lineWidth = 4; [[100, 136], [156, 136]].forEach(([ex, ey]) => { x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + 3, ey + 40); x.stroke(); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function hauntedB(c: Ctx, x: number, z: number) {
  const g0 = new THREE.Group(); g0.position.set(x, 0, z); c.gr.add(g0);
  flat(g0, 44, 44, toon('#ffffff', { map: groundTex('#3a3036', 8) }), 0, 0.02, 0, true);
  const hx = x, hz = z - 7; const g = room(c, hx, hz, 10, 8, 3.4, '#3a3238', '#1e161e', '#2a1e1a');
  // Uneven slate tiles and a crooked chimney. The roof disappears only while inside.
  const rf = g.userData.roof as THREE.Group;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
    const rx = -4.5 + col, rz = -3.65 + row * 1.8, ht = 2 * (1 - Math.abs(rx) / 5.6) + 0.27;
    part('box', mat((row + col) % 3 === 0 ? '#372a36' : '#29202c'), [0.98, 0.08, 1.9], [rx, ht, rz], [0, 0, rx < 0 ? 0.34 : -0.34], rf);
  }
  part('box', mat('#241a24'), [0.9, 2.3, 0.8], [-2.9, 2.1, -2], [0, 0, 0.12], rf);
  part('box', mat('#4a3030'), [1.05, 0.18, 0.96], [-3, 3.25, -2], [0, 0, 0.1], rf);
  for (const side of [-1, 1]) {
    part('box', mat('#3a3036'), [1.35, 1.2, 0.42], [side * 2.1, 1.1, 3.5], [0, 0, side * 0.18], rf);
    part('box', toon('#899099', { emissive: '#301820', emissiveIntensity: 0.1 }), [0.72, 0.78, 0.08], [side * 2.1, 1.2, 3.76], [0, 0, 0], rf, true);
  }
  // The entrance is a real hinged door. It opens when someone approaches and
  // its collision closes again when they leave.
  const hinge = new THREE.Group(); hinge.position.set(-0.82, 0, 4.22); g.add(hinge);
  part('box', mat('#4b2e29'), [1.55, 2.28, 0.15], [0.775, 1.14, 0], [0, 0, 0], hinge);
  [0.5, 1.05, 1.65].forEach(yy => part('box', mat('#291c20'), [1.37, 0.1, 0.19], [0.775, yy, 0], [0, 0, 0], hinge));
  part('box', mat('#9a7760'), [0.1, 0.18, 0.05], [1.31, 1.13, 0.12], [0, 0, 0], hinge, true);
  part('sphere', mat('#b58c58'), [0.08, 0.08, 0.05], [1.32, 1.12, 0.15], [0, 0, 0], hinge);
  part('box', mat('#1e171a'), [1.8, 0.16, 0.36], [0, 2.42, 4.16], [0, 0, 0], g);
  const gate: PBox = { x0: hx - 0.82, x1: hx + 0.82, z0: hz + 4.03, z1: hz + 4.36, h: 2.35 };
  c.cl.push(gate);
  c.anims.push((_t, p) => {
    const atDoor = Math.hypot(p.x - hx, p.z - (hz + 4.5)) < 3.4 || (Math.abs(p.x - hx) < 4 && Math.abs(p.z - hz) < 4);
    hinge.rotation.y += ((atDoor ? -1.85 : 0) - hinge.rotation.y) * 0.13;
    gate.y0 = atDoor ? 10 : undefined;
  });
  // front boards + glowing windows
  for (let i = 0; i < 4; i++) part('box', mat('#2a2018'), [1.2, 0.15, 0.08], [(i % 2 ? 3 : -3), 1.9 + (i >> 1) * 0.3, 4.17], [0, 0, (i % 2 ? 0.4 : -0.4)], g);
  // mirror with a horror face
  part('box', mat('#4a3a1a'), [1.4, 2, 0.12], [2.2, 1.7, -3.8], [0, 0, 0], g);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.75), new THREE.MeshBasicMaterial({ color: '#8a9aa0' })); glass.position.set(2.2, 1.7, -3.73); glass.userData.ownGeo = glass.userData.ownMat = true; glass.userData.noOutline = true; g.add(glass);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, opacity: 0, depthWrite: false })); face.position.set(2.2, 1.7, -3.71); face.userData.ownGeo = face.userData.ownMat = true; face.userData.noOutline = true; g.add(face);
  // GET OUT on the wall + drips
  sign(g, 'GET OUT', -4.83, 2.1, -0.5, Math.PI / 2, '#3a3238', '#c01a1a', 2.6, 0.8);
  for (let i = 0; i < 6; i++) part('cone', mat('#7a0a0a'), [0.03, 0.25 + (i % 3) * 0.12, 0.03], [-4.8, 1.55, -1.5 + i * 0.4], [Math.PI, 0, 0], g, true);
  // rocking chair
  const chair = new THREE.Group(); chair.position.set(-2.5, 0, -2); g.add(chair);
  part('box', mat('#4a3020'), [0.7, 0.08, 0.6], [0, 0.5, 0], [0, 0, 0], chair); part('box', mat('#4a3020'), [0.7, 0.9, 0.08], [0, 0.95, -0.3], [-0.15, 0, 0], chair);
  [-0.32, 0.32].forEach(o => { const rk = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 4, 12, Math.PI * 0.6), mat('#3a2418')); rk.rotation.set(0, Math.PI / 2, Math.PI * 1.2); rk.position.set(o, 0.62, 0); rk.userData.ownGeo = true; chair.add(rk); part('cyl', mat('#4a3020'), [0.03, 0.5, 0.03], [o, 0.25, 0.2], [0, 0, 0], chair); part('cyl', mat('#4a3020'), [0.03, 0.5, 0.03], [o, 0.25, -0.2], [0, 0, 0], chair); });
  // flickering bulb
  const bulbM = toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.4 }); part('cyl', mat('#222'), [0.01, 1, 0.01], [0, 2.9, 0], [0, 0, 0], g); part('sphere', bulbM, [0.12, 0.15, 0.12], [0, 2.35, 0], [0, 0, 0], g, true);
  // cobwebs
  [[-4.7, 3.2, -3.7], [4.7, 3.2, -3.7], [-4.7, 3.2, 3.7]].forEach(([wx, wy, wz]) => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.9, 3), new THREE.MeshBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.35, side: THREE.DoubleSide })); w.position.set(wx, wy, wz); w.rotation.set(0, wz > 0 ? Math.PI / 2 : 0, Math.PI / 4); w.userData.ownGeo = w.userData.ownMat = true; w.userData.noOutline = true; g.add(w); });
  // creepy doll on a table, head follows you
  part('box', mat('#3a2a20'), [1, 0.08, 0.7], [3.4, 0.8, 1], [0, 0, 0.06], g); [-0.4, 0.4].forEach(o => part('box', mat('#3a2a20'), [0.06, 0.8, 0.06], [3.4 + o, 0.4, 1], [0, 0, 0], g));
  const doll = buildHuman({ skin: '#f0e8e8', hair: 'long', hairColor: '#1a1a1a', top: '#8a1a2a', bottom: '#8a1a2a', shoes: '#111', acc: 'none', pack: 'none', eye: '#ff1a1a', body: 'female' }, 0.32); doll.position.set(3.4, 0.84, 1); doll.rotation.y = -Math.PI / 2; g.add(doll);
  // portrait with glowing eyes
  part('box', mat('#4a3a1a'), [0.08, 1.2, 0.9], [4.82, 2, 1.5], [0, 0, 0], g); part('box', mat('#2a2a34'), [0.06, 1, 0.7], [4.78, 2, 1.5], [0, 0, 0], g, true);
  const eyeM = toon('#ff2a2a', { emissive: '#ff0000', emissiveIntensity: 1 }); [-0.12, 0.12].forEach(o => part('sphere', eyeM, [0.03, 0.03, 0.03], [4.74, 2.15, 1.5 + o], [0, 0, 0], g, true));
  // broken furniture
  part('box', mat('#3a2a20'), [1.4, 0.08, 0.8], [-1, 0.35, 2], [0.4, 0.3, 0.6], g); part('box', mat('#3a2a20'), [0.5, 0.5, 0.5], [1.2, 0.25, 2.6], [0.3, 0.8, 1.2], g);
  // ghost that drifts through the room
  const ghost = new THREE.Group(); g.add(ghost); const gm = new THREE.MeshBasicMaterial({ color: '#f0f4ff', transparent: true, opacity: 0.0, depthWrite: false });
  part('sphere', gm, [0.4, 0.45, 0.4], [0, 1.6, 0], [0, 0, 0], ghost, true); part('cone', gm, [0.42, 0.9, 0.42], [0, 1.0, 0], [Math.PI, 0, 0], ghost, true);
  [-0.13, 0.13].forEach(o => part('sphere', new THREE.MeshBasicMaterial({ color: '#000000' }), [0.07, 0.1, 0.03], [o, 1.65, 0.36], [0, 0, 0], ghost, true));
  addOutline(g, 0.03);
  // outside: graves, pumpkins, wisps, dead trees
  for (let i = 0; i < 10; i++) { const a = i * 0.7 + 0.3, r = 9 + (i % 3) * 3; const gx = Math.cos(a) * r, gz = Math.sin(a) * r + 4; part('box', mat('#6a666e'), [0.7, 0.9, 0.2], [gx, 0.45, gz], [0, a, (i % 3 - 1) * 0.15], g0); part('cyl', mat('#6a666e'), [0.35, 0.2, 0.35], [gx, 0.9, gz], [Math.PI / 2, a, 0], g0); }
  for (let i = 0; i < 3; i++) { part('sphere', mat('#d06a1a'), [0.4, 0.32, 0.4], [-6 + i * 6, 0.3, 6], [0, 0, 0], g0); part('box', toon('#ffd23b', { emissive: '#ffaa00', emissiveIntensity: 0.8 }), [0.3, 0.1, 0.05], [-6 + i * 6, 0.35, 6.38], [0, 0, 0], g0, true); }
  sign(g0, 'KEEP OUT', 0, 1.6, 14, Math.PI, '#3a2a20', '#ff4a3a', 2, 0.6); part('cyl', mat('#3a2a20'), [0.06, 1.6, 0.06], [0, 0.8, 14.05], [0, 0, 0.1], g0);
  const wisps: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) wisps.push(part('sphere', new THREE.MeshBasicMaterial({ color: '#bfffd0', transparent: true, opacity: 0.6 }), [0.18, 0.18, 0.18], [0, 1.5, 0], [0, 0, 0], g0, true));
  addOutline(g0, 0.03);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; tree(c, 'dead', x + Math.cos(a) * 16, z + Math.sin(a) * 16, 1 + (i % 2) * 0.3); }
  let screamed = false, ghostT = 0;
  const mw = new THREE.Vector3(hx + 2.2, 0, hz - 3.7);
  c.anims.push((t, p) => {
    wisps.forEach((w, i) => w.position.set(Math.cos(t * 0.5 + i * 1.6) * (7 + i), 1.2 + Math.sin(t * 1.5 + i) * 0.5, Math.sin(t * 0.4 + i * 1.6) * (7 + i) + 5));
    const inside = Math.abs(p.x - hx) < 5 && Math.abs(p.z - hz) < 4; if (!inside && Math.hypot(p.x - hx, p.z - hz) > 12) return;
    bulbM.emissiveIntensity = Math.random() < 0.12 ? 0 : 0.3 + Math.random() * 0.5;
    chair.rotation.x = Math.sin(t * 2.2) * 0.18;
    const dh = doll.userData.head as THREE.Object3D; const wa = Math.atan2(p.x - (hx + 3.4), p.z - (hz + 1)) - doll.rotation.y; dh.rotation.y = Math.max(-1.3, Math.min(1.3, Math.atan2(Math.sin(wa), Math.cos(wa))));
    const md = Math.hypot(p.x - mw.x, p.z - mw.z); const fm = face.material as THREE.MeshBasicMaterial;
    fm.opacity += ((md < 2.4 ? 1 : 0) - fm.opacity) * 0.12; (glass.material as THREE.MeshBasicMaterial).color.set(md < 2.4 ? '#5a3a3a' : '#8a9aa0');
    if (md < 2.4 && !screamed) { screamed = true; sfx('faint'); sfx('thunder'); } if (md > 5) screamed = false;
    if (inside) { ghostT += 0.016; const k = (ghostT % 9) / 9; ghost.position.set(-5 + k * 10, Math.sin(k * 20) * 0.2, -1 + Math.sin(k * 6) * 1.5); gm.opacity = k < 0.6 ? Math.sin((k / 0.6) * Math.PI) * 0.55 : 0; } else gm.opacity = 0;
  });
  c.zones.push({ x, z, r: 22, kind: 'haunt', name: 'Haunted House' }); c.shapes.push({ k: 'c', x, z, r: 22, col: '#3a3036' });
}

// ---------- Castle tower: walk inside, climb the spiral stairs, enjoy the view ----------
export function castle(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g);
  const R = 3.2, H = 14.4, wallM = toon('#b8b0a0', { side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 28, 1, true, 0.3, Math.PI * 2 - 0.6), wallM); w1.position.y = H / 2; w1.userData.ownGeo = w1.userData.ownMat = true; w1.castShadow = true; g.add(w1);
  const w2 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - 2.8, 6, 1, true, -0.3, 0.6), wallM); w2.position.y = 2.8 + (H - 2.8) / 2; w2.userData.ownGeo = true; g.add(w2);
  part('box', mat('#5a3a2a'), [2.1, 0.25, 0.4], [0, 2.8, R], [0, 0, 0], g); [-1, 1].forEach(s => part('box', mat('#5a3a2a'), [0.25, 2.8, 0.4], [s * 0.95, 1.4, R], [0, 0, 0], g));
  flat(g, R * 2, R * 2, mat('#8a8070'), 0, 0.04, 0);
  part('cyl', mat('#a8a090'), [R + 0.35, 0.45, R + 0.35], [0, H - 0.22, 0], [0, 0, 0], g);
  const a0 = Math.PI / 2 + 0.5, turn = Math.PI * 2 - 0.9, aEnd = a0 + turn;
  for (let i = 0; i < 16; i++) { const b = (i / 16) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(b - aEnd), Math.cos(b - aEnd))) < 0.5) continue; part('box', mat('#b0a898'), [0.7, 0.8, 0.5], [Math.cos(b) * (R + 0.15), H + 0.4, Math.sin(b) * (R + 0.15)], [0, -b + Math.PI / 2, 0], g); }
  part('cyl', mat('#5a4a3a'), [0.06, 3, 0.06], [0, H + 1.5, 0], [0, 0, 0], g); part('box', mat('#d04a3a'), [1.2, 0.7, 0.04], [0.6, H + 2.5, 0], [0, 0, 0], g);
  // spiral staircase around the outside
  const N = 44, rm = 4.5;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, a = a0 + t * turn, h = H * t;
    part('box', mat(i % 2 ? '#a89c8a' : '#988c7a'), [1.9, 0.35, 0.72], [Math.cos(a) * rm, h - 0.17, Math.sin(a) * rm], [0, -a, 0], g);
    if (i % 4 === 0) part('cyl', mat('#8a8070'), [0.18, h, 0.18], [Math.cos(a) * (rm + 0.6), h / 2, Math.sin(a) * (rm + 0.6)], [0, 0, 0], g);
    part('cyl', mat('#6b4a32'), [0.04, 0.9, 0.04], [Math.cos(a) * 5.4, h + 0.45, Math.sin(a) * 5.4], [0, 0, 0], g, true);
    C(c, x + Math.cos(a) * 5.75, z + Math.sin(a) * 5.75, 0.55, 0.55, h + 3, 0.2, h - 0.6);
  }
  c.floors.push({ k: 'spiral', cx: x, cz: z, r0: 3.6, r1: 5.5, a0, turn, h: H }, { k: 'disc', cx: x, cz: z, r: R + 0.3, y: H });
  ringWall(c, x, z, R, 22, 0.9, H - 0.4, 0.32);
  ringWall(c, x, z, R + 0.45, 24, 0.5, H + 4, 0.5, H - 0.6, aEnd);
  // inside: banners, torches, a chest
  for (let i = 0; i < 4; i++) { const b = Math.PI + i * 0.8 - 1.2; part('box', mat(i % 2 ? '#d04a3a' : '#3d7be0'), [0.06, 1.6, 0.7], [Math.cos(b) * (R - 0.1), 3, Math.sin(b) * (R - 0.1)], [0, -b, 0], g); part('cone', toon('#ffb02b', { emissive: '#ff8a1b', emissiveIntensity: 0.6 }), [0.12, 0.3, 0.12], [Math.cos(b + 0.4) * (R - 0.2), 2.2, Math.sin(b + 0.4) * (R - 0.2)], [0, 0, 0], g, true); }
  part('box', mat('#9a5a2e'), [1, 0.6, 0.6], [0, 0.3, -2.2], [0, 0, 0], g); part('box', mat('#ffd23b'), [1.05, 0.1, 0.65], [0, 0.5, -2.2], [0, 0, 0], g);
  addOutline(g, 0.04);
  c.spots.push({ x, z, r: 2.6, kind: 'view', label: 'Enjoy the view', y: H });
  c.zones.push({ x, z, r: 9, kind: 'landmark', name: 'Old Castle Tower' }); c.shapes.push({ k: 'c', x, z, r: 4.5, col: '#b8b0a0' });
}

// ---------- Desert stupa: climb the terrace stairs and walk inside the dome ----------
export function stupa(c: Ctx, x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); c.gr.add(g); const T = 2, S = 14, sand = '#d8c090';
  part('box', mat(sand), [S, T, S], [0, T / 2, 0], [0, 0, 0], g); part('box', mat('#c8a870'), [S + 0.3, 0.25, S + 0.3], [0, T, 0], [0, 0, 0], g);
  C(c, x, z, S, S, T);
  c.floors.push({ k: 'box', cx: x, cz: z, ry: 0, hw: S / 2, hd: S / 2, y0: T, y1: T });
  for (let k = 0; k < 4; k++) { const ry = (k * Math.PI) / 2, sx = Math.sin(ry) * 9, sz = Math.cos(ry) * 9; stairs(g, sx, sz, ry, 2.6, 4, T, '#cdb888'); c.floors.push({ k: 'box', cx: x + sx, cz: z + sz, ry, hw: 1.3, hd: 2, y0: T, y1: 0 }); }
  const R = 4.6, white = toon('#f4f0e6', { side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, Math.PI / 2 + 0.32, Math.PI * 2 - 0.64, 0, Math.PI / 2), white); dome.position.y = T; dome.userData.ownGeo = dome.userData.ownMat = true; dome.castShadow = true; g.add(dome);
  const fill = new THREE.Mesh(new THREE.SphereGeometry(R, 6, 8, Math.PI / 2 - 0.32, 0.64, 0, 0.97), white); fill.position.y = T; fill.userData.ownGeo = true; g.add(fill);
  part('torus', mat('#e0b040'), [R, R, 0.6], [0, T + 0.15, 0], [Math.PI / 2, 0, 0], g); part('box', mat('#8a5a2a'), [1.8, 0.2, 0.4], [0, T + 2.6, R - 0.6], [0, 0, 0], g);
  part('box', mat('#f4f0e6'), [1.6, 1, 1.6], [0, T + R + 0.4, 0], [0, 0, 0], g); part('box', mat('#e0b040'), [1.8, 0.15, 1.8], [0, T + R + 0.95, 0], [0, 0, 0], g);
  for (let i = 0; i < 7; i++) part('cyl', mat('#e0b040'), [0.6 - i * 0.07, 0.25, 0.6 - i * 0.07], [0, T + R + 1.2 + i * 0.32, 0], [0, 0, 0], g);
  part('cone', mat('#ffd23b'), [0.2, 0.7, 0.2], [0, T + R + 3.7, 0], [0, 0, 0], g);
  ringWall(c, x, z, R - 0.2, 26, 0.8, T + R + 1, 0.34, T - 0.5);
  // inside: soft glowing relic, little lamps, painted floor
  const ins = new THREE.Mesh(new THREE.CircleGeometry(R - 0.3, 32), mat('#c86a3a')); ins.rotation.x = -Math.PI / 2; ins.position.y = T + 0.02; ins.userData.ownGeo = true; g.add(ins);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 32), mat('#ffd23b')); ring.rotation.x = -Math.PI / 2; ring.position.y = T + 0.03; ring.userData.ownGeo = true; g.add(ring);
  part('cyl', mat('#f4f0e6'), [0.5, 0.8, 0.5], [0, T + 0.4, -2.6], [0, 0, 0], g); part('ico', toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.5 }), [0.3, 0.3, 0.3], [0, T + 1.1, -2.6], [0, 0, 0], g);
  for (let i = 0; i < 8; i++) { const b = Math.PI + (i - 3.5) * 0.35; part('cone', toon('#ffb02b', { emissive: '#ff8a1b', emissiveIntensity: 0.5 }), [0.06, 0.14, 0.06], [Math.cos(b) * 3.5, T + 0.12, Math.sin(b) * 3.5], [0, 0, 0], g, true); }
  // prayer flags
  const fc = ['#3d7be0', '#ffffff', '#d04a3a', '#5aa04a', '#ffd23b'];
  [[-S / 2, -S / 2], [S / 2, -S / 2], [-S / 2, S / 2], [S / 2, S / 2]].forEach(([cx2, cz2]) => { for (let i = 1; i < 10; i++) { const t = i / 10; part('box', mat(fc[i % 5]), [0.3, 0.35, 0.02], [cx2 * t, T + R + 2.4 - (R + 0.6) * t - Math.sin(t * Math.PI) * 0.6, cz2 * t], [0, Math.atan2(cx2, cz2), 0], g, true); } });
  addOutline(g, 0.04);
  c.spots.push({ x, z: z - 1, r: 1.3, kind: 'sit', label: 'Meditate', ry: Math.PI, y: T });
  c.zones.push({ x, z, r: 14, kind: 'landmark', name: 'Desert Stupa' }); c.shapes.push({ k: 'r', x, z, w: S, d: S, col: '#d8c090' });
}

// Both frozen igloos and sun-baked desert domes have a real doorway and a
// furnished interior. The shell hides after you step inside.
export function domeShelter(c: Ctx, x: number, z: number, climate: 'ice' | 'sand') {
  const R = 3.65, icy = climate === 'ice', g = new THREE.Group();
  g.position.set(x, 0, z); c.gr.add(g);
  const wall = mat(icy ? '#e3f3fc' : '#dcbb86');
  const shell = new THREE.Group(); g.add(shell);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 12, Math.PI / 2 + 0.38, Math.PI * 2 - 0.76, 0, Math.PI / 2), toon(icy ? '#e9f7ff' : '#e6ca96', { side: THREE.DoubleSide }));
  dome.castShadow = true; dome.userData.ownGeo = dome.userData.ownMat = true; shell.add(dome);
  for (let row = 0; row < 5; row++) {
    const th = 0.18 + row * 0.23, rr = Math.cos(th) * R, h = Math.sin(th) * R;
    for (let k = 0; k < 22; k++) {
      const a = ((k + (row % 2) * 0.5) / 22) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) continue;
      const block = part('box', mat(icy ? (k % 3 ? '#f3fbff' : '#c8e7f8') : (k % 3 ? '#d8b783' : '#edcf9f')), [0.91, 0.11, 0.24], [Math.cos(a) * rr, h, Math.sin(a) * rr], [0, -a, -th], shell);
      block.castShadow = false;
    }
  }
  // A cutout at +z and two low side walls create a passable entrance tunnel.
  [-1, 1].forEach(side => {
    part('box', wall, [0.33, 1.5, 1.5], [side * 0.99, 0.75, R - 0.15], [0, 0, 0], g);
    C(c, x + side * 0.99, z + R - 0.15, 0.34, 1.5, 1.8);
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.24, 8, 16, Math.PI), wall);
  arch.position.set(0, 1.34, R + 0.48); arch.userData.ownGeo = true; g.add(arch);
  part('box', wall, [2.35, 0.25, 1.7], [0, 2.12, R - 0.1], [0, 0, 0], g);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.45) continue;
    C(c, x + Math.cos(a) * (R - 0.26), z + Math.sin(a) * (R - 0.26), 0.95, 0.95, 3.7);
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 0.18, 28), mat(icy ? '#c0dbe9' : '#c69c6a'));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.035; floor.userData.ownGeo = true; g.add(floor);
  part('box', mat(icy ? '#6e94af' : '#795135'), [1.6, 0.28, 2.1], [-1.55, 0.17, -1.15], [0, -0.3, 0], g);
  part('box', mat(icy ? '#f5fbff' : '#eddfb6'), [1.45, 0.16, 1.78], [-1.55, 0.37, -1.15], [0, -0.3, 0], g);
  part('box', mat(icy ? '#7aa0ba' : '#ad724b'), [1.2, 0.13, 0.5], [-1.55, 0.48, -1.83], [0, -0.3, 0], g);
  part('cyl', mat(icy ? '#b2cfe1' : '#b68557'), [0.42, 0.55, 0.42], [1.65, 0.28, -1.1], [0, 0, 0], g);
  part('sphere', mat('#e6b451', 0.22), [0.16, 0.16, 0.16], [1.65, 0.64, -1.1], [0, 0, 0], g, true);
  part('cyl', mat('#725840'), [0.6, 0.34, 0.6], [0.5, 0.18, -2.45], [0, 0, 0], g);
  part('cone', mat('#e58339', 0.4), [0.18, 0.36, 0.18], [0.5, 0.48, -2.45], [0, 0, 0], g, true);
  c.spots.push({ x: x - 1.1, z: z - 0.8, r: 1.3, kind: 'shelter', label: 'Rest here' });
  c.zones.push({ x, z, r: 6, kind: 'shelter', name: icy ? 'Ice Igloo' : 'Sand Dome' });
  c.shapes.push({ k: 'c', x, z, r: R, col: icy ? '#e3f3fc' : '#d8b783' });
  c.anims.push((_t, p) => { shell.visible = Math.hypot(p.x - x, p.z - z) > R - 0.5; });
  addOutline(g, 0.025);
}
