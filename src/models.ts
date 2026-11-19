import * as THREE from 'three';
import { ITEMS } from './data';

let grad: THREE.DataTexture | null = null;
function gradient() {
  if (grad) return grad;
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  grad = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  return grad;
}
const matCache = new Map<string, THREE.Material>();
export function toon(color: number, emissive = 0): THREE.MeshToonMaterial {
  const k = color + ':' + emissive;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: gradient(), emissive, emissiveIntensity: emissive ? 0.6 : 0 }));
  return matCache.get(k) as THREE.MeshToonMaterial;
}
export function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, emissive = 0) {
  const m = new THREE.Mesh(geo, toon(color, emissive)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
const sph = (r: number) => new THREE.SphereGeometry(r, 16, 12);

/** Chibi animal: big head, little body, species ears, optional hat. */
export function buildChibi(animal: string, color: number, accent: number, hat: string | null = null, hatColor = 0xffffff) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.32, 0.3, 6, 12), color, 0, 0.5, 0); g.add(body);
  const belly = mesh(sph(0.22), accent, 0, 0.5, 0.17); belly.scale.set(1, 1.1, 0.5); g.add(belly);
  const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
  head.add(mesh(sph(0.48), color));
  for (const s of [-1, 1]) {
    head.add(mesh(sph(0.07), 0x222233, s * 0.17, 0.02, 0.43));
    head.add(mesh(sph(0.025), 0xffffff, s * 0.15, 0.05, 0.49));
    const blush = mesh(sph(0.07), 0xff9fb5, s * 0.28, -0.1, 0.37); blush.scale.set(1, 0.5, 0.4); head.add(blush);
    g.add(mesh(sph(0.11), color, s * 0.35, 0.55, 0.05)); // arms
    g.add(mesh(sph(0.12), accent, s * 0.16, 0.12, 0.05)); // feet
    if (animal === 'rabbit') { const e = mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), color, s * 0.18, 0.62, -0.05); e.rotation.z = -s * 0.15; head.add(e); const ie = mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), accent, s * 0.18, 0.62, 0.0); ie.rotation.z = -s * 0.15; head.add(ie); }
    if (animal === 'bear') { head.add(mesh(sph(0.15), color, s * 0.33, 0.36, -0.05)); head.add(mesh(sph(0.08), accent, s * 0.33, 0.36, 0.05)); }
    if (animal === 'fox' || animal === 'cat') {
      const big = animal === 'fox';
      const e = mesh(new THREE.ConeGeometry(big ? 0.17 : 0.14, big ? 0.42 : 0.3, 4), color, s * 0.27, 0.45, 0); e.rotation.z = -s * 0.3; head.add(e);
      const ie = mesh(new THREE.ConeGeometry(big ? 0.09 : 0.07, big ? 0.25 : 0.18, 4), accent, s * 0.26, 0.42, 0.06); ie.rotation.z = -s * 0.3; head.add(ie);
    }
  }
  head.add(mesh(sph(0.05), animal === 'bear' ? 0x3a2a20 : 0xff7a8a, 0, -0.08, 0.48));
  if (animal === 'fox' || animal === 'cat') { const muz = mesh(sph(0.16), accent, 0, -0.14, 0.36); muz.scale.set(1.3, 0.8, 0.8); head.add(muz); }
  // tail
  const tail = animal === 'fox' ? mesh(new THREE.CapsuleGeometry(0.14, 0.35, 4, 8), color, 0, 0.45, -0.38) : mesh(sph(animal === 'rabbit' ? 0.13 : 0.1), animal === 'rabbit' ? 0xffffff : color, 0, 0.4, -0.33);
  if (animal === 'fox') { tail.rotation.x = -0.9; tail.add(mesh(sph(0.12), 0xffffff, 0, 0.25, 0)); }
  if (animal === 'cat') { tail.scale.set(0.7, 3, 0.7); tail.position.set(0, 0.6, -0.33); tail.rotation.x = -0.4; }
  g.add(tail);
  if (hat) head.add(buildHat(hat, hatColor));
  g.userData.head = head;
  return g;
}

