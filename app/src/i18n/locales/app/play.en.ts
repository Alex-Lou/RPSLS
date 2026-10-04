// Textes hors Arena (play) — en. Fusionnés dans locales/en.ts.
const strings: Record<string, string> = {
  // ── Main menu: tile badges ──
  "play.badge.live": "LIVE",
  "play.badge.new": "NEW",
  "play.badge.newCards": "NEW · CARDS",
  "play.badge.beta": "BETA",
  "play.rp": "RP",
  "mode.constellation.tag": "Pure RPSLS · 3 lanes vs CPU · no cards",
  "play.countdownBeat": "{move}!",

  // ── Training (sandbox) ──
  "sandbox.mode.classic": "Classic",
  "sandbox.mode.classic.tag": "1v1 duel — first to a majority of rounds.",
  "sandbox.mode.lanes.tag": "3 lanes played in parallel against the CPU.",
  "sandbox.mode.cards.tag": "Mana, deck & bonus cards. Opens the lobby + tournament.",

  // ── Constellation: lobby ──
  "constel.tip.label": "Tip:",
  "constel.tip.body": "win a lane with one of its favoured moves (listed above) →",
  "constel.tip.bonus": "a ✨ badge (style only)",
  "constel.tip.example": "E.g. Rock or Scissors in FORCE.",

  // ── Daily challenges ──
  "daily.badge.online": "online",

  // ── Perks (Ranked 1v1) ──
  "atout.lecture.name": "Read",
  "atout.lecture.desc": "Reveals the opponent's move (not with All-in).",
  "atout.vabanque.name": "All-in",
  "atout.vabanque.desc": "The current round is worth 2 points (not with Read).",
  "atout.garde.name": "Guard",
  "atout.garde.desc": "Cancels your 1st lost round (→ draw).",
  "atout.contre.name": "Counter",
  "atout.contre.desc": "Replays your 1st lost round (opponent re-rolls).",
  "atout.kind.manual": "manual",
  "atout.kind.auto": "auto",
  "atout.picker.title": "Pick your perks",
  "atout.picker.sub": "{n} perks · each usable once per match",
  "atout.picker.start": "Start →",
  "atout.picker.remaining": "Pick {n} more perk",
  "atout.picker.remainingPlural": "Pick {n} more perks",
  "atout.lecture.reveal": "🔮 Opponent will play: {move}",
  "atout.vabanque.armed": "⚡ All-in armed — 2-point round",
  "atout.note.contre": "🔁 Counter — opponent re-rolled",
  "atout.note.garde": "🛡️ Guard — loss cancelled",
  "atout.note.vabanque": "⚡ All-in — 2-point round",

  // ── Match: forfeit, misc ──
  "match.quit.body": "You'll lose the current round. It will count as a defeat.",
  "match.quit.penaltyLabel": "⚠️ Repeated forfeits:",
  "match.quit.penaltyValue": "{n} extra RP",
  "match.quit.continue": "Keep playing",
  "match.quit.forfeit": "Forfeit",
  "match.close": "Close",
  "match.anonymous": "Anonymous",

  // ── Rank tiers ──
  "match.tier.bronze": "Bronze",
  "match.tier.silver": "Silver",
  "match.tier.gold": "Gold",
  "match.tier.platinum": "Platinum",
  "match.tier.diamond": "Diamond",

  // ── Constellation: board ──
  "lanes.matchFoundSubOne": "{lanes} lanes · First to {winTo} round",
  "lanes.scoreCaptionOne": "Round {round} · 3 lanes · First to {target} round-win",
  "lanes.laneShort": "L{n}",
  "lanes.pickAria": "Play {move}",

  // ── Tips (flavor/tips.ts) ──
  "tip.aegis-saves": "Aegis turns a lost lane into a draw — perfect against Surge.",
  "tip.draw-on-win": "You only draw a new card after winning a round.",
  "tip.discard-on-loss": "Lose a round and a random card slips out of your hand.",
  "tip.mana-ramp": "Mana goes 1 → 2 → 3 → 4 across the first rounds, then caps.",
  "tip.one-card-per-round": "Only one card may be played per round — choose wisely.",
  "tip.heist-mechanic": "Heist steals a card — but the victim draws a free one next round.",
  "tip.augur-cooldown": "Augur peeks at one opponent lane; 2-round cooldown before reuse.",
  "tip.supernova-gamble": "Supernova: sweep (3-0) = ×3 points, anything else = 0.",
  "tip.tide-trigger": "Tide needs at least 2 lanes won to fire — sweep = +3 bonus.",
  "tip.anchor-immune": "Anchor makes one lane immune to opponent card effects.",
  "tip.epic-oneshot": "Epic and Legendary cards are one-shot — gone for the rest of the match.",
  "tip.winto-bestof5": "Constellation Ranked is played as Best of 5.",
  "tip.combo-triple": "A combo (same move on all 3 lanes) gives +1 bonus point.",
  "tip.favoured-lane": "Each lane has a 'favoured' move that adds +1 when it wins there.",
  "tip.save-mana": "Saving mana for round 4 unlocks Supernova plays.",
  "tip.curse-deny": "Curse is best on the lane where your opponent always plays safe.",
  "tip.precision-favour": "Precision marks any lane as favoured — boost an unusual pick.",
  "tip.echo-double": "Echo lets you deploy your strongest pick across two lanes.",
  "tip.vortex-bait": "Vortex rotates opponent picks — use it to dodge a Surge.",
  "tip.oracle-burst": "Oracle reveals ALL three opponent picks — pair with Precision or Surge.",
  "tip.second-wind": "Last Stand is a comeback tool — hold it for when you're behind.",
  "tip.rpsls-bbt": "Sheldon Cooper popularised RPSLS — though Sam Kass invented it in '95.",
  "tip.spock-vapor": "Spock vaporizes Rock. Don't ask how, Vulcan logic.",
  "tip.lizard-poisons": "Lizard poisons Spock — because every rule needs an exception.",
  "tip.paper-disproves": "Paper disproves Spock with one publication. Peer review wins.",
  "tip.5moves-10outcomes": "5 moves, 10 unique outcomes — the elegance of odd-numbered RPS.",
  "tip.constellation-vibe": "Constellation = 3 parallel duels at once. Triple the bluff, triple the fun.",
  "tip.silver-heist": "Reach 1100 RP (Silver) to unlock Heist.",
  "tip.gold-oracle": "Reach 1300 RP (Gold) to unlock Oracle.",
  "tip.platinum-supernova": "Reach 1500 RP (Platinum) to unlock Supernova.",
  "tip.echo-5wins": "Win 5 Constellation matches to unlock Echo.",
  "tip.curse-10wins": "Win 10 Constellation matches to unlock Curse.",
  "tip.vortex-3sweeps": "Land 3 sweeps (3-0) in Constellation to unlock Vortex.",
  "tip.daily-90xp": "Daily challenges can grant up to 90 XP — claim before midnight.",
  "tip.theme-pair": "Picking a background auto-applies its paired playmat — mix later if you want.",
  "tip.profile-avatar": "Profile → Avatar: 16 themed badges, or upload your own photo.",
  "tip.deck-six": "Your Constellation deck is 6 cards — 3 main + 3 reserve.",
};

export default strings;
