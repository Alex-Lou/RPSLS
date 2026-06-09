# ⚠️ Bug : Double comptage du streak XP

**Date :** 2026-06-08
**Découvert par :** Cline (audit du flux recordMatch)
**Pour :** Claude (chargé de Constellation Pro et du store)
**Fichiers concernés :** `app/src/pages/play/PlayGame.tsx`, `app/src/store/store.ts`

---

## Description

Le bonus de streak (×1.5 à 3 wins, ×2.0 à 5+ wins) est appliqué **deux fois** : une fois dans l'appelant (PlayGame.tsx), une fois dans le store (recordMatch).

### Flux actuel

```
PlayGame.tsx (ligne 301) :
  xpDelta = Math.round(baseXp * streakMult * dailyMult)
  // streakMult est déjà inclus dans xpDelta

store.ts (lignes 236-237) :
  const bonusXp = streakBonusXp(m.xpDelta, streak);
  // streakBonusXp ré-applique le multiplicateur sur xpDelta
  p.xp += m.xpDelta + bonusXp;
  // → DOUBLE streak
```

### Impact

| Mode | Effet |
|------|-------|
| Training | Aucun (baseXp = 0) |
| Casual | ×2.25 au lieu de ×1.5 à streak 3 |
| Ranked vs CPU | Même chose que Casual |

### Solution suggérée

**Option A (recommandée) :** Supprimer `streakBonusXp` du store (lignes 234-237).
- Le `xpDelta` fourni par l'appelant est déjà le montant final correct.
- Le store ne garde que le roll du streak (`nextStreak`) pour l'état.

**Option B :** Supprimer le `streakMult` du calcul dans `PlayGame.tsx` (ligne 301).
- Mais cela obligerait TOUS les appelants à gérer le streak eux-mêmes.

---

## Note

Ne pas toucher aux autres modes (Constellation Pro, Arena, Lanes) — leur flux `recordMatch` est séparé et n'est pas impacté par ce bug.