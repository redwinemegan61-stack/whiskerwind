// Extra loot sources in the open world: foraging, fishing, breakables, hidden & locked chests, secret spots,
// the shy golden Glimmerpuff, and the sparkle beam that marks rare finds.
import * as THREE from 'three';
import { Rarity, RARITY_HEX, RARITY_COLOR, ZoneId, ITEMS, rarityRank } from './data';
import { openPanel } from './ui';
import { S, addItem, save, bump } from './state';
import { W, place, addInteract, label, hooks, sparkTex } from './world';
import { mesh, toon, buildChest, buildEnemy } from './models';
import { Loot, rollChest } from './loot';
import { AMB, PONDS } from './ambient';

type ForageKind = 'berry' | 'glowcap' | 'crystal';
interface Spot { id: string; g: THREE.Object3D; fruit: THREE.Object3D; kind: 'forage' | 'crate'; respawnMs: number }
let spots: Spot[] = [];
let beams: { g: THREE.Group; t: number; life: number }[] = [];
let golden: { g: THREE.Group; until: number; vx: number; vz: number; hop: number } | null = null;
let hidden: { g: THREE.Object3D; x: number; z: number; r: number }[] = [];
let secret: { id: string; x: number; z: number; r: number; night?: boolean }[] = [];
let goldenCheck = 0; let bobs: THREE.Object3D[] = [];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export const SECRET_NAMES: Record<string, string> = { glade: 'Whispering Glade', nook: 'Sunbeam Nook', overlook: 'Ember Overlook', firefly_pond: 'Firefly Pond (at night)' };

