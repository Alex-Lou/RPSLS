# Plan du Tutoriel — RPSLS

**Date:** 2026-06-07
**Objectif:** Concevoir un tutoriel interactif, progressif, récompensé, et intégré à l'esprit du jeu. Le but n'est pas d'enseigner chaque règle en une fois, mais d'introduire les concepts par couches successives, chaque couche étant "débloquée" quand le joueur maîtrise la précédente.

**Philosophie:** Le tutoriel n'est pas un mode séparé. Il est tissé dans les premiers matchs du joueur, avec des interventions minimales et progressives. Le joueur APPREND EN JOUANT, pas en lisant.

---

## 1. État des lieux — Ce que le nouveau joueur voit aujourd'hui

| Étape | Ce qui se passe | Problème |
|-------|----------------|----------|
| 1. Splash screen | Magnifique, immersif | ✅ Parfait |
| 2. Welcome (choix pseudo) | Simple, efficace | ✅ Parfait |
| 3. PlayPage | 5 modes, 3 packs de variantes, daily challenge, ranked lobby, Constellation lobby | **Trop de choix d'un coup.** Le joueur ne sait pas par où commencer. |
| 4. Premier match | Aucune aide contextuelle | Le joueur découvre les règles par essai-erreur. Aucune explication du RPSLS, des lanes, des cartes. |
| 5. Profil, Quêtes, Boutique | Accessibles immédiatement | Le joueur est submergé d'options sans comprendre leur utilité. |

**Diagnostic:** L'app est hostile aux nouveaux joueurs. Elle présuppose une connaissance du RPSLS, des modes de jeu, et du système de progression. Le joueur est jeté dans le grand bain sans brassards.

---

## 2. Structure du Tutoriel — 5 Chapitres

Chaque chapitre est un "match tutoriel" jouable. Le joueur joue VRAIMENT — ce n'est pas une vidéo. Mais le jeu intervient subtilement pour guider.

```
CHAPITRE 1 : Les Bases           (1 match, ~3 min)
  → Débloque: Mode Training

CHAPITRE 2 : Les Modes           (1 match, ~3 min)
  → Débloque: Mode Casual, Daily Challenge

CHAPITRE 3 : La Constellation    (1 match, ~5 min)
  → Débloque: Mode Constellation Lanes vs CPU

CHAPITRE 4 : Les Cartes          (1 match, ~6 min)
  → Débloque: Ranked Mode, Deck Manager

CHAPITRE 5 : Le Monde            (exploration, ~2 min)
  → Débloque: Profil, Quêtes, Boutique, Online, Leaderboard
```

**Déblocage progressif:** Tant qu'un chapitre n'est pas complété, les modes correspondants sont GRISÉS avec un cadenas 🔒 et le texte "Termine le Chapitre X pour débloquer".

**Récompenses par chapitre:**
- Chapitre 1 : 50 XP + titre "Apprenti" (Commun)
- Chapitre 2 : 50 XP + 10 éclats
- Chapitre 3 : 100 XP + 20 éclats + Pad "Chalkboard" offert
- Chapitre 4 : 100 XP + 1 carte Rare aléatoire
- Chapitre 5 : 200 XP + badge "Disciple de l'Architecte"

---

## 3. Conception détaillée — Chapitre par Chapitre

---

### 3.1 CHAPITRE 1 — Les Bases du RPSLS

**Déclencheur:** Automatique après l'écran Welcome (si `onboarded === false`).

**Match tutoriel:** Vs CPU "Facile", BO3 (2 rounds gagnants). L'adversaire est présenté comme "L'Architecte" — un mentor bienveillant.

**Flow du chapitre:**

