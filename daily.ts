import type { SaveData } from './state';

export type DailyAction = 'partner' | 'talk' | 'move' | 'berry' | 'water' | 'wood' | 'fish' | 'pet' | 'play' | 'feed' | 'train' | 'rest' | 'buy' | 'cook' | 'wildWin' | 'capture' | 'camp';
export interface DailyTask {
  id: string; title: string; tip: string; icon: string; action: DailyAction; goal: number;
  reward: { money: number; items?: Record<string, number> };
}
export interface DailyState { day: number; ids: string[]; index: number; progress: number; ready: boolean; chain?: number; bestChain?: number }

const reward = (money: number, items?: Record<string, number>) => ({ money, items });
export const DAILY_TASKS: Record<string, DailyTask> = {
  partner: { id: 'partner', title: 'Meet your first friend', tip: 'Talk to Elder Wren and choose a pet.', icon: '01', action: 'partner', goal: 1, reward: reward(35, { sunberry: 1 }) },
  talk: { id: 'talk', title: 'Say hello', tip: 'Talk to anyone in the village.', icon: 'HI', action: 'talk', goal: 1, reward: reward(25) },
  talk2: { id: 'talk2', title: 'Catch up', tip: 'Have two conversations with people.', icon: 'HI', action: 'talk', goal: 2, reward: reward(40) },
  walk40: { id: 'walk40', title: 'Morning stroll', tip: 'Walk 40 metres. The joystick or keys both count.', icon: 'GO', action: 'move', goal: 40, reward: reward(30) },
  walk85: { id: 'walk85', title: 'Take the long path', tip: 'Travel 85 metres on foot.', icon: 'GO', action: 'move', goal: 85, reward: reward(55) },
  walk130: { id: 'walk130', title: 'See a little more', tip: 'Travel 130 metres on foot.', icon: 'GO', action: 'move', goal: 130, reward: reward(85) },
  berry: { id: 'berry', title: 'Pick a sunberry', tip: 'Find a berry bush along Thornreach Path.', icon: 'BR', action: 'berry', goal: 1, reward: reward(35) },
  berry2: { id: 'berry2', title: 'Berry basket', tip: 'Pick from two bushes. They grow back each day.', icon: 'BR', action: 'berry', goal: 2, reward: reward(65, { honeycake: 1 }) },
  water: { id: 'water', title: 'Fill your flask', tip: 'Use the well in Embervale or another village.', icon: 'WT', action: 'water', goal: 1, reward: reward(30) },
  water2: { id: 'water2', title: 'Water for the journey', tip: 'Fill water at a well twice.', icon: 'WT', action: 'water', goal: 2, reward: reward(50) },
  wood: { id: 'wood', title: 'Gather firewood', tip: 'Chop a stump near the village or route.', icon: 'WD', action: 'wood', goal: 1, reward: reward(40) },
  wood2: { id: 'wood2', title: 'Stock the fire', tip: 'Chop two stumps.', icon: 'WD', action: 'wood', goal: 2, reward: reward(65) },
  fish: { id: 'fish', title: 'Catch a fish', tip: 'Try the village pond, the river, a lake or the sea.', icon: 'FS', action: 'fish', goal: 1, reward: reward(55) },
  fish2: { id: 'fish2', title: 'Fresh catch', tip: 'Catch two fish. Keep trying if one gets away.', icon: 'FS', action: 'fish', goal: 2, reward: reward(85) },
  pet: { id: 'pet', title: 'A kind touch', tip: 'Open Team and pet one of your friends.', icon: 'PT', action: 'pet', goal: 1, reward: reward(35) },
  play: { id: 'play', title: 'Play together', tip: 'Open Team and play with a pet.', icon: 'PL', action: 'play', goal: 1, reward: reward(40) },
  feed: { id: 'feed', title: 'Snack time', tip: 'Feed a pet from Team. A berry or treat works.', icon: 'FD', action: 'feed', goal: 1, reward: reward(40, { sunberry: 1 }) },
  train: { id: 'train', title: 'Practice together', tip: 'Train a pet from Team for 20 coins.', icon: 'TR', action: 'train', goal: 1, reward: reward(55) },
  rest: { id: 'rest', title: 'Take a break', tip: 'Sleep at home, rest at camp or use a shelter.', icon: 'ZZ', action: 'rest', goal: 1, reward: reward(45, { mintleaf: 1 }) },
  camp: { id: 'camp', title: 'Make a campsite', tip: 'Build a camp in the wild. A fence is optional.', icon: 'CP', action: 'camp', goal: 1, reward: reward(55) },
  buy: { id: 'buy', title: 'Visit a shop', tip: 'Buy any item from a shop.', icon: 'SH', action: 'buy', goal: 1, reward: reward(50) },
  cook: { id: 'cook', title: 'Cook a meal', tip: 'Use the stove at home or a campfire.', icon: 'CK', action: 'cook', goal: 1, reward: reward(85, { honeycake: 1 }) },
  wildWin: { id: 'wildWin', title: 'Train in the wild', tip: 'Win a fight against a wild pet.', icon: 'VS', action: 'wildWin', goal: 1, reward: reward(85) },
  wildWin2: { id: 'wildWin2', title: 'Stronger together', tip: 'Win two wild fights.', icon: 'VS', action: 'wildWin', goal: 2, reward: reward(135) },
  capture: { id: 'capture', title: 'A new friend', tip: 'Weaken a wild pet, then catch it.', icon: 'CT', action: 'capture', goal: 1, reward: reward(90, { lumenpod: 2 }) },
  capture2: { id: 'capture2', title: 'Field collector', tip: 'Catch two wild pets.', icon: 'CT', action: 'capture', goal: 2, reward: reward(145, { lumenpod: 2 }) },
};

