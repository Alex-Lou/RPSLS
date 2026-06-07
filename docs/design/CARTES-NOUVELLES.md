# RPSLS — Nouvelles cartes bonus (design + prompts d'art)

> Pour Alex. Ce document propose **14 nouvelles cartes** pour Constellation Ranked,
> pensées pour être **non-redondantes** avec les 15 existantes, variées en type,
> rareté et usage. Chaque carte a : sa fiche de design + un **prompt d'art prêt à
> coller** dans ChatGPT/DALL·E/Midjourney pour générer le PNG au bon format.
>
> Le câblage code (cards.ts + rankedRules.ts + i18n + art) se fait ensuite côté
> agent — tu choisis lesquelles on garde, je les intègre dans les decks/packs/loot.

---

## 0. Ce que couvrent DÉJÀ les 15 cartes (pour ne rien dupliquer)

Toutes les cartes actuelles sont **à usage unique**, jouées de la main, effet sur
le **round courant** uniquement :

| Famille | Cartes existantes |
|---|---|
| Protéger 1 lane | Aegis (perte→nul), Anchor (immunité cartes), Second Wind (sauve 1ʳᵉ perte) |
| Booster 1 lane | Precision (+1 favorisé), Surge (double ou rien) |
| Pénaliser l'adv | Curse (−1 si l'adv gagne la lane) |
| Rejouer | Riposte (rejoue 1 lane perdue) |
| Info / reveal | Augur (1 coup adv), Oracle (3 coups adv) |
| Perturber | Vortex (rotation coups adv), Heist (vol carte), Mirror (anti-contre) |
| Global / all-in | Tide (2+ lanes → +1 par victoire), Supernova (sweep ×3 / sinon 0) |
| Gamble | Gambit (pari 2 mana) |

**Trous de design à exploiter** (= mes nouvelles cartes) :
1. **Cartes PASSIVES / permanentes** — restent dans le deck, **toujours actives
   tout le match**, jamais consommées, ne coûtent pas un « jeu » de round. ⚠️
   Nouvelle mécanique (voir §1).
2. **Économie de mana** et **2ᵉ carte par round** (le jeu n'autorise qu'1 carte/round
   aujourd'hui).
3. **Effets multi-lanes** (les actuels sont mono-lane).
4. **Momentum / cross-round** (rien ne lit le round précédent).
5. **Contre / négation** de la carte adverse.
6. **Repositionnement de SES propres coups** (Vortex ne touche que l'adv).
7. **Tutorat / pioche** (aucune carte ne pioche).

---

## 1. Deux nouvelles mécaniques à ajouter au moteur

### A. Cartes PASSIVES (permanentes)
- Nouveau champ sur `RankedCard` : `kind: "active" | "passive"` (défaut `"active"`).
- Une carte passive placée dans le deck est **toujours active** pendant tout le
  match : elle n'est pas piochée/jouée, son effet s'applique automatiquement
  chaque round. Visuellement : affichée en permanence dans une petite barre
  « Passifs actifs » sous le ManaBar.
- Hook moteur : `RankedBattleState` gagne `passives: CardId[]` (déduit du deck au
  `makeBattle`). `applyCardEffects` + la pioche lisent ces passifs.
- **Limite d'équilibrage** : max **1 passif** dans les 3 cartes « main » (sinon
  empilage abusif). À valider.

### B. Type de ciblage étendu
`RankedCard.target` gagne : `"lane-swap"` (choisir 2 lanes à échanger),
`"negate"` (cible la carte adverse), `"none"` (effet immédiat sans cible).

---

## 2. Les 14 cartes

> Légende : **U** = usage unique · **P** = passif permanent · 🎚️ effort
> d'implémentation moteur (★ faible / ★★ moyen / ★★★ élevé).

### ⚪ COMMUNES (1 mana)

#### C1 — Prescience / Foresight · U · 🎚️★
- **Effet** : pioche immédiatement **1 carte** (main +1 ce round, au-delà du cap).
- **Pourquoi** : aucune carte ne pioche aujourd'hui — comble le trou « avantage de
  cartes » à bas coût. Tempo pur, sans toucher au score.
- **Non-redondant** : premier effet de pioche du jeu.

#### C2 — Cadence / Quickstep · P · 🎚️★★
- **Effet (passif)** : ton **plafond de mana passe de 4 à 5** tout le match
  (`mana = min(5, round+1)`).
- **Pourquoi** : premier passif « économie », récompense la construction de deck
  long terme. Active des cartes chères plus tôt.
- **Non-redondant** : seul levier sur l'économie de mana.

#### C3 — Mascarade / Bluff · U · 🎚️★★
- **Effet** : ce round, les cartes d'info adverses (Augur/Oracle/Prophétie) lisent
  un **faux coup** sur toi (un coup aléatoire ≠ ton vrai coup).
- **Pourquoi** : contre le méta « information », crée du mind-game.
- **Non-redondant** : premier effet de **désinformation**.

#### C4 — Boussole / Surveyor · U · 🎚️★★
- **Effet** : révèle **quelle lane** la carte adverse cible ce round (pas le coup —
  la *cible de carte*).
- **Pourquoi** : info d'un type neuf (intel sur les cartes, pas sur les coups).
- **Non-redondant** : Augur/Oracle révèlent des **coups** ; ici on lit une **carte**.

### 🔵 RARES (2 mana)

#### R1 — Permutation / Switch · U · 🎚️★★
- **Effet** : échange **tes propres coups** entre 2 lanes choisies, après le lock.
- **Pourquoi** : repositionnement défensif/offensif de tes coups.
- **Non-redondant** : Vortex tourne les coups **adverses** ; ici ce sont **les tiens**,
  et c'est un **échange ciblé** (pas une rotation).

#### R2 — Sangsue / Leech · U · 🎚️★
- **Effet** : si tu **gagnes** la lane ciblée, l'adversaire **perd 1 point** de son
  total (en plus de ta victoire de lane).
- **Pourquoi** : pression offensive.
- **Non-redondant** : Curse pénalise l'adv **s'il gagne** la lane (défensif) ;
  Leech te récompense **quand tu gagnes** (offensif). Symétrie inversée.

#### R3 — Rempart / Rampart · U · 🎚️★
- **Effet** : **toutes tes lanes** perdues ce round deviennent des nuls (aegis
  global), mais sans gain de point.
- **Pourquoi** : bouton « panique » défensif quand on lit une grosse main adverse.
- **Non-redondant** : Aegis = 1 lane ; Rampart = les 3.

#### R4 — Pillage / Pickpocket · P · 🎚️★★
- **Effet (passif)** : chaque round que tu **gagnes**, pioche **+1 carte** en plus
  de la pioche normale.
- **Pourquoi** : passif « moteur de cartes » qui récompense l'agressivité.
- **Non-redondant** : se greffe sur la règle « pioche en gagnant » (juste +1),
  mais en **permanent**.

### 🟣 ÉPIQUES (3 mana)

#### E1 — Trou noir / Singularity · U · 🎚️★★
- **Effet** : **annule** la carte jouée par l'adversaire ce round (son effet ne se
  produit pas).
