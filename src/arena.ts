// 3D battle arena: themed scene, character/enemy models, queued cinematic animations.
// Pure presentation: battle.ts owns all game logic and calls these functions to visualize it.
import * as THREE from 'three';
import { ENEMIES, ITEMS, ZoneId } from './data';
import { S, species } from './state';
import { W } from './world';
import { buildChibi, buildEnemy, buildTree, attachWeapon, mesh } from './models';

type Theme = 'woods' | 'hollow' | 'boss';
interface Tween { t0: number; dur: number; fn: (p: number) => void; done?: () => void }
interface Step { dur: number; run: () => void }
interface Bars { name: string; hp: number; max: number; block: number; color: string }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
let now = 0, theme: Theme = 'woods';
let tweens: Tween[] = []; let queue: Step[] = []; let stepEnd = 0; let idleCbs: (() => void)[] = [];
let shakeAmp = 0, intro = 0, outro = -1, outroCb: (() => void) | null = null;
const P = new THREE.Group(), E = new THREE.Group(); // actors (root groups that we lunge/knock)
let pModel: THREE.Group, eModel: THREE.Group;
let pBars: Bars, eBars: Bars; let pBarSprite: THREE.Sprite, eBarSprite: THREE.Sprite, intentSprite: THREE.Sprite;
let pBubble: THREE.Mesh, eBubble: THREE.Mesh, eAura: THREE.Mesh;
let ambient: THREE.Points | null = null;
const flashMats = new Map<THREE.Object3D, THREE.MeshToonMaterial[]>();
const sparkGeo = new THREE.OctahedronGeometry(0.07, 0);
let fadeEl: HTMLDivElement;
const PX = -2.3, EX = 2.3;

