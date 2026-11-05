import * as THREE from 'three';
import { mat, toon, part, addOutline, groundTex, terrainMat } from './models';
import type { HumanLook } from './models';
import { makeHouse, instanced, jitter, Box } from './world';
import { SPECIES, TrainerDef } from './data';
import { Ctx, PSpot, Zone, Ball, Floor, Anim, tree, flowerField, market, foodShop, football, badminton, disco, park, farm, garden, waterfall, monument, peak, cave, river, airport, lavaLake, mine, beachRest } from './places';
import { schoolB, hauntedB, castle, stupa, domeShelter } from './places2';

// ---------- Endless world: deterministic chunk streaming ----------
export const CH = 64;
export const inCore = (x: number, z: number) => x > -80 && x < 80 && z > -90 && z < 250;
export function hash(a: number, b: number, s = 0) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x: number, z: number, s: number) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export type Biome = 'meadow' | 'forest' | 'snow' | 'desert' | 'ocean' | 'ice' | 'jungle' | 'savanna' | 'mountain' | 'valley';
export function biomeAt(x: number, z: number): Biome {
  if (inCore(x, z)) return 'meadow';
  if (z < -330 + vnoise(x / 200, 0, 5) * 80) return 'ice';
  if (x > 270 + vnoise(0, z / 250, 6) * 90) return 'ocean';
  const t = vnoise(x / 420, z / 420, 1), m = vnoise(x / 300, z / 300, 2), r = vnoise(x / 260, z / 260, 3);
  if (t < 0.3) return 'snow';
  if (r > 0.72) return 'mountain';
  if (t > 0.66) return m < 0.45 ? 'desert' : 'savanna';
  if (m > 0.68) return 'jungle';
  if (m > 0.56) return 'forest';
  if (r < 0.22 && m < 0.42) return 'valley';
  return 'meadow';
}
export const BIOME_LETTER: Record<Biome, string> = { meadow: 'm', forest: 'f', snow: 's', desert: 'd', ocean: 'o', ice: 'i', jungle: 'j', savanna: 'v', mountain: 'u', valley: 'l' };
export const BIOME_NAME: Record<Biome, string> = { meadow: 'Wild Meadow', forest: 'Deep Forest', snow: 'Snowy Peaks', desert: 'Sunny Dunes', ocean: 'Blue Ocean', ice: 'Frozen South', jungle: 'Dense Jungle', savanna: 'Dry Savanna', mountain: 'Rocky Mountains', valley: 'Valley of Flowers' };
export const GROUND: Record<Biome, string> = { meadow: '#7cc65a', forest: '#4f9a48', snow: '#eef6ff', desert: '#ecd79a', ocean: '#2f9ee8', ice: '#e4f0fa', jungle: '#3e8a3a', savanna: '#d4bf74', mountain: '#9a9488', valley: '#a8dc8a' };
export { groundTex };
export const OCEAN_MAT = toon('#2f9ee8', { emissive: '#14508c', emissiveIntensity: 0.35 });
export function islandOf(ix: number, iz: number) { if (hash(ix, iz, 40) > 0.16) return null; const cx = ix * CH, cz = iz * CH; return { x: cx + (hash(ix, iz, 41) - 0.5) * 22, z: cz + (hash(ix, iz, 42) - 0.5) * 22, r: 9 + hash(ix, iz, 43) * 8 }; }
export function isWater(x: number, z: number) { const ix = Math.round(x / CH), iz = Math.round(z / CH); if (biomeAt(ix * CH, iz * CH) !== 'ocean') return false; const is = islandOf(ix, iz); return !(is && Math.hypot(x - is.x, z - is.z) < is.r); }
export const levelAt = (x: number, z: number) => Math.max(2, Math.min(50, Math.round(4 + Math.hypot(x, z - 80) / 45)));
export const festivalOn = (x: number, z: number, day: number) => hash(Math.round(x / CH), Math.round(z / CH), day * 13 + 5) < 0.08;

// ---------- Towns ----------
export interface Town { id: string; name: string; x: number; z: number; kind: 'village' | 'city'; biome: Biome }
const SYL = ['Ash', 'Bel', 'Cor', 'Dun', 'El', 'Fen', 'Glim', 'Hol', 'Ire', 'Jun', 'Kel', 'Lun', 'Mor', 'Nim', 'Oak', 'Pell', 'Quill', 'Ros', 'Sol', 'Tam', 'Umber', 'Vel', 'Wyn', 'Yar', 'Zel'];
const END = ['brook', 'ford', 'haven', 'vale', 'ridge', 'port', 'stead', 'moor', 'hollow', 'crest', 'fall', 'glen'];
export const CELL = 4 * CH;
const townCache = new Map<string, Town | null>();
export function townInCell(cx: number, cz: number): Town | null {
  const key = `${cx},${cz}`;
  if (townCache.has(key)) return townCache.get(key)!;
  let town: Town | null = null;
  if (hash(cx, cz, 7) <= 0.85) {
    const x = (cx * 4 + 1 + Math.floor(hash(cx, cz, 8) * 2)) * CH, z = (cz * 4 + 1 + Math.floor(hash(cx, cz, 9) * 2)) * CH;
    if (!(Math.abs(x) < 150 && z > -150 && z < 320)) {
      const tb = biomeAt(x, z);
      if (tb !== 'ocean' && tb !== 'mountain' && biomeAt(x + 40, z) !== 'ocean') {
        const kind = hash(cx, cz, 10) < 0.4 ? 'city' : 'village';
        const name = SYL[Math.floor(hash(cx, cz, 11) * SYL.length)] + END[Math.floor(hash(cx, cz, 12) * END.length)];
        town = { id: `t${cx}_${cz}`, name: kind === 'city' ? name + ' City' : name, x, z, kind, biome: tb };
      }
    }
  }
  townCache.set(key, town);
  if (townCache.size > 8192) townCache.delete(townCache.keys().next().value!);
  return town;
}
export function townAt(x: number, z: number, r = 32): Town | null {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let closest: Town | null = null, distance = r;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const t = townInCell(cx + dx, cz + dz);
    if (!t) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < distance) { distance = d; closest = t; }
  }
  return closest;
}
export function airportHere(ix: number, iz: number): string | null {
  if (ix === -2 && iz === 0) return 'Embervale Airport';
  const tx = (ix - 1) * CH, tz = iz * CH; const t = townInCell(Math.floor(tx / CELL), Math.floor(tz / CELL));
  if (t && t.x === tx && t.z === tz && Math.hypot(tx, tz) > 1500 && hash(ix, iz, 50) < 0.35 && biomeAt(ix * CH, iz * CH) !== 'ocean') return t.name + ' Airport';
  return null;
}