- **Pourquoi** : premier vrai **contre**. Crée des duels de cartes.
- **Non-redondant** : Anchor protège 1 lane des effets ; Singularity **annule la
  carte entière** de l'adv.

#### E2 — Prophétie / Prophecy · P · 🎚️★★
- **Effet (passif)** : au début de **chaque** round, révèle **1 coup adverse**
  aléatoire (Augur automatique et gratuit, à vie).
- **Pourquoi** : passif d'info permanent — gros avantage de lecture.
- **Non-redondant** : Augur = one-shot ciblé ; Prophétie = chaque round, gratuit.

#### E3 — Surcharge / Doublecast · U · 🎚️★★★
- **Effet** : ce round, tu peux jouer une **2ᵉ carte**.
- **Pourquoi** : ouvre des combos (ex. Doublecast → Surge + Aegis). Très skill.
- **⚠️ Effort élevé** : le moteur n'autorise qu'1 carte/round → refonte du flux de
  pose de carte (state `cardsPlayed: PlayedCard[]`). À garder pour une passe dédiée.

#### E4 — Conduit / Channel · P · 🎚️★★
- **Effet (passif)** : tes **combos** (triple / trinité) rapportent **+1 bonus** en
  plus.
- **Pourquoi** : passif qui récompense un style « combo » et donne de la valeur aux
  combos cosmétiques actuels.
- **Non-redondant** : se greffe sur `comboBonus` existant, en permanent.

### 🟡 LÉGENDAIRES (4 mana)

#### L1 — Trinité parfaite / Perfect Trinity · U · 🎚️★★
- **Effet** : si tes 3 coups sont **tous différents** (une trinité), tu **gagnes
  automatiquement le round** (verdict forcé en ta faveur). Sinon, la carte est
  gaspillée.
- **Pourquoi** : payoff légendaire **conditionnel** — récompense un setup maîtrisé,
  punit le jeu paresseux.
- **Non-redondant** : Supernova = sweep de lanes ×3 ; Trinity = condition sur **tes
  coups**, pas sur les lanes gagnées.

#### L2 — Chronomancien / Chronomancer · U · 🎚️★★★
- **Effet** : ce round, tu vois **tous les coups adverses** + **sa carte**, PUIS tu
  peux **réassigner 1 de tes coups** avant la résolution.
- **Pourquoi** : la carte « cerveau » ultime — information totale + réaction.
- **⚠️ Effort élevé** : nécessite une sous-phase de réaction (comme Riposte) après
  un reveal anticipé. Passe dédiée.

---

## 3. Prompts d'art (style maison à respecter)

