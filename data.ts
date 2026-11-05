// Data-driven content for Wildbond: Embervale. Add new content here without touching core systems.
import { EXTRA_SPECIES, EXTRA_ABILITIES, ORIGINAL_BIOMES } from './bestiary';
export type ElemType = 'fire' | 'water' | 'nature' | 'earth' | 'wind' | 'electric' | 'ice' | 'shadow' | 'light' | 'metal' | 'psychic' | 'aether';

export const TYPE_COLORS: Record<ElemType, string> = {
  fire: '#ff6a2b', water: '#2b9bff', nature: '#4cc94c', earth: '#b08850', wind: '#9fe0d0', electric: '#ffd92b',
  ice: '#9fe8ff', shadow: '#7a4bb0', light: '#fff2a0', metal: '#a8b4c0', psychic: '#ff6ad5', aether: '#c0a0ff',
};

const STRONG: Partial<Record<ElemType, ElemType[]>> = {
  fire: ['nature', 'ice', 'metal'], water: ['fire', 'earth'], nature: ['water', 'earth'], earth: ['electric', 'fire', 'metal'],
  wind: ['nature', 'earth'], electric: ['water', 'wind'], ice: ['nature', 'wind'], shadow: ['psychic', 'light'],
  light: ['shadow', 'aether'], metal: ['ice', 'light'], psychic: ['metal', 'earth'], aether: ['shadow', 'psychic'],
};
export function typeMult(atk: ElemType, def: ElemType): number {
  if (STRONG[atk]?.includes(def)) return 1.6;
  if (STRONG[def]?.includes(atk)) return 0.65;
  return 1;
}

export type AbilityKind = 'projectile' | 'melee' | 'aoe' | 'dash' | 'heal' | 'buff';
export interface Ability {
  id: string; name: string; type: ElemType; kind: AbilityKind; power: number; cost: number; cd: number; range: number;
  status?: 'burn' | 'slow' | 'stun' | 'poison'; desc: string; color: string;
}
export const ABILITIES: Record<string, Ability> = {
  cinderspit: { id: 'cinderspit', name: 'Cinder Spit', type: 'fire', kind: 'projectile', power: 26, cost: 18, cd: 2.5, range: 14, status: 'burn', desc: 'Lobs a burning ember. May burn.', color: '#ff7a2b' },
  flarepounce: { id: 'flarepounce', name: 'Flare Pounce', type: 'fire', kind: 'dash', power: 34, cost: 25, cd: 5, range: 8, desc: 'Leaps through the foe in a trail of flame.', color: '#ffae2b' },
  emberring: { id: 'emberring', name: 'Ember Ring', type: 'fire', kind: 'aoe', power: 40, cost: 35, cd: 8, range: 5, status: 'burn', desc: 'A ring of fire bursts outward.', color: '#ff4a1b' },
  bubblelance: { id: 'bubblelance', name: 'Bubble Lance', type: 'water', kind: 'projectile', power: 24, cost: 15, cd: 2, range: 15, status: 'slow', desc: 'Pressurised bubbles that slow.', color: '#5ab8ff' },
  tidecoil: { id: 'tidecoil', name: 'Tide Coil', type: 'water', kind: 'heal', power: 25, cost: 30, cd: 9, range: 0, desc: 'Wraps in water, restoring HP.', color: '#7ad0ff' },
  riptail: { id: 'riptail', name: 'Rip Tail', type: 'water', kind: 'melee', power: 38, cost: 22, cd: 4, range: 3.2, desc: 'A whipping tail strike.', color: '#2b8bff' },
  sporeburst: { id: 'sporeburst', name: 'Spore Burst', type: 'nature', kind: 'aoe', power: 22, cost: 20, cd: 5, range: 5, status: 'poison', desc: 'Puffs toxic spores around itself.', color: '#9ee05a' },
  thornvolley: { id: 'thornvolley', name: 'Thorn Volley', type: 'nature', kind: 'projectile', power: 25, cost: 16, cd: 2.2, range: 14, desc: 'Fires a sharp thorn.', color: '#5ac94c' },
  rootguard: { id: 'rootguard', name: 'Root Guard', type: 'nature', kind: 'buff', power: 0, cost: 20, cd: 10, range: 0, desc: 'Roots down: +50% defense for 5s.', color: '#2b9b4c' },
  sparkhop: { id: 'sparkhop', name: 'Spark Hop', type: 'electric', kind: 'dash', power: 24, cost: 14, cd: 2.5, range: 7, status: 'stun', desc: 'Zips through the foe. May stun.', color: '#ffe84a' },
  arcbolt: { id: 'arcbolt', name: 'Arc Bolt', type: 'electric', kind: 'projectile', power: 30, cost: 20, cd: 3, range: 16, desc: 'A crackling bolt.', color: '#fff35a' },
  staticfield: { id: 'staticfield', name: 'Static Field', type: 'electric', kind: 'aoe', power: 30, cost: 30, cd: 7, range: 4.5, status: 'stun', desc: 'Discharges in all directions.', color: '#fff8a0' },
  pebbleshot: { id: 'pebbleshot', name: 'Pebble Shot', type: 'earth', kind: 'projectile', power: 26, cost: 16, cd: 2.4, range: 13, desc: 'Spits a dense pebble.', color: '#c09a6a' },
  quakestomp: { id: 'quakestomp', name: 'Quake Stomp', type: 'earth', kind: 'aoe', power: 42, cost: 32, cd: 7, range: 5.5, status: 'stun', desc: 'Shakes the ground.', color: '#a07a40' },
  stoneskin: { id: 'stoneskin', name: 'Stoneskin', type: 'earth', kind: 'buff', power: 0, cost: 18, cd: 10, range: 0, desc: 'Hardens: +50% defense for 5s.', color: '#8a7a6a' },
  galecut: { id: 'galecut', name: 'Gale Cut', type: 'wind', kind: 'projectile', power: 24, cost: 14, cd: 1.8, range: 16, desc: 'A slicing gust.', color: '#c0fff0' },
  divebomb: { id: 'divebomb', name: 'Dive Bomb', type: 'wind', kind: 'dash', power: 36, cost: 26, cd: 5, range: 9, desc: 'Plummets into the foe.', color: '#9fe0d0' },
  gloomshard: { id: 'gloomshard', name: 'Gloom Shard', type: 'shadow', kind: 'projectile', power: 28, cost: 18, cd: 2.6, range: 15, status: 'poison', desc: 'A splinter of living shadow.', color: '#9a5ad0' },
  fadestep: { id: 'fadestep', name: 'Fade Step', type: 'shadow', kind: 'dash', power: 26, cost: 16, cd: 3, range: 8, desc: 'Vanishes and strikes from behind.', color: '#5a2b90' },
  frostbite: { id: 'frostbite', name: 'Frost Nip', type: 'ice', kind: 'melee', power: 30, cost: 14, cd: 2.4, range: 3, status: 'slow', desc: 'A chilling bite that slows.', color: '#bff4ff' },
  shardspray: { id: 'shardspray', name: 'Shard Spray', type: 'ice', kind: 'aoe', power: 34, cost: 28, cd: 6, range: 5, status: 'slow', desc: 'Sprays ice quills around itself.', color: '#e0faff' },
  ironjaw: { id: 'ironjaw', name: 'Iron Jaw', type: 'metal', kind: 'melee', power: 44, cost: 24, cd: 3.5, range: 3.5, desc: 'Crushing steel bite.', color: '#c0c8d0' },
  rivetstorm: { id: 'rivetstorm', name: 'Rivet Storm', type: 'metal', kind: 'projectile', power: 30, cost: 20, cd: 2.4, range: 16, desc: 'Fires hot rivets.', color: '#e0e0e0' },
  veilpulse: { id: 'veilpulse', name: 'Veil Pulse', type: 'shadow', kind: 'aoe', power: 46, cost: 35, cd: 7, range: 6, status: 'stun', desc: 'Hollow Veil suppression pulse.', color: '#6a2bb0' },
};

