import * as THREE from 'three';
import { ENEMIES, ITEMS, ZONES, ZoneId, Rarity, DEN_THEMES } from './data';
import { S, species, save } from './state';
import { buildChibi, buildEnemy, buildTree, buildHouse, buildStall, buildChest, buildPortal, buildFurniture, mesh, toon, attachWeapon } from './models';

export interface Interactable { x: number; z: number; r: number; label: string; action: () => void; auto?: boolean; obj?: THREE.Object3D }
interface Enemy { id: string; g: THREE.Group; home: THREE.Vector2; alive: boolean; respawnAt: number; wander: THREE.Vector2; boss?: boolean }
interface Chest { id: string; rarity: Rarity; g: THREE.Group; x: number; z: number }

export const hooks = {
  battle: (_enemyId: string, _done: (won: boolean) => void) => {},
  openChest: (_id: string, _r: Rarity) => {},
  open: (_panel: string, _arg?: string) => {},
  prompt: (_t: string | null) => {},
  zoneChanged: () => {},
  toast: (_t: string) => {},
};

export const W = {
  renderer: null as unknown as THREE.WebGLRenderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(38, 1, 0.1, 300),
  zone: new THREE.Group(), player: new THREE.Group(), floor: null as THREE.Mesh | null,
  interact: [] as Interactable[], colliders: [] as { x: number; z: number; r: number }[], enemies: [] as Enemy[], chests: [] as Chest[],
  paused: false, decorating: false, wantInteract: false, target: null as THREE.Vector2 | null, keys: new Set<string>(), bound: 13,
  denPieces: new Map<number, THREE.Object3D>(), wallMeshes: [] as THREE.Mesh[],
  overlay: null as null | { render: (dt: number, t: number) => void },
};
const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
const timer = new THREE.Timer();

export function initWorld(container: HTMLElement) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(r.domElement); W.renderer = r;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4); W.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6); sun.position.set(12, 20, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 }); W.scene.add(sun); W.scene.add(sun.target);
  W.scene.userData.sun = sun;
  W.scene.add(W.zone); W.scene.add(W.player);
  const resize = () => { r.setSize(innerWidth, innerHeight); W.camera.aspect = innerWidth / innerHeight; W.camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); if ((e.target as HTMLElement)?.tagName === 'INPUT') return; W.keys.add(k); if (k === 'e' && !e.repeat) W.wantInteract = true; });
  addEventListener('keyup', e => W.keys.delete(e.key.toLowerCase()));
  r.domElement.addEventListener('pointerdown', onClick);
  r.setAnimationLoop(tick);
}

export function refreshPlayer() {
  W.player.clear();
  const sp = species(); const hat = S.wearing ? ITEMS[S.wearing] : null;
  const m = buildChibi(sp.animal, sp.color, sp.accent, hat?.model ?? null, hat?.color); if (S.equipped) attachWeapon(m, S.equipped);
  W.player.add(m); W.player.userData.model = m;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; W.player.add(ring);
}

export function groundPoint(cx: number, cy: number): THREE.Vector3 | null {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, W.camera);
  if (!W.floor) return null; const hit = raycaster.intersectObject(W.floor, false)[0]; return hit ? hit.point : null;
}
export function pickObjects(cx: number, cy: number, objs: THREE.Object3D[]) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, W.camera);
  return raycaster.intersectObjects(objs, true)[0] ?? null;
}

let pendingInteract: Interactable | null = null;
function onClick(e: PointerEvent) {
  if (W.paused || W.decorating || e.button !== 0) return;
  const objs = W.interact.filter(i => i.obj).map(i => i.obj!);
  const hit = pickObjects(e.clientX, e.clientY, objs);
  if (hit) { let o: THREE.Object3D | null = hit.object; const it = W.interact.find(i => { let p: THREE.Object3D | null = hit.object; while (p) { if (p === i.obj) return true; p = p.parent; } return false; }); if (it) { pendingInteract = it; W.target = new THREE.Vector2(it.x, it.z); return; } void o; }
  const p = groundPoint(e.clientX, e.clientY); if (p) { W.target = new THREE.Vector2(p.x, p.z); pendingInteract = null; marker(p); }
}
let markerMesh: THREE.Mesh | null = null;
function marker(p: THREE.Vector3) {
  if (!markerMesh) { markerMesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 20), new THREE.MeshBasicMaterial({ color: 0xffe066 })); markerMesh.rotation.x = -Math.PI / 2; W.scene.add(markerMesh); }
  markerMesh.position.set(p.x, 0.05, p.z); markerMesh.visible = true;
}