**Format cible** : PNG portrait ~3:4, **cadre arcane sombre doré avec filigranes
aux coins + 4 gemmes losange** (haut/bas/gauche/droite), **fond cosmique
quasi-noir** texturé nébuleuse, **motif central lumineux unique**, god-rays,
braises/particules, **splash art TCG premium**, sujet **centré**, **aucun texte**.
La couleur du motif suit la rareté : commune = cyan/argent · rare = bleu/violet ·
épique = violet/magenta · légendaire = or/ambre intense.

> **PROMPT-SYSTÈME** (à coller en tête de chaque génération, puis ajouter la ligne
> spécifique de la carte) :
>
> *"Ornate dark-fantasy collectible card art, portrait 3:4. Heavy black-and-gold
> filigree frame with four diamond gemstones (top, bottom, left, right) and
> arcane corner flourishes. Deep near-black cosmic nebula background with subtle
> star dust. A single luminous central motif (described below) rendered as
> glowing volumetric energy with dramatic god-rays, sparks and embers. Premium
> trading-card splash art, highly detailed, centered composition, soft vignette,
> NO text, NO letters, NO numbers. Glow palette: {RARITY_COLOR}."*
>
> Remplace `{RARITY_COLOR}` par : commune → `electric cyan and silver` · rare →
> `sapphire blue and violet` · épique → `violet and magenta` · légendaire →
> `radiant gold and amber`.

| Carte | Ligne spécifique à ajouter au prompt-système |
|---|---|
| **Prescience** | *"central motif: a fan of five glowing arcane cards spreading open, a third eye softly opening above them"* |
| **Cadence** | *"central motif: an hourglass overflowing with luminous mana droplets that rise upward like reverse sand"* |
| **Mascarade** | *"central motif: an ornate theatrical mask split half-light half-shadow, wisps of deceptive smoke curling around it"* |
| **Boussole** | *"central motif: a glowing arcane compass/astrolabe with rotating rings, a needle locking onto a distant target glyph"* |
| **Permutation** | *"central motif: two interlocking curved arrows swapping places around a glowing nexus, swirling trails"* |
| **Sangsue** | *"central motif: a crystalline siphon draining a glowing orb of energy into a second brighter orb, droplets of light"* |
| **Rempart** | *"central motif: a triple-layered radiant shield wall forming a protective dome, light deflecting off it"* |
| **Pillage** | *"central motif: a shadowy gloved hand pulling three glowing cards out of a swirling vortex, sleight-of-hand sparks"* |
| **Trou noir** | *"central motif: a black hole accretion disk swallowing a card that disintegrates into light streaks at the event horizon"* |
| **Prophétie** | *"central motif: an open glowing tome with a floating all-seeing eye and three small premonition runes orbiting it"* |
| **Surcharge** | *"central motif: two mirrored energy cards igniting at once, a doubling rune crackling with overloaded power"* |
| **Conduit** | *"central motif: three energy streams braiding into one brilliant channel, resonant geometric combo glyphs"* |
| **Trinité parfaite** | *"central motif: three distinct elemental sigils (fist, mind, serpent) fusing into a perfect radiant triangle"* |
| **Chronomancien** | *"central motif: a regal figure's hand stopping a giant clock, time fragments and rewind arrows frozen mid-air"* |

> Astuce : génère en lot par rareté pour garder la cohérence de teinte. Dépose les
> PNG finaux dans `app/public/Cards Bonus/<id>.png` (mêmes noms que l'`id` : ex.
> `prescience.png`). Le crop maison (`CARD_ART_CROP_SCALE`) absorbe le liseré blanc.

---

## 4. Plan d'intégration (trié par effort — je code dans cet ordre)

**Lot 1 — aucun changement moteur lourd (★ / ★★), à faire en premier :**
Prescience, Cadence, Mascarade, Boussole, Permutation, Sangsue, Rempart, Pillage,
Trou noir, Prophétie, Conduit. → 11 cartes, couvrent toutes les raretés.
Chacune = entrée `cards.ts` + branche dans `applyCardEffects`/pioche + i18n + art.
Les passifs (Cadence, Pillage, Prophétie, Conduit) demandent le hook §1A (une
seule fois), réutilisé ensuite.

**Lot 2 — refonte de flux (★★★), passe dédiée :**
Surcharge (2ᵉ carte/round), Chronomancien (sous-phase réaction), Trinité parfaite
(verdict forcé — ★★ en fait, peut monter dans le Lot 1).

**Répartition packs/loot suggérée** : les communes/rares entrent dans le pool de
pack normal ; garder **1 légendaire (Chronomancien)** en récompense de **fin de
saison** (non-craftable) pour le prestige ; **Prophétie** en palier Codex 15/15.

---

## 5. Ce dont j'ai besoin de toi

1. **Valide/retire** des cartes (dis-moi lesquelles tu gardes).
2. Génère les PNG avec les prompts ci-dessus → dépose dans `app/public/Cards Bonus/`.
3. Je câble le Lot 1 (cards.ts + rankedRules + i18n + packs/codex), test device, release.
4. Le Lot 2 (Surcharge/Chronomancien) en passe dédiée si tu les veux.
