import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine, Hud } from './game/engine';
import { SPECIES, ITEMS, STARTERS, QUESTS, CHAR_PRESETS, HAIR_STYLES, ACCESSORIES, PACKS, EMOTES, TYPE_COLORS } from './game/data';
import { SaveData, Look, newSave, makeCreature, stats, writeSave, readSave, latestSlot, loadSettings, saveSettings, Settings, CreatureInst, collectionPct } from './game/state';
import { unlockAudio, setVolumes, sfx, playMusic } from './game/audio';
import { Preview } from './ui/Preview';
import { CookPanel, FoodMenu, ChatPanel, PlanePanel, StudyPanel } from './ui/Extra';
import { hash } from './game/world2';
import { Btn, TypeTag, Bar, Portrait, ItemsPanel, QuestPanel, MapPanel, CardsPanel, AchPanel, Dex, ShopPanel, SlotList } from './ui/Panels';
import { SettingsPanel } from './ui/Settings';
import { Book } from './ui/Book';
import { LobbyStage } from './ui/Preview';
function useUiScale() { const f = () => Math.max(0.55, Math.min(1, window.innerWidth / 1150, window.innerHeight / 720)); const [s, set] = useState(f); useEffect(() => { const h = () => set(f()); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []); return s; }
import { TeamPanel, HomePanel } from './ui/Simple';
import { Minimap, Joystick, RoundBtn, AnalogCompass } from './ui/Widgets';
import { GuidePanel } from './ui/Guide';
import { BrandSplash } from './ui/BrandSplash';
import { OpeningScene, WorldLoading, GiftOpening } from './ui/Cinematics';
import { DailyPanel } from './ui/Daily';
import { WorldSystemsPanel } from './ui/WorldSystems';
import { activeDaily, nextDaily, syncDaily } from './game/daily';
import { claimTrainerGift } from './game/rewards';
import { PortalPanel, WeaponPanel } from './ui/Fourth';
import { WEAPONS } from './game/dimension';
import { LOBBY_ART } from './media';
import titleArtwork from './assets/wildbond-title-art.png';

type Screen = 'welcome' | 'brand' | 'opening' | 'title' | 'creator' | 'game';
interface Dialog { name: string; lines: string[]; i: number; choices?: { label: string; fn: () => void }[] }
interface Toast { id: number; msg: string; kind: string }
const DEFAULT_LOOK: Look = { preset: 0, age: 'Young Adult', ...CHAR_PRESETS[0] } as Look;
const BG = LOBBY_ART;

export default function App() {
  // Returning players with an existing local save skip the first-run info/profile flow.
  const [screen, setScreen] = useState<Screen>(() => latestSlot() !== null ? 'title' : 'opening');
  const [playerName, setPlayerName] = useState(() => { const existingSlot = latestSlot(); return existingSlot !== null ? (readSave(existingSlot)?.name ?? 'Robin') : 'Robin'; });
  const [settings, setSettingsS] = useState<Settings>(loadSettings);
  const [save, setSave] = useState<SaveData | null>(null);
  const [, force] = useState(0);
  const [slot, setSlot] = useState(1);
  const setSettings = (s: Settings) => { setSettingsS(s); saveSettings(s); setVolumes(s.master, s.music, s.sfx); };
  useEffect(() => { setVolumes(settings.master, settings.music, settings.sfx); document.documentElement.style.fontSize = `${16 * settings.textSize}px`; }, [settings]);
  const startGame = (d: SaveData, s: number) => { unlockAudio(); setSave(d); setSlot(s); setScreen('game'); };

  if (screen === 'opening') return <OpeningScene reduced={settings.reduceMotion} onFinish={() => setScreen('brand')} />;
  if (screen === 'brand') return <BrandSplash reduced={settings.reduceMotion} onFinish={() => setScreen('welcome')} />;
  if (screen === 'welcome') return <LaunchFlow onComplete={name => { if (name) setPlayerName(name); setScreen('title'); }} />;
  if (screen === 'creator') return <Creator suggestedName={playerName} onDone={(name, look, diff) => { const d = newSave(name, look); d.difficulty = diff; startGame(d, 1); }} onBack={() => setScreen('title')} />;
  if (screen === 'game' && save) return <Game save={save} slot={slot} setSlot={setSlot} settings={settings} setSettings={setSettings} onQuit={() => { setScreen('title'); setSave(null); force(x => x + 1); }} onLoad={(d, s) => { setSave(null); setTimeout(() => startGame(d, s), 30); }} />;
  return <Lobby settings={settings} setSettings={setSettings} onNew={() => { unlockAudio(); setScreen('creator'); }} onStart={startGame} />;
}

// ---------- Adventure systems: events, secrets, bosses, resonance and chapter quests ----------
function AdventurePanel({ save, adventure, onClose, onEvent, onDiscover, onRare, onBoss, onQuest, onResonate }: { save: SaveData; adventure: NonNullable<SaveData['adventure']>; onClose: () => void; onEvent: () => void; onDiscover: (id: string) => void; onRare: () => void; onBoss: (id: string) => void; onQuest: () => void; onResonate: (c: CreatureInst) => void }) {
  const chapters = [
    ['The Falling Star', 'A strange light crashed beyond the old road. Find its fragments and learn why the valley is changing.'],
    ['Footprints in the Fog', 'Villagers report enormous tracks near the mistline. The trail points toward a sealed cave.'],
    ['The Hollow Signal', 'A signal pulses beneath the ruins. Someone has been waking creatures with forbidden energy.'],
    ['Island of Echoes', 'A hidden island appears when the tide is low. An ancient guardian waits there.'],
    ['The Veil Unmasked', 'The clues reveal that the disasters were tests. Face the source and decide Embervale’s future.'],
  ];
  const chapter = adventure.chapter;
  return <div className="space-y-4 text-white">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-black">🌌 Embervale Adventures</h2><p className="text-sm text-white/60">A living world full of surprises. Progress is saved with your game.</p></div><Btn kind="s" onClick={onClose}>✕</Btn></div>
    <div className="grid md:grid-cols-2 gap-3">
      <section className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-950/30 p-4"><h3 className="text-lg font-black text-fuchsia-200">⚡ Dynamic world events</h3><p className="mt-1 text-sm text-white/70">Random starfalls, travellers, spirits and supply drops appear while exploring. Claim them before moving on.</p><div className="mt-3 text-xs text-white/50">Next event is triggered during exploration after a short cooldown.</div></section>
      <section className="rounded-2xl border border-amber-300/30 bg-amber-950/20 p-4"><h3 className="text-lg font-black text-amber-200">🗝️ Secret locations</h3><p className="mt-1 text-sm text-white/70">The old cave and Echo Island hide rare supplies and fragments of the valley’s history.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => onDiscover('whisper-cave')} disabled={adventure.discoveries.includes('whisper-cave')} className="rounded-xl bg-amber-500/20 border border-amber-200/30 px-3 py-2 text-sm font-bold disabled:opacity-40">{adventure.discoveries.includes('whisper-cave') ? '✓ Whisper Cave found' : '🔦 Explore Whisper Cave'}</button><button onClick={() => onDiscover('echo-island')} disabled={adventure.discoveries.includes('echo-island')} className="rounded-xl bg-cyan-500/20 border border-cyan-200/30 px-3 py-2 text-sm font-bold disabled:opacity-40">{adventure.discoveries.includes('echo-island') ? '✓ Echo Island found' : '🏝️ Search Echo Island'}</button></div></section>
      <section className="rounded-2xl border border-rose-300/30 bg-rose-950/20 p-4"><h3 className="text-lg font-black text-rose-200">👑 Boss challenges</h3><p className="mt-1 text-sm text-white/70">Prepare your team, heal up, then challenge powerful opponents. Victories are recorded by the existing battle system.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => onBoss('morrow')} className="rounded-xl bg-rose-500/20 border border-rose-200/30 px-3 py-2 text-sm font-bold">⚔️ Morrow · Veil Master</button><button onClick={() => onBoss('kael')} className="rounded-xl bg-orange-500/20 border border-orange-200/30 px-3 py-2 text-sm font-bold">🔥 Kael · Rival Champion</button></div><p className="mt-2 text-xs text-white/50">Boss victories logged: {adventure.bossWins.length}</p></section>
      <section className="rounded-2xl border border-sky-300/30 bg-sky-950/20 p-4"><h3 className="text-lg font-black text-sky-200">🧬 Rare creature encounter</h3><p className="mt-1 text-sm text-white/70">A Frostnib is said to appear in cold fog. This special encounter adds one to your team if there is room.</p><button onClick={onRare} disabled={save.caught.includes('frostnib')} className="mt-3 rounded-xl bg-sky-500/20 border border-sky-200/30 px-3 py-2 text-sm font-bold disabled:opacity-40">{save.caught.includes('frostnib') ? '✓ Frostnib registered' : '❄️ Investigate rare sighting'}</button></section>
    </div>
    <section className="rounded-2xl border border-violet-300/30 bg-violet-950/20 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-violet-200">📜 The Embervale Mystery · Chapter {Math.min(chapter + 1, 5)} / 5</h3><p className="mt-1 text-sm text-white/70">{chapter >= 5 ? 'The mystery is complete. Explore freely and challenge the bosses again.' : chapters[chapter][1]}</p></div><span className="text-3xl">📖</span></div><div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${chapter / 5 * 100}%` }} /></div>{chapter < 5 && <button onClick={onQuest} className="mt-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 font-black">Complete chapter clue · Claim reward</button>}</section>
    <section className="rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-4"><h3 className="text-lg font-black text-emerald-200">✨ Creature Resonance</h3><p className="mt-1 text-sm text-white/70">Build friendship to unlock up to three Resonance tiers. Each tier boosts bond and experience; normal level evolutions remain available too.</p><div className="mt-3 grid sm:grid-cols-2 gap-2">{save.team.map(c => <div key={c.uid} className="flex items-center justify-between gap-2 rounded-xl bg-black/20 p-3"><div className="min-w-0"><b className="block truncate">{c.nick}</b><span className="text-xs text-white/55">Bond {c.friend}/100 · Tier {adventure.resonance[c.uid] || 0}/3</span></div><button onClick={() => onResonate(c)} disabled={(adventure.resonance[c.uid] || 0) >= 3} className="shrink-0 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-black disabled:opacity-40">Resonate</button></div>)}</div>{!save.team.length && <p className="mt-2 text-sm text-white/50">Choose a starter to begin.</p>}</section>
  </div>;
}

// ---------- First-run game information and privacy-conscious profile gate ----------
function LaunchFlow({ onComplete }: { onComplete: (name: string) => void }) {
  const [step, setStep] = useState<'info' | 'choice' | 'profile' | 'art'>('info');
  const [nickname, setNickname] = useState('');
  const latest = latestSlot();
  const saved = latest !== null ? readSave(latest) : null;
  const card = 'rounded-3xl border border-white/20 bg-slate-950/75 p-5 shadow-2xl backdrop-blur-xl';
  const action = 'rounded-2xl border-2 border-white/70 bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-6 py-3 font-black text-slate-950 shadow-xl transition hover:brightness-110 active:scale-95';
  if (step === 'art') return <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center p-3">
    <img src={titleArtwork} alt="Welcome to Wildbond Embervale" className="max-h-[calc(100vh-90px)] max-w-full rounded-2xl object-contain shadow-2xl" />
    <button className={`${action} mt-3`} onClick={() => onComplete(nickname.trim())}>ENTER EMBERVALE →</button>
  </div>;
  return <div className="fixed inset-0 z-[100] overflow-auto bg-[#071a2b] text-white flex items-center justify-center p-4">
    <div className="absolute inset-0 opacity-45" style={{ backgroundImage: `url(${titleArtwork})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(8px)' }} />
    <div className="absolute inset-0 bg-gradient-to-b from-[#061a2c]/80 via-[#102b43]/85 to-[#050c18]/95" />
    <div className={`${card} relative w-full max-w-2xl`}>
      {step === 'info' && <>
        <div className="text-xs font-black tracking-[.3em] text-cyan-200">WILDBOND • EMBERVALE</div>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black italic" style={{ textShadow: '0 4px 0 #7c2d12' }}>YOUR ADVENTURE STARTS HERE</h1>
        <p className="mt-3 text-white/75">Explore a living world, befriend elemental creatures, discover hidden places and challenge trainers.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl">🕹️</div><b>Explore</b><p className="text-sm text-white/70 mt-1">WASD or arrow keys to move. Drag to rotate the camera.</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl">⬆️</div><b>Jump & flip</b><p className="text-sm text-white/70 mt-1">Use Space or the on-screen Jump button to leap and perform a backflip.</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl">🏄</div><b>Surf</b><p className="text-sm text-white/70 mt-1">Reach the shoreline and use the Surf button to ride the ocean.</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><div className="text-2xl">💾</div><b>Save locally</b><p className="text-sm text-white/70 mt-1">Your game progress is stored on this device in your browser.</p></div>
        </div>
        <button className={`${action} mt-6 w-full`} onClick={() => setStep('choice')}>CONTINUE →</button>
      </>}
      {step === 'choice' && <>
        <div className="text-xs font-black tracking-[.3em] text-cyan-200">PLAYER ACCESS</div>
        <h2 className="mt-2 text-3xl font-black">Welcome, adventurer</h2>
        <p className="mt-2 text-white/70">Choose how to enter. No email, password, ID number or photo is needed.</p>
        {saved && <button className="mt-5 w-full rounded-2xl border border-cyan-200/40 bg-cyan-500/15 p-4 text-left hover:bg-cyan-500/25" onClick={() => { setNickname(saved.name); setStep('art'); }}><b>🔐 Continue with local profile</b><div className="text-sm text-white/65 mt-1">Continue as {saved.name}. Your save stays on this device.</div></button>}
        <button className={`${action} mt-5 w-full`} onClick={() => setStep('profile')}>👤 PLAY AS GUEST / NEW PLAYER</button>
        <button className="mt-3 w-full rounded-xl bg-white/10 px-5 py-3 font-bold" onClick={() => setStep('info')}>← Back to game info</button>
      </>}
      {step === 'profile' && <>
        <div className="text-xs font-black tracking-[.3em] text-cyan-200">NEW PLAYER PROFILE</div>
        <h2 className="mt-2 text-3xl font-black">Choose your trainer name</h2>
        <p className="mt-2 text-white/70">Use a nickname. This game does not need your legal name, date of birth, identity details or an ID photo.</p>
        <label className="block mt-5 text-sm font-bold" htmlFor="trainer-nickname">Trainer nickname</label>
        <input id="trainer-nickname" value={nickname} maxLength={14} onChange={e => setNickname(e.target.value.replace(/[<>]/g, ''))} placeholder="e.g. EmberRider" className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-lg outline-none focus:border-cyan-300" />
        <button disabled={!nickname.trim()} className={`${action} mt-5 w-full disabled:opacity-40`} onClick={() => setStep('art')}>SAVE NICKNAME & SHOW GAME ART →</button>
        <button className="mt-3 w-full rounded-xl bg-white/10 px-5 py-3 font-bold" onClick={() => setStep('choice')}>← Back</button>
      </>}
    </div>
  </div>;
}

