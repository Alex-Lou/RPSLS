# Arène Constellation Pro — Audit UX + Disposition cible « niveau Hearthstone »

**Date :** 2026-06-12 · **Statut : PROPOSITION — à valider par Alex avant implémentation**
(Le pad/BoardFillSlot a un historique de pièges WebView — on ne le refond qu'avec un plan validé.)

---

## 1. Inventaire EXHAUSTIF des éléments présents en match

### Zone haute (fixe, portal body)
| # | Élément | Rôle | État |
|---|---------|------|------|
| 1 | **Strip adversaire** (portal `z-[55]`) | avatar, nom persona, HP bar segmentée, mana+pips, 🂠 main, constellation/Voie, chips utility joués, peek Augur | OK, dense mais lisible |
| 2 | **Burger** ☰ (flottant) | drawer + « Quitter Arena » | à terme : intégrer au style themed |

### Pad central (BoardFillSlot — hauteur mesurée)
| # | Élément | Rôle | État |
|---|---------|------|------|
| 3 | Rangée lanes ADV (3 slots) | créatures : glyphe, nom, HP bar, badges ⚔/❤, halos combat, anims (slam, secousse, sparks, onde, 🎭, mort) | slots VALIDÉS — ne pas retoucher la taille |
| 4 | **Centre pad** | bulle phase (Tour N / Sorts / Combat…), chip queues intent au reveal | remonté quand queues (fait) ; sous-utilisé le reste du temps |
| 5 | Rangée lanes JOUEUR (3 slots) | + ghosts summon « en attente », croix ✕ undo, stickers sorts coin sup-gauche, labels ciblage ✦ | OK |

### Zone basse (plan phase)
| # | Élément | Rôle | État |
|---|---------|------|------|
| 6 | **Strip you** | 3 lignes (Voie/⭐ → ❤ bar → ⋙ mana+🂠+T), aura de Voie perso, chips utility en éventail à droite | refondu (3 lignes) — à valider |
| 7 | **Picker moves** (5 glyphes RPSLS) | invocation directe sur lane | OK |
| 8 | **Main** (cartes en éventail) | tap = inspect/cast, coût mana, raretés | éventail plat, cartes petites |
| 9 | **Fin de tour** (bouton) | lock du tour | hiérarchie faible — pas assez « LE » bouton |
| 10 | « Mana planifié x/y » (texte) | budget du tour | texte flottant peu intégré |
| 11 | Logs 🐛 (flottant) | debug overlay | dev-only, position réglée |

### Overlays / moments
| # | Élément |
|---|---------|
| 12 | ArenaSpellsReveal (croupier : sorts adverses top-right, à toi bottom-left) |
| 13 | BigCardReveal (carte zoomée au centre), HeistAnim (vol Larcin), flash écran héros touché (rouge/doré), chips ABSORBÉ/ESQUIVÉ/PERCÉ/DÉVIÉ, popups ±N, MatchSplash, SuddenDeath (but d'or), MatchEnd, ArenaCardInspect (modal carte), fiche Voie (long-press lobby) |

## 2. Diagnostic (où on perd du « niveau Hearthstone »)

1. **Hiérarchie zone basse** : strip you / picker / main / Fin de tour / mana planifié = 5 éléments empilés qui se disputent l'attention. Hearthstone n'a QUE la main (énorme) + le bouton de tour (énorme, à droite).
2. **Fin de tour** : bouton banal dans le flux — devrait être LE point d'ancrage visuel fixe (rond doré, à droite, pulse quand tout est joué).
3. **Mana** : pips minuscules ; Hearthstone = cristaux lisibles d'un coup d'œil. « Mana planifié » devrait vivre SUR le bouton Fin de tour (badge « coût du tour »).
4. **Main** : éventail plat, cartes uniformes ; pas de courbe, pas de mise en avant de la carte touchée (scale au survol/drag).
5. **Centre pad vide** hors reveal — l'œil n'y revient pas naturellement.

## 3. Disposition CIBLE (proposition)

```
┌──────────────────────────────────────────┐
│ [☰] [════ STRIP ADVERSAIRE ════]         │ fixe
│ ┌──────────── PAD (inchangé) ──────────┐ │
│ │   [L0]      [L1]      [L2]   (adv)   │ │
│ │        ◈ bulle phase + queues        │ │
│ │   [L0]      [L1]      [L2]   (toi)   │ │
│ └──────────────────────────────────────┘ │
│ [══ STRIP YOU (3 lignes + aura) ══]      │
│ [🪨📄✂️🦎🖖]  picker                 ╭───╮ │
│   ╭─╮╭─╮╭─╮╭─╮╭─╮  main COURBE      │FIN│ │
│   ╰─╯╰─╯╰─╯╰─╯╰─╯  (-12°→+12°)      │ 3⋙│ │
│                     carte active ×1.18╰───╯ │
└──────────────────────────────────────────┘
```

**Étapes proposées (1 build = 1 étape, validation device entre chaque) :**
- **É1 — Cockpit** : « Fin de tour » devient un bouton ROND doré fixe à droite de la main (pulse douce quand mana dépensé ou rien à jouer) avec **badge mana planifié** intégré (`3⋙`). Suppression du texte flottant. Mana du strip : pips → mini-cristaux 💠 plus gros.
- **É2 — Main courbe** : éventail Hearthstone (rotation −12°→+12°, overlap, translateY parabolique), carte touchée **scale 1.18 + remonte** au-dessus des voisines ; les autres s'écartent. Transform-only (GPU).
- **É3 — Pad ambiance** : au centre, filigrane constellation de la Voie très subtil (opacity ~0.05) pour habiller le vide hors reveal ; glyphes créatures +8–10 % DANS les slots (taille slots INCHANGÉE).
- **É4 — Burger match** : remplacer le flottant par l'InlineBurger themed docké au coin du strip adversaire.

**Interdits respectés** : taille des slots/lanes, BoardFillSlot, mécanique pad — INTOUCHÉS.

---

✅ **Valide les étapes (ou réordonne/retire)** et je les implémente une par une.
