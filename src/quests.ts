// Quests: main story chain, side quests, daily repeatables, the Bellbrook bounty board, achievements and the daily gift.
import { ITEMS, CARDS, RARITY_COLOR } from './data';
import { S, save, today, gainExp, log, bump } from './state';
import { grantLoot, Loot, lootHtml } from './loot';
import { openPanel, toast, renderHud, refreshPanel, lootModal } from './ui';
import { NPCS } from './dialogue';

export type GoalType = 'talk' | 'defeat' | 'forage' | 'fish' | 'smash' | 'chest' | 'visit' | 'decorate' | 'trade' | 'sell' | 'buy_pack' | 'wear' | 'golden' | 'zone' | 'deliver';
export interface Step { t: GoalType; k?: string; n?: number; text: string; at?: string /* npc for talk/deliver */ }
export interface Reward { g?: number; exp?: number; items?: [string, number][]; cards?: string[] }
export interface QuestDef {
  id: string; title: string; kind: 'main' | 'side' | 'daily' | 'bounty'; giver: string; steps: Step[]; reward: Reward;
  blurb: string; offer?: string; done?: string; needs?: string[]; level?: number;
}
const GROUPS: Record<string, string[]> = { woods: ['mossling', 'thornpup', 'bramblehorn'], hollow: ['cinder_imp', 'ashwing', 'smoulderjaw'] };
const Q = (q: QuestDef) => q;

