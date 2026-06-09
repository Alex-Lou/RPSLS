# Constellation Pro — Roadmap Live

> **Dernière mise à jour : 2026-06-09 (post-test Lot C validé device)**
> Document actualisé à chaque avancement de lot. Source de vérité unique.

## État global

| Lot | Description | Statut | Priorité |
|-----|-------------|--------|----------|
| A | Stabilisation UI (calque Ranked) | ✅ DONE | — |
| B | Affinité 5 Voies RPSLS | 🟡 PARTIEL (3/5 voies câblées) | 🟡 Moyen |
| C | Constellation 3⭐ | ✅ DONE (compteur + UI + log unlock) | — |
| D | 5 Finishers (FORTERESSE/VERGER/LAME/MÉTAMORPHOSE/CALCUL) | 🔴 NEXT | 🟠 Haut |
| E | Lobby Pro (calque RankedLobby) | ✅ DONE | — |
| F | Matchmaking online | 🟢 PENDING | 🟢 Bas |
| G | Tournoi Arena | 🟢 PENDING | 🟢 Bas |
| H | Polish UX post-Lot C (Alex feedback 2026-06-09) | 🔴 NEXT (avant ou après D, à choisir) | 🟠 Haut |

## Lot A — Stabilisation UI ✅

- Bouton retour + ConfirmModal forfait + wire arenaStats
- Mini-barre HP animée par créature (vert/ambre/rose)
- Chips ABSORBÉ + ESQUIVÉ (Aegis/dodge save)
- Pad stable (overlay Augur en absolute)
- Pulse glow bouton FIN DE TOUR
- Augur opp ne déforme plus mon HUD (mini-chip discret)
- Replace lane occupée ("↻ Remplacer")
- Snapshots board log à chaque tour
- Logs Hand/Deck/Discard/Mana à chaque snapshot (analyse CCG post-mortem)

## Lot B — Affinité 🟡

### Câblé (3/5)
- 🪨 **Pierre Voie** : Provocation 2 charges initiales (au lieu de 1) — **VALIDÉ live `P2L` visible**
- ✂️ **Ciseau Voie** : HP 2 au lieu de 1 (survit à un échange)
- 🖖 **Spock Voie** : ATK 3 perm (`voieAtkBonus = +1`) — **VALIDÉ live `⚔3` côté CPU**

### À câbler (2/5)
- 📄 **Feuille Voie** : Fanaison ralentie (−1 ATK tous les **2** tours au lieu de chaque tour) — nécessite refactor `wiltedSteps`
- 🦎 **Lézard Voie** : Esquive **2 charges** (au lieu de 1) — nécessite refactor `dodgeCharge: boolean` → `dodgeCharges: number`

## Lot C — Constellation 3⭐ ✅ DONE

### Mécanique implémentée
- `HeroState.constellationCount: number` (capé à 3 visuellement, count interne peut déborder)
- `HeroState.finisherUnlocked?: boolean` (set au passage 3/3, évite re-trigger)
- Détection summon affinité dans `applySummons` → increment + log `constellation ⭐ N/3`
- Log `→ FINISHER UNLOCKED` au passage 3/3
- `ArenaConstellationBar.tsx` composant standalone (display-only KISS) — 3 étoiles colorées + glow cosmique + label "FINISHER ✦"
- Monté dans `ArenaHeroStrip` côté toi + opp
- CPU random affinity à chaque match (couvre symétrie test)
- Fix lobby useEffect → arenaAffinity persiste dès le mount (avant : fallback display sans state)

### Validé live device 2026-06-09
```
T0 a pose rock L0 affinity=rock
T0 a constellation ⭐ 1/3
T2 a pose rock L1 affinity=rock
T2 a constellation ⭐ 2/3
T2 a pose rock L2 affinity=rock
T2 a constellation ⭐ 3/3 → FINISHER UNLOCKED
```

### ⚠️ Améliorations UX demandées par Alex post-test
- Étoiles **2× plus grosses**, animation cosmique **permanente** (pas juste au 3/3)
- À 3/3 : **flash plein écran** + nouvelle CARTE FINISHER **injectée dans la main** avec glow rareté légendaire
- Différence visuelle claire entre "Constellation pleine" et "Finisher disponible/cast"

## Lot D — 5 Finishers 🟠 NEXT

### Spécifications
| Affinité | Finisher | Effet |
|----------|----------|-------|
| 🪨 Pierre | **FORTERESSE** | Tes 3 Pierres prennent 🛡 + ATK 3 perm |
| 📄 Feuille | **VERGER ÉTERNEL** | Fanaison off + heal hero +1/tour persistent |
| ✂️ Ciseau | **LAME COSMIQUE** | Tranchant pierce TOUT (Aegis, Provoc, anti-taunt) |
| 🦎 Lézard | **MÉTAMORPHOSE** | Esquive infinie (dodge reset chaque tour) |
| 🖖 Spock | **CALCUL QUANTIQUE** | Tous tes sorts coûtent −1m + Logique anti-taunt double |

### À implémenter
- 5 nouveaux CardId Pro-only (rankedTypes ou arenaCardId séparé)
- Effets dans `arenaCardEffects.applyArenaSpell` ou nouveau `arenaFinisherEffects.ts`
- Injection auto de la carte Finisher dans la main au `finisherUnlocked = true`
- i18n EN+FR
- Art/icon (fallback emoji ok pour MVP — 🛡🌿🌌🐉🌠)
- Animation cinématique cast Finisher

