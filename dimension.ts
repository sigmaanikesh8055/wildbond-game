import * as THREE from 'three';
import { addOutline, mat, part, toon } from './models';

export const PORTAL_POS = { x: 57, z: -11 } as const;
export const FOURTH_Y = -420;
export type WeaponKind = 'blade' | 'staff' | 'bow';

export const WEAPONS: Record<WeaponKind, { name: string; subtitle: string; range: number; power: number; heavy: number; cooldown: number; color: string }> = {
  blade: { name: 'Dawn Edge', subtitle: 'Close and quick', range: 3.3, power: 19, heavy: 32, cooldown: 0.45, color: '#ffc866' },
  staff: { name: 'Prism Staff', subtitle: 'Mid-range energy', range: 13, power: 15, heavy: 25, cooldown: 0.7, color: '#ad96ff' },
  bow: { name: 'Horizon Bow', subtitle: 'Long-range arrows', range: 19, power: 13, heavy: 23, cooldown: 0.56, color: '#91e8df' },
};

export function buildWeapon(kind: WeaponKind) {
  const g = new THREE.Group();
  const grip = mat('#503c50');
  if (kind === 'blade') {
    part('cyl', grip, [0.045, 0.46, 0.045], [0, -0.2, 0], [0, 0, 0], g);
    part('box', mat('#e5af67'), [0.45, 0.08, 0.16], [0, -0.46, 0], [0, 0, 0], g);
    part('cone', toon('#ffe3a1', { emissive: '#b56c27', emissiveIntensity: 0.26 }), [0.18, 1.25, 0.095], [0, -1.12, 0], [0, 0, Math.PI], g);
    part('box', mat('#f7f0dc'), [0.035, 0.88, 0.12], [0, -1, 0.055], [0, 0, 0], g, true);
  } else if (kind === 'staff') {
    part('cyl', grip, [0.055, 2.1, 0.055], [0, -0.65, 0], [0, 0, 0], g);
    [-1.5, 0.2].forEach(y => part('cyl', mat('#d7b983'), [0.075, 0.18, 0.075], [0, y, 0], [0, 0, 0], g));
    part('ico', toon('#b19aff', { emissive: '#6752c1', emissiveIntensity: 0.35 }), [0.25, 0.38, 0.25], [0, -1.9, 0], [0, 0, 0], g);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; part('cone', mat('#d7b983'), [0.065, 0.45, 0.065], [Math.sin(a) * 0.2, -1.74, Math.cos(a) * 0.2], [0, 0, a], g); }
  } else {
    const wood = mat('#9d7650');
    for (let i = 0; i < 7; i++) {
      const t = (i / 6) * Math.PI - Math.PI / 2;
      part('cyl', wood, [0.06, 0.34, 0.06], [Math.cos(t) * 0.58 - 0.25, -0.92 + Math.sin(t) * 1.05, 0], [0, 0, -t * 0.46], g);
    }
    part('cyl', mat('#faf4e5'), [0.012, 2.16, 0.012], [0.15, -0.92, 0], [0, 0, 0], g, true);
    part('cone', toon('#a6ecdb', { emissive: '#428e83', emissiveIntensity: 0.2 }), [0.08, 0.34, 0.08], [0.14, -0.9, -0.15], [Math.PI / 2, 0, 0], g);
  }
  addOutline(g, 0.012);
  return g;
}

export interface DimensionWorld { group: THREE.Group; gate: THREE.Group; light: THREE.PointLight }
export function buildFourthWorld(scene: THREE.Scene): DimensionWorld {
  const group = new THREE.Group(); group.position.set(0, FOURTH_Y, 0); group.visible = false; scene.add(group);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(27, 28, 0.7, 12), mat('#353250'));
  floor.position.y = -0.37; floor.receiveShadow = true; group.add(floor);
  const arena = new THREE.Mesh(new THREE.CircleGeometry(22, 64), mat('#453f68'));
  arena.rotation.x = -Math.PI / 2; arena.position.y = 0.025; arena.receiveShadow = true; group.add(arena);
  const runes = new THREE.Group(); group.add(runes);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(5 + i * 4.2, 5.07 + i * 4.2, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? '#8684d7' : '#a09be0', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045 + i * 0.001; runes.add(ring);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12, x = Math.sin(a) * 22.9, z = Math.cos(a) * 22.9;
    const pillar = new THREE.Group(); pillar.position.set(x, 0, z); pillar.rotation.y = a; group.add(pillar);
    part('box', mat('#77708d'), [1.1, 3.7, 1.1], [0, 1.85, 0], [0, 0, 0], pillar);
    part('ico', toon(i % 2 ? '#87d4de' : '#bda5f0', { emissive: i % 2 ? '#397785' : '#6f4d99', emissiveIntensity: 0.4 }), [0.42, 0.7, 0.42], [0, 4, 0], [0, 0, 0], pillar);
    part('box', mat('#67617e'), [1.8, 0.3, 1.8], [0, 0.14, 0], [0, 0, 0], pillar);
    if (i % 2 === 0) part('cone', mat('#d0b9ec'), [0.45, 1.5, 0.45], [0, 5.02, 0], [0, 0, 0], pillar);
  }
  const gate = new THREE.Group(); gate.position.set(0, 0, -20); group.add(gate);
  part('box', mat('#89809e'), [4.8, 0.45, 1], [0, 0.25, 0], [0, 0, 0], gate);
  [-1, 1].forEach(x => part('box', mat('#807696'), [0.6, 4.1, 0.7], [x * 1.8, 2.15, 0], [0, 0, 0], gate));
  part('box', mat('#807696'), [4.5, 0.6, 0.7], [0, 4.35, 0], [0, 0, 0], gate);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.6), new THREE.MeshBasicMaterial({ color: '#aaa6f6', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); inner.position.y = 2.12; gate.add(inner);
  const light = new THREE.PointLight('#b3a6f7', 26, 55); light.position.set(0, 11, 0); group.add(light);
  addOutline(group, 0.025);
  group.userData.runes = runes; group.userData.gatePlane = inner;
  return { group, gate, light };
}

export function animateFourthWorld(world: DimensionWorld, elapsed: number) {
  (world.group.userData.runes as THREE.Group).rotation.y = elapsed * 0.06;
  const inner = world.group.userData.gatePlane as THREE.Mesh;
  (inner.material as THREE.MeshBasicMaterial).opacity = 0.26 + Math.sin(elapsed * 2.1) * 0.1;
  world.light.intensity = 25 + Math.sin(elapsed * 1.9) * 3;
}