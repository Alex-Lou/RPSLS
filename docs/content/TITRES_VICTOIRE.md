# Titres de Victoire — RPSLS

**Date:** 2026-06-07
**Usage:** Système de titres déblocables selon le type de victoire, affichés sur l'écran de fin de match et dans le profil joueur.
**Design:** 4 rangs de rareté (Commun → Rare → Épique → Légendaire), attribués automatiquement selon les conditions du match.
**Traduction:** Les titres sont en français (source). Une passe de traduction automatique vers les 14 autres locales est prévue — les titres sont courts (2-5 mots) donc facilement traduisibles.

---

## Plan du système

### Attribution automatique
À la fin de chaque match, le serveur/match engine évalue les conditions et attribue le titre le plus rare correspondant. Le joueur ne choisit pas — le titre est une **conséquence** de sa performance.

### Règles de priorité
1. Si plusieurs titres sont éligibles, le plus rare l'emporte
2. Un titre Légendaire écrase tout titre inférieur
3. Les titres sont cumulatifs dans le profil (collection), mais seul le plus récent/rare s'affiche
4. Certains titres sont contradictoires (ex: "Écrasant" et "Sur le fil") → le plus rare prime

### Affichage
- **Écran de victoire:** Titre centré, avec une couronne/stars selon la rareté
- **Profil joueur:** Collection de titres débloqués, le favori épinglable
- **Leaderboard:** Le titre s'affiche à côté du pseudo si le joueur le choisit

### Raretés
| Rang | Icône | Condition typique | Fréquence estimée |
|------|-------|-------------------|-------------------|
| **Commun** | ⚪ | Victoire standard, méritante mais accessible | ~45% des victoires |
| **Rare** | 🔵 | Condition spécifique atteinte | ~25% des victoires |
| **Épique** | 🟣 | Performance remarquable | ~15% des victoires |
| **Légendaire** | 🟡 | Exploit rarissime | ~10% des victoires |

---

## TABLE DES TITRES

---

### ⚪ COMMUN — Victoires simples, accessibles à tous, mais toujours classe