export const QUESTS: Record<string, QuestDef> = Object.fromEntries([
  // ---------------- main story: The Glow Lantern ----------------
  Q({ id: 'm1', kind: 'main', title: 'A Letter from the Mayor', giver: 'wickerbee', blurb: 'Mayor Wickerbee asked you to come to Puffle Cay. Find the mayor by the fountain.',
    steps: [{ t: 'talk', at: 'wickerbee', text: 'Talk to Mayor Wickerbee by the fountain' }], reward: { g: 40, items: [['hushleaf_sachet', 2], ['berry_tonic', 1]] } }),
  Q({ id: 'm2', kind: 'main', title: 'Into Mossmere Woods', giver: 'wickerbee', needs: ['m1'], blurb: 'The woods critters have been jumpy since the lantern went dark. See for yourself.',
    steps: [{ t: 'zone', k: 'woods', text: 'Enter Mossmere Woods (north portal)' }, { t: 'defeat', k: 'woods', n: 2, text: 'Calm 2 Mossmere critters in card battles' }], reward: { g: 50, exp: 20, cards: ['leaf_wall'] } }),
  Q({ id: 'm3', kind: 'main', title: 'The Whispering Glade', giver: 'wickerbee', needs: ['m2'], blurb: 'Old Mossbeard the hermit knows the woods better than anyone. He lives in a glade to the far west.',
    steps: [{ t: 'visit', k: 'glade', text: 'Find the Whispering Glade (far west of the woods)' }, { t: 'talk', at: 'mossbeard', text: 'Talk to Old Mossbeard' }], reward: { g: 60, items: [['brass_key', 1]] } }),
  Q({ id: 'm4', kind: 'main', title: 'Lantern Oil', giver: 'mossbeard', needs: ['m3'], blurb: 'A new ember needs glowcap oil to catch. Mossbeard can press it if you gather the mushrooms.',
    steps: [{ t: 'deliver', k: 'glowcap', n: 4, at: 'mossbeard', text: 'Gather 4 Glowcap Mushrooms and bring them to Mossbeard' }], reward: { g: 80, exp: 30, cards: ['moonbeam'] } }),
  Q({ id: 'm5', kind: 'main', title: 'The Bramble Gate', giver: 'mossbeard', needs: ['m4'], blurb: 'Bramblehorn, a grumpy antlered critter, guards the old path. Calm it and the way to the Hollow feels safer.',
    steps: [{ t: 'defeat', k: 'bramblehorn', text: 'Defeat ★ Bramblehorn (west woods)' }], reward: { g: 100, exp: 40, items: [['mint_elixir', 2]] } }),
  Q({ id: 'm6', kind: 'main', title: 'Embers in the Hollow', giver: 'mossbeard', needs: ['m5'], level: 4, blurb: 'Pell the salamander scout is camped at the mouth of Cinder Hollow, watching Old Smoulderjaw.',
    steps: [{ t: 'zone', k: 'hollow', text: 'Enter Cinder Hollow (south portal of the woods)' }, { t: 'talk', at: 'pell', text: 'Find Pell at the campfire' }, { t: 'defeat', k: 'cinder_imp', n: 3, text: 'Calm 3 Cinder Imps' }], reward: { g: 150, exp: 60, cards: ['second_wind'] } }),
  Q({ id: 'm7', kind: 'main', title: 'Old Smoulderjaw', giver: 'pell', needs: ['m6'], blurb: 'The old dragon-toad is sitting on Bellbrook\'s ember. Win it back and bring it home.',
    steps: [{ t: 'defeat', k: 'smoulderjaw', text: 'Defeat Old Smoulderjaw in its lair' }, { t: 'talk', at: 'wickerbee', text: 'Bring the ember home to Mayor Wickerbee' }], reward: { g: 300, exp: 200, items: [['lantern_ember', 1], ['c_lantern_hat', 1]] } }),
  // ---------------- side quests ----------------
  Q({ id: 's_hazel', kind: 'side', title: 'A Comfy Corner', giver: 'hazel', blurb: 'Hazel wants to see your den looking lived-in.', offer: 'A den is just a box until you fill it with snug things! Place three pieces of furniture and I\'ll toss in a lamp.',
    steps: [{ t: 'decorate', n: 3, text: 'Place 3 furniture pieces in your den (press B inside)' }], reward: { g: 40, items: [['f_lamp', 1]] } }),
  Q({ id: 's_tumble', kind: 'side', title: 'Swap Meet', giver: 'tumbletoe', blurb: 'Tumbletoe loves a good haggle.', offer: 'Ooh, a new face! Let\'s do a swap. Any swap! I\'m terribly fond of swaps.',
    steps: [{ t: 'trade', text: 'Complete a trade with Tumbletoe' }], reward: { g: 40, cards: ['peek'] } }),
  Q({ id: 's_lumi', kind: 'side', title: 'Ribbons of Moss', giver: 'lumi', blurb: 'Lumi is weaving a moss-green ribbon collection.', offer: 'Moss tufts make the softest ribbon. Bring me five and you can have my very best bow.',
    steps: [{ t: 'deliver', k: 'moss_tuft', n: 5, at: 'lumi', text: 'Bring 5 Moss Tufts to Lumi' }], reward: { g: 50, items: [['c_bow', 1]] } }),
  Q({ id: 's_rook', kind: 'side', title: "Rook's Card Challenge", giver: 'rook', blurb: 'Rook wants proof you can play.', offer: 'Cards are for playing, not just collecting. Win three battles and I\'ll show you a trick card.',
    steps: [{ t: 'defeat', n: 3, text: 'Win 3 card battles' }], reward: { g: 60, cards: ['pounce'] } }),
  Q({ id: 's_quill', kind: 'side', title: 'The Sunbeam Nook', giver: 'quill', blurb: 'Quill heard of a secret sunny spot in the woods.', offer: 'There\'s a nook in the woods where the sun always shines! Far east, past the big trees. Bet you can\'t find it!',
    steps: [{ t: 'visit', k: 'nook', text: 'Find the hidden Sunbeam Nook (far east woods)' }], reward: { g: 80, items: [['dewdrop_gem', 1]] } }),
  Q({ id: 's_nutmeg', kind: 'side', title: "Granny's Puff Berry Pie", giver: 'nutmeg', blurb: 'Granny Nutmeg is baking for the whole street.', offer: 'Dearie, these old paws can\'t pick berries like they used to. Six Puff Berries and I\'ll send you off with tonics.',
    steps: [{ t: 'deliver', k: 'puff_berry', n: 6, at: 'nutmeg', text: 'Bring 6 Puff Berries to Granny Nutmeg' }], reward: { g: 50, items: [['berry_tonic', 3]] } }),
  Q({ id: 's_pipkin', kind: 'side', title: 'Fishing Lesson', giver: 'pipkin', blurb: 'Pipkin swears fishing is relaxing.', offer: 'The pond by the market is full of minnowpuffs. Catch three. Wait for the splash, then reel!',
    steps: [{ t: 'fish', n: 3, text: 'Catch 3 fish' }], reward: { g: 60, items: [['mint_elixir', 1]] } }),
  Q({ id: 's_brindle', kind: 'side', title: 'Bark for Brindle', giver: 'brindle', blurb: 'Brindle needs padding for armour.', offer: 'Thorn Bark makes the best padding. Four pieces, and I\'ll teach you a solid defence.',
    steps: [{ t: 'deliver', k: 'thorn_bark', n: 4, at: 'brindle', text: 'Bring 4 Thorn Bark to Brindle' }], reward: { g: 90, cards: ['leaf_wall'] } }),
  Q({ id: 's_marzi', kind: 'side', title: 'Crystal Curiosity', giver: 'marzi', level: 4, blurb: 'Marzi collects humming crystals.', offer: 'They say Cinder Quartz hums a little tune. I simply must hear it. Two, please!',
    steps: [{ t: 'deliver', k: 'cinder_quartz', n: 2, at: 'marzi', text: 'Bring 2 Cinder Quartz to Marzi' }], reward: { g: 120, items: [['soot_silk', 1]] } }),
  Q({ id: 's_sprocket', kind: 'side', title: 'Crate Smasher', giver: 'sprocket', blurb: 'Sprocket is testing "crate durability".', offer: 'Science question! How many crates can one adventurer smash? Find out for me. Eight should do.',
    steps: [{ t: 'smash', n: 8, text: 'Smash 8 crates or pots' }], reward: { g: 70, items: [['brass_key', 1]] } }),
  Q({ id: 's_clover', kind: 'side', title: 'Shiny Rumours', giver: 'clover', blurb: 'Clover saw something golden in the bushes.', offer: 'I saw it! A golden puffball! It ran off before I could say hello. Catch one and tell me everything.',
    steps: [{ t: 'golden', text: 'Catch a golden Glimmerpuff (they appear in the dungeons)' }], reward: { g: 200, items: [['hushleaf_sachet', 2]] } }),
  Q({ id: 's_pebble', kind: 'side', title: 'Treasure Hunter', giver: 'pebble', blurb: 'Pebble is writing a guide to treasure.', offer: 'I\'m writing THE guide to Puffle Cay treasure. Open five chests and tell me what\'s inside!',
    steps: [{ t: 'chest', n: 5, text: 'Open 5 treasure chests' }], reward: { g: 80, items: [['brass_key', 2]] } }),
  Q({ id: 's_biscuit', kind: 'side', title: 'Stall Keeper', giver: 'biscuit', blurb: 'Biscuit thinks you have a merchant\'s nose.', offer: 'A good stall is the heart of the market! Sell three things from yours and I\'ll bake you something.',
    steps: [{ t: 'sell', n: 3, text: 'Sell 3 items from Your Stall' }], reward: { g: 100, items: [['f_plant', 1]] } }),
  Q({ id: 's_juniper', kind: 'side', title: 'Locked & Loaded', giver: 'juniper', blurb: 'Juniper wonders what locked chests hide.', offer: 'Locked chests hide the very best loot. Find a Brass Key and crack one open!',
    steps: [{ t: 'chest', k: 'locked', text: 'Open a locked chest with a Brass Key' }], reward: { g: 120, cards: ['second_wind'] } }),
  Q({ id: 's_olive', kind: 'side', title: 'Firefly Watch', giver: 'olive', blurb: 'Olive loves the fireflies in the woods.', offer: 'When night falls, the fireflies gather at the woods pond. Go see them, they\'re magic!',
    steps: [{ t: 'visit', k: 'firefly_pond', text: 'Visit the woods pond at night' }], reward: { g: 60, items: [['f_glowcap_lamp', 1]] } }),
  Q({ id: 's_brindle2', kind: 'side', title: 'Ashwing Hunt', giver: 'brindle', needs: ['s_brindle'], level: 6, blurb: 'Brindle wants an Ashwing scale.', offer: 'There\'s a moth the size of a cart in Cinder Hollow. Ashwing. Beat it and I\'ll give you a fang blade.',
    steps: [{ t: 'defeat', k: 'ashwing', text: 'Defeat ★ Ashwing in Cinder Hollow' }], reward: { g: 200, items: [['cinder_fang', 1]] } }),
  Q({ id: 's_lumi2', kind: 'side', title: 'Dressed to Impress', giver: 'lumi', needs: ['s_lumi'], blurb: 'Lumi wants to see you in something cute.', offer: 'Now put something on! Wear any hat and twirl for me.',
    steps: [{ t: 'wear', text: 'Wear any cosmetic from your bag' }], reward: { g: 50, items: [['c_flower', 1]] } }),
  Q({ id: 's_rook2', kind: 'side', title: 'Pack Opener', giver: 'rook', needs: ['s_rook'], blurb: 'Rook has new packs in stock.', offer: 'Fresh packs just came in. Open one, any one. The smell of new cards!',
    steps: [{ t: 'buy_pack', text: 'Buy a card pack at Shuffle & Shine' }], reward: { g: 40, cards: ['moonbeam'] } }),
  Q({ id: 's_mossbeard', kind: 'side', title: 'Mushroom Stew', giver: 'mossbeard', needs: ['m4'], blurb: 'Mossbeard is hungry.', offer: 'All this talk of glowcaps made me peckish. Forage six more and I\'ll share my lamp.',
    steps: [{ t: 'forage', k: 'glowcap', n: 6, text: 'Forage 6 glowcaps' }], reward: { g: 90, items: [['f_glowcap_lamp', 1]] } }),
  Q({ id: 's_pell', kind: 'side', title: 'Overlook Scout', giver: 'pell', blurb: 'Pell needs eyes on the far west ridge.', offer: 'There\'s a ridge west of here, the Ember Overlook. Scout it and I\'ll pay you in silk.',
    steps: [{ t: 'visit', k: 'overlook', text: 'Find the Ember Overlook (far west of the Hollow)' }], reward: { g: 150, items: [['soot_silk', 1]] } }),
  // ---------------- daily repeatables ----------------
  Q({ id: 'd_pie', kind: 'daily', title: 'Daily: Pie Day', giver: 'nutmeg', needs: ['s_nutmeg'], blurb: 'Granny bakes every day. Every. Day.', offer: 'Back again? Lovely. Four berries for today\'s pie?',
    steps: [{ t: 'deliver', k: 'puff_berry', n: 4, at: 'nutmeg', text: 'Bring 4 Puff Berries to Granny Nutmeg' }], reward: { g: 45, items: [['berry_tonic', 1]] } }),
  Q({ id: 'd_fish', kind: 'daily', title: 'Daily: Catch of the Day', giver: 'pipkin', needs: ['s_pipkin'], blurb: 'Pipkin wants fresh fish for the market.', offer: 'Two fish for today\'s market? I\'ll pay fair!',
    steps: [{ t: 'fish', n: 2, text: 'Catch 2 fish' }], reward: { g: 40, exp: 10 } }),
].map(q => [q.id, q]));