// ---------- builders ----------
function bush(kind: ForageKind) {
  const g = new THREE.Group(); const fruit = new THREE.Group(); fruit.name = 'fruit';
  if (kind === 'berry') {
    g.add(mesh(new THREE.SphereGeometry(0.55, 10, 8), 0x4f9a46, 0, 0.45, 0)); g.add(mesh(new THREE.SphereGeometry(0.4, 10, 8), 0x5fae4f, 0.35, 0.35, 0.2));
    for (let i = 0; i < 7; i++) { const a = i * 0.9; fruit.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), 0x6a6aff, Math.cos(a) * 0.5, 0.45 + (i % 3) * 0.15, Math.sin(a) * 0.5, 0x2222aa)); }
  } else if (kind === 'glowcap') {
    for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.5, z = (Math.floor(i / 2) - 0.5) * 0.45; fruit.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), 0xfff2dc, x, 0.15, z)); const c = mesh(new THREE.SphereGeometry(0.2 + (i % 2) * 0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x7ef0ff, x, 0.28, z, 0x22aacc); fruit.add(c); }
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.12, 10), 0x5a4a3a, 0, 0.06, 0));
  } else {
    g.add(mesh(new THREE.DodecahedronGeometry(0.45, 0), 0x5a4048, 0, 0.3, 0));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.OctahedronGeometry(0.22, 0), 0xffa040, Math.cos(i * 1.6) * 0.35, 0.55 + (i % 2) * 0.2, Math.sin(i * 1.6) * 0.35, 0xff6a00); c.scale.y = 1.8; c.rotation.z = (i - 1.5) * 0.3; fruit.add(c); }
  }
  g.add(fruit); return { g, fruit };
}
function crate(pot: boolean) {
  const g = new THREE.Group(); const body = new THREE.Group(); body.name = 'fruit';
  if (pot) { body.add(mesh(new THREE.SphereGeometry(0.38, 12, 10), 0xc8794a, 0, 0.38, 0)); body.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 12), 0xb0663c, 0, 0.75, 0)); }
  else { body.add(mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), 0xc99a6a, 0, 0.35, 0)); for (const y of [0.12, 0.58]) body.add(mesh(new THREE.BoxGeometry(0.84, 0.08, 0.84), 0x8b5a3c, 0, y, 0)); }
  g.add(body); return { g, fruit: body };
}
function forageSpot(id: string, kind: ForageKind, x: number, z: number) {
  const { g, fruit } = bush(kind); place(g, x, z, Math.random() * 6, kind === 'berry' ? 0.6 : 0.4);
  const sp: Spot = { id, g, fruit, kind: 'forage', respawnMs: kind === 'berry' ? 90000 : kind === 'glowcap' ? 120000 : 180000 }; spots.push(sp);
  const verb = kind === 'berry' ? 'Pick berries' : kind === 'glowcap' ? 'Gather glowcaps' : 'Chip crystals';
  addInteract({ x, z, r: 1.5, label: verb, obj: g, action: () => {
    if ((S.spots[id] ?? 0) > Date.now()) return hooks.toast('Picked clean. It grows back in a little while.');
    const item = kind === 'berry' ? 'puff_berry' : kind === 'glowcap' ? 'glowcap' : 'cinder_quartz';
    const n = kind === 'crystal' ? rnd(1, 2) : rnd(2, 3);
    const L: Loot = { items: [{ id: item, n }], cards: [], glimmer: 0 };
    if (Math.random() < 0.12) L.items.push({ id: kind === 'crystal' ? 'starfire_opal' : kind === 'glowcap' ? 'dewdrop_gem' : 'berry_tonic', n: 1 });
    S.spots[id] = Date.now() + sp.respawnMs; bump('forage', n); hooks.event('forage', kind, n);
    hooks.lootAt('forage', L, x, z); refresh(); save();
  } });
}
function crateSpot(id: string, x: number, z: number, pot = false) {
  const { g, fruit } = crate(pot); place(g, x, z, Math.random() * 6, 0.5);
  const sp: Spot = { id, g, fruit, kind: 'crate', respawnMs: 180000 }; spots.push(sp);
  addInteract({ x, z, r: 1.4, label: pot ? 'Smash pot' : 'Smash crate', obj: g, action: () => {
    if ((S.spots[id] ?? 0) > Date.now()) return;
    const L: Loot = { items: [], cards: [], glimmer: rnd(3, 10) }; const r = Math.random();
    const zone = S.zone; const commons = zone === 'hollow' ? ['ember_shard', 'mint_elixir'] : ['moss_tuft', 'puff_berry', 'berry_tonic'];
    if (r < 0.04) L.items.push({ id: 'brass_key', n: 1 }); else if (r < 0.055) L.items.push({ id: zone === 'hollow' ? 'soot_silk' : 'dewdrop_gem', n: 1 }); else if (r < 0.16) L.items.push({ id: 'hushleaf_sachet', n: 1 }); else if (r < 0.5) L.items.push({ id: commons[rnd(0, commons.length - 1)], n: 1 });
    S.spots[id] = Date.now() + sp.respawnMs; bump('smash'); hooks.event('smash'); puff(x, z); hooks.lootAt('crate', L, x, z); refresh(); save();
  } });
}
function lockedChest(id: string, x: number, z: number) {
  const g = buildChest('locked'); place(g, x, z, Math.random() * 6, 0.6);
  const lock = mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), 0xffd36e, 0, 0.42, 0.34, 0x664400); g.add(lock); g.add(label('🔒 Locked chest', '#ffe6a8', 1.5, 0.6));
  const glow = beamSprite(0xffb02e); glow.position.y = 0.8; g.add(glow); g.userData.light = glow;
  W.chests.push({ id, rarity: 'epic', g, x, z } as never);
  addInteract({ x, z, r: 1.4, label: 'Unlock chest (Brass Key)', obj: g, action: () => {
    if ((S.chests[id] ?? 0) > Date.now()) return hooks.toast('Empty for now. Locked chests restock after 20 minutes.');
    if (!S.inventory.brass_key) return hooks.toast("It's locked tight. You need a Brass Key (crates, bounties, mini-bosses).");
    addItem('brass_key', -1); const L = rollChest('epic'); if (Math.random() < 0.22) L.items.push({ id: Math.random() < 0.5 ? 'aurora_brush' : 'golden_whisker', n: 1 });
    S.chests[id] = Date.now() + 20 * 60 * 1000; S.stats.chestsOpened++; bump('chests'); bump('locked'); hooks.event('chest', 'locked');
    hooks.lootAt('🔓 Locked chest', L, x, z); refresh(); save();
  } });
}
function hiddenChest(id: string, x: number, z: number) {
  const g = buildChest('rare'); place(g, x, z, Math.random() * 6, 0.6); g.scale.setScalar(0.9);
  const tag = label('✨ Hidden chest', '#cfe7ff', 1.4, 0.6); tag.visible = false; g.add(tag); hidden.push({ g: tag, x, z, r: 4.5 });
  W.chests.push({ id, rarity: 'rare', g, x, z } as never);
  const sprite = beamSprite(0x9fd8ff); sprite.position.y = 0.8; g.add(sprite); g.userData.light = sprite;
  addInteract({ x, z, r: 1.4, label: 'Open hidden chest', obj: g, action: () => {
    if ((S.chests[id] ?? 0) > Date.now()) return hooks.toast('Already found. Hidden chests refill after 10 minutes.');
    const L = rollChest('rare'); L.items.push({ id: ['brass_key', 'hushleaf_sachet', 'glowcap'][rnd(0, 2)], n: 1 });
    S.chests[id] = Date.now() + 10 * 60 * 1000; S.stats.chestsOpened++; bump('chests'); bump('hidden'); hooks.event('chest', 'hidden');
    hooks.lootAt('✨ Hidden chest', L, x, z); refresh(); save();
  } });
}
function fishingSpot(id: string, x: number, z: number) {
  const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), 0xa77a52, 0, 0.06, 0)); g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), 0x8b5a3c, 0.5, 0.3, 0.3));
  const bob = mesh(new THREE.SphereGeometry(0.08, 8, 6), 0xff5c5c, 0, 0.05, 0); bob.name = 'bob'; g.add(bob); bobs.push(bob); g.add(label('🎣 Fishing spot', '#d6f4ff', 1.2, 0.55));
  place(g, x, z); addInteract({ x, z, r: 1.6, label: 'Cast a line', obj: g, action: () => hooks.open('fish', id) });
}
function secretSpot(id: string, x: number, z: number, r = 2.6, night = false) { secret.push({ id, x, z, r, night }); }
function bountyBoard(x: number, z: number) {
  const g = new THREE.Group(); for (const s of [-0.8, 0.8]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2, 6), 0x8b5a3c, s, 1, 0));
  g.add(mesh(new THREE.BoxGeometry(2, 1.2, 0.12), 0xc99a6a, 0, 1.35, 0)); g.add(mesh(new THREE.BoxGeometry(2.3, 0.18, 0.4), 0x8b5a3c, 0, 2.05, 0));
  for (let i = 0; i < 3; i++) { const n = mesh(new THREE.BoxGeometry(0.42, 0.52, 0.02), [0xfff6dc, 0xffe6f0, 0xe6f4ff][i], -0.6 + i * 0.6, 1.35, 0.08); n.rotation.z = (i - 1) * 0.08; g.add(n); }
  g.add(label('📜 Bounty Board', '#fff3c8', 2.7)); g.userData.npcId = 'board'; W.npcs.set('board', g);
  place(g, x, z, 0.5, 0.9); addInteract({ x, z, r: 1.8, label: 'Read the bounty board', obj: g, action: () => hooks.open('quests', 'bounty') });
}
function campfire(x: number, z: number) {
  const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.DodecahedronGeometry(0.16, 0), 0x77706a, Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45)); }
  const f = mesh(new THREE.ConeGeometry(0.25, 0.6, 7), 0xffa040, 0, 0.3, 0, 0xff6a00); f.name = 'flame'; g.add(f); bobs.push(f); const s = beamSprite(0xff9a40); s.scale.set(2, 2, 1); s.position.y = 0.4; g.add(s);
  place(g, x, z, 0, 0.5);
}

