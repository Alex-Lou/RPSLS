# Système des Sceaux Doubles — Techniques à Deux Mains

**Date:** 2026-06-07
**Concept:** Quand les Gestes Signés (une main) ne suffisent plus, le joueur peut canaliser une énergie bien plus destructrice en combinant ses DEUX mains dans des Sceaux Doubles. Chaque main forme une configuration de doigts différente, et la combinaison des deux crée une technique d'une puissance inégalée. Un Sceau Double coûte cher, est rare, et change le cours d'un match.

**Différence avec les Gestes Signés (1 main):**
- Les Gestes Signés coûtent de la Concentration (⧖, 3-7 points)
- Les **Sceaux Doubles** coûtent du **Focus Absolu** (◎, 5-10 points)
- Les Gestes Signés sont des effets tactiques
- Les Sceaux Doubles sont des **Ultimes** — un seul par match, effet dévastateur

**Différence avec les Alignements (2 mains, déjà existants):**
- Les Alignements combinent 2 symboles RPSLS (Rock+Paper, etc.)
- Les Sceaux Doubles sont des **configurations de doigts indépendantes des symboles**
- Les Alignements distordent les règles
- Les Sceaux Doubles **brisent** les règles

---

## Ressource : Le Focus Absolu (◎)

| Source | Gain |
|--------|------|
| Début de match | 0 ◎ |
| Round gagné | +1 ◎ |
| Round perdu | +2 ◎ (la défaite concentre l'esprit) |
| Boss vaincu (Spirale) | +3 ◎ |
| Carte Légendaire jouée avec succès | +1 ◎ |
| **MAX** | **10 ◎** |

---

## Les 12 Sceaux Doubles

---

### TIER 1 — Sceaux de Base (5 ◎)

---

**Sceau #1 — Les Ailes du Faucon**

- **Mains:** Main gauche : index et auriculaire tendus, autres doigts repliés (aile gauche). Main droite : identique, en miroir. Les deux mains sont écartées, paumes vers l'extérieur.
- **Visuel:** D'immenses ailes d'énergie violette se déploient depuis le dos de l'avatar, couvrant tout l'écran. Les ailes battent UNE fois, créant une rafale.
- **Son:** Battement d'ailes amplifié + cri de rapace.
- **Effet:** Tous vos moves CE round gagnent +1 portée : chaque move que vous jouez affecte DEUX lanes au lieu d'une (la lane d'origine + une lane adjacente). Un move peut donc gagner sur 2 lanes simultanément. L'adversaire subit la pression des ailes : -1 mana ce round.
- **Unlock:** Gagner 5 matchs en mode Constellation.
- **Philosophie:** "L'horizon s'ouvre à celui qui déploie ses ailes."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.5s): Les deux mains s'écartent en diagonale. Des lignes d'énergie violette tracent la silhouette d'ailes de chaque côté (stroke-dasharray animé).
PHASE 2 (0.5→1.0s): Les ailes se remplissent d'énergie (opacity 0→0.8, dégradé violet→cyan). Un battement sec : scale 1→1.3→1 en 0.3s.
PHASE 3 (1.0→1.8s): Une onde de vent parcourt les lanes (particules horizontales). Les moves du joueur "glissent" vers les lanes adjacentes. Les ailes se dissipent en plumes de lumière.
IMPLÉMENTATION: Canvas pour les ailes (paths courbes de Bézier). Particules pour les plumes. Transform CSS sur les conteneurs de lanes.
```

---

**Sceau #2 — Le Poing du Titan**

- **Mains:** Les deux poings fermés, coudes pliés, ramenés contre la poitrine. Puis projetés vers l'avant simultanément, doigts qui s'ouvrent au dernier moment.
- **Visuel:** Un poing d'énergie colossal (taille : 50% de l'écran) apparaît au-dessus du plateau et s'écrase sur les lanes.
- **Son:** Impact sourd + onde de choc (basse fréquence).
- **Effet:** FRAPPEZ toutes les lanes simultanément. Sur CHAQUE lane, votre move inflige +1 dégât supplémentaire (même s'il perd, il inflige 1 dégât de contusion). Si vous gagnez déjà la lane, +2 dégâts au lieu de +1.
- **Unlock:** Gagner un round où vous avez gagné sur les 3 lanes simultanément (clean lane sweep).
- **Philosophie:** "La force brute n'est pas l'absence de stratégie. C'est la stratégie réduite à sa forme la plus pure."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.4s): Les mains jointes en poing au centre de l'écran, vibrant (shake 4px, 15Hz). Un poing fantôme semi-transparent grandit au-dessus (scale 0→2.5).
PHASE 2 (0.4→0.8s): Le poing s'abat (translateY: -200px→+300px en 0.3s). Impact: l'écran tremble (shake 8px, 20Hz). Les 3 lanes reçoivent une onde de choc (cercle d'impact qui part du centre de chaque lane).
PHASE 3 (0.8→1.5s): Le poing se dissipe en particules dorées. Les compteurs de score incrémentent avec un délai stagger (lane 1 à 0.8s, lane 2 à 0.9s, lane 3 à 1.0s).
IMPLÉMENTATION: Poing = div avec border-radius élevé + box-shadow massif. Impact = animation CSS scale+translateY. Screen shake = setInterval transform.
```

