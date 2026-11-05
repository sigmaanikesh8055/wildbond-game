import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCreature, buildHuman, animateCreature, animateHuman, part, mat, addOutline } from '../game/models';
import { SPECIES } from '../game/data';
import type { Look } from '../game/state';

// Lobby: trainer + pet standing together on a stone platform with a glowing rune ring
export function LobbyStage({ look, sp, w, h }: { look: Look; sp?: string; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(w, h, false); r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#ffffff', '#8890b0', 1.5)); const d = new THREE.DirectionalLight('#fff6e0', 2.4); d.position.set(3, 7, 5); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); s.add(d);
    const cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 60); cam.position.set(0, 2.6, 9.5); cam.lookAt(0, 1.05, 0);
    const stage = new THREE.Group(); s.add(stage);
    // translucent crystal platform with a glowing core and gold rim
    const glass = new THREE.MeshPhysicalMaterial({ color: '#bfeaff', transparent: true, opacity: 0.38, roughness: 0.08, metalness: 0.1, clearcoat: 1, emissive: '#3a9ad0', emissiveIntensity: 0.25, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.45, 0.42, 48), glass); disc.position.y = -0.22; disc.userData.noOutline = true; stage.add(disc);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 0.3, 32), new THREE.MeshBasicMaterial({ color: '#7ad0ff', transparent: true, opacity: 0.35 })); core.position.y = -0.24; stage.add(core);
    part('torus', mat('#ffd36a', 0.5), [2.7, 2.7, 0.8], [0, -0.01, 0], [Math.PI / 2, 0, 0], stage, true); part('torus', mat('#ffd36a', 0.4), [2.45, 2.45, 0.6], [0, -0.43, 0], [Math.PI / 2, 0, 0], stage, true);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffe7a0' : '#bfeaff' })); cr.position.set(Math.cos(a) * 3.1, 0.2, Math.sin(a) * 3.1); cr.userData.float = a; stage.add(cr); }
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.75, 48), new THREE.MeshBasicMaterial({ color: '#7ad0ff', transparent: true, opacity: 0.8 })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.005; stage.add(glow);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rune = new THREE.Mesh(new THREE.CircleGeometry(0.09, 4), new THREE.MeshBasicMaterial({ color: '#bfe8ff' })); rune.rotation.x = -Math.PI / 2; rune.position.set(Math.cos(a) * 2.1, 0.006, Math.sin(a) * 2.1); stage.add(rune); }
    stage.traverse(o => { (o as THREE.Mesh).receiveShadow = true; }); addOutline(stage, 0.02);
    const hero = buildHuman(look); hero.position.set(sp ? -0.85 : 0, 0, 0.2); hero.rotation.y = 0.35; s.add(hero);
    const pet = sp ? buildCreature(sp) : null;
    if (pet && sp) { const ps = SPECIES[sp].scale; pet.position.set(0.95, 0, 0.3); pet.rotation.y = -0.5; pet.scale.setScalar(Math.min(1.25, 1.05 / Math.max(0.6, ps))); s.add(pet); }
    [hero, ...(pet ? [pet] : [])].forEach(o => o.traverse(m => { (m as THREE.Mesh).castShadow = true; }));
    let raf = 0, last = performance.now(), t = 0;
    const loop = () => { raf = requestAnimationFrame(loop); const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (hero.userData.emote <= 0 && Math.random() < dt * 0.12) { hero.userData.emote = 1.5; hero.userData.emoteKind = 0; }
      animateHuman(hero, dt, 0); if (pet) animateCreature(pet, dt, false); glow.rotation.z += dt * 0.3; (glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 2) * 0.25;
      stage.rotation.y = Math.sin(t * 0.2) * 0.05; stage.children.forEach(o => { if (o.userData.float !== undefined) { o.position.y = 0.25 + Math.sin(t * 2 + o.userData.float) * 0.12; o.rotation.y = t; } }); r.render(s, cam); };
    loop(); return () => { cancelAnimationFrame(raf); r.dispose(); };
  }, [JSON.stringify(look), sp, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h }} />;
}

// Isolated 3D preview (lobby, creator, team). Disposed on unmount to free GPU memory.
export function Preview({ look, sp, size = 260, glow, spin = true, angle = 0, h, acc }: { look?: Look; sp?: string; size?: number; glow?: boolean; spin?: boolean; angle?: number; h?: number; acc?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = look ? JSON.stringify(look) : sp + (acc ?? '');
  const H = h ?? size;
  useEffect(() => {
    const c = ref.current!; const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(size, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#ffffff', '#8890b0', 1.6)); const d = new THREE.DirectionalLight('#fff6e0', 2.2); d.position.set(3, 5, 4); s.add(d);
    const cam = new THREE.PerspectiveCamera(30, size / H, 0.1, 50);
    const obj = look ? buildHuman(look) : buildCreature(sp!, acc); s.add(obj); obj.rotation.y = angle;
    const box = new THREE.Box3().setFromObject(obj); const hh = box.max.y - box.min.y; const fit = Math.max(hh, (box.max.x - box.min.x) * H / size);
    cam.position.set(0, hh * 0.55, fit * 2.1 + 0.8); cam.lookAt(0, hh * 0.47, 0);
    let raf = 0; let last = performance.now(); let t = 0;
    const loop = () => { raf = requestAnimationFrame(loop); const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (spin) obj.rotation.y += dt * 0.6; else obj.rotation.y = angle + Math.sin(t * 0.5) * 0.15;
      if (look) { if (!spin && obj.userData.emote <= 0 && Math.random() < dt * 0.15) { obj.userData.emote = 1.5; obj.userData.emoteKind = 0; } animateHuman(obj, dt, 0); }
      else animateCreature(obj, dt, false);
      r.render(s, cam); };
    loop();
    return () => { cancelAnimationFrame(raf); r.dispose(); };
  }, [key, size, H, spin, angle]);
  return <canvas ref={ref} style={{ width: size, height: H, filter: glow ? 'drop-shadow(0 0 24px #fff)' : 'drop-shadow(0 10px 12px #0006)' }} />;
}