export function buildHat(model: string, color: number) {
  const h = new THREE.Group(); h.position.y = 0.4;
  if (model === 'party') { const c = mesh(new THREE.ConeGeometry(0.2, 0.5, 12), color, 0, 0.25, 0); h.add(c); h.add(mesh(sph(0.07), 0xffee66, 0, 0.52, 0)); }
  if (model === 'wizard') { h.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), color, 0, 0, 0)); const c = mesh(new THREE.ConeGeometry(0.28, 0.7, 12), color, 0, 0.35, 0); c.rotation.z = 0.2; h.add(c); h.add(mesh(sph(0.06), 0xffee66, 0.1, 0.4, 0.2, 0xffee66)); }
  if (model === 'bow') { for (const s of [-1, 1]) { const b = mesh(new THREE.ConeGeometry(0.14, 0.25, 8), color, s * 0.14, 0.02, 0.1); b.rotation.z = s * Math.PI / 2; h.add(b); } h.add(mesh(sph(0.07), color, 0, 0.02, 0.1)); h.position.set(0.2, 0.3, 0); }
  if (model === 'flower') { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; h.add(mesh(sph(0.08), i % 2 ? color : 0xfff176, Math.cos(a) * 0.36, -0.05, Math.sin(a) * 0.36)); } }
  if (model === 'crown') { h.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 8, 1, true), color, 0, 0, 0, 0x552200)); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; h.add(mesh(new THREE.ConeGeometry(0.06, 0.18, 4), color, Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3)); } h.add(mesh(sph(0.06), 0xff3355, 0, 0.05, 0.3, 0x660000)); }
  return h;
}

export function buildEnemy(shape: string, color: number) {
  const g = new THREE.Group();
  if (shape === 'blob') { const b = mesh(sph(0.5), color, 0, 0.45, 0); b.scale.y = 0.8; g.add(b); g.add(mesh(new THREE.ConeGeometry(0.15, 0.3, 6), 0x3f8f3a, 0, 0.95, 0)); }
  else if (shape === 'pup') { g.add(mesh(new THREE.CapsuleGeometry(0.3, 0.4, 4, 8), color, 0, 0.45, 0)); g.children[0].rotation.x = Math.PI / 2; g.add(mesh(sph(0.3), color, 0, 0.7, 0.35)); for (let i = 0; i < 5; i++) g.add(mesh(new THREE.ConeGeometry(0.07, 0.25, 4), 0x4a6b2a, 0, 0.8, -0.2 + i * 0.1)); }
  else if (shape === 'imp') { g.add(mesh(sph(0.42), color, 0, 0.6, 0, 0x551100)); for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.08, 0.3, 6), 0x3a1a10, s * 0.2, 1.0, 0); h.rotation.z = -s * 0.4; g.add(h); } g.add(mesh(new THREE.ConeGeometry(0.2, 0.4, 6), 0xffcc33, 0, 1.2, 0, 0xaa5500)); }
  else { const b = mesh(sph(0.6), color, 0, 0.7, 0, 0x330000); b.scale.set(1.2, 0.9, 1.3); g.add(b); g.add(mesh(sph(0.4), color, 0, 1.0, 0.6)); for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.1, 0.5, 6), 0xfff0d0, s * 0.3, 1.4, 0.5); h.rotation.z = -s * 0.5; g.add(h); } g.add(mesh(new THREE.ConeGeometry(0.3, 0.6, 6), 0xffa020, 0, 1.6, 0, 0xaa4400)); }
  for (const s of [-1, 1]) { const ey = shape === 'pup' ? [s * 0.12, 0.78, 0.6] : shape === 'boss' ? [s * 0.18, 1.1, 0.95] : [s * 0.15, shape === 'imp' ? 0.7 : 0.55, shape === 'imp' ? 0.38 : 0.42]; g.add(mesh(sph(0.07), 0x1a1a22, ey[0], ey[1], ey[2])); }
  return g;
}