// ---------- Lobby ----------
function Lobby({ settings, setSettings, onNew, onStart }: { settings: Settings; setSettings: (s: Settings) => void; onNew: () => void; onStart: (d: SaveData, s: number) => void }) {
  const [panel, setPanel] = useState<string | null>(null);
  const latest = latestSlot(); const ls = latest !== null ? readSave(latest) : null;
  const lead = ls?.team[0]; const look = ls?.look ?? DEFAULT_LOOK; const pet = lead?.sp;
  const tabs: [string, string, string][] = [['Pets', '🐾', 'Pets'], ['Awards', '🏆', 'Awards'], ['Load', '📂', 'Load'], ['Options', '⚙️', 'Options'], ['New', '✨', 'New Game']];
  return (
    <div className="w-screen h-screen overflow-hidden relative text-white select-none" onClick={unlockAudio}>
      <img src={BG} className="absolute inset-0 w-full h-full object-cover" alt="" />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-900/20 via-transparent to-black/40" />
      {/* profile */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-gradient-to-b from-cyan-200 to-teal-400 border-4 border-white shadow-xl flex items-center justify-center text-3xl font-black text-teal-900">{(ls?.name ?? '?')[0]}</div>
        <div className="bg-slate-900/70 backdrop-blur rounded-2xl px-4 py-2 skew-x-[-8deg] border border-white/20">
          <div className="skew-x-[8deg]"><div className="font-black text-lg">{ls?.name ?? 'New Trainer'}</div>
            <div className="flex items-center gap-2"><span className="bg-teal-400 text-teal-950 rounded-lg px-2 font-black">Lv {lead?.lvl ?? 1}</span><div className="w-28"><Bar v={ls ? collectionPct(ls) : 0} max={100} color="#2dd4bf" /></div></div></div>
        </div>
      </div>
      {/* currencies */}
      <div className="absolute top-4 right-4 flex gap-2">
        <div className="bg-slate-900/70 backdrop-blur rounded-full px-4 py-1.5 font-black text-lg border border-white/20">🪙 {ls?.money ?? 0}</div>
        <div className="bg-slate-900/70 backdrop-blur rounded-full px-4 py-1.5 font-black text-lg border border-white/20">🃏 {ls ? Object.keys(ls.cards).length : 0}</div>
      </div>
      {/* logo */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h1 className="text-5xl md:text-6xl font-black italic tracking-tight text-white" style={{ textShadow: '0 4px 0 #e2742b, 0 8px 0 #7c2d12, 0 0 30px #fff8' }}>WILDBOND</h1>
        <div className="text-lg font-black text-amber-200 -mt-1" style={{ textShadow: '0 2px 0 #7c2d12' }}>~ Embervale ~</div>
      </div>
      {/* characters */}
      <div className="absolute inset-x-0 bottom-20 flex items-end justify-center pointer-events-none">
        <LobbyStage look={look} sp={pet} w={Math.min(820, window.innerWidth)} h={Math.min(560, window.innerHeight * 0.68)} />
      </div>
      {/* bottom bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="flex bg-slate-900/75 backdrop-blur rounded-2xl border border-white/20 overflow-hidden skew-x-[-10deg]">
          {tabs.map(([id, icon, label]) => <button key={id} onClick={() => { sfx('ui'); if (id === 'New') { if (!ls || confirm('Start a new game? Your old saves stay safe in their slots.')) onNew(); } else setPanel(id); }} className="px-4 md:px-6 py-2 hover:bg-white/15 flex flex-col items-center skew-x-[10deg]">
            <span className="text-3xl">{icon}</span><span className="text-xs font-bold">{label}</span></button>)}
        </div>
        <button onClick={() => { sfx('ui'); if (ls) onStart(ls, latest || 1); else onNew(); }} className="relative px-14 py-5 rounded-2xl bg-gradient-to-b from-amber-300 via-orange-400 to-orange-600 border-4 border-white shadow-2xl skew-x-[-10deg] hover:scale-105 active:scale-95 transition">
          <span className="block skew-x-[10deg] text-4xl font-black italic" style={{ textShadow: '0 3px 0 #9a3412' }}>{ls ? 'PLAY' : 'START'}</span>
          {ls && <span className="block skew-x-[10deg] text-xs font-bold">Continue as {ls.name}</span>}
        </button>
      </div>
      {panel && <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setPanel(null)}>
        <div className="bg-slate-900/95 rounded-3xl p-5 w-full max-w-3xl max-h-[80vh] overflow-auto border-2 border-white/20">
          <div className="flex justify-between mb-3"><h2 className="text-2xl font-black">{panel}</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div>
          {panel === 'Load' && <SlotList mode="load" onPick={s => { const d = readSave(s); if (d) onStart(d, s === 0 ? 1 : s); }} />}
          {panel === 'Pets' && <Dex save={ls} />}
          {panel === 'Awards' && (ls ? <AchPanel save={ls} /> : <p>Play first!</p>)}
          {panel === 'Options' && <SettingsPanel s={settings} set={setSettings} />}
        </div></div>}
    </div>
  );
}

// ---------- Character creator ----------
function Creator({ onDone, onBack, suggestedName }: { suggestedName: string; onDone: (n: string, l: Look, d: SaveData['difficulty']) => void; onBack: () => void }) {
  const [name, setName] = useState(suggestedName || 'Robin');
  const [diff, setDiff] = useState<SaveData['difficulty']>('Normal');
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const set = (k: keyof Look, v: string | number) => setLook({ ...look, [k]: v });
  const randomize = () => { const p = CHAR_PRESETS[Math.floor(Math.random() * CHAR_PRESETS.length)]; setLook({ ...look, ...p, preset: CHAR_PRESETS.indexOf(p) }); };
  const Color = ({ k, label }: { k: keyof Look; label: string }) => <label className="flex flex-col items-center text-xs gap-1">{label}<input type="color" value={look[k] as string} onChange={e => set(k, e.target.value)} className="w-10 h-10 rounded-full bg-transparent cursor-pointer" /></label>;
  const Pick = ({ k, opts }: { k: keyof Look; opts: string[] }) => <div className="flex flex-wrap gap-1">{opts.map(o => <button key={o} onClick={() => set(k, o)} className={`px-3 py-1 rounded-full text-xs capitalize font-bold ${look[k] === o ? 'bg-amber-400 text-black' : 'bg-white/15'}`}>{o}</button>)}</div>;
  return <div className="w-screen h-screen overflow-auto text-white p-4 relative">
    <img src={BG} className="fixed inset-0 w-full h-full object-cover blur-sm scale-105" alt="" /><div className="fixed inset-0 bg-slate-900/50" />
    <div className="relative max-w-5xl mx-auto"><div className="flex justify-between items-center mb-3"><div><h1 className="text-3xl md:text-4xl font-black italic" style={{ textShadow: '0 3px 0 #7c2d12' }}>CREATE YOUR TRAINER</h1><p className="text-xs md:text-sm text-cyan-100 font-bold tracking-widest">YOUR LOOK. YOUR STYLE. YOUR ADVENTURE.</p></div><div className="flex gap-2"><Btn kind="s" onClick={randomize}>🎲 Surprise me</Btn><Btn kind="s" onClick={onBack}>← Back</Btn></div></div>
      <div className="grid md:grid-cols-[340px_1fr] gap-4">
        <div className="bg-gradient-to-b from-indigo-500/50 via-sky-300/30 to-emerald-300/30 rounded-3xl p-3 flex flex-col items-center border-2 border-cyan-100/50 shadow-2xl shadow-cyan-950/40"><div className="text-xs font-black tracking-[.25em] text-cyan-100">LIVE TRAINER PREVIEW</div><Preview look={look} size={300} h={440} />
          <div className="flex gap-1 mt-1">{EMOTES.map(e => <span key={e} className="text-xl">{e.split(' ')[0]}</span>)}</div></div>
        <div className="space-y-3 bg-slate-950/85 backdrop-blur-xl rounded-3xl p-4 text-sm border-2 border-cyan-200/30 shadow-2xl"><div className="rounded-2xl p-3 bg-gradient-to-r from-fuchsia-500/20 via-indigo-500/20 to-cyan-500/20 border border-white/15"><div className="text-amber-200 font-black text-xs tracking-widest">🎉 NEW TRAINER WELCOME EVENT</div><div className="font-black text-lg">First Look Festival</div><p className="text-white/75 text-xs">Choose a signature outfit and build your own anime-inspired hero. Every new trainer gets this styling event on their first visit.</p><div className="flex flex-wrap gap-2 mt-2"><button onClick={() => setLook({ ...look, ...CHAR_PRESETS[0], preset: 0 })} className="px-3 py-1.5 rounded-xl bg-orange-400/20 border border-orange-200/40 text-xs font-bold">🔥 Ember set</button><button onClick={() => setLook({ ...look, ...CHAR_PRESETS[1], preset: 1 })} className="px-3 py-1.5 rounded-xl bg-violet-400/20 border border-violet-200/40 text-xs font-bold">🌙 Moon set</button><button onClick={() => setLook({ ...look, ...CHAR_PRESETS[2], preset: 2 })} className="px-3 py-1.5 rounded-xl bg-sky-400/20 border border-sky-200/40 text-xs font-bold">⚡ Storm set</button></div></div>
          <input value={name} maxLength={14} onChange={e => setName(e.target.value)} placeholder="Your name" className="bg-white/15 rounded-full px-4 py-2 w-full text-lg font-bold" />
          <div className="flex gap-2">{([['male', '👦 Boy'], ['female', '👧 Girl']] as const).map(([b, l]) => <button key={b} onClick={() => setLook({ ...look, body: b, hair: b === 'male' ? (['short', 'messy', 'spiky', 'undercut', 'buzz'].includes(look.hair) ? look.hair : 'short') : (['long', 'bob', 'pony', 'bun'].includes(look.hair) ? look.hair : 'long') })} className={`flex-1 py-2 rounded-2xl text-lg font-black border-2 ${(look.body ?? 'male') === b ? 'bg-amber-400 text-black border-white' : 'bg-white/10 border-transparent'}`}>{l}</button>)}</div>
          <div><div className="font-bold mb-1 flex items-center justify-between"><span>Signature outfits</span><span className="text-[10px] text-cyan-200">13 STYLE SETS</span></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-1">{CHAR_PRESETS.map((p, i) => <button key={p.name} onClick={() => setLook({ ...look, coat: 'none', ...p, preset: i })} className={`p-2 rounded-xl text-xs text-left font-bold ${look.preset === i ? 'bg-amber-400 text-black' : 'bg-white/15'}`}><span className="inline-flex w-8 h-8 rounded-lg mr-2 border border-white/40 items-center justify-center align-middle overflow-hidden" style={{ background: `linear-gradient(180deg, ${p.top} 0 48%, ${p.bottom} 48% 82%, ${p.shoes} 82%)` }}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 3h8l2 6-2 2v9H8v-9L6 9z" fill="#ffffff" fillOpacity=".72" stroke="#111827" strokeWidth=".8"/><path d="M8 12h8" stroke="#111827" strokeWidth=".8"/></svg></span>{p.name}</button>)}</div></div>
          <div><div className="font-bold mb-1">Hair & silhouette</div><Pick k="hair" opts={HAIR_STYLES} /></div>
          <div className="flex gap-4 flex-wrap"><Color k="hairColor" label="Hair" /><Color k="skin" label="Skin" /><Color k="top" label="Shirt" /><Color k="bottom" label="Pants" /><Color k="shoes" label="Shoes" /></div>
          <div className="flex gap-4"><Color k="eye" label="Eyes" /></div>
          <div><div className="font-bold mb-1">Extra</div><Pick k="acc" opts={ACCESSORIES} /></div>
          <div><div className="font-bold mb-1">Bag</div><Pick k="pack" opts={PACKS} /></div>
          <div><div className="font-bold mb-1">How hard?</div><div className="flex gap-1">{(['Easy', 'Normal', 'Hard'] as const).map(d => <button key={d} onClick={() => setDiff(d)} className={`px-3 py-1 rounded-full text-xs font-bold ${diff === d ? 'bg-amber-400 text-black' : 'bg-white/15'}`}>{d}</button>)}</div></div>
          <button disabled={!name.trim()} onClick={() => onDone(name.trim(), look, diff)} className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 border-2 border-white text-xl font-black italic shadow-xl shadow-orange-950/50 hover:brightness-110 active:scale-[.99] disabled:opacity-40">CONFIRM TRAINER & ENTER WORLD →</button>
        </div></div></div></div>;
}

function LocalTradePanel({ save, slot, onSaved }: { save: SaveData; slot: number; onSaved: () => void }) {
  const [targetSlot, setTargetSlot] = useState<number>([1, 2, 3].find(x => x !== slot) ?? 2);
  const [giveUid, setGiveUid] = useState(''); const [takeUid, setTakeUid] = useState('');
  const other = readSave(targetSlot);
  const mine = [...save.team, ...save.storage]; const theirs = other ? [...other.team, ...other.storage] : [];
  const trade = () => {
    if (!other || !giveUid || !takeUid) return;
    const give = mine.find(c => c.uid === giveUid); const take = theirs.find(c => c.uid === takeUid);
    if (!give || !take) return;
    const remove = (d: SaveData, uid: string) => { const inTeam = d.team.some(c => c.uid === uid); d.team = d.team.filter(c => c.uid !== uid); d.storage = d.storage.filter(c => c.uid !== uid); return inTeam; };
    const giveTeam = remove(save, give.uid); const takeTeam = remove(other, take.uid);
    if (takeTeam && save.team.length < 8) save.team.push(take); else save.storage.push(take);
    if (giveTeam && other.team.length < 8) other.team.push(give); else other.storage.push(give);
    const okA = writeSave(slot, save), okB = writeSave(targetSlot, other);
    if (!okA || !okB) { alert('Trade could not be saved. Check browser storage and reload both profiles before retrying.'); return; }
    setGiveUid(''); setTakeUid(''); onSaved(); alert(`Trade complete: ${give.nick} ↔ ${take.nick}.`);
  };
  return <div className="space-y-3"><div className="rounded-xl border border-amber-200/30 bg-amber-950/20 p-3"><b className="text-amber-200">Local profile trading</b><p className="text-xs text-white/65 mt-1">Trade between two saved trainer profiles on this device. An online-service starter is included in the project, but this game client is not connected to a hosted account or shared-world server yet.</p><label className="block text-xs mt-3">Other trainer save slot<select value={targetSlot} onChange={e => { setTargetSlot(+e.target.value); setTakeUid(''); }} className="ml-2 rounded-lg bg-slate-800 border border-white/20 p-2">{[1,2,3].filter(x => x !== slot).map(x => <option key={x} value={x}>Slot {x}</option>)}</select></label></div>
    {!other ? <p className="rounded-xl bg-white/5 p-4 text-sm text-white/60">No save exists in Slot {targetSlot}. Create another trainer save first.</p> : <div className="grid md:grid-cols-2 gap-3"><div className="rounded-xl bg-white/5 p-3"><h3 className="font-black mb-2">Your creature</h3><select value={giveUid} onChange={e => setGiveUid(e.target.value)} className="w-full rounded-lg bg-slate-800 border border-white/20 p-2 text-sm"><option value="">Choose creature to offer</option>{mine.map(c => <option key={c.uid} value={c.uid}>{c.nick} · Lv {c.lvl}</option>)}</select></div><div className="rounded-xl bg-white/5 p-3"><h3 className="font-black mb-2">Other trainer's creature</h3><select value={takeUid} onChange={e => setTakeUid(e.target.value)} className="w-full rounded-lg bg-slate-800 border border-white/20 p-2 text-sm"><option value="">Choose creature to receive</option>{theirs.map(c => <option key={c.uid} value={c.uid}>{c.nick} · Lv {c.lvl}</option>)}</select></div></div>}
    <button disabled={!other || !giveUid || !takeUid} onClick={trade} className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Review and complete two-way trade</button><p className="text-[11px] text-white/45">A trade permanently moves both creatures between saves. Back up both save slots first.</p>
  </div>;
}

// ---------- Game ----------
function Game({ save, slot, setSlot, settings, setSettings, onQuit, onLoad }: { save: SaveData; slot: number; setSlot: (n: number) => void; settings: Settings; setSettings: (s: Settings) => void; onQuit: () => void; onLoad: (d: SaveData, s: number) => void }) {
  syncDaily(save);
  const canvas = useRef<HTMLCanvasElement>(null); const eng = useRef<Engine | null>(null); const [engS, setEngS] = useState<Engine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null); const [, force] = useState(0); const rerender = useCallback(() => force(x => x + 1), []);
  const [worldLoad, setWorldLoad] = useState<{ progress: number; label: string } | null>({ progress: 0, label: 'Opening the valley' });
  const [worldError, setWorldError] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false); const dismissedGifts = useRef(new Set<string>());
  const [toasts, setToasts] = useState<Toast[]>([]); const [dialog, setDialog] = useState<Dialog | null>(null);
  const [panel, setPanel] = useState<string | null>(null); const [menuTab, setMenuTab] = useState('Team');
  const [starterPick, setStarterPick] = useState(false); const [evo, setEvo] = useState<{ c: CreatureInst; from: string; to: string } | null>(null);
  const ui = useUiScale(); const [campAsk, setCampAsk] = useState(false); const [chatWith, setChatWith] = useState<{ name: string; first: string } | null>(null);
  const [banner, setBanner] = useState<string | null>(null); const dirty = useRef(false); const petTimes = useRef<Record<string, number>>({});
  if (!save.adventure) save.adventure = { eventAt: 0, eventId: '', discoveries: [], chapter: 0, bossWins: [], resonance: {} };
  const adventure = save.adventure;
  const toast = useCallback((msg: string, kind = 'info') => { const id = Math.random(); setToasts(t => [...t.slice(-3), { id, msg, kind }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600); }, []);
  const [worldEvent, setWorldEvent] = useState<{ id: string; title: string; text: string; reward: number; icon: string } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const en = eng.current; if (!en || en.battle || en.indoor || en.fourth || en.fourthLobby || panel || dialog || starterPick || evo || worldLoad) return;
      if (Date.now() - (adventure.eventAt || 0) < 85000 || worldEvent) return;
      const pool = [
        { id: 'meteor', title: '☄️ Starfall!', text: 'A meteor fragment has landed nearby. Its glow is fading—claim it!', reward: 95, icon: '💎' },
        { id: 'traveller', title: '🧭 Lost Traveller', text: 'A wandering explorer offers a map fragment for helping them.', reward: 75, icon: '🗺️' },
        { id: 'spirit', title: '✨ Whispering Spirit', text: 'A tiny spirit appears and leaves a gift of energy.', reward: 60, icon: '🌟' },
        { id: 'supply', title: '🎒 Supply Crate', text: 'You spot an abandoned supply crate beside the trail.', reward: 85, icon: '📦' },
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)]; setWorldEvent(pick); toast(`World event: ${pick.title}`, 'card');
    }, 5000); return () => window.clearInterval(timer);
  }, [panel, dialog, starterPick, evo, worldLoad, worldEvent, adventure.eventAt, toast]);
  const doSave = useCallback((s: number, silent = false) => { const e = eng.current; if (!e) return; if (!e.indoor && !e.fourth && !e.fourthLobby) save.pos = [e.player.position.x, e.player.position.z]; const ok = writeSave(s, save); if (!ok) toast('Save failed. Check local storage space.', 'bad'); else if (!silent) toast('Game saved.', 'good'); if (ok) dirty.current = false; if (s !== 0 && ok) e.tut(14); }, [save, toast]);

  const talk = useCallback((id: string) => {
    const e = eng.current!; const f = save.flags; const done = (q: string) => save.quests[q].done;
    const D = (name: string, lines: string[], choices?: Dialog['choices']) => { setDialog({ name, lines, i: 0, choices }); sfx('ui'); };
    if (id === '__autosave') { doSave(0, true); return; }
    if (id === 'bed') { e.startSleep('bed'); return; }
    if (id === 'chest') { setPanel('home'); return; }
    if (id === 'book') { setPanel('book'); sfx('ui'); return; }
    if (id === 'cook') { setPanel('cook'); sfx('ui'); return; }
    if (id === 'study') { setPanel('study'); sfx('ui'); return; }
    if (id === 'portal') { setPanel('portal'); sfx('shadow'); return; }
    const who = e.npcs.find(x => x.id === id);
    if (who && !id.startsWith('trainer:')) e.daily('talk');
    if (id.startsWith('food@')) { D('Chef Miko', ['Irasshai! Welcome to my little food shop!', 'Momos, ramen, pizza, coffee... what would you like?'], [{ label: '📜 See menu', fn: () => setPanel('food') }, { label: 'Bye', fn: () => {} }]); return; }
    if (id.startsWith('market@')) { D('Fruit Seller', ['Fresh fruits and pet snacks here!'], [{ label: '🛒 Shop', fn: () => setPanel('shop') }, { label: 'Bye', fn: () => {} }]); return; }
    if (id.startsWith('commander@')) { D('Commander Hale', ['Welcome to the airport, young pilot!', 'We have 5 planes. You can fly free or go to another airport.'], [{ label: '✈️ Choose a plane', fn: () => setPanel('plane') }, { label: 'Later', fn: () => {} }]); return; }
    if (id.startsWith('badminton@')) { D('Coach Ren', ['Want to play badminton? First to 5 points wins!', 'Walk to where the shuttle will land. Your racket hits it by itself.'], [{ label: '🏸 Play!', fn: () => e.startBadminton(id) }, { label: 'No thanks', fn: () => {} }]); return; }
    if (id.startsWith('dancer@')) { D(who?.name ?? 'Dancer', ['Come dance with us! Stand on the floor and press E!', 'The lights are best at night ✨']); return; }
    if (id.startsWith('chat@')) {
      const nm = who?.name ?? 'Villager'; const rq = save.request;
      const work = () => {
        if (rq && rq.npc === id) { if ((save.items[rq.item] || 0) >= rq.n) { save.items[rq.item] -= rq.n; save.money += rq.reward; save.request = null; toast(`Job done! +${rq.reward} coins 💰`, 'good'); sfx('coin'); D(nm, ['Thank you so much! Here is your pay.']); } else D(nm, [`I still need ${rq.n} ${ITEMS[rq.item].name} ${ITEMS[rq.item].icon}. You have ${save.items[rq.item] || 0}.`]); rerender(); return; }
        if (rq) { D(nm, [`You are already helping ${rq.name}. Finish that first!`]); return; }
        let h = 0; for (const c of id + save.day) h = (h * 31 + c.charCodeAt(0)) | 0; const opts = ['wood', 'fish', 'water', 'apple', 'veg', 'egg', 'sunberry', 'mango']; const item = opts[Math.abs(h) % opts.length]; const n = 2 + (Math.abs(h >> 3) % 3); const reward = n * Math.max(15, ITEMS[item].price) + 40;
        D(nm, [`Yes! Can you bring me ${n} ${ITEMS[item].name} ${ITEMS[item].icon}?`, `I will pay you ${reward} coins.`], [{ label: '👍 Okay!', fn: () => { save.request = { npc: id, name: nm, item, n, reward }; toast('New job accepted!', 'good'); rerender(); } }, { label: 'Not now', fn: () => {} }]);
      };
      const lines = who?.lines ?? ['Nice day!'];
      D(nm, [lines[Math.floor(hash(id.length, save.day, 3) * lines.length)] ?? lines[0]], [{ label: '💬 Chat', fn: () => { setChatWith({ name: nm, first: lines[lines.length - 1] }); setPanel('chat'); } }, { label: rq?.npc === id ? '📦 Give items' : '🧰 Any work?', fn: work }, { label: 'Bye', fn: () => {} }]);
      return;
    }
    const base = id.split('@')[0];
    if (base === 'healer') { save.team.forEach(c => { c.fainted = false; c.hp = stats(c).hp; }); save.trainerHealth = 100; save.trainerHunger = 100; e.refreshPartner(); D('Nurse', ['Welcome! Let me help your pets and restore your health and hunger...', 'All better! Come back any time. 💖']); sfx('level'); return; }
    if (base === 'shop') { D('Shopkeeper', ['Hello, traveler! Want to buy or sell?'], [{ label: '🛒 Shop', fn: () => setPanel('shop') }, { label: 'Bye', fn: () => {} }]); return; }
    if (base === 'chat') { const n = e.npcs.find(x => x.id === id); D(n?.name ?? 'Villager', n?.lines ?? ['Nice day!']); return; }
    if (id.startsWith('trainer:')) {
      const t = e.getTrainer(id.slice(8)); if (!t) return; if (!e.leadInst()) { D(t.name, ['Your pets are tired. Rest first!']); return; }
      D(t.name, [t.intro], [{ label: '⚔️ Fight!', fn: () => { e.startTrainer(t.id); setBanner(t.name.toUpperCase()); setTimeout(() => setBanner(null), 1800); } }]); return;
    }
    switch (id) {
      case 'elder':
        if (!f.starter) D('Elder Wren', [`Good morning, ${save.name}!`, 'Today you get your very first pet friend.', 'Five little ones are waiting. Pick the one you like!'], [{ label: '🐾 Meet them', fn: () => setStarterPick(true) }]);
        else if (!done('m3')) D('Elder Wren', ['Go north through the gate.', 'Your friend Kael went that way. He wants to battle you!', 'Tip: hurt wild pets first, then catch them.']);
        else if (!done('m4')) D('Elder Wren', ['Bad people in masks are at the Old Ruins.', 'They want to lock up all pets. Please stop them!']);
        else D('Elder Wren', ['You saved the pets! I am so proud.', 'Want to start again with your team, but with harder enemies?'], [{ label: 'New Game+', fn: () => { if (confirm('Start New Game+? You keep your pets, cards, items and coins. Your game is saved first.')) { doSave(0, true); const keep = Object.fromEntries(Object.entries(save.flags).filter(([k]) => k.startsWith('starter'))); save.flags = { ...keep, starter: true, intro: true }; QUESTS.forEach(q => (save.quests[q.id] = { p: 0, done: q.id === 'm1' })); save.ngPlus++; save.discovered = []; e.teleport(0, -6); e.npcs.forEach(n => (n.engaged = false)); toast('New Game+ started!', 'good'); rerender(); } } }, { label: 'Not now', fn: () => {} }]);
        break;
      case 'shop': D('Tova', ['Hi! Want to buy something?'], [{ label: '🛒 Shop', fn: () => setPanel('shop') }, { label: 'Bye', fn: () => {} }]); break;
      case 'ilsa':
        if (!f.ilsa_gift && f.starter) { f.ilsa_gift = true; save.items.lumenpod = (save.items.lumenpod || 0) + 3; D('Professor Ilsa', ['Hello! Can you catch 3 wild pets for me?', 'Here are 3 catch balls. Good luck!']); toast('Got 3 catch balls!', 'good'); }
        else D('Professor Ilsa', [`You caught ${save.quests.s1.p} of 3.`, 'Some pets only come out at night, or when it rains!']);
        break;
      case 'healer': save.team.forEach(c => { c.fainted = false; c.hp = stats(c).hp; }); save.trainerHealth = 100; save.trainerHunger = 100; e.refreshPartner(); D('Nurse Oona', ['All better! Your pets feel great, and your health and hunger are restored.']); sfx('level'); break;
      case 'kid': f.kidhint = true; D('Little Fen', ['Psst! I saw something shiny far to the east, past the river!']); break;
      case 'kael_post': D('Kael', ['I got way stronger! Battle me again!'], [{ label: '⚔️ Fight!', fn: () => e.startTrainer('kael') }, { label: 'Later', fn: () => {} }]); break;
      case 'grunt': D('Masked Guard', ['Go away! Our boss Morrow is busy.']); break;
      case 'stone': D('Shiny Stone', ['The stone glows... A picture of a bird made of light is carved on it.', 'You got the Shrine Stone!']); break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, doSave, toast, rerender]);

  useEffect(() => {
    let cancelled = false, iv = 0, readyTimer = 0;
    let instance: Engine | null = null;
    // Give React one painted frame for the loading scene before constructing WebGL.
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const e = new Engine(canvas.current!, save, settings, {
          onInteract: id => talk(id), onToast: (m, k) => { if (settings.subtitles || k !== 'info') toast(m, k); }, onChange: () => { dirty.current = true; rerender(); },
          onEvolve: (c, from, to) => setEvo({ c, from, to }), onMenu: () => setPanel(p => p ? null : 'menu'),
          onWorldProgress: (progress, label) => { if (!cancelled) setWorldLoad({ progress, label }); },
          onWorldReady: () => {
            if (cancelled) return;
            setWorldLoad({ progress: 1, label: 'The world is ready' });
            readyTimer = window.setTimeout(() => { if (!cancelled) setWorldLoad(null); }, settings.reduceMotion ? 100 : 650);
          },
          onWorldError: message => { if (!cancelled) { setWorldError(message); setWorldLoad(null); } },
          onBattleEnd: (res, tr) => {
            const T = tr ? eng.current?.getTrainer(tr) : undefined;
            if (tr && !T) return;
            if (T && res === 'win') {
              if (tr === 'morrow' || tr === 'kael') { const a = save.adventure ?? (save.adventure = { eventAt: 0, eventId: '', discoveries: [], chapter: 0, bossWins: [], resonance: {} }); if (!a.bossWins.includes(tr)) a.bossWins.push(tr); save.money += tr === 'morrow' ? 350 : 180; toast(`${T.name} defeated! Boss reward added.`, 'good'); doSave(0, true); }
              setDialog({ name: T.name, lines: [T.win, ...(tr === 'morrow' ? ['The masked people run away. The metal pet is free!', 'You finished the story! Kael wants a rematch in the village.'] : [])], i: 0 });
            }
            if (T && res === 'lose') setDialog({ name: T.name, lines: [T.lose, 'You can try again any time!'], i: 0 });
          },
        });
        instance = e; eng.current = e; setEngS(e);
        iv = window.setInterval(() => setHud({ ...e.hud, me: e.hud.me && { ...e.hud.me }, foe: e.hud.foe && { ...e.hud.foe }, abilities: [...e.hud.abilities] }), 80);
        if (!save.flags.intro) { save.flags.intro = true; setDialog({ name: 'Embervale', lines: [`Welcome, ${save.name}!`, 'Go see the Elder in the big green house. Walk close and press E.'], i: 0 }); }
      } catch (err) {
        setWorldError(err instanceof Error ? err.message : 'The world could not load.');
        setWorldLoad(null);
      }
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); clearInterval(iv); clearTimeout(readyTimer); instance?.dispose(); eng.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { eng.current?.applySettings(settings); }, [settings]);
  useEffect(() => { if (eng.current) { const p = !!(dialog || panel || starterPick || evo || campAsk || giftOpen || worldLoad || worldError); eng.current.paused = p; if (p) eng.current.releaseInput(); } }, [dialog, panel, starterPick, evo, campAsk, giftOpen, worldLoad, worldError]);
  useEffect(() => {
    const gift = save.pendingGifts?.[0];
    if (gift && !dismissedGifts.current.has(gift.id) && !dialog && !panel && !starterPick && !evo && !campAsk && !worldLoad && !worldError && !eng.current?.battle && !eng.current?.fourth && !eng.current?.fourthLobby) setGiftOpen(true);
  }, [dialog, panel, starterPick, evo, campAsk, worldLoad, worldError, save.pendingGifts?.length, hud?.mode, save]);
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase(); const e = eng.current; if (!e) return;
      if (giftOpen || worldLoad || worldError) return;
      if (dialog && (key === 'e' || key === ' ' || key === 'enter')) { if (!dialog.choices || dialog.i < dialog.lines.length - 1) advance(); return; }
      if (key === 'escape') { if (e.fourth || e.fourthLobby) { e.exitFourth(); setPanel(null); return; } setPanel(p => p ? null : 'menu'); return; }
      if (dialog || starterPick || evo) return;
      if (key === settings.keys.menu && !e.battle) { setPanel(p => p === 'menu' ? null : 'menu'); return; }
      if (key === settings.keys.map) { setPanel(p => p === 'map' ? null : 'map'); e.tut(12); return; }
      if (key === 'p' && !e.battle && !panel) { doSave(slot); return; }
      if (!panel && !e.battle && ['5', '6', '7', '8'].includes(key)) e.emote(+key - 5);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const advance = () => { if (!dialog) return; if (dialog.i < dialog.lines.length - 1) setDialog({ ...dialog, i: dialog.i + 1 }); else if (!dialog.choices) setDialog(null); sfx('ui'); };

  const act = (k: string, c?: CreatureInst, extra?: string) => {
    const e = eng.current!; const it = extra ? ITEMS[extra] : null;
    const bond = () => { save.stats.feeds++; e.quest('s3'); e.tut(9); };
    const show = (kind: 'feed' | 'treat' | 'pet' | 'play') => { if (c && !e.battle) { setPanel(null); setTimeout(() => eng.current?.react(c, kind), 60); } };
    switch (k) {
      case 'eat': { const food = extra || 'sunberry'; if (!save.items[food]) return toast(`No ${ITEMS[food]?.name || 'food'} available.`, 'bad'); save.items[food]--; const heal = food === 'honeycake' ? 14 : food === 'sunberry' ? 22 : 30; save.trainerHealth = Math.min(100, (save.trainerHealth ?? 100) + heal); save.trainerHunger = Math.min(100, (save.trainerHunger ?? 100) + (food === 'honeycake' ? 32 : 24)); toast(`You ate ${ITEMS[food]?.name || food}. Health and hunger restored.`, 'good'); sfx('pickup'); break; }
      case 'feed': case 'use': if (!c || !it || !save.items[extra!]) return;
        if (it.kind === 'heal') { if (c.fainted) return toast('Wake it up first.', 'bad'); c.hp = Math.min(stats(c).hp, Math.round(c.hp + stats(c).hp * it.value)); e.friend(c, 2); }
        else if (it.kind === 'friend') e.friend(c, it.value); else if (it.kind === 'energy') e.friend(c, 1);
        else if (it.kind === 'revive') { if (!c.fainted && c.hp > 0) return toast('It is already awake.', 'info'); c.fainted = false; c.hp = Math.round(stats(c).hp * it.value); }
        save.items[extra!]--; toast(`${c.nick} loved it! 💖`, 'good'); bond(); if (it.kind !== 'revive') e.daily('feed'); e.refreshPartner();
        if (it.kind !== 'revive') show(it.kind === 'friend' ? 'treat' : 'feed'); break;
      case 'pet': if (!c) return; { const last = petTimes.current[c.uid] ?? -99;
        if (save.playtime - last < 15) { toast(`${c.nick} is happy. Try later!`, 'info'); return; } petTimes.current[c.uid] = save.playtime; e.friend(c, 3); toast(`${c.nick} loves you! 💕`, 'good'); bond(); e.daily('pet'); show('pet'); } break;
      case 'play': if (!c) return; if (c.fainted || c.hp < 5) return toast(`${c.nick} is too tired.`, 'bad'); e.friend(c, 4); c.hp = Math.max(1, c.hp - 3); toast(`You played with ${c.nick}! 🎾`, 'good'); e.daily('play'); show('play'); break;
      case 'train': if (!c) return; if (save.money < 20) return toast('Not enough coins.', 'bad'); save.money -= 20; e.awardXp(12 + c.lvl, new Set([c.uid])); e.friend(c, 1); e.checkEvos(); e.daily('train'); toast(`${c.nick} trained hard! 💪`, 'good'); break;
      case 'revive': if (c) act('use', c, 'revivedew'); return;
      case 'lead': if (!c) return; save.team = [c, ...save.team.filter(x => x !== c)]; e.refreshPartner(); break;
      case 'rename': if (c && extra) c.nick = extra; e.refreshPartner(); break;
      case 'store': if (!c) return; save.team = save.team.filter(x => x !== c); save.storage.push(c); e.refreshPartner(); if (e.indoor) e.spawnHomePets(); break;
      case 'withdraw': if (!c || save.team.length >= 8) return; save.storage = save.storage.filter(x => x !== c); save.team.push(c); if (e.indoor) e.spawnHomePets(); break;
      case 'buy': if (!it || save.money < it.price) return; save.money -= it.price; save.items[extra!] = (save.items[extra!] || 0) + 1; sfx('coin'); e.daily('buy'); break;
      case 'sell': if (!it || !save.items[extra!]) return; save.items[extra!]--; save.money += Math.floor(it.price / 2); sfx('coin'); break;
      case 'rest': setPanel(null); window.setTimeout(() => eng.current?.startSleep(e.indoor ? 'bed' : 'tent'), 50); return;
      case 'dress': if (!c) return; c.acc = extra || undefined; e.refreshPartner(); toast(extra ? `${c.nick} looks so cute! 💕` : 'Outfit removed.', 'good'); if (extra) show('pet'); break;
      case 'decor': { const [id, p] = extra!.split(':'); if (save.money < +p) return; save.money -= +p; save.home.decor.push(id); save.home.level++; sfx('coin'); toast('Placed in your room!', 'good'); const o = e.world.decor[id]; if (o) o.visible = true; break; }
    }
    dirty.current = true; rerender();
  };

  const chooseStarter = (sp: string) => {
    const e = eng.current!; const c = makeCreature(sp, 5); c.friend = 40; c.caughtAt = 'Embervale'; save.team.push(c); save.flags.starter = true; save.flags['starter_' + sp] = true;
    save.caught.push(sp); save.seen.push(sp); e.addCard('c_' + sp); e.ach('first_partner'); e.quest('m1'); e.daily('partner'); if (save.tutorial < 3) save.tutorial = 3; e.refreshPartner(); setStarterPick(false);
    setTimeout(() => eng.current?.react(c, 'play'), 100);
    setDialog({ name: 'Elder Wren', lines: [`${SPECIES[sp].name} likes you a lot!`, 'Your home is the house with the red roof. The shop has a blue roof.', 'When you are ready, go north!'], i: 0 });
    doSave(0, true);
  };
  const manualSave = (s: number) => {
    const ex = readSave(s);
    if (ex && (ex.name !== save.name || ex.playtime > save.playtime + 5) && !confirm(`Slot ${s} has "${ex.name}"${ex.playtime > save.playtime ? ' with MORE play time' : ''}. Replace it?`)) return;
    setSlot(s); doSave(s);
  };
  const quit = () => { if (!eng.current?.battle) { doSave(slot, true); doSave(0, true); } onQuit(); };

  const e = eng.current; const h = hud;
  const dailyTask = activeDaily(save); const dailyState = save.daily!;
  const nextGift = save.pendingGifts?.[0];
  const mapPos: [number, number] = h?.indoor ? [-18, -14] : h?.pos ?? save.pos;
  const hh = Math.floor(save.time), mm = Math.floor((save.time % 1) * 60);
  const trackedQuest = QUESTS.find(q => q.kind === 'Main' && !save.quests[q.id].done && (!q.requires || save.quests[q.requires].done));
  const tc = { good: 'from-emerald-400 to-emerald-600', bad: 'from-rose-400 to-rose-600', info: 'from-sky-400 to-sky-600', card: 'from-fuchsia-400 to-fuchsia-600', ach: 'from-amber-300 to-amber-500' } as Record<string, string>;
  const wIcon = ({ Clear: h?.night ? '🌙' : '☀️', Cloudy: '☁️', Rain: '🌧️', Storm: '⛈️', Fog: '🌫️', Wind: '🍃', Snow: '❄️' } as Record<string, string>)[save.weather];
  const showControls = !dialog && !panel && !starterPick && !evo && !giftOpen && !worldLoad && !worldError;

  return (
    <div className="w-screen h-screen overflow-hidden relative text-white select-none" onClick={unlockAudio}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full block touch-none" />
      {/* minimap + info */}
      {h?.mode !== 'fourth' && <div className="absolute top-3 left-3 flex flex-col items-center gap-1">
        <button onClick={() => setPanel('map')} title="Open map"><Minimap eng={engS} /></button>
        <div className="bg-slate-950/85 border border-sky-200/35 rounded-full pl-1 pr-3 py-0.5 text-xs font-black tabular-nums shadow-lg flex items-center gap-1">
          <AnalogCompass from={mapPos} to={engS?.guideTarget ? [engS.guideTarget.x, engS.guideTarget.z] : null} size={31} /> X {Math.round(mapPos[0])} · Z {Math.round(mapPos[1])}
        </div>
        <div className="bg-slate-900/70 backdrop-blur rounded-full px-3 py-0.5 text-xs font-bold">{h?.area} · {wIcon} {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}</div>
        {settings.showFps && <div className="text-lime-300 text-xs">{h?.fps} FPS</div>}
        {h?.mode === 'explore' && showControls && <>
          <button onClick={() => setPanel('guide')} className="w-[140px] sm:w-[170px] rounded-full bg-slate-900/85 hover:bg-slate-800 border-2 border-sky-200/70 shadow-lg px-3 py-2 font-black text-xs sm:text-sm whitespace-nowrap" aria-label="Find a place">Find a place</button>
          {engS?.guideTarget && <span className="max-w-[140px] sm:max-w-[170px] rounded-xl bg-slate-950/75 px-2 py-1 text-center text-[10px] leading-tight text-amber-200 break-words">{engS.guideTarget.name} · {Math.round(Math.hypot(engS.guideTarget.x - mapPos[0], engS.guideTarget.z - mapPos[1]))} m</span>}
        </>}
      </div>}
      {h?.mode === 'explore' && <div className="absolute top-[76px] left-3 w-44 sm:w-56 rounded-xl border border-white/20 bg-slate-950/80 p-2 shadow-xl pointer-events-auto"><div className="flex justify-between text-[10px] font-black tracking-wider"><span className="text-rose-200 inline-flex items-center gap-1"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z"/></svg>TRAINER HEALTH</span><span>{Math.ceil(save.trainerHealth ?? 100)}/100</span></div><Bar v={save.trainerHealth ?? 100} max={100} color="#ef5368" h="h-2.5"/><div className="flex justify-between text-[10px] font-black tracking-wider mt-1"><span className="text-amber-200 inline-flex items-center gap-1"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3c-5 0-8 4-8 9a8 8 0 0 0 16 0c0-5-3-9-8-9Z"/><path d="M12 3c0-2 2-2 3-2"/></svg>HUNGER</span><span>{Math.ceil(save.trainerHunger ?? 100)}/100</span></div><Bar v={save.trainerHunger ?? 100} max={100} color="#e8ad43" h="h-2"/><button onClick={() => act('eat', undefined, save.items.sunberry ? 'sunberry' : save.items.honeycake ? 'honeycake' : 'stew')} disabled={!['sunberry','honeycake','stew'].some(id => (save.items[id] ?? 0) > 0)} className="mt-1.5 w-full rounded-lg border border-amber-200/30 bg-amber-500/20 px-2 py-1 text-[11px] font-black disabled:opacity-40">Eat food · restore health</button></div>}
      {/* coins + menu */}
      <div className="absolute top-3 right-3 max-w-[calc(100vw-190px)] sm:max-w-none flex flex-wrap justify-end gap-1.5 sm:gap-2 items-center">
        <div className="bg-slate-900/70 backdrop-blur rounded-full px-2 sm:px-4 py-1.5 text-sm sm:text-base font-black border border-white/20">🪙 {save.money}</div>
        <div className="hidden sm:block bg-slate-900/70 backdrop-blur rounded-full px-3 py-1.5 font-black border border-white/20">🔆 {save.items.lumenpod ?? 0}</div>
        {!save.flags.portalAwake && <div className="hidden sm:block bg-slate-900/70 backdrop-blur rounded-full px-3 py-1.5 font-black border border-white/20">💎 {save.items.diamond ?? 0}/10</div>}
        {h?.mode === 'explore' && <button onClick={() => setPanel('daily')} className={`rounded-full px-3 py-1.5 text-sm font-black border transition ${dailyState.ready ? 'bg-amber-300 text-stone-950 border-amber-100 animate-pulse' : 'bg-slate-900/70 border-white/20 hover:bg-slate-800'}`} title="Today's tasks">Tasks {Math.min(dailyState.index + 1, dailyState.ids.length)}/{dailyState.ids.length}</button>}
        {h?.mode === 'explore' && <button onClick={() => setPanel('adventure')} className="rounded-full px-3 py-1.5 text-sm font-black border border-fuchsia-200/50 bg-fuchsia-700/80 hover:bg-fuchsia-600">🌌 Adventure</button>}
        {h?.mode === 'explore' && !!save.pendingGifts?.length && <button onClick={() => { if (nextGift) dismissedGifts.current.delete(nextGift.id); setGiftOpen(true); }} className="rounded-full px-3 py-1.5 text-sm font-black bg-amber-500/80 border border-amber-200 hover:bg-amber-400 text-stone-950">Gift {save.pendingGifts!.length}</button>}
        {h?.mode === 'explore' && <><button onClick={() => doSave(slot)} className="w-11 h-11 rounded-full bg-sky-500 border-2 border-white text-xl shadow">💾</button>
          <button onClick={() => engS?.toggleFirstPerson()} title="Change camera view" aria-label={h.firstPerson ? 'Use follow camera' : 'See through the player’s eyes'} className={`w-11 h-11 rounded-full border-2 border-white shadow flex flex-col items-center justify-center ${h.firstPerson ? 'bg-amber-500' : 'bg-sky-600'}`}><svg width="21" height="18" viewBox="0 0 24 20" fill="none" stroke="white" strokeWidth="2" aria-hidden="true"><path d="M2 6h4l2-3h8l2 3h4v12H2Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg><span className="text-[8px] leading-none font-black">{h.firstPerson ? '3RD' : 'EYES'}</span></button>
          <button onClick={() => setPanel('menu')} className="w-11 h-11 rounded-full bg-violet-500 border-2 border-white text-xl shadow">☰</button></>}
        {h?.mode === 'fourth' && <button onClick={() => engS?.exitFourth()} className="rounded-full border border-violet-200/50 bg-[#342a4f] px-4 py-2 text-xs font-black hover:bg-[#4e416c]">Return through portal</button>}
      </div>
      {/* quest + team */}
      {h?.mode === 'explore' && <div className="absolute top-44 right-3 w-36 sm:top-20 sm:w-56 space-y-2 pointer-events-none">
        {dailyTask && <div className="bg-slate-900/75 backdrop-blur rounded-xl px-2.5 py-2 border-l-2 border-sky-300 text-xs"><div className="font-black text-sky-200">Today: {dailyTask.title}</div><div className="text-white/65">{dailyState.ready ? 'Done. Open Tasks for the next one.' : `${Math.min(dailyTask.goal, Math.floor(dailyState.progress))}/${dailyTask.goal} ${dailyTask.action === 'move' ? 'm' : ''}`}</div><div className="mt-1 flex items-center justify-between text-[10px] text-amber-200"><span>🔥 Bounty chain</span><b>{dailyState.chain ?? 0} · next bonus at {((Math.floor((dailyState.chain ?? 0) / 3) + 1) * 3)}</b></div></div>}
        {trackedQuest && <div className="bg-slate-900/70 backdrop-blur rounded-2xl p-2 text-xs border-l-4 border-amber-400"><div className="text-amber-300 font-black">⭐ {trackedQuest.name}</div><div className="text-white/90">{trackedQuest.desc}</div></div>}
        {save.request && <div className="bg-slate-900/70 backdrop-blur rounded-2xl p-2 text-xs border-l-4 border-emerald-400"><div className="text-emerald-300 font-black">🧰 Job for {save.request.name}</div><div>Bring {save.request.n} {ITEMS[save.request.item].icon} {ITEMS[save.request.item].name} ({save.items[save.request.item] || 0}/{save.request.n}) → {save.request.reward}🪙</div></div>}
        {h.festivals.length > 0 && <div className="bg-gradient-to-r from-rose-500/80 to-amber-500/80 backdrop-blur rounded-2xl p-2 text-xs border-2 border-white/60 animate-pulse"><div className="font-black">🎉 Festival today!</div><div>{h.festivals.join(', ')}</div></div>}
        {h.bad && <div className="bg-slate-900/80 rounded-2xl p-2 text-center font-black text-lg border-2 border-white">🏸 {h.bad}</div>}
        <div className="flex flex-wrap gap-1 justify-end">{save.team.map(c => <div key={c.uid} className="relative"><Portrait sp={c.sp} size={36} /><div className="absolute -bottom-1 left-0 right-0"><Bar v={c.hp} max={stats(c).hp} color={c.fainted ? '#555' : '#4ade80'} h="h-1" /></div></div>)}</div>
      </div>}
      {h?.mode === 'fourth' && h.dimension && <>
        <div className="absolute left-3 top-3 w-[min(260px,47vw)] rounded-2xl border border-violet-200/35 bg-[#1b1830]/85 p-3 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[.2em] text-violet-200/75 font-bold">Fourth Dimension · No pets</p>
          <h2 className="text-base font-black mt-1">{WEAPONS[h.dimension.weapon].name}</h2>
          <div className="text-[11px] flex justify-between mt-2"><span>Your health</span><span>{Math.ceil(h.dimension.hp)}/{h.dimension.maxHp}</span></div>
          <Bar v={h.dimension.hp} max={h.dimension.maxHp} color="#6fe1c1" h="h-2.5" />
          <div className="text-[11px] flex justify-between mt-2"><span>Energy</span><span>{Math.floor(h.dimension.energy)}/100</span></div>
          <Bar v={h.dimension.energy} max={100} color="#b49ff3" h="h-1.5" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 top-24 sm:top-3 w-[min(340px,58vw)] sm:w-[min(340px,47vw)] rounded-2xl border border-violet-200/35 bg-[#231b38]/85 p-2 text-center">
          <p className="text-[10px] text-violet-200/75 uppercase tracking-widest">Human weapon duel · Wins {h.dimension.wins}</p>
          <p className="text-sm font-black">Dimension Echo · {WEAPONS[h.dimension.foeWeapon].name}</p>
          <Bar v={h.dimension.foeHp} max={h.dimension.foeMax} color="#ec7799" h="h-2.5" />
        </div>
        {showControls && h.dimension.phase === 'duel' && <>
          <div className="absolute bottom-6 left-6" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom left' }}><Joystick eng={engS} /></div>
          <div className="absolute bottom-6 right-6 flex items-end gap-2" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom right' }}>
            <div className="flex flex-col gap-2 items-center">
              <button type="button" onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); engS?.keys.add('__padh_block'); }} onPointerUp={() => engS?.keys.delete('__padh_block')} onPointerCancel={() => engS?.keys.delete('__padh_block')} onLostPointerCapture={() => engS?.keys.delete('__padh_block')} className={`w-16 h-16 rounded-full border-4 border-white font-black shadow-xl touch-none active:scale-95 ${h.dimension.block ? 'bg-sky-400' : 'bg-slate-600'}`}>Block</button>
              <RoundBtn label="↝" sub="Dodge" size={64} onClick={() => engS?.tap('dodge')} color="from-cyan-300 to-sky-600" />
            </div>
            <RoundBtn label="✦" sub="Power" size={72} onClick={() => engS?.tap('heavy')} color="from-violet-300 to-purple-600" />
            <RoundBtn label="⚔" sub="Strike" size={96} onClick={() => engS?.tap('light')} color="from-rose-300 to-red-600" />
          </div>
        </>}
        {h.dimension.phase !== 'duel' && <div className="absolute inset-0 bg-[#101021]/65 flex flex-col items-center justify-center gap-4 text-center px-5">
          <h2 className="text-4xl sm:text-5xl font-black text-amber-100">{h.dimension.phase === 'won' ? 'You won the duel!' : 'You fell in the duel'}</h2>
          <p className="text-white/75 text-sm">{h.dimension.phase === 'won' ? 'Your coins have been saved. Ready for a stronger rival?' : 'Nothing was lost. You can fight again.'}</p>
          <div className="flex gap-3 flex-wrap justify-center"><button onClick={() => engS?.retryFourth()} className="bg-amber-300 text-stone-950 rounded-full px-5 py-2.5 font-black">{h.dimension.phase === 'won' ? 'Next duel' : 'Retry'}</button><button onClick={() => engS?.exitFourth()} className="bg-white/15 rounded-full px-5 py-2.5 font-black">Return to village</button></div>
        </div>}
      </>}
      {h?.bubble && h.mode === 'explore' && <div className="absolute top-[38%] left-1/2 translate-x-6 bg-white text-stone-900 rounded-2xl px-3 py-1 text-sm font-bold shadow-lg pointer-events-none">{h.bubble}</div>}
      {/* explore controls */}
      {h?.mode === 'explore' && showControls && h.flying && <>
        <div className="absolute bottom-6 left-6" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom left' }}><Joystick eng={engS} /><div className="text-center text-xs font-black mt-1 bg-black/40 rounded-full">Steer</div></div>
        <div className="absolute bottom-6 right-6 flex items-end gap-3" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom right' }}>
          <div className="flex flex-col gap-3">
            {(['⬆️', '⬇️'] as const).map((l, i) => <button key={l} onPointerDown={() => { if (engS) engS.climbBtn = i ? -1 : 1; }} onPointerUp={() => { if (engS) engS.climbBtn = 0; }} onPointerLeave={() => { if (engS) engS.climbBtn = 0; }} className="w-20 h-20 rounded-full bg-gradient-to-b from-sky-300 to-blue-600 border-4 border-white text-3xl shadow-xl active:scale-90 touch-none">{l}<div className="text-[9px] font-black">{i ? 'Down' : 'Up'}</div></button>)}
          </div>
          <RoundBtn label="🛬" sub="Land" size={92} onClick={() => engS?.landPlane()} color="from-amber-300 to-orange-600" />
        </div>
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-900/70 rounded-full px-4 py-1 text-sm font-bold">✈️ Height {Math.round(engS?.player.position.y ?? 0)}m · W/S up/down · A/D turn</div>
      </>}
      {h?.mode === 'explore' && showControls && !h.flying && <>
        <div className="absolute bottom-6 left-6 flex items-end gap-4" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom left' }}>
          <Joystick eng={engS} />
          <div className="flex flex-col gap-3 mb-1">
            <RoundBtn label="🏃" sub={h.run ? 'Running' : 'Run'} size={80} onClick={() => { if (engS) { engS.runOn = !engS.runOn; rerender(); } }} color={h.run ? 'from-lime-300 to-emerald-600' : 'from-slate-400 to-slate-600'} />
            <RoundBtn label="🛹" sub={h.skate ? 'Stop' : 'Skate'} size={80} onClick={() => engS?.toggleSkate()} color={h.skate ? 'from-lime-300 to-emerald-600' : 'from-fuchsia-300 to-purple-600'} />
          </div>
        </div>
        <div className="absolute bottom-6 right-6 flex items-end gap-3" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom right' }}>
          {h.prompt && <div className="bg-slate-900/80 rounded-full px-4 py-2 font-bold mb-4 border-2 border-white/40">{h.prompt.replace(/^\S+\s+/, '')}</div>}
          <div className="flex flex-col gap-3">
            {h.ocean && <RoundBtn label="🏄" sub={h.boat ? 'Land' : 'Surf'} size={80} onClick={() => engS?.toggleBoat()} color={h.boat ? 'from-lime-300 to-emerald-600' : 'from-cyan-300 to-blue-600'} />}
            <RoundBtn label="🏠" sub="Home" size={80} onClick={() => engS?.goHome()} color="from-rose-300 to-pink-600" />
            <RoundBtn label="⛺" sub="Camp" size={80} onClick={() => { if (engS?.canCamp()) setCampAsk(true); else engS?.setCamp(); }} color="from-orange-300 to-amber-600" />
          </div>
          <div className="flex flex-col gap-3">
            <RoundBtn label="⬆" sub="Jump" size={76} onClick={() => engS?.tap('jump')} color="from-sky-300 to-blue-600" />
            <RoundBtn label="E" sub={h.prompt ? 'Go!' : ''} size={84} onClick={() => engS?.tap('interact')} color={h.prompt ? 'from-amber-300 to-orange-500' : 'from-slate-400 to-slate-600'} />
          </div>
        </div>
      </>}
      {/* battle HUD */}
      {h?.mode === 'battle' && h.me && h.foe && <>
        {banner && <div className="absolute top-1/3 left-0 right-0 text-center text-6xl font-black italic text-amber-300 animate-pulse pointer-events-none" style={{ textShadow: '0 4px 0 #7c2d12, 0 0 20px #000' }}>VS {banner}</div>}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[420px] max-w-[60vw] bg-slate-900/75 rounded-2xl p-2 border-2 border-rose-400/60">
          <div className="flex items-center gap-2"><Portrait sp={h.foe.sp} size={38} /><div className="flex-1"><div className="flex justify-between text-sm font-black"><span>{h.foe.name} <TypeTag t={h.foe.type} /></span><span>Lv {h.foe.lvl}</span></div>
            <Bar v={h.foe.hp} max={h.foe.max} color={h.foe.hp / h.foe.max < 0.25 ? '#ef4444' : '#f97316'} h="h-3" />
            <div className="flex gap-1 text-[10px] mt-0.5">{h.foe.status.map(s => <span key={s} className="bg-purple-600 px-1.5 rounded-full uppercase">{s}</span>)}{h.trainer && <span className="ml-auto">{'●'.repeat(h.enemyLeft)}</span>}{!h.trainer && h.foe.hp / h.foe.max < 0.35 && <span className="ml-auto text-amber-300 font-black animate-pulse">Catch it now!</span>}</div></div></div></div>
        {h.boss && <>
          <div className="absolute top-[92px] left-1/2 -translate-x-1/2 w-[min(520px,82vw)] rounded-xl border border-fuchsia-200/50 bg-slate-950/90 px-4 py-2 shadow-2xl">
            <div className="flex items-center justify-between gap-2 text-xs font-black tracking-[.18em] text-fuchsia-100"><span>☠ {h.boss.name}</span><span>PHASE {h.boss.phase} / 3</span></div>
            <div className="mt-2 grid grid-cols-3 gap-1 h-2">{[1,2,3].map(n => <div key={n} className={`rounded-full ${n <= h.boss!.phase ? 'bg-gradient-to-r from-fuchsia-400 to-rose-400' : 'bg-white/15'}`} />)}</div>
          </div>
          {h.boss.tell && h.boss.tellT > 0 && <div className="absolute top-[155px] left-1/2 -translate-x-1/2 rounded-full border-2 border-rose-300 bg-rose-950/90 px-6 py-2 text-center text-sm font-black tracking-widest text-rose-100 animate-pulse shadow-xl">⚠ {h.boss.tell} · DODGE!</div>}
          {h.boss.intro && <div className="absolute inset-x-0 top-[34%] text-center pointer-events-none"><div className="inline-block bg-black/65 border-y-2 border-amber-300/80 px-8 py-4"><div className="text-xs font-black tracking-[.45em] text-amber-200">{h.boss.tell === 'VICTORY' ? 'GUARDIAN VANQUISHED' : 'A NEW THREAT EMERGES'}</div><div className="mt-1 text-3xl md:text-5xl font-black italic text-white" style={{textShadow:'0 4px 0 #581c87,0 0 24px #c084fc'}}>{h.boss.tell === 'VICTORY' ? 'VICTORY' : h.boss.name}</div></div></div>}
        </>}
        <div className="absolute left-6 w-72 bg-slate-900/75 rounded-2xl p-3 border-2 border-emerald-400/60" style={{ bottom: 190 * ui, transform: `scale(${ui})`, transformOrigin: 'bottom left' }}>
          <div className="flex items-center gap-2"><Portrait sp={h.me.sp} size={42} /><div className="flex-1"><div className="flex justify-between text-sm font-black"><span>{h.me.name}</span><span>Lv {h.me.lvl}</span></div>
            <Bar v={h.me.hp} max={h.me.max} color="#22c55e" h="h-3" /><div className="mt-1"><Bar v={h.me.en} max={100} color="#38bdf8" /></div>
            <div className="mt-1"><Bar v={h.me.ult} max={100} color={h.me.ult >= 100 ? '#fde047' : '#a16207'} /></div></div></div></div>
        {h.count > -0.7 && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div key={Math.ceil(h.count)} className="font-black italic animate-[pop_.35s_ease-out]" style={{ fontSize: h.count > 0 ? 160 * ui : 110 * ui, color: h.count > 0 ? '#ffffff' : '#ffe066', textShadow: '0 6px 0 #c2410c, 0 0 30px #000' }}>{h.count > 0 ? Math.ceil(h.count) : 'FIGHT!'}</div></div>}
        {showControls && <div className="absolute bottom-6 left-6" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom left' }}><Joystick eng={engS} /></div>}
        {showControls && <div className="absolute bottom-6 right-6 grid grid-cols-[auto_auto_auto] gap-2 items-end" style={{ transform: `scale(${ui})`, transformOrigin: 'bottom right' }}>
          <div className="flex flex-col gap-2 items-center">{h.abilities.map((a, i) => <div key={a.name} className="relative" style={{ opacity: h.me!.en < a.cost ? 0.5 : 1 }}>
            <RoundBtn label={a.key} sub={a.name.split(' ')[0]} size={58} onClick={() => engS?.tap('ab' + (i + 1))} color="from-indigo-400 to-indigo-700" />
            {a.cd > 0 && <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center font-black pointer-events-none">{a.cd.toFixed(0)}</div>}
            <span className="absolute -left-1 -top-1 w-4 h-4 rounded-full border-2 border-white" style={{ background: TYPE_COLORS[a.type] }} /></div>)}</div>
          <div className="flex flex-col gap-2 items-center">
            <RoundBtn label="⭐" sub={h.me.ult >= 100 ? 'SUPER' : `${Math.floor(h.me.ult)}%`} size={58} onClick={() => engS?.tap('ult')} color={h.me.ult >= 100 ? 'from-yellow-300 to-amber-500' : 'from-slate-400 to-slate-600'} />
            <RoundBtn label="💨" sub="Dodge" size={58} onClick={() => engS?.tap('dodge')} color="from-cyan-300 to-sky-600" />
            <RoundBtn label="🔆" sub="Catch" size={58} onClick={() => engS?.tap('capture')} color="from-yellow-300 to-orange-500" />
          </div>
          <div className="flex flex-col gap-2 items-center">
            <div className="flex gap-1"><RoundBtn label="🍊" size={44} onClick={() => engS?.tap('item')} color="from-emerald-300 to-emerald-600" /><RoundBtn label="🔄" size={44} onClick={() => engS?.tap('switch')} color="from-violet-300 to-violet-600" /><RoundBtn label="🏃" size={44} onClick={() => engS?.tap('flee')} color="from-rose-300 to-rose-600" /></div>
            <RoundBtn label="👊" sub="Attack" size={96} onClick={() => engS?.tap('light')} color="from-rose-400 to-red-600" />
          </div>
        </div>}
        {h.capture && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-5xl font-black text-amber-300 tracking-widest pointer-events-none" style={{ textShadow: '0 0 10px #000' }}>{h.capture}</div>}
      </>}
      {/* fade (door) */}
      <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: h?.fade ?? 0 }} />
      {/* toasts */}
      <div className="absolute left-1/2 -translate-x-1/2 top-24 w-80 space-y-1 pointer-events-none flex flex-col items-center">{toasts.map(t => <div key={t.id} className={`bg-gradient-to-r ${tc[t.kind] ?? tc.info} rounded-full px-4 py-1.5 text-sm font-bold shadow-lg border-2 border-white/70 animate-[pop_.25s_ease-out]`}>{t.msg}</div>)}</div>
      {/* dialog */}
      {dialog && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[720px] max-w-[94vw]" onClick={() => (!dialog.choices || dialog.i < dialog.lines.length - 1) && advance()}>
        <div className="inline-block bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black px-5 py-1 rounded-t-2xl ml-6 border-2 border-b-0 border-white">{dialog.name}</div>
        <div className="bg-white/95 text-stone-800 border-4 border-amber-400 rounded-3xl p-5 shadow-2xl">
          <p className="text-lg font-semibold leading-relaxed min-h-[3rem]">{dialog.lines[dialog.i]}</p>
          {dialog.choices && dialog.i === dialog.lines.length - 1 ? <div className="flex gap-2 mt-3">{dialog.choices.map(c => <button key={c.label} className="px-5 py-2 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 text-white font-black border-2 border-white shadow" onClick={() => { setDialog(null); c.fn(); }}>{c.label}</button>)}</div> : <div className="text-right text-amber-500 animate-bounce">▼</div>}
        </div>
      </div>}
      {starterPick && <StarterPick onPick={chooseStarter} />}
      {evo && <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/95 to-black/95 flex flex-col items-center justify-center gap-4">
        <div className="text-3xl font-black text-amber-300 animate-pulse">{evo.c.nick} is growing up!</div>
        <EvoAnim from={evo.from} to={evo.to} onDone={cancel => { const en = eng.current!; if (!cancel) { en.completeEvolution(evo.c, evo.to); toast(`It became ${SPECIES[evo.to].name}!`, 'good'); } setEvo(null); }} />
      </div>}
      {panel === 'book' && <Book onClose={() => setPanel(null)} />}
      {giftOpen && nextGift && !worldLoad && <GiftOpening key={nextGift.id} gift={nextGift} reduced={settings.reduceMotion}
        onLater={() => { dismissedGifts.current.add(nextGift.id); setGiftOpen(false); }}
        onClaim={id => { const claimed = claimTrainerGift(save, id); if (!claimed) return; dismissedGifts.current.delete(id); setGiftOpen(false); sfx('coin'); toast(`Gift from ${claimed.sourceName} added to your bag!`, 'good'); doSave(0, true); rerender(); }} />}
      {campAsk && <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setCampAsk(false)}>
        <div className="bg-slate-900/95 border-4 border-amber-400 rounded-3xl p-5 w-full max-w-md text-center space-y-3">
          <h2 className="text-2xl font-black">⛺ Make a camp</h2>
          <p className="text-white/80 text-sm">Do you want a wooden fence around your camp? Wild pets can't attack you inside it.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setCampAsk(false); engS?.setCamp(false); }} className="rounded-2xl bg-white/10 hover:bg-white/20 p-4 font-black"><div className="text-4xl">⛺</div>Tent only</button>
            <button onClick={() => { setCampAsk(false); engS?.setCamp(true); }} className="rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 p-4 font-black border-2 border-white"><div className="text-4xl">⛺🪵</div>Tent + Fence</button>
          </div>
          <button onClick={() => setCampAsk(false)} className="text-white/60 text-sm">Cancel</button>
        </div></div>}
      {panel && panel !== 'book' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-3" onClick={ev => ev.target === ev.currentTarget && setPanel(null)}>
        <div className="bg-slate-900/95 border-2 border-white/20 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-auto p-4">
          {panel === 'menu' && <>
            <div className="flex flex-wrap gap-1 mb-3 items-center">{[['Team', '🐾'], ['Growth', '✦'], ['Social', '⇄'], ['Adventure', '🌌'], ['Today', '*'], ['Bag', '🎒'], ['Quests', '⭐'], ['Map', '🗺️'], ['Cards', '🃏'], ['Pets', '📖'], ['Awards', '🏆'], ['Style', '👕'], ['Save', '💾'], ['Load', '📂'], ['Options', '⚙️']].map(([t, i]) => <Btn key={t} kind={menuTab === t ? 'p' : 's'} onClick={() => { setMenuTab(t); if (t === 'Bag') e?.tut(11); if (t === 'Quests') e?.tut(13); if (t === 'Map') e?.tut(12); }}>{i} {t}</Btn>)}<div className="ml-auto flex gap-1"><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn><Btn kind="d" onClick={quit}>Lobby</Btn></div></div>
            {menuTab === 'Team' && <TeamPanel save={save} act={act} />}{menuTab === 'Growth' && <WorldSystemsPanel save={save} onChange={() => { dirty.current = true; doSave(0, true); rerender(); toast('Progression saved.', 'good'); }} onStartArena={(uids, rival) => { setPanel(null); setTimeout(() => eng.current?.startLeagueBattle(uids, rival), 100); }} />}{menuTab === 'Social' && <LocalTradePanel save={save} slot={slot} onSaved={() => { dirty.current = false; rerender(); toast('Both trainer saves updated.', 'good'); }} />}{menuTab === 'Adventure' && <AdventurePanel save={save} adventure={adventure} onClose={() => setPanel(null)} onEvent={() => { if (!worldEvent) return; save.money += worldEvent.reward; save.items.lumenpod = (save.items.lumenpod || 0) + 1; adventure.eventAt = Date.now(); adventure.eventId = worldEvent.id; toast(`${worldEvent.title} complete! +${worldEvent.reward} coins and 1 Lumenpod.`, 'good'); setWorldEvent(null); doSave(0, true); rerender(); }} onDiscover={id => { if (adventure.discoveries.includes(id)) return; adventure.discoveries.push(id); save.money += 140; save.items.diamond = (save.items.diamond || 0) + 1; toast('Secret discovered! +140 coins and a Portal Diamond.', 'good'); doSave(0, true); rerender(); }} onRare={() => { if (save.team.length >= 8) { toast('Your team is full. Store a creature first.', 'bad'); return; } const rare = makeCreature('frostnib', 14); rare.friend = 35; save.team.push(rare); save.caught.push('frostnib'); save.seen.push('frostnib'); save.stats.captures++; toast('A rare Frostnib joined your team!', 'card'); doSave(0, true); rerender(); }} onBoss={id => { if (!save.team.length) { toast('Choose a starter first.', 'bad'); return; } if (eng.current?.battle) return; setPanel(null); setTimeout(() => eng.current?.startTrainer(id), 80); }} onQuest={() => { if (adventure.chapter < 5) { adventure.chapter++; save.money += 100 + adventure.chapter * 35; save.items.sunberry = (save.items.sunberry || 0) + 2; toast(`Chapter ${adventure.chapter} complete! Story clue unlocked.`, 'good'); doSave(0, true); rerender(); } }} onResonate={c => { if ((adventure.resonance[c.uid] || 0) >= 3) return; adventure.resonance[c.uid] = (adventure.resonance[c.uid] || 0) + 1; c.friend = Math.min(100, c.friend + 18); c.xp += 35; toast(`${c.nick} gained a Resonance ability tier!`, 'card'); eng.current?.checkEvos(); doSave(0, true); rerender(); }} />}{menuTab === 'Bag' && <ItemsPanel save={save} act={act} />}{menuTab === 'Quests' && <QuestPanel save={save} />}
            {menuTab === 'Today' && <DailyPanel save={save} reduced={settings.reduceMotion} onClose={() => setPanel(null)} onNext={() => { if (e?.battle) { toast('Finish the fight first.', 'info'); return; } if (nextDaily(save)) { sfx('task'); doSave(0, true); rerender(); } }} />}
            {menuTab === 'Map' && <MapPanel save={save} pos={mapPos} target={engS?.guideTarget} inBattle={!!e?.battle || !!e?.indoor} travel={(x, z) => { e?.teleport(x, z); setPanel(null); }} />}
            {menuTab === 'Cards' && <CardsPanel save={save} />}{menuTab === 'Pets' && <Dex save={save} />}{menuTab === 'Awards' && <AchPanel save={save} />}
            {menuTab === 'Style' && <Wardrobe save={save} onChange={() => { e?.rebuildPlayer(); rerender(); }} />}
            {menuTab === 'Save' && (e?.battle ? <p>Can't save in a fight.</p> : <SlotList mode="save" current={save} onPick={manualSave} />)}
            {menuTab === 'Load' && <SlotList mode="load" onPick={s => { const d = readSave(s); if (d && (!dirty.current || confirm('Load this save? Unsaved things will be lost.'))) onLoad(d, s === 0 ? slot : s); }} />}
            {menuTab === 'Options' && <SettingsPanel s={settings} set={setSettings} save={save} setDiff={d => { save.difficulty = d; rerender(); }} />}
          </>}
          {panel === 'map' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">🗺️ Map</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><MapPanel save={save} pos={mapPos} target={engS?.guideTarget} inBattle={!!e?.battle || !!e?.indoor} travel={(x, z) => { e?.teleport(x, z); setPanel(null); }} /></>}
          {panel === 'guide' && <><div className="flex justify-between mb-3"><h2 className="text-2xl font-black">💬 World Guide</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div>
            <GuidePanel position={mapPos} onMark={target => { if (eng.current) eng.current.guideTarget = { name: target.name, x: target.x, z: target.z }; setPanel(null); }} onClose={() => setPanel(null)} />
          </>}
          {panel === 'portal' && <PortalPanel awakened={!!save.flags.portalAwake} diamonds={save.items.diamond || 0}
            onAwaken={() => { const ok = eng.current?.activatePortal() ?? false; rerender(); return ok; }}
            onEnter={() => { if (!eng.current?.enterFourthLobby()) { toast('Stand by the portal to enter.', 'bad'); return; } setPanel('weapon'); }}
            onClose={() => setPanel(null)} />}
          {panel === 'weapon' && <WeaponPanel onChoose={weapon => { if (eng.current?.startFourthDuel(weapon)) setPanel(null); }} onExit={() => { eng.current?.exitFourth(); setPanel(null); }} />}
          {panel === 'daily' && <DailyPanel save={save} reduced={settings.reduceMotion} onClose={() => setPanel(null)} onNext={() => { if (nextDaily(save)) { sfx('task'); doSave(0, true); rerender(); } }} />}
          {panel === 'study' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">📚 Class time!</h2><Btn kind="s" onClick={() => { setPanel(null); eng.current?.endActivity(); }}>✕</Btn></div><StudyPanel onDone={score => { setPanel(null); const en = eng.current!; save.money += score * 15; if (score > 0) en.awardXp(score * 25, new Set(save.team.map(c => c.uid))); toast(`Class finished! +${score * 15} coins`, 'good'); sfx('level'); en.endActivity(); rerender(); }} /></>}
          {panel === 'cook' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">🍳 Cooking</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><CookPanel save={save} onCook={id => { setPanel(null); setTimeout(() => eng.current?.cook(id), 50); }} /></>}
          {panel === 'food' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">🏮 Chef Miko's Food Shop</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><FoodMenu save={save} onOrder={(id, eat) => { const it = ITEMS[id]; if (save.money < it.price) return; save.money -= it.price; sfx('coin'); eng.current?.daily('buy');
            if (eat) { save.team.forEach(c => { if (it.kind === 'heal') { c.fainted = false; c.hp = Math.min(stats(c).hp, Math.round(c.hp + stats(c).hp * it.value)); } eng.current?.friend(c, it.kind === 'friend' ? it.value : 1); }); eng.current?.refreshPartner(); toast(`Yummy ${it.name}! ${it.icon} Your team feels great!`, 'good'); setPanel(null); const lead = save.team[0]; if (lead) setTimeout(() => eng.current?.react(lead, 'feed'), 80); }
            else { save.items[id] = (save.items[id] || 0) + 1; toast(`${it.name} added to your bag!`, 'good'); } rerender(); }} /></>}
          {panel === 'chat' && chatWith && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">💬 Talking with {chatWith.name}</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><ChatPanel name={chatWith.name} first={chatWith.first} onClose={() => setPanel(null)} /></>}
          {panel === 'plane' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">✈️ Airport</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><PlanePanel save={save} onFly={(i, dest) => { setPanel(null); setTimeout(() => eng.current?.startFlight(i, dest), 60); }} /></>}
          {panel === 'shop' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">🛒 Tova's Shop</h2><Btn kind="s" onClick={() => setPanel(null)}>✕</Btn></div><ShopPanel save={save} act={act} /></>}
          {panel === 'home' && <><div className="flex justify-between mb-2"><h2 className="text-2xl font-black">🏠 My Home</h2><Btn kind="s" onClick={() => { setPanel(null); playMusic('home'); }}>✕</Btn></div><HomePanel save={save} act={act} /></>}
        </div></div>}
      {worldEvent && !panel && !dialog && !worldLoad && <div className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-3xl border-2 border-fuchsia-200/60 bg-slate-950/95 p-6 text-center shadow-2xl"><div className="text-5xl">{worldEvent.icon}</div><h2 className="mt-3 text-2xl font-black text-amber-200">{worldEvent.title}</h2><p className="mt-2 text-white/75">{worldEvent.text}</p><p className="mt-3 font-black text-emerald-300">Reward: {worldEvent.reward} coins + 1 Lumenpod</p><button className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 p-3 font-black" onClick={() => { save.money += worldEvent.reward; save.items.lumenpod = (save.items.lumenpod || 0) + 1; adventure.eventAt = Date.now(); adventure.eventId = worldEvent.id; toast(`${worldEvent.title} reward claimed!`, 'good'); setWorldEvent(null); doSave(0, true); rerender(); }}>CLAIM DISCOVERY</button><button className="mt-2 text-sm text-white/60" onClick={() => { adventure.eventAt = Date.now(); setWorldEvent(null); }}>Leave it for now</button></div></div>}
      {worldLoad && <WorldLoading progress={worldLoad.progress} label={worldLoad.label} reduced={settings.reduceMotion} />}
      {worldError && <div className="fixed inset-0 z-50 bg-[#0a1b2a] text-white flex flex-col items-center justify-center px-5 text-center"><h2 className="text-3xl font-black">The world could not open</h2><p className="mt-3 text-white/70 max-w-sm">{worldError}</p><button onClick={onQuit} className="mt-8 bg-amber-300 text-stone-950 font-bold px-5 py-2 rounded-full">Return to lobby</button></div>}
    </div>
  );
}

function StarterPick({ onPick }: { onPick: (sp: string) => void }) {
  const [sel, setSel] = useState(STARTERS[0]); const s = SPECIES[sel];
  return <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-3">
    <img src={BG} className="absolute inset-0 w-full h-full object-cover blur-[2px]" alt="" /><div className="absolute inset-0 bg-slate-900/40" />
    <h2 className="relative text-4xl font-black italic" style={{ textShadow: '0 3px 0 #7c2d12' }}>Pick Your Pet!</h2>
    <div className="relative flex gap-2 flex-wrap justify-center">{STARTERS.map(id => <button key={id} onClick={() => { setSel(id); sfx('ui'); }} className={`p-2 rounded-2xl flex flex-col items-center w-24 border-2 transition ${sel === id ? 'bg-amber-400/50 border-white scale-110' : 'bg-slate-900/60 border-transparent'}`}><Portrait sp={id} size={46} /><span className="text-xs font-black mt-1">{SPECIES[id].name}</span><TypeTag t={SPECIES[id].type} /></button>)}</div>
    <div className="relative flex gap-6 items-center bg-slate-900/70 rounded-3xl p-4 max-w-3xl flex-col md:flex-row border-2 border-white/30">
      <Preview sp={sel} size={260} spin={false} />
      <div className="space-y-2 max-w-sm"><h3 className="text-3xl font-black">{s.name} <TypeTag t={s.type} /></h3><p className="text-white/90">{s.lore.split('.')[0]}.</p>
        <button className="w-full py-3 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 border-4 border-white text-xl font-black italic" onClick={() => onPick(sel)}>Choose {s.name}!</button></div>
    </div></div>;
}

function EvoAnim({ from, to, onDone }: { from: string; to: string; onDone: (cancel: boolean) => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { const t1 = setTimeout(() => setPhase(1), 2200); const t2 = setTimeout(() => setPhase(2), 2600); return () => { clearTimeout(t1); clearTimeout(t2); }; }, []);
  return <div className="flex flex-col items-center gap-3">
    <div className={phase === 0 ? 'animate-pulse' : ''} style={{ filter: phase === 0 ? 'brightness(3) saturate(0)' : undefined, transition: 'filter .4s' }}><Preview sp={phase < 1 ? from : to} size={300} glow={phase === 1} /></div>
    {phase < 2 ? <Btn kind="s" onClick={() => onDone(true)}>Stop</Btn> : <><div className="text-2xl font-black">{SPECIES[from].name} → {SPECIES[to].name}!</div><Btn onClick={() => onDone(false)}>Yay! 🎉</Btn></>}
  </div>;
}

function Wardrobe({ save, onChange }: { save: SaveData; onChange: () => void }) {
  const set = (k: keyof Look, v: string) => { (save.look as unknown as Record<string, string>)[k] = v; onChange(); };
  return <div className="grid md:grid-cols-[300px_1fr] gap-4"><div className="bg-gradient-to-b from-sky-300/30 to-emerald-300/20 rounded-3xl flex justify-center"><Preview look={save.look} size={280} h={420} /></div>
    <div className="space-y-3 text-sm">
      <div><b>Outfits</b><div className="flex flex-wrap gap-1 mt-1">{CHAR_PRESETS.map((p, i) => <Btn key={p.name} kind="s" onClick={() => { Object.assign(save.look, { top: p.top, bottom: p.bottom, shoes: p.shoes, preset: i }); onChange(); }}>{p.name}</Btn>)}</div></div>
      <div className="flex gap-2"><Btn kind={save.look.body !== 'female' ? 'p' : 's'} onClick={() => set('body', 'male')}>👦 Boy</Btn><Btn kind={save.look.body === 'female' ? 'p' : 's'} onClick={() => set('body', 'female')}>👧 Girl</Btn></div>
      <div><b>Hair</b><div className="flex flex-wrap gap-1 mt-1">{HAIR_STYLES.map(x => <Btn key={x} kind={save.look.hair === x ? 'p' : 's'} onClick={() => set('hair', x)}>{x}</Btn>)}</div></div>

      <div><b>Extra</b><div className="flex flex-wrap gap-1 mt-1">{ACCESSORIES.map(x => <Btn key={x} kind={save.look.acc === x ? 'p' : 's'} onClick={() => set('acc', x)}>{x}</Btn>)}</div></div>
      <div><b>Bag</b><div className="flex flex-wrap gap-1 mt-1">{PACKS.map(x => <Btn key={x} kind={save.look.pack === x ? 'p' : 's'} onClick={() => set('pack', x)}>{x}</Btn>)}</div></div>
      <div className="flex gap-3">{([['hairColor', 'Hair'], ['top', 'Shirt'], ['bottom', 'Pants'], ['shoes', 'Shoes']] as const).map(([k, l]) => <label key={k} className="flex flex-col text-xs items-center">{l}<input type="color" value={save.look[k]} onChange={e => set(k, e.target.value)} className="w-10 h-10" /></label>)}</div>
      <p className="text-xs text-white/60">Dance moves: keys 5, 6, 7, 8</p>
    </div></div>;
}
