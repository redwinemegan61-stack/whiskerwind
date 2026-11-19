// All names, stats, and content here are original to Whiskerwind.
export type Rarity = 'common' | 'rare' | 'epic';
export type StatKey = 'pow' | 'mag' | 'sen' | 'chr';
export type Stats = Record<StatKey, number>;
export type ZoneId = 'town' | 'woods' | 'hollow' | 'den';

export interface Species {
  id: string; name: string; animal: 'rabbit' | 'bear' | 'fox' | 'cat';
  leaning: StatKey; blurb: string; base: Stats; growth: Stats;
  color: number; accent: number; starterWeapon: string;
}

export const SPECIES: Species[] = [
  { id: 'hopkin', name: 'Hopkin', animal: 'rabbit', leaning: 'sen', blurb: 'Quick-eared scout. Sense boosts crits & extra draws.',
    base: { pow: 4, mag: 3, sen: 7, chr: 4 }, growth: { pow: 1, mag: 1, sen: 2, chr: 1 }, color: 0xfff4e8, accent: 0xffb3c7, starterWeapon: 'twig_dagger' },
  { id: 'brumble', name: 'Brumble', animal: 'bear', leaning: 'pow', blurb: 'Huggable bruiser. Power boosts attack damage.',
    base: { pow: 8, mag: 2, sen: 3, chr: 3 }, growth: { pow: 2, mag: 0, sen: 1, chr: 1 }, color: 0xc89a6c, accent: 0x8a5a3c, starterWeapon: 'acorn_club' },
  { id: 'vixette', name: 'Vixette', animal: 'fox', leaning: 'mag', blurb: 'Starry spellcaster. Magic boosts skills & MP.',
    base: { pow: 3, mag: 8, sen: 4, chr: 3 }, growth: { pow: 1, mag: 2, sen: 1, chr: 1 }, color: 0xff9a4d, accent: 0xfff1e0, starterWeapon: 'reed_wand' },
  { id: 'mewlet', name: 'Mewlet', animal: 'cat', leaning: 'chr', blurb: 'Silver-tongued merchant. Charm improves prices & healing.',
    base: { pow: 4, mag: 4, sen: 4, chr: 8 }, growth: { pow: 1, mag: 1, sen: 1, chr: 2 }, color: 0xb9c3d9, accent: 0x6c7aa0, starterWeapon: 'ribbon_whip' },
];

export type ItemKind = 'weapon' | 'material' | 'consumable' | 'furniture' | 'cosmetic';
export interface ItemDef {
  id: string; name: string; kind: ItemKind; rarity: Rarity; base: number; icon: string;
  atk?: number; stat?: StatKey; heal?: number; mp?: number; source: string; desc: string;
  model?: string; color?: number; shop?: 'furniture' | 'boutique';
}

