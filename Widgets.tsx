import { useEffect, useRef } from 'react';
import type { Engine } from '../game/engine';
import { MAP_SHAPES } from '../game/world';
import { PORTAL_POS } from '../game/dimension';

export function AnalogCompass({ from, to, size = 42 }: { from: [number, number]; to?: [number, number] | null; size?: number }) {
  const dx = (to?.[0] ?? from[0]) - from[0];
  const dz = (to?.[1] ?? from[1] + 1) - from[1];
  const bearing = Math.atan2(dx, dz) * 180 / Math.PI;
  return <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0" role="img" aria-label={to ? `Direction to pinned place: ${Math.round(bearing)} degrees from north` : 'Compass north'}>
    <circle cx="24" cy="24" r="22" fill="#171f33" stroke="#9ed8e0" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="17.5" fill="none" stroke="#768599" strokeWidth="0.5" />
    <text x="24" y="9" textAnchor="middle" fill="#f8dcc0" fontSize="7" fontWeight="bold">N</text>
    <text x="24" y="44" textAnchor="middle" fill="#a5b8ca" fontSize="6">S</text>
    <text x="42" y="26" textAnchor="middle" fill="#a5b8ca" fontSize="6">E</text>
    <text x="6" y="26" textAnchor="middle" fill="#a5b8ca" fontSize="6">W</text>
    <g style={{ transform: `rotate(${bearing}deg)`, transformOrigin: '24px 24px', transition: 'transform .2s ease' }}>
      <path d="M24 10 28 25 24 22 20 25Z" fill={to ? '#fcd681' : '#ef8a7e'} />
      <path d="M24 38 20 23 24 26 28 23Z" fill="#b6cbda" />
    </g>
    <circle cx="24" cy="24" r="2.2" fill="#f8fafc" />
  </svg>;
}

// Rotating minimap (top-left), follows the camera direction
export function Minimap({ eng, size = 170 }: { eng: Engine | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = ref.current; if (!cv || !eng) return; const x = cv.getContext('2d')!; const S = size, c = S / 2, sc = 1.7;
      x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(c, c, c - 3, 0, Math.PI * 2); x.clip();
      if (eng.indoor) { x.fillStyle = '#c8925a'; x.fillRect(0, 0, S, S); x.fillStyle = '#5a3a20'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('🏠 Home', c, c + 5); x.restore(); ring(x, c); return; }
      const px = eng.player.position.x, pz = eng.player.position.z, yaw = eng.yaw;
      const cr = Math.cos(yaw), sr = Math.sin(yaw);
      const T = (wx: number, wz: number): [number, number] => { const dx = wx - px, dz = wz - pz; return [c + (dx * cr - dz * sr) * sc, c - (-dx * sr - dz * cr) * sc]; };
      const rect = (cx: number, cz: number, w: number, d: number, col: string) => { const p = [T(cx - w / 2, cz - d / 2), T(cx + w / 2, cz - d / 2), T(cx + w / 2, cz + d / 2), T(cx - w / 2, cz + d / 2)]; x.fillStyle = col; x.beginPath(); x.moveTo(...p[0]); p.slice(1).forEach(q => x.lineTo(...q)); x.closePath(); x.fill(); };
      const circ = (cx: number, cz: number, r: number, col: string) => { const [a, b] = T(cx, cz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r * sc, 0, Math.PI * 2); x.fill(); };
      x.fillStyle = '#6cbf4f'; x.fillRect(0, 0, S, S);
      eng.mapShapes().forEach(s => { if (s.k === 'r') rect(s.x, s.z, s.w!, s.d!, s.col); else circ(s.x, s.z, s.r!, s.col); });
      if (eng.save.camp) { const [a, b] = T(eng.save.camp[0], eng.save.camp[1]); x.font = '13px sans-serif'; x.textAlign = 'center'; x.fillText('⛺', a, b + 4); }
      rect(0, 130, 70, 200, '#6cbf4f'); rect(0, -3, 80, 69, '#82c95e');
      MAP_SHAPES.paths.forEach(([a, b, w, d]) => rect(a, b, w, d, '#ecd39a'));
      rect(0, 95, 240, 6.5, '#4fc3f7'); circ(-29, -27, 5, '#4fc3f7'); circ(0, 0, 8, '#ddd2bd'); circ(-22, 130, 13, '#2f7d4a'); rect(0, 205, 50, 40, '#b0ab9a');
      if (!eng.save.quests.m3.done) rect(0, 182, 70, 1.2, '#b46aff');
      MAP_SHAPES.houses.forEach(([a, b, w, d, col]) => { rect(a, b, w + 0.6, d + 0.6, '#3a2a2a'); rect(a, b, w, d, col); });
      eng.wilds.forEach(w => { if (w.mesh.visible) { const [a, b] = T(w.mesh.position.x, w.mesh.position.z); x.fillStyle = '#ff5252'; x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); } });
      eng.npcs.forEach(n => { if (!n.mesh.visible) return; const [a, b] = T(n.pos.x, n.pos.z); x.fillStyle = n.trainer ? '#ff9a2b' : '#ffe14a'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); x.stroke(); if (n.trainer) { x.fillStyle = '#000'; x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.fillText('!', a, b + 3); } });
      const [hx, hy] = T(-18, -10.4); x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('🏠', hx, hy + 4);
      const [portX, portY] = T(PORTAL_POS.x, PORTAL_POS.z); x.save(); x.translate(portX, portY); x.rotate(Math.PI / 4); x.fillStyle = eng.save.flags.portalAwake ? '#b9a5f0' : '#817c91'; x.strokeStyle = '#fff'; x.lineWidth = 1; x.fillRect(-5, -5, 10, 10); x.strokeRect(-5, -5, 10, 10); x.restore();
      if (eng.guideTarget) {
        const [tx, ty] = T(eng.guideTarget.x, eng.guideTarget.z);
        const dx = tx - c, dy = ty - c, length = Math.max(1, Math.hypot(dx, dy));
        const radius = Math.min(length, c - 16), mx = c + dx / length * radius, my = c + dy / length * radius;
        x.fillStyle = '#fbbf24'; x.strokeStyle = '#392008'; x.lineWidth = 2;
        x.beginPath(); x.arc(mx, my, 7, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = '#35200a'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.fillText('G', mx, my + 3);
      }
      // player arrow
      const f = eng.player.rotation.y; const ang = Math.atan2(Math.sin(f) * cr - Math.cos(f) * sr, -Math.sin(f) * sr - Math.cos(f) * cr);
      x.save(); x.translate(c, c); x.rotate(ang); x.fillStyle = '#ffffff'; x.strokeStyle = '#1a3aff'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(0, 3); x.lineTo(-7, 7); x.closePath(); x.stroke(); x.fill(); x.restore();
      // north marker
      const [nx, ny] = [c - sr * (c - 12), c + cr * (c - 12)];
      x.restore(); ring(x, c);
      x.fillStyle = '#e53935'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.beginPath(); x.arc(nx, ny, 8, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillText('N', nx, ny + 4);
    };
    const ring = (x: CanvasRenderingContext2D, c: number) => { x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.beginPath(); x.arc(c, c, c - 3, 0, Math.PI * 2); x.stroke(); x.strokeStyle = '#2b1d2e'; x.lineWidth = 2; x.beginPath(); x.arc(c, c, c - 0.5, 0, Math.PI * 2); x.stroke(); };
    draw(); return () => cancelAnimationFrame(raf);
  }, [eng, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} className="drop-shadow-lg" />;
}

