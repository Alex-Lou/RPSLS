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
```
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

## 📋 RÉALITÉ D'IMPLÉMENTATION (2026-06-08)

> Cette section documente ce qui est ACTUELLEMENT en jeu sur la branche `lanes-bonus-v3`, vs la spec ci-dessus. Le total réel est **46 cartes** (15 base + 11 Lot 1 + 20 V3), pas 60 — la V2 a été remplacée par le Lot 1 plus tôt.

### Contexte gameplay Constellation (sur lequel les cartes opèrent)

- **Format** : Tournoi Bo3/Bo5, 3 lanes par round, picks RPSLS
- **Mana** : round 1 = 2m, round 2 = 3m, round 3+ = 4m (5m avec passive Cadence, +3 permanent avec Marchand d'Âmes)
- **Main** : 3 cartes max (pickable depuis un deck de 8 — les passives sortent du pool de pioche)
- **Pioche** : +1 carte par round si tu as gagné le round précédent
- **Défaite de round** : −1 carte aléatoire de la main (sauf passives)
- **Une carte/round** maximum (pas de combo de cartes dans le même round → contrainte forte sur le design)
- **Pas de timer vs CPU** (le joueur prend son temps) — les cartes time-based (Sablier) sont reskinnées en tempo

### Audit des bugs trouvés & corrigés (sur la branche)

| Carte | Bug initial | Statut |
|---|---|---|
| **Oracle** (3m base) | `void oracleRevealed` — l'état était set mais jamais passé au composant, donc rien ne s'affichait | ✅ FIX commit `9b???` — plumbed à travers RankedMatchView → RankedPickPhase → LanesBoard → OpponentRow |
| **Télépathie** (3m V3) | Hérite du même bug Oracle puisqu'elle utilisait `setOracleRevealed` | ✅ FIX en cascade avec Oracle |
| **Braise** (1m V3) | Le discount s'appliquait au paiement mais l'UI continuait d'afficher le coût d'origine → cartes 2m affichées injouables même quand le discount aurait permis. | ✅ FIX — state mirror + threadé `braiseStacks` à CardHand → pip orange + 🔥 + effective cost dans le check `playable` |
| **Fardeau** (2m V3) | La CPU avait la carte forcée dans son `hand: [fardeau]` mais `chooseCpuCard` rollait `playChance` et pouvait skip (50% normal / 72% hard) → la carte poison n'était pas garantie de partir | ✅ FIX — override `cpuDecision.card = { id: forcedFardeau }` après l'appel si null |

### Feedback visuel ajouté (chips strip + lane indicators)

Chaque effet cross-round a maintenant un chip qui dit ce qui se passe :
- 🔥 **Braise −N mana** sur la prochaine carte (chip + pips orange dans la main)
- ⏱️ **+N mana au prochain round** (Sablier +1, Offre +2)
- 🎭 **Désinformation armée** (Mascarade, l'IA jouera à l'aveugle next round)
- 💧 **Cascade armée** (win = main pleine, lose = main vide)
- 🕐 **Écho actif** (stop-loss prêt, défaite annulée + carte refundée)
- ⚓ **Ancre N/2 rounds restants**
- 🛡️ **Bouclier de Gaïa chargé** (1 défaite à absorber)
- 🧭 **Boussole** : badge cyan + ghost-card sur la lane ciblée par la carte adverse
- 🌅 **Crépuscule** : la lane ciblée s'illumine ambre, badge soleil dans le coin

### Carte par carte — comportement RÉEL

| Carte | Coût | Effet réel implémenté | Différence vs spec |
|---|---|---|---|
| **Sablier** | 1m | Draw +1 immédiat + Mana +1 au prochain round | Pas de choix 6s/20s (vs CPU pas de timer). Reskinné en tempo. |
| **Rémanence** | 1m, lane | Remplace ton coup sur la lane par le coup adverse du round PRÉCÉDENT (fallback sur le coup actuel si round 1) | OK conforme. Pas de "fantôme insaisissable" — c'est juste un swap de move. |
| **Offre** | 1m | +2 mana au prochain round | La "révélation à l'adversaire" est cosmétique vs CPU (CPU s'en fout, mais c'est annoncé via chip). |
| **Braise** | 1m | Stack += 1 par round perdu APRÈS pose. Discount = max(1, cost - stack) sur la PROCHAINE carte (reset après play). | OK conforme. Discount maintenant **visible** dans la main. |
| **Échappée** | 1m, lane | Vide ta lane (0-0 forcé) + pioche 1 carte | OK conforme. Limite 1/round naturelle car 1 carte/round. |
| **Oracle Inverse** | 2m | Révèle 3 cartes random de la main notionnelle CPU (chips 🔮 visibles) | OK conforme. |
| **Fardeau** | 2m | Force la CPU à jouer `second-wind` au prochain round | Simplification : on n'a pas de UI pour choisir "quelle carte donner" → on force toujours second-wind (carte faible no-target). |
| **Crépuscule** | 2m, lane | Lane immunisée aux effets de cartes (les deux côtés). Badge ambre. | OK conforme. La carte qui A SET le twilight n'est PAS annulée (sinon Crépuscule s'auto-annulerait). |
| **Cascade** | 2m | Win → main rerempli (gratuit next round). Lose → main vidée. | OK conforme. |
| **Écho Temporel** | 2m | Si tu perds ce round, il devient draw + carte refundée + mana refundée. | Simplifié : pas de "rejeu" complet du round (CPU ne rejoue pas), juste un stop-loss. |
| **Ancre Temporelle** | 2m | Snapshot (winsA/B, hand, deck, discard). Restauré si 2 défaites consécutives sous la garde. Chip ⚓ countdown visible. | OK conforme. |
| **Métamorphose** | 3m | Auto-sacrifice de la carte de plus basse rareté en main + draw 1 (ou 2 si legendary sacrifiée) de rareté supérieure. | Simplification : pas de modal pour choisir quelle carte sacrifier. |
| **Bouclier de Gaïa** | 3m, **passive** | Chargé au start. À la première round qui serait une défaite, toutes tes lanes perdues deviennent draws. Chip 🛡️ visible tant que la charge dispo. | OK conforme. |
| **Marchand d'Âmes** | 3m | −1 carte aléatoire (proxy PV) + Mana cap +3 PERMANENT + Draw 3 | Simplifié : pas de système HP réel → discard d'une carte au lieu de PV. |
| **Télépathie** | 3m | Révèle silencieusement les 3 moves adverses (face-up dans OpponentRow comme Oracle) | OK conforme. Le côté "silencieux vs notification" est sans effet vs CPU. |
| **Paradoxe Temporel** | 3m | Saute la résolution complète. Refund mana + carte burned. **Limite 1/match** (ref `paradoxeUsedRef`). | OK conforme. |
| **Bénédiction** | 3m | +1 par lane gagnée pour les DEUX joueurs ce round | OK conforme. Spec disait "+2/lane" mais on a fait "+1" pour ne pas multiplier par 5 le score. |
| **Choix de Schrödinger** | 4m | Pour chaque lane : si le contre canonique de l'opp est différent de ton coup, on remplace ton coup par ce contre. | Simplifié : pas de vraie "superposition de 2 moves". Effet = "tu obtiens automatiquement le meilleur des 2 coups par lane". |
| **Le Juge** | 4m | Résolution remplacée : lane 0 = round wins (A vs B), lane 1 = main size (A vs CPU oppHandSize), lane 2 = deck size (A vs CPU notional pool minus burned) | Simplifié : on n'a pas de PV → wins/hand/deck à la place. |
| **Genèse** | 4m | Reset complet : roundWins=0, deck reshuffle full (deck+hand+discard+usedOneShot), hand vide. **Limite 1/match**. | Risque timing : applique le reset via `setTimeout(50ms)` + ré-entrée dans `startNextRound`. Fragile si match-end coincide. |

### Équilibrage — observations vraies-game à valider sur device

- **Sablier 1m** = très fort en early : 1m → 2 ressources (1 pioche + 1 mana). À surveiller.
- **Braise 1m** = doit être joué tôt pour valoir le coup. Si tu perds 0 round après pose, c'est un waste 1m.
- **Marchand 3m permanent +3 mana** = potentiellement game-changing. En Bo3 court, peut être trop cher (3m pour un effet qui se manifeste sur 2 rounds restants).
- **Genèse 4m** = quasi inutile en Bo3 (rare d'avoir le mana à 4 avant que le match soit déjà décidé). Plus pertinente en Bo5.
- **Le Juge 4m** = dépend complètement de l'état du match. Si tu mènes au score mais perds en main+deck, c'est risqué.
- **Schrödinger 4m** = quasi-sweep auto si l'opp joue prévisible. Trop fort ?
- **Bénédiction +1/lane partagé** = pari basé sur "je gagnerai plus de lanes que toi" — fonctionne en début de round si on a anticipé.

### Limites connues (TODO post-validation)

- **Crépuscule joué par la CPU** n'est pas visible côté joueur en pick phase (oppCard pas révélé avant reveal) → le ghost ambre ne pop que pour TES Crépuscules. À corriger via plumb de `compassPeek` enrichi.
- **Métamorphose** : l'utilisateur ne choisit pas quoi sacrifier (auto lowest rarity). Pourrait être un modal post-MVP.
- **Marchand "−1 carte"** : proxy PV, pas le vrai sacrifice de vie de la spec.
- **Genèse timing** : setTimeout 50ms entre setBattle reset et startNextRound — testé OK mais théoriquement race-condition possible.

---

## ⚜️ BLOC SPÉCIAL — Cartes du Tournoi Épique

**Concept:** Le Tournoi Épique est un événement temporaire (quelques jours par saison) où les joueurs s'affrontent dans une arène spéciale. Pendant le tournoi, chaque joueur reçoit **2 Cartes de Tournoi** ajoutées à sa main au début de chaque match. Ces cartes sont :

- **Prêtées, pas possédées** — elles n'apparaissent JAMAIS dans la collection, le codex, ou les packs
- **Usage unique absolu** — jouées une fois, elles sont consumées pour toujours. Pas dans la défausse, pas de récupération possible
- **Non craftables, non achetables** — aucune monnaie (Éclats, Poussière, ✦ Stars) ne peut les obtenir
- **Gagnables en jeu** — des cartes supplémentaires peuvent être gagnées en accomplissant des exploits pendant le tournoi
- **Coût 0 mana** — ce sont des dons de l'arène, pas des cartes de deck normales. Leur rareté est leur condition d'obtention

### Comment les joueurs les obtiennent

Au début de chaque match du tournoi, 2 cartes sont piochées aléatoirement depuis le **Pool du Tournoi** (12 cartes) et ajoutées à la main du joueur, AU-DESSUS de la limite normale de 3 cartes (la main peut temporairement contenir 5 cartes). Si le joueur ne les joue pas, elles disparaissent à la fin du match.

**Gain de cartes supplémentaires en cours de tournoi :**

| Fait d'armes | Récompense |
|-------------|-----------|
| Gagner un round avec un Flawless Sweep (3-0) | +1 carte de tournoi aléatoire |
| Gagner un match après avoir été mené 0-2 | +1 carte de tournoi aléatoire |
| Gagner 3 matchs consécutifs dans le tournoi | +1 carte de tournoi aléatoire (Épique ou Légendaire) |
| Battre un adversaire de rang supérieur | +1 carte de tournoi aléatoire |
| Réussir un combo MIRROR (mêmes moves que l'adversaire) | +1 carte de tournoi aléatoire |
| Gagner le tournoi (1ère place) | Les 12 cartes du pool sont débloquées pour le match FINAL |

### 🟣⚜️ Cartes de Tournoi (12 cartes — coût 0 mana)

> **Nouveau type de cible:** `"tournament"` — ces cartes ne suivent pas les règles normales. Elles sont jouées DEPUIS un slot spécial et leur effet est immédiat, sans consommer l'action de carte normale du round (le joueur peut encore jouer une carte normale ensuite).

---

**Carte T1 — FULGURANCE** ⚡

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu, détruite après usage)
- **Glyphe:** ⚡
- **Palette:** `#fbbf24` (jaune éclair)
- **Effet:** JOUEZ immédiatement. Votre prochain move qui GAGNE ce round inflige +2 dégâts BONUS. Si vous gagnez plusieurs lanes, le bonus s'applique à CHAQUE lane gagnée.
- **Impact:** Dévastateur si vous êtes confiant dans vos placements. Transforme une victoire serrée en raz-de-marée.
- **Condition d'obtention:** Gagner un round en ayant placé vos 3 moves en moins de 5 secondes.
- **Description i18n:** "Électrifiez vos poings. +2 dégâts sur chaque lane gagnée ce round."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card wreathed in crackling golden lightning (#fbbf24). The center shows a clenched fist engulfed in electric discharge — bright white core with golden-yellow arcs branching outward in 5 directions (one per RPSLS move). The fist is dynamic, mid-punch, with motion blur streaks. The card background is storm-grey (#1a1a2e) with lightning-bolt patterns. The border is brilliant gold with intermittent electric sparks at the corners. A tournament ribbon banner across the top reads "TOURNOI" in gold. Glyph "⚡" embossed in white-gold at top-right. Style: high-energy, explosive, tournament-championship feel. 1024×1024 PNG.
```

---

**Carte T2 — APOCALYPSE** 💥

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 💥
- **Palette:** `#ef4444` (rouge apocalyptique)
- **Effet:** DÉTRUISEZ TOUTES les cartes en main des DEUX joueurs. Elles ne vont pas en défausse — elles sont RETIRÉES du match. Les deux joueurs piochent ensuite 3 nouvelles cartes de leur deck. Si le deck est vide, la défausse est mélangée.
- **Impact:** Reset total des mains. Détruit les stratégies préparées — excellent si vous avez une main faible et soupçonnez l'adversaire de garder une Légendaire.
- **Condition d'obtention:** Gagner un round avec un Flawless Sweep (3-0).
- **Description i18n:** "Anéantissez toutes les mains. Les deux joueurs repiochent 3 cartes."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card showing a mushroom cloud of fiery destruction (#ef4444) consuming a field of playing cards at the bottom. The cards are mid-disintegration — turning to ash and embers. The cloud is orange-red (#ef4444 → #f97316) with dark smoke billowing outward. Above the destruction, a beam of light pierces through, and 3 pristine new cards descend from the light — a phoenix-like rebirth. The card border is dark crimson with ember-glow edges. Tournament ribbon at top. Glyph "💥" embossed in fire-orange. 1024×1024 PNG.
```

---

**Carte T3 — RÉSURRECTION** 🕊️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🕊️
- **Palette:** `#fef08a` (blanc doré céleste)
- **Effet:** Si vous PERDEZ ce round, annulez la défaite. Le round est REJOUÉ immédiatement avec les MÊMES cartes en main. Vous gagnez +2 mana pour ce nouveau round. L'adversaire garde ses moves (il ne peut pas les changer). VOUS pouvez changer les vôtres.
- **Impact:** Filet de sécurité divin. L'adversaire révèle sa stratégie, puis VOUS vous adaptez avec un avantage de mana. Psychologiquement dévastateur pour l'adversaire.
- **Condition d'obtention:** Gagner un match après avoir été mené 0-2.
- **Description i18n:** "Si vous perdez, annulez et rejouez. +2 mana. Changez vos moves."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card with a radiant white-gold phoenix rising from ash at the center. The phoenix is mid-transformation — wings half-open, body transitioning from ash-grey (#6b7280) at the bottom to brilliant white-gold (#fef08a) at the top. A broken score marker (0-2) is being restored to (1-2) by golden light. The background is deep navy (#0f172a) with soft white-gold rays radiating from the phoenix. The border is white-gold with a subtle feathered pattern. Tournament ribbon at top. Glyph "🕊️" embossed in gold. Style: hopeful, divine, dramatic resurrection. 1024×1024 PNG.
```

---

**Carte T4 — OMNISCIENCE** 👁️‍🗨️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 👁️‍🗨️
- **Palette:** `#8b5cf6` (violet omniscient)
- **Effet:** RÉVÉLEZ TOUT pour CE round : les 3 moves adverses, les 3 cartes dans sa main, ET les 2 prochaines cartes de sa pioche. L'information est TOTALE. L'adversaire ne sait PAS que vous savez (comme Télépathie, mais plus puissant).
- **Impact:** Vision parfaite. Aucune excuse pour perdre un round où vous savez tout. Combine avec Offre (Carte V3 #3) pour un mind-game ultime.
- **Condition d'obtention:** Réussir 5 prédictions correctes avec Augur/Oracle/Télépathie pendant le tournoi.
- **Description i18n:** "Voyez tout : moves, main, et pioche adverse. Secret absolu."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card dominated by a single massive, all-seeing eye (#8b5cf6) in the center. The eye's iris is a galaxy spiral — deep violet with tiny star-points. From the eye, three beams of violet light shoot downward, each illuminating a different vision: on the left, 3 RPSLS hand gestures (the opponent's moves), in the center, 3 miniature cards face-up (the opponent's hand), on the right, 2 ghostly cards still fading in (the next draws). The background is void-black (#0a0a1a) with subtle eye-shaped nebula patterns. The border is deep violet with an iris-texture ring. Tournament ribbon at top. Glyph "👁️‍🗨️" embossed in violet-white. Style: mystical, all-knowing, cosmic surveillance. 1024×1024 PNG.
```

---

**Carte T5 — JOKER** 🃏

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🃏
- **Palette:** `#c084fc` (violet joker)
- **Effet:** Transforme UN de vos moves (sur UNE lane) en JOKER. Le Joker BAT TOUS les autres symboles — Rock, Paper, Scissors, Lizard, Spock. Si l'adversaire joue AUSSI un Joker sur cette même lane : draw. Le Joker remplace votre move normal sur cette lane.
- **Impact:** Victoire garantie sur une lane. Choisissez la lane décisive. Mais si l'adversaire a aussi un Joker…
- **Condition d'obtention:** Gagner un round où vous et l'adversaire avez joué exactement le même move sur une lane (mirror partiel).
- **Description i18n:** "Votre move devient un Joker — il bat TOUT. Sauf un autre Joker."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament playing card featuring a majestic, grinning jester figure at center, but the jester's face is a cosmic void with star-eyes (#c084fc). The jester holds 5 cards fanned out — Rock, Paper, Scissors, Lizard, Spock — but all 5 are morphing into a single Joker card with a wild "✶" symbol. The background is a checkerboard pattern of deep purple (#1a0033) and midnight black (#0d001a) with the checker squares slowly dissolving into chaos at the edges. The border is fuchsia with alternating card-suit symbols (♠♣♥♦) in the corners. A tournament ribbon at the top. Glyph "🃏" embossed in violet-silver at top-right. Style: playful, chaotic, wild-card energy, mobile-game card art. 1024×1024 PNG.
```

---

**Carte T6 — CATACLYSME** 🌪️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🌪️
- **Palette:** `#94a3b8` (gris tempête)
- **Effet:** MÉLANGEZ ALÉATOIREMENT tous les moves DÉJÀ PLACÉS sur le plateau. Les vôtres ET ceux de l'adversaire sont redistribués aléatoirement sur les 3 lanes. Les moves eux-mêmes ne changent pas — c'est leur POSITION qui devient chaotique. Jouez cette carte APRÈS que les deux joueurs ont placé leurs moves mais AVANT la révélation.
- **Impact:** Chaos total. Une lane que vous pensiez gagner peut soudainement devenir une défaite. L'adversaire subit le même chaos. Parfait si vous êtes en situation désespérée et que "n'importe quel autre arrangement" serait meilleur.
- **Condition d'obtention:** Gagner un round après avoir utilisé Vortex (la carte existante).
- **Description i18n:** "Mélangez toutes les positions. Vos moves et ceux de l'adversaire changent de lane."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card depicting a violent tornado (#94a3b8) ripping through a 3-lane battlefield. The tornado is at center, and the 3 lanes are being sucked into it — lane markers, hand gestures, and card fragments spiraling upward in the vortex. At the bottom, the two player avatars brace themselves, their moves scattered. Debris of the old lane order fly outward. The background is storm-cloud dark (#1e293b) with lightning flashes in the tornado. The border is grey-silver with a swirling wind pattern. Tournament ribbon. Glyph "🌪️" embossed in silver. 1024×1024 PNG.
```

---

**Carte T7 — PRÉMONITION** 🔮

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🔮
- **Palette:** `#06b6d4` (cyan prophétique)
- **Effet:** RÉVÉLEZ les 3 PROCHAINS moves que l'adversaire va jouer (rounds suivants, pas ce round-ci). L'information est affichée dans un panneau spécial : "Round +1: Rock, Round +2: Paper, Round +3: Scissors". Ces moves sont BLOQUÉS — l'adversaire ne pourra PAS les changer (il s'est "engagé" sans le savoir).
- **Impact:** Connaissance parfaite des 3 prochains rounds. L'adversaire est prisonnier de ses propres choix futurs. Planifiez votre stratégie sur 3 rounds d'avance.
- **Condition d'obtention:** Gagner 3 rounds consécutifs dans le tournoi.
- **Description i18n:** "Voyez et bloquez les 3 prochains moves adverses. Planifiez l'avenir."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card centered on a crystal ball (#06b6d4) floating above two hands. Inside the crystal ball, three ghostly RPSLS hand gestures appear in sequence (Rock→Paper→Scissors), connected by a luminous timeline thread. The crystal ball emits cyan light rays downward, freezing the opponent's avatar below in a block of translucent ice — they're locked into their future choices. The background is deep navy (#0c1d3b) with constellation lines connecting prophetic stars. The border is cyan with a clock-gear pattern. Tournament ribbon. Glyph "🔮" embossed in cyan-white. 1024×1024 PNG.
```

---

**Carte T8 — MÉTÉORE** ☄️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** ☄️
- **Palette:** `#f97316` (orange météore)
- **Effet:** Choisissez UNE lane. Cette lane est FRAPPÉE par un météore et ANNULÉE pour ce round. Ni vous ni l'adversaire ne marquez de point sur cette lane — elle est retirée du round. Les deux joueurs piochent +1 carte en compensation (le météore libère de l'énergie).
- **Impact:** Supprimez une lane que vous alliez perdre. Le round devient un 2-lanes au lieu de 3-lanes. Utile si l'adversaire a massivement investi une lane.
- **Condition d'obtention:** Perdre une lane avec un écart de +3 points ou plus (sur un round précédent).
- **Description i18n:** "Annulez une lane entière. Le round se joue sur 2 lanes."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card showing a blazing meteor (#f97316) crashing diagonally across the frame. The meteor has a brilliant white-hot core and an orange-red tail of fire and debris. It strikes one of 3 lane markers at the bottom, obliterating it — the lane shatters into fragments, leaving only 2 intact lanes. The impact creates concentric shockwave rings. The background is the dark of space (#0a0a1a) with small stars. The border is burnt orange with a cratered, rocky texture. Tournament ribbon. Glyph "☄️" embossed in fire-orange. 1024×1024 PNG.
```

---

**Carte T9 — MIMÉTISME** 🦎

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🦎
- **Palette:** `#10b981` (vert mimétique)
- **Effet:** REGARDEZ la carte que l'adversaire a jouée CE round. Si elle est encore dans sa main (utilisable), COPIEZ-LA et jouez-la GRATUITEMENT comme si c'était la vôtre. Votre copie résout APRÈS la sienne. Si l'adversaire n'a pas joué de carte, MIMÉTISME est perdu.
- **Impact:** La plus grande force de l'adversaire devient la vôtre. S'il joue Supernova, vous jouez Supernova. Miroir parfait.
- **Condition d'obtention:** Faire face à un adversaire qui joue une carte Légendaire pendant le tournoi.
- **Description i18n:** "Copiez la carte jouée par l'adversaire. Sa puissance est vôtre."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card featuring a chameleon-like lizard (#10b981) at center, its skin shifting — one half is the lizard's natural scales, the other half is mirroring a golden legendary card pattern (#eab308). The lizard's tongue extends outward, touching a phantom copy of the opponent's card that's forming in mid-air. The two cards — original and copy — face each other like mirror images. The background is a jungle-green gradient (#022c22 to #064e3b) with camouflage leaf patterns. The border is emerald with a scaly texture. Tournament ribbon. Glyph "🦎" embossed in emerald. 1024×1024 PNG.
```

---

**Carte T10 — TROU DE VER** 🕳️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🕳️
- **Palette:** `#6366f1` (indigo distorsion)
- **Effet:** ÉCHANGEZ votre main ENTIÈRE avec la main de l'adversaire. POUR LE RESTE DU MATCH. Vous jouez SES cartes, il joue les VÔTRES. Les cartes "one-shot" (Épiques/Légendaires) déjà utilisées par l'ancien propriétaire restent consumées. Les passifs suivent leur nouvelle main.
- **Impact:** Vol total d'identité de deck. Si vous aviez une main faible et lui une main forte, vous prenez l'avantage pour tout le match.
- **Condition d'obtention:** Utiliser Heist avec succès puis gagner le round.
- **Description i18n:** "Échangez vos mains pour le reste du match. Jouez son deck."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card showing a swirling wormhole (#6366f1) at the center — a spiral vortex of indigo and violet connecting two hands from opposite sides. The left hand releases 3 cards into the wormhole, the right hand receives 3 DIFFERENT cards emerging from it — the exchange is mid-flow, captured in a single moment. The cards passing through the wormhole stretch and warp (Einstein-Rosen bridge effect). The background is deep space black (#050510) with gravitational lensing arcs. The border is indigo with a distorted, warped geometric pattern. Tournament ribbon. Glyph "🕳️" embossed in indigo-silver. 1024×1024 PNG.
```

---

**Carte T11 — ULTIMATUM** ⚖️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** ⚖️
- **Palette:** `#ef4444` et `#22c55e` (rouge/vert — binaire)
- **Effet:** Ce round est DÉCISIF. Si vous GAGNEZ ce round, vous gagnez LE MATCH ENTIER. Si vous PERDEZ ce round, vous perdez LE MATCH ENTIER. Le score précédent n'importe plus. Tout se joue sur CE round. Ne peut PAS être joué au premier round.
- **Impact:** "All-in" ultime. Jetez toute prudence — la victoire ou la défaite se décide maintenant. Idéal si vous êtes mené 0-2 et voulez tenter un comeback sur un seul round héroïque.
- **Condition d'obtention:** Gagner 3 matchs consécutifs dans le tournoi.
- **Description i18n:** "Ce round décide du match. Gagnez-le et vous gagnez tout."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card split perfectly vertically — left half brilliant green (#22c55e) with a golden "VICTOIRE" banner, right half deep crimson (#ef4444) with a dark "DÉFAITE" banner. At the center line, two colossal hands are locked in a decisive clash — one forming Rock, the other Paper — mid-impact, the moment of resolution frozen. A balance scale hangs above them, perfectly level for now, about to tip. The card border alternates green and red segments. Tournament ribbon at top. Glyph "⚖️" embossed in white at the exact center. 1024×1024 PNG.
```

---

**Carte T12 — HÉRITAGE** 🏛️

- **Coût:** 0 mana
- **Type:** tournament (usage unique absolu)
- **Glyphe:** 🏛️
- **Palette:** `#fbbf24` (or ancestral)
- **Effet:** JOUEZ cette carte au round 1 UNIQUEMENT. Pour chaque round que vous GAGNEZ dans CE match, vous recevez +1 carte de tournoi supplémentaire au début de votre PROCHAIN match dans le tournoi (cumulatif : 3 rounds gagnés = +3 cartes au prochain match, +2 au suivant, etc.). Les cartes gagnées sont piochées aléatoirement du pool de tournoi. Cet effet persiste PENDANT TOUT LE TOURNOI.
- **Impact:** Investissement long terme. Sacrifiez une carte de tournoi maintenant pour en gagner potentiellement beaucoup plus tard. Récompense les joueurs qui performent bien sur la durée.
- **Condition d'obtention:** Atteindre les demi-finales du tournoi (top 4).
- **Description i18n:** "Chaque round gagné = +1 carte tournoi au prochain match. Cumulatif."

**🎨 PROMPT ILLUSTRATION:**
```
A tournament card featuring an ancient golden temple (#fbbf24) at center, its columns wreathed in climbing ivy. From the temple steps, a procession of ghostly champion figures from past tournaments marches forward, each carrying a glowing card. A golden light beam shines from the temple's heart upward, splitting into multiple card-shaped rays that arc toward the future — representing the bonus cards to come. The background is warm sepia (#451a03 fading to #1a0a00) with dust motes dancing in the light. The border is antique gold with a laurel wreath pattern. Tournament ribbon. Glyph "🏛️" embossed in brilliant gold. 1024×1024 PNG.
```

---

### Résumé des 12 Cartes du Tournoi Épique

| # | Nom | Type | Effet clé | S'obtient en… |
|---|------|------|-----------|---------------|
| T1 | Fulgurance | Offensif | +2 dégâts bonus par lane gagnée | Placer ses 3 moves en <5s |
| T2 | Apocalypse | Destructeur | Détruit toutes les mains, repioche | Flawless Sweep (3-0) |
| T3 | Résurrection | Défensif | Annule une défaite, rejoue avec +2 mana | Comeback 0-2 → victoire |
| T4 | Omniscience | Information | Voit moves + main + pioche adverse | 5 prédictions réussies |
| T5 | Joker | Offensif | Un move bat TOUT sur une lane | Mirror partiel sur une lane |
| T6 | Cataclysme | Chaos | Mélange les positions déjà placées | Gagner après Vortex |
| T7 | Prémonition | Contrôle | Bloque les 3 prochains moves adverses | 3 rounds gagnés consécutifs |
| T8 | Météore | Terrain | Annule une lane entière | Perdre une lane par +3 d'écart |
| T9 | Mimétisme | Copie | Copie la carte adverse jouée ce round | Affronter une Légendaire adverse |
| T10 | Trou de Ver | Échange | Échange les mains pour le reste du match | Heist réussi + round gagné |
| T11 | Ultimatum | Décisif | Ce round décide du match entier | 3 matchs gagnés consécutifs |
| T12 | Héritage | Accumulateur | +1 carte tournoi/match futur par round gagné | Atteindre les demi-finales |

---

### Tableau global des cartes (avec Tournoi)

| Phase | Cartes | Total cumulé |
|-------|--------|-------------|
| Base (existantes) | 26 | 26 |
| V2 (proposées) | 14 | 40 |
| V3 (20 cartes) | 20 | 60 |
| **⚜️ Tournoi Épique (ce bloc)** | **12** | **72** |
| **TOTAL** | **72** | |

---

### Nouvelles mécaniques introduites (Tournoi Épique)

| # | Mécanique | Carte(s) | Description |
|---|-----------|----------|-------------|
| 1 | **Bonus de dégâts conditionnel** | Fulgurance | Bonus si le move gagne, sur toutes les lanes gagnées |
| 2 | **Destruction totale des mains** | Apocalypse | Retire toutes les cartes du match, repioche forcée |
| 3 | **Annulation de défaite + replay** | Résurrection | Le round perdu est annulé et rejoué avec avantage |
| 4 | **Vision parfaite** | Omniscience | Révèle moves + main + 2 prochaines pioches |
| 5 | **Move invincible** | Joker | Un symbole qui bat les 5 autres |
| 6 | **Redistribution chaotique** | Cataclysme | Mélange les positions après placement |
| 7 | **Blocage des choix futurs** | Prémonition | L'adversaire est verrouillé sur ses 3 prochains moves |
| 8 | **Suppression de lane** | Météore | Une lane est annulée pour le round |
| 9 | **Copie de carte adverse** | Mimétisme | Jouer la même carte que l'adversaire |
| 10 | **Échange de mains permanent** | Trou de Ver | Les deux joueurs échangent leurs decks pour le match |
| 11 | **Round décisif** | Ultimatum | Un seul round décide du match entier |
| 12 | **Héritage cumulatif** | Héritage | Les victoires rapportent des cartes pour les matchs suivants |

---

### Architecture technique (Tournoi Épique)

#### Nouveau type de carte : `CardKind = "active" | "passive" | "tournament"`

Les cartes de tournoi :
- **NE sont PAS dans `CARDS`** — elles sont dans un registre séparé `TOURNAMENT_CARDS`
- **NE sont PAS dans `ALL_CARD_IDS`** — elles ne peuvent jamais être ouvertes en pack ou craftées
- **Ne sont PAS dans la collection** (`cardCollection`) — aucun joueur ne les "possède"
- **Ne génèrent PAS de maîtrise** (`cardMastery`) — il n'y a rien à maîtriser
- **Sont injectées** au début du match via `injectTournamentCards(deck, hand)`
- **Sont retirées** du match après usage (ni défausse, ni `usedOneShotCards`)
- **Sont nettoyées** à la fin du match (disparaissent de la main si non jouées)

#### Nouveaux champs dans `RankedBattleState`

```ts
/** Tournament cards added to the match — separate from the player's deck.
 *  Index 0-1 = granted at match start, index 2+ = earned in-match. */
tournamentHand: CardId[];
/** Cards the player earned for their NEXT tournament match. Cleared when
 *  the tournament ends. Max 5. */
tournamentNextMatch: CardId[];
```

#### Flux de jeu pendant le tournoi

1. **Entrée dans le tournoi** → Le joueur rejoint la queue Tournoi
2. **Début de match** → 2 cartes aléatoires du pool sont injectées dans `tournamentHand`
3. **Pendant le match** → Si le joueur remplit une condition, une carte est ajoutée à `tournamentNextMatch`
4. **Fin du match** → Les cartes non jouées de `tournamentHand` sont détruites
5. **Match suivant** → `tournamentNextMatch` devient `tournamentHand` (max 5 cartes de départ)
6. **Fin du tournoi** → Toutes les cartes de tournoi sont effacées

#### i18n

12 cartes × 1 clé `name` + 1 clé `desc` = 24 clés dans `en.ts` sous `ranked.tournament.*`

---

### Équilibrage — Notes Tournoi

- **T11 ULTIMATUM** : La carte la plus risquée du jeu. À utiliser au round où vous êtes le plus confiant. Si vous la jouez au round 3 d'un BO5 et que vous menez 2-0, vous pouvez perdre le match sur un seul mauvais round. La restriction "pas au premier round" évite le "yolo round 1".
- **T10 TROU DE VER** : Extrêmement puissant contre un deck fort. Inutile contre un deck faible. La décision dépend de votre lecture de la main adverse.
- **T5 JOKER** : Le Joker garantit une lane, mais ne peut pas être utilisé sur plusieurs lanes. Si le match se joue sur 3 lanes, gagner 1 lane garantie ne suffit pas — il faut gagner les 2 autres.
- **T6 CATACLYSME** : À jouer APRÈS avoir vu où l'adversaire a placé ses moves (via Télépathie, Omniscience, ou Oracle). Si vous savez que la configuration actuelle vous est défavorable, le chaos peut vous sauver.
- **T12 HÉRITAGE** : La seule carte qui récompense la performance sur la DURÉE du tournoi. Un joueur qui gagne 3 rounds par match et joue 5 matchs peut accumuler jusqu'à +15 cartes de tournoi — un avantage colossal en finale.

---

## Équilibrage — Notes importantes

- **Sablier** : La réduction à 6s est TRÈS agressive. Envisager 8s minimum si c'est trop punitif.
- **Genèse** : La carte la plus puissante du jeu. Limiter à 1 exemplaire par deck, et usage unique. Le coût de 4 mana + le fait que les cartes "hors du temps" ne reviennent pas limite sa puissance.
- **Le Choix de Schrödinger** : La superposition donne un avantage statistique significatif. Le risque de -2 pts par lane en cas de double perte est le contrepoids. Les maths : 2 moves sur 5 = 40% de chance de gagner par lane (vs 20% normalement). Mais -2 pts si les deux perdent (25% de chance par lane si l'adversaire couvre les 3 autres moves).
- **Le Juge** : Change complètement la méta. Si vous savez que l'adversaire a Le Juge, vous devez gérer vos PV, cartes, et historique différemment.
- **Marchand d'Âmes** : -1 PV pour +3 mana permanent est un trade extrêmement favorable sur la durée. Le joueur doit survivre assez longtemps pour en bénéficier.