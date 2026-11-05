import { useState } from 'react';
import { sfx } from '../game/audio';

const PAGES: { title: string; text: string; pic: string }[] = [
  { title: 'The Song of Embervale', pic: '📖', text: 'This book belonged to your grandmother. On the first page, in careful handwriting, she wrote: "For the next child of Embervale who walks beside a wild friend. Read it slowly. Every word is true."' },
  { title: 'Chapter 1 — The Warm Valley', pic: '🏡', text: 'Long ago, before the roads and before the bridges, the valley was cold and grey. People lived alone in stone huts and were afraid of the wild creatures in the hills. The creatures were afraid of them too. Nobody shared fire, and nobody shared food.' },
  { title: 'Chapter 2 — The Girl and the Ember Fox', pic: '🦊', text: 'One winter night a girl named Aria found a tiny fox with a dim, flickering tail, shivering in the snow. Everyone told her to leave it. Instead she wrapped it in her scarf and sat with it until morning. When the sun rose, the fox\'s tail was burning bright. It never left her side again.' },
  { title: 'Chapter 3 — The First Hearth', pic: '🔥', text: 'The fox kept Aria\'s hut warm all winter. Neighbours came to sit by the glow, and soon other creatures came too — a little rock blob, a sleepy moss bunny, a buzzing spark beetle. Each one gave a gift: warmth, strength, healing, light. The village grew around that single warm hut. People called it Embervale.' },
  { title: 'Chapter 4 — The Sundering', pic: '⚡', text: 'Years later, greedy kings wanted the creatures\' power for war. They built cages and chains. The creatures grew angry and afraid, and their power ran wild. The earth cracked, rivers changed their paths, and great storms tore the land into many pieces. The old books call this terrible time the Sundering.' },
  { title: 'Chapter 5 — The Guardian of Light', pic: '🌟', text: 'When all seemed lost, a great winged creature made of dawn-light came down from the sky. It did not fight. It only sang. The song reminded every creature of the warm hut in the snow, and of the girl who never left. One by one, the chains broke. The storms grew quiet. The people named the guardian Aurorath.' },
  { title: 'Chapter 6 — The Promise', pic: '🤝', text: 'Before flying away, Aurorath left a promise carved in stone: "A bond freely given is stronger than any chain. As long as one child walks beside a wild friend with kindness, I will return when the world needs me." The Elders of Embervale have guarded that stone ever since.' },
  { title: 'Chapter 7 — The Masks Return', pic: '🎭', text: 'But not everyone learned the lesson. A group called the Hollow Veil believes that freedom caused the Sundering, and that every creature must be locked away to keep the world safe. They wear masks so no one can see their faces — and so they never have to look a creature in the eyes.' },
  { title: 'The Last Page', pic: '💌', text: 'Here the handwriting changes. It is your grandmother\'s again: "My dear, the world is wide — wider than any map. There are oceans full of shining fish, frozen lands at the edge of the south, and cities with great arenas. Go and see them all. Be brave, be kind, and always share your fire. — Love, Grandma."' },
];

export function Book({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState(0); const pg = PAGES[p];
  const go = (d: number) => { const n = Math.max(0, Math.min(PAGES.length - 1, p + d)); if (n !== p) { setP(n); sfx('ui'); } };
  return <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-3" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="relative w-full max-w-3xl aspect-[3/2] max-h-[88vh] rounded-3xl shadow-2xl border-8 border-amber-900 flex overflow-hidden" style={{ background: 'linear-gradient(90deg,#f3e3c0 0%,#fbf1da 47%,#d8c49c 50%,#fbf1da 53%,#f3e3c0 100%)' }}>
      <div className="flex-1 p-5 md:p-8 flex flex-col items-center justify-center text-center text-amber-950">
        <div className="text-7xl md:text-8xl drop-shadow">{pg.pic}</div>
        <div className="mt-3 font-serif italic text-amber-800 text-sm">Page {p + 1} of {PAGES.length}</div>
      </div>
      <div className="flex-1 p-5 md:p-8 overflow-auto text-amber-950">
        <h2 className="font-serif text-xl md:text-2xl font-black mb-3 border-b-2 border-amber-800/30 pb-2">{pg.title}</h2>
        <p className="font-serif text-base md:text-lg leading-relaxed first-letter:text-4xl first-letter:font-black first-letter:float-left first-letter:mr-1">{pg.text}</p>
      </div>
      <button onClick={() => go(-1)} disabled={p === 0} className="absolute left-2 bottom-2 w-12 h-12 rounded-full bg-amber-800 text-white text-2xl font-black disabled:opacity-30">‹</button>
      <button onClick={() => go(1)} disabled={p === PAGES.length - 1} className="absolute right-2 bottom-2 w-12 h-12 rounded-full bg-amber-800 text-white text-2xl font-black disabled:opacity-30">›</button>
      <button onClick={onClose} className="absolute right-2 top-2 w-10 h-10 rounded-full bg-amber-900 text-white font-black">✕</button>
    </div>
  </div>;
}
