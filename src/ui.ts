import { CARDS, ITEMS, RARITY_COLOR, SPECIES, ZONES, Rarity, StatKey } from './data';
import { S, stats, maxHp, maxMp, expToNext, addItem, addCard, log, save, buyPrice, sellPrice, marketPrice, nudge, species, wipe, charmDiscount, bus } from './state';
import { questLog, trackerHtml, dailyGift } from './quests';
import { fishing } from './lootspots';
import { gfxMode, setGfx, timeLabel, WEATHER_ICON, AMB } from './ambient';
import { bar } from './battle';
import { W, refreshPlayer } from './world';
import { Loot, lootHtml } from './loot';
import { ICON, STAT_ICON, ANIMAL_ICON, glim } from './icons';

const ui = () => document.getElementById('ui')!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const prevFactor: Record<string, number> = {};
let current: { el: HTMLElement; name: string; arg?: string } | null = null;
const tabs: Record<string, string> = {};

export function isPanelOpen() { return !!current; }
export function closePanel() {
  hideTip();
  if (!current) return;
  const el = current.el; current = null; W.paused = false;
  el.classList.add('closing'); setTimeout(() => el.remove(), 170);
}
/** Opens (or re-renders in place, without replaying the intro animation) a modal panel. */
export function openPanel(name: string, title: string, body: string, arg?: string, wide = false) {
  let el: HTMLElement; let scroll = 0;
  if (current && current.name === name && current.arg === arg) {
    el = current.el; scroll = el.querySelector('.pb')?.scrollTop ?? 0;
  } else {
    closePanel();
    el = document.createElement('div'); el.className = 'modal-wrap';
    el.addEventListener('click', e => { const t = e.target as HTMLElement; if (t === el || t.closest('[data-close]')) closePanel(); });
    ui().appendChild(el);
  }
  el.innerHTML = `<div class="panel ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}"><div class="ph"><h2>${title}</h2><button class="x" data-close aria-label="Close">${ICON.close}</button></div><div class="pb">${body}</div></div>`;
  const pb = el.querySelector('.pb'); if (pb) pb.scrollTop = scroll;
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.addEventListener('click', () => { tabs[name] = b.dataset.tab!; refreshPanel(); }));
  current = { el, name, arg }; W.paused = true; W.keys.clear(); return el;
}
export function refreshPanel() { if (!current) return; const { name, arg } = current; open(name, arg); renderHud(); }
const rchip = (r: Rarity) => `<span class="rchip r-${r}">${r}</span>`;
function trend(id: string) { const p = prevFactor[id], c = S.marketFactor[id]; if (p === undefined) return ''; return c > p + 0.005 ? '<span class="up" title="Rising">▲</span>' : c < p - 0.005 ? '<span class="down" title="Falling">▼</span>' : '<span class="flat">•</span>'; }
function tabBar(panel: string, list: [string, string, number?][], def: string) {
  const cur = tabs[panel] && list.some(t => t[0] === tabs[panel]) ? tabs[panel] : def;
  return { cur, html: `<div class="tabs" role="tablist">${list.map(([id, label, n]) => `<button class="tab ${cur === id ? 'on' : ''}" role="tab" aria-selected="${cur === id}" data-tab="${id}">${label}${n !== undefined ? `<i>${n}</i>` : ''}</button>`).join('')}</div>` };
}

