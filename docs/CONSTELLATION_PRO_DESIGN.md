# Constellation Pro — Design lock

**Date :** 2026-06-08
**Statut :** MVP in progress (branche `constellation-pro`)

> Mode CCG séparé (créatures persistantes + sorts + mana scalable). **Ne touche PAS au Ranked actuel.** Réutilise tout ce qui peut l'être (thèmes, fonds, pads, avatars, deck, art, codex, monnaies).

---

## Décisions verrouillées (cf. AskUserQuestion session 2026-06-08)

| Aspect | Choix |
|---|---|
| Match length | **Standard** — HP 20 / mana cap 10 / 10-15 min cible |
| Turn model | **Simultané** (RPSLS-style) — les deux planifient en parallèle, lock, resolver fire |
| Card types | **Créatures + sorts** — les 5 moves RPSLS deviennent des créatures persistantes avec ATK/HP ; les 46 cartes existantes deviennent des sorts |
| Mode integration | Nouvelle entrée menu **séparée** ; deck partagé avec le Ranked (8 cartes débloquées) |

---

## Boucle de jeu

```
Tour 1 : mana max = 1 chez les deux
  ├─ planification simultanée (joueur + CPU en parallèle)
  │   ├─ joue 0+ sorts (budget mana)
  │   ├─ summon 0+ créatures sur lanes (1 mana chacune)
  │   └─ termine son tour
  ├─ both locked → resolver
  │   1. spells fire (defensifs → offensifs)
  │   2. créatures arrivent sur les lanes
  │   3. lane combat — chaque paire s'attaque
  │   4. dégâts au héros si lane indéfendue
  │   5. HP check
  └─ HP 0 → fin

Tour 2 : mana max = 2 chez les deux
  ├─ chacun pioche 1 carte
  ├─ existing créatures (survivantes) restent sur leurs lanes
  ├─ planification simultanée
  └─ resolver
...

Mana cap à 10, match continue jusqu'à HP 0 d'un côté.
```

---

## Système de créatures

Quand tu joues un coup RPSLS (rock/paper/scissors/lizard/spock), tu **summon une créature** sur la lane choisie. Elle reste sur la lane jusqu'à mourir.

| Move | ATK | HP | Counter (+1 ATK contre) |
|---|---|---|---|
| 🪨 Rock | **3** | 2 | Scissors, Lizard |
| 📄 Paper | **2** | 3 | Rock, Spock |
| ✂️ Scissors | **4** | 1 | Paper, Lizard |
| 🦎 Lizard | **2** | 2 | Paper, Spock |
| 🖖 Spock | **3** | 3 | Scissors, Rock |

Coût mana de summon : **1 mana par créature** (uniforme MVP).

**Une seule créature par lane par côté.** Si tu summon sur une lane déjà occupée par toi, l'ancienne est **remplacée** (meurt, sans damage).

**HP persistant** : une créature blessée garde ses HP réduits entre les tours.

---

## Combat de lane (resolver)

À la fin de chaque tour (après spells + summons), chaque lane résout :

```
lane = (your_creature, opp_creature)

if both exist:
  your_dmg_in = opp.atk + (1 if opp.counters(your.move) else 0)
  opp_dmg_in = your.atk + (1 if your.counters(opp.move) else 0)
  your_creature.hp -= your_dmg_in     (simultaneous)
  opp_creature.hp  -= opp_dmg_in
  if your_creature.hp <= 0 → dies
  if opp_creature.hp  <= 0 → dies

elif you have, opp doesn't:
  opp_hero.hp -= your.atk             (lane was undefended)

elif opp has, you don't:
  your_hero.hp -= opp.atk

else: nothing (both empty)
```

