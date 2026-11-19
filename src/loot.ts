import { BOSS_EPICS, CARDS, CHEST_TABLES, EnemyDef, ITEMS, Rarity } from './data';
import { S, addCard, addItem, log } from './state';

export interface Loot { items: { id: string; n: number }[]; cards: string[]; glimmer: number }
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function rollEnemyLoot(e: EnemyDef): Loot {
  const L: Loot = { items: [], cards: [], glimmer: rnd(e.glimmer[0], e.glimmer[1]) };
  const luck = 1; // sense could boost later
  for (const d of [...(e.guaranteed ?? []), ...e.drops]) {
    if (Math.random() > d.chance * luck) continue;
    if (d.kind === 'card') L.cards.push(d.id);
    else { const id = d.id === '__boss_epic__' ? pick(BOSS_EPICS) : d.id; L.items.push({ id, n: rnd(d.min ?? 1, d.max ?? 1) }); }
  }
  return L;
}

export function rollChest(r: Rarity): Loot {
  const t = CHEST_TABLES[r];
  const L: Loot = { items: [], cards: [], glimmer: rnd(t.glimmer[0], t.glimmer[1]) };
  const n = r === 'epic' ? 3 : r === 'rare' ? 2 : 2;
  for (let i = 0; i < n; i++) L.items.push({ id: pick(t.items), n: 1 });
  if (Math.random() < (r === 'common' ? 0.3 : 0.7)) L.cards.push(pick(t.cards));
  // chance to upgrade one item to next tier
  if (r !== 'epic' && Math.random() < 0.1) L.items.push({ id: pick(CHEST_TABLES[r === 'common' ? 'rare' : 'epic'].items), n: 1 });
  return L;
}

export function grantLoot(L: Loot) {
  S.glimmer += L.glimmer;
  L.items.forEach(i => addItem(i.id, i.n));
  L.cards.forEach(c => addCard(c));
  const best = [...L.items.map(i => ITEMS[i.id]), ...L.cards.map(c => CARDS[c])].find(x => x.rarity === 'epic');
  if (best) log(`✨ EPIC find: ${best.name}!`);
}

export function lootHtml(L: Loot) {
  let k = 0;
  const chip = (icon: string, name: string, r: string, extra = '') => `<div class="loot r-${r}" style="--d:${k++}"><span class="lic">${icon}</span><b>${name}</b>${extra ? `<em>${extra}</em>` : ''}<i>${r}</i></div>`;
  return `<div class="loot-grid">${chip('✦', `${L.glimmer} Glimmer`, 'glimmer')}${L.items.map(i => chip(ITEMS[i.id].icon, ITEMS[i.id].name, ITEMS[i.id].rarity, i.n > 1 ? `×${i.n}` : '')).join('')}${L.cards.map(c => chip(CARDS[c].icon, CARDS[c].name + ' card', CARDS[c].rarity)).join('')}</div>`;
}
