# Prompts illustrations — Cartes de Voie & Badges (Constellation Pro)

> Pour générer les illus manquantes (17 cartes de Voie + 5 badges réutilisables) via ChatGPT/Midjourney/DALL·E.
> **Prompts en anglais** (les générateurs rendent bien mieux en anglais). Tout le reste en français.

## Format & règles (IMPORTANT — lis avant de générer)

- **Carré 1:1, 1024×1024.** L'app réduit en 500×500 puis **croppe en portrait 4:5 + zoom ×1.55**.
  → **Garde le sujet bien CENTRÉ** dans les 60 % du milieu ; rien d'important sur les bords/coins (sinon coupé).
- **Aucun texte, aucun cadre, aucune bordure, aucun logo, aucun filigrane** dans l'illu (le cadre + le badge sont ajoutés par-dessus, par toi/l'app).
- **Coin haut-gauche calme** : laisse cette zone peu chargée → c'est là que tu colleras le **badge de Voie**.
- Style **commun à toutes** : peinture digitale fantasy, semi-réaliste, couleurs saturées, lumière magique dramatique, 1 sujet central net.
- **Cohérence d'une même Voie** : pour que les 2-5 cartes d'une Voie partagent exactement la palette, réutilise le **même seed** (`--seed N` sur Midjourney) ou une **style-ref** (`--sref`) d'une carte à l'autre — sinon la teinte dérive d'une carte à l'autre.

---

## 1) Les 5 BADGES de Voie (réutilisables — ton idée, la bonne)

> But : 5 médaillons ronds **du même style** (même anneau, même rendu), fond **transparent**, que tu colles dans le coin de chaque carte selon sa Voie. **À générer UN PAR UN** (le « set de 5 » en une image donne une grille sans alpha et des tailles inégales) : utilise le bloc « set » ci-dessous seulement comme **description du style commun**, puis génère chaque badge seul avec le suffixe partagé. ⚠️ MJ/DALL·E ne sortent pas de vrai PNG transparent → génère sur **fond uni magenta `#FF00FF`** puis détoure (ou outil remove-bg).

**Set complet (RÉFÉRENCE DE STYLE — génère plutôt 1 par 1, ci-dessous) :**
```
A matching set of 5 circular faction emblem medallions for a fantasy card game, same art style, same beveled metallic ring thickness, same soft inner glow, each a bold simple silhouette readable at very small size, each emblem isolated and floating on a fully transparent background, no scene, no ground, no drop shadow on the background, clean modern game-icon style. The 5 emblems: (1) MOUNTAIN — a granite peak of stacked angular stones, cool grey-stone and silver; (2) FOREST — a single elegant leaf with a glowing golden central vein, vivid emerald; (3) BLADE — two crossed sharp steel blades, cold steel with a rose-red edge glow; (4) MIRAGE — a simple bold theatrical mask shape with one large eye-hole, iridescent indigo-to-cyan opal; (5) COSMOS — a bright star encircled by a bold short orbital ring clearly inside the medallion, not touching the metal rim, deep violet with icy cyan light. No text, no words, no background scene. Transparent PNG, 512x512 each.
```

**Ou un par un** (même suffixe pour tous → `, circular faction emblem medallion, beveled metallic ring, soft inner glow, bold simple silhouette, centered on a fully transparent background, no drop shadow, clean game-icon style, no text, no words, no background, transparent PNG 512x512`) :

- 🪨 **Montagne** : `a granite mountain peak made of stacked angular stones, cool grey-stone and silver palette`
- 🌿 **Forêt** : `a single elegant leaf with a glowing golden central vein, vivid emerald green`
- ✂️ **Tranchant** : `two crossed sharp steel blades, cold steel with a rose-red edge glow`
- 🦎 **Mirage** : `a simple bold theatrical mask shape with one large eye-hole, iridescent indigo-to-cyan opal`
- 🖖 **Cosmos** : `a bright star encircled by a bold short orbital ring clearly inside the medallion, not touching the metal rim, deep violet with icy cyan starlight`

---

## 2) Les 17 cartes (prompts prêts à coller)

> Chaque bloc est **complet** (sujet + ambiance de Voie + style + règles de format). Copie-colle tel quel.
> L'identité de Voie passe par la **couleur/ambiance** de la scène — le badge fait le reste.

### 🪨 Voie de la Montagne — granite, pierre, gris-acier

