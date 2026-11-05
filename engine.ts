import * as THREE from 'three';
import { SPECIES, ABILITIES, TRAINERS, COUNTER, LOCATIONS, QUESTS, ITEMS, TYPE_COLORS, typeMult, Ability, TrainerDef, ElemType } from './data';
import { SaveData, CreatureInst, Settings, stats, makeCreature, xpNext, MAX_LEVEL } from './state';
import { buildCreature, animateCreature, buildHuman, animateHuman, emojiSprite, toon } from './models';
import { buildWorld, World, IX, IY } from './world';
import { CH, Chunk, buildChunk, disposeChunk, inCore, townAt, biomeAt, BIOME_NAME, GROUND, beachChunk, speciesPool, pick, levelAt, buildWell, buildStump, buildCamp, Spot, Town, type Biome } from './world2';
import { buildTool, buildSurfboard, buildSkate, buildFish, part, mat as tmat, addOutline, textSprite } from './models';
import { isWater, festivalOn, randLook, NPCSpec } from './world2';
import { buildPlane, PLANES, foodShop, labelTex, Ctx, Zone, floorH, Floor, Anim } from './places';
import { RECIPES } from './data';
import { CombatVfx, projectileVisual } from './combat-vfx';
import { buildFourthWorld, FOURTH_Y, PORTAL_POS, animateFourthWorld, type DimensionWorld, type WeaponKind } from './dimension';
import { FourthDuel } from './fourth-duel';
import { recordDaily, syncDaily, type DailyAction } from './daily';
import { queueTrainerGift } from './rewards';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.08 }, vig: { value: 0.20 }, tint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat; uniform float vig; uniform vec3 tint; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299,0.587,0.114)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb *= tint; float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - smoothstep(0.42, 0.92, d) * vig; c.rgb = (c.rgb * (2.0 * c.rgb + 0.035)) / (c.rgb * (2.0 * c.rgb + 0.55) + 0.12); gl_FragColor = c; }',
};
const SKY_KEYS: [number, string, string][] = [[0, '#060a24', '#1a1a40'], [4.5, '#0b1240', '#2a2a5a'], [5.8, '#4a5aa8', '#ffb27a'], [7.2, '#5aa0e8', '#ffe0b0'], [9, '#2f86e8', '#d4efff'], [16, '#2f86e8', '#d4efff'], [17.8, '#4a6ac8', '#ffc08a'], [19.2, '#3a3a8a', '#ff8a6a'], [20.5, '#0e1440', '#2a2a5a'], [24, '#060a24', '#1a1a40']];
function skyAt(t: number): [THREE.Color, THREE.Color] {
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const [t0, a0, b0] = SKY_KEYS[i], [t1, a1, b1] = SKY_KEYS[i + 1]; const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  return [new THREE.Color(a0).lerp(new THREE.Color(a1), k), new THREE.Color(b0).lerp(new THREE.Color(b1), k)];
}
import { sfx, playMusic, cry } from './audio';

