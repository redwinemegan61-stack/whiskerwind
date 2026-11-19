import { ITEMS, SPECIES, STARTER_DECK, ZoneId, Stats, Species, NPC_NAMES, Rarity } from './data';

export interface StallListing { itemId: string; price: number; listedAt: number }
export interface ShopStock { itemId: string; qty: number }
export interface NpcShop { id: string; owner: string; title: string; animal: 'rabbit' | 'bear' | 'fox' | 'cat'; stock: ShopStock[] }
export interface DenPiece { uid: number; itemId: string; x: number; z: number; rot: number }
export interface Save {
  version: 1; name: string; speciesId: string; level: number; exp: number; hp: number; mp: number;
  glimmer: number; inventory: Record<string, number>; equipped: string | null;
  cards: Record<string, number>; deck: string[]; zone: ZoneId; pos: [number, number];
  stall: StallListing[]; marketFactor: Record<string, number>; shops: NpcShop[];
  chests: Record<string, number>; // chestId -> time it can respawn
  bossRespawn: number; log: string[];
  den: { pieces: DenPiece[]; wall: string; floor: string; nextUid: number }; wearing: string | null; stats: { battlesWon: number; chestsOpened: number; sold: number };
  // ---- round 3: story, quests & loot sources (added to old saves by migrate()) ----
  quests: Record<string, QuestProgress>;
  flags: Record<string, boolean | number | string>;
  counters: Record<string, number>; // lifetime tallies: kills:<enemy>, forage, fish, smash, chests, golden …
  achievements: Record<string, number>; // id -> unlocked at
  daily: { day: string; bounties: string[]; streak: number; giftDay: string };
  spots: Record<string, number>; // forage / crate / fishing spot id -> respawn time
  repelUntil: number;
}
export interface QuestProgress { step: number; prog: number; state: 'active' | 'ready' | 'done'; startedAt: number }

const KEY = 'whiskerwind-save-v1';
/** Tiny event bus so any module can report progress (quests/achievements subscribe in main.ts). */
export const bus = { emit: (_type: string, _target?: string, _n?: number) => {} };
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
/** Fill in fields added after a save was created, so older saves keep working. */
function migrate(s: Save) {
  s.quests ??= {}; s.flags ??= {}; s.counters ??= {}; s.achievements ??= {}; s.spots ??= {}; s.repelUntil ??= 0;
  s.daily ??= { day: '', bounties: [], streak: 0, giftDay: '' };
  s.stats ??= { battlesWon: 0, chestsOpened: 0, sold: 0 };
}
export function bump(key: string, n = 1) { S.counters[key] = (S.counters[key] ?? 0) + n; return S.counters[key]; }
export let S: Save = null as unknown as Save;

export function species(): Species { return SPECIES.find(s => s.id === S.speciesId)!; }
export function stats(): Stats {
  const sp = species(); const l = S.level - 1;
  const st = { pow: sp.base.pow + sp.growth.pow * l, mag: sp.base.mag + sp.growth.mag * l, sen: sp.base.sen + sp.growth.sen * l, chr: sp.base.chr + sp.growth.chr * l };
  const w = S.equipped ? ITEMS[S.equipped] : null;
  if (w?.stat) st[w.stat] += Math.ceil((w.atk ?? 0) / 2);
  return st;
}
export function maxHp() { return 40 + S.level * 8 + stats().pow; }
export function maxMp() { return 10 + S.level * 3 + stats().mag * 2; }
export function expToNext() { return 30 + (S.level - 1) * 25; }
export function weaponAtk() { return S.equipped ? ITEMS[S.equipped].atk ?? 0 : 0; }

export function addItem(id: string, n = 1) { S.inventory[id] = (S.inventory[id] ?? 0) + n; if (S.inventory[id] <= 0) delete S.inventory[id]; }
export function addCard(id: string, n = 1) { S.cards[id] = (S.cards[id] ?? 0) + n; }
export function log(msg: string) { S.log.unshift(msg); S.log.length = Math.min(S.log.length, 40); }

/** Returns number of levels gained. */
export function gainExp(n: number) {
  S.exp += n; let gained = 0;
  while (S.exp >= expToNext()) { S.exp -= expToNext(); S.level++; gained++; }
  if (gained) { S.hp = maxHp(); S.mp = maxMp(); }
  return gained;
}

const shopTemplates: Omit<NpcShop, 'stock'>[] = [
  { id: 'relics', owner: 'Pipkin', title: "Pipkin's Relic Rack", animal: 'rabbit' },
  { id: 'arms', owner: 'Brindle', title: "Brindle's Battle-Bits", animal: 'bear' },
  { id: 'curios', owner: 'Marzi', title: "Marzi's Curio Cart", animal: 'fox' },
];