```
[ÉCRAN D'INTRO] — 5 secondes
  "Bienvenue dans l'Arène. Je suis l'Architecte. Laisse-moi te montrer les bases."
  → L'avatar de l'Architecte apparaît (silhouette dorée, chaleureuse)
  → Transition fluide vers l'écran de match

[ROUND 1 — DÉCOUVERTE DES SYMBOLES] — guidé
  • Les 5 symboles apparaissent en bas de l'écran
  • Un projecteur (spotlight) isole le sélecteur de symboles — le reste de l'écran est légèrement assombri (overlay noir 40%)
  • Texte flottant: "Voici les 5 symboles. Chacun bat 2 autres et perd contre 2 autres. C'est l'équilibre parfait."
  • Les 5 symboles s'animent un par un (Rock pulse, Paper ondule, Scissors s'entrechoquent, Lizard rampe, Spock médite)
  • L'Architecte: "Pour ce premier round, choisis celui qui te parle le plus."
  → Le joueur choisit un symbole (pas de timer)
  → L'Architecte joue le symbole qui PERD contre le choix du joueur (il laisse gagner, mais subtilement)
  
  [RÉVÉLATION]
  • Animation standard de révélation
  • Texte: "Tu as choisi [ROCK]. J'ai choisi [SCISSORS]. Rock écrase Scissors → Tu gagnes !"
  • Le verbe "écrase" est en surbrillance, suivi d'une mini-animation: Rock tombe sur Scissors
  • L'Architecte: "Bien joué. Un point pour toi."

[ROUND 2 — APPRENTISSAGE DES RELATIONS] — semi-guidé
  • Texte flottant: "Cette fois, observe bien. Je vais te montrer qui bat qui."
  • L'écran affiche temporairement un PENTAGRAMME INTERACTIF (overlay):
    - 5 icônes disposées en cercle
    - Des flèches partent de chaque icône vers les 2 qu'elle bat (flèches vertes)
    - Des flèches arrivent vers chaque icône depuis les 2 qui la battent (flèches rouges)
    - Le pentagramme pulse doucement, puis disparaît après 4 secondes
  • Le timer du round démarre NORMALEMENT
  → Le joueur joue librement (le pentagramme peut être rappelé en tapant un bouton "?" pendant le tutoriel)
  → L'Architecte joue un coup aléatoire (mode Easy CPU normal)

  [RÉVÉLATION]
  • Résultat normal
  • Si le joueur gagne: "Tu commences à comprendre. Continue comme ça."
  • Si le joueur perd: "Ne t'inquiète pas. Même les maîtres perdent parfois. Observe ce qui s'est passé."
  • Le pentagramme réapparaît BRIÈVEMENT (2s) avec la relation du round en surbrillance

[ROUND 3 — si nécessaire, décisif]
  • Round normal, sans guidage
  • L'Architecte: "Dernier round. Montre-moi ce que tu as appris."

[FIN DU MATCH]
  • Écran de victoire/défaite standard MAIS avec un bandeau spécial:
    "🎓 Chapitre 1 terminé ! +50 XP"
  • Bouton "Continuer" → retour au menu principal
  • Le mode "Training" est maintenant DÉVERROUILLÉ
  • Une notification discrète: "Nouveau mode débloqué : Entraînement"
```

**Interventions visuelles (guidage):**

| Élément | Animation | Timing |
|---------|-----------|--------|
| Spotlight sur sélecteur | Overlay noir 40% + cercle lumineux autour des symboles | Pendant l'explication |
| Pentagramme interactif | SVG avec 10 flèches animées (tracé progressif) | 4 secondes avant le round 2 |
| Flèche de relation | Flèche épaisse du gagnant vers le perdant, couleur or | 2 secondes après la révélation |
| Texte de l'Architecte | Bulle de dialogue stylée (pas une alert!) en bas de l'écran | Entre les rounds |

---

### 3.2 CHAPITRE 2 — Les Modes de Jeu

**Déclencheur:** Le joueur clique sur "Play" après avoir terminé le Chapitre 1. Un popup propose: "Continuer le tutoriel ?" (Oui/Plus tard).

**Match tutoriel:** Vs CPU "Normal", BO3. Présentation des modes et du daily challenge.

**Flow du chapitre:**

