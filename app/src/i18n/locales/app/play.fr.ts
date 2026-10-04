// Textes hors Arena (play) — fr. Fusionnés dans locales/fr.ts.
const strings: Record<string, string> = {
  // ── Menu principal : badges des tuiles ──
  "play.badge.live": "EN DIRECT",
  "play.badge.new": "NOUVEAU",
  "play.badge.newCards": "NOUVEAU · CARTES",
  "play.badge.beta": "BÊTA",
  "play.rp": "PR",
  "mode.constellation.tag": "RPSLS pur · 3 couloirs vs IA · sans cartes",
  "play.countdownBeat": "{move} !",

  // ── Entraînement (sandbox) ──
  "sandbox.mode.classic": "Classique",
  "sandbox.mode.classic.tag": "Duel 1 v 1 — premier à la majorité des manches.",
  "sandbox.mode.lanes.tag": "3 couloirs joués en parallèle contre l’IA.",
  "sandbox.mode.cards.tag": "Mana, deck et cartes bonus. Ouvre le lobby et le tournoi.",

  // ── Constellation : lobby ──
  "constel.tip.label": "Astuce :",
  "constel.tip.body": "gagne un couloir en y jouant l’un de ses coups favoris (listés ci-dessus) →",
  "constel.tip.bonus": "badge ✨ (pour le style)",
  "constel.tip.example": "Ex. : Pierre ou Ciseaux dans FORCE.",

  // ── Défis du jour ──
  "daily.badge.online": "en ligne",

  // ── Atouts (Classé 1 v 1) ──
  "atout.lecture.name": "Lecture",
  "atout.lecture.desc": "Révèle le coup de l’adversaire (pas avec Va-banque).",
  "atout.vabanque.name": "Va-banque",
  "atout.vabanque.desc": "La manche en cours vaut 2 points (pas avec Lecture).",
  "atout.garde.name": "Garde",
  "atout.garde.desc": "Annule ta 1ʳᵉ manche perdue (→ égalité).",
  "atout.contre.name": "Contre",
  "atout.contre.desc": "Rejoue ta 1ʳᵉ manche perdue (nouveau tirage adverse).",
  "atout.kind.manual": "manuel",
  "atout.kind.auto": "auto",
  "atout.picker.title": "Choisis tes atouts",
  "atout.picker.sub": "{n} atouts · chacun utilisable une fois dans le match",
  "atout.picker.start": "Commencer →",
  "atout.picker.remaining": "Choisis encore {n} atout",
  "atout.picker.remainingPlural": "Choisis encore {n} atouts",
  "atout.lecture.reveal": "🔮 L’adversaire va jouer : {move}",
  "atout.vabanque.armed": "⚡ Va-banque armé — manche à 2 points",
  "atout.note.contre": "🔁 Contre — nouveau tirage adverse",
  "atout.note.garde": "🛡️ Garde — défaite annulée",
  "atout.note.vabanque": "⚡ Va-banque — manche à 2 points",

  // ── Match : abandon, divers ──
  "match.quit.body": "Tu vas perdre la manche en cours. Ce sera compté comme une défaite.",
  "match.quit.penaltyLabel": "⚠️ Abandons répétés :",
  "match.quit.penaltyValue": "{n} PR supplémentaires",
  "match.quit.continue": "Continuer",
  "match.quit.forfeit": "Abandonner",
  "match.close": "Fermer",
  "match.anonymous": "Anonyme",

  // ── Paliers de rang ──
  "match.tier.bronze": "Bronze",
  "match.tier.silver": "Argent",
  "match.tier.gold": "Or",
  "match.tier.platinum": "Platine",
  "match.tier.diamond": "Diamant",

  // ── Constellation : plateau ──
  "lanes.matchFoundSubOne": "{lanes} couloirs · Premier à {winTo} manche",
  "lanes.scoreCaptionOne": "Manche {round} · 3 couloirs · Premier à {target} manche gagnée",
  "lanes.laneShort": "C{n}",
  "lanes.pickAria": "Jouer {move}",

  // ── Astuces (flavor/tips.ts) ──
  "tip.aegis-saves": "Égide transforme un couloir perdu en égalité — parfait contre Surcharge.",
  "tip.draw-on-win": "Tu ne pioches une nouvelle carte qu’après avoir gagné une manche.",
  "tip.discard-on-loss": "Perds une manche et une carte au hasard quitte ta main.",
  "tip.mana-ramp": "Le mana passe de 1 → 2 → 3 → 4 au fil des premières manches, puis plafonne.",
  "tip.one-card-per-round": "Une seule carte par manche — choisis bien.",
  "tip.heist-mechanic": "Larcin vole une carte — mais la victime en pioche une gratuite à la manche suivante.",
  "tip.augur-cooldown": "Augure dévoile un couloir adverse ; 2 manches de recharge avant de le réutiliser.",
  "tip.supernova-gamble": "Supernova : balayage (3-0) = points ×3, sinon 0.",
  "tip.tide-trigger": "Marée exige au moins 2 couloirs gagnés pour se déclencher — balayage = +3 bonus.",
  "tip.anchor-immune": "Ancrage rend un couloir insensible aux effets des cartes adverses.",
  "tip.epic-oneshot": "Les cartes Épiques et Légendaires sont à usage unique — perdues pour le reste du match.",
  "tip.winto-bestof5": "Constellation Classée se joue en Meilleur de 5.",
  "tip.combo-triple": "En Classée, un combo (le même coup sur les 3 couloirs) rapporte +1 point bonus si tu ne perds pas la manche.",
  "tip.favoured-lane": "En Classée, chaque couloir a un coup « favori » qui rapporte +1 quand il y gagne.",
  "tip.save-mana": "Garder du mana pour la manche 4 ouvre la voie aux coups Supernova.",
  "tip.curse-deny": "Malédiction est idéale sur le couloir où ton adversaire joue toujours la sécurité.",
  "tip.precision-favour": "Précision rend n’importe quel couloir favori — booste un choix inhabituel.",
  "tip.echo-double": "Écho te permet de déployer ton meilleur coup sur deux couloirs.",
  "tip.vortex-bait": "Vortex fait tourner les coups adverses — idéal pour esquiver une Surcharge.",
  "tip.oracle-burst": "Oracle révèle les TROIS coups adverses — à combiner avec Précision ou Surcharge.",
  "tip.second-wind": "Sursaut d’Orgueil est une carte de remontée — garde-la pour quand tu es mené.",
  "tip.rpsls-bbt": "Sheldon Cooper a popularisé RPSLS — mais c’est Sam Kass qui l’a inventé en 1995.",
  "tip.spock-vapor": "Spock vaporise la Pierre. Ne demande pas comment, logique vulcaine.",
  "tip.lizard-poisons": "Le Lézard empoisonne Spock — toute règle a son exception.",
  "tip.paper-disproves": "La Feuille réfute Spock en une seule publication. L’évaluation par les pairs gagne.",
  "tip.5moves-10outcomes": "5 coups, 10 issues uniques — l’élégance d’un pierre-feuille-ciseaux impair.",
  "tip.constellation-vibe": "Constellation = 3 duels en parallèle. Triple bluff, triple plaisir.",
  "tip.silver-heist": "Atteins 1100 PR (Argent) pour débloquer Larcin.",
  "tip.gold-oracle": "Atteins 1300 PR (Or) pour débloquer Oracle.",
  "tip.platinum-supernova": "Atteins 1500 PR (Platine) pour débloquer Supernova.",
  "tip.echo-5wins": "Gagne 5 matchs Constellation pour débloquer Écho.",
  "tip.curse-10wins": "Gagne 10 matchs Constellation pour débloquer Malédiction.",
  "tip.vortex-3sweeps": "Réussis 3 balayages (3-0) en Constellation pour débloquer Vortex.",
  "tip.daily-90xp": "Les défis du jour rapportent jusqu’à 90 XP — récupère-les avant minuit.",
  "tip.theme-pair": "Choisir un fond applique son tapis assorti — tu pourras mélanger ensuite.",
  "tip.profile-avatar": "Profil → Avatar : 16 badges thématiques, ou importe ta propre photo.",
  "tip.deck-six": "Ton deck Constellation compte 6 cartes — 3 principales + 3 en réserve.",
};

export default strings;
