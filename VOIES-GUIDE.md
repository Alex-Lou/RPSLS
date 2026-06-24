# Constellation Pro — Guide des Voies (joueur + dev)

> But du doc : comprendre le jeu **en une page**, comme un nouveau joueur. Référence stable
> (anti-« l'agent oublie tout en fin de session »). Données tirées du code réel le 2026-06-23.

## Le jeu en 5 lignes

- **3 lanes.** Tu poses des créatures (un symbole RPSLS chacune) sur 3 colonnes.
- **Le combat = RPSLS.** Quand 2 créatures se font face, celle qui *bat* l'autre (pierre>ciseaux…) gagne +1 ATK dans l'échange. Symbole vs vide = tape le héros.
- **Héros = 20 PV.** Tu gagnes en descendant le héros adverse à 0.
- **Mana : 1 au départ, +1/tour, plafond 8.** Pioche 1 carte/tour (lente → la **gestion** compte).
- **Ta Voie = ton identité** : un passif sur TON symbole + un deck signature + un finisher à 3⭐.

## Les 5 symboles — bonus / malus (avant toute carte)

| Symbole (Voie) | ATK/PV | Bonus (force) | Malus (faiblesse) | Bonus de Voie (si = ton affinité) |
|---|---|---|---|---|
| 🪨 **Pierre** (Montagne) | 1/3 | Provocation (force l'adversaire à la viser) ; **Strate** : +1 ATK/tour si elle survit (max +3) → boule de neige | **Lente** : 0 ATK le tour où elle arrive ; ATK de base faible | Provocation **2 charges** |
| 🌿 **Feuille** (Forêt) | 3/1 | Grosse ATK immédiate ; Étouffe | **1 PV** (fragile) ; **Fanaison** : −1 ATK/tour (plancher 1) → elle pourrit | Fanaison **÷2** (pourrit 2× plus lentement) |
| ✂️ **Ciseaux** (Tranchant) | 4/1 | **Plus grosse ATK** ; **Perforation** : passe 1 bouclier | **1 PV** ; **Émoussé** : −1 ATK après son 1er combat → tape fort **une fois** | **+1 PV** (survit à un échange) |
| 🦎 **Lézard** (Mirage) | 2/2 | **Esquive** : ignore 1 coup ; profil équilibré | **Lent** : 1 ATK le tour où il arrive | Esquive **2 charges** |
| 🖖 **Spock** (Cosmos) | 2/3 | **Logique/Détaché** : immunisé à TOUS les sorts (intouchable au removal) | Ne profite PAS non plus de TES buffs de sort ; ATK moyenne | **+1 ATK perm** (ATK 3) |

## Les 5 Voies = 5 façons de gagner (5 « horloges »)

Chaque Voie répond différemment à *« comment je gagne ? »*. C'est ça le cœur du design.

### 🪨 Montagne — *« je ne meurs pas, et je grossis »* (contrôle lent / boule de neige)
Tu mures, tu encaisses, tes Pierres prennent des Strates et finissent énormes.
**Deck :** Ancre, Jet de Caillou, Éboulement (AOE), Rempart, Contrefort, Strate Vive, Veine de Gaïa (soin), Gardien de Pierre (riposte + ancre).
**Finisher FORTERESSE :** tes Pierres → bouclier + ATK 3 permanent.

### 🌿 Forêt — *« je refuse de mourir, je t'épuise »* (sustain / grind)
Tu soignes, tu protèges, tes créatures renaissent ; l'adversaire s'épuise avant toi.
**Deck :** Sève (soin), Second Souffle (soin héros), Sangsue (vol de vie), Rempart, **Ramure** (bouclier board), Phénix (renaissance), **Photosynthèse** (soin + ATK perm), **Ronces** (riposte + bouclier).
**Finisher VERGER :** Fanaison OFF + soin héros +1/tour. (Tes Feuilles deviennent immortelles à l'ATK.)

### ✂️ Tranchant — *« je te tue avant de m'émousser »* (agro / course)
Burst d'ATK, perforation des boucliers, tu cours au visage avant de t'émousser.
**Deck :** Précision, Surge, Surcharge, **Coup de Taille** (recharge perforation), **Acuité** (ré-affûte), **Frénésie** (+ATK board), Riposte, Double Mot (×2 ATK).
**Finisher LAME :** tes Ciseaux percent TOUT (bouclier, provoc, anti-taunt).

### 🦎 Mirage — *« tu ne m'attrapes jamais »* (tempo / esquive)
Tu esquives, tu copies, tu recycles ta main, tu gardes l'initiative.
**Deck :** Mascarade (déguisement), Reflet-Écho (cycle), Échappée, Mirror (copie), **Mascarade Enchaînée** (+esquive), **Fuite Masquée** (+esquive), Prescience, Tide.
**Finisher MÉTAMORPHOSE :** Esquive infinie (recharge chaque tour).

### 🖖 Cosmos — *« le late-game est déjà perdu pour toi »* (contrôle / inévitabilité)
Tu rampes ton mana, tu lis et figes son plan, tu finis par des dégâts qui scalent.
**Deck :** **Dilatation Temporelle** (ramp), Sablier, Offre, Chronomancien, Augure (lecture main), **Loi de Causalité** (gèle une créature), Trou Noir (removal), **Convergence Cosmique** (dégâts = ton mana max, max 6).
**Finisher CALCUL :** tes sorts coûtent −1 mana.

## Ce qui fait que ce hybride RÉUSSIT ou FOIRE

**La thèse (réussite) :** un RPSLS+CCG marche si **DEUX couches de décision** coexistent à chaque tour :
1. **Placement RPSLS** (quelle lane / quel symbole / je bluffe son counter ?) — le mini-jeu de pierre-feuille-ciseaux *positionnel*.
2. **Cartes & tempo** (que je joue avec mon mana, quand je lâche mon finisher).
Et par-dessus, **ta Voie te donne un fil rouge** : tu exécutes TON plan (course / grind / contrôle / esquive / snowball), pas de la valeur générique.

**Les 4 vrais risques (foirage) :**
1. **Surcharge de lisibilité** (#1) — trop de mots-clés invisibles (Strate, Fanaison, Émoussé, Esquive, Logique, Provoc, bouclier, ancre, riposte…). Un nouveau se noie. → la solution est **visuelle** (badges/tooltips clairs), PAS plus de mécaniques.
2. **RPSLS devient décoratif** — si les parties se décident à « qui joue les plus grosses cartes », la couche placement meurt → c'est un CCG générique repeint. **C'est le test make-or-break.**
3. **Voies qui se ressemblent** — si tout se réduit à « je buff ma créature et je tape », l'identité est creuse. Les 5 horloges ci-dessus doivent produire des parties qui se **jouent** différemment.
4. **Équilibre des 5** — stats très asymétriques (Ciseaux 4/1 vs Pierre 1/3) + counters : une horloge peut dominer (ex. la course bat le contrôle si le contrôle ne survit pas). Se règle au playtest.

**La question centrale à se poser tout le temps :**
> *« Ce tour-ci, est-ce que le PLACEMENT RPSLS a changé ma décision — ou j'ai juste joué ma plus grosse carte ? »*
Si le placement compte presque chaque tour → le jeu est réussi. Sinon → on a un CCG avec de la peinture RPSLS, et il faut re-muscler la couche lanes/counters (pas ajouter des cartes).
