import { useState } from 'react';
import { SaveData, Settings, DEFAULT_KEYS } from '../game/state';

const LABELS: Record<string, string> = { light: 'Attack', heavy: 'Big attack', ab1: 'Skill 1', ab2: 'Skill 2', ab3: 'Skill 3', ult: 'Super move', dodge: 'Dodge', block: 'Block / Run', capture: 'Catch', item: 'Use berry', switch: 'Switch pet', flee: 'Run away', interact: 'Talk / Use', map: 'Map', menu: 'Menu' };

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <button onClick={() => set(!on)} className={`w-14 h-8 rounded-full relative transition ${on ? 'bg-emerald-400' : 'bg-slate-600'}`}><span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} /></button>;
}
function Slider({ v, min, max, step, set, fmt }: { v: number; min: number; max: number; step: number; set: (v: number) => void; fmt?: (v: number) => string }) {
  const pct = ((v - min) / (max - min)) * 100;
  return <div className="flex items-center gap-3 w-full sm:w-64"><input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-amber-400" style={{ background: `linear-gradient(90deg,#fbbf24 ${pct}%,#475569 ${pct}%)` }} /><span className="w-12 text-right font-bold text-amber-300 text-sm">{fmt ? fmt(v) : v}</span></div>;
}
function Chips<T extends string | number>({ v, opts, set, label }: { v: T; opts: T[]; set: (v: T) => void; label?: (o: T) => string }) {
  return <div className="flex gap-1 flex-wrap">{opts.map(o => <button key={String(o)} onClick={() => set(o)} className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${v === o ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>{label ? label(o) : String(o)}</button>)}</div>;
}
function Row({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: React.ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/5 hover:bg-white/10 transition rounded-2xl px-4 py-3"><div className="flex items-center gap-3"><span className="text-2xl">{icon}</span><div><div className="font-bold">{title}</div>{sub && <div className="text-xs text-white/60">{sub}</div>}</div></div>{children}</div>;
}

export function SettingsPanel({ s, set, save, setDiff }: { s: Settings; set: (s: Settings) => void; save?: SaveData; setDiff?: (d: SaveData['difficulty']) => void }) {
  const [tab, setTab] = useState('sound'); const [rebind, setRebind] = useState<string | null>(null);
  const up = (p: Partial<Settings>) => set({ ...s, ...p });
  const tabs: [string, string, string][] = [['sound', '🔊', 'Sound'], ['screen', '🖥️', 'Screen'], ['game', '🎯', 'Game'], ['keys', '🎮', 'Controls']];
  return <div className="flex flex-col md:flex-row gap-4" tabIndex={0} onKeyDown={e => { if (rebind) { e.preventDefault(); e.stopPropagation(); const k = e.key === ' ' ? ' ' : e.key.toLowerCase(); up({ keys: { ...s.keys, [rebind]: k } }); setRebind(null); } }}>
    <div className="flex md:flex-col gap-2 md:w-44 overflow-x-auto">{tabs.map(([id, ic, l]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-left shrink-0 transition ${tab === id ? 'bg-gradient-to-r from-amber-300 to-orange-500 text-white shadow-lg' : 'bg-white/5 hover:bg-white/15'}`}><span className="text-xl">{ic}</span>{l}</button>)}</div>
    <div className="flex-1 space-y-2">
      {tab === 'sound' && <>
        <Row icon="🔊" title="Main volume"><Slider v={s.master} min={0} max={1} step={0.05} set={v => up({ master: v })} fmt={v => Math.round(v * 100) + '%'} /></Row>
        <Row icon="🎵" title="Music"><Slider v={s.music} min={0} max={1} step={0.05} set={v => up({ music: v })} fmt={v => Math.round(v * 100) + '%'} /></Row>
        <Row icon="💥" title="Sound effects"><Slider v={s.sfx} min={0} max={1} step={0.05} set={v => up({ sfx: v })} fmt={v => Math.round(v * 100) + '%'} /></Row>
      </>}
      {tab === 'screen' && <>
        <Row icon="⛶" title="Full screen" sub="Fill the whole screen"><button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})} className="px-4 py-2 rounded-full bg-white/15 font-bold">Switch</button></Row>
        <Row icon="✨" title="Quality" sub="Lower it if the game is slow"><Chips v={s.effects} opts={['Low', 'High'] as Settings['effects'][]} set={v => up({ effects: v, shadows: v === 'High', resScale: v === 'High' ? 1 : 0.75 })} /></Row>
        <Row icon="🔍" title="Sharpness"><Slider v={s.resScale} min={0.5} max={1} step={0.05} set={v => up({ resScale: v })} fmt={v => Math.round(v * 100) + '%'} /></Row>
        <Row icon="🌗" title="Shadows"><Toggle on={s.shadows} set={v => up({ shadows: v })} /></Row>
        <Row icon="🏔️" title="View distance"><Slider v={s.viewDist} min={60} max={250} step={10} set={v => up({ viewDist: v })} fmt={v => v + 'm'} /></Row>
        <Row icon="🪚" title="Smooth edges" sub="Works after reload"><Toggle on={s.aa} set={v => up({ aa: v })} /></Row>
        <Row icon="⏱️" title="FPS limit"><Chips v={s.fpsCap} opts={[0, 30, 60, 120]} set={v => up({ fpsCap: v })} label={v => (v ? String(v) : 'Auto')} /></Row>
        <Row icon="📈" title="Show FPS"><Toggle on={s.showFps} set={v => up({ showFps: v })} /></Row>
      </>}
      {tab === 'game' && <>
        {save && setDiff && <Row icon="⚔️" title="How hard?"><Chips v={save.difficulty} opts={['Easy', 'Normal', 'Hard'] as SaveData['difficulty'][]} set={setDiff} /></Row>}
        <Row icon="💬" title="Show messages"><Toggle on={s.subtitles} set={v => up({ subtitles: v })} /></Row>
        <Row icon="🔤" title="Text size"><Slider v={s.textSize} min={0.8} max={1.4} step={0.1} set={v => up({ textSize: v })} fmt={v => v.toFixed(1) + 'x'} /></Row>
        <Row icon="🖱️" title="Camera speed"><Slider v={s.sens} min={0.3} max={2.5} step={0.1} set={v => up({ sens: v })} fmt={v => v.toFixed(1)} /></Row>
        <Row icon="📳" title="Calm camera" sub="No screen shaking"><Toggle on={s.reduceMotion} set={v => up({ reduceMotion: v })} /></Row>
      </>}
      {tab === 'keys' && <>
        <div className="grid sm:grid-cols-2 gap-2">{Object.keys(DEFAULT_KEYS).map(a => <div key={a} className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2"><span className="font-bold">{LABELS[a] ?? a}</span><button onClick={() => setRebind(a)} className={`min-w-[72px] px-3 py-1.5 rounded-xl font-black border-b-4 ${rebind === a ? 'bg-amber-400 text-black border-amber-600 animate-pulse' : 'bg-slate-700 border-slate-900'}`}>{rebind === a ? '...' : s.keys[a] === ' ' ? 'SPACE' : s.keys[a].toUpperCase()}</button></div>)}</div>
        <button onClick={() => up({ keys: { ...DEFAULT_KEYS } })} className="px-4 py-2 rounded-full bg-white/15 font-bold">↺ Reset keys</button>
        <p className="text-xs text-white/60">Move: WASD · Camera: drag · Phone: use the joystick and buttons · Controller works too!</p>
      </>}
    </div>
  </div>;
}