export function buildLootSpots(z: ZoneId) {
  spots = []; hidden = []; secret = []; golden = null; bobs = []; beams.forEach(b => b.g.parent?.remove(b.g)); beams = [];
  if (z === 'town') {
    forageSpot('t_berry1', 'berry', -11.5, -3.5); forageSpot('t_berry2', 'berry', 12, 4.5);
    crateSpot('t_pot1', 4.6, -8.4, true); crateSpot('t_crate1', -4.2, 10.6);
    const p = PONDS.town[0]; fishingSpot('t_fish', p.x - p.r - 0.7, p.z);
    bountyBoard(-3.4, -4.2);
  } else if (z === 'woods') {
    forageSpot('w_cap1', 'glowcap', -12, -9); forageSpot('w_cap2', 'glowcap', 10.5, -12.5); forageSpot('w_cap3', 'glowcap', 16, 3.5); forageSpot('w_cap4', 'glowcap', -18, 4);
    forageSpot('w_berry1', 'berry', -9.5, 12.5); forageSpot('w_berry2', 'berry', 6, 12);
    crateSpot('w_crate1', -13, 6.5); crateSpot('w_crate2', 11.5, -6); crateSpot('w_pot1', 3.2, -12, true); crateSpot('w_pot2', -7.5, -13.5, true); crateSpot('w_crate3', 16, -8);
    const p = PONDS.woods[0]; fishingSpot('w_fish', p.x + p.r + 0.7, p.z);
    lockedChest('wl1', -17.5, -5.5);
    secretSpot('glade', -20, 1, 3); secretSpot('nook', 21, -13, 2.6); hiddenChest('wh1', 22, -14.5);
    secretSpot('firefly_pond', p.x, p.z, 3.2, true);
    // the glade gets a soft god-ray
    const ray = beamSprite(0xfff1a8); ray.scale.set(5, 9, 1); ray.position.set(-20, 3.5, 1); (ray.material as THREE.SpriteMaterial).opacity = 0.25; W.zone.add(ray);
    maybeGolden(0.35);
  } else if (z === 'hollow') {
    forageSpot('h_cry1', 'crystal', -14, 4); forageSpot('h_cry2', 'crystal', 13, 12); forageSpot('h_cry3', 'crystal', 17, -8); forageSpot('h_cry4', 'crystal', -7, -14);
    crateSpot('h_pot1', -4.5, 11.5, true); crateSpot('h_crate1', 11, 9.5); crateSpot('h_crate2', -15, -2); crateSpot('h_pot2', 7, -14.5, true);
    lockedChest('hl1', 17, -0.5);
    secretSpot('overlook', -20, -12, 2.8); hiddenChest('hh1', -21.5, -13.5);
    campfire(3.6, 10.6);
    maybeGolden(0.3);
  }
  refresh();
}
function refresh() { const now = Date.now(); for (const s of spots) { const ready = (S.spots[s.id] ?? 0) <= now; s.fruit.visible = ready; } }