// ---------------- Toasts / prompt / HUD ----------------
export function toast(t: string, kind: 'info' | 'good' | 'warn' = 'info') {
  if (/not enough|full|need|can't|don't|empty|at least/i.test(t) && kind === 'info') kind = 'warn';
  if (/💰|bought your|complete|equipped|added|saved|welcome/i.test(t) && kind === 'info') kind = 'good';
  const box = document.getElementById('toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = `toast t-${kind}`;
  el.innerHTML = `<span class="ti">${kind === 'warn' ? '!' : kind === 'good' ? ICON.check : ICON.paw}</span><span>${t}</span>`;
  box.appendChild(el); while (box.children.length > 4) box.firstElementChild!.remove();
  setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3700);
}
export function setPrompt(t: string | null) {
  const p = document.getElementById('prompt')!; p.classList.toggle('show', !!t); if (t) p.innerHTML = `<kbd>E</kbd><span>${esc(t)}</span>`;
}
const dockBtn = (o: string, icon: string, label: string, key?: string, id?: string) =>
  `<button class="dock-btn" ${id ? `id="${id}"` : `data-o="${o}"`} aria-label="${label}"><span class="di">${icon}</span><span class="dl">${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
let lastGlimmer = -1;
/** Only touch the DOM when content changed, so idle HUD animations don't restart every tick. */
function setHtml(el: HTMLElement, html: string) { if ((el as any)._h !== html) { (el as any)._h = html; el.innerHTML = html; } }
// ---------------- Touch tooltips: tap (info cards) or long-press (any [data-tip]) ----------------
let tipEl: HTMLElement | null = null; let tipTimer = 0; let pressTimer = 0; let suppressClick = false;
function hideTip() { tipEl?.remove(); tipEl = null; clearTimeout(tipTimer); }
function showTip(target: HTMLElement) {
  hideTip(); const text = target.dataset.tip; if (!text) return;
  const el = document.createElement('div'); el.id = 'tip'; el.textContent = text; document.body.appendChild(el); tipEl = el;
  const r = target.getBoundingClientRect(); const w = el.offsetWidth, h = el.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  let y = r.top - h - 10; if (y < 8) { y = r.bottom + 10; el.classList.add('below'); }
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.setProperty('--ax', `${Math.max(12, Math.min(w - 12, r.left + r.width / 2 - x))}px`);
  tipTimer = window.setTimeout(hideTip, 2600);
}
function initTouchTips() {
  if ((window as any).__wwTips) return; (window as any).__wwTips = true;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return; hideTip(); clearTimeout(pressTimer);
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]'); if (!t) return;
    pressTimer = window.setTimeout(() => { suppressClick = true; showTip(t); navigator.vibrate?.(12); }, 420);
  }, { passive: true });
  const cancel = () => clearTimeout(pressTimer);
  document.addEventListener('pointerup', cancel); document.addEventListener('pointercancel', cancel); document.addEventListener('pointermove', e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); });
  // a long-press must not also trigger the tile's click (e.g. adding it to a trade)
  document.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); return; }
    // plain tap on an info card (not on its buttons/inputs) shows its tooltip
    const t = e.target as HTMLElement; const card = t.closest<HTMLElement>('.icard[data-tip]');
    if (card && !t.closest('button, input, label') && matchMedia('(hover: none)').matches) showTip(card);
  }, true);
  document.addEventListener('contextmenu', e => { if ((e.target as HTMLElement).closest('[data-tip]')) e.preventDefault(); });
}
export function mountHud() {
  initTouchTips();
  ui().innerHTML = `
  <div id="hud" class="glass"></div>
  <div id="zonebanner"></div>
  <div id="feed" class="glass"></div>
  <div id="prompt"></div>
  <div id="toasts" aria-live="polite"></div>
  <button id="tracker" class="glass" aria-label="Open quest log"></button>
  <nav id="bar" class="glass">
    ${dockBtn('quests', ICON.book, 'Quests', 'Q')}
    ${dockBtn('bag', ICON.bag, 'Bag', 'I')}
    ${dockBtn('deck', ICON.cards, 'Deck', 'K')}
    ${dockBtn('stall', ICON.stall, 'Stall')}
    ${dockBtn('', ICON.hammer, 'Decorate', 'B', 'decobtn')}
    ${dockBtn('help', ICON.help, 'Help')}
    ${dockBtn('menu', ICON.gear, 'Menu')}
  </nav>`;
  ui().querySelectorAll<HTMLElement>('[data-o]').forEach(b => b.addEventListener('click', () => open(b.dataset.o!)));
  document.getElementById('tracker')!.addEventListener('click', () => open('quests'));
  lastGlimmer = -1; renderHud();
}
export function renderHud() {
  const sp = species(); const st = stats();
  const h = document.getElementById('hud'); if (!h) return;
  const bump = lastGlimmer >= 0 && S.glimmer !== lastGlimmer ? (S.glimmer > lastGlimmer ? 'gain' : 'spend') : '';
  lastGlimmer = S.glimmer;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  setHtml(h, `<div class="who">
      <div class="portrait" style="--pc:${hex(sp.accent)};--pc2:${hex(sp.color)}"><span>${ANIMAL_ICON[sp.animal]}</span><em class="lv">${S.level}</em></div>
      <div class="whotext"><div class="nm"><b>${esc(S.name)}</b><small>${sp.name}</small></div>
        ${bar(S.hp, maxHp(), 'hp')}${bar(S.mp, maxMp(), 'mp')}<div class="xpline" title="EXP ${S.exp}/${expToNext()}"><div style="width:${Math.min(100, S.exp / expToNext() * 100)}%"></div></div></div>
    </div>
    <div class="hudrow"><div class="money ${bump}" title="Glimmer">${glim(S.glimmer)}</div>
      <div class="statline">${(['pow', 'mag', 'sen', 'chr'] as StatKey[]).map(k => `<span title="${k.toUpperCase()}">${STAT_ICON[k]}${st[k]}</span>`).join('')}</div></div>
    <div class="equip" title="Equipped weapon">${ICON.sword}<span>${S.equipped ? ITEMS[S.equipped].icon + ' ' + ITEMS[S.equipped].name : '—'}</span></div>`);
  const z = ZONES[S.zone]; const zb = document.getElementById('zonebanner')!;
  if (zb.dataset.z !== S.zone) { zb.dataset.z = S.zone; zb.innerHTML = `<div class="sign"><span class="pin">${ICON.pin}</span><div><b>${z.name}</b><small>${z.sub}</small></div></div>`; zb.classList.remove('enter'); void zb.offsetWidth; zb.classList.add('enter'); }
  setHtml(document.getElementById('feed')!, `<h4>${ICON.feed} Island Feed</h4>` + S.log.slice(0, 6).map((l, i) => `<div class="fl" style="--d:${i}">${esc(l)}</div>`).join(''));
  const db = document.getElementById('decobtn'); if (db) db.style.display = S.zone === 'den' ? '' : 'none';
  const tr = document.getElementById('tracker'); if (tr) setHtml(tr, `<div class="trk-time">${timeLabel()}${S.zone !== 'den' && WEATHER_ICON[AMB.weather] ? ` <span>${WEATHER_ICON[AMB.weather]}</span>` : ''}${Date.now() < S.repelUntil ? ' <span title="Hushleaf active">🌿</span>' : ''}</div>${trackerHtml()}`);
}

// ---------------- Title + character creation ----------------
export function titleScreen(hasSave: boolean, onContinue: () => void, onNew: () => void) {
  const el = document.createElement('div'); el.className = 'title-screen';
  el.innerHTML = `<div class="sky-deco" aria-hidden="true">${'<i></i>'.repeat(14)}<b class="cloud c1"></b><b class="cloud c2"></b><b class="cloud c3"></b><div class="isle"></div></div>
    <div class="logo-wrap">
      <div class="logo-paw">${ICON.paw}</div>
      <h1 class="logo">Whiskerwind</h1>
      <div class="ribbon"><span>Tales of Puffle Cay</span></div>
    </div>
    <div class="title-btns">
      ${hasSave ? `<button class="btn primary big" id="play">${ICON.paw} Continue adventure</button><button class="btn" id="newgame">Start a new adventure</button>` : `<button class="btn primary big" id="play">${ICON.paw} Play</button>`}
    </div>
    <p class="title-foot">Explore dungeons · Battle with cards · Trade in Bellbrook · Decorate your den</p>`;
  ui().appendChild(el);
  const go = (fn: () => void) => { el.classList.add('leaving'); setTimeout(() => { el.remove(); fn(); }, 380); };
  el.querySelector('#play')!.addEventListener('click', () => go(hasSave ? onContinue : onNew));
  el.querySelector('#newgame')?.addEventListener('click', () => { if (confirm('Start over? This deletes your current save.')) { wipe(); go(onNew); } });
}

export function charCreate(onDone: (name: string, sp: string) => void) {
  const el = document.createElement('div'); el.className = 'create';
  let pick = SPECIES[0].id;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const lean = { pow: 'Power', mag: 'Magic', sen: 'Sense', chr: 'Charm' } as const;
  const render = () => {
    const name = (el.querySelector('#nm') as HTMLInputElement)?.value ?? '';
    el.innerHTML = `<div class="create-inner">
    <header class="create-head"><div class="step">Step 1 of 1</div><h1>Choose your adventurer</h1><p>Every friend on Puffle Cay has a different knack.</p></header>
    <div class="species">${SPECIES.map(s => `<button class="sp ${pick === s.id ? 'on' : ''}" data-s="${s.id}" aria-pressed="${pick === s.id}" style="--pc:${hex(s.accent)};--pc2:${hex(s.color)}">
      <div class="sp-portrait"><span>${ANIMAL_ICON[s.animal]}</span></div>
      <h3>${s.name}</h3><div class="lean">${STAT_ICON[s.leaning]} ${lean[s.leaning]}</div><p>${s.blurb}</p>
      <div class="sp-stats">${(['pow', 'mag', 'sen', 'chr'] as StatKey[]).map(k => `<div class="ss"><span>${k.toUpperCase()}</span><div class="ssb"><div style="width:${s.base[k] * 10}%"></div></div><b>${s.base[k]}</b></div>`).join('')}</div>
      <span class="sp-check">${ICON.check}</span></button>`).join('')}</div>
    </div>
    <div class="namerow"><input id="nm" maxlength="14" placeholder="Name your adventurer" aria-label="Adventurer name" value="${esc(name)}"/><button class="btn big primary" id="go">Start adventure ✨</button></div>`;
    el.querySelectorAll<HTMLElement>('[data-s]').forEach(b => b.addEventListener('click', () => { pick = b.dataset.s!; render(); }));
    el.querySelector('#go')!.addEventListener('click', () => { const n = (el.querySelector('#nm') as HTMLInputElement).value.trim() || 'Pip'; el.classList.add('leaving'); setTimeout(() => { el.remove(); onDone(n, pick); }, 300); });
    (el.querySelector('#nm') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') (el.querySelector('#go') as HTMLElement).click(); });
  };
  render(); ui().appendChild(el);
}

// ---------------- Panels ----------------
export function open(name: string, arg?: string) {
  if (name === 'bag') return bag();
  if (name === 'deck') return deck();
  if (name === 'market') return market(arg!);
  if (name === 'furniture' || name === 'boutique') return themed(name);
  if (name === 'cards') return cardShop();
  if (name === 'stall') return stall();
  if (name === 'trade') return trade();
  if (name === 'help') return help();
  if (name === 'menu') return menu();
  if (name === 'quests') return questLog(arg);
  if (name === 'fish') return fishing(arg!);
  if (name === 'gift') return dailyGift();
}

/** Grid item card: icon medallion, name, rarity color, qty, price/actions, tooltip. */
function itemCard(id: string, n: number, actions: string, priceHtml = '') {
  const it = ITEMS[id];
  return `<div class="icard r-${it.rarity}" tabindex="0" style="--rc:${RARITY_COLOR[it.rarity]}" data-tip="${esc(it.desc)} · ${esc(it.source)}">
    <div class="ic-top">${rchip(it.rarity)}${n > 1 ? `<span class="qty">×${n}</span>` : ''}</div>
    <div class="ic-med"><span>${it.icon}</span></div>
    <b class="ic-name">${it.name}</b>
    <small class="ic-desc">${it.desc}</small>
    ${priceHtml ? `<div class="ic-price">${priceHtml}</div>` : ''}
    <div class="ic-act">${actions}</div></div>`;
}
const grid = (cards: string, empty: string) => cards ? `<div class="igrid">${cards}</div>` : `<div class="empty">${ICON.paw}<p>${empty}</p></div>`;

function bag() {
  const groups: [string, string][] = [['all', 'All'], ['weapon', '⚔️ Weapons'], ['consumable', '🧃 Items'], ['cosmetic', '🎀 Wear'], ['furniture', '🛋️ Decor'], ['material', '💎 Loot'], ['fish', '🐟 Fish'], ['key', '🗝️ Keys']];
  const owned = Object.entries(S.inventory).filter(([id, n]) => n > 0 && ITEMS[id]);
  const { cur, html } = tabBar('bag', groups.map(([k, t]) => [k, t, k === 'all' ? owned.length : owned.filter(([id]) => ITEMS[id].kind === k).length]), 'all');
  const list = owned.filter(([id]) => cur === 'all' || ITEMS[id].kind === cur).sort((a, b) => ITEMS[b[0]].base - ITEMS[a[0]].base);
  const cards = list.map(([id, n]) => {
    const k = ITEMS[id].kind; let a = '';
    if (k === 'weapon') a = S.equipped === id ? '<span class="tag ok">Equipped</span>' : `<button class="btn sm" data-eq="${id}">Equip</button>`;
    if (k === 'consumable') a = `<button class="btn sm primary" data-use="${id}">Use</button>`;
    if (k === 'cosmetic') a = S.wearing === id ? `<button class="btn sm" data-wear="">Take off</button>` : `<button class="btn sm" data-wear="${id}">Wear</button>`;
    return itemCard(id, n, a, `<span class="price muted-price">worth ~${glim(marketPrice(id))}</span>`);
  }).join('');
  const el = openPanel('bag', `${ICON.bag} Bag <small>${owned.length} kinds</small>`, `<p class="muted">Most valuables come from dungeons — sell them at the market or your stall.</p>${html}${grid(cards, 'Nothing here yet. Dungeons are where the treasure is!')}`, undefined, true);
  el.querySelectorAll<HTMLElement>('[data-eq]').forEach(b => b.addEventListener('click', () => { S.equipped = b.dataset.eq!; save(); toast(`Equipped ${ITEMS[S.equipped].name}`, 'good'); refreshPanel(); }));
  el.querySelectorAll<HTMLElement>('[data-use]').forEach(b => b.addEventListener('click', () => { const it = ITEMS[b.dataset.use!];
    if (it.repel) { S.repelUntil = Math.max(Date.now(), S.repelUntil) + it.repel * 1000; addItem(it.id, -1); save(); toast(`${it.icon} Hushleaf scent: critters will ignore you for ${Math.round((S.repelUntil - Date.now()) / 1000)}s`, 'good'); refreshPanel(); return; }
    S.hp = Math.min(maxHp(), S.hp + (it.heal ?? 0)); S.mp = Math.min(maxMp(), S.mp + (it.mp ?? 0)); addItem(it.id, -1); save(); toast(`Used ${it.icon} ${it.name}`, 'good'); refreshPanel(); }));
  el.querySelectorAll<HTMLElement>('[data-wear]').forEach(b => b.addEventListener('click', () => { S.wearing = b.dataset.wear || null; refreshPlayer(); save(); if (S.wearing) bus.emit('wear', S.wearing); refreshPanel(); }));
}

/** Fancy battle/collection card. Shared with battle.ts. */
export function cardHtml(id: string, extra = '', cls = 'mini') {
  const c = CARDS[id];
  return `<div class="card ${cls} t-${c.type} r-${c.rarity}" ${extra}>
    <div class="cost" title="${c.cost} energy"><span>${c.cost}</span></div>${c.mp ? `<div class="mpc" title="${c.mp} MP">${c.mp}</div>` : ''}
    <div class="cart"><span class="cicon">${c.icon}</span></div>
    <div class="cname">${c.name}</div>
    <div class="cdesc">${c.desc}</div>
    <div class="ctype"><span>${c.type}</span><i class="pips">${'◆'.repeat(c.rarity === 'legendary' ? 4 : c.rarity === 'epic' ? 3 : c.rarity === 'rare' ? 2 : 1)}</i></div></div>`;
}
function deck() {
  const counts: Record<string, number> = {}; S.deck.forEach(c => counts[c] = (counts[c] ?? 0) + 1);
  const coll = Object.entries(S.cards).sort((a, b) => CARDS[a[0]].cost - CARDS[b[0]].cost);
  const { cur, html } = tabBar('deck', [['coll', 'Collection', coll.length], ['deck', 'Your deck', S.deck.length]], 'coll');
  const el = openPanel('deck', `${ICON.cards} Deck Builder <small>${S.deck.length}/20 · min 8</small>`, `
    <div class="deckmeter"><div style="width:${S.deck.length / 20 * 100}%"></div><span>${S.deck.length} / 20 cards</span></div>
    ${html}
    <div class="deckcols show-${cur}"><div class="dc dc-coll"><h3>Collection <small>tap to add</small></h3><div class="cardgrid">${coll.map(([id, n]) => `<div class="cwrap">${cardHtml(id, `data-add="${id}" tabindex="0"`)}<span class="cnt">${(counts[id] ?? 0)}/${n}</span></div>`).join('')}</div></div>
    <div class="dc dc-deck"><h3>Your deck <small>tap to remove</small></h3><div class="cardgrid">${[...S.deck].sort().map(id => cardHtml(id, `data-rm="${id}" tabindex="0"`)).join('')}</div></div></div>`, undefined, true);
  el.querySelectorAll<HTMLElement>('[data-add]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.add!; if (S.deck.length >= 20) return toast('Deck is full (20).'); if ((counts[id] ?? 0) >= S.cards[id]) return toast('You don\'t own more copies.'); S.deck.push(id); save(); refreshPanel(); }));
  el.querySelectorAll<HTMLElement>('[data-rm]').forEach(b => b.addEventListener('click', () => { if (S.deck.length <= 8) return toast('A deck needs at least 8 cards.'); S.deck.splice(S.deck.indexOf(b.dataset.rm!), 1); save(); refreshPanel(); }));
}

function sellables() { return Object.entries(S.inventory).filter(([id, n]) => n > 0 && ITEMS[id] && !(id === S.equipped && n <= 1) && !(id === S.wearing && n <= 1)); }

function market(shopId: string) {
  const shop = S.shops.find(s => s.id === shopId)!;
  const stock = shop.stock.filter(s => s.qty > 0); const mine = sellables();
  const { cur, html } = tabBar('market', [['buy', 'Buy', stock.length], ['sell', `Sell to ${shop.owner}`, mine.length]], 'buy');
  const body = cur === 'buy'
    ? grid(stock.map(s => itemCard(s.itemId, s.qty, `<button class="btn sm primary" data-buy="${s.itemId}" ${S.glimmer < buyPrice(s.itemId) ? 'data-poor' : ''}>Buy</button>`, `<span class="price">${glim(buyPrice(s.itemId))} ${trend(s.itemId)}</span>`)).join(''), 'Sold out — adventurers will bring more loot soon.')
    : grid(mine.map(([id, n]) => itemCard(id, n, `<button class="btn sm" data-sell="${id}">Sell</button>`, `<span class="price">${glim(sellPrice(id))} ${trend(id)}</span>`)).join(''), 'Nothing to sell. Go dungeon diving!');
  const el = openPanel('market', `🏮 ${shop.title}`, `
    <div class="shopkeep"><span class="sk-face">${({ rabbit: '🐰', bear: '🐻', fox: '🦊', cat: '🐱' } as Record<string, string>)[shop.animal] ?? '🐾'}</span><p><b>${shop.owner}:</b> “Fresh from the dungeons! Prices drift every few seconds (▲▼). Your Charm gets you ${Math.round(charmDiscount() * 100)}% better deals.”</p><div class="wallet">${glim(S.glimmer)}</div></div>
    ${html}${body}`, shopId, true);
  el.querySelectorAll<HTMLElement>('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.buy!; const p = buyPrice(id); if (S.glimmer < p) return toast('Not enough Glimmer');
    const st = shop.stock.find(s => s.itemId === id)!; st.qty--; if (!st.qty) shop.stock.splice(shop.stock.indexOf(st), 1);
    S.glimmer -= p; addItem(id); nudge(id, 0.03); log(`Bought ${ITEMS[id].name} for ${p}✦`); toast(`${ITEMS[id].icon} Bought ${ITEMS[id].name}`, 'good'); save(); refreshPanel();
  }));
  el.querySelectorAll<HTMLElement>('[data-sell]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.sell!; const p = sellPrice(id); S.glimmer += p; addItem(id, -1);
    const st = shop.stock.find(s => s.itemId === id); if (st) st.qty++; else shop.stock.push({ itemId: id, qty: 1 });
    nudge(id, -0.04); log(`Sold ${ITEMS[id].name} to ${shop.owner} for ${p}✦`); toast(`Sold ${ITEMS[id].icon} ${ITEMS[id].name} for ${p}✦`, 'good'); save(); refreshPanel();
  }));
}

function themed(kind: 'furniture' | 'boutique') {
  const title = kind === 'furniture' ? '🛋️ Nook & Cranny Furnishings' : '🎀 Ribbon & Bell Boutique';
  const items = Object.values(ITEMS).filter(i => i.shop === kind);
  const back = sellables().filter(([id]) => ITEMS[id].kind === (kind === 'furniture' ? 'furniture' : 'cosmetic'));
  const { cur, html } = tabBar(kind, [['shop', 'Shop', items.length], ['sell', 'Sell back', back.length]], 'shop');
  const body = cur === 'shop'
    ? grid(items.map(i => itemCard(i.id, 1, `<button class="btn sm primary" data-buy="${i.id}" ${S.glimmer < buyPrice(i.id) ? 'data-poor' : ''}>Buy</button>`, `<span class="price">${glim(buyPrice(i.id))}</span>${S.inventory[i.id] ? ` <span class="owned">owned ×${S.inventory[i.id]}</span>` : ''}`)).join(''), 'Nothing in stock.')
    : grid(back.map(([id, n]) => itemCard(id, n, `<button class="btn sm" data-sell="${id}">Sell</button>`, `<span class="price">${glim(sellPrice(id))}</span>`)).join(''), 'Nothing to sell here.');
  const el = openPanel(kind, title, `<div class="shopkeep ${kind}"><span class="sk-face">${kind === 'furniture' ? '🐻' : '🐱'}</span><p>${kind === 'furniture' ? '“Cozy decor for your den! The rarest pieces only drop in dungeons.”' : '“Wearables for every adventurer. The fanciest crowns come from dungeon bosses.”'}</p><div class="wallet">${glim(S.glimmer)}</div></div>${html}${body}`, undefined, true);
  el.querySelectorAll<HTMLElement>('[data-buy]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.buy!; const p = buyPrice(id); if (S.glimmer < p) return toast('Not enough Glimmer'); S.glimmer -= p; addItem(id); log(`Bought ${ITEMS[id].name}`); toast(`${ITEMS[id].icon} ${ITEMS[id].name} added to your bag${kind === 'furniture' ? ' — place it in your den!' : ''}`, 'good'); save(); refreshPanel(); }));
  el.querySelectorAll<HTMLElement>('[data-sell]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.sell!; S.glimmer += sellPrice(id); addItem(id, -1); save(); refreshPanel(); }));
}

const PACKS = [
  { id: 'sprout', name: 'Sprout Pack', price: 60, n: 3, odds: { common: 0.75, rare: 0.23, epic: 0.02 } },
  { id: 'shiny', name: 'Shiny Pack', price: 220, n: 4, odds: { common: 0.4, rare: 0.5, epic: 0.1 } },
];
let lastPack: string[] = [];
function cardShop() {
  const el = openPanel('cards', '🃏 Shuffle & Shine Card Parlor', `<div class="shopkeep"><span class="sk-face">🦊</span><p>“Card packs, fresh and shiny! Epic cards also drop from Old Smoulderjaw.”</p><div class="wallet">${glim(S.glimmer)}</div></div>
    <div class="packs">${PACKS.map(p => `<div class="pack p-${p.id}"><div class="pack-art"><span>🎴</span></div><b>${p.name}</b>
      <div class="odds"><span class="r-common">${Math.round(p.odds.common * 100)}%</span><span class="r-rare">${Math.round(p.odds.rare * 100)}%</span><span class="r-epic">${Math.round(p.odds.epic * 100)}%</span></div>
      <small>${p.n} cards per pack</small><button class="btn primary" data-pack="${p.id}">${glim(p.price)}</button></div>`).join('')}</div>
    <div id="packres">${lastPack.length ? `<h3>You got:</h3><div class="cardgrid reveal">${lastPack.map((id, i) => `<div class="cwrap" style="--d:${i}">${cardHtml(id)}</div>`).join('')}</div><p class="muted">Add them in the Deck builder (K).</p>` : ''}</div>`, undefined, true);
  el.querySelectorAll<HTMLElement>('[data-pack]').forEach(b => b.addEventListener('click', () => {
    const p = PACKS.find(x => x.id === b.dataset.pack)!; if (S.glimmer < p.price) return toast('Not enough Glimmer'); S.glimmer -= p.price;
    const got: string[] = [];
    for (let i = 0; i < p.n; i++) { const r = Math.random(); const rar: Rarity = r < p.odds.epic ? 'epic' : r < p.odds.epic + p.odds.rare ? 'rare' : 'common'; const pool = Object.values(CARDS).filter(c => c.rarity === rar); const c = pool[Math.floor(Math.random() * pool.length)]; addCard(c.id); got.push(c.id); }
    log(`Opened a ${p.name}!`); bus.emit('buy_pack', p.id); save(); lastPack = got; refreshPanel(); lastPack = [];
  }));
}

function stall() {
  const mine = sellables();
  const { cur, html } = tabBar('stall', [['listed', 'Listed', S.stall.length], ['list', 'List an item', mine.length]], S.stall.length ? 'listed' : 'list');
  const body = cur === 'listed'
    ? grid(S.stall.map((l, i) => itemCard(l.itemId, 1, `<button class="btn sm" data-un="${i}">Unlist</button>`, `<span class="price">${glim(l.price)} <small>mkt ${marketPrice(l.itemId)}</small></span>`)).join(''), 'Nothing listed yet — open the “List an item” tab.')
    : grid(mine.map(([id, n]) => itemCard(id, n, `<label class="pricein">${ICON.glimmer}<input type="number" min="1" inputmode="numeric" aria-label="Price" value="${Math.round(marketPrice(id) * 1.05)}" data-pr="${id}"/></label><button class="btn sm primary" data-list="${id}">List</button>`, `<span class="price muted-price">mkt ${glim(marketPrice(id))}</span>`)).join(''), 'Nothing to list.');
  const el = openPanel('stall', `${ICON.stall} Your Stall <small>${S.stall.length}/8 listed</small>`, `<p class="muted">Set your own price. Shoppers browse every few seconds — cheaper than market sells faster. You don't need to stay in town.</p>${html}${body}`, undefined, true);
  el.querySelectorAll<HTMLElement>('[data-un]').forEach(b => b.addEventListener('click', () => { const l = S.stall.splice(+b.dataset.un!, 1)[0]; addItem(l.itemId); save(); refreshPanel(); }));
  el.querySelectorAll<HTMLElement>('[data-list]').forEach(b => b.addEventListener('click', () => {
    if (S.stall.length >= 8) return toast('Stall is full');
    const id = b.dataset.list!; const price = Math.max(1, Math.round(+(el.querySelector(`[data-pr="${id}"]`) as HTMLInputElement).value));
    addItem(id, -1); S.stall.push({ itemId: id, price, listedAt: Date.now() }); log(`Listed ${ITEMS[id].name} for ${price}✦`); toast(`Listed ${ITEMS[id].icon} ${ITEMS[id].name} for ${price}✦`, 'good'); save(); refreshPanel();
  }));
}