/** Name-tag sprite. Canvas is sized to the text (long names wrap to two lines) so it can be clamped on screen. */
export function label(text: string, color = '#ffffff', y = 2.4, scale = 1) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d')!; const font = 'bold 44px "Nunito", "Trebuchet MS", sans-serif';
  ctx.font = font;
  let lines = [text];
  if (ctx.measureText(text).width > 430 && text.includes(' ')) {
    const words = text.split(' '); let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) { const d = Math.abs(ctx.measureText(words.slice(0, i).join(' ')).width - ctx.measureText(words.slice(i).join(' ')).width); if (d < bestDiff) { bestDiff = d; best = i; } }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const tw = Math.min(600, Math.max(...lines.map(l => ctx.measureText(l).width))); const lh = 52;
  c.width = Math.ceil(tw + 48); c.height = 30 + lines.length * lh;
  ctx.font = font; ctx.fillStyle = 'rgba(40,30,60,0.75)'; ctx.beginPath(); (ctx as any).roundRect?.(4, 6, c.width - 8, c.height - 12, Math.min(34, (c.height - 12) / 2)); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 15 + lh / 2 + i * lh, 600));
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = (4 / 512) * scale; // same world size per canvas pixel as before
  s.scale.set(c.width * k, c.height * k, 1); s.position.y = y; s.renderOrder = 10;
  s.userData.isLabel = true; s.userData.base = s.scale.clone(); return s;
}

/** Keep name tags fully inside the viewport: shrink ones wider than the screen, slide others in from the edges. */
const _lp = new THREE.Vector3(), _lr = new THREE.Vector3(), _ls = new THREE.Vector3(), _lq = new THREE.Vector3();
function clampLabels() {
  const cam = W.camera; cam.updateMatrixWorld(); _lr.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
  const margin = 12 / innerWidth * 2; // ~12px
  W.zone?.traverse(o => {
    if (!o.userData.isLabel) return; const sp = o as THREE.Sprite; const base = sp.userData.base as THREE.Vector3;
    sp.scale.copy(base); sp.center.set(0.5, 0.5);
    sp.getWorldPosition(_lp); sp.getWorldScale(_ls);
    _lq.copy(_lp).project(cam); if (_lq.z > 1 || _lq.z < -1 || Math.abs(_lq.y) > 1.2) return;
    const cx = _lq.x; const half = Math.abs(_lp.addScaledVector(_lr, _ls.x / 2).project(cam).x - cx);
    let h = half; const maxHalf = 1 - margin;
    if (h > maxHalf) { const f = maxHalf / h; sp.scale.set(base.x * f, base.y * f, 1); h = maxHalf; }
    const lo = -1 + margin + h, hi = 1 - margin - h; const want = Math.min(hi, Math.max(lo, cx));
    if (Math.abs(want - cx) > 1e-4 && Math.abs(cx) < 1 + 2 * h) sp.center.x = 0.5 - (want - cx) / (2 * h);
  });
}