export function buildTree(kind: 'round' | 'pine' | 'dead' | 'shroom', s = 1) {
  const g = new THREE.Group();
  if (kind === 'shroom') { g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8), 0xf5ead0, 0, 0.4, 0)); g.add(mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe85d5d, 0, 0.75, 0)); }
  else { g.add(mesh(new THREE.CylinderGeometry(0.15, 0.22, 1, 6), kind === 'dead' ? 0x4a3328 : 0x8b5a3c, 0, 0.5, 0));
    if (kind === 'round') { g.add(mesh(new THREE.IcosahedronGeometry(0.8, 0), 0x5cbf5a, 0, 1.5, 0)); g.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), 0x77d36e, 0.3, 1.95, 0.1)); }
    if (kind === 'pine') { g.add(mesh(new THREE.ConeGeometry(0.8, 1.3, 7), 0x2f8f5a, 0, 1.4, 0)); g.add(mesh(new THREE.ConeGeometry(0.6, 1.0, 7), 0x3aa86a, 0, 2.0, 0)); }
    if (kind === 'dead') { for (const s2 of [-1, 1]) { const b = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5), 0x4a3328, s2 * 0.25, 1.1, 0); b.rotation.z = -s2 * 0.7; g.add(b); } }
  }
  g.scale.setScalar(s); return g;
}

export function buildHouse(wall: number, roof: number, w = 3, d = 3) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, 2, d), wall, 0, 1, 0));
  const r = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 1.4, 4), roof, 0, 2.7, 0); r.rotation.y = Math.PI / 4; g.add(r);
  g.add(mesh(new THREE.BoxGeometry(0.7, 1.1, 0.1), 0x8b5a3c, 0, 0.55, d / 2 + 0.03));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), 0xbfe6ff, s * w * 0.3, 1.3, d / 2 + 0.03));
  return g;
}

export function buildStall(awning: number) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2, 0.8, 1), 0xc99a6a, 0, 0.4, 0));
  for (const x of [-0.9, 0.9]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), 0x8b5a3c, x, 1, -0.4));
  const a = mesh(new THREE.BoxGeometry(2.3, 0.1, 1.4), awning, 0, 2, -0.1); a.rotation.x = 0.25; g.add(a);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), [0xffd36e, 0x9ec9ff, 0xff9fb5][i], -0.5 + i * 0.5, 0.95, 0));
  return g;
}

export function buildChest(rarity: string) {
  const col = rarity === 'epic' ? 0x9b4dff : rarity === 'rare' ? 0x3d8bff : 0xb07a45;
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), col, 0, 0.25, 0));
  const lid = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI), col, 0, 0.5, 0); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; g.add(lid);
  g.add(mesh(new THREE.BoxGeometry(0.15, 0.2, 0.05), 0xffd700, 0, 0.5, 0.32, 0x664400));
  g.userData.lid = lid; return g;
}

export function buildPortal(color: number) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(1, 0.12, 8, 24), color, 0, 1.2, 0, color); g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); disc.position.y = 1.2; g.add(disc);
  g.add(mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.15, 16), 0xdddddd, 0, 0.07, 0));
  return g;
}

