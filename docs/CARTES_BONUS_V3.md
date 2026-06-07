# Cartes Bonus V3 — Constellation Ranked

**Date:** 2026-06-07
**Contexte:** Le jeu compte 26 cartes actives et 14 cartes proposées en V2. Cette liste ajoute 20 cartes ENTIÈREMENT INÉDITES — aucune ne recoupe les 40 précédentes. Chaque carte introduit une mécanique nouvelle qui modifie le rythme, la durée, ou la dynamique des rounds.

**Principes directeurs :**
- Aucune redondance avec les 26 cartes existantes (cards.ts) ni les 14 proposées (CARD_DESIGN_PROPOSAL.md)
- Chaque carte a un impact mesurable en 1 round — pas d'effets "sur la durée" sans payoff immédiat
- Les cartes peuvent **accélérer**, **ralentir**, ou **détourner** le round
- Fun > Équilibre parfait (l'équilibrage viendra au playtest)

---

## Grille des 20 nouvelles cartes

---

### ⚪ COMMONS — 5 cartes (1 mana)

---

**Carte #1 — SABLIER** VALIDE

- **Coût:** 1 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** ⏱️
- **Palette:** `#f59e0b` (ambre/orangé)
- **Effet:** Ce round, la DEADLINE est modifiée. Vous choisissez : la réduire à 6 secondes (si vous êtes prêt, vous forcez l'adversaire à se dépêcher) OU l'étendre à 20 secondes (si vous avez besoin de réfléchir). L'adversaire subit le même changement.
- **Impact:** Manipulation du TEMPS. Accélère si vous avez déjà votre stratégie, ralentit si vous voulez analyser. L'adversaire doit s'adapter à VOTRE rythme.
- **Unlock:** Gagner un round avec moins de 3 secondes restantes au chronomètre.
- **Description i18n:** "Manipulez le sablier. Ce round, la deadline passe à 6s ou 20s — vous choisissez."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card with a cracked hourglass at the center, half-filled with glowing amber (#f59e0b) sand particles that fall upward AND downward simultaneously. The hourglass frame is ornate bronze (#b45309). The background is a warm gradient from sand-beige (#d4a76a) to deep brown (#2d1a04). Tiny clock gears float around the hourglass. The card border is bronze with amber glow. Glyph "⏱️" embossed in gold at top-right. Style: warm, ancient, time-bending. 1024×1024 PNG.
```

---

**Carte #2 — RÉMANENCE** (ex-Miroir Liquide) ✅ CORRIGÉ — plus de confusion avec Mirror

> **Différence avec la carte Mirror existante :** Mirror copie le move adverse sur UNE lane et force un draw. Rémanence copie le move du ROUND PRÉCÉDENT (pas le round en cours) et le REJOUE gratuitement en plus de votre move normal — aucun draw forcé. C'est une carte OFFENSIVE (attaque supplémentaire), pas défensive.

- **Coût:** 1 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** 👻
- **Palette:** `#e879f9` (fuchsia clair)
- **Effet:** Invoquez le "fantôme" du move que l'adversaire a joué au round PRÉCÉDENT. Ce fantôme est joué GRATUITEMENT sur UNE lane de votre choix, EN PLUS de votre move normal. Le fantôme est une copie spectrale — il ne peut PAS être affecté par les cartes de l'adversaire (il est insaisissable). Le move original de l'adversaire n'est pas consommé/modifié.
- **Impact:** Transformer le passé de l'adversaire en arme. S'il a joué Rock au round dernier et que vous anticipez Scissors ce round, vous placez son Rock fantôme contre son Scissors. Double pressure mentale.
- **Unlock:** Gagner un round où l'adversaire a répété le même move que le round précédent.
- **Description i18n:** "Invoquez le fantôme du dernier move adverse. Il combat à vos côtés."

**🎨 PROMPT ILLUSTRATION:**
```
A single playing card with a glowing ghost-like hand emerging from the card surface. The ghost hand is translucent white with a soft fuchsia (#e879f9) ethereal glow. The ghost hand mimics a Rock-Paper-Scissors gesture — the gesture is blurred, as if caught between two forms. The card background is a deep indigo (#1e1b4b) with spectral swirls. The card border is fuchsia. The glyph "👻" is embossed in the top-right corner. Style: dark mystical, clean lines, mobile-game card art. 1024×1024 PNG with transparency on the outer card edges.
```

---

**Carte #3 — OFFRE** VALIDE

- **Coût:** 1 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 🤝
- **Palette:** `#059669` (émeraude forêt)
- **Effet:** RÉVÉLEZ le move que vous allez jouer CE round à l'adversaire. En échange, gagnez +2 mana AU PROCHAIN round. Le move est visible de l'adversaire AVANT qu'il ne choisisse le sien — c'est un pari : la transparence contre la puissance future.
- **Impact:** Donne un avantage d'information à l'adversaire MAINTENANT en échange d'un avantage de mana PLUS TARD. Haut risque, haute récompense.
- **Unlock:** Gagner un round où l'adversaire a utilisé Augur ou Oracle (il savait ce que vous alliez jouer).
- **Description i18n:** "Annoncez votre move à l'adversaire. +2 mana au prochain round."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card showing two hands meeting in a handshake at the center, but one hand is transparent/spectral (emerald green #059669) and the other is solid. Above the hands, a glowing "+2" in emerald light hovers, with tiny mana crystals orbiting it. The background is a deep forest green (#022c22) with light rays shining down. The card border has a subtle gold trim. The glyph "🤝" is embossed in emerald at top-right. Style: diplomatic, luminous, mobile-game card art. 1024×1024 PNG.
```

---

**Carte #4 — BRAISE** (clarifiée)

- **Coût:** 1 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** 🔥
- **Palette:** `#f97316` (orange feu vif)
- **Effet:** JOUEZ cette carte (elle ne fait rien immédiatement). ENSUITE, jusqu'à la fin du match, chaque round que vous PERDEZ réduit de 1 le coût de votre PROCHAINE carte (cumulable : 2 défaites d'affilée = -2 mana). Le coût ne peut pas descendre en dessous de 1. L'effet se déclenche APRÈS la première défaite suivant la pose de Braise — pas avant.
- **Impact:** Plus vous êtes en difficulté, plus vos cartes deviennent accessibles. Idéal en mode comeback — vous perdez des rounds mais gagnez en puissance de carte.
- **Unlock:** Gagner un match après avoir été mené 0-2.
- **Description i18n:** "Posez Braise. Ensuite, chaque défaite réduit le coût de votre prochaine carte de 1 (min 1). Cumulable."

---

**Carte #5 — ÉCHAPPÉE** (clarifiée — usage unique par round)

- **Coût:** 1 mana
- **Cible:** lane
- **Type:** active
- **Glyphe:** 🏃
- **Palette:** `#38bdf8` (bleu ciel vif)
- **Effet:** RETIREZ votre move de la lane choisie. La lane devient VIDE pour vous ce round (0 point possible). En contrepartie, piochez 1 carte immédiatement. L'adversaire a déjà placé son move sur cette lane → il ne marque pas de point. **Limite : 1 utilisation par round.** Jouer Échappée consomme votre action de carte pour ce round — vous ne pouvez pas l'enchaîner avec d'autres cartes.
- **Impact:** Sacrifiez une lane que vous alliez perdre de toute façon pour gagner un avantage de pioche et forcer un miss adverse. Usage défensif ou tactique, jamais abusif car limité à 1/round.
- **Unlock:** Gagner un round où vous avez perdu 2 lanes sur 3.
- **Description i18n:** "Abandonnez une lane. L'adversaire tape dans le vide. Piochez 1 carte. Limité à 1/round."

---

### 🔵 RARES — 6 cartes (2 mana)

---

**Carte #6 — ORACLE INVERSE** => VALIDE

- **Coût:** 2 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 🔮
- **Palette:** fuchsia
- **Effet:** RÉVÉLEZ les 3 cartes que l'adversaire a dans SA MAIN (pas ses moves — ses cartes). Vous voyez son arsenal pour les prochains rounds. L'adversaire ne voit PAS les vôtres en retour.
- **Impact:** Information stratégique pure. Savoir que l'adversaire a Supernova en main change TOUT. Vous pouvez jouer autour.
- **Unlock:** Utiliser Oracle (la carte existante) 3 fois dans des matchs différents.
- **Description i18n:** "Ouvrez la main de l'adversaire. Voyez ses 3 cartes."

---

**Carte #7 — FARDEAU** => VALLIDE

- **Coût:** 2 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 🪨
- **Palette:** zinc
- **Effet:** DONNEZ une carte de votre main à l'adversaire. Il l'ajoute à sa main. AU PROCHAIN ROUND, il DOIT jouer cette carte (elle est marquée, il ne peut pas la défausser ou l'ignorer). S'il ne la joue pas, il perd 2 pts. La carte donnée coûte 0 mana pour lui (vous lui offrez).
- **Impact:** Sabotez la stratégie adverse en lui imposant une carte qu'il n'a pas choisie. Si vous lui donnez une carte situationnelle (ex: Aegis sans menace), il perd un slot de main pour rien.
- **Unlock:** Gagner un match où l'adversaire a utilisé Heist contre vous (retournement).
- **Description i18n:** "Offrez une carte empoisonnée à l'adversaire. Il DOIT la jouer."

---

**Carte #8 — CRÉPUSCULE** => VALIDE

- **Coût:** 2 mana
- **Cible:** lane
- **Type:** active
- **Glyphe:** 🌅
- **Palette:** amber
- **Effet:** La lane ciblée devient "crépusculaire". CE round, les cartes ne peuvent PAS cibler cette lane (ni les vôtres ni celles de l'adversaire). PUR RPSLS sur cette lane. L'effet s'applique aux DEUX joueurs. Si une carte avait déjà été jouée sur cette lane, elle est annulée et retourne dans la main de son propriétaire.
- **Impact:** Créez une "zone neutre" temporaire. Utile pour échapper à un Aegis/Surge adverse ou pour protéger une lane que vous pensez gagner "naturellement".
- **Unlock:** Gagner un round sans utiliser aucune carte.
- **Description i18n:** "Plongez une lane dans la pénombre. Aucune carte ne peut l'atteindre."

---

**Carte #9 — CASCADE** => VALIDE

- **Coût:** 2 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** 💧
- **Palette:** sky
- **Effet:** Si vous GAGNEZ ce round, piochez jusqu'à remplir votre main (3 cartes). Les cartes piochées sont gratuites (coût 0 mana) pour le PROCHAIN round uniquement. Si vous PERDEZ ce round, défaussez toute votre main (pénalité).
- **Impact:** "All-in" — si vous êtes confiant, vous pouvez recharger complètement pour le round suivant. Si vous vous trompez, vous êtes puni.
- **Unlock:** Gagner un round en ayant 0 carte en main.
- **Description i18n:** "Si vous gagnez : main pleine, gratuite. Si vous perdez : main vide."

---

**Carte #10 — ÉCHO TEMPOREL** => VALIDE

- **Coût:** 2 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** 🕐
- **Palette:** violet
- **Effet:** REJOUEZ le round immédiatement APRÈS sa résolution. Le résultat initial est ANNULÉ. Les deux joueurs rejouent avec les MÊMES cartes en main (les cartes jouées au round annulé retournent dans les mains). Les moves peuvent être changés. Le nouveau résultat remplace l'ancien.
- **Impact:** "Mulligan" de round. Si vous avez fait une erreur ou si l'adversaire a eu de la chance, vous obtenez une seconde chance. Lui aussi.
- **Unlock:** Perdre un round par 1 point d'écart (score serré).
- **Description i18n:** "Annulez le round en cours. Rejouez-le immédiatement."

---

**Carte #11 — ANCRE TEMPORELLE** ✅ CORRIGÉ — ancrage TEMPOREL, pas immunité de lane

> **Différence avec la carte Anchor existante :** Anchor (Ancrage) protège UNE lane des cartes adverses. C'est une immunité SPATIALE (une zone safe). Ancre Temporelle sauvegarde l'ÉTAT COMPLET du match et peut le RESTAURER 2 rounds plus tard si tout va mal. C'est une assurance TEMPORELLE, pas une protection de zone. Aucun rapport mécanique.

- **Coût:** 2 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** ⚓
- **Palette:** `#22d3ee` (cyan vif)
- **Effet:** SAUVEZ l'état actuel du match (PV, cartes en main, score, pioche, mana). Si vous PERDEZ les 2 PROCHAINS rounds, l'état est RESTAURÉ au point de sauvegarde. Si vous gagnez au moins 1 des 2 rounds, l'ancre se dissipe sans effet.
- **Impact:** Filet de sécurité temporel. Permet de prendre des risques massifs sur 2 rounds, sachant que l'échec total est réversible.
- **Unlock:** Gagner un match où vous avez perdu 3 rounds consécutifs puis gagné (comeback massif).
- **Description i18n:** "Sauvegardez l'état du match. Si vous perdez les 2 prochains rounds, restaurez-le."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card featuring a massive anchor made of glowing energy chains, plunged into a swirling vortex of time. The anchor is bright cyan (#22d3ee) with a golden (#fbbf24) chain that spirals upward into a clock face above. The clock hands are frozen mid-tick. The card background is deep teal (#0f4c5c) fading to navy (#0a1628). Small hourglass and gear motifs decorate the card border in cyan. The glyph "⚓" is embossed in gold at the top-right. Style: cosmic-timey, luminous, mobile-game card art. 1024×1024 PNG.
```

---

### 🟣 EPICS — 6 cartes (3 mana sauf mention)

---

**Carte #12 — MÉTAMORPHOSE** => VALIDE

- **Coût:** 3 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** 🦋
- **Palette:** emerald
- **Effet:** SACRIFIEZ une carte de votre main. En échange, piochez une carte de la rareté SUPÉRIEURE (Common→Rare→Epic→Legendary). Si vous sacrifiez une Légendaire, piochez-en DEUX. Les cartes piochées sont ajoutées à votre main et coûtent 0 mana ce round.
- **Impact:** Montée en puissance. Transformez une carte faible en quelque chose de plus fort. Le sacrifice d'une Légendaire est un pari extrême.
- **Unlock:** Débloquer 15 cartes dans votre collection.
- **Description i18n:** "Sacrifiez une carte. Recevez une carte de rareté supérieure."

---

**Carte #13 — BOUCLIER DE GAÏA** (clarifiée — fonctionnement cross-mode)

> **Note sur les PV :** Dans les modes SANS système de PV explicite (Constellation classique, Casual), le bouclier absorbe TOUS les points perdus sur un round (1 round entier = annulé, score inchangé). Dans les modes AVEC PV (La Spirale, certains modes futurs), le bouclier absorbe tous les dégâts HP reçus ce round — le joueur ne perd aucun PV. Le bouclier ne se déclenche PAS sur un draw.

- **Coût:** 3 mana
- **Cible:** self
- **Type:** passive
- **Glyphe:** 🛡️
- **Palette:** `#34d399` (vert jade protecteur)
- **Effet:** PASSIF. Une fois par match, quand vous devriez PERDRE un round, les dégâts sont ANNULÉS. Le bouclier se consume après une utilisation. Ne se déclenche pas sur un draw. En modes avec PV, absorbe tous les HP du round. En modes sans PV, le round perdu devient un draw forcé (0 point pour l'adversaire).
- **Impact:** Immunité unique pour 1 round. Jouez agressivement sans crainte — ce round, rien ne peut vous atteindre.
- **Unlock:** Survivre à un round où l'adversaire a infligé 3+ dégâts (sur plusieurs lanes).
- **Description i18n:** "Une fois par match, absorbez tous les dégâts d'un round. Le round perdu devient un draw forcé."

---

**Carte #14 — MARCHAND D'ÂMES** => Valide

- **Coût:** 3 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 💀
- **Palette:** rose
- **Effet:** SACRIFIEZ 1 PV (vous perdez 1 point de vie immédiatement). En échange, piochez 3 cartes et gagnez +3 mana PERMANENT pour le reste du match (votre mana max augmente de 3). Le sacrifice de PV est le prix à payer pour la puissance future.
- **Impact:** "Faustien". Vous affaiblissez votre position immédiate pour un avantage colossal à long terme.
- **Unlock:** Gagner un match où vous avez fini avec exactement 1 PV restant.
- **Description i18n:** "Sacrifiez 1 PV. Gagnez +3 mana max et piochez 3 cartes."

---

**Carte #15 — TÉLÉPATHIE** (clarifiée — lecture silencieuse, l'adversaire ignore tout)

> **Principe de tension :** L'adversaire ne SAIT PAS que vous lisez dans son esprit. Il ne reçoit AUCUNE notification, aucun effet visuel, aucun indice. De son point de vue, le round se déroule normalement. La tension est ENTIÈREMENT dans votre camp — c'est VOUS qui détenez l'information secrète, et c'est VOUS qui devez l'exploiter sans éveiller les soupçons. Le coût de 3 mana est justifié par cette discrétion absolue (Oracle, qui coûte 3 mana aussi, ANNONCE visuellement sa lecture à l'adversaire).

- **Coût:** 3 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 🧠
- **Palette:** `#8b5cf6` (violet psychique)
- **Effet:** PÉNÉTREZ silencieusement l'esprit de l'adversaire. Voyez le MOVE qu'il va jouer CE round sur CHAQUE lane, SANS qu'il le sache (aucune notification, aucun indicateur visuel côté adverse). De plus, vous pouvez CHANGER un de vos propres moves APRÈS avoir vu les siens (un seul, sur une lane de votre choix). L'adversaire ne voit pas que vous avez changé.
- **Impact:** Oracle DISCRET + flexibilité. L'adversaire joue normalement, ignorant que vous anticipez chacun de ses gestes. La pression mentale est 100% dans votre tête — et c'est ça qui rend la carte jubilatoire.
- **Unlock:** Utiliser Augur 5 fois dans des matchs différents (déblocage progressif).
- **Description i18n:** "Lisez les 3 moves adverses en secret. Changez UN de vos moves après."

---

**Carte #16 — PARADOXE TEMPOREL** (clarifiée — usage limité à 1/match)

- **Coût:** 3 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** ⏳
- **Palette:** `#06b6d4` (cyan vif)
- **Effet:** SAUTEZ le round en cours. Il n'y a PAS de résolution. Pas de gagnant, pas de perdant, pas de points. On passe DIRECTEMENT au round suivant. Les cartes jouées ce round retournent dans les mains. Le mana dépensé (y compris les 3 de Paradoxe Temporel) est remboursé. **Limite : 1 utilisation par match.** La carte est défaussée après usage (comme toutes les Épiques/Légendaires).
- **Impact:** "Skip turn". Utile quand le round s'annonce désastreux — vous annulez un round que vous alliez perdre. L'adversaire perd aussi son opportunité de marquer. Le remboursement de mana rend la carte neutre en ressources (coût net = 0, juste la carte consommée).
- **Unlock:** Gagner un match après qu'un round ait été un draw.
- **Description i18n:** "Sautez ce round. Pas de résolution. Mana remboursé. 1/match."

---

**Carte #17 — BÉNÉDICTION** => OK

- **Coût:** 3 mana
- **Cible:** self
- **Type:** active
- **Glyphe:** ✨
- **Palette:** yellow
- **Effet:** Ce round, vos moves gagnent +1 pt bonus sur CHAQUE lane gagnée (au lieu de +1, vous gagnez +2). MAIS l'adversaire gagne aussi +1 pt bonus sur ses lanes gagnées. La bénédiction est universelle — les deux joueurs en profitent, mais VOUS décidez QUAND l'activer.
- **Impact:** Accélère le score. Activez quand vous êtes CONFIENT de gagner plus de lanes que l'adversaire. Si vous vous trompez, vous lui offrez un avantage.
- **Unlock:** Gagner un round en ayant gagné 2 lanes sur 3 avec une marge de +2 pts.
- **Description i18n:** "Toutes les lanes gagnées valent +2 pts. Pour vous ET l'adversaire."

---

### 🟡 LEGENDARIES — 3 cartes (4 mana)

---

**Carte #18 — LE CHOIX DE SCHRÖDINGER**

- **Coût:** 4 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** 📦
- **Palette:** `#c084fc` (fuchsia quantique)
- **Effet:** SÉLECTIONNEZ 2 moves différents. Vous les placez TOUS LES DEUX sur CHAQUE lane (superposition quantique). Le move gagnant compte. Double win = +3 bonus, double loss = -2 pénalité.
- **Impact:** Couverture de 2 options/5 par lane. Le "chat de Schrödinger" appliqué au RPSLS.
- **Unlock:** Gagner un match où chaque round a eu un résultat différent.
- **Description i18n:** "Superposez 2 moves par lane. Le meilleur compte."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card showing a mysterious sealed box at its center — Schrödinger's box — with quantum wave-particles (⇿) oscillating around it. The box is slightly open, revealing TWO ghostly hands emerging simultaneously, each forming a different RPSLS gesture (one Rock, one Paper). The hands are translucent, overlapping, existing in superposition. Above the box, a cat silhouette fades in and out of visibility — both alive and not. The background is a deep quantum purple (#0d001a) with probability wave interference patterns (rippling concentric circles in #c084fc at 20% opacity). The card border is fuchsia (#c084fc) with alternating solid/dashed lines representing wave-particle duality. Glyph "📦" embossed in white-gold at top-right. 1024×1024 PNG with transparency on the outer card edges. Style: quantum physics, mysterious, elegant, mobile-game card art.
```

---

**Carte #19 — LE JUGE**

- **Coût:** 4 mana
- **Cible:** none
- **Type:** active
- **Glyphe:** ⚖️
- **Palette:** `#eab308` (or solaire de justice)
- **Effet:** CHAQUE lane est jugée sur des CRITÈRES, pas le RPSLS. Lane 1 = PV, lane 2 = Cartes en main, lane 3 = Rounds gagnés. Les moves sont IGNORÉS.
- **Impact:** Les règles normales sont suspendues. Ce sont vos STATS qui comptent.
- **Unlock:** Gagner un match en dominant PV, cartes ET rounds simultanément.
- **Description i18n:** "Ce round, ignorez les moves. Jugez sur PV, cartes en main, et historique."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card dominated by a massive golden (#eab308) balance scale in the center. Each of the three scale pans holds a different symbol: the left pan holds a glowing red heart (HP), the center pan holds three miniature cards (hand size), and the right pan holds a trophy icon (rounds won). The scale is tilted — one pan heavier than the others. Below the scale, three lane markers are shown but their RPSLS symbols are CROSSED OUT with golden X marks. A judge's gavel hovers above, about to strike. The background is a solemn courtroom grey-black (#0d0d0d) with faint law-text columns in gold. The card border is gold with balance-scale corner motifs. Glyph "⚖️" embossed in brilliant gold at top-right. 1024×1024 PNG with transparency on the outer card edges. Style: judicial, authoritative, dramatic, mobile-game card art.
---

**Carte #20 — GENÈSE**

- **Coût:** 4 mana
- **Cible:** none
- **Type:** active (usage unique — retirée du jeu après utilisation)
- **Glyphe:** 🌟
- **Palette:** `#fef08a` (jaune stellaire brillant)
- **Effet:** RÉINITIALISEZ le match. Score 0-0, PV max, cartes remélangées, mana reset. Le match recommence.
- **Impact:** "Nouvelle partie". Efface tout — erreurs et avantages. Une seule utilisation par match.
- **Unlock:** Accomplir TOUTES les quêtes du jeu (12 quêtes de base). Carte ultime.
- **Description i18n:** "Réinitialisez le score. Le match recommence. Une seule fois."

**🎨 PROMPT ILLUSTRATION:**
```
A playing card showing a cosmic rebirth — a brilliant starburst of pure white-gold (#fef08a) light exploding from the center, pushing away darkness in all directions. The light forms the shape of a phoenix with wings of stellar dust, rising from what was. Below the starburst, the remnants of the old match — broken score markers, shattered card fragments, extinguished mana crystals — are swept toward the card's edges, dissolving into nothing. The background transitions from deep void-black (#000000) at the edges to brilliant golden-white (#fef08a) at the center. The card border is white-gold with radiant halo effects. Glyph "🌟" embossed in blinding white at top-right. This should be the most brilliant, hopeful, "new beginning" card in the entire game. 1024×1024 PNG with transparency on the outer card edges. Style: cosmic rebirth, divine light, ultimate hope, mobile-game card art.
```

---

## Résumé des 20 cartes V3

| # | Nom | Rareté | Coût | Type | Mécanique clé |
|---|------|--------|------|------|---------------|
| 1 | Sablier | Common | 1 | active | Accélère/ralentit le chronomètre du round |
| 2 | Miroir Liquide | Common | 1 | active | Copie le dernier move adverse |
| 3 | Offre | Common | 1 | active | Révèle son move → +2 mana next round |
| 4 | Braise | Common | 1 | active | Perdre réduit le coût des prochaines cartes |
| 5 | Échappée | Common | 1 | active | Abandonne une lane → pioche 1 carte |
| 6 | Oracle Inverse | Rare | 2 | active | Révèle les 3 cartes dans la main adverse |
| 7 | Fardeau | Rare | 2 | active | Donne une carte empoisonnée à l'adversaire |
| 8 | Crépuscule | Rare | 2 | active | Une lane devient "pure RPSLS" — pas de cartes |
| 9 | Cascade | Rare | 2 | active | Gagner = main pleine gratuite / Perdre = main vide |
| 10 | Écho Temporel | Rare | 2 | active | Rejoue le round après résolution |
| 11 | Ancre Temporelle | Rare | 2 | active | Sauvegarde l'état → restaure si 2 pertes |
| 12 | Métamorphose | Epic | 3 | active | Sacrifie une carte → pioche rareté supérieure |
| 13 | Bouclier de Gaïa | Epic | 3 | passive | Immunité unique : absorbe tous les dégâts d'un round |
| 14 | Marchand d'Âmes | Epic | 3 | active | Sacrifie 1 PV → +3 mana max + 3 cartes |
| 15 | Télépathie | Epic | 3 | active | Lit les 3 moves adverses + change 1 move |
| 16 | Paradoxe Temporel | Epic | 3 | active | Saute le round entier |
| 17 | Bénédiction | Epic | 3 | active | Toutes les lanes gagnées valent +2 pts (les deux joueurs) |
| 18 | Le Choix de Schrödinger | Leg | 4 | active | 2 moves superposés par lane — le meilleur compte |
| 19 | Le Juge | Leg | 4 | active | Ignore le RPSLS — juge sur PV, cartes, historique |
| 20 | Genèse | Leg | 4 | active | Reset complet du match (score, PV, cartes) |

---

## Nouvelles mécaniques introduites (V3)

| Mécanique | Carte(s) | Description |
|-----------|----------|-------------|
| **Manipulation du chronomètre** | Sablier | Accélère ou ralentit la deadline du round |
| **Copie du move passé** | Miroir Liquide | Rejoue le move adverse du round précédent |
| **Transparence payante** | Offre | Annonce son move contre +2 mana futur |
| **Bonus de défaite** | Braise | Les pertes réduisent le coût des cartes |
| **Abandon de lane** | Échappée | Sacrifie une lane pour piocher |
| **Vision de la main adverse** | Oracle Inverse | Voit les cartes (pas les moves) de l'adversaire |
| **Carte imposée** | Fardeau | Donne une carte à l'adversaire qu'il DOIT jouer |
| **Zone neutre** | Crépuscule | Une lane immunisée aux cartes |
| **All-in pioche** | Cascade | Gagner = main pleine / Perdre = main vide |
| **Mulligan de round** | Écho Temporel | Rejoue le round |
| **Sauvegarde d'état** | Ancre Temporelle | Point de restauration si échec |
| **Ascension de rareté** | Métamorphose | Sacrifice → carte de rareté supérieure |
| **Immunité unique** | Bouclier de Gaïa | Absorbe tous les dégâts d'un round |
| **Sacrifice de PV** | Marchand d'Âmes | -1 PV → +3 mana max + 3 pioches |
| **Lecture + adaptation** | Télépathie | Voit les moves + change 1 move |
| **Skip de round** | Paradoxe Temporel | Passe au round suivant |
| **Bonus symétrique** | Bénédiction | +2 pts par lane gagnée pour les deux joueurs |
| **Superposition quantique** | Le Choix de Schrödinger | 2 moves/lane, le meilleur compte |
| **Jugement alternatif** | Le Juge | Ignore le RPSLS, juge sur stats |
| **Reset complet** | Genèse | Recommence le match à zéro |

---

## Plan d'intégration

### Étape 1 — Types (rankedTypes.ts)
- Ajouter 20 nouveaux `CardId` dans l'union type
- Ajouter les nouvelles cibles : `"hand-reveal"`, `"timeline"`, `"sacrifice-hp"`, `"quantum"`, `"judgment"`
- Étendre `PlayedCard` pour les nouvelles formes

### Étape 2 — Registre (cards.ts)
- Ajouter 20 entrées dans `CARDS`
- Définir `glyph`, `palette`, `nameKey`, `descKey`, `targetHintKey`
- Assigner les coûts de mana (1, 2, 3, 4)

### Étape 3 — Logique de résolution (nouveau fichier : ranked/cardEffectsV3.ts)
- Implémenter chaque effet
- Certains nécessitent de modifier le moteur de round (Sablier, Écho Temporel, Paradoxe Temporel, Genèse)
- D'autres modifient l'UI (Oracle Inverse, Télépathie, Fardeau)

### Étape 4 — i18n
- 20 cartes × 3 clés = 60 clés dans en.ts
- Traduction dans les 14 autres locales
- Les noms sont volontairement simples à traduire (1-3 mots)

### Étape 5 — Équilibrage
- Tests des cartes manipulant le temps (Sablier, Écho, Paradoxe)
- Tests des cartes à haut impact (Genèse, Choix de Schrödinger)
- Ajustement des coûts de mana

---

## Tableau global des cartes

| Phase | Cartes | Total cumulé |
|-------|--------|-------------|
| Base (existantes) | 26 | 26 |
| V2 (proposées) | 14 | 40 |
| **V3 (ce document)** | **20** | **60** |
| **TOTAL** | **60** | |

---

## Équilibrage — Notes importantes

- **Sablier** : La réduction à 6s est TRÈS agressive. Envisager 8s minimum si c'est trop punitif.
- **Genèse** : La carte la plus puissante du jeu. Limiter à 1 exemplaire par deck, et usage unique. Le coût de 4 mana + le fait que les cartes "hors du temps" ne reviennent pas limite sa puissance.
- **Le Choix de Schrödinger** : La superposition donne un avantage statistique significatif. Le risque de -2 pts par lane en cas de double perte est le contrepoids. Les maths : 2 moves sur 5 = 40% de chance de gagner par lane (vs 20% normalement). Mais -2 pts si les deux perdent (25% de chance par lane si l'adversaire couvre les 3 autres moves).
- **Le Juge** : Change complètement la méta. Si vous savez que l'adversaire a Le Juge, vous devez gérer vos PV, cartes, et historique différemment.
- **Marchand d'Âmes** : -1 PV pour +3 mana permanent est un trade extrêmement favorable sur la durée. Le joueur doit survivre assez longtemps pour en bénéficier.