import { useState } from 'react';
import { SPECIES, ABILITIES, ITEMS, QUESTS, CARDS, ACHIEVEMENTS, LOCATIONS, TYPE_COLORS, PERSONALITY_MOD } from '../game/data';
import { SaveData, CreatureInst, stats, xpNext, Settings, SLOTS, readSave, collectionPct, DEFAULT_KEYS } from '../game/state';
import { Preview } from './Preview';
import { petPic } from './petpic';
import { PORTAL_POS } from '../game/dimension';

export const Btn = ({ children, onClick, kind = 'p', disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; kind?: 'p' | 's' | 'd'; disabled?: boolean; className?: string }) => (
  <button disabled={disabled} onClick={onClick} className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition disabled:opacity-40 ${kind === 'p' ? 'bg-amber-400 text-stone-900 hover:bg-amber-300' : kind === 'd' ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-white/10 text-white hover:bg-white/20'} ${className}`}>{children}</button>
);
export const TypeTag = ({ t }: { t: string }) => <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-stone-900" style={{ background: TYPE_COLORS[t as keyof typeof TYPE_COLORS] }}>{t}</span>;
export const Bar = ({ v, max, color, h = 'h-2' }: { v: number; max: number; color: string; h?: string }) => (
  <div className={`w-full ${h} bg-black/50 rounded overflow-hidden`}><div className="h-full transition-all duration-150" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>
);
export const Portrait = ({ sp, size = 40 }: { sp: string; size?: number }) => {
  const s = SPECIES[sp]; const pic = petPic(sp);
  return <div className="rounded-full flex items-center justify-center font-black text-white shrink-0 border-2 overflow-hidden" style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #ffffff, ${s.accent})`, borderColor: TYPE_COLORS[s.type], fontSize: size * 0.4 }}>{pic ? <img src={pic} alt={s.name} draggable={false} className="w-[118%] h-[118%] max-w-none object-contain" /> : s.name[0]}</div>;
};

type Act = (k: string, c?: CreatureInst, extra?: string) => void;

export function TeamPanel({ save, act, atHome }: { save: SaveData; act: Act; atHome?: boolean }) {
  const [sel, setSel] = useState(0); const c = save.team[sel] ?? save.team[0];
  if (!c) return <p className="text-white/70">No creatures yet. Talk to Elder Wren!</p>;
  const s = SPECIES[c.sp]; const st = stats(c);
  return (
    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex flex-col gap-1 md:w-56">
        {save.team.map((t, i) => (
          <button key={t.uid} onClick={() => setSel(i)} className={`flex items-center gap-2 p-2 rounded-lg text-left ${i === sel ? 'bg-amber-400/30' : 'bg-white/5 hover:bg-white/10'}`}>
            <Portrait sp={t.sp} size={34} />
            <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{t.nick} {i === 0 && <span className="text-amber-300 text-[10px]">LEAD</span>}</div>
              <div className="text-[10px] text-white/60">Lv {t.lvl} {t.fainted || t.hp <= 0 ? '· FAINTED' : ''}</div><Bar v={t.hp} max={stats(t).hp} color="#4ade80" h="h-1" /></div>
          </button>))}
        <p className="text-[10px] text-white/50 mt-1">{save.team.length}/8 active · {save.storage.length} in storage</p>
      </div>
      <div className="flex-1 grid md:grid-cols-[200px_1fr] gap-4">
        <div className="flex flex-col items-center"><Preview sp={c.sp} size={190} /><div className="flex gap-1 mt-1"><TypeTag t={s.type} /><span className="text-[10px] bg-white/10 px-2 rounded">{s.role}</span></div></div>
        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2"><h3 className="text-xl font-black">{c.nick}</h3><span className="text-white/60">({s.name}) Lv {c.lvl}</span></div>
          <p className="text-white/70 text-xs italic">{s.lore}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span>HP {c.hp}/{st.hp}</span><span>XP {c.xp}/{xpNext(c.lvl)}</span><span>Attack {st.atk}</span><span>Defense {st.def}</span><span>Speed {st.spd}</span><span>Special {st.sp}</span>
            <span>Crit {(st.crit * 100).toFixed(0)}%</span><span>Resist {(st.res * 100).toFixed(0)}%</span><span>Energy {st.energy}</span>
            <span>Personality: <b>{c.pers}</b> <span className="text-white/50">({PERSONALITY_MOD[c.pers].desc})</span></span>
          </div>
          <div><span className="text-xs">Friendship {Math.floor(c.friend)}/100 {c.friend >= 60 && '· +5% crit bonus'}</span><Bar v={c.friend} max={100} color="#f472b6" /></div>
          <div className="text-xs text-white/80"><b>Style:</b> {s.style} · <b>Habitat:</b> {s.habitat}</div>
          <div className="text-xs text-white/80"><b>Evolution:</b> {s.evolvesTo ? `→ ${SPECIES[s.evolvesTo].name} at Lv ${s.evoLevel}${s.evoCond === 'night' ? ' (only at night)' : s.evoCond === 'friendship' ? ' (friendship 60+)' : ''}` : 'Final form'}</div>
          <div className="space-y-1">{[...s.abilities, s.ult].map((a, i) => { const ab = ABILITIES[a]; return <div key={a + i} className="text-xs bg-white/5 rounded p-1.5 flex gap-2 items-center"><span className="w-2 h-2 rounded-full" style={{ background: ab.color }} /><b>{i === s.abilities.length ? 'ULT: ' : ''}{ab.name}</b><TypeTag t={ab.type} /><span className="text-white/60">Pow {ab.power} · {ab.cost}EN · {ab.cd}s · {ab.desc}</span></div>; })}</div>
          <div className="flex flex-wrap gap-1 pt-1">
            <Btn onClick={() => act('feed', c, 'sunberry')} disabled={!save.items.sunberry}>Feed Sunberry ({save.items.sunberry ?? 0})</Btn>
            <Btn onClick={() => act('feed', c, 'honeycake')} disabled={!save.items.honeycake}>Honeycake ({save.items.honeycake ?? 0})</Btn>
            <Btn kind="s" onClick={() => act('pet', c)}>Pet</Btn><Btn kind="s" onClick={() => act('play', c)}>Play</Btn>
            <Btn kind="s" onClick={() => act('train', c)}>Train (20◈ → XP)</Btn>
            <Btn kind="s" onClick={() => act('revive', c)} disabled={!(c.fainted || c.hp <= 0) || !save.items.revivedew}>Revive Dew</Btn>
            {sel > 0 && <Btn kind="s" onClick={() => { act('lead', c); setSel(0); }}>Make Lead</Btn>}
            <Btn kind="s" onClick={() => { const n = prompt('Nickname?', c.nick); if (n) act('rename', c, n.slice(0, 14)); }}>Rename</Btn>
            {atHome && save.team.length > 1 && <Btn kind="s" onClick={() => { act('store', c); setSel(0); }}>Send to Storage</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItemsPanel({ save, act }: { save: SaveData; act: Act }) {
  const lead = save.team[0];
  return <div className="grid sm:grid-cols-2 gap-2">{Object.entries(save.items).filter(([, n]) => n > 0).map(([id, n]) => { const it = ITEMS[id]; return (
    <div key={id} className="bg-white/5 rounded-lg p-3 flex gap-3 items-start"><span className="text-3xl">{it.icon}</span><div className="flex-1"><div className="font-bold">{it.name} ×{n}</div><div className="text-xs text-white/60">{it.desc}</div>
      {lead && ['heal', 'energy', 'friend', 'revive'].includes(it.kind) && <div className="flex gap-1 mt-1 flex-wrap">{save.team.map(c => <button key={c.uid} onClick={() => act('use', c, id)} className="text-[10px] bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded">{c.nick}</button>)}</div>}</div></div>); })}
    <p className="text-xs text-white/50 col-span-full">Capture inventory: Lumen Pod ×{save.items.lumenpod ?? 0} · Grand Pod ×{save.items.grandpod ?? 0} (press V in battle to switch)</p></div>;
}

export function QuestPanel({ save }: { save: SaveData }) {
  return <div className="space-y-2">{QUESTS.map(q => { const s = save.quests[q.id]; const locked = q.requires && !save.quests[q.requires]?.done; const hidden = q.kind === 'Hidden' && !s.done && !save.flags.kidhint;
    return <div key={q.id} className={`rounded-lg p-3 ${s.done ? 'bg-emerald-500/15' : 'bg-white/5'} ${locked ? 'opacity-40' : ''}`}><div className="flex justify-between"><b>{hidden ? '??? Hidden Quest' : q.name}</b><span className="text-[10px] uppercase bg-white/10 px-2 rounded">{q.kind}</span></div>
      <p className="text-xs text-white/70">{locked ? 'Locked — complete previous main quest.' : hidden ? 'Someone in the village might know something...' : q.desc}</p>
      <div className="flex items-center gap-2 mt-1"><div className="flex-1"><Bar v={s.p} max={q.goal} color={s.done ? '#34d399' : '#fbbf24'} /></div><span className="text-xs">{s.done ? '✔ Complete' : `${s.p}/${q.goal}`}</span></div>
      <p className="text-[10px] text-white/50">Reward: {q.reward.money}◈ {Object.entries(q.reward.items ?? {}).map(([k, v]) => `· ${ITEMS[k].name}×${v}`).join(' ')} {q.reward.card ? '· Card' : ''}</p></div>; })}</div>;
}

export function MapPanel({ save, pos, travel, inBattle, target }: { save: SaveData; pos: [number, number]; travel: (x: number, z: number) => void; inBattle: boolean; target?: { name: string; x: number; z: number } | null }) {
  const X = (x: number) => (x + 45) * 4, Z = (z: number) => (230 - z) * 2.2;
  const minX = Math.min(pos[0], target?.x ?? pos[0]) - 18, maxX = Math.max(pos[0], target?.x ?? pos[0]) + 18;
  const minZ = Math.min(pos[1], target?.z ?? pos[1]) - 18, maxZ = Math.max(pos[1], target?.z ?? pos[1]) + 18;
  const routeX = (v: number) => 18 + (v - minX) / (maxX - minX) * 244;
  const routeY = (v: number) => 102 - (v - minZ) / (maxZ - minZ) * 84;
  return <div className="flex gap-4 flex-col md:flex-row">
    <div className="w-full max-w-[320px] shrink-0"><svg viewBox="0 0 440 600" className="w-full bg-emerald-900/60 rounded-xl border border-white/10">
      <rect x={X(-40)} y={Z(31)} width={320} height={Z(-38) - Z(31)} fill="#7cae58" opacity={save.discovered.includes('village') ? 0.8 : 0.15} />
      <rect x={X(-35)} y={Z(182)} width={280} height={Z(31) - Z(182)} fill="#5f9a48" opacity={save.discovered.includes('route') ? 0.8 : 0.15} />
      <rect x={X(-35)} y={Z(98)} width={280} height={13} fill="#3a8ad0" opacity={save.discovered.includes('route') ? 0.9 : 0.1} />
      <circle cx={X(-22)} cy={Z(130)} r={30} fill="#2a5a2a" opacity={save.discovered.includes('grove') ? 0.9 : 0.1} />
      <rect x={X(-25)} y={Z(225)} width={200} height={Z(184) - Z(225)} fill="#8a8a7a" opacity={save.discovered.includes('ruins') ? 0.9 : 0.1} />
      {LOCATIONS.map(L => { const d = save.discovered.includes(L.id); return <g key={L.id}><circle cx={X(L.x)} cy={Z(L.z)} r={7} fill={d ? '#fbbf24' : '#444'} stroke="#000" /><text x={X(L.x) + 10} y={Z(L.z) + 4} fill="#fff" fontSize={13} fontWeight={700}>{d ? L.name : '???'}</text></g>; })}
      <circle cx={X(PORTAL_POS.x)} cy={Z(PORTAL_POS.z)} r={8} fill={save.flags.portalAwake ? '#b19aff' : '#757089'} stroke="#fff" strokeWidth={1.5} />
      <text x={X(PORTAL_POS.x) - 10} y={Z(PORTAL_POS.z) - 12} textAnchor="end" fill="#fff" fontSize={12} fontWeight={700}>Village Portal</text>
      <circle cx={X(pos[0])} cy={Z(pos[1])} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
    </svg><div className="mt-2 text-center text-sm font-black rounded-full bg-slate-800 border border-sky-200/30 px-3 py-1">Your position: X {Math.round(pos[0])} · Z {Math.round(pos[1])}</div></div>
    <div className="space-y-2 flex-1">
      {target && <div className="bg-amber-400/10 border border-amber-300/40 rounded-xl p-3 space-y-1">
        <div className="text-sm font-black text-amber-200">📍 Guide pin: {target.name}</div>
        <div className="text-xs tabular-nums">X {Math.round(target.x)} · Z {Math.round(target.z)} · {Math.round(Math.hypot(target.x - pos[0], target.z - pos[1]))} m straight-line</div>
        <svg viewBox="0 0 280 120" className="w-full h-28 bg-slate-900/50 rounded-lg" aria-label="Route from your position to the guide pin">
          <line x1={routeX(pos[0])} y1={routeY(pos[1])} x2={routeX(target.x)} y2={routeY(target.z)} stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 4" />
          <circle cx={routeX(pos[0])} cy={routeY(pos[1])} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
          <circle cx={routeX(target.x)} cy={routeY(target.z)} r="6" fill="#fbbf24" stroke="#1c1917" strokeWidth="2" />
          <text x="11" y="14" fill="white" fontSize="9">N ↑</text>
          <text x={Math.min(242, routeX(target.x) + 8)} y={Math.max(12, routeY(target.z) - 6)} fill="#fcd34d" fontSize="9">Pin</text>
        </svg>
        <p className="text-[11px] text-white/60">You can find this place before exploring it. Fast travel still needs a visit.</p>
      </div>}
      <h3 className="font-bold">Fast Travel</h3><p className="text-xs text-white/60">Only discovered locations allow fast travel.</p>
      {LOCATIONS.map(L => <div key={L.id} className="flex items-center justify-between bg-white/5 rounded p-2"><span>{save.discovered.includes(L.id) ? L.name : '??? (undiscovered)'}</span><Btn disabled={!save.discovered.includes(L.id) || inBattle} onClick={() => travel(L.x, L.z - (L.id === 'ruins' ? 15 : 0))}>Travel</Btn></div>)}
      <h3 className="font-bold pt-2">Towns you found</h3>
      {(save.towns ?? []).length === 0 && <p className="text-xs text-white/60">Walk far away to find villages and cities!</p>}
      {(save.towns ?? []).map(t => <div key={t.id} className="flex items-center justify-between bg-white/5 rounded p-2"><span>{t.kind === 'city' ? '🏙️' : '🏘️'} {t.name} <span className="text-xs text-white/50">{Math.round(Math.hypot(t.x, t.z) / 10) * 10}m away</span></span><Btn disabled={inBattle} onClick={() => travel(t.x, t.z + 12)}>Travel</Btn></div>)}
      {save.camp && <div className="flex items-center justify-between bg-white/5 rounded p-2"><span>⛺ My Camp</span><Btn disabled={inBattle} onClick={() => travel(save.camp![0], save.camp![1] + 4)}>Travel</Btn></div>}</div>
  </div>;
}

export function CardsPanel({ save }: { save: SaveData }) {
  const cats = ['Creature', 'Trainer', 'Boss', 'Location', 'Special', 'Legendary'] as const;
  const rc = { Normal: '#9ca3af', Rare: '#60a5fa', 'Ultra Rare': '#c084fc', Legendary: '#fbbf24' };
  const own = CARDS.filter(c => save.cards[c.id]).length;
  return <div><p className="mb-2 text-sm">Album: {own}/{CARDS.length} cards ({Math.round(own / CARDS.length * 100)}%) · Total collection {collectionPct(save)}%</p>
    {cats.map(cat => <div key={cat} className="mb-3"><h3 className="font-bold text-amber-300 text-sm mb-1">{cat}</h3><div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {CARDS.filter(c => c.cat === cat).map(c => { const n = save.cards[c.id]; return <div key={c.id} title={n ? c.desc : '???'} className="rounded-lg p-2 text-center border-2 aspect-[3/4] flex flex-col justify-between" style={{ borderColor: n ? rc[c.rarity] : '#333', background: n ? `linear-gradient(160deg, ${rc[c.rarity]}33, #0008)` : '#111' }}>
        <div className="text-2xl">{n ? (c.cat === 'Creature' ? '' : c.icon) : '❔'}</div>{n && c.cat === 'Creature' && <div className="flex justify-center"><Portrait sp={c.id.slice(2)} size={36} /></div>}
        <div><div className="text-[11px] font-bold leading-tight">{n ? c.name : '???'}</div><div className="text-[9px]" style={{ color: rc[c.rarity] }}>{c.rarity}{n > 1 ? ` ×${n}` : ''}</div></div></div>; })}</div></div>)}</div>;
}

export function AchPanel({ save }: { save: SaveData }) {
  return <div className="grid sm:grid-cols-2 gap-2">{ACHIEVEMENTS.map(a => { const g = save.achievements.includes(a.id); return <div key={a.id} className={`p-3 rounded-lg ${g ? 'bg-amber-400/20' : 'bg-white/5 opacity-60'}`}><b>{g ? '🏆' : '🔒'} {a.name}</b><p className="text-xs text-white/70">{a.desc}</p></div>; })}</div>;
}

export function Dex({ save }: { save: SaveData | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const discovered = Object.values(SPECIES).filter(s => save && (save.seen.includes(s.id) || save.caught.includes(s.id)));
  const current = selected ? SPECIES[selected] : undefined;
  const owned = selected ? !!save?.caught.includes(selected) : false;
  const ability = (type: string) => ({ wind: 'Skybound · higher jumps', electric: 'Quickstep · faster travel', nature: 'Fortune · improved rare encounter odds', earth: 'Stoneguard · reduced night predator damage', metal: 'Ironhide · reduced night predator damage', shadow: 'Night Sight · improved visibility at night', water: 'Tidewalker · faster boat travel' }[type] || 'Bonded Spirit · balanced support');
  return <div>
    <div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="font-black text-lg">Discovered creatures</h3><p className="text-xs text-white/55">Only creatures you have encountered appear here. Select one to inspect its 3D model.</p></div><b className="text-cyan-200">{discovered.length}/{Object.keys(SPECIES).length}</b></div>
    {discovered.length ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{discovered.map((c, i) => <button key={c.id} onClick={() => setSelected(c.id)} className={`bg-white/5 hover:bg-white/10 rounded-xl p-2 flex items-center gap-2 text-left border ${selected === c.id ? 'border-cyan-300' : 'border-white/10'}`}><Portrait sp={c.id} size={54} /><span className="min-w-0"><span className="block text-[10px] text-white/40">DISCOVERY {String(i + 1).padStart(3, '0')}</span><b className="block text-sm truncate">{c.name}</b><span className="text-[10px] text-white/55">{save?.caught.includes(c.id) ? 'Caught' : 'Seen'} · {c.type}</span></span></button>)}</div> : <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-white/55">No creatures discovered yet. Explore Embervale to fill your collection.</div>}
    {current && <div className="mt-4 rounded-2xl border border-cyan-200/30 bg-slate-950/60 p-3 grid md:grid-cols-[240px_1fr] gap-3"><div className="rounded-xl bg-gradient-to-b from-sky-500/15 to-violet-500/15 flex items-center justify-center"><Preview sp={current.id} size={220} h={220} /></div><div><div className="flex justify-between gap-2"><div><h3 className="text-2xl font-black">{current.name}</h3><p className="text-xs text-cyan-200">{current.type} type · {owned ? 'Captured' : 'Encountered'}</p></div><button onClick={() => setSelected(null)} className="h-9 w-9 rounded-lg bg-white/10" aria-label="Close creature details">×</button></div><p className="text-sm text-white/70 mt-2">{current.lore}</p><div className="mt-3 rounded-xl bg-white/5 p-3"><b className="text-amber-200">Trainer passive</b><p className="text-sm mt-1">{ability(current.type)}</p><div className="grid grid-cols-2 gap-2 mt-3 text-xs">{Object.entries(current.base).filter(([k]) => ['hp','atk','def','spd','sp'].includes(k)).map(([k,v]) => <div key={k} className="flex justify-between border-b border-white/10 pb-1"><span className="uppercase text-white/50">{k}</span><b>{v}</b></div>)}</div></div></div></div>}
  </div>;
}

export function ShopPanel({ save, act }: { save: SaveData; act: Act }) {
  const stock = ['lumenpod', 'grandpod', 'sunberry', 'mintleaf', 'honeycake', 'revivedew', 'water', 'petfood', 'pethat', 'petcap', 'petbow', 'petscarf', 'petflower', 'petglasses'];
  return <div><p className="mb-2">Wallet: <b className="text-amber-300">{save.money} ◈</b> (Embers)</p><div className="grid sm:grid-cols-2 gap-2">{stock.map(id => { const it = ITEMS[id]; return <div key={id} className="bg-white/5 rounded-lg p-2 flex gap-2 items-center"><span className="text-2xl">{it.icon}</span><div className="flex-1"><b className="text-sm">{it.name}</b> <span className="text-xs text-white/50">(own {save.items[id] ?? 0})</span><p className="text-[10px] text-white/60">{it.desc}</p></div>
    <div className="flex flex-col gap-1"><Btn disabled={save.money < it.price} onClick={() => act('buy', undefined, id)}>Buy {it.price}🪙</Btn><Btn kind="s" disabled={!save.items[id]} onClick={() => act('sell', undefined, id)}>Sell {Math.floor(it.price / 2)}🪙</Btn></div></div>; })}</div>
    <h3 className="font-bold mt-3 mb-1">Sell your stuff</h3><div className="grid sm:grid-cols-2 gap-2">{Object.entries(save.items).filter(([k, n]) => n > 0 && !stock.includes(k) && ITEMS[k].price > 0).map(([k, n]) => <div key={k} className="bg-white/5 rounded-lg p-2 flex items-center gap-2"><span className="text-2xl">{ITEMS[k].icon}</span><span className="flex-1 text-sm font-bold">{ITEMS[k].name} ×{n}</span><Btn kind="s" onClick={() => act('sell', undefined, k)}>Sell {Math.floor(ITEMS[k].price / 2)}🪙</Btn></div>)}</div></div>;
}

const DECOR = [{ id: 'rug', name: 'Cozy Rug', price: 150, icon: '🟫' }, { id: 'fern', name: 'Fern Pot', price: 100, icon: '🪴' }, { id: 'lantern', name: 'Star Lantern', price: 250, icon: '🏮' }, { id: 'bed', name: 'Creature Bed', price: 300, icon: '🛏️' }, { id: 'shelf', name: 'Card Display Shelf', price: 200, icon: '🗄️' }];
export function HomePanel({ save, act }: { save: SaveData; act: Act }) {
  const [tab, setTab] = useState<'room' | 'storage' | 'decor' | 'team'>('room');
  const best = CARDS.filter(c => save.cards[c.id]).sort((a, b) => ['Normal', 'Rare', 'Ultra Rare', 'Legendary'].indexOf(b.rarity) - ['Normal', 'Rare', 'Ultra Rare', 'Legendary'].indexOf(a.rarity)).slice(0, save.home.decor.includes('shelf') ? 6 : 3);
  return <div>
    <div className="flex gap-1 mb-3">{(['room', 'team', 'storage', 'decor'] as const).map(t => <Btn key={t} kind={tab === t ? 'p' : 's'} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Btn>)}<span className="ml-auto text-sm">Home Lv {save.home.level}</span></div>
    {tab === 'room' && <div>
      <div className="relative h-56 rounded-xl overflow-hidden border border-amber-900/50" style={{ background: 'linear-gradient(#e8c99a 0 55%, #9a6a3a 55%)' }}>
        <div className="absolute left-4 top-4 w-20 h-14 bg-sky-300 border-4 border-amber-900 rounded" />
        {save.home.decor.map((d, i) => <span key={d} className="absolute text-4xl" style={{ left: 120 + i * 70, top: d === 'lantern' ? 10 : 110 }}>{DECOR.find(x => x.id === d)?.icon}</span>)}
        {best.length > 0 && <div className="absolute right-3 top-3 flex gap-1 bg-amber-900/70 p-1 rounded">{best.map(c => <div key={c.id} className="w-7 h-10 bg-white/80 rounded text-[8px] text-black flex items-center justify-center text-center" title={c.name}>{c.icon}</div>)}</div>}
        {save.team.map((c, i) => <div key={c.uid} className="absolute roam" style={{ bottom: 12 + (i % 3) * 14, animationDelay: `${i * -1.7}s`, animationDuration: `${7 + i}s` }} onClick={() => act('pet', c)} title={`Pet ${c.nick}`}><Portrait sp={c.sp} size={34} /></div>)}
      </div>
      <p className="text-xs text-white/60 mt-1">Your creatures roam freely — click one to pet it. (UNFINISHED: walkable 3D interior.)</p>
      <div className="flex gap-2 mt-3 flex-wrap"><Btn onClick={() => act('rest')}>🛌 Rest (full heal{save.home.decor.includes('bed') ? ' + friendship' : ''} & autosave)</Btn><Btn kind="s" onClick={() => act('petall')}>Cuddle everyone</Btn></div>
    </div>}
    {tab === 'team' && <TeamPanel save={save} act={act} atHome />}
    {tab === 'storage' && <div className="space-y-1">{save.storage.length === 0 && <p className="text-white/60 text-sm">Storage is empty. Creatures caught with a full team (8) appear here.</p>}
      {save.storage.map(c => <div key={c.uid} className="flex items-center gap-2 bg-white/5 rounded p-2"><Portrait sp={c.sp} size={30} /><span className="flex-1">{c.nick} Lv {c.lvl} · {c.pers}</span><Btn disabled={save.team.length >= 8} onClick={() => act('withdraw', c)}>Add to team</Btn></div>)}</div>}
    {tab === 'decor' && <div className="grid sm:grid-cols-2 gap-2">{DECOR.map(d => { const own = save.home.decor.includes(d.id); return <div key={d.id} className="bg-white/5 rounded p-2 flex items-center gap-2"><span className="text-3xl">{d.icon}</span><span className="flex-1">{d.name}</span><Btn disabled={own || save.money < d.price} onClick={() => act('decor', undefined, d.id + ':' + d.price)}>{own ? 'Placed' : `${d.price}◈`}</Btn></div>; })}<p className="text-xs text-white/50 col-span-full">Each decoration raises Home level. Creature Bed boosts rest friendship; Shelf displays more cards.</p></div>}
  </div>;
}

export function SettingsPanel({ s, set, save, setDiff }: { s: Settings; set: (s: Settings) => void; save?: SaveData; setDiff?: (d: SaveData['difficulty']) => void }) {
  const [rebind, setRebind] = useState<string | null>(null);
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="flex items-center justify-between gap-3 py-1 text-sm"><span>{label}</span>{children}</label>;
  const sl = (k: keyof Settings, min: number, max: number, step: number) => <input type="range" min={min} max={max} step={step} value={s[k] as number} onChange={e => set({ ...s, [k]: +e.target.value })} className="w-40 accent-amber-400" />;
  const ck = (k: keyof Settings) => <input type="checkbox" checked={s[k] as boolean} onChange={e => set({ ...s, [k]: e.target.checked })} className="w-4 h-4 accent-amber-400" />;
  return <div className="grid md:grid-cols-2 gap-6" onKeyDown={e => { if (rebind) { e.preventDefault(); e.stopPropagation(); const k = e.key === ' ' ? ' ' : e.key.toLowerCase(); set({ ...s, keys: { ...s.keys, [rebind]: k } }); setRebind(null); } }} tabIndex={0}>
    <div><h3 className="font-bold text-amber-300">Audio</h3><Row label="Master">{sl('master', 0, 1, 0.05)}</Row><Row label="Music">{sl('music', 0, 1, 0.05)}</Row><Row label="SFX">{sl('sfx', 0, 1, 0.05)}</Row>
      <h3 className="font-bold text-amber-300 mt-3">Accessibility & Gameplay</h3><Row label="Subtitles / battle text">{ck('subtitles')}</Row><Row label={`Text size ${s.textSize.toFixed(1)}×`}>{sl('textSize', 0.8, 1.4, 0.1)}</Row><Row label={`Camera sensitivity ${s.sens.toFixed(1)}`}>{sl('sens', 0.3, 2.5, 0.1)}</Row><Row label="Reduce motion (no shake)">{ck('reduceMotion')}</Row>
      {save && setDiff && <Row label="Difficulty"><select value={save.difficulty} onChange={e => setDiff(e.target.value as SaveData['difficulty'])} className="bg-stone-800 rounded px-2 py-1">{['Easy', 'Normal', 'Hard'].map(d => <option key={d}>{d}</option>)}</select></Row>}
      <h3 className="font-bold text-amber-300 mt-3">Graphics</h3><Row label="Fullscreen"><Btn kind="s" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})}>Toggle</Btn></Row>
      <Row label={`Resolution scale ${Math.round(s.resScale * 100)}%`}>{sl('resScale', 0.5, 1, 0.05)}</Row><Row label="Shadows">{ck('shadows')}</Row><Row label={`View distance ${s.viewDist}`}>{sl('viewDist', 60, 250, 10)}</Row>
      <Row label="Effects quality"><select value={s.effects} onChange={e => set({ ...s, effects: e.target.value as Settings['effects'] })} className="bg-stone-800 rounded px-2 py-1"><option>High</option><option>Low</option></select></Row>
      <Row label="Anti-aliasing (applies on next load)">{ck('aa')}</Row><Row label="FPS cap (0 = VSync)"><select value={s.fpsCap} onChange={e => set({ ...s, fpsCap: +e.target.value })} className="bg-stone-800 rounded px-2 py-1">{[0, 30, 60, 120].map(f => <option key={f} value={f}>{f || 'VSync'}</option>)}</select></Row><Row label="Show FPS">{ck('showFps')}</Row>
    </div>
    <div><h3 className="font-bold text-amber-300">Controls (click to remap)</h3>
      {Object.keys(DEFAULT_KEYS).map(a => <Row key={a} label={a}><button onClick={() => setRebind(a)} className={`px-2 py-0.5 rounded min-w-[70px] ${rebind === a ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>{rebind === a ? 'press key…' : s.keys[a] === ' ' ? 'Space' : s.keys[a].toUpperCase()}</button></Row>)}
      <Btn kind="s" onClick={() => set({ ...s, keys: { ...DEFAULT_KEYS } })}>Reset keys</Btn>
      <p className="text-xs text-white/50 mt-2">Move WASD/arrows · Camera: drag mouse, wheel zoom · Sprint Shift · LMB light / RMB heavy · V switch pod · P quick save.<br />Controller: L-stick move, R-stick camera, A light/interact, X heavy, B dodge, Y capture, LB/RB/RT abilities, LT block, R3 ultimate, Back switch, Start menu.</p></div>
  </div>;
}

export function SlotList({ mode, onPick, current }: { mode: 'save' | 'load'; onPick: (slot: number) => void; current?: SaveData }) {
  return <div className="space-y-2">{SLOTS.map(slot => { const d = readSave(slot); if (mode === 'save' && slot === 0) return null;
    return <div key={slot} className="flex items-center gap-3 bg-white/5 rounded-lg p-3"><div className="flex-1"><b>{slot === 0 ? 'Autosave' : `Slot ${slot}`}</b>
      {d ? <p className="text-xs text-white/60">{d.name} · {d.team[0] ? `${SPECIES[d.team[0].sp].name} Lv ${d.team[0].lvl}` : 'no partner'} · {d.money}◈ · {Math.floor(d.playtime / 60)}m · {collectionPct(d)}% · {new Date(d.savedAt).toLocaleString()}{d.flags.postgame ? ' · ★ Story clear' : ''}</p> : <p className="text-xs text-white/40">Empty</p>}</div>
      <Btn disabled={mode === 'load' && !d} onClick={() => onPick(slot)}>{mode === 'save' ? (d ? 'Overwrite' : 'Save') : 'Load'}</Btn></div>; })}
    {mode === 'save' && current && <p className="text-xs text-white/50">Overwriting a slot with different/more progress asks for confirmation.</p>}</div>;
}