export interface Callbacks {
  onInteract(id: string): void; onToast(msg: string, kind?: 'good' | 'bad' | 'info' | 'card' | 'ach'): void; onChange(): void;
  onEvolve(inst: CreatureInst, from: string, to: string): void; onBattleEnd(res: 'win' | 'lose' | 'fled' | 'caught', trainer?: string): void; onMenu(): void;
  onWorldProgress?(progress: number, label: string): void; onWorldReady?(): void; onWorldError?(message: string): void;
}
interface Status { burn: number; slow: number; stun: number; poison: number; buff: number }
interface Actor {
  mesh: THREE.Group; inst: CreatureInst; side: 0 | 1; maxHp: number; hp: number; en: number; ult: number; cds: Record<string, number>;
  st: Status; iframes: number; blocking: boolean; blockT: number; busy: number; vel: THREE.Vector3; combo: number; comboT: number; dodgeCd: number;
  dashT: number; dashDir: THREE.Vector3; aiT: number; intent: string; fleeing: boolean; s: ReturnType<typeof stats>;
}
interface Wild { mesh: THREE.Group; inst: CreatureInst; state: 'wander' | 'sleep' | 'flee' | 'chase' | 'hide' | 'territory'; target: THREE.Vector3; t: number; home: THREE.Vector3; ignore: number; leader?: Wild; boss?: boolean; bossId?: string }
interface NPC { id: string; name: string; mesh: THREE.Group; pos: THREE.Vector3; trainer?: string; visible: () => boolean; engaged?: boolean; lines?: string[]; noAuto?: boolean; chunk?: string; home?: THREE.Vector3; act?: string; wt?: number; target?: THREE.Vector3; tool?: THREE.Object3D; role?: string; asleep?: boolean; bed?: THREE.Vector3; sleepT?: number }
interface Proj { mesh: THREE.Group; vel: THREE.Vector3; owner: Actor | null; ab: Ability | null; life: number; active: boolean; mult: number }
interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; active: boolean }
interface HomePet { mesh: THREE.Group; inst: CreatureInst; target: THREE.Vector3; t: number }
interface Battle {
  kind: 'wild' | 'trainer'; trainer?: TrainerDef; team: CreatureInst[]; playerTeam: CreatureInst[]; ei: number; me: Actor; foe: Actor; center: THREE.Vector3;
  count: number; ring: THREE.Group; side: THREE.Vector3; floorY: number; oppNpc?: NPC; oppPos?: THREE.Vector3; switchCd: number; over: boolean; xpPool: number; wild?: Wild; capture?: { t: number; shakes: number; success: boolean; pod: THREE.Mesh }; participants: Set<string>; endT: number; result?: 'win' | 'lose' | 'fled' | 'caught'; bossPhase: number; bossTell: number; bossMoveCd: number; bossMove: string; bossMoveKind: 'slam' | 'dash' | 'burst' | ''; bossIntro: number; bossComboStep: number;
}
export interface AbHud { name: string; key: string; cd: number; maxCd: number; cost: number; color: string; type: ElemType }
export interface ActorHud { name: string; sp: string; lvl: number; hp: number; max: number; en: number; ult: number; type: ElemType; status: string[]; blocking: boolean }
export interface Hud {
  mode: 'explore' | 'battle' | 'fourth'; area: string; time: number; weather: string; prompt: string; me?: ActorHud; foe?: ActorHud; abilities: AbHud[];
  count: number; boat: boolean; skate: boolean; run: boolean; ocean: boolean; flying: boolean; festivals: string[]; sitting: boolean; bad: string;
  trainer?: string; enemyLeft: number; bubble: string; fps: number; pod: string; capture: string; switchCd: number; dodgeCd: number; pos: [number, number]; yaw: number; night: boolean; fade: number; indoor: boolean; facing: number;
  dimension?: { weapon: WeaponKind; hp: number; maxHp: number; foeHp: number; foeMax: number; energy: number; phase: 'duel' | 'won' | 'lost'; wins: number; block: boolean; foeWeapon: WeaponKind };
  firstPerson: boolean; trainerHealth: number; trainerHunger: number; boss?: { name: string; phase: number; tell: string; tellT: number; intro: boolean };
}
const WEATHERS = ['Clear', 'Clear', 'Clear', 'Cloudy', 'Rain', 'Storm', 'Fog', 'Wind', 'Snow'];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Engine {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; clock = new THREE.Clock();
  keys = new Set<string>(); pressed = new Set<string>(); yaw = Math.PI; pitch = 0.32; dist = 8.5; dragging = false; lastPtr = [0, 0]; firstPerson = false; trainerHitCd = 0; survivalTick = 0;
  toggleFirstPerson() {
    if (this.battle || this.fourth || this.fourthLobby || this.sleepSeq || this.trans || this.warp || this.activity) return;
    this.firstPerson = !this.firstPerson;
    this.player.visible = !this.firstPerson;
    this.camFollowSnap = true;
    sfx('ui'); this.cb.onChange();
  }
  player!: THREE.Group; partner: THREE.Group | null = null; partnerUid = ''; wilds: Wild[] = []; npcs: NPC[] = [];
  world: World; projs: Proj[] = []; parts: Particle[] = []; rings: { mesh: THREE.Mesh; t: number; max: number }[] = []; pending: { t: number; fn: () => void }[] = [];
  combatFx!: CombatVfx;
  sprites: { s: THREE.Sprite; vel: THREE.Vector3; life: number }[] = [];
  battle: Battle | null = null; paused = false; running = true; raf = 0;
  sun!: THREE.DirectionalLight; hemi!: THREE.HemisphereLight; rain!: THREE.Points;
  hud: Hud; weatherT = 150; spawnT = 0; lastFrame = 0; fpsAcc = 0; fpsN = 0; fps = 60; shake = 0; flashT = 0; bubbleT = 0; bubble = ''; usePod = 'lumenpod';
  pads: boolean[] = []; area = 'Embervale'; moved = 0; rotated = 0; autosaveT = 60; queuedEvos: CreatureInst[] = [];
  indoor = false; trans: { t: number; dir: 'in' | 'out'; done: boolean } | null = null; homePets: HomePet[] = []; joy = [0, 0]; padAxes = [0, 0];
  override: { uid: string; t: number } | null = null; reactLock = 0; movingNow = false;
  chunks = new Map<string, Chunk>(); genTrainers = new Map<string, TrainerDef>(); coreSpots: Spot[] = []; camp: THREE.Group | null = null; tool: THREE.Object3D | null = null; town: Town | null = null;
  guideTarget: { name: string; x: number; z: number } | null = null;
  fourthWorld: DimensionWorld | null = null; fourth: FourthDuel | null = null; fourthLobby = false;
  returnPos: THREE.Vector3 | null = null;
  booting = true; bootProgress = 0;
  adventureLandmarks = new THREE.Group(); adventureBosses: Wild[] = []; adventureInterior: 'outside' | 'cave' | 'island' = 'outside'; adventureReturn: THREE.Vector3 | null = null; adventureCineT = 0; adventureCineKind: 'intro' | 'victory' | null = null; homestead = new THREE.Group(); homesteadSignature = '';
  daily(action: DailyAction, amount = 1) {
    const update = recordDaily(this.save, action, amount);
    if (!update.completed) { if (update.changed && action !== 'move') this.cb.onChange(); return; }
    const at = this.player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.burst(at, update.final ? '#fbd38b' : '#9ee5d6', update.final ? 24 : 12, 4);
    sfx(update.final ? 'victory' : 'task');
    this.cb.onToast(update.final ? 'All daily tasks done! Final bonus added.' : update.chainBonus ? `${update.task!.title} done! BOUNTY CHAIN! +${update.chainBonus} bonus coins.` : `${update.task!.title} done! Reward added.`, 'good');
    this.cb.onChange();
    if (!this.battle && !this.sleepSeq) this.autosave();
  }
  oceanT = 0; flipTime = -1; boat = false; skate = false; runOn = false; boatMesh: THREE.Group | null = null; skateMesh: THREE.Group | null = null;
  farTiles = new Map<Biome | 'beach', THREE.InstancedMesh>(); farTileKey = '';
  updateFarTiles() {
    if (!this.flight) return;
    const ix = Math.round(this.player.position.x / CH), iz = Math.round(this.player.position.z / CH), key = `${ix},${iz}`;
    if (this.farTileKey === key) return;
    this.farTileKey = key;
    if (!this.farTiles.size) {
      const geom = new THREE.PlaneGeometry(CH + 0.4, CH + 0.4); geom.rotateX(-Math.PI / 2);
      const colors: Record<Biome | 'beach', string> = { ...GROUND, beach: '#f0dca0' };
      (Object.keys(colors) as (Biome | 'beach')[]).forEach(b => {
        const mesh = new THREE.InstancedMesh(geom, new THREE.MeshBasicMaterial({ color: colors[b], side: THREE.DoubleSide }), 550);
        mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = -2; this.scene.add(mesh); this.farTiles.set(b, mesh);
      });
    }
    const counts = new Map<Biome | 'beach', number>(), mx = new THREE.Matrix4();
    for (let dx = -11; dx <= 11; dx++) for (let dz = -11; dz <= 11; dz++) {
      const tx = ix + dx, tz = iz + dz, kind = biomeAt(tx * CH, tz * CH);
      const b: Biome | 'beach' = kind !== 'ocean' && beachChunk(tx, tz) ? 'beach' : kind;
      const count = counts.get(b) ?? 0;
      this.farTiles.get(b)!.setMatrixAt(count, mx.makeTranslation(tx * CH, -0.35, tz * CH));
      counts.set(b, count + 1);
    }
    this.farTiles.forEach((mesh, b) => { mesh.count = counts.get(b) ?? 0; mesh.instanceMatrix.needsUpdate = true; mesh.visible = true; });
  }
  nearOcean() { const p = this.player.position; for (let a = 0; a < 8; a++) for (const r of [2, 4, 6]) { const x = p.x + Math.cos(a * 0.785) * r, z = p.z + Math.sin(a * 0.785) * r; if (isWater(x, z) !== this.boat) return [x, z] as [number, number]; } return null; }
  setBoat(on: boolean) {
    this.boat = on; if (this.boatMesh) { this.player.remove(this.boatMesh); this.boatMesh = null; }
    if (on) { this.boatMesh = buildSurfboard(); this.player.add(this.boatMesh); this.boatMesh.position.y = 0.08; }
    else this.player.userData.emote = 0;
  }
  toggleBoat() {
    if (this.battle || this.fourth || this.fourthLobby || this.indoor || this.sleepSeq) return;
    const spot = this.nearOcean();
    if (!spot) { this.cb.onToast(this.boat ? 'Sail closer to land.' : 'Go to the ocean shore first.', 'info'); return; }
    if (this.skate) this.toggleSkate();
    const [x, z] = spot; const on = !this.boat; const ang = Math.atan2(x - this.player.position.x, z - this.player.position.z);
    this.player.position.set(x, 0, z); this.player.rotation.y = ang; this.setBoat(on); sfx('water'); this.burst(this.player.position.clone().setY(0.3), '#e8f8ff', 14, 3);
    if (!on && this.partner) this.partner.position.set(x - Math.sin(ang) * 1.5, 0, z - Math.cos(ang) * 1.5);
    this.cb.onToast(on ? '🏄 Surfing! Ride the sea currents.' : 'Back on land.', 'good'); this.cb.onChange();
  }
  toggleSkate() {
    if (this.battle || this.fourth || this.fourthLobby || this.indoor || this.boat || this.sleepSeq) return;
    this.skate = !this.skate; if (this.skateMesh) { this.player.remove(this.skateMesh); this.skateMesh = null; }
    if (this.skate) { this.skateMesh = buildSkate(); this.player.add(this.skateMesh); this.player.userData.body.position.y = 0.1; sfx('swing'); } else this.player.userData.emote = 0;
    this.cb.onChange();
  }
  // Keep the camera outside trees, houses and rocks (segment vs. boxes)
  occlude(from: THREE.Vector3, to: THREE.Vector3) {
    let tmin = 1; const d = to.clone().sub(from);
    const test = (c: { x0: number; x1: number; z0: number; z1: number; h?: number; e?: number }) => {
      if (!c.h) return; const e = c.e ?? 0.35; let t0 = -1e9, t1 = 1e9;
      const ax: [number, number, number, number][] = [[from.x, d.x, c.x0 - e, c.x1 + e], [from.y, d.y, -1, c.h + 0.5], [from.z, d.z, c.z0 - e, c.z1 + e]];
      for (const [o, dd, lo, hi] of ax) { if (Math.abs(dd) < 1e-6) { if (o < lo || o > hi) return; continue; } let a = (lo - o) / dd, b = (hi - o) / dd; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return; }
      if (t0 > 0.02 && t0 < tmin) tmin = t0;
    };
    const p = this.player.position; if (Math.abs(p.x) < 130 && p.z > -140 && p.z < 300) for (const c of this.world.colliders) test(c);
    for (const ch of this.nearChunks(p.x, p.z)) for (const c of ch.colliders) test(c);
    for (const c of this.campCol) test(c);
    return tmin;
  }
  getTrainer(id: string) { return TRAINERS[id] ?? this.genTrainers.get(id); }
  chunkAt(x: number, z: number) { return this.chunks.get(`${Math.round(x / CH)},${Math.round(z / CH)}`); }
  nearChunks(x: number, z: number) { const out: Chunk[] = []; const ix = Math.round(x / CH), iz = Math.round(z / CH); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const c = this.chunks.get(`${ix + dx},${iz + dz}`); if (c) out.push(c); } return out; }
  mapShapes() { const s: { k: string; x: number; z: number; w?: number; d?: number; r?: number; col: string }[] = []; this.chunks.forEach(c => s.push(...c.shapes)); return s; }
  nearWater(x: number, z: number) { if (Math.abs(z - 95) < 20 && inCore(x, z)) return true; return this.nearChunks(x, z).some(c => c.lakes.some(l => Math.hypot(l.x - x, l.z - z) < l.r + 18)); }
  inLake(x: number, z: number) { return this.nearChunks(x, z).some(c => c.lakes.some(l => Math.hypot(l.x - x, l.z - z) < l.r + 1)); }
  updateChunks() {
    if (this.indoor) return; const p = this.player.position; const ix = Math.round(p.x / CH), iz = Math.round(p.z / CH); const R = this.flight || this.settings.viewDist > 190 ? 3 : 2;
    for (const [k, c] of this.chunks) if (Math.abs(c.ix - ix) > R + 1 || Math.abs(c.iz - iz) > R + 1) {
      this.scene.remove(c.group); disposeChunk(c); this.chunks.delete(k);
      for (let i = this.npcs.length - 1; i >= 0; i--) if (this.npcs[i].chunk === k) { this.scene.remove(this.npcs[i].mesh); this.npcs.splice(i, 1); }
    }
    let best: [number, number] | null = null, bd = 1e9;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { if (this.chunks.has(`${ix + dx},${iz + dz}`)) continue; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [ix + dx, iz + dz]; } }
    if (!best) return;
    const c = buildChunk(best[0], best[1], id => !!this.save.flags['beat_' + id]); this.chunks.set(c.key, c); this.scene.add(c.group);
    for (const n of c.npcs) this.addNpc(n, c.key);
  }
  allSpots() { const s = [...this.coreSpots]; this.nearChunks(this.player.position.x, this.player.position.z).forEach(c => s.push(...c.spots)); if (this.camp && this.save.camp) { const [x, z] = this.save.camp; s.push({ x, z: z + 1.6, r: 2.0, kind: 'sleep', label: 'Sleep in tent' }, { x: x + 3.2, z: z + 3.35, r: 1.3, kind: 'sit', label: 'Sit by the fire', ry: Math.PI }, { x: x + 5.5, z: z + 1, r: 1.1, kind: 'sit', label: 'Sit on stump', ry: -Math.PI / 2 }, { x: x + 3.2, z: z + 1, r: 2.0, kind: 'cook', label: 'Cook food' }); } return s; }
  // ---------- jumping fish ----------
  fishes: { m: THREE.Group; t: number; dur: number; from: THREE.Vector3; dir: THREE.Vector3; h: number; active: boolean }[] = []; fishT = 1;
  anyWater(x: number, z: number) {
    if (inCore(x, z)) return (Math.abs(z - 95) < 2.4 && Math.abs(x) < 110 && Math.abs(x) > 3.5) || Math.hypot(x + 29, z + 27) < 3.8;
    if (this.nearChunks(x, z).some(c => c.lakes.some(l => Math.hypot(l.x - x, l.z - z) < l.r - 1) || c.waters.some(w => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1))) return true;
    return isWater(x, z) && isWater(x + 2, z) && isWater(x - 2, z);
  }
  updateFish(dt: number) {
    if (this.indoor || this.battle || this.fourth || this.fourthLobby) { this.fishes.forEach(f => { f.active = false; f.m.visible = false; }); return; }
    if (!this.fishes.length) { const cols: [string, string][] = [['#ff8a2a', '#ffffff'], ['#5ab0ff', '#e8f4ff'], ['#c0c8d0', '#ffffff'], ['#ffd23b', '#fff4c0'], ['#ff6aa0', '#ffe0ec'], ['#3a8a6a', '#d0f0e0']]; cols.forEach(([a, b]) => { const m = buildFish(a, b); m.visible = false; this.scene.add(m); this.fishes.push({ m, t: 0, dur: 1, from: new THREE.Vector3(), dir: new THREE.Vector3(), h: 1, active: false }); }); }
    this.fishT -= dt; const p = this.player.position;
    if (this.fishT <= 0) {
      this.fishT = 0.35 + Math.random() * 0.8;
      const f = this.fishes.find(x => !x.active);
      if (f) for (let tries = 0; tries < 6; tries++) {
        const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 22; const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (!this.anyWater(x, z)) continue;
        const da = Math.random() * Math.PI * 2; f.dir.set(Math.sin(da), 0, Math.cos(da)); if (!this.anyWater(x + f.dir.x * 2.5, z + f.dir.z * 2.5)) f.dir.negate();
        f.from.set(x, 0, z); f.t = 0; f.dur = 0.8 + Math.random() * 0.5; f.h = 0.9 + Math.random() * 1.1; f.active = true; f.m.visible = true; f.m.scale.setScalar(0.8 + Math.random() * 0.7); f.m.rotation.y = Math.atan2(f.dir.x, f.dir.z);
        this.splash(f.from); break;
      }
    }
    for (const f of this.fishes) {
      if (!f.active) continue; f.t += dt; const k = f.t / f.dur;
      if (k >= 1) { f.active = false; f.m.visible = false; this.splash(f.from.clone().addScaledVector(f.dir, 2.4)); continue; }
      f.m.position.copy(f.from).addScaledVector(f.dir, k * 2.4); f.m.position.y = Math.sin(k * Math.PI) * f.h - 0.1;
      f.m.rotation.x = (k - 0.5) * 2.2; f.m.rotation.z = Math.sin(f.t * 30) * 0.15;
    }
  }
  splash(at: THREE.Vector3) { if (at.distanceTo(this.player.position) < 30) { this.burst(at.clone().setY(0.15), '#e8f8ff', 7, 3); this.ring(at, '#e8f8ff', 1.2); } }
  // ---------- NPC daily jobs ----------
  npcWork(n: NPC, dt: number, d: number) {
    const u = n.mesh.userData as Record<string, unknown> & { emote: number; emoteKind: number };
    if (n.trainer || n.id.startsWith('trainer')) return false;
    const role = n.role ?? '';
    if (!n.home) { n.home = n.pos.clone(); const acts = role === 'dancer' ? ['dance'] : role === 'student' ? ['sit'] : role === 'kid' ? ['walk'] : ['vendor', 'chef', 'commander', 'coach', 'teacher'].includes(role) ? ['stand'] : n.id === 'elder' ? ['stretch'] : n.id.startsWith('shop') ? ['sweep'] : n.id.startsWith('healer') || n.id === 'healer' || role === 'nurse' ? ['water'] : n.id === 'ilsa' ? ['walk'] : ['walk', 'sweep', 'chop', 'water', 'walk', 'stretch']; let h = 0; for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) | 0; n.act = acts[Math.abs(h) % acts.length]; n.wt = 0; }
    // at night ordinary villagers walk home and go to sleep
    const awake = ['vendor', 'chef', 'commander', 'coach', 'nurse', 'dancer'].includes(role) || n.id === 'shop' || n.id === 'healer';
    if (this.isNight() && !awake && d > 7) {
      if (!n.bed) { let h2 = 0; for (const ch of n.id) h2 = (h2 * 17 + ch.charCodeAt(0)) | 0; const a = (Math.abs(h2) % 628) / 100; n.bed = n.home!.clone().add(new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7)); }
      const dv = n.bed.clone().sub(n.pos).setY(0); u.emote = 0; if (n.tool) n.tool.visible = false; n.sleepT = (n.sleepT ?? 0) + dt;
      if (dv.length() > 0.4 && n.sleepT < 14) { dv.normalize(); n.pos.addScaledVector(dv, 1.6 * dt); this.pushOnly(n.pos); n.mesh.rotation.y = Math.atan2(dv.x, dv.z); animateHuman(n.mesh, dt, 2); } else { n.asleep = true; n.mesh.visible = false; }
      return true;
    }
    if (n.act === 'stand') return false;
    if (n.act === 'dance') { u.emote = 0.5; u.emoteKind = 3; animateHuman(n.mesh, dt, 0); return true; }
    if (n.act === 'sit') { u.emote = 0.5; u.emoteKind = 14; n.mesh.position.y = 0.12; animateHuman(n.mesh, dt, 0); return true; }
    const near = d < 6;
    if (near) { if (n.tool) n.tool.visible = false; u.emote = 0; return false; }
    if (n.tool) n.tool.visible = true;
    const tk = ({ sweep: 'broom', chop: 'wood', water: 'can' } as Record<string, string>)[n.act!];
    if (tk && !n.tool) { n.tool = buildTool(tk); (n.mesh.userData.arms[1].el as THREE.Object3D).add(n.tool); }
    if (n.act === 'walk') {
      n.wt! -= dt; if (n.wt! <= 0 || !n.target) { n.target = n.home!.clone().add(new THREE.Vector3((Math.random() - 0.5) * 9, 0, (Math.random() - 0.5) * 9)); n.wt = 4 + Math.random() * 4; }
      const dv = n.target.clone().sub(n.pos).setY(0); u.emote = 0;
      if (dv.length() > 0.3) { dv.normalize(); n.pos.addScaledVector(dv, 1.4 * dt); this.pushOnly(n.pos); let df = Math.atan2(dv.x, dv.z) - n.mesh.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); n.mesh.rotation.y += df * Math.min(1, dt * 6); animateHuman(n.mesh, dt, 2); }
      else animateHuman(n.mesh, dt, 0);
      return true;
    }
    u.emote = 0.5; u.emoteKind = n.act === 'sweep' ? 12 : n.act === 'chop' ? 6 : n.act === 'water' ? 7 : 13;
    if (n.act === 'chop' && Math.random() < dt * 1.2) this.burst(n.pos.clone().add(new THREE.Vector3(Math.sin(n.mesh.rotation.y) * 0.8, 0.5, Math.cos(n.mesh.rotation.y) * 0.8)), '#c8a070', 2, 2);
    if (n.act === 'water' && Math.random() < dt * 3) this.burst(n.pos.clone().add(new THREE.Vector3(Math.sin(n.mesh.rotation.y) * 0.7, 0.6, Math.cos(n.mesh.rotation.y) * 0.7)), '#7ad0ff', 1, 1);
    if (n.act === 'sweep' && Math.random() < dt * 2) this.burst(n.pos.clone().add(new THREE.Vector3(Math.sin(n.mesh.rotation.y) * 0.9, 0.1, Math.cos(n.mesh.rotation.y) * 0.9)), '#d8c8a0', 1, 1);
    animateHuman(n.mesh, dt, 0); return true;
  }
  pushOnly(p: THREE.Vector3) { if (Math.abs(p.x) < 130 && p.z > -140 && p.z < 300) for (const c of this.world.colliders) this.push(p, c, 0.4); for (const ch of this.nearChunks(p.x, p.z)) for (const c of ch.colliders) this.push(p, c, 0.4); }
  campCol: { x0: number; x1: number; z0: number; z1: number; h?: number; e?: number }[] = [];
  makeCamp(x: number, z: number, fence = false) {
    if (this.camp) this.scene.remove(this.camp);
    this.camp = buildCamp(); this.camp.position.set(x, 0, z); this.scene.add(this.camp); this.save.camp = [x, z]; this.save.campFence = fence;
    this.campCol = [{ x0: x - 1.8, x1: x + 1.8, z0: z - 2.1, z1: z + 1.5, h: 2.6, e: 0.15 }, { x0: x + 2.7, x1: x + 3.7, z0: z + 0.5, z1: z + 1.5 }, { x0: x + 2.3, x1: x + 4.1, z0: z + 2.5, z1: z + 3.0 }];
    if (fence) {
      const fg = new THREE.Group(); const fx = 1.5, fz = 0.6, R = 6.5; const N = 28;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) { pts.push([NaN, NaN]); continue; } pts.push([fx + Math.cos(a) * R, fz + Math.sin(a) * R]); }
      pts.forEach(([px, pz], i) => {
        if (isNaN(px)) return;
        part('box', tmat('#9a6a3a'), [0.2, 1.2, 0.2], [px, 0.6, pz], [0, 0, 0], fg); part('cone', tmat('#9a6a3a'), [0.14, 0.2, 0.14], [px, 1.3, pz], [0, Math.PI / 4, 0], fg);
        const nx = pts[i + 1]; if (nx && !isNaN(nx[0])) { const mx = (px + nx[0]) / 2, mz = (pz + nx[1]) / 2, len = Math.hypot(nx[0] - px, nx[1] - pz), ang = Math.atan2(nx[0] - px, nx[1] - pz);
          [0.85, 0.45].forEach(y => part('box', tmat('#b07a44'), [0.08, 0.13, len + 0.1], [mx, y, mz], [0, ang, 0], fg));
          this.campCol.push({ x0: x + mx - 0.45, x1: x + mx + 0.45, z0: z + mz - 0.45, z1: z + mz + 0.45 }); }
      });
      // gate posts with a little sign
      [-1, 1].forEach(sd => { const a = Math.PI / 2 + sd * 0.42; part('box', tmat('#7a4a2a'), [0.26, 1.7, 0.26], [fx + Math.cos(a) * R, 0.85, fz + Math.sin(a) * R], [0, 0, 0], fg); });
      part('box', tmat('#c89a5a'), [1.1, 0.4, 0.06], [fx + Math.cos(Math.PI / 2 + 0.42) * R + 0.5, 1.45, fz + R - 0.05], [0, 0, 0], fg);
      addOutline(fg, 0.02); this.camp.add(fg);
    }
  }
  inSafeCamp() { if (!this.save.camp || !this.save.campFence) return false; const [x, z] = this.save.camp; return Math.hypot(this.player.position.x - x - 1.5, this.player.position.z - z - 0.6) < 7.5; }
  canCamp() { const p = this.player.position; return !this.indoor && !this.battle && !this.fourth && !this.fourthLobby && !townAt(p.x, p.z, 40) && !(inCore(p.x, p.z) && p.z < 34) && !this.inLake(p.x, p.z); }
  setCamp(fence = false) { if (!this.canCamp()) { this.cb.onToast("You can't camp here.", 'bad'); return; } const p = this.player.position; const f = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y)); this.makeCamp(p.x + f.x * 4.5 - 1.5, p.z + f.z * 4.5 - 0.6, fence); if (fence) this.cb.onToast('🪵 Fence built! Wild pets can\'t bother you inside.', 'good'); this.player.userData.emote = 1.6; this.player.userData.emoteKind = 8; this.reactLock = 1.6; sfx('pickup'); this.cb.onToast('⛺ Camp is ready!', 'good'); this.daily('camp'); this.cb.onChange(); }
  work(s: Spot) {
    if (this.reactLock > 0) return;
    const items = this.save.items; const add = (k: string, n = 1) => (items[k] = (items[k] || 0) + n);
    if (s.kind === 'cook') { this.cb.onInteract('cook'); return; }
    if (s.kind === 'sleep') { this.sleep(); return; }
    const dur = s.kind === 'fish' ? 2.8 : 2.0; this.reactLock = dur; const hu = this.player.userData;
    hu.emote = dur; hu.emoteKind = s.kind === 'wood' ? 6 : s.kind === 'fish' ? 7 : 8;
    const a = Math.atan2(s.x - this.player.position.x, s.z - this.player.position.z); this.player.rotation.y = a;
    if (this.tool) this.tool.parent?.remove(this.tool); this.tool = buildTool(s.kind); hu.arms[1].el.add(this.tool);
    const tick = s.kind === 'wood' ? () => { sfx('hit'); this.burst(new THREE.Vector3(s.x, 0.8, s.z), '#c8a070', 5, 3); } : s.kind === 'water' ? () => sfx('water') : () => {};
    for (let i = 1; i < 4; i++) this.later(i * dur / 4, tick);
    this.later(dur, () => {
      if (this.tool) { this.tool.parent?.remove(this.tool); this.tool = null; }
      const at = this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0));
      if (s.kind === 'water') { add('water'); this.emoji(at, '💧', 2); this.cb.onToast('Got Fresh Water! 💧', 'good'); this.daily('water'); }
      if (s.kind === 'wood') { const n = 1 + (Math.random() < 0.3 ? 1 : 0); add('wood', n); this.emoji(at, '🪵', n); this.cb.onToast(`Got ${n} Firewood! 🪵`, 'good'); this.daily('wood'); }
      if (s.kind === 'fish') { const r = Math.random(); if (r < 0.07) { add('goldfish'); this.emoji(at, '🐠', 3); this.cb.onToast('WOW! A rare Golden Fish! 🐠', 'good'); this.daily('fish'); } else if (r < 0.7) { add('fish'); this.emoji(at, '🐟', 2); this.cb.onToast('You caught a fish! 🐟', 'good'); this.daily('fish'); } else { this.emoji(at, '💨', 1); this.cb.onToast('It got away...', 'info'); } this.splash(new THREE.Vector3(s.x, 0, s.z)); }
      this.save.works = (this.save.works || 0) + 1; if (this.save.works >= 10) this.ach('worker'); this.save.money += 3; sfx('coin'); this.cb.onChange();
    });
  }
  sleep() { this.startSleep(this.indoor ? 'bed' : 'tent'); }
  sleepSeq: { kind: 'tent' | 'bed'; stage: number; st: number; z: number } | null = null; dimK = 1;
  warp: { t: number; done: boolean } | null = null;
  startSleep(kind: 'tent' | 'bed') { if (this.sleepSeq || this.battle || (kind === 'tent' && !this.camp)) return; this.firstPerson = false; this.player.visible = true; this.daily('rest'); this.sleepSeq = { kind, stage: 0, st: 0, z: 0 }; this.reactLock = 99; sfx('ui'); }
  goHome() {
    if (this.battle || this.fourth || this.fourthLobby || this.sleepSeq || this.warp || this.trans) return;
    this.warp = { t: 0, done: false }; this.player.userData.emote = 1; this.player.userData.emoteKind = 1; sfx('evolve');
  }
  updateWarp(dt: number) {
    const w = this.warp!; w.t += dt; const p = this.player.position;
    if (w.t < 0.6) { this.hud.fade = w.t / 0.6; if (Math.random() < 0.6) this.burst(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 2, (Math.random() - 0.5) * 1.5)), ['#ffe066', '#7ad0ff', '#ffffff'][Math.floor(Math.random() * 3)], 2, 2); animateHuman(this.player, dt, 0); }
    else if (!w.done) {
      w.done = true; if (this.indoor) { this.indoor = false; this.clearHomePets(); }
      this.teleport(-18, -7.4); this.player.rotation.y = Math.PI; this.yaw = 0; this.pitch = 0.3; this.wilds.forEach(x => this.scene.remove(x.mesh)); this.wilds = [];
      this.cb.onToast('🏠 Back in Embervale!', 'good'); this.cb.onChange();
    } else { this.hud.fade = Math.max(0, 1 - (w.t - 0.6) / 0.6); if (Math.random() < 0.4) this.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe066', 2, 3); animateHuman(this.player, dt, 0); if (w.t > 1.2) { this.warp = null; this.hud.fade = 0; } }
    this.camFollowSnap = w.t < 0.65 && w.done;
  }
  updateSleep(dt: number) {
    const q = this.sleepSeq!; q.st += dt; const pl = this.player, hu = pl.userData;
    const next = () => { q.stage++; q.st = 0; };
    const walkTo = (x: number, z: number) => { const d = new THREE.Vector3(x - pl.position.x, 0, z - pl.position.z); const L = d.length(); if (L > 0.08 && q.st < 4) { d.normalize(); pl.position.addScaledVector(d, Math.min(L, 3 * dt)); pl.rotation.y = Math.atan2(d.x, d.z); animateHuman(pl, dt, 3); return false; } return true; };
    const zzz = (at: THREE.Vector3) => { if (Math.random() < dt * 1.6) this.emoji(at, '💤', 1); };
    const heal = () => { this.save.team.forEach(t => { t.fainted = false; t.hp = stats(t).hp; }); if (this.isNight() || this.save.time > 18) { if (this.save.time > 7) this.save.day++; this.save.time = 7; } this.refreshPartner(); sfx('level'); };
    const pm = this.partner;
    if (q.kind === 'tent') {
      const [cx, cz] = this.save.camp!; const flaps = this.camp!.userData.flaps as THREE.Group[];
      const door = (o: number) => flaps.forEach((f, i) => (f.rotation.y = (i === 0 ? -1 : 1) * o * 1.4));
      if (pm && q.stage >= 1) { const spot = new THREE.Vector3(cx + 2.1, 0, cz + 2.5); const d = spot.clone().sub(pm.position).setY(0); if (d.length() > 0.1 && !pm.userData.sleeping) { pm.position.addScaledVector(d.normalize(), Math.min(d.length(), 2.5 * dt)); pm.rotation.y = Math.atan2(d.x, d.z); animateCreature(pm, dt, true); } else { pm.userData.sleeping = q.stage >= 2 && q.stage <= 4; animateCreature(pm, dt, false); } }
      else if (pm) animateCreature(pm, dt, false);
      switch (q.stage) {
        case 0: if (walkTo(cx, cz + 3)) next(); break;
        case 1: { pl.rotation.y = Math.PI; const k = Math.min(1, q.st / 0.5); door(k); hu.emote = 1; hu.emoteKind = 8; if (q.st > 0.4) pl.position.z = cz + 3 - Math.min(1, (q.st - 0.4) / 0.8) * 1.6; animateHuman(pl, dt, 0); if (q.st > 1.2) { pl.visible = false; next(); } break; }
        case 2: door(Math.max(0, 1 - q.st / 0.4)); if (q.st > 0.5) next(); break;
        case 3: zzz(new THREE.Vector3(cx, 2.8, cz + 0.4)); if (pm) zzz(pm.position.clone().add(new THREE.Vector3(0, 1, 0))); this.save.time = (this.save.time + dt * 1.8) % 24; this.yaw += dt * 0.35; this.pitch = 0.35; this.dimK = 0.6; if (q.st > 4.5) { heal(); next(); } break;
        case 4: { this.dimK = 1; door(Math.min(1, q.st / 0.4)); if (q.st > 0.4) { pl.visible = true; pl.rotation.y = 0; hu.emote = 1; hu.emoteKind = 8; pl.position.z = cz + 1.4 + Math.min(1, (q.st - 0.4) / 0.8) * 1.8; animateHuman(pl, dt, 0); } if (q.st > 1.3) { if (pm) pm.userData.sleeping = false; next(); } break; }
        case 5: door(Math.max(0, 1 - q.st / 0.5)); hu.emote = 1; hu.emoteKind = 1; animateHuman(pl, dt, 0); if (q.st > 1.2) next(); break;
        default: this.endSleep(); return;
      }
    } else {
      const bx = IX - 3.3, bz = -3.9;
      if (pm) animateCreature(pm, dt, false);
      switch (q.stage) {
        case 0: if (walkTo(bx, bz)) next(); break;
        case 1: pl.position.set(IX - 5, IY + 0.93, -2.4); pl.rotation.set(-Math.PI / 2, 0, 0); hu.emote = 1; hu.emoteKind = 9; animateHuman(pl, dt, 0); if (pm) { pm.position.set(IX - 3.4, IY, -3); pm.userData.sleeping = true; } next(); break;
        case 2: animateHuman(pl, dt, 0); zzz(new THREE.Vector3(IX - 5, IY + 1.6, -4.2)); this.dimK = Math.max(0.25, 1 - q.st); this.save.time = (this.save.time + dt * 1.8) % 24; this.yaw = 0.5; this.pitch = 0.75; if (q.st > 4.2) { heal(); next(); } break;
        case 3: this.dimK = Math.min(1, this.dimK + dt); hu.emote = 0; pl.rotation.set(0, Math.PI / 2, 0); pl.position.set(bx, IY, bz); if (pm) pm.userData.sleeping = false; hu.emote = 1.2; hu.emoteKind = 1; next(); break;
        case 4: animateHuman(pl, dt, 0); if (q.st > 1.2) next(); break;
        default: this.endSleep(); return;
      }
    }
  }
  endSleep() {
    const wasTent = this.sleepSeq?.kind === 'tent';
    this.sleepSeq = null; this.reactLock = 0; this.dimK = 1; this.player.visible = true; this.player.userData.emote = 0; this.player.rotation.x = 0; this.player.rotation.z = 0;
    // put the camera in front of the tent so the hero is not hidden behind it
    if (wasTent && this.save.camp) { const [cx, cz] = this.save.camp; this.player.position.set(cx, 0, cz + 3.4); this.player.rotation.y = 0; this.yaw = 0.35; this.pitch = 0.35; this.camFollowSnap = true; }
    if (this.partner) this.partner.userData.sleeping = false;
    this.cb.onToast('☀️ Good morning! Everyone is full of energy!', 'good'); this.cb.onChange(); this.autosave();
  }

  activatePortal() {
    if (this.save.flags.portalAwake) return true;
    if ((this.save.items.diamond || 0) < 10) { this.cb.onToast('The seal needs ten diamonds from crystal mines.', 'bad'); return false; }
    this.save.items.diamond -= 10;
    this.save.flags.portalAwake = true;
    this.world.portalSeal.visible = false;
    this.world.portalCore.visible = true;
    this.burst(this.world.portal.position.clone().add(new THREE.Vector3(0, 3, 0)), '#c5abfa', 48, 8);
    this.ach('fourth'); sfx('evolve');
    this.cb.onToast('The only portal awakens. You must go alone.', 'good'); this.cb.onChange(); this.autosave();
    return true;
  }

  enterFourthLobby() {
    if (!this.save.flags.portalAwake || this.indoor || this.battle || this.fourth || this.fourthLobby || this.flight || this.sleepSeq) return false;
    if (Math.hypot(this.player.position.x - PORTAL_POS.x, this.player.position.z - PORTAL_POS.z) > 7.5) return false;
    if (this.skate) this.toggleSkate();
    this.returnPos = this.player.position.clone(); this.save.pos = [this.returnPos.x, this.returnPos.z];
    this.runOn = false; this.sitting = false; this.releaseInput(); this.firstPerson = false;
    this.player.visible = true;
    if (this.partner) this.partner.visible = false;
    this.wilds.forEach(w => { w.mesh.visible = false; });
    if (!this.fourthWorld) this.fourthWorld = buildFourthWorld(this.scene);
    this.fourthWorld.group.visible = true;
    this.fourthLobby = true;
    this.player.position.set(0, FOURTH_Y, -13); this.player.rotation.set(0, 0, 0);
    this.yaw = Math.PI; this.pitch = 0.33; this.camFollowSnap = true;
    this.area = 'Fourth Dimension';
    this.world.sky.visible = false;
    sfx('shadow'); this.cb.onChange();
    return true;
  }

  startFourthDuel(weapon: WeaponKind) {
    if (!this.fourthLobby || !this.fourthWorld || this.fourth) return false;
    this.fourth = new FourthDuel(this, this.fourthWorld, weapon);
    this.fourthLobby = false;
    playMusic('boss'); sfx('crit'); this.cb.onChange();
    return true;
  }

  retryFourth() {
    const duel = this.fourth;
    if (!duel || duel.phase === 'duel') return;
    if (duel.phase === 'won') {
      const weapon = duel.weapon;
      duel.dispose();
      this.fourth = new FourthDuel(this, this.fourthWorld!, weapon);
      this.player.position.set(0, FOURTH_Y, -13);
    } else duel.retry();
    this.releaseInput(); this.camFollowSnap = true; this.cb.onChange();
  }

  exitFourth() {
    if (!this.fourth && !this.fourthLobby) return;
    this.fourth?.dispose(); this.fourth = null; this.fourthLobby = false;
    if (this.fourthWorld) this.fourthWorld.group.visible = false;
    this.combatFx.clear(); this.releaseInput();
    this.player.position.set(PORTAL_POS.x - 4.2, 0, PORTAL_POS.z);
    this.player.rotation.set(0, Math.PI / 2, 0);
    this.player.userData.emote = 0;
    this.yaw = this.player.rotation.y + Math.PI; this.pitch = 0.34; this.camFollowSnap = true;
    this.world.sky.visible = true;
    if (this.partner) { this.partner.visible = true; this.partner.position.copy(this.player.position).add(new THREE.Vector3(-1.5, 0, 1)); }
    this.returnPos = null;
    this.area = 'Embervale Outskirts';
    sfx('shadow'); this.cb.onChange(); this.autosave();
  }

  constructor(private canvas: HTMLCanvasElement, public save: SaveData, public settings: Settings, public cb: Callbacks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.aa, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = settings.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = true;
    syncDaily(this.save);
    this.combatFx = new CombatVfx(this.scene);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
    this.hud = { mode: 'explore', area: '', time: 0, weather: '', prompt: '', abilities: [], enemyLeft: 0, bubble: '', fps: 60, pod: '', capture: '', switchCd: 0, dodgeCd: 0, pos: [0, 0], yaw: 0, night: false, fade: 0, indoor: false, facing: 0, count: 0, boat: false, skate: false, run: false, ocean: false, flying: false, festivals: [], sitting: false, bad: '', firstPerson: false, trainerHealth: 100, trainerHunger: 100 };
    this.scene.fog = new THREE.Fog('#d4efff', 95, 360);
    this.hemi = new THREE.HemisphereLight('#e8f4ff', '#7a9a5a', 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4d8', 2.0); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.00018; this.sun.shadow.normalBias = 0.025; this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 220; this.scene.add(this.sun, this.sun.target);
    this.world = buildWorld(this.scene);
    this.buildAdventureLandmarks();
    this.buildPhysicalHomestead();
    const well = buildWell(); well.position.set(12, 0, -3); this.scene.add(well); this.world.colliders.push({ x0: 10.8, x1: 13.2, z0: -4.2, z1: -1.8 });
    this.coreSpots.push({ x: 12, z: -3, r: 2.6, kind: 'water', label: 'Fill water' }, { x: -29, z: -27, r: 8, kind: 'fish', label: 'Go fishing' });
    [[-30, 6], [30, -4], [-25, 42], [26, 72], [-28, 120]].forEach(([x, z]) => { const s = buildStump(); s.position.set(x, 0, z); this.scene.add(s); this.world.colliders.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }); this.coreSpots.push({ x, z, r: 2, kind: 'wood', label: 'Chop wood' }); });
    [-14, -8, 8, 14, -24, 24].forEach(x => this.coreSpots.push({ x, z: x % 2 ? 90.5 : 99.5, r: 2.6, kind: 'fish', label: 'Go fishing' }));
    if (save.camp) this.makeCamp(save.camp[0], save.camp[1], !!save.campFence);
    const rg = new THREE.BufferGeometry(); const arr = new Float32Array(2400 * 3); for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 60; rg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#aac8ff', size: 0.12, transparent: true, opacity: 0.7 })); this.rain.visible = false; this.rain.frustumCulled = false; this.scene.add(this.rain);
    this.buildNPCs(); this.buildPools(); this.resize();
    this.player = buildHuman(save.look); this.scene.add(this.player);
    const [sx, sz] = save.pos;
    // Keep exact world coordinates: the separate home room never writes to save.pos.
    this.player.position.set(sx, 0, sz);
    this.refreshPartner(); this.bind(); this.applySettings(settings);
    if (isWater(this.player.position.x, this.player.position.z)) this.setBoat(true);
    // post-processing (bloom + color grade + vignette)
    try {
      this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.12, 0.42, 0.88));
      this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade); this.composer.addPass(new OutputPass()); this.resize();
    } catch { this.composer = undefined; }
    // stars, moon and sun disc on the sky dome
    const sg = new THREE.BufferGeometry(); const spos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const y = Math.random(), th = Math.random() * 6.28, rr = Math.sqrt(1 - y * y); spos[i * 3] = Math.cos(th) * rr * 470; spos[i * 3 + 1] = y * 470; spos[i * 3 + 2] = Math.sin(th) * rr * 470; }
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.world.sky.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff6dc', fog: false })); this.world.sky.add(this.moon);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff2b8', fog: false })); this.world.sky.add(this.sunDisc);
    // Embervale food shop
    const coreCtx: Ctx = { gr: new THREE.Group(), cl: this.world.colliders, spots: this.coreSpots, npcs: [], shapes: [], anims: this.coreAnims, balls: [], zones: [], waters: [], lamps: this.world.lampMats, key: 'core', rnd: Math.random, look: k => randLook(k + 7), floors: this.world.floors };
    foodShop(coreCtx, -28, 23); this.scene.add(coreCtx.gr); coreCtx.npcs.forEach(n => this.addNpc(n as NPCSpec, ''));
    this.loop();
  }

  // ---------- input ----------
  releaseInput = () => { this.keys.clear(); this.pressed.clear(); this.joy = [0, 0]; this.dragging = false; };
  vis = () => { if (document.hidden) this.releaseInput(); };
  bind() {
    window.addEventListener('blur', this.releaseInput); document.addEventListener('visibilitychange', this.vis);
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
    this.canvas.addEventListener('pointerdown', this.pd); window.addEventListener('pointerup', this.pu); window.addEventListener('pointermove', this.pm);
    this.canvas.addEventListener('wheel', this.wh, { passive: true }); this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  dispose() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.fourth?.dispose(); this.fourth = null;
    this.combatFx.clear();
    window.removeEventListener('blur', this.releaseInput); document.removeEventListener('visibilitychange', this.vis);
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    window.removeEventListener('pointerup', this.pu); window.removeEventListener('pointermove', this.pm); this.renderer.dispose();
  }
  resize = () => { const w = window.innerWidth, h = window.innerHeight, pr = Math.min(2, window.devicePixelRatio) * this.settings.resScale; this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); } };
  norm(k: string) { return k === ' ' ? ' ' : k.toLowerCase(); }
  kd = (e: KeyboardEvent) => { const k = this.norm(e.key); if (k === 'tab') e.preventDefault(); if (this.paused) return; if (!this.keys.has(k)) this.pressed.add(k); this.keys.add(k); };
  ku = (e: KeyboardEvent) => { this.keys.delete(this.norm(e.key)); };
  pd = (e: PointerEvent) => { this.dragging = true; this.lastPtr = [e.clientX, e.clientY]; if ((this.battle || this.fourth) && !this.paused) { if (e.button === 0 && e.pointerType === 'mouse') this.pressed.add('__lmb'); if (e.button === 2) this.pressed.add('__rmb'); } };
  pu = () => { this.dragging = false; };
  pm = (e: PointerEvent) => { if (!this.dragging || this.paused) return; const dx = e.clientX - this.lastPtr[0], dy = e.clientY - this.lastPtr[1]; this.lastPtr = [e.clientX, e.clientY]; this.yaw -= dx * 0.005 * this.settings.sens; this.pitch = clamp(this.pitch + dy * 0.004 * this.settings.sens, -0.75, 1.25); this.rotated += Math.abs(dx); };
  wh = (e: WheelEvent) => { this.dist = clamp(this.dist + e.deltaY * 0.01, 4, 16); };
  act(a: string) { const k = this.settings.keys[a]; return this.pressed.has(k) || (a === 'light' && this.pressed.has('__lmb')) || (a === 'heavy' && this.pressed.has('__rmb')) || this.pressed.has('__pad_' + a); }
  held(a: string) { return this.keys.has(this.settings.keys[a]) || this.keys.has('__padh_' + a); }
  tap(a: string) { if (this.paused) return; if (a === 'interact') this.pressed.add(this.settings.keys.interact); else this.pressed.add('__pad_' + a); if (a === 'block' && this.battle) this.battle.me.blockT = this.clock.elapsedTime; }
  applySettings(s: Settings) { this.settings = s; this.renderer.shadowMap.enabled = s.shadows; this.sun.castShadow = s.shadows; this.resize(); }

  buildNPCs() {
    const mk = (id: string, name: string, x: number, z: number, look: Parameters<typeof buildHuman>[0], visible: () => boolean = () => true, trainer?: string) => {
      const m = buildHuman(look); m.position.set(x, 0, z); this.scene.add(m); this.npcs.push({ id, name, mesh: m, pos: m.position, visible, trainer });
    };
    const f = this.save.flags;
    mk('elder', 'Elder Wren', 0, -21.5, { skin: '#f0c8a0', hair: 'bun', hairColor: '#e8e8f0', top: '#6a4a8a', bottom: '#3a2a4a', shoes: '#222', acc: 'glasses', pack: 'none', eye: '#6a5a8a' });
    mk('shop', 'Tova the Shopkeeper', 18, -9.5, { skin: '#d8a070', hair: 'bob', hairColor: '#3a1a1a', top: '#3d7be0', bottom: '#f0f0f0', shoes: '#333', acc: 'hat', pack: 'none' });
    mk('ilsa', 'Professor Ilsa', -6, 4, { skin: '#f6dcc8', hair: 'long', hairColor: '#d0402b', top: '#ffffff', bottom: '#3a3a5a', shoes: '#222', acc: 'goggles', pack: 'satchel', eye: '#2b8a5a' });
    mk('healer', 'Nurse Oona', 10, 24, { skin: '#9a6a4a', hair: 'pony', hairColor: '#1a1a1a', top: '#ff9ab0', bottom: '#ffffff', shoes: '#ffffff', acc: 'none', pack: 'none' });
    mk('kid', 'Little Fen', 14, 4, { skin: '#f6d0b0', hair: 'spiky', hairColor: '#f0c040', top: '#5ac04a', bottom: '#3a5a8a', shoes: '#c03b2b', acc: 'none', pack: 'none', eye: '#3a7ad0' });
    mk('trainer:pip', 'Pip', 10, 68, { skin: '#f6dcc8', hair: 'pony', hairColor: '#ff7ac0', top: '#ff9ad0', bottom: '#ffffff', shoes: '#c03b2b', acc: 'hat', pack: 'satchel', eye: '#d04a8a' }, () => !f.beat_pip, 'pip');
    mk('trainer:bram', 'Bram', -12, 108, { skin: '#8a5a3a', hair: 'buzz', hairColor: '#333', top: '#8a6a3a', bottom: '#4a3a2a', shoes: '#3a2a1a', acc: 'hat', pack: 'big' }, () => !f.beat_bram, 'bram');
    mk('trainer:kael', 'Kael', 0, 160, { body: 'male', skin: '#f0c8a0', hair: 'spiky', hairColor: '#3b6aff', top: '#1a1a2a', bottom: '#1a1a2a', shoes: '#ffffff', acc: 'none', pack: 'none', eye: '#3b6aff', coat: 'wave', coatA: '#bfe0ff', coatB: '#2a4ab0' }, () => !!this.save.quests.m2.done && !f.beat_kael, 'kael');
    mk('kael_post', 'Kael', 5, 26, { skin: '#f0c8a0', hair: 'spiky', hairColor: '#3b6aff', top: '#1a1a2a', bottom: '#3b6aff', shoes: '#ffffff', acc: 'scarf', pack: 'satchel', eye: '#3b6aff' }, () => !!f.beat_morrow);
    mk('trainer:morrow', 'Morrow', 0, 210, { skin: '#e0e0e8', hair: 'long', hairColor: '#1a1a1a', top: '#2a1a40', bottom: '#1a1a1a', shoes: '#9a2bff', acc: 'none', pack: 'none', eye: '#b04aff', coat: 'arrow', coatA: '#2a1a40', coatB: '#9a2bff' }, () => !f.beat_morrow, 'morrow');
    mk('grunt', 'Masked Guard', -4, 186, { skin: '#d0b090', hair: 'buzz', hairColor: '#111', top: '#2a1a40', bottom: '#2a1a40', shoes: '#9a2bff', acc: 'goggles', pack: 'none' }, () => !f.beat_morrow);
  }
  buildPools() {
    for (let i = 0; i < 24; i++) { const m = new THREE.Group(); m.visible = false; this.scene.add(m); this.projs.push({ mesh: m, vel: new THREE.Vector3(), owner: null, ab: null, life: 0, active: false, mult: 1 }); }
    const sg = new THREE.OctahedronGeometry(0.12);
    for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#fff' })); m.visible = false; this.scene.add(m); this.parts.push({ mesh: m, vel: new THREE.Vector3(), life: 0, active: false }); }
  }
  burst(p: THREE.Vector3, color: string, n = 12, sp = 6) {
    if (this.settings.effects === 'Low') n = Math.ceil(n / 3);
    for (const q of this.parts) { if (n <= 0) break; if (q.active) continue; q.active = true; q.life = 0.6; q.mesh.visible = true; q.mesh.position.copy(p); (q.mesh.material as THREE.MeshBasicMaterial).color.set(color); q.vel.set((Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp); n--; }
  }
  ring(p: THREE.Vector3, color: string, max: number) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })); m.rotation.x = Math.PI / 2; m.position.copy(p).setY(0.4); this.scene.add(m); this.rings.push({ mesh: m, t: 0, max }); }
  emoji(p: THREE.Vector3, e: string, n = 4) { for (let i = 0; i < n; i++) { const s = emojiSprite(e); s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.4, (Math.random() - 0.5) * 0.8)); s.scale.setScalar(0.55); this.scene.add(s); this.sprites.push({ s, vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.4 + Math.random(), (Math.random() - 0.5) * 1.2), life: 1.6 + i * 0.15 }); } }

  // ---------- partner ----------
  leadInst() { return this.save.team.find(c => !c.fainted && c.hp > 0) ?? null; }
  refreshPartner() {
    const ov = this.override ? this.save.team.find(c => c.uid === this.override!.uid) : undefined;
    const lead = ov ?? this.leadInst();
    if (this.partner && (!lead || lead.uid !== this.partnerUid || this.partner.userData.sp !== lead.sp || (this.partner.userData.acc || '') !== (lead.acc || ''))) { this.scene.remove(this.partner); this.partner = null; }
    if (lead && !this.partner) { this.partner = buildCreature(lead.sp, lead.acc); this.partner.visible = !this.flight; this.partner.position.copy(this.player.position).add(new THREE.Vector3(1.5, 0, -1.5)); this.scene.add(this.partner); this.partnerUid = lead.uid; }
  }
  rebuildPlayer() { const p = this.player.position.clone(), r = this.player.rotation.y; this.scene.remove(this.player); this.player = buildHuman(this.save.look); this.player.position.copy(p); this.player.rotation.y = r; this.scene.add(this.player); }
  emote(k: number) { this.player.userData.emote = 1.5; this.player.userData.emoteKind = k; sfx('happy'); if (this.partner) { this.partner.userData.react = 1.5; this.partner.userData.reactKind = 'happy'; this.emoji(this.partner.position.clone().setY(1.5), ['👋', '🎉', '🙇', '🎵'][k], 2); } }
  // Feeding / loving / playing animation with the chosen creature
  react(c: CreatureInst, kind: 'feed' | 'treat' | 'pet' | 'play') {
    if (this.battle) return;
    this.override = { uid: c.uid, t: 5 }; this.refreshPartner(); const pm = this.partner; if (!pm) return;
    const f = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    pm.position.copy(this.player.position).addScaledVector(f, 1.3); pm.lookAt(this.player.position.x, 0, this.player.position.z);
    const u = pm.userData, hu = this.player.userData; hu.expression = 'happy'; hu.exprT = 2.3; const head = pm.position.clone().add(new THREE.Vector3(0, 1.3 * SPECIES[c.sp].scale + 0.3, 0));
    this.reactLock = 2.4; this.yaw = this.player.rotation.y + Math.PI + 0.6;
    if (kind === 'feed' || kind === 'treat') { hu.emote = 1.8; hu.emoteKind = 4; this.later(0.25, () => { this.emoji(head, kind === 'treat' ? '🍯' : '🍊', 1); u.react = 1.6; u.reactKind = 'eat'; sfx('pickup'); }); this.later(1.6, () => { this.emoji(head, '💖', 4); u.react = 1; u.reactKind = 'happy'; sfx('happy'); }); }
    else if (kind === 'pet') { hu.emote = 2; hu.emoteKind = 5; u.react = 2; u.reactKind = 'love'; this.emoji(head, '💕', 5); sfx('happy'); }
    else { hu.emote = 1.6; hu.emoteKind = 1; u.react = 2; u.reactKind = 'happy'; this.emoji(head, '✨', 5); this.emoji(head, '🎵', 2); sfx('happy'); }
  }
  say(t: string) { this.bubble = t; this.bubbleT = 2.5; }
  teleport(x: number, z: number, y = 0) {
    this.player.position.set(x, y, z);
    this.partner?.position.set(x + 1, y, z - 1);
    if (y === 0) {
      this.save.pos = [x, z];
      const key = `${Math.round(x / CH)},${Math.round(z / CH)}`;
      if (!this.chunks.has(key) && !this.booting && this.running) {
        this.booting = true; this.bootProgress = 0;
        this.releaseInput();
        this.cb.onWorldProgress?.(0.12, 'Drawing your new surroundings');
      }
    }
    this.camFollowSnap = true;
  }

  // Physical adventure locations and roaming guardians. These are ordinary 3D scene objects,
  // not menu-only discoveries; their state is persisted in the existing save flags.
  buildAdventureLandmarks() {
    const rock = (g: THREE.Group, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshToonMaterial({ color }));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    const cave = new THREE.Group(); cave.position.set(52, 0, -43);
    rock(cave, 0, 1.3, 0, 5.2, 3.1, 2.1, '#62636d');
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(2.05, 32), new THREE.MeshBasicMaterial({ color: '#100d20', side: THREE.DoubleSide }));
    mouth.position.set(0, 1.45, 1.78); cave.add(mouth);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.22, 10, 32, Math.PI), new THREE.MeshToonMaterial({ color: '#9b8cae', emissive: '#553a80', emissiveIntensity: 0.45 }));
    arch.position.set(0, 1.55, 1.9); arch.rotation.z = Math.PI; cave.add(arch);
    for (let i = 0; i < 5; i++) rock(cave, (i - 2) * 1.7, 0.25, -1.5 - (i % 2), 0.8, 0.6, 0.7, '#77717a');
    const glow = new THREE.PointLight('#a67bff', 2.4, 13); glow.position.set(0, 2, 2.4); cave.add(glow);
    cave.userData.kind = 'cave'; this.adventureLandmarks.add(cave);

    const island = new THREE.Group(); island.position.set(310, 0, -90);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(12, 10, 1.8, 10), new THREE.MeshToonMaterial({ color: '#6f9e58' })); top.position.y = -0.7; top.castShadow = true; top.receiveShadow = true; island.add(top);
    const underside = new THREE.Mesh(new THREE.ConeGeometry(9, 13, 9), new THREE.MeshToonMaterial({ color: '#6c6878' })); underside.position.y = -7; underside.rotation.x = Math.PI; island.add(underside);
    for (let i = 0; i < 7; i++) rock(island, Math.cos(i * 0.9) * (5 + i % 2 * 2), 1.1, Math.sin(i * 0.9) * (5 + i % 2 * 2), 0.6, 1.1, 0.6, '#8b9278');
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), new THREE.MeshToonMaterial({ color: '#7fe7ff', emissive: '#35bde8', emissiveIntensity: 1.2 })); crystal.position.set(0, 2.4, 0); island.add(crystal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.14, 10, 40), new THREE.MeshBasicMaterial({ color: '#75eaff' })); ring.position.set(0, 2.4, 0); ring.rotation.x = Math.PI / 2; island.add(ring);
    const islandLight = new THREE.PointLight('#64dfff', 2.8, 24); islandLight.position.set(0, 4, 0); island.add(islandLight);
    island.userData.kind = 'island'; this.adventureLandmarks.add(island);

    // A small walkable chamber is built just behind the cave mouth.
    const chamber = new THREE.Group(); chamber.position.set(52, -10, -57);
    // A deep, connected underground cavern network with a main hall, side galleries and a lower crystal basin.
    const caveFloorMat = new THREE.MeshToonMaterial({ color: '#34313f' });
    for (let i = 0; i < 9; i++) { const z = -i * 10; const floor = new THREE.Mesh(new THREE.CylinderGeometry(i < 3 ? 13 : 9, i < 3 ? 13 : 9, 0.55, 28), caveFloorMat); floor.position.set(0, -0.28, z); floor.scale.z = 1.9; floor.receiveShadow = true; chamber.add(floor); }
    for (let side of [-1, 1]) for (let i = 0; i < 9; i++) rock(chamber, side * (i < 3 ? 12.2 : 8.5), 2.8, -i * 10, 2.5, 5.5, 5.8, '#494653');
    for (let i = 0; i < 8; i++) { const z = -i * 10 - 4; rock(chamber, (Math.sin(i * 2.1) * 2), 7.2, z, 2.5, 2.4, 5.2, '#373341'); }
    // Side galleries and a lower basin are linked by broad corridors.
    for (const side of [-1, 1]) { const gallery = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 0.5, 20), caveFloorMat); gallery.rotation.z = Math.PI / 2; gallery.position.set(side * 19, -0.25, -25); gallery.scale.set(1, 1.8, 1); chamber.add(gallery); for (let j = 0; j < 5; j++) rock(chamber, side * (15 + j * 2.2), 2.6, -25 + Math.sin(j) * 2, 1.4, 4.8, 2.4, '#514b5c'); }
    const altar = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshToonMaterial({ color: '#b18aff', emissive: '#7544c7', emissiveIntensity: 1.4 })); altar.position.set(0, 2.2, -34); chamber.add(altar);
    for (let i = 0; i < 28; i++) { const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 + Math.random() * 0.65), new THREE.MeshToonMaterial({ color: i % 2 ? '#8e72db' : '#59c8d8', emissive: i % 2 ? '#7544c7' : '#1c8298', emissiveIntensity: 0.75 })); crystal.position.set((Math.random() - 0.5) * 20, 0.6 + Math.random() * 2.5, -Math.random() * 82); chamber.add(crystal); }
    for (const z of [-12, -40, -72]) { const lamp = new THREE.PointLight('#9e7bff', 2.1, 28); lamp.position.set(0, 4, z); chamber.add(lamp); }
    // Deepwild extension: connected physical zones continue far below the first crystal hall.
    for (let i = 9; i <= 24; i++) {
      const z = -i * 10; const radius = i < 14 ? 10 : i < 19 ? 13 : 11;
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 1.2, 0.7, 32), caveFloorMat);
      floor.position.set(0, -0.32, z); floor.scale.z = 1.8; floor.receiveShadow = true; chamber.add(floor);
      for (const side of [-1, 1]) rock(chamber, side * (radius - 0.5), 3.1, z, 2.4, 6.2, 5.4, i > 18 ? '#293c37' : '#403c50');
      if (i % 2 === 0) { const lamp = new THREE.PointLight(i < 14 ? '#55d7e8' : i < 19 ? '#d49b62' : '#8be39a', 1.7, 25); lamp.position.set(0, 4.5, z); chamber.add(lamp); }
    }
    // Sunken Archive: an underground lake with a stone causeway and ruined library towers.
    const lake = new THREE.Mesh(new THREE.CircleGeometry(10.5, 48), new THREE.MeshPhysicalMaterial({ color: '#14566a', transparent: true, opacity: 0.78, roughness: 0.16, metalness: 0.22, emissive: '#073c56', emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.12, -112); chamber.add(lake);
    for (let i = -4; i <= 4; i++) { const stone = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 2.1), new THREE.MeshToonMaterial({ color: '#777c88' })); stone.position.set(i * 1.7, 0.25, -112); chamber.add(stone); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, 5 + (i % 3), 8), new THREE.MeshToonMaterial({ color: '#55505e' })); tower.position.set(Math.cos(a) * 15, 2.4, -112 + Math.sin(a) * 12); tower.castShadow = true; chamber.add(tower); const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.7, 8), new THREE.MeshToonMaterial({ color: '#8d7b9d' })); cap.position.copy(tower.position).add(new THREE.Vector3(0, 3.1 + (i % 3) * 0.5, 0)); chamber.add(cap); }
    // Hollow Cathedral: temple nave, pillars and a sealed altar.
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 4.4; const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 7.5, 8), new THREE.MeshToonMaterial({ color: '#62566b' })); pillar.position.set(x, 3.5, -158); pillar.castShadow = true; chamber.add(pillar); const rune = new THREE.PointLight('#e0a76b', 0.8, 10); rune.position.set(x, 5.5, -158); chamber.add(rune); }
    const temple = new THREE.Mesh(new THREE.BoxGeometry(8, 1.1, 4), new THREE.MeshToonMaterial({ color: '#8c6e52', emissive: '#4c2c18', emissiveIntensity: 0.3 })); temple.position.set(0, 0.55, -163); chamber.add(temple);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.18, 12, 48), new THREE.MeshBasicMaterial({ color: '#f3bd72' })); seal.position.set(0, 2.4, -163); chamber.add(seal);
    // Abyssal Orchard: giant luminous fungi and moss trees make the final cavern feel like a biome.
    for (let i = 0; i < 18; i++) { const x = (Math.sin(i * 12.7) * 9); const z = -184 - (i % 6) * 5; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 3.4 + (i % 3), 7), new THREE.MeshToonMaterial({ color: '#7a9a83' })); stem.position.set(x, 1.6, z); chamber.add(stem); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15 + (i % 3) * 0.25, 12, 8), new THREE.MeshToonMaterial({ color: i % 2 ? '#68d6b0' : '#bd85e8', emissive: i % 2 ? '#176f5a' : '#5d2d83', emissiveIntensity: 0.9 })); cap.scale.y = 0.42; cap.position.set(x, 3.6 + (i % 3) * 0.4, z); chamber.add(cap); }
    // Crown Below: a treasure vault and final sealed boss gate.
    const vault = new THREE.Mesh(new THREE.BoxGeometry(11, 7, 1), new THREE.MeshToonMaterial({ color: '#4b4359' })); vault.position.set(0, 3.2, -224); chamber.add(vault);
    const gate = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.28, 12, 48), new THREE.MeshToonMaterial({ color: '#d4a56a', emissive: '#7b4b20', emissiveIntensity: 0.8 })); gate.position.set(0, 3.2, -223.35); chamber.add(gate);
    const chest = new THREE.Group(); chest.position.set(6, 0, -207); const chestBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), new THREE.MeshToonMaterial({ color: '#80552e' })); chestBase.position.y = 0.6; chest.add(chestBase); const chestLid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.25), new THREE.MeshToonMaterial({ color: '#d0a34e', emissive: '#7a4a12', emissiveIntensity: 0.35 })); chestLid.position.y = 1.35; chest.add(chestLid); const chestGlow = new THREE.PointLight('#ffd56c', 1.6, 9); chestGlow.position.y = 2; chest.add(chestGlow); chest.userData.deepwildChest = true; chamber.add(chest);
    chamber.userData.kind = 'chamber'; this.adventureLandmarks.add(chamber);
    this.scene.add(this.adventureLandmarks);

    const makeGuardian = (id: string, species: string, nick: string, pos: THREE.Vector3, level: number, scale: number, color: string) => {
      const inst = makeCreature(species, level, 'Aggressive'); inst.nick = nick; inst.hp = stats(inst).hp;
      const mesh = buildCreature(species); mesh.scale.setScalar(scale); mesh.position.copy(pos); mesh.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = 0.22; } });
      const aura = new THREE.Mesh(new THREE.TorusGeometry(1.8 * scale, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })); aura.rotation.x = Math.PI / 2; aura.position.y = 0.12; mesh.add(aura);
      this.scene.add(mesh); this.adventureBosses.push({ mesh, inst, state: 'territory', target: pos.clone(), t: 0, home: pos.clone(), ignore: 0, boss: true, bossId: id });
    };
    if (!this.save.flags.boss_cave_defeated) makeGuardian('cave', 'shadeling', 'Gloam, Cave Warden', new THREE.Vector3(52, -10, -112), 24, 2.1, '#a47bff');
    if (!this.save.flags.boss_sky_defeated) makeGuardian('sky', 'frostnib', 'Auralis, Sky Warden', new THREE.Vector3(316, 0, -90), 32, 2.5, '#70e9ff');
    if (!this.save.flags.boss_forest_defeated) makeGuardian('forest', 'grovehorn', 'Verdant Matriarch', new THREE.Vector3(-132, 0, 112), 29, 2.65, '#65d98a');
    if (!this.save.flags.boss_desert_defeated) makeGuardian('desert', 'cragmaul', 'Sirocco Titan', new THREE.Vector3(242, 0, 206), 31, 2.8, '#d6a15e');
    if (!this.save.flags.boss_frost_defeated) makeGuardian('frost', 'frostnib', 'Frostcrown Wyrm', new THREE.Vector3(-258, 0, -178), 34, 2.9, '#8eeaff');
    if (!this.save.flags.boss_deep_defeated) makeGuardian('deep', 'shadeling', 'Nerath, the Deep Coil', new THREE.Vector3(52, -10, -265), 38, 3.0, '#b17bdb');
    if (!this.save.flags.boss_zephyr_defeated) makeGuardian('zephyr', 'gustwing', 'Zephyr Leviathan', new THREE.Vector3(310, 0, -126), 36, 3.1, '#9fe0d0');
  }
  buildPhysicalHomestead() {
    this.homestead.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } });
    this.homestead.clear(); this.homestead.position.set(-36, 0, -40);
    const mat = (color: string, emissive = '#000000') => new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: emissive === '#000000' ? 0 : 0.25 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 0.45, 32), mat('#66745c')); base.position.y = 0.05; base.receiveShadow = true; this.homestead.add(base);
    const house = new THREE.Group(); house.position.set(0, 0.25, -2);
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.2, 6), mat('#b99a72')); body.position.y = 2.1; body.castShadow = true; house.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.7, 3.2, 4), mat('#704b3d')); roof.position.y = 5.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true; house.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.4, 0.16), mat('#49332c')); door.position.set(0, 1.2, 3.08); house.add(door);
    const windowMat = new THREE.MeshBasicMaterial({ color: '#a8e7ef' }); [-2.25,2.25].forEach(x=>{const w=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,0.12),windowMat);w.position.set(x,2.5,3.08);house.add(w);}); this.homestead.add(house);
    const fenceMat=mat('#8b6949'); for(let i=0;i<16;i++){const a=i*Math.PI/8;const post=new THREE.Mesh(new THREE.BoxGeometry(.22,1.05,.22),fenceMat);post.position.set(Math.cos(a)*10,.55,Math.sin(a)*10);this.homestead.add(post);}
    const builds=this.save.worldSystems?.homeBuilds??[];
    const addStation=(id:string,x:number,z:number,color:string)=>{if(!builds.includes(id))return;const g=new THREE.Group();g.position.set(x,0,z);const plinth=new THREE.Mesh(new THREE.BoxGeometry(3.2,.45,2.5),mat('#6f706d'));plinth.position.y=.22;g.add(plinth);const core=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.6,1.6),mat(color,color));core.position.y=1.15;g.add(core);const lamp=new THREE.PointLight(color,1.15,8);lamp.position.y=2.2;g.add(lamp);this.homestead.add(g);};
    addStation('habitat',-6,4,'#7ad69b'); addStation('garden',6,4,'#8ed66e'); addStation('workbench',-7,-5,'#d5a36a'); addStation('trophy',7,-5,'#e7c66c'); addStation('incubator',-5,7,'#71d9ef'); addStation('guest',5,7,'#b18aff');
    this.scene.add(this.homestead); this.homesteadSignature=builds.slice().sort().join('|');
  }
  syncPhysicalHomestead() { const sig=(this.save.worldSystems?.homeBuilds??[]).slice().sort().join('|'); if(sig!==this.homesteadSignature)this.buildPhysicalHomestead(); }
  customIslandAt(x: number, z: number) { return Math.hypot(x - 310, z + 90) < 12.2; }
  enterAdventurePlace(kind: 'cave' | 'island') {
    if (this.battle || this.boat || this.flight) return;
    if (kind === 'cave') {
      this.adventureReturn = this.player.position.clone(); this.adventureInterior = 'cave';
      this.teleport(52, -57); this.player.position.y = -10; this.area = 'Whisper Cave';
      this.cb.onToast('The cave air hums. Something ancient is watching.', 'info');
    } else {
      this.adventureReturn = this.player.position.clone(); this.adventureInterior = 'island';
      this.teleport(310, -90); this.player.position.y = 0; this.area = 'Echo Island';
      this.cb.onToast('You reached Echo Island. The sky crystal is resonating.', 'good');
    }
    this.camFollowSnap = true; this.adventureCineT = 1.5; this.adventureCineKind = 'intro'; this.cb.onChange(); this.autosave();
  }
  exitAdventurePlace() {
    if (this.adventureInterior === 'outside') return;
    const back = this.adventureReturn ?? new THREE.Vector3(52, 0, -40);
    this.adventureInterior = 'outside'; this.adventureReturn = null; this.teleport(back.x, back.z); this.player.position.y = 0;
    this.area = 'Embervale'; this.camFollowSnap = true; this.cb.onToast('You returned to the open world.', 'info'); this.autosave();
  }
  updateAdventureWorld(dt: number) {
    const p = this.player.position; this.syncPhysicalHomestead();
    this.adventureLandmarks.children.forEach(o => { if (o.userData.kind === 'island') { o.rotation.y += dt * 0.025; const c = o.children.find(x => x instanceof THREE.Mesh && (x.geometry as THREE.BufferGeometry).type === 'OctahedronGeometry'); if (c) c.position.y = 2.4 + Math.sin(this.clock.elapsedTime * 1.5) * 0.25; } });
    if (this.adventureCineT > 0) { this.adventureCineT = Math.max(0, this.adventureCineT - dt); if (this.adventureCineT === 0) this.adventureCineKind = null; }
    if (this.adventureInterior !== 'outside') {
      if (this.adventureInterior === 'cave') {
        const localZ = p.z;
        const zone = localZ > -92 ? 'Mosslight Galleries' : localZ > -132 ? 'Sunken Archive' : localZ > -174 ? 'Hollow Cathedral' : localZ > -208 ? 'Abyssal Orchard' : 'Crown Below';
        if (this.area !== zone) { this.area = zone; this.cb.onChange(); }
        if (Math.hypot(p.x - 58, p.z + 264) < 3.2 && !this.save.flags.deepwild_crown_treasure) { this.hud.prompt = 'E  Open ancient treasure'; if (this.act('interact')) { this.save.flags.deepwild_crown_treasure = true; this.save.money += 450; this.save.items.diamond = (this.save.items.diamond || 0) + 3; this.save.items.grandpod = (this.save.items.grandpod || 0) + 2; this.cb.onToast('Crown Below treasure found! +450 coins, 3 diamonds and 2 Grand Pods.', 'ach'); this.cb.onChange(); this.autosave(); } }
      }
      if (Math.hypot(p.x - (this.adventureInterior === 'cave' ? 52 : 310), p.z - (this.adventureInterior === 'cave' ? -48 : -90)) < 2.4) {
        this.hud.prompt = 'E  Leave ' + (this.adventureInterior === 'cave' ? 'Whisper Cave' : 'Echo Island');
        if (this.act('interact')) this.exitAdventurePlace();
      }
    } else {
      const dc = Math.hypot(p.x - 52, p.z + 43), di = Math.hypot(p.x - 310, p.z + 90);
      if (dc < 4.5) { this.hud.prompt = 'E  Enter Whisper Cave'; if (this.act('interact')) this.enterAdventurePlace('cave'); }
      else if (di < 7) { this.hud.prompt = 'E  Explore Echo Island'; if (this.act('interact')) this.enterAdventurePlace('island'); }
    }
    for (const boss of [...this.adventureBosses]) {
      if (this.save.flags[`boss_${boss.bossId}_defeated`]) { this.scene.remove(boss.mesh); this.adventureBosses.splice(this.adventureBosses.indexOf(boss), 1); continue; }
      const home = boss.home; boss.t -= dt;
      if (boss.t <= 0) { boss.target.set(home.x + (Math.random() - 0.5) * 7, 0, home.z + (Math.random() - 0.5) * 7); boss.t = 2.5 + Math.random() * 2; }
      const hour = this.save.time; const night = this.isNight();
      const available = boss.bossId === 'forest' ? (this.save.weather === 'Rain' && hour >= 5 && hour < 10) : boss.bossId === 'desert' ? ((this.save.weather === 'Storm' || this.save.weather === 'Wind') && hour >= 16 && hour < 21) : boss.bossId === 'frost' ? (this.save.weather === 'Snow' && night) : boss.bossId === 'deep' ? this.adventureInterior === 'cave' : boss.bossId === 'zephyr' ? (this.save.weather === 'Storm' && hour >= 8 && hour < 17) : true;
      boss.mesh.visible = available;
      if (!available) continue;
      const d = boss.mesh.position.distanceTo(p); const dir = boss.target.clone().sub(boss.mesh.position).setY(0);
      if (dir.length() > 0.35) { dir.normalize(); boss.mesh.position.addScaledVector(dir, dt * (d < 18 ? 1.5 : 0.8)); boss.mesh.rotation.y = Math.atan2(dir.x, dir.z); }
      const bt = this.clock.elapsedTime; const skyBoss = boss.bossId === 'sky' || boss.bossId === 'zephyr'; boss.mesh.position.y = skyBoss ? 0.32 + Math.sin(bt * 2.8) * 0.42 : (['cave','deep'].includes(boss.bossId ?? '') ? -10 : 0) + Math.abs(Math.sin(bt * 1.7)) * 0.08; boss.mesh.rotation.z = skyBoss ? Math.sin(bt * 1.8) * 0.08 : Math.sin(bt * 0.7) * 0.035; boss.mesh.rotation.x = skyBoss ? Math.sin(bt * 1.3) * 0.06 : 0; animateCreature(boss.mesh, dt, true);
      if (d < 3.2 && this.leadInst() && !this.battle) {
        const wild = boss; wild.inst.hp = stats(wild.inst).hp; this.adventureCineT = 2.8; this.adventureCineKind = 'intro'; this.shake = 0.55; this.flashT = 0.25; this.burst(boss.mesh.position.clone().setY(1.4), boss.bossId === 'sky' || boss.bossId === 'frost' ? '#70e9ff' : boss.bossId === 'forest' ? '#65d98a' : boss.bossId === 'desert' ? '#d6a15e' : '#a47bff', 30, 6);
        this.beginBattle('wild', [wild.inst], undefined, wild);
        this.battle!.wild!.boss = true; this.battle!.wild!.bossId = boss.bossId;
        playMusic(boss.bossId === 'sky' || boss.bossId === 'frost' || boss.bossId === 'zephyr' ? 'auralis' : 'gloam'); sfx('crit'); this.cb.onToast(`${boss.inst.nick} has entered the field. Prepare for a guardian battle!`, 'bad'); return;
      }
    }
    // Habitat and weather responses: shivering in snow, seeking shade in heat, and sheltering in storms.
    for (const w of this.wilds) {
      const biome = biomeAt(w.mesh.position.x, w.mesh.position.z), weather = this.save.weather;
      if ((weather === 'Snow' || biome === 'snow' || biome === 'ice') && w.inst.sp !== 'frostnib') w.mesh.rotation.z = Math.sin(this.clock.elapsedTime * 3 + w.inst.uid.length) * 0.035;
      else if ((weather === 'Rain' || weather === 'Storm') && w.inst.sp === 'emberkit') w.state = 'hide';
      else if (weather === 'Clear' && this.isNight() && w.inst.sp === 'shadeling') w.mesh.userData.emissiveBoost = 1;
      if (weather === 'Storm' && w.inst.sp === 'voltmite') w.mesh.scale.setScalar(1.04 + Math.sin(this.clock.elapsedTime * 7) * 0.035);
    }
  }

  collide(p: THREE.Vector3, r = 0.4) {
    if (this.indoor && p.y < -50) {
      for (const c of this.world.inColliders) this.push(p, c, r);
      p.x = clamp(p.x, IX - 6.4, IX + 6.4); p.z = clamp(p.z, -5.4, 5.7); return;
    }
    if (Math.abs(p.x) < 130 && p.z > -140 && p.z < 300) for (const c of this.world.colliders) this.push(p, c, r);
    for (const ch of this.nearChunks(p.x, p.z)) for (const c of ch.colliders) this.push(p, c, r);
    for (const c of this.campCol) this.push(p, c, r);
    if (!this.save.flags.starter && (p.z > 29 || Math.abs(p.x) > 38 || p.z < -36)) { p.z = clamp(p.z, -36, 29); p.x = clamp(p.x, -38, 38); if (this.bubbleT <= 0) { this.cb.onToast('Talk to the Elder first!', 'info'); this.bubbleT = 3; } }
    if (!this.save.quests.m3.done) { const d = Math.hypot(p.x, p.z - 205); if (d < 26.5) { const k = 26.5 / Math.max(0.01, d); p.x *= k; p.z = 205 + (p.z - 205) * k; } }
  }
  push(p: THREE.Vector3, c: { x0: number; x1: number; z0: number; z1: number; h?: number; y0?: number }, r: number) {
    const rel = p.y < -50 ? p.y - IY : p.y; if (rel < (c.y0 ?? -1e9) || rel > (c.h ?? 1e9) - 0.3) return;
    if (p.x > c.x0 - r && p.x < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r) {
      const dl = p.x - (c.x0 - r), dr = c.x1 + r - p.x, dt = p.z - (c.z0 - r), db = c.z1 + r - p.z; const m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = c.x0 - r; else if (m === dr) p.x = c.x1 + r; else if (m === dt) p.z = c.z0 - r; else p.z = c.z1 + r;
    }
  }

  // ---------- progress helpers ----------
  isNight() { const t = this.save.time; return t < 6 || t >= 19.5; }
  addCard(id: string) { const had = this.save.cards[id]; this.save.cards[id] = (had || 0) + 1; this.cb.onToast(had ? 'Got a copy card!' : '🃏 New card!', 'card'); if (Object.keys(this.save.cards).length >= 10) this.ach('cards10'); }
  ach(id: string) { if (this.save.achievements.includes(id)) return; this.save.achievements.push(id); this.save.money += 50; this.cb.onToast('🏆 New award! +50 coins', 'ach'); }
  quest(id: string, amt = 1, set = false) {
    const q = QUESTS.find(x => x.id === id); const s = this.save.quests[id]; if (!q || !s || s.done) return;
    if (q.requires && !this.save.quests[q.requires]?.done) return;
    s.p = set ? amt : s.p + amt;
    if (s.p >= q.goal) {
      s.done = true; s.p = q.goal; this.save.money += q.reward.money;
      Object.entries(q.reward.items ?? {}).forEach(([k, v]) => (this.save.items[k] = (this.save.items[k] || 0) + v));
      this.cb.onToast(`✅ Quest done: ${q.name}`, 'good'); sfx('coin'); if (q.reward.card) this.addCard(q.reward.card);
    }
    this.cb.onChange();
  }
  tut(n: number) { if (this.save.tutorial === n) { this.save.tutorial = n + 1; this.cb.onChange(); } }
  autosave() { if (!this.indoor && !this.fourth && !this.fourthLobby) this.save.pos = [this.player.position.x, this.player.position.z]; this.cb.onInteract('__autosave'); }

  // ---------- wild creatures ----------
  spawnPool(z: number): [string, number][] {
    const n = this.isNight(), w = this.save.weather; const pool: [string, number][] = [];
    if (!n) pool.push(['gustwing', w === 'Wind' ? 6 : 4]); else pool.push(['shadeling', z > 115 ? 6 : 3]);
    pool.push(['pebblob', Math.abs(z - 95) < 25 ? 3 : 1]); pool.push(['voltmite', w === 'Storm' || w === 'Rain' ? 4 : 1]);
    pool.push(['mossbun', 1.2]); pool.push(['emberkit', w === 'Clear' && !n ? 1 : 0.3]); pool.push(['rillfin', w === 'Rain' ? 2 : 0.5]);
    pool.push(['frostnib', w === 'Fog' || w === 'Snow' ? 2 : 0.15]);
    return pool;
  }
  spawnWild() {
    const p = this.player.position; const ang = Math.random() * Math.PI * 2; const r = 25 + Math.random() * 20;
    let x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r; if (this.adventureInterior === 'cave') { x = 52 + (Math.random() - 0.5) * 12; z = -82 - Math.random() * 48; } const core = inCore(x, z);
    if (core) { if (z < 40 || z > 178 || Math.abs(x) > 34) return; if (Math.abs(z - 95) < 5) return; x = clamp(x, -30, 30); }
    if (townAt(x, z, 42) || this.inLake(x, z)) return;
    const night = this.isNight(); const baseLvl = core ? Math.floor(3 + (z - 40) / 30) : levelAt(x, z);
    const bAt = biomeAt(x, z); const bb = isWater(x, z) ? 'ocean' : bAt === 'ocean' ? 'meadow' : bAt;
    const pool = core ? this.spawnPool(z) : speciesPool(bb, night, baseLvl, this.nearWater(x, z));
    const luckBoost = this.leadInst() && SPECIES[this.leadInst()!.sp].type === 'nature' ? 1.45 : 1;
    // Habitat-locked rare encounters make travel and weather meaningful.
    if (!core && bb === 'snow' && night && Math.random() < 0.16) pool.push(['frostnib', 8]);
    if (!core && bb === 'desert' && this.save.weather === 'Clear' && Math.random() < 0.12 * luckBoost) pool.push(['emberkit', 7]);
    if (!core && bb === 'jungle' && (this.save.weather === 'Rain' || this.save.weather === 'Storm') && Math.random() < 0.14 * luckBoost) pool.push(['rillfin', 7]);
    if (!core && bb === 'mountain' && this.save.weather === 'Wind' && Math.random() < 0.13 * luckBoost) pool.push(['gustwing', 8]);
    const sp = pick(pool);
    const lvl = Math.min(50, Math.max(2, baseLvl + Math.floor(Math.random() * 3) - 1 + this.save.ngPlus * 15));
    const group = sp === 'gustwing' && Math.random() < 0.4 ? 2 : 1; let leader: Wild | undefined;
    for (let i = 0; i < group; i++) {
      const inst = makeCreature(sp, lvl); const mesh = buildCreature(sp); mesh.position.set(x + i * 1.5, this.adventureInterior === 'cave' ? -10 : 0, z + i); this.scene.add(mesh);
      const w: Wild = { mesh, inst, state: 'wander', target: mesh.position.clone(), t: 0, home: mesh.position.clone(), ignore: 0, leader }; if (!leader) leader = w; this.wilds.push(w);
    }
  }
  updateWilds(dt: number) {
    const pp = this.player.position; const night = this.isNight(); const storm = this.save.weather === 'Storm';
    this.spawnT -= dt;
    const safe = (inCore(pp.x, pp.z) && (pp.z < 34 || pp.z > 186)) || !!townAt(pp.x, pp.z, 36) || this.inSafeCamp();
    if (!safe && this.spawnT <= 0 && this.wilds.length < 12) { this.spawnWild(); this.spawnT = 2.2; }
    for (let i = this.wilds.length - 1; i >= 0; i--) {
      const w = this.wilds[i]; const d = w.mesh.position.distanceTo(pp);
      if (d > 75) { this.scene.remove(w.mesh); this.wilds.splice(i, 1); continue; }
      w.mesh.visible = d < this.settings.viewDist * 0.6 && w.state !== 'hide';
      if (d > 45) continue;
      w.t -= dt; w.ignore -= dt; const sp = SPECIES[w.inst.sp]; const shy = w.inst.pers === 'Shy'; const nocturnal = sp.type === 'shadow'; const aggressive = w.inst.pers === 'Aggressive' || w.inst.pers === 'Brave' || (night && nocturnal);
      if (storm && shy && sp.type !== 'electric') w.state = 'hide';
      else if (night !== nocturnal && w.state !== 'chase' && w.state !== 'flee' && w.inst.uid.charCodeAt(0) % 2) w.state = 'sleep';
      else if (w.state === 'hide' || w.state === 'sleep') w.state = 'wander';
      if (w.state !== 'hide' && w.state !== 'sleep') {
        if (d < 7 && shy && w.state !== 'flee') { w.state = 'flee'; w.t = 3; }
        else if (d < 9 && aggressive && w.ignore <= 0) w.state = 'chase';
        else if (w.mesh.position.distanceTo(w.home) > 6 && aggressive && d < 12) w.state = 'territory';
      }
      if (w.state === 'flee' && w.t <= 0) w.state = 'wander';
      if (w.state === 'chase' && d > 14) w.state = 'wander';
      let tgt: THREE.Vector3 | null = null; let speed = 2;
      if (w.state === 'wander') { if (w.leader && this.wilds.includes(w.leader)) tgt = w.leader.mesh.position.clone().add(new THREE.Vector3(1.5, 0, 1)); else { if (w.t <= 0) { w.target.set(w.home.x + (Math.random() - 0.5) * 14, 0, w.home.z + (Math.random() - 0.5) * 14); w.t = 3 + Math.random() * 4; } tgt = w.target; } speed = 1.6; }
      if (w.state === 'chase' || w.state === 'territory') { tgt = pp; speed = 4.5; }
      if (w.state === 'flee') { tgt = w.mesh.position.clone().multiplyScalar(2).sub(pp); speed = 5.5; }
      let moving = false;
      if (tgt && w.state !== 'sleep') { const dir = tgt.clone().sub(w.mesh.position).setY(0); if (dir.length() > 0.5) { dir.normalize(); w.mesh.position.addScaledVector(dir, speed * dt); w.mesh.rotation.y = Math.atan2(dir.x, dir.z); moving = true; this.collide(w.mesh.position, 0.5); } }
      if (w.state === 'sleep') { animateCreature(w.mesh, dt * 0.3, false); (w.mesh.userData.eyes as THREE.Object3D[]).forEach(e => (e.scale.y = 0.1)); if (Math.random() < dt * 0.3 && d < 20) this.emoji(w.mesh.position.clone().setY(1.5), '💤', 1); }
      else animateCreature(w.mesh, dt, moving);
      if (d < 1.8 && w.ignore <= 0 && this.leadInst() && w.state !== 'hide' && !this.inSafeCamp()) { this.startWild(w); return; }
    }
  }

  // ---------- battle ----------
  makeActor(inst: CreatureInst, side: 0 | 1, pos: THREE.Vector3, mesh?: THREE.Group): Actor {
    const s = stats(inst); const m = mesh ?? buildCreature(inst.sp, inst.acc); m.position.copy(pos); if (!mesh) this.scene.add(m);
    return { mesh: m, inst, side, maxHp: s.hp, hp: Math.min(inst.hp, s.hp), en: 100, ult: 0, cds: {}, st: { burn: 0, slow: 0, stun: 0, poison: 0, buff: 0 }, iframes: 0, blocking: false, blockT: -9, busy: 0, vel: new THREE.Vector3(), combo: 0, comboT: 0, dodgeCd: 0, dashT: 0, dashDir: new THREE.Vector3(), aiT: 1, intent: '', fleeing: false, s };
  }
  startWild(w: Wild) {
    const i = this.wilds.indexOf(w); if (i >= 0) this.wilds.splice(i, 1);
    if (!this.save.seen.includes(w.inst.sp)) this.save.seen.push(w.inst.sp);
    this.beginBattle('wild', [w.inst], undefined, w); this.cb.onToast(`A wild ${SPECIES[w.inst.sp].name} appeared!`, 'info');
  }
  startTrainer(id: string) {
    const t = this.getTrainer(id); if (!t) return; const starter = Object.keys(this.save.flags).find(k => k.startsWith('starter_'))?.slice(8) ?? 'emberkit';
    const bonus = (id === 'kael' && this.save.flags.beat_morrow ? 8 : 0) + this.save.ngPlus * 15 + (this.save.difficulty === 'Hard' ? 2 : 0);
    let team = t.team.map(m => makeCreature(m.sp === '@counter' ? COUNTER[starter] : m.sp, m.lvl + bonus, id === 'morrow' ? 'Aggressive' : undefined));
    if (id === 'kael' && this.save.flags.beat_morrow) team = team.map(c => { const s = SPECIES[c.sp]; if (s.evolvesTo && c.lvl >= (s.evoLevel ?? 99)) { c.sp = s.evolvesTo; c.nick = SPECIES[c.sp].name; c.hp = stats(c).hp; } return c; });
    this.beginBattle('trainer', team, t);
  }
  startLeagueBattle(uids: string[], rival: string) {
    const selected = uids.map(id => this.save.team.find(c => c.uid === id)).filter((c): c is CreatureInst => !!c);
    if (selected.length !== 3 || selected.some(c => c.fainted || c.hp <= 0)) { this.cb.onToast('Choose three healthy creatures from your active team.', 'bad'); return; }
    const types: Record<string, ElemType> = { Gloam: 'shadow', Auralis: 'ice', 'Desert Titan': 'earth', 'Sky Leviathan': 'wind' };
    const type = types[rival] ?? 'shadow';
    const pool = Object.values(SPECIES).filter(sp => sp.type === type);
    const avg = Math.round(selected.reduce((n,c)=>n+c.lvl,0)/3);
    const foes = [0,1,2].map(i => { const def = pool[(i + Math.floor(Math.random()*Math.max(1,pool.length))) % Math.max(1,pool.length)] ?? SPECIES.frostnib; const c = makeCreature(def.id, Math.max(5, avg + i - 1), 'Aggressive'); c.nick = [`${rival} Scout`, `${rival} Herald`, rival][i]; return c; });
    const slug = rival.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    const trainer: TrainerDef = { id: `arena_${slug}`, name: `${rival} Challenger`, title: 'Ember League Rival', team: foes.map(c=>({sp:c.sp,lvl:c.lvl})), money: 220 + avg * 4, card: '', intro: 'The arena lights flare. Show the bond you have built.', win: 'Your team earned this victory.', lose: 'The challenger waits for your rematch.', aggr: 1.2, color: '#e9b85d' };
    this.beginBattle('trainer', foes, trainer, undefined, selected);
    this.cb.onToast(`Ember League match: ${selected.map(c=>c.nick).join(', ')} vs ${rival}.`, 'ach');
  }
  beginBattle(kind: 'wild' | 'trainer', team: CreatureInst[], trainer?: TrainerDef, wild?: Wild, playerTeam: CreatureInst[] = this.save.team) {
    const lead = playerTeam.find(c => !c.fainted && c.hp > 0) ?? null; if (!lead) return;
    this.firstPerson = false; this.player.visible = true;
    this.override = null; this.refreshPartner();
    const pp = this.player.position.clone(); const fwd = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    const floorY = this.adventureInterior === 'cave' ? -10 : 0;
    if (this.activity) this.endActivity(); this.player.position.y = floorY; pp.y = floorY;
    const center = pp.clone().addScaledVector(fwd, 5); if (inCore(center.x, center.z)) center.x = clamp(center.x, -26, 26);
    const me = this.makeActor(lead, 0, center.clone().addScaledVector(fwd, -3));
    const foe = this.makeActor(team[0], 1, center.clone().addScaledVector(fwd, 3), wild?.mesh);
    if (this.partner) this.partner.visible = false;
    if (this.skate) this.toggleSkate(); this.sitting = false; if (this.boat) this.setBoat(false);
    const side = fwd.clone().negate(); let oppNpc: NPC | undefined, oppPos: THREE.Vector3 | undefined;
    if (trainer) { oppNpc = this.npcs.find(n => n.trainer === trainer.id); if (oppNpc) { oppPos = oppNpc.pos.clone(); oppNpc.pos.copy(center).addScaledVector(fwd, 11.5); oppNpc.mesh.lookAt(center.x, 0, center.z); } }
    // Battle arena ring (posts, rope, glowing circle, torches)
    const ring = new THREE.Group(); ring.position.copy(center).setY(floorY);
    const field = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.2, 48), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.85 })); field.rotation.x = -Math.PI / 2; field.position.y = 0.07; ring.add(field);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 })); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.07; ring.add(inner);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const x = Math.cos(a) * 9, z = Math.sin(a) * 9; part('cyl', tmat('#8a5a32'), [0.12, 1.4, 0.12], [x, 0.7, z], [0, 0, 0], ring); part('sphere', tmat(i % 2 ? '#e0574a' : '#3d7be0'), [0.18, 0.18, 0.18], [x, 1.45, z], [0, 0, 0], ring);
      if (i % 3 === 0) [0, 1].forEach(k => part('cone', tmat(k ? '#ffe066' : '#ff7a1b', 1.5), [0.14 - k * 0.05, 0.4 - k * 0.1, 0.14 - k * 0.05], [x, 1.75, z], [0, 0, 0], ring, true)); }
    [1.0, 0.6].forEach(y => { const rope = new THREE.Mesh(new THREE.TorusGeometry(9, 0.04, 6, 64), tmat('#f0e0c0')); rope.rotation.x = Math.PI / 2; rope.position.y = y; ring.add(rope); });
    addOutline(ring, 0.02); this.scene.add(ring);
    this.battle = { kind, trainer, team, playerTeam, ei: 0, me, foe, center, floorY, switchCd: 0, over: false, xpPool: 0, wild, participants: new Set([lead.uid]), endT: 0, count: 3.99, ring, side, oppNpc, oppPos, bossPhase: 1, bossTell: 0, bossMoveCd: 1.8, bossMove: '', bossMoveKind: '', bossIntro: wild?.boss ? 2.8 : 0, bossComboStep: 0 };
    this.yaw = Math.atan2(-fwd.x, -fwd.z) + Math.PI; cry(team[0].sp.length * 7, SPECIES[team[0].sp].scale);
    playMusic(wild?.boss ? (wild.bossId === 'sky' ? 'auralis' : 'gloam') : trainer?.id === 'morrow' ? 'boss' : 'battle'); this.tut(4); this.cb.onChange();
  }
  abilitiesOf(a: Actor) { return SPECIES[a.inst.sp].abilities.slice(0, 3).map(id => ABILITIES[id]); }
  weatherMult(t: ElemType) {
    const w = this.save.weather;
    if (w === 'Rain' || w === 'Storm') { if (t === 'water') return 1.2; if (t === 'fire') return 0.8; }
    if (w === 'Storm' && t === 'electric') return 1.25; if ((w === 'Snow' || w === 'Fog') && t === 'ice') return 1.2;
    if (w === 'Clear' && !this.isNight() && t === 'fire') return 1.1; if (this.isNight() && t === 'shadow') return 1.15; if (w === 'Wind' && t === 'wind') return 1.2;
    return 1;
  }
  doAction(a: Actor, kind: string) {
    const b = this.battle!; if (a.busy > 0 || a.st.stun > 0 || b.over) return false;
    const tgt = a.side === 0 ? b.foe : b.me; const sp = SPECIES[a.inst.sp];
    const toT = tgt.mesh.position.clone().sub(a.mesh.position).setY(0); const d = toT.length(); toT.normalize();
    a.mesh.rotation.y = Math.atan2(toT.x, toT.z);
    if (kind === 'light') {
      if (a.comboT <= 0) a.combo = 0; a.combo = (a.combo + 1) % 4 || 1; a.comboT = 0.7; a.busy = 0.28; a.mesh.userData.attack = 1; a.mesh.userData.moveKind = 'light'; a.mesh.userData.moveT = 0.3; a.mesh.userData.moveTotal = 0.3; sfx('swing');
      this.combatFx.slash(a.mesh.position.clone().setY(1.0), toT, sp.accent, a.combo === 3);
      const third = a.combo === 3; this.later(0.12, () => { if (a.mesh.position.distanceTo(tgt.mesh.position) < sp.lightRange + 0.6) this.hit(a, tgt, third ? 16 : 10, null, undefined, third ? 7 : 2, false); });
      return true;
    }
    if (kind === 'heavy') { if (a.en < 15) return false; a.en -= 15; a.busy = 0.6; a.mesh.userData.moveKind = 'heavy'; a.mesh.userData.moveT = 0.62; a.mesh.userData.moveTotal = 0.62;
      this.later(0.3, () => { if (this.battle !== b || b.over) return; a.mesh.userData.attack = 1; sfx('swing'); this.combatFx.slash(a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1), toT, sp.accent, true); if (a.mesh.position.distanceTo(tgt.mesh.position) < sp.lightRange + 1) this.hit(a, tgt, 24, null, undefined, 9, false); }); return true; }
    let ab: Ability; let mult = 1;
    if (kind === 'ult') { if (a.ult < 100) return false; ab = ABILITIES[sp.ult]; mult = 1.8; a.ult = 0; this.shake = 0.4; this.cb.onToast(`${a.inst.nick}: SUPER MOVE!`, a.side ? 'bad' : 'good'); }
    else { ab = this.abilitiesOf(a)[+kind.slice(2)]; if (!ab) return false; if ((a.cds[ab.id] ?? 0) > 0 || a.en < ab.cost) return false; a.en -= ab.cost; a.cds[ab.id] = ab.cd; }
    if (a.side === 0) this.tut(7);
    sfx(ab.type); a.busy = 0.4; a.mesh.userData.attack = 1;
    a.mesh.userData.moveKind = ab.kind; a.mesh.userData.moveT = ab.kind === 'dash' ? 0.36 : ab.kind === 'aoe' ? 0.6 : 0.46; a.mesh.userData.moveTotal = a.mesh.userData.moveT;
    const at = a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1);
    this.combatFx.cast(at, ab.type, mult > 1);
    switch (ab.kind) {
      case 'projectile': { const p = this.projs.find(q => !q.active); if (p) { p.active = true; p.owner = a; p.ab = ab; p.mult = mult; p.life = ab.range / 16; p.mesh.clear(); p.mesh.add(projectileVisual(ab.type)); p.mesh.visible = true; p.mesh.scale.setScalar(mult > 1 ? 1.5 : 1); p.mesh.position.copy(at); p.vel.copy(toT).multiplyScalar(16); p.mesh.rotation.set(0, Math.atan2(toT.x, toT.z), 0); } break; }
      case 'melee': this.later(0.15, () => { if (this.battle !== b || b.over) return; this.combatFx.slash(a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1), toT, ab.color, mult > 1); this.burst(at.clone().addScaledVector(toT, 1.5), ab.color, 10); if (a.mesh.position.distanceTo(tgt.mesh.position) < ab.range + 0.5) this.hit(a, tgt, ab.power * mult, ab.type, ab.status, 6, true); }); break;
      case 'aoe': this.combatFx.wave(a.mesh.position, ab.type, ab.range * (mult > 1 ? 1.3 : 1)); this.burst(at, ab.color, 20, 8); if (d < ab.range * (mult > 1 ? 1.3 : 1)) this.later(0.1, () => this.hit(a, tgt, ab.power * mult, ab.type, ab.status, 8, true)); break;
      case 'dash': a.dashT = 0.25; a.dashDir.copy(toT); a.iframes = 0.25; a.busy = 0.35; this.combatFx.dash(a.mesh.position, toT, ab.type); if (d < ab.range) this.later(0.12, () => this.hit(a, tgt, ab.power * mult, ab.type, ab.status, 7, true)); break;
      case 'heal': a.hp = Math.min(a.maxHp, a.hp + a.maxHp * (ab.power / 100) * mult); this.burst(at, ab.color, 16, 3); this.ring(a.mesh.position, ab.color, 2); break;
      case 'buff': a.st.buff = 5 * mult; this.ring(a.mesh.position, ab.color, 1.5); this.burst(at, ab.color, 10, 2); break;
    }
    return true;
  }
  later(t: number, fn: () => void) { this.pending.push({ t, fn }); }
  hit(att: Actor, def: Actor, power: number, type: ElemType | null, status: Ability['status'], knock: number, special: boolean) {
    const b = this.battle; if (!b || b.over || def.hp <= 0) return;
    const pos = def.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1);
    if (def.iframes > 0) { this.burst(pos, '#fff', 4, 2); if (def.side === 0) this.cb.onToast('Dodged!', 'info'); return; }
    if (def.blocking && this.clock.elapsedTime - def.blockT < 0.25) { att.st.stun = 1.1; sfx('parry'); this.burst(pos, '#fff7a0', 18, 7); this.cb.onToast(def.side === 0 ? 'Perfect block! Hit back!' : 'Blocked!', def.side === 0 ? 'good' : 'bad'); def.ult = Math.min(100, def.ult + 15); return; }
    const A = special ? att.s.sp : att.s.atk; const D = def.s.def * (def.st.buff > 0 ? 1.5 : 1);
    let dmg = (power * (A / D) * (2 + att.inst.lvl * 0.4)) / 4;
    const tm = type ? typeMult(type, SPECIES[def.inst.sp].type) * this.weatherMult(type) : 1; dmg *= tm;
    if (type && type === SPECIES[att.inst.sp].type) dmg *= 1.15;
    const crit = Math.random() < att.s.crit; if (crit) dmg *= 1.6;
    if (att.side === 1) dmg *= ({ Easy: 0.65, Normal: 1, Hard: 1.3 } as const)[this.save.difficulty];
    if (def.blocking) { dmg *= 0.3; sfx('block'); def.en = Math.max(0, def.en - 8); }
    dmg = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    def.hp = Math.max(0, def.hp - dmg); def.mesh.userData.flash = 0.25; this.popText(pos, String(dmg), crit ? '#ffe066' : att.side === 0 ? '#ffffff' : '#ff8a8a'); this.hitStop = crit || knock > 6 ? 0.1 : 0.04; att.ult = Math.min(100, att.ult + dmg * 0.9);
    def.vel.addScaledVector(def.mesh.position.clone().sub(att.mesh.position).setY(0).normalize(), def.blocking ? knock * 0.3 : knock);
    if (!def.blocking) def.busy = Math.max(def.busy, 0.15);
    this.burst(pos, type ? TYPE_COLORS[type] : '#ffffff', crit ? 18 : 8);
    this.combatFx.impact(pos, type ?? SPECIES[att.inst.sp].type, crit || knock > 6);
    sfx(crit ? 'crit' : 'hit'); if (crit || knock > 6) this.shake = Math.max(this.shake, this.settings.reduceMotion ? 0 : 0.2);
    if (att.side === 0) this.tut(5);
    if (crit) this.cb.onToast('Critical hit!', att.side === 0 ? 'good' : 'bad'); else if (tm > 1.1) this.cb.onToast('Super strong!', att.side === 0 ? 'good' : 'bad'); else if (tm < 0.9) this.cb.onToast('Not very strong...', 'info');
    if (status && Math.random() < 0.35 * (1 - def.s.res)) { def.st[status] = status === 'stun' ? 0.9 : 4; this.cb.onToast(`${def.inst.nick} is ${({ burn: 'burning', slow: 'slowed', stun: 'stunned', poison: 'poisoned' })[status]}!`, 'info'); }
    if (def.hp <= 0) this.faint(def);
  }
  faint(a: Actor) {
    const b = this.battle!; sfx('faint'); a.inst.hp = 0; a.busy = 99; this.burst(a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1), '#ffffff', 20, 4);
    if (a.side === 1) {
      const sp = SPECIES[a.inst.sp]; b.xpPool += Math.round(a.inst.lvl * 14 * (b.kind === 'trainer' ? 1.5 : 1) * (1 + (sp.rarity - 1) * 0.25));
      if (b.kind === 'trainer' && b.ei < b.team.length - 1) this.later(1.3, () => { if (!this.battle) return; const pos = a.mesh.position.clone(); this.scene.remove(a.mesh); b.ei++; b.foe = this.makeActor(b.team[b.ei], 1, pos); cry(b.ei * 13, 1); this.cb.onToast(`${b.trainer!.name} sends ${b.foe.inst.nick}!`, 'info'); });
      else this.endBattle('win');
    } else {
      a.inst.fainted = true; this.cb.onToast(`${a.inst.nick} is tired out!`, 'bad');
      const next = b.playerTeam.find(c => !c.fainted && c.hp > 0);
      if (next) this.later(1, () => this.switchTo(next)); else this.endBattle('lose');
    }
  }
  switchTo(inst: CreatureInst) {
    const b = this.battle; if (!b || b.over) return;
    b.me.inst.hp = Math.round(b.me.hp); const pos = b.me.mesh.position.clone(); this.scene.remove(b.me.mesh);
    b.me = this.makeActor(inst, 0, pos); b.participants.add(inst.uid); b.switchCd = 3; this.burst(pos.clone().setY(1), '#ffffff', 14); this.cb.onToast(`Go, ${inst.nick}!`, 'info'); cry(inst.sp.length * 7, 1);
  }
  tryCapture() {
    const b = this.battle!; if (b.kind !== 'wild') { this.cb.onToast("You can't catch a trainer's pet!", 'bad'); return; }
    if (b.capture || b.over) return;
    const pod = (this.save.items[this.usePod] ?? 0) > 0 ? this.usePod : (this.save.items.lumenpod ?? 0) > 0 ? 'lumenpod' : (this.save.items.grandpod ?? 0) > 0 ? 'grandpod' : null;
    if (!pod) { this.cb.onToast('No catch balls left! Buy more at the shop.', 'bad'); return; }
    this.save.items[pod]--; this.tut(8); sfx('throw');
    const f = b.foe; const sp = SPECIES[f.inst.sp];
    let chance = ((1 - f.hp / f.maxHp) * 0.75 + 0.08) * ITEMS[pod].value * ([1, 1.25, 1, 0.65, 0.25][sp.rarity]);
    if (f.st.burn > 0 || f.st.poison > 0 || f.st.slow > 0 || f.st.stun > 0) chance *= 1.3;
    chance *= clamp(1 + (b.me.inst.lvl - f.inst.lvl) * 0.04, 0.5, 1.3);
    if (this.isNight() && sp.type === 'shadow') chance *= 1.2; if (this.save.difficulty === 'Easy') chance *= 1.2;
    chance = clamp(chance, 0.04, 0.95);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), toon(pod === 'grandpod' ? '#4ad0ff' : '#ffe07a', { emissive: pod === 'grandpod' ? '#2a90c0' : '#c0a030', emissiveIntensity: 0.6 })); m.position.copy(b.me.mesh.position).setY(1.2); this.scene.add(m);
    b.capture = { t: 0, shakes: 0, success: Math.random() < chance, pod: m };
  }
  updateCapture(dt: number) {
    const b = this.battle!; const c = b.capture!; c.t += dt; const f = b.foe;
    if (c.t < 0.6) { const k = c.t / 0.6; c.pod.position.lerpVectors(b.me.mesh.position.clone().setY(b.floorY + 1.2), f.mesh.position.clone().setY(b.floorY + 1), k); c.pod.position.y += Math.sin(k * Math.PI) * 2; c.pod.rotation.x += dt * 20; return; }
    if (c.t < 0.9) { f.mesh.scale.setScalar(Math.max(0.01, 1 - (c.t - 0.6) / 0.3)); c.pod.position.y = b.floorY + 0.3; return; }
    const sh = Math.floor((c.t - 0.9) / 0.6);
    c.pod.rotation.z = Math.sin(c.t * 18) * 0.4 * (((c.t - 0.9) % 0.6) < 0.3 ? 1 : 0);
    if (sh > c.shakes && sh <= 3) { c.shakes = sh; sfx('shake'); if (!c.success && sh === 1 + Math.floor(Math.random() * 3)) return this.captureFail(); }
    if (c.t > 0.9 + 0.6 * 3 + 0.2) { if (c.success) this.captureOk(); else this.captureFail(); }
  }
  captureFail() { const b = this.battle!; this.scene.remove(b.capture!.pod); b.foe.mesh.scale.setScalar(1); b.capture = undefined; sfx('escape'); this.burst(b.foe.mesh.position.clone().setY(b.floorY + 1), '#ffe07a', 14); this.cb.onToast(`Oh no! ${b.foe.inst.nick} broke free!`, 'bad'); b.foe.ult = Math.min(100, b.foe.ult + 30); }
  captureOk() {
    const b = this.battle!; const c = b.capture!; sfx('catch'); this.burst(c.pod.position, '#ffe07a', 30, 5); this.emoji(c.pod.position.clone().setY(1), '⭐', 5); this.scene.remove(c.pod); b.capture = undefined;
    const inst = b.foe.inst; inst.hp = Math.max(1, Math.round(b.foe.hp)); inst.caughtAt = this.area; inst.friend = 10;
    if (this.save.team.length < 8) this.save.team.push(inst); else { this.save.storage.push(inst); this.cb.onToast('Team is full — sent to your home.', 'info'); }
    if (!this.save.caught.includes(inst.sp)) this.save.caught.push(inst.sp);
    this.save.stats.captures++; this.addCard('c_' + inst.sp); this.quest('s1'); this.ach('first_capture'); if (this.save.stats.captures >= 5) this.ach('five_captures');
    this.daily('capture');
    b.xpPool += Math.round(inst.lvl * 8); this.cb.onToast(`Caught ${inst.nick}! 🎉`, 'good'); this.endBattle('caught');
  }
  endBattle(res: 'win' | 'lose' | 'fled' | 'caught') { const b = this.battle!; if (b.over) return; b.over = true; b.result = res; b.endT = res === 'fled' ? 0.3 : 1.8; if (res === 'win') sfx('victory'); }
  finishBattle() {
    const b = this.battle!; const res = b.result!;
    // Remove and dispose every temporary arena object so no ropes, posts or glow rings survive the fight.
    b.ring.removeFromParent(); b.ring.traverse(o => { const obj = o as THREE.Mesh; if (!obj.isMesh) return; obj.geometry?.dispose(); const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach(m => m?.dispose()); });
    if (b.oppNpc && b.oppPos) b.oppNpc.pos.copy(b.oppPos);
    this.projs.forEach(p => { p.active = false; p.mesh.visible = false; }); this.combatFx.clear();
    b.me.inst.hp = Math.round(b.me.hp); this.scene.remove(b.me.mesh);
    if (res === 'fled' && b.wild && !b.wild.boss) { b.wild.ignore = 6; b.wild.state = 'flee'; b.wild.t = 3; b.wild.mesh.scale.setScalar(1); this.wilds.push(b.wild); b.wild.inst.hp = Math.round(b.foe.hp); }
    else if (b.wild?.boss) { b.wild.mesh.position.copy(b.wild.home); b.wild.mesh.scale.setScalar((b.wild.bossId === 'sky' || b.wild.bossId === 'zephyr') ? 2.5 : b.wild.bossId === 'deep' ? 3 : b.wild.bossId === 'forest' || b.wild.bossId === 'desert' || b.wild.bossId === 'frost' ? 2.8 : 2.1); this.scene.add(b.wild.mesh); }
    else this.scene.remove(b.foe.mesh);
    if (res === 'win' || res === 'caught') {
      this.save.stats.wins++; this.tut(10); this.awardXp(b.xpPool, b.participants);
      this.save.team.forEach(c => { if (b.participants.has(c.uid)) this.friend(c, 2); });
      if (b.kind === 'wild') {
        this.save.money += 10 + Math.floor(Math.random() * 15);
        if (res === 'win') this.daily('wildWin');
      }
      if (b.trainer) {
        const t = b.trainer; const first = !this.save.flags['beat_' + t.id];
        this.save.flags['beat_' + t.id] = true; this.save.money += Math.round(t.money * (first ? 1 : 0.5)); this.cb.onToast(`You won ${t.money} coins!`, 'good'); sfx('coin');
        if (first && t.card) this.addCard(t.card);
        if (t.id.startsWith('arena_')) { this.ach('arena'); this.save.items.grandpod = (this.save.items.grandpod || 0) + 2; this.save.items.stew = (this.save.items.stew || 0) + 1; this.save.worldSystems ??= { eggs: [], skills: {}, explored: [], climateClaim: '', homeBuilds: [], rankXp: 0, bossClaims: [], recipes: [] }; this.save.worldSystems.rankXp += 180; this.cb.onToast('Real-time 3v3 League prize: 2 Grand Pods, Stew and 180 League XP!', 'good'); }
        if (t.id === 'pip' || t.id === 'bram') this.quest('t1');
        if (t.id === 'kael') { this.quest('m3'); this.ach('rival'); }
        if (t.id === 'morrow') { this.quest('m4'); this.ach('boss'); this.save.flags.postgame = true; }
        queueTrainerGift(this.save, t.id, t.name);
        this.cb.onToast(`A gift from ${t.name} is waiting.`, 'good');
      }
    }
    if (res === 'win' && b.wild?.boss && b.wild.bossId) {
      const id = b.wild.bossId; this.save.flags[`boss_${id}_defeated`] = true;
      const rewards: Record<string, { coins:number; diamonds:number; color:string }> = { sky:{coins:500,diamonds:3,color:'#70e9ff'}, zephyr:{coins:560,diamonds:3,color:'#9fe0d0'}, cave:{coins:250,diamonds:1,color:'#a47bff'}, forest:{coins:320,diamonds:1,color:'#65d98a'}, desert:{coins:380,diamonds:2,color:'#d6a15e'}, frost:{coins:420,diamonds:2,color:'#8eeaff'}, deep:{coins:650,diamonds:4,color:'#b17bdb'} };
      const reward = rewards[id] ?? rewards.cave; this.save.money += reward.coins; this.save.items.diamond = (this.save.items.diamond || 0) + reward.diamonds;
      this.adventureCineT = 2.8; this.adventureCineKind = 'victory';
      this.cb.onToast(`🏆 ${b.wild.inst.nick} defeated! +${reward.coins} coins and ${reward.diamonds} Portal Diamonds.`, 'ach');
      this.burst(b.foe.mesh.position.clone().setY(1.5), reward.color, 56, 10); this.ring(b.foe.mesh.position, reward.color, 6);
      sfx('victory');
    }
    if (res === 'lose') {
      const lost = Math.floor(this.save.money * 0.1); this.save.money -= lost;
      const pp = this.player.position;
      if (inCore(pp.x, pp.z) && pp.z < 40) { this.save.team.forEach(c => { c.fainted = false; c.hp = Math.ceil(stats(c).hp * 0.3); }); this.cb.onToast(`Your pets are tired. Rest at home! (-${lost} coins)`, 'bad'); }
      else {
        let cx = pp.x + 2, cz = pp.z + 2; if (townAt(cx, cz, 40)) { cx += 45; } if (!this.save.quests.m3.done && Math.hypot(cx, cz - 205) < 30) cz = 170;
        this.makeCamp(cx, cz); this.teleport(cx, cz + 4); this.player.rotation.y = Math.PI;
        this.cb.onToast(`You made a camp. Sleep in the tent to heal! (-${lost} coins)`, 'bad');
      }
      this.npcs.forEach(n => (n.engaged = false));
    }
    this.battle = null; if (this.partner) this.partner.visible = true; this.refreshPartner();
    this.cb.onBattleEnd(res, b.trainer?.id); this.cb.onChange(); this.autosave();
    if (this.queuedEvos.length) this.runEvos();
  }
  friend(c: CreatureInst, n: number) { c.friend = Math.min(100, c.friend + n * (c.pers === 'Loyal' ? 1.5 : 1)); if (c.friend >= 100) this.ach('bestfriend'); }
  awardXp(xp: number, parts: Set<string>) {
    if (xp <= 0) return; let lvUp = false;
    this.save.team.forEach(c => {
      const share = parts.has(c.uid) ? xp : Math.round(xp * 0.4); if (c.lvl >= MAX_LEVEL) return; c.xp += share;
      while (c.xp >= xpNext(c.lvl) && c.lvl < MAX_LEVEL) { const before = stats(c).hp; c.xp -= xpNext(c.lvl); c.lvl++; c.hp = Math.min(stats(c).hp, c.hp + stats(c).hp - before); lvUp = true; this.cb.onToast(`⬆ ${c.nick} is now level ${c.lvl}!`, 'good'); if (c.lvl >= 10) this.ach('lvl10'); }
      if (this.canEvolve(c) && !this.queuedEvos.includes(c)) this.queuedEvos.push(c);
    });
    if (lvUp) sfx('level');
  }
  canEvolve(c: CreatureInst) { const s = SPECIES[c.sp]; if (!s.evolvesTo || c.lvl < (s.evoLevel ?? 99)) return false; if (s.evoCond === 'night' && !this.isNight()) return false; if (s.evoCond === 'friendship' && c.friend < 60) return false; return true; }
  checkEvos() { this.save.team.forEach(c => { if (this.canEvolve(c) && !this.queuedEvos.includes(c)) this.queuedEvos.push(c); }); if (this.queuedEvos.length && !this.battle) this.runEvos(); }
  runEvos() { const c = this.queuedEvos.shift(); if (!c) return; this.cb.onEvolve(c, c.sp, SPECIES[c.sp].evolvesTo!); sfx('evolve'); }
  completeEvolution(c: CreatureInst, to: string) {
    const was = SPECIES[c.sp].name; const ratio = c.hp / stats(c).hp; c.sp = to; if (c.nick === was) c.nick = SPECIES[to].name; c.hp = Math.round(stats(c).hp * ratio);
    if (!this.save.caught.includes(to)) this.save.caught.push(to); this.addCard('c_' + to); this.save.stats.evolutions++; this.ach('evolve');
    this.refreshPartner(); this.cb.onChange(); this.autosave();
    if (this.queuedEvos.length) setTimeout(() => this.runEvos(), 400);
  }
  updateActor(a: Actor, dt: number) {
    const b = this.battle!;
    a.busy -= dt; a.iframes -= dt; a.dodgeCd -= dt; a.comboT -= dt;
    for (const k in a.cds) a.cds[k] = Math.max(0, a.cds[k] - dt);
    a.en = Math.min(100, a.en + dt * (a.inst.pers === 'Energetic' ? 18 : 13));
    const st = a.st; (Object.keys(st) as (keyof Status)[]).forEach(k => (st[k] = Math.max(0, st[k] - dt)));
    if ((st.burn > 0 || st.poison > 0) && a.hp > 0) { a.hp -= a.maxHp * (st.burn > 0 ? 0.03 : 0.022) * dt; if (Math.random() < dt * 4) this.burst(a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1), st.burn > 0 ? '#ff6a2b' : '#a04ad0', 1, 2); if (a.hp <= 0) { a.hp = 0; this.faint(a); } }
    if (a.dashT > 0) { a.dashT -= dt; a.mesh.position.addScaledVector(a.dashDir, 28 * dt); }
    a.mesh.position.addScaledVector(a.vel, dt); a.vel.multiplyScalar(Math.pow(0.02, dt));
    const off = a.mesh.position.clone().sub(b.center).setY(0);
    if (off.length() > 8.2 && !(a.side === 1 && a.fleeing)) { a.mesh.position.copy(b.center).add(off.setLength(8.2)); a.vel.multiplyScalar(0.3); }
    this.collide(a.mesh.position, 0.5);
  }
  battleInput(dt: number) {
    const b = this.battle!; const a = b.me;
    a.blocking = this.held('block') && a.busy <= 0 && a.en > 0; if (this.act('block')) a.blockT = this.clock.elapsedTime;
    if (a.blocking) a.en = Math.max(0, a.en - dt * 6);
    const mv = this.moveVec(); let moving = false;
    if (a.st.stun <= 0 && a.dashT <= 0 && a.hp > 0) {
      if (mv.lengthSq() > 0 && a.busy <= 0.1) { const spd = (4 + a.s.spd / 25) * (a.st.slow > 0 ? 0.55 : 1) * (a.blocking ? 0.4 : 1); a.mesh.position.addScaledVector(mv, spd * dt); a.mesh.rotation.y = Math.atan2(mv.x, mv.z); moving = true; }
      if (this.act('dodge') && a.dodgeCd <= 0 && a.en >= 10) { a.en -= 10; a.dodgeCd = 0.8; a.iframes = 0.35; a.dashT = 0.18; a.dashDir.copy(mv.lengthSq() ? mv : new THREE.Vector3(Math.sin(a.mesh.rotation.y + Math.PI / 2), 0, Math.cos(a.mesh.rotation.y + Math.PI / 2))); sfx('dodge'); this.burst(a.mesh.position.clone().setY(0.3), '#ffffff', 6, 2); this.tut(6); }
      if (this.act('light')) this.doAction(a, 'light');
      if (this.act('heavy')) this.doAction(a, 'heavy');
      ['ab1', 'ab2', 'ab3'].forEach((k, i) => { if (this.act(k) && !this.doAction(a, 'ab' + i)) { const ab = this.abilitiesOf(a)[i]; if (ab && a.busy <= 0) this.cb.onToast(a.en < ab.cost ? 'Not enough power' : 'Wait a moment...', 'info'); } });
      if (this.act('ult') && !this.doAction(a, 'ult') && a.ult < 100) this.cb.onToast('Super move not ready yet', 'info');
    }
    if (this.act('capture')) this.tryCapture();
    if (this.act('item')) this.battleItem();
    if (this.act('switch') && b.switchCd <= 0) { const team = b.playerTeam; const i = team.indexOf(a.inst); for (let k = 1; k <= team.length; k++) { const c = team[(i + k) % team.length]; if (c !== a.inst && !c.fainted && c.hp > 0) { this.switchTo(c); break; } } }
    if (this.act('flee')) { if (b.kind === 'trainer') this.cb.onToast("Can't run from a trainer!", 'bad'); else if (Math.random() < 0.75 || a.mesh.position.distanceTo(b.foe.mesh.position) > 7) { this.cb.onToast('You ran away.', 'info'); this.endBattle('fled'); } else this.cb.onToast("Couldn't run!", 'bad'); }
    if (this.pressed.has('v')) { this.usePod = this.usePod === 'lumenpod' ? 'grandpod' : 'lumenpod'; this.cb.onToast(`Using ${ITEMS[this.usePod].name}`, 'info'); }
    animateCreature(a.mesh, dt, moving);
  }
  battleItem() {
    const a = this.battle!.me;
    if ((this.save.items.sunberry ?? 0) > 0 && a.hp < a.maxHp) { this.save.items.sunberry--; a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.4); this.friend(a.inst, 2); sfx('pickup'); this.burst(a.mesh.position.clone().setY((this.battle?.floorY ?? 0) + 1), '#7aff7a', 12, 3); this.emoji(a.mesh.position.clone().setY(1.4), '🍊', 1); this.cb.onToast('Ate a Sunberry!', 'good'); a.busy = 0.5; }
    else if ((this.save.items.mintleaf ?? 0) > 0) { this.save.items.mintleaf--; a.en = 100; a.st = { burn: 0, slow: 0, stun: 0, poison: 0, buff: a.st.buff }; this.cb.onToast('Used Mintleaf!', 'good'); }
    else this.cb.onToast('No healing items!', 'bad');
  }
  aiThink(dt: number) {
    const b = this.battle!; const f = b.foe, me = b.me; if (f.hp <= 0 || b.capture) return;
    const aggr = (b.wild?.boss ? 0.95 : b.trainer?.aggr ?? 0.45) * ({ Easy: 0.7, Normal: 1, Hard: 1.3 } as const)[this.save.difficulty];
    // Guardian combat uses readable telegraphs and three escalating phases.
    if (b.wild?.boss) {
      const ratio = f.hp / f.maxHp;
      const nextPhase = ratio <= 0.32 ? 3 : ratio <= 0.66 ? 2 : 1;
      if (nextPhase > b.bossPhase) {
        b.bossPhase = nextPhase; b.bossMoveCd = 1.35; b.bossTell = 0;
        this.shake = this.settings.reduceMotion ? 0 : 0.45; this.flashT = 0.18;
        const sky = b.wild.bossId === 'sky'; const color = sky ? '#70e9ff' : '#a47bff';
        this.burst(f.mesh.position.clone().setY(1.2), color, nextPhase === 3 ? 64 : 32, nextPhase === 3 ? 10 : 7);
        this.ring(f.mesh.position, color, nextPhase === 3 ? 10 : 4 + nextPhase);
        // Final-form transformation: a visible size surge, elemental aura and signature pose.
        const baseScale = sky ? 2.5 : 2.1; f.mesh.scale.setScalar(baseScale * (nextPhase === 3 ? 1.24 : nextPhase === 2 ? 1.08 : 1));
        f.mesh.rotation.z = sky ? -0.18 : 0.18; f.mesh.userData.bossForm = nextPhase;
        f.mesh.traverse(o => { const m = o as THREE.Mesh; const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; mats.forEach((ma: any) => { if (ma.emissive) { ma.emissive.set(color); ma.emissiveIntensity = nextPhase === 3 ? 0.9 : nextPhase === 2 ? 0.35 : 0.08; } }); });
        this.cb.onToast(nextPhase === 3 ? (sky ? 'AURALIS AWAKENS: TEMPEST ASCENDANT!' : 'GLOAM AWAKENS: ECLIPSE COLOSSUS!') : `${f.inst.nick} enters phase ${nextPhase}!`, 'bad');
        if (nextPhase === 3) { this.adventureCineT = 2.1; this.adventureCineKind = 'intro'; this.dist = 13.5; }
        sfx('crit');
      }
      const toPlayer = me.mesh.position.clone().sub(f.mesh.position).setY(0); const distance = toPlayer.length(); toPlayer.normalize();
      if (b.bossIntro > 0) { animateCreature(f.mesh, dt, false); return; }
      if (b.bossTell > 0) {
        b.bossTell -= dt; f.mesh.userData.attack = 1; f.mesh.rotation.z = Math.sin(this.clock.elapsedTime * 18) * 0.08;
        if (b.bossTell <= 0) {
          const kind = b.bossMoveKind; const color = b.wild.bossId === 'sky' ? '#70e9ff' : '#a47bff';
          const sky = b.wild.bossId === 'sky';
          if (kind === 'dash') {
            // Gloam vanishes into a short shadow lunge; Auralis rises, then dives like a comet.
            if (sky) { f.mesh.position.y = 2.2; f.mesh.rotation.x = -0.45; }
            else { f.mesh.position.addScaledVector(toPlayer, 1.4); f.mesh.rotation.z = 0.32; }
            f.mesh.position.addScaledVector(toPlayer, sky ? 6.2 + b.bossPhase : 4.8 + b.bossPhase * 1.2);
            this.combatFx.slash(f.mesh.position.clone().setY(b.floorY + 1), me.mesh.position.clone().setY(1), color, true);
            if (f.mesh.position.distanceTo(me.mesh.position) < (sky ? 4.1 : 3.2)) this.hit(f, me, (sky ? 25 : 22) + b.bossPhase * 9, null, sky ? 'slow' : 'stun', 8, true);
            f.mesh.position.y = b.floorY; f.mesh.rotation.x = 0;
            if (sky && b.bossPhase >= 2) { this.ring(f.mesh.position, color, 5.5); if (me.mesh.position.distanceTo(f.mesh.position) < 5.5) this.hit(f, me, 12 + b.bossPhase * 4, null, 'slow', 5, true); }
          } else if (kind === 'slam') {
            this.shake = this.settings.reduceMotion ? 0 : 0.55; this.ring(f.mesh.position, color, (sky ? 8.5 : 7) + b.bossPhase);
            if (sky) { this.burst(f.mesh.position.clone().setY(2.5), '#c9f7ff', 22, 5); if (distance < 5.8 + b.bossPhase * 0.7) this.hit(f, me, 23 + b.bossPhase * 9, null, 'slow', 10, true); }
            else { this.burst(f.mesh.position.clone().setY(0.7), '#4b286f', 28, 5); if (distance < 5.2 + b.bossPhase * 0.7) this.hit(f, me, 26 + b.bossPhase * 10, null, 'poison', 10, true); }
          } else {
            this.burst(f.mesh.position.clone().setY(1.2), color, sky ? 48 : 36, sky ? 10 : 8); this.ring(f.mesh.position, color, sky ? 10 : 8);
            if (sky) { this.ring(f.mesh.position, '#e5fbff', 6); if (distance < 8.2) this.hit(f, me, 21 + b.bossPhase * 8, null, 'slow', 8, true); }
            else { if (distance < 7.2) this.hit(f, me, 19 + b.bossPhase * 8, null, 'poison', 8, true); }
          }
          f.mesh.rotation.z = 0; f.mesh.userData.attack = 0; b.bossMove = ''; b.bossMoveKind = ''; b.bossMoveCd = Math.max(0.8, 2.5 - b.bossPhase * 0.45);
        }
        animateCreature(f.mesh, dt, false); return;
      }
      b.bossMoveCd -= dt;
      if (b.bossMoveCd <= 0 && f.busy <= 0 && f.st.stun <= 0) {
        const sky = b.wild.bossId === 'sky';
        const options: ('slam' | 'dash' | 'burst')[] = b.bossPhase === 1 ? (sky ? ['dash', 'burst'] : ['slam', 'dash']) : b.bossPhase === 2 ? ['slam', 'dash', 'burst'] : (sky ? ['dash', 'burst', 'slam'] : ['slam', 'dash', 'burst']);
        // In the final form each guardian executes a recognizable three-move signature chain.
        const finalChain: ('slam' | 'dash' | 'burst')[] = sky ? ['dash', 'burst', 'slam'] : ['slam', 'dash', 'burst'];
        const move = b.bossPhase === 3 ? finalChain[b.bossComboStep % finalChain.length] : options[Math.floor(Math.random() * options.length)];
        if (b.bossPhase === 3) b.bossComboStep++;
        b.bossMoveKind = move;
        b.bossMove = sky ? (move === 'slam' ? 'GLACIAL SKYFALL' : move === 'dash' ? 'COMET DIVE' : 'TEMPEST NOVA') : (move === 'slam' ? 'ECLIPSE RUPTURE' : move === 'dash' ? 'PHANTOM POUNCE' : 'UMBRAL DEVOUR');
        b.bossTell = move === 'dash' ? (sky ? 1.05 : 0.72) : 1.2;
        this.cb.onToast(`${f.inst.nick}: ${b.bossMove}! Dodge now!`, 'bad'); this.ring(f.mesh.position, b.wild.bossId === 'sky' ? '#70e9ff' : '#a47bff', move === 'slam' ? 5 : 3);
      }
      if (distance > 3.5 && f.busy <= 0) { f.mesh.position.addScaledVector(toPlayer, (2.4 + b.bossPhase * 0.5) * dt); f.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z); }
      else if (distance < 2.4 && f.busy <= 0) f.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      animateCreature(f.mesh, dt, distance > 3.5); return;
    }
    const toMe = me.mesh.position.clone().sub(f.mesh.position).setY(0); const d = toMe.length(); toMe.normalize();
    let moving = false; f.blocking = false;
    if (f.st.stun <= 0 && f.dashT <= 0) {
      if (b.kind === 'wild' && !b.wild?.boss && !f.fleeing && f.hp / f.maxHp < 0.22 && (f.inst.pers === 'Shy' || Math.random() < dt * 0.15)) { f.fleeing = true; this.cb.onToast(`${f.inst.nick} is running away!`, 'info'); }
      if (f.fleeing) { f.mesh.position.addScaledVector(toMe, -(3 + f.s.spd / 40) * dt * (f.st.slow > 0 ? 0.5 : 1)); f.mesh.rotation.y = Math.atan2(-toMe.x, -toMe.z); if (f.mesh.position.distanceTo(b.center) > 17) { this.cb.onToast(`${f.inst.nick} got away!`, 'bad'); this.endBattle('fled'); } animateCreature(f.mesh, dt, true); return; }
      if (me.busy > 0.1 && d < 4 && f.busy <= 0 && Math.random() < aggr * dt * 3) { if (Math.random() < 0.5 && f.dodgeCd <= 0) { f.dodgeCd = 1.5; f.iframes = 0.3; f.dashT = 0.15; f.dashDir.set(-toMe.z, 0, toMe.x); } else { f.blocking = true; f.blockT = this.clock.elapsedTime - (Math.random() < aggr * 0.3 ? 0 : 1); } }
      f.aiT -= dt;
      if (!f.intent) { const abs = this.abilitiesOf(f).map((x, i) => ({ x, i })).filter(o => (f.cds[o.x.id] ?? 0) <= 0 && f.en >= o.x.cost); f.intent = f.ult >= 100 ? 'ult' : abs.length && Math.random() < 0.55 ? 'ab' + abs[Math.floor(Math.random() * abs.length)].i : Math.random() < 0.3 ? 'heavy' : 'light'; }
      const ab = f.intent === 'ult' ? ABILITIES[SPECIES[f.inst.sp].ult] : f.intent.startsWith('ab') ? this.abilitiesOf(f)[+f.intent.slice(2)] : null;
      const want = ab ? (ab.kind === 'heal' || ab.kind === 'buff' ? 99 : ab.range * 0.8) : SPECIES[f.inst.sp].lightRange;
      if (d > want && f.busy <= 0) { f.mesh.position.addScaledVector(toMe, (3.4 + f.s.spd / 30) * (f.st.slow > 0 ? 0.55 : 1) * dt); f.mesh.rotation.y = Math.atan2(toMe.x, toMe.z); moving = true; }
      else if (f.aiT <= 0 && f.busy <= 0) { if (!this.doAction(f, f.intent)) f.intent = 'light'; else { f.intent = ''; f.aiT = (0.5 + Math.random() * 0.9) / (0.5 + aggr); } }
      else if (d < 2.5 && f.busy <= 0 && Math.random() < dt) { f.mesh.position.addScaledVector(new THREE.Vector3(-toMe.z, 0, toMe.x), 3 * dt); moving = true; }
    }
    animateCreature(f.mesh, dt, moving);
  }
  updateBattle(dt: number) {
    const b = this.battle!;
    if (b.over) { b.endT -= dt; animateCreature(b.me.mesh, dt, false); if (b.result === 'win') b.me.mesh.userData.body.position.y += Math.abs(Math.sin(b.endT * 8)) * 0.5; if (b.endT <= 0) this.finishBattle(); return; }
    const prevC = Math.ceil(b.count); b.count -= dt;
    if (b.count > 0) {
      b.bossIntro = Math.max(0, b.bossIntro - dt);
      if (Math.ceil(b.count) !== prevC) sfx('ui');
      [b.me, b.foe].forEach(a => { const to = (a === b.me ? b.foe : b.me).mesh.position; a.mesh.rotation.y = Math.atan2(to.x - a.mesh.position.x, to.z - a.mesh.position.z); animateCreature(a.mesh, dt, false); });
      const pp = this.player.position; pp.lerp(b.center.clone().addScaledVector(b.side, 11.5), dt * 4); this.player.lookAt(b.foe.mesh.position.x, pp.y, b.foe.mesh.position.z); animateHuman(this.player, dt, 0);
      return;
    }
    if (prevC === 1 && b.count <= 0) { sfx('crit'); this.shake = this.settings.reduceMotion ? 0 : 0.25; }
    b.switchCd -= dt;
    if (b.capture) { this.updateCapture(dt); animateCreature(b.me.mesh, dt, false); return; }
    this.battleInput(dt); this.aiThink(dt);
    this.updateActor(b.me, dt); if (this.battle === b) this.updateActor(b.foe, dt);
    for (const p of this.projs) {
      if (!p.active) continue; p.life -= dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.rotation.z += dt * 8;
      if (Math.random() < 0.6) this.burst(p.mesh.position, p.ab!.color, 1, 1);
      const tgt = p.owner!.side === 0 ? b.foe : b.me;
      if (p.mesh.position.distanceTo(tgt.mesh.position.clone().setY(1)) < 1.2 * SPECIES[tgt.inst.sp].scale + 0.3) { this.hit(p.owner!, tgt, p.ab!.power * p.mult, p.ab!.type, p.ab!.status, 4, true); p.life = 0; }
      if (p.life <= 0) { p.active = false; p.mesh.visible = false; }
    }
    const pp = this.player.position; pp.lerp(b.center.clone().addScaledVector(b.side, 11.5), dt * 4); if (b.oppNpc) { b.oppNpc.mesh.lookAt(b.foe.mesh.position.x, 0, b.foe.mesh.position.z); animateHuman(b.oppNpc.mesh, dt, 0); } this.player.lookAt(b.foe.mesh.position.x, 0, b.foe.mesh.position.z); animateHuman(this.player, dt, 0);
  }

  // ---------- explore ----------
  moveVec() {
    const v = new THREE.Vector3(); const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (this.keys.has('w') || this.keys.has('arrowup')) v.add(f); if (this.keys.has('s') || this.keys.has('arrowdown')) v.sub(f);
    if (this.keys.has('d') || this.keys.has('arrowright')) v.add(r); if (this.keys.has('a') || this.keys.has('arrowleft')) v.sub(r);
    for (const g of [this.padAxes, this.joy]) if (Math.hypot(g[0], g[1]) > (g === this.padAxes ? 0.3 : 0.15)) { v.addScaledVector(r, g[0]); v.addScaledVector(f, -g[1]); }
    return v.lengthSq() > 1 ? v.normalize() : v;
  }
  pollPad(dt: number) {
    const gp = navigator.getGamepads?.()[0]; if (!gp) { this.padAxes = [0, 0]; return; }
    this.padAxes = [gp.axes[0] ?? 0, gp.axes[1] ?? 0];
    const rx = gp.axes[2] ?? 0, ry = gp.axes[3] ?? 0; if (Math.abs(rx) > 0.2) { this.yaw -= rx * dt * 2.5 * this.settings.sens; this.rotated += 5; } if (Math.abs(ry) > 0.2) this.pitch = clamp(this.pitch + ry * dt * 1.5, -0.75, 1.25);
    const map: [number, string][] = [[0, 'light'], [2, 'heavy'], [1, 'dodge'], [3, 'capture'], [4, 'ab1'], [5, 'ab2'], [7, 'ab3'], [11, 'ult'], [8, 'switch'], [6, 'block'], [12, 'item'], [13, 'flee']];
    map.forEach(([i, a]) => { const on = !!gp.buttons[i]?.pressed; if (on && !this.pads[i]) { this.pressed.add('__pad_' + a); if (!this.battle && i === 0) this.pressed.add(this.settings.keys.interact); if (a === 'block' && this.battle) this.battle.me.blockT = this.clock.elapsedTime; } if (on) this.keys.add('__padh_' + a); else this.keys.delete('__padh_' + a); this.pads[i] = on; });
    const st = !!gp.buttons[9]?.pressed; if (st && !this.pads[9]) this.cb.onMenu(); this.pads[9] = st;
  }

  // Door + house transitions
  enterHome() { if (!this.trans) { this.firstPerson = false; this.player.visible = true; this.trans = { t: 0, dir: 'in', done: false }; sfx('ui'); } }
  exitHome() { if (!this.trans) { this.trans = { t: 0, dir: 'out', done: false }; sfx('ui'); } }
  updateTrans(dt: number) {
    const tr = this.trans!; tr.t += dt; const door = this.world.homeDoor;
    if (tr.dir === 'in') {
      if (tr.t < 0.9) { door.rotation.y = -Math.min(1, tr.t / 0.45) * 1.7; const tgt = new THREE.Vector3(-18, 0, -10.6); const d = tgt.clone().sub(this.player.position).setY(0); if (d.length() > 0.1) { this.player.position.addScaledVector(d.normalize(), Math.min(d.length(), 3 * dt)); this.player.rotation.y = Math.atan2(d.x, d.z); } animateHuman(this.player, dt, 3); }
      this.hud.fade = clamp((tr.t - 0.5) / 0.4, 0, 1);
      if (tr.t >= 0.9 && !tr.done) { tr.done = true; this.indoor = true; this.teleport(IX, 4.3, IY); this.player.rotation.y = Math.PI; this.yaw = 0; this.pitch = 0.55; door.rotation.y = 0; this.spawnHomePets(); playMusic('home'); this.say('Home sweet home!'); this.cb.onChange(); }
      if (tr.t > 0.9) this.hud.fade = 1 - clamp((tr.t - 1.0) / 0.5, 0, 1);
      if (tr.t > 1.5) { this.trans = null; this.hud.fade = 0; }
    } else {
      this.hud.fade = clamp(tr.t / 0.45, 0, 1);
      if (tr.t >= 0.5 && !tr.done) { tr.done = true; this.indoor = false; this.clearHomePets(); this.teleport(-18, -9.6); this.player.rotation.y = 0; this.yaw = Math.PI; this.pitch = 0.32; door.rotation.y = -1.7; this.cb.onChange(); }
      if (tr.t > 0.5) { this.hud.fade = 1 - clamp((tr.t - 0.55) / 0.45, 0, 1); door.rotation.y = -1.7 * (1 - clamp((tr.t - 0.8) / 0.4, 0, 1)); animateHuman(this.player, dt, 0); }
      if (tr.t > 1.25) { this.trans = null; this.hud.fade = 0; door.rotation.y = 0; }
    }
    this.camFollowSnap = true;
  }
  camFollowSnap = false;
  spawnHomePets() {
    this.clearHomePets(); const decor = this.save.home.decor;
    Object.entries(this.world.decor).forEach(([id, o]) => (o.visible = decor.includes(id)));
    this.save.team.concat(this.save.storage).slice(0, 10).forEach((c, i) => {
      if (c.uid === this.partnerUid) return;
      const m = buildCreature(c.sp, c.acc); m.position.set(IX - 4 + (i % 4) * 2.5, IY, 1 + Math.floor(i / 4) * 1.5); this.scene.add(m);
      this.homePets.push({ mesh: m, inst: c, target: m.position.clone(), t: Math.random() * 2 });
    });
  }
  clearHomePets() { this.homePets.forEach(h => this.scene.remove(h.mesh)); this.homePets = []; }
  updateHomePets(dt: number) {
    for (const h of this.homePets) {
      h.t -= dt; if (h.t <= 0) { h.target.set(IX - 5.5 + Math.random() * 11, IY, -3 + Math.random() * 8); h.t = 3 + Math.random() * 4; }
      const d = h.target.clone().sub(h.mesh.position).setY(0); let mv = false;
      if (d.length() > 0.3 && h.mesh.userData.react <= 0) { d.normalize(); h.mesh.position.addScaledVector(d, 1.4 * dt); h.mesh.rotation.y = Math.atan2(d.x, d.z); mv = true; this.collide(h.mesh.position, 0.5); }
      animateCreature(h.mesh, dt, mv);
    }
  }

  // ================= new systems =================
  composer?: EffectComposer; grade?: ShaderPass; stars!: THREE.Points; moon!: THREE.Mesh; sunDisc!: THREE.Mesh; coreAnims: Anim[] = []; vy = 0;
  activity: { kind: string; t: number; s: Spot; kid?: THREE.Group } | null = null;
  floorsHere() { if (this.indoor) return this.world.inFloors; const p = this.player.position; const out = Math.abs(p.x) < 130 && p.z > -140 && p.z < 300 ? [...this.world.floors] : []; this.nearChunks(p.x, p.z).forEach(c => out.push(...c.floors)); return out; }
  heightAt(x: number, z: number, cur: number, fl = this.floorsHere()) { if (this.adventureInterior === 'cave') return 0; let best = 0; for (const f of fl) { const h = floorH(f, x, z); if (h !== null && h <= cur + 0.8 && h > best) best = h; } return best; }
  applyGravity(o: THREE.Vector3, dt: number, fl: Floor[], useVel = true) {
    const base = this.indoor ? IY : this.adventureInterior === 'cave' ? -10 : 0; const cur = o.y - base; const g = this.heightAt(o.x, o.z, cur, fl);
    if (g >= cur - 0.05 && (!useVel || this.vy <= 0)) { o.y = base + g; if (useVel) this.vy = 0; }
    else if (useVel) { this.vy -= 28 * dt; o.y = Math.max(base + g, o.y + this.vy * dt); if (o.y <= base + g) this.vy = 0; }
    else o.y = Math.max(base + g, o.y - 9 * dt);
  }
  startActivity(s: Spot) {
    this.sitting = false; this.runOn = false; this.activity = { kind: s.kind, t: 0, s };
    if (s.kind === 'seesaw' && s.obj) { const kid = buildHuman(randLook(Math.floor(Math.random() * 99)), 0.68); kid.userData.emote = 999; kid.userData.emoteKind = 14; kid.position.set(1.25, -0.05, 0); kid.rotation.y = -Math.PI / 2; s.obj.add(kid); this.activity.kid = kid; }
    if (s.kind === 'study') this.cb.onInteract('study');
    if (s.kind === 'view') { this.player.userData.emote = 2; this.player.userData.emoteKind = 1; this.dist = 15; this.pitch = 0.45; this.cb.onToast('🏰 What an amazing view!', 'good'); sfx('happy'); this.activity = null; return; }
    this.cb.onToast(s.kind === 'swing' ? 'Wheee! Move to get off.' : s.kind === 'seesaw' ? 'Up and down! Move to get off.' : s.kind === 'slide' ? 'Here we go!' : 'Studying...', 'info');
  }
  endActivity() {
    const a = this.activity; if (!a) return; const hu = this.player.userData;
    if (a.kid) a.kid.parent?.remove(a.kid); if (a.kind === 'seesaw' && a.s.obj) a.s.obj.rotation.z = 0;
    hu.emote = 0; this.player.rotation.x = 0; this.player.rotation.z = 0; this.activity = null;
    if (a.kind !== 'slide') { this.player.position.x = a.s.x; this.player.position.z = a.s.z; }
  }
  updateActivity(dt: number, mvLen: number) {
    const a = this.activity!; a.t += dt; const hu = this.player.userData; const p = this.player.position; const v = new THREE.Vector3();
    if (mvLen > 0.01 && a.t > 0.7 && a.kind !== 'slide') { this.endActivity(); return; }
    switch (a.kind) {
      case 'swing': { const seat = a.s.obj!; seat.getWorldPosition(v); p.set(v.x, v.y - 0.52, v.z - 0.05); this.player.rotation.set(seat.parent!.rotation.x * 0.8, 0, 0); hu.emote = 1; hu.emoteKind = 14; animateHuman(this.player, dt, 0); if (a.t > 12) this.endActivity(); break; }
      case 'seesaw': { const piv = a.s.obj!; piv.rotation.z = Math.sin(a.t * 2.2) * 0.3; v.set(-1.25, 0.06, 0); piv.localToWorld(v); p.set(v.x, v.y - 0.5, v.z); this.player.rotation.set(0, Math.PI / 2, piv.rotation.z); hu.emote = 1; hu.emoteKind = 14; animateHuman(this.player, dt, 0); if (a.kid) animateHuman(a.kid, dt, 0); if (Math.abs(Math.sin(a.t * 2.2)) > 0.98 && Math.random() < 0.3) sfx('happy'); if (a.t > 12) this.endActivity(); break; }
      case 'slide': {
        const path = a.s.path!; let t = a.t, from = path[0].p; let i = 0;
        for (; i < path.length; i++) { if (t <= path[i].d) break; t -= path[i].d; from = path[i].p; }
        if (i >= path.length) { this.endActivity(); break; }
        const st = path[i]; const k = Math.min(1, t / st.d); const prev = i === 0 ? [p.x, p.y, p.z] as [number, number, number] : from;
        if (i === 0 && a.t < dt * 1.5) a.s.ry = 0; p.set(prev[0] + (st.p[0] - prev[0]) * k, prev[1] + (st.p[1] - prev[1]) * k, prev[2] + (st.p[2] - prev[2]) * k); this.player.rotation.set(0, 0, 0);
        if (st.pose >= 0) { hu.emote = 1; hu.emoteKind = st.pose; animateHuman(this.player, dt, 0); } else { hu.emote = 0; animateHuman(this.player, dt, 3); }
        if (st.pose === 14 && i === 3 && Math.random() < 0.3) this.burst(p.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffffff', 1, 1);
        break;
      }
      case 'study': { p.set(a.s.x, 0, a.s.z); this.player.rotation.set(0, a.s.ry ?? 0, 0); hu.emote = 1; hu.emoteKind = 14; animateHuman(this.player, dt, 0); break; }
      default: this.endActivity();
    }
  }
  hitStop = 0; climbBtn = 0; lavaWarnT = 0; sitting = false; zoneDim = 1; curZone: Zone | null = null;
  addNpc(n: NPCSpec, chunk: string) {
    const m = buildHuman(n.look, n.scale ?? 1); m.position.set(n.x, 0, n.z); m.rotation.y = n.ry ?? (n.role ? 0 : Math.random() * 6); this.scene.add(m);
    const tid = n.trainer ? n.id.slice(8) : undefined; if (n.trainer) this.genTrainers.set(tid!, n.trainer);
    this.npcs.push({ id: n.id, name: n.name, mesh: m, pos: m.position, trainer: tid, lines: n.lines, noAuto: n.noAuto, chunk, role: n.role, visible: () => !tid || !!n.noAuto || !this.save.flags['beat_' + tid] });
  }
  popText(at: THREE.Vector3, txt: string, col: string) { const s = textSprite(txt, col); s.userData.base = 0.75; s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.7, 0)); this.scene.add(s); this.sprites.push({ s, vel: new THREE.Vector3(0, 2.4, 0), life: 1.1 }); }
  zoneAt(x: number, z: number) { for (const c of this.nearChunks(x, z)) for (const zn of c.zones) if (Math.hypot(zn.x - x, zn.z - z) < zn.r) return zn; return null; }
  waterAhead() { const p = this.player.position, ry = this.player.rotation.y; return this.anyWater(p.x + Math.sin(ry) * 2.2, p.z + Math.cos(ry) * 2.2) && !this.anyWater(p.x, p.z); }
  festivalsToday() { const out: string[] = []; if (festivalOn(0, 0, this.save.day)) out.push('Embervale'); (this.save.towns ?? []).forEach(t => { if (festivalOn(t.x, t.z, this.save.day)) out.push(t.name); }); return out; }
  // --- sitting ---
  sitAt(s: Spot) { this.player.position.set(s.x, 0, s.z); if (s.ry !== undefined) this.player.rotation.y = s.ry; this.sitting = true; this.player.userData.emote = 1; this.player.userData.emoteKind = 14; this.cb.onToast('Relaxing... move to stand up.', 'info'); }
  // --- spots: fruit, harvest, sit, dance ---
  useSpot(s: Spot) {
    const fk = s.key ? s.key + '_' + this.save.day : '';
    if (s.kind === 'dig') {
      if (!fk || this.save.flags[fk] || this.reactLock > 0 || this.battle) return;
      this.runOn = false;
      this.reactLock = 2.1;
      const u = this.player.userData;
      u.emote = 2.1; u.emoteKind = 6;
      this.player.rotation.y = Math.atan2(s.x - this.player.position.x, s.z - this.player.position.z);
      if (this.tool) this.tool.parent?.remove(this.tool);
      this.tool = buildTool('dig'); u.arms[1].el.add(this.tool);
      for (let i = 1; i <= 3; i++) this.later(i * 0.45, () => { sfx('hit'); this.burst(new THREE.Vector3(s.x, 0.65, s.z), i === 3 ? '#a8e9ff' : '#c0aeb1', 6, 3); });
      this.later(1.85, () => {
        this.tool?.parent?.remove(this.tool); this.tool = null;
        this.save.flags[fk] = true;
        s.obj?.traverse(o => { if (o.name === 'oreCrystal') o.visible = false; });
        if (Math.random() < 0.1) {
          this.save.items.diamond = (this.save.items.diamond || 0) + 1;
          this.burst(new THREE.Vector3(s.x, 1, s.z), '#a6f4ff', 28, 5);
          this.emoji(new THREE.Vector3(s.x, 1.5, s.z), '💎', 4);
          this.cb.onToast(`A diamond! ${this.save.items.diamond}/10 for the village portal.`, 'good');
          this.ach('miner'); sfx('level');
        } else {
          const count = 1 + (Math.random() < 0.3 ? 1 : 0);
          this.save.items.ore = (this.save.items.ore || 0) + count;
          this.cb.onToast(`Found ${count} crystal ore. Try another vein for diamonds.`, 'info');
          sfx('pickup');
        }
        this.save.works = (this.save.works || 0) + 1;
        this.cb.onChange(); this.autosave();
      });
      return;
    }
    if (s.kind === 'shelter') {
      if (this.reactLock > 0) return;
      this.daily('rest');
      this.runOn = false; this.reactLock = 3;
      const pose = this.player.userData; pose.emote = 3; pose.emoteKind = s.obj ? 14 : 9;
      if (s.obj) { const at = new THREE.Vector3(); s.obj.getWorldPosition(at); this.player.position.set(at.x, at.y + 0.05, at.z + 0.08); this.player.rotation.y = Math.PI; }
      this.cb.onToast('Resting somewhere safe...', 'info');
      this.later(2.8, () => {
        this.save.team.forEach(c => { c.fainted = false; c.hp = stats(c).hp; this.friend(c, 1); });
        this.save.time += 3; if (this.save.time >= 24) { this.save.time -= 24; this.save.day++; }
        this.refreshPartner(); this.cb.onToast('Everyone feels better!', 'good');
        sfx('level'); this.cb.onChange(); this.autosave();
      });
      return;
    }
    if (s.kind === 'fruit' || s.kind === 'harvest') {
      if (fk && this.save.flags[fk]) return; const hu = this.player.userData; hu.emote = 1.2; hu.emoteKind = s.kind === 'fruit' ? 13 : 8; this.reactLock = 1.2; this.player.rotation.y = Math.atan2(s.x - this.player.position.x, s.z - this.player.position.z);
      this.later(1.1, () => { const n = s.kind === 'fruit' ? 2 + Math.floor(Math.random() * 2) : 3; const it = s.item!; this.save.items[it] = (this.save.items[it] || 0) + n; if (fk) this.save.flags[fk] = true; this.emoji(this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0)), ITEMS[it].icon, 2); this.cb.onToast(`Got ${n} ${ITEMS[it].name}! ${ITEMS[it].icon}`, 'good'); sfx('pickup'); this.cb.onChange(); });
      return;
    }
    if (s.kind === 'sit') { this.sitAt(s); if (s.y) this.player.position.y = s.y; return; }
    if (s.kind === 'swing' || s.kind === 'slide' || s.kind === 'seesaw' || s.kind === 'study' || s.kind === 'view') { this.startActivity(s); return; }
    if (s.kind === 'dance') { const hu = this.player.userData; hu.emote = 4; hu.emoteKind = 3; this.reactLock = 4; if (this.partner) { this.partner.userData.react = 4; this.partner.userData.reactKind = 'happy'; } this.save.team.forEach(c => this.friend(c, 1)); this.cb.onToast('💃 Dancing! Your pets feel happy.', 'good'); sfx('happy'); return; }
    this.work(s);
  }
  // --- cooking ---
  cook(id: string) {
    const r = RECIPES.find(x => x.id === id); if (!r || this.reactLock > 0) return; const items = this.save.items;
    if (Object.entries(r.needs).some(([k, n]) => (items[k] || 0) < n)) { this.cb.onToast('Not enough ingredients.', 'bad'); return; }
    Object.entries(r.needs).forEach(([k, n]) => (items[k] -= n));
    const hu = this.player.userData; hu.emote = 2.4; hu.emoteKind = 8; this.reactLock = 2.4; if (this.tool) this.tool.parent?.remove(this.tool); this.tool = buildTool('cook'); hu.arms[1].el.add(this.tool);
    for (let i = 1; i < 5; i++) this.later(i * 0.45, () => { sfx('fire'); this.burst(this.player.position.clone().add(new THREE.Vector3(Math.sin(this.player.rotation.y) * 0.6, 1, Math.cos(this.player.rotation.y) * 0.6)), '#ffffff', 3, 1.5); });
    this.later(2.3, () => { if (this.tool) { this.tool.parent?.remove(this.tool); this.tool = null; } items[id] = (items[id] || 0) + 1; this.emoji(this.player.position.clone().add(new THREE.Vector3(0, 2.2, 0)), ITEMS[id].icon, 2); this.cb.onToast(`You cooked ${ITEMS[id].name}! ${ITEMS[id].icon}`, 'good'); this.save.works = (this.save.works || 0) + 1; if (this.save.works >= 10) this.ach('worker'); this.daily('cook'); sfx('level'); this.cb.onChange(); });
  }
  // --- planes ---
  flight: { i: number; mesh: THREE.Group; alt: number; spd: number; land: boolean; dest?: { x: number; z: number; name: string }; roll: number; pv: number } | null = null;
  startFlight(i: number, dest?: { x: number; z: number; name: string }) {
    if (this.battle || this.indoor || this.flight) return;
    this.firstPerson = false; this.player.visible = true;
    if (this.boat) this.setBoat(false); if (this.skate) this.toggleSkate(); this.sitting = false;
    const mesh = buildPlane(i); mesh.position.set(0, -0.62, -0.45); this.player.add(mesh); this.player.rotation.order = 'YXZ';
    this.flight = { i, mesh, alt: 0.01, spd: PLANES[i].speed, land: false, dest, roll: 0, pv: 0 };
    this.camera.far = 760; this.camera.updateProjectionMatrix(); this.updateFarTiles();
    if (this.partner) this.partner.visible = false; this.wilds.forEach(w => this.scene.remove(w.mesh)); this.wilds = [];
    sfx('evolve'); this.cb.onToast(dest ? `✈️ Flying to ${dest.name}!` : '✈️ Take off! Joystick = steer, ⬆⬇ = height.', 'good'); this.cb.onChange();
  }
  landPlane() { if (this.flight) { this.flight.land = true; this.flight.dest = undefined; } }
  endFlight() {
    const f = this.flight; if (!f) return; this.player.remove(f.mesh); this.flight = null;
    this.player.position.y = 0; this.player.rotation.x = 0; this.player.rotation.z = 0; this.player.userData.emote = 0;
    this.camera.far = 900; this.camera.updateProjectionMatrix(); this.farTileKey = ''; this.farTiles.forEach(mesh => (mesh.visible = false));
    if (this.partner) { this.partner.visible = true; this.partner.position.copy(this.player.position).add(new THREE.Vector3(1.5, 0, 0)); }
    this.cb.onToast('🛬 Landed safely!', 'good'); this.camFollowSnap = true; this.cb.onChange(); this.autosave();
  }
  updateFlight(dt: number) {
    const f = this.flight!; const p = this.player.position; const hu = this.player.userData; const k = this.keys;
    const jx = clamp(this.joy[0] + this.padAxes[0] + (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), -1, 1);
    let climb = clamp(-(this.joy[1] + this.padAxes[1]) + (k.has('w') || k.has('arrowup') || k.has(' ') ? 1 : 0) - (k.has('s') || k.has('arrowdown') || k.has('shift') ? 1 : 0) + this.climbBtn, -1, 1);
    let turn = -jx;
    if (f.dest && !f.land) { const want = Math.atan2(f.dest.x - p.x, f.dest.z - p.z); let df = want - this.player.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); turn = clamp(df * 2, -1, 1); climb = f.alt < 45 ? 1 : 0; if (Math.hypot(f.dest.x - p.x, f.dest.z - p.z) < 35) f.land = true; }
    if (f.land) { climb = -1; turn *= 0.3; } else if (f.alt < 4) climb = 1;
    this.player.rotation.y += turn * dt * 0.9; f.alt = clamp(f.alt + climb * dt * (f.land ? 9 : 12), 0, 90);
    const spd = f.land && f.alt < 3 ? f.spd * 0.4 : f.spd;
    p.x += Math.sin(this.player.rotation.y) * spd * dt; p.z += Math.cos(this.player.rotation.y) * spd * dt; p.y = f.alt;
    f.roll += (-turn * 0.5 - f.roll) * Math.min(1, dt * 3); f.pv += (-climb * 0.2 - f.pv) * Math.min(1, dt * 3); this.player.rotation.z = f.roll; this.player.rotation.x = f.pv;
    if (f.mesh.userData.prop) (f.mesh.userData.prop as THREE.Object3D).rotation.z += dt * 40;
    hu.emote = 0.3; hu.emoteKind = 10; hu.rowing = false; animateHuman(this.player, dt, 0);
    if (Math.random() < 0.5) this.burst(p.clone().add(new THREE.Vector3(-Math.sin(this.player.rotation.y) * 4, 0.9, -Math.cos(this.player.rotation.y) * 4)), '#ffffff', 1, 0.5);
    if (f.land && f.alt <= 0.05) { if (isWater(p.x, p.z)) { f.land = false; f.alt = 8; this.cb.onToast("Can't land on water!", 'bad'); } else { if (f.dest) { p.x = f.dest.x; p.z = f.dest.z + 9; } this.endFlight(); } }
    this.movingNow = true; this.hud.prompt = ''; this.updateFarTiles(); this.updateChunks();
  }
  // --- sky pets that fly high and sometimes land to eat ---
  sky: { mesh: THREE.Group; inst: CreatureInst; ang: number; r: number; h: number; state: 'sky' | 'down' | 'eat' | 'up'; t: number; tgt: THREE.Vector3; spd: number }[] = []; skyT = 4;
  updateSky(dt: number) {
    const p = this.player.position; const off = this.indoor || !!this.battle || !!this.fourth || this.fourthLobby; this.sky.forEach(s => (s.mesh.visible = !off)); if (off) return;
    if (this.sky.length < 3 && (this.skyT -= dt) <= 0) {
      this.skyT = 6; const b = biomeAt(p.x, p.z); const lv = levelAt(p.x, p.z); const sp = pick(speciesPool(b === 'ocean' ? 'meadow' : b, false, lv, false, 'y'));
      const mesh = buildCreature(sp); mesh.scale.setScalar(2.4); mesh.position.set(p.x + 80, 45, p.z); this.scene.add(mesh);
      this.sky.push({ mesh, inst: makeCreature(sp, clamp(lv + 3, 3, 50)), ang: Math.random() * 6.28, r: 30 + Math.random() * 35, h: 34 + Math.random() * 22, state: 'sky', t: 35 + Math.random() * 50, tgt: new THREE.Vector3(), spd: 0.12 + Math.random() * 0.1 });
    }
    for (let i = this.sky.length - 1; i >= 0; i--) {
      const s = this.sky[i]; const m = s.mesh; s.t -= dt;
      if (s.state === 'sky') {
        s.ang += s.spd * dt; m.position.lerp(new THREE.Vector3(p.x + Math.cos(s.ang) * s.r, s.h + Math.sin(s.ang * 3) * 3, p.z + Math.sin(s.ang) * s.r), Math.min(1, dt * 0.7)); m.rotation.y = -s.ang;
        if (m.position.distanceTo(p) > 170) { this.scene.remove(m); this.sky.splice(i, 1); continue; }
        if (s.t <= 0 && !this.flight) { s.tgt.set(p.x + (Math.random() - 0.5) * 30, 0, p.z + (Math.random() - 0.5) * 30); if (isWater(s.tgt.x, s.tgt.z) || this.indoor) s.t = 20; else { s.state = 'down'; this.cb.onToast('🦅 A sky pet is coming down to eat!', 'info'); } }
      } else if (s.state === 'down') {
        const d = s.tgt.clone().sub(m.position); const L = d.length(); m.position.addScaledVector(d.normalize(), Math.min(L, 14 * dt)); m.rotation.y = Math.atan2(d.x, d.z); m.scale.setScalar(Math.max(1, m.scale.x - dt * 0.3));
        if (L < 0.3) { s.state = 'eat'; s.t = 20; m.position.y = 0; m.scale.setScalar(1); }
      } else if (s.state === 'eat') {
        if (Math.random() < dt * 0.8) this.emoji(m.position.clone().add(new THREE.Vector3(0, 1.4, 0)), '🍓', 1);
        if (m.position.distanceTo(p) < 1.8 && this.leadInst() && !this.flight && !this.inSafeCamp()) { this.sky.splice(i, 1); this.startWild({ mesh: m, inst: s.inst, state: 'wander', target: m.position.clone(), t: 0, home: m.position.clone(), ignore: 0 }); continue; }
        if (s.t <= 0) s.state = 'up';
      } else { m.position.y += dt * 8; m.scale.setScalar(Math.min(2.4, m.scale.x + dt * 0.4)); if (m.position.y > s.h) { s.state = 'sky'; s.t = 40 + Math.random() * 40; } }
      animateCreature(m, dt, s.state !== 'eat');
    }
  }
  // --- football ---
  updateBalls(dt: number) {
    const p = this.player.position;
    for (const c of this.nearChunks(p.x, p.z)) for (const b of c.balls) {
      const m = b.mesh; const d = Math.hypot(m.position.x - p.x, m.position.z - p.z);
      if (d < 0.95 && this.movingNow) { const dir = new THREE.Vector3(m.position.x - p.x, 0, m.position.z - p.z).normalize(); const spd = this.runOn || this.keys.has('shift') ? 15 : 9; b.vel.set(dir.x * spd, 4, dir.z * spd); sfx('hit'); }
      m.position.addScaledVector(b.vel, dt); b.vel.y -= 20 * dt; if (m.position.y < 0.35) { m.position.y = 0.35; b.vel.y = Math.abs(b.vel.y) > 2 ? -b.vel.y * 0.45 : 0; }
      const fr = Math.pow(0.35, dt); b.vel.x *= fr; b.vel.z *= fr; m.rotation.x += b.vel.z * dt * 2.5; m.rotation.z -= b.vel.x * dt * 2.5;
      const inGoal = Math.abs(m.position.z - b.cz) < 2;
      if (inGoal && (m.position.x < b.x0 - 0.4 || m.position.x > b.x1 + 0.4)) { this.cb.onToast('⚽ GOAL!!', 'good'); sfx('victory'); this.burst(m.position.clone().setY(1.5), '#ffe066', 20, 6); m.position.set(b.cx, 0.35, b.cz); b.vel.set(0, 0, 0); continue; }
      if (!inGoal && m.position.x < b.x0) { m.position.x = b.x0; b.vel.x *= -0.7; } if (!inGoal && m.position.x > b.x1) { m.position.x = b.x1; b.vel.x *= -0.7; }
      if (m.position.z < b.z0) { m.position.z = b.z0; b.vel.z *= -0.7; } if (m.position.z > b.z1) { m.position.z = b.z1; b.vel.z *= -0.7; }
    }
  }
  // --- badminton ---
  bad: { cx: number; cz: number; sh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; toMe: boolean; me: number; them: number; coach: NPC; racket: THREE.Object3D; cRacket: THREE.Object3D } | null = null;
  startBadminton(coachId: string) {
    const coach = this.npcs.find(n => n.id === coachId); if (!coach || this.bad) return;
    const zone = this.nearChunks(coach.pos.x, coach.pos.z).flatMap(c => c.zones).find(z => z.kind === 'court'); if (!zone) return;
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); this.scene.add(sh);
    const racket = buildTool('racket'), cRacket = buildTool('racket'); (this.player.userData.arms[1].el as THREE.Object3D).add(racket); (coach.mesh.userData.arms[1].el as THREE.Object3D).add(cRacket);
    this.player.position.set(zone.x, 0, zone.z + 4); this.player.rotation.y = Math.PI; coach.pos.set(zone.x, 0, zone.z - 4); coach.mesh.rotation.y = 0;
    this.bad = { cx: zone.x, cz: zone.z, sh, from: coach.pos.clone().setY(1.6), to: new THREE.Vector3(zone.x, 0, zone.z + 4), t: 0, dur: 1.5, toMe: true, me: 0, them: 0, coach, racket, cRacket };
    this.yaw = 0; this.pitch = 0.5; this.camFollowSnap = true; this.cb.onToast('🏸 Walk to where the shuttle falls to hit it! First to 5 wins.', 'info'); this.cb.onChange();
  }
  endBadminton(msg: string) { const b = this.bad!; this.scene.remove(b.sh); b.racket.parent?.remove(b.racket); b.cRacket.parent?.remove(b.cRacket); this.bad = null; this.cb.onToast(msg, 'good'); this.cb.onChange(); }
  updateBadminton(dt: number) {
    const b = this.bad!; b.t += dt; const k = Math.min(1, b.t / b.dur);
    b.sh.position.lerpVectors(b.from, b.to.clone().setY(b.toMe ? 1.3 : 1.6), k); b.sh.position.y += Math.sin(k * Math.PI) * 3.2; b.sh.rotation.x = b.toMe ? Math.PI * 0.8 : -Math.PI * 0.2;
    const mark = b.to; if (b.toMe && Math.random() < 0.3) this.burst(new THREE.Vector3(mark.x, 0.1, mark.z), '#ffe066', 1, 0.5);
    if (!b.toMe) { const d = b.to.clone().sub(b.coach.pos).setY(0); if (d.length() > 0.1) { b.coach.pos.addScaledVector(d.normalize(), Math.min(d.length(), 5 * dt)); animateHuman(b.coach.mesh, dt, 3); } else animateHuman(b.coach.mesh, dt, 0); } else animateHuman(b.coach.mesh, dt, 0);
    if (k >= 1) {
      if (b.toMe) {
        if (Math.hypot(this.player.position.x - b.to.x, this.player.position.z - b.to.z) < 2.2) { this.player.userData.emote = 0.4; this.player.userData.emoteKind = 15; sfx('swing'); b.from = b.sh.position.clone(); b.to.set(b.cx + (Math.random() - 0.5) * 5, 0, b.cz - 2 - Math.random() * 4); b.toMe = false; }
        else { b.them++; this.cb.onToast(`Missed! ${b.me} - ${b.them}`, 'bad'); this.serveTo(); }
      } else {
        if (Math.random() < 0.8) { b.coach.mesh.userData.emote = 0.4; b.coach.mesh.userData.emoteKind = 15; sfx('swing'); b.from = b.sh.position.clone(); b.to.set(b.cx + (Math.random() - 0.5) * 5, 0, b.cz + 1.5 + Math.random() * 4.5); b.toMe = true; }
        else { b.me++; this.cb.onToast(`Point! ${b.me} - ${b.them}`, 'good'); this.serveTo(); }
      }
      b.t = 0; b.dur = 1.3 + Math.random() * 0.4;
      if (b.me >= 5) { this.save.money += 60; sfx('victory'); this.endBadminton('🏆 You won the match! +60 coins'); return; }
      if (b.them >= 5) { this.endBadminton('Coach Ren wins this time. Try again!'); return; }
    }
    const p = this.player.position; p.x = clamp(p.x, b.cx - 3.2, b.cx + 3.2); p.z = clamp(p.z, b.cz + 0.6, b.cz + 7);
  }
  serveTo() { const b = this.bad!; b.from = b.coach.pos.clone().setY(1.6); b.toMe = true; b.to.set(b.cx + (Math.random() - 0.5) * 5, 0, b.cz + 1.5 + Math.random() * 4.5); }
  // --- festivals ---
  fest: { key: string; g: THREE.Group; x: number; z: number } | null = null; fwT = 0;
  updateFestival(dt: number) {
    const p = this.player.position; let f: { x: number; z: number; name: string } | null = null;
    if (!this.indoor) { if (inCore(p.x, p.z) && p.z < 34 && festivalOn(0, 0, this.save.day)) f = { x: 0, z: 0, name: 'Embervale' }; else if (this.town && festivalOn(this.town.x, this.town.z, this.save.day)) f = { x: this.town.x, z: this.town.z, name: this.town.name }; }
    const key = f ? f.name + this.save.day : '';
    if (this.fest && this.fest.key !== key) { this.scene.remove(this.fest.g); this.fest = null; }
    if (f && !this.fest) {
      const g = new THREE.Group(); g.position.set(f.x, 0, f.z); const R = f.name === 'Embervale' ? 10.5 : 18; const cols = ['#ff4a6a', '#ffd23b', '#7ad0ff', '#7aff8a', '#c08aff', '#ff9a3a'];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R, nx = Math.cos(a + Math.PI / 8) * R, nz = Math.sin(a + Math.PI / 8) * R; part('cyl', tmat('#7a4a2a'), [0.08, 4.5, 0.08], [x, 2.25, z], [0, 0, 0], g);
        for (let k = 1; k < 5; k++) { const tt = k / 5; part('sphere', toon(cols[(i + k) % 6], { emissive: cols[(i + k) % 6], emissiveIntensity: 1.1 }), [0.18, 0.24, 0.18], [x + (nx - x) * tt, 4.3 - Math.sin(tt * Math.PI) * 0.6, z + (nz - z) * tt], [0, 0, 0], g, true); }
        part('cone', tmat(cols[i % 6]), [0.3, 0.6, 0.04], [x, 3.9, z], [Math.PI, -a, 0], g, true); }
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: labelTex('FESTIVAL!', '#d04a3a', '#ffe066'), side: THREE.DoubleSide })); ban.position.set(0, 5.6, R); g.add(ban);
      this.scene.add(g); this.fest = { key, g, x: f.x, z: f.z }; this.cb.onToast(`🎉 ${f.name} is having a festival today!`, 'good');
    }
    if (this.fest) {
      this.fwT -= dt; const night = this.isNight() || this.save.time > 18.5;
      if (this.fwT <= 0) { this.fwT = night ? 0.4 + Math.random() * 0.7 : 2.5; const at = new THREE.Vector3(this.fest.x + (Math.random() - 0.5) * 30, night ? 16 + Math.random() * 12 : 9, this.fest.z + (Math.random() - 0.5) * 30); this.burst(at, ['#ff4a6a', '#ffd23b', '#7ad0ff', '#7aff8a', '#c08aff'][Math.floor(Math.random() * 5)], night ? 36 : 10, 12); this.burst(at, '#ffffff', 8, 6); if (at.distanceTo(p) < 80) sfx('hit'); }
    }
  }

  updateExplore(dt: number) {
    this.lavaWarnT -= dt;
    if (this.trans) { this.updateTrans(dt); if (this.partner) animateCreature(this.partner, dt, false); return; }
    if (this.warp) { this.updateWarp(dt); if (this.partner) animateCreature(this.partner, dt, false); return; }
    if (this.warp || this.sleepSeq) this.movingNow = false;
    if (this.sleepSeq) { this.updateSleep(dt); if (this.indoor) this.updateHomePets(dt); this.hud.prompt = ''; return; }
    if (this.fourth) { this.fourth.update(dt); this.movingNow = true; this.hud.prompt = ''; return; }
    if (this.fourthLobby) { animateHuman(this.player, dt, 0); if (this.fourthWorld) animateFourthWorld(this.fourthWorld, this.clock.elapsedTime); this.movingNow = false; this.hud.prompt = ''; return; }
    if (this.flight) { this.updateFlight(dt); return; }
    if (this.activity) { this.updateActivity(dt, this.moveVec().length() + (this.runOn ? 0 : 0)); if (this.partner) animateCreature(this.partner, dt, false); this.hud.prompt = ''; if (this.activity) return; }
    const mv = this.moveVec(); const run = this.keys.has('shift') || this.held('block') || this.runOn;
    // Gentle, changing ocean currents push the surfboard even when the player eases off the controls.
    const seaCurrent = this.boat ? new THREE.Vector3(Math.sin(this.clock.elapsedTime * 0.22 + this.player.position.z * 0.018) * 0.75, 0, Math.cos(this.clock.elapsedTime * 0.18 + this.player.position.x * 0.016) * 0.62) : null;
    if (this.sitting) { if (mv.lengthSq() > 0.01) { this.sitting = false; this.player.userData.emote = 0; this.runOn = false; } else mv.set(0, 0, 0); }
    else if (this.runOn && mv.lengthSq() < 0.01 && !this.boat && !this.bad && this.reactLock <= 0) mv.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); // auto-run forward
    const mk = Math.max(0.4, Math.min(1, mv.length()));
    const lead = this.leadInst(); const passive = lead ? SPECIES[lead.sp].type : ''; const speedBonus = passive === 'wind' || passive === 'electric' ? 1.18 : passive === 'water' && this.boat ? 1.2 : 1; const speed = (this.boat ? 12 : this.skate ? 15 : run ? 9.5 : 5) * mk * speedBonus;
    const p = this.player.position; this.movingNow = mv.lengthSq() > 0.01 && this.reactLock <= 0; const prev = p.clone();
    if (this.movingNow) {
      p.addScaledVector(mv.clone().normalize(), speed * dt);
      const want = Math.atan2(mv.x, mv.z); let diff = want - this.player.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); this.player.rotation.y += diff * Math.min(1, dt * (this.boat ? 4 : 12));
      this.player.userData.lean = clamp(-diff * 1.2, -0.5, 0.5);
      this.moved += speed * dt; if (this.moved > 4) this.tut(0);
    }
    if (this.rotated > 300) this.tut(1);
    if (seaCurrent) p.addScaledVector(seaCurrent, dt);
    this.collide(p);
    for (const ch of this.nearChunks(p.x, p.z)) for (const zone of ch.zones) if (zone.kind === 'lava') {
      const dx = p.x - zone.x, dz = p.z - zone.z, distance = Math.hypot(dx, dz);
      const safe = zone.r - 0.45;
      if (distance < safe) {
        const nx = distance > 0.001 ? dx / distance : 1, nz = distance > 0.001 ? dz / distance : 0;
        p.x = zone.x + nx * safe; p.z = zone.z + nz * safe;
        if (this.lavaWarnT <= 0) { this.lavaWarnT = 3; this.cb.onToast('Too hot! Stay clear of the lava.', 'bad'); }
        break;
      }
    }
    const jumpPressed = this.pressed.has('__pad_jump') || this.pressed.has(' ');
    if (!this.boat) {
      const fl = this.floorsHere();
      const ground = this.heightAt(p.x, p.z, p.y, fl);
      if (jumpPressed && !this.indoor && !this.skate && !this.activity && p.y <= ground + 0.08) { this.vy = 10.5 * (lead && (SPECIES[lead.sp].type === 'wind' || SPECIES[lead.sp].type === 'light') ? 1.28 : 1); this.flipTime = 0; }
      this.applyGravity(p, dt, fl);
    } else {
      // Surf jump: lift the rider and board together, then settle smoothly onto the water.
      if (jumpPressed && p.y <= 0.04) { this.vy = 7.8; this.flipTime = 0; }
      p.y = Math.max(0, p.y + this.vy * dt);
      this.vy = p.y <= 0 ? 0 : this.vy - 18 * dt;
    }
    if (this.flipTime >= 0) {
      this.flipTime += dt; const t = Math.min(1, this.flipTime / 0.72);
      this.player.rotation.x = Math.sin(t * Math.PI) * 0.16 - t * Math.PI * 2;
      if (t >= 1) { this.player.rotation.x = 0; this.flipTime = -1; }
    }
    if (!this.indoor && this.adventureInterior !== 'island' && !this.customIslandAt(p.x, p.z) && (this.boat ? !isWater(p.x, p.z) : isWater(p.x, p.z))) { p.copy(prev); if (!this.boat && this.bubbleT <= 0) { this.say('Water! Use the 🏄 Surf button.'); } }
    if (this.movingNow && !this.indoor && !this.skate && !this.boat) this.daily('move', Math.hypot(p.x - prev.x, p.z - prev.z));
    if (this.bad) this.updateBadminton(dt);
    const hu = this.player.userData;
    if (this.boat || this.skate) {
      hu.emote = 0.3; hu.emoteKind = this.boat ? 11 : 11; hu.rowing = false; animateHuman(this.player, dt, 0);
      if (this.boat && this.boatMesh) { this.boatMesh.position.y = 0.08 + Math.sin(this.clock.elapsedTime * 2.8) * 0.08; this.boatMesh.rotation.z = Math.sin(this.clock.elapsedTime * 1.7) * 0.055; this.boatMesh.rotation.x = Math.sin(this.clock.elapsedTime * 1.1) * 0.025; if (this.movingNow && Math.random() < 0.65) this.burst(p.clone().add(new THREE.Vector3(Math.sin(this.player.rotation.y) * -1.1, 0.12, Math.cos(this.player.rotation.y) * -1.1)), '#b9f4ff', 1, 1.8); }
      if (this.skate && this.skateMesh) { this.skateMesh.rotation.z = (hu.lean ?? 0) * 0.3; if (this.movingNow && Math.random() < dt * 3) sfx('swing'); }
    } else animateHuman(this.player, dt, this.movingNow ? speed : 0);
    if (hu.emote <= 0 && !this.indoor) { let hy = this.yaw + Math.PI - this.player.rotation.y; hy = Math.atan2(Math.sin(hy), Math.cos(hy)); hu.head.rotation.y = clamp(hy, -1.0, 1.0) * (this.movingNow ? 0.4 : 0.85); hu.head.rotation.x = clamp(-this.pitch * 0.25, -0.3, 0.2); }
    this.reactLock -= dt;
    if (this.override) { this.override.t -= dt; if (this.override.t <= 0) { this.override = null; this.refreshPartner(); } }
    // partner follows with personality
    if (this.partner) {
      const pt = this.partner.position;
      if (this.boat) { const ry = this.player.rotation.y; pt.set(p.x - Math.sin(ry) * 1.3, 0.25 + (this.boatMesh?.position.y ?? 0), p.z - Math.cos(ry) * 1.3); this.partner.rotation.y = ry; }
      const behind = p.clone().add(new THREE.Vector3(Math.sin(this.player.rotation.y + 2.4) * 1.7, 0, Math.cos(this.player.rotation.y + 2.4) * 1.7));
      const d = pt.distanceTo(behind); let mvP = false;
      if (!this.boat) this.applyGravity(pt, dt, this.floorsHere(), false);
      if (!this.boat && this.reactLock <= 0 && d > 0.4) { const dir = behind.clone().sub(pt).setY(0).normalize(); pt.addScaledVector(dir, Math.min(d * 3, this.skate ? 17 : 11) * dt); let df = Math.atan2(dir.x, dir.z) - this.partner.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); this.partner.rotation.y += df * Math.min(1, dt * 10); mvP = d > 0.8; }
      if (d > 25) pt.copy(behind);
      if (this.indoor) this.collide(pt, 0.4);
      animateCreature(this.partner, dt, mvP);
      if (!this.indoor && Math.random() < dt * 0.04 && this.bubbleT <= 0) { const w = this.save.weather; const lines = w === 'Rain' || w === 'Storm' ? ['*shakes off rain*', 'Brrr...'] : w === 'Snow' ? ['*catches snowflakes*'] : this.isNight() ? ['*yawns*'] : ['*happy hop*', '*sniff sniff*', '♪']; this.say(lines[Math.floor(Math.random() * lines.length)]); }
    }
    let prompt = ''; const E = this.keyName('interact'); const ia = this.act('interact');
    if (this.indoor) {
      this.updateHomePets(dt);
      const spots: [string, number, number, string][] = [['bed', IX - 5, -1.8, 'Sleep'], ['chest', IX + 5.2, -0.5, 'Storage'], ['book', IX + 5.6, -4.1, 'Read book'], ['cook', IX + 4.9, 2.4, 'Cook food'], ['exit', IX, 5.2, 'Go outside']];
      for (const [id, x, z, label] of spots) if (Math.hypot(p.x - x, p.z - z) < 1.8) { prompt = `${E}  ${label}`; if (ia) { if (id === 'exit') this.exitHome(); else if (id === 'bed') this.startSleep('bed'); else this.cb.onInteract(id); } }
      const pet = this.homePets.find(h => h.mesh.position.distanceTo(p) < 1.6);
      if (pet && !prompt) { prompt = `${E}  Pet ${pet.inst.nick}`; if (ia) { const u = pet.mesh.userData; u.react = 2; u.reactKind = 'love'; pet.mesh.lookAt(p.x, 0, p.z); this.player.userData.emote = 2; this.player.userData.emoteKind = 5; this.emoji(pet.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0)), '💕', 4); sfx('happy'); this.friend(pet.inst, 2); this.cb.onChange(); } }
      this.hud.prompt = prompt; return;
    }
    let near: NPC | null = null; let nd = 3;
    for (const n of this.npcs) {
      if (n.asleep) { n.mesh.visible = false; if (!this.isNight()) { n.asleep = false; n.sleepT = 0; if (n.home) n.pos.copy(n.home); } continue; }
      const vis = n.visible(); n.mesh.visible = vis; if (!vis) continue;
      if (this.bad && n === this.bad.coach) continue;
      const d = n.pos.distanceTo(p);
      if (d < 40 && !this.npcWork(n, dt, d)) { if (d < 8) { const a = Math.atan2(p.x - n.pos.x, p.z - n.pos.z); let df = a - n.mesh.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); n.mesh.rotation.y += df * Math.min(1, dt * 5); if (d < 6 && !n.trainer && Math.random() < dt * 0.15) { n.mesh.userData.emote = 1.2; n.mesh.userData.emoteKind = 0; } } animateHuman(n.mesh, dt, 0); }
      if (d < nd) { nd = d; near = n; }
      if (n.trainer && !n.noAuto && !n.engaged && d < 7 && this.leadInst()) { n.engaged = true; this.cb.onInteract(n.id); return; }
      if (d < 1) p.add(p.clone().sub(n.pos).setY(0).setLength(1 - d));
    }
    // Playground actions win over Talk while the player is standing at a seat.
    // Otherwise a nearby child can swallow E before the ride starts.
    const playSpot = !this.bad ? this.allSpots().find(s =>
      (s.kind === 'seesaw' || s.kind === 'swing') && Math.hypot(p.x - s.x, p.z - s.z) < s.r && p.y < 1.5,
    ) : undefined;
    if (playSpot) { prompt = `${E}  ${playSpot.label}`; if (ia) { this.useSpot(playSpot); this.hud.prompt = ''; return; } }
    else if (near) { prompt = `${E}  Talk`; if (ia) this.cb.onInteract(near.id); }
    else if (!this.bad) {
      const rel = p.y - (this.indoor ? IY : 0);
      const sp = this.allSpots().find(s => Math.hypot(p.x - s.x, p.z - s.z) < s.r && !(s.key && this.save.flags[s.key + '_' + this.save.day]) && (s.y ? rel > s.y - 1 : rel < 1.5));
      if (sp) { prompt = `${E}  ${sp.label}`; if (ia) this.useSpot(sp); }
      else if (this.boat || this.waterAhead()) { prompt = `${E}  Go fishing`; if (ia) this.work({ x: p.x + Math.sin(this.player.rotation.y) * 2, z: p.z + Math.cos(this.player.rotation.y) * 2, r: 2, kind: 'fish', label: '' }); }
    }
    for (const c of this.nearChunks(p.x, p.z)) for (const s of c.spots) if (s.obj && s.key) { const picked = !!this.save.flags[s.key + '_' + this.save.day]; if (s.obj.userData.picked !== picked) { s.obj.userData.picked = picked; s.obj.traverse(o => { if (o.name === 'fruit' || o.name === 'oreCrystal') o.visible = !picked; }); } }
    if (Math.hypot(p.x + 18, p.z + 10.4) < 1.8) { prompt = `${E}  Enter home`; if (ia) this.enterHome(); }
    if (Math.hypot(p.x - PORTAL_POS.x, p.z - PORTAL_POS.z) < 5.2) { prompt = `${E}  ${this.save.flags.portalAwake ? 'Enter the Fourth Dimension' : `Examine sealed portal (${this.save.items.diamond || 0}/10 diamonds)`}`; if (ia) { this.cb.onInteract('portal'); this.hud.prompt = ''; return; } }
    this.world.berries.forEach((b, i) => {
      const ready = this.save.flags['berry' + i + '_' + this.save.day] !== true;
      b.children.forEach(c => { if (c.name === 'berry') c.visible = ready; });
      if (ready && b.position.distanceTo(p) < 2.3) { prompt = `${E}  Pick berries`; if (ia) {
        this.save.flags['berry' + i + '_' + this.save.day] = true;
        this.save.items.sunberry = (this.save.items.sunberry || 0) + 1;
        this.player.userData.emote = 0.85; this.player.userData.emoteKind = 8; this.reactLock = 0.85;
        this.quest('s2'); this.daily('berry'); this.cb.onChange();
        this.later(0.35, () => { sfx('pickup'); this.burst(b.position.clone().setY(1), '#ffb85c', 6, 2); this.emoji(b.position.clone().setY(1.4), '🍊', 2); });
        this.cb.onToast('Got a Sunberry!', 'good');
      } }
    });
    const st = this.world.stone;
    if (!this.save.flags.stone) { st.rotation.y += dt; st.position.y = 0.8 + Math.sin(this.clock.elapsedTime * 2) * 0.2; if (st.position.distanceTo(p) < 2.5) { prompt = `${E}  Look at the shiny stone`; if (ia) { this.save.flags.stone = true; this.save.items.shrinestone = 1; this.quest('h1'); this.ach('secret'); this.cb.onInteract('stone'); } } }
    st.visible = !this.save.flags.stone;
    this.world.barrier.visible = !this.save.quests.m3.done;
    this.hud.prompt = prompt;
    for (const L of LOCATIONS) if (!this.save.discovered.includes(L.id) && Math.hypot(p.x - L.x, p.z - L.z) < 18) {
      this.save.discovered.push(L.id); this.cb.onToast(`📍 New place: ${L.name}`, 'good'); this.addCard(L.card); this.quest('e1', this.save.discovered.length, true);
      if (L.id === 'route') { this.quest('m2'); this.tut(3); } if (this.save.discovered.length === LOCATIONS.length) this.ach('explorer'); this.cb.onChange();
    }
    const tw = townAt(p.x, p.z, 34); this.town = tw;
    if (tw) { const towns = (this.save.towns ||= []); if (!towns.some(x => x.id === tw.id)) { towns.push({ id: tw.id, name: tw.name, x: tw.x, z: tw.z, kind: tw.kind }); this.cb.onToast(`📍 Welcome to ${tw.name}!`, 'good'); if (towns.length >= 3) this.ach('traveler'); this.cb.onChange(); } }
    this.updateChunks();
    const zn = this.zoneAt(p.x, p.z); this.curZone = zn;
    if (zn?.kind === 'lava' && !this.save.flags[`seen_lava_${Math.round(zn.x)}_${Math.round(zn.z)}`]) {
      this.save.flags[`seen_lava_${Math.round(zn.x)}_${Math.round(zn.z)}`] = true;
      this.cb.onToast('You found a rare lava lake. Keep to the stone shore.', 'good'); this.cb.onChange();
    }
    if (zn?.kind === 'airport' && zn.name) { const aps = (this.save.airports ||= []); if (!aps.some(a => a.name === zn.name)) { aps.push({ id: zn.name, name: zn.name, x: zn.x, z: zn.z - 6 }); this.cb.onToast(`✈️ Found ${zn.name}! You can fly here now.`, 'good'); } }
    this.nearChunks(p.x, p.z).forEach(c => c.zones.forEach(z2 => { if (z2.kind === 'cave' && z2.mat) { const inside = Math.hypot(p.x - z2.x, p.z - z2.z) < z2.r + 1; z2.mat.opacity = inside ? 0.22 : 1; z2.mat.depthWrite = !inside; } }));
    this.updateBalls(dt); this.updateFestival(dt);
    if (!this.bad) this.updateWilds(dt);
    // Survival meters are persisted with the trainer save. Food restores both meters.
    this.survivalTick += dt; this.trainerHitCd = Math.max(0, this.trainerHitCd - dt);
    if (this.survivalTick >= 12) { const ticks = Math.floor(this.survivalTick / 12); this.survivalTick -= ticks * 12; this.save.trainerHunger = Math.max(0, (this.save.trainerHunger ?? 100) - ticks * 1.1); if ((this.save.trainerHunger ?? 100) <= 0) this.save.trainerHealth = Math.max(1, (this.save.trainerHealth ?? 100) - ticks * 1.4); }
    if (this.isNight() && !this.inSafeCamp() && !this.indoor && !this.battle && this.trainerHitCd <= 0) {
      const threat = this.wilds.find(w => (w.state === 'chase' || w.state === 'territory') && w.mesh.position.distanceTo(p) < 2.25);
      if (threat) { const guard = this.leadInst() && ['earth', 'metal'].includes(SPECIES[this.leadInst()!.sp].type) ? 0.65 : 1; this.save.trainerHealth = Math.max(0, (this.save.trainerHealth ?? 100) - 9 * guard); this.trainerHitCd = 2.1; this.shake = 0.22; this.flashT = 0.12; this.cb.onToast(`${threat.inst.nick} struck you! Find shelter or fight back.`, 'bad'); if ((this.save.trainerHealth ?? 0) <= 0) { this.save.trainerHealth = 35; this.save.trainerHunger = Math.max(15, this.save.trainerHunger ?? 15); this.teleport(0, -6); this.cb.onToast('You were rescued and taken to Embervale Clinic. Some time passed.', 'bad'); this.save.time = 8; } }
    }
    this.updateAdventureWorld(dt);
  }
  keyName(a: string) { const k = this.settings.keys[a]; return k === ' ' ? 'Space' : k.toUpperCase(); }

  // ---------- environment ----------
  updateEnv(dt: number) {
    if (this.fourth) {
      this.save.playtime += dt;
      this.area = 'Fourth Dimension';
      this.scene.background = new THREE.Color('#161123');
      this.world.sky.visible = false;
      this.rain.visible = false;
      this.sun.intensity = 0;
      this.hemi.intensity = 0.85;
      this.autosaveT = 120;
      return;
    }
    const s = this.save; s.time += dt / 60; if (s.time >= 24) { s.time -= 24; s.day++; }
    s.playtime += dt;
    if (syncDaily(s)) { this.cb.onToast('A new day of tasks begins.', 'info'); this.cb.onChange(); }
    this.weatherT -= dt; if (this.weatherT <= 0) { this.weatherT = 160 + Math.random() * 120; const nw = WEATHERS[Math.floor(Math.random() * WEATHERS.length)]; if (nw !== s.weather) { s.weather = nw; this.checkEvos(); } }
    const t = s.time; const day = Math.max(0, Math.sin(((t - 6) / 13.5) * Math.PI)); const night = this.isNight();
    const w = this.indoor ? 'Clear' : s.weather; const dim = w === 'Storm' ? 0.45 : w === 'Rain' || w === 'Cloudy' ? 0.7 : w === 'Fog' || w === 'Snow' ? 0.8 : 1;
    const dusk = (t > 17 && t < 20) || (t > 5 && t < 7.5);
    const [top, bot] = skyAt(t);
    const nf = t < 4.8 ? 1 : t < 6.5 ? 1 - (t - 4.8) / 1.7 : t < 18.6 ? 0 : t < 20.2 ? (t - 18.6) / 1.6 : 1;
    (this.stars.material as THREE.PointsMaterial).opacity = nf * (w === 'Clear' || w === 'Wind' ? 0.95 : 0.25);
    const sa2 = ((t - 6) / 12) * Math.PI; const sd = new THREE.Vector3(Math.cos(sa2) * 0.85, Math.sin(sa2), 0.4).normalize().multiplyScalar(450);
    this.sunDisc.position.copy(sd); this.sunDisc.visible = sd.y > -20 && dim > 0.6; this.moon.position.copy(sd).multiplyScalar(-1); this.moon.visible = -sd.y > -20;
    const zk = this.curZone?.kind; const zt = zk === 'haunt' ? 0.42 : zk === 'cave' ? 0.4 : 1; this.zoneDim += (zt - this.zoneDim) * Math.min(1, dt * 1.5);
    if (this.grade) (this.grade.uniforms.tint.value as THREE.Color).setRGB(zk === 'haunt' ? 0.86 : zk === 'cave' ? 0.88 : 1, zk === 'haunt' ? 0.8 : zk === 'cave' ? 0.92 : 1, zk === 'haunt' ? 1.02 : 1);
    if (zk === 'haunt') { top.lerp(new THREE.Color('#2a1a3a'), 0.7); bot.lerp(new THREE.Color('#4a3a5a'), 0.7); }
    if (dim < 1) { top.lerp(new THREE.Color('#7a8590'), (1 - dim) * 0.9); bot.lerp(new THREE.Color('#b0b8c0'), (1 - dim) * 0.9); }
    this.world.skyU.top.value.copy(top); this.world.skyU.bottom.value.copy(bot);
    this.world.portalSeal.visible = !this.save.flags.portalAwake;
    this.world.portalCore.visible = !!this.save.flags.portalAwake;
    if (this.save.flags.portalAwake) this.world.portalCore.rotation.x += dt * 0.11;
    this.world.sky.position.copy(this.camera.position); this.world.clouds.rotation.y += dt * 0.003;
    const fog = this.scene.fog as THREE.Fog; fog.color.copy(bot);
    if (this.indoor) { fog.near = 200; fog.far = 400; this.scene.background = new THREE.Color('#2a1a14'); this.world.sky.visible = false; }
    else { this.scene.background = null; this.world.sky.visible = true; const weatherFog = w === 'Fog' ? 38 : w === 'Storm' ? 70 : w === 'Rain' || w === 'Snow' ? 82 : w === 'Cloudy' ? 105 : 125; fog.near = weatherFog; fog.far = weatherFog + (w === 'Fog' ? 105 : 265); }
    this.sun.intensity = (this.indoor ? 0.5 : (0.3 + day * 1.9) * dim) * this.dimK * this.zoneDim; this.hemi.intensity = ((this.indoor ? 0.9 : (0.5 + day * 0.75) * (0.6 + dim * 0.4)) + (this.isNight() && this.leadInst() && SPECIES[this.leadInst()!.sp].type === 'shadow' ? 0.28 : 0)) * this.dimK * this.zoneDim;
    this.hemi.color.set(night ? '#8090d0' : '#e8f4ff');
    this.sun.color.set(dusk ? '#ffb070' : night ? '#8090ff' : '#fff4d8');
    const sa = ((t - 6) / 12) * Math.PI; const pp = this.player.position;
    this.sun.position.set(pp.x + Math.cos(sa) * 50, Math.max(15, Math.sin(Math.abs(sa)) * 70), pp.z + 25); this.sun.target.position.copy(pp);
    const li = night || dim < 0.6 ? 1.6 : 0.05; this.world.lampMats.forEach(l => (l.emissiveIntensity = li)); this.chunks.forEach(c => c.lamps.forEach(l => (l.emissiveIntensity = li)));
    if (!this.indoor) { this.world.ground.position.set(Math.round(pp.x / 50) * 50, -0.7, Math.round(pp.z / 50) * 50); this.world.horizon.position.set(pp.x, 0, pp.z); this.world.clouds.position.set(pp.x, 0, pp.z - 90); }
    this.world.villageLight.intensity = night && pp.z < 40 && !this.indoor ? 60 : 0;
    this.world.fire.intensity = this.indoor ? 14 + Math.sin(this.clock.elapsedTime * 12) * 3 + Math.random() * 2 : 0; this.world.roomLight.intensity = this.indoor ? 22 * this.dimK : 0;
    const precip = !this.indoor && (w === 'Rain' || w === 'Storm' || w === 'Snow'); this.rain.visible = precip;
    if (precip) {
      const pm = this.rain.material as THREE.PointsMaterial; pm.color.set(w === 'Snow' ? '#ffffff' : '#aac8ff'); pm.size = w === 'Snow' ? 0.25 : 0.12;
      this.rain.position.set(pp.x, 0, pp.z); const arr = this.rain.geometry.attributes.position.array as Float32Array; const fall = w === 'Snow' ? 3 : 25;
      for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= fall * dt; if (w === 'Snow') arr[i] += Math.sin(arr[i + 1] + i) * dt; if (arr[i + 1] < 0) arr[i + 1] = 30; }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (w === 'Storm' && Math.random() < dt * 0.08) { this.flashT = 0.15; sfx('thunder'); }
    if (this.flashT > 0) { this.flashT -= dt; this.hemi.intensity = 3; }
    const z = pp.z; const core = inCore(pp.x, z);
    this.area = this.indoor ? 'Home' : this.flight ? '✈️ Flying' : this.curZone?.name ? this.curZone.name : this.town ? this.town.name : !core ? BIOME_NAME[biomeAt(pp.x, z)] : z < 32 && Math.abs(pp.x) < 42 ? 'Embervale' : Math.hypot(pp.x + 22, z - 130) < 15 ? 'Whisper Grove' : z > 184 ? 'Old Ruins' : 'Thornreach Path';
    if (!this.battle && !this.indoor) playMusic(night || zk === 'haunt' || zk === 'cave' ? 'night' : this.area === 'Embervale' || this.town || this.fest ? 'village' : 'route');
    this.autosaveT -= dt; if (this.autosaveT <= 0) { this.autosaveT = 120; if (!this.battle) this.autosave(); }
  }
  updateFx(dt: number) {
    this.combatFx.update(dt);
    for (const q of this.parts) { if (!q.active) continue; q.life -= dt; q.vel.y -= 12 * dt; q.mesh.position.addScaledVector(q.vel, dt); q.mesh.rotation.x += dt * 8; q.mesh.scale.setScalar(Math.max(0.01, q.life * 1.6)); if (q.life <= 0) { q.active = false; q.mesh.visible = false; } }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt * 2.5; r.mesh.scale.setScalar(0.3 + r.t * r.max); (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - r.t; if (r.t >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.sprites.length - 1; i >= 0; i--) { const s = this.sprites[i]; s.life -= dt; s.s.position.addScaledVector(s.vel, dt); s.vel.multiplyScalar(0.98); s.s.material.opacity = Math.min(1, s.life * 1.5); if (s.s.userData.base) s.s.scale.set(s.s.userData.base * 2, s.s.userData.base, 1); else s.s.scale.setScalar(0.55 + Math.sin(s.life * 6) * 0.05); if (s.life <= 0) { this.scene.remove(s.s); s.s.material.dispose(); this.sprites.splice(i, 1); } }
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; p.t -= dt; if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); } }
    this.bubbleT -= dt;
  }
  // Third-person camera that swings behind the player while walking
  updateCamera(dt: number) {
    const b = this.battle;
    if (this.fourth) {
      const d = this.fourth, p = this.player.position, foe = d.opponent.position;
      const forward = p.clone().sub(foe).setY(0).normalize();
      if (forward.lengthSq() > 0) {
        const want = Math.atan2(forward.x, forward.z);
        const delta = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
        this.yaw += delta * Math.min(1, dt * 3);
      }
      const target = p.clone().lerp(foe, 0.28).add(new THREE.Vector3(0, 1.25, 0));
      const pos = p.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 9.5, 5.2, Math.cos(this.yaw) * 9.5));
      if (this.camFollowSnap) { this.camera.position.copy(pos); this.camFollowSnap = false; }
      else this.camera.position.lerp(pos, Math.min(1, dt * 6));
      this.camera.lookAt(target);
      return;
    }
    if (this.fourthLobby) {
      const target = this.player.position.clone().add(new THREE.Vector3(0, 1.4, 8));
      const pos = this.player.position.clone().add(new THREE.Vector3(0, 5, -9));
      if (this.camFollowSnap) { this.camera.position.copy(pos); this.camFollowSnap = false; }
      else this.camera.position.lerp(pos, Math.min(1, dt * 5));
      this.camera.lookAt(target);
      return;
    }
    if (this.firstPerson && !b && !this.sleepSeq && !this.trans && !this.warp && !this.activity) {
      const p = this.player.position;
      const bob = this.movingNow && !this.settings.reduceMotion ? Math.sin(this.clock.elapsedTime * 11) * 0.026 : 0;
      const eye = new THREE.Vector3(p.x, p.y + 1.68 + bob, p.z);
      const forward = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.clone().addScaledVector(forward, 10));
      this.player.visible = false;
      return;
    }
    if (!this.sleepSeq) this.player.visible = true;
    if (!b && !this.indoor && this.movingNow && !this.dragging && !this.trans) {
      const want = this.player.rotation.y + Math.PI; let diff = want - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 1.75) this.yaw += diff * Math.min(1, dt * 1.3);
    }
    if (this.indoor) { this.yaw = clamp(Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)), -0.8, 0.8); this.pitch = Math.max(0.45, this.pitch); }
    if (b && !this.dragging) { const v = b.me.mesh.position.clone().sub(b.foe.mesh.position).setY(0); if (v.lengthSq() > 0.01) { let df = Math.atan2(v.x, v.z) - this.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); this.yaw += df * Math.min(1, dt * 3.5); this.pitch += (0.3 - this.pitch) * Math.min(1, dt * 2); } }
    if (this.flight && !this.dragging) { let df = this.player.rotation.y + Math.PI - this.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); this.yaw += df * Math.min(1, dt * 3); this.pitch += (0.28 - this.pitch) * Math.min(1, dt * 2); }
    const tgt = b ? b.me.mesh.position.clone().lerp(b.foe.mesh.position, 0.42) : this.player.position.clone();
    if (!b && this.movingNow) tgt.add(new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y)).multiplyScalar(1.2));
    tgt.y += 1.5; let d = b ? (b.wild?.boss ? (b.bossIntro > 0 ? 13.5 : 10.8) : 9.5) : this.flight ? 16 : this.indoor ? Math.min(this.dist, 7.5) : this.dist;
    if (this.pitch < 0) d *= 1 + this.pitch * 0.45;
    const cp = new THREE.Vector3(tgt.x + Math.sin(this.yaw) * d * Math.cos(this.pitch), tgt.y + Math.sin(this.pitch) * d, tgt.z + Math.cos(this.yaw) * d * Math.cos(this.pitch));
    const floor = (this.indoor ? IY : 0) + 0.35; if (cp.y < floor) cp.y = floor;
    const look = tgt.clone(); if (this.pitch < 0) look.y += -this.pitch * 9;
    let occl = false;
    if (!this.indoor && !this.flight) { const tm = this.occlude(tgt, cp); if (tm < 1) { occl = true; cp.lerpVectors(tgt, cp, Math.max(0.12, tm - 0.06)); } }
    if (this.camFollowSnap) { this.camera.position.copy(cp); this.camFollowSnap = false; } else this.camera.position.lerp(cp, Math.min(1, dt * (occl ? 18 : 6)));
    if (this.shake > 0) { this.shake -= dt; this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; }
    this.camera.lookAt(look);
  }
  actorHud(a: Actor): ActorHud { const s = a.st; return { name: a.inst.nick, sp: a.inst.sp, lvl: a.inst.lvl, hp: a.hp, max: a.maxHp, en: a.en, ult: a.ult, type: SPECIES[a.inst.sp].type, status: (Object.keys(s) as (keyof Status)[]).filter(k => s[k] > 0), blocking: a.blocking }; }
  buildHud() {
    const h = this.hud; const b = this.battle; h.mode = this.fourth || this.fourthLobby ? 'fourth' : b ? 'battle' : 'explore'; h.area = this.area; h.time = this.save.time; h.weather = this.save.weather; h.fps = this.fps;
    h.bubble = this.bubbleT > 0 ? this.bubble : ''; h.pos = [this.player.position.x, this.player.position.z]; h.yaw = this.yaw; h.night = this.isNight(); h.indoor = this.indoor; h.facing = this.player.rotation.y;
    h.firstPerson = this.firstPerson; h.trainerHealth = this.save.trainerHealth ?? 100; h.trainerHunger = this.save.trainerHunger ?? 100;
    h.dimension = this.fourth ? { weapon: this.fourth.weapon, hp: this.fourth.hp, maxHp: this.fourth.maxHp, foeHp: this.fourth.foeHP, foeMax: this.fourth.maxFoe, energy: this.fourth.energy, phase: this.fourth.phase, wins: this.save.dimensionWins ?? 0, block: this.fourth.blocking, foeWeapon: this.fourth.enemyKind } : undefined;
    h.pod = `${ITEMS[this.usePod].name} ×${this.save.items[this.usePod] ?? 0}`;
    if (b) {
      h.me = this.actorHud(b.me); h.foe = this.actorHud(b.foe); h.trainer = b.trainer ? b.trainer.name : undefined; h.enemyLeft = b.team.length - b.ei; h.switchCd = Math.max(0, b.switchCd); h.dodgeCd = Math.max(0, b.me.dodgeCd);
      h.abilities = this.abilitiesOf(b.me).map((ab, i) => ({ name: ab.name, key: this.keyName('ab' + (i + 1)), cd: b.me.cds[ab.id] ?? 0, maxCd: ab.cd, cost: ab.cost, color: ab.color, type: ab.type }));
      h.capture = b.capture ? '●'.repeat(b.capture.shakes) + '○'.repeat(3 - b.capture.shakes) : '';
      h.count = b.count;
      h.boss = b.wild?.boss ? { name: b.foe.inst.nick, phase: b.bossPhase, tell: b.bossMove, tellT: b.bossTell, intro: b.bossIntro > 0 } : undefined;
    } else { h.boss = this.adventureCineKind === 'victory' ? { name: 'GUARDIAN DEFEATED', phase: 3, tell: 'VICTORY', tellT: this.adventureCineT, intro: true } : undefined; h.me = undefined; h.foe = undefined; h.capture = ''; h.count = 0; }
    h.boat = this.boat; h.skate = this.skate; h.run = this.runOn; h.flying = !!this.flight; h.sitting = this.sitting; h.bad = this.bad ? `${this.bad.me} - ${this.bad.them}` : '';
    if (this.fpsN === 1) h.festivals = this.festivalsToday();
    if ((this.oceanT = (this.oceanT ?? 0) - 1) <= 0) { this.oceanT = 15; h.ocean = !this.indoor && (this.boat || !!this.nearOcean()); }
  }
  loop = () => {
    if (!this.running) return; this.raf = requestAnimationFrame(this.loop);
    const now = performance.now(); if (this.settings.fpsCap && now - this.lastFrame < 1000 / this.settings.fpsCap - 1) return; this.lastFrame = now;
    let dt = Math.min(0.05, this.clock.getDelta());
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (this.booting) {
      // Stream the nine closest chunks one at a time. Report real chunk progress
      // and keep inputs locked until the immediate surroundings are available.
      try { this.updateChunks(); }
      catch (err) {
        this.booting = false; this.paused = true;
        this.cb.onWorldError?.(err instanceof Error ? err.message : 'Could not build nearby land.');
        return;
      }
      const ix = Math.round(this.player.position.x / CH), iz = Math.round(this.player.position.z / CH);
      let loaded = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (this.chunks.has(`${ix + dx},${iz + dz}`)) loaded++;
      const progress = 0.18 + loaded / 9 * 0.82;
      if (progress !== this.bootProgress) {
        this.bootProgress = progress;
        this.cb.onWorldProgress?.(progress, loaded < 5 ? 'Drawing the land nearby' : 'Bringing the paths to life');
      }
      if (loaded === 9) { this.booting = false; this.updateEnv(0); this.cb.onWorldReady?.(); }
      this.updateCamera(dt); this.buildHud();
      if (this.composer && this.settings.effects === 'High') this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.paused) { if (this.joy[0] || this.joy[1]) this.joy = [0, 0]; this.keys.forEach(k => { if (k.startsWith('__padh')) this.keys.delete(k); }); }
    if (!this.sleepSeq && !this.firstPerson && !this.player.visible) this.player.visible = true;
    if (!this.paused) {
      this.pollPad(dt); this.updateFish(dt); if (this.battle) this.updateBattle(dt); else this.updateExplore(dt); this.updateEnv(dt); this.updateFx(dt); this.updateSky(dt);
      const t = this.clock.elapsedTime; const pp = this.player.position; this.coreAnims.forEach(f => f(t, pp)); if (!this.indoor) this.nearChunks(pp.x, pp.z).forEach(c => c.anims.forEach(f => f(t, pp)));
    }
    this.pressed.clear(); this.updateCamera(dt); this.buildHud();
    if (this.composer && this.settings.effects === 'High' && !this.flight) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  };
}
