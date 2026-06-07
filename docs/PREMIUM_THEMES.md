# Nouveaux Thèmes Premium — Plan Design Complet

**Date:** 2026-06-07
**Contexte:** L'app possède 14 backdrops WebGL, 17 pads SVG, et 16 palettes HUD. Tous ces thèmes partagent une esthétique "cosmique/sombre" (espace, éléments, énergie). Pour renouveler l'offre premium, 6 nouveaux thèmes sont proposés — chacun explorant une direction artistique radicalement différente, avec un plan complet (shader, pad, HUD, polices, ambiance UI).

**Critères de sélection :**
- Aucune similarité avec les 14 scènes WebGL existantes
- Identité visuelle forte et immédiatement reconnaissable
- Faisabilité technique avec le pipeline WebGL actuel (1 fragment shader, pas de textures)
- Adapté à une lecture confortable (les menus doivent rester lisibles)
- Justifie un achat premium (qualité supérieure, unicité)

---

## 1. 🪸 CORAL — Récif Abyssal Bioluminescent

**Identité:** Un récif corallien sous-marin, baigné de lumière bioluminescente. Des coraux mous aux formes organiques ondulent doucement. Des anémones pulsent. Des bancs de poissons minuscules (points lumineux) traversent l'écran en groupes. La palette est chaude et saturée — rose corail, orange pêche, turquoise tropical, vert algue. C'est le thème le plus CHAUD du catalogue.

**Pourquoi c'est différent:** Aucun thème existant n'explore le monde sous-marin chaud. Abyss est froid (bleu sombre, abysses). Coral est VIVANT, coloré, organique.

### Backdrop WebGL (shader Coral)
```glsl
// Concept : FBM multi-octave pour simuler des formes coralliennes organiques
// Des "spots" lumineux (anémones) pulsent avec une animation sinusoïdale
// Des bancs de "poissons" (30-40 points lumineux) traversent en vagues
// Fond : dégradé chaud du turquoise profond (#0a1628) au corail sombre (#1a0a0a) en bas
// Coraux : domain warping (FBM de FBM) pour créer des formes noueuses, en rose/orange
// Bioluminescence : points lumineux cyan/vert qui clignotent aléatoirement
```

**Palette HUD:**
- Primary: `#ff6b6b` (rose corail vif)
- Secondary: `#4ecdc4` (turquoise tropical)
- Background: `#0a1628` (bleu profond chaud)

**Polices:** Playfair Display (titres élégants), Cormorant Garamond (corps organique), JetBrains Mono (chiffres)

**Pad SVG — CoralReefPad:**
- Fond dégradé chaud turquoise→corail sombre
- 5-8 formes de coraux (paths SVG organiques avec FBM-like ondulation via animate)
- Anémones : cercles avec pulsation opacity + scale
- Bancs de poissons : 30 cercles regroupés qui se déplacent ensemble (animateTransform translate)
- Bulles qui montent (cercles avec animate cy + opacity)

**Accent:** `from: #ff6b6b, to: #4ecdc4`

**Tagline:** "Un océan de vie, de lumière et de chaleur."

**Prix premium suggéré:** 300 ✦ Stars

---

## 2. 🏭 RUST — Déclin Industriel

**Identité:** Un décor post-apocalyptique. Des structures métalliques rouillées, des poutres, des chaînes. Le sol est couvert de poussière de fer. Des étincelles de soudure éclatent sporadiquement. Une palette monochrome chaude — oxyde de fer (orange rouille, brun, noir). La "beauté dans la désolation".

**Pourquoi c'est différent:** Volcanic et Emberforge sont des thèmes "chauds" mais ils parlent de lave/magma/forge. Rust parle de DÉCLIN — c'est triste, beau, industriel. Aucun thème existant n'a cette esthétique "abandonnée".

### Backdrop WebGL (shader Rust)
```glsl
// Fond : dégradé vertical du noir (#050302) au brun rouille (#1a0e05) en bas
// Structures : lignes épaisses (poutres) en FBM modifié pour créer des rectangles irréguliers
// Rouille : noise à haute fréquence en orange/brun (#8b4513, #d2691e) le long des "joints"
// Étincelles : points blancs qui apparaissent aléatoirement (hash check) et s'éteignent vite
// Poussière : overlay de noise très fin (granulation) sur tout l'écran
// Ambiance : très sombre, juste assez de contraste pour lire le texte
```

