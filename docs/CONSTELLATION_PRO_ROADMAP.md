# Constellation Pro — Roadmap Live

> **Dernière mise à jour : 2026-06-09**
> Document actualisé à chaque avancement de lot. Source de vérité unique.

## État global

| Lot | Description | Statut | Priorité |
|-----|-------------|--------|----------|
| A | Stabilisation UI (calque Ranked) | ✅ DONE | — |
| B | Affinité 5 Voies RPSLS | 🟡 PARTIEL (3/5 voies câblées) | 🟡 Moyen |
| C | Constellation 3⭐ | 🔴 PENDING | 🔴 Critique |
| D | 5 Finishers (FORTERESSE/VERGER/LAME/MÉTAMORPHOSE/CALCUL) | 🔴 PENDING | 🟠 Haut |
| E | Lobby Pro (calque RankedLobby) | ✅ DONE | — |
| F | Matchmaking online | 🟢 PENDING | 🟢 Bas |
| G | Tournoi Arena | 🟢 PENDING | 🟢 Bas |

## Lot A — Stabilisation UI ✅

- Bouton retour + ConfirmModal forfait + wire arenaStats
- Mini-barre HP animée par créature (vert/ambre/rose)
- Chips ABSORBÉ + ESQUIVÉ (Aegis/dodge save)
- Pad stable (overlay Augur en absolute)
- Pulse glow bouton FIN DE TOUR
- Augur opp ne déforme plus mon HUD (mini-chip discret)
- Replace lane occupée ("↻ Remplacer")
- Snapshots board log à chaque tour

## Lot B — Affinité 🟡

### Câblé (3/5)
- 🪨 **Pierre Voie** : Provocation 2 charges initiales (au lieu de 1)
- ✂️ **Ciseau Voie** : HP 2 au lieu de 1 (survit à un échange)
- 🖖 **Spock Voie** : ATK 3 perm (`voieAtkBonus = +1`)

### À câbler (2/5)
- 📄 **Feuille Voie** : Fanaison ralentie (−1 ATK tous les **2** tours au lieu de chaque tour) — nécessite refactor `wiltedSteps`
- 🦎 **Lézard Voie** : Esquive **2 charges** (au lieu de 1) — nécessite refactor `dodgeCharge: boolean` → `dodgeCharges: number`

## Lot C — Constellation 3⭐ 🔴 CRITIQUE

### Mécanique
- Poser ton symbole d'Affinité **3 fois cumulés** dans le match remplit 3 étoiles
- Chaque étoile = milestone visuel (1, 2, 3 sur compteur au-dessus du board)
- 3 étoiles = débloque ton Finisher (carte spéciale dans la main)

### À implémenter
- `Player.constellationCount: number` (HeroState)
- Détection summon affinité dans `applySummons` → increment
- UI compteur 3⭐ au-dessus du board
- FX glow chaque étoile remplie
- Animation cosmique à 3/3 (constellation alignée)
- Auto-ajout de la carte Finisher correspondante dans la main

## Lot D — 5 Finishers 🟠

### Spécifications
| Affinité | Finisher | Effet |
|----------|----------|-------|
| 🪨 Pierre | **FORTERESSE** | Tes 3 Pierres prennent 🛡 + ATK 3 perm |
| 📄 Feuille | **VERGER ÉTERNEL** | Fanaison off + heal hero +1/tour persistent |
| ✂️ Ciseau | **LAME COSMIQUE** | Tranchant pierce TOUT (Aegis, Provoc, anti-taunt) |
| 🦎 Lézard | **MÉTAMORPHOSE** | Esquive infinie (dodge reset chaque tour) |
| 🖖 Spock | **CALCUL QUANTIQUE** | Tous tes sorts coûtent −1m + Logique anti-taunt double |

### À implémenter
- 5 nouveaux CardId Pro-only dans rankedTypes (ou créer arenaCardId séparé)
- Effets dans arenaCardEffects.applyArenaSpell
- i18n EN+FR
- Art/icon (fallback emoji ok pour MVP)

## Lot Fun-fix ✅ (avec bugs résiduels)

### Done
- Aegis 1× par hero par match
- +1 pioche si kill
- Mana cap 8
- Précision dédup MAX_COPIES=2
- **TDZ bug FIXÉ** (counter A-wins/B-wins kill correctement)
- CPU mirror raretés du joueur (`buildCpuDeckMirroring`)

### 🔴 Bug résiduel
- **MAX_SPELLS_PER_TURN ne marche pas systématiquement** : observé 3 sorts cast T6 (Heist + Anchor + Surge) alors que le cap = 2. À investiguer.

## 🆕 Nouvelles requêtes

### CPU theme + pad assortis
- Le CPU doit avoir un thème + pad cohérents (même famille visuelle, pas mismatch)
- Random parmi mappings `BG_DEFAULT_THEME` existants
- En match online vs joueurs réels, chacun garde ses choix d'apparence

### Cartes anti-stalemate
- **Dispel** (2m) : retire shields + Provoc charges d'une créature opp
- **Banish** (5m) : détruit créature, ignore shields
- Nouveau CardId + i18n + UI

### Animations passifs restants
- 🌿 Étouffe (Feuille suspend Provoc opp) chip
- 🧬 Logique (Spock spell immune) chip
- ⚔ Tranchant (Ciseau pierce Aegis) chip explicite
- Émoussé badge permanent

### Bugs détectés à investiguer
- **MAX_SPELLS_PER_TURN** ne marche pas (3 sorts cast T6 observés)

## Lot F — Matchmaking online 🟢

- WebSocket queue Pro séparée de Ranked
- Leaderboard arenaStats sync cloud
- Persona CPU pour fallback offline

## Lot G — Tournoi Arena 🟢

- Bracket 4/8/16 joueurs
- Persona CPU pour ronds blank
- Prizes Éclats / Boosts

## Architecture & qualité

### Règles
- **SOLID** : single responsibility par fichier
- **DRY** : pas de duplication, helpers réutilisables
- **KISS** : code simple, pas d'over-engineering
- **<400 lignes par fichier** ceiling
- **Pas d'orphelins** : tout fichier créé doit être référencé / importé
- **Commits français** avec sections claires
- **i18n EN+FR** pour user-facing
- **Typecheck obligatoire** avant commit
- **Test device** avant claim "fixed"

### Fichiers Arena actuels (état au 2026-06-09)
```
app/src/arena/
├── ArenaBoard.tsx
├── ArenaCardInspect.tsx
├── ArenaDebugOverlay.tsx
├── ArenaGame.tsx
├── ArenaHeroStrip.tsx
├── ArenaHowItWorks.tsx
├── ArenaLaneSlot.tsx
├── ArenaLobby.tsx
├── ArenaMatchEnd.tsx
├── ArenaMatchSplash.tsx
├── ArenaPlanPhase.tsx
├── ArenaPrepScreen.tsx
├── arenaAI.ts
├── arenaCardEffects.ts
├── arenaDecks.ts
├── arenaLog.ts
├── arenaPhase2Spells.ts
├── arenaResolverFlow.ts
├── arenaRules.ts
├── arenaSpellHelpers.ts
└── arenaTypes.ts
```
