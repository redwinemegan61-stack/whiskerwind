import * as THREE from 'three';
import { ITEMS, DEN_THEMES } from './data';
import { S, addItem, save, log } from './state';
import { W, groundPoint, pickObjects, addDenPiece, buildZone, DEN_HALF, hooks } from './world';
import { buildFurniture } from './models';
import { ICON } from './icons';

type Sel = { mode: 'new'; itemId: string } | { mode: 'move'; uid: number } | null;
let sel: Sel = null; let ghost: THREE.Group | null = null; let rot = 0; let panel: HTMLElement | null = null;
let gx = 0, gz = 0;

export function isDecorating() { return W.decorating; }

export function enterDecorate() {
  if (S.zone !== 'den') return hooks.toast('Go to your den to decorate!');
  W.decorating = true; document.body.classList.add('decorating'); W.zone.userData.grid.visible = true; hooks.prompt(null);
  panel = document.createElement('div'); panel.className = 'panel den-panel'; document.getElementById('ui')!.appendChild(panel);
  renderPanel();
  W.renderer.domElement.addEventListener('pointermove', onMove);
  W.renderer.domElement.addEventListener('pointerdown', onDown);
  addEventListener('keydown', onKey);
}
export function exitDecorate() {
  cancel(); W.decorating = false; document.body.classList.remove('decorating'); if (W.zone.userData.grid) W.zone.userData.grid.visible = false; panel?.remove(); panel = null;
  W.renderer.domElement.removeEventListener('pointermove', onMove); W.renderer.domElement.removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey);
  save(); hooks.zoneChanged();
}

function renderPanel() {
  if (!panel) return;
  const furn = Object.entries(S.inventory).filter(([id]) => ITEMS[id]?.kind === 'furniture');
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  panel.innerHTML = `<div class="ph"><h2>${ICON.hammer} Decorate Den</h2><button class="btn sm primary" id="dd">${ICON.check} Done</button></div>
    <div class="pb">
    <p class="hint">${sel ? (sel.mode === 'new' ? `Tap the floor to place <b>${ITEMS[sel.itemId].name}</b>.` : 'Tap the floor to move it here.') : 'Pick furniture, then tap the floor. Tap a placed piece to move it.'} <span class="keys"><kbd>R</kbd> rotate <kbd>X</kbd> remove <kbd>Esc</kbd> cancel</span></p>
    <div class="row den-actions">${sel ? `<button class="btn" id="rot">${ICON.rotate} Rotate</button>${sel.mode === 'move' ? `<button class="btn danger" id="rm">${ICON.trash} Remove</button>` : ''}<button class="btn" id="cc">Cancel</button>` : `<span class="pill">🏡 ${S.den.pieces.length} pieces placed</span>`}</div>
    <h3>Your furniture</h3>
    <div class="grid-list">${furn.length ? furn.map(([id, n]) => `<button class="tile r-${ITEMS[id].rarity} ${sel?.mode === 'new' && sel.itemId === id ? 'on' : ''}" data-f="${id}" data-tip="${ITEMS[id].desc}"><span>${ITEMS[id].icon}</span><b>${ITEMS[id].name}</b><i>×${n}</i></button>`).join('') : '<p class="muted">No furniture in your bag. Visit Nook & Cranny in town, or find some in dungeons!</p>'}</div>
    <h3>Wallpaper</h3><div class="swatches">${DEN_THEMES.walls.map(w => `<button class="sw ${S.den.wall === w.id ? 'on' : ''}" data-w="${w.id}" title="${w.name}" aria-label="${w.name} wallpaper" style="--sw:${hex(w.color)}"></button>`).join('')}</div>
    <h3>Flooring</h3><div class="swatches">${DEN_THEMES.floors.map(f => `<button class="sw floor ${S.den.floor === f.id ? 'on' : ''}" data-fl="${f.id}" title="${f.name}" aria-label="${f.name} floor" style="--sw:${hex(f.color)}"></button>`).join('')}</div>
    </div>`;
  panel.querySelector('#dd')!.addEventListener('click', exitDecorate);
  panel.querySelectorAll<HTMLElement>('[data-f]').forEach(b => b.addEventListener('click', () => select({ mode: 'new', itemId: b.dataset.f! })));
  panel.querySelectorAll<HTMLElement>('[data-w]').forEach(b => b.addEventListener('click', () => { S.den.wall = b.dataset.w!; rebuild(); }));
  panel.querySelectorAll<HTMLElement>('[data-fl]').forEach(b => b.addEventListener('click', () => { S.den.floor = b.dataset.fl!; rebuild(); }));
  panel.querySelector('#rot')?.addEventListener('click', rotate);
  panel.querySelector('#rm')?.addEventListener('click', remove);
  panel.querySelector('#cc')?.addEventListener('click', () => { cancel(); renderPanel(); });
}
function rebuild() { const keep = sel; cancel(); buildZone(); W.zone.userData.grid.visible = true; save(); renderPanel(); void keep; }