export type Role = 'Tank' | 'Attacker' | 'Fast Attacker' | 'Support' | 'Defensive' | 'Balanced' | 'Status';
export interface Species {
  id: string; name: string; type: ElemType; role: Role; rarity: 1 | 2 | 3 | 4;
  base: { hp: number; atk: number; def: number; spd: number; sp: number; crit: number; res: number };
  abilities: string[]; ult: string; style: string; lore: string; habitat: string; color: string; accent: string;
  evolvesTo?: string; evoLevel?: number; evoCond?: 'night' | 'friendship'; scale: number; starter?: boolean;
  lightRange: number; // melee reach
  biomes?: string[]; gen?: import('./bestiary').Gen;
}
// Slice tuning: evolution at Lv 12 (design target ~25 once full XP curve ships).
export const SPECIES: Record<string, Species> = {
  emberkit: { id: 'emberkit', name: 'Emberkit', type: 'fire', role: 'Fast Attacker', rarity: 2, base: { hp: 44, atk: 56, def: 38, spd: 64, sp: 52, crit: 0.12, res: 0.1 }, abilities: ['cinderspit', 'flarepounce'], ult: 'emberring', style: 'Hit-and-run pouncer with burning tail flicks.', lore: 'A fox-cat whose twin tails smoulder when happy. Kits nap in warm hearth ash.', habitat: 'Embervale hearths', color: '#ff7a3b', accent: '#ffd25a', evolvesTo: 'pyrelynx', evoLevel: 12, scale: 0.8, starter: true, lightRange: 2.6 },
  pyrelynx: { id: 'pyrelynx', name: 'Pyrelynx', type: 'fire', role: 'Fast Attacker', rarity: 3, base: { hp: 60, atk: 80, def: 52, spd: 84, sp: 74, crit: 0.18, res: 0.15 }, abilities: ['cinderspit', 'flarepounce', 'emberring'], ult: 'emberring', style: 'Blazing lunges and a mane of flame.', lore: 'Its ear tufts burn like candle wicks. Said to guard villages from winter.', habitat: 'Volcanic ridges', color: '#e8451b', accent: '#ffe07a', scale: 1.15, lightRange: 3 },
  rillfin: { id: 'rillfin', name: 'Rillfin', type: 'water', role: 'Support', rarity: 2, base: { hp: 54, atk: 44, def: 48, spd: 50, sp: 58, crit: 0.08, res: 0.18 }, abilities: ['bubblelance', 'tidecoil'], ult: 'riptail', style: 'Keeps distance, slows and sustains.', lore: 'A hovering axolotl-like swimmer that carries a bubble of river water on its back.', habitat: 'Streams', color: '#3ba8ff', accent: '#bfe8ff', evolvesTo: 'tidalisk', evoLevel: 12, scale: 0.8, starter: true, lightRange: 2.4 },
  tidalisk: { id: 'tidalisk', name: 'Tidalisk', type: 'water', role: 'Support', rarity: 3, base: { hp: 76, atk: 60, def: 66, spd: 62, sp: 82, crit: 0.1, res: 0.25 }, abilities: ['bubblelance', 'tidecoil', 'riptail'], ult: 'riptail', style: 'A serpentine healer with crushing tail whips.', lore: 'Its frilled crown hums before storms. Fishermen consider it a blessing.', habitat: 'Lakes', color: '#1b6fe0', accent: '#8ff0ff', scale: 1.2, lightRange: 3 },
  mossbun: { id: 'mossbun', name: 'Mossbun', type: 'nature', role: 'Status', rarity: 2, base: { hp: 52, atk: 46, def: 50, spd: 54, sp: 56, crit: 0.08, res: 0.15 }, abilities: ['thornvolley', 'sporeburst'], ult: 'rootguard', style: 'Poisons and kites with thorns.', lore: 'A round hopper with leaf ears. Moss grows faster wherever it naps.', habitat: 'Meadows', color: '#6ac94c', accent: '#2b7a3b', evolvesTo: 'grovehorn', evoLevel: 12, scale: 0.8, starter: true, lightRange: 2.4 },
  grovehorn: { id: 'grovehorn', name: 'Grovehorn', type: 'nature', role: 'Tank', rarity: 3, base: { hp: 84, atk: 64, def: 76, spd: 48, sp: 70, crit: 0.08, res: 0.25 }, abilities: ['thornvolley', 'sporeburst', 'rootguard'], ult: 'sporeburst', style: 'Walking grove; roots down and tanks.', lore: 'A stag-hare whose antlers are living saplings. Birds nest in them.', habitat: 'Old forests', color: '#3b9b3b', accent: '#8a5a2b', scale: 1.25, lightRange: 3 },
  voltmite: { id: 'voltmite', name: 'Voltmite', type: 'electric', role: 'Attacker', rarity: 2, base: { hp: 42, atk: 58, def: 42, spd: 60, sp: 60, crit: 0.14, res: 0.08 }, abilities: ['sparkhop', 'arcbolt'], ult: 'staticfield', style: 'Erratic zips and stuns.', lore: 'A beetle with a capacitor shell. Swarms gather under power lines on stormy nights.', habitat: 'Fields', color: '#ffd23b', accent: '#2b2b40', evolvesTo: 'arcbeetle', evoLevel: 12, scale: 0.75, starter: true, lightRange: 2.4 },
  arcbeetle: { id: 'arcbeetle', name: 'Arcbeetle', type: 'electric', role: 'Attacker', rarity: 3, base: { hp: 58, atk: 82, def: 58, spd: 74, sp: 84, crit: 0.18, res: 0.12 }, abilities: ['sparkhop', 'arcbolt', 'staticfield'], ult: 'staticfield', style: 'Lightning between its horns.', lore: 'Arcs leap between its horns like a living tesla coil.', habitat: 'Storm plains', color: '#ffbf1b', accent: '#30305a', scale: 1.15, lightRange: 3 },
  pebblob: { id: 'pebblob', name: 'Pebblob', type: 'earth', role: 'Defensive', rarity: 2, base: { hp: 60, atk: 50, def: 62, spd: 36, sp: 44, crit: 0.06, res: 0.2 }, abilities: ['pebbleshot', 'stoneskin'], ult: 'quakestomp', style: 'Slow, sturdy, punishing slams.', lore: 'A gummy blob that collects pretty stones in its body. It rattles when excited.', habitat: 'Riverbanks', color: '#a8865a', accent: '#6a5a4a', evolvesTo: 'cragmaul', evoLevel: 12, scale: 0.8, starter: true, lightRange: 2.6 },
  cragmaul: { id: 'cragmaul', name: 'Cragmaul', type: 'earth', role: 'Tank', rarity: 3, base: { hp: 90, atk: 74, def: 86, spd: 40, sp: 56, crit: 0.08, res: 0.3 }, abilities: ['pebbleshot', 'stoneskin', 'quakestomp'], ult: 'quakestomp', style: 'Boulder fists; earthquake stomps.', lore: 'Its gathered stones fused into armour. It can sleep standing for a decade.', habitat: 'Mountains', color: '#8a6a4a', accent: '#c0a080', scale: 1.3, lightRange: 3.2 },
  gustwing: { id: 'gustwing', name: 'Gustwing', type: 'wind', role: 'Fast Attacker', rarity: 1, base: { hp: 40, atk: 50, def: 36, spd: 72, sp: 48, crit: 0.12, res: 0.08 }, abilities: ['galecut', 'divebomb'], ult: 'divebomb', style: 'Hovering skirmisher.', lore: 'A paper-light bird that rides updrafts. It steals ribbons.', habitat: 'Thornreach Route', color: '#d0f0ff', accent: '#5a9bc0', scale: 0.8, lightRange: 2.4 },
  shadeling: { id: 'shadeling', name: 'Shadeling', type: 'shadow', role: 'Status', rarity: 2, base: { hp: 44, atk: 52, def: 40, spd: 62, sp: 62, crit: 0.12, res: 0.12 }, abilities: ['gloomshard', 'fadestep'], ult: 'fadestep', style: 'Blinks behind foes.', lore: 'A lantern-eyed wisp only seen after dusk. It mimics footsteps.', habitat: 'Thornreach Route (night)', color: '#3b2b5a', accent: '#ffe04a', evolvesTo: 'duskwraith', evoLevel: 12, evoCond: 'night', scale: 0.8, lightRange: 2.4 },
  duskwraith: { id: 'duskwraith', name: 'Duskwraith', type: 'shadow', role: 'Attacker', rarity: 3, base: { hp: 60, atk: 74, def: 54, spd: 78, sp: 84, crit: 0.16, res: 0.15 }, abilities: ['gloomshard', 'fadestep'], ult: 'fadestep', style: 'Cloak of night; evolves only at night.', lore: 'Its cloak holds a pocket of starless sky.', habitat: 'Ruins at night', color: '#2a1b40', accent: '#ff9a2b', scale: 1.2, lightRange: 3 },
  frostnib: { id: 'frostnib', name: 'Frostnib', type: 'ice', role: 'Balanced', rarity: 3, base: { hp: 50, atk: 56, def: 54, spd: 52, sp: 54, crit: 0.1, res: 0.15 }, abilities: ['frostbite', 'shardspray'], ult: 'shardspray', style: 'Spiky ice hedgehog brawler.', lore: 'Quills of clear ice. Rarely wanders down from the peaks during snow or fog.', habitat: 'Thornreach (fog/snow, rare)', color: '#bfeaff', accent: '#4a8ac0', scale: 0.75, lightRange: 2.4 },
  ironmaw: { id: 'ironmaw', name: 'Ironmaw', type: 'metal', role: 'Tank', rarity: 4, base: { hp: 110, atk: 78, def: 90, spd: 44, sp: 66, crit: 0.1, res: 0.35 }, abilities: ['ironjaw', 'rivetstorm', 'veilpulse'], ult: 'veilpulse', style: 'Armoured jaws; suppression pulses.', lore: 'A creature the Hollow Veil bolted into steel plating. Freed, it may be found again... (post-game, UNFINISHED)', habitat: 'Sunken Ruins', color: '#7a8590', accent: '#9a2bff', scale: 1.5, lightRange: 3.5 },
};

