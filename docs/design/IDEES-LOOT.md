# IDÉES LOOT — RPSLS

Document de conception pour récompenses et progression au-delà des packs/craft/codex existants.

**Univers**: Duel cosmique néon, progression locale (localStorage), économie éclats💎/poussière✨, cartes bonus 15-30, saisons 30j, arcade addictive.

---

## 1. DAILY FIRST WIN — Bonus éclats du premier match du jour

**Pitch**: Chaque 24h, le premier match remporté octroie 2× les éclats habituels (cumulé).

**Mécanisme**:
- Store: `lastDailyWinAt` (timestamp), `dailyWinClaimed: boolean`
- Hook dans `recordMatch`: détecte début nouveau jour (timestamp > lastDailyWinAt + 86400s), si win+!dailyWinClaimed → multiplier eclatsReward par 2, set dailyWinClaimed=true
- UI: Badge "⭐ BONUS QUOTIDIEN" sur la carte de victoire, countdown dans UserHeader (ex: "dans 3h47")
- Migration: init `lastDailyWinAt = now`, `dailyWinClaimed = false`

**Pourquoi c'est cool**: Incite à revenir une fois par jour (pattern arcade), rend la première victoire glorieuse, zero friction.

**Complexité**: Faible (3-4 lignes store, 1 composant badge)  
**Touches**: store/types.ts, pages/PlayGame.tsx (CardSlot recap), UserHeader