function select(s: Sel) {
  cancel(); sel = s; if (!s) return;
  const itemId = s.mode === 'new' ? s.itemId : S.den.pieces.find(p => p.uid === s.uid)!.itemId;
  if (s.mode === 'move') { const p = S.den.pieces.find(p => p.uid === s.uid)!; rot = p.rot; gx = p.x; gz = p.z; W.denPieces.get(s.uid)!.visible = false; } else rot = 0;
  const it = ITEMS[itemId]; ghost = buildFurniture(it.model!, it.color!);
  ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.Material).transparent = true; (m.material as THREE.Material).opacity = 0.6; m.castShadow = false; } });
  ghost.position.set(gx, 0.02, gz); ghost.rotation.y = rot * Math.PI / 2; W.zone.add(ghost); renderPanel();
}
function cancel() {
  if (ghost) { W.zone.remove(ghost); ghost = null; }
  if (sel?.mode === 'move') W.denPieces.get(sel.uid)!.visible = true;
  sel = null;
}
function snap(p: THREE.Vector3, model: string) {
  let x = Math.round(p.x), z = Math.round(p.z); const lim = DEN_HALF - 1;
  x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
  if (model === 'art') { z = -DEN_HALF + 0.5; }
  return [x, z];
}
function curModel() { if (!sel) return ''; const id = sel.mode === 'new' ? sel.itemId : S.den.pieces.find(p => p.uid === (sel as any).uid)!.itemId; return ITEMS[id].model!; }
function onMove(e: PointerEvent) { if (!ghost) return; const p = groundPoint(e.clientX, e.clientY); if (!p) return; [gx, gz] = snap(p, curModel()); ghost.position.set(gx, 0.02, gz); }
function onDown(e: PointerEvent) {
  if (e.button === 2) { cancel(); renderPanel(); return; }
  if (!sel) {
    const hit = pickObjects(e.clientX, e.clientY, [...W.denPieces.values()]);
    if (hit) { let o: THREE.Object3D | null = hit.object; while (o && o.userData.uid === undefined) o = o.parent; if (o) select({ mode: 'move', uid: o.userData.uid }); }
    return;
  }
  const p = groundPoint(e.clientX, e.clientY); if (p) [gx, gz] = snap(p, curModel());
  if (sel.mode === 'new') {
    if (!S.inventory[sel.itemId]) return cancel();
    addItem(sel.itemId, -1); const uid = S.den.nextUid++;
    S.den.pieces.push({ uid, itemId: sel.itemId, x: gx, z: gz, rot }); addDenPiece(uid);
    const keepId = sel.itemId; cancel(); if (S.inventory[keepId]) select({ mode: 'new', itemId: keepId });
  } else {
    const piece = S.den.pieces.find(q => q.uid === (sel as any).uid)!; piece.x = gx; piece.z = gz; piece.rot = rot;
    const g = W.denPieces.get(piece.uid)!; g.position.set(gx, 0, gz); g.rotation.y = rot * Math.PI / 2; cancel();
  }
  save(); renderPanel();
}
function rotate() { if (!ghost) return; rot = (rot + 1) % 4; ghost.rotation.y = rot * Math.PI / 2; }
function remove() {
  if (sel?.mode !== 'move') return; const uid = sel.uid; const i = S.den.pieces.findIndex(p => p.uid === uid);
  const piece = S.den.pieces[i]; S.den.pieces.splice(i, 1); addItem(piece.itemId, 1);
  const g = W.denPieces.get(uid)!; W.zone.remove(g); W.denPieces.delete(uid); if (ghost) W.zone.remove(ghost); ghost = null; sel = null;
  log(`Packed up ${ITEMS[piece.itemId].name}.`); save(); renderPanel();
}
function onKey(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  if (k === 'r') rotate(); else if (k === 'x' || k === 'delete') remove(); else if (k === 'escape') { if (sel) { cancel(); renderPanel(); } else exitDecorate(); }
}
