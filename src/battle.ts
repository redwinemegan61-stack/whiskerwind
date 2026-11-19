import { CARDS, ENEMIES, EnemyDef, Intent } from './data';
import { S, stats, maxHp, maxMp, weaponAtk, gainExp, log } from './state';
import { rollEnemyLoot, grantLoot, lootHtml } from './loot';
import * as A from './arena';
import { cardHtml } from './ui';
import { ICON } from './icons';

interface BState {
  e: EnemyDef; ehp: number; eblock: number; estr: number; dizzy: number; turn: number;
  block: number; energy: number; draw: string[]; hand: string[]; discard: string[]; over: boolean; logs: string[]; locked: boolean;
}
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let B: BState; let root: HTMLElement; let done: (won: boolean) => void;

export let lastOutcome: 'won' | 'lost' | 'fled' = 'won';
export function startBattle(enemyId: string, onEnd: (won: boolean) => void) {
  const e = ENEMIES[enemyId]; done = onEnd;
  shownHp = -1;
  B = { e, ehp: e.hp, eblock: 0, estr: 0, dizzy: 0, turn: 0, block: 0, energy: 3, draw: shuffle([...S.deck]), hand: [], discard: [], over: false, logs: [`A wild ${e.name} appears!`], locked: false };
  A.enterArena(enemyId, S.zone);
  root = document.createElement('div'); root.className = 'battle'; document.getElementById('ui')!.appendChild(root);
  startTurn();
}

function intent(): Intent { return B.e.pattern[B.turn % B.e.pattern.length]; }
function intentText(i: Intent) {
  if (i.kind === 'attack') { const n = Math.max(0, i.n + B.estr - (B.dizzy ? 2 : 0)); return `⚔️ ${n}${i.hits ? '×' + i.hits : ''}`; }
  if (i.kind === 'defend') return `🛡️ ${i.n}`; return `💢 +${i.n}`;
}
function drawN(n: number) {
  const bonus = Math.random() < stats().sen * 0.01 ? 1 : 0; // sense: lucky extra draw
  for (let k = 0; k < n + bonus; k++) {
    if (!B.draw.length) { B.draw = shuffle(B.discard); B.discard = []; }
    if (!B.draw.length || B.hand.length >= 8) break;
    B.hand.push(B.draw.pop()!);
  }
}
function banner(text: string, kind: string) {
  document.querySelector('.turn-banner')?.remove();
  const el = document.createElement('div'); el.className = `turn-banner ${kind}`; el.innerHTML = `<span>${text}</span>`;
  document.getElementById('ui')!.appendChild(el); setTimeout(() => el.remove(), 1500);
}
let shownHp = -1;
function hpPop(delta: number) {
  const host = root.querySelector('.pstats'); if (!host || !delta) return;
  const el = document.createElement('div'); el.className = `dmg-pop ${delta < 0 ? 'hurt' : 'heal'}`; el.textContent = (delta > 0 ? '+' : '') + delta;
  host.appendChild(el); if (delta < 0) root.querySelector('.player-panel')?.classList.add('shake');
}
function startTurn() {
  B.block = 0; B.energy = 3; drawN(5); banner(B.turn === 0 ? `Battle! ${B.e.name}` : 'Your turn', 'you');
  A.newPlayerTurn(S.hp, maxHp()); A.setIntent(intentText(intent()), intent().kind);
  render();
}

function dmgCalc(base: number, scale?: string) {
  const st = stats() as Record<string, number>;
  let d = base + (scale ? Math.floor(st[scale] / 2) : 0) + (scale === 'pow' || scale === 'sen' ? weaponAtk() : Math.floor(weaponAtk() / 2));
  const crit = Math.random() < st.sen * 0.012;
  if (crit) { d = Math.round(d * 1.5); B.logs.unshift('Critical!'); }
  return { d, crit };
}
function hitEnemy(d: number) { const b = Math.min(B.eblock, d); B.eblock -= b; B.ehp -= d - b; return b; }