function addInteract(i: Interactable) { W.interact.push(i); }
function place<T extends THREE.Object3D>(o: T, x: number, z: number, rotY = 0, collide = 0): T { o.position.set(x, 0, z); o.rotation.y = rotY; W.zone.add(o); if (collide) W.colliders.push({ x, z, r: collide }); return o; }
function ground(size: number, color: number) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(size, size + 1.5, 1.2, 40), toon(color)); g.position.y = -0.6; g.receiveShadow = true; W.zone.add(g);
  const water = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshToonMaterial({ color: 0x7fd4f0 })); water.rotation.x = -Math.PI / 2; water.position.y = -0.9; W.zone.add(water);
  W.floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.4, size * 2.4), new THREE.MeshBasicMaterial({ visible: false })); W.floor.rotation.x = -Math.PI / 2; W.zone.add(W.floor);
}
function path(x1: number, z1: number, x2: number, z2: number, w: number, color: number) {
  const len = Math.hypot(x2 - x1, z2 - z1); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), toon(color));
  p.rotation.x = -Math.PI / 2; p.rotation.z = -Math.atan2(x2 - x1, z2 - z1); p.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2); p.receiveShadow = true; W.zone.add(p);
}
function scatter(n: number, kinds: ('round' | 'pine' | 'dead' | 'shroom')[], minR: number, maxR: number, avoid: (x: number, z: number) => boolean) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n * 3 && n > 0; i++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR); const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid(x, z)) continue; place(buildTree(kinds[Math.floor(rnd() * kinds.length)], 0.8 + rnd() * 0.6), x, z, rnd() * 6, 0.6); n--;
  }
}
function npc(animal: 'rabbit' | 'bear' | 'fox' | 'cat', color: number, accent: number, x: number, z: number, rot: number, name: string, action: () => void, hat: string | null = null) {
  const g = buildChibi(animal, color, accent, hat, 0xff8fb8); place(g, x, z, rot, 0.5); g.add(label(name, '#fff7c2'));
  g.userData.bob = Math.random() * 6; addInteract({ x, z, r: 1.8, label: `Talk to ${name}`, action, obj: g });
}
function portal(x: number, z: number, color: number, to: ZoneId, spawn: [number, number], text: string, rot = 0) {
  const p = buildPortal(color); place(p, x, z, rot); p.add(label(text, '#ffffff', 2.8)); p.userData.spin = true;
  addInteract({ x, z, r: 1.1, label: text, action: () => goZone(to, spawn), auto: true });
}

export function goZone(z: ZoneId, spawn?: [number, number]) {
  S.zone = z; if (spawn) S.pos = [...spawn]; save(); buildZone(); hooks.zoneChanged();
}

export function buildZone() {
  W.zone.clear(); W.interact = []; W.colliders = []; W.enemies = []; W.chests = []; W.denPieces.clear(); W.wallMeshes = []; W.target = null;
  const Z = ZONES[S.zone]; W.bound = Z.size - 1;
  W.scene.background = new THREE.Color(Z.fog); W.scene.fog = new THREE.Fog(Z.fog, 30, 70);
  if (S.zone === 'den') buildDen();
  else {
    ground(Z.size, Z.ground);
    if (S.zone === 'town') buildTown(); else if (S.zone === 'woods') buildWoods(); else buildHollow();
  }
  W.player.position.set(S.pos[0], 0, S.pos[1]); refreshPlayer();
}