// ---------------- Direct trade ----------------
let tradeNpc: { inv: Record<string, number>; glimmer: number } | null = null;
let offer = { mine: {} as Record<string, number>, theirs: {} as Record<string, number>, myG: 0, theirG: 0, state: 'edit' as 'edit' | 'accepted' };
function genTrader() {
  const pool = Object.values(ITEMS).filter(i => i.source !== 'Starter');
  const inv: Record<string, number> = {};
  for (let i = 0; i < 6; i++) { const it = pool[Math.floor(Math.random() * pool.length)]; if (it.rarity === 'epic' && Math.random() < 0.6) continue; inv[it.id] = (inv[it.id] ?? 0) + 1; }
  return { inv, glimmer: 150 + Math.floor(Math.random() * 300) };
}
function value(m: Record<string, number>, g: number) { return Object.entries(m).reduce((a, [id, n]) => a + marketPrice(id) * n, 0) + g; }
function trade() {
  if (!tradeNpc) tradeNpc = genTrader();
  const mineV = value(offer.mine, offer.myG), theirV = value(offer.theirs, offer.theirG);
  const want = 1.08 - charmDiscount();
  const mood = theirV === 0 && mineV === 0 ? 0.5 : Math.max(0, Math.min(1, mineV / Math.max(1, theirV * want) / 2));
  const sideList = (inv: Record<string, number>, sel: Record<string, number>, tag: string) => Object.entries(inv).filter(([, n]) => n > 0).map(([id, n]) => {
    const it = ITEMS[id]; const s = sel[id] ?? 0;
    return `<button class="tile r-${it.rarity} ${s ? 'on' : ''}" style="--rc:${RARITY_COLOR[it.rarity]}" data-${tag}="${id}" data-tip="${esc(it.name)}: ${esc(it.desc)}"><span>${it.icon}</span><b>${it.name}</b><i>${s ? `<em>${s}</em>/` : ''}${n} · ~${marketPrice(id)}✦</i></button>`;
  }).join('');
  const myInv: Record<string, number> = Object.fromEntries(sellables());
  const face = mood > 0.5 ? '😊' : mood > 0.4 ? '🤔' : '😐';
  const el = openPanel('trade', '🤝 Trade with Tumbletoe', `
    <div class="shopkeep"><span class="sk-face">🐰</span><p><b>Tumbletoe:</b> “Tap items to add them to either side (tap again for more), set Glimmer, then propose. I use live market prices!”</p></div>
    <div class="trade">
      <div class="tside mine"><h3>Your offer <span class="tv">${glim(mineV)}</span></h3><div class="grid-list">${sideList(myInv, offer.mine, 'm') || '<p class="muted">Nothing tradeable.</p>'}</div>
        <label class="gin">${ICON.glimmer} Glimmer <input type="number" min="0" inputmode="numeric" max="${S.glimmer}" value="${offer.myG}" id="myg"/></label></div>
      <div class="tmid"><div class="tface ${offer.state}">${offer.state === 'accepted' ? '🤝' : face}</div>
        <div class="balance"><span>${mineV}</span>${ICON.swap}<span>${theirV}</span></div>
        <div class="mood" title="Tumbletoe's mood"><div style="width:${mood * 100}%"></div></div><small>${mood > 0.5 ? 'Tumbletoe likes this' : mood > 0.4 ? 'Almost…' : 'Not enough yet'}</small>
        ${offer.state === 'edit' ? `<button class="btn primary" id="prop">Propose ${ICON.swap}</button>` : `<div class="tag ok">Tumbletoe accepted!</div><button class="btn primary pulse" id="conf">${ICON.check} Confirm trade</button>`}
        <div class="tmid-row"><button class="btn sm" id="clr">Clear</button><button class="btn sm" id="newt">New stock</button></div></div>
      <div class="tside theirs"><h3>Tumbletoe's offer <span class="tv">${glim(theirV)}</span></h3><div class="grid-list">${sideList(tradeNpc.inv, offer.theirs, 't')}</div>
        <label class="gin">${ICON.glimmer} Glimmer <small>(has ${tradeNpc.glimmer})</small> <input type="number" min="0" inputmode="numeric" max="${tradeNpc.glimmer}" value="${offer.theirG}" id="theirg"/></label></div>
    </div>`, undefined, true);
  const bump = (m: Record<string, number>, id: string, max: number) => { m[id] = ((m[id] ?? 0) + 1) % (max + 1); if (!m[id]) delete m[id]; offer.state = 'edit'; trade(); };
  el.querySelectorAll<HTMLElement>('[data-m]').forEach(b => b.addEventListener('click', () => bump(offer.mine, b.dataset.m!, myInv[b.dataset.m!])));
  el.querySelectorAll<HTMLElement>('[data-t]').forEach(b => b.addEventListener('click', () => bump(offer.theirs, b.dataset.t!, tradeNpc!.inv[b.dataset.t!])));
  el.querySelector('#myg')!.addEventListener('change', e => { offer.myG = Math.max(0, Math.min(S.glimmer, +(e.target as HTMLInputElement).value | 0)); offer.state = 'edit'; trade(); });
  el.querySelector('#theirg')!.addEventListener('change', e => { offer.theirG = Math.max(0, Math.min(tradeNpc!.glimmer, +(e.target as HTMLInputElement).value | 0)); offer.state = 'edit'; trade(); });
  el.querySelector('#clr')!.addEventListener('click', () => { offer = { mine: {}, theirs: {}, myG: 0, theirG: 0, state: 'edit' }; trade(); });
  el.querySelector('#newt')!.addEventListener('click', () => { tradeNpc = genTrader(); offer = { mine: {}, theirs: {}, myG: 0, theirG: 0, state: 'edit' }; trade(); });
  el.querySelector('#prop')?.addEventListener('click', () => {
    if (!mineV && !theirV) return toast('Add something to the trade first.');
    if (mineV >= theirV * want) { offer.state = 'accepted'; trade(); } else toast(`Tumbletoe: "Hmm, I'd need about ${Math.ceil(theirV * want - mineV)}✦ more in value."`);
  });
  el.querySelector('#conf')?.addEventListener('click', () => {
    for (const [id, n] of Object.entries(offer.mine)) { addItem(id, -n); tradeNpc!.inv[id] = (tradeNpc!.inv[id] ?? 0) + n; }
    for (const [id, n] of Object.entries(offer.theirs)) { addItem(id, n); tradeNpc!.inv[id] -= n; }
    S.glimmer += offer.theirG - offer.myG; tradeNpc!.glimmer += offer.myG - offer.theirG;
    log('🤝 Trade with Tumbletoe completed!'); toast('🤝 Trade complete!', 'good'); bus.emit('trade'); offer = { mine: {}, theirs: {}, myG: 0, theirG: 0, state: 'edit' }; save(); trade(); renderHud();
  });
}