**Éboulement** (rockslide AOE)
```
A violent rockslide of massive boulders crashing down a mountain cliff, crushing rubble and dust exploding outward, raw broken granite. Palette: granite and slate greys, cold silver rim-light, dust and gravel, heavy earthbound mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Strate Vive** (a stone creature gaining ATK / hardening)
```
A towering granite stone golem gaining a fresh glowing layer of crystalline rock strata, growing taller and harder, geological energy crackling along new stone plates. Palette: granite and slate greys, cold silver rim-light, faint amber mineral glow, heavy earthbound mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Contrefort** (board-wide HP wall + shields)
```
A massive granite fortress buttress reinforcing a rampart, interlocking stone walls and floating stone shields rising into place, an impregnable bulwark. Palette: granite and slate greys, cold silver rim-light, dust, heavy earthbound mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Gardien de Pierre** (riposte + anchor sentinel)
```
An immovable colossal stone sentinel standing guard, carved runic granite, a retaliating aura of jagged stone spikes bristling around it, unbreakable stance. Palette: granite and slate greys, cold silver rim-light, faint rune glow, heavy earthbound mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Veine de Gaïa** (heal from rocks)
```
A glowing vein of molten copper-gold earth energy coursing through cracked granite, restorative light welling up from deep within the stone, life flowing through rock. Palette: granite greys lit from within by warm amber-gold mineral light, veins of molten copper-gold, no green, sacred earthbound mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

### 🦎 Voie du Mirage — iridescent indigo↔cyan, illusion

**Reflet-Écho** (cycle / mirror echo)
```
Two perfectly symmetrical mirrored iridescent lizards facing each other across a vertical mirror line, rippling reflections between them, a swirl of echoing light. Palette: iridescent shifting indigo-to-cyan opal colors, shimmering mirage haze, elusive dreamlike mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Mascarade Enchaînée** (+dodge, after-images)
```
A cascade of ornate iridescent jeweled masks floating in a chain, each mask hollow and faceless, the lizard barely glimpsed behind them, fluid deceptive motion. Palette: iridescent shifting indigo-to-cyan opal colors, shimmering mirage haze, elusive dreamlike mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Fuite Masquée** (+dodge, evasive escape)
```
An empty shimmering lizard-shaped silhouette already half-dissolved into mirage, only a trailing comet-like streak of haze remaining where it fled, the creature almost gone. Palette: iridescent shifting indigo-to-cyan opal colors, shimmering mirage haze, elusive dreamlike mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

### ✂️ Voie du Tranchant — acier froid + rose-cardinal, vitesse

**Coup de Taille** (cleaving strike through shield)
```
A single powerful steel blade slicing clean through a shattering energy shield, a rose-red slash arc and bright sparks, a single decisive vertical downward strike, clean and minimal, empty dark background. Palette: cold steel greys with sharp rose-cardinal red accents, glinting metal edges, swift aggressive mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Acuité** (re-sharpen, keen edge)
```
A gleaming steel blade being re-sharpened to a perfect keen edge against a whetstone, bright sparks flying, the cutting edge glowing razor-thin. Palette: cold steel greys with sharp rose-cardinal red accents, glinting metal, swift aggressive mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Frénésie** (board-wide ATK frenzy)
```
A frenzied storm of multiple slashing steel blades in violent overlapping motion, aggressive red speed-streaks and sparks, unstoppable cutting fury. Palette: cold steel greys with sharp rose-cardinal red accents, glinting metal, swift aggressive mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

### 🌿 Voie de la Forêt — émeraude + sève dorée, sustain

**Ramure** (living shield canopy)
```
A vast living canopy of emerald boughs unfurling into a protective luminous dome over a forest glade, glowing golden sap running through the leaf veins, soft green shielding light radiating downward. Palette: vivid emerald and lime greens with glowing golden sap-light, lush bioluminescent forest, drifting pollen, living verdant mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Photosynthèse** (heal + grow)
```
A radiant shaft of golden sunlight piercing the forest canopy onto a small sprouting plant-creature, its leaves unfurling and reaching upward, a golden bud blooming at its crown, rising green-to-gold energy. Palette: vivid emerald and lime greens with glowing golden sunlight, lush dewy undergrowth, magical growth, living verdant mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Ronces** (thorns + shield)
```
Thorny emerald brambles coiling into a protective tangle around a forest guardian, sharp silver thorns catching the light, small blood-red flowers blooming among the vines. Palette: deep emerald and mossy greens with silver thorn highlights and red flower accents, lush forest, defensive bristling mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

### 🖖 Voie du Cosmos — nébuleuse violette + cyan glacé, contrôle

