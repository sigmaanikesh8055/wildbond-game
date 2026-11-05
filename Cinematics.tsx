import { useEffect, useRef, useState } from 'react';
import { ITEMS } from '../game/data';
import { sfx, unlockAudio } from '../game/audio';
import type { TrainerGift } from '../game/rewards';
import { LOBBY_ART } from '../media';

const SCENE = LOBBY_ART;
const DUST = [12, 28, 41, 57, 72, 88];

export function OpeningScene({ onFinish, reduced }: { onFinish: () => void; reduced: boolean }) {
  const finish = useRef(onFinish); finish.current = onFinish;
  const [leaving, setLeaving] = useState(false);
  const [chapter, setChapter] = useState(0);
  const done = useRef(false);
  const exitTimer = useRef<number | null>(null);
  const chapters = [
    { eyebrow: 'A WORLD BEYOND THE MAP', line: 'Somewhere beyond the known horizon…', sub: 'A quiet valley waits beneath an endless sky.' },
    { eyebrow: 'A LAND OF MYSTERY', line: 'Ancient paths hold forgotten stories.', sub: 'Forests whisper. Oceans move. Secrets remain hidden.' },
    { eyebrow: 'A BOND THAT CHANGES EVERYTHING', line: 'Not every legend is found alone.', sub: 'Trust is earned, friendships are forged, and courage grows.' },
    { eyebrow: 'YOUR STORY BEGINS', line: 'Welcome to Embervale.', sub: 'The world is waiting.' },
  ];
  const end = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => finish.current(), reduced ? 0 : 650);
  };
  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(end, 1100);
      return () => window.clearTimeout(t);
    }
    const timers = chapters.map((_, i) => window.setTimeout(() => setChapter(i), 250 + i * 2850));
    const finalTimer = window.setTimeout(end, 11900);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finalTimer);
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    };
    // One uninterrupted opening sequence; skip remains available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const scene = chapters[chapter];
  return <div className={`cinematic fixed inset-0 z-50 overflow-hidden text-white ${leaving ? 'cinematic-leave' : ''} ${reduced ? 'reduce-motion' : ''}`}>
    <div className="cinematic-land" style={{ backgroundImage: `url(${SCENE})` }} />
    <div className="absolute inset-0 bg-gradient-to-t from-[#071521]/95 via-[#102d46]/50 to-[#0b2948]/45" />
    <div className="cinematic-vignette absolute inset-0" />
    <div className="cinematic-horizon absolute bottom-[25%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-100/80 to-transparent" />
    {!reduced && DUST.map((n, i) => <span key={n} className="cinematic-drift absolute bottom-[15%] w-2 h-2 bg-amber-100/70 rounded-full blur-[1px]" style={{ left: `${n}%`, animationDelay: `${i * 0.37}s`, animationDuration: `${3 + i * 0.32}s` }} />)}
    <div className="absolute inset-0 flex flex-col justify-center items-center px-6 text-center">
      <div className="cinematic-mark w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-amber-200/55 bg-slate-900/25 backdrop-blur-[3px] flex items-center justify-center mb-9">
        <svg className="w-16 h-16 sm:w-20 sm:h-20" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <path d="M14 68C28 54 26 32 47 20c8 18 6 31-1 44C58 48 66 38 81 34c-1 23-18 39-41 39" stroke="#ffe7ad" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 79c17-20 35-23 62-27M67 17v12m-6-6h12" stroke="#9fe7dc" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="48" cy="56" r="34" stroke="#fbd38b" strokeWidth="1" strokeDasharray="3 7" />
        </svg>
      </div>
      <div key={chapter} className="cinematic-chapter max-w-4xl">
        <p className="text-[10px] sm:text-xs tracking-[.38em] font-black text-amber-200 uppercase">{scene.eyebrow}</p>
        <h1 className="cinematic-story font-black leading-[1.08] mt-5 text-[clamp(2rem,6vw,4.8rem)]" style={{ textShadow: '0 4px 24px #061321' }}>{scene.line}</h1>
        <p className="text-white/75 text-sm sm:text-lg mt-5 tracking-wide">{scene.sub}</p>
      </div>
      <div className="cinematic-progress flex gap-2 mt-12" aria-hidden="true">
        {chapters.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= chapter ? 'w-8 bg-amber-200' : 'w-3 bg-white/30'}`} />)}
      </div>
    </div>
    <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-[.3em] font-bold text-white/40">WILDBOND • EMBERVALE</div>
    <button onClick={() => { unlockAudio(); end(); }} className="absolute right-5 top-5 bg-black/45 hover:bg-black/70 border border-white/30 rounded-full px-5 py-2 text-sm font-bold">Skip intro</button>
  </div>;
}

export function WorldLoading({ progress, label, reduced }: { progress: number; label: string; reduced: boolean }) {
  const value = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return <div className="fixed inset-0 z-40 overflow-hidden text-white" role="status" aria-live="polite" aria-label={`Loading world: ${value}%`}>
    <div className={`absolute inset-0 bg-cover bg-center ${reduced ? '' : 'loader-land'}`} style={{ backgroundImage: `url(${SCENE})` }} />
    <div className="absolute inset-0 bg-gradient-to-b from-[#0c2944]/85 via-[#112d43]/78 to-[#0b172a]/95" />
    <div className="relative w-full h-full flex flex-col justify-center items-center px-6 text-center">
      <svg className={`w-16 h-16 text-amber-200 mb-7 ${reduced ? '' : 'loader-symbol'}`} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M7 41c13-6 12-24 28-32 9 17 5 31-7 42 11-13 18-14 29-17-4 15-18 24-34 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-[11px] tracking-[.3em] font-bold text-sky-100/75 uppercase">Wildbond / Embervale</p>
      <h2 className="text-[clamp(2.4rem,7vw,5rem)] font-black tracking-tight mt-3 leading-tight">Waking the world</h2>
      <p className="text-white/75 mt-4 text-sm sm:text-base" key={label}>{label}</p>
      <div className="mt-12 w-full max-w-[360px] flex items-center gap-4">
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden flex-1"><div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-amber-200 transition-[width] duration-300" style={{ width: `${value}%` }} /></div>
        <span className="tabular-nums text-sm font-bold w-9 text-right">{value}%</span>
      </div>
      <p className="mt-4 text-xs text-white/50">Building the land around you. Everything works offline.</p>
    </div>
  </div>;
}

export function GiftOpening({ gift, onClaim, onLater, reduced }: { gift: TrainerGift; onClaim: (id: string) => void; onLater: () => void; reduced: boolean }) {
  const [phase, setPhase] = useState<'sealed' | 'opening' | 'revealed'>('sealed');
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const open = () => {
    if (phase !== 'sealed') return;
    unlockAudio(); sfx('gift');
    setPhase('opening');
    timer.current = window.setTimeout(() => { setPhase('revealed'); sfx('catch'); }, reduced ? 180 : 1000);
  };
  const rewards = Object.entries(gift.items);
  return <div className={`fixed inset-0 z-50 bg-[#071b2b]/90 backdrop-blur-md text-white flex items-center justify-center p-4 ${reduced ? 'reduce-motion' : ''}`} role="dialog" aria-modal="true" aria-label={`Gift from ${gift.sourceName}`}>
    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_55%,#d19b4844,transparent_52%)]" />
    <div className="relative w-full max-w-md text-center flex flex-col items-center">
      <p className="uppercase tracking-[.27em] text-amber-200 text-[11px] font-bold">Victory present</p>
      <h2 className="text-3xl sm:text-4xl font-black mt-3">From {gift.sourceName}</h2>
      <p className="text-sm text-sky-100/70 mt-2">A little thank-you for a great battle.</p>
      <div className={`gift-stage ${phase} relative w-64 h-56 mt-7 mb-4 flex justify-center items-end`}>
        <div className="gift-rays absolute inset-0 pointer-events-none" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="gift-ray absolute left-1/2 bottom-20 w-1 h-24 rounded-full bg-gradient-to-t from-amber-300/90 to-transparent origin-bottom" style={{ transform: `translateX(-50%) rotate(${i * 45}deg)` }} />)}
        </div>
        <div className="gift-glow absolute bottom-3 w-40 h-12 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="gift-box relative z-10 w-40 h-32 rounded-[16px] bg-gradient-to-br from-[#ce6753] via-[#ad4757] to-[#71344d] border-[3px] border-[#ffc77d] shadow-[0_24px_40px_#0009,inset_5px_5px_8px_#ffc68a45]">
          <span className="absolute inset-x-[38%] top-0 bottom-0 bg-amber-300/90 shadow-[0_0_15px_#fcd78088]" />
          <span className="absolute inset-y-[38%] left-0 right-0 bg-amber-300/90" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-[3px] border-amber-100 bg-amber-500 text-white flex items-center justify-center text-xl font-black">{gift.icon}</span>
        </div>
        <div className="gift-lid absolute z-20 w-48 h-9 bottom-[120px] rounded-[10px] bg-gradient-to-b from-[#f09066] to-[#a94d5b] border-[3px] border-[#ffd390] shadow-lg">
          <span className="absolute inset-x-[39%] inset-y-0 bg-amber-300" /><span className="absolute left-1/2 -translate-x-1/2 -top-5 w-10 h-7 rounded-[50%_50%_8%_8%] border-4 border-amber-200" />
        </div>
        {!reduced && <div className="gift-sparks absolute inset-0 pointer-events-none" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} style={{ left: `${22 + i * 12}%`, animationDelay: `${i * .09}s` }} className="absolute bottom-20 w-2 h-2 bg-amber-100 rounded-full" />)}</div>}
      </div>

      {phase === 'sealed' && <>
        <button onClick={open} className="rounded-full bg-amber-300 hover:bg-amber-200 text-stone-950 px-8 py-3 text-lg font-black shadow-[0_12px_28px_#eab35c55] active:scale-95 transition">Open gift</button>
        <button onClick={onLater} className="mt-4 text-sm text-white/60 hover:text-white">Open later (saved under Gifts)</button>
      </>}
      {phase === 'opening' && <p className="text-amber-100 font-bold animate-pulse">Unwrapping...</p>}
      {phase === 'revealed' && <div className="gift-rewards w-full rounded-2xl bg-white/8 border border-amber-200/35 p-4">
        <p className="text-amber-200 text-[11px] uppercase tracking-widest font-black">Inside the gift</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3 text-sm font-bold"><span className="rounded-full px-3 py-2 bg-amber-300/20 border border-amber-300/40">{gift.money} coins</span>
          {rewards.map(([id, count]) => <span key={id} className="rounded-full px-3 py-2 bg-sky-300/15 border border-sky-200/30">{count} {ITEMS[id]?.name ?? id}</span>)}</div>
        <button onClick={() => onClaim(gift.id)} className="mt-5 rounded-full bg-amber-300 hover:bg-amber-200 text-stone-950 px-8 py-2.5 font-black active:scale-95 transition">Take the gifts</button>
      </div>}
    </div>
  </div>;
}