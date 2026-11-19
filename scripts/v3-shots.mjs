// Round 3 screenshot tour: day, night, rain, dialogue, quest journal, Woods at desktop + phone, plus extras.
// Usage: node scripts/v3-shots.mjs [url]   -> /workspace/whiskerwind-shots/v3/
import { chromium } from 'playwright';
import fs from 'fs';
const url = (process.argv[2] || 'http://localhost:4174/whiskerwind/') + '?gfx=high';
const out = '/workspace/whiskerwind-shots/v3'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function session(name, viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); }); page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(900);
  await page.click('#play'); await page.waitForTimeout(500); await page.click('[data-s="hopkin"]'); await page.fill('#nm', 'Maple'); await page.click('#go'); await page.waitForTimeout(1600);
  return { page, ctx };
}
const shot = (page, n) => page.screenshot({ path: `${out}/${n}.png` });
const ev = (page, f, a) => page.evaluate(f, a);
const clearUi = page => ev(page, () => { document.querySelectorAll('.modal-wrap, .dialogue, .storybook-intro').forEach(e => e.remove()); window.__ww.W.paused = false; });

// ---------- desktop ----------
{
  const { page, ctx } = await session('desktop', { width: 1280, height: 800 });
  await shot(page, '01-intro-storybook');
  for (let i = 0; i < 3; i++) { await page.click('#sbnext'); await page.waitForTimeout(450); }
  await page.waitForTimeout(700);
  // dialogue with the mayor (typewriter)
  await ev(page, () => { window.__ww.setTime(0.42); window.__ww.setWeather('clear'); window.__ww.talk('wickerbee'); });
  await page.waitForTimeout(2200); await shot(page, '02-dialogue-mayor');
  for (let i = 0; i < 8 && await page.$('.dialogue'); i++) { await page.click('.dialogue'); await page.waitForTimeout(300); }
  await page.waitForTimeout(800); await shot(page, '03-quest-reward');
  await clearUi(page); await page.waitForTimeout(600);
  // offer dialogue with choices
  await ev(page, () => window.__ww.talk('quill')); await page.waitForTimeout(2600); await page.click('.dialogue').catch(() => {}); await page.waitForTimeout(300); await shot(page, '04-dialogue-choices');
  await page.click('.dlg-choices .btn.primary').catch(() => {}); await page.waitForTimeout(500);
  await ev(page, () => { window.__ww.talk('pipkin'); }); await page.waitForTimeout(300); await page.click('.dialogue').catch(() => {}); await page.waitForTimeout(200); await page.click('.dlg-choices .btn.primary').catch(() => {}); await page.waitForTimeout(400);
  await clearUi(page);
  // day in town
  await ev(page, () => { const W = window.__ww.W; W.player.position.set(2, 0, 3); window.__ww.S().pos = [2, 3]; });
  await page.waitForTimeout(1500); await shot(page, '05-town-day');
  // quest journal (story + side + bounties + achievements)
  await ev(page, () => window.__ww.open('quests')); await page.waitForTimeout(800); await shot(page, '06-quest-journal-story');
  await page.click('[data-qtab="side"]'); await page.waitForTimeout(500); await shot(page, '07-quest-journal-side');
  await page.click('[data-qtab="daily"]'); await page.waitForTimeout(500); await shot(page, '08-quest-journal-bounties');
  await page.click('[data-qtab="ach"]'); await page.waitForTimeout(500); await shot(page, '09-quest-journal-achievements');
  await clearUi(page);
  // night in town: lanterns, windows, fireflies, stars on the sea
  await ev(page, () => window.__ww.setTime(0.93)); await page.waitForTimeout(1800); await shot(page, '10-town-night');
  // dusk
  await ev(page, () => window.__ww.setTime(0.76)); await page.waitForTimeout(1500); await shot(page, '11-town-dusk');
  // rain in town
  await ev(page, () => { window.__ww.setTime(0.45); window.__ww.setWeather('rain'); }); await page.waitForTimeout(2500); await shot(page, '12-town-rain');
  // fishing
  await ev(page, () => { window.__ww.setWeather('petals'); window.__ww.open('fish', 't_fish'); }); await page.waitForTimeout(500); await page.click('#cast'); await page.waitForTimeout(400); await shot(page, '13-fishing');
  await clearUi(page);
  // woods: leaves by day, fog, night
  await ev(page, () => { window.__ww.goZone('woods', [0, 6]); window.__ww.setWeather('leaves'); window.__ww.setTime(0.45); }); await page.waitForTimeout(2500); await clearUi(page); await page.waitForTimeout(500); await shot(page, '14-woods-desktop');
  await ev(page, () => window.__ww.setWeather('fog')); await page.waitForTimeout(3500); await shot(page, '15-woods-fog');
  await ev(page, () => { window.__ww.setWeather('clear'); window.__ww.setTime(0.95); const W = window.__ww.W; W.player.position.set(-4, 0, 9); window.__ww.S().pos = [-4, 9]; }); await page.waitForTimeout(2500); await shot(page, '16-woods-night-fireflies');
  // golden critter + sparkle beam
  await ev(page, () => { window.__ww.setTime(0.4); window.__ww.forceGolden(); const W = window.__ww.W; const g = W.zone.children.find(o => o.children.some(c => c.isSprite && c.material?.map && c.scale.x > 1.5 && c.position.y < 1)); }); await page.waitForTimeout(800);
  await ev(page, () => { const W = window.__ww.W; const pl = W.player.position; window.__ww.W.chests.length && 0; });
  await clearUi(page);
  // open the rare chest in the woods for a beam
  await ev(page, () => { const W = window.__ww.W; W.player.position.set(-10, 0, -11.6); window.__ww.S().pos = [-10, -11.6]; W.graceUntil = Date.now() + 60000; const c = W.chests.find(c => c.id === 'w3'); const it = W.interact.find(i => i.obj === c.g); it.action(); });
  await page.waitForTimeout(700); await clearUi(page); await page.waitForTimeout(300); await shot(page, '17-rare-chest-beam');
  // hollow with embers
  await ev(page, () => { window.__ww.goZone('hollow', [0, 8]); window.__ww.setTime(0.55); }); await page.waitForTimeout(2500); await clearUi(page); await shot(page, '18-hollow-embers');
  await ctx.close();
}
// ---------- phone portrait ----------
{
  const { page, ctx } = await session('mobile', { width: 390, height: 844 }, true);
  await page.click('#sbskip'); await page.waitForTimeout(600);
  await ev(page, () => { window.__ww.setTime(0.45); window.__ww.talk('wickerbee'); }); await page.waitForTimeout(2200); await shot(page, '19-mobile-dialogue');
  await clearUi(page);
  await ev(page, () => { window.__ww.goZone('woods', [0, 6]); window.__ww.setWeather('leaves'); }); await page.waitForTimeout(2500); await clearUi(page); await page.waitForTimeout(400); await shot(page, '20-woods-mobile');
  await ev(page, () => window.__ww.open('quests')); await page.waitForTimeout(800); await shot(page, '21-mobile-quest-journal');
  await clearUi(page); await ev(page, () => window.__ww.setTime(0.95)); await page.waitForTimeout(1800); await shot(page, '22-mobile-woods-night');
  await ctx.close();
}
// ---------- phone landscape ----------
{
  const { page, ctx } = await session('landscape', { width: 844, height: 390 }, true);
  await page.click('#sbskip'); await page.waitForTimeout(600);
  await ev(page, () => { window.__ww.setTime(0.45); window.__ww.talk('wickerbee'); }); await page.waitForTimeout(2200); await shot(page, '23-landscape-dialogue');
  await clearUi(page); await ev(page, () => window.__ww.open('quests')); await page.waitForTimeout(800); await shot(page, '24-landscape-quest-journal');
  await ctx.close();
}
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
