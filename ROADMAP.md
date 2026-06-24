# ROADMAP — Constellation Pro (source de vérité unique)

> **Réécrit le 2026-06-24** après cartographie code-par-code du mode (6 agents). Ce fichier REMPLACE les anciens
> `GAMEPLAY-POLISH-HANDOFF.md`, `ARENA-RETHINK.md`, `VOIE-ARCHETYPES.md`, `REFACTOR-CHAIN.md`, `HANDOFF-ARENA-PAYSAGE.md`, `CARTES-BLUEPRINT.md` (supprimés).
> Branche : `feat/gameplay-polish`. Workstream **pluri-sessions**.
>
> **C'est LA référence.** Statuts = VÉRIFIÉS dans le code (pas des coches d'intention). « FAIT » = dans le code ; à
> CONFIRMER device avant de clore. Si Alex re-signale un point « fait » → investiguer (régression / cas-limite), ne pas le rejouer comme acquis.

---

## 0. RÈGLES & WORKFLOW (lire avant de coder)

- **Règles de code d'Alex** (`~/.claude/CLAUDE.md` global, PRIMENT sur tout) : FR · demande-ne-suppose-pas (confirme toute ambiguïté AVANT de coder) · ne touche JAMAIS au code non lié (note-le, ne le modifie pas) · KISS / DRY-prudent / SOLID · fichiers < 400 l (dispatch en dossiers) · **ZÉRO émoji dans l'app** · solution la plus simple d'abord.
- **Confirmation explicite d'Alex (oui dans le message courant)** avant : suppression de fichier, remplacement de code, **merge vers `main` = déploiement Render**, migration, appel externe.
- **Cadence device** : Alex teste sur son tel (`adb -s CMJFT4IN6HFYA6OV`, goya) + celui de sa femme (`fce0fa440c14`). Tu builds+installes (`-r` garde localStorage) → **tu ATTENDS son OK device** avant commit. Procédure APK exacte : mémoire « APK build Tauri Android » (⚠️ `.so` à la **racine** `target/`, gradle `--rerun-tasks`).
- **Verts avant push** : `cd app && pnpm exec tsc --noEmit` + `pnpm exec vite build`. Serveur : `cd crates/rpsls-server && cargo test`.
- **Commits SANS trace IA** (auteur = Alex, FR conventional). Finis chaque tâche par : Fichiers modifiés / Ce qui a changé / Non touchés / Suivi.
- **Réfs** : `VOIES-GUIDE.md` (design des 5 Voies) · `CARTES-AUDIT.md` (⚠️ **le CODE = source de vérité** pour les cartes) · `HANDOFF.md` (stack/build/persistance) · `SUITE.md` (état projet global) · `memory/MEMORY.md`.

---

## 1. LE CŒUR EST SOLIDE — ne PAS reconstruire (vérifié vivant)

> Ces systèmes tournent et sont cohérents. **Ne pas les refaire.** On bâtit DESSUS.

- **Boucle** : mana +1/tour (cap 8) · invocation = 1 mana · pioche par **paliers** (T1-3 rien → T4 cinq → +1 /3 tours, +1 si main ≤2) · **deck fini** (ne recycle pas) → **FATIGUE** quand deck sec (1,2,3… PV/tour = horloge léthale) · fail-safe T15 + **mort subite RPSLS** sur égalité. Le point mort structurel est RÉGLÉ.
- **5 Voies + Le Tracé** : jauge qui monte sur **counter-win réussi** (pas summon, pas si esquivé/Aegis — garde `bDerobe`/`aDerobe`), cue ★ sur la lane gagnante. Pleine → **Finisher** injecté. Montagne (Strates) · Forêt (Sève) · Tranchant (+ATK) · Mirage (Esquive) · Cosmos (chip). Les 5 finishers OK.
- **Combat** : counter-kill · splash · Provocation/déflection · anti-taunt (Feuille/Spock) · Riposte · Esquive · Aegis · perce (Tranchant/LAME) · Émoussé · Toile · immunité sorts (Spock) · Ancrage · Fanaison. Tout vivant et lu.
- **Méta** : Forge/Fusion (8 recettes) · 9 cartes « à la pioche » · Larcin · Réverbération · Augure (révèle la main adverse, bien lu) · **vraie IA** (4 personas, 50+ cartes).
- **Anims récentes (cette session)** : mort (DeathShatter, joue toujours) · esquive lézard poussée (GPU-safe) · cue Tracé.

