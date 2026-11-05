import type { SaveData } from '../game/state';
import { activeDaily, DAILY_BONUS } from '../game/daily';
import { ITEMS } from '../game/data';

export function DailyPanel({ save, onNext, onClose, reduced = false }: { save: SaveData; onNext: () => void; onClose: () => void; reduced?: boolean }) {
  const task = activeDaily(save);
  const daily = save.daily!;
  const total = daily.ids.length;

  return <div className={`max-w-xl mx-auto py-3 sm:py-5 ${reduced ? 'reduce-motion' : ''}`}>
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <p className="text-[11px] tracking-[0.22em] uppercase text-amber-300/80 font-black">Day {save.day} / one at a time</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Today's journey</h2>
      </div>
      <button className="text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20" onClick={onClose}>Close</button>
    </div>

    {task ? <>
      <p className="text-sm text-white/60 mb-3">Step {daily.index + 1} of {total}. Finish this task to see the next one.</p>
      <div className={`daily-stage relative overflow-hidden rounded-[26px] p-5 sm:p-7 border ${daily.ready ? 'border-amber-300/80 bg-amber-400/12' : 'border-white/15 bg-white/5'}`} key={`${save.day}-${daily.index}-${daily.ready}`}>
        <div aria-hidden="true" className="absolute -right-5 -top-5 w-40 h-40 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex gap-5 items-start">
          <div className="w-[70px] h-[70px] shrink-0 rounded-2xl bg-gradient-to-br from-sky-400/35 via-emerald-500/25 to-amber-300/25 border border-white/25 flex items-center justify-center text-[38px]" aria-hidden="true">{task.icon}</div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-amber-300 font-bold">{daily.ready ? 'Complete' : 'Your task'}</div>
            <h3 className="text-2xl font-black mt-1">{task.title}</h3>
            <p className="text-sm leading-relaxed text-white/75 mt-1">{task.tip}</p>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="flex justify-between text-sm font-bold mb-2"><span>{daily.ready ? 'Ready for the next one' : 'Progress'}</span><span>{Math.min(task.goal, Math.floor(daily.progress))} / {task.goal}{task.action === 'move' ? ' m' : ''}</span></div>
          <div className="h-3 rounded-full bg-black/35 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-300 transition-[width] duration-300" style={{ width: `${Math.min(100, daily.progress / task.goal * 100)}%` }} /></div>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-white/15">
          <p className="text-sm text-white/80">Reward: <b className="text-amber-200">{task.reward.money} coins</b>{Object.entries(task.reward.items ?? {}).map(([id, n]) => <span key={id}> + {n} {ITEMS[id]?.name ?? id}</span>)}{daily.index === total - 1 && <span> + final bonus</span>}</p>
          {daily.ready && <button onClick={onNext} className="rounded-full bg-amber-300 hover:bg-amber-200 text-stone-950 px-6 py-2.5 font-black active:scale-95 transition">{daily.index === total - 1 ? 'Finish the day' : 'Next task'}</button>}
        </div>
      </div>
      {daily.ready && <p className="mt-4 text-sm text-emerald-200/80">Your reward is already in your wallet and bag. Tap next when you are ready.</p>}
    </> : <div className="daily-stage rounded-[26px] border border-amber-300/45 bg-amber-300/10 p-8 text-center">
      <div className="mx-auto mb-5 w-20 h-20 rounded-full border-2 border-amber-300/60 bg-amber-300/15 flex items-center justify-center" aria-hidden="true"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><path d="M21 2 25 16 40 21 25 26 21 40 17 26 2 21 17 16Z" fill="#fcd34d" /></svg></div>
      <h3 className="text-2xl font-black">All done for today!</h3>
      <p className="text-white/75 mt-2">You finished all {total} tasks. Your final bonus is already yours.</p>
      <p className="text-amber-200 font-bold mt-3">+{DAILY_BONUS.money} coins and a Grand Pod</p>
      <p className="text-white/50 text-xs mt-5">New tasks arrive at the next in-game dawn.</p>
    </div>}
  </div>;
}