**Palette HUD:**
- Primary: `#d2691e` (orange rouille)
- Secondary: `#8b4513` (brun oxyde)
- Background: `#0a0502` (noir industriel)

**Polices:** Bebas Neue (titres massifs, poinçons), Rajdhani (corps), Share Tech Mono (chiffres techniques)

**Pad SVG — RustPad:**
- Fond dégradé noir→brun rouille
- Poutres : rectangles sombres avec bordures dentelées (paths irréguliers)
- Rivets : petits cercles le long des poutres (16-20 rivets)
- Étincelles : cercles blancs qui apparaissent aléatoirement (animate opacity + petite translation)
- Texture grain : overlay de noise via SVG filter feTurbulence (subtil)

**Accent:** `from: #d2691e, to: #8b4513`

**Tagline:** "La beauté naît de ce qui s'effondre."

**Prix premium suggéré:** 300 ✦ Stars

---

## 3. ◼️ VOID — Géométrie Impossible

**Identité:** Le vide absolu. Pas de particules, pas de "scène". Juste des formes géométriques minimalistes qui émergent et disparaissent — lignes blanches fines, cercles parfaits, triangles équilatéraux. Une esthétique "blueprint" ou "wireframe" sur fond noir absolu. Le thème le plus MINIMALISTE du catalogue.

**Pourquoi c'est différent:** TOUS les thèmes existants sont "riches" visuellement (nuages, étoiles, particules). Void est l'anti-thème : presque rien. C'est un choix esthétique fort — le joueur qui achète Void veut le CALME, pas le spectacle.

### Backdrop WebGL (shader Void)
```glsl
// Fond : noir absolu (#000000)
// Lignes : segments blancs fins (stroke-width 1px équivalent) qui apparaissent aléatoirement
//   et vivent 3-5 secondes. Les lignes forment des polygones (triangles, carrés, pentagones).
//   Elles "s'animent" comme si un traceur dessinait en temps réel.
// Cercles : cercles concentriques parfaits qui apparaissent, pulsent une fois, disparaissent
// Règle : jamais plus de 5 formes simultanément. Maximum de vide.
// Animation : extrêmement lente (une nouvelle forme toutes les 2-4 secondes)
```

**Palette HUD:**
- Primary: `#ffffff` (blanc pur)
- Secondary: `#666666` (gris moyen)
- Background: `#000000` (noir absolu)

**Polices:** JetBrains Mono (titres ET corps — cohérence monospace), Space Mono (alternative)

**Pad SVG — VoidPad:**
- Fond noir absolu
- Un seul triangle blanc fin au centre (stroke-width 1px, pas de remplissage)
- Le triangle tourne TRÈS lentement (360° en 60 secondes)
- Parfois, un cercle apparaît, pulse, et disparaît (toutes les 8-12s)
- Parfois, une ligne horizontale traverse (toutes les 15-20s)
- Rien d'autre. Minimalisme total.

**Accent:** `from: #ffffff, to: #666666`

**Light mode spécial:** Ce thème active un "mode clair" minimal — les surfaces UI deviennent transparentes avec bordures blanches fines au lieu des fonds sombres habituels. Le `theme-light` flag CSS déclenche ce comportement.

**Tagline:** "Dans le vide, chaque forme devient un événement."

**Prix premium suggéré:** 400 ✦ Stars (demande un travail UI spécifique pour le mode clair)

---

## 4. 💎 PRISM — Laboratoire de Lumière

**Identité:** Un prisme de verre qui décompose la lumière blanche en arc-en-ciel. Des faisceaux lumineux traversent l'écran en diagonale. Chaque faisceau se divise en ses composantes spectrales (rouge → orange → jaune → vert → bleu → violet) avec un décalage progressif. L'esthétique est SCIENTIFIQUE — épurée, précise, comme une expérience d'optique.

**Pourquoi c'est différent:** Aurora est un thème "lumière" avec des rideaux colorés, mais c'est organique/désordonné. Prism est GÉOMÉTRIQUE et CONTRÔLÉ — la lumière est domptée, mesurée, scientifique. Le thème Quantum est proche mais utilise le plasma bleu, pas la décomposition spectrale.

