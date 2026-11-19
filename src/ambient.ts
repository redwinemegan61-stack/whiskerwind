// Living-world layer: day/night cycle, gentle weather, instanced props and ambient critters.
// Everything here is cosmetic and cheap: instanced meshes, a few hundred particles, zero extra lights.
import * as THREE from 'three';
import { ZoneId } from './data';
import { W, place, label, sparkTex } from './world';
import { GLOW, buildTree, mesh, toon } from './models';
import { S } from './state';

export type Weather = 'clear' | 'rain' | 'petals' | 'leaves' | 'fog' | 'embers';
export const CYCLE_S = 540; // 9-minute day
const GFX_KEY = 'whiskerwind-gfx';

export const AMB = {
  tod: 0.35, todOverride: null as number | null, night: 0, weather: 'clear' as Weather, weatherT: 0, nextWeather: 0, forcedWeather: null as Weather | null,
  fps: 60, frames: 0, fpsT: 0, slowSecs: 0, autoLow: true,
};

/** Decide graphics quality before the renderer exists. ?gfx=low|high or the saved menu choice override the heuristic. */
export function detectLowPower() {
  const q = new URLSearchParams(location.search).get('gfx'); const saved = localStorage.getItem(GFX_KEY);
  const pick = q ?? saved;
  if (pick === 'low') { AMB.autoLow = false; return true; }
  if (pick === 'high') { AMB.autoLow = false; return false; }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = Math.min(screen.width, screen.height) < 500;
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3 || (small && devicePixelRatio >= 3);
}
export function setGfx(mode: 'low' | 'high' | 'auto') { if (mode === 'auto') localStorage.removeItem(GFX_KEY); else localStorage.setItem(GFX_KEY, mode); }
export function gfxMode(): 'low' | 'high' | 'auto' { return (localStorage.getItem(GFX_KEY) as 'low' | 'high') ?? 'auto'; }

// ---------- shared resources (created once) ----------
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const geo = {
  petal: new THREE.ConeGeometry(0.11, 0.16, 5), center: new THREE.SphereGeometry(0.05, 5, 4),
  tuft: new THREE.ConeGeometry(0.07, 0.34, 4), cap: new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), stem: new THREE.CylinderGeometry(0.06, 0.08, 0.22, 6),
  wing: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.22, 0, 0.12, 0.2, 0, -0.14, 0, 0, 0, -0.22, 0, 0.12, -0.2, 0, -0.14], 3)); g.computeVertexNormals(); return g; })(),
  bird: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0.55, 0.12, -0.1, 0, 0, -0.1, 0, 0, 0.15, 0, 0, -0.1, -0.55, 0.12, -0.1], 3)); g.computeVertexNormals(); return g; })(),
  leaf: new THREE.PlaneGeometry(0.16, 0.11), fish: new THREE.SphereGeometry(0.16, 8, 6), post: new THREE.BoxGeometry(0.14, 0.8, 0.14), rail: new THREE.BoxGeometry(0.08, 0.08, 1.6),
};
const mat = {
  flower: new THREE.MeshToonMaterial({ color: 0xffffff }), white: new THREE.MeshToonMaterial({ color: 0xfff6c8 }),
  grass: new THREE.MeshToonMaterial({ color: 0x5fae4f }), cap: new THREE.MeshToonMaterial({ color: 0xffffff }), stem: new THREE.MeshToonMaterial({ color: 0xfff2dc }),
  wing: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), bird: new THREE.MeshBasicMaterial({ color: 0x3a3550, side: THREE.DoubleSide }),
  leaf: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }),
  fish: new THREE.MeshToonMaterial({ color: 0xff9a4d }), wood: new THREE.MeshToonMaterial({ color: 0xa77a52 }),
  glow: new THREE.SpriteMaterial({ color: 0xffc46b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1), tmpC = new THREE.Color();

// persistent (scene-level) particle systems that follow the player
let rain: THREE.LineSegments, rainPos: Float32Array, drift: THREE.InstancedMesh, driftData: Float32Array, embers: THREE.Points, emberPos: Float32Array,
  flies: THREE.Points, fliesPos: Float32Array, waterStars: THREE.Points, moonGlint: THREE.Sprite;
const N = { rain: 700, drift: 110, embers: 140, flies: 46, stars: 260 };

export function initAmbient() {
  mat.glow.map = sparkTex();
  const k = W.lowPower ? 0.5 : 1;
  N.rain = Math.round(N.rain * k); N.drift = Math.round(N.drift * k); N.embers = Math.round(N.embers * k); N.flies = Math.round(N.flies * k);
  // rain: short streaks in a box around the player
  rainPos = new Float32Array(N.rain * 6); for (let i = 0; i < N.rain; i++) resetDrop(i, true);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.8, depthWrite: false })); rain.frustumCulled = false; rain.visible = false;
  // petals / leaves: instanced little quads tumbling down
  drift = new THREE.InstancedMesh(geo.leaf, mat.leaf, N.drift); drift.frustumCulled = false; drift.visible = false; driftData = new Float32Array(N.drift * 6);
  for (let i = 0; i < N.drift; i++) { driftData.set([(rnd() - 0.5) * 30, rnd() * 9, (rnd() - 0.5) * 30, rnd() * 6, 0.5 + rnd(), rnd() * 6], i * 6); }
  // embers rising (Cinder Hollow)
  emberPos = new Float32Array(N.embers * 3); for (let i = 0; i < N.embers; i++) emberPos.set([(rnd() - 0.5) * 34, rnd() * 8, (rnd() - 0.5) * 34], i * 3);
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xff8a3d, size: 0.22, map: sparkTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); embers.frustumCulled = false; embers.visible = false;
  // fireflies (night)
  fliesPos = new Float32Array(N.flies * 3); for (let i = 0; i < N.flies; i++) fliesPos.set([(rnd() - 0.5) * 26, 0.4 + rnd() * 2.2, (rnd() - 0.5) * 26], i * 3);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fliesPos, 3));
  flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xeaff8a, size: 0.32, map: sparkTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flies.frustumCulled = false;
  // stars reflected on the sea + a moon glint (the iso camera never sees the sky itself)
  const sp = new Float32Array(N.stars * 3); for (let i = 0; i < N.stars; i++) { const a = rnd() * Math.PI * 2, r = 30 + rnd() * 70; sp.set([Math.cos(a) * r, -0.86, Math.sin(a) * r], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  waterStars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, map: sparkTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex(), color: 0xdfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); moonGlint.scale.set(14, 5, 1);
  W.scene.add(rain, drift, embers, flies, waterStars, moonGlint);
}
function resetDrop(i: number, any = false) {
  const p = W.player?.position ?? tmpV.set(0, 0, 0); const x = p.x + (Math.random() - 0.5) * 28, z = p.z + (Math.random() - 0.5) * 28, y = any ? Math.random() * 12 : 10 + Math.random() * 3;
  rainPos.set([x, y, z, x + 0.06, y - 0.7, z + 0.06], i * 6);
}