// Virtual joystick (mouse or touch)
export function Joystick({ eng }: { eng: Engine | null }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null), active = useRef<number | null>(null);
  const R = 55;
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current || !knob.current || !eng) return;
    const r = base.current.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`; eng.joy = [dx / R, dy / R];
  };
  const end = () => { active.current = null; if (knob.current) knob.current.style.transform = 'translate(0,0)'; if (eng) eng.joy = [0, 0]; };
  // if the joystick disappears while held (dialog, battle), stop moving
  useEffect(() => () => { if (eng) eng.joy = [0, 0]; }, [eng]);
  return (
    <div ref={base} className="w-36 h-36 rounded-full bg-white/15 border-4 border-white/40 backdrop-blur-sm flex items-center justify-center touch-none select-none shadow-xl"
      onPointerDown={e => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      {['▲', '▼', '◀', '▶'].map((a, i) => <span key={a} className="absolute text-white/60 text-xs" style={{ transform: `translate(${[0, 0, -52, 52][i]}px, ${[-52, 52, 0, 0][i]}px)` }}>{a}</span>)}
      <div ref={knob} className="w-16 h-16 rounded-full bg-gradient-to-b from-white to-sky-200 border-4 border-sky-400 shadow-lg pointer-events-none transition-transform duration-75" />
    </div>
  );
}

export function RoundBtn({ label, sub, onClick, color = 'from-amber-300 to-orange-500', size = 64 }: { label: string; sub?: string; onClick: () => void; color?: string; size?: number }) {
  return <button onPointerDown={e => { e.preventDefault(); onClick(); }} style={{ width: size, height: size }} className={`rounded-full bg-gradient-to-b ${color} border-4 border-white shadow-xl text-white font-black flex flex-col items-center justify-center active:scale-90 transition leading-none touch-none`}>
    <span style={{ fontSize: size * 0.32, textShadow: '0 2px 0 #0005' }}>{label}</span>{sub && <span className="text-[9px] mt-0.5 opacity-90">{sub}</span>}</button>;
}