export function lootModal(title: string, L: Loot) {
  openPanel('loot', title, `<div class="loot-hero">${ICON.star}<span>Treasure!</span>${ICON.star}</div>${lootHtml(L)}<div class="center"><button class="btn big primary" data-close>Nice!</button></div>`);
}

function help() {
  const row = (ic: string, t: string, d: string) => `<li><span class="hi">${ic}</span><div><b>${t}</b><p>${d}</p></div></li>`;
  openPanel('help', `${ICON.help} How to play`, `<ul class="help">
  ${row('🐾', 'Move', 'WASD / arrow keys, or tap the ground. Tap an NPC or chest to walk over and use it. <kbd>E</kbd> interacts.')}
  ${row('🗝️', 'Dungeons', `The main source of items: Mossmere Woods (north portal) and Cinder Hollow (through the woods). Touch a monster to battle. Chests come in common / <span style="color:${RARITY_COLOR.rare}">rare</span> / <span style="color:${RARITY_COLOR.epic}">epic</span> and refill after a few minutes. Old Smoulderjaw always drops an epic.`)}
  ${row('🃏', 'Battles', '3 ⚡ per turn, draw 5. Tap cards or press 1–8; <kbd>E</kbd>/Enter ends your turn. Watch the enemy intent bubble.')}
  ${row('🤝', 'Trading', 'Sell loot to Pipkin, Brindle & Marzi (prices drift), list items in Your Stall for shoppers, or swap with Tumbletoe.')}
  ${row('🛍️', 'Shops', 'Nook & Cranny (furniture), Ribbon & Bell (wearables), Shuffle & Shine (card packs).')}
  ${row('🏡', 'Den', 'Enter the house in the south-west of town. Press <kbd>B</kbd> to decorate: pick, place, <kbd>R</kbd> rotate, tap a piece to move, <kbd>X</kbd> remove; change wallpaper & floor.')}
  ${row('⌨️', 'Shortcuts', '<kbd>I</kbd> bag · <kbd>K</kbd> deck · <kbd>Esc</kbd> close. Progress autosaves in your browser.')}</ul>`);
}
function menu() {
  const el = openPanel('menu', `${ICON.gear} Menu`, `<div class="menu-stats"><div><b>${S.stats.battlesWon}</b><small>battles won</small></div><div><b>${S.stats.chestsOpened}</b><small>chests opened</small></div><div><b>${S.stats.sold}</b><small>stall sales</small></div></div>
    <div class="gfx-row"><b>Graphics</b><div class="seg">${(['auto', 'high', 'low'] as const).map(m => `<button class="btn sm ${gfxMode() === m ? 'primary' : ''}" data-gfx="${m}">${m === 'auto' ? 'Auto' : m === 'high' ? 'Pretty' : 'Battery saver'}</button>`).join('')}</div></div>
    <p class="muted">Progress is saved locally in this browser. Graphics changes apply after a reload.</p><div class="menu-btns"><button class="btn primary" id="sv">${ICON.save} Save now</button><button class="btn danger" id="wp">${ICON.trash} Start over</button></div>`);
  el.querySelector('#sv')!.addEventListener('click', () => { save(); toast('Saved!', 'good'); });
  el.querySelectorAll<HTMLElement>('[data-gfx]').forEach(b => b.addEventListener('click', () => { setGfx(b.dataset.gfx as 'auto'); save(); if (confirm('Reload now to apply the graphics setting?')) location.reload(); else refreshPanel(); }));
  el.querySelector('#wp')!.addEventListener('click', () => { if (confirm('Delete your save and start over?')) { wipe(); location.reload(); } });
}
