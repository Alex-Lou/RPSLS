# RPSLS — Prompts Génération d'Icônes Custom

Ce document fournit des prompts prêts à l'emploi pour générer un set d'icônes premium cohérentes pour RPSLS, destinées à remplacer les emojis actuels.

---

## 🎨 PROMPT-SYSTÈME RÉUTILISABLE

Utilise ce prompt de base pour **tous les appels** à ChatGPT/DALL-E/Midjourney/StableUI. Concatène chaque **PROMPT SPÉCIFIQUE** ci-dessous après ce bloc.

### Texte du prompt-système (copie intégrale) :

```
You are designing premium game icons for a mobile card/duel game with a cosmic-neon aesthetic.

UNIFIED STYLE:
- Format: PNG, 512×512 px, FULLY TRANSPARENT background (no white or dark fills).
- Subject: centered with breathing margin (~30–50px of clear space all sides).
- Palette: cosmic-neon, drawn from these hex colors (use 2–3 per icon):
  * Primary: #a855f7 (vibrant violet), #22d3ee (cyan), #fbbf24 (amber/gold), #0f172a (near-black accents).
  * Secondary: #ec4899 (fuchsia highlights), #10b981 (emerald), #06b6d4 (deeper cyan).
- Visual style: premium game icon (sharp lines, no soft gradients unless glow), clean contours, vector-ready OR hand-drawn at 512px native resolution.
- Glow/luminosity: subtle outer glow (1–3px blur, same hue as main color, 20–40% opacity) OR internal luminous edges. NO harsh drop shadows; luminosity over shadow.
- Readability: must remain crisp and recognisable at 24–48px (icons will downscale for UI buttons). Test visual clarity at small sizes.
- Cohesion: all icons in this set share the same line weight (~2–3px), glow intensity, and colour-harmony logic.
- Typography: ZERO text labels, zero numerals. Icon only.
- No background: icon floats on transparency. No orbits, stars, or decorative extras unless essential to identity.
- Centered perspective: subject occupies ~60–70% of the 512px canvas; margins are clear and intentional.

QUALITY CHECKLIST:
- ✓ No fuzzy edges (anti-alias acceptable, pixelation not).
- ✓ Vibrant, saturated colours (not washed-out pastels).
- ✓ Glowing aura OR inner luminosity (no dead black outlines).
- ✓ Recognisable at 32px downscale (hold at arm's length, squint test).
- ✓ Consistent line style across all icons in the set.

Now generate the icon for:
```

---

## 📋 LISTE DES ICÔNES

