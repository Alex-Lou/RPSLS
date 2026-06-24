/**
 * voieEmblem — médaillons d'emblème par Voie (Alex 2026-06-23).
 *
 * 5 médaillons ronds (1 par Voie, fond transparent) réutilisés à DEUX endroits
 * pour ancrer l'identité visuelle « ma Voie = ce médaillon » :
 *   1. l'écran de CHOIX de Voie (ArenaLobby) — où tu le choisis,
 *   2. la JAUGE de Voie en match (ArenaConstellationBar) — où il se remplit.
 *
 * KISS : juste une table chemin-par-Move. Les fichiers vivent dans
 * `app/public/Voies/<move>.png` (noms ASCII = pas de bug d'URL WebView).
 */

import type { Move } from "../engine/game";

export const VOIE_EMBLEM: Record<Move, string> = {
  rock: "/Voies/rock.png",
  paper: "/Voies/paper.png",
  scissors: "/Voies/scissors.png",
  lizard: "/Voies/lizard.png",
  spock: "/Voies/spock.png",
};