## Lot H — Polish UX Alex feedback 2026-06-09 🔴

### #1 Cartes "3 mains égales" (anti-counter-comptoir CPU)
- **Brouillard** (3m) : aucun counter ce tour, toute confrontation = mutual trade ATK vs HP
- **Triade** (4m) : pose tes 3 lanes en atomique (opp ne voit rien jusqu'au reveal)
- **Aveuglement** (5m) : l'opp pose ses summons EN AVEUGLE (cache ton intent)
- **Miroir parfait** (5m) : copie EXACTEMENT le summon de l'opp dans tes lanes vides
- **Inversion** (4m) : swap les counter rules ce tour (Pierre→Feuille, etc)

### #2 Constellation Bar plus visible
- Étoiles 2× plus grosses
- Animation permanente (pulse subtle même 1/3 ou 2/3)
- À 3/3 : **flash plein écran + son** + CARTE FINISHER injectée dans la main

### #3 Voir la Voie adverse (info symétrique)
- Sur strip opp : afficher icône Affinité + label "Voie de X"
- Justice gameplay — savoir quel Finisher anticiper

### #4 Fix chevauchements sous strip mains
- Sticker "Précision / Manipulez Pas / Aegis" s'empile mal (overlay)
- Solution : ligne horizontale dédiée scrollable

### #5 Eventail cartes multiples sur lane
- Quand 2 sorts sur la même lane, seul le dernier visible
- Solution : fan rotation −10° / 0° / +10° + offset X, hover/tap pour bring-to-front

### #6 Zone centrale (Tour N / Combat / Invocations) chevauchements
- Banner Combat + chip T6 + Invocations se superposent parfois
- Audit z-index + safe-margin + stack trier

### #7 **BUT D'OR** — système d'égalité absolue
- Mécanique actuelle : L0 fire, si b meurt = match-end immédiat même si tes L1/L2 t'aurait mis à 0 aussi
- **Solution proposée** :
  - Résoudre TOUTES les lanes (boucle complète) même si match-end interim
  - Si à la fin a≤0 ET b≤0 → **ÉGALITÉ**
  - Dans ce cas : phase **TIE-BREAK / Mort subite** dédiée :
    - 1 lane unique L1 centrale "Arène d'Or" (animation gold pulse)
    - Chaque joueur pose UN symbole RPSLS aveugle (pas de cartes)
    - Reveal cinématique HD slow-mo
    - Winner gagne, mirror → re-spin avec shuffle visible
  - **Qualité animations cruciale** : zoom dramatique, slow-mo reveal, fanfare audio

## Lot Fun-fix ✅

### Done
- Aegis 1× par hero par match (lock fizzle bypass fix)
- +1 pioche si kill (kill bonus pending +K)
- Mana cap 8
- Précision dédup MAX_COPIES=2
- **TDZ bug FIXÉ** (counter A-wins/B-wins kill correctement)
- CPU mirror raretés du joueur (`buildCpuDeckMirroring`)
- **MAX_SPELLS_PER_TURN bypass FIXÉ** (filet engine `applyAllSpells` truncate intent à 2)
- CPU random affinity à chaque match

### Validé en live 2026-06-09
- `[arena:spell] T5 BYPASS BLOCKED a — intent had 3 spells, truncated to 2` (filet en action)
- `[arena:spell] T3 a aegis FIZZLE (lock déjà actif)` (lock anti-spam fonctionne)

## 🆕 Nouvelles requêtes (Alex feedback antérieur, encore à câbler)

### CPU theme + pad assortis
- Le CPU doit avoir un thème + pad cohérents (même famille visuelle)
- Random parmi mappings `BG_DEFAULT_THEME` existants
- En match online vs joueurs réels, chacun garde ses choix d'apparence

### Cartes anti-stalemate (alternatives aux 5 cartes "3 mains égales")
- **Dispel** (2m) : retire shields + Provoc charges d'une créature opp
- **Banish** (5m) : détruit créature, ignore shields

### Animations passifs restants
- 🌿 Étouffe (Feuille suspend Provoc opp) chip
- 🧬 Logique (Spock spell immune) chip
- ⚔ Tranchant (Ciseau pierce Aegis) chip explicite
- Émoussé badge permanent

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

### Fichiers Arena actuels (état au 2026-06-09 post-Lot C)
```
app/src/arena/
├── ArenaBoard.tsx
├── ArenaCardInspect.tsx
├── ArenaConstellationBar.tsx        ← NEW Lot C
├── ArenaDebugOverlay.tsx
├── ArenaGame.tsx
├── ArenaHeroStrip.tsx
├── ArenaHowItWorks.tsx
├── ArenaLaneSlot.tsx
├── ArenaLobby.tsx                   ← fix useEffect setArenaAffinity mount
├── ArenaMatchEnd.tsx
├── ArenaMatchSplash.tsx
├── ArenaPlanPhase.tsx
├── ArenaPrepScreen.tsx
├── arenaAI.ts
├── arenaCardEffects.ts
├── arenaDecks.ts                    ← buildCpuDeckMirroring
├── arenaLog.ts                      ← window.__arenaLogs__ exposé
├── arenaPhase2Spells.ts
├── arenaResolverFlow.ts             ← logBoardSnapshot + hand logs
├── arenaRules.ts                    ← MAX_SPELLS filet + constellation increment
├── arenaSpellHelpers.ts
└── arenaTypes.ts                    ← constellationCount + finisherUnlocked
```
