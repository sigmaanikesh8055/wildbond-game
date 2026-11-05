import * as THREE from 'three';
import { buildCreature } from '../game/models';

// Renders a small picture of each pet once (shared offscreen renderer) and caches it as an image URL.
const cache = new Map<string, string>();
let r: THREE.WebGLRenderer | null = null; let scene: THREE.Scene; let cam: THREE.PerspectiveCamera;
export function petPic(sp: string): string {
  const hit = cache.get(sp); if (hit) return hit;
  try {
    if (!r) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 160;
      r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(160, 160, false); r.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#ffffff', '#8890b0', 1.6)); const d = new THREE.DirectionalLight('#fff6e0', 2.2); d.position.set(2, 4, 5); scene.add(d);
      cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    }
    const g = buildCreature(sp); g.rotation.y = 0.45; scene.add(g);
    const box = new THREE.Box3().setFromObject(g); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()); const m = Math.max(s.x, s.y, s.z);
    cam.position.set(c.x, c.y + m * 0.15, c.z + m * 2.1); cam.lookAt(c);
    r.setClearColor(0x000000, 0); r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png'); scene.remove(g); cache.set(sp, url); return url;
  } catch { return ''; }
}