function buildTown() {
  const pc = ZONES.town.path;
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(5, 32), toon(pc)); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.012; W.zone.add(plaza);
  path(0, 0, 0, -12, 2.4, pc); path(0, 0, 0, 12, 2.2, pc); path(0, 0, 12, 0, 2.2, pc); path(0, 0, -12, 0, 2.2, pc); path(-9, 0, -9, 8, 1.6, pc);
  // fountain
  const f = new THREE.Group(); f.add(mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 20), 0xd8d8e8, 0, 0.25, 0));
  const w = mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 20), 0x7fd4f0, 0, 0.5, 0); f.add(w); f.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 8), 0xd8d8e8, 0, 0.9, 0)); f.add(mesh(new THREE.SphereGeometry(0.35, 12, 8), 0x9fe3ff, 0, 1.7, 0, 0x2288aa));
  place(f, 0, 0, 0, 1.9); f.add(label('Bellbrook Fountain', '#bff1ff', 2.6, 0.8));
  // loot traders (NPC player-style shops, stocked by dungeon adventurers)
  const traders: [string, number, number, number, 'rabbit' | 'bear' | 'fox', number, number][] = [['relics', -6, -3, 0xff8fb8, 'rabbit', 0xfff4e8, 0xffb3c7], ['arms', -6, 3, 0x6ecbff, 'bear', 0xc89a6c, 0x8a5a3c], ['curios', 6, 3, 0xffd36e, 'fox', 0xff9a4d, 0xfff1e0]];
  for (const [id, x, z, aw, an, c, ac] of traders) {
    const st = place(buildStall(aw), x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, 1.2);
    const shop = S.shops.find(s => s.id === id)!; st.add(label(shop.title, '#ffe7a8', 3));
    npc(an, c, ac, x + (x < 0 ? -1.1 : 1.1), z, x < 0 ? Math.PI / 2 : -Math.PI / 2, shop.owner, () => hooks.open('market', id));
  }
  // themed shops (cosmetics / furniture / cards)
  const themed: [string, string, number, number, number, number, 'rabbit' | 'bear' | 'fox' | 'cat', string][] = [
    ['furniture', 'Nook & Cranny Furnishings', 6, -7, 0xffe1b8, 0x8fbf6a, 'bear', 'Hazel'],
    ['boutique', 'Ribbon & Bell Boutique', -6, -8, 0xffd6e8, 0xff7aa8, 'cat', 'Lumi'],
    ['cards', 'Shuffle & Shine Card Parlor', 7, 8, 0xd8ccff, 0x6a5acd, 'fox', 'Rook'],
  ];
  for (const [panel, title, x, z, wall, roof, an, owner] of themed) {
    const h = place(buildHouse(wall, roof, 3.6, 3), x, z, 0, 2.2); h.add(label(title, '#ffffff', 4.4));
    npc(an, an === 'bear' ? 0xc89a6c : an === 'cat' ? 0xf0e0d0 : 0xff9a4d, 0xfff1e0, x + 1.6, z + 2.2, 0, owner, () => hooks.open(panel), an === 'cat' ? 'bow' : null);
  }
  // traveling trader for direct trades
  npc('rabbit', 0xd9c7ff, 0x8a7ad0, 3, -3.5, -0.6, 'Tumbletoe (Trade)', () => hooks.open('trade'), 'wizard');
  // player's own stall
  const my = place(buildStall(0xb7f0a0), -2.5, 7, Math.PI, 1.2); my.add(label('Your Stall', '#c8ffb0', 3));
  addInteract({ x: -2.5, z: 7, r: 2, label: 'Manage your stall', action: () => hooks.open('stall'), obj: my });
  // den door
  const den = place(buildHouse(0xfff1dc, 0xff9a7a, 3, 3), -9, 9, 0, 2); den.add(label('🏠 My Den', '#ffe0d0', 4.2));
  addInteract({ x: -9, z: 10.8, r: 1.4, label: 'Enter your den', action: () => goZone('den', [3.5, 3.5]), obj: den });
  // portals
  portal(0, -11.5, 0x5fdc7a, 'woods', [0, 13], '→ Mossmere Woods');
  scatter(26, ['round', 'pine'], 9, 12.5, (x, z) => Math.abs(x) < 2 || Math.abs(z) < 2 || (x < -6 && z > 6) || (x > 4 && z > 5) || (Math.abs(x) > 3 && z < -5));
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; place(mesh(new THREE.SphereGeometry(0.12, 6, 4), [0xff8fb8, 0xfff176, 0xffffff][i % 3]), Math.cos(a) * 5.3, Math.sin(a) * 5.3); }
}