Chaque entrée contient :
- **Nom court** (pour le nommage de fichier)
- **Usage** (où/quoi remplace dans l'app)
- **Prompt spécifique** (à coller après le prompt-système)

---

### LANES (3 lanes d'affiliation) — Les fondamentales

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 1 | `lane-force` | Remplace ⚔️ — Lane FORCE (Strength/Puissance), coups favorisés : Pierre & Ciseaux. Indice visuel dans les couloirs de jeu et les lobbies. | A glowing violet sword or war hammer rising upward, with sharp geometric edges and amber/gold highlights on the blade edges. Deep violet body (#a855f7) with a cyan (#22d3ee) aura. Style: stylized weapon icon, not realistic, clean angular lines. Glyph-like simplicity despite the detail. |
| 2 | `lane-wisdom` | Remplace 🧠 — Lane WISDOM (Wisdom/Sagesse), coups favorisés : Feuille & Spock. Symbole de réflexion et stratégie. | A luminous brain or cosmic mind-glyph made of interlocking geometric curves, radiating outward with cyan (#22d3ee) as primary color and violet (#a855f7) inner nodes. Mystical, cerebral look—like a neural network or mandala brain. Sharp, icon-friendly linework. |
| 3 | `lane-cunning` | Remplace 🦎 — Lane CUNNING (Cunning/Ruse), coups favorisés : Lézard. Symbole de stratégie sournoise et agilité. | A slender, coiled lizard or serpentine creature viewed from above, emerald green (#10b981) with cyan (#22d3ee) scale highlights and fuchsia (#ec4899) accent lines on the tail. Sleek, minimalist—lithe curves, no bulky shading. Glow: soft emerald aura. |

---

### CURRENCIES (2 devises virtuelles de l'économie)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 4 | `currency-eclats` | Remplace 💎 — **Éclats** (shards/crystals), devise premium pour acheter packs. Affiché dans UserHeader, RankedLobby, ShopPage (chips cliquables). Couleur: cyan/violet gradient. | A radiant crystal or gem cluster, fractured and multi-faceted, glowing from within. Dominant cyan (#22d3ee) with violet (#a855f7) internal striations and amber (#fbbf24) highlights on the top facets. Luminous, sharp edges, cosmic feel—like trapped starlight in glass. Glyph-ready simplicity. |
| 5 | `currency-dust` | Remplace ✨ (dans le contexte dust/poussière d'éclairement) — **Poussière** (dust/sparkles), devise secondaire pour crafter cartes. Affiché dans ShopPage et DeckManager. Couleur: violet/fuchsia. | A swirling cloud or vortex of sparkles and stardust, with 3–5 larger motes converging toward a bright center point. Primarily violet (#a855f7) and fuchsia (#ec4899), with white (or very pale cyan) motes at peak brightness. Ethereal, magical feel—less solid than the crystal. |

---

### ACTIONS DE BOUTIQUE (Shop / Crafting)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 6 | `action-shop` | Remplace 🎁 — **Boutique** (Shop), bouton d'accès à la page de packs et crafting. Accessible via burger menu. | A wrapped gift box or treasure chest, viewed from a 3⁄4 angle, bursting with light and sparkles. Violet (#a855f7) and amber (#fbbf24) gradient wrapping paper or lid, with cyan (#22d3ee) glowing highlights indicating treasure inside. Cheerful, celebratory feel—like opening a prize box. |
| 7 | `action-craft` | Remplace ⚒️ — **Forge** (Craft), action d'assemblage/fabrication de cartes. Bouton dans ShopPage ou modal de crafting. | A blacksmith's hammer or anvil with a glowing violet aura, fused with or striking a crystalline element (cyan). Geometric, industrial-magical hybrid. Amber (#fbbf24) sparks or light bursts radiating from the impact point. Style: icon-sharp, angular geometry. |
| 8 | `action-pack-open` | Remplace 🎴 — **Ouvrir un pack** (Pack opening), action pour révéler 3 cartes obtenues. Modal pack-opening visual. | A sealed envelope or card pack with a glowing seam or opening animation suggested by the pose. Violet (#a855f7) and cyan (#22d3ee) gradient envelope, with a fuchsia (#ec4899) glow radiating outward as if cards are about to spill out. Sense of mystery and anticipation. |

---

### PROGRESSION & TROPHÉES (Ranked, Tournaments, Seasons)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 9 | `badge-trophy` | Remplace 🏆 — **Trophée** / Tournoi, symbole de victoire et compétition rankée. Affiché dans les quêtes quotidiennes, lobbies tournoi, récaps de saison. | A tall, elegant trophy or chalice with a wide cup and pedestal base, radiating triumph. Dominant amber/gold (#fbbf24) with violet (#a855f7) accent stripes or gems set into the cup. Cyan (#22d3ee) glowing interior. Regal, celebratory—like a champion's prize. Sharp geometric style, not realistic. |
| 10 | `badge-season` | Remplace concept de "Saison" — **Saison** / Cycle saisonnier, badge pour indiquer la progression saisonnière et les récompenses de tier. ProfilePage, modal de rollover de saison. | A rotating celestial or seasonal wheel, subdivided into 4–6 segments (or a circular ribbon wrapping around a star). Violet (#a855f7) → cyan (#22d3ee) → amber (#fbbf24) gradient flowing around the ring. Central star or crown symbol. Sense of cycles and cosmic time. |
| 11 | `badge-rank-diamond` | Optionnel : remplace 💎 dans les contextes de RANG (ex: "Diamond" tier 💎 emoji). Badge d'éclat/diamant. | A faceted diamond or crystal star (8-pointed), brilliant and sharp-edged. Dominant cyan (#22d3ee) with deep violet (#a855f7) shadows in the facets and bright white peak highlights. Maximum luminosity, jewel-like sparkle. High-status, aspirational feel. |

---

### BONUS & COMBOS (Gameplay mechanics)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 12 | `badge-style-bonus` | Remplace ✨ (dans contexte bonus de style/combo) — **Bonus de style**, affiché lors d'un coup favori joué sur sa lane. Badge sur les cartes/rounds révélés. | A starburst or radiant flash, with 4–6 sharp rays or beams emanating from a central bright point. Fuchsia (#ec4899) rays with violet (#a855f7) core and cyan (#22d3ee) inner glow. Ethereal, celebratory—captures a moment of triumph. Sharp geometric rays, not organic. |
| 13 | `badge-combo` | Remplace concept "bonus combo" — **Combo parfait** / Triple play bonus, awarded when the same move is placed on all 3 lanes. Affiché dans les récaps et tutoriels. | Three interlocking or spiraling crescents or circles, rotating around a central point. Amber/gold (#fbbf24) outer rings with violet (#a855f7) and cyan (#22d3ee) rotating accents. Sense of harmony and perfect symmetry. Suggest rotation/motion even in a static image. |

---

### MATCHMAKING & ONLINE

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 14 | `action-online` | Remplace (contexte en-ligne) — **En ligne** / Matchmaking, bouton pour accéder à la recherche multijoueur. Menu mode selection, mode online tile. Fichier : `/MenuIcons/en-ligne.png` déjà créé ; fourni comme référence. | A connected network node or planet with orbital rings, glowing with activity. Violet (#a855f7) and cyan (#22d3ee) with amber (#fbbf24) orbital paths or connection lines. Pulsing sense of communication/connection. Futuristic, tech-forward look. |
| 15 | `badge-bot-ai` | Remplace 🤖 — **IA / Bot** fallback, affiché quand la recherche bascule vers l'IA après timeout. Emblème dans les quêtes et notifications. | A stylized circuit board pattern or geometric AI head (featureless, angular), glowing with bot-like energy. Cyan (#22d3ee) and fuchsia (#ec4899) primary, with emerald (#10b981) accent nodes suggesting computation. Tech-forward, not cute—strategic and precise. |
| 16 | `badge-human-vs-bot` | Optionnel : différentiateur visuel — **Humain vs Bot** indicator. Affiché pour clarifier si l'adversaire est humain ou IA. Lobbies en ligne. | Split glyph or yin-yang style : left half is a sharp angular bot/circuit glyph (cyan), right half is a rounded organic human silhouette or profile (violet/fuchsia). Center line glows amber (#fbbf24) where they meet. Symbolic balance. |

---

### QUÊTES & DÉFIS (Daily Quests, Challenges)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 17 | `action-quest` | Remplace concept "quête quotidienne" — **Quête du jour**, badge pour accès au panneau de défi quotidien. ModeSelect tile, notifications. | A scroll or quest marker unrolling with glowing text or symbols inside. Violet (#a855f7) and amber (#fbbf24) prominent, with cyan (#22d3ee) glowing runes or marks on the scroll. Sense of mystery and challenge. Rolled scroll aesthetic, not flat. |
| 18 | `badge-daily-done` | Optionnel : badge de validation — **Quête complétée**, badge pour indiquer une quête achevée/reward reçue. Affiché dans le journal ou la liste des quêtes. | A checkmark or seal within a glowing wreath or star frame. Emerald (#10b981) checkmark with violet (#a855f7) and amber (#fbbf24) decorative ring. Sense of achievement. Clean, bold geometry. |

---

### PROFIL & PARAMÈTRES

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 19 | `action-settings` | Optionnel : paramètres — **Paramètres** / Gear icon, si accès depuis menu burger. Burger menu item. | A mechanized gear or cog with fine detail, glowing from within. Violet (#a855f7) primary structure with cyan (#22d3ee) inner channels/grooves and amber (#fbbf24) highlights on teeth. High-tech, intricate look. Sharp edges, no blur. |
| 20 | `action-profile` | Optionnel : profil utilisateur — **Profil**, badge pour accès à la page de profil utilisateur. Burger menu item. | A stylized human silhouette or crown profile, glowing with personal prestige. Violet (#a855f7) and cyan (#22d3ee) with amber (#fbbf24) accent halo. Regal, personal—sense of identity. Geometric profile, not photorealistic. |

---

### MODULES / CARTES SPÉCIALES (Optional expansion)

| # | Nom | Usage | Prompt spécifique |
|---|-----|-------|-------------------|
| 21 | `card-type-power` | Optionnel : types de cartes — **Carte de Puissance**, type special card indicator si les cartes seront catégorisées. Grille Codex, ShopPage. | A small rune or glyph symbolizing raw power : a compact starburst, lightning bolt, or surge of energy. Amber (#fbbf24) and cyan (#22d3ee) with violent violet (#a855f7) interior. Compact, under 100px clear space to leave room for card art. |
| 22 | `card-type-wisdom` | Optionnel : types de cartes — **Carte de Sagesse**, type card indicator. Grille Codex, ShopPage. | A small meditation or knowledge symbol : concentric circles or a lotus mandala. Cyan (#22d3ee) and violet (#a855f7) with emerald (#10b981) accents. Serene but glowing. Compact symbol. |
| 23 | `card-type-cunning` | Optionnel : types de cartes — **Carte de Ruse**, type card indicator. Grille Codex, ShopPage. | A small trickster or strategy glyph : a sharp zigzag, serpent coil, or tactical crosshair. Emerald (#10b981) and fuchsia (#ec4899) with cyan (#22d3ee) highlights. Sneaky, precise feel. Compact. |

---

## 📁 PLACEMENT DES FICHIERS

Après génération, place les PNG dans l'un de ces sous-dossiers de `app/public/` selon le contexte :

- **`/MenuIcons/`** — Icônes du menu principal (modes, actions principales)
  - `lane-force.png`, `lane-wisdom.png`, `lane-cunning.png`
  - `action-shop.png`, `action-craft.png`, `action-pack-open.png`
  - `action-online.png`, `action-quest.png`

- **`/Cards Bonus/`** — Badges et indicateurs pour les cartes et rounds
  - `badge-style-bonus.png`, `badge-combo.png`
  - `badge-trophy.png`, `badge-season.png`, `badge-rank-diamond.png`
  - `card-type-power.png`, `card-type-wisdom.png`, `card-type-cunning.png`

- **`/Burger Icons/`** — Petites icônes du menu burger
  - `badge-bot-ai.png`, `badge-human-vs-bot.png`
  - `action-settings.png`, `action-profile.png`, `badge-daily-done.png`

- **Currencies (novo)** — Nouvelles devises
  - Créer `app/public/Currencies/` :
    - `currency-eclats.png`
    - `currency-dust.png`

---

## 🎯 NOTES D'INTÉGRATION

1. **Nommage des fichiers** : utiliser kebab-case lowercase (ex: `lane-force.png`, pas `LaneForce.png`) pour éviter les pièges d'URL-encoding.

2. **Transparence** : s'assurer que chaque PNG est exporté avec fond transparent **PNG-32 (RGBA)**, pas PNG-8 ni JPEG.

3. **Résolution** : générer natif 512×512 px (les assets Web redimensionnent via CSS ; partir en haute résolution évite la perte de qualité).

4. **Intégration code** : dans les fichiers `.tsx` source, remplacer les emojis par des balises `<img>` :
   ```tsx
   // Avant :
   <span>⚔️ FORCE</span>
   
   // Après :
   <img src="/MenuIcons/lane-force.png" alt="Force" className="w-6 h-6" />
   ```

5. **Cohérence visuelle** : tous les PNG doivent partager le même "poids de ligne" (~2–3px), la même intensité de glow, et la même harmonie de couleur. Si un PNG vous semble hors-norme, reconduire avec le prompt-système jusqu'à cohérence.

6. **Vérification mobile** : une fois intégré, tester sur device real ou emulateur Android pour s'assurer que les glows et détails restent lisibles à 24–48px (hauteur des boutons/badges).

---

## 📊 SUMMARY

- **Total icônes primaires** : 15 (lanes 3 + currencies 2 + shop 3 + progression 3 + gameplay 2 + online 2)
- **Total icônes optionnelles** : 8 (rank-diamond, daily-done, bot-indicator, settings, profile, card-types 3)
- **Palette unifiée** : violet (#a855f7), cyan (#22d3ee), amber (#fbbf24), émeraude (#10b981), fuchsia (#ec4899)
- **Style** : glyph premium cosmique-néon, ligne nette, glow lumineux, 100% transparent background, 512px natif

---

**Généré pour RPSLS v0.4.40+ — remplacer emojis par premium custom art.**
