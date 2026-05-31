/**
 * tips.ts — central pool of short "did-you-know" lines surfaced during
 * loading screens, match-found splashes, idle waits and anywhere a quick
 * smile or pointer would soften a pause.
 *
 * Categories let callers narrow the pool to the context:
 *   - "gameplay" — rules / mechanics
 *   - "strategy" — tactical hints
 *   - "lore"     — RPSLS / Big-Bang nods, jokes
 *   - "meta"     — progression / unlocks / XP / LP
 *
 * Add tips here — no other code changes needed. Keep each ≤ 90 chars so
 * the LoadingTip's single-line layout stays clean on small phones.
 *
 * i18n: each tip is referenced by an i18n KEY (see i18n.ts). The text below
 * is the English fallback used when the key isn't yet translated.
 */

export type TipCategory = "gameplay" | "strategy" | "lore" | "meta";

export interface Tip {
  id: string;
  category: TipCategory;
  /** Emoji used as the leading icon — keeps the visual rhythm. */
  icon: string;
  /** English fallback. The real string comes from t(`tip.${id}`). */
  text: string;
}

export const TIPS: Tip[] = [
  // ───── Gameplay (rules / mechanics) ─────
  { id: "aegis-saves", category: "gameplay", icon: "🛡️", text: "Aegis turns a lane loss into a draw — perfect against Surge." },
  { id: "draw-on-win", category: "gameplay", icon: "🃏", text: "You only draw a new card after winning a round." },
  { id: "discard-on-loss", category: "gameplay", icon: "💔", text: "Lose a round and a random card slips out of your hand." },
  { id: "mana-ramp", category: "gameplay", icon: "💜", text: "Mana goes 1 → 2 → 3 → 4 across the first rounds, then caps." },
  { id: "one-card-per-round", category: "gameplay", icon: "✋", text: "Only one card may be played per round — choose wisely." },
  { id: "heist-mechanic", category: "gameplay", icon: "🏴‍☠️", text: "Heist steals a card — but the victim draws a free one next round." },
  { id: "augur-cooldown", category: "gameplay", icon: "👁️", text: "Augur peeks at one opponent lane; cooldown 2 rounds before reuse." },
  { id: "supernova-gamble", category: "gameplay", icon: "💫", text: "Supernova: sweep (3-0) = ×3 points, anything else = 0." },
  { id: "tide-trigger", category: "gameplay", icon: "🌊", text: "Tide needs at least 2 lanes won to fire — sweep = +3 bonus." },
  { id: "anchor-immune", category: "gameplay", icon: "🪨", text: "Anchor makes one lane immune to opponent card effects." },
  { id: "epic-oneshot", category: "gameplay", icon: "⚡", text: "Epics and Legendary cards are one-shot — gone for the rest of the match." },
  { id: "winto-bestof5", category: "gameplay", icon: "🏆", text: "Constellation Ranked plays best-of-5 rounds." },

  // ───── Strategy ─────
  { id: "combo-triple", category: "strategy", icon: "✨", text: "A combo (same move on all 3 lanes) gives +1 bonus point." },
  { id: "favoured-lane", category: "strategy", icon: "🎯", text: "Each lane has a 'favoured' move that adds +1 when it wins there." },
  { id: "save-mana", category: "strategy", icon: "🔋", text: "Saving mana for round 4 unlocks Supernova plays." },
  { id: "curse-deny", category: "strategy", icon: "💀", text: "Curse is best on the lane your opponent always plays safe." },
  { id: "precision-favour", category: "strategy", icon: "🎯", text: "Precision marks any lane as favoured — boost a non-natural pick." },
  { id: "echo-double", category: "strategy", icon: "🪞", text: "Echo lets you double-deploy your strongest pick across two lanes." },
  { id: "vortex-bait", category: "strategy", icon: "🌀", text: "Vortex rotates opponent picks — use it to dodge a Surge." },
  { id: "oracle-burst", category: "strategy", icon: "👁️‍🗨️", text: "Oracle reveals ALL three opponent picks — pair with Precision or Surge." },
  { id: "second-wind", category: "strategy", icon: "🩹", text: "Second Wind is a comeback tool — hold it for when you've been losing." },

  // ───── Lore / humour ─────
  { id: "rpsls-bbt", category: "lore", icon: "🥼", text: "Sheldon Cooper popularised RPSLS — though Sam Kass invented it in '95." },
  { id: "spock-vapor", category: "lore", icon: "🖖", text: "Spock vaporises Rock. Don't ask how, Vulcan logic." },
  { id: "lizard-poisons", category: "lore", icon: "🦎", text: "Lizard poisons Spock — because every rule needs an exception." },
  { id: "paper-disproves", category: "lore", icon: "📄", text: "Paper disproves Spock with one publication. Peer review wins." },
  { id: "5moves-10outcomes", category: "lore", icon: "🔢", text: "5 moves, 10 unique outcomes — the elegance of odd-numbered RPS." },
  { id: "constellation-vibe", category: "lore", icon: "🌌", text: "Constellation = 3 parallel duels at once. Triple the bluff, triple the fun." },

  // ───── Meta (progression / unlocks) ─────
  { id: "silver-heist", category: "meta", icon: "🥈", text: "Reach 1100 LP (Silver) to unlock Heist." },
  { id: "gold-oracle", category: "meta", icon: "🥇", text: "Reach 1300 LP (Gold) to unlock Oracle." },
  { id: "platinum-supernova", category: "meta", icon: "💎", text: "Reach 1500 LP (Platinum) to unlock Supernova." },
  { id: "echo-5wins", category: "meta", icon: "🪞", text: "Win 5 Constellation matches to unlock Echo." },
  { id: "curse-10wins", category: "meta", icon: "💀", text: "Win 10 Constellation matches to unlock Curse." },
  { id: "vortex-3sweeps", category: "meta", icon: "🌀", text: "Land 3 sweeps (3-0) in Constellation to unlock Vortex." },
  { id: "daily-90xp", category: "meta", icon: "📅", text: "Daily challenges can grant up to 90 XP — claim before midnight." },
  { id: "theme-pair", category: "meta", icon: "🎨", text: "Picking a background auto-applies its paired playmat — mix later if you want." },
  { id: "profile-avatar", category: "meta", icon: "👤", text: "Profile → Avatar: 16 themed badges, or upload your own photo." },
  { id: "deck-six", category: "meta", icon: "🃏", text: "Your Constellation deck is 6 cards — 3 main + 3 reserve." },
];

/**
 * Pick a tip at random, optionally from a single category, optionally
 * excluding ids you've recently shown so the rotation doesn't repeat.
 *
 * Pure function (uses Math.random) — no state. Callers wanting "rotate
 * every N seconds" can simply remember the last id and pass it as exclude.
 */
export function pickRandomTip(opts: { category?: TipCategory; exclude?: string } = {}): Tip {
  const pool = TIPS.filter(
    (t) => (opts.category ? t.category === opts.category : true) && t.id !== opts.exclude,
  );
  // Fallback: if filter wiped everything (tiny category + same exclude),
  // pick from the whole set.
  const src = pool.length > 0 ? pool : TIPS;
  return src[Math.floor(Math.random() * src.length)];
}