**Non-redondant**: ≠ packs/craft (c'est du cash direct), ≠ saisons (daily, pas monthly)

---

## 2. STREAK MULTIPLIER — Bonus éclats sur série de victoires

**Pitch**: À chaque victoire consécutive, un multiplicateur de 1.1× s'accumule (1.1 → 1.2 → 1.33) jusqu'à défaite/abandon.

**Mécanisme**:
- Store: `currentWinStreak: number` (réinitialisé à 0 à chaque perte)
- Hook dans `recordMatch`: si win → currentWinStreak++, eclatsReward *= (1 + currentWinStreak * 0.1), si lose → currentWinStreak = 0
- UI: Affichage du streak en haut du match (ex: "🔥 5 victoires consécutives [×1.5 éclats]"), animation +glow si nouvelle victoire
- Migration: init currentWinStreak = 0

**Pourquoi c'est cool**: Donne du momentum, rend les matchs plus enjeux à la suite, pique la compétitivité (genre "une de plus !").

**Complexité**: Faible (1 variable + 2 calculs)  
**Touches**: store/types.ts, ranked/RankedMatchView.tsx (display), ranked/RankedGame.tsx (compute)

**Non-redondant**: ≠ saisons/LP (c'est intra-session), ≠ packs (récompense directe)

---

## 3. WEEKLY QUEST BOARD — Quêtes thématiques qui dropent éclats/poussière

**Pitch**: Chaque semaine (dimanche 00:00 UTC), 4 quêtes nouvelles (facile/moyen/difficile/boss): "gagner 3 matchs en Constellation", "craftes une epic", "remporte 1 tournoi", etc. Complétion → rewards progressives (20/40/70/100 éclats, ou +25 poussière).

**Mécanisme**:
- Store: `weeklyQuests: Quest[]` avec id/description/goal/progress/completed/reward
- Hook `recordMatch`, `craftCard`, `rollPack`, `joinTournament`: met à jour quest.progress
- UI: Page/drawer "Quêtes Hebdo" avec barres de progression + bouton "Réclamer" (greyed tant qu'incomplet)
- Migration v21: init `weeklyQuests = []`
- Auto-reset: au démarrage, si `lastQuestRollAt` < dimanche passé → regenerate + set lastQuestRollAt

**Pourquoi c'est cool**: Dirige l'exploration de modes (redécouvre Constellation), crée des rituels hebdo, dopamine à la complétion.

**Complexité**: Moyenne (3 quêtes précodes, boucle de progress, reset logique)  
**Touches**: store/quests.ts (nouvelle), engine/economy.ts (quest generics), pages/QuestsPage.tsx (UI), App.tsx (hook)

**Non-redondant**: ≠ saisons (hebdo vs monthly), ≠ packs (quêtes-driven vs chance), ≠ daily (plusieurs vs 1×/jour)

---

## 4. PITY TIMER — Garantie de rare après 5 packs sans epic+

**Pitch**: Après avoir ouvert 5 packs sans epic/legendary, le 6e pack garantit au minimum une rare (ignoring le 60/30/9/1 probabilité).

**Mécanisme**:
- Store: `packsWithoutEpic: number` (réinitialisé après epic+)
- Hook dans `openPack()`: si resultado contient epic/legendary → packsWithoutEpic = 0 ; sinon ++ ; si packsWithoutEpic >= 5 → force upgrade common→rare dans le roll du 6e
- UI: Affichage visuel "🛡️ Garantie rare dans 3 packs" dans la Boutique quand packsWithoutEpic > 0
- Migration: init packsWithoutEpic = 0

**Pourquoi c'est cool**: Évite la frustration "10 commons d'affilée", psy de jeux mobiles sain, encourage à sauvegarder pour des sessions.

**Complexité**: Faible (1 variable, 1 condition dans rollPack)  
**Touches**: store/types.ts, engine/economy.ts, pages/ShopPage.tsx (UI hint)

**Non-redondant**: ≠ packs/craft (c'est du soft pity dans les packs), ≠ saisons (toujours actif)

---

## 5. SEASONAL EXCLUSIVE CARDS — Cartes non-craftables, drop-uniquement de saison

**Pitch**: Chaque saison (Bronze/Silver/Gold/Diamond/Legend), 2-3 cartes exclusives droppe UNIQUEMENT dans les packs si on a complété le Codex (ex: saison Bronze = Tempête Runique, éditeur: "Saison Bronze"). Non craftables. Au rollover, ne dropent plus.

**Mécanisme**:
- Store: `Player.currentSeason: {number, exclusiveCardPool: CardId[]}`
- Engine: constante SEASONAL_CARDS = {1: [id47, id48], 2: [id49, id50], ...}
- Hook dans `rollPack()`: avant le roll normal, si codexProgress >= 15 && carteId in currentSeason.exclusiveCardPool → chance 15% de drop cette carte au lieu d'une des 15 normales
- UI: Badge "SAISON X" doré sur la carte dans le Codex, tag "Exclusif" en recap pack
- Migration: currentSeason.exclusiveCardPool = SEASONAL_CARDS[currentSeason.number]

**Pourquoi c'est cool**: Collecte aspirationnelle à long terme, raison de rejouer les saisons, FOMO sain, cosmétique pépite.

**Complexité**: Moyenne (2-3 cartes à ajouter en v21, logique pool conditionnel)  
**Touches**: engine/economy.ts, app/src/cards.ts (ajouter metadata season), types.ts (Player.season.exclusiveCardPool), pages/ShopPage.tsx (badge)

**Non-redondant**: ≠ packs/craft (non-craftable), ≠ saisons (renouvelle les saisons via collectable)

---

## 6. HOURLY REWARD WHEEL — Roue animée de la fortune (éclats/XP/emoji)

**Pitch**: Toutes les 3 heures, une "roue" cosmique spinne avec 8 secteurs: éclats aléatoires (5-25), +XP mastery aléatoire, +1 poussière, emoji de chance 🌙/⚡/🔮. Tappe la roue → spin 2-3s animé, résultat glorifié.

**Mécanisme**:
- Store: `lastWheelSpinAt: timestamp`
- Hook dans App.tsx: chaque 3h, modal trigger "La roue de la fortune est prête ! ⚙️"
- Composant `WheelSpinner.tsx`: canvas/SVG roue 8 secteurs émail, taper → rotateY animation avec easing bounce, affichage final de la récompense
- Rewards table: `WHEEL_SECTORS = [{type:'eclats', min:5, max:25}, ...]`
- Migration: init lastWheelSpinAt = now

**Pourquoi c'est cool**: Visuel spectaculaire, variable aléatoire dope (la roue!) vs packs déterministes, mini-cérémonie de gratification, peut capturer des sessions offline.

**Complexité**: Moyenne-Élevée (nouveau composant roue animée, logique 3h, intégration modal)  
**Touches**: store/types.ts, components/WheelSpinner.tsx (nouveau), App.tsx (hook+modal trigger)

**Non-redondant**: ≠ packs (visuel + gratification théâtrale), ≠ daily (toutes les 3h, pas 1×/jour)

---

## 7. FRAGMENT CRAFTING — Assembler des fragments thématiques pour une carte rare garantie

**Pitch**: Les packs rares dropent 1-2 "fragments" thématiques (ex: "Fragment Tempête", "Fragment Glace"). Assembler 4 fragments identiques → déverrouille une rare GARANTIE avec thème correspondant (Epic Tempête Runique).

**Mécanisme**:
- Store: `Player.fragments: {[themeId]: count}`, nouveau objet types.ts `CardTheme`
- Hook dans `openPack()`: rares ont 20% de chance de drop un fragment au lieu d'une carte
- DeckManager onglet "Fragments": grille 2×3 des 6 thèmes, barre de progression 0-4 fragments, bouton "Forger" (disabled si <4)
- Hook `craftCard()`: détecte si c'est un "forge fragment" → check fragments[themeId] >= 4 → consume 4 → award carte + animation sparkle
- Migration v21: init fragments = {}

**Pourquoi c'est cool**: Progression "building-block", accumulation satisfaisante (4× détente), rare garantie sans RNG pur, cosmétique "thème".

**Complexité**: Élevée (système complet fragments, UI grille, logique forge conditionnelle)  
**Touches**: types.ts (CardTheme, fragments field), engine/economy.ts (rollPack logic), store/types.ts, pages/DeckManager.tsx (onglet Fragments)

**Non-redondant**: ≠ packs/craft (collecte + garantie), ≠ codex (thème vs collection)

---

## 8. TOURNAMENT CHAMPION LOOT — Récompenses bonus pour tournoi remporté

**Pitch**: Remporter un tournoi (4+ joueurs IA en bracket) → bonus 50 éclats + 30 poussière + "Trophée Champion" cosmétique (avatar frame doré) UNIQUEMENT si vous êtes le winner final.

**Mécanisme**:
- Store: `Player.achievements.tournamentWins: number`, `avatarFrame: 'none' | 'champion_gold' | ...`
- Hook dans `BracketPage` quand bracket.winner === playerId → trigger 50 éclats+30 poussière, set achievements.tournamentWins++, modal victoire "🏆 Champion du Tournoi !"
- UI: Avatar dans UserHeader reçoit frame doré animé (glyphes tourne autour)
- Migration: init achievements.tournamentWins = 0, avatarFrame = 'none'

**Pourquoi c'est cool**: Glorifie les tournois (actuellement peu rejoués), cosmétique aspirationnel, raison de vouloir gagner vs perdre tôt.

**Complexité**: Faible-Moyenne (hook lors de bracket.winner, frame cosmétique)  
**Touches**: store/types.ts (achievements, avatarFrame), pages/UserHeader.tsx (render frame), ranked/BracketPage.tsx (hook), migration v21

**Non-redondant**: ≠ LP/saisons (achievement-specific), ≠ packs (bonus structuré, pas RNG)

---

## 9. DAILY LOGIN STREAK — Compter les jours connectés, débloquer cosmétics via streak

**Pitch**: Tracker le nombre de jours CONSÉCUTIFS de login (min. 1 match joué). Chaque palier (3/7/14/30j) déverrouille un cosmétique: thème HUD, pad de battle, avatar emoji. Casser la streak → redémarrer à 0.

**Mécanisme**:
- Store: `Player.loginStreak: {count, lastLoginDate}`, `unlockedCosmetics: string[]`
- Hook dans App.tsx au premier appel: vérifier lastLoginDate; si aujourd'hui → OK; si hier → count++; si >1j → reset count=1
- Paliers: `STREAK_REWARDS = {3: 'theme_nebula', 7: 'pad_cosmic', 14: 'avatar_dragonblue', 30: 'theme_aurora'}`
- UI: Card dans ProfilePage "Connecté 14 jours 🔥 → Prochain: Theme Aurora à 30j"
- Migration: init loginStreak = {count: 1, lastLoginDate: today}

**Pourquoi c'est cool**: Engagement habituel durable, cosmétics gratuits non-pay-to-win, FOMO contrôlée (si on casse la streak), habit-forming.

**Complexité**: Faible-Moyenne (date tracking simple, UI streak card)  
**Touches**: store/types.ts, App.tsx (hook), pages/ProfilePage.tsx (card), migration v21

**Non-redondant**: ≠ daily first win (multi-jour vs 1×/jour), ≠ saisons (streak personnel vs cycle)

---

## 10. CARD MASTERY SEASONAL BONUS — Éclats bonus si tous les cartes mastery au niv 3+

**Pitch**: À chaque fin de saison, vérifier: si ≥12 cartes au mastery niv 3+ → bonus 100 éclats (si ≥14 → bonus 150). Incite à développer l'arène vaste.

**Mécanisme**:
- Hook dans `rolloverSeasonIfDue()`: compter cartes avec cardMastery[cardId].level >= 3
- Si count >= 12 → eclats += 100 ; si count >= 14 → eclats += 150
- UI: SeasonRolloverModal affiche "📚 Maîtrise cosmique: bonus 100 éclats !" si condition remplie
- Migration: no new field (redondant avec cardMastery existant)

**Pourquoi c'est cool**: Récompense jouer LARGE (pas 3 cartes seulement), crée gameplay long-termiste, incite à redécouvrir cartes oubliées.

**Complexité**: Faible (1 boucle count, 1 condition addition)  
**Touches**: store (hook existing rolloverSeasonIfDue), ranked/SeasonRolloverModal.tsx (display bonus)

**Non-redondant**: ≠ mastery pure (récompense éclats vs cosmétique), ≠ saisons (exploite mastery pour saison)

---

## 11. DECK EXPERIMENTATION BONUS — Éclats bonus si vous jouez un deck jamais utilisé

**Pitch**: Chaque match avec une **composition de deck NEUVE** (3 cartes main jamais combinées ensemble), bonus 10 éclats si victoire. Encourage à tester deck-building vs stale meta.

**Mécanisme**:
- Store: `Player.decksPlayed: string[]` (hashes de compositions deck)
- Hook dans `recordMatch`: créer hash de deck (sort ids, JSON.stringify, SHA1 mini) ; si !decksPlayed.includes(hash) && win → eclats += 10, decksPlayed.push(hash)
- UI: Badge "🧪 DECK NEUF" sur recap victoire
- Migration: init decksPlayed = []

**Pourquoi c'est cool**: Gère le "meta fatigue", valorise expérimentation vs tryhard, dope deckbuilding, réutilisable sur multi-modes.

**Complexité**: Faible-Moyenne (hash génération, array tracking)  
**Touches**: store/types.ts, engine/economy.ts (hash helper), ranked/RankedMatchView.tsx (badge)

**Non-redondant**: ≠ streak (deck vs victoires), ≠ daily (toujours actif)

---

## 12. COSMETIC UNLOCK VIA ACHIEVEMENTS — Débloquer pads/thèmes via défis cosmétiques

**Pitch**: Paliers de défi interne (pas tracking explicite, juste check à chaque match): "gagne 50 matchs" → pad galaxy, "craft 5 epics" → theme cybergrid, "remporte 3 tournois" → avatar couronne. Zero grind-feeling, juste des actions naturelles qui récalent des récompenses.

**Mécanisme**:
- Store: `Player.achievements: {winsTotal, cartssCrafted, tournamentsWon, ...}`
- Système lazy-eval: on chaque action (recordMatch, craftCard, tournamentWin), vérifier si unlocked condition atteinte dans `ACHIEVEMENT_UNLOCKS`
- Table: `{id: 'pad_galaxy', condition: (p) => p.achievements.winsTotal >= 50, rewardType: 'pad', rewardValue: 'galaxy'}`
- UI: Toast quand achievement unlock "🎉 Pad Galaxy déverrouillé !" → go auto-activer dans ProfilePage

**Pourquoi c'est cool**: Gamification invisible, fluidité (pas click-quest), cosmétiques gratuits motivants, réutilisable avec des dizaines de variantes.

**Complexité**: Moyenne (système achievements, hook checker dans recordMatch/etc, toast UI)  
**Touches**: store/types.ts (achievements expanded), engine/achievements.ts (nouveau), App.tsx (hook check), components/Toast.tsx (unlock notif)

**Non-redondant**: ≠ login streak (basé sur défi vs date), ≠ quêtes (invisible vs explicite)

---

## 13. SEASONAL BATTLEPASS LITE — 5 étapes gratuites de progression avec éclats/cosmetics

**Pitch**: Chaque saison, une "feuille de route" simpliste: 5 niveaux (gagne 1 point par match, 20 points = level up). Niv 1 = +20éclats, 2 = pad theme, 3 = +15éclats, 4 = avatar emoji, 5 = +25éclats+cosmetic. Atteindre niv 5 = "saison complétée" badge de prestige.

**Mécanisme**:
- Store: `Player.season.battlepassProgress: number`, `battlepassClaimed: boolean[]` (5 étapes)
- Hook dans `recordMatch`: season.battlepassProgress += 1 (chaque match), si multiple de 20 → level++, check unlock reward
- UI: Page "Avancées Saison" avec 5 barres (0-20), boutons "Réclamer" (greyed)
- Modal claim: affiche reward, set battlepassClaimed[level]=true
- Migration v21: init battlepassProgress=0, battlepassClaimed=[]

**Pourquoi c'est cool**: Sensation de progression visible, cap psychologique (5 étapes c'est fini), encouragement play-every-day sans grind hardcore.

**Complexité**: Moyenne (tracker progression, claim logic, UI 5-rows)  
**Touches**: store/types.ts (season.battlepass*), ranked/SeasonRolloverModal.tsx (page), App.tsx (hook)

**Non-redondant**: ≠ quêtes (continu vs objectifs), ≠ saisons (exploite saisons comme cadre)

---

## 14. RARITY MILESTONE UNLOCK — Débloquer cartes rares spécifiques si on atteint des jalons de raretés

**Pitch**: Tracker total de rares/epics collectées. Atteindre 5 rares → unlock "Rare Quest" (mini-quête: "gagne 5 matchs Constellation" → +30 éclats). Atteindre 10 → unlock nouveau thème HUD "Quantum". Atteindre 15 → unlock avatar cosmétique légendaire.

**Mécanisme**:
- Store: `Player.raresMilestones: {5: true, 10: true, ...}`, tracker lazily dans types
- Hook lors du pack open ou craft: si newCard.rarity==='rare' → count rares total en boucle, check contre `RARITY_MILESTONES = {5: 'quest_rare', 10: 'theme_quantum', 15: 'avatar_legend'}`
- Toast "🎯 10 rares collectées! Thème Quantum déverrouillé!"
- Migration v21: init raresMilestones = {}

**Pourquoi c'est cool**: Collection-building aspirationnel, variété rewards, rares "deviennent précieux", motif réachievable.

**Complexité**: Faible-Moyenne (count rares, milestone check)  
**Touches**: store/types.ts, engine/economy.ts (rarity counter helper), pages/ShopPage.tsx (hook), components/Toast.tsx

**Non-redondant**: ≠ codex (basé sur raretés vs propriété), ≠ quêtes (invisible vs tracked)

---

## 15. RANKED DUELS WEEKLY LEADERBOARD MINI-PRIZE — Top 10 du leaderboard hebd → 10 éclats

**Pitch**: Chaque lundi 00:00 UTC, générer leaderboard des "top 10" par LP de la semaine passée. Top 3 = +20 éclats, Top 4-10 = +10 éclats. Récompense versée auto. Message de féli "🏅 Top 5 Leaderboard!"

**Mécanisme**:
- Store: `Player.weeklyLeaderboardRank: number | null`, `lastLeaderboardRollover: timestamp`
- Hook dans App.tsx au démarrage: si lastLeaderboardRollover < lundi passé → générer TOP 10 du "virtual leaderboard" (= trier tous les records locaux par LP, prendre top 10 via localStorage des noms joueurs si multi-device serait un pb, mais on est LOCAL uniquement donc c'est juste notre score + IA), check si player in top 10 → award éclats, set weeklyLeaderboardRank, set lastLeaderboardRollover
- UI: Badge dans UserHeader "🏅 Rang 3 Leaderboard" pendant la semaine, disparaît au reset
- Migration: init weeklyLeaderboardRank = null, lastLeaderboardRollover = now

**Pourquoi c'est cool**: Faux leaderboard (on n'a que le joueur local), mais donne l'illusion de compétition, valorise grind LP sans serveur, cosmétique psychologique "je suis classé".

**Complexité**: Faible (check player position dans array trie, award simple)  
**Touches**: store/types.ts, App.tsx (hook), UserHeader.tsx (badge), migration v21

**Non-redondant**: ≠ LP/saisons (récompense bonus vs structure classement)

---

# TOP 3 RECOMMANDÉS

Classement par ratio **impact-utilisateur** / **effort-dev**:

## 🥇 #4 PITY TIMER
- **Impact**: Supprime la frustration "10 commons d'affilée" → satisfaction immédiate
- **Effort**: Faible (~15 min, 1 variable + 1 condition)
- **Adhérence**: Psycho mobile éprouvée (FGO, Genshin, etc.)
- **Pourquoi d'abord**: Low-hanging fruit, huge QoL, redynamise pack-opening

## 🥈 #3 WEEKLY QUEST BOARD
- **Impact**: Dirige redécouverte modes, rituels addictifs, dopamine structurée
- **Effort**: Moyenne (~4h, composant + hooks multiples)
- **Adhérence**: Addictif "que faire ce weekend?", élargit playtime
- **Pourquoi 2e**: Engagement durable, scalable (ajouter quêtes est trivial)

## 🥉 #2 DAILY FIRST WIN
- **Impact**: Rituel quotidien, "raison d'ouvrir l'app", boost éclats légitime
- **Effort**: Faible (~20 min, 1 variable, 1 badge)
- **Adhérence**: Cadence "une fois par jour"
- **Pourquoi 3e**: Fait entrer dans routine, super pour session-starter

**Combinaison synergique**: Ces 3 crée une boucle Daily (1er win)→Weekly (quêtes thématiques)→Pity (encouragement packs) sans grind.

---

## NOTES IMPLÉMENTATION

- **Éviter**: idées côté serveur (leaderboard VRAI, matchmaking, comptes) → on est 100% local
- **Prérequis migrations**: Ajouter une v21/v22/v23 pour chaque système, tester rollover sans crash
- **UI patterns**: Tous les système d'unlock = Toast (coloré) → modal confirmation optionnelle (garder léger)
- **localStorage limits**: ~5-10 MB typique ; avec Player object étendu, vérifier si pas > 2 MB régulièrement (fragments+quests+achievements accumulent)
- **Réutilisable**: Chaque idée est indépendante (zero dépendances croisées) → pick-and-choose

---

**Fin du document.**