const I = (d: ItemDef) => d;
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([
  // starter weapons
  I({ id: 'twig_dagger', name: 'Twig Dagger', kind: 'weapon', rarity: 'common', base: 20, icon: '🗡️', atk: 1, stat: 'sen', source: 'Starter', desc: '+1 attack.' }),
  I({ id: 'acorn_club', name: 'Acorn Club', kind: 'weapon', rarity: 'common', base: 20, icon: '🏏', atk: 1, stat: 'pow', source: 'Starter', desc: '+1 attack.' }),
  I({ id: 'reed_wand', name: 'Reed Wand', kind: 'weapon', rarity: 'common', base: 20, icon: '🪄', atk: 1, stat: 'mag', source: 'Starter', desc: '+1 attack.' }),
  I({ id: 'ribbon_whip', name: 'Ribbon Whip', kind: 'weapon', rarity: 'common', base: 20, icon: '🎀', atk: 1, stat: 'chr', source: 'Starter', desc: '+1 attack.' }),
  // Mossmere Woods loot
  I({ id: 'moss_tuft', name: 'Moss Tuft', kind: 'material', rarity: 'common', base: 6, icon: '🌿', source: 'Mossmere Woods', desc: 'Soft, springy, sought by weavers.' }),
  I({ id: 'thorn_bark', name: 'Thorn Bark', kind: 'material', rarity: 'common', base: 9, icon: '🪵', source: 'Mossmere Woods', desc: 'Prickly bark used for armor padding.' }),
  I({ id: 'dewdrop_gem', name: 'Dewdrop Gem', kind: 'material', rarity: 'rare', base: 45, icon: '💧', source: 'Mossmere Woods', desc: 'Never dries. Jewelers love it.' }),
  I({ id: 'bramble_saber', name: 'Bramble Saber', kind: 'weapon', rarity: 'rare', base: 120, icon: '⚔️', atk: 3, stat: 'pow', source: 'Mossmere Woods', desc: '+3 attack.' }),
  I({ id: 'glowcap_staff', name: 'Glowcap Staff', kind: 'weapon', rarity: 'rare', base: 130, icon: '🍄', atk: 3, stat: 'mag', source: 'Mossmere Woods', desc: '+3 attack.' }),
  I({ id: 'berry_tonic', name: 'Berry Tonic', kind: 'consumable', rarity: 'common', base: 12, icon: '🧃', heal: 25, source: 'Mossmere Woods', desc: 'Restores 25 HP.' }),
  // Cinder Hollow loot
  I({ id: 'ember_shard', name: 'Ember Shard', kind: 'material', rarity: 'common', base: 14, icon: '🔥', source: 'Cinder Hollow', desc: 'Warm to the touch. Smiths buy in bulk.' }),
  I({ id: 'soot_silk', name: 'Soot Silk', kind: 'material', rarity: 'rare', base: 55, icon: '🧶', source: 'Cinder Hollow', desc: 'Fireproof thread spun by cinder moths.' }),
  I({ id: 'starfire_opal', name: 'Starfire Opal', kind: 'material', rarity: 'epic', base: 260, icon: '🌟', source: 'Cinder Hollow', desc: 'A tiny sunrise trapped in stone.' }),
  I({ id: 'cinder_fang', name: 'Cinder Fang', kind: 'weapon', rarity: 'rare', base: 180, icon: '🦷', atk: 4, stat: 'sen', source: 'Cinder Hollow', desc: '+4 attack.' }),
  I({ id: 'mint_elixir', name: 'Mint Elixir', kind: 'consumable', rarity: 'rare', base: 30, icon: '🧪', mp: 20, heal: 10, source: 'Cinder Hollow', desc: 'Restores 20 MP, 10 HP.' }),
  // Boss epics
  I({ id: 'smoulder_crown', name: 'Smoulder Crown', kind: 'material', rarity: 'epic', base: 400, icon: '👑', source: 'Boss: Old Smoulderjaw', desc: 'Still smoking. Collectors go wild.' }),
  I({ id: 'sunpetal_blade', name: 'Sunpetal Blade', kind: 'weapon', rarity: 'epic', base: 520, icon: '🌻', atk: 7, stat: 'pow', source: 'Boss: Old Smoulderjaw', desc: '+7 attack.' }),
  I({ id: 'comet_scepter', name: 'Comet Scepter', kind: 'weapon', rarity: 'epic', base: 540, icon: '☄️', atk: 7, stat: 'mag', source: 'Boss: Old Smoulderjaw', desc: '+7 attack.' }),
  I({ id: 'velvet_paw', name: 'Velvet Paw', kind: 'weapon', rarity: 'epic', base: 500, icon: '🐾', atk: 6, stat: 'chr', source: 'Boss: Old Smoulderjaw', desc: '+6 attack.' }),
  // Furniture (den decor). model = procedural mesh builder key in den.ts
  I({ id: 'f_bed', name: 'Cloud Puff Bed', kind: 'furniture', rarity: 'common', base: 60, icon: '🛏️', model: 'bed', color: 0x9ec9ff, source: 'Nook & Cranny', shop: 'furniture', desc: 'Sleep like a marshmallow.' }),
  I({ id: 'f_rug', name: 'Round Daisy Rug', kind: 'furniture', rarity: 'common', base: 25, icon: '🟡', model: 'rug', color: 0xffd36e, source: 'Nook & Cranny', shop: 'furniture', desc: 'Soft underpaw.' }),
  I({ id: 'f_lamp', name: 'Bobble Lamp', kind: 'furniture', rarity: 'common', base: 30, icon: '💡', model: 'lamp', color: 0xfff3b0, source: 'Nook & Cranny', shop: 'furniture', desc: 'Warm little glow.' }),
  I({ id: 'f_plant', name: 'Potted Fern', kind: 'furniture', rarity: 'common', base: 18, icon: '🪴', model: 'plant', color: 0x5fbf6a, source: 'Nook & Cranny', shop: 'furniture', desc: 'Leafy friend.' }),
  I({ id: 'f_table', name: 'Toadstool Table', kind: 'furniture', rarity: 'common', base: 40, icon: '🍄', model: 'table', color: 0xe85d5d, source: 'Nook & Cranny', shop: 'furniture', desc: 'Polka-dotted tea table.' }),
  I({ id: 'f_chair', name: 'Button Stool', kind: 'furniture', rarity: 'common', base: 20, icon: '🪑', model: 'chair', color: 0xb08bd9, source: 'Nook & Cranny', shop: 'furniture', desc: 'Bouncy seat.' }),
  I({ id: 'f_art', name: 'Sunset Painting', kind: 'furniture', rarity: 'common', base: 35, icon: '🖼️', model: 'art', color: 0xff9a7a, source: 'Nook & Cranny', shop: 'furniture', desc: 'Wall art. Snaps to the back wall.' }),
  I({ id: 'f_shelf', name: 'Bookstack Shelf', kind: 'furniture', rarity: 'common', base: 45, icon: '📚', model: 'shelf', color: 0xa77a52, source: 'Nook & Cranny', shop: 'furniture', desc: 'Full of picture books.' }),
  I({ id: 'f_glowcap_lamp', name: 'Glowcap Lamp', kind: 'furniture', rarity: 'rare', base: 90, icon: '🍄', model: 'lamp', color: 0x7ef0ff, source: 'Mossmere Woods', desc: 'Dungeon-grown mushroom light.' }),
  I({ id: 'f_ember_hearth', name: 'Ember Hearth', kind: 'furniture', rarity: 'rare', base: 150, icon: '🔥', model: 'hearth', color: 0xff7043, source: 'Cinder Hollow', desc: 'A cozy fireplace that never goes out.' }),
  I({ id: 'f_smoulder_throne', name: 'Smoulder Throne', kind: 'furniture', rarity: 'epic', base: 450, icon: '🪑', model: 'throne', color: 0xffc94d, source: 'Boss: Old Smoulderjaw', desc: 'Fit for a dungeon champion.' }),
  // Cosmetics (worn on head)
  I({ id: 'c_flower', name: 'Flower Crown', kind: 'cosmetic', rarity: 'common', base: 40, icon: '🌸', model: 'flower', color: 0xff8fb8, source: 'Ribbon & Bell', shop: 'boutique', desc: 'Spring-fresh.' }),
  I({ id: 'c_bow', name: 'Big Bow', kind: 'cosmetic', rarity: 'common', base: 30, icon: '🎀', model: 'bow', color: 0xff5c8a, source: 'Ribbon & Bell', shop: 'boutique', desc: 'Very big. Very bow.' }),
  I({ id: 'c_party', name: 'Party Cone', kind: 'cosmetic', rarity: 'common', base: 35, icon: '🥳', model: 'party', color: 0x6ecbff, source: 'Ribbon & Bell', shop: 'boutique', desc: 'Every day is a party.' }),
  I({ id: 'c_wizard', name: 'Starry Wizard Hat', kind: 'cosmetic', rarity: 'rare', base: 120, icon: '🧙', model: 'wizard', color: 0x5a4fcf, source: 'Ribbon & Bell', shop: 'boutique', desc: 'Sparkles not included (they are).' }),
  I({ id: 'c_ember_crown', name: 'Ember Circlet', kind: 'cosmetic', rarity: 'epic', base: 380, icon: '👑', model: 'crown', color: 0xffb03b, source: 'Boss: Old Smoulderjaw', desc: 'Glows faintly. Dungeon-only.' }),
].map(d => [d.id, d]));