// Bounty board pool: three per day, same for everyone on a given date.
export const BOUNTIES: QuestDef[] = [
  { t: 'defeat', k: 'mossling', n: 4, text: 'Calm 4 Mosslings', g: 60 }, { t: 'defeat', k: 'thornpup', n: 2, text: 'Calm 2 Thornpups', g: 70 }, { t: 'defeat', k: 'cinder_imp', n: 3, text: 'Calm 3 Cinder Imps', g: 120 },
  { t: 'forage', k: 'berry', n: 5, text: 'Pick 5 Puff Berries', g: 45 }, { t: 'forage', k: 'glowcap', n: 4, text: 'Gather 4 glowcaps', g: 60 }, { t: 'forage', k: 'crystal', n: 2, text: 'Chip 2 Cinder Quartz', g: 90 },
  { t: 'fish', n: 2, text: 'Catch 2 fish', g: 50 }, { t: 'smash', n: 5, text: 'Smash 5 crates or pots', g: 50 }, { t: 'chest', n: 2, text: 'Open 2 chests', g: 60 }, { t: 'sell', n: 2, text: 'Sell 2 items at Your Stall', g: 55 },
].map((b, i) => ({ id: 'b' + i, kind: 'bounty' as const, title: 'Bounty: ' + b.text, giver: 'board', blurb: 'Posted on the Bellbrook bounty board.', steps: [{ t: b.t as GoalType, k: b.k, n: b.n, text: b.text }],
  reward: { g: b.g, items: i % 3 === 0 ? [['brass_key', 1]] as [string, number][] : i % 3 === 1 ? [['hushleaf_sachet', 1]] as [string, number][] : [] } }));