// ---------- per-zone props & critters ----------
interface Critter { g: THREE.Object3D; home: THREE.Vector2; to: THREE.Vector2; hop: number; flee: number; kind: 'bunny' }
let critters: Critter[] = [];
let flutter: { mesh: THREE.InstancedMesh; data: Float32Array } | null = null;
let birds: { mesh: THREE.InstancedMesh; data: Float32Array } | null = null;
let jumpers: { mesh: THREE.InstancedMesh; data: Float32Array; r0: number } | null = null;
let pondFish: { mesh: THREE.InstancedMesh; ponds: { x: number; z: number; r: number }[] } | null = null;
let glows: THREE.Sprite[] = []; let waters: THREE.Mesh[] = [];
let zoneId: ZoneId = 'town';
export const PONDS: Record<string, { x: number; z: number; r: number }[]> = { town: [{ x: 10.5, z: -1.5, r: 2 }], woods: [{ x: -6, z: 10, r: 2 }], hollow: [], den: [] };
export const STREAM_Z = (x: number) => -2.2 + Math.sin(x * 0.22) * 1.4; // Mossmere stream centreline

function clearSpot(x: number, z: number, pad = 0.9) {
  if (Math.abs(x) < 1.7) return false; // main path
  for (const c of W.colliders) if (Math.hypot(c.x - x, c.z - z) < c.r + pad) return false;
  for (const i of W.interact) if (Math.hypot(i.x - x, i.z - z) < 1.2) return false;
  for (const p of PONDS[zoneId] ?? []) if (Math.hypot(p.x - x, p.z - z) < p.r + 0.4) return false;
  return true;
}
function instanced(g: THREE.BufferGeometry, m: THREE.Material, pts: { x: number; z: number; y?: number; s?: number; r?: number; c?: number }[], shadow = false) {
  const im = new THREE.InstancedMesh(g, m, Math.max(1, pts.length)); im.count = pts.length;
  pts.forEach((p, i) => { tmpE.set(0, p.r ?? 0, 0); tmpQ.setFromEuler(tmpE); const s = p.s ?? 1; tmpM.compose(tmpV.set(p.x, p.y ?? 0, p.z), tmpQ, tmpS.set(s, s, s)); im.setMatrixAt(i, tmpM); if (p.c !== undefined) im.setColorAt(i, tmpC.setHex(p.c)); });
  im.castShadow = shadow; im.receiveShadow = false; W.zone.add(im); return im;
}
function scatterPts(n: number, minR: number, maxR: number, ok: (x: number, z: number) => boolean = () => true) {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) { const a = rnd() * Math.PI * 2, r = minR + Math.sqrt(rnd()) * (maxR - minR); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (clearSpot(x, z) && ok(x, z)) out.push({ x, z }); }
  return out;
}
function flowers(n: number, palette: number[], minR: number, maxR: number, ok?: (x: number, z: number) => boolean) {
  const pts = scatterPts(n, minR, maxR, ok);
  // little clumps of 3 petals + center
  const petals: { x: number; z: number; y: number; s: number; r: number; c: number }[] = []; const centers: { x: number; z: number; y: number }[] = [];
  for (const p of pts) { const c = palette[Math.floor(rnd() * palette.length)]; for (let j = 0; j < 3; j++) { const a = j / 3 * Math.PI * 2 + rnd(); petals.push({ x: p.x + Math.cos(a) * 0.08, z: p.z + Math.sin(a) * 0.08, y: 0.1, s: 0.8 + rnd() * 0.5, r: a, c }); } centers.push({ x: p.x, z: p.z, y: 0.16 }); }
  instanced(geo.petal, mat.flower, petals); instanced(geo.center, mat.white, centers);
}
function grass(n: number, minR: number, maxR: number, color: number) {
  const pts = scatterPts(n, minR, maxR).flatMap(p => [0, 1, 2].map(j => ({ x: p.x + (j - 1) * 0.09, z: p.z + (rnd() - 0.5) * 0.12, y: 0.15, s: 0.7 + rnd() * 0.6, r: rnd() * 6, c: color })));
  instanced(geo.tuft, mat.grass, pts);
}
function mushrooms(n: number, minR: number, maxR: number, palette: number[]) {
  const pts = scatterPts(n, minR, maxR);
  instanced(geo.stem, mat.stem, pts.map(p => ({ ...p, y: 0.11 })));
  instanced(geo.cap, mat.cap, pts.map(p => ({ ...p, y: 0.2, c: palette[Math.floor(rnd() * palette.length)], s: 0.8 + rnd() * 0.5 })));
}
function lantern(x: number, z: number, h = 1.7) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), 0x5a4038, 0, h / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), 0x5a4038, 0.18, h - 0.05, 0));
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), GLOW.lantern); lamp.position.set(0.36, h - 0.28, 0); g.add(lamp);
  const s = new THREE.Sprite(mat.glow); s.scale.set(2.2, 2.2, 1); s.position.copy(lamp.position); g.add(s); glows.push(s);
  place(g, x, z, rnd() * 6, 0.25); return g;
}
function signpost(x: number, z: number, lines: string[], rot = 0) {
  const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.5, 6), 0x8b5a3c, 0, 0.75, 0));
  lines.forEach((_, i) => { const b = mesh(new THREE.BoxGeometry(1.1, 0.24, 0.06), 0xd9b48a, i % 2 ? -0.2 : 0.2, 1.3 - i * 0.32, 0); b.rotation.y = i % 2 ? 0.25 : -0.15; g.add(b); });
  g.add(label(lines.join(' · '), '#fff3c8', 2.1, 0.55)); place(g, x, z, rot, 0.3); return g;
}
function fence(x1: number, z1: number, x2: number, z2: number) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(len / 1.6) + 1), ang = Math.atan2(x2 - x1, z2 - z1);
  const posts = [] as { x: number; z: number; y: number }[], rails = [] as { x: number; z: number; y: number; r: number }[];
  for (let i = 0; i < n; i++) { const f = i / (n - 1); posts.push({ x: x1 + (x2 - x1) * f, z: z1 + (z2 - z1) * f, y: 0.4 }); }
  for (let i = 0; i < n - 1; i++) { const f = (i + 0.5) / (n - 1); for (const y of [0.35, 0.65]) rails.push({ x: x1 + (x2 - x1) * f, z: z1 + (z2 - z1) * f, y, r: ang }); }
  instanced(geo.post, mat.wood, posts, true); const rm = instanced(geo.rail, mat.wood, rails, true);
  // scale rails to segment length
  const seg = len / (n - 1) / 1.6; rails.forEach((r, i) => { tmpE.set(0, r.r, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(r.x, r.y, r.z), tmpQ, tmpS.set(1, 1, seg)); rm.setMatrixAt(i, tmpM); });
}
function pond(p: { x: number; z: number; r: number }, color = 0x7fd4f0) {
  const rim = new THREE.Mesh(new THREE.CircleGeometry(p.r + 0.35, 28), toon(0xb9a27a)); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, 0.012, p.z); W.zone.add(rim);
  const w = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), new THREE.MeshToonMaterial({ color })); w.rotation.x = -Math.PI / 2; w.position.set(p.x, 0.02, p.z); w.name = 'pondwater'; W.zone.add(w); waters.push(w);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; const pad = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), 0x5fbf6a, p.x + Math.cos(a) * p.r * 0.7, 0.04, p.z + Math.sin(a) * p.r * 0.7); if (i % 3 === 0) W.zone.add(pad); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; W.zone.add(mesh(new THREE.DodecahedronGeometry(0.22, 0), 0xa8a2b0, p.x + Math.cos(a) * (p.r + 0.3), 0.08, p.z + Math.sin(a) * (p.r + 0.3))); }
}
function stream() {
  const pts: number[] = []; const idx: number[] = []; const seg = 60, w = 0.9;
  for (let i = 0; i <= seg; i++) { const x = -32 + i / seg * 64, z = STREAM_Z(x); pts.push(x, 0.016, z - w, x, 0.016, z + w); if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: 0x86d8f2 })); m.receiveShadow = true; m.name = 'stream'; W.zone.add(m); waters.push(m);
  // wooden bridge where the main path crosses
  const b = new THREE.Group(); const z0 = STREAM_Z(0);
  for (let i = 0; i < 7; i++) b.add(mesh(new THREE.BoxGeometry(2.4, 0.08, 0.32), i % 2 ? 0xb88a5a : 0xa77a52, 0, 0.12 + Math.sin(i / 6 * Math.PI) * 0.12, -1.05 + i * 0.35));
  for (const sx of [-1.15, 1.15]) { for (const zz of [-1, 0, 1]) b.add(mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), 0x8b5a3c, sx, 0.4, zz)); const r = mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), 0x8b5a3c, sx, 0.66, 0); b.add(r); }
  place(b, 0, z0);
}
function bunny(x: number, z: number, color = 0xfff4e8) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), color, 0, 0.2, 0)); g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), color, 0, 0.36, 0.15));
  for (const s of [-1, 1]) { const e = mesh(new THREE.CapsuleGeometry(0.035, 0.18, 3, 6), color, s * 0.06, 0.55, 0.12); e.rotation.z = s * 0.2; g.add(e); }
  g.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), 0xffffff, 0, 0.22, -0.2));
  g.scale.setScalar(1.1); place(g, x, z); critters.push({ g, home: new THREE.Vector2(x, z), to: new THREE.Vector2(x, z), hop: rnd() * 3, flee: 0, kind: 'bunny' });
}
function makeButterflies(n: number, colors: number[]) {
  const m = new THREE.InstancedMesh(geo.wing, mat.wing, n); m.frustumCulled = false; const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { data.set([(rnd() - 0.5) * 24, (rnd() - 0.5) * 24, rnd() * 6, 0.6 + rnd() * 0.6], i * 4); m.setColorAt(i, tmpC.setHex(colors[i % colors.length])); }
  W.zone.add(m); flutter = { mesh: m, data };
}
function makeBirds(n: number) {
  const m = new THREE.InstancedMesh(geo.bird, mat.bird, n); m.frustumCulled = false; const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([rnd() * 6, 9 + rnd() * 6, 7 + rnd() * 3], i * 3);
  W.zone.add(m); birds = { mesh: m, data };
}
function makeJumpers(n: number, r0: number) {
  const m = new THREE.InstancedMesh(geo.fish, mat.fish, n); m.frustumCulled = false; const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([rnd() * Math.PI * 2, -rnd() * 4, 2 + rnd() * 5], i * 3);
  W.zone.add(m); jumpers = { mesh: m, data, r0 };
}
function makePondFish(ponds: { x: number; z: number; r: number }[]) {
  if (!ponds.length) { pondFish = null; return; }
  const m = new THREE.InstancedMesh(geo.fish, new THREE.MeshBasicMaterial({ color: 0x2a5a7a, transparent: true, opacity: 0.45 }), ponds.length * 3); W.zone.add(m); pondFish = { mesh: m, ponds };
}