### Backdrop WebGL (shader Prism)
```glsl
// Fond : noir profond (#050510) avec un léger dégradé radial blanc au centre (le "point lumineux")
// Faisceaux : 3-4 rayons qui partent du centre et traversent l'écran en diagonale
//   Chaque rayon est une ligne blanche fine qui se "divise" spectralement :
//   - À 10% de la source : blanc pur
//   - À 30% : rouge #ff0000, orange #ff7f00, jaune #ffff00
//   - À 50% : vert #00ff00
//   - À 70% : bleu #0000ff, violet #8b00ff
//   - À 90% : les couleurs s'estompent
// Animation : les rayons tournent TRÈS lentement (1 tour complet en ~120 secondes)
// Particules : des "photons" (points blancs) suivent les rayons comme des billes de lumière
```

**Palette HUD:**
- Primary: `#ffffff` (blanc spectral)
- Secondary: `#8b5cf6` (violet — le bout du spectre)
- Background: `#050510` (presque noir, légèrement bleuté)

**Polices:** Inter (corps propre et lisible), Space Grotesk (titres), JetBrains Mono (chiffres)

**Pad SVG — PrismPad:**
- Fond noir profond
- Un cercle blanc lumineux au centre (point source, avec blur)
- 3 lignes diagonales qui partent du centre et se "divisent" en arc-en-ciel (6 lignes parallèles de couleurs différentes avec un offset progressif)
- Les lignes spectrales tournent lentement (animateTransform rotate)
- De petits points blancs suivent les lignes (animateMotion)

**Accent:** `from: #ffffff, to: #8b5cf6`

**Tagline:** "La lumière, décomposée. La science, sublimée."

**Prix premium suggéré:** 350 ✦ Stars

---

## 5. 🖋️ INK — Sumi-e Vivant

**Identité:** Un tableau de calligraphie japonaise sumi-e (encre de Chine). Des coups de pinceau apparaissent sur un fond de papier de riz texturé. L'encre se diffuse légèrement dans le papier (effet de "bavure"). Des idéogrammes abstraits se forment et se défont. Tout est en noir, blanc, et nuances de gris. C'est le thème le plus ARTISTIQUE du catalogue.

**Pourquoi c'est différent:** Aucun thème n'explore l'art traditionnel ou la calligraphie. Chalkboard est proche conceptuellement (tableau, craie) mais l'esthétique est "laboratoire scolaire". Ink est "galerie d'art" — c'est noble, ancien, méditatif.

### Backdrop WebGL (shader Ink)
```glsl
// Fond : beige très clair (#f5f0e8) avec une texture de papier :
//   - Bruit de Perlin à très haute fréquence, très faible amplitude (granulation du papier)
//   - Quelques "fibres" visibles (lignes très fines, opacity 0.05, horizontales légèrement courbes)
// Encre : des "traits de pinceau" apparaissent — courbes de Bézier épaisses au début,
//   qui s'affinent vers la fin (simulation de pression). L'encre "bave" légèrement :
//   - Un blur gaussien de 1-2px autour du trait principal
//   - L'épaisseur du trait diminue avec le temps (l'encre "sèche")
//   - Après 8-10 secondes, le trait s'estompe (opacity decay)
// Animation : un nouveau trait toutes les 3-6 secondes. Maximum 5 traits simultanés.
// Jamais plus de 2 traits qui se croisent au même endroit.
```

**Palette HUD:**
- Primary: `#1a1a1a` (noir encre)
- Secondary: `#8c8c8c` (gris pinceau sec)
- Background: `#f5f0e8` (papier de riz)

**Polices:** EB Garamond (titres — élégance classique), Cormorant Garamond (corps), JetBrains Mono (chiffres)

