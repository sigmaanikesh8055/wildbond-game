import { BIOME_NAME, biomeAt, beachChunk, CH, featureInChunk, townInCell } from './world2';
import { SCHOOL_SPOTS } from './places2';
import { PORTAL_POS } from './dimension';

export const GUIDE_PLACES = [
  { id: 'fort', label: 'Fort / castle', icon: '🏰' },
  { id: 'beach', label: 'Beach', icon: '🏖️' },
  { id: 'desert', label: 'Hot desert', icon: '☀️' },
  { id: 'ice', label: 'Cold desert / igloo', icon: '🧊' },
  { id: 'igloo', label: 'Igloo', icon: '🏠' },
  { id: 'sandhouse', label: 'Sand dome', icon: '🏜️' },
  { id: 'stupa', label: 'Desert stupa', icon: '🛕' },
  { id: 'park', label: 'Park', icon: '🌳' },
  { id: 'airport', label: 'Airport', icon: '✈️' },
  { id: 'haunted', label: 'Horror house', icon: '👻' },
  { id: 'school', label: 'School', icon: '🏫' },
  { id: 'seesaw', label: 'School seesaw', icon: '🎠' },
  { id: 'swing', label: 'Swing', icon: '🛝' },
  { id: 'waterfall', label: 'Waterfall', icon: '💦' },
  { id: 'village', label: 'Village', icon: '🏘️' },
  { id: 'city', label: 'City / arena', icon: '🏙️' },
  { id: 'football', label: 'Football ground', icon: '⚽' },
  { id: 'badminton', label: 'Badminton court', icon: '🏸' },
  { id: 'cave', label: 'Crystal cave', icon: '🦇' },
  { id: 'mine', label: 'Crystal mine', icon: '⛏️' },
  { id: 'lava', label: 'Rare lava lake', icon: '🌋' },
  { id: 'portal', label: 'Village portal', icon: '◈' },
  { id: 'garden', label: 'Flower garden', icon: '🌻' },
  { id: 'valley', label: 'Flower valley', icon: '🌸' },
  { id: 'rootbridge', label: 'Root bridge', icon: '🌿' },
  { id: 'market', label: 'Market', icon: '🛒' },
  { id: 'farm', label: 'Farm', icon: '🌾' },
  { id: 'disco', label: 'Dance club', icon: '🎶' },
  { id: 'lighthouse', label: 'Lighthouse', icon: '🔦' },
  { id: 'ruins', label: 'Old Ruins', icon: '🏛️' },
  { id: 'home', label: 'My home', icon: '🏡' },
  { id: 'jungle', label: 'Dense jungle', icon: '🌴' },
  { id: 'mountain', label: 'Mountains', icon: '⛰️' },
  { id: 'savanna', label: 'Dry savanna', icon: '🦒' },
] as const;

export type GuideKind = typeof GUIDE_PLACES[number]['id'];
export interface GuideTarget { name: string; x: number; z: number; distance: number; direction: string; note?: string }

function bearing(dx: number, dz: number) {
  if (Math.hypot(dx, dz) < 1) return 'Here';
  const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const angle = (Math.atan2(dx, dz) + Math.PI * 2) % (Math.PI * 2);
  return compass[Math.round(angle * 16 / (Math.PI * 2)) % 16];
}

