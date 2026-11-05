import { useEffect, useRef, useState } from 'react';
import { GUIDE_PLACES, GuideKind, GuideTarget, nearestPlace } from '../game/guide';
import { AnalogCompass } from './Widgets';

export function GuidePanel({ position, onMark, onClose }: {
  position: [number, number]; onMark: (target: GuideTarget) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<GuideKind | null>(null);
  const [result, setResult] = useState<GuideTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [empty, setEmpty] = useState(false);
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);

  const locate = async (kind: GuideKind) => {
    job.current?.abort();
    const next = new AbortController(); job.current = next;
    setSelected(kind); setResult(null); setEmpty(false); setBusy(true);
    const found = await nearestPlace(kind, position[0], position[1], next.signal);
    if (next.signal.aborted) return;
    setBusy(false); setResult(found); setEmpty(!found);
  };

  return <div className="space-y-4">
    <div className="rounded-2xl bg-sky-500/15 border border-sky-300/25 px-4 py-3 text-sm leading-relaxed">
      <span className="font-black text-sky-200">Guide:</span> Ask for any place, even if you have never been there. Pick one to find its entrance or play spot. No internet needed.
      <div className="text-xs text-sky-100/70 mt-1">You are at X {Math.round(position[0])}, Z {Math.round(position[1])}. Numbers are shown to the nearest metre.</div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[38vh] overflow-y-auto pr-1">
      {GUIDE_PLACES.map(place => <button key={place.id} onClick={() => locate(place.id)}
        className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold border transition-colors ${selected === place.id ? 'bg-amber-400/25 border-amber-300 text-white' : 'bg-white/5 border-white/10 hover:bg-white/15'}`}>
        <span className="mr-2">{place.icon}</span>{place.label}
      </button>)}
    </div>
    <div aria-live="polite" className="min-h-28 rounded-2xl bg-black/20 p-4 flex flex-col justify-center">
      {busy && <p className="text-amber-200 font-bold animate-pulse">Looking for the nearest {GUIDE_PLACES.find(p => p.id === selected)?.label.toLowerCase()}...</p>}
      {empty && <p className="text-white/70">I could not find one within the guide's search range. This is not because it is undiscovered.</p>}
      {result && <>
        <div className="flex items-center gap-3"><AnalogCompass from={position} to={[result.x, result.z]} size={56} /><div className="text-left"><div className="text-xs uppercase tracking-widest text-amber-300 mb-1">Nearest place</div><h3 className="text-xl font-black">{result.name}</h3></div></div>
        <p className="text-sm text-white/85 mt-2">X <b>{Math.round(result.x)}</b> · Z <b>{Math.round(result.z)}</b> · {Math.round(result.distance)} m straight-line {result.direction}</p>
        {result.note && <p className="text-xs text-sky-100/80 mt-1">{result.note}</p>}
        <button onClick={() => onMark(result)} className="self-start mt-3 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 px-4 py-2 text-sm font-black">📍 Pin on minimap</button>
      </>}
      {!busy && !empty && !result && <p className="text-white/60 text-sm">Choose a place above to get its coordinates.</p>}
    </div>
    <button onClick={onClose} className="text-sm font-bold text-white/65 hover:text-white">Close guide</button>
  </div>;
}