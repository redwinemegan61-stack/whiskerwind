// Bellbrook townsfolk, branching dialogue boxes with typewriter text, quest markers, and the intro story.
import * as THREE from 'three';
import { ZoneId } from './data';
import { S, save } from './state';
import { W, npc } from './world';
import { QUESTS, offersFor, talkTargets, resolveTalk, startQuest, inProgressFor, curStep, isAvailable } from './quests';
import { closePanel } from './ui';

type Animal = 'rabbit' | 'bear' | 'fox' | 'cat';
export interface NpcDef { id: string; name: string; portrait: string; tint: string; where?: string; animal?: Animal; color?: number; accent?: number; hat?: string | null; zone?: ZoneId; x?: number; z?: number; rot?: number; chatter: string[] }
const N = (d: NpcDef) => d;
export const NPCS: Record<string, NpcDef> = Object.fromEntries([
  // new townsfolk (placed here)
  N({ id: 'wickerbee', name: 'Mayor Wickerbee', portrait: '🐰', tint: '#ffd36e', where: 'by the fountain', animal: 'rabbit', color: 0xfff8ee, accent: 0xffc0d0, hat: 'wizard', zone: 'town', x: -2.8, z: 2.7, rot: 0.6,
    chatter: ['The fountain used to glow every night. I do miss it.', 'A mayor\'s work is mostly saying hello. I\'m very good at it.', 'If the critters get too jumpy, a Hushleaf Sachet from Lumi\'s shop keeps them calm.'] }),
  N({ id: 'nutmeg', name: 'Granny Nutmeg', portrait: '👵', tint: '#ffb38a', where: 'near your den', animal: 'bear', color: 0xd9b08a, accent: 0xfff1e0, hat: 'flower', zone: 'town', x: -5.4, z: 11.6, rot: 2.6,
    chatter: ['Puff berries grow on the round bushes. Blue ones are ripe!', 'Eat something warm before you go adventuring, dearie.'] }),
  N({ id: 'quill', name: 'Quill', portrait: '🦊', tint: '#ff9a4d', where: 'near the card parlor', animal: 'fox', color: 0xff9a4d, accent: 0xfff1e0, hat: 'party', zone: 'town', x: 2.6, z: 10.4, rot: 3.4,
    chatter: ['I\'m gonna be an explorer when I\'m bigger. Bigger-er.', 'Hidden places sparkle when you get close. That\'s a fact.'] }),
  N({ id: 'sprocket', name: 'Sprocket', portrait: '🔧', tint: '#9fd8ff', where: 'west road', animal: 'rabbit', color: 0xc8c8d8, accent: 0x7f8fb0, hat: null, zone: 'town', x: -10.6, z: -1.3, rot: 1.2,
    chatter: ['Crates break. Pots break. Everything breaks if you believe in yourself.', 'I once found a key in a pot. A KEY. In a POT.'] }),
  N({ id: 'clover', name: 'Clover', portrait: '🐱', tint: '#b8ffb0', where: 'by the woods portal', animal: 'cat', color: 0xf0e0d0, accent: 0x9fdc8a, hat: 'bow', zone: 'town', x: -3.2, z: -10.6, rot: 0.4,
    chatter: ['Golden puffballs run away if you\'re loud. Be quick instead!', 'I collect four-leaf clovers. I have one. It\'s a start.'] }),
  N({ id: 'pebble', name: 'Pebble', portrait: '🐻', tint: '#d9b48a', where: 'behind the furniture shop', animal: 'bear', color: 0xa8865c, accent: 0xffe1b8, hat: null, zone: 'town', x: 10.6, z: -7.8, rot: -0.8,
    chatter: ['Rare chests glow blue, epic ones purple. Locked ones? Gold.', 'Chapter one of my guide: "Chests". Chapter two: "More chests".'] }),
  N({ id: 'biscuit', name: 'Biscuit', portrait: '🥐', tint: '#ffe0a0', where: 'next to Your Stall', animal: 'bear', color: 0xe8c89a, accent: 0xffffff, hat: 'party', zone: 'town', x: -4.6, z: 6.6, rot: 2.2,
    chatter: ['Price things a little under market and they fly off the shelf.', 'I bake, I sell, I nap. Perfect day.'] }),
  N({ id: 'juniper', name: 'Juniper', portrait: '😺', tint: '#d6c8ff', where: 'east market', animal: 'cat', color: 0x9a8fb0, accent: 0xffd6e8, hat: 'flower', zone: 'town', x: 4.2, z: 5.6, rot: 3.6,
    chatter: ['Brass keys turn up in crates, bounties, and mini-boss hoards.', 'Locked chests restock slowly. Worth the wait!'] }),
  N({ id: 'olive', name: 'Olive', portrait: '🌙', tint: '#9fb4ff', where: 'west of the boutique', animal: 'fox', color: 0xe8d8c0, accent: 0x6c7aa0, hat: 'wizard', zone: 'town', x: -9.6, z: -5.4, rot: 0.9,
    chatter: ['When the lanterns light up, the island gets so cosy.', 'Moonscale Eels only bite at night. Shh, it\'s a secret.'] }),
  N({ id: 'mossbeard', name: 'Old Mossbeard', portrait: '🐢', tint: '#8fd07a', where: 'Whispering Glade, woods', animal: 'bear', color: 0x8a9a7a, accent: 0xcfe0b0, hat: 'wizard', zone: 'woods', x: -19.2, z: -0.6, rot: 0.8,
    chatter: ['The woods remember everyone who walks gently.', 'Critters only chase you if you get right up close. Give them room.'] }),
  N({ id: 'pell', name: 'Pell', portrait: '🦎', tint: '#ff8a5a', where: 'Hollow campfire', animal: 'fox', color: 0xff6a4a, accent: 0xffd36e, hat: null, zone: 'hollow', x: 5.2, z: 10, rot: -2.2,
    chatter: ['Smoulderjaw snores like a kettle. You can hear it from here.', 'Ember imps are hot-headed but they calm down after a good card game.'] }),
  // shopkeepers (placed by world.ts) still talk and give quests
  N({ id: 'pipkin', name: 'Pipkin', portrait: '🐇', tint: '#ffb3c7', where: "Relic Rack, west market", chatter: ['Prices go up and down, so sell when the arrow points up!'] }),
  N({ id: 'brindle', name: 'Brindle', portrait: '🐻', tint: '#6ecbff', where: 'Battle-Bits, west market', chatter: ['A good blade and a good deck. That\'s all you need.'] }),
  N({ id: 'marzi', name: 'Marzi', portrait: '🦊', tint: '#ffd36e', where: 'Curio Cart, east market', chatter: ['Curiosities! Oddities! Things that hum!'] }),
  N({ id: 'hazel', name: 'Hazel', portrait: '🐻', tint: '#8fbf6a', where: 'Nook & Cranny', chatter: ['A rug really ties a room together.'] }),
  N({ id: 'lumi', name: 'Lumi', portrait: '🐱', tint: '#ff7aa8', where: 'Ribbon & Bell', chatter: ['Hushleaf Sachets keep critters calm. Very popular with explorers!'] }),
  N({ id: 'rook', name: 'Rook', portrait: '🦊', tint: '#6a5acd', where: 'Shuffle & Shine', chatter: ['Every pack has a chance at an epic. Every one!'] }),
  N({ id: 'tumbletoe', name: 'Tumbletoe', portrait: '🐰', tint: '#d9c7ff', where: 'by the fountain', chatter: ['Swap? Swap! Let\'s swap.'] }),
].map(n => [n.id, n]));

