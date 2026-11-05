import * as THREE from 'three';
import type { ElemType } from './data';
import { TYPE_COLORS } from './data';

const templates = new Map<ElemType, THREE.Group>();
const core = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

// Every element has a different silhouette, instead of every move being a ball.
export function projectileVisual(type: ElemType): THREE.Group {
  if (!templates.has(type)) {
    const g = new THREE.Group(), color = TYPE_COLORS[type];
    const add = (geo: THREE.BufferGeometry, col: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, core(col, 0.95)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); g.add(mesh); return mesh;
    };
    const cone = () => new THREE.ConeGeometry(0.16, 0.85, 6);
    const shard = () => new THREE.OctahedronGeometry(0.36);
    const ring = () => new THREE.TorusGeometry(0.38, 0.07, 5, 18);
    switch (type) {
      case 'fire':
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const m = add(cone(), i % 2 ? '#ffd47a' : color, Math.cos(a) * 0.2, Math.sin(a) * 0.2, -i * 0.18, 0.7 + i * 0.1, 1 + i * 0.14, 0.8); m.rotation.x = Math.PI / 2 + i * 0.2; }
        break;
      case 'water':
        add(new THREE.SphereGeometry(0.3, 12, 8), '#64caff', 0, 0, 0, 0.9, 0.8, 1.8);
        for (let i = 0; i < 3; i++) { const m = add(ring(), '#d8f9ff', 0, 0, -0.18 + i * 0.26, 1 - i * 0.18, 1 - i * 0.18); m.rotation.y = Math.PI / 3 + i * 0.4; }
        break;
      case 'nature':
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const m = add(cone(), i % 2 ? '#b5ee76' : color, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, 0.85, 1.6, 0.85); m.rotation.x = -Math.PI / 2; }
        break;
      case 'earth':
        add(new THREE.IcosahedronGeometry(0.42, 0), '#a98052', 0, 0, 0);
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; add(shard(), i % 2 ? '#e9c99b' : color, Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.15, 0.45, 0.45, 0.45); }
        break;
      case 'wind':
        for (let i = 0; i < 3; i++) { const m = add(new THREE.TorusGeometry(0.35 + i * 0.1, 0.055, 5, 22, Math.PI * 1.45), i % 2 ? '#ffffff' : color, 0, 0, -0.15 + i * 0.2); m.rotation.set(i * 0.25, i * 0.85, i * 1.8); }
        break;
      case 'electric':
        for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.2; const shape = new THREE.Shape(); shape.moveTo(x - 0.12, 0.4); shape.lineTo(x + 0.06, 0.08); shape.lineTo(x - 0.05, 0.05); shape.lineTo(x + 0.12, -0.45); shape.lineTo(x - 0.14, -0.1); shape.lineTo(x, -0.06); shape.closePath(); add(new THREE.ShapeGeometry(shape), i % 2 ? '#ffffff' : color, 0, 0, (i - 1) * 0.16); }
        break;
      case 'ice':
        add(shard(), '#ebfbff', 0, 0, 0, 0.6, 0.6, 1.9);
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const m = add(cone(), '#9cddff', Math.cos(a) * 0.18, Math.sin(a) * 0.18, -0.18, 0.45, 0.9, 0.45); m.rotation.x = Math.PI / 2; }
        break;
      case 'shadow':
        for (let i = 0; i < 4; i++) { const m = add(new THREE.TorusGeometry(0.25 + i * 0.08, 0.065, 5, 24, Math.PI * 1.2), i % 2 ? '#50266f' : '#ba72ed', 0, 0, (i - 1.5) * 0.16); m.rotation.z = i * 1.2; }
        break;
      case 'metal':
        add(cone(), '#dce5ee', 0, 0, 0, 1.3, 2, 1.3).rotation.x = -Math.PI / 2;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(new THREE.BoxGeometry(0.15, 0.15, 0.55), '#7d8995', Math.cos(a) * 0.23, Math.sin(a) * 0.23, -0.26).rotation.z = a; }
        break;
      case 'light':
        add(new THREE.OctahedronGeometry(0.4), '#fffbd1', 0, 0, 0, 0.7, 0.7, 1.35);
        for (let i = 0; i < 4; i++) { const m = add(cone(), '#ffffff', 0, 0, -0.2, 0.38, 1.1, 0.38); m.rotation.z = i * Math.PI / 2; }
        break;
      case 'psychic':
        add(shard(), '#f7b1ee', 0, 0, 0, 0.75, 0.75, 1.3);
        for (let i = 0; i < 3; i++) add(ring(), i % 2 ? '#ffffff' : color, 0, 0, (i - 1) * 0.22, 1 + i * 0.28, 1 + i * 0.28);
        break;
      case 'aether':
        add(new THREE.DodecahedronGeometry(0.32), '#d9bdff', 0, 0, 0, 0.85, 0.85, 1.2);
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; add(shard(), i % 2 ? '#ffffff' : color, Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.1, 0.24, 0.24, 0.24); }
        break;
    }
    templates.set(type, g);
  }
  return templates.get(type)!.clone(true);
}