Object.assign(SPECIES, EXTRA_SPECIES);
Object.entries(ORIGINAL_BIOMES).forEach(([k, v]) => (SPECIES[k].biomes = v));
Object.assign(ABILITIES, EXTRA_ABILITIES);


export const PERSONALITIES = ['Brave', 'Calm', 'Aggressive', 'Playful', 'Shy', 'Curious', 'Loyal', 'Energetic'] as const;
export type Personality = typeof PERSONALITIES[number];
export const PERSONALITY_MOD: Record<Personality, { atk?: number; def?: number; spd?: number; sp?: number; friend?: number; desc: string }> = {
  Brave: { atk: 1.1, desc: '+10% Attack' }, Calm: { def: 1.1, desc: '+10% Defense' }, Aggressive: { atk: 1.15, def: 0.95, desc: '+15% Atk, -5% Def' },
  Playful: { spd: 1.1, desc: '+10% Speed' }, Shy: { def: 1.05, spd: 1.05, desc: 'Flees easily when wild' }, Curious: { sp: 1.1, desc: '+10% Special' },
  Loyal: { friend: 1.5, desc: 'Gains friendship 50% faster' }, Energetic: { sp: 1.05, spd: 1.05, desc: 'Faster energy regen' },
};

export interface Item { id: string; name: string; price: number; desc: string; kind: 'capture' | 'heal' | 'energy' | 'friend' | 'revive' | 'key' | 'gear'; value: number; icon: string }
const F = (id: string, name: string, price: number, value: number, icon: string, desc: string, kind: Item['kind'] = 'heal'): Item => ({ id, name, price, value, icon, desc, kind });
export const EXTRA_ITEMS: Item[] = [
  // gathered
  F('apple', 'Apple', 20, 0.2, '🍎', 'Crunchy and sweet. Heals 20%.'), F('mango', 'Mango', 30, 0.25, '🥭', 'Juicy summer fruit. Heals 25%.'), F('banana', 'Banana', 20, 0.2, '🍌', 'Soft and yummy. Heals 20%.'),
  F('coconut', 'Coconut', 35, 0.25, '🥥', 'Fresh coconut water. Heals 25%.'), F('veg', 'Veggies', 15, 0.15, '🥕', 'Fresh from the farm.'), F('egg', 'Egg', 15, 0.1, '🥚', 'A fresh farm egg.'),
  F('goldfish', 'Golden Fish', 200, 0, '🐠', 'A rare shiny fish! Sell it for lots of coins.', 'key'),
  F('ore', 'Crystal Ore', 45, 0, '🪨', 'Ore found while digging. Sell it at a shop.', 'key'),
  F('diamond', 'Portal Diamond', 0, 0, '💎', 'Rare mine treasure. Ten can awaken the sealed portal near Embervale.', 'key'),
  // home cooking
  F('grilledfish', 'Grilled Fish', 70, 0.6, '🍢', 'Fish grilled on a fire. Heals 60%.'), F('fishcurry', 'Fish Curry', 120, 1, '🍛', 'Spicy fish curry! Heals 100%.'),
  F('fruitsalad', 'Fruit Salad', 110, 0.9, '🥗', 'Apple, mango and banana. Heals 90%.'), F('vegsoup', 'Veggie Soup', 60, 0.5, '🍲', 'Warm and healthy. Heals 50%.'),
  F('omelette', 'Omelette', 60, 0.5, '🍳', 'Fluffy eggs. Heals 50%.'), F('coconutdrink', 'Coconut Cooler', 50, 0.4, '��', 'Cool and fresh. Heals 40%.'),
  F('applepie', 'Apple Pie', 130, 1, '🥧', 'Warm pie! Heals 100%.'), F('mangoshake', 'Mango Shake', 70, 0.5, '🥤', 'Sweet mango shake. Heals 50%.'), F('friedrice', 'Fried Rice', 90, 0.8, '🍚', 'Rice with veggies and egg. Heals 80%.'),
  // restaurant
  F('momo', 'Momos', 60, 0.5, '🥟', 'Steamed dumplings with dip. Heals 50%.'), F('chowmein', 'Chowmein', 70, 0.6, '🍜', 'Stir-fried noodles. Heals 60%.'), F('eggcurry', 'Egg Curry', 90, 0.8, '🍛', 'Eggs in rich gravy. Heals 80%.'),
  F('coffee', 'Coffee', 30, 1, '☕', 'Hot coffee. Restores energy!', 'energy'), F('pizza', 'Pizza', 120, 1, '🍕', 'Cheesy pizza slice. Heals 100%.'), F('ramen', 'Ramen', 90, 0.8, '🍜', 'Noodle soup with egg. Heals 80%.'),
  F('sushi', 'Sushi', 110, 0.9, '🍣', 'Rice rolls with fish. Heals 90%.'), F('burger', 'Burger', 80, 0.7, '🍔', 'Big tasty burger. Heals 70%.'), F('icecream', 'Ice Cream', 40, 6, '🍦', 'Pets LOVE it! +6 friendship.', 'friend'),
  F('greentea', 'Green Tea', 25, 1, '🍵', 'Calm tea. Restores energy.', 'energy'), F('lassi', 'Mango Lassi', 45, 0.35, '🥛', 'Cold yogurt drink. Heals 35%.'),
  // pet things
  F('pethat', 'Party Hat (pet)', 150, 0, '🎉', 'A cute party hat for your pet.', 'gear'), F('petcap', 'Sport Cap (pet)', 120, 0, '🧢', 'A cool cap for your pet.', 'gear'),
  F('petbow', 'Ribbon Bow (pet)', 100, 0, '🎀', 'A pretty bow for your pet.', 'gear'), F('petscarf', 'Cozy Scarf (pet)', 140, 0, '🧣', 'Keeps your pet warm.', 'gear'),
  F('petflower', 'Flower Crown (pet)', 130, 0, '🌸', 'A crown of flowers.', 'gear'), F('petglasses', 'Cool Glasses (pet)', 160, 0, '🕶️', 'Super cool shades.', 'gear'),
  F('petfood', 'Pet Snack', 35, 4, '🦴', 'Tasty pet snack. +4 friendship.', 'friend'),
];
export const RECIPES: { id: string; needs: Record<string, number> }[] = [
  { id: 'stew', needs: { water: 1, sunberry: 1 } }, { id: 'grilledfish', needs: { fish: 1, wood: 1 } }, { id: 'fishcurry', needs: { fish: 1, water: 1, veg: 1 } },
  { id: 'fruitsalad', needs: { apple: 1, mango: 1, banana: 1 } }, { id: 'vegsoup', needs: { veg: 2, water: 1 } }, { id: 'omelette', needs: { egg: 2, veg: 1 } },
  { id: 'coconutdrink', needs: { coconut: 1 } }, { id: 'applepie', needs: { apple: 2, egg: 1, wood: 1 } }, { id: 'mangoshake', needs: { mango: 1, water: 1 } }, { id: 'friedrice', needs: { veg: 1, egg: 1, wood: 1 } },
];
export const FOOD_MENU: { cat: string; items: string[] }[] = [
  { cat: '🥟 Snacks', items: ['momo', 'burger', 'pizza', 'sushi'] }, { cat: '🍜 Meals', items: ['chowmein', 'ramen', 'eggcurry', 'friedrice'] },
  { cat: '☕ Drinks', items: ['coffee', 'greentea', 'lassi', 'mangoshake'] }, { cat: '🍦 Sweets', items: ['icecream', 'applepie'] },
];
export const ITEMS: Record<string, Item> = {
  lumenpod: { id: 'lumenpod', name: 'Lumen Pod', price: 40, desc: 'Woven-light capture capsule. Standard catch rate.', kind: 'capture', value: 1, icon: '🔆' },
  grandpod: { id: 'grandpod', name: 'Grand Pod', price: 120, desc: 'Reinforced capsule. 1.6× catch rate.', kind: 'capture', value: 1.6, icon: '💠' },
  sunberry: { id: 'sunberry', name: 'Sunberry', price: 25, desc: 'Restores 40% HP. Creatures love it (+2 friendship).', kind: 'heal', value: 0.4, icon: '🍊' },
  mintleaf: { id: 'mintleaf', name: 'Mintleaf', price: 30, desc: 'Restores energy & cures status.', kind: 'energy', value: 1, icon: '🌿' },
  honeycake: { id: 'honeycake', name: 'Honeycake', price: 60, desc: 'A treat. +8 friendship.', kind: 'friend', value: 8, icon: '🍯' },
  revivedew: { id: 'revivedew', name: 'Revive Dew', price: 150, desc: 'Revives a fainted creature at 50% HP.', kind: 'revive', value: 0.5, icon: '💧' },
  water: { id: 'water', name: 'Fresh Water', price: 10, desc: 'Cool water. Pets love a drink (+energy, +1 friend).', kind: 'energy', value: 1, icon: '💧' },
  stew: { id: 'stew', name: 'Berry Stew', price: 80, desc: 'Home cooking! Heals 100% HP.', kind: 'heal', value: 1, icon: '🍲' },
  fish: { id: 'fish', name: 'Fresh Fish', price: 40, desc: 'A tasty fish. Pets love it (+4 friend).', kind: 'friend', value: 4, icon: '🐟' },
  wood: { id: 'wood', name: 'Firewood', price: 30, desc: 'Chopped wood. Sell it at a shop.', kind: 'key', value: 0, icon: '🪵' },
  shrinestone: { id: 'shrinestone', name: 'Shrine Stone', price: 0, desc: 'An ancient carved stone humming with old power.', kind: 'key', value: 0, icon: '🪨' },
};