export type CardType = 'attack' | 'defend' | 'skill' | 'heal';
export interface CardDef {
  id: string; name: string; type: CardType; cost: number; mp?: number; rarity: Rarity;
  dmg?: number; hits?: number; block?: number; heal?: number; draw?: number; energy?: number; weak?: number; scale?: StatKey; desc: string; icon: string;
}
const C = (d: CardDef) => d;
export const CARDS: Record<string, CardDef> = Object.fromEntries([
  C({ id: 'bop', name: 'Bop', type: 'attack', cost: 1, rarity: 'common', dmg: 6, scale: 'pow', icon: '👊', desc: 'Deal 6 (+Pow) damage.' }),
  C({ id: 'snuggle_guard', name: 'Snuggle Guard', type: 'defend', cost: 1, rarity: 'common', block: 5, icon: '🛡️', desc: 'Gain 5 block.' }),
  C({ id: 'patch_up', name: 'Patch Up', type: 'heal', cost: 1, rarity: 'common', heal: 5, scale: 'chr', icon: '🩹', desc: 'Heal 5 (+Chr).' }),
  C({ id: 'spark', name: 'Spark', type: 'skill', cost: 1, mp: 3, rarity: 'common', dmg: 8, scale: 'mag', icon: '✨', desc: '3 MP: deal 8 (+Mag).' }),
  C({ id: 'peek', name: 'Peek', type: 'skill', cost: 0, rarity: 'common', draw: 2, icon: '👀', desc: 'Draw 2 cards.' }),
  C({ id: 'double_tap', name: 'Double Tap', type: 'attack', cost: 1, rarity: 'common', dmg: 3, hits: 2, scale: 'sen', icon: '🐾', desc: 'Deal 3 (+Sen) twice.' }),
  C({ id: 'leaf_wall', name: 'Leaf Wall', type: 'defend', cost: 2, rarity: 'rare', block: 12, icon: '🍃', desc: 'Gain 12 block.' }),
  C({ id: 'moonbeam', name: 'Moonbeam', type: 'skill', cost: 2, mp: 6, rarity: 'rare', dmg: 16, scale: 'mag', icon: '🌙', desc: '6 MP: deal 16 (+Mag).' }),
  C({ id: 'sweet_song', name: 'Sweet Song', type: 'heal', cost: 1, mp: 4, rarity: 'rare', heal: 10, block: 3, scale: 'chr', icon: '🎵', desc: '4 MP: heal 10 (+Chr), 3 block.' }),
  C({ id: 'pounce', name: 'Pounce', type: 'attack', cost: 2, rarity: 'rare', dmg: 13, scale: 'pow', weak: 1, icon: '💥', desc: 'Deal 13 (+Pow), apply 1 Dizzy.' }),
  C({ id: 'second_wind', name: 'Second Wind', type: 'skill', cost: 0, rarity: 'rare', energy: 2, icon: '🌬️', desc: 'Gain 2 energy.' }),
  C({ id: 'flurry', name: 'Flurry', type: 'attack', cost: 2, rarity: 'epic', dmg: 4, hits: 4, scale: 'sen', icon: '🌪️', desc: 'Deal 4 (+Sen) four times.' }),
  C({ id: 'starfall', name: 'Starfall', type: 'skill', cost: 3, mp: 10, rarity: 'epic', dmg: 30, scale: 'mag', icon: '🌠', desc: '10 MP: deal 30 (+Mag).' }),
  C({ id: 'hearth_hug', name: 'Hearth Hug', type: 'heal', cost: 2, rarity: 'epic', heal: 18, block: 8, scale: 'chr', icon: '💖', desc: 'Heal 18 (+Chr), 8 block.' }),
].map(d => [d.id, d]));