```
[ÉCRAN D'INTRO]
  L'Architecte: "Tu sais jouer. Maintenant, voyons OÙ jouer. Il existe plusieurs façons de se battre."
  
  → L'écran de sélection de mode apparaît, MAIS:
    - "Training" est en surbrillance (vert, pulsation)
    - "Casual", "Ranked", "Hotseat" sont légèrement grisés
    - Un spotlight met en évidence "Training"
    
  L'Architecte: "Commence par le mode Entraînement. Pas de pression, pas de punition."
  → Le joueur DOIT cliquer sur Training pour continuer
  
[MATCH EN TRAINING]
  • Round 1: jeu normal, l'Architecte commente APRÈS le round
  • L'Architecte: "En Entraînement, tu ne gagnes pas d'XP. Mais c'est parfait pour tester des stratégies."
  
[APRÈS LE MATCH]
  → Retour au menu de sélection
  → "Casual" est maintenant en surbrillance
  L'Architecte: "En mode Casual, tu affrontes l'IA et tu gagnes de l'XP en cas de victoire. Lance un match casual."
  → Le joueur DOIT cliquer sur Casual
  
[MATCH EN CASUAL]
  • Jeu normal
  • Après le match: l'écran de résultats affiche les gains d'XP avec une animation spéciale:
    - La barre d'XP se remplit de façon exagérée
    - Texte: "+50 XP ! C'est comme ça que tu progresses."
  
[DAILY CHALLENGE]
  L'Architecte: "Dernière chose : chaque jour, un défi spécial t'attend. Regarde."
  → Spotlight sur la carte "Daily Challenge" dans le menu Play
  → Le joueur n'a pas à le faire maintenant, mais il SAIT que ça existe
  → Un petit badge "NOUVEAU" apparaît sur le daily challenge
```

**Ce que le joueur apprend:**
- Différence Training vs Casual (XP)
- Le concept de gain d'XP
- L'existence du Daily Challenge
- La navigation entre les modes

---

### 3.3 CHAPITRE 3 — La Constellation (Lanes)

**Déclencheur:** Le joueur a fait au moins 3 matchs (tous modes confondus) après le Chapitre 2.

**Match tutoriel:** Constellation Lanes vs CPU "Très Facile" (IA qui joue mal exprès). Win-to: 2 (premier à 2 rounds gagnés).

**Flow du chapitre:**

```
[ÉCRAN D'INTRO]
  L'Architecte: "Tu maîtrises le duel simple. Il est temps de passer à la vitesse supérieure. Voici la CONSTELLATION."
  
  → L'écran de match Constellation apparaît pour la première fois
  → 3 LANES au lieu d'1 seule zone de jeu
  → Le joueur voit 3 colonnes vides, numérotées 1, 2, 3
  
  L'Architecte: "Ici, tu ne joues pas UN symbole. Tu en joues TROIS. Un par lane."
  
  [EXPLICATION VISUELLE]
  • Chaque lane est mise en surbrillance une par une (spotlight séquentiel)
  • Texte flottant au-dessus de chaque lane:
    - Lane 1: "Lane GAUCHE"
    - Lane 2: "Lane CENTRALE"
    - Lane 3: "Lane DROITE"
  • Animation: 3 symboles descendent du sélecteur vers les 3 lanes
  • L'Architecte: "Gagne au moins 2 lanes sur 3 → tu gagnes le round. Simple."

[ROUND 1 — PLACEMENT GUIDÉ]
  • Le sélecteur de symboles est en bas (5 icônes)
  • Instruction: "Tape un symbole, puis tape une lane pour le placer."
  • Le joueur tape Rock → les 3 lanes clignotent doucement
  • Le joueur tape Lane 1 → Rock apparaît sur Lane 1
  • Le joueur répète pour Lane 2 et Lane 3
  • Bouton "Verrouiller" pulse quand les 3 lanes sont remplies
  → L'Architecte joue 3 symboles qui PERDENT tous (IA volontairement nulle)

  [RÉVÉLATION]
  • Les 3 lanes révèlent simultanément
  • Texte: "Tu as gagné 3 lanes sur 3 ! C'est un sweep parfait. +3 points."
  • Mini-célébration: étoiles qui tombent

[ROUND 2 — SEMI-GUIDÉ]
  • Le joueur joue librement
  • L'Architecte joue un peu mieux (gagne 1 lane sur 3)
  • L'Architecte: "J'ai gagné une lane, mais TU as gagné le round. 2 lanes > 1 lane."

[APRÈS LE MATCH]
  • Écran de résultats spécial Constellation
  • Bandeau: "🎓 Chapitre 3 terminé ! +100 XP + 20 éclats"
  • Le mode "Constellation Lanes vs CPU" est DÉVERROUILLÉ dans le menu Play
```