// ---------- Species pools ----------
const EVOLVED = new Set(Object.values(SPECIES).map(s => s.evolvesTo).filter(Boolean) as string[]);
const LET: Record<Biome, string[]> = { meadow: ['m'], forest: ['f'], jungle: ['j', 'f'], savanna: ['v', 'd'], mountain: ['u', 's'], valley: ['l', 'm'], snow: ['s'], desert: ['d'], ocean: ['o'], ice: ['i', 's'] };
export function speciesPool(b: Biome, night: boolean, lvl: number, nearWater: boolean, special = ''): [string, number][] {
  const ls = special ? [special] : LET[b]; const out: [string, number][] = [];
  for (const s of Object.values(SPECIES)) {
    const bs = s.biomes; if (!bs) continue;
    if (EVOLVED.has(s.id) && lvl < 16) continue;
    const hit = bs.some(c => ls.includes(c));
    const extra = !special && b !== 'ocean' && ((night && bs.includes('n')) || (nearWater && bs.includes('w')));
    if (!hit && !extra) continue;
    if (bs.length === 1 && bs[0] === 'n' && !night) continue;
    let w = [0, 5, 3, 1, 0.25][s.rarity]; if (EVOLVED.has(s.id)) w *= 0.5; if (night && bs.includes('n')) w *= 2; if (bs.includes(ls[0])) w *= 1.5;
    out.push([s.id, w]);
  }
  return out.length ? out : [['gustwing', 1]];
}
export function pick(pool: [string, number][], r = Math.random()) { const tot = pool.reduce((a, b) => a + b[1], 0); let p = r * tot; for (const [s, w] of pool) { p -= w; if (p <= 0) return s; } return pool[0][0]; }

const TNAMES = ['Joss', 'Mira', 'Theo', 'Rin', 'Kai', 'Lena', 'Bo', 'Suki', 'Arlo', 'Nia', 'Ezra', 'Yuki', 'Finn', 'Ivy', 'Rex', 'Coco'];
export function genTrainer(id: string, x: number, z: number, arena: boolean, townName = ''): TrainerDef {
  const lvl = levelAt(x, z) + (arena ? 5 : 0); const b = biomeAt(x, z); const k = Math.abs(Math.round(x * 7 + z * 13));
  const n = arena ? 4 : 1 + (k % 3); const team: { sp: string; lvl: number }[] = [];
  for (let i = 0; i < n; i++) team.push({ sp: pick(speciesPool(b === 'ocean' ? 'meadow' : b, false, lvl, i === 1), hash(k, i, 5)), lvl: Math.max(2, lvl - 1 + i) });
  const title = arena ? 'Arena Champion' : lvl < 10 ? 'Beginner' : lvl < 18 ? 'Explorer' : lvl < 28 ? 'Veteran' : lvl < 38 ? 'Specialist' : 'Elite';
  const name = TNAMES[k % TNAMES.length];
  return { id, name: `${title} ${name}`, title, team, money: Math.round((arena ? 120 : 40) * lvl), card: '', aggr: Math.min(0.95, 0.35 + lvl / 60 + (arena ? 0.15 : 0)), color: '#ff9a2b',
    intro: arena ? `Welcome to the ${townName} Arena! Beat my ${n} pets to win a big prize!` : `Hey! You look strong. Let's battle!`,
    win: arena ? 'Amazing! You are the arena star today!' : 'Wow, you are good!', lose: arena ? 'Train more and come back!' : 'Ha! Better luck next time!' };
}