BOUNTIES.forEach(b => QUESTS[b.id] = b);

export interface Achievement { id: string; title: string; desc: string; icon: string; check: () => boolean; reward: Reward }
const c = (k: string) => S.counters[k] ?? 0;
const doneCount = (kind: string) => Object.entries(S.quests).filter(([id, p]) => p.state === 'done' && QUESTS[id]?.kind === kind).length;
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a_first_win', title: 'First Friend', icon: '🤝', desc: 'Win your first card battle', check: () => S.stats.battlesWon >= 1, reward: { g: 25 } },
  { id: 'a_win10', title: 'Card Shark', icon: '🃏', desc: 'Win 10 card battles', check: () => S.stats.battlesWon >= 10, reward: { g: 80, cards: ['pounce'] } },
  { id: 'a_win50', title: 'Arena Legend', icon: '🏆', desc: 'Win 50 card battles', check: () => S.stats.battlesWon >= 50, reward: { g: 300, cards: ['flurry'] } },
  { id: 'a_chest1', title: 'Ooh, Shiny', icon: '🧰', desc: 'Open your first chest', check: () => S.stats.chestsOpened >= 1, reward: { g: 20 } },
  { id: 'a_chest15', title: 'Treasure Nose', icon: '💎', desc: 'Open 15 chests', check: () => S.stats.chestsOpened >= 15, reward: { g: 120, items: [['brass_key', 1]] } },
  { id: 'a_fish1', title: 'Nibble Nibble', icon: '🎣', desc: 'Catch your first fish', check: () => c('fish') >= 1, reward: { g: 20 } },
  { id: 'a_fish15', title: 'Master Angler', icon: '🐟', desc: 'Catch 15 fish', check: () => c('fish') >= 15, reward: { g: 150, items: [['rainbow_koi', 1]] } },
  { id: 'a_forage25', title: 'Forager', icon: '🧺', desc: 'Forage 25 things', check: () => c('forage') >= 25, reward: { g: 90 } },
  { id: 'a_smash25', title: 'Crate Crusher', icon: '📦', desc: 'Smash 25 crates or pots', check: () => c('smash') >= 25, reward: { g: 90, items: [['brass_key', 1]] } },
  { id: 'a_golden', title: 'Golden Paws', icon: '✨', desc: 'Catch a Glimmerpuff', check: () => c('golden') >= 1, reward: { g: 150 } },
  { id: 'a_secrets', title: 'Map Maker', icon: '🗺️', desc: 'Discover 4 secret places', check: () => c('secrets') >= 4, reward: { g: 200, items: [['brass_key', 2]] } },
  { id: 'a_minis', title: 'Big Game', icon: '⭐', desc: 'Defeat both mini-bosses', check: () => c('kills:bramblehorn') >= 1 && c('kills:ashwing') >= 1, reward: { g: 250 } },
  { id: 'a_side5', title: 'Good Neighbour', icon: '🏡', desc: 'Finish 5 side quests', check: () => doneCount('side') >= 5, reward: { g: 150, items: [['hushleaf_sachet', 3]] } },
  { id: 'a_side15', title: 'Pillar of Bellbrook', icon: '🌟', desc: 'Finish 15 side quests', check: () => doneCount('side') >= 15, reward: { g: 500, items: [['aurora_brush', 1]] } },
  { id: 'a_bounty5', title: 'Bounty Regular', icon: '📜', desc: 'Claim 5 bounties', check: () => c('bounties') >= 5, reward: { g: 120, items: [['f_bounty_trophy', 1]] } },
  { id: 'a_story', title: 'Lantern Bearer', icon: '🏮', desc: 'Finish the main story', check: () => S.quests.m7?.state === 'done', reward: { g: 400 } },
  { id: 'a_streak7', title: 'Regular Visitor', icon: '🎁', desc: 'Claim the daily gift 7 days in a row', check: () => S.daily.streak >= 7, reward: { g: 200 } },
];