---

**Sceau #3 — La Chaîne des Âmes**

- **Mains:** Index et majeur de la main gauche pointés vers le bas. Index et majeur de la main droite pointés vers le haut. Les mains sont alignées verticalement.
- **Visuel:** Une chaîne d'énergie violette se forme entre les deux mains et se tend. La chaîne s'enroule autour de l'avatar adverse.
- **Son:** Cliquetis de chaînes + vibration métallique.
- **Effet:** LIEZ un de vos PV à un PV de l'adversaire. Chaque fois que VOUS perdez 1 PV ce round, l'adversaire en perd 1 AUSSI (même s'il gagne le round). La chaîne se brise après 2 rounds.
- **Unlock:** Gagner un match où vous avez subi au moins 3 dégâts.
- **Philosophie:** "Là où tu frappes, je frappe aussi. Nous sommes liés."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.6s): Un maillon de chaîne apparaît entre les deux mains (scale 0→1). D'autres maillons se forment (8-10 maillons, stagger 0.05s chacun). La chaîne ondule (sinusoïde, amplitude 8px).
PHASE 2 (0.6→1.2s): La chaîne se projette vers l'avatar adverse (animation de "lancer"). Elle s'enroule autour de lui (3 tours, rotation 0→1080deg). Les deux avatars sont reliés par un fil d'énergie.
PHASE 3 (1.2→3.0s): Tant que la chaîne persiste, chaque dégât subi par le joueur déclenche un "contrecoup" : flash sur l'avatar adverse + particules violettes. La chaîne se brise en 3 fragments à la fin.
IMPLÉMENTATION: Chaîne = série de cercles SVG reliés par des lignes, avec animation de rotation. Lien = ligne SVG entre les deux avatars avec stroke-dasharray animé.
```

---

**Sceau #4 — Le Miroir Brisé**

- **Mains:** Mains face à face, doigts écartés en éventail. Les deux mains forment un cadre rectangulaire (comme pour cadrer une photo). Puis les mains pivotent : la gauche monte, la droite descend.
- **Visuel:** Un miroir rectangulaire apparaît entre les mains, reflétant le plateau de jeu. Le miroir se fissure, puis explose.
- **Son:** Verre qui se fissure + éclats cristallins.
- **Effet:** INVERSEZ le résultat d'UNE lane (celle de votre choix). Si vous aviez gagné cette lane, vous la perdez. Si vous l'aviez perdue, vous la gagnez. Le reste du round se résout normalement pour les autres lanes. Le miroir a menti — la réalité se corrige.
- **Unlock:** Gagner un match où le score final est 3-2 (match serré).
- **Philosophie:** "Ce que tu vois n'est qu'un reflet. La vérité est ailleurs."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.5s): Un rectangle de lumière apparaît entre les mains. L'intérieur montre une copie miniature du plateau. Effet de "reflet" avec inversion horizontale.
PHASE 2 (0.5→0.9s): Le joueur sélectionne UNE lane à inverser (highlight). Le miroir zoome sur cette lane. Fissure: 3 lignes brisées apparaissent (stroke-dasharray 0→100).
PHASE 3 (0.9→1.5s): EXPLOSION du miroir (20-30 éclats de verre violets projetés). La lane ciblée "flashe" (blanc→normal). Le résultat est inversé (animation de swap: le symbole du gagnant et du perdant s'échangent).
IMPLÉMENTATION: Miroir = div avec backdrop-filter inversé simulé (ou copie CSS transform scaleX(-1)). Éclats = particules polygonales. Animation swap = transition CSS.
```