interface Effect {
  root: THREE.Object3D; life: number; age: number;
  mats: THREE.MeshBasicMaterial[]; geometries: THREE.BufferGeometry[];
  tick: (k: number, dt: number) => void;
}

export class CombatVfx {
  private active: Effect[] = [];
  constructor(private scene: THREE.Scene) {}

  private put(root: THREE.Object3D, life: number, mats: THREE.MeshBasicMaterial[], geometries: THREE.BufferGeometry[], tick: Effect['tick']) {
    if (this.active.length > 75) { geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); return; }
    this.scene.add(root); this.active.push({ root, life, age: 0, mats, geometries, tick });
  }
  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i]; e.age += dt; const k = Math.min(1, e.age / e.life);
      e.tick(k, dt); e.mats.forEach(m => (m.opacity = Math.max(0, 1 - k)));
      if (k >= 1) { this.scene.remove(e.root); e.mats.forEach(m => m.dispose()); e.geometries.forEach(g => g.dispose()); this.active.splice(i, 1); }
    }
  }
  clear() { for (const e of this.active) { this.scene.remove(e.root); e.mats.forEach(m => m.dispose()); e.geometries.forEach(g => g.dispose()); } this.active = []; }

  // Curved ink strokes connect the attacker to the hit instead of a flash at one point.
  slash(at: THREE.Vector3, direction: THREE.Vector3, color: string, heavy = false) {
    const g = new THREE.Group(); g.position.copy(at).addScaledVector(direction, heavy ? 1.1 : 0.8); g.position.y += 0.3;
    g.rotation.y = Math.atan2(direction.x, direction.z);
    const mats = [core(color), core('#ffffff')], geo: THREE.BufferGeometry[] = [];
    for (let i = 0; i < (heavy ? 3 : 2); i++) {
      const shape = new THREE.TorusGeometry(0.65 + i * 0.14, i === 0 ? 0.08 : 0.04, 6, 36, Math.PI * (heavy ? 1.25 : 1.05)); geo.push(shape);
      const m = new THREE.Mesh(shape, mats[i % 2]); m.rotation.z = -0.6 - i * 0.36; m.position.set((i - 1) * 0.08, (i - 1) * 0.12, 0); g.add(m);
    }
    this.put(g, heavy ? 0.36 : 0.25, mats, geo, k => { g.scale.setScalar(0.55 + k * (heavy ? 1.5 : 1)); g.rotation.z = k * (heavy ? 1.4 : 0.9); });
  }
  cast(at: THREE.Vector3, type: ElemType, strong = false) {
    const g = new THREE.Group(); g.position.copy(at); const col = TYPE_COLORS[type], mats = [core(col), core('#ffffff')];
    const geo = [new THREE.TorusGeometry(0.5, 0.055, 5, 24), new THREE.OctahedronGeometry(0.14)];
    const ring = new THREE.Mesh(geo[0], mats[0]); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < (strong ? 10 : 5); i++) {
      const a = i * Math.PI * 2 / (strong ? 10 : 5);
      const spark = new THREE.Mesh(geo[1], mats[i % 3 ? 0 : 1]); spark.position.set(Math.cos(a) * 0.7, (i % 2 ? 0.3 : -0.2), Math.sin(a) * 0.7); g.add(spark);
    }
    this.put(g, strong ? 0.7 : 0.43, mats, geo, (k, dt) => {
      ring.rotation.z += dt * (strong ? 9 : 5); g.scale.setScalar(1 + k * (strong ? 2.4 : 1.1)); g.rotation.y += dt * 4;
    });
  }
  wave(at: THREE.Vector3, type: ElemType, radius: number) {
    const g = new THREE.Group(); g.position.copy(at); g.position.y += 0.18; const color = TYPE_COLORS[type];
    const mats = [core(color, 0.85), core('#ffffff', 0.7)], geo = [new THREE.TorusGeometry(1, 0.07, 6, 44), new THREE.ConeGeometry(0.14, 0.5, 5)];
    for (let j = 0; j < 2; j++) { const r = new THREE.Mesh(geo[0], mats[j]); r.rotation.x = Math.PI / 2; r.scale.setScalar(j ? 0.8 : 1); g.add(r); }
    for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; const spike = new THREE.Mesh(geo[1], mats[i % 3 ? 0 : 1]); spike.userData.angle = a; spike.position.set(Math.cos(a), 0.25, Math.sin(a)); spike.rotation.z = (i % 2 ? -1 : 1) * 0.4; g.add(spike); }
    this.put(g, 0.65, mats, geo, k => {
      g.scale.setScalar(0.2 + k * Math.min(7, radius));
      for (const child of g.children.slice(2)) child.position.y = 0.2 + Math.sin(k * Math.PI) * 0.7;
    });
  }
  dash(at: THREE.Vector3, direction: THREE.Vector3, type: ElemType) {
    const g = new THREE.Group(); g.position.copy(at); g.position.y += 0.95; g.rotation.y = Math.atan2(direction.x, direction.z);
    const mats = [core(TYPE_COLORS[type], 0.85), core('#ffffff', 0.7)], geo = [new THREE.ConeGeometry(0.15, 2.3, 4)];
    for (let i = 0; i < 7; i++) {
      const line = new THREE.Mesh(geo[0], mats[i % 3 ? 0 : 1]); line.position.set((i - 3) * 0.16, (i % 3 - 1) * 0.26, -0.6 - i * 0.18);
      line.rotation.x = Math.PI / 2; line.scale.set(0.5 + i * 0.08, 0.8 + i * 0.13, 0.3); g.add(line);
    }
    this.put(g, 0.42, mats, geo, k => { g.scale.set(1 + k, 1 + k * 0.4, 1 + k * 1.8); g.position.addScaledVector(direction, -0.025); });
  }
  impact(at: THREE.Vector3, type: ElemType, strong = false) {
    const g = new THREE.Group(); g.position.copy(at); const mats = [core(TYPE_COLORS[type]), core('#ffffff')], geo = [new THREE.ConeGeometry(0.1, strong ? 1.3 : 0.7, 4), new THREE.RingGeometry(0.55, 0.65, 28)];
    const n = strong ? 14 : 9;
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; const spike = new THREE.Mesh(geo[0], mats[i % 3 ? 0 : 1]); spike.position.set(Math.cos(a) * 0.65, Math.sin(a) * 0.65, (i % 2) * 0.15); spike.rotation.z = a - Math.PI / 2; g.add(spike); }
    const ring = new THREE.Mesh(geo[1], mats[1]); g.add(ring);
    this.put(g, strong ? 0.4 : 0.28, mats, geo, k => { g.scale.setScalar(0.55 + k * (strong ? 2.5 : 1.5)); g.rotation.z += 0.04; });
  }
}