---

### 3.4 CHAPITRE 4 — Les Cartes (Système de mana)

**Déclencheur:** Le joueur a gagné au moins 1 match en Constellation (Chapitre 3 complété).

**Match tutoriel:** Constellation Lanes vs CPU "Facile", win-to 2. Avec cartes et mana.

**Flow du chapitre:**

```
[ÉCRAN D'INTRO]
  L'Architecte: "Tu sais placer tes symboles. Maintenant, je vais te donner un avantage : les CARTES."
  
  → L'écran de match Constellation apparaît AVEC une NOUVELLE ZONE en bas:
    - Une main de 3 cartes (face visible, étalées)
    - Une jauge de mana "⚡ 2/2"
  
  L'Architecte: "Les cartes sont des pouvoirs spéciaux. Elles coûtent du mana. Observe."

[EXPLICATION VISUELLE]
  • Spotlight sur la zone de main
  • Les 3 cartes sont révélées une par une (flip 3D):
    - Carte 1: Aegis 🛡️ (coût 1) — "Protège une lane. Si tu perds → annulé."
    - Carte 2: Precision 🎯 (coût 1) — "Boost une lane. Si tu gagnes → +1 point bonus."
    - Carte 3: Surge ⚡ (coût 2) — "Pari risqué : double points, ou double perte."
  • La jauge de mana est mise en évidence: "Tu as 2 mana. Choisis bien."

[ROUND 1 — JOUER UNE CARTE (GUIDÉ)]
  • Étape 1: Placer ses 3 symboles (comme au chapitre 3)
  • Étape 2: "Maintenant, joue une carte !"
  • Spotlight sur la main
  • Le joueur tape Aegis → la carte s'illumine
  • Instruction: "Tape la lane que tu veux protéger."
  • Le joueur tape Lane 2 → Aegis apparaît sur Lane 2 avec un bouclier visuel
  • Coût: le mana passe de 2/2 à 1/2
  • Le joueur peut encore jouer Precision (coût 1) s'il veut
  → L'Architecte joue sans carte, et perd volontairement

  [RÉVÉLATION]
  • Résolution normale
  • Si Aegis a sauvé une lane: "Aegis a absorbé ta défaite sur cette lane. Elle est devenue un match nul."
  • Animation: le bouclier Aegis absorbe l'impact

[ROUND 2 — JOUER DEUX CARTES]
  • Le mana est remonté à 2/2 (+1 par round)
  • Le joueur peut jouer jusqu'à 2 cartes (Aegis + Precision par exemple)
  • L'Architecte: "Essaie de combiner deux cartes. Aegis pour te protéger, Precision pour attaquer."
  → L'Architecte joue normalement (easy CPU)

[APRÈS LE MATCH]
  • Écran de résultats
  • Bandeau: "🎓 Chapitre 4 terminé ! +100 XP + 1 carte Rare"
  • Le joueur reçoit une carte Rare (tirée aléatoirement parmi les non-possédées)
  • Le Ranked Mode + Deck Manager sont DÉVERROUILLÉS
  • Popup: "Tu as reçu [AUGUR] ! Va dans Profil → Deck pour l'ajouter à ton deck."
```

---

### 3.5 CHAPITRE 5 — Le Monde (Profil, Quêtes, Social)

**Déclencheur:** Le joueur a complété les 4 premiers chapitres.

**Pas un match — une visite guidée de l'interface.**

**Flow du chapitre:**

