# Game Mode Redesign — Plan Expert

**Date:** 2026-06-07  
**Version:** v2.0 — Reprise complète après critique  
**Philosophie:** Chaque mode doit offrir une expérience visuelle, mécanique et émotionnelle que l'app ne propose PAS déjà. Pas de "match classique déguisé". Chaque mode a son propre écran, ses propres animations, sa propre boucle de gameplay.

---

## 1. ⚔️ TOURNAMENT — La Guerre des Ombres

### Critique du concept précédent
Un bracket CPU persistant, c'est juste 3 matchs classiques avec une sauvegarde. Aucune différence avec "jouer 3 ranked d'affilée". Le joueur ne ressent rien de spécial.

### Redesign : Tournoi Asynchrone Persistant

**Concept:** Un vrai tournoi compétitif asynchrone. 32 joueurs humains (réels, pas des CPU) s'inscrivent. Les matchs se jouent en **différé** : chaque joueur a 8h pour jouer son match. Le tournoi dure 3 jours (32→16→8→4→2→1). Les résultats sont visibles sur un bracket animé en temps réel.

**Visuel — Le Hall des Guerriers (écran principal) :**
- Un grand bracket physique en 3D isométrique, les noms des joueurs gravés sur des plaques de marbre
- Les matchs complétés ont des résultats inscrits (feuille de parchemin qui se déroule)
- Les matchs en attente pulsent doucement (glow doré)
- Le match en cours a un effet de "flammes" autour du slot (quelqu'un joue LIVE)
- Caméra qui voyage le long du bracket quand on scrolle, avec parallaxe sur les colonnes
- Musique orchestrale qui s'intensifie à mesure que le tournoi avance (quarts → demi → finale)

**Mécanique unique — Le Droit de Regard :**
- Tous les joueurs du tournoi peuvent REGARDER le replay de n'importe quel match déjà joué
- Les replays sont présentés comme des "mémoires" — une sphère de cristal qu'on touche pour voir le match
- On peut voir les stats et les patterns de ses futurs adversaires
- Les replays ne montrent PAS les cartes jouées (seulement les moves et résultats) — brouillard de guerre partiel

**Mécanique unique — La Prime du Public :**
- Les joueurs éliminés peuvent "miser" des éclats sur le vainqueur qu'ils prédisent
- Le total des mises est visible sur le bracket (pression sociale)
- Si le joueur sur qui on a misé gagne, on récupère 1.5× la mise
- Ça garde les éliminés engagés jusqu'à la finale

**Animation — La Cérémonie de Clôture :**
- À la fin du tournoi, une animation spéciale montre le parcours du vainqueur
- Ses 5 victoires sont rejouées en accéléré sur un seul écran splitté en 5 mini-fenêtres
- Le vainqueur reçoit un badge animé "👑 Roi de la Colline" permanent + son pseudo est gravé sur le mur des champions
- Les 3 jours suivants, le badge du vainqueur apparaît à côté de son pseudo partout dans le jeu

**Contre le "boosting" :**
- Un joueur ne peut pas affronter le même adversaire deux tournois de suite
- Si un joueur déclare forfait sans jouer, il est pénalisé (cooldown d'un tournoi)
- Les matchs non joués dans les 8h sont des victoires par forfait

**Pourquoi c'est différent du ranked :**
- Pression sociale (bracket visible de tous)
- Temporalité lente (3 jours) qui crée de l'attente et de l'engagement
- Replays et étude des adversaires (scouting)
- Mises des éliminés (engagement secondaire)
- Badge temporaire de "Roi de la Colline" visible partout

---

## 2. 🧬 LA SPIRALE — Roguelike Cosmique

### Critique du concept précédent
Structure correcte (nœuds, boss, modificateurs) mais aucun plan visuel. C'est un arbre de combat avec des règles modifiées — visuellement, ça reste un match de Lanes avec un overlay de texte. Pas assez immersif.

### Redesign : La Tour des Possibles

**Concept:** Le joueur gravit une TOUR cosmique visible en arrière-plan permanent. Chaque étage est un "plan de réalité" avec son propre biome visuel et ses propres règles physiques. La progression est VERTICALE (on monte), pas horizontale (arbre de nœuds).

**Visuel — La Tour (écran principal) :**
- Une tour monumentale en 3D isométrique, style "Tour de Babel cosmique"
- La tour a 5 étages visibles, chaque étage = un biome distinct (pas juste 3 niveaux abstraits)
- Le joueur est représenté par un point lumineux qui monte dans la tour
- À chaque nœud de combat, la caméra ZOOM sur une fenêtre de la tour où le combat se déroule
- Les étages non atteints sont dans la brume (dévoilés en montant)
- La tour est entourée de constellations qui représentent les joueurs morts (leurs runs précédents) — poetic death

**Gameplay — Les 5 Étages (nouvelle structure) :**

**Étage 1 — LE JARDIN (verdure cosmique, racines, lianes lumineuses)**
- 5 nœuds de combat
- Thème : initiation. Modificateurs doux (+1 mana, pioche 4 cartes)
- Boss : **La Dryade Quantique** — deck nature (Bois, Terre, Eau). Capacité : régénère 1 HP tous les 2 rounds.
- Récompense : 1 carte Rare + 15 Fragments

**Étage 2 — LA FORGE (métal en fusion, engrenages, lave)**
- 5 nœuds de combat + 1 repos
- Thème : agressivité. Modificateurs agressifs (double tranchant, cadeau empoisonné)
- Boss : **Le Forgeron Stellaire** — deck feu/métal. Capacité : chaque round gagné, détruit 1 carte aléatoire de votre main.
- Récompense : 1 carte Épique + 30 Fragments

**Étage 3 — LA BIBLIOTHÈQUE (livres flottants, encre cosmique, silence)**
- 5 nœuds + 2 repos
- Thème : intelligence. Modificateurs mentaux (brouillard de guerre, zone calme)
- Boss : **Le Bibliothécaire** — deck ombre/lumière. Capacité : lit votre main et joue le contre parfait de votre carte la plus chère.
- Récompense : 1 carte Légendaire + 50 Fragments + Relique au choix

**Étage 4 — LE TRÔNE (marbre blanc, or, silence absolu)**
- 4 nœuds + 1 repos
- Thème : souveraineté. Modificateurs extrêmes (terrain interdit + chronomètre serré)
- Boss : **Le Roi Déchu** — deck complet. Capacité : joue 2 cartes par round. A 10 HP.
- Récompense : badge "Seigneur de la Spirale" + 80 Fragments

**Étage 5 — LE NÉANT (vide absolu, particules qui s'effacent, silence)**
- 3 nœuds (les plus durs)
- Thème : survie pure. Modificateurs : TOUS les modificateurs des étages précédents en rotation aléatoire
- Boss : **L'Architecte** — pas de deck. Chaque round, il COPIE votre move et le joue contre vous. Il a 12 HP. Vous devez le battre en jouant des moves que vous-même ne pouvez pas contrer (paradoxe). Si vous jouez Rock, il joue Rock → draw → vous devez gagner ailleurs.
- Récompense : badge "Avatar du Néant" + 150 Fragments + animation d'entrée spéciale "Élu du Néant"

**Mécanique unique — Les Reliques (entre les étages) :**
Après chaque boss vaincu, le joueur choisit UNE Relique parmi 3. Les Reliques sont des pouvoirs passifs qui durent tout le reste du run :

| Relique | Effet |
|---------|-------|
| **Cœur de la Dryade** | +2 HP max |
| **Œil du Forgeron** | Voyez 1 carte de la main adverse avant chaque round |
| **Plume du Bibliothécaire** | Piochez 1 carte supplémentaire par round |
| **Couronne du Roi** | Toutes vos cartes coûtent 1 mana de moins (min 1) |
| **Fragment du Néant** | Une fois par run, annulez une défaite (le round est rejoué) |

**Animation — La Montée :**
- Entre les nœuds d'un même étage, le joueur "glisse" le long de la tour (transition fluide avec particules)
- Les combats se déroulent DANS la fenêtre de la tour — le backdrop change selon l'étage
- La victoire sur un boss déclenche un plan large de la tour qui s'illumine jusqu'à l'étage suivant
- La mort : la tour se fissure, la caméra recule, le point lumineux s'éteint → le score s'affiche

**Pourquoi c'est différent de tout ce qui existe dans l'app :**
- Progression verticale visible (la tour)
- 5 biomes visuels distincts (Jardin, Forge, Bibliothèque, Trône, Néant)
- Boss avec des mécaniques de combat uniques (pas juste "un CPU plus fort avec des cartes")
- Reliques : choix stratégiques permanents entre les étages
- Mort poétique : les joueurs morts deviennent des constellations autour de la tour

---

## 3. ⚡ LE POING DE FER — Survival Reimagined

### Critique du concept précédent
"Vague après vague de CPU, 1 round, 5 vies" — c'est un match simple répété avec des CPU de plus en plus forts. Aucune différence avec "jouer 30 matchs casual d'affilée". Aucune pression visuelle, aucun crescendo.

### Redesign : L'Arène des Damnés

**Concept:** Le joueur est dans une ARÈNE circulaire. Les adversaires sortent de 5 PORTES disposées en pentagone autour de l'arène. Chaque porte correspond à un symbole RPSLS. Le joueur doit survivre à une HORDE continue (pas des vagues discrètes). Les ennemis arrivent par vagues de 3 simultanément sur des portes différentes. Le joueur a 5 secondes pour choisir UN move qui affronte les 3 ennemis en même temps.

**Visuel — L'Arène :**
- Vue isométrique d'une arène circulaire en pierre noire
- 5 portes en forme de symboles géants (🗿Rock, 📜Paper, ✂️Scissors, 🦎Lizard, 🖖Spock) disposées en pentagone
- Le joueur est au CENTRE de l'arène, avatar visible
- Les ennemis sont des silhouettes spectrales qui sortent des portes et chargent vers le centre
- Le sol de l'arène se fissure et s'use à mesure que la survie progresse
- Compteur de kills en haut, barre de vie en bas
- Musique : battement de tambour qui accélère avec la difficulté

**Gameplay — Horde Continue (pas de vagues) :**
- Toutes les 5 secondes, 1 à 3 ennemis sortent de portes aléatoires
- Le joueur choisit UN move
- Ce move est testé contre CHAQUE ennemi simultanément
- Si le move bat l'ennemi → kill (+1 point). Si perd → le joueur prend 1 dégât. Si draw → l'ennemi est repoussé (ne fait pas de dégât mais reste pour le prochain round)
- Le joueur a 5 PV. Pas de regénération.
- Tous les 20 kills, le joueur gagne un "Cri de Guerre" (pouvoir utilisable une fois)

**Les Cris de Guerre (5 pouvoirs, 1 par symbole) :**
| Cri | Effet | Usage |
|-----|-------|-------|
| **Rage du Rock** | Tous les ennemis Scissors et Lizard en cours sont tués instantanément | 1 fois |
| **Tempête de Paper** | Repousse TOUS les ennemis (ils retournent dans leurs portes) | 1 fois |
| **Danse des Scissors** | Les 3 prochains rounds, vos moves infligent double dégât | 1 fois |
| **Fuite du Lizard** | Esquive le prochain coup reçu (invulnérabilité 1 round) | 1 fois |
| **Logique du Spock** | Révèle les 3 prochains moves qui sortiront des portes | 1 fois |

**Difficulté — Accélération progressive (pas par paliers) :**
- Kills 1-20 : 1 ennemi à la fois, intervalles de 5s
- Kills 20-50 : 1-2 ennemis, intervalles de 4s, les ennemis sont plus rapides (silhouettes qui courent)
- Kills 50-100 : 2-3 ennemis, intervalles de 3s, apparition de "Champions" (ennemis avec 2 HP — doivent être battus 2 fois)
- Kills 100+ : 3 ennemis à chaque round, intervalles de 2.5s, Champions fréquents, le sol tremble

**Animation — Impact et Mort :**
- Un kill : l'ennemi explose en particules de la couleur du symbole (Rock = gris, Paper = blanc, etc.)
- Un dégât subi : l'écran vibre + flash rouge bref + le compteur de vie perd un cœur avec animation de brisure
- Un Cri de Guerre : ralenti extreme (0.3× speed) pendant 1s, l'avatar du joueur grandit, puis explosion de particules
- Mort : l'arène s'effondre, l'avatar tombe dans le vide, score final affiché en lettres de feu

**Pourquoi c'est différent d'un match classique :**
- Un move contre 3 ennemis simultanés = logique différente (il faut trouver le move qui maximise kills/minimise dégâts)
- Pas de rounds, pas de pause — flux continu sous pression temporelle
- Interface radicalement différente (arène isométrique vs match en face-à-face)
- Les Cris de Guerre ajoutent une couche tactique absente du RPSLS classique
- La charge des silhouettes spectrales crée une tension visuelle que le mode match n'a pas

---

## 4. 🎲 QUITTE OU DOUBLE — Gambling Redesign

### Critique du concept précédent
"3 matchs d'affilée, tu doubles ou tu perds" — c'est juste 3 matchs casual avec un enjeu financier. Aucune tension visuelle. Le joueur ne ressent pas le "gamble".

### Redesign : La Roue du Destin

**Concept:** Ce n'est plus un match. C'est une ROUE DE LA FORTUNE cosmique à 5 secteurs (les 5 symboles RPSLS). Le joueur choisit un symbole sur lequel miser (éclats). La roue tourne. 3 crans s'arrêtent successivement. Si le symbole misé bat le résultat, le joueur gagne. 3 crans = 3 chances de gagner ou perdre.

**Visuel — La Roue Cosmique :**
- Une roue monumentale en pierre et or, flottant dans l'espace (backdrop Galaxy/Eclipse)
- 5 secteurs avec les symboles RPSLS animés (Rock pulse, Paper ondule, Scissors s'entrechoquent, Lizard rampe, Spock médite)
- Un curseur en diamant au sommet
- La roue tourne avec un son mécanique lourd (cliquetis d'horlogerie)
- Le résultat est annoncé par une voix off mystique (réutilisable via i18n: "Le destin a choisi... ROCK!")
- Pièces d'éclats qui volent vers le tas du joueur ou s'envolent en cendres selon le résultat

**Gameplay — Pas un match, un jeu de hasard pur avec lecture :**
1. Le joueur choisit UN symbole (sa mise)
2. Il choisit sa mise : 10, 25, 50 ou 100 éclats
3. La roue tourne 5 secondes
4. **Cran 1** — Le curseur s'arrête sur un symbole. Si le symbole misé bat le cran → ×1.5 la mise. Si perd → -50% de la mise.
5. Le joueur peut décider de S'ARRÊTER et empocher, ou CONTINUER (la roue tourne à nouveau)
6. **Cran 2** — Même mécanique. Si gagné : ×2 cumulatif. Si perdu : perte de 100% de la mise initiale.
7. **Cran 3** — Même mécanique. Si gagné : ×5 cumulatif. Si perdu : perte totale +10% de pénalité.

**Résumé des gains :**

| Nombre de crans | Si tous gagnés | Si 1 perdu |
|----------------|---------------|------------|
| 1 cran (stop) | ×1.5 | -50% |
| 2 crans (stop) | ×2.0 | -100% |
| 3 crans (full) | ×5.0 | -110% (perte + pénalité) |

**Pourquoi c'est différent :**
- Ce n'est PLUS un match de RPSLS. C'est un jeu de hasard/loterie avec un système de "stop ou encore"
- La roue est un objet visuel iconique (pas de "match ennuyeux")
- La mécanique de "stop ou encore" est addictive — le joueur doit décider sous pression
- L'animation de la roue qui ralentit est un moment de tension pure
- Aucune compétence RPSLS requise — c'est accessible à tous les joueurs, même débutants

---

## 5. 🧩 LE DÉFI DE L'ARCHITECTE — Puzzle Mode Reimagined

### Critique du concept précédent
30 puzzles statiques avec une question et 5 choix. Pas de progression visuelle. Pas d'animation. Pas de narration. C'est un QCM déguisé.

### Redesign : La Chambre des Énigmes

**Concept:** Une salle mystérieuse en 3D (pas isométrique — flat design profond avec parallaxe). Sur le mur du fond, l'ÉNIGME apparaît gravée dans la pierre. Le joueur dispose de JETONS qu'il place physiquement sur un plateau pour construire sa solution. L'énigme s'anime quand on la résout. Une histoire se déroule sur 30 chambres.

**Visuel — La Chambre :**
- Une salle voûtée en pierre, éclairée par des torches (backdrop Holy ou Quantum)
- Au fond, un mur de pierre où l'énigme est GRAVÉE en lettres lumineuses
- Au centre, un piédestal avec le PLATEAU DE RÉSOLUTION (3 lanes si l'énigme est Constellation, 1 zone si classique)
- Des JETONS (5 jetons = 5 symboles RPSLS) que le joueur glisse-dépose sur les lanes
- Des lueurs indiquent les lanes "chaudes" (susceptibles de contenir la solution)
- Des fresques sur les murs latéraux racontent l'histoire de l'Architecte (débloquées énigme après énigme)

**Gameplay — Pas un QCM, un bac à sable logique :**
- Le joueur ne "choisit" pas une réponse parmi 5. Il CONSTRUIT sa solution en plaçant des jetons
- Pour une énigme Constellation : placer 3 jetons sur 3 lanes + choisir UNE carte parmi 3 proposées
- Le jeu vérifie la solution quand le joueur appuie sur "🔮 Résoudre"
- Si correct → la pierre s'illumine et révèle l'énigme suivante
- Si incorrect → la pierre tremble, des runes rouges apparaissent brièvement ("Ce n'est pas la bonne voie..."), le joueur peut réessayer
- Pas de limite de tentatives. Le score est basé sur le nombre d'essais : 1 essai = ⭐⭐⭐, 2 essais = ⭐⭐, 3+ = ⭐
- Les étoiles débloquent des fresques murales (lore bonus)

**Progression — 30 Chambres, 5 Ailes :**

| Aile | Chambres | Thème | Nouveaux concepts introduits |
|------|---------|-------|------------------------------|
| **Aile de Pierre** | 1-6 | Tutoriel | RPSLS de base, une lane, pas de cartes |
| **Aile de Papier** | 7-12 | Introduction Lanes | 3 lanes, prédiction de patterns simples |
| **Aile de Ciseaux** | 13-18 | Cartes & Modificateurs | Cartes (Aegis, Surge), terrain interdit |
| **Aile de Lézard** | 19-24 | Complexe | Combos de cartes, timing, mindgames |
| **Aile de Spock** | 25-30 | Maître | Énigmes paradoxales, solutions non-évidentes |

**Narration — L'Histoire de l'Architecte :**
Chaque aile résolue débloque une fresque murale qui raconte un chapitre :
- Aile 1 : L'Architecte découvre les 5 forces primordiales
- Aile 2 : Il construit la première Tour (lien avec La Spirale)
- Aile 3 : Il crée les Cartes pour amplifier les forces
- Aile 4 : Il est trahi par ses apprentis qui utilisent les cartes à mauvais escient
- Aile 5 : Il se sacrifie pour sceller le savoir dans la Chambre des Énigmes — le joueur est son digne successeur

**Récompenses :**
- 30 étoiles → badge "Apprenti Architecte"
- Toutes les fresques débloquées → badge "Architecte"
- Chaque chambre complétée = 5 XP. Toutes les chambres = 150 XP + 30 éclats
- 100% étoiles (30⭐) = badge "Grand Architecte" + skin de plateau "Plateau de l'Architecte" (cosmétique)

**Pourquoi c'est différent :**
- Construction de solution (drag & drop de jetons) au lieu de QCM
- Narration environnementale (fresques murales qui se dévoilent)
- Pas de timer, pas de pression — mode contemplatif et réflexif
- L'histoire de l'Architecte fait le lien avec La Spirale (lore partagé)
- Progression en étoiles qui encourage la perfection

---

## 6. 🌐 LE MIROIR — Le mode social réinventé

### Critique du Quick Party
Le hotseat a été retiré pour une bonne raison : personne ne joue à un jeu mobile à plusieurs sur le même appareil. Le vrai "social" sur mobile, c'est le **jeu asynchrone** ou le **partage de défi**.

### Redesign : Le Miroir (Défis Asynchrones)

**Concept:** Vous créez un "Défi" — une configuration de match précise (moves imposés, cartes imposées, modificateurs). Vous y jouez et enregistrez votre score. Vous envoyez ce défi à un ami (via lien ou code). L'ami reçoit le MÊME défi (mêmes conditions, même seed) et essaie de battre votre score. Les deux joueurs voient les tentatives de l'autre. Pas de jeu simultané — c'est du "hotseat asynchrone".

**Visuel — Le Miroir (écran principal) :**
- Un miroir brisé en 2 moitiés
- À gauche : VOTRE reflet (votre dernier score sur ce défi)
- À droite : Le reflet de l'AMI (son score, flouté s'il n'a pas encore joué)
- Les défis en cours sont des éclats de miroir flottants
- Quand un ami bat votre score, le miroir se fissure et votre reflet est remplacé par le sien
- Animation de "bris de miroir" quand vous reprenez la tête

**Gameplay — Créer un Défi :**
1. Choisir le type de match : classique (1 move) ou Constellation (3 lanes)
2. Définir les contraintes (optionnel) :
   - Moves imposés pour certains rounds (ex: "Round 1 = Rock obligatoire")
   - Cartes interdites
   - Modificateur (terrain interdit, chronomètre serré...)
   - Best-of (1, 3, 5)
3. Jouer son propre défi (le créateur doit le réussir pour pouvoir l'envoyer)
4. Le jeu génère un code de 6 lettres à partager
5. Le destinataire entre le code → le même défi se charge avec la même seed → il joue

**Scoring comparatif :**
- Score = rounds gagnés - rounds perdus + bonus de rapidité
- Si les deux joueurs ont le même résultat, celui qui a mis le moins de temps gagne
- Historique des 10 dernières confrontations visible dans le Miroir

**Pourquoi ça remplace le Quick Party :**
- Pas besoin d'être ensemble physiquement (le gros défaut du hotseat)
- Asynchrone = chacun joue quand il veut
- Le "miroir brisé" est une métaphore visuelle forte pour la compétition
- Les défis sont partageables sur les réseaux sociaux ("Bats mon score sur RPSLS! Code: XYZ123")
- Crée de la rétention sociale sans nécessiter de synchronisation

---

## 7. 📋 LE PASSEPORT DU JOUEUR — Conservé tel quel

Le concept du Passeport hebdomadaire est bon et ne nécessite pas de refonte. C'est un système de récompenses cross-mode, pas un mode de jeu. Il reste dans le document comme section "Système transverse".

**Ajustement mineur :** Remplacer "Hotseat" par "Défi du Miroir" (envoyer 1 défi à un ami).

---

## Matrice de comparaison — Avant vs Après redesign

| Mode | Version v1 (rejetée) | Version v2 (proposée) | Différenciateur clé |
|------|---------------------|----------------------|---------------------|
| Tournament | Bracket CPU persistant | Tournoi 32 joueurs asynchrone, bracket 3D, replays, mises | Asynchrone + social + spectateur |
| La Spirale | Arbre de nœuds abstrait | Tour cosmique à gravir, 5 biomes, Reliques, boss uniques | Progression verticale + lore + Reliques |
| Poing de Fer | Vagues de CPU, 1 round | Arène en horde continue, 1 move vs 3 ennemis, Cris de Guerre | Multitarget + flux continu + pouvoirs |
| Quitte ou Double | 3 matchs, double ou rien | Roue de la Fortune cosmique, stop-ou-encore, pas un match | Jeu de hasard pur, sans RPSLS |
| Défi de l'Architecte | 30 QCM | Chambre des Énigmes, drag & drop de jetons, narration, fresques | Construction + lore + progression étoiles |
| Quick Party → Le Miroir | Hotseat local | Défis asynchrones, codes à partager, scoring comparatif | Asynchrone + viralité + pas de local |

---

## Plan de développement (ordre suggéré)

| Phase | Modes | Effort | Raison |
|-------|-------|--------|--------|
| **Sprint 1** | Le Miroir (défis) + Roue du Destin | 3 jours | Les plus simples à implémenter. Roue = UI pure, pas d'IA. Miroir = extension du match existant + partage de seed. Quick wins. |
| **Sprint 2-3** | Poing de Fer (Arène) | 5 jours | Nouvelle UI (arène isométrique) + système de horde + Cris de Guerre. Complexe visuellement mais mécaniquement simple. |
| **Sprint 4-5** | Chambre des Énigmes (Puzzles) | 7 jours | 30 puzzles à créer + UI drag & drop + animations fresques. Le contenu est le gros du travail. |
| **Sprint 6-8** | La Spirale (Tour) | 10 jours | Le plus ambitieux. 5 biomes visuels, boss uniques, Reliques, progression verticale. C'est le flagship. |
| **Sprint 9-10** | Tournament (Guerre des Ombres) | 10 jours | Backend serveur pour le tournoi asynchrone. Le plus complexe techniquement. |