**Note** : le bonus de +1 ATK pour les "counters" RPSLS donne au mode une vraie identité (l'attaque + intelligence du matchup compte autant que les stats).

---

## Sorts (les 46 cartes existantes adaptées)

Chaque carte a un nouvel effet **arena-specific**. Les anciens effets ranked (lane wins / round wins) sont remplacés par des effets HP/ATK/board.

### Adaptations MVP (~15 cartes prioritaires)

| Carte | Coût | Effet Arena |
|---|---|---|
| **Aegis** | 1m | Bouclier divin sur 1 cible (créature alliée ou héros) → annule la prochaine source de dégâts |
| **Precision** | 1m | +2 ATK ce tour sur 1 créature alliée |
| **Anchor** | 1m | Ma créature est intouchable par les sorts ennemis ce tour |
| **Second-wind** | 1m | Heal +4 HP au héros allié |
| **Prescience** | 1m | Pioche 2 cartes |
| **Surge** | 2m | +3 ATK ce tour sur 1 créature alliée |
| **Curse** | 2m | -2 ATK ce tour sur 1 créature ennemie |
| **Mirror** | 2m | Copie une créature ennemie sur une lane alliée vide |
| **Riposte** | 2m | Si ma créature meurt ce tour, son tueur meurt aussi |
| **Augur** | 2m | Voir la main adverse (4 prochaines cartes) |
| **Heist** | 3m | 3 dégâts au héros adverse + pioche 1 carte |
| **Tide** | 3m | +1 ATK ce tour à TOUTES mes créatures |
| **Oracle** | 3m | Pioche 3 cartes |
| **Vortex** | 3m | Échange 2 créatures ennemies entre leurs lanes (rotate cw) |
| **Supernova** | 4m | 6 dégâts ciblés (créature ou héros) |

### Adaptations Phase 2 (~30 cartes restantes)

Les autres cartes (Lot 1 + V3) reçoivent leur effet arena dans une seconde passe. Pour le MVP elles affichent "Indisponible en Arena" dans la main.

### Cartes spécifiques au mode (Phase 3+)

Pool de **cartes Arena-only** (créatures uniques, sorts d'archétype) — débloquables via packs Arena dédiés. Pas dans le MVP.

---

## Conditions de victoire

- **Premier héros à 0 HP perd.**
- Tie possible si les deux héros tombent à 0 au même tour (rare).
- Match peut durer 5-20 tours selon agressivité.

---

## Architecture code

```
app/src/arena/
├── arenaTypes.ts           # HeroState, Creature, BoardState, ArenaTurn
├── arenaRules.ts           # resolveTurn(), creatureCombat(), heroDamage()
├── arenaCardEffects.ts     # ARENA_CARD_EFFECTS table (CardId → spell handler)
├── arenaAI.ts              # CPU brain (simple greedy MVP)
├── ArenaGame.tsx           # top-level orchestrator (state, lifecycle)
├── ArenaBoard.tsx          # board UI (heroes, lanes, creatures)
├── ArenaPlanPhase.tsx      # planning phase (drag cards, summon, lock)
├── ArenaResolve.tsx        # animated resolver (spells → summons → combat)
└── ArenaPage.tsx           # menu entry point
```

**Réutilise** (pas de duplication) :
- `ranked/cards.ts` — registry des 46 cartes, art paths, glyphs, i18n keys
- `ranked/CardImage.tsx`, `cardArt.tsx` — rendu visuel des cartes
- `BattlePad.tsx` — fond du board
- `theme/themes.ts` — palettes, fonts, backgrounds
- `store/store.ts` — `cardCollection`, deck, currencies
- `engine/economy.ts` — éclats/poussière/codex
- `online/playerSync.ts` — sync cloud (Arena stats à ajouter)

**Nouveau dans le store** :
- `arenaStats: { wins, losses, draws }` — tracking séparé du Ranked
- `arenaLp: number` — éventuel ladder arena distinct (Phase 3)

---

## Roadmap (jalonnée)

### MVP Phase 1 — jouable vs CPU (cette session + 1-2 suivantes)
- [x] Branche `constellation-pro`
- [x] Design doc lock
- [ ] `arenaTypes.ts` types fonderie
- [ ] `arenaRules.ts` rules engine (resolver pur)
- [ ] `arenaCardEffects.ts` 15 cartes adaptées
- [ ] `arenaAI.ts` CPU basique greedy
- [ ] `ArenaGame.tsx` + `ArenaBoard.tsx` + `ArenaPlanPhase.tsx` UI minimale
- [ ] Entrée menu `PlayPage` → bouton "Constellation Pro"
- [ ] i18n EN+FR pour le mode

### MVP Phase 2 — polish (session future)
- [ ] Animations de combat (créatures qui s'attaquent, qui meurent)
- [ ] Effet visuel des sorts (Aegis bouclier, Supernova explosion, etc.)
- [ ] Reveal phase cinématique
- [ ] Match end screen + récompenses (éclats / mastery / XP)
- [ ] Adapter les 30 cartes restantes

### Phase 3 — content & online (futur)
- [ ] Cartes Arena-only (10-15 créatures/sorts exclusifs)
- [ ] Packs Arena séparés
- [ ] Online multiplayer (réutilise WebSocket archi existante)
- [ ] Ladder Arena séparé du Ranked

---

## Pièges connus / risques

- **Power creep** : multi-card par tour permet des combos de fou. Tester d'abord, équilibrer après.
- **Game length** : si trop long (>15 min), réduire HP de départ à 15.
- **CPU AI** : un vrai CCG AI est dur. MVP = greedy (joue toujours la carte la plus chère qu'il peut, summon sur lane vide, attaque héros si lane libre). Itérer.
- **UI density** : 3 lanes × 2 côtés × créatures + sorts + main + mana + HP héros = beaucoup d'info à afficher. Préparer un layout généreux.
- **Cohabitation** avec les 30 cartes non-adaptées : afficher "Bientôt en Arena" pour éviter qu'elles se jouent et explosent le jeu.
