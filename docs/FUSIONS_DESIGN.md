# Système des Gestes Croisés — Les Alignements

**Date:** 2026-06-07  
**Concept:** Le joueur ne se bat pas avec des "objets". Il se bat avec ses **mains**. Chaque main peut former un symbole. Quand les deux mains forment des symboles différents, l'énergie qui en résulte crée un **Alignement** — une distorsion temporaire des règles du jeu. Ce n'est pas de la magie, c'est de la manipulation des probabilités par la concentration.

**Différence fondamentale avec le système précédent:** Aucun "objet" n'est créé. Pas de rocher, pas de météore, pas d'épée. L'Alignement est une **modification de l'état du match** : une règle qui se plie, une contrainte qui apparaît, une réalité qui bascule.

---

## 1. Comment ça marche — La Posture

### 1.1 Activer un Alignement

Le joueur dispose de **deux mains** (image de deux mains à l'écran, paumes vers le ciel). Pour chaque round, le joueur choisit UN symbole pour sa main GAUCHE et UN symbole pour sa main DROITE (ou le même pour les deux). 

La combinaison Gauche/Droite forme une **Posture**. Si la Posture correspond à un Alignement connu, et si le joueur gagne le round, l'Alignement se déclenche.

```
Main Gauche : Rock     ─┐
                         ├──→ Alignement "L'Étreinte" (Rock+Paper)
Main Droite : Paper    ─┘
```

L'Alignement n'est PAS un troisième symbole qui remplace les deux. Les deux symboles sont joués NORMALEMENT sur les lanes correspondantes. L'Alignement est un EFFET ADDITIONNEL qui distord les règles pour le round en cours ou les suivants.

### 1.2 Contraintes

- Le joueur doit avoir débloqué l'Alignement dans son Codex (voir §4)
- Coût : 2 mana (1 par main) pour les Alignements Tier 1, 3 mana pour Tier 2, 4 mana pour Tier 3
- Si le joueur PERD le round, l'Alignement ne se déclenche PAS (l'énergie se dissipe)
- Maximum 2 Alignements par match
- Les deux mains doivent former des symboles DIFFÉRENTS (sinon, c'est un "Renforcement" — effet plus faible, voir §2)

### 1.3 Le Renforcement (mains identiques)

Si les deux mains forment le MÊME symbole, le joueur active un **Renforcement** au lieu d'un Alignement. Le Renforcement est plus simple et ne coûte que 1 mana :

| Mains | Nom | Effet |
|-------|-----|-------|
| Rock+Rock | **Double Poigne** | Ce round, votre Rock inflige 1 dégât même si vous perdez le round (dégât de contusion) |
| Paper+Paper | **Double Voile** | Ce round, si vous perdez, le dégât est divisé par 2 (arrondi inférieur) |
| Scissors+Scissors | **Double Tranchant** | Ce round, le perdant du round subit 1 dégât supplémentaire |
| Lizard+Lizard | **Double Mue** | Échangez votre main avec la pioche : défaussez toute votre main et piochez-en une nouvelle |
| Spock+Spock | **Double Foyer** | Ce round, révélez le move que vous allez jouer AU PROCHAIN round (engagement public) et gagnez +1 pt si vous le tenez |

---

## 2. Les 25 Alignements (combinaisons à deux mains différentes)

Les Alignements sont présentés par PAIRES (Gauche/Droite). L'ordre Gauche→Droite compte : Rock+Paper n'a pas le même effet que Paper+Rock.

---

### 2.1 Paire R+P — Rock (G) + Paper (D)

**Nom: L'Étreinte** (Tier 1)
**Effet:** L'adversaire ne peut PAS jouer le même symbole que celui qu'il a joué au round précédent. Si c'était son seul choix valable (contrainte de deck/main), il subit 1 dégât de frustration.
**Animation:** Les mains du joueur se referment lentement. Une pression invisible s'exerce sur l'avatar adverse qui tremble légèrement. Un symbole barré apparaît au-dessus de sa tête (le symbole interdit).
**Philosophie:** "Ce qui a été fait est fait. Ne te répète pas."

---

### 2.2 Paire P+R — Paper (G) + Rock (D)

**Nom: Le Voile Tend** (Tier 1)
**Effet:** La lane où vous jouez Paper devient INVISIBLE pour l'adversaire. Il ne voit pas quel symbole vous y avez placé jusqu'à la révélation. (Normalement, les deux joueurs voient leurs propres symboles mais pas ceux de l'autre — ici, le vôtre est caché même de la preview de lane.)
**Animation:** La lane se couvre d'un brouillard blanc opaque. Votre symbole est masqué par un voile de brume. L'adversaire voit juste "???".
**Philosophie:** "Ce qui est caché est plus puissant que ce qui est montré."

---

### 2.3 Paire R+S — Rock (G) + Scissors (D)

**Nom: La Brèche** (Tier 2)
**Effet:** Si vous gagnez ce round, l'adversaire PERD une carte au hasard de sa main. Pas défaussée — PERDUE. Elle ne va pas dans la défausse, elle est retirée du match.
**Animation:** Un craquement sec. La main droite (Scissors) tranche l'air. Une fissure apparaît dans la zone de main de l'adversaire. Une carte est aspirée dans la fissure et disparaît dans le néant.
**Philosophie:** "Ce qui est brisé ne peut être réparé."

---

### 2.4 Paire S+R — Scissors (G) + Rock (D)

**Nom: La Faille** (Tier 1)
**Effet:** La lane sur laquelle vous jouez Scissors est DUPLIQUÉE. Le résultat de cette lane compte DEUX FOIS pour le score du round (victoire = 2 pts, défaite = -2 pts).
**Animation:** La lane vibre et se dédouble — une image fantôme de la même lane apparaît superposée. Les deux compteurs de score clignotent.
**Philosophie:** "Un seul coup, deux conséquences."

---

### 2.5 Paire R+L — Rock (G) + Lizard (D)

**Nom: L'Ancrage** (Tier 2)
**Effet:** Ce round, vous ne POUVEZ PAS perdre plus d'1 point (même si vous perdez sur plusieurs lanes). Plafond de dégâts à 1. Tout dégât au-delà de 1 est ignoré.
**Animation:** La main gauche (Rock) s'enfonce dans le sol. Des racines de pierre s'étendent sous l'avatar. Un bouclier translucide absorbe les dégâts excédentaires (effet de dissipation).
**Philosophie:** "Ancré. Inébranlable."

---

### 2.6 Paire L+R — Lizard (G) + Rock (D)

**Nom: La Régénération** (Tier 1)
**Effet:** Si vous avez perdu le round précédent, regagnez 1 PV ce round (le dégât du round précédent est annulé). Ne fonctionne qu'une fois par match.
**Animation:** La main droite (Lizard) s'enroule autour du torse de l'avatar. Une lueur verte régénératrice parcourt le corps. La barre de vie remonte d'un cran.
**Philosophie:** "Ce qui est perdu peut être retrouvé."

---

### 2.7 Paire R+Sp — Rock (G) + Spock (D)

**Nom: L'Implosion** (Tier 3)
**Effet:** Détruisez TOUS les modificateurs actifs sur le plateau. TOUS. Les vôtres ET ceux de l'adversaire. Terrains interdits, lanes bénies/piégées, charges, poisons, sceaux — TOUT. Le plateau redevient NEUTRE. Les cartes déjà jouées restent, mais leurs effets persistants sont annulés.
**Animation:** La main gauche (Rock) et la main droite (Spock) se rapprochent. Un point de singularité apparaît entre elles. Tout l'écran est aspiré vers ce point pendant 0.5s, puis "relâché" — le plateau est clean.
**Philosophie:** "Avant le début, il n'y avait rien. Retour au rien."

---

### 2.8 Paire Sp+R — Spock (G) + Rock (D)

**Nom: La Gravité Zéro** (Tier 2)
**Effet:** Ce round, l'ORDRE des lanes est inversé pour l'adversaire. La lane 1 devient la lane 3, la 2 reste la 2, la 3 devient la 1. L'adversaire joue normalement mais ses placements sont redistribués.
**Animation:** Le plateau entier bascule — une rotation à 180° en 0.3s. Les lanes échangent leurs positions. L'adversaire voit ses propres symboles "glisser" vers leurs nouvelles positions.
**Philosophie:** "Le haut est le bas. Le bas est le haut."

---

### 2.9 Paire P+S — Paper (G) + Scissors (D)

**Nom: La Signature** (Tier 1)
**Effet:** Marquez la lane où vous jouez Paper. Si vous gagnez cette lane, le symbole que vous y avez joué est "enregistré". Au prochain round, si l'adversaire joue CE symbole, il est automatiquement révélé avant que vous ne choisissiez votre move.
**Animation:** Un sceau de cire fondue apparaît sur la lane, avec l'empreinte de votre symbole. Au round suivant, si l'adversaire s'apprête à jouer ce symbole, le sceau se brise et le symbole est affiché.
**Philosophie:** "Je sais ce que tu vas faire. Je l'ai écrit."

---

### 2.10 Paire S+P — Scissors (G) + Paper (D)

**Nom: Le Dédoublement** (Tier 2)
**Effet:** Votre move Scissors est COPIÉ sur une deuxième lane de votre choix. Vous jouez effectivement Scissors sur DEUX lanes avec UNE seule main. L'autre main (Paper) joue normalement.
**Animation:** La main Scissors se dédouble — une image miroir apparaît et va se placer sur la seconde lane. Le Paper va sur sa lane normale. Trois lanes, deux symboles différents.
**Philosophie:** "Un seul geste, deux présences."

---

### 2.11 Paire P+L — Paper (G) + Lizard (D)

**Nom: L'Amnésie** (Tier 2)
**Effet:** L'adversaire OUBLIE les deux derniers rounds. Son historique récent est effacé de son interface. Il voit "??? ???". Il doit se souvenir par lui-même de ce qui s'est passé. (L'historique réel est toujours enregistré, seule l'interface est masquée.)
**Animation:** Un brouillard mental (nuage violet) enveloppe la tête de l'avatar adverse. Les icônes des deux derniers rounds dans l'historique sont remplacées par des glyphes illisibles.
**Philosophie:** "Le passé est une illusion que je contrôle."

---

### 2.12 Paire L+P — Lizard (G) + Paper (D)

**Nom: La Dévoration** (Tier 3)
**Effet:** "Mangez" la carte que l'adversaire vient de jouer. La carte est retirée du match. Vous gagnez son coût en mana pour le prochain round. Si la carte est Légendaire, vous gagnez 2 pts bonus en plus.
**Animation:** La main Lizard ouvre une gueule fantomatique qui engloutit la carte adverse. La carte est aspirée dans une spirale verte. Votre barre de mana s'illumine.
**Philosophie:** "Ta force devient la mienne."

---

### 2.13 Paire P+Sp — Paper (G) + Spock (D)

**Nom: Le Calcul** (Tier 3)
**Effet:** L'interface affiche, pour CHAQUE symbole que vous pourriez jouer, le pourcentage de chance de gagner contre le move probable de l'adversaire (basé sur son historique). Un overlay statistique : "Rock: 62% | Paper: 15% | Scissors: 78% | Lizard: 34% | Spock: 45%". Ces chiffres sont RÉELS (calculés par le moteur). Le joueur a 2 secondes supplémentaires pour choisir.
**Animation:** Des lignes de données défilent devant les yeux de l'avatar. Des nombres apparaissent au-dessus de chaque symbole dans le sélecteur — police "monospace", vert matrix. L'horloge ralentit.
**Philosophie:** "La connaissance est la seule vraie arme."

---

### 2.14 Paire Sp+P — Spock (G) + Paper (D)

**Nom: L'Archive** (Tier 1)
**Effet:** Regardez les 3 PROCHAINES cartes de votre pioche (sans les réordonner). Vous pouvez en prendre UNE immédiatement. Les autres retournent dans l'ordre.
**Animation:** Un écran holographique s'ouvre devant l'avatar, montrant 3 cartes fantômes. Une main spectrale en désigne une. Les autres s'évanouissent.
**Philosophie:** "Préparé. Toujours."

---

### 2.15 Paire S+L — Scissors (G) + Lizard (D)

**Nom: Le Partage** (Tier 2)
**Effet:** Divisez les dégâts que vous ALLEZ subir ce round entre vous et l'adversaire. Si vous deviez perdre 2 pts, vous perdez 1 pt et l'adversaire perd 1 pt (même s'il gagne).
**Animation:** Un lien d'énergie vert vif (couleur Lizard) se tend entre les deux avatars. Quand le dégât arrive, il est "partagé" — la moitié suit le lien vers l'adversaire.
**Philosophie:** "Ta douleur est la mienne. Littéralement."

---

### 2.16 Paire L+S — Lizard (G) + Scissors (D)

**Nom: La Mue** (Tier 1)
**Effet:** Défaussez votre main ENTIÈRE. Piochez le même nombre de cartes +1. Tout effet négatif lié à votre main précédente est annulé (poisons, malédictions sur des cartes spécifiques).
**Animation:** L'avatar du joueur se fige, puis sa peau se fissure — une nouvelle version émerge de l'ancienne enveloppe. Les cartes de la main tombent au sol et de nouvelles apparaissent dans un éclat de lumière.
**Philosophie:** "L'ancien moi n'existe plus."

---

### 2.17 Paire S+Sp — Scissors (G) + Spock (D)

**Nom: L'Excision** (Tier 3)
**Effet:** Retirez UNE règle du jeu pour le reste du match. Vous choisissez parmi :
- "Les cartes ne peuvent plus être jouées" (pur RPSLS pour les deux joueurs)
- "Le Round Draw n'existe plus" (tout draw est rejoué)
- "Le bonus de mana par round est désactivé" (mana fixe pour les deux)
**Animation:** Un scalpel d'énergie pure apparaît entre les doigts de Spock. Le joueur sélectionne la règle à retirer. Le scalpel tranche un parchemin cosmique flottant. La règle disparaît de l'interface.
**Philosophie:** "Les règles sont des suggestions."

---

### 2.18 Paire Sp+S — Spock (G) + Scissors (D)

**Nom: La Dissonance** (Tier 2)
**Effet:** L'adversaire ne peut PAS jouer le symbole qui serait le contre parfait de votre move le plus évident. L'interface le lui montre : le symbole est grisé, inactif. Il doit choisir autre chose. C'est vous qui décidez quel symbole est banni (en choisissant votre move de Spock).
**Animation:** Une onde de choc mentale (cercles concentriques violets) émane de la main Spock. Le symbole banni dans le sélecteur adverse devient rouge et se verrouille avec un cadenas.
**Philosophie:** "Tu ne peux pas faire ce à quoi je pense."

---

### 2.19 Paire L+Sp — Lizard (G) + Spock (D)

**Nom: L'Hybridation** (Tier 3)
**Effet:** Fusionnez DEUX lanes en UNE SEULE pour ce round. Les deux lanes deviennent une seule "méga-lane". Les deux symboles que vous y avez placés sont COMBINÉS (si l'un gagne, la méga-lane compte comme gagnée. Si les deux gagnent, +3 pts bonus). L'adversaire doit placer 2 symboles sur 1 seule lane fusionnée aussi.
**Animation:** Les deux lanes cibles glissent l'une vers l'autre et fusionnent en une seule lane plus large, brillante. Un effet de distorsion spatiale. La méga-lane pulse.
**Philosophie:** "Deux réalités, une seule vérité."

---

### 2.20 Paire Sp+L — Spock (G) + Lizard (D)

**Nom: L'Inversion** (Tier 3)
**Effet:** Inversez le SCORE actuel. Si vous meniez 2-1, vous êtes maintenant mené 1-2. Si vous étiez mené 0-2, vous menez 2-0. Le score est INVERSE pour le reste du round en cours (les points gagnés CE round s'ajoutent au score inversé). Usage unique par match. Ne peut être utilisé que si le score n'est pas à égalité.
**Animation:** Un miroir apparaît entre les deux avatars. Le score affiché à l'écran "tombe" dans le miroir et en ressort inversé. Les chiffres s'échangent dans un effet de reflet. Son de verre qui se brise.
**Philosophie:** "Rien n'est jamais joué."

---

## 3. Résumé — Les 20 Alignements + 5 Renforcements

### Table complète des Alignements (Gauche → Droite)

| # | Main G | Main D | Nom | Tier | Catégorie d'effet |
|---|--------|--------|-----|------|-------------------|
| 1 | Rock | Paper | L'Étreinte | 1 | Contrainte adverse |
| 2 | Paper | Rock | Le Voile Tendre | 1 | Information cachée |
| 3 | Rock | Scissors | La Brèche | 2 | Destruction de ressource |
| 4 | Scissors | Rock | La Faille | 1 | Amplification de score |
| 5 | Rock | Lizard | L'Ancrage | 2 | Défense |
| 6 | Lizard | Rock | La Régénération | 1 | Soin |
| 7 | Rock | Spock | L'Implosion | 3 | Reset du plateau |
| 8 | Spock | Rock | La Gravité Zéro | 2 | Distorsion spatiale |
| 9 | Paper | Scissors | La Signature | 1 | Marquage/prédiction |
| 10 | Scissors | Paper | Le Dédoublement | 2 | Duplication de move |
| 11 | Paper | Lizard | L'Amnésie | 2 | Brouillard d'information |
| 12 | Lizard | Paper | La Dévoration | 3 | Vol de ressource |
| 13 | Paper | Spock | Le Calcul | 3 | Statistiques en temps réel |
| 14 | Spock | Paper | L'Archive | 1 | Scry de pioche |
| 15 | Scissors | Lizard | Le Partage | 2 | Partage de dégâts |
| 16 | Lizard | Scissors | La Mue | 1 | Reset de main |
| 17 | Scissors | Spock | L'Excision | 3 | Suppression de règle |
| 18 | Spock | Scissors | La Dissonance | 2 | Interdiction ciblée |
| 19 | Lizard | Spock | L'Hybridation | 3 | Fusion de lanes |
| 20 | Spock | Lizard | L'Inversion | 3 | Inversion de score |

### Table des Renforcements (mains identiques)

| Main G | Main D | Nom | Effet |
|--------|--------|-----|-------|
| Rock | Rock | **Double Poigne** | Dégât de contusion même en cas de défaite |
| Paper | Paper | **Double Voile** | Dégâts subis ÷ 2 |
| Scissors | Scissors | **Double Tranchant** | Perdant subit +1 dégât |
| Lizard | Lizard | **Double Mue** | Reset complet de la main |
| Spock | Spock | **Double Foyer** | Engagement public + bonus |

### Répartition par Tier

| Tier | Coût mana | Alignements | Renforcements |
|------|----------|-------------|---------------|
| **1** | 2 mana (1+1) | 8 | 5 |
| **2** | 3 mana | 7 | 0 |
| **3** | 4 mana | 5 | 0 |
| **Total** | — | **20 Alignements** | **5 Renforcements** |

---

## 4. Comment les obtenir — Le Chemin de l'Éveil

Chaque Alignement est débloqué en accomplissant une action qui "enseigne" la philosophie derrière l'Alignement. Ce n'est pas "gagner X matchs" — c'est thématique.

| Alignement | Condition de déverrouillage |
|-----------|---------------------------|
| **L'Étreinte** | Gagner un round où l'adversaire a répété le même symbole que le round précédent |
| **Le Voile Tendre** | Gagner un round avec Paper sans que l'adversaire ait utilisé Augur/Oracle (il n'a pas vu venir) |
| **La Brèche** | Gagner un round où vous détruisez une carte adverse (Trou-Noir, Apocalypse...) |
| **La Faille** | Gagner un round avec un score de +2 (écraser l'adversaire sur ce round) |
| **L'Ancrage** | Survivre à un round où vous subissez 3+ dégâts potentiels sans perdre le match |
| **La Régénération** | Gagner un match après avoir été mené 0-2 |
| **L'Implosion** | Gagner un round où au moins 3 effets/modificateurs différents étaient actifs |
| **La Gravité Zéro** | Gagner un round en Constellation où vous avez swap les lanes via Vortex |
| **La Signature** | Gagner un round après avoir prédit correctement le move adverse (Augur/Oracle) |
| **Le Dédoublement** | Gagner un round où un seul de vos symboles gagne sur 2 lanes simultanément |
| **L'Amnésie** | Gagner un match contre une IA en mode Hard (elle "oublie" moins facilement) |
| **La Dévoration** | Utiliser Heist avec succès (voler une carte adverse) |
| **Le Calcul** | Gagner un round après avoir utilisé Oracle (vision parfaite = 0 excuse de perdre) |
| **L'Archive** | Piocher 10 cartes ou plus dans un seul match |
| **Le Partage** | Gagner un match où vous et l'adversaire avez le même score à la fin (match serré) |
| **La Mue** | Gagner un round avec une main vide (avoir joué toutes ses cartes) |
| **L'Excision** | Gagner un match où vous n'avez utilisé AUCUNE carte (pur RPSLS) |
| **La Dissonance** | Gagner un round où l'adversaire a essayé de jouer le contre parfait mais n'a pas pu (à cause de l'effet Dissonance lui-même — déblocage récursif après le 1er usage) |
| **L'Hybridation** | Gagner un match en Constellation avec un score final de 3-0 (toutes les lanes gagnées au round final) |
| **L'Inversion** | Gagner un match où vous étiez mené au score à un moment donné |

---

## 5. UI — L'Affichage des Mains

### 5.1 Position à l'écran

En bas de l'écran de match, sous le sélecteur de symboles normal, apparaissent DEUX EMPLACEMENTS :

- **Main Gauche** (côté gauche) : un sélecteur de symbole marqué "G"
- **Main Droite** (côté droit) : un sélecteur de symbole marqué "D"

Chaque emplacement montre les 5 symboles. Le joueur en choisit un pour chaque main. Coût en mana indiqué sous chaque main.

### 5.2 Retour visuel

- **Posture valide (Alignement connu ET débloqué)** : Les deux emplacements s'illuminent en OR. Le nom de l'Alignement apparaît entre les deux mains.
- **Posture valide (Alignement connu mais NON débloqué)** : Les deux emplacements s'illuminent en GRIS. Un cadenas apparaît.
- **Posture inconnue (Renforcement)** : Les deux emplacements s'illuminent en BLEU. Le nom du Renforcement apparaît.
- **Posture invalide (pas assez de mana)** : Les emplacements clignotent en ROUGE.
- **Alignement actif** : Un halo lumineux entoure les deux mains. L'effet visuel de l'Alignement se déclenche.

### 5.3 Placeholder visuel

En attendant d'avoir de vraies animations de mains, on peut utiliser des **glyphes de mains stylisées** (évoquant des sceaux/mudras sans être Naruto — plutôt style "langue des signes cosmique" ou "positions de doigts géométriques").

---

## 6. Différence avec les Cartes

| Aspect | Cartes | Alignements |
|--------|--------|-------------|
| **Obtention** | Pioche depuis le deck | Construction par le joueur (choix main G + main D) |
| **Coût** | Mana (1 à 4) | Mana (2 à 4) |
| **Timing** | Une carte = un round | Un Alignement nécessite UN round (les deux mains simultanément) |
| **Rareté** | Common/Rare/Epic/Legendaire | Tier 1/2/3 |
| **Permanence** | Effet unique OU persistant selon la carte | Effet immédiat (distorsion temporaire des règles) |
| **Synergie** | Combine avec d'autres cartes | Combine avec les cartes ET avec les moves normaux |
| **Contre-jeu** | Annuler/détruire la carte | Impossible d'annuler un Alignement (il fait partie "du réel") |

---

## 7. Plan de développement

| Étape | Contenu | Effort |
|-------|---------|--------|
| **1. Types** | AlignementId, AlignementDef, registre des 25 Alignements + 5 Renforcements | 1 jour |
| **2. Logique Posture** | Détection G+D, validation mana, vérification déblocage | 2 jours |
| **3. Effets** | Implémentation des 25 distorsions de règles | 4 jours |
| **4. UI Mains** | Sélecteur main G + main D, retour visuel, halo d'alignement | 3 jours |
| **5. Animations** | Les 25 animations décrites (particules, ondes, lueurs — pas d'objets 3D) | 5 jours |
| **6. Codex** | Collection, conditions de déverrouillage thématiques | 2 jours |
| **7. i18n** | 25 noms + descriptions en 15 langues | 2 jours |
| **8. Équilibrage** | Tests, ajustement coûts mana, limites par match | 2 jours |

**Total: ~21 jours (3-4 sprints)**

---

## 8. 🖐️ SYSTÈME COMPLÉMENTAIRE : Les Gestes Signés — Techniques à une main

**Concept:** En PARALLÈLE des Alignements (qui combinent deux mains), le joueur dispose de **Gestes Signés** — des configurations précises des doigts d'une SEULE main qui canalisent l'énergie en une technique dévastatrice. Chaque Geste est un "sort" visuel spectaculaire : explosion de particules, distorsion de l'écran, apparition de formes d'énergie pure.

Un Geste n'est PAS un symbole RPSLS. C'est une technique apprise, débloquée une fois, utilisable **une fois par match** (comme un ultime). La main forme une configuration spécifique des doigts (index croisé sur le majeur, paume ouverte, poing fermé avec deux doigts levés...), et l'énergie s'en libère.

**Ressource : La Concentration**

Les Gestes ne coûtent pas de mana. Ils coûtent de la **Concentration** (⧖). Un joueur commence chaque match avec 3 points de Concentration. Il en gagne +1 à chaque round gagné, +2 à chaque boss vaincu (dans La Spirale). Maximum : 10 points.

| Tier | Coût en Concentration | Nombre de Gestes | Puissance |
|------|----------------------|-----------------|-----------|
| **1** | 3 ⧖ | 6 | Canalisation simple — effet local |
| **2** | 5 ⧖ | 7 | Canalisation avancée — effet de zone |
| **3** | 7 ⧖ | 5 | Canalisation ultime — effet global |

---

### 8.1 TIER 1 — Canalisation Simple (3 ⧖)

---

**Geste #1 — L'Impulsion**

- **Main:** Paume ouverte, doigts écartés, poussée vers l'avant.
- **Visuel:** Une onde de choc concentrique (cercle blanc) part de la main et traverse l'écran en 0.3s. Tout ce qui est sur son passage vibre — les cartes, les lanes, l'avatar adverse.
- **Son:** "WHOOM" grave suivi d'un silence de 0.5s.
- **Effet:** Repousse TOUS les effets de cartes en cours d'UN cran dans le temps. Les effets "ce round" deviennent "le prochain round". Les effets "prochain round" deviennent "dans 2 rounds". (Délai tactique.)
- **Unlock:** Gagner un round où vous n'avez joué AUCUNE carte (pur symbole).

---

**Geste #2 — Le Verrou**

- **Main:** Index et majeur tendus, les autres doigts repliés. La main trace un cercle dans l'air.
- **Visuel:** Un cercle de runes lumineuses apparaît autour d'une lane ciblée. Les runes tournent lentement. La lane prend une teinte dorée.
- **Son:** Cliquetis de serrure + bourdonnement grave.
- **Effet:** Verrouille UNE lane. Sur cette lane, le résultat est GELÉ — il sera répété à l'identique au round suivant. (Si vous gagnez la lane ce round, vous la gagnerez automatiquement au prochain round. Si vous la perdez...)
- **Unlock:** Gagner 3 rounds consécutifs sur la MÊME lane.

---

**Geste #3 — Le Repli**

- **Main:** Tous les doigts repliés en poing, sauf l'auriculaire qui pointe vers le bas.
- **Visuel:** L'avatar du joueur devient translucide pendant 1s. Une trainée de particules fantômes (bleutées) se disperse.
- **Son:** "FOUM" étouffé + écho.
- **Effet:** Esquive TOTALE. Tous les dégâts que vous deviez subir CE round sont annulés. MAIS vous ne pouvez PAS attaquer non plus (le round est un draw forcé pour vous). Usage défensif pur.
- **Unlock:** Survivre à un round où vous avez subi 3+ dégâts potentiels.

---

**Geste #4 — L'Étincelle**

- **Main:** Pouce et index qui claquent (geste de "snap").
- **Visuel:** Une explosion de particules dorées à l'endroit du claquement. Les particules se transforment en une pluie d'étincelles qui tombent sur les deux avatars.
- **Son:** "CLAC" sec + carillon de verre.
- **Effet:** RÉVÉLEZ une carte aléatoire de la main adverse. Si c'est une carte Épique ou Légendaire, elle est DÉFAUSSÉE (l'adversaire la perd). Si c'est Rare ou Commune, elle est juste révélée.
- **Unlock:** Utiliser Augur avec succès 3 fois dans un même match.

---

**Geste #5 — Le Souffle**

- **Main:** Paume vers le ciel, doigts légèrement recourbés, comme si on tenait une flamme invisible.
- **Visuel:** Une spirale de vent (blanc/transparent) s'élève de la paume et tourbillonne autour de l'avatar. Les cartes dans votre main "flottent" et se réorganisent aléatoirement.
- **Son:** Sifflement de vent + bruissement de cartes.
- **Effet:** MÉLANGEZ votre main. Toutes vos cartes sont renvoyées dans la pioche, la pioche est mélangée, et vous piochez le MÊME nombre de cartes. Vous pouvez obtenir les mêmes... ou complètement différentes.
- **Unlock:** Piocher 15 cartes ou plus dans un seul match.

---

**Geste #6 — La Marque**

- **Main:** Index pointé vers l'adversaire, les autres doigts repliés.
- **Visuel:** Un trait de lumière (couleur du symbole que vous jouez ce round) relie votre index à l'avatar adverse. Le trait "brûle" un symbole dans l'air.
- **Son:** "TSSS" de brûlure + vibration.
- **Effet:** MARQUEZ l'adversaire. Au prochain round, s'il joue le MÊME symbole que celui que VOUS avez joué ce round-ci, il subit 2 pts de dégâts directs. (Vous lui imposez un dilemme : éviter ce symbole = jouer autre chose, ce que vous pouvez anticiper.)
- **Unlock:** Gagner un round où l'adversaire a joué le même symbole que vous.

---

### 8.2 TIER 2 — Canalisation Avancée (5 ⧖)

---

**Geste #7 — Le Murmure**

- **Main:** Main en cornet autour de la bouche (comme pour chuchoter), doigts légèrement écartés.
- **Visuel:** Des volutes de fumée violette s'échappent des doigts et se dirigent vers l'avatar adverse. Elles s'enroulent autour de sa tête. Ses yeux deviennent violets.
- **Son:** Chuchotement incompréhensible en couches superposées + rire étouffé.
- **Effet:** L'adversaire ENTEND une fausse information. L'interface lui ment sur UNE statistique : soit le score affiché est inversé (il voit 2-1 au lieu de 1-2), soit le mana disponible est faux (il voit 3 alors qu'il a 1). L'effet dure 2 rounds. Le joueur doit détecter le mensonge par lui-même.
- **Unlock:** Gagner un match en ligne contre un adversaire humain.

---

**Geste #8 — Le Portail**

- **Main:** Les deux mains (exception : c'est un geste à deux mains mais une seule technique) forment un cercle (pouces + index en anneau).
- **Visuel:** Un portail s'ouvre au centre de l'écran — un vortex d'énergie arc-en-ciel. Une carte TOMBE du portail.
- **Son:** "BWOUM" de portail + tintement de carte.
- **Effet:** INVOQUEZ une carte aléatoire de votre COLLECTION (pas de votre deck de match — de votre collection de cartes débloquées). La carte est ajoutée à votre main. Elle peut être n'importe quelle rareté.
- **Unlock:** Débloquer 15 cartes différentes dans votre collection.

---

**Geste #9 — Le Lien**

- **Main:** Index et majeur de chaque main qui se touchent (pont entre les deux mains).
- **Visuel:** Un fil d'énergie dorée se tend entre les deux avatars. Les PV sont "liés" — une jauge partagée apparaît temporairement.
- **Son:** Tension de corde + vibration harmonique.
- **Effet:** LIEZ vos PV à ceux de l'adversaire pour 2 rounds. Si l'un perd des PV, l'autre en perd AUTANT. Si l'un en gagne, l'autre aussi. (Forcé à l'égalité temporaire — utile quand vous êtes mené, risqué quand vous menez.)
- **Unlock:** Gagner un match après avoir été mené 0-2 (comeback).

---

**Geste #10 — Le Gel**

- **Main:** Paume ouverte vers le bas, doigts écartés, mouvement de "poussée vers le sol".
- **Visuel:** Une vague de givre bleu-blanc parcourt l'écran de haut en bas. Les animations en cours ralentissent à 0.1× speed pendant 2s, puis reprennent. Les cartes sur le plateau sont couvertes de cristaux de glace.
- **Son:** Craquement de glace + vent glacial + ralenti audio.
- **Effet:** Le TEMPS est ralenti pour les DEUX joueurs. Le timer du round est doublé (passe de 13.5s à 27s). Les deux joueurs ont plus de temps pour réfléchir. MAIS toutes les cartes jouées ce round coûtent +1 mana (le froid rigidifie).
- **Unlock:** Perdre un round par timeout (ne pas avoir choisi à temps).

---

**Geste #11 — L'Échange**

- **Main:** Paumes face à face, doigts croisés, puis les mains s'écartent brusquement.
- **Visuel:** Les deux avatars clignotent et échangent brièvement leurs couleurs (votre avatar prend la couleur de l'adversaire et vice-versa). Un flash blanc.
- **Son:** "POP" + bourdonnement électrique.
- **Effet:** ÉCHANGEZ votre main avec celle de l'adversaire. POUR UN ROUND. Il voit vos cartes, vous voyez les siennes. Il peut jouer VOS cartes, vous pouvez jouer les SIENNES. Après le round, les mains reviennent à leurs propriétaires. (Les cartes "one-shot" Épiques/Légendaires utilisées par l'adversaire depuis votre main sont DÉTRUITES pour vous — elles ne reviennent pas.)
- **Unlock:** Utiliser Heist avec succès (voler une carte) puis gagner le round.

---

**Geste #12 — Le Sceau**

- **Main:** Pouce, index et majeur joints en triangle, les deux autres doigts levés.
- **Visuel:** Un triangle de lumière dorée apparaît au-dessus de l'avatar. Des caractères anciens (inspirés cunéiformes/sanskrit) s'inscrivent à l'intérieur. Le triangle descend et "tamponne" le plateau.
- **Son:** Chœur monocorde + vibration de gong.
- **Effet:** SCELLEZ le plateau. Pendant 3 rounds, aucune nouvelle carte ne peut être jouée. Les cartes déjà actives continuent leurs effets. Les deux joueurs jouent en PUR RPSLS pendant 3 rounds. (Excellent contre les decks lourds en cartes.)
- **Unlock:** Gagner un match sans utiliser AUCUNE carte (pur RPSLS).

---

**Geste #13 — La Brûlure**

- **Main:** Paume frottée rapidement contre le torse (geste de friction), puis rejetée vers l'avant.
- **Visuel:** Une traînée de feu (orange/rouge) part de la main et s'écrase sur l'avatar adverse. L'adversaire est enveloppé de flammes pendant 2s.
- **Son:** Embrasement + crépitement.
- **Effet:** Infligez 2 pts de dégâts DIRECTS à l'adversaire (ignorant le résultat du round). MAIS vous perdez 1 pt de vie vous-même (la friction brûle aussi le lanceur).
- **Unlock:** Gagner un match en jouant sur le thème Emberforge ou Volcanic.

---

### 8.3 TIER 3 — Canalisation Ultime (7 ⧖)

---

**Geste #14 — L'Astre Noir**

- **Main:** Poing fermé levé au-dessus de la tête, puis ouvert brusquement.
- **Visuel:** L'écran entier s'assombrit pendant 1.5s. Au centre, un point de lumière noire (oui, lumière noire — un trou dans la réalité) pulse. Les lanes, les cartes, les avatars sont aspirés vers ce point. Puis tout EXPLOSE en une nova de particules blanches.
- **Son:** Silence absolu (1s) → "CRACK" → explosion assourdie → retour progressif du son ambiant.
- **Effet:** DÉTRUISEZ TOUT. Toutes les cartes en cours, tous les modificateurs, tous les effets persistants. Le plateau redevient NU. Le round en cours est ANNULÉ (pas de gagnant, pas de perdant, comme s'il n'avait jamais eu lieu). On passe directement au round suivant.
- **Unlock:** Gagner un match sur le thème Eclipse.

---

**Geste #15 — Le Linceul**

- **Main:** Bras croisés sur la poitrine, paumes vers l'intérieur, puis écartés lentement.
- **Visuel:** Un voile de brume grise tombe du haut de l'écran. Tout devient monochrome (noir et blanc). Les couleurs disparaissent. L'avatar adverse est enveloppé d'un linceul spectral.
- **Son:** Tissu qui se déchire + respiration lente + écho funèbre.
- **Effet:** L'adversaire ne peut PAS gagner ce round. QUEL QUE SOIT le résultat de la résolution, il ne marque aucun point. S'il gagne, c'est un draw. S'il perd, il perd normalement. S'il draw, c'est un draw (aucun effet). C'est un round "sans issue" pour lui.
- **Unlock:** Gagner un match sur le thème Phantom.

---

**Geste #16 — L'Horloge**

- **Main:** Index qui trace un cercle dans le sens horaire, puis anti-horaire.
- **Visuel:** Une horloge cosmique géante apparaît en surimpression sur l'écran. Les aiguilles tournent À L'ENVERS. Les chiffres sont en notation binaire/quantique. L'horloge se fissure.
- **Son:** Tic-tac inversé + cliquetis d'horlogerie + vibration de cloche.
- **Effet:** REMBOBINEZ le match de 2 rounds. TOUT ce qui s'est passé pendant les 2 derniers rounds est ANNULÉ. Les PV reviennent à leur état d'il y a 2 rounds. Les cartes utilisées retournent dans les mains. Les boss vaincus... restent vaincus (on ne peut pas rembobiner la mort d'un boss). Usage unique par match.
- **Unlock:** Gagner un match sur le thème Tempus.

---

**Geste #17 — La Tempête**

- **Main:** Mouvement de "va-et-vient" rapide des deux mains, doigts écartés.
- **Visuel:** L'écran est balayé par une tempête d'énergie — éclairs blanc-bleu, nuages noirs, pluie de particules. Les cartes sur le plateau sont "emportées" par le vent.
- **Son:** Tonnerre + vent hurlant + crépitement électrique.
- **Effet:** Pendant 2 rounds, le plateau est en TEMPÊTE. Les lanes sont MÉLANGÉES aléatoirement à chaque round (le joueur place ses symboles, puis les lanes sont redistribuées). Personne ne contrôle où son symbole atterrit. Chaos total.
- **Unlock:** Gagner un match sur le thème Storm.

---

**Geste #18 — La Résolution**

- **Main:** Les deux mains jointes comme pour une prière, puis écartées lentement. Un point lumineux apparaît entre les paumes et grandit.
- **Visuel:** Le point lumineux devient une sphère d'énergie blanche pure qui englobe tout l'écran. Tout devient blanc. Puis la blancheur se dissipe et révèle le résultat final.
- **Son:** Bourdonnement qui monte en intensité → silence → carillon cristallin unique.
- **Effet:** Finissez le match IMMÉDIATEMENT. Pas de round supplémentaire. Le score actuel est le score FINAL, quel que soit le nombre de rounds restants. Si vous menez, vous gagnez. Si l'adversaire mène, il gagne. Si égalité, c'est un draw. C'est un "all-in" : soit vous avez déjà gagné et vous verrouillez, soit vous êtes désespéré et vous tentez le tout pour le tout avant de perdre plus.
- **Unlock:** Débloquer TOUS les autres Gestes (les 17 précédents). C'est le dernier.

---

### 8.4 Résumé des Gestes

| # | Tier | Nom | Coût ⧖ | Type d'effet | Thème de déblocage |
|---|------|-----|--------|-------------|-------------------|
| 1 | 1 | L'Impulsion | 3 | Délai d'effets | Pureté (0 carte) |
| 2 | 1 | Le Verrou | 3 | Lane gelée | Constance (3× même lane) |
| 3 | 1 | Le Repli | 3 | Esquive totale | Survie (3+ dégâts subis) |
| 4 | 1 | L'Étincelle | 3 | Révélation + destruction | Précision (Augur×3) |
| 5 | 1 | Le Souffle | 3 | Mélange de main | Abondance (15 pioches) |
| 6 | 1 | La Marque | 3 | Dilemme imposé | Miroir (même symbole) |
| 7 | 2 | Le Murmure | 5 | Mensonge d'interface | Online (victoire humaine) |
| 8 | 2 | Le Portail | 5 | Invocation de collection | Collection (15 cartes) |
| 9 | 2 | Le Lien | 5 | PV liés | Comeback (0-2→victoire) |
| 10 | 2 | Le Gel | 5 | Ralentissement | Temps écoulé (timeout) |
| 11 | 2 | L'Échange | 5 | Échange de mains | Vol (Heist réussi) |
| 12 | 2 | Le Sceau | 5 | Verrouillage plateau | Pureté (0 carte tout le match) |
| 13 | 2 | La Brûlure | 5 | Dégâts directs réciproques | Thème Emberforge/Volcanic |
| 14 | 3 | L'Astre Noir | 7 | Annihilation totale | Thème Eclipse |
| 15 | 3 | Le Linceul | 7 | Round sans issue | Thème Phantom |
| 16 | 3 | L'Horloge | 7 | Rembobinage temporel | Thème Tempus |
| 17 | 3 | La Tempête | 7 | Chaos de lanes | Thème Storm |
| 18 | 3 | La Résolution | 7 | Fin immédiate du match | Complétionniste (17/17) |

---

### 8.5 UI des Gestes

En bas de l'écran de match, à côté des sélecteurs de mains pour les Alignements, un **troisième emplacement** apparaît :

- Une **icône de paume stylisée** (différente des sélecteurs de symboles) marquée "⧖"
- En tapant dessus, une **roue de Gestes** s'ouvre (radial menu) montrant les Gestes débloqués
- Les Gestes non débloqués sont grisés avec un cadenas
- Les Gestes disponibles (assez de Concentration) brillent
- Les Gestes indisponibles (pas assez de ⧖) sont en rouge
- La jauge de Concentration est affichée en haut de l'écran : 3 petits cristaux qui s'illuminent

---

### 8.6 Différence Alignements vs Gestes

| Aspect | Alignements | Gestes Signés |
|--------|-------------|---------------|
| **Mains** | Deux mains (G+D) | Une main (parfois deux pour l'esthétique) |
| **Logique** | Combinaison de symboles RPSLS → distorsion de règles | Techniques apprises → effets visuels + mécaniques |
| **Ressource** | Mana (2-4) | Concentration ⧖ (3-7), gagnée par la performance |
| **Fréquence** | 2 fois par match max | 1 fois par Geste, mais plusieurs Gestes différents possibles |
| **Déblocage** | Actions philosophiques | Actions thématiques + thèmes cosmétiques |
| **Visuel** | Particules + lueurs | Explosions, écran qui change, distorsions temporelles |
| **Inspiration** | Mudras/sceaux | Techniques de combat anime, sans référence directe |

---

### 8.7 Plan de développement — Gestes

| Étape | Contenu | Effort |
|-------|---------|--------|
| **1. Types + Registre** | GesteId, GesteDef, registre des 18 Gestes | 1 jour |
| **2. Système Concentration** | Jauge ⧖, gain par round/boss, UI jauge | 2 jours |
| **3. Effets** | Implémentation des 18 effets | 5 jours |
| **4. UI Radial Menu** | Roue de Gestes, feedback visuel | 2 jours |
| **5. Animations** | 18 animations spectaculaires (écran, particules) | 7 jours |
| **6. i18n** | 18 noms + descriptions × 15 langues | 2 jours |
| **7. Équilibrage** | Coûts Concentration, limites par match | 2 jours |
| **8. Tests visuels** | Vérifier que ça tourne à 60fps sur mobile | 2 jours |

**Total Gestes: ~23 jours (3-4 sprints supplémentaires)**

**Grand total Alignements + Gestes: ~44 jours (7-8 sprints)**

---

## 8.8 🎨 Prompts de génération d'illustrations — Les 18 Gestes Signés

**Style de référence :** Les 5 PNGs existants dans `app/public/Moves/` (rock.png, paper.png, scissors.png, lizard.png, spock.png). Ce sont :
- Silhouette blanche légèrement brillante sur fond **transparent**
- Légère lueur violette / glow subtil autour de la main (violet sombre `#8b5cf6` à `#a78bfa`)
- Style épuré, minimaliste, "icône de jeu mobile" — pas de détails anatomiques, lignes nettes
- Format carré, résolution **1024×1024 px minimale**, PNG avec canal alpha
- La main occupe environ 70-80% du cadre, centrée
- Fond : **TRANSPARENT** (pas de cercle, pas de fond coloré — le fond est géré par le code CSS)

**Convention de fichier :** `app/public/Gestes/[nom-du-geste].png` (ex: `app/public/Gestes/impulsion.png`)

---

### Prompt générique (template) — À COPIER-COLLER pour chaque Geste

```
A single human hand forming a specific gesture, white glowing silhouette with a subtle violet (#8b5cf6) ethereal glow around the edges, on a completely transparent background. The hand is centered and occupies 75% of the frame. Clean minimalist mobile-game icon style. No background circle, no background color — pure transparency with alpha channel. The white silhouette has a soft inner glow (not flat white — slightly luminous from within). The hand skin is visible as a light grey-to-white gradient with the violet glow only on the outer contour. Slight particle dust (3-5 tiny violet sparkles) near the fingertips. Square composition 1024x1024 pixels. PNG with transparency.

[DESCRIPTION SPÉCIFIQUE DU GESTE À INSÉRER ICI]

IMPORTANT: Match the exact style of these reference images — same lighting, same glow intensity, same hand proportions, same transparent background treatment.
```

---

### Prompts spécifiques par Geste

---

**Geste #1 — L'Impulsion** (Tier 1)

```
GESTE SPÉCIFIQUE: Open palm facing forward, all five fingers spread wide apart. The hand is pushing forward — as if creating a shockwave. The palm is facing the viewer directly. Fingers: thumb pointing upward, index/middle/ring/pinky all spread in a star-like pattern. The wrist is straight, forearm slightly visible at the bottom edge. The gesture reads as "STOP" or "PUSH" — forceful, dynamic. The violet glow is most intense at the palm center and fades toward the fingertips.
```

**🎬 TRAJECTOIRE D'ANIMATION — L'Impulsion**
```
Animation en 3 phases (durée totale: 1.8s):

PHASE 1 — CHARGE (0.0s → 0.6s):
- La main statique (position du PNG) vibre légèrement (shake 2px, fréquence 12Hz)
- Des particules violettes (8-12) commencent à s'accumuler en spirale devant la paume
- La paume s'illumine progressivement (opacity 0 → 0.8, couleur #8b5cf6)
- Easing: ease-out (ralentissement progressif de la vibration)

PHASE 2 — LIBÉRATION (0.6s → 1.2s):
- Un cercle d'onde de choc blanc (stroke-width 3px) naît au centre de la paume (scale 0)
- Le cercle grandit rapidement (scale 0 → 2.5) en 0.3s
- Le cercle traverse TOUT l'écran — il dépasse les bords du viewport
- Tout ce que le cercle touche vibre brièvement (cartes + lanes + avatar adverse)
- L'avatar adverse recule de 8px (translateX -8px) en 0.15s puis revient en position
- Easing du cercle: cubic-bezier(0.25, 0.1, 0.25, 1) — départ rapide, fin progressive
- Les particules accumulées sont projetées vers l'avant (velocity: 400px/s, angle: facing direction)

PHASE 3 — DISSIPATION (1.2s → 1.8s):
- Le cercle d'onde continue au-delà de l'écran
- Un deuxième cercle plus faible (opacity 0.3) suit à 0.15s de décalage
- Les particules projetées ralentissent et s'éteignent (opacity → 0, scale 1 → 0.3)
- La main revient à son état normal (glow résiduel qui s'estompe en 0.4s)

IMPLÉMENTATION TECHNIQUE:
- Utiliser un <canvas> overlay ou des div avec border-radius + box-shadow pour l'onde
- requestAnimationFrame pour la progression fluide
- Transform: scale() sur un élément circulaire positionné au centre de la main
- La vibration utilise transform: translateX(${Math.sin(time*12)*2}px)
```

---

**Geste #2 — Le Verrou** (Tier 1)

```
GESTE SPÉCIFIQUE: Index and middle finger extended straight and pressed together like a blade, pointing upward at a 45-degree angle.
```

**🎬 TRAJECTOIRE D'ANIMATION — Le Verrou**
```
PHASE 1 (0→0.5s): Les deux doigts tendus brillent. Un anneau de runes (8 caractères) apparaît autour d'eux en rotation lente (360° en 2s). opacity 0→0.7.
PHASE 2 (0.5→1.0s): L'anneau se détache des doigts et glisse (translateX/Y) vers la lane ciblée. Scale 0.3→1.0. La lane s'illumine en doré (#fbbf24).
PHASE 3 (1.0→2.0s): L'anneau se verrouille sur la lane (rotation s'arrête net). Un cadenas apparaît (scale 0→1, bounce). La lane pulse 2 fois.
IMPLÉMENTATION: SVG path pour les runes + animateTransform rotate. CSS transition pour le déplacement de l'anneau vers la lane.
```

---

**Geste #3 — Le Repli** (Tier 1)

```
GESTE SPÉCIFIQUE: All fingers curled into a tight fist, EXCEPT the pinky.
```

**🎬 TRAJECTOIRE D'ANIMATION — Le Repli**
```
PHASE 1 (0→0.4s): L'auriculaire s'illumine. Des particules bleutées (opacity 0→0.6) descendent du doigt comme de la fumée vers le bas.
PHASE 2 (0.4→1.0s): L'avatar du joueur devient translucide (opacity 1→0.3, filter: blur 0→2px). L'avatar se "dissout" en particules qui tombent. L'adversaire voit un fantôme.
PHASE 3 (1.0→1.6s): L'avatar reste translucide. Les dégâts arrivent → ils traversent l'avatar (impact visuel sur rien). L'avatar redevient solide (opacity 0.3→1, blur 2→0px).
IMPLÉMENTATION: CSS filter blur + opacity transition sur le conteneur de l'avatar. Particules via absolutely-positioned divs avec animation CSS.
```

---

**Geste #4 — L'Étincelle** (Tier 1)

```
GESTE SPÉCIFIQUE: Thumb and middle finger pressed together in snapping position.
```

**🎬 TRAJECTOIRE D'ANIMATION — L'Étincelle**
```
PHASE 1 (0→0.2s): Le point de contact pouce/index brille intensément (scale 0→3, opacity 0→1, blanc pur).
PHASE 2 (0.2→0.5s): EXPLOSION de 20-30 particules dorées (couleur #fbbf24) en éclatement sphérique depuis le point de contact. Rayon d'éclatement: 150px. Easing: cubic-bezier(0, 0.9, 0.3, 1) — départ explosif, décélération rapide.
PHASE 3 (0.5→1.2s): Les particules retombent en pluie sur les deux avatars (gravity: 200px/s²). Une carte aléatoire de la main adverse est révélée avec un flash.
IMPLÉMENTATION: Particules = array de divs avec position absolute, animation via requestAnimationFrame avec vélocité initiale + gravité. Le snap final = transform rotate sur le pouce (10°→0°).
```

---

**Geste #5 — Le Souffle** (Tier 1)

```
GESTE SPÉCIFIQUE: Open palm facing UPWARD, fingers slightly curled inward.
```

**🎬 TRAJECTOIRE D'ANIMATION — Le Souffle**
```
PHASE 1 (0→0.6s): Une spirale de vent (8-12 particules en hélice) s'élève de la paume. Trajectoire: rotation autour d'un axe vertical central, montée progressive (translateY: 0→-200px). Les particules sont semi-transparentes (opacity 0.15).
PHASE 2 (0.6→1.0s): La spirale s'élargit (rayon 20px→80px) et englobe les cartes de la main du joueur. Les cartes "flottent" — translateY: 0→-15px, rotation: 0→±5deg aléatoire.
PHASE 3 (1.0→1.5s): Les cartes sont aspirées dans la spirale (scale 1→0) et réapparaissent depuis le deck (scale 0→1, nouvelle position). La spirale se dissipe (opacity→0).
IMPLÉMENTATION: Particules en spirale = x = centerX + cos(time*3 + i*0.8) * radius, y = centerY - time*200 + sin(time*2 + i)*20. Cartes = transform CSS avec transition.
```

---

**Geste #6 — La Marque** (Tier 1)

```
GESTE SPÉCIFIQUE: Index finger only, extended straight and pointing directly FORWARD.
```

**🎬 TRAJECTOIRE D'ANIMATION — La Marque**
```
PHASE 1 (0→0.3s): Un trait de lumière (épaisseur 3px) part du bout de l'index et se propage vers l'avatar adverse. Vitesse: 800px/s. Couleur = couleur du symbole joué ce round (varie selon MOVE_PALETTE).
PHASE 2 (0.3→0.6s): Le trait atteint l'avatar adverse. Impact: flash de la couleur du symbole sur l'avatar (opacity 0→0.6→0). Un cercle de la même couleur pulse autour de l'avatar (scale 0→1.2, opacity 0.6→0).
PHASE 3 (0.6→1.5s): Le trait persiste (opacity 0.6, épaisseur 3px→1px). Il "brûle" un symbole fantôme qui apparaît au-dessus de l'avatar adverse — le symbole marqué. Le trait s'éteint progressivement.
IMPLÉMENTATION: Le trait = une div étroite (width 3px, height: distance entre index et avatar) avec rotation calculée via Math.atan2(). Transition CSS pour scale et opacity.
```

---

**Geste #7 — Le Murmure** (Tier 2)

```
GESTE SPÉCIFIQUE: Hand cupped around mouth area, thumb+index forming a funnel.
```

**🎬 TRAJECTOIRE D'ANIMATION — Le Murmure**
```
PHASE 1 (0→0.5s): 3-4 volutes de fumée violette (#8b5cf6) s'échappent de l'ouverture de la main. Les volutes suivent une trajectoire sinusoïdale (x += sin(time*2)*3, y -= 1.5px/frame) vers l'avatar adverse.
PHASE 2 (0.5→1.2s): Les volutes atteignent la tête de l'avatar adverse. Elles s'enroulent autour (rotation 0→720deg, scale 0.5→1.2). Les yeux de l'avatar deviennent violets (couleur #8b5cf6).
PHASE 3 (1.2→2.0s): L'interface adverse est modifiée — le score ou le mana affiché change (animation de "glitch": chiffres qui défilent rapidement puis se stabilisent sur la fausse valeur). Les volutes persistent autour de la tête (opacity 0.3).
IMPLÉMENTATION: Volutes = chemins SVG avec stroke-dasharray animé. Glitch UI = transition CSS avec filter: blur(1px) + transform: translateX(±3px) aléatoire, puis retour au faux chiffre.
```

---

**Geste #14 — L'Astre Noir** (Tier 3)

```
GESTE SPÉCIFIQUE: A closed fist held high above (top of frame), then bursting open. The hand is in the moment of OPENING — fingers unfurling from a tight fist into an open palm, caught mid-motion. The fist-to-open transition should be readable. Above the opening hand, a small dark sphere (pure black with a violet event horizon glow) pulses — about the size of a marble relative to the hand. The sphere is NOT a solid object but a visual effect: a dark void surrounded by a ring of violet light, with tiny particles being pulled into it. The hand is viewed from below, looking up. The gesture reads as "release", "unleash", "collapse".
```

**🎬 TRAJECTOIRE D'ANIMATION — L'Astre Noir**
```
PHASE 1 — NAISSANCE (0.0s → 0.8s):
- La main s'ouvre du poing vers la paume (animation frame-by-frame: 3 keyframes)
- Au-dessus, une sphère noire apparaît (scale 0→1, ease-out)
- La sphère est entourée d'un anneau violet (#6d28d9, stroke-width 4px, stroke-dasharray: 20 5)
- L'anneau tourne (rotate 0→360deg en 0.8s)
- L'écran commence à s'assombrir (overlay noir, opacity 0→0.4)
- Des particules (15-20) commencent à orbiter autour de la sphère en spirale convergente

PHASE 2 — IMPLOSION (0.8s → 1.8s):
- La sphère PULSE (scale 0.8→1.4→0.5, 3 cycles en 1.0s, easing: ease-in-out)
- L'overlay noir s'intensifie (opacity 0.4→0.85)
- TOUT l'écran est aspiré vers la sphère:
  * Les lanes: scale 1→0.7, translateY vers le centre
  * Les cartes: rotation aléatoire + scale 1→0.3 + translate vers le centre
  * Les avatars: scale 1→0.8, filter: blur 0→3px
- Les particules orbitant accélèrent et sont absorbées par la sphère
- Le son ambiant diminue progressivement (volume 1→0)

PHASE 3 — COLLAPSE (1.8s → 2.0s):
- La sphère atteint sa taille minimale (scale 0.1)
- SILENCE ABSOLU (0.3s)
- Puis EXPLOSION:
  * La sphère devient blanche (transition #000→#fff en 0.05s)
  * Flash blanc couvrant tout l'écran (overlay blanc opacity 1, durée 0.1s)
  * Les lanes, cartes, avatars réapparaissent INSTANTANÉMENT à leur position d'origine
  * L'overlay s'estompe (opacity 1→0 en 0.4s)
  * Le son revient progressivement

PHASE 4 — RÉSIDU (2.0s → 2.5s):
- Des particules résiduelles (blanches, 10-15) flottent et s'éteignent
- Le plateau est complètement nettoyé (tous les modificateurs visuels retirés)
- La main revient en position de repos

IMPLÉMENTATION TECHNIQUE:
- Canvas overlay pour l'obscurcissement: fillRect avec rgba(0,0,0,opacity)
- Sphère: div avec border-radius: 50%, background: radial-gradient(transparent 60%, #000 100%)
- Anneau: border avec border-color: #6d28d9, border-radius: 50%, animation CSS rotate
- Particules: système de particules requestAnimationFrame avec position + vélocité
- Aspiration: CSS transform sur les conteneurs des lanes/cartes, transition avec cubic-bezier(0.6, 0, 1, 1)
- Flash: div plein écran z-index max, opacity transition 0.05s, puis fade-out
```

---

**Geste #15 — Le Linceul** (Tier 3)

```
GESTE SPÉCIFIQUE: Arms crossed over the chest area — but we only see the forearms and hands. The hands are flat, palms facing inward toward the body (toward each other). The pose is the moment of UNFOLDING — the arms are slowly separating, moving outward. The hands are caught mid-motion, about 30% opened from the crossed position. A veil of grey-to-violet translucent energy cascades down from the crossed arms like falling fabric — soft, flowing, spectral. The gesture reads as "shroud", "veil", "envelop". Darker violet glow than other gestures.
```

**🎬 TRAJECTOIRE D'ANIMATION — Le Linceul**
```
PHASE 1 — DÉPLOIEMENT (0.0s → 1.0s):
- Les bras s'écartent lentement (rotation: -15deg→15deg pour chaque bras, duration 0.8s, ease-out)
- Un voile de brume grise (#9ca3af) descend du haut de l'écran comme un rideau
- Le voile fait 100vw × 30vh, opacity 0→0.7, translateY: -30vh→0
- Le voile a un effet "tissu": 3 vagues sinusoïdales horizontales qui ondulent (amplitude 8px, fréquence 0.03)
- En dessous du voile, les couleurs de l'écran sont désaturées (filter: saturate(1)→saturate(0) en 0.8s)

PHASE 2 — ENVELOPPEMENT (1.0s → 1.8s):
- Le voile continue sa descente et ENVELOPPE spécifiquement l'avatar adverse
- L'avatar adverse est entouré d'un linceul spectral: un contour blanc-gris (stroke-width 4px, opacity 0→0.8)
- Le linceul se "resserre" autour de l'avatar (scale 1.2→0.95, ease-in-out)
- Les yeux de l'avatar s'éteignent (passent du blanc au gris #6b7280)
- Un texte runique "NON" ou un glyphe d'interdiction apparaît au-dessus (scale 0→1, bounce, couleur #ef4444)

PHASE 3 — PERSISTANCE (1.8s → 2.5s):
- L'avatar adverse reste enveloppé du linceul (opacity 0.6)
- L'écran reste monochrome (saturate(0))
- Le round se résout — si l'adversaire "gagne", son score NE MONTE PAS (animation de chiffre qui tente de monter mais est bloqué)
- Le linceul se dissipe lentement (opacity 0.6→0 en 0.5s) à la fin du round

IMPLÉMENTATION TECHNIQUE:
- Voile: canvas avec forme trapézoïdale remplie de gradient (rgba(156,163,175,0)→rgba(156,163,175,0.7))
- Ondulation: déformer le path du voile avec sin(time*2 + x*0.03)*8
- Désaturation: CSS filter: saturate() transition sur le conteneur principal
- Linceul autour de l'avatar: box-shadow multiple (0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(156,163,175,0.2))
- Contour: outline ou border animé avec stroke-dasharray
```

---

**Geste #16 — L'Horloge** (Tier 3)

```
GESTE SPÉCIFIQUE: A single index finger tracing a circle in the air — but the finger is at the TOP of the circle, having just completed 90% of the motion. The trail of the traced circle is visible as a thin violet light-line that forms 3/4 of a complete circle. The finger is slightly blurred from motion. Around the traced circle, faint clock-face markings (simple tick marks, Roman numerals I through XII in subtle violet) appear as if etched into the air. The hand is viewed from the front. The gesture reads as "rewind", "time", "cycle".
```

**🎬 TRAJECTOIRE D'ANIMATION — L'Horloge**
```
PHASE 1 — APPARITION (0.0s → 0.6s):
- Le doigt trace un cercle complet (360° en 0.5s, débutant à 0° (3h), finissant à 360°)
- La trajectoire est visible en temps réel: un trait violet suit le doigt (stroke-dasharray animé via offset)
- Une fois le cercle complété, 12 marques (traits de 8px) apparaissent aux positions horaires (scale 0→1, stagger: 0.03s chacun)
- Les chiffres romains I→XII apparaissent (opacity 0→1, stagger: 0.05s, couleur #8b5cf6)
- Le cercle complet pulse 2 fois (scale 1→1.05→1, duration 0.3s)

PHASE 2 — REMBOBINAGE (0.6s → 2.0s):
- Deux aiguilles d'horloge apparaissent au centre du cercle:
  * Grande aiguille (longueur 60px): commence à 12h, tourne en sens ANTI-HORAIRE
  * Petite aiguille (longueur 35px): commence à 12h, tourne aussi en anti-horaire
- Les aiguilles accélèrent progressivement (vitesse: 1x→3x→6x en 1.2s)
- Les chiffres autour du cadran commencent à défiler en arrière (comme un compteur)
- Un effet de "rembobinage visuel" apparaît sur le plateau:
  * Les cartes jouées reviennent dans les mains (animation reverse: scale 1→0, translate vers la main)
  * Les PV remontent (animation du chiffre qui décrémente)
  * Le score s'inverse si nécessaire
- L'écran entier a un léger effet VHS: scanlines + distorsion horizontale aléatoire (glitch)

PHASE 3 — STABILISATION (2.0s → 2.5s):
- Les aiguilles ralentissent et s'arrêtent
- L'horloge se fige (les aiguilles s'arrêtent net)
- Une fissure apparaît sur le cadran (ligne brisée de stroke-width 2px, opacity 0→0.8)
- Le cadran s'efface (opacity 1→0, scale 1→0.8, duration 0.5s)
- L'écran revient à la normale (les effets VHS disparaissent)

IMPLÉMENTATION TECHNIQUE:
- Cercle: SVG circle + stroke-dasharray/dashoffset pour l'animation de tracé
- Aiguilles: SVG line avec transform-origin au centre, animateTransform rotate (inversé)
- Chiffres: SVG text positionnés par trigonométrie (x = cx + cos(angle)*radius, y = cy + sin(angle)*radius)
- Effet VHS: CSS pseudo-element avec repeating-linear-gradient (scanlines) + filter: hue-rotate aléatoire
- Rembobinage visuel: animation CSS en reverse sur les conteneurs de cartes/PV
```

---

**Geste #17 — La Tempête** (Tier 3)

```
GESTE SPÉCIFIQUE: Both hands in rapid side-to-side motion — the hands are blurred, creating a "motion smear" effect horizontally. Fingers are spread wide, palms facing forward, hands overlapping slightly. The rapid movement is conveyed through motion blur and 8-12 horizontal streak lines of violet-white energy that trail behind the hands. Small lightning-bolt shaped particles crackle between the fingers. The overall composition is energetic, chaotic, storm-like. The gesture reads as "storm", "chaos", "unleash".
```

**🎬 TRAJECTOIRE D'ANIMATION — La Tempête**
```
PHASE 1 — DÉCHAÎNEMENT (0.0s → 0.4s):
- Les mains vibrent violemment (shake horizontal: amplitude 12px, fréquence 18Hz)
- Des éclairs (6-8) jaillissent des doigts: lignes brisées blanches #ffffff avec glow #4af0ff
- Les éclairs suivent une trajectoire en zigzag aléatoire (4-6 segments, angles aléatoires entre -45° et +45°)
- Chaque éclair dure 0.15s puis disparaît, remplacé par un nouveau
- L'écran entier est secoué (transform: translateX(±5px) + translateY(±3px) aléatoire à 15Hz)

PHASE 2 — TEMPÊTE (0.4s → 1.8s):
- Un overlay de nuages noirs (#0a0a1a) apparaît en haut de l'écran (opacity 0→0.6)
- Les lanes commencent à TOURNER comme dans un vortex:
  * Chaque lane a un point d'ancrage au centre de l'écran
  * Les lanes tournent (transform: rotate(0→90deg→180deg→270deg→360deg) en 1.4s, ease-in-out)
  * Les symboles sur les lanes glissent (ne restent pas sur leur lane d'origine — inertia visuelle)
- Une pluie de particules violettes tombe en diagonale (angle: 25°, vitesse: 300px/s, densité: 40 particules)
- Les cartes sur le plateau sont "emportées" — translateX aléatoire + rotation aléatoire, retour à l'envoyeur

PHASE 3 — ACCALMIE (1.8s → 2.3s):
- Le vortex ralentit et s'arrête (rotate → 0°, ease-out)
- Les lanes se stabilisent dans leurs NOUVELLES positions (mélangées)
- Les nuages se dissipent (opacity 0.6→0)
- Les éclairs cessent
- La pluie s'arrête
- L'écran cesse de trembler
- Les nouvelles positions des lanes sont révélées (glow bref pour confirmer le mélange)
- Un son de tonnerre lointain (écho, volume décroissant)

IMPLÉMENTATION TECHNIQUE:
- Éclairs: génération procédurale de paths SVG avec segments aléatoires, stroke="#4af0ff", filter: drop-shadow(0 0 8px #4af0ff)
- Vortex des lanes: chaque lane est dans un conteneur div avec transform-origin: center center, animation CSS rotate
- Nuages: canvas avec particules de "nuage" (cercles gris foncé semi-transparents qui dérivent)
- Pluie: système de particules (50 particules max) avec position, vitesse, et angle constants, recyclées (quand y > screenHeight → y = -10)
- Screen shake: setInterval rapide (16ms) appliquant transform aléatoire, nettoyé après la phase 3
- Son: Web Audio API ou simple <audio> avec effet de fondu
```

---

**Geste #18 — La Résolution** (Tier 3)

```
GESTE SPÉCIFIQUE: Two hands pressed together palm-to-palm in a prayer/meditation gesture at the center of the frame, then slowly separating. The hands are at the moment of separation — about 20% apart, a gap forming between the palms. Inside the growing gap between the palms, an intense sphere of pure white-violet light is forming, growing brighter as the hands separate. The light illuminates the hands from within. The pose is serene, final, conclusive. All five fingers on each hand are straight and pressed together. The gesture reads as "completion", "resolution", "final".
```

**🎬 TRAJECTOIRE D'ANIMATION — La Résolution**
```
PHASE 1 — SÉPARATION (0.0s → 1.2s):
- Les mains s'écartent lentement (gap: 0→80px, duration 1.2s, easing: cubic-bezier(0.34, 1.56, 0.64, 1) — légèrement élastique)
- Dans l'espace entre les paumes, une sphère de lumière blanche pure apparaît (scale 0→1, duration 0.8s)
- La sphère est d'abord violette (#8b5cf6) puis transitionne vers le blanc pur (#ffffff) en 0.6s
- La lumière de la sphère illumine les mains par en dessous (effet: les mains passent de "silhouette blanche sur fond noir" à "mains éclairées avec ombres portées vers le haut")
- Des particules blanches (20-30) s'échappent de la sphère en spirale lente (vitesse angulaire: 0.5 rad/s)

PHASE 2 — EXPANSION (1.2s → 2.0s):
- La sphère GRANDIT (scale 1→3, duration 0.6s, ease-in)
- La sphère englobe progressivement tout l'écran:
  * 1.2s: englobe les mains
  * 1.4s: englobe les avatars
  * 1.6s: englobe les lanes
  * 1.8s: englobe tout l'écran → écran blanc pur
- Pendant l'expansion, tout ce qui est touché par la sphère devient blanc (overlay opacity croissant)
- Le son ambiant est remplacé par un bourdonnement qui monte en intensité (fréquence: 80Hz→200Hz, volume: 0→0.8)
- À 1.8s: l'écran est COMPLÈTEMENT BLANC (overlay blanc opacity 1)

PHASE 3 — RÉSOLUTION (2.0s → 2.8s):
- À 2.0s: SILENCE ABSOLU (0.3s) — le bourdonnement s'arrête net
- La blancheur commence à se dissiper DU CENTRE VERS L'EXTÉRIEUR (effet iris: un cercle de transparence s'ouvre au centre, rayon 0→max)
- Ce qui est révélé: le RÉSULTAT FINAL
  * Si le joueur gagnait → l'avatar du joueur en pose de victoire, l'adversaire s'incline
  * Si le joueur perdait → l'inverse
  * Si égalité → les deux avatars face à face, mains jointes
- Le mot "FIN" ou l'écran de résultats apparaît (fade-in, duration 0.4s)

PHASE 4 — CARILLON (2.8s → 3.2s):
- Un carillon cristallin unique (3 notes: C5→E5→G5, durée 0.4s chaque)
- Des particules dorées résiduelles tombent comme des confettis (10-15 particules, chute lente)
- La sphère a complètement disparu
- L'écran de fin de match standard s'affiche

IMPLÉMENTATION TECHNIQUE:
- Sphère: div avec border-radius: 50%, background: radial-gradient(circle, #ffffff 0%, #8b5cf6 40%, transparent 70%)
- Expansion: transition CSS sur width/height (de 40px à 200vw) avec position fixed centrée
- Overlay blanc: div plein écran avec background: white, opacity transition
- Effet iris: utiliser clip-path: circle() avec animation du rayon (0%→100%) OU mask-image avec radial-gradient
- Son: Web Audio API — oscillator (sine wave) avec frequency ramp, gain ramp, puis stop brutal
- Particules: positions aléatoires dans un carré, chute avec gravity simulée (requestAnimationFrame)
- Éclairage des mains: l'ombre simulée est difficile en CSS pur — utiliser une image de main "éclairée" alternative OU l'effet de la sphère blanche qui englobe tout simplifie (tout devient blanc, pas besoin d'éclairage individuel)
```

**Geste #3 — Le Repli** (Tier 1)

```
GESTE SPÉCIFIQUE: All fingers curled into a tight fist, EXCEPT the pinky (auriculaire) which points straight DOWN toward the bottom of the frame. The fist is clenched, knuckles visible. The pinky is the only extended finger — pointing downward, slightly curved. The hand is viewed from the thumb side at a 45-degree angle. The gesture reads as defensive, retreating, "going underground". The violet glow is faint and trails downward from the pinky like smoke.
```

---

**Geste #4 — L'Étincelle** (Tier 1)

```
GESTE SPÉCIFIQUE: Thumb and middle finger pressed together in a snapping position — the classic "snap" gesture, just before release. The other three fingers (index, ring, pinky) are slightly curled but relaxed, not clenched. The hand is viewed from the side, thumb facing the viewer. The violet glow concentrates into a bright point exactly where the thumb and middle finger meet — like a spark about to ignite. 2-3 tiny violet sparkle particles are already escaping from the contact point.
```

---

**Geste #5 — Le Souffle** (Tier 1)

```
GESTE SPÉCIFIQUE: Open palm facing UPWARD toward the sky, fingers slightly curled inward as if gently holding an invisible floating flame or a delicate object. The hand is relaxed, not tense. The palm is cupped — thumb separated from the other four fingers, which are together but slightly bent. Viewed from above at a 45-degree angle, looking down into the cupped palm. A faint spiral of violet energy (subtle curve of particles, not a solid line) rises from the center of the palm in a gentle vortex pattern.
```

---

**Geste #6 — La Marque** (Tier 1)

```
GESTE SPÉCIFIQUE: Index finger only, extended straight and pointing directly FORWARD at the viewer (like "you"). All other fingers (thumb, middle, ring, pinky) are curled into a loose fist. The index finger is perfectly straight, aligned with the forearm. The hand is viewed head-on — the pointing finger aims directly at the camera. This is an accusatory, targeting gesture. A thin line of violet energy extends from the tip of the index finger toward the viewer, fading after 2-3 finger-lengths.
```

---

**Geste #7 — Le Murmure** (Tier 2)

```
GESTE SPÉCIFIQUE: Hand cupped around the mouth area — but we only see the HAND, not the face. The hand forms a "whispering funnel" shape: thumb and index finger create a tube-like opening, other three fingers curled loosely. The hand is positioned as if held near a mouth, viewed from the side. Wisps of violet smoke curl out from the funnel opening formed by the thumb and index finger — 3-4 distinct curling smoke trails. The gesture reads as secretive, conspiratorial.
```

---

**Geste #8 — Le Portail** (Tier 2)

```
GESTE SPÉCIFIQUE: Both hands forming a circle together — thumbs touching thumbs, index fingers touching index fingers, creating a ring/portal shape. The other six fingers are spread outward like rays from the circle. The circle frames empty transparent space in the center. The hands are viewed from straight ahead. Inside the circle formed by the hands, a subtle vortex of violet energy spirals inward (3 concentric circles of decreasing opacity). The gesture reads as "opening a gateway".
```

---

**Geste #9 — Le Lien** (Tier 2)

```
GESTE SPÉCIFIQUE: Two index fingers from two hands touching tip-to-tip, forming a bridge. The other fingers are curled loosely. The hands are mirror images of each other, approaching from opposite sides of the frame. The point where the two index fingers meet has a bright violet glow — the energy flows from one fingertip to the other. A thin thread of violet light connects the two fingertips. The gesture reads as "connection", "bond", "bridge".
```

---

**Geste #10 — Le Gel** (Tier 2)

```
GESTE SPÉCIFIQUE: Open palm facing DOWNWARD, all five fingers spread wide, pushing toward the ground. The hand is above, pressing down — like pushing a lid closed or freezing something in place. The fingers are tense, rigid, like they're resisting pressure from below. Viewed from slightly above and to the side. Crystal-like violet particles form on the fingertips and fall downward like snow or frost — 5-8 tiny crystalline sparkles descending below the hand. The gesture reads as "freeze", "stop", "hold".
```

---

**Geste #11 — L'Échange** (Tier 2)

```
GESTE SPÉCIFIQUE: Two hands, palms facing each other with fingers intertwined — but NOT clasped. The fingers are crossed at the second knuckle: left index crosses over right index, left middle crosses over right middle, etc. The hands are about to pull apart — the pose is the moment just BEFORE separation. Viewed from straight ahead. A flash of violet light erupts from where the fingers cross — a burst of energy at the intersection point. The gesture reads as "exchange", "swap", "transfer".
```

---

**Geste #12 — Le Sceau** (Tier 2)

```
GESTE SPÉCIFIQUE: Thumb, index, and middle finger joined at the tips forming a perfect triangle. The ring finger and pinky are extended straight upward together. The triangle formed by the three fingers is the focal point — it should be geometrically precise. Inside the triangle, a faint violet sigil (simple geometric rune: circle with a dot in the center inside the triangle) glows softly. The hand is viewed from the front, slightly below eye level. The gesture reads as "seal", "stamp", "authority".
```

---

**Geste #13 — La Brûlure** (Tier 2)

```
GESTE SPÉCIFIQUE: Open palm dragging across the chest area (but we only see the hand, no body). The hand is at the bottom-left of the frame, palm facing the center, fingers slightly curled from friction. The pose is right AFTER the friction movement — the hand is pulling away from the "chest" (off-frame). Trails of violet-orange ember particles follow the hand's movement path — 6-10 particles in a streak showing the direction of motion. The palm has a brighter glow from the generated heat. The gesture reads as "friction", "ignite", "burn".
```

---

**Geste #14 — L'Astre Noir** (Tier 3)

```
GESTE SPÉCIFIQUE: A closed fist held high above (top of frame), then bursting open. The hand is in the moment of OPENING — fingers unfurling from a tight fist into an open palm, caught mid-motion. The fist-to-open transition should be readable. Above the opening hand, a small dark sphere (pure black with a violet event horizon glow) pulses — about the size of a marble relative to the hand. The sphere is NOT a solid object but a visual effect: a dark void surrounded by a ring of violet light, with tiny particles being pulled into it. The hand is viewed from below, looking up. The gesture reads as "release", "unleash", "collapse".
```

---

**Geste #15 — Le Linceul** (Tier 3)

```
GESTE SPÉCIFIQUE: Arms crossed over the chest area — but we only see the forearms and hands. The hands are flat, palms facing inward toward the body (toward each other). The pose is the moment of UNFOLDING — the arms are slowly separating, moving outward. The hands are caught mid-motion, about 30% opened from the crossed position. A veil of grey-to-violet translucent energy cascades down from the crossed arms like falling fabric — soft, flowing, spectral. The gesture reads as "shroud", "veil", "envelop". Darker violet glow than other gestures.
```

---

**Geste #16 — L'Horloge** (Tier 3)

```
GESTE SPÉCIFIQUE: A single index finger tracing a circle in the air — but the finger is at the TOP of the circle, having just completed 90% of the motion. The trail of the traced circle is visible as a thin violet light-line that forms 3/4 of a complete circle. The finger is slightly blurred from motion. Around the traced circle, faint clock-face markings (simple tick marks, Roman numerals I through XII in subtle violet) appear as if etched into the air. The hand is viewed from the front. The gesture reads as "rewind", "time", "cycle".
```

---

**Geste #17 — La Tempête** (Tier 3)

```
GESTE SPÉCIFIQUE: Both hands in rapid side-to-side motion — the hands are blurred, creating a "motion smear" effect horizontally. Fingers are spread wide, palms facing forward, hands overlapping slightly. The rapid movement is conveyed through motion blur and 8-12 horizontal streak lines of violet-white energy that trail behind the hands. Small lightning-bolt shaped particles crackle between the fingers. The overall composition is energetic, chaotic, storm-like. The gesture reads as "storm", "chaos", "unleash".
```

---

**Geste #18 — La Résolution** (Tier 3)

```
GESTE SPÉCIFIQUE: Two hands pressed together palm-to-palm in a prayer/meditation gesture at the center of the frame, then slowly separating. The hands are at the moment of separation — about 20% apart, a gap forming between the palms. Inside the growing gap between the palms, an intense sphere of pure white-violet light is forming, growing brighter as the hands separate. The light illuminates the hands from within. The pose is serene, final, conclusive. All five fingers on each hand are straight and pressed together. The gesture reads as "completion", "resolution", "final".
```

---

### Format de sortie attendu

| Paramètre | Valeur |
|-----------|-------|
| **Résolution** | 1024 × 1024 px minimum (2048×2048 recommandé) |
| **Format** | PNG avec canal alpha (transparence) |
| **Fond** | Transparent (pas de cercle, pas de background) |
| **Style** | Silhouette blanche lumineuse + glow violet (`#8b5cf6`) sur les contours |
| **Dossier de destination** | `app/public/Gestes/` |
| **Nom de fichier** | `[nom-du-geste-en-minuscule].png` (ex: `impulsion.png`, `astre-noir.png`) |
| **Proportions** | Main = 70-80% du cadre, centrée |

### Palette de référence (depuis `icons.tsx`)

```
Rock     → #fbbf24 (amber)
Paper    → #bae6fd (sky)
Scissors → #fb923c (orange)
Lizard   → #34d399 (emerald)
Spock    → #8b5cf6 (violet)
```

Pour les Gestes, utiliser le violet Spock `#8b5cf6` comme base de glow, avec des variations selon le Tier :
- **Tier 1** : glow violet standard `#8b5cf6`
- **Tier 2** : glow violet plus intense `#7c3aed`
- **Tier 3** : glow violet profond + touches de blanc `#6d28d9`