EXTRA_ITEMS.forEach(i => (ITEMS[i.id] = i));
export interface QuestDef { id: string; name: string; kind: 'Main' | 'Side' | 'Creature' | 'Exploration' | 'Collection' | 'Trainer' | 'Hidden'; desc: string; goal: number; reward: { money: number; items?: Record<string, number>; card?: string }; requires?: string }
export const QUESTS: QuestDef[] = [
  { id: 'm1', name: 'A Partner for the Road', kind: 'Main', desc: 'Speak to Elder Wren in Embervale and choose a partner.', goal: 1, reward: { money: 100, items: { lumenpod: 5 } } },
  { id: 'm2', name: 'Into Thornreach', kind: 'Main', desc: 'Travel north to Thornreach Route.', goal: 1, reward: { money: 50 }, requires: 'm1' },
  { id: 'm3', name: 'The Rival Appears', kind: 'Main', desc: 'Defeat your rival Kael on Thornreach Route.', goal: 1, reward: { money: 300, items: { grandpod: 2 } }, requires: 'm2' },
  { id: 'm4', name: 'Shadows over the Ruins', kind: 'Main', desc: 'Stop Hollow Veil Commander Morrow at the Sunken Ruins.', goal: 1, reward: { money: 1000, card: 'boss_morrow' }, requires: 'm3' },
  { id: 's1', name: 'Field Research', kind: 'Creature', desc: 'Capture 3 wild creatures for Professor Ilsa.', goal: 3, reward: { money: 200, items: { grandpod: 3 } } },
  { id: 's2', name: 'Sunberry Harvest', kind: 'Collection', desc: 'Gather 5 Sunberries from route bushes.', goal: 5, reward: { money: 120, items: { honeycake: 2 } } },
  { id: 's3', name: 'Bond of Trust', kind: 'Side', desc: 'Feed or pet your creatures 5 times.', goal: 5, reward: { money: 80, items: { honeycake: 1 } } },
  { id: 't1', name: 'Route Challenger', kind: 'Trainer', desc: 'Defeat Explorer Bram and Beginner Pip.', goal: 2, reward: { money: 150 } },
  { id: 'e1', name: 'Cartographer', kind: 'Exploration', desc: 'Discover all 4 locations.', goal: 4, reward: { money: 150, card: 'loc_ruins' } },
  { id: 'h1', name: '??? Whispering Stone', kind: 'Hidden', desc: 'Something glimmers at the far east edge of the route...', goal: 1, reward: { money: 300, card: 'special_shrine' } },
];