export const STARTER_DECK = ['bop', 'bop', 'bop', 'bop', 'snuggle_guard', 'snuggle_guard', 'snuggle_guard', 'patch_up', 'spark', 'double_tap'];

export type Intent = { kind: 'attack'; n: number; hits?: number } | { kind: 'defend'; n: number } | { kind: 'buff'; n: number };
export interface Drop { id: string; chance: number; kind: 'item' | 'card'; min?: number; max?: number }
export interface EnemyDef {
  id: string; name: string; hp: number; level: number; color: number; shape: 'blob' | 'pup' | 'imp' | 'boss';
  pattern: Intent[]; exp: number; glimmer: [number, number]; drops: Drop[]; guaranteed?: Drop[]; scale: number;
}
export const ENEMIES: Record<string, EnemyDef> = {
  mossling: { id: 'mossling', name: 'Mossling', hp: 22, level: 1, color: 0x7fcf6a, shape: 'blob', scale: 0.8, exp: 12, glimmer: [4, 10],
    pattern: [{ kind: 'attack', n: 5 }, { kind: 'defend', n: 4 }, { kind: 'attack', n: 7 }],
    drops: [{ id: 'moss_tuft', chance: 0.8, kind: 'item', min: 1, max: 3 }, { id: 'berry_tonic', chance: 0.3, kind: 'item' }, { id: 'dewdrop_gem', chance: 0.08, kind: 'item' }, { id: 'double_tap', chance: 0.12, kind: 'card' }, { id: 'leaf_wall', chance: 0.05, kind: 'card' }, { id: 'f_glowcap_lamp', chance: 0.05, kind: 'item' }] },
  thornpup: { id: 'thornpup', name: 'Thornpup', hp: 30, level: 3, color: 0x9a7b4f, shape: 'pup', scale: 0.9, exp: 20, glimmer: [8, 16],
    pattern: [{ kind: 'attack', n: 4, hits: 2 }, { kind: 'buff', n: 2 }, { kind: 'attack', n: 9 }],
    drops: [{ id: 'thorn_bark', chance: 0.75, kind: 'item', min: 1, max: 2 }, { id: 'dewdrop_gem', chance: 0.12, kind: 'item' }, { id: 'bramble_saber', chance: 0.06, kind: 'item' }, { id: 'glowcap_staff', chance: 0.05, kind: 'item' }, { id: 'pounce', chance: 0.1, kind: 'card' }] },
  cinder_imp: { id: 'cinder_imp', name: 'Cinder Imp', hp: 44, level: 6, color: 0xff7043, shape: 'imp', scale: 0.9, exp: 38, glimmer: [15, 30],
    pattern: [{ kind: 'attack', n: 10 }, { kind: 'attack', n: 4, hits: 3 }, { kind: 'defend', n: 8 }, { kind: 'buff', n: 3 }],
    drops: [{ id: 'ember_shard', chance: 0.8, kind: 'item', min: 1, max: 3 }, { id: 'soot_silk', chance: 0.2, kind: 'item' }, { id: 'mint_elixir', chance: 0.25, kind: 'item' }, { id: 'cinder_fang', chance: 0.06, kind: 'item' }, { id: 'starfire_opal', chance: 0.02, kind: 'item' }, { id: 'moonbeam', chance: 0.1, kind: 'card' }, { id: 'second_wind', chance: 0.08, kind: 'card' }, { id: 'sweet_song', chance: 0.08, kind: 'card' }, { id: 'f_ember_hearth', chance: 0.05, kind: 'item' }] },
  smoulderjaw: { id: 'smoulderjaw', name: 'Old Smoulderjaw', hp: 120, level: 10, color: 0xb23a2e, shape: 'boss', scale: 2.0, exp: 160, glimmer: [120, 200],
    pattern: [{ kind: 'attack', n: 12 }, { kind: 'defend', n: 12 }, { kind: 'attack', n: 6, hits: 3 }, { kind: 'buff', n: 4 }, { kind: 'attack', n: 20 }],
    guaranteed: [{ id: '__boss_epic__', chance: 1, kind: 'item' }],
    drops: [{ id: 'smoulder_crown', chance: 0.35, kind: 'item' }, { id: 'starfire_opal', chance: 0.4, kind: 'item' }, { id: 'flurry', chance: 0.25, kind: 'card' }, { id: 'starfall', chance: 0.25, kind: 'card' }, { id: 'hearth_hug', chance: 0.25, kind: 'card' }, { id: 'f_smoulder_throne', chance: 0.3, kind: 'item' }, { id: 'c_ember_crown', chance: 0.2, kind: 'item' }] },
};
export const BOSS_EPICS = ['sunpetal_blade', 'comet_scepter', 'velvet_paw', 'smoulder_crown'];