export function newGame(name: string, speciesId: string) {
  const sp = SPECIES.find(s => s.id === speciesId)!;
  const cards: Record<string, number> = {}; STARTER_DECK.forEach(c => cards[c] = (cards[c] ?? 0) + 1);
  S = {
    version: 1, name, speciesId, level: 1, exp: 0, hp: 0, mp: 0, glimmer: 120,
    inventory: { [sp.starterWeapon]: 1, berry_tonic: 2 }, equipped: sp.starterWeapon,
    cards, deck: [...STARTER_DECK], zone: 'town', pos: [0, 4], stall: [], marketFactor: {},
    shops: shopTemplates.map(t => ({ ...t, stock: [] })), chests: {}, bossRespawn: 0,
    den: { pieces: [{ uid: 1, itemId: 'f_rug', x: 0, z: 0, rot: 0 }, { uid: 2, itemId: 'f_bed', x: -3, z: -3, rot: 0 }], wall: 'cream', floor: 'oak', nextUid: 3 }, wearing: null,
    log: ['Welcome to Puffle Cay! Dungeons are where the treasure is.'], stats: { battlesWon: 0, chestsOpened: 0, sold: 0 },
    quests: {}, flags: {}, counters: {}, achievements: {}, daily: { day: '', bounties: [], streak: 0, giftDay: '' }, spots: {}, repelUntil: 0,
  };
  S.hp = maxHp(); S.mp = maxMp();
  Object.keys(ITEMS).forEach(id => S.marketFactor[id] = 0.9 + Math.random() * 0.2);
  for (let i = 0; i < 8; i++) restockShops(true);
  save();
}
export function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
export function load(): boolean {
  try { const raw = localStorage.getItem(KEY); if (!raw) return false; S = JSON.parse(raw); if (S.version !== 1) return false; migrate(S); return true; } catch { return false; }
}
export function wipe() { localStorage.removeItem(KEY); }

// ---------- Economy ----------
// Market price = base * fluctuating factor. Factor random-walks and is nudged by supply (player sales / NPC dungeon hauls).
export function marketPrice(id: string) { return Math.max(1, Math.round(ITEMS[id].base * (S.marketFactor[id] ?? 1))); }
export function charmDiscount() { return Math.min(0.15, stats().chr * 0.006); }
export function buyPrice(id: string) { return Math.max(1, Math.round(marketPrice(id) * (1.2 - charmDiscount()))); }
export function sellPrice(id: string) { return Math.max(1, Math.round(marketPrice(id) * (0.65 + charmDiscount()))); }
export function nudge(id: string, d: number) { S.marketFactor[id] = Math.min(2.2, Math.max(0.45, (S.marketFactor[id] ?? 1) + d)); }

export function tickMarket() {
  for (const id of Object.keys(ITEMS)) {
    const f = S.marketFactor[id] ?? 1;
    // mean-reverting random walk
    S.marketFactor[id] = Math.min(2.2, Math.max(0.45, f + (1 - f) * 0.05 + (Math.random() - 0.5) * 0.08));
  }
}

const lootPool: { id: string; w: number; zone: string }[] = Object.values(ITEMS)
  .filter(i => i.source !== 'Starter' && !i.shop && i.rarity !== 'legendary' && i.kind !== 'key' && !/Main story|Bounty|Mini-boss/.test(i.source))
  .map(i => ({ id: i.id, w: ({ common: 10, uncommon: 6, rare: 3, epic: 0.5, legendary: 0 } as const)[i.rarity], zone: i.source }));
function pickLoot() { const tot = lootPool.reduce((a, b) => a + b.w, 0); let r = Math.random() * tot; for (const l of lootPool) { r -= l.w; if (r <= 0) return l; } return lootPool[0]; }

/** Simulated adventurers return from dungeons and sell their loot to shops: shop stock originates from dungeon drops. */
export function restockShops(silent = false): string | null {
  const shop = S.shops[Math.floor(Math.random() * S.shops.length)];
  const l = pickLoot(); const qty = ITEMS[l.id].rarity === 'common' ? 1 + Math.floor(Math.random() * 3) : 1;
  const ex = shop.stock.find(s => s.itemId === l.id); if (ex) ex.qty += qty; else shop.stock.push({ itemId: l.id, qty });
  if (shop.stock.length > 9) shop.stock.shift();
  nudge(l.id, -0.03 * qty);
  const who = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
  const msg = `${who} returned from ${ITEMS[l.id].source} and sold ${qty}× ${ITEMS[l.id].name} to ${shop.owner}.`;
  if (!silent) log(msg);
  return silent ? null : msg;
}

/** Simulated buyers browse the player's stall. Returns sale messages. */
export function tickStall(): string[] {
  const out: string[] = [];
  for (const l of [...S.stall]) {
    const ratio = l.price / marketPrice(l.itemId);
    const p = Math.max(0.02, Math.min(0.85, 0.55 - (ratio - 1) * 0.9 + charmDiscount()));
    if (Math.random() < p * 0.35) {
      S.stall.splice(S.stall.indexOf(l), 1); S.glimmer += l.price; S.stats.sold++; bus.emit('sell', l.itemId);
      nudge(l.itemId, ratio > 1.1 ? 0.04 : 0.01);
      const who = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
      const msg = `💰 ${who} bought your ${ITEMS[l.itemId].name} for ${l.price}✦`; log(msg); out.push(msg);
    }
  }
  return out;
}

export function rarityOf(id: string): Rarity { return ITEMS[id].rarity; }
