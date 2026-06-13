# Constellation Pro — Refonte « CCG Expert »

**Date :** 2026-06-13 · **Statut :** §3 quick-wins IMPLÉMENTÉS · §1 économie + §2 fusions = PROPOSITIONS à valider par Alex avant code.

---

## §3 — LOGIQUE DES ENSEMBLES (le point CRITIQUE) — audit du code réel

### 3.A Ce qui était limité SANS nécessité → **LEVÉ (implémenté 2026-06-13)**

| Limite | Avant | Maintenant | Justification |
|---|---|---|---|
| Sorts lane / tour | 3 max | **∞ (mana = la limite)** | Aucun CCG mature ne cappe les sorts/tour ; le mana (cap 8) régule seul |
| Sorts utility / tour | 2 max | **∞ (mana)** | idem — c'est ce cap qui brûlait Second Souffle avant le fix |
| Même carte sur même cible | interdit | **AUTORISÉ avec 2 copies** | 2× Précision = +4 ATK sur une créature : play légitime. L'abus (2 casts d'1 copie) reste bloqué par « 1 copie = 1 cast » |

### 3.B Les règles de composition VÉRIFIÉES (logique irréfutable, code à l'appui)

**Sur une même lane / créature — TOUT s'empile librement, sauf :**
- ✅ Aegis + Anchor + Riposte + Précision + Surge + Sève… **cumulables sans limite** sur la même créature (chaque effet est un champ indépendant : `divineShield`, `anchored`, `ripostePrimed`, `atkBuff` additif, `hp`)
- 🚫 **Spock Détaché** : ignore TES buffs (Aegis/Précision/Surge/Tide/Bénédiction fizzlent sur lui) — c'est son malus de Voie, compensé par Logique
- 🛡 **Logique (Spock) & Anchor** : bloquent les sorts HOSTILES ciblés (Curse, Supernova-lane, Jet de Caillou, Toile, Trou Noir) — PAS les sorts globaux (Gravité, Vortex, Genèse, Purge)
- ⚔ **Tranchant (Ciseau)** : perce le 1er bouclier ; **LAME** (finisher) perce tout

**Par manche (intent) :** 1 invocation max par lane (remplaçable avant lock) ; sorts illimités (mana) ; Finisher 1×/match.

**Invariants moteur vérifiés :** badge ⚔ = `creatureEffectiveAtk` (la MÊME fonction que le combat — Toile→0, Lente→0, Fanaison, Émoussé exacts) · consommé == appliqué (truncate avant removeSpent) · constellation resync post-combat · caps UI = caps engine = caps IA (source unique).

### 3.C Les 5 Voies — bonus/malus (équilibre actuel)

| Voie | Bonus Voie | Force naturelle | Faiblesse naturelle |
|---|---|---|---|
| 🪨 Montagne | Provocation ×2 charges | Mur défensif (3 PV, dévie) | ATK 1, Lente à la pose |
| 🌿 Forêt | Fanaison ralentie (−1/2 tours) | Étouffe la Provoc adverse | 1 PV, ATK qui fond |
| ✂️ Tranchant | +1 PV (survit un échange) | ATK 4, perce bouclier | Fragile, Émoussé post-combat |
| 🦎 Mirage | Esquive ×2 charges | Survie garantie, polyvalent | Aucun pic offensif/défensif |
| 🖖 Cosmos | +1 ATK (3 total) | Tanky + immune sorts ciblés | Détaché : ignore TES buffs |

Lecture : chaque Voie a UN axe fort + UN handicap structurel — pas de Voie dominante. À surveiller en playtest : Cosmos (Logique + 3 PV + ATK 3) est la plus autonome.

---

## §1 — ÉCONOMIE DES CARTES (proposition à valider)

**Actuel :** deck = TES choix (8+), copies max 2 (supernova/oracle/heist : 1), pioche 2/tour (+1 si kill), main cap 7 (8 sur vol Larcin), défausse recyclée dans le deck, Finisher 1×/match hors deck.

**Proposition « expert » — copies par RARETÉ (standard CCG) :**

| Rareté | Copies deck | Usages/partie | Notes |
|---|---|---|---|
| ⚪ Commune | **3** | ∞ (recyclage) | volume de jeu, consistance |
| 🔵 Rare | **2** | ∞ | |
| 🟣 Épique | **2** | ∞ | |
| 🟡 Légendaire | **1** | **1× par partie** (pas de recyclage : va en `exilée` au lieu de défausse) | Supernova, Roue, Phénix, Singularité, Juge, Genèse deviennent des MOMENTS |
| ✦ Finisher | hors deck | 1×/match | inchangé |

+ **Mulligan T1** (remplace jusqu'à 2 cartes de la main de départ, une fois) — standard expert, réduit la loterie d'ouverture.
+ Deck size recommandé : **12–16 cartes** choisies (actuel ~8 = cycles trop vite avec le recyclage).

## §2 — FUSIONS DE CARTES (proposition à valider)

**Mécanique :** en phase de planif, **drag une carte SUR une autre carte fusible** de ta main → les deux se consument, la carte fusionnée apparaît (coût = somme −1). Animation : les 2 cartes aspirées en vortex au centre de la main → flash blanc → SLAM de la nouvelle carte (scale overshoot + onde de choc + 12 particules) — transform/opacity only, même budget perf que les anims actuelles.

**Table de fusions v1 (8 recettes lisibles) :**

| A + B | = Fusion (coût) | Effet |
|---|---|---|
| Précision + Surge | **Frappe Parfaite** (2) | +6 ATK ce tour sur une créature |
| Aegis + Anchor | **Bastion** (1) | Bouclier + Ancre + Provoc refill sur une créature |
| Jet de Caillou + Jet de Caillou | **Avalanche** (1) | 3 dégâts sur DEUX créatures adverses |
| Sève + Second Souffle | **Source Vitale** (1) | +3 PV créature ET +3 PV héros |
| Oracle + Coup d'Œil | **Omniscience** (2) | Pioche 3 + révèle TOUTE la main adverse 1 tour |
| Toile + Curse | **Cocon** (3) | La créature adverse ne peut NI attaquer NI être buffée 2 tours |
| Supernova + Gravité | **Apocalypse** (5) | 4 dégâts à TOUTES les créatures adverses + 4 au héros |
| Larcin + Mascarade | **Imposteur** (3) | Vole la PROCHAINE carte que l'adversaire jouera |

Garde-fous : fusion = 2 cartes de TA main (jamais du deck), résultat non-fusible (pas de chaînes), légendaires non-fusibles.

---

**Verdict demandé à Alex :** §1 (copies par rareté + mulligan + exil légendaires) — oui/non/ajuster ? §2 (fusions v1, 8 recettes) — oui/non/quelles recettes ? §3 est actif dès le prochain build.
