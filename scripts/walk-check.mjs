// Walks Mossmere Woods (and Cinder Hollow) straight down the main path without dodging and counts battles triggered.
// Usage: node scripts/walk-check.mjs [url] [trials]
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4174/whiskerwind/';
const trials = +(process.argv[3] || 2);
// REAL=1: fresh level-1 hero with default gear who pauses ~2.5s at each waypoint (looking around, opening chests)
const REAL = process.env.REAL === '1'; const ONLY = process.env.ONLY || '';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = []; const errors = []; const stuckLog = [];
async function walk(zone, start, waypoints, label) {
  if (ONLY && !label.startsWith(ONLY)) return;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800);
  if (await page.$('#play')) { await page.click('#play'); await page.waitForTimeout(500); }
  await page.click('[data-s="brumble"]'); await page.locator('#go').click(); await page.waitForTimeout(1500);
  if (!REAL) await page.evaluate(() => { const S = window.__ww.S(); S.level = 12; S.hp = 9999; S.inventory.sunpetal_blade = 1; S.equipped = 'sunpetal_blade'; S.flags = Object.assign(S.flags || {}, { introSeen: true }); });
  await page.evaluate(([z, s]) => window.__ww.goZone(z, s), [zone, start]); await page.waitForTimeout(800);
  // REAL: level 1 for the Woods, level 6 for the Hollow (its suggested level), default gear
  if (REAL) await page.evaluate((z) => { const S = window.__ww.S(); if (z === 'hollow') { S.level = 6; S.hp = window.__ww.maxHp(); } S.flags = Object.assign(S.flags || {}, { introSeen: true }); }, zone);
  await page.evaluate(() => { document.querySelectorAll('.modal-wrap, .dialogue, .storybook-intro').forEach(e => e.remove()); window.__ww.W.paused = false; });
  const foes = []; let battles = 0, wp = 0; const t0 = Date.now(); let inBattle = false; let last = null, lastMove = Date.now(), skipped = 0, lost = false, side = 0;
  while (wp < waypoints.length && Date.now() - t0 < 240000) {
    const st = await page.evaluate(() => ({ modal: document.querySelector('.modal-wrap h2')?.textContent || (document.querySelector('.dialogue') ? 'dialogue' : ''), b: !!document.querySelector('.battle'), done: !!document.querySelector('#bdone'), pos: window.__ww.S().pos, tgt: !!window.__ww.W.target, paused: window.__ww.W.paused, zone: window.__ww.S().zone }));
    if (st.zone !== zone) { lost = true; if (process.env.DEBUG) { foes.push('LOST->' + st.zone + ' hp' + (await page.evaluate(() => window.__ww.S().hp)) + ' log:' + (await page.evaluate(() => JSON.stringify((window.__ww.S().log||[]).slice?.(0,4) ?? '')))); await page.screenshot({ path: `/tmp/lost-${label}.png` }); } break; }
    if (st.b) {
      if (!inBattle) { battles++; inBattle = true; if (process.env.DEBUG) { await page.waitForTimeout(400); foes.push(await page.evaluate(() => (() => { const W = window.__ww.W, p = W.player.position; let b = null, bd = 1e9; for (const e of W.enemies) { const d = Math.hypot(e.g.position.x - p.x, e.g.position.z - p.z); if (e.alive && d < bd) { bd = d; b = e; } } return b ? b.id : '?'; })() + ' hp' + window.__ww.S().hp + ' wp')) ; foes[foes.length-1] += wp; } }
      if (st.done) { await page.click('#bdone').catch(() => {}); await page.waitForTimeout(1500); continue; }
      const c = page.locator('.hand:not(.locked) .card:not(.dim)');
      // only act on our own turn: never wait-then-click End Turn (that raced the enemy animation and skipped whole hands)
      if (await page.$('.hand.locked')) { await page.waitForTimeout(250); continue; }
      if (await c.count()) await c.first().click({ timeout: 2000 }).catch(() => {}); else if (await page.$('#endturn:not([disabled])')) await page.click('#endturn', { timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(250); continue;
    }
    inBattle = false;
    const [tx, tz] = waypoints[wp];
    if (Math.hypot(st.pos[0] - tx, st.pos[1] - tz) < 0.8) { wp++; side = 0; if (REAL) await page.waitForTimeout(2500); lastMove = Date.now(); continue; }
    if (!last || Math.hypot(st.pos[0] - last[0], st.pos[1] - last[1]) > 0.05) { last = st.pos.slice(); lastMove = Date.now(); }
    else if (Date.now() - lastMove > 1200) {
      // bumped into a tree/prop: sidestep like a player would, give up on this waypoint after 4 tries
      side++; if (side > 4) { stuckLog.push({ wp, pos: st.pos.map(v => +v.toFixed(1)), paused: st.paused, modal: st.modal }); wp++; skipped++; side = 0; lastMove = Date.now(); continue; }
      const dx = tx - st.pos[0], dz = tz - st.pos[1], l = Math.hypot(dx, dz) || 1, sgn = side % 2 ? 1 : -1, k = 1.5 + side * 0.6;
      await page.evaluate(([x, z]) => { window.__ww.W.target = { x, y: z }; }, [st.pos[0] - dz / l * k * sgn - dx / l * 0.5, st.pos[1] + dx / l * k * sgn - dz / l * 0.5]);
      await page.waitForTimeout(700); lastMove = Date.now(); last = null;
      await page.evaluate(([x, z]) => { window.__ww.W.target = { x, y: z }; }, [tx, tz]); continue;
    }
    if (!st.tgt) await page.evaluate(([x, z]) => { const W = window.__ww.W; W.paused = false; W.target = { x, y: z }; }, [tx, tz]);
    await page.waitForTimeout(150);
  }
  results.push({ label, battles, skipped, lost, wp, foes: process.env.DEBUG ? foes : undefined, seconds: Math.round((Date.now() - t0) / 1000) });
  await page.close();
}
for (let i = 0; i < trials; i++) {
  // straight down the main path to the boss path
  await walk('woods', [0, 13], [[0, 8], [0, 0], [0, -8], [0, -13.2]], `woods-path#${i + 1}`);
  // explorer route: every chest corner, then the boss path (what a curious player actually does)
  await walk('woods', [0, 13], [[-6, 10], [-13, 8], [-8, 0], [0, 0], [10, 6], [15, 9], [12, -4], [12, -8], [4, -6], [-4, -12], [-9, -12], [-3, -10], [0, -13.2]], `woods-explore#${i + 1}`);
  await walk('hollow', [0, 13], [[0, 8], [0, 2], [0, -3.5]], `hollow-path#${i + 1}`);
  await walk('hollow', [0, 13], [[8, 10], [13, 8], [10, 0], [14, -10], [4, -3], [-8, 2], [-12, -5], [-4, -4], [0, -3.5]], `hollow-explore#${i + 1}`);
}
console.log(JSON.stringify({ results, errors: errors.slice(0, 5), stuck: process.env.DEBUG ? stuckLog : undefined }, null, 1));
await browser.close();
