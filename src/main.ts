import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './style.css';
import { S, load, newGame, save, tickMarket, restockShops, tickStall, maxHp, maxMp, log, bus, bump } from './state';
import { initWorld, buildZone, hooks, W, updateChests, goZone } from './world';
import { startBattle, battleKey, lastOutcome } from './battle';
import { detectLowPower, setWeather, setTimeOfDay, AMB } from './ambient';
import { emit, startQuest, refreshQuests, setQuestChangeHandler, giftPending, QUESTS } from './quests';
import { talk, refreshMarkers, playIntro, isTalking, say } from './dialogue';
import { beam, bestRarity, forceGolden } from './lootspots';
import { ITEMS } from './data';
import { ENCOUNTER } from './world';
import type { Loot } from './loot';
import { rollChest, grantLoot } from './loot';
import { mountHud, renderHud, toast, setPrompt, open, closePanel, isPanelOpen, charCreate, titleScreen, lootModal, prevFactor, refreshPanel } from './ui';
import { enterDecorate, exitDecorate, isDecorating } from './den';

W.lowPower = detectLowPower();
initWorld(document.getElementById('app')!);

hooks.battle = (id, done) => { if (document.querySelector('.battle') || W.overlay) return; closePanel(); setPrompt(null); W.paused = true; document.body.classList.add('in-battle'); startBattle(id, won => { document.body.classList.remove('in-battle'); if (lastOutcome === 'won') emit('defeat', id); done(won); save(); renderHud(); refreshMarkers(); }); };
hooks.openChest = (id, r) => {
  const L = rollChest(r); grantLoot(L); S.chests[id] = Date.now() + 4 * 60 * 1000; S.stats.chestsOpened++; bump('chests');
  const c = W.chests.find(x => x.id === id); if (c) beam(c.x, c.z, bestRarity(L)); emit('chest', r);
  log(`Opened a ${r} chest!`); save(); updateChests(); lootModal(`${r === 'epic' ? '💜' : r === 'rare' ? '💙' : '🧰'} ${r[0].toUpperCase() + r.slice(1)} chest`, L); renderHud();
};
hooks.open = (p, a) => open(p, a);
hooks.prompt = setPrompt;
hooks.toast = toast;
hooks.zoneChanged = () => { renderHud(); setTimeout(updateChests, 0); emit('zone', S.zone); refreshMarkers(); };
hooks.event = (t, k, n) => emit(t, k, n);
bus.emit = (t, k, n) => emit(t, k, n);
hooks.talk = (id, shop) => talk(id, shop);
hooks.lootAt = (title, raw, x, z) => {
  const L = raw as Loot; grantLoot(L); const best = bestRarity(L); beam(x, z, best);
  if (title === 'forage' || title === 'crate' || title === 'fish') {
    const bits = [...(L.glimmer ? [`+${L.glimmer}✦`] : []), ...L.items.map(i => `${ITEMS[i.id].icon} ${ITEMS[i.id].name}${i.n > 1 ? ' ×' + i.n : ''}`)];
    if (bits.length) toast(bits.join(' · '), best === 'common' ? 'info' : 'good'); else toast('Nothing inside this time.');
  } else lootModal(title, L);
  renderHud();
};
setQuestChangeHandler(() => refreshMarkers());

function start() {
  mountHud(); buildZone(); updateChests(); refreshQuests(); refreshMarkers(); renderHud();
  const returning = !!S.flags.introSeen;
  const afterIntro = () => { if (!S.quests.m1) startQuest('m1'); refreshMarkers(); if (returning && giftPending()) setTimeout(() => { if (!isPanelOpen() && !isTalking()) open('gift'); }, 900); };
  if (!returning) playIntro(afterIntro); else afterIntro();
  setInterval(() => { Object.assign(prevFactor, S.marketFactor); tickMarket(); if (isPanelOpen()) refreshPanelSoft(); }, 6000);
  setInterval(() => { const m = restockShops(); if (m) renderHud(); }, 14000);
  setInterval(() => { tickStall().forEach(m => toast(m)); }, 5000);
  setInterval(() => { if (!W.paused) { S.hp = Math.min(maxHp(), S.hp + 1); S.mp = Math.min(maxMp(), S.mp + 1); } renderHud(); }, 2000);
  setInterval(save, 10000);
  addEventListener('beforeunload', save);
}
// refresh only data-heavy panels that show prices; avoid clobbering inputs in stall/trade
function refreshPanelSoft() { const n = document.querySelector('.modal-wrap h2')?.textContent ?? ''; if (n.includes('Relic') || n.includes('Battle-Bits') || n.includes('Curio')) refreshPanel(); }

addEventListener('keydown', e => {
  if (!S || !document.getElementById('hud') || isTalking()) return;
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (document.querySelector('.battle')) { if (battleKey(e.key)) e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (k === 'escape' && isPanelOpen()) return closePanel();
  if (isDecorating()) return;
  if (k === 'i') isPanelOpen() ? closePanel() : open('bag');
  if (k === 'k') isPanelOpen() ? closePanel() : open('deck');
  if (k === 'q') isPanelOpen() ? closePanel() : open('quests');
  if (k === 'b' && S.zone === 'den') { closePanel(); enterDecorate(); }
});
document.getElementById('ui')!.addEventListener('click', e => { if ((e.target as HTMLElement).closest('#decobtn')) { closePanel(); isDecorating() ? exitDecorate() : enterDecorate(); } });
addEventListener('contextmenu', e => e.preventDefault());

const create = () => charCreate((name, sp) => { newGame(name, sp); start(); toast(`Welcome to Puffle Cay, ${name}! Head north to Mossmere Woods for loot.`, 'good'); });
titleScreen(load(), start, create);

// Debug/test handle
(window as any).__ww = { S: () => S, maxHp, W, goZone, battle: (id: string) => hooks.battle(id, () => { W.paused = false; }), open,
  setWeather, setTime: setTimeOfDay, AMB, ENCOUNTER, emit, startQuest, QUESTS, talk, say, forceGolden, refreshMarkers };
