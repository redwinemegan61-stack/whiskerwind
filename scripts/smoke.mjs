import { chromium } from 'playwright';
import fs from 'fs';
const out = process.env.OUT || '/workspace/whiskerwind-shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1400), height: +(process.env.VH || 860) } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
const wait = ms => page.waitForTimeout(ms);
const inBattle = () => page.$('.battle');
async function waitUnlocked() { for (let i = 0; i < 60; i++) { if (!(await page.$('.hand.locked')) || await page.$('#bdone')) return; await wait(200); } }
async function playOut(maxSteps = 80) {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.$('#bdone')) return true;
    await waitUnlocked(); if (await page.$('#bdone')) return true;
    const cards = page.locator('.hand:not(.locked) .card:not(.dim)');
    if (await cards.count()) await cards.first().click({ timeout: 4000 }).catch(() => {}); else if (await page.$('#endturn:not([disabled])')) await page.click('#endturn:not([disabled])', { timeout: 15000 });
    await wait(250);
  }
  return false;
}
async function attackMid(name) {
  await waitUnlocked();
  console.log(name, await page.evaluate(() => [document.querySelectorAll('.battle').length, document.querySelector('.battle')?.innerText.slice(0, 300)]));
  let atk = page.locator('.hand .card.t-attack:not(.dim)'); if (!(await atk.count())) atk = page.locator('.hand .card:not(.dim)');
  await atk.first().click({ timeout: 4000 }); await wait(170); await shot(name);
}

await page.goto(process.argv[2] || 'http://localhost:4174/whiskerwind/');
await page.evaluate(() => localStorage.clear()); await page.reload(); await wait(1200);
if (await page.$('#play')) { await page.click('#play'); await wait(600); }
await shot('01-character-select');
await page.click('[data-s="brumble"]'); await page.fill('#nm', 'Maple'); await page.click('#go');
await wait(1200); if (await page.$('#sbskip')) { await page.click('#sbskip'); await wait(500); }
await wait(2000);
// give the tester a hat + rare weapon so the arena shows equipment
await page.evaluate(() => { const S = window.__ww.S(); S.inventory.c_wizard = 1; S.wearing = 'c_wizard'; S.inventory.bramble_saber = 1; S.equipped = 'bramble_saber'; S.level = 8; S.hp = window.__ww.maxHp(); });
await page.evaluate(() => window.__ww.goZone('woods', [0, 12]));
await wait(1200);
await shot('02-woods-world');
const before = await page.evaluate(() => window.__ww.S().pos.map(n => +n.toFixed(2)));

// --- Woods arena
await page.evaluate(() => window.__ww.battle('thornpup')); await wait(400);
await shot('03-arena-woods-transition');
await wait(1500); await shot('04-arena-woods');
await attackMid('05-arena-woods-attack-mid');
await wait(900); await page.waitForSelector('#endturn:not([disabled]), #bdone, .battle .player-panel #endturn[disabled]', { timeout: 15000 }); if (await page.$('#endturn:not([disabled])')) await page.click('#endturn:not([disabled])', { timeout: 15000 }); await wait(500); await shot('06-arena-woods-enemy-turn'); // a crit can end the fight in one hit
const won = await playOut();
await shot('07-arena-woods-victory');
await page.click('#bdone'); await page.waitForFunction(() => !window.__ww.W.overlay && !document.querySelector('.battle'), null, { timeout: 15000 }); await wait(500);
const after = await page.evaluate(() => ({ pos: window.__ww.S().pos.map(n => +n.toFixed(2)), zone: window.__ww.S().zone, overlay: !!window.__ww.W.overlay }));
await shot('08-back-on-map');

// --- Hollow arena
await page.evaluate(() => window.__ww.goZone('hollow', [12, 12])); await wait(300);
await page.evaluate(() => window.__ww.battle('cinder_imp')); await wait(1800);
await shot('09-arena-hollow');
await attackMid('10-arena-hollow-attack-mid');
await playOut(); await page.click('#bdone'); await page.waitForFunction(() => !window.__ww.W.overlay && !document.querySelector('.battle'), null, { timeout: 15000 }); await wait(300);

// --- Boss arena
await page.evaluate(() => { const S = window.__ww.S(); S.level = 12; S.hp = window.__ww.maxHp(); S.mp = 99; Object.assign(S.cards, { moonbeam: 2, sweet_song: 1, leaf_wall: 1 }); S.deck = ['moonbeam', 'moonbeam', 'spark', 'bop', 'bop', 'leaf_wall', 'sweet_song', 'patch_up', 'double_tap', 'snuggle_guard']; window.__ww.battle('smoulderjaw'); }); await wait(1800);
await shot('11-arena-boss');
await attackMid('12-arena-boss-attack-mid');
// play a magic card if any
await waitUnlocked();
await page.evaluate(() => { const S = window.__ww.S(); S.mp = 99; });
for (const [t, n, d] of [['skill', '13-arena-boss-magic-mid', 330], ['defend', '13b-arena-boss-shield', 300], ['heal', '13c-arena-boss-heal', 450]]) {
  await wait(900); const c = page.locator(`.hand .card.t-${t}:not(.dim)`); if (await c.count()) { await c.first().click({ timeout: 4000 }); await wait(d); await shot(n); } }
await wait(800); await page.click('#endturn:not([disabled])', { timeout: 15000 }); await wait(450); await shot('14-arena-boss-enemy-attack');
const bossDone = await playOut(150);
await shot('15-arena-boss-result');
if (await page.$('#bdone')) { await page.click('#bdone'); await wait(1200); }

console.log(JSON.stringify({ won, bossDone, before, after }));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
