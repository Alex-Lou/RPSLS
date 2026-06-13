# Prompts — Icônes Menus, Lanes Constellation & Atouts Classé

**Date :** 2026-06-13 · Demande Alex (#4, #5, #6). Style cohérent avec l'ambiance **RPSLS cosmique néon** (violet/fuchsia/cyan, énergie, profondeur stellaire) — pour remplacer les émojis et harmoniser les icônes actuelles jugées trop quelconques.

**Bloc format commun (à coller en fin de CHAQUE prompt) :**
```
Game UI icon, 512×512 PNG, FULLY TRANSPARENT background. Bold readable silhouette, crisp from 24 to 64 px. Cosmic-neon mobile-game style: deep charcoal/indigo base, vivid neon rim-light, subtle inner glow and star-dust, NO text, NO frame, NO background. Centered, slight 3/4 depth, soft top-left key light. Cohesive set — same proportions, lighting and glow intensity across all icons (generate in one session).
```

---

## #4 — Les 3 lanes de Constellation : FORCE · SAGESSE · RUSE

Affichées dans la règle « Le principe » (Constellation normale). Déposer dans `app/public/MenuIcons/Lanes/`.

### `lane-force.png` — FORCE (rouge-cramoisi)
```
A clenched gauntlet fist punching forward, crimson-red (#f43f5e) energy bursting around the knuckles, a small shockwave ring. Raw power. Reads as "strength / force".
```
### `lane-sagesse.png` — SAGESSE (cyan-azur)
```
A serene third eye inside a hexagon, azure-cyan (#22d3ee) glow with tiny orbiting runes, calm radiance. Reads as "wisdom / insight".
```
### `lane-ruse.png` — RUSE (violet-fuchsia)
```
A sly fox-mask / domino mask wreathed in violet-fuchsia (#a78bfa→#e879f9) wisps, one glinting eye, mischievous spark. Reads as "cunning / trickery".
```

---

## #5 — Icônes des modes du menu principal + Défi du jour

Remplacent les icônes actuelles (`/MenuIcons/*.png`). Déposer dans `app/public/MenuIcons/Modes/`.

### `mode-entrainement.png` — Entraînement (émeraude)
```
A neon training dummy / dojo target post crossed by two glowing practice batons, emerald (#34d399) light, calm focused vibe. Reads as "practice / training". No risk, no stakes feel.
```
### `mode-en-ligne.png` — En ligne (violet-cyan)
```
A glowing wireframe globe wrapped by two fast orbit rings with comet trails, violet (#a78bfa) continents and cyan (#22d3ee) network nodes pulsing. Reads as "online / live versus".
```
### `mode-constellation.png` — Constellation (indigo stellaire)
```
Three vertical star-lanes rising in parallel, connected by faint constellation lines into a crown shape, indigo (#6366f1) to sky-blue (#38bdf8) starfield. Reads as "3 parallel lanes / constellation".
```
### `mode-constellation-classee.png` — Constellation Classée (or + indigo)
```
The same three star-lanes but crowned by a small golden laurel + a ranked-tier gem at the top, gold (#f59e0b) over indigo (#6366f1) starfield, prestige glow. Reads as "ranked constellation".
```
### `mode-classe.png` — Classé simple (acier + ambre)
```
Two crossed RPSLS hands (rock fist vs open paper) over a ranked shield with a star, steel-blue and amber (#f59e0b) energy, competitive edge. Reads as "classic ranked 1v1 duel".
```
### `defi-du-jour.png` — Défi du jour (ambre-doré)
```
A glowing bullseye target with a small calendar/sun emblem at its center and three orbiting check-marks, warm amber-gold (#fcd34d) radiance, daily-quest energy. Reads as "daily challenge".
```

---

## #6 — Les 4 Atouts du Classé simple

Bonus pré-match du mode Classé 1v1 (remplacent 🔮⚡🛡️🔁). Déposer dans `app/public/MenuIcons/Atouts/`.

### `atout-lecture.png` — Lecture (cyan) · « Révèle le coup probable de l'adversaire »
```
A glowing crystal ball / scrying orb showing a faint ghost-hand inside, cyan (#22d3ee) mist swirling, a single eye reflected on its surface. Reads as "foresight / read the opponent".
```
### `atout-vabanque.png` — Va-banque (jaune électrique) · « La manche vaut 2 points »
```
A lightning bolt striking a doubling "×2" emblem, electric-yellow (#facc15) arcs, high-stakes spark burst. Reads as "all-in / double or nothing".
```
### `atout-garde.png` — Garde (bleu-acier) · « Annule ta 1ʳᵉ manche perdue »
```
A radiant heater shield with a soft pulse barrier, steel-blue (#38bdf8) with white core glow, protective halo. Reads as "guard / negate a loss".
```
### `atout-contre.png` — Contre (violet) · « Rejoue ta 1ʳᵉ manche perdue »
```
Two curved counter-arrows forming a rewind loop around a small RPSLS hand, violet (#a78bfa) motion trails, "replay" energy. Reads as "counter / re-roll".
```

---

**Wiring (une fois les PNG déposés) :** je remplace les émojis/icônes correspondants — `RuleBlock`/lanes (Constellation), `MODE_ICONS` (PlayMenu) + Défi du jour, et `ATOUTS[].glyph` (Classé). Fallback émoji conservé si un PNG manque.