// ---------- golden Glimmerpuff ----------
function maybeGolden(chance: number) {
  if (golden || (S.zone !== 'woods' && S.zone !== 'hollow') || Math.random() > chance) return;
  const g = buildEnemy('blob', 0xffd34d); g.scale.setScalar(0.65);
  g.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined; if (m && 'emissive' in m) { (o as THREE.Mesh).material = toon(0xffd34d, 0xaa7700); } });
  g.add(label('✨ Glimmerpuff', '#fff1a8', 1.3, 0.6)); const glow = beamSprite(0xffe066); glow.scale.set(1.8, 1.8, 1); glow.position.y = 0.4; g.add(glow);
  // appear somewhere away from the player
  let x = 0, zz = 0; for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 14; x = Math.cos(a) * r; zz = Math.sin(a) * r; if (Math.hypot(x - W.player.position.x, zz - W.player.position.z) > 9) break; }
  place(g, x, zz); golden = { g, until: Date.now() + 50000, vx: 0, vz: 0, hop: 0 };
  hooks.toast('✨ Something golden is glittering nearby… a Glimmerpuff! Catch it before it vanishes.');
}
function catchGolden() {
  if (!golden) return; const { x, z } = golden.g.position; golden.g.parent?.remove(golden.g); golden = null;
  const L: Loot = { items: [{ id: 'golden_whisker', n: 1 }], cards: [], glimmer: rnd(150, 300) };
  if (Math.random() < 0.15) L.items.push({ id: 'aurora_brush', n: 1 }); if (Math.random() < 0.5) L.items.push({ id: 'brass_key', n: 1 });
  bump('golden'); hooks.event('golden'); hooks.lootAt('✨ You caught the Glimmerpuff!', L, x, z); save();
}

