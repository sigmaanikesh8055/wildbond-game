import { useEffect, useState } from 'react';
import { SPECIES, TYPE_COLORS } from '../game/data';
import { makeCreature, stats, type CreatureInst, type SaveData } from '../game/state';
import { Portrait } from './Panels';
import { Preview } from './Preview';

type Tab = 'breeding' | 'arena' | 'skills' | 'depths' | 'climate' | 'homestead' | 'guardians' | 'survival' | 'legacy';
const tabs: [Tab,string][] = [['breeding','Breeding Lab'],['arena','3v3 Arena'],['skills','Skill Trees'],['depths','Deepwild'],['climate','Climate'],['homestead','Homestead'],['guardians','World Guardians'],['survival','Survival & Craft'],['legacy','Endgame']];
const panel = 'rounded-2xl border border-white/10 bg-slate-950/55 p-3';
const btn = 'rounded-xl px-3 py-2 text-xs font-black border border-white/15 bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:cursor-not-allowed';
const owned = (s: SaveData) => [...s.team, ...s.storage];
function systems(s: SaveData) {
  s.worldSystems ??= { eggs: [], skills: {}, explored: [], climateClaim: '', homeBuilds: [], rankXp: 0, bossClaims: [], recipes: [] };
  return s.worldSystems;
}
function persist(s: SaveData, changed: () => void) { s.savedAt = Date.now(); changed(); }
function getParent(s: SaveData, uid: string) { return owned(s).find(c => c.uid === uid); }
function typeOf(c: CreatureInst) { return SPECIES[c.sp]?.type ?? 'aether'; }