---

### TIER 2 — Sceaux Avancés (7 ◎)

---

**Sceau #5 — L'Horizon des Événements**

- **Mains:** Les deux mains forment un losange (pouces joints en bas, index joints en haut). Les autres doigts sont écartés en éventail.
- **Visuel:** Un trou noir miniature apparaît au centre du losange. Il grandit et aspire TOUT ce qui se trouve sur le plateau — cartes, effets, modificateurs. Puis il se résorbe, ne laissant que le vide.
- **Son:** Aspiration profonde + silence + "pop" de fermeture.
- **Effet:** NETTOYEZ tout le plateau. Toutes les cartes jouées ce round (des deux côtés) sont ANNULÉES. Tous les modificateurs sont supprimés. Les deux joueurs rejouent le round immédiatement — PUR RPSLS, sans cartes, sans modificateurs, sans effets. Un reset total pour CE round uniquement.
- **Unlock:** Gagner un match où au moins 4 effets/modificateurs différents étaient actifs simultanément.
- **Philosophie:** "Parfois, pour avancer, il faut tout effacer et recommencer."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.6s): Un point noir apparaît entre les pouces/index. Il grandit (scale 0→1.5) en aspirant la lumière autour. Un disque d'accrétion violet apparaît.
PHASE 2 (0.6→1.4s): Tout l'écran est aspiré vers le centre (effet de "tunnel"): les lanes, cartes, avatars sont déformés (scale 1→0.4, rotation). Les couleurs sont distordues (hue-rotate 0→180deg).
PHASE 3 (1.4→1.7s): Le trou noir implose (scale 1.5→0). Flash blanc. Le plateau réapparaît VIERGE. Les deux joueurs ont 5s pour rejouer.
IMPLÉMENTATION: Effet tunnel = CSS transform scale + filter hue-rotate sur le conteneur principal. Trou noir = div avec border-radius 50%, background radial-gradient, box-shadow intense.
```

---

**Sceau #6 — La Sentence du Juge**

- **Mains:** Main gauche : paume ouverte vers le haut (balance). Main droite : index pointé vers l'adversaire (jugement).
- **Visuel:** Une balance cosmique apparaît au-dessus du plateau. Dans le plateau gauche : l'avatar du joueur. Dans le droit : l'avatar adverse. La balance penche.
- **Son:** Gong de tribunal + silence solennel.
- **Effet:** JUGEZ le round en cours. La balance évalue les deux joueurs :
  - Celui qui a utilisé le PLUS de cartes ce round → -1 pt
  - Celui qui a le PLUS de PV → +1 pt
  - Celui qui a gagné le PLUS de rounds dans le match → +1 pt
  Le total détermine le gagnant du round, INDÉPENDAMMENT du RPSLS.
- **Unlock:** Gagner un match en utilisant strictement moins de cartes que l'adversaire.
- **Philosophie:** "Le combat n'est pas gagné par les poings, mais par la balance de la justice."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.8s): Une balance dorée apparaît (opacity 0→1, scale 0→1.2→1, bounce). Les deux plateaux sont vides.
PHASE 2 (0.8→1.6s): Les deux avatars "tombent" dans les plateaux (animation de chute: translateY -50→0). La balance oscille (rotation ±10deg, 3 cycles). Le plateau le plus lourd descend.
PHASE 3 (1.6→2.2s): Le verdict: un marteau de juge frappe (scale 0→1, impact: onde de choc). Le gagnant est annoncé (texte "COUPABLE" ou "INNOCENT" en lettres dorées). La balance se dissipe.
IMPLÉMENTATION: Balance = SVG paths + animation CSS rotate. Marteau = div avec transform rotate. Texte = animation scale+fade.
```

