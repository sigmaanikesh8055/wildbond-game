// Procedural original audio: all sounds synthesized at runtime with WebAudio (no files, offline).
let ctx: AudioContext | null = null;
let master: GainNode, musicG: GainNode, sfxG: GainNode;
let vol = { master: 0.7, music: 0.5, sfx: 0.8 };
let track = ''; let step = 0; let timer: number | null = null;

function init() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain(); musicG = ctx.createGain(); sfxG = ctx.createGain();
  musicG.connect(master); sfxG.connect(master); master.connect(ctx.destination);
  applyVol();
}
function applyVol() { if (!ctx) return; master.gain.value = vol.master; musicG.gain.value = vol.music * 0.25; sfxG.gain.value = vol.sfx * 0.5; }
export function setVolumes(m: number, mu: number, s: number) { vol = { master: m, music: mu, sfx: s }; applyVol(); }
export function unlockAudio() { init(); if (ctx?.state === 'suspended') ctx.resume(); }

function tone(freq: number, dur: number, type: OscillatorType, gain: number, dest: GainNode, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, gain: number, freq = 1000) {
  if (!ctx) return;
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(sfxG); s.start();
}

const TYPE_SFX: Record<string, () => void> = {
  fire: () => { noise(0.4, 0.6, 1800); tone(200, 0.3, 'sawtooth', 0.2, sfxG, -120); },
  water: () => { tone(600, 0.15, 'sine', 0.4, sfxG, -300); tone(900, 0.12, 'sine', 0.3, sfxG, -400, 0.08); },
  nature: () => { tone(500, 0.2, 'triangle', 0.3, sfxG, 200); noise(0.2, 0.2, 3000); },
  electric: () => { tone(1200, 0.18, 'square', 0.15, sfxG, -900); tone(1800, 0.1, 'square', 0.1, sfxG, -1200, 0.05); },
  earth: () => { tone(90, 0.4, 'sine', 0.6, sfxG, -40); noise(0.3, 0.4, 400); },
  wind: () => noise(0.5, 0.5, 2500),
  shadow: () => { tone(160, 0.5, 'sawtooth', 0.2, sfxG, -80); tone(240, 0.5, 'sine', 0.2, sfxG, -120); },
  ice: () => { tone(2000, 0.2, 'triangle', 0.2, sfxG, 600); tone(2600, 0.15, 'sine', 0.15, sfxG, 0, 0.06); },
  psychic: () => { tone(500, 0.4, 'sine', 0.25, sfxG, 500); tone(750, 0.4, 'sine', 0.2, sfxG, -300, 0.05); },
  light: () => { [880, 1320, 1760].forEach((f, i) => tone(f, 0.2, 'triangle', 0.18, sfxG, 0, i * 0.05)); },
  aether: () => { tone(300, 0.6, 'sine', 0.25, sfxG, 900); tone(200, 0.6, 'triangle', 0.15, sfxG, -100); },
  metal: () => { tone(400, 0.3, 'square', 0.15, sfxG, -50); tone(820, 0.3, 'triangle', 0.15, sfxG); },
};
export function sfx(name: string) {
  if (!ctx) return;
  switch (name) {
    case 'hit': noise(0.12, 0.7, 1500); tone(180, 0.1, 'square', 0.2, sfxG, -80); break;
    case 'crit': noise(0.2, 0.9, 3000); tone(600, 0.2, 'square', 0.25, sfxG, -400); break;
    case 'swing': noise(0.1, 0.25, 4000); break;
    case 'dodge': noise(0.15, 0.3, 6000); break;
    case 'block': tone(300, 0.1, 'square', 0.3, sfxG); break;
    case 'parry': tone(1200, 0.25, 'triangle', 0.4, sfxG, 600); break;
    case 'throw': tone(400, 0.3, 'sine', 0.3, sfxG, 600); break;
    case 'shake': tone(220, 0.08, 'square', 0.2, sfxG); break;
    case 'catch': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.35, sfxG, 0, i * 0.1)); break;
    case 'escape': tone(400, 0.3, 'sawtooth', 0.25, sfxG, -300); break;
    case 'level': [440, 554, 659, 880].forEach((f, i) => tone(f, 0.2, 'square', 0.15, sfxG, 0, i * 0.08)); break;
    case 'evolve': for (let i = 0; i < 12; i++) tone(300 + i * 80, 0.25, 'triangle', 0.2, sfxG, 0, i * 0.12); break;
    case 'ui': tone(880, 0.06, 'sine', 0.2, sfxG); break;
    case 'coin': tone(988, 0.08, 'square', 0.15, sfxG); tone(1318, 0.15, 'square', 0.15, sfxG, 0, 0.08); break;
    case 'faint': tone(400, 0.6, 'sawtooth', 0.25, sfxG, -330); break;
    case 'victory': [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, sfxG, 0, i * 0.14)); break;
    case 'pickup': tone(700, 0.1, 'sine', 0.3, sfxG, 400); break;
    case 'happy': tone(700, 0.1, 'sine', 0.25, sfxG, 300); tone(900, 0.12, 'sine', 0.25, sfxG, 300, 0.1); break;
    case 'task': [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, sfxG, 0, i * 0.075)); break;
    case 'gift': tone(300, 0.42, 'sine', 0.2, sfxG, 420); noise(0.15, 0.15, 2200); [659, 880, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, sfxG, 0, 0.25 + i * 0.09)); break;
    case 'thunder': noise(1.5, 1, 300); break;
    default: TYPE_SFX[name]?.();
  }
}
export function cry(seed: number, size: number) {
  if (!ctx) return;
  const base = 300 + (seed % 7) * 90 - size * 80;
  tone(base, 0.18, seed % 2 ? 'triangle' : 'square', 0.15, sfxG, base * 0.5);
  tone(base * 1.25, 0.15, 'sine', 0.15, sfxG, -base * 0.3, 0.12);
}

