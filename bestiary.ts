import type { Species, ElemType, Ability, Role } from './data';

// 70 extra wild species, built from body plans + features (data-driven; add a line to add a creature).
export type Plan = 'quad' | 'biped' | 'blob' | 'bird' | 'serpent' | 'fish' | 'bug' | 'ghost';
export interface Gen { plan: Plan; ears: string; tail: string; horn: string; f: Set<string>; eye: string; evo: boolean }

export const EXTRA_ABILITIES: Record<string, Ability> = {
  mindwave: { id: 'mindwave', name: 'Mind Wave', type: 'psychic', kind: 'projectile', power: 28, cost: 18, cd: 2.6, range: 15, status: 'stun', desc: 'A wave of thought.', color: '#ff6ad5' },
  psyburst: { id: 'psyburst', name: 'Psy Burst', type: 'psychic', kind: 'aoe', power: 40, cost: 32, cd: 7, range: 5.5, status: 'slow', desc: 'Bursts with mind power.', color: '#ff9ae8' },
  glimmer: { id: 'glimmer', name: 'Glimmer', type: 'light', kind: 'projectile', power: 26, cost: 16, cd: 2.2, range: 16, desc: 'A sparkle of light.', color: '#fff6a0' },
  prismdash: { id: 'prismdash', name: 'Prism Dash', type: 'light', kind: 'dash', power: 32, cost: 22, cd: 4, range: 8, desc: 'Dashes like a rainbow.', color: '#fffbd0' },
  radiance: { id: 'radiance', name: 'Radiance', type: 'light', kind: 'aoe', power: 38, cost: 30, cd: 7, range: 5, status: 'stun', desc: 'A blinding flash.', color: '#ffffff' },
  aethershot: { id: 'aethershot', name: 'Star Shot', type: 'aether', kind: 'projectile', power: 30, cost: 20, cd: 2.6, range: 16, status: 'poison', desc: 'A shard of starlight.', color: '#c0a0ff' },
  voidring: { id: 'voidring', name: 'Void Ring', type: 'aether', kind: 'aoe', power: 46, cost: 34, cd: 8, range: 5.5, status: 'slow', desc: 'A ring of empty space.', color: '#8a6aff' },
};
const TYPE_ABIL: Record<ElemType, [string, string, string]> = {
  fire: ['cinderspit', 'flarepounce', 'emberring'], water: ['bubblelance', 'riptail', 'tidecoil'], nature: ['thornvolley', 'sporeburst', 'rootguard'],
  electric: ['arcbolt', 'sparkhop', 'staticfield'], earth: ['pebbleshot', 'quakestomp', 'stoneskin'], wind: ['galecut', 'divebomb', 'galecut'],
  shadow: ['gloomshard', 'fadestep', 'veilpulse'], ice: ['frostbite', 'shardspray', 'shardspray'], metal: ['rivetstorm', 'ironjaw', 'rivetstorm'],
  psychic: ['mindwave', 'psyburst', 'psyburst'], light: ['glimmer', 'prismdash', 'radiance'], aether: ['aethershot', 'voidring', 'voidring'],
};
const ROLE_BASE: Record<string, number[]> = {
  Tank: [72, 56, 74, 36, 50], Attacker: [50, 76, 46, 56, 60], 'Fast Attacker': [46, 62, 40, 80, 54], Support: [60, 44, 56, 50, 70],
  Defensive: [64, 50, 80, 40, 54], Balanced: [55, 58, 56, 55, 58], Status: [52, 48, 50, 58, 66],
};
const PLAN_TXT: Record<Plan, string> = { quad: 'pads softly on four paws', biped: 'walks upright and loves to show off', blob: 'wobbles happily wherever it goes', bird: 'rides warm winds high above', serpent: 'slides along in long, graceful waves', fish: 'floats through the air as if swimming', bug: 'scuttles busily on six tiny legs', ghost: 'drifts quietly and hides in shadows' };
const TYPE_TXT: Record<ElemType, string> = { fire: 'Its body is always warm to hug.', water: 'It leaves little puddles behind.', nature: 'Flowers bloom where it naps.', electric: 'Its fur crackles with sparks.', earth: 'It loves to dig and collect stones.', wind: 'It never stands still.', ice: 'Its breath makes tiny snowflakes.', shadow: 'It only feels brave at night.', light: 'It glows softly in the dark.', metal: 'Its shiny body rings like a bell.', psychic: 'It can feel what you are thinking.', aether: 'Nobody knows where it comes from.' };
const BIOME_NAME: Record<string, string> = { m: 'meadows', f: 'forests', s: 'snowy lands', d: 'deserts', w: 'lakes', n: 'night time', o: 'the ocean', i: 'the frozen south', h: 'haunted places', c: 'dark caves', u: 'mountains', j: 'jungles', v: 'savannas', y: 'the high sky', l: 'flower valleys' };
const EARS: Record<string, string> = { ec: 'cat', el: 'long', er: 'round', ef: 'fin' };
const TAILS: Record<string, string> = { tf: 'fluffy', tt: 'thin', tm: 'flame', tl: 'leaf', tn: 'fin', tc: 'club' };
const HORNS: Record<string, string> = { h1: 'one', h2: 'two', ha: 'antler', hc: 'crystal' };
const PLAN_SCALE: Record<Plan, number> = { quad: 0.85, biped: 0.85, blob: 0.8, bird: 0.8, serpent: 0.85, fish: 0.8, bug: 0.78, ghost: 0.8 };

