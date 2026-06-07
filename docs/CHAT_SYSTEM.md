# Système de Chat Non-Chat — Communication Rapide

**Date:** 2026-06-07
**Concept:** Un système de communication entre joueurs qui n'est PAS un chat libre. Pas de clavier. Pas de spam. Pas de toxicité. Juste des émotions et des phrases pré-écrites, en quantité limitée, qui renforcent l'immersion au lieu de la briser.

**Philosophie:** Dans un duel, on ne parle pas — on ressent. Les communications sont des "expressions" brèves, visuelles, qui apparaissent comme des bulles ou des émojis flottants au-dessus de l'avatar. Rien ne tape à l'écran, rien n'interrompt le flow du combat.

**Infrastructure existante:** Le serveur supporte déjà `ClientMessage::Chat { emoji }` → `ServerMessage::Chat { from, emoji }`. Le client envoie déjà des emojis simples. Ce design étend cette base avec des phrases et un système de quota.

---

## 1. Architecture du système

### 1.1 Deux types de communication

| Type | Format | Usage | Limite |
|------|--------|-------|--------|
| **Émoji rapide** | 1 émoji Unicode | Réaction instantanée, émotion brute | 5/match match classique, 8/match en Constellation ou tournoi |
| **Courte phrase** | Texte de 2-5 mots | Expression contextualisée, taunt gentil, respect | 3/match (tous modes) |

Le total combiné max est 5/match classique, 8/match Constellation/tournoi. Chaque phrase ou émoji consommé retire 1 du quota.

### 1.2 Règle anti-spam

- Délai minimum entre 2 communications : **5 secondes** (classique), **8 secondes** (Constellation)
- Pas de communication pendant la phase de RÉVÉLATION (le "SHOOT!") — uniquement avant/après
- Maximum 2 communications PAR ROUND pour le mode Constellation
- Si le joueur tente de dépasser le quota, la roue reste grisée avec un petit "🚫" discret

### 1.3 Moments autorisés