export interface CardDef { id: string; name: string; cat: 'Creature' | 'Trainer' | 'Boss' | 'Location' | 'Legendary' | 'Special'; rarity: 'Normal' | 'Rare' | 'Ultra Rare' | 'Legendary'; desc: string; icon: string }
export const CARDS: CardDef[] = [
  ...Object.values(SPECIES).map((s): CardDef => ({ id: 'c_' + s.id, name: s.name, cat: 'Creature', rarity: (['Normal', 'Normal', 'Rare', 'Ultra Rare', 'Legendary'] as const)[s.rarity], desc: s.lore, icon: '🐾' })),
  { id: 'tr_pip', name: 'Beginner Pip', cat: 'Trainer', rarity: 'Normal', desc: 'Just got her first creature and is VERY excited.', icon: '🧢' },
  { id: 'tr_bram', name: 'Explorer Bram', cat: 'Trainer', rarity: 'Normal', desc: 'Maps every path. Has never once been lost (he claims).', icon: '🧭' },
  { id: 'tr_kael', name: 'Rival Kael', cat: 'Trainer', rarity: 'Rare', desc: 'Your childhood friend, determined to surpass you.', icon: '⚡' },
  { id: 'boss_morrow', name: 'Commander Morrow', cat: 'Boss', rarity: 'Ultra Rare', desc: 'Hollow Veil commander who believes creatures must be controlled to prevent another Sundering.', icon: '🎭' },
  { id: 'loc_village', name: 'Embervale', cat: 'Location', rarity: 'Normal', desc: 'A hearth village where every chimney is shaped differently.', icon: '🏡' },
  { id: 'loc_route', name: 'Thornreach Route', cat: 'Location', rarity: 'Normal', desc: 'Bramble meadows and wind-bent trees.', icon: '🌾' },
  { id: 'loc_grove', name: 'Whisper Grove', cat: 'Location', rarity: 'Rare', desc: 'A grove where night creatures gather.', icon: '🌲' },
  { id: 'loc_ruins', name: 'Sunken Ruins', cat: 'Location', rarity: 'Rare', desc: 'Ancient stones from before the Sundering.', icon: '🏛️' },
  { id: 'special_shrine', name: 'Whispering Stone', cat: 'Special', rarity: 'Ultra Rare', desc: 'Carvings depict a winged guardian of light. (Legendary quest: UNFINISHED)', icon: '🪨' },
  { id: 'leg_aurorath', name: 'Aurorath ???', cat: 'Legendary', rarity: 'Legendary', desc: 'UNFINISHED — legendary guardian, future expansion.', icon: '🌟' },
];