function play(idx: number) {
  if (B.over || B.locked) return;
  const c = CARDS[B.hand[idx]];
  if (c.cost > B.energy) return toastB('Not enough energy');
  if ((c.mp ?? 0) > S.mp) return toastB('Not enough MP');
  B.energy -= c.cost; S.mp -= c.mp ?? 0;
  B.hand.splice(idx, 1); B.discard.push(c.id);
  if (c.dmg) for (let h = 0; h < (c.hits ?? 1); h++) {
    if (B.ehp <= 0) break;
    const { d, crit } = dmgCalc(c.dmg, c.scale); const blocked = hitEnemy(d); B.logs.unshift(`${c.name} hits for ${d}`);
    (c.type === 'skill' ? A.playerMagic : A.playerMelee)(d, crit, Math.max(0, B.ehp), B.eblock, blocked);
  }
  if (c.block) { B.block += c.block; B.logs.unshift(`+${c.block} block`); A.playerBlock(c.block, S.hp, maxHp()); }
  if (c.heal) { const h = c.heal + Math.floor(stats().chr / 2); const before = S.hp; S.hp = Math.min(maxHp(), S.hp + h); B.logs.unshift(`Healed ${S.hp - before}`); A.playerHeal(S.hp - before, S.hp, maxHp()); }
  if (c.draw) { drawN(c.draw); A.playerUtility(0x9ed4ff); }
  if (c.energy) { B.energy += c.energy; A.playerUtility(0xfff176); }
  if (c.weak) { B.dizzy += c.weak; A.enemyDizzy(); }
  if (B.ehp <= 0) return win();
  render();
}

function endTurn() {
  if (B.over || B.locked) return;
  B.discard.push(...B.hand); B.hand = [];
  B.eblock = 0; A.enemyClearBlock(B.ehp);
  const i = intent();
  if (i.kind === 'attack') {
    for (let h = 0; h < (i.hits ?? 1); h++) {
      let d = Math.max(0, i.n + B.estr - (B.dizzy ? 2 : 0)); const b = Math.min(B.block, d); B.block -= b; d -= b; S.hp -= d;
      B.logs.unshift(`${B.e.name} hits you for ${d}${b ? ` (${b} blocked)` : ''}`);
      A.enemyAttack(d, b, Math.max(0, S.hp), maxHp(), B.block);
      if (S.hp <= 0) break;
    }
  } else if (i.kind === 'defend') { B.eblock += i.n; B.logs.unshift(`${B.e.name} braces (+${i.n} block)`); A.enemyDefend(B.eblock, B.ehp); }
  else { B.estr += i.n; B.logs.unshift(`${B.e.name} powers up!`); A.enemyBuff(i.n); }
  if (B.dizzy) B.dizzy--;
  B.turn++;
  S.mp = Math.min(maxMp(), S.mp + 1);
  if (S.hp <= 0) return lose();
  B.locked = true; render(); banner(`${B.e.name}'s turn`, 'foe');
  A.onIdle(() => { B.locked = false; startTurn(); });
}

function win() {
  B.over = true; lastOutcome = 'won'; const L = rollEnemyLoot(B.e); grantLoot(L);
  const lv = gainExp(B.e.exp); S.stats.battlesWon++;
  log(`Defeated ${B.e.name}! +${B.e.exp} EXP`);
  render(); A.victory();
  A.onIdle(() => {
    root.innerHTML = `<div class="result win"><div class="res-ribbon"><span>Victory!</span></div><div class="res-stars">${ICON.star}${ICON.star}${ICON.star}</div><p>${B.e.name} was defeated. <b class="exp">+${B.e.exp} EXP</b>${lv ? ` <span class="lvup">Level up! Lv ${S.level}</span>` : ''}</p>
      <h3>Loot</h3>${lootHtml(L)}<button class="btn big primary" id="bdone">Continue</button></div>`;
    root.querySelector('#bdone')!.addEventListener('click', () => close(true));
  });
}
function lose() {
  B.over = true; lastOutcome = 'lost'; const hpAfter = Math.ceil(maxHp() / 2); const lost = Math.floor(S.glimmer * 0.1); S.glimmer -= lost;
  log(`You fainted to ${B.e.name} and woke up in town (-${lost}✦).`);
  render(); A.defeat();
  A.onIdle(() => {
    S.hp = hpAfter;
    root.innerHTML = `<div class="result lose"><div class="res-ribbon"><span>Fainted… 💫</span></div><p>The ${B.e.name} was too strong. You dropped ${lost} Glimmer and wake up back in Bellbrook.</p><button class="btn big" id="bdone">Back to town</button></div>`;
    root.querySelector('#bdone')!.addEventListener('click', () => close(false));
  });
}
function flee() { if (B.over || B.locked) return; if (Math.random() < 0.5 + stats().sen * 0.02) { B.over = true; lastOutcome = 'fled'; log('You slipped away.'); close(true, true); } else { B.logs.unshift('Could not escape!'); endTurn(); } }
function close(won: boolean, fled = false) {
  root.innerHTML = '';
  A.exitArena(() => { root.remove(); done(won && !fled ? true : won); });
}