// ---------- Small builders (shared with the core village) ----------
export function buildWell() {
  const g = new THREE.Group();
  part('cyl', mat('#b0a898'), [1.1, 0.9, 1.1], [0, 0.45, 0], [0, 0, 0], g); part('cyl', toon('#4fb8f0', { emissive: '#1a6ab0', emissiveIntensity: 0.3 }), [0.9, 0.05, 0.9], [0, 0.8, 0], [0, 0, 0], g, true);
  [-1, 1].forEach(s => part('box', mat('#7a4a2a'), [0.15, 1.8, 0.15], [s * 0.95, 1.3, 0], [0, 0, 0], g));
  part('box', mat('#c0503a'), [2.4, 0.15, 1.4], [0.35, 2.3, 0], [0, 0, 0.35], g); part('box', mat('#c0503a'), [2.4, 0.15, 1.4], [-0.35, 2.3, 0], [0, 0, -0.35], g);
  part('cyl', mat('#7a4a2a'), [0.06, 1.9, 0.06], [0, 1.9, 0], [0, 0, Math.PI / 2], g); part('cyl', mat('#8a9aa8'), [0.18, 0.25, 0.18], [0, 1.4, 0], [0, 0, 0], g);
  addOutline(g, 0.03); return g;
}
export function buildStump() {
  const g = new THREE.Group(); part('cyl', mat('#8a5a32'), [0.55, 0.6, 0.55], [0, 0.3, 0], [0, 0, 0], g); part('cyl', mat('#e8c890'), [0.5, 0.02, 0.5], [0, 0.61, 0], [0, 0, 0], g, true);
  part('box', mat('#c8ccd0'), [0.05, 0.25, 0.35], [0.1, 0.8, 0], [0, 0, 0.3], g); part('cyl', mat('#7a4a2a'), [0.03, 0.6, 0.03], [0.25, 1.0, 0], [0, 0, 0.6], g);
  [0, 1, 2].forEach(i => part('cyl', mat('#9a6a3a'), [0.15, 0.8, 0.15], [-0.9, 0.15 + i * 0.28, -0.3 + (i % 2) * 0.15], [Math.PI / 2, 0, 0.1 * i], g));
  addOutline(g, 0.03); return g;
}
export function buildCamp() {
  const g = new THREE.Group();
  const tent = part('cone', mat('#ff8a3a'), [1.8, 2.4, 1.8], [0, 1.2, 0], [0, Math.PI / 4, 0], g); tent.scale.z = 2;
  part('box', mat('#2a1a14'), [0.9, 1.4, 0.05], [0, 0.7, 1.72], [0, 0, 0], g, true);
  const flaps: THREE.Group[] = [];
  [-1, 1].forEach(sd => { const fg = new THREE.Group(); fg.position.set(sd * 0.48, 0, 1.82); g.add(fg); const fl = part('box', mat('#e8702a'), [0.5, 1.45, 0.04], [-sd * 0.24, 0.72, 0], [0, 0, 0], fg); fl.rotation.z = sd * 0.08; part('box', mat('#ffd23b'), [0.04, 1.4, 0.05], [-sd * 0.47, 0.72, 0.01], [0, 0, 0], fg, true); flaps.push(fg); });
  part('cyl', mat('#5a3a2a'), [0.03, 2.6, 0.03], [0, 1.3, 1.95], [0, 0, 0], g); part('sphere', toon('#ffe7a0', { emissive: '#ffbb55', emissiveIntensity: 1.2 }), [0.12, 0.15, 0.12], [0.25, 2.1, 2.0], [0, 0, 0], g, true);
  g.userData.flaps = flaps;
  for (let i = 0; i < 4; i++) part('cyl', mat('#6a4a2a'), [0.08, 1, 0.08], [3.2 + Math.cos(i * 1.57) * 0.3, 0.12, 1 + Math.sin(i * 1.57) * 0.3], [Math.PI / 2, i * 1.57, 0], g);
  for (let i = 0; i < 8; i++) part('ico', mat('#9a968e'), [0.18, 0.14, 0.18], [3.2 + Math.cos(i * 0.785) * 0.75, 0.08, 1 + Math.sin(i * 0.785) * 0.75], [0, 0, 0], g);
  [0, 1, 2].forEach(k => part('cone', mat(['#ff6a1b', '#ffb02b', '#ffe066'][k], 1.5), [0.35 - k * 0.09, 0.8 - k * 0.15, 0.35 - k * 0.09], [3.2, 0.45, 1], [0, 0, 0], g, true));
  part('box', mat('#5a8ad0'), [1.1, 0.12, 2], [0, 0.06, -0.2], [0, 0, 0], g, true);
  // log bench + stump seat by the fire
  part('cyl', mat('#8a5a32'), [0.28, 1.8, 0.28], [3.2, 0.28, 2.75], [0, 0, Math.PI / 2], g); part('cyl', mat('#e8c890'), [0.26, 0.02, 0.26], [4.1, 0.28, 2.75], [0, 0, Math.PI / 2], g, true);
  part('cyl', mat('#8a5a32'), [0.35, 0.5, 0.35], [4.9, 0.25, 1], [0, 0, 0], g); part('cyl', mat('#e8c890'), [0.33, 0.02, 0.33], [4.9, 0.51, 1], [0, 0, 0], g, true);
  addOutline(g, 0.03);
  return g;
}
function buildArena(parent: THREE.Group, cl: Box[], ox: number, oz: number, lm: THREE.MeshToonMaterial[]) {
  const g = new THREE.Group(); g.position.set(ox, 0, oz); parent.add(g); const R = 12;
  const field = new THREE.Mesh(new THREE.CircleGeometry(R - 0.5, 40), mat('#8fd46a')); field.rotation.x = -Math.PI / 2; field.position.y = 0.03; field.userData.ownGeo = true; g.add(field);
  const line = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.9, 40), new THREE.MeshBasicMaterial({ color: '#ffffff' })); line.rotation.x = -Math.PI / 2; line.position.y = 0.04; line.userData.ownGeo = line.userData.ownMat = true; g.add(line);
  const wall = mat('#e8e0d0'), trim = mat('#d04a3a');
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    part('box', wall, [3.3, 3.2, 0.9], [x, 1.6, z], [0, -a + Math.PI / 2, 0], g); part('box', trim, [3.4, 0.4, 1.1], [x, 3.3, z], [0, -a + Math.PI / 2, 0], g);
    for (let r = 0; r < 3; r++) part('box', mat('#b0a898'), [3.3, 0.5, 0.9], [Math.cos(a) * (R + 1 + r), 0.4 + r * 0.9, Math.sin(a) * (R + 1 + r)], [0, -a + Math.PI / 2, 0], g);
    if (i % 3 === 0) { part('cyl', mat('#5a4a3a'), [0.06, 2.4, 0.06], [x, 4.6, z], [0, 0, 0], g); part('box', mat(['#ffd23b', '#3d7be0', '#d04a3a'][(i / 3) % 3]), [0.9, 0.6, 0.04], [x + 0.45 * Math.cos(-a), 5.3, z], [0, -a, 0], g); }
    cl.push({ x0: ox + x - 1.4, x1: ox + x + 1.4, z0: oz + z - 1.4, z1: oz + z + 1.4, h: 3.6 });
  }
  [-1, 1].forEach(s => { part('cyl', mat('#5a4a3a'), [0.12, 2.6, 0.12], [s * 2.5, 1.3, R + 0.5], [0, 0, 0], g); const lmM = toon('#ffe7a0', { emissive: '#ffaa44', emissiveIntensity: 1.2 }); lm.push(lmM); part('cone', lmM, [0.25, 0.5, 0.25], [s * 2.5, 2.85, R + 0.5], [0, 0, 0], g, true); });
  addOutline(g, 0.04);
}

// ---------- Chunks ----------
export interface NPCSpec { id: string; name: string; x: number; z: number; look: HumanLook; lines?: string[]; trainer?: TrainerDef; noAuto?: boolean; scale?: number; role?: string; ry?: number }
export type Spot = PSpot;
export interface Shape { k: 'r' | 'c'; x: number; z: number; w?: number; d?: number; r?: number; col: string }
export interface Chunk { key: string; ix: number; iz: number; group: THREE.Group; colliders: Box[]; lamps: THREE.MeshToonMaterial[]; npcs: NPCSpec[]; spots: Spot[]; shapes: Shape[]; town?: Town; lakes: { x: number; z: number; r: number }[]; anims: Anim[]; balls: Ball[]; zones: Zone[]; waters: Box[]; floors: Floor[] }

