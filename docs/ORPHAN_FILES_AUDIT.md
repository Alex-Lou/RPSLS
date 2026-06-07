# Audit des Fichiers Orphelins — RPSLS

**Date:** 2026-06-07  
**But:** Identifier les fichiers à la racine qui devraient être déplacés dans des dossiers dédiés pour assainir le projet.  
**Règle:** Ce fichier ne fait QUE l'audit. Aucun fichier n'est déplacé. C'est une recommandation pour un futur nettoyage.

---

## Fichiers racine — avec recommandation

| Fichier | Taille estimée | Recommandation | Justification |
|---------|---------------|----------------|---------------|
| `.gitignore` | normal | ✅ Rester à la racine | Outillage standard |
| `Cargo.lock` | normal | ✅ Rester à la racine | Rust workspace lock |
| `Cargo.toml` | normal | ✅ Rester à la racine | Workspace manifest |
| `render.yaml` | normal | ✅ Rester à la racine | Déploiement Render.com |
| **`ARCHITECTURE_REVIEW.md`** | ~40 KB | → `docs/` | Document d'audit technique |
| **`CARTES-NOUVELLES.md`** | variable | → `docs/design/` | Document de game design |
| **`HANDOFF.md`** | variable | → `docs/` | Document de passation |
| **`HANDOFF_COSMETICS.md`** | ~8 KB | → `docs/` | Résumé technique cosmétiques |
| **`IDEES-LOOT.md`** | variable | → `docs/design/` | Idées de game design |
| **`PROMPTS-ICONES.md`** | variable | → `docs/design/` | Référence prompts/icons |
| **`CITATIONS_UNIVERSELLES.md`** | ~12 KB | → `docs/content/` | Base de données de contenu |
| **`TITRES_VICTOIRE.md`** | ~10 KB | → `docs/content/` | Base de données de contenu |
| **`TITRES_RECOMPENSES.md`** | ~14 KB | → `docs/content/` | Design system rewards |
| **`ORPHAN_FILES_AUDIT.md`** | ~2 KB | → `docs/` | Ce fichier même |

---

## Structure de dossiers proposée

```
RPSLS/
├── .gitignore
├── Cargo.toml
├── Cargo.lock
├── render.yaml
├── app/                     # Tauri + React
├── crates/                  # rpsls-core, rpsls-server
├── docs/
│   ├── PLAY_AUTH_AND_IAP.md
│   ├── ARCHITECTURE_REVIEW.md
│   ├── HANDOFF.md
│   ├── HANDOFF_COSMETICS.md
│   ├── ORPHAN_FILES_AUDIT.md
│   ├── design/              # Game design documents
│   │   ├── CARTES-NOUVELLES.md
│   │   ├── IDEES-LOOT.md
│   │   └── PROMPTS-ICONES.md
│   └── content/             # Contenu éditorial (citations, titres)
│       ├── CITATIONS_UNIVERSELLES.md
│       ├── TITRES_VICTOIRE.md
│       └── TITRES_RECOMPENSES.md
├── keystore/
├── landing/
├── loadtest/
├── scripts/
└── _avatar_backup/          # ⚠️ À documenter ou supprimer
```

---

## Cas particuliers

### `_avatar_backup/` (14 fichiers PNG)
- **Statut:** Dossier de backup d'assets visuels
- **Recommandation:** Soit le déplacer dans `app/public/avatars/` s'ils sont encore utilisés, soit le documenter comme "archive historique" et le laisser (le préfixe `_` indique déjà un dossier spécial)
- **Risque:** Si ces PNG sont référencés dans le code, un déplacement casserait les imports. À vérifier avant de bouger.
- **Verdict:** ⚠️ **Ne pas toucher sans auditer les références dans le code**

### `landing/` 
- Contient `index.html`, `privacy.html`, `logo.png`, `README.md`
- **Statut:** Page d'atterrissage web autonome
- **Verdict:** ✅ Légitime, reste où il est. C'est un mini-site indépendant.

---

## Résumé

| Catégorie | Fichiers concernés | Action |
|-----------|-------------------|--------|
| ✅ Rester racine | `.gitignore`, `Cargo.*`, `render.yaml` | Aucune |
| 📁 → `docs/` | `ARCHITECTURE_REVIEW.md`, `HANDOFF.md`, `HANDOFF_COSMETICS.md` | Déplacer |
| 📁 → `docs/design/` | `CARTES-NOUVELLES.md`, `IDEES-LOOT.md`, `PROMPTS-ICONES.md` | Déplacer (créer dossier) |
| 📁 → `docs/content/` | `CITATIONS_UNIVERSELLES.md`, `TITRES_VICTOIRE.md`, `TITRES_RECOMPENSES.md` | Déplacer (créer dossier) |
| ⚠️ Attention | `_avatar_backup/` | Vérifier les références avant de toucher |

**Total: 10 fichiers orphelins** sur 18 à la racine (hors dossiers). 7 sont des documents Markdown créés récemment, 2 sont des documents de design historique, 1 est ce fichier d'audit.