// ---------- sparkle beam / puff ----------
function beamSprite(color: number) { return new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex(), color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); }
const beamGeo = new THREE.CylinderGeometry(0.35, 0.6, 9, 16, 1, true);
export function beam(x: number, z: number, r: Rarity) {
  if (rarityRank(r) < 2) return; const col = RARITY_HEX[r];
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const c = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); c.position.y = 4.5; g.add(c);
  const n = r === 'legendary' ? 40 : 24, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 1.2, Math.random() * 6, (Math.random() - 0.5) * 1.2], i * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: col, size: 0.28, map: sparkTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(pts);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  W.zone.add(g); beams.push({ g, t: 0, life: r === 'legendary' ? 4 : r === 'epic' ? 3.2 : 2.6 });
}
function puff(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0.3, z);
  for (let i = 0; i < 6; i++) { const m = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), 0xc99a6a, 0, 0, 0); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3); g.add(m); }
  g.userData.puff = true; W.zone.add(g); beams.push({ g, t: 0, life: 0.8 });
}

// ---------- per-frame ----------
let slow = 0;
export function updateLootSpots(dt: number, t: number, pl: THREE.Vector3) {
  // beams & puffs
  for (const b of [...beams]) {
    b.t += dt; const k = b.t / b.life;
    if (b.g.userData.puff) b.g.children.forEach(c => { const v = c.userData.v as THREE.Vector3; v.y -= 9 * dt; c.position.addScaledVector(v, dt); c.rotation.x += dt * 6; c.scale.setScalar(Math.max(0.01, 1 - k)); });
    else { const [cyl, pts, ring] = b.g.children as THREE.Mesh[]; (cyl.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k) * Math.min(1, b.t * 4); cyl.scale.set(1 + Math.sin(t * 8) * 0.06, 1, 1 + Math.sin(t * 8) * 0.06);
      const pa = pts.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) + dt * 2.5; if (y > 7) y = 0; pa.setY(i, y); } pa.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = 1 - k;
      ring.scale.setScalar(1 + k * 2.5); (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k); }
    if (b.t > b.life) { b.g.parent?.remove(b.g); beams.splice(beams.indexOf(b), 1); }
  }
  // chest sparkles twinkle
  for (const c of W.chests) { const s = c.g.userData.light as THREE.Sprite | undefined; if (s?.material) (s.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(t * 3 + (c.g.userData.twinkle ?? 0)) * 0.3; }
  // hidden-chest tags only show up close
  for (const h of hidden) h.g.visible = Math.hypot(h.x - pl.x, h.z - pl.z) < h.r;
  // secret spots
  for (const s of secret) {
    const key = 'found_' + s.id; if (S.flags[key]) continue;
    if (Math.hypot(s.x - pl.x, s.z - pl.z) < s.r && (!s.night || AMB.night > 0.5)) { S.flags[key] = Date.now(); bump('secrets'); hooks.event('visit', s.id); hooks.toast(`🗺️ Discovered: ${SECRET_NAMES[s.id]}!`); beam(s.x, s.z, 'rare'); save(); }
  }
  // golden critter: flees when you're near, vanishes after a while
  if (golden) {
    const g = golden.g; const dx = g.position.x - pl.x, dz = g.position.z - pl.z, d = Math.hypot(dx, dz) || 0.001;
    if (d < 0.95) { catchGolden(); return; }
    if (Date.now() > golden.until) { puff(g.position.x, g.position.z); g.parent?.remove(g); golden = null; hooks.toast('The Glimmerpuff vanished in a puff of glitter.'); return; }
    let vx = 0, vz = 0, sp = 0.8;
    if (d < 5.5) { vx = dx / d; vz = dz / d; sp = 4.6; const r = Math.hypot(g.position.x, g.position.z); if (r > W.bound - 2) { vx += -g.position.x / r * 1.4; vz += -g.position.z / r * 1.4; } vx += Math.sin(t * 3) * 0.6; }
    else { vx = Math.sin(t * 0.7); vz = Math.cos(t * 0.5); }
    const l = Math.hypot(vx, vz) || 1; g.position.x += vx / l * sp * dt; g.position.z += vz / l * sp * dt;
    const r = Math.hypot(g.position.x, g.position.z); if (r > W.bound) { g.position.x *= W.bound / r; g.position.z *= W.bound / r; }
    golden.hop += dt * (sp > 2 ? 14 : 6); g.position.y = Math.abs(Math.sin(golden.hop)) * 0.3; g.rotation.y = Math.atan2(vx, vz);
  }
  slow += dt; if (slow > 1) { slow = 0; refresh(); if (!golden) { goldenCheck++; if (goldenCheck % 60 === 0) maybeGolden(0.15); } }
  // bob on fishing floats
  bobs.forEach(o => { if (o.name === 'bob') o.position.y = 0.05 + Math.sin(t * 2.4) * 0.03; else if (o.name === 'flame') o.scale.y = 1 + Math.sin(t * 12) * 0.12; });
}
export function forceGolden() { golden?.g.parent?.remove(golden.g); golden = null; maybeGolden(1); }
export const bestRarity = (L: Loot): Rarity => { let best: Rarity = 'common'; for (const i of L.items) if (rarityRank(ITEMS[i.id].rarity) > rarityRank(best)) best = ITEMS[i.id].rarity; return best; };