// ---------- canvas sprite helpers ----------
function canvasSprite(w: number, h: number, sx: number, sy: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(sx, sy, 1); s.renderOrder = 20;
  s.userData.ctx = c.getContext('2d'); s.userData.tex = tex; return s;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawBars(s: THREE.Sprite, b: Bars) {
  const ctx = s.userData.ctx as CanvasRenderingContext2D; const W2 = 320, H = 96; ctx.clearRect(0, 0, W2, H);
  ctx.fillStyle = 'rgba(40,30,60,.72)'; rr(ctx, 4, 4, W2 - 8, H - 8, 24); ctx.fill();
  ctx.font = 'bold 26px Nunito, Trebuchet MS, sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(b.name, 22, 30);
  if (b.block > 0) { ctx.fillStyle = '#6ecbff'; rr(ctx, W2 - 92, 14, 74, 32, 16); ctx.fill(); ctx.fillStyle = '#073056'; ctx.fillText('🛡' + b.block, W2 - 86, 31); }
  ctx.fillStyle = '#5a4a72'; rr(ctx, 20, 54, W2 - 40, 24, 12); ctx.fill();
  const f = Math.max(0, Math.min(1, b.hp / b.max)); ctx.fillStyle = b.color; if (f > 0) { rr(ctx, 20, 54, (W2 - 40) * f, 24, 12); ctx.fill(); }
  ctx.font = 'bold 18px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${Math.max(0, b.hp)} / ${b.max}`, W2 / 2, 67); ctx.textAlign = 'left';
  (s.userData.tex as THREE.CanvasTexture).needsUpdate = true;
}
function drawIntent(text: string, kind: string) {
  const ctx = intentSprite.userData.ctx as CanvasRenderingContext2D; ctx.clearRect(0, 0, 256, 128);
  const bg = kind === 'attack' ? '#ff6b7a' : kind === 'defend' ? '#4fa8ff' : '#b05cff';
  ctx.fillStyle = bg; rr(ctx, 28, 18, 200, 84, 42); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
  ctx.font = 'bold 46px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 62);
  (intentSprite.userData.tex as THREE.CanvasTexture).needsUpdate = true;
}
function floatText(text: string, color: string, at: THREE.Vector3, big = false) {
  const s = canvasSprite(256, 128, big ? 2.4 : 1.6, big ? 1.2 : 0.8); const ctx = s.userData.ctx as CanvasRenderingContext2D;
  ctx.font = `900 ${big ? 70 : 62}px Nunito, Trebuchet MS, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 12; ctx.strokeStyle = '#2b1d40'; ctx.strokeText(text, 128, 64); ctx.fillStyle = color; ctx.fillText(text, 128, 64);
  s.userData.tex.needsUpdate = true; s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0.3)); scene.add(s);
  const y0 = s.position.y; const sc = s.scale.clone();
  tween(1.1, p => { s.position.y = y0 + p * 1.3; (s.material as THREE.SpriteMaterial).opacity = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4; const pop = p < 0.15 ? 0.6 + p / 0.15 * 0.6 : 1.2 - Math.min(0.2, (p - 0.15)); s.scale.set(sc.x * pop, sc.y * pop, 1); },
    () => { scene.remove(s); s.material.map?.dispose(); s.material.dispose(); });
}

// ---------- tween/queue ----------
function tween(dur: number, fn: (p: number) => void, done?: () => void) { tweens.push({ t0: now, dur, fn, done }); }
function step(dur: number, run: () => void) { queue.push({ dur, run }); }
export function busy() { return queue.length > 0 || now < stepEnd; }
export function onIdle(cb: () => void) { if (!busy()) cb(); else idleCbs.push(cb); }
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

function burst(at: THREE.Vector3, color: number, n = 14, speed = 3, up = 1, life = 0.7, emissive = true) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true }); void emissive;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat); m.position.copy(at); scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * up + 0.2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
    tween(life, p => { m.position.addScaledVector(v, 0.016); v.y -= 0.12; m.rotation.x += 0.2; m.scale.setScalar(1 - p); mat.opacity = 1 - p; }, () => scene.remove(m));
  }
  setTimeout(() => mat.dispose(), life * 1000 + 100);
}
function sparkles(target: THREE.Object3D, color: number, n = 18) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat); const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.5;
    const base = new THREE.Vector3(target.position.x + Math.cos(a) * r, 0.1 + Math.random() * 0.5, target.position.z + Math.sin(a) * r); m.position.copy(base); scene.add(m);
    const delay = Math.random() * 0.4;
    tween(1.2, p => { const q = Math.max(0, (p - delay) / (1 - delay)); m.position.y = base.y + q * 2; m.position.x = base.x + Math.sin(q * 8 + a) * 0.15; m.scale.setScalar(q > 0 ? Math.sin(q * Math.PI) * 1.4 : 0); mat.opacity = 1 - q * 0.6; }, () => scene.remove(m));
  }
  setTimeout(() => mat.dispose(), 1400);
}
function flash(obj: THREE.Object3D, color = 0xffffff, dur = 0.18) {
  const mats = flashMats.get(obj)!; mats.forEach(m => { m.emissive.setHex(color); m.emissiveIntensity = 0.9; });
  tween(dur, p => mats.forEach(m => m.emissiveIntensity = 0.9 * (1 - p)), () => mats.forEach(m => { m.emissive.setHex(m.userData.e0); m.emissiveIntensity = m.userData.i0; }));
}
function cloneMats(obj: THREE.Object3D) {
  const list: THREE.MeshToonMaterial[] = [];
  obj.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).type === 'MeshToonMaterial') { const c = (m.material as THREE.MeshToonMaterial).clone(); c.userData.e0 = c.emissive.getHex(); c.userData.i0 = c.emissiveIntensity; m.material = c; list.push(c); } });
  flashMats.set(obj, list);
}

// ---------- scene building ----------
// ---- Foreground occluders: props between the camera and the fighters fade out ----
const occluders: THREE.Object3D[] = []; const occRay = new THREE.Raycaster();
function prop<T extends THREE.Object3D>(o: T): T {
  o.updateMatrixWorld(true);
  o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.Material).transparent = true; } });
  o.userData.fade = 1; occluders.push(o); scene.add(o); return o;
}
function updateOccluders(dt: number) {
  if (!occluders.length || !P.visible) return;
  const blocked = new Set<THREE.Object3D>();
  const targets = [pCenter(), eCenter(), pCenter().setY(0.4), eCenter().setY(0.4), pBarSprite?.position.clone(), eBarSprite?.position.clone(), new THREE.Vector3(0, 1, 0)].filter(Boolean) as THREE.Vector3[];
  for (const t of targets) {
    const dir = t.clone().sub(camera.position); const len = dir.length(); occRay.set(camera.position, dir.normalize()); occRay.far = len;
    for (const h of occRay.intersectObjects(occluders, true)) { let o: THREE.Object3D | null = h.object; while (o && !occluders.includes(o)) o = o.parent; if (o) blocked.add(o); }
  }
  const camXZ = new THREE.Vector2(camera.position.x, camera.position.z);
  for (const o of occluders) {
    const near = camXZ.distanceTo(new THREE.Vector2(o.position.x, o.position.z)) < 4.5;
    const target = blocked.has(o) || near ? 0.16 : 1; const f = o.userData.fade as number;
    if (Math.abs(f - target) < 0.005) continue;
    const nf = f + (target - f) * Math.min(1, dt * 8); o.userData.fade = nf;
    o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { const mat = m.material as THREE.Material; mat.opacity = nf; mat.depthWrite = nf > 0.95; m.castShadow = nf > 0.5; } });
  }
}
function buildTheme(t: Theme) {
  occluders.length = 0;
  const fogC = t === 'woods' ? 0xbfe6c4 : t === 'hollow' ? 0x3a1f1a : 0x2a0f12;
  scene.background = new THREE.Color(fogC); scene.fog = new THREE.Fog(fogC, 14, t === 'woods' ? 40 : 30);
  scene.add(new THREE.HemisphereLight(t === 'woods' ? 0xffffff : 0xffc0a0, t === 'woods' ? 0x557755 : 0x301010, t === 'woods' ? 1.3 : 0.8));
  const key = new THREE.DirectionalLight(t === 'woods' ? 0xfff2dd : 0xffb080, t === 'woods' ? 1.6 : 1.1); key.position.set(-4, 10, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(key);
  const rim = new THREE.PointLight(t === 'woods' ? 0xfff6c0 : 0xff5a20, t === 'woods' ? 0.8 : 3, 14); rim.position.set(0, 3, -4); scene.add(rim);
  const groundC = t === 'woods' ? 0x7cc46e : t === 'hollow' ? 0x5a3c32 : 0x3a2220;
  const g = mesh(new THREE.CylinderGeometry(t === 'boss' ? 9 : 8, 9.5, 0.6, 40), groundC, 0, -0.3, 0); scene.add(g);
  const clearing = mesh(new THREE.CircleGeometry(4.6, 40), t === 'woods' ? 0xa9dc8a : t === 'hollow' ? 0x6e4a3c : 0x4a2a24, 0, 0.01, 0); clearing.rotation.x = -Math.PI / 2; scene.add(clearing);
  const backdrop = mesh(new THREE.CircleGeometry(80, 32), t === 'woods' ? 0x5aa860 : 0x1a0a08, 0, -0.5, 0); backdrop.rotation.x = -Math.PI / 2; scene.add(backdrop);
  if (t === 'woods') {
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + 0.2, r = 6.5 + (i % 3) * 1.2; if (Math.sin(a) > 0.55 && r < 8) continue; prop(buildTree(i % 4 === 0 ? 'shroom' : i % 2 ? 'pine' : 'round', 1 + (i % 3) * 0.25).translateX(Math.cos(a) * r).translateZ(Math.sin(a) * r)); }
    for (let i = 0; i < 30; i++) { const f = mesh(new THREE.SphereGeometry(0.08, 6, 4), [0xff8fb8, 0xfff176, 0xffffff][i % 3], (Math.random() - 0.5) * 9, 0.08, (Math.random() - 0.5) * 9); scene.add(f); }
    ambientParticles(0xfff7a0, 60, 0.02, 4);
  } else {
    const rockC = t === 'boss' ? 0x4a2a28 : 0x5a4038;
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 7 + (i % 2) * 1.2; const h = 1.5 + ((i * 37) % 5) * 0.6; const rk = mesh(new THREE.ConeGeometry(0.9 + (i % 3) * 0.3, h * (t === 'boss' ? 1.6 : 1), 5), rockC, Math.cos(a) * r, h / 2, Math.sin(a) * r); if (Math.sin(a) > 0.5) rk.scale.y = 0.35; prop(rk); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4, r = 5.6; const lava = mesh(new THREE.CircleGeometry(0.7 + (i % 3) * 0.3, 14), 0xff6a2a, Math.cos(a) * r, 0.03, Math.sin(a) * r, 0xff3300); lava.rotation.x = -Math.PI / 2; lava.castShadow = false; scene.add(lava); const pl = new THREE.PointLight(0xff5a1a, 2, 4); pl.position.set(lava.position.x, 0.6, lava.position.z); scene.add(pl); }
    if (t === 'boss') {
      for (const x of [-5, 5]) { const pil = mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), 0x6a3a30, x, 2.5, -3.5); prop(pil); const fire = mesh(new THREE.ConeGeometry(0.35, 0.8, 8), 0xffa020, x, 5.4, -3.5, 0xff6600); scene.add(fire); const fl = new THREE.PointLight(0xff8a30, 4, 9); fl.position.set(x, 5.6, -3.5); scene.add(fl); }
      const ring = mesh(new THREE.TorusGeometry(4.4, 0.08, 6, 48), 0xff5a2a, 0, 0.04, 0, 0xff2200); ring.rotation.x = Math.PI / 2; scene.add(ring);
    }
    ambientParticles(0xff8a3a, t === 'boss' ? 90 : 60, 0.03, 5);
  }
}
function ambientParticles(color: number, n: number, speed: number, spread: number) {
  const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * spread * 2; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ambient = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false })); ambient.userData.speed = speed; scene.add(ambient);
}

// ---------- public API ----------
export function enterArena(enemyId: string, zone: ZoneId) {
  const def = ENEMIES[enemyId]; theme = def.shape === 'boss' ? 'boss' : zone === 'hollow' ? 'hollow' : 'woods';
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry !== sparkGeo) m.geometry.dispose(); if ((o as THREE.Points).isPoints) { (o as THREE.Points).geometry.dispose(); } if ((o as THREE.Sprite).isSprite) { const sm = (o as THREE.Sprite).material; sm.map?.dispose(); sm.dispose(); } });
  scene.clear(); tweens = []; queue = []; idleCbs = []; flashMats.clear(); stepEnd = 0; shakeAmp = 0; outro = -1; outroCb = null; ambient = null;
  buildTheme(theme);
  // player
  const sp = species(); const hat = S.wearing ? ITEMS[S.wearing] : null;
  pModel = buildChibi(sp.animal, sp.color, sp.accent, hat?.model ?? null, hat?.color); if (S.equipped) attachWeapon(pModel, S.equipped);
  pModel.scale.setScalar(1.25); P.clear(); P.visible = true; P.position.set(PX, 0, 0.3); P.rotation.set(0, Math.PI / 2 - 0.35, 0); P.add(pModel); scene.add(P); cloneMats(P);
  // enemy
  eModel = buildEnemy(def.shape, def.color); const es = def.shape === 'boss' ? 1.9 : 1.5 * def.scale + 0.2; eModel.scale.setScalar(es);
  E.clear(); E.visible = true; E.position.set(def.shape === 'boss' ? EX + 0.6 : EX, 0, -0.2); E.rotation.set(0, -Math.PI / 2 + 0.35, 0); E.scale.setScalar(1); E.add(eModel); scene.add(E); cloneMats(E);
  // shadows under actors
  for (const [a, r] of [[P, 0.7], [E, def.shape === 'boss' ? 2 : 0.9]] as const) { const sh = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; a.add(sh); }
  // bubbles & aura
  const bubbleMat = () => new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0, depthWrite: false });
  pBubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), bubbleMat()); pBubble.position.y = 1.1; P.add(pBubble);
  eBubble = new THREE.Mesh(new THREE.SphereGeometry(def.shape === 'boss' ? 2.6 : 1.3, 24, 16), bubbleMat()); eBubble.position.y = def.shape === 'boss' ? 1.8 : 0.9; E.add(eBubble);
  eAura = new THREE.Mesh(new THREE.TorusGeometry(def.shape === 'boss' ? 2 : 1, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0 })); eAura.rotation.x = Math.PI / 2; eAura.position.y = 0.1; E.add(eAura);
  // bars / intent
  const eTop = def.shape === 'boss' ? 4.4 : 2.4;
  pBars = { name: `${S.name} · Lv ${S.level}`, hp: S.hp, max: 1, block: 0, color: '#ff7a8a' }; eBars = { name: `${def.name} · Lv ${def.level}`, hp: def.hp, max: def.hp, block: 0, color: '#ffb03b' };
  pBarSprite = canvasSprite(320, 96, 2.4, 0.72); pBarSprite.position.set(PX, 2.7, 0.3); scene.add(pBarSprite);
  eBarSprite = canvasSprite(320, 96, 2.4, 0.72); eBarSprite.position.set(E.position.x, eTop, E.position.z); scene.add(eBarSprite);
  intentSprite = canvasSprite(256, 128, 1.3, 0.65); intentSprite.position.set(E.position.x, eTop + 0.75, E.position.z); scene.add(intentSprite);
  drawBars(eBarSprite, eBars);
  // fade overlay + intro zoom
  fadeEl = document.querySelector('.arena-fade') ?? Object.assign(document.createElement('div'), { className: 'arena-fade' }); document.body.appendChild(fadeEl);
  fadeEl.style.transition = 'none'; fadeEl.style.opacity = '1'; requestAnimationFrame(() => { fadeEl.style.transition = 'opacity .6s'; fadeEl.style.opacity = '0'; });
  intro = 0; W.overlay = { render };
}
export function exitArena(cb: () => void) { outro = 0; outroCb = cb; fadeEl.style.transition = 'opacity .45s'; fadeEl.style.opacity = '1'; }

export function setPlayerBars(hp: number, max: number, block: number) { pBars.hp = hp; pBars.max = max; pBars.block = block; drawBars(pBarSprite, pBars); bubble(pBubble, block); }
function setEnemyBars(hp: number, block: number) { eBars.hp = hp; eBars.block = block; drawBars(eBarSprite, eBars); bubble(eBubble, block); }
function bubble(b: THREE.Mesh, block: number) { const m = b.material as THREE.MeshBasicMaterial; const target = block > 0 ? 0.22 : 0; const from = m.opacity; if (Math.abs(target - from) < 0.01) return; tween(0.3, p => { m.opacity = from + (target - from) * p; b.scale.setScalar(target ? 0.7 + 0.3 * ease(p) : 1); }); }
export function setIntent(text: string, kind: string) { step(0.01, () => drawIntent(text, kind)); }

const eCenter = () => new THREE.Vector3(E.position.x, ENEMIES_IS_BOSS() ? 2.2 : 1.1, E.position.z);
const pCenter = () => new THREE.Vector3(P.position.x, 1.3, P.position.z);
function ENEMIES_IS_BOSS() { return theme === 'boss'; }

/** Player melee hit (attack cards). */
export function playerMelee(dmg: number, crit: boolean, ehp: number, eblock: number, blocked: number) {
  step(0.55, () => {
    const x0 = PX; tween(0.22, p => { P.position.x = x0 + Math.sin(p * Math.PI) * 2.6; P.position.y = Math.sin(p * Math.PI) * 0.4; pModel.rotation.x = Math.sin(p * Math.PI) * 0.3; });
    setTimeout(() => impact(dmg, crit, ehp, eblock, blocked), 110);
  });
}
/** Magic projectile (skill cards that deal damage). */
export function playerMagic(dmg: number, crit: boolean, ehp: number, eblock: number, blocked: number) {
  step(0.75, () => {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color: 0xb98cff })); const glow = new THREE.PointLight(0xb98cff, 3, 4); orb.add(glow);
    const a = pCenter().add(new THREE.Vector3(0.4, 0.3, 0)), b = eCenter(); scene.add(orb);
    tween(0.12, p => pModel.position.y = Math.sin(p * Math.PI) * 0.25);
    tween(0.45, p => { orb.position.lerpVectors(a, b, ease(p)); orb.position.y += Math.sin(p * Math.PI) * 0.8; orb.scale.setScalar(1 + Math.sin(now * 40) * 0.15); if (Math.random() < 0.6) burst(orb.position.clone(), 0xe0c8ff, 1, 0.6, 0.3, 0.4); },
      () => { scene.remove(orb); burst(b, 0xb98cff, 22, 4, 1, 0.7); impact(dmg, crit, ehp, eblock, blocked); });
  });
}
function impact(dmg: number, crit: boolean, ehp: number, eblock: number, blocked: number) {
  const net = dmg - blocked;
  flash(E, crit ? 0xffe066 : 0xffffff); shake(crit ? 0.35 : 0.15);
  const ex = E.position.x; tween(0.3, p => { E.position.x = ex + Math.sin(p * Math.PI) * (crit ? 0.8 : 0.45); eModel.rotation.z = -Math.sin(p * Math.PI) * 0.25; }, () => E.position.x = ex);
  burst(eCenter(), crit ? 0xffd700 : 0xffffff, crit ? 22 : 10, crit ? 5 : 3);
  if (crit) floatText('CRIT!', '#ffd84d', eCenter().add(new THREE.Vector3(0, 1.2, 0)), true);
  if (blocked) floatText(`🛡${blocked}`, '#8fd4ff', eCenter().add(new THREE.Vector3(-0.6, 0.4, 0)));
  floatText(`-${net}`, crit ? '#ffcf4d' : '#ffffff', eCenter().add(new THREE.Vector3(0, 0.6, 0)), crit);
  setEnemyBars(ehp, eblock);
}
export function playerBlock(block: number, hp: number, max: number) {
  step(0.45, () => { const m = pBubble.material as THREE.MeshBasicMaterial; tween(0.4, p => { pBubble.scale.setScalar(0.4 + ease(p) * 0.65); m.opacity = 0.5 - p * 0.28; }); burst(pCenter(), 0x8fd4ff, 12, 2.5, 1, 0.6); floatText(`+${block}🛡`, '#8fd4ff', pCenter().add(new THREE.Vector3(0, 1, 0))); setPlayerBars(hp, max, pBars.block + block); });
}
export function playerHeal(amount: number, hp: number, max: number) {
  step(0.6, () => { sparkles(P, 0x7ee08a, 16); sparkles(P, 0xffb3d1, 8); flash(P, 0x7ee08a, 0.4); floatText(`+${amount}`, '#7ee08a', pCenter().add(new THREE.Vector3(0, 1, 0))); setPlayerBars(hp, max, pBars.block); });
}
export function playerUtility(color = 0xfff176) { step(0.35, () => { sparkles(P, color, 10); tween(0.3, p => pModel.position.y = Math.sin(p * Math.PI) * 0.3); }); }
export function enemyDizzy() { step(0.3, () => { burst(eCenter().add(new THREE.Vector3(0, 0.8, 0)), 0xfff176, 10, 1.5, 0.2, 0.8); floatText('Dizzy!', '#fff176', eCenter().add(new THREE.Vector3(0, 1.4, 0))); }); }

export function enemyAttack(dmg: number, blocked: number, hp: number, max: number, blockLeft: number) {
  step(0.6, () => {
    const ex = E.position.x; const boss = theme === 'boss';
    tween(0.26, p => { E.position.x = ex - Math.sin(p * Math.PI) * (boss ? 2 : 2.8); E.position.y = Math.sin(p * Math.PI) * (boss ? 0.2 : 0.5); }, () => { E.position.x = ex; E.position.y = 0; });
    setTimeout(() => {
      shake(boss ? 0.4 : 0.2); if (dmg > 0) flash(P, 0xff4466); burst(pCenter(), boss ? 0xff7a30 : 0xff8a9a, 10, 3);
      const px = PX; tween(0.3, p => { P.position.x = px - Math.sin(p * Math.PI) * 0.4; pModel.rotation.z = Math.sin(p * Math.PI) * 0.25; }, () => P.position.x = px);
      if (blocked) { floatText(`🛡${blocked}`, '#8fd4ff', pCenter().add(new THREE.Vector3(0.5, 0.5, 0))); const m = pBubble.material as THREE.MeshBasicMaterial; m.opacity = 0.6; }
      floatText(dmg > 0 ? `-${dmg}` : 'Blocked!', dmg > 0 ? '#ff7a8a' : '#8fd4ff', pCenter().add(new THREE.Vector3(0, 0.8, 0)));
      setPlayerBars(hp, max, blockLeft);
    }, 130);
  });
}
export function enemyDefend(block: number, ehp: number) { step(0.5, () => { const m = eBubble.material as THREE.MeshBasicMaterial; tween(0.4, p => { eBubble.scale.setScalar(0.4 + ease(p) * 0.6); m.opacity = 0.5 - p * 0.28; }); floatText(`+${block}🛡`, '#8fd4ff', eCenter().add(new THREE.Vector3(0, 1, 0))); setEnemyBars(ehp, block); }); }
export function enemyBuff(n: number) {
  step(0.6, () => { const m = eAura.material as THREE.MeshBasicMaterial; tween(0.55, p => { eAura.scale.setScalar(0.5 + p * 1.5); m.opacity = 1 - p; eModel.scale.multiplyScalar(1 + Math.sin(p * Math.PI) * 0.01); eAura.position.y = 0.1 + p * 1.2; }); flash(E, 0xff3355, 0.4); burst(eCenter(), 0xff3355, 14, 2, 1.5, 0.7); floatText(`+${n} STR`, '#ff6b7a', eCenter().add(new THREE.Vector3(0, 1.2, 0))); });
}
export function newPlayerTurn(hp: number, max: number) { step(0.01, () => setPlayerBars(hp, max, 0)); }
export function enemyClearBlock(ehp: number) { step(0.01, () => setEnemyBars(ehp, 0)); }

export function victory() {
  step(1.3, () => {
    shake(0.25); flash(E, 0xffffff, 0.3);
    const s0 = eModel.scale.x; tween(0.9, p => { eModel.scale.setScalar(s0 * (1 - ease(p))); eModel.rotation.y += 0.25; E.position.y = Math.sin(p * Math.PI) * 0.6; }, () => { E.visible = false; burst(new THREE.Vector3(E.position.x, 0.8, E.position.z), 0xffffff, 24, 4, 1.5, 0.9); });
    eBarSprite.visible = intentSprite.visible = false;
    setTimeout(() => { for (const c of [0xff8fb8, 0xfff176, 0x6ecbff, 0x7ee08a]) burst(pCenter().add(new THREE.Vector3(0, 1.5, 0)), c, 10, 4, 2, 1.2); }, 700);
    tween(1.2, p => { P.position.y = Math.abs(Math.sin(p * Math.PI * 3)) * 0.6; P.rotation.y = Math.PI / 2 - 0.35 + p * Math.PI * 2; });
  });
}
export function defeat() {
  step(1.2, () => { flash(P, 0x6644aa, 0.6); tween(0.8, p => { pModel.rotation.z = ease(p) * 1.4; P.position.y = 0; }); burst(pCenter().add(new THREE.Vector3(0, 1, 0)), 0xfff176, 12, 1, 0.5, 1.2); floatText('Fainted…', '#d9c7ff', pCenter().add(new THREE.Vector3(0, 1.4, 0)), true); pBarSprite.visible = false; });
}
function shake(a: number) { shakeAmp = Math.max(shakeAmp, a); }

// ---------- render loop (called by world tick while active) ----------
function render(dt: number) {
  now += dt;
  // queue
  if (now >= stepEnd && queue.length) { const s = queue.shift()!; stepEnd = now + s.dur; s.run(); }
  if (!busy() && idleCbs.length) { const cbs = idleCbs; idleCbs = []; cbs.forEach(c => c()); }
  // tweens
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; const p = Math.min(1, (now - tw.t0) / tw.dur); tw.fn(p); if (p >= 1) { tweens.splice(i, 1); tw.done?.(); } }
  // idle motion
  pModel.position.y = pModel.position.y * 0.9 + (Math.sin(now * 3) * 0.04) * 0.1;
  if (E.visible) eModel.children[0].scale.y = (eModel.children[0].userData.sy ??= eModel.children[0].scale.y) * (1 + Math.sin(now * 4) * 0.04);
  intentSprite.position.y += Math.sin(now * 3) * 0.002;
  if (ambient) { const a = ambient.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + ambient.userData.speed; if (y > 4.5) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(now + i) * 0.003); } a.needsUpdate = true; }
  // camera: intro zoom, subtle orbit, shake
  intro = Math.min(1, intro + dt / 1.1); const ie = ease(intro);
  const boss = theme === 'boss'; const orbit = Math.sin(now * 0.25) * 0.9;
  // portrait phones: widen the lens and pull back so both fighters stay in frame above the card hand
  const portrait = camera.aspect < 0.9; const short = !portrait && innerHeight < 500; const pf = portrait ? 1.28 : short ? 1.05 : 1;
  const dist = ((boss ? 10.5 : 9) + (1 - ie) * 9) * pf; const height = ((boss ? 4.2 : 3.4) + (1 - ie) * 5) * pf;
  camera.position.set(orbit * (portrait ? 0.35 : 1.2) + (1 - ie) * -4, height, dist);
  const look = new THREE.Vector3(portrait ? 0.5 : 0.2, (boss ? 1.6 : 1.1) - (portrait ? 1.6 : short ? 1.35 : 0), 0);
  const fov = portrait ? 72 : 40; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (shakeAmp > 0.001) { camera.position.x += (Math.random() - 0.5) * shakeAmp; camera.position.y += (Math.random() - 0.5) * shakeAmp; shakeAmp *= 0.86; }
  camera.lookAt(look);
  camera.updateMatrixWorld(); updateOccluders(dt);
  if (outro >= 0) { outro += dt; camera.position.lerp(look, Math.min(0.5, outro * 0.8)); camera.lookAt(look); if (outro > 0.5 && outroCb) { const cb = outroCb; outroCb = null; W.overlay = null; scene.clear(); fadeEl.style.transition = 'opacity .5s'; fadeEl.style.opacity = '0'; cb(); return; } }
  const r = W.renderer; const sz = r.getSize(new THREE.Vector2()); if (camera.aspect !== sz.x / sz.y) { camera.aspect = sz.x / sz.y; camera.updateProjectionMatrix(); }
  r.render(scene, camera);
}