/** Den furniture, built procedurally from primitives. Footprint is ~1 grid cell (rugs/beds bigger). */
export function buildFurniture(model: string, color: number) {
  const g = new THREE.Group();
  switch (model) {
    case 'bed': g.add(mesh(new THREE.BoxGeometry(1.6, 0.4, 2.2), 0xa77a52, 0, 0.2, 0)); g.add(mesh(new THREE.BoxGeometry(1.5, 0.25, 2.0), color, 0, 0.5, 0.05)); g.add(mesh(new THREE.BoxGeometry(1.0, 0.2, 0.45), 0xffffff, 0, 0.7, -0.7)); g.add(mesh(new THREE.BoxGeometry(1.6, 0.9, 0.12), 0xa77a52, 0, 0.45, -1.1)); break;
    case 'rug': g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.04, 24), color, 0, 0.02, 0)); g.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 24), 0xffffff, 0, 0.025, 0)); break;
    case 'lamp': g.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 12), 0x8b5a3c, 0, 0.05, 0)); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), 0x8b5a3c, 0, 0.6, 0)); g.add(mesh(new THREE.SphereGeometry(0.3, 12, 8), color, 0, 1.25, 0, color)); { const l = new THREE.PointLight(color, 1.2, 4); l.position.y = 1.3; g.add(l); } break;
    case 'plant': g.add(mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.4, 10), 0xd9784a, 0, 0.2, 0)); for (let i = 0; i < 5; i++) { const a = i * 1.25; const leaf = mesh(new THREE.SphereGeometry(0.2, 8, 6), color, Math.cos(a) * 0.15, 0.6 + (i % 2) * 0.15, Math.sin(a) * 0.15); leaf.scale.set(0.6, 1.4, 0.6); g.add(leaf); } break;
    case 'table': g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), 0xf5ead0, 0, 0.3, 0)); g.add(mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.15, 16), color, 0, 0.65, 0)); for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), 0xffffff, Math.cos(i * 1.6) * 0.35, 0.73, Math.sin(i * 1.6) * 0.35)); break;
    case 'chair': g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12), color, 0, 0.2, 0)); g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12), 0xffffff, 0, 0.45, 0)); g.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), 0xffd700, 0, 0.52, 0)); break;
    case 'art': g.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.08), 0xa77a52, 0, 1.6, -0.45)); g.add(mesh(new THREE.BoxGeometry(1.0, 0.7, 0.04), color, 0, 1.6, -0.4)); g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), 0xfff176, 0.2, 1.65, -0.37)); break;
    case 'shelf': g.add(mesh(new THREE.BoxGeometry(1.2, 1.6, 0.45), color, 0, 0.8, 0)); for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.12, 0.35, 0.3), [0xff8fb8, 0x6ecbff, 0xffd36e, 0x8fe08a][i], -0.4 + i * 0.25, 0.3 + r * 0.5, 0.05)); break;
    case 'hearth': g.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 0.6), 0x9a8a80, 0, 0.6, 0)); g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), 0x222222, 0, 0.4, 0.27)); g.add(mesh(new THREE.ConeGeometry(0.2, 0.4, 6), color, 0, 0.35, 0.25, color)); { const l = new THREE.PointLight(color, 1.5, 4); l.position.set(0, 0.5, 0.6); g.add(l); } break;
    case 'throne': g.add(mesh(new THREE.BoxGeometry(1, 0.5, 0.9), 0xb23a2e, 0, 0.25, 0)); g.add(mesh(new THREE.BoxGeometry(1, 1.6, 0.2), color, 0, 0.8, -0.4, 0x553300)); for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.1, 0.35, 6), color, s * 0.4, 1.75, -0.4)); break;
    default: g.add(mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), color, 0, 0.4, 0));
  }
  return g;
}

/** Small held weapon, shaped by its stat leaning and tinted by rarity. Attached to a chibi's right paw. */
export function buildWeapon(itemId: string) {
  const it = ITEMS[itemId]; const g = new THREE.Group(); if (!it) return g;
  const tint = it.rarity === 'epic' ? 0xffc94d : it.rarity === 'rare' ? 0x6fb7ff : 0xd8dde6;
  const glow = it.rarity === 'epic' ? 0x664400 : it.rarity === 'rare' ? 0x113366 : 0;
  const wood = 0x8b5a3c;
  if (it.stat === 'mag') { g.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 6), wood, 0, 0.3, 0)); g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), tint, 0, 0.8, 0, glow || 0x224466)); }
  else if (it.stat === 'chr') { g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), 0xffffff, 0, 0.2, 0)); for (const s of [-1, 1]) { const b = mesh(new THREE.ConeGeometry(0.08, 0.16, 6), it.rarity === 'common' ? 0xff5c8a : tint, s * 0.09, 0.52, 0); b.rotation.z = s * Math.PI / 2; g.add(b); } }
  else if (it.stat === 'sen') { g.add(mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), wood, 0, 0, 0)); g.add(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.06), 0xffd36e, 0, 0.08, 0)); const bl = mesh(new THREE.ConeGeometry(0.06, 0.45, 4), tint, 0, 0.32, 0, glow); g.add(bl); }
  else { if (itemId === 'acorn_club') { g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6), wood, 0, 0.15, 0)); g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), 0xa77a52, 0, 0.45, 0)); }
    else { g.add(mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), wood, 0, 0, 0)); g.add(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.07), 0xffd36e, 0, 0.09, 0)); g.add(mesh(new THREE.BoxGeometry(0.09, 0.65, 0.03), tint, 0, 0.45, 0, glow)); } }
  return g;
}
export function attachWeapon(chibi: THREE.Group, itemId: string) {
  const w = buildWeapon(itemId); w.position.set(0.42, 0.5, 0.12); w.rotation.set(0.5, 0, -0.35); chibi.add(w); chibi.userData.weapon = w; return w;
}