**Pad SVG — InkPad:**
- Fond beige papier avec texture (SVG filter feTurbulence très subtil)
- 2-3 coups de pinceau (paths avec stroke noir, stroke-width variable via plusieurs paths superposés)
- Les coups de pinceau apparaissent et disparaissent (animate stroke-dashoffset + opacity)
- Un sceau rouge (carré rouge #cc0000 avec "印" ou un glyphe abstrait) en bas à droite

**Light mode :** Ce thème est naturellement CLAIR (fond papier). Le flag `theme-light` active les adaptations CSS nécessaires.

**Accent:** `from: #1a1a1a, to: #8c8c8c`

**Tagline:** "Chaque trait raconte une histoire. Chaque vide a un sens."

**Prix premium suggéré:** 400 ✦ Stars (light mode + design UI spécifique)

---

## 6. 🌸 BLOOM — Jardin Infini

**Identité:** Un jardin sauvage en perpétuelle floraison. Des pétales tombent en spirale. Des lianes grimpent le long de treillis invisibles. Des fleurs s'ouvrent et se ferment au rythme de la lumière. Des lucioles dansent. La palette est PASTEL VIVANT — rose pétale, vert tilleul, jaune pollen, bleu myosotis. C'est le thème le plus JOYEUX et le plus PRINTANIER du catalogue.

**Pourquoi c'est différent:** Forest (thème existant) est un thème sombre vert foncé. Bloom est LUMINEUX, coloré, et organique — un jardin de jour, pas une forêt de nuit. Aucun thème n'explore la floraison ou le printemps.

### Backdrop WebGL (shader Bloom)
```glsl
// Fond : dégradé doux du bleu ciel (#b8d4e3) au vert prairie (#c8e6c9) de haut en bas
// Pétales : ellipses fines (rose #ffb7b2, blanc #ffe4e1) qui tombent en spirale
//   - Apparaissent aléatoirement en haut, tombent avec une trajectoire en S (sinusoïde)
//   - Rotation lente pendant la chute (360° en 4-5s)
// Lianes : courbes vertes (#81c784) qui "poussent" du bas de l'écran — 
//   - Les tiges s'allongent progressivement (stroke-dashoffset animé)
//   - Des petites feuilles (ellipses) apparaissent le long des tiges
// Lucioles : 15-20 points jaune doré (#ffd54f) qui se déplacent aléatoirement
//   - Trajectoire : mouvement brownien doux (déplacement aléatoire à chaque frame, limité)
//   - Pulse de luminosité (opacity varie sinusoïdalement)
// Fleurs : au bout de certaines lianes, une fleur s'ouvre :
//   - 5 pétales (ellipses) partent du centre (scale 0→1, stagger)
//   - La fleur reste 8-10s puis se fane (pétales tombent)
```

**Palette HUD:**
- Primary: `#ff7eb3` (rose pétale vif)
- Secondary: `#81c784` (vert prairie)
- Background: `#f0f4f0` (blanc-vert très pâle)

**Polices:** Playfair Display (titres floraux), Inter (corps), JetBrains Mono (chiffres)

**Pad SVG — BloomPad:**
- Fond dégradé ciel→vert pâle
- Pétales : 12-15 ellipses roses/blanches qui tombent en spirale (animateMotion + animateTransform rotate)
- Lianes : paths verts qui "poussent" (stroke-dashoffset 100→0, duration 3-5s, stagger)
- Fleurs : 3 fleurs qui s'ouvrent (5 pétales en scale 0→1 avec stagger 0.1s)
- Lucioles : 10 cercles jaunes avec mouvement brownien (animate cx + animate cy + animate opacity)
- Papillons : 2 petits papillons (paths SVG) qui traversent (animateMotion le long d'un path sinusoïdal)

**Light mode :** Ce thème est CLAIR (fond ciel). Flag `theme-light` requis.

**Accent:** `from: #ff7eb3, to: #81c784`

**Tagline:** "Un jardin qui ne cesse de fleurir, rien que pour toi."

**Prix premium suggéré:** 350 ✦ Stars

---

## Tableau comparatif — Les 6 nouveaux vs l'existant

| Thème | Ambiance | Luminosité | Style | Proche de (existant) ? | Premium |
|-------|----------|-----------|-------|----------------------|---------|
| **Coral** | Sous-marin chaud | Sombre chaud | Organique | ❌ Aucun | ✅ 300 ✦ |
| **Rust** | Post-apo industriel | Très sombre | Industriel | ❌ Aucun | ✅ 300 ✦ |
| **Void** | Vide géométrique | Sombre absolu | Minimaliste | ❌ Aucun | ✅ 400 ✦ |
| **Prism** | Laboratoire optique | Sombre | Scientifique | ❌ Aucun (Quantum≠) | ✅ 350 ✦ |
| **Ink** | Calligraphie sumi-e | CLAIR | Artistique | ❌ Aucun (Chalkboard≠) | ✅ 400 ✦ |
| **Bloom** | Jardin printanier | CLAIR | Organique joyeux | ❌ Aucun (Forest≠) | ✅ 350 ✦ |

---

## Impact sur l'UI — Trois thèmes "clairs"

Ink, Bloom, et Void nécessitent une adaptation UI. Le flag `theme-light` existe déjà (utilisé par Quartz). Les trois nouveaux thèmes clairs doivent :

1. **Ink** : Fond `#f5f0e8`, texte sombre, cartes semi-transparentes avec bordure fine. Les boutons primaires restent colorés (noir encre) mais sur fond clair.
2. **Bloom** : Fond `#f0f4f0`, texte sombre, cartes avec fond blanc cassé. Les boutons utilisent le rose pétale `#ff7eb3`.
3. **Void** : Fond `#000000`, texte BLANC, cartes transparentes avec bordure blanche fine. Les boutons sont des bordures blanches sur fond noir — pas de remplissage.

---

## Plan d'intégration technique

### Étape 1 — Backdrops (ThemedBackdrop.tsx)
- Ajouter 6 nouvelles fonctions shader : `coral()`, `rust()`, `void_scene()`, `prism()`, `ink()`, `bloom()`
- Étendre `BackdropScene` : `"coral" | "rust" | "void" | "prism" | "ink" | "bloom"`
- Étendre `SCENE_INDEX` : `coral: 14, rust: 15, void: 16, prism: 17, ink: 18, bloom: 19`
- Ajouter dispatch dans `main()` et interactions tactiles si nécessaire

### Étape 2 — Pads SVG
- Créer 6 nouveaux fichiers : `CoralReefPad.tsx`, `RustPad.tsx`, `VoidPad.tsx`, `PrismPad.tsx`, `InkPad.tsx`, `BloomPad.tsx`
- Câbler dans `BattlePad.tsx` (import + case)

### Étape 3 — Types et métadonnées
- `types.ts` : ajouter 6 `ThemeId`, 6 `PadId`, 6 `BackgroundId`, 6 `PAD_META`
- `theme.ts` : ajouter 6 palettes dans `THEMES`
- `themes.ts` : ajouter 6 entrées dans `BACKGROUNDS`, `BACKGROUNDS_BY_ID`, `BG_DEFAULT_THEME`

### Étape 4 — Premium gating
- `themes.ts` : chaque BackgroundDef a `premiumSetId: "coral"` (etc.)
- Le picker de thèmes affiche un cadenas + prix en ✦ Stars
- L'achat vérifie `player.ownedPremiumSets.includes("coral")`
- `storeMigrationGuard.ts` : ajouter les 6 IDs dans les Valid Sets

### Étape 5 — i18n
- 6 × 3 clés = 18 clés dans `en.ts` (theme.coral, theme.rust, etc.)
- Traduction dans les 14 autres locales

### Étape 6 — Light mode CSS
- `App.css` : les règles `.theme-light` existantes doivent être vérifiées pour Ink, Bloom, et Void
- Ajouter des overrides spécifiques si nécessaire (ex: Void utilise des bordures blanches, pas des fonds)

---

## Fichier résumé pour handoff

| Thème | Backdrop | Pad | HUD Palette | Polices | Premium |
|-------|----------|-----|-------------|---------|---------|
| 🪸 Coral | `coral()` GLSL | `CoralReefPad.tsx` | `#ff6b6b` × `#4ecdc4` | Playfair + Cormorant | 300 ✦ |
| 🏭 Rust | `rust()` GLSL | `RustPad.tsx` | `#d2691e` × `#8b4513` | Bebas + Rajdhani | 300 ✦ |
| ◼️ Void | `void_scene()` GLSL | `VoidPad.tsx` | `#fff` × `#666` | JetBrains Mono | 400 ✦ |
| 💎 Prism | `prism()` GLSL | `PrismPad.tsx` | `#fff` × `#8b5cf6` | Inter + Space Grotesk | 350 ✦ |
| 🖋️ Ink | `ink()` GLSL | `InkPad.tsx` | `#1a1a1a` × `#8c8c8c` | EB Garamond + Cormorant | 400 ✦ |
| 🌸 Bloom | `bloom()` GLSL | `BloomPad.tsx` | `#ff7eb3` × `#81c784` | Playfair + Inter | 350 ✦ |