// ---------- fishing mini-game: cast, wait for the splash, reel in time ----------
let fishTimer = 0;
export function fishing(spotId: string) {
  clearTimeout(fishTimer);
  let state: 'idle' | 'wait' | 'bite' | 'result' = 'idle'; let result = '';
  const render = () => {
    const el = openPanel('fish', '🎣 Fishing', `<div class="fishing s-${state}">
      <div class="pondview"><div class="ripple"></div><div class="float ${state}">${state === 'bite' ? '<b>!</b>' : ''}</div></div>
      <p class="fish-msg">${state === 'idle' ? 'Cast your line, then wait for the splash.' : state === 'wait' ? 'Waiting for a nibble…' : state === 'bite' ? 'Something bit! Reel in now!' : result}</p>
      <div class="center">${state === 'bite' ? '<button class="btn big primary pulse" id="reel">Reel in!</button>' : state === 'wait' ? '<button class="btn big" id="reel">Reel in</button>' : `<button class="btn big primary" id="cast">${state === 'result' ? 'Cast again' : 'Cast line'}</button>`}</div>
      <p class="muted center">${AMB.night > 0.5 ? '🌙 Night time: rare Moonscale Eels are biting.' : 'Tip: some fish only bite at night.'}</p></div>`, spotId);
    el.querySelector('#cast')?.addEventListener('click', cast);
    el.querySelector('#reel')?.addEventListener('click', reel);
  };
  const open = () => !!document.querySelector('.fishing');
  const cast = () => { state = 'wait'; render(); fishTimer = window.setTimeout(() => { if (state !== 'wait' || !open()) return; state = 'bite'; render(); fishTimer = window.setTimeout(() => { if (state === 'bite' && open()) { state = 'result'; result = 'It got away… so close!'; render(); } }, 1100); }, 1200 + Math.random() * 2200); };
  const reel = () => {
    clearTimeout(fishTimer);
    if (state === 'wait') { state = 'result'; result = 'Too early! The fish swam off.'; render(); return; }
    if (state !== 'bite') return;
    const r = Math.random(); const night = AMB.night > 0.5;
    const id = night && r < 0.06 ? 'moonscale_eel' : r < 0.08 ? 'rainbow_koi' : r < 0.33 ? 'bubblefin' : 'minnowpuff';
    const L: Loot = { items: [{ id, n: 1 }], cards: [], glimmer: 0 }; if (Math.random() < 0.05) L.items.push({ id: 'brass_key', n: 1 });
    bump('fish'); hooks.event('fish', id); hooks.lootAt('fish', L, W.player.position.x, W.player.position.z); save();
    state = 'result'; result = `You caught a <b style="color:${RARITY_COLOR[ITEMS[id].rarity]}">${ITEMS[id].icon} ${ITEMS[id].name}</b>!`; render();
  };
  render();
}