export function buildAmbient(z: ZoneId) {
  zoneId = z; critters = []; flutter = birds = jumpers = null; pondFish = null; glows = []; waters = []; seed = z === 'town' ? 11 : z === 'woods' ? 23 : 37;
  const lp = W.lowPower ? 0.55 : 1; const n = (k: number) => Math.round(k * lp);
  if (z === 'den') { AMB.weather = 'clear'; return; }
  const size = W.bound + 1;
  if (z === 'town') {
    PONDS.town.forEach(p => pond(p));
    flowers(n(150), [0xff8fb8, 0xfff176, 0xffffff, 0xb38bff, 0xff9a7a], 3, size - 1.5);
    grass(n(110), 4, size - 1, 0x5fae4f);
    fence(-12.5, 5.2, -6.5, 5.2); fence(-12.5, 5.2, -12.5, 12.5); fence(4.5, 11.5, 11, 11.5); fence(8.6, -4.2, 12.6, -4.2);
    for (const [x, z2] of [[1.9, -6], [-1.9, -9], [1.9, 6], [-1.9, 10], [6, 1.6], [-6, -1.6], [10, 1.6], [-10, 1.6]] as [number, number][]) lantern(x, z2);
    signpost(2.2, -10.2, ['↑ Mossmere Woods', 'Bellbrook ↓']);
    signpost(4.2, 1.9, ['Market', 'Den ↙']);
    for (let i = 0; i < 4; i++) bunny(-11 + i * 7.5, i % 2 ? -12 : 12.5 - i, [0xfff4e8, 0xd9c2a8, 0xc8c8d8][i % 3]);
    makeButterflies(n(12), [0xff8fb8, 0xfff176, 0x9fd8ff, 0xffffff]); makeBirds(5); makeJumpers(4, size + 2); makePondFish(PONDS.town);
  } else if (z === 'woods') {
    stream(); PONDS.woods.forEach(p => pond(p, 0x78cfe4));
    flowers(n(130), [0xff8fb8, 0xfff176, 0xffffff, 0x9fd8ff], 3, size - 1);
    grass(n(160), 3, size - 1, 0x4f9a46);
    mushrooms(n(70), 3, size - 1, [0xe85d5d, 0xff9a4d, 0xf5f0e0, 0x8fd0ff]);
    for (const zz of [9, 4, -6, -11]) lantern(zz % 2 ? 1.7 : -1.7, zz);
    signpost(2.1, 11, ['Bellbrook ↓', '↑ Cinder Hollow']); signpost(-2.4, 1.2, ['← Sunbeam Glade', 'Mossbeard ↙'], 0.4);
    for (let i = 0; i < 3; i++) bunny(-14 + i * 12, 12 - i * 9, [0xd9c2a8, 0xfff4e8, 0xb8a090][i]);
    makeButterflies(n(10), [0xfff176, 0x9fd8ff, 0xff8fb8]); makeBirds(4); makeJumpers(3, size + 2); makePondFish(PONDS.woods);
  } else if (z === 'hollow') {
    flowers(n(50), [0xff5c2a, 0xffb03b, 0xff7a5a], 4, size - 2);
    for (const zz of [10, 5, 0, -4]) lantern(zz % 2 ? 2 : -2, zz, 1.5);
    signpost(2.4, 11.5, ['↑ Smoulderjaw Lair', 'Woods ↓']);
    // charred stumps for texture
    scatterPts(n(14), 5, size - 3).forEach(p => place(buildTree('dead', 0.55), p.x, p.z, rnd() * 6, 0.4));
  }
  pickWeather(true);
}

