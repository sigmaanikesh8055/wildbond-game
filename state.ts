import { SPECIES, PERSONALITIES, PERSONALITY_MOD, QUESTS, CARDS, Personality, LOCATIONS } from './data';
import type { DailyState } from './daily';
import type { TrainerGift } from './rewards';

export interface CreatureInst { uid: string; sp: string; nick: string; lvl: number; xp: number; hp: number; friend: number; pers: Personality; caughtAt: string; fainted?: boolean; acc?: string; skills?: Record<string, number>; genes?: { parents?: string[]; inheritedType?: string; palette?: string; mutation?: string; inheritedAbility?: string }; incubationUntil?: number }
export interface Airport { id: string; name: string; x: number; z: number }
export interface Request { npc: string; name: string; item: string; n: number; reward: number }
export interface Town { id: string; name: string; x: number; z: number; kind: string }
export interface Look { coat?: string; coatA?: string; coatB?: string; eye?: string; body?: string; preset: number; skin: string; hair: string; hairColor: string; top: string; bottom: string; shoes: string; acc: string; pack: string; age: string }
export interface SaveData {
  version: 1; name: string; look: Look; money: number; team: CreatureInst[]; storage: CreatureInst[];
  items: Record<string, number>; cards: Record<string, number>; quests: Record<string, { p: number; done: boolean }>;
  flags: Record<string, boolean>; discovered: string[]; achievements: string[]; seen: string[]; caught: string[];
  time: number; day: number; weather: string; pos: [number, number]; playtime: number; savedAt: number;
  home: { level: number; decor: string[] }; stats: { captures: number; wins: number; evolutions: number; feeds: number };
  tutorial: number; difficulty: 'Easy' | 'Normal' | 'Hard'; ngPlus: number;
  towns?: Town[]; camp?: [number, number] | null; campFence?: boolean; works?: number; airports?: Airport[]; request?: Request | null;
  daily?: DailyState; pendingGifts?: TrainerGift[];
  dimensionWins?: number;
  worldSystems?: { eggs: CreatureInst[]; skills: Record<string, Record<string, number>>; explored: string[]; climateClaim: string; homeBuilds: string[]; rankXp: number; bossClaims: string[]; recipes: string[] };
  trainerHealth?: number; trainerHunger?: number;
  adventure?: { eventAt: number; eventId: string; discoveries: string[]; chapter: number; bossWins: string[]; resonance: Record<string, number> };
}

let uidC = 0;
export function makeCreature(sp: string, lvl: number, pers?: Personality): CreatureInst {
  const c: CreatureInst = { uid: Date.now().toString(36) + (uidC++) + Math.random().toString(36).slice(2, 6), sp, nick: SPECIES[sp].name, lvl, xp: 0, hp: 0, friend: 20, pers: pers ?? PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)], caughtAt: '' };
  c.hp = stats(c).hp;
  return c;
}
export function stats(c: CreatureInst) {
  const s = SPECIES[c.sp]; const m = PERSONALITY_MOD[c.pers]; const f = 1 + c.lvl / 10;
  const sk = c.skills ?? {};
  return {
    hp: Math.floor((s.base.hp * (1 + c.lvl / 6) + 20) * (1 + (sk.vitality ?? 0) * 0.08)), atk: Math.floor(s.base.atk * f * (m.atk ?? 1) * (1 + (sk.force ?? 0) * 0.06)), def: Math.floor(s.base.def * f * (m.def ?? 1) * (1 + (sk.guard ?? 0) * 0.07)),
    spd: Math.floor(s.base.spd * f * (m.spd ?? 1) * (1 + (sk.agility ?? 0) * 0.07)), sp: Math.floor(s.base.sp * f * (m.sp ?? 1) * (1 + (sk.focus ?? 0) * 0.08)), energy: 100,
    crit: s.base.crit + (c.friend >= 60 ? 0.05 : 0), res: s.base.res,
  };
}
export const xpNext = (lvl: number) => Math.floor(25 + lvl * 12 + lvl * lvl * 1.4); // grows slowly-slowly
export const MAX_LEVEL = 50;