// main-story lines, keyed by quest id + step index (the talk step)
const STORY: Record<string, string[]> = {
  'm1:0': ['Oh! You came! You actually came! Welcome to Bellbrook, friend.', 'See that lantern on top of the fountain? It lit every night, until Old Smoulderjaw gobbled up its ember and waddled off to Cinder Hollow.', 'Since then the critters in Mossmere Woods have been ever so jumpy. They\'re not mean, just restless.', 'Take these sachets. If the critters crowd you, they\'ll calm right down. Now let\'s get that lantern glowing again!'],
  'm3:1': ['Hmm? A visitor in my glade? Mind the mushrooms, they\'re napping.', 'Wickerbee sent you? Then you\'re after the ember. A brave errand.', 'A new ember needs glowcap oil to take. Bring me four glowcaps. They grow in little glowing clusters around the woods.'],
  'm4:0': ['Four glowcaps, plump and bright. Lovely.', 'There. The oil is pressed. Now the ember will hold its light once you\'ve won it back.', 'But Bramblehorn guards the old path to the Hollow, west of here. Calm that grump first.'],
  'm6:1': ['Psst! Down here. Pell, scout of the Hollow. Mossbeard said you\'d come.', 'Smoulderjaw\'s lair is straight ahead, past the lava pools. But the imps are all fired up.', 'Calm three of them and the path will be quiet enough to reach the old toad.'],
  'm7:1': ['Is that…? It is! The ember! It\'s warm as a fresh bun!', 'Everyone, look! The Glow Lantern is shining again!', 'Puffle Cay owes you a great big thank-you. Here, the Lantern Lid. Wear it proudly, hero of Bellbrook.'],
};

