/**
 * ArenaOnlineGame — orchestrateur du mode Constellation Pro EN LIGNE (1v1 humain).
 *
 * SRP : ce composant ne gère QUE la mise en relation réseau (connexion,
 * matchmaking, handshake, échange des decks), puis délègue TOUT le match à
 * `ArenaGame` en lui injectant un `ArenaOnlineDriver`. Aucune logique de jeu ici.
 *
 * Séquence : connect → hello → file « arena » (variant + ruleset_hash) →
 * match_found (shared_seed, you_are) → prêt + pièce serveur → échange deck/Voie
 * (round 0) → build driver → <ArenaGame online={driver}/>. Le déterminisme +
 * le lockstep sont prouvés headless (arena-lockstep-check / arena-session-check) ;
 * ici c'est le câblage réseau, validé sur deux appareils.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";
import { MOVES } from "../engine/game";
import { OnlineClient } from "../online/online";
import { resolveWsUrl, helloFrame } from "../online/transientSession";
import { makeRngPair } from "../engine/rng";
import { buildPlayerDeck, resolveArenaDeckSource } from "./arenaDecks";
import { arenaRulesetHash } from "./arenaNet";
import { ArenaOnlineSession } from "./arenaOnlineSession";
import { makeArenaOnlineDriver, type ArenaOnlineDriver } from "./arenaOnlineDriver";
import { ArenaGame } from "./ArenaGame";

type Phase = "connecting" | "searching" | "setup" | "playing" | "error" | "desync";

/** Round réservé pour l'échange initial deck+Voie (cf. arenaOnlineDriver). */
const ROUND_SETUP = 0;

/** Parse défensif du setup adverse (deck + Voie) reçu du réseau — on ne fait
 *  jamais confiance au pair : deck filtré aux cartes connues, Voie validée. */
function parseOppSetup(raw: unknown): { deck: CardId[]; affinity: Move } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { deck?: unknown; affinity?: unknown };
  if (!Array.isArray(r.deck)) return null;
  const deck = r.deck.filter(
    (id): id is CardId => typeof id === "string" && Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  if (deck.length === 0) return null;
  if (typeof r.affinity !== "string" || !(MOVES as string[]).includes(r.affinity)) return null;
  return { deck, affinity: r.affinity as Move };
}

export function ArenaOnlineGame({ onBack }: { onBack: () => void }) {
  const player = useStore((s) => s.player);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [driver, setDriver] = useState<ArenaOnlineDriver | null>(null);
  const clientRef = useRef<OnlineClient | null>(null);

  useEffect(() => {
    let alive = true;
    const url = resolveWsUrl();
    if (!url) { setErrMsg("Aucun serveur configuré."); setPhase("error"); return; }

    // Mon deck + ma Voie (MÊME dérivation que ArenaGame → board canonique cohérent).
    const myDeck = buildPlayerDeck(
      resolveArenaDeckSource(player.arenaAffinity, player.arenaDeckByVoie, player.arenaDeck ?? player.rankedDeck)
        .filter((id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id)),
      player.arenaAffinity,
    );
    const myAffinity: Move = player.arenaAffinity ?? "rock";

    const client = new OnlineClient();
    clientRef.current = client;
    const session = new ArenaOnlineSession(
      (msg) => client.send(msg),
      { winTo: 1, rulesetHash: arenaRulesetHash() }, // Arena = 1 partie à mort (win_to inerte côté règle)
      {
        onError: (_code, message) => { if (alive) { setErrMsg(message); setPhase("error"); } },
        onOpponentLeft: () => { /* ArenaGame affiche déjà sa fin/forfait ; le retour hub est manuel */ },
        onMatchEnd: (_winner, _forfeit, desync) => {
          // Le serveur a DROP le match (hash d'état ou résultats divergents →
          // triche/bug détecté) : aucun résultat crédité, on l'annonce (Phase 4).
          if (alive && desync) setPhase("desync");
        },
      },
    );
    client.on((msg) => session.handle(msg));

    (async () => {
      try {
        await client.connect(url);
        if (!alive) return;
        // Hello (pseudo affiché à l'adversaire ; jamais "Anonymous", cf. serveur)
        client.send(helloFrame({ id: player.id, nickname: player.nickname, claimToken: player.claimToken }));
        session.join();
        setPhase("searching");

        const info = await session.waitMatchFound();
        if (!alive) return;
        setPhase("setup");

        // Prep : prêt + pièce serveur (gate le double-ready ; on ignore le camp
        // gagnant de la pièce en v1 — cosmétique pad, à câbler plus tard).
        session.markReady();
        await session.waitCoinFlip();
        if (!alive) return;

        // Échange deck + Voie (round 0) → board canonique identique des 2 côtés.
        const oppRaw = await session.exchange(ROUND_SETUP, { deck: myDeck, affinity: myAffinity });
        if (!alive) return;
        const oppSetup = parseOppSetup(oppRaw);
        if (!oppSetup) { setErrMsg("Données adversaire invalides."); setPhase("error"); return; }

        const d = makeArenaOnlineDriver(session, {
          mySide: info.youAre,
          rngPair: makeRngPair(info.sharedSeed),
          oppName: info.opponentName,
          oppDeck: oppSetup.deck,
          oppAffinity: oppSetup.affinity,
        });
        setDriver(d);
        setPhase("playing");
      } catch (e) {
        if (alive) { setErrMsg(e instanceof Error ? e.message : "Connexion perdue."); setPhase("error"); }
      }
    })();

    return () => {
      alive = false;
      client.disconnect();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quit() {
    clientRef.current?.send({ type: "leave_match" });
    clientRef.current?.disconnect();
    onBack();
  }

  if (phase === "playing" && driver) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <ArenaGame online={driver} oppName={driver.oppName} onQuit={quit} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      {phase === "desync" ? (
        <>
          <div className="text-lg font-bold text-amber-300">Match annulé</div>
          <div className="text-sm text-ink-muted max-w-xs">Désynchronisation détectée entre les deux joueurs — aucun résultat n'est crédité.</div>
          <button onClick={onBack} className="mt-2 px-5 py-2 rounded-xl bg-surface border border-hairline font-semibold">Retour</button>
        </>
      ) : phase === "error" ? (
        <>
          <div className="text-lg font-bold text-rose-300">Connexion impossible</div>
          <div className="text-sm text-ink-muted max-w-xs">{errMsg}</div>
          <button onClick={onBack} className="mt-2 px-5 py-2 rounded-xl bg-surface border border-hairline font-semibold">Retour</button>
        </>
      ) : (
        <>
          <div className="text-lg font-bold" style={{ color: "var(--theme-primary)" }}>
            {phase === "connecting" ? "Connexion…" : phase === "searching" ? "Recherche d'un adversaire…" : "Préparation du duel…"}
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--theme-primary)", borderTopColor: "transparent" }} />
          <button onClick={quit} className="mt-2 px-5 py-2 rounded-xl bg-surface border border-hairline text-sm">Annuler</button>
        </>
      )}
    </div>
  );
}