| # | Titre | Condition | Note |
|---|-------|-----------|------|
| 1 | **Victorieux** | Gagner un match (n'importe lequel) | Le titre par défaut |
| 2 | **Triomphant** | Gagner un match en BO3+ | Classique |
| 3 | **En forme** | Gagner 2 matchs d'affilée | Sérieux |
| 4 | **Sur la bonne voie** | Gagner après une défaite précédente | Rédemption |
| 5 | **Premier sang** | Gagner le premier round | Agressif |
| 6 | **Dompteur de CPU** | Gagner contre l'IA en difficile | Méritoire |
| 7 | **Joueur du dimanche** | Gagner un match casual | Détendu |
| 8 | **Bien joué** | Gagner avec un score de 2-1 en BO3 | Sobre |
| 9 | **Régulier** | Gagner 5 matchs en tout (tous types) | Progression |
| 10 | **Pas mal** | Gagner un match sans utiliser 2 fois le même move | Varié |
| 11 | **Là pour jouer** | Gagner un match en ligne | Social |
| 12 | **Machine à café** | Gagner un match à 3h du matin (heure locale) | Insolite |
| 13 | **Presque facile** | Gagner contre l'IA en facile | Humble |
| 14 | **À l'usure** | Gagner un match en BO7+ | Endurant |
| 15 | **Sans pression** | Gagner un match d'entraînement | Relax |
| 16 | **Bien lancé** | Gagner le premier match d'une session | Élan |
| 17 | **Poing final** | Gagner le match avec Rock au dernier round | Décisif |
| 18 | **Signature papier** | Gagner le match avec Paper au dernier round | Décisif |
| 19 | **Ciseaux d'argent** | Gagner le match avec Scissors au dernier round | Décisif |
| 20 | **Crochet du lézard** | Gagner le match avec Lizard au dernier round | Décisif |
| 21 | **Salut Vulcain** | Gagner le match avec Spock au dernier round | Décisif |
| 22 | **Rapide comme l'éclair** | Gagner un match en moins de 3 minutes | Vélocité |
| 23 | **Patience de pierre** | Gagner un match en plus de 8 minutes | Endurance |
| 24 | **Score parfait** | Gagner un match dont le score final est un nombre rond (2-0, 3-0, 3-1) | Net |
| 25 | **Chaud devant** | Gagner le round après avoir perdu le précédent | Réactif |
| 26 | **Routine du soir** | Gagner 3 matchs dans la même journée | Assidu |
| 27 | **Duel au sommet** | Gagner un match où les deux joueurs ont le même niveau | Équitable |
| 28 | **Copieur** | Gagner un round en jouant le même move que l'adversaire au round précédent | Miroir |
| 29 | **Retour aux sources** | Gagner avec le move Rock après 3 rounds sans l'utiliser | Come-back |
| 30 | **Économe** | Gagner un match en n'utilisant que 2 moves différents | Minimaliste |

---

### 🔵 RARE — Un peu de style, un peu de mérite

| # | Titre | Condition | Note |
|---|-------|-----------|------|
| 31 | **Maître du 3-0** | Gagner 3 rounds d'affilée sans en perdre un | Propre |
| 32 | **Voyant** | Gagner un round en prédisant le move adverse (Augur) | Carte spéciale |
| 33 | **Chasseur de primes** | Gagner contre un joueur mieux classé (100+ LP d'écart) | Underdog |
| 34 | **Saigneur** | Gagner un match en Constellation | Lanes |
| 35 | **Inarrêtable** | Gagner 3 matchs consécutifs | Streak |
| 36 | **Artisan du nul** | Gagner un match avec au moins un round draw | Mixte |
| 37 | **Spécialiste du Rock** | Gagner un match en jouant Rock 50%+ du temps | Mono-maniaque |
| 38 | **Spécialiste du Paper** | Gagner un match en jouant Paper 50%+ du temps | Mono-maniaque |
| 39 | **Spécialiste du Scissors** | Gagner un match en jouant Scissors 50%+ du temps | Mono-maniaque |
| 40 | **Spécialiste du Lizard** | Gagner un match en jouant Lizard 50%+ du temps | Mono-maniaque |
| 41 | **Spécialiste du Spock** | Gagner un match en jouant Spock 50%+ du temps | Mono-maniaque |
| 42 | **5 étoiles** | Gagner avec chacun des 5 moves au moins une fois | Pentagramme |
| 43 | **Danseur** | Gagner en alternant 2 moves uniquement | Binaire |
| 44 | **Vengeur** | Gagner contre le même adversaire qui vous a battu avant | Revanche |
| 45 | **Sur la brèche** | Gagner un match en étant mené 0-2 puis en remontant | Comeback |
| 46 | **Lanceur d'alerte** | Gagner un match en moins de 2 minutes | Rapide |
| 47 | **Flegmatique** | Gagner en prenant tout le temps imparti à chaque round | Lent |
| 48 | **Duelliste** | Gagner en 1v1 classique en ligne | Online |
| 49 | **Atomiseur** | Gagner un round avec Spock vs Scissors | Classique |
| 50 | **Écrabouilleur** | Gagner un round avec Rock vs Scissors | Classique |
| 51 | **Collectionneur** | Gagner avec 3 moves différents dans le match | Varié |

---

### 🟣 ÉPIQUE — Du talent, de la chance ou les deux

| # | Titre | Condition | Note |
|---|-------|-----------|------|
| 52 | **Balayeur cosmique** | Gagner 3-0 en Constellation (sweep toutes les lanes) | Constellation |
| 53 | **Prophète** | Gagner en ayant prédit correctement 3 moves adverses | Prescience |
| 54 | **Mur de fer** | Gagner sans perdre un seul round (clean sweep) | Parfait |
| 55 | **Revenant** | Gagner après avoir été mené 0-2 (reverse sweep) | Héroïque |
| 56 | **Débutant de génie** | Gagner un match en étant niveau 1 et en battant un niveau 10+ | Underdog |
| 57 | **Légion** | Gagner 5 matchs consécutifs | Streak solide |
| 58 | **Météore** | Gagner un match en moins de 60 secondes | Speedrun |
| 59 | **Omniscient** | Gagner en utilisant Oracle puis en balayant 3-0 | Constellation |
| 60 | **Clone parfait** | Gagner un match où chaque round est un draw sauf un (le décisif) | Clinique |
| 61 | **Cerbère** | Gagner un match en utilisant exactement 3 moves, jamais les 2 autres | Triple-only |
| 62 | **Tour Eiffel** | Gagner en jouant Rock 100% du match | Troll assumé |
| 63 | **Bureaucrate** | Gagner en jouant Paper 100% du match | Troll assumé |
| 64 | **Couturier** | Gagner en jouant Scissors 100% du match | Troll assumé |
| 65 | **Herpétologue** | Gagner en jouant Lizard 100% du match | Troll assumé |
| 66 | **Vulcain** | Gagner en jouant Spock 100% du match | Troll assumé |
| 67 | **Bibliothèque** | Gagner avec 100% des moves = Paper | Érudit |
| 68 | **Géologue** | Gagner avec 100% des moves = Rock | Minéral |
| 69 | **Marathonien** | Gagner un match en BO9 complet (5-4) | Endurance |
| 70 | **Joueur de flûte** | Gagner un match avec exactement 2 draws et 1 win | Précis |
| 71 | **Anti-méta** | Gagner contre un adversaire qui joue le move le plus populaire | Contrarien |
| 72 | **Stratège** | Gagner en utilisant exactement 1 fois chaque move (BO5) | Parfait équilibre |
| 73 | **Dormeur** | Gagner en laissant le timer expirer puis en battant l'adversaire au dernier round | Flegme ultime |
| 74 | **Fantôme** | Gagner un match en ligne sans perdre un seul round | Domination |

---

### 🟡 LÉGENDAIRE — Des conditions rarissimes, presque impossibles

| # | Titre | Condition | Note |
|---|-------|-----------|------|
| 75 | **Le Savant** | Gagner un match en utilisant chaque move EXACTEMENT 1 fois en BO5 | Équilibre absolu |
| 76 | **Le Stratège Fou** | Gagner un match où l'adversaire a toujours joué le contre parfait... sauf au dernier round | Insensé |
| 77 | **Némésis** | Battre le même adversaire 3 fois d'affilée en ligne | Rivalité |
| 78 | **Dieu du RPSLS** | Gagner 10 matchs consécutifs | Série légendaire |
| 79 | **Intouchable** | Gagner 3 matchs d'affilée sans perdre UN SEUL round (clean sweep ×3) | Perfection |
| 80 | **Résurrecteur** | Gagner un match en Constellation après avoir été mené 0-2 en rounds, puis 0-2 en lanes au round décisif | Miracle |
| 81 | **Voyageur temporel** | Gagner un match en prédisant correctement CHAQUE move adverse | 100% read |
| 82 | **Géant tueur** | Gagner contre le #1 du classement en étant classé hors du top 100 | David vs Goliath |
| 83 | **Astrophysicien** | Gagner un match en Constellation 3-0 avec une Supernova activée | Cosmos |
| 84 | **Polymathe** | Gagner un match dans CHAQUE mode de jeu (Training, Casual, Ranked, Online, Constellation) au cours d'une même journée | Complétionniste |
| 85 | **Maître des Probabilités** | Gagner un match où chaque round s'est joué sur le move le moins probable statistiquement | Statistique |
| 86 | **Invaincu** | Gagner 25 matchs d'affilée (tous modes confondus) | Infini |
| 87 | **Le Fantôme de Spock** | Gagner un match en ligne où l'adversaire abandonne au 1er round | Psychologique |
| 88 | **Tétraphobe** | Gagner un match BO9 en refusant de jouer le même move 2 rounds de suite | Discipline |
| 89 | **Éclipse** | Gagner un match en Constellation où l'adversaire n'a marqué aucun point (0-X, 0-X, 0-X) | Perfection absolue |
| 90 | **Oracle Suprême** | Gagner un match après avoir utilisé Carte Augur + Oracle + Prescience dans le même match | Full vision |
| 91 | **Maître de l'Aube** | Gagner 100 matchs dans sa carrière | Vétéran |
| 92 | **L'Unique** | Gagner un match où chaque move joué (par vous) est différent de tous les autres sur les 5 rounds | Variété ultime |
| 93 | **Télépathe** | Gagner un match en Constellation en jouant exactement le même triplet de moves que l'adversaire | Miroir cosmique |
| 94 | **Le Cauchemar de Nash** | Gagner un match où le score final est le plus serré possible : 3-2 en BO5, chaque round décidé par 1 point | Équilibre pur |
| 95 | **Le Choix de Schrödinger** | Gagner un match où le dernier round décisif aurait été un draw si vous aviez joué l'autre move | Destin |

---

## Plan d'implémentation

### Phase 1 — Structure de données
```typescript
interface VictoryTitle {
  id: string;                    // "titre_savant"
  tier: "commun" | "rare" | "epique" | "legendaire";
  text: string;                  // "Le Savant" — clé i18n
  condition: VictoryCondition;   // fonction d'évaluation
  icon: string;                  // "⚪" "🔵" "🟣" "🟡"
}

type VictoryCondition = (match: MatchRecord, player: Player) => boolean;
```

### Phase 2 — Évaluation post-match
Dans `recordMatch()` du store, appeler `evaluateTitles(match, player)` qui renvoie le titre le plus rare correspondant. Stocker dans `player.unlockedTitles: string[]` et `player.activeTitle: string`.

### Phase 3 — i18n
Ajouter les clés dans `en.ts` sous le namespace `title.*` :
```typescript
"title.savant": "The Scholar",
"title.stratège_fou": "The Mad Strategist",
// ...95 entrées
```

### Phase 4 — UI
- **Écran fin de match** : Afficher le titre débloqué avec animation (scale + glow)
- **Profil** : Onglet "Titres" montrant la collection, possibilité d'épingler un favori
- **Leaderboard** : Le titre épinglé s'affiche à côté du pseudo

---

## Notes pour la traduction

Les titres sont volontairement courts (1-4 mots) pour faciliter la traduction automatique vers 15 langues. Les jeux de mots spécifiques à une culture (ex: "Tour Eiffel" = français uniquement) sont marqués et pourront avoir une adaptation locale plutôt qu'une traduction littérale.

**Stratégie de traduction recommandée :**
1. Traduire d'abord les COMMUN (30 titres) — priorité haute, visibles par tous
2. Traduire les RARE (21 titres) — priorité moyenne
3. Traduire les ÉPIQUE (23 titres) — priorité basse (peu de joueurs les voient)
4. Traduire les LÉGENDAIRE (21 titres) — priorité basse (rarissimes)
5. Pour les jeux de mots intraduisibles, proposer un équivalent culturel local

**Exemple d'adaptation :**
- "Tour Eiffel" (Rock 100%) → 🇬🇧 "Stonehenge" / 🇩🇪 "Brocken" / 🇯🇵 "富士山" (Mont Fuji)
- "Cerbère" (3 moves only) → universel (mythologie grecque connue partout)
- "Géant tueur" → référence à David vs Goliath, universel

---

## Stats

- **Total titres:** 95
- **Commun:** 30 (31.6%)
- **Rare:** 21 (22.1%)
- **Épique:** 23 (24.2%)
- **Légendaire:** 21 (22.1%)
- **Durée de vie estimée:** Un joueur actif débloque tous les COMMUN en ~1 semaine, tous les RARE en ~1 mois, ~50% des ÉPIQUE en 3 mois, et 2-3 LÉGENDAIRE en 1 an.