// ---------------- placement + markers ----------------
const markers = new Map<string, THREE.Sprite>();
export function buildTownsfolk(z: ZoneId) {
  for (const n of Object.values(NPCS)) if (n.zone === z && n.animal) npc(n.animal, n.color!, n.accent!, n.x!, n.z!, n.rot ?? 0, n.name, () => talk(n.id), n.hat ?? null, n.id);
  refreshMarkers();
}
function markerTex(ch: string, color: string) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x = c.getContext('2d')!;
  x.fillStyle = color; x.strokeStyle = '#5a3a10'; x.lineWidth = 5; x.beginPath(); x.moveTo(32, 76); x.lineTo(20, 56); x.arc(32, 32, 26, Math.PI * 0.75, Math.PI * 0.25); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#5a3a10'; x.font = '900 40px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 34);
  return new THREE.CanvasTexture(c);
}
const TEX: Record<string, THREE.Texture> = {};
function tex(kind: string) { return TEX[kind] ??= kind === 'offer' ? markerTex('!', '#ffd34d') : kind === 'turnin' ? markerTex('?', '#ffd34d') : markerTex('?', '#d8dde6'); }
export function markerFor(id: string): 'offer' | 'turnin' | 'wait' | null {
  if (!S) return null;
  if (id === 'board') return S.daily.bounties.some(b => S.quests[b]?.state === 'ready') ? 'turnin' : null;
  if (talkTargets(id).length) return 'turnin';
  // story talk step waiting on this NPC but without the items yet
  const waiting = Object.keys(S.quests).some(q => { const st = curStep(q); return st && st.at === id; });
  if (offersFor(id).length) return 'offer';
  if (waiting || inProgressFor(id).length) return 'wait';
  return null;
}
export function refreshMarkers() {
  for (const [id, g] of W.npcs) {
    const kind = markerFor(id); let m = markers.get(id);
    if (m && m.parent !== g) { markers.delete(id); m = undefined; }
    if (!kind) { if (m) m.visible = false; continue; }
    if (!m) { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(kind), depthTest: false, transparent: true })); m.scale.set(0.62, 0.78, 1); m.renderOrder = 12; m.position.y = id === 'board' ? 3.35 : 3.05; g.add(m); markers.set(id, m); m.userData.base = m.position.y; }
    (m.material as THREE.SpriteMaterial).map = tex(kind); m.visible = true;
  }
}
export function animateMarkers(t: number) { for (const m of markers.values()) if (m.visible) m.position.y = m.userData.base + Math.abs(Math.sin(t * 3)) * 0.15; }

// ---------------- dialogue box ----------------
export interface Line { text: string; choices?: { label: string; act?: () => void; primary?: boolean }[] }
let box: HTMLElement | null = null;
export function isTalking() { return !!box; }
export function say(npcId: string, lines: Line[], onDone?: () => void) {
  closePanel(); endDialogue(); const n = NPCS[npcId] ?? { name: npcId, portrait: '💬', tint: '#ffd36e' };
  W.paused = true; W.keys.clear(); W.target = null;
  const el = document.createElement('div'); el.className = 'dialogue'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `${n.name} says`);
  el.innerHTML = `<div class="dlg-card"><div class="dlg-portrait" style="--nc:${n.tint}"><span>${n.portrait}</span></div><div class="dlg-main"><div class="dlg-name">${n.name}</div><p class="dlg-text" aria-live="polite"></p><div class="dlg-choices"></div><div class="dlg-next" aria-hidden="true">▼</div></div></div>`;
  document.getElementById('ui')!.appendChild(el); box = el;
  let i = 0, typing = 0, full = '';
  const textEl = el.querySelector('.dlg-text') as HTMLElement, choicesEl = el.querySelector('.dlg-choices') as HTMLElement;
  const showChoices = () => {
    const ln = lines[i]; el.classList.toggle('has-choices', !!ln.choices?.length);
    choicesEl.innerHTML = (ln.choices ?? []).map((c, k) => `<button class="btn ${c.primary ? 'primary' : ''}" data-ch="${k}">${c.label}</button>`).join('');
    choicesEl.querySelectorAll<HTMLElement>('[data-ch]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); const c = ln.choices![+b.dataset.ch!]; endDialogue(); c.act?.(); }));
  };
  const type = () => {
    clearInterval(typing); full = lines[i].text; textEl.textContent = ''; choicesEl.innerHTML = ''; el.classList.remove('done', 'has-choices'); let k = 0;
    typing = window.setInterval(() => { k += 2; textEl.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); el.classList.add('done'); showChoices(); } }, 28);
  };
  const next = () => {
    if (!el.classList.contains('done')) { clearInterval(typing); textEl.textContent = full; el.classList.add('done'); showChoices(); return; }
    if (lines[i].choices?.length) return;
    if (++i >= lines.length) { endDialogue(); onDone?.(); return; }
    type();
  };
  el.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; next(); });
  (el as any)._next = next; type();
}
export function endDialogue() { if (!box) return; box.remove(); box = null; W.paused = !!document.querySelector('.modal-wrap'); }
addEventListener('keydown', e => { if (!box) return; if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'e') { e.preventDefault(); e.stopImmediatePropagation(); (box as any)._next?.(); } if (e.key === 'Escape') endDialogue(); }, true);