const TRACKS: Record<string, { bpm: number; scale: number[]; bass: number[]; wave: OscillatorType; mel: number[] }> = {
  village: { bpm: 96, scale: [262, 294, 330, 392, 440, 523], bass: [131, 98, 110, 87], wave: 'triangle', mel: [0, 2, 4, 3, 2, 1, 2, -1, 4, 5, 4, 2, 3, 2, 1, -1] },
  route: { bpm: 112, scale: [294, 330, 370, 440, 494, 587], bass: [147, 110, 123, 98], wave: 'triangle', mel: [0, 1, 2, 4, 3, -1, 2, 1, 0, 2, 4, 5, 4, 3, 1, -1] },
  night: { bpm: 72, scale: [220, 262, 294, 330, 392, 440], bass: [110, 87, 98, 82], wave: 'sine', mel: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 0, -1, 1, -1, -1, -1] },
  battle: { bpm: 150, scale: [220, 247, 262, 330, 349, 440], bass: [110, 110, 87, 98], wave: 'square', mel: [0, 2, 3, 2, 4, 3, 2, 0, 5, 4, 3, 4, 2, 3, 1, 2] },
  boss: { bpm: 160, scale: [196, 208, 247, 262, 294, 311], bass: [98, 104, 92, 87], wave: 'sawtooth', mel: [0, 0, 3, 0, 4, 3, 1, 0, 5, 4, 3, 1, 2, 1, 0, -1] },
  gloam: { bpm: 118, scale: [146, 155, 185, 196, 233, 247], bass: [73, 69, 62, 65], wave: 'sawtooth', mel: [0, -1, 3, 1, -1, 4, 2, -1, 0, 3, -1, 5, 4, 2, 1, -1] },
  auralis: { bpm: 146, scale: [220, 247, 277, 330, 370, 440], bass: [110, 123, 92, 98], wave: 'triangle', mel: [0, 2, 4, -1, 5, 4, 2, 3, 1, -1, 4, 5, 3, 2, 1, -1] },
  home: { bpm: 80, scale: [349, 392, 440, 523, 587, 698], bass: [175, 131, 147, 117], wave: 'sine', mel: [2, -1, 3, 4, -1, 3, 2, -1, 0, -1, 1, 2, -1, 1, 0, -1] },
};
export function playMusic(name: string) {
  if (!ctx || track === name) return;
  track = name; step = 0;
  if (timer) clearInterval(timer);
  const t = TRACKS[name]; if (!t) return;
  timer = window.setInterval(() => {
    const m = t.mel[step % 16];
    if (m >= 0) tone(t.scale[m], 60 / t.bpm * 0.9, t.wave, 0.18, musicG);
    if (step % 4 === 0) tone(t.bass[(step / 4) % 4], 60 / t.bpm * 1.8, 'sine', 0.35, musicG);
    if (name === 'battle' || name === 'boss') { if (step % 2 === 0) { const s = ctx!; const b = s.createOscillator(); const g = s.createGain(); b.frequency.value = 60; g.gain.setValueAtTime(0.3, s.currentTime); g.gain.exponentialRampToValueAtTime(0.001, s.currentTime + 0.1); b.connect(g); g.connect(musicG); b.start(); b.stop(s.currentTime + 0.12); } }
    step++;
  }, (60 / t.bpm) * 1000 / 2);
}