**Dilatation Temporelle** (mana ramp / bend time)
```
A colossal clock face stretching and warping as spacetime bends around it, concentric violet-blue ripples distorting the starfield, a slowed liquid hourglass with frozen falling sand. Palette: deep violet and indigo nebula with icy cyan starlight and pale gold accents, cosmic void, slow gravitational distortion, cold inevitable mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Loi de Causalité** (freeze a creature in stasis)
```
A creature suspended frozen inside a crystalline stasis bubble, a shattered arrow of time, frozen causal lattice lines radiating outward, glacial cyan stasis glow, absolute stillness. Palette: deep violet and indigo with icy cyan stasis light, cosmic void, frozen geometry, cold inevitable mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Convergence Cosmique** (scaling hero damage)
```
Multiple galaxies and orbital rings spiraling and converging toward a single brilliant imploding point of light, a focused gravitational beam, violet and gold cosmic energy collapsing inward, stars being drawn in. Palette: deep violet and indigo nebula with icy cyan and brilliant gold, cosmic void, silent cataclysmic implosion, cold inevitable mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

### ⚔️ Dégâts SIGNATURE par Voie — 5 cartes (epic / légendaire)

> Les seules illus encore manquantes. Même style/format que les 17 ci-dessus, **palette de leur Voie** (réutilise le seed/sref de la Voie pour rester raccord). Plus dramatiques (ce sont des coups décisifs).

**Éboulis Final** (Montagne — avalanche finisher, dégâts ∝ Pierres+Strates)
```
A catastrophic mountain-scale rockslide finisher, an entire cliff face of colossal granite boulders collapsing and thundering down in a towering wall of crushing stone and billowing dust, unstoppable earthbound cataclysm. Palette: granite and slate greys, cold silver rim-light, choking dust and gravel, faint amber mineral glow deep in the cracks, heavy devastating mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Drain Vital** (Forêt — siphonne la vie : dégâts adverse + soin sur soi)
```
A glowing thread of golden-green life-force being siphoned out of a withering shadowed victim and flowing back along a luminous vine into a thriving radiant plant-creature, vitality draining from one to feed the other, swirling emerald-and-gold sap. Palette: vivid emerald and lime greens with glowing golden sap-light against a dark draining shadow on one side, a single crimson lifeline thread connecting them, living verdant mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Coup dans l'Ombre** (Mirage — frappe imblocable depuis l'illusion)
```
An unseen assassin's strike erupting out of a shimmering mirage, a single iridescent dagger lunging out of dissolving illusory after-images straight toward the viewer, the attacker itself barely visible, a sudden inescapable ambush. Palette: iridescent shifting indigo-to-cyan opal colors, shimmering mirage haze, a single sharp silver blade-glint, elusive deadly dreamlike mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Intrication Quantique** (Cosmos — dégâts inévitables ∝ Spock contrôlés)
```
Two entangled quantum particles linked across the cosmic void by a taut thread of brilliant light, one collapsing and instantly striking the other through impossible distance, inescapable quantum inevitability, a glowing geometric entanglement lattice radiating between them. Palette: deep violet and indigo nebula with icy cyan and pale gold light, cosmic void, luminous entanglement filaments, cold inevitable mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

**Taillade Mortelle** (Tranchant — LÉGENDAIRE, burst brut glass-cannon)
```
A single legendary killing slash, one perfect blindingly fast blade cutting a brilliant rose-red arc clean across the whole frame, the steel almost invisible from sheer speed, a lethal decisive finishing cut, explosive white-hot sparks and a thin afterglow tracing the severed air. Palette: cold steel greys with intense rose-cardinal red and white-hot edge light, glinting metal, swift lethal legendary mood. Fantasy creature/scene key art, full-frame digital painting, painterly semi-realistic, rich saturated colors, dramatic volumetric lighting, highly detailed, single subject tightly centered with generous empty margins on all sides, the upper-left corner left empty and low-detail. Full-bleed key art, no graphic overlays, no lettering, no typography, no frame, no border, no logo, no watermark, no signature. Square 1:1, 1024x1024.
```

---

## 3) Où poser les fichiers

- Illus cartes → `app/public/Cards Bonus/<nom>.png`, puis dans `app/src/ranked/cards.ts` remplace `art: null` par `art: "/Cards Bonus/<nom>.png"`. **Nomme les fichiers en ASCII sans accents ni espaces** (`eboulement.png`, `veine-gaia.png`…) — accents/espaces dans une URL `public/` = risques de bug WebView. Le plus simple : reprends l'`id` de la carte.
- Badges → à composer par-dessus le coin de carte (ton pipeline) ; on pourra aussi les câbler dans l'app si tu veux.