export interface TrainerDef { id: string; name: string; title: string; team: { sp: string; lvl: number }[]; money: number; card: string; intro: string; win: string; lose: string; aggr: number; color: string }
export const TRAINERS: Record<string, TrainerDef> = {
  pip: { id: 'pip', name: 'Pip', title: 'Beginner', team: [{ sp: 'gustwing', lvl: 5 }], money: 80, card: 'tr_pip', intro: "Oh! A trainer! My Gustwing and I are gonna be the best!", win: 'Aww... you were amazing though!', lose: 'We did it! We actually did it!', aggr: 0.3, color: '#ff9ad0' },
  bram: { id: 'bram', name: 'Bram', title: 'Explorer', team: [{ sp: 'pebblob', lvl: 7 }, { sp: 'gustwing', lvl: 7 }], money: 140, card: 'tr_bram', intro: 'Every path has a toll. Mine is a battle!', win: 'Hm. I should map YOUR moves next time.', lose: 'Ha! Experience wins.', aggr: 0.5, color: '#8a6a3a' },
  kael: { id: 'kael', name: 'Kael', title: 'Rival', team: [{ sp: 'gustwing', lvl: 8 }, { sp: '@counter', lvl: 10 }], money: 300, card: 'tr_kael', intro: "Took you long enough! I picked my partner to beat yours. Let's go!", win: "...Fine. You win this time. I'll be stronger next time — count on it.", lose: "Ha! Train harder, then come find me.", aggr: 0.65, color: '#3b6aff' },
  morrow: { id: 'morrow', name: 'Morrow', title: 'Hollow Veil Commander', team: [{ sp: 'shadeling', lvl: 11 }, { sp: 'ironmaw', lvl: 14 }], money: 1000, card: 'boss_morrow', intro: "The Sundering happened because creatures were left free. The Hollow Veil will bind them all. Step aside, child.", win: "Impossible... a bond that strong? ...This isn't over. The Veil is larger than you know.", lose: "You see? Bonds are weakness. Control is peace.", aggr: 0.85, color: '#5a2b90' },
};

