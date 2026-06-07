# Innovations & Nouveaux Modes — RPSLS

**Date:** 2026-06-07
**Contexte:** Le jeu propose actuellement 5 modes locaux (Training, Casual, Ranked, Hotseat, Constellation Lanes vs CPU), 2 modes online (1v1 classique, Constellation Lanes), 1 mode Classé avec bracket, des défis quotidiens. L'architecture est solide mais les modes sont tous "match par match". Il manque un mode à progression longue, un mode roguelike, et des améliorations QoL sur l'existant.

---

## 1. Améliorations des modes existants

### 1.1 Mode "Tournament" — bracket persistent

**Problème:** Le bracket de Classé est éphémère (recréé à chaque session). Aucune mémoire.

**Solution:** Un vrai mode Tournoi avec sauvegarde de progression :

| Caractéristique | Détail |
|----------------|--------|
| **Structure** | 8 joueurs CPU, bracket élimination directe (quart → demi → finale) |
| **Persistance** | Le tournoi est sauvegardé. Le joueur peut le reprendre après avoir fermé l'app |
| **Difficulté** | Les CPU des quarts sont niveau "Easy", les demi "Normal", la finale "Hard" |
| **Récompenses** | Vainqueur : 500 XP + 50 éclats + 1 pack gratuit. Finaliste : 200 XP + 20 éclats |
| **Cooldown** | Un nouveau tournoi est disponible toutes les 4h (comme un "energy system" doux) |
| **Reroll** | Possibilité de relancer un tournoi immédiatement pour 20 éclats |

### 1.2 Daily Challenge — streak system

**Problème:** Les défis quotidiens sont indépendants. Aucune raison de revenir 7 jours de suite.

**Solution:** Ajouter un streak hebdomadaire :

| Jours consécutifs | Bonus |
|-------------------|-------|
| 1-2 | Standard (+50% XP) |
| 3 | +75% XP + 5 éclats |
| 5 | +100% XP + 10 éclats |
| 7 | +150% XP + 25 éclats + badge temporaire "🔥 Semaine Parfaite" |

Le streak se réinitialise si un jour est manqué. L'UI affiche une barre de progression hebdomadaire.

### 1.3 Constellation Lanes vs CPU — scaling difficulty

**Problème:** L'IA CPU des Lanes est la même quelle que soit la difficulté choisie. Pas de sentiment de progression.

**Solution:** Ajouter un mode "Ascension" :

| Niveau | Modificateur IA | Récompense bonus |
|--------|----------------|-----------------|
| 1-3 | IA lit 1 de vos 3 moves | Aucune |
| 4-6 | IA lit 2 de vos 3 moves | +10% XP |
| 7-9 | IA lit vos 3 moves + évite vos cartes | +20% XP + 1 éclat |
| 10 | IA optimale + deck complet | +50% XP + 5 éclats |

Le niveau est choisi par le joueur AVANT le match. Monter en difficulté est volontaire — les récompenses augmentent pour compenser.

---

## 2. 🆕 NOUVEAU MODE : "La Spirale" (Roguelike)

**Concept:** Un mode "run" où le joueur traverse un arbre de nœuds (7-10 par étage, 3 étages) en affrontant des CPU aux règles modifiées. Entre chaque nœud, il gagne une carte, un bonus temporaire, ou un soin. La mort est définitive (permaloss du run). Les "Fragments" gagnés servent à acheter des améliorations permanentes entre les runs.

### 2.1 Structure d'un run

```
ÉTAGE 1 (7 nœuds)        ÉTAGE 2 (7 nœuds)        ÉTAGE 3 (7 nœuds)
                                                          
  ⚔️─⚔️─⚔️─🏪─⚔️─⚔️─👑    ⚔️─⚔️─🏪─⚔️─⚔️─🏪─👑    ⚔️─🏪─⚔️─⚔️─🏪─⚔️─👑
    \       /                 \       /                 \       /
     choix                    choix                    choix
```