function spawnEnemy(id: string, x: number, z: number, boss = false) {
  const d = ENEMIES[id]; const g = buildEnemy(d.shape, d.color); g.scale.setScalar(d.scale); g.add(label(`${d.name} Lv${d.level}`, boss ? '#ffb3a0' : '#ffd9d9', boss ? 1.7 : 1.6, boss ? 0.6 : 0.8));
  place(g, x, z); W.enemies.push({ id, g, home: new THREE.Vector2(x, z), alive: true, respawnAt: 0, wander: new THREE.Vector2(x, z), boss });
  if (boss && Date.now() < S.bossRespawn) { g.visible = false; W.enemies[W.enemies.length - 1].alive = false; W.enemies[W.enemies.length - 1].respawnAt = S.bossRespawn; }
}
function chest(id: string, rarity: Rarity, x: number, z: number) {
  const g = buildChest(rarity); place(g, x, z, Math.random() * 6, 0.6); const c = { id, rarity, g, x, z }; W.chests.push(c);
  const sparkle = new THREE.PointLight(rarity === 'epic' ? 0xb04dff : rarity === 'rare' ? 0x3d8bff : 0xffd36e, 1.5, 3); sparkle.position.y = 1; g.add(sparkle); g.userData.light = sparkle;
  addInteract({ x, z, r: 1.4, label: `Open ${rarity} chest`, obj: g, action: () => { if ((S.chests[id] ?? 0) > Date.now()) return hooks.toast('This chest is empty. It refills in a few minutes.'); hooks.openChest(id, rarity); updateChests(); } });
}
export function updateChests() { for (const c of W.chests) { const open = (S.chests[c.id] ?? 0) > Date.now(); (c.g.userData.lid as THREE.Object3D).rotation.x = open ? -1.2 : 0; (c.g.userData.light as THREE.Light).visible = !open; } }

function buildWoods() {
  const pc = ZONES.woods.path; path(0, 14, 0, -14, 2.2, pc); path(-12, 2, 12, -4, 1.8, pc);
  portal(0, 15, 0xffd36e, 'town', [0, -9.5], '← Bellbrook Town');
  portal(0, -15, 0xff7043, 'hollow', [0, 13], '→ Cinder Hollow (Lv5+)');
  scatter(55, ['round', 'pine', 'shroom'], 3, 32, (x, z) => Math.abs(x) < 2.5 || Math.hypot(x, z) < 4);
  [[-6, 6], [6, 8], [-9, -4], [8, -2], [-4, -9], [5, -10], [-12, 3], [12, 5], [3, 3]].forEach(([x, z], i) => spawnEnemy(i % 3 === 2 ? 'thornpup' : 'mossling', x, z));
  chest('w1', 'common', -14, 8); chest('w2', 'common', 13, -9); chest('w3', 'rare', -10, -13); chest('w4', 'common', 16, 10);
}
function buildHollow() {
  const pc = ZONES.hollow.path; path(0, 14, 0, -12, 2.4, pc);
  const arena = new THREE.Mesh(new THREE.CircleGeometry(5, 32), toon(0x4a2a24)); arena.rotation.x = -Math.PI / 2; arena.position.set(0, 0.015, -10); W.zone.add(arena);
  portal(0, 15, 0x5fdc7a, 'woods', [0, -13], '← Mossmere Woods');
  scatter(40, ['dead'], 3, 32, (x, z) => Math.abs(x) < 3 || Math.hypot(x, z + 10) < 6);
  for (let i = 0; i < 18; i++) { const a = i * 2.1, r = 6 + (i * 7) % 22; const rock = mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.3, 0), 0x6a5048); place(rock, Math.cos(a) * r, Math.sin(a) * r, 0, 0.8); }
  for (let i = 0; i < 8; i++) { const l = mesh(new THREE.CircleGeometry(0.8 + (i % 2), 12), 0xff6a2a, 0, 0.02, 0, 0xff3300); l.rotation.x = -Math.PI / 2; place(l, -14 + i * 4, (i % 2 ? 6 : -4)); l.position.y = 0.03; l.castShadow = false; }
  [[-6, 6], [7, 4], [-8, -3], [9, -6], [-3, 9], [5, 10]].forEach(([x, z]) => spawnEnemy('cinder_imp', x, z));
  spawnEnemy('smoulderjaw', 0, -10, true);
  chest('h1', 'rare', -13, -6); chest('h2', 'common', 14, 9); chest('h3', 'epic', 0, -15.5); chest('h4', 'rare', 15, -12);
}