// Name|type|plan|color|accent|eye|features|biomes|role|rarity|evolves-into-next
const TABLE = `Puffleaf|nature|quad|#9ad66e|#fff2b8|#3a7a2a|el tl b|mf|Status|1|>
Bloomantle|nature|quad|#5fb84c|#ff9ad0|#2a6a2a|el tl b m|mf|Tank|2|
Sootpup|fire|quad|#5a4a48|#ff8a3a|#ff6a1b|ec tm b|dm|Attacker|1|>
Cinderhound|fire|quad|#3a2e30|#ff6a1b|#ffb02b|ec tm m s|dm|Attacker|2|
Drizzlet|water|serpent|#6ac8ff|#e8fbff|#1b6fe0|ef tn b|w|Support|1|>
Torrentail|water|serpent|#2a8ae8|#9ff0ff|#0b3fa0|ef tn h2 s|w|Tank|2|
Zapkit|electric|quad|#ffe14a|#3a3040|#2b6aff|ec tt b|m|Fast Attacker|1|>
Voltigress|electric|quad|#ffd02a|#2a2438|#1b4ad0|ec tt p m|m|Fast Attacker|3|
Pebbit|earth|biped|#c8a878|#8a6a4a|#5a3a1a|er tc b|dm|Defensive|1|>
Bouldrake|earth|biped|#9a7a58|#6a5a4a|#ff8a00|er tc h2 s|dm|Tank|2|
Breezel|wind|bird|#d8f6ff|#6ab0d8|#2a6a9b|tf b|m|Fast Attacker|1|>
Zephyrex|wind|bird|#a8e8ff|#3a8ac0|#1b4a7a|tf h1 m|m|Fast Attacker|3|
Glimmoth|light|bug|#fff2c8|#ffd23b|#c08a1b|w g|nf|Support|1|>
Lunamoth|light|bug|#e8e0ff|#b8a0ff|#6a4ac0|w g h2|nf|Support|3|
Snowbun|ice|quad|#f4fbff|#9fd8ff|#3a8ac0|el tf b|s|Balanced|1|>
Glaciuff|ice|quad|#dff4ff|#6ac0ff|#1b6ab0|el tf m hc|s|Defensive|2|
Ironbud|metal|biped|#a8b4c0|#ffd23b|#2a3a4a|er tn b|d|Defensive|1|>
Gearhorn|metal|biped|#7a8a98|#ffb02b|#1a2a3a|er h1 s|d|Tank|3|
Mindle|psychic|blob|#ffb0e8|#a06ad0|#7a2ab0|h1 g|fn|Status|1|>
Psyclops|psychic|blob|#e88ad8|#6a3ab0|#4a1a80|h2 g s|fn|Attacker|3|
Murkit|shadow|quad|#3a3050|#b06aff|#ffd23b|ec tt|n|Fast Attacker|1|>
Nightprowl|shadow|quad|#241c38|#9a4aff|#ffe14a|ec tt m s|n|Attacker|3|
Coralin|water|fish|#ff9ab0|#fff0e8|#d03a6a|tn p|w|Support|1|>
Reefguard|water|fish|#ff7a90|#ffe0b0|#a01a4a|tn p s h2|w|Defensive|2|
Sproutle|nature|biped|#a8d870|#7a5a3a|#3a6a1a|el tl b|f|Balanced|1|>
Oakenard|nature|biped|#6a9a48|#7a5232|#2a4a12|ha tl m|f|Tank|3|
Flitflare|fire|bird|#ff9a4a|#ffe066|#c03a1b|tm|d|Fast Attacker|1|>
Phoenara|fire|bird|#ff6a2a|#ffd23b|#a02010|tm m h1 g|d|Attacker|3|
Frostfin|ice|fish|#c8f0ff|#ffffff|#2a7ab0|tn hc|sw|Balanced|1|>
Iceberath|ice|fish|#9ad8ff|#e8faff|#1a5a90|tn hc s|sw|Tank|3|
Dunewig|earth|serpent|#e8c890|#b08850|#7a4a1a|tn p|d|Status|1|>
Sandrake|earth|serpent|#d0a868|#8a6a3a|#5a3a10|tn p h2 s|d|Attacker|2|
Staticub|electric|biped|#ffe880|#6a5a3a|#3a2a1a|er tt b|m|Balanced|1|>
Thunderbear|electric|biped|#ffd040|#4a3a28|#2a1a0a|er tc m|m|Tank|3|
Wispette|shadow|ghost|#5a4a7a|#9affe8|#5affd0|ec g|n|Status|1|>
Hauntiara|shadow|ghost|#3a2a5a|#7affd0|#3affc0|ec g h2|n|Attacker|3|
Prismite|light|bug|#f0fbff|#a0e8ff|#4ab0d0|hc g|s|Defensive|1|>
Crystalisk|light|bug|#e0f6ff|#7ad8ff|#2a90b0|hc g s|s|Tank|3|
Starlet|aether|bird|#d8c8ff|#fff6a0|#7a5ad0|tf g|n|Support|2|>
Celestine|aether|bird|#b8a0ff|#fff0a0|#5a3ab0|tf g m h1|n|Support|4|
Mudsnout|earth|quad|#9a7050|#c8a080|#4a2a10|er tt b|wm|Tank|1|
Honeybumble|nature|bug|#ffd23b|#3a2a1a|#3a2a1a|w p|m|Support|1|
Galeferret|wind|serpent|#e8d8c0|#8ab0c0|#3a4a5a|er tf|m|Fast Attacker|2|
Lavaslug|fire|blob|#ff6a2a|#3a2420|#ffe066|s g|d|Defensive|2|
Bubbloat|water|blob|#8ad8ff|#ffffff|#1b6fe0|p|w|Support|1|
Thornback|nature|quad|#6a9a4a|#c84a6a|#2a4a12|er tc s|f|Defensive|2|
Quillfox|ice|quad|#e8f6ff|#5ab0e8|#1a5a90|ec tf s|s|Attacker|2|
Rustmole|metal|quad|#b07a4a|#c8c8c8|#2a1a0a|er tt b|d|Balanced|1|
Glowtoad|electric|blob|#6ad88a|#ffe14a|#ffcc00|p g|wn|Status|2|
Owlume|psychic|bird|#b89a7a|#ff9ae0|#ff4ac0|ec tf b|nf|Status|2|
Shellby|water|quad|#7ac0a0|#c8a060|#1a4a3a|tn s b|w|Defensive|1|
Mossgolem|earth|biped|#8a8a7a|#6ab04a|#5aff6a|tc m g|f|Tank|3|
Cindercrow|fire|bird|#3a2a2a|#ff7a2a|#ff4a1a|tf|dn|Attacker|2|
Driftjelly|water|ghost|#c8b0ff|#ffb0e8|#7a4ad0|g p|w|Status|2|
Sunpetal|light|blob|#fff080|#ff9a3a|#c06a1b|hc b|m|Support|1|
Hushbat|shadow|bird|#4a3a5a|#ff9ab0|#ffe14a|el tt|n|Fast Attacker|1|
Tundrox|ice|biped|#e0eef6|#6a8aa0|#2a4a6a|ec h2 m|s|Tank|2|
Voltail|electric|serpent|#3a4aff|#ffe14a|#ffe14a|tt g p|mw|Attacker|2|
Rubblet|earth|blob|#a89a88|#6a5a4a|#3a2a1a|s|d|Defensive|1|
Conepaw|nature|quad|#a07a4a|#5a9a3a|#3a2a1a|er tf s|fs|Balanced|1|
Chimewing|metal|bird|#d0dae0|#ffd23b|#2a4a6a|tt h1|m|Balanced|2|
Dreamew|psychic|quad|#f0d8ff|#ff9ae0|#a04ad0|ec tf h1|mn|Status|3|
Fogling|wind|ghost|#e8f0f4|#b0c8d0|#5a7a8a|er|sf|Status|1|
Sparkfly|electric|bug|#4a4a6a|#fff35a|#fff35a|w g|nm|Fast Attacker|1|
Nectara|nature|bird|#ff8ad0|#9ae07a|#c02a7a|tl b|mf|Support|2|
Cragcrab|earth|bug|#c86a4a|#e8c8a0|#3a1a0a|s h2|w|Defensive|1|
Auraquill|aether|bird|#c0a0ff|#ffffff|#6a3ad0|tf m g|f|Attacker|3|
Gleamhorn|light|quad|#ffffff|#ffd23b|#d0a01b|ec tf h1 m g|f|Balanced|3|
Voidpaw|aether|quad|#2a2040|#c06aff|#ff6ad5|ec tt g s|n|Attacker|4|
Dawnlion|light|quad|#ffd880|#ff8a2a|#c05a10|er tf m|d|Attacker|4|
Reefling|water|fish|#ff8a2a|#ffffff|#1a1a2a|tn p b|o|Fast Attacker|1|>
Coralord|water|fish|#ff6a1a|#ffffff|#1a1a2a|tn p b s|o|Attacker|2|
Puffpop|water|blob|#ffe066|#ff9a2a|#3a2a1a|s p|o|Defensive|1|
Angelfin|water|fish|#5ad0ff|#ffe066|#1a3a6a|tn s|o|Support|2|
Seadrift|water|serpent|#ff9ad0|#ffe8f4|#a02a6a|ef tn g|o|Status|1|
Glidray|water|fish|#3a5a8a|#bfe8ff|#1a2a4a|tn w|o|Balanced|3|
Abyssking|water|serpent|#1a3a7a|#5affd0|#5affd0|ef tn h2 g s|o|Tank|4|
Pengo|ice|biped|#2a2a3a|#ffffff|#3a6ab0|b|i|Balanced|1|>
Emperion|ice|biped|#1e1e2e|#ffd23b|#2a5ab0|b m|i|Tank|3|
Sealpup|ice|blob|#e8eef6|#9ab0c0|#2a3a4a|b|i|Support|1|
Auroram|light|bird|#c0f0ff|#9affc0|#3a8ab0|tf g m|i|Support|4|
Boolantern|shadow|ghost|#e8ecf4|#7affa0|#2affa0|g|h|Status|1|>
Wraithmoor|shadow|ghost|#c8ccdc|#7affa0|#1ae080|g h2 s|h|Attacker|3|
Mistveil|psychic|ghost|#bfb0e8|#ff7ad0|#c03aa0|g ec|hn|Status|2|
Grimspook|shadow|ghost|#2a2238|#ff3a3a|#ff3a3a|g h1 m|h|Attacker|4|
Echobat|wind|bird|#5a4a6a|#ff9ab0|#ffe14a|el tt|c|Fast Attacker|1|>
Caverwing|shadow|bird|#3a2a4a|#c06aff|#ffe14a|el tt s|c|Fast Attacker|3|
Crystalurk|earth|bug|#7a8aa0|#9ae8ff|#3ab0ff|hc g s|c|Defensive|2|
Rockpard|earth|quad|#e8c890|#3a2a1a|#2a8a3a|ec tt p|u|Fast Attacker|2|>
Summitpard|ice|quad|#f0f4f8|#3a3a4a|#3a8ad0|ec tf p m|u|Fast Attacker|3|
Goatling|earth|quad|#e8e0d0|#8a6a4a|#5a3a1a|er h2 b|u|Tank|1|
Vinewisp|nature|ghost|#7ae07a|#ffe066|#ffe066|g el|j|Status|2|
Jungloth|nature|biped|#5a8a3a|#ffd23b|#ffd23b|er tl m g|j|Tank|4|
Parrotop|wind|bird|#ff4a3a|#3ad07a|#1a1a2a|tf b|j|Balanced|1|
Savannox|earth|quad|#d8b878|#6a4a2a|#3a2a1a|er h2 tf|v|Tank|2|
Zebrine|electric|quad|#ffffff|#1a1a1a|#1a1a2a|er tt s|v|Fast Attacker|2|
Dunemane|fire|quad|#e8a050|#7a3a1a|#3a1a0a|er tf m|v|Attacker|3|
Skyray|wind|fish|#7ad0ff|#ffffff|#1a4a7a|tn w|y|Fast Attacker|2|
Stormhawk|electric|bird|#3a4a6a|#ffe14a|#ffe14a|tf h1 m|y|Attacker|3|
Cloudwhale|water|fish|#c8e8ff|#ffffff|#3a6ab0|tn b g|y|Tank|4|`;