export function newSave(name: string, look: Look): SaveData {
  const quests: SaveData['quests'] = {}; QUESTS.forEach(q => (quests[q.id] = { p: 0, done: false }));
  return {
    version: 1, name, look, money: 200, team: [], storage: [], items: { sunberry: 3, mintleaf: 1 }, cards: {}, quests, flags: {},
    discovered: [], achievements: [], seen: [], caught: [], time: 9, day: 1, weather: 'Clear', pos: [0, -6], playtime: 0, savedAt: 0,
    home: { level: 1, decor: [] }, stats: { captures: 0, wins: 0, evolutions: 0, feeds: 0 }, tutorial: 0, difficulty: 'Normal', ngPlus: 0, trainerHealth: 100, trainerHunger: 100,
  };
}

const KEY = (slot: number) => `wildbond_save_${slot}`;
export const SLOTS = [0, 1, 2, 3]; // slot 0 = autosave, 1-3 manual
export function writeSave(slot: number, d: SaveData) {
  d.savedAt = Date.now();
  try {
    const json = JSON.stringify(d);
    localStorage.setItem(KEY(slot) + '_tmp', json); // write-then-swap to avoid corrupting a good save
    localStorage.setItem(KEY(slot), json);
    localStorage.removeItem(KEY(slot) + '_tmp');
    return true;
  } catch { return false; }
}
export function readSave(slot: number): SaveData | null {
  try { const r = localStorage.getItem(KEY(slot)); if (!r) return null; const d = JSON.parse(r); if (d.version !== 1) return null; d.trainerHealth = Number.isFinite(d.trainerHealth) ? Math.max(0, Math.min(100, d.trainerHealth)) : 100; d.trainerHunger = Number.isFinite(d.trainerHunger) ? Math.max(0, Math.min(100, d.trainerHunger)) : 100; return d; } catch { return null; }
}
export function deleteSave(slot: number) { localStorage.removeItem(KEY(slot)); }
export function latestSlot(): number | null {
  let best: number | null = null, t = 0;
  SLOTS.forEach(s => { const d = readSave(s); if (d && d.savedAt > t) { t = d.savedAt; best = s; } });
  return best;
}
export function collectionPct(d: SaveData) {
  const total = Object.keys(SPECIES).length + CARDS.length + LOCATIONS.length;
  const have = d.caught.length + Object.keys(d.cards).length + d.discovered.length;
  return Math.round((have / total) * 100);
}

export interface Settings { master: number; music: number; sfx: number; subtitles: boolean; textSize: number; sens: number; reduceMotion: boolean; shadows: boolean; resScale: number; viewDist: number; aa: boolean; showFps: boolean; fpsCap: number; effects: 'Low' | 'High'; keys: Record<string, string> }
export const DEFAULT_KEYS: Record<string, string> = { light: 'j', heavy: 'k', ab1: '1', ab2: '2', ab3: '3', ult: 'q', dodge: ' ', block: 'shift', capture: 'c', item: 'h', switch: 'tab', flee: 'f', interact: 'e', map: 'm', menu: 'i' };
export function loadSettings(): Settings {
  const def: Settings = { master: 0.7, music: 0.5, sfx: 0.8, subtitles: true, textSize: 1, sens: 1, reduceMotion: false, shadows: true, resScale: 1, viewDist: 160, aa: true, showFps: false, fpsCap: 0, effects: 'High', keys: { ...DEFAULT_KEYS } };
  try { const r = localStorage.getItem('wildbond_settings'); if (r) { const p = JSON.parse(r); return { ...def, ...p, keys: { ...DEFAULT_KEYS, ...(p.keys || {}) } }; } } catch { /* ignore */ }
  return def;
}
export function saveSettings(s: Settings) { localStorage.setItem('wildbond_settings', JSON.stringify(s)); }