| Moment | Émoji | Phrase |
|--------|-------|--------|
| **Lobby d'attente** (tournoi, avant match) | ✅ | ✅ |
| **Écran "Match Found"** (splash 2.5s) | ✅ | ❌ (trop court) |
| **Phase de choix** (round en cours, avant verrouillage) | ✅ | ✅ |
| **Après verrouillage** (attente de l'adversaire) | ✅ | ✅ |
| **Phase de RÉVÉLATION** (animation "SHOOT!") | ❌ | ❌ |
| **Inter-round** (pause 3.5s classique / 7.5s Constellation) | ✅ | ✅ |
| **Écran de fin de match** | ✅ | ✅ |

---

## 2. Les Phrases — Catalogue

Chaque phrase est une clé i18n, catégorisée par émotion/intention. Le joueur choisit dans une roue de 12 phrases disponibles (4 par catégorie × 3 catégories).

### 2.1 Catégorie — RESPECT 🤝

| # | Clé | FR | EN |
|---|-----|-----|-----|
| 1 | `chat.well_played` | "Bien joué !" | "Well played!" |
| 2 | `chat.nice_one` | "Joli coup." | "Nice one." |
| 3 | `chat.good_luck` | "Bonne chance !" | "Good luck!" |
| 4 | `chat.i_learned` | "J'apprends de toi." | "Learning from you." |
| 5 | `chat.honored` | "Honoré de t'affronter." | "Honored to face you." |
| 6 | `chat.rematch_please` | "Revanche ?" | "Rematch?" |

### 2.2 Catégorie — DÉFI ⚡

| # | Clé | FR | EN |
|---|-----|-----|-----|
| 7 | `chat.bring_it` | "Montre-moi !" | "Bring it!" |
| 8 | `chat.is_that_all` | "C'est tout ?" | "Is that all?" |
| 9 | `chat.my_turn` | "À mon tour." | "My turn." |
| 10 | `chat.catch_me` | "Attrape-moi si tu peux." | "Catch me if you can." |
| 11 | `chat.not_bad` | "Pas mal..." | "Not bad..." |
| 12 | `chat.again` | "Encore !" | "Again!" |

### 2.3 Catégorie — ÉMOTION 😤😱😎

| # | Clé | FR | EN |
|---|-----|-----|-----|
| 13 | `chat.so_close` | "Tellement proche !" | "So close!" |
| 14 | `chat.my_heart` | "Mon cœur bat !" | "My heart!" |
| 15 | `chat.unlucky` | "Pas de chance." | "Unlucky." |
| 16 | `chat.i_knew_it` | "Je le savais !" | "I knew it!" |
| 17 | `chat.what_a_round` | "Quel round !" | "What a round!" |
| 18 | `chat.no_way` | "Sérieux ?!" | "No way!" |

---

## 3. Les Émojis — Catalogue

Les émojis sont groupés par émotion, affichés dans une roue circulaire (radial menu).

### 3.1 Émojis de base (toujours disponibles)

| Émoji | Signification | Usage typique |
|-------|--------------|---------------|
| 👍 | GG / Bien joué | Après un bon coup adverse |
| 👏 | Applaudissements | Round exceptionnel |
| 🤝 | Respect mutuel | Début/fin de match |
| 🔥 | En feu | Série de victoires |
| 😱 | Surprise / Choc | Coup inattendu |
| 😤 | Frustration (gentille) | Contre-soi-même |
| 😎 | Confiance | Avant un round décisif |
| 🫠 | "Je fonds" / Désespoir | Après une défaite serrée |
| 💀 | "Je suis mort" | Défaite cuisante |
| 🎯 | "Dans le mille" | Prédiction réussie |
| ⚡ | "Rapide !" | Round plié en 3 secondes |
| 🧠 | "Cérébral" | Belle stratégie |
| 🙏 | "Pitié" / "Merci" | Supplication ou gratitude |
| 🍀 | "Chanceux" | Victoire chanceuse |
| 👑 | "Roi/Reine" | Domination totale |

### 3.2 Émojis contextuels (apparaissent selon la situation)

Ces émojis ne sont disponibles QUE si la situation correspond :

| Émoji | Condition | Signification |
|-------|-----------|---------------|
| 😭 | Perdu 3 rounds d'affilée | Désespoir |
| 🧊 | Draw (égalité parfaite) | "Froid" |
| 💥 | Clean sweep (3-0 en lanes) | Explosion |
| 🦋 | Comeback (retournement de situation) | Métamorphose |
| ⏰ | Gagné avec < 2s restantes | "À l'arrache" |
| 🤖 | Adversaire est une IA (bot fallback) | "Bot détecté" |
| 🌟 | Carte Légendaire jouée | Brillance |
| 🗿 | Adversaire a joué Rock 3× de suite | "Même move ?" |
| 📜 | Adversaire a joué Paper 3× de suite | "Encore ?" |
| ✂️ | Adversaire a joué Scissors 3× de suite | "Vraiment ?" |

---

## 4. UI/UX — La Roue des Expressions

### 4.1 Emplacement et activation

**Position:** Un petit bouton flottant en bas à droite de l'écran de match (près du timer), discret, qui ne gêne pas le sélecteur de symboles.

**Icône du bouton:** 💬 (change de couleur selon le quota restant : blanc → orange → rouge)

**Activation:** Un TAP ouvre la roue. Un second TAP (ou taper ailleurs) la ferme.

### 4.2 La Roue — Design

```
┌──────────────────────────────────────────┐
│                                          │
│        (zone de match normale)            │
│                                          │
│              Phrase envoyée              │
│           "Bien joué ! 👍"              │
│           flotte vers le haut            │
│                                          │
│     ┌──────────────────────┐             │
│     │   Roue des Expressions │  ← overlay semi-transparent
│     │                        │
│     │   📜 PHRASES           │
│     │   🤝 Respect  ⚡ Défi  │
│     │   😤 Émotion           │
│     │   ─────────────────    │
│     │   😀 ÉMOJIS            │
│     │   👍 👏 🤝 🔥 😱      │
│     │   😤 😎 🫠 💀 🎯     │
│     │   ⚡ 🧠 🙏 🍀 👑     │
│     │                        │
│     │   [🚫 Quota: 3/5]     │
│     └──────────────────────┘             │
│                                          │
│    [💬] ← bouton d'activation            │
└──────────────────────────────────────────┘
```

### 4.3 Comportement de la roue

- **TAP sur un émoji** → affiché immédiatement (pas de confirmation nécessaire)
- **TAP sur une catégorie de phrases** → la roue pivote pour montrer les 6 phrases de cette catégorie
- **TAP sur une phrase** → la phrase est affichée AU-DESSUS de l'avatar du joueur, dans une bulle stylée
- **Animation d'envoi** :
  - Émoji: l'émoji apparaît au centre de l'écran, grossit (scale 0→1.5), puis "flotte" vers le haut et se dissipe (3 secondes total)
  - Phrase: une bulle de dialogue apparaît au-dessus de l'avatar, avec le texte + l'émoji de la catégorie, reste 4 secondes puis fade-out
- **Quota affiché** dans la roue: "5/5" (plein) → "0/5" (épuisé, roue grisée)
- **Roue vide** = bouton grisé avec "🚫"

### 4.4 Réception — Ce que voit l'adversaire

- **Émoji reçu** : apparaît AU-DESSUS de l'avatar de l'EXPÉDITEUR (pas au centre), flotte et se dissipe. Son subtil (pop doux).
- **Phrase reçue** : bulle au-dessus de l'avatar de l'expéditeur. La bulle apparaît avec une animation "pop" (scale 0→1 en 0.2s, ease-out). Fond de la bulle = couleur de la catégorie (vert=respect, orange=défi, rose=émotion).
- En mode Constellation (3 lanes), les communications apparaissent AU-DESSUS du plateau de lanes, pas au-dessus de l'avatar (pour ne pas cacher les cartes).
- **Pas de notification push, pas de vibration, pas de son intrusif** — la communication est visuelle et discrète.

---

## 5. Intégration avec le protocole WebSocket existant

### 5.1 Extension minimale du protocole

Le protocole actuel supporte déjà `ClientMessage::Chat { emoji: String }`. On l'étend :

```rust
// protocol.rs — ajout dans ClientMessage
ClientMessage::Chat { 
    emoji: String,        // existant — un seul émoji
    phrase: Option<String> // NOUVEAU — clé i18n de la phrase (ex: "chat.well_played")
}
```

```rust
// protocol.rs — ajout dans ServerMessage  
ServerMessage::Chat {
    from: PlayerSlot,
    emoji: String,
    phrase: Option<String>, // NOUVEAU
    phrase_args: Option<Vec<String>>, // NOUVEAU — pour les phrases avec variables {name}
}
```

Le serveur forward juste — pas de logique métier côté serveur pour les phrases (elles sont pré-validées côté client).

### 5.2 Validation côté client

```typescript
// online/chat.ts — nouveau fichier
const VALID_PHRASE_KEYS: Set<string> = new Set([
  "chat.well_played", "chat.nice_one", // ... 18 clés
]);

const VALID_EMOJIS: Set<string> = new Set([
  "👍", "👏", "🤝", // ... 15 émojis
]);

export function validateChatMessage(emoji: string, phrase?: string): boolean {
  if (!VALID_EMOJIS.has(emoji)) return false;
  if (phrase && !VALID_PHRASE_KEYS.has(phrase)) return false;
  return true;
}
```

Le client ne peut envoyer que des clés de la liste blanche. Même si le client est compromis, le serveur peut aussi filtrer.

### 5.3 Gestion du quota côté client

```typescript
// Dans le composant de match (OnlinePage.tsx, RankedMatchView.tsx...)
const [chatQuota, setChatQuota] = useState(maxQuota); // 5 ou 8
const [lastChatTime, setLastChatTime] = useState(0);

function sendChat(emoji: string, phrase?: string) {
  const now = Date.now();
  if (chatQuota <= 0) return;
  if (now - lastChatTime < minDelay) return; // 5s ou 8s
  
  client.send({ type: "chat", emoji, phrase });
  setChatQuota(q => q - 1);
  setLastChatTime(now);
}
```

---

## 6. Comportement spécial — Tournoi (La Guerre des Ombres)

Dans le mode Tournoi asynchrone (cf. `GAME_MODE_REDESIGN.md`), les communications ont un poids supplémentaire :

### 6.1 Avant le match (lobby du tournoi)

- Les deux joueurs voient le bracket et peuvent s'envoyer des messages de "bonne chance"
- **Phrase spéciale tournoi** : "Que le meilleur gagne." (clé `chat.may_best_win`)
- Les communications pré-match ne consomment PAS le quota (quota séparé : 3 messages pré-match)
- L'historique des messages pré-match est visible dans le replay du match

### 6.2 Pendant le match

- Quota augmenté à 8 (tournoi = plus d'enjeu, plus de communication)
- L'émoji 👑 ("Roi/Reine") est remplacé par 🏆 ("Trophée") en tournoi
- Les communications sont SAUVEGARDÉES dans le replay du match (avec timestamp)

### 6.3 Après le match (écran de résultat)

- 3 messages supplémentaires disponibles (quota post-match)
- **Phrase spéciale défaite** : "Tu m'as bien eu. Félicitations." (clé `chat.you_got_me`)
- **Phrase spéciale victoire** : "Merci pour ce duel." (clé `chat.thanks_for_duel`)

---

## 7. Prévention du spam et de la toxicité

### 7.1 Limitations techniques

| Mécanisme | Détail |
|-----------|--------|
| **Quota** | 5-8 messages/match, pas rechargeable |
| **Délai** | 5-8s entre deux messages |
| **Blocage en révélation** | Aucun message pendant l'animation "SHOOT!" |
| **Liste blanche** | Seules les clés i18n et émojis de la liste sont acceptés |
| **Pas de texte libre** | Impossible d'écrire quoi que ce soit — pas de clavier |

### 7.2 Contre la toxicité par émoji

Même avec une liste blanche, certains émojis peuvent être utilisés de façon toxique (ex: envoyer 💀 après chaque défaite de l'adversaire). Contre-mesures :

- **Limite par émoji** : max 2 fois le même émoji dans un match (évite le spam de 💀)
- **Cooldown par émoji** : un émoji utilisé ne peut pas être réutilisé avant 2 rounds
- **Détection de pattern toxique** (futur, phase 2) : si le joueur envoie 😤 ou 💀 après CHAQUE défaite adverse → le quota est réduit à 1 pour ce match

### 7.3 Bouton "Mute" (récepteur)

- Le joueur qui reçoit les messages peut taper sur l'avatar de l'adversaire → bouton "🔇 Mute"
- Le mute est actif pour le reste du match
- L'expéditeur ne sait PAS qu'il est muté (pas de feedback — sinon c'est une incitation à spammer plus)
- Le mute est réinitialisé au match suivant

---

## 8. UI Components — Plan de développement

### 8.1 Nouveaux fichiers

| Fichier | Emplacement | Rôle |
|---------|-------------|------|
| `chat/chatStore.ts` | `app/src/chat/` | Store Zustand local pour le quota, l'historique, le mute |
| `chat/ChatWheel.tsx` | `app/src/chat/` | La roue des expressions (radial menu) |
| `chat/ChatBubble.tsx` | `app/src/chat/` | Bulle de dialogue (envoyée et reçue) |
| `chat/EmojiFloat.tsx` | `app/src/chat/` | Animation d'émoji flottant |
| `chat/chatI18n.ts` | `app/src/chat/` | Registre des phrases + émojis valides |
| `chat/ChatButton.tsx` | `app/src/chat/` | Bouton 💬 avec badge de quota |

### 8.2 Intégration dans les écrans existants

| Écran | Intégration |
|-------|-------------|
| `OnlinePage.tsx` | Ajouter `<ChatButton>` + `<ChatWheel>` dans la phase "round" et "inter-round" |
| `LanesMatchView.tsx` | Même chose pour la Constellation |
| `RankedMatchView.tsx` | Même chose pour le ranked local (vs CPU — les phrases sont affichées mais l'IA répond avec des émojis automatiques) |
| `TournamentBracket.tsx` | Ajouter communication pré-match dans le lobby |

### 8.3 i18n

- 18 clés de phrases (`chat.*`) dans `en.ts`
- Traduction dans les 14 autres locales
- Les émojis sont universels (Unicode) — pas besoin de traduction

---

## 9. Plan de développement

| Étape | Contenu | Effort |
|-------|---------|--------|
| **1. Store + Registre** | chatStore.ts, chatI18n.ts, types | 1 jour |
| **2. UI Composants** | ChatWheel, ChatBubble, EmojiFloat, ChatButton | 2 jours |
| **3. Intégration matchs** | OnlinePage, LanesMatchView, RankedMatchView | 2 jours |
| **4. Intégration tournoi** | Lobby + post-match + replay | 1 jour |
| **5. i18n** | 18 clés × 15 langues + tests | 1 jour |

**Total: ~7 jours**

---

## 10. Exemples visuels

### Scénario 1 — Match classique, round serré

```
Round 2. Joueur A gagne d'un cheveu (Rock bat Scissors).

A envoie: 😤 (frustration gentille)
→ L'émoji apparaît au-dessus de A, flotte, se dissipe.

B envoie: "Tellement proche !" (phrase catégorie Émotion)
→ Bulle rose apparaît au-dessus de B: "Tellement proche ! 😱"
→ Disparaît après 4 secondes.

A envoie: 🤝 (respect mutuel)
→ L'émoji 🤝 apparaît au-dessus de A.

B envoie: "Encore !" (phrase catégorie Défi)
→ Bulle orange: "Encore ! ⚡"
```

### Scénario 2 — Tournoi, avant-match

```
Lobby du tournoi. Les deux joueurs attendent.

A envoie: "Bonne chance !" (phrase catégorie Respect)
→ Bulle verte: "Bonne chance ! 🤝"

B envoie: "Honoré de t'affronter." (phrase catégorie Respect)
→ Bulle verte: "Honoré de t'affronter. 🤝"

A envoie: 👑 (confiance)
→ Émoji flotte au-dessus de A.

Match commence. 3 messages pré-match consommés.
```

---

## 11. Accessibilité

- Les émojis sont accompagnés d'un label `aria-label` pour les lecteurs d'écran
- Les phrases sont doublées en audio ? Non — pas en V1. Mais le texte est lisible (taille minimum 14px)
- Les couleurs des bulles (vert/orange/rose) restent distinguables pour les daltoniens (contraste suffisant avec le fond sombre)
- Alternative: les catégories ont aussi des ICÔNES (🤝⚡😤) en plus des couleurs

---

## 12. 🃏 CARTE SPÉCIALE — Le Mot Double

**Concept:** Une carte jouable en Constellation Ranked qui interagit avec le système de chat. Elle permet au joueur d'envoyer **deux communications dans le même round** (au lieu d'une seule) — une phrase ET un émoji, ou deux émojis différents.

**Philosophie:** "Les mots sont des armes. Pourquoi n'en utiliser qu'un ?"

---

### Design de la carte

- **Nom:** Mot Double
- **Coût:** 1 mana
- **Rareté:** 🔵 Rare
- **Cible:** none
- **Type:** active
- **Glyphe:** 💬✨
- **Palette:** `#38bdf8` (sky vif — bleu ciel lumineux, distinct du cyan et du fuchsia utilisés ailleurs)
- **Emplacement dans le registre:** `cards.ts` — nouvelle entrée
- **CardId:** `"mot-double"`

### Effet

> **Effet:** Ce round, votre quota de chat est temporairement augmenté de +2. Vous pouvez envoyer jusqu'à DEUX communications (deux émojis OU un émoji + une phrase) au lieu d'une seule. Les règles anti-spam restent actives (délai minimum de 3 secondes entre les deux). Le quota supplémentaire est PERDU si non utilisé avant la fin du round. Ne recharge PAS les quotas déjà épuisés — ajoute +2 communications FRÂICHES.

**Usage tactique:**
- Envoyer 😤 puis immédiatement 🤝 pour feinter la frustration puis montrer du respect — double message psychologique
- Combiner une phrase "Bien joué !" avec un émoji 👑 pour amplifier le compliment
- Envoyer "C'est tout ?" suivi de 😎 pour un trash-talk élégant et rythmé
- En tournoi, cette carte brille particulièrement (quota déjà plus élevé, 10 communications potentielles)

**Condition de déverrouillage:**
> Utiliser le chat (émoji ou phrase) dans 5 matchs différents. Le jeu compte automatiquement — après le 5e match avec au moins 1 communication, la carte est ajoutée à la collection.

**Description i18n:**
- `"ranked.cards.mot-double.name"`: "Mot Double"
- `"ranked.cards.mot-double.desc"`: "Ce round, vous pouvez envoyer 2 messages au lieu d'1. Quota temporaire +2."
- `"ranked.cards.mot-double.targetHint"`: "Utilisez le chat après avoir joué cette carte."

---

### 🎨 PROMPT D'ILLUSTRATION

```
A playing card showing two chat bubbles emerging from a single stylized mouth or speech glyph. The two bubbles overlap slightly — one is bright sky blue (#38bdf8) containing a glowing emoji "😎", the other is soft white containing elegant text lines. The bubbles have a luminous, slightly translucent quality with tiny sparkle particles (✨) orbiting them. The card background is a smooth gradient from deep navy (#0c1929) to twilight blue (#1a365d). The card border is sky blue with a subtle double-line pattern. The glyph "💬✨" is embossed in gold at the top-right corner. Style: clean, modern, mobile-game card art with a communicative/social feel. 1024×1024 PNG with transparency on the outer card edges. The overall mood is playful, expressive, and slightly magical — the card feels like "breaking the fourth wall" of combat to connect with the opponent.
```

---

### Intégration technique

**Dans `cards.ts`:**
```typescript
"mot-double": {
  id: "mot-double", cost: 1, rarity: "rare",
  target: "none", palette: "sky", glyph: "💬✨",
  nameKey: "ranked.cards.mot-double.name",
  descKey: "ranked.cards.mot-double.desc",
  targetHintKey: "ranked.cards.mot-double.targetHint",
  art: "/Cards Bonus/mot-double.png",
},
```

**Dans le flux de match (RankedMatchView.tsx):**
```typescript
// Quand la carte Mot Double est jouée :
if (playedCard.id === "mot-double") {
  setChatQuota(q => q + 2);        // +2 communications fraîches
  setMotDoubleActive(true);         // Flag pour l'UI: la roue devient bleue
  // Le quota bonus expire à la fin du round
  useEffect(() => {
    return () => {
      setMotDoubleActive(false);
      setChatQuota(q => Math.max(originalQuota, q - 2)); // retire le bonus non utilisé
    };
  }, [roundNo]);
}
```

**Dans la Roue des Expressions (ChatWheel.tsx):**
```typescript
// Si Mot Double est actif, la roue change d'apparence :
const motDoubleActive = useStore(s => s.motDoubleActive);
const wheelBorderColor = motDoubleActive ? "#38bdf8" : "#8b5cf6";
const wheelGlow = motDoubleActive ? "shadow-sky-400/40" : "shadow-violet-500/30";
// Le compteur de quota devient "5/5 (+2 🎁)" 
// Les 2 slots bonus sont marqués d'une petite étoile ✨
```

---

### Équilibrage

| Préoccupation | Réponse |
|--------------|---------|
| **Est-ce que ça rend le chat trop présent ?** | Non — la carte coûte 1 mana et consomme un slot de main. Le joueur SACRIFIE une carte de gameplay pour un avantage social. C'est un choix stratégique. |
| **Est-ce que 2 messages par round = spam ?** | Non — le délai minimum de 3s entre les deux messages + le quota global restent. Même avec Mot Double, on reste très loin du spam. |
| **Cette carte est-elle utile en ranked ?** | Oui — la pression psychologique est une vraie mécanique de jeu. Un "C'est tout ?" suivi de 😎 après un sweep peut déstabiliser l'adversaire. Et c'est FUN. |
| **L'adversaire peut-il contrer ?** | Oui — il peut utiliser le bouton Mute. Et il peut aussi avoir sa propre carte Mot Double. |

---

### Résumé des 21 cartes V3 (mise à jour)

| # | Nom | Rareté | Coût | Mécanique clé |
|---|------|--------|------|---------------|
| 1-20 | (voir tableau existant) | — | — | — |
| **21** | **Mot Double** | **Rare** | **1** | **Quota chat +2 pour ce round** |