---

## 2. DÉCISIONS DESIGN FIGÉES (Alex, 2026-06-24)

1. **Le Pro aura ses PROPRES cartes.** Les 6 cartes « passives » (cadence, pillage, prophétie, conduit, gaia…) restent **Ranked-only** — leur absence d'effet en Pro est ASSUMÉE. → futur chantier : concevoir le pool de cartes dédié au Pro (à partir du CODE + des lois de `CARTES-AUDIT.md`, pas d'un blueprint).
2. **`ARENA_CARD_TYPE` (taxonomie par famille)** : compléter les ~14 cartes manquantes **UNIQUEMENT si c'est vraiment pertinent et cool** pour le jeu (sinon laisser / repenser). Pas de complétion mécanique pour la complétion.
3. **Phénix** : **à rewire** (le revive snapshot existe mais la consommation est introuvable = bug actuel). MAIS avec **GIGANTESQUE modération** : un **vrai parcours pour l'obtenir**, **usage unique**, **NON deckable** (tier spécial façon fusion/finisher, pas une carte de deck ordinaire).
4. **`stifles`** (champ Feuille, redondant — la vraie logique est `hasAntiTaunt`) : **virer si certain que c'est faisable proprement**.
5. **Vélocité du Tracé** : OK pour l'instant (pas de garde-fou « 2 symboles distincts » nécessaire). MAIS s'assurer qu'elle **reste FLUIDE selon l'appareil** → perf/paliers graphiques par device.

---

## 3. À VIRER — code mort / zombie (Lot 0)

