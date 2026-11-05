import { useState } from 'react';
import { SPECIES, ABILITIES, ITEMS } from '../game/data';
import { PET_GEAR } from '../game/models';
import { SaveData, CreatureInst, stats, xpNext } from '../game/state';
import { Preview } from './Preview';
import { Btn, TypeTag, Bar, Portrait } from './Panels';

type Act = (k: string, c?: CreatureInst, extra?: string) => void;

export function TeamPanel({ save, act }: { save: SaveData; act: Act }) {
  const [sel, setSel] = useState(0); const c = save.team[sel] ?? save.team[0];
  if (!c) return <p className="text-white/70">No pets yet. Talk to the Elder!</p>;
  const s = SPECIES[c.sp]; const st = stats(c); const hearts = Math.round(c.friend / 20);
  const Stat = ({ label, v, max, col }: { label: string; v: number; max: number; col: string }) => <div><div className="flex justify-between text-xs"><span>{label}</span><b>{v}</b></div><Bar v={v} max={max} color={col} /></div>;
  return (
    <div className="flex gap-4 flex-col md:flex-row">
      <div className="flex md:flex-col gap-2 md:w-48 overflow-auto">
        {save.team.map((t, i) => (
          <button key={t.uid} onClick={() => setSel(i)} className={`flex items-center gap-2 p-2 rounded-2xl text-left shrink-0 transition ${i === sel ? 'bg-amber-400/40 ring-2 ring-amber-300' : 'bg-white/10 hover:bg-white/20'}`}>
            <Portrait sp={t.sp} size={38} /><div className="min-w-0"><div className="text-sm font-bold truncate">{t.nick}</div><div className="text-[11px] text-white/70">Lv {t.lvl}{t.fainted || t.hp <= 0 ? ' 😵' : ''}</div></div>
          </button>))}
      </div>
      <div className="flex-1 grid md:grid-cols-[230px_1fr] gap-4 items-start">
        <div className="flex flex-col items-center bg-gradient-to-b from-sky-300/30 to-emerald-300/20 rounded-3xl p-2"><Preview sp={c.sp} acc={c.acc} size={220} /><div className="text-2xl">{'❤️'.repeat(hearts)}{'🤍'.repeat(5 - hearts)}</div></div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap"><h3 className="text-2xl font-black">{c.nick}</h3><TypeTag t={s.type} /><span className="text-white/70">Lv {c.lvl}</span></div>
          <div><div className="flex justify-between text-xs"><span>Health</span><b>{c.hp}/{st.hp}</b></div><Bar v={c.hp} max={st.hp} color="#4ade80" h="h-3" /></div>
          <div><div className="flex justify-between text-xs"><span>Next level</span><b>{c.xp}/{xpNext(c.lvl)}</b></div><Bar v={c.xp} max={xpNext(c.lvl)} color="#60a5fa" /></div>
          <div className="grid grid-cols-2 gap-2"><Stat label="Power" v={st.atk} max={250} col="#f97316" /><Stat label="Guard" v={st.def} max={250} col="#a3a3a3" /><Stat label="Speed" v={st.spd} max={250} col="#22d3ee" /><Stat label="Magic" v={st.sp} max={250} col="#c084fc" /></div>
          <div className="flex gap-1 flex-wrap">{[...s.abilities, s.ult].map((a, i) => <span key={a + i} className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: ABILITIES[a].color + '55', border: `1px solid ${ABILITIES[a].color}` }}>{i === s.abilities.length ? '⭐ ' : ''}{ABILITIES[a].name}</span>)}</div>
          {s.evolvesTo && <p className="text-xs text-amber-200">✨ Grows into {SPECIES[s.evolvesTo].name} at Lv {s.evoLevel}{s.evoCond === 'night' ? ' (at night)' : ''}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Btn onClick={() => act('feed', c, 'sunberry')} disabled={!save.items.sunberry}>🍊 Feed ({save.items.sunberry ?? 0})</Btn>
            <Btn onClick={() => act('feed', c, 'honeycake')} disabled={!save.items.honeycake}>🍯 Treat ({save.items.honeycake ?? 0})</Btn>
            <Btn kind="s" onClick={() => act('pet', c)}>💕 Pet</Btn><Btn kind="s" onClick={() => act('play', c)}>🎾 Play</Btn>
            <Btn kind="s" onClick={() => act('train', c)}>💪 Train (20🪙)</Btn>
            {(c.fainted || c.hp <= 0) && <Btn kind="s" onClick={() => act('revive', c)} disabled={!save.items.revivedew}>💧 Wake up</Btn>}
            {sel > 0 && <Btn kind="s" onClick={() => { act('lead', c); setSel(0); }}>⭐ Lead</Btn>}
            <Btn kind="s" onClick={() => { const n = prompt('New name?', c.nick); if (n) act('rename', c, n.slice(0, 14)); }}>✏️ Name</Btn>
          </div>
          <div className="flex flex-wrap gap-1 items-center"><span className="text-xs font-bold mr-1">👒 Outfit:</span>
            <button onClick={() => act('dress', c, '')} className={`text-xs px-2 py-1 rounded-full ${!c.acc ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>None</button>
            {Object.keys(PET_GEAR).filter(g => (save.items[g] || 0) > 0).map(g => <button key={g} onClick={() => act('dress', c, g)} className={`text-xs px-2 py-1 rounded-full ${c.acc === g ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>{ITEMS[g].icon} {PET_GEAR[g]}</button>)}
            {!Object.keys(PET_GEAR).some(g => (save.items[g] || 0) > 0) && <span className="text-xs text-white/50">Buy hats, bows and more at any shop!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

const DECOR = [{ id: 'rug', name: 'Blue Rug', price: 150, icon: '🟦' }, { id: 'fern', name: 'Big Plant', price: 100, icon: '🪴' }, { id: 'lantern', name: 'Star Lamp', price: 250, icon: '⭐' }, { id: 'bed', name: 'Pet Bed', price: 300, icon: '🛏️' }, { id: 'shelf', name: 'Card Shelf', price: 200, icon: '🃏' }];
export function HomePanel({ save, act }: { save: SaveData; act: Act }) {
  const [tab, setTab] = useState<'storage' | 'decor'>('storage');
  return <div>
    <div className="flex gap-2 mb-3">{(['storage', 'decor'] as const).map(t => <Btn key={t} kind={tab === t ? 'p' : 's'} onClick={() => setTab(t)}>{t === 'storage' ? '📦 Pet Box' : '🛋️ Decorate'}</Btn>)}</div>
    {tab === 'storage' && <div className="space-y-2">
      {save.storage.length === 0 && <p className="text-white/70 text-sm">The box is empty.</p>}
      {save.storage.map(c => <div key={c.uid} className="flex items-center gap-2 bg-white/10 rounded-2xl p-2"><Portrait sp={c.sp} size={34} /><span className="flex-1 font-bold">{c.nick} <span className="text-white/60 font-normal">Lv {c.lvl}</span></span><Btn disabled={save.team.length >= 8} onClick={() => act('withdraw', c)}>Take</Btn></div>)}
      <h4 className="font-bold pt-2">Your team</h4>
      {save.team.map(c => <div key={c.uid} className="flex items-center gap-2 bg-white/5 rounded-2xl p-2"><Portrait sp={c.sp} size={30} /><span className="flex-1">{c.nick} Lv {c.lvl}</span><Btn kind="s" disabled={save.team.length <= 1} onClick={() => act('store', c)}>Put in box</Btn></div>)}
    </div>}
    {tab === 'decor' && <div className="grid sm:grid-cols-2 gap-2">{DECOR.map(d => { const own = save.home.decor.includes(d.id); return <div key={d.id} className="bg-white/10 rounded-2xl p-3 flex items-center gap-3"><span className="text-3xl">{d.icon}</span><span className="flex-1 font-bold">{d.name}</span><Btn disabled={own || save.money < d.price} onClick={() => act('decor', undefined, d.id + ':' + d.price)}>{own ? '✔ Placed' : `${d.price} 🪙`}</Btn></div>; })}<p className="text-xs text-white/60 col-span-full">Things you buy appear in your 3D room.</p></div>}
  </div>;
}
