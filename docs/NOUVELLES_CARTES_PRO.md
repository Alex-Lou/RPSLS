# Nouvelles Cartes — Constellation Pro (Lot 2026-06-12)

**Date:** 2026-06-12
**Contexte:** 12 nouvelles cartes proposées par Alex, validées le 2026-06-12 (« ok pour toutes »).
La carte « Écho » a été **renommée Réverbération** car `echo-temporel` (« Écho temporel ») existe déjà en Ranked.

**Format image demandé :** 1024×1024 PNG, transparence sur les bords, style mobile-game CCG, rectangle vertical ratio ~3:4, glyphe emoji embossé en haut à droite, bordure colorée selon la rareté (gris=commune, bleu=rare, violet=épique, or=légendaire), illustration centrale dramatique. Cohérent avec `CARTES_BONUS_V3.md` et `PROMPTS_IMAGES_FINISHERS.md`.

**Wiring :** chaque carte reçoit un effet Arena (table `PRIORITY_TABLE` + dispatch `applyArenaSpell` dans `arenaCardEffects.ts` / `arenaPhase2Spells.ts`), un coût/rareté/cible dans `cards.ts`, des descriptions FR+EN (`i18n/locales`), et est ajoutée au pool jouable.
Légende implémentation : ✅ = primitives existantes · ⚙️ = nouveau flag/hook engine requis.

---

## ⚪ COMMUNES

### 1. Jet de Caillou — `jet-caillou`
- **Rareté/Coût:** commune · 1 mana · cible : créature adverse (lane)
- **Palette:** `#a8a29e` (pierre) · **Glyphe:** ⛰️
- **Effet (wiré ✅):** inflige **2 dégâts** à la créature adverse ciblée. Bloqué par Ancre / Logique (Spock), comme Supernova.
- **Desc FR:** « Jette une pierre : 2 dégâts à une créature adverse. »
- **Desc EN:** "Hurl a stone: 2 damage to an enemy creature."

```
A common playing card showing a rugged hand hurling a sharp granite stone across a rocky canyon. The thrown rock is mid-flight, leaving a dusty motion trail, with small chips flying off it. Impact sparks of stone-grey (#a8a29e) and warm amber dust. The background is a windswept mountain gorge under an overcast sky, muted earth tones. The card border is plain stone-grey (common rarity). Glyph "⛰️" embossed at top-right. Style: gritty, kinetic, simple, mobile-game card art. 1024×1024 PNG.
```

### 2. Sève — `seve`
- **Rareté/Coût:** commune · 1 mana · cible : ma créature (lane)
- **Palette:** `#34d399` (émeraude) · **Glyphe:** 🌱
- **Effet (wiré ✅, nouveau `healCreature`):** rend **2 PV** à une de tes créatures (plafonné à ses PV max). Premier soin de créature du jeu.
- **Desc FR:** « Régénère une de tes créatures de 2 PV. »
- **Desc EN:** "Restore 2 HP to one of your creatures."

```
A common playing card depicting a glowing droplet of emerald sap (#34d399) falling onto a wounded leaf-creature, its cracks knitting back together with luminous green veins. Tiny new sprouts unfurl around the healed area. Soft particles of life-energy rise upward. The background is a dewy forest floor in soft morning light, gentle greens. The card border is plain grey (common rarity). Glyph "🌱" embossed at top-right. Style: serene, restorative, simple, mobile-game card art. 1024×1024 PNG.
```

### 3. Coup d'Œil — `coup-oeil`
- **Rareté/Coût:** commune · 1 mana · cible : aucune
- **Palette:** `#22d3ee` (cyan) · **Glyphe:** 🔍
- **Effet (wiré ✅):** **pioche 1 carte** ET révèle la carte **la plus chère** de la main adverse (affichée 1 tour).
- **Desc FR:** « Pioche 1 carte et révèle la carte la plus chère de la main adverse. »
- **Desc EN:** "Draw 1 card and reveal the most expensive card in the enemy's hand."

