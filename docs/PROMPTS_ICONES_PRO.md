# Prompts — Mini-icônes Constellation Pro (zéro émoticône)

**Date :** 2026-06-12 · **But :** remplacer TOUS les émojis de la page Pro (lobby validé par Alex) par de vraies mini-icônes : 5 Voies, 3 monnaies, 6 fonctionnelles.

**Format commun (à coller en fin de chaque prompt) :**
```
Small game UI icon, 512×512 PNG with FULLY TRANSPARENT background. Bold readable silhouette designed to stay crisp at 20–48 px. Dark-fantasy neon mobile-game style: deep charcoal base, vivid rim-light, subtle inner glow, NO text, NO frame, NO background. Centered, slight 3/4 depth, soft top-left key light.
```

**Wiring :** déposer dans `app/public/Pro Icons/<nom>.png` → je câble ensuite (`MoveGlyph`-like + CurrencyBadges + boutons lobby).

---

## A. Les 5 Voies (couleurs = palettes du jeu)

### 1. `voie-montagne.png` — Pierre 🪨
```
A jagged mountain peak carved from dark basalt, amber-orange (#b45309) magma veins glowing in its cracks, light stone-grey (#d6d3d1) rim-light on the ridges. Massive, immovable, fortress-like feel.
```

### 2. `voie-foret.png` — Feuille 📄
```
A single elegant leaf shaped like a living blade of parchment, luminous emerald (#10b981) veins, tiny glowing spores drifting off its edge, jade rim-light. Organic, calm, regenerative feel.
```

### 3. `voie-tranchant.png` — Ciseau ✂️
```
Two crossed curved blades forming an open scissor X, polished steel with crimson-rose (#f43f5e) energy along the cutting edges, spark at the crossing point. Sharp, aggressive, piercing feel.
```

### 4. `voie-mirage.png` — Lézard 🦎
```
A sleek lizard silhouette mid-dash leaving a double after-image, iridescent violet (#a78bfa) to cyan (#22d3ee) gradient shimmer, faint heat-haze ripples around it. Elusive, shifting, dodge feel.
```

### 5. `voie-cosmos.png` — Spock 🖖
```
The Vulcan salute hand silhouette made of deep indigo (#6366f1) starfield, tiny white stars inside the hand shape, sky-blue (#38bdf8) cosmic rim-light, one small orbit ring crossing behind. Logical, cosmic, untouchable feel.
```

---

## B. Les 3 monnaies

### 6. `monnaie-eclats.png` — Éclats (💎 actuel)
```
A faceted crystal shard cluster of three gems, vivid teal-cyan (#22d3ee) with deep blue cores, bright specular sparkle on the main facet. Premium currency feel, instantly readable as "gems".
```

### 7. `monnaie-poussiere.png` — Poussière (✨ actuel)
```
A small swirling pinch of magical dust rising from a tiny pile, violet-fuchsia (#e879f9) particles with white sparkle highlights, soft motion trail. Crafting-resource feel.
```

### 8. `monnaie-etoiles.png` — Étoiles (✦ actuel)
```
A four-pointed golden star (#f59e0b) with a faceted metallic surface like a coin-medal, warm amber glow, two tiny companion sparkles. Prestige currency feel.
```

---

## C. Fonctionnelles (page Pro)

### 9. `pro-entrainement.png` — CTA Entraînement (⚔️ actuel)
```
Two crossed training swords with golden (#fcd34d) blades and dark hilts, small impact spark at the crossing, energy wisps. Battle-ready, inviting CTA feel.
```

### 10. `pro-deck.png` — Gérer mon Deck (🎴 actuel)
```
    A fanned stack of three trading cards seen at an angle, top card glowing fuchsia-violet (#c084fc) with a tiny constellation pattern on its back, crisp card edges. Deck-building feel.
```

### 11. `pro-match-rapide.png` — Match rapide (🌐 actuel)
```
A stylized globe wrapped by one fast orbit ring with a comet trail, violet (#a78bfa) continents glow on dark sphere, speed-line accents. Online quick-match feel.
```

### 12. `pro-tournoi.png` — Tournoi Pro (🏆 actuel)
```
A championship trophy cup with angular esport-style handles, gold (#f59e0b) body with fuchsia (#e879f9) gem inlay at the center, subtle victory glow rays. Tournament prestige feel.
```

### 13. `pro-regles.png` — Règles (📖 actuel)
```
An open spellbook with softly glowing cyan (#38bdf8) pages, tiny floating rune symbols rising from the spread, dark leather cover with star emblem. Knowledge / how-to feel.
```

### 14. `pro-bonus-voie.png` — badge Bonus Voie (🛡 et co.)
```
A compact heater shield with a four-pointed star cut out of its center glowing fuchsia (#e879f9), dark gunmetal shield body with violet rim-light. Passive-bonus badge feel.
```

---

**Cohérence du set :** mêmes proportions (l'objet remplit ~80 % du canvas), même éclairage (key light haut-gauche), même intensité de glow — générer idéalement dans une seule session pour garder le style uniforme.

---

## D. Détails de la Voie — 4 icônes de fiche (Alex 2026-06-13)

Remplacent les émojis 🎯 ✅ ⚠️ 🌟 dans le panneau dépliable « Ma Voie ». **Rendues TRÈS petites (16–22 px)** → motif UNIQUE, ultra-lisible, code couleur sémantique. Déposer dans `app/public/MenuIcons/IconConstellationPro/` (avec les autres). Format commun à coller en fin, MAIS remplacer la ligne taille par : `Bold single-motif silhouette designed to stay perfectly readable at 16–22 px (very small UI chip).`

### 1. `fiche-but.png` — But / Objectif (remplace 🎯) · cyan
```
A clean target reticle with a single arrow striking dead-center, three concentric rings glowing cyan (#22d3ee), a bright white impact spark at the bullseye. Reads instantly as "goal / objective".
```

### 2. `fiche-force.png` — Force (remplace ✅) · émeraude
```
A bold upward-thrusting chevron made of emerald (#34d399) energy, like a rising blade, with a small power-spark at its base. Confident, ascending. Reads as "strength / advantage".
```

### 3. `fiche-faiblesse.png` — Faiblesse (remplace ⚠️) · ambre
```
A cracked shield fragment split by a jagged downward fracture, warning amber-orange (#f59e0b) light seeping from the crack. Reads as "weakness / vulnerability".
```

### 4. `fiche-particularite.png` — Particularité (remplace 🌟) · violet→or
```
A four-pointed starburst with one smaller orbiting spark, radiant gradient from violet (#a78bfa) to gold (#fcd34d), magical shimmer. Reads as "unique signature / special trait".
```

Une fois déposées, je câble les 4 dans `FicheRow` (Voie dépliée) — un prop `iconSrc` remplace l'émoji, fallback émoji conservé si le PNG manque.