// ---------------- engine ----------------
const match = (k: string | undefined, target?: string) => !k || k === 'any' || k === target || (!!target && (GROUPS[k]?.includes(target) ?? false));
export function isAvailable(q: QuestDef) {
  const p = S.quests[q.id]; if (q.kind === 'bounty') return false;
  if (p && !(q.kind === 'daily' && p.state === 'done' && (S.flags['daily_' + q.id] as string) !== today())) return false;
  if (q.level && S.level < q.level) return false;
  if (q.kind !== 'main' && S.quests.m1?.state !== 'done') return false; // townsfolk open up after you meet the mayor
  return (q.needs ?? []).every(n => S.quests[n]?.state === 'done');
}
export function startQuest(id: string, quiet = false) {
  const q = QUESTS[id]; S.quests[id] = { step: 0, prog: 0, state: 'active', startedAt: Date.now() };
  if (!quiet) toast(`📖 New quest: ${q.title}`, 'good'); log(`New quest: ${q.title}`); checkStep(id); save(); afterChange();
}
export function curStep(id: string) { const p = S.quests[id]; return p && p.state === 'active' ? QUESTS[id].steps[p.step] : null; }
function advance(id: string) {
  const q = QUESTS[id], p = S.quests[id]; p.step++; p.prog = 0;
  if (p.step >= q.steps.length) {
    // bounties are claimed from the board / log; everything else completes right away
    if (q.kind === 'bounty') { p.state = 'ready'; toast(`📜 Bounty ready to claim: ${q.steps[0].text}`, 'good'); }
    else complete(id);
  } else { toast(`📖 ${q.title}: ${q.steps[p.step].text}`); checkStep(id); }
}
export function complete(id: string) {
  const q = QUESTS[id], p = S.quests[id]; p.state = 'done';
  if (q.kind === 'daily') S.flags['daily_' + id] = today();
  if (q.kind === 'bounty') bump('bounties');
  const L = rewardLoot(q.reward); grantLoot(L); const lv = q.reward.exp ? gainExp(q.reward.exp) : 0;
  log(`✔ Quest complete: ${q.title}`); save();
  lootModal(`📖 ${q.kind === 'main' ? 'Story' : q.kind === 'bounty' ? 'Bounty' : 'Quest'} complete: ${q.title}${lv ? ` · Level up! Lv ${S.level}` : ''}`, L);
  // story flows straight into the next chapter
  const next = Object.values(QUESTS).find(n => n.kind === 'main' && (n.needs ?? []).includes(id));
  if (next && isAvailable(next)) setTimeout(() => startQuest(next.id), 400);
  afterChange();
}
function rewardLoot(r: Reward): Loot { return { glimmer: r.g ?? 0, items: (r.items ?? []).map(([id, n]) => ({ id, n })), cards: r.cards ?? [] }; }
/** Instant-check steps that depend on state rather than events (zone you're already in, items you already hold). */
function checkStep(id: string) {
  const st = curStep(id); if (!st) return; const p = S.quests[id];
  if (st.t === 'zone' && S.zone === st.k) return advance(id);
  if (st.t === 'visit' && S.flags['found_' + st.k]) return advance(id);
  if (st.t === 'deliver') p.prog = Math.min(st.n ?? 1, S.inventory[st.k!] ?? 0);
}
export function emit(type: string, target?: string, n = 1) {
  if (!S) return;
  if (type === 'defeat' && target) bump('kills:' + target);
  for (const [id, p] of Object.entries(S.quests)) {
    if (p.state !== 'active') continue; const st = QUESTS[id]?.steps[p.step]; if (!st || st.t !== type) continue;
    if (type === 'talk' || type === 'deliver') continue; // handled in dialogue
    if (!match(st.k, target)) continue;
    p.prog += n; if (p.prog >= (st.n ?? 1)) advance(id);
  }
  checkAchievements(); save(); afterChange();
}
export function refreshQuests() { if (!S) return; rollBounties(); for (const id of Object.keys(S.quests)) checkStep(id); checkAchievements(); }
export function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (S.achievements[a.id] || !a.check()) continue;
    S.achievements[a.id] = Date.now(); const L = rewardLoot(a.reward); grantLoot(L);
    toast(`🏅 Achievement: ${a.title}! +${a.reward.g ?? 0}✦${(a.reward.items ?? []).map(([i]) => ' ' + ITEMS[i].icon).join('')}${(a.reward.cards ?? []).map(cd => ' ' + CARDS[cd].icon).join('')}`, 'good'); log(`🏅 Achievement unlocked: ${a.title}`);
  }
}
/** Talk/deliver steps resolved by the dialogue system. Returns the quest ids whose step at this NPC is satisfiable now. */
export function talkTargets(npc: string) {
  return Object.entries(S.quests).filter(([id, p]) => { const st = p.state === 'active' ? QUESTS[id]?.steps[p.step] : null; return st && st.at === npc && (st.t === 'talk' || (st.t === 'deliver' && (S.inventory[st.k!] ?? 0) >= (st.n ?? 1))); }).map(([id]) => id);
}
export function resolveTalk(id: string) {
  const st = curStep(id)!; if (st.t === 'deliver') { S.inventory[st.k!] -= st.n ?? 1; if (S.inventory[st.k!] <= 0) delete S.inventory[st.k!]; }
  advance(id);
}
export function offersFor(npc: string) { return Object.values(QUESTS).filter(q => q.giver === npc && q.kind !== 'main' && isAvailable(q)); }
export function inProgressFor(npc: string) { return Object.entries(S.quests).filter(([id, p]) => p.state === 'active' && QUESTS[id].giver === npc).map(([id]) => QUESTS[id]); }
let onChange: () => void = () => {}; export function setQuestChangeHandler(f: () => void) { onChange = f; }
function afterChange() { onChange(); renderHud(); }