// ---------------- Den ----------------
export const DEN_HALF = 6;
function buildDen() {
  const wall = DEN_THEMES.walls.find(w => w.id === S.den.wall)!.color; const fl = DEN_THEMES.floors.find(f => f.id === S.den.floor)!.color;
  W.scene.background = new THREE.Color(0x2a2340); W.scene.fog = null;
  const floor = mesh(new THREE.BoxGeometry(DEN_HALF * 2, 0.3, DEN_HALF * 2), fl, 0, -0.15, 0); W.zone.add(floor); W.wallMeshes.push(floor); floor.userData.kind = 'floor';
  const grid = new THREE.GridHelper(DEN_HALF * 2, DEN_HALF * 2, 0xffffff, 0xffffff); (grid.material as THREE.Material).opacity = 0.18; (grid.material as THREE.Material).transparent = true; grid.position.y = 0.02; grid.visible = false; W.zone.add(grid); W.zone.userData.grid = grid;
  const back = mesh(new THREE.BoxGeometry(DEN_HALF * 2, 4, 0.3), wall, 0, 2, -DEN_HALF - 0.15); const left = mesh(new THREE.BoxGeometry(0.3, 4, DEN_HALF * 2), wall, -DEN_HALF - 0.15, 2, 0);
  back.userData.kind = left.userData.kind = 'wall'; W.zone.add(back, left); W.wallMeshes.push(back, left);
  // window
  W.zone.add(mesh(new THREE.BoxGeometry(2, 1.4, 0.1), 0xbfe6ff, 3, 2.3, -DEN_HALF + 0.02, 0x335577));
  W.floor = new THREE.Mesh(new THREE.PlaneGeometry(DEN_HALF * 2, DEN_HALF * 2), new THREE.MeshBasicMaterial({ visible: false })); W.floor.rotation.x = -Math.PI / 2; W.zone.add(W.floor);
  const lamp = new THREE.PointLight(0xffe2b0, 1.2, 20); lamp.position.set(0, 5, 0); W.zone.add(lamp);
  // exit mat
  const mat = mesh(new THREE.BoxGeometry(1.4, 0.05, 0.9), 0xff8fb8, 4.5, 0.02, 5.2); W.zone.add(mat); mat.add(label('Exit to town', '#ffffff', 1.2, 0.6));
  addInteract({ x: 4.5, z: 5.2, r: 0.8, label: 'Exit to town', action: () => goZone('town', [-9, 11.5]), auto: true });
  W.bound = DEN_HALF - 0.4;
  for (const p of S.den.pieces) addDenPiece(p.uid);
}
export function addDenPiece(uid: number) {
  const p = S.den.pieces.find(q => q.uid === uid)!; const it = ITEMS[p.itemId];
  const g = buildFurniture(it.model!, it.color!); g.position.set(p.x, 0, p.z); g.rotation.y = p.rot * Math.PI / 2; g.userData.uid = uid;
  W.zone.add(g); W.denPieces.set(uid, g);
}

// ---------------- Loop ----------------
let promptShown: Interactable | null = null;
function tick(ts?: number) {
  timer.update(ts); const dt = Math.min(0.05, timer.getDelta()); const t = timer.getElapsed();
  if (W.overlay) { W.overlay.render(dt, t); return; }
  if (!W.paused) update(dt, t);
  const p = W.player.position; const den = S?.zone === 'den';
  const off = den ? new THREE.Vector3(9, 11, 9) : new THREE.Vector3(11, 14, 11);
  const look = den ? new THREE.Vector3(0, 0, 0) : p;
  W.camera.position.lerp(look.clone().add(off), 0.12); W.camera.lookAt(look.x, look.y + 0.5, look.z);
  const sun = W.scene.userData.sun as THREE.DirectionalLight; sun.position.set(p.x + 12, 20, p.z + 8); sun.target.position.copy(p);
  clampLabels();
  W.renderer.render(W.scene, W.camera);
}