// Nine steps per in-game day. Each group rotates by day, so chores, bonding,
// exploring, battles and meals vary without requiring an already found region.
const stages = [
  ['talk', 'walk40'],
  ['berry', 'water', 'wood'],
  ['pet', 'play', 'feed'],
  ['walk85', 'talk2', 'train'],
  ['water', 'fish', 'wood2'],
  ['wildWin', 'capture'],
  ['rest', 'camp'],
  ['cook', 'buy', 'fish2'],
  ['wildWin2', 'capture2', 'walk130'],
];

export const DAILY_BONUS = { money: 180, items: { grandpod: 1 } };

function tasksForDay(day: number, hasPartner: boolean) {
  const offset = Math.max(0, day - 1);
  const ids = stages.map((choices, i) => choices[(offset + Math.floor(offset / 3) * i) % choices.length]);
  if (!hasPartner) ids.unshift('partner');
  return ids;
}

export function syncDaily(save: SaveData): boolean {
  const d = save.daily;
  if (d?.day === save.day && Array.isArray(d.ids) && d.ids.length > 0 && d.ids.every(id => !!DAILY_TASKS[id]) && Number.isFinite(d.index)) return false;
  save.daily = { day: save.day, ids: tasksForDay(save.day, !!save.flags.starter || save.team.length > 0), index: 0, progress: 0, ready: false };
  return true;
}

export function activeDaily(save: SaveData): DailyTask | null {
  syncDaily(save);
  return DAILY_TASKS[save.daily!.ids[save.daily!.index]] ?? null;
}

export interface DailyUpdate { changed: boolean; completed: boolean; final: boolean; chainBonus?: number; task?: DailyTask }
export function recordDaily(save: SaveData, action: DailyAction, amount = 1): DailyUpdate {
  syncDaily(save);
  const d = save.daily!, task = activeDaily(save);
  if (!task || d.ready || task.action !== action || !Number.isFinite(amount) || amount <= 0) return { changed: false, completed: false, final: false };
  d.progress = Math.min(task.goal, d.progress + amount);
  if (d.progress < task.goal) return { changed: true, completed: false, final: false, task };
  d.ready = true;
  d.chain = (d.chain ?? 0) + 1;
  d.bestChain = Math.max(d.bestChain ?? 0, d.chain);
  // Pay immediately when the objective is met, so a day change cannot erase an earned reward.
  save.money += task.reward.money;
  Object.entries(task.reward.items ?? {}).forEach(([id, count]) => { save.items[id] = (save.items[id] || 0) + count; });
  const chainBonus = d.chain % 3 === 0 ? 75 + Math.floor(d.chain / 3) * 25 : 0;
  if (chainBonus) save.money += chainBonus;
  const final = d.index === d.ids.length - 1;
  if (final) {
    save.money += DAILY_BONUS.money;
    Object.entries(DAILY_BONUS.items).forEach(([id, count]) => { save.items[id] = (save.items[id] || 0) + count; });
  }
  return { changed: true, completed: true, final, chainBonus, task };
}

export function nextDaily(save: SaveData) {
  syncDaily(save);
  const d = save.daily!;
  if (!d.ready || d.index >= d.ids.length) return false;
  d.index++;
  d.progress = 0;
  d.ready = false;
  return true;
}