```
A common playing card showing a glowing cyan magnifying lens (#22d3ee) peering through a torn curtain, revealing a single shimmering enemy card behind it while a fresh card is drawn into frame at the bottom. Streaks of scrying light and faint arcane glyphs float around the lens. The background is a dim strategist's tent, teal shadows. The card border is plain grey (common rarity). Glyph "🔍" embossed at top-right. Style: clever, espionage, mobile-game card art. 1024×1024 PNG.
```

---

## 🔵 RARES

### 4. Permutation — `permutation`
- **Rareté/Coût:** rare · 2 mana · cible : une lane
- **Palette:** `#a78bfa` (violet) · **Glyphe:** 🔄
- **Effet (wiré ✅):** **échange** ta créature et celle d'en face sur la lane : elles changent de camp. (Voler le tank adverse.)
- **Desc FR:** « Échange ta créature et celle d'en face : elles changent de camp. »
- **Desc EN:** "Swap your creature with the one across from it — they change sides."

```
A rare playing card depicting two creatures caught in a swirling violet (#a78bfa) vortex of teleportation energy, crossing past each other along a glowing exchange arc as they swap places on the battlefield. Spiraling runes and afterimages mark their trajectories. The background is a fractured arena floor split by a luminous purple rift. The card border is polished blue (rare rarity). Glyph "🔄" embossed at top-right. Style: chaotic, magical, dynamic, mobile-game card art. 1024×1024 PNG.
```

### 5. Toile Gluante — `toile-gluante`
- **Rareté/Coût:** rare · 2 mana · cible : créature adverse (lane)
- **Palette:** `#84cc16` (lime) · **Glyphe:** 🕸️
- **Effet (wiré ⚙️ flag `cannotAttack`):** la créature adverse ciblée **ne peut pas attaquer ce tour** (elle survit). Bloqué par Ancre / Logique.
- **Desc FR:** « Englue une créature adverse : elle ne peut pas attaquer ce tour. »
- **Desc EN:** "Web an enemy creature: it can't attack this turn (it survives)."

```
A rare playing card showing an enemy creature ensnared in thick, sticky lime-green (#84cc16) spider-silk webbing, struggling but held fast, its limbs bound. Glistening strands of web stretch across the frame, dripping luminous sap. The background is a shadowy thicket with a giant web spanning the corners. The card border is polished blue (rare rarity). Glyph "🕸️" embossed at top-right. Style: entangling, organic, sticky, mobile-game card art. 1024×1024 PNG.
```

### 6. Réverbération — `reverberation`
- **Rareté/Coût:** rare · 2 mana · cible : aucune (re-cible auto)
- **Palette:** `#e879f9` (fuchsia) · **Glyphe:** 🔊
- **Effet (wiré ⚙️ tracking dernier sort):** **relance l'effet de ton dernier sort joué ce tour** (sur une nouvelle cible valide / le même héros). Sans sort précédent ce tour : fizzle.
- **Desc FR:** « Relance l'effet de ton dernier sort de ce tour. »
- **Desc EN:** "Re-cast the effect of your last spell this turn."

```
A rare playing card depicting a spell-glyph echoing outward in concentric fuchsia (#e879f9) sound-rings, a ghostly duplicate of a previous spell re-materializing mid-air behind the original. Overlapping translucent after-images and rippling magenta waveforms fill the frame. The background is a resonant crystal chamber reflecting violet light. The card border is polished blue (rare rarity). Glyph "🔊" embossed at top-right. Style: echoing, arcane, reverberant, mobile-game card art. 1024×1024 PNG.
```

---

## 🟣 ÉPIQUES

### 7. Gravité — `gravite`
- **Rareté/Coût:** épique · 3 mana · cible : aucune (global)
- **Palette:** `#6366f1` (indigo) · **Glyphe:** 🌑
- **Effet (wiré ✅):** inflige **−1 PV à TOUTES les créatures adverses** ; **pioche 1 carte par créature ainsi tuée**.
- **Desc FR:** « Écrase toutes les créatures adverses (−1 PV) ; pioche 1 carte par créature tuée. »
- **Desc EN:** "Crush all enemy creatures (−1 HP); draw 1 card per creature killed."

