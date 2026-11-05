import { useEffect, useRef, useState } from 'react';
import { ITEMS, RECIPES, FOOD_MENU } from '../game/data';
import { PLANES } from '../game/places';
import type { SaveData, Airport } from '../game/state';
import { Btn } from './Panels';

// ---------- Cooking ----------
export function CookPanel({ save, onCook }: { save: SaveData; onCook: (id: string) => void }) {
  return <div className="grid sm:grid-cols-2 gap-3">{RECIPES.map(r => { const it = ITEMS[r.id]; const ok = Object.entries(r.needs).every(([k, n]) => (save.items[k] || 0) >= n);
    return <div key={r.id} className={`rounded-2xl p-3 flex gap-3 items-center border-2 ${ok ? 'bg-emerald-500/15 border-emerald-400/50' : 'bg-white/5 border-transparent'}`}>
      <div className="text-5xl">{it.icon}</div>
      <div className="flex-1"><div className="font-black">{it.name}</div><div className="text-xs text-white/70">{it.desc}</div>
        <div className="flex flex-wrap gap-1 mt-1">{Object.entries(r.needs).map(([k, n]) => { const have = save.items[k] || 0; return <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-bold ${have >= n ? 'bg-emerald-600' : 'bg-rose-700'}`}>{ITEMS[k].icon} {have}/{n}</span>; })}</div></div>
      <Btn disabled={!ok} onClick={() => onCook(r.id)}>🍳 Cook</Btn></div>; })}
    <p className="text-xs text-white/60 col-span-full">Get water at wells, fish at lakes, fruit from trees, veggies and eggs at farms, wood from stumps.</p></div>;
}

// ---------- School lesson (quiz) ----------
const QUIZ: [string, string[], number][] = [
  ['What is 3 + 4?', ['6', '7', '8'], 1], ['What is 5 × 2?', ['10', '12', '7'], 0], ['What is 9 − 3?', ['5', '6', '7'], 1], ['What is 12 ÷ 4?', ['3', '4', '6'], 0],
  ['Which type beats Nature pets?', ['Water', 'Fire', 'Earth'], 1], ['Which type beats Fire pets?', ['Water', 'Wind', 'Nature'], 0], ['Which type beats Water pets?', ['Fire', 'Metal', 'Electric'], 2],
  ['How many legs does a spider have?', ['6', '8', '10'], 1], ['What color do you get mixing blue + yellow?', ['Green', 'Purple', 'Orange'], 0], ['Which is the biggest?', ['Ocean', 'Lake', 'Pond'], 0],
  ['How many days are in a week?', ['5', '7', '10'], 1], ['What do bees make?', ['Milk', 'Honey', 'Bread'], 1], ['Which planet do we live on?', ['Mars', 'Earth', 'Moon'], 1],
  ['What should you give a tired pet?', ['Rest and food', 'More fights', 'Nothing'], 0], ['What is 7 + 8?', ['14', '15', '16'], 1], ['Which animal can fly?', ['Fish', 'Bird', 'Cow'], 1],
];
export function StudyPanel({ onDone }: { onDone: (score: number) => void }) {
  const [qs] = useState(() => [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5)); const [i, setI] = useState(0); const [score, setScore] = useState(0); const [pick, setPick] = useState<number | null>(null);
  if (i >= qs.length) return <div className="text-center space-y-3 py-4"><div className="text-6xl">{score >= 4 ? '🏅' : score >= 2 ? '⭐' : '📚'}</div><div className="text-2xl font-black">You got {score} / {qs.length}!</div><p className="text-white/70">{score >= 4 ? 'Excellent! The teacher is proud of you.' : 'Good try! Practice makes perfect.'}</p><p className="text-amber-300 font-bold">+{score * 15} coins · +{score * 25} XP for your team</p><Btn onClick={() => onDone(score)}>Finish class</Btn></div>;
  const [q, opts, ans] = qs[i];
  return <div className="space-y-3">
    <div className="rounded-2xl p-4 text-center border-4 border-amber-800" style={{ background: '#2a5a3a' }}><div className="text-xs text-white/70">Question {i + 1} of {qs.length}</div><div className="text-2xl font-black text-white font-serif">{q}</div></div>
    <div className="grid grid-cols-3 gap-2">{opts.map((o, k) => <button key={o} disabled={pick !== null} onClick={() => { setPick(k); if (k === ans) setScore(s => s + 1); setTimeout(() => { setPick(null); setI(n => n + 1); }, 900); }}
      className={`py-4 rounded-2xl text-xl font-black border-4 transition ${pick === null ? 'bg-white/10 border-white/20 hover:bg-white/20' : k === ans ? 'bg-emerald-500 border-white' : pick === k ? 'bg-rose-600 border-white' : 'bg-white/5 border-transparent opacity-50'}`}>{o}</button>)}</div>
    <div className="text-center text-sm">Score: <b className="text-amber-300">{score}</b></div>
  </div>;
}

// ---------- Restaurant menu ----------
export function FoodMenu({ save, onOrder }: { save: SaveData; onOrder: (id: string, eat: boolean) => void }) {
  return <div className="rounded-3xl p-4 border-4 border-amber-800" style={{ background: 'linear-gradient(#fbf1da,#f3e3c0)' }}>
    <div className="text-center text-amber-950 mb-3"><div className="font-serif text-3xl font-black">🏮 MENU 🏮</div><div className="text-sm">Wallet: <b>{save.money} 🪙</b></div></div>
    <div className="grid md:grid-cols-2 gap-4">{FOOD_MENU.map(c => <div key={c.cat}><h3 className="font-black text-amber-900 border-b-2 border-amber-800/30 mb-1">{c.cat}</h3>
      {c.items.map(id => { const it = ITEMS[id]; return <div key={id} className="flex items-center gap-2 py-1.5 text-amber-950">
        <span className="text-3xl">{it.icon}</span><div className="flex-1"><div className="font-bold">{it.name} <span className="text-xs text-amber-700">(own {save.items[id] ?? 0})</span></div><div className="text-[11px] text-amber-800">{it.desc}</div></div>
        <span className="font-black w-14 text-right">{it.price}🪙</span>
        <button disabled={save.money < it.price} onClick={() => onOrder(id, true)} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs font-black disabled:opacity-40">Eat</button>
        <button disabled={save.money < it.price} onClick={() => onOrder(id, false)} className="px-2 py-1 rounded-lg bg-amber-700 text-white text-xs font-black disabled:opacity-40">Take</button>
      </div>; })}</div>)}</div>
    <p className="text-center text-xs text-amber-800 mt-2">"Eat" heals your whole team now. "Take" puts it in your bag.</p></div>;
}

// ---------- Talk with NPCs (type your own words) ----------
const REPLIES: [RegExp, string[]][] = [
  [/\b(hi|hello|hey|namaste|yo)\b/, ['Hello there! Nice to meet you!', 'Hi hi! What a lovely day!', 'Hey! Your pet looks so happy.']],
  [/\b(name|who are you)\b/, ['My name is {name}. I live here!', 'Everyone calls me {name}.']],
  [/\b(how are you|how r u|you ok)\b/, ['I am great, thank you! And you?', 'A bit tired, but happy!']],
  [/\b(fine|good|great|happy|ok)\b/, ['That makes me happy too!', 'Wonderful!']],
  [/\b(sad|tired|bad|lost)\b/, ['Oh no... Rest at a camp or your home. It helps!', 'Cheer up! Your pet believes in you.']],
  [/\b(pet|pets|creature|monster)\b/, ['Wild pets get stronger far away from Embervale.', 'Hurt a wild pet first, then throw a catch ball!', 'Feed and pet your partner. Love makes them strong!']],
  [/\b(food|hungry|eat|cook)\b/, ['The FOOD shop has yummy momos and ramen!', 'You can cook at home or at a campfire.', 'Try fish curry: fish, water and veggies!']],
  [/\b(festival|party|fireworks)\b/, ['Villages hold festivals on lucky days. There are fireworks at night!']],
  [/\b(plane|fly|airport)\b/, ['There is an airport west of Embervale. Commander Hale can let you fly!']],
  [/\b(fish|fishing)\b/, ['Walk to any water and press E to fish. Golden fish are very rare!']],
  [/\b(money|coin|coins|job|work)\b/, ['Ask people for work! They pay coins for help.', 'Sell wood and fish at the shop.']],
  [/\b(bye|goodbye|see you|tata)\b/, ['Bye bye! Come back soon!', 'Take care on your journey!']],
  [/\b(thank|thanks|thx)\b/, ['You are welcome!', 'Anytime, friend!']],
  [/\b(ghost|haunted|scary)\b/, ['Haunted places are dark and full of ghost pets... brr!']],
  [/\b(cave|bat|mountain)\b/, ['Caves in the mountains glow with crystals. Bats live inside!']],
  [/\?$/, ['Hmm, good question! I am not sure.', 'Maybe ask the Elder in Embervale?']],
];
export function npcReply(text: string, name: string) {
  const t = text.toLowerCase().trim();
  for (const [re, opts] of REPLIES) if (re.test(t)) return opts[Math.floor(Math.random() * opts.length)].replace('{name}', name);
  return ['Oh really? Tell me more!', 'Haha, you are funny!', 'Interesting...', 'I see! That sounds fun.'][Math.floor(Math.random() * 4)];
}
export function ChatPanel({ name, first, onClose }: { name: string; first: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ me: boolean; t: string }[]>([{ me: false, t: first }]); const [txt, setTxt] = useState(''); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, 99999); }, [msgs]);
  const send = (s: string) => { const v = s.trim(); if (!v) return; setMsgs(m => [...m, { me: true, t: v }]); setTxt(''); setTimeout(() => setMsgs(m => [...m, { me: false, t: npcReply(v, name) }]), 450); };
  return <div className="flex flex-col h-[60vh] max-h-[520px]">
    <div ref={box} className="flex-1 overflow-auto space-y-2 p-2 bg-black/20 rounded-2xl">{msgs.map((m, i) => <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-semibold ${m.me ? 'bg-amber-400 text-stone-900 rounded-br-sm' : 'bg-white text-stone-800 rounded-bl-sm'}`}>{!m.me && <div className="text-[10px] text-amber-600 font-black">{name}</div>}{m.t}</div></div>)}</div>
    <div className="flex gap-1 flex-wrap my-2">{['Hello!', 'How are you?', 'Tell me about pets', 'I am hungry', 'Any festival?', 'Bye!'].map(q => <button key={q} onClick={() => send(q)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full">{q}</button>)}</div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(txt); }} onKeyDown={e => e.stopPropagation()}>
      <input autoFocus value={txt} onChange={e => setTxt(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white/15 rounded-full px-4 py-2 outline-none" maxLength={80} />
      <Btn>Send</Btn><Btn kind="s" onClick={onClose}>Close</Btn>
    </form>
  </div>;
}

// ---------- Airport: pick a plane and where to go ----------
const HOME_AIRPORT: Airport = { id: 'Embervale Airport', name: 'Embervale Airport', x: -128, z: -6 };
export function PlanePanel({ save, onFly }: { save: SaveData; onFly: (plane: number, dest?: Airport) => void }) {
  const [sel, setSel] = useState(0); const list = [HOME_AIRPORT, ...(save.airports ?? []).filter(a => a.name !== HOME_AIRPORT.name)];
  return <div className="space-y-3">
    <p className="text-sm text-white/80">🎖️ Commander Hale: "Pick any plane, pilot! Then fly free or choose an airport."</p>
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{PLANES.map((p, i) => <button key={p.name} onClick={() => setSel(i)} className={`rounded-2xl p-3 text-left border-2 ${sel === i ? 'border-amber-300 bg-amber-400/20' : 'border-transparent bg-white/5'}`}>
      <div className="h-10 rounded-xl mb-1 flex items-center justify-center text-3xl" style={{ background: `linear-gradient(90deg, ${p.color}, ${p.trim})` }}>✈️</div>
      <div className="font-black text-sm">{p.name}</div><div className="text-[10px] text-white/60">{p.desc}</div>
      <div className="mt-1 h-1.5 bg-black/40 rounded"><div className="h-full bg-sky-400 rounded" style={{ width: `${(p.speed / 46) * 100}%` }} /></div><div className="text-[10px]">Speed</div></button>)}</div>
    <div className="flex flex-wrap gap-2"><Btn onClick={() => onFly(sel)}>🕊️ Fly free</Btn></div>
    <h3 className="font-black">Fly to an airport</h3>
    <div className="grid sm:grid-cols-2 gap-2">{list.map(a => <div key={a.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-2"><span className="flex-1 text-sm font-bold">🛫 {a.name}</span><span className="text-xs text-white/50">{Math.round(Math.hypot(a.x, a.z))}m</span><Btn kind="s" onClick={() => onFly(sel, a)}>Go</Btn></div>)}</div>
    <p className="text-xs text-white/50">More airports are hidden far away (about 1500m+). Find them to unlock new routes!</p>
    <div className="text-xs bg-black/30 rounded-xl p-2"><b>Plane controls:</b> Joystick / A-D = turn · W or ⬆ = go up · S or ⬇ = go down · 🛬 = land</div>
  </div>;
}