---

**Sceau #7 — Le Labyrinthe de l'Esprit**

- **Mains:** Les deux mains forment une spirale : index de la main gauche pointe vers la paume droite, index droit pointe vers la paume gauche. Les doigts tournent lentement.
- **Visuel:** Un labyrinthe de lumière apparaît sur le plateau. Les lanes deviennent les couloirs du labyrinthe. L'avatar adverse est "perdu" — il ne voit plus les lanes clairement.
- **Son:** Écho lointain + murmures + bruit de pas qui s'éloignent.
- **Effet:** Pendant 3 rounds, l'adversaire ne voit PAS sur quelle lane il place ses symboles. Les 3 lanes sont mélangées visuellement (leurs bordures disparaissent, elles deviennent une zone floue uniforme). Il place ses symboles "à l'aveugle" — ils sont distribués aléatoirement sur les 3 lanes. Le joueur, lui, voit tout normalement.
- **Unlock:** Gagner un match en ligne où l'adversaire a utilisé Oracle (vous l'avez battu malgré sa vision parfaite).
- **Philosophie:** "La confusion est une arme plus tranchante que l'épée."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.6s): Une spirale hypnotique apparaît au centre du plateau (rotation continue). Les bordures des lanes commencent à s'estomper (opacity 1→0.2).
PHASE 2 (0.6→1.0s): Les lanes se fondent en une zone grise uniforme (transition CSS background + border). L'adversaire voit "??? ??? ???". Les icônes des lanes sont remplacées par des glyphes de labyrinthe.
PHASE 3 (1.0→4.0s): Pendant 3 rounds, l'adversaire place des symboles sur un plateau flou. Quand il valide, les symboles "glissent" vers leurs positions réelles (réassignation aléatoire avec animation de glissement).
IMPLÉMENTATION: Overlay flou = div avec backdrop-filter: blur(15px) sur le conteneur des lanes côté adverse. Spirale = SVG path avec animation rotate. Réassignation = animation translate sur les symboles.
```

---

**Sceau #8 — La Forge Stellaire**

- **Mains:** Poing gauche fermé (enclume). Main droite ouverte qui frappe le poing gauche (marteau). Mouvement de forge.
- **Visuel:** Une forge cosmique apparaît — flammes violettes, étincelles. Une NOUVELLE carte est forgée sous les yeux du joueur, tirée de nulle part.
- **Son:** Martèlement sur enclume + feu qui rugit + tintement de métal refroidi.
- **Effet:** CRÉEZ une NOUVELLE carte qui n'existe pas dans votre deck. La carte est tirée aléatoirement parmi TOUTES les cartes du jeu (même celles que vous ne possédez pas). Elle est ajoutée à votre main immédiatement. Coût en mana offert (0 mana) pour ce round uniquement.
- **Unlock:** Débloquer 20 cartes différentes dans votre collection.
- **Philosophie:** "Ce qui n'existe pas encore peut être forgé."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.4s): Martèlement: la main droite frappe la main gauche (3 coups, translateY -30→0→-30→0). Des étincelles violettes jaillissent à chaque impact (8-12 particules par coup).
PHASE 2 (0.4→1.0s): Une carte en fusion apparaît entre les mains (masse informe de lumière, scale 0→1, couleurs arc-en-ciel). La carte refroidit (transition arc-en-ciel→couleur de rareté).
PHASE 3 (1.0→1.5s): La carte forgée est révélée (flip 3D: rotateY 0→180deg). Elle brille intensément puis atterrit dans la main du joueur. La forge s'éteint.
IMPLÉMENTATION: Martèlement = animation CSS translateY. Étincelles = système de particules. Carte = div avec backface-visibility + rotateY. Refroidissement = transition background.
```

---

### TIER 3 — Sceaux Suprêmes (10 ◎)

---

**Sceau #9 — Le Jugement Dernier**