type Point = Pick<GuideTarget, 'x' | 'z' | 'name' | 'note'>;
function matches(kind: GuideKind, ix: number, iz: number): Point | null {
  const cx = ix * CH, cz = iz * CH;
  if (kind === 'village' && ix === 0 && iz === 0) return { x: 0, z: 11, name: 'Embervale', note: 'Village square' };
  if (kind === 'home' && ix === 0 && iz === 0) return { x: -18, z: -9.9, name: 'My home', note: 'Front door; press E to enter' };
  if (kind === 'ruins' && ix === 0 && iz === 3) return { x: 0, z: 178, name: 'Old Ruins', note: 'Entrance; defeat Kael to pass the barrier' };
  if (kind === 'airport' && ix === -2 && iz === 0) return { x: -133, z: 0.5, name: 'Embervale Airport', note: 'Talk to Commander Hale' };
  if (kind === 'portal' && ix === 1 && iz === 0) return { x: PORTAL_POS.x - 3.2, z: PORTAL_POS.z, name: 'Sealed Village Portal', note: 'Dig ten diamonds in rare mines, then press E at the arch' };

  if (kind === 'village' || kind === 'city') {
    const t = townInCell(Math.floor(cx / (CH * 4)), Math.floor(cz / (CH * 4)));
    if (!t || t.x !== cx || t.z !== cz || t.kind !== kind) return null;
    return kind === 'city' ? { x: cx, z: cz + 14, name: t.name, note: 'Arena entrance' } : { x: cx, z: cz + 3, name: t.name, note: 'Village square' };
  }
  if (kind === 'beach' && beachChunk(ix, iz)) return { x: cx, z: cz, name: 'Sunny Beach', note: 'Sandy shore' };
  if (['ice', 'desert', 'jungle', 'mountain', 'savanna', 'valley'].includes(kind)) {
    // Use chunk centers so the coordinates correspond to the visible biome tiles.
    if (biomeAt(cx, cz) === kind) return { x: cx, z: cz, name: BIOME_NAME[kind as keyof typeof BIOME_NAME], note: 'Center of this region' };
    return null;
  }
  const f = featureInChunk(ix, iz);
  if (!f) return null;
  if (kind === 'seesaw' || kind === 'swing') {
    if (f.kind !== 'school' && (kind !== 'swing' || f.kind !== 'park')) return null;
    const offset = kind === 'seesaw' ? SCHOOL_SPOTS.seesaw : f.kind === 'school' ? SCHOOL_SPOTS.swing : [-0.8, 1.1];
    return { x: f.x + offset[0], z: f.z + offset[1], name: f.kind === 'school' ? `${f.name ?? 'Village School'} ${kind}` : 'Park swing', note: 'Stand here and press E to play' };
  }
  if (kind === 'fort' && f.kind !== 'castle') return null;
  if (kind !== 'fort' && f.kind !== kind) return null;
  const label = GUIDE_PLACES.find(p => p.id === kind)?.label ?? kind;
  const entry: Record<string, [number, number, string]> = {
    school: [SCHOOL_SPOTS.entrance[0], SCHOOL_SPOTS.entrance[1], 'Classroom door; E to enter'],
    haunted: [0, -1.5, 'Front door; it opens when you get close'],
    castle: [0, 4.25, 'Castle entrance; stairs wind around the outside'],
    cave: [0, 9, 'Cave mouth'], stupa: [0, 10.8, 'Start of the front stairs'],
    mine: [3.4, 5.1, 'Crystal vein; press E to dig (10% diamond chance)'],
    lava: [0, 11.5, 'Safe shore. Never step in the molten center'],
    igloo: [0, 5.1, 'Igloo entrance'], sandhouse: [0, 5.1, 'Dome entrance'],
    waterfall: [0, 6.6, 'Pool and fishing spot'], garden: [0, 5.5, 'Garden path'],
    airport: [-5, 6.5, 'Talk to Commander Hale'],
    park: [0, 3, 'Park path'], badminton: [0, -4.5, 'Talk to Coach Ren'],
    football: [0, 0, 'Ball in the middle of the field'],
    lighthouse: [0, 4, 'Lighthouse entrance'],
  };
  const [ox, oz, note] = entry[f.kind] ?? [0, 0, 'Structure center'];
  return { x: f.x + ox, z: f.z + oz, name: f.name ?? label, note };
}

// Scan rings outward without blocking the game loop. The same feature rules
// used to build chunks are used here, including undiscovered places.
export async function nearestPlace(kind: GuideKind, x: number, z: number, signal?: AbortSignal): Promise<GuideTarget | null> {
  const ix = Math.round(x / CH), iz = Math.round(z / CH);
  let best: GuideTarget | null = null;
  let bestDistance = Infinity;
  // Core destinations and the nearby school remain findable even if the
  // player is far beyond the normal ring-search radius.
  const fixed: Point | null = kind === 'home' || kind === 'village' ? matches(kind, 0, 0)
    : kind === 'ruins' ? matches(kind, 0, 3)
      : kind === 'airport' ? matches(kind, -2, 0)
        : kind === 'portal' ? matches(kind, 1, 0)
        : kind === 'seesaw' || kind === 'school' || kind === 'swing' ? matches(kind, 2, 0) : null;
  if (fixed) {
    const dx = fixed.x - x, dz = fixed.z - z;
    bestDistance = Math.hypot(dx, dz);
    best = { ...fixed, distance: bestDistance, direction: bearing(dx, dz) };
  }
  if (kind === 'home' || kind === 'ruins' || kind === 'portal') return best;
  const seen = new Set<string>();
  for (let radius = 0; radius <= 100; radius++) {
    if (signal?.aborted) return null;
    const test = (cx: number, cz: number) => {
      const key = `${cx},${cz}`;
      if (seen.has(key)) return;
      seen.add(key);
      const p = matches(kind, cx, cz);
      if (!p) return;
      const dx = p.x - x, dz = p.z - z, distance = Math.hypot(dx, dz);
      if (distance < bestDistance) { bestDistance = distance; best = { ...p, distance, direction: bearing(dx, dz) }; }
    };
    for (let k = -radius; k <= radius; k++) {
      test(ix + k, iz - radius);
      test(ix + k, iz + radius);
      test(ix - radius, iz + k);
      test(ix + radius, iz + k);
    }
    if (bestDistance < Infinity && radius * CH > bestDistance + CH * 2) break;
    if (radius % 3 === 2) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  return best;
}