function pickWeather(initial = false) {
  const now = performance.now() / 1000; AMB.nextWeather = now + 110 + Math.random() * 90;
  if (AMB.forcedWeather) { AMB.weather = AMB.forcedWeather; return; }
  const opts: [Weather, number][] = zoneId === 'town' ? [['clear', 5], ['petals', 3], ['rain', 2]] : zoneId === 'woods' ? [['leaves', 4], ['fog', 3], ['rain', 2], ['clear', 2]] : zoneId === 'hollow' ? [['embers', 1]] : [['clear', 1]];
  let r = Math.random() * opts.reduce((a, o) => a + o[1], 0); for (const [w, k] of opts) { r -= k; if (r <= 0) { AMB.weather = w; break; } }
  if (initial && zoneId === 'woods' && AMB.weather === 'clear') AMB.weather = 'leaves';
}
export function setWeather(w: Weather | null) { AMB.forcedWeather = w; pickWeather(); }
export function setTimeOfDay(x: number | null) { AMB.todOverride = x; }

// ---------- per-frame ----------
const C = {
  day: { town: 0xcfeefc, woods: 0xb8e0c0, hollow: 0xf0b9a0, den: 0x2a2340 } as Record<string, number>,
  dusk: 0xffb38a, night: { town: 0x1d2550, woods: 0x14283c, hollow: 0x2e141a, den: 0x2a2340 } as Record<string, number>,
};
const cA = new THREE.Color(), cB = new THREE.Color(), cSky = new THREE.Color();
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function updateAmbient(dt: number, t: number, p: THREE.Vector3) {
  // fps watchdog -> auto low-power
  AMB.frames++; AMB.fpsT += dt;
  if (AMB.fpsT >= 1) { AMB.fps = AMB.frames / AMB.fpsT; AMB.frames = 0; AMB.fpsT = 0; if (AMB.autoLow && !W.lowPower && AMB.fps < 38 && document.visibilityState === 'visible') { if (++AMB.slowSecs >= 6) enterLowPower(); } else AMB.slowSecs = 0; }

  AMB.tod = AMB.todOverride ?? ((Date.now() / 1000 / CYCLE_S + 0.3) % 1);
  const elev = Math.sin((AMB.tod - 0.25) * Math.PI * 2); // -1 midnight … 1 noon
  const day = smooth(-0.12, 0.3, elev); const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * (1 - smooth(0.25, 0.4, elev)); AMB.night = 1 - day;
  const z = S?.zone ?? 'town'; const indoor = z === 'den';
  const sun = W.sun, hemi = W.hemi;
  const wet = AMB.weather === 'rain' ? 1 : AMB.weather === 'fog' ? 0.6 : 0;
  AMB.weatherT += ((wet > 0 ? 1 : 0) - AMB.weatherT) * Math.min(1, dt * 0.5);
  if (!indoor) {
    cA.setHex(C.day[z]); cB.setHex(C.night[z]); cSky.copy(cB).lerp(cA, day); if (dusk > 0) cSky.lerp(cA.setHex(C.dusk), dusk * 0.45);
    if (AMB.weatherT > 0.01) cSky.lerp(cA.setHex(z === 'woods' ? 0x9fb5ab : 0x98a6ba), AMB.weatherT * 0.5);
    if (W.scene.background instanceof THREE.Color) W.scene.background.copy(cSky);
    const fog = W.scene.fog as THREE.Fog | null;
    if (fog) { fog.color.copy(cSky); const foggy = AMB.weather === 'fog' ? 1 : 0; fog.near += ((foggy ? 9 : 30) - fog.near) * Math.min(1, dt * 0.6); fog.far += ((foggy ? 34 : 70) - fog.far) * Math.min(1, dt * 0.6); }
    const dim = 1 - AMB.weatherT * (AMB.weather === 'rain' ? 0.38 : 0.2);
    hemi.intensity = (0.5 + 0.95 * day) * dim; hemi.color.setHex(0xffffff).lerp(cA.setHex(0x9fb0ff), AMB.night * 0.7);
    hemi.groundColor.setHex(0x8899aa).lerp(cA.setHex(0x2a3050), AMB.night * 0.6);
    sun.intensity = (0.32 + 1.3 * day) * dim; sun.color.setHex(0xfff2dd).lerp(cA.setHex(0xffa066), dusk * 0.8).lerp(cB.setHex(0xa8bcff), AMB.night * 0.9);
    // sun by day, moon by night: arc across the sky around the player
    const ang = (AMB.tod - 0.25) * Math.PI * 2; const moon = elev < 0; const a = moon ? ang + Math.PI : ang;
    sun.position.set(p.x + Math.cos(a) * 16, 8 + Math.abs(Math.sin(a)) * 14, p.z + 8 + Math.sin(a) * 4); sun.target.position.copy(p);
    // lights of town come on at dusk
    const glow = smooth(0.25, 0.75, AMB.night);
    GLOW.window.emissiveIntensity = glow * 0.9; GLOW.lantern.emissiveIntensity = 0.15 + glow * 1.1; mat.glow.opacity = glow * 0.75;
    waterStars.visible = AMB.night > 0.3; (waterStars.material as THREE.PointsMaterial).opacity = smooth(0.4, 0.9, AMB.night) * (0.6 + Math.sin(t * 2) * 0.15) * (1 - AMB.weatherT);
    moonGlint.position.set(p.x - 18, -0.8, p.z - 24); (moonGlint.material as THREE.SpriteMaterial).opacity = smooth(0.5, 0.9, AMB.night) * 0.55;
    for (const o of waters) (o.material as THREE.MeshToonMaterial).color.setHex(0x7fd4f0).lerp(cA.setHex(0x23406e), AMB.night * 0.8);
  } else { sun.intensity = 1.2; hemi.intensity = 1.2; GLOW.window.emissiveIntensity = 0.4; waterStars.visible = false; (moonGlint.material as THREE.SpriteMaterial).opacity = 0; }

  // weather swaps every couple of minutes
  if (performance.now() / 1000 > AMB.nextWeather) pickWeather();
  const w = indoor ? 'clear' : AMB.weather;
  // rain
  rain.visible = w === 'rain';
  if (rain.visible) { for (let i = 0; i < N.rain; i++) { const o = i * 6; rainPos[o + 1] -= 16 * dt; rainPos[o + 4] -= 16 * dt; if (rainPos[o + 4] < 0) resetDrop(i); } (rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; }
  // petals / leaves
  drift.visible = w === 'petals' || w === 'leaves' || (w === 'fog' && zoneId === 'woods');
  if (drift.visible) {
    mat.leaf.color.setHex(w === 'petals' ? 0xffb3cf : 0xd9a441);
    for (let i = 0; i < N.drift; i++) {
      const o = i * 6; driftData[o + 1] -= dt * 0.7 * driftData[o + 4]; driftData[o] += Math.sin(t * 0.8 + driftData[o + 5]) * dt * 0.6 + dt * 0.35; driftData[o + 3] += dt * 2;
      let x = driftData[o], y = driftData[o + 1], zz = driftData[o + 2];
      if (y < 0.05) { driftData[o + 1] = y = 7 + Math.random() * 3; }
      // keep around the player
      if (x - p.x > 15) x = driftData[o] -= 30; if (x - p.x < -15) x = driftData[o] += 30; if (zz - p.z > 15) zz = driftData[o + 2] -= 30; if (zz - p.z < -15) zz = driftData[o + 2] += 30;
      tmpE.set(driftData[o + 3], driftData[o + 3] * 0.7, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, y, zz), tmpQ, tmpS.set(1, 1, 1)); drift.setMatrixAt(i, tmpM);
      if (zoneId === 'woods' && w !== 'petals') drift.setColorAt(i, tmpC.setHex([0xe0a040, 0xc8d96a, 0xd07a3a][i % 3]));
    }
    drift.instanceMatrix.needsUpdate = true; if (drift.instanceColor) drift.instanceColor.needsUpdate = true;
  }
  // embers
  embers.visible = w === 'embers' || zoneId === 'hollow';
  if (embers.visible) { for (let i = 0; i < N.embers; i++) { const o = i * 3; emberPos[o + 1] += dt * (0.6 + (i % 5) * 0.15); emberPos[o] += Math.sin(t + i) * dt * 0.3; if (emberPos[o + 1] > 7) { emberPos[o + 1] = 0; emberPos[o] = p.x + (Math.random() - 0.5) * 30; emberPos[o + 2] = p.z + (Math.random() - 0.5) * 30; } } (embers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; }
  // fireflies at night (woods & town)
  const fm = flies.material as THREE.PointsMaterial; const fwant = !indoor && zoneId !== 'hollow' ? smooth(0.45, 0.85, AMB.night) * (w === 'rain' ? 0.2 : 1) : 0;
  fm.opacity = fwant * (0.75 + Math.sin(t * 3) * 0.25); flies.visible = fm.opacity > 0.02;
  if (flies.visible) { for (let i = 0; i < N.flies; i++) { const o = i * 3; fliesPos[o] += Math.sin(t * 0.7 + i * 1.7) * dt * 0.5; fliesPos[o + 1] = 0.5 + Math.abs(Math.sin(t * 0.5 + i)) * 1.8; fliesPos[o + 2] += Math.cos(t * 0.6 + i) * dt * 0.5;
      if (fliesPos[o] - p.x > 13) fliesPos[o] -= 26; if (fliesPos[o] - p.x < -13) fliesPos[o] += 26; if (fliesPos[o + 2] - p.z > 13) fliesPos[o + 2] -= 26; if (fliesPos[o + 2] - p.z < -13) fliesPos[o + 2] += 26; }
    (flies.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; }

  if (W.paused && !W.decorating) return; // critters freeze with the world while menus are up
  // butterflies (daytime)
  if (flutter) { const { mesh: m, data } = flutter; m.visible = AMB.night < 0.6 && w !== 'rain';
    if (m.visible) for (let i = 0; i < m.count; i++) { const o = i * 4; const ph = data[o + 2] + t * data[o + 3];
      const x = data[o] + Math.sin(ph * 0.7) * 2.2, zz = data[o + 1] + Math.cos(ph * 0.5) * 2.2, y = 0.8 + Math.sin(ph * 1.3) * 0.4 + 0.4;
      tmpE.set(0, ph, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, y, zz), tmpQ, tmpS.set(0.35 + Math.abs(Math.sin(t * 14 + i)) * 0.65, 1, 1)); m.setMatrixAt(i, tmpM); }
    m.instanceMatrix.needsUpdate = true; }
  if (birds) { const { mesh: m, data } = birds; m.visible = AMB.night < 0.5;
    for (let i = 0; i < m.count; i++) { const o = i * 3; const a = data[o] + t * 0.18; const x = Math.cos(a) * data[o + 2], zz = Math.sin(a) * data[o + 2];
      tmpE.set(0, -a, Math.sin(t * 6 + i) * 0.4); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, data[o + 1], zz), tmpQ, tmpS.set(1, 1, 1)); m.setMatrixAt(i, tmpM); }
    m.instanceMatrix.needsUpdate = true; }
  if (jumpers) { const { mesh: m, data, r0 } = jumpers;
    for (let i = 0; i < m.count; i++) { const o = i * 3; data[o + 1] += dt; if (data[o + 1] > 1.1) { data[o + 1] = -2 - Math.random() * 5; data[o] = Math.random() * Math.PI * 2; }
      const k = data[o + 1]; const vis = k >= 0; const x = Math.cos(data[o]) * (r0 + data[o + 2] * 0.5 + k * 1.2), zz = Math.sin(data[o]) * (r0 + data[o + 2] * 0.5 + k * 1.2);
      tmpE.set(0, -data[o], (k - 0.55) * 2); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, vis ? -0.9 + Math.sin(k / 1.1 * Math.PI) * 1.3 : -3, zz), tmpQ, tmpS.set(1, 0.7, 1.6)); m.setMatrixAt(i, tmpM); }
    m.instanceMatrix.needsUpdate = true; }
  if (pondFish) { const { mesh: m, ponds } = pondFish; let k = 0;
    for (const pd of ponds) for (let j = 0; j < 3; j++) { const a = t * (0.4 + j * 0.15) + j * 2; const r = pd.r * (0.3 + j * 0.2); tmpE.set(0, -a, 0); tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpV.set(pd.x + Math.cos(a) * r, 0.03, pd.z + Math.sin(a) * r), tmpQ, tmpS.set(0.7, 0.2, 1.4)); m.setMatrixAt(k++, tmpM); }
    m.instanceMatrix.needsUpdate = true; }
  // bunnies: idle hops, scamper away when you get close
  for (const c of critters) {
    const g = c.g; const dx = g.position.x - p.x, dz = g.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < 3 && c.flee <= 0) { c.flee = 1.6; c.to.set(g.position.x + dx / d * 4.5, g.position.z + dz / d * 4.5); const r = Math.hypot(c.to.x, c.to.y); if (r > W.bound - 1) c.to.multiplyScalar((W.bound - 1) / r); }
    c.flee -= dt; c.hop += dt * (c.flee > 0 ? 9 : 5);
    const tx = c.to.x - g.position.x, tz = c.to.y - g.position.z, td = Math.hypot(tx, tz);
    if (td > 0.15) { const sp = c.flee > 0 ? 4 : 0.9; g.position.x += tx / td * sp * dt; g.position.z += tz / td * sp * dt; g.rotation.y = Math.atan2(tx, tz); g.position.y = Math.abs(Math.sin(c.hop)) * (c.flee > 0 ? 0.35 : 0.18); }
    else { g.position.y = 0; if (Math.random() < dt * 0.4) c.to.set(c.home.x + (Math.random() - 0.5) * 5, c.home.y + (Math.random() - 0.5) * 5); }
  }
  void glows;
}

function enterLowPower() {
  W.lowPower = true; AMB.slowSecs = 0;
  W.renderer.setPixelRatio(Math.min(1, devicePixelRatio)); W.sun.castShadow = false;
  rain.geometry.setDrawRange(0, Math.floor(N.rain / 2) * 2); drift.count = Math.floor(N.drift / 2);
  (embers.geometry as THREE.BufferGeometry).setDrawRange(0, Math.floor(N.embers / 2)); (flies.geometry as THREE.BufferGeometry).setDrawRange(0, Math.floor(N.flies / 2));
  window.dispatchEvent(new CustomEvent('ww-lowpower'));
}
export function timeLabel() { const h = (AMB.tod * 24 + 24) % 24; const icon = h >= 6 && h < 18 ? (h < 8 ? '🌅' : h > 16.5 ? '🌇' : '☀️') : '🌙'; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 15) * 15; const ap = hh >= 12 ? 'pm' : 'am'; return `${icon} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}${ap}`; }
export const WEATHER_ICON: Record<Weather, string> = { clear: '', rain: '🌧️', petals: '🌸', leaves: '🍂', fog: '🌫️', embers: '🔥' };
