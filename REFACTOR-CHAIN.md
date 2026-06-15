# REFACTOR-CHAIN — handoff dédié « casser les god-components » (agent suivant)

> Fichier **autonome** : lis-le en entier avant de toucher au refactor. Pour le contexte
> général du projet (stack, build APK, persistance, éco, comptes) → `HANDOFF.md` + `SUITE.md`.
> Mémoire durable de cette chaîne : `memory/refactor-chain-godcomponents.md` (index : `MEMORY.md`).
>
> Dernière mise à jour : **2026-06-15** par l'agent en cours.

---

## 0. TL;DR — où on en est

- **Objectif** : dispatcher les fichiers god-component (>600 l) en **dossiers/** cohérents,
  **chaque fichier < 400 (idéal) / < 600 (plafond DUR)**. Règle Alex : `refactor = centraliser = dispatcher feature par dossiers et sous-dossiers` (SOLID/SRP/DRY-avec-prudence).
- **Branche de travail : `refactor`** (partie de `develop` = `main`). **AUTO-PUSH autorisé par Alex**
  pour chaque split vérifié (voir §4). La branche n'est PAS déployée → review « plus tard ».
- **État des branches au moment du handoff** :
  - `develop` = `main` = **`3efb5be`** (déployé Render, `/health` 200).
  - `refactor` = **`ab080eb`** = `main` + **ProfilePage** (1 split **EN ATTENTE device-test** avant prochain merge).
- **Workflow Alex** : il **build l'APK + teste sur son téléphone lui-même** ; toi tu codes + typecheck + build, tu pushes sur `refactor`, et le **merge vers `main` (= déploiement) attend son OK explicite** (voir §4 + §7).
- **Les splits VERBATIM-mécaniques propres sont ÉPUISÉS.** Tout ce qui reste = **extraction soignée**
  (sortir des sous-composants/hooks d'un monolithe), pas du simple couper-coller. Voir §6.

---

## 1. Les DEUX patterns de découpe

### Pattern A — déplacement VERBATIM (fichier = plusieurs composants top-level déjà séparés)
Quand le fichier contient déjà N fonctions/composants/consts indépendants (ex. DeckManager, MatchPrepScreen) :
1. Créer un dossier `X/` + un **barrel** (voir §2).
2. **Couper-coller chaque bloc tel quel** (zéro réécriture de corps). Seuls ajouts autorisés :
   - lignes `import`/`export` inter-fichiers,
   - ajustement de profondeur des chemins (`../Y` → `../../Y`, voir §3),
   - passer en `export` ce qui traverse une frontière de module.
3. L'orchestrateur garde l'état + les handlers ; les sous-composants restent identiques.

### Pattern B — EXTRACTION soignée (un seul composant monolithe)
Quand le fichier EST un gros composant unique (ex. ArenaPlanPhase, ProfilePage, et tout le reste) :
- **L'état + les handlers RESTENT dans l'orchestrateur**, passés en **props** aux sous-composants
  présentationnels extraits → le **JSX intérieur de chaque sous-composant reste byte-identique** à l'original.
  (ArenaPlanPhase : MovePicker/HandFanout/LockButton reçoivent `targeting`/`setTargeting`/`startPress`… en props.)
- **Variante « dispatch complet »** (ProfilePage, choix d'Alex pour les pages à sections indépendantes) :
  chaque section devient un **composant autonome qui relit le store lui-même** (`useStore`/`useT` en interne)
  et possède son propre état local. L'orchestrateur devient une **pure composition**. Comportement identique
  (zustand re-souscrit par slice). À privilégier pour les **settings/pages à sections indépendantes** ;
  garder le **Pattern B « props »** pour la **logique de match tactile** (timing/pointer-capture).
- ⚠️ **Ne JAMAIS déplacer la logique sensible** (pointer-capture, géométrie, timing, écritures store) :
  on relocalise seulement son MARKUP. La logique reste là où vit l'état.

---

## 2. Règle du BARREL (fichier-vs-dossier) — TROU À ÉVITER
Choisir selon **comment les consommateurs importent** :
- Consommateur importe le **chemin du dossier** (ex. `../ranked/DeckManager`, `./pages/ProfilePage`,
  `import("./pages/ProfilePage")`) → créer `X/` + `index.ts` (`export { Foo } from "./Foo";` +
  `export type { … }` si des types publics) + **SUPPRIMER l'ancien `X.tsx` dans le MÊME commit**
  (sinon collision fichier-vs-dossier).
- Consommateur importe le **fichier littéral** (ex. `store/store` — ~50 imports) → **garder le fichier
  d'entrée comme barrel**, NE PAS renommer en `index.ts`.
- Si un type était exporté et importé ailleurs (ex. `Arena` de MatchPrepScreen) → le **re-exporter** depuis le barrel.

## 3. Ajustement des chemins (piège mécanique)
Le nouveau dossier est **un niveau plus profond**. Tout import relatif gagne un `../` :
- `pages/ProfilePage.tsx` → `pages/ProfilePage/Foo.tsx` : `../store/store` devient `../../store/store`.
- Les **siblings** du dossier d'origine : `./cards` (depuis `ranked/`) devient `../cards` (depuis `ranked/DeckManager/`).
- Ne pas oublier les `import("…")` dynamiques inline.

## 4. Vérification + commit — RECETTE EXACTE (à refaire pour CHAQUE split)
```bash
# 1) typecheck + build (depuis app/)
cd app && pnpm exec tsc --noEmit            # DOIT être exit 0
pnpm exec vite build                         # DOIT être exit 0

# 2) diff VERBATIM vs HEAD (prouve : zéro logique perdue/altérée)
cd /c/Users/34643/Desktop/RPSLS
git show HEAD:app/src/<chemin>/<Fichier>.tsx > /tmp/orig.txt
cat app/src/<dossier>/*.tsx app/src/<dossier>/*.ts > /tmp/new.txt
norm() { grep -vE '^\s*(import |//|/\*|\*)' "$1" \
  | sed -E 's/^\s*export //; s/^[[:space:]]+//; s/[[:space:]]+$//' \
  | grep -vE '^\s*$' | sort; }
norm /tmp/orig.txt > /tmp/o.txt; norm /tmp/new.txt > /tmp/n.txt
echo "[A] orig pas dans new (DOIT être vide, sauf commentaires reformulés / indirections-props assumées) :"
comm -23 /tmp/o.txt /tmp/n.txt
echo "[B] new pas dans orig (DOIT être uniquement du scaffolding : sigs/props/barrel/invocations) :"
comm -13 /tmp/o.txt /tmp/n.txt
```
**Lecture du diff** : `[A]` est le signal clé. Pour un Pattern A pur, `[A]` doit être VIDE (sauf la
ligne d'import multi-ligne `} from "./X"` dont le pendant `../X` est en `[B]`). Pour une extraction
(Pattern B), `[A]` peut contenir : des **commentaires** reformulés en JSDoc, et des **indirections-props
intentionnelles** (ex. `onClick={confirmPeek}` → `onClick={onConfirm}`, `setX(null)` → `onClose`) ;
**aucune ligne de className / d'écriture store / de logique** ne doit s'y trouver. Si une telle ligne
apparaît en `[A]` sans pendant identique en `[B]` → tu as cassé quelque chose, corrige.

**Commit — CONVENTIONS DURES (instructions globales Alex)** :
- **ZÉRO trace IA** : pas de `Co-Authored-By`, pas de 🤖, pas de mention d'agent. Auteur = `Alex` (git user).
- Message **FR conventional** : `refactor(<scope>): <Fichier>.tsx -> dossier <Fichier>/ (orchestrateur + …)`.
- Préfixer les commandes par `rtk` (token-killer global) : `rtk git add … && rtk git commit -m "…" && rtk git push`.
- **Auto-push sur `refactor` OK** une fois les 3 vérifs vertes. **Merge vers `main` = déploiement → JAMAIS sans
  « oui » explicite d'Alex dans le message courant.** FF-only : `git checkout develop && git merge --ff-only refactor && git checkout main && git merge --ff-only develop && git push origin develop && git push origin main`.

---

## 5. CE QUI EST FAIT (chaîne refactor)

### Serveur (Rust) — sur `main`
- `crates/rpsls-server/src/player_state/` (dont `redis.rs` + DRY #4 helper `pipeline_send`).
- `crates/rpsls-server/src/lanes_engine/`.
- `crates/rpsls-server/src/account/` (mod/validation/hashing/bonus/store/handlers ; Argon2id + bonus bienvenue).

### Client — vague DEVICE-FREE (logique/état pure) — MERGÉE `main` (`b669521`)
- `store/store.ts` 811 → 7 fichiers (`4dbaea8`, barrel = fichier d'entrée gardé, 50 importateurs).
- `arena/arenaTypes.ts` 664 → 6 (`6a66eb3`).
- `arena/arenaRules.ts` 775 → 5 (`055e787`, cycle arenaRules↔arenaCombat préservé via primitives feuilles).
- `match/sharedMatchUI.tsx` 798 → 9 (`2aab7e9`).
- DRY #3 (`syncFingerprint` playerSync) `5841217`, DRY #4 (Redis) `0dd3286`. **Device-validés** (watch Redis/logcat, 0 perte).

### Client — vague DEVICE-NEEDED — MERGÉE `main` (`3efb5be`, device-validée par Alex, partie Pro complète)
- `pages/play/PlayMenu.tsx` 1089 → 9 (`6ab04d2`).
- `pages/ShopPage.tsx` 721 → 6 (`4068cfd`).
- `ranked/DeckManager.tsx` 1031 → 10 (`f3b2d4f`).
- `ranked/MatchPrepScreen.tsx` 641 → 6 (`4230ebd`, barrel re-exporte types `Arena`/`OnlinePrep`).
- `arena/ArenaPlanPhase.tsx` 680 → 5 (`3efb5be`, **1re extraction Pattern B** : MovePicker/HandFanout/LockButton).

### Client — EN ATTENTE device-test sur `refactor` (`ab080eb`)
- `pages/ProfilePage.tsx` 1647 → **21 fichiers** (`ab080eb`, **dispatch complet**, tous <400, orchestrateur 47 l).
  Sections autonomes + cluster Style (StyleSection possède peek/premium-pending + BackgroundGrid/PadGrid/
  PadPreviewModal/BackdropPeekOverlay) + feuilles. **À device-tester** (cf. §8) avant de merger.

---

## 6. CE QU'IL RESTE À FAIRE (monolithes — extraction soignée)

Ordre recommandé (du moins au plus risqué). **Chacun exige un cycle device d'Alex** (logique de match en direct).

| Fichier | Lignes | Risque | Notes / décision |
|---|---|---|---|
| `pages/play/PlayGame.tsx` | 1437 | moyen | **NEXT recommandé.** Orchestrateur de partie locale. |
| `arena/ArenaLaneSlot.tsx` | 859 | élevé | Feuille de la chaîne Arena — faire **avant** ArenaBoard/ArenaGame (enfant→parent). |
| `arena/ArenaBoard.tsx` | 861 | élevé | Plateau Arena. |
| `arena/ArenaGame.tsx` | 909 | élevé | **Décision #3** : extraction <600 sans forcer <400 si le hook/closures sont trop invasifs. |
| `match/LanesMatchView.tsx` | 1459 | élevé | Vue de match partagée (timing/sync). |
| `ranked/RankedGame.tsx` | 1768 | élevé | **Décision #2 (Alex)** : Plan A = extraire `useRankedMatch.ts` (~560 l, closures/timing les plus fragiles du repo) — **confirmer avant**. |
| `pages/OnlinePage.tsx` | 2575 | TRÈS élevé | **Le plus gros du repo.** Sync WebSocket/reconnexion/watchdog. À faire en dernier, par étapes, watch Redis/logcat armé. |

**Exemptés / décisions séparées :**
- `i18n/locales/*.ts` (en/fr/es/it/de/pt/ru/tr, ~740-1140 l chacun) = **fichiers DATA → EXEMPTS** du refactor.
- `ranked/cards.ts` (746) = **SKIP recommandé / décision Alex pendante** : ~85% table plate `CARDS`.
  ⚠️ **PIÈGE** : `scripts/gen-card-meta.mjs` **parse `cards.ts` en TEXTE** (source de la méta serveur `economy.rs`)
  → déplacer `CARDS` casse l'éco serveur-autoritaire **SILENCIEUSEMENT** (invisible pour tsc/build). Ne pas toucher sans MAJ du script.
- `App.tsx` (605) = shell/routeur racine, juste au-dessus du plafond ; à évaluer en dernier, prudemment.

---

## 7. ÉTAT MERGE / DÉPLOIEMENT
- `refactor` (`ab080eb`) porte **ProfilePage** non encore mergé. Après device-test OK d'Alex →
  FF-merge `refactor → develop → main` (commande en §4) + push → **Render redéploie automatiquement** depuis `main`.
- ⚠️ Les splits client sont **100% frontend** : le redéploiement Render reconstruit un **binaire serveur identique**
  (zéro risque) ; le **vrai shipping du frontend = APK buildée localement par Alex**. Vérifier `/health` 200 après push
  (`curl https://rpsls-server-tptj.onrender.com/health`).
- **Ne merge vers `main` que sur « oui » explicite d'Alex** (déploiement).

---

## 8. DEVICE-TEST de ProfilePage (à faire valider à Alex avant merge)
Page Profil rendue → cibler surtout le **cluster Style** (le plus interconnecté) :
1. **Apparences** : tap un fond → peek plein écran → « Choisir » / « Fermer » (revert) ; importer une image
   (bibliothèque, max 6) ; fond **premium non possédé** → peek « aperçu premium » → « Acheter » ouvre la modale.
2. **Pads** : tap un pad → aperçu → « Choisir ce tapis » ; pad premium verrouillé → modale ; importer un tapis.
3. **Slider d'intensité** (premium possédé) : vertical en peek (droite) + carte horizontale sous le Style.
4. Reste (pseudo+edit, avatar+upload, difficulté, haptics+test, accessibilité, confidentialité, reset) : s'affiche + réagit.

---

## 9. PIÈGES SPÉCIFIQUES rencontrés (ne pas re-tomber dedans)
- **i18n** : les alertes d'upload utilisent `t("profile.avatar.tooBig")` / `t("profile.avatar.invalid")` →
  NE PAS hardcoder en français lors d'une extraction (bug introduit puis corrigé sur StyleSection).
- **Artefact `doesn'\''t`** dans `ranked/MatchPrepScreen/Coin.tsx` (commentaire) = escape foiré pré-existant,
  **préservé verbatim** exprès. À nettoyer un jour (cosmétique), ne pas s'en étonner au diff.
- **Hoisting ESM** : un import for-effet est hoisté → pour du wiring post-init (ex. side-channel store après
  `create()`), utiliser une **fonction appelée**, pas un import for-effet.
- **`adb install` sans `-r`** (ou un uninstall) **WIPE le localStorage** → préférer `install -r` pour garder l'état joueur.
- **`tsc` + `vite build` NE PROUVENT PAS** la non-régression de timing/refs sur les orchestrateurs high-risk
  (OnlinePage/RankedGame/ArenaGame/LanesMatchView) → **device-test obligatoire** après chacun.
- **graphify** : `graphify-out/graph.json` existe (interroge-le au lieu de lire 40 fichiers) ; `graphify update .`
  est sûr (`.graphifyignore` racine).

---

## 10. RÈGLES DE TRAVAIL ALEX (rappel — overrident tout)
- **Demande, ne suppose pas.** Confirmer toute tension/ambiguïté AVANT de procéder.
- **Ne touche pas au code non lié.** Mentionne les améliorations possibles en note de fin, ne les fais pas.
- **Confirmations obligatoires** (oui dans le message COURANT) avant : suppression de fichier, remplacement de code,
  déploiement/push vers `main`, migration, appel externe.
- **Fin de tâche** : toujours finir par `Fichiers modifiés` / `Ce qui a été modifié` / `Fichiers intentionnellement non touchés` / `Suivi nécessaire`.
- **Intégrité données joueur** : chaque élément sauvé correctement (local/serveur), zéro perte/inéquité.
