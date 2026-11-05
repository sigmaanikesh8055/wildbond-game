import type { SaveData } from './state';

export interface TrainerGift {
  id: string; sourceId: string; sourceName: string; icon: string;
  money: number; items: Record<string, number>; createdAt: number;
}

export function queueTrainerGift(save: SaveData, sourceId: string, sourceName: string): TrainerGift {
  const boss = sourceId === 'morrow', rival = sourceId === 'kael', arena = sourceId.startsWith('arena_');
  const seed = Math.abs((save.stats.wins * 37 + save.day * 19 + sourceId.length * 11) % 5);
  const extras = ['sunberry', 'mintleaf', 'honeycake', 'lumenpod', 'revivedew'];
  const items: Record<string, number> = { [extras[seed]]: boss ? 2 : 1 };
  if (boss || arena || rival) items.grandpod = boss ? 2 : 1;
  const gift: TrainerGift = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceId, sourceName, icon: boss ? 'M' : arena ? 'A' : rival ? 'K' : 'W',
    money: boss ? 160 : arena ? 110 : rival ? 75 : 35 + seed * 10,
    items, createdAt: Date.now(),
  };
  (save.pendingGifts ||= []).push(gift);
  return gift;
}

export function claimTrainerGift(save: SaveData, id: string): TrainerGift | null {
  const queue = (save.pendingGifts ||= []);
  const at = queue.findIndex(g => g.id === id);
  if (at === -1) return null;
  const [gift] = queue.splice(at, 1);
  save.money += gift.money;
  Object.entries(gift.items).forEach(([item, count]) => { save.items[item] = (save.items[item] || 0) + count; });
  return gift;
}