```
[ÉCRAN D'INTRO]
  L'Architecte: "Tu es prêt à explorer le monde de RPSLS par toi-même. Laisse-moi te montrer ce qui t'attend."
  
  → L'écran principal (Shell) est affiché
  → La sidebar/menu est mise en évidence

[ÉTAPE 1 — LE PROFIL]
  • Spotlight sur l'icône Profil (ou le UserHeader)
  • L'Architecte: "Ton profil, c'est TA carte d'identité. Tes stats, ton XP, ton thème."
  → Le joueur est invité à cliquer sur Profil
  → Une fois dans le Profil:
    - Spotlight sur le niveau et l'XP: "Tu gagnes de l'XP à chaque victoire. Plus d'XP = plus de niveau."
    - Spotlight sur le sélecteur de thème: "Personnalise l'apparence du jeu. Pour l'instant, c'est gratuit."
    - Spotlight sur l'avatar: "Tu peux même mettre ta propre photo."

[ÉTAPE 2 — LES QUÊTES]
  • Retour au menu principal
  • Spotlight sur l'icône Quêtes
  • L'Architecte: "Les quêtes te donnent des objectifs à accomplir. Termine-les pour gagner de l'XP et des éclats."
  → Le joueur clique sur Quêtes
  → L'écran des quêtes apparaît avec:
    - Les quêtes en cours (ex: "Joue 3 matchs")
    - Un bouton "Récupérer" qui pulse s'il y a des récompenses à claim
  • L'Architecte: "Reviens ici souvent. Certaines quêtes se renouvellent chaque jour."

[ÉTAPE 3 — LA BOUTIQUE]
  • Spotlight sur l'icône Boutique
  • L'Architecte: "Avec tes éclats, tu peux acheter des packs de cartes. Plus de cartes = plus de stratégies."
  → Le joueur clique sur la Boutique
  → Un popup: "Tu as assez d'éclats pour ton PREMIER PACK ! 🎉"
  → Le joueur est invité à ouvrir un pack (coût offert pour le tutoriel — 0 éclats cette fois)
  → Animation d'ouverture de pack (3 cartes révélées)

[ÉTAPE 4 — LE ONLINE]
  • Spotlight sur l'icône Online
  • L'Architecte: "Quand tu seras prêt, tu pourras affronter de VRAIS joueurs du monde entier. Pour l'instant, entraîne-toi."
  → Le joueur voit l'écran Online mais n'a pas à jouer
  → Le bouton "Find an opponent" est grisé avec "Termine 10 matchs pour débloquer" (prévention anti-noob-stomp)

[CLÔTURE]
  • L'Architecte: "Tu as tout ce qu'il faut pour commencer ton voyage. L'Arène est à toi. Que les combats commencent."
  → Le bandeau "🎓 Tutoriel terminé ! +200 XP + badge 'Disciple de l'Architecte'" apparaît
  → Le badge apparaît dans le profil
  → TOUS les modes sont déverrouillés
  → Le joueur est libre
```

---

## 4. Éléments UI du Tutoriel

### 4.1 Le Guide — L'Architecte

- Un personnage mentor qui apparaît dans une **bulle de dialogue stylée** (pas une modale, pas un `alert()`)
- La bulle est en bas de l'écran, semi-transparente, avec l'avatar de l'Architecte (silhouette dorée)
- Le texte est court (1-2 phrases max), traduisible
- Un bouton "↩" permet de faire répéter la dernière instruction
- L'Architecte disparaît progressivement au fil des chapitres (Ch1: 10 interventions, Ch5: 3 interventions)

### 4.2 Le Spotlight