| Élément | Pourquoi | Note |
|---|---|---|
| `recordTraceCounter` (`arenaTrace.ts`) | jamais appelé (relique Tracé v1) | supprimer la fonction ; **garder `affinityEdges`** (lue par l'IA) |
| `tracedEdges` (champ `hero.ts`) | écrit que par la fonction morte | supprimer |
| `constellationCount` (champ `hero.ts`) | init 0, jamais réécrit | supprimer ⚠️ **vérifier d'abord que `ArenaConstellationBar` lit bien `engineVal`** (via `ArenaHeroStrip`) et pas ce champ |
| `killBonusPending` (champ) | posé+loggé « +K » mais ne pilote plus la pioche | supprimer set + champ |
| `aegisCastThisMatch` (champ) | feature retirée, gardé pour vieux saves | supprimer (au prochain wipe save) |
| `stifles` (champ Feuille) | label UI only, `hasAntiTaunt` est la vraie logique | virer si propre (décision §2.4) |
| ~10 cartes no-op | gambit, echo-temporel, ancre-temporelle, boussole, braise, crépuscule, fardeau, schrödinger, trinité… → `console.warn`, zéro effet en Pro | **sortir du pool Pro** (ou implémenter si vraiment cool) |

---

## 4. LA ROUTE — Lots ordonnés

### Lot 0 — Hygiène moteur (fondation, rapide, peu risqué)
- Virer tout le code mort (§3) + nettoyer les ~10 cartes no-op du pool Pro.
- **Phénix** : corriger le bug de résurrection (trouver/ajouter la consommation du snapshot `phenixReviveA/B` dans `endOfTurnCleanup`) PUIS le repositionner en tier spécial usage-unique non-deckable + parcours d'obtention (§2.3).
- `stifles` : virer si propre.
- ⇒ moteur sans zombie, pool sans carte morte.

### Lot 1 — Le Tracé : finir + perf device
- **Fluidité par appareil** (§2.5) : s'assurer que le combat + le cue restent fluides sur device bas de gamme (paliers graphiques — cf. mémoire `graphics-quality-tiers`). Mesurer logcat « Skipped frames » / Davey.
- (Optionnel) coloriage des arêtes du pentagone sur la barre, OU acter « jauge numérique » et retirer le concept d'arêtes.

### Lot 2 — Bugs & lisibilité combat
- **[Pro-25]** 🔴 Second Souffle & Supernova ne se sélectionnent pas au toucher (Alex en rage). Code semble OK mais vécu cassé → trace ciblée sur CES 2 cartes (leur `kind`/`target` dans `arenaTypes/targeting.ts` + `commitCard` dans `ArenaPlanPhase`), pas le tap générique.
- **[Pro-18]** « Les pierres s'absorbent entre elles » : PAS reproduit en code → demander à Alex le cas exact avant de coder.
- **[Pro-19]** Auditer Surcharge (+4 ATK/−1 PV) & Ancrage (immunité sorts) : effet vs texte, équité.
- **[Pro-37]** Anim Tranchant « a du mal » : re-tester sur ce build (perf bossée) ; si lent, espacer la séquence.

### Lot 3 — Identité visuelle (règle dure zéro émoji)
- **[Pro-5/6/31]** Sweep émoji : fallback main vide `🎴`, badges fusion `⚗`/`🪨` (`ArenaHandFanout`), `✦` dans `AuthGate:158`, emojis en dur `ConstellationLobby`/`ClasseLobby`. Icônes menu = déjà PNG mais Alex les veut « plus cool » → prompts d'illustration.
- **[Jet de Caillou]** 🪨 FX projectile lane→lane (la carte fait 2 dégâts, zéro anim). Réutiliser `DeathShatter` pour l'impact fatal.

### Lot 4 — UX Pro & profil
- **[Pro-17/21]** Strip adverse : descendre l'avatar, bouton LOGS sous le burger, étirer à droite, voie plus à gauche.
- **[Pro-32]** Danger Zone i18n (clés `profile.danger.*` existent → brancher `useT` dans `ResetSection`). **[Pro-33]** logoff dans le profil avant la Danger Zone. **[Profil-1]** burger sticky/au-dessus au scroll profil.

### Lot 5 — Parité Classé
- **[Ranked-4]** porter les FX Pro (`ArenaSpellFX`/`ArenaCreatureFX`) au Classé. **[Ranked-5]** réutiliser le pile-ou-face (`Coin`) partout. **[RankedConst-1]** revue visuelle de la grille « Toutes les cartes ».

### Lot 6 — Gros chantiers (multi-session, à cadrer avec Alex)
- **Cartes propres au Pro** (§2.1) : concevoir le pool dédié.
- **Online Pro/Classé** (serveur n'a que classic+lanes) → débloque **[Pro-10/11]** télépathie/prophétie « live » (révélation semi-transparente au cast, online-only). **[Pro-13]** collection anti-triche serveur.
- **Livre de recettes** de fusion (logique OK, manque l'UI) (§2.2 lié).
- IAP réel · traductions (locales ~60 % + policy 2 langues = FATAL) · landing séparé.

---

## 5. ✅ DÉJÀ FAIT & VÉRIFIÉ (ne pas refaire — confirmer device)

Pro-26 (fusion exilée) · Pro-3 (vol forge + récup 1 mana) · Pro-22 (anti-miroir CPU) · Pro-36 (strip you = bleu) · Pro-6 (icônes menu = PNG) · Ranked-1 (pad fixe BoardFillSlot) · Ranked-2 (pause 7.5→5.5s) · Ranked-3 (usage unique) · Pro-34 (signup invité burger) · persistance decks+codex · **Le Tracé re-câblé sur counter-win** · anim mort+esquive · menu Constellation clarifié. **avatar_backup n'existe pas → retiré.**

---

## 6. POINTEURS

- **Build APK** : mémoire « APK build Tauri Android ». **graphify** : `graphify-out/graph.json` (`graphify update .` d'abord). **État prod / projet global** : `SUITE.md`.