- **⚔️ Combat:** Match Constellation Lanes vs CPU avec modificateur spécial (terrain, mana, règle)
- **🏪 Repos:** Choisir 1 parmi 3 : +1 carte aléatoire / +5 HP permanent / retirer une carte du deck
- **👑 Boss:** Combat difficile avec règles uniques + grosse récompense

Entre les nœuds, le joueur voit 2 chemins et choisit celui qui lui semble le plus avantageux (chaque chemin affiche le type de modificateur du prochain nœud).

### 2.2 Modificateurs de nœuds (15 types)

| # | Nom | Effet |
|---|-----|-------|
| 1 | **Terrain interdit** | 1 move banni au hasard ce round |
| 2 | **Marée de mana** | Vous commencez avec +1 mana |
| 3 | **Sécheresse de mana** | Vous commencez avec -1 mana (min 1) |
| 4 | **Main renforcée** | Piochez 4 cartes au lieu de 3 |
| 5 | **Main réduite** | Piochez 2 cartes au lieu de 3 |
| 6 | **Cadeau empoisonné** | L'adversaire commence avec 1 carte gratuite jouée |
| 7 | **Double tranchant** | Tous les dégâts de cartes sont doublés (vous et l'adversaire) |
| 8 | **Zone calme** | Aucune carte ne peut être jouée ce round (pur RPSLS) |
| 9 | **Chronomètre serré** | Deadline réduite à 8s au lieu de 13.5s |
| 10 | **Réflexion profonde** | Deadline étendue à 25s |
| 11 | **Lane piégée** | Une lane aléatoire donne -1 pt au gagnant |
| 12 | **Lane bénie** | Une lane aléatoire donne +1 pt au gagnant |
| 13 | **Miroir brisé** | L'adversaire copie votre 1er move sur la 1ère lane |
| 14 | **Brouillard de guerre** | Vous ne voyez pas les moves de l'adversaire à la révélation (juste win/loss/draw) |
| 15 | **Résistance** | Le boss a +2 HP (doit gagner plus de rounds pour être battu) |

### 2.3 Boss par étage

| Étage | Boss | Règles spéciales | Récompense |
|-------|------|-----------------|------------|
| 1 | **Le Gardien** | HP: 4 victoires nécessaires. Deck de base (8 communs + 2 rares) | 20 Fragments + 1 carte Rare |
| 2 | **L'Archonte** | HP: 5 victoires. Deck mixte (6 rares + 4 épiques). Effet passif : +1 mana/round | 40 Fragments + 1 carte Épique |
| 3 | **Le Néant** | HP: 6 victoires. Deck complet (5 épiques + 5 légendaires). Effet passif : chaque round gagné, pioche 1 carte. | 80 Fragments + 1 carte Légendaire + badge de run |

### 2.4 Mort et persistance

- **Défaite = fin du run.** Toutes les cartes gagnées pendant le run sont perdues.
- **Fragments** : monnaie persistante gagnée à chaque nœud (3 par combat, 10 par boss) et conservée entre les runs.
- **Boutique des Fragments (meta-progression)** :

| Achat | Coût | Effet permanent |
|-------|------|----------------|
| Vitalité I | 30 | +1 HP max (gagne 1 round gratuit par run) |
| Vitalité II | 80 | +2 HP max |
| Vitalité III | 200 | +3 HP max |
| Main de départ I | 50 | Commencez chaque run avec 1 carte Rare aléatoire |
| Main de départ II | 150 | Commencez avec 1 carte Épique aléatoire |
| Pioche améliorée | 100 | Piochez 4 cartes au lieu de 3 au début de chaque run |
| Reroll | 20 | Permet de relancer les choix de récompense une fois par run |
| Assurance | 200 | Si vous mourez à l'étage 1, recommencez à l'étage 1 avec le même deck (1 fois par run) |

### 2.5 Deck building pendant le run

Le joueur commence avec un deck de 10 cartes (6 communes + 4 rares tirées de sa collection). Après chaque combat gagné, il choisit 1 carte parmi 3 proposées. Entre les étages, le Repos permet d'échanger ou retirer des cartes.

### 2.6 Score et leaderboard

- **Score du run** = (étages complétés × 100) + (combats gagnés × 10) + (boss vaincus × 50) + (HP restant × 5)
- **Classement hebdomadaire** : les 10 meilleurs scores de la semaine gagnent des éclats bonus
- **Badge spécial** : "Avatar du Néant" pour avoir vaincu le boss final 3 fois

---

## 3. 🆕 NOUVEAU MODE : "Le Poing de Fer" (Survival)

**Concept:** Vague après vague de CPU. Chaque vague est un match en 1 round (best of 1). Après chaque victoire, le CPU suivant est plus fort. Le joueur a 5 "vies" (5 rounds perdus = fin). Pas de cartes, pas de mana — pur RPSLS. La tension vient de la fatigue mentale et de la lecture des patterns.

### 3.1 Mécanique

| Vague | Type CPU | Difficulté |
|-------|---------|------------|
| 1-5 | Random mood | Easy |
| 6-10 | Random mood | Normal |
| 11-15 | Aggressive | Normal |
| 16-20 | Logical | Hard |
| 21-25 | Adaptive (lit vos 2 derniers moves) | Hard |
| 26-30 | Counter (joue le contre de votre move le plus fréquent) | Hard |
| 31+ | Omniscient (lit votre move et joue le contre) | Très dur (survie bonus) |

### 3.2 Récompenses

- **Vague 10 :** 50 XP + badge "Survivant"
- **Vague 20 :** 150 XP + 10 éclats + badge "Endurant"
- **Vague 30 :** 300 XP + 30 éclats + badge "Poing de Fer"
- **Vague 40+ :** 500 XP + 50 éclats + badge "Légende du Poing"

### 3.3 Leaderboard

- Classement par nombre de vagues survécues
- Affiché dans le lobby Online (compétition asynchrone)
- Top 10 hebdomadaire = éclats bonus

---

## 4. 🆕 NOUVEAU MODE : "Quitte ou Double" (Gamble Run)

**Concept:** Mode très court (3-5 min). Le joueur mise des éclats avant de commencer. Il affronte 3 CPU d'affilée. S'il gagne les 3, il double sa mise. S'il perd un seul match, il perd tout. S'il gagne 2/3, il récupère sa mise (neutre). S'il gagne 3/3 avec un clean sweep (sans perdre un round), il triple sa mise.

| Résultat | Gain/Perte |
|----------|-----------|
| 0-1 victoires | Perte totale |
| 2 victoires | Remboursé |
| 3 victoires | ×2 mise |
| 3 victoires + clean sweep | ×3 mise |

**Limite:** 3 tentatives par jour. Mise max : 50 éclats.

---

## 5. 🆕 NOUVEAU MODE : "Le Défi de l'Architecte" (Puzzle)

**Concept:** Des situations de match préconstruites où le joueur doit trouver LE coup qui gagne à coup sûr. Pas de hasard, pas d'IA — juste de la logique pure.

**Exemple de puzzle :**
- Round 5 d'un BO5, score 2-2
- L'adversaire a joué Rock 4 fois de suite (pattern)
- Vous avez 2 cartes en main : Aegis et Surge
- Le terrain interdit Paper
- **Quel move jouez-vous et sur quelle lane ?**

**Difficulté croissante :** 30 puzzles, du tutoriel au casse-tête. Chaque puzzle réussi donne 5 XP + 1 éclat. Collection complétée → badge "Architecte".

---

## 6. Quick Party — mode social local

**Concept:** Mode conçu pour les soirées entre amis sur un seul appareil. Tournoi rapide 4-8 joueurs (hotseat). Chaque match est en BO1 (1 round décisif).

- **Phase 1 : Élimination** — Des paires aléatoires, le perdant est éliminé
- **Phase 2 : Finale** — Les 2 derniers s'affrontent en BO3

**Fun facts :**
- Pseudo et avatar à choisir pour chaque joueur (quick pick parmi 20 avatars rigolos)
- Écran de victoire avec "photo de groupe" des 4 derniers
- Musique épique sur la finale
- Idéal pour les streams / soirées

---

## 7. Cross-mode — le Passeport du Joueur

**Concept:** Un système de récompenses qui encourage à jouer à TOUS les modes, pas seulement son favori.

**Passeport hebdomadaire (gratuit) :**

| Tâche | Récompense |
|-------|-----------|
| Jouer 2 matchs en Training | 20 XP |
| Jouer 2 matchs en Casual | 30 XP |
| Jouer 2 matchs en Ranked | 50 XP |
| Jouer 1 match en Hotseat | 30 XP |
| Jouer 1 match Online | 50 XP |
| Jouer 1 run de La Spirale | 40 Fragments |
| Jouer 1 run du Poing de Fer | 30 XP |
| Compléter 3 défis quotidiens | 50 éclats |
| **TOUT COMPLÉTER** | **100 éclats + badge "Passeport Complet"** |

Renouvellement tous les lundis. Le passeport est gratuit — c'est un outil de rétention, pas de monétisation.

---

## Résumé — Matrice de priorité

| Mode | Effort | Impact | Addictif ? | Priorité |
|------|--------|--------|------------|----------|
| **La Spirale** (roguelike) | L (3-5 jours) | Très haut | ⭐⭐⭐⭐⭐ | 🔴 **P1** |
| **Améliorations Tournoi + Daily** | S (1 jour) | Moyen | ⭐⭐⭐ | 🟡 P2 |
| **Poing de Fer** (survival) | M (2 jours) | Haut | ⭐⭐⭐⭐ | 🟡 P2 |
| **Quitte ou Double** | S (1 jour) | Moyen | ⭐⭐⭐⭐ | 🟢 P3 |
| **Défi de l'Architecte** (puzzles) | M (2 jours) | Moyen | ⭐⭐⭐ | 🟢 P3 |
| **Quick Party** (social) | S (1 jour) | Bas (niche) | ⭐⭐ | ⚪ P4 |
| **Passeport du Joueur** | S (1 jour) | Haut | ⭐⭐⭐ | 🟡 P2 |

**Recommandation:** La Spirale en priorité absolue. C'est le mode qui transforme RPSLS d'un "jeu de matchs" en "jeu de session". Il réutilise 90% de l'existant (cartes, IA, UI des lanes) et ajoute la couche manquante : la progression persistante et le choix stratégique entre les combats.

---

## 8. 🧬 RÉINVENTION DU GAMEPLAY — Nouveaux paradigmes de jeu

**Philosophie:** Le RPSLS classique est un jeu à somme nulle sur 5 symboles en relation circulaire. Pour innover VRAIMENT, il faut briser ce cadre tout en gardant l'ADN : la lecture d'intention, le bluff, et la boucle courte de décision. Voici 8 propositions de gameplay radicalement nouveaux, chacun pouvant devenir un mode de jeu complet.

---

### 8.1 🧩 LES ÉCHECS QUANTIQUES — Les symboles changent de pouvoir en cours de partie

**Concept:** Les 5 symboles ne sont PAS fixes. Chaque symbole a une "charge" qui évolue tour après tour. Les relations de victoire/défaite sont redéfinies dynamiquement.

**Mécanique de base:**
- Chaque symbole a une **charge** de 0 à 3.
- Les relations sont : **charge supérieure bat charge inférieure**.
- Quand deux symboles de même charge s'affrontent, on applique les règles RPSLS classiques.
- À chaque round où un symbole est joué, sa charge augmente de +1 (max 3).
- À chaque round où un symbole n'est PAS joué, sa charge diminue de -1 (min 0).

**Exemple de round:**
```
Tour 1: Joueur A joue Rock (charge 0→1), Joueur B joue Paper (charge 0→1)
        → Même charge (1 vs 1) → RPSLS classique : Paper bat Rock → B gagne

Tour 3: Rock a été joué 2 fois (charge=2), Lizard a été joué 1 fois (charge=1)
        → A joue Rock (2), B joue Lizard (1)
        → Charge supérieure : Rock(2) bat Lizard(1) → A gagne, PEU IMPORTE le RPSLS
```

**Ce que ça change:** Le joueur ne peut plus "spammer" un symbole sans conséquence. Jouer trop souvent le même move le rend prévisible... mais aussi plus PUISSANT. L'adversaire doit choisir entre contrer le RPSLS OU contrer la charge. Cette double lecture rend chaque round profondément stratégique.

**Interface:** Une jauge à 5 barres sous le pseudo montre la charge actuelle de chaque symbole.

---

### 8.2 🔮 LE JEU DE CARTES INVERSÉ — Vous ne choisissez pas VOTRE move, vous choisissez celui de L'ADVERSAIRE

**Concept:** À chaque round, chaque joueur choisit le move que son ADVERSAIRE devra jouer. Les moves sont révélés simultanément.

**Mécanique:**
- Le joueur A sélectionne le move que B devra jouer.
- Le joueur B sélectionne le move que A devra jouer.
- Révélation simultanée → résolution RPSLS normale.

**Ce que ça change:** Lire l'intention de l'adversaire ne suffit plus — il faut lire ce qu'il pense que VOUS allez lui faire jouer. C'est de la méta-lecture au carré.

**Variante "Échange équitable":** Chaque joueur choisit 1 move pour lui-même ET 1 move pour l'adversaire. Les deux paires sont révélées. Le gagnant est celui qui a le mieux "offert" ET le mieux "reçu".

**Variante "Don empoisonné":** Vous offrez un move à l'adversaire. S'il le joue, il gagne +1 pt bonus. MAIS vous savez quel move il va jouer... et vous pouvez donc choisir le contre parfait. Le bonus compense-t-il la prédictibilité ?

---

### 8.3 ⏳ LE DÉSÉQUILIBRE TEMPOREL — Jouer dans le passé et le futur

**Concept:** Les rounds ne sont pas isolés. Les moves joués persistent dans une "file temporelle" et peuvent être rappelés.

**Mécanique "Écho":**
- Chaque move joué est stocké dans une file de 3 slots (FIFO).
- Au round N, vous pouvez soit choisir un nouveau move, soit "rappeler" le move du round N-3 (le plus ancien de la file).
- Un move rappelé est retiré de la file et ne peut plus être rappelé.

**Exemple:**
```
Round 1: A joue Rock     → file = [Rock]
Round 2: A joue Paper    → file = [Rock, Paper]
Round 3: A joue Scissors → file = [Rock, Paper, Scissors]
Round 4: A rappelle Rock → file = [Paper, Scissors], A joue Rock
Round 5: A joue Lizard   → file = [Paper, Scissors, Lizard]
```

**Ce que ça change:** La mémoire devient une ressource. Vous pouvez "préparer" un move puissant et le rappeler plus tard. L'adversaire peut tracker votre file et anticiper vos rappels. Les rounds ne sont plus indépendants : chaque décision affecte les 3 prochains rounds.

**Variante "Oracle":** Au lieu de rappeler le passé, vous pouvez "emprunter" un move du futur. Vous jouez MAINTENANT un move que vous vous engagez à NE PAS jouer au round suivant. Si vous rompez l'engagement (vous le rejouez), vous perdez 2 pts.

---

### 8.4 🎭 LE DOUBLE JEU — Vous jouez DEUX moves, un seul compte

**Concept:** Chaque joueur choisit 2 moves par round au lieu d'1. Un seul des deux est "actif" — l'autre est un leurre. Mais l'adversaire ne sait pas lequel.

**Mécanique:**
- Round 1: A choisit [Rock, Paper]. B choisit [Scissors, Lizard].
- Révélation: A avait activé Paper. B avait activé Scissors.
- Résultat: Paper bat Rock? Non. A: Paper, B: Scissors → Scissors bat Paper → B gagne.
- Le leurre est révélé mais n'a aucun effet (sauf cartes spéciales).

**Cartes spéciales pour ce mode:**
- **Dédoublement** (Rare, 2 mana): Votre leurre compte AUSSI ce round (vous jouez effectivement 2 moves sur 2 lanes différentes).
- **Pari risqué** (Épique, 3 mana): Si votre leurre bat le move actif de l'adversaire, vous gagnez +2 pts.
- **Confusion** (Common, 1 mana): L'adversaire doit révéler lequel de ses 2 moves est le leurre AVANT la résolution.

**Ce que ça change:** Le bluff est mécanisé. Chaque round est un mini-jeu de "je sais que tu sais que je sais". Les cartes ajoutent des couches de manipulation du leurre.

---

### 8.5 🧬 LA FUSION ÉLÉMENTAIRE — Combiner deux symboles en un nouveau

**Concept:** Au lieu de 5 symboles, le joueur a accès à 5 symboles "de base" MAIS peut les FUSIONNER pour créer des symboles hybrides aux propriétés uniques.

**Grille de fusion (25 combinaisons):**

| Fusion | Nom | Bat | Est battu par | Notes |
|--------|-----|-----|--------------|-------|
| Rock+Rock | **Granite** | Lizard, Scissors, Spock | Paper, Lizard+Lizard | Rock² — double puissance mais double faiblesse |
| Rock+Paper | **Parchemin** | Rock, Spock, Lizard | Scissors, Paper | Le savoir pierre — polyvalent |
| Rock+Scissors | **Lame** | Paper, Lizard, Scissors | Spock, Rock | Tranchant minéral — offensif pur |
| Rock+Lizard | **Fossile** | Spock, Paper, Lizard | Rock, Scissors | Mémoire de la terre |
| Rock+Spock | **Météore** | Scissors, Paper, Spock | Lizard, Rock | Venue des cieux |
| Paper+Paper | **Codex** | Rock, Spock, Lizard | Scissors, Paper+Paper | Double savoir |
| Paper+Scissors | **Confetti** | Rock, Lizard | Spock, Scissors | Fragmentation joyeuse |
| Paper+Lizard | **Mensonge** | Spock, Rock, Scissors | Lizard, Paper | Le savoir qui trompe |
| Paper+Spock | **Théorème** | Rock, Scissors, Lizard | Paper, Spock | Logique pure |
| Scissors+Scissors | **Guillotine** | Paper, Lizard, Spock | Rock, Scissors | Double tranchant |
| Scissors+Lizard | **Griffes** | Paper, Spock, Rock | Scissors, Lizard | Prédateur |
| Scissors+Spock | **Laser** | Rock, Paper, Lizard | Spock, Scissors | Technologie de pointe |
| Lizard+Lizard | **Hydre** | Spock, Paper, Scissors | Rock, Lizard | Deux têtes valent mieux qu'une |
| Lizard+Spock | **Mutant** | Rock, Scissors, Paper | Lizard, Spock | Évolution instable |
| Spock+Spock | **Vulcain** | Rock, Scissors, Lizard | Paper, Spock | Logique absolue |

**Mécanique de fusion:**
- Le joueur a un deck de 8 cartes "élément" (5 de base + 3 de son choix).
- Chaque round, il pioche 2 cartes et choisit de les fusionner OU d'en jouer une seule.
- Fusionner coûte 1 mana (les éléments de base sont gratuits).
- Les fusions sont à usage unique : la carte créée est défaussée après usage.

**Ce que ça change:** 5 symboles deviennent 25. La profondeur stratégique explose. Le deck building devient crucial : quelles paires voulez-vous pouvoir créer ? L'adversaire peut déduire vos fusions possibles à partir de votre deck visible.

---

### 8.6 🧠 LA GUERRE PSYCHOLOGIQUE — Pas de moves, juste des intentions

**Concept:** Il n'y a plus 5 symboles. À la place, chaque joueur dispose de 5 "INTENTIONS" qui sont des concepts abstraits. Chaque intention a une relation circulaire avec les autres, mais le joueur ne connaît PAS les intentions de l'adversaire — il ne connaît que les SIENNES.

**Les 5 Intentions:**

| Intention | Symbole | Philosophie | Bat | Perd contre |
|-----------|---------|-------------|-----|-------------|
| **Dominer** | 👑 | Imposer sa volonté | Observer, Tromper | Comprendre, Adapter |
| **Comprendre** | 🧠 | Analyser, déduire | Dominer, Adapter | Observer, Tromper |
| **Observer** | 👁️ | Attendre, lire | Comprendre, Tromper | Dominer, Adapter |
| **Tromper** | 🎭 | Bluffer, feinter | Comprendre, Adapter | Dominer, Observer |
| **Adapter** | 🌊 | Changer, évoluer | Dominer, Observer | Comprendre, Tromper |

**Mécanique spéciale:** Chaque joueur voit l'HISTORIQUE des intentions de l'adversaire mais pas leur nom — juste une icône abstraite (un glyphe unique par intention). Le joueur doit DÉDUIRE quel glyphe correspond à quelle intention en observant les résultats des rounds précédents.

**Exemple:**
```
Round 1: A joue 👑, B joue 🧠 → B gagne
         → A apprend que 🧠 bat 👑 (ou que 👑 perd contre 🧠)
Round 2: A joue 🎭, B joue 🧠 → B gagne encore
         → A suspecte que 🧠 est "Comprendre" (car il bat à la fois 👑 et 🎭)
Round 3: A joue 👁️, B joue 🧠 → A gagne ENFIN
         → A confirme : 👁️ = Observer, qui bat Comprendre
```

**Ce que ça change:** Le jeu devient une partie d'induction logique doublée de bluff. Vous ne jouez pas seulement contre l'adversaire — vous jouez contre votre propre ignorance de ses règles. Chaque partie est unique car les glyphs sont randomisés.

---

### 8.7 🌐 LE RÉSEAU DE CONFIANCE — Mode coopératif à 2 joueurs

**Concept:** Deux joueurs (ou 1 joueur + 1 IA) affrontent un boss ensemble. Ils ne peuvent PAS communiquer directement. Ils voient les moves de l'autre APRÈS avoir choisi les leurs. La coordination émerge de la lecture mutuelle.

**Mécanique:**
- Le boss annonce 3 moves à l'avance (visibles des deux joueurs).
- Chaque joueur choisit 1 move.
- Si les DEUX joueurs battent leurs moves de boss respectifs, le boss perd 1 PV.
- Si UN SEUL joueur bat son boss, le boss perd 0.5 PV (arrondi inférieur).
- Si AUCUN joueur ne bat son boss, les joueurs perdent 1 PV collectif.
- Les joueurs voient le move de l'autre APRÈS avoir joué → ils peuvent ajuster au round suivant.

**Le twist:** Les joueurs partagent un pool de 5 PV. Le boss en a 10. Si le boss arrive à 5 PV, il change de pattern et devient imprévisible (les moves annoncés ne sont plus ceux joués).

**Ce que ça change:** La coordination sans communication est un défi de lecture d'intention à deux. Chaque joueur doit penser "que va faire mon partenaire ?" ET "que va faire le boss ?". Les rounds créent une narration : "je pensais que tu allais jouer Paper, j'ai joué Scissors pour couvrir ton Rock... mais tu as joué Lizard !"

---

### 8.8 🧩 LE SET DE SYMBOLES MUTANT — Le jeu évolue PENDANT la partie

**Concept:** Le set de symboles disponibles change en cours de match. Certains symboles "meurent" et sont remplacés par de nouveaux. L'arbre des possibles se transforme.

**Mécanique "Extinction/Renaissance":**
- Le set de départ est les 5 symboles RPSLS classiques.
- Après chaque round, le symbole le MOINS joué (tous joueurs confondus) est RETIRÉ du set.
- Un nouveau symbole est AJOUTÉ au set, pioché dans une réserve de 12 symboles inédits.

**Les 12 symboles de réserve:**

| Symbole | Nom | Bat | Perd contre |
|---------|-----|-----|-------------|
| ⚡ | Foudre | Eau, Métal | Terre, Bois |
| 🌍 | Terre | Foudre, Feu | Eau, Métal |
| 💧 | Eau | Terre, Feu | Bois, Foudre |
| 🔥 | Feu | Bois, Métal | Eau, Terre |
| 🌿 | Bois | Eau, Terre | Feu, Métal |
| 🪨 | Métal | Bois, Foudre | Feu, Eau |
| 🌑 | Ombre | Lumière, Bois | Foudre, Terre |
| ☀️ | Lumière | Ombre, Feu | Eau, Métal |
| 🌀 | Vide | Terre, Eau | Lumière, Bois |
| 💎 | Cristal | Ombre, Métal | Feu, Foudre |
| 🕸️ | Toile | Vide, Lumière | Cristal, Bois |
| 🩸 | Sang | Cristal, Toile | Ombre, Vide |

**Ce que ça change:** L'adaptation est continue. Un joueur qui maîtrise le RPSLS classique se retrouve soudain face à "Cristal" et "Vide" — des symboles dont il ne connaît pas encore les interactions par cœur. La mémoire et l'adaptabilité remplacent la routine. Chaque match est unique car l'ordre d'apparition des symboles de réserve est aléatoire.

---

## 9. 🧬 TABLEAU DE SYNTHÈSE — Les 8 nouveaux paradigmes

| # | Mode | Type d'innovation | Courbe d'apprentissage | Rejouabilité | Originalité |
|---|------|------------------|----------------------|-------------|-------------|
| 8.1 | **Échecs Quantiques** | Charges dynamiques sur les symboles | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 8.2 | **Jeu de Cartes Inversé** | Inversion du choix (vous choisissez pour l'autre) | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 8.3 | **Déséquilibre Temporel** | File temporelle, rappel/emprunt de moves | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 8.4 | **Double Jeu** | Deux moves, un leurre | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 8.5 | **Fusion Élémentaire** | 25 combinaisons à partir de 5 bases | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 8.6 | **Guerre Psychologique** | Intentions abstraites + déduction des règles | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 8.7 | **Réseau de Confiance** | Coopératif 2 joueurs sans communication | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 8.8 | **Set de Symboles Mutant** | Extinction/renaissance des symboles en cours de match | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 10. Feuille de route — Quel mode implémenter en premier ?

| Priorité | Mode | Raison |
|----------|------|--------|
| 🔴 **P1** | **Fusion Élémentaire** (8.5) | Exploite le système de cartes existant. 25 combinaisons = contenu massif pour peu de code. Visuellement spectaculaire (animations de fusion). |
| 🔴 **P1** | **Double Jeu** (8.4) | Simple à expliquer (2 moves, 1 leurre). Ajoute du bluff à tous les modes existants. Peut être un "modificateur de match" plutôt qu'un mode séparé. |
| 🟡 **P2** | **Set de Symboles Mutant** (8.8) | Les 12 nouveaux symboles sont du contenu pur. Le système d'extinction/renaissance est simple à coder (un tableau qu'on modifie). |
| 🟡 **P2** | **Jeu de Cartes Inversé** (8.2) | Mind-bending. Très fort pour le bouche-à-oreille ("tu joues pour l'adversaire!"). Simple à implémenter (juste inverser qui choisit quoi). |
| 🟢 **P3** | **Échecs Quantiques** (8.1) | Profondeur stratégique énorme. La jauge de charge est un bel objet UI. |
| 🟢 **P3** | **Déséquilibre Temporel** (8.3) | Le plus complexe à expliquer mais le plus satisfaisant une fois maîtrisé. |
| 🟢 **P3** | **Guerre Psychologique** (8.6) | Le plus original. Chaque partie est unique car les glyphs sont randomisés. |
| ⚪ **P4** | **Réseau de Confiance** (8.7) | Mode niche mais parfait pour les couples/amis. Excellente démo pour les streams. |