- Un overlay semi-transparent (noir 40%) couvre tout l'écran SAUF la zone ciblée
- La zone ciblée a un **glow animé** (pulsation douce, or/violet)
- Une **flèche** ou un **doigt** pointe vers la zone ciblée (optionnel, si l'élément est petit)
- Le spotlight se déplace avec une transition fluide (500ms ease-in-out)
- **Jamais plus d'UN spotlight à la fois** — le joueur ne doit pas être submergé

### 4.3 Le Pentagramme Interactif

- SVG affiché en overlay pendant 4 secondes
- 5 icônes disposées en cercle (pentagone)
- Flèches VERTES du gagnant vers le perdant (tracées progressivement)
- Flèches ROUGES du perdant vers le gagnant (tracées en sens inverse)
- Le symbole joué par le joueur est en surbrillance
- Bouton "?" dans l'interface de match permet de le rappeler à tout moment

### 4.4 La Notification de Déverrouillage

- Un petit popup en haut de l'écran (pas bloquant)
- Animation: slide-down + fade-in, puis fade-out après 3 secondes
- Icône du mode déverrouillé + texte "Nouveau mode : Entraînement"
- Son: carillon doux

---

## 5. Intégration technique

### 5.1 Nouveaux composants

| Composant | Emplacement | Rôle |
|-----------|-------------|------|
| `TutorialProvider.tsx` | `tutorial/` | Contexte React qui gère l'état du tutoriel (chapitre en cours, étape, flags) |
| `TutorialOverlay.tsx` | `tutorial/` | Overlay de spotlight + flèche |
| `ArchitecteBubble.tsx` | `tutorial/` | Bulle de dialogue du mentor |
| `PentagramOverlay.tsx` | `tutorial/` | Pentagramme interactif (utilisable hors tutoriel aussi) |
| `UnlockNotification.tsx` | `tutorial/` | Notification de déverrouillage |

### 5.2 Stockage

```typescript
// Extensions de Player dans types.ts
interface Player {
  // ... existant
  tutorialChapter: 0 | 1 | 2 | 3 | 4 | 5;  // 0 = pas commencé, 5 = terminé
  tutorialFlags: {
    chapter1Done: boolean;
    chapter2Done: boolean;
    chapter3Done: boolean;
    chapter4Done: boolean;
    chapter5Done: boolean;
    pentagramShown: boolean;       // Le pentagramme a été affiché au moins une fois
    firstPackOpened: boolean;      // Le pack tutoriel a été ouvert
  };
}
```

### 5.3 Gating des modes

```typescript
// Dans PlayPage.tsx — avant d'afficher les modes
const tutorialChapter = useStore(s => s.player.tutorialChapter);

const isModeLocked = (requiredChapter: number) => {
  return tutorialChapter < requiredChapter;
};

// Mode Training → requis: Chapitre 1
// Mode Casual → requis: Chapitre 2
// Constellation → requis: Chapitre 3
// Ranked → requis: Chapitre 4
// Online → requis: Chapitre 4 + 10 matchs joués (anti-noob-stomp)
// Hotseat → toujours disponible (pas besoin de tuto pour jouer à deux)
```

### 5.4 i18n

- Toutes les interventions de l'Architecte sont des clés i18n: `tutorial.ch1.intro`, `tutorial.ch1.round1.symbols`, etc.
- Environ 60 clés à créer (10-12 par chapitre)
- Les textes sont volontairement courts (max 120 caractères) pour faciliter la traduction

---

## 6. Calendrier de développement

| Sprint | Contenu | Effort |
|--------|---------|--------|
| **Sprint 1** | TutorialProvider + stockage + gating des modes | 2 jours |
| **Sprint 2** | Chapitre 1 (Bases RPSLS) + PentagramOverlay | 3 jours |
| **Sprint 3** | Chapitres 2+3 (Modes + Constellation) + Spotlight + ArchitecteBubble | 4 jours |
| **Sprint 4** | Chapitres 4+5 (Cartes + Monde) + UnlockNotification | 3 jours |
| **Sprint 5** | i18n (60 clés × 15 langues) + tests + polish animations | 3 jours |

**Total: ~15 jours (3 semaines)**

---

## 7. Métriques de succès

**Ce qu'on mesure après le lancement du tutoriel:**

| Métrique | Avant tutoriel (estimé) | Cible après tutoriel |
|----------|------------------------|---------------------|
| Joueurs qui atteignent le 2e match | ~40% | >80% |
| Joueurs qui essaient Constellation | ~15% | >50% |
| Joueurs qui utilisent des cartes | ~10% | >60% |
| Joueurs qui complètent une quête | ~5% | >30% |
| Taux de complétion du tutoriel (5 chapitres) | N/A | >70% |
| Temps moyen avant premier achat (boutique) | N/A | <3 jours après Ch5 |
| Taux de rétention J7 | Inconnu | >40% |