```
An epic playing card showing a collapsing indigo (#6366f1) gravity well pressing down on a row of enemy creatures, their bodies compressed and cracking under the immense downward force, debris and dust spiraling toward a dark singularity above them. Streaks of violet energy bend inward. The background is a warped battlefield with curved space-distortion lines. The card border is ornate purple (epic rarity). Glyph "🌑" embossed at top-right. Style: oppressive, cosmic, crushing, mobile-game card art. 1024×1024 PNG.
```

### 8. Doppelgänger — `doppelganger`
- **Rareté/Coût:** épique · 3 mana · cible : aucune (auto lane vide)
- **Palette:** `#38bdf8` (sky) · **Glyphe:** 👥
- **Effet (wiré ✅):** invoque une **copie de ta meilleure créature** (ATK+PV max) sur une lane vide à toi. Sans lane vide : fizzle.
- **Desc FR:** « Invoque une copie de ta meilleure créature sur une lane vide. »
- **Desc EN:** "Summon a copy of your strongest creature on an empty lane."

```
An epic playing card depicting a powerful creature and its shimmering mirror-clone emerging from a rippling sky-blue (#38bdf8) reflective surface, the duplicate stepping out of liquid light with identical features but a translucent glow. Reflective shards and prismatic highlights surround them. The background is a hall of luminous mirrors. The card border is ornate purple (epic rarity). Glyph "👥" embossed at top-right. Style: duplication, mirror-magic, mobile-game card art. 1024×1024 PNG.
```

### 9. Purge — `purge`
- **Rareté/Coût:** épique · 3 mana · cible : aucune (global)
- **Palette:** `#fbbf24` (ambre) · **Glyphe:** 🧹
- **Effet (wiré ✅):** **dissipe** tous les buffs (ATK+), boucliers 🛡, ancres et Riposte des créatures adverses.
- **Desc FR:** « Dissipe tous les buffs, boucliers et ancres des créatures adverses. »
- **Desc EN:** "Dispel all buffs, shields and anchors from enemy creatures."

```
An epic playing card showing a sweeping wave of golden-amber (#fbbf24) purifying light passing over enemy creatures, stripping away glowing shields, buff-auras and chains that shatter and dissolve into sparks. Cleansing radiance fans across the frame like a broom of light. The background is a darkened altar bathed in a single golden beam. The card border is ornate purple (epic rarity). Glyph "🧹" embossed at top-right. Style: cleansing, radiant, dispelling, mobile-game card art. 1024×1024 PNG.
```

---

## 🟡 LÉGENDAIRES

### 10. Roue du Destin — `roue-destin`
- **Rareté/Coût:** légendaire · 4 mana · cible : aucune
- **Palette:** `#f472b6` (rose festif) · **Glyphe:** 🎡
- **Effet (wiré ✅, aléatoire):** déclenche **1 effet au hasard** parmi : 6 dmg au héros adverse · +8 PV à ton héros · pioche 3 · détruit une lane adverse aléatoire · +2 mana max. (Le résultat est loggé en clair.)
- **Desc FR:** « Tourne la roue : un puissant effet aléatoire se déclenche. »
- **Desc EN:** "Spin the wheel: a powerful random effect triggers."

```
A legendary playing card depicting a glowing carnival wheel of fortune spinning at blinding speed, its segments blazing with different magical icons (flame, heart, cards, explosion, mana-crystal) in vivid pink (#f472b6) and gold. A spark-trailing pointer clicks across the segments. Confetti of light and chaotic energy bursts radiate outward. The background is a midnight carnival sky with fireworks. The card border is brilliant gold (legendary rarity). Glyph "🎡" embossed at top-right. Style: festive, chaotic, high-stakes gamble, mobile-game card art. 1024×1024 PNG.
```

### 11. Phénix — `phenix`
- **Rareté/Coût:** légendaire · 4 mana · cible : aucune (self, fin de tour)
- **Palette:** `#f97316` (orange braise) · **Glyphe:** 🔥
- **Effet (wiré ⚙️ hook fin-de-tour):** tes créatures qui **meurent ce tour renaissent à 1 PV** en fin de tour (sur leur lane si libre).
- **Desc FR:** « Tes créatures mortes ce tour renaissent à 1 PV en fin de tour. »
- **Desc EN:** "Your creatures that die this turn revive at 1 HP at end of turn."