export const STARTERS = ['emberkit', 'rillfin', 'mossbun', 'voltmite', 'pebblob'];
// Rival picks the type strong against the player's starter
export const COUNTER: Record<string, string> = { emberkit: 'rillfin', rillfin: 'voltmite', mossbun: 'emberkit', voltmite: 'pebblob', pebblob: 'mossbun' };

export const LOCATIONS = [
  { id: 'village', name: 'Embervale', x: 0, z: 0, card: 'loc_village' },
  { id: 'route', name: 'Thornreach Route', x: 0, z: 70, card: 'loc_route' },
  { id: 'grove', name: 'Whisper Grove', x: -22, z: 130, card: 'loc_grove' },
  { id: 'ruins', name: 'Sunken Ruins', x: 0, z: 200, card: 'loc_ruins' },
];

export const ACHIEVEMENTS = [
  { id: 'first_partner', name: 'First Bond', desc: 'Choose a starter.' },
  { id: 'first_capture', name: 'Caught One!', desc: 'Capture a wild creature.' },
  { id: 'five_captures', name: 'Collector', desc: 'Capture 5 creatures.' },
  { id: 'evolve', name: 'Metamorphosis', desc: 'Evolve a creature.' },
  { id: 'lvl10', name: 'Seasoned', desc: 'Reach level 10 with a creature.' },
  { id: 'rival', name: 'Rivalry Begins', desc: 'Defeat Kael.' },
  { id: 'boss', name: 'Veil Breaker', desc: 'Defeat Commander Morrow.' },
  { id: 'explorer', name: 'Explorer', desc: 'Discover every location.' },
  { id: 'cards10', name: 'Card Sharp', desc: 'Own 10 different cards.' },
  { id: 'bestfriend', name: 'Best Friends', desc: 'Reach 100 friendship.' },
  { id: 'secret', name: 'Whisperer', desc: 'Find the hidden stone.' },
  { id: 'worker', name: 'Hard Worker', desc: 'Do 10 jobs (water, wood, fishing, cooking).' },
  { id: 'traveler', name: 'Traveler', desc: 'Visit 3 towns.' },
  { id: 'arena', name: 'Arena Star', desc: 'Win an arena battle.' },
  { id: 'miner', name: 'Lucky Strike', desc: 'Dig up a diamond in a mine.' },
  { id: 'fourth', name: 'Beyond the Veil', desc: 'Awaken the single portal to the Fourth Dimension.' },
  { id: 'duelist', name: 'Human Duelist', desc: 'Win a weapon duel in the Fourth Dimension.' },
];