// Treasure chests: tiered loot tables
export const CHEST_TABLES: Record<Rarity, { items: string[]; cards: string[]; glimmer: [number, number] }> = {
  common: { items: ['moss_tuft', 'thorn_bark', 'berry_tonic', 'ember_shard'], cards: ['double_tap', 'peek'], glimmer: [10, 25] },
  rare: { items: ['f_glowcap_lamp', 'f_ember_hearth', 'dewdrop_gem', 'soot_silk', 'bramble_saber', 'glowcap_staff', 'cinder_fang', 'mint_elixir'], cards: ['leaf_wall', 'moonbeam', 'pounce', 'sweet_song', 'second_wind'], glimmer: [30, 70] },
  epic: { items: ['f_smoulder_throne', 'c_ember_crown', 'starfire_opal', 'sunpetal_blade', 'comet_scepter', 'velvet_paw'], cards: ['flurry', 'starfall', 'hearth_hug'], glimmer: [80, 160] },
};

export const RARITY_COLOR: Record<Rarity, string> = { common: '#8a94a6', rare: '#3d8bff', epic: '#b04dff' };

export const ZONES: Record<ZoneId, { name: string; sub: string; ground: number; path: number; fog: number; size: number }> = {
  town: { name: 'Bellbrook Town', sub: 'Market hub of Puffle Cay', ground: 0x9fd98a, path: 0xe9d3a1, fog: 0xcfeefc, size: 26 },
  woods: { name: 'Mossmere Woods', sub: 'Open dungeon · Lv 1–5', ground: 0x6fb36a, path: 0xb99a6b, fog: 0xb8e0c0, size: 34 },
  hollow: { name: 'Cinder Hollow', sub: 'Open dungeon · Lv 5–10 · Boss lair', ground: 0x8a6a5a, path: 0x5a4038, fog: 0xf0b9a0, size: 34 },
  den: { name: 'My Den', sub: 'Press B to decorate', ground: 0xd9b48a, path: 0xd9b48a, fog: 0xfff0e0, size: 6 },
};

export const NPC_NAMES = ['Pipkin', 'Marzi', 'Tumbletoe', 'Olive', 'Sprocket', 'Biscuit', 'Fennel', 'Quill', 'Juniper', 'Nutmeg', 'Clover', 'Pebble'];

export const DEN_THEMES = {
  walls: [ { id: 'cream', name: 'Cream', color: 0xfff1dc }, { id: 'mint', name: 'Mint', color: 0xc8f2dc }, { id: 'lilac', name: 'Lilac', color: 0xe3d4ff }, { id: 'sky', name: 'Sky', color: 0xcbe8ff }, { id: 'peach', name: 'Peach', color: 0xffd6c2 } ],
  floors: [ { id: 'oak', name: 'Oak', color: 0xd9b48a }, { id: 'cherry', name: 'Cherry', color: 0xb0705a }, { id: 'moss', name: 'Moss Tile', color: 0x9fcf8e }, { id: 'stone', name: 'Stone', color: 0xb8b8c4 }, { id: 'candy', name: 'Candy', color: 0xffb8d2 } ],
};