function update(dt: number, t: number) {
  if (!S) return;
  // movement: WASD relative to iso camera
  const k = W.keys; let mx = 0, mz = 0;
  if (!W.decorating) {
    if (k.has('w') || k.has('arrowup')) { mx -= 1; mz -= 1; } if (k.has('s') || k.has('arrowdown')) { mx += 1; mz += 1; }
    if (k.has('a') || k.has('arrowleft')) { mx -= 1; mz += 1; } if (k.has('d') || k.has('arrowright')) { mx += 1; mz -= 1; }
  }
  const pl = W.player.position; const speed = 6;
  if (mx || mz) { W.target = null; pendingInteract = null; if (markerMesh) markerMesh.visible = false; }
  else if (W.target) { const dx = W.target.x - pl.x, dz = W.target.y - pl.z; const d = Math.hypot(dx, dz); const stop = pendingInteract ? pendingInteract.r * 0.8 : 0.15;
    if (d < stop) { W.target = null; if (markerMesh) markerMesh.visible = false; if (pendingInteract) { const pi = pendingInteract; pendingInteract = null; pi.action(); } } else { mx = dx / d; mz = dz / d; } }
  const model = W.player.userData.model as THREE.Group;
  if (mx || mz) {
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    let nx = pl.x + mx * speed * dt, nz = pl.z + mz * speed * dt;
    for (const c of W.colliders) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), m = c.r + 0.35; if (d < m && d > 0.0001) { nx = c.x + dx / d * m; nz = c.z + dz / d * m; } }
    if (S.zone === 'den') { nx = Math.max(-W.bound, Math.min(W.bound, nx)); nz = Math.max(-W.bound, Math.min(W.bound, nz)); }
    else { const r = Math.hypot(nx, nz); if (r > W.bound) { nx *= W.bound / r; nz *= W.bound / r; } }
    pl.x = nx; pl.z = nz; W.player.rotation.y = Math.atan2(mx, mz);
    model.position.y = Math.abs(Math.sin(t * 12)) * 0.15;
  } else if (model) model.position.y = Math.sin(t * 3) * 0.03;
  S.pos = [pl.x, pl.z];

  // npc bob & portal spin
  W.zone.children.forEach(o => { if (o.userData.bob !== undefined) o.position.y = Math.abs(Math.sin(t * 2 + o.userData.bob)) * 0.06; if (o.userData.spin) o.children[0].rotation.y = t; });

  // interactables
  let near: Interactable | null = null; let nd = 1e9;
  for (const i of W.interact) { const d = Math.hypot(i.x - pl.x, i.z - pl.z); if (d < i.r && d < nd) { near = i; nd = d; } }
  if (near?.auto) { near.action(); return; }
  if (near !== promptShown) { promptShown = near; hooks.prompt(near && !W.decorating ? near.label : null); }
  const want = W.wantInteract; W.wantInteract = false;
  if (near && want && !W.decorating) near.action();

  // enemies
  const now = Date.now();
  for (const e of W.enemies) {
    if (!e.alive) { if (now > e.respawnAt) { e.alive = true; e.g.visible = true; e.g.position.set(e.home.x, 0, e.home.y); } else continue; }
    const g = e.g; const dx = pl.x - g.position.x, dz = pl.z - g.position.z; const d = Math.hypot(dx, dz);
    const def = ENEMIES[e.id]; let vx = 0, vz = 0;
    if (d < (e.boss ? 5 : 5.5) && !e.boss) { vx = dx / d; vz = dz / d; }
    else { const wx = e.wander.x - g.position.x, wz = e.wander.y - g.position.z, wd = Math.hypot(wx, wz); if (wd < 0.3 || Math.random() < 0.003) e.wander.set(e.home.x + (Math.random() - 0.5) * 6, e.home.y + (Math.random() - 0.5) * 6); else { vx = wx / wd * 0.4; vz = wz / wd * 0.4; } }
    if (!e.boss) { g.position.x += vx * 2.6 * dt; g.position.z += vz * 2.6 * dt; if (vx || vz) g.rotation.y = Math.atan2(vx, vz); }
    else g.rotation.y = Math.atan2(dx, dz);
    g.children[0].scale.y = (def.shape === 'blob' ? 0.8 : 1) * (1 + Math.sin(t * 6 + e.home.x) * 0.06);
    if (d < (e.boss ? 1.8 : 0.9)) {
      W.paused = true; W.keys.clear(); W.target = null;
      hooks.battle(e.id, (won) => {
        W.paused = false;
        if (won) { e.alive = false; e.g.visible = false; e.respawnAt = Date.now() + (e.boss ? 180000 : 25000); if (e.boss) S.bossRespawn = e.respawnAt; save(); }
        else goZone('town', [0, 3]);
      });
      return;
    }
  }
}