- **Mains:** Bras croisés sur la poitrine, poings fermés. Puis les bras s'ouvrent lentement, paumes vers le ciel, doigts écartés. La tête se lève vers le ciel.
- **Visuel:** Le ciel s'ouvre au-dessus du plateau. Une lumière divine (blanc doré) descend en rayons. L'avatar du joueur lévite. Des ailes d'énergie pure se déploient.
- **Son:** Chœur céleste + cloches + grondement sourd.
- **Effet:** JUGEZ le match ENTIER. Si vous avez gagné plus de rounds que l'adversaire sur l'ensemble du match (même si le round en cours n'est pas fini), vous GAGNEZ immédiatement. Si l'adversaire a gagné plus de rounds, il gagne. Si égalité parfaite, le round en cours est DOUBLÉ en valeur (vaut 2 pts au lieu de 1). Ne peut être utilisé qu'à partir du 3e round.
- **Unlock:** Gagner un match après avoir sauvé 3 balles de match (l'adversaire était à 1 round de gagner).
- **Philosophie:** "Le combat appartient à celui qui l'a mérité. Pas à celui qui le termine."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→1.0s): L'avatar du joueur lévite (translateY 0→-40px, duration 0.8s, ease-out). Des rayons de lumière descendent du haut de l'écran (5-7 rayons, rotation aléatoire, opacity 0→0.6).
PHASE 2 (1.0→2.0s): Les ailes se déploient (2 wing paths, scale 0→1, rotation). Chœur qui monte. L'écran passe en "mode jugement": tout devient plus sombre sauf les avatars.
PHASE 3 (2.0→3.0s): Un rayon frappe l'avatar qui a gagné le plus de rounds. Si c'est le joueur: l'avatar adverse s'agenouille. Si c'est l'adversaire: l'avatar du joueur s'incline. Le résultat est affiché en lettres de feu.
IMPLÉMENTATION: Rayons = divs avec clip-path polygon + animation opacity. Ailes = SVG paths. Lévitation = CSS translateY. Filtre sombre = overlay avec mix-blend-mode.
```

---

**Sceau #10 — L'Éclipse Éternelle**

- **Mains:** Les deux mains forment un cercle au-dessus de la tête (pouces + index en anneau). Les mains descendent lentement en s'écartant. Le cercle se brise.
- **Visuel:** Une éclipse artificielle se produit au-dessus du plateau. La lune (cercle noir) passe devant le soleil (cercle doré). L'éclipse est totale. Tout devient obscurité. Puis la couronne solaire apparaît.
- **Son:** Silence absolu pendant l'éclipse (2s) → explosion de lumière → retour du son.
- **Effet:** TOUT s'arrête. Le round en cours est ANNULÉ. Le round suivant est ANNULÉ aussi. Pendant 2 rounds, RIEN ne se passe. Aucun dégât, aucun point, aucun effet. Le chronomètre est mis en pause. C'est un "temps mort" imposé aux deux joueurs. À la fin des 2 rounds, le jeu reprend normalement. Utile pour casser le momentum d'un adversaire en pleine série.
- **Unlock:** Gagner un match sur le thème Eclipse (cosmétique).
- **Philosophie:** "Même le soleil s'arrête. Pourquoi pas toi ?"

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→1.0s): Une lune noire (cercle #000) glisse depuis la droite (translateX 300→0) pour recouvrir un soleil doré (cercle #fbbf24). Animation fluide de transit.
PHASE 2 (1.0→2.0s): Éclipse totale: tout l'écran devient quasi-noir (overlay opacity 0→0.95). Seule la couronne solaire (anneau doré autour de la lune) est visible. Le timer du round se fige.
PHASE 3 (2.0→2.5s): La lune continue sa course (translateX 0→-300). La lumière revient progressivement. Le chronomètre reprend. Son: explosion de lumière.
IMPLÉMENTATION: Lune/Soleil = divs avec border-radius 50%, animation CSS translateX. Overlay noir avec transition opacity. Couronne = box-shadow ou border supplémentaire avec blur.
```

---

**Sceau #11 — La Renaissance**

- **Mains:** Mains croisées sur le cœur. Paumes à plat contre la poitrine. Puis les mains s'écartent lentement, révélant une lueur au centre du torse.
- **Visuel:** Le cœur de l'avatar s'illumine de l'intérieur. Une énergie vert-bleu régénératrice pulse. Les blessures se referment. Les cartes perdues reviennent.
- **Son:** Battement de cœur amplifié → accélération → explosion de vie.
- **Effet:** RÉGÉNÉREZ complètement. Tous vos PV sont restaurés au maximum. Toutes les cartes que vous avez perdues ce match (défaussées, détruites, volées) sont RÉCUPÉRÉES et remises dans votre pioche. Votre main est remplie à 3 cartes. Vous revenez à l'état du début du match... mais le score ne change pas.
- **Unlock:** Gagner un match après avoir perdu toutes vos cartes (main vide + défausse pleine).
- **Philosophie:** "Ce qui était mort renaît. Ce qui était perdu est retrouvé."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→0.8s): Un battement de cœur visible (pulse au centre du torse, scale 1→1.3→1, 3 cycles). La lumière vert-bleu (#34d399) s'intensifie.
PHASE 2 (0.8→1.6s): La lumière se répand dans tout le corps de l'avatar (vaisseaux lumineux visibles). Les PV remontent un par un (animation stagger: +1 PV toutes les 0.2s). Les cartes perdues "volent" depuis la défausse vers la pioche.
PHASE 3 (1.6→2.2s): Explosion de vie: un pulse vert-blanc couvre l'avatar. Des particules de vie (feuilles, pétales) tombent. L'avatar brille intensément puis revient à la normale.
IMPLÉMENTATION: Pulse cardiaque = animation CSS scale. Lumière = radial-gradient animé sur l'avatar. PV = animation de compteur. Cartes = animation translate de la défausse vers la pioche. Particules = pétales/feuilles en chute libre.
```

---

**Sceau #12 — L'Ultime Vérité**

- **Mains:** Les deux mains jointes en triangle inversé (pouces en bas, index en haut). Les mains sont élevées au-dessus de la tête. Puis elles s'abaissent lentement et s'ouvrent, paumes vers l'avant, doigts écartés au maximum.
- **Visuel:** Un œil cosmique s'ouvre au-dessus du joueur. L'œil voit TOUT — le passé, le présent, le futur du match. Il révèle la VÉRITÉ.
- **Son:** Ouverture d'un œil (son organique) → vibration quantique → silence.
- **Effet:** RÉVÉLEZ le move que l'adversaire va jouer pour les 3 PROCHAINS rounds. Pas de probabilité — la VÉRITÉ ABSOLUE. Les 3 prochains symboles de l'adversaire sont affichés au-dessus de sa tête. Il ne peut PAS les changer (il est "lu" par l'œil cosmique). ET vous gagnez +2 pts bonus sur CHACUN de ces rounds si vous jouez le contre parfait. L'adversaire SAIT que vous savez — il doit accepter son destin.
- **Unlock:** Accomplir toutes les conditions suivantes dans un seul match : utiliser Oracle (révélation), gagner un round après un draw, et gagner le match. (Quête ultime de connaissance).
- **Philosophie:** "Quand la vérité est révélée, il n'y a plus de jeu. Il n'y a que l'inévitable."

**🎬 TRAJECTOIRE D'ANIMATION:**
```
PHASE 1 (0→1.0s): Un œil cosmique s'ouvre VERTICALEMENT au-dessus du joueur (animation de paupière qui s'ouvre, scaleY 0→1). L'iris est violet avec une pupille en forme de losange.
PHASE 2 (1.0→2.0s): L'œil "scanne" l'avatar adverse (rayon de lumière violet qui balaie de gauche à droite). 3 symboles fantômes apparaissent au-dessus de l'adversaire — un pour chaque round à venir. Ils sont VERROUILLÉS (cadenas).
PHASE 3 (2.0→3.0s): Les symboles restent affichés. L'œil se referme lentement (scaleY 1→0). Une lueur résiduelle persiste sur l'adversaire. Chaque round, le symbole correspondant pulse quand c'est son tour d'être joué.
IMPLÉMENTATION: Œil = SVG/CSS avec forme ovale + clip-path pour l'ouverture. Rayon de scan = div avec gradient linéaire + animation translateX. Symboles = PNGs des moves avec position absolute, animation fade-in stagger.
```

---

## Résumé des 12 Sceaux Doubles

| # | Tier | Nom | Coût ◎ | Type d'effet | Catégorie |
|---|------|-----|--------|-------------|-----------|
| 1 | 1 | Les Ailes du Faucon | 5 | Mobilité des lanes | Déploiement |
| 2 | 1 | Le Poing du Titan | 5 | Dégâts de zone | Force brute |
| 3 | 1 | La Chaîne des Âmes | 5 | Lieur de PV | Contrôle |
| 4 | 1 | Le Miroir Brisé | 5 | Inversion de lane | Tromperie |
| 5 | 2 | L'Horizon des Événements | 7 | Reset du round | Pureté |
| 6 | 2 | La Sentence du Juge | 7 | Jugement impartial | Justice |
| 7 | 2 | Le Labyrinthe de l'Esprit | 7 | Aveuglement adverse | Confusion |
| 8 | 2 | La Forge Stellaire | 7 | Création de carte | Création |
| 9 | 3 | Le Jugement Dernier | 10 | Fin du match | Apothéose |
| 10 | 3 | L'Éclipse Éternelle | 10 | Arrêt du temps | Contrôle absolu |
| 11 | 3 | La Renaissance | 10 | Régénération totale | Vie |
| 12 | 3 | L'Ultime Vérité | 10 | Vision absolue | Connaissance |

---

## Prompts de génération d'illustrations — Les 12 Sceaux Doubles

**Style:** Identique aux Gestes Signés (silhouette blanche + glow violet sur fond transparent, 1024×1024 PNG). Ici, les images montrent **DEUX MAINS** formant des configurations de doigts spécifiques.

**Convention:** `app/public/Sceaux/[nom].png`

---

**Sceau #1 — Les Ailes du Faucon**
```
Two hands spread apart, palms facing outward. Left hand: index and pinky extended, other fingers curled. Right hand: mirror of left hand, same configuration. Both hands are at the edges of the frame, angled outward like wings about to beat. Violet energy traces the outline of wings behind each hand — translucent wing shapes made of light particles. The gesture reads as "ready to fly", "deployment". Violet glow color: #8b5cf6.
```

**Sceau #2 — Le Poing du Titan**
```
Two fists pulled back against the chest area (center-bottom of frame), knuckles facing forward. Both hands are clenched tight fists. The pose is the moment BEFORE punching — coiled energy, ready to strike. Violet energy crackles around the knuckles. Small impact particles (3-5) already escaping. The gesture reads as "about to strike", "giga impact". Violet glow intensifies at the knuckles.
```

**Sceau #3 — La Chaîne des Âmes**
```
Two hands aligned vertically. Left hand at the top of frame, index+middle fingers pointing DOWN. Right hand at the bottom of frame, index+middle fingers pointing UP. The fingertips almost touch at the center. Between them, a chain of violet energy links (8-10 translucent chain links) forms — glowing, ethereal. The gesture reads as "bond", "link", "connect".
```

**Sceau #4 — Le Miroir Brisé**
```
Two hands forming a rectangular frame — index fingers and thumbs create a rectangle shape (like framing a photo). The hands are positioned in front of the face area (but face not visible). Inside the rectangle, a shimmering mirror surface (violet gradient with crack lines) reflects a distorted image. One hand is slightly higher than the other, twisting the frame. The gesture reads as "mirror", "reflection", "illusion".
```

**Sceau #5 — L'Horizon des Événements**
```
Two hands forming a diamond/lozenge shape. Thumbs touching at the bottom, index fingers touching at the top. Other fingers spread outward like rays. Inside the diamond, a tiny black sphere (event horizon) pulses — pure black with a violet accretion ring. The sphere pulls tiny light particles toward it. The gesture reads as "singularity", "collapse", "black hole". Darker violet (#6d28d9) with pure black core.
```

**Sceau #6 — La Sentence du Juge**
```
Left hand open palm facing upward (holding a balance scale — the scale itself is faintly visible as violet light lines). Right hand with index finger pointing directly at the viewer (accusation/judgment). The left hand is lower, the right hand is higher. Both hands are steady, authoritative. The gesture reads as "judgment", "verdict", "court". Golden (#fbbf24) mixed with violet (#8b5cf6).
```

**Sceau #7 — Le Labyrinthe de l'Esprit**
```
Two hands with fingers forming a spiral — index finger of left hand points toward the right palm, index finger of right hand points toward the left palm. Fingers are slightly curled, tracing an invisible spiral in the air. A faint spiral pattern of violet light appears between the hands — a maze/labyrinth pattern. The gesture reads as "confusion", "labyrinth", "mind trap".
```

**Sceau #8 — La Forge Stellaire**
```
Left hand in a tight fist (anvil — held steady, knuckles up). Right hand open, palm facing down, striking the left fist from above (hammer motion — caught mid-strike, about 70% through the downward motion). Violet-orange sparks fly from the impact point between the two hands. A glowing hot card shape (rectangle of light) is forming between them. The gesture reads as "forge", "create", "smith".
```

**Sceau #9 — Le Jugement Dernier**
```
Arms crossed over the chest, both hands in fists. The pose is the moment of OPENING — arms just beginning to uncross, about 20% opened. Palms are starting to turn upward. The posture is solemn, divine, final. Above the head area (not shown), a suggestion of light rays descending. The gesture reads as "judgment", "final", "apotheosis". Golden-white glow with violet edges.
```

**Sceau #10 — L'Éclipse Éternelle**
```
Two hands forming a circle above the head — thumbs touching, index fingers touching, creating a perfect ring. The circle frames empty dark space (the eclipse — pure black inside the ring). Around the ring, a golden corona (thin bright line) glows. The hands are starting to separate (about 15% apart, the circle beginning to break). The gesture reads as "eclipse", "totality", "pause". Gold (#fbbf24) corona on violet (#8b5cf6) hands.
```

**Sceau #11 — La Renaissance**
```
Two hands crossed flat over the heart area (center of frame). Palms pressed against where the heart would be. The hands are beginning to open outward — fingers uncurling, palms rotating to face up. A bright green-blue (#34d399 mixed with #06b6d4) light glows from between the palms, illuminating them from underneath. The gesture reads as "rebirth", "healing", "renewal". Warm life energy.
```

**Sceau #12 — L'Ultime Vérité**
```
Two hands forming an inverted triangle above the head — thumbs touching at the bottom, index fingers at the top (reverse of Sceau #5). The hands are lowering, about to open outward. Inside/above the triangle, a stylized cosmic eye (vertical oval with a diamond-shaped pupil) made of pure violet-white light is opening. The eye "looks" at the viewer. The gesture reads as "revelation", "truth", "omniscience". White (#ffffff) eye with violet (#8b5cf6) iris.
```

---

## Format de sortie (identique aux Gestes)

| Paramètre | Valeur |
|-----------|-------|
| Résolution | 1024×1024 px (2048×2048 recommandé) |
| Format | PNG avec canal alpha |
| Fond | Transparent |
| Style | Silhouette blanche lumineuse + glow violet |
| Dossier | `app/public/Sceaux/` |
| Noms | `ailes-faucon.png`, `poing-titan.png`, `chaine-ames.png`, etc. |

---

## Plan de développement

| Étape | Contenu | Effort |
|-------|---------|--------|
| Types + Registre | SceauDoubleId, SceauDoubleDef, 12 entrées | 1 jour |
| Système Focus Absolu | Jauge ◎, gain, UI | 2 jours |
| Effets | 12 effets (complexes, certains modifient le moteur de round) | 6 jours |
| UI Sceaux | Sélecteur de Sceau Double (interface dédiée) | 3 jours |
| Animations | 12 animations spectaculaires | 7 jours |
| i18n | 12 noms + descriptions × 15 langues | 2 jours |
| Équilibrage | Tests, ajustement coûts ◎ | 2 jours |

**Total Sceaux Doubles: ~23 jours (3-4 sprints)**