export const ORIGINAL_BIOMES: Record<string, string[]> = { gustwing: ['m'], pebblob: ['m', 'd'], voltmite: ['m'], mossbun: ['m', 'f'], emberkit: ['d'], rillfin: ['w'], frostnib: ['s'], shadeling: ['n', 'f'] };

export const EXTRA_SPECIES: Record<string, Species> = {};
const rows = TABLE.split('\n').map(l => l.trim().split('|'));
rows.forEach((r, i) => {
  const [name, type, plan, color, accent, eye, feats, biomes, role, rar, evo] = r;
  const t = type as ElemType; const p = plan as Plan; const toks = feats.split(' ').filter(Boolean);
  const prev = rows[i - 1]; const evolved = !!prev && prev[10] === '>';
  const rarity = +rar as 1 | 2 | 3 | 4; const b = ROLE_BASE[role]; const m = (1 + (rarity - 1) * 0.12) * (evolved ? 1.35 : 1);
  const ab = TYPE_ABIL[t]; const id = name.toLowerCase();
  EXTRA_SPECIES[id] = {
    id, name, type: t, role: role as Role, rarity,
    base: { hp: Math.round(b[0] * m), atk: Math.round(b[1] * m), def: Math.round(b[2] * m), spd: Math.round(b[3] * m), sp: Math.round(b[4] * m), crit: role.includes('Attack') ? 0.14 : 0.09, res: role === 'Tank' || role === 'Defensive' ? 0.25 : 0.12 },
    abilities: evolved ? [ab[0], ab[1], ab[2]] : [ab[0], ab[1]], ult: ab[2],
    style: `${role} · ${p} fighter`, lore: `${name} ${PLAN_TXT[p]}. ${TYPE_TXT[t]}`,
    habitat: biomes.split('').map(c => BIOME_NAME[c]).join(', '), color, accent,
    evolvesTo: evo === '>' ? rows[i + 1][0].toLowerCase() : undefined, evoLevel: evo === '>' ? 14 : undefined,
    scale: PLAN_SCALE[p] * (evolved ? 1.3 : 1) * (rarity === 4 ? 1.25 : 1), lightRange: evolved ? 3 : 2.5,
    biomes: biomes.split(''),
    gen: { plan: p, ears: EARS[toks.find(x => x in EARS) ?? ''] ?? 'none', tail: TAILS[toks.find(x => x in TAILS) ?? ''] ?? 'none', horn: HORNS[toks.find(x => x in HORNS) ?? ''] ?? 'none', f: new Set(toks), eye, evo: evolved },
  };
});
