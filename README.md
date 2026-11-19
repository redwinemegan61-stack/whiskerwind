# Whiskerwind — Tales of Puffle Cay

**Play it live:** [https://redwinemegan61-stack.github.io/whiskerwind/](https://redwinemegan61-stack.github.io/whiskerwind/)

An **original** cozy 3D browser RPG prototype: chibi animal adventurers, an angled-isometric island, open-world dungeons, deck-building card battles, a player-driven loot economy, themed shops and a decoratable den. (Inspired by the *feel* of mid-2000s cute MMORPGs. All names, art, and data are original. Everything is procedural Three.js geometry, with no external assets.)

## Run
```bash
npm install
npm run dev        # http://localhost:5174 (hot reload)
npm run build      # type-check + static build into dist/
npm run preview    # serve dist/ at http://localhost:4174
npm run smoke      # headless Playwright smoke test (needs preview running) → ../whiskerwind-shots/*.png
```
The production `base` is `/whiskerwind/` for GitHub Pages. Opening `dist/` via `file://` won't work because browsers block module scripts there. For a portable local folder, you can temporarily set `base: './'` in `vite.config.ts`.

## Controls
| Action | Input |
|---|---|
| Move | **WASD / arrows** (camera-relative), or **click the ground** |
| Interact (NPC, chest, stall, door) | **E**, or click the NPC/object to walk over and use it |
| Bag / Deck builder | **I** / **K** |
| Battle | click cards or **1–8**, **E / Enter** = end turn, Flee button |
| Den decorate mode | **B** (in your den): pick an item, click the floor to place, **R** rotate, click a placed piece to move it, **X/Delete** remove, **Esc** cancel/exit, right-click cancel |
| Close panel | **Esc** |

## The world
- **Bellbrook Town** (hub): fountain plaza; 3 loot traders (Pipkin's Relic Rack, Brindle's Battle-Bits, Marzi's Curio Cart); themed shops (**Nook & Cranny Furnishings**, **Ribbon & Bell Boutique**, **Shuffle & Shine Card Parlor**); **Tumbletoe** the traveling trader (direct trades); **Your Stall**; your **Den** door (south-west house); portal north.
- **Mossmere Woods** (open dungeon, Lv 1–5): Mosslings and Thornpups, 4 chests.
- **Cinder Hollow** (open dungeon, Lv 5–10): Cinder Imps, 4 chests including an **epic** one, and the boss **Old Smoulderjaw** (respawns after 3 min).
- **Species:** Hopkin (rabbit, Sense), Brumble (bear, Power), Vixette (fox, Magic), Mewlet (cat, Charm). Currency: **Glimmer ✦**.

## Systems
- **Dungeon loot is the main source of items.** Enemy drop tables, treasure chests (common/rare/epic tables with a chance to roll up a tier; refill after 4 min), and a boss with a **guaranteed epic** (one of Sunpetal Blade / Comet Scepter / Velvet Paw / Smoulder Crown) plus chances at an epic throne, crown cosmetic, and epic cards. Rarity colors appear everywhere: grey for common, blue for rare, purple for epic.
- **Economy:** each item has a base value × a market factor that does a mean-reverting random walk every 6 s (shown as ▲▼). Supply moves prices: your sales push them down and purchases push them up. Simulated adventurers "return from dungeons" every ~14 s and sell their haul to the NPC traders (posted in the Island Feed), so trader stock is dungeon loot. Charm gives better buy/sell spreads.
- **Your stall:** list up to 8 items at your own price. Simulated shoppers check every 5 s, and the chance of a sale depends on your price vs. market (+ Charm).
- **Direct trade:** both sides offer items + Glimmer, valued at live market prices. Tumbletoe's mood meter shows how close you are; Propose, then Confirm.
- **3D battle arena:** touching an enemy fades into a themed arena with your real character (species, hat, and weapon) facing the enemy model.
- **Card battles:** 3 energy/turn, draw 5, block resets each turn, enemy intent preview (attack / multi-hit / defend / buff), Dizzy debuff, MP-costing skill cards, Sense crits & lucky draws, weapon attack bonus. Win shows EXP, level-up, and a rarity loot screen. Losing sends you to town minus 10% Glimmer.
- **Cards & deck:** 14 cards (attack/defend/skill/heal; common→epic) from drops, chests, and card packs. Deck builder enforces 8–20 cards and owned copies.
- **Character:** level/EXP, HP/MP (regen out of combat), 4 stats that scale per species, an equipped weapon, and a worn cosmetic hat that shows on the 3D model.
- **Den:** 12×12 room with a grid, 11 furniture pieces built from primitives (bed, rug, lamp, fern, toadstool table, stool, wall painting, shelf, plus dungeon-only Glowcap Lamp, Ember Hearth and the epic Smoulder Throne), 5 wallpapers, and 5 floors. The layout is saved.
- **Save:** everything persists in `localStorage` (`whiskerwind-save-v1`) with autosave every 10 s. ⚙️ menu → "Start over" wipes it.

## Architecture (`src/`)
| File | Role |
|---|---|
| `data.ts` | All content: species, items (weapons/materials/consumables/furniture/cosmetics), cards, enemies + drop tables, chest tables, zones, den themes |
| `state.ts` | Save model, derived stats, EXP/levels, economy (prices, market ticks, NPC restocks, stall buyer sim), localStorage |
| `models.ts` | Procedural toon low-poly builders: chibi animals + hats, enemies, trees, houses, stalls, chests, portals, furniture |
| `world.ts` | Three.js renderer/scene/camera follow, zone builders (town/woods/hollow/den), movement + collisions, click-to-move, interactables, enemy AI, battle trigger |
| `battle.ts` | Card battle engine (rules unchanged) + its HTML hand/energy overlay; drives the arena via calls into `arena.ts` |
| `arena.ts` | 3D battle arena: zone-themed scenes (Mossmere clearing, Cinder Hollow lava cave, Smoulderjaw boss ring), real player/enemy models, a queued animation timeline (lunges, knockback, hit flash, projectiles, shield bubbles, heal sparkles, crit pop, buff aura, death/victory/defeat), 3D HP/shield bars, intent badge, floating numbers, and a cinematic camera (intro zoom, slow orbit, shake, fade in/out). It renders through the shared renderer via `W.overlay`, so the world scene stays untouched underneath. |
| `loot.ts` | Loot rolling (enemies, chests, boss guarantee), granting, loot UI |
| `den.ts` | Decorate mode: ghost preview, grid snap, place/move/rotate/remove, wall/floor themes |
| `ui.ts` | HUD, feed, toasts, character creation, panels (bag, deck, traders, themed shops, card packs, stall, trade, help, menu) |
| `main.ts` | Bootstraps, wires hooks, timers (market/restock/stall/regen/autosave), keyboard shortcuts; exposes `window.__ww` for testing |

## Known gaps / next steps
- Single-player only: the "players" are simulated NPCs, and there is no networking yet.
- No audio. Battle animations play on a queued timeline; during the enemy turn the hand locks until the animations finish.
- No furniture collision with the player in the den; wall art always snaps to the back wall.
- Balance is first-pass, and there are no quests or NPC dialog trees. Weapons have no upgrade or crafting yet, though materials exist to feed a future crafting system.
- The bundle is one ~620 kB chunk (Three.js). Fine for a prototype.