const G = { trunk: new THREE.CylinderGeometry(0.2, 0.34, 2.4, 7), blob: new THREE.IcosahedronGeometry(1.5, 1), pine: new THREE.ConeGeometry(1.7, 2.4, 8), rock: jitter(new THREE.IcosahedronGeometry(0.7, 1), 0.3), blade: new THREE.ConeGeometry(0.1, 0.8, 4), flower: new THREE.SphereGeometry(0.13, 6, 5), cactus: new THREE.CylinderGeometry(0.35, 0.4, 1, 8) };
const SKIN = ['#f6dcc8', '#f0c8a0', '#d8a070', '#a87050', '#7a4a30'], HAIRC = ['#1a1a1a', '#5a3a2a', '#c05a2b', '#f0c040', '#e8e8f0', '#3b6aff', '#ff7ac0'], CLOTH = ['#d04a3a', '#3d7be0', '#5aa04a', '#ffb02b', '#a05ab0', '#2b2b3a', '#ffffff', '#ff9ab0'];
export function randLook(k: number): HumanLook {
  const male = hash(k, 1, 3) < 0.5; const r = (s: number, arr: string[]) => arr[Math.floor(hash(k, s, 4) * arr.length)];
  return { body: male ? 'male' : 'female', skin: r(1, SKIN), hair: r(2, male ? ['short', 'messy', 'spiky', 'undercut', 'buzz'] : ['long', 'bob', 'pony', 'bun']), hairColor: r(3, HAIRC), top: r(4, CLOTH), bottom: r(5, ['#2b3a5a', '#3a3a3a', '#5a4a3a', '#e0d0b0', '#1a1a2a']), shoes: r(6, ['#222', '#fff', '#8a5a2b', '#c03b2b']), acc: r(7, ['none', 'none', 'hat', 'glasses', 'scarf', 'goggles']), pack: r(8, ['none', 'satchel', 'roll', 'big']), eye: r(13, ['#5a3a2a', '#3a7ad0', '#c03a2a', '#8a5ad0', '#2a8a5a']) };
}
const CHAT = ['The wild pets get stronger the farther you go from Embervale.', 'Have you tried fishing at a lake? Pets love fish!', 'At night, shadow pets come out to play.', 'If you get tired out there, make a camp and rest.', 'I heard there is an arena in every city!', 'Snowy lands have icy pets. Bring a fire pet!', 'Chop wood and sell it at the shop for coins.', 'You can cook yummy food at home or at a campfire!', 'There is an airport west of Embervale. Planes can fly anywhere!', 'Big birds fly high in the sky. Sometimes they land to eat.', 'Deep in the mountains there are caves full of bats.', 'Stay away from haunted places at night...'];
const OUTSKIRTS: Record<string, [string, number]> = { '1,0': ['market', 0.7], '-1,0': ['farm', 0.4], '0,1': ['park', 0.35], '0,-1': ['park', 0.2], '1,1': ['school', 0.1], '-1,1': ['football', 0.1], '1,-1': ['badminton', 0.1], '-1,-1': ['disco', 0.05] };
const FEAT_R: Record<string, number> = { stupa: 16, sandhouse: 10, cave: 22, waterfall: 15, garden: 16, haunted: 24, monument: 8, lighthouse: 5, market: 14, farm: 18, park: 17, school: 13, football: 16, badminton: 9, disco: 7, airport: 60, mine: 12, lava: 14 };

export interface ChunkFeature { kind: string; x: number; z: number; biome: Biome; name?: string }
export function coreChunk(ix: number, iz: number) {
  const cx = ix * CH, cz = iz * CH;
  return Math.abs(cx) - CH / 2 < 80 && cz + CH / 2 > -90 && cz - CH / 2 < 250;
}
export function beachChunk(ix: number, iz: number) {
  const b = biomeAt(ix * CH, iz * CH);
  return b !== 'ocean' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => biomeAt((ix + dx) * CH, (iz + dz) * CH) === 'ocean');
}
// Shared by the world builder and guide: what exists at a chunk is independent of loading it.
export function featureInChunk(ix: number, iz: number): ChunkFeature | null {
  if (coreChunk(ix, iz)) return null;
  const cx = ix * CH, cz = iz * CH, b = biomeAt(cx, cz);
  // A permanent school yard just east of Embervale makes both play activities
  // accessible from a new save. Other villages still use their rare roll.
  if (ix === 2 && iz === 0) return { kind: 'school', x: cx, z: cz, biome: b, name: 'Embervale School' };
  if (b === 'ocean') { const isle = islandOf(ix, iz); return isle ? { kind: 'island', x: isle.x, z: isle.z, biome: b } : null; }
  if (b === 'ice') {
    if (hash(ix, iz, 30) < 0.35) return { kind: 'igloo', x: cx + (hash(ix, iz, 31) - 0.5) * 30, z: cz + (hash(ix, iz, 32) - 0.5) * 30, biome: b };
    return null;
  }
  const t = townInCell(Math.floor(cx / CELL), Math.floor(cz / CELL));
  if (t?.x === cx && t.z === cz) return null;
  const airportName = airportHere(ix, iz);
  if (airportName) return { kind: 'airport', x: cx, z: cz - 6, biome: b, name: airportName };
  if (b === 'mountain' || b === 'desert') {
    if (hash(ix, iz, 75) < 0.30) return { kind: 'mine', x: cx, z: cz, biome: b, name: 'Crystal Mine' };
    if (hash(ix, iz, 74) < 0.07) return { kind: 'lava', x: cx, z: cz, biome: b, name: 'Emberglass Lake' };
  }
  let kind = '', x = cx, z = cz;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const tc = townInCell(Math.floor((cx - dx * CH) / CELL), Math.floor((cz - dz * CH) / CELL));
    if (tc && tc.x === cx - dx * CH && tc.z === cz - dz * CH) {
      const [f, chance] = OUTSKIRTS[`${dx},${dz}`];
      if (hash(ix, iz, 61) < chance) { kind = f; x -= dx * 6; z -= dz * 6; }
      break;
    }
  }
  const far = Math.hypot(cx, cz) > 400, lonely = !townAt(cx, cz, 160), roll = hash(ix, iz, 71);
  if (!kind) {
    if (b === 'mountain') kind = roll < 0.35 ? 'cave' : roll < 0.47 ? 'waterfall' : '';
    else if (b === 'jungle') kind = roll < 0.5 ? 'river' : roll < 0.58 && far ? 'haunted' : roll < 0.68 ? 'waterfall' : '';
    else if (b === 'forest') kind = roll < 0.06 && far ? 'haunted' : roll < 0.16 ? 'waterfall' : roll < 0.28 && lonely ? 'garden' : '';
    else if (b === 'meadow' || b === 'valley') kind = roll < 0.15 && lonely ? 'garden' : roll < 0.2 ? 'monument' : roll < 0.24 && far ? 'haunted' : '';
    else if (b === 'desert') kind = roll < 0.14 ? 'stupa' : roll < 0.19 ? 'monument' : roll < 0.36 ? 'sandhouse' : '';
    else if (b === 'savanna') kind = roll < 0.07 ? 'monument' : roll < 0.1 ? 'stupa' : '';
    if (beachChunk(ix, iz) && !kind && roll < 0.15) kind = 'lighthouse';
  }
  if (!kind) return null;
  if (kind === 'monument') kind = (['statue', 'castle', 'arch'] as const)[Math.floor(hash(ix, iz, 72) * 3)];
  if (kind === 'river' && hash(ix, iz, 73) < 0.6) kind = 'rootbridge';
  if (kind === 'cave') z = cz + 6;
  return { kind, x, z, biome: b };
}