// ---------------- daily: bounties + gift ----------------
function hash(s: string) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
export function rollBounties() {
  const d = today(); if (S.daily.day === d) return;
  for (const id of S.daily.bounties) delete S.quests[id];
  const ids = BOUNTIES.map(b => b.id); const pick: string[] = []; let h = hash(d);
  while (pick.length < 3) { const id = ids[h % ids.length]; if (!pick.includes(id)) pick.push(id); h = Math.imul(h, 48271) + 11 >>> 0; }
  S.daily.day = d; S.daily.bounties = pick; for (const id of pick) S.quests[id] = { step: 0, prog: 0, state: 'active', startedAt: Date.now() };
  save();
}
const GIFTS: Reward[] = [{ g: 40 }, { g: 60, items: [['berry_tonic', 2]] }, { g: 80, items: [['hushleaf_sachet', 1]] }, { g: 100, items: [['mint_elixir', 1]] }, { g: 120, items: [['brass_key', 1]] }, { g: 150, cards: ['sweet_song'] }, { g: 250, items: [['brass_key', 1], ['rainbow_koi', 1]] }];
export function giftPending() { return S.daily.giftDay !== today(); }
export function dailyGift() {
  const d = today(); const yest = (() => { const t = new Date(Date.now() - 864e5); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; })();
  const pending = S.daily.giftDay !== d; const streak = pending ? (S.daily.giftDay === yest ? S.daily.streak + 1 : 1) : S.daily.streak;
  const dayIdx = (streak - 1) % 7;
  const cell = (r: Reward, i: number) => `<div class="gday ${i < dayIdx || (!pending && i === dayIdx) ? 'got' : ''} ${i === dayIdx ? 'today' : ''}"><small>Day ${i + 1}</small><span>${(r.items?.[0] && ITEMS[r.items[0][0]].icon) || (r.cards?.[0] && CARDS[r.cards[0]].icon) || '✦'}</span><b>${r.g}✦</b></div>`;
  const el = openPanel('gift', '🎁 Daily gift', `<p class="muted">Come back every day for a bigger gift. Streak: <b>${streak} day${streak > 1 ? 's' : ''}</b></p><div class="gift-row">${GIFTS.map(cell).join('')}</div>
    <div class="center">${pending ? `<button class="btn big primary" id="claimgift">Open today's gift</button>` : '<p class="muted">You\'ve opened today\'s gift. See you tomorrow!</p>'}</div>`);
  el.querySelector('#claimgift')?.addEventListener('click', () => {
    S.daily.giftDay = d; S.daily.streak = streak; const L = rewardLoot(GIFTS[dayIdx]); grantLoot(L); checkAchievements(); save();
    lootModal(`🎁 Day ${dayIdx + 1} gift`, L); renderHud();
  });
}

// ---------------- quest log (storybook) ----------------
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
function rewardChips(r: Reward) {
  return `<div class="qrew">${r.g ? `<span class="rw g">✦ ${r.g}</span>` : ''}${r.exp ? `<span class="rw x">+${r.exp} EXP</span>` : ''}${(r.items ?? []).map(([id, n]) => `<span class="rw" style="--rc:${RARITY_COLOR[ITEMS[id].rarity]}" title="${esc(ITEMS[id].name)}">${ITEMS[id].icon} ${esc(ITEMS[id].name)}${n > 1 ? ' ×' + n : ''}</span>`).join('')}${(r.cards ?? []).map(cd => `<span class="rw rcard" style="--rc:${RARITY_COLOR[CARDS[cd].rarity]}">${CARDS[cd].icon} ${CARDS[cd].name}</span>`).join('')}</div>`;
}
function stepProg(id: string, i: number) {
  const p = S.quests[id]; const st = QUESTS[id].steps[i]; const n = st.n ?? 1;
  if (!p) return { done: false, cur: false, txt: '' };
  const done = p.state !== 'active' || i < p.step; const cur = p.state === 'active' && i === p.step;
  const have = st.t === 'deliver' ? Math.min(n, S.inventory[st.k!] ?? 0) : p.prog;
  return { done, cur, txt: cur && n > 1 ? `${have}/${n}` : '' };
}
function questCard(q: QuestDef) {
  const p = S.quests[q.id]; const npc = NPCS[q.giver];
  const state = p?.state ?? 'new';
  const steps = q.steps.map((st, i) => { const s2 = stepProg(q.id, i); const n = st.n ?? 1; const pct = s2.cur && n > 1 ? Math.min(100, (st.t === 'deliver' ? Math.min(n, S.inventory[st.k!] ?? 0) : p!.prog) / n * 100) : 0;
    return `<li class="${s2.done ? 'done' : s2.cur ? 'cur' : 'todo'}"><i>${s2.done ? '✔' : s2.cur ? '➜' : '○'}</i><span>${esc(st.text)}${s2.txt ? ` <b>${s2.txt}</b>` : ''}${pct ? `<em class="qbar"><u style="width:${pct}%"></u></em>` : ''}</span></li>`; }).join('');
  const who = npc ? `<span class="qwho" style="--nc:${npc.tint}">${npc.portrait}</span>` : '<span class="qwho">📜</span>';
  const claim = state === 'ready' && q.kind === 'bounty' ? `<button class="btn sm primary" data-claim="${q.id}">Claim</button>` : '';
  return `<article class="qcard q-${q.kind} s-${state}">${who}<div class="qbody"><header><h3>${esc(q.title)}</h3>${state === 'done' ? '<span class="tag ok">Done</span>' : state === 'ready' ? '<span class="tag gold">Ready!</span>' : ''}${claim}</header>
    <p class="qblurb">${esc(q.blurb)}${npc && state !== 'done' && q.kind !== 'bounty' ? ` <small>· from ${npc.name}</small>` : ''}</p><ol class="qsteps">${steps}</ol>${rewardChips(q.reward)}</div></article>`;
}
let qtab = 'story';
export function questLog(arg?: string) {
  if (arg === 'bounty') qtab = 'daily';
  refreshQuests();
  const tabs: [string, string, number][] = [['story', '🏮 Story', 0], ['side', '🌼 Side', Object.values(S.quests).filter((p, i) => p.state === 'active' && QUESTS[Object.keys(S.quests)[i]]?.kind === 'side').length], ['daily', '📜 Daily & Bounties', S.daily.bounties.filter(b => S.quests[b]?.state === 'ready').length], ['ach', '🏅 Achievements', Object.keys(S.achievements).length]];
  let body = '';
  if (qtab === 'story') {
    const main = Object.values(QUESTS).filter(q => q.kind === 'main'); const shown = main.filter(q => S.quests[q.id]);
    const next = main.find(q => !S.quests[q.id]);
    body = `<div class="story-intro"><b>The Glow Lantern</b><p>Bellbrook's lantern went dark when Old Smoulderjaw swallowed its ember. Chapter ${Math.min(7, shown.length)} of 7.</p></div>`
      + shown.slice().reverse().map(questCard).join('') + (next ? `<article class="qcard locked"><span class="qwho">🔒</span><div class="qbody"><h3>Chapter ${main.indexOf(next) + 1}: ???</h3><p class="qblurb">Keep following the story to unlock.${next.level ? ` (Lv ${next.level}+)` : ''}</p></div></article>` : '');
  } else if (qtab === 'side') {
    const active = Object.values(QUESTS).filter(q => (q.kind === 'side' || q.kind === 'daily') && S.quests[q.id]?.state === 'active');
    const avail = Object.values(QUESTS).filter(q => (q.kind === 'side' || q.kind === 'daily') && isAvailable(q));
    const done = Object.values(QUESTS).filter(q => q.kind === 'side' && S.quests[q.id]?.state === 'done');
    const total = Object.values(QUESTS).filter(q => q.kind === 'side').length;
    body = `<p class="muted">${done.length} of ${total} side quests finished. Look for <b class="mk">!</b> over townsfolk heads.</p>`
      + (active.length ? `<h4 class="qh">In progress</h4>${active.map(questCard).join('')}` : '')
      + (avail.length ? `<h4 class="qh">Rumours around town</h4><div class="rumours">${avail.map(q => { const n = NPCS[q.giver]; return `<div class="rumour"><span class="qwho" style="--nc:${n?.tint}">${n?.portrait ?? '❔'}</span><div><b>${esc(q.title)}</b><small>Talk to ${n?.name ?? q.giver}${n?.where ? ' · ' + n.where : ''}</small></div></div>`; }).join('')}</div>` : '')
      + (done.length ? `<details class="qdone"><summary>Finished (${done.length})</summary>${done.map(questCard).join('')}</details>` : '');
  } else if (qtab === 'daily') {
    body = `<div class="board-head"><span>📜</span><div><b>Bellbrook Bounty Board</b><small>Three new bounties every day. Claim rewards here or at the board by the fountain.</small></div></div>`
      + S.daily.bounties.map(id => questCard(QUESTS[id])).join('')
      + `<h4 class="qh">Daily favours</h4>` + ['d_pie', 'd_fish'].map(id => { const q = QUESTS[id]; const doneToday = S.flags['daily_' + id] === today(); return S.quests[id]?.state === 'active' ? questCard(q) : `<div class="rumour"><span class="qwho" style="--nc:${NPCS[q.giver].tint}">${NPCS[q.giver].portrait}</span><div><b>${q.title}</b><small>${doneToday ? '✔ Done for today' : isAvailable(q) ? `Talk to ${NPCS[q.giver].name}` : `Unlocks after "${QUESTS[q.needs![0]].title}"`}</small></div></div>`; }).join('')
      + `<div class="center"><button class="btn" id="opengift">🎁 Daily gift${giftPending() ? ' <span class="dot"></span>' : ''}</button></div>`;
  } else {
    body = `<div class="ach-grid">${ACHIEVEMENTS.map(a => { const got = !!S.achievements[a.id]; return `<div class="ach ${got ? 'got' : ''}" data-tip="${esc(a.desc)}"><span class="ai">${got ? a.icon : '🔒'}</span><b>${a.title}</b><small>${a.desc}</small>${rewardChips(a.reward)}</div>`; }).join('')}</div>`;
  }
  const el = openPanel('quests', `${'📖'} Quest Journal`, `<div class="storybook"><div class="tabs" role="tablist">${tabs.map(([id, l, n]) => `<button class="tab ${qtab === id ? 'on' : ''}" role="tab" aria-selected="${qtab === id}" data-qtab="${id}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</div><div class="pages">${body}</div></div>`, undefined, true);
  el.querySelector('.panel')?.classList.add('journal');
  el.querySelectorAll<HTMLElement>('[data-qtab]').forEach(b => b.addEventListener('click', () => { qtab = b.dataset.qtab!; questLog(); }));
  el.querySelectorAll<HTMLElement>('[data-claim]').forEach(b => b.addEventListener('click', () => { complete(b.dataset.claim!); }));
  el.querySelector('#opengift')?.addEventListener('click', () => dailyGift());
  void refreshPanel;
}
/** Compact HUD tracker: the current story step, else the first active side quest. */
export function trackerHtml() {
  if (!S) return '';
  const ids = Object.keys(S.quests).filter(id => S.quests[id].state === 'active');
  const order = (id: string) => ({ main: 0, side: 1, daily: 2, bounty: 3 }[QUESTS[id]?.kind ?? 'bounty']);
  ids.sort((a, b) => order(a) - order(b));
  const ready = S.daily.bounties.filter(b => S.quests[b]?.state === 'ready').length;
  const id = ids[0]; if (!id) return `<div class="trk-q"><b>📖 Quest Journal</b><small>${ready ? `${ready} bounty ready to claim!` : 'Talk to townsfolk with a ! for quests'}</small></div>`;
  const q = QUESTS[id], st = q.steps[S.quests[id].step]; const n = st.n ?? 1; const have = st.t === 'deliver' ? Math.min(n, S.inventory[st.k!] ?? 0) : S.quests[id].prog;
  return `<div class="trk-q k-${q.kind}"><b>${q.kind === 'main' ? '🏮' : q.kind === 'bounty' ? '📜' : '🌼'} ${esc(q.title)}</b><small>${esc(st.text)}${n > 1 ? ` · ${have}/${n}` : ''}</small></div>`;
}
export { lootHtml };