function toastB(t: string) { B.logs.unshift(t); render(); }

function render() {
  const n = B.hand.length; const dHp = shownHp >= 0 ? Math.round(S.hp - shownHp) : 0; shownHp = S.hp;
  const it = intent();
  root.innerHTML = `
  <div class="blog"><h4>${ICON.feed} Battle log</h4>${B.logs.slice(0, 5).map((l, i) => `<div style="--d:${i}">${l}</div>`).join('')}</div>
  <div class="foe-plate glass"><b>${B.e.name}</b><small>Lv ${B.e.level}</small>${bar(Math.max(0, B.ehp), B.e.hp, 'hp foe')}<div class="intent i-${it.kind}" title="Next move">${it.kind === 'attack' ? ICON.sword : it.kind === 'defend' ? ICON.shield : ICON.bolt}<span>${intentText(it).replace(/^\S+\s/, '')}</span></div>${B.eblock ? `<span class="tag blk">${ICON.shield}${B.eblock}</span>` : ''}${B.dizzy ? '<span class="tag">💫 Dizzy</span>' : ''}</div>
  <div class="bottom">
  <div class="player-panel glass">
    <div class="pstats"><div class="pn"><b>${S.name}</b>${B.block ? `<span class="tag blk">${ICON.shield}${B.block}</span>` : ''}</div>${bar(S.hp, maxHp(), 'hp')}${bar(S.mp, maxMp(), 'mp')}</div>
    <div class="energy" title="Energy">${Array.from({ length: Math.max(3, B.energy) }, (_, i) => `<span class="orb ${i < B.energy ? 'full' : ''}">${ICON.bolt}</span>`).join('')}<b>${B.energy}</b></div>
    <div class="piles"><span title="Draw pile">${ICON.cards}${B.draw.length}</span><span title="Discard pile" class="disc">${ICON.cards}${B.discard.length}</span></div>
    <div class="bbtns"><button class="btn" id="flee" ${B.locked || B.over ? 'disabled' : ''}>Flee</button><button class="btn primary" id="endturn" ${B.locked || B.over ? 'disabled' : ''}>${B.locked ? 'Enemy turn…' : 'End Turn ▶'}</button></div>
  </div>
  <div class="hand ${B.locked || B.over ? 'locked' : ''}" style="--n:${n}">${B.hand.map((cid, k) => { const c = CARDS[cid]; const ok = c.cost <= B.energy && (c.mp ?? 0) <= S.mp;
    return cardHtml(cid, `data-k="${k}" tabindex="0" style="--i:${k - (n - 1) / 2};--a:${Math.abs(k - (n - 1) / 2)}" aria-label="${c.name}: ${c.desc}"`, `hcard ${ok ? 'ok' : 'dim'}`).replace('<div class="cost"', `<kbd class="hk">${k + 1}</kbd><div class="cost"`); }).join('')}</div>
  </div>`;
  if (dHp) hpPop(dHp);
  root.querySelectorAll<HTMLElement>('.card').forEach(el => el.addEventListener('click', () => { if (el.classList.contains('dim')) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } play(+el.dataset.k!); }));
  root.querySelector('#endturn')!.addEventListener('click', endTurn);
  root.querySelector('#flee')!.addEventListener('click', flee);
}
export function bar(v: number, m: number, cls: string) {
  const ic = cls.startsWith('hp') ? ICON.heart : cls.startsWith('mp') ? ICON.drop : ICON.star;
  return `<div class="barrow ${cls}"><span class="bi">${ic}</span><div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, (v / m) * 100))}%"></div><span>${Math.max(0, Math.round(v))}/${m}</span></div></div>`;
}
export function battleKey(k: string) {
  if (!B || B.over || !root?.isConnected) return false;
  if (k === 'e' || k === 'Enter') { endTurn(); return true; }
  const n = parseInt(k); if (n >= 1 && n <= B.hand.length) { play(n - 1); return true; }
  return false;
}