export function buildChunk(ix: number, iz: number, beaten: (id: string) => boolean): Chunk {
  const cx = ix * CH, cz = iz * CH; const key = `${ix},${iz}`;
  const ch: Chunk = { key, ix, iz, group: new THREE.Group(), colliders: [], lamps: [], npcs: [], spots: [], shapes: [], lakes: [], anims: [], balls: [], zones: [], waters: [], floors: [] };
  if (coreChunk(ix, iz)) return ch; // core is hand-built
  const b = biomeAt(cx, cz); const gr = ch.group; const cl = ch.colliders;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), eu = new THREE.Euler();
  const M = (x: number, y: number, z: number, s: number | [number, number, number], ry = 0) => { pv.set(x, y, z); q.setFromEuler(eu.set(0, ry, 0)); if (typeof s === 'number') sv.setScalar(s); else sv.set(...s); return m4.compose(pv, q, sv); };
  let seed = Math.floor(hash(ix, iz, 99) * 1e9) || 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ctx: Ctx = { gr, cl, spots: ch.spots, npcs: ch.npcs, shapes: ch.shapes, anims: ch.anims, balls: ch.balls, zones: ch.zones, waters: ch.waters, lamps: ch.lamps, key, rnd, look: k => randLook(ix * 977 + iz * 131 + k), floors: ch.floors };
  const beach = beachChunk(ix, iz);
  const gcol = beach ? '#f0dca0' : GROUND[b];
  const plane = (col: string, y: number, m?: THREE.Material) => { const gp = new THREE.Mesh(new THREE.PlaneGeometry(CH, CH), m ?? terrainMat(col, 9)); gp.rotation.x = -Math.PI / 2; gp.position.set(cx, y, cz); gp.receiveShadow = true; gp.userData.noOutline = true; gp.userData.ownGeo = true; if (!m) gp.userData.ownMat = true; gr.add(gp); return gp; };
  if (b !== 'meadow' || beach) plane(gcol, 0.065, b === 'ocean' ? OCEAN_MAT : undefined);
  ch.shapes.push({ k: 'r', x: cx, z: cz, w: CH, d: CH, col: gcol });
  if (b === 'ocean') {
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5 + rnd() * 3, 0.18), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.55 })); f.rotation.set(-Math.PI / 2, 0, rnd() * 0.4); f.position.set(cx + (rnd() - 0.5) * CH, 0.03, cz + (rnd() - 0.5) * CH); f.userData.ownGeo = f.userData.ownMat = true; gr.add(f); }
    const is = islandOf(ix, iz);
    if (is) {
      const sand = new THREE.Mesh(new THREE.CircleGeometry(is.r, 32), terrainMat('#d6c18f', 5)); sand.rotation.x = -Math.PI / 2; sand.position.set(is.x, 0.05, is.z); sand.userData.ownGeo = sand.userData.ownMat = true; sand.receiveShadow = true; gr.add(sand);
      const shallow = new THREE.Mesh(new THREE.RingGeometry(is.r, is.r + 3, 32), new THREE.MeshBasicMaterial({ color: '#7fe0f0', transparent: true, opacity: 0.7 })); shallow.rotation.x = -Math.PI / 2; shallow.position.set(is.x, 0.04, is.z); shallow.userData.ownGeo = shallow.userData.ownMat = true; gr.add(shallow);
      beachRest(ctx, is.x, is.z);
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) { const a = rnd() * 6.28, r = rnd() * is.r * 0.6; const px = is.x + Math.cos(a) * r, pz = is.z + Math.sin(a) * r; if (Math.hypot(px - is.x, pz - is.z) > 5) tree(ctx, 'coconut', px, pz, 0.9 + rnd() * 0.4); }
      ch.shapes.push({ k: 'c', x: is.x, z: is.z, r: is.r, col: '#f0dca0' });
      ch.spots.push({ x: is.x + is.r - 1, z: is.z, r: 2.5, kind: 'fish', label: 'Go fishing' });
    }
    return ch;
  }
  if (b === 'ice') {
    const berg = instanced(gr, jitter(new THREE.ConeGeometry(1, 1, 7, 3), 0.18), '#f4fbff', 30, 1.04, true, true, true), spike = instanced(gr, new THREE.ConeGeometry(0.4, 1, 6), '#a8dcff', 60, 1.08, true, true, true), mound = instanced(gr, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', 30, 0, true, true, true);
    for (let i = 0; i < 8; i++) { const x = cx + (rnd() - 0.5) * CH, z = cz + (rnd() - 0.5) * CH; const s = 2 + rnd() * 4, h = 4 + rnd() * 9; berg.add(M(x, h / 2 - 0.3, z, [s, h, s], rnd() * 6), ['#f4fbff', '#e4f4ff', '#d6eefc'][i % 3]); cl.push({ x0: x - s * 0.7, x1: x + s * 0.7, z0: z - s * 0.7, z1: z + s * 0.7, h, e: 0.3 }); }
    for (let i = 0; i < 40; i++) { const x = cx + (rnd() - 0.5) * CH, z = cz + (rnd() - 0.5) * CH; const h = 0.6 + rnd() * 2.2; spike.add(M(x, h / 2, z, [1, h, 1], rnd() * 6), ['#a8dcff', '#c8ecff', '#88c8f0'][i % 3]); }
    for (let i = 0; i < 20; i++) mound.add(M(cx + (rnd() - 0.5) * CH, -0.1, cz + (rnd() - 0.5) * CH, [1.5 + rnd() * 3, 0.5 + rnd() * 0.6, 1.5 + rnd() * 3], rnd() * 6));
    berg.done(); spike.done(); mound.done();
    if (hash(ix, iz, 3) < 0.3) { const lr = 8 + rnd() * 6, lx = cx + (rnd() - 0.5) * 20, lz = cz + (rnd() - 0.5) * 20; const ice = new THREE.Mesh(new THREE.CircleGeometry(lr, 28), toon('#bfe8ff', { emissive: '#6ab0e0', emissiveIntensity: 0.25 })); ice.rotation.x = -Math.PI / 2; ice.position.set(lx, 0.04, lz); ice.userData.ownGeo = ice.userData.ownMat = true; gr.add(ice); ch.spots.push({ x: lx, z: lz, r: lr + 1, kind: 'fish', label: 'Ice fishing' }); ch.shapes.push({ k: 'c', x: lx, z: lz, r: lr, col: '#bfe8ff' }); }
    const igloo = featureInChunk(ix, iz);
    if (igloo?.kind === 'igloo') domeShelter(ctx, igloo.x, igloo.z, 'ice');
    return ch;
  }
  const t = townInCell(Math.floor(cx / CELL), Math.floor(cz / CELL));
  if (t && t.x === cx && t.z === cz) {
    ch.town = t; const city = t.kind === 'city';
    const pal = b === 'snow' ? { wall: ['#f0f4ff', '#e0ecf8'], roof: ['#3d6ab0', '#5a7ac0'] } : b === 'desert' || b === 'savanna' ? { wall: ['#f0d8a8', '#e8c890'], roof: ['#c06a3a', '#d08a4a'] } : { wall: ['#fff3dc', '#ffe6ec', '#eaffea', '#e8f0ff'], roof: ['#e0574a', '#3d7be0', '#5aa04a', '#a05ab0', '#e0a030'] };
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(city ? 30 : 22, 40), toon('#ffffff', { map: groundTex(city ? '#ddd2bd' : '#e6c88e', 10) })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.02, cz); plaza.receiveShadow = true; plaza.userData.ownGeo = plaza.userData.ownMat = true; gr.add(plaza);
    ch.shapes.push({ k: 'c', x: cx, z: cz, r: city ? 30 : 22, col: city ? '#ddd2bd' : '#e6c88e' });
    const H = (x: number, z: number, ry: number, w: number, d: number, i: number, big = false) => { makeHouse(cx + x, cz + z, w, d, pal.wall[i % pal.wall.length], pal.roof[i % pal.roof.length], true, big, gr, cl, ch.lamps, ry, i % 2 === 1, ch.floors); const odd = Math.abs(Math.round(ry / (Math.PI / 2))) % 2 === 1; ch.shapes.push({ k: 'r', x: cx + x, z: cz + z, w: odd ? d : w, d: odd ? w : d, col: pal.roof[i % pal.roof.length] }); };
    if (city) {
      buildArena(gr, cl, cx, cz, ch.lamps); ch.shapes.push({ k: 'c', x: cx, z: cz, r: 13, col: '#d04a3a' });
      [[-12, -25, 0], [12, -25, 0], [-12, 25, Math.PI], [12, 25, Math.PI], [25, -10, -Math.PI / 2], [25, 10, -Math.PI / 2], [-25, -10, Math.PI / 2], [-25, 10, Math.PI / 2]].forEach(([x, z, r], i) => H(x, z, r, 8, 6, i, i % 2 === 0));
      const arenaId = 'arena_' + t.id; ch.npcs.push({ id: 'trainer:' + arenaId, name: 'Arena Champion', x: cx, z: cz - 2, look: randLook(ix * 31 + iz), trainer: genTrainer(arenaId, cx, cz, true, t.name), noAuto: true });
    } else [[0, -16, 0], [16, 0, -Math.PI / 2], [-16, 0, Math.PI / 2], [-12, 15, Math.PI], [12, 15, Math.PI]].forEach(([x, z, r], i) => H(x, z, r, 7, 6, i));
    foodShop(ctx, cx + 24, cz - 24);
    const wx = city ? 17 : 0, wz = city ? 17 : 0; const well = buildWell(); well.position.set(cx + wx, 0, cz + wz); gr.add(well); cl.push({ x0: cx + wx - 1.2, x1: cx + wx + 1.2, z0: cz + wz - 1.2, z1: cz + wz + 1.2 });
    ch.spots.push({ x: cx + wx, z: cz + wz, r: 2.6, kind: 'water', label: 'Fill water' });
    [[6, 6], [-6, 6], [6, -6], [-6, -6]].forEach(([x, z]) => { const lg = new THREE.Group(); lg.position.set(cx + x * (city ? 3 : 1.6), 0, cz + z * (city ? 3 : 1.6)); part('cyl', mat('#3a3a48'), [0.1, 3.2, 0.1], [0, 1.6, 0], [0, 0, 0], lg); const lmM = toon('#ffe7a0', { emissive: '#ffcc66', emissiveIntensity: 0.1 }); ch.lamps.push(lmM); part('sphere', lmM, [0.26, 0.32, 0.26], [0, 3.0, 0], [0, 0, 0], lg, true); addOutline(lg); gr.add(lg); });
    const k = ix * 977 + iz * 131; const o = city ? 19 : 7;
    ch.npcs.push({ id: 'healer@' + key, name: 'Nurse', x: cx - o, z: cz + (city ? 2 : 8), look: { ...randLook(k + 1), body: 'female', top: '#ff9ab0', bottom: '#ffffff' }, role: 'nurse' });
    ch.npcs.push({ id: 'shop@' + key, name: 'Shopkeeper', x: cx + o, z: cz + (city ? 2 : 8), look: { ...randLook(k + 2), top: '#3d7be0' }, role: 'vendor' });
    for (let i = 0; i < (city ? 3 : 2); i++) ch.npcs.push({ id: `chat@${key}#${i}`, name: 'Villager', x: cx + (i - 1) * 8 + 3, z: cz + (city ? -18 : -7), look: randLook(k + 10 + i), lines: [`Welcome to ${t.name}!`, CHAT[Math.floor(hash(k, i, 6) * CHAT.length)]] });
    return ch;
  }
  // Use the same deterministic placement as the navigation guide.
  const feature = featureInChunk(ix, iz), feat = feature?.kind ?? '', fx = feature?.x ?? cx, fz = feature?.z ?? cz;
  switch (feat) {
    case 'mine': mine(ctx, fx, fz); break;
    case 'lava': lavaLake(ctx, fx, fz); break;
    case 'airport': airport(ctx, fx, fz, feature?.name ?? 'Airport'); break;
    case 'market': market(ctx, fx, fz); break; case 'farm': farm(ctx, fx, fz); break; case 'park': park(ctx, fx, fz); break; case 'school': schoolB(ctx, fx, fz); break;
    case 'stupa': stupa(ctx, fx, fz); break;
    case 'sandhouse': domeShelter(ctx, fx, fz, 'sand'); break;
    case 'football': football(ctx, fx, fz); break; case 'badminton': badminton(ctx, fx, fz); break; case 'disco': disco(ctx, fx, fz); break;
    case 'cave': cave(ctx, fx, fz); break; case 'waterfall': waterfall(ctx, fx, fz); break; case 'garden': garden(ctx, fx, fz); break; case 'haunted': hauntedB(ctx, fx, fz); break;
    case 'castle': castle(ctx, fx, fz); break; case 'statue': case 'arch': monument(ctx, fx, fz, feat); break; case 'lighthouse': monument(ctx, fx, fz, 'lighthouse'); break;
    case 'river': case 'rootbridge': river(ctx, cx, cz, feat === 'rootbridge'); break;
  }
  const featR = FEAT_R[feat] ?? (feat === 'castle' ? 10 : feat === 'rootbridge' ? 8 : 0);
  if (beach) beachRest(ctx, cx + (feat ? 18 : 0), cz + (feat ? 17 : 0));
  const trunk = instanced(gr, G.trunk, '#7a5232', 140, 1.1), blob = instanced(gr, G.blob, '#4caf50', 520, 1.06), pine = instanced(gr, G.pine, '#2f7d4a', 200, 1.06);
  const rocks = instanced(gr, G.rock, '#a9a59c', 40, 1.08), blades = instanced(gr, G.blade, '#5aa83a', 500, 0, false), flowers = instanced(gr, G.flower, '#ff8ad0', 120, 0, false), cactus = instanced(gr, G.cactus, '#5aa04a', 40, 1.08);
  if (!feat && b !== 'desert' && b !== 'savanna' && hash(ix, iz, 3) < 0.22) {
    const lr = 7 + hash(ix, iz, 4) * 6, lx = cx + (hash(ix, iz, 5) - 0.5) * 20, lz = cz + (hash(ix, iz, 6) - 0.5) * 20;
    const wm = new THREE.Mesh(new THREE.CircleGeometry(lr, 28), toon(b === 'snow' ? '#a8e0ff' : '#4fc3f7', { emissive: '#1a7ab0', emissiveIntensity: 0.25 })); wm.rotation.x = -Math.PI / 2; wm.position.set(lx, 0.05, lz); wm.userData.ownGeo = wm.userData.ownMat = true; gr.add(wm);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(lr + 1.5, 28), mat(b === 'snow' ? '#dfe8f0' : '#ecdcaa')); sand.rotation.x = -Math.PI / 2; sand.position.set(lx, 0.035, lz); sand.userData.ownGeo = true; gr.add(sand);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; rocks.add(M(lx + Math.cos(a) * (lr + 0.6), 0.15, lz + Math.sin(a) * (lr + 0.6), 0.4 + rnd() * 0.4, rnd() * 6)); }
    const s = lr * 0.72; cl.push({ x0: lx - s, x1: lx + s, z0: lz - s, z1: lz + s });
    ch.spots.push({ x: lx, z: lz, r: lr + 3, kind: 'fish', label: 'Go fishing' }); ch.shapes.push({ k: 'c', x: lx, z: lz, r: lr, col: '#4fc3f7' }); ch.lakes.push({ x: lx, z: lz, r: lr });
  }
  const free = (x: number, z: number) => !ch.lakes.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 3) && !townAt(x, z, 40) && Math.hypot(x - fx, z - fz) > featR && !ch.zones.some(zone => zone.kind === 'beachrest' && Math.hypot(x - zone.x, z - zone.z) < zone.r + 2) && !(feat === 'river' && Math.abs(z - cz) < 6);
  const rp = () => [cx + (rnd() - 0.5) * CH, cz + (rnd() - 0.5) * CH];
  if (b === 'mountain') {
    for (let i = 0; i < 8; i++) { const [x, z] = rp(); if (!free(x, z) || Math.abs(z - cz) < 5) continue; peak(ctx, x, z, 7 + rnd() * 8, 16 + rnd() * 22, rnd() < 0.7); }
    const path = new THREE.Mesh(new THREE.PlaneGeometry(CH, 3.2), terrainMat('#a99575', 8)); path.rotation.x = -Math.PI / 2; path.position.set(cx, 0.02, cz); path.userData.ownGeo = path.userData.ownMat = true; gr.add(path);
    ch.shapes.push({ k: 'r', x: cx, z: cz, w: CH, d: 3.2, col: '#b8a07a' });
  }
  const dense = b === 'jungle' ? 120 : b === 'forest' ? 60 : b === 'snow' ? 30 : b === 'meadow' ? 18 : b === 'valley' ? 6 : b === 'mountain' ? 10 : 0;
  const nTrees = beach ? 0 : dense;
  const greens = b === 'jungle' ? ['#2f7a34', '#3e8a3a', '#26702e', '#3a9440'] : b === 'forest' ? ['#3e9a45', '#43a047', '#2f8a3a', '#4caf50'] : ['#4caf50', '#5cbf4a', '#6cc45a', '#43a047'];
  for (let i = 0; i < nTrees; i++) {
    const [x, z] = rp(); if (!free(x, z)) continue; const s = (b === 'jungle' ? 1.1 : 0.85) + rnd() * 0.6;
    trunk.add(M(x, 1.2 * s, z, s));
    if (b === 'snow' || b === 'mountain' || (b === 'forest' && rnd() < 0.45)) { const c = b === 'snow' ? (rnd() < 0.5 ? '#e8f4f0' : '#2f6d4a') : '#2f7d4a'; for (let k = 0; k < 3; k++) pine.add(M(x, (2.3 + k * 1.3) * s, z, [s * (1 - k * 0.25), s, s * (1 - k * 0.25)]), k === 2 && b === 'snow' ? '#ffffff' : c); }
    else { const c = greens[Math.floor(rnd() * greens.length)]; blob.add(M(x, 3.1 * s, z, s), c); blob.add(M(x + 0.9 * s, 2.7 * s, z + 0.3 * s, 0.72 * s), c); blob.add(M(x - 0.8 * s, 2.8 * s, z - 0.4 * s, 0.78 * s), c); blob.add(M(x, 3.9 * s, z, 0.66 * s), b === 'jungle' ? '#4a9a40' : '#6cc45a'); }
    cl.push({ x0: x - 0.4 * s, x1: x + 0.4 * s, z0: z - 0.4 * s, z1: z + 0.4 * s, h: 5.5 * s, e: 1.3 * s });
  }
  const special = (kind: Parameters<typeof tree>[1], n: number, s = 1) => { for (let i = 0; i < n; i++) { const [x, z] = rp(); if (free(x, z)) tree(ctx, kind, x, z, s * (0.85 + rnd() * 0.3)); } };
  if (beach) special('coconut', 7);
  else if (b === 'jungle') { special('banyan', 3); special('banana', 6); special('neem', 2); }
  else if (b === 'forest') { special('neem', 2); if (rnd() < 0.3) special('banyan', 1); if (rnd() < 0.4) special('mango', 1); }
  else if (b === 'meadow') { if (rnd() < 0.5) special('apple', 1 + Math.floor(rnd() * 2)); if (rnd() < 0.4) special('mango', 1); if (rnd() < 0.3) special('neem', 1); }
  else if (b === 'savanna') { special('acacia', 5); special('baobab', 2); }
  else if (b === 'valley') { special('neem', 2); special('apple', 1); flowerField(ctx, cx, cz, CH - 4, CH - 4, 650, true); ch.zones.push({ x: cx, z: cz, r: 40, kind: 'valley', name: 'Valley of Flowers' }); }
  if (b === 'desert') for (let i = 0; i < 9; i++) { const [x, z] = rp(); if (!free(x, z)) continue; const h = 1.6 + rnd() * 1.6; cactus.add(M(x, h / 2, z, [1, h, 1])); cactus.add(M(x + 0.55, h * 0.6, z, [0.5, h * 0.4, 0.5])); cactus.add(M(x - 0.5, h * 0.5, z, [0.45, h * 0.35, 0.45])); cl.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }); }
  for (let i = 0; i < (b === 'mountain' ? 30 : 9); i++) { const [x, z] = rp(); if (!free(x, z)) continue; const s = 0.5 + rnd() * (i < 2 ? 2.4 : 1); rocks.add(M(x, s * 0.35, z, [s, s * 0.8, s], rnd() * 6), b === 'desert' || b === 'savanna' ? '#d0a878' : b === 'snow' ? '#c8d0d8' : '#a9a59c'); if (s > 1.4) cl.push({ x0: x - s * 0.6, x1: x + s * 0.6, z0: z - s * 0.6, z1: z + s * 0.6 }); }
  if (b !== 'snow') { const gc = b === 'desert' ? ['#c8b060', '#b0a050'] : b === 'savanna' ? ['#c8b060', '#d8c070', '#b8a050'] : ['#5aa83a', '#6cbf44', '#4e9a34', '#7acb50']; const n = b === 'desert' ? 80 : b === 'mountain' ? 150 : 480; for (let i = 0; i < n; i++) { const [x, z] = rp(); if (!free(x, z)) continue; blades.add(M(x, 0.35, z, [1, 0.7 + rnd() * (b === 'savanna' ? 1.4 : 0.8), 1], rnd() * 3), gc[i % gc.length]); } }
  if (b === 'meadow' || b === 'forest' || b === 'jungle') { const fc = ['#ff8ad0', '#ffffff', '#ffe066', '#b48aff', '#ff6a6a']; for (let i = 0; i < 120; i++) { const [x, z] = rp(); if (free(x, z)) flowers.add(M(x, 0.18, z, 1), fc[i % 5]); } }
  trunk.done(); blob.done(); pine.done(); rocks.done(); blades.done(); flowers.done(); cactus.done();
  if (b !== 'desert' && b !== 'mountain') for (let i = 0; i < 2; i++) { const x = cx + (rnd() - 0.5) * 50, z = cz + (rnd() - 0.5) * 50; if (!free(x, z)) continue; const st = buildStump(); st.position.set(x, 0, z); st.rotation.y = rnd() * 6; gr.add(st); cl.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }); ch.spots.push({ x, z, r: 2, kind: 'wood', label: 'Chop wood' }); }
  if (feat !== 'airport' && hash(ix, iz, 21) < 0.2 && Math.hypot(cx, cz) > 150) { const id = `gen_${ix}_${iz}`; if (!beaten(id)) { const x = cx + (hash(ix, iz, 22) - 0.5) * 30, z = cz + (hash(ix, iz, 23) - 0.5) * 30; if (free(x, z)) { const tr = genTrainer(id, x, z, false); ch.npcs.push({ id: 'trainer:' + id, name: tr.name, x, z, look: randLook(ix * 13 + iz * 7), trainer: tr }); } } }
  return ch;
}

export function disposeChunk(ch: Chunk) {
  ch.group.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; if ((m as unknown as THREE.InstancedMesh).isInstancedMesh) (m as unknown as THREE.InstancedMesh).dispose(); if (m.userData.ownGeo) m.geometry.dispose(); if (m.userData.ownMat) (m.material as THREE.Material).dispose(); });
  ch.lamps.forEach(l => l.dispose());
}