```
A legendary playing card showing a magnificent phoenix erupting from a pile of ashes in a column of orange-ember (#f97316) flame, its wings spread wide and radiant, reborn from death. Below it, faint ghostly creature-silhouettes rise and re-form from glowing embers. Sparks and feathers of fire swirl upward. The background is a scorched battlefield at dusk glowing with renewal. The card border is brilliant gold (legendary rarity). Glyph "🔥" embossed at top-right. Style: rebirth, fiery, triumphant, mobile-game card art. 1024×1024 PNG.
```

### 12. Singularité — `singularite`
- **Rareté/Coût:** légendaire · 4 mana · cible : héros adverse  *(coût ramené 5→4 : le moteur plafonne les coûts à 4)*
- **Palette:** `#818cf8` (indigo clair) · **Glyphe:** 🌀
- **Effet (wiré ✅):** inflige au héros adverse **2 dégâts par créature présente sur le plateau** (les 2 camps comptés). Board plein = burst massif.
- **Desc FR:** « Inflige au héros adverse 2 dégâts par créature sur le plateau. »
- **Desc EN:** "Deal 2 damage to the enemy hero per creature on the board."

```
A legendary playing card depicting a swirling indigo (#818cf8) singularity tearing open above a battlefield, dragging streams of energy from every creature on the field into a collapsing vortex that fires a devastating beam at a distant hero figure. Spiraling accretion rings and bent starlight surround the void. The background is deep space-violet with stretched, warping stars. The card border is brilliant gold (legendary rarity). Glyph "🌀" embossed at top-right. Style: apocalyptic, cosmic, climactic, mobile-game card art. 1024×1024 PNG.
```

---

## Récapitulatif wiring

| # | ID | Rareté | Coût | Cible | Impl |
|---|----|--------|------|-------|------|
| 1 | `jet-caillou` | commune | 1 | créature adv | ✅ |
| 2 | `seve` | commune | 1 | ma créature | ✅ `healCreature` |
| 3 | `coup-oeil` | commune | 1 | aucune | ✅ |
| 4 | `permutation` | rare | 2 | lane | ✅ |
| 5 | `toile-gluante` | rare | 2 | créature adv | ⚙️ `cannotAttack` |
| 6 | `reverberation` | rare | 2 | aucune | ⚙️ dernier-sort |
| 7 | `gravite` | épique | 3 | global | ✅ |
| 8 | `doppelganger` | épique | 3 | auto | ✅ |
| 9 | `purge` | épique | 3 | global | ✅ |
| 10 | `roue-destin` | légendaire | 4 | aucune | ✅ aléatoire |
| 11 | `phenix` | légendaire | 4 | self/fin-tour | ⚙️ hook résurrection |
| 12 | `singularite` | légendaire | 4 | héros adv | ✅ |

> **2026-06-12 : les 12 cartes sont WIRÉES dans le mode Pro** (registry `rankedTypes`/`cards.ts`, effets `arenaPhase3Spells.ts` + dispatch `arenaCardEffects.ts`, i18n FR/EN, ciblage `arenaTypes`, IA `arenaAI`). Hooks engine ajoutés : `cannotAttack` (Toile), `lastSpellApplied` (Réverbération), `phenixRevive` (Phénix). Art encore à générer (glyph fallback en attendant — déposer les PNG dans `app/public/Cards Bonus/<id>.png` puis mettre `art:` dans `cards.ts`). Pour jouer une carte en Pro : l'ajouter à ton deck via le DeckManager (le deck Pro = ton deck filtré aux cartes Arena-supportées).

**Art :** déposer les PNG dans `app/public/Cards Bonus/<id>.png` (même dossier que les finishers), puis câbler `art: "/Cards Bonus/<id>.png"` dans `cards.ts`. En attendant, fallback glyphe automatique (`CardImage`).