// ---------------- who says what ----------------
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
/** Returns true if the dialogue system handled the conversation (otherwise the NPC's shop opens directly). */
export function talk(npcId: string, shop?: () => void): boolean {
  const n = NPCS[npcId]; if (!n) return false;
  // 1. a story/quest step resolves here
  const ready = talkTargets(npcId)[0];
  if (ready) {
    const q = QUESTS[ready]; const p = S.quests[ready]; const key = `${ready}:${p.step}`; const st = q.steps[p.step];
    const lines = STORY[key] ?? [st.t === 'deliver' ? `Oh, you brought them! Thank you so much.` : 'Thank you, friend!', q.done ?? 'You\'ve been such a help. Here, take this.'];
    say(npcId, lines.map(text => ({ text })), () => resolveTalk(ready));
    return true;
  }
  // 2. offer a quest
  const offer = offersFor(npcId)[0];
  if (offer) {
    const choices: Line['choices'] = [{ label: `Accept: ${offer.title}`, primary: true, act: () => startQuest(offer.id) }];
    if (shop) choices.push({ label: 'Just browsing', act: shop });
    choices.push({ label: 'Maybe later' });
    say(npcId, [{ text: offer.offer ?? offer.blurb, choices }]);
    return true;
  }
  // 3. waiting on something from you
  const waiting = Object.keys(S.quests).map(id => [id, curStep(id)] as const).find(([, st]) => st && st.at === npcId);
  const mine = inProgressFor(npcId)[0];
  if (waiting || mine) {
    const st = waiting ? waiting[1]! : curStep(mine!.id)!;
    const hint = st.t === 'deliver' ? `Still looking for those? ${st.text}. You have ${S.inventory[st.k!] ?? 0}.` : `How's it going? ${st.text}.`;
    if (shop) { say(npcId, [{ text: hint, choices: [{ label: 'Open shop', primary: true, act: shop }, { label: 'On it!' }] }]); return true; }
    say(npcId, [{ text: hint }]); return true;
  }
  if (shop) return false; // straight to the shop, like before
  // 4. idle chatter + nudge toward the story
  const main = Object.keys(S.quests).find(id => QUESTS[id].kind === 'main' && S.quests[id].state === 'active');
  const lines: Line[] = [{ text: pick(n.chatter) }];
  if (main && npcId === 'wickerbee') lines.push({ text: `About the lantern: ${curStep(main)?.text}. You can do it!` });
  say(npcId, lines); return true;
}
export function anyAvailableFor(id: string) { return Object.values(QUESTS).some(q => q.giver === id && isAvailable(q)); }

// ---------------- intro story ----------------
const PAGES = [
  { art: '✉️', title: 'A letter on the wind', text: '“Dear adventurer, Bellbrook\'s Glow Lantern has gone dark. Old Smoulderjaw swallowed its ember, and ever since, the critters of Mossmere Woods have been jumpy and the nights feel long. If you have a brave heart and comfy boots, please come to Puffle Cay.”', sign: 'Mayor Wickerbee' },
  { art: '⛴️', title: 'The Puffwhistle Ferry', text: 'You pack a satchel, a snack, and your lucky acorn. The little ferry puffs across a sea of glitter while gulls wheel overhead, and a green island rises out of the morning mist.' },
  { art: '🏮', title: 'Welcome to Bellbrook', text: 'Lanterns sway over cobbled paths, the fountain burbles, and a bunny in a tall starry hat is waving at you from the plaza…' },
];
export function playIntro(onDone: () => void) {
  W.paused = true; let i = 0;
  const el = document.createElement('div'); el.className = 'storybook-intro'; document.getElementById('ui')!.appendChild(el);
  const render = () => {
    const p = PAGES[i];
    el.innerHTML = `<div class="sb-book"><div class="sb-page" style="--d:${i}"><div class="sb-art"><span>${p.art}</span></div><h2>${p.title}</h2><p>${p.text}</p>${p.sign ? `<p class="sb-sign">— ${p.sign}</p>` : ''}
      <div class="sb-dots">${PAGES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="sb-btns"><button class="btn" id="sbskip">Skip</button><button class="btn primary big" id="sbnext">${i < PAGES.length - 1 ? 'Next ›' : 'Begin adventure ✨'}</button></div></div></div>`;
    el.querySelector('#sbnext')!.addEventListener('click', () => { if (++i >= PAGES.length) finish(); else render(); });
    el.querySelector('#sbskip')!.addEventListener('click', finish);
  };
  const finish = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 350); S.flags.introSeen = true; save(); W.paused = false; onDone(); };
  render();
}