export const CHAR_PRESETS = [
  { name: 'Ember Swordsman', body: 'male', skin: '#f1c7a0', hair: 'messy', hairColor: '#3a1a1a', top: '#1e2430', bottom: '#1e2430', shoes: '#f0f0f0', acc: 'none', pack: 'none', coat: 'hex', coatA: '#e8a03a', coatB: '#7a2a1a', eye: '#b03a2a' },
  { name: 'Moon Dancer', body: 'female', skin: '#f6dcc8', hair: 'long', hairColor: '#2a1a3a', top: '#1e2430', bottom: '#1e2430', shoes: '#f0f0f0', acc: 'none', pack: 'none', coat: 'wave', coatA: '#e8d8ff', coatB: '#7a5ac0', eye: '#8a5ad0' },
  { name: 'Storm Blade', body: 'male', skin: '#e8c0a0', hair: 'spiky', hairColor: '#f0d040', top: '#1e2430', bottom: '#1e2430', shoes: '#f0f0f0', acc: 'none', pack: 'none', coat: 'arrow', coatA: '#ffe066', coatB: '#e07a1a', eye: '#d08a1a' },
  { name: 'Ash Scout', body: 'male', skin: '#f1c7a0', hair: 'spiky', hairColor: '#3a2a20', top: '#d0482b', bottom: '#2b3a5a', shoes: '#222', acc: 'scarf', pack: 'satchel' },
  { name: 'River Girl', body: 'female', skin: '#8a5a3a', hair: 'long', hairColor: '#111', top: '#2b8bd0', bottom: '#e0d0b0', shoes: '#8a5a2b', acc: 'none', pack: 'roll' },
  { name: 'Moss Ranger', body: 'female', skin: '#e0b090', hair: 'bob', hairColor: '#c0702b', top: '#3b8a3b', bottom: '#5a4a3a', shoes: '#3a2a1a', acc: 'hat', pack: 'big' },
  { name: 'Storm Chaser', body: 'female', skin: '#c08a60', hair: 'pony', hairColor: '#f0e050', top: '#2b2b3a', bottom: '#ffd23b', shoes: '#fff', acc: 'goggles', pack: 'satchel' },
  { name: 'Stone Boy', body: 'male', skin: '#5a3a2a', hair: 'short', hairColor: '#222', top: '#a08a6a', bottom: '#3a3a3a', shoes: '#5a3a2a', acc: 'none', pack: 'big' },
  { name: 'Night Weaver', body: 'female', skin: '#f6dcc8', hair: 'long', hairColor: '#e0e0ff', top: '#4a2b6a', bottom: '#1a1a2a', shoes: '#4a2b6a', acc: 'glasses', pack: 'roll' },
  { name: 'Sunny Tinker', body: 'female', skin: '#d8a070', hair: 'bun', hairColor: '#7a2b2b', top: '#ffa02b', bottom: '#2b5a5a', shoes: '#c03b2b', acc: 'goggles', pack: 'satchel' },
  { name: 'Cap Kid', body: 'male', skin: '#f0d0b0', hair: 'messy', hairColor: '#1a1a24', top: '#222230', bottom: '#2b4a8a', shoes: '#111', acc: 'hat', pack: 'satchel' },
  { name: 'Smart Boy', body: 'male', skin: '#f6dcc8', hair: 'short', hairColor: '#2a1a14', top: '#e8e8e8', bottom: '#2b3a6a', shoes: '#fff', acc: 'glasses', pack: 'roll' },
  { name: 'Wild Hiker', body: 'male', skin: '#c08a60', hair: 'undercut', hairColor: '#c05a2b', top: '#3b8a5a', bottom: '#4a3a2a', shoes: '#5a3a1a', acc: 'goggles', pack: 'big' },
];
export const HAIR_STYLES = ['short', 'messy', 'spiky', 'undercut', 'buzz', 'long', 'bob', 'pony', 'bun'];
export const ACCESSORIES = ['none', 'scarf', 'hat', 'goggles', 'glasses'];
export const PACKS = ['none', 'satchel', 'roll', 'big'];
export const EMOTES = ['👋 Wave', '🎉 Cheer', '🙇 Bow', '💃 Dance'];