export function WorldSystemsPanel({ save, onChange, onStartArena }: { save: SaveData; onChange: () => void; onStartArena: (uids: string[], rival: string) => void }) {
  const [tab,setTab] = useState<Tab>('breeding'); const [,tick] = useState(0);
  useEffect(()=>{const timer=window.setInterval(()=>tick(v=>v+1),1000);return()=>window.clearInterval(timer);},[]);
  const [p1,setP1] = useState(''); const [p2,setP2] = useState('');
  const [arenaTeam,setArenaTeam] = useState<string[]>(save.team.slice(0,3).map(c=>c.uid));
  const [enemy,setEnemy] = useState('Gloam'); const [arenaLog,setArenaLog] = useState<string[]>([]);
  const [selected,setSelected] = useState(save.team[0]?.uid ?? '');
  const [depth,setDepth] = useState('Mosslight Galleries');
  const ws = systems(save); const creatures = owned(save);
  const change = () => persist(save,onChange);
  const active = creatures.find(c=>c.uid===selected) ?? creatures[0];
  const skillDefs = [
    {id:'vitality',name:'Vitality Core',desc:'+8% maximum health per rank',max:3},
    {id:'force',name:'Power Circuit',desc:'+6% attack per rank',max:3},
    {id:'guard',name:'Guardian Hide',desc:'+7% defence per rank',max:3},
    {id:'agility',name:'Swift Current',desc:'+7% speed per rank',max:3},
    {id:'focus',name:'Elemental Focus',desc:'+8% special power per rank',max:3},
  ];
  const depths = [
    {name:'Mosslight Galleries',need:0,desc:'Glowing moss tunnels just inside Whisper Cave. A gentle first expedition.'},
    {name:'Sunken Archive',need:1,desc:'A drowned library with ruined towers and an underground lake.'},
    {name:'Hollow Cathedral',need:2,desc:'A buried temple of towering pillars and a sealed altar.'},
    {name:'Abyssal Orchard',need:3,desc:'A luminous fungal woodland deep beneath the valley.'},
    {name:'Crown Below',need:4,desc:'The sealed vault, gate and treasure chest at the bottom of the Deepwild.'},
  ];
  const climates: [string,string][] = [
    ['Clear Skies','Calm field conditions. Good for travel, fishing and ordinary encounters.'],
    ['Rain','Fire-types shelter from the wet; water-types and jungle creatures roam more. Forest guardians stir at dawn.'],
    ['Thunderstorm','Electric creatures surge with energy while shy creatures hide. Desert guardians may appear near sunset.'],
    ['Snow','Cold air slows many creatures. Frostcrown stirs on snowy nights.'],
    ['Sandstorm / Wind','Gusts carry flying creatures through mountains and deserts. Poor visibility.'],
    ['Fog','Low visibility; shadow creatures and secrets are easier to stumble on.'],
  ];
  const climateIdx = save.weather==='Rain'?1:save.weather==='Storm'?2:save.weather==='Snow'?3:save.weather==='Wind'?4:save.weather==='Fog'?5:0;
  const currentClimate = climates[climateIdx];
  const skillRank = (c: CreatureInst,id:string) => c.skills?.[id] ?? 0;
  const points = (c:CreatureInst) => Math.max(0,Math.floor((c.lvl-1)/5)-Object.values(c.skills??{}).reduce((a,b)=>a+b,0));
  const breed = () => {
    const a=getParent(save,p1), b=getParent(save,p2);
    if(!a||!b||a.uid===b.uid||save.money<250) return;
    if((a.fainted||b.fainted)||a.friend<25||b.friend<25) return;
    const at=typeOf(a), bt=typeOf(b);
    const candidates=Object.values(SPECIES).filter(x=>x.type===at||x.type===bt).filter(x=>!x.evolvesTo || x.rarity<=3);
    const chosen=candidates[Math.floor(Math.random()*candidates.length)] ?? SPECIES[a.sp];
    const mutationRoll=Math.random(); const mutation=mutationRoll<0.006?'Prismatic':mutationRoll<0.035?'Ancient':mutationRoll<0.175?'Chromatic':'Standard';
    const baby=makeCreature(chosen.id,Math.max(1,Math.floor((a.lvl+b.lvl)/4)));
    baby.nick=chosen.name+'ling'; baby.friend=35;
    baby.genes={parents:[a.sp,b.sp], inheritedType:Math.random()<.5?at:bt, palette:mutation==='Prismatic'?'Prismatic':mutation==='Ancient'?'Ancient':mutation==='Chromatic'?'Chromatic':'Natural', mutation, inheritedAbility:[...(SPECIES[a.sp]?.abilities??[]),...(SPECIES[b.sp]?.abilities??[])][Math.floor(Math.random()*((SPECIES[a.sp]?.abilities.length??1)+(SPECIES[b.sp]?.abilities.length??1)))]};
    baby.incubationUntil=Date.now()+120000;
    ws.eggs.push(baby); save.money-=250; a.friend=Math.min(100,a.friend+4); b.friend=Math.min(100,b.friend+4); setP1('');setP2(''); change();
  };
  const hatch = (uid:string) => {
    const i=ws.eggs.findIndex(c=>c.uid===uid); if(i<0||Date.now()<(ws.eggs[i].incubationUntil??0)||creatures.length>=40) return;
    const baby=ws.eggs.splice(i,1)[0]; baby.caughtAt=new Date().toISOString();
    if(save.team.length<8) save.team.push(baby); else save.storage.push(baby);
    save.caught.push(baby.sp); save.seen.push(baby.sp); save.stats.captures++; change();
  };
  const train = (c:CreatureInst,id:string) => { const def=skillDefs.find(x=>x.id===id)!; if(points(c)<=0||skillRank(c,id)>=def.max)return; c.skills={...(c.skills??{}),[id]:skillRank(c,id)+1}; change(); };
  const runArena = () => {
    const team=arenaTeam.map(getParent.bind(null,save)).filter(Boolean) as CreatureInst[];
    if(team.length!==3||team.some(c=>c.fainted||c.hp<=0)){setArenaLog(['Choose exactly three healthy creatures from your active team.']);return;}
    setArenaLog([`Entering the 3D arena: ${team.map(c=>c.nick).join(' · ')} vs ${enemy}.`, 'Battle takes place in the live world engine. Move, dodge, block, attack and switch fighters during combat.']);
    onStartArena(team.map(c=>c.uid),enemy);
  };
  const exploreDepth=()=>{const d=depths.find(x=>x.name===depth)!;if(ws.explored.includes(d.name)||ws.explored.length<d.need)return;ws.explored.push(d.name);save.money+=90+d.need*20;save.items.diamond=(save.items.diamond??0)+1;save.items.sunberry=(save.items.sunberry??0)+2;change();};
  const build=(id:string,cost:number)=>{if(save.money<cost||ws.homeBuilds.includes(id))return;save.money-=cost;ws.homeBuilds.push(id);save.home.level++;change();};
  const craft=(id:string,needs:Record<string,number>,out:string)=>{if(Object.entries(needs).some(([k,n])=>(save.items[k]??0)<n))return;Object.entries(needs).forEach(([k,n])=>save.items[k]-=n);save.items[out]=(save.items[out]??0)+1;ws.recipes.push(id);change();};
  const guardianList=[
    {name:'Verdant Matriarch',where:'Old-growth forest',when:'Rain · Dawn',type:'nature',reward:'Verdant Crest'},
    {name:'Sirocco Titan',where:'Glass Dunes',when:'Storm or strong wind · Sunset',type:'earth',reward:'Titan Core'},
    {name:'Frostcrown Wyrm',where:'Northpeak Glacier',when:'Snow · Night',type:'ice',reward:'Frostcrown Scale'},
    {name:'Nerath, the Deep Coil',where:'Crown Below',when:'Underground · Deep level',type:'shadow',reward:'Abyssal Pearl'},
    {name:'Zephyr Leviathan',where:'Skybreak Isles',when:'Storm · Day',type:'wind',reward:'Skyheart Feather'},
  ];
  const rank=Math.floor(ws.rankXp/500)+1;
  return <div className="space-y-3 text-white">
    <div className="flex flex-wrap gap-1">{tabs.map(([id,label])=><button key={id} className={`${btn} ${tab===id?'bg-amber-300 text-slate-950 border-amber-100':'text-white'}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==='breeding'&&<div className="space-y-3"><div className={panel}><h3 className="text-lg font-black">Creature Breeding & Genetics</h3><p className="text-xs text-white/60">Pair two healthy, bonded creatures. Offspring species are drawn from either parent's elemental family. Mutation odds: Chromatic 14%, Ancient 2.9%, Prismatic 0.6%.</p><div className="grid sm:grid-cols-2 gap-2 mt-3">{[[p1,setP1,'Parent A'],[p2,setP2,'Parent B']].map(([v,set,label]:any)=><label key={label} className="text-xs font-bold">{label}<select value={v} onChange={e=>set(e.target.value)} className="block w-full mt-1 rounded-lg bg-slate-800 p-2">{[<option key="" value="">Choose creature</option>,...creatures.map(c=><option key={c.uid} value={c.uid}>{c.nick} · {SPECIES[c.sp]?.type} · Bond {c.friend}</option>)]}</select></label>)}</div><button className={`${btn} mt-3 bg-amber-300 text-slate-950`} disabled={!p1||!p2||p1===p2||save.money<250||!getParent(save,p1)||!getParent(save,p2)||getParent(save,p1)!.friend<25||getParent(save,p2)!.friend<25} onClick={breed}>Create egg · 250 ◈</button><p className="text-[11px] text-white/50 mt-2">Parents are not consumed. Eggs incubate for two real minutes. Eggs and genetics persist in your save.</p></div><div className={panel}><h4 className="font-black">Incubator · {ws.eggs.length} egg(s)</h4>{ws.eggs.length===0?<p className="text-xs text-white/50 mt-2">No eggs yet. Choose two bonded creatures above.</p>:<div className="grid sm:grid-cols-2 gap-2 mt-2">{ws.eggs.map(c=><div key={c.uid} className="rounded-xl bg-white/5 p-3 flex gap-3 items-center"><Portrait sp={c.sp} size={54}/><div className="min-w-0 flex-1"><b>{SPECIES[c.sp]?.name} Egg</b><p className="text-[11px] text-white/60">{c.genes?.mutation} · {c.genes?.palette} genes</p><p className="text-[10px] text-white/50">{Math.max(0,Math.ceil(((c.incubationUntil??0)-Date.now())/1000))}s remaining</p></div><button className={btn} disabled={Date.now()<(c.incubationUntil??0)} onClick={()=>hatch(c.uid)}>Hatch</button></div>)}</div>}</div></div>}
    {tab==='arena'&&<div className="grid lg:grid-cols-[1fr_1fr] gap-3"><div className={panel}><h3 className="font-black text-lg">Ember League · 3 vs 3</h3><p className="text-xs text-white/60">Choose three healthy creatures and a rival. The match now runs in the actual 3D combat engine: move, dodge, block, use abilities and switch between your three fighters.</p><label className="block text-xs mt-3">Rival<select className="block w-full bg-slate-800 p-2 rounded-lg mt-1" value={enemy} onChange={e=>setEnemy(e.target.value)}>{['Gloam','Auralis','Desert Titan','Sky Leviathan'].map(x=><option key={x}>{x}</option>)}</select></label><div className="space-y-2 mt-3">{[0,1,2].map(i=><label key={i} className="block text-xs">Fighter {i+1}<select className="block w-full bg-slate-800 p-2 rounded-lg mt-1" value={arenaTeam[i]??''} onChange={e=>{const uid=e.target.value;setArenaTeam(a=>{const n=[...a];n[i]=uid;return n;});}}><option value="">Select fighter</option>{save.team.map(c=><option key={c.uid} value={c.uid} disabled={arenaTeam.some((u,j)=>u===c.uid&&j!==i)}>{c.nick} · Lv {c.lvl}{c.fainted?' · Fainted':''}</option>)}</select></label>)}</div><button className={`${btn} mt-3 bg-amber-300 text-slate-950`} onClick={runArena}>Enter 3D real-time match</button><div className="mt-3 text-xs text-white/60">League Rank <b className="text-amber-200">{rank}</b> · {ws.rankXp%500}/500 XP · Wins {save.stats.wins}</div></div><div className={panel}><h4 className="font-black">Battle report</h4>{arenaLog.length?<div className="space-y-1 mt-2 text-xs">{arenaLog.map((x,i)=><p key={i} className={i===0?'text-amber-200 font-bold':'text-white/75'}>{x}</p>)}</div>:<p className="text-xs text-white/50 mt-2">Your match report will appear here.</p>}<div className="mt-3 grid grid-cols-3 gap-2">{save.team.slice(0,3).map(c=><div className="bg-white/5 rounded-lg p-2 text-center" key={c.uid}><Portrait sp={c.sp} size={48}/><p className="text-[10px]">{c.nick}</p><p className="text-[10px] text-white/50">{c.hp}/{stats(c).hp} HP</p></div>)}</div></div></div>}
    {tab==='skills'&&<div className="space-y-3"><div className={panel}><h3 className="font-black text-lg">Creature Mastery Trees</h3><p className="text-xs text-white/60">Every five levels grants one skill point. Choose a build per creature; bonuses affect its battle stats.</p><select className="mt-2 w-full sm:w-auto bg-slate-800 rounded-lg p-2" value={active?.uid??''} onChange={e=>setSelected(e.target.value)}>{creatures.map(c=><option key={c.uid} value={c.uid}>{c.nick} · Lv {c.lvl}</option>)}</select>{active&&<div className="mt-3 grid md:grid-cols-2 gap-2"><div className="rounded-xl bg-white/5 p-3 flex gap-3 items-center"><Preview sp={active.sp} size={110} h={120}/><div><b>{active.nick}</b><p className="text-xs text-white/60">{SPECIES[active.sp]?.type} · {active.lvl} · {points(active)} unspent points</p><p className="text-xs text-amber-200">HP {stats(active).hp} · ATK {stats(active).atk} · DEF {stats(active).def} · SPD {stats(active).spd}</p></div></div>{skillDefs.map(d=><div key={d.id} className="rounded-xl bg-white/5 p-3"><div className="flex justify-between"><b className="text-sm">{d.name}</b><b className="text-amber-200">{skillRank(active,d.id)}/{d.max}</b></div><p className="text-[11px] text-white/55">{d.desc}</p><button className={`${btn} mt-2`} disabled={points(active)<=0||skillRank(active,d.id)>=d.max} onClick={()=>train(active,d.id)}>Unlock rank</button></div>)}</div>}</div></div>}
    {tab==='depths'&&<div className="space-y-3"><div className={panel}><h3 className="text-lg font-black">The Deepwild · Beneath Embervale</h3><p className="text-xs text-white/60">A multi-layer underground expedition chain: drowned archive, buried temple, fungal woodland and sealed abyss. Discoveries unlock deeper routes; each site gives resources once.</p><div className="grid md:grid-cols-2 gap-2 mt-3">{depths.map((d,i)=><button key={d.name} onClick={()=>setDepth(d.name)} className={`text-left rounded-xl p-3 border ${depth===d.name?'border-cyan-300 bg-cyan-500/10':'border-white/10 bg-white/5'}`}><div className="flex justify-between"><b>{String(i+1).padStart(2,'0')} · {d.name}</b><span className="text-[10px] text-cyan-200">{ws.explored.includes(d.name)?'CLEARED':ws.explored.length>=d.need?'AVAILABLE':`NEED ${d.need} DISCOVERIES`}</span></div><p className="text-xs text-white/55 mt-1">{d.desc}</p></button>)}</div><button className={`${btn} mt-3 bg-cyan-300 text-slate-950`} disabled={ws.explored.includes(depth)||ws.explored.length<(depths.find(x=>x.name===depth)?.need??0)} onClick={exploreDepth}>Explore selected site</button><p className="text-[10px] text-emerald-200/70 mt-2">These expedition zones now exist as connected 3D spaces inside Whisper Cave. Walk deeper to discover each region and the Crown Below treasure vault.</p></div></div>}
    {tab==='climate'&&<div className={panel}><h3 className="font-black text-lg">Living Climate & Seasonal Field Guide</h3><p className="text-xs text-white/60">The current game clock selects the active field condition. Use it to plan encounters and prepare your team.</p><div className="rounded-xl p-4 mt-3 bg-gradient-to-r from-sky-900/60 to-indigo-900/60"><p className="text-[10px] tracking-widest text-cyan-200">CURRENT FIELD CONDITION</p><h4 className="text-2xl font-black">{currentClimate[0]}</h4><p className="text-sm text-white/75">{currentClimate[1]}</p><p className="text-xs text-white/50 mt-2">Day {save.day} · {String(Math.floor(save.time)).padStart(2,'0')}:00 · {save.weather}</p></div><div className="grid sm:grid-cols-2 gap-2 mt-3">{climates.map(([n,d])=><div key={n} className="rounded-lg bg-white/5 p-2"><b className="text-sm">{n}</b><p className="text-xs text-white/55">{d}</p></div>)}</div></div>}
    {tab==='homestead'&&<div className="space-y-3"><div className={panel}><h3 className="font-black text-lg">Homestead & Creature Sanctuary</h3><p className="text-xs text-white/60">Build facilities at your physical Embervale homestead. Each purchase places a visible 3D structure around your house and persists in your save.</p><p className="text-sm mt-2">Home level {save.home.level} · Wallet {save.money} ◈</p><div className="grid sm:grid-cols-2 gap-2 mt-3">{[['habitat','Creature Habitat',250,'Raises the sanctuary capacity.'],['garden','Berry Garden',180,'Supports food and healing supplies.'],['workbench','Crafting Bench',300,'Unlocks advanced crafting recipes.'],['trophy','Guardian Trophy Hall',500,'Display boss crests and rare discoveries.'],['incubator','Second Incubator',450,'A second breeding bay (visual unlock).'],['guest','Guest Lodge',600,'Future co-op visitor space.']].map(([id,name,cost,desc]:any)=><div key={id} className="rounded-xl bg-white/5 p-3"><b>{name}</b><p className="text-xs text-white/55">{desc}</p><button className={`${btn} mt-2`} disabled={ws.homeBuilds.includes(id)||save.money<cost} onClick={()=>build(id,cost)}>{ws.homeBuilds.includes(id)?'Built':`Build · ${cost} ◈`}</button></div>)}</div></div></div>}
    {tab==='guardians'&&<div className={panel}><h3 className="font-black text-lg">Legendary World Guardians</h3><p className="text-xs text-white/60">Guardians are tied to biome, weather and time windows. Defeats should be approached as major expedition goals.</p><div className="grid md:grid-cols-2 gap-2 mt-3">{guardianList.map(g=><div key={g.name} className="rounded-xl bg-white/5 p-3 flex gap-3"><div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{background:`${TYPE_COLORS[g.type as keyof typeof TYPE_COLORS]}25`,border:`1px solid ${TYPE_COLORS[g.type as keyof typeof TYPE_COLORS]}`}}>◆</div><div className="min-w-0"><b>{g.name}</b><p className="text-xs text-white/55">{g.where} · {g.when}</p><p className="text-[10px] text-amber-200">Reward: {g.reward}</p></div></div>)}</div><p className="text-[10px] text-emerald-200/70 mt-3">Guardians now patrol their world territories and appear when their biome, time and weather conditions are met.</p></div>}
    {tab==='survival'&&<div className={panel}><h3 className="font-black text-lg">Expedition Survival & Crafting</h3><p className="text-xs text-white/60">Craft useful supplies from gathered resources. Survival should create preparation choices, not constant punishment.</p><div className="grid sm:grid-cols-2 gap-2 mt-3">{[{id:'fieldkit',name:'Field Medic Kit',needs:{sunberry:2,mintleaf:1},out:'revivedew',desc:'A recovery kit for a fainted companion.'},{id:'trailstew',name:'Trail Stew',needs:{sunberry:1,fish:1,water:1},out:'stew',desc:'A filling meal for long expeditions.'},{id:'flare',name:'Signal Flare',needs:{wood:1,mintleaf:1},out:'lumenpod',desc:'A bright flare capsule for safer routes.'}].map(r=><div key={r.id} className="rounded-xl bg-white/5 p-3"><b>{r.name}</b><p className="text-xs text-white/55">{r.desc}</p><p className="text-[10px] text-cyan-200 mt-1">{Object.entries(r.needs).map(([k,n])=>`${k} ×${n}`).join(' · ')}</p><button className={`${btn} mt-2`} disabled={Object.entries(r.needs).some(([k,n])=>(save.items[k]??0)<(n as number))} onClick={()=>craft(r.id,r.needs as Record<string,number>,r.out)}>Craft 1</button></div>)}</div><div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">{['sunberry','mintleaf','fish','water','wood'].map(k=><div key={k} className="rounded-lg bg-white/5 p-2 text-xs">{k}<b className="block text-lg">×{save.items[k]??0}</b></div>)}</div></div>}
    {tab==='legacy'&&<div className={panel}><h3 className="font-black text-lg">Endgame · Ember League Legacy</h3><div className="grid sm:grid-cols-3 gap-2 mt-3">{[{n:'Trainer League',v:`Rank ${rank}`,d:`${ws.rankXp%500}/500 League XP`},{n:'Creature Collection',v:`${save.caught.length}/${Object.keys(SPECIES).length}`,d:'Species registered'},{n:'Expedition Record',v:`${ws.explored.length}/5`,d:'Deepwild layers cleared'}].map(x=><div className="rounded-xl bg-white/5 p-3" key={x.n}><p className="text-xs text-white/55">{x.n}</p><b className="text-2xl text-amber-200">{x.v}</b><p className="text-xs text-white/50">{x.d}</p></div>)}</div><h4 className="font-black mt-4">Milestones</h4><div className="space-y-2 mt-2">{[{n:'Field Naturalist',d:'Discover 12 species',ok:save.seen.length>=12},{n:'Breeder of Bonds',d:'Hatch 3 eggs',ok:save.stats.captures>=3&&ws.eggs.length===0},{n:'Deep Delver',d:'Clear all five Deepwild layers',ok:ws.explored.length===5},{n:'League Contender',d:'Reach 1,000 League XP',ok:ws.rankXp>=1000},{n:'Sanctuary Keeper',d:'Build three home facilities',ok:ws.homeBuilds.length>=3}].map(x=><div key={x.n} className="flex justify-between rounded-lg bg-white/5 p-2 text-xs"><span><b>{x.n}</b><span className="block text-white/50">{x.d}</span></span><b className={x.ok?'text-emerald-300':'text-white/35'}>{x.ok?'UNLOCKED':'LOCKED'}</b></div>)}</div></div>}
  </div>;
}
