import { useEffect, useState } from 'react';
import { WEAPONS, type WeaponKind } from '../game/dimension';

const kinds: WeaponKind[] = ['blade', 'staff', 'bow'];

function PortalMark({ awake }: { awake: boolean }) {
  return <div className={`relative w-40 h-40 mx-auto rounded-full border-[12px] border-[#9c90b5] shadow-[inset_0_0_0_4px_#e0d4fc,0_0_30px_#9a71d155] bg-[#282338] overflow-hidden ${awake ? 'portal-open' : ''}`}>
    <div className="absolute inset-3 rounded-full border border-[#b6a5d5]/50" />
    {awake ? <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle,#bbb7f5,#5a4184_64%,#2e2946)] portal-depth" /> : <div className="absolute inset-0 flex items-center justify-center font-black text-4xl text-white/45">10</div>}
    <div className="absolute inset-x-10 inset-y-0 border-x-2 border-white/20 rotate-45 pointer-events-none" />
  </div>;
}

export function PortalPanel({ awakened, diamonds, onAwaken, onEnter, onClose }: {
  awakened: boolean; diamonds: number; onAwaken: () => boolean; onEnter: () => void; onClose: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(awakened);
  useEffect(() => { if (awakened && !opening) setReady(true); }, [awakened, opening]);
  useEffect(() => { if (!opening) return; const timer = window.setTimeout(() => { setOpening(false); setReady(true); }, 1200); return () => window.clearTimeout(timer); }, [opening]);
  return <div className="space-y-4 max-w-xl mx-auto text-center py-3">
    <p className="text-xs tracking-[.3em] uppercase font-black text-violet-200/70">The only gate</p>
    <h2 className="text-3xl sm:text-4xl font-black">The Fourth Dimension</h2>
    <PortalMark awake={ready || opening} />
    {!ready ? <>
      <p className="text-sm text-white/75 max-w-md mx-auto">The old arch is sealed. Search rare crystal mines, dig with the pickaxe and gather ten diamonds. Only you can cross this gate. Your pets stay safely outside.</p>
      <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 inline-flex gap-2 items-center font-bold">Diamonds: <span className={diamonds >= 10 ? 'text-emerald-300' : 'text-amber-200'}>{diamonds} / 10</span></div>
      <div><button disabled={diamonds < 10 || opening} onClick={() => { if (onAwaken()) setOpening(true); }} className="bg-violet-300 text-stone-950 rounded-full px-6 py-2.5 font-black disabled:opacity-40">{opening ? 'Awakening...' : 'Awaken with 10 diamonds'}</button></div>
      <p className="text-xs text-white/45">Each dig has a 10% chance of a diamond. Mine veins refresh the next game day.</p>
    </> : <>
      <p className="text-sm text-white/75">The gate is awake. Walk through alone. Your pets will wait safely here, and you can choose your weapon on the other side. No other traveler can enter; the fighters within are echoes made by the dimension.</p>
      <button onClick={onEnter} className="bg-violet-300 hover:bg-violet-200 text-stone-950 rounded-full px-7 py-3 font-black">Step through the portal</button>
    </>}
    <button onClick={onClose} className="block mx-auto text-white/65 hover:text-white text-sm">Not now</button>
  </div>;
}

export function WeaponPanel({ onChoose, onExit }: { onChoose: (weapon: WeaponKind) => void; onExit: () => void }) {
  return <div className="max-w-xl mx-auto text-center space-y-5 py-4">
    <p className="text-[11px] uppercase tracking-[.28em] text-violet-200/70 font-black">You crossed alone</p>
    <h2 className="text-3xl sm:text-4xl font-black">Choose your weapon</h2>
    <p className="text-sm text-white/70">Fight human-shaped echoes with weapons. No other traveler or pet can follow you. Choose a weapon to begin.</p>
    <div className="grid grid-cols-3 gap-2 sm:gap-3 text-left">
      {kinds.map((kind, index) => { const w = WEAPONS[kind]; return <button key={kind} onClick={() => onChoose(kind)} className="rounded-2xl bg-white/5 hover:bg-white/15 border border-violet-200/25 p-3 sm:p-4 transition focus-visible:outline-amber-300">
        <span className="block text-3xl sm:text-4xl mb-2" aria-hidden="true">{['⚔️', '🔮', '🏹'][index]}</span>
        <span className="block font-black text-sm sm:text-base">{w.name}</span>
        <span className="block text-xs text-white/60 mt-1">{w.subtitle}</span>
        <span className="block mt-2 text-[11px] text-amber-200">Range {Math.round(w.range)} · Power {w.power}</span>
      </button>; })}
    </div>
    <p className="text-xs text-white/50">Move with WASD/joystick · Attack J · Heavy K · Dodge Space · Hold Shift to block</p>
    <button onClick={onExit} className="text-sm text-white/65 hover:text-white">Return without fighting</button>
  </div>;
}